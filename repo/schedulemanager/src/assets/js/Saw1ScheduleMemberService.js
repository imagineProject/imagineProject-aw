// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1ScheduleMemberService
 */
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import _ from 'lodash';

var exports = {};

/**
 * Add selected users to input data provider object.
 * @param {Array} selectedObjects Selected users that need to be added.
 * @param {Object} dataProviderToUpdate Data provider object where objects will be added.
 * @returns {boolean}
 */
let _addSelectedUsersInternal = function( selectedObjects, dataProviderToUpdate ) {
    if( selectedObjects && dataProviderToUpdate ) {
        let allResources = dataProviderToUpdate.viewModelCollection.loadedVMObjects;

        _.forEach( selectedObjects, function( vmo ) {
            vmo.selected = false;
            allResources.push( vmo );
        } );

        //Update data provider.
        dataProviderToUpdate.update( allResources );
    }
    return true;
};

/**
 * Based on input property name find the respective data provider that need to be updated.
 * @param {Object} data Data view model object
 * @param {String} propName Property name to find out data provider object where objects will be added/removed.
 * @returns {Object} Data provider object
 */
let _getRespectiveDataProvider = function( data, propName ) {
    let dataProvider = null;

    if( propName === 'participant' ) {
        dataProvider = data.dataProviders.participantDataProvider;
    } else if( propName === 'observer' ) {
        dataProvider = data.dataProviders.observerDataProvider;
    } else if( propName === 'coordinator' ) {
        dataProvider = data.dataProviders.coordinatorDataProvider;
    }
    return dataProvider;
};

/**
 * Remove already assigned users from selected users.
 * @param {Object} data Data view model object
 * @param {Array} selectedObjects Selected users that need to be added.
 * @returns {Array} Selected users after removing already assigned users.
 */
let _removeAlreadyAssignedUsers = function( data, selectedUsers ) {
    let allModelObjects = [];
    let allModelObjectsName = [];

    // Get all loaded from all data providers.
    Object.values( data.dataProviders ).forEach( function( dataProvider ) {
        const modelObjects = dataProvider.viewModelCollection.loadedVMObjects;
        modelObjects.forEach( ( vmo ) => {
            allModelObjects.push( vmo.uid );
            allModelObjectsName.push( vmo.props.object_string.dbValues[0] );
        } );
    } );

    let uniqueMembers = [];
    let repeatedMembers = [];

    // Remove already assigned users from selected users.
    selectedUsers.forEach( function( user ) {
        let index = allModelObjects.indexOf( user.uid );

        if( index > -1 ) {
            repeatedMembers.push( allModelObjectsName[index] );
        } else {
            uniqueMembers.push( user );
        }
    } );

    // Show warning message if duplicate users are being added.
    if( repeatedMembers.length > 0 ) {
        const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
        const localizedMsg = localTextBundle.repeatedMembersErrorMsg.replace( '{0}', repeatedMembers.join( ';' ) );
        messagingService.showWarning( localizedMsg );
    }

    return uniqueMembers;
};

/**
 * Add the input selected users to input prop name based data provider object.
 * @param {Object} data Data view model object
 * @param {Array} selectedUsers Selected users that need to be added.
 * @param {String} propName Property name to find out data provider object where objects will be added.
 * @returns {boolean} isAddScheduleMembersInProgress True/False
 */
export let addSelectedUsers = function( data, selectedUsers, propName ) {
    let isAddScheduleMembersInProgress = false;

    if( !selectedUsers || _.isEmpty( selectedUsers ) || !propName ) {
        return isAddScheduleMembersInProgress;
    }

    // Remove already assigned users from selected users list.
    selectedUsers = _removeAlreadyAssignedUsers( data, selectedUsers );

    if( !selectedUsers || _.isEmpty( selectedUsers ) ) {
        return isAddScheduleMembersInProgress;
    }

    // Get data provider which needs to be updated based on propName.
    let dataProvider = _getRespectiveDataProvider( data, propName );

    if( !dataProvider ) {
        return isAddScheduleMembersInProgress;
    }

    // Add the input selected users to correct data provider.
    return _addSelectedUsersInternal( selectedUsers, dataProvider );
};

/**
 * Add propName information to addUserPanelState when people picker panel is opened.
 * propName information is needed to know which panel section (Participant/Observer/Coordinator)
 * selected users will get added.
 * @param {Object} commandContext Command context object that has propName information.
 * @param {Object} addUserPanelState Object that need to be updated for info.
 * @param {String} selectedUid Initial selection Uid
 */
export let updateProviderInformation = function( commandContext, addUserPanelState, selectedUid ) {
    if( addUserPanelState && commandContext ) {
        const localAddUserPanelState = { ...addUserPanelState.value };
        const propName = commandContext.propName;
        localAddUserPanelState.propName = propName;
        localAddUserPanelState.criteria.selectedObject = selectedUid;
        addUserPanelState.update && addUserPanelState.update( localAddUserPanelState );
    }
};

/**
 * Remove selected Users from command panel section.
 * @param {Object} data Data view model object.
 * @param {Object} propName Property name to find out data provider object from which selected objects needs to be removed.
 * @return {Boolean} isRemoveScheduleMembersInProgress True/False.
 */
export let removeUsers = function( data, propName ) {
    let isRemoveScheduleMembersInProgress = false;

    if( !propName ) {
        return isRemoveScheduleMembersInProgress;
    }

    // Get data provider which needs to be updated based on propName.
    const dataProvider = _getRespectiveDataProvider( data, propName );

    if( dataProvider ) {
        // Get all loaded objects of data provider.
        const modelObjects = dataProvider.viewModelCollection.loadedVMObjects;
        let validObjects = [];

        // Get selected objects from data provider.
        const removeObjects = dataProvider.selectedObjects;

        // Remove selected objects from loaded objects and update the provider.
        if( modelObjects && modelObjects.length > 0 && removeObjects && removeObjects.length > 0 ) {
            validObjects = _.difference( modelObjects, dataProvider.selectedObjects );
            dataProvider.update( validObjects, validObjects.length );
        }
    }

    isRemoveScheduleMembersInProgress = true;
    return isRemoveScheduleMembersInProgress;
};

/**
 * Get membership level information based on dataProvider.
 * @param {Object} providerName dataProvider name on which users needs to be added.
 * @return {Integer} membershipLevel -1/0/1/2.
 */
let getMembershipData = function( providerName ) {
    let membershipLevel = -1;
    if( providerName === 'observerDataProvider' ) {
        membershipLevel = 0;
    } else if( providerName === 'participantDataProvider' ) {
        membershipLevel = 1;
    } else {
        membershipLevel = 2;
    }
    return membershipLevel;
};

/**
 * Create input for addMemberships SOA, Get users from Participant/Coordinator/Observer section and create input.
 * @param {Object} data Data view model object.
 * @param {Object} scheduleObject Schedule object in which members are to be added.
 * @return {Object} input for addMemberships SOA.
 */
export let addSelectedMembers = function( data, scheduleObject ) {
    let membershipData = [];
    Object.values( data.dataProviders ).forEach( function( dataProvider ) {
        let resources = dataProvider.viewModelCollection.loadedVMObjects;
        if( resources && resources.length > 0 ) {
            let membershipLevel = getMembershipData( dataProvider.name );

            resources.forEach( resource => {
                let members =  {
                    schedule: scheduleObject,
                    resource: resource,
                    membershipLevel: membershipLevel,
                    cost: '',
                    currency: '0'
                };
                membershipData.push( members );
            } );
        }
    } );

    return membershipData;
};

export default exports = {
    addSelectedUsers,
    updateProviderInformation,
    removeUsers,
    addSelectedMembers
};
