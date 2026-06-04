//@<COPYRIGHT>@
//==================================================
//Copyright 2016.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@


/**
 * @module js/Timeline/prgTimelineUtils
 */
import timelineManager from 'js/uiGanttManager';
import eventBus from 'js/eventBus';
import appCtx from 'js/appCtxService';
import _cmm from 'soa/kernel/clientMetaModel';
import _cdm from 'soa/kernel/clientDataModel';

var exports = {};

/**
 * Method for Selecting dependency Link for deletion
 * @param {Object} linkUid - selected dependency link id
 */
export let selectLink = function( linkUid ) {
    if( timelineManager.getGanttInstance().isLinkExists( linkUid ) ) {
        timelineManager.getGanttInstance().refreshLink( linkUid );
    }
};

/**
 * Method for deleting the dependency link from the timeline.
 * @param {Object} selected - selected dependency link Object
 */
export let deletTimelineDependency = function( selected ) {
    // Check for dependency
    if( selected && timelineManager.getGanttInstance().isLinkExists( selected.uid ) ) {
        timelineManager.getGanttInstance().deleteLink( selected.uid );
        // select parent object after deleting link.
        if ( appCtx.ctx.locationContext && appCtx.ctx.locationContext.modelObject ) {
            // eventBus.publish( 'updateSWAForEvent', appCtx.ctx.locationContext.modelObject ); //FIXME: fix delete of Event Dependency later
        }
    }
};

/**
 * Move scroll bar to selected object.
 * @param {String} selected The Uid of selected object
 */
export let scrollToSelectedObject = function( selected ) {
    if ( selected ) {
        let position;
        if( _cmm.isInstanceOf( 'Prg0AbsEvent', selected.modelType ) && selected.props.prg0PlannedDate.dbValues[0] ) {
            position = timelineManager.getGanttInstance().posFromDate( new Date( selected.props.prg0PlannedDate.dbValues[0] ) );
        } else if( _cmm.isInstanceOf( 'Prg0EventDependencyRel', selected.modelType ) && selected.props.secondary_object.dbValues[0] ) {
            let sourceObject = _cdm.getObject( selected.props.secondary_object.dbValues[0] );
            if( sourceObject && sourceObject.props.prg0PlannedDate.dbValues[0] ) {
                position = timelineManager.getGanttInstance().posFromDate( new Date( sourceObject.props.prg0PlannedDate.dbValues[0] ) );
            }
        }
        if ( position ) {
            timelineManager.getGanttInstance().scrollTo( position - timelineManager.getGanttInstance().config.min_column_width ); //scrolling to the position set
        }
    }
};

/**
 * Get the Task from DHTMLX Gantt
 * @param {String} taskUid The Uid of Gantt task to get
 * @returns {Object} The DHTMLX Gantt Task
 */
 export let getTimelineTask = function( taskUid ) {
    let ganttTask;
    if( taskUid && timelineManager.getGanttInstance().isTaskExists( taskUid ) ) {
        ganttTask = timelineManager.getGanttInstance().getTask( taskUid );
    }
    return ganttTask;
};


export default exports = {
    selectLink,
    deletTimelineDependency,
    getTimelineTask,
    scrollToSelectedObject
};
