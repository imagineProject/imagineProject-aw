// Copyright (c) 2022 Siemens

/**
 * @module js/aceTreeLoadResultBuilderService
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import aceVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import aceTreeTableStateService from 'js/aceTreeTableStateService';
import aceStaleRowMarkerService from 'js/aceStaleRowMarkerService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import awTableStateService from 'js/awTableStateService';
import aceTreeUtils from 'js/aceTreeUtils';
import _ from 'lodash';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import aceTreeOccContextBuilderService from 'js/aceTreeOccContextBuilderService';
import acePartialSelectionService from 'js/acePartialSelectionService';

let treeRespProcessingHandlers = {};

/**
 *
 */
function _buildTreeLoadOutputInfo( treeLoadInput, treeLoadOutput, response, newState, contextState, occContext ) {
    //Values from different sources get copied to treeLoadResult. treeLoadInput, response, ctx etc. That needs unification.
    //We will create treeLoadOutput and copy that into basic treeLoadResult rather than updating basic treeLoadResult at different points.

    //Opened object is assembly/sub-assembly that user has navigated into.
    treeLoadOutput.openedModelObject = cdmSvc.getObject( newState.o_uid );
    treeLoadOutput.openedElement = cdmSvc.getObject( newState.o_uid );
    treeLoadOutput.topElement = cdmSvc.getObject( newState.t_uid );

    //But in case of trees, there is no navigation ( but expansion ). So, openedModelObject is always TopNode/t_uid.
    if( occmgmtUtils.isTreeView() ) {
        treeLoadOutput.openedModelObject = cdmSvc.getObject( newState.t_uid );
    }

    treeLoadOutput.retainTreeExpansionStates = treeLoadInput.retainTreeExpansionStates;
    if( !treeLoadInput.isTopNode ) {
        treeLoadOutput.expandParent = treeLoadInput.expandParent;
    }
    treeLoadOutput.filter = response.filter;

    treeLoadOutput.configContext = {};
    treeLoadOutput.startFreshNavigation = false;
    treeLoadOutput.elementToPCIMap = aceGetOccsResponseService.updateElementToPCIMap( response, contextState );
    treeLoadOutput.isFocusedLoad = treeLoadInput.isFocusedLoad;
    treeLoadOutput.vmNodeCreationStrategy = treeLoadInput.vmNodeCreationStrategy;

    let requestPref = contextState.context.requestPref ? contextState.context.requestPref : {};

    treeLoadOutput.requestPref = {
        savedSessionMode: appCtxSvc.ctx.requestPref ? appCtxSvc.ctx.requestPref.savedSessionMode : 'restore',
        criteriaType: requestPref.criteriaType,
        showUntracedParts: requestPref.showUntracedParts,
        recipeReset: !_.isUndefined( response.requestPref ) && response.requestPref.recipeReset ? response.requestPref.recipeReset[ 0 ] : 'false',
        reloadDependentTabs: !_.isUndefined( response.requestPref ) && response.requestPref.reloadDependentTabs ? response.requestPref.reloadDependentTabs[ 0 ] : undefined,
        windowNotReused: !_.isUndefined( response.requestPref ) && response.requestPref.windowNotReused ? response.requestPref.windowNotReused[ 0 ] : undefined,
        restoreProduct: !_.isUndefined( occContext.transientRequestPref.restoreProduct )
    };

    treeLoadOutput.searchFilterCategories = response.filter.searchFilterCategories;
    treeLoadOutput.searchFilterMap = response.filter.searchFilterMap;
    treeLoadOutput.recipe = response.filter.recipe;
    if( !_.isUndefined( response.requestPref ) && !_.isUndefined( response.requestPref.openedObjectType ) ) {
        treeLoadOutput.openedObjectType = response.requestPref.openedObjectType[ 0 ];
    }

    if( !_.isUndefined( occContext.showTopNode ) ) {
        treeLoadOutput.showTopNode = occContext.showTopNode;
    }
    /**
     *
     * treeLoadInput.isFocusedLoad will be true in requrest to dataProvider if is is focus action ( user searched for something which is not loaded)
     * Other use case is, user opened a structure. So, instead of sending first level, server sent multiple levels around last saved selection.
     * So, this is focus use case but triggered from server side. In this case also, isFocusedLoad should be true.
     */
    var focusChildOccInfo = response.focusChildOccurrence;
    if( !_.isEmpty( focusChildOccInfo.occurrenceId ) && cdmSvc.isValidObjectUid( focusChildOccInfo.occurrenceId ) ) {
        treeLoadOutput.isFocusedLoad = true;
    }

    var pci_uid = newState.pci_uid;

    if( treeLoadInput.skipFocusOccurrenceCheck && contextState.occContext.previousState ) {
        pci_uid = contextState.occContext.previousState.pci_uid;
    }

    treeLoadOutput.productContextInfo = cdmSvc.getObject( pci_uid );
    var isJitterFreeBackBtnSupported = occmgmtUtils.isFeatureSupported( treeLoadOutput.productContextInfo, 'Awb0JitterFreeRefreshBackButton' );

    if( isJitterFreeBackBtnSupported && treeLoadInput.openOrUrlRefreshCase === 'open' && !contextState.occContext.currentState.retainTreeExp ) {
        treeLoadOutput.retainTreeExpansionStatesForOpen = false;
    }

    if( treeLoadOutput?.productContextInfo?.uid?.endsWith( 'AWBIB' ) ) {
        // Stale UID marker is applicable when ACE tree presented indexed structure.
        // We can not rely on feature such as 'Awb0EnableFilterInFullTextSearchFeature' as feature is populated when
        // structure is indexed and user wants to leverage indexed search.
        aceStaleRowMarkerService.updateCtxWithStaleUids( response.requestPref, response.occurrences, response.parentChildrenInfos, occContext );
    }
}

/**
 *
 */
const _setFirstRootPathNodeAsTopModelObjectInOuputStructure = ( treeLoadInput, treeLoadOutput ) => {
    if( treeLoadOutput.rootPathNodes ) {
        var topNode = _.first( treeLoadOutput.rootPathNodes );
        /**
         * Earlier we used to build tree level by level. So, when level 0 was built last, topModelObject and
         * baseModelObject were set to RootNode.As we are processing all levels in one call, that is not
         * taking place. Ideally, when we are rendering levels, at each level topModelObject and
         * baseModelObject should be RootNode.
         */
        if( treeLoadInput.parentNode.levelNdx === -1 ) {
            treeLoadOutput.topModelObject = cdmSvc.getObject( topNode.uid );
            treeLoadOutput.baseModelObject = cdmSvc.getObject( topNode.uid );
            treeLoadOutput.openedModelObject = cdmSvc.getObject( topNode.uid );
        }
    }
};


/*
 */
function _updateChildrenOfRootPathNode( treeLoadInput, treeLoadOutput, childVMNodes ) {
    if( !_.isUndefined( treeLoadOutput.rootPathNodes ) && !_.isEmpty( treeLoadOutput.rootPathNodes ) ) {
        // We are here because we have single parent-children recieved in response.
        // In such scenario, framework explicitly checks if UIDs are changed between input parent node and rootPathNode
        // and based on that, takes decision whether to update children to parent node or root path node.
        // But with delta response or cases line restore from 'Global( Latest Working )' to 'Latest Working',
        // since the uids are going to remain same, root path node does not get updated for children property
        // correctly. This results in jitter for successive actions.
        // To tackle the issue, we are updating the children of root path node upfront.
        var lastNode = _.last( treeLoadOutput.rootPathNodes );
        if( !_.isUndefined( lastNode ) && treeLoadInput.parentNode.uid === lastNode.uid ) {
            lastNode.children = _.clone( childVMNodes );
        }
    }
}

/**
 */
function _createChildOccurrences( treeLoadInput, treeLoadOutput, response, newState, declViewModel, contextState, levelNdx, vmNodeStates, isTopNode ) {
    var vmNodes = [];

    if( !_.isEmpty( response.parentChildrenInfos ) ) {
        // There is a possibility of non root path data being sent from server. Validate and set the flag here.
        _setFirstRootPathNodeAsTopModelObjectInOuputStructure( treeLoadInput, treeLoadOutput );
        var parentNodeUnderAction = treeLoadOutput.rootPathNodes ? treeLoadOutput.rootPathNodes[ 0 ].uid : treeLoadInput.parentElement;

        treeLoadOutput.vmNodesInTreeHierarchyLevels = [];
        treeLoadOutput.nonRootPathHierarchicalData = true;

        if( !_.isUndefined( declViewModel ) ) {
            vmNodes = aceVMTNodeCreateService.populateViewModelTreesNodesInTreeHierarchyFormatForTopDown( treeLoadInput, treeLoadOutput, response, declViewModel );

            if( treeLoadOutput.vmNodesInTreeHierarchyLevels ) {
                _updateVMNodesWithChildrenAndCountInformation( treeLoadInput, treeLoadOutput, declViewModel, vmNodeStates );
                vmNodes = getVMNodeChildren( treeLoadOutput.vmNodesInTreeHierarchyLevels, parentNodeUnderAction );
            }
        }
    } else {
        var childOccInfos = [];
        if( !_.isEmpty( response.occurrences ) ) {
            childOccInfos = response.occurrences;
        }
        // TODO - below code still not provide jitter free behaviour in case of SWC, we need to revisit it.
        levelNdx = treeLoadOutput.showTopNode && isTopNode ? 1 : levelNdx; // children of top node will be at first level
        vmNodes = aceVMTNodeCreateService.createVMNodesForGivenOccurrences( childOccInfos, levelNdx, newState.pci_uid, treeLoadOutput.elementToPCIMap,
            null, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
        _updateChildrenOfRootPathNode( treeLoadInput, treeLoadOutput, vmNodes );
    }

    return vmNodes;
}

var setExpansionStateForNode = function( treeLoadInput, vmNode, declViewModel, dataProvider, expandBelowModeState ) {
    if( vmNode.$$treeLevel >= treeLoadInput.levelsApplicableForExpansion ) {
        var vmoIndex = dataProvider.viewModelCollection.findViewModelObjectById( vmNode.uid );
        var node = dataProvider.viewModelCollection.getViewModelObject( vmoIndex );
        //Restoring nodes from collapseCache on Expand Below/Expand To Level is done in
        //in expand below service itself now. This code is not needed in that case
        // if( !node ) {
        //     var nodeFoundInCache = _.find( expandBelowModeState.parentsToLookInto, function( cachedNode ) {
        //         return cachedNode.uid === vmNode.uid;
        //     } );
        //     if( nodeFoundInCache && !nodeFoundInCache.isLeaf && nodeFoundInCache.__expandState ) {
        //         vmNode.__expandState = nodeFoundInCache.__expandState;
        //         node = nodeFoundInCache;
        //     }
        // }
        aceExpandBelowService.collapseNodeHierarchy( {
            data: declViewModel,
            row: node ? node : vmNode
        } );
    } else {
        _.assign( vmNode, expandBelowModeState );
        aceTreeTableStateService.addNodeToExpansionState( vmNode, declViewModel );
    }
};

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} treeLoadOutput VMTreeNodes
 * @param {*} declViewModel declarative viewModel
 * @param {*} expandBelowModeState Flags to Assign
 */
function _updateVMNodesWithChildrenAndCountInformation( treeLoadInput, treeLoadOutput, declViewModel, expandBelowModeState ) {
    var vmNodesInTreeHierarchyLevels = treeLoadOutput.vmNodesInTreeHierarchyLevels;
    var dataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
    for( var ndx = 0; ndx < vmNodesInTreeHierarchyLevels.length; ndx++ ) {
        for( var cdx = 0; cdx < vmNodesInTreeHierarchyLevels[ ndx ].length; cdx++ ) {
            var viewModelTreeNode = vmNodesInTreeHierarchyLevels[ ndx ][ cdx ];
            if( !viewModelTreeNode.isLeaf ) {
                var children = getVMNodeChildren( vmNodesInTreeHierarchyLevels, viewModelTreeNode.uid );
                if( children && children.length > 0 ) {
                    viewModelTreeNode.children = _.clone( children );
                    viewModelTreeNode.isExpanded = true;
                    viewModelTreeNode.totalChildCount = children.length;
                } else if( !_.isEmpty( expandBelowModeState ) ) {
                    setExpansionStateForNode( treeLoadInput, vmNodesInTreeHierarchyLevels[ ndx ][ cdx ], declViewModel, dataProvider, expandBelowModeState );
                }else{
                    // Case: When for a node, all children are configured out and delta response sends all its children in deleteObjectUids array
                    // then no children will be present in vmNodesInTreeHierarchy levels, so we do need to clear the children structure of the node
                    // as the parent may not be in the updatedObjectUids list and no additional getOcc SOA is called to update children. In this scenario,
                    // if children are not updated then 'Collapse Below' action uses the children structure to update the cache and on 'Expand Below' deleted
                    // nodes are shown again
                    viewModelTreeNode.children = [];
                }
            }
        }
    }
}

var getVMNodeChildren = function( vmNodesInTreeHierarchyLevels, uid ) {
    for( var ndx = 0; ndx < vmNodesInTreeHierarchyLevels.length; ndx++ ) {
        for( var cdx = 0; cdx < vmNodesInTreeHierarchyLevels[ ndx ].length; cdx++ ) {
            if( vmNodesInTreeHierarchyLevels[ ndx ][ cdx ].parentUid === uid ) {
                return vmNodesInTreeHierarchyLevels[ ndx ];
            }
        }
    }

    return [];
};

var exports = {};

/**
 */
const _getCursorObjectForInputParentNode = ( response, parentUid ) => {
    var cursorObject = response.cursor;
    if( !_.isEmpty( response.parentChildrenInfos ) ) {
        for( let i = 0; i < response.parentChildrenInfos.length; i++ ) {
            if( _.isEqual( response.parentChildrenInfos[ i ].parentInfo.occurrenceId, parentUid ) ) {
                cursorObject = response.parentChildrenInfos[ i ].cursor;
                break;
            }
        }
    }

    return cursorObject;
};

//If server has returned no value i.e empty, in the current request, then client will retain the previous value on occContext.
//But in case of Recipe and readOnlyFeatures, if server has returned no value i.e empty, client will always update the new values on occContext.
const updateOccContextValueWithProvidedInput = ( treeLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterAction, copyDefaultValue ) => {
    if( valuesToCopyOrUpdateOccContext ) {
        let paramsToPopulateIfEmpty = [ 'recipe', 'readOnlyFeatures' ];
        _.forEach( valuesToCopyOrUpdateOccContext, function( value, name ) {
            //Structures might not come with every initializeAction response. like displayToggleOptions.
            //We need to retain existing ones in that case.
            if( !_.isNull( treeLoadOutput[ name ] ) && !_.isEmpty( treeLoadOutput[ name ] ) || _.isBoolean( treeLoadOutput[ name ] ) || _.isNumber( treeLoadOutput[ name ] ) ||
                paramsToPopulateIfEmpty.indexOf( name ) > -1 ) {
                occContextValue[ name ] = treeLoadOutput[ name ];
            } else {
                if( copyDefaultValue ) {
                    occContextValue[ name ] = valuesToCopyOrUpdateOccContext[ name ];
                }
            }
        } );
    }

    if( valuesToResetAfterAction ) {
        _.forEach( valuesToResetAfterAction, function( value, name ) {
            occContextValue[ name ] = value;
        } );
    }
};

let _updateGlobalStateInformation = function( treeLoadOutput, finalOccContextValue, viewKey ) {
    //selectedModelObjects: {}, ( cleanup?)
    //showTopNode: true, ( cleanup?)
    //vmc: {},
    //treeDataProvider: {},
    //isRestoreOptionApplicableForProduct: false,
    //defaultOpenStateMessageTime: {},
    //defaultOpenStateMessage: {},
    // "ctx.occmgmtContext.modelObject": "result.treeLoadResult.baseModelObject",
    // "ctx.occmgmtContext.productContextInfo": "result.treeLoadResult.productContextInfo",
    // "ctx.occmgmtContext.serializedRevRule": "result.treeLoadResult.serializedRevRule",
    // "ctx.occmgmtContext.openedElement": "result.treeLoadResult.openedModelObject",
    // "ctx.occmgmtContext.topElement": "result.treeLoadResult.topModelObject",
    // "ctx.occmgmtContext.sublocationAttributes": "result.treeLoadResult.sublocationAttributes",
    // "ctx.occmgmtContext.autoSavedSessiontime": "result.treeLoadResult.autoSavedSessiontime",
    // "ctx.occmgmtContext.searchFilterCategories": "result.treeLoadResult.filter.searchFilterCategories",
    // "ctx.occmgmtContext.searchFilterMap": "result.treeLoadResult.filter.searchFilterMap",
    // "ctx.occmgmtContext.recipe": "result.treeLoadResult.filter.recipe",
    // "ctx.occmgmtContext.sourceContextToInfoMap": "result.treeLoadResult.sourceContextToInfoMap",
    // "ctx.occmgmtContext.requestPref": "result.treeLoadResult.requestPref",
    // "ctx.occmgmtContext.configContext": "result.treeLoadResult.configContext",
    // "ctx.occmgmtContext.startFreshNavigation": "result.treeLoadResult.startFreshNavigation",
    // "ctx.occmgmtContext.elementToPCIMap": "result.treeLoadResult.elementToPCIMap",
    // "ctx.occmgmtContext.vmc": "result.treeLoadResult.vmc",
    // "ctx.occmgmtContext.treeDataProvider": "result.treeLoadResult.treeDataProvider",
    // "ctx.occmgmtContext.isChangeEnabled": "result.treeLoadResult.isChangeEnabled",
    // "ctx.occmgmtContext.sublocation.clientScopeURI":"result.treeLoadResult.productContextInfo.props.awb0ClientScopeUri.dbValues[0]",

    let lastSelectedObject = cdmSvc.getObject( finalOccContextValue.currentState.c_uid );
    let productInfo = aceDataNavigatorService.getProductInfoForCurrentSelection( lastSelectedObject, finalOccContextValue );
    let valuesToCopyOrUpdateOnCtxFinal = {
        modelObject: treeLoadOutput.baseModelObject,
        productContextInfo: {}, //"result.treeLoadResult.productContextInfo",
        serializedRevRule: undefined, //"result.treeLoadResult.serializedRevRule",
        openedElement: {}, //"result.treeLoadResult.openedModelObject",
        topElement: {}, //"result.treeLoadResult.topModelObject",
        sublocationAttributes: {}, //"result.treeLoadResult.sublocationAttributes",
        autoSavedSessiontime: {}, //"result.treeLoadResult.autoSavedSessiontime",
        searchFilterCategories: [], //"result.treeLoadResult.filter.searchFilterCategories",
        searchFilterMap: undefined, //"result.treeLoadResult.filter.searchFilterMap",
        recipe: [], //"result.treeLoadResult.filter.recipe",
        //sourceContextToInfoMap:{}, //"result.treeLoadResult.sourceContextToInfoMap", This is going on atomic data
        requestPref: {}, //"result.treeLoadResult.requestPref",
        configContext: {}, //"result.treeLoadResult.configContext",
        startFreshNavigation: {}, //"result.treeLoadResult.startFreshNavigation",
        elementToPCIMap: undefined, //"result.treeLoadResult.elementToPCIMap",
        vmc: {}, //"result.treeLoadResult.vmc",
        treeDataProvider: {}, //"result.treeLoadResult.treeDataProvider",
        supportedFeatures: {},
        readOnlyFeatures: {},
        isOpenedUnderAContext: {},
        workingContextObj: null,
        currentState: {},
        previousState: {},
        isChangeEnabled: undefined, //"result.treeLoadResult.isChangeEnabled",
        sublocation: {
            clientScopeURI: treeLoadOutput?.productContextInfo?.props?.awb0ClientScopeUri ? treeLoadOutput?.productContextInfo?.props?.awb0ClientScopeUri?.dbValues[ 0 ] : ''
        }
    };

    let valuesToCopyOrUpdateOnCtx = {
        configContext: {},
        startFreshNavigation: false,
        treeLoadingInProgress: false,
        requestPref: {},
        vmc: {},
        treeDataProvider: {},
        previousState: {},
        currentState: {},
        supportedFeatures: {},
        readOnlyFeatures: {},
        isOpenedUnderAContext: {},
        pwaSelection: {}
    };
    let currentContextValue = {};
    updateOccContextValueWithProvidedInput( treeLoadOutput, currentContextValue, valuesToCopyOrUpdateOnCtx, undefined, true );

    let vmc = {
        getLoadedViewModelObjects: treeLoadOutput.vmc.getLoadedViewModelObjects,
        findViewModelObjectById: treeLoadOutput.vmc.findViewModelObjectById,
        name: treeLoadOutput.vmc.name,
        getViewModelObject: treeLoadOutput.vmc.getViewModelObject,
        update: treeLoadOutput.vmc.update
    };

    let treeDataProvider = {
        update: treeLoadOutput.treeDataProvider.update, //CRUD commands
        selectionModel: treeLoadOutput.treeDataProvider.selectionModel, //compare, occmgmtjs
        getSelectedObjects: treeLoadOutput.treeDataProvider.getSelectedObjects, //occmgmtjs,architecturemodeler
        editContext: treeLoadOutput.treeDataProvider.editContext, //mbm/easyplan
        columnConfig: treeLoadOutput.treeDataProvider.columnConfig //Smr1CreateRecordUtilizationViewModel.json
    };

    currentContextValue.vmc = vmc;
    currentContextValue.treeDataProvider = treeDataProvider;

    currentContextValue.rootElement = productInfo.rootElement;
    occmgmtUtils.updateValueOnCtxOrState( '', currentContextValue, viewKey );

    //direct updates in ctx should be moved to this call ( instead of doing it via <tree>viewModel.json).
    let ctxStateToUpdate = {
        isRedLineMode: treeLoadOutput.isRedLineMode,
        changeContext: treeLoadOutput.changeContext
    };

    //logic to make sure that aceSessionInitialized is set to true when both views are loaded.
    if ( finalOccContextValue && finalOccContextValue.persistentRequestPref && finalOccContextValue.persistentRequestPref.splitMode === 'true' ) {
        if( appCtxSvc.ctx.aceSessionInitalized === undefined ) {
            ctxStateToUpdate.aceSessionInitalized = 'oneViewInitialized'; //after loading first view, set only one prop to undefined.
        }else{
            ctxStateToUpdate.aceSessionInitalized = true;
        }
    }else{
        ctxStateToUpdate.aceSessionInitalized = true;
    }

    appCtxSvc.updateCtxFromObject( ctxStateToUpdate );
};


/**
 *
 * @param {*} occContextValue OccContextValue
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 */
function _buildResponseForPreviousAction( occContextValue, treeLoadOutput, finalOccContextValue ) {
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;

    let valuesToResetAfterPreviousAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {}
    };
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, undefined, valuesToResetAfterPreviousAction );
}

/**
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} uwDataProvider Tree Data ProviderSt
 * @param {*} vmNodeStates State to be added on VMNode during creation
 * @param {*} response GetOccurrences() response
 * @param {*} vmNodes VMNodes if already created
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} contextState context state
 * @param {*} occContextValue OccContextValue
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
function _buildResponseForNextAction( treeLoadOutput, treeLoadInput, uwDataProvider, vmNodeStates, response, vmNodes, declViewModel, occContextValue, finalOccContextValue, inputoccContext ) {
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = true;
    // TODO : Below line can be removed once product will be added to sessionStorage on command interaction.
    // In Angular, we were listening to 'aw-command-logEvent'event. its not fired in BA.
    treeLoadOutput.isRestoreOptionApplicableForProduct = aceRestoreBWCStateService.addOpenedProductToSessionStorage( treeLoadInput, treeLoadOutput, uwDataProvider, inputoccContext );

    if( treeLoadInput.expandBelow ) {
        aceTreeUtils.updateNewTopNodeRelatedInformation( treeLoadInput, treeLoadOutput );
        vmNodeStates.isInExpandBelowMode = true;
    } else {
        treeLoadOutput.vmNodesInTreeHierarchyLevels = [];
        aceTreeUtils.buildRootPathNodes( inputoccContext, treeLoadOutput, response, undefined );
        vmNodes = aceVMTNodeCreateService.populateViewModelTreesNodesInTreeHierarchyFormatForTopDown( treeLoadInput, treeLoadOutput, response, declViewModel );

        //need to try uncommenting below.next action, except expand below, wont have hierarchial data
        //delete treeLoadOutput.nonRootPathHierarchicalData;
        delete treeLoadOutput.vmNodesInTreeHierarchyLevels;
        delete treeLoadOutput.rootPathNodes;
    }
    //"ctx.occmgmtContext.elementToPCIMap"  should be part focusAction now.
    //"ctx.occmgmtContext.productContextInfo" should be part focusAction now.
    //"ctx.occmgmtContext.recipe"
    //"ctx.occmgmtContext.requestPref"
    //_buildTreeLoadOutputForNextAction();
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterNextAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {}
    };
    let valuesToCopyOrUpdateOccContext = undefined;
    if( occContextValue.transientRequestPref.nodeToExpandAfterFocus ) {
        //reimposing existing selections if nodeToExpandAfterFocus is present ( )
        valuesToCopyOrUpdateOccContext = {
            pwaSelection: {}
        };
    }
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterNextAction );
    return vmNodes;
}

let _populateObjectsToSelectInfo = function( newState, treeLoadOutput, objectsToFocusOn, contextState, gridId, lastDpAction ) {
    let currentSelections = contextState.occContext.pwaSelection;
    if( objectsToFocusOn ) {
        treeLoadOutput.pwaSelection = objectsToFocusOn;
    } else {
        let selectedObj = cdmSvc.getObject( newState.c_uid );
        if( selectedObj ) {
            let highlightedObj = cdmSvc.getObject( newState.h_uid );
            if( highlightedObj && highlightedObj.uid !== selectedObj.uid ) {
                var partialSelectionData = {
                    objectsToSelect:[ { uid:newState.c_uid } ],
                    objectsToHighlight:[ { uid:newState.h_uid } ],
                    viewToReact: contextState.key
                };
                acePartialSelectionService.setPartialSelection( partialSelectionData, gridId );
            }

            /*If there are multiple selections already in system and focusAction call has taken place,
              its case incremental add of new selection..So new selection should be added into existing set of selections.
            */
            if ( lastDpAction === 'focusAction' && currentSelections.length > 1 ) {
                currentSelections[currentSelections.length] = selectedObj;
                currentSelections = [ ...new Map( currentSelections.map( item => [ JSON.stringify( item ), item ] ) ).values() ];
                treeLoadOutput.pwaSelection = currentSelections;
            }else {
                treeLoadOutput.pwaSelection = [ selectedObj ];
            }
        }
    }
};

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 *
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
export let processGetOccurrencesResponse = function( treeLoadInput, response, contextState, declViewModel, uwDataProvider, soaInput, inputOccContext, pageContext ) {
    let occContextValue = contextState.occContext;
    let treeLoadOutput = {
        displayToggleOptions: {},
        configContext: {},
        supportedFeatures: {},
        readOnlyFeatures: {}
    };

    let parentNode = treeLoadInput.parentNode;
    let isTopNode = parentNode.levelNdx === -1;
    let cursorObject = _getCursorObjectForInputParentNode( response, treeLoadInput.parentNode.uid );
    //Child Level should be parent level plus one.
    let childOccsCreationLevelNdx = treeLoadInput.parentNode.levelNdx + 1;
    treeLoadOutput.occurrences = response.occurrences;

    let treeLoadResult;
    let vmNodes = {};
    let newState = aceGetOccsResponseService.getNewStateFromGetOccResponse( response, contextState, soaInput, uwDataProvider, treeLoadInput );
    let syncState = aceContextStateMgmtService.createSyncState( contextState.occContext, newState );
    let finalOccContextValue = {};
    let vmNodeStates = {};

    treeLoadOutput.currentState = syncState.currentState;
    treeLoadOutput.previousState = syncState.previousState;
    _buildTreeLoadOutputInfo( treeLoadInput, treeLoadOutput, response, newState, contextState, occContextValue );

    /**
     * Build reuse VMNode strategy in case of delta response.
     * reuseVMNode = true ==> When we get delta response, we try to re-use view model nodes as they are not changed.
     * clearExpandState = true ==> The collapse cache may be invalid after config change.
     * staleVMNodeUids = [] ==> Array of VMNodes which are updated at server and its properties needs reevaluation.
     */

    if( response.requestPref && response.requestPref.deltaTreeResponse &&
        response.requestPref.deltaTreeResponse[ 0 ].toLowerCase() === 'true' && !_.isUndefined( contextState.context.vmc ) ) {
        treeLoadOutput.vmNodeCreationStrategy = {
            reuseVMNode: true,
            clearExpandState: true,
            staleVMNodeUids: []
        };

        // LCS-698825 -When we have large number of updated objects servicedata is bloated
        // mark updated objects as stale and rely on getTableViewModelProperties to fetch columns properties.
        if( !_.isUndefined( response.requestPref.updatedObjectUids ) ) {
            treeLoadOutput.vmNodeCreationStrategy.staleVMNodeUids = response.requestPref.updatedObjectUids;
        }
    }

    // if we know we are going to reuse the VMNode then create a mapping of uids to VMO for performance purpose.
    if( !_.isUndefined( treeLoadOutput.vmNodeCreationStrategy ) && treeLoadOutput.vmNodeCreationStrategy.reuseVMNode ) {
        var loadVMObjectUidsMap = new Map();
        _.forEach( inputOccContext.vmc.getLoadedViewModelObjects(), function( loadedVMObject ) {
            loadVMObjectUidsMap.set( loadedVMObject.uid, loadedVMObject );
        } );
        treeLoadOutput.vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap = loadVMObjectUidsMap;
    }

    var gridId = Object.keys( declViewModel.grids )[ 0 ];

    _populateObjectsToSelectInfo( newState, treeLoadOutput, response.objectsToFocusOn, contextState, gridId, treeLoadInput.dataProviderActionType );

    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        finalOccContextValue = aceTreeOccContextBuilderService.buildOccContextValForInitializeAction( treeLoadInput, treeLoadOutput,
            declViewModel, response, contextState, uwDataProvider, occContextValue, inputOccContext, pageContext );

        //Case of empty structure and we want to show TopNode in UI. Happens only in initializeAction.
        if( !_.isEmpty( treeLoadOutput.topNodeOccurrence ) ) {
            vmNodes = aceVMTNodeCreateService.createVMNodesForGivenOccurrences( treeLoadOutput.topNodeOccurrence, childOccsCreationLevelNdx,
                newState.pci_uid, treeLoadOutput.elementToPCIMap, null, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
        } else {
            // To support jitter free tree display upon configuration and filter change, build rootPathNodes
            // with first parent in parentChildrenInfos in getOcc SOA  response.
            if( _.isUndefined( treeLoadOutput.rootPathNodes ) && !_.isEmpty( response.parentChildrenInfos ) ) {
                var occurrenceId = response.parentChildrenInfos[ 0 ].parentInfo.occurrenceId;
                aceTreeUtils.buildRootPathNodes( inputOccContext, treeLoadOutput, response, occurrenceId );
            }
        }
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'focusAction' ) || treeLoadInput.focusLoadAction === true ) {
        /*
         isTopNode condition below is cleanup candidate. Currently it performs sync selection.
         For focus case, sync selection is not needed. Its already done prior to focusAction call.
         */
        isTopNode = false;
        vmNodes = aceTreeOccContextBuilderService.buildResponseForFocusAction( occContextValue, vmNodes, treeLoadOutput, declViewModel, response, treeLoadInput, finalOccContextValue, inputOccContext );
        finalOccContextValue.lastDpAction = 'focusAction';

        let isFocusSelectionFromVis = contextState.context && contextState.context.transientRequestPref && contextState.context.transientRequestPref.focusSelectionFromViz;

        if( isFocusSelectionFromVis ) {
            finalOccContextValue.lastDpAction = 'focusActionForSelectionFromVis';
        }
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'nextAction' ) && treeLoadInput.focusLoadAction !== true ) {
        //For expand below, actionType is 'nextAction'.
        vmNodes = _buildResponseForNextAction( treeLoadOutput, treeLoadInput, uwDataProvider, vmNodeStates, response, vmNodes, declViewModel, occContextValue, finalOccContextValue, inputOccContext );
        finalOccContextValue.lastDpAction = 'nextAction';
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'previousAction' ) ) {
        //"ctx.occmgmtContext.recipe":
        //"ctx.occmgmtContext.requestPref"
        //_buildTreeLoadOutputForPreviousAction() );
        _buildResponseForPreviousAction( occContextValue, treeLoadOutput, finalOccContextValue );
        finalOccContextValue.lastDpAction = 'previousAction';
    }
    if( response.requestPref && response.requestPref.deltaTreeResponse &&
        response.requestPref.deltaTreeResponse[ 0 ].toLowerCase() === 'true' && !_.isUndefined( contextState.context.vmc ) ) {
        // mark deleted objects expansion state in local storage as collapse.
        var vmNodesMarkedForDeletion = _.filter( inputOccContext.vmc.getLoadedViewModelObjects(), function( vmNode ) {
            return vmNode.markForDeletion;
        } );
        var gridId = Object.keys( declViewModel.grids )[ 0 ];
        _.forEach( vmNodesMarkedForDeletion, function( vmNodeToBeDeleted ) {
            if( vmNodeToBeDeleted && vmNodeToBeDeleted.isExpanded ) {
                awTableStateService.saveRowCollapsed( declViewModel, gridId, vmNodeToBeDeleted );
                delete vmNodeToBeDeleted.isExpanded;
            }
        } );
    }

    // Set contextKey on treeLoadInput
    treeLoadInput.contextKey = inputOccContext.viewKey;

    if( _.isEmpty( vmNodes ) ) {
        vmNodes = _createChildOccurrences( treeLoadInput, treeLoadOutput, response, newState, declViewModel, childOccsCreationLevelNdx, vmNodeStates, isTopNode );
    }

    _.each( treeRespProcessingHandlers, function( handler ) {
        if( handler.condition( soaInput, treeLoadInput, treeLoadOutput, inputOccContext, response ) ) {
            handler.addOccContextAtomicDataForUpdate( response, finalOccContextValue, inputOccContext, treeLoadOutput, treeLoadInput, soaInput );
        }
    } );

    if( response.requestPref && response.requestPref.ignoreIndexForPCIs ) {
        finalOccContextValue.persistentRequestPref.ignoreIndexForPCIs = response.requestPref.ignoreIndexForPCIs;
    }

    /*kulkaamo : For Sesssion case, baseModelObject gets populated in _setFirstRootPathNodeAsTopModelObjectInOuputStructure
    //By that first finalOccContextValue is built n baseModelObject is missing on that. This use case has started failing from 9th Feb.
    Updating it separately for now. Will see how to handle it in _buildResponseForInitializeAction later.
    */
    if( !finalOccContextValue.baseModelObject && treeLoadOutput.baseModelObject ) {
        finalOccContextValue.baseModelObject = treeLoadOutput.baseModelObject;
    }

    /**
     * Create occs and a basic treeLoadResult
     */
    treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, cursorObject.startReached, cursorObject.endReached, treeLoadOutput.newTopNode );

    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        _updateGlobalStateInformation( treeLoadOutput, finalOccContextValue, inputOccContext.viewKey );
    }

    occmgmtUtils.updateValueOnCtxOrState( '', finalOccContextValue, inputOccContext );
    _.forEach( treeLoadOutput, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            treeLoadResult[ name ] = value;
        }
    } );

    treeLoadResult.parentNode.cursorObject = cursorObject;
    return treeLoadResult;
};

export let registerOccContextAtomicDataProvider = ( handler ) => {
    treeRespProcessingHandlers[ handler.key ] = handler;
    return treeRespProcessingHandlers[ handler.key ];
};

export let unregisterOccContextAtomicDataProvider = ( handler ) => {
    return delete treeRespProcessingHandlers[ handler.key ];
};

export default exports = {
    processGetOccurrencesResponse,
    registerOccContextAtomicDataProvider,
    unregisterOccContextAtomicDataProvider
};


