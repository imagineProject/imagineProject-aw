// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1TimesheetEntryUtils
 */

import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import _ from 'lodash';

let exports;

/**
  * Parse the perform search response and return the correct output data object
  *
  * @param {Object} response - The response of performSearch SOA call
  * @param {string} localizationKeys - localization i18n keys
  * @return {Object} - outputData object that holds the correct values .
  */
export let processProviderResponse = function( response, localizationKeys ) {
    var timesheetEntries = [];
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        _.forEach( response.searchResults, function( result ) {
            // Get the model object for search result object UID present in response
            var resultObject = cdm.getObject( result.uid );

            if( resultObject ) {
                var props = [];
                // first two properties are considered as cellHeader1 and cellHeader2 and in this use case there is no headers so kept two dummy values for cell headers.
                var cellHeader1 = '';
                props.push( 'cellHeader1 \\:' + cellHeader1 );

                var cellHeader2 = '';
                props.push( 'cellHeader2 \\:' + cellHeader2 );

                var cellProp1 = resultObject.props.object_desc.uiValues[ 0 ];

                props.push( localizationKeys.description + ' \\:' + cellProp1 );

                var timesheetMinutesValue = resultObject.props.minutes.dbValues[ 0 ] % 60;
                var timesheetHoursValue = ( resultObject.props.minutes.dbValues[ 0 ] - timesheetMinutesValue ) / 60;
                var cellProp2 = timesheetHoursValue + 'h' + ' ' + timesheetMinutesValue + 'm';
                props.push( localizationKeys.timesheetTimeSpent + ' \\:' + cellProp2 );

                var dateUiValue = resultObject.props.date.uiValues[ 0 ];

                var indexOfSpace = dateUiValue.lastIndexOf( ' ' );
                var cellProp3 = dateUiValue.substring( 0, indexOfSpace + 1 );
                props.push( localizationKeys.timesheetWorkDate + ' \\:' + cellProp3 );

                var cellProp4 = resultObject.props.saw1EntryStatus.uiValues[ 0 ];
                props.push( localizationKeys.timesheetStatus + ' \\:' + cellProp4 );

                if( props ) {
                    resultObject.props.awp0CellProperties.dbValues = props;
                    resultObject.props.awp0CellProperties.uiValues = props;
                    timesheetEntries.push( result );
                }
            }
        } );
    }
    //if no results found retund null and the dp will get cleared after
    if( !response.searchResults || !timesheetEntries ) {
        return null;
    }

    return timesheetEntries;
};

export let validateTimesheetTimeInput = function( submitFlag, minutes, hours ) {
    if(  hours === 24 && minutes !== 0  ||  hours > 24 && minutes > 59  ) {
        if( submitFlag === true ) {
            throw 'timesheetSubmitErrorMsg';
        }else{
            throw 'timesheetSaveErrorMsg';
        }
    }else if( /^(\d|1\d|2[0-4])?$/.test( hours )  === false ) {
        if( submitFlag === true ) {
            throw 'timesheetHoursSubmitErrorMsg';
        }else{
            throw 'timesheetHoursSaveErrorMsg';
        }
    }else if( /^(\d|1\d|2\d|3\d|4\d|5\d)?$/.test( minutes ) === false ) {
        if( submitFlag === true ) {
            throw 'timesheetMinutesSubmitErrorMsg';
        }else{
            throw 'timesheetMinutesSaveErrorMsg';
        }
    }
};
export let getTimesheetTimeSpent = function( data ) {
    var submitFlag = data.eventData.isSubmitFlag;
    var minutes = data.timesheetMinutes.dbValue;
    var hours = data.timesheetHours.dbValue;
    validateTimesheetTimeInput( submitFlag, minutes, hours );
    var timesheetHoursValue = hours * 60;
    var timesheetTimeSpent = timesheetHoursValue + parseInt( minutes );
    return timesheetTimeSpent.toString();
};
export let getTimesheetTimeSpentEdit = function( minutes ) {
    var timesheetTimeSpent =  parseInt( minutes );
    return timesheetTimeSpent.toString();
};

export let getUpdatedObject = function( updatedObjectUid ) {
    return cdm.getObject( updatedObjectUid );
};

/**
  * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
  *
  * @param {dateObject} dateObject - The date object
  * @return {String} - String representation of the Given Date in UTC format
  */
export let getDateString = function( dateObject ) {
    return dateTimeSvc.formatUTC( dateObject );
};

export let getTimesheetEntryObjectName = function( object_name, propMaxLength ) {
    if( object_name.length > propMaxLength - 4 ) {
        object_name = object_name.substring( 0, propMaxLength - 4 );
    }
    return object_name.concat( ':TSE' );
};

export let getTimesheetEntriesInput = function( selectedObjects ) {
    return cdm.getObject( selectedObjects[ 0 ].uid );
};

export let getStatusOfSelectedEntries = function( selectedEntries ) {
    if( selectedEntries.length > 0 ) {
        for( var selectedEntry in selectedEntries ) {
            if( selectedEntries[ selectedEntry ].props && selectedEntries[ selectedEntry ].props.process_stage_list && selectedEntries[ selectedEntry ].props.release_status_list ) {
                var processStageLen = selectedEntries[ selectedEntry ].props.process_stage_list.dbValues.length;
                var releaseStatusLen = selectedEntries[ selectedEntry ].props.release_status_list.dbValues.length;
                if( processStageLen === 0 && releaseStatusLen === 0 ) //i.e status is Entered
                {
                    return true;
                }
                return false;
            }
        }
    }
};

/**
 * Update the shared data between panels.
 * @param {Object} createdObject - created object
 * @param {Object} sharedData - sharedData
 */
function updateSharedData( createdObjectUID, sharedData ) {
    sharedData.update( { ...sharedData.value, createdObj:{} } );
    const createdObj = cdm.getObject( createdObjectUID );
    sharedData.update( { ...sharedData.value, createdObj } );
}

exports = {
    processProviderResponse,
    getTimesheetTimeSpent,
    getTimesheetTimeSpentEdit,
    getUpdatedObject,
    getDateString,
    getTimesheetEntryObjectName,
    getTimesheetEntriesInput,
    getStatusOfSelectedEntries,
    validateTimesheetTimeInput,
    updateSharedData
};
export default exports;
