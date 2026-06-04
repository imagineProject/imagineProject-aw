// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import ganttCallbacks, { Saw1ScheduleGanttCallbacks } from 'js/Saw1ScheduleGanttCallbacks';
import ganttScrollService from 'js/Saw1ScheduleGanttScrollService';
import Saw1ScheduleGanttDataService from 'js/Saw1ScheduleGanttDataService';
import dateTimeService from 'js/dateTimeService';
import messagingService from 'js/messagingService';

/**
 * Initializes the required properties for the Gantt to be loaded.
 * @param {Object} schedule The owning schedule for which the Gantt chart will be rendered
 * @param {Object} atomicDataRef Atomic data
 */
export const initializeGanttChartState = ( schedule, atomicDataRef ) => {
    console.log( 'Saw1ScheduleGanttService initializeGanttChartState' );

    let zoomLevel = appCtxSvc.getCtx( 'preferences.AWC_SM_Gantt_Zoom_Level' );

    atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        zoomLevel: getValidZoomLevel( zoomLevel ? zoomLevel[ 0 ] : 'unit_of_time_measure', schedule ),
        ganttConfig: getScheduleGanttConfig( new Date( schedule.props.start_date.dbValues[ 0 ] ), new Date( schedule.props.finish_date.dbValues[ 0 ] ), schedule.props.owning_site ),
        callbacks: new Saw1ScheduleGanttCallbacks()
    } );

    return {
        isGanttChartStateInited: true,
        ganttDataService: new Saw1ScheduleGanttDataService()
    };
};

/**
 * @returns flag indicating the schedule summary properties are loaded.
 */
export const setScheduleSummaryPropLoaded = () => {
    return { isScheduleSummaryPropLoaded: true };
};

/**
 * Initialize the basic gantt config properties for loading the gantt chart.
 * @param {Date} startDate The start date of the gantt chart.
 * @param {Date} endDate The finish date of the gantt chart.
 * @param {Object} owning_site The property of schedule.
 * @returns {Object} The gantt properties
 */
const getScheduleGanttConfig = ( startDate, endDate, owning_site ) => {
    let ganttConfig = awGanttConfigService.getDefaultConfiguration();
    ganttConfig.scale_height = 72; // XLARGE
    ganttConfig.bar_height = 'full';
    ganttConfig.drag_links = true;
    ganttConfig.drag_move = true;
    ganttConfig.drag_progress = true;
    ganttConfig.drag_resize = true;
    ganttConfig.link_wrapper_width = 20;
    ganttConfig.order_branch = true;
    ganttConfig.order_branch_free = true;
    ganttConfig.readonly = false;
    if ( owning_site && owning_site.dbValues[0] !== null ) {
        ganttConfig.readonly = true;
    }
    ganttConfig.show_grid = browserUtils.getUrlAttributes().showGanttGrid !== undefined;
    ganttConfig.initial_scroll = false;
    ganttConfig.columns = [ { name: 'text', label: 'Task name', tree: true, width: '150' } ]; // FIX ME: Remove it during final implementation.
    ganttConfig.show_tasks_outside_timescale = true;
    ganttConfig.start_date = startDate;
    ganttConfig.start_date.setDate( ganttConfig.start_date.getDate() - 21 ); // Move the start date a bit earlier so that it is not partially visible
    ganttConfig.end_date = endDate;
    ganttConfig.links = { ...ganttConfig.links, finish_to_start: '0', finish_to_finish: '1', start_to_start: '2', start_to_finish: '3' };
    ganttConfig.types = { ...ganttConfig.types, standard: '0', milestone: '1', summary: '2', phase: '3', gate: '4', link: '5', scheduleSummary: '6' };
    return ganttConfig;
};

/**
 * Returns the work times as per the Gatt chart expected format, built
 * using the input calendar information.
 * @param {Object} calendarInfo The calendar information.
 * @returns {Array} Array of work times
 */
const getWorkTimes = ( calendarInfo ) => {
    let workTimes = [];
    if( calendarInfo && calendarInfo.dayRanges ) {
        workTimes = Object.values( calendarInfo.dayRanges ).reduce( ( workTimes, dayRange, index ) => {
            workTimes.push( { day: index, hours: dayRange ? dayRange : false } );
            return workTimes;
        }, workTimes );
    }

    if( calendarInfo && calendarInfo.eventRanges ) {
        workTimes = calendarInfo.eventRanges.reduce( ( workTimes, eventRange ) => {
            workTimes.push( { date: new Date( eventRange.eventDate ), hours: eventRange.ranges ? eventRange.ranges : false } );
            return workTimes;
        }, workTimes );
    }
    return workTimes;
};

export const confirmAndDeleteMilestoneEventDependency = ( dependenciesToDelete, atomicDataRef ) => {
    if( !dependenciesToDelete && !dependenciesToDelete.dependencyDeletes && !dependenciesToDelete.dependencyDeletes[ 0 ] ) {
        return;
    }
    let dependencyToDelete = dependenciesToDelete.dependencyDeletes[ 0 ];
    let secondaryEventNameString;
    let primaryEventNameString;
    let milestoneEventDependencyInfo = atomicDataRef.ganttChartState.getAtomicData().ganttInstance.getLink( dependencyToDelete.uid );
    if( milestoneEventDependencyInfo && dependencyToDelete &&
        dependencyToDelete.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
        let sourceObject = cdm.getObject( milestoneEventDependencyInfo.source );
        let targetObject = cdm.getObject( milestoneEventDependencyInfo.target );
        if( sourceObject && targetObject ) {
            secondaryEventNameString = sourceObject.props.object_name.dbValues[ 0 ];
            primaryEventNameString = targetObject.props.object_name.dbValues[ 0 ];
            var messageParams = {
                secondaryEventName: secondaryEventNameString,
                primaryEventName: primaryEventNameString
            };
            eventBus.publish( 'deleteMilestoneEventDepConfirmationMessage', messageParams );
        }
    }
};

export const subscribeEvents = ( ganttDataService, atomicDataRef ) => {
    const getGanttInstance = ( atomicDataRef ) => atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

    let eventSubscriptions = [];
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTreeDataProvider.treeNodesLoaded', ( eventData ) => eventData.treeLoadResult.areNodesRetrievedFromExpansion ?
        ganttCallbacks.onPartialExpand( eventData, ganttDataService,
            atomicDataRef ) : ganttCallbacks.onTreeNodesLoaded( eventData, ganttDataService,
            atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.expandAll', ( eventData ) => ganttCallbacks.onExpandBelow( eventData, ganttDataService,
        atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesLoaded', ( eventData ) => ganttCallbacks.onDependenciesLoaded( eventData, ganttDataService, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.plTable.toggleTreeNode', ( node ) => ganttCallbacks.onToggleTreeNode( node, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.collapseBelow', ( eventData ) => ganttCallbacks.onCollapseBelow( eventData, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesAdded', ( eventData ) => ganttCallbacks.onNodesAdded( eventData, ganttDataService, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesRemoved', ( eventData ) => ganttCallbacks.onNodesRemoved( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.tasksReordered', ( eventData ) => ganttCallbacks.onTasksReordered( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesAdded', ( eventData ) => ganttCallbacks.onDependenciesAdded( eventData, ganttDataService, getGanttInstance(
        atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesDeleted', ( eventData ) => ganttCallbacks.onDependenciesDeleted( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'cdm.updated', ( eventData ) => ganttCallbacks.onObjectsUpdated( eventData, ganttDataService, atomicDataRef ) ) );

    // Listen to Tree table scroll to sync up Gantt scroll
    ganttScrollService.registerTableGanttScrollSync();

    return { eventSubscriptions };
};

export let scrollToDateInGantt = function( dateString, isToday, i18n, atomicDataRef ) {
    let date = new Date();
    if( !isToday ) {
        date = new Date( dateString );
    }
    let dateToScroll = new Date( date.getFullYear(), date.getMonth(), date.getDate() );
    let dateToShowInMsg = dateTimeService.formatDate( dateToScroll );
    let GanttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let dates = GanttInstance.getSubtaskDates(); //gets program's first event's and last event's date
    let startDateBoundary = new Date( dates.start_date.getFullYear(), dates.start_date.getMonth(), dates.start_date.getDate() );
    let endDateBoundary = new Date( dates.end_date.getFullYear(), dates.end_date.getMonth(), dates.end_date.getDate() );
    //the below lines check whether out of program boundary dates are entered or not
    if( endDateBoundary.getTime() < dateToScroll.getTime() ) {
        let message = i18n.Saw1GoToOutOfBoundAfter;
        let dateLast = dateTimeService.formatDate( dates.end_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateLast}}' ], {
            dateToShow: dateToShowInMsg,
            dateLast: dateLast
        } );
        messagingService.showInfo( outOfBoundMessage );
    } else if( startDateBoundary.getTime() > dateToScroll.getTime() ) {
        let message = i18n.Saw1GoToOutOfBoundBefore;
        let dateFirst = dateTimeService.formatDate( dates.start_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateFirst}}' ], {
            dateToShow: dateToShowInMsg,
            dateFirst: dateFirst
        } );
        messagingService.showInfo( outOfBoundMessage );
    }
    //For scrolling
    let position = GanttInstance.posFromDate( dateToScroll ); //settig the leftmost position of Gantt as the date
    GanttInstance.scrollTo( position ); //scrolling to the position set
};

export const unsubscribeEvents = ( eventSubscriptions ) => {
    // Stop listening to Tree table scroll.
    ganttScrollService.unRegisterTableGanttScrollSync();

    eventSubscriptions.forEach( event => event && eventBus.unsubscribe( event ) );
};

export const renderProgramEventsOnGantt = ( schedule, atomicDataRef, eventData, ganttDataService ) => {
    appCtxSvc.updateCtx( 'isSchedulePlanEventsShown', true );
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let scheduleSummaryTask = ganttInstance.getTaskByIndex( 0 );
    for( let idx = 0; idx < eventData.addedNodes.length; idx++ ) {
        //If program events are already present on Gantt then do not add again
        if( !ganttInstance.isTaskExists( eventData.addedNodes[ idx ].uid ) ) {
            ganttInstance.addTask( ganttDataService.constructGanttObject( eventData.addedNodes[ idx ] ), scheduleSummaryTask.id );
        }
    }
    let addedEvents = eventData.addedNodes;
    return { addedEvents: addedEvents };
};

export const addMilestoneEventLinksOnGantt = ( dependenciesInfo, ganttDataService, atomicDataRef ) => {
    //To handle Event-Milestone dependency creation scenario
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    for( const dependencyInfo of dependenciesInfo ) {
        dependencyInfo.dependency.props.primary_object = {
            dbValues: [ dependencyInfo.primary ]
        };
        dependencyInfo.dependency.props.secondary_object = {
            dbValues: [ dependencyInfo.secondary ]
        };
        let secondaryObject = cdm.getObject( dependencyInfo.secondary );
        let primaryObject = cdm.getObject( dependencyInfo.primary );
        if( !ganttInstance.isLinkExists( dependencyInfo.dependency.uid ) && !( cmm.isInstanceOf( 'Prg0AbsEvent', primaryObject.modelType ) && cmm.isInstanceOf( 'Prg0AbsEvent', secondaryObject.modelType ) ) ) {
            // If Task objects are missing on Gantt then mock them.
            if( !ganttInstance.isTaskExists( dependencyInfo.primary ) ) {
                ganttCallbacks.mockMissingTask( dependencyInfo.primary, ganttDataService, ganttInstance );
            }
            if( !ganttInstance.isTaskExists( dependencyInfo.secondary ) ) {
                ganttCallbacks.mockMissingTask( dependencyInfo.secondary, ganttDataService, ganttInstance );
            }
            ganttInstance.addLink( ganttDataService.constructGanttObject( dependencyInfo.dependency ) );
        }
    }
};

export const removeAddedEventsonGantt = ( schedule, atomicDataRef, eventData ) => {
    appCtxSvc.updateCtx( 'isSchedulePlanEventsShown', false );
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let scheduleSummaryTask = ganttInstance.getTaskByIndex( 0 );
    for( let idx = 0; idx < eventData.length; idx++ ) {
        ganttInstance.deleteTask( eventData[ idx ].uid );
    }
};


export const processCriticalPathOutput = ( soaResponse, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

    if( ganttInstance && soaResponse.tasks && Array.isArray( soaResponse.tasks ) ) {
        ganttInstance.criticalTaskUids = {};
        soaResponse.tasks.forEach( tcTask => ganttInstance.criticalTaskUids[ tcTask.uid ] = true );
    }
    ganttInstance.refreshData();
};

export const clearCriticalPath = ( atomicDataRef ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.criticalTaskUids = {};
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

const getValidZoomLevel = ( zoomLevel, schedule ) => {
    // Map of UnitofTimeMeasure LOV values to Gantt zoom level names.
    const uotmZoomLevelMap = { h: 'day', d: 'day', w: 'week', mo: 'month' };
    if( zoomLevel === 'unit_of_time_measure' ) {
        zoomLevel = uotmZoomLevelMap[ _.get( schedule, 'props.saw1UnitOfTimeMeasure.dbValues[0]', 'd' ) ];
    }
    return zoomLevel;
};

export const setZoomLevel = ( zoomLevel, atomicDataRef, schedule ) => {
    let newZoomLevel = getValidZoomLevel( zoomLevel, schedule );
    if( atomicDataRef.ganttChartState.getAtomicData().zoomLevel !== newZoomLevel ) {
        atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), zoomLevel: newZoomLevel } );
    }
};

let updatePrefValue = _.debounce( function( prefValue, schedule, newZoomLevel ) {
    let prefZoomLevel = getValidZoomLevel( prefValue, schedule );
    if( prefZoomLevel !== newZoomLevel ) {
        appCtxSvc.updatePartialCtx( 'preferences.AWC_SM_Gantt_Zoom_Level', [ newZoomLevel ] );
    }
}, 1000 );

export let updateZoomLevelPref = function( prefValue, schedule, newZoomLevel ) {
    updatePrefValue( prefValue, schedule, newZoomLevel );
};

export const showHideTaskInfo = ( atomicDataRef, showOrHideInfo ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.showGanttTaskInfo = showOrHideInfo;
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_markers = showOrHideInfo !== 'true';
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

export const updateWorkTimes = ( atomicDataRef, calendarInfo ) => {
    calendarInfo && atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        workTimes: getWorkTimes( calendarInfo )
    } );
};

export const resetGanttChart = ( atomicDataRef )=>{
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    ganttCallbacks.resetGanttChart( atomicData.ganttInstance );
};

/**
 * Method that check if PSI0 template is installed.
 *
 * @param {response} response - SOA response
 */
export let checkForPsi0BOTypes = function( response ) {
    var scheduleNavigationCtxtext = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    scheduleNavigationCtxtext.isPsi0TemplateInstalled = false;
    if( response && response.types && response.types.length > 0 ) {
        scheduleNavigationCtxtext.isPsi0TemplateInstalled = true;
    }
    appCtxSvc.updateCtx( 'scheduleNavigationCtx', scheduleNavigationCtxtext );
};
