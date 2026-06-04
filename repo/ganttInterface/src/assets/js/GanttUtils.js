// Copyright (c) 2022 Siemens

/**
 * @module js/GanttUtils
 */
import ganttManager from 'js/uiGanttManager';
import _ from 'lodash';

var exports = {};

export let updateCreatedObjectsOnGantt = function( tasks, links ) {
    let hasUpdate = false;
    tasks.forEach( function( currentTask ) {
        if( currentTask.prevId ) {
            let prevSiblingIndex = ganttManager.getGanttInstance().getTaskIndex( currentTask.prevId );
            ganttManager.getGanttInstance().addTask( currentTask, currentTask.parent, prevSiblingIndex + 1 );
        }else if ( currentTask.taskType === 5 ) {
            // add proxy tasks as top children of the parent task
            ganttManager.getGanttInstance().addTask( currentTask, currentTask.parent, 0 );
        } else {
            ganttManager.getGanttInstance().addTask( currentTask, currentTask.parent );
        }

        hasUpdate = true;
    } );

    links.forEach( function( currentLink ) {
        ganttManager.getGanttInstance().addLink( currentLink );
        hasUpdate = true;
    } );

    if( hasUpdate === true ) {
        ganttManager.getGanttInstance().refreshData();
    }
};

/**
 * Checks whether the TaskDependency with predecessor same as successor and successor same as predecessor exists in the given array.
 * @param {Array} linksArray The array of TaskDepenency to be searched
 * @param {Array} newLink The new TaskDependency
 * @returns {Boolean} if the other side dependency is present or not
 */
export let isOtherSideLinkPresent = function( linksArray, newLink ) {
    let isPresent = false;
    if( linksArray && newLink ) {
        for( let index = 0; index < linksArray.length; index++ ) {
            let link = linksArray[index];
            if( link.source === newLink.target && link.target === newLink.source ) {
                isPresent = true;
                break;
            }
        }
    }
    return isPresent;
};

/**
 * Moves the Gantt task to specified index inside specified parent
 * @param {Object} ganttTask The Gantt task to move
 * @param {Number} index The index where task will be moved. The index is inside the parent.
 * @param {String} parentUid The parent task Uid
 */
export let moveGanttTask = function( ganttTask, index, parentUid ) {
    ganttManager.getGanttInstance().moveTask( ganttTask.id, index, parentUid );
    ganttManager.getGanttInstance().updateTask( ganttTask.id );
};

/**
 * Refresh the Gantt task
 * @param {Array} ganttTasksList The Uid of Gantt task to refresh
 */
export let refreshGanttTasks = function( ganttTasksList ) {
    if( !_.isEmpty( ganttTasksList ) ) {
        ganttTasksList.forEach( ( ganttTask )=>{
            ganttManager.getGanttInstance().refreshTask( ganttTask.id );
        } );
        ganttManager.getGanttInstance().refreshData();
    }
};

/**
 * Refresh the Gantt Link
 * @param {Array} ganttLinksArray The Uid of Gantt link to refresh
 */
export let refreshGanttLinks = function( ganttLinksArray ) {
    if( !_.isEmpty( ganttLinksArray ) ) {
        ganttLinksArray.forEach( ( ganttLink ) =>{
            ganttManager.getGanttInstance().refreshLink( ganttLink.id );
        } );
    }
};

/**
 * Deletes the Gantt Task
 * @param {String} id The id of the gantt task to delete
 */
export let deleteGanttTask = function( id ) {
    if( ganttManager.getGanttInstance().isTaskExists( id ) ) {
        //If second argument is true, then its silent deletion and no events will be fired
        //This can improve the performance drastically
        // ganttManager.getGanttInstance()._deleteTask( id, true );
        ganttManager.getGanttInstance().deleteTask( id );
    }
};

/**
 * Get the Task from DHTMLX Gantt
 * @param {String} taskUid The Uid of Gantt task to get
 * @returns {Object} The DHTMLX Gantt Task
 */
export let getGanttTask = function( taskUid ) {
    let ganttTask;
    if( taskUid && ganttManager.getGanttInstance().isTaskExists( taskUid ) ) {
        ganttTask = ganttManager.getGanttInstance().getTask( taskUid );
    }
    return ganttTask;
};

export let getGanttTaskPosition = function( event ) {
    if( ganttManager.getGanttInstance().isTaskExists( event.id ) ) {
        return ganttManager.getGanttInstance().getTaskPosition( event );
    }
};

export let getChildren = function( parent ) {
    if( parent ) {
        return ganttManager.getGanttInstance().getChildren( parent );
    }
};

/**
 * Get the bar height of events depends upon layout (compact/comfortable)
 * @returns {int} bar_height
 */
export let getGanttBarHeightForEvents = function() {
    let rowHeight = ganttManager.getGanttInstance().config.row_height;
    return rowHeight - 8;
};

/**
 * Update the bar height of all events from gantt depend upon layout
 */
export let updateBarHeightForEvents = function() {
    let barHeight = exports.getGanttBarHeightForEvents();
    // get all events from gantt using DHTMLX API and update its bar height
    ganttManager.getGanttInstance().eachTask( function( task ) {
        if( task.sourceType === 'Event' ) {
            task.bar_height = barHeight;
        }
    } );
};


exports = {
    getGanttTaskPosition,
    getChildren,
    updateCreatedObjectsOnGantt,
    isOtherSideLinkPresent,
    moveGanttTask,
    refreshGanttTasks,
    refreshGanttLinks,
    deleteGanttTask,
    getGanttTask,
    getGanttBarHeightForEvents,
    updateBarHeightForEvents
};

export default exports;
