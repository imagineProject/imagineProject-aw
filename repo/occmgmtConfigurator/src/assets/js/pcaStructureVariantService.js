// Copyright (c) 2022 Siemens

/**
 * @module js/pcaStructureVariantService
 */
import uwPropertyService from 'js/uwPropertyService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import _localeSvc from 'js/localeService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import tcDataManagementService from 'js/tcDataManagementService';
import soaService from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';


var exports = {};
    //create separator object with marker information
    //add separator object to response to render separator in list

var showFilteredVariantRules = function( response, startIndex, defaultVariantRule ) {
    if ( startIndex === 0 ) {
        var allVariants = tcViewModelObjectService.createViewModelObjectById( 'defaultVariantRule' );

        allVariants.props.object_string = uwPropertyService.createViewModelProperty(
            defaultVariantRule,
            defaultVariantRule, 'STRING',
            defaultVariantRule, '' );

        allVariants.cellHeader1 = defaultVariantRule;
        response.objects.splice( 0, 0, allVariants );
    }
};

export let prepareCfgProviderInput = async( data, textboxInput, revisionRule ) => {
    let selectedContext = null;
    if(data.subPanelContext.occContext && data.subPanelContext.occContext.rootElement){
        selectedContext = data.subPanelContext.occContext.rootElement.uid;
    }
    if(selectedContext === null && data.subPanelContext.occContext && data.subPanelContext.occContext.topElement ) {
        selectedContext = data.subPanelContext.occContext.topElement.uid;
    }

    let searchCriteria = {
        selectedContext: selectedContext,
        revisionRule: revisionRule.uiValue,
        configuratorContext: "",
        allRevisions: "false",
        configPerspective: data.data.configPerspectiveFromConsumerApps
    };

    if( !_.isEmpty( data.lastLoadedVariantUid ) ) {
        searchCriteria.uidOfLastRule = data.lastLoadedVariantUid;
    }

    if (textboxInput !== '' || _.isUndefined(data.data.configPerspectiveFromConsumerApps))
    {
        const findQueryInputData = {
            inputCriteria: [ {
                queryNames: [ 'Variant Rules' ]
            } ]
        };
        let responseSavedQuery = await soaService.postUnchecked( 'Query-2010-04-SavedQuery', 'findSavedQueries', findQueryInputData );
        let ootbSavedQueryUID = responseSavedQuery.savedQueries[ 0 ].uid;
        searchCriteria.queryUID = ootbSavedQueryUID;
        let searchText = "*";
        var savedQueryInput = [];
        searchText = '*' + textboxInput + '*';
        savedQueryInput = {
            [ "object_name" ]: searchText
        };
        searchCriteria.savedQueryInput = JSON.stringify( savedQueryInput );
    }
    return searchCriteria;
};


/**
 * Get last object from JSON
 * @param {Object} response to get last uid from searchResult
 * @returns {string} returns uid as string from jsonstring
 */
export let getLastUid = function( response ) {
    if( !_.isUndefined( response.ServiceData.plain ) ) {
        const length = response.ServiceData.plain.length;
        return response.ServiceData.plain[ length - 1 ];
    }
    return '';
};


/**
 * Process the response from Server
 */
export let processVariantRules = function( response, startIndex, totalFound, defaultVariantRule ) {
    if ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    if(totalFound === 0){
        totalFound = 1;
    }

    // Add separator
    // Show filtered items based on search string
    showFilteredVariantRules( response, startIndex, defaultVariantRule );
    let variantRules = response.objects;
    return { variantRules, totalFound};
};

export let getConfigPerspective = async function ( occContext, subPanelContext ) {

    if( occContext.configPerspective ) {
        return occContext.configPerspective;
    }
    const inputData = [subPanelContext.occContext.rootElement];
    const backingObjects = aceBackingObjectProviderService.getBackingObjectsSync(inputData);
    let parentUid = '';
    if(backingObjects && backingObjects[0] && backingObjects[0].uid){
        parentUid = backingObjects[0].uid;
    }
    const performSearchInput = {
        columnConfigInput: {
            clientName: "AWClient",
            clientScopeURI: ""
        },
        searchInput: {
            maxToLoad: 25,
            maxToReturn: 25,
            providerName: "Smc0CfgPerspectiveProvider",
            searchCriteria: {
                parentUid: parentUid
            },
            startIndex: 0
        }
    };

    const response = await tcDataManagementService.basePerformSearchViewModel( performSearchInput );
    occContext.configPerspective = getCfgPerspectiveFromResponse( response );
    return occContext.configPerspective;
};

const getCfgPerspectiveFromResponse = ( response ) => {
    if( response.ServiceData ) {
        if( response.searchResultsJSON && response.ServiceData && response.ServiceData.modelObjects ) {
            const searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

            if( searchResults && searchResults.objects ) {
                const searchedObjects = searchResults.objects.map( function( searchedObject ) {
                    return response.ServiceData.modelObjects[ searchedObject.uid ];
                } );

                if( searchedObjects.length > 0 ) {
                    return searchedObjects[ 0 ].uid;
                }
            }
        }
    }
    return null;
};

/**
 * PCA Structure Variant service utility
 */

export default exports = {
    processVariantRules,
    prepareCfgProviderInput,
    getLastUid,
    getConfigPerspective
};
