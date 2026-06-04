// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0ParticipantService
 */
import AwPromiseService from 'js/awPromiseService';

import constantsService from 'soa/constantsService';
import cdmService from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import dataManagementService from 'soa/dataManagementService';
import localeService from 'js/localeService';
import cmmService from 'soa/kernel/clientMetaModel';
import editHandlerService from 'js/editHandlerService';
import localeSvc from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import awp0WrkflwUtils from 'js/Awp0WorkflowUtils';
import clipboardService from 'js/clipboardService';

import _ from 'lodash';
import adapterSvc from 'js/adapterService';

var exports = {};

/**
  * Open the repalce particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} selParticipantObject - Selected participant object that need to be replaced
  */
export let replaceParticipants = function( selectedItemRevision, commandContext, selParticipantObject ) {
    // Check if input item revision is null or comamnd context or obejct set source on command context is null
    // then no need to proceed further and return from here
    if( !selectedItemRevision || !commandContext || !selParticipantObject ) {
        return;
    }
    var participantType = null;
    var isParticipantTable = false;
    // Get the adapted object in we are getting selected participant as Awp0ObjectSetRow
    var selectedParticipants = adapterSvc.getAdaptedObjectsSync( [ selParticipantObject ] );
    if( selectedParticipants && selectedParticipants[0] ) {
        selParticipantObject = _.clone( selectedParticipants[0] );
    }

    // If comamnd context has objectSetSource that means we are doing action from object set table and
    // if we are doing it from participant table then get the participant type from object
    if( commandContext.objectSetSource ) {
        var objectSetSource = commandContext.objectSetSource;
        participantType = objectSetSource.substring( objectSetSource.indexOf( '.' ) + 1, objectSetSource.length );
    } else if( commandContext && commandContext.isParticipantTable && selParticipantObject.participantType ) {
        participantType = selParticipantObject.participantType;
        isParticipantTable = true;
    } else if( commandContext?.selectionData?.value?.selected[0] || commandContext?.selected && commandContext.anchor === 'awp0DynaPartTable_contextMenuAnchor' ) {
        selParticipantObject = selParticipantObject[0];
        participantType = selParticipantObject.type;
    }

    // If participant type is null then no need to process further
    if( !participantType ) {
        return;
    }

    //Popualte the particiapnt type contanst based on validate brign the panel or show the error to user
    _populateParticipantTypesMap( selectedItemRevision, participantType, commandContext, false ).then( function( result ) {
        var context = {
            selectedObject: selectedItemRevision,
            loadProjectData: true,
            participantType: participantType,
            selParticipantObject: selParticipantObject,
            resourceProvider: 'Awp0ResourceProvider'
        };

        var additionalSearchCriteria = {
            participantType : participantType
        };

        context.additionalSearchCriteria = additionalSearchCriteria;
        // This is mainly needed to reload participant table when user do replace action.
        context.isParticipantTable = isParticipantTable;

        const { dialogAction } = commandContext;
        if( dialogAction ) {
            let options = {
                view: 'Awp0ReplaceParticipant',
                parent: '.aw-layout-workareaMain',
                placement: 'right',
                width: 'SMALL',
                height: 'FULL',
                push: false,
                isCloseVisible: false,
                subPanelContext: { ...commandContext, ...context }
            };
            dialogAction.show( options );
        } else {
            commandPanelService.activateCommandPanel( 'Awp0ReplaceParticipant', 'aw_toolsAndInfo', context );
        }
    } );
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};


/**
  * extract type name from uid
  *
  * @param {string} uid model type uid
  * @returns {string}  Type name extraced from input
  */
var _getModelTypeNameFromUid = function( uid ) {
    var tokens = uid.split( '::' );
    if( tokens.length === 4 && tokens[ 0 ] === 'TYPE' ) {
        return tokens[ 1 ];
    }
    return null;
};

/**
 * External method to add participant
 *
 * @param {Object} selectedObject - Selected item revision where repalce action is initiated
 * @param {commandContext} commandContext - The qualified data of the viewModel
 * @param {ctx} ctx - The app context object
 */
export let addParticipants = function( selectedObject, commandContext, ctx ) {
    var selectedObjectsToLoad = [];
    selectedObjectsToLoad.push( selectedObject );
    dataManagementService.getPropertiesUnchecked( selectedObjectsToLoad, [ 'parent_process', 'root_target_attachments', 'fnd0StoreParticipantsOnJob' ] ).then( function() {
        exports.isEditInProgress().then( function() {
            addParticipantsInternal( selectedObject, commandContext, ctx );
        } );
    } );
};


/**
  * Internal Method to Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedObject - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {ctx} ctx - The app context object
  *
  * @returns {object} Return null in case of invalid selection
  */
var addParticipantsInternal = function( selectedObject, commandContext, ctx ) {
    // Check if input item revision is null or comamnd context or obejct set source on command context is null
    // then no need to proceed further and return from here
    if( !selectedObject || !commandContext  ) {
        return;
    }
    var participantType = null;
    var validSelectedObject = selectedObject;
    // If comamnd context has objectSetSource that means we are doing action from object set table and
    // if we are doing it from participant table then get the participant type from object
    if( commandContext.objectSetSource ) {
        var objectSetSource = commandContext.objectSetSource;
        participantType = objectSetSource.substring( objectSetSource.indexOf( '.' ) + 1, objectSetSource.length );
    } else if( commandContext.isParticipantTable ) {
        participantType = selectedObject.participantType;
        validSelectedObject = ctx.xrtSummaryContextObject;
    }

    // Check if Add participant is already active then panel should get closed
    if( ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'AddParticipant' ) {
        commandPanelService.activateCommandPanel( 'AddParticipant', 'aw_toolsAndInfo', null, null, null, {
            isPinUnpinEnabled: true
        } );
        return;
    }

    var objectsToLoad = [];
    objectsToLoad.push( validSelectedObject );
    var deferred = AwPromiseService.instance.defer();
    if( isOfType( validSelectedObject, 'ItemRevision' )  ) {
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'allowable_participant_types', 'assignable_participant_types', 'awp0RequiredParticipants' ] ).then( function() {
            // This is needed to pass the correct updated object to other method
            var modelObject = cdmService.getObject( validSelectedObject.uid );
            exports.openAddParticipantPanel( modelObject, commandContext, participantType, deferred, ctx );
        } );
    } else if( isOfType( validSelectedObject, 'EPMTask' ) || isOfType( validSelectedObject, 'Signoff' ) ) {
        // This is needed to pass the correct updated object to other method
        var modelObjects = [];
        var modelObject =  cdmService.getObject( selectedObject.props.root_target_attachments.dbValues[ 0 ] );
        modelObjects.push( modelObject );
        dataManagementService.getPropertiesUnchecked( modelObjects, [ 'allowable_participant_types', 'assignable_participant_types', 'awp0RequiredParticipants' ] ).then( function() {
            exports.openAddParticipantPanel( modelObject, commandContext, participantType, deferred, ctx );
        } );
    }
    return deferred.promise;
};


/**
  * Populate the participant type constant map that particiapnt can be added or not
  *
  * @param {Object} selectedItemRevision Selected ditem revision
  * @param {String} particiapntType Particiapnt type string
  * @param {ctx} App context object
  * @param {boolean} isAddCase True/False based on we are trying to add participant or replace.
  *
  * @returns{Object} Partiticiapnt type map
  */
var _populateParticipantTypesMap = function( selectedItemRevision, particiapntType, commandContext, isAddCase ) {
    var deferred = AwPromiseService.instance.defer();
    var constantTypesToPopulated = [];
    var allParticipantTypes = [];
    var isMultiParticipantCase = false;

    // Check if multiple participant data needs to be populated then add to the list so that
    // SOA can be called for those participants else add the input participant type to the list.
    if( isAddCase && commandContext.isParticipantTable && commandContext.assignableParticipantTypes )  {
        isMultiParticipantCase = true;
        _.forEach( commandContext.assignableParticipantTypes, function( participantObj ) {
            allParticipantTypes.push( participantObj.propInternalValue );
        } );
    } else if( particiapntType ) {
        allParticipantTypes.push( particiapntType );
    }

    _.forEach( allParticipantTypes, function( participantName ) {
        var object1 = {
            typeName: participantName,
            constantName: 'ParticipantAllowMultipleAssignee'
        };


        constantTypesToPopulated.push( object1 );
    } );

    if( constantTypesToPopulated.length > 0 ) {
        var multipleAllowedMap = [];


        var multiParticipantDataMap = {};
        constantsService.getTypeConstantValues( constantTypesToPopulated ).then( function( response ) {
            if( response && response.constantValues && response.constantValues.length > 0 ) {
                var typeConstantValues = response.constantValues;

                _.forEach( typeConstantValues, function( constantValue ) {
                    var constantKey = constantValue.key;
                    var constantName = constantKey.constantName;
                    var participantName = constantKey.typeName;
                    var value = constantValue.value;

                    var object = {
                        typeName: constantKey.typeName,
                        value: constantValue.value
                    };

                    var selectModelMode = 'single';
                    if( !multiParticipantDataMap[ participantName ]  ) {
                        multiParticipantDataMap[ participantName ] = {};
                    }
                    if( constantName === 'ParticipantAllowMultipleAssignee' ) {
                        multipleAllowedMap.push( object );
                        if( isMultiParticipantCase ) {
                            if( value === 'true' ) {
                                selectModelMode = 'multiple';
                            }
                            multiParticipantDataMap[ participantName ].selectModelMode = selectModelMode;
                        }
                    }
                } );
                var output = {
                    multipleAllowedMap: multipleAllowedMap,


                    multiParticipantDataMap : multiParticipantDataMap
                };

                deferred.resolve( output );
            }
        } );
    } else {
        deferred.resolve( {} );
    }
    return deferred.promise;
};


/**
  * Check if user is in object set table and table is not empty then return false. Else if user is in
  * participant table and selected object is participant object then return false.
  * @param {Object} commandContext Command context object
  *
  * @returns {boolean} True/False based on validation criteria
  */
var _isValidToOpenPanel = function( commandContext ) {
    if( commandContext && commandContext.dataProvider && commandContext.dataProvider.viewModelCollection.totalObjectsLoaded > 0 ) {
        return false;
    }
    // Check if we are in participant table then we need to return true from here.
    if( commandContext && commandContext.isParticipantTable ) {
        return true;
    }
    return true;
};

/**
  * Get the participant type user is trying to add, This is mainly needed for simple
  * change participant table.
  * @param {String} participantType Participant type user trying to add
  * @param {Object} commandContext Command context object
  * @returns {String} Selected participant type
  */
var _getParticipantTypeFromTable = function( participantType, commandContext ) {
    var selectedParticipantType = participantType;
    if( !commandContext || !commandContext.isParticipantTable ) {
        return selectedParticipantType;
    }
    if( commandContext.assignableParticipantTypes ) {
        selectedParticipantType = commandContext.assignableParticipantTypes[0].propInternalValue;
    }
    // Check if selected objects is not null and 0th object is not null then get the participant type from selected
    // object and add it to context. This is mainly needed for participant table then get the type from select object.
    if( commandContext.selectedObjects && commandContext.selectedObjects[ 0 ] && commandContext.selectedObjects[ 0 ].participantType ) {
        var selType = commandContext.selectedObjects[ 0 ].participantType;
        // Check if selected object participant type present in assignableParticipantTypes list then only use
        // selected object participant type else use 0th index value from assignableParticipantTypes list.
        var index1 = _.findIndex( commandContext.assignableParticipantTypes, function( particiapntTypeObject ) {
            return particiapntTypeObject.propInternalValue === selType;
        } );
        if( index1 > -1 ) {
            selectedParticipantType = selType;
        }
    }
    return selectedParticipantType;
};


/**
  * Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} participantType - The participant type where user want to add
  * @param {Object} result - The object that contains all particiapnt related info
  * @param {Object} deferred - The deferred object
  *
  */
var _openParticipantPanel = function( selectedItemRevision, commandContext, participantType, result, deferred ) {
    var selectModelMode = 'single';
    if( !result ) {
        deferred.resolve();
        return;
    }

    // Get the valid participant type user trying to add. This is mainly needed when
    // for when we show participant as table like simple chnage participant table
    participantType = _getParticipantTypeFromTable( participantType, commandContext );

    var multipleAllowedMap = result.multipleAllowedMap;

    if( multipleAllowedMap && multipleAllowedMap.length > 0 ) {
        for( var idx = 0; idx < multipleAllowedMap.length; idx++ ) {
            if( multipleAllowedMap[ idx ] && multipleAllowedMap[ idx ].typeName === participantType && multipleAllowedMap[ idx ].value === 'true' ) {
                selectModelMode = 'multiple';
                break;
            }
        }
    }

    if( selectModelMode === 'single' && !_isValidToOpenPanel( commandContext ) ) {
        var objectString = TypeDisplayNameService.instance.getDisplayName( selectedItemRevision );

        var resource = '/i18n/WorkflowCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );

        var message = messagingService.applyMessageParams( localTextBundle.ParticipantNotAllowMultipleUserErrorMessages, [ 'objectString', '{{messageString}}' ], {
            objectString: objectString,
            messageString: participantType
        } );
        messagingService.showError( message );
        deferred.resolve();
    } else {
        var context = {
            selectedObject: selectedItemRevision,
            loadProjectData: true,
            participantType: participantType,
            resourceProvider: 'Awp0ResourceProvider',
            selectionModelMode: selectModelMode,
            multiParticipantDataMap : result.multiParticipantDataMap
        };

        var additionalSearchCriteria = {
            participantType : participantType
        };

        context.additionalSearchCriteria = additionalSearchCriteria;


        // Check if command context is not null and context has table information then we
        // need to get assignableParticipantTypes and participant type from selected and if present
        // then set it to additional search criteria. This is mainly used when we show Participant list
        // box on user picker panel and if selected participant is not null then we need to select that
        // participant type default in list box.
        if( commandContext && commandContext.isParticipantTable && participantType ) {
            context.assignableParticipantTypes = commandContext.assignableParticipantTypes;
            context.isParticipantTable = true;
            context.additionalSearchCriteria.participantType = participantType;
            context.participantType = participantType;
        }

        const { dialogAction } = commandContext;
        if( dialogAction ) {
            let options = {
                view: 'AddParticipant',
                parent: '.aw-layout-workareaMain',
                placement: 'right',
                width: 'SMALL',
                height: 'FULL',
                push: false,
                isCloseVisible: false,
                isPinUnpinEnabled: true,
                subPanelContext: { ...commandContext, ...context }
            };
            dialogAction.show( options );
        } else {
            commandPanelService.activateCommandPanel( 'AddParticipant', 'aw_toolsAndInfo', context, null, null, {
                isPinUnpinEnabled: true
            } );
        }
        deferred.resolve();
    }
};


/**
  * Get the property DB value based on input property name.
  *
  * @param {Object} modelObject Object properties need to be loaded
  * @param {String} propName Property name that need to be loaded
  *
  * @return {Object} Property DB value for object
  */
var _getPropDBValues = function( modelObject, propName ) {
    if( modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues ) {
        return modelObject.props[ propName ].dbValues;
    }
    return null;
};

/**
  * Get allowable particiapnt type proeprty value list from input item revision.
  *
  * @param {Object} selectedItemRevision Selected item revision object
  *
  * @return {objectsArray} AllowableParticipantTypesList property value list
  *
  */
var _getAllowableParticipantTypesList = function( selectedItemRevision ) {
    var allowableParticipantTypesList = [];
    // Check if input model object is valid then get the latest model object
    // from client data model that will have latest properties loaded
    if( selectedItemRevision && selectedItemRevision.uid ) {
        selectedItemRevision = cdmService.getObject( selectedItemRevision.uid );
    }
    var allowableParticipantTypes = _getPropDBValues( selectedItemRevision, 'allowable_participant_types' );

    if( allowableParticipantTypes && allowableParticipantTypes.length > 0 ) {
        _.forEach( allowableParticipantTypes, function( type ) {
            var typeName = _getModelTypeNameFromUid( type );
            if( typeName ) {
                allowableParticipantTypesList.push( typeName );
            }
        } );
    }
    return allowableParticipantTypesList;
};

/**
  * Get allowable particiapnt type proeprty value list from input item revision.
  *
  * @param {Object} selectedItemRevision Selected item revision object
  *
  * @return {objectsArray} AllowableParticipantTypesList property value list
  *
  */
var _getAssignableParticipantTypesList = function( selectedItemRevision ) {
    var assignableParticipantTypesList = [];
    // Check if input model object is valid then get the latest model object
    // from client data model that will have latest properties loaded
    if( selectedItemRevision && selectedItemRevision.uid ) {
        selectedItemRevision = cdmService.getObject( selectedItemRevision.uid );
    }
    var assignableParticipantTypes = _getPropDBValues( selectedItemRevision, 'assignable_participant_types' );

    if( assignableParticipantTypes && assignableParticipantTypes.length > 0 ) {
        _.forEach( assignableParticipantTypes, function( type ) {
            var typeName = _getModelTypeNameFromUid( type );
            if( typeName ) {
                assignableParticipantTypesList.push( typeName );
            }
        } );
    }
    return assignableParticipantTypesList;
};

/**
  * Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} participantType - The participant type where user want to add
  * @param {Object} deferred - The deferred object
  * @param {Object} ctx Context object
  */
export let openAddParticipantPanel = function( selectedItemRevision, commandContext, participantType, deferred, ctx ) {
    // Get allowable and assignable particiapnt types for input item revision
    var allowableParticipantTypesList = _getAllowableParticipantTypesList( selectedItemRevision );
    var assignableParticipantTypesList = _getAssignableParticipantTypesList( selectedItemRevision );

    var isValidAllowable = true;
    var isValidAssignable = true;

    if( participantType && allowableParticipantTypesList && allowableParticipantTypesList.indexOf( participantType ) === -1 ) {
        isValidAllowable = false;
    }

    if( participantType && assignableParticipantTypesList && assignableParticipantTypesList.indexOf( participantType ) === -1 ) {
        isValidAssignable = false;
    }

    if( !isValidAllowable || !isValidAssignable ) {
        var objectString = TypeDisplayNameService.instance.getDisplayName( selectedItemRevision );
        var participantDisplayName = participantType;
        if( participantType ) {
            var participantTypeObject = cmmService.getType( participantType );
            if( participantTypeObject && participantTypeObject.displayName ) {
                participantDisplayName = participantTypeObject.displayName;
            }
        }
        var resource = '/i18n/WorkflowCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );

        var message = messagingService.applyMessageParams( localTextBundle.allowableParticipantErrorMessages, [ '{{messageString}}', 'objectString' ], {
            messageString: participantDisplayName,
            objectString: objectString
        } );
        messagingService.showError( message );
        deferred.resolve();
        return;
    }

    //Popualte the particiapnt type contanst based on validate brign the panel or show the error to user
    _populateParticipantTypesMap( selectedItemRevision, participantType, commandContext, true ).then( function( result ) {
        _openParticipantPanel( selectedItemRevision, commandContext, participantType, result, deferred );
    } );
};

/**
  * External Method to Check whether participant can be removed or not.
  *
  * @param {Object} selectedItemRevision - Selected item revision where remove participant action is initiated
  * @param {Object} selectedParticipants - Selected Participants
  * @param {boolean} isReplaceCase - True or false based on user is doing remove or repalce
  *
  * @returns {Promise} Promise object
  *
  */
export let canRemoveOrReplaceParticipant = function( selectedItemRevision, selectedParticipants, isReplaceCase ) {
    var deferred = AwPromiseService.instance.defer();
    exports.isEditInProgress().then( function() {
        canRemoveOrReplaceParticipantInternal( selectedItemRevision, selectedParticipants, isReplaceCase ).then( function() {
            deferred.resolve();
        }, function( msg ) {
            deferred.reject( msg );
        } );
    } );
    return deferred.promise;
};

/**
  * Internal Method to Check whether participant can be removed or not.
  *
  * @param {Object} selectedItemRevision - Selected item revision where remove participant action is initiated
  * @param {Object} selectedParticipants - Selected Participants
  * @param {boolean} isReplaceCase - True or false based on user is doing remove or repalce
  *
  * @returns {Promise} Promise object
  *
  */
var canRemoveOrReplaceParticipantInternal = function( selectedObject, selectedParticipants, isReplaceCase ) {
    var deferred = AwPromiseService.instance.defer();

    //Get assignable_participant_types property from server first because property might not be cached or value might be outdated.
    var objectsToLoad = [];
    objectsToLoad.push( selectedObject );
    if( isOfType( selectedObject, 'ItemRevision' )  ) {
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'assignable_participant_types' ] ).then( function() {
            checkIfCanRemoveOrReplace( objectsToLoad[0], selectedParticipants, isReplaceCase, deferred );
        } );
    } else if( isOfType( selectedObject, 'EPMTask' ) || isOfType( selectedObject, 'Signoff' ) ) {
        // This is needed to pass the correct updated object to other method
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'root_target_attachments', 'fnd0StoreParticipantsOnJob' ] ).then( function() {
            var modelObjects = [];
            var modelObject =  cdmService.getObject( selectedObject.props.root_target_attachments.dbValues[ 0 ] );
            modelObjects.push( modelObject );
            dataManagementService.getPropertiesUnchecked( modelObjects, [ 'assignable_participant_types' ] ).then( function() {
                checkIfCanRemoveOrReplace( modelObjects[0], selectedParticipants, isReplaceCase, deferred );
            } );
        } );
    }
    return deferred.promise;
};

/**
  * Internal Method to Check whether participant can be removed or not.
  *
  * @param {Object} selectedObject - Selected item revision where remove participant action is initiated
  * @param {Object} selectedParticipants - Selected Participants
  * @param {boolean} isReplaceCase - True or false based on user is doing remove or repalce
  * @param {Object} deferred- The deferred object
  *
  * @returns {Promise} Promise object
  *
  */
let checkIfCanRemoveOrReplace = function( selectedObject, selectedParticipants, isReplaceCase, deferred ) {
    var assignableParticipantTypesList = _getAssignableParticipantTypesList( selectedObject );
    var isValidAssignable = true;

    var participantDisplayName = null;

    if( selectedParticipants && selectedParticipants.length > 0 ) {
        // Get the adapted object in we are getting selected participant as Awp0ObjectSetRow
        selectedParticipants = adapterSvc.getAdaptedObjectsSync( selectedParticipants );
        for( var idx = 0; idx < selectedParticipants.length; idx++ ) {
            var participantType = selectedParticipants[ idx ].type;

            participantDisplayName = participantType;
            if( selectedParticipants[ idx ].modelType && selectedParticipants[ idx ].modelType.displayName ) {
                participantDisplayName = selectedParticipants[ idx ].modelType.displayName;
            }

            if( assignableParticipantTypesList && assignableParticipantTypesList.indexOf( participantType ) === -1 ) {
                isValidAssignable = false;
                break;
            }
        }
        if( !isValidAssignable ) {
            var objectString = TypeDisplayNameService.instance.getDisplayName( selectedObject );
            var resource = '/i18n/WorkflowCommandPanelsMessages';
            var localTextBundle = localeService.getLoadedText( resource );
            if( !participantDisplayName ) {
                participantDisplayName = participantType;
            }
            var defaultMessage = localTextBundle.removeParticipantErrorMessages;
            if( isReplaceCase ) {
                defaultMessage = localTextBundle.replaceParticipantErrorMessages;
            }

            var message = messagingService.applyMessageParams( defaultMessage, [ '{{messageString}}', 'objectString' ], {
                messageString: participantDisplayName,
                objectString: objectString
            } );
            messagingService.showError( message );
            deferred.reject( message );
        } else {
            deferred.resolve();
        }
    } else {
        deferred.resolve();
    }
};

/**
  * This function checkes if user is removing any participant and that participant type is required
  * then we need to refresh the whole page else we just need to refresh the table. Based on that it
  * will return true /false.
  *
  * @param {Object} response SOA response object after remove participant action
  * @param {Object} selectedObject Selected item revision objects
  * @param {Array} participantObjects Participant objects need to be removed
  *
  * @returns {boolean} True/False based on page need to be refresh or not.
  */
export let getRemoveParticipantPageRefreshNeeded = function( response, selectedObject, participantObjects ) {
    var isRefreshFlag = false;
    // Check if input is not valid then no need to process further and return false from here.
    if( !response || !selectedObject || !participantObjects || participantObjects.length <= 0 ) {
        return isRefreshFlag;
    }

    var removedParticipantTypes = [];
    // Get all participant types that user is trying to remove and store in the list
    _.forEach( participantObjects, function( participantObj  ) {
        if( participantObj && participantObj.type ) {
            removedParticipantTypes.push( participantObj.type );
        }
    } );

    // Get the awp0RequiredParticipants value from selected item revision and check if it matches
    // with any value user is trying to remove from table then if any one common type found then
    // we need to return true so that whole page will be refresh and required label will be shown
    // correctly else we just return false from here and individual table will get updated.
    var modelObject = cdmService.getObject( selectedObject.uid );
    if( modelObject && modelObject.props && modelObject.props.awp0RequiredParticipants ) {
        var requiredParticipants = modelObject.props.awp0RequiredParticipants.dbValues;
        var commonTypes = _.intersection( requiredParticipants, removedParticipantTypes );
        if( commonTypes && commonTypes.length > 0 ) {
            isRefreshFlag = true;
        }
    }
    return isRefreshFlag;
};

export let setDisplayType = function( commandContext ) {
    var ctx = appCtxSvc.getCtx();
    if( commandContext?.context ) {
        if( commandContext?.context?.showObjectContext === undefined && commandContext?.showObjectContext ) {
            commandContext.context.showObjectContext = commandContext.showObjectContext;
        } else if ( commandContext?.context?.showObjectContext === undefined && commandContext?.showObjectContext === undefined ) {
            commandContext.context.showObjectContext = {};
        }
        commandContext.context.showObjectContext.displayTitle = ctx.selected.props.fnd0ParticipantType.uiValues[0];
        commandContext.context.showObjectContext.isRemoveParticipant = true;
    }
};
/**
  * Get the valid selection and selected participants object that will be needed to remove. Based
  * on different location and differnet cases get the details from correct object and return it.
  *
  * @param {Object} commandContext Command context object to get the correct selection
  * @returns {Object} Valid parent selection and selected participant objects
  */
export let getRemoveParticipantObjects = function( commandContext ) {
    var deferred = AwPromiseService.instance.defer();

    var validSourceObject = null;
    var selectedParticipants = [];

    if ( !commandContext ) {
        return {
            selectedObject: validSourceObject,
            selectedParticipants: selectedParticipants
        };
    }

    var ctx = appCtxSvc.getCtx();

    if( commandContext && commandContext?.showObjectContext === undefined ) {
        commandContext.showObjectContext = {
            type: ctx?.selected?.modelType?.displayName
        };
    }

    if( commandContext && commandContext?.showObjectContext  ) {
        commandContext.showObjectContext.displayTitle = ctx?.selected?.modelType?.displayName;
        commandContext.showObjectContext.isRemoveParticipant = true;
    }

    // If command context is participant table then get the correct selection from vmo object.
    // If not the participant table, then check if pselected info present on selection data then
    // use that info else if opened object is not null and selection info not present then use
    // opened object as valid object
    if( commandContext?.isParticipantTable ) {
        validSourceObject = commandContext?.vmo;
    } else if( commandContext?.selectionData?.value?.pselected ) {
        validSourceObject = commandContext?.selectionData?.value?.pselected;
    } else if( commandContext?.openedObject && ( !commandContext?.selectionData || !commandContext?.selectionData?.value || !commandContext?.selectionData?.value?.pselected ) && !ctx?.locationContext?.['ActiveWorkspace:SubLocation']?.includes( 'objectNavigationSubLocation' ) ) {
        validSourceObject = commandContext?.openedObject;
    } else if( commandContext?.dataProvider?.getSelectedObjects()?.length > 0 && commandContext?.dataProvider?.getSelectedObjects()[0]?.type === 'Fnd0ParticipantByType' || commandContext?.selected?.length > 0 && commandContext?.selected[0]?.type === 'Fnd0ParticipantByType' ) {
        validSourceObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    } else if( ctx?.pselected ) {
        validSourceObject = ctx?.pselected;
    }

    var objectsToLoad = [];
    objectsToLoad.push( validSourceObject );
    if( isOfType( validSourceObject, 'EPMTask' ) || isOfType( validSourceObject, 'Signoff' ) ) {
        // This is needed to pass the correct updated object to other method
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'root_target_attachments', 'fnd0StoreParticipantsOnJob' ] ).then( function() {
            validSourceObject =  cdmService.getObject( validSourceObject?.props?.root_target_attachments?.dbValues[0] );

            // Get the adapted object from valid source object so that will be used for SOA calls.
            if( validSourceObject ) {
                var adaptedObjs = adapterSvc.getAdaptedObjectsSync( [ validSourceObject ] );
                if( adaptedObjs && !_.isEmpty( adaptedObjs ) ) {
                    validSourceObject = adaptedObjs;
                }
            }

            // If command context is participant table then get the selectedObjects from context
            // else get the selected from selectionData on command context.
            if( commandContext?.isParticipantTable ) {
                selectedParticipants = commandContext?.selectedObjects;
            } else if( commandContext?.selectionData?.value?.selected  ) {
                selectedParticipants = commandContext?.selectionData?.value?.selected;
            }

            var outputData = {
                selectedObject: validSourceObject,
                selectedParticipants : selectedParticipants
            };
            deferred.resolve( outputData );
        } );
    } else {
        // Get the adapted object from valid source object so that will be used for SOA calls.
        if( validSourceObject ) {
            var adaptedObjs = adapterSvc.getAdaptedObjectsSync( [ validSourceObject ] );
            if( adaptedObjs && !_.isEmpty( adaptedObjs ) ) {
                validSourceObject = adaptedObjs;
            }
        }

        // If command context is participant table then get the selectedObjects from context
        // else get the selected from selectionData on command context.
        if( ctx?.mselected?.[0]?.modelType?.typeHierarchyArray?.indexOf( 'Participant' ) > -1 || ctx?.mselected?.modelType?.typeHierarchyArray?.indexOf( 'Participant' ) > -1 ) {
            selectedParticipants = ctx?.mselected;
        } else if( commandContext?.isParticipantTable ) {
            selectedParticipants = commandContext?.selectedObjects;
        } else if( commandContext?.selectionData?.value?.selected  ) {
            selectedParticipants = commandContext?.selectionData?.value?.selected;
        }
        var outputData = {
            selectedObject: validSourceObject,
            selectedParticipants : selectedParticipants
        };
        deferred.resolve( outputData );
    }
    return deferred.promise;
};


/**
 * This function will check if the user is in start edit mode.
 *
 * @returns {Promise} Promise object
 */
export let isEditInProgress = function() {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'InboxMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    editHandlerService.isDirty().then( function( editContext ) {
        if( editContext && editContext.isDirty ) {
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: localTextBundle.save,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.saveEdits().then( function() {
                        deferred.resolve();
                        //In the event of an error saving edits
                    }, function() {
                        deferred.resolve();
                    } );
                }
            },
            {
                addClass: 'btn btn-notify',
                text: localTextBundle.discard,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.cancelEdits();
                    deferred.resolve();
                }
            }
            ];
            messagingService.showWarning( localTextBundle.navigationConfirmation, buttons );
        } else {
            editHandlerService.cancelEdits();
            deferred.resolve();
        }
    } );
    return deferred.promise;
};

export let modifyAddableParticipantTypes = async( response, data ) => {
    let responseObjs = response.ServiceData.modelObjects;
    let typeObjs = [];
    for ( let objId in responseObjs ) {
        if( responseObjs[objId].type === 'Fnd0ParticipantByType' ) {
            typeObjs.push( responseObjs[objId] );
        }
    }

    data.dataProviders.addableParticipantsProvider.update( typeObjs, typeObjs.length );
    return typeObjs;
};

export let backToSelectParticipantType = ( sharedData ) => {
    const newSharedData = _.clone( sharedData );
    newSharedData.activeView = 'Awp0AddableDynamicParticipants';
    newSharedData.selectedParticipantType = {};
    return newSharedData;
};

export let handleParticipantTypeSelection = ( selectedObjects, addTitle, subPanelContext ) => {
    if( selectedObjects && selectedObjects.length > 0 ) {
        const newSharedData = { ...subPanelContext.sharedData.value };
        newSharedData.activeView = 'Awp0AddDynamicParticipantsSub';
        newSharedData.participantType = _getModelTypeNameFromUid( selectedObjects[0].props.fnd0ParticipantType.dbValues[0] );
        newSharedData.selectedParticipantType = selectedObjects[0];
        newSharedData.participantTypeHeader = addTitle + ' ' + selectedObjects[0].props.fnd0ParticipantType.uiValues[0];
        if( selectedObjects[0].props.fnd0IsMultiValued.dbValue ) {
            newSharedData.participantTypeSelectionMode = 'multiple';
        } else {
            newSharedData.participantTypeSelectionMode = 'single';
        }
        subPanelContext.sharedData.update && subPanelContext.sharedData.update( newSharedData );
        return newSharedData;
    }
};

export let addDynamicParticipants = async( userPanelData, subPanelContext ) => {
    if( userPanelData ) {
        let validObjects =  await awp0WrkflwUtils.getValidObjectsToAdd( userPanelData.searchCriteria, userPanelData.selectedUsers );
        let localUserPanelData = { ... userPanelData };
        localUserPanelData.selectedUsers = validObjects;

        let inputData = {};
        inputData.input = constructAddDynamicParticipantsInput( localUserPanelData, subPanelContext );

        // SOA call made to add the participant
        return await soaSvc.postUnchecked( 'Participant-2018-11-Participant', 'addParticipants', inputData );
    }
};

let constructAddDynamicParticipantsInput = ( localUserPanelData, subPanelContext ) => {
    let selectedObj = cdmService.getObject( localUserPanelData.criteria.selectedObject );
    let selectedDynaPartiType;
    if( subPanelContext.sharedData && subPanelContext.sharedData.value ) {
        selectedDynaPartiType = subPanelContext.sharedData.value.selectedParticipantType.props.fnd0ParticipantType.dbValues[0].split( '::' )[1];
    } else if( localUserPanelData.sharedData && localUserPanelData.sharedData.value ) {
        selectedDynaPartiType = localUserPanelData.sharedData.value.selectedParticipantType.props.fnd0ParticipantType.dbValues[0].split( '::' )[1];
    }
    let input = [];

    _.forEach( localUserPanelData.selectedUsers, ( selectedUser ) => {
        if( selectedUser.selected ) {
            var participantInputData = {
                wso: {
                    type: selectedObj.type,
                    uid: selectedObj.uid
                },
                additionalData: {},
                participantInputData: [ {
                    clientId: '',
                    assignee: {
                        type: selectedUser.type,
                        uid: selectedUser.uid
                    },
                    participantType: selectedDynaPartiType
                } ]
            };

            input.push( participantInputData );
        }
    } );
    return input;
};

export let navigateToReplaceParticipantPanel = ( selectedPartiByType, selectedItemRevision, commandContext ) => {
    var context = {
        selectedObject: selectedItemRevision,
        loadProjectData: true,
        participantType: selectedPartiByType.props.fnd0ParticipantType.dbValues[0].split( '::' )[1],
        selParticipantObject: cdmService.getObject( selectedPartiByType.props.fnd0Participant.dbValues[0] ),
        resourceProvider: 'Awp0ResourceProvider'
    };

    var additionalSearchCriteria = {
        participantType : context.participantType
    };
    commandContext.selectionData.selected[0].props.awp0Target =  commandContext.selectionData.selected[0].props.fnd0Participant;
    context.additionalSearchCriteria = additionalSearchCriteria;

    const { dialogAction } = commandContext;

    if( dialogAction ) {
        let options = {
            view: 'Awp0ReplaceParticipant',
            parent: '.aw-layout-workareaMain',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            push: false,
            isCloseVisible: false,
            subPanelContext: { ...context, selectedCmdCtx: commandContext }
        };
        dialogAction.show( options );
    }
};

export let getRemoveDynaParticipantsObj = ( commandContext ) => {
    let selection = {};
    if( commandContext && commandContext.selectionModel && commandContext.selectionModel.selectionData ) {
        selection = commandContext.selectionModel.selectionData.selected;
    } else if( commandContext && commandContext.selectionData ) {
        selection = commandContext.selectionData.selected;
    }else if( commandContext && commandContext.selected ) {
        selection = commandContext.selected;
    }else if( commandContext && commandContext.selectedObjects ) {
        selection = commandContext.selectedObjects;
    } else {
        return;
    }
    let removeParticipantObj = [];
    let participantUid = [];
    let participantType = [];
    for ( let i = 0; i < selection.length; i++ ) {
        let inputData;
        if( selection[i].props.fnd0Participant && selection[i].props.fnd0ParticipantType ) {
            participantUid.push( selection[i].props.fnd0Participant.dbValue );
            participantType.push( selection[i].props.fnd0ParticipantType.displayValues[0] );
        } else{
            participantUid.push( selection[i].uid );
            participantType.push( selection[i].type );
        }
        inputData = {
            uid : participantUid[i],
            type : participantType[i]
        };
        removeParticipantObj.push( inputData );
    }
    return removeParticipantObj;
};

export let getItemRev = ( param )=>{
    let itemRev;
    let selectedObject = null;
    if( param?.vmo?.uid ) {
        selectedObject = cdmService.getObject( param.vmo.uid );
    }
    if( param?.selectionData?.pselected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 || param?.selectionData?.pselected?.modelType?.typeHierarchyArray?.indexOf( 'ItemRevision' ) > -1 ) {
        itemRev = param?.selectionData?.pselected;
    } else if( param?.openedObject ) {
        itemRev = param.openedObject;
    } else if( param?.selected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 ) {
        itemRev = param?.selected;
    }else if ( selectedObject?.type === 'Cm0SimpleChangeRevision' ) {
        itemRev = selectedObject;
    }else{
        itemRev = param?.baseSelection;
    }
    return itemRev;
};
export let modifySelectionModeForSelParticipantType = ( addUserPanelState, sharedData ) => {
    const particupantArr = sharedData.value.selectedParticipantType.props.fnd0ParticipantType.dbValue.split( '::' );
    if ( particupantArr.length > 2 ) {
        addUserPanelState.participant = particupantArr[1]; // Extract the value between the first and second '::'
    }
    addUserPanelState.participantType = sharedData.value.selectedParticipantType.props.fnd0ParticipantType.displayValues[0];
    addUserPanelState.sharedData = sharedData;
    const newAddUserPanelState = _.clone( addUserPanelState );
    newAddUserPanelState.selectionModelMode = sharedData.value.participantTypeSelectionMode;
    return newAddUserPanelState;
};

export let initAddDynaParticipantsParentPanel = ( sharedData, addTitle ) => {
    const newSharedData = _.clone( sharedData );
    let selParticipantByTypeObj = appCtxSvc.getCtx( 'mselected' )[0];
    if( selParticipantByTypeObj && selParticipantByTypeObj.props && selParticipantByTypeObj.props.fnd0IsRequired && selParticipantByTypeObj.props.fnd0IsRequired.dbValue ) {
        newSharedData.selectedParticipantType = selParticipantByTypeObj;
        newSharedData.activeView = 'Awp0AddDynamicParticipantsSub';
        newSharedData.participantTypeHeader = addTitle + ' ' + selParticipantByTypeObj.props.fnd0ParticipantType.uiValues[0];
        newSharedData.showBackButton = false;
        if( selParticipantByTypeObj.props.fnd0IsMultiValued.dbValue ) {
            newSharedData.participantTypeSelectionMode = 'multiple';
        } else {
            newSharedData.participantTypeSelectionMode = 'single';
        }
    }
    return newSharedData;
};

export let refreshParticipantsTableSelectionData = ( dataProvider ) => {
    if( dataProvider?.anchor === 'awp0DynaPartTable_contextMenuAnchor' ) {
        dataProvider.dataProvider.selectionModel.setSelection( [] );
        return;
    }
    dataProvider?.selectionModel?.setSelection( [] );
};

export let copyAssigneeFromParticipantByTypeObj = ( selectionData, mselected ) => {
    let participantObj = [];
    let participantObjUid = [];

    if ( selectionData?.selected ) {
        _.forEach( selectionData.selected, ( selected ) => {
            let objUid = selected.props['REF(fnd0Participant,Participant).fnd0AssigneeUser'].dbValues[0];
            participantObjUid.push( objUid );
        } );
    } else {
        _.forEach( mselected, ( selected ) => {
            let objUid = selected.props['REF(fnd0Participant,Participant).fnd0AssigneeUser'].dbValues[0];
            participantObjUid.push( objUid );
        } );
    }
    _.forEach( participantObjUid, ( uid ) => {
        participantObj.push( cdmService.getObject( uid ) );
    } );
    clipboardService.instance.setContents( participantObj );
};

export let participantTypeProviderSelectionChange = ( participantTypeSelModel ) => {
    let participantByTypeObjs = participantTypeSelModel.selectionData.selected;
    let requiredParticipantByTypeSelected = false;
    _.forEach( participantByTypeObjs, ( partiByTypeObj ) => {
        if( partiByTypeObj.props.fnd0IsRequired.dbValues[0] === '1' ) {
            requiredParticipantByTypeSelected = true;
        }
    } );
    appCtxSvc.updateCtx( 'awp0DynaParticipantsTable.requiredParticipantByTypeSelected', requiredParticipantByTypeSelected );
};

export let getParticipantObjFromParticipantByTypeObj = ( participantByTypeObjs, ctxMenuPartByTypeObj ) => {
    let participantObjList = [];
    if( !_.isEmpty( ctxMenuPartByTypeObj ) && ctxMenuPartByTypeObj.length > 0 && ctxMenuPartByTypeObj[0]?.modelType?.typeHierarchyArray.indexOf( 'Fnd0ParticipantByType' ) > -1 ) {
        participantByTypeObjs = ctxMenuPartByTypeObj;
    }
    if( participantByTypeObjs?.length > 0 ) {
        _.forEach( participantByTypeObjs, ( partiByTypeObj ) => {
            let participantObj = cdmService.getObject( partiByTypeObj.props.fnd0Participant.dbValues[0] );
            participantObjList.push( participantObj );
        } );
    } else {
        let participantObj = cdmService.getObject( participantByTypeObjs?.props?.fnd0Participant?.dbValues[0] );
        participantObjList.push( participantObj );
    }
    return participantObjList;
};
export let addDynaParticipantsWithEditHandler = async( commandContext ) => {
    await exports.isEditInProgress();
    const { dialogAction } = commandContext;
    if( dialogAction ) {
        let options = {
            view : 'Awp0AddDynamicParticipants',
            placement: 'right',
            parent : '.aw-layout-workarea',
            width  : 'MEDIUM',
            height : 'FULL',
            subPanelContext : '{{commandContext}}',
            isCloseVisible : false,
            push : false,
            isPinUnpinEnabled : true
        };
        dialogAction.show( options );
    }
};

export let  getAssignableParticipantTypes = async( adaptedObjUid ) => {
    await dataManagementService.getProperties( [ adaptedObjUid ], [ 'assignable_participant_types' ] );
    return cdmService.getObject( adaptedObjUid )?.props?.assignable_participant_types?.dbValues;
};

export default exports = {
    replaceParticipants,
    setDisplayType,
    addParticipants,
    openAddParticipantPanel,
    canRemoveOrReplaceParticipant,
    getRemoveParticipantPageRefreshNeeded,
    getRemoveParticipantObjects,
    isEditInProgress,
    modifyAddableParticipantTypes,
    backToSelectParticipantType,
    handleParticipantTypeSelection,
    addDynamicParticipants,
    navigateToReplaceParticipantPanel,
    getRemoveDynaParticipantsObj,
    getItemRev,
    modifySelectionModeForSelParticipantType,
    initAddDynaParticipantsParentPanel,
    refreshParticipantsTableSelectionData,
    copyAssigneeFromParticipantByTypeObj,
    participantTypeProviderSelectionChange,
    getParticipantObjFromParticipantByTypeObj,
    addDynaParticipantsWithEditHandler,
    getAssignableParticipantTypes
};

