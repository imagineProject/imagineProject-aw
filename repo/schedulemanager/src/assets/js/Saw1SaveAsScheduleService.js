// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1SaveAsScheduleService
 */
import dateTimeService from 'js/dateTimeService';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};


/**
 * Sets the date value for date proeprty of create schedule from template panel.
 * @param {Object} vmoProp -  ViewModelProperty
 * @param {String} dateVal - shift date
 */
var setDateValueForProp = function( vmoProp, dateVal ) {
    uwPropertyService.setValue( vmoProp, dateVal.getTime() );
    vmoProp.dateApi.dateObject = dateVal;
    vmoProp.dateApi.dateValue = dateTimeService.formatDate( dateVal, dateTimeService
        .getSessionDateFormat() );
    vmoProp.dateApi.timeValue = dateTimeService.formatTime( dateVal, dateTimeService
        .getSessionDateFormat() );
};

export let populateDefaultValuesForSaveAs = function( data ) {
    var schedule;
    if( data.eventData ) {
        schedule = data.eventData.selectedObjects[0];
    } else {
        schedule = selectionService.getSelection().selected[ 0 ];
    }
    var isEndDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';
    var isTemplateDatePrefOn = true;
    if ( appCtxService.ctx.preferences.SM_TEMPLATE_DATE ) {
        isTemplateDatePrefOn = appCtxService.ctx.preferences.SM_TEMPLATE_DATE[ 0 ].toUpperCase() === 'true'.toUpperCase();
    }
    if( isTemplateDatePrefOn ) {
        if( isEndDateSchedule ) {
            setDateValueForProp( data.finishShiftDate, new Date( schedule.props.finish_date.dbValues[ 0 ] ) );
        } else {
            setDateValueForProp( data.startShiftDate, new Date( schedule.props.start_date.dbValues[ 0 ] ) );
        }
    } else {
        var shiftDate = new Date();
        if( isEndDateSchedule ) {
            setDateValueForProp( data.finishShiftDate, shiftDate );
        } else {
            setDateValueForProp( data.startShiftDate, shiftDate );
        }
    }

    var asyncProp = data.isRunAsync;
    if( asyncProp ) {
        var value = false;
        if( appCtxService.ctx.preferences.SM_Copy_Schedule_Async ) {
            value = appCtxService.ctx.preferences.SM_Copy_Schedule_Async[ 0 ].toUpperCase() === 'true'.toUpperCase();
        }
        asyncProp.dbValues[ 0 ] = value;
        asyncProp.dbValue = value;
        asyncProp.uiValue = value;
    }

    const newFinishShiftDate = _.clone( data.finishShiftDate );
    const newStartShiftDate = _.clone( data.startShiftDate );

    newFinishShiftDate.dbValue = data.finishShiftDate.dbValue;
    newFinishShiftDate.value = data.finishShiftDate.dbValue;

    newStartShiftDate.dbValue = data.startShiftDate.dbValue;
    newStartShiftDate.value = data.startShiftDate.dbValue;

    return {
        finishShiftDate:newFinishShiftDate,
        startShiftDate:newStartShiftDate
    };
};

exports = {
    populateDefaultValuesForSaveAs
};

export default exports;
