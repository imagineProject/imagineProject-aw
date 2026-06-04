// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationExpandService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import _awTableStateSvc from 'js/awTableStateService';
import soaSvc from 'soa/kernel/soaService';
import schNavTreeNodeCreateService from 'js/scheduleNavigationTreeNodeCreateService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import schNavTreeSvc from 'js/scheduleNavigationTreeService';
import awTableStateService from 'js/awTableStateService';

let exports;

let populateParentNodesToExpandUsingExpandState = function( loadedVMOs, vmo, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, vmc, expandToLevel ) {
    let vmoId = vmc.findViewModelObjectById( vmo.uid );
    let addNodeForExpansionStateChange = function( vmo ) {
        if( expandToLevel === -1 || vmo.levelNdx < expandToLevel ) {
            parentNodesToExpandUsingCache.push( vmo );
        }
    };
    //1) If vmo has expansionState ( collapse on vmo case or collapse below on grandparent) or
    if( !_.isEmpty( vmo.__expandState ) ) { // vmo has expansion state ( collapsed , can be candidate for expansion)
        addNodeForExpansionStateChange( vmo );
    } else if( vmo.children && vmoId === -1 ) { //vmo not currently loaded & has children ( collapse grand parent case )
        addNodeForExpansionStateChange( vmo );
    } else if( vmo.isLeaf === false && vmo.isExpanded !== true && vmo.children ) {
        addNodeForExpansionStateChange( vmo );
        nodesToExpandPresentForExpandBelow.push( vmo.id );
    } else if( vmo.isLeaf === false && vmo.isExpanded !== true ) {
        nodesToExpandPresentForExpandBelow.push( vmo.id );
    }

    let vmoChildren = vmo.__expandState ? vmo.__expandState.children : vmo.children;

    _.forEach( vmoChildren, function( vmoChild ) {
        vmoId = vmc.findViewModelObjectById( vmoChild.uid );
        let childToExpand = loadedVMOs[vmoId] !== undefined ? loadedVMOs[vmoId] : vmoChild;

        if( childToExpand.__expandState || childToExpand.children ) {
            populateParentNodesToExpandUsingExpandState( loadedVMOs, childToExpand, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, vmc, expandToLevel  );
        } else {
            if( childToExpand.isLeaf === false && childToExpand.isExpanded !== true ) {
                nodesToExpandPresentForExpandBelow.push( childToExpand.id );
            }
        }
    } );

    return nodesToExpandPresentForExpandBelow;
};
/**
 * Function to perform expand operation for selected task which includes nested childrens
 * @param {Object} treeNode selected tree node to expand
 * @param {Object} declViewModel data object
 */
export let performExpandBelow = ( treeNode, declViewModel, treeDataProvider, topSchedule ) => {
    if( !treeNode || treeNode.isLeaf ) {
        return;
    }

    let loadedVMOs = treeDataProvider.viewModelCollection.getLoadedViewModelObjects();
    let nodesToExpandPresentForExpandBelow = [];
    let expandToLevel = -1;

    //For parent nodes that have collapse cache, pre-expand those nodes ( )
    let parentNodesToExpandUsingCache = [];

    //For vmo to expand below, see if it /its children has collapse cache.
    populateParentNodesToExpandUsingExpandState( loadedVMOs, treeNode, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, treeDataProvider.viewModelCollection, expandToLevel );


    if( parentNodesToExpandUsingCache.length ) {
        for( var ndx = 0; ndx < parentNodesToExpandUsingCache.length; ndx++ ) {
            var parentNode = parentNodesToExpandUsingCache[ ndx ];

            for( var nodeToInsertIndex = 0; nodeToInsertIndex < loadedVMOs.length; nodeToInsertIndex++ ) {
                if( loadedVMOs[ nodeToInsertIndex ].uid === parentNodesToExpandUsingCache[ ndx ].uid ) {
                    nodeToInsertIndex += 1; //index of first child would be parentNdx + 1
                    break;
                }
            }

            let childrenToAdd = parentNode.__expandState ? parentNode.__expandState.children : parentNode.children;

            _.forEach( childrenToAdd, function( childVMO ) {
                //if VMO state is expanded, it will get set while adding its children.
                //While adding node, we should delete it because for Expand Level case,
                //if children dont get added, node is shown as expanded with no children under it.
                if( expandToLevel === childVMO.levelNdx ) {
                    delete childVMO.isExpanded;
                    delete childVMO.expanded;
                }

                loadedVMOs.splice( nodeToInsertIndex, 0, childVMO );
                nodeToInsertIndex++;
            } );

            if( parentNode.__expandState ) {
                parentNode.expanded = true;
                parentNode.isExpanded = true;
                _awTableStateSvc.saveRowExpanded( declViewModel, 'scheduleNavigationTree', parentNode );
                parentNode.isLeaf = false;
                if( !parentNode.children ) {
                    parentNode.children = [];
                }
                parentNode.children = parentNode.__expandState.children;
                parentNode.startChildNdx = parentNode.__expandState.startChildNdx;
                parentNode.totalChildCount = parentNode.__expandState.totalChildCount;
                parentNode.cursorObject = parentNode.__expandState.cursorObject;

                delete parentNode.__expandState;
            }
        }

        treeDataProvider.viewModelCollection.update( loadedVMOs );
        processDependenciesAndRowNumbers( treeDataProvider, treeNode );
    }

    //trigger atomic data update that would trigger expand below for VMO under action only if there are nodesToExpandPresentForExpandBelow
    if( nodesToExpandPresentForExpandBelow.length ) {
        // call SOA
        getTreeNodesSOA( treeNode, declViewModel, treeDataProvider, topSchedule );
    }
};
let processDependenciesAndRowNumbers = function( dataProvider, treeNode, taskDependenciesInfo ) {
    //for Gantt
    let depData = {};
    let indexOfSelectedNode = _.findIndex( dataProvider.viewModelCollection.loadedVMObjects, function( node ) {
        return node.uid === treeNode.uid;
    } );
    // This is to find the next sibling node in a tree
    let allChildNodes = dataProvider.viewModelCollection.loadedVMObjects.slice( indexOfSelectedNode + 1 );
    let indexOfNextSiblingNode = _.findIndex( allChildNodes, function( node ) {
        return treeNode.levelNdx === node.levelNdx;
    } );
    if( indexOfNextSiblingNode > -1 ) {
        allChildNodes = allChildNodes.slice( 0, indexOfNextSiblingNode );
    }
    let eventData = {
        expandBelowResult : {
            childNodes : allChildNodes
        },
        dataProvider : dataProvider,
        expandBelowNode : treeNode
    };

    // Pushing Dependncies in Gantt
    if( taskDependenciesInfo && taskDependenciesInfo.length > 0 ) {
        let depInfo = [];
        _.forEach( taskDependenciesInfo, function( dependency ) {
            depInfo.push( {
                uid: dependency.taskDependency.uid,
                primaryUid : dependency.properties.primary_object,
                secondaryUid : dependency.properties.secondary_object
            } );
        } );
        depData.loadedDependencies = depInfo;
        appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.dependenciesInfo', depInfo );
    }

    eventBus.publish( 'scheduleNavigationTree.expandAll', eventData );

    eventBus.publish( 'scheduleNavigationTree.dependenciesLoaded', depData );
};

export let getTreeNodesSOA = ( treeNode, declViewModel, treeDataProvider, topSchedule ) => {
    if( !treeNode || treeNode.isLeaf ) {
        return;
    }
    let nodesForExpansion = getNodesForExpansion( declViewModel );
    if ( !nodesForExpansion.includes( treeNode.uid ) ) {
        nodesForExpansion.push( treeNode.uid );
    }
    let parentTask = treeDataProvider.vmCollectionObj.vmCollection.loadedVMObjects[0];
    if( treeNode.uid !== parentTask.uid ) {
        nodesForExpansion = nodesForExpansion.filter( item => item !== parentTask.uid );
    }
    soaSvc.postUnchecked( 'Internal-ProjectManagementAw-2023-12-ScheduleManagementAw', 'loadScheduleTree', {
        loadScheduleInput: {
            schedule: {
                type: topSchedule.type,
                uid: topSchedule.uid
            },
            parentTask: {
                type: parentTask.type,
                uid: parentTask.uid
            },
            cursor:
            {
                startReached: false,
                endReached: false,
                startIndex: 0,
                endIndex: 0,
                pageSize: 500,
                startObjectUid : '',
                endObjectUid : ''
            },
            expansionCriteria:
            {
                expandBelow: false,
                loadTreeHierarchyThreshold: 250,
                scopeForExpandBelow: '',
                levelNExpand: 0
            },
            criteria:
            {
                expandedNodes: nodesForExpansion,
                loadCalendarInfo: [ 'false' ]
            }
        }
    }, schNavTreeSvc.getPropertyPolicyForGantt() )
        .then(
            function( response ) {
                if( response.parentChildrenInfo ) {
                    let repaint = false; // need to change once background available
                    applyResponseToTree( response, treeDataProvider, repaint, declViewModel );
                    processDependenciesAndRowNumbers( treeDataProvider, treeNode, response.taskDependenciesInfo );
                }
            } );
};


let _createVMTNodeUsingNodeInfo = function( nodeInfo, parentNode, childIndex, vmNodeCreationStrategy, declViewModel ) {
    var nodeUid = nodeInfo.nodeUid;

    var levelNdx = 0;
    if ( parentNode ) {
        levelNdx = parentNode.levelNdx + 1;
    }
    let obj = cdm.getObject( nodeUid );
    return schNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( obj, parentNode.uid, childIndex, levelNdx, declViewModel );
};

let _validateExistingChildren = function( childNodeInfos, cursor, vmtNodes ) {
    // Already validated that childNodeInfos and cursor indexes align
    if ( vmtNodes.length < cursor.endIndex + 1 ) {
        return false;
    }
};

let _updateVMTNodeUsingNodeInfo = function( existingVMTN, nodeInfo ) {
    existingVMTN.isLeaf = nodeInfo.numberOfChildren <= 0;
};


let _createVMTNodesForGivenTasks = function( childNodeInfos, cursor, parentNode, vmNodeCreationStrategy, vmtNodes, declViewModel ) {
    let replaceNodes = cursor.startIndex === 0 && vmtNodes.length > 0;
    let newDataAligns = cursor.endIndex - cursor.startIndex + 1 === childNodeInfos.length; // need to work on this as cursor is not coming through sever
    if ( replaceNodes ) {
        // New children replace existing. Wipe out existing array and replace it
        // with children from response. Then continue with rest of function as 'simple create'
        vmtNodes = [];
    }
    cursor.startIndex = 0; //temp ideally it should come from server
    if ( vmtNodes.length === cursor.startIndex ) {
        for( let i = 0; i < childNodeInfos.length; ++i ) {
            let vmNode = _createVMTNodeUsingNodeInfo( childNodeInfos[i], parentNode, i, vmNodeCreationStrategy, declViewModel );
            vmtNodes.push( vmNode );
        }
    } else if ( vmtNodes.length > cursor.startIndex ) {
        if ( _validateExistingChildren( childNodeInfos, cursor, vmtNodes ) ) {
            for( let i = 0; i < childNodeInfos.length; ++i ) {
                _updateVMTNodeUsingNodeInfo( vmtNodes[i + cursor.startIndex], childNodeInfos[i] );
            }
        }
    }
};


export let createTreeNodesFromResponse = function( response, vmc, declViewModel ) {
    let createdNodes = new Map();

    let vmNodeCreationStrategy = {
        reuseVMNode: true,
        clearExpandState: true,
        staleVMNodeUids: []
    };

    for ( let parentChildInfo of response.parentChildrenInfo ) {
        let parentId = parentChildInfo.parentInfo.nodeUid;
        let parentNode = createdNodes.get( parentId );
        if ( parentNode === undefined ) {
            let parentObjNdx = vmc.findViewModelObjectById( parentId );
            parentNode = vmc.getViewModelObject( parentObjNdx );
        }

        if ( parentNode !== undefined ) {
            // In expand below, display all parents with children as expanded
            parentNode.isExpanded = true;
            if ( parentNode.children === undefined  || parentNode.children === null ) {
                parentNode.children = [];
            }

            _createVMTNodesForGivenTasks( parentChildInfo.childrenInfo, parentChildInfo.cursor, parentNode,
                vmNodeCreationStrategy, parentNode.children, declViewModel );
            for ( let node of parentNode.children ) {
                createdNodes.set( node.id, node );
            }
        }
    }
    return response.parentChildrenInfo.length;
};

export let collectVisibleVMTNs = function( parent, vmNodes, index, declViewModel ) {
    vmNodes.push( parent );
    if ( parent.children ) {
        _awTableStateSvc.saveRowExpanded( declViewModel, 'scheduleNavigationTree', parent );
        for ( let child of parent.children ) {
            index = collectVisibleVMTNs( child, vmNodes, index, declViewModel );
        }
    }
    return index;
};

export let applyResponseToTree = function( response, treeDataProvider, repaint, declViewModel ) {
    let numUpdates = createTreeNodesFromResponse( response, treeDataProvider.viewModelCollection, declViewModel );
    if ( numUpdates > 0 ) {
        var loadedVMObjects = treeDataProvider.viewModelCollection.getLoadedViewModelObjects();
        let topVMO = loadedVMObjects[0];
        if ( repaint ) {
            let vmtNodes = [];
            collectVisibleVMTNs( topVMO, vmtNodes, 0, declViewModel );
            treeDataProvider.viewModelCollection.update( vmtNodes );
        } else {
            loadedVMObjects = [];
            collectVisibleVMTNs( topVMO,  loadedVMObjects, 0, declViewModel );
            treeDataProvider.update( loadedVMObjects );
        }
    }
};


/**
 * Function to perform collapse operation for selected task
 * @param {Object} treeNode selected tree node to collapse
 * @param {Object} treeDataProvider tree data provider
 * @param {Object} declViewModel data object
 */
export let performCollapseBelow = ( treeNode, treeDataProvider, declViewModel ) => {
    if( !treeNode ) {
        return;
    }
    let nodesInfo = getApplicableNodesInfoForCollapse( treeNode.children, treeDataProvider );
    let nodesToCollapse = nodesInfo.nodes;
    while( nodesInfo.children.length ) {
        nodesInfo = getApplicableNodesInfoForCollapse( nodesInfo.children, treeDataProvider );
        nodesToCollapse = nodesToCollapse.concat( nodesInfo.nodes );
    }

    nodesToCollapse.reverse().map( ( vmo ) => _awTableStateSvc.saveRowCollapsed( declViewModel, 'scheduleNavigationTree', vmo ) );

    delete treeNode.isExpanded;
    treeNode.isInExpandBelowMode = false;
    eventBus.publish( 'scheduleNavigationTree.plTable.toggleTreeNode', treeNode );
    delete treeNode.__expandState;
};

/**
 * Function to get nested childrens information which is to collapse
 * @param {Array} vmoNodes array of viewModelObjects
 * @param {Object} treeDataProvider data provider object.
 * @returns {Object} nodesInfo
 */
let getApplicableNodesInfoForCollapse = function( vmoNodes, treeDataProvider ) {
    let nodesInfo = {
        nodes: [],
        children: []
    };
    vmoNodes && vmoNodes.forEach( ( vmoNode ) => {
        if( _awTableStateSvc.isNodeExpanded( treeDataProvider.ttState, vmoNode ) ) {
            nodesInfo.nodes.push( vmoNode );
            if( vmoNode.children && vmoNode.children.length > 0 ) {
                nodesInfo.children = nodesInfo.children.concat( vmoNode.children );
            }
        }
    } );
    return nodesInfo;
};

/**
 * Function to get all the expanded nodes
 * @param {Object} declViewModel declViewModel
 * @returns {Array} uids of all expanded nodes
 */
export let getNodesForExpansion = function( declViewModel ) {
    var nodeStates = [];
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    var ttState = awTableStateService.getTreeTableState( declViewModel, gridId );
    if( !_.isEmpty( ttState.nodeStates ) && !_.isEmpty( ttState.structure ) ) {
        // Get the nodeStates in an array
        for( var node in ttState.nodeStates ) {
            nodeStates.push( node );
        }
    }
    return nodeStates;
};

exports = {
    performExpandBelow,
    performCollapseBelow
};

export default exports;
