// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0NewWorkflowProcess
 */
import appCtxSvc from 'js/appCtxService';
import listBoxService from 'js/listBoxService';
import dmSvc from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import messagingSvc from 'js/messagingService';
import _ from 'lodash';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import parsingUtils from 'js/parsingUtils';
import workflowUtils from 'js/Awp0WorkflowUtils';
import prefSvc from 'soa/preferenceService';
import workflowAssignmentSvc from 'js/Awp0WorkflowAssignmentService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import eventBus from 'js/eventBus';

var exports = {};
var _attachmentTypes = null;
/** AW intermediate preference */
var CR_ALLOW_ALTERNATE_PROCEDURES_PREFERENCE = 'CR_allow_alternate_procedures'; //NON-NLS-1

export let sendEventToHost = function( data, submitPanelState ) {
    var uids = data.createdProcess;

    dmSvc.loadObjects( uids ).then( function() {
        localeSvc.getTextPromise( 'WorkflowCommandPanelsMessages' ).then( function( textBundle ) {
            var modelObject = cdm.getObject( uids[ 0 ] );

            var objectRef = objectRefSvc.createBasicRefByModelObject( modelObject );

            var feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();

            var msg = '';
            var targetCount = submitPanelState.targetObjects.length;
            if ( targetCount > 1 ) {
                msg = messagingSvc.applyMessageParamsWithoutContext( textBundle.submitToWorkflowSuccess, [ targetCount ] );
            } else {
                msg = messagingSvc.applyMessageParamsWithoutContext( textBundle.singleSubmitToWorkflowSuccess, [ modelObject.toString() ] );
            }
            feedbackMessage.setFeedbackTarget( objectRef );
            feedbackMessage.setFeedbackString( msg );

            hostFeedbackSvc.createHostFeedbackProxy().fireHostEvent( feedbackMessage );
        } );
    } );
};

/**
 * Set the default valuues for panel initialization.
 *
 * @param {Array} selectedObjects Selected objects from UI that will be submitted to workflow
 * @param {Object} submitPanelState submit panel state object that will hold all information
 * @param {Object} sourceObject Source object. This will be task in case of create sub process
 * @returns {Object} Object to hold sunbmit panel state
 */
export let setPanelInitialValues = function( selectedObjects, submitPanelState, sourceObject ) {
    const panelState = { ...submitPanelState };
    // Check if input source objects is not null then only add it on target objects
    if( selectedObjects ) {
        panelState.targetObjects = _.cloneDeep( selectedObjects );
    }

    // Get the workflow_process_candidates object and this is going to be used in hosted mode
    // to get the model objects user want to submit to workflow
    var workflowProcessCandidates = appCtxSvc.getCtx( 'workflow_process_candidates' );
    var hosted = appCtxSvc.getCtx( 'aw_hosting_enabled' );
    var state = appCtxSvc.getCtx( 'state' );

    // Check if we are running in hosted mode then check if workFlowObjects are not null and then
    // set it on the targetObjects.
    if( workflowProcessCandidates && hosted && workflowProcessCandidates.workFlowObjects ) {
        panelState.targetObjects = workflowProcessCandidates.workFlowObjects;
    }else if( hosted && state && state.params && state.params.uid ) {
        var targetObject = tcViewModelObjectSvc.createViewModelObjectById( state.params.uid );
        panelState.targetObjects = [ targetObject ];
    }

    // Source object will be set on sub process case where user wants to create the dependency from select task
    // and new process being created.
    if( sourceObject ) {
        panelState.sourceObject = sourceObject;
    }

    return {
        isDataInit : true,
        submitPanelState: panelState
    };
};

/**
 * Load allowed alternate procedure preference value is not loaded already and then
 * update the context service.
 *
 * @param {Array} preferences Loaded preference values on context
 */
export let getAllowAlternateProcedurePrefValue = function( preferences, submitPanelState ) {
    if( !preferences ) {
        return;
    }
    const prefValues = { ... preferences };
    prefSvc.getStringValue( CR_ALLOW_ALTERNATE_PROCEDURES_PREFERENCE ).then( function( prefValue ) {
        if( !prefValue || prefValue.length <= 0 ) {
            prefValue = 'none';
        }
        const localSubmitPanelState = { ...submitPanelState.value };
        prefValues[ CR_ALLOW_ALTERNATE_PROCEDURES_PREFERENCE ] = [ prefValue ];
        localSubmitPanelState.CR_allow_alternate_procedures = prefValue;
        submitPanelState.update && submitPanelState.update( localSubmitPanelState );
        //Fire event to populateAlternateProcedureProp
        eventBus.publish( 'submitToWorkflow.populateAlternateProcedurePropEvent' );
    } );
};

/**
 * Convert the template objects to LOV values that needs to be shown on UI.
 *
 * @param {Array} templatesObjects Template objects that needs to be shown in list box
 *
 * @returns {Array} LOV template values array
 */
var _populateTemplateValues = function( templatesObjects ) {
    var templateLOVValues = [];
    if( templatesObjects && !_.isEmpty( templatesObjects ) ) {
        // Create the list model object that will be displayed
        templateLOVValues = listBoxService.createListModelObjects( templatesObjects, 'props.template_name' );
        var templatesObject = templateLOVValues[ 0 ];
        var isFnd0InstructionsAvailable = false;

        //Check if fnd0Instructions property is available.f available use fnd0Instructions property as description
        if( templatesObject && templatesObject.propInternalValue && templatesObject.propInternalValue.props.fnd0Instructions ) {
            isFnd0InstructionsAvailable = true;
        }

        for( var idx = 0; idx < templateLOVValues.length; idx++ ) {
            var object = templateLOVValues[ idx ];
            var descValue = object.propInternalValue.props.object_desc.uiValues[ 0 ];
            if( isFnd0InstructionsAvailable ) {
                descValue = object.propInternalValue.props.fnd0Instructions.uiValues[ 0 ];
            }
            templateLOVValues[ idx ].propDisplayDescription = descValue;
        }
    }
    return templateLOVValues;
};

/**
 * Get the all and filter templates from SOA response and return to be shown on UI.
 *
 * @param {Object} response SOA response object that contains template values
 *
 * @returns {Object} Returns filter and all template object
 */
export let getWorkflowTemplatesData = function( response ) {
    var allTemplates = [];
    var filterTemplates = [];
    if( response && response.templatesOutput ) {
        _.forEach( response.templatesOutput, function( object ) {
            if( object.clientId === 'allTemplates' ) {
                allTemplates = object.workflowTemplates;
            } else if( object.clientId === 'filterTemplates' ) {
                filterTemplates = object.workflowTemplates;
            }
        } );
    }
    if( allTemplates && !_.isEmpty( allTemplates ) ) {
        allTemplates = _populateTemplateValues( allTemplates );
    }
    if( filterTemplates && !_.isEmpty( filterTemplates ) ) {
        filterTemplates = _populateTemplateValues( filterTemplates );
    }
    return {
        filterTemplates : filterTemplates,
        allTemplates : allTemplates
    };
};

/**
 * Populate all or assigned property value based on CR_allow_alternate_procedures preference value
 * and update the property value and return updated property object.
 *
 * @param {Object} propObject Populate All /Assigned property value that need to be shown on UI.
 * @param {Array} targetObjects Selected target objects from UI
 *
 * @returns {Object} Property object to show all or assigned property value.
 */
export let populateAlternateProcedureProp = function( propObject, targetObjects, submitPanelState ) {
    return prefSvc.getStringValue( CR_ALLOW_ALTERNATE_PROCEDURES_PREFERENCE ).then( function( prefValue ) {
        if( !prefValue || prefValue.length <= 0 ) {
            prefValue = 'none';
        }
        const localSubmitPanelState = { ...submitPanelState.value };
        localSubmitPanelState.CR_allow_alternate_procedures = prefValue;
        submitPanelState.update && submitPanelState.update( localSubmitPanelState );

        var isAllowAlternateProcedures = false;
        if( prefValue.toLowerCase() === 'none' ) {
            isAllowAlternateProcedures = false;
        } else if( prefValue.toLowerCase() === 'any' ) {
            isAllowAlternateProcedures = true;
        } else if( prefValue === 'Assigned' ) {
            isAllowAlternateProcedures = false;
        }
        const localProp = { ...propObject };
        localProp.dbValue = isAllowAlternateProcedures;
        return localProp;
    } );
};


/**
 * Reads the preference value to determine whether the template name is prepended when submitting object to workflow.
 *
 * @param {String} processName Selected process name string
 * @param {String} workFlowName Workflow process name string
 * @returns {String} Return the workflow process name based on preference value.
 */
function returnProcessName( processName, workFlowName ) {
    var workFlowProcessName = processName;
    if ( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.WRKFLW_add_template_name_for_new_process &&
        appCtxSvc.ctx.preferences.WRKFLW_add_template_name_for_new_process[ 0 ] === 'false' ) {
        workFlowProcessName = workFlowName;
    }
    return workFlowProcessName;
}

/**
 * Populate the workflow process name based on input target object and selected process from UI.
 *
 * @param {Array} targetObjects Selected target objects from UI
 * @param {Object} workflowNameProp Workflow process name property object
 * @param {String} selTemplateName Selected template name from UI
 *
 * @returns {Object} Workflow process property object
 */
var _populateWorkflowProcessName = function( targetObjects, workflowNameProp, selTemplateName ) {
    const workflowNamePropObject = { ...workflowNameProp };
    var workFlowName = null;
    var processName = null;
    if( targetObjects && !_.isEmpty( targetObjects )  && targetObjects[ 0 ]
    && targetObjects[ 0 ].props && targetObjects[ 0 ].props.object_string ) {
        var targetName = targetObjects[ 0 ].props.object_string.uiValues[ 0 ];
        workFlowName = selTemplateName + ': ' + targetName;
        // Maximum we can have 128 characters in process name
        processName = returnProcessName( workFlowName, targetName );
    } else if( !targetObjects  || _.isEmpty( targetObjects ) ) {
        workFlowName = selTemplateName + ': No Targets';
        processName = returnProcessName( workFlowName, 'No Targets' );
    }
    if( processName ) {
        processName = workflowUtils.getPropTrimValue( workflowNamePropObject.maxLength, processName );
        workflowNamePropObject.dbValue = processName;
        workflowNamePropObject.uiValue = processName;
    }
    return workflowNamePropObject;
};

/**
 * Update the selected process template info on input sub panel context object.
 *
 * @param {Object} subPanelContext Sub panel context where selected template info need to be added
 * @param {Object} selTemplate Selected process template from UI.
 */
var _updateSelTemplateContextInfo = function( subPanelContext, selTemplate ) {
    if( subPanelContext && ( selTemplate === '' || selTemplate ) ) {
        const localSubPanelContext = { ...subPanelContext.value };
        localSubPanelContext.processTemplate = selTemplate;
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
};

/**
 * Populate the panel data based on selection and add the additional search criteria so that duplicate reviewer
 * will be avoided.
 *
 * @param {data} templatesData - Template data object that contains all or filter template list
 * @param {Object} subPanelContext context object
 * @param {object} selection - the current selection object
 * @param {boolean} isFilterTemplate - Is filter template need to be shown or not
 * @param {Object} workflowTemplatesPropObj Template property object
 * @param {Object} workFlowNamePropObj Process property object
 *
 * @returns {Object} Object with updated info need to be shown on UI.
 */
export let populatePanelData = function( templatesData, subPanelContext, selection, isFilterTemplate, workflowTemplatesPropObj, workFlowNamePropObj ) {
    // Check if input templatesData object is null that means SOA doesn't return the templates then
    // we need to return empty templates array and other properties same as input.
    if( !templatesData ) {
        return {
            templatesObjects : [],
            workflowTemplates : workflowTemplatesPropObj,
            workFlowName : workFlowNamePropObj
        };
    }
    var templatesObjects = [];
    // Based on all or assigned option get the correct templates that need to be shown on UI.
    // If we are not filtering the templates via CR_allow_alternate_procedure, or no targets are currently populated, display all templates.
    // Otherwise, display only the filtered template list
    if( selection && selection.length === 0 ) {
        templatesObjects = templatesData.allTemplates;
    } else if( isFilterTemplate ) {
        templatesObjects = templatesData.allTemplates;
    } else {
        templatesObjects = templatesData.filterTemplates;
    }
    //For add references case, just return the info, as we don't update display for references
    var addReferenceCase = false;
    if( subPanelContext && subPanelContext.attachmentContextKey && subPanelContext.attachmentContextKey === 'referenceObjects' ) {
        addReferenceCase = true;
    }
    if ( addReferenceCase ) {
        // Still need to update isReloadPanel and submitActionInProgress
        // to prevent issues after adding reference
        if( subPanelContext ) {
            const localSubPanelContext = { ...subPanelContext.value };
            localSubPanelContext.isReloadPanel = false;
            localSubPanelContext.submitActionInProgress = false;
            subPanelContext.update && subPanelContext.update( localSubPanelContext );
        }
        return {
            templatesObjects : templatesObjects,
            workflowTemplates : workflowTemplatesPropObj,
            workFlowName : workFlowNamePropObj
        };
    }

    const workflowTemplates = { ... workflowTemplatesPropObj };
    var propDBValue = null;
    var propUiValue = '';

    var idx = 0;
    // Check if isReloadPanel is true that means it's add or remove target case where
    // we need to reload the panel so get the previous selected template index and if
    // present in new template list then need to select that same template else select
    // the 0th index template.
    if( subPanelContext && subPanelContext.isReloadPanel ) {
        var templateObj1 = workflowTemplates.dbValue;
        if( templateObj1 ) {
            idx = _.findIndex( templatesObjects, function( templateObj ) {
                return templateObj.propInternalValue && templateObj.propInternalValue.uid === templateObj1.uid;
            } );
        }
    }

    // Check if value is less than 0 then we need to set it to 0 so that first template can
    // be selected
    if( idx < 0 ) {
        idx = 0;
    }


    // Select the default template based on index
    if( templatesObjects && templatesObjects.length > 0 && templatesObjects[ idx ] ) {
        propDBValue = templatesObjects[ idx ].propInternalValue;
        propUiValue = templatesObjects[ idx ].propDisplayValue;

        workflowTemplates.dbValue = propDBValue;
        workflowTemplates.uiValue = propUiValue;
        workflowTemplates.dbOriginalValue = propDBValue;
        workflowTemplates.selectedLovEntries = [];
        workflowTemplates.selectedLovEntries[ 0 ] = templatesObjects[ idx ];
        workflowTemplates.selectedLovEntries[ 0 ].sel = true;
    }

    workflowTemplates.dbValue = propDBValue;
    workflowTemplates.uiValue = propUiValue;

    workflowTemplates.isEditable = true;
    workflowTemplates.isEnabled = true;
    // Check if template that need to be shown is 0 or 1 then don't show the template list as LOV and
    // put the widget edit mode to false.
    if( templatesObjects && templatesObjects.length <= 1 ) {
        workflowTemplates.isEditable = false;
        workflowTemplates.isEnabled = false;
    }

    const workFlowNameProp = _populateWorkflowProcessName( selection, workFlowNamePropObj, propUiValue );

    // Set the process template, process name on context and default value for isReloadPanel with false.
    if( subPanelContext ) {
        const localSubPanelContext = { ...subPanelContext.value };
        localSubPanelContext.processTemplate = propDBValue;
        localSubPanelContext.processName = workFlowNameProp.dbValue;
        localSubPanelContext.isReloadPanel = false;
        localSubPanelContext.submitActionInProgress = false;
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
    return {
        templatesObjects : templatesObjects,
        workflowTemplates : workflowTemplates,
        workFlowName : workFlowNameProp
    };
};

/**
 * Update the process name property based on selected targets and workflow template and
 * update the process name accordingly and return the updated property.
 *
 * @param {Object} subPanelContext Context object where info need to be updated.
 * @param {Array} targetObjects Selected target objects from UI.
 * @param {Object} workflowTemplates Workflow template property object
 * @param {Object} workflowNameProp Process name property object
 * @param {Object} workFlowName Fields property to update fields value
 *
 * @returns {Object} Updated workflow process name property object based on input target and select process
 */
export let updateTemplateContextInfo = function( subPanelContext, targetObjects, workflowTemplates, workflowNameProp, workFlowName ) {
    const selTemplate = workflowTemplates.dbValue;
    const selTemplateDispName = workflowTemplates.uiValue;
    const workFlowNameProp = _populateWorkflowProcessName( targetObjects, workflowNameProp, selTemplateDispName );
    _updateSelTemplateContextInfo( subPanelContext, selTemplate );
    workFlowName.update && workFlowName.update( workFlowNameProp.dbValue, { markModified : false, runValidation : true } );
    return workFlowNameProp;
};

/**
 * Update the context info based on input key and value.
 * @param {Object} subPanelContext Context object where infomarion need to be updated.
 * @param {String} contextKey Information that need to be updated
 * @param {String} contextValue Key for information need to be updated
 */
export let updateWorkflowContextInfo = function( subPanelContext, contextKey, contextValue ) {
    if( subPanelContext ) {
        const localSubPanelContext = { ...subPanelContext.value };
        localSubPanelContext[ contextKey ] = contextValue;
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
};

/**
 * Populate the Uids that need to be added as attachments.
 *
 * @param {Array} modelObjects Model objects that need to be added
 * @param {Array} uidList Uid list that will be added as attachment
 * @returns {Array} Final Uids array that will be added as attachment.
 */
var _getAttachmentObjectUids = function( modelObjects, uidList ) {
    var uids = _.clone( uidList );
    if( modelObjects && !_.isEmpty( modelObjects ) ) {
        for( var x in modelObjects ) {
            if( modelObjects[ x ] && modelObjects[ x ].uid ) {
                var targetUid = modelObjects[ x ].uid;
                if( modelObjects[ x ].type === 'Awp0XRTObjectSetRow' ) {
                    var targetObj = _.get( modelObjects[ x ], 'props.awp0Target' );
                    if( targetObj && targetObj.dbValue ) {
                        targetUid = targetObj.dbValue;
                    }
                }
                if( targetUid ) {
                    uids.push( targetUid );
                }
            }
        }
    }
    return uids;
};

/**
 * Return the input model object array UID array
 *
 * @param {Object} subPanelContext Context object
 * @param {Object} assignmentStateContext Assignment data context object
 * @return {StringArray} UID's string array
 */
export let getUids = function( subPanelContext, assignmentStateContext ) {
    var uids = [];
    var attachmentList = [];
    const localContext = { ...subPanelContext.value };

    // Populate the Uids that need to be added as target attachment
    var targetObjects = localContext.targetObjects;
    uids = _getAttachmentObjectUids( targetObjects, uids );

    // Populate the Uids that need to be added as reference attachment
    var referenceObjects = localContext.referenceObjects;
    uids = _getAttachmentObjectUids( referenceObjects, uids );
    attachmentList = uids.concat( attachmentList );

    _attachmentTypes = null;

    if( assignmentStateContext && assignmentStateContext.value ) {
        var assignmentState = { ...assignmentStateContext.value };
        // Check if assignmetn data is present then get that assignment data from that object and get the
        // task specific assignemnts and then add it to variables so that task specific assignments can be done.
        if( assignmentState && assignmentState.taskAssignmentDataObject ) {
            var assignmentData = _getTaskNonDPBasedAssignments( assignmentState, assignmentState.taskAssignmentDataObject );
            if( assignmentData && assignmentData.taskBasedAssignmentInfo ) {
                attachmentList = attachmentList.concat( assignmentData.taskBasedAssignmentInfo );
            }
            _attachmentTypes = assignmentData.attachmentType;
        }
    }


    localContext.submitActionInProgress = true;
    subPanelContext.update && subPanelContext.update( localContext );
    // More code will come for assignments
    return attachmentList;
};

/**
 * Return all available attachment types
 *
 * @param {Object} subPanelContext Context object
 * @param {Array} targetObjects - Array of model object added as targets
 * @param {Array} referencesObjects - Array of model object added as references
 *
 * @return {NumberArray} Attachment type array
 */
export let getAttachmentTypes = function( subPanelContext, targetObjects, referencesObjects ) {
    var attachmentTypes = [];
    if( targetObjects ) {
        for( var idx = 0; idx < targetObjects.length; idx++ ) {
            attachmentTypes.push( 1 );
        }
    }

    // Check if input reference obejcts are not null then add it to array with attachment type
    // as 3.
    if( referencesObjects ) {
        for( var idx1 = 0; idx1 < referencesObjects.length; idx1++ ) {
            attachmentTypes.push( 3 );
        }
    }

    if( _attachmentTypes && typeof _attachmentTypes !== typeof undefined && _attachmentTypes.length > 0 ) {
        attachmentTypes = attachmentTypes.concat( _attachmentTypes );
    }
    return attachmentTypes;
};

/**
 * Update the task assignment context object on main context so when suer click on submit it can be used.
 *
 * @param {Object} taskAssignmentContext Task assignment context object
 * @param {Object} subPanelContext Context object.
 */
export let updateContextAssignmentInfo = function( taskAssignmentContext, subPanelContext ) {
    if( taskAssignmentContext && subPanelContext ) {
        const localCtx = { ...subPanelContext.value };
        localCtx.taskAssignmentContext = taskAssignmentContext;
        subPanelContext.update && subPanelContext.update( localCtx );
    }
};

/**
 * Get the origin id that need to be used for saving.
 *
 * @param {Object} modelObject Model object for assignment need to be fetched
 *
 * @returns {String} Origin UID string
 */
var _getAssignmentOrigin = function( modelObject ) {
    var originId = 'AAAAAAAAAAAAAA';
    if( modelObject && modelObject.assignmentOrigin && modelObject.assignmentOrigin !== null
        && modelObject.assignmentOrigin.uid ) {
        originId = modelObject.assignmentOrigin.uid;
        // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
        // resource pools added to one aw-list component then because of uid check in component, there
        // is one issue to render it correctly. So to handle it we update the uid with some random number
        // to make it unique and then added uniqueUid to contain the original UID for resource pool.
        if( modelObject.assignmentOrigin.uniqueUid ) {
            originId = modelObject.assignmentOrigin.uniqueUid;
        }
    }
    return originId;
};

/**
 * Get the profile object associated with assignment if yes then return profile uid else
 * return null uid.
 * @param {Object} modelObject Assignment model object
 *
 * @returns {Object} Profile object for assignment coming for profile assignment
 */
var _getProfileObjectUid = function( modelObject ) {
    if( modelObject.signoffProfile && modelObject.signoffProfile.uid ) {
        return modelObject.signoffProfile.uid;
    }
    return 'AAAAAAAAAAAAAA';
};

/**
 * True or false based on task assignment is valid or not.
 *
 * @param {Object} modelObject object have assignment info
 *
 * @returns{boolean} True/False
 */
var _isValidTaskAssignment = function( modelObject ) {
    if( !modelObject || !modelObject.taskAssignment || modelObject.taskAssignment.uid === 'unstaffedUID'
    || modelObject.internalName ) {
        return false;
    }
    return true;
};

/**
 * Get all assignment info for non DP based task template.
 *
 * @param {Object} assignmentData Assignment Data object
 * @param {Object} taskAssignmentDataObject Task based assignment object that hold all assignment information
 *
 * @returns {Array} Task based assignment array that have info for each task and corresponding assignments
 */
var _getTaskNonDPBasedAssignments = function( assignmentData, taskAssignmentDataObject ) {
    var taskBasedAssignmentInfo = [];
    var attachmentType = [];
    if( !taskAssignmentDataObject ) {
        return [];
    }
    var tempTaskAssignmentObject = taskAssignmentDataObject;
    var updatedTaskUids = assignmentData.updatedTaskObjects;
    var updatedTaskObjects = [];
    _.forEach( updatedTaskUids, function( taskUid ) {
        var taskObject = cdm.getObject( taskUid );
        if( taskObject ) {
            updatedTaskObjects.push( taskObject );
        }
    } );
    tempTaskAssignmentObject = workflowAssignmentSvc.populateAssignmentFullTableRowData( tempTaskAssignmentObject, updatedTaskObjects, true );
    for( var taskId in tempTaskAssignmentObject.taskInfoMap ) {
        var taskObject = tempTaskAssignmentObject.taskInfoMap[ taskId ];
        var taskTemplate = taskId;
        var members = null;
        var action = null;
        var profiles = null;
        var origins = null;
        // Iterate for each proerpty present for task assignment
        for( var propName in taskObject.props ) {
            var currentAction;
            var currentProfile;
            var assignmentObjects = taskObject.props[ propName ].modelObjects;
            // Check if assignemnt objects are invalid then no need to process further
            if( !assignmentObjects || assignmentObjects.length <= 0 ) {
                continue;
            }

            // Iterate for all assignment objects and find out the individual assignment and populate
            // all required properties for that assignment
            for( var idx = 0; idx < assignmentObjects.length; idx++ ) {
                var modelObject = assignmentObjects[ idx ];
                // If it's invalid task assignment then no need to process this assignment
                if( !_isValidTaskAssignment( modelObject ) ) {
                    continue;
                }

                // Populate the member that need to be assigned
                if( !members ) {
                    var uid = modelObject.taskAssignment.uid;
                    // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                    // resource pools added to one aw-list component then because of uid check in component, there
                    // is one issue to render it correctly. So to handle it we update the uid with some random number
                    // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                    if( modelObject.taskAssignment.uniqueUid ) {
                        uid = modelObject.taskAssignment.uniqueUid;
                    }
                    members = uid;
                } else {
                    var tempUid = modelObject.taskAssignment.uid;
                    // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                    // resource pools added to one aw-list component then because of uid check in component, there
                    // is one issue to render it correctly. So to handle it we update the uid with some random number
                    // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                    if( modelObject.taskAssignment.uniqueUid ) {
                        tempUid = modelObject.taskAssignment.uniqueUid;
                    }
                    members = members + '|' + tempUid;
                }

                // Populate the origin that need to be assigned
                var originId = _getAssignmentOrigin( modelObject );
                if( !origins ) {
                    origins = originId;
                } else {
                    origins = origins + '|' + originId;
                }

                // Based on assignment type, we need to populate profile and action and that
                // will be used further
                switch ( modelObject.assignmentType ) {
                    case 'assignee': {
                        currentAction = 0;
                        currentProfile = 'AAAAAAAAAAAAAA';
                        break;
                    }
                    case 'notifyees': {
                        currentAction = 3;
                        currentProfile = 'AAAAAAAAAAAAAA';
                        break;
                    }
                    case 'acknowledgers': {
                        currentAction = 2;
                        currentProfile = _getProfileObjectUid( modelObject );
                        break;
                    }
                    case 'reviewers': {
                        currentAction = 1;
                        currentProfile = _getProfileObjectUid( modelObject );
                    }
                }
                if( action === null ) {
                    action = currentAction;
                } else {
                    action = action + '|' + currentAction;
                }
                if( !profiles ) {
                    profiles = currentProfile;
                } else {
                    profiles = profiles + '|' + currentProfile;
                }
            }
        }
        // Check if all values are present then only we need to create task info and add it as attachment type
        // so that these resources can be assigned
        if( taskTemplate && members && profiles && action !== null && origins ) {
            var tasksInfo = taskTemplate + ',{' + members + '},' + '{' + profiles + '}' + ',{' + action + '}' + ',{' + origins + '}';
            taskBasedAssignmentInfo.push( tasksInfo );
            attachmentType.push( 200 );
        }
    }
    return _getTaskDPBasedAssignments( tempTaskAssignmentObject, attachmentType, taskBasedAssignmentInfo );
};

/**
 * Get all assignment info for DP based task template.
 *
 *
 * @param {Object} taskAssignmentDataObject Assignment data object
 * @param {Object} attachmentTypes Attachment type object
 * @param {Object} taskBasedAssignmentInfo Task based assignment object that hold all assignment information
 *
 * @returns {Object} DP based assignment info obejct
 */
var _getTaskDPBasedAssignments = function( taskAssignmentDataObject, attachmentTypes, taskBasedAssignmentInfo ) {
    var attachmentType = _.clone( attachmentTypes );
    var localTaskBasedAssignmentInfo = _.clone( taskBasedAssignmentInfo );
    var participantInfoMap = taskAssignmentDataObject.participantInfoMap;
    if( !participantInfoMap || _.isEmpty( participantInfoMap ) ) {
        return{
            taskBasedAssignmentInfo : localTaskBasedAssignmentInfo,
            attachmentType: attachmentType
        };
    }
    for( var participantName in participantInfoMap ) {
        var assigneeObjects = participantInfoMap[participantName].assignees;
        var dpAssignment = participantName;
        if( assigneeObjects && assigneeObjects.length > 0 ) {
            _.forEach( assigneeObjects, function( assignee ) {
                if( assignee && assignee.taskAssignment && assignee.taskAssignment.uid && assignee.taskAssignment.uid !== 'unstaffedUID' ) {
                    var uid = assignee.taskAssignment.uid;
                    // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                    // resource pools added to one aw-list component then because of uid check in component, there
                    // is one issue to render it correctly. So to handle it we update the uid with some random number
                    // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                    if( assignee.taskAssignment.uniqueUid ) {
                        uid =  assignee.taskAssignment.uniqueUid;
                    }
                    dpAssignment += ',' + uid;
                }
            } );
        }
        localTaskBasedAssignmentInfo.push( dpAssignment );
        attachmentType.push( 100 );
    }
    return {
        taskBasedAssignmentInfo : localTaskBasedAssignmentInfo,
        attachmentType: attachmentType
    };
};

/**
 * This method will fetch the PAL List and return it to SOA.
 * @param {object} assignmentData - data
 * @returns {String} PALList
 */
export let getProcessAssignmentList = function( assignmentData ) {
    // LCS-758239 - Process Assignment list Review Quorum is not working in AW
    // Need to pass Assignment List name in order to process quorum correctly on server side
    if( assignmentData &&  assignmentData.selectedPals &&  assignmentData.selectedPals.length > 0 ) {
        return assignmentData.selectedPals[0].props.object_string.dbValues[0];
    }
    return '';
};

/**
 * Reset the submitActionInProgress value if its true so that submit button can be enabled if panel is not
 * closed
 *
 * @param {Object} subPanelContext - Context object
 *
 */
export let resetValue = function( subPanelContext ) {
    // Check if data is not null and submit action in progress value is true
    // then only reset it to false
    exports.updateWorkflowContextInfo( subPanelContext, 'submitActionInProgress', false );
};

/**
 * Check input error code is to be ignore or not
 *
 * @param {object} errCode - the error code that needs to be check
 * @return {boolean} - True if error code needs to be ignored else false
 */
var _isIgnoreErrorCode = function( errCode ) {
    if( errCode === 214000 ) {
        return true;
    }
    if( errCode === 33086 || errCode === 33083 || errCode === 33084 || errCode === 33085 ) {
        return true;
    }
    return false;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the
 * correct errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @param {object} subPanelContext - the context object
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnNewWorkflowProcess = function( response, subPanelContext ) {
    var err = null;
    var message = '';

    // Check if input response is not null and contains partial errors then only
    // create the error object
    if( response && ( response.ServiceData.partialErrors || response.ServiceData.PartialErrors ) ) {
        err = soaSvc.createError( response );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if( err && err.cause && err.cause.ServiceData.partialErrors ) {
        _.forEach( err.cause.ServiceData.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code && !_isIgnoreErrorCode( errVal.code ) ) {
                        if( message && message.length > 0 ) {
                            message += ' </br>' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                } );
            }
        } );
    }

    return message;
};

/**
 * Returns the task UID for sub process need to be created. Like if user selected
 * Signoff object then get the parent task and retutn that parent task uid.
 * @param {Object} selected Selected object from UI
 *
 * @returns {String} Returns the selected task uid for subprocess creation
 */
export let getDependentTaskObject = function( selected ) {
    var taskObject = awp0InboxUtils.getTaskObject( selected );
    if( taskObject ) {
        return taskObject.uid;
    }
    return '';
};


/**
 * Parse the input response object and get all types that can be submit to workflow
 * and based on that get the fnd0InternalName and return it as string seperated by ,.
 * This is needed to show all types in pallete or search tab.
 *
 * @param {Object} response Response object that will contain all submittable types
 *
 * @returns {String} Submittable type string seperated by ','
 */
export let getSubmittableObjectTypes = function( response ) {
    var allowedTypes = [];
    if( response && response.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( var i = 0; i < searchResults.objects.length; i++ ) {
                var uid = searchResults.objects[ i ].uid;
                var typeObject = response.ServiceData.modelObjects[ uid ];
                if( typeObject && typeObject.props.fnd0InternalName &&
                    typeObject.props.fnd0InternalName.dbValues && typeObject.props.fnd0InternalName.dbValues[ 0 ] ) {
                    var internalName = typeObject.props.fnd0InternalName.dbValues[ 0 ];
                    if( internalName && internalName !== '' ) {
                        allowedTypes.push( internalName );
                    }
                }
            }
        }
    }
    var allowedTypeString = 'ItemRevision';
    if( allowedTypes && allowedTypes.length > 0 ) {
        allowedTypeString = allowedTypes.join( ',' );
    }
    return allowedTypeString;
};

/**
 * Get the workflow process target that are already attached to selected process.
 * @param {Object} response Response object
 *
 * @returns {Array} Process target array
 */
export let getWorkflowProcessTargets = function( response ) {
    // This is mainly being used in create ahdoc sub process case right now. Will rework when
    // we do that use case.
    var processTargets = [];
    if( !response || !response.searchResultsJSON ) {
        return processTargets;
    }
    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
    if( !searchResults || !searchResults.objects || searchResults.objects.length <= 0 ) {
        return processTargets;
    }
    _.forEach( searchResults.objects, function( searchResult ) {
        var modelObject = response.ServiceData.modelObjects[ searchResult.uid ];
        if( modelObject && modelObject.type === 'Awp0XRTObjectSetRow' ) {
            var targetObj = _.get( modelObject, 'props.awp0Target' );
            if( targetObj && targetObj.dbValues && targetObj.dbValues[ 0 ] ) {
                var underlyingObject = cdm.getObject( targetObj.dbValues[ 0 ] );
                if( underlyingObject ) {
                    processTargets.push( underlyingObject );
                }
            }
        } else if( modelObject ) {
            processTargets.push( targetObj );
        }
    } );

    return processTargets;
};


var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Reset the user picker panel context when user is going out from Assignments tab to other tab. So
 * when assignment tab view is getting unloaded then we reset the user picker panel context as well.
 *
 * @param {Object} userPanelContext User panel context object which store the additional search criteria
 *        for user picker panel
 */
export let resetUserPanelContext = function( userPanelContext ) {
    if( userPanelContext && userPanelContext.value ) {
        const localContext = { ...userPanelContext.value };
        localContext.additionalSearchCriteria = {};
        localContext.selectedObjects = [];
        localContext.profileObject = null;
        localContext.profileUid = '';
        localContext.participantType = null;
        userPanelContext.update && userPanelContext.update( localContext );
    }
};

/**
 * Update the active view on input shared data object.
 *
 * @param {Object} sharedData Shared data that need to be updated with active view
 * @param {String} destPanelId Active view that need to be set.
 *
 * @returns {Object} Updated shared data object
 */
export const resetActiveView = ( sharedData, destPanelId ) => {
    const newSharedData = _.clone( sharedData );
    newSharedData.activeView = destPanelId;
    return newSharedData;
};

/**
 * Update the active view on input shared data object.
 *
 * @param {Object} sharedData Shared data that need to be updated with active view
 * @param {String} destPanelId Active view that need to be set.
 *
 * @returns {Object} Updated shared data object
 */
export const updateParentComponentAtomicData = ( atomicObj, value ) => {
    let newAtomicObj = { ...atomicObj };
    if( atomicObj && value ) {
        for( const key of Object.keys( value ) ) {
            newAtomicObj[ key ] = value[ key ];
        }
    }
    return newAtomicObj;
};

/**
 * Update the input user panel state based on view mode. If view mode is mobile then we
 * need to set isAddButtonNeeded to true so that we can show add button in narrow mode.
 *
 * @param {String} sideNavMode Side nav mode string
 * @param {Object} addUserPanelState User panel state object
 * @returns {Object} Updated user panel state object.
 */
export let updateSideNavUserPanelState = function( sideNavMode, addUserPanelState ) {
    if( sideNavMode && addUserPanelState ) {
        const userPanelState = { ...addUserPanelState };
        let isAddButtonNeeded = false;
        if( sideNavMode === 'mobile' ) {
            isAddButtonNeeded = true;
        }
        userPanelState.isAddButtonNeeded = isAddButtonNeeded;
        // Reset the propName to empty string when we are chaing the sideNavMode
        userPanelState.propName = '';
        return userPanelState;
    }
    return addUserPanelState;
};
/**
 * get the targetObjects from embedded component ctx or from the panelContext
 *
 * @param {Object} panelContext panels context object
 * @returns {Object} targetObjects
 */
export let getTargetObjects = function() {
    let targetObjects = [];
    let workflowProcessCandidates = appCtxSvc.getCtx( 'workflow_process_candidates' );
    if ( workflowProcessCandidates && workflowProcessCandidates.workFlowObjects ) {
        var targetViewModelObjects = workflowProcessCandidates.workFlowObjects;
        _.forEach( targetViewModelObjects, function( vmo ) {
            targetObjects.push( vmo );
        } );
    }

    return targetObjects;
};


export default exports = {
    sendEventToHost,
    getWorkflowTemplatesData,
    setPanelInitialValues,
    getAllowAlternateProcedurePrefValue,
    updateTemplateContextInfo,
    updateWorkflowContextInfo,
    updateContextAssignmentInfo,
    populateAlternateProcedureProp,
    populatePanelData,
    getUids,
    getAttachmentTypes,
    getProcessAssignmentList,
    resetValue,
    populateErrorMessageOnNewWorkflowProcess,
    getDependentTaskObject,
    getSubmittableObjectTypes,
    getWorkflowProcessTargets,
    resetUserPanelContext,
    resetActiveView,
    updateSideNavUserPanelState,
    updateParentComponentAtomicData,
    getTargetObjects
};
