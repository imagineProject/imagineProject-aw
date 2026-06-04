// Copyright (c) 2023 Siemens
/* eslint-disable class-methods-use-this */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwGanttCallbacks from 'js/AwGanttCallbacks';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import ganttBaselineService from 'js/Saw1ScheduleGanttBaselineService';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import awFilterService from 'js/awFilterService';
import ganttLayoutService from 'js/Saw1ScheduleGanttLayoutService';
import ganttOverrides from 'js/Saw1ScheduleGanttOverrides';
import ganttScrollService from 'js/Saw1ScheduleGanttScrollService';
import ganttTemplates from 'js/Saw1ScheduleGanttTemplates';
import logger from 'js/logger';

export class Saw1ScheduleGanttCallbacks extends AwGanttCallbacks {
    constructor( schedule ) {
        super();
        this.schedule = schedule;
    }

    onBeforeGanttReady() {
        super.onBeforeGanttReady();
        ganttOverrides.initOverrideVariables( this.ganttInstance );
        ganttOverrides.addScheduleGanttOverrides( this.ganttInstance );
        this.ganttInstance.templates.grid_folder = ( task ) => { return ganttTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_file = ( task ) => { return ganttTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_row_class = ( start, end, task ) => { return ganttTemplates.getGridRowClass( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.task_class = ( start, end, task ) => { return ganttTemplates.getTaskClass( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.link_class = ( link ) => { return ganttTemplates.getLinkClass( link, this.ganttInstance ); };
        this.ganttInstance.templates.tooltip_date_format = ( date ) => { return this.ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
        this.ganttInstance.templates.tooltip_text = ( start, end, task ) => { return ganttTemplates.getTooltipText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.task_text = ( start, end, task ) => { return ganttTemplates.getTaskText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.leftside_text = ( start, end, task ) => { return ganttTemplates.getLeftSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.rightside_text = ( start, end, task ) => { return ganttTemplates.getRightSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.timeline_cell_class = ( task, date ) => { return ganttTemplates.getTimelineCellClass( task, date, this.ganttInstance ); };
    }

    onGanttReady() {
        this.ganttInstance.ext.tooltips.tooltipFor( ganttBaselineService.getBaselineTooltip( this.ganttInstance ) );
    }

    onGanttScroll( left, top ) {
        ganttScrollService.scrollTable();
    }

    onBeforeLinkAdd( id, link ) {
        if( cdm.getObject( id ) ) {
            return true;
        }

        let predecessor = cdm.getObject( link.source );
        let successor = cdm.getObject( link.target );
        if( predecessor && successor ) {
            if(  ( cmm.isInstanceOf( 'ScheduleTask', predecessor.modelType ) &&
            cmm.isInstanceOf( 'ScheduleTask', successor.modelType ) ) || ( cmm.isInstanceOf( 'Fnd0ProxyTask', predecessor.modelType ) && cmm.isInstanceOf( 'ScheduleTask', successor.modelType ) ) || ( cmm.isInstanceOf( 'ScheduleTask', predecessor.modelType ) && cmm.isInstanceOf( 'Fnd0ProxyTask', successor.modelType ) ) ) {
                let scheduleObj = null;
                if( cmm.isInstanceOf( 'ScheduleTask', predecessor.modelType ) ){
                    scheduleObj = cdm.getObject( predecessor.props.schedule_tag.dbValues[ 0 ] );
                }else{
                    scheduleObj = cdm.getObject( successor.props.schedule_tag.dbValues[ 0 ] );
                }
                let depCreateInput = {
                    schedule: scheduleObj,
                    newDependencies: [ {
                        predTask: predecessor,
                        succTask: successor,
                        depType: parseInt( link.type ),
                        lagTime: 0
                    } ]
                };
                eventBus.publish( 'InlineDependencyCreate', depCreateInput );
            } else if( cmm.isInstanceOf( 'Prg0AbsEvent', predecessor.modelType ) &&
            cmm.isInstanceOf( 'Prg0AbsEvent', successor.modelType ) ) {
            //If Primary and Secondary objects are Prg0AbsEvent then throw the error
                let sourceModule = 'ScheduleManagerMessages';
                let localTextBundle = localeSvc.getLoadedText( sourceModule );
                let createDepErrorMsg = localTextBundle.Saw1EventToEventDependencyCreationErrorMsg;
                let finalMessage = messagingService.applyMessageParams( createDepErrorMsg, [ '{{sourceObject}}', '{{targetObject}}' ], {
                    sourceObject: predecessor.props.object_name.dbValues[ 0 ],
                    targetObject: successor.props.object_name.dbValues[ 0 ]
                } );
                messagingService.showError( finalMessage );
            } else if( cmm.isInstanceOf( 'Prg0AbsEvent', predecessor.modelType ) ||
                cmm.isInstanceOf( 'Prg0AbsEvent', successor.modelType ) ) {
                //If Primary or Secondary object is Prg0AbsEvent then only try to create Event Dependency
                let predecessorObjDate = getStartDate( predecessor.props );
                let successorObjDate = getStartDate( successor.props );
                if( dateTimeSvc.compare( successorObjDate, predecessorObjDate ) >= 0 ) {
                    eventBus.publish( 'createMilestoneEventDependency', { primary : successor, secondary : predecessor } );
                } else {
                    let sourceModule = 'ScheduleManagerMessages';
                    let localTextBundle = localeSvc.getLoadedText( sourceModule );
                    let pastDateErrorMessage = localTextBundle.Saw1MilestoneEventDepCreateErrorMsg;
                    let finalMessage = messagingService.applyMessageParams( pastDateErrorMessage, [ '{{sourceObject}}', '{{targetObject}}', '{{sourceObject}}' ], {
                        sourceObject: predecessor.props.object_name.dbValues[ 0 ],
                        targetObject: successor.props.object_name.dbValues[ 0 ]
                    } );
                    messagingService.showError( finalMessage );
                }
            }
        }
        return false;
    }

    onLinkDblClick( id, e ) {
        if ( this.ganttInstance.config.readonly ) {
            return false;
        }
        let dependency = cdm.getObject( id );
        if( dependency && dependency.modelType.typeHierarchyArray.indexOf( 'TaskDependency' ) > -1 ) {
            eventBus.publish( 'scheduleGantt.confirmAndDeleteDependency', { schedule: this.schedule, dependencyDeletes: [ dependency ] } );
        } else if ( dependency && dependency.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
            eventBus.publish( 'scheduleGantt.confirmAndDeleteMilestoneEventDependency', { dependencyDeletes: [ dependency ] } );
        }
    }

    onBeforeTaskDrag( id, mode, e ) {
        // If there is selection, only selected tasks can be moved
        // NOTE: Other modes like 'Progress' and 'Resize' are allowed irrespective of the selection.
        let selectedTasks = this.ganttInstance.getSelectedTasks();
        if( mode === 'move' && selectedTasks.length > 0 && selectedTasks.indexOf( id ) < 0 ) {
            return false;
        }
        let selectedEvents = [];
        let taskCnt = 0;
        for( let i = 0; i < selectedTasks.length; i++ ) {
            let tcObject = cdm.getObject( selectedTasks[i] );
            if( tcObject && cmm.isInstanceOf( 'ScheduleTask', tcObject.modelType ) ) {
                taskCnt++;
            }else if ( tcObject && cmm.isInstanceOf( 'Prg0AbsEvent', tcObject.modelType ) ) {
                selectedEvents.push( tcObject.props.object_name.dbValues[0] );
            }
        }
        let sourceModule = 'ScheduleManagerMessages';
        let localTextBundle = localeSvc.getLoadedText( sourceModule );
        if( selectedEvents.length > 1 || taskCnt > 0 && selectedEvents.length > 0 ) {
            let errMessage = localTextBundle.multipleObjectDragErrorMsg.replace( '{0}', selectedTasks.length.toString() );
            selectedEvents.forEach( ( eventName ) => {
                let eventErrMsg = localTextBundle.eventDragErrorMsg.replace( '{0}', eventName );
                errMessage += '\n' + eventErrMsg;
            } );
            messagingService.showError( errMessage );
            return false;
        }
        return this.ganttInstance.getTask( id ).canDragMove();
    }

    onAfterTaskDrag( id, mode, e ) {
        let tcObject = cdm.getObject( id );
        if( tcObject && cmm.isInstanceOf( 'ScheduleTask', tcObject.modelType ) ) {
            handleScheduleTaskDrag( id, mode, this.ganttInstance );
        } else if ( tcObject && cmm.isInstanceOf( 'Prg0AbsEvent', tcObject.modelType ) ) {
            handlePrgEventDrag( id, this.ganttInstance );
        }
    }
}

// Variable to process drag(move) with mutiselect. Since 'onAfterTaskDrag' event is fired
// for each task individually, we need to accumulate and process the updateTasks call in bulk.
let multiTaskUpdates = { nProcessedTasks: 0, updateTasksInfo: {} };

const handleScheduleTaskDrag = ( id, mode, ganttInstance ) => {
    let tcTask = cdm.getObject( id );
    let oldStart = new Date( tcTask.props.start_date.dbValues[ 0 ] );
    let oldEnd = new Date( tcTask.props.finish_date.dbValues[ 0 ] );

    let ganttTask = ganttInstance.getTask( id );
    let dragStart = new Date( ganttTask.start_date.toGMTString() );
    let dragEnd = new Date( ganttTask.end_date.toGMTString() );

    let schedule = cdm.getObject( tcTask.props.schedule_tag.dbValues[ 0 ] );
    let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ];
    let isEndDateScheduling = isFinishDateSchedule === 'true' || isFinishDateSchedule === '1';

    const modes = ganttInstance.config.drag_mode;
    switch ( mode ) {
        case modes.move: {
            // Init updates
            if( multiTaskUpdates.nProcessedTasks === 0 ) {
                multiTaskUpdates.updateTasksInfo = { schedule: schedule, updates: [], taskObjects: [] };
            }
            ++multiTaskUpdates.nProcessedTasks;

            // Skip the processed objects. DHTMLX fires one extra event for the task being dragged during multiselect.
            if( !multiTaskUpdates.updateTasksInfo.taskObjects.find( object => object.uid === tcTask.uid ) ) {
                // Read the hours and minute before drag and assign to new date, so that
                // the dates will not have different time depending on the amount of drag.
                dragStart.setHours( oldStart.getHours() );
                dragStart.setMinutes( oldStart.getMinutes() );
                dragEnd.setHours( oldEnd.getHours() );
                dragEnd.setMinutes( oldEnd.getMinutes() );

                if( oldStart.getTime() !== dragStart.getTime() || oldEnd.getTime() !== dragEnd.getTime() ) {
                    let taskUpdateInfo = {
                        object: tcTask,
                        updates: [ getUpdateAttribute( isEndDateScheduling ? 'finish_date' : 'start_date', dateTimeSvc.formatUTC( isEndDateScheduling ? dragEnd : dragStart ) ) ]
                    };
                    multiTaskUpdates.updateTasksInfo.updates.push( taskUpdateInfo );
                    multiTaskUpdates.updateTasksInfo.taskObjects.push( tcTask );
                }else {
                    ganttTask.start_date = new Date( ganttTask.getDbValue( 'start_date' ) );
                    ganttTask.end_date = new Date( ganttTask.getDbValue( 'finish_date' ) );
                    ganttInstance.updateTask( ganttTask.id );
                }
            }

            let nSelectedTasks = ganttInstance.getSelectedTasks().length;
            if( nSelectedTasks < 1 || multiTaskUpdates.nProcessedTasks ===  nSelectedTasks + 1   ) {
                // check psi template is installed before throwing the event.
                var scheduleNavigationCtxtext = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
                var isPsi0TemplateInstalled = scheduleNavigationCtxtext.isPsi0TemplateInstalled;

                // Only One Milestone should be passed for moveMilestone SOA If multiple Schedule task object selection is present call UpdateTasks
                if( multiTaskUpdates.updateTasksInfo.updates.length === 1 && multiTaskUpdates.updateTasksInfo.updates[0].object.props.task_type.dbValues[0] === '1' && isPsi0TemplateInstalled ) {
                    //Formats the date to be shown in confirmation message as per user locale
                    var formattedDate = awFilterService.instance( 'date' )( dragStart, dateTimeSvc.getSessionDateFormat() );
                    multiTaskUpdates.updateTasksInfo.updates[0].formattedDate = formattedDate;
                    eventBus.publish( 'prgSchedule.milestoneDragged', multiTaskUpdates.updateTasksInfo );
                } else if( multiTaskUpdates.updateTasksInfo.updates.length > 0 ) {
                    eventBus.publish( 'scheduleGantt.tasksDragged', multiTaskUpdates.updateTasksInfo );
                }
                // Reset updates.
                multiTaskUpdates.nProcessedTasks = 0;
                multiTaskUpdates.updateTasksInfo = {};
            }
            break;
        }
        case modes.resize: {
            if( oldStart.getTime() !== dragStart.getTime() || oldEnd.getTime() !== dragEnd.getTime() ) {
                let newDate = isEndDateScheduling ? dragStart : dragEnd;

                // If the difference b/w new start & end dates is < 90 minutes, make the task as milestone,
                // by setting the start_date = end_date.
                if( parseInt( ( dragEnd.getTime() - dragStart.getTime() ) / ( 1000 * 60 ) ) < 90 ) {
                    newDate = isEndDateScheduling ? dragEnd : dragStart;
                }

                let updateTasksInfo = { schedule: schedule, updates: [ { object: tcTask, updates: [] } ], taskObjects: [ tcTask ] };
                updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( 'taskResized', 'true' ) );
                updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( isEndDateScheduling ? 'start_date' : 'finish_date', dateTimeSvc.formatUTC( newDate ) ) );
                eventBus.publish( 'scheduleGantt.tasksDragged', updateTasksInfo );
            }
            break;
        }
        case modes.progress: {
            let workComplete = ganttTask.getDbValue( 'work_estimate' ) * ganttTask.progress;
            let updateTasksInfo = { schedule: schedule, updates: [ { object: tcTask, updates: [] } ], taskObjects: [ tcTask ] };
            updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( 'work_complete', isNaN( workComplete ) ? '0' : workComplete.toString() ) );
            eventBus.publish( 'scheduleGantt.tasksDragged', updateTasksInfo );
            break;
        }
    }
};

let skipSelectedObjectDragged = false;//Used to skip first event when selected object is being dragged
const handlePrgEventDrag = ( id, ganttInstance ) => {
    let tcEvent = cdm.getObject( id );
    let oldPlannedDate = new Date( tcEvent.props.prg0PlannedDate.dbValues[ 0 ] );

    let ganttTask = ganttInstance.getTask( id );
    let dragDate = new Date( ganttTask.start_date.toGMTString() );
    dragDate.setHours( oldPlannedDate.getHours() );
    dragDate.setMinutes( oldPlannedDate.getMinutes() );

    var formattedDate = awFilterService.instance( 'date' )( dragDate, dateTimeSvc.getSessionDateFormat() );

    if( oldPlannedDate.getTime() !== dragDate.getTime() ) {
        let eventUpdateInfo = {
            object: tcEvent,
            newPlannedDate: dateTimeSvc.formatUTC( dragDate ),
            formattedDate: formattedDate
        };
        let nSelectedTasks = ganttInstance.getSelectedTasks().length;
        if( nSelectedTasks === 1 && !skipSelectedObjectDragged ) {
            skipSelectedObjectDragged = true;
        } else if( nSelectedTasks < 1 || skipSelectedObjectDragged ) {
            eventBus.publish( 'prgSchedule.prgEventDragged', eventUpdateInfo );
            skipSelectedObjectDragged = false;
        }
    }
};

/**
 * Pushes the initial data loaded in tree table to the Gantt Chart. This is done after
 * the Gantt Chart is initialized and ready to parse the data to be displayed in Gantt.
 */
export const loadInitialDataToGantt = ( treeTableData, ganttDataService, atomicDataRef, schedule, baselineUids ) => {
    let isGanttDataInited = false;
    if( treeTableData.getValue().rootNode ) {
        try {
            let rootNode = treeTableData.getValue().rootNode;
            let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

            ganttInstance.addTask( ganttDataService.constructGanttObject( cdm.getObject( rootNode.uid ) ) );

            // If there are no pre-selections or root node selection, scroll and show the root node.
            let selected = _.get( atomicDataRef.selectionData.getAtomicData(), 'selected', [] );
            if( selected.length <= 0 ||  selected.length === 1 && selected[0].uid === rootNode.uid  ) {
                ganttInstance.showTask( rootNode.uid );
            }

            ganttInstance.batchUpdate( () => {
                addChildNodesToGantt( rootNode, ganttDataService, ganttInstance );

                let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
                addDependenciesToGantt( dependenciesInfo, ganttDataService, ganttInstance );
            } );

            if( baselineUids.length > 0 ) {
                ganttBaselineService.showBaselines( baselineUids, treeTableData, atomicDataRef, schedule );
            }
            isGanttDataInited = true;

            // Update the gantt row height based on computed table height.
            ganttLayoutService.debounceResetGanttRowHeight( ganttInstance );
        } catch ( error ) {
            logger.error( 'Failed to load inital data in Gantt: ', error );
        } finally {
            // Sync the Gantt scroll bar with Tree table scroll bar position, so that
            // Gantt will scroll and display the current page and selection in Tree table.
            ganttScrollService.scrollGantt();

            // Enable synchronization of Tree Table and Gantt scroll bars.
            ganttScrollService.enableScrollSync( true );
        }
    }

    return { isGanttDataInited: isGanttDataInited };
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Gantt Chart.
 *
 * @param {Object} parentNode The parent to traverse and add children.
 * @param {Object} ganttDataService The gantt data service
 * @param {Object} ganttInstance Gantt instance
 */
const addChildNodesToGantt = ( parentNode, ganttDataService, ganttInstance ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    let ganttTasks = [];
    childNodes && childNodes.forEach( ( node ) => {
        ganttTasks.push( {
            ...ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
            parent : parentNode.uid, order: node.childNdx } ); // Insert with index to ensure mock tasks remain at the end of the list.
    } );

    if( ganttTasks.length > 0 ) {
        ganttInstance.parse( { data: ganttTasks, links: [] }, 'json' );
    }

    if( parentNode.isExpanded === true ) {
        ganttInstance.getTask( parentNode.uid ).$open = true;
    }

    childNodes && childNodes.forEach( node => addChildNodesToGantt( node, ganttDataService, ganttInstance ) );
};

const addDependenciesToGantt = ( dependenciesInfo, ganttDataService, ganttInstance ) => {
    let links = [];
    !_.isEmpty( dependenciesInfo ) && dependenciesInfo.forEach( ( depInfo ) => {
        if( !ganttInstance.isTaskExists( depInfo.primaryUid ) ) {
            mockMissingTask( depInfo.primaryUid, ganttDataService, ganttInstance );
        }
        if( !ganttInstance.isTaskExists( depInfo.secondaryUid ) ) {
            mockMissingTask( depInfo.secondaryUid, ganttDataService, ganttInstance );
        }
        links.push( { ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ) ), target: depInfo.primaryUid, source: depInfo.secondaryUid } );
    } );

    if( links.length > 0 ) {
        var scrollState = ganttInstance.getScrollState();
        ganttInstance.parse( { data: [], links: links }, 'json' );
        ganttInstance.scrollTo( scrollState.x, scrollState.y );
    }
};

const loadDependenciesToGantt = ( dependenciesInfo, ganttDataService, ganttInstance ) => {
    let links = [];
    !_.isEmpty( dependenciesInfo ) && dependenciesInfo.forEach( ( depInfo ) => {
        if( !ganttInstance.isTaskExists( depInfo.primaryUid ) ) {
            mockMissingTask( depInfo.primaryUid, ganttDataService, ganttInstance );
        }
        if( !ganttInstance.isTaskExists( depInfo.secondaryUid ) ) {
            mockMissingTask( depInfo.secondaryUid, ganttDataService, ganttInstance );
        }
        links.push( { ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ) ), target: depInfo.primaryUid, source: depInfo.secondaryUid } );
    } );

    if( links.length > 0 ) {
        ganttInstance.parse( { data: [], links: links }, 'json' );
    }
};

export const mockMissingTask = ( taskUid, ganttDataService, ganttInstance ) => {
    let taskObject = cdm.getObject( taskUid );
    if( taskObject ) {
        let parentTaskUid = getParentTaskUid( taskObject );
        if( parentTaskUid && ganttInstance.isTaskExists( parentTaskUid ) ) {
            ganttInstance.addTask( ganttDataService.constructGanttObject( taskObject ), parentTaskUid );
        }
    }
};

const getParentTaskUid = ( taskObject ) => {
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', taskObject.modelType ) && taskObject.props.fnd0ref ) {
        taskObject = cdm.getObject( taskObject.props.fnd0ref.dbValues[ 0 ] );
    }
    if( taskObject && cmm.isInstanceOf( 'ScheduleTask', taskObject.modelType ) ) {
        return _.get( taskObject, 'props.fnd0ParentTask.dbValues[0]', undefined );
    }
    return undefined;
};

export const onTreeNodesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.treeLoadResult ) ) {
        let parentNode = eventData.treeLoadResult.parentNode;
        // If it is top node(schedule), use the schedule summary i.e the rootPathNode that matches the 'parentElementUid''
        if( eventData.treeLoadInput.isTopNode ) {
            parentNode = _.filter( eventData.treeLoadResult.rootPathNodes, { uid: eventData.treeLoadInput.parentElementUid } )[ 0 ];
        }

        if( parentNode ) {
            if( eventData.treeLoadInput.isTopNode ) {
                resetGanttChart( atomicData.ganttInstance );

                if( !atomicData.ganttInstance.isTaskExists( parentNode.uid ) ) {
                    atomicData.ganttInstance.addTask( ganttDataService.constructGanttObject( cdm.getObject( parentNode.uid ) ) );
                }

                // Update the gantt row height based on computed table height.
                ganttLayoutService.debounceResetGanttRowHeight( atomicData.ganttInstance );

                //Call for Program Events after we reset the Gantt.
                eventBus.publish( 'prgSchedule.checkProgramEvents' );
            }

            eventData.treeLoadResult.childNodes && eventData.treeLoadResult.childNodes.forEach( ( node ) => {
                if( !atomicData.ganttInstance.isTaskExists( node.uid ) ) {
                    atomicData.ganttInstance.addTask(
                        ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                        parentNode.uid,
                        node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
                } else {
                    atomicData.ganttInstance.moveTask( node.uid, node.childNdx, parentNode.uid );
                }
            } );

            if( parentNode.isExpanded === true ) {
                atomicData.ganttInstance.getTask( parentNode.uid ).$open = true;
            }


            if( atomicData.ganttInstance.baselineUids && !_.isEmpty( atomicData.ganttInstance.baselineUids ) && atomicData.ganttInstance.baselineUids.length > 0 ) {
                let schedule = cdm.getObject( eventData.treeLoadInput.scheduleSummaryNode.props.schedule_tag.dbValues[ 0 ] );
                ganttBaselineService.loadBaselines( schedule, atomicData.ganttInstance.baselineUids, eventData.treeLoadResult.childNodes );
            }

            // Load the baseline tasks for the child nodes.
            //ganttIntegrationService.loadBaselineTasksInGantt( eventData.treeLoadResult.childNodes );
        }
    }
};

export const onExpandBelow = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.expandBelowResult ) ) {
        atomicData.ganttInstance.batchUpdate( function() {
            let tasks = [];
            eventData.expandBelowResult.childNodes && eventData.expandBelowResult.childNodes.forEach( ( node ) => {
                let parentUID = node.parentNodeUid;
                tasks.push( { ...ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                    parent:parentUID } );
            } );
            if( tasks.length > 0 ) {
                atomicData.ganttInstance.parse( { data: tasks, links: [] }, 'json' );
            }


            let nodesToExpand = _.concat( [ eventData.expandBelowNode ], eventData.expandBelowResult.childNodes );
            _.forEach( nodesToExpand, function( task ) {
                atomicData.ganttInstance.open( task.id );
            } );
        } );
    }

    if( atomicData.ganttInstance.baselineUids && !_.isEmpty( atomicData.ganttInstance.baselineUids ) && atomicData.ganttInstance.baselineUids.length > 0 ) {
        let schedule = cdm.getObject( eventData.dataProvider.topTreeNode.uid );
        ganttBaselineService.loadBaselines( schedule, atomicData.ganttInstance.baselineUids, eventData.expandBelowResult.childNodes );
    }
};

export const onPartialExpand = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.treeLoadResult ) ) {
        resetGanttChart( atomicData.ganttInstance );
        atomicData.ganttInstance.batchUpdate( function() {
            eventData.treeLoadResult.childNodes && eventData.treeLoadResult.childNodes.forEach( ( node ) => {
                let parentUID = node.parentNodeUid;
                if( !atomicData.ganttInstance.isTaskExists( node.uid ) ) {
                    atomicData.ganttInstance.addTask(
                        ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                        parentUID,
                        node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
                } else {
                    atomicData.ganttInstance.moveTask( node.uid, node.childNdx, parentUID );
                }
            } );

            _.forEach( eventData.treeLoadInput.nodesForExpansion, function( expandedNodesUid ) {
                if( atomicData.ganttInstance.isTaskExists( expandedNodesUid ) ) {
                    atomicData.ganttInstance.getTask( expandedNodesUid ).$open = true;
                }
            } );
        } );
    }
};

export const resetGanttChart = ( ganttInstance ) => {
    if( ganttInstance && ganttInstance.getTaskCount() > 0 ) {
        let links = ganttInstance.getLinks();
        let childIds = ganttInstance.getChildren( ganttInstance.getTaskByIndex( 0 ).id );

        ganttInstance.batchUpdate( () => {
            links.forEach( link => ganttInstance.isLinkExists( link.id ) && ganttInstance.deleteLink( link.id ) );
            childIds.forEach( childId => ganttInstance.isTaskExists( childId ) && ganttInstance.deleteTask( childId ) );
        } );
    }
};

export const onDependenciesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( _.isEmpty( eventData.loadedDependencies ) || atomicData.ganttInitialized !== true ) {
        return;
    }
    atomicData.ganttInstance.batchUpdate( () => {
        loadDependenciesToGantt( eventData.loadedDependencies, ganttDataService, atomicData.ganttInstance );
    } );
};

export const onToggleTreeNode = ( node, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized === true ) {
        if( node.isExpanded === true ) {
            atomicData.ganttInstance.open( node.id );
        } else {
            atomicData.ganttInstance.close( node.id );
        }
    }
};

export const onCollapseBelow = ( eventData, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized === true ) {
        atomicData.ganttInstance.close( eventData.node.id );

        let childIds = atomicData.ganttInstance.getChildren( eventData.node.id );
        atomicData.ganttInstance.batchUpdate( () => {
            childIds.forEach( childId => atomicData.ganttInstance.deleteTask( childId ) );
        } );
    }
};

export const onNodesAdded = ( eventData, ganttDataService, ganttInstance ) => {
    eventData.addedNodes.length > 0 && eventData.addedNodes.forEach( node => {
        if( ganttInstance.isTaskExists( node.uid ) ) {
            ganttInstance.moveTask( node.uid, node.childNdx, node.parentNodeUid );
        } else {
            ganttInstance.addTask( ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                node.parentNodeUid,
                node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
        }
    } );
};

export const onNodesRemoved = ( eventData, ganttInstance ) => {
    if( eventData.removedNodes.length > 0 ) {
        ganttInstance.batchUpdate( () => {
            eventData.removedNodes.forEach( node => {
                ganttInstance.isTaskExists( node.uid ) && ganttInstance.deleteTask( node.uid );
            } );
        } );
    }
};

export const onTasksReordered = ( eventData, ganttInstance ) => {
    let moveTasksInfo = eventData.moveTasksInfo;
    if ( _.isArray( moveTasksInfo ) && ganttInstance ) {
        ganttInstance.batchUpdate( () => {
            moveTasksInfo.forEach( moveRequest => {
                let srcTaskId = moveRequest.task.uid;
                let prevSiblingId = moveRequest.prevSibling?.uid;
                let insertIndex = 0;
                if ( ganttInstance.isTaskExists( prevSiblingId ) ) {
                    let prevSiblingIndex = ganttInstance.getTaskIndex( prevSiblingId );
                    insertIndex = prevSiblingIndex + 1;

                    // In case of drag and drop, calculate the index based on whether the task being dropped and the new sibling
                    // belongs to same parent and if the dropped task was above/below below the new sibling.
                    if ( eventData.operation === 'reorder' && ganttInstance.getParent( srcTaskId ) === ganttInstance.getParent( prevSiblingId ) ) {
                        let srcTaskIndex = ganttInstance.getTaskIndex( srcTaskId );
                        insertIndex = srcTaskIndex < prevSiblingIndex ? prevSiblingIndex : prevSiblingIndex + 1;
                    }
                } else {
                    insertIndex = ganttInstance.getChildren( moveRequest.newParent.uid ).length;
                }
                ganttInstance.moveTask( srcTaskId, insertIndex, moveRequest.newParent.uid );
                ganttInstance.updateTask( srcTaskId );

                // Expand the parent task
                let parentTask = ganttInstance.getTask( moveRequest.newParent.uid );
                if ( parentTask.$open !== true ) {
                    parentTask.$open = true;
                    ganttInstance.updateTask( parentTask.id );
                }
            } );
        } );
    }
};

export const onDependenciesAdded = ( eventData, ganttDataService, ganttInstance ) => {
    if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
        eventData.dependenciesInfo.forEach( depInfo => {
            if( !ganttInstance.isLinkExists( depInfo.uid ) ) {
                ganttInstance.addLink( {
                    ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ) ),
                    source: depInfo.secondaryUid,
                    target: depInfo.primaryUid
                } );
            }
        } );
    }
};

export const onDependenciesDeleted = ( eventData, ganttInstance ) => {
    if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
        eventData.dependenciesInfo.forEach( depInfo => {
            ganttInstance.isLinkExists( depInfo.uid ) && ganttInstance.deleteLink( depInfo.uid );
        } );
    }
};

export const onObjectsUpdated = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    eventData.updatedObjects && eventData.updatedObjects.forEach( modelObject => ganttDataService.updateGanttObject( modelObject.uid, atomicData.ganttInstance ) );
};

const getUpdateAttribute = ( propName, propValue ) => {
    return { attrName: propName, attrValue: propValue, attrType: 1 /*Unused*/ };
};

// Method added for getting start date for Event/Schedule Task/Milestone/Proxy Task/Custom Task
const getStartDate = ( props ) => {
    let date;
    if( props.start_date ) {
        date = props.start_date.dbValues[ 0 ];
    } else if ( props.prg0PlannedDate ) {
        date = props.prg0PlannedDate.dbValues[ 0 ];
    } else if ( props.fnd0start_date ) {
        date = props.fnd0start_date.dbValues[ 0 ];
    }
    return new Date( date );
};

export default {
    loadInitialDataToGantt,
    onTreeNodesLoaded,
    onDependenciesLoaded,
    onToggleTreeNode,
    onCollapseBelow,
    onNodesAdded,
    onNodesRemoved,
    onTasksReordered,
    onDependenciesAdded,
    onDependenciesDeleted,
    onObjectsUpdated,
    mockMissingTask,
    onExpandBelow,
    onPartialExpand,
    resetGanttChart
};
