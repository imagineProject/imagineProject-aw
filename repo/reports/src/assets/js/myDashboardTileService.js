// Copyright (c) 2023 Siemens

/**
 * JS Service defined to handle Add Report related method execution only.
 *
 * @module js/myDashboardTileService
 */
import appCtxService from 'js/appCtxService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import graphQLSvc from 'js/graphQLService';
import logger from 'js/logger';
import viewModelObjectService from 'js/viewModelObjectService';
import soa_kernel_propertyPolicyService from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import reportsCommSrvc from 'js/reportsCommonService';
import cmm from 'soa/kernel/clientMetaModel';
import filtrPanelSrvc from 'js/filterPanelService';
import searchFilterService from 'js/aw.searchFilter.service';
import searchFolderService from 'js/searchFolderService';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import _ from 'lodash';
import editHandlerSvc from 'js/editHandlerService';
import editHandlerFactory from 'js/editHandlerFactory';
import dataSourceService from 'js/dataSourceService';
import editEventsService from 'js/editEventsService';
import { overWriteColumns } from 'js/AwReportTableService';

var exports = {};

const reportSearchIncontextInfo = 'ReportsContext.searchIncontextInfo';
/**
 * Get information related to search string, filters ,thumbnail chart,
 * data provider and search criterias.
 * @param  {any} selectedReportDef - the report object
 * @returns {any} reportTileInfo -
 */
var getReportSearchAndChartParametersForTile = function( selectedReportDef ) {
    var rd_params = selectedReportDef.props.rd_parameters.dbValues;
    var rd_paramValues = selectedReportDef.props.rd_param_values.dbValues;
    var reportTileInfo = {
        activeFilterMap: {},
        tileElement: ''
    };
    var thumbnailChartFound = false;
    var tileTable = {};
    var tileChart = {};
    var thumbIndex; // Moved the declaration of thumbIndex here to make it accessible throughout the function.

    for ( var index = 0; index < rd_params.length; index++ ) {
        if ( rd_params[index].startsWith( 'ReportFilter' ) ) {
            var filtrSplit = rd_params[index].split( '_' );
            if ( filtrSplit[0] === 'ReportFilterLargeValue' ) {
                // If multiple filter values they are stored as ReportFilterLargeValue_1_1
                //filterName key will be always at constant location in
                var filtIndex = index - 1 - parseInt( filtrSplit[2] );
                var filtKey = rd_paramValues[filtIndex];
                var value = [];
                if ( reportTileInfo.activeFilterMap.hasOwnProperty( filtKey ) ) {
                    value = reportTileInfo.activeFilterMap[filtKey];
                    value.push( JSON.parse( rd_paramValues[index] ) );
                    reportTileInfo.activeFilterMap[filtKey] = value;
                } else {
                    value.push( JSON.parse( rd_paramValues[index] ) );
                    reportTileInfo.activeFilterMap[filtKey] = value;
                }
            } else if ( filtrSplit[0] === 'ReportFilterValue' ) {
                reportTileInfo.activeFilterMap[rd_paramValues[index - 1]] = JSON.parse( rd_paramValues[index] );
            }
        } else if ( rd_params[index] === 'DataProvider' ) {
            reportTileInfo.dataProviderName = rd_paramValues[index];
        } else if ( rd_params[index] === 'AdditionalSearchCriteria' ) {
            reportTileInfo.additionalSearchCriteria = JSON.parse( rd_paramValues[index] );
        } else if ( rd_params[index] === 'ReportSearchCriteria' ) {
            reportTileInfo.SearchCriteriaString = rd_paramValues[index];
        } else if ( rd_params[index] === 'ThumbnailChart' ) {
            thumbnailChartFound = true;
            var selectThumbChart = rd_paramValues[index];
            if ( selectThumbChart !== 'ReportTable1' ) {
                selectThumbChart += '_0';
                thumbIndex = rd_params.indexOf( selectThumbChart ); // Now thumbIndex is accessible
                if ( thumbIndex >= 0 ) {
                    tileChart = JSON.parse( rd_paramValues[thumbIndex] );
                    tileChart.ChartPropInternalName = JSON.parse( rd_paramValues[thumbIndex + 1] );
                }
                reportTileInfo.tileElement = 'Chart';
            } else {
                reportTileInfo.tileElement = 'Table';
            }
        } else if ( rd_params[index].startsWith( 'ReportTable1' ) ) {
            if ( rd_params[index] === 'ReportTable1ColumnPropName' ) {
                tileTable.ColumnPropName = JSON.parse( rd_paramValues[index] );
            } else if ( rd_params[index].startsWith( 'ReportTable1ColumnPropInternalName_0' ) ) {
                var strClProps = [];
                strClProps = JSON.parse( rd_paramValues[index] );
                strClProps.push.apply( strClProps, JSON.parse( rd_paramValues[index + 1] ) );
                tileTable.ColumnPropInternalName = strClProps;
            } else if ( rd_params[index].startsWith( 'ReportTable1ColumnDataType' ) ) {
                tileTable.ColumnDataType = JSON.parse( rd_paramValues[index] );
            }
        }
    }

    // Handle case where thumbnail chart is not found
    if ( !thumbnailChartFound && rd_params.length > 0 ) {
        thumbIndex = rd_params.indexOf( 'ReportChart1_0' ); // Reuse the thumbIndex here
        if ( thumbIndex >= 0 ) {
            var ReportChart1 = JSON.parse( rd_paramValues[thumbIndex] );
            ReportChart1.ChartPropInternalName = JSON.parse( rd_paramValues[thumbIndex + 1] );
            tileChart = ReportChart1;
            reportTileInfo.tileElement = 'Chart';
        }
    }

    // Set data provider name and construct search criteria
    setDataProviderName( selectedReportDef, reportTileInfo );
    constructSearchCriteria( selectedReportDef, reportTileInfo );
    reportTileInfo.tableInfo = tileTable;
    if ( reportTileInfo.tileElement === 'Table' ) {
        reportTileInfo.ChartConfiguration = tileTable;
    } else {
        reportTileInfo.ChartConfiguration = tileChart;
    }

    return reportTileInfo;
};


/**
 * Sets the Data provider name for reportTileInfo object to
 * be used as input for performSearch SOA call.
 * @param {any} selectedReportDef - the report object
 * @param {any} reportTileInfo - the report tile info object
 */
var setDataProviderName = function( selectedReportDef, reportTileInfo ) {
    if( !reportTileInfo.dataProviderName && selectedReportDef.props.rd_type.dbValues[0] !== '1' ) {
        reportTileInfo.dataProviderName = 'Awp0FullTextSearchProvider';
    } else if( !reportTileInfo.dataProviderName && selectedReportDef.props.rd_type.dbValues[0] === '1' ) {
        reportTileInfo.dataProviderName = 'Rb0ReportsDataProvider';
    }
};

/**
 * Constructs searchCriteria to be used as input for performSearch SOA call.
 * @param {any} selectedReportDef - the report object
 * @param {any} reportTileInfo - the report tile info object
 */
var constructSearchCriteria = function( selectedReportDef, reportTileInfo ) {
    if( selectedReportDef.props.rd_type.dbValues[ 0 ] === '0' && selectedReportDef.props.reportSearchRecipeExtraInfo &&
        selectedReportDef.props.reportSearchRecipeExtraInfo.dbValues.localeSearchString !== '' &&
        selectedReportDef.props.reportSearchRecipeExtraInfo.dbValues.localeSearchString !== undefined ) {
        reportTileInfo.SearchCriteriaString = selectedReportDef.props.reportSearchRecipeExtraInfo.dbValues.localeSearchString;
    }
    var searchCriteria = {
        searchString: reportTileInfo.SearchCriteriaString
    };

    // Iterate for all entries in additional search criteria and add to main search criteria
    for( var searchCriteriaKey in reportTileInfo.additionalSearchCriteria ) {
        if( searchCriteriaKey !== 'SearchCriteria' && searchCriteriaKey !== 'activeFilterMap' ) {
            searchCriteria[ searchCriteriaKey ] = reportTileInfo.additionalSearchCriteria[ searchCriteriaKey ];
        }
    }

    if( selectedReportDef.props.rd_type.dbValues[0] === '1' ) {
        searchCriteria.sourceObject = selectedReportDef.props.rd_sourceObject.dbValue;
        searchCriteria.relationsPath = reportTileInfo.SearchCriteriaString;
        delete searchCriteria.searchString;
    }

    //add props for props specific search
    if( searchCriteria.searchString && selectedReportDef.props.rd_param_values.dbValues ) {
        let rd_param_values = selectedReportDef.props.rd_param_values.dbValues;
        let translatedSearchCriteria = [];
        rd_param_values.forEach( ( criteria ) => {
            if( criteria && criteria.includes( 'V_A_L_' ) ) {
                translatedSearchCriteria.push( criteria );
            }
        } );

        translatedSearchCriteria.unshift( searchCriteria.searchString );
        searchFolderService.setPropsForPropertySpecificSearch( translatedSearchCriteria, searchCriteria );
    }

    reportTileInfo.searchCriteria = searchCriteria;
};

/**
 * Returns input for performSearchViewModel SOA call
 *
 * @param {*} searchAndChartInfo - subPanelContext
 * @returns {*} input for SOA performSearchViewModel
 */
var getPerformSearchSOAInput = function( searchAndChartInfo ) {
    return {
        searchInput: {
            attributesToInflate: [],
            internalPropertyName: '',
            maxToLoad: searchAndChartInfo.tileElement === 'Chart' ? 1 : 20,
            maxToReturn: searchAndChartInfo.tileElement === 'Chart' ? 0 : 20,
            providerName: searchAndChartInfo.dataProviderName,
            searchCriteria: searchAndChartInfo.searchCriteria,
            searchFilterFieldSortType: 'Priority',
            cursor: {
                startIndex: searchAndChartInfo.startIndex
            },
            searchFilterMap6: searchAndChartInfo.activeFilterMap,
            searchSortCriteria: searchAndChartInfo.searchSortCriteria
        },
        columnConfigInput: {
            clientName: '',
            clientScopeURI: ''
        }
    };
};

/**
 * Call to graphql query
 *
 /*"searchFilterContext": "<searchCommonParameters.UserSessionQuery>"
 "chartSearchCriteria": [{
 "chartID": <Unique Idenfier for this Report eg UID> : Useful in case of multiseries charts,
 "searchCriteria": {
         "searchQueryString": <base criteria>,
         "searchFilters": [
             <list of filters -- add RevRuleFitler here.>
         ]},
 "categoriesToChartOn": {
     "typeName": <Teamcenter Type>
     "propertyName": <Teamcenter Property>,
     "propertyType": <Property Type> -- optional
     "locale" : <current locale> : only in case of localized properties -- optional
     }
 }
 * @param {*} reportDefObject
 * @param {*} data
 */

var callChartInfoGql = function( reportDefObject, data, searchAndChartInfo ) {
    //Prepare Request for GraphQL API
    var searchCommonParameters = appCtxService.getCtx( 'ReportsContext.SearchParameters' );
    var userSession = appCtxService.getCtx( 'userSession' );
    var currentLocale = userSession.props.fnd0locale.dbValue;

    //1. searchCriteria and search filters
    let searchCriteria = {};
    searchCriteria.searchQueryString = reportDefObject.props.translatedBaseCriteria.dbValue;
    let searchFilters = [];
    if( reportDefObject.props.translatedFilterQueries && reportDefObject.props.translatedFilterQueries.dbValues.length > 0 ) {
        reportDefObject.props.translatedFilterQueries.dbValues.map( filterQuery => {
            searchFilters.push( filterQuery );
            return filterQuery;
        } );
    }
    searchFilters.push( searchCommonParameters.RevRuleQuery );
    searchCriteria.searchFilters = searchFilters;

    //2. Categories to chart on
    let categoriesToChartOn = [];
    if( reportDefObject.props.reportChartObjects && reportDefObject.props.reportChartObjects.dbValues.length > 0 ) {
        reportDefObject.props.reportChartObjects.dbValues.map( reportChartObject => {
            let categoryToChartOn = {};
            categoryToChartOn.typeName = reportChartObject.chartTypeName;
            categoryToChartOn.propertyName = reportChartObject.chartPropertyName;
            categoryToChartOn.propertyType = reportChartObject.chartPropertyType === 'Date' ? 'DateType' : 'StringType';
            categoryToChartOn.locale = reportChartObject.isPropertyLocalized ? currentLocale : '';
            categoriesToChartOn.push( categoryToChartOn );
            return categoriesToChartOn;
        } );
    }

    //3. Search filter context
    let searchFilterContext = searchCommonParameters.UserSessionQuery;

    //4. Put the request together

    let chartSearchCriteria = {};
    chartSearchCriteria.chartID = reportDefObject.reportUid;
    chartSearchCriteria.searchCriteria = searchCriteria;
    chartSearchCriteria.categoriesToChartOn = categoriesToChartOn;

    let graphQLInput = {};
    graphQLInput.searchFilterContext = searchFilterContext;
    graphQLInput.chartSearchCriteria = [ chartSearchCriteria ];

    var graphQLQuery = {
        endPoint: 'tcgql/graphql',
        request: {
            query: 'query ChartInfo($input:ChartDataInput!){chartInfo(chartDataInput:$input){chartID,totalCount,chartData{categoryName,chartValues{label,value}}}}',
            variables: {
                input: graphQLInput
            }
        }
    };

    return graphQLSvc.callGraphQL( graphQLQuery ).then(
        function( response ) {
            if( response.errors === undefined ) {
                const returnObject = {};
                const chartPoints = createChartGraphQLData( response.data.chartInfo[0].chartData, searchAndChartInfo.ChartConfiguration, reportDefObject.props.reportSearchRecipeExtraInfo );
                returnObject.chartPoints = chartPoints;
                returnObject.displayTable = false;
                returnObject.displayChart = true;
                returnObject.totalObjectFound = data.i18n.totalObjectFound + ': ' + response.data.chartInfo[0].totalCount;
                returnObject.ChartConfiguration = searchAndChartInfo.ChartConfiguration;
                returnObject.chartTitle = searchAndChartInfo.ChartConfiguration.ChartTitle;
                // hiding chart title if preference is set
                if( appCtxService.ctx.preferences?.REPORT_Hide_NonLocalizable_Title && appCtxService.ctx.preferences.REPORT_Hide_NonLocalizable_Title[0] === 'true'  ) {
                    returnObject.chartTitle = chartPoints?.length ? chartPoints[0].seriesName : '';
                }
                returnObject.chartType = searchAndChartInfo.ChartConfiguration.ChartTpIntName;
                return returnObject;
            }
            logger.error( response.errors[ 0 ].message + '..initiating SOA call.' );
            return callPerformSearchForChartInfo( reportDefObject, data, searchAndChartInfo );
        },
        function( ) {
            return callPerformSearchForChartInfo( reportDefObject, data, searchAndChartInfo ); //fallback in case TCGQL in not installed/running.
        } );
};

/**    // No need for return statement herer the policy
 * @param {object} repTable - The report table object.
 * @returns {any} policyId
 */
const registerPolicy = function( repTable ) {
    //var reportDefs = appCtxService.getCtx( 'ReportsContext.reportParameters.ReportDefProps' );
    var types = {};
    var typeList = [];
    if( repTable?.ColumnPropInternalName?.length ) {
        var propList = repTable.ColumnPropInternalName;
        for( var x = 0; x < propList.length; x++ ) {
            var propAndObj = propList[ x ].split( '.' );
            var typePropList = {};
            typePropList.name = propAndObj[ 0 ];
            var prop = {};
            prop.name = propAndObj[ 1 ];
            typePropList.properties = [ prop ];
            typeList.push( typePropList );
        }
        types.types = typeList;
        return soa_kernel_propertyPolicyService.register( types );
    }
    return'';
};

/**
 * Performs a search for chart information.
 *
 * @param {number} reportDefObject - reportDefObject
 * @param {string} data - data
 * @param {Object} searchAndChartInfo - The search and chart information.
 * @returns {Promise<Object>} The search results and chart data.
 */
const callPerformSearchForChartInfo = ( reportDefObject, data, searchAndChartInfo ) => {
    var searchSOAInput = getPerformSearchSOAInput( searchAndChartInfo );
    var policyId = 0;
    if ( searchAndChartInfo.tileElement === 'Table' ) {
        policyId = registerPolicy( searchAndChartInfo.ChartConfiguration );
    }

    if ( data.grids && data.grids.dashboardReportTable && data.grids.dashboardReportTable.columnProviderInstance ) {
        searchSOAInput.searchInput.columnFilters = data.grids.dashboardReportTable.columnProviderInstance.columnFilters;
    }

    return tcDataMgmtSvc.basePerformSearchViewModel( {
        columnConfigInput: searchSOAInput.columnConfigInput,
        inflateProperties: false,
        saveColumnConfigData: {},
        noServiceData: false,
        searchInput: searchSOAInput.searchInput
    } ).then(
        function( response ) {
            if ( reportDefObject !== null && reportDefObject.props.rd_type.dbValues[0] === '1' ) {
                eventBus.publish( 'reportDashboard.getSourceObject' );
            }
            if ( searchAndChartInfo.tileElement === 'Chart' ) {
                appCtxService.updatePartialCtx( reportSearchIncontextInfo, {} );
                var filterCat = callRepGetCategories( response );

                // Removed unnecessary 'undefined' initialization
                var searchResultFilters;
                if ( appCtxService.ctx.ReportsContext.searchIncontextInfo && appCtxService.ctx.ReportsContext.searchIncontextInfo.searchResultFilters ) {
                    searchResultFilters = appCtxService.ctx.ReportsContext.searchIncontextInfo.searchResultFilters;
                }
                var searchFiltMap = response.searchFilterMap;
                var chartPoints = reportsCommSrvc.processSearchDataAndGetChartPoints( searchResultFilters, filterCat, searchFiltMap, searchAndChartInfo.ChartConfiguration );

                response.chartPoints = chartPoints;
                response.displayTable = false;
                response.displayChart = true;
                response.totalObjectFound = data.i18n.totalObjectFound + ': ' + response.totalFound;
                response.chartTitle = searchAndChartInfo.ChartConfiguration.ChartTitle;
                if ( appCtxService.ctx.preferences?.REPORT_Hide_NonLocalizable_Title && appCtxService.ctx.preferences.REPORT_Hide_NonLocalizable_Title[0] === 'true' ) {
                    response.chartTitle = chartPoints?.length ? chartPoints[0].seriesName : '';
                }
                response.chartType = searchAndChartInfo.ChartConfiguration.ChartType.toLowerCase();
                response.isActiveItem = reportDefObject.props.rd_type.dbValues[0] === '1';
            } else if ( searchAndChartInfo.tileElement === 'Table' ) {
                soa_kernel_propertyPolicyService.unregister( policyId );
                if ( response.searchResultsJSON ) {
                    response.searchResults = JSON.parse( response.searchResultsJSON );
                    delete response.searchResultsJSON;
                }
                //getColumnConfig fn
                if ( !Object.entries( searchAndChartInfo.ChartConfiguration ).length ) {
                    var columnConfig = response.columnConfig;
                    columnConfig.columnConfigId = 'awReportTableColConfig';
                    columnConfig.operationType = 'Intersection';
                    columnConfig.columns = overWriteColumns( data.columnProviders.dashboardReportTableColumnProvider, response );
                    response.columnConfig = columnConfig;
                    // getproperties fn
                    var propList = [];
                    response.searchFilterCategories?.forEach( ( category ) => {
                        var namesArr = category.internalName.split( '.' );
                        propList.push( namesArr[1] );
                    } );
                    var arrayUids = [];
                    response.searchResults?.objects?.forEach( ( object ) => arrayUids.push( object.uid ) );
                    dmSvc.getProperties( arrayUids, propList ).then( function() {
                        // Create view model objects
                        response.searchResults = response.searchResults && response.searchResults.objects ? response.searchResults.objects.map( function( vmo ) {
                            return viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];
                    } );
                } else {
                    // Create view model objects
                    response.searchResults = response.searchResults && response.searchResults.objects ? response.searchResults.objects
                        .map( function( vmo ) {
                            return viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];
                }
                if ( reportDefObject !== null ) {
                    response.displayTable = true;
                    response.displayChart = false;

                    response.totalObjectFound = data.i18n.totalObjectFound + ': ' + response.totalFound;
                    response.ChartConfiguration = searchAndChartInfo.ChartConfiguration;
                    response.searchAndChartInfo = searchAndChartInfo;
                    response.isActiveItem = reportDefObject.props.rd_type.dbValues[0] === '1';
                }
            }
            return response;
        },
        function( error ) {
            logger.error( 'Error occurred ' + error );
        }
    );
};

export let loadData = function( subPanelContext, data ) {
    var selectedReport = subPanelContext.selectedReport;
    var searchAndChartInfo = data.searchAndChartInfo;
    searchAndChartInfo.startIndex = data.dataProviders.dashboardReportTableDataProvider.startIndex;
    searchAndChartInfo.searchSortCriteria = data.columnProviders.dashboardReportTableColumnProvider.sortCriteria;
    if( searchAndChartInfo.searchSortCriteria !== undefined && searchAndChartInfo.searchSortCriteria.length > 0 ) {
        let columnsData = data.dataProviders.dashboardReportTableDataProvider.columnConfig.columns;
        var fieldName = getValidSortCriteriaField( searchAndChartInfo.searchSortCriteria[0], columnsData );
        searchAndChartInfo.searchSortCriteria[0].fieldName = fieldName;
    }
    return callPerformSearchForChartInfo( selectedReport, data, searchAndChartInfo );
};

/**
 * Initializes Report Tile rendering.
 *
 * @param {*} subPanelContext - subPanelContext
 * @param {*} data - data
 * @returns {*} reportName
 */
export let dashboardTileRevealed = ( subPanelContext, data )=> {
    var selectedReport = subPanelContext.selectedReport;
    var searchAndChartInfo = getReportSearchAndChartParametersForTile( selectedReport );
    searchAndChartInfo.startIndex = 0;
    searchAndChartInfo.searchSortCriteria = data.columnProviders.dashboardReportTableColumnProvider.sortCriteria;
    if( selectedReport.props.translatedBaseCriteria?.dbValue && searchAndChartInfo.tileElement === 'Chart' && selectedReport.props.rd_type.dbValues[0] === '0' ) {
        return callChartInfoGql( selectedReport, data, searchAndChartInfo );
    } else if( selectedReport ) {
        if( searchAndChartInfo.tileElement === 'Table' ) {
            let exportContext = {
                providerName:searchAndChartInfo.dataProviderName,
                searchCriteria: searchAndChartInfo.searchCriteria,
                searchFilterMap: searchAndChartInfo.activeFilterMap,
                columns: loadColumns( searchAndChartInfo.tableInfo ),
                searchSortCriteria: searchAndChartInfo.searchSortCriteria
            };
            let context = attachNewEditContext( data.dataProviders.dashboardReportTableDataProvider, selectedReport.props.tileIndex.dbValues[0] );
            exportContext = { ...exportContext, ...context };
            return { displayTable: true, displayChart:false, searchAndChartInfo: searchAndChartInfo, exportContext: exportContext };
        }
        return callPerformSearchForChartInfo( selectedReport, data, searchAndChartInfo );
    }
};

/**
 * createChartGraphQLData
 *
 /*
        Format of searchResultFilters:
        dataPoints: [
            {
                categoryName: categoryName,
                facetValues: [
                    {
                    "label": "Tcadmin, testuser ( tcadmin )",
                    "value": 49259
                    },
                    {
                    "label": "Bhardwaj, Sudhir ( bhardwaj )",
                    "value": 36715
                    }...]
            },{},{}]
 *
 * @function createChartGraphQLData
 * @param {ObjectArray} searchResultFilters searchResultFilters
 * @param {*} reportConfig reportConfig
 * @param {*} reportSearchRecipeExtraInfo reportSearchRecipeExtraInfo
 * @returns {*} chart series data
 */
export let createChartGraphQLData = function( searchResultFilters, reportConfig, reportSearchRecipeExtraInfo ) {
    let arrayOfSeriesDataForChart = [];

    if( searchResultFilters === undefined || searchResultFilters.length === 0 ) {
        return arrayOfSeriesDataForChart;
    }
    let keyValueDataForChart = [];

    var searchResultChartValues = searchResultFilters[0].chartValues;
    // for every data point create a label and value
    searchResultChartValues.forEach( element => {
        keyValueDataForChart.push( {
            label: element.label,
            name: element.label,
            value: element.value
        } );
    } );
    let displayName = Array.isArray( reportConfig.ChartPropName ) ? reportConfig.ChartPropName[ 0 ] : reportConfig.ChartPropName;
    if( reportSearchRecipeExtraInfo?.dbValues?.localizedPropertyName ) {
        displayName = reportSearchRecipeExtraInfo.dbValues.localizedPropertyName;
    }
    // push series of datapoints to entire chart series array
    arrayOfSeriesDataForChart.push( {
        seriesName: displayName,
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

/**
 * Returns chart
 * @param {*} data -
 * @return {*} chart points
 */
export let getChartDataAction = function( data ) {
    data.chartProviders.myChartProvider.title = data.ChartConfiguration.ChartTitle;
    data.chartProviders.myChartProvider.chartType = data.ChartConfiguration.ChartTpIntName;
    return data.chartPoints;
};

export let getSourceObject = function( sourceUid, reportSource ) {
    var deferred = AwPromiseService.instance.defer();
    if( sourceUid !== undefined ) {
        dmSvc.loadObjects( [ sourceUid ] ).then( function() {
            var sourceObj = cdm.getObject( sourceUid );
            // If length will be greater than 120, line breaks and goes to next line
            reportSource.propertyDisplayName = sourceObj.props.object_string.dbValues[ 0 ].length > 120 ? sourceObj.props.object_string.dbValues[ 0 ].slice( 0, 117 ) + '...' : sourceObj.props.object_string.dbValues[ 0 ];
            var showlink = true;
            deferred.resolve( showlink );
        } );
        return deferred.promise;
    }
    deferred.resolve( false );
    return deferred.promise;
};
/**
  * loadColumns
  *
  * @function loadColumns
  * @param {Object} reportTable reportTable
  * @param {Object} colmnWidth colmnWidth
  * @returns {void}
  */
export let loadColumns = function( reportTable, colmnWidth ) {
    var corrected = [];
    var colWidth = colmnWidth === undefined ? 200 : colmnWidth;
    if( reportTable?.ColumnPropInternalName?.length ) {
        var typeN = reportTable.ColumnPropInternalName[ 0 ].split( '.' );
        var objectMeta = cmm.getType( typeN[ 0 ] );
        var displayName = reportTable.ColumnPropName[ 0 ];
        if( !reportTable.ColumnDataType ) {
            reportTable.ColumnDataType = Array( reportTable.ColumnPropInternalName.length ).fill( 'STRING' );
        }
        var dataType = reportTable.ColumnDataType[ 0 ];
        if( objectMeta && objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[ 1 ] ) ) {
            displayName = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].displayName;
        }
        var initialCol = {
            name: typeN[ 1 ],
            displayName: displayName,
            dataType: dataType,
            typeName: typeN[ 0 ],
            associatedTypeName: typeN[ 0 ],
            propertyName: typeN[ 1 ],
            width: 250,
            pinnedLeft: true,
            enableColumnMenu: true
        };

        corrected.push( initialCol );
        // var searchFilterCategories = appCtxService.getCtx( 'ReportsContext.searchIncontextInfo.searchFilterCategories' );
        for( var x = 1; x < reportTable.ColumnPropInternalName.length; x++ ) {
            typeN = reportTable.ColumnPropInternalName[ x ].split( '.' );
            objectMeta = cmm.getType( typeN[ 0 ] );
            displayName = reportTable.ColumnPropName[x ];
            dataType = reportTable.ColumnDataType[ x ];
            if( objectMeta && objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[ 1 ] ) ) {
                displayName = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].displayName;
            }
            var obj = { name: typeN[ 1 ], displayName: displayName, dataType: dataType, typeName: typeN[ 0 ], associatedTypeName: typeN[ 0 ],
                propertyName: typeN[ 1 ], width: colWidth };
            if( typeN[ 1 ] === 'release_status_list' || typeN[ 1 ] === 'release_statuses' ) {
                obj.enableSorting = false;
            }
            corrected.push( obj );
        }
    // if( dataprovider !== null ) {
    //     dataprovider.columnConfig = {
    //         columns: corrected
    //     };
    // }
    }
    return corrected;
};
let callRepGetCategories = function( response ) {
    var categories = response.searchFilterCategories;
    var categoryValues = response.searchFilterMap || response.searchFilterMap6;
    var groupByProperty = response.objectsGroupedByProperty.internalPropertyName;
    var searchResultFilters = [];
    categories.refineCategories = [];
    categories.navigateCategories = [];
    var contextObject = appCtxService.getCtx( reportSearchIncontextInfo );
    if( contextObject === undefined ) { contextObject = {}; }
    _.forEach( categories, function( category, index ) {
        filtrPanelSrvc.getCategories2Int( category, index, categories, categoryValues, groupByProperty, false, true, true, contextObject, searchResultFilters );
    } );
    // const stateObj = response;
    // stateObj.searchFilterMap = response.searchFilterMap;
    // const nwcategories = filtrPanelSrvc.getCategories3( stateObj, true );
    //getSelectedFiltersMap( categories );
    var selectedFiltersMap = getSelectedFiltersMap( categories );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
    contextObject.saveSearchFilterMap = selectedFiltersInfo.activeFilters;
    contextObject.searchFilterCategories = categories;
    appCtxService.updatePartialCtx( reportSearchIncontextInfo, contextObject );
    return categories;
};

let getValidSortCriteriaField = function( sortCriteria, dataColumns ) {
    if( dataColumns ) {
        var propName = sortCriteria.fieldName;
        var selColumn = dataColumns.filter( function( column ) {
            return column.name === propName;
        } );
        return selColumn.length > 0 ? selColumn[ 0 ].associatedTypeName + '.' + propName : propName;
    }
};

/**
 * Attaches a new edit context to the specified element.
 *
 * @param {string} dataProvider - dataProvider
 * @param {Function} tileIndex - tileIndex
 * @returns {void}
 */
const attachNewEditContext = ( dataProvider, tileIndex )=>{
    let uniqueId = dataProvider.json.editContext + '_' + tileIndex;
    let reusableEditHandler = editHandlerSvc.getEditHandler( uniqueId );
    if( reusableEditHandler ) {
        editHandlerSvc.removeEditHandler( reusableEditHandler );
    }
    reusableEditHandler = editHandlerFactory.createEditHandler( dataSourceService.createNewDataSource( {
        dataProvider: dataProvider
    } ), dataProvider.editSupportParamKeys );
    editHandlerSvc.setEditHandler( reusableEditHandler, uniqueId );
    // set this handler active
    editHandlerSvc.setActiveEditHandlerContext( uniqueId );
    editEventsService.startEditForNewVmos( uniqueId );
    return { editContext: uniqueId, editContextObj: reusableEditHandler };
};

export default exports = {
    getChartDataAction,
    dashboardTileRevealed,
    getSourceObject,
    loadData,
    createChartGraphQLData,
    loadColumns,
    overWriteColumns
};
