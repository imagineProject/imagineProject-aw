// Copyright (c) 2022 Siemens

/**
 * Service that provides APIs for quick creation of scheduling objects.
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1QuickCreateService
 */
import dateTimeService from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import smConstants from 'js/ScheduleManagerConstants';

var exports = {};

var QUICK_CREATE_DEFAULTS = {
    TASK_NAME: 'Task',
    MILESTONE_NAME: 'Milestone',
    TASK_BO_TYPE: 'ScheduleTask',
    TASK_WORK_ESTIMATE: 480,
    MILESTONE_WORK_ESTIMATE: 0,
    STANDARD_TASK_TYPE: 0,
    MILESTONE_TYPE: 1
};

/**
 * Returns input data for quick creation of task.
 *
 * @param {Object} ctx - The Context object
 * @param {boolean} isMilestone is this a milestone?
 * @returns {Object} create task input.
 */
export let getQuickCreateInput = function( ctx, isMilestone ) {
    var selectedTask = ctx.selected;

    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
        selectedTask = cdm.getObject( ctx.selected.props.fnd0SummaryTask.dbValues[ 0 ] );
    }

    var selTaskType = selectedTask.props.task_type.dbValues[ 0 ];

    var createBOType = QUICK_CREATE_DEFAULTS.TASK_BO_TYPE;

    if( ctx.preferences.ScheduleTaskClassNameToCreate ) {
        createBOType = ctx.preferences.ScheduleTaskClassNameToCreate[ 0 ];
    }

    var createContainers = [ {
        name: isMilestone ? QUICK_CREATE_DEFAULTS.MILESTONE_NAME : QUICK_CREATE_DEFAULTS.TASK_NAME,
        objectType: createBOType,
        parent: selTaskType === smConstants.TASK_TYPE.SS ? selectedTask : cdm.getObject( selectedTask.props.fnd0ParentTask.dbValues[ 0 ] ),
        prevSibling: selTaskType === smConstants.TASK_TYPE.SS ? null : selectedTask,
        otherAttributes: [ {
            attrName: 'priority',
            attrValue: '3',
            attrType: 3
        },
        {
            attrName: 'task_type',
            attrValue: isMilestone ? smConstants.TASK_TYPE.M : smConstants.TASK_TYPE.T,
            attrType: 3
        }
        ],
        typedOtherAttributes: [ {
            objectType: 'ScheduleTaskType',
            updates: []
        } ]
    } ];

    var schedule = cdm.getObject( selectedTask.props.schedule_tag.dbValues[ 0 ] );

    // If the selected task is not a Schedule Summary, use the selected
    // task's start/finish dates for the new task.
    if( selTaskType !== smConstants.TASK_TYPE.SS ) {
        if( isMilestone || selectedTask.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.M ) {
            createContainers[ 0 ].workEstimate = isMilestone ? QUICK_CREATE_DEFAULTS.MILESTONE_WORK_ESTIMATE :
                QUICK_CREATE_DEFAULTS.TASK_WORK_ESTIMATE;
            let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';
            if( isFinishDateSchedule ) {
                createContainers[ 0 ].finish = selectedTask.props.finish_date.dbValues[ 0 ];
            } else {
                createContainers[ 0 ].start = selectedTask.props.start_date.dbValues[ 0 ];
            }
        } else {
            createContainers[ 0 ].start = selectedTask.props.start_date.dbValues[ 0 ];
            createContainers[ 0 ].finish = selectedTask.props.finish_date.dbValues[ 0 ];
            createContainers[ 0 ].workEstimate = parseInt( selectedTask.props.work_estimate.dbValues[ 0 ] );
        }
    } else {
        // If the selected object is Schedule Summary, use the schedule's
        // start/finish dates for the new task.
        createContainers[ 0 ].workEstimate = isMilestone ? QUICK_CREATE_DEFAULTS.MILESTONE_WORK_ESTIMATE : QUICK_CREATE_DEFAULTS.TASK_WORK_ESTIMATE;

        var today = new Date();
        today.setHours( 0, 0, 0 );
        var schStartDate = new Date( schedule.props.start_date.dbValues[ 0 ] );
        var schFinishDate = new Date( schedule.props.finish_date.dbValues[ 0 ] );
        if( dateTimeService.compare( today, schStartDate ) < 0 || dateTimeService.compare( today, schFinishDate ) > 0 ) {
            let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';

            if( isFinishDateSchedule ) {
                createContainers[ 0 ].finish = dateTimeService.formatUTC( schFinishDate );
            } else {
                createContainers[ 0 ].start = dateTimeService.formatUTC( schStartDate );
            }
        } else {
            createContainers[ 0 ].start = dateTimeService.formatUTC( today );
        }
    }

    return {
        schedule: schedule,
        createContainers: createContainers
    };
};

exports = {
    getQuickCreateInput
};
export default exports;
