// Copyright (c) 2024 Siemens

/**
 * @module js/pca0VariabilityExplorerExpandService
 */
import actionService from 'js/actionService';
import appCtxService from 'js/appCtxService';
import awTableStateService from 'js/awTableStateService';
import declUtils from 'js/declUtils';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import uwUtilSvc from 'js/uwUtilService';
import _ from 'lodash';

/**
 * Function to returns the children of selected node which needs to be removed
 * @param {Object} treeDataProvider - treeDataProvider
 * @param {Object} selectedNode - selected node from a tree
 * @return {Array} list of all level childrens of selected node
 */

let _getNodesToBeRemoved = ( treeDataProvider, selectedNode ) => {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let inlineRowObjectIndex = viewModelCollection.findViewModelObjectById( selectedNode.uid );
    let nodeBeingExpanded = viewModelCollection.getViewModelObject( inlineRowObjectIndex );

    let loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();

    let nodesToBeRemoved = [];
    if( nodeBeingExpanded && nodeBeingExpanded.children && nodeBeingExpanded.children.length > 0 ) {
        return nodesToBeRemoved = _getAllNestedChildrens( loadedVMObjects, nodeBeingExpanded.uid );
    }
    return nodesToBeRemoved;
};

/**
 * Recursive function to returns the children of selected node
 * @param {Array} loadedVMObjects - all loaded VMO objects from tree
 * @param {String} parentUID - uid of parentnode of which childrens to return
 * @return {Array} list first level childrens of parent node
 */
let _getAllNestedChildrens = ( loadedVMObjects, parentUID ) => {
    let nodesToBeRemoved = [];
    loadedVMObjects.forEach( vmo => {
        if ( vmo.parentUID === parentUID ) {
            const parent = loadedVMObjects.find( item => item.uid === vmo.parentUID );
            if ( parent ) {
                parent.children = parent.children.filter( children => children.uid !== vmo.uid );
            }
            nodesToBeRemoved.push( vmo );
            nodesToBeRemoved = nodesToBeRemoved.concat( _getAllNestedChildrens( loadedVMObjects, vmo.uid ) );
        }
    } );
    return nodesToBeRemoved;
};

/**
 * Add entry of nodes in local storage as expanded, it will ensure to remember its expanded state on refresh
 * @param {Object} declViewModel ViewModel data
 * @param {Array} nodes nodes that are to be added to local storage as a expanded
 * @param {Number} firstChildIndex first child index of selected node to be expand
 * @param {Number} lastChildIndex last child index of selected node to be expand
 * @param {String} gridId name of the tree in the viewmodel
 */
let _addNodesToExpansionState = ( declViewModel, nodes, firstChildIndex, lastChildIndex, gridId ) => {
    // iterate through only children of expanded node
    for ( let i = firstChildIndex; i <= lastChildIndex; i++ ) {
        // if children node has expanded state true then add its entry to local storage as a expanded
        if( nodes[i] && nodes[i].isExpanded ) {
            awTableStateService.saveRowExpanded( declViewModel, gridId, nodes[i] );
        }
    }
};

/**
 * Function to collapse nested children of expanded node
 * @param {Array} vmoNodes array of viewModelObjects
 * @param {Object} treeDataProvider data provider object.
 */
let _processApplicableNodesForCollapse = ( vmoNodes, treeDataProvider ) => {
    let vmos  = vmoNodes ? [ ...vmoNodes ] : [];
    while( vmos.length ) {
        let vmo = vmos.pop();
        if( treeDataProvider.ttState && awTableStateService.isNodeExpanded( treeDataProvider.ttState, vmo ) ) {
            // Expanded state will be deleted with this change, earlier awTableStateService.saveRowCollapsed api has been used
            // performance was degrading with this API so we directly manipulating cache data which is used to maintain expanded state of node
            delete treeDataProvider.ttState.nodeStates[ uwUtilSvc.getEvaluatedId( vmo ) ];
            // Add children to the stack if they exist
            if ( vmo.children && vmo.children.length > 0 ) {
                vmos.push( ...vmo.children );
            }
        }
    }
};

/**
 * Helps to update node properties after its creation
 * @param {Array} presentSelections - Array of alternateIDs of user made selections in features and models tab in pick and choose panel
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} gridEditorSelections - Array of selections present in grid editor that we have to reflect in Pick and choose panel
 */
let _updateNodePropertiesAfterCreation = ( presentSelections, treeNodes, gridEditorSelections ) => {
    // This is needed for Pick and choose panel to select the Group/Family/Features
    const selectionSet = new Set( presentSelections );
    treeNodes.forEach( node => {
        // updates the selection of nodes which are preselected before expand operation
        // in case of Pick and choose panel in constraints tab
        if( gridEditorSelections && !_.isEmpty( gridEditorSelections ) && node.isLeaf ) {
            _.find( gridEditorSelections, gridEditorData => {
                if( node.alternateID.includes( gridEditorData ) ) {
                    node.isPreselected = true;
                    return true;
                }
            } );
        }
        const isSelected = selectionSet.size > 0 && ( selectionSet.has( node.alternateID ) || selectionSet.has( node.ID ) );
        // updates the selection of nodes which are selected before expand operation in case of Pick and choose panel
        if( isSelected ) {
            node.selected = true;
        }
        // update the isLeaf property to true if tree node does not have any childrens
        if( !node.children?.length ) {
            node.isLeaf = true;
        }
    } );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Launch action to populate splm grid data provider
 * @param {Object} viewModel - ViewModel data
 * @param {String} viewModelAction - ViewModel Action Name for performing SOA call
 * @param {Object} treeDataProvider - treeDataProvider
 * @param {String} gridId name of the tree in the viewmodel
 * @param {Object} selectedNode selected node
 * @returns {Object} TreeLoadResult and updated view model data/atomic data to dispatch
 */
export let loadTreeProviderDataForExpand = ( viewModel, viewModelAction, treeDataProvider, gridId, selectedNode ) => {
    // Clone current status for VM data and fields (atomic data)
    let variabilityPropsFromAtomicData = viewModel.atomicDataRef.variabilityProps.getAtomicData();
    let variabilityProps = { ...variabilityPropsFromAtomicData };

    let nodeBeingExpanded;
    // if selected node is of type group remove its all children entries so that it will not duplicated
    if( !_.isNil( selectedNode ) && _.get( selectedNode, 'modelType.typeHierarchyArray', [] ).includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP ) ||  selectedNode.type && selectedNode.type === '__Fsc_Unassigned_Group__' ) {
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        let inlineRowObjectIndex = viewModelCollection.findViewModelObjectById( selectedNode.uid );
        nodeBeingExpanded = viewModelCollection.getViewModelObject( inlineRowObjectIndex );
        awTableStateService.saveRowExpanded( viewModel, gridId, nodeBeingExpanded );
        let nodesToBeRemoved = _getNodesToBeRemoved( treeDataProvider, selectedNode );
        delete nodeBeingExpanded.children;
        delete nodeBeingExpanded.childrenUids;
        if( nodesToBeRemoved && nodesToBeRemoved.length > 0 ) {
            viewModelCollection.removeLoadedObjects( nodesToBeRemoved );
        }
        nodeBeingExpanded.isExpanded = true;
        let loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
        treeDataProvider.topTreeNode.children = [ ...loadedVMObjects ];
    }else {
        nodeBeingExpanded =  {
            treeLevel:-1,
            childNdx: 0,
            displayName: 'top',
            iconURL: null,
            id: 'variabilityTreeData',
            levelNdx: -1,
            svgString: undefined,
            type: 'unknown',
            uid: 'variabilityTreeData',
            visible: true
        };
    }

    if ( nodeBeingExpanded.uid === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) {
        nodeBeingExpanded.props = {
            tempKey: {}
        };
    }

    if( nodeBeingExpanded.uid === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY || !nodeBeingExpanded.hasOwnProperty( 'childrenUids' ) && !nodeBeingExpanded.isFreeForm ) {
        // Make Server call
        let evaluationCtx = {
            data: viewModel,
            ctx: appCtxService.ctx
        };
        let svrAction = viewModel.getAction( viewModelAction );
        if( svrAction.deps ) {
            return declUtils.loadDependentModule( svrAction.deps ).then(
                function( debModuleObj ) {
                    return actionService.executeAction( viewModel, svrAction, evaluationCtx, debModuleObj ).then( function( actionResult ) {
                        let soaResponse;
                        // Update Load params array with soaResponse
                        soaResponse = actionResult;
                        variabilityProps.soaResponse = soaResponse;
                        // Process Partial Errors
                        let partialErrors = _.get( soaResponse, 'ServiceData.partialErrors' );
                        if( partialErrors ) {
                            pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
                            return;
                        }

                        // Update Load params array with static configuration data
                        if( !_.isUndefined( variabilityProps.resetColumnProperties ) ) {
                            variabilityProps.soaResponse.resetColumnProperties = variabilityProps.resetColumnProperties;
                        }

                        // Load tree result according to config parameters specific for each variability tree service
                        let treeLoadResult = exports.getTreeLoadResult( nodeBeingExpanded, variabilityProps, treeDataProvider, viewModel.gridEditorSelections );

                        let viewModelCollection = treeDataProvider.getViewModelCollection();
                        let vmos = viewModelCollection.getLoadedViewModelObjects();
                        let updatedVMOs = [ ...vmos ];
                        let selectedRowObject = treeLoadResult.parentNode;
                        let selectedRowObjectIndex = viewModelCollection.findViewModelObjectById( selectedRowObject.uid );
                        if ( treeLoadResult && treeLoadResult.parentNode && ( treeLoadResult.parentNode.type === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID
                        || _.get( treeLoadResult.parentNode, 'modelType.typeHierarchyArray', [] ).includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP ) ) ) {
                            let nodeBeingExpanded = viewModelCollection.getViewModelObject( selectedRowObjectIndex );
                            nodeBeingExpanded.children = treeLoadResult.childNodes;
                            if( treeLoadResult.childNodes && treeLoadResult.childNodes.length > 0 ) {
                                updatedVMOs.splice( selectedRowObjectIndex + 1, 0, ...treeLoadResult.childNodes );
                            }
                            treeDataProvider.update( updatedVMOs );
                        } else {
                            treeDataProvider.update( treeLoadResult.childNodes );
                        }
                        if( treeLoadResult.childNodes && treeLoadResult.childNodes.length > 0 ) {
                            // VMOs contains all objects which is visible in a tree along with newly created childrens of expanded nodes. We only need to add expanded entry
                            // to newly created childrens node. That's why instead of iterating over all nodes, We are just focussing on children nodes which needs to be expand
                            // This will ensure after refresh, all newly expanded childrens will persist their expanded state.
                            _addNodesToExpansionState( viewModel, viewModelCollection.getLoadedViewModelObjects(), selectedRowObjectIndex + 1,
                                selectedRowObjectIndex + treeLoadResult.childNodes.length, gridId );
                        }
                    } );
                } );
        }
    }
};

/**
 * Get Tree Load result to populate tree data provider
 * @param {ViewModelTreeNode} nodeBeingExpanded - View Model Tree Node being expanded
 * @param {Object} variabilityProps - View Model Atomic Data
 * @param {UwDataProvider} treeDataProvider - Tree Data Provider
 * @param {Array} gridEditorSelections - Array of selections present in grid editor that we have to reflect in Pick and choose panel
 * @returns {Object} - The Tree Load Result
 */
export let getTreeLoadResult = ( nodeBeingExpanded, variabilityProps, treeDataProvider, gridEditorSelections ) => {
    let contextKey;
    let parentNode = nodeBeingExpanded;
    let soaResponse = variabilityProps.soaResponse;
    let treeNodes = [];
    let presentSelections = gridEditorSelections ? treeDataProvider.selectionModel.getSelection() : [];
    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    let inputNode = _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } );
    let variantTreeData = soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes ?
        soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes : soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ];
    let rootElement = nodeBeingExpanded.uid === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ?  variantTreeData.filter( treeNode => treeNode.nodeUid === '' ) :  variantTreeData.filter( treeNode => treeNode.nodeUid === inputNode.nodeUid );
    parentNode = rootElement[ 0 ];

    // correct alternateID gets generated for its children with this check and this alternateID used to stored in local storage as a entry of expanded state
    // so if alternateID get mismatch after refresh nodes will not get expand which has entry in local storage
    if( parentNode.uid !== pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) {
        parentNode.alternateID = nodeBeingExpanded.alternateID;
    }
    // recursive tree load operation starting from Root Node
    pca0VariabilityTreeDisplayService.recursiveCreateTreeNode( contextKey, parentNode, nodeBeingExpanded.levelNdx + 1, treeNodes, [], soaResponse, variabilityProps.businessObjectToSelectionMap,
        variabilityProps.backupOfBusinessObjectToSelectionMap );
    // updates the child nodes properties after its creation
    _updateNodePropertiesAfterCreation( presentSelections, treeNodes, gridEditorSelections );
    return {
        parentNode: nodeBeingExpanded,
        childNodes: treeNodes
    };
};

/**
 * Function to perform expand operation for selected node which includes nested childrens
 * @param {Object} selectedNode selected node
 * @param {Object} treeDataProvider tree data provider
 * @returns {Object} - The selected node information
 */
export let performExpandBelow = ( selectedNode, treeDataProvider ) => {
    let eventData = {
        selectedObject: selectedNode
    };
    // if selected tree node is of type family then framework event used which expand one level tree structure
    if ( selectedNode && selectedNode.type !== pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID
        && selectedNode.isFamily ) {
        eventBus.publish( treeDataProvider.name + '.expandTreeNode', {
            parentNode: selectedNode
        } );
    } else if ( treeDataProvider.name === 'variabilityPickerTreeDataProvider' ) {
        // if selected tree node is of type context, group or unassigend group
        // selected object is from variability picker panel
        eventBus.publish( 'Pca0VariabilityPicker.loadVariabilityDataFromServer', eventData );
    } else {
        // if selected tree node is of type context, group or unassigend group
        eventBus.publish( 'Pca0VariabilityExplorerTree.loadVariabilityDataFromServer', eventData );
    }
    return selectedNode;
};

/**
 * Function to perform collapse operation for selected node which includes nested childrens
 * @param {Object} declViewModel ViewModel data
 * @param {String} gridId name of the tree in the viewmodel
 * @param {Object} selectedNode selected node
 * @param {Object} treeDataProvider tree data provider
 */
export let performCollapseBelow = async( declViewModel, gridId, selectedNode, treeDataProvider ) => {
    const dataObj = {
        data: { ...declViewModel },
        ctx: appCtxService.ctx
    };
    const typesToCheckRootNode = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM,
        pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY
    ];
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let inlineRowObjectIndex = selectedNode ? viewModelCollection.findViewModelObjectById( selectedNode.uid ) : 0;
    let nodeBeingCollapsed = viewModelCollection.getViewModelObject( inlineRowObjectIndex );
    // this check requires because in case of product context or dictionary type of object,server call not made while expanding node through
    // "Show Children" chevron command, after removing childrenUids server call get possible to render the child nodes
    if ( _.intersection( _.get( nodeBeingCollapsed, 'modelType.typeHierarchyArray', [] ), typesToCheckRootNode ).length > 0 ) {
        delete nodeBeingCollapsed.childrenUids;
    }
    // To collapse hierarchy of VMO nodes recursively
    _processApplicableNodesForCollapse( nodeBeingCollapsed.children, treeDataProvider );
    nodeBeingCollapsed.isExpanded = false;
    const updatedViewModelCollection = await treeDataProvider.collapseObject( dataObj, nodeBeingCollapsed );
    treeDataProvider.update( updatedViewModelCollection.loadedVMObjects );
    // This will store collapsed state for node to be collpased
    awTableStateService.saveRowCollapsed( declViewModel, gridId, nodeBeingCollapsed );
    // "Family" type of object always have one level of children. So instead of using our own
    // logic we have used client framework event which behave simillarly when user expand the node using  "Show Children" chevron command.
    // So in case of family node, If structure is already expanded and user again collapse
    // and expand it then in that case server call can be avoided with this check. It will use client cache data which is stored in "_expandState" property of a node to expand all its children.
    // Same logic will not be applied for other types of object as there might be possiblity that
    // thier children may exist upto more than one level. So client framework event is not valid there.Therefore that check is only valid for "Family" type of object.
    if( !nodeBeingCollapsed.isFamily ) {
        delete nodeBeingCollapsed.__expandState;
    }
};

export default exports = {
    loadTreeProviderDataForExpand,
    getTreeLoadResult,
    performExpandBelow,
    performCollapseBelow
};
