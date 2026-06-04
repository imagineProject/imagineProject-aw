// Copyright (c) 2022 Siemens

/**
 * @module js/SchGanttUtils
 */
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dataSource from 'js/Saw1SchGanttDataSource';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import ctxService from 'js/appCtxService';
import smConstants from 'js/ScheduleManagerConstants';
import ganttManager from 'js/uiGanttManager';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import _dateTimeSvc from 'js/dateTimeService';
import _cdm from 'soa/kernel/clientDataModel';
import _cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/**
 * The Map of uid to time line info..
 */
var infoMap = new Object();

/**
 * The Map of uid to IModelObject.
 */
var infoToModelMap = new Object();

/**
 * This function will return if the schedule is Finish Date or not.
 *
 * @param {String} id - uid of Task.
 * @return {Boolean} result - The flag that will the finish date Schedule.
 */
export let isFinishDateScheduleForTask = function( id ) {
    let result = false;
    let task = cdm.getObject( id );
    let answer = null;
    let schedule = null;
    if( task && task.props && task.props.schedule_tag ) {
        let type = getObjectType( task );
        let scheduleProp = null;
        if( type === 3 ) { //PROXY_TASK_TYPE
            let homeTaskProp = task.props.fnd0task_tag.dbValues[ 0 ];
            let homeTask = cdm.getObject( homeTaskProp );
            scheduleProp = homeTask.props.schedule_tag.dbValues[ 0 ];
        } else if( type === 1 ) { //SCHEDULE_TASK_TYPE
            scheduleProp = task.props.schedule_tag.dbValues[ 0 ];
        }
        if( scheduleProp ) {
            schedule = cdm.getObject( scheduleProp );
            if( schedule && schedule.props && schedule.props.end_date_scheduling ) {
                let isFinishDateScheduleProp = schedule.props.end_date_scheduling.dbValues[ 0 ];
                answer = isFinishDateScheduleProp;
                if( answer ) {
                    result = answer === 'true' || answer === '1'; //getting the boolean value of answer in result
                }
            }
        }
    }
    return result;
};

/**
 * This function will determine the type of Object.
 *
 * @param {Object} modelObject - The Model Object
 * @return {Integer} type - Any other Type: 0, Schedule Task Type: 1, Task Dependency Type: 2, ProxyTask Type =
 *         3
 */
export let getObjectType = function( modelObject ) {
    let objType = modelObject.modelType;
    let type;
    if( cmm.isInstanceOf( 'ScheduleTask', objType ) ) {
        type = 1;
    } else if( cmm.isInstanceOf( 'TaskDependency', objType ) ) {
        type = 2;
    } else if( cmm.isInstanceOf( 'Fnd0ProxyTask', objType ) ) {
        type = 3;
    } else {
        type = 0;
    }
    return type;
};

/**
 * This function will invoke when we drag the task.
 *
 * @param {String} id - Id of the task to be dragged.
 * @param {Date} startDate - Start Date Object.
 * @param {Date} endDate - End Date Object.
 * @param {String} mode - Mode of the drag.
 */
export let onTaskDrag = function( id, startDate, endDate, mode ) {
    let taskObject = cdm.getObject( id );
    let sd = new Date( startDate );
    let fd = new Date( endDate );
    let updateContainer = null;
    if( id !== null ) {
        if( mode === 'resize' ) {
            let diff = fd.getTime() - sd.getTime();
            let diffInMinutes = parseInt( diff / ( 1000 * 60 ) );
            let convertToMilestone = false;
            if( diffInMinutes < 90 ) {
                convertToMilestone = true;
            }
            let dateToSet = 'finish_date';
            let date = fd;
            let isFinishDateSch = exports.isFinishDateScheduleForTask( id );
            if( isFinishDateSch ) {
                //Finish Date Schedule case. Update only start date for task resize.
                dateToSet = 'start_date';
                date = sd;
                if( convertToMilestone ) {
                    //assign finish date to start date to convert to milestone
                    date = fd;
                }
            } else if( convertToMilestone ) {
                //assign finish date to start date to convert to milestone
                date = sd;
            }
            updateContainer = getObjectUpdateContainerForReSize( taskObject, dateToSet, date );
        } else if( mode === 'move' ) {
            let startDateProp = taskObject.props.start_date.dbValues[ 0 ];
            let oldStartDate = new Date( startDateProp );
            let finishDateProp = taskObject.props.finish_date.dbValues[ 0 ];
            let oldFinishDate = new Date( finishDateProp );
            //This will read the hours and minute before drag and will assign to new date.
            //This way it will not have different hours depending on the amount of drag
            sd.setHours( oldStartDate.getHours() );
            sd.setMinutes( oldStartDate.getMinutes() );
            fd.setHours( oldFinishDate.getHours() );
            fd.setMinutes( oldFinishDate.getMinutes() );

            let dateToSet = 'start_date';
            let date = sd;
            let isFinishDateSch = exports.isFinishDateScheduleForTask( id );
            if( isFinishDateSch ) {
                //Finish Date Schedule case. Update only start date for task resize.
                dateToSet = 'finish_date';
                date = fd;
            }
            updateContainer = getObjectUpdateContainerForMove( taskObject, dateToSet, date );
        }
        let updates = [];
        updates.push( updateContainer );
        let updateTasksInfo = {
            schedule: cdm.getObject( taskObject.props.schedule_tag.dbValues[ 0 ] ),
            updates: updates
        };
        eventBus.publish( 'SchTaskDragEvent', updateTasksInfo );
    }
};

/**
 * This function will return the container for the resizing the task Object.
 *
 * @param {Object} scheduleTask - The schedule task to update.
 * @param {String} dateAttribute - Date attribute name. Possible values Start Date or Finish Date.
 * @param {Date} date - The Date value.
 * @return {Object} objectUpdateContainerInfo - the list of ObjectUpdateContainer
 */
var getObjectUpdateContainerForReSize = function( scheduleTask, dateAttribute, date ) {
    var objectUpdateContainerInfo = {};
    var updates = [];
    var attrContainer1 = {
        attrName: 'taskResized',
        attrValue: 'true',
        attrType: 3
    };
    var attrContainer2 = {
        attrName: dateAttribute,
        attrValue: dateTimeSvc.formatUTC( date ),
        attrType: 7
    };
    updates.push( attrContainer1 );
    updates.push( attrContainer2 );

    objectUpdateContainerInfo = {
        object: scheduleTask,
        updates: updates
    };
    return objectUpdateContainerInfo;
};

/**
 * This function will make the container for the Object to be update.
 *
 * @param {Object} scheduleTask - The schedule task to update.
 * @param {String} dateAttribute - Date attribute name. Possible values Start Date or Finish Date.
 * @param {Date} date - The Date value.
 * @return {Object} objectUpdateContainerInfo - the list of ObjectUpdateContainer
 */
var getObjectUpdateContainerForMove = function( scheduleTask, dateAttribute, date ) {
    var objectUpdateContainerInfo = {};
    var updates = [];
    var attrContainer = {
        attrName: dateAttribute,
        attrValue: dateTimeSvc.formatUTC( date ),
        attrType: 7
    };
    updates.push( attrContainer );

    objectUpdateContainerInfo = {
        object: scheduleTask,
        updates: updates
    };
    return objectUpdateContainerInfo;
};

export let onBeforeTaskReorder = function( srcTaskId ) {
    var source = cdm.getObject( srcTaskId );
    if( getObjectType( source ) === 3 || source.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
        // if source task is PROXY_TASK or Schedule Summary Task, then do not allow tasks to be drag dropped.
        return false;
    }
    return true;
};

/**
 * This function will invoke when we drag the task.
 *
 * @param {String} srcTask - Id of the task to be dragged.
 * @param {String} targetTask - Mode of the drag.
 */
export let onTaskReorder = function( srcTaskId, targetTaskId, parentId, taskIndexToMove ) {
    var srcTask = dataSource.instance.getTask( srcTaskId );
    var targetTask = dataSource.instance.getTask( targetTaskId );
    var moveRequests = [];
    var sourceSchedule;
    var targetSchedule;
    var moveTaskReqObject;

    if( targetTask ) {
        var targetTaskInfo = dataSource.instance.getTaskInfo( targetTaskId );
        if( targetTaskInfo.taskType === 5 ) { //PROXY_TASK
            return false;
        }
        var summaryTaskId = targetTask.props.fnd0ParentTask.dbValues[ 0 ];
        var parentTask = null;
        if( summaryTaskId !== null ) {
            parentTask = dataSource.instance.getTask( summaryTaskId );
        }

        var srcIndex = ganttManager.getGanttInstance()._order.indexOf( srcTaskId );
        var targetIndex = ganttManager.getGanttInstance()._order.indexOf( targetTaskId );

        if( targetIndex > 0 && srcIndex < targetIndex ) {
            targetTaskId = ganttManager.getGanttInstance()._order[ targetIndex - 2 ];
            targetTask = dataSource.instance.getTask( targetTaskId );
        }
        targetTaskInfo = dataSource.instance.getTaskInfo( targetTaskId );
        if( targetTaskInfo.taskType === 5 ) { //Proxy Task
            var refTaskId = targetTask.props.fnd0ref.dbValues[ 0 ];
            targetTask = dataSource.instance.getTask( refTaskId );
        }
        var schSummaryTask = cdm.getObject( dataSource.instance.getSourceObject().props.fnd0SummaryTask.dbValues[ '0' ] );
        sourceSchedule = srcTask.props.schedule_tag.dbValues[ 0 ];
        targetSchedule = targetTask.props.schedule_tag.dbValues[ 0 ];
        var checkTargetSummaryTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ 0 ] );

        if( !checkTargetSummaryTask ) {
            if( sourceSchedule === targetSchedule ) {
                targetSchedule = targetTask.props.fnd0ParentTask.dbValues[ 0 ];
            } else {
                targetSchedule = sourceSchedule;
            }
        }
        if(parentTask){
            moveTaskReqObject = prepareMoveTaskReqObject( parentTask, targetTask, srcTask, schSummaryTask );
        }
    } else {
        parentTask = dataSource.instance.getTask( parentId );

        sourceSchedule = srcTask.props.schedule_tag.dbValues[ 0 ];
        targetSchedule = parentTask.props.schedule_tag.dbValues[ 0 ];

        moveTaskReqObject = {
            task: srcTask,
            newParent: parentTask,
            prevSibling: targetTask
        };
    }
    moveRequests.push( moveTaskReqObject );
    var moveTaskInfo = {
        schedule: dataSource.instance.getSourceObject(),
        moveRequests: moveRequests,
        taskIndexToMove: taskIndexToMove
    };

    if( sourceSchedule !== targetSchedule ) {
        eventBus.publish( 'warningMessageForMoveTaskAcrossSchedules', moveTaskInfo );
    } else {
        eventBus.publish( 'SchTaskReorderEvent', moveTaskInfo );
    }
};

var prepareMoveTaskReqObject = function( parentTask, targetTask, srcTask, schSummaryTask ) {
    var moveTaskReqObject;
    var newParent;
    var prevSibling;
    var task = srcTask;

    if( parentTask === targetTask ) {
        var newParentTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ '0' ] );
        prevSibling = targetTask;
        newParent = schSummaryTask;

        if( newParentTask && targetTask.props.fnd0ParentTask.dbValues[ '0' ] !== parentTask.uid ) {
            newParent = newParentTask;
        }
    } else if( srcTask !== targetTask ) {
        var prevSiblingTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ '0' ] );
        newParent = parentTask;
        prevSibling = targetTask;
        if( prevSiblingTask && targetTask.props.fnd0ParentTask.dbValues[ '0' ] !== parentTask.uid ) {
            prevSibling = prevSiblingTask;
        }
    }

    moveTaskReqObject = {
        task: task,
        newParent: newParent,
        prevSibling: prevSibling
    };

    return moveTaskReqObject;
};

/**
 * Function to update the Gantt on Cancel Action.
 *
 * @param {int} taskIndexToMove - the index of task to move
 * @param {Array} moveRequests
 */
export let moveTaskCancelAction = function( taskIndexToMove, moveRequests ) {
    var srcTask = moveRequests[ '0' ].task;
    ganttManager.getGanttInstance().moveTask( srcTask.uid, taskIndexToMove, srcTask.props.fnd0ParentTask.dbValues[ '0' ] );
};

export let getObjectToUpdated = function( eventMap ) {
    var schTaskUid = eventMap.SchTaskDragEvent.updates[ 0 ].object.uid;
    return cdm.getObject( schTaskUid );
};

export let selectLink = function( id ) {
    var oldSelection = ganttManager.getSelectedLink();
    var newSelection = id;

    ganttManager.setSelectedLink( id );
    if( oldSelection !== newSelection ) {
        if( ganttManager.getGanttInstance().isLinkExists( oldSelection ) ) {
            ganttManager.getGanttInstance().refreshLink( oldSelection );
        }
        if( ganttManager.getGanttInstance().isLinkExists( newSelection ) ) {
            ganttManager.getGanttInstance().refreshLink( newSelection );
        }
    }
};

export let deleteDependency = function( dependencyToDelete ) {
    if( dependencyToDelete ) {
        var messageParams = {
            dependencyName: dependencyToDelete.props.saw1Name.dbValues[ 0 ]
        };
        eventBus.publish( 'warningMessageForDeletingDependency', messageParams );
    }
};

/**
 * This function will create the link .
 *
 * @param {String} type - type of the link.
 * @param {Object} source - Source Object
 * @param {Object} target - target Object.
 */
export let createDependency = function( type, source, target ) {
    var dependencyType = dataSource.instance.getGanttTaskDependencyType( type );

    if( dependencyType !== null ) {
        var sourceObject = dataSource.instance.getTask( source );
        var targetObject = dataSource.instance.getTask( target );
        var depType = parseInt( dependencyType );
        //sanity check
        if( sourceObject && targetObject ) {
            var sourceObjectType = sourceObject.modelType;
            var targetObjectType = targetObject.modelType;
            if( cmm.isInstanceOf( 'ScheduleTask', sourceObjectType ) &&
                cmm.isInstanceOf( 'ScheduleTask', targetObjectType ) ) {
                var info = {
                    predTask: sourceObject,
                    succTask: targetObject,
                    depType: depType,
                    schedule: dataSource.instance.getSourceObject()
                };
                eventBus.publish( 'DependencyCreatedViaDrag', info );
            }
        }
    }
};

export let reorderTasks = function( moveRequest ) {
    let srcTaskId = moveRequest.task.uid;
    let prevSibling;
    if( moveRequest.prevSibling && moveRequest.prevSibling.uid ) {
        prevSibling = cdm.getObject( moveRequest.prevSibling.uid );
    }
    if( prevSibling ) {
        let srcTaskIndex = ganttManager.getGanttInstance().getTaskIndex( srcTaskId );
        let prevSiblingIndex = ganttManager.getGanttInstance().getTaskIndex( moveRequest.prevSibling.uid );
        let insertIndex = srcTaskIndex > prevSiblingIndex ? prevSiblingIndex + 1 : prevSiblingIndex;
        ganttManager.getGanttInstance().moveTask( srcTaskId, insertIndex, moveRequest.newParent.uid );
    }
    ganttManager.getGanttInstance().updateTask( srcTaskId );
};

export let removeDeletedObjectsOnGantt = function( deletedObjUids ) {
    deletedObjUids.forEach( function( deletedUid ) {
        var taskExists = ganttManager.getGanttInstance().isTaskExists( deletedUid );

        if( taskExists === true ) {
            ganttManager.getGanttInstance().deleteTask( deletedUid );
        } else {
            var linkExists = ganttManager.getGanttInstance().isLinkExists( deletedUid );
            // Check for dependency
            if( linkExists === true ) {
                ganttManager.getGanttInstance().deleteLink( deletedUid );
            }
        }
    } );
};

/**
 * Resets the Gantt configurtion based on the presence or absence of a baseline to view.
 */
export let resetGanttConfigForBaseline = function() {
    if( ctxService.ctx.layout === 'comfy' ) {
        ganttManager.getGanttInstance().config.bar_height = dataSource.instance.hasBaseline() ? ( dataSource.instance.getBaselines().length > 1 ) ? 18 : 12 : 'full';
    }
    else {
        ganttManager.getGanttInstance().config.bar_height = dataSource.instance.hasBaseline() ? ( dataSource.instance.getBaselines().length > 1 ) ? 18 : 10 : 'full';
    }
    ganttManager.getGanttInstance().config.link_wrapper_width = dataSource.instance.hasBaseline() ? 10 : 20;
};

export let adjustGanttWidth = function() {
    let ganttWrapper = document.getElementsByClassName( 'aw-ganttInterface-ganttWrapper' );
    if( !ganttWrapper[0].style.width ) {
        let ganttVerScroll = document.getElementsByClassName( 'gantt_ver_scroll' );
        let offset = 375;
        if( ganttVerScroll && ganttVerScroll[0].style.display === 'block' ) {
            offset -= 18;
        }
        ganttWrapper[0].style.width = ganttWrapper[0].clientWidth + offset + 'px';
    }
    ganttManager.getGanttInstance().setSizes();
};

export let renderGanttData = function() {
    ganttManager.getGanttInstance().render();
};

/**
 * Method for refreshing the gantt.
 */
export let refreshGanttData = function() {
    ganttManager.getGanttInstance().refreshData();
};

/**
 * Method for sets row height of the gantt.
 * @param {Int} rowHeight The rowHeight of the gantt to be set.
 */
export let setGanttRowHeight = function( rowHeight ) {
    ganttManager.getGanttInstance().config.row_height = rowHeight;
};

/**
 * Returns the list of children loaded in Gantt.
 * @param {String} parentNodeId The UID of the parent task
 * @returns {Array} The list of child tasks
 */
export let getGanttChildTasks = function( parentNodeId ) {
    return ganttManager.getGanttInstance().getChildren( parentNodeId );
};

/**
 * Method for getting the ID of the Selected task.
 * @return {String} The id of the selected task.
 */
export let getSelectedTaskID = function() {
    return ganttManager.getGanttInstance().getSelectedId();
};

export let openGanttTask = function( ganttTaskId ) {
    ganttManager.getGanttInstance().open( ganttTaskId );
};

export let closeGanttTask = function( ganttTaskId ) {
    ganttManager.getGanttInstance().close( ganttTaskId );
};

/**
 * Method for clearing the tasks in the Gantt.
 */
export let clearGanttData = function() {
    ganttManager.getGanttInstance().clearAll();
    dataSource.instance.cleanup();
};

/**
 * Method for parsing and showing the tasks in Gantt.
 * @param {Array} ganttTasks The tasks array to be shown in Gantt
 * @param {Array} ganttLinks The TaskDependency array.
 */
export let parseGanttData = function( ganttTasks, ganttLinks ) {
    let ganttData = {
        data: ganttTasks ? ganttTasks : [],
        links: ganttLinks ? ganttLinks : []
    };
    var scrollState = ganttManager.getGanttInstance().getScrollState();
    ganttManager.getGanttInstance().parse( ganttData, 'json' );
    ganttManager.getGanttInstance().scrollTo( scrollState.x, scrollState.y );
};

export let createNewTask = function( selectedTaskUID, createdObject, data ) {
    //Get the selected task on the gantt this will be our sibling of newly created task.
    var parentTask = null;
    var prevSiblingUID = null;
    var parentUID = null;
    let ganttTask;

    if( selectedTaskUID ) {
        let selectedTaskInfo = dataSource.instance.getTaskInfo( selectedTaskUID );

        if( selectedTaskInfo.taskType !== 6 ) {
            parentUID = selectedTaskInfo.parent;
            parentTask = dataSource.instance.getTask( parentUID );
            prevSiblingUID = selectedTaskUID;
        } else {
            parentTask = cdm.getObject( selectedTaskUID );
            parentUID = selectedTaskUID;
        }
    } else {
        var scheduleSummaryTaskProp = dataSource.instance.getSourceObject().props.fnd0SummaryTask.dbValues[ 0 ];
        parentTask = cdm.getObject( scheduleSummaryTaskProp );
        parentUID = parentTask.uid;
    }

    // If all the pages are loaded, then simply add the last child
    // of the parent as the sibling.
    if( parentTask && dataSource.instance.isPaginationCompletedForParent( parentTask.uid ) && !prevSiblingUID && ganttManager.getGanttInstance().hasChild( parentUID ) ) {
        // Add the last child as the prev sibling.
        var children = exports.getGanttChildTasks( parentUID );
        prevSiblingUID = children[ children.length - 1 ];
        let schTasksList = [];
        schTasksList.push( createdObject );
        let parentTasksList = [];
        parentTasksList.push( parentTask );
        let ganttTasks = dataSource.instance.constructGanttTasks( schTasksList, parentTasksList, data.ganttColumns );
        if( ganttTasks && !_.isEmpty( ganttTasks ) ) {
            ganttTask = ganttTasks[ 0 ];
            dataSource.instance.setTaskPreviousSibling( ganttTask, prevSiblingUID );
        }
    }
    return ganttTask;
};

export let processSchTaskDeliverableObjects = function( response ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    let schTaskDeliverables = [];
    if( response.searchResultsJSON ) {
        let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( let x = 0; x < searchResults.objects.length; ++x ) {
                let uid = searchResults.objects[ x ].uid;
                let obj = response.ServiceData.modelObjects[ uid ];
                if( obj ) {
                    schTaskDeliverables.push( obj );
                }
            }
        }
    }
    return schTaskDeliverables;
};

export let setNonModifiablePropForTaskDeliverables = function( response ) {
    for( let index = 0; index < response.columnConfig.columns.length; index++ ) {
        response.columnConfig.columns[ index ].modifiable = false;
    }
    return response.columnConfig;
};

export let getParentTaskUid = function( ctx ) {
    let taskUid = ctx.mselected[0].uid;
    if( ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) > -1 ) {
        taskUid = ctx.mselected[ 0 ].props.fnd0task_tag.dbValues[ 0 ];
    }
    return taskUid;
};

export let setIsDeliverablesCountCtx = function( ctx ) {
    let parentTaskUid = getParentTaskUid( ctx );
    let scheduleTask = cdm.getObject( parentTaskUid );
    let isDeliverablesExist = false;
    if( scheduleTask.props.saw1DeliverablesCount.dbValues[ 0 ] > 0 ) {
        isDeliverablesExist = true;
    }
    if( ctx.isDeliverablesExist ) {
        ctxService.updateCtx( 'isDeliverablesExist', isDeliverablesExist );
    } else{
        ctxService.registerCtx( 'isDeliverablesExist', isDeliverablesExist );
    }
};

/**
 * construct a Gantt event.
 *
 * @param startDate Planned Date of Event
 * @param programType Program Type
 * @param forecastDate Forecast Date of Event
 * @param actualDate Actual Date of Event
  * @param info info for the milestone Event
 * @return Event object
 */
var constructGanttEvent = function( startDate, programType,
    forecastDate, actualDate, info ) {
    var task = {};
    task.id = info.uid;
    task.text = info.name;
    task.start_date = startDate;
    task.end_date = startDate;
    task.type = 'milestone';
    task.sourceType = 'Event';
    if( info.colorCode.indexOf( '#' ) === 0 ) {
        task.color = info.colorCode;
    } else {
        task.color = '#388ba6';
    }
    if( info.parent !== -1 ) {
        task.parent = info.parent;
    }
    task.programType = programType;
    task.forecastDate = forecastDate;
    task.actualDate = actualDate;
    task.status = info.status;
    task.eventCode = info.eventCode;
    task.rollup = true;
    for( let property in info ) {
        task[property] = info[property];
    }
    let rowHeight = ganttManager.getGanttInstance().config.row_height;
    task.bar_height =  rowHeight - 8;
    return task;
};

/**
 * This function will add the Gantt event.
 *
 * @param {Object} event - Event Object.
 * @return {Object} events - Events Object
 */

export let getGanttEventFromModelObject = function( event ) {
    var info = getGanttEventInfo( event );
    var events;
    var timelineEvent = 'Event';
    var plannedDateObj = new Date( info.plannedDate );
    var forecastDateObj = null;
    if( info.forecastDate ) {
        forecastDateObj = new Date( info.forecastDate );
    }
    var forecastDate = _dateTimeSvc.formatNonStandardDate( forecastDateObj, 'yyyy-MM-dd' );
    var actualDateObj = null;
    if( info.actualDate ) {
        actualDateObj = new Date( info.actualDate );
    }
    var actualDate = _dateTimeSvc.formatNonStandardDate( actualDateObj, 'yyyy-MM-dd' );

    events = constructGanttEvent( plannedDateObj, timelineEvent,
        forecastDate, actualDate, info );
    return events;
};


/**
 * This will add the Gantt Event info.
 *
 * @param {Object} eventObject - eventObject
 * @return {Object} info - info related to added event.
 */

let getGanttEventInfo = function( eventObject ) {
    var info;
    var ObjectUid = [];

    ObjectUid.push( eventObject.uid );

    if( info === null || typeof info === typeof undefined ) {
        var prg0PlanProp = eventObject.props.prg0PlanObject.dbValues[ 0 ];
        var nameProp = eventObject.props.object_name.dbValues[ 0 ];
        var statusProp = eventObject.props.prg0State.uiValues[ 0 ];
        var prgPlanDateProp = eventObject.props.prg0PlannedDate.dbValues[ 0 ];
        var prgForecastDateProp = eventObject.props.prg0ForecastDate.dbValues[ 0 ];
        var prgActualDateProp = eventObject.props.prg0ActualDate.dbValues[ 0 ];
        var eventColor = eventObject.props.pgp0EventColor.dbValues[ 0 ];
        var eventCodeProp = eventObject.props.prg0EventCode.dbValues[ 0 ];

        info = {
            uid: eventObject.uid,
            name: nameProp,
            status: statusProp,
            plannedDate: prgPlanDateProp,
            forecastDate: prgForecastDateProp,
            actualDate: prgActualDateProp,
            colorCode: eventColor,
            parent: prg0PlanProp,
            eventCode: eventCodeProp
        };

        infoToModelMap[ eventObject.uid ] = eventObject;
        infoMap[ eventObject.uid ] = info;
    }
    return info;
};


/**
 * Get all event model objects from DHTMLX Gantt 
 * 
 * @return {Array} events  event model objects from Gantt
 */
export let getAllEventModelObjectsFromGantt = () => {
    let events = [];
    // get all event list from Gannt using DHTMLX API
    ganttManager.getGanttInstance().eachTask( function( task ) {
        let modelObject = _cdm.getObject( task.id );
        if( _cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

/**
 * This will remove the event model objects from Gantt
 *
 */
export let removeAllEventModelObjectsFromGantt = () => {
    let events = exports.getAllEventModelObjectsFromGantt();
    if ( events && events.length > 0 ) {
        removeDeletedObjectsOnGantt( events.map( event => event.uid ) );
    }
};


/**
 * This will add the event model objects to Gantt
 *
 * @param {Object} events - event model objets
 * @param {Object} ganttParent - optional parent object to be updated on events
 */
export let addEventModelObjectsToGantt = ( events, ganttParent ) => {
    let ganttEventArray = [];
    if ( events && events.length > 0 ) {
        if ( ganttParent ) {
            for ( let i = 0; i < events.length; i++ ) {
                events[i].ganttParent = ganttParent;
            }
        }
        events.forEach( node => {
            var typeHierarchy = node.modelType.typeHierarchyArray;
            if ( typeHierarchy.indexOf( 'Prg0AbsEvent' ) > -1 ) {
                let ganttEvent = getGanttEventFromModelObject( node );
                ganttEvent.parent = node.ganttParent;
                ganttEvent.rollup = true;
                ganttEvent.hide_bar = true;
                ganttEventArray.push( ganttEvent );
            }
        } );
        exports.parseGanttData( ganttEventArray );
    }
};

export default exports = {
    isFinishDateScheduleForTask,
    onTaskDrag,
    onBeforeTaskReorder,
    onTaskReorder,
    moveTaskCancelAction,
    getObjectToUpdated,
    getObjectType,
    selectLink,
    deleteDependency,
    createDependency,
    reorderTasks,
    removeDeletedObjectsOnGantt,
    refreshGanttData,
    resetGanttConfigForBaseline,
    adjustGanttWidth,
    renderGanttData,
    getGanttChildTasks,
    getSelectedTaskID,
    openGanttTask,
    closeGanttTask,
    clearGanttData,
    parseGanttData,
    processSchTaskDeliverableObjects,
    setNonModifiablePropForTaskDeliverables,
    getParentTaskUid,
    setIsDeliverablesCountCtx,
    addEventModelObjectsToGantt,
    removeAllEventModelObjectsFromGantt,
    getAllEventModelObjectsFromGantt,
    getGanttEventFromModelObject,
    setGanttRowHeight
};
