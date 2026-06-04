// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Logic for Cluster Shape Search
 * @module js/SS1ClusterSearchService
 */

import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import awSearchService from 'js/awSearchService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import searchFilterSvc from 'js/aw.searchFilter.service';
import localeService from 'js/localeService';
import _cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';

// Array to store property policy objects for graph properties.
let clusterGraphPropPolicyObjs = [];

let getClusterSearchCriteria = function( clusterCandidates ) {
    let searchCriteria = '';
    if( Array.isArray( clusterCandidates ) && clusterCandidates.length > 0 ) {
        for( let i = 0; i < clusterCandidates.length; i++ ) {
            searchCriteria += clusterCandidates[ i ].uid;
            if( i < clusterCandidates.length - 1 ) {
                searchCriteria += ';';
            }
        }
    } else {
        searchCriteria = clusterCandidates;
    }
    return searchCriteria;
};

/**
 * This function will perform the cluster search by calling the performSearchViewModel SOA call.
 * This function is called from the ViewModel JSON file.
 * @param {object} targetState : Target search state
 * @param {object} clusterCandidate : List of objects selected for cluster search
 * @param {String} searchBoxContent : String to display in the global search text box
 */
export let doClusterSearch = function( targetState, clusterCandidate, searchBoxContent ) {
    AwStateService.instance.go( targetState ? targetState : '.', {
        filter: '',
        searchCriteria: getClusterSearchCriteria( clusterCandidate ),
        secondaryCriteria: '*',
        searchBoxContent: searchBoxContent
    } );
};

/**
 * populateShapeSearchFilter
 *
 * @function populateShapeSearchFilter

 *
 * @param {Object}stringValuePref - string value for shapeSearch filter
 *
 * @return {Object} shape search filter with values populated
 */
export let populateShapeSearchFilter = function( stringValuePref ) {
    return [ {
        searchFilterType: 'StringFilter',
        stringValue: stringValuePref,
        selected: false,
        stringDisplayValue: '',
        startDateValue: '',
        endDateValue: '',
        startNumericValue: 0,
        endNumericValue: 0,
        count: 0,
        startEndRange: ''
    } ];
};

/**
 * The aim of this function is to help determine if search crtiteria and filter criteria are present.
 * This function is called from the ViewModel JSON file and is part of initClusterSearchPanel function.
 * @returns {boolean} true if search criteria and filter criteria are present
 */
export let validateCriteriaAndInitiateSearch = () => {
    const stateParams = AwStateService.instance.params;
    const shapeSearchCriteria = stateParams.searchCriteria;
    const shapeSearchFilterCriteria = stateParams.filter;
    return shapeSearchCriteria && shapeSearchCriteria.length > 0 &&
        shapeSearchFilterCriteria && shapeSearchFilterCriteria.length > 0;
};

/**
 * This function will determineif we have a valid selection for cluster search from Palette tab.
 * @param {object} data : Data object from View model
 * @param {object} addPanelState : Add panel state object
 * @returns {boolean} true if we have a valid selection for cluster search from Palette tab
 */
export const checkClusterTargetVisibilityForPalette = async function( data, addPanelState ) {
    return data.selectedTab.tabKey === 'palettePage' && addPanelState.sourceObjects && addPanelState.sourceObjects[ 0 ] !== undefined;
};

const _getTab = ( tabKey, pageId, viewName, tabTitle, priority, isSelected ) => {
    return {
        tabKey,
        pageId,
        view: viewName,
        name: tabTitle,
        recreatePanel: true,
        priority,
        selectedTab: isSelected
    };
};

/**
 * This function will initialize the cluster search panel with tabs.
 * This function is called from the ViewModel JSON file.
 * @returns {Array} tabsModel
 */
export let initClusterSearchPanel = function( ) {
    let tabsModel = [];
    tabsModel.push( _getTab( 'results', 'results', undefined, 'Results', 0 ) );
    return tabsModel;
};

/**
 * This function will update the search state with the total objects found reported to client.
 * This function is called from the ViewModel JSON file as part of SOA response processing.
 * @param {object} searchState : Search state object
 * @param {object} searchStateUpdater : Atomic Data Updater for search state
 */
export let updateSearchCriteriaForObjectsReported = function( searchState, searchStateUpdater ) {
    if( searchState.totalLoaded ) {
        const newSearchState = { ...searchState };
        newSearchState.criteria.totalObjectsFoundReportedToClient = searchState.endIndex.toString();
        searchStateUpdater.searchState( newSearchState );
    }
};

/**
 * This function will update the search state with the search string.
 * This function is called from the ViewModel JSON file when search string changes. It is invoked via onUpdate hook.
 * @param {object} searchState : Search state object
 * @param {object} searchStateUpdater : Atomic Data Updater for search state
 */
export let updateSearchCriteriaSearchString = function( searchState, searchStateUpdater ) {
    if( searchState.criteria ) {
        const newSearchState = { ...searchState };
        newSearchState.criteria.totalObjectsFoundReportedToClient = '0';
        searchStateUpdater.searchState( newSearchState );
    }
};

/**
 * This function will activate the Search for Cluster Targets Panel while landing on Cluster tab.
 * @param {object} searchState : Search state object
 * @param {object} subPanelContext : Sub panel context object
 * @param {object} searchClusterDialogAction : Search Cluster Dialog Action to open/show the dialog
 * @returns {object} Dialog object.
 */
export let activateShapeClustersAction = ( searchState, subPanelContext, searchClusterDialogAction ) => {
    let markUpOptions = {
        view: 'SS1ShapeSearchForClusterLocation',
        parent: '.aw-layout-workarea',
        placement: 'left',
        width: 'SMALL',
        height: 'FULL',
        push: true,
        isCloseVisible: false,
        subPanelContext : { ...subPanelContext, searchState:searchState },
        commandid: 'SS1TargetSearchInClusterLocation',
        commandicon: 'cmdSelectParts'
    };
    return searchClusterDialogAction.show( markUpOptions ).then( ( { id } )=>{
        let newSearchState = searchState.getValue();
        newSearchState.clusterSearchPopupId = id;
        searchState.update( newSearchState );
    } );
};

/**
 * Dynamically register the property policy for the graph properties. This will make sure that we add these
 * properties to the property policy service for the SOA call.
 */
let _registerPropertyPolicyForGraph = () => {
    // Extract the props from the preference.
    let preferences = appCtxService.getCtx( 'preferences' );
    if( preferences.SS1_Identity_report_graph_properties === undefined ) {
        return;
    }

    // Get the values from 'SS1_Identity_report_graph_properties' preference.
    let graphProperties = preferences.SS1_Identity_report_graph_properties;

    // Check to see if the preference values have Type information also present. The type information is separated by a '.'.
    // If the type information is not present, then assume type to be ItemRevision.
    // Iterate over all the properties and register the property policy for each property.
    for( let i = 0; i < graphProperties.length; i++ ) {
        let property = graphProperties[ i ];
        let propertyArray = property.split( '.' );
        // If the splitted array has length greater than 1, then type information is present.
        let objectType = 'ItemRevision';
        let propName = property;
        if( propertyArray.length > 1 ) {
            objectType = propertyArray[ 0 ];
            propName = propertyArray[ 1 ];
        }
        let propertyPolicyObj = {
            types: [ {
                name: objectType,
                properties: [ {
                    name: propName
                } ]
            } ]
        };

        // Register each prop in the property policy service.
        clusterGraphPropPolicyObjs[i] = propPolicySvc.register( propertyPolicyObj );
    }
};

/**
 * Dynamically unregister the property policy for the graph properties. This will make sure that we remove these
 * properties from the property policy service after the SOA call is done.
 */
let _unRegisterPropertyPolicyForGraph = () => {
    for( let i = 0; i < clusterGraphPropPolicyObjs.length; i++ ) {
        propPolicySvc.unregister( clusterGraphPropPolicyObjs[ i ] );
    }
};

/**
 * The aim of this function is to load the cluster details by calling the loadData SOA call.
 * This function is called from the ViewModel JSON file, when cluster details tab is selected.
 * @param {Object} columnConfigInput : Column configuration input
 * @param {object} saveColumnConfigData : Save column configuration data
 * @param {object} searchInput : Search input containing search criteria
 * @returns {Promise} loadClusterDetailOut
 */
export let loadClusterDetails = async( columnConfigInput, saveColumnConfigData, searchInput ) => {
    // Extract the props to be loaded for graph from preferences and set them in property policy for this SOA call.
    _registerPropertyPolicyForGraph();

    // Return the SOA call output.
    let loadClusterDetailOut = await awSearchService.loadData( columnConfigInput, saveColumnConfigData, searchInput );

    // Unregister the property policy for graph after the SOA call is done.
    _unRegisterPropertyPolicyForGraph();

    return loadClusterDetailOut;
};

/**
 * The aim of this function is to get the search criteria for the cluster details.
 * This function is called from the ViewModel JSON file, when cluster details tab is selected and loadData SOA call is made.
 * @param {Object} eventData : Event data object
 * @returns {string} Concatenated string of selected cluster uids
 */
export let getClusterDetailsSearchCriteria = ( eventData ) => {
    let selectedClusters = [];
    if( eventData?.selectedObjects?.length > 0 ) {
        // Get changed selection from the event data.
        selectedClusters = eventData.selectedObjects;
    } else if( eventData?.scope?.ctx?.mselected?.length > 0 ) {
        selectedClusters = eventData.scope.ctx.mselected;
    } else {
        let currentSelection = appCtxService.getCtx( 'selected' );
        if( currentSelection ) {
            selectedClusters.push( currentSelection );
        }
    }

    let searchCriteria = {};
    // construct the concatinated string of selected cluster uids
    let searchString = '';
    for( let i = 0; i < selectedClusters.length; i++ ) {
        searchString += selectedClusters[ i ].uid;
        if( i < selectedClusters.length - 1 ) {
            searchString += ';';
        }
    }

    // Set the search string as attribute in the search criteria
    searchCriteria.searchString = searchString;
    // Set fetchIdenticalObjects to true to get all the identical objects in searchCriteria
    searchCriteria.fetchIdenticalObjects = 'true';

    // add required field.
    searchCriteria.dcpSortByDataProvider = 'true';
    searchCriteria.forceThreshold = 'false';
    searchCriteria.searchFromLocation = 'global';


    return searchCriteria;
};

export let getClusterDetailsDefaultPageSize = ( preferenceName ) => {
    // return searchCommonUtils.getDefaultPageSize( preferenceName );
    return 2000;
};

/**
 * This function will set the sort criteria for the cluster details table.
 * @param {Object} sortCriteria : Applied sort criteria
 * @returns {object} sortCriteria : Updated sort criteria
 */
export let getClusterDetailsSortCriteria = ( sortCriteria ) => {
    // Use the appCtx service to update the current input sort criteria for this sublocation.
    if( sortCriteria?.length > 0 ) {
        let sublocationCtx = appCtxService.getCtx( 'sublocation' );
        sublocationCtx.sortCriteria = sortCriteria;
        appCtxService.updatePartialCtx( 'sublocation', sublocationCtx );
    }
    return sortCriteria;
};

export let getActualTotalFoundForClusterDetails = ( soaResponse ) => {
    return awSearchService.getActualTotalFound( soaResponse );
};

export let getVMOsWithClusterDetailsColoring = ( soaResponse, showChartColorBars ) => {
    return awSearchService.getVMOsWithColoring( soaResponse, showChartColorBars );
};

export let processClusterDetailsOutput = ( data, dataCtxNode, searchData ) => {
    if( data.totalFound > 0 ) {
        return awSearchService.processOutput( data, dataCtxNode, searchData );
    }
};

/**
 * The aim of this function is to get the target object names from the search string.
 * @param {string} searchString : Concatenated Search string
 * @returns {string} searchCriteria : Comma separated string of target object names.
 */
let _getTargetObjectFromSearchString = ( searchString ) => {
    let searchCriteria = '';
    let targetUIDs = searchString.split( ';' );
    if( targetUIDs.length > 0 ) {
        for( let i = 0; i < targetUIDs.length; i++ ) {
            let targetObject = _cdm.getObject( targetUIDs[ i ] );
            if( targetObject && targetObject.props && targetObject.props.object_name && targetObject.props.object_name.dbValues ) {
                searchCriteria += targetObject.props.object_name.dbValues[0];
            } else {
                searchCriteria += searchString;
            }
            if( i < targetUIDs.length - 1 ) {
                searchCriteria += ', ';
            }
        }
    }
    return searchCriteria;
};

/**
 * The aim of this function is to build the breadcrumb title for the cluster search.
 * @param {Object} searchObject : Search Object
 * @returns {Promise} localizedText : Localized text for the breadcrumb title
 */
export let buildClusterBreadCrumbTitle = ( searchObject ) => {
    if( searchObject ) {
        let totalFound;
        let searchCriteria = '';
        let label = '';
        //Get search Criteria, Total Found and Crumbs
        if( searchObject.totalFound >= 0 ) {
            totalFound = searchObject.totalFound;
            if( searchObject.cursorInfo && !searchObject.cursorInfo.endReached ) {
                // In case of Identitiy Report provider, server will always send +2 number on total found for paging.
                // Subtract 2 from total found to get actual total found.
                totalFound -= 2;
                totalFound += '+';
            }
        }
        if( searchObject.criteria && searchObject.criteria.searchString ) {
            // Get search criteria from target objects in search string
            searchCriteria = _getTargetObjectFromSearchString( searchObject.criteria.searchString );
        }
        if( searchObject.label ) {
            label = searchObject.label;
        }
        if( searchObject.showNoCriteriaMessage && searchObject.noCriteriaMessage && searchObject.noCriteriaMessage.length > 0
            && ( !searchCriteria || searchCriteria && searchCriteria.length === 0 ) ) {
            return localeService.getLocalizedTextFromKey( searchObject.noCriteriaMessage ).then( ( localizedText ) => {
                if( localizedText && localizedText.length > 0 ) {
                    return localizedText;
                }
                return '';
            } );
        } else if( searchObject.showNoCriteriaMessage && !searchObject.noCriteriaMessage
            && ( !searchCriteria || searchCriteria && searchCriteria.length === 0 ) ) {
            return localeService.getLocalizedTextFromKey( 'SearchMessages.resultsNoCriteriaDefaultMessage' ).then( ( localizedText ) => {
                return localizedText;
            } );
        }
        return searchFilterSvc.loadBreadcrumbTitle( label, searchCriteria, totalFound ).then( ( localizedText ) => {
            return localizedText;
        } );
    }
    return Promise.resolve( {} );
};

var _updateReportColumnsRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        var identicalDataDetails = appCtxService.getCtx( 'search.identicalDataDetails' );

        if( vmo.uid && column.propertyName && identicalDataDetails[vmo.uid] && identicalDataDetails[vmo.uid][column.propertyName] ) {
            cellContent.innerText = '';
            let labelText = document.createElement( 'div' );
            labelText.textContent = identicalDataDetails[vmo.uid][column.propertyName];
            labelText.innerHTML = identicalDataDetails[vmo.uid][column.propertyName];
            labelText.classList.add( 'aw-splm-tableCellText' );
            cellContent.appendChild( labelText );
        }

        return cellContent;
    },
    condition: function() {
        var workspaceCtx = appCtxService.getCtx( 'workspace' );
        var locationCtx = appCtxService.getCtx( 'locationContext' );
        var preferencesCtx = appCtxService.getCtx( 'preferences' );
        return  workspaceCtx && workspaceCtx.workspaceId === 'PricingCompanionWorkspace' && locationCtx['ActiveWorkspace:SubLocation'] === 'teamcenter.search.clustersearch'
            && preferencesCtx.SS1_Identity_report_range_properties;
    },
    name: 'updateReportColumnsRenderer'
};

/**
 * The aim of this function is to process and update the Identical report columns by adding the identical count column.
 * This function is called from the ViewModel JSON file as part of SOA response processing.
 * @param {Array} columns : Array of columns
 * @param {Array} identicalDataList : Array of identical data list
 * @param {Array} propertiesToAddArrayString : Array of properties to add
 */
export const processAndUpdateReportColumns = ( columns, identicalDataList, propertiesToAddArrayString ) => {
    columns.splice( 1, 0, {
        hiddenFlag: false,
        isFilteringEnabled: true,
        isFrozen: false,
        isTextWrapped: false,
        columnOrder: 300,
        pixelWidth: 177,
        sortPriority: 0,
        propertyName: 'identicalCount',
        associatedTypeName: 'ItemRevision',
        displayName: localeService.getLoadedText( 'ClusterSearchMessages' ).identicalCount,
        sortDirection: '',
        filterDefinitionKey: '',
        dataType: '',
        filters: []
    } );
    let identicalDataDetails = {};
    let existingIdenticalDataDetails = appCtxService.getCtx( 'search.identicalDataDetails' );
    if( existingIdenticalDataDetails ) {
        identicalDataDetails = existingIdenticalDataDetails;
    }
    // We will always show Identical Object Count
    let identicalColumn = 'identicalCount';
    let columnsToModify = [ identicalColumn ];
    // Format data list into an object
    _.forEach( identicalDataList, function( entry ) {
        // Example input: uid:3WRxrlZ5JcQ1UA;tst2IdenticalCount:4;tst2Price:100-500
        let identicalDataArray = entry.split( ';' );
        let uidArray = identicalDataArray[0].split( ':' );

        const entries = new Map();
        for( var x = 1; x < identicalDataArray.length; x++ ) {
            // Add all property key-value pairs to a map
            let keyValueArray = identicalDataArray[x].split( ':' );
            entries.set( keyValueArray[0], keyValueArray[1] );
            if( !columnsToModify.includes( keyValueArray[0] ) ) {
                columnsToModify.push( keyValueArray[0] );
            }
        }

        identicalDataDetails[uidArray[1]] = Object.fromEntries( entries );
    } );

    appCtxService.updatePartialCtx( 'search.identicalDataDetails', identicalDataDetails );

    _.forEach( columns, function( columnToUpdate ) {
        // attach renderer to relevant columns
        for( var x = 1; x < columnsToModify.length; x++ ) {
            let isColumnInPreference = propertiesToAddArrayString.includes( columnToUpdate.propertyName );
            if( columnToUpdate.propertyName === identicalColumn || columnToUpdate.propertyName === columnsToModify[x] && isColumnInPreference ) {
                // attach renderer
                columnToUpdate.cellRenderers = [];
                columnToUpdate.cellRenderers.push( _updateReportColumnsRenderer );

                if( isColumnInPreference ) {
                    columnToUpdate.displayName += ' (' + localeService.getLoadedText( 'ClusterSearchMessages' ).clusterColumnRange + ')';
                }
            }
        }
    } );
};

/**
 * This function will remove the identical count column from the arrange Column data.
 * @param {object} eventData : Event data object
 */
export let removeIdenticalCountColumnFromArrangeData = ( eventData ) => {
    if( eventData.arrangeData && eventData.arrangeData.columnDefs ) {
        for( let x = 0; x < eventData.arrangeData.columnDefs.length; x++ ) {
            if( eventData.arrangeData.columnDefs[x].name === 'ItemRevision.identicalCount' ) {
                eventData.arrangeData.columnDefs.splice( x, 1 );
                eventData.arrangeData.filteredColumnDefs.splice( x, 1 );
                break;
            }
        }
    }
};

/**
 * This function will remove the identical count column from the tree data when resize or column movements are done.
 * @param {object} eventData : EventData object containing columns to be arranged
 */
export let removeIdenticalCountColumnFromTree = ( eventData ) => {
    if( eventData?.columns ) {
        for( let x = 0; x < eventData.columns.length; x++ ) {
            if( eventData.columns[x].name === 'ItemRevision.identicalCount' ) {
                eventData.columns.splice( x, 1 );
                break;
            }
        }
    }
};

/**
 * This function will update the cluster details table with sorted results based on the sort criteria.
 * @param {object} soaResponse : SOA Response object
 * @param {object} sortCriteria : Sort criteria object
 * @returns {object} searchResults : Search results with sorted results.
 */
let updateClusterDetailsTableWithSortedResults = ( soaResponse, sortCriteria ) => {
    let searchResults = awSearchService.getVMOsWithColoring( soaResponse, false );

    if( sortCriteria?.length > 0 && searchResults?.length > 0 ) {
        // Perform sorting on the search results based on sortCriteria[0].sortDirection
        let sortDirection = sortCriteria[0].sortDirection;
        // Sort field is the first field in the sortCriteria array.
        let sortField = sortCriteria[0].fieldName;
        // if the sortField contains a . separator, then it is a nested field. We need to split it and get the last element.
        if( sortField.includes( '.' ) ) {
            sortField = sortField.split( '.' ).pop();
        }

        // Now Sort Search Results based on the sort field and sort direction
        if ( sortDirection === 'ASC' ) {
            searchResults = _.orderBy( searchResults, [ result => result.props[sortField].uiValue ], [ 'asc' ] );
        } else if ( sortDirection === 'DESC' ) {
            searchResults = _.orderBy( searchResults, [ result => result.props[sortField].uiValue ], [ 'desc' ] );
        }
    }

    return searchResults;
};

const SS1ClusterSearchService = {
    populateShapeSearchFilter,
    validateCriteriaAndInitiateSearch,
    initClusterSearchPanel,
    checkClusterTargetVisibilityForPalette,
    updateSearchCriteriaForObjectsReported,
    updateSearchCriteriaSearchString,
    activateShapeClustersAction,
    doClusterSearch,
    loadClusterDetails,
    getClusterDetailsSearchCriteria,
    getClusterDetailsDefaultPageSize,
    getClusterDetailsSortCriteria,
    getActualTotalFoundForClusterDetails,
    getVMOsWithClusterDetailsColoring,
    processClusterDetailsOutput,
    buildClusterBreadCrumbTitle,
    processAndUpdateReportColumns,
    removeIdenticalCountColumnFromArrangeData,
    removeIdenticalCountColumnFromTree,
    updateClusterDetailsTableWithSortedResults
};

export default SS1ClusterSearchService;
