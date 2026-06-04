// Copyright (c) 2023 Siemens

/**
 * Simple Alert service for sample command Handlers
 *
 * @module js/peoplePickerAssistantUtils
 */

import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import AwHttpService from 'js/awHttpService';
import cdm from 'soa/kernel/clientDataModel';
import vmoSvc from 'js/viewModelObjectService';
import dataManagementService from 'soa/dataManagementService';
import cas from 'js/centralAggregationService';
import eventBus from 'js/eventBus';

var microServiceURLPredictionService = 'sd/cps/commandprediction/v2/commands';
var microServiceURLTrainingService = 'sd/cps/commandprediction/history';
var maxSuggestionsToGet = parseInt( appCtxService.ctx.preferences.AWA_max_people_picker_suggestions_to_load[0] );

var _UNSTAFFED_UID = 'unstaffedUID';

var exports = {};
var _appCtxService = appCtxService;

let arePPSuggestionsEnabled = function() {
    return _appCtxService.ctx.preferences &&
        _appCtxService.ctx.preferences.AWA_is_feature_installed && _appCtxService.ctx.preferences.AWA_is_feature_installed[ 0 ] === 'true' &&
        _appCtxService.ctx.preferences.AWA_enable_people_picker_suggestions && _appCtxService.ctx.preferences.AWA_enable_people_picker_suggestions[ 0 ] === 'true';
};

export let trainAssistant = function( assignmentStateContext ) {
    let dataForAssistant = { ...assignmentStateContext.value };
    parseAssistantData( dataForAssistant );
};

let getAssistant = function( taskId, assignmentGroup ) {
    let currentTrainingdata = cas.getCurrentApplicationContext();
    currentTrainingdata.maxPredictionsCount = maxSuggestionsToGet;
    currentTrainingdata.objectType = 'peoplePickerTask';
    currentTrainingdata.currentLocation = 'AssistantSuggestions';
    currentTrainingdata.nextLocation = 'AssistantSuggestions';
    currentTrainingdata.previousCommand = [ { identityParamName: 'TaskUid', identityParamValue: 'AnyValuePeoplePicker' } ];
    currentTrainingdata.currentCommand = [ { identityParamName: 'TaskUid', identityParamValue: taskId }, { identityParamName: 'AssignmentGroup', identityParamValue: assignmentGroup } ];

    return currentTrainingdata;
};

let post = function( body, url ) {
    if( arePPSuggestionsEnabled() ) {
        var $http = AwHttpService.instance;
        return $http.post( browserUtils.getBaseURL() + url, body, {
            headers: {}
        } );
    }
};

let parseAssistantData = function( data ) {
    let awTrainingData = { commandData: [] };
    if ( data && data.taskAssignmentDataObject ) {
        data.taskAssignmentDataObject.allTasksObjects.forEach( ( taskVmo ) => {
            let taskId = taskVmo.uid;
            let taskType;
            if( taskVmo.props.template_classification ) {
                taskType = taskVmo.props.template_classification.parentUid;
            } else if( taskVmo.props.task_template ) {
                taskType = taskVmo.props.task_template.dbValue;
            }

            data.taskAssignmentDataObject.taskInfoMap[ taskId ].props.acknowledgers.modelObjects.forEach( ( user ) => {
                awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'acknowledgers' ) } );
            } );

            data.taskAssignmentDataObject.taskInfoMap[ taskId ].props.assignee.modelObjects.forEach( ( user ) => {
                awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'assignee' ) } );
            } );

            data.taskAssignmentDataObject.taskInfoMap[ taskId ].props.notifyees.modelObjects.forEach( ( user ) => {
                awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'notifyees' ) } );
            } );

            data.taskAssignmentDataObject.taskInfoMap[ taskId ].props.reviewers.modelObjects.forEach( ( user ) => {
                awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'reviewers' ) } );
            } );
        } );
    }

    if( data.selectedPals !== null && data.selectedPals !== undefined ) {
        data.selectedPals.forEach( ( pal ) => {
            let palId = pal.uid;
            data.taskAssignmentDataObject.allTasksObjects.forEach( ( taskVmo ) => {
                let taskId = taskVmo.uid;
                let taskType;
                if( taskVmo.props.template_classification ) {
                    taskType = taskVmo.props.template_classification.parentUid;
                } else if( taskVmo.props.task_template ) {
                    taskType = taskVmo.props.task_template.dbValue;
                }
                if( data.taskAssignmentDataObject.palInfoMap[ palId ].hasOwnProperty( taskId ) ) {
                    data.taskAssignmentDataObject.palInfoMap[ palId ][ taskId ].props.acknowledgers.modelObjects.forEach( ( user ) => {
                        awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'acknowledgers' ) } );
                    } );

                    data.taskAssignmentDataObject.palInfoMap[ palId ][ taskId ].props.assignee.modelObjects.forEach( ( user ) => {
                        awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'assignee' ) } );
                    } );

                    data.taskAssignmentDataObject.palInfoMap[ palId ][ taskId ].props.notifyees.modelObjects.forEach( ( user ) => {
                        awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'notifyees' ) } );
                    } );

                    data.taskAssignmentDataObject.palInfoMap[ palId ][ taskId ].props.reviewers.modelObjects.forEach( ( user ) => {
                        awTrainingData.commandData.push( { ...createTrainingData( taskType, user, 'reviewers' ) } );
                    } );
                }
            } );
        } );
    }

    post( awTrainingData, microServiceURLTrainingService );
};

let createTrainingData = function( taskType, userVmo, group ) {
    let vmoId;
    let userRole;
    let userGroup;
    if( userVmo.taskAssignment.type === 'ResourcePool' ) {
        vmoId = userVmo.taskAssignment.uniqueUid;
        userGroup = 'ResourcePool';
        userRole = 'ResourcePool';
    } else {
        vmoId = userVmo.taskAssignment.uid;
        userGroup = userVmo.taskAssignment.cellProperties.Group.value;
        userRole = userVmo.taskAssignment.cellProperties.Role.value;
    }
    let objContext = { type: 'peoplePicker' };
    let currentTrainingdata = cas.getCurrentApplicationContext();
    currentTrainingdata.objectType = 'peoplePickerTask';
    currentTrainingdata.currentLocation = 'AssistantSuggestions';
    currentTrainingdata.nextLocation = 'AssistantSuggestions';
    currentTrainingdata.objectContext = JSON.stringify( objContext );
    currentTrainingdata.previousCommand = [ { identityParamName: 'TaskUid', identityParamValue: taskType }, { identityParamName: 'AssignmentGroup', identityParamValue: group } ];
    currentTrainingdata.currentCommand = [ { identityParamName: 'UserUid', identityParamValue: vmoId }, { identityParamName: 'UserGroup', identityParamValue: userGroup },
        { identityParamName: 'UserRole', identityParamValue: userRole }
    ];
    currentTrainingdata.nextLocation = currentTrainingdata.currentLocation;
    return currentTrainingdata;
};

let _applyFilters = function( modelObjects, filters ) {
    modelObjects = filters && filters.groupToFilterOn && filters.groupToFilterOn !== '*' ? modelObjects.filter( modelObject => modelObject.cellProperties.Group.value === filters.groupToFilterOn ) :
        modelObjects;
    modelObjects = filters && filters.roleToFilterOn && filters.roleToFilterOn !== '*' ? modelObjects.filter( modelObject => modelObject.cellProperties.Role.value === filters.roleToFilterOn ) :
        modelObjects;
    _appCtxService.ctx.peoplePickerFilters = null;
    return modelObjects;
};

export let updateSelectedUserState = function( selectedObjectsCombined, addUserPanelState ) {
    let selectedObjects = [];
    for( let key in selectedObjectsCombined ) {
        if( selectedObjectsCombined.hasOwnProperty( key ) && selectedObjectsCombined[ key ] !== null && selectedObjectsCombined[ key ] !== undefined ) {
            selectedObjectsCombined[ key ].forEach( vmo => {
                selectedObjects.push( vmo );
            } );
        }
    }
    if( addUserPanelState ) {
        const localState = { ...addUserPanelState.value };
        localState.selectedUsers = selectedObjects;
        addUserPanelState.update && addUserPanelState.update( localState );
    }
};

export let getDataFromAssistant = function( dataProvider, inputData, assignmentType, filters ) {
    filters = filters && Object.keys( filters ).length > 0 ? filters : _appCtxService.ctx.peoplePickerFilters;
    let prevCommandUid;
    if( inputData.taskObject.props.task_template ) {
        prevCommandUid = inputData.taskObject.props.task_template.dbValue;
    } else if( inputData.taskObject.props.template_classification ) {
        prevCommandUid = inputData.taskObject.props.template_classification.parentUid;
    }

    let awTrainingData = { commandData: {}, expertMode: false };
    awTrainingData.commandData = getAssistant( prevCommandUid, assignmentType );
    let postURL = post( awTrainingData, microServiceURLPredictionService );
    if ( postURL ) {
        postURL.then( response => {
            let modelObjects = [];
            let userModelObjects = [];

            // Map predictions to an array of promises
            let promises = response.data.predictions.map( prediction => {
                let predictionObj = JSON.parse( prediction.objectContext );
                if( predictionObj.type === 'peoplePicker' ) {
                    prediction.commandIdentityData.forEach( command => {
                        if( command.identityParamName === 'UserUid' ) {
                            // Push the promise returned by loadObjects to userModelObjects
                            userModelObjects.push( dataManagementService.loadObjects( [ command.identityParamValue ] ).then( function() {
                                let userModelObject = cdm.getObject( command.identityParamValue );
                                return vmoSvc.createViewModelObject( userModelObject );
                            } ) );
                        }
                    } );
                }
            } );

            // Wait for all promises to resolve
            Promise.all( userModelObjects )
                .then( userViewModelObjects => {
                    // Now all promises are resolved, you can populate modelObjects
                    modelObjects = userViewModelObjects;
                    _populateDataProvider( dataProvider, assignmentType === 'reviewers' ? _applyFilters( modelObjects, filters ) : modelObjects );
                } );
        } );
    }
};

export let updateSelection = function( selectionData, context ) {
    context[ 0 ] = selectionData[ 0 ];
};

export let updateReplaceSelection = function( selectionData, context ) {
    if( !context.selectedUsers[ 0 ] ) {
        context.selectedUsers = [];
        context.selectedUsers[ 0 ] = selectionData[ 0 ];
    } else {
        context.selectedUsers[ 0 ] = selectionData[ 0 ];
    }
};

var _populateDataProvider = function( dataProvider, modelObjects ) {
    var reviewers = [];
    if( modelObjects && modelObjects.length > 0 ) {
        _.forEach( modelObjects, function( modelObject ) {
            var assignmentObject = null;
            if( modelObject && modelObject.taskAssignment && !modelObject.internalName ) {
                assignmentObject = _.cloneDeep( modelObject );
                modelObject = modelObject.taskAssignment;
            }
            // If modelObject is not null then only set selected to false and add to data provider
            if( modelObject && modelObject.uid && modelObject.uid !== _UNSTAFFED_UID ) {
                modelObject.selected = false;

                if( _.isUndefined( modelObject.assignmentObject ) || !modelObject.assignmentObject ) {
                    modelObject.assignmentObject = assignmentObject;
                }
                reviewers.push( modelObject );
            }
        } );
    }
    // Update the contents in data provider
    dataProvider.update( reviewers, reviewers.length );
    return reviewers;
};

export let getReplaceDataFromAssistant = function( dataProvider, inputData ) {
    let prevCommandUid = inputData.subPanelContext.selectedAssignemnt._childObj.props.task_template.dbValue;
    let awTrainingData = { commandData: {}, expertMode: false };
    let assignerCategory = inputData.subPanelContext.selectedAssignemnt.assignmentObject.assignmentType;
    awTrainingData.commandData = getAssistant( prevCommandUid, assignerCategory );
    let postURL = post( awTrainingData, microServiceURLPredictionService );
    if ( postURL ) {
        postURL.then( response => {
            let modelObjects = [];
            let userModelObject;
            let userViewModelObject;
            response.data.predictions.forEach( prediction => {
                let predictionObj = JSON.parse( prediction.objectContext );
                if( predictionObj.type === 'peoplePicker' ) {
                    prediction.commandIdentityData.forEach( command => {
                        if( command.identityParamName === 'UserUid' ) {
                            userModelObject = cdm.getObject( command.identityParamValue );
                            userViewModelObject = vmoSvc.createViewModelObject( userModelObject );
                            modelObjects.push( userViewModelObject );
                        }
                    } );
                }
            } );
            _populateDataProvider( dataProvider, modelObjects );
        } );
    }
};

export let filterAssistantPredictions = function( selectedObjects ) {
    let groupToFilterOn = selectedObjects[ 0 ].groupName;
    let roleToFilterOn = selectedObjects[ 0 ].roleName;
    _appCtxService.ctx.peoplePickerFilters = { groupToFilterOn, roleToFilterOn };
    eventBus.publish( 'assistantPPFilter', { groupToFilterOn, roleToFilterOn } );
};

export let savePeoplePickerFilter = function( filterInput ) {
    return { filters: filterInput };
};

export default exports = {
    trainAssistant,
    updateSelectedUserState,
    getDataFromAssistant,
    updateSelection,
    getReplaceDataFromAssistant,
    updateReplaceSelection,
    filterAssistantPredictions,
    savePeoplePickerFilter
};
