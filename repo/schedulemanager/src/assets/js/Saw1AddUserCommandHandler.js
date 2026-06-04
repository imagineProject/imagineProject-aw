// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1AddUserCommandHandler
 */
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};
var _assignUsers = null;

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let execute = function( vmo ) {
    if( vmo && vmo.uid ) {
        _assignUsers = vmo;
        eventBus.publish( 'Saw1AddUserCommand.addUser' );
    }
};

/**
 * Add User .Called when clicked on the add cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let addUser = function( data ) {
    for( var index = 0; index < data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects.length; index++ ) {
        if( data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects[ index ].uid === _assignUsers.props.user.value ) {
            throw 'assignmentUserError';
        }
    }
    removeFromAvailableUsers( data, _assignUsers );
    var updateMemberList = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;
    updateMemberList.push( _assignUsers );
    data.dataProviders.assignedUserList.update( updateMemberList );
    data.visibleSaveBtn = true;
};

/**
 * Add User .Called when clicked on the add cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let addScheduleMember = function( data ) {
    removeFromAvailableUsers( data, _assignUsers );
    var updateMemberList = data.dataProviders.assignedScheduleMemberList.viewModelCollection.loadedVMObjects;
    updateMemberList.push( _assignUsers );
    data.dataProviders.assignedScheduleMemberList.update( updateMemberList );
    data.visibleSaveBtn = true;
};

/**
 * Method to remove users from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAvailableUsers( data, vmo ) {
    var assignedUsersUid = [];
    assignedUsersUid.push( vmo.uid );
    var availModelObjects = data.dataProviders.userPerformSearch.viewModelCollection.loadedVMObjects;
    var modelObjects = $.grep( availModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, assignedUsersUid ) === -1;
    } );
    data.dataProviders.userPerformSearch.update( modelObjects );
}

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

exports = {
    execute,
    addUser,
    addScheduleMember,
    setCommandContext
};

export default exports;
