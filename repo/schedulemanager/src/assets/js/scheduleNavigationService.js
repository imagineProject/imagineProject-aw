// Copyright (c) 2021 Siemens
// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import ganttIntegrationService from 'js/scheduleNavigationGanttIntegrationService';
import schNavScrollService from 'js/scheduleNavigationTreeScrollService';
import schNavTreeRowService from 'js/scheduleNavigationTreeRowService';
import saw1GanttDependencyUtils from 'js/Saw1GanttDependencyUtils';
import preferenceService from 'soa/preferenceService';

let exports;

/**
 * Set default display view mode
 *
 * @param {Object} data - view model datact
 */
let _setDefaultDisplayMode = ( data ) => {
    let ganttChartPref = appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' );
    appCtxSvc.registerCtx( 'showGanttChart', !( ganttChartPref && ganttChartPref[ 0 ] === 'false' ) );
};

/**
 * Initializes the data for schedule navigation sublocation
 *
 * @param {Object} viewModel view model data
 */
export let intializeScheduleNavigationSublocation = ( viewModel ) => {
    // Update default display mode from preference.
    _setDefaultDisplayMode( viewModel );

    // Disable synchronization b/w Tree Table and Gantt scroll bars.
    // It should be enabled after the initial data is loaded in Gantt.
    schNavScrollService.enableScrollSync( false );

    let atomicDataRef = viewModel.atomicDataRef;
    var atomicData = atomicDataRef.scheduleNavigationContext.getAtomicData();
    var scheduleNavigationContext = { ...atomicData };

    let canEditStructure = !AwStateService.instance.params.filter;
    if( scheduleNavigationContext.isStructureEditSupported !== canEditStructure ) {
        scheduleNavigationContext.isStructureEditSupported = canEditStructure;
        atomicDataRef.scheduleNavigationContext.setAtomicData( scheduleNavigationContext );
    }

    let sourceSchedule  = viewModel.subPanelContext.openedObject;
    let scheduleSummary = cdm.getObject( sourceSchedule.props.fnd0SummaryTask.dbValues[ 0 ] );

    appCtxSvc.registerCtx( 'scheduleNavigationCtx', {
        isGanttInitialized : false,
        sourceScheduleSummary: scheduleSummary,
        treeNodeUids : [],
        dependenciesInfo: [],
        baselines : [],
        selectedBaselines : [],
        isPsi0TemplateInstalled: ''
    } );

    // Set gantt intialization flag to false, if chart is turned off.
    let eventSubscriptions = [ eventBus.subscribe( 'appCtx.update', ( event ) => {
        if( event.name === 'showGanttChart' && event.value === false ) {
            appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.isGanttInitialized', false );

            // Disable synchronization b/w Tree Table and Gantt scroll bars.
            schNavScrollService.enableScrollSync( false );
        }
    } ) ];

    // Once the Gantt Chart is initialized, push the data from tree table to the chart.
    eventSubscriptions.push( eventBus.subscribe( 'ScheduleGantt.ganttInitialized', ganttIntegrationService.pushInitailDataToGantt ) );

    // Update the gantt chart with tasks from the tree load result.
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTreeDataProvider.treeNodesLoaded', ( eventData ) => {
        if( appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' )[ 0 ] === 'true' && appCtxSvc.getCtx( 'scheduleNavigationCtx' ).isGanttInitialized ) {
            if( !_.isEmpty( eventData.treeLoadResult ) ) {
                var parentNode = eventData.treeLoadResult.parentNode;

                // If it is top node(schedule), use the schedule summary i.e the rootPathNode that matches the 'parentElementUid''
                if( eventData.treeLoadInput.isTopNode ) {
                    parentNode = _.filter( eventData.treeLoadResult.rootPathNodes, { uid: eventData.treeLoadInput.parentElementUid } )[0];
                }

                if( parentNode ) {
                    // Add the child nodes to Gantt
                    ganttIntegrationService.addChildNodesToGantt( parentNode, eventData.treeLoadResult.childNodes );

                    // Load the baseline tasks for the child nodes.
                    ganttIntegrationService.loadBaselineTasksInGantt( eventData.treeLoadResult.childNodes );
                }
            }
        }
    } ) );

    // Update the gantt chart with dependencies
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesLoaded', ( eventData ) => {
        if( !_.isEmpty( eventData.loadedDependencies ) ) {
            if( appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' )[ 0 ] === 'true' && appCtxSvc.getCtx( 'scheduleNavigationCtx' ).isGanttInitialized ) {
                ganttIntegrationService.addDependenciesToGantt( eventData.loadedDependencies );
            }
            saw1GanttDependencyUtils.regenerateDependencyIds();
        }
    } ) );

    // Subscribe to events for generating row/dependency numbers.
    eventSubscriptions = eventSubscriptions.concat( schNavTreeRowService.subscribeEvents() );

    return { eventSubscriptions };
};

/**
 * Cleanup data while destructing the schedule navigation sublocation
 *
 * @param {Object} data view model data
 */
export let destroyScheduleNavigationSublocation = ( data ) => {
    // Disable synchronization b/w Tree Table and Gantt scroll bars.
    schNavScrollService.enableScrollSync( false );

    appCtxSvc.unRegisterCtx( 'showGanttChart' );
    appCtxSvc.unRegisterCtx( 'scheduleNavigationCtx' );

    for( var i = 0; i < data.eventSubscriptions.length; ++i ) {
        var event =  data.eventSubscriptions[ i ];
        if( event ) {
            eventBus.unsubscribe( event );
        }
    }

    data.eventSubscriptions = [];
};

/**
 * React to location change by updating the required data in schedule navigation ctx.
 */
export const handleScheduleNavigationStateParamsChange = ( scheduleNavigationContext, eventData ) => {
    // Skip processing, if the user is navigating away from Gantt.
    if( eventData && eventData.newUrl.includes( 'pageId' ) && !eventData.newUrl.includes( 'pageId=tc_xrt_ScheduleGantt' ) ) {
        return;
    }

    if( !scheduleNavigationContext ) {
        return;
    }
    updateScheduleNavigationContextOnFilterChange( scheduleNavigationContext );
};

export const updateScheduleNavigationContextOnFilterChange = ( scheduleNavigationContext ) => {
    var scheduleNavigationContextValue = scheduleNavigationContext.getValue();
    let columnFilteringApplied = scheduleNavigationContextValue.columnFilters.length > 0;

    if( !scheduleNavigationContextValue.isStructureEditSupported && columnFilteringApplied !== true && !AwStateService.instance.params.filter ) {
        scheduleNavigationContextValue.isStructureEditSupported = true;
        scheduleNavigationContext.update( scheduleNavigationContextValue );
    } else if( scheduleNavigationContextValue.isStructureEditSupported && ( columnFilteringApplied === true || AwStateService.instance.params.filter ) ) {
        scheduleNavigationContextValue.isStructureEditSupported = false;
        scheduleNavigationContext.update( scheduleNavigationContextValue );

        // Clear the dependencies info in the ctx and notify the subscribers about the same.
        appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.dependenciesInfo', [] );
        eventBus.publish( 'scheduleNavigationTree.dependenciesCleared' );
    }
};

exports = {
    intializeScheduleNavigationSublocation,
    destroyScheduleNavigationSublocation,
    handleScheduleNavigationStateParamsChange,
    updateScheduleNavigationContextOnFilterChange
};

export default exports;
