// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link indexingStatusService}
 *
 * @module js/indexingStatusService
 */
import _ from 'lodash';
import indexerAdminConstants from './indexerAdminConstants';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import parsingUtils from 'js/parsingUtils';
import ddsCommonUtil from './ddsCommonUtils';

var exports = {};

/**
   * Perform SOA call to get object/file list of selected indexing status
   * @param {Object} searchState subPanelContext's search state
   * @param {Object} selectedIndexingStatus object data state or file content is selected
   * @returns {Object}  indexer health status, object data indexing status, file content indexing status and search input
   */
export let getSelectedIndexingStatusList = function( searchState, selectedIndexingStatus ) {
    var searchInput = createSearchInput( searchState, selectedIndexingStatus );
    var request = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Dds0SearchResults',
            columnsToExclude: [],
            hostingClientName: '',
            operationType: ''
        },
        searchInput: searchInput,
        inflateProperties: true
    };

    return tcDataMgmtSvc.basePerformSearchViewModel( request ).then( function( response ) {
        var results = parsingUtils.parseJsonString( response.searchResultsJSON );

        var output = {};
        output.objectsList = results.objects;
        output.totalFound = response.totalFound;
        output.columnConfig = response.columnConfig;
        output.searchInput = updateSearchCriteria( request.searchInput );
        output.exportOptions = ddsCommonUtil.createExportOptions( selectedIndexingStatus, request.searchInput.searchFilterMap6.State[0].stringValue );


        var tmpendIndex;
        var tmpState = searchState.value;
        if( selectedIndexingStatus === indexerAdminConstants.SELECTEDOBJDATA_INDEXINGSTATUSTITLE ) {
            tmpState.objdataIndexing.startIndex = searchState.objdataIndexing.endIndex + 1;
            tmpendIndex = searchState.objdataIndexing.endIndex + response.totalLoaded;
            output.columnConfig.saveColumnAndLoadAction =  'saveObjectDataColumnConfigLoadData';
            output.columnConfig.saveColumnAction = 'saveObjectDataColumnConfig';
            output.columnConfig.resetColumnAction = 'resetObjectDataColumnConfig';
            if( response.totalFound > tmpendIndex ) {
                tmpState.objdataIndexing.endIndex = tmpendIndex;
            } else {
                tmpState.objdataIndexing.endIndex = response.totalFound;
            }
        } else {
            tmpState.filecontentIndexing.startIndex = searchState.filecontentIndexing.endIndex + 1;
            tmpendIndex = searchState.filecontentIndexing.endIndex + response.totalLoaded;
            output.columnConfig.saveColumnAndLoadAction =  'saveFileContentColumnConfigLoadData';
            output.columnConfig.saveColumnAction = 'saveFileContentColumnConfig';
            output.columnConfig.resetColumnAction = 'resetFileContentColumnConfig';
            if( response.totalFound > tmpendIndex ) {
                tmpState.filecontentIndexing.endIndex = tmpendIndex;
            } else {
                tmpState.filecontentIndexing.endIndex = response.totalFound;
            }
        }
        searchState.update( tmpState );
        return output;
    } );
};

/**
   * Updates the search criteria to set export to excel
   * @param {Object} searchInput the search input
   * @returns {Object} searchInput
   */
let updateSearchCriteria = function( searchInput ) {
    searchInput.searchCriteria.exportToExcel = 'true';
    return searchInput;
};

/**
   * Creates search input
   * @param {Object} searchState subPanelContext's search state
   * @param {Object} selectedIndexingStatus object data state or file content is selected
   * @returns {Object} searchInput
   */
let createSearchInput = function( searchState, selectedIndexingStatus ) {
    var applicationValue; var selectedState;
    var startIndex; var endIndex;
    if( selectedIndexingStatus === indexerAdminConstants.SELECTEDOBJDATA_INDEXINGSTATUSTITLE ) {
        applicationValue = indexerAdminConstants.JSON_REQUEST_OBJDATA_APPLICATIONVALUE;
        selectedState = searchState.selectedObjdataIndexingStatus.internalName;
        startIndex = searchState.objdataIndexing.startIndex;
        endIndex = searchState.objdataIndexing.endIndex;
    }else {
        applicationValue = indexerAdminConstants.JSON_REQUEST_FILECONTENT_APPLICATIONVALUE;
        selectedState = searchState.selectedFilecontentIndexingStatus.internalName;
        startIndex = searchState.filecontentIndexing.startIndex;
        endIndex = searchState.filecontentIndexing.endIndex;
    }

    return {
        maxToLoad: 50,
        maxToReturn: 50,
        providerName: indexerAdminConstants.DDS_INDEXINGSTATUS_DETAILSPROVIDER,
        searchCriteria: {
            typeOfSearch: 'ACCT_TABLE_SEARCH',
            exportToExcel: 'false'
        },
        cursor:{
            startIndex: startIndex,
            endIndex: endIndex
        },
        searchFilterMap6: {
            Application: [
                {
                    stringValue: applicationValue
                }
            ],
            State: [
                {
                    stringValue: selectedState
                }
            ]
        }
    };
};

/**
   * reset Object data indexing status and file content indexing status to show chart if section is collapsed
   * @param {Object} sectionName collapsed section name
   * @param {Object} hasSelectedFilecontentIndexingStatus whether file content indexing state table is showing or not
   * @param {Object} hasSelectedObjdataIndexingStatus whether object data indexing state table is showing or not
   * @returns {Object}  indexer health status, object data indexing status and file content indexing status
   */
export let resetIndexingstatusCommandPanelSection = function( sectionName, hasSelectedFilecontentIndexingStatus, hasSelectedObjdataIndexingStatus ) {
    if( sectionName === indexerAdminConstants.OBJECTDATA_COMMANDPANEL_SECTIONNAME && hasSelectedObjdataIndexingStatus === true ) {
        return {
            hasSelectedFilecontentIndexingStatus: hasSelectedFilecontentIndexingStatus,
            hasSelectedObjdataIndexingStatus: false
        };
    } else if( sectionName === indexerAdminConstants.FILECONTENT_COMMANDPANEL_SECTIONNAME && hasSelectedFilecontentIndexingStatus === true ) {
        return {
            hasSelectedFilecontentIndexingStatus: false,
            hasSelectedObjdataIndexingStatus: hasSelectedObjdataIndexingStatus
        };
    }
    return {
        hasSelectedFilecontentIndexingStatus: hasSelectedFilecontentIndexingStatus,
        hasSelectedObjdataIndexingStatus: hasSelectedObjdataIndexingStatus
    };
};

export default exports = {
    getSelectedIndexingStatusList,
    resetIndexingstatusCommandPanelSection
};
