// Copyright (c) 2022 Siemens

/**
 * @module js/AwWorkingDaysService
 */

import _ from 'lodash';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

/**
    * Load the working days table data.
    *
    * @param {Object} workingHoursColumnProvider - the column provider
    * @param {Int} startIndex - the starting index
    * @param {Object} selectedCalendarData - selected calendar data
    * @return {Object} response returned to the viewModel
    */
export let loadWorkingHoursTableData = function( workingHoursColumnProvider, startIndex, selectedCalendarData ) {
    var columns = workingHoursColumnProvider.columns;
    var vmRows = [];
    var rowNdx;

    if( selectedCalendarData ) {
        for ( rowNdx in selectedCalendarData ) {
            var columnData = selectedCalendarData[ rowNdx ];
            var vmObject = {};
            var props = {};
            let totalRanges = [];
            _.forEach( columns, function( columnInfo, columnNdx ) {
                if( columnNdx === 1 ) {
                    if( columnData.ranges.length > 0 ) {
                        let durationMin = 0;
                        for( var i = 0; i < columnData.ranges.length; i++ ) {
                            durationMin += columnData.ranges[ i ].range_end - columnData.ranges[ i ].range_start;

                            let rangeObj = {
                                range_end: columnData.ranges[ i ].range_end,
                                range_start: columnData.ranges[ i ].range_start
                            };
                            totalRanges.push( rangeObj );
                        }
                        let duration = hourMinDisplay( durationMin );

                        props[ columnInfo.name ] = _createProp( columnInfo.name, duration, 'STRING', columnInfo.displayName );
                    }
                } else {
                    props[ columnInfo.name ] = _createProp( columnInfo.name, columnData.day, 'STRING', columnInfo.displayName );
                }
            } );
            vmObject.uid = parseInt( rowNdx ) + 1;
            vmObject.props = props;
            vmObject.props.totalRanges = totalRanges;
            vmRows.push( vmObject );
        }
    }

    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );
    loadResult.searchResults = vmRows;
    loadResult.searchIndex = startIndex + 1;
    loadResult.totalFound = vmRows.length;

    return loadResult;
};

var _createProp = function( propName, propValue, type, propDisplayName ) {
    return {
        type: type,
        hasLov: false,
        isArray: false,
        displayValue: propValue,
        uiValue: propValue,
        value: propValue,
        propertyName: propName,
        propertyDisplayName: propDisplayName,
        isEnabled: true
    };
};

var hourMinDisplay = function( totalMin ) {
    let hours = Math.floor( totalMin / 60 );
    totalMin -= hours * 60;
    hours = hours.toString();
    let minutes = totalMin.toString();
    while( hours.length < 2 ) {
        hours = '0' + hours;
    }
    while( minutes.length < 2 ) {
        minutes = '0' + minutes;
    }
    return hours + ':' + minutes;
};

/**
    * Update working hours data after modifying total hours range
    *
    * @param {Object} workingHoursDataProvider - working hours data provider
    * @param {Object} updatedTotalHours - updated duration of working hours in total hours table
    * @param {Object} updatedRanges - updated working hour ranges in total hours table
    */
export let updateWorkingHoursDataProvider = function( workingHoursDataProvider, updatedTotalHours, updatedRanges ) {
    var loadedVMOs = workingHoursDataProvider.viewModelCollection.loadedVMObjects;
    var index = workingHoursDataProvider.selectedObjects[0].uid - 1;
    loadedVMOs[ index ].props.totalHours.displayValue = updatedTotalHours.displayValue;
    loadedVMOs[ index ].props.totalHours.uiValue = updatedTotalHours.uiValue;
    loadedVMOs[ index ].props.totalHours.value = updatedTotalHours.value;
    loadedVMOs[ index ].props.totalRanges = updatedRanges;
    workingHoursDataProvider.update( loadedVMOs );
};

/**
    * Update working hours data after save
    *
    * @param {Object} updatedHoursDataProvider - working hours data provider
    * @param {Object} workingHoursDataProvider - updated duration of working hours in total hours table
    */
export let updateParentDefaultWorkingHours = function( updatedHoursDataProvider, workingHoursDataProvider ) {
    let newWorkingHoursDataProvider = updatedHoursDataProvider;
    workingHoursDataProvider.update( { ...workingHoursDataProvider.value, newWorkingHoursDataProvider } );
};

/**
    * Gets selected date's details for details of the day component.
    * @param {Object} workingHoursDataProvider - table data provider
    * @param {Object} date - selected date on calendar preview details
    */
export let setSelection = function( workingHoursDataProvider, date ) {
    let selectedDay = date.dateObject.getDay();
    let selectedVMO = workingHoursDataProvider.viewModelCollection.loadedVMObjects[ selectedDay ];
    if( selectedVMO ) {
        workingHoursDataProvider.selectionModel.setSelection( selectedVMO );
    }
};

exports = {
    loadWorkingHoursTableData,
    updateWorkingHoursDataProvider,
    updateParentDefaultWorkingHours,
    setSelection
};

export default exports;

