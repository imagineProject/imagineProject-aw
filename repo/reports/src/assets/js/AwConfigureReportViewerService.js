// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwConfigureReportViewerService}
 *
 * @module js/AwConfigureReportViewerService
 */
import _ from 'lodash';
import AwParseService from 'js/awParseService';
import appCtxService from 'js/appCtxService';
import AwTextbox from 'viewmodel/AwTextboxViewModel';
import AwPropertyLabel from 'viewmodel/AwPropertyLabelViewModel';
import searchFilterService from 'js/aw.searchFilter.service';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwConfigureChart from 'viewmodel/AwConfigureChartViewModel';
import AwReportTable from 'viewmodel/AwReportTableViewModel';
import AwActiveReportViewer from 'viewmodel/AwActiveReportViewerViewModel';
import showMyDashboardSrvc from 'js/showMyDashboardService';
import AwStateService from 'js/awStateService';
import aw_searchFilter from 'js/aw.searchFilter.service';
import awActiveReportViewerSrvc from 'js/AwActiveReportViewerService';
import { convertJsonToString } from 'js/reportsCommonService';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import { ExistWhen, EnableWhen } from 'js/hocCollection';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import confgItemRepSrvc from 'js/configureItemReportService';
import AwListbox from 'viewmodel/AwListboxViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import cmm from 'soa/kernel/clientMetaModel';
import navigationSvc from 'js/navigationService';
import addObjectUtils from 'js/addObjectUtils';
import awPromiseService from 'js/awPromiseService';
import localeSvc from 'js/localeService';
import filterPanelUtils from 'js/filterPanelUtils';
import AwEmptyWorkarea from 'viewmodel/AwEmptyWorkareaViewModel';

const AwSplmTableExistWhen = ExistWhen( AwSplmTable );
const AwPanelHeaderEnableWhen = EnableWhen( AwPanelHeader );
const INTERNAL_KEYWORD = '_I_N_T_E_R_N_A_L__N_A_M_E_';
const DivExistWhen = ExistWhen( 'div' );
const AwEmptyWorkareaExistWhen = ExistWhen( AwEmptyWorkarea );
const summaryReportType0 = '0';
const defaultSummaryReportDataProvider = 'Awp0FullTextSearchProvider';
const defaultItemReportDataProvider = 'Rb0ReportsDataProvider';
const advancedSearchKey = 'ADVANCED_SEARCH';
export const awConfigureReportViewerViewRenderFunction = ( props ) => {
    let { viewModel, fields } = props;
    let { data, conditions, i18n, actions } = viewModel;
    var classToApplyForChart = data.chartCountList.dbValue > 0 ? 'sw-column h-12 w-' + 12 / data.chartCountList.dbValue : 'sw-column h-12 w-12';
    var classToApplyForTable = data.chartCountList.dbValue > 0 ? 'sw-column h-5' : 'sw-column h-12';
    var chartContainerClass = data.chartCountList.dbValue > 0 ? 'aw-reports-chartContainer sw-row h-7' : '';
    const updateReportTitle = ( newValue ) => {
        var nwReportsState = props.reportsState.getValue();
        nwReportsState.reportParameters.ReportDefProps = {
            ...nwReportsState.reportParameters.ReportDefProps,
            ReportTitle: {
                TitleText: newValue
            }
        };
        props.reportsState.update( nwReportsState );
    };
    const renderActiveReportView = ()=> {
        return props.reportsState.selectedReport ?
            <AwActiveReportViewer reportTemplate={props.reportsState.selectedReport} subPanelContext={props.subPanelContext}/> :
            <AwActiveReportViewer reportProps={props.reportsState} subPanelContext={props.subPanelContext}/>;
    };
    const defaultItemReportView = ()=> {
        return (
            <AwSplmTableExistWhen existWhen={props.reportsState.rootClassSampleObject && props.reportsState.rootClassSampleObject[0]} { ...viewModel.grids.sourceObjectView } gridid={'sourceObjectView'} showContextMenu={true}></AwSplmTableExistWhen>
        );
    };
    return (
        <div className='w-12'>
            {
                conditions.notPreviewed ?
                    <div className='sw-column h-12'>
                        <AwPanelHeaderEnableWhen className='aw-reports-reportViewHeader sw-row' enableWhen={conditions.renderCondition }>
                            <DivExistWhen className='aw-reports-templateTitle sw-column w-4' existWhen={!appCtxService.ctx.preferences?.REPORT_Hide_NonLocalizable_Title || appCtxService.ctx.preferences?.REPORT_Hide_NonLocalizable_Title[0] !== 'true'}>
                                <AwTextbox {...fields.reportTitleWidget} onSwChange={updateReportTitle}></AwTextbox>
                            </DivExistWhen>
                            <div className='aw-reports-chartCount sw-row'>
                                <AwPropertyLabel className='aw-reports-templateTitle sw-column' {...fields.reportChartNumber}></AwPropertyLabel>
                                <AwListbox className='sw-column aw-reports-chartCountList' {...fields.chartCountList} list={data.chartCountListValues}></AwListbox>
                            </div>

                        </AwPanelHeaderEnableWhen>
                        <AwPanelBody>
                            <div className={chartContainerClass}>
                                {
                                    ( props.reportsState.searchInfo || !conditions.isSummaryReport ) &&
                                    props.reportsState.value.reportParameters?.ReportDefProps?.allChartsList?.length > 0 &&
                                    Object.entries( props.reportsState.value.reportParameters.ReportDefProps.allChartsList ).map( ( [ $index, reportChartConfig ] ) =>
                                        reportChartConfig.visible &&
                                        <AwConfigureChart
                                            id={$index}
                                            className={classToApplyForChart}
                                            chartCount={data.chartCountList.dbValue}
                                            reportsState={props.reportsState}
                                            chartConfig={reportChartConfig}
                                        />
                                    )
                                }
                            </div>
                            <div className={classToApplyForTable}>
                                {
                                    conditions.renderCondition ?
                                        <AwReportTable
                                            subPanelContext={AwParseService.instance( '{reportsState:props.reportsState, ...props.subPanelContext}' )( { props, data, fields } ) }>
                                        </AwReportTable>
                                        : defaultItemReportView()
                                }
                                {
                                    <AwEmptyWorkareaExistWhen existWhen={conditions.shourceObjectDeleted} className='sw-row h-12 justify-center'
                                        title={i18n.noItemAvailable}
                                        hint={i18n.itemMissing}
                                        commandId='Rb0ConfigureItemSearch'
                                        linkText={i18n.searchItem}
                                        linkVisibility='true' commandContext={{ reportsState: props.reportsState }}>
                                    </AwEmptyWorkareaExistWhen>
                                }
                            </div>
                        </AwPanelBody>
                    </div> : renderActiveReportView()
            }
        </div>
    );
};
export let getRootClassSampleObject = async function( reportsState, dataProvider ) {
    var modelObjects = [];
    var propList = [ 'object_string', 'object_desc', 'object_type', 'owning_user' ];
    return await dmSvc.getProperties( [ reportsState.rootClassSampleObject[0].uid ], propList ).then( function() {
        // Create view model objects
        let vmo = cdm.getObject( reportsState.rootClassSampleObject[0].uid );
        let object = viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
        modelObjects.push( object );
        dataProvider.update( modelObjects, modelObjects.length );
        return modelObjects;
    } );
};
export const initializeChartList = ( chartCount, reportsState, i18n ) => {
    if( !chartCount && appCtxService.ctx.state.params.reportId && chartCount !== 0 ) { return; }
    var chartConfig = {
        ChartTitle: '',
        ChartType: 'column',
        ChartPropName: '',
        ChartPropInternalName: '',
        ChartTypeName: i18n.barChart,
        ChartIconName: 'cmdBarChart'
    };
    var nwReportsState = reportsState.getValue();
    if( !nwReportsState.reportParameters?.ReportDefProps?.allChartsList ) {
        nwReportsState.reportParameters = {
            ReportDefProps: {
                ...nwReportsState.reportParameters?.ReportDefProps,
                allChartsList: Array( chartCount ).fill( { ...chartConfig } )
            }
        };
    } else {
        var x = chartCount - nwReportsState.reportParameters.ReportDefProps.allChartsList.length;
        if( x > 0 ) {
            _.times( x, ()=>{ nwReportsState.reportParameters.ReportDefProps.allChartsList.push( { ...chartConfig } ); } );
        }
    }
    let count = chartCount;
    _.forEach( nwReportsState.reportParameters.ReportDefProps.allChartsList, ( chart, index )=>{
        chart.chartName = 'generic' + index;
        if( index < count ) {
            nwReportsState.reportParameters.ReportDefProps.allChartsList[index].visible = true;
        } else {
            nwReportsState.reportParameters.ReportDefProps.allChartsList[index].visible = false;
        }
    } );
    nwReportsState.reloadChart = true;
    reportsState.update( nwReportsState );
};

export const getConfigureSearchCriteria = ( searchCriteria ) => {
    if( appCtxService.ctx.state.params.reportId ) {
        return searchCriteria;
    }
    return appCtxService.ctx.state.params.searchCriteria;
};
export const getSearchCriteriaForItemReport = ( searchObjUid ) => {
    var object = {
        sourceObject: searchObjUid
    };
    return convertJsonToString( object );
};
export const getConfigureFilterString = ( activeFilterMap ) => {
    if( appCtxService.ctx.state.params.reportId ) {
        return convertJsonToString( activeFilterMap );
    }
    return appCtxService.ctx.state.params.filter;
};
const getFilterString = ( searchState ) => {
    return searchState.activeFilters ? aw_searchFilter.buildFilterString( searchState.activeFilters ) : null;
};

export let initializeSearchState = ( searchState, searchCriteria, filter ) => {
    var nwSearchState = searchState.getValue();
    if( searchCriteria && appCtxService.ctx.state.params.reportType === summaryReportType0 ) {
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( searchFilterService.getFilters() );
        nwSearchState.criteria = {
            searchString: searchCriteria,
            hideUnassignedCategories: 'false',
            limitedFilterCategoriesEnabled: false
        };
        nwSearchState.activeFilterMap = appCtxService.ctx.state.params.reportId ? JSON.parse( filter ) : selectedFiltersInfo.activeFilterMap;
        nwSearchState.activeFilters = {};
        var savedFilterMap = aw_searchFilter.convertFilterMapToSavedSearchFilterMap( nwSearchState );
        _.forEach( savedFilterMap, ( filters, index )=>{
            nwSearchState.activeFilters[index] = [];
            _.forEach( filters, ( filter, i )=>{
                if( nwSearchState.activeFilterMap[index][i].searchFilterType === 'StringFilter' && nwSearchState.provider === defaultSummaryReportDataProvider && nwSearchState.activeFilterMap[index][i].stringDisplayValue !== nwSearchState.activeFilterMap[index][i].stringValue ) {
                    nwSearchState.activeFilters[index].push( nwSearchState.activeFilterMap[index][i].stringDisplayValue + INTERNAL_KEYWORD + filter.stringValue );
                } else {
                    nwSearchState.activeFilters[index].push( filter.stringValue );
                }
            } );
        } );
    }
    return nwSearchState;
};

let updateStateFromSelectedReport = ( nwReportsState )=>{
    awActiveReportViewerSrvc.rebuildReportProps( nwReportsState.selectedReport, nwReportsState );
    _.forEach( nwReportsState.reportParameters.ReportDefProps.allChartsList, ( chart )=>{
        chart.visible = true;
    } );
};

let updateReportDefProps = ( nwReportsState )=>{
    var ColumnPropNameValues = [];
    var ColumnPropInternalNameValues = [];
    var ColumnDataTypeValues = [];
    _.forEach( nwReportsState.reportParameters.columns, ( column )=>{
        ColumnPropNameValues.push( column.displayName );
        ColumnPropInternalNameValues.push( column.associatedTypeName + '.' + column.name );
        ColumnDataTypeValues.push( column.dataType );
    } );
    if( !nwReportsState.reportParameters.ReportDefProps ) {
        nwReportsState.reportParameters.ReportDefProps = {};
    }
    if( appCtxService.ctx.state?.params?.searchCriteria ) {
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( searchFilterService.getFilters() );
        nwReportsState.reportParameters.ReportDefProps = {
            ...nwReportsState.reportParameters.ReportDefProps,
            ReportSearchInfo: {
                activeFilterMap: appCtxService.ctx.state.params.filter ? selectedFiltersInfo.activeFilterMap : {},
                SearchCriteria: appCtxService.ctx.state.params.reportType === summaryReportType0 ? appCtxService.ctx.state.params.searchCriteria :
                    nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria
            },
            ReportTable1: {
                ColumnPropName: ColumnPropNameValues,
                ColumnPropInternalName: ColumnPropInternalNameValues,
                ColumnDataType: ColumnDataTypeValues
            }
        };
    } else{
        if( !nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo ) {
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {};
        }
        if( appCtxService.ctx.state.params.additionalSearchCriteria ) {
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria = JSON.parse( appCtxService.ctx.state.params.additionalSearchCriteria );
        }
        if( appCtxService.ctx.state.params.dataProvider ) {
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName = appCtxService.ctx.state.params.dataProvider;
        }
        nwReportsState.reportParameters.ReportDefProps = {
            ...nwReportsState.reportParameters.ReportDefProps,
            ReportTable1: {
                ColumnPropName: ColumnPropNameValues,
                ColumnPropInternalName: ColumnPropInternalNameValues,
                ColumnDataType: ColumnDataTypeValues
            }
        };
    }
    let validCharts = [];
    _.forEach( nwReportsState.reportParameters.ReportDefProps.allChartsList, ( chart )=> {
        chart.ChartPropInternalName !== '' && chart.visible ? validCharts.push( chart ) : '';
    } );
    nwReportsState.reportParameters.ReportDefProps.allChartsList = validCharts;
};

export const showPreviewed = ( reportsState, title, i18n ) =>{
    var notPreviewed = appCtxService.ctx.state.params.previewMode === 'false';
    var nwReportsState = reportsState.getValue();
    if( notPreviewed ) {
        // AwConfigureReportView
        nwReportsState.selectedReport ? updateStateFromSelectedReport( nwReportsState ) : '';
        nwReportsState.reportParameters.ReportDefProps?.allChartsList?.length === 0 ? _.times( 1, ()=>{
            nwReportsState.reportParameters.ReportDefProps.allChartsList.push( {
                ChartTitle: '',
                ChartType: 'column',
                ChartPropName: '',
                ChartPropInternalName: '',
                ChartTypeName: i18n.barChart,
                ChartIconName: 'cmdBarChart',
                visible: true
            } );
        } ) : '';
    }else{
        // AwActiveReportView
        updateReportDefProps( nwReportsState );
    }
    /*
        Reason for returning title:
        Edit Saved Report => change Title text => Press Cancel button => Press Edit button => check title text
    */
    var nwTitle = { ...title };
    nwTitle.dbValue = nwReportsState.reportParameters.ReportDefProps?.ReportTitle?.TitleText;
    nwTitle.uiValue = nwReportsState.reportParameters.ReportDefProps?.ReportTitle?.TitleText;
    reportsState.update( nwReportsState );
    return nwTitle;
};

export const updateThumbnail = ( reportState, thumbnail )=>{
    let nwReportsState = reportState.getValue();
    var thumbnailValue = '';
    if( thumbnail ) {
        thumbnailValue = thumbnail.dbValue;
    }else {
        var thumbIndex = nwReportsState.selectedReport.props.rd_parameters.dbValues.indexOf( 'ThumbnailChart' );
        let validCharts = [];
        _.forEach( reportState.reportParameters.ReportDefProps.allChartsList, ( chart )=> {
            chart.ChartPropInternalName !== '' && chart.visible ? validCharts.push( chart ) : '';
        } );
        if( thumbIndex > -1 ) {
            thumbnailValue = nwReportsState.selectedReport.props.rd_param_values.dbValues[thumbIndex];
        } else {
            thumbnailValue = validCharts.length > 0 ?  'ReportChart1' : 'ReportTable1';
        }
        if( thumbnailValue.startsWith( 'ReportChart' ) ) {
            var index = thumbnailValue.slice( 11 ) - 1;
            thumbnailValue = validCharts.length > index ? thumbnailValue : 'ReportTable1';
        }
    }
    nwReportsState.reportParameters.ReportDefProps.ThumbnailChart = { ChartName:thumbnailValue };
    reportState.update( nwReportsState );
};

export const saveReportProps = ( reportState ) => {
    let vecNameVal = {};
    let reportsDefProps = reportState?.value?.reportParameters?.ReportDefProps;
    let params = [];
    let paramValues = [];

    //Currently we need to break Filter and table columns strings due to size restrictions from
    //setProperties() SOA. We may need to find better solution in future releases.
    for( var key in reportsDefProps ) {
        if( key === 'ReportSearchInfo' ) {
            var counter = 0;
            for( var actvFilter in reportsDefProps[ key ].activeFilterMap ) {
                var filterName = 'ReportFilter_' + counter.toString();
                params.push( filterName );
                paramValues.push( actvFilter );

                //start processing filters, max filter string length can be 240
                var filterStr = JSON.stringify( reportsDefProps[ key ].activeFilterMap[ actvFilter ] );
                var filterValue;
                if( filterStr.length < 240 ) {
                    filterValue = 'ReportFilterValue_' + counter.toString();
                    params.push( filterValue );
                    paramValues.push( JSON.stringify( reportsDefProps[ key ].activeFilterMap[ actvFilter ] ) );
                } else {
                    var filtCounter = 0;
                    filterValue = 'ReportFilterLargeValue_' + counter.toString() + '_';
                    var filterValues = reportsDefProps[ key ].activeFilterMap[ actvFilter ];
                    filterValues.forEach( val => {
                        params.push( filterValue + filtCounter );
                        paramValues.push( JSON.stringify( val ) );
                        filtCounter++;
                    } );
                }
                counter++;
            }
            if( reportsDefProps[ key ].SearchCriteria?.length > 4000 ) {
                params.push( 'ReportSearchCriteria_1' );
                paramValues.push( reportsDefProps[ key ].SearchCriteria.slice( 0, 4000 ) );
                params.push( 'ReportSearchCriteria_2' );
                paramValues.push( reportsDefProps[ key ].SearchCriteria.slice( 4000 ) );
            } else if( reportsDefProps[ key ].SearchCriteria ) {
                params.push( 'ReportSearchCriteria' );
                paramValues.push( reportsDefProps[ key ].SearchCriteria );
            }

            if( reportState?.translatedSearchCriteriaForPropertySpecificSearch?.length > 0 ) {
                _.forEach( reportState.translatedSearchCriteriaForPropertySpecificSearch, function( value ) {
                    if( value && value.length > 0 ) {
                        params.push( 'ReportTranslatedSearchCriteria' );
                        paramValues.push( value );
                    }
                } );
            }
            if( reportsDefProps[ key ].additionalSearchCriteria ) {
                params.push( 'AdditionalSearchCriteria' );
                paramValues.push( JSON.stringify( reportsDefProps[ key ].additionalSearchCriteria ) );
            }
            if( reportsDefProps[ key ].dataProviderName ) {
                params.push( 'DataProvider' );
                paramValues.push(  reportsDefProps[ key ].dataProviderName );
            }
        } else if( key === 'ReportTable1' ) {
            params.push( 'ReportTable1ColumnPropName' );
            paramValues.push( JSON.stringify( reportsDefProps[ key ].ColumnPropName ) );

            //Divide columns in half and then convert its string.
            var halfLen = Math.ceil( reportsDefProps[ key ].ColumnPropInternalName.length / 2 );
            var PropNameList1 = reportsDefProps[ key ].ColumnPropInternalName.slice( 0, halfLen );
            var PropNameList2 = reportsDefProps[ key ].ColumnPropInternalName.slice( halfLen, reportsDefProps[ key ].ColumnPropInternalName.lengthF );
            params.push( 'ReportTable1ColumnPropInternalName_0' );
            paramValues.push( JSON.stringify( PropNameList1 ) );

            params.push( 'ReportTable1ColumnPropInternalName_1' );
            paramValues.push( JSON.stringify( PropNameList2 ) );

            params.push( 'ReportTable1ColumnDataType' );
            paramValues.push( JSON.stringify( reportsDefProps[ key ].ColumnDataType ) );
        } else if( key === 'allChartsList' ) {
            let chartCount = 0;
            _.forEach( reportsDefProps[ key ], ( chart )=> {
                if( chart.visible && chart.ChartPropInternalName !== '' ) {
                    chartCount++;
                    var chartProp = {
                        ChartPropName: chart.ChartPropName,
                        ChartTitle: chart.ChartTitle,
                        ChartTpIntName: chart.ChartTpIntName,
                        ChartType: chart.ChartType
                    };
                    var chartIntProps = chart.ChartPropInternalName;
                    var keyValue = 'ReportChart' +  chartCount;
                    params.push( keyValue + '_0' );
                    paramValues.push( JSON.stringify( chartProp ) );
                    params.push( keyValue + '_1' );
                    paramValues.push( JSON.stringify( chartIntProps ) );
                }
            } );
        } else if( key === 'ReportSegmentParams' ) {
            counter = 0;
            _.forEach( reportsDefProps[ key ], function( value ) {
                if( JSON.stringify( value ).length > 4000 ) {
                    params.push( 'ReportSegment' + ( 1 + counter ) + '_1' );
                    paramValues.push( JSON.stringify( value ).slice( 0, 4000 ) );
                    params.push( 'ReportSegment' + ( 1 + counter ) + '_2' );
                    paramValues.push( JSON.stringify( value ).slice( 4000 ) );
                } else {
                    params.push( 'ReportSegment' + ( 1 + counter ) );
                    paramValues.push( JSON.stringify( value ) );
                }
                counter++;
            } );
        } else if( key === 'ThumbnailChart' ) {
            // storing this without json stringifying as per old storing
            params.push( key );
            paramValues.push( reportsDefProps[ key ].ChartName );
        } else {
            params.push( key );
            paramValues.push( JSON.stringify( reportsDefProps[ key ] ) );
        }
    }
    vecNameVal.rd_parameters = params;
    vecNameVal.rd_param_values = paramValues;
    if( appCtxService.ctx.state.params.reportType === '1' ) {
        var rootType = reportState?.rootClassSampleObject[0].type;
        vecNameVal.rd_class = rootType;
        vecNameVal.fnd0IsClassOnly = true;
    }
    return { params:vecNameVal, reportType:getReportType() };
};

export const getCreateReportDefnInput = ( reportName, rd_params, reportId, reportDesc, reportType, selectedAdvanedQuery )=>{
    const searchInput = {
        boName: 'ReportDefinition',
        stringProps: {
            rd_name: reportName,
            rd_source: 'Active Workspace',
            rd_folder_name: 'CrfHome',
            rd_class: rd_params.rd_class,
            rd_id: reportId,
            rd_description: reportDesc
        },
        intProps: {
            rd_state: 0,
            rd_type: reportType
        },
        stringArrayProps: {
            rd_param_values: rd_params.rd_param_values,
            rd_parameters: rd_params.rd_parameters
        },
        boolProps: {
            fnd0IsAsync: false,
            fnd0IsClassOnly: rd_params.fnd0IsClassOnly
        }
    };
    if( selectedAdvanedQuery ) {
        searchInput.compoundCreateInput = {
            rd_query_source: [ {
                boName: 'CrfQuerySource',
                tagProps: {
                    qry_src_tc_qry: selectedAdvanedQuery
                }
            } ]
        };
    }
    return searchInput;
};

const dashboardActionOnSavedReport = async( dashboardFlag, selectedReport, dashboardObjectUid, previousDashboardUid )=>{
    if( appCtxService.ctx.state.params.reportType === summaryReportType0 && dashboardFlag && ( appCtxService.ctx.showAddToDashboardCommand === true || typeof appCtxService.ctx.showAddToDashboardCommand === 'undefined' ) ) {
        await showMyDashboardSrvc.addSelectedDashboardReportForTabbed( selectedReport, { uid:dashboardObjectUid } );
    }else if( appCtxService.ctx.state.params.reportType === summaryReportType0 && dashboardFlag && appCtxService.ctx.showAddToDashboardCommand === false &&
        previousDashboardUid && previousDashboardUid !== dashboardObjectUid ) {
        await showMyDashboardSrvc.removeSelectedDashboardReportForTabbed( selectedReport, { uid:previousDashboardUid } );
        await showMyDashboardSrvc.addSelectedDashboardReportForTabbed( selectedReport, { uid:dashboardObjectUid } );
    } else if( appCtxService.ctx.state.params.reportType === summaryReportType0 &&
    !dashboardFlag && appCtxService.ctx.showAddToDashboardCommand === false ) {
        await showMyDashboardSrvc.removeSelectedDashboardReportForTabbed( selectedReport, { uid:dashboardObjectUid } );
    }
};

export let updateSelectedReportAndAddToDashboard = ( response, reportsState, dashboardFlag, dashboardObjectUid, previousDashboardUid ) => {
    var nwReportsState = reportsState.getValue();
    if( !nwReportsState.selectedReport && response.output.length > 0 ) {
        nwReportsState.newSavedReport = response.output[0].objects[0].uid;
        dashboardActionOnSavedReport( dashboardFlag, response.ServiceData.modelObjects[nwReportsState.newSavedReport], dashboardObjectUid );
    } else if( nwReportsState.selectedReport ) {
        nwReportsState.selectedReport = response.ServiceData.modelObjects[nwReportsState.selectedReport.uid];
        dashboardActionOnSavedReport( dashboardFlag, nwReportsState.selectedReport, dashboardObjectUid, previousDashboardUid );
    }
    reportsState.update( nwReportsState );
    return nwReportsState.selectedReport;
};
export let getEscapedUrlParameters = ( previewMode, params )=>{
    var reportParam = { ...params };
    reportParam.previewMode = previewMode;
    var options = {};
    options.inherit = false;
    AwStateService.instance.go( 'createReportTemplate', reportParam, options );
};
export let updateChartCountAndTitle = ( reportsState, chartCountList, chartCountListValues, reportTitleWidget )=>{
    var nwReportsState = reportsState.getValue();
    var nwChartCountList = { ...chartCountList };
    var nwReportTitleWidget = { ...reportTitleWidget };
    nwChartCountList.dbValue = nwReportsState.reportParameters?.ReportDefProps?.allChartsList?.length || nwReportsState.reportParameters?.ReportDefProps?.allChartsList?.length === 0 ?
        nwReportsState.reportParameters.ReportDefProps.allChartsList.length : 1;
    chartCountListValues.forEach( ( value )=>{
        if( value.propInternalValue === nwChartCountList.dbValue ) {
            nwChartCountList.uiValue = value.propDisplayValue;
        }
    } );
    nwReportTitleWidget.uiValue = nwReportsState.reportParameters?.ReportDefProps?.ReportTitle?.TitleText ? nwReportsState.reportParameters.ReportDefProps.ReportTitle.TitleText : '';
    nwReportTitleWidget.dbValue = nwReportTitleWidget.uiValue;
    return { chartCountList:nwChartCountList, reportTitleWidget:nwReportTitleWidget };
};

let processSegmentTree = ( reportsState, nwReportsState )=>{
    if( nwReportsState.reportParameters.ReportDefProps?.ReportSegmentParams ) {
        confgItemRepSrvc.updateSegmentTree( nwReportsState );
        nwReportsState.segmentTree[0].children.length > 0 ? nwReportsState.editRelationCommand = 'true' : '';
    }
    reportsState.update( nwReportsState );
};

export const updateReportInformation = async( reportsState ) => {
    var nwReportsState = reportsState.getValue();
    //Update sourceObject
    if( nwReportsState.reportParameters.ReportDefProps?.ReportClassParameters ) {
        await dmSvc.loadObjects( [ nwReportsState.reportParameters.ReportDefProps.ReportClassParameters.rootSampleUid ] ).then( function() {
            let sampleObj = cdm.getObject( nwReportsState.reportParameters.ReportDefProps.ReportClassParameters.rootSampleUid );
            nwReportsState.rootClassSampleObject = sampleObj?.uid ? [ viewModelObjectService.createViewModelObject( sampleObj.uid, 'EDIT', null, sampleObj ) ] : [];
            processSegmentTree( reportsState, nwReportsState );
        }, function() {
            processSegmentTree( reportsState, nwReportsState );
        } );
    }
};

export let getRdMetaDataInfo = function( reportsState, title, description ) {
    var input = [];
    var rd_parameters = reportsState.selectedReport.props.rd_parameters.dbValues;
    var rd_param_values = reportsState.selectedReport.props.rd_param_values.dbValues;
    rd_param_values[rd_parameters.indexOf( 'ThumbnailChart' )] = reportsState.reportParameters.ReportDefProps.ThumbnailChart.ChartName;
    var dataVal = {
        object:{
            uid: reportsState.selectedReport.uid,
            type: reportsState.selectedReport.type
        },
        vecNameVal: [ {
            name: 'rd_parameters',
            values: rd_parameters
        }, {
            name:'rd_param_values',
            values:rd_param_values
        }, {
            name:'rd_name',
            values:[ title ]
        }, {
            name:'rd_description',
            values:[ description ]
        } ]
    };
    input.push( dataVal );
    return input;
};

const updateCrfQuerySource = async( crfQuerySource, reportsState )=>{
    await dmSvc.setProperties( [ {
        object: crfQuerySource,
        vecNameVal: [ {
            name: 'qry_src_tc_qry',
            values: [
                reportsState.selectedAdvanedQuery.uid
            ]
        } ]
    } ] );
};

export let getReportInfo = function( reportsState, rd_params, title, description ) {
    var input = [];
    var dataVal = {
        object:{
            uid: reportsState.selectedReport.uid,
            type: reportsState.selectedReport.type
        },
        vecNameVal: [ {
            name: 'rd_parameters',
            values: rd_params.rd_parameters
        }, {
            name: 'rd_param_values',
            values: rd_params.rd_param_values
        }, {
            name: 'rd_name',
            values: [ title ]
        }, {
            name: 'rd_description',
            values: [ description ]
        }  ]
    };
    if( appCtxService.ctx.state.params.reportType === '1' ) {
        dataVal.vecNameVal.push( { name: 'rd_class', values: [ rd_params.rd_class ] } );
        dataVal.vecNameVal.push( { name: 'fnd0IsClassOnly', values: [ rd_params.fnd0IsClassOnly.toString() ] } );
    }
    input.push( dataVal );
    if( reportsState.selectedReport.props.rd_query_source?.dbValues?.length > 0 && reportsState.selectedAdvanedQuery ) {
        const crfQuerySource = cdm.getObject( reportsState.selectedReport.props.rd_query_source.dbValues[0] );
        const imanQueryUid = crfQuerySource?.props?.qry_src_tc_qry?.dbValues[0];
        if( imanQueryUid !== reportsState.selectedAdvanedQuery.uid ) {
            //call setProperties for crfQuerySource
            updateCrfQuerySource( crfQuerySource, reportsState );
        }
    }
    return input;
};
export const setReportTypeName = ( reportType, reportTypeName, i18n ) =>{
    var nwReportTypeName = { ...reportTypeName };
    if( reportType === '1' || reportType === 1 ) {
        nwReportTypeName.uiValue = i18n.advItemReport;
        nwReportTypeName.dbValue = '1';
    } else {
        nwReportTypeName.uiValue = i18n.advSummReport;
        nwReportTypeName.dbValue = summaryReportType0;
    }
    return nwReportTypeName;
};
export const updateState = ( state, value, i18n ) => {
    var nwState = {
        ...value,
        reportParameters:{ ...state.value.reportParameters, ReportDefProps: { allChartsList:[ {
            ChartTitle: '',
            ChartType: 'column',
            ChartPropName: '',
            ChartPropInternalName: '',
            ChartTypeName: i18n.barChart,
            visible: true
        } ] } },
        rootClassSampleObject: []
    };
    state.update( nwState );
    return [];
};
let updateSourceObject = ( selectionData, nwReportsState, i18n )=>{
    if( nwReportsState.selectedReport && nwReportsState.rootClassSampleObject?.length > 0 ) {
        nwReportsState.initRepDisp = true;
    }
    nwReportsState.rootClassSampleObject = [ selectionData ];
    if( !nwReportsState.reportParameters.ReportDefProps ) {
        nwReportsState.reportParameters.ReportDefProps = {};
    }
    var tree = {
        label: nwReportsState.rootClassSampleObject[0].modelType.displayName + ' (' + i18n.parentSource + ')',
        value: nwReportsState.rootClassSampleObject[0].modelType.displayName + ' (' + i18n.parentSource + ')',
        expanded: true,
        children: []
    };
    nwReportsState.segmentTree ? '' : nwReportsState.segmentTree = [ tree ];
    nwReportsState.reportParameters.ReportDefProps.ReportClassParameters = {
        rootClassUid: nwReportsState.rootClassSampleObject[0].modelType.uid,
        rootSampleUid: nwReportsState.rootClassSampleObject[0].uid
    };
};
export let loadSourceObject = ( uid, reportsState, data )=>{
    let deferred = awPromiseService.instance.defer();
    dmSvc.loadObjects( [ uid ] ).then( function() {
        let nwReportsState = reportsState.getValue();
        var sourceObj = cdm.getObject( uid );
        nwReportsState.rootClassSampleObject = [ viewModelObjectService.createViewModelObject( sourceObj.uid, 'EDIT', null, sourceObj ) ];
        var tree = {
            label: nwReportsState.rootClassSampleObject[0].modelType.displayName + ' (' + data.i18n.parentSource + ')',
            value: nwReportsState.rootClassSampleObject[0].modelType.displayName + ' (' + data.i18n.parentSource + ')',
            expanded: true,
            children: []
        };
        if( !nwReportsState.segmentTree || nwReportsState.segmentTree.length === 0 ) {
            nwReportsState.segmentTree = [ tree ];
            confgItemRepSrvc.updateSegmentTree( nwReportsState );
            nwReportsState.segmentTree[0].children.length > 0 ? nwReportsState.editRelationCommand = 'true' : '';
        }
        if( !nwReportsState.reportParameters.ReportDefProps ) {
            nwReportsState.reportParameters.ReportDefProps = {};
        }
        nwReportsState.reportParameters.ReportDefProps.ReportClassParameters = {
            rootClassUid: nwReportsState.rootClassSampleObject[0].modelType.uid,
            rootSampleUid: nwReportsState.rootClassSampleObject[0].uid
        };
        reportsState.update( nwReportsState );
        deferred.resolve( [ {
            iconId: nwReportsState.rootClassSampleObject[0].typeIconURL,
            chipType: 'BUTTON',
            labelDisplayName: nwReportsState.rootClassSampleObject[0].cellHeader1
        } ] );
    }, function() {
        deferred.resolve( [] );
    } );
    return deferred.promise;
};
export let updateSourceObjectBreadcrumb = ( reportsState, data )=>{
    if( appCtxService.ctx.state.params.searchCriteria && JSON.parse( appCtxService.ctx.state.params.searchCriteria ).sourceObject
        && ( !reportsState.getValue().rootClassSampleObject || reportsState.getValue().rootClassSampleObject.length <= 0 ) ) {
        let object = JSON.parse( appCtxService.ctx.state.params.searchCriteria );
        return loadSourceObject( object.sourceObject, reportsState, data );
    } else if( appCtxService.ctx.state.params.reportId && reportsState.reportParameters?.ReportDefProps?.ReportClassParameters?.rootSampleUid
        && ( !reportsState.getValue().rootClassSampleObject || reportsState.getValue().rootClassSampleObject.length <= 0 ) ) {
        return loadSourceObject( reportsState.reportParameters.ReportDefProps.ReportClassParameters.rootSampleUid, reportsState, data );
    }
    if( reportsState.rootClassSampleObject.length > 0 ) {
        return [ {
            iconId: reportsState.rootClassSampleObject[0].typeIconURL,
            chipType: 'BUTTON',
            labelDisplayName: reportsState.rootClassSampleObject[0].cellHeader1
        } ];
    }
    return [];
};
export let updateSegmentChips = ( reportsState, i18n )=>{
    if( reportsState.segmentTree.length > 0 ) {
        var child = reportsState.segmentTree[0];
        var label = child.label;
        let idx = 0;

        while( child.children.length > 0 ) {
            child = child.children[0];
            idx += 1;
        }
        if( idx === 1 ) {
            label = child.label;
        }else{
            label = i18n.totalSegments.replace( '{0}', idx );
        }
        return [ {
            chipType: 'BUTTON',
            labelDisplayName: label
        } ];
    }
    return [];
};
/**
 * Get Type value for new Report
 * @returns {int} repType - Type value
 */
let getReportType = function() {
    if( appCtxService.ctx.state.params.reportType === '1' ) {
        return 1;
    }
    return 0;
};
let updateReportSearchInfo = ( searchState, nwReportsState )=>{
    if( searchState.advancedSearchCriteria?.typeOfSearch === advancedSearchKey ) {
        if( !nwReportsState.reportParameters.ReportDefProps ) {
            nwReportsState.reportParameters.ReportDefProps = { ReportSearchInfo: {} };
        } else if( !nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo ) {
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {};
        }
        let advancedQueryUid = searchState.savedQuery?.value;
        nwReportsState.selectedAdvanedQuery = cdm.getObject( advancedQueryUid );
        nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria = { relationsPath: JSON.stringify( { relationsPath:[ { searchMethod: advancedSearchKey, objectType: 'ALL', additionalTraversalCriteria: searchState.advancedSearchCriteria } ] } ) };
        nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName = defaultItemReportDataProvider;
        delete nwReportsState.searchInfo;
    } else {
        nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
            activeFilterMap: searchState.activeFilterMap,
            SearchCriteria: searchState.criteria.searchString,
            dataProviderName: defaultSummaryReportDataProvider
        };
    }
    nwReportsState.initRepDisp = true;
};
export let loadColumnsForSourceObject = ()=>{
    let iconColumn = {
        name: 'icon',
        displayName: '',
        maxWidth: 70,
        minWidth: 70,
        width: 70,
        enableColumnMenu: false,
        pinnedLeft: true,
        enableColumnResizing: false
    };
    let columnsRequired = [ 'WorkspaceObject.object_string', 'WorkspaceObject.object_desc', 'WorkspaceObject.object_type', 'WorkspaceObject.owning_user' ];
    let columns = [];
    columns.push( iconColumn );
    _.forEach( columnsRequired, ( columnName, index ) => {
        var typeN = columnName.split( '.' );
        var objectMeta = cmm.getType( typeN[ 0 ] );
        var displayName = '';
        if( objectMeta && objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[ 1 ] ) ) {
            displayName = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].displayName;
        }
        let obj = {
            name: typeN[ 1 ],
            displayName: displayName,
            maxWidth: 375,
            minWidth: 200,
            width: 250,
            enableColumnMenu: false,
            pinnedLeft: false,
            enableColumnResizing: true,
            enableColumnMoving: true,
            isTableCommand: index === 0
        };
        columns.push( obj );
    } );
    return columns;
};

let navigateToCreateReportTemplate = ( result )=>{
    let action = { actionType: 'Navigate', navigateTo: 'createReportTemplate', navigationParams: result, options:{ inherit: false } };
    navigationSvc.navigate( action, result );
};

const getNavigationCriteria = ( searchState, nwReportsState ) => {
    const searchCriteria = searchState.criteria?.searchString ? searchState.criteria.searchString : '';
    const filter = getFilterString( searchState );
    let reportType = summaryReportType0;
    let dataProvider = defaultSummaryReportDataProvider;
    let additionalSearchCriteria = null;
    let advancedQueryUid = null;
    if( searchState.advancedSearchCriteria?.typeOfSearch === advancedSearchKey ) {
        additionalSearchCriteria = JSON.stringify( { relationsPath: JSON.stringify( { relationsPath:[ { searchMethod: advancedSearchKey, objectType: 'ALL', additionalTraversalCriteria: searchState.advancedSearchCriteria } ] } ) } );
        dataProvider = defaultItemReportDataProvider;
        reportType = summaryReportType0;
        advancedQueryUid = searchState.savedQuery?.value;
        //update additionalSearchCriteria for new report
        if( nwReportsState ) {
            if( !nwReportsState.reportParameters.ReportDefProps ) {
                nwReportsState.reportParameters.ReportDefProps = { ReportSearchInfo: {} };
            } else if( !nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo ) {
                nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {};
            }
            //delete searchInfo for recreation of new searchInfo
            delete nwReportsState.searchInfo;
            nwReportsState.selectedAdvanedQuery = cdm.getObject( advancedQueryUid );
            nwReportsState.initRepDisp = true;
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria = JSON.parse( additionalSearchCriteria );
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName = dataProvider;
        }
    } else if( nwReportsState ) {
        nwReportsState.reportParameters?.ReportDefProps?.ReportSearchInfo?.dataProviderName && delete nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName;
        delete nwReportsState.selectedAdvanedQuery;
    }
    return {
        searchCriteria,
        filter,
        reportType,
        dataProvider,
        additionalSearchCriteria,
        advancedQueryUid
    };
};

export let saveConfiguredSearchAction = ( searchState, reportsState, selected, i18n ) =>{
    let nwReportsState = reportsState.getValue();
    if( appCtxService.ctx.state.params.reportType === summaryReportType0 ) {
        if( appCtxService.ctx.state.params.reportId ) {
            updateReportSearchInfo( searchState, nwReportsState );
        } else {
            const { searchCriteria, filter, reportType, dataProvider, additionalSearchCriteria, advancedQueryUid } = getNavigationCriteria( searchState, nwReportsState );
            navigateToCreateReportTemplate( {
                searchCriteria: searchCriteria,
                filter: filter,
                previewMode: appCtxService.ctx.state.params.previewMode,
                reportType,
                dataProvider,
                additionalSearchCriteria,
                advancedQueryUid
            } );
        }
    } else {
        updateSourceObject( selected, nwReportsState, i18n );
        confgItemRepSrvc.updateSegmentTree( nwReportsState );
        if( appCtxService.ctx.state.params.reportId ) {
            nwReportsState.segmentTree[0].children.length > 0 ? nwReportsState.editRelationCommand = 'true' : '';
            nwReportsState.initRepDisp = true;
        } else {
            navigateToCreateReportTemplate( { searchCriteria: getSearchCriteriaForItemReport( selected.uid ),
                previewMode:appCtxService.ctx.state.params.previewMode,
                reportType: appCtxService.ctx.state.params.reportType,
                dataProvider: appCtxService.ctx.state.params.dataProvider,
                additionalSearchCriteria: appCtxService.ctx.state.params.additionalSearchCriteria } );
        }
    }
    reportsState.update( nwReportsState );
};

export const cancelReportTemplate = ( reportsState )=>{
    var nwReportsState = reportsState.getValue();
    awActiveReportViewerSrvc.rebuildReportProps( nwReportsState.selectedReport, nwReportsState );
    if( nwReportsState.rootClassSampleObject[0].uid !== nwReportsState.reportParameters.ReportDefProps.ReportClassParameters.rootSampleUid ) {
        nwReportsState.segmentTree = [];
        nwReportsState.rootClassSampleObject = [];
    }else{
        confgItemRepSrvc.updateSegmentTree( nwReportsState );
        nwReportsState.segmentTree[0].children.length > 0 ? nwReportsState.editRelationCommand = 'true' : '';
    }
    reportsState.update( nwReportsState );
};

export const cleanupSaveTemplatePopup = ( reportsState, value, previewMode, params ) => {
    var reportId = appCtxService.ctx.state.params.reportId;
    const { selectedReport } = reportsState.getValue();
    if( !reportId && !selectedReport ) {
        addObjectUtils.updateAtomicDataValue( reportsState, value );
        getEscapedUrlParameters( previewMode, params );
    }
};

export const addCustomCriteriaChip = function( chipArray, chipObject, searchCriteriaKey, searchCriteriaValue ) {
    const nwSearchCriteriaKey = { ...searchCriteriaKey };
    const nwSearchCriteriaValue = { ...searchCriteriaValue };
    if( searchCriteriaKey && searchCriteriaValue && searchCriteriaKey.dbValue?.trim() !== '' ) {
        let chipName = `${searchCriteriaKey.dbValue}: ${searchCriteriaValue.dbValue}`;
        chipObject[searchCriteriaKey.dbValue] = searchCriteriaValue.dbValue;
        //avoid adding duplicated filter name
        if( chipName && chipName.trim() !== '' && _.find( chipArray, { labelDisplayName: chipName } ) === undefined ) {
            var filterChip = {
                chipType: 'BUTTON',
                uiIconId: 'miscRemoveBreadcrumb',
                labelDisplayName: chipName,
                labelInternalName: searchCriteriaKey.dbValue
            };
            chipArray.push( filterChip );

            //clear the input box
            nwSearchCriteriaKey.dbValue = '';
            nwSearchCriteriaKey.uiValue = '';
            nwSearchCriteriaValue.dbValue = '';
            nwSearchCriteriaValue.uiValue = '';
        }
    }
    return { CriteriaChips: [ ...chipArray ], CriteriaObject: { ...chipObject }, searchCriteriaKey: nwSearchCriteriaKey, searchCriteriaValue: nwSearchCriteriaValue };
};

export const getSearchCriteriaChips = function( additionalSearchCriteria ) {
    let chipArray = [];
    let chipObject = {};
    if( additionalSearchCriteria ) {
        _.forEach( additionalSearchCriteria, ( value, key ) => {
            chipObject[key] = value;
            var filterChip = {
                chipType: 'BUTTON',
                uiIconId: 'miscRemoveBreadcrumb',
                labelDisplayName: `${key}: ${value}`,
                labelInternalName: key
            };
            chipArray.push( filterChip );
        } );
    }
    return { CriteriaChips:[ ...chipArray ], CriteriaObject:{ ...chipObject } };
};

export const removeCustomCriteriaChip = function( chipArray, chipObject, chipToRemove ) {
    if( chipToRemove ) {
        chipArray = [ ..._.pullAllBy( chipArray, [ { labelDisplayName: chipToRemove.labelDisplayName } ], 'labelDisplayName' ) ];
    }
    delete chipObject[chipToRemove.labelInternalName];
    return { CriteriaChips:[ ...chipArray ], CriteriaObject:{ ...chipObject } };
};

export const previewChipForCutomSearch = ( chip, searchCriteriaKey, searchCriteriaValue ) =>{
    const nwSearchCriteriaKey = { ...searchCriteriaKey };
    const nwSearchCriteriaValue = { ...searchCriteriaValue };
    if( chip?.labelDisplayName ) {
        const chipValues = chip.labelDisplayName.split( ':' );
        nwSearchCriteriaKey.dbValue = chipValues[0].trim();
        nwSearchCriteriaKey.uiValue = chipValues[0].trim();
        nwSearchCriteriaValue.dbValue = chipValues[1].trim();
        nwSearchCriteriaValue.uiValue = chipValues[1].trim();
    }
    return { searchCriteriaKey: nwSearchCriteriaKey, searchCriteriaValue: nwSearchCriteriaValue };
};

export const saveCustomSearchCriteria = ( reportsState, dataProviderName, chipsObject ) => {
    if( !appCtxService.ctx.state.params.reportId ) {
        navigateToCreateReportTemplate( { searchCriteria: '',
            filter: '',
            previewMode: appCtxService.ctx.state.params.previewMode,
            reportType: summaryReportType0, dataProvider: dataProviderName, additionalSearchCriteria: JSON.stringify( chipsObject ) } );
    }
    const nwReportsState = reportsState.getValue();
    if( !nwReportsState.reportParameters.ReportDefProps ) {
        nwReportsState.reportParameters.ReportDefProps = { ReportSearchInfo:{ } };
    }else if( !nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo ) {
        nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = { };
    }
    delete nwReportsState.selectedAdvanedQuery;
    nwReportsState.initRepDisp = true;
    nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria = chipsObject;
    nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName = dataProviderName;
    delete nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
    reportsState.update( nwReportsState );
};

export const getConfigureSearchTabs = ( i18n, reportsState ) => {
    const nwReportsState = reportsState?.getValue();
    let searchDataTabs = [ {
        tabKey: 'awKeywordSearch',
        name: i18n.results
    },
    {
        tabKey: 'awAdvancedSearch',
        name: i18n.advanced
    } ];
    if( appCtxService.ctx.state.params.reportType === summaryReportType0 ) {
        searchDataTabs.push( {
            tabKey: 'awCustomSearch',
            name: i18n.customSearch
        } );
    }
    //process the selection of search tabs
    if( appCtxService.ctx.state.params.reportId && nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.additionalSearchCriteria || appCtxService.ctx.state.params.additionalSearchCriteria ) {
        if( nwReportsState.selectedAdvanedQuery ) {
            //advanced
            searchDataTabs[1].selectedTab = true;
        } else {
            //custom
            searchDataTabs[2].selectedTab = true;
        }
    }
    return searchDataTabs;
};

export const navigateToCreateReportFromSearch = ( searchState ) => {
    const { searchCriteria, filter, reportType, dataProvider, additionalSearchCriteria, advancedQueryUid } = getNavigationCriteria( searchState );
    navigateToCreateReportTemplate( {
        searchCriteria: searchCriteria,
        filter: filter,
        previewMode: 'false',
        reportType,
        dataProvider,
        additionalSearchCriteria,
        advancedQueryUid
    } );
};

export const loadAdvancedQuery = async( queryUID, reportsState ) => {
    let deferred = awPromiseService.instance.defer();
    dmSvc.loadObjects( [ queryUID ] ).then( function() {
        dmSvc.getProperties( [ queryUID ], [ 'object_string' ] ).then( function() {
            const vmo = cdm.getObject( queryUID );
            if( vmo ) {
                const nwReportsState = reportsState.getValue();
                nwReportsState.selectedAdvanedQuery = vmo;
                reportsState.update( nwReportsState );
                deferred.resolve( vmo );
            } else {
                deferred.resolve( null );
            }
        } );
    }, function() {
        deferred.resolve( null );
    } );
    return deferred.promise;
};

/**
 * Updates the given view model property with the specified value.
 *
 * @param {Object} prop - The view model property to update.
 * @param {*} value - The new value to set for the property.
 */
function updateViewModelProperty( prop, value ) {
    if( prop ) {
        prop.dbValue = value;
        prop.uiValue = value;
        prop.value = value;
    }
}

export let getFilterStringFromActiveFilterMap = function( activeFilterMap, searchFilterMap, searchFilterCategories ) {
    var activeFilters = {};
    if( activeFilterMap ) {
        _.forEach( activeFilterMap, ( filters, index )=>{
            activeFilters[index] = [];
            _.forEach( filters, ( filter, i )=>{
                if( activeFilterMap[index][i].searchFilterType === 'StringFilter' && activeFilterMap[index][i].stringDisplayValue !== activeFilterMap[index][i].stringValue ) {
                    activeFilters[index].push( activeFilterMap[index][i].stringDisplayValue + INTERNAL_KEYWORD + filter.stringValue );
                } else {
                    activeFilters[index].push( filter.stringValue );
                }
            } );
        } );
    } else{
        activeFilters = aw_searchFilter.getFilters( false );
    }

    var displayString = '';
    _.map( activeFilters, function( value, property ) {
        var trueProperty = property.split( aw_searchFilter._dateFilterMarker )[ 0 ];
        // If it's a valid filter
        var index = _.findIndex( searchFilterCategories, function( o ) {
            return o.internalName === trueProperty;
        } );
        // Get the filter name first
        var filterName = '';
        if( index > -1 ) {
            filterName = searchFilterCategories[ index ].displayName;
        } else if( !searchFilterCategories || searchFilterCategories && searchFilterCategories.length < 1 ) {
            filterName = aw_searchFilter.getCategoryDisplayName( property );
        } else {
            return '';
        }

        // Get display name for all the filter values
        var filterValues = '';
        _.forEach( activeFilters[ property ], function( filter ) {
            let displayAndInternalValueArray = filter.split( filterPanelUtils.INTERNAL_KEYWORD );
            filter = displayAndInternalValueArray && displayAndInternalValueArray.length === 2 ? displayAndInternalValueArray[ 1 ] : filter;
            var filterValue = aw_searchFilter.getBreadCrumbDisplayValue( searchFilterMap[ property ], filterPanelUtils.getRealFilterWithNoFilterType( filter ), searchFilterMap[
                property ] );
            filterValues += filterValues === '' ? filterValue : ', ' + filterValue;
        } );
        if( filterValues !== '' ) {
            var individualFilterString = filterName + '=' + filterValues;
            displayString += displayString === '' ? individualFilterString : ', ' +
                individualFilterString;
        }
    } );
    return displayString;
};


export const updateSummaryReportTaskBar = async( reportsState, searchCriteriaValue, customCriteriaValue, filterValue )=>{
    var nwReportsState = reportsState.getValue();
    var nwSearchCriteriaValue = { ...searchCriteriaValue };
    var nwCustomCriteriaValue = { ...customCriteriaValue };
    var nwFilterValue = { ...filterValue };
    const localTextBundle = localeSvc.getLoadedText( 'ReportChartMessages' );
    if( appCtxService.ctx.state.params.reportId && nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.additionalSearchCriteria || appCtxService.ctx.state.params.additionalSearchCriteria ) {
        if( nwReportsState.selectedAdvanedQuery || nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.additionalSearchCriteria?.relationsPath &&
            awActiveReportViewerSrvc.isValidJSON( nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria.relationsPath ) &&
            JSON.parse( nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.additionalSearchCriteria.relationsPath ).relationsPath[0].searchMethod === 'ADVANCED_SEARCH' ) {
            //advanced
            nwReportsState.searchTypeChip = [ {
                iconId:'',
                chipType:'BUTTON',
                labelInternalName:'advanced',
                labelDisplayName:localTextBundle.advanced
            } ];
            if( appCtxService.ctx.state.params.reportId ) {
                await dmSvc.getProperties( [ nwReportsState.selectedAdvanedQuery.uid ], [ 'object_string' ] );
            }
            updateViewModelProperty( nwSearchCriteriaValue, nwReportsState.selectedAdvanedQuery?.props.object_string?.dbValues[0] );
        } else {
            //custom
            nwReportsState.searchTypeChip = [ {
                iconId:'',
                chipType:'BUTTON',
                labelInternalName:'custom',
                labelDisplayName:localTextBundle.customSearch
            } ];
            if( appCtxService.ctx.state.params.reportId ) {
                updateViewModelProperty( nwCustomCriteriaValue, nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.dataProviderName );
            } else{
                if( !nwReportsState.reportParameters.ReportDefProps ) {
                    nwReportsState.reportParameters.ReportDefProps = {};
                }
                nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
                    dataProviderName: appCtxService.ctx.state.params.dataProvider,
                    additionalSearchCriteria: JSON.parse( appCtxService.ctx.state.params.additionalSearchCriteria )
                };
                updateViewModelProperty( nwCustomCriteriaValue, appCtxService.ctx.state.params.dataProvider );
            }
        }
    } else{
        nwReportsState.searchTypeChip = [ {
            iconId:'',
            chipType:'BUTTON',
            labelInternalName:'results',
            labelDisplayName:localTextBundle.results
        } ];

        if( appCtxService.ctx.state.params.reportId ) {
            updateViewModelProperty( nwSearchCriteriaValue, nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.SearchCriteria );
        } else{
            updateViewModelProperty( nwSearchCriteriaValue, appCtxService.ctx.state.params.searchCriteria );
        }
        if( nwReportsState.searchInfo?.searchFilterMap && nwReportsState.searchInfo.searchFilterCategories ) {
            let filterPropValueString = getFilterStringFromActiveFilterMap(
                nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.activeFilterMap,
                nwReportsState.searchInfo.searchFilterMap,
                nwReportsState.searchInfo.searchFilterCategories );
            updateViewModelProperty( nwFilterValue, filterPropValueString );
        } else{
            updateViewModelProperty( nwFilterValue, '' );
        }
    }
    reportsState.update( nwReportsState );
    return { nwSearchCriteriaValue, nwCustomCriteriaValue, nwFilterValue };
};

const AwConfigureReportViewerService = {
    awConfigureReportViewerViewRenderFunction,
    getRootClassSampleObject,
    initializeChartList,
    getConfigureSearchCriteria,
    getSearchCriteriaForItemReport,
    getConfigureFilterString,
    getFilterString,
    initializeSearchState,
    showPreviewed,
    updateThumbnail,
    saveReportProps,
    getCreateReportDefnInput,
    updateSelectedReportAndAddToDashboard,
    getEscapedUrlParameters,
    updateChartCountAndTitle,
    updateReportInformation,
    getReportInfo,
    setReportTypeName,
    updateState,
    updateSourceObject,
    updateSourceObjectBreadcrumb,
    updateSegmentChips,
    loadSourceObject,
    getRdMetaDataInfo,
    loadColumnsForSourceObject,
    cancelReportTemplate,
    saveConfiguredSearchAction,
    cleanupSaveTemplatePopup,
    addCustomCriteriaChip,
    getSearchCriteriaChips,
    removeCustomCriteriaChip,
    previewChipForCutomSearch,
    saveCustomSearchCriteria,
    getConfigureSearchTabs,
    navigateToCreateReportFromSearch,
    loadAdvancedQuery,
    getFilterStringFromActiveFilterMap,
    updateSummaryReportTaskBar
};
export default AwConfigureReportViewerService;
