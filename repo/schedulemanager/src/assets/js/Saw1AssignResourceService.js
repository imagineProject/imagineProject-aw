// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1AssignResourceService
 */
import _ from 'lodash';
import adapterSvc from 'js/adapterService';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Method for invoking and registering/unregistering data for the assignResource command panel
 *
 * @param {String} commandId - Command Id for the Assign resource command
 * @param {String} location - Location of the Assign resource command
 * @param {Object} ctx - The Context object
 */

export let assignResourcePanel = function( commandId, location, ctx ) {
    var jso = {};

    var schedule = 'schedule';

    var selection = ctx.selected;

    if ( selection ) {
        var propObj = ctx.selected.props.schedule_tag.dbValues[0];

        var scheduleObj = cdm.getObject( propObj );

        jso = {
            selectedObject: selection,
            scheduleObj: scheduleObj
        };

        appCtxService.registerCtx( schedule, jso );
    } else {
        appCtxService.unRegisterCtx( schedule );
    }

    commandPanelService.activateCommandPanel( commandId, location );
};

export let changeOwnerAddUpdateScheduleMember = function( selectedResources, ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var uidsToLoad = [];
    var selectedOwner = selectedResources[0].props.user.dbValue;
    var selectedObjs = ctx.mselected;
    if ( selectedObjs.length > 0 ) {
        selectedObjs.forEach( function( selectedObj ) {
            if ( selectedObj.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
                uidsToLoad.push( selectedObj.uid );
            }
        } );
        dmSvc.getProperties( uidsToLoad, [ 'saw1ScheduleMembers' ] ).then( function() {
            var scheduleMembersList = {};
            for ( var i = 0; i < uidsToLoad.length; i++ ) {
                var scheduleObj = cdm.getObject( uidsToLoad[i] );
                var scheduleMembers = scheduleObj.props.saw1ScheduleMembers.dbValues;
                scheduleMembersList[scheduleObj.uid] = scheduleMembers;
            }
            var memList = Object.values( scheduleMembersList );
            dmSvc.getProperties( memList, [ 'resource_tag' ] ).then( function() {
                let membershipToUpdate = [];
                let membershipToAdd = [];
                for ( var scheduleUid in scheduleMembersList ) {
                    let schMemberList = scheduleMembersList[scheduleUid];
                    let resourceList = [];
                    let resourceSchMemberMap = {};
                    for ( var i = 0; i < schMemberList.length; i++ ) {
                        var schMember = cdm.getObject( schMemberList[i] );
                        var scheduleMemberUser = schMember.props.resource_tag.dbValues[0];
                        resourceList.push( scheduleMemberUser );
                        resourceSchMemberMap[scheduleMemberUser] = schMember;
                    }
                    var scheduleMemberIndex = resourceList.indexOf( selectedOwner );
                    if ( scheduleMemberIndex > -1 ) {
                        let resourceUid = resourceList[scheduleMemberIndex];
                        if ( resourceSchMemberMap[resourceUid] ) {
                            var memberObj = {
                                object: resourceSchMemberMap[resourceUid],
                                vecNameVal: [ {
                                    name: 'saw1RoleInSchedule',
                                    values: [ 'Coordinator' ]
                                } ]
                            };
                        }
                        membershipToUpdate.push( memberObj );
                    } else {
                        var resourceObj = cdm.getObject( selectedOwner );
                        if ( resourceObj ) {
                            var schResourceObj = {
                                schedule: cdm.getObject( scheduleUid ),
                                resource: resourceObj,
                                membershipLevel: 2,
                                cost: '',
                                currency: 0
                            };
                        }
                        membershipToAdd.push( schResourceObj );
                    }
                }
                if ( membershipToUpdate.length > 0 ) {
                    eventBus.publish( 'callSetProperties', membershipToUpdate );
                }
                if ( membershipToAdd.length > 0 ) {
                    eventBus.publish( 'callAddMembership', membershipToAdd );
                }
                deferred.resolve();
            } );
            deferred.resolve();
        } );
    }
    return deferred.promise;
};

/**
 * Do the changeOwnership call to transfer the owner
 * 
 * @param {data} data - The qualified data of the viewModel
 * @param {selectedObjects} selectedObjects - selected objects
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 * 
 */
export let getChangeOwnerInput = function(  selectedObjects, selectedResources ) {
    // Check if selected resource is null or not
    if( !selectedResources || selectedResources.length <= 0 ) {
        return;
    }

    let soaInput = [];
    let groupCriteria = {};
    let objectCriteria = {};
    let ownerCriteria = {};
    let inputCriteria = {};

    let selectedObjFrompanel = selectedResources[0];
    if( selectedObjFrompanel && selectedObjFrompanel.props && selectedObjFrompanel.props.user ) {
        ownerCriteria = {
            uid: selectedObjFrompanel.props.user.dbValues[ 0 ],
            type: 'User'
        };
    }

    if( selectedObjFrompanel && selectedObjFrompanel.props && selectedObjFrompanel.props.group ) {
        groupCriteria = {
            uid: selectedObjFrompanel.props.group.dbValues[ 0 ],
            type: 'Group'
        };
    }

    let adaptedObjects = [];
    adaptedObjects = adapterSvc.getAdaptedObjectsSync( selectedObjects );

    if( adaptedObjects && adaptedObjects.length > 0 ) {
        _.forEach( adaptedObjects, function( adaptedObject ) {
            if( adaptedObject && adaptedObject.uid && adaptedObject.type ) {
                objectCriteria = {
                    uid: adaptedObject.uid,
                    type: adaptedObject.type
                };
            }

            inputCriteria = {
                group: groupCriteria,
                object: objectCriteria,
                owner: ownerCriteria
            };

            soaInput.push( inputCriteria );
        } );
    }
    return soaInput;
};

exports = {
    assignResourcePanel,
    changeOwnerAddUpdateScheduleMember,
    getChangeOwnerInput
};

export default exports;
