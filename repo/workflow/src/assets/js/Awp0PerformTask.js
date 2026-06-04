// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0PerformTask
 */
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import soaSvc from 'soa/kernel/soaService';
import contributionService from 'js/contribution.service';
import appCtxSvc from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';
import narrowModeService from 'js/aw.narrowMode.service';
import policySvc from 'soa/kernel/propertyPolicyService';
import editHandlerService from 'js/editHandlerService';
import localeSvc from 'js/localeService';
import performPanelService from 'js/Awp0PerformTaskPanelService';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import dataManagementService from 'soa/dataManagementService';
import commandPanelService from 'js/commandPanel.service';
import adapterSvc from 'js/adapterService';
import ssoAuthenticator from 'js/ssoAuthenticator';
import tcAuthenticator from'js/tcAuthenticator';
import browserUtils from 'js/browserUtils';
import $ from 'jquery';

var _awDigitalSignatureService = null;

var _performProps = null;

var isPanelRefreshNeeded = false;
/**
 * Define public API
 */
var exports = {};

/**
 * Get the digital signature service if installed
 *
 * @returns {Promise} Promise object
 */
export let getDigitalSignatureService = function() {
    var deferred = AwPromiseService.instance.defer();
    //Get all of the command providers
    contributionService.loadContributions( 'digitalSignatureService' ).then( function( providers ) {
        if ( providers && providers[0] ) {
            providers[0].getDigitalSignatureService().then( function( depModuleObjIn ) {
                _awDigitalSignatureService = depModuleObjIn;
                return deferred.resolve( _awDigitalSignatureService );
            } );
        } else {
            _awDigitalSignatureService = null;
            deferred.resolve( null );
        }
    } );

    return deferred.promise;
};

/**
 * Populate Task description
 *
 * @param {object} data - the data Object
 * @param {object} selectedObject - the current selection object
 *
 * @returns {String} Description value
 *
 */
export let populateDescription = function( data, selectedObject ) {
    return awp0InboxUtils.populateDescription( data, selectedObject );
};

export let getComments = function( data ) {
    var propertyNameValues = {};

    // Check if comment proeprty value is not null then only add it
    // to property name value. It will end when user enter comment as empty string
    // or any value
    if ( data.comments && data.comments.dbValue !== null ) {
        propertyNameValues.comments = [ data.comments.dbValue ];
    }
    return propertyNameValues;
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
var _performTaskDSInternal = function( data, actionableObject, action, supportingValue, supportingObject ) {
    data.inputData = {};
    data.inputData.actionableObject = actionableObject;
    data.inputData.action = action;
    data.inputData.password = data.password.dbValue;
    data.inputData.supportingValue = supportingValue;
    data.inputData.supportingObject = supportingObject;
    data.inputData.propertyNameValues = exports.getComments( data );
    data.inputData.comments = data.comments.dbValue;
    if ( _awDigitalSignatureService ) {
        _awDigitalSignatureService.performActionWithSignature( data ).then( function( response ) {
            // Process the SOA response
            _performTaskInternalProcessResponse( response, data, false );
        },
        function( error ) {
            messagingService.showError( error );
        } );
    }
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
    if ( data.isTCSSOEnabled && _isSecureTask( actionableObject ) ) {
        reauthenticate( actionableObject, action, supportingValue, supportingObject, data, 'ds' );
    } else {
        exports.isEditInProgress().then( function() {
            _performTaskDSInternal( data, actionableObject, action, supportingValue, supportingObject );
        } );
    }
};

/**
 * To check if current location is inbox location or not and based on that return true or false
 *
 * @returns {boolean} True/False
 */
var _isInboxLocation = function() {
    var locationContext = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:Location' );

    if ( locationContext && locationContext === 'com.siemens.splm.client.inbox.tasksLocation' ) {
        return true;
    }
    return false;
};

/**
 *
 * @param {Object} response Response object
 */
var _refreshWorkArea = function( response ) {
    var updatedObjectsUids = [];
    if ( response && response.updated ) {
        _.forEach( response.updated, function( uid ) {
            updatedObjectsUids.push( uid );
        } );
    }

    if ( appCtxSvc.ctx.pselected ) {
        updatedObjectsUids.push( appCtxSvc.ctx.pselected.uid );
    } else {
        updatedObjectsUids.push( appCtxSvc.ctx.selected.uid );
    }

    if ( appCtxSvc.ctx.task_to_perform && appCtxSvc.ctx.task_to_perform.task && appCtxSvc.ctx.task_to_perform.task[0] ) {
        updatedObjectsUids.push( appCtxSvc.ctx.task_to_perform.task[0].uid );
    }

    // Remove duplicate entries.
    updatedObjectsUids = _.uniq( updatedObjectsUids );

    if ( updatedObjectsUids && updatedObjectsUids.length > 0 ) {
        var modelObjects = [];
        _.forEach( updatedObjectsUids, function( uid ) {
            var modelObject = cdmService.getObject( uid );
            if ( modelObject ) {
                modelObjects.push( modelObject );
            }
        } );
        //if there is no upcoming task to replace the task currently in the perform panel, then a refresh is not needed
        var subsequentPerformableTask = checkForSubsequentPerformableTask( modelObjects );
        if ( modelObjects.length > 0 ) {
            if( subsequentPerformableTask ) {
                eventBus.publish( 'cdm.relatedModified', {
                    refreshLocationFlag: true,
                    relatedModified: modelObjects,
                    subsequentTask: true
                } );
            } else {
                eventBus.publish( 'cdm.relatedModified', {
                    refreshLocationFlag: true,
                    relatedModified: modelObjects,
                    subsequentTask: false
                } );
            }
        }
    }
};

export let checkForSubsequentPerformableTask = function( modelObjects ) {
    for ( var i = 0; i <= modelObjects.length - 1; i++ ) {
        if ( modelObjects[i].modelType && modelObjects[i].modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 &&
        modelObjects[i].props.awp0PerformableByMeBehavior && modelObjects[i].props.awp0PerformableByMeBehavior.dbValues[0] ) {
            var stringValue = modelObjects[i].props.awp0PerformableByMeBehavior.dbValues[0];
            if ( stringValue === '1' ) {
                return true;
            }
        }
    }
    return false;
};

/**
 * This function will check if the user is in start edit mode.
 *
 * @returns {Promise} Promise object
 */
export let isEditInProgress = function() {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'InboxMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    editHandlerService.isDirty().then( function( editContext ) {
        if ( editContext && editContext.isDirty ) {
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: localTextBundle.save,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.saveEdits().then( function() {
                        deferred.resolve();
                        //In the event of an error saving edits
                    }, function() {
                        deferred.resolve();
                    } );
                }
            },
            {
                addClass: 'btn btn-notify',
                text: localTextBundle.discard,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.cancelEdits();
                    deferred.resolve();
                }
            }
            ];
            messagingService.showWarning( localTextBundle.navigationConfirmation, buttons );
        } else {
            deferred.resolve();
        }
    } );

    return deferred.promise;
};

/**
 * Register properties that needed for perform panel
 */
export let registerPerformPanelProps = function() {
    var policy = {
        types: [ {
            name: 'EPMTask',
            properties: [ {
                name: 'fnd0ObjectsToDigitallySign',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0IsPKIAuthRequired',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0RequireCompleteConfirm'
            },
            {
                name: 'lsd'
            }
            ]

        },
        {
            name: 'Signoff',
            properties: [ {
                name: 'fnd0RequireCompleteConfirm'
            },
            {
                name: 'fnd0ParentTask'
            },
            {
                name: 'fnd0TaskExecutionStatus'
            },
            {
                name: 'fnd0TaskExecutionErrors'
            }
            ]
        },
        {
            name: 'TaskInbox',
            properties: [ {
                name: 'contents'
            } ]
        }
        ]
    };
    _performProps = policySvc.register( policy );
};

/**
 * Unregister properties taht were being used for perform panel
 */
export let unregisterPerformPanelProp = function() {
    if ( _performProps !== null ) {
        policySvc.unregister( _performProps );
        _performProps = null;
    }
};

/**
 * Refresh sublocation after perform action
 *
 * @param {object} response - the SOA response Object
 * @param {object} data - viewModel data
 */
var _refreshSubLocationAfterPerform = function( response, data ) {
    // In case of task completed successfully then fire the events to close the panel and
    // refresh the primary work area.
    if( response.dialogAction && data.subPanelContext.popupOptions || data && data.subPanelContext.dialogAction && data.subPanelContext.popupOptions ) {
        eventBus.publish( 'closeDialog' );
    }else{
        eventBus.publish( 'complete', {
            source: 'toolAndInfoPanel'
        } );
    }

    if ( _isInboxLocation() ) {
        eventBus.publish( 'primaryWorkarea.reset', {} );

        // Check if we ar ein narrow mode then only fire this event
        if ( narrowModeService.isNarrowMode() ) {
            eventBus.publish( 'narrowSummaryLocationTitleClickEvent', {} );
        }
    } else {
        _refreshWorkArea( response );
    }
};

/**
 * Process the SOA response and based on that show the error to user and refresh the location.
 *
 * @param {Object} response SOA response object
 * @param {Obejct} data Data view model object
 */
var _performTaskInternalProcessResponse = function( response, data, actionableObject, refreshAfterSSOReauth ) {
    // Get the error message string in case error thrown from server
    var errorMessageData = exports.populateErrorMessageOnPerformAction( response, data );
    if ( errorMessageData.displayMessage && errorMessageData.errorMessage && errorMessageData.errorMessage.length > 0 ) {
        data.errorMessage = errorMessageData.errorMessage;

        if ( errorMessageData.isSubSequentTaskFailError ) {
            var errorMessageFromResponse = _.trim( data.errorMessage, '</br>' );
            messagingService.showError( errorMessageFromResponse );
        } else if ( errorMessageData.errorLevel === 2 ) {
            messagingService.showWarning( errorMessageData.errorMessage );
        } else if ( errorMessageData.errorLevel === 1 ) {
            messagingService.showInfo( errorMessageData.errorMessage );
        } else {
            messagingService.reportNotyMessage( data, data._internal.messages, 'displayError' );
        }


        if ( data.atomicDataRef && data.atomicDataRef.conditionTaskResult ) {
            var newConditionTaskResult = data.atomicDataRef.conditionTaskResult.getAtomicData();
            if ( newConditionTaskResult ) {
                newConditionTaskResult.selectedPath = '';
                data.atomicDataRef.conditionTaskResult.setAtomicData( newConditionTaskResult );
            }
        }
        // In case of task completed with some error but sub locaiton needs to refresh then fire the events to close the panel and
        // refresh the primary work area.
        // If we are in the showObject location, navigate to the inbox
        if ( errorMessageData.resetSubLocation && !refreshAfterSSOReauth ) {
            _refreshSubLocationAfterPerform( response, data );
        }

        // This is needed where we have 2 consecutive handler failures occurs on a same task. In that case we want to refresh the panel
        // and show the new error message in the UI
        if ( errorMessageData.isConsecutiveHandlerFailError === true ) {
            isPanelRefreshNeeded = true;
            isPerformPanelUpdateNeeded( data, data.subPanelContext.selection[0], response.updated );
        } else {
            isPanelRefreshNeeded = false;
        }
    } else {
        // In case of task completed successfully then fire the events to close the panel and
        // refresh the primary work area. To go to inbox changes added for story
        // LCS-247044 - Navigate users to inbox following task signoff (ER#3058178). So we are going only
        // to inbox from show object location when user opened the task or signoff itself. For target it will
        // not go to inbox and refresh here itself.

        // Clear the condition task result
        if ( data.atomicDataRef && data.atomicDataRef.conditionTaskResult ) {
            var newConditionTaskResult = data.atomicDataRef.conditionTaskResult.getAtomicData();
            if ( newConditionTaskResult ) {
                newConditionTaskResult.selectedPath = '';
                data.atomicDataRef.conditionTaskResult.setAtomicData( newConditionTaskResult );
            }
        }

        if ( appCtxSvc.ctx && appCtxSvc.ctx.locationContext['ActiveWorkspace:Location'] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' &&
            appCtxSvc.ctx.xrtSummaryContextObject && ( appCtxSvc.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
                appCtxSvc.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) ) {
            exports.navigateToInbox();
        } else {
            if( data.subPanelContext.dialogAction ) {
                response.dialogAction = data.subPanelContext.dialogAction;
            }
            _refreshSubLocationAfterPerform( response, data );
        }
    }
};

/**
 * Perform the task using performAction3 SOA service
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 * @returns {Promise} Promise object
 */
var _performTaskInternal = function( data, actionableObject, action, supportingValue, supportingObject ) {
    var deferred = AwPromiseService.instance.defer();
    data.inputData = {};
    data.inputData.actionableObject = actionableObject;
    data.inputData.action = action;
    if ( data.password ) {
        data.inputData.password = data.password.dbValue;
    } else {
        data.inputData.password = '';
    }
    data.inputData.supportingValue = supportingValue;
    data.inputData.supportingObject = supportingObject;
    data.inputData.propertyNameValues = exports.getComments( data );
    if( actionableObject.props.fnd0TaskExecutionErrors && !_.isEmpty( actionableObject.props.fnd0TaskExecutionErrors.dbValues[ 0 ] ) ) {
        data.previousErrorMessage = actionableObject.props.fnd0TaskExecutionErrors.dbValues[ 0 ];
    }

    // Create the input structure
    var inputData = {
        input: [ {
            actionableObject: actionableObject,
            action: action,
            password: data.inputData.password,
            supportingValue: supportingValue,
            supportingObject: supportingObject,
            propertyNameValues: exports.getComments( data )
        } ]
    };

    var policy = {
        types: [ {
            name: 'EPMTask',
            properties: [ {
                name: 'awp0PerformableByMeBehavior'
            },
            {
                name: 'root_target_attachments'
            } ]
        }, {
            name: 'Signoff',
            properties: [ {
                name: 'awp0PerformableByMeBehavior'
            },
            {
                name: 'fnd0DecisionSetLOV',
                modifiers:
                    [
                        {
                            name: 'withProperties',
                            Value: 'true'
                        }
                    ]
            },
            {
                name: 'root_target_attachments'
            } ]

        },
        {
            name: 'ListOfValuesInteger',
            properties:
                [
                    {
                        name: 'lov_values'
                    },
                    {
                        name: 'lov_value_descriptions'
                    }
                ]
        } ]
    };
    var policyId = policySvc.register( policy );

    // Call the SOA to complete the task
    soaSvc.postUnchecked( 'Workflow-2014-06-Workflow', 'performAction3', inputData ).then(
        function( response ) {
            if ( policyId ) {
                policySvc.unregister( policyId );
            }
            deferred.resolve( response );
        },
        function( error ) {
            if ( policyId ) {
                policySvc.unregister( policyId );
            }
            deferred.reject( error );
        } );
    return deferred.promise;
};

/*
 * Navigate to inbox
 *
 * @function navigateToInbox
 */
export let navigateToInbox = function() {
    var showObject = 'myTasks';
    var toParams = {};
    var options = {};
    AwStateService.instance.go( showObject, toParams, options );
};

/**
 * Perform the task using performAction3 SOA service
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 */
export let performTask = function( data, actionableObject, action, supportingValue, supportingObject ) {
    if ( actionableObject && actionableObject.uid ) {
        var object = cdmService.getObject( actionableObject.uid );
        _updateEditPropLSD( object );
    }
    if ( data.isTCSSOEnabled && _isSecureTask( actionableObject ) ) {
        reauthenticate( actionableObject, action, supportingValue, supportingObject, data, 'true' );
    } else {
        exports.isEditInProgress().then( function() {
            _performTaskInternal( data, actionableObject, action, supportingValue, supportingObject ).then( function( response ) {
            // Process the SOA response
                _performTaskInternalProcessResponse( response, data, actionableObject, false );
            },
            function( error ) {
                messagingService.showError( error );
            } );
        } );
    }
};

var _updateEditPropLSD = function( modelObject ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    var lsd = _getPropValue( modelObject, 'lsd' );

    // Get the LSD for object
    if ( modelObject && modelObject.props && modelObject.props.lsd && modelObject.props.lsd.dbValues
        && modelObject.props.lsd.dbValues[0] ) {
        lsd = modelObject.props.lsd.dbValues[0];
    }
    if ( activeEditHandler ) {
        // Get the active edit handler and if not null then only get the lsd property for object if not loaded
        // already and then get all modified or editable properties and those are not null then modify the LSD.
        dataManagementService.getProperties( [ modelObject.uid ], [ 'lsd' ] ).then( function() {
            var latestObject = cdmService.getObject( modelObject.uid );
            lsd = _getPropValue( latestObject, 'lsd' );
            if ( activeEditHandler && lsd ) {
                var dataSource = activeEditHandler ? activeEditHandler.getDataSource() : null;
                if ( dataSource ) {
                    var modifyPropVMo = dataSource.getAllModifiedPropertiesWithVMO();
                    var isMatchFound = false;
                    if ( modifyPropVMo && modifyPropVMo.length > 0 ) {
                        for ( var idx = 0; idx < modifyPropVMo.length; idx++ ) {
                            var vmoObject = modifyPropVMo[idx];
                            if ( vmoObject && latestObject && vmoObject.uid === latestObject.uid && vmoObject.viewModelProps ) {
                                isMatchFound = true;
                                _.forEach( vmoObject.viewModelProps, function( prop ) {
                                    prop.sourceObjectLastSavedDate = lsd;
                                } );
                            }
                        }
                    }
                    // Editing the table properties through start edit and then change the view mode to list
                    // that it shows save/discard message and clicking on that it will save the properties
                    if ( !isMatchFound ) {
                        var _modProps = dataSource.getAllEditableProperties();
                        if ( _modProps && _modProps.length > 0 ) {
                            _.forEach( _modProps, function( prop ) {
                                prop.sourceObjectLastSavedDate = lsd;
                            } );
                        }
                    }
                }
            }
        } );
    }
};

var _isSecureTask = function( actionableObject ) {
    if ( actionableObject && actionableObject.props && actionableObject.props.secure_task && actionableObject.props.secure_task.dbValues[0] ) {
        return actionableObject.props.secure_task.dbValues[0] === '1';
    }
};

/**
 * Get the current task state and return.
 *
 * @param {object} data - the data Object
 *
 * @return {Object} taskState - Task state value
 *
 */
var _getCurrentTaskState = function( data ) {
    var taskState;
    var actualTask;
    if ( data && data.inputData && data.inputData.actionableObject && data.inputData.actionableObject.uid ) {
        actualTask = cdmService.getObject( data.inputData.actionableObject.uid );
    }
    if ( actualTask && actualTask.props && actualTask.props.state && actualTask.props.state.dbValues
        && actualTask.props.state.dbValues[0] ) {
        taskState = parseInt( actualTask.props.state.dbValues[0] );
    } else if ( actualTask && actualTask.props && actualTask.props.real_state && actualTask.props.real_state.dbValues
        && actualTask.props.real_state.dbValues[0] ) {
        if ( actualTask.props.real_state.dbValues[0] === 'Completed' ) {
            taskState = 8;
        } else if( actualTask.props.real_state.dbValues[0] === 'Failed' ) {
            taskState = 16;
        }
    }
    return taskState;
};

/**
 * Get the current task state and return.
 *
 * @param {object} data - the data Object
 *
 * @return {Object} taskState - Task state value
 *
 */
var _getCurrentTaskPerformableByMe = function( data ) {
    var performState;
    var actualTask;
    if ( data && data.inputData && data.inputData.actionableObject && data.inputData.actionableObject.uid ) {
        actualTask = cdmService.getObject( data.inputData.actionableObject.uid );
    }
    if ( actualTask && actualTask.props && actualTask.props.awp0PerformableByMeBehavior && actualTask.props.awp0PerformableByMeBehavior.dbValues
        && actualTask.props.awp0PerformableByMeBehavior.dbValues[0] ) {
        performState = actualTask.props.awp0PerformableByMeBehavior.dbValues[0];
    }
    return performState;
};

/**
 * Check input error code is to be ignore or not
 *
 * @param {object} errCode - the error code that needs to be check
 * @param {Object} data Data view model object
 * @return {boolean} - True if error code needs to be ignored else false
 */
var _isIgnoreErrorCode = function( errCode, data ) {
    var taskState = _getCurrentTaskState( data );
    if ( errCode === 33321 && ( taskState === 8 || taskState === 16 ) ) {
        return true;
    }
    if ( errCode === 214000 || errCode === 33086 || errCode === 33083 || errCode === 33084 || errCode === 33085 ) {
        return true;
    }
    return false;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @param {Object} data Data view model object
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response, data ) {
    var err = null;
    var message = '';
    var displayMessage = true;
    var resetSubLocation = false;
    var isSubSequentTaskFailError = false;
    var isConsecutiveHandlerFailError = false;
    var errorLevel = 3;

    // Check if input response is not null and contains partial errors then only
    // create the error object
    if ( response && ( response.partialErrors || response.PartialErrors ) ) {
        err = soaSvc.createError( response );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if ( err && err.cause && err.cause.partialErrors ) {
        _.forEach( err.cause.partialErrors, function( partErr ) {
            var showSubsequentTaskError = false;
            if ( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    var errorCode = errVal.code;
                    if ( errorCode && errorCode === 33321 ) {
                        if ( _isIgnoreErrorCode( errorCode, data ) ) {
                            displayMessage = false;
                        } else {
                            displayMessage = true;
                        }
                    } else if ( errorCode && errorCode === 33086 ) {
                        displayMessage = false;
                        // Get the current task state and if task is not completed or skipped then show the message
                        // to user.
                        var taskState = _getCurrentTaskState( data );
                        if ( taskState !== 8 && taskState !== 16 ) {
                            displayMessage = true;
                        }
                        if ( appCtxSvc.ctx.preferences.WRKFLW_hide_subsequent_task_errors && appCtxSvc.ctx.preferences.WRKFLW_hide_subsequent_task_errors[0]
                            && appCtxSvc.ctx.preferences.WRKFLW_hide_subsequent_task_errors[0] === 'false' || showSubsequentTaskError ) {
                            displayMessage = true;
                            resetSubLocation = true;
                            isSubSequentTaskFailError = true;
                        }
                    } else if ( errorCode && !_isIgnoreErrorCode( errorCode, data ) ) {
                        errorLevel = errVal.level;
                        if ( message.length === 0 && errorLevel === 3 ) {
                            message += '</br>' + errVal.message;
                        } else {
                            message += errVal.message + '</br>';
                        }


                        // Check if error code is 33278 or 233057 that means decision can't be set
                        // as task is not in started state. So in that case refresh the sub location and
                        // clsoe the panel along with showing the error to user
                        if ( errorCode === 33278 || errorCode === 233057 ) {
                            resetSubLocation = true;
                        }
                        // Check if error code is 233084 that means we need to show subsequent task error notification
                        // even if WRKFLW_hide_subsequent_task_errors is true
                        if ( errorCode === 233084 ) {
                            showSubsequentTaskError = true;
                            displayMessage = true;
                            resetSubLocation = true;
                            isSubSequentTaskFailError = true;
                        }
                    }
                } );
            }
        } );
        //Reset the sublocation if the specified task is no longer performable by the user after the error
        if ( _getCurrentTaskPerformableByMe( data ) === '0' ) {
            resetSubLocation = true;
        }
        if ( message ) {
            var errorMessageFromResponse = _.trim( message, '</br>' );
            if ( data && data.previousErrorMessage && data.previousErrorMessage !== errorMessageFromResponse || data && !( 'previousErrorMessage' in data ) ) {
                isConsecutiveHandlerFailError = true;
            }
        }
    }
    return {
        errorMessage: message,
        displayMessage: displayMessage,
        resetSubLocation: resetSubLocation,
        isSubSequentTaskFailError: isSubSequentTaskFailError,
        isConsecutiveHandlerFailError: isConsecutiveHandlerFailError,
        errorLevel: errorLevel
    };
};

/**
 * Populate the peform panel in secondary work area based on validation like task can be perfomred by me or not
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {Object} Object that hold info like task can be completed or not
 */
export let populateSecondaryPanel = function( data, selection ) {
    if ( selection !== null ) {
        var modelObject = cdmService.getObject( selection.uid );
        var isEditInProgress = appCtxSvc.getCtx( 'editInProgress' );
        if ( !isEditInProgress ) {
            return exports.loadObjectProperties( data, modelObject ).then( function( { isTaskPerformable, taskToPerform, activePerformTaskPanelId } ) {
                return {
                    isTaskPerformable: isTaskPerformable,
                    taskToPerform: taskToPerform,
                    activePerformTaskPanelId: activePerformTaskPanelId
                };
            } );
        }

        return editHandlerService.leaveConfirmation().then( function() {
            return exports.loadObjectProperties( data, modelObject ).then( function( { isTaskPerformable, taskToPerform, activePerformTaskPanelId } ) {
                return {
                    isTaskPerformable: isTaskPerformable,
                    taskToPerform: taskToPerform,
                    activePerformTaskPanelId: activePerformTaskPanelId
                };
            } );
        } );
    }
};

export let setTCSSOEnabled = function() {
    let deferred = AwPromiseService.instance.defer();
    $.get( browserUtils.getBaseURL() + 'getSessionVars' ).done( function( ssoData, status ) {
        var ssoEnabled = false;
        if( status === 'success' && ssoData.tcSSOEnabled && ssoData.tcSSOEnabled === 'true' ) {
            ssoEnabled = true;
        }
        deferred.resolve( ssoEnabled );
    } );
    return deferred.promise;
};

/**
 * Get the valid selection if panel is already dispalyed then use that object for panel is displayed
 * else use input object.
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @return {object} validSelection - Valid object for panel need to dispaly or already displayed.
 */
var _getValidSelection = function( data, selection ) {
    var validSelection = selection;
    var context = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    if ( context ) {
        validSelection = context;
    }
    return validSelection;
};

var _isSurrogateSubLocation = function() {
    var isSurrogateSubLoc = false;
    var locationCtx = appCtxSvc.getCtx( 'locationContext' );
    if ( locationCtx && locationCtx['ActiveWorkspace:SubLocation'] === 'surrogateTasks' ) {
        //Check if sub location is surrogate then return true
        isSurrogateSubLoc = true;
    }
    return isSurrogateSubLoc;
};

/**
 * Populate the peform panel in secondary work area based on validation like task can be perfomred by me or not
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @param {object} updatedObjects - the updated objects array
 *
 * @returns {Object} Object that hold info like task can be completed or not
 */
export let isPerformPanelUpdateNeeded = function( data, selection, updatedObjects ) {
    if ( selection && updatedObjects && updatedObjects.length > 0 ) {
        var modelObject = null;
        var validSelection = _getValidSelection( data, selection );

        for ( var idx = 0; idx < updatedObjects.length; idx++ ) {
            if ( validSelection && updatedObjects[idx] && updatedObjects[idx].uid === validSelection.uid ) {
                modelObject = cdmService.getObject( validSelection.uid );
                break;
            }
        }

        if ( modelObject && modelObject.props.awp0PerformableByMeBehavior && modelObject.props.awp0PerformableByMeBehavior.dbValues && modelObject.props.awp0PerformableByMeBehavior.dbValues[0] ) {
            var performableByMe = modelObject.props.awp0PerformableByMeBehavior.dbValues[0];

            // Check if previous value and new value both are not same and action is not in progress then only call
            // further and additionaly checking in case of surrogate sub location only we need to call it as when user do stand in
            // or relase we don't refresh the whole primary work area and we need to update the complete task panel.
            // With this fix, when user tries to complete the task or reassign the task then it will not make unnecessary
            // getProperties() SOA call to load performableByMe property.
            if ( performableByMe !== data.awp0PerformableByMeBehavior && _isSurrogateSubLocation() || isPanelRefreshNeeded === true ) {
                isPanelRefreshNeeded = false;
                return exports.populateSecondaryPanel( data, modelObject );
            }
        }
    }
};

/**
 * This method to set the overflow style on main panel. Thsi is needed as we are using
 * aw-panel and it doesn't have correct overflwo style and due to that it overlap the + command
 * in case of SST and route task.
 */
export let updateStyleForSecondaryPanel = function() {
    var element = document.getElementById( 'Awp0PerformTask' );
    if ( element && element.style ) {
        element.style.overflow = 'hidden';
    }
};

/**
 * Get all user signoff on which decision is not made yet.
 *
 * @param {Array} allSignoffObjects All signoff array
 * @returns {Array} Return the structure that will contain group member signoff and resource pool signoff on which
 *          decision not done yet.
 */
var _processValidSignOffObject = function( allSignoffObjects ) {
    var groupMemberSignoffs = [];
    var rpSignoffs = [];
    if ( allSignoffObjects && allSignoffObjects.length > 0 ) {
        for ( var idx = 0; idx < allSignoffObjects.length; idx++ ) {
            var signoff = allSignoffObjects[idx];
            var decision = null;

            // Get the decsiion property value from signoff and check if decision property is not 0 then continue else
            // add the signoff to respecive list.
            if ( signoff.props.decision && signoff.props.decision.dbValues && signoff.props.decision.dbValues.length > 0 ) {
                decision = signoff.props.decision.dbValues[0];
            }

            if ( decision !== '0' ) {
                continue;
            }

            // Check if signoff is of type group member then add to group memebr list and if signoff is of type resource pool
            // then add to resource pool list
            if ( signoff.props.group_member && signoff.props.group_member.dbValues && signoff.props.group_member.dbValues[0] ) {
                var gmObject = {
                    signoff: signoff,
                    assignee: signoff.props.group_member.dbValues[0]
                };
                groupMemberSignoffs.push( gmObject );
            } else if ( signoff.props.resource_pool && signoff.props.resource_pool.dbValues && signoff.props.resource_pool.dbValues[0] ) {
                var rpObject = {
                    signoff: signoff,
                    assignee: signoff.props.resource_pool.dbValues[0]
                };

                rpSignoffs.push( rpObject );
            }
        }
    }

    return {
        gropuMemberSignoffs: groupMemberSignoffs,
        resourcepoolSignoffs: rpSignoffs
    };
};

/**
 * Get all user signoff on irrespective of decision.
 *
 * @param {*} allSignoffObjects All signoff array
 * @returns {Array} Return the structure that will contain group member signoff and resource pool signoff on which
 *          decision not done yet.
 */
var _processValidSignOffObjectAfterPerform = function( allSignoffObjects ) {
    var groupMemberSignoffs = [];
    var rpSignoffs = [];
    if ( allSignoffObjects && allSignoffObjects.length > 0 ) {
        for ( var idx = 0; idx < allSignoffObjects.length; idx++ ) {
            var signoff = allSignoffObjects[idx];

            // Check if signoff is of type group member then add to group memebr list and if signoff is of type resource pool
            // then add to resource pool list
            if ( signoff.props.group_member && signoff.props.group_member.dbValues && signoff.props.group_member.dbValues[0] ) {
                var gmObject = {
                    signoff: signoff,
                    assignee: signoff.props.group_member.dbValues[0]
                };
                groupMemberSignoffs.push( gmObject );
            } else if ( signoff.props.resource_pool && signoff.props.resource_pool.dbValues && signoff.props.resource_pool.dbValues[0] ) {
                var rpObject = {
                    signoff: signoff,
                    assignee: signoff.props.resource_pool.dbValues[0]
                };

                rpSignoffs.push( rpObject );
            }
        }
    }

    return {
        gropuMemberSignoffs: groupMemberSignoffs,
        resourcepoolSignoffs: rpSignoffs
    };
};

/**
 * Get the logged in role UID based on logged in user session
 *
 * @returns {String} Role UID based on logged in user session
 */
var _getLoggedInRoleUid = function() {
    var roleUid = null;
    var userSession = cdmService.getUserSession();
    if ( userSession && userSession.props.role && userSession.props.role.dbValues ) {
        roleUid = userSession.props.role.dbValues[0];
    }
    return roleUid;
};

/**
 * Get the logged in role UID based on logged in user session
 *
 * @returns {String} Role UID based on logged in user session
 */
var _getLoggedInGroupUid = function() {
    var groupUid = null;
    var userSession = cdmService.getUserSession();
    if ( userSession && userSession.props.group && userSession.props.group.dbValues ) {
        groupUid = userSession.props.group.dbValues[0];
    }
    return groupUid;
};

/**
 * To get the signoff object based on logged in group member has any signoff
 * then it will get the signoff and return the signoff object
 *
 * @param {Object} groupMemberSignoffs Group member signoff array
 *
 * @returns {Object} Signoff object
 */
var _getGroupMemberSignoffObject = function( groupMemberSignoffs ) {
    var signoffObject = null;
    var groupMember = cdmService.getGroupMember();
    for ( var idx = 0; idx < groupMemberSignoffs.length; idx++ ) {
        var signoffGroupMember = groupMemberSignoffs[idx].assignee;
        if ( groupMember && signoffGroupMember === groupMember.uid ) {
            signoffObject = groupMemberSignoffs[idx].signoff;
            break;
        }
    }

    // Signoff is null and group memebr signoff list is not null then get the 0th index signoff and return
    if ( !signoffObject && groupMemberSignoffs && groupMemberSignoffs.length > 0
        && groupMemberSignoffs[0] && groupMemberSignoffs[0].signoff ) {
        signoffObject = groupMemberSignoffs[0].signoff;
    }
    return signoffObject;
};

/**
 * To get the signoff object based on logged in group and role has any signoff
 * then it will get the signoff and return the signoff object
 *
 * @param {Object} resourcePoolSignoffs Resource pool signoff array
 * @returns {Object} Signoff object
 */
var _getResourcePoolSignoffObject = function( resourcePoolSignoffs ) {
    var signoffObject = null;

    var groupUid = _getLoggedInGroupUid();
    var roleUid = _getLoggedInRoleUid();

    for ( var idx = 0; idx < resourcePoolSignoffs.length; idx++ ) {
        var signoffResourcePool = resourcePoolSignoffs[idx].assignee;
        var signoffResourcePoolObject = cdmService.getObject( signoffResourcePool );
        var resourcePoolGroupUid = null;
        var resourcePoolRoleUid = null;

        if ( signoffResourcePoolObject.props.group && signoffResourcePoolObject.props.group.dbValues && signoffResourcePoolObject.props.group.dbValues.length > 0 ) {
            resourcePoolGroupUid = signoffResourcePoolObject.props.group.dbValues[0];
        }

        if ( signoffResourcePoolObject.props.role && signoffResourcePoolObject.props.role.dbValues && signoffResourcePoolObject.props.role.dbValues.length > 0 ) {
            resourcePoolRoleUid = signoffResourcePoolObject.props.role.dbValues[0];
        }

        // Check here is signoff group and role are not null and matches with logged in group and role
        // or if group or role is null then match other attribute which is not null
        if ( groupUid === resourcePoolGroupUid && roleUid === resourcePoolRoleUid ||
            !resourcePoolGroupUid && roleUid === resourcePoolRoleUid || !resourcePoolRoleUid && groupUid === resourcePoolGroupUid ) {
            signoffObject = resourcePoolSignoffs[idx].signoff;
            break;
        }
    }

    // Signoff is null and resource pool list is not null then get the 0th index signoff and return
    if ( !signoffObject && resourcePoolSignoffs && resourcePoolSignoffs.length > 0
        && resourcePoolSignoffs[0] && resourcePoolSignoffs[0].signoff ) {
        signoffObject = resourcePoolSignoffs[0].signoff;
    }
    return signoffObject;
};

/**
 * Get the associated signoff object from input selected object. It will return the signoff based on
 * user_all_signoff property.
 *
 * @param {Object} selection Selected obejct from UI
 * @returns {Object} Signoff object
 */
export let getSignoffObject = function( selection ) {
    var signoffObject = null;

    // Check if input object is signoff then directly return the signoff
    if ( selection && selection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        signoffObject = selection;
    }
    var allSignoffObjects = [];

    // Get the user all signoff property and that will be process further to get the correct signoff
    if ( selection.props.user_all_signoffs && selection.props.user_all_signoffs.dbValues ) {
        var allSignOffsUIds = selection.props.user_all_signoffs.dbValues;
        _.forEach( allSignOffsUIds, function( uid ) {
            var modelObject = cdmService.getObject( uid );
            if ( modelObject ) {
                allSignoffObjects.push( modelObject );
            }
        } );
    }

    // Check if all signoff are not empty then only try to find out the associated signoff
    if ( allSignoffObjects.length > 0 ) {
        // Get the signoff on which decision have not be done yet.
        var signoffOutput = _processValidSignOffObject( allSignoffObjects );
        var groupMemberSignoffs = [];
        var resourcePoolSignoffs = [];

        // Check if group member signof is null or empty and resource pool signoff is also null and empty
        // then only get all signoff irrespective decision
        if ( signoffOutput && signoffOutput.gropuMemberSignoffs && signoffOutput.resourcepoolSignoffs
            && signoffOutput.gropuMemberSignoffs.length <= 0 && signoffOutput.resourcepoolSignoffs.length <= 0 ) {
            signoffOutput = _processValidSignOffObjectAfterPerform( allSignoffObjects );
        }

        groupMemberSignoffs = signoffOutput.gropuMemberSignoffs;
        resourcePoolSignoffs = signoffOutput.resourcepoolSignoffs;

        // Get the signoff for group member signoffs
        if ( groupMemberSignoffs.length > 0 ) {
            signoffObject = _getGroupMemberSignoffObject( groupMemberSignoffs );
        }

        // Get the signoff for resource pool signoffs
        if ( !signoffObject && resourcePoolSignoffs.length > 0 ) {
            signoffObject = _getResourcePoolSignoffObject( resourcePoolSignoffs );
        }
    }

    return signoffObject;
};

/**
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @returns {Promise} Promise object
 */
export let loadObjectProperties = function( data, selection ) {
    if ( selection && selection.modelType.typeHierarchyArray.indexOf( 'EPMPerformSignoffTask' ) > -1 ) {
        return exports.loadPSTaskObjectProperties( data, selection );
    }

    if ( selection ) {
        var objectsToLoad = [];
        objectsToLoad.push( selection );
        var deferred = AwPromiseService.instance.defer();
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'awp0PerformableByMeBehavior' ] ).then( function() {
            exports.openPerformPanel( data, selection, deferred );
        } );

        return deferred.promise;
    }
};

/**
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @returns {Promise} Promise object
 */
export let loadPSTaskObjectProperties = function( data, selection ) {
    var objectsToLoad = [];
    objectsToLoad.push( selection );
    var deferred = AwPromiseService.instance.defer();
    var policy = {
        types: [ {
            name: 'EPMPerformSignoffTask',
            properties: [ {
                name: 'user_all_signoffs',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0Instructions',
                modifiers:
                    [
                        {
                            name: 'withProperties',
                            Value: 'true'
                        }
                    ]
            },
            {
                name: 'object_desc'
            },
            {
                name: 'parent_task'
            }
            ]
        }, {
            name: 'ResourcePool',
            properties: [ {
                name: 'group'
            },
            {
                name: 'role'
            }
            ]
        }, {
            name: 'Signoff',
            properties: [ {
                name: 'resource_pool',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'decision'
            },
            {
                name: 'responsible_party'
            },
            {
                name: 'group_member'
            },
            {
                name: 'awp0PerformableByMeBehavior'
            },
            {
                name: 'fnd0ParentTask'
            },
            {
                name: 'comments'
            }
            ]

        } ]
    };
    var policyId = policySvc.register( policy );
    dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'awp0PerformableByMeBehavior', 'user_all_signoffs' ] ).then( function() {
        if ( policyId ) {
            policySvc.unregister( policyId );
        }

        var signoffObject = exports.getSignoffObject( selection );
        var validSelection = selection;
        if ( signoffObject ) {
            validSelection = signoffObject;
        }
        exports.openPerformPanel( data, validSelection, deferred );
    },
    function( error ) {
        if ( policyId ) {
            policySvc.unregister( policyId );
        }
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * Do the perform search call to populate the user or resource pool based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {object} selection - the current selection object
 * @param {Object} deferred - The deferred object
 *
 * @returns {Object} Object that hold info like task can be completed or not
 */
export let openPerformPanel = function( data, selection, deferred ) {
    // Before opening the panel check if performabel property is not loaded then no need to process further
    if ( !selection.props.awp0PerformableByMeBehavior || !selection.props.awp0PerformableByMeBehavior.dbValues || !selection.props.awp0PerformableByMeBehavior.dbValues[0] ) {
        return deferred.resolve( {
            isTaskPerformable: false
        } );
    }

    let awp0PerformableByMeBehavior = selection.props.awp0PerformableByMeBehavior.dbValues[0];

    // Using dispatch to create awp0PerformableByMeBehavior property in data as this property is being used in
    // isPerformPanelUpdateNeeded method and when isPerformPanelUpdateNeeded methods get called, property awp0PerformableByMeBehavior
    // was not available when we use return.
    let { dispatch } = data;
    if ( dispatch ) {
        dispatch( { path: 'data.awp0PerformableByMeBehavior', value: awp0PerformableByMeBehavior } );
    }

    // Before opening the panel check if performabel property is not equal to 1 then return from here
    // and panel should not be visible
    if ( selection.props.awp0PerformableByMeBehavior.dbValues[0] !== '1' ) {
        return deferred.resolve( {
            isTaskPerformable: false
        } );
    }
    // Run the perform handler
    exports.runTaskPerformHandlers( selection ).then( function() {
        return exports.updateSelection( data, selection, false ).then( function( { taskToPerform, activePerformTaskPanelId } ) {
            return deferred.resolve( {
                isTaskPerformable: true,
                taskToPerform: taskToPerform,
                activePerformTaskPanelId: activePerformTaskPanelId
            } );
        } );
    },
    function( error ) {
        return deferred.resolve( {
            isTaskPerformable: false,
            activePerformTaskPanelId: null
        } );
    } );
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 * @param {Object} data Data view model object
 * @param {object} selection - Selected obejct from UI
 * @param {object} isPanelContext - True/False based on panel need to be shown in tool and info area or not
 * @param {Object} deferred object
 * @returns {Object} Object that hold info like task can be completed or not
 */
export let updateSelection = function( data, selection, isPanelContext, deferred ) {
    // Check if selection is null then unregister the context and return from here
    if ( !selection ) {
        if ( deferred ) {
            deferred.resolve( {
                taskToPerform: null,
                activePerformTaskPanelId: null
            } );
        }
        return {
            taskToPerform: null,
            activePerformTaskPanelId: null
        };
    }

    var modelObject = cdmService.getObject( selection.uid );
    if ( modelObject ) {
        // Check if panel context  value is true then we need to get the perform task panel
        // based on panels contributed for tool and info area command else it will be secondary
        // area case so get all panels based on secondary area contribution.
        if ( isPanelContext ) {
            return exports.runTaskPerformHandlers( selection ).then( function() {
                let activePerformTaskPanelId = performPanelService.updatePerformTaskPanelContent( data, selection );
                if ( deferred ) {
                    deferred.resolve( {
                        taskToPerform: modelObject,
                        activePerformTaskPanelId: activePerformTaskPanelId
                    } );
                }
                return {
                    taskToPerform: modelObject,
                    activePerformTaskPanelId: activePerformTaskPanelId
                };
            },
            function( error ) {
                if ( appCtxSvc.ctx && appCtxSvc.ctx.activeToolsAndInfoCommand && appCtxSvc.ctx.activeToolsAndInfoCommand.commandId === 'Awp0PerformTaskPanel' ) {
                    commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
                }
                if ( deferred ) {
                    deferred.reject( error );
                }
            } );
        }
        return performPanelService.populateContributedPerformTaskPanel( 'performTaskPanelConfiguration.secondaryAreaContribution', selection ).then( function( activePerformTaskPanelId ) {
            // Check if previous active perform task panel id property on data is same as new active
            // panel id then fire event to update the task panel otherwise re-render active perform task panel
            if ( data.activePerformTaskPanelId === activePerformTaskPanelId ) {
                eventBus.publish( 'Awp0PerformTask.updateInternalPanel' );
            }

            return {
                taskToPerform: modelObject,
                activePerformTaskPanelId: activePerformTaskPanelId
            };
        } );
    }
};


/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {String} Property internal value string
 */
var _getPropValue = function( modelObject, propName ) {
    if ( !modelObject || !modelObject.uid ) {
        return null;
    }
    if ( modelObject.props && modelObject.props[propName] && modelObject.props[propName].dbValues
        && modelObject.props[propName].dbValues[0] ) {
        return modelObject.props[propName].dbValues[0];
    }
    return null;
};

/**
 * Check if there is any property that is in edit mode using the edit handler
 * and check if their any edit proeprty then updated the LSD for those proeprties
 * only so that it will have latest LSD. This is fix for defect # LCS-458437
 * @param {Object} modelObject Model obejct whose LSD need to check
 */
var _updateEditPropLSD = function( modelObject ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    var lsd = _getPropValue( modelObject, 'lsd' );

    // Get the LSD for object
    if ( modelObject && modelObject.props && modelObject.props.lsd && modelObject.props.lsd.dbValues
        && modelObject.props.lsd.dbValues[0] ) {
        lsd = modelObject.props.lsd.dbValues[0];
    }
    if ( activeEditHandler ) {
        // Get the active edit handler and if not null then only get the lsd proerpty for obejct if not loaded
        // already and then get all modified or editable properties and those are not null then modify the LSD.
        dataManagementService.getProperties( [ modelObject.uid ], [ 'lsd' ] ).then( function() {
            var latestObject = cdmService.getObject( modelObject.uid );
            lsd = _getPropValue( latestObject, 'lsd' );
            if ( activeEditHandler && lsd ) {
                var dataSource = activeEditHandler ? activeEditHandler.getDataSource() : null;
                if ( dataSource ) {
                    var modifyPropVMo = dataSource.getAllModifiedPropertiesWithVMO();
                    var isMatchFound = false;
                    if ( modifyPropVMo && modifyPropVMo.length > 0 ) {
                        for ( var idx = 0; idx < modifyPropVMo.length; idx++ ) {
                            var vmoObject = modifyPropVMo[idx];
                            if ( vmoObject && latestObject && vmoObject.uid === latestObject.uid && vmoObject.viewModelProps ) {
                                isMatchFound = true;
                                _.forEach( vmoObject.viewModelProps, function( prop ) {
                                    prop.sourceObjectLastSavedDate = lsd;
                                } );
                            }
                        }
                    }
                    // Editing the table properties through start edit and then change the view mode to list
                    // that it shows save/discard message and clicking on that it will save the properties
                    if ( !isMatchFound ) {
                        var _modProps = dataSource.getAllEditableProperties();
                        if ( _modProps && _modProps.length > 0 ) {
                            _.forEach( _modProps, function( prop ) {
                                prop.sourceObjectLastSavedDate = lsd;
                            } );
                        }
                    }
                }
            }
        } );
    }
};

/**
 * Run the perform handler for input model object and based on return success or failure.
 *
 * @param {Object} modelObject Model obejct whose perform handler need to run
 *
 * @returns {Promise} Promise object
 */
export let runTaskPerformHandlers = function( modelObject ) {
    var deferred = AwPromiseService.instance.defer();
    if ( !modelObject || !modelObject.uid ) {
        deferred.resolve( null );
        return deferred.promise;
    }

    var inputData = {
        input: [ {
            actionableObject: modelObject,
            supportingObject: null,
            action: 'SOA_EPM_perform_action',
            propertyNameValues: {}
        } ]
    };
    var viewed_by_me_initial = _getPropValue( modelObject, 'viewed_by_me' );
    var viewed_by_me_post = null;
    var lsdPolicy = {
        types: [ {
            name: 'EPMTask',
            properties: [
                {
                    name: 'lsd'
                }
            ]
        },
        {
            name: 'Signoff',
            properties: [ {
                name: 'lsd'
            } ]
        },
        {
            name: 'TaskInbox',
            properties: [ {
                name: 'contents'
            } ]
        }
        ]
    };
    var lsdPolicyObject = policySvc.register( lsdPolicy );
    soaSvc.post( 'Workflow-2014-06-Workflow', 'performAction3', inputData ).then(
        function() {
            policySvc.unregister( lsdPolicyObject );
            var object = cdmService.getObject( modelObject.uid );
            _updateEditPropLSD( object );
            viewed_by_me_post = _getPropValue( object, 'viewed_by_me' );
            if ( viewed_by_me_initial !== viewed_by_me_post ) {
                eventBus.publish( 'workflow.updateTaskCount' );
            }
            deferred.resolve( object );
        },
        function( error ) {
            policySvc.unregister( lsdPolicyObject );
            messagingService.showError( error.message );
            var object = cdmService.getObject( modelObject.uid );
            _updateEditPropLSD( object );
            viewed_by_me_post = _getPropValue( object, 'viewed_by_me' );
            if ( viewed_by_me_initial !== viewed_by_me_post ) {
                eventBus.publish( 'workflow.updateTaskCount' );
            }
            deferred.reject( error );
        }
    );
    return deferred.promise;
};

/**
 * Check if digital signature service is configured or not and based on that check
 * if digital signature need to be apply then based on that return true or false.
 *
 * @param {Object} selObject Selected task object that need to be complete
 *
 * @returns {boolean} True/False based on digital signature service is configured or not
 */
export let initDigitalSignature = function( selObject ) {
    if ( !selObject ) {
        return false;
    }
    return exports.getDigitalSignatureService().then( function( awDigitalSignatureService ) {
        var isDSConfigured = false;
        if ( awDigitalSignatureService ) {
            isDSConfigured = true;
        }
        return isDSConfigured;
    } );
};

/**
 * This method will get task from selected or opened target object if it is of type different from EPMTask or Signoff.
 *
 * @param {Object} selectedObject the selected object
 * @param {Object} openedObject the opened object
 * @returns {Object} task object
 */
export let updateSelectedTask = function( selectedObject, openedObject ) {
    // Getting selectedObject/openedObject object data from sub panel context.
    // selectedObject -> value is populated only when task/target is selected not opened.
    // openedObject -> value is populated only when task/target is opened.
    let currentSelection = selectedObject ? selectedObject : openedObject;

    // We are using adapter service here to get the adpated object like in case of content
    // tab when Awb0DesignElement is shown we need to get task info from underlying object that
    // is item revision. So get that adapted object and use it futher
    var adaptedObjects = adapterSvc.getAdaptedObjectsSync( [ currentSelection ] );
    if ( adaptedObjects && adaptedObjects[0] ) {
        currentSelection = adaptedObjects[0];
    }

    let taskSelected = null;

    if ( currentSelection ) {
        if ( !awp0InboxUtils.isValidEPMTaskType( currentSelection ) ) {
            taskSelected = currentSelection;
        } else {
            taskSelected = awp0InboxUtils.getActiveTaskFromWSOObject( currentSelection );
        }
    }
    return {
        taskSelected: taskSelected
    };
};

/**
 * Remove the unneeded params from the URL after performing task
 */
let _cleanupParamsFromURL = function() {
    var params = {
        reauthorize: null,
        actionableObjectUID: null,
        action: null,
        supportingValue: null,
        supportingObjectUID: null,
        comments: null
    };
    AwStateService.instance.go( AwStateService.instance.current.name, params );
};

export let reauthenticate = function( actionableObject, action, supportingValue, supportingObject, data, reauthValue ) {
    var parameters = {};
    var tempActionableObjectUID = '';
    var tempSupporingObjectUID = '';
    var tempComments = '';
    var commentsObject = exports.getComments( data );
    if ( commentsObject && commentsObject.comments ) {
        var commentsArray = commentsObject.comments;
        if ( commentsArray[0] ) {
            tempComments = commentsArray[0];
        }
    }
    if ( actionableObject.uid && actionableObject.uid.valueOf() ) {
        tempActionableObjectUID = actionableObject.uid.valueOf();
    }
    if ( supportingObject.uid && supportingObject.uid.valueOf() ) {
        tempSupporingObjectUID = supportingObject.uid.valueOf();
    }
    if ( supportingObject ) {
        parameters = {
            reauthorize: reauthValue,
            actionableObjectUID: tempActionableObjectUID,
            action: action.valueOf(),
            supportingValue: supportingValue.valueOf(),
            supportingObjectUID: tempSupporingObjectUID,
            comments: tempComments
        };
    } else {
        parameters = {
            reauthorize: reauthValue,
            actionableObjectUID: tempActionableObjectUID,
            action: action.valueOf(),
            supportingValue: supportingValue.valueOf(),
            supportingObjectUID: '',
            comments: tempComments
        };
    }
    var ssoReauthenticate = true;
    ssoAuthenticator.authenticate( ssoReauthenticate, parameters );
};

export let checkForReauthentication = function( data ) {
    // Check for TcSSO reauth parameter in URL, indicating reauthorization has already occurred. Perform task with retrieved SSO token
    var reauth = _getTrueParameterValue( AwStateService.instance.params.reauthorize );
    const tokenValue = ssoAuthenticator.getReauthToken();
    if ( reauth && ( reauth === 'true' || reauth === 'ds' ) && tokenValue.length > 0 ) {
        var supportingObjectUID = _getTrueParameterValue( AwStateService.instance.params.supportingObjectUID );
        if ( supportingObjectUID && supportingObjectUID !== '' ) {
            var signoffObject = cdmService.getObject( supportingObjectUID );
            loadParentTask( data, signoffObject );
        } else {
            checkForPerformAfterSSOReauthentication( data );
        }
    }
};

let _getTrueParameterValue = function( value ) {
    if ( Array.isArray( value ) ) {
        return value[value.length - 1];
    }
    return value;
};

export let loadParentTask = function( data, selection ) {
    var objectsToLoad = [];
    objectsToLoad.push( selection );
    dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'fnd0ParentTask' ] ).then( function() {
        exports.checkForPerformAfterSSOReauthentication( data );
    } );
};


export let checkForPerformAfterSSOReauthentication = function( data ) {
    //Check for reauth parameter in URL, indicating reauthorization has already occurred. Perform task with retrieved SSO token
    // if signoff, get the parent PST task
    var actionableObjectUID = _getTrueParameterValue( AwStateService.instance.params.actionableObjectUID );
    var actionableObject = cdmService.getObject( actionableObjectUID );

    //Only perform for started tasks
    if ( actionableObject && actionableObject.props && actionableObject.props.state_value && actionableObject.props.state_value.dbValues[0] !== '4' ) {
        return;
    }
    //Only perform for started tasks
    if ( actionableObject && actionableObject.props && actionableObject.props.state && actionableObject.props.state.dbValues[0] !== '4' ) {
        return;
    }
    var action = _getTrueParameterValue( AwStateService.instance.params.action );
    var supportingValue = _getTrueParameterValue( AwStateService.instance.params.supportingValue );
    var supportingObjectUID = _getTrueParameterValue( AwStateService.instance.params.supportingObjectUID );
    var supportingObject = '';
    if ( supportingObjectUID && supportingObjectUID !== '' ) {
        supportingObject = cdmService.getObject( supportingObjectUID );
    }
    var commentsURIString = _getTrueParameterValue(  AwStateService.instance.params.comments );
    var decodedComments = '';
    if ( commentsURIString ) {
        decodedComments = decodeURIComponent( commentsURIString );
    }
    //get the token from the URL and set data.password.dbValue value to the token string
    const tokenValue = ssoAuthenticator.getReauthToken();
    if ( tokenValue && tokenValue !== '' ) {
        data.password = {
            dbValue: tokenValue
        };
    }

    data.comments = {
        dbValue: decodedComments
    };

    var reauth = _getTrueParameterValue( AwStateService.instance.params.reauthorize );

    _cleanupParamsFromURL();

    if ( reauth === 'true' ) {
        performTaskFromSSOReauth( data, actionableObject, action, supportingValue, supportingObject );
    } else if ( reauth === 'ds' ) {
        performTaskFromSSOReauthDS( data, actionableObject, action, supportingValue, supportingObject );
    }
};

/**
 * Perform the task using performAction3 SOA service
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 */
export let performTaskFromSSOReauth = function( data, actionableObject, action, supportingValue, supportingObject  ) {
    exports.isEditInProgress().then( function() {
        _performTaskInternal( data, actionableObject, action, supportingValue, supportingObject ).then( function( response ) {
            // Process the SOA response
            _performTaskInternalProcessResponse( response, data, actionableObject, true );
        },
        function( error ) {
            messagingService.showError( error );
        } );
    } );
};

/**
 * Perform the task using performAction3 SOA service
 *
 * @param {object} data - the data Object
 * @param {object} actionableObject - the current selection object
 * @param {object} action - the data Object
 * @param {object} supportingValue - the data Object
 * @param {object} supportingObject - the data Object
 *
 */
export let performTaskFromSSOReauthDS = function( data, actionableObject, action, supportingValue, supportingObject  ) {
    exports.isEditInProgress().then( function() {
        _performTaskDSInternal( data, actionableObject, action, supportingValue, supportingObject );
    } );
};

/**
* Sets data.updateFormLoadingCompleted to true
 * @returns {boolean} True.
*/
export let updateFormLoadingCompleted = function( ) {
    startFormEdit();
    return true;
};

/**
* Sets data.updateFormLoadingCompleted to false
 * @returns {boolean} True.
*/
export let resetFormLoadingCompleted = function( ) {
    return false;
};

export let startFormEdit = function() {
    var activeEditHandler = editHandlerService.getEditHandler( 'FORM_PANEL_CONTEXT' );
    if( activeEditHandler && activeEditHandler.canStartEdit() ) {
        activeEditHandler.startEdit();
    }
};

/**
 * This factory creates a service and returns exports
 *
 * @member AddParticipant
 */

export default exports = {
    getDigitalSignatureService,
    populateDescription,
    getComments,
    performTaskDS,
    isEditInProgress,
    registerPerformPanelProps,
    unregisterPerformPanelProp,
    navigateToInbox,
    performTask,
    populateErrorMessageOnPerformAction,
    populateSecondaryPanel,
    isPerformPanelUpdateNeeded,
    updateStyleForSecondaryPanel,
    getSignoffObject,
    loadObjectProperties,
    loadPSTaskObjectProperties,
    openPerformPanel,
    updateSelection,
    runTaskPerformHandlers,
    initDigitalSignature,
    updateSelectedTask,
    checkForPerformAfterSSOReauthentication,
    setTCSSOEnabled,
    checkForReauthentication,
    updateFormLoadingCompleted,
    resetFormLoadingCompleted

};
