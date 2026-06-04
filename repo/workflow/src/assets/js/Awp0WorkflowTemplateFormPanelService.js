// Copyright (c) 2022 Siemens

/**
 * This implements the workflow template notifications related methods.
 *
 * @module js/Awp0WorkflowTemplateFormPanelService
 */
import cdm from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import _ from 'lodash';

var exports = {};

const DESCRIPTION_HANDLER_ARGUMENT = '-description';
const TARGET_TASK_HANDLER_ARGUMENT = '-target_task';
const SOURCE_TASK_HANDLER_ARGUMENT = '-source_task';
const NAME_HANDLER_ARGUMENT = '-name';
const TYPE_HANDLER_ARGUMENT = '-type';
const EPM_DISPLAY_FORM_HANDLER = 'EPM-display-form';
const EPM_CREATE_FORM_HANDLER = 'EPM-create-form';

/**
 * This method is used to get the LOV values for the release status list.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getFormTypeList = function( response ) {
    var formTypeList = [];
    _.forEach( response.searchResults, function( searchResults ) {
        if( searchResults ) {
            var statusObject = cdm.getObject( searchResults.uid );
            var object = {
                propDisplayValue: statusObject.props.object_string.uiValues[ 0 ],
                propDisplayDescription: '',
                propInternalValue: statusObject.props.object_string.dbValues[ 0 ]
            };

            formTypeList.push( object );
        }
    } );
    // Sort the release status list by default with dispaly name
    formTypeList = _.sortBy( formTypeList, 'propDisplayValue' );
    return formTypeList;
};

/**
 * Populate the panel otpions based on handler selection. If handler is selected then only process further
 * to show the values based on selected handler
 * @param {Object} data Data view model object
 * @param {Object} handlerContextObject Selected handler context object that will contian all recipient options
 * @param {boolean} isEditable True or false based on panel is editable or not.
 *
 * @returns {Object} Update form UI prop widgets
 */
var _populateHandlerOptions = function( data, handlerContextObject, isEditable ) {
    const localFormTypesList = { ...data.formTypesList };
    const localFormDescription = { ...data.formDescription };
    const localFormTargetList = { ...data.formTargetList };
    const localFormName = { ...data.formName };
    var argumentValues = null;

    localFormTypesList.isEditable = isEditable;
    localFormDescription.isEditable = isEditable;
    localFormTargetList.isEditable = isEditable;
    localFormName.isEditable = isEditable;

    // Set the notify when option value based on select handler object and set the edit state
    if( handlerContextObject && handlerContextObject.props && handlerContextObject.props.formType
        && handlerContextObject.props.formType.dbValue && handlerContextObject.props.formType.uiValue ) {
        localFormTypesList.dbValue = handlerContextObject.props.formType.dbValue;
        localFormTypesList.uiValue = handlerContextObject.props.formType.uiValue;

        // Get all handler arguments from handler object and based on values update the UI.
        argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( handlerContextObject.handlerObject.props.arguments.dbValues );
    }

    if( argumentValues ) {
        // Check if comment arguemnt present then set the message value
        if( argumentValues[ DESCRIPTION_HANDLER_ARGUMENT ] ) {
            localFormDescription.dbValue = argumentValues[ DESCRIPTION_HANDLER_ARGUMENT ];
            localFormDescription.uiValue = argumentValues[ DESCRIPTION_HANDLER_ARGUMENT ];
        }
        // Check if subject arguemnt present then set the subject value
        if( argumentValues[ TARGET_TASK_HANDLER_ARGUMENT ] && data.formTargetValues ) {
            var targetTaskValue = argumentValues[ TARGET_TASK_HANDLER_ARGUMENT ];
            var selectedTargetLOV = _.find( data.formTargetValues, function( formTarget ) {
                return formTarget.propInternalValue === targetTaskValue;
            } );
            if( selectedTargetLOV ) {
                localFormTargetList.dbValue = selectedTargetLOV.propInternalValue;
                localFormTargetList.uiValue = selectedTargetLOV.propDisplayValue;
            }
        }
        if( argumentValues[ NAME_HANDLER_ARGUMENT ] ) {
            localFormName.dbValue = argumentValues[ NAME_HANDLER_ARGUMENT ];
            localFormName.uiValue = argumentValues[ NAME_HANDLER_ARGUMENT ];
        }
    }
    return {
        isPanelEditable : isEditable,
        formTypesList : localFormTypesList,
        formDescription : localFormDescription,
        formTargetList : localFormTargetList,
        formName : localFormName
    };
};

/**
 * Populate the panel with all relevant information that need to be shown.
 * @param {Object} data Data view model object
 * @param {Object} rootTaskTemplateObject Root task template object
 * @param {Object} handlerContextObject Handler context object if we are trying to update handler
 * @param {Object} workflowDgmEditCtx Workflow diagram edit context that hold all editable tempaltes
 *
 * @returns {Object} Object with all updated widget and other info
 */
export let populatePanelData = function( data, rootTaskTemplateObject, handlerContextObject, workflowDgmEditCtx ) {
    // Get the tempalte is in edit mode or not and based on that populate the panel.
    var isPanelEditable = false;
    if( rootTaskTemplateObject && workflowDgmEditCtx && workflowDgmEditCtx.editObjectUids
        && workflowDgmEditCtx.editObjectUids.indexOf( rootTaskTemplateObject.uid ) > -1 ) {
        isPanelEditable = true;
    }
    // Populate the UI widgets and return
    return _populateHandlerOptions( data, handlerContextObject, isPanelEditable );
};

/**
 * Create or update case set the values in input additional data
 * @param {Object} data Data view model object
 * @param {Object} additinalData Additianl data that will contain all handler arguments to set
 * @param {boolean} isDisplayForm Display form case or not. Contains true or false value
 */
var _createOrUpdateFormHandlerInputData = function( data, additinalData, isDisplayForm ) {
    additinalData[ TYPE_HANDLER_ARGUMENT ] = [ data.formTypesList.dbValue ];

    // In case of dispaly form we need to add source_task and in create form case it should be target_task.
    if( isDisplayForm ) {
        additinalData[ SOURCE_TASK_HANDLER_ARGUMENT ] = [ data.formTargetList.dbValue ];
    } else {
        if( data.formDescription.dbValue || data.formDescription.dbValue === '' ) {
            additinalData[ DESCRIPTION_HANDLER_ARGUMENT ] = [ data.formDescription.dbValue ];
        }

        if( data.formName.dbValue || data.formName.dbValue === '' ) {
            additinalData[ NAME_HANDLER_ARGUMENT ] = [ data.formName.dbValue ];
        }

        additinalData[ TARGET_TASK_HANDLER_ARGUMENT ] = [ data.formTargetList.dbValue ];
    }
};

/**
 * Create the input structure for late notification handler
 * @param {Object} data Data view model object
 *
 * @param {Object} selected Selected template object from UI
 * @param {Object} handlerContextObject If user selected any handler form notification table then contian that
 *                 handler object else null
 *
 * @returns {Array} Create or update handler SOA input structure array
 */
var _getUpdateOrCreateHandlerInput = function( data, selected, handlerContextObject ) {
    var input = [];
    // Check if handler context is not null that means it's update handler case
    // otherwise it will be create handler case
    if( handlerContextObject && handlerContextObject.handlerObjects ) {
        _.forEach( handlerContextObject.handlerObjects, function( handlerObject ) {
            var updateAdditionalData = {};
            if( handlerObject.props && handlerObject.props.handler_name && handlerObject.props.handler_name.dbValues &&
                handlerObject.props.handler_name.dbValues[ 0 ] ) {
                var isDisplayForm = false;
                var handlerName = handlerObject.props.handler_name.dbValues[ 0 ];
                if( handlerName === EPM_DISPLAY_FORM_HANDLER ) {
                    isDisplayForm = true;
                }
                _createOrUpdateFormHandlerInputData( data, updateAdditionalData, isDisplayForm );

                // Update the addiitonal data if handler has some other arguemtns defiend. This is needed
                // as server replace the all arguemnts from handler based on passed arguments.
                Awp0WorkflowDesignerUtils.updateAdditionalDataWithOtherArguments( handlerObject, updateAdditionalData );

                var updateObject = {
                    clientID: 'updateHandler -' + handlerObject.uid,
                    handlerToUpdate: handlerObject.uid,
                    additionalData: updateAdditionalData
                };
                input.push( updateObject );
            }
        } );
    } else {
        var createFormAdditionalData = {};
        _createOrUpdateFormHandlerInputData( data, createFormAdditionalData, false );
        var createFormObject = {
            clientID: 'createHandler -CreateForm' + selected.uid,
            handlerName: EPM_CREATE_FORM_HANDLER,
            taskTemplate: selected.uid,
            handlerType: 'Action',
            action: 2,
            additionalData: createFormAdditionalData
        };
        input.push( createFormObject );

        var displayFormAdditionalData = {};
        _createOrUpdateFormHandlerInputData( data, displayFormAdditionalData, true );

        var dispalyFormObject = {
            clientID: 'createHandler -DisplayForm' + selected.uid,
            handlerName: EPM_DISPLAY_FORM_HANDLER,
            taskTemplate: selected.uid,
            handlerType: 'Action',
            action: 100,
            additionalData: displayFormAdditionalData
        };
        input.push( dispalyFormObject );

        var epmHoldRuleHandlerObject = {
            clientID: 'createHandler -epmHold' + selected.uid,
            handlerName: 'EPM-hold',
            taskTemplate: selected.uid,
            handlerType: 'Rule',
            action: 4
        };
        input.push( epmHoldRuleHandlerObject );
    }
    return input;
};

/**
 * Create the create or update handler input based on user action and return the input structure.
 *
 * @param {Object} data Data view model object
 * @param {Object} selected Selected template object from UI
 * @param {Object} selectedHandlerContext If user selected any handler form notification table then contian that
 *                 handler object else null
 *
 * @returns {Array} Create or update handler SOA input structure array
 */
export let getCreateOrUpdateHandlerInput = function( data, selected, selectedHandlerContext ) {
    return _getUpdateOrCreateHandlerInput( data, selected, selectedHandlerContext );
};

export default exports = {
    getFormTypeList,
    populatePanelData,
    getCreateOrUpdateHandlerInput
};
