// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1CreateScheduleFromTemplateService
 */
import dateTimeService from 'js/dateTimeService';
import appCtxService from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';

var exports = {};
var getInitialLOVValueDeferred;

/**
 * Return the propObjects
 *
 * @param {Object} propObjects - The given propObjects.
 * @return {Object} propObjects - The given propObjects.
 */
export let getSaw1DeliverableObject = function( propObjects ) {
    if( appCtxService.ctx.activeToolsAndInfoCommand && appCtxService.ctx.activeToolsAndInfoCommand.commandId === 'Awp0AssignProjects' ) {
        return appCtxService.ctx.mselected;
    }
    return propObjects;
};

export let copySchedules = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    let soaInput = {
        containers: [
            {
                name: data.object_name.dbValue,
                description: data.object_desc.dbValue,
                scheduleToCopy: appCtxService.ctx.selected,
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
                stringValueContainer: [
                    {
                        key: 'is_template',
                        value: 'false',
                        type: 5
                    },
                    {
                        key: 'fnd0ShiftDate',
                        value: exports.getShiftDate( data ),
                        type: 1
                    }
                ],
                typedAttributesContainer: [
                    {
                        type: 'ScheduleType',
                        attributes: [
                            {
                                key:'saw1UnitOfTimeMeasure',
                                value:appCtxService.ctx.selected.props.saw1UnitOfTimeMeasure.dbValue,
                                type: 1
                            }
                        ]
                    }
                ]
            }
        ] };
    soaService.postUnchecked( 'ProjectManagement-2011-06-ScheduleManagement', 'copySchedules', soaInput
        , data.saveAsPolicy ).then( function( response ) {
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

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} startDate - The given start date object.
 * @param {date} finishDate - The given finish date object.
 * @param {Object} ctx The context object
 * @returns {String} The start date
 */
export let getDateString_startDate = function( startDate, finishDate, ctx ) {
    var endDateScheduling = ctx.selected.props.end_date_scheduling.dbValues[ 0 ];
    if( endDateScheduling === '1' ) {
        var finish = dateTimeService.formatUTC( finishDate );
        if( finish === '' ) {
            return dateTimeService.formatUTC( ctx.selected.props.finish_date.dbValues[ 0 ] );
        }
        return finish;
    }
    var start = dateTimeService.formatUTC( startDate );
    if( start === '' ) {
        return dateTimeService.formatUTC( ctx.selected.props.start_date.dbValues[ 0 ] );
    }
    return start;
};

export let getShiftDate = function( data ) {
    if( data.finishShiftDate.dateApi.dateObject ) {
        return dateTimeService.formatUTC( data.finishShiftDate.dateApi.dateObject );
    }
    return dateTimeService.formatUTC( data.startShiftDate.dateApi.dateObject );
};

/**
 * Returns the string value "true" or "false" for isTemplate property.
 * @param  {boolean} isTemplate - It can be true or false .
 * @returns {String} String value "true" or "false"
 */
export let getTemplateString = function( isTemplate ) {
    return isTemplate.toString();
};

/**
 * Method for checking if the end_date_scheduling property gets loaded for the selected Schedule Object.
 * @param {Object} ctx - Context Object
 * @returns {boolean} Flagto indicate if property needs to be loaded.
 */
export let checkForEndDateSchedulingProperty = function( ctx ) {
    var needToLoadProperty;
    if( typeof ctx.selected.props.end_date_scheduling === typeof undefined ) {
        needToLoadProperty = true;
    } else {
        needToLoadProperty = false;
    }
    return needToLoadProperty;
};

/**
 * Sets the date value for date property of create schedule from template panel.
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

/**
 * Method of populating shift date for create schedule from template panel.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let populateDefaultValueForShiftDate = function( templateDatePref, startShiftDate, finishShiftDate, selectedTemplate , fields) {
    if( selectedTemplate ) {
        // var schedule = data.dataProviders.getScheduleSearchProvider.selectedObjects[ 0 ];
        var isEndDateSchedule = parseInt( selectedTemplate.props.end_date_scheduling.dbValues[ 0 ] ) === 1;
        var isTemplateDatePrefOn = templateDatePref[ 0 ].toUpperCase() === 'true'.toUpperCase();
        var shiftDate = new Date();
        if( isTemplateDatePrefOn ) {
            if( isEndDateSchedule ) {
                setDateValueForProp( finishShiftDate, new Date( selectedTemplate.props.finish_date.dbValues[ 0 ] ) );
            } else {
                setDateValueForProp( startShiftDate, new Date( selectedTemplate.props.start_date.dbValues[ 0 ] ) );
            }
        } else {
            if( isEndDateSchedule ) {
                setDateValueForProp( finishShiftDate, shiftDate );
            } else {
                setDateValueForProp( startShiftDate, shiftDate );
            }
        }

        if( fields){
            if( isEndDateSchedule ) {
                fields.finishShiftDate.update(finishShiftDate.dbValue);
            }else{
                fields.startShiftDate.update(startShiftDate.dbValue);
            }
        }
    }
};

export let addSchedules = function( selectedTemplate, sharedData ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.selectedTemplate = [ selectedTemplate ];
    sharedData.update && sharedData.update( newSharedData );
};

export let removeTemplate = function( sharedData ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.selectedTemplate.pop();
    sharedData.update && sharedData.update( newSharedData );
};

/**
  * This method is used to get the LOV values of all Groups.
  * @param {Object} response the response of the soa
  * @param {Object} allGroups All Groups text
  * @returns {Object} all groups lov
  */
export let getGroupLov = function( response, allGroups ) {
    let groupList = [ {
        propInternalValue: '',
        propDisplayValue: allGroups
    } ];
    let responseList = response.ServiceData.modelObjects;
    if( responseList ) {
        for( let obj in responseList ) {
            let targetObj = cdm.getObject( obj );
            if( cdm.getObject( obj ).type === 'Group' ) {
                let calenderObject = {
                    propInternalValue: targetObj.uid,
                    propDisplayValue: targetObj.props.object_string.uiValues[ 0 ]
                };
                groupList.push( calenderObject );
            }
        }
    }
    return groupList;
};

/**
  * This method is used to get the LOV values of all Users.
  * @param {Object} response the response of the soa
  * @param {Object} allUsers All Users text
  * @returns {Object} all users lov
  */
export let getUserLov = function( response, allUsers ) {
    let userList = [ {
        propInternalValue: '',
        propDisplayValue: allUsers
    } ];
    let responseList = response.ServiceData.modelObjects;
    if( responseList ) {
        for( let obj in responseList ) {
            let targetObj = cdm.getObject( obj );
            if( cdm.getObject( obj ).type === 'User' ) {
                let calenderObject = {
                    propInternalValue: targetObj.uid,
                    propDisplayValue: targetObj.props.object_string.uiValues[ 0 ]
                };
                userList.push( calenderObject );
            }
        }
    }
    return userList;
};

exports = {
    getSaw1DeliverableObject,
    getDateString_startDate,
    getShiftDate,
    getTemplateString,
    checkForEndDateSchedulingProperty,
    populateDefaultValueForShiftDate,
    copySchedules,
    addSchedules,
    removeTemplate,
    getGroupLov,
    getUserLov
};

export default exports;
