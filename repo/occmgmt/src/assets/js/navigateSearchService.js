// Copyright (c) 2022 Siemens

/**
 * @module js/navigateSearchService
 */

import appCtxSvc from 'js/appCtxService';
import evaluateExpressionInGivenContext from 'js/evaluateExpressionInGivenContext';
import aceToggleIndexConfigurationService from 'js/aceToggleIndexConfigurationService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import selectionModelFactory from 'js/selectionModelFactory';
import searchCommonUtils from 'js/searchCommonUtils';
import discoveryFilterService from 'js/discoveryFilterService';
import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import createWorksetService from 'js/createWorksetService';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import AwPromiseService from 'js/awPromiseService';
import uwPropertySvc from 'js/uwPropertyService';


var exports = {};

let _productContextChanged = null;
let _syncingFindSelectionsWithPWA;
let _syncingPWASelectionsWithFind;
let packedNodeToSelectionMap = [];

/**
  * Function to subscribe to product context change event on reset command execution
  * @param { Object } data view model data
  * @param { Object } subPanelContext subPanelContext
  */
export let subscribeToProductContextChangeEvent = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext )  ||
    !( data.searchStateForFind.savedQuery || data.searchStateForFind.criteria && data.searchStateForFind.criteria.searchString )  ) {
        if( subPanelContext.occContext.openedObjectType === 'WorksetRevision' || subPanelContext.occContext.openedObjectType === 'AppSessionWorkset' ) {
            eventBus.publish( 'navigate.updateFindPanelWidget' );
            return;
        }
        return;
    }
    if( !_productContextChanged ) {
        _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
            if( eventData && eventData.dataProviderActionType !== 'focusAction' && eventData.dataProviderActionType !== 'nextAction' &&
            eventData.dataProviderActionType !== 'activateWindow' && eventData.dataProviderActionType !== 'productChangedOnSelectionChange' && _productContextChanged ) {
                eventBus.unsubscribe( _productContextChanged );
                _productContextChanged = null;
                eventBus.publish( 'navigate.resetStructure' );
            }
        } );
    }
};

export let redirectCommandEvent = function( eventName, eventData ) {
    eventBus.publish( eventName, eventData );
};

export let getLiveSearchResult = function(  commandContext ) {
    let searchState = commandContext.searchState;
    if( searchState ) {
        let newSearchState = { ...searchState.getValue() };
        newSearchState.showLiveSearchResultCommand = false;
        newSearchState.hideFilters = true;
        newSearchState.additionalCriteria.useAlternateConfig = 'false';
        commandContext.searchState.update && commandContext.searchState.update( newSearchState );
        searchCommonUtils.updateSearchState( searchState.criteria.searchString, commandContext );
    }
};

export let parseExpression = function( data, ctx, conditions, expression, type ) {
    return evaluateExpressionInGivenContext.parseExpression( data, ctx, conditions, expression, type );
};

export let getIndexOffProductListInLocalStorage = function() {
    return aceToggleIndexConfigurationService.getIndexOffProductListInLocalStorage().join( '|' );
};

export let getProductContextUids = function( subPanelContext ) {
    if( subPanelContext ) {
        var occContextValue = subPanelContext.occContext.getValue();
        var elementToPCIMap = occContextValue.elementToPCIMap;
        var pCtx = occContextValue.productContextInfo;
        return elementToPCIMap ? Object.values( elementToPCIMap ).join( '|' ) : pCtx.uid;
    }
};


export let updateSearchScopeLabel = function(  searchScope, subPanelContext, hasSelectionChanged ) {
    var resource = 'OccurrenceManagementConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var message = localTextBundle.searchScopeText;
    let searchScopeDbValue = searchScope.dbValue;

    let selectedString;
    if ( subPanelContext.occContext && subPanelContext.occContext.pwaSelection && subPanelContext.occContext.pwaSelection.length > 0
        && subPanelContext.occContext.pwaSelection[ 0 ].props && subPanelContext.occContext.pwaSelection[ 0 ].props.object_string ) {
        selectedString  = subPanelContext.occContext.pwaSelection[ 0 ].props.object_string.dbValues[0];
    }else if(  subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0
        && subPanelContext.selectionData.selected[ 0 ].props && subPanelContext.selectionData.selected[ 0 ].props.object_string ) {
        selectedString = subPanelContext.selectionData.selected[ 0 ].props.object_string.dbValues[0];
    }
    if( selectedString ) {
        selectedString = message.replace( '{0}', selectedString );
    }
    // In the event that unifiedInContextSearchConfig is undefined, use hasSelectionChanged instead
    // Checkbox should be cleared upon any selection change
    if( subPanelContext.occContext.unifiedInContextSearchConfig ) {
        searchScopeDbValue = subPanelContext.occContext.unifiedInContextSearchConfig.selectSearchScopeCheckbox;
    } else if ( hasSelectionChanged ) {
        searchScopeDbValue = false;
    }
    return [
        selectedString, searchScopeDbValue
    ];
};

/**
  * Move one down from current selected search result
  *
  * @param {Object} commandContext - panel command context
  * @param {Object} moveTo - Direction to move to
  */
export let moveUpDown = function( commandContext, moveTo ) {
    let selection = commandContext.selectionData.selected[0];
    if( selection ) {
        const dp = commandContext.selectionModel.getDpListener();
        let vmoList = dp.vmCollectionObj.vmCollection.loadedVMObjects;
        var selectedIndex = _.findIndex( vmoList, function( vmo ) {
            return vmo.uid === selection.uid;
        } );
        if( selectedIndex !== -1 ) {
            if( moveTo === 'Down' ) {
                dp.changeObjectsSelection( selectedIndex + 1, selectedIndex + 1, true );
            }
            if( moveTo === 'Up' ) {
                dp.changeObjectsSelection( selectedIndex - 1, selectedIndex - 1, true );
            }
        }
    }
};

/**
  * SelectAll/ClearAll currently loaded objects
  *
  * @param {Object} commandContext -  panel command context
  *
  */
export let toggleSelectAllResults = function( commandContext ) {
    const dp = commandContext.selectionModel.getDpListener();
    var areAllResultsSelected = commandContext.selectionModel.getCurrentSelectedCount() === dp.vmCollectionObj.vmCollection.totalObjectsLoaded;
    areAllResultsSelected || commandContext.selectionModel.selectionState === 'all' ? dp.selectNone() : dp.selectAll();
};

let isUpdatedContextSameAsPanelContext = function( data, subPanelContext ) {
    if( data && subPanelContext ) {
        return data.navigateContext.dbValue === subPanelContext.occContext.viewKey;
    }
    return false;
};

let doesSelectionBelongToNonDiscoveryIndexedProduct = function( selections, occContext ) {
    if( occContext.openedObjectType === 'WorksetRevision' || occContext.openedObjectType === 'AppSessionWorkset' && selections && selections.length === 1 ) {
        var pciModelObject = cdmSvc.getObject( occmgmtSubsetUtils.getProductContextForProvidedObjectFromOccContext( selections[0], occContext ) );
        if( pciModelObject ) {
            let productObject = cdmSvc.getObject( pciModelObject.props.awb0Product.dbValues[ 0 ] );
            if( productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) < 0 ) {
                let supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObject );
                if ( supportedFeatures && supportedFeatures.Awb0EnableSmartDiscoveryFeature === undefined ) {
                    return true;
                }
            }
        }
    }

    return false;
};

let doesWorksetHaveNonDiscoveryIndexedProduct = function( elementToPCIMap ) {
    for ( let eachElement in elementToPCIMap ) {
        var pciModelObj = cdmSvc.getObject( elementToPCIMap[eachElement] );
        let productObject = cdmSvc.getObject( pciModelObj.props.awb0Product.dbValues[ 0 ] );
        if( productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) < 0 ) {
            let supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObj );
            if ( supportedFeatures && supportedFeatures.Awb0EnableSmartDiscoveryFeature === undefined ) {
                return true;
            }
        }
    }
    return false;
};

let shouldShowFindWithin = function( subPanelContext ) {
    let showFindIn = false;
    if( subPanelContext.occContext.pwaSelection && subPanelContext.occContext.pwaSelection.length === 1 ) {
        let isSingleSelectionPresent = subPanelContext.occContext.pwaSelection[0].props.object_string;
        let isPartitionSelected = subPanelContext.occContext.pwaSelection[0].modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) > -1;
        let isWorksetSelected = subPanelContext.occContext.pwaSelection[0].modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ||
        createWorksetService.isWorkset( subPanelContext.occContext.pwaSelection[0] );
        let isValidSelection = subPanelContext.occContext.currentState.c_uid !== subPanelContext.occContext.currentState.t_uid;
        let isLeafNode =  subPanelContext.occContext.pwaSelection[0].props.awb0NumberOfChildren && subPanelContext.occContext.pwaSelection[0].props.awb0NumberOfChildren.dbValues[0] === '0';

        showFindIn = isSingleSelectionPresent && isValidSelection && !isLeafNode && !isPartitionSelected && !isWorksetSelected;
    }
    if( showFindIn ) {
        showFindIn = !doesSelectionBelongToNonDiscoveryIndexedProduct( subPanelContext.occContext.pwaSelection, subPanelContext.occContext );
    }

    return showFindIn;
};

let showFindInfoMessage = function( occContext ) {
    if( occContext.openedObjectType === 'WorksetRevision' || occContext.openedObjectType === 'AppSessionWorkset' ) {
        return doesWorksetHaveNonDiscoveryIndexedProduct( occContext.elementToPCIMap );
    }
    return false;
};

export let updateAdditionalSearchCriteria = function( data, subPanelContext, searchScope, hasSelectionChanged ) {
    if( !subPanelContext?.occContext || !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return {
            searchScope: data.searchScope,
            shouldShowFindIn: data.showFindIn,
            shouldShowFindInfoMessage: data.shouldShowFindInfoMessage,
            shouldShowDiscoveryIndexedProductsMessage: data.shouldShowDiscoveryIndexedProductsMessage
        };
    }
    let searchStateForFind = data.searchStateForFind;
    let findAdditionalCriteria = data.searchStateForFind.additionalCriteria;

    let [ selectedString, searchScopeDbValue, hideFilters ] = updateFindSearchCriteriaOnSearchState( subPanelContext,
        searchScope, hasSelectionChanged, findAdditionalCriteria );

    //Update property policy
    let aceSearchPolicyOverride;
    let altPwaViews = _.get( subPanelContext, 'pageContext.sublocationState.viewModeContext.displayedViewModes.altPwaViews', [] );
    let secondaryActiveTabId = _.get( subPanelContext, 'pageContext.secondaryActiveTabId', '' );

    let is3DNotVisible = secondaryActiveTabId && secondaryActiveTabId !== 'Awv0StructureViewerPageContainer';
    let is3DNotVisibleInflexibleLayout = altPwaViews.length > 0 && altPwaViews.indexOf( 'Awv0StructureViewerPageContainer' ) === -1;

    if( is3DNotVisible || is3DNotVisibleInflexibleLayout ) {
        aceSearchPolicyOverride = { types: appCtxSvc.ctx.aceSearchPolicyOverride.types, override: true };
    }

    // Update search state
    let openObjectName = subPanelContext.occContext.topElement.props.object_string.dbValues[0];
    let searchStateForFindUpdater = data.updateAtomicData.searchStateForFind;
    // Callback for setting initial search state values on new search
    if( _.isUndefined( searchStateForFind.updateSearchCriteriaCallback ) ) {
        let updateSearchCriteriaCallback = function( criteria ) {
            criteria.forceThreshold = 'true';
            return criteria;
        };
        searchStateForFindUpdater( { ...searchStateForFind, hideFilters: hideFilters, policy: aceSearchPolicyOverride, additionalCriteria: findAdditionalCriteria,
            updateSearchCriteriaCallback: updateSearchCriteriaCallback, openObjectName: openObjectName } );
    }else{
        searchStateForFindUpdater( { ...searchStateForFind, hideFilters: hideFilters, policy: aceSearchPolicyOverride, additionalCriteria: findAdditionalCriteria, openObjectName: openObjectName } );
    }

    let updatedPanelMessages = updateFindPanelWidget( subPanelContext );
    let updateSearchScopeVmProp = _.cloneDeep( data.searchScope );
    uwPropertySvc.setValue( updateSearchScopeVmProp, searchScopeDbValue );
    updateSearchScopeVmProp.propertyDisplayName = selectedString;
    updatedPanelMessages.searchScope = updateSearchScopeVmProp;

    return updatedPanelMessages;
};

export let updateFindPanelWidget = function( subPanelContext ) {
    let shouldShowFindIn = shouldShowFindWithin( subPanelContext );
    let shouldShowDiscoveryIndexedProductsMessage = doesSelectionBelongToNonDiscoveryIndexedProduct( subPanelContext.occContext.pwaSelection, subPanelContext.occContext );
    let shouldShowFindInfoMessage = showFindInfoMessage( subPanelContext.occContext );

    return {
        shouldShowFindIn: shouldShowFindIn,
        shouldShowFindInfoMessage: shouldShowFindInfoMessage,
        shouldShowDiscoveryIndexedProductsMessage: shouldShowDiscoveryIndexedProductsMessage
    };
};

let updateFindSearchCriteriaOnSearchState = function( subPanelContext, searchScope, hasSelectionChanged, findAdditionalCriteria ) {
    var hideFilters = true;
    if( subPanelContext.occContext.supportedFeatures.Awb0EnableFilterInFullTextSearchFeature ||
         subPanelContext.occContext.supportedFeaturesInWC && subPanelContext.occContext.supportedFeaturesInWC.Awb0EnableFilterInFullTextSearchFeature ||
        subPanelContext.occContext.supportedFeatures.Awb0UnifiedFindInStructure ) {
        hideFilters = false;
    }

    var searchContext;
    if( subPanelContext.occContext.productContextInfo && ( !subPanelContext.occContext.isOpenedUnderAContext || subPanelContext.occContext.workingContextObj &&
        subPanelContext.occContext.workingContextObj.modelType && subPanelContext.occContext.workingContextObj.modelType.typeHierarchyArray.includes( 'CCObject' )  ) ) {
        searchContext =  subPanelContext.occContext.productContextInfo.uid;
    }else if( subPanelContext.occContext.workingContextObj ) {
        searchContext =  subPanelContext.occContext.workingContextObj.uid;
    }

    var includeConnections;
    if( subPanelContext.occContext.persistentRequestPref &&
        subPanelContext.occContext.persistentRequestPref.includeConnections ) {
        includeConnections = 'True';
    }else{
        includeConnections = '';
    }

    let productContextsToBeExcludedFromSearch = exports.getIndexOffProductListInLocalStorage();
    let productContextUids = exports.getProductContextUids( subPanelContext );
    let selectedObjectUid;
    if(  subPanelContext.selectionData && subPanelContext.selectionData.selected &&  subPanelContext.selectionData.selected.length > 0 ) {
        selectedObjectUid = subPanelContext.selectionData.selected[0].uid;
    }else if(  subPanelContext.occContext && subPanelContext.occContext.pwaSelection &&  subPanelContext.occContext.pwaSelection.length > 0 ) {
        selectedObjectUid = subPanelContext.occContext.pwaSelection[0].uid;
    }

    // Decision to populate searchScopeUid will be done after evaluation of searchScope dbValue
    let [ selectedString, searchScopeDbValue ] = updateSearchScopeLabel( searchScope,  subPanelContext, hasSelectionChanged );
    let searchScopeUid = '';
    if( searchScopeDbValue && selectedObjectUid ) {
        searchScopeUid = selectedObjectUid;
    }

    // Update find search criteria
    findAdditionalCriteria.searchContext = searchContext;
    findAdditionalCriteria.savedQueryUID = '';
    findAdditionalCriteria.includeConnections = includeConnections;
    findAdditionalCriteria.useAlternateConfig = 'true';
    findAdditionalCriteria.productContextsToBeExcludedFromSearch = productContextsToBeExcludedFromSearch;
    findAdditionalCriteria.searchScope =  searchScopeUid;
    findAdditionalCriteria.productContextUids = productContextUids;
    findAdditionalCriteria.selectedLine = selectedObjectUid;
    findAdditionalCriteria.forceThreshold = 'true';
    return [ selectedString, searchScopeDbValue, hideFilters ];
};


export let updateSearchScopeOnSearchState = function( searchStateForFind, searchStateUpdater, subPanelContext, searchScope ) {
    let selectedObjectUid;
    if ( subPanelContext.occContext && subPanelContext.occContext.pwaSelection && subPanelContext.occContext.pwaSelection.length > 0 ) {
        selectedObjectUid  = subPanelContext.occContext.pwaSelection[ 0 ].uid;
    }else if(  subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        selectedObjectUid  = subPanelContext.selectionData.selected[ 0 ].uid;
    }

    let findAdditionalCriteria = searchStateForFind.additionalCriteria;
    let findStateUpdater = searchStateUpdater.searchStateForFind;
    if( searchScope.dbValue ) {
        findAdditionalCriteria.searchScope = selectedObjectUid;
    }else{
        findAdditionalCriteria.searchScope = '';
    }
    findStateUpdater( { ...searchStateForFind, additionalCriteria: findAdditionalCriteria } );
};

export let searchWithoutForceThreshold = function( searchStateForFind, searchStateUpdater ) {
    let searchStateForFindUpdater = searchStateUpdater.searchStateForFind;
    let findCriteria = searchStateForFind.criteria;
    findCriteria.forceThreshold = 'false';
    let criteriaJSONString = JSON.stringify( findCriteria );
    let findAdditionalCriteria =  searchStateForFind.additionalCriteria;
    findAdditionalCriteria.forceThreshold = 'false';
    searchStateForFindUpdater( { ...searchStateForFind, criteria: findCriteria, additionalCriteria: findAdditionalCriteria, criteriaJSONString: criteriaJSONString } );
};

export let cancelSearchAfterThresholdExceeded = function( searchStateForFind, searchStateUpdater ) {
    // Reset  thresholdExceeded flag
    let searchStateForFindUpdater = searchStateUpdater.searchStateForFind;
    searchStateForFindUpdater( { ...searchStateForFind, thresholdExceeded: undefined } );
};

var isSearchResultSelectionSameAsPWA = function( searchResultSelection, pwaSelection ) {
    var isSelectionSame = true;
    if( searchResultSelection && pwaSelection ) {
        if ( searchResultSelection.length !== pwaSelection.length ) {
            isSelectionSame = false;
        }else {
            _.forEach( searchResultSelection, function( searchObj ) {
                var pwaSelectedObject = _.find( pwaSelection, function( pwaObj ) {
                    if( pwaObj.uid === searchObj || pwaObj.uid === searchObj.uid ) {
                        return pwaObj;
                    }
                } );
                if( !pwaSelectedObject ) {
                    isSelectionSame = false;
                }
            } );
        }
    }else if( searchResultSelection && !pwaSelection ||  !searchResultSelection && pwaSelection ) {
        isSelectionSame = false;
    }

    return isSelectionSame;
};

/**
 * Checks if the PWA selection and find panel selections are same.
 * Packed node selections in PWA are considered equal to find panel selections
 * if they were initiated as selections from Find Panel
 *
 * Example: ElementA1 and ElementA2 are non pack master nodes for Element A(pack master)
 * Element A1 and ElementA2 are selected in Find Panel, then Element A gets selected in PWA
 * as PWA is in packed state
 * As a result of PWA selection, 2 update events on occContext.pwaSelection are received.
 * The first event is handled as an echo by checking global flags in this service. The second event needs to be handled
 * in a way where PWA selection of Element A and find panel selection of ElementA1 and ElementA2 have to be treated as same.
 * This method uses a map to compare such selections. And if PWA selection is not present as key in the map then 1-1 comparison
 * with all find panel selections is done.
 *
 * @param {ObjectArray} searchResultSelection find panel selected objects
 * @param {ObjectArray} pwaSelection PWA selected objects
 * @returns {Boolean} true if input selections are same, false otherwise
 */
var isSearchResultSelectionSameAsPWAWithPacking = function( searchResultSelection, pwaSelection ) {
    let isSelectionSame = true;
    if( searchResultSelection && pwaSelection ) {
        let entriesFound = 0;
        _.forEach( pwaSelection, function( pwaObj ) {
            let packedNodeEntryFound = false;
            if( packedNodeToSelectionMap && packedNodeToSelectionMap.length > 0 ) {
                let entry = packedNodeToSelectionMap.filter( function( x ) {
                    return x.packedNode === pwaObj;
                } );
                if( entry && entry[ 0 ] ) {
                    packedNodeEntryFound = true;
                    let selectionsToCompare =  entry[ 0 ].findSelections;
                    _.forEach( selectionsToCompare, function( selection ) {
                        let matchingSelection = _.find( searchResultSelection, function( searchObj ) {
                            if( selection === searchObj || selection === searchObj.uid ) {
                                return searchObj;
                            }
                        } );
                        if( !matchingSelection ) {
                            isSelectionSame = false;
                        }
                    } );
                    // In case we have lesser number of packed node selections being made from PWA,
                    // we maintain the record by keeping track of number of packed node entries matched
                    // If there are more entries in the map then that implies a different
                    //  set of selections being made from PWA
                    entriesFound++;
                }
            }
            // If the selection in PWA is not present in the map then check if it is in find panel selection
            if( isSelectionSame && !packedNodeEntryFound ) {
                let pwaSelectedObject = _.find( searchResultSelection, function( searchObject ) {
                    if( pwaObj.uid === searchObject || pwaObj.uid === searchObject.uid ) {
                        return pwaObj;
                    }
                    return null;
                } );
                if( !pwaSelectedObject ) {
                    isSelectionSame = false;
                }
            }
        } );
        if( packedNodeToSelectionMap && packedNodeToSelectionMap.length > 0 && entriesFound !== packedNodeToSelectionMap.length ) {
            isSelectionSame = false;
        }
    }else if( searchResultSelection && !pwaSelection ||  !searchResultSelection && pwaSelection ) {
        isSelectionSame = false;
    }

    return isSelectionSame;
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
export let getBOMLineUids = function( viewModelObjects ) {
    let deferred = AwPromiseService.instance.defer();
    aceBackingObjectProviderService.getBackingObjects( viewModelObjects ).then( function( response ) {
        return deferred.resolve( response );
    } );
    return deferred.promise;
};

/**
 * Generate map with key as packed node and values as selections in find panel for the relative packed node
 * @param {Object} visibleElement - packed node selected in PWA
 * @param {Object} findSelection - search result selection in find panel
 */
let updatePackedNodeSelectionMap = function( visibleElement, findSelection ) {
    let packedNodeToSelectionEntry;
    if( packedNodeToSelectionMap && packedNodeToSelectionMap.length > 0 ) {
        var entry = packedNodeToSelectionMap.filter( function( x ) {
            return x.packedNode === visibleElement;
        } );
        if( entry && entry[ 0 ] ) {
            if( entry[0].findSelections.indexOf( findSelection.uid )  === -1 ) {
                entry[ 0 ].findSelections.push( findSelection.uid );
            }
        } else {
            packedNodeToSelectionEntry = {
                packedNode: visibleElement,
                findSelections: [ findSelection.uid ]
            };
            packedNodeToSelectionMap.push( packedNodeToSelectionEntry );
        }
    } else {
        packedNodeToSelectionEntry = {
            packedNode: visibleElement,
            findSelections: [ findSelection.uid ]
        };
        packedNodeToSelectionMap.push( packedNodeToSelectionEntry );
    }
};

let syncSelections = function( searchResultSelection, pwaSelection, totalLoadedObj, subPanelContext, objectsToSelect, highlightPartialSelection ) {
    if( searchResultSelection && searchResultSelection.length > 0  && !_syncingPWASelectionsWithFind ) {
        _syncingFindSelectionsWithPWA = true;
        if( !_.isUndefined( objectsToSelect ) && !_.isEmpty( objectsToSelect ) && highlightPartialSelection ) {
            // Publish event for ACE to highlight objects and set partial selection
            let aceSelectionUpdateEventData = {};
            aceSelectionUpdateEventData.objectsToSelect = objectsToSelect;
            aceSelectionUpdateEventData.objectsToHighlight = searchResultSelection;
            aceSelectionUpdateEventData.viewToReact = subPanelContext.occContext.viewKey;
            eventBus.publish( 'aceElementsSelectionUpdatedEvent', aceSelectionUpdateEventData );
        } else if( !isSearchResultSelectionSameAsPWA( searchResultSelection, pwaSelection ) ) {
            if( subPanelContext.selectionModel ) {
                subPanelContext.selectionModel.setSelection( searchResultSelection );
            }else {
                let value = {
                    selectionsToModify:{
                        elementsToSelect: searchResultSelection,
                        overwriteSelections: true
                    }
                };
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
            }
        }
    }else if ( searchResultSelection === null || searchResultSelection.length === 0 && totalLoadedObj > 0 && !_syncingPWASelectionsWithFind  ) {
        // Remove circular update of selections
        // Find panel selection was removed as the PWA selected object is not present in search results
        // Skip setting PWA selection to null.
        // Flag _syncingPWASelectionsWithFind indicates the find panel selection updated happened
        _syncingFindSelectionsWithPWA = true;
        if( subPanelContext.selectionModel ) {
            subPanelContext.selectionModel.setSelection( [] );
        }else {
            occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect: [], overwriteSelections: true }, subPanelContext.occContext );
        }
    }
    if( _syncingPWASelectionsWithFind ) {
        _syncingPWASelectionsWithFind = false;
    }
};


let findVisibleElementsAndSyncWithPWA = function( bomlineSRUIDs, searchResultSelection, pwaSelection, subPanelContext, totalLoadedObj ) {
    let modifiedSearchResultSelections = [];
    csidsToObjSvc.doPerformSearchForProvidedSRUIDs( bomlineSRUIDs, 'true', [ 'object_string' ] ).then( function( response ) {
        let objectsToSelect = [];
        let highlightPartialSelection = false;
        if( !_.isEmpty( response.elementsInfo )  ) {
            let searchResultUIDs = [];
            _.forEach( response.elementsInfo, function( elementsInfo, index ) {
                if( elementsInfo.visibleElement && cdmSvc.isValidObjectUid( elementsInfo.visibleElement.uid ) ) {
                    if( searchResultUIDs.indexOf( elementsInfo.visibleElement ) === -1 ) {
                        searchResultUIDs.push(  elementsInfo.visibleElement  );
                        highlightPartialSelection = true;
                    }
                    // Maintain a map of packed nodes that will be selected in PWA as a result of
                    // non pack master selection in find panel
                    updatePackedNodeSelectionMap( elementsInfo.visibleElement, searchResultSelection[index] );
                } else if( elementsInfo.element && cdmSvc.isValidObjectUid( elementsInfo.element.uid ) &&
                searchResultUIDs.indexOf( elementsInfo.element ) === -1 ) {
                    searchResultUIDs.push( elementsInfo.element );
                }
                objectsToSelect.push( elementsInfo.element );
            } );
            if( searchResultUIDs.length > 0 ) {
                modifiedSearchResultSelections = searchResultUIDs;
            }
        }else {
            modifiedSearchResultSelections = searchResultSelection;
        }
        syncSelections( modifiedSearchResultSelections, pwaSelection, totalLoadedObj, subPanelContext, objectsToSelect, highlightPartialSelection );
    } );
};

export let synchronizeFindSelectionWithPWA = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext )  ||
     !( data.searchStateForFind.savedQuery || data.searchStateForFind.criteria && data.searchStateForFind.criteria.searchString ) ) {
        _syncingPWASelectionsWithFind = false;
        return;
    }

    let searchResultSelection = data.selectionData.selected ? data.selectionData.selected : null;
    let occContextValue = subPanelContext.occContext.getValue();
    let pwaSelection = occContextValue.pwaSelection;
    const dp = data.selectionModels.findSelectionModel.getDpListener();
    let totalLoadedObj = dp.vmCollectionObj.vmCollection.totalObjectsLoaded;

    let isWorksetOrSessionWorksetOpen = subPanelContext.occContext.openedObjectType &&
    ( subPanelContext.occContext.openedObjectType === 'WorksetRevision' ||
    subPanelContext.occContext.openedObjectType === 'AppSessionWorkset' );

    // TODO: call only when the selection is not visible in PWA
    if( searchResultSelection.length > 0 && ( discoveryFilterService.isDiscoveryIndexed() || isWorksetOrSessionWorksetOpen ) && !_syncingPWASelectionsWithFind ) {
        // Only find visible elements if structure is discovery indexed or opened object is workset or session workset

        // For every selection on find panel, get bomline SRUID
        getBOMLineUids( searchResultSelection ).then( function( bomlineSRUIDsResponse ) {
            var bomlineSRUIDs = [];
            _.forEach( bomlineSRUIDsResponse, function( bomLine, index ) {
                bomlineSRUIDs[ index ] = bomLine.uid;
            } );
            if( bomlineSRUIDs.length > 0 ) {
                findVisibleElementsAndSyncWithPWA( bomlineSRUIDs, searchResultSelection, pwaSelection, subPanelContext, totalLoadedObj );
            }
        } );
    } else {
        syncSelections( searchResultSelection, pwaSelection, totalLoadedObj, subPanelContext );
    }
};


export let synchronizePWASelectionWithSearchResults = function( data, subPanelContext ) {
    if( _syncingFindSelectionsWithPWA ) {
        // Remove circular update of selections
        // Selection was triggered from find panel to update PWA selection, skip reacting to PWA selection change
        _syncingFindSelectionsWithPWA = false;
        return;
    }
    let isCompareMode =  subPanelContext.compareContext && subPanelContext.compareContext.isInCompareMode;
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) && !isCompareMode ) {
        _syncingPWASelectionsWithFind = false;
        return;
    }
    if( _syncingPWASelectionsWithFind ) {
        _syncingPWASelectionsWithFind = false;
    }

    let occContextValue = subPanelContext.occContext.getValue();
    let pwaSelection = occContextValue.pwaSelection ? occContextValue.pwaSelection : [];
    const dp = data.selectionModels.findSelectionModel.getDpListener();
    let totalLoadedObj = 0;
    if( dp && dp.vmCollectionObj && dp.vmCollectionObj.vmCollection ) {
        totalLoadedObj = dp.vmCollectionObj.vmCollection.totalObjectsLoaded;
    }
    // Skip setting selections if no results in find panel
    if( pwaSelection && pwaSelection.length > 0 && totalLoadedObj > 0 ) {
        // Skip setting selections if find panel selection matches PWA selection
        let searchResultSelection = data.selectionModels.findSelectionModel.getSelection() ? data.selectionModels.findSelectionModel.getSelection() : null;

        // Check if the selection event from PWA is for the packed nodes that were selected
        // as a result of non pack master selection in find panel. If all selections in PWA exist as keys in the map,
        // then selections are considered as same as find panel and the current find panel selections are not updated and
        // retained as-is.
        if( !isSearchResultSelectionSameAsPWAWithPacking( searchResultSelection, pwaSelection ) ) {
            // Does search result contain the PWA selection? If yes, then set _syncingPWASelectionsWithFind to true
            // If not then _syncingPWASelectionsWithFind does not need setting as no events are fired
            // when selection is not present in search results
            let loadedVMObjects = dp.vmCollectionObj.vmCollection.getLoadedViewModelObjects();
            let hasSelection = doSearchResultsContainPWASelection( loadedVMObjects, pwaSelection );

            if( hasSelection || searchResultSelection && searchResultSelection.length > 0 ) {
                _syncingPWASelectionsWithFind = true;
            }
            selectionModelFactory.setSelection( data.selectionModels.findSelectionModel, pwaSelection );
            // Clear packedNode to find selection map
            clearPanelData();
        }
    }
};

let doSearchResultsContainPWASelection = function( searchResults, pwaSelection ) {
    for( let index = 0; index < pwaSelection.length; index++ ) {
        let selectedObjInSearchIndex = _.findLastIndex( searchResults, function( vmo ) {
            return vmo.uid === pwaSelection[index].uid;
        } );
        if( selectedObjInSearchIndex > -1 ) {
            return true;
        }
    }
    return false;
};

export let updateCommandVisibilityOnSearchExecution = function( data ) {
    // Reset search scope value
    let searchScope = '';
    if( data.subPanelContext.occContext && data.subPanelContext.occContext.unifiedInContextSearchConfig
        && data.subPanelContext.occContext.unifiedInContextSearchConfig.selectSearchScopeCheckbox ) {
        data.dispatch( { path: 'data.searchScope.dbValue', value: true } );
        if( data.selectionData.selected && data.selectionData.selected.length > 0 ) {
            searchScope = data.selectionData.selected[0].uid;
        }
    } else {
        data.dispatch( { path: 'data.searchScope.dbValue', value: false } );
    }

    let searchStateForFind = data.searchStateForFind;

    let hideFilters = true;
    if( data.subPanelContext.occContext.supportedFeatures.Awb0EnableFilterInFullTextSearchFeature ||
        data.subPanelContext.occContext.supportedFeaturesInWC && data.subPanelContext.occContext.supportedFeaturesInWC.Awb0EnableFilterInFullTextSearchFeature ||
       data.subPanelContext.occContext.supportedFeatures.Awb0UnifiedFindInStructure ) {
        hideFilters = false;
    }
    if( _.isUndefined( searchStateForFind.savedQuery ) || _.isEmpty( searchStateForFind.savedQuery ) ) {
        let findAdditionalCriteria = searchStateForFind.additionalCriteria;
        findAdditionalCriteria.searchScope = searchScope;
        let searchStateForFindUpdater = data.updateAtomicData.searchStateForFind;
        if( searchStateForFind.criteria && searchStateForFind.criteria.searchString ) {
            // Update Show Results Only and Show Latest command visibility
            if( findAdditionalCriteria.useAlternateConfig && findAdditionalCriteria.useAlternateConfig === 'true' ) {
                if( discoveryFilterService.isDiscoveryIndexed() ) {
                    searchStateForFindUpdater( { ...searchStateForFind, hideFilters: hideFilters,
                        showLiveSearchResultCommand: false, additionalCriteria: findAdditionalCriteria } );
                } else {
                    // Case: Viewing indexed search results
                    searchStateForFindUpdater( { ...searchStateForFind,
                        hideFilters: hideFilters, showLiveSearchResultCommand: true, searchScope: '', additionalCriteria: findAdditionalCriteria } );
                }
            } else if( findAdditionalCriteria.useAlternateConfig && findAdditionalCriteria.useAlternateConfig === 'false' ) {
                // Case: Viewing non-indexed search results
                findAdditionalCriteria.useAlternateConfig = 'true';
                searchStateForFindUpdater( { ...searchStateForFind, hideFilters: true,
                    showLiveSearchResultCommand: false, additionalCriteria: findAdditionalCriteria } );
            }
        }else{
            searchStateForFindUpdater( { ...searchStateForFind, hideFilters: hideFilters, showLiveSearchResultCommand: false, additionalCriteria: findAdditionalCriteria } );
        }
    }else if( searchStateForFind && searchStateForFind.additionalCriteria && searchStateForFind.additionalCriteria.searchScope ) {
        let findAdditionalCriteria = searchStateForFind.additionalCriteria;
        findAdditionalCriteria.searchScope = searchScope;
        let searchStateForFindUpdater = data.updateAtomicData.searchStateForFind;
        searchStateForFindUpdater( { ...searchStateForFind, additionalCriteria: findAdditionalCriteria } );
    }
};


export let resetPanel = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return;
    }
    if( data && ( data.searchStateForFind.savedQuery || data.searchStateForFind.criteria && data.searchStateForFind.criteria.searchString )  ) {
        let findSearchStateValue = { ...data.searchStateForFind };
        if( findSearchStateValue.criteria && findSearchStateValue.criteria.searchString ||
            findSearchStateValue.advancedSearchCriteria ) {
            let newResetSearchState = findSearchStateValue.resetSearchState ? findSearchStateValue.resetSearchState : 0;
            newResetSearchState += 1;
            let searchStateForFindUpdater = data.updateAtomicData.searchStateForFind;
            searchStateForFindUpdater( { ...findSearchStateValue, resetSearchState: newResetSearchState } );
        }
    }
    clearPanelData();
    return updateAdditionalSearchCriteria( data, subPanelContext, data.searchScope );
};

export let clearPanelData = function() {
    packedNodeToSelectionMap = [];
};

export let updatePropertyPolicyOnSearchState = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return;
    }
    let searchStateForFind = data.searchStateForFind;
    let aceSearchPolicyOverride;
    let altPwaViews = _.get( subPanelContext, 'pageContext.sublocationState.viewModeContext.displayedViewModes.altPwaViews', [] );
    let secondaryActiveTabId = _.get( subPanelContext, 'pageContext.secondaryActiveTabId', '' );

    let is3DNotVisible = secondaryActiveTabId && secondaryActiveTabId !== 'Awv0StructureViewerPageContainer';
    let is3DNotVisibleInflexibleLayout = altPwaViews.length > 0 && altPwaViews.indexOf( 'Awv0StructureViewerPageContainer' ) === -1;

    if( is3DNotVisible || is3DNotVisibleInflexibleLayout ) {
        aceSearchPolicyOverride = { types: appCtxSvc.ctx.aceSearchPolicyOverride.types, override: true };
    }

    // Update search state
    let searchStateForFindUpdater = data.updateAtomicData.searchStateForFind;
    searchStateForFindUpdater( { ...searchStateForFind, policy: aceSearchPolicyOverride } );
};

export let getScopeForCurrentSearch = function( searchState ) {
    if( !searchState || !searchState.additionalCriteria  ) {
        return '';
    }

    if( searchState.additionalCriteria.searchScope && !_.isEmpty( searchState.additionalCriteria.searchScope ) ) {
        let scopeObject =  cdmSvc.getObject( searchState.additionalCriteria.searchScope );
        return scopeObject.props.object_string.dbValues[0];
    }
    return searchState.openObjectName;
};

export let closeFindInfoMessage = function() {
    return false;
};

/**
  * navigateSearchService service utility
  */

export default exports = {
    subscribeToProductContextChangeEvent,
    redirectCommandEvent,
    getLiveSearchResult,
    parseExpression,
    getIndexOffProductListInLocalStorage,
    getProductContextUids,
    updateSearchScopeLabel,
    moveUpDown,
    toggleSelectAllResults,
    updateAdditionalSearchCriteria,
    updateSearchScopeOnSearchState,
    synchronizeFindSelectionWithPWA,
    synchronizePWASelectionWithSearchResults,
    updateCommandVisibilityOnSearchExecution,
    resetPanel,
    clearPanelData,
    updatePropertyPolicyOnSearchState,
    searchWithoutForceThreshold,
    cancelSearchAfterThresholdExceeded,
    getScopeForCurrentSearch,
    closeFindInfoMessage,
    updateFindPanelWidget
};
