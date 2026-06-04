// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link indexerDiagnosticService}
 *
 * @module js/indexerDiagnosticService
 */
import _ from 'lodash';
import searchCommonUtils from 'js/searchCommonUtils';
import indexerAdminConstants from './indexerAdminConstants';
import ddsCommonUtils from './ddsCommonUtils';

var exports = {};

/**
   * Get search and diagnostic information for object data indexer
   * @param {Object} searchState subPanelContext's searchState
   */
export let setAdvancedSearchState = function( searchState ) {
    let tmpContext = { ...searchState.value };
    tmpContext.provider = indexerAdminConstants.DDS_INDEXINGSTATUS_DETAILSPROVIDER;
    tmpContext.advancedSearchCriteria = '';
    tmpContext.advancedSearchJSONString = '';
    tmpContext.savedQuery = {};
    tmpContext.savedQuery.name = '';
    tmpContext.savedQuery.value = '';
    tmpContext.isFilterCategoryValueChanged = false;
    searchState.update( tmpContext );
};

/**
   * Get search and diagnostic information for object data indexer
   * @param {Object} resultStatusSummaryRadio subPanelContext's searchState
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} datai18n  viewModel's i18n data
   * @return {Object} status summary data
   */
export let resetAdvanceSearchResultsData = function( resultStatusSummaryRadio, searchState, datai18n ) {
    resultStatusSummaryRadio.dbValue = null;
    resultStatusSummaryRadio.propertyDisplayName = datai18n.statusSummaryTitle;

    let searchResponsePending = true;
    let tmpContext = { ...searchState.value };
    tmpContext.selectedStatusOnRadio = null;
    searchState.update( tmpContext );
    return {
        resultStatusSummaryRadio: resultStatusSummaryRadio,
        searchResponsePending: searchResponsePending,
        zeroValueStatusSelected: false,
        isStatusSelectedInStatusSummary: false
    };
};

/**
   * Create ViewModel property for indexer/solr-related properties
   * @param {Object} resultsStatusSummary Results Status Summary
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} resultStatusSummaryRadio Result Status Summary radio
   * @param {Object} datai18n viewModel's i18n data
   * @returns {Object} diagnostic search result titles
   */
export let createVMOforResultsStatusSummary = function( resultsStatusSummary, searchState, resultStatusSummaryRadio, datai18n ) {
    var resultStatusSummaryRadioValues = {
        type: 'STRING',
        dbValue: []
    };
    let totalResultsFound = 0;
    resultsStatusSummary = searchStatusInResult( resultsStatusSummary );

    _.forEach( resultsStatusSummary, function( resultsStatus ) {
        let tmpCell = {};
        let temp = getStatusNameLocalizationKey( resultsStatus.name );
        tmpCell.propDisplayValue =  datai18n[temp] + ': ' + resultsStatus.value;
        tmpCell.propInternalValue = resultsStatus.name;
        totalResultsFound +=  resultsStatus.value;
        resultStatusSummaryRadioValues.dbValue.push( tmpCell );
    } );

    resultStatusSummaryRadioValues.dbValue.push( {
        propDisplayValue :  datai18n.allStatusDisplayName + ': ' + totalResultsFound,
        propInternalValue : indexerAdminConstants.ALL_STATUS
    } );

    let diagnosticResultStatusTitle;
    if( searchState.selectedStatusOnRadio && searchState.selectedStatusOnRadio !== indexerAdminConstants.ALL_STATUS ) {
        resultStatusSummaryRadio.dbValue = searchState.selectedStatusOnRadio;
        diagnosticResultStatusTitle = datai18n.inStatus + ' ' + datai18n[ getStatusNameLocalizationKey( resultStatusSummaryRadio.dbValue ) ] + ' ' + datai18n.diagnosticResultStatusTitle;
    } else {
        resultStatusSummaryRadio.dbValue = indexerAdminConstants.ALL_STATUS;
        diagnosticResultStatusTitle = datai18n.allStatusResultTitle;
    }

    if( !diagnosticResultStatusTitle ) {
        diagnosticResultStatusTitle = datai18n.resultTitle;
    }
    let diagnosticResultTitle = datai18n.objectDataIndexingStatusSummary;

    let tmpState = { ...searchState.value };
    tmpState.diagnosticResult = {};
    tmpState.diagnosticResult.resultsStatusSummary = resultsStatusSummary;
    tmpState.diagnosticResult.totalResultsFound = totalResultsFound;
    searchState.update( tmpState );

    return {
        resultStatusSummaryRadioValues: resultStatusSummaryRadioValues,
        resultStatusSummaryRadio: resultStatusSummaryRadio,
        diagnosticResultStatusTitle: diagnosticResultStatusTitle,
        diagnosticResultTitle:diagnosticResultTitle
    };
};

let getStatusNameLocalizationKey = function( statusName ) {
    let tempKey = statusName;
    if( tempKey === indexerAdminConstants.FIRST_STATUS ) {
        tempKey = 'firstStatus';
    } else if ( tempKey === indexerAdminConstants.SECOND_STATUS ) {
        tempKey = 'secondStatus';
    } else if ( tempKey === indexerAdminConstants.THIRD_STATUS ) {
        tempKey = 'thirdStatus';
    } else if ( tempKey === indexerAdminConstants.FOURTH_STATUS ) {
        tempKey = 'fourthStatus';
    }
    return tempKey;
};

/**
   * Update result Status radio information once new radio button is selected
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} resultStatusSummaryRadio result Status Radio information
   * @param {Object} resultStatusSummaryRadioValues all radio button values
   * @returns {Object} diagnostic search result summary title
   */
export let selectedStatusActionInStatusResult = function( searchState, resultStatusSummaryRadio, resultStatusSummaryRadioValues ) {
    let tmpState = { ...searchState.value }; let foundNonZeroValue = false;
    let zeroValueStatusSelected;
    let allStatusCount = resultStatusSummaryRadioValues.dbValue;
    for( const index in allStatusCount ) {
        if( allStatusCount[ index ].propInternalValue === resultStatusSummaryRadio.dbValue ) {
            let arr = allStatusCount[index].propDisplayValue.split( ': ' );
            if( arr[1] > 0 ) {
                foundNonZeroValue = true;
                break;
            }
            break;
        }
    }
    if( foundNonZeroValue ) {
        zeroValueStatusSelected = false;
    } else {
        zeroValueStatusSelected = true;
    }
    tmpState.isFilterCategoryValueChanged = !searchState.isFilterCategoryValueChanged;
    tmpState.selectedStatusOnRadio = resultStatusSummaryRadio.dbValue;
    searchState.update( tmpState );
    return {
        zeroValueStatusSelected: zeroValueStatusSelected,
        isStatusSelectedInStatusSummary: true,
        searchResponsePending: true
    };
};

/**
 * Get the input search filter map
 * @function getSearchCriteria
 * @param {Object} data - data
 * @param {String} selectedRadioValue - Value of selected radio option
 * @return {Object} Input search Filter Map
 */
export let getInputSearchCriteria = function(data, searchCriteria) {
    if (searchCriteria) {
        searchCriteria.exportToExcel = "true";
    }
    return searchCriteria;
};

/**
 * Get the input search filter map
 * @function getSearchCriteria
 * @param {Object} data - data
 * @param {String} selectedRadioValue - Value of selected radio option
 * @return {Object} Input search Filter Map
 */
export let getInputSearchFilterMap = function(data, selectedRadioValue) {
    return {
        Application: [
            {
                stringValue: "Object-data"
            }
        ],
        State: [
            {
                stringValue: selectedRadioValue
            }
        ]
    };
};

/**
 * Get export options for export to excel
 * @function getSearchCriteria
 * @param {Object} data - data
 * @param {String} selectedRadioValue - Value of selected radio option
 * @return {Object} export options
 */
export let getExportOptions = function(data, selectedRadioValue) {
    return ddsCommonUtils.createExportOptions('IndexingStatus', selectedRadioValue);
};

/**
 * get diagnostic's searchcriteria
 * @function getSearchCriteria
 * @param {Number} startIndex - startIndex
 * @param {Object} searchState - searchState
 * @return {Object} search criteria
 */
export let getDiagnosticsSearchCriteria = function( startIndex, searchState ) {
    const criteria = searchState.advancedSearchCriteria;
    if( criteria ) {
        if( searchState && startIndex > 0 ) {
            //it's a scrolling case
            criteria.totalObjectsFoundReportedToClient = searchState.totalFound?.toString();
            criteria.lastEndIndex = searchState.lastEndIndex?.toString();
        } else {
            criteria.totalObjectsFoundReportedToClient = 0;
            criteria.lastEndIndex = 0;
        }
        criteria.exportToExcel = "false";
        searchState.update( { ...searchState.value, advancedSearchCriteria: criteria } );
    }
    return criteria;
};

/**
 * Get the default page size used for max to load/return.
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return searchCommonUtils.getDefaultPageSize( defaultPageSizePreference );
};

/**
 * Get status and corresponding count
 * @param {Object} data - data provider response with statuses count
 * @returns {Object} Object with status count
 */
export let getResultsStatusSummary = function( data ) {
    let resultStatusSummary = [];
    if( data.searchFilterMap && data.searchFilterMap.State ) {
        _.forEach( data.searchFilterMap.State, function( state ) {
            resultStatusSummary.push( {
                name: state.stringDisplayValue,
                value: state.count
            } );
        } );
    }
    return resultStatusSummary;
};

let searchStatusInResult = function( resultsStatusSummary ) {
    let statusList = [ indexerAdminConstants.FIRST_STATUS, indexerAdminConstants.SECOND_STATUS, indexerAdminConstants.THIRD_STATUS, indexerAdminConstants.FOURTH_STATUS ];
    let found; let  obj;
    let resultStatusSummaryNew = []; let atIndex;
    _.forEach( statusList, function( status ) {
        found = false;
        for( const index in resultsStatusSummary ) {
            if( resultsStatusSummary[ index ].name === status ) {
                found = true;
                atIndex = index;
                break;
            }
        }
        if( !found ) {
            obj = {
                name: status,
                value: 0
            };
            resultStatusSummaryNew.push( obj );
        } else {
            obj = {
                name: resultsStatusSummary[ atIndex ].name,
                value: resultsStatusSummary[ atIndex ].value
            };
            resultStatusSummaryNew.push( obj );
        }
    } );
    return resultStatusSummaryNew;
};
export default exports = {
    createVMOforResultsStatusSummary,
    getDefaultPageSize,
    getDiagnosticsSearchCriteria,
    getResultsStatusSummary,
    setAdvancedSearchState,
    selectedStatusActionInStatusResult,
    resetAdvanceSearchResultsData,
    getInputSearchCriteria,
    getInputSearchFilterMap,
    getExportOptions
};
