// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeAddObjectService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import schNavTreeNodeCreateService from 'js/scheduleNavigationTreeNodeCreateService';
import eventBus from 'js/eventBus';
import smConstants from 'js/ScheduleManagerConstants';

let exports;

/**
 * Creates new tree nodes for the given tasks and adds them to the view model collection(VMC).
 * The task will not be added, if the parent is not present in the VMC.
 * The task will not be added, if it already exists under the parent node.
 * The task whose parent is collapsed, the parent' exapansion cache will be deleted. The children will be loaded during expansion.
 *
 * @param {Object} dataProvider The tree data provider
 * @param {Array} newTasks Tasks to be added to the tree.
 */
export let addTreeNodesForTasks = ( dataProvider, newTasks ) => {
    let addTaskInfo = getAddTaskInfo();
    if( !addTaskInfo.parentTaskUid && !addTaskInfo.siblingUid ) {
        return;
    }

    // Filter out the children, because the the nodes for parent tasks, if any,
    // will be added as collapsed by default.
    let newTaskUids = newTasks.map( object => object.uid );
    let uidsToAdd = _.filter( newTaskUids, ( taskUid ) => {
        return newTaskUids.indexOf( getParentTaskUid( taskUid ) ) === -1;
    } );

    // Iterate and add new nodes.
    let vmCollection = dataProvider.viewModelCollection;
    uidsToAdd.forEach( uidToAdd => {
        let parentUid = getParentTaskUid( uidToAdd );
        if( addTaskInfo.parentTaskUid !== parentUid ) {
            addTaskInfo.parentTaskUid = parentUid;
            addTaskInfo.siblingUid = null;
        }
        addTaskInfo.uidToAdd = uidToAdd;

        addTaskInfo.parentNode = vmCollection.loadedVMObjects.find( vmo => vmo.uid === parentUid );
        // If the parent is not found, then search through all collapsed nodes to check if it is
        // present within them. If so, clear that specific node.
        if( !addTaskInfo.parentNode ) {
            vmCollection.loadedVMObjects.forEach( vmObject => {
                if( vmObject.__expandState && structureContainsUid( vmObject, parentUid ) ) {
                    let deletedData = { deletedUids : [], removedNodes : [], dataProvider : dataProvider  };
                    deletedData.removedNodes = deletedData.removedNodes.concat( vmObject.__expandState.children );
                    delete vmObject.__expandState;
                    eventBus.publish( 'scheduleNavigationTree.nodesRemoved', deletedData );
                    return;
                }
            } );
            return;
        }

        // Ignore, if the child is already present.
        if( addTaskInfo.parentNode.children && addTaskInfo.parentNode.children.findIndex( vmo => vmo.uid === addTaskInfo.uidToAdd ) > -1 ) {
            return;
        }

        // Add the children only if the parent(to be) node is expanded.
        // Else, just mark the node as parent i.s. non-leaf.
        if( !addTaskInfo.parentNode.isExpanded || addTaskInfo.parentNode.isLeaf ) {
            addTaskInfo.parentNode.isLeaf = false;

            // Delete the cache, if we are adding a child to a collpased parent.
            // This can happen if the task is added from a different view model.
            if( addTaskInfo.parentNode.__expandState ) {
                let deletedData = { deletedUids : [], removedNodes : [], dataProvider : dataProvider  };
                deletedData.removedNodes = deletedData.removedNodes.concat( addTaskInfo.parentNode.__expandState.children );
                delete addTaskInfo.parentNode.__expandState;

                // Notify about the removed nodes.
                eventBus.publish( 'scheduleNavigationTree.nodesRemoved', deletedData );
            }
            return;
        }

        let childNode = undefined;
        updateSiblingInfo( addTaskInfo );

        if( addTaskInfo.siblingIndex > -1 ) {
            let childIndex = addTaskInfo.siblingIndex + 1;
            childNode = addNewChildNode( addTaskInfo, childIndex );

            // Add to view model collection.
            addNodeToVmcAfterSibling( vmCollection, childNode, addTaskInfo );
        } else if( addTaskInfo.insertAsFirstChild ) {
            childNode = addNewChildNode( addTaskInfo, 0 );

            // Insert immediately after the parent
            let parentVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addTaskInfo.parentNode.uid );
            vmCollection.loadedVMObjects.splice( parentVmcIndex + 1, 0, childNode );
        } else if( _.get( addTaskInfo.parentNode, 'cursorObject.endReached', true ) ) {
            let nChildren = _.get( addTaskInfo.parentNode, 'children.length', 0 );
            addTaskInfo.siblingUid = nChildren > 0 ? addTaskInfo.parentNode.children[nChildren - 1].uid : null;

            childNode = addNewChildNode( addTaskInfo, nChildren );

            // If it is the first child, add immediately below the parent in view mode collection.
            if( nChildren === 0 ) {
                let parentVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addTaskInfo.parentNode.uid );
                vmCollection.loadedVMObjects.splice( parentVmcIndex + 1, 0, childNode );
            } else {
                addNodeToVmcAfterSibling( vmCollection, childNode, addTaskInfo );
            }
        }
        if( childNode ) {
            addTaskInfo.siblingUid = childNode.uid;

            // Notify listeners about newly added nodes.
            eventBus.publish( 'scheduleNavigationTree.nodesAdded', { addedNodes: [ childNode ], dataProvider : dataProvider } );
        }
    } );

    vmCollection.totalObjectsLoaded = vmCollection.loadedVMObjects.length;
    dataProvider.update( vmCollection.loadedVMObjects );
};

/**
 * Returns information of the current selection, which will be used to add nodes
 * in the tree for the new tasks.
 * @returns {Object} Task info object containing the UIDs of selected object uid and it's parent.
 */
let getAddTaskInfo = () => {
    let addTaskInfo = {
        parentTaskUid: null,
        siblingUid: null
    };

    var selectedUid = _.get( appCtxSvc, 'ctx.selected.uid', undefined );
    if( _.isEmpty( selectedUid ) ) {
        return addTaskInfo;
    }

    let selectedObject = cdm.getObject( selectedUid );
    if( cmm.isInstanceOf( 'Schedule', selectedObject.modelType ) ) {
        addTaskInfo.parentTaskUid = _.get( selectedObject, 'props.fnd0SummaryTask.dbValues[0]', null );
        return addTaskInfo;
    }

    if( cmm.isInstanceOf( 'ScheduleTask', selectedObject.modelType ) ) {
        let taskType = _.get( selectedObject, 'props.task_type.dbValues[0]', smConstants.TASK_TYPE.T );

        if( taskType === smConstants.TASK_TYPE.SS ) {
            addTaskInfo.parentTaskUid = selectedUid;
        } else {
            addTaskInfo.siblingUid = selectedUid;
            addTaskInfo.parentTaskUid = _.get( cdm.getObject( selectedUid ), 'props.fnd0ParentTask.dbValues[0]', null );
        }
        return addTaskInfo;
    }

    return addTaskInfo;
};

/**
 * Returns true if UID is located within the structure of the node.
 * @param {String} node the structure to look through
 * @param {String} uidToLookFor UID of the child task to look for
 * @returns {Boolean} whether the uid is present.
 */
let structureContainsUid = ( node, uidToLookFor ) => {
    if( node.uid === uidToLookFor ) {
        return true;
    }
    let children;
    if( node.children ) {
        children = node.children;
    } else if ( node.__expandState && node.__expandState.children ) {
        children = node.__expandState.children;
    } else {
        return false;
    }
    for( var child of children ) {
        if( structureContainsUid( child, uidToLookFor ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Returns the UID of the parent task.
 * @param {String} taskUid UID of the task to fetch the parent
 * @returns {String} the parent task UID.
 */
let getParentTaskUid = ( taskUid ) => {
    let vmo = cdm.getObject( taskUid );
    if( cmm.isInstanceOf( 'ScheduleTask', vmo.modelType ) ) {
        let taskType = _.get( vmo, 'props.task_type.dbValues[0]', smConstants.TASK_TYPE.T );
        // If the type is schedule summary, then input VMO is the parent.
        if( taskType === smConstants.TASK_TYPE.SS ) {
            return vmo.uid;
        }
        return _.get( vmo, 'props.fnd0ParentTask.dbValues[0]', undefined );
    }
    // In case of proxy task, return the parent of the reference task.
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', vmo.modelType ) ) {
        let refTaskUid = _.get( vmo, 'props.fnd0ref.dbValues[0]', undefined );
        if( refTaskUid ) {
            return getParentTaskUid( refTaskUid );
        }
    }
    return undefined;
};

/**
 * Updates the correct sibling based on whether there are proxy task referencing the currernt sibling or not.
 * Because, tasks cannot be added next to the sibling(ScheduleTask) node, if there are proxy tasks next to it.
 * In such cases, the last proxy task node referencing the sibling should be used as the sibling.
 * @param {*} addTaskInfo The task info to update.
 */
let updateSiblingInfo = ( addTaskInfo ) => {
    if( !addTaskInfo.siblingUid ) {
        addTaskInfo.siblingIndex = -1;

        // If the vmo being added is Proxy Task and the parent is schedule summary, then proxy task
        // has to be inserted immediately below the schedule summary (first child) or after all the
        // existing proxies which are immediately under the schedule summary.
        let vmoToAdd = cdm.getObject( addTaskInfo.uidToAdd );
        if( cmm.isInstanceOf( 'Fnd0ProxyTask', vmoToAdd.modelType ) &&
            _.get( cdm.getObject( addTaskInfo.parentNode.uid ), 'props.task_type.dbValues[0]', smConstants.TASK_TYPE.T ) === smConstants.TASK_TYPE.SS ) {
            let currentIndex = 0;
            // Traverse only if schedule summary has children.
            if( addTaskInfo.parentNode.children ) {
                for( currentIndex; currentIndex < addTaskInfo.parentNode.children.length; ++currentIndex ) {
                    let childUid = addTaskInfo.parentNode.children[ currentIndex ].uid;
                    let childObj = cdm.getObject( childUid );
                    if( cmm.isInstanceOf( 'ScheduleTask', childObj.modelType ) ) {
                        break;
                    }
                }
            }

            addTaskInfo.siblingIndex = currentIndex - 1;
            if( addTaskInfo.siblingIndex > -1 ) {
                addTaskInfo.siblingUid = addTaskInfo.parentNode.children[ addTaskInfo.siblingIndex ].uid;
            } else {
                addTaskInfo.insertAsFirstChild = true; // Add the proxy task immediately below the schedule summary.
            }
        }
        return;
    }

    addTaskInfo.siblingIndex = _.findIndex( addTaskInfo.parentNode.children, vmo => vmo.uid === addTaskInfo.siblingUid );
    if( addTaskInfo.siblingIndex <= -1 ) {
        return;
    }

    // Find the real previous sibling index by skipping the proxy task
    // nodes,if any, next to the current sibling.
    let currentIndex = addTaskInfo.siblingIndex + 1;
    for( currentIndex; currentIndex < addTaskInfo.parentNode.children.length; ++currentIndex ) {
        let childUid = addTaskInfo.parentNode.children[currentIndex].uid;
        let childObj = cdm.getObject( childUid );
        if( cmm.isInstanceOf( 'ScheduleTask', childObj.modelType ) ) {
            break;
        }
    }
    addTaskInfo.siblingIndex = currentIndex - 1;
    addTaskInfo.siblingUid = addTaskInfo.parentNode.children[addTaskInfo.siblingIndex].uid;
};

/**
 * Creates and adds a new child node to the given parent node at the given index.
 * @param {Object} addTaskInfo Contains information about the task to be added.
 */
let addNewChildNode = ( addTaskInfo, childIndex ) => {
    let parentNode = addTaskInfo.parentNode;
    let childUid = addTaskInfo.uidToAdd;

    let childNode = schNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( cdm.getObject( childUid ), parentNode.uid, childIndex, parentNode.levelNdx + 1 );

    if( !parentNode.children ) {
        parentNode.children = [];
    }
    parentNode.children.splice( childIndex, 0, childNode );

    if( !parentNode.totalChildCount ) {
        parentNode.totalChildCount = 0;
    }
    parentNode.totalChildCount += 1;

    for( let index = childIndex + 1; index < parentNode.children.length; ++index ) {
        parentNode.children[index].childNdx += 1;
    }

    return childNode;
};

/**
 * Adds the given node to the view model collection
 * @param {*} vmCollection The view model collection to add the node to.
 * @param {*} node The node to add.
 * @param {*} addTaskInfo Information about the parent and sibling of the task to add.
 */
let addNodeToVmcAfterSibling = ( vmCollection, node, addTaskInfo ) => {
    let parentVmcIndex  = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addTaskInfo.parentTaskUid );
    if( parentVmcIndex <= -1 ) {
        return;
    }

    let siblingVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addTaskInfo.siblingUid );
    if( siblingVmcIndex <= -1 ) {
        return;
    }

    let childLevelIndex = vmCollection.loadedVMObjects[parentVmcIndex].levelNdx + 1;
    let childVmcIndex = siblingVmcIndex + 1;

    if( childVmcIndex === vmCollection.loadedVMObjects.length ) {
        vmCollection.loadedVMObjects.push( node );
    } else {
        // Iterate from the sibling position and find the next position at the same level
        // skipping the sibling's children.
        // Parent
        //  Task1           <-Start (Sibling) Level-1
        //   Child1         <-Skip Level-2
        //   Child2         <-Skip Level-2
        //     Child2.1     <-Skip Level-3
        //     Child2.x     <-Skip Level-3
        //   Childx         <-Skip Level-2
        //  Task2           <-Stop Level-1 (Insert before this)
        //
        for( childVmcIndex; childVmcIndex < vmCollection.loadedVMObjects.length; ++childVmcIndex ) {
            if( vmCollection.loadedVMObjects[childVmcIndex].levelNdx === childLevelIndex ) {
                break;
            }
            if(  vmCollection.loadedVMObjects[childVmcIndex].levelNdx < childLevelIndex ) {
                break; // This should not happen; parsing the child level is complete.
            }
        }
        vmCollection.loadedVMObjects.splice( childVmcIndex, 0, node );
    }
};

/**
 * After the objects are deleted from the view model collection, we need to
 * clean up the references(parent-children) to the deleted nodes.
 *
 * @param {Object} vmo The VMO to traverse down the hierarchy, to remove the deleted nodes.
 * @param {Array} uidsToRemove The UIDs of the nodes to remove.
 * @param {Object} deletedData Object containing the data of deleted(in the database) UIDs
 *                             and the nodes(deleted & affected) removed from the tree.
 */
let cleanUpDeletedNodes = ( vmo, uidsToRemove, deletedData ) => {
    if( vmo.isLeaf || uidsToRemove.length <= 0 ) {
        return;
    }

    // Some other view model has deleted a node whose parent is collapsed in the tree.
    if( vmo.__expandState ) {
        let deletesFromExpansionCache = _.remove( vmo.__expandState.expandedNodes, ( expandedNode ) => {
            return _.indexOf( uidsToRemove, expandedNode.uid ) > -1;
        } );

        // Some other view model has deleted these nodes. Simple delete the
        // expansion cache, so that we can reload the children during expansion.
        if( deletesFromExpansionCache.length > 0 ) {
            deletedData.removedNodes = deletedData.removedNodes.concat( vmo.__expandState.children );
            delete vmo.__expandState;
        } else {
            // Traverse and clean up the nodes down the hierarchy.
            for( let index = 0; index < vmo.__expandState.children.length; ++index ) {
                if( !vmo.__expandState.children[index].isLeaf ) {
                    cleanUpDeletedNodes( vmo.__expandState.children[index], uidsToRemove, deletedData );
                }
            }
        }
    } else {
        let deletedNodes = _.remove( vmo.children, ( node ) => {
            return _.indexOf( uidsToRemove, node.uid ) > -1;
        } );

        if( deletedNodes.length > 0 ) {
            deletedData.removedNodes = deletedData.removedNodes.concat( deletedNodes );
            // Update the child index and count.
            updateVmoForDeletedChildren( vmo, deletedNodes.length );
        }

        // Traverse and clean up nodes down the hierarchy.
        if( vmo.children ) {
            vmo.children.forEach( child => {
                if( !child.isLeaf ) {
                    cleanUpDeletedNodes( child, uidsToRemove, deletedData );
                }
            } );
        }
    }
};

/**
 * Update the given VMO's total child count and child index of it's children
 * @param {*} vmo The VMO to update
 * @param {*} nDeletedChildren Number of deleted children
 */
let updateVmoForDeletedChildren = ( vmo, nDeletedChildren ) => {
    if( nDeletedChildren <= 0 ) {
        return;
    }
    if( vmo.children.length === 0 ) {
        // Top level schedule summary should always show the expand/collapse icon.
        if( vmo.uid === appCtxSvc.getCtx( 'scheduleNavigationCtx.sourceScheduleSummary' ).uid ) {
            vmo.totalChildCount = 0;
            delete vmo.children;
        } else {
            vmo.isLeaf = true;
            delete vmo.isExpanded;
            delete vmo.totalChildCount;
            delete vmo.children;
        }
    } else {
        for( let index = 0; index < vmo.children.length; ++index ) {
            vmo.children[index].childNdx = index;
        }
        vmo.totalChildCount -= nDeletedChildren;
    }
};

/**
 * Update the dependency info for the new dependencies.
 * @param {*} dependencies Created dependencies
 */
export let addNewDependencies = ( dependencies, dataProvider ) => {
    if( _.isEmpty( dependencies ) ) {
        return;
    }

    let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    let eventInfo = [];
    dependencies.forEach( ( dependency ) => {
        if( !_.find( dependenciesInfo, { uid: dependency.uid } ) ) {
            let primaryUid = dependency.props.primary_object.dbValues[ 0 ];
            let secondaryUid = dependency.props.secondary_object.dbValues[ 0 ];

            // Process only dependencies whose primary or secondary is not an orphan task,
            // as the dependecies cannot be displayed without the primary/secondary in the tree.
            // Also, to render thse dependencies, Gantt will create mock task for these orphan tasks
            // which will never get resolved and thus leads to inconsistent structure w.r.t to tree table.
            // This check is needed until the server has the fix to avoid creating dependencies with
            // orphan tasks.
            if( isValidScheduleTask( primaryUid ) && isValidScheduleTask( secondaryUid ) ) {
                let dependencyInfo = {};
                dependencyInfo.uid = dependency.uid;
                dependencyInfo.primaryUid = primaryUid;
                dependencyInfo.secondaryUid = secondaryUid;

                dependenciesInfo.push( dependencyInfo );
                eventInfo.push( dependencyInfo );
            }
            // Cross Schedule Depedency
            if( isValidScheduleTask( secondaryUid ) && isProxyTask( primaryUid )  ) {
                let dependencyInfo = {};
                dependencyInfo.uid = dependency.uid;
                let homeTaskUid = getHomeTask( primaryUid );

                let homeTaskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskUid );
                if( homeTaskIndex !== -1){
                    dependencyInfo.primaryUid = homeTaskUid;
                }else{
                    dependencyInfo.primaryUid = primaryUid;
                }

                dependencyInfo.secondaryUid = secondaryUid;

                let primaryNodePresent = ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependencyInfo.primaryUid) !== -1 );
                let secondaryNodePresent = ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependencyInfo.secondaryUid) !== -1 );

                if( !_.find( eventInfo, { secondaryUid : dependencyInfo.secondaryUid, primaryUid : dependencyInfo.primaryUid }  ) && ( primaryNodePresent && secondaryNodePresent ) ) {
                    dependenciesInfo.push( dependencyInfo );
                    eventInfo.push( dependencyInfo );
                }
            }
            if( isValidScheduleTask( primaryUid ) && isProxyTask( secondaryUid )  ) {
                let dependencyInfo = {};
                dependencyInfo.uid = dependency.uid;
                dependencyInfo.primaryUid = primaryUid;

                let homeTaskUid = getHomeTask( secondaryUid );
                let homeTaskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskUid );
                if( homeTaskIndex !== -1){
                    dependencyInfo.secondaryUid = homeTaskUid;
                }else{
                    dependencyInfo.secondaryUid = secondaryUid;
                }

                let primaryNodePresent = ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependencyInfo.primaryUid) !== -1 );
                let secondaryNodePresent = ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependencyInfo.secondaryUid) !== -1 );

                if( !_.find( eventInfo, { secondaryUid : dependencyInfo.secondaryUid, primaryUid : dependencyInfo.primaryUid } ) && ( primaryNodePresent && secondaryNodePresent ) ) {
                    dependenciesInfo.push( dependencyInfo );
                    eventInfo.push( dependencyInfo );
                }
            }
        }
    } );

    // Notify dependency additions.
    if( !_.isEmpty( eventInfo ) ) {
        eventBus.publish( 'scheduleNavigationTree.dependenciesAdded', { dependenciesInfo : eventInfo, dataProvider : dataProvider } );
    }
};

/**
 * Determines if the given uid represents a Schedule Task which is not an orphan task type.
 * @param {String} uid UID of the object
 * @returns {Boolean} Is the object a valid Schedule Task ?
 */
let isValidScheduleTask = ( uid ) => {
    let object = cdm.getObject( uid );
    return cmm.isInstanceOf( 'ScheduleTask', object.modelType ) && object.props &&
        object.props.task_type && object.props.task_type.dbValues[ 0 ] !== smConstants.TASK_TYPE.O;
};

/**
 * Determines if the given uid represents a Proxy Task.
 * @param {String} uid UID of the object
 * @returns {Boolean} Is the object a Proxy Task ?
 */
let isProxyTask = ( uid ) => {
    let object = cdm.getObject( uid );
    return cmm.isInstanceOf( 'Fnd0ProxyTask', object.modelType );
};

/**
 * Gives home task of the given uid of Proxy Task.
 * @param {String} uid UID of the object
 * @returns {Object} Home Task of given Proxy Task
 */
let getHomeTask = ( uid ) => {
    let proxyTask = cdm.getObject( uid );
    if( proxyTask &&  proxyTask.props.fnd0task_tag ) {
        return  proxyTask.props.fnd0task_tag.dbValues[ 0 ];
    }
};

exports = {
    addTreeNodesForTasks,
    addNewDependencies
};

export default exports;
