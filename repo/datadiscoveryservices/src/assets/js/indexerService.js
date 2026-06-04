// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link indexerService}
 *
 * @module js/indexerService
 */
import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import indexerAdminConstants from './indexerAdminConstants';
import soaService from 'soa/kernel/soaService';
import subscribingProcessService from 'js/indexerSubscribingProcessService';
import localSvc from 'js/localeService';
import contributionService from 'js/contribution.service';

var exports = {};

/**
   * Clears Dashboard's Summary information
   * @param {Object} dataprovider the data provider
   * @returns {Object} Summary page info
   */
export let clearPreviousDashboardData = function( dataprovider ) {
    dataprovider?.resetDataProvider();
    return {
        indexerHealthStatus: {},
        chartProviders: {},
        subscribingProcessList: {},
        basicIndexingPropVmos: [],
        detailsTablePropVmos: []
    };
};

/**
   * Resets the search state of indexing status
   * @param {Object} searchState subPanelContext's searchState
   */
export let resetIndexingStatusSearchState = function( searchState ) {
    if ( searchState.hasSelectedFilecontentIndexingStatus ) {
        searchState.filecontentIndexing.startIndex = 0;
        searchState.filecontentIndexing.endIndex = 49;
    }
    if (searchState.hasSelectedObjdataIndexingStatus) {
        searchState.objdataIndexing.startIndex = 0;
        searchState.objdataIndexing.startIndex = 49;
    }
};

/**
   * Get search and diagnostic information for object data indexer
   * @param {Object} datai18n ViewModel's i18n data
   * @returns {Object} indexer health status, object data indexing status and file content indexing status
   */
export let getIndexerDashboardDetails = function( datai18n ) {
    var request = {
        input:  {
            components:
            [
                {
                    id: indexerAdminConstants.JSON_REQUEST_SOLRCOMPONENT_ID
                },
                {
                    id: indexerAdminConstants.JSON_REQUEST_FMSCOMPONENT_ID
                },
                {
                    id: indexerAdminConstants.JSON_REQUEST_FILECONTENTCOMPONENT_ID
                },
                {
                    id: indexerAdminConstants.JSON_REQUEST_INDEXERSTATUS_COMPONENT_ID
                },
                {
                    id: indexerAdminConstants.JSON_REQUEST_SCRATCHTABLE_COMPONENT_ID
                },
                {
                    id: indexerAdminConstants.JSON_REQUEST_SUBTABLE_COMPONENT_ID
                }
            ]
        }
    };

    return soaService.post( indexerAdminConstants.SOA_NAME_DDS_OBJDATAINDEXER_DASHBOARD, indexerAdminConstants.OPERATION_NAME_DDS_OBJDATAINDEXER_DASHBOARD,
        request ).then( function( response ) {
        var results = response.components;

        var indexerHealthStatus = {};
        var indexingStatusSummary = {};
        let subscribingProcessList = {};
        let indexingDetails = [];

        indexerHealthStatus.basicIndexingProp = [];
        indexerHealthStatus.detailsTableProp = [];
        indexingStatusSummary.ObjcountByStatus = [];
        indexingStatusSummary.FileContentCountByStatus = [];

        _.forEach( results, function( result ) {
            if( result.id === indexerAdminConstants.JSON_RESPONSE_INDEXERSTATUSID ) {
                _.forEach( result.diagnostics, function( diagnostic ) {
                    if( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_OBJDATASTATUSSUMMARYID && diagnostic.metrics.length !== 0 ) {
                        _.forEach( diagnostic.metrics, function( metric ) {
                            var tmpcell = {};
                            tmpcell.Status = metric.name;
                            tmpcell.Count = metric.values[ 0 ];
                            indexingStatusSummary.ObjcountByStatus.push( tmpcell );
                        } );
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_FILECONTENT_STATUSSUMMARY_ID && diagnostic.metrics.length !== 0 ) {
                        _.forEach( diagnostic.metrics, function( metric ) {
                            var tmpcell = {};
                            tmpcell.Status = metric.name;
                            tmpcell.Count = metric.values[ 0 ];
                            indexingStatusSummary.FileContentCountByStatus.push( tmpcell );
                        } );
                    }
                } );
            } else if ( result.id === indexerAdminConstants.JSON_RESPONSE_SUBSCRIPTIONTABLE_ID ) {
                _.forEach( result.diagnostics, function( diagnostic ) {
                    if( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_OLDTIMESTAMP_ID ) {
                        var tmpcell = {};
                        tmpcell.propertyName = indexerAdminConstants.TRACKING_CHANGES;
                        tmpcell.propertyValue = diagnostic.values ? subscribingProcessService.getConvertedDateValue( diagnostic.values[ 0 ] ) : '';
                        indexingDetails.push( tmpcell );
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_SUBSCRIPTIONAPPS_ID ) {
                        let columnInfos = subscribingProcessService.getSubscribingAppsColumns( datai18n );
                        subscribingProcessList.columnInfo = columnInfos;
                        subscribingProcessList.processList = diagnostic.metrics ? subscribingProcessService.getSubscribingProcessObjectList( diagnostic.metrics ) : [];
                        subscribingProcessList.totalFound = diagnostic.metrics ? diagnostic.metrics.length : 0;
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_STALE_APPS_ID ) {
                        // Only if response have stale app ids
                        if ( diagnostic.values ) {
                            subscribingProcessService.updateSubscribingAppsColumns( subscribingProcessList.columnInfo );
                            subscribingProcessService.updateStaleAppIdStatus( diagnostic.values, subscribingProcessList.processList, datai18n );
                        }
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_TIMESTAMP_THRESHOLD_ID ) {
                        tmpcell = {};
                        tmpcell.propertyName = indexerAdminConstants.TIMESTAMP_THRESHOLD;
                        tmpcell.propertyValue = diagnostic.values ? diagnostic.values[0] : '';
                        indexingDetails.push( tmpcell );
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_SUBSCRIPTIONAPPS_DESC_ID)  {
                        subscribingProcessService.updateAppIdDescription( diagnostic.metrics, subscribingProcessList.processList );
                    }
                } );
            } else if ( result.id === indexerAdminConstants.JSON_RESPONSE_SCRATCHTABLE_ID ) {
                _.forEach( result.diagnostics, function( diagnostic ) {
                    if( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_TRIGGERSCONDITION_ID && diagnostic.metrics.length !== 0 ) {
                        _.forEach( diagnostic.metrics, function( metric ) {
                            var tmpcell = {};
                            if( metric.name === 'Created' ) {
                                tmpcell.propertyName = indexerAdminConstants.NEWLY_CREATED_DATA;
                            } else if( metric.name === 'Deleted' ) {
                                tmpcell.propertyName = indexerAdminConstants.DELETED_DATA;
                            } else if( metric.name === indexerAdminConstants.GLOBAL_IMPACT ) {
                                tmpcell.propertyName = metric.name;
                            }
                            tmpcell.propertyValue = metric.values? metric.values[ 0 ] : '';
                            indexingDetails.push( tmpcell );
                        } );
                    } else if ( diagnostic.id === indexerAdminConstants.JSON_RESPONSE_SYNCTRIGGERS_ID  && diagnostic.metrics.length !== 0 ) {
                        _.forEach( diagnostic.metrics, function( metric ) {
                            var tmpcell = {};
                            tmpcell.propertyName = diagnostic.name + ' ' + metric.name;
                            tmpcell.propertyValue = metric.values[ 0 ];
                            indexerHealthStatus.basicIndexingProp.push( tmpcell );
                        } );
                    }
                } );
            } else {
                _.forEach( result.diagnostics, function( diagnostic ) {
                    var cell = {};
                    cell.propertyName = result.name + ' ' + diagnostic.name;
                    cell.propertyValue = diagnostic.values ? diagnostic.values[ 0 ] : 'OFF';
                    indexerHealthStatus.basicIndexingProp.push( cell );
                } );
            }
        } );

        // sorting properties\statuses in descending order
        indexingDetails.sort( compareStringForSorting );
        indexingStatusSummary.ObjcountByStatus.sort( compareStatus );
        indexingStatusSummary.FileContentCountByStatus.sort( compareStatus );

        indexerHealthStatus.detailsTableProp = indexingDetails;
        getNoStatusesCount( indexingStatusSummary.ObjcountByStatus );
        getNoStatusesCount( indexingStatusSummary.FileContentCountByStatus );

        return {
            indexerHealthStatus: indexerHealthStatus,
            indexingStatusSummary: indexingStatusSummary,
            subscribingProcessList: subscribingProcessList
        };
    } );
};

let compareStringForSorting = function( a, b ) {
    const nameA = a.propertyName ? a.propertyName.toUpperCase() : a.Status.toUpperCase(); // ignore upper and lowercase
    const nameB = b.propertyName ? b.propertyName.toUpperCase() : b.Status.toUpperCase(); // ignore upper and lowercase
    if ( nameA > nameB ) {
        return -1;
    }
    if ( nameA < nameB ) {
        return 1;
    }
    // names must be equal
    return 0;
};

let compareStatus = function( a, b ) {
    const nameA = a.Status;
    const nameB = b.Status;
    if ( nameA === indexerAdminConstants.FIRST_STATUS && nameB === indexerAdminConstants.SECOND_STATUS ||
        nameA === indexerAdminConstants.SECOND_STATUS && nameB === indexerAdminConstants.THIRD_STATUS ||
        nameA === indexerAdminConstants.FIRST_STATUS && nameB === indexerAdminConstants.THIRD_STATUS ) {
        return -1;
    }
    if ( nameA === indexerAdminConstants.SECOND_STATUS && nameB === indexerAdminConstants.FIRST_STATUS ||
    nameA === indexerAdminConstants.THIRD_STATUS && nameB === indexerAdminConstants.SECOND_STATUS ||
    nameA === indexerAdminConstants.THIRD_STATUS && nameB === indexerAdminConstants.FIRST_STATUS ) {
        return 1;
    }
    // names must be equal
    return 0;
};


/* Determine whether particulare status found or not found and set flag variable accordingly */
const getNoStatusesCount = async function( arr ) {
    let failedFound = false;
    let pendingFound = false;
    let passFound =  false;
    var firstStatusName = indexerAdminConstants.FIRST_STATUS;
    var secondStatusName = indexerAdminConstants.SECOND_STATUS;
    var thirdStatusName = indexerAdminConstants.THIRD_STATUS;
    let statusList = [ firstStatusName, secondStatusName, thirdStatusName ];
    if( arr.length > 0 ) {
        _.forEach( arr, async function( statusRecord ) {
            if( statusRecord.Status === statusList[ 0 ] ) {
                passFound = true;
            } else if( statusRecord.Status === statusList[ 1 ] ) {
                pendingFound = true;
            } else if( statusRecord.Status === statusList[ 2 ] ) {
                failedFound = true;
            }
        } );

        arr.passNoFound = !passFound;
        arr.pendingNoFound = !pendingFound;
        arr.failedNoFound = !failedFound;
    }
};

/**
   * Create ViewModel property for indexer/solr-related properties
   * @param {Object} indexerHealthStatus indexer/solr-related properties
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} datai18n viewModel's i18n data
   * @returns {Object} ViewModel objects
   */
export let createVMOforIndexerHealthStatus = function( indexerHealthStatus, searchState, datai18n ) {
    let cell;

    //basic indexing status
    var basicIndexingProp = [];

    //Solr-related properties
    let basicIndexerProps = indexerHealthStatus.basicIndexingProp;

    _.forEach( basicIndexerProps, function( basicIndexerProp ) {
        cell = uwPropertySvc.createViewModelProperty( basicIndexerProp.propertyName, basicIndexerProp.propertyName, '', basicIndexerProp.propertyValue, basicIndexerProp.propertyValue );
        cell.uiValue = basicIndexerProp.propertyValue;
        basicIndexingProp.push( cell );
    } );

    //Indexing table (subscription apps, scratch) details
    var detailsTableProp = [];
    let detailsTableProps = indexerHealthStatus.detailsTableProp;

    _.forEach( detailsTableProps, function( prop ) {
        let propName = prop.propertyName;
        propName = indexerAdminConstants.PROPERTY_NAMES_CONSTANT[propName];
        cell = uwPropertySvc.createViewModelProperty( datai18n[propName], datai18n[propName], '', prop.propertyValue, prop.propertyValue );
        cell.uiValue = prop.propertyValue;
        detailsTableProp.push( cell );
    } );

    let tmpState = { ...searchState.value };
    tmpState.dashboardIndexerHealthStatus = indexerHealthStatus;
    tmpState.objdataIndexingTable = {};
    searchState.update( tmpState );

    return {
        basicIndexingPropVmos: basicIndexingProp,
        detailsTablePropVmos: detailsTableProp
    };
};

/**
   * Sets Object data Indexing and file content indexing status chart provider
   * @param {Object} indexingStatusSummary indexing status summary data
   * @param {Object} searchState subPanelContext's searchState
   * @returns {Object} object data and file content indexing chart provider
   */
export let setDashboardChartProvider = async function( indexingStatusSummary, searchState ) {
    let objCountChartProvider = {
        title: '',
        chartType: 'column',
        name: 'objDataChartProvider',
        chartConfig: {
            isChartZoomable: true,
            xAxisLabel: '',
            yAxisLabel: '',
            isDataLabelOnChartEnabled: true,
            isYAxisLinearOrLogarithmic: 'logarithmic'
        }
    };
    let fileContentChartProvider = {
        title: '',
        chartType: 'column',
        name: 'fileContentChartProvider',
        chartConfig: {
            isChartZoomable: true,
            xAxisLabel: '',
            yAxisLabel: '',
            isDataLabelOnChartEnabled: true,
            isYAxisLinearOrLogarithmic: 'logarithmic'
        }
    };

    var objCountChartProviderChartPoints = [];
    var firstStatusName = await localSvc.getLocalizedText( 'DataDiscoveryServicesMessages', 'firstStatus' );
    var secondStatusName = await localSvc.getLocalizedText( 'DataDiscoveryServicesMessages', 'secondStatus' );
    var thirdStatusName = await localSvc.getLocalizedText( 'DataDiscoveryServicesMessages', 'thirdStatus' );

    var objectsCountByStatus = indexingStatusSummary.ObjcountByStatus;
    _.forEach( objectsCountByStatus, function( obj ) {
        if( obj.Status === 'Pass' ) {
            obj.Status = firstStatusName;
        } else if( obj.Status === 'Pending' ) {
            obj.Status = secondStatusName;
        } else if( obj.Status === 'Fail' ) {
            obj.Status = thirdStatusName;
        }
        objCountChartProviderChartPoints.push( { label: obj.Status, value: parseInt( obj.Count ) } );
    } );
    objCountChartProvider.chartColorOverrideClass = getChartColorClass( indexingStatusSummary.ObjcountByStatus );

    var fileContentChartProviderChartPoints = [];
    var fileContentCountByStatus = indexingStatusSummary.FileContentCountByStatus;
    _.forEach( fileContentCountByStatus, function( obj ) {
        if( obj.Status === 'Pass' ) {
            obj.Status = firstStatusName;
        } else if( obj.Status === 'Pending' ) {
            obj.Status = secondStatusName;
        } else if( obj.Status === 'Fail' ) {
            obj.Status = thirdStatusName;
        }
        fileContentChartProviderChartPoints.push( { label: obj.Status, value: parseInt( obj.Count ) } );
    } );
    fileContentChartProvider.chartColorOverrideClass = getChartColorClass( indexingStatusSummary.FileContentCountByStatus );

    var statusName = await localSvc.getLocalizedText( 'DataDiscoveryServicesMessages', 'diagnosticResultStatusTitle' );

    let arrayOfSeriesDataForObjdataChart = [];
    arrayOfSeriesDataForObjdataChart.push( {
        seriesName: statusName,
        keyValueDataForChart: objCountChartProviderChartPoints,
        chartPointsConfig: 'colorOverrides'
    } );
    let arrayOfSeriesDataForFileContentChart = [];
    arrayOfSeriesDataForFileContentChart.push( {
        seriesName: statusName,
        keyValueDataForChart: fileContentChartProviderChartPoints,
        chartPointsConfig: 'colorOverrides'
    } );
    objCountChartProvider.chartPoints = arrayOfSeriesDataForObjdataChart;
    fileContentChartProvider.chartPoints = arrayOfSeriesDataForFileContentChart;

    let tmpState = { ...searchState.value };
    tmpState.dashboardObjdataIndexingStatusSummary = objCountChartProvider;
    tmpState.dashboardFilecontentIndexingStatusSummary = fileContentChartProvider;
    searchState.update( tmpState );

    return {
        objCountChartProvider: objCountChartProvider,
        fileContentChartProvider: fileContentChartProvider
    };
};

/**
   * Function to get correct custom color class based on statuses available
   * @param {Object} statusAvailability subPanelContext's searchState
   * @returns {String} color class
   */
let getChartColorClass = function( statusAvailability ) {
    if( statusAvailability.passNoFound && statusAvailability.failedNoFound && !statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-pending';
    } else if( !statusAvailability.passNoFound && statusAvailability.failedNoFound && statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-pass';
    } else if( statusAvailability.passNoFound && !statusAvailability.failedNoFound && statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-fail';
    } else if( !statusAvailability.passNoFound && !statusAvailability.failedNoFound && statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-failpass';
    } else if( !statusAvailability.passNoFound && statusAvailability.failedNoFound && !statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-pendingpass';
    } else if( statusAvailability.passNoFound && !statusAvailability.failedNoFound && !statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-pendingfail';
    } else if( !statusAvailability.passNoFound && !statusAvailability.failedNoFound && !statusAvailability.pendingNoFound ) {
        return 'sw-ddsAdminChart-all';
    }
    return '';
};

/**
   * Set context's searchstate for selected status on object data indexing chart
   * @param {Object} column selected status
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} datai18n viewmodel's i18n data
   */
export let displayDetailedInfoForSelectedObjdataIndexingStatus = function( column, searchState, datai18n ) {
    let tmpState = searchState.value;
    tmpState.selectedObjdataIndexingStatus = column;
    setInternalNameForStatusValue( tmpState.selectedObjdataIndexingStatus, datai18n );
    tmpState.hasSelectedObjdataIndexingStatus = true;
    tmpState.objdataIndexing = {};
    tmpState.objdataIndexing.startIndex = 0;
    tmpState.objdataIndexing.endIndex = 49;
    searchState.update( tmpState );

    eventBus.publish( 'showIndexerAdminDashboard.setSelectedObjdataIndexingStatusDataModel' );
};

/**
   * Set internal name to the selected object
   * @param {Object} selectedObjectStatus status of selected object
   * @param {Object} datai18n viewmodel's i18n data
   */
let setInternalNameForStatusValue = async function( selectedObjectStatus, datai18n ) {
    if( selectedObjectStatus.label === datai18n.firstStatus ) {
        selectedObjectStatus.internalName = indexerAdminConstants.FIRST_STATUS;
    } else if( selectedObjectStatus.label === datai18n.secondStatus ) {
        selectedObjectStatus.internalName = indexerAdminConstants.SECOND_STATUS;
    } else if( selectedObjectStatus.label === datai18n.thirdStatus ) {
        selectedObjectStatus.internalName = indexerAdminConstants.THIRD_STATUS;
    }
};

/**
   * Set context's searchstate for selected status on object data indexing chart
   * @param {Object} searchState subPanelContext's searchState
   * @returns {Object} selected Object data indexing status
   */
export let setSelectedObjdataIndexingStatusDataModel = function( searchState ) {
    let selectedObjdataIndexingStatus = {};
    selectedObjdataIndexingStatus.propertyDisplayName = searchState.selectedObjdataIndexingStatus.label.toUpperCase() + ' (' + searchState.selectedObjdataIndexingStatus.value + ')';
    selectedObjdataIndexingStatus.uiValue = '';
    selectedObjdataIndexingStatus.dbValue = '';

    return {
        selectedObjdataIndexingStatus: selectedObjdataIndexingStatus,
        hasSelectedObjdataIndexingStatus: searchState.hasSelectedObjdataIndexingStatus
    };
};

export let showObjdataIndexingChart = function( ) {
    return false;
};

/**
   * Set context's searchstate for selected status on file content indexing chart
   * @param {Object} column selected status
   * @param {Object} searchState subPanelContext's searchState
   * @param {Object} datai18n viewmodel's i18n data
   */
export let displayDetailedInfoForSelectedFilecontentIndexingStatus = function( column, searchState, datai18n ) {
    let tmpState = searchState.value;
    tmpState.selectedFilecontentIndexingStatus = column;
    setInternalNameForStatusValue( tmpState.selectedFilecontentIndexingStatus, datai18n );
    tmpState.hasSelectedFilecontentIndexingStatus = true;
    tmpState.filecontentIndexing = {};
    tmpState.filecontentIndexing.startIndex = 0;
    tmpState.filecontentIndexing.endIndex = 49;
    searchState.update( tmpState );

    eventBus.publish( 'showIndexerAdminDashboard.setSelectedFilecontentIndexingStatusDataModel' );
};

/**
   * Set context's searchstate for selected status on file content indexing chart
   * @param {Object} searchState subPanelContext's searchState
   * @returns {Object} selected file content indexing status
   */
export let setSelectedFilecontentIndexingStatusDataModel = function( searchState ) {
    let selectedFilecontentIndexingStatus = {};
    selectedFilecontentIndexingStatus.propertyDisplayName = searchState.selectedFilecontentIndexingStatus.label.toUpperCase() + ' (' + searchState.selectedFilecontentIndexingStatus.value + ')';
    selectedFilecontentIndexingStatus.uiValue = '';
    selectedFilecontentIndexingStatus.dbValue = '';

    return {
        selectedFilecontentIndexingStatus: selectedFilecontentIndexingStatus,
        hasSelectedFilecontentIndexingStatus: searchState.hasSelectedFilecontentIndexingStatus
    };
};

export let showFilecontentIndexingChart = function() {
    return false;
};

/**
   * Update subpanelcontext's search state pwa selection data with newly selected indexer type
   * @param {Object} selected subPanelContext's searchState
   * @param {Object} subPanelContext subPanelContext
   */
export let selectDeselectIndexerInPWA = function( selected, subPanelContext ) {
    var tmpState = subPanelContext.searchState.value;
    var currentTitle = tmpState.pwaSelection  && tmpState.pwaSelection.length > 0 ? tmpState.pwaSelection[0].type : '';
    if ( selected !== undefined && currentTitle !== selected.type  ) {
        tmpState.selectedIndexerType = selected;
        tmpState.pwaSelection = [ selected ];
        tmpState.isSelected = true;
        subPanelContext.searchState.update( tmpState );
    } else {
        exports.resetSearchStateSelectionData( selected, subPanelContext );
    }
};

/**
   * Reset subpanelcontext's search state pwa selection data
   * @param {Object} selected subPanelContext's searchState
   * @param {Object} subPanelContext subPanelContext
   */
export let resetSearchStateSelectionData = function( selected, subPanelContext ) {
    if( subPanelContext !== undefined && subPanelContext.searchState.selectedIndexerType !== undefined ) {
        var tmpState = subPanelContext.searchState.value;
        if ( !selected ) {
            tmpState.pwaSelection = [];
        }
        tmpState.selectedIndexerType = {};
        tmpState.isSelected = false;
        subPanelContext.searchState.update( tmpState );
    }
};

/**
   * get current date time stamp
   * @param {Object} datai18n i18n
   * @param {Object} searchState subPanelContext's searchState
   * @returns {Object} return current date and time
   */
export let getObjdataIndexerDashboardUpdateTime = ( datai18n, searchState ) => {
    var currentdate = new Date();
    var dateandtimestamp = {};

    dateandtimestamp.propertyDisplayName = datai18n.objdataIndexerDashboardLastRefreshLabel;

    let getMonth = parseInt( currentdate.getMonth() ) + 1;

    let currentDate = currentdate.getFullYear() + '-' + ( '0' + getMonth ).slice( -2 ) + '-' + ( '0' + currentdate.getDate() ).slice( -2 ) + 'T' + ( '0' + currentdate.getHours() ).slice( -2 ) + ':' +
    ( '0' + currentdate.getMinutes() ).slice( -2 ) + ':' + ( '0' + currentdate.getSeconds() ).slice( -2 );

    dateandtimestamp.uiValue = subscribingProcessService.getConvertedDateValue( currentDate );
    dateandtimestamp.dbValue = dateandtimestamp.uiValue;

    let tmpState = searchState.value;
    tmpState.hasRequestedTime = true;
    tmpState.dateandtimestamp = dateandtimestamp;
    searchState.update( tmpState );

    var hasRequestedTime = true;
    return {
        dateandtimestamp: dateandtimestamp,
        hasRequestedTime: hasRequestedTime
    };
};

/**
   * get list of Indexer types
   * @param {Object} data viewModel's data
   * @returns {Object} return indexer list
   */
export let getIndexerAdminList = async( data ) => {
    let dashboardPWAKey = 'awp0DdsDashboardPWAKey';
    let providers = await contributionService.loadContributions( dashboardPWAKey );
    let dashboardList = [];
    _.forEach( providers, function( provider ) {
        let isVisible = provider.visibleWhen( data );
        if ( isVisible === true ) {
            let contributor = {
                Title: provider.Title,
                uid: provider.uid,
                type: provider.type,
                cellHeader1: provider.cellHeader1,
                cellHeader2: provider.cellHeader2,
                hasThumbnail: provider.hasThumbnail,
                typeIconURL: provider.typeIconURL
            };
            dashboardList.push( contributor );
        }
    } );
    let dashboardFinalList;
    if ( dashboardList && dashboardList.length > 0 ) {
        dashboardFinalList =  {
            totalFound: dashboardList.length,
            totalLoaded: dashboardList.length,
            search: dashboardList
        };
    }
    return dashboardFinalList;
};

/**
   * Reset the given data provider
   * @param {Object} dataProvider data provider
   */
export let resetDataProvider = function( dataProvider ) {
    if( dataProvider ) {
        dataProvider.resetDataProvider();
    }
};

export default exports = {
    clearPreviousDashboardData,
    resetIndexingStatusSearchState,
    createVMOforIndexerHealthStatus,
    displayDetailedInfoForSelectedObjdataIndexingStatus,
    displayDetailedInfoForSelectedFilecontentIndexingStatus,
    getIndexerAdminList,
    getObjdataIndexerDashboardUpdateTime,
    getIndexerDashboardDetails,
    selectDeselectIndexerInPWA,
    setDashboardChartProvider,
    setSelectedObjdataIndexingStatusDataModel,
    setSelectedFilecontentIndexingStatusDataModel,
    showFilecontentIndexingChart,
    showObjdataIndexingChart,
    resetSearchStateSelectionData,
    resetDataProvider
};
