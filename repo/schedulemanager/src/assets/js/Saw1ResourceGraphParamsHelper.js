// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1ResourceGraphParamsHelper
 */

import cdm from 'soa/kernel/clientDataModel';
import dateTimeService from 'js/dateTimeService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import localeSvc from 'js/localeService';
import iconSvc from 'js/iconService';

var exports = {};

var schTaskList = [];

/**
 * Creates and returns the input for getResourceGraphData SOA
 * @param {Object} ctx - The Context object
 * @return The input container for getResourceGraphData SOA
 */
export let getResourceGraphSOAInput = function( resourceVMO, props ) {
    schTaskList = [];
    var input = {};
    var resource = resourceVMO;
    if( resource ) {
        if( resource.modelType.typeHierarchyArray.indexOf( 'GroupMember' ) > -1 ) {
            var resourceProp = resource.props.user.dbValues[ 0 ];
            resource = cdm.getObject( resourceProp );
        }
        input = {
            startDate: resetTimeToZero( props.start_date.dbValues[ 0 ] ),
            endDate: props.finish_date.dbValues[ 0 ],
            resources: [
                resource
            ]
        };
    }
    return input;
};

/**
 * Reset the time to 00:00:00 to make it starting of the day
 * @param {Element} dateStringValue - The string representation of Date
 * @return The reset date is UTC format
 */
var resetTimeToZero = function( dateStringValue ) {
    var date = new Date( dateStringValue );
    date.setHours( 0 );
    date.setMinutes( 0 );
    date.setSeconds( 0 );
    return dateTimeService.formatUTC( date );
};

/**
 * Parse the getResourceGraphData SOA response to calculate availability, capacity and load
 * @param {Object} data - The Data object of panel
 * @param {Object} ctx - The Context object
 */
export let parseResGraphSOAOutput = function( resourceStacksVector, availability, dataLoad, iconURL, capacity, assignedTasksList, duration, fields ) {
    var schTaskUidList = [];
    var daysList = [];
    var resourceMinutes = 0;
    var occupiedMinutes = 0;
    var stacksVector = resourceStacksVector;
    for( var stacksIndex = 0; stacksIndex < stacksVector.length; stacksIndex++ ) {
        var eachStack = stacksVector[ stacksIndex ];
        var dayStackList = eachStack.stacks;
        for( var dayIndex = 0; dayIndex < dayStackList.length; dayIndex++ ) {
            var singleDay = dayStackList[ dayIndex ];
            var singleDayStacksList = singleDay.stack;
            for( var singleDayIndex = 0; singleDayIndex < singleDayStacksList.length; singleDayIndex++ ) {
                var stack = singleDayStacksList[ singleDayIndex ];
                var day = stack.day;
                if( day && !daysList.includes( day ) ) {
                    resourceMinutes += stack.resourceMinutes;
                    daysList.push( day );
                }
                occupiedMinutes += stack.taskMinutes;
                occupiedMinutes += stack.taskMinutesOverLoad;
                if( stack.schTaskUid && stack.schTaskUid !== 'AAAAAAAAAAAAAA' && stack.taskMinutes && !schTaskUidList.includes( stack.schTaskUid ) ) {
                    schTaskUidList.push( stack.schTaskUid );
                }
            }
        }
    }
    updatePanel( availability, dataLoad, iconURL, capacity, resourceMinutes, occupiedMinutes, duration );
    if( schTaskUidList.length > 0 ) {
        updateAssignedTasksProvider( assignedTasksList, schTaskUidList );
    }

    availability.value = availability.dbValue;

    if ( fields ) {
        fields.availability.update( availability.dbValue );
    }
};

/**
 * Update the panel with calculated availability, capacity and load
 * @param {Object} data - The Data object of panel
 * @param {Element} resourceMinutes - The available resource minutes as per calendar
 * @param {Element} occupiedMinutes - The assigned minutes for the resource
 * @param {Object} ctx - The Context object
 */

var updatePanel = function( availability, dataLoad, iconURL, capacity, resourceMinutes, occupiedMinutes, duration ) {
    var availableMinutes = resourceMinutes - occupiedMinutes;
    var availableHours = availableMinutes / 60;
    updatePropertyValue( availability, availableHours + 'h' );
    var load = 0;
    if( resourceMinutes !== 0 ) {
        load = occupiedMinutes / resourceMinutes * 100;
    }
    updatePropertyValue( dataLoad, load + '%' );

    var taskDuration = duration[ 0 ];

    var title = 'saw1AvailableText';
    var iconFlag = 'indicatorFlagGreen16.svg';
    if( availableMinutes < taskDuration ) {
        iconFlag = 'indicatorFlagRed16.svg';
        title = 'saw1OverbookedText';
    }

    var icon = iconSvc.getTypeIconFileUrl( iconFlag );

    iconURL.dbValue = icon;
    localeSvc.getLocalizedText( 'ScheduleManagerMessages', title ).then( function( result ) {
        iconURL.title = result;
    } );
    var resHours = resourceMinutes / 60;
    updatePropertyValue( capacity, resHours + 'h' );
};

/**
 * Update Property value
 * @param {Object} prop - The Property to be updated
 * @param {Element} value - The value to be assigned to given property
 */
var updatePropertyValue = function( prop, value ) {
    prop.dbValue = value;
    prop.uiValue = value;
    prop.uiValues[ 0 ] = value;
    prop.dispValue = value;
};

/**
 * Updates the Assigned Tasks provider with the ScheduleTasks
 * @param {Object} data - The Data object of panel
 * @param {Array} schTaskUidList - The list of assigned ScheduleTask Uids
 */
var updateAssignedTasksProvider = function( assignedTasksList, schTaskUidList ) {
    var input = {
        uids: schTaskUidList
    };
    soaSvc.post( 'Core-2007-09-DataManagement', 'loadObjects', input ).then(
        function( response ) {
            schTaskUidList.forEach( function( uid ) {
                var schTask = tcViewModelObjectSvc.createViewModelObjectById( uid );
                schTaskList.push( schTask );
                assignedTasksList.update( schTaskList );
            } );
        } );
};

export default exports = {
    getResourceGraphSOAInput,
    parseResGraphSOAOutput
};
