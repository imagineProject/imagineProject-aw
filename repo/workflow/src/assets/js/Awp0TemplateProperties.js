// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TemplateProperties
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import Awp0TemplatePropertiesEditService from 'js/Awp0TemplatePropertiesEditService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';
import parsingUtils from 'js/parsingUtils';
import soaSvc from 'soa/kernel/soaService';
import msgSvc from 'js/messagingService';
import dms from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import AwPromiseService from 'js/awPromiseService';

import _ from 'lodash';
import eventBus from 'js/eventBus';

var parentData = null;

/**
 * Define public API
 */
var exports = {};

/**
 * Populate the value and update the widget value with respective value.
 *
 * @param {Object} modelObject Selected Model object
 * @param {String} propName Property name whose value needs to be fetched
 * @param {Object} propDispObject Property widget where value needs to be populated
 * @param {boolean} isBoolean True/False, True will only be for boolean property
 * @param {boolean} isEditable True/False, True when value needs to be in edit or not
 * @param {Object} i18n L10N object that will hold all localization string defined in view model
 */
var _populatePropValue = function( modelObject, propName, propDispObject, isBoolean, isEditable, i18n ) {
    var dbValue = '';
    var uiValue = '';
    let isLocalizable = false;
    if( modelObject && propName && modelObject.props[ propName ] ) {
        var propObject = modelObject.props[ propName ];
        if( propObject.propertyDescriptor ) {
            isLocalizable = Boolean( propObject.propertyDescriptor.constantsMap.localizable );
            propObject.isLocalizable = isLocalizable;
        }
        if( propObject && propObject.dbValues && propObject.dbValues[ 0 ] ) {
            dbValue = propObject.dbValues[ 0 ];

            if( isBoolean ) {
                dbValue = dbValue === '1';
            }
        }

        if( propObject && propObject.uiValues && propObject.uiValues[ 0 ] ) {
            uiValue = propObject.uiValues[ 0 ];
        }
        // For fnd0AsyncPriority default value needs to be set as '1'
        if( propName === 'fnd0AsyncPriority' && propObject.dbValues && propObject.dbValues[0] === null ) {
            dbValue = '1';
            uiValue = '1';
        }

        // This is special handling for fnd0InteractiveTask as server returns the proeprty UI value as 'True'
        // or 'False'. But on UI we need to show as Users or System.
        if( propName === 'fnd0InteractiveTask' && i18n ) {
            uiValue = i18n.userExecution;
            if( !dbValue ) {
                uiValue = i18n.systemExecution;
            }
        }
    }
    if ( propDispObject ) {
        //propDispObject.dbValue = dbValue;
        propDispObject.isLocalizable = isLocalizable;
        propDispObject.dbValue = [ dbValue ];
        propDispObject.dbValues = [ dbValue ];
        propDispObject.uiValues = [ uiValue ];
        propDispObject.displayValues = [ uiValue ];
        propDispObject.uiValue = uiValue;
        propDispObject.isEditable = isEditable;
        propDispObject.isEnabled = isEditable;
        propDispObject.valueUpdated = false;
        propDispObject.displayValueUpdated = false;
        propDispObject.propertyName = propName;
        modelObject.props[ propName ] = propDispObject;
        propDispObject.parentUid = modelObject.uid;
        propDispObject.propInternalName = propName;
    }
};


/**
 * Check if input task type EPMConditionTaskTemplate then populate the condition task properties
 * to show different criteria.
 *
 * @param {Object} data - the data Object
 * @param {Object} selection - the current selection object
 * @param {Boolean} isEditable True/False based on proeprty is editable or not
 */
var _populateConditionTaskTemplateOptions = function( data, vmoObject, isEditable ) {
    data.setConditionHandler = null;
    // if( selection && selection.modelType.typeHierarchyArray.indexOf( 'EPMConditionTaskTemplate' ) <= -1 ) {
    //     return;
    // }

    data.queryScope.isEditable = isEditable;
    data.queryScope.isEnabled = isEditable;
    vmoObject.props.queryScope = data.queryScope;
    data.queryAganist.isEditable = isEditable;
    data.queryAganist.isEnabled = isEditable;
    vmoObject.props.queryAganist = data.queryAganist;
    data.savedQueries.isEditable = isEditable;
    data.savedQueries.isEnabled = isEditable;
    data.savedConditions.isEditable = isEditable;
    data.savedConditions.isEnabled = isEditable;
    vmoObject.props.savedConditions = data.savedConditions;
    data.queryCondition.isEditable = isEditable;
    data.queryCondition.isEnabled = isEditable;
    vmoObject.props.savedQueries = data.savedQueries;
    data.savedQueries.valueUpdated = false;
    data.includeRepliaceTarget.isEditable = isEditable;
    data.includeRepliaceTarget.isEnabled = isEditable;
    vmoObject.props.includeRepliaceTarget = data.includeRepliaceTarget;

    //selection = cdm.getObject( selection.uid );

    data.currentQuery.dbValue = '(' + data.i18n.emptyQuery + ')' + '  [ ' + data.i18n.all + ' ]';
    data.currentQuery.uiValue = '(' + data.i18n.emptyQuery + ')' + '  [ ' + data.i18n.all + ' ]';
    data.currentCondition.dbValue = '(' + data.i18n.emptyQuery + ')' + '  [ ' + data.i18n.all + ' ]';
    data.currentCondition.uiValue = '(' + data.i18n.emptyQuery + ')' + '  [ ' + data.i18n.all + ' ]';
    data.queryScope.dbValue = 'all';
    data.queryAganist.dbValue = 'target';
    data.includeRepliaceTarget.dbValue = false;
    data.savedQueries.dbValue = null;
    data.savedQueries.uiValue = null;
    data.savedConditions.dbValue = null;
    data.savedConditions.uiValue = null;

    // Get the set condition handler and based on argument values update the panel.
    var actionHandlers = Awp0WorkflowDesignerUtils.getActionHandler( vmoObject, 'EPM-set-condition' );
    if( actionHandlers && actionHandlers.length > 0 && actionHandlers[ 0 ] ) {
        var setConditionHandler = actionHandlers[ 0 ];
        data.setConditionHandler = setConditionHandler;
        if( setConditionHandler.props.arguments && setConditionHandler.props.arguments.dbValues &&
            setConditionHandler.props.arguments.dbValues[ 0 ] ) {
            var queryScope = 'all';
            var queryName = null;
            var conditionName = null;
            var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( setConditionHandler.props.arguments.dbValues );
            if( argumentValues[ '-check_targets' ] ) {
                data.queryScope.dbValue = argumentValues[ '-check_targets' ];
                data.queryScope.value = argumentValues[ '-check_targets' ];
                queryScope = data.queryScope.dbValue;
            }

            if( argumentValues[ '-query_type' ] ) {
                data.queryAganist.dbValue = argumentValues[ '-query_type' ];
                data.queryAganist.value = argumentValues[ '-query_type' ];
            }
            data.queryAganist.isEditable = isEditable;
            data.queryAganist.isEnabled = isEditable;

            if( argumentValues[ '-query' ] ) {
                data.savedQueries.dbValue = argumentValues[ '-query' ];
                data.savedQueries.uiValue = argumentValues[ '-query' ];
                data.savedQueries.value = argumentValues[ '-query' ];
                queryName = data.savedQueries.dbValue;
                data.queryCondition.dbValue = 'query';
            }
            if( argumentValues[ '-condition_name' ] ) {
                data.savedConditions.dbValue = argumentValues[ '-condition_name' ];
                data.savedConditions.uiValue = argumentValues[ '-condition_name' ];
                data.savedConditions.value = argumentValues[ '-condition_name' ];
                conditionName = data.savedConditions.dbValue;
                data.queryCondition.dbValue = 'condition';
            }

            data.savedQueries.isEditable = isEditable;
            data.savedQueries.isEnabled = isEditable;

            if( argumentValues.hasOwnProperty( '-include_replica' ) ) {
                data.includeRepliaceTarget.dbValue = true;
                data.includeRepliaceTarget.value = true;
            }

            data.includeRepliaceTarget.isEditable = isEditable;
            data.includeRepliaceTarget.isEnabled = isEditable;

            if( queryScope && queryName && data.i18n[ queryScope ] ) {
                data.currentQuery.dbValue = queryName + '  [ ' + data.i18n[ queryScope ] + ' ]';
                data.currentQuery.uiValue = queryName + '  [ ' + data.i18n[ queryScope ] + ' ]';
            }
            if( queryScope && conditionName && data.i18n[ queryScope ] ) {
                data.condition = conditionName;
                data.currentCondition.dbValue = conditionName + '  [ ' + data.i18n[ queryScope ] + ' ]';
                data.currentCondition.uiValue = conditionName + '  [ ' + data.i18n[ queryScope ] + ' ]';
            }
        }
    }
};

/**
 * Check if input task type EPMAddStatusTaskTemplate then populate the release status.
 *
 * @param {Object} data - the data Object
 * @param {Object} selection - the current selection object
 * @param {Boolean} isEditable True/False based on proeprty is editable or not
 */
var _populateAddStatusTaskTemplateOptions = function( data, selection, isEditable ) {
    data.createStatusHandler = null;
    if( !selection ) {
        return;
    }
    // Reset to default values
    data.releaseStatus.dbValue = null;
    data.releaseStatus.uiValue = '';
    data.releaseStatus.isEditable = isEditable;
    data.releaseStatus.isEnabled = isEditable;

    // Get the set create status handler and based on argument values update the panel.
    var actionHandlers = Awp0WorkflowDesignerUtils.getActionHandler( selection, 'EPM-create-status' );
    if( actionHandlers && actionHandlers.length > 0 && actionHandlers[ 0 ] ) {
        var createStatusHandler = actionHandlers[ 0 ];
        data.createStatusHandler = createStatusHandler;
        if( createStatusHandler.props.arguments && createStatusHandler.props.arguments.dbValues &&
            createStatusHandler.props.arguments.dbValues[ 0 ] ) {
            var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( createStatusHandler.props.arguments.dbValues );
            if( argumentValues[ '-status' ] ) {
                // This code is needed as when user clear the status LOV value from RAC
                // it add -status as null so to handler that case adding this code here.
                if( argumentValues[ '-status' ] === 'null' ) {
                    argumentValues[ '-status' ] = '';
                }
                data.releaseStatus.dbValue = argumentValues[ '-status' ];
                data.releaseStatus.uiValue = argumentValues[ '-status' ];
                data.releaseStatus.handlerUid = data.createStatusHandler.uid;
            }
        }
    }
    data.vmo.props.releaseStatus = data.releaseStatus;
    data.releaseStatus.parentUid = data.vmo.uid;
};

/**
 * Get the epm-create-status handler for selected template is present
 * and return if not present then return null.
 *
 * @return {Object} Handler object or null
 */
export let getEPMCreateStatusHandler = function() {
    if( !appCtxService.ctx || !appCtxService.ctx.selected ) {
        return null;
    }
    var selectedObject = cdm.getObject( appCtxService.ctx.selected.uid );
    // Get the set create status handler and based on argument values update the panel.
    var actionHandlers = Awp0WorkflowDesignerUtils.getActionHandler( selectedObject, 'EPM-create-status' );
    if( actionHandlers && actionHandlers.length > 0 && actionHandlers[ 0 ] ) {
        return actionHandlers[ 0 ];
    }
};

/**
 * Populate the task duration on the panel that needs to be displayed.
 *
 * @param {Object} data - the data Object
 * @param {Object} selection - the current selection object
 * @param {Boolean} isEditable True/False based on proeprty is editable or not
 */
var _populateTaskTemplateDurationData = function( data, selection, isEditable ) {
    if( !selection || !data.taskDuration ) {
        return;
    }
    // Reset to default values
    data.taskDuration.dbValue = '';
    data.taskDuration.uiValue = '';
    data.taskDuration.dispValue = '';
    data.taskDuration.isEditable = isEditable;
    data.taskDuration.isEnabled = isEditable;
    // Set the proeprty on selection so that it can be used in edit handler to check if property is modifeid or not
    selection.props.taskDuration = data.taskDuration;
    data.setDurationHandler = null;

    // Get the set duration handler and based on argument values update the panel.
    var actionHandlers = Awp0WorkflowDesignerUtils.getActionHandler( selection, 'EPM-set-duration' );
    if( actionHandlers && actionHandlers.length > 0 && actionHandlers[ 0 ] ) {
        var setDurationHandler = actionHandlers[ 0 ];
        data.setDurationHandler = setDurationHandler;
        // Get the valid handler arguemtn value and then it handler contians value then parse the
        // value to get only hour value and use that to show on UI.
        if( setDurationHandler.props.arguments && setDurationHandler.props.arguments.dbValues &&
            setDurationHandler.props.arguments.dbValues[ 0 ] ) {
            var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( setDurationHandler.props.arguments.dbValues );
            var hourValue = Awp0WorkflowDesignerUtils.getSetDurationHours( data, argumentValues );
            if( hourValue > 0 ) {
                // Set the valueUpdated to false when rendering the properties panel as this will
                // help to set the correct dbValue on property and shows the correct value on UI
                data.taskDuration.valueUpdated = false;
                // Update the property value
                uwPropertyService.updateModelData( data.taskDuration, hourValue, [ hourValue.toString() ], false, isEditable, isEditable, {} );
            }
        }
    }
};

/**
  * Check if selected template is review, route, acknowledge, Notify, Select signoff or perform signoff then return true or false
  * @param {Object} selectedObject Selected template object from graph
  *
  * @returns {boolean} True/false
  */
var _isReadOnlyInteractiveTaskTemplateSelected = function( selectedObject ) {
    var isReviewAckRouteTaskSelected = false;
    // Check if input is not null and is one of these types then only return true
    if( selectedObject && selectedObject.modelType && selectedObject.modelType.typeHierarchyArray &&
        ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMReviewTaskTemplate' ) > -1
        || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMAcknowledgeTaskTemplate' ) > -1
        || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMRouteTaskTemplate' ) > -1
        || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMSelectSignoffTaskTemplate' ) > -1
        || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMPerformSignoffTaskTemplate' ) > -1
        || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMNotifyTaskTemplate' ) > -1 ) )  {
        isReviewAckRouteTaskSelected = true;
    }
    return isReviewAckRouteTaskSelected;
};

/**
 * Populate the properties on the panel and custom condition paths that needs to be displayed.
 *
 * @param {Object} data - the data Object
 * @param {Object} selection - the current selection object
 * @param {Object} ctx Context object
 */
export let populatePanelData = function( incontextData, selection, ctx ) {
    var selectedObject;
    const data = { ...incontextData };
    //parentData = data;
    if( data && selection && selection.uid && ctx.xrtSummaryContextObject ) {
        var isPanelEditable = Awp0WorkflowDesignerUtils.isTemplateEditMode( ctx.xrtSummaryContextObject, ctx );
        selectedObject = cdm.getObject( selection.uid );
        var vmoObject = viewModelObjectSvc.createViewModelObject( selectedObject.uid );
        // Set the property on selection so that it can be used in edit handler to check if property is modified or not
        data.vmo = vmoObject;
        data.isPanelEditable = isPanelEditable;
        _populatePropValue( vmoObject, 'template_name', data.template_name, false, isPanelEditable );

        var instructionPropName = 'object_desc';
        if( selectedObject.props.fnd0Instructions ) {
            instructionPropName = 'fnd0Instructions';
        }
        // Populate the proeprty value for differnt widget
        _populatePropValue( vmoObject, instructionPropName, data.fnd0Instructions, false, isPanelEditable );

        // Populate the task template type and if in editable then populate the value as task_type
        // property value
        exports.loadValidTaskTemplateTypes( data, vmoObject );
        if( selection.type === 'EPMConditionTaskTemplate' ) {
            _populateConditionTaskTemplateOptions( data, vmoObject, data.isPanelEditable );
        }
        if( selection.type === 'EPMAddStatusTaskTemplate' ) {
            _populateAddStatusTaskTemplateOptions( data, vmoObject, data.isPanelEditable );
        }

        _populatePropValue( vmoObject, 'show_in_process_stage_list', data.showInProcessStage, true, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0ExecuteAsync', data.processBackground, true, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0RequireCompleteConfirm', data.requireTaskConfirmation, true, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0IsPrivilegedTemplate', data.notModifiable, true, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0StoreParticipantsOnJob', data.selectWorkflowParticipant, true, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0FilterCondition', data.filterCondition, false, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0DecisionSetLOV', data.decisionLabels, false, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0AsyncPriority', data.asyncPriority, false, isPanelEditable );
        _populatePropValue( vmoObject, 'fnd0DecisionsToRetain', data.decisionsToRetain, false, isPanelEditable );

        var isEditable = isPanelEditable;
        // For Review, Acknowledge and Route task template, Notify, Select signoff or perform signoff task temolate it will be always User value as those tasks need to be
        // interactive always and can't be mark as system. So even template is in edit mode we need to check the
        // task template type and if matched then pass isEditable as false all time so that widget will be rendered
        // in read only mode.
        if( _isReadOnlyInteractiveTaskTemplateSelected( vmoObject ) ) {
            isEditable = false;
        }
        _populatePropValue( vmoObject, 'fnd0InteractiveTask', data.taskExecutedBy, true, isEditable, data.i18n );

        _populateTaskTemplateDurationData( data, vmoObject, isPanelEditable );
        _preSelectObjectTypeForSelectedTemplate( data, isPanelEditable );
        if( isPanelEditable ) {
            Awp0TemplatePropertiesEditService.addEditHandler( data );
        }
        return {
            vmo:data.vmo,
            allowedDefaultObjectTypes:data.allowedDefaultObjectTypes,
            isPanelEditable:data.isPanelEditable,
            showInProcessStage:data.showInProcessStage,
            processBackground:data.processBackground,
            requireTaskConfirmation:data.requireTaskConfirmation,
            notModifiable:data.notModifiable,
            selectWorkflowParticipant:data.selectWorkflowParticipant,
            filterCondition:data.filterCondition,
            decisionLabels:data.decisionLabels,
            asyncPriority:data.asyncPriority,
            queryScope:data.queryScope,
            queryAganist:data.queryAganist,
            savedQueries:data.savedQueries,
            savedConditions:data.savedConditions,
            queryCondition:data.queryCondition,
            includeRepliaceTarget:data.includeRepliaceTarget,
            currentQuery:data.currentQuery,
            currentCondition:data.currentCondition,
            releaseStatus:data.releaseStatus,
            createStatusHandler:data.createStatusHandler,
            fnd0Instructions:data.fnd0Instructions,
            template_name:data.template_name,
            setConditionHandler:data.setConditionHandler,
            setDurationHandler:data.setDurationHandler,
            taskExecutedBy : data.taskExecutedBy,
            decisionsToRetain : data.decisionsToRetain
        };
    }
};

/**
 * Load all valid task template types based on current task template selection.
 *
 * @param {Object} data Data view model object
 * @param {Object} selection Selected obejct from UI.
 */
export let loadValidTaskTemplateTypes = function( data, selection ) {
    // Check if data and selection is not null then only get the types that will be shown in LOV
    if( data && selection && selection.uid && data.taskTemplateObjectTypes ) {
        var selectedObject = cdm.getObject( selection.uid );
        var taskTemplateTypeList = Awp0WorkflowDesignerUtils.getValidTaskTemplateTypeList( selectedObject, data.taskTemplateObjectTypes );
        data.taskTemplateTypeList = taskTemplateTypeList;
        if( data.taskTemplateType && data.vmo && selectedObject.props.task_type && selectedObject.props.task_type.uiValues ) {
            _populatePropValue( data.vmo, 'task_type', data.taskTemplateType, false, data.isPanelEditable );
            var taskTypeValue = selectedObject.props.task_type.uiValues[ 0 ];
            // task_type proeprty dbValue and uiValue both are same and because of that we need to complate for
            // display name to find the correct type that need to be selected by default
            var defaultTaskTemplate = _.find( data.taskTemplateTypeList, function( templateType ) {
                return templateType.propDisplayValue === taskTypeValue;
            } );
            if( defaultTaskTemplate ) {
                data.taskTemplateType.uiValue = defaultTaskTemplate.propDisplayValue;
                data.taskTemplateType.dbValue = defaultTaskTemplate.propInternalValue;
            }
        }
    }
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * This method is used to get the LOV values for the decision label panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response, avoidEmptyLOV ) {
    var lovList = [];
    if( !avoidEmptyLOV ) {
        lovList.push( _getEmptyListModel() );
    }
    if( !response || !response.lovValues ) {
        return lovList;
    }
    _.forEach( response.lovValues, function( result ) {
        if( result && result.propDisplayValues.lov_values ) {
            var object = {
                propDisplayValue: result.propDisplayValues.lov_values[ 0 ],
                propDisplayDescription: result.propDisplayValues.lov_value_descriptions ? result.propDisplayValues.lov_value_descriptions[ 0 ] : result.propDisplayValues.lov_values[ 0 ],
                propInternalValue: result.propInternalValues.lov_values[ 0 ]
            };
            lovList.push( object );
        }
    } );
    return lovList;
};

/**
 * This method is used to get the LOV values for the async priority label panel.
 * @param {Object} response the response of the getLov soa
 *
 * @returns {Object} value the LOV value
 */
export let getAsyncPriorityLOVList = function( response ) {
    return exports.getLOVList( response, true );
};

/**
 * Fire the event to fit the graph.
 */
export let updateWorkflowGraph = function() {
    eventBus.publish( 'workflowDesigner.fitGraph' );
};

/**
 * This method is used to get the LOV values for the filter condition.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getFilterConditionLOVList = function( response ) {
    var lovList = [];
    lovList.push( _getEmptyListModel() );
    if( !response || !response.lovValues ) {
        return lovList;
    }
    _.forEach( response.lovValues, function( result ) {
        if( result && result.propDisplayValues.condition_name && result.propDisplayValues.expression ) {
            var object = {
                propDisplayValue: result.propDisplayValues.condition_name[ 0 ],
                propDisplayDescription: result.propDisplayValues.expression ? result.propDisplayValues.expression[ 0 ] : result.propDisplayValues.expression[ 0 ],
                propInternalValue: result.uid
            };
            lovList.push( object );
        }
    } );
    return lovList;
};

/**
 * This method is used to get the LOV values for the release status list.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getReleaseStatusList = function( response ) {
    var releaseStatusList = [];
    releaseStatusList.push( _getEmptyListModel() );
    if( !response || !response.result ) {
        return releaseStatusList;
    }
    _.forEach( response.result, function( result ) {
        if( result ) {
            var statusObject = cdm.getObject( result.uid );
            var object = {
                propDisplayValue: statusObject.props.object_string.uiValues[ 0 ],
                propDisplayDescription: '',
                propInternalValue: statusObject.props.object_string.dbValues[ 0 ]
            };

            releaseStatusList.push( object );
        }
    } );
    // Sort the release status list by default with dispaly name
    releaseStatusList = _.sortBy( releaseStatusList, 'propDisplayValue' );
    return releaseStatusList;
};

/**
 * This method is used to get the LOV values for the saved query list.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getSavedQueryLOVList = function( response ) {
    var savedQueryList = [];
    savedQueryList.push( _getEmptyListModel() );
    if( !response || !response.lovValues ) {
        return savedQueryList;
    }
    _.forEach( response.lovValues, function( queryLOVValue ) {
        if( queryLOVValue && queryLOVValue.propDisplayValues && queryLOVValue.propDisplayValues.query_name &&
            queryLOVValue.propDisplayValues.query_name[ 0 ] ) {
            var queryObject = {
                propDisplayValue: queryLOVValue.propDisplayValues.query_name[ 0 ],
                propDisplayDescription: '',
                propInternalValue: queryLOVValue.propDisplayValues.query_name[ 0 ]
            };

            savedQueryList.push( queryObject );
        }
    } );
    return savedQueryList;
};

/**
 * Based on selected query anaisnt option set the include target value to false.
 * @param {Object} data Data view model object
 */
export let queryOptionSelected = function( data ) {
    if( data.queryAganist && data.queryAganist.dbValue !== 'target' ) {
        data.includeRepliaceTarget.dbValue = false;
    }
};

/**
 * Updated the panel when task template is deleted.
 */
export let updateOnTaskTemplateDelete = function() {
    // This method will be called when user remove something from process template or delete the process itself
    // and properties section is visible and user modified some properties. So in that case, we don't
    // want to update the properties for deleted template. So to have the deleted objects UID's on data
    // added thsi empty method.
};

/**
 * Update the template name property when user updated the value outside properties tab.
 *
 * @param { Array} modifiedObjects  Modified objects from UI
 * @param { Object} selTemplate Selected template object whose info need to be updated
 * @param { Object} data Data view model object
 */
export let updatePropertiesOnObjectChanged = function( modifiedObjects, selTemplate, data ) {
    // Find the matching template first and if found then only go and update the template
    var modifiedTemplate = _.find( modifiedObjects, function( object ) {
        return object.uid === selTemplate.uid;
    } );
    if( modifiedTemplate && data && data.template_name ) {
        data.template_name.dbValue = modifiedTemplate.props.template_name.dbValues[ 0 ];
        data.template_name.uiValue = modifiedTemplate.props.template_name.uiValues[ 0 ];
    }
};

/**
 * Get the obejct types that need to be shown on UI.
 * @param {Object} response Response object
 * @param {Object} data respective view model data
 * 
 * @returns {Object} Object types list model array
 */
export let getObjectTypeLOVListValues = function( response, data ) {
    var modelObjects = [];
    if( response && response.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            _.forEach( searchResults.objects, function( object ) {
                var uid = object.uid;
                var obj = response.ServiceData.modelObjects[ uid ];
                modelObjects.push( obj );
            } );
        }
        var endReached = response.cursor.endReached;
        data.moreValuesExist = !endReached;
    }
    var listObjects = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
    if( listObjects && listObjects.length > 0 ) {
        _.forEach( listObjects, function( listObject ) {
        // adding internal names in brackets as well,in propDisplayValue.
            listObject.propDisplayValue = listObject.propDisplayValue + ' (' + listObject.propInternalValue.props.fnd0InternalName.dbValues[0] + ')';
        } );
        return listObjects;
    }
    return [];
};

/**
 * Get the obejct types that need to be shown on UI.
 * @param {Object} response Response object
 *
 * @returns {Object} Object types list model array
 */
export let getConditionLOVListValues = function( response ) {
    var objectList = [];
    if( response && response.ServiceData && response.ServiceData.modelObjects ) {
        objectList = listBoxService.createListModelObjects( response.ServiceData.modelObjects, 'props.object_string' );
    }
    return objectList;
};

/**
 * Get the obejct types that need to be shown on UI.
 * @param {Object} response Response object
 *
 * @returns {Object} Object types list model array
 */
var _preSelectObjectTypeForSelectedTemplate = function( data, isPanelEditable  ) {
    data.allowedDefaultObjectTypes.isEditable = isPanelEditable;
    data.allowedDefaultObjectTypes.isEnabled = isPanelEditable;
    let dbValue = [];
    let displayValues = [];
    if ( data.allowedDefaultObjectTypes && data.allowedDefaultObjectTypes.dbValues && data.allowedDefaultObjectTypes.dbValues.length > 0 ) {
        for ( var i = 0; i < data.allowedDefaultObjectTypes.dbValues.length; ++i ) {
            dbValue.push( data.allowedDefaultObjectTypes.dbValues[i] );
            displayValues.push( data.allowedDefaultObjectTypes.newDisplayValues[i] );
        }
    } else if ( data.preferencesForTemplate && data.preferencesForTemplate.length > 0 ) {
        for ( var i = 0; i < data.preferencesForTemplate.length; ++i ) {
            dbValue.push( data.preferencesForTemplate[i].propInternalValue );
            displayValues.push( data.preferencesForTemplate[i].propDisplayValue );
        }
    }
    if ( dbValue && dbValue.length > 0 && displayValues && displayValues.length > 0 ) {
        data.allowedDefaultObjectTypes.uiValue = '';
        data.allowedDefaultObjectTypes.dbValue = [];
        data.allowedDefaultObjectTypes.displayValues = [];
    }
    uwPropertyService.updateModelData( data.allowedDefaultObjectTypes, _.uniqWith( dbValue, _.isEqual ), _.uniq( displayValues ), false, isPanelEditable, isPanelEditable, {} );
};


/**
 * Get the decisions to retain option lovs that need to be shown on the UI
 * 
 * @param workflowDgmState - current workflow diagram state
 * @returns { Array } decisions to retain lov options
 */
export let getDecisionToRetainOptions = function( workflowDgmState ) {
    var lovOptions = [];
    var uidsToLoad = [];
    var selectedObj;
    var decisionsToRetainLOV;
    // Check if task tempalte object is not null then only add to list to get the property
    if ( workflowDgmState.selectedObject && workflowDgmState.selectedObject.uid ) {
        uidsToLoad.push( workflowDgmState.selectedObject.uid );
    } else if ( workflowDgmState.selected && workflowDgmState.selected.uid ) {
        uidsToLoad.push( workflowDgmState.selected.uid );
    }
    
    return dms.getProperties(uidsToLoad, ['fnd0DecisionsToRetainLOV']).then( function(){
        selectedObj = cdm.getObject( uidsToLoad[0] );
        decisionsToRetainLOV = selectedObj.props['fnd0DecisionsToRetainLOV'].dbValues[0];
        var inputData = {
            initialData: {
                lov: {
                    uid :decisionsToRetainLOV,
                    type:'ListOfValues'
                },
                lovInput: {
                    owningObject: selectedObj,
                    boName:'',
                    operationName: 'Edit'
                }
            }
        };
        return soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', inputData ).then( function( response ) {
            for ( let index = 0; index < response.lovValues.length; index++ ) {
                lovOptions.push( {
                    propInternalValues : response.lovValues[index].propInternalValues.lov_values[0],
                    propDisplayValues : response.lovValues[index].propDisplayValues.lov_value_descriptions[0]
                } );
            }
 
            var listObjects = listBoxService.createListModelObjects( lovOptions, 'propDisplayValues' );
            var i = 0;
            if( listObjects && listObjects.length > 0 ) {
                _.forEach( listObjects, function( listObject ) {
                    listObject.propInternalValue = lovOptions[i].propInternalValues;
                    i= i+1;
                } );
                return listObjects;
            }
 
        } ).catch( function( error ) {
            var errMessage = msgSvc.getSOAErrorMessage( error );
            msgSvc.showError( errMessage );
        } );
    });
};

export let populatePanelDataForInfo = function( data, ctx, subPanelContext, fields ) {    
    let isPanelEditable = false;
    let vmoObject = "";
    if( ctx && ctx.editInProgress )
    {
        isPanelEditable = ctx.editInProgress;
    }
    if( subPanelContext && subPanelContext.xrtState && subPanelContext.xrtState.xrtVMO )
    {
        vmoObject = cdm.getObject( subPanelContext.xrtState.xrtVMO.uid );
    }
    
    _populatePropValue( vmoObject, 'fnd0DecisionsToRetain', data.decisionsToRetain, false, isPanelEditable );
    data.decisionsToRetain.sourceObjectLastSavedDate = vmoObject.props.last_mod_date.dbValues[0];
    fields.decisionsToRetain.update(data.decisionsToRetain);
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0TemplateProperties
 */

export default exports = {
    getEPMCreateStatusHandler,
    populatePanelData,
    getLOVList,
    updateWorkflowGraph,
    getFilterConditionLOVList,
    getReleaseStatusList,
    getSavedQueryLOVList,
    queryOptionSelected,
    updateOnTaskTemplateDelete,
    updatePropertiesOnObjectChanged,
    getObjectTypeLOVListValues,
    loadValidTaskTemplateTypes,
    getAsyncPriorityLOVList,
    getConditionLOVListValues,
    getDecisionToRetainOptions,
    populatePanelDataForInfo
};
