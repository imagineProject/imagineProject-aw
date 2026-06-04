// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1TimesheetEntryCellCommandsHandler
 */

import uwPropertyService from 'js/uwPropertyService';
import dateTimeSvc from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import saw1TimesheetEntryUtils from 'js/Saw1TimesheetEntryUtils';
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';

let exports;

var _timesheetEntry = null;

var _allModifiedProperties = [];

export let extractSrcObjsLSD = function( response ) {
    let modelObjects = [];
    let lsd = null;
    if( response.viewModelObjectsJsonStrings && response.viewModelObjectsJsonStrings.length > 0 ) {
        modelObjects = JSON.parse( response.viewModelObjectsJsonStrings[ 0 ] ).objects;
        if( modelObjects.length > 0 ) {
            lsd = modelObjects[ 0 ].props[ Object.keys( modelObjects[ 0 ].props )[ 0 ] ].srcObjLsd;
        }
    }
    return lsd;
};

export let execute = function( vmo, destPanelId, title ) {
    if( vmo && vmo.uid ) {
        _timesheetEntry = vmo;
        editTimesheetEntryPanel( destPanelId, title );
    }
};

var editTimesheetEntryPanel = function( destPanelId, title ) {
    var context = {
        destPanelId: destPanelId,
        title: title,
        recreatePanel: true,
        supportGoBack: true
    };
    eventBus.publish( 'awPanel.navigate', context );
};

export let populateDataForTimesheetEntry = function( descVMProp, hourVMProp, minuteVMProp, dateVmProp ) {
    _allModifiedProperties = [];
    var timesheetEntry = cdm.getObject( _timesheetEntry.uid );
    var propsToLoad = [];
    var description = timesheetEntry.props.object_desc.dbValues[ 0 ];
    var minutes =  parseInt( timesheetEntry.props.minutes.dbValues[ 0 ] ) % 60;
    var hours = ( parseInt( timesheetEntry.props.minutes.dbValues[ 0 ] ) - minutes ) / 60;
    var workDate = timesheetEntry.props.date.dbValues[ 0 ];
    var descProp = descVMProp;
    if( descProp ) {
        uwPropertyService.setValue( descProp, description );
        uwPropertyService.setIsRequired( descProp, true );
        _allModifiedProperties.push( descVMProp );
        propsToLoad.push( descVMProp.propertyName );
    }
    var hoursProp = hourVMProp;
    if( hoursProp ) {
        uwPropertyService.setValue( hoursProp, hours );
        uwPropertyService.setIsRequired( hoursProp, true );
        hoursProp.uiValue = hours;
    }
    var minutesProp = minuteVMProp;
    if( minutesProp ) {
        uwPropertyService.setValue( minutesProp, minutes );
        uwPropertyService.setIsRequired( minutesProp, true );
        minutesProp.uiValue = minutes;
        _allModifiedProperties.push( minuteVMProp );
        propsToLoad.push( minuteVMProp.propertyName );
    }
    var workDateProp = dateVmProp;
    if( workDateProp ) {
        var date = new Date( workDate );
        workDateProp.dateApi.dateObject = date;
        workDateProp.dateApi.dateValue = dateTimeSvc.formatDate( workDate, dateTimeSvc.getSessionDateFormat() );

        uwPropertyService.setValue( workDateProp, date );
        uwPropertyService.setIsRequired( workDateProp, true );
        _allModifiedProperties.push( dateVmProp );
        propsToLoad.push( dateVmProp.propertyName );
    }
    return {
        openedMO : timesheetEntry, //ModelObject
        propsToLoad: propsToLoad
    };
};

var convertHoursToMinutes = function( prop, propUpdatedValue ) {
    var vmProperty = uwPropertyService.createViewModelProperty( prop.propertyName, prop.propertyDisplayName, prop.type );
    vmProperty.dbValue = propUpdatedValue;
    vmProperty.newValue = propUpdatedValue;
    vmProperty.sourceObjectLastSavedDate = prop.sourceObjectLastSavedDate;
    return vmProperty;
};

export let allModifiedProperties = function( descVMProp, hourVMProp, minuteVMProp, dateVmProp, lsd, submitFlag ) {
    var inputs = [];
    var modifiedProperties = [];
    _.forEach( _allModifiedProperties, function( prop ) {
        var editObject = dms.getSaveViewModelEditAndSubmitToWorkflowInput( _timesheetEntry );
        prop.sourceObjectLastSavedDate = lsd;
        if( prop.propertyName === 'date' && dateVmProp.dateApi ) {
            prop.dbValue = dateVmProp.dateApi.dateObject;
            prop.newValue = dateVmProp.dateApi.dateObject;
        }
        if( prop.propertyName === 'minutes' && ( hourVMProp.dbValue || minuteVMProp.dbValue ) ) {
            var minutesCheck = minuteVMProp.dbValue;
            var hoursCheck = hourVMProp.dbValue;
            saw1TimesheetEntryUtils.validateTimesheetTimeInput( submitFlag, minutesCheck, hoursCheck );
            minuteVMProp.dbValue = parseInt( minuteVMProp.dbValue )  + parseInt( hourVMProp.dbValue * 60 );
            saw1TimesheetEntryUtils.getTimesheetTimeSpentEdit( prop.dbValue );
            prop = convertHoursToMinutes( prop, minuteVMProp.dbValue );
        }
        if( prop.propertyName === 'object_desc' ) {
            prop.dbValue = descVMProp.dbValue;
            prop.newValue = descVMProp.dbValue;
        }


        dms.pushViewModelProperty( editObject, prop );
        inputs.push( editObject );
    } );

    if( inputs.length > 0 ) {
        for( var x in inputs ) {
            modifiedProperties.push( inputs[ x ].viewModelProperties[ 0 ] );
        }
    }

    return [ {
        obj: _timesheetEntry,
        viewModelProperties: modifiedProperties
    } ];
};

export let populateDeleteMsgInput = function( vmo ) {
    if( vmo && vmo.uid ) {
        return cdm.getObject( vmo.uid );
    }
};

export let updateTimesheetEntryDataProvider = function( vmo ) {
    eventBus.publish( 'updateTimesheetEntryData', vmo );
};

export let updateTimesheetEntryData = function( dataProviders, deletedUid ) {
    var timesheetEntryObjects = dataProviders.viewModelCollection.loadedVMObjects;
    var modelObjects = $.grep( timesheetEntryObjects, function( timesheetEntryObject ) {
        return timesheetEntryObject.uid !== deletedUid;
    } );
    dataProviders.update( modelObjects );
};

exports = {
    extractSrcObjsLSD,
    execute,
    populateDataForTimesheetEntry,
    allModifiedProperties,
    populateDeleteMsgInput,
    updateTimesheetEntryDataProvider,
    updateTimesheetEntryData
};

export default exports;


