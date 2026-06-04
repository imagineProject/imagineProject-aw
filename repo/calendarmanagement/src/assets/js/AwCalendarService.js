// Copyright (c) 2022 Siemens

/**
 * @module js/AwCalendarService
 */

import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import _ from 'lodash';

var exports = {};

/**
  * create Day Details Prop
  * @param {Object} selectedCalendar - data as per calendar selection
  * @param {Object} i18n - days as per week
  * @param {Object} updatedDefaultRanges - updated ranges if any to reset while cancelling edits
  * @param {Object} calendarName - display calendar name
  * @param {Object} calendarTimeZone - display time zone
  * @param {Object} baseCalendar - display base calendar
  * @param {Object} previousCalendarName - original calendar name
  * @param {Object} previousTimeZone - original time zone
  * @param {Object} previousBaseCalendar - original time zone
  * @return {Object} Return all day data
  */
export let createDayDetailsProp = function( selectedCalendar, i18n, updatedDefaultRanges, calendarName, calendarTimeZone, baseCalendar, previousCalendarName, previousTimeZone, previousBaseCalendar ) {
    let ranges = createDayRangeArray( selectedCalendar );
    let weekDays = getWeekDays( i18n );
    let dayData = {};
    let nonWorkingDays = [];
    let key;
    for( key in weekDays ) {
        let dayObj = {
            day: weekDays[ key ],
            ranges: ranges[ key ]
        };
        dayData[ key ] = dayObj;
    }

    //Reset calendar name and time zone display when unsaved changes
    if( updatedDefaultRanges.newUpdatedRanges ) {
        updatedDefaultRanges = {};
    }
    calendarName.dbValue = previousCalendarName.dbValues[ 0 ];
    calendarName.uiValue = previousCalendarName.uiValues[ 0 ];
    calendarName.displayValues[ 0 ] = previousCalendarName.uiValues[ 0 ];
    calendarTimeZone.dbValue = previousTimeZone.dbValues[ 0 ];
    calendarTimeZone.uiValue = previousTimeZone.uiValues[ 0 ];
    calendarTimeZone.displayValues[ 0 ] = previousTimeZone.uiValues[ 0 ];
    if( previousBaseCalendar ) {
        baseCalendar.dbValue = previousBaseCalendar.dbValues[ 0 ];
        baseCalendar.uiValue = previousBaseCalendar.uiValues[ 0 ];
        baseCalendar.displayValues[ 0 ] = previousBaseCalendar.uiValues[ 0 ];
    }

    return {
        dayData: dayData,
        updatedDefaultRanges: updatedDefaultRanges,
        nonWorkingDays: nonWorkingDays,
        calendarName: { ...calendarName },
        calendarTimeZone: { ...calendarTimeZone },
        baseCalendar: { ...baseCalendar }
    };
};

var createDayRangeArray = function( selectedCalendar ) {
    let dayRanges = [];
    let rangesObject = [];
    let ranges = [];
    dayRanges.push( selectedCalendar.sun_ranges );
    dayRanges.push( selectedCalendar.mon_ranges );
    dayRanges.push( selectedCalendar.tue_ranges );
    dayRanges.push( selectedCalendar.wed_ranges );
    dayRanges.push( selectedCalendar.thu_ranges );
    dayRanges.push( selectedCalendar.fri_ranges );
    dayRanges.push( selectedCalendar.sat_ranges );

    for( var i = 0; i < dayRanges.length; i++ ) {
        var day_ranges = [];
        for( var j = 0; j < dayRanges[ i ].dbValues.length; j++ ) {
            rangesObject = cdm.getObject( dayRanges[ i ].dbValues[ j ] );
            let day_range = {
                range_end: rangesObject.props.range_end.dbValues[ 0 ],
                range_start: rangesObject.props.range_start.dbValues[ 0 ]
            };
            day_ranges.push( day_range );
        }
        ranges.push( day_ranges );
    }
    return ranges;
};

var getWeekDays = function( i18n ) {
    var days = [];

    days.push( i18n.awDay_Sunday );
    days.push( i18n.awDay_Monday );
    days.push( i18n.awDay_Tuesday );
    days.push( i18n.awDay_Wednesday );
    days.push( i18n.awDay_Thursday );
    days.push( i18n.awDay_Friday );
    days.push( i18n.awDay_Saturday );

    return days;
};

/**
  * This method is used to get today's date that has to be selected on date picker.
  * @param {Object} datePickerInfo - event details if present
  * @returns {Object} today's date.
  */
export let getCurrentDate = function( datePickerInfo ) {
    let now = new Date();
    //get the current month
    let month = now.getMonth();
    //get the year
    let year = now.getFullYear();
    // first day of month
    let fromDate = new Date( year, month, 1 );
    // last day of month
    let toDate = new Date( year, month + 1, 1 );
    let fromDateToString = dateTimeSvc.formatUTC( fromDate );
    let toDateToString = dateTimeSvc.formatUTC( toDate );
    const newDatePickerInfo = { ...datePickerInfo };
    newDatePickerInfo.currentMonth = month + 1;
    newDatePickerInfo.currentYear = year;
    newDatePickerInfo.fromDate = fromDateToString;
    newDatePickerInfo.toDate = toDateToString;

    return {
        todayDate: now,
        datePickerInfo: newDatePickerInfo
    };
};

/**
  * This method is used to get the LOV values of timezone.
  * @param {Object} response the response of the getLov soa
  * @returns {Object} value the LOV value
  */
export let getTimezoneList = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[ 0 ] : obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};

/**
  * Get default non-working days for updating non-working day on date picker
  * @param {Object} updatedDefaultRanges - updated default ranges
  * @return {Object} list of index of non-working days
  */
export let getNonWorkingDays = function( updatedDefaultRanges ) {
    let nonWorkingDays = [];
    if( updatedDefaultRanges ) {
        for( let i in updatedDefaultRanges ) {
            let rangesLength = updatedDefaultRanges[ i ].props.totalRanges.length;
            if( rangesLength === 0 || rangesLength === 1 && updatedDefaultRanges[ i ].props.totalRanges[ 0 ].range_end === updatedDefaultRanges[ i ].props.totalRanges[ 0 ].range_start ) {
                nonWorkingDays.push( parseInt( i ) );
            }
        }
    }
    return nonWorkingDays;
};

/**
  * Update the changes made in working ranges on calendar parent
  * @param {Object} newUpdatedRanges - new updated ranges to be updated on parent
  * @param {Object} updatedDefaultRanges - updated default days ranges
  */
export let updateCalendarParent = function( newUpdatedRanges, updatedDefaultRanges ) {
    updatedDefaultRanges.update( { ...updatedDefaultRanges.value, newUpdatedRanges } );
};

/**
  * Update updateCalendar View after soa call
  * @param {Object} dayData - user access
  * @param {Object} updatedDefaultRanges - updated default day ranges
  * @param {Object} awCalendarAtomicData - isDirty flag
  * @param {Object} calendarName - calendar name
  * @param {Object} calendarTimeZone - calendar time zone
  * @param {Object} baseCalendar - base calendar
  * @param {Object} updatedEventRanges - updated exceptions/events
  * @return {Object} viw of calendar
  */
export let updateCalendarView = function( dayData, updatedDefaultRanges, awCalendarAtomicData, calendarName, calendarTimeZone, baseCalendar, updatedEventRanges ) {
    if( updatedDefaultRanges && updatedDefaultRanges.newUpdatedRanges ) {
        for( var idx in dayData ) {
            if( updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges.length > 0 ) {
                dayData[ idx ].ranges = updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges;
            } else {
                let emptyRange = [ {
                    range_end: '480',
                    range_start: '480'
                } ];
                dayData[ idx ].ranges = emptyRange;
            }
        }
    }
    //Reset Save/Cancel enability after save action
    awCalendarAtomicData.isDirty = false;
    calendarName.prevDisplayValues[ 0 ] = calendarName.displayValues[ 0 ];
    calendarTimeZone.prevDisplayValues[ 0 ] = calendarTimeZone.displayValues[ 0 ];
    baseCalendar.prevDisplayValues[ 0 ] = baseCalendar.displayValues[ 0 ];
    updatedEventRanges.dailyEventDateToRangeMap = {};
    return {
        dayData: dayData,
        updatedDefaultRanges: updatedDefaultRanges,
        awCalendarAtomicData: awCalendarAtomicData,
        calendarName: { ...calendarName },
        calendarTimeZone: { ...calendarTimeZone },
        baseCalendar: { ...baseCalendar },
        updatedEventRanges: updatedEventRanges
    };
};

var containsObject = function( obj, list ) {
    var i;
    for ( i = 0; i < list.length; i++ ) {
        var newDate = new Date( list[i] );
        if ( newDate.getTime() === obj.getTime() ) {
            return true;
        }
    }
    return false;
};

/**
  * Prepare input for updateCalendars SOA
  * @param {Object} selectedCalendarData - selected calendar data
  * @param {Object} selectedCalendar - selected calendar
  * @param {Object} updatedDefaultRanges - updated default days ranges
  * @param {Object} calendarName - selected calendar name
  * @param {Object} calendarTimeZone - selected calendar time zone
  * @param {Object} baseCal - base calendar
  * @param {Object} updatedEventRanges - updated event ranges

  * @param {Object} datePickerInfo - existing events on calendar info
  * @returns {Object} input for updateCalendars SOA
  */
export let getUpdateCalendarInput = function( selectedCalendarData, selectedCalendar, updatedDefaultRanges, calendarName, calendarTimeZone, baseCal, updatedEventRanges, datePickerInfo ) {
    let dayRanges = {
        sunRanges: [],
        monRanges: [],
        tueRanges: [],
        wedRanges: [],
        thuRanges: [],
        friRanges: [],
        satRanges: []
    };
    let eventsToAdd = [];
    let eventsToUpdate = [];
    let eventsToDelete = [];
    let previousCalendarEvents = datePickerInfo.eventDateToRangeMap;

    if( updatedDefaultRanges && updatedDefaultRanges.newUpdatedRanges ) {
        for( let idx = 0; idx < updatedDefaultRanges.newUpdatedRanges.length; idx++ ) {
            if( updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges.length > 0 ) {
                for( let i = 0; i < updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges.length; i++ ) {
                    let ranges = {
                        startRange: parseInt( updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges[ i ].range_start ),
                        endRange: parseInt( updatedDefaultRanges.newUpdatedRanges[ idx ].props.totalRanges[ i ].range_end )
                    };
                    dayRanges = setDayRanges( dayRanges, idx, ranges );
                }
            } else {
                let ranges = {
                    startRange: 480,
                    endRange: 480
                };
                dayRanges = setDayRanges( dayRanges, idx, ranges );
            }
        }
    } else {
        for( var idx in selectedCalendarData ) {
            for( let i = 0; i < selectedCalendarData[ idx ].ranges.length; i++ ) {
                let ranges = {
                    startRange: parseInt( selectedCalendarData[ idx ].ranges[ i ].range_start ),
                    endRange: parseInt( selectedCalendarData[ idx ].ranges[ i ].range_end )
                };
                dayRanges = setDayRanges( dayRanges, parseInt( idx ), ranges );
            }
        }
    }

    let SOAInput = {
        calendar: selectedCalendar,
        calendarAttributes: {
            name: calendarName.uiValue,
            schedule: 'AAAAAAAAAAAAAA',
            source: 'AAAAAAAAAAAAAA',
            baseCalendar: 'AAAAAAAAAAAAAA',
            description: selectedCalendar.props.tccal_desc.uiValues[0],
            thuRanges: dayRanges.thuRanges,
            friRanges: dayRanges.friRanges,
            satRanges: dayRanges.satRanges,
            timeZone: calendarTimeZone.dbValue,
            type: parseInt( selectedCalendar.props.tccal_type.dbValues[0] ),
            sunRanges: dayRanges.sunRanges,
            monRanges: dayRanges.monRanges,
            tueRanges: dayRanges.tueRanges,
            wedRanges: dayRanges.wedRanges
        }
    };

    for( let date in updatedEventRanges.dailyEventDateToRangeMap ) {
        let eventRanges = [];
        let eventAddFlg = true;//to check add event to be called
        let updateEventFlg = true;//to check update event to be called
        let dateObject = new Date( date );
        dateObject.setHours( 12, 0, 0 );
        let exceptionEventIdx = datePickerInfo.exceptionBucket.map( Number ).indexOf( Number( dateObject ) );
        for( let index in updatedEventRanges.dailyEventDateToRangeMap[date].ranges ) {
            let ranges = {
                startRange: parseInt( updatedEventRanges.dailyEventDateToRangeMap[date].ranges[index].range_start ),
                endRange: parseInt( updatedEventRanges.dailyEventDateToRangeMap[date].ranges[index].range_end )
            };
            eventRanges.push( ranges );
        }

        for( let previousEventDate in previousCalendarEvents ) {
            if( previousEventDate === dateObject.toString() && exceptionEventIdx > -1 ) {
                let rangeObj = cdm.getObject( previousCalendarEvents[previousEventDate].eventRangeUids[0] );
                if( rangeObj.props.range_start.dbValues[0] === rangeObj.props.range_end.dbValues[0] ) {
                    eventsToDelete.push( cdm.getObject( previousCalendarEvents[previousEventDate].eventUid ) );
                    if( updatedEventRanges.dailyEventDateToRangeMap[date].type === 'wdd' ) {
                        updateEventFlg = false;
                        eventAddFlg = false;
                    } else {
                        updateEventFlg = false;
                        eventAddFlg = true;
                    }
                } else {
                    if( updatedEventRanges.dailyEventDateToRangeMap[date].type === 'wdd' ) {
                        eventsToDelete.push( cdm.getObject( previousCalendarEvents[previousEventDate].eventUid ) );
                        updateEventFlg = false;
                        eventAddFlg = false;
                    } else {
                        updateEventFlg = true;
                    }
                }
                if( updateEventFlg ) {
                    let eventToUpdate = {
                        event: cdm.getObject( previousCalendarEvents[previousEventDate].eventUid ),
                        eventAttributes: {
                            firstRecurStart: dateTimeSvc.formatUTC( dateObject ),
                            firstRecurEnd: '',
                            eventExpiryDate: '',
                            eventRanges: eventRanges,
                            eventType: 0,
                            numRecurrences: 0,
                            recurInterval: 0,
                            recurDaysOfWeek: 0,
                            recurWeeksOfMonth: 0,
                            recurMonth: 0
                        }
                    };
                    eventsToUpdate.push( eventToUpdate );
                    eventAddFlg = false;
                }
            }
        }
        if( updatedEventRanges.dailyEventDateToRangeMap[date].type === 'wdd' ) {
            eventAddFlg = false;
        }
        if( eventAddFlg ) {
            let eventToAdd = {
                firstRecurStart: dateTimeSvc.formatUTC( dateObject ),
                firstRecurEnd: '',
                eventExpiryDate: '',
                eventRanges: eventRanges,
                eventType: 0,
                numRecurrences: 0,
                recurInterval: 0,
                recurDaysOfWeek: 0,
                recurWeeksOfMonth: 0,
                recurMonth: 0
            };
            eventsToAdd.push( eventToAdd );
        }
    }

    if( selectedCalendar.props.base_calendar_tag ) {
        SOAInput.calendarAttributes.baseCalendar = cdm.getObject( baseCal.dbValue );
    }
    if( eventsToUpdate.length > 0 ) {
        SOAInput.eventsToUpdate  = eventsToUpdate;
    }
    if( eventsToAdd.length > 0 ) {
        SOAInput.eventsToAdd  = eventsToAdd;
    }
    if( eventsToDelete.length > 0 ) {
        SOAInput.eventsToDelete  = eventsToDelete;
    }

    return [ SOAInput ];
};

/**
   * Prepare input for getEvents SOA
   * @param {Object} datePickerInfo - calendar's exceptions/events information
   * @param {Object} tcCalendar - selected calendar
   * @returns {Object} input for getEvents SOA
   */
export let getCalendarEventsInput = function( datePickerInfo, tcCalendar ) {
    let searchCriteria = {};
    if( tcCalendar.props.tccal_type.dbValues[0] === '1' ) {
        searchCriteria = {
            searchContentType: 'tcCalendarEvents',
            calendarUid : tcCalendar.uid,
            fromDate : datePickerInfo.fromDate,
            toDate : datePickerInfo.toDate
        };
    }else if( tcCalendar.props.tccal_type.dbValues[0] === '2' ) {
        searchCriteria = {
            searchContentType: 'scheduleCalendarEvents',
            scheduleCalendarUid : tcCalendar.uid,
            calendarUid : tcCalendar.props.base_calendar_tag.dbValues[0],
            fromDate : datePickerInfo.fromDate,
            toDate : datePickerInfo.toDate
        };
    }else if( tcCalendar.props.tccal_type.dbValues[0] === '3' ) {
        searchCriteria = {
            searchContentType: 'userCalendarEvents',
            userCalendarUid : tcCalendar.uid,
            calendarUid : tcCalendar.props.base_calendar_tag.dbValues[0],
            fromDate : datePickerInfo.fromDate,
            toDate : datePickerInfo.toDate
        };
    }

    return searchCriteria;
};

var setDayRanges = function( dayRanges, idx, ranges ) {
    if( idx === 0 ) {
        dayRanges.sunRanges.push( ranges );
    } else if( idx === 1 ) {
        dayRanges.monRanges.push( ranges );
    } else if( idx === 2 ) {
        dayRanges.tueRanges.push( ranges );
    } else if( idx === 3 ) {
        dayRanges.wedRanges.push( ranges );
    } else if( idx === 4 ) {
        dayRanges.thuRanges.push( ranges );
    } else if( idx === 5 ) {
        dayRanges.friRanges.push( ranges );
    } else if( idx === 6 ) {
        dayRanges.satRanges.push( ranges );
    }

    return dayRanges;
};

/**
   * Reset the isDirty flag to initial value after cancel action performed
   * @param {Object} awCalendarAtomicData - isDirty flag
   * @param {Object} updatedEventRanges - daily updated events
   * @returns {Object} awCalendarAtomicData
   */
export let resetIsDirty = function( awCalendarAtomicData, updatedEventRanges ) {
    awCalendarAtomicData.isDirty = false;
    if( updatedEventRanges.dailyEventDateToRangeMap ) {
        updatedEventRanges.dailyEventDateToRangeMap = {};
    }
    return {
        awCalendarAtomicData: awCalendarAtomicData,
        updatedEventRanges: updatedEventRanges
    };
};

/**
  * Convert events search results into a map of event date and its ranges.
  * @param {object} response - SOA operation response.
  * @param {object} tcCalUID - calendar UID
  * @returns {Object} map of event date and its ranges.
  */
export let processEventResponseObjects = function( response, tcCalUID ) {
    let eventDateToRangeMap = {};
    let exceptionBucket = [];
    let inheritedBucket = [];
    if( response && response.searchResults ) {
        var exceptionDateCheck = [];
        for( let i in response.searchResults ) {
            let eventObject = cdm.getObject( response.searchResults[i].uid );
            if( eventObject && eventObject.props && eventObject.props.first_recur_start && eventObject.props.event_range ) {
                let recurStartDate = new Date( eventObject.props.first_recur_start.dbValues[ 0 ] );
                if( exceptionDateCheck.map( Number ).indexOf( Number( recurStartDate ) ) < 0 ) {
                    eventDateToRangeMap[ recurStartDate ] = {
                        eventUid: response.searchResults[i].uid,
                        eventRangeUids: eventObject.props.event_range.dbValues
                    };
                }
                if( tcCalUID === response.searchResults[i].props.tccalendar_tag.dbValues[0] ) {
                    exceptionBucket.push( recurStartDate );
                    exceptionDateCheck.push( recurStartDate );
                } else {
                    inheritedBucket.push( recurStartDate );
                }
            }
        }
    }
    return {
        eventDateToRangeMap: eventDateToRangeMap,
        exceptionBucket: exceptionBucket,
        inheritedBucket: inheritedBucket
    };
};

/**
  * This method is used to get the LOV values of base calendars for the add base calendar panel.
  * @param {Object} response - the response of the getLov soa
  * @returns {Object} value the LOV value
  */
export let getBaseCalendarsList = function( response ) {
    let calendarList = [];
    let responseList = response.ServiceData.modelObjects;
    if( responseList ) {
        for( let obj in responseList ) {
            let targetObj = cdm.getObject( obj );
            if( targetObj.type === 'TCCalendar' ) {
                let calenderObject = {
                    propInternalValue: targetObj.uid,
                    propDisplayValue: targetObj.props.object_string.uiValues[ 0 ]
                };
                calendarList.push( calenderObject );
            }
        }
    }
    return calendarList;
};

/**
   * Create input for modifyTCCalendars SOA
   * @param {Object} resetType - reset or merge
   * @param {Object} scheduleTCCalendarUid - schedule calendar UID
   * @return {String} role of member in schedule
   */
export let resetMergeCalendarSOAInput = function( resetType, scheduleTCCalendarUid ) {
    let action;
    if( resetType.dbValue === true ) {
        action = 'ResetSchedule';
    } else {
        action = 'MergeSchedule';
    }
    return [ {
        scheduleTCCalendar: cdm.getObject( scheduleTCCalendarUid ),
        action: action
    } ];
};

/**
   * Update isEditable field of following data with custom action
   * @param {Object} calendarTimeZone - calendar time zone
   * @param {Object} baseCalendar - base calendar name
   * @param {Object} editMode - editMode
   * @return {String} isEditable field updated as per editMode
   */
export let updateEditMode = function( calendarTimeZone, baseCalendar, editMode ) {
    calendarTimeZone.isEditable = editMode;
    calendarTimeZone.isEnabled = editMode;
    baseCalendar.isEditable = editMode;
    baseCalendar.isEnabled = editMode;
    return {
        calendarTimeZone: { ...calendarTimeZone },
        baseCalendar: { ...baseCalendar }
    };
};

export let updateDatePickerInfoAction = function( newDatePickerInfo ) {
    return {
        eventDateToRangeMap: newDatePickerInfo.eventDateToRangeMap,
        exceptionBucket: newDatePickerInfo.exceptionBucket,
        inheritedBucket: newDatePickerInfo.inheritedBucket
    };
};

exports = {
    createDayDetailsProp,
    getNonWorkingDays,
    getCurrentDate,
    getTimezoneList,
    updateCalendarView,
    updateCalendarParent,
    getUpdateCalendarInput,
    getCalendarEventsInput,
    resetIsDirty,
    processEventResponseObjects,
    getBaseCalendarsList,
    resetMergeCalendarSOAInput,
    updateEditMode,
    updateDatePickerInfoAction
};

export default exports;

