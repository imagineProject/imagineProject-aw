// Copyright (c) 2022 Siemens

/**
 * @module js/Ac0UserPanelService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';

var exports = {};

/**
 * Parse the perform search response and return the correct output data object
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} response - The response of performSearch SOA call
 *
 * @return {Object} - outputData object that holds the correct values .
 */
var processSoaResponse = function( data, response ) {
    var outputData = null;

    // Construct the output data that will contain the results
    outputData = {
        searchResults: response.searchResults,
        totalFound: response.totalFound,
        totalLoaded: response.totalLoaded
    };

    return outputData;
};

/**
 * Do the perform search call to populate the user or resource pool based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 * @param {Object} participantType - The participant type user is trying to add
 * @param {Object} deferred - The deferred object
 */
export let performSearchInternal = function( data, dataProvider, participantType, deferred ) {
    // Check is data provider is null or undefined then no need to process further
    // and return from here
    if( !dataProvider ) {
        return;
    }

    // Get the policy from data provider and register it
    var policy = dataProvider.action.policy;
    policySvc.register( policy );

    //Users type will get get all group members, UniqueUsers type will get just single users
    //var resourceProviderContentType = 'Users';
    var resourceProviderContentType = 'UniqueUsers';
    if( data.dataProviders ) {
        data.dataProviders.userPerformSearch.selectionModel.setMultiSelectionEnabled( true );
    }

    var searchString = data.filterBox.dbValue;

    // Create the search criteria to be used
    var searchCriteria = {
        parentUid: '',
        searchString: searchString,
        resourceProviderContentType: resourceProviderContentType,
        group: '',
        role: '',
        searchSubGroup: 'true',
        projectId: '',
        participantType: ''
    };

    // By default resource provider will be Awp0ResourceProvider if other resource provider exist in
    // ctx then it will use that
    var resourceProvider = 'Awp0ResourceProvider';
    var ctxWorkflow = appCtxSvc.getCtx( 'workflow' );
    if( ctxWorkflow && ctxWorkflow.resourceProvider ) {
        resourceProvider = ctxWorkflow.resourceProvider;
    }

    var inputData = {
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 25,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},

            searchSortCriteria: [

            ],

            startIndex: dataProvider.startIndex
        }
    };

    // SOA call made to get the content
    soaService.post( 'Query-2014-11-Finder', 'performSearch', inputData ).then( function( response ) {
        if( policy ) {
            policySvc.unregister( policy );
        }

        // Parse the SOA data to content the correct user or resource pool data
        var outputData = processSoaResponse( data, response );
        return deferred.resolve( outputData );
    } );
};

/**
 * Do the perform search call to populate the user or resource pool based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 * @param {Object} participantType - The participant type user is trying to add
 * @return {Promise} promise
 */
export let performSearch = function( data, dataProvider, participantType ) {
    var deferred1 = AwPromiseService.instance.defer();
    exports.performSearchInternal( data, dataProvider, participantType, deferred1 );

    return deferred1.promise;
};

export default exports = {
    performSearchInternal,
    performSearch
};
