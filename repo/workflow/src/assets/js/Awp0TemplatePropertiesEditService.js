// Copyright (c) 2022 Siemens

/**
 * This is the handler for save edit in properties section for template
 *
 * @module js/Awp0TemplatePropertiesEditService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import editService from 'js/Awp0WorkflowAssignmentEditService';
import messagingService from 'js/messagingService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Creates an edit handler for the view model object.
 * @param {Object} data Data view model object
 *
 */
export let addEditHandler = function( data ) {
    var saveEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        exports.saveTemplateProperties();
        deferred.resolve( {} );
        return deferred.promise;
    };

    var cancelEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        if( data && data.vmo ) {
            data.vmo.clearEditiableStates( true );
        }
        deferred.resolve( {} );
        return deferred.promise;
    };

    // Pass true as last argument to enable auto save for properties tab
    editService.createEditHandlerContext( data, null, saveEditFunc, cancelEditFunc, 'TEMPLATE_PROPERTIES_EDIT', null, true );
};

/**
 * Updated the template properties based on input modiifed props.
 *
 * @param {Array} templateProps Template properties that need to be modifeid
 * @param {Object} data Data view model object
 * @param {Object} templateObject Template object which need to be modified
 * @param {Array} allPromises All promises array to hold SOA promise
 */
var _updateModifiedTemplateProps = function( templateProps, data, templateObject, allPromises ) {
    // Check if template props is null or template object is null then no need to process further
    if( !templateProps || !templateObject ) {
        return;
    }
    var additionalDataMap = {};
    var inputData = [];

    // Iterate for all template properties and create additioanl data
    // that need to be pass on server
    _.forEach( templateProps, function( props ) {
        var propName = props.propInternalName;
        if( propName === 'task_type' ) {
            data.isUpdateCacheNeeded = true;
        }

        // This is fix for defect # LCS-393939 where user modified the name and then do online, there
        // it does online operation first and then modify the properties as name is displayed on tile
        // name value on properties tab got reset and it was not updating to new value. So added
        // special handling here to save the name
        if( propName === 'template_name' && props.dbValue !== undefined && props.newValue !== undefined
        && props.dbValue !== props.newValue ) {
            additionalDataMap[ propName ] = [ props.newValue.toString() ];
        } else if( props.dbValue !== undefined ) {
            // Check if property value is not undefined then only update it.
            additionalDataMap[ propName ] = [ props.dbValue.toString() ];
        }
    } );

    // Check if additional data is empty then no need to save anything for template.
    if( _.isEmpty( additionalDataMap ) ) {
        return;
    }

    var object = {
        clientID: 'saveEditTemplate',
        templateToUpdate: templateObject.uid,
        additionalData: additionalDataMap
    };
    inputData.push( object );
    var soaInput = {
        input: inputData
    };

    // Check if SOA input is not null and not empty then only make SOA call
    if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
        var promise = soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateTemplate', soaInput );
        allPromises.push( promise );
    }
};

/**
 * Get the input structure based on input property obejct and add to input data so that it can be
 * used for SOA for condition task query
 *
 * @param {Object} epmSetConditionHandler Set condition handler object
 * @param {Object} data Data view model object
 * @param {Array} inputData Input data array where input will be added
 * @returns {Object} Delete handler object that need to be deleted
 */
var _getConditionTaskUpdateSOAInput = function( epmSetConditionHandler, data, inputData ) {
    var additionalDataMap = {};
    if( !data.vmo || data.vmo.modelType.typeHierarchyArray.indexOf( 'EPMConditionTaskTemplate' ) <= -1 ) {
        return inputData;
    }
    var deleteHandlerObject = null;
    var queryScope = data.vmo.props.queryScope.dbValue;
    var includeReplica = data.vmo.props.includeRepliaceTarget.dbValue;
    var queryName = data.vmo.props.savedQueries.dbValue;
    var queryType = data.vmo.props.queryAganist.dbValue;
    var conditionName = data.vmo.props.savedConditions.uiValue;
    var taskTemplateUid = data.vmo.uid;
    var handlerToUpdateUid = '';
    var isHandlerCreateCase = true;
    var action = 2;

    // Check if handler is already exist then check if handler need to be updated
    // or delete the exisitng one and create new one.
    if( data.vmo.props.queryScope && data.vmo.props.queryScope.isEditable && epmSetConditionHandler ) {
        isHandlerCreateCase = false;
        // Check if query name or conditionName is empty then handler need to be removed
        if( queryName === '' || conditionName === '' ) {
            deleteHandlerObject = epmSetConditionHandler;
            return deleteHandlerObject;
        }
        handlerToUpdateUid = epmSetConditionHandler.uid;
        // Check if query type is sub process and new value is task or target then existing handler need to be removed
        // Or if exist query type is task or target and new value is sub process then also need to remove
        if( data.vmo.props.queryCondition.dbValue === 'query' && queryType === 'sub-process' && ( data.vmo.props.queryAganist.value === 'task' || data.vmo.props.queryAganist.value === 'target' ) ||
            data.vmo.props.queryAganist.value === 'sub-process' && ( queryType === 'task' || queryType === 'target' ) ) {
            // Set this value to true so that we need to update the existing handler and pass the action value as
            // it will be use as handler create case.
            isHandlerCreateCase = true;
        } else {
            taskTemplateUid = '';
        }
    }
    // Check if query name is not empty then only create SOA input structure
    if( queryName !== '' && data.vmo.props.queryCondition.dbValue === 'query' ) {
        additionalDataMap[ '-query' ] = [ queryName ];
        additionalDataMap[ '-check_targets' ] = [ queryScope ];
        additionalDataMap[ '-query_type' ] = [ queryType ];
        if( includeReplica ) {
            additionalDataMap[ '-include_replica' ] = [];
        }
        if( queryType === 'sub-process' ) {
            action = 4;
        }
    }
    if( conditionName !== '' && data.vmo.props.queryCondition.dbValue === 'condition' ) {
        additionalDataMap[ '-condition_name' ] = [ conditionName ];
        additionalDataMap[ '-check_targets' ] = [ queryScope ];
        if( includeReplica ) {
            additionalDataMap[ '-include_replica' ] = [];
        }
    }
    var object = null;
    // If this is handler create case then create the create handler SOA input else use the update handler SOA input
    if( isHandlerCreateCase ) {
        object = {
            clientID: 'createSetCondition',
            handlerName: 'EPM-set-condition',
            action: action,
            taskTemplate: taskTemplateUid,
            handlerToUpdate: handlerToUpdateUid,
            additionalData: additionalDataMap,
            handlerType: 'Action'
        };
    } else {
        object = {
            clientID: 'updateSetCondition',
            handlerToUpdate: handlerToUpdateUid,
            additionalData: additionalDataMap,
            handlerType: 'Action'
        };
    }
    if( object ) {
        inputData.push( object );
    }

    // Return deleteHandlerObject in case where handler need to be deleted.
    return deleteHandlerObject;
};

/**
 * Get the input structure based on input property obejct and add to input data so that it can be
 * used for SOA.
 *
 * @param {Object} epmCreateStatusHandler Create status handler object
 * @param {Object} releaseStatusProp Relesae status prop obejct from where property value need to be get
 * @param {Array} inputData Input data array where input will be added
 */
var _getStatusHandlerUpdateSOAInput = function( epmCreateStatusHandler, releaseStatusProp, inputData ) {
    if( epmCreateStatusHandler && releaseStatusProp ) {
        var additionalDataMap = {};
        additionalDataMap[ '-status' ] = [ releaseStatusProp.dbValues[0] ];
        var object = {
            clientID: 'saveEditHandler',
            handlerToUpdate: epmCreateStatusHandler.uid,
            additionalData: additionalDataMap
        };
        inputData.push( object );
    }
};

/**
 * Get the input structure based on input property obejct and add to input data so that it can be
 * used for SOA for handler create or update
 *
 * @param {Object} epmSetDurationHandler Set condition handler object
 * @param {Object} data Data view model object
 * @param {Object} taskDurationProp Task duration prop obejct from where property value need to be get
 * @param {Array} inputData Input data array where input will be added
 *
 */
var _getSetDurationUpdateSOAInput = function( epmSetDurationHandler, data, taskDurationProp, inputData ) {
    var additionalDataMap = {};
    var taskTemplateUid = data.vmo.uid;
    var durationProp = parseInt( taskDurationProp.dbValue );
    // Check if value is invalid then no need to save it further
    if( isNaN( durationProp ) || durationProp <= 0 ) {
        return;
    }
    // Check if value is >= 0 then only save it
    if( durationProp && durationProp >= 0 ) {
        additionalDataMap[ '-hour' ] = [ durationProp.toString() ];
    }
    var object = null;
    if( epmSetDurationHandler ) {
        object = {
            clientID: epmSetDurationHandler.uid + 'saveEditHandler',
            handlerToUpdate: epmSetDurationHandler.uid,
            additionalData: additionalDataMap
        };
    } else {
        object = {
            clientID: taskTemplateUid + 'createSetDuration',
            handlerName: 'EPM-set-duration',
            action: 2,
            taskTemplate: taskTemplateUid,
            additionalData: additionalDataMap,
            handlerType: 'Action'
        };
    }
    if( object ) {
        inputData.push( object );
    }
};
/**
 * Get the input structure based on input property obejct and add to input data so that it can be
 * used for SOA for create preferences
 *
 * @param {data} data Data view model object
 * @param {objectTypesProp} objectTypesProp object types
 * @param {allPromises} allPromises all
 *
 */
var getCreatePreferencesInput = function(  data, objectTypesProp, allPromises ) {
    var exisitngPreference = [];
    var preferenceToCreate = [];
    var preferenceToDelete = [];
    var preferenceToDeleteStringArray = [];
    _.forEach( data.preferencesForTemplate, function ( preference ) {
        exisitngPreference.push( preference.propInternalValue );
    });
    preferenceToCreate = _.difference( objectTypesProp.dbValue, exisitngPreference );
    preferenceToDelete = _.differenceBy( exisitngPreference, objectTypesProp.dbValue, 'uid' );
    if ( preferenceToCreate.length > 0 ) {
        _.forEach( preferenceToCreate, function ( prefToCreate ) {
            var description = '';
            var modifiedPreferenceValue = [];
            var _isArray = false;
            var preferenceNameToCheck = prefToCreate.props.fnd0InternalName.dbValues[0] + '_default_workflow_template';
            description = description.concat( data.i18n.PreferenceCreateDescription.replace('{0}', prefToCreate.props.object_string.dbValues[0]) );
            var promise4 = soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
                preferenceNames: [ preferenceNameToCheck ],
                includePreferenceDescriptions: false
            }).then( function ( result ) {
                if ( result && !_.isEmpty(result.response) && result.response[0].values.values ) {
                    if ( result.response[0].values.values[0].includes("::") || result.response[0].values.values.length > 1 ) {
                        var valueTobeAdded = [ data.templateName.dbValues[0] ];
                        var exisitingPrefValues = result.response[0].values.values;
                        if( !result.response[0].values.values[0].includes("::") )
                        {
                            exisitingPrefValues = result.response[0].values.values.slice(1);
                        }
                        modifiedPreferenceValue = valueTobeAdded.concat(exisitingPrefValues);
                        _isArray = true;
                    } else {
                        modifiedPreferenceValue = [ data.templateName.dbValues[0] ];
                    }
                } else {
                    modifiedPreferenceValue = [ data.templateName.dbValues[0] ];
                }
                var setPreferencesInput = {
                    preferenceInput: [{
                        definition: {
                            name: prefToCreate.props.fnd0InternalName.dbValues[0] + '_default_workflow_template',
                            category: 'General',
                            description: description,
                            type: 0,
                            isArray: _isArray,
                            protectionScope: 'User'
                        },
                        values: modifiedPreferenceValue
                    }]
                };
                var promise = soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'setPreferencesDefinition', setPreferencesInput );
                allPromises.push(promise);
            });
            allPromises.push( promise4 );
        });
    }
    if ( preferenceToDelete.length > 0 ) {
        _.forEach( preferenceToDelete, function (prefToDelete) {
            var preferenceName = prefToDelete.props.fnd0InternalName.dbValues[0] + '_default_workflow_template';
            preferenceToDeleteStringArray.push( preferenceName );
        });
    }
    if ( preferenceToDeleteStringArray.length > 0 ) {
        _.forEach(preferenceToDeleteStringArray, function ( preferenceToDel ) {
            var preferenceValues = [];
            var hasGroupTypeDefault = false;
            var promise5 = soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
                preferenceNames: [ preferenceToDel ],
                includePreferenceDescriptions: false
            }).then( function ( result ) {
                if ( result && !_.isEmpty(result.response) && result.response[0].values.values ) {
                    var values = result.response[0].values.values;
                    if ( values ) {
                        for ( var i = 0; i < values.length; i++ ) {
                            preferenceValues.push( values[i] );
                        }
                    }
                    for ( var i = 0; i < preferenceValues.length; i++ ) {
                        if ( preferenceValues[i].includes("::") ) {
                            hasGroupTypeDefault = true;
                            break;
                        }
                    }
                    if ( preferenceValues.length > 1 && hasGroupTypeDefault ) {
                        preferenceValues = preferenceValues.filter( prefVal => prefVal !== data.templateName.dbValue[0] );
                        var setPreferencesInput = {
                            preferenceInput: [{
                                definition: {
                                    name: preferenceToDel,
                                    category: 'General',
                                    type: 0,
                                    isArray: true,
                                    protectionScope: 'User'
                                },
                                values: preferenceValues
                            }]
                        };
                        var promise3 = soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'setPreferencesDefinition', setPreferencesInput );
                        allPromises.push( promise3 );
                    } else {
                        var deletePreferencesDefinitionIn = {
                            preferenceNames: [ preferenceToDel ],
                            deleteAllCustomDefinitions: false
                        };
                        var promise2 = soaSvc.post( 'Administration-2012-09-PreferenceManagement', 'deletePreferenceDefinitions', deletePreferencesDefinitionIn );
                        allPromises.push( promise2 );
                    }
                }
            });
            allPromises.push( promise5 );
        });
    }
};

/**
 * Check if handler properties like release status or condition query properties need modification
 * if yes then it will call SOA else do nothing.
 *
 * @param {Array} handlerProps Handler props array that need to check if modified from UI
 * @param {Object} data Data view model object
 * @param {Array} allPromises All promises array to hold the SOA promise
 */
var _updateModifiedHandlerProps = function( handlerProps, data, allPromises ) {
    if( !handlerProps || !data ) {
        return;
    }
    var deleteSetConditionHandler = null;
    var inputData = [];

    // Check if modified props contain any condation query related property then only process further
    // to update or create set condition handler
    if( handlerProps.queryScope || handlerProps.queryAganist || handlerProps.savedQueries ||
        handlerProps.includeRepliaceTarget || handlerProps.savedConditions ) {
        deleteSetConditionHandler = _getConditionTaskUpdateSOAInput( data.setConditionHandler, data, inputData );
    }

    // Check if relate status property is modified and handler present then only modify the handler
    if( handlerProps.releaseStatus && data.epmCreateStatusHandler ) {
        _getStatusHandlerUpdateSOAInput( data.epmCreateStatusHandler, handlerProps.releaseStatus, inputData );
    }

    // Check if task duration property is modified then only process further to create or update the handler
    if( handlerProps.taskDuration ) {
        _getSetDurationUpdateSOAInput( data.setDurationHandler, data, handlerProps.taskDuration, inputData );
    }
    if( handlerProps.allowedDefaultObjectTypes ) {
        getCreatePreferencesInput( data, handlerProps.allowedDefaultObjectTypes, allPromises );
    }

    var soaInput = {
        input: inputData
    };

    // Check if SOA input is not null and not empty then only make SOA call
    if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
        var promise = soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateHandler', soaInput );
        allPromises.push( promise );
    }
    //
    if( deleteSetConditionHandler ) {
        var deletePromise = soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: [ deleteSetConditionHandler ] } );
        allPromises.push( deletePromise );
    }
};

/**
 * Update the template properties
 * @param {Boolean} refreshPanel True or false based on panel need to be refresh or not
 */
export let saveTemplateProperties = function( refreshPanel, readOnlydata ) {
    var editHandler = editService.getActiveEditHandler();
    if( !editHandler || !editHandler.getDataSource() || !editHandler.getDataSource().getDeclViewModel() ) {
        return;
    }
    let data = { ...readOnlydata };
    if(  _.isEmpty( data ) ) {
        data = editHandler.getDataSource().getDeclViewModel();
    }
    var modifiedProps = editHandler.getDataSource().getAllModifiedProperties();
    var templateProps = [];
    var handlerProps = [];

    // Check if selected obejct for properties section is visible is deleted then update the panel based on new
    // selection or don't show the panel in delete process case.
    if( data.vmo && data.eventMap && data.eventMap[ 'cdm.deleted' ] && data.eventMap[ 'cdm.deleted' ].deletedObjectUids &&
        data.eventMap[ 'cdm.deleted' ].deletedObjectUids.indexOf( data.vmo.uid ) > -1 ) {
        return;
    }

    // Check if modified props is empty or null then no need to process
    // further and return from here
    if( !modifiedProps || modifiedProps.length <= 0 ) {
        // If this boolean is true that means user is doing end edit or online option so
        // we will stay on properties tab yet. So just update the tab with latest details.
        if( refreshPanel ) {
            eventBus.publish( 'epmTaskTemplate.updatePanel' );
        }
        return;
    }

    // Iterate for all modified props and see if propInternalName exist that means
    // template actual proeprty need to be modified else put it in handler props
    // which tells handler need to modified or created
    _.forEach( modifiedProps, function( props ) {
        if( props.propInternalName ) {
            templateProps.push( props );
        } else {
            handlerProps[ props.propertyName ] = props;
        }
    } );

    var allPromises = [];
    // Update the individual method and update template
    _updateModifiedTemplateProps( templateProps, data, data.vmo, allPromises );
    _updateModifiedHandlerProps( handlerProps, data, allPromises );

    // Check if data is not null and it has that cache need to be updated then only remove it from client cache
    // so that correct node icon and category will be updated once SOA response finished.
    // This is needed to update the type of model obejct in client cache.
    if( data && data.isUpdateCacheNeeded && data.vmo ) {
        var cache = clientDataModelSvc.getCache();
        if( cache && cache[ data.vmo.uid ] ) {
            delete cache[ data.vmo.uid ];
        }
        data.isUpdateCacheNeeded = null;
    }
    // When all SOA gets completed then only call below internal code
    // to update the UI or show the error.
    AwPromiseService.instance.all( allPromises ).then( function() {
        if( data && data.vmo ) {
            data.vmo.clearEditiableStates( true );
        }

        // If this boolean is true that means user is doing end edit or online option so
        // we will stay on properties tab yet. So just update the tab with latest details.
        if( refreshPanel ) {
            eventBus.publish( 'epmTaskTemplate.updatePanel' );
        }
        // Adding this to get the updated preference for Template and update the UI
        eventBus.publish('loadPreferenceForSelectedTemplate');
    }, function( error ) {
        if( data && data.vmo ) {
            data.vmo.clearEditiableStates( true );
        }
        // If this boolean is true that means user is doing end edit or online option so
        // we will stay on properties tab yet. So just update the tab with latest details.
        if( refreshPanel ) {
            eventBus.publish( 'epmTaskTemplate.updatePanel' );
        }
        if( error && error.message ) {
            messagingService.showError( error.message );
        }
        // Adding this to get the updated preference for Template and update the UI
        eventBus.publish('loadPreferenceForSelectedTemplate');
    } );
};

export default exports = {
    addEditHandler,
    saveTemplateProperties
};
