// Copyright (c) 2022 Siemens

/**
 * This implements the workflow template form handler related methods.
 *
 * @module js/Awp0WorkflowTemplateFormService
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

var parentData = null;

/**
 * Create the form handler view model object.
 * @param {Object} data Data view model object
 * @param {Array} columns table columns present in notification table
 * @param {Object} selection Handler obejct for table need to be displayed
 * @param {Object} handlerObjectStructure Obejct that will contain all handler related informaiton
 *
 * @returns {Object} Create Handler VMO object
 */
var _addHandlerArgumentRowVMOObject = function( data, columns, selection, handlerObjectStructure ) {
    var vmObject = viewModelObjectService.constructViewModelObjectFromModelObject( selection, 'Edit' );
    // Iterate for all column info variables and populate the properties on VMO object
    _.forEach( columns, function( tableColumn ) {
        var dbValue = handlerObjectStructure[ tableColumn.name ].propInternalValue;
        var dispValue = handlerObjectStructure[ tableColumn.name ].propDispValue;
        if( dbValue && dispValue ) {
            var vmProp = null;

            var dbValues = [ dbValue ];
            var displayValues = [ dispValue ];

            // Create the key role property
            vmProp = uwPropertySvc.createViewModelProperty( tableColumn.name, tableColumn.displayName,
                'STRING', dbValue, displayValues );
            vmProp.dbValues = dbValues;
            vmProp.uiValues = displayValues;

            vmProp.propertyDescriptor = {
                displayName: tableColumn.displayName
            };
            vmObject.props[ tableColumn.name ] = vmProp;
        }
    } );
    // Check if handler objects present then set it on view model object
    if( handlerObjectStructure.handlerObjects ) {
        vmObject.handlerObjects = handlerObjectStructure.handlerObjects;
    }
    // If rule handler is presnet then only set it on view model object
    if( handlerObjectStructure.ruleHandler ) {
        vmObject.ruleHandler = handlerObjectStructure.ruleHandler;
    }
    return vmObject;
};

/**
 * Populate the form type column value based on input handler and where it's attached
 * @param {Array} handlerArgumentValues Handler argument value array
 *
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateFormTypeColumn = function( handlerArgumentValues ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler name is late notification then directly set the dispaly value as past due
    if( handlerArgumentValues && handlerArgumentValues[ '-type' ] ) {
        // Check if handler name is notify report and -report argumetn present then read that value and based
        // on that value get the dispaly value from locale and return
        var formTypeInternalValue = handlerArgumentValues[ '-type' ];
        propInternalValue = formTypeInternalValue;
        propDispValue = formTypeInternalValue;
    }

    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Populate the description column value based on input handler arguments
 * @param {Array} handlerArgumentValues Handler argument value array
 *
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateDescriptionColumn = function( handlerArgumentValues ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler arguemnt present the subject as value then populate it else return null
    if( handlerArgumentValues && handlerArgumentValues[ '-description' ] ) {
        propInternalValue = handlerArgumentValues[ '-description' ];
        propDispValue = handlerArgumentValues[ '-description' ];
    }
    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Populate the target column value based on input handler arguments
 * @param {Object} data data Declarative view model object
 * @param {Array} handlerArgumentValues Handler argument value array
 *
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateTargetColumn = function( data, handlerArgumentValues ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler arguemnt present the subject as value then populate it else return null
    if( handlerArgumentValues && handlerArgumentValues[ '-target_task' ] ) {
        propInternalValue = handlerArgumentValues[ '-target_task' ];
        if( propInternalValue === '$ROOT.$TARGET' ) {
            propDispValue = data.i18n.target;
        } else if( propInternalValue === '$ROOT.$REFERENCE' ) {
            propDispValue = data.i18n.reference;
        }
    }
    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Populate the form name value
 * @param {Object} handlerArgumentValues Handler arguemn object that will contain all handler arguments
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateFormNameColumn = function( handlerArgumentValues ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler arguemnt present the name as value then populate it else return null
    if( handlerArgumentValues && handlerArgumentValues[ '-name' ] ) {
        propInternalValue = handlerArgumentValues[ '-name' ];
        propDispValue = handlerArgumentValues[ '-name' ];
    }
    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Get the EPM hold rule handler for selected template object
 * @param {Object} templateObject Selected template object
 */
var _getEPMHoldRuleHandler = function( templateObject ) {
    if( !templateObject || !templateObject.props.complete_action_rules || !templateObject.props.complete_action_rules.dbValues ) {
        return null;
    }
    var completeRuleObjects = templateObject.props.complete_action_rules.dbValues;
    var epmHoldRuleHandler = null;
    // Get all rule objects for complete action and in complete try to find out the
    // EPM hold rule handler and use that handler for delete case.
    if( completeRuleObjects && completeRuleObjects.length > 0 ) {
        for( var idx = 0; idx < completeRuleObjects.length; idx++ ) {
            var ruleObject = clientDataModel.getObject( completeRuleObjects[ idx ] );
            if( ruleObject && ruleObject.props.rule_handlers && ruleObject.props.rule_handlers.dbValues ) {
                var ruleHandlers = ruleObject.props.rule_handlers.dbValues;
                if( ruleHandlers && ruleHandlers.length > 0 ) {
                    for( var ruleIdx = 0; ruleIdx < ruleHandlers.length; ruleIdx++ ) {
                        var ruleHandlerObject = clientDataModel.getObject( ruleHandlers[ ruleIdx ] );
                        if( ruleHandlerObject && ruleHandlerObject.props.object_string.dbValues &&
                            ruleHandlerObject.props.object_string.dbValues[ 0 ] === 'EPM-hold' ) {
                            epmHoldRuleHandler = ruleHandlerObject;
                            break;
                        }
                    }
                    // Check if epm Holder handler is not null then only check if rule object has only one handler then
                    // reset the value of epmHoldRuleHandler to rule obejct so that we need to delete the rule itself in delete case
                    // else if rule handler have multiple handlers then we need to delete the rule handler only.
                    if( epmHoldRuleHandler ) {
                        if( ruleObject && ruleObject.props.rule_handlers.dbValues.length === 1 ) {
                            epmHoldRuleHandler = ruleObject;
                        }
                        break;
                    }
                }
            }
        }
    }
    return epmHoldRuleHandler;
};

/**
 * Add handler argument row in handler argument table
 * @param {Object} data Data view model object
 * @param {Array} columns Array that is being shown in table
 * @param {Object} selection Selected handler object for handler info needs to be populated
 * @param {String} handlerName Handler name string
 * @param {Array} displayFormHandlers All display form handlers for selected template
 * @returns {Object} Create VMO object to show handler arguments
 * @param {Object} templateObject Template object for information need to be populated
 */
export let getHandlerRows = function( data, columns, selection, handlerName, displayFormHandlers, templateObject ) {
    var argumentRows = [];
    // Check if input handler object don't have properties loaded then no need to process further and
    // return from here
    if( !selection || !selection.props || !selection.props.arguments || !selection.props.arguments.dbValues ) {
        return argumentRows;
    }
    var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( selection.props.arguments.dbValues[ 0 ] );
    var handlerObjectStructure = {
        formName: { propInternalValue: '', propDispValue: '' },
        formType: { propInternalValue: '', propDispValue: '' },
        description: { propInternalValue: '', propDispValue: '' },
        target: { propInternalValue: '', propDispValue: '' }
    };

    var displayForm = null;
    // Find the matching display form handler from create form handler
    if( displayFormHandlers && displayFormHandlers.length > 0 ) {
        for( var idx = 0; idx < displayFormHandlers.length; idx++ ) {
            var displayFormArgumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( displayFormHandlers[ idx ].props.arguments.dbValues[ 0 ] );
            if( displayFormArgumentValues && displayFormArgumentValues[ '-type' ] === argumentValues[ '-type' ] ) {
                displayForm = displayFormHandlers[ idx ];
                break;
            }
        }
    }
    var handlerObjects = [];
    // Add the handler selections to array that need to be set on handler object so that
    // both handler info can be consolidated at one place.
    handlerObjects.push( selection );
    if( displayForm ) {
        handlerObjects.push( displayForm );
    }

    // Get the EPM-hold rule handler and add to the handler object.
    var epmHoldHandler = _getEPMHoldRuleHandler( templateObject );

    // Set the handler objects
    handlerObjectStructure.handlerObjects = handlerObjects;
    // If epm hold handler present then set it on handler structure that will be used in delete case
    if( epmHoldHandler ) {
        handlerObjectStructure.ruleHandler = epmHoldHandler;
    }

    handlerObjectStructure.formType = _populateFormTypeColumn( argumentValues );
    handlerObjectStructure.formName = _populateFormNameColumn( argumentValues );
    handlerObjectStructure.description = _populateDescriptionColumn( argumentValues );
    handlerObjectStructure.target = _populateTargetColumn( data, argumentValues );
    if( handlerObjectStructure ) {
        var vmObject = _addHandlerArgumentRowVMOObject( data, columns, selection, handlerObjectStructure );
        vmObject.handlerObject = selection;
        vmObject.handlerName = handlerName;
        argumentRows.push( vmObject );
    }
    return argumentRows;
};

/**
 * Update the input data provider based on selection for other handlers
 *
 * @param {Object} data Data view model object
 * @param {Object} selection template object for handler need to be populated
 * @param {Object} dataProvider Data provider object that needs to be updated
 * @param {Array} formHandlerContext Form handler context object if handler object is selected from table
 *
 * @returns {Object} Table result object
 */
export let populateFormTableData = function( data, selection, dataProvider, formHandlerContext ) {
    parentData = data;
    var argumentRows = [];
    var templateObject = clientDataModel.getObject( selection.uid );

    // Get the attached handler objects for specifc input handler name
    var actionHandlerArray = Awp0WorkflowDesignerUtils.getActionHandler( templateObject, 'EPM-create-form' );

    var displayFormHandlers = Awp0WorkflowDesignerUtils.getActionHandler( templateObject, 'EPM-display-form' );

    // Iterate for all handler obejcts and add the rows for that handler
    _.forEach( actionHandlerArray, function( actionHandler ) {
        var argValues = exports.getHandlerRows( data, data.columnProviders.tableColumnProvider.columns, actionHandler,
            'EPM-create-form', displayFormHandlers, templateObject );
        argumentRows = argumentRows.concat( argValues );
    } );

    // Create the table result data and return to dispaly on UI.
    var loadResult = tableDPReqRespHelper.createTableLoadResult( argumentRows );
    loadResult.searchResults = argumentRows;
    loadResult.searchIndex = 0;
    loadResult.totalFound = argumentRows.length;
    dataProvider.update( argumentRows, argumentRows.length );

    const localContext = { ...formHandlerContext };
    localContext.loadedVMOObjects = argumentRows;
    localContext.selectedTemplateObject = data.selectedTemplateObject;
    localContext.isTemplateEditable = data.isTemplateEditable;
    localContext.rootTaskTemplateObject = data.rootTaskTemplateObject;
    localContext.selectedObjects = [];
    loadResult.formHandlerContext = localContext;
    return {
        tableResult: loadResult,
        formHandlerContext : localContext
    };
};

/**
 * Check when user is selecting any row in form table and Add or show panel is open then close the panel
 * @param {Object} ctx Context object to check if panel is already open or not
 * @param {Array} selectedRows Selected rows from UI form table
 * @param {Object} formHandlerContext Handler context object that stores context info.
 *
 * @returns {Object} Updated form handler context object
 */
export let formHandlerRowSelection = function( ctx, selectedRows, formHandlerContext ) {
    if( ctx.activeToolsAndInfoCommand && (
        ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowAddFormHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowShowFormHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowEditFormHandler' ) ) {
        eventBus.publish( 'closePanel' );
    }
    const localContext = { ...formHandlerContext };
    localContext.selectedObjects = selectedRows;
    return localContext;
};

export let getRemoveFormHandlerObjects = function( context ) {
    var deleteObjects = [];
    if( !context || !context.handlerObjects ) {
        return deleteObjects;
    }
    Array.prototype.push.apply( deleteObjects, context.handlerObjects );
    if( context.ruleHandler ) {
        deleteObjects.push( context.ruleHandler );
    }
    return deleteObjects;
};

export default exports = {
    getHandlerRows,
    populateFormTableData,
    formHandlerRowSelection,
    getRemoveFormHandlerObjects
};
