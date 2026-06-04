// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/PmiToolService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import pmiToolUtil from 'js/pmiToolUtil';
import modelPropertySvc from 'js/modelPropertyService';
import viewerContextService from 'js/viewerContext.service';
import viewerPmiManager from 'js/viewerPmiManagerProvider';
import _ from 'lodash';
import logger from 'js/logger';
import AwTimeoutService from 'js/awTimeoutService';
import uwPropertySvc from 'js/uwPropertyService';
import iconSvc from 'js/iconService';

var exports = {};
let _timeOutPromiseSelected = [];
let ignoreTypesValueChangeProcessingAsMVChanged = false;
let ignoreListenerIfSelectedFromPMITree = false;


/**
 * Handle tab selection change
 *
 * @param {Object} viewModel view model
 * @param {Object} modelViewState fetch modelViewState
 * @param {Object} entitiesState fetch pmiDataState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructureDataState leaf structure atomic data
 */
export let handleTabSelectionChange = function( viewModel, modelViewState, entitiesState, pmiRawEntityState, viewerContextData, leafStructureDataState ) {
    let newModelViewState = { ...modelViewState.getValue() };
    newModelViewState.modelViewNextPrevStateIndex = -1;
    modelViewState.update( newModelViewState );
    if( viewModel && viewModel.tabModels && viewModel.tabModels[ 0 ].selectedTab ) {
        viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX, 0 );
        exports.updateMVTabViewModel( viewModel.modelViewDetails, modelViewState, pmiRawEntityState );
        //call MV update
    } else if( viewModel && viewModel.tabModels && viewModel.tabModels[ 1 ].selectedTab ) {
        viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX, 1 );
        //Call Pmi entity updated
        exports.updateTypesTabViewModel( entitiesState, pmiRawEntityState );
    }

    if( Array.isArray( viewModel.tabModels ) && viewModel.tabModels[ 2 ] && viewModel.tabModels[ 2 ].selectedTab ) {
        //viewerContextData.getViewerLeafStructureMgr().setupLeafStructureDataOnReveal( leafStructureDataState );
        viewerContextData.getViewerLeafStructureMgr().enableSubNode( true ).then( ()=>{
            viewerContextData.getViewerLeafStructureMgr().setupLeafStructureDataOnReveal( leafStructureDataState );
        } ).catch( error => {
            logger.error( 'Failed to load leaf structure data : ' + error );
        } );
    } else {
        viewerContextData.getViewerLeafStructureMgr().cleanUpLeafStructure();
    }
};

/**
 * Fetch leaf structure data
 * @param {Object} viewerContextData viewer context data
 * @param {object} parentNode parent node
 * @returns {Promise} A promise that resolves with leaf structure data
 */
export let fetchLeafStructureData = ( viewerContextData, parentNode ) => {
    return viewerContextData.getViewerLeafStructureMgr().fetchLeafStructureData( parentNode );
};

/**
 * Select leaf structure tab
 * @param {Object} tabModels tab models
 */
export let selectLeafStructureTab = ( tabModels ) => {
    if( Array.isArray( tabModels ) ) {
        tabModels.forEach( tab => {
            tab.selectedTab = tab.tabkey === 'leafStructureTab';
        } );
    }
};

/**
 * Clear leaf structure data
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructDataProvider leaf structure data provider
 */
export let clearLeafStructDataProvider = ( viewerContextData, leafStructDataProvider ) => {
    leafStructDataProvider.resetCollapseCache();
    leafStructDataProvider.restoreInitialCacheCollapseState();
    leafStructDataProvider.resetDataProvider();
    viewerContextData.getViewerLeafStructureMgr().updateCtxWithCurrentSelection();
};

/**
 * Perform selection in leaf structure tree
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructDataProvider leaf structure data provider
 */
export let selectInLeafStructTree = ( viewerContextData, leafStructDataProvider ) => {
    viewerContextData.getViewerLeafStructureMgr().selectInLeafStructTree( leafStructDataProvider );
};

/**
 * Perform selection in leaf structure tree for newly added nodes
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructDataProvider leaf structure data provider
 * @param {Object} eventData event data
 */
export let selectFromNewlyLoadedNodesInLeafStructTree = ( viewerContextData, leafStructDataProvider, eventData ) => {
    viewerContextData.getViewerLeafStructureMgr().selectFromNewlyLoadedNodesInLeafStructTree( leafStructDataProvider, eventData );
};

/**
 * This function is responsible for tree node loading and pagination of the data.
 *
 * @param {ObjectArray} result response from GET call
 * @param {Object} nodeBeingExpanded The node being expanded
 * @param {Object} viewerContextData viewer context data
 *
 * @return {Object}  paginated tree data
 */
export let processLeafNodeData = function( result, nodeBeingExpanded, viewerContextData ) {
    var treeData = result.data;
    var response;
    let leafStructDataToExpandAndFocus = viewerContextData.getViewerLeafStructureMgr().leafStructDataToExpandAndFocus ? viewerContextData.getViewerLeafStructureMgr().leafStructDataToExpandAndFocus : [];
    let isNavigateSelectionOn = viewerContextData.getViewerLeafStructureMgr().isNavigateSelectionOn;
    let nodesToExpandInTree = [];

    for ( let index = 0; index < leafStructDataToExpandAndFocus.length; index++ ) {
        const element = leafStructDataToExpandAndFocus[index];
        if( element.theJtPropNames && Array.isArray( element.theJtPropNames ) && element.theJtPropNames.length > 0 ) {
            nodesToExpandInTree.push( ...element.theJtPropNames );
        }
    }

    let vmNodesInTreeHierarchyLevels = [ {} ];
    let expandedChildren = [];

    var expandChildren = function( parentNodeToExpand ) {
        expandedChildren = treeData[ parentNodeToExpand.uid ];
        vmNodesInTreeHierarchyLevels.push( expandedChildren );

        _.forEach( expandedChildren, function( childNode ) {
            childNode.id = childNode.uid;
            childNode.levelNdx = parentNodeToExpand.levelNdx + 1;
            if (
                childNode.isLeaf === false && childNode.occ &&
                    (
                        childNode.occ.type === 1 ||
                            childNode.occ.type === 9 &&
                            Array.isArray( childNode.occ.theJtPropNames ) &&
                            childNode.occ.theJtPropNames.length > 0 &&
                            nodesToExpandInTree.includes( childNode.occ.theJtPropNames[childNode.occ.theJtPropNames.length - 1] )
                    )
            ) {
                childNode.isExpanded = true;
                expandChildren( childNode );
            }
        } );
    };
    if( ( nodeBeingExpanded.id === 'leafStructTop' || nodesToExpandInTree.isLeaf === false ) && nodesToExpandInTree.length > 0 && isNavigateSelectionOn ) {
        response = treeData[ nodeBeingExpanded.uid ];
        nodeBeingExpanded.isExpanded = true;
        expandChildren( nodeBeingExpanded );
        return {
            parentNode: nodeBeingExpanded,
            childNodes: response,
            totalChildCount: response.length,
            startChildNdx: 0,
            nonRootPathHierarchicalData: true,
            mergeNewNodesInCurrentlyLoadedTree: nodeBeingExpanded.id !== 'leafStructTop',
            vmNodesInTreeHierarchyLevels: vmNodesInTreeHierarchyLevels,
            rootPathNodes: []
        };
    }
    response = treeData[ nodeBeingExpanded.uid ];
    _.forEach( response, function( treeNode ) {
        treeNode.id = treeNode.uid;
        treeNode.levelNdx = nodeBeingExpanded.levelNdx + 1;
    } );

    return {
        parentNode: nodeBeingExpanded,
        childNodes: response,
        totalChildCount: response ? response?.length : 0,
        startChildNdx: 0,
        mergeNewNodesInCurrentlyLoadedTree: true
    };
};

/**
 * Perform selection in 3D
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructDataProvider leaf structure data provider
 * @param {Object} eventData event data
 */
export let updateLeafNodeSelectionIn3D = ( viewerContextData, leafStructDataProvider, eventData ) => {
    viewerContextData.getViewerLeafStructureMgr().updateLeafNodeSelectionIn3D( leafStructDataProvider, eventData );
};

/**
 * Update tree data
 * @param {Object} viewerContextData viewer context data
 * @param {Object} leafStructDataProvider leaf structure data provider
 */
export let updateLeafTreeDataFromCachedMap = ( viewerContextData, leafStructDataProvider ) => {
    viewerContextData.getViewerLeafStructureMgr().updateLeafTreeDataFromCachedMap( leafStructDataProvider );
};

/**
 * Step through previous
 *
 * @param {Object} modelViewState fetch modelViewState
 * @param {Object} pmiDataState fetch pmiDataState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 *
 */
export let stepThroughPrev = function( modelViewState, pmiDataState, pmiRawEntityState, viewerContextData ) {
    let pmiVisibilityProcessing = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_VISIBILITY_PROCESS );
    //To return if it is clicked multiple times without completing the previous process
    if( pmiVisibilityProcessing ) {
        return;
    }
    //When process starts
    _updateVisibilityProcessingCtx( true, viewerContextData );
    let pmiActiveTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
    //GEOANALYSIS_PMI_ACTIVE_TAB_INDEX
    if( pmiActiveTabIndex === 0 ) {
        _moveToPrevModelView( modelViewState );
    } else {
        _moveToPrevType( pmiDataState, pmiRawEntityState, viewerContextData );
    }
};

/**
 * Step through next
 * @param {Object} modelViewState fetch modelViewState
 * @param {Object} pmiDataState fetch pmiDataState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 *
 */
export let stepThroughNext = function( modelViewState, pmiDataState, pmiRawEntityState, viewerContextData ) {
    let pmiVisibilityProcessing = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_VISIBILITY_PROCESS );
    //To return if it is clicked multiple times without completing the previous process
    if( pmiVisibilityProcessing ) {
        return;
    }
    //When process starts
    _updateVisibilityProcessingCtx( true, viewerContextData );
    let pmiActiveTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
    if( pmiActiveTabIndex === 0 ) {
        _moveToNextModelView( modelViewState );
    } else {
        _moveToNextType( pmiDataState, pmiRawEntityState, viewerContextData );
    }
};

/**
 * initialize the pmi tool
 * @param {Object} pmiToolState pmiToolState atomic data
 * @param {object} viewerContextData viewer context data
 * @param {String} popupId popup id to be set in viewer context data
 */
export let initialize = ( pmiToolState, viewerContextData, popupId ) => {
    viewerContextData.getPmiManager().setupAtomicDataTopicsPanelReveal( pmiToolState );
    viewerContextData.getPmiManager().updateCtxWithCurrentSelection();
    viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, popupId );
};

/**
 * initialize the reference set
 * @param {object} viewerContextData viewer context data
 * @param {Object} referenceSet reference set atomic data
 */
export let initializeRefSet = ( viewerContextData, referenceSet ) => {
    viewerContextData.getRefSetManager().setupAtomicDataTopicsPanelReveal( referenceSet );
};


/**
 * To update label when atomic data is changed
 * @param {Object} viewerContextData viewer context data
 * @param {Object} activeReferenceSet reference set label
 * @param {object} referenceSet reference set atomic data
 *
 * @returns {object} newActiveReferenceSet updated active reference set label
 */
export let onUpdateRefSet = ( viewerContextData, activeReferenceSet, referenceSet ) => {
    let activeRefSet = referenceSet.getValue().activeReferenceSet;
    let newActiveReferenceSet = { ...activeReferenceSet };

    if( activeRefSet ) {
        newActiveReferenceSet.dbValue = activeRefSet;
        newActiveReferenceSet.dispValue = activeRefSet;
        newActiveReferenceSet.uiValue = activeRefSet;
    }
    viewerContextData.getViewerAtomicDataSubject().notify( viewerContextData.SUBNODE_VISIBILITY_CHANGED, {} );
    return newActiveReferenceSet;
};


/**
 * To update label when atomic data is changed
 * @param {Object} viewerContextData viewer context data
 */
export let onUpdateTargetCsids = ( viewerContextData ) => {
    viewerContextData.getRefSetManager().updateRefSet();
};


/**
 * To get the available reference sets list
 * @param {Object} viewerContextData Viewer context data
 * @param {object} referenceSet reference set atomic data
 *
 * @returns {object} referenceSetsList contains responce and count for data providers
 */
export const getReferenceSetsList = ( viewerContextData, referenceSet ) => {
    let promise =  viewerContextData.getRefSetManager().getAvailableReferenceSet();
    const activeReferenceSet = referenceSet.getValue().activeReferenceSet;

    return promise.then( function( referenceSetsList ) {
        const referenceSets = [];
        let count = 0;
        if( activeReferenceSet && activeReferenceSet !== ' ' ) {
            count += 1;
            referenceSets.push( createRefSetNode( activeReferenceSet, count, true ) );
        }
        for ( let set of referenceSetsList ) {
            if( set !== activeReferenceSet ) {
                count += 1;
                referenceSets.push( createRefSetNode( set, count ) );
            }
        }
        return { referenceSets: referenceSets, count : referenceSets.length };
    } ).catch( error => {
        logger.error( 'Failed to load available reference set data : ' + error );
        return AwPromiseService.instance.reject( error );
    } );
};

/**
 * To create reference set node
 * @param {String} set Reference set name
 * @param {Number} count count to add Uid
 * @param {Boolean} isSelected to make node selected
 *
 * @returns {Object} nodes with uid and cellHeader1
 */
const createRefSetNode = ( set, count, isSelected ) => {
    set = String( set );
    return {
        uid: count,
        cellHeader1: set,
        hasThumbnail: false,
        selected: isSelected
    };
};

/**
 * Nodes loaded action(to select active reference set in the list)
 * @param {response} pmiRawEntityState fetch pmiRawEntityState
 * @param {Object} viewerContextData fetch modelViewState
 * @param {Object} subPanelContext fetch data to check selectedTab
 */
export const nodesLoadedAction = ( response, listReferenceSet, referenceSet ) =>{
    const activeReferenceSet = referenceSet.getValue().activeReferenceSet;
    var newRuleObj = response.filter( child => child.cellHeader1 === activeReferenceSet );
    listReferenceSet.selectionModel.setSelection( newRuleObj );
};

/**
 * Close Reference Set Change Popup
 * @param {object} subPanelContext sub panel context data to close popup
 */
export const hidePopupChangeReferenceSets = ( subPanelContext ) => {
    subPanelContext.popupApi.hide();
};

/**
 * Apply Reference set
 * @param {array} response reference set response
 * @param {Object} viewerContextData viewer context data
 * @param {Object} subPanelContext sub panel context data
 */
export const applyPreferenceSet = ( response, viewerContextData,  subPanelContext ) => {
    let preferenceSet = null;
    for ( let index = 0; index < response.length; index++ ) {
        const element = response[index];
        if( element.selected ) {
            preferenceSet = element.cellHeader1;
            break;
        }
    }

    viewerContextData.getRefSetManager().applyReferenceSet( preferenceSet );
    subPanelContext.popupApi.hide();
};

/**
 * Clear Pmi context
 */
export let clearPmiCtx = function() {
    let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
    let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
    let viewerContextNamespace = viewerContextService.getActiveViewerContextNamespaceKey( occmgmtContextKey );
    let viewerContextData = viewerContextService.getRegisteredViewerContext( viewerContextNamespace );
    if( !_.isUndefined( viewerContextData ) ) {
        viewerContextData.getPmiManager().unsubscribeAtomicDataTopicsPanelClose();
        viewerContextData.getViewerLeafStructureMgr().cleanUpLeafStructure();
        viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, null );
        viewerContextData.getRefSetManager().unsubscribeAtomicDataTopicsPanelClose();
    }
};

/**
 * Turn on Visibility
 */
export let turnOnVisibility = function( viewerContextData ) {
    let pmiTargetCSIDs = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
    viewerContextService.executeSelectedOnCommand( viewerContextData, pmiTargetCSIDs );
};

/**
 * Fetch Pmi data
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 * @param {Object} modelViewState fetch modelViewState
 * @param {Object} data fetch data to check selectedTab
 *
 * @returns {Object} modelViewDetails Model View Data
 */
export let fetchPmiData = async( pmiRawEntityState, modelViewState, data, viewerContextData ) => {
    let mvData = {
        modelViewData: [],
        previousCheckedModelView: null,
        operationInProgressFlag: false,
        modelViewNextPrevStateIndex: -1
    };
    modelViewState.update( mvData );
    let pmiCtxTargetCsids = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
    let mvPromise;
    let pmiElemPromise;

    viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_DATA_FETCH_COMPLETE, false );
    if( data && data.tabModels && data.tabModels[ 0 ].selectedTab ) {
        viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX, 0 );
    } else {
        viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX, 1 );
    }

    pmiElemPromise = await viewerContextData.getPmiManager().requestPmiElementsDataByParts( pmiCtxTargetCsids );
    mvPromise = await viewerContextData.getModelViewManager().requestModelViewsDataByParts( pmiCtxTargetCsids );

    return AwPromiseService.instance.all( [ mvPromise, pmiElemPromise ] ).then( function( pmiDataResult ) {
        let pmiEntityRawData = pmiToolUtil.parseRawPmiEntityData( pmiDataResult[ 1 ], pmiRawEntityState );
        _initializePmiEntity( pmiEntityRawData, viewerContextData );
        return _fetchChildrenMV( pmiDataResult[ 0 ], viewerContextData ).then( function( modelViewDetails ) {
            viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_DATA_FETCH_COMPLETE, true );
            return {
                modelViewDetails: modelViewDetails
            };
        } );
    } ).catch( error => {
        logger.error( 'Failed to load PMI data : ' + error );
        return AwPromiseService.instance.reject( error );
    } );
};

/**
 * Fetch Model View Children
 *
 *  @param {Object} mvData model view data
 *  @returns {Promise} resolves all model view promisses to fetch their children
 */
var _fetchChildrenMV = async( mvData, viewerContextData ) => {
    let promises = [];
    mvData = pmiToolUtil.parseModelViewData( mvData );
    let occIds = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
    //Fetch all children of MV Data
    _.forEach( mvData, function( value ) {
        promises.push( viewerContextData.getModelViewManager().requestModelViewElementsData( value.modelViewId, occIds ) );
    } );
    return AwPromiseService.instance.all( promises )
        .then( function( mvRawChildrenData ) {
            let mvViewModel = _populateModelViewGroup( mvData, mvRawChildrenData );
            _initializeModelView( mvViewModel, viewerContextData );
            return mvViewModel;
        }, function( error ) {
            logger.error( 'Fetch MV Children failed' + error );
        } );
};

/**
 *  Initialize PMI Entity
 *  @param {Object} pmiEntityData  pmi entity data
 */
var _initializePmiEntity = function( pmiEntityData, viewerContextData ) {
    viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_HAS_TYPE_DATA, !_.isEmpty( pmiEntityData ) );
};

/**
 * Initialize Model view
 * @param {Object} mvViewModel  Model View data
 */
var _initializeModelView = function( mvViewModel, viewerContextData ) {
    viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_HAS_MV_DATA, !_.isEmpty( mvViewModel ) );
};

/**
 * Update viewmodel with selection and selection display name.
 * @param  {Object} declViewModel viewmodel
 * @param  {Object} modelName modelName
 * @returns {Object} returns target list and total target found
 */
export let updateSelectionWithDisplayStrings = function( declViewModel, modelName, viewerContextData ) {
    let pmiTargetList = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGET_LIST );
    if( pmiTargetList !== undefined ) {
        let textMessage = pmiToolUtil.updateDisplayStrings( viewerContextData );
        modelName.label = pmiToolUtil.getSelectionDisplayName( viewerContextData );
        return {
            allTargets: pmiTargetList,
            totalFound: pmiTargetList.length,
            notCurrentlyVisibleText: textMessage.notCurrentlyVisibleText,
            hasNoPmiText: textMessage.hasNoPmiText,
            modelName: modelName
        };
    }
    return 0;
};

/**
 * Get current Selection display name
 * @returns {String} selection display name
 */
export let getCurrentSelection = function( viewerContextData ) {
    return pmiToolUtil.getSelectionDisplayName( viewerContextData );
};

/**
 * Updates view model with ModelViews
 * Add checkbox widget in Model View data
 * @param {Object} modelViewDetails fetch modelViewDetails
 * @param  {Object} modelViewState modelViewState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 */
export let updateMVTabViewModel = function( modelViewDetails, modelViewState, pmiRawEntityState ) {
    let newModelViewState = { ...modelViewState.getValue() };
    let widgetsProperties = {
        checkbox: {
            displayName: '',
            type: 'BOOLEAN',
            dbValue: false,
            dispValue: 'False',
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT',
            uiValue: 'False'
        }
    };
    let modelViewTreeDetials = [];
    _.forEach( modelViewDetails, function( modelViewEntity ) {
        let mvTreeData = {
            mvIndex: modelViewEntity.mvIndex,
            modelViewId: modelViewEntity.modelViewId,
            resourceId: modelViewEntity.resourceId,
            label: modelViewEntity.label,
            selected: modelViewEntity.selected,
            expanded: newModelViewState.modelViewData.length > 0 && newModelViewState.modelViewData[ modelViewEntity.mvIndex ].expanded ?
                newModelViewState.modelViewData[ modelViewEntity.mvIndex ].expanded : false
        };
        mvTreeData.checkbox = modelPropertySvc.createViewModelProperty( widgetsProperties.checkbox );
        uwPropertySvc.setValue( mvTreeData.checkbox, modelViewEntity.isVisibilityOn );
        //will check later
        if( !_.isNull( newModelViewState.previousCheckedModelView ) && mvTreeData.mvIndex === newModelViewState.previousCheckedModelView ) {
            uwPropertySvc.setValue( mvTreeData.checkbox, true );
        } else if( modelViewEntity.isVisibilityOn ) {
            newModelViewState.previousCheckedModelView = mvTreeData.mvIndex;
        }

        let newPmiRawEntityState = pmiRawEntityState.getValue();
        let typeEntityTree = [];
        _.forEach( modelViewEntity.children, function( mVEChildren ) {
            let typeEntityViewModel = _.find( newPmiRawEntityState.pmiEntityRawData, {
                resourceId: mVEChildren[ 4 ]
            } );

            if( !_.isUndefined( typeEntityViewModel ) ) {
                typeEntityViewModel.parentModelView.add( modelViewEntity.mvIndex );
                let typeEntitySelectedKey = _.pick( typeEntityViewModel, [ 'index', 'resourceId', 'label', 'selected', 'type', 'uniqueId' ] );
                if( _.isUndefined( mVEChildren.checkbox ) ) {
                    typeEntitySelectedKey.checkbox = modelPropertySvc.createViewModelProperty( widgetsProperties.checkbox );
                    uwPropertySvc.setValue( typeEntitySelectedKey.checkbox, typeEntityViewModel.isVisibilityOn );
                }
                typeEntityTree.push( typeEntitySelectedKey );
            }
        } );
        mvTreeData.children = typeEntityTree;

        modelViewTreeDetials.push( mvTreeData );
    } );
    newModelViewState.modelViewNextPrevStateIndex = -1;
    newModelViewState.modelViewData = modelViewTreeDetials;
    modelViewState.update( newModelViewState );
};
/**
 * Updates view model with entities
 * @param {Object} entitiesState fetch entitiesState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 */
export let updateTypesTabViewModel = function( entitiesState, pmiRawEntityState ) {
    let newPmiRawEntityState = pmiRawEntityState.getValue();
    let pmiTreeData = pmiToolUtil.parsePmiEntityData( newPmiRawEntityState.pmiEntityRawData, entitiesState );
    let pmiEntityData = { ...entitiesState };
    if( _.isUndefined( pmiEntityData.lastCheckedTypeViewModel ) ) {
        pmiEntityData.lastCheckedTypeViewModel = [];
    }
    pmiEntityData.entities = pmiTreeData;
    entitiesState.update( pmiEntityData );
};

/**
 * Populates entities for Model View
 *
 * @param {Object} mvViewModel view model object
 * @param {Object} rawEntitiesData raw pmi entities
 * @param {Object} entitiesState fetch entitiesState
 *
 * @returns {Object} returns model view object with their children
 */
var _populateModelViewGroup = function( mvViewModel, rawEntitiesData ) {
    for( let pos = 0; pos < mvViewModel.length; pos++ ) {
        mvViewModel[ pos ].children = [];
        if( _.isArray( rawEntitiesData[ pos ] ) && !_.isEmpty( rawEntitiesData[ pos ] ) ) {
            mvViewModel[ pos ].children = rawEntitiesData[ pos ];
        }
    }
    return mvViewModel;
};

/**
 * Handler for model view checking action
 *
 * @param {Object} input the ModelView that is checked
 * @param {Object} pmiRawState fetch pmiRawEntityState
 * @param {Object} modelDataState fetch ModelView Data
 */
export let modelViewEntryChecked = function( input, pmiRawState, modelDataState, viewerContextData ) {
    if( _timeOutPromiseSelected ) {
        _.forEach( _timeOutPromiseSelected, cancelEachTimeOut => AwTimeoutService.instance.cancel( cancelEachTimeOut ) );
        _timeOutPromiseSelected = [];
    }
    let newPmiRawState = { ...pmiRawState.getValue() };
    let newModelViewData = { ...modelDataState.getValue() };
    let pmiEntityVisisble = _.filter( newPmiRawState.pmiEntityRawData, entity => entity.isVisibilityOn === true );
    _.forEach( pmiEntityVisisble, pmiEntity => {
        pmiEntity.isVisibilityOn = false;
        let parentModelViewsOfEntity = pmiEntity.parentModelView;
        if( parentModelViewsOfEntity.size > 0 ) {
            parentModelViewsOfEntity.forEach( function( pmValue ) {
                for( let pos = 0; pos < newModelViewData.modelViewData[ pmValue ].children.length; pos++ ) {
                    if( newModelViewData.modelViewData[ pmValue ].children[ pos ].index === pmiEntity.index ) {
                        uwPropertySvc.setValue( newModelViewData.modelViewData[ pmValue ].children[ pos ].checkbox, false );
                        break;
                    }
                }
            } );
        }
    } );
    pmiRawState.update( newPmiRawState );
    modelDataState.update( newModelViewData );
    //uncheck all the previous child entity
    ignoreTypesValueChangeProcessingAsMVChanged = true;
    AwTimeoutService.instance( () => {
        ignoreTypesValueChangeProcessingAsMVChanged = false;
        _pmiModelViewEntityChecked( input, modelDataState, pmiRawState, viewerContextData );
    }, 200 );
};

/**
 * Method to process when Model View is checked/unchecked i.e visibility is on/off. If the node is * already selected then highlight it as soon as visbility is on
 *
 * @param  {Object} input specific node checked/unchecked
 * @param {Object} modelDataState fetch Model data
 * @param {Object} pmiRawState fetch pmiRawEntityState
 *
 */

var _pmiModelViewEntityChecked = function( input, modelDataState, pmiRawState, viewerContextData ) {
    let newLabelDetails = { ...input.getValue() };
    if( modelDataState.operationInProgressFlag ) {
        logger.info( 'PmiToolService: Ignoring this opeartion as Viewer is still working on old.' );
        uwPropertySvc.setValue( newLabelDetails.checkbox, !newLabelDetails.checkbox.dbValue );
        input.update( newLabelDetails );
        return;
    }

    if( newLabelDetails.checkbox.dbValue ) {
        _updateModelViewVisbility( input, modelDataState, pmiRawState, viewerContextData );
    } else {
        // remove checked
        let occIds = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
        viewerContextData.getModelViewManager().setPropertiesOnModelViews( input.modelViewId, modelDataState, false, occIds )
            .then( function() {
                _changeMVChildrenCheckState( input, pmiRawState );
                let newModelData = { ...modelDataState.getValue() };
                newModelData.previousCheckedModelView = null;
                modelDataState.update( newModelData );
            }, function( reason ) {
                logger.error( 'ModelView Visibility operation failed: ' + reason );
            } );
    }
};

/**
 * Change model view children check state  (false)
 * @param  {Object} input input model view view model
 * @param {Object} pmiRawState fetch pmiRawEntityState
 */
var _changeMVChildrenCheckState = function( input, pmiRawState ) {
    let newInput = { ...input.getValue() };
    let newPmiRawState = { ...pmiRawState.getValue() };
    _.forEach( newInput.children, function( mvChild ) {
        if( mvChild.checkbox.dbValue !== newInput.checkbox.dbValue ) {
            //Updated checkbox
            uwPropertySvc.setValue( mvChild.checkbox, newInput.checkbox.dbValue );
            newPmiRawState.pmiEntityRawData[ mvChild.index ].isVisibilityOn = newInput.checkbox.dbValue;
        }
    } );
    input.update( newInput );
    pmiRawState.update( newPmiRawState );
};

/**
 * update visibilityProcessing in pmiToolState
 * @param {Boolean} isVisbilityProcess boolean value true/false
 */
var _updateVisibilityProcessingCtx = function( isVisbilityProcess, viewerContextData ) {
    viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_VISIBILITY_PROCESS, isVisbilityProcess );
};

/**
 * Update Model View Visbility
 * @param {Object} input input entity
 * @param {Object} modelDataState View model
 * @param {Object} pmiRawState fetch pmiRawEntityState
 */
var _updateModelViewVisbility = function( input, modelDataState, pmiRawState, viewerContextData ) {
    logger.info( 'PmiToolService: Setting to wait for Viewer opearation.' );
    //Updated atomic data
    let newModelViewData = { ...modelDataState.getValue() };
    newModelViewData.operationInProgressFlag = true;
    let newPmiRawState = { ...pmiRawState.getValue() };
    if( !_.isNull( newModelViewData.previousCheckedModelView ) ) {
        let posPreviouslyChecked = newModelViewData.previousCheckedModelView;
        uwPropertySvc.setValue( newModelViewData.modelViewData[ posPreviouslyChecked ].checkbox, false );
        if( newModelViewData.modelViewData[ posPreviouslyChecked ].children.length > 0 ) {
            _.forEach( newModelViewData.modelViewData[ posPreviouslyChecked ].children, function( mvChild ) {
                if( mvChild.checkbox.dbValue !== false ) {
                    //Updated checkbox
                    uwPropertySvc.setValue( mvChild.checkbox, false );
                    newPmiRawState.pmiEntityRawData[ mvChild.index ].isVisibilityOn = false;
                }
            } );
        }
        modelDataState.update( newModelViewData );
        pmiRawState.update( newPmiRawState );
    }
    _updateChildEntitiesVisbility( input, modelDataState, pmiRawState, viewerContextData );
};

/**
 * Check/uncheck child entities of Model View
 * @param {Object} input model view node
 * @param {Object} modelDataState View model
 * @param {Object} pmiRawState fetch pmiRawEntityState
 */
var _checkedChildEntities = function( input, modelDataState, pmiRawState, viewerContextData ) {
    //Updated atomic data
    let newModelViewData = { ...modelDataState.getValue() };
    newModelViewData.previousCheckedModelView = input.mvIndex;
    let occIds = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
    viewerContextData.getModelViewManager().requestModelViewElementsData( input.modelViewId, occIds ).then( function( data ) {
        //Updated atomic data
        let newInput = { ...input.getValue() };
        let newPmiRawState = { ...pmiRawState.getValue() };
        newModelViewData.modelViewData[ newInput.mvIndex ].children.forEach( ( mvValue, pos ) => {
            let isVisibilityOn = data[ pos ][ 3 ] === 'true';
            let parentModelViewsOfEntity = newPmiRawState.pmiEntityRawData[ mvValue.index ].parentModelView;
            if( parentModelViewsOfEntity.size > 0 ) {
                parentModelViewsOfEntity.forEach( function( pmValue ) {
                    for( let pos = 0; pos < newModelViewData.modelViewData[ pmValue ].children.length; pos++ ) {
                        if( newModelViewData.modelViewData[ pmValue ].children[ pos ].index === mvValue.index ) {
                            uwPropertySvc.setValue( newModelViewData.modelViewData[ pmValue ].children[ pos ].checkbox, isVisibilityOn );
                            break;
                        }
                    }
                } );
            }
            newPmiRawState.pmiEntityRawData[ mvValue.index ].isVisibilityOn = isVisibilityOn;
        } );
        input.update( newInput );
        pmiRawState.update( newPmiRawState );
        newModelViewData.operationInProgressFlag = false;
        modelDataState.update( newModelViewData );
        _updateVisibilityProcessingCtx( false, viewerContextData );
    }, function( reason ) {
        logger.debug( 'PmiToolService: UnSetting to wait for Viewer opearation.' );
        logger.error( 'PmiToolService: requestModelViewElementsData opeartion failed: ' + reason );
        //Updated atomic data
        modelDataState.operationInProgressFlag = false;
        modelDataState.update( newModelViewData );
        _updateVisibilityProcessingCtx( false );
    } );
};

/**
 * Update Child Entity Visibility
 * @param  {Object} input model view node
 * @param  {Object} modelDataState View model
 * @param {Object} pmiRawState fetch pmiRawEntityState
 */
var _updateChildEntitiesVisbility = function( input, modelDataState, pmiRawState, viewerContextData ) {
    let newModelViewData = { ...modelDataState.getValue() };
    let occIds = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
    viewerContextData.getModelViewManager().setPropertiesOnModelViews( input.modelViewId, modelDataState, true, occIds ).then( function() {
        if( input.children.length > 0 ) {
            _checkedChildEntities( input, modelDataState, pmiRawState, viewerContextData );
        } else {
            //Updated atomic data
            newModelViewData.operationInProgressFlag = false;
            // adding previously checked MV here
            newModelViewData.previousCheckedModelView = input.mvIndex;
            modelDataState.update( newModelViewData );
            _updateVisibilityProcessingCtx( false, viewerContextData );
        }
    }, function( reason ) {
        //update atomic data
        newModelViewData.operationInProgressFlag = false;
        modelDataState.update( newModelViewData );
        let newInputData = { ...input.getValue() };
        newInputData.checkbox.dbValue = !newInputData.checkbox.dbValue;
        input.update( newInputData );
        logger.error( 'ModelView Visibility operation failed: ' + reason );
        _updateVisibilityProcessingCtx( false, viewerContextData );
    } );
};

/**
 * Move to next model view
 * @param  {Object} modelViewState Model view atomic state
 *
 */
var _moveToNextModelView = function( modelViewState ) {
    if( _.isEmpty( modelViewState.modelViewData ) ) {
        return;
    }
    let toGoAt = 0; // 0 is default
    if( modelViewState.previousCheckedModelView !== null && modelViewState.previousCheckedModelView < modelViewState.modelViewData.length - 1 ) {
        toGoAt = modelViewState.previousCheckedModelView + 1;
    }
    _focusOnModelView( toGoAt, modelViewState );
};

/**
 * Focus on ModelView
 *
 * @param {@number} toGoAt index of model view for next/prev
 * @param  {Object} modelViewState Model view atomic state
 *
 */
var _focusOnModelView = function( toGoAt, modelViewState ) {
    let newModelViewData = { ...modelViewState.getValue() };
    let mvViewModel = newModelViewData.modelViewData[ toGoAt ];
    newModelViewData.modelViewNextPrevStateIndex = toGoAt;
    //Update checkbox
    uwPropertySvc.setValue( mvViewModel.checkbox, true );
    modelViewState.update( { ...newModelViewData } );
};
/**
 * Move to previous model view
 * @param  {Object} modelViewState Model view atomic state
 */
var _moveToPrevModelView = function( modelViewState ) {
    if( _.isEmpty( modelViewState.modelViewData ) ) {
        return;
    }

    let toGoAt = modelViewState.modelViewData.length - 1; // 0 is default

    if( modelViewState.previousCheckedModelView !== null && modelViewState.previousCheckedModelView > 0 ) {
        toGoAt = modelViewState.previousCheckedModelView - 1;
    }
    _focusOnModelView( toGoAt, modelViewState );
};

/**
 * Handler for model view and types Label click action
 *
 * @param {Object} eventData the selected node
 * @param {Object} modelViewState fetch modelViewState
 * @param {Object} pmiDataState fetch pmiDataState
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 */
export let pmiEntityModelViewNodeClicked = function( eventData, modelViewState, pmiDataState, pmiRawEntityState, viewerContextData ) {
    let pmiActiveTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    //Issue : When the user check the checkbox both "labelClicked" and "Checked" action both are called. Moreover, node gets selected.
    // In order to stop execution of this function used setTimeout to handle it
    _timeOutPromiseSelected.push( AwTimeoutService.instance( () => {
        _timeOutPromiseSelected = [];
        let childrenSelected = [];
        if( newPmiRawEntityState.previousSelectedPmiEntity.position > -1 ) {
            if( newPmiRawEntityState.previousSelectedPmiEntity.child &&
                ( eventData.node.type && newPmiRawEntityState.previousSelectedPmiEntity.position !== eventData.node.index ||
                    eventData.node.children ) ) {
                //dealing with entitties
                let atomicState = pmiActiveTabIndex === 1 ? pmiDataState : modelViewState;
                let childSelectedObj = _updateSelectionOfEntities( atomicState, pmiRawEntityState, newPmiRawEntityState.previousSelectedPmiEntity.position, false );
                childrenSelected.push( childSelectedObj );
            } else if( pmiActiveTabIndex === 1 && !newPmiRawEntityState.previousSelectedPmiEntity.child && newPmiRawEntityState.previousSelectedPmiEntity.position !== eventData.node
                .index ) {
                let newPmiData = { ...pmiDataState.getValue() };
                newPmiData.entities[ newPmiRawEntityState.previousSelectedPmiEntity.position ].selected = false;
                pmiDataState.update( newPmiData );
            } else if( pmiActiveTabIndex === 0 && !newPmiRawEntityState.previousSelectedPmiEntity.child && newPmiRawEntityState.previousSelectedPmiEntity.position !== eventData.node
                .mvIndex ) {
                let newModelViewData = { ...modelViewState.getValue() };
                newModelViewData.modelViewData[ newPmiRawEntityState.previousSelectedPmiEntity.position ].selected = false;
                modelViewState.update( newModelViewData );
            } else {
                //Toggle Value
                eventData.node.selected = false;
            }
        }
        if( pmiActiveTabIndex === 0 ) {
            if( !_.isUndefined( eventData.node.mvIndex ) ) {
                let newModelViewData = { ...modelViewState.getValue() };
                newModelViewData.modelViewData[ eventData.node.mvIndex ].selected = eventData.node.selected;
                _updatedSelection( eventData.node.selected, pmiRawEntityState, eventData.node.mvIndex, false );
                modelViewState.update( newModelViewData );
            } else {
                let childSelectedObj = _updateSelectionOfEntities( modelViewState, pmiRawEntityState, eventData.node.index, eventData.node.selected );
                childrenSelected.push( childSelectedObj );
                _updatedSelection( eventData.node.selected, pmiRawEntityState, eventData.node.index, true );
            }
        } else {
            if( !_.isUndefined( eventData.node.children ) ) {
                let newPmiData = { ...pmiDataState.getValue() };
                newPmiData.entities[ eventData.node.index ].selected = eventData.node.selected;
                _updatedSelection( eventData.node.selected, pmiRawEntityState, eventData.node.index, false );
                pmiDataState.update( newPmiData );
            } else {
                let childSelectedObj = _updateSelectionOfEntities( pmiDataState, pmiRawEntityState, eventData.node.index, eventData.node.selected );
                childrenSelected.push( childSelectedObj );
                _updatedSelection( eventData.node.selected, pmiRawEntityState, eventData.node.index, true );
            }
        }
        if( childrenSelected.length > 0 ) {
            ignoreListenerIfSelectedFromPMITree = true;
            pmiToolUtil.setPmiElementProperty( childrenSelected, viewerContextData ).then( function() {
                //do nothing
            }, function( error ) {
                logger.error( 'Selection failed' + error );
            } );
        }
    }, 300 ) );
};

/**Update Entity Selection for Model View/Pmi group
 * @param {Object} atomicState either modelViewState/Pmi State
 * @param {Object} pmiRawEntityState fetch pmiRawEntityState
 * @param {Number} position selction pos/index
 * @param {Boolean} isSelected if node is selected true/false
 *  @returns {Object} selected children
 */
var _updateSelectionOfEntities = function( atomicState, pmiRawEntityState, position, isSelected ) {
    let newAtomicState = { ...atomicState.getValue() };
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    newPmiRawEntityState.pmiEntityRawData[ position ].selected = isSelected;
    if( !_.isUndefined( newAtomicState.modelViewData ) ) {
        let parentModelViewsOfEntity = newPmiRawEntityState.pmiEntityRawData[ position ].parentModelView;
        if( parentModelViewsOfEntity.size > 0 ) {
            parentModelViewsOfEntity.forEach( function( pmValue ) {
                for( let pos = 0; pos < newAtomicState.modelViewData[ pmValue ].children.length; pos++ ) {
                    if( newAtomicState.modelViewData[ pmValue ].children[ pos ].index === position ) {
                        newAtomicState.modelViewData[ pmValue ].children[ pos ].selected = isSelected;
                        break;
                    }
                }
            } );
        }
    } else {
        let pmiEntityGroup = _.findIndex( newAtomicState.entities, parent => parent.label === newPmiRawEntityState.pmiEntityRawData[ position ].type );
        let childPos = _.findIndex( newAtomicState.entities[ pmiEntityGroup ].children, child => child.index === position );
        if( pmiEntityGroup > -1 ) {
            newAtomicState.entities[ pmiEntityGroup ].children[ childPos ].selected = isSelected;
        }
    }
    let childrenSelected = {
        id: position,
        state: 'SELECTED',
        value: isSelected
    };
    atomicState.update( newAtomicState );
    pmiRawEntityState.update( newPmiRawEntityState );
    return childrenSelected;
};

/**
 * Update previousSelectedPmiEntity in pmiRawEntityState
 * @param {Boolean} isSelected if node is selected true/false
 * @param {Object1} pmiRawEntityState fetch pmiRawEntityState
 * @param {Number} position selction pos/index
 * @param {Boolean} isChild if node selected is child(pmi entity) then true else false
 */

var _updatedSelection = function( isSelected, pmiRawEntityState, position, isChild ) {
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    if( isSelected ) {
        newPmiRawEntityState.previousSelectedPmiEntity.position = position;
        newPmiRawEntityState.previousSelectedPmiEntity.child = isChild;
    } else {
        newPmiRawEntityState.previousSelectedPmiEntity.position = -1;
        newPmiRawEntityState.previousSelectedPmiEntity.child = false;
    }
    pmiRawEntityState.update( newPmiRawEntityState );
};
/**
 * Handler for types entity checking action
 * @param {Object} input the selected node
 *  @param {Object} pmiRawState fetch pmiRawEntityState
 * @param {Object} pmiData fetch pmiDataState
 * @param {Object} modelData fetch modelViewState
 */
export let typesEntryChecked = function( input, pmiRawState, pmiData, modelData, viewerContextData ) {
    if( ignoreTypesValueChangeProcessingAsMVChanged ) {
        return;
    }
    if( _timeOutPromiseSelected ) {
        _.forEach( _timeOutPromiseSelected, cancelEachTimeOut => AwTimeoutService.instance.cancel( cancelEachTimeOut ) );
        _timeOutPromiseSelected = [];
    }
    _pmiTypesEntityChecked( input, pmiRawState, pmiData, modelData, viewerContextData );
};

/**
 * Method to process when pmi type entity is checked/unchecked i.e visibility is on/off. If the node is already
 * selected then highlight it as soon as visbility is on
 * @param {Object} input the selected node
 * @param {Object} pmiRawState fetch pmiRawEntityState
 * @param {Object} pmiData fetch pmiDataState
 * @param {Object} modelData fetch modelViewState
 */
var _pmiTypesEntityChecked = function( input, pmiRawState, pmiData, modelData, viewerContextData ) {
    let pmiActiveTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
    let newInput = { ...input.getValue() };
    let newPmiRawState = { ...pmiRawState.getValue() };
    let itemObjectsToProcess = [];
    let isAlreadySelected = false;
    if( pmiActiveTabIndex === 0 ) {
        _updateEntityInModelViewChecked( input, modelData, pmiRawState );
        itemObjectsToProcess = [ {
            id: newInput.index,
            state: 'VISIBLE',
            value: newInput.checkbox.dbValue
        } ];
    } else {
        let newPmiData = { ...pmiData.getValue() };
        //INstead of input updated newPmiData.entities
        if( newInput.children ) {
            _.forEach( newPmiData.entities[ newInput.index ].children, function( typeEntityViewModel ) {
                if( typeEntityViewModel.checkbox.dbValue !== newInput.checkbox.dbValue ) {
                    uwPropertySvc.setValue( typeEntityViewModel.checkbox, newInput.checkbox.dbValue );
                    newPmiRawState.pmiEntityRawData[ typeEntityViewModel.index ].isVisibilityOn = newInput.checkbox.dbValue;
                }
                if( typeEntityViewModel.checkbox.dbValue ) {
                    newPmiData.lastCheckedTypeViewModel.push( typeEntityViewModel.index );
                } else {
                    newPmiData.lastCheckedTypeViewModel = _.filter( newPmiData.lastCheckedTypeViewModel, entity => entity !== typeEntityViewModel.index );
                }

                itemObjectsToProcess.push( {
                    id: typeEntityViewModel.index,
                    state: 'VISIBLE',
                    value: newInput.checkbox.dbValue
                } );
            } );
            pmiData.update( newPmiData );
            pmiRawState.update( newPmiRawState );
        } else {
            newPmiRawState.pmiEntityRawData[ newInput.index ].isVisibilityOn = newInput.checkbox.dbValue;
            if( newInput.checkbox.dbValue ) {
                newPmiData.lastCheckedTypeViewModel.push( newInput.index );
            } else {
                newPmiData.lastCheckedTypeViewModel = _.filter( newPmiData.lastCheckedTypeViewModel, entity => entity !== newInput.index );
            }
            pmiData.update( newPmiData );
            pmiRawState.update( newPmiRawState );
            _parentVisibilityHandledFromChildren( input, pmiData );

            itemObjectsToProcess = [ {
                id: newInput.index,
                state: 'VISIBLE',
                value: newInput.checkbox.dbValue
            } ];
        }
    }
    if( newPmiRawState.previousSelectedPmiEntity.child && newPmiRawState.previousSelectedPmiEntity.position === newInput.index && newInput.checkbox.dbValue ) {
        isAlreadySelected = true;
    }
    _setElementsStates( itemObjectsToProcess, isAlreadySelected, viewerContextData );
};
/**
 *  Update child/entity in Model View tab
 * @param {Object} input the selected node
 * @param {Object} modelData fetch modelViewState
 * @param {Object} pmiRawState fetch pmiRawEntityState
 */
var _updateEntityInModelViewChecked = function( input, modelData, pmiRawState ) {
    let newInput = { ...input.getValue() };
    let newModelData = { ...modelData.getValue() };
    let newPmiRawState = { ...pmiRawState.getValue() };
    newPmiRawState.pmiEntityRawData[ newInput.index ].isVisibilityOn = newInput.checkbox.dbValue;
    let parentModelViewsOfEntity = newPmiRawState.pmiEntityRawData[ newInput.index ].parentModelView;
    if( parentModelViewsOfEntity.size > 1 ) {
        parentModelViewsOfEntity.forEach( function( pmValue ) {
            for( let pos = 0; pos < newModelData.modelViewData[ pmValue ].children.length; pos++ ) {
                if( newModelData.modelViewData[ pmValue ].children[ pos ].index === newInput.index &&
                    newModelData.modelViewData[ pmValue ].children[ pos ].checkbox.dbValue !== newInput.checkbox.dbValue ) {
                    uwPropertySvc.setValue( newModelData.modelViewData[ pmValue ].children[ pos ].checkbox, newInput.checkbox.dbValue );
                    break;
                }
            }
        } );
        modelData.update( newModelData );
    }
    pmiRawState.update( newPmiRawState );
};

/**
 * This method is to set the elements(nodes) state visbility on/off and selected when visbility is on
 *
 * @param  {Object} itemObjectsToProcess this object contains id, state(VISIBLE/SELCTED) and value(true/false)
 *
 * @param  {boolean} isAlreadySelected by default it is false. (true/false)
 *
 */

var _setElementsStates = function( itemObjectsToProcess, isAlreadySelected, viewerContextData ) {
    pmiToolUtil.setPmiElementProperty( itemObjectsToProcess, viewerContextData ).then( function() {
        if( isAlreadySelected ) {
            itemObjectsToProcess.map( obj => obj.state = 'SELECTED' );
            pmiToolUtil.setPmiElementProperty( itemObjectsToProcess, viewerContextData ).then( function() {
                //do nothing
            }, function( error ) {
                logger.error( 'Selection Failed' + error );
            } );
        }
        _updateVisibilityProcessingCtx( false, viewerContextData );
    }, function( reason ) {
        logger.error( 'PmiToolService: requestModelViewElementsData opeartion failed: ' + reason );
        _updateVisibilityProcessingCtx( false, viewerContextData );
    } );
};

/**
 * Method to modifies the entities’ checkboxes within one group, the state is rolled up to the group checkbox
 *
 * @param  {Object} input specific node
 * @param  {Object} pmiDataState pmi entity state
 *
 */
var _parentVisibilityHandledFromChildren = function( input, pmiDataState ) {
    let newPmiEntityData = { ...pmiDataState.getValue() };
    let pmiExtractedObject = newPmiEntityData.entities.filter( parent => parent.label === input.type );
    let children = pmiExtractedObject[ 0 ].children.filter( children => !children.checkbox.dbValue );
    if( children.length === 0 ) {
        uwPropertySvc.setValue( pmiExtractedObject[ 0 ].checkbox, true );
    } else if( pmiExtractedObject[ 0 ].checkbox.dbValue && !input.checkbox.dbValue ) {
        uwPropertySvc.setValue( pmiExtractedObject[ 0 ].checkbox, false );
    }
    pmiDataState.update( newPmiEntityData );
};

/**
 * Move to next type
 * @param {Object} pmiDataState pmi entity atomic state
 * @param {Object} pmiRawEntityState pmi raw entity atomic state
 */
var _moveToNextType = function( pmiDataState, pmiRawEntityState, viewerContextData ) {
    let newPmiDataState = { ...pmiDataState.getValue() };
    if( newPmiDataState.entities.length === 0 ) {
        return;
    }
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    let toGoAtParentIndex = 0; // default index
    let toGoAtChildrenIndex = 0;

    if( newPmiDataState.lastCheckedTypeViewModel.length > 0 ) {
        //pop the lastCheckedType from the array
        let _lastCheckedChildIndex = newPmiDataState.lastCheckedTypeViewModel[ newPmiDataState.lastCheckedTypeViewModel.length - 1 ];

        let _pmiLastCheckedParentIndex = _.findIndex( newPmiDataState.entities, parent => parent.label === newPmiRawEntityState.pmiEntityRawData[ _lastCheckedChildIndex ].type );
        let _lastCheckedTypeChildIndex = _.findIndex( newPmiDataState.entities[ _pmiLastCheckedParentIndex ].children, function( typeViewModelObj ) {
            return typeViewModelObj.index === newPmiRawEntityState.pmiEntityRawData[ _lastCheckedChildIndex ].index;
        } );
        let next = _lastCheckedTypeChildIndex + 1;
        if( next >= newPmiDataState.entities[ _pmiLastCheckedParentIndex ].children.length ) {
            toGoAtParentIndex = ++_pmiLastCheckedParentIndex;
            if( toGoAtParentIndex === newPmiDataState.entities.length ) {
                toGoAtParentIndex %= newPmiDataState.entities.length;
            }
            toGoAtChildrenIndex = 0;
        } else {
            toGoAtParentIndex = _pmiLastCheckedParentIndex;
            toGoAtChildrenIndex = next;
        }
    }

    _focusOnType( toGoAtParentIndex, toGoAtChildrenIndex, pmiDataState, pmiRawEntityState, viewerContextData );
};
/**
 * Focuses on type.
 *
 * @param {number} toGoAtParentIndex parent pos
 * @param {number} toGoAtChildrenIndex child pos
 * @param {Object} pmiDataState pmi entity atomic state
 * @param {Object} pmiRawEntityState pmi raw entity atomic state
 */
var _focusOnType = function( toGoAtParentIndex, toGoAtChildrenIndex, pmiDataState, pmiRawEntityState, viewerContextData ) {
    let newPmiData = { ...pmiDataState.getValue() };
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };

    let entityTypeToFocus = newPmiData.entities[ toGoAtParentIndex ];
    uwPropertySvc.setValue( entityTypeToFocus.children[ toGoAtChildrenIndex ].checkbox, true );
    newPmiData.pmiEntityNextPrevStateIndex = entityTypeToFocus.children[ toGoAtChildrenIndex ].index;
    let lastCheckedEntities = _.filter( newPmiData.lastCheckedTypeViewModel, entity => entity !== entityTypeToFocus.children[ toGoAtChildrenIndex ].index );
    let itemObjectsToProcess = [];
    if( lastCheckedEntities.length > 0 ) {
        for( let pos = 0; pos < lastCheckedEntities.length; pos++ ) {
            newPmiRawEntityState.pmiEntityRawData[ lastCheckedEntities[ pos ] ].isVisibilityOn = false;
            let groupParent = _.filter( newPmiData.entities, grpEntity => grpEntity.label === newPmiRawEntityState.pmiEntityRawData[ lastCheckedEntities[ pos ] ].type );
            if( groupParent[ 0 ].checkbox.dbValue ) {
                uwPropertySvc.setValue( groupParent[ 0 ].checkbox, false );
            }
            let pmiEntity = _.filter( groupParent[ 0 ].children, entity => entity.index === lastCheckedEntities[ pos ] );
            uwPropertySvc.setValue( pmiEntity[ 0 ].checkbox, false );
            itemObjectsToProcess.push( {
                id: lastCheckedEntities[ pos ],
                state: 'VISIBLE',
                value: false
            } );
        }
    }
    itemObjectsToProcess.push( {
        id: entityTypeToFocus.children[ toGoAtChildrenIndex ].index,
        state: 'VISIBLE',
        value: true
    } );
    newPmiRawEntityState.pmiEntityRawData[ entityTypeToFocus.children[ toGoAtChildrenIndex ].index ].isVisibilityOn = true;
    newPmiData.lastCheckedTypeViewModel = [];
    newPmiData.lastCheckedTypeViewModel.push( entityTypeToFocus.children[ toGoAtChildrenIndex ].index );
    pmiDataState.update( newPmiData );
    pmiRawEntityState.update( newPmiRawEntityState );
    _setElementsStates( itemObjectsToProcess, false, viewerContextData );
};

/**
 * moves to previous type
 *
 * @param {Object} pmiDataState pmi entity atomic state
 * @param {Object} pmiRawEntityState pmi raw entity atomic state
 */
var _moveToPrevType = function( pmiDataState, pmiRawEntityState, viewerContextData ) {
    let newPmiDataState = { ...pmiDataState.getValue() };
    if( newPmiDataState.entities.length === 0 ) {
        return;
    }

    let toGoAtParentIndex = newPmiDataState.entities.length - 1; // default index
    let toGoAtChildrenIndex = newPmiDataState.entities[ toGoAtParentIndex ].children.length - 1;
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    if( newPmiDataState.lastCheckedTypeViewModel.length > 0 ) {
        //pop the lastCheckedType from the array
        let _lastCheckedChildIndex = newPmiDataState.lastCheckedTypeViewModel[ newPmiDataState.lastCheckedTypeViewModel.length - 1 ];
        let _pmiLastCheckedParentIndex = _.findIndex( newPmiDataState.entities, parent => parent.label === newPmiRawEntityState.pmiEntityRawData[ _lastCheckedChildIndex ].type );
        let _lastCheckedTypeChildIndex = _.findIndex( newPmiDataState.entities[ _pmiLastCheckedParentIndex ].children, function( typeViewModelObj ) {
            return typeViewModelObj.index === newPmiRawEntityState.pmiEntityRawData[ _lastCheckedChildIndex ].index;
        } );

        let prev = _lastCheckedTypeChildIndex - 1;
        if( prev < 0 ) {
            toGoAtParentIndex = --_pmiLastCheckedParentIndex;
            if( toGoAtParentIndex < 0 ) {
                toGoAtParentIndex = newPmiDataState.entities.length - 1;
            }
            toGoAtChildrenIndex = newPmiDataState.entities[ toGoAtParentIndex ].children.length - 1;
        } else {
            toGoAtParentIndex = _pmiLastCheckedParentIndex;
            toGoAtChildrenIndex = prev;
        }
    }

    _focusOnType( toGoAtParentIndex, toGoAtChildrenIndex, pmiDataState, pmiRawEntityState, viewerContextData );
};
/**
 * Handler for reorient text action
 */
export let reorientText = function( viewerContextData ) {
    viewerContextData.getPmiManager().reorientText().then( function() {
        //do nothing
    }, function( error ) {
        logger.error( 'Selection failed' + error );
    } );
};
/**
 *
 * @param {*} modelViewState
 * @param {*} entitiesState
 * @param {*} pmiRawEntityState
 */
export let updateSelectionPmiTree = function( modelViewState, entitiesState, pmiRawEntityState, viewerContextData ) {
    if( ignoreListenerIfSelectedFromPMITree ) {
        ignoreListenerIfSelectedFromPMITree = false;
        return;
    }
    let activeTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
    let isPMISelectedFromViewer = viewerContextData.getPmiManager().getValueOnPmiToolState( 'selectedPMIFromViewer' );
    let resourceIdFromViewer = viewerContextData.getPmiManager().getValueOnPmiToolState( 'resourceIDForSelectedPMIFromViewer' );
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    let newModelViewData = { ...modelViewState.getValue() };
    let newPmiData = { ...entitiesState.getValue() };
    let pmiEntityIndex = _.findIndex( newPmiRawEntityState.pmiEntityRawData, entity => entity.resourceId === resourceIdFromViewer );
    if( newPmiRawEntityState.previousSelectedPmiEntity.position > -1 ) {
        if( newPmiRawEntityState.previousSelectedPmiEntity.child &&
            newPmiRawEntityState.previousSelectedPmiEntity.position !== pmiEntityIndex ) {
            let atomicState = activeTabIndex === 1 ? entitiesState : modelViewState;
            _updateSelectionOfEntities( atomicState, pmiRawEntityState, newPmiRawEntityState.previousSelectedPmiEntity.position, false );
        } else if( !newPmiRawEntityState.previousSelectedPmiEntity.child ) {
            let mvIndex = -1;
            if( newModelViewData.modelViewData ) {
                mvIndex = _.findIndex( newModelViewData.modelViewData, modelView => modelView.mvIndex === newPmiRawEntityState.previousSelectedPmiEntity.position );
            }
            if( mvIndex > -1 && newModelViewData.modelViewData[ newPmiRawEntityState.previousSelectedPmiEntity.position ].selected ) {
                newModelViewData.modelViewData[ newPmiRawEntityState.previousSelectedPmiEntity.position ].selected = false;
                modelViewState.update( newModelViewData );
            } else {
                let pmiGrpIndex = -1;
                if( !_.isUndefined( newPmiData.entities ) ) {
                    pmiGrpIndex = _.findIndex( newPmiData.entities, pmiGrp => pmiGrp.index === newPmiRawEntityState.previousSelectedPmiEntity.position );
                }
                if( pmiGrpIndex > -1 ) {
                    newPmiData.entities[ newPmiRawEntityState.previousSelectedPmiEntity.position ].selected = false;
                    entitiesState.update( newPmiData );
                }
            }
        }
    }

    if( activeTabIndex === 0 ) {
        _updateSelectionOfEntities( modelViewState, pmiRawEntityState, pmiEntityIndex, isPMISelectedFromViewer );
        //update PreviousSelectionObject
        _updatedSelection( isPMISelectedFromViewer, pmiRawEntityState, pmiEntityIndex, true );
    } else {
        _updateSelectionOfEntities( entitiesState, pmiRawEntityState, pmiEntityIndex, isPMISelectedFromViewer );
        //update PreviousSelectionObject
        _updatedSelection( isPMISelectedFromViewer, pmiRawEntityState, pmiEntityIndex, true );
    }
};

export let updatePmiEntityFromContextMenu = function( modelViewState, entitiesState, pmiRawEntityState, viewerContextData ) {
    let pvwIdsForHiddenPmiFromContextMenu = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_PVW_IDS_FROM_CONTEXT_MENU );
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    let pmiEntityIndex = [];
    _.forEach( pvwIdsForHiddenPmiFromContextMenu, function( value ) {
        pmiEntityIndex.push( _.find( newPmiRawEntityState.pmiEntityRawData, entity => value.includes( entity.uniqueId ) ) );
    } );
    if( pmiEntityIndex.length > 0 ) {
        for( let i = 0; i < pmiEntityIndex.length; i++ ) {
            newPmiRawEntityState.pmiEntityRawData[ pmiEntityIndex[ i ].index ].isVisibilityOn = false;
        }
        //update Pmi raw entity state visibility
        pmiRawEntityState.update( newPmiRawEntityState );
        let pmiActiveTabIndex = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_ACTIVE_TAB_INDEX );
        if( pmiActiveTabIndex === 0 ) {
            _updateModelViewChildrenUsingUniqueId( modelViewState, pmiEntityIndex );
        } else {
            _updatePmiEntityTypesUsingUniqueId( entitiesState, pmiEntityIndex );
        }
    }
    viewerContextData.getPmiManager().updatePmiToolState( viewerPmiManager.GEOANALYSIS_PMI_PVW_IDS_FROM_CONTEXT_MENU, null );
};

var _updatePmiEntityTypesUsingUniqueId = function( entitiesState, pmiEntityIndex ) {
    let newEntitiesState = { ...entitiesState.getValue() };
    for( let i = 0; i < pmiEntityIndex.length; i++ ) {
        let pmiExtractedObject = newEntitiesState.entities.filter( parent => parent.label === pmiEntityIndex[ i ].type );
        for( let pos = 0; pos < newEntitiesState.entities[ pmiExtractedObject[ 0 ].index ].children.length; pos++ ) {
            if( newEntitiesState.entities[ pmiExtractedObject[ 0 ].index ].children[ pos ].uniqueId === pmiEntityIndex[ i ].uniqueId ) {
                uwPropertySvc.setValue( newEntitiesState.entities[ pmiExtractedObject[ 0 ].index ].children[ pos ].checkbox, false );
                break;
            }
        }
        uwPropertySvc.setValue( newEntitiesState.entities[ pmiExtractedObject[ 0 ].index ].checkbox, false );
        newEntitiesState.lastCheckedTypeViewModel = _.filter( newEntitiesState.lastCheckedTypeViewModel, entity => entity !== pmiEntityIndex[ i ].index );
    }
    entitiesState.update( newEntitiesState );
};

var _updateModelViewChildrenUsingUniqueId = function( modelViewState, pmiEntityIndex ) {
    let newModelViewData = { ...modelViewState.getValue() };
    for( let i = 0; i < pmiEntityIndex.length; i++ ) {
        let parentModelViewsOfEntity = pmiEntityIndex[ i ].parentModelView;
        if( parentModelViewsOfEntity.size > 0 ) {
            parentModelViewsOfEntity.forEach( function( pmValue ) {
                for( let pos = 0; pos < newModelViewData.modelViewData[ pmValue ].children.length; pos++ ) {
                    if( newModelViewData.modelViewData[ pmValue ].children[ pos ].uniqueId === pmiEntityIndex[ i ].uniqueId ) {
                        uwPropertySvc.setValue( newModelViewData.modelViewData[ pmValue ].children[ pos ].checkbox, false );
                        break;
                    }
                }
            } );
        }
    }
    modelViewState.update( newModelViewData );
};

export default exports = {
    handleTabSelectionChange,
    stepThroughPrev,
    stepThroughNext,
    initialize,
    fetchLeafStructureData,
    updateSelectionWithDisplayStrings,
    updateMVTabViewModel,
    updateTypesTabViewModel,
    modelViewEntryChecked,
    pmiEntityModelViewNodeClicked,
    typesEntryChecked,
    reorientText,
    clearPmiCtx,
    getCurrentSelection,
    turnOnVisibility,
    fetchPmiData,
    updatePmiEntityFromContextMenu,
    updateSelectionPmiTree,
    getReferenceSetsList,
    hidePopupChangeReferenceSets,
    applyPreferenceSet,
    onUpdateRefSet,
    onUpdateTargetCsids,
    nodesLoadedAction,
    initializeRefSet,
    processLeafNodeData,
    clearLeafStructDataProvider,
    selectInLeafStructTree,
    updateLeafNodeSelectionIn3D,
    updateLeafTreeDataFromCachedMap,
    selectFromNewlyLoadedNodesInLeafStructTree,
    selectLeafStructureTab
};
