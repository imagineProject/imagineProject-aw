// Copyright (c) 2022 Siemens

/**
 * @module js/aceTreeTableDataService
 */
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import awStateService from 'js/awStateService';
import awColumnSvc from 'js/awColumnService';
import cdmSvc from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import occmgmtGetSvc from 'js/aceGetService';
import occmgmtUtils from 'js/occmgmtUtils';
import appCtxSvc from 'js/appCtxService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import structureFilterService from 'js/structureFilterService';
import aceTreeTableStateService from 'js/aceTreeTableStateService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import aceTreeTableBufferService from 'js/aceTreeTableBufferService';
import occmgmtVisibilityService from 'js/aceVisibilityService';
import occmgmtIconSvc from 'js/aceIconService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import aceCellRenderingService from 'js/aceCellRenderingService';
import aceTreeTableExtService from 'js/aceTreeTableExtService';
import aceEditHandlerExtService from 'js/aceEditHandlerExtService';
import awTableStateService from 'js/awTableStateService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import treeTableDataService from 'js/treeTableDataService';
import assert from 'assert';
import _ from 'lodash';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import acePartialSelectionService from 'js/acePartialSelectionService';
import expandRequests from 'js/invoker/expandRequests';
import requestQueue from 'js/invoker/requestQueue';
import splmTablePublishedService from 'js/splmTablePublishedService';
import aceUrlManagementService from 'js/aceUrlManagementService';

var _firstColumnConfigColumnPropertyName = null;

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * {Boolean} TRUE if certain properties and/or events should be logged during occurrence loading.
 */
var _debug_logOccLoadActivity = false;

/**
 * Map from pci uid to "stableId" of nodes that are in expanded state
 */
var _pciToExpandedNodesStableIdsMap = {};

var _expandedNodes = {};

let OverriddenPropertyPolicyHandlers = {};

var updateExpansionState = function( treeLoadResult, declViewModel, contextState ) {
    if( appCtxSvc.ctx[ contextState.key ].resetTreeExpansionState || !_.isUndefined( treeLoadResult.retainTreeExpansionStatesForOpen ) &&
        treeLoadResult.retainTreeExpansionStatesForOpen === false ) {
        awTableStateService.clearAllStates( declViewModel, _.keys( declViewModel.grids )[ 0 ] );
        appCtxSvc.unRegisterCtx( contextState.key + '.resetTreeExpansionState' );
        _pciToExpandedNodesStableIdsMap[ contextState.key ] = {};
    }

    _expandedNodes[ contextState.key ] = _expandedNodes[ contextState.key ] || _.cloneDeep( _expandedNodes.nodes ) || [];
    if( _expandedNodes[ contextState.key ] && _expandedNodes[ contextState.key ].length > 0 ) {
        _expandedNodes[ contextState.key ].map( function( uid ) {
            var gridId = Object.keys( declViewModel.grids )[ 0 ];
            awTableStateService.saveRowExpanded( declViewModel, gridId, uid );
        } );
        treeLoadResult.retainTreeExpansionStates = true;
        _expandedNodes[ contextState.key ] = [];
    }
};

function getChildNodes( propertyLoadInput ) {
    let allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props || !_.size( childNode.props ) ) {
                childNode.props = {}; {
                    allChildNodes.push( childNode );
                }
            }
            if ( childNode?.fetchRemainingProps ) {
                allChildNodes.push( childNode );
            }
        } );
    } );
    return allChildNodes;
}

function _sortTreeNodesBasedOnParentChildHierarchy( treeNodes ) {
    const nodeMap = new Map();
    for( const node of treeNodes ) {
        nodeMap.set( node.uid, { node, children: [] } );
    }

    const rootNodes = [];

    // get all childrens in the treeNodes and put it against nodes children vector.
    for( const node of treeNodes ) {
        if( node.parentUid && nodeMap.has( node.parentUid ) ) {
            const parentNode = nodeMap.get( node.parentUid );
            parentNode.children.push( node );
        } else {
            //If its a top level child then add it in rootNodes vector.
            rootNodes.push( node );
        }
    }
    const result = [];
    //Till here we collect all the nodes in a map and rootNodes.
    function traverse( nodeInfo ) {
        result.push( nodeInfo.node );
        for( const child of nodeInfo.children ) {
            traverse( nodeMap.get( child.uid ) );
        }
    }

    for( const rootNode of rootNodes ) {
        traverse( nodeMap.get( rootNode.uid ) );
    }

    return result;
}

// Loads tree node page with properties
// 1. Identify all the tree nodes
// 2. sort the tree nodes in flat tree structure
// 3. get the loaded page nodes
// 4. load tree properties for loaded page nodes.
function loadTreeNodePageWithProperties( newlyLoadedNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, declViewModel, contextState, provider ) {
    // identify tree nodes that will be rendered on tree.
    var treeNodes = !_.isUndefined( newlyLoadedNodes ) ? newlyLoadedNodes : treeLoadResult.childNodes;

    // sort the newly added nodes in the order they are going to render in tree.
    let sortedTreeNodes = _sortTreeNodesBasedOnParentChildHierarchy( treeNodes );

    //TODO : contextState is used for selectedModelObjects. Should be taken from occContext now ( cleanup candidate)

    var nodesForPropertyLoadPage = sortedTreeNodes;

    if( nodesForPropertyLoadPage.length > aceTreeTableBufferService.getInitialPropertyLoadPageSize() ) {
        nodesForPropertyLoadPage = nodesForPropertyLoadPage.slice( 0, aceTreeTableBufferService.getInitialPropertyLoadPageSize() );
    }

    // load properties for page of tree nodes.
    var contextKey = contextState.key;
    var columnInfos = [];
    _.forEach( uwDataProvider.cols, function( columnInfo ) {
        if( !columnInfo.isTreeNavigation ) {
            columnInfos.push( columnInfo );
        }
    } );

    let clientScopeURI = treeLoadResult.productContextInfo.props.awb0ClientScopeUri ? treeLoadResult.productContextInfo.props.awb0ClientScopeUri.dbValues[ 0 ] : provider.clientScopeURI;

    clientScopeURI = uwDataProvider.objectSetUri ? uwDataProvider.objectSetUri : clientScopeURI;

    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: clientScopeURI,
        typesForArrange: uwDataProvider.columnConfig.typesForArrange
    };

    var propertyLoadRequest = {
        parentNode: null,
        childNodes: nodesForPropertyLoadPage,
        columnInfos: columnInfos
    };
    var propertyLoadInput = awTableTreeSvc.createPropertyLoadInput( [ propertyLoadRequest ] );

    return exports.loadTreeTableProperties( {
        propertyLoadInput: propertyLoadInput,
        contextKey: contextKey,
        declViewModel: declViewModel,
        uwDataProvider: uwDataProvider,
        propertyLoadContext: propertyLoadContext,
        skipExtraBuffer: true,
        subPanelContext: {
            occContext: contextState.occContext
        }
    } ).then(
        function( response ) {
            treeLoadResult.columnConfig = response.propertyLoadResult.columnConfig;
            appCtxSvc.updateCtx( 'searchResponseInfo.columnConfig', treeLoadResult.columnConfig );
            return {
                treeLoadResult: treeLoadResult
            };
        } );
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {Object} soaInput - Parameters to be sent to the 'pocc6' SOA call.
 * @param {*} uwDataProvider - Data Provider
 * @param {*} declViewModel - Decl ViewModel
 * @param {*} contextState - Context State
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext ) {
    var parentNode = treeLoadInput.parentNode;
    var sytemLocatorParams = appCtxSvc.getCtx( 'systemLocator' );
    if( sytemLocatorParams && sytemLocatorParams.isFocusedLoad !== undefined ) {
        treeLoadInput.isFocusedLoad = sytemLocatorParams.isFocusedLoad;
    }

    /**
     * If 'parent' has no 'child' nodes yet, there is no cursor that should be needed, or used.
     */
    if( _.isEmpty( parentNode.children ) ) {
        parentNode.cursorObject = null;
    }

    /**
     * If input has a known 'pci_uid', locate the IModelObject and set it in the inputData.
     *
     */
    if( treeLoadInput.pci_uid ) {
        soaInput.inputData.config.productContext = occmgmtUtils.getObject( treeLoadInput.pci_uid );
    }

    treeLoadInput.displayMode = 'Tree';

    /**
     * If a node other than the active product is being expanded then we must fetch and use filter parameters
     * from the cache
     */
    if( treeLoadInput.pci_uid && treeLoadInput.pci_uid !== contextState.occContext.currentState.pci_uid ) {
        treeLoadInput.filterString = updateFilterParamsOnInputForCurrentPciUid( treeLoadInput.pci_uid,
            contextState );
    }

    /**
     * Record if request is about jitter free tree load
     */
    if( !_.isUndefined( contextState.context.transientRequestPref ) &&
        _.isEqual( contextState.context.transientRequestPref.jitterFreePropLoad, true ) ) {
        treeLoadInput.jitterFreePropLoad = true;
    }

    // get the hierarchy of focus object
    // if we get delta tree response, then we have to decide focus occurrence based on
    // this hierarchy of focus objects.
    var focusObjectHierarchy = [];
    var selectedObjects = contextState.occContext.pwaSelection;
    if( !_.isUndefined( selectedObjects ) && !_.isEmpty( selectedObjects ) ) {
        var focusObject = selectedObjects[ selectedObjects.length - 1 ];
        while( !_.isUndefined( focusObject ) && focusObject !== null ) {
            focusObjectHierarchy.push( focusObject );
            var parentFocusObject;
            if( focusObject.props && focusObject.props.awb0Parent ) {
                var parentFocusId = focusObject.props.awb0Parent.dbValues[ 0 ];
                parentFocusObject = cdmSvc.getObject( parentFocusId );
            }
            focusObject = parentFocusObject;
        }
    }
    treeLoadInput.focusObjectHierarchy = focusObjectHierarchy;

    let transientRequestPref = contextState.occContext.transientRequestPref;
    if( transientRequestPref && transientRequestPref.getOccResponse ) {
        return _getTreeLoadResultBuiltFromGetOccResponse( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, transientRequestPref.getOccResponse, subPanelContext );
    }

    //TODO: To be passed in to getOccurrences() when CFX changes go in
    //let occContextValue = subPanelContext.occContext.getValue();
    return occmgmtGetSvc.getOccurrences( treeLoadInput, soaInput, contextState ).then(
        function( response ) {
            return _getTreeLoadResultBuiltFromGetOccResponse( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, response, subPanelContext );
        } );
} // _loadTreeTableNodes

let _getTreeLoadResultBuiltFromGetOccResponse = function( treeLoadInput, soaInput, contextState, declViewModel, uwDataProvider, response, subPanelContext ) {
    if( !declViewModel.isDestroyed() ) {
        const pciBeforeConfigurationChange = contextState.occContext.currentState.pci_uid;
        const occContext = contextState.occContext;
        let isJitterFreePropLoad = _.isEqual( occContext.transientRequestPref.jitterFreePropLoad, true );

        // Fix for LCS-815304
        let isResetActionInProgress = !_.isEmpty( contextState.occContext.transientRequestPref ) && _.isEqual( contextState.occContext.transientRequestPref.savedSessionMode, 'reset' );
        if( isResetActionInProgress ) {
            eventBus.publish( treeLoadInput.grid.dataProvider + '.resetScroll' );
        }

        let treeLoadResult = aceTreeLoadResultBuilderService.processGetOccurrencesResponse( treeLoadInput, response, contextState,
            declViewModel, uwDataProvider, soaInput, subPanelContext.occContext, subPanelContext.pageContext );
        var localDataProvider = declViewModel.dataProviders[ declViewModel._internal.grids[ Object.keys( declViewModel._internal.grids )[ 0 ] ].dataProvider ];

        if( localDataProvider && treeLoadResult && treeLoadResult.newTopNode && localDataProvider.topTreeNode !== treeLoadResult.newTopNode.uid ) {
            localDataProvider.topNodeUid = treeLoadResult.newTopNode.uid;
            localDataProvider.topTreeNode = treeLoadResult.newTopNode;
        }

        updateExpansionState( treeLoadResult, declViewModel, contextState );
        /**
         * Expansion state updated through above method make updates on dataProvider
         * and actual update in local storage is made after debounce of 2000ms
         * Because of that while tree is loading it reads data from dataProvider and it doesnt get updated data if we dont update dataProvider through disptach
         * We need to update dataProvider properly that is with disptach.
         */
        treeLoadResult.ttstate = localDataProvider.ttState;
        _pciToExpandedNodesStableIdsMap[ contextState.key ] = _pciToExpandedNodesStableIdsMap[ contextState.key ] || {};

        /**
         * Currently expansion state is maintained in local storage and is based on "id" property of the
         * nodes which is nothing but "uid" property of an element. When configuration changes, for ACE,
         * "uid" of objects change and hence expansion state is lost. It is important from user
         * perspective that we maintain expansion state. In order to achieve that what we do is use
         * "stableId" (commonly referred to as clone stable id chain) property of expanded nodes to
         * identify those on reload. This property remains same across configuration changes. Adding a
         * mapping between product context and "stableId" further solidifies the proper identification
         * of an element. Hence we build a map from "pci" to all "csid" that were expanded.
         */
        if( _.isEqual( treeLoadInput.retainTreeExpansionStates, true ) ) {
            aceTreeTableStateService.setupCacheToRestoreExpansionStateOnConfigChange(
                uwDataProvider, declViewModel, pciBeforeConfigurationChange,
                contextState, _pciToExpandedNodesStableIdsMap[ contextState.key ] );
            treeLoadResult.retainTreeExpansionStates = true;
        }

        var newlyLoadedNodes = treeLoadResult.childNodes;
        // If we have received multiple parent-child info consider those nodes too for maintaining expansion state.
        if( treeLoadResult.vmNodesInTreeHierarchyLevels ) {
            newlyLoadedNodes = [];

            _.forEach( treeLoadResult.vmNodesInTreeHierarchyLevels, function(
                vmNodesInTreeHierarchyLevel ) {
                newlyLoadedNodes = newlyLoadedNodes.concat( vmNodesInTreeHierarchyLevel );
            } );
        }

        /**
         * Restore expansion state of nodes that were identified as expanded when the request was made.
         * It cannot be restricted to the call which made configuration change as not all expanded nodes
         * are returned in a single load action. Hence we must try to identify nodes that need to be
         * expanded from those that are returned after every call.
         */
        if( uwDataProvider && _pciToExpandedNodesStableIdsMap[ contextState.key ] &&
            Object.keys( _pciToExpandedNodesStableIdsMap[ contextState.key ] ).length > 0 ) {
            var pciAfterConfigurationChange = contextState.occContext.currentState.pci_uid;

            aceTreeTableStateService.updateLocalStorageWithExpandedNodesOnConfigChange(
                newlyLoadedNodes, declViewModel, pciAfterConfigurationChange,
                _pciToExpandedNodesStableIdsMap[ contextState.key ] );

            if( response.elementToPCIMap ) {
                aceTreeTableStateService.updateLocalStorageForProductNodesOfSWCOnConfigChange(
                    declViewModel, uwDataProvider.viewModelCollection.getLoadedViewModelObjects(),
                    pciBeforeConfigurationChange, newlyLoadedNodes, pciAfterConfigurationChange );
            }
        }

        if( treeLoadInput.grid ) {
            treeLoadResult.enableSorting = occmgmtUtils.isSortingSupported( contextState );
            treeLoadResult.grid = treeLoadInput.grid;
            let locationSupportsExpansionStateCaching = subPanelContext.provider.locationSupportsExpansionStateCaching === undefined ?
                true : subPanelContext.provider.locationSupportsExpansionStateCaching;
            if( locationSupportsExpansionStateCaching && treeLoadResult.grid.gridOptions ) {
                treeLoadResult.grid.gridOptions.enableExpansionStateCaching = !aceRestoreBWCStateService.isRestoreOptionApplicable( treeLoadResult, subPanelContext.occContext );
            } else {
                if( treeLoadResult.grid.gridOptions ) {
                    treeLoadResult.grid.gridOptions.enableExpansionStateCaching = false;
                }
            }
            //adding expanded nodes to local storage is turned off if expb_all is set...its exceeding local storage quota
            if( contextState.occContext.currentState.expb_all ) {
                treeLoadResult.grid.gridOptions.enableExpansionStateCaching = false;
            }
        }
        treeLoadResult.columnConfig = uwDataProvider.columnConfig;
        let shouldJitterFreePropLoadBeProcessed = _.isUndefined( response.requestPref.updatedObjectUids ) && subPanelContext.provider.locationSupportsJitterFreePropLoad;
        if( shouldJitterFreePropLoadBeProcessed ) {
            if( treeLoadInput.openOrUrlRefreshCase || _.isEqual( treeLoadInput.dataProviderActionType, 'nextAction' ) ||
                ( _.isEqual( isJitterFreePropLoad, true ) ||
                    _.isEqual( treeLoadInput.isResetRequest, true ) // configurration is resetted
                    ||
                    _.isEqual( treeLoadInput.isFilterChangeRequest, true ) ) || treeLoadInput.jitterFreePropLoad === true ) { // filters are changed
                var isFocusOccurrenceConfigured = !_.isEmpty( response.focusChildOccurrence.occurrenceId );
                return loadTreeNodePageWithProperties( newlyLoadedNodes, treeLoadResult, isFocusOccurrenceConfigured, uwDataProvider, declViewModel, contextState, subPanelContext.provider );
            }
        }

        return {
            treeLoadResult: treeLoadResult
        };
    }
};

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} soaInput soa input
 */
function _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput ) {
    /**
     * Since we are 'selecting' the 'opened' node. We want to make sure the 'opened' node is
     * expanded.
     */
    treeLoadInput.expandParent = true;
    var loadIDs = treeLoadInput.loadIDs;

    if( treeLoadInput.openOrUrlRefreshCase ) {
        //All uids i.e. top occurrence, opened occurrence and selected occurrence are same
        if( _.isEqual( loadIDs.t_uid, loadIDs.o_uid ) && _.isEqual( loadIDs.o_uid, loadIDs.c_uid ) ) {
            treeLoadInput.parentElement = loadIDs.t_uid;
        }
    }

    /**
     * Check if the 'parent' has already been loaded
     */
    var oUidObject = cdmSvc.getObject( loadIDs.o_uid );
    var grandParentUid = occmgmtUtils.getParentUid( oUidObject );

    if( grandParentUid ) {
        treeLoadInput.parentElement = grandParentUid;
        populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, oUidObject );
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} loadIDs IDs to be loaded
 */
function _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext ) {
    var oUidObject = cdmSvc.getObject( loadIDs.o_uid );
    var grandParentUid = occmgmtUtils.getParentUid( oUidObject );

    if( cdmSvc.isValidObjectUid( grandParentUid ) ) {
        treeLoadInput.parentElement = grandParentUid;
        populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, oUidObject );
    } else {
        treeLoadInput.parentElement = loadIDs.o_uid;
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 * @param {*} loadIDs IDs to be loaded
 * @param {*} newSortCriteria sortCriteria passed in argument input
 */
function _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput ) {
    let occContext = contextState.occContext;
    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        treeLoadInput.isTopNode = true;
        treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( loadIDs, contextState );
        treeLoadInput.topUid = treeLoadInput.loadIDs.t_uid ? treeLoadInput.loadIDs.t_uid : treeLoadInput.loadIDs.o_uid;
        treeLoadInput.parentElement = cdmSvc.NULL_UID;
    }
    let currentUrlParams = { ...awStateService.instance.params };
    //TODO : Check why previousState is from ctx and currentState from atomic data
    if ( _.isUndefined( occContext.pwaInitialized ) ) {
        treeLoadInput.openOrUrlRefreshCase = 'open';
        if ( !_.isEmpty( occContext.currentState.pci_uid ) && currentUrlParams.gesture !== 'dualContextEnter' && currentUrlParams.gesture !== 'dualContextExit' ) {
            if ( _.isUndefined( appCtxSvc.ctx.aceSessionInitalized ) || appCtxSvc.ctx.aceSessionInitalized === 'oneViewInitialized' ) {
                treeLoadInput.openOrUrlRefreshCase = 'urlRefresh';
                let value = {
                    userGesture: 'REFRESH',
                    jitterFreePropLoad: true
                };
                occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, occContext );
            } else {
                treeLoadInput.openOrUrlRefreshCase = 'backButton';
            }
        }

        treeLoadInput.isProductInteracted = aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid );
        // isProductInteracted shows restore option. In single context, if it is not url refresh and if product is not interacted then we set savedSessionMode to ignore
        // But for split view, we don't show "Restore" option. Always open in default mode, with savedSessionMode as 'restore'
        if( !_.isEqual( treeLoadInput.openOrUrlRefreshCase, 'urlRefresh' ) && !treeLoadInput.isProductInteracted && !appCtxSvc.ctx.splitView ) {
            contextState.occContext.transientRequestPref.savedSessionMode = [ 'ignore' ];
        }
    }

    _populateRetainExpansionStatesParameterForProvidedInput( treeLoadInput, occContext );
    _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput );
    if( contextState.occContext.openedElement && contextState.occContext.openedElement.modelType.typeHierarchyArray.indexOf( 'Awb0SavedBookmark' ) === -1 ) {
        _populateViewMoldelTreeNodeCreationStrategy( treeLoadInput, contextState );
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 * @param {*} loadIDs IDs to be loaded
 * @param {*} topUid topUid
 */
function _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput ) {
    var loadIDs = treeLoadInput.loadIDs;
    if( _.isEqual( loadIDs.c_uid, loadIDs.o_uid ) ) {
        treeLoadInput.expandParent = true;
    }
    if( _.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
        treeLoadInput.parentElement = treeLoadInput.topUid;
    }
}

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} contextState Context State
 */
function _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState ) {
    if( contextState.context.requestPref.resetTreeDisplay || !_.isEmpty( contextState.context.configContext ) ) {
        if( treeLoadInput.parentNode.cursorObject && treeLoadInput.parentNode.cursorObject.endIndex ) {
            treeLoadInput.parentNode.cursorObject.endIndex = 0;
        }
        treeLoadInput.startChildNdx = 0;
    }
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 *
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _doTreeTableLoad( treeLoadInput, uwDataProvider, declViewModel, contextState, soaInput, subPanelContext ) {
    var loadIDs = treeLoadInput.loadIDs;

    if( contextState.occContext.transientRequestPref && contextState.occContext.transientRequestPref.expandBelow ) {
        treeLoadInput.parentElement = contextState.occContext.currentState.o_uid;
        treeLoadInput.expandBelow = true;
        treeLoadInput.levelsApplicableForExpansion = contextState.occContext.transientRequestPref.levelsApplicableForExpansion;
    } //Move to populateExpandBelowParamsIfAppliacble()
    /*
     * loadTreeTableData() is calling this method with skipFocusOccurrenceCheck to true. So , logic to set
     * skipFocusOccurrenceCheck to true is commented as default value is true. Going forward , we should try to
     * get rid of this flag skipFocusOccurrenceCheck
     */

    /**
     * Determine what 'parent' we should tell 'occ6' to focus on.
     */
    else if( treeLoadInput.isTopNode ) {
        if( !treeLoadInput.cursorObject ) {
            soaInput.inputData.requestPref.includePath = [ 'true' ];
            if( _.isUndefined( soaInput.inputData.requestPref.loadTreeHierarchyThreshold ) ) {
                soaInput.inputData.requestPref.loadTreeHierarchyThreshold = [ '50' ];
            }
        } //This should move to _populateTreeLoadInputParamsForProvidedInput()

        /**
         * Check if a 'top' occurrence is set
         */
        if( treeLoadInput.topUid ) {
            /**
             * Check if no 'selected' (c_uid) occurrence OR it is the same as the, valid, 'parent' (o_uid) being
             * loaded.<BR>
             * If so: Find the 'grandparent' and make the 'parent' the focus of the query.
             * <P>
             * TODO: This is where 'includePath' can be used to avoid needing access to the 'grandParent' when
             * the SOA API change to support this is fully deployed.
             */
            if( _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) ) {
                if( _debug_logOccLoadActivity ) {
                    logger.info( '_doTreeTableLoad: Case #1: Focus on parent o_uid:' + loadIDs.o_uid );
                }

                _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput );

                /**
                 * We need to load the 'parent' before we can know the 'grandparent'
                 */
                if( _.isEqual( treeLoadInput.parentElement, cdmSvc.NULL_UID ) ) {
                    if( cdmSvc.isValidObjectUid( loadIDs.c_uid ) ) {
                        treeLoadInput.skipFocusOccurrenceCheck = false;
                    }

                    return dataManagementSvc.loadObjects( [ loadIDs.o_uid ] ).then( function() {
                        return _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
                    } );
                }
            } else {
                /**
                 * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
                 * 'uid'. -- Need to check with use case is this.
                 */
                if( _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTableLoad: Case #2: Focus on parent o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.c_uid );
                    }

                    _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput );

                    /**
                     * Check for case of the 'top' is selected<BR>
                     * If so: Just treat it as a normal 'top' expansion<BR>
                     * If not: Trust that the 'o_uid' is the immediate parent of the 'c_uid'.
                     */
                    if( !_.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
                        treeLoadInput.parentElement = loadIDs.o_uid; //already set above?
                        var cUidObject = cdmSvc.getObject( loadIDs.c_uid );

                        treeLoadInput.isFocusedLoad = true;

                        if( cUidObject ) {
                            if( !cdmSvc.isValidObjectUid( treeLoadInput.parentElement ) ) {
                                treeLoadInput.parentElement = occmgmtUtils.getParentUid( cUidObject );
                            }
                        } else {
                            cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
                        }

                        /**
                         * Check if we are changing the configuration<BR>
                         * If so: We need to reset inputs as if we are loading for the first time
                         */
                        _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState );

                        if( !_.isEmpty( contextState.context.configContext ) ) {
                            treeLoadInput.skipFocusOccurrenceCheck = false;
                        }

                        soaInput.inputData.focusOccurrenceInput.element = cUidObject;
                    }

                    if( _debug_logOccLoadActivity ) {
                        logger.info( //
                            '_doTreeTableLoad: treeLoadInput:' + JSON.stringify( treeLoadInput, //
                                [ 'parentElement', 'cursorObject', 'isFocusedLoad', 'skipFocusOccurrenceCheck' ], 2 ) +
                            '\n' + 'soaInput.inputData.focusOccurrenceInput:' + '\n' +
                            JSON.stringify( soaInput.inputData.focusOccurrenceInput, [ 'element' ], 2 ) );
                    }
                } else {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTableLoad: Case #3: Focus on top o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.c_uid );
                    }

                    treeLoadInput.skipFocusOccurrenceCheck = false;
                    treeLoadInput.parentElement = treeLoadInput.topUid;
                }
            }
        } else {
            treeLoadInput.parentElement = cdmSvc.NULL_UID;
        }
    } else {
        /**
         * Assume the 'parent' node UID is good for the loading
         */
        treeLoadInput.parentElement = treeLoadInput.parentNode.uid;

        /**
         * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the 'uid'.
         */
        if( loadIDs && _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
            if( _debug_logOccLoadActivity ) {
                logger.info( '_doTreeTableLoad: Case #4: Focus on placeholder o_uid:' + loadIDs.o_uid //
                    +
                    ' c_uid: ' + loadIDs.c_uid );
            }

            cUidObject = cdmSvc.getObject( loadIDs.c_uid );

            if( cUidObject ) {
                if( !cdmSvc.isValidObjectUid( treeLoadInput.parentElement ) ) {
                    treeLoadInput.parentElement = occmgmtUtils.getParentUid( cUidObject );
                }
            } else {
                cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
            }

            soaInput.inputData.focusOccurrenceInput.element = cUidObject;
        }
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
} // _doTreeTableLoad

function populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, focusObject ) {
    if( !treeLoadInput.skipFocusOccurrenceCheck ) {
        treeLoadInput.isFocusedLoad = true;
        soaInput.inputData.focusOccurrenceInput.element = focusObject;
    }
}

/**
 * @param {TreeLoadInput} loadIDs - Parameters for the operation.
 * @return {boolean} true if condition is met
 */
function _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) {
    return cdmSvc.isValidObjectUid( loadIDs.o_uid ) && ( !loadIDs.c_uid || cdmSvc.isValidObjectUid( loadIDs.c_uid ) && loadIDs.c_uid === loadIDs.o_uid );
}

/**
 * @param {TreeLoadInput} loadIDs - Parameters for the operation.
 * @return {boolean} true if condition is met
 */
function _areLoadIDsAndOpenedObjectDifferent( loadIDs ) {
    /**
     * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
     * 'uid'.
     */
    return cdmSvc.isValidObjectUid( loadIDs.o_uid ) && cdmSvc.isValidObjectUid( loadIDs.c_uid ) && loadIDs.o_uid !== loadIDs.uid && loadIDs.c_uid !== loadIDs.uid;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 *
 * @return {Promise} A Promise resolved with a resulting TreeLoadResult object.
 */
function _doTreeTablePage( treeLoadInput, uwDataProvider, declViewModel, contextState, soaInput, subPanelContext ) {
    var loadIDs = treeLoadInput.loadIDs;

    /**
     * Determine what 'parent' we should tell 'occ6' to focus on.
     */
    if( treeLoadInput.isTopNode ) {
        soaInput.inputData.requestPref.includePath = [ 'true' ];

        /**
         * Check if a 'top' occurrence is set
         */
        if( treeLoadInput.topUid ) {
            /**
             * Check if no 'selected' (c_uid) occurrence OR it is the same as the, valid, 'parent' (o_uid) being
             * loaded.<BR>
             * If so: Find the 'grandparent' and make the 'parent' the focus of the query.
             * <P>
             * TODO: This is where 'includePath' can be used to avoid needing access to the 'grandParent' when
             * the SOA API change to support this is fully deployed.
             */
            if( _isSelectedNodeEmptyOrSameAsOpenedNode( loadIDs ) ) {
                if( _debug_logOccLoadActivity ) {
                    logger.info( '_doTreeTablePage: Case #1: Focus on parent o_uid:' + loadIDs.o_uid );
                }

                _populateParentElementAndFocusElementInSoaInput( treeLoadInput, soaInput );

                /**
                 * If parent is emtpy , we need to load the 'parent' before we can know the 'grandparent'
                 */
                if( _.isEqual( treeLoadInput.parentElement, cdmSvc.NULL_UID ) ) {
                    return dataManagementSvc.loadObjects( [ loadIDs.o_uid ] ).then( function() {
                        return _populateSOAInputParamsAndLoadTreeTableNodes( treeLoadInput, loadIDs, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
                    } );
                }
            } else {
                /**
                 * Check if the 'c_uid' and 'o_uid' are valid and 'c_uid' and 'o_uid' are NOT the same as the
                 * 'uid'.
                 */
                if( _areLoadIDsAndOpenedObjectDifferent( loadIDs ) ) {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTablePage: Case #2: Focus on parent o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.o_uid );
                    }

                    _populateParentElementAndExpansionParamsForProvidedInput( treeLoadInput );

                    /**
                     * Check for case of the 'top' is selected<BR>
                     * If so: Just treat it as a normal 'top' expansion<BR>
                     * If not: Trust that the 'o_uid' is the immediate parent of the 'c_uid'.
                     */
                    if( !_.isEqual( loadIDs.c_uid, loadIDs.t_uid ) ) {
                        treeLoadInput.parentElement = loadIDs.o_uid; //already set above?
                        var cUidObject = cdmSvc.getObject( loadIDs.c_uid );

                        if( cUidObject ) {
                            var parentElement = occmgmtUtils.getParentUid( cUidObject );

                            if( cdmSvc.isValidObjectUid( parentElement ) ) {
                                treeLoadInput.parentElement = parentElement;
                            }

                            populateFocusElementInSoaInputIfApplicable( treeLoadInput, soaInput, cUidObject );
                        } else {
                            cUidObject = occmgmtUtils.getObject( loadIDs.c_uid );
                        }

                        /**
                         * Check if we are changing the configuration<BR>
                         * If so: We need to reset inputs as if we are loading for the first time
                         */
                        _resetCusrorParamsForProvidedParentNodeIfApplicable( treeLoadInput, contextState );
                    }

                    if( _debug_logOccLoadActivity ) {
                        logger.info( //
                            '_doTreeTablePage: treeLoadInput:' + JSON.stringify( treeLoadInput, //
                                [ 'parentElement', 'cursorObject', 'isFocusedLoad', 'skipFocusOccurrenceCheck' ], 2 ) +
                            '\n' + 'soaInput.inputData.focusOccurrenceInput:' + '\n' +
                            JSON.stringify( soaInput.inputData.focusOccurrenceInput, [ 'element' ], 2 ) );
                    }
                } else {
                    if( _debug_logOccLoadActivity ) {
                        logger.info( '_doTreeTablePage: Case #3: Focus on top o_uid:' + loadIDs.o_uid //
                            +
                            ' c_uid: ' + loadIDs.o_uid );
                    }

                    treeLoadInput.parentElement = treeLoadInput.topUid;
                }
            }
        }
    } else {
        treeLoadInput.parentElement = treeLoadInput.parentNode.uid;
    }

    return _loadTreeTableNodes( treeLoadInput, soaInput, uwDataProvider, declViewModel, contextState, subPanelContext );
} // __doTreeTablePage

/**
 *
 *
 */
export let updateColumnPropsAndNodeIconURLs = function( propColumns, occurrenceNodes, contextState ) {
    var firstColumnConfigColumn = _.filter( propColumns, function( col ) { return _.isUndefined( col.clientColumn ); } )[ 0 ];
    var sortingSupported = occmgmtUtils.isSortingSupported( contextState );
    let viewKey = contextState.occContext ? contextState.occContext.viewKey : appCtxSvc.ctx.aceActiveContext.key;

    if( !sortingSupported ) {
        appCtxSvc.updatePartialCtx( viewKey + '.sortCriteria', null );
    }

    // first column is special here
    firstColumnConfigColumn.isTreeNavigation = true;
    firstColumnConfigColumn.enableColumnHiding = false;

    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
            col.enableSorting = sortingSupported;

            var vmpOfColumnProp = occurrenceNodes[ 0 ].props[ col.propertyName ];
            var sortCriteria = appCtxSvc.getCtx( viewKey ).sortCriteria;

            if( _.isEmpty( sortCriteria ) && ( col.sortDirection === 'Ascending' || col.sortDirection === 'Descending' ) ) {
                col.sort = {};
                col.sortDirection = '';
            }

            //Disable Sorting on DCP property
            if( vmpOfColumnProp && vmpOfColumnProp.isDCP ) {
                col.enableSorting = false;
            }

            if( !_.isEmpty( sortCriteria ) ) {
                if( sortCriteria[ 0 ].fieldName && _.eq( col.propertyName, sortCriteria[ 0 ].fieldName ) ) {
                    col.sort = {};
                    col.sort.direction = sortCriteria[ 0 ].sortDirection.toLowerCase();
                    col.sort.priority = 0;
                }
            }
        }
    } );

    firstColumnConfigColumn.enableColumnMoving = false;
    _firstColumnConfigColumnPropertyName = firstColumnConfigColumn.propertyName;

    // We got awb0ThumbnailImageTicket for nodes in SOA response. Update icon URL for all Nodes
    _.forEach( occurrenceNodes, function( childNode ) {
        childNode.iconURL = occmgmtIconSvc.getIconURL( childNode, childNode.iconURL );
        treeTableDataService.updateVMODisplayName( childNode, _firstColumnConfigColumnPropertyName );
    } );

    let cellRenderers = contextState.occContext ? contextState.occContext.cellRenderers : null;

    aceCellRenderingService.setOccmgmtCellTemplate( propColumns, cellRenderers, viewKey );
};

/**
 *
 */
function _resetContextState( contextKey ) {
    if( appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad ) {
        aceContextStateMgmtService.syncContextState( contextKey, appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad );
    }
}

/**
 *
 */
function _populateRetainExpansionStatesParameterForProvidedInput( treeLoadInput, occContext ) {
    // //Retain expansion states when initializeAction.
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        treeLoadInput.retainTreeExpansionStates = true;
    }

    if( !_.isUndefined( occContext.transientRequestPref ) && !_.isUndefined( occContext.transientRequestPref.retainTreeExpansionStates ) ) {
        treeLoadInput.retainTreeExpansionStates = occContext.transientRequestPref.retainTreeExpansionStates;
    }
}

/**
 *
 */
function _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput ) {
    var context = appCtxSvc.getCtx( contextState.key );
    var currentSortCriteria = context.sortCriteria;
    // If no sort criteria to sort criteria OR sort criteria to no sort criteria
    if( !_.isEmpty( newSortCriteria ) || !_.isEmpty( currentSortCriteria ) ) {
        if( !_.isEqual( newSortCriteria, currentSortCriteria ) ) {
            treeLoadInput.retainTreeExpansionStates = true;
            treeLoadInput.sortCriteriaChanged = true;
            // Enable jitter free propery load
            // Return the child nodes without bom expansion
            let value = {
                jitterFreePropLoad: [ 'true' ],
                returnChildrenNoExpansion: [ 'true' ],
                userGesture: [ 'SORT_CRITERIA_CHANGE' ]
            };

            if( treeLoadInput.openOrUrlRefreshCase ) {
                delete value.returnChildrenNoExpansion;
            }

            // Set loadTreeHierarchyThreshold to number of VMOs in the client
            if( !_.isEmpty( context.vmc ) && !_.isEmpty( context.vmc.getLoadedViewModelObjects() ) ) {
                value.loadTreeHierarchyThreshold = [ context.vmc.getLoadedViewModelObjects().length.toString() ];
            }
            soaInput.inputData.requestPref = value;
            appCtxSvc.updatePartialCtx( contextState.key + '.sortCriteria', newSortCriteria );
        }
    }

    treeLoadInput.sortCriteria = appCtxSvc.getCtx( contextState.key ).sortCriteria;
}

/**
 * Updates VMTN creation stratgy indicating whether to reuse VMTN and clearing expansion state
 * @param {treeLoadInput} treeLoadInput - Object on which clearExistingSelections to be set
 * @param {contextState} contextState - Object with request preference
 */
function _populateViewMoldelTreeNodeCreationStrategy( treeLoadInput, contextState ) {
    var reuseVMNode = !_.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ||
        contextState.context.requestPref.filterOrRecipeChange || contextState.occContext.transientRequestPref.filterOrRecipeChange ||
        treeLoadInput.sortCriteriaChanged;

    treeLoadInput.vmNodeCreationStrategy = { reuseVMNode: reuseVMNode };
    if( treeLoadInput.sortCriteriaChanged ) {
        treeLoadInput.vmNodeCreationStrategy.clearExpandState = true;
    }
}

/**
 *
 */
function _updateContextStateOnUrlRefresh( treeLoadInput, occContext ) {
    //If previous state is empty, that means it is open case/url refresh case
    if( treeLoadInput.openOrUrlRefreshCase ) {
        if( !_.isEmpty( occContext.currentState.incontext_uid ) ) {
            treeLoadInput.loadIDs.c_uid = occContext.currentState.incontext_uid;
            occContext.currentState.c_uid = occContext.currentState.incontext_uid;
        }
    }
}

/**
 * Local storage has 2 set of information stored per product(PCI uid), nodeStates and structure.
 * nodeStates has a flat list of expadedNodes sorted alphabetically and structure has expandedNodes in parent-children hierarchy.
 * This API iterates over the structure and gets the expandedNodes csids if the same entry is present in the nodeState.
 */
function _fetchCsidsForNodes( csids, structureNode, nodeStates ) {
    for( var node in structureNode ) {
        if( node && node !== 'childNdx' ) {
            if( nodeStates.includes( node ) ) {
                csids.push( node );
            } else {
                continue;
            }
        }

        if( !_.isEmpty( structureNode[ node ] ) ) {
            _fetchCsidsForNodes( csids, structureNode[ node ], nodeStates );
        }
    }
}

/**
 *
 */
function _updateTreeLoadInputAndConfigContextParametersForResetAction( treeLoadInput, occContext ) {
    let isResetActionInProgress = !_.isEmpty( occContext.transientRequestPref ) && _.isEqual( occContext.transientRequestPref.savedSessionMode, 'reset' );

    //When reset is done and UID of rootNode doesn't change, Tree widget doesn't populate children property.
    //Re-setting parentNode UID info to what it was when we open structure (state.uid ) helps. Correct way
    //to fix this is refactor dataProviderFactory processTreeNodes logic.
    if( isResetActionInProgress ) {
        treeLoadInput.parentNode.uid = occContext.currentState.uid;
        /*
        For exapnsion state to clear in AFX, isFocusedLoad is required to be true.
        Somehow for reset, loadIDs are coming as NULL in BA. So, setting this explicitly for now.
        */
        treeLoadInput.isFocusedLoad = true;
        treeLoadInput.isResetRequest = true;
    }
}

var shouldClearInContextOverrideMode = function( occContext ) {
    let isConfigurationChangeRequest = !_.isEmpty( occContext.configContext );
    let isFilterChange = occContext.transientRequestPref && ( occContext.transientRequestPref.filterChange || occContext.transientRequestPref.filterOrRecipeChange );
    return isConfigurationChangeRequest || isFilterChange;
};

/**
 * Modified tree load input for isFilterChangeRequest parameter bsaed on applied filters
 */
function _updateTreeLoadInputParameterForFilterOrConfigChangeAction( treeLoadInput, occContext ) {
    // When there if change or add or remove of filters, the contextstate gets populated with applied filters field.
    // The field used to decide whether this is filter change action.
    if( !_.isUndefined( occContext.appliedFilters ) ) {
        treeLoadInput.isFilterChangeRequest = true;
    }
    // When filter or configuration is changed and we are incontext
    // it is expected that the greyed out state is not propogate.
    // filterOrConfigChangeInContext flag is used to skip greying out of nodes
    if( occContext.currentState && occContext.currentState.incontext_uid && occContext.currentState.incontext_uid !== null &&
        shouldClearInContextOverrideMode( occContext ) ) {
        treeLoadInput.filterOrConfigChangeInContext = true;
    }
}

function _getTreeNodeIdsToBeLoaded( loadIDs, contextState ) {
    if( awStateService.instance.params[ contextState.urlParams.rootQueryParamKey ] !== contextState.occContext.currentState.uid ) {
        return {
            t_uid: awStateService.instance.params[ contextState.urlParams.topElementQueryParamKey ],
            o_uid: awStateService.instance.params[ contextState.urlParams.openStructureQueryParamKey ],
            c_uid: awStateService.instance.params[ contextState.urlParams.selectionQueryParamKey ],
            uid: awStateService.instance.params[ contextState.urlParams.rootQueryParamKey ]
        };
    }

    if( !loadIDs ) {
        return {
            t_uid: contextState.occContext.currentState.t_uid,
            o_uid: contextState.occContext.currentState.o_uid,
            c_uid: contextState.occContext.currentState.c_uid,
            uid: contextState.occContext.currentState.uid
        };
    }

    if( !cdmSvc.isValidObjectUid( loadIDs.uid ) ) {
        loadIDs.uid = contextState.occContext.currentState.uid;
    }
    return loadIDs;
}

/**
 *
 */
export function getEffectiveOverriddenPolicy( occContext ) {
    var overriddenPropertyPolicy = propertyPolicySvc.getEffectivePolicy();

    //read preference AWB_ShowTypeIcon
    if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_ShowTypeIcon ) &&
        appCtxSvc.ctx.preferences.AWB_ShowTypeIcon.length > 0 && appCtxSvc.ctx.preferences.AWB_ShowTypeIcon[ 0 ].toUpperCase() === 'TRUE' ) {
        // show thumbnail false, show type ICON true
        _.forEach( overriddenPropertyPolicy.types, function( type ) {
            var properties = [];
            _.forEach( type.properties, function( property ) {
                if( property.name !== 'awp0ThumbnailImageTicket' ) {
                    properties.push( property );
                }
            } );
            type.properties = properties;
        } );
    }
    _.each( OverriddenPropertyPolicyHandlers, function( handler ) {
        if( handler.condition( occContext ) ) {
            handler.callbackFunction( overriddenPropertyPolicy );
        }
    } );

    return overriddenPropertyPolicy;
}

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @param {Object} columnProvider:
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = async function( uwDataProvider, columnProvider, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    var firstColumnConfigCol = {
        name: 'object_string',
        displayName: '...',
        typeName: 'Awb0Element',
        width: 400,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false,
        columnOrder: 100
    };

    var clientColumns = columnProvider && columnProvider.clientColumns ? columnProvider.clientColumns : [];
    if( clientColumns ) {
        _.forEach( clientColumns, function( column ) {
            if( column.clientColumn ) {
                awColumnInfos.push( column );
            }
        } );
    }

    awColumnInfos.push( firstColumnConfigCol );

    //TODO: Check why columnProvider call is not passing additional arugments.
    aceCellRenderingService.setOccmgmtCellTemplate( awColumnInfos, null );
    const promises = [];
    _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
        if( subPanelContext && subPanelContext.occContext && provider.condition( subPanelContext.occContext ) ) {
            promises.push( provider.getClientColumns() );
        }
    } );
    await Promise.all( promises ).then( ( response ) => {
        _.each( response, function( awColumnInfo ) {
            awColumnInfos = awColumnInfos.concat( awColumnInfo );
        } );
        awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );
        awColumnSvc.createColumnInfo( awColumnInfos );

        deferred.resolve( {
            columnConfig: {
                columns: awColumnInfos
            }
        } );
    } );

    return deferred.promise;
};

// Clears the vector if it contains SRUID
let _enforceCsidChains = function( csidChains ) {
    var sruidPrefix = 'SR::N::';
    var sruidFound = csidChains.find( csidChain => {
        if( csidChain.includes( sruidPrefix ) ) {
            return true;
        }
    } );
    if( sruidFound ) {
        csidChains.splice( 0, csidChains.length );
    }
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
 * usually the result of processing the 'inputData' property of a DeclAction based on data from the current
 * DeclViewModel on the $scope). The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function() {
    /**
     * Extract action parameters from the argument to this function.
     */
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let loadIDs = arguments[ 0 ].loadIDs;
    let grid = { ...arguments[ 0 ].grid };
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let objectToBeLoadedInTree = subPanelContext.objectToBeLoadedInTree;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let occContext = arguments[ 0 ].occContext;
    let declViewModel = { ...arguments[ 0 ].declViewModel };
    let newSortCriteria = _.cloneDeep( arguments[ 0 ].sortCriteria );
    let currentContext = appCtxSvc.ctx[ occContext.viewKey ] || {};
    let contextState = {
        context: currentContext,
        key: occContext.viewKey,
        urlParams: aceUrlManagementService.getUrlParamMapForCurrentContext( subPanelContext.provider ),
        occContext: declViewModel.data.newOccContext ? declViewModel.data.newOccContext : occContext.getValue()
    };

    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;

    _updateTreeLoadInputAndConfigContextParametersForResetAction( treeLoadInput, occContext );
    _updateTreeLoadInputParameterForFilterOrConfigChangeAction( treeLoadInput, occContext );

    treeLoadInput.grid = grid;

    if( currentContext.treeLoadingInProgress !== true ) {
        setTreeLoadingState( occContext.viewKey, true );
    }

    var soaInput = occmgmtGetSvc.getDefaultSoaInput();

    _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput );
    _updateContextStateOnUrlRefresh( treeLoadInput, occContext );

    if( objectToBeLoadedInTree ) {
        treeLoadInput.loadIDs = {};
        treeLoadInput.loadIDs.uid = objectToBeLoadedInTree.uid;
    }

    // Fix for LCS-766393
    // isUserContextSaveRequired is a transient state on ctx which is lost on urlRefresh reset it to true
    if( treeLoadInput.openOrUrlRefreshCase === 'urlRefresh' ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isUserContextSaveRequired', true, occContext.viewKey );
    }

    // When changing configuration we need to send list of expanded nodes to server
    //should this have generic check for retainTreeExpansionStates?
    let loadedVMOsInfo = aceTreeTableStateService.getLoadedVMOsInformation( dataProvider.viewModelCollection );

    if( _.isEqual( treeLoadInput.retainTreeExpansionStates, true ) ) {
        //when select is packed-non-master ( nested packing case ), its parent wont be loaded. In such case, below logic of passing
        //expanded parent of focus object if focus object is not visible, fails. So, considering h_uid, which is loaded highlighted pack-master for this logic.
        //If this is regular selection, h_uid & c_uid would be same.
        let highlightOrFocusOjectUid = occContext.currentState.h_uid ;
        let focusOrHighlightObject = cdmSvc.getObject( highlightOrFocusOjectUid );
        if ( focusOrHighlightObject !== null && loadedVMOsInfo.expandedNodeUidMap.size > 0 ) {
            do {
                let parentUid = occmgmtUtils.getParentUid( focusOrHighlightObject );
                if( loadedVMOsInfo.expandedNodeUidMap.has( parentUid ) ) {
                    if( focusOrHighlightObject.uid !== occContext.currentState.h_uid ) {
                        contextState.occContext.transientRequestPref.overriddenfocusOccurrenceInput = focusOrHighlightObject;
                        contextState.occContext.transientRequestPref.overriddenParentElement = parentUid;
                    }
                    break;
                }
                focusOrHighlightObject = cdmSvc.getObject( parentUid );
            } while( focusOrHighlightObject !== null );
        }
        soaInput.inputData.requestPref.expandedNodes = loadedVMOsInfo.csidChainsOfNodes;
    }

    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    if( !_.isUndefined( appCtxSvc.ctx.clearLocalStorageForInactiveView ) && appCtxSvc.ctx.clearLocalStorageForInactiveView === gridId ) {
        awTableStateService.clearAllStates( declViewModel, gridId );
        appCtxSvc.updatePartialCtx( 'clearLocalStorageForInactiveView', null );
    }

    var newReqPrefValues = {};
    var csidChainsOfNodes = [ ':' ];
    // In case of urlRefresh and backButton, we send the expanded nodes cached in the local storage as input.
    // This is done to achieve jitterfree behaviour for the 2 scenarios.
    // For partition unassigned case, expanded nodes are not populated yet. Here we fetch csidChainsOfNodes and assign it to expandedNodes
    let currentUrlParams = { ...awStateService.instance.params };
    if( ( treeLoadInput.openOrUrlRefreshCase === 'urlRefresh' || treeLoadInput.openOrUrlRefreshCase === 'backButton' || currentUrlParams.gesture === 'dualContextEnter' || currentUrlParams.gesture === 'dualContextExit' ) &&
        _.isEmpty( contextState.occContext.transientRequestPref.expandedNodes ) ) {
        var topNodeUid = treeLoadInput.topUid;

        if( topNodeUid ) {
            // The dataProvider.topTreeNode.uid is populated with SRUID as a part of getOcc call response processing.
            // Until then it is the uid of top item rev.
            // Populate the uid as alternate id on the dataprovider to get the correct values from the local storage.
            // To get the ttstate from LS, the awTableState APIs compare the dataprovider uid with the topNode uid (SRUID)
            if( dataProvider.topTreeNode && dataProvider.topTreeNode.uid !== topNodeUid ) {
                dataProvider.topTreeNode.alternateID = topNodeUid;
            }

            var ttState = awTableStateService.getTreeTableState( declViewModel, gridId );
            if( !_.isEmpty( ttState.nodeStates ) && !_.isEmpty( ttState.structure ) ) {
                // Get the list of expanded nodes from the local storage if an entry exists
                var nodeStates = [];
                for( var node in ttState.nodeStates ) {
                    nodeStates.push( node );
                }

                // Fetch the csids to an array from local storage
                var tableStructure = ttState.structure;
                var structureNodes = tableStructure[ topNodeUid ];
                _fetchCsidsForNodes( csidChainsOfNodes, structureNodes, nodeStates );
            }

            if( dataProvider.topTreeNode && dataProvider.topTreeNode.alternateID ) {
                delete dataProvider.topTreeNode.alternateID;
            }

            _enforceCsidChains( csidChainsOfNodes );

            if( csidChainsOfNodes.length > 1 ) {
                newReqPrefValues = {
                    expandedNodes: csidChainsOfNodes
                };
            }
        }
    }
    if( !_.isUndefined( contextState.occContext.transientRequestPref.expandedNodes ) && contextState.occContext.transientRequestPref.expandedNodes.length > 1 || csidChainsOfNodes.length > 1 ) {
        newReqPrefValues.jitterFreePropLoad = [ 'true' ];
        newReqPrefValues.loadTreeHierarchyThreshold = [ '2147483646' ];
        newReqPrefValues.returnChildrenNoExpansion = [ 'true' ];

        soaInput.inputData.requestPref = newReqPrefValues;
    }
    /**
     * Get the 'child' nodes async
     */
    return _doTreeTableLoad( treeLoadInput, dataProvider, declViewModel, contextState, soaInput, subPanelContext );
};

/*
 * Method registered against focusAction in viewModel json.
 */
export let loadOccurrencesWithFocusInTreeTable = function() {
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let newSortCriteria = arguments[ 0 ].sortCriteria;
    let occContext = arguments[ 0 ].occContext;
    let currentContext = appCtxSvc.ctx[ occContext.viewKey ] || {};
    let contextState = {
        context: currentContext,
        key: occContext.viewKey,
        urlParams: aceUrlManagementService.getUrlParamMapForCurrentContext( subPanelContext.provider ),
        occContext: occContext.getValue()
    };

    // Fix for LCS-749532 Workaround fix till we get correct fix from CFX
    // CFX should not trigger the focus load action if the focussed element is part of the VMC
    let selection = dataProvider.selectionModel.getSelection();
    let elementToFocusOn = occmgmtUtils.getObject( selection[ selection.length - 1 ] );
    if( contextState.occContext.vmc.findViewModelObjectById( elementToFocusOn.uid ) !== -1 ) {
        // Fix for console errors
        // Log and return the empty treeLoadResult
        // populate columnConfig on the treeLoadResult
        logger.warn( 'Focus occurrence is already in the vmc.' );
        return {
            treeLoadResult: { columnConfig: dataProvider.columnConfig }
        };
    }

    let parentProp = elementToFocusOn.props.awb0BreadcrumbAncestor ? elementToFocusOn.props.awb0BreadcrumbAncestor : elementToFocusOn.props.awb0Parent;

    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;
    treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( undefined, contextState );
    // When focus load action triggered we need to send list of expanded nodes to server
    // Applications can consume expanded nodes information as needed
    treeLoadInput.loadIDs = _getTreeNodeIdsToBeLoaded( undefined, contextState );
    soaInput.inputData.requestPref.expandedNodes = aceTreeTableStateService.getCSIDChainsForExpandedNodes( dataProvider );
    soaInput.inputData.requestPref.loadTreeHierarchyThreshold = [ '1000' ];

    // LCS-1029396
    // Change the elementToFocusOn if a hidden node is selected
    // Consult acePartialSelectionService to identify the visible node
    if( acePartialSelectionService.isPartiallySelected( elementToFocusOn.uid ) ) {
        let elementToHighlightUid = acePartialSelectionService.getVisibleNodeForHiddenNodeInPartialSelection( elementToFocusOn.uid );
        elementToFocusOn = occmgmtUtils.getObject( elementToHighlightUid );
    }

    soaInput.inputData.focusOccurrenceInput.element = elementToFocusOn;
    if( parentProp ) {
        treeLoadInput.parentElement = parentProp.dbValues[ 0 ];
    }

    if( contextState.occContext.elementToPCIMap ) {
        let focused_pci_uid = occmgmtUtils.getProductContextForProvidedObject( elementToFocusOn );
        soaInput.inputData.config.productContext = occmgmtUtils.getObject( focused_pci_uid );
    }

    /*
     * If focus occurrence is hidden occurrence, then we should process tree update.
     */
    if( contextState.context ) {
        if( !_.isUndefined( treeLoadInput.loadIDs ) && !_.isUndefined( treeLoadInput.loadIDs.c_uid ) &&
            acePartialSelectionService.isPartiallySelected( treeLoadInput.loadIDs.c_uid, contextState.key ) &&
            acePartialSelectionService.isPartiallySelectedInTree( treeLoadInput.loadIDs.c_uid, contextState.key ) ) {
            // Fix for console errors
            let currentState = occContext.currentState;
            currentState.h_uid = contextState.context.acePartialSelection.partialSelectionInfo.get( treeLoadInput.loadIDs.c_uid );

            //if getOcc call for focus is made on selection sync, and its already there in partial selection,
            // make sure h_uid is synced on currentState properly.
            occmgmtUtils.updateValueOnCtxOrState( 'currentState', currentState, occContext );
            logger.warn( 'focus occurrence is hidden.' );

            // Log and return the empty treeLoadResult
            // populate columnConfig on the treeLoadResult

            return {
                treeLoadResult: { columnConfig: dataProvider.columnConfig }
            };
        }
    }

    setTreeLoadingState( occContext.viewKey, true );
    _populateSortCriteriaParameterForProvidedInput( treeLoadInput, contextState, newSortCriteria, soaInput );
    //return _doTreeTablePage( treeLoadInput, dataProvider, arguments[ 0 ].declViewModel, contextState, soaInput, subPanelContext );
    return _loadTreeTableNodes( treeLoadInput, soaInput, dataProvider, arguments[ 0 ].declViewModel, contextState, subPanelContext );
};

/*
 * Get a page of row data for a 'tree' table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
 * usually the result of processing the 'inputData' property of a DeclAction based on data from the current
 * DeclViewModel on the $scope). The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableRows = async function() {
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let view = 'ACE';
    if( subPanelContext && subPanelContext.occContext && subPanelContext.occContext.currentState ) {
        view = !_.isUndefined( subPanelContext.occContext.currentState.view ) ? subPanelContext.occContext.currentState.view : 'ACE';
    }
    let provider = aceTreeTableExtService.getTreeDataProviderFromViewContext( view );
    return await provider.getTreeTableRows( arguments );
};

/**
 * Expands a single parent using the Invoker
 * @returns {Promise} Promise required for return by loadNextOccurrencesInTreeTable
 */
function _expandOneWithInvoker() {
    // TODO: Factor into separate fn
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput !== undefined, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let uwDataProvider = arguments[ 0 ].uwDataProvider;
    let occContext = arguments[ 0 ].occContext;

    let commandContext = {
        occContext: occContext.getValue(),
        viewKey: occContext.viewKey,
        clientScopeURI: uwDataProvider.objectSetUri,
        uwDataProvider: uwDataProvider
    };
    expandRequests.expandOne( treeLoadInput.parentNode, commandContext );

    // Return only enough to keep tree happy for now
    var emptyResult = {
        treeLoadResult: { totalChildCount: 0 }
    };
    return AwPromiseService.instance.resolve( emptyResult );
}

export let loadNextOccurrencesInTreeTable = function() {
    if( expandRequests.expandOneEnabled() ) {
        return _expandOneWithInvoker( arguments[ 0 ] );
    }
    return exports.loadTreeTableDataPage( arguments[ 0 ] );
};

/*
 * Method registered against previousAction in viewModel json
 */
export let loadPreviousOccurrencesInTreeTable = function() {
    return exports.loadTreeTableDataPage( arguments[ 0 ] );
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
 * usually the result of processing the 'inputData' property of a DeclAction based on data from the current
 * DeclViewModel on the $scope). The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableDataPage = function() {
    /**
     * Extract action parameters from the argument to this function.
     */

    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].treeLoadInput, 'Missing argument property' );

    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let loadIDs = arguments[ 0 ].loadIDs;
    let grid = arguments[ 0 ].grid;
    let dataProvider = arguments[ 0 ].uwDataProvider;
    let newSortCriteria = arguments[ 0 ].sortCriteria;
    let subPanelContext = arguments[ 0 ].subPanelContext;
    let occContext = arguments[ 0 ].occContext;
    let contextState = {
        context: appCtxSvc.ctx[ occContext.viewKey ],
        key: occContext.viewKey,
        urlParams: aceUrlManagementService.getUrlParamMapForCurrentContext( subPanelContext.provider ),
        occContext: occContext.getValue()
    };

    aceRestoreBWCStateService.toggleTreeNode( arguments[ 0 ].declViewModel, occContext, treeLoadInput.parentNode );
    treeLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;

    if( treeLoadInput.cursorNodeId ) {
        var objNdx = dataProvider.viewModelCollection.findViewModelObjectById( treeLoadInput.cursorNodeId );
        var vmNode = dataProvider.viewModelCollection.getViewModelObject( objNdx );

        /**isPlaceholder / _focusRequested property on vmNode indicates that it is placeHolder node. This is not actual focus
         * object. But passed as focus object to load that particular incomplete level in client. So set skipFocusOccurrenceCheck to true.
         **/
        if( vmNode._loadTailRequested || vmNode._loadHeadRequested || vmNode._focusRequested ) {
            treeLoadInput.skipFocusOccurrenceCheck = true;
        } else {
            /**
             * Call is being made neither for focus action nor for pagination.
             * Invalid call. Results into duplicate nodes being shown in Tree + other functional issues.
             */
            //return AwPromiseService.instance.reject( 'Invalid TreeLoadInput specified' );
        }
    }

    let transientRequestPref = contextState.occContext.transientRequestPref;
    if( ( transientRequestPref && transientRequestPref.expandBelow || treeLoadInput.parentNode.isInExpandBelowMode ) && _.isEmpty( contextState.context
        .configContext ) ) {
        treeLoadInput.expandBelow = true;
        treeLoadInput.levelsApplicableForExpansion = contextState.occContext.transientRequestPref.levelsApplicableForExpansion;
        transientRequestPref.expandBelow = true;
        transientRequestPref.loadTreeHierarchyThreshold = occmgmtUtils.getExpandBelowPageSize();

        //scopeForExpandBelow should be sent to server for every follow up expandBelow request
        transientRequestPref.scopeForExpandBelow = contextState.occContext.persistentRequestPref.scopeForExpandBelow;
    }

    treeLoadInput.grid = grid;

    /*
     * This method is called in following scenarios : a) Object is added into selection,it is not displayed
     * currently in tree , needs to be fetched from server and focused. In this case, skipFocusOccurrenceCheck
     * should not be true so that focus occurrence is passed to server and it get focused after server response (
     * in case of 4G , different object comes from server) b) When Tree Node is expanded. In this case,
     * skipFocusOccurrenceCheck should be true so that current focus occurrence is not passed to server. Server
     * returns data based on parent of focus occurrence
     */
    if( treeLoadInput.parentNode ) {
        if( treeLoadInput.parentNode.isExpanded ) {
            //TreeNode expansion scenario
            treeLoadInput.skipFocusOccurrenceCheck = true;
            //We need loadIDs from data provider only in "Expand Node" use case. Otherwise, loadIDs
            //information is there on URL.
            treeLoadInput.loadIDs = {
                t_uid: arguments[ 0 ].loadIDs.t_uid,
                o_uid: arguments[ 0 ].loadIDs.o_uid,
                uid: contextState.occContext.currentState.uid
            };

            if( contextState.occContext.elementToPCIMap ) {
                if( treeLoadInput.parentNode.pciUid ) {
                    treeLoadInput.pci_uid = treeLoadInput.parentNode.pciUid;
                } else {
                    treeLoadInput.pci_uid = occmgmtUtils.getProductContextForProvidedObject( treeLoadInput.parentNode );
                }
            }
        }
    }

    var soaInput = occmgmtGetSvc.getDefaultSoaInput();
    setTreeLoadingState( occContext.viewKey, true );
    _populateTreeLoadInputParamsForProvidedInput( treeLoadInput, contextState, loadIDs, newSortCriteria, soaInput );

    /**
     * Get the 'child' nodes async
     */

    return _doTreeTablePage( treeLoadInput, arguments[ 0 ].uwDataProvider, arguments[ 0 ].declViewModel, contextState, soaInput, subPanelContext );
};

/**
 * Get a object containing callback function.
 * @return {Object} A object containing callback function.
 */
function getDataForUpdateColumnPropsAndNodeIconURLs( subPanelContext ) {
    var updateColumnPropsCallback = {};
    let contextState = {
        occContext: subPanelContext.occContext,
        key: subPanelContext.occContext.viewKey
    };
    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response, uwDataProvider ) {
        var columnConfigResult = null;
        let clientColumns = uwDataProvider && !_.isEmpty( uwDataProvider.cols ) ? _.filter( uwDataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        exports.updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes, contextState );

        let columnsConfig = response.output.columnConfig;
        columnsConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        columnConfigResult = columnsConfig;
        appCtxSvc.updatePartialCtx( contextKey + '.treePropertyLoadingInProgress', false );

        _resetContextState( contextKey );
        return columnConfigResult;
    };

    return updateColumnPropsCallback;
}

/**
 * Get a page of row column data for a tree-table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {PropertyLoadInput} propertyLoadInput - (found within the 'arguments' property passed to this function) The
 * PropertyLoadInput contains an array of PropertyLoadRequest objects this action function is invoked to
 * resolve.
 *
 * @return {Promise} A Promise resolved with a 'PropertyLoadResult' object containing the details of the result.
 */
export let loadTreeTableProperties = async function() {
    arguments[ 0 ].updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs( arguments[ 0 ].subPanelContext );
    arguments[ 0 ].overriddenPropertyPolicy = getEffectiveOverriddenPolicy( arguments[ 0 ].subPanelContext.occContext );

    let isRedLineMode = appCtxSvc.getCtx( 'isRedLineMode' );
    if( isRedLineMode === 'true' ) {
        arguments[ 0 ].propertyLoadContext.addPropsToServiceData = [ 'awb0MarkupType', 'awb0MarkupPropertyNames', 'awb0MarkupPropertyValues' ];
    }

    // Rare scenario where the user scrolls very fast and properties are loaded by the background calls but not rendered on the UI
    // This happens due to timing of background and foreground calls
    // Trigger plTable.clientRefresh will render the client if properties are already loaded with background calls
    let gridId = Object.keys( arguments[ 0 ].declViewModel.grids )[ 0 ];
    eventBus.publish( gridId + '.plTable.clientRefresh' );

    // First make a call to fetch TC properties
    let tcPropPromise = treeTableDataService.loadTreeTableProperties( arguments[ 0 ] );

    let subPanelContext = arguments[ 0 ].subPanelContext;
    let vMTreeNodes = getChildNodes( arguments[ 0 ].propertyLoadInput );
    const promises = [];
    let getPropertiesCallBack = [];
    _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
        if( provider.condition( subPanelContext.occContext ) ) {
            promises.push( provider.getProperties( vMTreeNodes ) );
            getPropertiesCallBack.push( provider.getProperties );
        }
    } );

    if( expandRequests.loadTreePropertiesInBackgroundEnabled() ) {
        let uwDataProvider = arguments[ 0 ].uwDataProvider;
        if( uwDataProvider && uwDataProvider.addedColumnNames && uwDataProvider.addedColumnNames.length > 0 ) {
            // The actual addedColumnNames will be cleared right after first SOA response in framework code.
            // Creating a separate array for ace added column names as ACE makes several background calls to SOA to load more properties.
            uwDataProvider.aceAddedColumnNames = uwDataProvider.addedColumnNames;
        }
        let commandContext = {
            occContext: subPanelContext.occContext,
            viewKey: subPanelContext.occContext.viewKey,
            clientScopeURI: uwDataProvider.objectSetUri,
            dataProvider: uwDataProvider
        };
        appCtxSvc.updatePartialCtx( commandContext.viewKey + '.treePropertyLoadingInProgress', true );
        return await Promise.all( promises ).then( () => {
            return AwPromiseService.instance.resolve( tcPropPromise.then( function( response ) {
                expandRequests.loadTreePropertiesInBackground( commandContext, getPropertiesCallBack );
                return response;
            } ) );
        } );
    }
    return AwPromiseService.instance.resolve( tcPropPromise );
};

export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey, subPanelContext ) {
    var updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs( subPanelContext );
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes,
        declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback, getEffectiveOverriddenPolicy( subPanelContext.occContext ) ) );
};

export let getContextKeyFromParentScope = function( parentScope ) {
    return aceContextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 * eventData : {Object} containing viewModelObjects and totalObjectsFound
 */
export let updateDisplayNames = function( loadedVMObjects, eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes
    if( eventData && eventData.viewModelObjects ) {
        _.forEach( eventData.viewModelObjects, function( updatedVMO ) {
            if( updatedVMO.props && updatedVMO.props[ _firstColumnConfigColumnPropertyName ] && updatedVMO.props[ _firstColumnConfigColumnPropertyName ].displayValues ) {
                treeTableDataService.updateVMODisplayName( updatedVMO, _firstColumnConfigColumnPropertyName );
            }
        } );
    }

    //TODO : probable data mutation case
    //loadedVMObjects from eventData are getting updated...probably not right copy from dispatcher...
    if( eventData && eventData.modifiedObjects && loadedVMObjects ) {
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            var modifiedVMOs = loadedVMObjects.filter( function( vmo ) { return vmo.id === modifiedObject.uid; } );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                if( modifiedVMO.props && modifiedVMO.props[ _firstColumnConfigColumnPropertyName ] && modifiedVMO.props[ _firstColumnConfigColumnPropertyName ].displayValues ) {
                    treeTableDataService.updateVMODisplayName( modifiedVMO, _firstColumnConfigColumnPropertyName );
                }
            } );
        } );
    }
};

var setTreeLoadingState = function( contextKey, value ) {
    appCtxSvc.updatePartialCtx( contextKey + '.treeLoadingInProgress', value );
};

var _changeNodeStateToCollapsed = function( vmo, declViewModel ) {
    vmo.children = [];
    vmo.expanded = false;
    vmo.isLeaf = true;
    var gridId = Object.keys( declViewModel.grids )[ 0 ];
    awTableStateService.saveRowCollapsed( declViewModel, gridId, vmo );
    delete vmo.isExpanded;
};

var _getTreeNodesToRemove = function( vmo, declViewModel ) {
    var treeNodesToRemove = [];
    if( vmo.children && vmo.children.length > 0 ) {
        _.forEach( vmo.children, function( childVMO ) {
            var childTreeNodesToRemove = _getTreeNodesToRemove( childVMO, declViewModel );
            treeNodesToRemove = treeNodesToRemove.concat( childTreeNodesToRemove );
            childVMO.children = [];
            childVMO.expanded = false;
        } );
        treeNodesToRemove = treeNodesToRemove.concat( vmo.children );
        _changeNodeStateToCollapsed( vmo, declViewModel );
    }
    return treeNodesToRemove;
};

/**
 * Populate Tree properties for empty nodes in batches using background calls
 *
 * @param {*} subPanelContext - subPanelContext
 * @param {*} uwDataProvider - Data Provider
 */
export let populateTreeTableProperties = function( subPanelContext, uwDataProvider ) {
    let viewKey = subPanelContext.occContext.viewKey;
    if( requestQueue.active() === false && appCtxSvc.getCtx( viewKey + '.treePropertyLoadingInProgress' ) !== true ) {
        if( expandRequests.loadTreePropertiesInBackgroundEnabled() ) {
            let commandContext = {
                occContext: subPanelContext.occContext,
                viewKey: viewKey,
                clientScopeURI: uwDataProvider.objectSetUri,
                uwDataProvider: uwDataProvider
            };
            let getPropertiesCallBack = [];
            _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
                if( provider.condition( subPanelContext.occContext ) ) {
                    getPropertiesCallBack.push( provider.getProperties );
                }
            } );
            expandRequests.loadTreePropertiesInBackground( commandContext, getPropertiesCallBack );
        }
    }
};

/**
 * Process the viewModelCollectionEvent
 *
 * @param {Object} event The viewModelCollectionEvent
 */
export let processViewModelCollectionEvent = function( dataProvider, data ) {
    var vmc = dataProvider.viewModelCollection;
    var event = data.eventData;
    if( vmc && event ) {
        var treeNodesToRemove = [];
        var loadedVMObjects = vmc.getLoadedViewModelObjects();

        if( loadedVMObjects && loadedVMObjects.length > 0 ) {
            _.forEach( event.modifiedObjects, function( mo ) {
                _.forEach( loadedVMObjects, function( currentlyLoadedVmo ) {
                    if( mo.uid === currentlyLoadedVmo.uid ) {
                        //Update the display name
                        treeTableDataService.updateVMODisplayName( currentlyLoadedVmo, _firstColumnConfigColumnPropertyName );

                        // Understand the if the node is leaf or not
                        var numChildren = 0;
                        if( mo.props && mo.props.awb0NumberOfChildren &&
                            mo.props.awb0NumberOfChildren.dbValues &&
                            mo.props.awb0NumberOfChildren.dbValues.length ) {
                            numChildren = parseInt( mo.props.awb0NumberOfChildren.dbValues[ 0 ] );
                        }

                        var updatedObjectOfVmoHasNoChildren = numChildren === 0;

                        //update children status
                        if( currentlyLoadedVmo.isLeaf === false && updatedObjectOfVmoHasNoChildren ) {
                            if( currentlyLoadedVmo.children && currentlyLoadedVmo.children.length > 0 ) {
                                var childTreeNodesToRemove = _getTreeNodesToRemove( currentlyLoadedVmo, data );
                                treeNodesToRemove = treeNodesToRemove.concat( childTreeNodesToRemove );
                            }
                            if( !currentlyLoadedVmo.totalChildCount || currentlyLoadedVmo.totalChildCount === 0 ) {
                                _changeNodeStateToCollapsed( currentlyLoadedVmo, data );
                            }
                        } else if( currentlyLoadedVmo.isLeaf === true && updatedObjectOfVmoHasNoChildren === false ) {
                            currentlyLoadedVmo.isLeaf = false;
                        }
                    }
                } );
            } );

            if( treeNodesToRemove && treeNodesToRemove.length > 0 ) {
                vmc.removeLoadedObjects( treeNodesToRemove );
                dataProvider.update( vmc.getLoadedViewModelObjects() );
            }
        }
    }
};

/**
 * @param {Object} loadedVMObjects all loaded view model objects whose visibility to be populated
 */
export let setOccVisibility = function( loadedVMObjects, contextKey, gridId, occContext ) {
    let visibilityControlsCurrentValue = appCtxSvc.getCtx( contextKey + '.visibilityControls' );

    if( _.isArray( loadedVMObjects ) ) {
        var visibilityChangedVmos = [];
        var partialSelectionsToRemove = [];
        _.forEach( loadedVMObjects, function( target ) {
            var originalVisibility = target.visible;
            target.visible = occmgmtVisibilityService.getOccVisibility( cdmSvc.getObject( target.uid ), contextKey );
            if( originalVisibility !== target.visible ) {
                visibilityChangedVmos.push( target );
            }
            if( acePartialSelectionService.isHiddenNodePresentInPartialSelection( target.uid ) ) {
                partialSelectionsToRemove.push( target );
            }
        } );
        if( partialSelectionsToRemove.length > 0 ) {
            acePartialSelectionService.removePartialSelection( [], partialSelectionsToRemove, occContext );
        }
        let visibilityControlsNewValue = appCtxSvc.getCtx( contextKey + '.visibilityControls' );

        if( visibilityChangedVmos.length || !_.isEqual( visibilityControlsCurrentValue, visibilityControlsNewValue ) ) {
            //event should also take visibilityStateChangedVMOs and update process only this.
            eventBus.publish( gridId + '.plTable.visibilityStateChanged' );
        }
    }
};

export let initialize = function() {
    if( appCtxSvc.ctx.expandedNodes ) {
        _pciToExpandedNodesStableIdsMap = {};
        _expandedNodes = {};
        _expandedNodes.nodes = _.cloneDeep( appCtxSvc.ctx.expandedNodes );
        appCtxSvc.unRegisterCtx( 'expandedNodes' );
    }
};

export let destroy = function( uwDataProvider, subPanelContext, viewContext ) {
    aceTreeTableExtService.unRegisterDefaultTreeTableDataProvider( viewContext );
    aceEditHandlerExtService.clearAppEditHandlers();
    _pciToExpandedNodesStableIdsMap = {};
    _.keys( _expandedNodes ).map( function( key ) {
        delete _expandedNodes[ key ];
    } );

    /*When user switches to 2Left-OneRight view, or from 2Left-OneRight to Left-Right or OneLeft-TwoRight,
     Tree gets destroyed & re-created. Like Open/URL refresh case, we need to pass expandedNodes to server for jitter-free tree load.
     As layout is already established, 'Open' or 'URL refresh' condition, under which expandedNodes get populated, doesnt become true..
     Other way to pass csidChains to server is directly populate expandedNodes on transientRequestPref.expandeNodes which gets picked up
     at the time of getOcc() call...
    */

    if( uwDataProvider && subPanelContext ) {
        let value = {
            expandedNodes: aceTreeTableStateService.getCSIDChainsForExpandedNodes( uwDataProvider )
        };
        occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, subPanelContext.occContext );
    }

    unRegisterOverriddenPropertyPolicyHandler();
    _expandedNodes = {};
};

export let initializeOccmgmtTree = function( dataProvider, occContext, editContext, viewContext ) {
    if( dataProvider && occContext && editContext ) {
        aceTreeTableExtService.registerDefaultTreeTableDataProvider( occContext, viewContext );
        aceEditHandlerExtService.executeAppEditHandlers( arguments );
    }
};

export let retainCurrentExpansionState = function( vmc ) {
    var expandedNodes = vmc.getLoadedViewModelObjects().filter( function( node ) {
        return node.isExpanded === true;
    } );
    appCtxSvc.updatePartialCtx( 'expandedNodes', expandedNodes );
};

export let updateOccMgmtTreeTableColumns = function( data, dataProvider, subPanelContext ) {
    let output = {};
    if( dataProvider && data.newColumnConfig ) {
        let contextState = {
            occContext: subPanelContext.occContext,
            key: subPanelContext.occContext.viewKey
        };
        var propColumns = data.newColumnConfig.columns;
        let clientColumns = !_.isEmpty( dataProvider.cols ) ? _.filter( dataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        exports.updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects(), contextState );
        data.newColumnConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        dataProvider.columnConfig = data.newColumnConfig;
    }
    output.newColumnConfig = data.newColumnConfig;
    output.columnConfig = dataProvider.columnConfig;
    return output;
};

export let updateTreeColumns = async function( dataProvider, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    const promises = [];
    _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
        if( provider.condition( subPanelContext.occContext ) ) {
            promises.push( provider.getClientColumns( dataProvider.columnConfig ) );
        }
    } );
    let output = {};
    var awColumnInfos = [];
    await Promise.all( promises ).then( ( response ) => {
        _.each( response, function( awColumnInfo ) {
            awColumnInfos = awColumnInfos.concat( awColumnInfo );
        } );
        dataProvider.columnConfig.columns = dataProvider.columnConfig.columns.concat( awColumnInfos );
        output.columnConfig = dataProvider.columnConfig;
        deferred.resolve( output );
    } );

    return deferred.promise;
};

/**
 * In case of Saved Working Context in Tree view it can happen so that filter is applied to multiple products.<br>
 * The URL will have filter information only for the active product.<br>
 * If a non-active product is being expanded we check if its information is available in the cache and use it
 */
function updateFilterParamsOnInputForCurrentPciUid( currentPciUid, contextState ) {
    if( !contextState.context.requestPref.calculateFilters ) {
        return structureFilterService
            .computeFilterStringForNewProductContextInfo( currentPciUid );
    }
    return null;
}

/**
 * This is used as a hook for application team to register their handler to add a entry in the overridden properties.
 */
export let registerOverriddenPropertyPolicyHandler = ( handler ) => {
    if( _.isUndefined( OverriddenPropertyPolicyHandlers[ handler.key ] ) ) {
        OverriddenPropertyPolicyHandlers[ handler.key ] = handler;
        return OverriddenPropertyPolicyHandlers[ handler.key ];
    }
};

export let unRegisterOverriddenPropertyPolicyHandler = () => {
    return OverriddenPropertyPolicyHandlers = {};
};

export let updateOverriddenPropertyPolicy = function( overriddenPropertyPolicy, typeToModify, newProperty ) {
    let isTypePresent = false;
    _.forEach( overriddenPropertyPolicy.types, function( type ) {
        if( type.name === typeToModify ) {
            let additionalProps = _.concat( type.properties, newProperty );
            type.properties = additionalProps;
            isTypePresent = true;
        }
    } );

    if( !isTypePresent ) {
        let newBOProperty = {
            name: typeToModify,
            properties: {}
        };

        newBOProperty.properties = newProperty;
        overriddenPropertyPolicy.types.push( newBOProperty );
    }
};

// reset the properties for viewModelObjects as the column config has changed
export let resetDataForSavedColumnConfig = function( operationType, columnConfig, viewModelObjects ) {
    _.forEach( viewModelObjects, function( viewModelObject ) {
        if( viewModelObject ) {
            viewModelObject.props = {};
        }
    } );
    let newColumnConfig = { ...columnConfig };
    if( operationType ) {
        newColumnConfig.operationType = operationType;
    }
    return {
        columnConfig: newColumnConfig
    };
};

/**
 * Function is responsible for loading the properties for newly added columns
 * This will prevent wiping out already loaded columns
 *
 * @param {subPanelContext} subPanelContext
 * @param {columnConfig} columnConfig
 * @param {vMTreeNodes} vMTreeNodes
 * @param {context} context
 * @return {response} response
 */
export let loadDataForSavedColumnConfig = async function( subPanelContext, columnConfig, vMTreeNodes, context ) {
    if( requestQueue.active() === true ) {
        return resetDataForSavedColumnConfig( context.operationType, columnConfig, vMTreeNodes );
    }
    const promises = [];
    _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
        if( provider.condition( subPanelContext.occContext ) ) {
            promises.push( provider.getProperties( vMTreeNodes ) );
        }
    } );

    return await Promise.all( promises ).then( () => {
        return AwPromiseService.instance.resolve( tcViewModelObjectService.getTableViewModelProperties( vMTreeNodes, context ).then( function( response ) {
            // Update the cell template for latest column obtained from getTableViewModelProperties SOA response
            updateColumnPropsAndNodeIconURLs( response.output.columnConfig.columns, vMTreeNodes, subPanelContext );
            response.output.columnConfig.columns = response.output.columnConfig.columns.concat(
                columnConfig.columns.filter( item2 => !response.output.columnConfig.columns.some( item1 => item1.propertyName === item2.propertyName ) ) );
            return response;
        } ) );
    } );
};

/**
 * Function is responsible for loading the properties for given object uids
 *
 * @param {inputElementUids} inputElementUids
 * @param {occContext} occContext
 */
export let updateTableViewModelPropertiesForGivenObjects = function( inputElementUids, vmNodes, context ) {
    var vmtreeNodes = [];
    for( let i = 0; i < inputElementUids.length; i++ ) {
        let vmo = vmNodes.find( vmNode => vmNode.uid === inputElementUids[i] );
        if( vmo ) {
            vmtreeNodes.push( vmo );
        }
    }

    if( vmtreeNodes.length > 0 ) {
        tcViewModelObjectService.getTableViewModelProperties( vmtreeNodes, context );
    }
};

/**
 * Function is responsible to set Summary or Coverage Row
 * Applications need to publish the event setPinRows  with eventdata summaryRow and position information
 *
 * @param {dataProvider} dataProvider
 * @param {eventData} eventData - should have summaryRow and position information
 */
export let setPinRows = ( dataProvider, eventData ) => {
    splmTablePublishedService.setPinRows( dataProvider, eventData.summaryRow, eventData.position );
};

/**
 * Adds the name to the arrange event data
 * @param {Object} eventData - The event data
 * @param {String} name - The name to add
 * @returns {Object} The event data with the name added
 */
export const addNameToArrangeEventData = function( eventData, name ) {
    return {
        ...eventData,
        name: name
    };
};

/**
 * Function is responsible to reset expansion state to collapsed, for the nodes which were expanded under collapse cache
 * This will prevent jittery expansion of the expanded nodes under collapse cache
 *
 * @param {dataProvider} dataProvider
 * @param {declViewModel} declViewModel
 */
export let resetExpansionStateforCollapseCachedNodes = async function( dataProvider, declViewModel ) {
    _.forEach( dataProvider.viewModelCollection.loadedVMObjects, function( vmo ) {
        if( vmo.__expandState ) {
            collapseAllChildren( vmo, declViewModel );
        }
    } );
};


/**
 * Collapses all children of the given node.
 * @param {Object} node - The node to collapse.
 * @param {Object} declViewModel - The declaration view model.
 */
function collapseAllChildren( node, declViewModel ) {
    if ( node ) {
        let children = node.__expandState && node.__expandState.children ? node.__expandState.children : node.children;
        if ( children && children.length > 0 ) {
            children.forEach( child => {
                collapseAllChildren( child, declViewModel );
                _changeNodeStateToCollapsed( child, declViewModel );
            } );
        }
    }
}

var urlAttrs = browserUtils.getUrlAttributes();
_debug_logOccLoadActivity = urlAttrs.logOccLoadActivity !== undefined;

export default exports = {
    updateColumnPropsAndNodeIconURLs,
    loadTreeTableColumns,
    loadTreeTableData,
    loadTreeTableDataPage,
    loadOccurrencesWithFocusInTreeTable,
    loadNextOccurrencesInTreeTable,
    loadPreviousOccurrencesInTreeTable,
    loadTreeTableProperties,
    loadTreeTablePropertiesOnInitialLoad,
    getContextKeyFromParentScope,
    getEffectiveOverriddenPolicy,
    updateDisplayNames,
    processViewModelCollectionEvent,
    populateTreeTableProperties,
    setOccVisibility,
    initialize,
    destroy,
    retainCurrentExpansionState,
    updateOccMgmtTreeTableColumns,
    registerOverriddenPropertyPolicyHandler,
    unRegisterOverriddenPropertyPolicyHandler,
    updateOverriddenPropertyPolicy,
    resetDataForSavedColumnConfig,
    loadTreeTableRows,
    updateTreeColumns,
    loadDataForSavedColumnConfig,
    initializeOccmgmtTree,
    setPinRows,
    addNameToArrangeEventData,
    updateTableViewModelPropertiesForGivenObjects,
    resetExpansionStateforCollapseCachedNodes
};
