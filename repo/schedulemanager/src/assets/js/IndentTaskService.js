// Copyright (c) 2022 Siemens

/**
 * @module js/IndentTaskService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import treeEditService from 'js/scheduleNavigationTreeEditService';
import userListService from 'js/userListService';

var exports = {};

var prepareIndentTaskErrorMessage = function( taskNotToBeUpdated, statesMessage, selection ) {
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    var finalMessage = messagingService.applyMessageParams( localTextBundle.invalidIndentErrorMsg, [ '{{numberOfTasks}}' ], {
        numberOfTasks: selection.length
    } );

    if( taskNotToBeUpdated.length > 0 ) {
        finalMessage = messagingService.applyMessageParams( localTextBundle.smPreventUpdatePrefErrorMessge, [ '{{states}}' ], {
            states: statesMessage
        } );
        taskNotToBeUpdated.forEach( function( task ) {
            finalMessage += '\n';
            let message = localTextBundle.singleTaskDeleteErrorMessage;
            message = messagingService.applyMessageParams( localTextBundle.singleTaskDeleteErrorMessage, [ '{{taskName}}', '{{taskStatus}}' ], {
                taskName: task.name,
                taskStatus: task.status
            } );
            finalMessage += message;
        } );
    }
    return finalMessage;
};

/**
 * Get the validation for indent task and prepare the input for moveTask SOA.
 *
 * @param {Array} selectedTasks Primary work area selections
 * @return {Object} moveRequests move tasks SOA input
 */
export let getIndentValidation = function( selectedTasks ) {
    if( !_.isArray( selectedTasks ) ) {
        return [];
    }
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    const { taskNotToBeUpdated, statesMessage } = userListService.getTasksNotToBeUpdated( selectedTasks, true );

    //This array will contains Uids of task whose parent is selected
    let selectionsToExclude = [];
    let selectedTasksUids = [];
    var moveRequests = [];
    var tasksToProcess = [];

    selectedTasks.forEach( seletcedTask => selectedTasksUids.push( seletcedTask.uid ) );
    var parent;
    selectedTasks.forEach( function( seletcedTask ) {
        var parentTaskProp = seletcedTask.props.fnd0ParentTask;
        var parentTask = cdm.getObject( parentTaskProp.dbValues[ 0 ] );
        appCtxSvc.updateCtx( 'oldParentUidForIndentOperation', parentTask.uid );
        if( !parentTask ) {
            message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
            messagingService.showError( message );
            return false;
        }

        let isParentSelected = selectedTasksUids.indexOf( parentTaskProp.dbValues[ 0 ] );
        if( isParentSelected !== -1 ) {
            selectionsToExclude.push( seletcedTask.uid );
        } else {
            if( parent === undefined ) {
                parent = parentTask;
                tasksToProcess.push( seletcedTask.uid );
            } else if( parent === parentTask ) {
                tasksToProcess.push( seletcedTask.uid );
            } else {
                var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                    numberOfTasks: selectedTasks.length
                } );
                messagingService.showError( message );
                return false;
           }
        }
    } );

    var childTasks = parent.props.child_task_taglist;

    var newParent = null;
    let taskIndex = {};
    let indexArray = [];
    tasksToProcess.forEach( function( selected ) {
        if( childTasks.dbValues.indexOf( selected ) === -1 ) {
            var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                numberOfTasks: selectedTasks.length
            } );
            messagingService.showError( message );
            return false;
        }
        indexArray.push( childTasks.dbValues.indexOf( selected ) );
        taskIndex[ childTasks.dbValues.indexOf( selected ) ] = selected;
    } );
    indexArray.sort( function( a, b ) { return a - b; } );
    for( const index in indexArray ) {
        if( indexArray[ index ] - indexArray[ index - 1 ] > 1 ) {
            var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                numberOfTasks: selectedTasks.length
            } );
            messagingService.showError( message );
            return false;
        }
    }

    let topChild = taskIndex[ indexArray[ 0 ] ];
    var topChildProp = cdm.getObject( topChild );
    var parentTaskProp = topChildProp.props.fnd0ParentTask;
    var parentTask = cdm.getObject( parentTaskProp.dbValues[ 0 ] );
    var childTasksProp = parentTask.props.child_task_taglist;
    let parentIndex = childTasksProp.dbValues.indexOf( topChild );
    if( parentIndex === 0 ) {
        message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
        messagingService.showError( message );
        return false;
    }

    newParent = cdm.getObject( childTasksProp.dbValues[ parentIndex - 1 ] );

    if( newParent !== null ) {
        var newParentTask = {
            type: newParent.type,
            uid: newParent.uid
        };
    }
    var prevSiblingTask = {
        type: 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };
    indexArray.forEach( function( index ) {
        var isExcluded = selectionsToExclude.indexOf( taskIndex[ index ] ) > -1;
        if( !isExcluded ) {
            //Summary Task cannot be indented.
            var seletcedTask = cdm.getObject( taskIndex[ index ] );
            if( seletcedTask.props.task_type.dbValues[ 0 ] === 6 ) {
                message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
                messagingService.showError( message );
                return false;
            }

            var moveRequest;
            var taskToIndent = {
                type: seletcedTask.type,
                uid: seletcedTask.uid
            };

            if( typeof newParent !== typeof undefined && prevSiblingTask.type !== 'unknownType' ) {
                moveRequest = {
                    task: taskToIndent,
                    newParent: newParentTask,
                    prevSibling: prevSiblingTask
                };
                moveRequests.push( moveRequest );
            } else {
                moveRequest = {
                    task: taskToIndent,
                    newParent: newParentTask
                };
                moveRequests.push( moveRequest );
            }
            prevSiblingTask = {
                type: seletcedTask.type,
                uid: seletcedTask.uid
            };
        }
    } );
    appCtxSvc.updateCtx( 'IsIndentCommandActive', true );
    return moveRequests;
};

export let getParentTaskObject = function( selectedTasks ) {
    let parentTaskObj;
    let parent = selectedTasks[ 0 ].props.fnd0ParentTask;
    if( parent ) {
        parentTaskObj = cdm.getObject( parent.dbValues[ 0 ] );
    }
    return parentTaskObj;
};

/**
 * Function to perform indent operation
 * @param {Object} treeDataProvider schedule tree data provider
 * @param {object} eventData eventdata with parent child information
 */
export let performIndentAction = function( treeDataProvider, eventData ) {
    let loadedVMObjects = treeDataProvider.viewModelCollection.loadedVMObjects;
    let oldParentUid = appCtxSvc.getCtx( 'oldParentUidForIndentOperation' );
    let newParentUid = eventData.newParent.uid;

    let selectedTreeNodesMap = {};
    let selectedObjects = treeDataProvider.getSelectedObjects();

    // Collect all nodes to be reparented.
    let nodesToReparent = [];
    if( selectedObjects.length > 0 )
    {
        selectedObjects.forEach( selectedObject => {
            selectedObject.nodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === selectedObject.uid; } );
            nodesToReparent.push( selectedObject );

            // Include the successive nodes, which are referencing proxy tasks.
            let nextIndex = selectedObject.nodeIndex + 1;
            while( nextIndex < loadedVMObjects.length && loadedVMObjects[nextIndex].modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) !== -1 ) {
                loadedVMObjects[nextIndex].nodeIndex = nextIndex;
                nodesToReparent.push( loadedVMObjects[nextIndex] );
                ++nextIndex;
            }
        } );

        nodesToReparent.sort( ( vmo1, vmo2 ) => vmo1.nodeIndex > vmo2.nodeIndex ? 1 : -1 );
        nodesToReparent.forEach( vmo => delete vmo.nodeIndex );
    }

    if( nodesToReparent.length > 0 ) {
        let oldParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === oldParentUid; } );
        let oldParentTreeNode = loadedVMObjects[ oldParentTreeNodeIndex ];
        treeEditService.removeTreeNodesFromVMC( nodesToReparent, loadedVMObjects, selectedTreeNodesMap, oldParentTreeNode );

        let newParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === newParentUid; } );
        let newParentTreeNode = loadedVMObjects[ newParentTreeNodeIndex ];

        // if new parent is leaf node
        if( newParentTreeNode.isLeaf ) {
            newParentTreeNode.isLeaf = false;
            newParentTreeNode.isExpanded = true;
            newParentTreeNode.cursorObject = {
                endReached: true,
                startReached: true
            };
            addSelectedNodesToNewParentTreeNode( newParentTreeNode, nodesToReparent, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects );
        } else {
            // if new parent is fully expanded
            if( newParentTreeNode.isExpanded && newParentTreeNode.cursorObject && newParentTreeNode.cursorObject.endReached ) {
                addSelectedNodesToNewParentTreeNode( newParentTreeNode, nodesToReparent, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects );
            } else if( newParentTreeNode.__expandState ) {
                delete newParentTreeNode.__expandState;
            }
        }
    }

    let moveTasksInfo = [];
    nodesToReparent.forEach( vmo => {
        let parentTreeNodeIndex = _.findIndex( loadedVMObjects, function ( vmNodeObj ) { return vmNodeObj.uid === vmo.parentNodeUid; } );
        let parentTreeNode = loadedVMObjects[ parentTreeNodeIndex ];
        let vmoIndex = parentTreeNode.children.findIndex( childVMO => childVMO.uid === vmo.uid );

        let moveTaskInfo = {
            task: { type: vmo.type, uid: vmo.uid },
            newParent: { type: parentTreeNode.type, uid: parentTreeNode.uid }
        };
        if ( vmoIndex > 0 ) {
            moveTaskInfo.prevSibling = { type: parentTreeNode.children[ vmoIndex - 1 ].type, uid: parentTreeNode.children[ vmoIndex - 1 ].uid };
        }
        moveTasksInfo.push( moveTaskInfo );
    } );

    //ganttUtils.moveGanttTask( siblingTaskObj.task, siblingTaskObj.prevIndex, parentUid );
    appCtxSvc.unRegisterCtx( 'oldParentUidForIndentOperation' );
    appCtxSvc.unRegisterCtx( 'IsIndentCommandActive' );
    // to avoid flaky issue,sometimes even all tree node propeties has correct values it does not update the tree node positions
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    eventBus.publish( 'scheduleNavigationTree.tasksReordered', { operation: "indent", moveTasksInfo: moveTasksInfo } );
};


/**
 * Function to add selected nodes and its children after its new parent node
 *
 * @param {Object} newParentTreeNode - new parent tree node
 * @param {Array} selectedObjects - selected objects
 * @param {Map} selectedTreeNodesMap - map with selected nodes and its children information
 * @param {Number} newParentTreeNodeIndex - index of new parent
 * @param {Array} loadedVMObjects - array of View model objects
 */
let addSelectedNodesToNewParentTreeNode = function( newParentTreeNode, selectedObjects, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects ) {
    for( let i = 0; i < selectedObjects.length; i++ ) {
        let newParentNestedChildCount = 0;
        if( newParentTreeNode.children ) {
            newParentNestedChildCount = treeEditService.getExpandedChildCount( newParentTreeNode );
        }
        let selectedTreeNode = selectedObjects[ i ];
        // add selected object and its nested children to new index
        if( selectedTreeNodesMap[ selectedTreeNode.uid ] ) {
            let updatedTreeNodeList = selectedTreeNodesMap[ selectedTreeNode.uid ];
            if( updatedTreeNodeList.length > 0 ) {
                let updatedTreeNodeChildIndex = newParentTreeNodeIndex + newParentNestedChildCount + 1;
                for( let index = 0; index < updatedTreeNodeList.length; index++ ) {
                    updatedTreeNodeList[ index ].levelNdx += 1;
                    loadedVMObjects.splice( updatedTreeNodeChildIndex, 0, updatedTreeNodeList[ index ] );
                    updatedTreeNodeChildIndex++;
                }
            }
        }
        // assign new parent node and add entry selected objects into children property of new parent node
        selectedTreeNode.parentNodeUid = newParentTreeNode.uid;
        if( newParentTreeNode.children && newParentTreeNode.children.length > 0 ) {
            selectedTreeNode.childNdx = newParentTreeNode.children.length;
            newParentTreeNode.children.push( selectedTreeNode );
        } else {
            selectedTreeNode.childNdx = 0;
            newParentTreeNode.children = [ selectedTreeNode ];
        }
    }
};

exports = {
    getIndentValidation,
    getParentTaskObject,
    performIndentAction
};

export default exports;
