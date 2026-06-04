// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1ShiftScheduleService
 */
import dateTimeSvc from 'js/dateTimeService';

var exports = {};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 */
export let getDateString_startDate = function( data, dateObject ) {
    if ( !data.shiftScheduleByDays.dbValue ) {
        var dateValue;
        dateValue = dateTimeSvc.formatUTC( dateObject );
        return dateValue;
    }
};

/**
 * Return input for createTaskDeliverable SOA
 *
 * @param {object} data - Data of ViewModelObject
 * @param {object} schTask - Schedule Task from where Add Deliverable command is invoked
 */
export let getTaskDeliverable = function( data, schTask, selectedTab, sourceObjects ) {
    var input = [];
    var inputData;
    var deliverableNameOfObject;
    if ( data.selectedTab.view === 'NewTabPageSub' ) {
        if ( data.datasetType.dbValue ) {
            deliverableNameOfObject = data.datasetName.dbValue;
        } else {
            deliverableNameOfObject = data.object_name.dbValue;
        }
        inputData = {
            scheduleTask: schTask,
            submitType: 0,
            deliverableReference: data.createdObject,
            deliverableName: deliverableNameOfObject,
            deliverableType: data.createdObject.type
        };
        input.push( inputData );
    } else {
        for ( var secondObj in sourceObjects ) {
            if ( sourceObjects.hasOwnProperty( secondObj ) ) {
                inputData = {
                    scheduleTask: schTask,
                    submitType: 0,
                    deliverableReference: sourceObjects[secondObj],
                    deliverableName: sourceObjects[secondObj].props.object_string.dbValues[0],
                    deliverableType: sourceObjects[secondObj].type
                };
                input.push( inputData );
            }
        }
    }
    return input;
};

export let getScheduleUIDs = function( ctx ) {
    var scheduleUids = [];
    for ( var selCount = 0; selCount < ctx.mselected.length; selCount++ ) {
        scheduleUids.push( ctx.mselected[selCount].uid );
    }
    return scheduleUids;
};

export let getDaysToShift = function( data ) {
    if ( data.shiftScheduleByDays.dbValue ) {
        var daysToShift = data.shiftScheduleDays.dbValue;
        if ( data.shiftDirection.dbValue === 'Backward' ) {
            daysToShift *= -1;
        }
        return daysToShift;
    }
};

export default exports = {
    getDateString_startDate,
    getTaskDeliverable,
    getScheduleUIDs,
    getDaysToShift
};
