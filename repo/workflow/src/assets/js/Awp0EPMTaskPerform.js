// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0EPMTaskPerform
 */
import viewModelObjSvc from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import appCtxSvc from 'js/appCtxService';
import uwPropertySvc from 'js/uwPropertyService';
import AwStateService from 'js/awStateService';
import _dataManagementSvc from 'soa/dataManagementService';

import _ from 'lodash';

var exports = {};

export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {Object} Object with properties needs to be updated on UI
 */
export let populatePanelData = function( data, selection, fields ) {
    let selectedObject = selection;

    // Check if input selected object is null then return from here
    if( !selection ) {
        return;
    }
    selectedObject = cdm.getObject( selectedObject.uid );
    if( selectedObject && !viewModelObjSvc.isViewModelObject( selectedObject ) ) {
        selectedObject = viewModelObjSvc.createViewModelObject( selectedObject );
    }

    // This method is needed to set the correct style for panel when it will be visible in secondary area
    Awp0PerformTask.updateStyleForSecondaryPanel();

    let formObjectVMO;
    if( typeof selectedObject.props.fnd0PerformForm !== typeof undefined &&
        typeof selectedObject.props.fnd0PerformForm.dbValues !== typeof undefined &&
        selectedObject.props.fnd0PerformForm.dbValues[ 0 ] !== '' ) {
        const fromTaskValue = selectedObject.props.fnd0PerformForm.dbValues[ 0 ];

        if( typeof fromTaskValue !== typeof undefined ) {
            const formObject = cdm.getObject( fromTaskValue );
            if( formObject ) {
                formObjectVMO = viewModelObjSvc.createViewModelObject( formObject );
            }
        }
    }

    // Populate the name value
    const newDataTaskName = _.clone( data.taskName );
    let nameValue = '';
    nameValue = selectedObject.props.object_string.dbValues[ 0 ];

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
    const isSecureTask =   selectedObject.props.secure_task.dbValues[ 0 ] === '1' && !usingSSO;

    if( fields ) {
        fields.password.update( fields.password.value, { isRequired: isSecureTask } );
    }

    // Populate the hasFailurePaths value
    const hasFailurePaths = selectedObject.props.has_failure_paths.dbValues[ 0 ] === '1';

    const taskErrors = _.clone( data.taskErrors );
    const isWarning = selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValue && selectedObject.props.fnd0TaskExecutionStatus.dbValue === 3 ||
    selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValues && selectedObject.props.fnd0TaskExecutionStatus.dbValues[0] === 3;
    if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValue ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValue;
        if( fields ) {
            fields.taskErrors.update( fields.taskErrors.value, { isRequired: true } );
        }
    } else if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValues[0] ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValues[0];
        if( fields ) {
            fields.taskErrors.update( fields.taskErrors.value, { isRequired: true } );
        }
    } else {
        taskErrors.uiValue = '';
        if( fields ) {
            fields.taskErrors.update( fields.taskErrors.value, { isRequired: false } );
        }
    }

    return {
        taskName: newDataTaskName,
        description: newDataDesc,
        workflowDescription: newDataJobDescription,
        isSecureTask: isSecureTask,
        hasFailurePaths: hasFailurePaths,
        formObject: formObjectVMO,
        taskErrors: taskErrors,
        isWarning: isWarning
    };
};

/**
 * Add that value to localization for confirm message to show correctly.
 *
 * @param {String} taskResult - Slected button from UI
 * @param {object} data - the data Object
 *
 * @returns {String} Task result string
 */
export let getSelectedPath = function( taskResult, data ) {
    data.i18n.selectedPath = taskResult;
    return taskResult;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response ) {
    return Awp0PerformTask.populateErrorMessageOnPerformAction( response );
};

/**
 * Return the properties that are modified from UI and return those properties.
 *
 * @returns {Array} Proeprties that needs to be saved
 */
export let getPropertiesToSave = function( editHandler ) {
    let modifiedProperties = [];
    if( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'SAVEAS_PANEL_CONTEXT' );
    }
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            const viewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( viewModelProperties, function( vmProp ) {
                if( uwPropertySvc.isModified( vmProp ) ) {
                    modifiedProperties.push( {
                        name: vmProp.propertyName,
                        values: uwPropertySvc.getValueStrings( vmProp )
                    } );
                }
            } );
        }
    }

    return modifiedProperties;
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

export default exports = {
    getComments,
    populatePanelData,
    getSelectedPath,
    populateErrorMessageOnPerformAction,
    getPropertiesToSave,
    processPartialErrors
};
