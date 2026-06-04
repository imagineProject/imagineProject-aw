// Copyright (c) 2023 Siemens

/**
 * @module js/userListService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';
import smConstants from 'js/ScheduleManagerConstants';
import policySvc from 'soa/kernel/propertyPolicyService';
import clipboardService from 'js/clipboardService';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import viewModelObjectService from 'js/viewModelObjectService';
import localeService from 'js/localeService';

var exports = {};

var prefValue = null;

var TEMPLATE_VALUE_CONN_CHAR = '\\:';

export let getTasksNotToBeUpdated = function( selection, isIndent ) {
    let taskNotToBeDeleted = [];
    let statesMessage = '';
    if( appCtxService.ctx.preferences.SM_PREVENT_UPDATE_STATES ) {
        const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
        let smPreventUpdatePref = appCtxService.ctx.preferences.SM_PREVENT_UPDATE_STATES;
        statesMessage = prepareStatesMessage( smPreventUpdatePref );

        selection.forEach( function( selectedTask ) {
            if( smPreventUpdatePref.indexOf( selectedTask.props.fnd0status.dbValues[0] ) > -1 || selectedTask.props.fnd0status.dbValues[0] === 'aborted' ) {
                let taskInfo = {};
                let taskDisplayName = selectedTask.props.awp0CellProperties.uiValues[0];
                let taskStatusDisplayName = selectedTask.props.awp0CellProperties.uiValues[1];
                var nameValue = taskDisplayName.split( TEMPLATE_VALUE_CONN_CHAR );
                var statusName = taskStatusDisplayName.split( TEMPLATE_VALUE_CONN_CHAR );
                if( taskInfo.length >= 2 ) {
                    taskInfo.name = nameValue[1];
                    taskInfo.status = statusName[1];
                }

                if( selectedTask.props.fnd0status.dbValues[0] === 'aborted' ) {
                    var errorMessage;
                    if( isIndent ) {
                        errorMessage = localTextBundle.indentTaskErrorMessage;
                    } else {
                        errorMessage = localTextBundle.outdentTaskErrorMessage;
                    }
                    var message = messagingService.applyMessageParams( errorMessage, [ '{{taskName}}', '{{status}}' ], {
                        taskName: nameValue[1],
                        status: statusName[1]
                    } );
                    messagingService.showError( message );
                    throw '';
                }
                taskNotToBeDeleted.push( taskInfo );
            }
        } );
    }
    return { taskNotToBeDeleted: taskNotToBeDeleted, statesMessage: statesMessage };
};

var getLocalizedState = function( state ) {
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    switch( state ) {
        case 'in_progress':
            return localTextBundle.inProgress;
        case 'complete':
            return localTextBundle.complete;
        case 'closed':
            return localTextBundle.Saw1StateClosed;
        case 'aborted':
            return localTextBundle.Saw1StateAborted;
    }
};

var prepareStatesMessage = function( states ) {
    let statesMessage = '';
    states.forEach( function( state ) {
        var localizedstate = getLocalizedState( state );
        if ( states.indexOf( state ) === states.length - 1 ) {
            statesMessage += '\'' + localizedstate + '\'.';
        } else {
            statesMessage += '\'' + localizedstate + '\' ' + ',';
        }
    } );
    return statesMessage;
};

/**
 * Get the select object from provider from UI and add to the data
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {selection} Array - The selection object array
 */
export let addSelectedObject = function( data, selection ) {
    // Check if selection is not null then only add it to the view model
    data.userObject = [];
    if( selection ) {
        selection.forEach( selected => {
            var resultObject = cdm.getObject( selected.uid );

            if( resultObject.props.user ) {
                data.userObject.push( cdm.getObject( resultObject.props.user.dbValues[ 0 ] ) );
            } else {
                data.userObject.push( resultObject );
            }
        } );
    } else {
        data.userObject = null;
    }
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

var prepareUserCell = function( cellHeader1, cellHeader2 ) {
    var userCellProps = [];
    if( cellHeader1 && cellHeader2 ) {
        userCellProps = [];
        userCellProps.push( ' User Name \\:' + cellHeader1 );
        userCellProps.push( ' Group Role Name \\:' + cellHeader2 );
    }
    return userCellProps;
};

/**
 * Get the user cell property that needs to be shown on UI
 *
 * @param {Object} resultObject - The model object for property needs to be populated
 * @return {Array} Property array that will be visible on UI
 */
var getUserProps = function( resultObject ) {
    var userCellProps;
    var userObject;
    var cellHeader1 = null;
    var cellHeader2 = null;

    // Check if user property is loaded for group member object then get the user
    // object first and then populate the user name for that
    if( resultObject.props.user && resultObject.props.user.dbValues ) {
        userObject = cdm.getObject( resultObject.props.user.dbValues[ 0 ] );
        cellHeader1 = resultObject.props.user.uiValues[ 0 ];

        if( userObject && userObject.props.user_name && userObject.props.user_name.uiValues ) {
            cellHeader1 = userObject.props.user_name.uiValues[ 0 ];
        }
    }

    // Check if group and role properties are not null and loaded then populate the group and role string to be shown on UI
    if( resultObject.props.group && resultObject.props.group.uiValues && resultObject.props.role &&
        resultObject.props.role.uiValues ) {
        cellHeader2 = resultObject.props.group.uiValues[ 0 ] + '/' + resultObject.props.role.uiValues[ 0 ];
    }
    userCellProps = prepareUserCell( cellHeader1, cellHeader2 );

    return userCellProps;
};

/**
 * Parse the perform search response and return the correct output data object
 *
 * @param {Object} response - The response of performSearch SOA call
 * @return {Object} - outputData object that holds the correct values .
 */
var processSoaResponse = function( response ) {
    var outputData;
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
        _.forEach( response.searchResults, function( result ) {
            // Get the model object for search result object UID present in response
            var resultObject = cdm.getObject( result.uid );

            if( resultObject ) {
                var props = null;

                // Check if result object type is not null
                // then set the correct cell properties for User object
                if( resultObject.modelType.typeHierarchyArray.indexOf( 'ResourcePool' ) > -1 ) {
                    var cellHeader1 = resultObject.props.group.uiValues[ 0 ];
                    if( cellHeader1 === '' ) {
                        cellHeader1 = localTextBundle.saw1Any;
                    }
                    var cellHeader2 = resultObject.props.role.uiValues[ 0 ];
                    if( cellHeader2 === '' ) {
                        cellHeader2 = localTextBundle.saw1Any;
                    }
                    props = prepareUserCell( cellHeader1, cellHeader2 );
                } else if( resultObject.type ) {
                    props = getUserProps( resultObject );
                }

                if( props && props.length > 0 ) {
                    resultObject.props.awp0CellProperties.dbValues = props;
                    resultObject.props.awp0CellProperties.uiValues = props;
                }
            }
        } );
    }

    // Construct the output data that will contain the results
    outputData = {
        searchResults: response.searchResults,
        totalFound: response.totalFound,
        totalLoaded: response.totalLoaded
    };

    return outputData;
};

/**
 * Populate the project list based on the selection
 *
 * @param {data} data - The qualified data of the viewModel
 *
 */
export let populateProjectData = function( data ) {
    // Initialize the project object list to empty array for now

    var projectListModelArray = [];
    var projectListSchModelArray = [];
    _.forEach( data.availableProjectsList, function( project ) {
        var found = false;
        if( data.commonProjectList ) {
            for( var i = 0; i < data.commonProjectList.length; i++ ) {
                if( project.uid === data.commonProjectList[ i ].uid ) {
                    found = true;
                    break;
                }
            }
        }
        if( found ) {
            var listModelObject = _getEmptyListModel();

            listModelObject.propDisplayValue = project.props.object_string.uiValues[ 0 ];
            listModelObject.propInternalValue = project.props.project_id.dbValues[ 0 ];
            projectListModelArray.push( listModelObject );
        }
    } );

    //Add the project templates of owning schedule if any.
    //Check to ensure that schedule tag is always present.
    var owningScheduleUid = appCtxService.ctx.selected.props.schedule_tag.dbValue;
    if( owningScheduleUid ) {
        var owningScheduleObj = cdm.getObject( owningScheduleUid );
        if( owningScheduleObj.props.project_list.dbValues.length > 0 ) {
            _.forEach( data.availableProjectsList, function( project ) {
                for( var i = 0; i <=   owningScheduleObj.props.project_list.dbValues.length  - 1; i++ ) {
                    if( project.uid === owningScheduleObj.props.project_list.dbValues[ i ] ) {
                        var listModelObject = _getEmptyListModel();
                        listModelObject.propDisplayValue = project.props.object_string.uiValues[ 0 ];
                        listModelObject.propInternalValue = project.props.project_id.dbValues[ 0 ];
                        projectListSchModelArray.push( listModelObject );
                    }
                }
            } );
        }
    }
    let finalProjectListModelArray =  _.unionWith( projectListModelArray, projectListSchModelArray, _.isEqual );

    // Check if preference value is not null and if equals to "org_default" then add the empty list model with "None" value to 0th index
    // and if value is project_default then add the empty list model with "None" value to the end of project list
    prefValue = appCtxService.ctx.preferences.WRKFLW_show_user_assignment_options[ 0 ];
    if( prefValue ) {
        var emptyProjectListModel = _getEmptyListModel();
        emptyProjectListModel.propDisplayValue = data.i18n.none;
        emptyProjectListModel.propInternalValue = '';

        if( prefValue === 'org_default' ) {
            finalProjectListModelArray.splice( 0, 0, emptyProjectListModel );
        } else if( prefValue === 'project_default' ) {
            finalProjectListModelArray.push( emptyProjectListModel );
        }
    }
    // Assign the project object list that will be shown on UI
    data.projectObjectList = finalProjectListModelArray;
};

/**
 * Do the perform search call to populate the user or resource pool based on object values
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let performSearch = function( data, dataProvider ) {
    // Check is data provider is null or undefined then no need to process further
    // and return from here
    if( !dataProvider ) {
        return;
    }

    // Get the policy from data provider and register it
    var policy = dataProvider.action.policy;

    policySvc.register( policy );

    var resourceProviderContentType = 'Users';

    if( dataProvider.name === 'getResourcePool' ) {
        resourceProviderContentType = 'NewResourcepool';
    }

    var searchString = data.filterBox.dbValue;
    var projectId = data.userProjectObject.dbValue;

    var inputData = {
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 25,
            providerName: 'Awp0ResourceProvider',
            searchCriteria: {
                parentUid: '',
                searchString: searchString,
                resourceProviderContentType: resourceProviderContentType,
                group: '',
                role: '',
                searchSubGroup: 'false',
                projectId: projectId,
                participantType: ''
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
        var outputData = processSoaResponse( response );
        deferred.resolve( outputData );
    } );
    return deferred.promise;
};

let getMembershipData = function( data ) {
    if( data.selectedTab.panelId === 'Saw1AddDisciplinesToSchedule' ) {
        data.membershipLevel = '';
    } else {
        data.membershipText = data.membershipData.dbValue;
        if( data.membershipData.dbValue === data.i18n.observer ) {
            data.membershipLevel = 0;
        } else if( data.membershipData.dbValue === data.i18n.participant ) {
            data.membershipLevel = 1;
        } else {
            data.membershipLevel = 2;
        }
    }
    return data.membershipLevel;
};

/**
 * Prepares input for addMembership SOA with selected members
 * @param {*} ctx - context variable
 * @param {*} data - data used to get membership level
 * @param {*} resources - type of member user, resource pool, discipline
 */
export let addSelectedMembers = function( ctx, data, resources ) {
    let membershipData = [];
    let membershipLevel = getMembershipData( data );
    if( resources ) {
        resources.forEach( resource => {
            let members =  {
                schedule: ctx.schedule.selectedObject,
                resource: resource,
                membershipLevel: membershipLevel,
                cost: '',
                currency: '0'
            };
            membershipData.push( members );
        } );
    }

    return membershipData;
};

export let getSelectedObjects = function() {
    let selectedVMOs = [];
    // Convert non-VMOs such as ViewModelTreeNode to regular VMOs.
    let selectedObjects = selectionService.getSelection().selected;
    if( selectedObjects && selectedObjects.length > 0 ) {
        selectedObjects.forEach( object => {
            if( viewModelObjectService.isViewModelObject( object ) ) {
                selectedVMOs.push( object );
            } else {
                selectedVMOs.push( viewModelObjectService.createViewModelObject( object.uid ) );
            }
        } );
    }
    return selectedVMOs;
};

export let getAssignmentsContainer = function( data ) {
    {
        var assignments = [];
        var selObj = appCtxService.ctx.mselected;

        for( var index = 0; index < selObj.length; index++ ) {
            var selectedTaskObj = selObj[ index ];
            assignments.push( {
                task: selectedTaskObj,
                resource: data.userObject,
                discipline: {},
                assignedPercent: 100,
                placeholderAssignment: {},
                isPlaceHolder: false
            } );
        }

        return assignments;
    }
};

export let checkScheduleTags = function( data, selected ) {
    for( var index = 1; index < selected.length; index++ ) {
        if( selected[ 0 ].props.schedule_tag.dbValue !== selected[ index ].props.schedule_tag.dbValue ) {
            throw 'assignmentDiffSchError';
        }
    }
};

/**
 * To process the selected objects
 *
 * @param {Object} ctx - The Context object
 */
export let processSelectedObjects = function( ctx ) {
    var inputGetProperties = [];
    var selectedObj = ctx.mselected;

    if( selectedObj.length ) {
        if( selectedObj[ 0 ].modelType.typeHierarchyArray.indexOf( 'ScheduleMember' ) > -1 ) {
            inputGetProperties.push( ctx.pselected );
        } else {
            for( var i = 0; i < selectedObj.length; i++ ) {
                inputGetProperties.push( selectedObj[ i ] );
            }
        }
    } else {
        inputGetProperties.push( selectedObj );
    }

    return inputGetProperties;
};

export let unAssignResources = function( schedule ) {
    var inputData = {};
    var ctx = appCtxService.ctx;
    var selectedMembers = [];
    if( ctx.selected && ctx.selected.modelType.typeHierarchyArray.indexOf( 'ResourceAssignment' ) > -1 ) {
        var selectedMembers = ctx.mselected;
    } else {
        var selectionMembers = ctx.relationContext.relationInfo;
        if( selectionMembers && selectionMembers.length > 0 ) {
            var key = '';
            for( key in selectionMembers ) {
                if( selectionMembers.hasOwnProperty( key ) ) {
                    var _temp = {};
                    _temp.uid = selectionMembers[ key ].relationObject.uid;
                    _temp.type = selectionMembers[ key ].relationObject.type;
                    selectedMembers.push( _temp );
                }
            }
        }
    }
    if( selectedMembers.length > 0 ) {
        inputData.assignmentDeletes = selectedMembers;
        inputData.schedule = {
            uid: schedule.uid,
            type: schedule.type
        };
        return soaService.post( 'ProjectManagement-2012-02-ScheduleManagement', 'deleteAssignments', inputData );
    }
};

export let cutTaskOperation = function() {
    var selection = selectionService.getSelection().selected;

    var scheduleName = appCtxService.ctx.pselected.props.object_string.dbValues[ 0 ];

    var tasksToBeCut = [];

    if( selection !== null && selection.length > 0 ) {
        for( var index = 0; index < selection.length; index++ ) {
            if( selection[ index ].props.task_type.dbValues[ 0 ] !== smConstants.TASK_TYPE.SS ) {
                var objectToBeCut = cdm.getObject( selection[ index ].uid );
                tasksToBeCut.push( objectToBeCut );
            }
        }
        selectionService.updateSelection( tasksToBeCut, appCtxService.ctx.pselected );
        clipboardService.instance.setContents( tasksToBeCut );
    }
    return scheduleName;
};

export let getDependencies = function() {
    var selection = selectionService.getSelection().selected;

    if( selection.length > 0 ) {
        var deleteDependencyContainer = selection;
    }

    return deleteDependencyContainer;
};

export let getSchedule = function() {
    var taskArray = [ cdm.getObject( appCtxService.ctx.pselected.uid ) ];
    var scheduleUid = taskArray[ 0 ].props.schedule_tag.dbValues[ 0 ];
    return cdm.getObject( scheduleUid );
};

var prepareDeleteAllTaskErrorMessage = function( states, taskNotToBeDeleted, selection ) {
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    var finalMessage = messagingService.applyMessageParams( localTextBundle.allTaskDelete, [ '{{numberOfTasks}}', '{{stateMessage}}' ], {
        numberOfTasks: selection.length,
        stateMessage: prepareStatesMessage( states )
    } );

    taskNotToBeDeleted.forEach( function( task ) {
        finalMessage += '\n';
        let message = localTextBundle.singleTaskDeleteErrorMessage;
        message = messagingService.applyMessageParams( localTextBundle.singleTaskDeleteErrorMessage, [ '{{taskName}}', '{{taskStatus}}' ], {
            taskName: task.name,
            taskStatus: task.status
        } );
        finalMessage += message;
    } );
    return finalMessage;
};

export let processSelectedTasksToDelete = function() {
    var selection = selectionService.getSelection().selected;
    let smPreventUpdatePref = appCtxService.ctx.preferences.SM_PREVENT_UPDATE_STATES;
    let smPreventDeletePref = appCtxService.ctx.preferences.SM_PREVENT_DELETE_STATES;
    let taskNotToBeDeleted = [];

    selection.forEach( function( selectedTask ) {
        if( smPreventDeletePref && smPreventDeletePref.indexOf( selectedTask.props.fnd0status.dbValues[0] ) > -1 ||
                    smPreventUpdatePref && smPreventUpdatePref.indexOf( selectedTask.props.fnd0status.dbValues[0] ) > -1  ) {
            let taskInfo = {};
            let taskDisplayName = selectedTask.props.awp0CellProperties.uiValues[0];
            let taskStatusDisplayName = selectedTask.props.awp0CellProperties.uiValues[1];
            var nameValue = taskDisplayName.split( TEMPLATE_VALUE_CONN_CHAR );
            var statusName = taskStatusDisplayName.split( TEMPLATE_VALUE_CONN_CHAR );
            taskInfo.name = nameValue[1];
            taskInfo.status = statusName[1];
            taskNotToBeDeleted.push( taskInfo );
        }
    } );
    var subSchedules = [];
    var tasksToBeDeleted = [];
    if( taskNotToBeDeleted.length > 0 ) {
        let states;
        if( smPreventDeletePref && smPreventUpdatePref ) {
            states = smPreventUpdatePref.concat( smPreventDeletePref );
        } else if( smPreventUpdatePref ) {
            states = smPreventUpdatePref;
        } else {
            states = smPreventDeletePref;
        }
        let uniqueStates = states.filter( ( c, index ) => {
            return states.indexOf( c ) === index;
        } );
        var finalMessage = prepareDeleteAllTaskErrorMessage( uniqueStates, taskNotToBeDeleted, selection );
        if ( finalMessage.length ) {
            messagingService.showError( finalMessage );
        }
    } else {
        if( selection.length > 0 ) {
            for( var index = 0; index < selection.length; index++ ) {
            //get the object to fetch the properties available after call of getProperties
                var schTask = cdm.getObject( selection[ index ].uid );
                if( schTask.modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) > -1 ) {
                    tasksToBeDeleted.push( schTask );
                } else {
                    if( schTask.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
                        if( appCtxService.ctx.pselected.props.fnd0SummaryTask.dbValues[ 0 ] === schTask.uid ) {
                            throw 'invalidScheduleSummaryTaskDelete';
                        }
                        subSchedules.push( schTask.props.schedule_tag.dbValues[ 0 ] );
                    } else {
                        tasksToBeDeleted.push( schTask );
                    }
                }
            }
        }
    }
    return { subSchedules: subSchedules, tasksToBeDeleted: tasksToBeDeleted };
};

export let getDetachScheduleContainer = function( data ) {
    var detachScheduleContainer = [];

    if( data.subSchedules.length > 0 ) {
        var masterSchedule = appCtxService.ctx.pselected;
        for( var index = 0; index < data.subSchedules.length; index++ ) {
            var subSchedule = cdm.getObject( data.subSchedules[ index ] );
            detachScheduleContainer.push( {
                masterSchedule: masterSchedule,
                subSchedule: subSchedule
            } );
        }
    }

    return detachScheduleContainer;
};

export let getSelectedTasks = function() {
    var selectedTasks = [];
    var selection = selectionService.getSelection().selected;
    for( var index = 0; index < selection.length; index++ ) {
        selectedTasks.push( selection[ index ] );
    }

    return selectedTasks;
};

export let getScheduleUid = function() {
    var taskArray = [ cdm.getObject( appCtxService.ctx.pselected.uid ) ];
    return taskArray[ 0 ].props.schedule_tag.dbValues[ 0 ];
};
/**
 * Checks whether TC server version is greater than or equal to major, minor or qrm
 */
export let checkVersionSupportForProject = function( major, minor, qrm ) {
    return true; // FIXME
};

let containsParent = ( objects, testUid ) => {
    if( !cdm.isValidObjectUid( testUid ) ) {
        return false;
    }

    let parentUid = _.get( cdm.getObject( testUid ), 'props.fnd0ParentTask.dbValues[0]', cdm.NULL_UID );
    if( !cdm.isValidObjectUid( parentUid ) ) {
        return false;
    }

    if( _.findIndex( objects, { uid: parentUid } ) > -1 ) {
        return true;
    }
    return containsParent( objects, parentUid );
};

/**
 * Method for preparing input container for paste tasks SOA call
 *
 * @param {Object} ctx - The Context object
 */
export let pasteScheduleTasks = function( ctx ) {
    var inputData = [];
    var copiedTasks = ctx.awClipBoardProvider;
    var selectedTasksToPaste = ctx.mselected;

    if( selectedTasksToPaste.length > 1 ) {
        throw 'errMsgForPasteOperation';
    }

    var scheduleTag = cdm.getObject( ctx.selected.props.schedule_tag.dbValues[0] );

    //Check for selected task to paste location is not schedule summary task
    if( scheduleTag.props.schedule_type.dbValues[ 0 ] !== smConstants.SCHEDULE_TYPE.SUB &&
        ctx.selected.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
        throw 'errMsgForSchSummaryTask';
    }

    var scheduleUid = null;
    if( ctx.selected.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
        scheduleUid = ctx.pselected.props.fnd0SummaryTask.dbValues[ 0 ];
    } else {
        scheduleUid = ctx.selected.props.fnd0ParentTask.dbValues[0];
    }
    // Remove the child tasks whose parents are also being copied.
    let tasksToCopy = copiedTasks.filter( task => !containsParent( copiedTasks, task.uid ) );

    inputData.push( {
        sourceTask: cdm.getObject( tasksToCopy[ 0 ].uid ),
        prevSibling: cdm.getObject( selectedTasksToPaste[ 0 ].uid ),
        newParent: cdm.getObject( scheduleUid ),
        flag: 0
    } );

    for( var index = 1; index < tasksToCopy.length; index++ ) {
        inputData.push( {
            sourceTask: cdm.getObject( tasksToCopy[ index ].uid ),
            prevSibling: {},
            newParent: cdm.getObject( scheduleUid ),
            flag: 0
        } );
    }

    return inputData;
};

export let getUpdatedObjects = function( commandContext ) {
    var objs = [];
    if( commandContext ) {
        objs.push( cdm.getObject( commandContext.openedObject ? commandContext.openedObject.uid : commandContext.selectionData.selected[0].props.schedule_tag.dbValue ) );
    }
    return objs;
};

export default exports = {
    addSelectedObject,
    addSelectedMembers,
    populateProjectData,
    performSearch,
    getSelectedObjects,
    getAssignmentsContainer,
    checkScheduleTags,
    processSelectedObjects,
    unAssignResources,
    cutTaskOperation,
    getDependencies,
    getSchedule,
    processSelectedTasksToDelete,
    getDetachScheduleContainer,
    getSelectedTasks,
    getScheduleUid,
    checkVersionSupportForProject,
    pasteScheduleTasks,
    getTasksNotToBeUpdated,
    getUpdatedObjects
};
