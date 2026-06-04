// Copyright (c) 2023 Siemens

/**
 * @module js/hostedDiscoveryFilterService
 */

import appCtxSvc from 'js/appCtxService';
import discFilterSvc from 'js/discoveryFilterService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import recipeHandler from 'js/recipeHandler';
import soaSvc from 'soa/kernel/soaService';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import dms from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import logger from 'js/logger';
let exports = {};

// Hosted Cache
let hostedPciVsFilterInfoEntry = {};
let subsetElementInfo = {};

// Product context key string
let _contextKey = null;

/**
  * To switch between discovery sub panel and structure filter panel
  * @param {Object} sharedData - shared data
  * @returns {Object} sharedData - updated shared data
  */
export const updateSharedActiveViewBasedOnPCI = ( sharedData ) => {
    let newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : {};

    let currentActiveView = newSharedData.activeView;

    if( currentActiveView && ( currentActiveView === 'Awb0DiscoveryFilterCommandSubPanel' || currentActiveView === 'ProximitySubPanel' || currentActiveView === 'BoxZoneSubPanel' ||
             currentActiveView === 'PlaneZoneSubPanel' || currentActiveView === 'Awb0FilterPanelSettings' ) ) {
        return newSharedData;
    }
    newSharedData.activeView = 'Awb0DiscoveryFilterCommandSubPanel';
    return newSharedData;
};

let clearCategoriesFromSearchStateBeforeApplyingFilters = function( ) {
    let newSearchState = {};
    newSearchState.searchInProgress = true;
    return newSearchState;
};

export let applyFilterForHosted = function( updateAtomicData, sharedData, occContext ) {
    let transientRecipeInfo = recipeHandler.getTransientRecipeInfo( _contextKey );
    let updateSearchStateAtomicData = updateAtomicData.searchState;
    let searchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
    updateSearchStateAtomicData( searchState );
    let filterObjCandidates = appCtxSvc.getCtx( 'aw_hosting_state' );
    let soaInput = {
        inputData: {
            product: {
                type: 'Fnd0WorksetRevision',
                uid: filterObjCandidates.worksetUid
            },
            config: {
                productContext: {
                    type: hostedPciVsFilterInfoEntry.type,
                    uid: hostedPciVsFilterInfoEntry.uid
                }
            },
            requestPref: {
                filterOrRecipeChange: [ 'true' ],
                calculateFilters: [ 'true' ]
            },
            filter: {
                recipe: transientRecipeInfo[1]
            },
            focusOccurrenceInput: {
                element: {
                    type: subsetElementInfo.type,
                    uid: subsetElementInfo.uid
                }
            },
            parentElement: subsetElementInfo.props.awb0Parent.dbValues[0]
        }
    };
    soaSvc.post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', soaInput ).then( function( response ) {
        discFilterSvc.clearRecipeCache( undefined, false );
        discFilterSvc.clearCategoryLogicMap();
        // Modify searchState with updated filters
        const newSearchState = discFilterSvc.initializeSearchStateFromSoaResponse( searchState, sharedData, occContext, response.filter.searchFilterCategories, response.filter.searchFilterMap,
            response.filter.recipe, true );
        const newRecipeState = {
            isClearAll : false,
            recipe : response.filter.recipe
        };

        let updateSearchAtomicData = updateAtomicData.searchState;
        let updateRecipeAtomicData = updateAtomicData.recipeState;
        updateRecipeAtomicData( newRecipeState );
        updateSearchAtomicData( newSearchState );
        let subset = [];
        subset.push( subsetElementInfo );
        aceBackingObjectProviderService.getBackingObjects( subset ).then( bonLines => {
            // Construct beedback message and fire host event so that host can get the updated filters to show on the host native dialog
            let feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
            let objectRef = objectRefSvc.createBasicRefByModelObject( bonLines[0] );
            feedbackMessage.setFeedbackTarget( objectRef );
            feedbackMessage.setFeedbackString( 'Filters Applied from Advanced Filter Component' );
            let feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
            feedbackProxy.fireHostEvent( feedbackMessage );
        } );
    } );
};

export let getProductsInfo = function( data ) {
    if( data.elementToPCIMap ) {
        let advancedFilterInfo = appCtxSvc.getCtx( 'advanced_filter_candidates' );
        let subsetCsid = advancedFilterInfo.subsetCsid;
        for( let indx = 0; indx < data.elementToPCIMap[ 0 ].length; indx++ ) {
            if( data.elementToPCIMap[ 1 ][ indx ].uid.includes( subsetCsid.Value ) ) {
                hostedPciVsFilterInfoEntry = data.elementToPCIMap[ 1 ][ indx ];
                subsetElementInfo = data.elementToPCIMap[ 0 ][ indx ];
            }
        }
    }
};

export let getCurrentPCIuid = function() {
    return hostedPciVsFilterInfoEntry.uid;
};

export let setContextKey = function( key ) {
    _contextKey = key;
};

export let populateFilterInformation = function() {
    let initialCtx = {
        context: {
            currentState: {
                filter: '',
                pci_uid: hostedPciVsFilterInfoEntry.uid
            },
            productContextInfo: hostedPciVsFilterInfoEntry,
            requestPref: {
            },
            transientRequestPref: {
            },
            supportedFeatures: {
                Awb0EnableSmartDiscoveryFeature: true
            },
            readOnlyFeatures: {}
        },
        key: 'hostContext'
    };
    appCtxSvc.registerCtx( initialCtx.key, initialCtx.context );
    discFilterSvc.setContextKey( initialCtx.key );
    setContextKey( initialCtx.key );
    return {
        occContext: initialCtx.context
    };
};

export let updateAdvancedFilterPanel = function() {
    let subset = [];
    subset.push( subsetElementInfo );
    aceBackingObjectProviderService.getBackingObjects( subset ).then( bonLines => {
        let bomLines1 = bonLines;
        let bomLineUids = [];
        bomLineUids.push( bomLines1[0].uid );
        let policy1 = {
            types: [ {
                name: 'BOMLine',
                properties: [ {
                    name: 'fnd0ExpansionRule',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                } ]
            },
            {
                name: 'Fnd0BomExpansionRule',
                properties: [ {
                    name: 'fnd0SearchFilter',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                } ]
            } ]
        };
        let policyId1 = policySvc.register( policy1 );
        dms.loadObjects( bomLineUids ).then( function() {
            if( policyId1 ) {
                policySvc.unregister( policyId1 );
            }
            let subsetLineCdmObj = cdm.getObject( bomLines1[0].uid );
            let fnd0BomExpansionCdmObj = cdm.getObject( subsetLineCdmObj.props.fnd0ExpansionRule.dbValues[0] );
            let fnd0SearchFilterValue = fnd0BomExpansionCdmObj.props.fnd0SearchFilter;
            let recipeFromNX = appCtxSvc.getCtx( 'stringifiedRecipeFromNX' );
            let recipeAW = JSON.parse( fnd0SearchFilterValue.dbValues[0] );
            let recipeNX = JSON.parse( recipeFromNX );
            if(  recipeNX.filter && recipeNX.filter.filters && _.isArray( recipeNX.filter.filters ) && recipeAW.filter.filters.length !== recipeNX.filter.filters.length  ||
                recipeNX.filter && !recipeNX.filter.filters ) {
                dms.setProperties( [ {
                    object: fnd0BomExpansionCdmObj,
                    vecNameVal: [ {
                        name: 'fnd0SearchFilter',
                        values: [ recipeFromNX ]
                    } ]
                } ] ).then( function( response ) {
                    if( response && response.ServiceData && response.ServiceData.updated && response.ServiceData.updated.length === 0 ) {
                        logger.error( 'error occured while updating fnd0SearchFilter on opened context' );
                    }
                } );
            }
        } );
    } );
};

export default exports = {
    updateSharedActiveViewBasedOnPCI,
    applyFilterForHosted,
    getProductsInfo,
    getCurrentPCIuid,
    updateAdvancedFilterPanel,
    populateFilterInformation
};

