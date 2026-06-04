// Copyright (c) 2022 Siemens

/**
 * @module js/structureFilterService
 */
import appCtxSvc from 'js/appCtxService';
import filterPanelService from 'js/filterPanelService';
import aceFilterService from 'js/aceFilterService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdm from 'soa/kernel/clientDataModel';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import searchFilterService from 'js/aw.searchFilter.service';
import filterPanelUtils from 'js/filterPanelUtils';
import filterPanelCommonUtils from 'js/filterPanelCommonUtils';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';
import occmgmtUtils from 'js/occmgmtUtils';
import aceUrlMgmtService from 'js/aceUrlManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';

var exports = {};
var _TRUE = [ 'true' ];
var _contextKey = null;
var structureFilterEventSubscriptions = [];
var pciToFilterDataMap = [];


var gatherAllFilterValuesAcrossCategories = function( categories ) {
    var filterValues = [];
    _.forEach( categories, function( category ) {
        _.forEach( category.filterValues, function( filterValue ) {
            filterValues.push( filterValue );
        } );
    } );
    return filterValues;
};

var isFilterSelected = function( filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[0] : '^';
    let urlFilterParam;
    if( appCtxSvc.ctx.splitView ) {
        urlFilterParam = AwStateService.instance.params[ appCtxSvc.ctx[ _contextKey ].urlParams.subsetFilterParamKey ];
    } else {
        urlFilterParam = AwStateService.instance.params.filter;
    }
    if( urlFilterParam && urlFilterParam.length > 0  ) {
        var isSelected = false;
        var appliedFilters = urlFilterParam.split( '~' );
        for( var filterId = 0; filterId < appliedFilters.length; filterId++ ) {
            var categories = appliedFilters[ filterId ].split( '==' );
            if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
                isSelected = categories[ 1 ].split( filterSeparator ).includes( filterValue.internalName );
                break;
            }
        }
        return isSelected;
    }
};

var isFilterValueSameAsInputFilterString = function( filterValue, inputFilterString ) {
    return filterValue.categoryName + '^^' + filterValue.internalName === inputFilterString;
};

var removeFromFilterValuesIfItDoesNotContain = function( filterValues, filterValue, whatToCheck ) {
    var entry = filterValues.filter( function( x ) {
        return x.categoryName === whatToCheck;
    } );
    if( !entry || !entry[ 0 ] ) {
        filterValues.splice( filterValues.indexOf( filterValue ), 1 );
    }
};

var removeOrphanDateEntries = function( filterValues ) {
    var isDateFilter = filterValues.filter( function( filter ) {
        return filter.type === filterPanelUtils.DATE_FILTER ||
             filter.type === filterPanelUtils.DATE_DRILLDOWN_FILTER;
    } );
    if( isDateFilter ) {
        for( var i = 0; i < isDateFilter.length; i++ ) {
            var tmpCategoryName = isDateFilter[ i ].categoryName.substring( 0, isDateFilter[ i ].categoryName
                .indexOf( '_0Z0_' ) );
            if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                     '_0Z0_year' );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_week' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                     '_0Z0_year_month' );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month_day' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                     '_0Z0_week' );
            }
        }
    }
};

var buildEffectiveFilterString = function( filterValues ) {
    removeOrphanDateEntries( filterValues );
    return getFilterString( filterValues );
};

var getFilterString = function( filterValues ) {
    var filterStringToReturn = '';
    var previousFilterValue;
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[0] : '^';

    _.forEach( filterValues, function( filterValue ) {
        if( previousFilterValue && previousFilterValue.categoryName === filterValue.categoryName ) {
            filterStringToReturn = filterStringToReturn + filterSeparator + filterValue.internalName;
        } else {
            if( filterStringToReturn === '' ) {
                filterStringToReturn = filterStringToReturn + 'StringFilter' + '^^' + filterValue.categoryName +
                     '==' + filterValue.internalName;
            } else {
                filterStringToReturn = insertFilterString( filterStringToReturn, filterValue );
            }
        }
        previousFilterValue = filterValue;
    } );
    return filterStringToReturn;
};

var insertFilterString = function( filterStringToReturn, filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[0] : '^';
    var appliedFilters = filterStringToReturn.split( '~' );
    var updatedFilterStringToReturn = '';
    for( var filterId = 0; filterId < appliedFilters.length; filterId++ ) {
        var foundCategory = false;
        var categories = appliedFilters[ filterId ].split( '==' );
        if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
            foundCategory = true;
            appliedFilters[ filterId ] = appliedFilters[ filterId ] + filterSeparator + filterValue.internalName;
            break;
        }
    }
    if ( foundCategory === true ) {
        for( var indx = 0; indx < appliedFilters.length; indx++ ) {
            if ( _.isEmpty( updatedFilterStringToReturn ) ) {
                updatedFilterStringToReturn += appliedFilters[ indx ];
            } else {
                updatedFilterStringToReturn = updatedFilterStringToReturn + '~' + appliedFilters[ indx ];
            }
        }
    } else {
        filterStringToReturn = filterStringToReturn + '~StringFilter' + '^^' + filterValue.categoryName + '==' + filterValue.internalName;
        updatedFilterStringToReturn = filterStringToReturn;
    }
    return updatedFilterStringToReturn;
};

var lookupCategoriesInfoInCache = function( productContextInfoUID ) {
    var filterData;
    var categories;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        categories = filterData[ 0 ].categories;
    }
    return categories;
};

var getEffectiveFilterString = function( category, filter, occMgmtCtx ) {
    var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
    var categories = lookupCategoriesInfoInCache( productContextInfoUID );
    var filterValues = gatherAllFilterValuesAcrossCategories( categories );
    var effectiveFilterValuesToConsider = [];
    var effectiveFilterString = '';

    var filterString;
    if( !filter ) {
        //The value is entered in the text field of the category with no initial filter value list.
        filterString = category.internalName + '^^' + category.filterValues[ 0 ].prop.dbValue;
    } else {
        //The filter value is selected/deselection from the filter value list in the category.
        filterString = filter.categoryName + '^^' + filter.internalName;
    }

    _.forEach( filterValues, function( filterValue ) {
        if( isFilterSelected( filterValue ) && !isFilterValueSameAsInputFilterString( filterValue,
            filterString ) ||
             !isFilterSelected( filterValue ) && isFilterValueSameAsInputFilterString( filterValue,
                 filterString ) ) {
            effectiveFilterValuesToConsider.push( filterValue );
        }
    } );
    effectiveFilterString = buildEffectiveFilterString( effectiveFilterValuesToConsider );
    if( !filter ) {
        //The value is entered in the text field of the category.
        if( effectiveFilterString === '' ) {
            effectiveFilterString = effectiveFilterString + 'StringFilter' + '^^' + category.internalName +
                 '==' + category.filterValues[ 0 ].prop.dbValue;
        } else {
            effectiveFilterString = effectiveFilterString + '~StringFilter' + '^^' +
                 category.internalName + '==' + category.filterValues[ 0 ].prop.dbValue;
        }
    }

    return effectiveFilterString;
};

var updateCategoriesInfoCacheForCurrentPCI = function( categories, rawCategories, rawCategoryValues, occMgmtCtx ) {
    var pciUID = occMgmtCtx.productContextInfo.uid;
    var pciVsFilterInfoEntry = {};
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        var filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );
        if( filterData && filterData[ 0 ] ) {
            filterData[ 0 ].categories = categories;
            filterData[ 0 ].rawCategories = rawCategories;
            filterData[ 0 ].rawCategoryValues = rawCategoryValues;
        } else {
            pciVsFilterInfoEntry = {
                pciUid: pciUID,
                categories: categories,
                rawCategories: rawCategories,
                rawCategoryValues: rawCategoryValues
            };
            pciToFilterDataMap.push( pciVsFilterInfoEntry );
        }
    } else {
        pciVsFilterInfoEntry = {
            pciUid: pciUID,
            categories: categories,
            rawCategories: rawCategories,
            rawCategoryValues: rawCategoryValues
        };
        pciToFilterDataMap.push( pciVsFilterInfoEntry );
    }
};

var gatherSelectedFilterValues = function( filterValues ) {
    var selectedFilterValue = [];
    _.forEach( filterValues, function( filterValue ) {
        if( filterValue.selected &&  filterValue.selected.dbValue ) {
            selectedFilterValue.push( filterValue );
        }
    } );
    return selectedFilterValue;
};

var computeFilterStringForCategories = function( categories ) {
    var filterValues = gatherAllFilterValuesAcrossCategories( categories );
    var selectedFilterValues = gatherSelectedFilterValues( filterValues );
    return buildEffectiveFilterString( selectedFilterValues );
};

export let computeFilterStringForNewProductContextInfo = function( newProductContextInfoUID ) {
    var filterString = '';
    var categories = lookupCategoriesInfoInCache( newProductContextInfoUID );
    if( categories ) {
        filterString = computeFilterStringForCategories( categories );
    }
    return filterString;
};

var updateURLAsPerCurrentProductBeingOpened = function( eventData, occContext ) {
    var newProductContextInfoUID = eventData.newProductContextUID;

    var computedFilterString = exports.computeFilterStringForNewProductContextInfo( newProductContextInfoUID );
    var filterStr = _.isEmpty( computedFilterString ) ? null : computedFilterString;
    var occContextVal = occContext.getValue();
    var contextState = aceContextStateMgmtService.createContextState( occContextVal, { filter: filterStr }, true );
    aceUrlMgmtService.updateUrlFromCurrentState(  undefined, contextState.currentState, false );
};

var clearCache = function() {
    pciToFilterDataMap = [];
};

export let clearFilterInfoFromURL = function( occContext ) {
    if( occmgmtSubsetUtils.isUserGestureToChangeConfig( occContext ) ) {
        clearCache();
    }
};


let getUnpopulatedCategoriesFilterCategories = function( soaResponseCategories, filterValues  ) {
    var populatedFilterCategories = _.cloneDeep( soaResponseCategories );
    var unpopulatedCategories = [];
    var indicesToRemove = [];
    _.forEach( soaResponseCategories, function( category, index ) {
        var filterValuesForCategory = filterValues[category.internalName];
        if( filterValuesForCategory && filterValuesForCategory.length === 0 ) {
            unpopulatedCategories.push( category );
            indicesToRemove.push( index );
        }
    } );
    while( indicesToRemove.length ) {
        populatedFilterCategories.splice( indicesToRemove.pop(), 1 );
    }
    return [ populatedFilterCategories, unpopulatedCategories ];
};

let updateFilterInfo = function( searchState, soaResponseCategories, soaResponseFilterMap, updateURL, processCategories, occContext ) {
    if( soaResponseCategories === undefined ||  soaResponseCategories.length === 0 ) {
        return;
    }

    let clonedFilterMap = _.cloneDeep( soaResponseFilterMap );
    let clonedFilterCategories = _.cloneDeep( soaResponseCategories );
    const newSearchData = { ...searchState };
    const[ populatedFilterCategories, unpopulatedFilterCategories ] = getUnpopulatedCategoriesFilterCategories( soaResponseCategories, soaResponseFilterMap );
    newSearchData.unpopulatedSearchFilterCategories = unpopulatedFilterCategories;
    newSearchData.searchFilterCategories = populatedFilterCategories;
    newSearchData.searchFilterMap = clonedFilterMap;
    newSearchData.objectsGroupedByProperty = { internalPropertyName: '' };
    newSearchData.bulkFiltering = false;
    newSearchData.searchInProgress = false;
    newSearchData.colorToggle = appCtxSvc.getCtx( 'preferences.AWC_ColorFiltering' )[ 0 ];
    var processedCategories  = filterPanelService.getCategories3( newSearchData, false ); // false for not showing date/numeric range

    _.forEach( processedCategories, function( category ) {
        var responseCategory = _.find( soaResponseCategories, function( cat ) {
            if( category.internalName === cat.internalName ) {
                return cat;
            }
        } );
        if( responseCategory ) {
            category.hasMoreFacetValues = !responseCategory.endReached;
            category.isServerSearch = !responseCategory.endReached;
            category.startIndexForFacetSearch =  responseCategory.endIndex;
        }
    } );

    if( processCategories ) {
        processCategoriesMetaDataForRendering( processedCategories );
    }

    // Update categories cache from SOA response
    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( processedCategories ), clonedFilterCategories,  clonedFilterMap, occContext );

    /**
       * There is at least one known case where the filter params are cleared from the URL when those should not
       * be because of lack of control over sequence of events. The following block will keep the URL consistent
       * in such cases.
       */
    if( updateURL && !occContext.currentState.filter ) {
        var productContextChangeData = {
            newProductContextUID: occContext.currentState.pci_uid
        };
        updateURLAsPerCurrentProductBeingOpened( productContextChangeData, occContext );
    }

    newSearchData.categories = processedCategories;
    const selectedFiltersMap = getSelectedFiltersMap( newSearchData.categories );
    newSearchData.filterString = searchFilterService.buildFilterString( selectedFiltersMap );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
    newSearchData.appliedFilterMap = selectedFiltersInfo.activeFilterMap;
    return newSearchData;
};

var getRawCategoriesAndCategoryValues = function( pci ) {
    var filterData;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === pci;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        return {
            rawCategories: filterData[ 0 ].rawCategories,
            rawCategoryValues: filterData[ 0 ].rawCategoryValues
        };
    }
};

export let getSubsetInfoSoaInput = ( occContext ) => {
    var productContextInfoUID = occContext.productContextInfo.uid;

    var subsetInputs = [ {
        productInfo: {
            type: 'Awb0ProductContextInfo',
            uid: productContextInfoUID
        },
        requestPref: {},
        searchFilterFieldSortType: '',
        searchSortCriteria: []
    } ];
    if( appCtxSvc.ctx[ _contextKey ].isShowConnection === true ) {
        subsetInputs[ 0 ].requestPref.includeConnections = _TRUE;
    }
    return subsetInputs;
};

let clearCategoriesFromSearchStateBeforeApplyingFilters = function() {
    let newSearchState = { };
    newSearchState.searchInProgress = true;
    return newSearchState;
};

var initializeSearchStateFromSoaResponse = function( searchState, searchFilterCategories, searchFilterMap,  updateURL, processCategories, occContext ) {
    return updateFilterInfo( searchState, searchFilterCategories, searchFilterMap, updateURL,
        processCategories, occContext );
};

export let processGetSubsetInfoSoaResponse = ( response, searchState, occContext ) => {
    if( response && response.filterOut  && response.filterOut.length > 0 ) {
        return initializeSearchStateFromSoaResponse(  searchState, response.filterOut[ 0 ].searchFilterCategories, response.filterOut[ 0 ].searchFilterMap, false,
            true, occContext );
    }
};

export let updateSearchStateAfterFilterAction = ( filter, category, updateAtomicData, occContext ) => {
    var effectiveFilterString = getEffectiveFilterString( category, filter, occContext );
    var newFilterString = _.isEmpty( effectiveFilterString ) ? null : effectiveFilterString;

    var categoriesInfo = aceFilterService.extractFilterCategoriesAndFilterMap( effectiveFilterString );


    // Update search state to indicate search in progress
    let updateSearchStateAtomicData = updateAtomicData.searchState;
    let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
    updateSearchStateAtomicData( newSearchState );

    var currentState = occContext.currentState;
    let occContextValue = {
        currentState: {
            uid: currentState.uid,
            c_uid: currentState.c_uid,
            pci_uid: currentState.pci_uid,
            o_uid: currentState.o_uid,
            t_uid: currentState.t_uid,
            spageId: currentState.spageId,
            filter: newFilterString
        },
        transientRequestPref:{
            calculateFilters: true,
            jitterFreePropLoad : true,
            retainTreeExpansionStates : true, // Retain expansion state on application of filter
            filterChange:true
        },
        appliedFilters: categoriesInfo,
        clearExistingSelections: true,
        pwaReset : true
    };

    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

let processCategoryMetaData = function( category ) {
    if( category.categoryType === 'Attribute' && category.filterValues.length === 0 ) {
        // Show the expansion twisty on the filter category widget.
        category.showExpand = true;

        //The Text Search widget within filter categories relies on this variable to make
        // to decide whether to make a performFacetSearch or not. Setting this to true
        // allows the widget to performFacetSearch if a textsearch box is present in he UI.
        category.isServerSearch = true;

        // This flag will set the filter category to be rendered as collapsed.
        category.expand = false;
    }else if( category.categoryType === 'Attribute' && category.filterValues.length > 0 ) {
        // This flag will set the filter category to be rendered as expanded.
        category.expand = true;
    }
};

/**
  * This function will process Filter Categories for which no filter values were sent by the server.
  * The aim of this function is to render such categories as Collapsed by default.
  * @param {object} categories existing categories
  */
var processCategoriesMetaDataForRendering = function( categories ) {
    _.forEach( categories, function( category ) {
        processCategoryMetaData( category );
    } );
};

/**
  * Check  if product is structure indexed.
  *
  * @returns {boolean} : Returns true if structure indexed
  */
var isStructureIndexed = function() {
    var isStructure = false;
    var supportedFeatures = {};
    var context = appCtxSvc.getCtx( _contextKey );
    if( context.currentState && context.currentState.pci_uid && cdm.isValidObjectUid( context.currentState.pci_uid ) ) {
        supportedFeatures =  occmgmtStateHandler.getSupportedFeaturesFromPCI( cdm.getObject( context.currentState.pci_uid ) );
    }
    if (  context.productContextInfo?.props?.awb0AlternateConfiguration
            && context.productContextInfo.props.awb0AlternateConfiguration !== undefined
            && context.productContextInfo.props.awb0AlternateConfiguration.dbValues[0] !== null
            && context.productContextInfo.props.awb0AlternateConfiguration.dbValues[0] !== ''
            && context.productContextInfo.props.awb0AlternateConfiguration.dbValues[0].endsWith( 'AWBIB' )
           ||  supportedFeatures && supportedFeatures.Awb0EnableSmartDiscoveryFeature === undefined ) {
        isStructure = true;
    }
    return isStructure;
};

var setCalculateFilters =  function( calculateFiltersValue ) {
    var value = {
        requestPref:{
            calculateFilters : calculateFiltersValue
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
};


export let updateRecipeAndFilterInfoForReplay = function( occContext ) {
    // TODO: Remove when searchFilterMap is removed from ctx.occmgmtCtx
    let value = {
        recipe: [],
        searchFilterCategories: {},
        searchFilterMap: {}
    };
    // Update the active context by clearing the recipe and filter info
    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
    aceContextStateMgmtService.updateContextState( undefined, { filter: null }, true, occContext );
};

/**
  * Initialize
  * @param {Object} occContext occContext from subPanelContext
  */
export let initialize = function( occContext ) {
    if( structureFilterEventSubscriptions.length === 0 ) {
        // We need to update URL when active product changes. This event is fired when a change in selection results in change in active product.
        structureFilterEventSubscriptions.push( eventBus.subscribe( 'ace.productChangedEvent', function(
            eventData ) {
            if( isStructureIndexed() ) {
                updateURLAsPerCurrentProductBeingOpened( eventData, occContext );
            }
        } ) );

        // TODO: This event was used by VIS, Is this still needed in BA?
        eventBus.subscribe( 'ace.updateFilterPanel', function() {
            if( isStructureIndexed() ) {
                var context = appCtxSvc.getCtx( _contextKey );
                if( context ) {
                    setCalculateFilters( true );
                }
            }
        } );

        // When filter panel is collapsed and structure is refreshed or url copied to another tab
        // then the cache is cleared but the filters are still applied on the structure
        // Upon filter panel reopen, the cache has to be repopulated with selected filters
        if( isStructureIndexed() && occContext && occContext.searchFilterMap && occContext.searchFilterCategories ) {
            updateFilterInfo( {}, occContext.searchFilterCategories, occContext.searchFilterMap, false,
                false, occContext );
        }
    }
};

const removeSelectedField = ( filterValues ) => {
    let updateFilterValues = [];
    if( filterValues && filterValues.length > 0 ) {
        for( let index = 0; index < filterValues.length; index++ ) {
            let eachFilterValue = { ...filterValues[ index ].value };
            eachFilterValue.selected = eachFilterValue.selected && eachFilterValue.selected.dbValue ? eachFilterValue.selected.dbValue : false;
            updateFilterValues.push( eachFilterValue );
        }
    }
    return updateFilterValues;
};


export let updateCategoriesAfterFacetSearch = function( response, searchState, searchStateUpdater,  categoryForFacetSearchInput, category, occContext ) {
    let updateSearchStateAtomicData = searchStateUpdater.searchState;
    category.filterValues = removeSelectedField( category.filterValues );
    let modifiedSearchFilterMap = searchState.searchFilterMap;
    if( response.searchFilterMap ) {
        modifiedSearchFilterMap = AwFilterPanelUtils.setMapForFilterValueSearch( response.searchFilterMap,
            searchState, category, categoryForFacetSearchInput.startIndex );
        category.filterValues = filterPanelService.getFiltersForCategory( category,
            searchState.searchFilterMap, undefined, searchState.colorToggle );
    }

    category.hasMoreFacetValues = response.hasMoreFacetValues;
    if( !category.isServerSearch && category.hasMoreFacetValues ) {
        category.isServerSearch = true;
    }
    category.numberOfFiltersShown = category.filterValues.length;
    category.expand = true;
    let modifiedCategoriesExpandCollapseMap = AwFilterPanelUtils.setCategoryExpandCollapseStateInSearchState( searchState.categoriesExpandCollapseMap, category.internalName, category.expand );
    category.isPopulated = Boolean( category.filterValues && ( _.isArray( category.filterValues ) && category.filterValues.length > 0 ||
         !_.isArray( category.filterValues ) ) );
    category.updateNumberOfFiltersShown = categoryForFacetSearchInput.startIndex > 0;

    category = filterPanelCommonUtils.processFilterCategories( false, category, modifiedSearchFilterMap );

    if ( category.type === 'StringFilter' ) {
        category.facetSearchString = categoryForFacetSearchInput.facetSearchString;
        category.showFilterText =
             category.filterValues &&
             category.filterValues.length > category.defaultFilterValueDisplayCount * 2 ||
             categoryForFacetSearchInput.isServerSearch;
    }
    // Update categories in search state
    let categories = searchState.categories;
    for( let index = 0; index < categories.length; index++ ) {
        if( category.internalName === categories[ index ].internalName ) {
            categories[ index ] = category;
            break;
        }
    }

    var updatedFilterValues = [];
    if( Object.keys( searchState.searchFilterMap ).includes( category.internalName ) ) {
        updatedFilterValues = searchState.searchFilterMap[category.internalName];
    }

    // Update the local cache with updated merged filter values
    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( occContext.productContextInfo.uid );
    rawCategoriesInfo.rawCategoryValues[ category.internalName ] = updatedFilterValues;
    var rawCategories = rawCategoriesInfo.rawCategories;
    for( var rawCategory in rawCategories ) {
        if( rawCategories[ rawCategory ].internalName === category.internalName ) {
            rawCategories[ rawCategory ].hasMoreFacetValues = response.hasMoreFacetValues;
            rawCategories[ rawCategory ].endReached = !response.hasMoreFacetValues;
            rawCategories[ rawCategory ].startIndexForFacetSearch = response.endIndex;
            rawCategories[ rawCategory ].endIndex = response.endIndex;
        }
    }

    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( categories ), rawCategoriesInfo.rawCategories,  rawCategoriesInfo.rawCategoryValues, occContext );

    // Update search state
    updateSearchStateAtomicData( { ...searchState, isFacetSearch: true,
        categories: categories, categoriesExpandCollapseMap: modifiedCategoriesExpandCollapseMap, searchFilterMap: modifiedSearchFilterMap  } );
};

export let initializeContextKey = function( key ) {
    _contextKey = key;
};

export let modifySearchStateWithUpdatedFilters = function( searchState, occContext ) {
    if(  occContext.searchFilterMap && ( searchState.searchInProgress || searchState.categories ) ) {
        return initializeSearchStateFromSoaResponse( searchState, occContext.searchFilterCategories, occContext.searchFilterMap, true,
            true, occContext );
    } else if( !occContext.searchFilterMap || _.isEmpty( occContext.searchFilterMap ) ) {
        // This is the case for reset filters
        publishEventToFetchFilters();
    }
};

/**
  * Destroy
  */
export let destroy = function() {
    clearCache();
    _.forEach( structureFilterEventSubscriptions, function( subDef ) {
        eventBus.unsubscribe( subDef );
        structureFilterEventSubscriptions = [];
    } );
};

var createSearchStateFromCache = function( searchState, categories ) {
    let newSearchState = { ...searchState };
    var soaCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    const[ populatedFilterCategories, unpopulatedFilterCategories ] = getUnpopulatedCategoriesFilterCategories(  soaCategoriesInfo.rawCategories, soaCategoriesInfo.rawCategoryValues );
    newSearchState.unpopulatedSearchFilterCategories = unpopulatedFilterCategories;
    newSearchState.searchFilterCategories = populatedFilterCategories;
    newSearchState.searchFilterMap = _.cloneDeep( soaCategoriesInfo.rawCategoryValues );
    newSearchState.bulkFiltering = false;
    newSearchState.colorToggle = appCtxSvc.getCtx( 'preferences.AWC_ColorFiltering' )[ 0 ];
    processCategoriesMetaDataForRendering( categories );
    newSearchState.categories = categories;
    newSearchState.searchInProgress = false;
    return newSearchState;
};

var publishEventToFetchFilters = function() {
    eventBus.publish( 'acefilterPanel.getFilters' );
};

export let updateSearchStateOnPanelLoad = ( searchState, occContext ) =>{
    var categories = lookupCategoriesInfoInCache( occContext.productContextInfo.uid );
    if( categories ) {
        return createSearchStateFromCache( searchState, categories );
    }
    publishEventToFetchFilters();
};

export default exports = {
    computeFilterStringForNewProductContextInfo,
    updateSearchStateAfterFilterAction,
    updateCategoriesAfterFacetSearch,
    updateRecipeAndFilterInfoForReplay,
    initialize,
    initializeContextKey,
    modifySearchStateWithUpdatedFilters,
    processGetSubsetInfoSoaResponse,
    getSubsetInfoSoaInput,
    destroy,
    clearFilterInfoFromURL,
    updateSearchStateOnPanelLoad
};
