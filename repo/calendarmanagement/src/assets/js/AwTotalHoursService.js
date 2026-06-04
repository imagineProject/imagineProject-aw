// Copyright (c) 2022 Siemens

/**
 * @module js/AwTotalHoursService
 */

import _ from 'lodash';
import dateTimeSvc from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

/**
    * Load the total hours table data.
    *
    * @param {Object} totalHoursColumnProvider - the column provider
    * @param {Object} day - the selected day from working days table
    * @param {Object} totalRanges - working hours ranges or rows of total hours table
    * @param {Object} dayDisp - the selected day from working days table to be displayed above total hours table
    * @param {Object} totalHoursDisp - the duration of working hours to be displayed above total hours table
    * @param {Int} startIndex - the starting index
    * @return {Object} response returned to the viewModel
    */
export let loadTotalHrsTableData = function( totalHoursColumnProvider, day, totalRanges, dayDisp, totalHoursDisp, startIndex ) {
    var columns = totalHoursColumnProvider.columns;
    var vmRows = [];

    if( day ) {
        updatePropertyValue( dayDisp, day.displayValue );
    }

    let durationMin = 0;
    if( totalRanges ) {
        for( var rowNdx = 0; rowNdx < totalRanges.length; rowNdx++ ) {
            var columnData = totalRanges[ rowNdx ];
            durationMin += columnData.range_end - columnData.range_start;
            var vmObject = {};
            var props = {};
            _.forEach( columns, function( columnInfo, columnNdx ) {
                let from = hourMinDisplay( columnData.range_start );
                let to = hourMinDisplay( columnData.range_end );

                //obtaining dbValue in seconds for "to" time in order to perform validations on Add Hours panel while adding new ranges
                let toTime = to.split( ':' );
                let toDate = new Date( 0 );
                toDate.setHours( toTime[0] );
                toDate.setMinutes( toTime[1] );
                let toSecValue = toDate.getTime();

                if ( columnNdx === 0 ) {
                    props[ columnInfo.name ] = _createProp( columnInfo.name, from, 'STRING', columnInfo.displayName );
                    props[ columnInfo.name ].fromMinValue = columnData.range_start;
                } else {
                    props[ columnInfo.name ] = _createProp( columnInfo.name, to, 'STRING', columnInfo.displayName );
                    props[ columnInfo.name ].toMinValue = columnData.range_end;
                    props[ columnInfo.name ].toSecValue = toSecValue;
                }
            } );
            if (  columnData.range_start !== columnData.range_end ) {
                vmObject.uid = rowNdx + 1;
                vmObject.props = props;
                vmRows.push( vmObject );
            }
        }
    }

    let duration = hourMinDisplay( durationMin );
    updatePropertyValue( totalHoursDisp, duration );

    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );
    loadResult.searchResults = vmRows;
    loadResult.ranges = totalRanges;
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

/**
    * Add new working hour range(s) to the total working hours of a day
    *
    * @param {Object} timeFrom - range_start
    * @param {Object} timeTo - range_end
    * @param {Object} totalHoursDataProvider - total hours data provider
    */
export let addTotalHoursRow = function( timeFrom, timeTo, totalHoursDataProvider ) {
    var addElementResponse = {
        props: {
            from: {
                type: 'TIME',
                hasLov: false,
                isArray: false,
                displayValue: timeFrom.displayValues[ 0 ],
                uiValue: timeFrom.uiValue,
                dbValue: timeFrom.dbValue,
                fromMinValue: getTotalMinutes( timeFrom.displayValues ),
                propertyName: 'from',
                isEnabled: true
            },
            to: {
                type: 'TIME',
                hasLov: false,
                isArray: false,
                displayValue: timeTo.displayValues[ 0 ],
                uiValue: timeTo.uiValue,
                dbValue: timeTo.dbValue,
                toMinValue: getTotalMinutes( timeTo.displayValues ),
                propertyName: 'to',
                isEnabled: true
            }
        }
    };
    var vmc = totalHoursDataProvider.viewModelCollection;
    var loadedVMOs;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    if(loadedVMOs){
        addElementResponse.uid = loadedVMOs.length + 1;
        
        //Add the new row at the end of table.
        loadedVMOs.splice( loadedVMOs.length, 0, addElementResponse );
        totalHoursDataProvider.selectionModel.setSelection( addElementResponse );
        totalHoursDataProvider.update( loadedVMOs );
    }
};

/**
    * Remove working hour range(s) from the total working hours of a day
    *
    * @param {Object} totalHoursDataProvider - total hours data provider
    */
export let removeRow = function( totalHoursDataProvider ) {
    var vmc = totalHoursDataProvider.viewModelCollection;
    var loadedVMOs;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    var removedObjects = totalHoursDataProvider.getSelectedObjects();
    if( removedObjects.length > 0 ) {
        _.forEach( removedObjects, function( removedObject ) {
            _.remove( loadedVMOs, function( vmo ) {
                if( vmo.uid && removedObject.uid &&
                     vmo.uid === removedObject.uid ) {
                    return true;
                }
                return false;
            } );
        } );
        totalHoursDataProvider.update( loadedVMOs );
    }
};

/**
    * Calculate and update total working hours Duration
    *
    * @param {Object} totalHoursDataObjs - vmo of total hours table
    * @param {Object} totalHoursDisp - the duration of working hours to be displayed above total hours table
    * @param {Object} fields - fields
    * @param {Object} sharedData - sharedData
    * @param {Object} awCalendarAtomicData - isDirty flag
    */
export let updateTotalHoursDisplay = function( totalHoursDataObjs, totalHoursDisp, fields, sharedData, awCalendarAtomicData ) {
    var durations = [];
    var duration = '00:00';
    durations.push( duration );
    let updatedRanges = [];
    if( totalHoursDataObjs.length > 0 ) {
        for( var i = 0; i < totalHoursDataObjs.length; i++ ) {
            let start = totalHoursDataObjs[ i ].props.from.displayValue;
            let end = totalHoursDataObjs[ i ].props.to.displayValue;
            let range = {
                range_end: totalHoursDataObjs[ i ].props.to.toMinValue,
                range_start: totalHoursDataObjs[ i ].props.from.fromMinValue
            };
            updatedRanges.push( range );

            start = start.split( ':' );
            end = end.split( ':' );
            var startDate = new Date( 0, 0, 0, start[0], start[1], 0 );
            var endDate = new Date( 0, 0, 0, end[0], end[1], 0 );

            var diff = endDate.getTime() - startDate.getTime();
            var hours = Math.floor( diff / 1000 / 60 / 60 );
            diff -= hours * 1000 * 60 * 60;
            var minutes = Math.floor( diff / 1000 / 60 );

            // If using time pickers with 24 hours format, add the below line get exact hours
            if( hours < 0 ) {
                hours += 24;
            }

            var difference = ( hours <= 9 ? '0' : '' ) + hours + ':' + ( minutes <= 9 ? '0' : '' ) + minutes;
            durations.push( difference );
        }
        var totalMin = getTotalMinutes( durations );
        var totalDuration = hourMinDisplay( totalMin );
        updatePropertyValue( totalHoursDisp, totalDuration );
    } else if( totalHoursDataObjs.length === 0 ) {
        let resetTotalHours = '00:00';
        updatePropertyValue( totalHoursDisp, resetTotalHours );
    }
    if( fields ) {
        fields.totalHoursDisp.update( totalHoursDisp.dbValue );
        let newSharedData = {
            updatedTotalHours: totalHoursDisp,
            updatedRanges: updatedRanges
        };
        sharedData.update( { ...sharedData.value, newSharedData } );
        awCalendarAtomicData.update( { isDirty: true } );
    }
};

var getTotalMinutes = function( durations ) {
    var totalMinutes = 0;

    for( var i = 0; i < durations.length; i++ ) {
        var split = durations[ i ].split( ':' );
        var hours = parseInt( split[ 0 ] );
        var minutes = parseInt( split[ 1 ] );

        totalMinutes += minutes + hours * 60;
    }

    return totalMinutes;
};

var updatePropertyValue = function( prop, value ) {
    prop.dbValue = value;
    prop.uiValue = value;
    prop.uiValues[ 0 ] = value;
    prop.displayValue = value;
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
    * Gets selected date's details for details of the day component.
    *
    * @param {Object} dateDetails - display date
    * @param {Object} date - selected date on calendar preview details
    * @param {Object} selectedCalendarData - selected calendar data
    * @param {Object} calendarEvent - Calendar Events Information
    * @param {Object} updatedEventRanges - Array of Events created
    * @return {Object} Return selected date's day_ranges. Sunday to Saturday (0-6)
    */
export let getSelectedDateDetails = function( dateDetails, date, selectedCalendarData, calendarEvent, updatedEventRanges ) {
    let totalRanges = [];
    let dayIdx = date.dateObject.getDay();
    let defaultRanges = selectedCalendarData[dayIdx].ranges;
    let dateVal = dateTimeSvc.formatDate( date.dateObject );
    updatePropertyValue( dateDetails, dateVal );

    if ( calendarEvent.eventDateToRangeMap ) {
        for( let i in calendarEvent.eventDateToRangeMap ) {
            let eventDate = new Date( i );
            if ( dateTimeSvc.formatDate( eventDate ) === dateVal ) {
                totalRanges = [];
                for ( let idx = 0; idx < calendarEvent.eventDateToRangeMap[i].eventRangeUids.length; idx++ ) {
                    let rangeObject =  cdm.getObject( calendarEvent.eventDateToRangeMap[i].eventRangeUids[idx] );
                    let range = {
                        range_start: rangeObject.props.range_start.dbValues[0],
                        range_end: rangeObject.props.range_end.dbValues[0]
                    };
                    totalRanges.push( range );
                }
                if( calendarEvent.exceptionBucket.indexOf( i ) > -1 ) {
                    break;
                }
            }
        }
    }
    if( updatedEventRanges.dailyEventDateToRangeMap[ date.dateObject ] ) {
        totalRanges = updatedEventRanges.dailyEventDateToRangeMap[ date.dateObject ].ranges;
    }
    if( totalRanges.length === 0 ) {
        totalRanges = defaultRanges;
    }
    return {
        totalRanges: totalRanges,
        defaultRanges: defaultRanges
    };
};

/**
    * Called after radio button selection change in details of the day component.
    *
    * @param {Object} dayType - selected radio button's type, nwd- non working day, wdd- working day (default), wdc- working day (custom)
    * @param {Object} defaultRanges - default working hour ranges
    * @param {Object} exceptionDate - selected date
    * @param {Object} awCalendarAtomicData - isDirty flag
    * @param {Object} updatedEventRanges - Array of Events created
    * @return {Object} Return selected date's day_ranges
    */
export let changeSelection = function( dayType, defaultRanges, exceptionDate, awCalendarAtomicData, updatedEventRanges ) {
    let newRange = [];
    let updatedRanges = [];
    if( awCalendarAtomicData.update ) {
        awCalendarAtomicData.update( { isDirty: true } );
    }
    if( dayType === 'nwd' ) {
        newRange = [
            {
                range_end: 480,
                range_start: 480
            }
        ];
        updatedRanges = newRange;
    } else {
        updatedRanges = defaultRanges;
    }
    //setting time to 12.00 to avoid time zone difference with machine time and date picker time
    exceptionDate.dateObject.setHours( 12, 0, 0 );
    awCalendarAtomicData.update( { isDirty: true } );
    updatedEventRanges.dailyEventDateToRangeMap[ exceptionDate.dateObject ] = { ranges: updatedRanges, type: dayType };
    return updatedRanges;
};

/**
    * Update radio selection after modifying total hours and return updated total hours changes
    * @param {Object} dayType - radio button's type to be set based on modified ranges
    * @param {Object} totalRanges - total hours table ranges to be displayed
    * @param {Object} defaultRanges - default working hour ranges
    * @param {Object} updatedRanges - updated working hour ranges
    * @param {Object} fields - fields
    * @param {Object} awCalendarAtomicData - isDirty flag
    * @param {Object} updatedEventRanges - Array of Events created
    * @param {Object} exceptionDate - selected date
    * @param {Object} eventInfo - Calendar Events Information
    * @return {Object} Return selected date's updated ranges and radio button type that has to be selected
    */
export let updateRadioSelection = function( dayType, totalRanges, defaultRanges, updatedRanges, fields, awCalendarAtomicData, updatedEventRanges, exceptionDate, eventInfo ) {
    let ranges;
    if ( totalRanges ) {
        if ( updatedRanges ) {
            ranges = updatedRanges;
            awCalendarAtomicData.update( { isDirty: true } );
            //Reset shared data
            var sharedData = {};
        } else {
            ranges = totalRanges;
        }
        if( ranges && ranges.length === 0 ) {
            ranges = [ {
                range_end: 480,
                range_start: 480
            } ];
        }
        let typeValue = getRadioButtonType( ranges, defaultRanges, updatedEventRanges, eventInfo, exceptionDate );
        dayType.dbValue = typeValue;
        dayType.value = typeValue;
        //setting time to 12.00 to avoid time zone difference with machine time and date picker time
        exceptionDate.dateObject.setHours( 12, 0, 0 );
        if( fields ) {
            fields.dayType.update( typeValue );
        }
        if( dayType.dbValue === 'wdc' && updatedRanges ) {
            updatedEventRanges.dailyEventDateToRangeMap[ exceptionDate.dateObject ] = { ranges: updatedRanges, type: dayType.dbValue };
        }else if( dayType.dbValue === 'nwd'  && updatedRanges ) {
            updatedRanges = [ {
                range_end: 480,
                range_start: 480
            } ];
            updatedEventRanges.dailyEventDateToRangeMap[ exceptionDate.dateObject ] = { ranges: updatedRanges, type: dayType.dbValue };
        }
        return {
            updatedRanges: ranges,
            type: dayType,
            sharedData: sharedData
        };
    }
};

var getRadioButtonType = function( ranges, defaultRanges, updatedEventRanges, eventInfo, exceptionDate ) {
    let typeValue;
    let dateObject = new Date( exceptionDate.dateObject );
    //setting time to 12.00 to avoid time zone difference while giving input to updateCalendars soa
    dateObject.setHours( 12, 0, 0 );
    if( ranges ) {
        if( ranges.length === 1 && ranges[0].range_end === ranges[0].range_start ) {
            typeValue = 'nwd';
        } else if( JSON.stringify( ranges ) === JSON.stringify( defaultRanges ) ) {
            if( eventInfo.eventDateToRangeMap[dateObject] ) {
                typeValue = 'wdc';
            } else {
                typeValue = 'wdd';
            }
        } else {
            typeValue = 'wdc';
        }
        if( updatedEventRanges.dailyEventDateToRangeMap[dateObject] ) {
            typeValue = updatedEventRanges.dailyEventDateToRangeMap[dateObject].type;
        }
    }
    return typeValue;
};

/**
    * Update isEditable/isEnabled field of following data with custom action
    * @param {Object} dayType - radio button's type to be set based on modified ranges
    * @param {Boolean} editMode - access for editing - true/false
    * @return {Object} Return updated dayType
    */
export let updateEditMode = function( dayType, editMode ) {
    if( dayType ) {
        dayType.isEditable = editMode;
        dayType.isEnabled = editMode;
    }
    return {
        dayType: { ...dayType }
    };
};

exports = {
    loadTotalHrsTableData,
    addTotalHoursRow,
    removeRow,
    updateTotalHoursDisplay,
    getSelectedDateDetails,
    changeSelection,
    updateRadioSelection,
    updateEditMode
};

export default exports;

