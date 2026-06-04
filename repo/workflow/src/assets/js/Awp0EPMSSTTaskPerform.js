// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0EPMSSTTaskPerform
 */
import appCtxSvc from 'js/appCtxService';
import viewModelObjSvc from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import iconSvc from 'js/iconService';
import cdm from 'soa/kernel/clientDataModel';
import Awp0TasksUtils from 'js/Awp0TasksUtils';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import AwStateService from 'js/awStateService';
import _ from 'lodash';

var exports = {};


/**
 * Navigate to the input panel id if not null and in null case we need to navigate to default
 * panel id.
 *
 * @param {String} panelId - Panel id where we need to navigate to that panel.
 *
 * @returns {String} Navigatied panel id which will be activeView.
 */
export let getActiveView = function( panelId ) {
    var viewId = 'Awp0EPMSSTTaskPerformSecondary';
    if( panelId ) {
        viewId = panelId;
    }
    return viewId;
};

/**
 * Get the comments that needs to be passed to server while completing the task.
 *
 * @param {data} data - The qualified data of the viewModel
 *
 * @return {Object} propertyNameValues - Property name value pair array that contains the comment property
 */
export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Populate the required signoff obejct that needs to be shown when profile doesn't exist on the SST task object
 * and no adhoc signoff added in the list then it should show the dummy required cell as signoff needs to be
 * added to complete the task.
 *
 * @param {object} data - the data Object
 * @param {object} signoffProfiles - the signoff profile array that will contain signoff profile and profile
 *            signoffs
 * @param {object} signoffs - the signoff array that will contain adhoc signoffs
 *
 * @returns {Object} Adhoc signoff object
 */
var populateRequiredSignoffObject = function( data, signoffProfiles, signoffs ) {
    var adhocSignoffs = signoffs;
    if ( data && signoffProfiles && signoffs && signoffProfiles.length <= 0 && signoffs <= 0 ) {
        var modelObject = viewModelObjSvc.constructViewModelObjectFromModelObject( null, '' );
        var iconURL = iconSvc.getTypeIconFileUrl( 'typePersonGray48.svg' );
        modelObject.typeIconURL = iconURL;
        modelObject.requiredDispValue = data.i18n.requiredLabel;
        adhocSignoffs.push( modelObject );
    }
    return adhocSignoffs;
};


/**
 * Populate the signoff profile, profile signoff and adhco signoff data and add it to respective data provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Object with all signoff
 */
var populateProfilesAndSignoffData = function( data ) {
    var signoffObjects = [];

    // Get the respective JSON string returned from server to populate the correct data
    var profileJSONString = data.reviewProfiles;
    var profileSignoffString = data.profileSignoffs;
    var adhocSignoffString = data.adhocSignoffs;
    // Get all profile, profile signoffs and adhoc signoffs and then update the
    // respective data provider
    signoffObjects = Awp0TasksUtils.getProfiles( profileJSONString, data );
    var profileSignoffs = awp0InboxUtils.getSignoffObjects( profileSignoffString, data );
    if( profileSignoffs && !_.isEmpty( profileSignoffs ) ) {
        Array.prototype.push.apply( signoffObjects, profileSignoffs );
    }

    data.dataProviders.reviewProfileSignoffProvider.update( signoffObjects, signoffObjects.length );

    // Get the adhoc signoffs and if profile is not present and no signoff present then we need
    // to update the adhoc data provider with required object
    var signoffs = awp0InboxUtils.getSignoffObjects( adhocSignoffString, data );

    // Populate the required dummy cell that needs to be shown when there is no profile and no adhoc signoff present
    var adhocSignoffObjects = populateRequiredSignoffObject( data, signoffObjects, signoffs );

    data.dataProviders.reviewAdhocSignoffProvider.update( adhocSignoffObjects, adhocSignoffObjects.length );
    return {
        reviewProfileSignoffs : signoffObjects,
        reviewAdhocSignoffs : adhocSignoffObjects
    };
};

/**
 * Check for signoff belongs to acknowledge task or not
 *
 * @param {object} selectedObject - the current selection object
 * @return {Boolean} isAcknowledgeTask - True/False value
 *
 */
function isAcknowledgeTaskObject( selectedObject ) {
    var isAcknowledgeTask = false;

    if( selectedObject && selectedObject.props.parent_task && selectedObject.props.parent_task.dbValues ) {
        var modelObj = cdm.getObject( selectedObject.props.parent_task.dbValues[ 0 ] );

        if( modelObj && modelObj.modelType.typeHierarchyArray.indexOf( 'EPMAcknowledgeTask' ) > -1 ) {
            isAcknowledgeTask = true;
        }
    }
    return isAcknowledgeTask;
}

/**
 * Set the quorum value on UI element
 *
 * @param {Object} data - the data Object
 * @param {Object} selectedObject - the current selection object
 *
 *
 * @returns {Object} Object that will contain quorum property along with percent
 *          and numeric quorum property.
 */
var _setQuorumValue = function( data, selectedObject ) {
    var quorumValue = parseInt( selectedObject.props.signoff_quorum.dbValues[ 0 ] );

    var percentQuorumValue = 100;
    var numericQuorumValue = null;

    if( quorumValue > 0 ) {
        numericQuorumValue = quorumValue;
    } else {
        percentQuorumValue = Math.abs( parseInt( selectedObject.props.signoff_quorum.dbValues[ 0 ] ) );
    }

    // Check if comments db value is not null that means there is a value present already
    // either entered by user or present on object then use that value
    var oldQuorumValue = undefined;
    if( data.selectedObject && selectedObject && data.selectedObject.uid ===  selectedObject.uid ) {
        percentQuorumValue = data.percentQuorumValue.dbValue;
        numericQuorumValue = data.numericQuorumValue.dbValue;
        oldQuorumValue = data.quorumOptions.dbValue;
    }

    const percentQuorumProp = { ...data.percentQuorumValue };
    percentQuorumProp.dbValue = percentQuorumValue;
    percentQuorumProp.uiValue = percentQuorumValue;

    const numericQuorumProp = { ...data.numericQuorumValue };
    numericQuorumProp.dbValue = numericQuorumValue;
    numericQuorumProp.uiValue = numericQuorumValue;

    const quorumOptions = { ...data.quorumOptions };
    if( quorumValue > 0 ) {
        quorumOptions.dbValue = false;
    } else {
        quorumOptions.dbValue = true;
    }

    // This is mainly needed when panel is getting refresh due to add or remove action then if there
    // we need to set the previous option what user has selected earlier before doing the action.
    if( !_.isUndefined( oldQuorumValue ) ) {
        quorumOptions.dbValue = oldQuorumValue;
    }

    return {
        quorumOptions :  quorumOptions,
        numericQuorumValue : numericQuorumProp,
        percentQuorumValue : percentQuorumProp
    };
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @param {string} state - the Info panel edithandler state
 * @param {Object} fields - fields
 *
 * @returns {Object} Object with properties needs to be updated on UI
 */
export let populatePanelData = function( data, selection, state, fields ) {
    let fieldProps = [ 'numericQuorumValue', 'percentQuorumValue', 'quorumOptions' ];
    var selectedObject = selection;

    var nameValue = selectedObject.props.object_string.dbValues[ 0 ];
    const newTaskName = { ...data.taskName };
    newTaskName.dbValue = nameValue;
    newTaskName.uiValue = nameValue;

    var commentsValue = selectedObject.props.comments.dbValues[ 0 ];

    var passowrdValue = '';
    var oldWaitForReviewersValue = undefined;

    // Check if comments db value is not null that means there is a value present already
    // either entered by user or present on object then use that value
    if( data.selectedObject && selectedObject && data.selectedObject.uid ===  selectedObject.uid ) {
        commentsValue = data.comments.dbValue;
        passowrdValue = data.password.dbValue;
        oldWaitForReviewersValue = data.waitForReviewers.dbValue;
    }
    if( state === 'saved' ) {
        commentsValue = selectedObject.props.comments.dbValues[ 0 ];
    }

    if ( data.isTCSSOEnabled && AwStateService.instance.params.reauthorize === 'true' ) {
        var commentsURIString = AwStateService.instance.params.comments;
        if ( commentsURIString ) {
            if ( Array.isArray( commentsURIString ) ) {
                commentsURIString = commentsURIString[ commentsURIString.length - 1 ];
            }
            var decodedComments = decodeURIComponent( commentsURIString );
            commentsValue = decodedComments;
        } else {
            commentsValue = '';
        }
    }

    const commentsProp = { ...data.comments };
    commentsProp.dbValue = commentsValue;
    commentsProp.uiValue = commentsValue;

    const passwordProp = { ...data.password };
    passwordProp.dbValue = passowrdValue;
    passwordProp.uiValue = passowrdValue;

    const description = awp0InboxUtils.populateDescription( data.description, selectedObject );
    const workflowDescription = awp0InboxUtils.populateJobDescription( data.workflowDescription, selectedObject );

    var usingSSO = false;
    if ( data.isTCSSOEnabled  && data.isTCSSOEnabled === true ) {
        usingSSO = true;
    }

    // Populate the isSecureTask value
    var secureTaskValue = selectedObject.props.secure_task.dbValues[ 0 ];
    const isSecureTask =  secureTaskValue === '1'  && !usingSSO;

    // Check is selected object is acknowledge task then we need to get profile and signoff
    // related info from ack info which is returned from server
    var isAckSSSTObejct = isAcknowledgeTaskObject( selectedObject );

    if( isAckSSSTObejct ) {
        data.reviewProfiles = data.ackReviewProfiles;
        data.profileSignoffs = data.ackProfileSignoffs;
        data.adhocSignoffs = data.ackAdhocSignoffs;
    }

    var quorumObject =  _setQuorumValue( data, selectedObject );
    var waitForReviewersValue = selectedObject.props.wait_for_all_reviewers.dbValues[ 0 ];

    const waitForReviewers = { ...data.waitForReviewers };
    waitForReviewers.dbValue = waitForReviewersValue === '1';
    // Check if wait for reviewers value is not undefiend that means previous operation have set
    // some value and we need to set the same value again.
    if( !_.isUndefined( oldWaitForReviewersValue ) ) {
        waitForReviewers.dbValue = oldWaitForReviewersValue;
    }

    if( appCtxSvc.ctx && appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.WRKFLW_allow_wait_for_undecided_override[0] === 'false' ) {
        waitForReviewers.isEditable = false;
    }

    // Populate the signoff profile and respective signoff data and add it to respective providers
    var signoffData = populateProfilesAndSignoffData( data );

    const taskErrors = _.clone( data.taskErrors );
    const isWarning = selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValue && selectedObject.props.fnd0TaskExecutionStatus.dbValue === 3 ||
    selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValues && selectedObject.props.fnd0TaskExecutionStatus.dbValues[0] === '3';
    if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValue ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValue;
    } else if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValues[0] ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValues[0];
    } else {
        taskErrors.uiValue = '';
    }

    if( fields ) {
        _.forEach( fieldProps, function( fieldProp ) {
            if( quorumObject[fieldProp].dbValue || fieldProp === 'quorumOptions' ) {
                fields[fieldProp].update( quorumObject[fieldProp].dbValue, {}, { markModified: true } );
            } else {
                fields[fieldProp].update( quorumObject[fieldProp].dbValue, {}, { markModified: false } );
            }
        } );
    }

    return {
        selectedObject : selectedObject,
        taskName : newTaskName,
        description : description,
        workflowDescription : workflowDescription,
        comments: commentsProp,
        password: passwordProp,
        waitForReviewers : waitForReviewers,
        isSecureTask: isSecureTask,
        reviewProfileSignoffs : signoffData.reviewProfileSignoffs,
        reviewAdhocSignoffs : signoffData.reviewAdhocSignoffs,
        taskErrors: taskErrors,
        isWarning: isWarning
    };
};


/**
 * Get the properties that needs to be saved
 *
 * @param {object} data - the data Object
 *
 * @returns {Array} Object with properties to be saved
 */
export let getPropertiesToSave = function( data ) {
    if( !data ) {
        return [];
    }
    var waitForReviewerDBValue = data.waitForReviewers.dbValue;
    var waitForReviewer = '0';

    if( waitForReviewerDBValue ) {
        waitForReviewer = '1';
    }

    var selectedQuorum = data.quorumOptions.dbValue;
    var signoffQuorum = '-100%';

    if( selectedQuorum ) {
        var percentQuorumValue = data.percentQuorumValue.dbValue;
        if( percentQuorumValue ) {
            signoffQuorum = '-' + percentQuorumValue.toString();
        }
    } else {
        var numericQuorumValue = data.numericQuorumValue.dbValue;
        if( numericQuorumValue ) {
            signoffQuorum = numericQuorumValue.toString();
        }
    }

    return [ {
        name: 'wait_for_all_reviewers',
        values: [ waitForReviewer ]
    }, {
        name: 'task_result',
        values: [ 'Completed' ]
    }, {
        name: 'signoff_quorum',
        values: [ signoffQuorum ]
    } ];
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 *
 * @param {Object} messages - messages array
 * @param {Object} msgObj - message object
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the
 * correct errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response ) {
    return Awp0PerformTask.populateErrorMessageOnPerformAction( response );
};

/**
 *
 *
 * @param {object} input
 */
export let openSignoffProfileCellCommandPanel = function( input ) {
    const { commandContext } = input;
    const { dialogActionForSignoffCellCommand } = commandContext.context;
    const { subPanelContext } = input.data;
    const { data } = input;
    if( dialogActionForSignoffCellCommand ) {
        let options = {
            view : 'Awp0AddSignoff',
            parent : '.aw-layout-workareaMain',
            placement : 'right',
            width : 'STANDARD',
            height : 'FULL',
            push : false,
            isCloseVisible : false,
            isPinUnpinEnabled : true,
            subPanelContext : {
                originType : data.eventData.originType,
                profileObject :  data.eventData.selectedProfile,
                signoffAction : data.eventData.signoffAction,
                selectionModelMode : 'multiple',
                taskToPerform : subPanelContext.taskToPerform
            }
        };
        dialogActionForSignoffCellCommand.show( options );
    }
};

export default exports = {
    getActiveView,
    getComments,
    populatePanelData,
    getPropertiesToSave,
    processPartialErrors,
    populateErrorMessageOnPerformAction,
    openSignoffProfileCellCommandPanel
};
