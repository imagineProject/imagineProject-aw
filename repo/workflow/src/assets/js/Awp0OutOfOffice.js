// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0OutOfOffice
 */
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import messagingSvc from 'js/messagingService';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import awp0WrkflwUtils from 'js/Awp0WorkflowUtils';
import _ from 'lodash';

/**
 * Define public API
 */
var exports = {};
let NULLDATE = '0001-01-01T00:00:00+00:00';
/**
 *
 * @param {Object} user User object that has been set as OOO.
 *
 * @returns {Object} Updated user properties object that will be displayed on UI.
 */
var _formatDelegateViewModelObject = function( user ) {
    var userObject = _.clone( user );
    var group = userObject.props.group.uiValues[ 0 ];
    var role = userObject.props.role.uiValues[ 0 ];
    var userName = userObject.props.user.uiValues[ 0 ];
    var newCellProps = [];
    newCellProps.push( ' User Name \\:' + userName );
    newCellProps.push( ' Group Role Name \\:' + group + '/' + role );
    userObject.props.awp0CellProperties.dbValues = newCellProps;
    userObject.props.awp0CellProperties.uiValues = newCellProps;
    return userObject;
};

/**
 * Get the existing user details and return so that it can be shown on UI.
 *
 * @param {Object} currentUser Current user object for profile page is seen.
 *
 * @returns {Object} Object that holds all info like users and existing inbox delegate
 *         uid set so that this can be seen correctly on data provider.
 */
export let loadExistingDelegates = function( currentUser ) {
    if( currentUser && currentUser.props && currentUser.props.inbox_delegate ) {
        var inboxDelegateUID = currentUser.props.inbox_delegate.dbValues[ 0 ];
        if( inboxDelegateUID !== '' ) {
            var uidsToLoad = [];
            uidsToLoad.push( inboxDelegateUID );
            return dmSvc.getProperties( uidsToLoad, [ 'group', 'role', 'user' ] ).then( function() {
                var inboxDelegateObject = cdm.getObject( inboxDelegateUID );
                var formattedVMO = _formatDelegateViewModelObject( inboxDelegateObject );
                var delegateArray = [];
                delegateArray.push( formattedVMO );
                return {
                    users : delegateArray,
                    inboxDelegateUID : inboxDelegateUID
                };
            } );
        }
    }
    return Promise.resolve( {
        users: [],
        inboxDelegateUID : null
    } );
};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 *
 * @returns {String} Date value string
 */
export let populateDateTimeWidget = function( startDate, endDate, userObject ) {
    if( userObject.props.fnd0OutOfOfficeStartDate.dbValues[0] ===  NULLDATE  || userObject.props.fnd0OutOfOfficeEndDate.dbValues[0] === NULLDATE  ) {
        return;
    }
    let startDateWidget = { ...startDate };
    let endDateWidget = { ...endDate };
    startDateWidget.dbValue = Date.parse( userObject.props.fnd0OutOfOfficeStartDate.dbValues[0] );
    endDateWidget.dbValue = Date.parse( userObject.props.fnd0OutOfOfficeEndDate.dbValues[0] );
    return{
        startDate:startDateWidget,
        endDate:endDateWidget
    };
};
/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 *
 * @returns {String} Date value string
 */
export let getDateString = function( dateObject ) {
    var dateValue;
    dateValue = dateTimeService.formatUTC( dateObject );
    return dateValue;
};

/**
 * Validate that new user is being added as OOO is not same as current user
 * and start date and end date are also valid then we need to perform OOO action.
 *
 * @param {Object} data Data view model object
 * @param {Object} currentUser Current opened user object
 */
export let validateAndSetOutOfOffice = function( data, currentUser ) {
    var dateComparisonResult = 0;
    var startDate = data.startDate.dateApi.dateObject;
    var startDateString = dateTimeService.formatUTC( startDate );
    var endDate = data.endDate.dateApi.dateObject;
    var endDateString = dateTimeService.formatUTC( endDate );

    // This code is needed if both start date and end date are empty string then we really
    // don't need to compare the dates as start date will be picked up default today date.
    // Second check is for if end date is empty string that means user has not set the end date
    // or don't want to set the end date then date comparison doesn't really matter and we need
    // to set the out of office. So we are setting skipComparision flag to tue. Fix for defect # LCS-672295
    var skipComparision =  startDateString === '' && endDateString === '' || endDateString === '';

    if( startDateString === '' ) {
        startDate = dateTimeService.getDefaultDate( data.startDate.dateApi );
    }

    // If end date is empty then we need to use default date from start date only
    // for date comparison
    if( endDateString === '' ) {
        endDate = dateTimeService.getDefaultDate( data.startDate.dateApi );
    }

    // date1 - 1st date to compare. date2 - 2nd date to compare.
    //
    // The value <code>0</code> if the 'date2' is equal to 'date1'; a value less than <code>0</code> if 'date1'
    // is less than 'date2'; and a value greater than <code>0</code> if 'date1' is greater than 'date2'.

    dateComparisonResult = dateTimeService.compare( startDate, endDate );

    var selectedUser = null;
    if( data.users && data.users[ 0 ] ) {
        selectedUser = data.users[ 0 ].props.user.dbValue;
    }

    if( currentUser && currentUser.uid === selectedUser ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidUser' );
    } else if( skipComparision || dateComparisonResult < 0 ) {
        eventBus.publish( 'outOfOffice.set' );
    } else if( dateComparisonResult >= 0 ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'endDateBeforeStartDateMessage' );
    }
};

/**
 * Clear all properties and return the values.
 *
 * @param {Object} data Data view model object.
 *
 * @returns {Object} Object that will contains all properties as empty and start and end date empty as well.
 */
export let clearOutOfOfficePanel = function( data ) {
    const startDate = { ...data.startDate };
    startDate.dbValue = '';
    startDate.uiValue = '';
    startDate.dateApi.dateValue = '';
    startDate.dateApi.timeValue = '';

    const endDate = { ...data.endDate };
    endDate.dbValue = '';
    endDate.uiValue = '';
    endDate.dateApi.dateValue = '';
    endDate.dateApi.timeValue = '';

    return {
        users : [],
        inboxDelegateUID : null,
        startDate : startDate,
        endDate : endDate
    };
};

/**
 * Add new user to out of office user list.
 * @param {String} selectedUsers - The new users to be added
 *
 * @returns {Array} User objects that need to be shown on data provider.
 */
export let addSelectedUsers = function( selectedUsers, userPanelState ) {
    var deferred = AwPromiseService.instance.defer();
    if( userPanelState && selectedUsers ) {
        awp0WrkflwUtils.getValidObjectsToAdd( userPanelState.criteria, selectedUsers ).then( function( validObjects ) {
            var users = [];
            if( validObjects && validObjects[ 0 ] ) {
                users[ 0 ] =  validObjects[ 0 ];
            }
            deferred.resolve( users );
        } );
    } else {
        deferred.resolve( [] );
    }
    return deferred.promise;
};

/**
 * This factory creates a service and returns exports
 *
 * @member AddParticipant
 */

export default exports = {
    loadExistingDelegates,
    getDateString,
    validateAndSetOutOfOffice,
    clearOutOfOfficePanel,
    addSelectedUsers,
    populateDateTimeWidget
};
