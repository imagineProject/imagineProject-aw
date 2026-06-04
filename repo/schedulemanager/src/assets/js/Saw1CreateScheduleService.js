// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1CreateScheduleService
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import saw1CreateObjectUtils from 'js/Saw1CreateObjectUtils';
import uwPropertySrv from 'js/uwPropertyService';
import xrtUtilities from 'js/xrtUtilities';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import messagingService from 'js/messagingService';

let exports;

/**
 * Set the default properties with isRequired flag and initial values.
 *
 * @param {*} createType The object type being created
 * @param {Object} edithandler The editHandler
 */
export let initializeDefaultProps = ( createType, editHandler, timezoneList ) => {
    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, 'CREATE', [ 'fnd0TimeZone', 'start_date', 'finish_date' ], editHandler );
    // Timezone
    if( appCtxService.ctx.preferences.SiteTimeZone && appCtxService.ctx.preferences.SiteTimeZone.length > 0 && editableProperties.fnd0TimeZone ) {
        let fnd0TimeZoneProp = { ...editableProperties.fnd0TimeZone };
        let siteTimeZone = appCtxService.ctx.preferences.SiteTimeZone[ 0 ];
        if( timezoneList.length > 0 ) {
            for( let i = 0; i < timezoneList.length; i++ ) {
                if( timezoneList[i].propInternalValue === siteTimeZone ) {
                    fnd0TimeZoneProp.dbValue = timezoneList[i].propInternalValue;
                    fnd0TimeZoneProp.dispValue = timezoneList[i].propDisplayValue;
                    fnd0TimeZoneProp.uiValue = timezoneList[i].propDisplayValue;
                    break;
                }
            }
        }
        if( fnd0TimeZoneProp ) {
            uwPropertySrv.setIsRequired( fnd0TimeZoneProp, true );
        }
        uwPropertySrv.updateDisplayValues( fnd0TimeZoneProp, [ fnd0TimeZoneProp.dispValue ] );
        updatedProps.push( fnd0TimeZoneProp );
    }

    // Start date
    if( editableProperties.start_date ) {
        let startDate = new Date();
        startDate = saw1CreateObjectUtils.resetTimeForDate( startDate, false );
        let startDateProp = { ...editableProperties.start_date };
        startDateProp.dbValue = new Date( startDate.toString() ).getTime();
        startDateProp.value = new Date( startDate.toString() ).getTime();
        startDateProp.isRequired = true;
        startDateProp.uiValue = startDate.toDateString();
        updatedProps.push( startDateProp );
    }

    // Finish date
    if( editableProperties.finish_date ) {
        let finishDate = new Date();
        finishDate = saw1CreateObjectUtils.resetTimeForDate( finishDate, true );
        let currentMonth = finishDate.getMonth();
        currentMonth += 3;
        if( currentMonth > 11 ) {
            currentMonth -= 11;
            finishDate.setFullYear( finishDate.getFullYear() + 1 );
        }
        finishDate.setMonth( currentMonth );
        let finishDateProp = { ...editableProperties.finish_date };
        finishDateProp.dbValue = new Date( finishDate.toString() ).getTime();
        finishDateProp.value = new Date( finishDate.toString() ).getTime();
        finishDateProp.isRequired = true;
        finishDateProp.uiValue = finishDate.toDateString();
        updatedProps.push( finishDateProp );
    }

    if( updatedProps.length > 0 ) {
        xrtUtilities.updateObjectsInDataSource( updatedProps, 'CREATE', createType, editHandler );
    }
};

/**
 * Method for invoking and registering/unregistering data for the Create Sch Task Panel
 *
 * @return {Array} default properties
 */
let getSchedulDefaultProperties = ( ) => {
    return [ 'object_name', 'object_desc', 'customer_name', 'customer_number',
        'finish_date', 'start_date', 'is_baseline', 'schedule_type', 'wbsformat', 'wbsvalue',
        'latest_start_date', 'earliest_finish_date', 'end_date_scheduling', 'recalc_type', 'recalc_schedule',
        'fnd0state', 'fnd0status', 'fnd0master_sched', 'fnd0allowExecUpdates', 'fnd0IsExternal',
        'activeschbaseline_tag', 'base_schedule_cost', 'schedule_deliverable_list', 'fnd0SummaryTask',
        'fnd0Schedulemember_taglist', 'sum_rollup_status', 'items_tag', 'sch_notification_count',
        'schedule_deliverable_list', 'fnd0SummaryTask', 'fnd0ScheduleTemplate', 'fnd0user_priv', 'owning_user',
        'item_id', 'notifications_enabled', 'percent_linked', 'act_date_preference', 'is_public',
        'fnd0ShiftDate', 'fnd0PriorityString', 'fnd0TimeZone', 'published', 'is_template'
    ];
};

/**
 * Returns the atrribute name equivalent to be used in create schedule SOA input
 *
 * @param {String} boProp - The property of the schedule
 * @return {String} Atrribute name equivalent to be used in create schedule SOA input
 */
let getCreateScheduleInputPropName = function( boPropName ) {
    let containerKeymap = {};
    containerKeymap.object_name = 'name';
    containerKeymap.object_desc = 'description';
    containerKeymap.customer_name = 'customerName';
    containerKeymap.customer_number = 'customerNumber';
    containerKeymap.item_id = 'id';
    containerKeymap.notifications_enabled = 'notificationsEnabled';
    containerKeymap.percent_linked = 'percentLinked';
    containerKeymap.is_public = 'isPublic';
    containerKeymap.is_template = 'isTemplate';
    containerKeymap.published = 'published';
    containerKeymap.start_date = 'startDate';
    containerKeymap.finish_date = 'finishDate';
    containerKeymap.fnd0status = 'status';
    containerKeymap.priority = 'priority';

    return containerKeymap[ boPropName ];
};

/**
 * Prepare the input for create Schedule SOA call
 *
 * @param {Object} createType - The type selected for creation
 * @param {Object} editHandler - The editHandler
 * *@return {Array} newScheduleProperties - Schedule Properties Array
 */
export let getCreateScheduleInput = ( createType, editHandler ) => {
    let scheduleProps = {
        taskFixedType: 0,
        type: createType,
        priority: 3,
        notificationsEnabled: true,
        stringValueContainer: [ {
            key: 'relateToNewStuff',
            value: 'true',
            type: 0 // Set a dummy value. This is unused on the server;
        } ]
    };

    let viewModelProperties = addObjectUtils.getObjCreateEditableProperties( createType, 'CREATE', null, editHandler );
    let defaultProperties = getSchedulDefaultProperties();
    let customProperties = [];

    viewModelProperties.forEach( vmProp => {
        if( defaultProperties.findIndex( propName => propName === vmProp.propertyName ) > -1 ) {
            let createInputPropName = getCreateScheduleInputPropName( vmProp.propertyName );
            if( createInputPropName ) {
                scheduleProps[ createInputPropName ] = vmProp.dbValue;
                if( vmProp.type === 'DATE' ) {
                    let dateString = saw1CreateObjectUtils.getValueAsString( vmProp );
                    if( !dateString ) {
                        throw 'invalidStartDateOrFinishDate';
                    }
                    scheduleProps[ createInputPropName ] = dateString;
                }
            } else {
                scheduleProps.stringValueContainer.push( {
                    key: vmProp.propertyName,
                    value: saw1CreateObjectUtils.getValueAsString( vmProp ),
                    type: 0 // Set a dummy value. This is unused on the server;
                } );
            }
        } else {
            customProperties.push( {
                key: vmProp.propertyName,
                value: saw1CreateObjectUtils.getValueAsString( vmProp ),
                type: 0 // Set a dummy value. This is unused on the server;
            } );
        }
    } );

    if( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure && appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure[ 0 ] ) {
        customProperties.push( {
            key: 'saw1UnitOfTimeMeasure',
            value: appCtxService.ctx.preferences.AWC_SM_Unit_Of_Time_Measure[ 0 ],
            type: 0 // Set a dummy value. This is unused on the server;
        } );
    }

    scheduleProps.typedAttributesContainer = [ {
        type: 'ScheduleType',
        attributes: customProperties
    } ];

    return [ scheduleProps ];
};

let getSchedulDefaultPropertiesForCopy = ( ) => {
    return [ 'start_date', 'finish_date', 'fnd0ShiftDate', 'is_template', 'is_public', 'end_date_scheduling', 'fnd0allowExecUpdates', 'dates_linked', 'wbsformat', 'wbsvalue', 'customer_name', 'customer_number' ];
};

/**
 * Prepare the input for copy Schedule SOA call
 *
 * @param {Object} createType - The type selected for creation
 * @param {Object} editHandler - The editHandler
 * *@return {Array} newScheduleProperties - Schedule Properties Array
 */
export let getCopyScheduleInput = ( xrtContext, xrtState, editHandler ) => {
    let xrtVMO = xrtState.xrtVMO;

    let scheduleProps = {
        name: xrtVMO.props.object_name.dbValue,
        description: xrtVMO.props.object_desc.uiValue,
        scheduleToCopy: xrtContext.sourceObjects[ 0 ],
        options: {
            logicalOptions: [
                {
                    name: 'showAlert',
                    value: true
                },
                {
                    name: 'relateToNewStuff',
                    value: true
                },
                {
                    name: 'resetWork',
                    value: true
                }
            ],
            integerOptions: [],
            stringOptions: []
        },
        stringValueContainer: []
    };

    let vmProps = addObjectUtils.getObjCreateEditableProperties( '', 'SAVEAS', null, editHandler );
    let defaultProperties = getSchedulDefaultPropertiesForCopy();
    let propsArray = Object.keys( xrtVMO.props );
    let customProperties = [];
    let viewModelProperties = [];

    vmProps.forEach( vmProp => {
        if ( vmProp && propsArray.includes( vmProp.propertyName ) && !viewModelProperties.some( existingVmProp => existingVmProp.propertyName === vmProp.propertyName ) ) {
            viewModelProperties.push( vmProp );
        }
    } );

    viewModelProperties.forEach( vmProp => {
        if( defaultProperties.findIndex( propName => propName === vmProp.propertyName ) > -1 ) {
            if( vmProp.type === 'DATE' ) {
                let dateString = saw1CreateObjectUtils.getValueAsString( vmProp );
                if( !dateString ) {
                    throw 'invalidStartDateOrFinishDate';
                }
                scheduleProps.stringValueContainer.push( {
                    key: 'fnd0ShiftDate',
                    value: dateString,
                    type: 0 // Set a dummy value. This is unused on the server;
                } );
            } else {
                scheduleProps.stringValueContainer.push( {
                    key: vmProp.propertyName,
                    value: saw1CreateObjectUtils.getValueAsString( vmProp ),
                    type: 0 // Set a dummy value. This is unused on the server;
                } );
            }
        } else {
            customProperties.push( {
                key: vmProp.propertyName,
                value: saw1CreateObjectUtils.getValueAsString( vmProp ),
                type: 0 // Set a dummy value. This is unused on the server;
            } );
        }
    } );

    customProperties.push( {
        key: 'saw1UnitOfTimeMeasure',
        value: xrtContext.sourceObjects[ 0 ].props.saw1UnitOfTimeMeasure.dbValue,
        type: 0 // Set a dummy value. This is unused on the server;
    } );

    scheduleProps.typedAttributesContainer = [ {
        type: 'ScheduleType',
        attributes: customProperties
    } ];

    return [ scheduleProps ];
};

/**
 * Set the default properties with initial values.
 *
 * @param {*} createType The object type being created
 * @param {String} type - The type is as SAVEAS
 * @param {Object} edithandler The editHandler
 * @param {Object} schedule The selected schedule object
 */
export let initializeDefaultPropsOnSaveAs = ( createType, type, editHandler, schedule ) => {
    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, type, [ 'start_date', 'finish_date' ], editHandler );
    var isTemplateDatePrefOn = appCtxService.ctx.preferences.SM_TEMPLATE_DATE[ 0 ].toUpperCase() === 'true'.toUpperCase();
    var isEndDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ] === '1';

    if( isTemplateDatePrefOn ) {
        if( isEndDateSchedule && editableProperties.finish_date ) {
            let finishDate = new Date( schedule.props.finish_date.dbValues[ 0 ] );
            let finishDateProp = { ...editableProperties.finish_date };
            finishDateProp.dbValue = new Date( finishDate.toString() ).getTime();
            finishDateProp.value = new Date( finishDate.toString() ).getTime();
            finishDateProp.uiValue = finishDate.toDateString();
            updatedProps.push( finishDateProp );
        } else if( editableProperties.start_date ) {
            let startDate = new Date( schedule.props.start_date.dbValues[ 0 ] );
            let startDateProp = { ...editableProperties.start_date };
            startDateProp.dbValue = new Date( startDate.toString() ).getTime();
            startDateProp.value = new Date( startDate.toString() ).getTime();
            startDateProp.isRequired = true;
            startDateProp.uiValue = startDate.toDateString();
            updatedProps.push( startDateProp );
        }
    } else {
        if( isEndDateSchedule && editableProperties.finish_date ) {
            let finishDate = new Date();
            finishDate = saw1CreateObjectUtils.resetTimeForDate( finishDate, true );
            let finishDateProp = { ...editableProperties.finish_date };
            finishDateProp.dbValue = new Date( finishDate.toString() ).getTime();
            finishDateProp.value = new Date( finishDate.toString() ).getTime();
            finishDateProp.uiValue = finishDate.toDateString();
            updatedProps.push( finishDateProp );
        } else if( editableProperties.start_date ) {
            let startDate = new Date();
            startDate = saw1CreateObjectUtils.resetTimeForDate( startDate, false );
            let startDateProp = { ...editableProperties.start_date };
            startDateProp.dbValue = new Date( startDate.toString() ).getTime();
            startDateProp.value = new Date( startDate.toString() ).getTime();
            startDateProp.isRequired = true;
            startDateProp.uiValue = startDate.toDateString();
            updatedProps.push( startDateProp );
        }
    }
    if( updatedProps.length > 0 ) {
        xrtUtilities.updateObjectsInDataSource( updatedProps, 'SAVEAS', createType, editHandler );
    }
};

export let copyScheduleInProcess = function( ) {
    return true;
};

export let copyScheduleProcessEnd = function( createdSchedule ) {
    let copyScheduleInProcessFlag = true;
    if( createdSchedule !== undefined ) {
        copyScheduleInProcessFlag = false;
    }
    return copyScheduleInProcessFlag;
};

export let copySchedules = function( addPanelState, xrtState, saveAsEditHandler, saveAsPolicy ) {
    var deferred = AwPromiseService.instance.defer();
    let soaInput = {
        containers:getCopyScheduleInput( addPanelState, xrtState, saveAsEditHandler )
    };
    // let soaInput = getCopyScheduleInput(addPanelState,xrtState,saveAsEditHandler)
    soaService.postUnchecked( 'ProjectManagement-2011-06-ScheduleManagement', 'copySchedules', soaInput
        , saveAsPolicy ).then( function( response ) {
        if( response.scheduleResponse.length > 0 ) {
            deferred.resolve( {
                createdSchedule : response.scheduleResponse[0].schedule
            } );
        } else if( response.ServiceData && response.ServiceData.partialErrors ) {
            var error = null;
            error = soaService.createError( response.ServiceData );
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            deferred.reject( error );
        }
    } );
    return deferred.promise;
};


exports = {
    initializeDefaultProps,
    getCreateScheduleInput,
    getCopyScheduleInput,
    initializeDefaultPropsOnSaveAs,
    copyScheduleInProcess,
    copyScheduleProcessEnd,
    copySchedules
};

export default exports;
