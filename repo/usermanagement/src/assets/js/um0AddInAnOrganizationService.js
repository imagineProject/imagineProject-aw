// Copyright (c) 2022 Siemens

/**
 * @module js/um0AddInAnOrganizationService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import Um0UserSearchAndAddService from 'js/Um0UserSearchAndAddService';

var exports = {};

//To Open Um0AddInAnOrganization(Add Group), Um0AddShowObjects (Add Role & Add User) dialog
export const OpenDialogAction = ( input ) => {
    const  commandContext = input.commandContext;
    //If DIalog action specified for ex : In empty workarea action link can open dialog which will pass the dialog action in input and not from command context
    const dialogAction = input.dialogAction ? input.dialogAction : commandContext.dialogAction;
    const subPanelContext = commandContext;
    subPanelContext.panelType = input.panelType;
    const commandId = input.commandId;
    if( subPanelContext.objectSetSource && commandContext.searchState ) {
        //If the dialog is opened from SWA object set table
        subPanelContext.selectionData.selected = commandContext.searchState.pwaSelection;
    }
    if( dialogAction ) {
        let options = {
            view: commandId,
            parent: '.aw-layout-workareaMain',
            width: 'MEDIUM',
            height: 'FULL',
            isCloseVisible: false,
            subPanelContext:subPanelContext,
            isPinUnpinEnabled:input.isPinUnpinEnabled
        };
        dialogAction.show( options );
    }
};

/**
 * Publish doSearch event.
 *
 * @param {String} searchString - searchString
 * @param {bool} isGroupRadioButtonSelected - isGroupRadioButtonSelected
 */
export let doSearch = function( searchString, isGroupRadioButtonSelected, subPanelContext ) {
    //PanelType is set on add user and add role commands
    //If Add Panel is open for add user command then panelType is "User"
    var panelType = subPanelContext ? subPanelContext.panelType : null;
    if( searchString ) {
        if( panelType === 'User' ) {
            appCtxSvc.registerCtx( 'icsContentTypeString', 'User' );
        } else if( isGroupRadioButtonSelected ) {
            appCtxSvc.registerCtx( 'icsContentTypeString', 'Group' );
        } else {
            appCtxSvc.registerCtx( 'icsContentTypeString', 'Role' );
        }
        eventBus.publish( 'ics.doSearch' );
    }
};

export let getState = function() {
    return AwStateService.instance;
};

/**
 * Set command context for getting last selected Group object from URL when nothing selected on primaryworkArea
 */
export let getObjectFromBreadCrumb = function() {
    // Initialize variable to show search on add panel.
    appCtxSvc.registerCtx( 'showSearchOnPanel', false );

    appCtxSvc.registerCtx( 'lastSelectedObject', null );
    appCtxSvc.registerCtx( 'lastSelectedGroupObject', null );

    //Route the request and let appropriate listeners react to it
    var stateSvc = exports.getState();
    if( stateSvc && stateSvc.params ) {
        var newD_uid = '';
        var d_uid = stateSvc.params.d_uids;
        var s_uid = stateSvc.params.s_uid;
        var mObject;
        if( s_uid && s_uid !== 'SiteLevel' ) {
            appCtxSvc.registerCtx( 'showSearchOnPanel', true );
            mObject = cdm.getObject( s_uid );
            appCtxSvc.registerCtx( 'lastSelectedObject', mObject );
        }
        if( d_uid ) {
            appCtxSvc.registerCtx( 'showSearchOnPanel', true );
            var d_uidsArray = d_uid.split( '^' );
            if( s_uid ) {
                newD_uid = d_uidsArray[ d_uidsArray.length - 1 ];
                mObject = cdm.getObject( newD_uid );
                appCtxSvc.registerCtx( 'lastSelectedGroupObject', mObject );
            } else {
                newD_uid = d_uidsArray[ d_uidsArray.length - 2 ];
                s_uid = d_uidsArray[ d_uidsArray.length - 1 ];

                mObject = cdm.getObject( s_uid );
                appCtxSvc.registerCtx( 'lastSelectedObject', mObject );

                mObject = cdm.getObject( newD_uid );
                appCtxSvc.registerCtx( 'lastSelectedGroupObject', mObject );
            }
        }
    }
};

/**
 * @memberof TcSearchService
 * @param {Array} searchResults - searchResults
 */
export let getUsersToAdd = function( searchResults ) {
    var selected = [];
    if( searchResults ) {
        for( var i = 0; i < searchResults.length; i++ ) {
            var userObj = {};
            userObj.user = searchResults[ i ];
            selected.push( userObj );
        }
    }
    appCtxSvc.registerCtx( 'selectedUsers', selected );
};

/**
 * Publish addAdminObjects event.
 *
 * @param {String} selectedPanelId - selectedPanelId
 * @param {bool} isGroupRadioButtonSelected - isGroupRadioButtonSelected
 * @param {Array[]} searchResults - searchResults
 */
export let addAdminObjects = function( selectedPanelId, isGroupRadioButtonSelected, subPanelContext, searchResults ) {
    exports.getObjectFromBreadCrumb();
    let lastSelectedObject = appCtxSvc.getCtx( 'lastSelectedObject' );
    let mselected = appCtxSvc.getCtx( 'mselected' );
    var panelType = subPanelContext ? subPanelContext.panelType : null;

    if( selectedPanelId === 'OrganizationNewTab' || selectedPanelId === 'SecondaryWorkAreaNewTab' ) {
        if( isGroupRadioButtonSelected === true ) {
            eventBus.publish( 'ics.createGroup' );
        } else if( isGroupRadioButtonSelected === false && lastSelectedObject !== null &&
            lastSelectedObject.type !== 'Role' ) {
            eventBus.publish( 'ics.createRoleInGroup' );
        } else if( lastSelectedObject !== null &&
            lastSelectedObject.type === 'Role' ) {
            eventBus.publish( 'ics.createPersonObject' );
        } else if( mselected !== null && mselected[ 0 ].type === 'Group' ) {
            eventBus.publish( 'ics.createRoleInGroup' );
        }
    } else if( selectedPanelId === 'OrganizationSearchTab' || selectedPanelId === 'SecondaryWorkAreaSearchTab' ) {
        if( mselected === null || mselected && mselected.length === 0  ) {
            if( lastSelectedObject !== null && lastSelectedObject.type === 'Role' ) {
                exports.getUsersToAdd( searchResults );
                eventBus.publish( 'ics.addUsers' );
            } else if( lastSelectedObject !== null &&
                lastSelectedObject.type === 'Group' ) {
                if( isGroupRadioButtonSelected ) {
                    // Group radio button selected
                    eventBus.publish( 'ics.addChildGroups' );
                } else {
                    // Role radio button selected
                    eventBus.publish( 'ics.addRoles' );
                }
            }
        }else if( panelType === 'User' || mselected[ 0 ].type === 'User' && lastSelectedObject !== null &&
            lastSelectedObject.type === 'Role'  ) {
            exports.getUsersToAdd( searchResults );
            eventBus.publish( 'ics.addUsers' );
        } else if( panelType === 'Role' || mselected[ 0 ].type === 'Group' ||
            lastSelectedObject !== null && lastSelectedObject.type === 'Group' ) {
            if( lastSelectedObject !== null &&
                lastSelectedObject.type === 'Group' ) {
                appCtxSvc.registerCtx( 'lastSelectedObject', lastSelectedObject );
            } else if( lastSelectedObject !== null &&
                mselected[ 0 ].type === 'Group' ) {
                appCtxSvc.registerCtx( 'lastSelectedObject', mselected[ 0 ] );
            }
            if( isGroupRadioButtonSelected ) {
                // Group radio button selected
                eventBus.publish( 'ics.addChildGroups' );
            } else {
                // Role radio button selected
                eventBus.publish( 'ics.addRoles' );
            }
        }
    }
};

/**
 * um0AddInAnOrganizationService service utility
 */
export let loadPanelTabs = function( visibleTabs, subPanelContext ) {
    var groupUID = subPanelContext.searchState.criteria.groupUID;
    exports.getObjectFromBreadCrumb();
    const tabChangeCallback = ( pageId, tabTitle ) => {
        eventBus.publish( 'saveAsObject.tabChange', {
            pageId: pageId,
            tabTitle: tabTitle
        } );
    };
    var s_uid = '';
    var stateSvc = exports.getState();
    if( stateSvc && stateSvc.params ) {
        s_uid = stateSvc.params.s_uid;
    }
    if ( !subPanelContext.objectSetSource ) {
        //this block of code is used to remove search tab from array for Add group command when there is no selection
        if ( ( !subPanelContext.selectionData.selected || subPanelContext.selectionData.selected.length === 0 || s_uid === 'SiteLevel' ) && !groupUID ) {
            visibleTabs.splice( 1, 1 );
        } else if ( subPanelContext.selectionData.selected ) {
            var totalSelectedObjects = subPanelContext.selectionData.selected.length;
            if ( totalSelectedObjects > 1 ) {
                // removes the first tab from visibleTabs array and return the tabs
                visibleTabs.shift();
            }
        }
    }
    return {
        visibleTabs: visibleTabs,
        api: tabChangeCallback
    };
};


/**
 * Provide Input to addRolesToGroup SOA
 *
 * @param {data} data
 * @param {subPanelContext} subPanelContext  for selection data
 */
export let addRolesToGroups = function( data, subPanelContext ) {
    var roleGroupStructs = [];
    var selected = [];
    if( subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        selected = subPanelContext.selectionData.selected;
    } else {
        selected.push( cdm.getObject( subPanelContext.searchState.criteria.groupUID ) );
    }

    for( var i = 0; i < selected.length; i++ ) {
        if( selected[ i ].type === 'Group' ) {
            var struct = {
                clientId: selected[ i ].uid,
                rolesToAdd: data.dataProviders.doSearchForSWASearchTab.selectedObjects,
                grp: {
                    type: selected[ i ].type,
                    uid: selected[ i ].uid
                }
            };
            roleGroupStructs.push( struct );
        }
    }
    return roleGroupStructs;
};

/**
 * Process partial errors to display proper message on addition of roles to groups
 *
 * @param {Object} response reponse
 * @return {message} to be displayed
 */
export let partialErrorsForAddRolesToGroup = function( response, dataProvider, selectedRole, selectedGroups ) {
    var message = '';
    var errMessage = '';
    var partialErrors = '';
    var resource = 'UsermanagementCommandPanelMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var selectedRoles = dataProvider.dataProviders.doSearchForSWASearchTab.selectedObjects.length;
    if( !selectedGroups || selectedGroups && selectedGroups.length === 0 ) {
        selectedGroups = [];
        selectedGroups.push( cdm.getObject( dataProvider.subPanelContext.searchState.criteria.groupUID ) );
    }
    var selectedGroupsNode = selectedGroups.length;
    // Check if input response is not null and contains partial errors then only
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }
    // create the error message when single role is added in single group
    if( selectedRoles === 1 && selectedGroupsNode === 1 ) {
        if( partialErrors ) {
            _.forEach( partialErrors, function( partialError ) {
                _.forEach( partialError.errorValues, function( object ) {
                    message += '\n' + object.message;
                } );
            } );
        }
    } else {
        //create the error message when multiple roles added in multiple groups
        //create the error message when single role is added in multiple groups
        //create the error message when multiple roles is added in single group
        if( response && response.partialErrors ) {
            _.forEach( response.partialErrors, function( partialError ) {
                _.forEach( partialError.errorValues, function( object, index ) {
                    if( partialError.clientId ) {
                        var group = selectedGroups.filter( obj => obj.uid === partialError.clientId )[0];
                        var groupName = group.dbValue ? group.dbValue : group.props.object_string.dbValues[0];
                        if( !groupName ) {
                            groupName = Um0UserSearchAndAddService.getGroupName( '', dataProvider.subPanelContext );
                        }
                        var role_ = dataProvider.dataProviders.doSearchForSWASearchTab.selectedObjects;
                        _.forEach( role_, function( role_name ) {
                            errMessage = localTextBundle.addSingleRoleToGroupFailureMessage.replace( '{0}', role_name.props.role_name.dbValue );
                            errMessage = errMessage.replace( '{1}', groupName );
                            var errVal = response.partialErrors[ 0 ].errorValues[ 0 ];
                            errMessage = errMessage.replace( '{2}', '\n' + errVal.message );
                            message += '\n' + errMessage;
                        // }
                        } );
                    }
                } );
            } );
        }
    }
    return message;
};

/**

 * This method returns only group type node from mixed selected nodes.
 * @param {*} response
 * @param {*} subPanelContext
 * @returns
 */
export let getSelectedGroups = function( response, subPanelContext ) {
    var selected = subPanelContext.searchState.pwaSelection;
    if ( selected && selected.length > 0 ) {
        return selected.filter( function( vmo ) {
            return vmo.type === 'Group';
        }
        );
    }
    return [];
};
export let handleTabChange = function( visibleTabs, pageId, tabTitle ) {
    let selectedTab = visibleTabs.filter( function( tab ) {
        return tab.pageId === pageId || tab.name === tabTitle;
    } )[ 0 ];
    return {
        activeTab: selectedTab
    };
};

/**
 * This function sets the toParent property value.
 * On selection in PWA, it pre populates toParent property field.
 * If group node is selected and trying to add a child group - set toParent from the selected group node
 * Else - try to read group id from the criteria and set it as toParent (In list with summary when navigated to group and trying to add childGroup)
 * @param {*} data
 * @param {*} selectionData
 * @param {*} subPanelContext
 * @returns
 */
export let setToParentProperty = function( data, selectionData, subPanelContext ) {
    var newParent = { ...data.modelPropGroup.props.parent };
    var groupObj = {};
    if( selectionData.selected && selectionData.selected.length > 0 ) {
        //set ToParent property when group is selected
        groupObj = cdm.getObject( selectionData.selected[ 0 ].uid );
    } else if( subPanelContext.searchState.criteria.groupUID ) {
        //set ToParent property when in list with summary mode and in group context without selection
        groupObj = cdm.getObject( subPanelContext.searchState.criteria.groupUID );
    }
    if( groupObj && groupObj.uid && groupObj.props.object_string ) {
        newParent.dbValue = groupObj.uid;
        newParent.uiValue = groupObj.props.object_string.dbValues[ 0 ];
    }
    return newParent;
};


/**
  * Process partial errors to display proper message
  * The message would be ""TestGroup" was not added to "4G Tester" group because + {Reason -message from SOA}"
  * ""TestGroup" was not added to "4G Tester 2" group because + {Reason -message from SOA}"
  * @param {Object} SOA reponse
  * @param {Object} selectedObjects selected groups to add
  * @param {Object} lastSelectedObject parent group
  * @return {message} to be displayed
  */
export let processAddChildGroupMessage = function( response, selectedObjects, lastSelectedObject ) {
    var message = '';
    var errmessage1 = '';
    var errmessage2 = '';
    var resource = 'UsermanagementCommandPanelMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var partialErrors = '';
    var clientIndex = 0;
    // Check if input response is not null and contains partial errors then only
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }

    if ( partialErrors  ) {
        // message would be ""1" of "2" groups were added." for multiple child groups.
        if( selectedObjects.length > 1 ) {
            errmessage1 = localTextBundle.addChildGroupsFailureMessage.replace( '{0}', response.updated ? response.updated.length : 0 );
            errmessage1 = errmessage1.replace( '{1}', selectedObjects.length );
        }

        errmessage2 += errmessage1;
        // create the error message
        _.forEach( partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                clientIndex = partialError.clientIndex ? partialError.clientIndex : 0;
                //code for error = The logged-in user is not an authorized user, a system administrator or a group administrator.

                if( object.code === 10733 && selectedObjects.length > 1 ) {
                    // Give reason only -"The logged-in user is not an authorized user, a system administrator or a group administrator."
                    errmessage2 = '\n' + object.message;
                }else{
                    // Give detail error for single child group with reason
                    // eg. Group "SubGroup1" was not added to "Group1" because "The logged-in user is not an authorized user, a system administrator or a group administrator."
                    // Give detail error with reason eg. Group "SubGroup1" was not added to "Group1" because "Cyclic group structures are not allowed."
                    errmessage2 = '\n' + localTextBundle.addChildGroupsFailureMessageReason.replace( '{0}', selectedObjects[clientIndex].props.name.uiValue );
                    errmessage2 = errmessage2.replace( '{1}', lastSelectedObject.props.name.uiValues[0] );
                    errmessage2 = errmessage2.replace( '{2}', object.message );
                }
            } );
            message += errmessage2;
        } );
        message = errmessage1 + message;
    } else if( response.updated.length > 0 ) {
        if( selectedObjects.length === 1 ) {
            message = localTextBundle.addSingleChildGroupSuccessMessage.replace( '{0}', selectedObjects[0].props.name.uiValue );
            message = message.replace( '{1}', lastSelectedObject.props.name.uiValues[0] );
        }
        if( selectedObjects.length > 1 ) {
            message = localTextBundle.addChildGroupsSuccessMessage.replace( '{0}', selectedObjects.length );
            message = message.replace( '{1}', lastSelectedObject.props.name.uiValues[0]  );
        }
    }
    return message;
};

/**
 * This method returns group name.
 * if group is "testsubgrp.testgroup" then this gives "testsubgrp", This is used in success & error message.
 * @param {*} response
 * @param {*} subPanelContext
 * @returns
 */
export let getGroupName = function( response, subPanelContext ) {
    var group = '';
    if( subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        // Usecase - On navigation from other sublocation to Organization, if the props are not available
        // checking for props first, if props are available check for object_string
        // if props are not available, get dbValue from vmo properties. Because props.object_string will not be available for tree mode
        var selected = subPanelContext.selectionData.selected;
        // filter by only group
        // use case - if group is selected along with sitelevel node
        var selectedGroup =  selected.filter( obj => obj.type === 'Group' );
        // this method is used for the getting single selected group name after role is added
        if(  selectedGroup.length === 1 ) {
            group = selectedGroup[0].props?.object_string ? selectedGroup[0].props.object_string.dbValues[0] : subPanelContext.vmo.dbValue;
        }
    } else {
        group = cdm.getObject( subPanelContext.searchState.criteria.groupUID );
        group =  group.props.name ? group.props.name.dbValues[0] : group.props.object_string.dbValues[0].split( '.' )[0];
    }
    return group;
};

/**
 * This function is used to store the nodes which will be selected after add.
 * This function sets the newlyCreatedObj ctx using newly added single/multiple node.
 */
export let registerCtxForNewNodes = function( eventData ) {
    if( eventData !== null ) {
        var newNodes = [];
        if( eventData.createdObjectUid ) {
            //After new node creation the uid is stored in createdObjectUid
            //Preparing Array structure to maintain consistency for single and multiple selection
            newNodes.push( cdm.getObject( eventData.createdObjectUid ) );
        } else{
            //eventData.multipleNodes contains the node which is added using search tab from add panel.
            //This is stored in newlyCreatedObj ctx, and this ctx will be using for setselection for list, image and table mode
            newNodes = eventData.multipleNodes;
        }
        var newlyCreatedObjCtx = appCtxSvc.getCtx( 'newlyCreatedObj' );
        if( newlyCreatedObjCtx ) {
            appCtxSvc.updateCtx( 'newlyCreatedObj', newNodes );
        } else {
            appCtxSvc.registerCtx( 'newlyCreatedObj', newNodes );
        }
    }
};

/**
 * This function is used to store the nodes which will be selected after add.
 * This function sets the newlyCreatedObj ctx using newly added single/multiple node.
 */
export let unRegisterCtxForNewNodes = function( ) {
    var newlyCreatedObjCtx = appCtxSvc.getCtx( 'newlyCreatedObj' );
    if( newlyCreatedObjCtx ) {
        appCtxSvc.updateCtx( 'newlyCreatedObj', [] );
    }
};
/**
  * to get node added successfully filtered out from the selected nodes
  * @param {Object} response response.updated uids array
  * @param {Object} selectedNodes selectedNodes from search tab
  * @param {Object} selectedNodes filtered out successfully added nodes
  * @return {message} to be displayed
  */
export let getSuccessfullyAddedChildgroup  = function( response, selectedNodes ) {
    if( response.updated && response.updated.length > 0 ) {
        return selectedNodes.filter( row1 => {
            // If there is a match, include the row from array1
            return response.updated.some( row2 => row2 === row1.uid );
        } );
    }
    return [];
};
export let resetCreateGroupPanelData = function( data ) {
    let name = Object.assign( {}, data.um0GroupName );

    name.dbValue = '';
    name.uiValue = '';

    return name;
};

exports = {
    doSearch,
    getState,
    getObjectFromBreadCrumb,
    getUsersToAdd,
    addAdminObjects,
    loadPanelTabs,
    handleTabChange,
    setToParentProperty,
    processAddChildGroupMessage,
    addRolesToGroups,
    partialErrorsForAddRolesToGroup,
    getSelectedGroups,
    getGroupName,
    registerCtxForNewNodes,
    unRegisterCtxForNewNodes,
    getSuccessfullyAddedChildgroup,
    resetCreateGroupPanelData,
    OpenDialogAction
};
export default exports;
