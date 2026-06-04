

// Copyright (c) 2022 Siemens

/**
 * @module js/AwCalendarUtils
 */

import cdm from 'soa/kernel/clientDataModel';
var exports = {};

/**
    * This method is used to get the LOV values of timezone for the add project panel.
    * @param {Object} response - the response of the getLov soa
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
            if( targetObj.modelType.typeHierarchyArray.indexOf( 'TCCalendar' ) > -1 ) {
                let calenderObject = {
                    propInternalValue:  targetObj.uid,
                    propDisplayValue:  targetObj.props.object_string.uiValues[0]
                };
                calendarList.push( calenderObject );
            }
        }
    }
    return calendarList;
};

// Function to day Ranges as per calendar day ranges
let getRanges = function( rangesUid ) {
    let ranges = [];
    for( let i = 0; i < rangesUid.length; ++i ) {
        let rangeObj = cdm.getObject( rangesUid[i] );
        if( rangeObj ) {
            let day_range = {
                endRange: parseInt( rangeObj.props.range_end.dbValues[0] ),
                startRange: parseInt( rangeObj.props.range_start.dbValues[0] )
            };
            ranges.push( day_range );
        }
    }
    return ranges;
};

// Function to get Working day Ranges
let getWorkingDayRanges = function() {
    return [
        {
            endRange: 720,
            startRange: 480
        },
        {
            endRange: 1020,
            startRange: 780
        }
    ];
};

// Function to get Non Working day Ranges
let getNonWorkingDayRanges = function() {
    return [
        {
            endRange: 480,
            startRange: 480
        }
    ];
};

/**
    * This method is used to get the Input for SOA call fro creating base calendar.
    * @param {Object} data for getting UI values
    */

export let getCreateCalendarInput = function( name, description, timeZone, baseCalendar, context ) {
    let calenderInfo = {};
    // If- user selects base calendar in panel, then for SOA call respective ranges will pass on.
    // Else- user doesn't selects base calendar in panel, then for SOA call default ranges will pass on
    if( baseCalendar.dbValue ) {
        let calendarObj = cdm.getObject( baseCalendar.dbValue );
        calenderInfo = {
            tccalendarAttributes : {
                name: name.dbValue,
                description: description.dbValue,
                timeZone: timeZone.dbValue,
                baseCalendar: 'AAAAAAAAAAAAAA',
                type: 1,
                monRanges: getRanges( calendarObj.props.mon_ranges.dbValues ),
                tueRanges: getRanges( calendarObj.props.tue_ranges.dbValues ),
                wedRanges: getRanges( calendarObj.props.wed_ranges.dbValues ),
                thuRanges: getRanges( calendarObj.props.thu_ranges.dbValues ),
                friRanges: getRanges( calendarObj.props.fri_ranges.dbValues ),
                satRanges: getRanges( calendarObj.props.sat_ranges.dbValues ),
                sunRanges: getRanges( calendarObj.props.sun_ranges.dbValues )
            }
        };
    } else {
        calenderInfo = {
            tccalendarAttributes : {
                name: name.dbValue,
                description: description.dbValue,
                timeZone: timeZone.dbValue,
                baseCalendar: 'AAAAAAAAAAAAAA',
                type: 1,
                monRanges: getWorkingDayRanges(),
                tueRanges: getWorkingDayRanges(),
                wedRanges: getWorkingDayRanges(),
                thuRanges: getWorkingDayRanges(),
                friRanges: getWorkingDayRanges(),
                satRanges: getNonWorkingDayRanges(),
                sunRanges: getNonWorkingDayRanges()
            }
        };
    }
    if( context.user ) {
        calenderInfo.tccalendarAttributes.type = 3;
        calenderInfo.tccalendarAttributes.baseCalendar = cdm.getObject( baseCalendar.dbValue );
        calenderInfo.tccalendarAttributes.source = cdm.getObject( context.user.uid );
    }
    return [ calenderInfo ];
};


/**
    * This method is used to set attributes on Create Calendar Panel.
    * @param {Object} name - Name field
    * @param {Object} baseCalendar - BaseCalendar field
    * @param {Object} calendarList - Context for create panel
    * @param {Object} calendarTimeZone - Calendar Time Zone field
    * @param {Object} timezoneList - Context for time zone
    * @param {Object} SiteTimeZone - SiteTimeZone preference
    * @param {Object} context - list of all base calendars
    * @returns {Object} changed name and base calendar fields on panel
    */
export let setPanelAttributes = function( name, baseCalendar, calendarList, calendarTimeZone, timezoneList, SiteTimeZone, context ) {
    if( context.nameEdit === false ) {
        if( context.user ) {
            let nameStr = context.user.props.user_name.dbValues[0] + ' (' + context.user.props.userid.dbValues[0] + ')';
            name.dispValue = nameStr;
            name.dbValue = nameStr;
            name.uiValue = nameStr;
        }
        name.isEditable = false;
    }
    if( context.calendar !== 'baseCalendar' ) {
        baseCalendar.isRequired = true;
    }
    if( calendarList.length > 0 ) {
        baseCalendar.dbValue = calendarList[0].propInternalValue;
        baseCalendar.dispValue = calendarList[0].propDisplayValue;
        baseCalendar.uiValue = calendarList[0].propDisplayValue;
    }
    if( timezoneList.length > 0 ) {
        for( let i = 0; i < timezoneList.length; i++ ) {
            if( timezoneList[i].propInternalValue === SiteTimeZone ) {
                calendarTimeZone.dbValue = timezoneList[i].propInternalValue;
                calendarTimeZone.dispValue = timezoneList[i].propDisplayValue;
                calendarTimeZone.uiValue = timezoneList[i].propDisplayValue;
                break;
            }
        }
    }
    return{
        object_name: { ...name },
        base_calenders: { ...baseCalendar },
        calendarTimeZone: { ...calendarTimeZone }
    };
};

/**
    * This method is used to update search state with newAddedCalendar.
    * @param {Object} response - the response of soa
    * @param {Object} searchState - search state
    * @param {Object} context - user/base calendar context
    * @returns {Object} created calendar
    */
export let processResponse = function( response, searchState, context ) {
    if( context.calendar === 'baseCalendar' ) {
        var newSearchState = searchState.getValue();
        newSearchState.newAddedCalendar = response.calendarResponse[0].calendar.uid;
        searchState.update( newSearchState );
    }
    return response.calendarResponse[0].calendar;
};

exports = {
    getTimezoneList,
    getBaseCalendarsList,
    getCreateCalendarInput,
    setPanelAttributes,
    processResponse
};

export default exports;


