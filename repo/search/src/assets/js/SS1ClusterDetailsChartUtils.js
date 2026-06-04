// Copyright (c) 2024 Siemens

/**
 * @module js/SS1ClusterDetailsChartUtils
 * JS file to supply data for cluster properties charts
 */

import appCtxService from 'js/appCtxService';

var exports = {};

var keyValueDataForChart = [];
var arrayOfSeriesDataForChart = [];

/**
 * Creates Pie Chart
 *
 * @param {String} data the view model data
 */

export let createPieChart = function( currentPropToRender, searchResults ) {
    arrayOfSeriesDataForChart = [];
    keyValueDataForChart = [ ];

    // Iterate over searchResults and extract the current Prop value.
    for( var i = 0; i < searchResults?.length; i++ ) {
        var searchResult = searchResults[ i ];
        // Get the prop value for currentProp in searchResult.
        var propValue = searchResult.props[currentPropToRender].uiValue;
        let existingProp = keyValueDataForChart.find( item => item.label === propValue );
        if ( existingProp ) {
            existingProp.value++;
            existingProp.y++;
        } else {
            keyValueDataForChart.push( {
                label: propValue,
                value: 1,
                name: propValue,
                y: 1
            } );
        }
    }

    if( keyValueDataForChart.length > 0 ) {
        arrayOfSeriesDataForChart.push( {
            name: searchResults[0].props[currentPropToRender].propertyDisplayName,
            keyValueDataForChart: keyValueDataForChart
        } );
    }
    return arrayOfSeriesDataForChart;
};

export let loadGraphs = function( ) {
    let propsForGraph;
    // Read the preference to extract props for charting.
    let preferences = appCtxService.getCtx( 'preferences' );
    if( preferences.SS1_Identity_report_graph_properties !== undefined ) {
        // Get the values from 'SS1_Identity_report_graph_properties' preference.
        propsForGraph = preferences.SS1_Identity_report_graph_properties;
    }

    return propsForGraph;
};

export let buildChartTitle = function( currentPropToRender, searchResults ) {
    let chartTitle = '';
    if( searchResults?.length > 0 ) {
        chartTitle = searchResults[0].props[currentPropToRender].propertyDisplayName;
    }
    return chartTitle;
};

export default exports = {
    loadGraphs,
    createPieChart,
    buildChartTitle
};
