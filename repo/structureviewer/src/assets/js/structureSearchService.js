// Copyright (c) 2022 Siemens

/**
 * @module js/structureSearchService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

/**
 * try to apply search criteria in Viewer
 *
 * @param viewerPageTitle viewer tab title
 *
 */
export let applySearchCiteriaInViewer = function(context) {
    
    const defaultPageSizePreference = appCtxSvc.getCtx( 'preferences.AWC_DefaultPageSize' );
    const pageSizePreferenceValue = defaultPageSizePreference && defaultPageSizePreference[ 0 ] ? parseInt( defaultPageSizePreference[ 0 ] ) : 50;
    var searchCriteria = context.searchState.criteria?context.searchState.criteria:context.searchState.advancedSearchCriteria;
    var searchCriteriaForViewer = {
        searchCriteria: {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: context.preFilterContext.clientScopeURI,
                columnsToExclude: [],
                hostingClientName: '',
                operationType: 'intersection'
            },
            searchInput: {
                attributesToInflate: [],
                internalPropertyName: '',
                maxToLoad: pageSizePreferenceValue,
                maxToReturn: pageSizePreferenceValue,
                providerName: context.searchState.provider,
                searchCriteria: searchCriteria,
                searchFilterFieldSortType: context.searchState.sortType,
                searchFilterMap: context.searchState.activeFilterMap,
                searchSortCriteria: [],
                startIndex: context.searchState.endIndex - context.searchState.totalLoaded
            }
        },
        activeContext : context.preFilterContext.contextKey,
        showOnlyInViewer : true
    };
    occmgmtUtils.updateValueOnCtxOrState('searchCriteriaForViewer', searchCriteriaForViewer, context.preFilterContext.occContext);    
};

export default exports = {
    applySearchCiteriaInViewer
};
