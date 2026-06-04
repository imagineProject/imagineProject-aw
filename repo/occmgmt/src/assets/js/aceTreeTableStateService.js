// Copyright (c) 2022 Siemens

/**
 * Facilitates maintaining expansion state of tree table nodes.
 *
 * @module js/aceTreeTableStateService
 */

import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import awTableStateService from 'js/awTableStateService';
import uwUtilSvc from 'js/uwUtilService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

/**
 * This method loops over the loaded model objects backing the grid and returns an ordered list of expanded nodes in terms of their clone stable ID chain.
 * @param uwDataProvider The data provider of the grid/tree
 */
export let getLoadedVMOsInformation = function( viewModelCollection ) {
    let loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    let loadedVMOsInfo = {
        csidChainsOfNodes:[]
    };
    let loadVMObjectUidsMap = new Map();
    let expandedNodeUidsMap = new Map();

    _.forEach( loadedVMOs, function( loadedVMObject ) {
        loadVMObjectUidsMap.set(loadedVMObject.uid, loadedVMObject);

        if(loadedVMObject.isExpanded && !_.isEmpty( loadedVMObject.stableId )) {
            expandedNodeUidsMap.set(loadedVMObject.uid, loadedVMObject);
            loadedVMOsInfo.csidChainsOfNodes.push(loadedVMObject.stableId);
        }
    } );

    loadedVMOsInfo.loadVMObjectUidMap = loadVMObjectUidsMap;
    loadedVMOsInfo.expandedNodeUidMap = expandedNodeUidsMap;

    return loadedVMOsInfo;
};

/**
 * This method loops over the loaded model objects backing the grid and returns an ordered list of expanded nodes in terms of their clone stable ID chain.
 * @param uwDataProvider The data provider of the grid/tree
 */
export let getCSIDChainsForExpandedNodes = function( uwDataProvider ) {
    var csidChainsOfNodes = [];

    // Ideally we should determine list of expanded nodes using the localStorage but we need CSID chain of each object.
    // It is available only on the loaded objects and hence this code.
    if ( uwDataProvider && uwDataProvider.viewModelCollection ) {
        var allNodesInCache = uwDataProvider.viewModelCollection.getLoadedViewModelObjects();

        var expandedNodes = _.filter( allNodesInCache, function( node ) {
            return node.isExpanded && !_.isEmpty( node.stableId );
        } );

        csidChainsOfNodes = _.map( expandedNodes, function( expandedNode ) {
            return expandedNode.stableId;
        } );

        return csidChainsOfNodes;
    }
};

/**
 * This method builds a cache that will help restore expansion state of nodes when configuration changes.
 *
 * @param uwDataProvider The data provider of the grid/tree
 * @param declViewModel View model backing the grid/tree
 * @param pciBeforeConfigurationChange UID of the product context before configuration changes were made
 * @param pciAfterConfigurationChange UID of the product context after configuration changes were made
 * @param pciToExpandedNodesStableIdsMap A map from PCI uid to list of CSIDs (clone stable id chain) of expanded
 *            nodes which will be updated. This will act as in-memory cache of expanded nodes.
 */
export let setupCacheToRestoreExpansionStateOnConfigChange = function( uwDataProvider, declViewModel,
    pciBeforeConfigurationChange, contextState, pciToExpandedNodesStableIdsMap ) {
    var pciAfterConfigurationChange = contextState.occContext.currentState.pci_uid;
    var allNodesInCache = uwDataProvider.viewModelCollection.getLoadedViewModelObjects();
    var currentContext = contextState.context;

    // Cache information of nodes
    _cacheExpandedNodesAvailableInCacheOnConfigChange( allNodesInCache, declViewModel,
        pciBeforeConfigurationChange, pciAfterConfigurationChange, currentContext, pciToExpandedNodesStableIdsMap );

    if( pciBeforeConfigurationChange !== pciAfterConfigurationChange ) {
        // Update pci which is being used as key in the cache for maintaining expansion state.
        _copyCSIDsUnderPciBeforeConfigChangeToPciAfterConfigChange( pciBeforeConfigurationChange, pciAfterConfigurationChange,
            pciToExpandedNodesStableIdsMap );
    }
};

let _isJitterFreeExpansionSupported = function( productContextInfo ) {
    var jitterFreeExpansionSupported = true;
    var supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( productContextInfo );
    if( supportedFeatures && supportedFeatures['4GStructureFeature'] ) {
        jitterFreeExpansionSupported = false;
    }
    return jitterFreeExpansionSupported;
};

/**
 * This method will update the local storage with updated information of expanded nodes on configuration change.
 *
 * @param newlyLoadedNodes Occurrences that were loaded when changing configuration
 * @param declViewModel View model backing the grid/tree
 * @param pciAfterConfigurationChange UID of the product context after configuration change
 * @param pciToExpandedNodesStableIdsMap Map which has information mapped from the PCI uid to list of expanded nodes
 */
export let updateLocalStorageWithExpandedNodesOnConfigChange = function( newlyLoadedNodes, declViewModel,
    pciAfterConfigurationChange, pciToExpandedNodesStableIdsMap ) {
    // Get the list of csids/stableIds that represent nodes that need to be expanded
    var csidsToBeExpanded = pciToExpandedNodesStableIdsMap[ pciAfterConfigurationChange ];

    // If we have nodes that need to be expanded
    if( csidsToBeExpanded && csidsToBeExpanded.length > 0 ) {
        // Identify those nodes from the ones received in response
        var nodesToExpand = newlyLoadedNodes.filter( function( node ) {
            var idxOfCSID = csidsToBeExpanded.indexOf( node.stableId );
            if( idxOfCSID !== -1 ) {
                csidsToBeExpanded.splice( idxOfCSID, 1 );
                return true;
            }
            return false;
        } );

        /**
         * If we have loaded nodes that need to be expanded then convey the same to the table state service.
         */
        if( nodesToExpand && nodesToExpand.length > 0 ) {
            // For now we will use id of the grid that is first in the list of grids in the view model.
            // Once we get this value in treeLoadInput we will shift to using it.
            var gridId = Object.keys( declViewModel.grids )[ 0 ];
            let pciObject = cdm.getObject( pciAfterConfigurationChange );
            let isJitterFreeSupported = _isJitterFreeExpansionSupported( pciObject );

            // Update state of node in local storage so that the node is expanded during rendering
            for( var ndx = 0; ndx < nodesToExpand.length; ndx++ ) {
                if( !nodesToExpand[ ndx ].isLeaf ) {
                    if ( !isJitterFreeSupported || nodesToExpand[ndx].isExpanded ) {
                        awTableStateService.saveRowExpanded( declViewModel, gridId, nodesToExpand[ ndx ] );
                    }
                }
            }
        }
    }
};

/**
 * This method is used to expand the root nodes for products under Saved Working Context(SWC). These nodes don't
 * have a "stableId" property on them and hence their expansion state is not maintained along with others.
 *
 * @param declViewModel View model backing the grid/tree
 * @param previouslyLoadedNodes Nodes that were loaded before configuration change
 * @param pciBeforeConfigurationChange UID of the product context before configuration was changed
 * @param newlyLoadedNodes Occurrences that were loaded when changing configuration
 * @param pciAfterConfigurationChange UID of the product context after configuration change
 */
export let updateLocalStorageForProductNodesOfSWCOnConfigChange = function( declViewModel, previouslyLoadedNodes,
    pciBeforeConfigurationChange, newlyLoadedNodes, pciAfterConfigurationChange ) {
    // Find ViewModelTreeNode corresponding to the root element of the product whose configuration is being changed
    var rootNodeOfProductBeforeConfigurationChange = previouslyLoadedNodes.filter( function( vmo ) {
        if( vmo.levelNdx === 0 && vmo.pciUid === pciBeforeConfigurationChange ) {
            return true;
        }
    } );

    // If found and if it was expanded then expand the corresponding new ViewModelTreeNode
    if( rootNodeOfProductBeforeConfigurationChange.length === 1 &&
        rootNodeOfProductBeforeConfigurationChange[ 0 ].isExpanded ) {
        var rootNodeOfProductAfterConfigurationChange = newlyLoadedNodes.filter( function( vmo ) {
            if( vmo.levelNdx === 0 && vmo.pciUid === pciAfterConfigurationChange ) {
                return true;
            }
        } );

        if( rootNodeOfProductAfterConfigurationChange.length === 1 ) {
            // For now we will use id of the grid that is first in the list of grids in the view model.
            // Once we get this value in treeLoadInput we will shift to using it.
            var gridId = Object.keys( declViewModel.grids )[ 0 ];
            awTableStateService.saveRowExpanded( declViewModel, gridId,
                rootNodeOfProductAfterConfigurationChange[ 0 ] );

            // Remove entry for old node only if the id has changed else the entry that you added above is removed
            _removeNodeFromNodeStates( rootNodeOfProductBeforeConfigurationChange[ 0 ], declViewModel );
        }
    }
};

/**
 * Update the local cache to use new pci on configuration change
 */
function _copyCSIDsUnderPciBeforeConfigChangeToPciAfterConfigChange( pciBeforeConfigurationChange, pciAfterConfigurationChange,
    pciToExpandedNodesStableIdsMap ) {
    if( pciToExpandedNodesStableIdsMap[ pciBeforeConfigurationChange ] ) {
        // Make a copy of array against old pci_uid
        var copyOfCSIDs = _.cloneDeep( pciToExpandedNodesStableIdsMap[ pciBeforeConfigurationChange ] );

        // Store it in the map against the new pci_uid
        pciToExpandedNodesStableIdsMap[ pciAfterConfigurationChange ] = copyOfCSIDs;

        // Delete the entry for old pci_uid
        delete pciToExpandedNodesStableIdsMap[ pciBeforeConfigurationChange ];
    }
}

/**
 * This method will cache the identifiers of nodes which are expanded and currently available in cache.
 *
 * @param allNodesInCache All nodes that are available in cache(view model collection)
 */
function _cacheExpandedNodesAvailableInCacheOnConfigChange( allNodesInCache, declViewModel,
    pciBeforeConfigurationChange, pciAfterConfigurationChange, currentContext, pciToExpandedNodesStableIdsMap ) {
    // List of nodes which are in cache and are in expanded state and have a non-empty "stableId"
    var expandedNodesInCache = allNodesInCache.filter( function( node ) {
        return node.isExpanded === true && !_.isEmpty( node.stableId );
    } );

    // Cache information of all nodes that are in cache and are expanded
    expandedNodesInCache.forEach( function( expandedNode ) {
        var pci = occmgmtUtils.getProductContextForProvidedObject( expandedNode, currentContext );

        /**
         * For the product whose configuration is changing we first store the expanded node information (csid)
         * against the old pci uid and then update the pci uid to the new one. This is to take care of any nodes
         * that may be already there in the cache but were not loaded during configuration change.
         */
        if( pciAfterConfigurationChange === pci || pciBeforeConfigurationChange === pci ) {
            // Add stableId of the node to the cache
            _cacheIdentifierOfExpandedNode( expandedNode.stableId, pciBeforeConfigurationChange,
                pciToExpandedNodesStableIdsMap );
            // Remove the information for this node from local storage else it will appear expanded
            // when user goes back to the current configuration. We don't want that to happen blindly as
            // user may have collapsed it when under a different configuration.
            _removeNodeFromNodeStates( expandedNode, declViewModel );
        } else {
            _cacheIdentifierOfExpandedNode( expandedNode.stableId, pci, pciToExpandedNodesStableIdsMap );
        }
    } );
}

/**
 * Method used for maintaining expansion state. It adds a node identified for expansion to the local cache.
 *
 * @param identifierOfExpandedNode String that can be used to identify the tree node.
 * @param pci PCI uid of the node
 */
function _cacheIdentifierOfExpandedNode( identifierOfExpandedNode, pci, pciToExpandedNodesStableIdsMap ) {
    if( !pciToExpandedNodesStableIdsMap[ pci ] ) {
        pciToExpandedNodesStableIdsMap[ pci ] = [];
    }

    if( pciToExpandedNodesStableIdsMap[ pci ].indexOf( identifierOfExpandedNode ) === -1 ) {
        pciToExpandedNodesStableIdsMap[ pci ].push( identifierOfExpandedNode );
    }
}

/**
 * Remove from local storage entry corresponding to the information sent in.
 *
 * @param node This parameter can either be the node that is to be removed from local storage or it can be just the
 *            id of the node
 * @param declViewModel The declarative view model backing this tree
 */
function _removeNodeFromNodeStates( node, declViewModel ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    awTableStateService.saveRowCollapsed( declViewModel, gridId, node );
}

/**
 * Add local storage entry corresponding to the information sent in.
 *
 * @param node This parameter can either be the node that is to be added to local storage or it can be just the id
 *            of the node
 * @param declViewModel The declarative view model backing this tree
 */
export let addNodeToExpansionState = function( node, declViewModel ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    awTableStateService.saveRowExpanded( declViewModel, gridId, node );
};

export let addNodeToCollapsedState = function( data, row ) {
    var gridId = Object.keys( data.grids )[ 0 ];
    awTableStateService.saveRowCollapsed( data, gridId, row );
    delete row.isExpanded;
    row.isLeaf = true;
    eventBus.publish( gridId + '.plTable.toggleTreeNode', row );
};

let _clearNodeState = function( declViewModel, gridId, targetNode ) {
    var declGrid = declViewModel._internal.grids[ gridId ];
    var uwDataProvider = declViewModel.dataProviders[ declGrid.dataProvider ];
    if( uwDataProvider.ttState && awTableStateService.isNodeExpanded( uwDataProvider.ttState, targetNode ) ) {
        delete uwDataProvider.ttState.nodeStates[ uwUtilSvc.getEvaluatedId( targetNode ) ];
    }
};

let _isVmoEntryPresentInTTState = function( declViewModel, gridId, vmo ) {
    let isEntryIsPresent = false;
    var declGrid = declViewModel._internal.grids[ gridId ];
    var uwDataProvider = declViewModel.dataProviders[ declGrid.dataProvider ];
    let vmoPath = vmo.alternateID;
    if( uwDataProvider.ttState && uwDataProvider.ttState.nodeStates[vmoPath] ) {
        var nodeStructure = uwDataProvider.ttState.structure[uwDataProvider.topNodeUid];
        if( nodeStructure ) {
            let alternateIdString = vmoPath.split( ':' );
            let tempStr = alternateIdString[0];
            for( let inx = 1; inx < alternateIdString.length; inx++ ) {
                tempStr = tempStr.concat( ':', alternateIdString[inx] );
                nodeStructure = nodeStructure[tempStr];
                if( nodeStructure === undefined ) {
                    break;
                }
            }
            if( nodeStructure !== undefined ) {
                isEntryIsPresent = true;
            }
        }
    }

    return isEntryIsPresent;
};

export let updateTreeNodeStates = function( vmNodes, declViewModel, subPanelContext ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[ 0 ];

    //When reset is in progress, don't process this logic..
    //call comes here from modifiedObjects case for filter and that has unconfigured children count.

    if( _.isUndefined( subPanelContext.occContext.pwaReset ) ) {
        _.forEach( vmNodes, function( vmo ) {
            if( vmo.isExpanded && !_isVmoEntryPresentInTTState( declViewModel, gridId, vmo ) ) {
                _clearNodeState( declViewModel, gridId, vmo );
                awTableStateService.saveRowExpanded( declViewModel, gridId, vmo );
            }
        } );
        if( subPanelContext.occContext.transientRequestPref && subPanelContext.occContext.transientRequestPref.nodesToMarkCollapsed ) {
            let nodesToMarkCollapsed = subPanelContext.occContext.transientRequestPref.nodesToMarkCollapsed;
            _.forEach( nodesToMarkCollapsed, function( nodeToMarkCollapse ) {
                awTableStateService.saveRowCollapsed( declViewModel, gridId, nodeToMarkCollapse );
            } );

            let value = {
                nodesToMarkCollapsed: []
            };
            occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, subPanelContext.occContext );
        }
    }
    if( subPanelContext.occContext.lastDpAction === 'focusActionForSelectionFromVis' ) {
        triggerScrollEventForPackMaster( gridId );
    }
    //calculate visibility toggle calculation once tree nodes are updated.
    //For cases where getOcc & getTVMP get called back to back, this is needed
    aceTreeTableDataService.setOccVisibility( vmNodes, subPanelContext.occContext.viewKey, gridId, subPanelContext.occContext );
};

/**
 *Function to trigger the scroll event for the packmaster node once it is loaded
 * @param {gridId} gridId GridId

 */
let triggerScrollEventForPackMaster = function( gridId ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey ); //$NON-NLS-1$
    if( context.acePartialSelection && context.acePartialSelection.partialSelectionInfo ) {
        var visibleUid = context.acePartialSelection.partialSelectionInfo.get( context.acePartialSelection.hiddenNode );
        //Node selected from Vis (non pack master) and node shown in tree (pack master)are not same then only trigger the scroll event
        if( visibleUid !== undefined && visibleUid !== context.acePartialSelection.hiddenNode ) {
            let eventData = {};
            eventData.rowUids = [ visibleUid ];
            eventData.gridId = gridId;
            eventBus.publish( 'plTable.scrollToRow', eventData );
        }
    }
};

export default exports = {
    getCSIDChainsForExpandedNodes,
    getLoadedVMOsInformation,
    setupCacheToRestoreExpansionStateOnConfigChange,
    updateLocalStorageWithExpandedNodesOnConfigChange,
    updateLocalStorageForProductNodesOfSWCOnConfigChange,
    addNodeToExpansionState,
    addNodeToCollapsedState,
    updateTreeNodeStates
};
