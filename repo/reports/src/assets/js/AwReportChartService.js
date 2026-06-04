import AwChart from 'viewmodel/AwChartViewModel';
import reportsCommSrvc from 'js/reportsCommonService';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import { ExistWhen } from 'js/hocCollection';

const AwChartExistWhen = ExistWhen( AwChart );

export const awReportChartServiceRenderFunction = ( props ) => {
    let { viewModel, ...prop } = props;
    let { data } = viewModel;
    return (
        <AwChartExistWhen
            className={prop.className}
            chartProvider={data.chartProviders.genericChart}
            chartPoints={data.genericChart_chartPoints}
            existWhen={props.chartConfig.ChartPropInternalName !== '' }
            name= {'ChartSection' + props.subPanelContext.id}
            id= {'ChartSection' + props.subPanelContext.id}
        />
    );
};

export let applyChartFilter = ( filterValue, filterProperty, data, subPnlCtx, filterChips ) => {
    var searchFiltCat = subPnlCtx.reportsState.searchInfo.categories;
    var filterPropertyInternalName = null;
    if( data.chartProviders.genericChart.seriesInternalName &&  data.chartProviders.genericChart.seriesInternalName !== '' ) {
        filterPropertyInternalName = data.chartProviders.genericChart.seriesInternalName;
    }
    if( searchFiltCat && searchFiltCat.length !== 0 && data.chartProviders.genericChart.seriesPropName === filterProperty ) {
        _.every( searchFiltCat, function( filter ) {
            // Compare if property display name is matching and if not then try to match the internal name
            if( ( filter.displayName === filterProperty ||
                 filterPropertyInternalName && filter.internalName === filterPropertyInternalName ) &&
                 !( subPnlCtx.reportsState.runtimeInfo.appliedFilters && ( subPnlCtx.reportsState.runtimeInfo.appliedFilters[filterPropertyInternalName] || subPnlCtx.reportsState.runtimeInfo.appliedFilters[filterPropertyInternalName + '_0Z0_year_month_day'] ) ) ) {
                _.every( filter.filterValues, function( filterVals ) {
                    if( filterVals.name === filterValue ) {
                        var selectedFilter = {};
                        if( filter.type === 'NumericFilter' ) {
                            selectedFilter = { searchFilterType: 'NumericFilter', stringDisplayValue: filterVals.name, stringValue: filterVals.internalName, startNumericValue: filterVals.startNumericValue,
                                endNumericValue: filterVals.endNumericValue };
                        } else {
                            selectedFilter = { searchFilterType: 'StringFilter', stringDisplayValue: filterVals.name, stringValue: filterVals.internalName };
                        }
                        //filter prepared, update reportState, so that viewer initiates performSearch with additional new filter.
                        var currentFilter = [];
                        var nwReportState = subPnlCtx.reportsState.getValue();
                        nwReportState.initRepDisp = true;
                        currentFilter.push( selectedFilter );

                        var appliedFilters = nwReportState.runtimeInfo.appliedFilters ? nwReportState.runtimeInfo.appliedFilters : {};
                        appliedFilters[ filterVals.categoryName ] = currentFilter;
                        nwReportState.runtimeInfo.appliedFilters = appliedFilters;
                        nwReportState.runtimeInfo.appliedFilterString = JSON.stringify( appliedFilters ).toString();

                        //set filterChip value
                        let filterChip = {
                            uiIconId: 'miscRemoveBreadcrumb',
                            chipType: 'BUTTON',
                            labelDisplayName: filter.displayName + ': ' + filterVals.name,
                            labelInternalName: filterVals.categoryName
                        };
                        filterChips.push( filterChip );
                        subPnlCtx.reportsState.update( nwReportState );
                        return false;
                    }
                    return true;
                } );
                return false;
            }
            return true;
        } );
    }
};

export let getReportChartConfiguration = function( repChartConfig, subPanelCtx ) {
    try {
        const filterCategories = subPanelCtx.reportsState.searchInfo.categories;
        const saveSearchFilterMap = subPanelCtx.reportsState.searchIncontextInfo?.saveSearchFilterMap;
        const filterMap = subPanelCtx.reportsState.searchInfo.searchFilterMap;
        var chartPoints = reportsCommSrvc.processSearchDataAndGetChartPoints( saveSearchFilterMap, filterCategories, filterMap, repChartConfig );
        var internalName = Array.isArray( repChartConfig.ChartPropInternalName ) ? repChartConfig.ChartPropInternalName[ 0 ] : repChartConfig.ChartPropInternalName;
        const seriesPropName = reportsCommSrvc.getLocalisedNameOfChartOn( repChartConfig.ChartPropName, internalName, filterCategories );
        let chartTitle = repChartConfig.ChartTitle;
        // assigning chart property name to chart title as if preference is set
        if( appCtxService.ctx.preferences?.REPORT_Hide_NonLocalizable_Title && appCtxService.ctx.preferences.REPORT_Hide_NonLocalizable_Title[0] === 'true' ) {
            chartTitle = seriesPropName;
        }
        return {
            chartName: 'genericChart',
            chartPoints: chartPoints,
            chartTitle: chartTitle,
            chartType: repChartConfig.ChartTpIntName !== undefined ? repChartConfig.ChartTpIntName : repChartConfig.ChartType.toLowerCase(),
            seriesInternalName: internalName,
            seriesPropName: seriesPropName,
            dataIsReadyChartGen: true,
            chartNoData: chartPoints.length === 0
        };
    } catch ( error ) {
        console.log( 'Failure occurred in Chart for ' + repChartConfig );
    }
};

const AwReportChartService = {
    awReportChartServiceRenderFunction,
    applyChartFilter,
    getReportChartConfiguration
};
export default AwReportChartService;
