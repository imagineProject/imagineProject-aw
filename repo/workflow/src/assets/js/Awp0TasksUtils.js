// Copyright (c) 2021 Siemens

/**
 * @module js/Awp0TasksUtils
 */
import viewModelObjSvc from 'js/viewModelObjectService';
import msgsvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import eventBus from 'js/eventBus';

var exports = {};
var _NULL_ID = 'AAAAAAAAAAAAAA';


/**
 * Return true/false based on allow_subgroups property on signoff profile object
 *
 * @param {Object} signoffProfileVMOObject - Signoff profileVMO obejct where decision required property needs to
 *            be populated
 * @return {Boolean} True/False value
 */
var isAllowSubGroup = function( signoffProfileVMOObject ) {
    if( signoffProfileVMOObject.props && signoffProfileVMOObject.props.allow_subgroups && signoffProfileVMOObject.props.allow_subgroups.dbValues ) {
        var allowSubGroupsValue = signoffProfileVMOObject.props.allow_subgroups.dbValues[ 0 ];
        if( allowSubGroupsValue && ( allowSubGroupsValue === '1' || allowSubGroupsValue === 'true' ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Get the input obejct property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Get the group values for internal name and display name and return.
 *
 * @param {Object} profileObject Profile object from group value needs to be fetched.
 *
 * @returns {Object} Object that will contain group internal name and display name
 */
var _getProfileGroupObject = function( profileObject ) {
    var groupInternalName = null;
    var groupDispName = null;

    groupInternalName = _getPropValue( profileObject, 'object_full_name' );
    var groupUid = _getPropValue( profileObject, 'group' );
    // If ref property is not present then get it from profile property group
    if( !groupInternalName && groupUid ) {
        var groupObject = soa_kernel_clientDataModel.getObject( groupUid );
        groupInternalName = _getPropValue( groupObject, 'object_full_name' );
    }

    // Default value for group internal name
    if( !groupInternalName ) {
        groupInternalName = '';
    }
    // Get the group display name from group object of profile
    if( groupUid ) {
        groupObject = soa_kernel_clientDataModel.getObject( groupUid );
        groupDispName = _getPropValue( groupObject, 'object_string', true );
    }

    // Default value for group display name
    if( !groupDispName ) {
        groupDispName = '*';
    }

    return {
        groupInternalName: groupInternalName,
        groupDispName: groupDispName
    };
};

/**
 * Get the role values for internal name and display name and return.
 *
 * @param {Object} profileObject Profile object from role value needs to be fetched.
 *
 * @returns {Object} Object that will contain role internal name and display name
 */
var _getProfileRoleObject = function( profileObject ) {
    var roleInternalName = '';
    var roleDispName = '*';

    roleInternalName = _getPropValue( profileObject, 'REF(role,Role).role_name' );
    var roleUid = _getPropValue( profileObject, 'role' );
    // If ref proeprty is not present then get value from role property on profile
    if( !roleInternalName && roleUid ) {
        var roleObject = soa_kernel_clientDataModel.getObject( roleUid );
        roleInternalName = _getPropValue( roleObject, 'role_name' );
        roleDispName = _getPropValue( roleObject, 'role_name', true );
    }
    // Default value if null
    if( !roleInternalName ) {
        roleInternalName = '';
    }

    // Get the display name from role object on profile
    if( roleUid ) {
        var roleObject = soa_kernel_clientDataModel.getObject( roleUid );
        roleDispName = _getPropValue( roleObject, 'role_name', true );
    }

    // Role default value if null
    if( !roleDispName ) {
        roleDispName = '*';
    }

    return {
        roleInternalName: roleInternalName,
        roleDispName: roleDispName
    };
};

/**
 * Populate the signoff profile group role name property on signoff profile object
 *
 * @param {Object} signoffProfileVMOObject - Signoff profileVMO obejct where decision required property needs to
 *            be populated
 */
var populateSignoffProfileGroupRoleProp = function( signoffProfileVMOObject ) {
    var signoffProfileObj = _.clone( signoffProfileVMOObject );
    // Check for allow sub groups proeprty value and if that is true then append ++
    // to the group name to be displayed on UI.
    var isSubGroupAllowed = isAllowSubGroup( signoffProfileObj );

    // Get the group and role object from profile that contains specific internal or display names
    var groupObject = _getProfileGroupObject( signoffProfileObj );
    var roleObject = _getProfileRoleObject( signoffProfileObj );

    var additionalSearchCriteria = {};

    // Populate the additional search criteria based on group and role object
    if( groupObject && roleObject && groupObject.groupDispName && roleObject.roleDispName ) {
        if( groupObject.groupDispName && roleObject.roleDispName ) {
            // Check for allow sub groups proeprty value and if that is true then append ++
            // to the group name to be displayed on UI.
            if( isSubGroupAllowed ) {
                groupObject.groupDispName += '++';
            }
            var groupRoleName = groupObject.groupDispName + '/' + roleObject.roleDispName;
            signoffProfileObj.groupRoleName = groupRoleName;
            signoffProfileObj.groupName = groupObject.groupDispName;
            signoffProfileObj.roleName = roleObject.roleDispName;
            additionalSearchCriteria.displayedGroup = groupObject.groupDispName;
            additionalSearchCriteria.displayedRole = roleObject.roleDispName;
        }
        // If group object contains internal name then add that name to additional search
        // criteria as well.
        if( groupObject.groupInternalName ) {
            signoffProfileObj.groupInternalName = groupObject.groupInternalName;
            additionalSearchCriteria.group = groupObject.groupInternalName;
        }

        // If role object contains internal name then add that name to additional search
        // criteria as well.
        if( roleObject.roleInternalName ) {
            signoffProfileObj.roleInternalName = roleObject.roleInternalName;
            additionalSearchCriteria.role = roleObject.roleInternalName;
        }
        additionalSearchCriteria.searchSubGroup = 'false';
        if( isSubGroupAllowed ) {
            additionalSearchCriteria.searchSubGroup = 'true';
        }
    }

    // Add the additional search criteria to profile object itself to be used
    signoffProfileObj.additionalSearchCriteria = additionalSearchCriteria;
    return signoffProfileObj;
};

/**
 * Get the created view model object.
 *
 * @param {Object} modelObject Profile obejct for VMO need to be created
 * @param {object} data - the data Object
 *
 * @returns {object} signoffProfileVMOObject - profile VMO object
 */
export let getSignoffProfileObject = function( modelObject, data ) {
    var signoffProfileVMOObject = null;
    if( modelObject && modelObject.uid && modelObject.uid !== _NULL_ID ) {
        signoffProfileVMOObject = viewModelObjSvc.createViewModelObject( modelObject.uid, 'EDIT', null, modelObject );

        if( !signoffProfileVMOObject ) {
            return signoffProfileVMOObject;
        }
        var requiredString = null;
        if( data && data.i18n.required ) {
            requiredString = data.i18n.required;
        } else {
            var localeTextBundle = localeService.getLoadedText( 'WorkflowCommandPanelsMessages' );
            requiredString = localeTextBundle.required;
        }

        if( requiredString && signoffProfileVMOObject.props && signoffProfileVMOObject.props.number_of_signoffs &&
            signoffProfileVMOObject.props.number_of_signoffs.dbValues ) {
            var requiredReviewers = signoffProfileVMOObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + requiredString;

            signoffProfileVMOObject.requiredReviewers = requiredReviewers;
        }

        // Populate the signoff profile group role name proeprty on signoff profile object
        signoffProfileVMOObject = populateSignoffProfileGroupRoleProp( signoffProfileVMOObject );
    }
    return signoffProfileVMOObject;
};

/**
 * This will return the profile object
 * @param {JSONString} profileJSONString - Json String recieved by server
 * @param {Object} data  - data
 * @returns {array} signoffProfiles - array of profile objects.
 */
export let getProfiles = function( profileJSONString, data ) {
    var signoffProfiles = [];
    if( profileJSONString && profileJSONString.length > 0 ) {
        var profiles = JSON.parse( profileJSONString );

        _.forEach( profiles.objects, function( result ) {
            if( result ) {
                var updatedVMO = exports.getSignoffProfileObject( result, data );
                if( updatedVMO ) {
                    signoffProfiles.push( updatedVMO );
                }
            }
        } );
    }
    return signoffProfiles;
};

/**
 * Format the error message for display
 * @param {Array} objectsAlreadyAdded - objects added as targets
 * @param {Array} selectedObjects - Selected objects that need to be added
 * @returns {String} finalMessage
 */
export let getDuplicateErrorMessage = function( objectsAlreadyAdded, selectedObjects ) {
    var message = '';
    var finalMessage = '';
    var localeTextBundle = localeService.getLoadedText( 'WorkflowCommandPanelsMessages' );
    if( objectsAlreadyAdded.length === 1 ) {
        message = objectsAlreadyAdded[ 0 ].props.object_string.dbValues[ 0 ];
        message = _removeUserIdFromMessage( message );
        var localDuplicateErorMsg = msgsvc.applyMessageParams( localeTextBundle.duplicateReviewerMsg, [ '{{message}}' ], {
            message: message
        } );
        finalMessage = localDuplicateErorMsg;
    }
    if( objectsAlreadyAdded.length > 1 ) {
        for( var dup = 0; dup < objectsAlreadyAdded.length; ++dup ) {
            message = objectsAlreadyAdded[ dup ].props.object_string.dbValues[ 0 ];
            message = _removeUserIdFromMessage( message );
            var localMsg = msgsvc.applyMessageParams( localeTextBundle.wasNotAdded, [ '{{message}}' ], {
                message: message
            } );
            finalMessage += localMsg + '</br>';
        }
        var cannotBeAddedCount = objectsAlreadyAdded.length;
        var totalSelectedObj = selectedObjects.length;
        var msg = msgsvc.applyMessageParams( localeTextBundle.multipleDuplicateMsg, [ '{{cannotBeAddedCount}}', '{{totalSelectedObj}}' ], {
            cannotBeAddedCount: cannotBeAddedCount,
            totalSelectedObj: totalSelectedObj
        } );
        finalMessage = msg + '</br>' + finalMessage;
    }
    return finalMessage;
};

/**
 * Remove the user id from the error string if present
 * @param {*} messageString - message
 * @returns {String} returnedMessage
 */
var _removeUserIdFromMessage = function( messageString ) {
    var returnedMessage = messageString;
    var endIndex = messageString.lastIndexOf( '(' );
    if( endIndex > 0 ) {
        returnedMessage = messageString.substring( 0, endIndex );
    }
    returnedMessage = '"' + returnedMessage + '"';
    return returnedMessage;
};

export let registeringContext = function( cmdContext, data, ctx ) {
    cmdContext.selectionMode = 'multiple';
    if( cmdContext.name === 'assignerDataProvider' ) {
        cmdContext.selectionMode = 'single';
    }
    var context = {
        selectionModelMode: cmdContext.selectionMode,
        loadProjectData: true,
        dataProvider: cmdContext
    };
    if( ctx.assignAllTasks.parentData.additionalSearchCriteria ) {
        delete ctx.assignAllTasks.parentData.additionalSearchCriteria;
    }
    if( data.dataProviders && data.dataProviders.userPerformSearch ) {
        data.dataProviders.userPerformSearch.selectionModel.mode = cmdContext.selectionMode;
    }
    appCtxSvc.registerCtx( 'workflow', context );
};

/**
 * This method enables visibility of Future Task Table based on collapsed state of section.
 * This is
 * @param {String} viewName - name of the aw-command-panel-section
 * @param {Boolean} isCollapsed - collapsed state of aw-command-panel-section
 *
 * @returns {boolean} True/False based on future task table is visible or not
 */
export let populateOrHideFutureTaskTable = function( viewName, isCollapsed ) {
    var isFutureTaskTableVisible = false;
    if( viewName === 'Awp0FutureTasks' ) {
        isFutureTaskTableVisible = !isCollapsed;
        if( isFutureTaskTableVisible ) {
            // Fire this event to close any popup panel if opened as open  popup panel
            // and upcoming task table both don't work together.
            eventBus.publish( 'workflow.closePopupPanel' );
        }
    }
    return isFutureTaskTableVisible;
};

/**
 * To reset future task table object table is shown. This will be called when we
 * collapse future task table.
 *
 * @returns {Object} To reset future task table object table is shown
 */
export let resetFutureTaskTableOptions = function() {
    return {
        renderObject : null,
        isDataInit : false
    };
};

/**
 * Collapse the input section with given name
 * @param {Object} data - the data object
 * @param {String} sectionName Section anme that need to be collapsed
 */
export let collapseGivenSection = function( data, sectionName ) {
    data.isFutureTaskTableVisible = false;
    // var scope = angular.element( document.getElementById( sectionName ) ).isolateScope();
    // if( scope && scope.collapsed === 'false' ) {
    //     scope.flipSectionDisplay();
    // }
};

export default exports = {
    getProfiles,
    getDuplicateErrorMessage,
    registeringContext,
    populateOrHideFutureTaskTable,
    collapseGivenSection,
    getSignoffProfileObject,
    resetFutureTaskTableOptions
};
