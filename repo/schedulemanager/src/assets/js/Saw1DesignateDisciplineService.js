// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1DesignateDisciplineService
 */

import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';

var exports = {};

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

/**
 * Get the discipline for the selected user to be reverted
 *
 * @param {Object} selectedTaskObj - The selected task
 * @param {Object} assignedResources - The selected assigned resource
 */
var getDisciplineUid = function( selectedTaskObj, assignedResources ) {
    for( var idx in assignedResources ) {
        if( assignedResources[ idx ].props.primary_object.dbValues[ 0 ] === selectedTaskObj ) {
            break;
        }
    }
    var resouceAssignment = assignedResources[ idx ];
    if( typeof resouceAssignment.props.discipline.dbValues[ 0 ] !== typeof undefined ) {
        return cdm.getObject( resouceAssignment.props.discipline.dbValues[ 0 ] );
    }
};

/**
 * Do the perform search call to get the users associated with selected discipline based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 * @param {Object} selectedDisciplineUid - The uid selected Discipline Object
 */
export let getDesignatedUsers = function( data, dataProvider, selectedDisciplineUid ) {
    // Check is data provider and selected discipline is null or undefined then no need to process further
    // and return from here
    if( !dataProvider || !selectedDisciplineUid ) {
        return;
    }

    // Get the policy from data provider and register it

    var searchString = data.filterBoxUser.dbValue;

    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Saw1DisciplineSearchProvider',
            searchCriteria: {
                searchContent: 'UsersOfDiscipline',
                searchString: searchString,
                disciplineUid: selectedDisciplineUid
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
 * Method for preparing input to unassign by getting Resources Assignment relation for selected tasks. Return output
 * for expandGRMRelationsForPrimary SOA
 */
export let prepInpForRelToUnassign = function() {
    var infos = [];
    var relInfo = {
        relationTypeName: 'ResourceAssignment',
        otherSideObjectTypes: ''
    };
    infos.push( relInfo );

    var TasksObjs = appCtxService.ctx.mselected;
    var primaryObjs = [];
    TasksObjs.forEach( function( TasksObj ) {
        var primaryObject = {
            uid: TasksObj.uid,
            type: ''
        };
        primaryObjs.push( primaryObject );
    } );

    var preferenceInfo = {
        expItemRev: false,
        returnRelations: true,
        info: infos
    };

    var inputData = {
        primaryObjects: primaryObjs,
        pref: preferenceInfo
    };

    //register property policy.
    var policyId = policySvc.register( {
        types: [ {
            name: 'ResourceAssignment',
            properties: [ {

                name: 'primary_object'
            }, {

                name: 'discipline'
            } ]
        } ]
    } );

    var deferred = AwPromiseService.instance.defer();
    soaService.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData ).then(
        function( response ) {
            policySvc.unregister( policyId );
            deferred.resolve( response.output );
        } );
    return deferred.promise;
};

/**
 * Method for navigatting to Saw1DesignatedUsers.
 *
 * @param {Object} activeState - Active Panel state
 * @param {String} destPanelId - Destination Panel
 * @param {Object} selectedDisciplineProperty - State property for selected Discipline
 * @param {Object} selectedDiscipline - Selected Discipline
 */
export let openDesignatedUserPanel = function( activeState, destPanelId, selectedDisciplineProperty, selectedDiscipline ) {
    const newState = {
        ...activeState.value
    };
    newState.activeView = destPanelId;
    activeState.update && activeState.update( newState );

    const newSelectedDisciplineProp = {
        ...selectedDisciplineProperty.value
    };
    newSelectedDisciplineProp.vmo = selectedDiscipline[ 0 ];
    selectedDisciplineProperty.update && selectedDisciplineProperty.update( newSelectedDisciplineProp );

    return;
};

/**
 * Prepare the new assignments container for the replace assignment SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} selectedDiscipline - Selected Discipline

 */
export let getNewAssignmentsContainer = function( data, output, selectedDiscipline, designatedUser ) {
    var selectedTasks = appCtxService.ctx.mselected;

    for( var idx = 0; idx < selectedTasks.length; idx++ ) {
        for( var i = 0; i < output[idx].relationshipData[0].relationshipObjects.length; i++ ) {
            if( output[idx].relationshipData[0].relationshipObjects[i].otherSideObject.uid === selectedDiscipline.uid ) {
                selectedTasks[idx].resourceLevel = parseInt( output[idx].relationshipData[0].relationshipObjects[i].relation.props.resource_level.uiValues[0] );
            }
        }
    }

    var selObjs = [];

    selectedTasks.forEach( function( selectedTask ) {
        if( selectedTask.props.ResourceAssignment !== undefined && selectedTask.props.ResourceAssignment.dbValues.indexOf( selectedDiscipline.uid ) !== -1 ) {
            selObjs.push( selectedTask );
        }
    } );

    var assignments = [];

    selObjs.forEach( function( selObj ) {
        var selectedTaskObj = selObj;
        assignments.push( {
            task: selectedTaskObj,
            resource: designatedUser[ 0 ],
            discipline: selectedDiscipline,
            assignedPercent: selObj.resourceLevel
        } );
    } );

    return assignments;
};

/**
 * Prepare the assignment Deletes container for the replace assignment SOA call
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} outputs - Resource Assignments for selected tasks
 */
export let getAssignmentDeletesContainer = function( data, selectedDiscipline, outputs ) {
    var assignmentDeletes = [];
    var selectedResourceUids = [];

    outputs.forEach( function( output ) {
        var relationObjs = output.relationshipData[ '0' ].relationshipObjects;

        relationObjs.forEach( function( relationObj ) {
            if( relationObj.otherSideObject.uid === selectedDiscipline.uid ) {
                selectedResourceUids.push( relationObj.relation.uid );
            }
        } );
    } );

    selectedResourceUids.forEach( function( selectedResourceUid ) {
        assignmentDeletes.push( cdm.getObject( selectedResourceUid ) );
    } );

    return assignmentDeletes;
};

/**
 * Do the perform search call to get the users to revert based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let getUserToRevert = function( dbValue, dataProvider ) {
    if( !dataProvider ) {
        return;
    }

    var searchString = dbValue;

    var inputData = {
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Saw1DisciplineSearchProvider',
            searchCriteria: {
                searchContent: 'UsersOfDesignatedDiscipline',
                searchString: searchString,
                scheduleTaskUids: getScheduleTasksUids()
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
 * Method returns the SOA call for replaceAssignment
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} outputs - Resource Assignments for selected tasks
 */
export let replaceAssignmentForRevert = function( selectedObjects, outputs ) {
    var inputData = {};
    var assignments = [];

    inputData.schedule = appCtxService.ctx.schedule.scheduleTag;

    var assignedResources = [];
    var assignObjs = [];
    var selectedResourceAssignUids = [];

    outputs.forEach( function( output ) {
        var relationObjs = output.relationshipData[ '0' ].relationshipObjects;

        relationObjs.forEach( function( relationObj ) {
            if( relationObj.otherSideObject.uid === selectedObjects[ '0' ].uid ) {
                selectedResourceAssignUids.push( relationObj.relation.uid );
            }
        } );
    } );

    selectedResourceAssignUids.forEach( function( selectedResourceAssignUid ) {
        assignObjs.push( cdm.getObject( selectedResourceAssignUid ) );
    } );

    assignObjs.forEach( function( assignObj ) {
        if( assignObj.props.discipline.dbValues[ 0 ] !== '' ) {
            assignedResources.push( assignObj );
        }
    } );

    inputData.assignmentDeletes = assignedResources;

    var selObjs = [];
    var taskObj = [];

    assignedResources.forEach( function( assignedResource ) {
        taskObj = cdm.getObject( assignedResource.props.primary_object.dbValues[ '0' ] );
        taskObj.resourceLevel = parseInt( assignedResource.props.resource_level.uiValues[0] );
        selObjs.push( taskObj );
    } );

    selObjs.forEach( function( selObj ) {
        var selectedTaskObj = selObj;
        assignments.push( {
            task: selectedTaskObj,
            resource: getDisciplineUid( selectedTaskObj.uid, assignedResources ),
            discipline: {},
            assignedPercent: selectedTaskObj.resourceLevel
        } );
    } );

    inputData.newAssignments = assignments;

    return soaService.post( 'ProjectManagement-2014-10-ScheduleManagement', 'replaceAssignment', inputData );
};

/**
 * Populate the panel data based on selection and add the additional search criteria
 *
 * @param {Object} selectedObject Selected object from UI.
 * @param {Object} addUserPanelState user Panel state object that will hold all info related to adding users
 * @param {Object} criteria Criteria object to add additional search criteria that will be pass to server
 *
 * @returns {Object} Updated user panel data with additional search criteria
 */
export let populateDesignatedUserPanel = function( selectedObject, addUserPanelState, criteria ) {
    const userPanelState = { ...addUserPanelState };
    userPanelState.criteria = criteria;
    if( selectedObject && selectedObject.uid ) {
        userPanelState.criteria.selectedObject = selectedObject.uid;
    }
    return {
        userPanelState: userPanelState,
        isDataInit: true
    };
};

exports = {
    getAssignmentDeletesContainer,
    getNewAssignmentsContainer,
    openDesignatedUserPanel,
    prepInpForRelToUnassign,
    getDesignatedUsers,
    getUserToRevert,
    replaceAssignmentForRevert,
    populateDesignatedUserPanel
};

export default exports;
