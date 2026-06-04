// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0EPMConditionTaskPerform
 */
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';
import listBoxService from 'js/listBoxService';
import viewModelObjectService from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';

var exports = {};

export let populatePanelData = function( data, selection, fields ) {
    let selectedObject = selection;

    // Check if input selected object is null then return from here
    if( !selectedObject ) {
        return;
    }
    selectedObject = cdm.getObject( selectedObject.uid );
    if( selectedObject && !viewModelObjectService.isViewModelObject( selectedObject ) ) {
        selectedObject = viewModelObjectService.createViewModelObject( selectedObject );
    }

    // This method is needed to set the correct style for panel when it will be visible in secondary area
    Awp0PerformTask.updateStyleForSecondaryPanel();

    // Populate the name value
    const newDataTaskName = _.clone( data.taskName );
    let nameValue = selectedObject.props.object_string.dbValues[0];

    newDataTaskName.dbValue = nameValue;
    newDataTaskName.uiValue = nameValue;

    // Populate the description value
    const newDataDesc = awp0InboxUtils.populateDescription( data.description, selectedObject );

    // Populate the comments value
    if ( fields ) {
        // Check the URL for the presense of the comments param - this is returned in the event of an SSO reauth, and should be used to populate the panel instead
        // of the current property value
        var decodedComments = '';
        if ( data.isTCSSOEnabled && AwStateService.instance.params.reauthorize === 'true' ) {
            var commentsURIString = AwStateService.instance.params.comments;
            if ( commentsURIString ) {
                if ( Array.isArray( commentsURIString ) ) {
                    commentsURIString = commentsURIString[ commentsURIString.length - 1 ];
                }
                decodedComments = decodeURIComponent( commentsURIString );
                fields.comments.update( decodedComments, { uiValue:decodedComments }, { markModified: true, runValidation: true } );
            } else {
                commentsURIString = '';
                decodedComments = decodeURIComponent( commentsURIString );
                fields.comments.update( decodedComments, { uiValue:decodedComments }, { markModified: true, runValidation: true } );
            }
        } else {
            fields.comments.update( selectedObject.props.comments.dbValue, { uiValue:selectedObject.props.comments.uiValue }, { markModified: true, runValidation: true } );
        }
    }

    // Populate the job description value
    const newDataJobDescription = awp0InboxUtils.populateJobDescription( data.workflowDescription, selectedObject );

    var usingSSO = false;
    if ( data.isTCSSOEnabled && data.isTCSSOEnabled === true ) {
        usingSSO = true;
    }

    // Populate the isSecureTask value
    const newDataIsSecureTask = _.clone( data.isSecureTask );
    let secureTaskValue = selectedObject.props.secure_task.dbValues[ 0 ];
    if( secureTaskValue === '1' && !usingSSO ) {
        newDataIsSecureTask.dbValue = true;
    } else {
        newDataIsSecureTask.dbValue = false;
    }

    // Populate the hasFailurePaths value
    const newDataHasFailurePaths = _.clone( data.hasFailurePaths );
    let hasFailurePathsValue = selectedObject.props.has_failure_paths.dbValues[ 0 ];
    if( hasFailurePathsValue === '1' ) {
        newDataHasFailurePaths.dbValue = true;
    } else {
        newDataHasFailurePaths.dbValue = false;
    }

    const taskErrors = _.clone( data.taskErrors );
    const isWarning = selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValue && selectedObject.props.fnd0TaskExecutionStatus.dbValue === 3 ||
    selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValues && selectedObject.props.fnd0TaskExecutionStatus.dbValues[0] === 3;
    if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValue ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValue;
    } else if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValues[0] ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValues[0];
    } else {
        taskErrors.uiValue = '';
    }

    return {
        taskName: newDataTaskName,
        description: newDataDesc,
        workflowDescription: newDataJobDescription,
        isSecureTask: newDataIsSecureTask,
        hasFailurePaths: newDataHasFailurePaths,
        selectedObject: selectedObject,
        taskErrors: taskErrors,
        isWarning: isWarning
    };
};

export let initTaskResultLOV = function( data, selection ) {
    let selectedObject = selection;

    // Check if input selected object is null then return from here
    if( !selectedObject ) {
        return;
    }

    var modelObj = cdm.getObject( selectedObject.props.task_template.dbValues[ 0 ] );
    var taskTemplate = viewModelObjectService.createViewModelObject( modelObj );

    // Get the custom condition paths by calling the SOA
    var request = {
        taskTemplates: [ taskTemplate ]
    };

    return soaService.post( 'Internal-AWS2-2012-10-Workflow', 'getTaskResults', request ).then( function( response ) {
        const newTaskResults = getConditionPaths( response, data );
        const newTaskPathProp = { ...data.taskResult };
        // Update the task path LOV with default 0th value and return that updated property
        // so that it be rendered on UI.
        if( newTaskResults && !_.isEmpty( newTaskResults ) &&  newTaskResults[ 0 ] ) {
            // newTaskPathProp.dbValue = newTaskResults[ 0 ].propInternalValue;
            // newTaskPathProp.uiValue =newTaskResults[ 0 ].propDisplayValue;
        }
        return {
            taskResults: newTaskResults,
            taskResult : newTaskPathProp
        };
    } );
};


/**
 * Get the custom condition paths and populate on the data object so it can be rendered. This method will localize
 * the true and false path to localize value and other paths will be displayed as defined in the template
 *
 * @param {object} response - the soa response
 * @param {object} data - the data object
 *
 * @returns {Object} Condition path values
 */
function getConditionPaths( response, data ) {
    var paths = response.output[ 0 ].taskResults;
    var displayPaths = [];

    if( paths ) {
        _.forEach( paths, function( pathValue ) {
            if( pathValue.toUpperCase() === 'TRUE' ) {
                displayPaths.push( data.i18n.trueText );
            } else if( pathValue.toUpperCase() === 'FALSE' ) {
                displayPaths.push( data.i18n.falseText );
            } else {
                displayPaths.push( pathValue );
            }
        } );
    }

    return listBoxService.createListModelObjectsFromStrings( displayPaths );
}

/**
 * Get the comments that needs to be saved
 *
 * @param {object} data - the data object
 * @return {Object} propertyNameValues - Property name value pair array that contains the comment property
 */
export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Get the task result value. If user selected the true / false path then return the non-locale value otherwise use
 * the input value as return value
 *
 * @param {obejct} taskResult - the selected task result
 * @param {object} data - the data object
 * @return {String} taskResultValue - Task result value
 */
export let getTaskResultValue = function( taskResult, data ) {
    var taskResultValue;
    if( !taskResult || taskResult === '' ) {
        return taskResultValue;
    }
    var validTaskResult = taskResult;

    // Compare for true or false path value so that true and false (correct value) can be pass to server
    if( validTaskResult === data.i18n.trueText ) {
        taskResultValue = 'true';
    } else if( validTaskResult === data.i18n.falseText ) {
        taskResultValue = 'false';
    } else {
        taskResultValue = validTaskResult;
    }
    data.i18n.taskResultValue = validTaskResult;
    return taskResultValue;
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
 * Perform the task using performAction3 SOA call
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

/**
 * Check input error code is to be ignore or not
 *
 * @param {object} errCode - the error code that needs to be check
 * @return {boolean} - True if error code needs to be ignored else false
 */
var _isIgnoreErrorCode = function( errCode ) {
    if( errCode === 33321 ) {
        return true;
    }
    if( errCode === 33086 || errCode === 33083 || errCode === 33084 || errCode === 33085 ) {
        return true;
    }
    return false;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response ) {
    var err = null;
    var message = '';

    // Check if input response is not null and contains partial errors then only
    // create the error object
    if( response && ( response.partialErrors || response.PartialErrors ) ) {
        err = soaService.createError( response );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if( err && err.cause && err.cause.partialErrors ) {
        _.forEach( err.cause.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code && !_isIgnoreErrorCode( errVal.code ) ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message + '\n';
                        }
                    }
                } );
            }
        } );
    }

    return message;
};

/**
 * Update the context info with select task result so that it can be used to complete the task.
 *
 * @param {Object} subPanelContext Sub panel context object where selected path need to set.
 * @param {Object} selectedPath  Selected task result object which user clicked.
 */
export let updateConditionPathResult = function( subPanelContext, selectedPath ) {
    if( subPanelContext && selectedPath ) {
        var localContext = { ...subPanelContext.value };
        localContext.selectedPath = selectedPath;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
 * Reset the selected path value to null if some value is set then reset to null value.
 *
 * @param {Object} conditionTaskResult Condition task result object where selected path will be set.
 * @returns {Object} Updated condition task result object.
 */
export let resetTaskResults = function( conditionTaskResult ) {
    const taskResultContext = { ...conditionTaskResult };
    // Reset the value to null if some value is set
    if( taskResultContext && taskResultContext.selectedPath ) {
        taskResultContext.selectedPath = null;
    }
    return taskResultContext;
};

export default exports = {
    populatePanelData,
    getComments,
    getTaskResultValue,
    performTaskDS,
    performTask,
    initTaskResultLOV,
    updateConditionPathResult,
    resetTaskResults,
    populateErrorMessageOnPerformAction
};
