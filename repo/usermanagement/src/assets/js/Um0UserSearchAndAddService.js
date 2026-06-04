// Copyright (c) 2022 Siemens

/**
 * @module js/Um0UserSearchAndAddService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import _ from 'lodash';

var exports = {};

/**
 * This method prepares input structure for addUsersAsGroupMembers Soa to add single/multiple users to single/multiple role. 
 * @param {*} subPanelContext 
 * @param {*} dataProvider 
 * @returns 
 */
export let getAddUsersInput = function( subPanelContext, dataProvider ) {
    var inputs = [];
    var group = '';
    var role = '';
    var clientId = '';
    var input = '';
    var selectedUsers = dataProvider.selectedObjects;
    var usersToAdd = [];
    if(selectedUsers.length > 0){
        for(var j=0; j<selectedUsers.length; j++){
            var userToAdd = {
                user: {
                    type: "User",
                    uid: selectedUsers[j].uid
                }
            };
            usersToAdd.push(userToAdd);
        }
    }
    var selected = subPanelContext.searchState.pwaSelection;
    if( selected && selected.length > 0 ){
        for(var i=0; i<selected.length; i++){
            if(selected[i].type === 'Role' ){
                var groupid = selected[i].parentID ? selected[i].parentID :  subPanelContext.searchState.criteria.groupUID;
                group = {
                    type: "Group",
                    uid: groupid
                };
                role = {
                    type: "Role",
                    uid: selected[i].uid
                };
                                
                clientId = selected[i].uid;
                input = {
                    "clientId": clientId,
                    "usersToAdd": usersToAdd,
                    "grp": group,
                    "role": role
                };
                inputs.push(input);
            }
        }
    }
    else{
        //This will execute in List with Summary when navigating to Role in organization sublocation and nothing is selected in PWA. 
        group = {
            type: "Group",
            uid: subPanelContext.searchState.criteria.groupUID
        };
        role = {
            type: "Role",
            uid: subPanelContext.searchState.criteria.roleUID
        };
                        
        clientId = subPanelContext.searchState.criteria.roleUID;
        input = {
            "clientId": clientId,
            "usersToAdd": usersToAdd,
            "grp": group,
            "role": role
        };
        inputs.push(input);
    }
    return inputs;
};

/**
 * Prepare success and error messages.
 * @param {*} response 
 * @param {*} subPanelContext 
 * @param {*} dataProvider 
 * @returns message
 */
export let prepareSuccessAndFailureMessages = function( response, subPanelContext, dataProvider ) {
    var successMessage = "";
    var failureMessage = "";
    var multipleFailure = "";
    var message = '';
    var partialErrors = '';
    var resource = 'UsermanagementCommandPanelMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    
    // Check if input response is not null and contains partial errors then only
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }

    //get only selected role node from mixed node.
    var selected = getSelectedRoleNode("", subPanelContext);
    var selectedUsers = dataProvider.selectedObjects;
    
    //in list with summary mode when we navigate and open the role, then need to get the role object in which user will add.
    if(selected.length === 0){
        var roleObj = cdm.getObject( subPanelContext.searchState.criteria.roleUID );
        selected.push(roleObj);
    }
    var userName = selectedUsers[0].props.user_name.uiValue;            
    var roleName = selected[0].dbValue ? selected[0].dbValue : selected[0].props.role_name.uiValues[0];
    var groupName = selected[0].parent ? selected[0].parent.displayName : "";
    if(!groupName){
        groupName = getGroupName("", subPanelContext);
    }

    if( response && response.created && !partialErrors ) {       
            
        if(selected.length === 1 && selectedUsers.length === 1){
            //1 role selected and 1 user added
            //success message - "testuser1" user added to "testGroup/testRole".
            message = localTextBundle.addUserToRoleSuccess.replace( '{0}', userName );
            message = message.replace( '{1}', groupName);  
            message = message.replace( '{2}', roleName);  
        }
        if(selected.length === 1 && selectedUsers.length > 1){
            //1 role selected and multiple user added
            //success message - "2 user(s) were added to "testGroup/testRole".
            message = localTextBundle.addMultipleUsersToSingleRoleSuccess.replace( '{0}', selectedUsers.length );
            message = message.replace( '{1}', groupName);  
            message = message.replace( '{2}', roleName); 
        }
        if(selected.length > 1 && selectedUsers.length === 1){
            //multiple role selected and single user added
            //success message - "testu1" user added to roles.
            message = localTextBundle.addSingleUserToMultipleRoleSuccess.replace( '{0}', userName );
        }
        if(selected.length > 1 && selectedUsers.length > 1){
            //multiple role selected and multiple user added
            //success message - 1 users were added.
            message = localTextBundle.addMultipleUsersToMultipleRolesSuccess.replace( '{0}', selectedUsers.length );
        }
        successMessage = message;
    }
    else if( partialErrors ) {
        _.forEach( partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object, index ) {
                //This eror code is for The logged-in user is not an authorized user, a system administrator or a group administrator.
                if( object.code === 10733 ) {
                    if(partialError.clientId){
                        var role = selected.filter( obj => obj.uid === partialError.clientId )[0];
                        userName = selectedUsers[index].props.user_name.uiValue;  
                        roleName = role.dbValue ? role.dbValue : role.props.role_name.uiValues[0];
                        groupName = role.parent ? role.parent.displayName : "";
                        if(!groupName){
                            groupName = getGroupName("", subPanelContext);
                        }
                        var errmessage = localTextBundle.addUserToRoleFailure.replace( '{0}', userName );
                        errmessage = errmessage.replace( '{1}', groupName);  
                        errmessage = errmessage.replace( '{2}', roleName);
                        errmessage = errmessage.replace( '{3}', object.message);
                        if(selected.length === 1 && selectedUsers.length === 1){
                            failureMessage = errmessage;   
                        }
                        else{
                            //multiple failure message with reason                            
                            multipleFailure += '\n' + errmessage;
                        }
                    }
                }
                //Error code - 10035 Error creating member with duplicate role
                //show info message for this error code.
                else if( object.code === 10035 ) {
                    if(selected.length === 1 && selectedUsers.length === 1 ){
                        successMessage = localTextBundle.addUserToRoleSuccess.replace( '{0}', userName );
                        successMessage = successMessage.replace( '{1}', groupName);  
                        successMessage = successMessage.replace( '{2}', roleName);   
                    }
                    else if(selected.length > 1 && selectedUsers.length === 1){
                        //multiple role selected and single user added
                        //success message example - "testu1" user added to 2 roles.
                        successMessage = localTextBundle.addSingleUserToMultipleRoleSuccess.replace( '{0}', userName );
                    }
                    else{ 
                        //success message example - 2 uses were added.
                        successMessage = localTextBundle.addMultipleUsersToMultipleRolesSuccess.replace( '{0}', selectedUsers.length );
                    }
                }
                else {
                    failureMessage += '\n' + object.message;
                }
            } );
        } );

        if(selected.length > 1 || selectedUsers.length > 1){
            if(successMessage || response.created){
                //This message is set if it is partial success, 
                //partial error message for multiple role & user selection - "Operation partially failed.".
                message = localTextBundle.addMultipleUsersToRolesPartialFailure;
            }
            else{
                //Fully failed message for multiple role & add single user  - "User \"{0}\" was not added.".
                if(selectedUsers.length === 1){
                    message = localTextBundle.addSingleUserToMultipleRolesFailure.replace( '{0}', userName );
                }
                else{                
                    //Fully failed message for multiple role & user selection - "{0} of {1} users were added".
                    message = localTextBundle.addMultipleUsersToRolesFailure.replace( '{0}', 0 );
                    message = message.replace( '{1}', selectedUsers.length );  
                }
            }
        }        
        if(multipleFailure !== ""){
            failureMessage = message + multipleFailure;
        }
        
    }
    return {
        successMessage : successMessage,
        failureMessage : failureMessage
    };
};

/**
 * This method returns only role type node from mixed selected nodes.
 * @param {*} response 
 * @param {*} subPanelContext 
 * @returns 
 */
export let getSelectedRoleNode = function( response, subPanelContext ) {
    var partialErrors = '';
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    }
    if(subPanelContext.searchState && subPanelContext.searchState.pwaSelection){ 
        var selected = [ ...subPanelContext.searchState.pwaSelection ];        
        if(partialErrors){
            _.forEach( partialErrors, function( partialError ) {
                _.forEach( partialError.errorValues, function( object) {
                    //This eror code is for The logged-in user is not an authorized user, a system administrator or a group administrator.
                    //remove role from selection if it has error
                    if( object.code === 10733 ) {
                        let index = _.findIndex( selected, function( obj ) {
                            return obj.uid === partialError.clientId;
                        } );
                        if(index !== -1){
                            selected.splice( index, 1 ); 
                        }                       
                    }
                });
            });

        }
        if( selected && selected.length > 0 ) {
            return selected.filter( function( vmo ) { 
                return vmo.type === 'Role'; 
            } );
        }
    }
    return [];
};

/**
 * This method returns group name from full name.
 * if group is "testsubgrp.testgroup" then this gives "testsubgrp", This is used in success & error message.
 * @param {*} response 
 * @param {*} subPanelContext 
 * @returns 
 */
export let getGroupName = function( response, subPanelContext ) {
    var group = cdm.getObject( subPanelContext.searchState.criteria.groupUID );
    return group.props.name ? group.props.name.dbValues[0] : group.props.object_string.dbValues[0].split('.')[0];
};

exports = {
    getAddUsersInput,
    prepareSuccessAndFailureMessages,
    getSelectedRoleNode,
    getGroupName
};
export default exports;
