// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1TaskAssignmentService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';

var exports = {};

export let getSaveFlags = function( data, assignObjectsList, Resources ) {
    exports.checkScheduleTags( appCtxService.ctx.mselected );

    let flags = [];
    let resourceUids = [];
    let AssignedResourceUids = [];

    //Get Array of Resource uids
    for( let index = 0; index < assignObjectsList.length; index++ ) {
        resourceUids.push( assignObjectsList[ index ].uid );
    }

    //Get Array of Assigned Resource uids
    for( let index = 0; index < Resources.length; index++ ) {
        AssignedResourceUids.push( Resources[ index ].uid );
    }

    flags.unassignmentFlag = false;
    flags.assignmentFlag = false;

    //Set unassignmentFlag
    for( let i = 0; i < AssignedResourceUids.length; i++ ) {
        if( resourceUids.indexOf( AssignedResourceUids[ i ] ) === -1 ) {
            flags.unassignmentFlag = true;
            break;
        }
    }

    //Set assignmentFlag
    for( let j = 0; j < resourceUids.length; j++ ) {
        if( AssignedResourceUids.indexOf( resourceUids[ j ] ) === -1 ) {
            flags.assignmentFlag = true;
            break;
        }
    }

    return flags;
};

/**
 * Check Schedule Tags of the selected tasks
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} selected - The selected tasks
 */
export let checkScheduleTags = function( selected ) {
    let temp = selected[ '0' ].props.schedule_tag.dbValues[ 0 ];

    selected.forEach( function( select ) {
        //Check selected tasks are from same schedule
        if( temp.indexOf( select.props.schedule_tag.dbValues[ 0 ] ) === -1 ) {
            throw 'diffScheduleErrorMsg';
        }
    } );
};

/**
 * Method for navigatting to Saw1ResourceGraphParams.
 *
 * @param {Object} activeState - Active Panel state
 * @param {String} destPanelId - Destination Panel
 * @param {Object} selectedResourcesProp - State property for selected user
 * @param {Object} selectedResources - Selected User
 */
export let openResourceGraphPanel = function( activeState, destPanelId, previousPanelId, selectedResourcesProp, selectedResources ) {
    const newState = {
        ...activeState.value
    };
    newState.activeView = destPanelId;
    newState.prePanelId = previousPanelId;
    activeState.update && activeState.update( newState );

    const newSelectedResourcesProp = {
        ...selectedResourcesProp.value
    };
    newSelectedResourcesProp.vmo = selectedResources;
    selectedResourcesProp.update && selectedResourcesProp.update( newSelectedResourcesProp );

    return;
};

/**
 * Update the input user panel state based on view mode. If view mode is mobile then we
 * need to set isAddButtonNeeded to true so that we can show add button in narrow mode.
 *
 * @param {String} sideNavMode Side nav mode string
 * @param {String} selectedUid selected Object Uid
 * @param {Object} addUserPanelState User panel state object
 * @returns {Object} Updated user panel state object.
 */
export let updateSideNavUserPanelState = function( sideNavMode, selectedUid, addUserPanelState ) {
    if( sideNavMode && addUserPanelState ) {
        const userPanelState = {
            ...addUserPanelState
        };
        let isAddButtonNeeded = false;
        if( sideNavMode === 'mobile' ) {
            isAddButtonNeeded = true;
        }
        userPanelState.isAddButtonNeeded = isAddButtonNeeded;
        // Reset the propName to empty string when we are chaing the sideNavMode
        userPanelState.propName = '';
        userPanelState.criteria.selectedObject = selectedUid;

        return userPanelState;
    }
    return addUserPanelState;
};

/**
 * Method for getting the assigned Users for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignedUsers = function( response, ctx, data ) {
    let assignedResources = this.getResourceObject( ctx, 'All' );
    if( assignedResources !== undefined ) {
        //Update data provider.
        data.dataProviders.assignedUserList.update( assignedResources );
    }
    return assignedResources;
};

/**
 * Method for getting the assigned resources for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {Object} resourceType - The type of resources i.e User or Discipline
 * @return {Array} AssignedObjects - The array of assigned Resources
 */

export let getResourceObject = function( ctx, resourceType ) {
    let taskObjs = [];
    let resAssignmentList = [];
    if( resourceType === 'ScheduleMember' ) {
        if( ctx.pselected && ctx.pselected.modelType && ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
            let schedule = cdm.getObject( ctx.schedule.uid );
            taskObjs.push( schedule );
        } else {
            if( ctx.pselected ) {
                taskObjs.push( ctx.pselected );
            } else {
                let schedule = cdm.getObject( ctx.schedule.uid );
                taskObjs.push( schedule );
            }
        }
    } else {
        taskObjs = ctx.mselected;
    }

    taskObjs.forEach( function( taskObj ) {
        taskObj = cdm.getObject( taskObj.uid );
        if( resourceType === 'ScheduleMember' && taskObj.props.saw1ScheduleMembers ) {
            resAssignmentList.push( taskObj.props.saw1ScheduleMembers.dbValues );
        } else if( taskObj.props.ResourceAssignment ) {
            resAssignmentList.push( taskObj.props.ResourceAssignment.dbValues );
        }
    } );

    if( resAssignmentList.length <= 0 ) {
        return;
    }

    let tempAssignments = resAssignmentList[ 0 ];

    for( let index = 1; index < resAssignmentList.length; index++ ) {
        if( resAssignmentList[ index ].length === 0 ) {
            tempAssignments = _.clone( resAssignmentList[ index ] );
            break;
        }
        let temp = [];
        for( let i = 0; i < resAssignmentList[ index ].length; i++ ) {
            if( tempAssignments.indexOf( resAssignmentList[ index ][ i ] ) !== -1 ) {
                temp.push( resAssignmentList[ index ][ i ] );
            }
        }
        tempAssignments = _.clone( temp );
    }

    let l = 0;
    let assignedObject = [];
    let AssignedObjects = [];

    tempAssignments.forEach( function( tempAssignment ) {
        assignedObject = cdm.getObject( tempAssignment );
        AssignedObjects[ l++ ] = assignedObject;
    } );

    return AssignedObjects;
};

/**
 * The function for Save Action of User
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let assignUnassignResourceAction = function( data ) {
    let assignedResourceobjects = [];
    assignedResourceobjects = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;

    let flags = this.getSaveFlags( data, assignedResourceobjects, data.Users );

    if( flags.unassignmentFlag === false && flags.assignmentFlag === false ) {
        if( data.Users.length !== data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects.length ) {
            throw 'assignmentUserError';
        }
    }

    return flags;
};

/**
 * Method for getting the selected object for different sub locations.
 *
 * @param {ctx} ctx - The current context
 * @return {Object} Object - The Current Selected object
 */
export let getScheduleUidFromCtx = function( ctx ) {
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        if( ctx.selected.props.schedule_tag ) {
            let schedule = {
                type: 'Schedule',
                uid: ctx.selected.props.schedule_tag.dbValues[ 0 ]
            };
            ctx.schedule = schedule;
            return schedule;
        }
    }
    return ctx.schedule.scheduleTag;
};

/**
 * Do the getAssignContainerUsers call to prepare input container for assignResources SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignmentForSOAInput = function( data ) {
    let userObjs = [];
    let selectedObjs = appCtxService.ctx.mselected;
    let resultObject = [];
    let results = [];

    resultObject = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;
    resultObject.forEach( function( result ) {
        userObjs.push( result );
    } );
    return this.getAssignments( selectedObjs, userObjs );
};

/**
 * Method for getting the assignments
 * @param {Array} selectedObjs - Selected Tasks
 * @param {Array} resourceObjs - The Resource Objects
 * @param {data} data - The data of view model
 * @return {Array} assignments - The UIDs of resources to be assigned
 */
export let getAssignments = function( selectedObjs, resourceObjs ) {
    let assignments = [];

    selectedObjs.forEach( function( selObj ) {
        selObj = cdm.getObject( selObj.uid );
        resourceObjs.forEach( function( resourceObj ) {
            let resourceFlag = 0;
            let temp = [];
            temp.push( resourceObj.uid );

            if( selObj.props.ResourceAssignment !== undefined ) {
                for( let m = 0; m < selObj.props.ResourceAssignment.dbValues.length; m++ ) {
                    if( temp.indexOf( selObj.props.ResourceAssignment.dbValues[ m ] ) !== -1 ) {
                        resourceFlag = -1;
                        break;
                    }
                }
            }

            if( resourceFlag === 0 ) {
                assignments.push( {
                    task: selObj,
                    resource: resourceObj,
                    discipline: {},
                    assignedPercent: 100,
                    placeholderAssignment: {},
                    isPlaceHolder: false
                } );
            }
        } );
    } );
    return assignments;
};

/**
 * Method for getting the UIDs of selected objects to refresh in table for different sub locations.
 *
 * @param {ctx} ctx - The current context
 * @return {Array} result - The UIDs of resources to be assigned
 */
export let getUIDToRefresh = function( ctx ) {
    if( ctx.mselected && ctx.mselected.length > 1 ) {
        return ctx.mselected;
    } else if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        return ctx.selected;
    }
    return ctx.xrtSummaryContextObject;
};

/**
 * Method for unassignment of resources i.e Users or Disciplines from selected tasks
 *
 * @param {Array} assignedObjects - Array of initially assigned resources.
 * @param {Array} resultObjects - Array of assigned resources.
 * @param {Object} schedule - Schedule of selected tasks.
 * @param {Array} outputs - Resource Assignments for selected tasks.
 */
export let unAssignResourcesfromTask = function( assignedObjects, resultObjects, schedule, outputs ) {
    let selectedResources = [];

    outputs.forEach( function( output ) {
        let responseObjs = output.relationshipData[ '0' ].relationshipObjects;

        let tempAssignments = [];
        let tempAvailables = [];

        assignedObjects.forEach( function( assignedObject ) {
            tempAssignments.push( assignedObject.uid );
        } );

        resultObjects.forEach( function( resultObject ) {
            tempAvailables.push( resultObject.uid );
        } );

        let results = [];
        let rels = [];
        tempAssignments.forEach( function( tempAssignment ) {
            if( tempAvailables.indexOf( tempAssignment ) === -1 ) {
                results.push( tempAssignment );
            }
        } );

        responseObjs.forEach( function( responseObj ) {
            results.forEach( function( result ) {
                if( responseObj.otherSideObject.uid === result ) {
                    rels.push( responseObj.relation );
                }
            } );
        } );

        rels.forEach( function( rel ) {
            let temp = {};
            temp.uid = rel.uid;
            temp.type = rel.type;
            selectedResources.push( temp );
        } );
    } );

    let inputData = {};
    inputData.assignmentDeletes = selectedResources;

    inputData.schedule = {
        uid: schedule.uid,
        type: schedule.type
    };
    // Made a SOA call to delete selected members.
    return soaService.post( 'ProjectManagement-2012-02-ScheduleManagement', 'deleteAssignments', inputData );
};

/**
 * Enable Save button based on any resource added or removed.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let activateSaveButton = function( data ) {
    let visibleSaveBtn = false;
    let assignedResourceobjects = [];
    assignedResourceobjects = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;
    let flags = this.getSaveFlags( data, assignedResourceobjects, data.Users );
    if( flags.assignmentFlag || flags.unassignmentFlag ) {
        visibleSaveBtn = true;
    }
    return visibleSaveBtn;
};

/**
 * Utility method to get the initial selection Uid string.
 *
 * @param {String} selectedUid Initial selection Uid
 * @returns {String} Initial selection Uid string
 */
export const cacheSelection = selectedUid => {
    return selectedUid;
};


exports = {
    openResourceGraphPanel,
    updateSideNavUserPanelState,
    unAssignResourcesfromTask,
    getUIDToRefresh,
    getAssignments,
    getAssignmentForSOAInput,
    getScheduleUidFromCtx,
    assignUnassignResourceAction,
    getAssignedUsers,
    getResourceObject,
    getSaveFlags,
    checkScheduleTags,
    activateSaveButton,
    cacheSelection
};
export default exports;
