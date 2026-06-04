// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1ChangeDashboardService
 */
import AwPromiseService from 'js/awPromiseService';
import awColumnSvc from 'js/awColumnService';
import searchFilterSvc from 'js/aw.searchFilter.service';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import awSearchService from 'js/awSearchService';
import filterPanelUtils from 'js/filterPanelUtils';
import cdm from 'soa/kernel/clientDataModel';

import eventBus from 'js/eventBus';

var exports = {};

var _localeTextBundle = null;

export let createPieChart = function( response, data, pieChartCategory ) {
    var keyValueDataForChart = [];
    var chartPoints = [];
    if ( response.searchFilterCategories && response.searchFilterCategories.length > 0 ) {
        //appCtxSvc.ctx.searchFilterCategories = response.searchFilterCategories;
        var chartProperty = data[pieChartCategory].defaultChartCategory;
        var chartFilterProperty = {};
        for ( var category = 0; category < response.searchFilterCategories.length; category++ ) {
            if ( response.searchFilterCategories[category].internalName === chartProperty ) {
                chartFilterProperty = response.searchFilterCategories[category];
                break;
            }
        }
        if ( chartFilterProperty.internalName === 'ChangeItemRevision.creation_date' ) {
            chartFilterProperty.internalName += '_0Z0_year';
            chartFilterProperty.displayName = 'Year';
        }
        var valuesForSeries = response.searchFilterMap[chartFilterProperty.internalName];
        //If there is only one year, then the filters for month will be populated at first place itself.
        if ( valuesForSeries.length === 0 ) {
            if ( chartFilterProperty.internalName === 'ChangeItemRevision.creation_date_0Z0_year' ) {
                chartFilterProperty.internalName += '_month';
                valuesForSeries = response.searchFilterMap[chartFilterProperty.internalName];
                chartFilterProperty.displayName = _localeTextBundle.month;
            }
            //If there is only one year and month,then filters for day will be populated.
            if ( valuesForSeries.length === 0 ) {
                if ( chartFilterProperty.internalName === 'ChangeItemRevision.creation_date_0Z0_year_month' ) {
                    chartFilterProperty.internalName = 'ChangeItemRevision.creation_date_0Z0_week';
                    valuesForSeries = response.searchFilterMap[chartFilterProperty.internalName];
                    chartFilterProperty.displayName = 'Week';
                }
            }

            if ( valuesForSeries.length === 0 ) {
                if ( chartFilterProperty.internalName === 'ChangeItemRevision.creation_date_0Z0_week' ) {
                    chartFilterProperty.internalName = 'ChangeItemRevision.creation_date_0Z0_year_month_day';
                    valuesForSeries = response.searchFilterMap[chartFilterProperty.internalName];
                    chartFilterProperty.displayName = _localeTextBundle.day;
                }
            }
        }
        var length = response.searchFilterMap[chartFilterProperty.internalName].length;
        for ( var i = 0; i < length; i++ ) {
            var value = valuesForSeries[i].stringDisplayValue;
            var index = value.indexOf( 'Revision' );
            if ( index >= 0 ) {
                valuesForSeries[i].stringDisplayValue = valuesForSeries[i].stringDisplayValue.substr( 0, index - 1 );
            }
            keyValueDataForChart.push( {
                label: valuesForSeries[i].stringDisplayValue,
                internalLabel: valuesForSeries[i].stringValue,
                value: valuesForSeries[i].count,
                name: valuesForSeries[i].stringDisplayValue,
                y: valuesForSeries[i].stringDisplayValue
            } );
        }
        chartPoints.push( {
            name: chartFilterProperty.displayName,
            keyValueDataForChart: keyValueDataForChart,
            seriesName: chartFilterProperty.displayName
        } );

        var filterDisplayName = '<b>' + chartFilterProperty.displayName + '</b>';
        data.chartProviders[pieChartCategory].title = filterDisplayName;
        data[pieChartCategory].chartBy = chartFilterProperty.internalName;
        data.chartProviders[pieChartCategory].chartPoints = chartPoints;
        return chartPoints;
    }
};

/**
 * Load the column configuration
 *
 * @param {Object} dataprovider - the data provider
 */
export let loadColumns = function( uwDataProvider ) {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [];

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'object_string',
        displayName: '...',
        typeName: 'Awb0Element',
        width: 220,
        isTableCommand: true,
        enableColumnMoving: false
    } ) );
    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );

    return deferred.promise;
};
export let clearPreviousChartFilters = function( data, currentChart ) {
    let newActiveChart = _.clone( data.activeChart );
    var initializeChart = '';
    var clearParams = {};
    if ( newActiveChart !== undefined && newActiveChart !== currentChart ) {
        clearParams = searchFilterSvc.getFilters();
        initializeChart = newActiveChart + '.create';
    }
    newActiveChart = currentChart;
    if ( initializeChart !== '' ) {
        eventBus.publish( initializeChart );
    }

    return {
        activeChart: newActiveChart,
        clearParams: clearParams


    };
};

/**
 * Update filters for pie chart to reconstruct
 *
 * @param {Object} data - an event data
 */
export let updateFilters = function( data, currentChart ) {
    var filterValue = '';

    if ( data.eventData && data.eventData.label ) {
        let dataArray = data.chartProviders[currentChart].chartPoints[0].keyValueDataForChart;
        for ( let i = 0; i < dataArray.length; i++ ) {
            if ( data.eventData.label === dataArray[i].label ) {
                data.eventData.internalLabel = dataArray[i].internalLabel;
                break;
            }
        }
        let index = data.eventData.internalLabel.indexOf( 'Revision' );
        if ( index >= 0 ) {
            data.eventData.internalLabel = data.eventData.internalLabel.substr( 0, index );
        }
        if ( ( currentChart === 'pieChartProviderType' || currentChart === 'pieChartProviderMaturity' ) && data[currentChart].chartBy === 'ChangeItemRevision.object_type' ) {
            //In case od Deviation Request, the internal name is Cm0DevRqst and from UI we are getting DeviationRequest,
            //so we need to process it to store correct filter value.
            filterValue = data.eventData.internalLabel.replace( /\s/g, '' );
            if ( filterValue === 'DeviationRequest' ) {
                filterValue = 'Cm0DevRqst';
            }
            filterValue += 'Revision';
        } else {
            filterValue = data.eventData.internalLabel;
            if ( filterValue === 'True' ) {
                filterValue = 'true';
            } else if ( filterValue === 'False' ) {
                filterValue = 'false';
            }
        }
    }
    var filterCategory = '';
    filterCategory = data[currentChart].chartBy;

    let newChartListboxPropData = _.clone( data.chartListboxPropData );
    newChartListboxPropData.provider = currentChart;
    return {
        chartListboxPropData: newChartListboxPropData,
        filterValue: filterValue,
        filterCategory: filterCategory
    };
};

let removePrefilter = function( value ) {
    if ( value && Array.isArray( value ) ) {
        // remove prefix from prefilter
        _.forEach( value, function( removePrefix, index, arr ) {
            if ( removePrefix && !removePrefix.hasOwnProperty( 'property' ) && removePrefix.trim().length !== 0 ) {
                arr[index] = arr[index].replace( 'AW_PreFilter_', '' );
            }
        } );
    }
};
export let updateSearchParams = function( panelContext ) {
    searchFilterSvc.buildSearchFilters( panelContext );
};
export let getDashboardFilterMap = function( filterMap, data ) {
    if ( data.isChartRefilter.dbValue === true ) {
        return {};
    }

    var filterMapVals = Object.keys( filterMap );
    if ( filterMapVals.indexOf( 'ChangeItemRevision.creation_date' ) !== -1 ) {
        let stringDateMap = {};
        for ( var idx = 0; idx < filterMapVals.length; idx++ ) {
            if ( filterMap[filterMapVals[idx]][0].searchFilterType !== 'DateFilter' ) {
                stringDateMap[filterMapVals[idx]] = filterMap[filterMapVals[idx]];
            }
        }
        filterMap = stringDateMap;
    }

    return filterMap;
};
export let addOrRemoveFilter = function( categories, filters, addRemoveOnly, filterType ) {
    // Get the active filters
    var newParams = searchFilterSvc.getFilters();

    _.forEach( newParams, function( value ) {
        removePrefilter( value );
    } );

    var catIndex = categories.length - 1;
    while ( catIndex >= 0 ) {
        exports.addOrRemoveStringFilter( newParams, categories[catIndex], filters[catIndex], addRemoveOnly, filterType );
        catIndex--;
    }
    return newParams;
};
/**
 * Update piechart by picking up next category filter
 *
 * @param {Object} data - an event data
 */
export let updatePieChart = function( data, searchState ) {
    let newChartProviders = _.clone( data.chartProviders );
    let searchFilterMap = searchState.searchFilterMap;
    let appliedFilters = searchState.appliedFilters;
    let searchFilterCategories = searchState.searchFilterCategories;
    if ( appliedFilters.length > 0 ) {
        var currentFilter = appliedFilters[0].name;
        var dateFilterCategories = [];
        if ( currentFilter.indexOf( 'ChangeItemRevision.creation_date' ) !== -1 ) {
            var filterYear = {};
            filterYear.internalName = 'ChangeItemRevision.creation_date_0Z0_year';
            dateFilterCategories.push( filterYear );
            var filterMonth = {};
            filterMonth.internalName = 'ChangeItemRevision.creation_date_0Z0_year_month';
            dateFilterCategories.push( filterMonth );
            var filterWeek = {};
            filterWeek.internalName = 'ChangeItemRevision.creation_date_0Z0_week';
            dateFilterCategories.push( filterWeek );
            var filterDay = {};
            filterDay.internalName = 'ChangeItemRevision.creation_date_0Z0_year_month_day';
            dateFilterCategories.push( filterDay );
        }
        var filterCategories = [];
        if ( dateFilterCategories.length > 0 ) {
            filterCategories = dateFilterCategories;
        } else {
            filterCategories = searchFilterCategories;
        }

        var found = false;
        for ( var iCatg = filterCategories.length - 1; iCatg >= 0; iCatg-- ) {
            var filterCat = filterCategories[iCatg];
            for ( var iFilter = 0; iFilter < appliedFilters.length; iFilter++ ) {
                if ( appliedFilters[iFilter].name === filterCat.internalName ) {
                    currentFilter = appliedFilters[iFilter].name;
                    found = true;
                    break;
                }
            }
            if ( found === true ) {
                break;
            }
        }
        var nextFilter = {};
        if ( data.chartListboxPropData.provider === 'pieChartProviderCreationDate' ) {
            if ( currentFilter === 'ChangeItemRevision.creation_date_0Z0_year' ) {
                nextFilter = {
                    internalName: currentFilter + '_month',
                    displayName: _localeTextBundle.month
                };
            } else if ( currentFilter === 'ChangeItemRevision.creation_date_0Z0_year_month' ) {
                nextFilter = {
                    internalName: 'ChangeItemRevision.creation_date_0Z0_week',
                    displayName: 'Week'
                };
            } else if ( currentFilter === 'ChangeItemRevision.creation_date_0Z0_week' ) {
                nextFilter = {
                    internalName: 'ChangeItemRevision.creation_date_0Z0_year_month_day',
                    displayName: _localeTextBundle.day
                };
            } else if ( currentFilter === 'ChangeItemRevision.creation_date_0Z0_year_month_day' ) {
                // _clearFilters(activeFilters);
                eventBus.publish( 'clearAllFilters', {
                    resetFilter: true
                } );
                eventBus.publish( 'pieChartProviderCreationDate.create' );
                return;
            }
        } else {
            var index = -1;
            //Find the index of the current filter so the next filter can be picked up as index+1
            for ( var n = 0; n < searchFilterCategories.length; n++ ) {
                if ( searchFilterCategories[n].internalName === currentFilter ) {
                    index = n;
                    break;
                }
            }

            //If its the last filter category, then directly create a pie chart which willl consider the first category filter
            if ( index === searchFilterCategories.length - 1 ) {
                if ( data.activeChart === 'pieChartProviderType' ) {
                    eventBus.publish( 'clearAllFilters', {
                        resetFilter: true
                    } );
                    eventBus.publish( 'pieChartProviderType.create' );
                    return;
                } else if ( data.activeChart === 'pieChartProviderMaturity' ) {
                    eventBus.publish( 'clearAllFilters', {
                        resetFilter: true
                    } );
                    eventBus.publish( 'pieChartProviderMaturity.create' );
                    return;
                }
            } else {
                nextFilter = searchFilterCategories[index + 1];
            }
        }

        var valuesForSeries = searchFilterMap[nextFilter.internalName];

        if ( nextFilter.internalName === 'ChangeItemRevision.creation_date_0Z0_year_month_day' ) {
            valuesForSeries = _getDaysInTheRange( searchFilterMap, appliedFilters );
        }
        var length = valuesForSeries.length;

        var keyValueDataForChart = [];
        var chartPoints = [];
        for ( var i = 0; i < length; i++ ) {
            //If the filter type is object_type, then 'Revision' needs to be removed from value
            //(for example:If object type Change Notice Revision,value will be Change Notice)
            var value = valuesForSeries[i].stringDisplayValue;
            var index = value.indexOf( 'Revision' );
            if ( index >= 0 ) {
                valuesForSeries[i].stringDisplayValue = valuesForSeries[i].stringDisplayValue.substr( 0, index - 1 );
            }
            keyValueDataForChart.push( {
                label: valuesForSeries[i].stringDisplayValue,
                internalLabel: valuesForSeries[i].stringValue,
                value: valuesForSeries[i].count,
                name: valuesForSeries[i].stringDisplayValue,
                y: valuesForSeries[i].stringDisplayValue
            } );
        }
        chartPoints.push( {
            name: nextFilter.displayName,
            keyValueDataForChart: keyValueDataForChart,
            seriesName: nextFilter.displayName
        } );

        var filterDisplayName = '<b>' + nextFilter.displayName + '</b>';
        newChartProviders[data.activeChart].title = filterDisplayName.fontsize( 7 );
        newChartProviders[data.activeChart].chartPoints = chartPoints;
        data[data.activeChart].chartBy = nextFilter.internalName;
        var typeChartPoint = newChartProviders.pieChartProviderType.chartPoints;
        var creationDateChartPoint = newChartProviders.pieChartProviderCreationDate.chartPoints;
        var maturityChartPoint = newChartProviders.pieChartProviderMaturity.chartPoints;
    }
    return {
        chartProviders: newChartProviders,
        pieChartProviderType_chartPoints: typeChartPoint,
        pieChartProviderCreationDate_chartPoints: creationDateChartPoint,
        pieChartProviderMaturity_chartPoints: maturityChartPoint

    };
};

/**
 * Viewer content changed
 *
 * @param {EventData} eventData - the event data
 */
export let clearAndInitializePieCharts = function() {
    eventBus.publish( 'pieChartProviderType.create' );
    eventBus.publish( 'pieChartProviderCreationDate.create' );
    eventBus.publish( 'pieChartProviderMaturity.create' );
};

export let setPieChartFilter = function( data ) {
    var addRemoveOnly;
    var newParams = {};
    if ( data.filterValue !== '' && data.filterCategory !== '' ) {
        var filterCatgs = [];
        var filterVals = [];
        filterCatgs.push( String( data.filterCategory ) );
        filterVals.push( data.filterValue );
        if ( data.clearParams ) {
            var chartClearParam = data.clearParams;
            var clearKeys = Object.keys( chartClearParam );
            if ( clearKeys.length > 0 ) {
                for ( var iKey = 0; iKey < clearKeys.length; iKey++ ) {
                    var value = chartClearParam[clearKeys[iKey]];
                    filterCatgs.push( clearKeys[iKey] );
                    filterVals.push( value[0] );
                }
            }
        }
        newParams = exports.addOrRemoveFilter( filterCatgs, filterVals, addRemoveOnly, 'StringFilter' );
    }
    return newParams;
};
export let clearAllFilters = function( appliedFilters, resetFilter ) {
    var filterParams = _clearFilters( appliedFilters );
    return {
        filterParams:filterParams,
        resetFilter:resetFilter
    };
};
export let searchBasedOnFilters = function( searchState, data ) {
    let newIsChartRefilter = _.clone( data.isChartRefilter );


    if ( data.isChartRefilter.dbValue === true && searchState.appliedFilters.length > 0 ) {
        eventBus.publish( 'clearAllFilters', {
            resetFilter: false
        } );
        return {
            isChartRefilter: newIsChartRefilter
        };
    } else if ( data.isChartRefilter.dbValue === true && searchState.appliedFilters.length === 0 ) {
        if( data.resetFilter !== undefined && data.resetFilter === true ) {
            eventBus.publish( 'initSearch' );
            data.resetFilter = false;
        }
        return {
            isChartRefilter: newIsChartRefilter
        };
    } else if ( data.isChartRefilter.dbValue === false && searchState.appliedFilters.length === 0 ) {
        exports.clearAndInitializePieCharts();
    }

    eventBus.publish( 'initSearch' );
    return {
        isChartRefilter: newIsChartRefilter
    };
};
export let setFilters = function( filterParam, data ) {
    // Update the parameters
    searchFilterSvc.setFilters( filterParam );
    var filters = Object.keys( filterParam );
    let newIsChartRefilter = _.clone( data.isChartRefilter );
    if ( filters.length === 0 ) {
        newIsChartRefilter.dbValue = true;
        return {
            isChartRefilter: newIsChartRefilter

        };
    }

    newIsChartRefilter.dbValue = false;
    return {

        isChartRefilter: newIsChartRefilter
    };
};


var _clearFilters = function( appliedFilters ) {
    var addRemoveOnly;
    var filterIndex;
    if ( appliedFilters.length === 0 ) {
        return {};
    }
    if ( appliedFilters.length > 0 ) {
        var newParams;
        var filters = appliedFilters;
        filterIndex = filters.length - 1;
        var filterNames = [];
        var filterValues = [];
        var filterType = '';
        while ( filterIndex >= 0 ) {
            var filter = filters[filterIndex];
            filterNames.push( filter.name );
            filterValues.push( filter.values[0] );
            filterType = filter.type;
            filterIndex--;
        }
        if ( filterNames.length > 0 ) {
            newParams = exports.addOrRemoveFilter( filterNames, filterValues, addRemoveOnly, filterType );
        }
        return newParams;
    }
};

/**
 * Get the days in range
 */
var _getDaysInTheRange = function( searchFilterMap, activeFilters ) {
    var startWeekValue;
    var endWeekValue;
    if ( activeFilters.length > 0 ) {
        var filters = activeFilters;
        for ( var filterIndex = 0; filterIndex < filters.length; filterIndex++ ) {
            var filter = filters[filterIndex];
            if ( filter.name === 'ChangeItemRevision.creation_date_0Z0_week' ) {
                startWeekValue = searchFilterMap['ChangeItemRevision.creation_date_0Z0_week'][0].startDateValue;
                endWeekValue = searchFilterMap['ChangeItemRevision.creation_date_0Z0_week'][0].endDateValue;
            }
        }
    }

    var days = searchFilterMap['ChangeItemRevision.creation_date_0Z0_year_month_day'];
    var daysInRange = [];
    for ( var day = 0; day < days.length; day++ ) {
        if ( days[day].startDateValue >= startWeekValue && days[day].endDateValue <= endWeekValue ) {
            daysInRange.push( days[day] );
        }
    }
    return daysInRange;
};


/**
 * Add or remove a string filter from the newParams object. Not pure, modifies newParams.
 *
 * @param {Object} newParams - Parameter object to modify
 * @param {String} category - Internal name of the category
 * @param {String} filter - Filter value. Pass null to clear all options for category.
 * @param {Boolean} addRemoveOnly - True/false to only add/remove. Undefined will have no
 *            effect.
 * @param {String} filterType - filterType
 */
export let addOrRemoveStringFilter = function( newParams, category, filter, addRemoveOnly, filterType ) {
    // If we are removing a specific filter
    if( filter ) {
        var prefixedFilter = filter;
        // Try to find the filter in the current filters for that category
        if( filterType === 'NumericFilter' && !_.startsWith( filter, filterPanelUtils.INTERNAL_NUMERIC_FILTER ) ) {
            prefixedFilter = filterPanelUtils.INTERNAL_NUMERIC_FILTER.concat( filter );
        }
        // If the category already exists in the parameters
        if( newParams[ category ] ) {
            var idx = newParams[ category ].indexOf( prefixedFilter );
            if( idx === -1 ) {
                idx = exports.processAddOrRemoveWithFilterNotPresent( idx, prefixedFilter, category, newParams );
            }
            // If it is in the list
            if( idx !== -1 ) {
                newParams = exports.processAddOrRemoveWithFilterPresent( idx, category, addRemoveOnly, newParams );
            } else { // If it is not in the list
                // there can only be one date range/numeric filter
                if( _.startsWith( prefixedFilter, filterPanelUtils.INTERNAL_DATE_FILTER ) ) {
                    delete newParams[ category ];
                    newParams[ category ] = [];
                } else if( _.startsWith( prefixedFilter, filterPanelUtils.INTERNAL_NUMERIC_RANGE ) ) {
                    var index = _.findIndex( newParams[ category ], function( o ) {
                        return _.startsWith( o, filterPanelUtils.INTERNAL_NUMERIC_RANGE );
                    } );

                    if( index > -1 ) {
                        // Remove range from list of values
                        newParams[ category ].splice( index, 1 );
                    }
                }
                // And we are not only removing parameters
                if( addRemoveOnly !== false ) {
                    // Add it
                    newParams[ category ].push( prefixedFilter );
                }
            }
        } else { // If the category does not exist in the parameters create it and add the filter
            // Unless told to only remove parameters
            if( addRemoveOnly !== false ) {
                newParams[ category ] = [ prefixedFilter ];
            }
        }
    } else {
        // If we are removing a whole category (cannot add without filter value)
        // If the category exists and we are not only adding parameters
        exports.processAddOrRemoveWithNoFilterValue( category, addRemoveOnly, newParams );
    }
};

/**
 * Process string filter from the newParams object. Not pure, modifies newParams.
 *
 * @param {Integer} idx - The index of prefixed filter
 * @param {String} prefixedFilter - Filter value. Pass null to clear all options for category
 * @param {String} category - Internal name of the category.
 * @param {Object} newParams - Parameter object to modify
 * @return {Integer} idx - The index of the filter
 */
export let processAddOrRemoveWithFilterNotPresent = function( idx, prefixedFilter, category, newParams ) {
    // to handle the special case of prefilter "$ME".
    var me = cdm.getUserSession().props.user.uiValues[ 0 ];
    if( me.replace( /\s/g, '' ) === prefixedFilter.replace( /\s/g, '' ) ) {
        idx = newParams[ category ].indexOf( '$ME' );
    }

    return idx;
};

/**
 * Process string filter from the newParams object. Not pure, modifies newParams.
 *
 * @param {Integer} idx - The index of prefixed filter
 * @param {String} category - Internal name of the category
 * @param {Boolean} addRemoveOnly - True/false to only add/remove. Undefined will have no
 *            effect.
 * @param {Object} newParams - Parameter object to modify
 * @return {Object} newParams - Modified Parameters
 */
export let processAddOrRemoveWithFilterPresent = function( idx, category, addRemoveOnly, newParams ) {
    // And we are not only adding parameters
    if( addRemoveOnly !== true ) {
        // Remove the filter
        newParams[ category ].splice( idx, 1 );
        // If the category is not empty delete it
        if( newParams[ category ].length === 0 ) {
            delete newParams[ category ];
        }
    }

    return newParams;
};
/**
 * Process string filter from the newParams object. Not pure, modifies newParams.
 *
 * @param {String} category - Internal name of the category
 * @param {Boolean} addRemoveOnly - True/false to only add/remove. Undefined will have no
 *            effect.
 * @param {Object} newParams - Parameter object to modify
 */
export let processAddOrRemoveWithNoFilterValue = function( category, addRemoveOnly, newParams ) {
    if( newParams[ category ] && addRemoveOnly !== true ) {
        // Delete the category
        delete newParams[ category ];
    }

    // The category may be a date filter (with additional child filters)
    for( var i in newParams ) {
        // So check if any remaining categories are that category with the date filter delimiter
        // If they are and we are not only adding parameters
        if( i.indexOf( exports._dateFilterMarker ) !== -1 &&
            i.split( exports._dateFilterMarker )[ 0 ] === category && addRemoveOnly !== true ) {
            // Remove them
            delete newParams[ i ];
        }
    }
};

export let processOutput = ( data, dataCtxNode, searchData ) => {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};
_localeTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
export default exports = {
    createPieChart,
    loadColumns,
    updateFilters,
    updatePieChart,
    clearAndInitializePieCharts,
    clearAllFilters,
    addOrRemoveFilter,
    updateSearchParams,
    searchBasedOnFilters,
    setFilters,
    getDashboardFilterMap,
    processOutput,
    setPieChartFilter,
    clearPreviousChartFilters,
    addOrRemoveStringFilter,
    processAddOrRemoveWithNoFilterValue,
    processAddOrRemoveWithFilterPresent,
    processAddOrRemoveWithFilterNotPresent
};
