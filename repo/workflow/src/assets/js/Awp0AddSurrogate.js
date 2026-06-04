// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0AddSurrogate
 */
import messagingSvc from 'js/messagingService';
import dateTimeService from 'js/dateTimeService';
import AwPromiseService from 'js/awPromiseService';
import awp0WrkflwUtils from 'js/Awp0WorkflowUtils';
import eventBus from 'js/eventBus';

/**
 * Define public API
 */
var exports = {};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 * @returns {Date} Formatted date string
 */
export let getDateString = function( dateObject ) {
    return dateTimeService.formatUTC( dateObject );
};

/**
 * Validate that new user is being added as surrogate is not same as current user
 * and start date and end date are also valid then we need to perform addSurrogate action.
 *
 * @param {Object} data Data view model object
 * @param {Object} currentUser Current opened user object
 */
export let validateAndSetSurrogate = function( data, currentUser ) {
    var dateComparisonResult = 0;
    var startDate = data.startDate.dateApi.dateObject;
    var startDateString = dateTimeService.formatUTC( startDate );
    var endDate = data.endDate.dateApi.dateObject;
    var endDateString = dateTimeService.formatUTC( endDate );

    var skipComparision =  startDateString === '' && endDateString === '';

    if( startDateString === '' ) {
        startDate = dateTimeService.getDefaultDate( data.startDate.dateApi );
    }

    if( endDateString === '' ) {
        endDate = dateTimeService.getDefaultDate( data.startDate.dateApi );
    }

    // date1 - 1st date to compare. date2 - 2nd date to compare.
    //
    // The value <code>0</code> if the 'date2' is equal to 'date1'; a value less than <code>0</code> if 'date1'
    // is less than 'date2'; and a value greater than <code>0</code> if 'date1' is greater than 'date2'.

    dateComparisonResult = dateTimeService.compare( startDate, endDate );

    // Check if current opened user and new user both are same then we need to show error to user
    if( currentUser && data.userUids && currentUser.uid === data.userUids[0] ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidUser' );
    } else if( skipComparision || dateComparisonResult < 0 ) {
        eventBus.publish( 'surrogate.set' );
    } else if( dateComparisonResult >= 0 ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'endDateBeforeStartDateMessage' );
    }
};

/**
 * Check if surrogate list for open user and check if new group member object user is already present
 * then Add button should not be visible and return false from here.
 *
 * @param {object} currentUser - Current user that is already set
 * @param {object} selectedUser - The user that is selected
 *
 * @returns {boolean} True/False based on user can be added or not
 */
var isValidToAdd = function( currentUser, selectedUser ) {
    var isValidToShowAddButton = true;
    //if review task has a parent, then get its parent route task.
    if( currentUser && currentUser.props.surrogate_list && currentUser.props.surrogate_list.dbValues ) {
        var surrogateList = currentUser.props.surrogate_list.dbValues;

        if( selectedUser && selectedUser.props.user && selectedUser.props.user.dbValues ) {
            var userDBValue = selectedUser.props.user.dbValues[ 0 ];

            if( surrogateList && surrogateList.indexOf( userDBValue ) > -1 ) {
                isValidToShowAddButton = false;
            }
        }
    }
    return isValidToShowAddButton;
};

/**
 * Add new user to surrogate user list.
 *
 * @param {String} userObject - Current opened user object
 * @param {Array} selection - The new user need to be added
 * @returns {Object} Object that contains user that need to be shown along with it's valid to add or not.
 */
export let addUser = function( userObject, selection ) {
    var users = [];
    var userUids = [];
    var isValidToShowAddButton = false;
    if( userObject && selection && selection[ 0 ] ) {
        // Check before adding the user to check if selected user is already present in surrogate_list
        // if yes then add user to user list but don't set the isValidToShowAddButton to true
        users[ 0 ] =  selection[ 0 ];
        userUids[ 0 ] =  selection[ 0 ].props.user.dbValue;
        users[ 0 ].selected = false;
        if( isValidToAdd( userObject, selection[ 0 ] ) ) {
            isValidToShowAddButton = true;
        }
    }
    return {
        users : users,
        userUids : userUids,
        isValidToShowAddButton : isValidToShowAddButton
    };
};


/**
 * Add new user to surrogate user list.
 *
 * @param {Object} userObject User object for surrogate need to be added
 * @param {Array} selectedUsers Selected users array
 *
 * @returns {Object} Return object that hold new user and it's uid along with add button need to be shown or not.
 */
export let addSelectedUsers = function( userObject, selectedUsers, userPanelState ) {
    var deferred = AwPromiseService.instance.defer();
    if( userPanelState && selectedUsers ) {
    //return exports.addUser(  userObject, selectedUsers );
        awp0WrkflwUtils.getValidObjectsToAdd( userPanelState.criteria, selectedUsers ).then( function( validObjects ) {
            var returnObject = exports.addUser(  userObject, validObjects );
            deferred.resolve( returnObject );
        } );
    } else {
        deferred.resolve( [] );
    }
    return deferred.promise;
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0AddSurrogate
 */

export default exports = {
    validateAndSetSurrogate,
    addUser,
    addSelectedUsers,
    getDateString
};
