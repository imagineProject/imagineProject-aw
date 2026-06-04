// Copyright (c) 2023 Siemens

/**
 * @module js/scheduleNavigationGanttIntegrationService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dataSource from 'js/Saw1SchGanttDataSource';
import eventBus from 'js/eventBus';
import schGanttUtils from 'js/SchGanttUtils';
import schNavSelectionService from 'js/scheduleNavigationTreeSelectionService';
import schNavBaselineService from 'js/scheduleNavigationBaselineService';
import schNavScrollService from 'js/scheduleNavigationTreeScrollService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import ganttManager from 'js/uiGanttManager';
import viewModelService from 'js/viewModelService';
import saw1GanttDependencyUtils from 'js/Saw1GanttDependencyUtils';
import logger from 'js/logger';
import tableSvc from 'js/splmTablePublishedService';


let exports;

/**
 * Pushes the initial data loaded in tree table to the Gantt Chart. This is done after
 * the Gantt Chart is initialized and ready to parse the data to be displayed in Gantt.
 */
export let pushInitailDataToGantt = () => {
    if( appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' )[ 0 ] === 'true' &&
        !appCtxSvc.getCtx( 'scheduleNavigationCtx' ).isGanttInitialized ) {
        // Set initialization flag to true, when gantt chart is turned on and gantt initialization is complete.
        appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.isGanttInitialized', true );

        let rootTreeNode = schNavTreeUtils.getRootTreeNode(); // Schedule Summary Task
        if( rootTreeNode ) {
            try {
                // Sync tree table data to gantt.
                addTreeNodesToGantt( rootTreeNode );

                let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
                addDependenciesToGantt( dependenciesInfo );

                // Sync the selections
                let smGanttCtx = appCtxSvc.getCtx( 'smGanttCtx' );
                if( smGanttCtx && smGanttCtx.treeDataProvider ) {
                    let treeDataProvider = smGanttCtx.treeDataProvider;
                    let selectedObjectUids = _.map( treeDataProvider.getSelectedObjects(), 'uid' );
                    schNavSelectionService.selectObjectsInGantt( selectedObjectUids );
                    saw1GanttDependencyUtils.regenerateDependencyIds();
                }

                // Load the baseline tasks
                let loadedTreeNodes = [ rootTreeNode ];
                loadedTreeNodes = loadedTreeNodes.concat( schNavTreeUtils.getChildrenInHierarchy( rootTreeNode ) );
                loadBaselineTasksInGantt( loadedTreeNodes );
            } catch ( error ) {
                logger.error( 'Failed to load inital data in Gantt: ', error );
            } finally {
                // Sync the Gantt scroll bar with Tree table scroll bar position, so that
                // Gantt will scroll and display the current page and selection in Tree table.
                schNavScrollService.scrollGantt();

                // Enable synchronization b/w Tree Table and Gantt scroll bars.
                schNavScrollService.enableScrollSync( true );
            }
        }
    }
};

/**
 * Add the given child nodes of the parent to the Gantt Chart.
 *
 * @param {Object} parentNode Parent node of the children to be added.
 * @param {Array} childNodes Child nodes to add.
 */
export let addChildNodesToGantt = ( parentNode, childNodes ) => {
    if( _.isEmpty( childNodes ) ) {
        return;
    }

    let scheduleTasks = [];
    let parentTasks = [];
    childNodes.forEach( node => {
        scheduleTasks.push( cdm.getObject( node.uid ) );
        parentTasks.push( cdm.getObject( parentNode.uid ) );
    } );

    let ganttTasks = dataSource.instance.constructGanttTasks( scheduleTasks, parentTasks );

    // Ensure the tasks are added based on the index. This is to ensure mock tasks, if any,
    // always remain at the end of the list of children.
    let currentTaskIndex = childNodes[0].childNdx;

    ganttTasks.forEach( ( task ) => {
        ganttManager.getGanttInstance().addTask( task, task.parent, currentTaskIndex++ );
    } );
    ganttManager.getGanttInstance().refreshData();
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Gantt Chart.
 *
 * @param {Object} parentNode The parent to traverse and add children.
 */
export let addTreeNodesToGantt = ( parentNode ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    if( childNodes ) {
        addChildNodesToGantt( parentNode, childNodes );
        childNodes.forEach( ( node ) => {
            addTreeNodesToGantt( node );
        } );
    }

    if( parentNode.isExpanded === true ) {
        var ganttTask = dataSource.instance.getTaskInfo( parentNode.uid );
        ganttTask.$open = true;
    }
};

/**
 * Adds the given view model tree node to gantt.
 * @param {Object} node The node to add.
 */
export let addNodeToGantt = ( node ) => {
    if( !node ) {
        return;
    }
    let ganttTasks = dataSource.instance.constructGanttTasks( [ cdm.getObject( node.uid ) ], [ cdm.getObject( node.parentNodeUid ) ] );

    // Ensure the tasks are added based on the index. This is to ensure mock tasks, if any,
    // always remain at the end of the list of children.
    ganttTasks.forEach( ( task ) => {
        ganttManager.getGanttInstance().addTask( task, task.parent, node.childNdx );
    } );
    ganttManager.getGanttInstance().refreshData();
};

/**
 * Add the list of dependencies to the Gantt Chart.
 * @param {*} dependenciesInfo The dependencies list
 */
export let addDependenciesToGantt = ( dependenciesInfo ) => {
    if( _.isEmpty( dependenciesInfo ) ) {
        return;
    }

    let dependencyObjects = [];
    dependenciesInfo.forEach( ( dependencyInfo ) => {
        let dependencyObject = cdm.getObject( dependencyInfo.uid );
        dependencyObject.props.primary_object.dbValues[ 0 ] = dependencyInfo.primaryUid;
        dependencyObject.props.secondary_object.dbValues[ 0 ] = dependencyInfo.secondaryUid;
        dependencyObjects.push( dependencyObject );
    } );
    dataSource.instance.addDependencies( dependencyObjects );
    schGanttUtils.parseGanttData( [], dataSource.instance.getLinks() );
};

var resetRowHeight = () => {
    let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );
    let rowHeight = appCtxSvc.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
    if( viewModel ) {
        let gridOptions = viewModel.grids.scheduleNavigationTree.gridOptions;
        if( gridOptions && gridOptions.rowHeight ) {
            gridOptions.rowHeight = rowHeight;
            eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
            //set gantt row
            ganttManager.getGanttInstance().config.row_height = rowHeight;
        }
    }
};

/**
 * Sets the baselines to be viewed in Gantt
 * @param {*} baselines Schedule baselines
 */
export let setBaselineToView = ( loadedBaselines, scheduleNavigationContext ) => {
    let newScheduleNavigationContext = _.clone( scheduleNavigationContext );
    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );

    scheduleNavigationCtx.baselines = loadedBaselines;
    appCtxSvc.updateCtx( 'scheduleNavigationCtx', scheduleNavigationCtx );
    appCtxSvc.updateCtx( 'showGanttTaskInfo', 'false' );
    dataSource.instance.setBaselines( loadedBaselines );

    let baselineUids = loadedBaselines.map( baseline => baseline.uid );
    newScheduleNavigationContext.baselineUids = baselineUids;
    scheduleNavigationContext.update( newScheduleNavigationContext );

    if( _.isEmpty( loadedBaselines ) ) {
        // reset gantt row and splm table row
        resetRowHeight();
        schGanttUtils.refreshGanttData();
        return;
    }

    // Load the baseline tasks
    let rootTreeNode = schNavTreeUtils.getRootTreeNode(); // Schedule Summary Task

    let loadedTreeNodes = [ rootTreeNode ];
    loadedTreeNodes = loadedTreeNodes.concat( schNavTreeUtils.getChildrenInHierarchy( rootTreeNode ) );
    loadBaselineTasksInGantt( loadedTreeNodes );
};

/**
 * Prepares the load baseline input and fires the event to load the baseline tasks in Gantt.
 * @param {Array} treeNodes nodes to fetch the baselines for.
 */
export let loadBaselineTasksInGantt = ( treeNodes ) => {
    if( _.isEmpty( treeNodes ) ) {
        return;
    }

    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    let baselines = appCtxSvc.getCtx( 'scheduleNavigationCtx.baselines' );

    if( baselines && !_.isEmpty( baselines ) ) {
        if( _.isEmpty( dataSource.instance.getBaselines() ) ) {
            dataSource.instance.setBaselines( baselines );
        }
        let loadBaselines = schNavBaselineService.prepareLoadBaselinesInput( scheduleNavigationCtx.sourceSchedule, baselines, treeNodes );
        eventBus.publish( 'scheduleNavigationGantt.loadBaselines', { loadBaselines } );
    }
};

exports = {
    pushInitailDataToGantt,
    addChildNodesToGantt,
    addTreeNodesToGantt,
    addNodeToGantt,
    addDependenciesToGantt,
    setBaselineToView,
    loadBaselineTasksInGantt
};

export default exports;
