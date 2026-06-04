// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeEditService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import indentTaskService from 'js/IndentTaskService';
import outdentTaskService from 'js/OutdentTaskService';
import schNavTreeNodeAddService from 'js/scheduleNavigationTreeAddObjectService';
import schNavTreeNodeRemoveService from 'js/scheduleNavigationTreeRemoveObjectService';
import scheduleNavigationTreeDragDropService from 'js/scheduleNavigationTreeDragDropService';
import eventBus from 'js/eventBus';
import selectionService from 'js/selection.service';
import treeDPReqRespHelper from 'js/treeDataProviderRequestResponseHelper';

let exports;

/**
 * Adds the newly created objects to the tree
 *
 * @param {Object} data
 * @param {Object} eventMap
 */
export let addCreatedObjects = ( data, eventMap ) => {
    var createdObjects = eventMap[ 'cdm.created' ].createdObjects;

    let newTasks = _.filter( createdObjects, ( object ) => {
        return cmm.isInstanceOf( 'ScheduleTask', object.modelType ) || cmm.isInstanceOf( 'Fnd0ProxyTask', object.modelType );
    } );

    let dependencies = _.filter( createdObjects, ( object ) => {
        return cmm.isInstanceOf( 'TaskDependency', object.modelType );
    } );

    // Process new tasks
    if( !_.isEmpty( newTasks ) ) {
        schNavTreeNodeAddService.addTreeNodesForTasks( data.dataProviders.scheduleNavigationTreeDataProvider, newTasks );
        let canShowGanttFilter = appCtxSvc.getCtx( 'scheduleNavigationCtx.canShowGanttFilter' );
        if ( !canShowGanttFilter ) {
            appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.canShowGanttFilter', true );
        }
    }

    // Process new dependencies
    if( !_.isEmpty( dependencies ) ) {
        let dataProvider = data.dataProviders.scheduleNavigationTreeDataProvider;
        schNavTreeNodeAddService.addNewDependencies( dependencies, dataProvider );
    }
};

/**
 *  Removes the deleted objects
 *
 * @param {Object} data
 * @param {Object} eventMap
 */
export let removeDeletedObjects = ( data, eventMap ) => {
    let deletedObjectUids = eventMap[ 'cdm.deleted' ].deletedObjectUids;

    // Process dependency deletions.
    let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    let deletedDepInfos = _.remove( dependenciesInfo, dependencyInfo => _.indexOf( deletedObjectUids, dependencyInfo.uid ) > -1 );
    if( !_.isEmpty( deletedDepInfos ) ) {
        eventBus.publish( 'scheduleNavigationTree.dependenciesDeleted', { dependenciesInfo : deletedDepInfos, dataProvider : data.dataProviders.scheduleNavigationTreeDataProvider } );
    }

    // Process deleted tasks.
    let deletedTaskUids = deletedObjectUids.filter( uid => _.findIndex( deletedDepInfos, depInfo => depInfo.uid === uid ) <= -1 );
    if( deletedTaskUids.length > 0 ) {
        let rootNode = data.dataProviders.scheduleNavigationTreeDataProvider.viewModelCollection.loadedVMObjects[ 0 ];
        let deletedData = { deletedUids: deletedTaskUids, removedNodes: [] };
        schNavTreeNodeRemoveService.removeDeletedTreeNodes( rootNode, deletedTaskUids, deletedData );
        let canShowGanttFilter = appCtxSvc.getCtx( 'scheduleNavigationCtx.canShowGanttFilter' );
        if( ( !rootNode.children || rootNode.children.length <= 0 ) && canShowGanttFilter ) {
            appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.canShowGanttFilter', false );
        }

        // Notify about the removed nodes.
        deletedData.dataProvider = data.dataProviders.scheduleNavigationTreeDataProvider;
        eventBus.publish( 'scheduleNavigationTree.nodesRemoved', deletedData );
    }

    let selectedObjects = appCtxSvc.getCtx( 'mselected' );
    if( selectedObjects && selectedObjects.length > 0 ) {
        let index = _.findIndex( selectedObjects, selectedObject => {
            return _.findIndex( deletedObjectUids, deletedObjectUid => deletedObjectUid === selectedObject.uid ) > -1;
        } );

        let delDepIndex = _.findIndex( selectedObjects, selectedObject => {
            return _.findIndex( deletedDepInfos, deletedDepInfo => deletedDepInfo.uid === selectedObject.uid ) > -1;
        } );

        // Update the selection, only if a dependency in the Gantt is deleted
        // or a task in the tree table is deleted.
        let newSelection = undefined;
        if( delDepIndex > -1 ) {
            newSelection = data.dataProviders.scheduleNavigationTreeDataProvider.getSelectedObjects();
        } else if( index > -1 && treeDPReqRespHelper.isViewModelTreeNode( selectedObjects[ index ] ) ) {
            newSelection = data.subPanelContext.sourceSchedule;
        }
        if( newSelection ) {
            selectionService.updateSelection( newSelection, data.subPanelContext.sourceSchedule );
        }
    }
};

/**
 * @param {Object} moveRequests moveTasks soa input data
 */
export let updateTaskTreeNodePosition = ( moveRequests ) => {
    let eventData = {
        newParent: moveRequests[ 0 ].newParent,
        prevSibling: moveRequests[ 0 ].prevSibling,
        task: moveRequests[ 0 ].task
    };
    eventBus.publish( 'scheduleNavigationTreeDataProvider.moveTasks', eventData );
};

export let moveTasks = ( treeDataProvider, eventData ) => {
    let isIndentCommandActive = appCtxSvc.getCtx( 'IsIndentCommandActive' );
    let isOutdentCommandActive = appCtxSvc.getCtx( 'isOutdentCommandActive' );
    if( isIndentCommandActive ) {
        indentTaskService.performIndentAction( treeDataProvider, eventData );
    } else if( isOutdentCommandActive ) {
        outdentTaskService.performOutdentAction( treeDataProvider, eventData );
    } else {
        scheduleNavigationTreeDragDropService.updateScheduleTreeNodePosition( treeDataProvider, eventData );
    }
};

/**
 * Function to remove nodes and its childrens from tree
 *
 * @param {Array} nodesToRemove - Nodes to be removed
 * @param {Array} loadedVMObjects - Array of View model objects
 * @param {Map} uidToRemovedTreeNodesMap - Map of input nodes (UIDs) to removed nodes (including children)
 * @param {Object} oldParentTreeNode - Old parent tree node
 */
export let removeTreeNodesFromVMC = function( nodesToRemove, loadedVMObjects, uidToRemovedTreeNodesMap, oldParentTreeNode ) {
    for( let i = 0; i < nodesToRemove.length; i++ ) {
        let removedTreeNodes = [];
        let childCount = 0;

        removedTreeNodes.push( nodesToRemove[ i ] );
        let treeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === nodesToRemove[ i ].uid; } );
        let treeNode = loadedVMObjects[ treeNodeIndex ];
        if( treeNode.children ) {
            childCount = getExpandedChildCount( treeNode );
            let firstChildIndex = treeNodeIndex + 1;
            let lastChildInx = treeNodeIndex + childCount;
            // updated index of childrens of selected Plan object which is moved
            for( let j = firstChildIndex; j <= lastChildInx; j++ ) {
                removedTreeNodes.push( loadedVMObjects[ j ] );
            }
        }
        uidToRemovedTreeNodesMap[ treeNode.uid ] = removedTreeNodes;

        // remove selected task using old index
        loadedVMObjects.splice( treeNodeIndex, childCount + 1 );

        // remove entry of selected node from children property of old parent tree node
        if( oldParentTreeNode && oldParentTreeNode.children ) {
            let nodeIndex = _.findIndex( oldParentTreeNode.children, function( vmNodeObj ) { return vmNodeObj.uid === treeNode.uid; } );
            oldParentTreeNode.children.splice( nodeIndex, 1 );
            oldParentTreeNode.isLeaf = oldParentTreeNode.children.length <= 0;
        }
    }

    // Update the child index.
    oldParentTreeNode.children && oldParentTreeNode.children.forEach( ( child, index ) => {
        child.childNdx = index;
    } );
};

/**
 * Get the number of nested children, only expanded.
 *
 * @param {Array} vmNode - selected vmNode
 * @returns {Number} The number of nested chiild
 */
let getExpandedChildCount = function( vmNode ) {
    let index = 0;
    if( vmNode.children && vmNode.children.length > 0 ) {
        index += vmNode.children.length;
        vmNode.children.forEach( ( child ) => {
            index += getExpandedChildCount( child );
        } );
    }
    return index;
};

exports = {
    addCreatedObjects,
    removeDeletedObjects,
    updateTaskTreeNodePosition,
    moveTasks,
    removeTreeNodesFromVMC,
    getExpandedChildCount
};

export default exports;
