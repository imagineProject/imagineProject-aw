// Copyright (c) 2024 Siemens

/**
 * @module js/aceTreeOccContextBuilderService
 */
import cdmSvc from 'soa/kernel/clientDataModel';
import awStateService from 'js/awStateService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import _ from 'lodash';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import { setAltPwasIfApplicable } from 'js/AwStandardAlternatePWAManager';
import aceVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import aceTreeUtils from 'js/aceTreeUtils';
import aceSwaService from 'js/aceSwaService';
var exports = {};


function _updateOccContextValueWithRootElementAndSelectionSource( occContextValue ) {
    var lastSelectedObject = cdmSvc.getObject( occContextValue.currentState.c_uid );
    var productInfo = aceDataNavigatorService.getProductInfoForCurrentSelection( lastSelectedObject, occContextValue );
    if( productInfo.rootElement ) {
        occContextValue.rootElement = productInfo.rootElement;
    }
    occContextValue.pwaSelectionSource = _.isEqual( occContextValue.currentState.t_uid, occContextValue.currentState.c_uid ) ? 'base' : 'primary';
}


const _shouldActiveTabProvidedByServerBeApplied = ( treeLoadInput, treeLoadOutput, contextState ) => {
    let spageId = awStateService.instance.params[ contextState.urlParams.secondaryPageIdQueryParamKey ];
    let altPwa =  awStateService.instance.params[ contextState.urlParams.alternatePwaKey ];
    let altPwa_2 = awStateService.instance.params[ contextState.urlParams.alternatePwa2Key ];

    //tab/altPwa is already there on URL. So, ignore tab info from server. Honor client-state/tab
    if ( spageId || altPwa || altPwa_2 ) {
        return false;
    }

    if ( treeLoadOutput.sublocationAttributes && treeLoadOutput.sublocationAttributes.awb0ActiveSublocation ) {
        if( treeLoadInput.openOrUrlRefreshCase === 'open'){
            if( contextState.occContext.persistentRequestPref?.splitMode === 'true' && !aceSwaService.isTabSupportedForSplitView(treeLoadOutput.sublocationAttributes.awb0ActiveSublocation[0] ))
            {
                return false;
            }
            return true;            
        }
    }
};


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

const setAutoSavedSessiontime = ( isProductInteracted, contextState, treeLoadOutput, response ) => {
    if( !isProductInteracted ||  !_.isEmpty( contextState.context ) && _.isEqual( contextState.context.requestPref.savedSessionMode, 'ignore' ) ) {
        treeLoadOutput.autoSavedSessiontimeForRestoreOption = response.userWorkingContextInfo.autoSavedSessiontime;
    }
};

/**
 * Function to check if Awb0EnableColorFilterFeature is returned in the PCI.
 * We will set the decoratorToggle's value based on the feature.
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 */
const _updateColorToggleRelatedInfo = ( treeLoadOutput ) => {
    if( treeLoadOutput.supportedFeatures.Awb0EnableColorFilterFeature === true ) {
        treeLoadOutput.decoratorToggle = true;
        treeLoadOutput.supportsColorToggleCommand = true;
    }
};

/**
 *
 */
const _shouldTopNodeBeDisplayed = ( treeLoadOput ) => {
    return Boolean( treeLoadOput.supportedFeatures.Awb0ShowTopNodeFeature );
};

/**
 *
 * @param {*} treeLoadInput treeLoadInput structure
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 * @param {*} response getOccurrences response
 */
const _updateTopNodeRelatedInformationInOutputStructure = ( treeLoadInput, treeLoadOutput, response, contextState, occContext ) => {
    var uwci = response.userWorkingContextInfo;
    treeLoadOutput.sublocationAttributes = uwci ? uwci.sublocationAttributes : {};
    treeLoadOutput.changeContext = null;

    //If use-case is pure open and not create and open, then only use tab provided by server.
    //for create and open, honor tab populated on URL.

    if( _shouldActiveTabProvidedByServerBeApplied( treeLoadInput, treeLoadOutput, contextState )  ) {
        treeLoadOutput.tabNameToActivate = treeLoadOutput.sublocationAttributes.awb0ActiveSublocation[ 0 ];
    }

    if( response.requestPref ) {
        treeLoadOutput.requestPref.isStaleStructure = response.requestPref.isStaleStructure;
    }

    treeLoadOutput.showTopNode = _shouldTopNodeBeDisplayed( treeLoadOutput );

    if( treeLoadOutput.showTopNode === true ) {
        let addTopNodeOcc = _.isEmpty( response.parentChildrenInfos ) || !_.isEmpty( response.parentChildrenInfos ) && response.parentChildrenInfos.length === 1 && _.isEmpty( response
            .parentChildrenInfos[ 0 ].childrenInfo );
        if( addTopNodeOcc === true ) {
            treeLoadOutput.topNodeOccurrence = [];
            treeLoadOutput.topNodeOccurrence.push( response.parentOccurrence );
            delete treeLoadOutput.expandParent;
        }
    }

    aceTreeUtils.buildRootPathNodes( occContext, treeLoadOutput, response, undefined );
    aceTreeUtils.updateNewTopNodeRelatedInformation( treeLoadInput, treeLoadOutput );
};

//"ctx.locationContext.modelObject"
//"ctx.objectQuotaContext.useObjectQuota"
//"ctx.isRedLineMode"
//"ctx.changeContext"
//"ctx.occmgmtContext.modelObject"
//"ctx.occmgmtContext.sublocationAttributes"
//"ctx.occmgmtContext.autoSavedSessiontime"
//"ctx.occmgmtContext.searchFilterCategories"
//"ctx.occmgmtContext.searchFilterMap"
//"ctx.occmgmtContext.recipe"
//"ctx.occmgmtContext.sourceContextToInfoMap"
//"ctx.occmgmtContext.requestPref"
//"ctx.occmgmtContext.configContext"  --> on atomic data
//"ctx.occmgmtContext.startFreshNavigation" --> cleanup candidate. should be on transientRequestPref
//"ctx.occmgmtContext.elementToPCIMap" -->on atomic data
//"ctx.occmgmtContext.vmc"
//"ctx.occmgmtContext.treeDataProvider"
//"ctx.occmgmtContext.isChangeEnabled"
//"ctx.decoratorToggle"
/**
 */
const _buildTreeLoadOutputForInitializeAction = ( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, occContext ) => {
    treeLoadOutput.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.workingContextObj = occmgmtUtils.getSavedWorkingContext( treeLoadOutput.productContextInfo );

    var disabledFeatures = occContext.disabledFeatures; //Features that server supports but not enabled on client side.
    for( let i = 0; i < disabledFeatures.length; i++ ) {
        if( treeLoadOutput.supportedFeatures.hasOwnProperty( disabledFeatures[ i ] ) ) {
            delete treeLoadOutput.supportedFeatures[ disabledFeatures[ i ] ];
        }
    }

    treeLoadOutput.isOpenedUnderAContext = treeLoadOutput.workingContextObj !== null;
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;

    //vmc population is one time thing
    if( declViewModel && declViewModel.dataProviders ) {
        treeLoadOutput.treeDataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
        treeLoadOutput.vmc = treeLoadOutput.treeDataProvider.vmCollectionObj.vmCollection;
    }

    _updateTopNodeRelatedInformationInOutputStructure( treeLoadInput, treeLoadOutput, response, contextState, occContext );
    //LCS-582687: Color filtering should not be true if Awb0ColorFilteringFeature is not returned in PCI
    _updateColorToggleRelatedInfo( treeLoadOutput );
    setAutoSavedSessiontime( treeLoadInput.isProductInteracted, contextState, treeLoadOutput, response );

    aceGetOccsResponseService.populateRequestPrefInfoOnOccmgmtContext( treeLoadOutput, response, contextState.occContext );
    aceGetOccsResponseService.populateFeaturesInfoOnOccmgmtContext( treeLoadOutput, response, contextState.key );
    aceGetOccsResponseService.populateSourceContextToInfoMapOnOccmgmtContext( treeLoadOutput, response );

    treeLoadOutput.isRestoreOptionApplicableForProduct = aceRestoreBWCStateService.addOpenedProductToSessionStorage( treeLoadInput, treeLoadOutput, uwDataProvider, occContext );
};

const _buildOccContextValueFromTreeLoadOutputOnInitializeAction = ( treeLoadOutput, occContextValue, declViewModel ) => {
    let valuesToCopyOrUpdateOccContext = {
        displayToggleOptions: {},
        supportedFeatures: {},
        readOnlyFeatures: {},
        productContextInfo: {},
        searchFilterMap: {},
        searchFilterCategories: {},
        recipe: {},
        elementToPCIMap: {},
        selectedModelObjects: {},
        pwaSelection: {},
        tabNameToActivate: {},
        isOpenedUnderAContext: {},
        workingContextObj: {},
        topElement: {},
        openedElement: {},
        openedObjectType: '',
        worksetItemObject: {},
        rootElementInSession: {},
        currentState: {},
        previousState: {},
        showTopNode: true,
        isRestoreOptionApplicableForProduct: false,
        defaultOpenStateMessageTime: {},
        defaultOpenStateMessage: {},
        baseModelObject: {},
        persistentRequestPref: {},
        AceHeaderForApplication: '',
        sourceContextToInfoMap: {},
        xrtContext: {}
    };
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterInitializeAction = {
        configContext: {},
        transientRequestPref: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        pwaInitialized: true,
        selectionSyncInProgress: false
    }; //Some of these params (pwaReset, configContext,selectionSyncInProgress) should be directly purged from occContext

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

    occContextValue.vmc = vmc;
    occContextValue.treeDataProvider = treeDataProvider;
    occContextValue.updateOccContextStateOnTree = declViewModel.dispatch;
    occContextValue.resetTreeDataProvider = treeLoadOutput.treeDataProvider.resetDataProvider;

    updateOccContextValueWithProvidedInput( treeLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterInitializeAction );
    // persistentRequestPref.scopeForExpandBelow is set during foreground expand below calls (Next Action).
    // If it is still set, we can clear it here in Initialize Action as it is no longer needed. 
    // Otherwise, it will continue to be sent in requestPref unnecessarily.
    if( occContextValue.persistentRequestPref?.scopeForExpandBelow ) {
        delete occContextValue.persistentRequestPref.scopeForExpandBelow;
    }

    _updateOccContextValueWithRootElementAndSelectionSource( occContextValue );
};


/**
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} response GetOccurrences() response
 * @param {*} contextState context state
 * @param {*} uwDataProvider Tree Data ProviderSt
 * @param {*} occContextValue OccContextValue
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
function _buildResponseForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, occContextValue, inputOccContext, pageContext ) {
    _buildTreeLoadOutputForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, inputOccContext );

    treeLoadOutput.xrtContext = {
        productContextUid: treeLoadOutput.currentState.pci_uid,
        selectedUid: treeLoadOutput.currentState.c_uid
    };

    //update atomic data of active tabs during initialization phase
    let skipActiveTabUpdate = Boolean( !_.isUndefined( occContextValue.pwaInitialized ) );
    skipActiveTabUpdate = !_.isUndefined( occContextValue.transientRequestPref.skipActiveTabUpdate ) ? occContextValue.transientRequestPref.skipActiveTabUpdate : skipActiveTabUpdate;

    _buildOccContextValueFromTreeLoadOutputOnInitializeAction( treeLoadOutput, occContextValue, declViewModel );

    updateSWAContext( skipActiveTabUpdate, pageContext, contextState, occContextValue, treeLoadInput, treeLoadOutput );
    return occContextValue;
}

/**
 * @internal
 *
 * Funtion to update the secondary workarea context with the spageId, altPwa and altPwa_1 information.
 * First presedence given to the information present on the URL for open use cases (in case of open pwaInitialized not initialized)
 * If information not on URL then use the one provided by SOA response.
 * Also syncup the information SWAContext and occContext.currentState
 *
 * @param {*} skipActiveTabUpdate flag indicating if server provided swa tab information to be used or not
 * @param {*} pageContext page Context
 * @param {*} contextState context state
 * @param {*} occContextValue OccContextValue
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} treeLoadOutput TreeLoadOutput
 *
 */
function updateSWAContext( skipActiveTabUpdate, pageContext, contextState, occContextValue, treeLoadInput, treeLoadOutput ) {
    //Code to update secondaryActiveTabId using atomic data...
    // Tab value seen correctly in AFX code. But it didn't work. Need to check with CFX team.
    var sublocationState = pageContext && pageContext.sublocationState;
    var swaContext = sublocationState && { ...sublocationState.value };

    //Action that wants to skip tab received from server, should set skipActiveTabUpdate to true
    if( !skipActiveTabUpdate && swaContext ) {
        let spageId = awStateService.instance.params[ contextState.urlParams.secondaryPageIdQueryParamKey ];

        swaContext.secondaryActiveTabId = spageId ? spageId : treeLoadOutput.tabNameToActivate;

        if( _shouldActiveTabProvidedByServerBeApplied( treeLoadInput, treeLoadOutput, contextState ) && swaContext.viewModeContext && swaContext.viewModeContext.displayedViewModes ) {
            swaContext.viewModeContext.displayedViewModes.altPwaViews = [];
            swaContext.viewModeContext.displayedViewModes.swaViews = [];
        }

        let altPwas = [];

        if( !treeLoadInput.isResetRequest ) {
            if( awStateService.instance.params[ contextState.urlParams.alternatePwaKey ] ) {
                altPwas.push( awStateService.instance.params[ contextState.urlParams.alternatePwaKey ] );
            } else if ( swaContext.secondaryActiveTabId ) {
                /* This will come in picture when architecture object is opened for 1st time and server respond with Architecture tab on secondaryActiveTabId.
                Below code will be of no op if secondaryActiveTabId is xrt page.*/
                altPwas.push( swaContext.secondaryActiveTabId );
            }
            if( awStateService.instance.params[ contextState.urlParams.alternatePwa2Key ] ) {
                altPwas.push( awStateService.instance.params[ contextState.urlParams.alternatePwa2Key ] );
            }
        }

        let altPWAUpdated = setAltPwasIfApplicable( swaContext, altPwas );

        if( !_.isEqual( swaContext.secondaryActiveTabId, sublocationState.secondaryActiveTabId ) || altPWAUpdated ) {
            occmgmtUtils.updateValueOnCtxOrState( '', swaContext, sublocationState );
        }

        // Also update occContext field
        if( !_.isUndefined( occContextValue.currentState ) && occContextValue.currentState.spageId !== swaContext.secondaryActiveTabId ) {
            occContextValue.currentState.spageId = swaContext.secondaryActiveTabId;
        }
    }
    syncContextWithURL( occContextValue, contextState );
}

var syncContextWithURL = function( occContextValue, contextState ) {
    //Synchup the information on atomic data based on the URL values if not set yet
    if( !occContextValue.currentState.spageId  && !_.isUndefined( awStateService.instance.params[ contextState.urlParams.secondaryPageIdQueryParamKey ] ) ) {
        occContextValue.currentState.spageId = awStateService.instance.params[ contextState.urlParams.secondaryPageIdQueryParamKey ];
    }
    if( !occContextValue.currentState.altPwa && !_.isUndefined( awStateService.instance.params[ contextState.urlParams.alternatePwaKey ] ) ) {
        occContextValue.currentState.altPwa = awStateService.instance.params[ contextState.urlParams.alternatePwaKey ];
    }
    if( !occContextValue.currentState.altPwa_2 && !_.isUndefined( awStateService.instance.params[ contextState.urlParams.alternatePwa2Key ] ) ) {
        occContextValue.currentState.altPwa_2 = awStateService.instance.params[ contextState.urlParams.alternatePwa2Key ];
    }
};
var _isRootPathNodeInSyncWithResponse = function( viewModelCollection, rootPathNode, treeLoadOutput, response ) {
    if( rootPathNode.parentUid ) {
        var rootPathNodeParentNdx = viewModelCollection.findViewModelObjectById( rootPathNode.parentUid );
        if( rootPathNodeParentNdx !== -1 ) {
            var rootPathNodeParent = viewModelCollection.getViewModelObject( rootPathNodeParentNdx );

            if( rootPathNodeParent && rootPathNodeParent.children && rootPathNodeParent.children.length > 0 ) {
                for( var i = 0; i < response.parentChildrenInfos.length; i++ ) {
                    var info = response.parentChildrenInfos[ i ];

                    if( info && info.parentInfo && info.childrenInfo &&
                        ( _.isEqual( info.parentInfo.occurrenceId, rootPathNodeParent.uid ) || _.isEqual( info.parentInfo.uid, rootPathNodeParent.uid ) ) &&
                        !_.isEqual( info.childrenInfo.length, rootPathNodeParent.children.length ) ) {
                        // There is mismatch in the tree children count with the children present in response for the parent.
                        // We can not proceed with merging new nodes.
                        treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                        return;
                    }
                }
            }
            // else the parent of rootPathNode is collapsed.
        }
    }
};

// Check if the parent is fully expanded and in sync with the response
var _isParentFullyExpandedAndInSyncWithResponse = function( viewModelCollection, parentChildrenInfo ) {
    if( _.isUndefined( viewModelCollection ) || _.isUndefined( parentChildrenInfo ) ) {
        return false;
    }
    var parentNodeNdx = viewModelCollection.findViewModelObjectById( parentChildrenInfo.parentInfo.occurrenceId );
    if( parentNodeNdx !== -1 ) {
        var parentNode = viewModelCollection.getViewModelObject( parentNodeNdx );
        if( parentNode.isExpanded && parentChildrenInfo && parentChildrenInfo.parentInfo && parentChildrenInfo.childrenInfo &&
            ( _.isEqual( parentChildrenInfo.parentInfo.occurrenceId, parentNode.uid ) || _.isEqual( parentChildrenInfo.parentInfo.uid, parentNode.uid ) ) &&
            parentNode.children && !_.isEqual( parentChildrenInfo.childrenInfo.length, parentNode.children.length ) ) {
            // There is mismatch in the tree children count with the children present in response for the parent.
            // We can not proceed with merging new nodes.
            return true;
        }
    }
    return false;
};

var _populateMergeNewNodesInCurrentyLoadedTreeParameter = function( treeLoadOutput, declViewModel, response ) {
    var viewModelCollection = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders ).viewModelCollection;

    //Setting mergeNewNodesInCurrentlyLoadedTree always to true is no harm.
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = true;

    //If user has searched for an element whose parent was already expanded(and partially loaded), disable merge.
    //No mechanism to figure out where new page that has come belongs (below/above/middle of existing nodes).
    //It would create a scenario of multiple cursors for given parent.
    var lastParentChildrenInfo = _.last( response.parentChildrenInfos );
    var isParentInResponseAlreadyExpanded = _isParentFullyExpandedAndInSyncWithResponse( viewModelCollection, lastParentChildrenInfo );

    if( isParentInResponseAlreadyExpanded ) {
        treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
        return;
    }

    //Objects in RootPath already present in Tree, as placeholder parents, or as expanded sub-assemblies having has incomplete structure (incomplete head/tail).
    //do not merge new results into currently loaded tree if parents are incomplete as it will lead to parent with multiple incomplete sections in parent and
    //multiple cursors. This will leave tree in weird state. For BVR , this scenario will not arise as BVR sends all nodes at given level.
    _.forEach( treeLoadOutput.rootPathNodes, function( rootPathNode ) {
        var rootPathNodeNdx = viewModelCollection.findViewModelObjectById( rootPathNode.uid );

        if( rootPathNodeNdx !== -1 ) {
            var rootPathParentNode = viewModelCollection.getViewModelObject( rootPathNodeNdx );

            // Fix for LCS-690988
            // If all the child's of the rootPathParentNode's are loaded then we need not check for isPlaceholder
            // Tree merge should happen as cdm has all the nodes already loaded
            // Rely on the cursor information to determine this
            if( !_.isUndefined( rootPathParentNode.cursorObject ) && !_.isNull( rootPathParentNode.cursorObject )
             && !( rootPathParentNode.cursorObject.startReached && rootPathParentNode.cursorObject.endReached ) ) {
                treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                return;
            }

            var firstChildOfRootPathParentNode = _.first( rootPathParentNode.children );
            var lastChildOfRootPathParentNode = _.last( rootPathParentNode.children );

            if( firstChildOfRootPathParentNode && firstChildOfRootPathParentNode.incompleteHead ||
                lastChildOfRootPathParentNode && lastChildOfRootPathParentNode.incompleteTail ) {
                treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                return;
            }
        } else {
            _isRootPathNodeInSyncWithResponse( viewModelCollection, rootPathNode, treeLoadOutput, response );
        }
    } );
};


const _buildTreeLoadOutputForFocusAction = ( treeLoadOutput, declViewModel, response, treeLoadInput, occContext ) => {
    treeLoadOutput.rootPathNodes = aceTreeUtils.buildRootPathNodes( occContext, treeLoadOutput, response );

    //Server returned multiple levels. Merge will happen if parent this path is present in loaded structure.
    let vmNodes = aceVMTNodeCreateService.populateViewModelTreesNodesInTreeHierarchyFormat( treeLoadOutput, response, treeLoadInput );
    _populateMergeNewNodesInCurrentyLoadedTreeParameter( treeLoadOutput, declViewModel, response );

    return vmNodes;
};

/**
 * @internal
 */
export let buildOccContextValForInitializeAction = ( treeLoadInput, treeLoadOutput, declViewModel, resp, contextState, uwDataProvider, occContextVal, inputOccContext, pageContext )=>{
    let finalOccContextVal = _buildResponseForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, resp, contextState, uwDataProvider, occContextVal, inputOccContext, pageContext );
    finalOccContextVal.lastDpAction = occContextVal.transientRequestPref.lastDpAction ? occContextVal.transientRequestPref.lastDpAction : 'initializeAction';
    //SWA reload is required only if server has return the SR uid which does not changed but the properties on SWA might changed due to change in configuration.
    if ( !occContextVal.transientRequestPref.lastDpAction && !treeLoadOutput.requestPref.windowNotReused && !treeLoadOutput.supportedFeatures['4GStructureFeature'] ) {
        finalOccContextVal.lastDpAction = 'initializeActionWithWindowReuse';
    }
    return finalOccContextVal;
};

/**
 * @internal
 *
 * @param {*} occContextValue OccContextValue
 * @param {*} vmNodes VMNodes if already created
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} response GetOccurrences() response
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
export let buildResponseForFocusAction = ( occContextValue, vmNodes, treeLoadOutput, declViewModel, response, treeLoadInput, finalOccContextValue, inputOccContext )=> {
    treeLoadOutput.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( treeLoadOutput.productContextInfo );
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterFocusAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {},
        selectionsToModify: {}
    };
    let valuesToCopyOrUpdateOccContext = {
        selectedModelObjects: {},
        pwaSelection: {},
        currentState: {},
        productContextInfo: {},
        elementToPCIMap: {},
        nodeToExpandAfterFocus: {},
        supportedFeatures: {},
        readOnlyFeatures: {}
    };
    vmNodes = _buildTreeLoadOutputForFocusAction( treeLoadOutput, declViewModel, response, treeLoadInput, inputOccContext );
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterFocusAction );

    _updateOccContextValueWithRootElementAndSelectionSource( finalOccContextValue );
    return vmNodes;
};

export default exports = {
    buildOccContextValForInitializeAction,
    buildResponseForFocusAction
};
