// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeSelectionService
 */
import _ from 'lodash';
import ganttManager from 'js/uiGanttManager';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';

let exports;

/**
 * @returns true if objects can be selected in gantt; false otherwise.
 */
let canSelectObjectsInGantt = () => {
    return ganttManager.isGanttInstanceExists() &&
        appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' )[ 0 ] === 'true' &&
        appCtxSvc.getCtx( 'scheduleNavigationCtx' ) && appCtxSvc.getCtx( 'scheduleNavigationCtx' ).isGanttInitialized === true;
};

/**
 * Select the objects in Gantt
 *
 * @param {Array} objectUidsToSelect Uids of objects to select in gantt.
 */
export let selectObjectsInGantt = ( objectUidsToSelect ) => {
    if( !canSelectObjectsInGantt() ) {
        return;
    }
    let smGanttCtx = appCtxSvc.getCtx( 'smGanttCtx' );
    // check if event is selected in a gantt and if it is selected
    // this check will ensure selected event will not get deselected
    if ( smGanttCtx && smGanttCtx.isEventActive && objectUidsToSelect.length <= 0 ) {
        smGanttCtx.isEventActive = false;
        appCtxSvc.updateCtx( 'smGanttCtx', smGanttCtx );
        return;
    }
    // Batch process selection in gantt.
    ganttManager.getGanttInstance().batchUpdate( () => {
        if( _.isArray( objectUidsToSelect ) && objectUidsToSelect.length > 0 ) {
            // Remove deselected objects.
            ganttManager.getGanttInstance().eachSelectedTask( ( taskId ) => {
                if( objectUidsToSelect.indexOf( taskId ) === -1 ) {
                    ganttManager.getGanttInstance().unselectTask( taskId );
                }
            } );

            // Update newly selected objects.
            objectUidsToSelect.forEach( ( objectUid ) => {
                if( ganttManager.getGanttInstance().isTaskExists( objectUid ) ) {
                    if( !ganttManager.getGanttInstance().isSelectedTask( objectUid ) ) {
                        ganttManager.getGanttInstance().selectTask( objectUid );
                        const task = ganttManager.getGanttInstance().getTask( objectUid );
                        ganttManager.getGanttInstance().showDate( task.start_date );
                    }
                }
            } );
        } else {
            // Deselect all
            ganttManager.getGanttInstance().eachSelectedTask( ( taskId ) => {
                ganttManager.getGanttInstance().unselectTask( taskId );
            } );
        }
    } );
};

/**
 * Update schedule object in context on selection of task from tree
 */
export let updateSelectedTaskSchedule = ( dataProvider ) => {
    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    if( !scheduleNavigationCtx ) {
        scheduleNavigationCtx = {};
    }
    if( dataProvider ) {
        let vmNodes = dataProvider.getSelectedObjects();
        let schedUid = '';
        if( vmNodes && vmNodes.length > 0 ) {
            let taskObj = cdm.getObject( vmNodes[ 0 ].uid );
            if( taskObj && taskObj.props && taskObj.props.schedule_tag ) {
                schedUid = taskObj.props.schedule_tag.dbValues[ 0 ];
                let schedObj = cdm.getObject( schedUid );
                if( !scheduleNavigationCtx.selectedTaskSchedule || schedObj && scheduleNavigationCtx.selectedTaskSchedule.uid !== schedObj.uid ) {
                    scheduleNavigationCtx.selectedTaskSchedule = schedObj;
                    appCtxSvc.updateCtx( 'scheduleNavigationCtx', scheduleNavigationCtx );
                }
            }
        }
    }
};

exports = {
    selectObjectsInGantt,
    updateSelectedTaskSchedule
};

export default exports;
