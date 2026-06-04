// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/ResourcesService
 */

import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import dms from 'soa/dataManagementService';
import _ from 'lodash';
import 'js/listBoxService';
import eventBus from 'js/eventBus';

var exports = {};

var _unSubEvents = [];

export let subscribeSelectionEvent = function( ctx, data ) {
    exports.unregisterEvent( ctx );
    _unSubEvents = [];
    var selectionEvent = eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if( data.activeView === 'Saw1AssignResourceToTasks' && eventData.name === 'mselected' ) {
            eventBus.publish( 'syncGanttSplitSelectionDone' );
        }
    } );
    _unSubEvents.push( selectionEvent );
};

export let unregisterEvent = function( ctx ) {
    if( _unSubEvents ) {
        for( var index = 0; index < _unSubEvents.length; index++ ) {
            eventBus.unsubscribe( _unSubEvents[ index ] );
        }
        _unSubEvents = null;
    }
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
 * Method for getting the selected object for different sub locations.
 *
 * @param {ctx} ctx - The current context
 * @return {Object} Object - The Current Selected object
 */
export let getScheduleUidFromCtx = function( ctx ) {
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        if( ctx.selected.props.schedule_tag ) {
            var schedule = {
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
 * Method for getting the Resources UIDs to be assigned.
 *
 * @return {Array} result - The UIDs of resources to be assigned
 */
export let getRequiredResources = function( resources, resultObjects ) {
    var tempAssignment = [];
    resources.forEach( function( resource ) {
        tempAssignment.push( resource.uid );
    } );

    var result = [];
    resultObjects.forEach( function( resultObject ) {
        if( tempAssignment.indexOf( resultObject.uid ) === -1 ) {
            result.push( resultObject );
        }
    } );

    return result;
};

/**
 * Method for getting the assignments
 * @param {Array} selectedObjs - Selected Tasks
 * @param {Array} resourceObjs - The Resource Objects
 * @param {data} data - The data of view model
 * @return {Array} assignments - The UIDs of resources to be assigned
 */
export let getAssignments = function( selectedObjs, resourceObjs ) {
    var assignments = [];

    selectedObjs.forEach( function( selObj ) {
        selObj = cdm.getObject( selObj.uid );
        resourceObjs.forEach( function( resourceObj ) {
            var resourceFlag = 0;
            var temp = [];
            temp.push( resourceObj.uid );

            if( selObj.props.ResourceAssignment !== undefined ) {
                for( var m = 0; m < selObj.props.ResourceAssignment.dbValues.length; m++ ) {
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
 * Do the getAssignContainerUsers call to prepare input container for assignResources SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 * @return {Array} assignments - The input container for SOA which includes tasks, resources, discipline to be
 *         assigned
 */
export let getAssignContainerUsers = function( data ) {
    {
        var userObjs = [];
        var selectedObjs = appCtxService.ctx.mselected;
        var resultObject = [];
        var results = [];

        if( data.selectedTab.panelId === 'Saw1ScheduleMembers' ) {
            resultObject = data.dataProviders.assignedScheduleMemberList.viewModelCollection.loadedVMObjects;
            results = this.getRequiredResources( data.AssignedScheduleMembers, resultObject );
            results.forEach( function( result ) {
                userObjs.push( cdm.getObject( result.uid ) );
            } );
        } else {
            resultObject = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;
            results = this.getRequiredResources( data.Users, resultObject );
            results.forEach( function( result ) {
                userObjs.push( cdm.getObject( result.props.user.dbValues[ 0 ] ) );
            } );
        }
        return this.getAssignments( selectedObjs, userObjs );
    }
};

/**
 * Do the getAssignContainerDiscipline call to prepare input container for assignResources SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 * @return {Array} assignments - The input container for SOA which includes tasks, resources, discipline to be
 *         assigned
 */
export let getAssignContainerDiscipline = function( data ) {
    var selectedObjs = appCtxService.ctx.mselected;

    var resultObject = data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects;

    var results = this.getRequiredResources( data.Discipline, resultObject );

    return this.getAssignments( selectedObjs, results );
};

/**
 * Do the getAssignContainerResourcePool call to prepare input container for assignResources SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 * @return {Array} assignments - The input container for SOA which includes tasks, resources, discipline to be
 *         assigned
 */
export let getAssignContainerResourcePool = function( data ) {
    var selectedObjs = appCtxService.ctx.mselected;

    var resultObject = data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects;

    var results = this.getRequiredResources( data.ResourcePool, resultObject );

    return this.getAssignments( selectedObjs, results );
};

/**
 * Method for getting the assigned resources for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {Object} resourceType - The type of resources i.e User or Discipline
 * @return {Array} AssignedObjects - The array of assigned Resources
 */

export let getResourceObject = function( ctx, resourceType ) {
    var taskObjs = [];
    var resAssignmentList = [];
    if( resourceType === 'ScheduleMember' ) {
        if( ctx.pselected && ctx.pselected.modelType && ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
            var schedule = cdm.getObject( ctx.schedule.uid );
            taskObjs.push( schedule );
        } else {
            if( ctx.pselected ) {
                taskObjs.push( ctx.pselected );
            } else {
                var schedule = cdm.getObject( ctx.schedule.uid );
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

    var tempAssignments = resAssignmentList[ 0 ];

    for( var index = 1; index < resAssignmentList.length; index++ ) {
        if( resAssignmentList[ index ].length === 0 ) {
            tempAssignments = _.clone( resAssignmentList[ index ] );
            break;
        }
        var temp = [];
        for( var i = 0; i < resAssignmentList[ index ].length; i++ ) {
            if( tempAssignments.indexOf( resAssignmentList[ index ][ i ] ) !== -1 ) {
                temp.push( resAssignmentList[ index ][ i ] );
            }
        }
        tempAssignments = _.clone( temp );
    }

    var l = 0;
    var assignedObject = [];
    var AssignedObjects = [];

    tempAssignments.forEach( function( tempAssignment ) {
        assignedObject = cdm.getObject( tempAssignment );

        if( cmm.isInstanceOf( resourceType, assignedObject.modelType ) ) {
            AssignedObjects[ l++ ] = assignedObject;
        }
    } );

    return AssignedObjects;
};

/**
 * Method for getting the assigned Disciplines for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignedDiscipline = function( response, ctx, data ) {
    data.visibleSaveBtn = false;
    var disciplineObject = this.getResourceObject( ctx, 'Discipline' );
    if( disciplineObject !== undefined ) {
        data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects = disciplineObject;
        data.Discipline = disciplineObject;
    }
};

/**
 * Method for getting the assigned Users for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignedUsers = function( response, ctx, data ) {
    data.visibleSaveBtn = false;
    var userObject = this.getResourceObject( ctx, 'User' );
    if( userObject !== undefined ) {
        data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects = userObject;
        data.Users = userObject;
    }
};

/**
 * Method for getting the assigned Resource pool for selected tasks
 *
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignedResourcePool = function( response, ctx, data ) {
    data.visibleSaveBtn = false;
    var resourcePoolObject = this.getResourceObject( ctx, 'ResourcePool' );
    if( resourcePoolObject !== undefined ) {
        data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects = resourcePoolObject;
        data.ResourcePool = resourcePoolObject;
    }
};
/**
 * Method for getting the assigned Schedule members
 *
 * @param {response} response - The response of getProperties
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getScheduleMembers = function( response, ctx, data ) {
    data.visibleSaveBtn = false;
    var scheduleMembersObject = this.getResourceObject( ctx, 'ScheduleMember' );
    data.ScheduleMembers = [];
    if( scheduleMembersObject ) {
        for( var i = 0; i < scheduleMembersObject.length; i++ ) {
            var memberObj = cdm.getObject( scheduleMembersObject[ i ].props.resource_tag.dbValues[ 0 ] );
            if( memberObj ) {
                var assignedScheduleMembers = data.AssignedScheduleMembers;
                var index = _.findIndex( assignedScheduleMembers, function( assignedScheduleMember ) {
                    return assignedScheduleMember.uid === memberObj.uid;
                } );
                if( index === -1 ) {
                    data.ScheduleMembers.push( memberObj );
                }
            }
        }
        data.dataProviders.userPerformSearch.viewModelCollection.loadedVMObjects = data.ScheduleMembers;
    }
};

var _addIntoScheduleMembers = function( data, resource ) {
    if( resource !== undefined ) {
        for( var i = 0; i < resource.length; i++ ) {
            var resourceObj = cdm.getObject( resource[ i ].uid );
            if( resourceObj ) {
                data.push( resourceObj );
            }
        }
    }
};

/**
 * Method for getting the assigned Schedule Task members
 *
 * @param {response} response - The response of getProperties
 * @param {Object} ctx - The Context object
 * @param {data} data - The qualified data of the viewModel
 */
export let getAssignedScheduleTaskMembers = function( response, ctx, data ) {
    data.visibleSaveBtn = false;
    data.AssignedScheduleMembers = [];
    _addIntoScheduleMembers( data.AssignedScheduleMembers, this.getResourceObject( ctx, 'User' ) );
    _addIntoScheduleMembers( data.AssignedScheduleMembers, this.getResourceObject( ctx, 'Discipline' ) );
    _addIntoScheduleMembers( data.AssignedScheduleMembers, this.getResourceObject( ctx, 'ResourcePool' ) );

    dms.getProperties( [ data.AssignedScheduleMembers ], [ 'fnd0MemberTypeString', 'resource_tag' ] );
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
    var selectedResources = [];

    outputs.forEach( function( output ) {
        var responseObjs = output.relationshipData[ '0' ].relationshipObjects;

        var tempAssignments = [];
        var tempAvailables = [];

        assignedObjects.forEach( function( assignedObject ) {
            tempAssignments.push( assignedObject.uid );
        } );

        resultObjects.forEach( function( resultObject ) {
            tempAvailables.push( resultObject.uid );
        } );

        var results = [];
        var rels = [];
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
            var temp = {};
            temp.uid = rel.uid;
            temp.type = rel.type;
            selectedResources.push( temp );
        } );
    } );

    var inputData = {};
    inputData.assignmentDeletes = selectedResources;

    inputData.schedule = {
        uid: schedule.uid,
        type: schedule.type
    };
    // Made a SOA call to delete selected members.
    return soaService.post( 'ProjectManagement-2012-02-ScheduleManagement', 'deleteAssignments', inputData );
};

/**
 * Returns the schedule UID of selected tasks
 */
export let ScheduleUid = function() {
    var taskArray = [ cdm.getObject( appCtxService.ctx.mselected[ 0 ].uid ) ];
    return taskArray[ 0 ].props.schedule_tag.dbValues[ 0 ];
};

/**
 * Do the perform search call to populate the discipline based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let getDisciplines = function( data, dataProvider ) {
    // Check is data provider is null or undefined then no need to process further
    // and return from here
    if( !dataProvider ) {
        return;
    }

    // Get the policy from data provider and register it
    var policy = dataProvider.action.policy;
    policySvc.register( policy );

    var searchString = data.filterBox.dbValue;

    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Saw1DisciplineSearchProvider',
            searchCriteria: {
                searchContent: 'Discipline',
                searchString: searchString
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},

            searchSortCriteria: [],
            startIndex: dataProvider.startIndex
        }
    };

    var deferred = AwPromiseService.instance.defer();

    // SOA call made to get the content
    soaService.post( 'Query-2014-11-Finder', 'performSearch', inputData ).then( function( response ) {
        // Parse the SOA data to content the correct user or resource pool data
        var outputData = {
            searchResults: response.searchResults,
            totalFound: response.totalFound,
            totalLoaded: response.totalLoaded
        };
        deferred.resolve( outputData );
    } );
    return deferred.promise;
};

/**
 * Check Schedule Tags of the selected tasks
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} selected - The selected tasks
 */
export let checkScheduleTags = function( selected ) {
    var temp = selected[ '0' ].props.schedule_tag.dbValues[ 0 ];

    selected.forEach( function( select ) {
        //Check selected tasks are from same schedule
        if( temp.indexOf( select.props.schedule_tag.dbValues[ 0 ] ) === -1 ) {
            throw 'diffScheduleErrorMsg';
        }
    } );
};

/**
 * get selected radio button
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let getDesignteDiscEvent = function( data ) {
    return data.disciplineData.dbValue;
};

/**
 * Do the perform search call to get discipline for designated based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let getDesigntedDisciplines = function( data, dataProvider ) {
    // Check is data provider is null or undefined then no need to process further
    // and return from here
    if( !dataProvider ) {
        return;
    }

    // Get the policy from data provider and register it

    var searchString = data.filterBoxDiscipline.dbValue;
    var radioButton = JSON.stringify( data.disciplineData.dbValue );

    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Saw1DisciplineSearchProvider',
            searchCriteria: {
                searchContent: 'DisciplinesOfTasks',
                searchString: searchString,
                scheduleTaskUids: getScheduleTasksUids(),
                fetchCommonDisciplines: radioButton
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},

            searchSortCriteria: [],
            startIndex: dataProvider.startIndex
        }
    };

    var deferred = AwPromiseService.instance.defer();

    // SOA call made to get the content
    soaService.post( 'Query-2014-11-Finder', 'performSearch', inputData ).then( function( response ) {
        // Parse the SOA data to content the correct user or resource pool data
        var outputData = {
            searchResults: response.searchResults,
            totalFound: response.totalFound,
            totalLoaded: response.totalLoaded
        };
        deferred.resolve( outputData );
    } );
    return deferred.promise;
};

/**
 * Returns the selected schedule tasks UIDs
 */
function getScheduleTasksUids() {
    var selObjects = appCtxService.ctx.mselected;
    var tasksUids = [];
    for( var index = 0; index < selObjects.length; index++ ) {
        tasksUids.push( selObjects[ index ].uid );
    }
    return tasksUids.join( ',' );
}

export let getSaveFlags = function( data, assignObjectsList, Resources ) {
    exports.checkScheduleTags( appCtxService.ctx.mselected );

    var flags = [];
    var resourceUids = [];
    var AssignedResourceUids = [];

    //Get Array of Resource uids
    for( var index = 0; index < assignObjectsList.length; index++ ) {
        resourceUids.push( assignObjectsList[ index ].uid );
    }

    //Get Array of Assigned Resource uids
    for( index = 0; index < Resources.length; index++ ) {
        AssignedResourceUids.push( Resources[ index ].uid );
    }

    flags.unassignmentFlag = false;
    flags.assignmentFlag = false;

    //Set unassignmentFlag
    for( var i = 0; i < AssignedResourceUids.length; i++ ) {
        if( resourceUids.indexOf( AssignedResourceUids[ i ] ) === -1 ) {
            flags.unassignmentFlag = true;
            break;
        }
    }

    //Set assignmentFlag
    for( var j = 0; j < resourceUids.length; j++ ) {
        if( AssignedResourceUids.indexOf( resourceUids[ j ] ) === -1 ) {
            flags.assignmentFlag = true;
            break;
        }
    }

    return flags;
};

/**
 * The function for Save Action For Reosurce Pools
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let resourcePoolSaveAction = function( data ) {
    var flags = this.getSaveFlags( data, data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects, data.ResourcePool );

    data.assignResourcePoolFlag = flags.assignmentFlag;
    data.unassignResourcePoolFlag = flags.unassignmentFlag;

    if( data.unassignResourcePoolFlag === false && data.assignResourcePoolFlag === false &&
        data.ResourcePool.length !== data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects.length ) {
        throw 'assignmentsResPoolErrorMsg';
    }
};

/**
 * The function for Save Action of User
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let userSaveAction = function( data ) {
    var assignedUserObjects = [];
    if( data.selectedTab.panelId === 'Saw1ScheduleMembers' ) {
        assignedUserObjects = data.dataProviders.assignedScheduleMemberList.viewModelCollection.loadedVMObjects;
    } else {
        assignedUserObjects = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;
    }

    var assignedObjectLists = [];
    assignedUserObjects.forEach( function( assignedUserObject ) {
        var assignObj = assignedUserObject;
        if( assignedUserObject.modelType.typeHierarchyArray.indexOf( 'GroupMember' ) > -1 ) {
            assignObj = cdm.getObject( assignedUserObject.props.user.dbValues[ 0 ] );
        }
        assignedObjectLists.push( assignObj );
    } );

    var flags = data.selectedTab.panelId === 'Saw1ScheduleMembers' ? this.getSaveFlags( data, assignedObjectLists, data.AssignedScheduleMembers ) : this.getSaveFlags( data, assignedObjectLists, data.Users );

    data.assignUsersFlag = flags.assignmentFlag;
    data.unassignUsersFlag = flags.unassignmentFlag;

    if( data.unassignUsersFlag === false && data.assignUsersFlag === false ) {
        if( data.selectedTab.panelId !== 'Saw1ScheduleMembers' ) {
            if( data.Users.length !== data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects.length ) {
                throw 'assignmentUserError';
            }
        }
    }
};

/**
 * The function for Save Action of Discipline
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let disciplineSaveAction = function( data ) {
    var flags = this.getSaveFlags( data, data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects, data.Discipline );

    data.assignDisciplinesFlag = flags.assignmentFlag;
    data.unassignDisciplinesFlag = flags.unassignmentFlag;

    if( data.unassignDisciplinesFlag === false && data.assignDisciplinesFlag === false &&
        data.Discipline.length !== data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects.length ) {
        throw 'assignmentDisciplineError';
    }
};

export default exports = {
    subscribeSelectionEvent,
    unregisterEvent,
    getUIDToRefresh,
    getScheduleUidFromCtx,
    getRequiredResources,
    getAssignments,
    getAssignContainerUsers,
    getAssignContainerDiscipline,
    getAssignContainerResourcePool,
    getResourceObject,
    getAssignedDiscipline,
    getAssignedUsers,
    getAssignedResourcePool,
    getScheduleMembers,
    getAssignedScheduleTaskMembers,
    unAssignResourcesfromTask,
    ScheduleUid,
    getDisciplines,
    checkScheduleTags,
    getDesignteDiscEvent,
    getDesigntedDisciplines,
    getSaveFlags,
    resourcePoolSaveAction,
    userSaveAction,
    disciplineSaveAction
};
