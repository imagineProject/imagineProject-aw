// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0NotificationService
 */
import ac0Utils from 'js/Ac0ConversationUtils';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import commandPanelService from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import convUtils from 'js/Ac0ConversationUtils';
import $ from 'jquery';
import _ from 'lodash';

var exports = {};

var checkReadyCount = 0;

const showObjectName = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
const prefPrefix = 'preferences.';
const enableEmailPrefName = 'Ac0EnableEmailDiscussionNotifications';
const enableUserEmailPrefName = 'Ac0EnableUserEmailDiscussionNotifications';
const enableThrottleUserEmailPrefName = 'Ac0ThrottleUserEmailDiscussionNotifications';


let openConversationPanel = function( ) {
    var selected = appCtxService.getCtx( 'selected' );
    var mselected = appCtxService.getCtx( 'mselected' );
    var elem = $( 'button[button-id=\'Ac0UniversalConversationCommand\']' );
    if( selected && mselected.length === 1 && elem.length > 0 ) {
        commandPanelService.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo' );
        checkReadyCount = 0;
    } else {
        checkReadyCount++;
        if( checkReadyCount <= 360 ) {
            setTimeout( openConversationPanel, 500 );
        }
    }
};

export let openConversationProcessing = function( data ) {
    var message = data.object;

    if( message !== null && message.props !== null && message.props.fnd0TargetObject !== null &&
        message.props.fnd0TargetObject.dbValues !== null && message.props.fnd0TargetObject.dbValues.length > 0 ) {
        var targetUid = message.props.fnd0TargetObject.dbValues[ 0 ];

        var toolsAndInfoCommand = appCtxService.getCtx( 'activeToolsAndInfoCommand' );
        var ac0ConvCtx = appCtxService.getCtx( 'Ac0ConvCtx' );
        if( ac0ConvCtx && ac0ConvCtx.selected && toolsAndInfoCommand
            && toolsAndInfoCommand.commandId === 'Ac0UniversalConversationPanel'
            && ac0ConvCtx.selected.uid === targetUid ) {
            return;
        }

        // if the param uid is the same as tartetUid and the selected is a Awb0Element and the underlying object not
        // the same as target object, the conversation should be on the topline.
        let currentStateName = AwStateService.instance.current.name;
        let paramUid = AwStateService.instance.params.uid;

        if( currentStateName === showObjectName && paramUid === targetUid && appCtxService.ctx.selected.props &&
            appCtxService.ctx.selected.props.awb0UnderlyingObject ) {
            let selectedUid = appCtxService.ctx.selected.props.awb0UnderlyingObject.dbValues[0];
            if( selectedUid !== targetUid ) {
                let selection = selectionService.getSelection();
                eventBus.publish( 'aceElementsDeSelectedEvent', {
                    elementsToDeselect: selection.selected
                } );

                let topLine = AwStateService.instance.params.t_uid;
                if( topLine ) {
                    let topLineObj = cdm.getObject( topLine );
                    selectionService.updateSelection( topLineObj );
                }

                if( ac0ConvCtx && ac0ConvCtx.selected && toolsAndInfoCommand
                    && toolsAndInfoCommand.commandId === 'Ac0UniversalConversationPanel' ) {
                    // if the discussion panel already open under the current selection
                    // close the panel and then open it again
                    commandPanelService.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo' );
                    setTimeout( openConversationPanel, 500 );
                    return;
                }

                setTimeout( openConversationPanel, 500 );
                return;
            }
        }

        exports.redirectToShowObject( targetUid );
    }
};

/**
 * Open notification message
 * @param { data } data - contains event object
 */
export let openLineItem = function( data ) {
    if( data.eventObj.props.eventtype_id && data.object && data.object.uid ) {
        exports.openConversationProcessing( data );
    }
};

/**
 * Opens the notification object on notification message click in xrt show object sublocation
 * @param {@String} uid uid
 * @param {@Object} params params
 */
export let redirectToShowObject = function( uid, params ) {
    if( uid ) {
        var options = {};

        var toParams = {};
        if( params ) {
            toParams = params;
        } else {
            toParams.uid = uid;
            toParams.page = 'Overview';
        }
        options.inherit = false;

        AwStateService.instance.go( showObjectName, toParams, options );

        setTimeout( openConversationPanel, 500 );
    }
};

/**
 * Manage the subscription to objects or conversations.
 * @param {[ModelObject]} sourceObjects The list of source objects to follow
 * @param {[ModelObject]} conversations The list of conversations to follow
 * @param {Boolean} subscriptionFlag Follow or unfollow.
 * @returns {Promise} promise
 */
export let callCollabSubscribeSOA = function( sourceObjects, conversations, subscriptionFlag ) {
    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};
    var soaMethod;

    soaInput.sourceObjects = sourceObjects;
    soaInput.subscriptionFlag = subscriptionFlag;
    soaInput.conversations = conversations;

    soaMethod = 'manageSubscriptions';

    ac0Utils.callActiveCollabSoa( soaMethod, soaInput ).then( function( responseData ) {
        deferred.resolve( responseData );
        var convCtx = appCtxService.getCtx( 'Ac0ConvCtx' );
        if( typeof responseData.deleted !== 'undefined' ) {
            if ( conversations.length > 0 ) {
                convCtx.ac0NumSubscriptionsForSelectedConv = 0;
            } else {
                convCtx.ac0NumSubscriptionsForSelectedObj = 0;
            }
        } else {
            if ( conversations.length > 0 ) {
                convCtx.ac0NumSubscriptionsForSelectedConv = 1;
            } else {
                convCtx.ac0NumSubscriptionsForSelectedObj = 1;
            }
        }
        appCtxService.registerCtx( 'Ac0ConvCtx', convCtx );
    } );
    return deferred.promise;
};

/**
 * Subscribe to notifications for a source object
 * @param {*} object the object to follow
 * @returns {Promise} promise
 */
export let collabSubscribeToObj = function( object ) {
    var objUid = ac0Utils.getObjectUID( object );
    var objForSoa = cdm.getObject( objUid );
    return exports.callCollabSubscribeSOA( [ objForSoa ], [], true );
};

/**
 * Unsubscribe to notifications for a source object
 * @param {*} object the object to follow
  * @returns {Promise} promise
 */
export let collabUnSubscribeToObj = function( object ) {
    var objUid = ac0Utils.getObjectUID( object );
    var objForSoa = cdm.getObject( objUid );
    return exports.callCollabSubscribeSOA( [ objForSoa ], [], false );
};

/**
 * Subscribe to notifications for a conversation
 * @param {*} object the object to follow
  * @returns {Promise} promise
 */
export let collabSubscribeToConversation = function( object ) {
    var selectedObjUid = ac0Utils.getObjectUID( appCtxService.getCtx( 'selected' ) );
    var objForSoa = cdm.getObject( selectedObjUid );
    var selectedObj = appCtxService.getCtx( 'selected' );
    if( object ) {
        object.showFollowConv = false;
        if( convUtils.isDiscussionSublocation() ) {
            objForSoa = selectedObj.props.inflatedSrcObjList[0];
        }else if( selectedObj === null && typeof object !== 'undefined' ) {
            objForSoa = object.props.inflatedSrcObjList[0];
        }
    }
    return exports.callCollabSubscribeSOA( [ objForSoa ], [ object ], true );
};

/**
 * Unsubscribe to notifications for a conversation
 * @param {*} object the object to follow
  * @returns {Promise} promise
 */
export let collabUnSubscribeToConversation = function( object ) {
    var selectedObjUid = ac0Utils.getObjectUID( appCtxService.getCtx( 'selected' ) );
    var objForSoa = cdm.getObject( selectedObjUid );
    var selectedObj = appCtxService.getCtx( 'selected' );
    if( object ) {
        object.showFollowConv = true;
        if( convUtils.isDiscussionSublocation() ) {
            objForSoa = selectedObj.props.inflatedSrcObjList[0];
        }else if( selectedObj === null && typeof object !== 'undefined' ) {
            objForSoa = object.props.inflatedSrcObjList[0];
        }
    }
    return exports.callCollabSubscribeSOA( [ objForSoa ], [ object ], false );
};

/** helper method to cal the setPreferences2 soa call */
let setPreferenceValuesOnClick = function( data, emailPrefName ) {
    var deferred = AwPromiseService.instance.defer();
    var newData = _.cloneDeep( data );

    var prefObj = appCtxService.getCtx( prefPrefix + emailPrefName );
    let newPrefStringVal = 'false';
    if( emailPrefName === enableUserEmailPrefName ) {
        prefObj.values.values[0] = newData.discActivity.dbValue;
        newPrefStringVal = newData.discActivity.dbValue.toString();
    } else if ( emailPrefName === enableThrottleUserEmailPrefName ) {
        prefObj.values.values[0] = newData.discThrottle.dbValue;
        newPrefStringVal = newData.discThrottle.dbValue.toString();
    }

    appCtxService.updateCtx( prefPrefix + emailPrefName, prefObj );
    //set the preference
    let preferenceInput = [ {
        preferenceName: emailPrefName,
        values: [ newPrefStringVal ]
    } ];

    soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'setPreferences2', {
        preferenceInput: preferenceInput
    } ).then( function() {
        deferred.resolve();
    } );
    return deferred.promise;
};

export let discActivityClick = function( data ) {
    return setPreferenceValuesOnClick( data, enableUserEmailPrefName );
};

/**
 * If user modifies the email throttle settings than it will update the context value and make a SOA call
 * setPreferences2 to update the preference value.
 */
export let discThrottleClick = function( data ) {
    return setPreferenceValuesOnClick( data, enableThrottleUserEmailPrefName );
};

/**
 * When user-> profile page is loaded it will read the preference value and mark the checkbox true and false.
 */
export let loadEmailNotificationPreferences = function( data ) {
    var newData = _.cloneDeep( data );

    return soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ enableEmailPrefName, enableUserEmailPrefName, enableThrottleUserEmailPrefName ],
        includePreferenceDescriptions: false
    }, {} ).then(
        function( result ) {
            if( result.response.length > 0 ) { // Preference Found
                for( let i = 0; i < result.response.length; i++ ) {
                    var preference = appCtxService.getCtx( prefPrefix + enableEmailPrefName );
                    let prefValObj = result.response[ i ];
                    let prefName = result.response[i].definition.name;
                    let prefValue = result.response[ i ].values.values[ 0 ];
                    if( prefName === enableEmailPrefName ) {
                        if( preference ) {
                            appCtxService.updateCtx( prefPrefix + enableEmailPrefName, prefValObj );
                        } else {
                            appCtxService.registerCtx( prefPrefix + enableEmailPrefName, prefValObj );
                        }
                    } else if( prefName === enableUserEmailPrefName ) {
                        newData.discActivity.dbValue = prefValue;
                        appCtxService.updateCtx( prefPrefix + enableUserEmailPrefName, prefValObj );
                    } else if( prefName === enableThrottleUserEmailPrefName ) {
                        newData.discThrottle.dbValue = prefValue;
                        appCtxService.updateCtx( prefPrefix + enableThrottleUserEmailPrefName, prefValObj );
                    }
                }
            } else { // Preference not found
                newData.discActivity.dbValue = false;
                newData.discThrottle.dbValue = false;
            }
            return newData;
        } );
};

/**
 * Service to define actions on alert notification click for document management application
 *
 * @member Ac0NotificationService
 */

export default exports = {
    openConversationProcessing,
    openLineItem,
    redirectToShowObject,
    callCollabSubscribeSOA,
    collabSubscribeToObj,
    collabUnSubscribeToObj,
    collabSubscribeToConversation,
    collabUnSubscribeToConversation,
    discActivityClick,
    discThrottleClick,
    loadEmailNotificationPreferences
};
