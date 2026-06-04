// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1CreatePanelService
 */
import dateTimeSvc from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import smConstants from 'js/ScheduleManagerConstants';
import uwDirectiveDateTimeSvc from 'js/uwDirectiveDateTimeService';
import uwPropertyService from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';
import addObjectUtils from 'js/addObjectUtils';
import _ from 'lodash';

var exports = {};

/**
  * Add the selected object to data
  *
  * @param {object} data - The qualified data of the viewModel
  * @param {object} selection - The selected object
  */
export let addSelectedObject = function( data, selection ) {
    if( selection && selection[ 0 ] ) {
        data.selectedObject = selection[ 0 ];
    } else {
        data.selectedObject = null;
    }
};

/**
  * Auto select the type if there is single type
  *
  * @param {object} data - The qualified data of the viewModel
  */
export let autoSelectType = function( data ) {
    data.totalTypeFound = data.dataProviders.awTypeSelector.viewModelCollection.totalFound;
    if( data.totalTypeFound === 1 ) {
        data.autoSelectedObject = data.dataProviders.awTypeSelector.getViewModelCollection().getViewModelObject( 0 );
    } else {
        data.autoSelectedObject = null;
    }
};
/**
  * Get the integer value
  *
  * @param {string} type - The string data type
  * @return Number value of the string type
  */
var getType = function( type ) {
    var typeValue;
    switch ( type ) {
        case 'CHARACTER':
            typeValue = 0;
            break;

        case 'STRING':
            typeValue = 1;
            break;

        case 'INTEGER':
            typeValue = 2;
            break;

        case 'LONG':
            typeValue = 3;
            break;

        case 'DOUBLE':
            typeValue = 4;
            break;

        case 'FLOAT':
            typeValue = 5;
            break;

        case 'BOOLEAN':
            typeValue = 6;
            break;

        case 'DATE':
            typeValue = 7;
            break;

        default:
            typeValue = -1;
    }
    return typeValue;
};

/**
  * Get the property value
  *
  * @param {object} viewModelProperties - View model properties
  * @return {object} value - The object value
  */
var getValue = function( viewModelProperties ) {
    var value = null;
    if( viewModelProperties.type === 'DATE' ) {
        value = dateTimeSvc.formatUTC( viewModelProperties.dbValue );
    } else {
        value = viewModelProperties.dbValue;
    }
    if( typeof value !== typeof undefined && value !== null ) {
        return value.toString();
    }
    return '';
};

/**
  * Get Schedule Tasks.
  *
  * @param {object} data the view model data object
  */
export let getScheduleTasks = function( data, sourceObjects ) {
    var input = [];
    var inputData;
    for( var objects in sourceObjects ) {
        if( sourceObjects.hasOwnProperty( objects ) ) {
            inputData = sourceObjects[ objects ];
            input.push( inputData );
        }
    }
    return input;
};

/**
  * Get custom properties
  *
  * @param {array} defaultProperties - Default properties array
  * @param {array} viewModelProperties - View model properties
  * @return {array} attribute - Custom attributes array
  */
var getCustomProperties = function( defaultProperties, viewModelProperties ) {
    var attribute = [];
    for( var i = 0; i < viewModelProperties.length; i++ ) {
        var defaultAttribute = false;
        for( var j in defaultProperties ) {
            if( viewModelProperties[ i ].propertyName === defaultProperties[ j ] ) {
                defaultAttribute = true;
                break;
            }
        }
        if( !defaultAttribute ) {
            attribute.push( {
                attrName: viewModelProperties[ i ].propertyName,
                attrValue: getValue( viewModelProperties[ i ] ),
                attrType: getType( viewModelProperties[ i ].type )
            } );
        }
    }
    return attribute;
};

/**
  * Get Schedule custom properties
  *
  * @param {array} defaultProperties - Default properties array
  * @param {array} viewModelProperties - View model properties
  * @return {array} attribute - Custom attributes array
  */
var getScheduleCustomProperties = function( data, defaultProperties, viewModelProperties ) {
    var attribute = [];
    for( var i = 0; i < viewModelProperties.length; i++ ) {
        var defaultAttribute = false;
        for( var j in defaultProperties ) {
            if( viewModelProperties[ i ].propertyName === defaultProperties[ j ] ) {
                defaultAttribute = true;
                break;
            }
        }
        if( !defaultAttribute ) {
            attribute.push( {
                key: viewModelProperties[ i ].propertyName,
                value: getValue( viewModelProperties[ i ] ),
                type: getType( viewModelProperties[ i ].type )
            } );
        }
    }
    if( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure && appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure[ 0 ] ) {
        attribute.push( {
            key: 'saw1UnitOfTimeMeasure',
            value: appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure[ 0 ],
            type: 1
        } );
    }

    return attribute;
};

/**
  * Prepare the container for the custom properties of the Schedule Task
  *
  * @param {object} data - The qualified data of the viewModel
  * @param {array} defaultProperties - Default properties of the schedule
  * @return {array} customProperties - Custom properties array
  */
export let getTypedAttributesContainer = function( data, defaultProperties, createType, editHandler ) {
    var customProperties = [];
    var viewModelProperties = addObjectUtils.getObjCreateEditableProperties( createType, null, null, editHandler );
    customProperties = getCustomProperties( defaultProperties, viewModelProperties );
    return customProperties;
};

/**
  * Prepare the container for the custom properties of the Schedule
  *
  * @param {object} data - The qualified data of the viewModel
  * @param {array} defaultProperties - Default properties of the schedule
  * @return {array} customProperties - Custom properties array
  */
export let getScheduleTypedAttributesContainer = function( data, defaultProperties, createType, editHandler ) {
    var customProperties = [];
    var viewModelProperties = addObjectUtils.getObjCreateEditableProperties( createType, null, null, editHandler );
    customProperties = getScheduleCustomProperties( data, defaultProperties, viewModelProperties );
    return customProperties;
};

/**
  * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
  *
  * @param {dateObject} dateObject - The date object
  * @return {dateValue} The date string value
  */
export let getDateString = function( dateObject ) {
    var dateValue = {};
    dateValue = dateTimeSvc.formatUTC( dateObject );

    if( dateValue === '' || typeof dateValue === typeof undefined ) {
        throw 'invalidStartDateOrFinishDate';
    }

    return dateValue;
};

/**
  * Return the schedule of the selected task, if no task is selected then return selected schedule
  *
  * @param {object} selectedObj - The selected object
  * @return {object} parentTask - The parent task of the selected task, if no task is selected then return the
  *         schedule summary task
  */
export let getSchedule = function( selectedObj ) {
    if( isSchedule( selectedObj ) ) {
        return selectedObj;
    } else if( isScheduleTask( selectedObj ) ) {
        return cdm.getObject( selectedObj.props.schedule_tag.dbValues[ 0 ] );
    }
};

/**
  * Return the UID of the schedule of the selected task, if select task is schedule, return the schedule uid
  *
  * @param {object} selectedObj - The selected object
  * @return {object} uid of schedule - the UID of the selected schedule or the schedule of the selected task.
  *
  */
export let getScheduleUid = function( selectedObj ) {
    if( isSchedule( selectedObj ) ) {
        return selectedObj.uid;
    } else if( isScheduleTask( selectedObj ) ) {
        return selectedObj.props.schedule_tag.dbValues[ 0 ];
    }
};

/**
  * Return the parent task for the selected task. If no task is selected or schedule summary is selected
  * then return selected schedule summary task
  *
  * @param {object} selectedObj - The selected object
  * @return {object} parentTask - The parent task if a non-schedule summary task is selected, otherwise the return the schedule
  *         summary task
  */
export let getParentTask = function( selectedObj ) {
    if( isSchedule( selectedObj ) ) {
        return cdm.getObject( selectedObj.props.fnd0SummaryTask.dbValues[ 0 ] );
    } else if( isScheduleTask( selectedObj ) ) {
        if( selectedObj.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
            return selectedObj; // Use Schedule summary as the parent
        }
        return cdm.getObject( selectedObj.props.fnd0ParentTask.dbValues[ 0 ] );
    }
};

/**
  * Return the parent task for the selected task, if no task is selected then return selected schedule summary
  * task
  *
  * @param {object} selectedObj - The selected object
  * @return {object} newParent - The new parent task
  */
export let getNewParentTask = function( selectedObj ) {
    if( isScheduleTask( selectedObj ) ) {
        return selectedObj;
    }
    throw 'selectTargetTask';
};

var calculateWorkEstimateValue = function( workEstimateStringdbValue, duration ) {
    var workEstimateValue = '';
    var len = workEstimateStringdbValue.length;
    if( duration === 'w' ) {
        workEstimateValue = workEstimateStringdbValue.substring( 0, len - 1 ) * 5 * 8 * 60;
        /*
          * The preference is w-> week (Week = 5 days * 8 working hours * 60 mins)
          */
    } else if( duration === 'd' ) {
        workEstimateValue = workEstimateStringdbValue.substring( 0, len - 1 ) * 8 * 60;
        /*
          * The preference is d-> day (day = 8 working hours * 60 mins)
          */
    } else if( duration === 'h' ) {
        workEstimateValue = workEstimateStringdbValue.substring( 0, len - 1 ) * 60;
        /*
          * The preference is h-> hours (working hours * 60 mins)
          */
    } else if( duration === 'mo' ) {
        workEstimateValue = workEstimateStringdbValue.slice( 0, -2 ) * 20 * 8 * 60;
        /*
          * The preference is mo-> month (month = 20 days * 8 working hours * 60 mins)
          */
    }
    return workEstimateValue;
};

/**
  * Calculate and return the value of the work effort.
  *
  * @param {string} workEstimateStringdbValue - Value of the Work Effort in the Add Schedule Task panel
  */
var getWorkEstimateValue = function( workEstimateStringdbValue ) {
    var workEstimate = null;
    var len = workEstimateStringdbValue.length;
    var duration = workEstimateStringdbValue.slice( -1 ).toLowerCase();
    var workEstimateValue = '';
    if( duration === 'h' || duration === 'd' || duration === 'w' ) {
        if(  /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringdbValue.substring( 0, len - 1 ) )  === false ) {
            throw 'workEstimateErrorMsg';
        }

        workEstimateValue = calculateWorkEstimateValue( workEstimateStringdbValue, duration );
    } else {
        duration = workEstimateStringdbValue.slice( -2 ).toLowerCase();
        if( duration === 'mo' ) {
            if(  /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringdbValue.substring( 0, len - 2 ) )  === false ) {
                throw 'workEstimateErrorMsg';
            }
            workEstimateValue = calculateWorkEstimateValue( workEstimateStringdbValue, duration );
        }
    }
    if( workEstimateValue >= 0 ) {
        workEstimate = parseInt( workEstimateValue );
        return workEstimate;
    }
    throw 'workEstimateErrorMsg';
};

/**
  * Return Work Estimate of the newly created task
  *
  * @param {object} data - The qualified data of the viewModel
  * @param {string} unitOfTimeMeasure - Unit of Time Measure value
  */
export let getWorkEstimate = function( data, unitOfTimeMeasure ) {
    var workEstimateStringdbValue = data.fnd0WorkEffortString.dbValues[ 0 ];
    var workEstimateStringValue = workEstimateStringdbValue.replace( / /g, '' );
    var workEstimate = 480;

    if( workEstimateStringValue !== '' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringValue ) ) {
            workEstimateStringdbValue += unitOfTimeMeasure;
        }
        workEstimate = getWorkEstimateValue( workEstimateStringdbValue );
    }
    return workEstimate;
};

/**
  * Checks validity for given date
  * @param {Date} date : Date
  * @returns {boolean} : Returns true if valid date
  */
var isValidDate = function( date ) {
    var isValidDate = true;
    if( date.dateApi.dateValue ) {
        try {
            uwDirectiveDateTimeSvc.parseDate( date.dateApi.dateValue );
        } catch ( ex ) {
            isValidDate = false;
        }
    }
    return isValidDate;
};

/**
  * Return Work Estimate of the newly created task
  *
  * @param {object} data - The qualified data of the viewModel
  * @param {object} taskStartDateValue - The Start Date of New Schedule Task
  * @param {object} taskFinishDateValue -The Finish Date of New Schedule Task
  * @param {object} ctx - The context object
  */
export let dateValidation = function( data, taskStartDateValue, taskFinishDateValue, ctx ) {
    if( ctx ) {
        if( !( isValidDate( data.start_date ) && isValidDate( data.finish_date ) ) ) {
            throw 'invalidStartDateOrFinishDate';
        }

        var taskStartDate = new Date( taskStartDateValue );
        var taskFinishDate = new Date( taskFinishDateValue );

        if( taskStartDate.toString() === 'Invalid Date' || taskFinishDate.toString() === 'Invalid Date' ) {
            throw 'scheduleTaskDateBoundaryError';
        }

        if( taskFinishDate.getTime() < taskStartDate.getTime() ) {
            throw 'scheduleTaskStartDateError';
        }

        if( ctx.selected !== null && ctx.selected.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
            if( isSchedule( ctx.selected ) ) {
                data.schStart.dateApi.dateObject = ctx.selected.props.start_date.dbValues[ 0 ];
                data.schFinish.dateApi.dateObject = ctx.selected.props.finish_date.dbValues[ 0 ];
            } else {
                data.schStart.dateApi.dateObject = ctx.pselected.props.start_date.dbValues[ 0 ];
                data.schFinish.dateApi.dateObject = ctx.pselected.props.finish_date.dbValues[ 0 ];
            }
        } else {
            var datasetModel = cdm.getObject( ctx.selected.props.schedule_tag.dbValues[ 0 ] );

            data.schStart.dateApi.dateObject = datasetModel.props.start_date.dbValues[ 0 ];
            data.schFinish.dateApi.dateObject = datasetModel.props.finish_date.dbValues[ 0 ];
        }

        var scheduleStartDate = new Date( data.schStart.dateApi.dateObject );

        if( taskStartDate.getTime() < scheduleStartDate.getTime() ) {
            throw 'scheduleTaskDateBoundaryError';
        }

        var scheduleFinishDate = new Date( data.schFinish.dateApi.dateObject );

        if( scheduleFinishDate.getTime() < taskFinishDate.getTime() ) {
            throw 'scheduleTaskDateBoundaryError';
        }
    }
};

/**
  * Return moveRequests container for the "moveTasks" SOA operation
  *
  * @param {object} data - Data containing the selected Tasks in clipboard
  * @param {object} targetTask - target Task object for the "moveTasks" SOA operation
  * @return {moveRequestsContainer} moveRequests container for the "moveTasks" SOA operation
  */
export let getMoveTaskContainer = function( data, targetTask, sourceObjects ) {
    {
        var moveRequests = [];

        for( var index = 0; index < sourceObjects.length; index++ ) {
            var selectedTaskObj = sourceObjects[ index ];
            if( selectedTaskObj.uid !== targetTask.uid ) {
                moveRequests.push( {
                    task: selectedTaskObj,
                    newParent: this.getParentTask( targetTask ),
                    prevSibling: targetTask
                } );
            }
        }

        return moveRequests;
    }
};

/**
  * Return schedule task of selected objects.
  * @param {object}  selectedObj - task or schedule selected,
  * @return {object} task object itself or summary task if selected object is schedule.
  */
export let getScheduleTask = function( selectedObj ) {
    if( isScheduleTask( selectedObj ) ) {
        return selectedObj;
    } else if( isSchedule( selectedObj ) && selectedObj.props.fnd0SummaryTask ) {
        return cdm.getObject( selectedObj.props.fnd0SummaryTask.dbValues[ 0 ] );
    }
};

/**
  * Validates the input for the "moveTasks" SOA operation
  *
  * @param {object} targetTask - target Task object for the "moveTasks" SOA operation
  */
export let validateInput = function( targetTask ) {
    {
        if( targetTask === null || isSchedule( targetTask ) ) {
            throw 'scheduleTaskMoveNoTargetTaskErrorMsg';
        } else if( targetTask.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
            throw 'scheduleSummaryTaskMoveErrorMsg';
        }
    }
};

/**
  * Return the previous task of the selected task (if any)
  *
  * @param {object} selectedObj - The selected object
  * @return {object} selectedObj - The selected object if the selected object is a schedule task
  */
export let getPreviousTask = function( selectedObj ) {
    if( isScheduleTask( selectedObj ) ) {
        var schedule = cdm.getObject( selectedObj.props.schedule_tag.dbValues[ 0 ] );
        if( selectedObj.uid !== schedule.props.fnd0SummaryTask.dbValues[ 0 ] ) {
            return selectedObj;
        }
    }
};

export let getScheduleTag = function( data ) {
    var schedule = null;
    var objects = data.modelObjects;
    for( var key in data.modelObjects ) {
        if( data.modelObjects.hasOwnProperty( key ) ) {
            var object = objects[ key ];
            if( cmm.isInstanceOf( 'ScheduleTask', object.modelType ) ) {
                var schTag = object.props.schedule_tag;
                if( schTag ) {
                    schedule = object.props.schedule_tag.dbValues[ 0 ];
                }
            }
        }
    }
    return schedule;
};

/**
  * Activates create schedule input panel
  *
  * @param {string} commandId - Id of command
  * @param {string} location - Location of command
  * @param {Object} paletteAndSearchData - Object contaning details related to palette and search and relations call
  * @param {Object} config - config object of command
  */
export let getCreateSchedulePanel = function( commandId, location, paletteAndSearchData, config ) {
    var Object = 'Object';
    var scheduleDefaultAttributes = [ 'object_name', 'object_desc', 'customer_name', 'customer_number',
        'finish_date', 'start_date', 'is_baseline', 'schedule_type', 'wbsformat', 'wbsvalue',
        'latest_start_date', 'earliest_finish_date', 'end_date_scheduling', 'recalc_type', 'recalc_schedule',
        'fnd0state', 'fnd0status', 'fnd0master_sched', 'fnd0allowExecUpdates', 'fnd0IsExternal',
        'activeschbaseline_tag', 'base_schedule_cost', 'schedule_deliverable_list', 'fnd0SummaryTask',
        'fnd0Schedulemember_taglist', 'sum_rollup_status', 'items_tag', 'sch_notification_count',
        'schedule_deliverable_list', 'fnd0SummaryTask', 'fnd0ScheduleTemplate', 'fnd0user_priv', 'owning_user',
        'item_id', 'notifications_enabled', 'percent_linked', 'act_date_preference', 'is_public',
        'fnd0ShiftDate', 'fnd0PriorityString', 'fnd0TimeZone', 'published', 'is_template'
    ];

    if( paletteAndSearchData ) {
        appCtxService.registerCtx( 'PaletteAndSearchData', paletteAndSearchData );
    } else {
        // to clear the object if paletteAndSearchData is undefined
        appCtxService.unRegisterCtx( 'PaletteAndSearchData' );
    }
    var jso;
    jso = {
        DefaultAttributeMap: scheduleDefaultAttributes,
        CreatePanelIncludeType: 'Schedule'
    };
    appCtxService.registerCtx( Object, jso );
    commandPanelService.activateCommandPanel( commandId, location, null, null, null, config );
};

/**
  *  Returns the selected object from the panel
  * @param {Object} data - data
  * @param {Object} ctx - context
  * @returns {Array} the selectedOnjects array
  */
export let getSecondaryObjForCreateRelations = function( data, ctx ) {
    var sourceObjsForCreateRelations = [];
    if( data.selectedTab.panelId === 'Saw1CreatePanelSub' ) {
        sourceObjsForCreateRelations[ 0 ] = data.createdMainObject;
    } else if( data.selectedTab.panelId === 'PaletteTabPageSub' ) {
        if( ctx.getClipboardProvider.selectedObjects.length > 0 ) {
            sourceObjsForCreateRelations = ctx.getClipboardProvider.selectedObjects;
        } else if( ctx.getRecentObjsProvider.selectedObjects.length > 0 ) {
            sourceObjsForCreateRelations = ctx.getRecentObjsProvider.selectedObjects;
        } else if( ctx.getFavoriteProvider.selectedObjects.length > 0 ) {
            sourceObjsForCreateRelations = ctx.getFavoriteProvider.selectedObjects;
        }
    } else {
        if( data.dataProviders.performSearch.selectedObjects.length > 0 ) {
            sourceObjsForCreateRelations = data.dataProviders.performSearch.selectedObjects;
        }
    }
    return sourceObjsForCreateRelations;
};

/**
  * This function handles the default selection from clipboard dataProvider on palette tab
  * @param {Object} ctx - ctx
  */
export let handleDefaultSelectionForPalette = function( ctx ) {
    if( ctx.getClipboardProvider && ctx.getClipboardProvider.selectedObjects.length === 0 ) {
        ctx.getClipboardProvider.selectAll();
    }
};

/**
  * This function handles selection from any of the clipboard/favorites/recent dataProvider on palette tab
  * @param {Object} ctx - ctx
  * @param {Object} dataProviderId - palette data provide ID
  * @param {Object} context - selected objects on clipboard/favorites/recent dataProvider on palette tab
  */
var lastContext = {
    getClipboardProvider: null,
    getFavoriteProvider: null,
    getRecentObjsProvider: null
};

export let handlePaletteSelection = function( ctx, dataProviderId, context ) {
    if( context._refire ) { return; }
    var dataProviderSet = Object.keys( lastContext );
    lastContext[ dataProviderId ] = context;
    var otherDataProviders = _.pull( dataProviderSet, dataProviderId );

    // Clear the selections on other two sections
    if( context.selectedObjects.length > 0 ) {
        for( var i = 0; i < otherDataProviders.length; i++ ) {
            if( ctx[ otherDataProviders[ i ] ] !== undefined ) {
                var dp = ctx[ otherDataProviders[ i ] ];
                if( dp.selectedObjects.length > 0 ) {
                    dp.selectionModel.setSelection( [] );
                }
            }
        }
    }
};

/**
  * Is the object a Schedule type
  *
  * @param {object} obj - The object
  * @return {boolean} true/false - If the object is a schedule
  */
function isSchedule( obj ) {
    if( cmm.isInstanceOf( 'Schedule', obj.modelType ) ) {
        return true;
    }
    return false;
}

/**
  * Is the object a ScheduleTask type
  *
  * @param {object} obj - The object
  * @return {boolean} true/false - If the object is a schedule task
  */
function isScheduleTask( obj ) {
    if( cmm.isInstanceOf( 'ScheduleTask', obj.modelType ) ) {
        return true;
    }
    return false;
}

/**
  * Convert schedule search results into a list of model objects.
  * @param {object} response - SOA operation response.
  * @returns list of model objects.
  */
export let processScheduleResponseObjects = function( response ) {
    var schObjects = [];

    if( response && response.searchResults ) {
        schObjects = listBoxService.createListModelObjects( response.searchResults, 'props.object_string' );
    }

    return schObjects;
};


/**
  * Method for invoking and registering/unregistering data for the Create Sch Task Panel
  *
  * @param {String} commandId - Command Id for the Create Sch Task
  * @param {String} location - Location of the Create Sch Task command
  */
export let getCreateSchTaskProperties = function( commandId, location, config ) {
    var Object = 'Object';
    var scheduleDefaultAttributes = [ 'object_name', 'object_desc', 'work_estimate', 'ResourceAssignment',
        'fnd0workflow_owner', 'item_id', 'object_type', 'items_tag', 'workflow_trigger_type', 'work_remaining',
        'fnd0state', 'is_baseline', 'fnd0status', 'complete_percent', 'work_complete', 'actual_finish_date',
        'actual_start_date', 'auto_complete', 'constraint', 'fixed_type', 'priority', 'duration',
        'approved_work_update', 'finish_date', 'wbs_code', 'start_date', 'workflow_template',
        'sch_task_deliverable_list', 'fnd0PriorityString', 'fnd0DurationString', 'fnd0ConstraintString',
        'fnd0FixedTypeString', 'owning_user', 'fnd0WorkEffortString', 'saw1WorkflowTemplate',
        'saw1WorkflowTriggerType', 'act_date_preference', 'is_public', 'fnd0ShiftDate', 'fnd0PriorityString',
        'fnd0TimeZone', 'published'
    ];
    var jso;
    jso = {
        DefaultAttributeMap: scheduleDefaultAttributes,
        CreatePanelIncludeType: 'ScheduleTask'
    };
    appCtxService.registerCtx( Object, jso );
    commandPanelService.activateCommandPanel( commandId, location, null, null, null, config );
};

/**
  * Prepare the map for default CreateSchedule SOA input attributes
  *
  * @param {String} key - The property of the schedule
  */
var defaultKeyMap = function( key ) {
    var containerKeymap = {};
    containerKeymap.object_name = 'name';
    containerKeymap.object_desc = 'description';
    containerKeymap.item_id = 'id';
    containerKeymap.customer_name = 'customerName';
    containerKeymap.customer_number = 'customerNumber';
    containerKeymap.start_date = 'startDate';
    containerKeymap.finish_date = 'finishDate';
    containerKeymap.fnd0status = 'status';
    containerKeymap.published = 'published';
    containerKeymap.percent_linked = 'percentLinked';
    containerKeymap.is_public = 'isPublic';
    containerKeymap.is_template = 'isTemplate';

    return containerKeymap[ key ];
};

/**
  * Prepare the input for create Schedule SOA call
  *
  * @param {Object} data - The qualified data of the viewModel
  * @param {Array} defaultProperties - Default properties of the schedule
  * *@return {Array} newScheduleProperties - Schedule Properties Array
  */
export let getNewSchedules = function( data, defaultProperties, editHandler ) {
    var newScheduleProperties = [];
    let createType = data.selectedObject.props.type_name.dbValues[0];
    if( data.autoSelectedObject ) {
        createType = data.autoSelectedObject.props.type_name.dbValues[0];
    }

    var viewModelProperties = addObjectUtils.getObjCreateEditableProperties( createType, null, null, editHandler );

    var attribute = {
        stringValueContainer: []
    };
    for( var i = 0; i < viewModelProperties.length; i++ ) {
        var defaultAttribute = false;
        var j = 0;
        for( j in defaultProperties ) {
            if( viewModelProperties[ i ].propertyName === defaultProperties[ j ] ) {
                defaultAttribute = true;
                break;
            }
        }
        if( defaultAttribute ) {
            var key = defaultProperties[ j ];
            if( key === 'start_date' || key === 'finish_date' ) {
                if( !isValidDate( viewModelProperties[ i ] ) ) {
                    throw 'invalidStartDateOrFinishDate';
                }
                var value = exports.getDateString( viewModelProperties[ i ].dateApi.dateObject );

                var propertyName = defaultKeyMap( key );
                attribute[ propertyName ] = value;
            } else if( key === 'fnd0TimeZone' || key === 'end_date_scheduling' ) {
                attribute.stringValueContainer.push( {
                    key: key,
                    value: getValue( viewModelProperties[ i ] ),
                    type: getType( viewModelProperties[ i ].type )
                } );
            } else {
                propertyName = defaultKeyMap( key );
                attribute[ propertyName ] = viewModelProperties[ i ].dbValue;
            }
        }
    }

    attribute.stringValueContainer.push( {
        key: 'relateToNewStuff',
        value: 'true',
        type: 7
    } );

    attribute.taskFixedType = 0;
    attribute.type = createType;
    attribute.priority = 3;
    attribute.notificationsEnabled = true;
    attribute.typedAttributesContainer = [ {
        type: 'ScheduleType',
        attributes: exports.getScheduleTypedAttributesContainer( data, defaultProperties, createType, editHandler )
    } ];

    newScheduleProperties.push( attribute );

    return newScheduleProperties;
};

var resetTimeForDate = function( date, isFinishDate ) {
    var hours = 8;
    if( isFinishDate ) {
        hours = 17;
    }
    date.setHours( hours );
    date.setMinutes( 0 );
    date.setSeconds( 0 );
    return date;
};

var setDateValueForProp = function( vmoProp, dateVal ) {
    uwPropertyService.setValue( vmoProp, dateVal.getTime() );
    vmoProp.dateApi.dateObject = dateVal;
    vmoProp.dateApi.dateValue = dateTimeSvc.formatDate( dateVal, dateTimeSvc
        .getSessionDateFormat() );
    vmoProp.dateApi.timeValue = dateTimeSvc.formatTime( dateVal, dateTimeSvc
        .getSessionDateFormat() );
};

export let populateDefaultValuesForSchedule = function( data ) {
    //First mark properties as required. So even if some error occurs in setting one of the properties
    // at least the properties are marked required.
    var timeZoneProp = data.fnd0TimeZone;
    if( timeZoneProp ) {
        uwPropertyService.setIsRequired( timeZoneProp, true );
    }

    var startDateProp = data.start_date;
    if( startDateProp ) {
        uwPropertyService.setIsRequired( startDateProp, true );
    }

    var finishDateProp = data.finish_date;
    if( finishDateProp ) {
        uwPropertyService.setIsRequired( finishDateProp, true );
    }

    if( timeZoneProp && appCtxService.ctx.preferences.SiteTimeZone && appCtxService.ctx.preferences.SiteTimeZone.length > 0 ) {
        var timeZone = appCtxService.ctx.preferences.SiteTimeZone[ 0 ];
        timeZoneProp.uiValue = timeZone;
        timeZoneProp.uiValues[ 0 ] = timeZone;
        uwPropertyService.setValue( timeZoneProp, timeZone );
    }
    if( startDateProp ) {
        var startDate = new Date();
        startDate = resetTimeForDate( startDate, false );
        setDateValueForProp( startDateProp, startDate );
    }
    if( finishDateProp ) {
        var finishDate = new Date();
        finishDate = resetTimeForDate( finishDate, true );
        var currentMonth = finishDate.getMonth();
        currentMonth += 3;
        if( currentMonth > 11 ) {
            currentMonth -= 11;
            finishDate.setFullYear( finishDate.getFullYear() + 1 );
        }
        finishDate.setMonth( currentMonth );
        setDateValueForProp( finishDateProp, finishDate );
    }
};

var getDateBasedOnFinishDateScheduling = function( date, schStartDate, schFinishDate, isFinishDateSchedule, isFinishDate ) {
    var dateToUse = schStartDate;
    if( isFinishDateSchedule ) {
        dateToUse = schFinishDate;
    }
    var startDateComparison = dateTimeSvc.compare( date, schStartDate );
    var finishDateComparison = dateTimeSvc.compare( date, schFinishDate );
    if( startDateComparison < 0 || finishDateComparison > 0 ) {
        date = dateToUse;
    }
    date = resetTimeForDate( date, isFinishDate );
    return date;
};

export let populateDefaultValuesForScheduleTask = function( data, ctx ) {
    var schedule;
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
        schedule = ctx.selected;
    } else {
        schedule = cdm.getObject( ctx.selected.props.schedule_tag.dbValues[ 0 ] );
    }

    var schStartDateStr = schedule.props.start_date.dbValues[ 0 ];
    var schStartDate = new Date( schStartDateStr );
    var schFinishDateStr = schedule.props.finish_date.dbValues[ 0 ];
    var schFinishDate = new Date( schFinishDateStr );
    var isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';

    var startDateProp = data.start_date;
    if( startDateProp ) {
        var startDate = new Date();
        startDate = getDateBasedOnFinishDateScheduling( startDate, schStartDate, schFinishDate, isFinishDateSchedule, false );
        setDateValueForProp( startDateProp, startDate );
        uwPropertyService.setIsRequired( startDateProp, true );
    }

    var finishDateProp = data.finish_date;
    if( finishDateProp ) {
        var finishDate = new Date();
        finishDate = getDateBasedOnFinishDateScheduling( finishDate, schStartDate, schFinishDate, isFinishDateSchedule, true );
        setDateValueForProp( finishDateProp, finishDate );
        uwPropertyService.setIsRequired( finishDateProp, true );
    }
};

exports = {
    addSelectedObject,
    autoSelectType,
    getScheduleTasks,
    getTypedAttributesContainer,
    getScheduleTypedAttributesContainer,
    getDateString,
    getSchedule,
    getParentTask,
    getNewParentTask,
    getScheduleTask,
    getWorkEstimate,
    dateValidation,
    getMoveTaskContainer,
    validateInput,
    getPreviousTask,
    getScheduleTag,
    getScheduleUid,
    getCreateSchedulePanel,
    getSecondaryObjForCreateRelations,
    handleDefaultSelectionForPalette,
    handlePaletteSelection,
    getCreateSchTaskProperties,
    getNewSchedules,
    processScheduleResponseObjects,
    populateDefaultValuesForSchedule,
    populateDefaultValuesForScheduleTask
};
