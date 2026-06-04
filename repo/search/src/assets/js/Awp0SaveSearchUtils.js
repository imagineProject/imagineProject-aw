// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global */

/**
 *
 * @module js/Awp0SaveSearchUtils
 */

import clientDataModel from 'soa/kernel/clientDataModel';
import filterPanelUtils from 'js/filterPanelUtils';
import searchCommonUtils from 'js/searchCommonUtils';
import advancedSearchUtils from 'js/advancedSearchUtils';
import searchFilterService from 'js/aw.searchFilter.service';
import AwChartDataProviderService from 'js/awChartDataProviderService';
import filterPanelService from 'js/filterPanelService';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import navigationUtils from 'js/navigationUtils';
import _ from 'lodash';
import dateTimeService from 'js/dateTimeService';
import searchConstants from 'js/searchConstants';
import viewModelObjectSvc from 'js/viewModelObjectService';
import { pinDataCommand } from 'js/AwPersonalizationEngine';
import messagingSvc from 'js/messagingService';
import { navigate } from 'js/navigationService';

const _EPOCH_TIME = '_epoch_time';
/**
 * Get the pinned search value from the check box in UI
 *
 * @param {boolean} pinSearchBoolVal true if pinned
 * @returns {Integer} 1 for pinned, 0 for not pinned.
 */
export let getPinSearchValue = function( pinSearchBoolVal ) {
    // If the Pin to search is not selected by user, this will be undefined value. So we want to return false
    if( pinSearchBoolVal === true ) {
        return 1;
    }
    return 0;
};

/**
 * Get the tile template id which is to be used when pinning saved search
 *
 * @param {Object} searchState searchState
 * @returns {String} returns the tile template id for pinned search.
 */
export let getTemplateId = function( searchState ) {
    if( searchState && searchState.provider && searchState.provider === 'SS1ShapeSearchDataProvider' ) {
        return 'Awp0PinnedSavedShapeSearchTemplate';
    }
    return searchState.applicationPinnedSavedSearchTileTemplateId;
};

/**
 * Get the pinned search value from the check box in UI
 *
 * @param {boolean} pinSearchBoolVal true if pinned
 * @returns {Integer} 1 for pinned, 0 for not pinned.
 */
export let setPinToHome = function( response, pinToHome ) {
    // If the Pin to search is not selected by user, this will be undefined value. So we want to return false
    let updatedPinToHome = _.cloneDeep( pinToHome );

    if( response && response.visibleCommandsInContext ) {
        const visibleCommandsInContext = response.visibleCommandsInContext;
        for ( let entry of visibleCommandsInContext ) {
            if( entry.commands.includes( 'Awp0PinSearch' ) ) {
                updatedPinToHome.dbValue = false;
                updatedPinToHome.uiValue = updatedPinToHome.propertyRadioFalseText;
                updatedPinToHome.dispValue = updatedPinToHome.propertyRadioFalseText;
                break;
            } else if( entry.commands.includes( 'Awp0UnpinSearch' ) ) {
                updatedPinToHome.dbValue = true;
                updatedPinToHome.uiValue = updatedPinToHome.propertyRadioTrueText;
                updatedPinToHome.dispValue = updatedPinToHome.propertyRadioTrueText;
                break;
            }
        }
    }

    return updatedPinToHome;
};

export let getChartByForSave = function( newChartBy, oldChartBy ) {
    let chartBy = newChartBy;
    if ( !newChartBy ) {
        chartBy = oldChartBy ? oldChartBy : '';
    }
    return chartBy;
};

export let getIntegerValueForBooleanValue = function( booleanValue ) {
    return booleanValue ? 1 : 0;
};

/**
 * Get the shared search value from the check box in UI
 *
 * @param {boolean} sharedSearchBoolVal true if shared
 * @returns {Integer} 1 for shared, 0 for not shared.
 */
export let getSharedSearchValue = function( sharedSearchBoolVal ) {
    // If the Allow others to view is not selected by user, this will be undefined value. So we want to return false
    if( sharedSearchBoolVal === true ) {
        return 1;
    }
    return 0;
};

/**
 * Get the saved advanced search criteria
 *
 * @param {STRING} searchState searchState
 * @returns {Object} searchFilters.
 */
export let getSavedSearchCriteriaFromAdvancedSearch = function( searchState ) {
    var criteria = [];
    var searchCriteriaMap = searchState.searchCriteriaMap;
    if( searchCriteriaMap ) {
        for( var attribute in searchCriteriaMap ) {
            criteria.push( {
                criteriaName: searchCriteriaMap[ attribute ][ 1 ],
                criteriaValue: searchCriteriaMap[ attribute ][ 2 ],
                criteriaDisplayValue: searchCriteriaMap[ attribute ][ 3 ]
            } );
        }
    }
    return criteria;
};

/**
 * Get the saved advanced search criteria
 *
 * @param {STRING} searchFilters searchFilters
 * @returns {Object} searchFilters.
 */
export let getSavedSearchCriteriaFromSavedAdvSearch = ( savedSearchObject ) => {
    let criteria = [];
    let props = savedSearchObject.props;
    for( let i = 0; i < props.savedsearch_attr_names.dbValues.length; i++ ) {
        criteria.push( {
            criteriaName: props.savedsearch_attr_names.uiValues[ i ],
            criteriaValue: props.savedsearch_attr_values.dbValues[ i ],
            criteriaDisplayValue: props.savedsearch_attr_values.uiValues[ i ]
        } );
    }

    return criteria;
};

export let updateSavedSearchObjectWithSavedSearchCriteriaDisplayValues = ( savedSearchObject ) => {
    if ( !savedSearchObject.props.saved_search_criteria ) {
        return savedSearchObject;
    }
    let updatedSavedSearchObject = _.cloneDeep( savedSearchObject );
    let savedQueryCriteriaUID = savedSearchObject.props.saved_search_criteria.dbValues[ 0 ];
    let savedQueryCriteriaObject = clientDataModel.getObject( savedQueryCriteriaUID );
    if( savedQueryCriteriaObject && savedQueryCriteriaObject.uid && savedQueryCriteriaObject.uid.length > 0 && savedQueryCriteriaObject.type === 'SavedQueryCriteria' &&
        savedQueryCriteriaObject.props.fnd0AttributeDisplayValues && savedQueryCriteriaObject.props.fnd0AttributeDisplayValues.uiValues.length > 0 ) {
        let dbValuesAttributeValues = _.cloneDeep( savedQueryCriteriaObject.props.attribute_values.dbValues );
        let uiValuesAttributeValues = _.cloneDeep( savedQueryCriteriaObject.props.attribute_values.uiValues );
        for( let i = 0; i < dbValuesAttributeValues.length; i++ ) {
            if ( dbValuesAttributeValues[i] && dbValuesAttributeValues[i].endsWith( _EPOCH_TIME ) ) {
                let epochTime = dbValuesAttributeValues[i].replace( _EPOCH_TIME, '' );
                let jsDate = new Date( epochTime * 1000 );
                let localTime = dateTimeService.formatDateTime( jsDate, dateTimeService.getSessionDateTimeFormat() );
                //not sure why the datetime shows as "06-Dec-2022 - 23:59:58" instead of "06-Dec-2022 23:59:58"
                localTime = localTime.replace( ' - ', ' ' );
                dbValuesAttributeValues[i] =  epochTime * 1000;
                uiValuesAttributeValues[i] = localTime;
            } else {
                dbValuesAttributeValues[i] = updatedSavedSearchObject.props.savedsearch_attr_values.dbValues[i];
                uiValuesAttributeValues[i] = savedQueryCriteriaObject.props.fnd0AttributeDisplayValues.uiValues[i];
            }
        }
        updatedSavedSearchObject.props.savedsearch_attr_values.uiValues = uiValuesAttributeValues;
        updatedSavedSearchObject.props.savedsearch_attr_values.displayValues = uiValuesAttributeValues;
        updatedSavedSearchObject.props.savedsearch_attr_values.value = uiValuesAttributeValues;
        updatedSavedSearchObject.props.savedsearch_attr_values.dbValue = dbValuesAttributeValues;
        updatedSavedSearchObject.props.savedsearch_attr_values.dbValues = dbValuesAttributeValues;
        updatedSavedSearchObject.props.savedsearch_attr_values.uiValue = uiValuesAttributeValues;
    }
    return updatedSavedSearchObject;
};

/**
 * getChartOn
 *
 * @param {String} chartOn chart on property
 * @returns {String} normalized chart on property
 */
export let getChartOn = function( chartOn ) {
    return chartOn ? chartOn : '';
};

/**
 * getInputs
 *
 * @param {ViewModel} selectedModelObject selectedModelObject
 * @param {String} uid uid
 * @param {String} selectedCtx selectedCtx
 * @returns {Object} Inputs for the function defined in JSON
 */
export let getInputs = function( data, selectedSavedSearchObject ) {
    return [ {
        pinSearch: data.pinToHome.dbValue === true ? 1 : 0,
        propInfo: [ {
            properties: [ {
                name: 'object_name',
                values: [ data.savedSearchName.uiValue ]
            } ],
            object: {
                uid: selectedSavedSearchObject.uid
            }
        } ],
        receiveNotification: 0,
        shareSavedSearch: data.shareSavedSearch.dbValue === true ? 1 : 0,
        searchFilterMap: data.savedSearchFilterMap,
        chartInputParameters: {
            chartOn: data.chartProperty.dbValue ? data.chartProperty.dbValue : ''
        }
    } ];
};
/**
 * getSavedAdvSearchInputs
 *
 * @param {ViewModel} data data
 * @returns {Object} Inputs for the function defined in JSON
 */
export let getSavedAdvSearchInputs = function( data, searchState ) {
    return [ {
        stringValueInputKeyValuePairs: {
            savedSearchName: data.savedSearchName.dbValue,
            referencingSavedQuery: data.referencingSavedQuery.dbValue
        },
        boolValueInputKeyValuePairs: {
            pinToHome: data.pinToHome.dbValue === true,
            override: false,
            shareSavedSearch: data.shareSavedSearch.dbValue === true
        },
        savedSearchCriteria: Awp0SaveSearchUtils.getSavedSearchCriteriaFromAdvancedSearch( searchState )
    } ];
};

/**
 * getEditSavedAdvSearchInputs
 *
 * @param {ViewModel} data data
 * @param {String} mode mode
 * @returns {Object} Inputs for the function defined in JSON
 */
export let getEditSavedAdvSearchInputs = ( data, savedSearchObject, mode ) => {
    var baseInputs = [ {
        stringValueInputKeyValuePairs: {
            savedSearchName: data.savedSearchName.uiValue
        },
        boolValueInputKeyValuePairs: {
            pinToHome: data.pinToHome.dbValue === true,
            override: false,
            shareSavedSearch: data.shareSavedSearch.dbValue === true
        }
    } ];
    if( mode === 'SaveAndModify' ) {
        baseInputs[ 0 ].stringValueInputKeyValuePairs.savedSearchUid = savedSearchObject.uid;
    } else {
        baseInputs[ 0 ].stringValueInputKeyValuePairs.referencingSavedQuery = savedSearchObject.props.savedsearch_query.dbValues[ 0 ];
        baseInputs[ 0 ].savedSearchCriteria = Awp0SaveSearchUtils.getSavedSearchCriteriaFromSavedAdvSearch( savedSearchObject );
        if( mode === 'SaveAndCreate' ) {
            // no op
        } else if( mode === 'Overwrite' ) {
            baseInputs[ 0 ].boolValueInputKeyValuePairs.override = true;
        } else {
            // no op
        }
    }
    return baseInputs;
};

/**
 * Return filter string to be used by search
 *
 * @param {Object} filterMap filterMap
 * @return {String} filterString
 */
export let buildFilterString = function( filterMap ) {
    var filterString = '';
    _.forEach( filterMap, function( value, key ) {
        // do something here
        filterString += key;
        filterString += '=';
        var firstValue = true;
        for( var i = 0; i < value.length; i++ ) {
            if( !firstValue ) {
                filterString += '^';
            }
            filterString += value[ i ].stringValue;
            firstValue = false;
        }
        filterString += '~';
    } );

    return filterString;
};

/**
 * Return filter map to be used by search
 *
 * @param {Object} savedSearchObject savedSearchObject
 * @return {Object} searchFilterMap
 */
export let getFilterMap = function( savedSearchObject ) {
    let searchFilterMap = {};
    let filterUIDs;
    if ( savedSearchObject.props.awp0string_filters ) {
        filterUIDs = savedSearchObject.props.awp0string_filters.dbValues;
    }
    if( filterUIDs && filterUIDs.length > 0 ) {
        for( var i = 0; i < filterUIDs.length; i++ ) {
            var filterObject = clientDataModel.getObject( filterUIDs[ i ] );
            var key = filterObject.props.awp0filter_name.dbValues[ 0 ];
            var value = filterObject.props.awp0value.dbValues[ 0 ];

            var filters = [];
            if( searchFilterMap[ key ] === undefined ) {
                filters.push( value );
                searchFilterMap[ key ] = filters;
            } else {
                filters = searchFilterMap[ key ];
                filters.push( value );
                searchFilterMap[ key ] = filters;
            }
        }
    }
    return searchFilterMap;
};

/**
 * getQueryParametersMap
 * @function getQueryParametersMap
 * @param {Object} savedSearchObject savedSearchObject - the selected saved search object
 * @param {Object} advSearchViewModelObjectProps advSearchViewModelObjectProps - the saved query props info
 * @return {Object} queryParametersMap - a map containing saved query parameters
 */
export let getQueryParametersMap = function( savedSearchObject, advSearchViewModelObjectProps ) {
    let queryParametersMap = {};
    let savedSearchAttributeNames = savedSearchObject.props.savedsearch_attr_names.dbValues;
    let savedSearchAttributeValues = savedSearchObject.props.savedsearch_attr_values.dbValues;

    let savedSearchAttributeDisplayValues = savedSearchObject.props.savedsearch_attr_values.uiValues;
    for( let index = 0; index < savedSearchAttributeDisplayValues.length; index++ ) {
        let propertyName = advSearchViewModelObjectProps[ savedSearchAttributeNames[ index ] ];
        if( propertyName && propertyName.propertyDescriptor.lovCategory === 1 ) {
            let displayValues = savedSearchAttributeDisplayValues[ index ].split( advancedSearchUtils._delimiterForArray );
            let internalValues = savedSearchAttributeValues[ index ].split( advancedSearchUtils._delimiterForArray );
            for( let index2 = 0; index2 < displayValues.length; index2++ ) {
                displayValues[ index2 ] = displayValues[ index2 ] + advancedSearchUtils.INTERNAL_KEYWORD + internalValues[ index2 ];
            }
            savedSearchAttributeDisplayValues[ index ] = displayValues.join( advancedSearchUtils._delimiterForArray );
        } else if( propertyName && propertyName.type === 'DATE' ) {
            savedSearchAttributeDisplayValues[ index ] = savedSearchAttributeValues[ index ];
        }
    }

    queryParametersMap[ savedSearchObject.props.savedsearch_query.dbValue ] = savedSearchObject.props.savedsearch_query.uiValues[ 0 ];
    for( var j = 0; j < savedSearchAttributeNames.length; j++ ) {
        var key = savedSearchAttributeNames[ j ];
        var value = savedSearchAttributeDisplayValues[ j ];
        queryParametersMap[ key ] = value;
    }
    return queryParametersMap;
};

export let getSavedSearchFilterFromFilterUid = function( filterUID, searchFilterMap, savedSearchFilterMap ) {
    let filterObject = clientDataModel.getObject( filterUID );
    let key = filterObject.props.awp0filter_name.dbValues[ 0 ];
    let value = filterObject.props.awp0value.dbValues[ 0 ];

    let filter = {};
    let savedSearchFilter = {};
    filter.searchFilterType = 'SearchStringFilter';
    savedSearchFilter.searchFilterType = 'SearchStringFilter';
    filter.stringValue = value;
    savedSearchFilter.stringValue = value;
    let dateFilter = filterPanelUtils.INTERNAL_DATE_FILTER;
    if( _.startsWith( value, dateFilter ) ) {
        filter = filterPanelUtils.getDateRangeFilter( value.substring( 12, value.length ) );
    } else if( _.startsWith( value, filterPanelUtils.INTERNAL_NUMERIC_FILTER ) ) {
        filter = filterPanelUtils.getNumericRangeFilter( value.substring( 15, value.length ) );
    } else if( _.startsWith( value, filterPanelUtils.NUMERIC_FILTER ) ) {
        filter.startNumericValue = parseFloat( value );
        filter.endNumericValue = parseFloat( value );
    }

    let filters = [];
    let savedSearchFilters = [];
    if( !searchFilterMap[ key ] ) {
        filters.push( filter );
        savedSearchFilters.push( savedSearchFilter );
        searchFilterMap[ key ] = filters;
        savedSearchFilterMap[ key ] = savedSearchFilters;
    } else {
        filters = searchFilterMap[ key ];
        filters.push( filter );
        savedSearchFilters = savedSearchFilterMap[ key ];
        savedSearchFilters.push( savedSearchFilter );
        searchFilterMap[ key ] = filters;
        savedSearchFilterMap[ key ] = savedSearchFilters;
    }
};

/**
 * isPinToHome
 *
 * @function isPinToHome
 * @param {Object}pinToHome - pinToHome
 * @returns {BOOLEAN} true if pinToHome.
 */
export let isPinToHome = function( pinToHome ) {
    if( pinToHome === '' || pinToHome === null || pinToHome === undefined ) {
        return false;
    }
    return JSON.parse( pinToHome );
};

/**
 * isShareSavedSearch
 * @function isShareSavedSearch
 * @param {Object}shareSavedSearch - shareSavedSearch
 * @returns {BOOLEAN} true if shareSavedSearch.
 */
export let isShareSavedSearch = function( shareSavedSearch ) {
    if( shareSavedSearch === '' || shareSavedSearch === null || shareSavedSearch === undefined ) {
        return false;
    }
    return JSON.parse( shareSavedSearch );
};

/**
 * Get the default page size used for max to load/return.
 *
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return searchCommonUtils.getDefaultPageSize( defaultPageSizePreference );
};

export const processOutput = ( data, dataCtxNode, searchData ) => {
    const newSearchData = { ...searchData.value };
    newSearchData.totalFound = data.totalFound;
    newSearchData.savedSearchObjects = JSON.parse( data.searchResultsJSON );
    newSearchData.searchFilterMap = searchCommonUtils.processOutputFilterMap( newSearchData, data.searchFilterMap );
    newSearchData.searchFilterCategories = searchCommonUtils.processOutputSearchFilterCategories( newSearchData, data.searchFilterCategories );
    newSearchData.objectsGroupedByProperty = data.objectsGroupedByProperty;
    newSearchData.categories = filterPanelService.getCategories3( newSearchData, false );
    const appliedFiltersMap = getSelectedFiltersMap( newSearchData.categories );
    const appliedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( appliedFiltersMap );
    newSearchData.appliedFilterMap = appliedFiltersInfo.activeFilterMap;
    const [ appliedFilters, categories ] = searchCommonUtils.constructAppliedFiltersAndCategoriesWhenEmptyCategoriesAndZeroResults( newSearchData, appliedFiltersInfo.activeFilters );
    newSearchData.appliedFilters = appliedFilters;
    delete newSearchData.searchInProgress;
    searchData.update( newSearchData );
};

export const updateSearchFilters = ( searchFilterMap, searchFilterCategories, data ) => {
    let searchFiltersUpdatedVMProp = _.cloneDeep( data.searchFilters );
    let filterDisplayValue = searchFilterService.getFilterStringFromActiveFilterMap( searchFilterMap, searchFilterCategories );
    searchFiltersUpdatedVMProp.dbValue = filterDisplayValue;
    searchFiltersUpdatedVMProp.uiValue = filterDisplayValue;
    return searchFiltersUpdatedVMProp;
};

export const setCurrentChartBy = ( searchState, chartOnProperty ) => {
    let chartBy = _.cloneDeep( chartOnProperty );
    if( searchState.objectsGroupedByProperty &&
        ( searchState.objectsGroupedByProperty.internalPropertyName === '' || !searchState.objectsGroupedByProperty.internalPropertyName || !searchState.currentChartBy ) ) {
        let currentChartBy = AwChartDataProviderService.getTargetSearchFilterCategory( searchState, searchState.objectsGroupedByProperty.internalPropertyName );
        currentChartBy = !currentChartBy || currentChartBy === '' ? {
            displayName: 'Category',
            internalName: 'Categorization.category'
        } : currentChartBy;
        chartBy.dbValue = currentChartBy.internalName;
        chartBy.uiValue = currentChartBy.displayName;
        chartBy.uiValues = [ currentChartBy.displayName ];
        chartBy.displayValues = [ currentChartBy.displayName ];
    } else if( searchState.objectsGroupedByProperty ) {
        chartBy.dbValue = searchState.currentChartBy.internalName;
        chartBy.uiValue = searchState.currentChartBy.displayName;
        chartBy.uiValues = [ searchState.currentChartBy.displayName ];
        chartBy.displayValues = [ searchState.currentChartBy.displayName ];
    }
    return chartBy;
};

/**
 * getEscapedParamsForFullTextSavedSearch
 * @function getEscapedParamsForFullTextSavedSearch
 * @param {Object} selectedObject - The selected object
 * @returns {String} encodedParamString - encoded parameter string
 */
export let getEscapedParamsForFullTextSavedSearch = ( selectedObject ) => {
    // handle search parameters for global search
    let globalSearchParams = Awp0SaveSearchUtils.getGlobalSearchParametersForURL( selectedObject );
    let filterMap = Awp0SaveSearchUtils.getFilterMap( selectedObject );
    if( filterMap.hasOwnProperty( searchConstants.SS1_PART_SHAPE_FILTER ) || filterMap.hasOwnProperty( searchConstants.SS1_SHAPE_BEGIN_FILTER ) ||
     filterMap.hasOwnProperty( searchConstants.SS1_SHAPE_END_FILTER ) ) {
        return {
            encodedParamString: navigationUtils.buildEncodedParamString( 'teamcenter.search.shapesearch', globalSearchParams ),
            templateId: 'Awp0PinnedSavedShapeSearchTemplate'
        };
    }
    return {
        encodedParamString: navigationUtils.buildEncodedParamString( 'teamcenter.search.search', globalSearchParams ),
        templateId: 'Awp0PinnedSavedSearchTemplate'
    };
};


/**
 * getEscapedParamsForAdvancedSavedSearch
 * @function getEscapedParamsForAdvancedSavedSearch
 * @param {Object} selectedObject - The selected saved search VMO
 * @param {Object} advancedSearchViewModelObject - The advanced search VMO
 * @returns {Object} encodedParamString & templateId - encoded parameters string and templateId
 */
export let getEscapedParamsForAdvancedSavedSearch = ( selectedObject, advancedSearchViewModelObject ) => {
    // handle search parameters for advanced search
    let advancedSearchParams = advancedSearchUtils.getAdvancedSearchParametersForURL( selectedObject, advancedSearchViewModelObject );
    return {
        encodedParamString: navigationUtils.buildEncodedParamString( 'teamcenter.search.advancedSearch', advancedSearchParams ),
        templateId: 'Awp0ClassicPinnedSavedSearchTemplate'
    };
};

/**
 * getGlobalSearchParametersForURL
 * @function getGlobalSearchParametersForURL
 * @param {Object} selectedObject - The selected saved search VMO
 * @returns {Object} searchParam - search params object
 */
export let getGlobalSearchParametersForURL = ( selectedObject ) => {
    //If this is a FullText Saved Search, process criteria and filter
    let searchCriteria = selectedObject.props.awp0search_string.dbValues[ 0 ];
    let searchFilterMap = Awp0SaveSearchUtils.getFilterMap( selectedObject );
    let filter = searchFilterService.buildFilterString( searchFilterMap );
    let searchParam = {};
    searchParam.searchCriteria = searchCriteria;
    searchParam.filter = filter;
    return searchParam;
};

export let getSavedSearchFilterMapForSave = ( filterMap ) => {
    let savedSearchFilterMap = _.cloneDeep( filterMap );
    _.forEach( savedSearchFilterMap, function( value, key ) {
        savedSearchFilterMap[key] = value.map( function( v1 ) {
            //Server side can only haddle 'SearchStringFilter'
            v1.searchFilterType = 'SearchStringFilter';
            return v1;
        } );
    } );
    return savedSearchFilterMap;
};

export let constructSavedSearchFilterMapForSaveEdits = ( searchState ) => {
    let input = {
        activeFilterMap: searchState.activeFilterMap,
        activeFilters: searchState.activeFilters
    };

    return Awp0SaveSearchUtils.getSavedSearchFilterMapForSave( searchFilterService.convertFilterMapToSavedSearchFilterMap( input ) );
};

export const processSelectionOfFirstObject = ( response ) => {
    return response.totalLoaded > 0;
};

/**
 * getPropInfo
 *
 * @param {String} selectedSavedSearchObject selectedSavedSearchObject
 * @returns {Object} Inputs for the function defined in JSON
 */
export let getPropInfo = function( selectedSavedSearchObject ) {
    return {
        type:selectedSavedSearchObject.type,
        uid:selectedSavedSearchObject.uid
    };
};

export let saveSavedSearchRule = function( response, searchState ) {
    const newSearchState = { ...searchState.getValue() };
    newSearchState.filterStringDisplay = _.join( response.savedSearchList[0].props.awp0SearchFilterArray.uiValues, ',' );
    newSearchState.chartBy = response.savedSearchList[0].props.awp0ChartOn.dbValues[0];
    newSearchState.isEditMode = false;
    searchState.update( newSearchState );
};

export let getSaveAsQueryName = ( i18nName, replaceTxt, createQueryName )=>{
    let nwQueryName = { ...createQueryName };
    let replacedName = i18nName.replace( '{0}', replaceTxt );
    nwQueryName.dbValue = replacedName;
    nwQueryName.uiValue = replacedName;
    nwQueryName.dbValues[0] = replacedName;
    nwQueryName.uiValues[0] = replacedName;
    return nwQueryName;
};

export let getSaveAsQueryDesc = ( queryDesc, createQueryDesc )=>{
    let newQueryDesc = { ...createQueryDesc };
    newQueryDesc.dbValue = queryDesc;
    newQueryDesc.uiValue = queryDesc;
    newQueryDesc.dbValues[0] = queryDesc;
    newQueryDesc.uiValues[0] = queryDesc;
    return newQueryDesc;
};

export const performNavigateActionAndClose = ( searchString, popupApi ) => {
    navigate( {
        actionType: 'Navigate',
        navigateTo: 'teamcenter_search_search'
    }, { searchCriteria: searchString } );
    popupApi && popupApi.hide();
};

export let pinToLauncherOrPinToNavigationBar = ( pinToLauncher, pinToNavigationBar, results, launcherMessage, navigationMessage ) => {
    var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( results.savedSearchList[0] );
    let navigationAction = {
        actionType: 'JSFunction',
        method: 'performNavigateActionAndClose',
        inputData: {
            searchString: vmo.props.awp0search_string.dbValue,
            popupApi: '{{commandContext.popupApi}}'
        },
        deps: 'js/Awp0SaveSearchUtils'
    };
    if( pinToLauncher ) {
        pinDataCommand( 'aw_pinnedData', vmo, null, navigationAction );
        let message = messagingSvc.applyMessageParamsWithoutContext( launcherMessage, [ vmo.cellHeader1 ] );
        messagingSvc.showInfo( message );
    }
    if( pinToNavigationBar ) {
        pinDataCommand( 'aw_globalNavigationbar', vmo, null, navigationAction );
        let message = messagingSvc.applyMessageParamsWithoutContext( navigationMessage, [ vmo.cellHeader1 ] );
        messagingSvc.showInfo( message );
    }
};

const Awp0SaveSearchUtils = {
    getPinSearchValue,
    getTemplateId,
    getSharedSearchValue,
    getSavedSearchCriteriaFromAdvancedSearch,
    getSavedSearchCriteriaFromSavedAdvSearch,
    getChartOn,
    getInputs,
    getSavedAdvSearchInputs,
    getEditSavedAdvSearchInputs,
    buildFilterString,
    getFilterMap,
    getQueryParametersMap,
    getSavedSearchFilterFromFilterUid,
    isPinToHome,
    isShareSavedSearch,
    getDefaultPageSize,
    processOutput,
    updateSearchFilters,
    setCurrentChartBy,
    setPinToHome,
    updateSavedSearchObjectWithSavedSearchCriteriaDisplayValues,
    getGlobalSearchParametersForURL,
    getEscapedParamsForAdvancedSavedSearch,
    getEscapedParamsForFullTextSavedSearch,
    getSavedSearchFilterMapForSave,
    getChartByForSave,
    processSelectionOfFirstObject,
    getIntegerValueForBooleanValue,
    constructSavedSearchFilterMapForSaveEdits,
    getPropInfo,
    saveSavedSearchRule,
    getSaveAsQueryName,
    getSaveAsQueryDesc,
    pinToLauncherOrPinToNavigationBar,
    performNavigateActionAndClose
};

export default Awp0SaveSearchUtils;
