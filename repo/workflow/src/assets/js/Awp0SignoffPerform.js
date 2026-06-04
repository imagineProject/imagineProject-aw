// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0SignoffPerform
 */
import cdm from 'soa/kernel/clientDataModel';
import commandsMapSvc from 'js/commandsMapService';
import viewModelObjectService from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import appCtxSvc from 'js/appCtxService';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import AwStateService from 'js/awStateService';
import dmSvc from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';

var exports = {};

/**
 * Get the comments that needs to be saved while performing the task
 *
 * @param {object} data - the data Object
 * @return {object} propertyNameValues - Property name value pair
 *
 */
export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Get the valid selection in case of PS task selected get the associated signfof object and return and if
 * signoff is not associated then return null from here
 *
 * @param {Object} selection Selected obejct from UI
 *
 * @returns {Object} Valid selected object from PS task
 */
var _getValidSelection = function( selection ) {
    var validSelObject = selection;
    if( commandsMapSvc.isInstanceOf( 'EPMPerformSignoffTask', validSelObject.modelType ) ) {
        var modelObject = Awp0PerformTask.getSignoffObject( validSelObject );
        if( modelObject ) {
            validSelObject = modelObject;
        }
    }

    return validSelObject;
};

/**
 * Populate the properties on the panel and decision labels that needs to be displayed.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {Object} Object that hold info for properties need to be shown on UI
 */
export let populatePanelData = function( data, selection, fields ) {
    // Get Signoff object from perform-signoff object
    let selectedObject = _getValidSelection( selection );

    // Get the signoff object that have the decision label configured if any
    const signoffObject = exports.getSignoffObject( selectedObject );
    var decisionSetLOVObj = null;
    if( signoffObject && signoffObject.props && signoffObject.props.fnd0DecisionSetLOV &&
        signoffObject.props.fnd0DecisionSetLOV.dbValues ) {
        decisionSetLOVObj = cdm.getObject( signoffObject.props.fnd0DecisionSetLOV.dbValues[ 0 ] );
    }

    if ( decisionSetLOVObj && decisionSetLOVObj.props.lov_values && decisionSetLOVObj.props.lov_values.dbValues && decisionSetLOVObj.props.lov_values.dbValues[ 0 ] ) {
        return _populatePanelDataInternal( data, selectedObject, fields );
    }

    var objectsToLoad = [];
    objectsToLoad.push( decisionSetLOVObj );
    var deferred = AwPromiseService.instance.defer();
    //preload the LOV labels
    dmSvc.getPropertiesUnchecked( objectsToLoad, [ 'lov_values', 'lov_value_descriptions' ] ).then( function() {
        var returnData = _populatePanelDataInternal( data, selectedObject, fields );
        return deferred.resolve( returnData );
    } );
    return deferred.promise;
};

var _populatePanelDataInternal = function( data, selectedObject, fields ) {
    const newDataTaskName = _.clone( data.taskName );
    newDataTaskName.dbValue = selectedObject.props.object_name.dbValues[ 0 ];
    newDataTaskName.uiValue = selectedObject.props.object_name.dbValues[ 0 ];

    const newDataDesc = awp0InboxUtils.populateDescription( data.description, selectedObject );

    const newDataWorkflowDesc = awp0InboxUtils.populateJobDescription( data.workflowDescription, selectedObject );

    const newDataDecision = _.clone( data.decision );
    newDataDecision.dbValue = selectedObject.props.decision.dbValues[ 0 ];
    newDataDecision.uiValue = selectedObject.props.decision.uiValues[ 0 ];

    const decisionIntValue = parseInt( selectedObject.props.decision.dbValues[ 0 ] );

    if ( fields ) {
        // Check the URL for the presense of the comments param - this is returned in the event of an SSO reauth, and should be used to populate the panel instead
        // of the current property value
        var params = AwStateService.instance.params;
        if ( data.isTCSSOEnabled && AwStateService.instance.params.reauthorize === 'true' ) {
            var commentsURIString = AwStateService.instance.params.comments;
            if ( commentsURIString ) {
                if ( Array.isArray( commentsURIString ) ) {
                    commentsURIString = commentsURIString[ commentsURIString.length - 1 ];
                }
                var decodedComments = decodeURIComponent( commentsURIString );
                fields.comments.update( decodedComments, { uiValue:decodedComments }, { markModified: true, runValidation: true } );
            } else {
                commentsURIString = '';
                fields.comments.update( decodedComments, { uiValue:decodedComments }, { markModified: true, runValidation: true } );
            }
        } else {
            fields.comments.update( selectedObject.props.comments.dbValues[ 0 ], { uiValue:selectedObject.props.comments.uiValues[ 0 ] }, { markModified: true, runValidation: true } );
        }
    }
    const taskObject = exports.getTaskObject( selectedObject );

    const isAcknowledge = isAcknowledgeTaskObject( selectedObject );

    const { approveText, rejectText, undoDecision } = populateDecisionLabels( selectedObject, data );

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

    return  {
        taskName: newDataTaskName,
        description: newDataDesc,
        workflowDescription: newDataWorkflowDesc,
        decision: newDataDecision,
        decisionIntValue: decisionIntValue,
        psTaskObject: taskObject,
        isAcknowledge: isAcknowledge,
        approveText: approveText,
        rejectText: rejectText,
        undoDecision: undoDecision,
        signoffObject: selectedObject,
        taskErrors: taskErrors,
        isWarning: isWarning
    };
};

export let initDigitalSignature = function( selectedObject ) {
    const taskObject = exports.getTaskObject( selectedObject );

    return Awp0PerformTask.initDigitalSignature( taskObject );
};

/**
 * Get the perform signoff task object based on the object for action needs to be performed.
 *
 * @param {object} selectedTask - Task Object
 * @return {object} taskObject - Perform signoff object
 *
 */
export let getTaskObject = function( selectedTask ) {
    var taskObject = null;
    if( commandsMapSvc
        .isInstanceOf( 'EPMPerformSignoffTask', selectedTask.modelType ) ) {
        taskObject = selectedTask;
    } else if( commandsMapSvc.isInstanceOf( 'Signoff', selectedTask.modelType ) ) {
        var modelObj = cdm.getObject( selectedTask.props.fnd0ParentTask.dbValues[ 0 ] );
        taskObject = viewModelObjectService.createViewModelObject( modelObj );
    }

    return taskObject;
};

/**
 * Check for signoff belongs to acknowledge task or not
 *
 * @param {Object} selectedTask Selected task object from UI
 * @return {Boolean} isAcknowledgeTask - True/False value
 *
 */
function isAcknowledgeTaskObject( selectedTask ) {
    var isAcknowledgeTask = false;

    var taskObject = exports.getTaskObject( selectedTask );
    if( taskObject ) {
        var modelObj = cdm.getObject( taskObject.props.parent_task.dbValue );
        var parentTaskObj = viewModelObjectService.createViewModelObject( modelObj );

        if( parentTaskObj ) {
            if( commandsMapSvc.isInstanceOf( 'EPMAcknowledgeTask', parentTaskObj.modelType ) ) {
                isAcknowledgeTask = true;
            } else if( commandsMapSvc.isInstanceOf( 'EPMReviewTask', parentTaskObj.modelType ) ) {
                isAcknowledgeTask = false;
            }
        }
    }
    return isAcknowledgeTask;
}

/**
 * Get the signoff object based on the object for action needs to be performed. Currently this method return
 * signoff as null for perform signoff task selection. This needs to be implemented
 *
 * @param {Object} selectedTask Selected task object from UI
 * @return {object} signOffObject - Signoff object
 *
 */
export let getSignoffObject = function( selectedTask ) {
    var signOffObject = null;
    if( commandsMapSvc.isInstanceOf( 'Signoff', selectedTask.modelType ) ) {
        signOffObject = selectedTask;
    } else if( commandsMapSvc.isInstanceOf( 'EPMPerformSignoffTask',
        selectedTask.modelType ) ) {
        signOffObject = null;
    }
    return signOffObject;
};


/**
 * This method will update the Approve or Acknowledge Text.
 * @param {Object} selectedObject Selected task object from UI
 * @param {Array} decisionLabels Decision label array
 * @param {String} acknowledgeText Acknowledge string
 * @param {String} approveText Approve string
 * @param {String} rejectText Reject string
 * @returns {Object} Object with button displayed string
 */
var updateApproveAcknowledgeAndRejectText = function( selectedObject, decisionLabels, acknowledgeText, approveText,
    rejectText ) {
    let approveTextValue = '';
    let rejectTextValue = '';

    if( decisionLabels.length <= 0 ) {
        if( isAcknowledgeTaskObject( selectedObject ) ) {
            approveTextValue = acknowledgeText;
        } else {
            approveTextValue = approveText;
        }
        rejectTextValue = rejectText;
    } else if( decisionLabels.length === 1 ) {
        approveTextValue = decisionLabels[ 0 ];
    } else if( decisionLabels.length === 2 ) {
        approveTextValue = decisionLabels[ 0 ];
        rejectTextValue = decisionLabels[ 1 ];
    }

    return {
        approveTextValue: approveTextValue,
        rejectTextValue: rejectTextValue
    };
};

/**
 * Populate the decision labels
 *
 * @param {Object} selectedObject Selected task object from UI
 * @param {object} data - the data Object
 * @returns {Object} Decision label object
 */
function populateDecisionLabels( selectedObject, data ) {
    let approveText = data.i18n.approve;
    let rejectText = data.i18n.reject;
    let acknowledgeText = data.i18n.acknowledge;
    const undoDecision = data.i18n.undoDecision;

    // Get the signoff object that have the decision label configured if any
    const signoffObject = exports.getSignoffObject( selectedObject );

    var decisionLabels = [];

    // Check for signoff object is not null and it has properties loaded that are needed
    if( signoffObject && signoffObject.props && signoffObject.props.fnd0DecisionSetLOV &&
        signoffObject.props.fnd0DecisionSetLOV.dbValues ) {
        var decisionSetLOVObj = cdm.getObject( signoffObject.props.fnd0DecisionSetLOV.dbValues[ 0 ] );
        if( decisionSetLOVObj ) {
            var lovValues = decisionSetLOVObj.props.lov_values.dbValues;
            var lovDescriptions = decisionSetLOVObj.props.lov_value_descriptions.uiValues;

            if( lovValues && lovDescriptions ) {
                var approveIdx = lovValues.indexOf( '89' );
                var rejectIdx = lovValues.indexOf( '78' );

                //Label for approve path
                decisionLabels.push( lovDescriptions[ approveIdx ] );

                //Label for reject path
                if( rejectIdx !== -1 ) {
                    decisionLabels.push( lovDescriptions[ rejectIdx ] );
                }
            }
        }
    }

    if( decisionLabels ) {
        const { approveTextValue, rejectTextValue } = updateApproveAcknowledgeAndRejectText( selectedObject, decisionLabels, acknowledgeText, approveText, rejectText );
        approveText = approveTextValue;
        rejectText = rejectTextValue;
    }

    return {
        approveText: approveText,
        rejectText: rejectText,
        undoDecision: undoDecision
    };
}

/**
 * Add that value to localization for confirm message to show correctly.
 *
 * @param {String} taskResult - Slected button from UI
 * @param {object} data - the data Object
 */
export let getSelectedPath = function( taskResult, data ) {
    data.i18n.selectedPath = taskResult;
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
 * Perform the task using digital signature service
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 */
export let performTaskDS = function( data, actionableObject, action, supportingValue, supportingObject ) {
    Awp0PerformTask.performTaskDS( data, actionableObject, action, supportingValue, supportingObject );
};

/**
 * Perform the task using perfromAction3 SOA
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 */
export let performTask = function( data, actionableObject, action, supportingValue, supportingObject ) {
    Awp0PerformTask.performTask( data, actionableObject, action, supportingValue, supportingObject );
};

export default exports = {
    getComments,
    populatePanelData,
    getTaskObject,
    getSignoffObject,
    getSelectedPath,
    populateErrorMessageOnPerformAction,
    performTaskDS,
    performTask,
    initDigitalSignature
};
