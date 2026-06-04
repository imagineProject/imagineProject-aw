// Copyright (c) 2022 Siemens

/**
 * @module js/scheduleNavigationTreeDragDropService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import ngUtils from 'js/ngUtils';

let exports = {};

let dragDataCache = {
    draggedObjects: [],
    draggedObjUids: []
};

let highlightedElement = null;
let highlightedElements = [];

const _clearDragDataCache = () => {
    dragDataCache.draggedObjects = [];
    dragDataCache.draggedObjUids = [];
};

export const dragTreeNodeStart = ( dragAndDropParams ) => {
    if( dragAndDropParams ) {
        dragDataCache.draggedObjects = dragAndDropParams.targetObjects;
        dragDataCache.draggedObjUids = dragAndDropParams.targetObjects.map( object => object.uid );
    }
};

const dehighlightElement = () => {
    let allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

const unhighlight = ( highlightedElement ) => {
    if( highlightedElement ) {
        //highlightedElement.style.borderTop = "";
        highlightedElement.style.borderBottom = '';
        highlightedElement = null;
    }
};

const unhighlightEls = ( highlightedElements ) => {
    if( highlightedElements.length ) {
        _.forEach( highlightedElements, function( highlightedElement ) {
            unhighlight( highlightedElement );
        } );
    }
};

// Highlights a space inbetween the rows on which the object is dragged over.
export const dragOverTreeNode = ( dragAndDropParams ) => {
    let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;

    dehighlightElement();

    let isDnDEnabled = dragAndDropParams.declViewModel.subPanelContext.provider.scheduleNavigationContext.getValue().isStructureEditSupported;
    if( isDnDEnabled && targetObject && cmm.isInstanceOf( 'ScheduleTask', targetObject.modelType ) && dragDataCache.draggedObjects.length === 1 ) {
        let areSourceTypesValid = true;
        for( let i = 0; i < dragDataCache.draggedObjects.length > 0; ++i ) {
            let isScheduleTask = cmm.isInstanceOf( 'ScheduleTask', dragDataCache.draggedObjects[ i ].modelType );
            let isScheduleSummaryTask = dragDataCache.draggedObjects[ i ].props.task_type.dbValues[ 0 ] === '6';
            if( !isScheduleTask || isScheduleTask && isScheduleSummaryTask ) {
                areSourceTypesValid = false;
                break;
            }
        }
        if( areSourceTypesValid && dragDataCache.draggedObjUids.indexOf( targetObject.uid ) <= -1 ) {
            let domRectForTarget = dragAndDropParams.targetElement.getBoundingClientRect();
            let rowTopEdge = domRectForTarget.y;
            let currentTargetCoordinate = dragAndDropParams.event.y;
            if( currentTargetCoordinate > rowTopEdge && currentTargetCoordinate < rowTopEdge + domRectForTarget.height ) {
                unhighlight( highlightedElement );
                unhighlightEls( highlightedElements );

                let splmTable = ngUtils.closestElement( dragAndDropParams.targetElement, '.aw-splm-table' );
                let splmTablePinnedContainer = splmTable.querySelector( '.aw-splm-tablePinnedContainer' );
                let splmTableScrollContainer = splmTable.querySelector( '.aw-splm-tableScrollContainer' );
                let rowIndex = parseInt( dragAndDropParams.targetElement.getAttribute( 'data-indexnumber' ) );

                if( !_.isUndefined( rowIndex ) ) { // target on table row
                    let pcRow;
                    let scRow;

                    let pcList = splmTablePinnedContainer.querySelectorAll( 'div.ui-grid-row[data-indexnumber=\'' + rowIndex + '\']' );
                    if( pcList && pcList.length > 0 ) {
                        pcRow = pcList[ 0 ];
                    }

                    let scList = splmTableScrollContainer.querySelectorAll( 'div.ui-grid-row[data-indexnumber=\'' + rowIndex + '\']' );
                    if( scList && scList.length > 0 ) {
                        scRow = scList[ 0 ];
                    }

                    if( !_.isUndefined( pcRow ) && !_.isUndefined( scRow ) ) {
                        pcRow.style.borderBottom = '8px solid #50bed7';
                        scRow.style.borderBottom = '8px solid #50bed7';

                        highlightedElements = [];
                        highlightedElements.push( pcRow );
                        highlightedElements.push( scRow );
                    }
                }
            }
            return {
                preventDefault: true,
                dropEffect: 'copy'
            };
        }
    }
    unhighlight( highlightedElement );
    unhighlightEls( highlightedElements );
    return {
        dropEffect: 'none'
    };
};

/**
 * This function will invoke when we drag the task.
 *
 * @param {String} srcTaskId - Id of the task to be dragged.
 * @param {String} targetTaskId - Id of the target task
 * @param {String} parentScheduleUid - parent schedule uid
 * @returns {object} moveTaskInfo
 */
let onTaskReorder = function( srcTaskId, targetTaskId, parentScheduleUid ) {
    let srcTask = cdm.getObject( srcTaskId );
    let targetTask = cdm.getObject( targetTaskId );
    let scheduleObject = cdm.getObject( parentScheduleUid );
    let moveRequests = [];
    let sourceSchedule;
    let targetSchedule;
    let moveTaskReqObject;

    if( targetTask ) {
        if( targetTask.props.task_type.dbValues[ 0 ] === '5' ) { //PROXY_TASK
            return false;
        }
        let summaryTaskId = targetTask.props.fnd0ParentTask.dbValues[ 0 ];
        let parentTask = null;
        if( summaryTaskId !== null ) {
            parentTask = cdm.getObject( summaryTaskId );
        }

        let schSummaryTask = cdm.getObject( scheduleObject.props.fnd0SummaryTask.dbValues[ '0' ] );
        sourceSchedule = srcTask.props.schedule_tag.dbValues[ 0 ];
        targetSchedule = targetTask.props.schedule_tag.dbValues[ 0 ];
        let checkTargetSummaryTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ 0 ] );

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
    }
    moveRequests.push( moveTaskReqObject );
    return {
        schedule: scheduleObject,
        moveRequests: moveRequests,
        sourceSchedule: sourceSchedule,
        targetSchedule: targetSchedule
    };
};

let prepareMoveTaskReqObject = function( parentTask, targetTask, srcTask, schSummaryTask ) {
    let moveTaskReqObject;
    let newParent;
    let prevSibling;
    let task = srcTask;

    if( parentTask === targetTask ) {
        let newParentTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ '0' ] );
        prevSibling = targetTask;
        newParent = schSummaryTask;

        if( newParentTask && targetTask.props.fnd0ParentTask.dbValues[ '0' ] !== parentTask.uid ) {
            newParent = newParentTask;
        }
    } else if( srcTask !== targetTask ) {
        let prevSiblingTask = cdm.getObject( targetTask.props.fnd0ParentTask.dbValues[ '0' ] );
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
 * Function to process source and target task data after drop operation
 *
 * @param {object} dragAndDropParams targetd node information
 * @returns {object} return
 */
export const dropTreeNode = ( dragAndDropParams ) => {
    let draggedObjectuid = _.cloneDeep( dragDataCache.draggedObjects[ 0 ].uid );
    let targetObjectUid = _.cloneDeep( dragAndDropParams.targetObjects[ 0 ].uid );
    let parentScheduleSummaryTask = _.cloneDeep( dragAndDropParams.dataProvider.viewModelCollection.loadedVMObjects[ 0 ] );
    let parentScheduleUid = parentScheduleSummaryTask.props.schedule_tag.dbValues[ '0' ];
    _clearDragDataCache();
    unhighlight( highlightedElement );
    unhighlightEls( highlightedElements );
    if( parentScheduleSummaryTask.uid === targetObjectUid && parentScheduleSummaryTask.props.task_type.dbValues[ 0 ] === '6' ) {
        eventBus.publish( 'ScheduleNavigationTree.errMsgForSchSummaryTask', parentScheduleSummaryTask );
    } else {
        let moveTaskInfo = onTaskReorder( draggedObjectuid, targetObjectUid, parentScheduleUid );
        if( moveTaskInfo ) {
            if( moveTaskInfo.sourceSchedule !== moveTaskInfo.targetSchedule ) {
                eventBus.publish( 'ScheduleNavigationTree.warningMsgForMoveTaskAcrossSchedules', moveTaskInfo );
            } else {
                eventBus.publish( 'ScheduleNavigationTree.SchTaskReorderEvent', moveTaskInfo );
            }
        }
        return {
            preventDefault: true
        };
    }
};

/**
 * Update schedule Tree Node Position
 *
 * @param {object} treeDataProvider contains data provider for the tree table
 * @param {Object} moveTaskInfo  The move task information
 */
export let updateScheduleTreeNodePosition = ( treeDataProvider, moveTaskInfo ) => {
    if( treeDataProvider.viewModelCollection && treeDataProvider.viewModelCollection.loadedVMObjects && treeDataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        let task = moveTaskInfo.task;
        let prevSiblingTask = moveTaskInfo.prevSibling;
        let newParent = moveTaskInfo.newParent;

        let loadedVMObjects = treeDataProvider.viewModelCollection.loadedVMObjects;

        let taskTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === task.uid; } );
        let taskTreeNode = treeDataProvider.viewModelCollection.getViewModelObject( taskTreeNodeIndex );

        let newParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === newParent.uid; } );
        let newParentTreeNode = treeDataProvider.viewModelCollection.getViewModelObject( newParentTreeNodeIndex );

        let oldParentTreeNodeUid = taskTreeNode.parentNodeUid;
        let oldParentTreeNode = _.find( loadedVMObjects, vmo => vmo.uid === oldParentTreeNodeUid );
        if( oldParentTreeNode && oldParentTreeNode.levelNdx === -1 ) {
            oldParentTreeNodeUid = loadedVMObjects[ 0 ].parentNodeUid;
        }

        let oldParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === oldParentTreeNodeUid; } );

        // update new parentNode and update its level index
        taskTreeNode.parentNodeUid = newParentTreeNode.uid;
        taskTreeNode.levelNdx = newParentTreeNode.levelNdx + 1;

        let allNodesToReorder = [];
        removeNodeFromOldParent( loadedVMObjects, taskTreeNode, taskTreeNodeIndex, oldParentTreeNodeIndex, allNodesToReorder );

        // Get the latest index for insertion after removing the node.
        newParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === newParent.uid; } );

        addNodeToNewParent( loadedVMObjects, allNodesToReorder, newParentTreeNodeIndex, taskTreeNode, prevSiblingTask );

        // Notify listeners about task reordering.
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
        eventBus.publish( 'scheduleNavigationTree.tasksReordered', { dataProvider: treeDataProvider, operation: "reorder", moveTasksInfo: [ moveTaskInfo ] } );
    }
};

/**
 * Remove tree node and its children from its old parent tree node
 *
 * @param {Array} loadedVMObjects view model collection
 * @param {Object} taskTreeNode  task Tree Node
 * @param {Number} taskTreeNodeIndex index of task Tree Node
 * @param {Number} oldParentTreeNodeIndex index of old parent tree node
 * @param {Array} allNodesToReorder updated schedule object list
 */
let removeNodeFromOldParent = ( loadedVMObjects, taskTreeNode, taskTreeNodeIndex, oldParentTreeNodeIndex, allNodesToReorder ) => {
    // add Selected Schedule object
    allNodesToReorder.push( taskTreeNode );

    let childCount = 0;
    if( loadedVMObjects[ taskTreeNodeIndex ].children ) {
        loadedVMObjects[ taskTreeNodeIndex ].levelNdx = taskTreeNode.levelNdx;
        childCount = traverseIncreaseChildrenIndex( loadedVMObjects[ taskTreeNodeIndex ] );
        let firstChildIndex = taskTreeNodeIndex + 1;
        let lastChildInx = taskTreeNodeIndex + childCount;

        // updated index of childrens of selected Schedule object which is moved
        for( let i = firstChildIndex; i <= lastChildInx; i++ ) {
            let parentNode = _.find( loadedVMObjects, vmo => vmo.uid === loadedVMObjects[ i ].parentNodeUid );
            loadedVMObjects[ i ].levelNdx = parentNode.levelNdx + 1;
            allNodesToReorder.push( loadedVMObjects[ i ] );
        }
    }

    // Remove entry from children attribute of old parent schedule
    if( loadedVMObjects[ oldParentTreeNodeIndex ].children ) {
        let children = loadedVMObjects[ oldParentTreeNodeIndex ].children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === taskTreeNode.uid; } );
        children.splice( childIndex, 1 );
        if( children.length === 0 ) {
            loadedVMObjects[ oldParentTreeNodeIndex ].isLeaf = true;
        } else {
            // Update the child index.
            for( let index = 0; index < children.length; ++index ) {
                children[ index ].childNdx = index;
            }
        }
    }

    // remove schedule from old index
    loadedVMObjects.splice( taskTreeNodeIndex, childCount + 1 );
};

/**
 * Add tree node and its children to its new parent tree node
 *
 * @param {Array} loadedVMObjects view model collection
 * @param {Array} allNodesToReorder updated schedule object list
 * @param {Number} newParentTreeNodeIndex index of new parent tree node
 * @param {Object} taskTreeNode  task Tree Node
 * @param {Object} prevSiblingTask previous sibling task information
 */
let addNodeToNewParent = ( loadedVMObjects, allNodesToReorder, newParentTreeNodeIndex, taskTreeNode, prevSiblingTask ) => {
    // add moved schedule objects and its children below its previous sibling
    let prevSiblingScheduleTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === prevSiblingTask.uid; } );
    let prevSiblingchildCount = 0;
    if( loadedVMObjects[ prevSiblingScheduleTreeNodeIndex ].children ) {
        prevSiblingchildCount = addChildCount( loadedVMObjects[ prevSiblingScheduleTreeNodeIndex ] );
    }

    let newIndex = prevSiblingScheduleTreeNodeIndex + prevSiblingchildCount + 1;
    for( let index = 0; index < allNodesToReorder.length; index++ ) {
        loadedVMObjects.splice( newIndex, 0, allNodesToReorder[ index ] );
        newIndex++;
    }

    // Updates children attribute of new parent schedule
    if( loadedVMObjects[ newParentTreeNodeIndex ].children ) {
        let children = loadedVMObjects[ newParentTreeNodeIndex ].children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === prevSiblingTask.uid; } );
        children.splice( childIndex + 1, 0, taskTreeNode );

        // Update the child index.
        for( let index = 0; index < children.length; ++index ) {
            children[ index ].childNdx = index;
        }
    }
};

/**
 * Get number of nested child
 *
 * @param {Array} vmNode - selected vmNode
 * @returns {Number} The number of nested chiild
 */
let addChildCount = ( vmNode ) => {
    let index = 0;
    if( vmNode.children && vmNode.children.length > 0 ) {
        index += vmNode.children.length;
        vmNode.children.forEach( ( child ) => {
            index += addChildCount( child );
        } );
    }
    return index;
};

/**
 * Function to traverse the nested childs and increase its level index
 *
 *  @param {Array} vmNode - selected vmNode
 * @return {int} returns number of nested children
 */
let traverseIncreaseChildrenIndex = function( vmNode ) {
    let index = 0;
    if( vmNode.children && vmNode.children.length > 0 ) {
        index += vmNode.children.length;
        vmNode.children.forEach( ( child ) => {
            child.levelNdx = vmNode.levelNdx + 1;
            index += addChildCount( child );
        } );
    }
    return index;
};

export default exports = {
    dragTreeNodeStart,
    dragOverTreeNode,
    dropTreeNode,
    updateScheduleTreeNodePosition
};
