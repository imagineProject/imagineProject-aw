// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 *
 * @module js/searchColumnFilteringUtils
 */
import _ from 'lodash';
import columnFilterService from 'js/awColumnFilterService';

export const clearColumnFilters = ( columnProvider, dataProvider ) => {
    if ( dataProvider && dataProvider.cols ) {
        columnFilterService.removeAllFilters( dataProvider, columnProvider );
    }
};

export let updateColumnFacetsAfterFacetSearch = ( response, searchState, filterFacetInput, facetDisplayNameInternalNameMap, category ) => {
    let searchFilterMap = response.searchFilterMap;

    let obj = {};
    let values = [];
    let facet = getColumnForFaceting( filterFacetInput );
    let totalCount = 0;
    let oldCount = searchState.filterFacetCursor.has( facet );

    if ( !response.hasMoreFacetValues ) {
        totalCount = searchFilterMap[facet].length;
    } else if ( oldCount ) {
        totalCount = searchState.filterFacetCursor.get( facet ) + searchFilterMap[facet].length;
    } else {
        totalCount = searchFilterMap[facet].length + 1;
    }

    for ( let x = 0; x < searchFilterMap[facet].length; x++ ) {
        let currentFacet = response.searchFilterMap[facet][x];
        values.push( currentFacet.stringDisplayValue );
        facetDisplayNameInternalNameMap[ currentFacet.stringDisplayValue ] = currentFacet.stringValue;
    }
    //update map
    const newSearchState = { ...searchState.getValue() };
    newSearchState.filterFacetCursor.set( facet, totalCount );
    searchState.update( newSearchState );

    obj.values = values;
    obj.totalFound = totalCount;
    return obj;
};

export let getColumnForFaceting = ( filterFacetInput ) => {
    let columnName;
    if ( filterFacetInput.column.dataType === 'Date' ) {
        columnName =  filterFacetInput.column.name + '_0Z0_year_month_day';
    } else {
        columnName =  filterFacetInput.column.name;
    }

    return columnName;
};

export let getColumnFilters = ( selectedColumnFilters, facetDisplayNameInternalNameMap ) => {
    let columnFiltersForInput = _.cloneDeep( selectedColumnFilters );

    columnFiltersForInput.forEach( ( selectedColumnFilter ) => {
        let selectedFacetsInternalNames = [];
        selectedColumnFilter.values.forEach( ( filterValue ) => {
            let internalValue = facetDisplayNameInternalNameMap[ filterValue ];
            if( internalValue ) {
                selectedFacetsInternalNames.push( internalValue );
            }
            else {
                selectedFacetsInternalNames.push( filterValue );
            }
        } );
        selectedColumnFilter.values = selectedFacetsInternalNames;
    } );

    return columnFiltersForInput;
};

const searchColumnFilteringUtils = {
    clearColumnFilters,
    updateColumnFacetsAfterFacetSearch,
    getColumnForFaceting,
    getColumnFilters
};

export default searchColumnFilteringUtils;
