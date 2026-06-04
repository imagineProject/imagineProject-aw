// Copyright (c) 2023 Siemens

import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

/**
 * @module js/Pca0LandingPageService
 **/

let exports = {};

/**
 * Helps to get VMOs of contexts and dictionaries
 * @param {Object} soaResponse Takes soa response as input
 * @returns {Array} List of VMOs
 */
export let getFormattedDataForList = ( soaResponse ) => {
    // First parameter is by default SOA response
    const vmoArr = [];
    for ( const modelObject in soaResponse.ServiceData.modelObjects ) {
        const vmObj = viewModelObjectSvc.createViewModelObject(
            soaResponse.ServiceData.modelObjects[ modelObject ]
        );
        vmoArr.push( vmObj );
    }
    return vmoArr;
};

/**
 * Helps to provide search input data to SOA
 * @param {String} searchValue takes searchValue of Context or Dictionary to search
 * @returns {Object} of search result object
 */
export let searchInputData = ( searchValue ) => {
    // Input criteria when nothing is searched i.e to get all Context and Dictionaries
    const createInputData = {
        maxToLoad: 250,
        maxToReturn: 250,
        providerName: 'Awp0SavedQuerySearchProvider',
        searchCriteria: {
            queryName: 'General...',
            typeOfSearch: 'ADVANCED_SEARCH',
            lastEndIndex: '',
            totalObjectsFoundReportedToClient: '',
            Type: 'Cfg0ProductItem;Cfg0Dictionary',
            searchID: 'GENERAL_QUERY',
            utcOffset: '330'
        },
        searchSortCriteria: [ {
            fieldName: 'object_name',
            sortDirection: 'ASC'
        } ]
    };

    if ( !_.isEmpty( searchValue ) ) {
        // Input criteria when particular Context or Dictionary is searched
        createInputData.searchCriteria.Name = searchValue;
    }

    return createInputData;
};

export default exports = {
    getFormattedDataForList,
    searchInputData
};
