// Copyright (c) 2022 Siemens

/**
 * This implements the workflow process assignements implementation
 *
 * @module js/Awp0ProcessAssignment
 */
import dataProviderFactory from 'js/dataProviderFactory';
import declDataProviderService from 'js/declDataProviderService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import vmcs from 'js/viewModelObjectService';
import _ from 'lodash';
import assignmentPanelSvc from 'js/Awp0WorkflowAssignmentPanelService';

var exports = {};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {Array} Property internal values array
 */
var _getPropValue = function( modelObject, propName ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = modelObject.props[ propName ].dbValues;
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Get the proeprty value that particiapnt is stored on job or target.
 *
 * @param {Object} panelData Panel data object
 *
 * @returns {Object} Property value store on job or not
 */
var _getStoreParticipantOnJobPropValue = function( panelData ) {
    var propValue = null;
    if( panelData && panelData.workflowTemplates && panelData.workflowTemplates.dbValue ) {
        propValue = _getPropValue( panelData.workflowTemplates.dbValue, 'fnd0StoreParticipantsOnJob' );
    }
    return propValue;
};


/**
 * This will create the dataProvider for Participant list
 * @param {object} data - data
 * @param {Object} ctx App context object
 */
var createParticipantsDataProviders = function( data, ctx ) {
    var panelData = ctx.dynamicAssignmentPanelData;
    var dataProviderList = [];
    if( panelData.processAssignmentParticipants && panelData.processAssignmentParticipants.length > 0 ) {
        panelData.processAssignmentParticipantProviderList = [];

        var fnd0StoreParticipantsOnJob = _getStoreParticipantOnJobPropValue( panelData );
        for( var idx = 0; idx < ctx.dynamicAssignmentPanelData.processAssignmentParticipants.length; idx++ ) {
            var dataProvider = dataProviderFactory.createDataProvider( null, null, ctx.dynamicAssignmentPanelData.processAssignmentParticipants[ idx ].typeName, declDataProviderService );
            dataProvider.json = {
                selectionModelMode: panelData.processAssignmentParticipants[ idx ].selectionMode
            };
            dataProvider.selectionModel.mode = panelData.processAssignmentParticipants[ idx ].selectionMode;
            dataProviderList.push( dataProvider );
            panelData.processAssignmentParticipants[ idx ].dataProvider = dataProvider;
        }
    }
    var selectionBasedParticipants = [];
    _.forEach( dataProviderList, function( dataProvider ) {
        var participantType = dataProvider.name;
        var selectionMode = dataProvider.selectionModel.mode;
        var object = {
            internalName : participantType,
            selectionMode : selectionMode,
            dataProvider : dataProvider
        };
        selectionBasedParticipants.push( object );
        // Check if participant need to show target participant then we need to show need to show existing participant if present
        if( fnd0StoreParticipantsOnJob && fnd0StoreParticipantsOnJob === '0' &&  panelData.existingParticipants && panelData.existingParticipants[ dataProvider.name ] ) {
            Array.prototype.push.apply( dataProvider.viewModelCollection.loadedVMObjects, panelData.existingParticipants[ dataProvider.name ] );
            var length = dataProvider.viewModelCollection.loadedVMObjects.length;
            dataProvider.viewModelCollection.totalFound = length;
            dataProvider.viewModelCollection.totalObjectsLoaded = length;
        }
    } );
    panelData.processAssignmentParticipantProviderList = dataProviderList;
    var panelContext = {
        selectionBasedParticipants : selectionBasedParticipants
    };
    assignmentPanelSvc.initializeParentData( data );
    assignmentPanelSvc.initializePanelContextData( panelContext );
    data.isParticipantInfoLoaded = true;
};

/**
 * This will remove the participant from the dataProvider
 * @param {object} data - data
 * @param {object} cmdContext - command context
 */
export let removeParticipantAssignments = function( data, cmdContext ) {
    var dataProvider = cmdContext.dataProvider;
    var modelObjects = dataProvider.viewModelCollection.loadedVMObjects;

    var finalModelObjects = _.difference( modelObjects, dataProvider.selectedObjects );

    dataProvider.viewModelCollection.loadedVMObjects = finalModelObjects;
    dataProvider.viewModelCollection.totalFound = finalModelObjects.length;
    dataProvider.viewModelCollection.totalObjectsLoaded = finalModelObjects.length;
    dataProvider.selectedObjects = [];
    var dataObject = appCtxSvc.ctx.dynamicAssignmentPanelData;

    if( dataObject && finalModelObjects.length === 0 ) {
        var index = _.findKey( dataObject.processAssignmentParticipants, {
            typeName: dataProvider.name
        } );
        if( dataObject.processAssignmentParticipants && dataObject.processAssignmentParticipants[ index ] ) {
            dataObject.processAssignmentParticipants[ index ].allParticipantRemoved = true;
        }
    }
};

/**
 * Get the participant types that need to be loaded.
 * @param {Array} participantTypes Participant types for type constant need to be loaded
 * @param {Object} data Data view model object
 * @param {Object} subPanelContext Parent panel data object
 * @param {Object} ctx Context object
 *
 * @returns {Array} Type constants that need to be loaded
 */
export let getParticipantConstantLoaded = function( participantTypes, data, subPanelContext, ctx ) {
    ctx.dynamicAssignmentPanelData = subPanelContext;
    data.isAddButtonVisible = true;
    data.isParticipantInfoLoaded = false;
    var constantTypesPopulated = [];
    if( !participantTypes ) {
        data.isParticipantInfoLoaded = true;
        return constantTypesPopulated;
    }

    _.forEach( participantTypes, function( participantType  ) {
        var object1 = {
            typeName: participantType.typeName,
            constantName: 'ParticipantAllowMultipleAssignee'
        };

        var object2 = {
            typeName: participantType.typeName,
            constantName: 'ParticipantUsedOnObjectTypes'
        };

        constantTypesPopulated.push( object1 );
        constantTypesPopulated.push( object2 );
    } );
    return constantTypesPopulated;
};

/**
 * Get the first target object that is being submitted to workflow
 *
 * @returns {Object}  Target object
 */
var _getTargetObject = function() {
    var targetObject = null;
    if( appCtxSvc.ctx && appCtxSvc.ctx.workflow_process_candidates && appCtxSvc.ctx.workflow_process_candidates.workFlowObjects
        && appCtxSvc.ctx.workflow_process_candidates.workFlowObjects.length > 0 && appCtxSvc.ctx.workflow_process_candidates.workFlowObjects[ 0 ] ) {
        targetObject = appCtxSvc.ctx.workflow_process_candidates.workFlowObjects[ 0 ];
    }
    return targetObject;
};

/**
 * Populate all valid participant types that need to be shown on panel.
 *
 * @param {Object} data Data view model object
 * @param {Array} typeConstantValues Type
 * @param {Object} ctx App context object
 */
export let populateValidParticipantTypes = function( data, typeConstantValues, ctx ) {
    var target = _getTargetObject();
    data.targetObject = target;
    var fnd0StoreParticipantsOnJob = _getStoreParticipantOnJobPropValue( ctx.dynamicAssignmentPanelData );
    var dpPanelData = ctx.dynamicAssignmentPanelData;
    // Check if typeConstantValues is invalid or empty
    if( !typeConstantValues || typeConstantValues.length <= 0 ) {
        data.isParticipantInfoLoaded = true;
        return;
    }
    // Iterate for each type constant and check for it's values like it's single value or
    // multiple value and what are valud supported types
    _.forEach( typeConstantValues, function( typeConstant ) {
        var constantKey = typeConstant.key;
        var constantName = constantKey.constantName;

        var index = _.findKey( dpPanelData.processAssignmentParticipants, {
            typeName: constantKey.typeName
        } );

        if( index !== undefined ) {
            if( constantName === 'ParticipantAllowMultipleAssignee' ) {
                var selectionMode = 'single';
                if( typeConstant.value === 'true' ) {
                    selectionMode = 'multiple';
                }
                dpPanelData.processAssignmentParticipants[ index ].selectionMode = selectionMode;
            }
            if( constantName === 'ParticipantUsedOnObjectTypes' && fnd0StoreParticipantsOnJob && fnd0StoreParticipantsOnJob === '0' ) {
                if( typeConstant.value === 'None' ) {
                    dpPanelData.processAssignmentParticipants.splice( index, 1 );
                } else {
                    var isSupported = false;
                    var supportedTypes = typeConstant.value.split( ',' );
                    for( var idx = 0; idx < supportedTypes.length; idx++ ) {
                        if( target && target.modelType && target.modelType.typeHierarchyArray.indexOf( supportedTypes[ idx ] ) > -1 ) {
                            isSupported = true;
                            break;
                        }
                    }
                    if( !isSupported ) {
                        dpPanelData.processAssignmentParticipants.splice( index, 1 );
                    }
                }
            }
        }
    } );
};

/**
 * Populate the participant data provider that need to be shown on panel.
 * @param {Object} data Data view model object
 * @param {Object} ctx App context object
 */
export let createParticipantsDataProvider = function( data, ctx ) {
    var fnd0StoreParticipantsOnJob = _getStoreParticipantOnJobPropValue( ctx.dynamicAssignmentPanelData );
    // Check for proeprty if it's 0 then we need to show target based participants else empty data provider
    // for job based DP's.
    if( fnd0StoreParticipantsOnJob === '0' ) {
        exports.createTargetBasedDPProviders( data, ctx );
        return;
    }
    createParticipantsDataProviders( data, ctx );
};

/**
 * Create the data providers for DP based on target. So first get all particiapnt present on first target
 * and that will be used for auto populated on panel.
 *
 * @param {Object} data Data view model object
 * @param {Object} ctx App context object
 */
export let createTargetBasedDPProviders = function( data, ctx ) {
    if( !data.targetObject ) {
        return;
    }
    var modelObjects = [];

    var validTargetObject = cdm.getObject( data.targetObject.uid );
    if( validTargetObject && validTargetObject.props.HasParticipant && validTargetObject.props.HasParticipant.dbValues ) {
        var hasParticipants = validTargetObject.props.HasParticipant.dbValues;

        for( var idx in hasParticipants ) {
            var modelObj = cdm.getObject( hasParticipants[ idx ] );
            modelObjects.push( modelObj );
        }
    }
    var existingParticipantMap = new Object();
    // Iterate for all participant obejcts and get the assignee and add to the map so that will hold particiapnt type
    // correspond to these exisitng participants.
    _.forEach( modelObjects, function( modelObject ) {
        if( modelObject && modelObject.props && modelObject.props.assignee &&  modelObject.props.assignee.dbValues
            &&  modelObject.props.assignee.dbValues[ 0 ] ) {
            var groupMemberUID = modelObject.props.assignee.dbValues[ 0 ];
            var groupMemberVMOObject = vmcs.createViewModelObject( groupMemberUID );
            var dpTypeName = modelObject.type;
            var participantList = existingParticipantMap[ dpTypeName ];
            if( !participantList ) {
                participantList = [];
            }
            if( groupMemberVMOObject && participantList ) {
                participantList.push( groupMemberVMOObject );
                existingParticipantMap[ dpTypeName ] = participantList;
            }
        }
    } );

    ctx.dynamicAssignmentPanelData.existingParticipants = existingParticipantMap;
    createParticipantsDataProviders( data, ctx );
};

/**
 * Update the info for paste command is visible or not.
 *
 * @param {Object} ctx App context object
 * @param {Object} panelContext Panel context object
 * @param {Array} selectedObjects Selected objects for paste command need to be shown
 */
export let updatePasteCommandContext = function( ctx, panelContext, selectedObjects ) {
    if( panelContext === undefined ) {
        panelContext = {};
    }
    if( !selectedObjects || selectedObjects.length <= 0 ) {
        panelContext.isPasteCommandVisible = false;
        panelContext.selectedObjects = [];
        return;
    }
    panelContext.selectedObjects = selectedObjects;
    panelContext.isPasteCommandVisible = true;
    if( ctx.taskAssignmentCtx ) {
        ctx.taskAssignmentCtx.panelContext = panelContext;
    } else {
        ctx.taskAssignmentCtx = {
            panelContext : panelContext
        };
    }
};

export default exports = {
    removeParticipantAssignments,
    updatePasteCommandContext,
    getParticipantConstantLoaded,
    populateValidParticipantTypes,
    createParticipantsDataProvider,
    createTargetBasedDPProviders
};
