// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/Saw1CreateScheduleTaskService
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeSvc from 'js/dateTimeService';
import saw1CreateObjectUtils from 'js/Saw1CreateObjectUtils';
import smConstants from 'js/ScheduleManagerConstants';
import uwDirectiveDateTimeSvc from 'js/uwDirectiveDateTimeService';
import xrtUtilities from 'js/xrtUtilities';

let exports = {};

/**
 * Method for invoking and registering/unregistering data for the Create Sch Task Panel
 *
 * @param {String} commandId - Command Id for the Create Sch Task
 * @param {String} location - Location of the Create Sch Task command
 */
let getScheduleTaskDefaultProperties = ( ) => {
    return [ 'object_name', 'object_desc', 'work_estimate', 'ResourceAssignment',
        'fnd0workflow_owner', 'item_id', 'object_type', 'items_tag', 'workflow_trigger_type', 'work_remaining',
        'fnd0state', 'is_baseline', 'fnd0status', 'complete_percent', 'work_complete', 'actual_finish_date',
        'actual_start_date', 'auto_complete', 'constraint', 'fixed_type', 'priority', 'duration',
        'approved_work_update', 'finish_date', 'wbs_code', 'start_date', 'workflow_template',
        'sch_task_deliverable_list', 'fnd0PriorityString', 'fnd0DurationString', 'fnd0ConstraintString',
        'fnd0FixedTypeString', 'owning_user', 'fnd0WorkEffortString', 'saw1WorkflowTemplate',
        'saw1WorkflowTriggerType', 'act_date_preference', 'is_public', 'fnd0ShiftDate', 'fnd0PriorityString',
        'fnd0TimeZone', 'published'
    ];
};

/**
 * Prepare the container for the custom properties of the Schedule Task
 *
 * @param {array} createType - Type of object being created
 * @return {array} customProperties - Custom properties array
 */
export let getTypedAttributesContainer = ( createType, editHandler ) => {
    let customProperties = [];
    let viewModelProperties = addObjectUtils.getObjCreateEditableProperties( createType, null, null, editHandler );

    let defaultProperties = getScheduleTaskDefaultProperties();
    viewModelProperties.forEach( vmProp => {
        if( defaultProperties.findIndex( propName => propName === vmProp.propertyName ) === -1 ) {
            customProperties.push( {
                attrName: vmProp.propertyName,
                attrValue: saw1CreateObjectUtils.getValueAsString( vmProp ),
                attrType:  0 // Set a dummy value. This is unused on the server;
            } );
        }
    } );

    return customProperties;
};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {dateObject} dateObject - The date object
 * @return {dateValue} The date string value
 */
export let getDateString = ( dateObject ) => {
    let dateValue = {};
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
 * @return {object} schedule - The schedule task of the selected task
 */
export let getSchedule = ( selectedObj ) => {
    if( cmm.isInstanceOf( 'Schedule', selectedObj.modelType ) ) {
        return selectedObj;
    } else if( cmm.isInstanceOf( 'ScheduleTask', selectedObj.modelType ) ) {
        return cdm.getObject( selectedObj.props.schedule_tag.dbValues[ 0 ] );
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
export let getParentTask = ( selectedObj ) => {
    if( cmm.isInstanceOf( 'Schedule', selectedObj.modelType ) ) {
        return cdm.getObject( selectedObj.props.fnd0SummaryTask.dbValues[ 0 ] );
    } else if( cmm.isInstanceOf( 'ScheduleTask', selectedObj.modelType ) ) {
        if( selectedObj.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
            return selectedObj; // Use Schedule summary as the parent
        }
        return cdm.getObject( selectedObj.props.fnd0ParentTask.dbValues[ 0 ] );
    }
};

/**
 * Calculate the work estimate based on the string value and duration unit.
 *
 * @param {String} workEstimateStringdbValue The string value
 * @param {String} duration duration unit
 * @returns {String} work estimate
 */
let calculateWorkEstimateValue = ( workEstimateStringdbValue, duration ) => {
    let workEstimateValue = '';
    let len = workEstimateStringdbValue.length;
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
 * @returns {integer} work estimate
 */
let getWorkEstimateValue = ( workEstimateStringdbValue ) => {
    let len = workEstimateStringdbValue.length;
    let duration = workEstimateStringdbValue.slice( -1 ).toLowerCase();

    let workEstimateValue = undefined;
    if( duration === 'h' || duration === 'd' || duration === 'w' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringdbValue.substring( 0, len - 1 ) ) === false ) {
            throw 'workEstimateErrorMsg';
        }
        workEstimateValue = calculateWorkEstimateValue( workEstimateStringdbValue, duration );
    } else {
        duration = workEstimateStringdbValue.slice( -2 ).toLowerCase();
        if( duration === 'mo' ) {
            if( /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringdbValue.substring( 0, len - 2 ) ) === false ) {
                throw 'workEstimateErrorMsg';
            }
            workEstimateValue = calculateWorkEstimateValue( workEstimateStringdbValue, duration );
        }
    }

    let workEstimate = null;
    if( workEstimateValue && workEstimateValue >= 0 ) {
        workEstimate = parseInt( workEstimateValue );
        return workEstimate;
    }
    throw 'workEstimateErrorMsg';
};

/**
 * Checks validity for given date
 * @param {Date} date : Date
 * @returns {boolean} : Returns true if valid date
 */
let isValidDate = function( date ) {
    let isValidDate = true;
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
 * Validates the start, finish date, work estimate
 * @param {Object} data view model
 */
export let validateCreateTaskInputs = function( data ) {
    // Validate start and finish dates
    if( !isValidDate( data.start_date ) || !isValidDate( data.finish_date ) ) {
        throw 'invalidStartDateOrFinishDate';
    }

    let taskStartDate = new Date( data.start_date.dateApi.dateObject );
    let taskFinishDate = new Date( data.finish_date.dateApi.dateObject );

    if( taskStartDate.toString() === 'Invalid Date' || taskFinishDate.toString() === 'Invalid Date' ) {
        throw 'scheduleTaskDateBoundaryError';
    }

    if( taskFinishDate.getTime() < taskStartDate.getTime() ) {
        throw 'scheduleTaskStartDateError';
    }

    let selected = appCtxService.getCtx( 'selected' );
    let schedule = selected;
    if( !cmm.isInstanceOf( 'Schedule', selected.modelType ) ) {
        schedule = cdm.getObject( selected.props.schedule_tag.dbValues[ 0 ] );
    }

    let scheduleStartDate = new Date( schedule.props.start_date.dbValues[ 0 ] );
    let scheduleFinishDate = new Date( schedule.props.finish_date.dbValues[ 0 ] );
    if(  taskStartDate.getTime() < scheduleStartDate.getTime()  ||
         scheduleFinishDate.getTime() < taskFinishDate.getTime()  ) {
        throw 'scheduleTaskDateBoundaryError';
    }

    // Validate work estimate
    let workEstimateStringdbValue = data.fnd0WorkEffortString.dbValue;
    let workEstimateStringValue = workEstimateStringdbValue.replace( / /g, '' );
    let workEstimate = 480;
    let unitOfTimeMeasure = schedule.props.saw1UnitOfTimeMeasure.dbValues[ 0 ];
    if( workEstimateStringValue !== '' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( workEstimateStringValue ) ) {
            workEstimateStringdbValue += unitOfTimeMeasure;
        }
        workEstimate = getWorkEstimateValue( workEstimateStringdbValue );
    }

    return workEstimate;
};

/**
 * Return moveRequests container for the "moveTasks" SOA operation
 *
 * @param {object} targetTask - target Task object for the "moveTasks" SOA operation
 * @param {sourceObjects} sourceObjects - Objects from the palette
 * @return {moveRequestsContainer} moveRequests container for the "moveTasks" SOA operation
 */
export let getMoveTaskContainer = ( targetTask, sourceObjects ) => {
    let moveRequests = [];
    sourceObjects.forEach( sourceObject => {
        if( sourceObject.uid !== targetTask.uid ) {
            moveRequests.push( {
                task: sourceObject,
                newParent: getParentTask( targetTask ),
                prevSibling: targetTask
            } );
        }
    } );

    return moveRequests;
};

/**
 * Validates the input for the "moveTasks" SOA operation
 *
 * @param {object} targetTask - target Task object for the "moveTasks" SOA operation
 */
export let validateMoveTaskInputs = ( targetTask ) => {
    if( targetTask === null || cmm.isInstanceOf( 'Schedule', targetTask.modelType ) ) {
        throw 'scheduleTaskMoveNoTargetTaskErrorMsg';
    } else if( targetTask.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
        throw 'scheduleSummaryTaskMoveErrorMsg';
    }
};

/**
 * Return the previous task of the selected task (if any)
 *
 * @return {object} selectedObj - The selected object if the selected object is a schedule task
 */
export let getPreviousTask = ( selectedObj ) => {
    if( cmm.isInstanceOf( 'ScheduleTask', selectedObj.modelType ) ) {
        let schedule = cdm.getObject( selectedObj.props.schedule_tag.dbValues[ 0 ] );
        if( selectedObj.uid !== schedule.props.fnd0SummaryTask.dbValues[ 0 ] ) {
            return selectedObj;
        }
    }
};

let getDefaultDates = ( schStartDate, schFinishDate, isFinishDateSchedule ) => {
    let date = new Date();
    let startDateComparison = dateTimeSvc.compare( date, schStartDate );
    let finishDateComparison = dateTimeSvc.compare( date, schFinishDate );
    if( startDateComparison < 0 || finishDateComparison > 0 ) {
        date = new Date( schStartDate.getTime() );
        if( isFinishDateSchedule ) {
            date = new Date( schFinishDate.getTime() );
        }
    }

    let startDate = new Date( date.getTime() );
    let finishDate = new Date( date.getTime() );
    startDate = saw1CreateObjectUtils.resetTimeForDate( startDate, false );
    finishDate = saw1CreateObjectUtils.resetTimeForDate( finishDate, true );
    return [ startDate, finishDate ];
};

/**
 * Populates the create task panel with the default values for the date fields.
 *
 * @param {String} createType The object type being created
 * @param {Object} selectedObject The selected model object
 * @param {Object} edithandler The editHandler
 * */
export let initializeDefaultProps = ( createType, selectedObject, editHandler ) => {
    let schedule = selectedObject;
    if( !cmm.isInstanceOf( 'Schedule', selectedObject.modelType ) ) {
        schedule = cdm.getObject( selectedObject.props.schedule_tag.dbValues[ 0 ] );
    }

    let schStartDate = new Date( schedule.props.start_date.dbValues[ 0 ] );
    let schFinishDate = new Date( schedule.props.finish_date.dbValues[ 0 ] );
    let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';
    const [ startDate, finishDate ] = getDefaultDates( schStartDate, schFinishDate, isFinishDateSchedule );

    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, 'CREATE', [ 'start_date', 'finish_date' ], editHandler );

    // Start date
    if( editableProperties.start_date ) {
        let startDateProp = { ...editableProperties.start_date };
        startDateProp.dbValue = new Date( startDate.toString() ).getTime();
        startDateProp.value = new Date( startDate.toString() ).getTime();
        startDateProp.isRequired = true;
        startDateProp.uiValue = startDate.toDateString();
        updatedProps.push( startDateProp );
    }

    // Finish date
    if( editableProperties.finish_date ) {
        let finishDateProp = { ...editableProperties.finish_date };
        finishDateProp.dbValue = new Date( finishDate.toString() ).getTime();
        finishDateProp.value = new Date( finishDate.toString() ).getTime();
        finishDateProp.isRequired = true;
        finishDateProp.uiValue = finishDate.toDateString();
        updatedProps.push( finishDateProp );
    }

    if( updatedProps.length > 0 ) {
        xrtUtilities.updateObjectsInDataSource( updatedProps, 'CREATE', createType );
    }
};

/**
 * Get updated objects for page refresh with based on subPanelContext data
 *
 * @param {Object} subPanelContext
 * */
export let getObjectForRefresh = function( subPanelContext ) {
    var modelObject = [];
    if( subPanelContext && ( subPanelContext.vmo || subPanelContext.openedObject ) ) {
        modelObject.push( cdm.getObject( subPanelContext.vmo ? subPanelContext.vmo.uid : subPanelContext.openedObject.uid ) );
    }
    return modelObject;
};

exports = {
    getTypedAttributesContainer,
    getDateString,
    getSchedule,
    getParentTask,
    validateCreateTaskInputs,
    getMoveTaskContainer,
    validateMoveTaskInputs,
    getPreviousTask,
    initializeDefaultProps,
    getObjectForRefresh
};

export default exports;
