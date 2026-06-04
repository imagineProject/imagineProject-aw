// Copyright (c) 2022 Siemens

/**
 * @module js/Cm1CreateParticipantsService
 */

import AwPromiseService from 'js/awPromiseService';
import viewModelService from 'js/viewModelObjectService';
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import clientDataModel from 'soa/kernel/clientDataModel';
import dataManagementService from 'soa/dataManagementService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import awWfUtils from 'js/Awp0WorkflowUtils';
import _ from 'lodash';

let exports = {};
const PREFIX_NAME_SUFFIX = '_displayable_participant_types';

/**
 * Get inputs for getTypeConstantValues SOA
 *
 * @param {Array} typeList - Participant types
 * @returns {Array} getTypeConstantValues SOA inputs
 */
export let getInputForParticipantsConstant = function( typeList ) {
    let typeConstantValues = [];
    typeList.forEach( participantType => {
        const typeName = participantType.object.props.type_name.dbValues[0];

        // Get ParticipantUsedOnObjectTypes BO contant values.
        typeConstantValues.push( {
            typeName: typeName,
            constantName: 'ParticipantUsedOnObjectTypes'
        } );

        // Get ParticipantAllowMultipleAssignee BO contant value.
        typeConstantValues.push( {
            typeName: typeName,
            constantName: 'ParticipantAllowMultipleAssignee'
        } );
    } );

    return typeConstantValues;
};

/**
 * Process response from getTypeConstantValues SOA and returns Map which stores Participant type related information.
 *
 * @param {Array} typeList - Participant types
 * @returns {Map} Participant type related information
 */
export let processResponseForParticipantsConstant = function( response, typeList ) {
    let participantsDetailMap = new Map();

    if ( response && response.constantValues && response.constantValues.length > 0 ) {
        // Create participantsDetailMap with key as Participant internal Name and value as other information related
        // to participant as shown below.
        // {
        //     "key": "Analyst",
        //     "value": {
        //         "displayName": "Analyst",
        //         "allowableTypes": ["ChangeItemRevision"],
        //         "selectionModelMode": "single"
        //     }
        // }
        response.constantValues.forEach( constValue => {
            const responseConstantName = constValue.key.constantName;
            const responseTypeName = constValue.key.typeName;

            const participantDisplayName = typeList.filter( element => {
                return element.object.props.type_name.dbValues[0] === responseTypeName;
            } )[0].object.props.type_name.uiValues[0];

            if ( responseConstantName === 'ParticipantUsedOnObjectTypes' ) {
                if ( participantsDetailMap.get( responseTypeName ) ) {
                    participantsDetailMap.set( responseTypeName, {
                        ...participantsDetailMap.get( responseTypeName ),
                        allowableTypes: constValue.value.split( ',' )
                    } );
                } else {
                    participantsDetailMap.set( responseTypeName, {
                        displayName: participantDisplayName,
                        allowableTypes: constValue.value.split( ',' )
                    } );
                }
            } else if( responseConstantName === 'ParticipantAllowMultipleAssignee' ) {
                if ( participantsDetailMap.get( responseTypeName ) ) {
                    participantsDetailMap.set( responseTypeName, {
                        ...participantsDetailMap.get( responseTypeName ),
                        selectionModelMode: constValue.value === 'true' ? 'multiple' : 'single'
                    } );
                } else {
                    participantsDetailMap.set( responseTypeName, {
                        displayName: participantDisplayName,
                        selectionModelMode: constValue.value === 'true' ? 'multiple' : 'single'
                    } );
                }
            }
        } );
    }
    return participantsDetailMap;
};

/**
 * Get all parent types of selected Change object type
 *
 * @param {Object} selectedChangeObject - Selected change object type
 * @returns {Array} Unique list of all parent types in hierarchy.
 */
const _getAllParentTypes = function( selectedChangeTypes ) {
    // Get all Unique Parent types from selected Change type.
    let parentTypes = new Set();

    // To get all Parent types we need to parse parent_types property of selected Change object type
    // parent_types property dbValue is Array and holds value in format shown below:
    // parent_types.dbValue = [
    // "TYPE::GnChangeNotice::GnChangeNotice::ChangeItem",
    // "TYPE::ChangeItem::ChangeItem::Item",
    // "TYPE::Item::Item::WorkspaceObject",
    // "TYPE::WorkspaceObject::WorkspaceObject::POM_application_object",
    // "TYPE::POM_application_object::POM_application_object::POM_object",
    // "TYPE::POM_object::POM_object::BusinessObject",
    // "TYPE::BusinessObject::BusinessObject::"
    // ]
    selectedChangeTypes.props.parent_types.dbValues.forEach( typeElement => {
        typeElement.split( '::' ).forEach( ( element, index ) => index !== 0  ? parentTypes.add( element ) : '' );
    } );

    // Returns all unique Parent types as Array for e.g. [
    //     "GnChangeNotice",
    //     "ChangeItem",
    //     "Item",
    //     "WorkspaceObject",
    //     "POM_application_object",
    //     "POM_object",
    //     "BusinessObject",
    //     ""
    // ]
    return Array.from( parentTypes );
};


/**
 * Sort Participant types based on internal name and selection mode.
 *
 * @param {Object} element - Current element in Array to sort.
 * @param {Object} nextElement - Next element in Array to sort.
 * @returns {Number} -1/0/1 to sort elements in Array
 */
const _sortParticipantTypes = function( element, nextElement ) {
    // Requestor section to be shown in Top of Participants Tab
    if( element.internalName === 'Requestor' ) {
        return -1;
    }

    if( nextElement.internalName === 'Requestor' ) {
        return 1;
    }

    // Participant type with Single assignment should be shown first compared to Multiple assignment in Participant sections.
    if( element.selectionModelMode === 'single' ) {
        return -1;
    }

    if( nextElement.selectionModelMode === 'single' ) {
        return 1;
    }

    return 0;
};

/**
 * Get allowable Participant types for selected change type in Create Change Panel.
 *
 * @param {Object} selectedChangeTypes - Selected Change type to create.
 * @param {Object} changeParticpantTypes - All Participant types available.
 * @param {Object} participantInfo - Object to update with allowable Participant types.
 * @returns {Object} Object with allowable Participant types information.
 */
export let getAllowableParticipantTypes = function( selectedChangeTypes, changeParticpantTypes, participantInfo ) {
    let participantSectionObjects = [];

    // Check if change type is selected or not for which we need to show allowable Participant types.
    if( selectedChangeTypes && selectedChangeTypes.length > 0 ) {
        const objectType = selectedChangeTypes[0].props.type_name.dbValue + 'Revision';
        const objectPrefName = objectType +  PREFIX_NAME_SUFFIX;

        // Get all parent types in hierarchy for selected change type.
        const allTypes = _getAllParentTypes( selectedChangeTypes[0] );

        // Adding current type to the list
        allTypes.unshift(selectedChangeTypes[0].props.type_name.dbValue);

        // Iterate through all Participant types and update array with only those Participant types
        // whose allowable types matches with parent types of selected change type.
        changeParticpantTypes.forEach( ( value, key ) => {
            for( let inx = 0; inx < allTypes.length; ++inx ) {

                // Participants are supported for ItemRevision and EPMJob only.
                if( allTypes[inx] === 'WorkspaceObject' ) {
                    break;
                }

                let isParticipantAdded = false;
                for( let jnx = 0; jnx < value.allowableTypes.length; ++jnx ) {
                    const changeType = value.allowableTypes[jnx].split( 'Revision' )[0];
                    if( allTypes[inx] === changeType ) {
                        participantSectionObjects.push( {
                            internalName: key,
                            modelObjects: [],
                            updateUids: '',
                            editable: true,
                            ...value
                        } );
                        isParticipantAdded = true;
                        break;
                    }
                }

                // Participant type is already added.
                if( isParticipantAdded ) {
                    break;
                }
            }
        } );

        // Sort allowable Participant types based on internal name and selection mode.
        // Requestor section to be show at top of Participant tab followed by single assignee Participant type and at last multiple assignee Participant type.
        if( appCtxService.ctx.preferences && !appCtxService.ctx.preferences[objectPrefName] ) {
            participantSectionObjects.sort( _sortParticipantTypes );
        }
    }

    // Populate participantInfo object with participantSectionObjects
    participantInfo.participantSectionObjects = participantSectionObjects;

    return {
        participantInfo: participantInfo
    };
};

/**
 * Get Display information for Participant section shown in Participant Tab.
 *
 * @param {Object} participantTypeInfo - Participant type information
 * @returns {Object} Object which have information to show Participant section collapsed or not and section height.
 */
export let loadDisplayInfo = function( participantTypeInfo ) {
    if ( participantTypeInfo ) {
        return {
            sectionCollapsed: participantTypeInfo.modelObjects.length === 0,
            sectionHeight: participantTypeInfo.selectionModelMode === 'multiple' ? '18f' : ''
        };
    }
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  * @return {boolean} True/False
  */
const _isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Remove the user id from the error string if present
 *
 * @param {*} messageString - message
 * @returns {String} returnedMessage
 */
const _removeUserIdFromMessage = function( messageString ) {
    let returnedMessage = messageString;
    const endIndex = messageString.lastIndexOf( '(' );
    if( endIndex > 0 ) {
        returnedMessage = messageString.substring( 0, endIndex );
    }
    returnedMessage = '"' + returnedMessage + '"';
    return returnedMessage;
};

/**
 * Format the error message for display
 *
 * @param {Array} objectsAlreadyAdded - objects added as targets
 * @param {Array} selectedObjects - Selected objects that need to be added
 * @returns {String} finalMessage
 */
const _getDuplicateErrorMessage = function( objectsAlreadyAdded, selectedObjects ) {
    let message = '';
    let finalMessage = '';
    const localeTextBundle = localeService.getLoadedText( 'CreateChangeMessages' );
    if( objectsAlreadyAdded.length === 1 ) {
        message = objectsAlreadyAdded[ 0 ].props.object_string.dbValues[ 0 ];
        message = _removeUserIdFromMessage( message );
        const localDuplicateErorMsg = messagingService.applyMessageParams( localeTextBundle.duplicateReviewerMsg, [ '{{message}}' ], {
            message: message
        } );
        finalMessage = localDuplicateErorMsg;
    }
    if( objectsAlreadyAdded.length > 1 ) {
        for( let dup = 0; dup < objectsAlreadyAdded.length; ++dup ) {
            message = objectsAlreadyAdded[ dup ].props.object_string.dbValues[ 0 ];
            message = _removeUserIdFromMessage( message );
            const localMsg = messagingService.applyMessageParams( localeTextBundle.wasNotAdded, [ '{{message}}' ], {
                message: message
            } );
            finalMessage += localMsg + '</br>';
        }
        const cannotBeAddedCount = objectsAlreadyAdded.length;
        const totalSelectedObj = selectedObjects.length;
        const msg = messagingService.applyMessageParams( localeTextBundle.multipleDuplicateMsg, [ '{{cannotBeAddedCount}}', '{{totalSelectedObj}}' ], {
            cannotBeAddedCount: cannotBeAddedCount,
            totalSelectedObj: totalSelectedObj
        } );
        finalMessage = msg + '</br>' + finalMessage;
    }
    return finalMessage;
};

/**
  * Validate if users is trying to add group member then that group member should not already
  * present in same or differnet data provider.
  *
  * @param {Array} existingObjects Existing objects that are already present.
  * @param {Array} selectedObjects Objects that need to be added and need validation
  * @param {boolean} isGroupMemberCheck True/False

  * @returns {Array} validObjects array that need to be added
  */
const _validObjectsToAdd = function( existingObjects, selectedObjects, isGroupMemberCheck ) {
    let groupMemberObjects = [];
    if( isGroupMemberCheck ) {
        _.forEach( existingObjects, function( modelObject ) {
            if( _isOfType( modelObject, 'GroupMember' ) ) {
                groupMemberObjects.push( modelObject );
            }
        } );
    } else {
        groupMemberObjects = existingObjects;
    }

    let validObjects = [];
    let objectsAlreadyAdded = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        let isObjAlreadyAddedIndex = null;
        isObjAlreadyAddedIndex = _.findKey( groupMemberObjects, {
            uid: selectedObject.uid
        } );

        // In case of DP we don't allow adding duplicate resource pools as resource pools
        // are being added uniqueUid to solve multiple same resource pool should show correctly on panel.
        // So we are comparing the uniqueUid as well that will only be present on ResourcePool case.
        if( typeof isObjAlreadyAddedIndex === typeof undefined ) {
            isObjAlreadyAddedIndex = _.findKey( groupMemberObjects, {
                uniqueUid : selectedObject.uniqueUid
            } );
        }
        if( typeof isObjAlreadyAddedIndex === typeof undefined ) {
            selectedObject.selected = false;
            validObjects.push( selectedObject );
        } else {
            objectsAlreadyAdded.push( selectedObject );
        }
    } );

    if( objectsAlreadyAdded.length > 0 ) {
        // Set the selected objects on data object and it will be used for duplicate validation
        const message = _getDuplicateErrorMessage( objectsAlreadyAdded, selectedObjects );
        messagingService.showError( message );
    }
    return validObjects;
};

/**
  * Get the object uids array based on input model object array.
  *
  * @param {Array} modelObjects Model objects array
  * @returns {Array} Object Uids array based on input array
  */
const _getObjectsUidList = function( modelObjects ) {
    let objectUids = [];
    if( modelObjects && !_.isEmpty( modelObjects ) ) {
        _.forEach( modelObjects, function( modelObject ) {
            if( modelObject && modelObject.uid ) {
                objectUids.push( modelObject.uid );
            }
        } );
    }
    return objectUids;
};

/**
  * Add the selected objects to respective participant section and update the context object.
  *
  * @param {String} propName Property name for object need to be added
  * @param {Array} selectedObjects Selected objects that need to be added.
  * @param {Object} participantInfo Context object that will hold all info.
  */
export let addParticipantObjects = function( propName, selectedObjects, participantInfo ) {
    let localContext = { ...participantInfo.value };

    // Find out the participant section object where objects need to be added.
    let participantSectionObject = _.find( localContext.participantSectionObjects, function( participantSection ) {
        return participantSection.internalName === propName;
    } );
    if( participantSectionObject ) {
        // Mainly cloning the existing objects so that if user is adding new object to it
        // then it will update the context object correct and then onUpdate hook can be called
        // correctly and it will render the objects.
        let presentObjects = [];
        if ( participantSectionObject.modelObjects ) {
            presentObjects = _.clone( participantSectionObject.modelObjects );
        }

        let validObjects = [];
        if( participantSectionObject.selectionModelMode === 'single' || participantSectionObject.selectionMode === 'single' ) {
            // For single participant type, if there are multi selection then also we will use
            // 0th index selection only.
            if( selectedObjects && selectedObjects[ 0 ] ) {
                validObjects = [ selectedObjects[ 0 ] ];
                // Empty the present object array as we need to show only one user
                presentObjects = [];
            }
        } else {
            // Get valid object list based on objects already presents on respective data provider
            // and if valid objects are not null then only add to respective data provider.
            validObjects = _validObjectsToAdd( presentObjects, selectedObjects, false );
        }

        // Check if valid objects that need to be added are not null then add to existing
        // list and then update the context to have correct info.
        if( validObjects && !_.isEmpty( validObjects ) ) {
            Array.prototype.push.apply( presentObjects, validObjects );
            participantSectionObject.modelObjects = presentObjects;
            participantSectionObject.updateUids = _getObjectsUidList( presentObjects ).join( ',' );

            participantInfo.update && participantInfo.update( localContext );
        }
    }
};

/**
 * Add Current logged in groupmember to provided Participant type in Participant tab.
 *
 * @param {Array} participantInfo - Array which holds Participants information using Participant tab is populated.
 * @param {String} participantTypeName - Internal name of Participant type to which current groupmember needs to be added.
 * @returns {Promise} Resolved value updates modelObjects property of participantInfo Array element.
 */
export let addCurrentUserAsParticipant = function( participantInfo, participantTypeName ) {
    let deferred = awPromiseService.instance.defer();
    let localContext = { ...participantInfo.value };
    if ( participantInfo.participantSectionObjects && participantInfo.participantSectionObjects.length > 0 ) {
        const participantTypeInfo = _.find( localContext.participantSectionObjects, function( participantSection ) {
            return participantSection.internalName === participantTypeName;
        } );

        if( participantTypeInfo ) {
            // Logged in groupmember.
            const currentGroupMemberUID = appCtxService.ctx.userSession.props.fnd0groupmember.dbValue;

            dataManagementService.loadObjects( [ currentGroupMemberUID ] ).then( function() {
                const groupMemberObject = clientDataModel.getObject( currentGroupMemberUID );
                participantTypeInfo.modelObjects = [ groupMemberObject ];
                participantTypeInfo.updateUids = _getObjectsUidList( [ groupMemberObject ] ).join( ',' );
                participantTypeInfo.editable = false;
                participantInfo.update && participantInfo.update( localContext );
                deferred.resolve();
            } );
        }

    }

    return deferred.promise;
};

/**
 * Add Current logged in groupmember as Analyst if 'Set as Active Change' checkbox is selected.
 * And Remove Current logged in groupmember as Analyst if 'Set as Active Change' checkbox is unselected.
 *
 * @param {Array} participantInfo - Array which holds Participants information using Participant tab is populated.
 * @param {Boolean} isActiveChangeSet - Is Active Change Checkbox selected or not.
 * @returns {Promise} Resolved value updates modelObjects property of participantInfo Array element.
 */
export let setCurrentUserAsAnalyst = function( participantInfo, isActiveChangeSet ) {
    let deferred = awPromiseService.instance.defer();
    let localContext = { ...participantInfo.value };
    if( participantInfo.participantSectionObjects && participantInfo.participantSectionObjects.length > 0 ) {
        const participantTypeInfo = _.find( localContext.participantSectionObjects, function( participantSection ) {
            return participantSection.internalName === 'Analyst';
        } );

        // Logged in groupmember.
        const currentGroupMemberUID = appCtxService.ctx.userSession.props.fnd0groupmember.dbValue;

        if ( participantTypeInfo ) {
            if( isActiveChangeSet ) {
                dataManagementService.loadObjects( [ currentGroupMemberUID ] ).then( function() {
                    const groupMemberObject = clientDataModel.getObject( currentGroupMemberUID );
                    participantTypeInfo.modelObjects = [ groupMemberObject ];
                    participantTypeInfo.updateUids = _getObjectsUidList( [ groupMemberObject ] ).join( ',' );
                    participantTypeInfo.editable = false;
                    participantInfo.update && participantInfo.update( localContext );
                    deferred.resolve();
                } );
            } else {
                participantTypeInfo.modelObjects = [];
                participantTypeInfo.updateUids = '';
                participantTypeInfo.editable = true;
                participantInfo.update && participantInfo.update( localContext );
                deferred.resolve();
            }
        }
    }
    return deferred.promise;
};

/**
 * Get the valid selected obejct from input selected objects. If input selection
 * has user obejct then it will get group memebr from user otherwise directly return input.
 *
 * @param {Array} selection - The selection object array
 * @return {Object} - userInput object that holds the correct values .
 */
export let getValidObjectsToAdd = async function( selection, addUserPanelState ) {
    var deferred = AwPromiseService.instance.defer();
    let currentSelections = [];
    if( addUserPanelState ) {
        for( let index = 0; index < selection?.length; ++index ) {
            awWfUtils.getValidObjectsToAdd( addUserPanelState.criteria, [ selection[index] ] ).then( ( validObjs ) => {
                let selObject = validObjs[0];
                if( selObject ) {
                    let vmObject = viewModelService.createViewModelObject( selObject.uid );
                    if( vmObject ) {
                        // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                        // resource pools added to one aw-list component then because of uid check in component, there
                        // is one issue to render it correctly. So to handle it we update the uid with some random number
                        // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                        if( _isOfType( vmObject, 'ResourcePool' ) ) {
                            vmObject.uniqueUid = vmObject.uid;
                            vmObject.uid += Math.random();
                        }
                        if( selObject.projectObject ) {
                            vmObject.projectObject = selObject.projectObject;
                        }
                        currentSelections.push( vmObject );
                        if( currentSelections.length >= selection.length ) {
                            return deferred.resolve( currentSelections );
                        }
                    }
                }

            });
        }
    }
    else {
        currentSelections = selection;
        if( selection && selection.length > 0  ) {
            currentSelections = [];
            _.forEach( selection, function( selObject ) {
                let vmObject = viewModelService.createViewModelObject( selObject.uid );
                if( vmObject ) {
                    // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                    // resource pools added to one aw-list component then because of uid check in component, there
                    // is one issue to render it correctly. So to handle it we update the uid with some random number
                    // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                    if( _isOfType( vmObject, 'ResourcePool' ) ) {
                        vmObject.uniqueUid = vmObject.uid;
                        vmObject.uid += Math.random();
                    }
                    if( selObject.projectObject ) {
                        vmObject.projectObject = selObject.projectObject;
                    }
                    currentSelections.push( vmObject );
                }
            } );
        }
        deferred.resolve( currentSelections );
    }
    return deferred.promise;
};


/**
  * Check if input objects is not null then add it to respective data provider directly.
  * If input mergeData value is true then it will add input model objects to existing
  * data present in data provider.
  *
  * @param {Object} dataProvider data provider where object need to be added
  * @param {Array} modelObjects Objects that need to be added
  *
  * @returns {Array} Model objects array
  */
export let updateDataProvider = function( dataProvider, modelObjects ) {
    // Update the contents in data provider
    dataProvider.update( modelObjects, modelObjects.length );
    return {
        sectionCollapsed: false
    };
};

/**
  * Populate the info and open Add signoff panel or in case of when panel need to be in
  * tool and info area update the input context so hat user picker panel will show correct
  * users.
  *
  * @param {Object} commandContext - Command context object that will store selected profile object and object where user is trying to add.
  * @param {Object} subPanelContext Object that need to be updated for info that need to be pass to user picker panel.
  * @param {Object} criteria Default criteria object
  */
export let populateUserPanelCriteria = function( commandContext, subPanelContext, criteria ) {
    if( subPanelContext && commandContext ) {
        let localContext = { ...subPanelContext.value };
        localContext.criteria = { ...criteria };
        let selectionModelMode = commandContext.selectionModelMode;
        let propName = commandContext.propName;
        localContext.participantType = null;
        localContext.criteria.providerContentType = 'User,GroupMember,ResourcePool';

        // This is mainly needed when we want to open user picker panel to pass
        // participant type only in case of DP addition.
        if( commandContext.internalName ) {
            propName = commandContext.internalName;
            localContext.participantType = propName;
            localContext.criteria.participantType = propName;
        }
        // If selection mode is not defined then by default use multiple.
        if( !selectionModelMode ) {
            selectionModelMode = 'multiple';
        }

        localContext.selectionModelMode = selectionModelMode;
        localContext.propName = propName;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
  * Remove the selected objects to respective participant section and update the context object.
  *
  * @param {String} propName Property name for object need to be added
  * @param {Array} selectedObjects Selected objects that need to be added.
  * @param {Object} participantInfo Context object that will hold all info.
  */
export let removeParticipantObjects = function( propName, selectedObjects, participantInfo ) {
    let localContext = { ...participantInfo.value };

    // Find out the participant section object where objects need to be added.
    let participantSectionObject = _.find( localContext.participantSectionObjects, function( participantSection ) {
        return participantSection.internalName === propName;
    } );
    if( participantSectionObject ) {
        const presentObjects = participantSectionObject.modelObjects;
        const validObjects = _.differenceBy( presentObjects, selectedObjects, 'uid' );
        participantSectionObject.modelObjects = validObjects;
        participantSectionObject.selectedObjects = [];
        participantSectionObject.updateUids = _getObjectsUidList( validObjects ).join( ',' );

        participantInfo.update && participantInfo.update( localContext );
    }
};

/**
 * This function creates input structure for getTypeConstantValues SOA.
 * @param {Object} selectedTypeObject - Selected Change object type
 * @returns {Object} getTypeConstantValues SOA input structure
 */
export let getEnableParticipantTypeConstInput = function( selectedTypeObject ) {
    return [ {
        typeName: selectedTypeObject.props.type_name.dbValue + 'Revision',
        constantName: 'Cm1EnableParticipantForCreate'
    }
    ];
};

/**
 * This function process response from getTypeConstantValues SOA.
 * @param {Object} response - Response from getTypeConstantValues SOA.
 * @param {Object} showParticipantsTab - showParticipantsTab data
 * @returns {Object} - Update showParticipantsTab object dbValue
 */
export let outputForEnableParticipantTypeConst = function( response, showParticipantsTabData ) {
    let newShowParticipantsTab = _.clone( showParticipantsTabData );
    if ( response && response.constantValues && response.constantValues.length > 0 ) {
        for ( let i = 0; i < response.constantValues.length; i++ ) {
            const responseConstantName = response.constantValues[i].key.constantName;
            const responseConstantValue = response.constantValues[i].value;

            if ( responseConstantName === 'Cm1EnableParticipantForCreate' ) {
                newShowParticipantsTab.dbValue = responseConstantValue === 'true';
            }
        }
    }
    return newShowParticipantsTab;
};

/**
 * This function filter Participant types to be shown in Participants Tab of Create Change panel
 * based on preference value for selected change object type to create for e.g. ChangeNoticeRevision_displayable_participant_types
 * @param {Object} selectedTypeObject - Selected change object type to create
 * @param {Map} changeParticpantTypes - All Participant types
 * @returns {Map} - filtered list of Participant types based on preference value.
 */
export let getFilteredParticipantTypes = function( selectedTypeObject, changeParticpantTypes ) {
    // Create Preference name based on selected change object type.
    const objectType = selectedTypeObject.props.type_name.dbValue + 'Revision';
    const objectPrefName = objectType +  PREFIX_NAME_SUFFIX;

    // Filtered list based on preference values.
    let filteredParticipantTypes = changeParticpantTypes;

    if( appCtxService.ctx.preferences && appCtxService.ctx.preferences[objectPrefName] && appCtxService.ctx.preferences[objectPrefName].length !== 0 ) {
        filteredParticipantTypes = new Map();

        appCtxService.ctx.preferences[objectPrefName].forEach( participantType => {
            if( changeParticpantTypes.has( participantType ) ) {
                filteredParticipantTypes.set( participantType, changeParticpantTypes.get( participantType ) );
            }
        } );
    }
    return {
        filteredParticipantTypes: filteredParticipantTypes
    };
};
/**
 * Perform the paste behavior for the Participant from changejs/paste.json onto the given 'target'
 * IModelObject creating the given relationship type between them.
 *
 * @param {Object} targetObject - The 'target' Participant for the paste.
 *
 */
export let participantDefaultPasteHandler = function( targetObject ) {
    if( targetObject ) {
        var deferred = awPromiseService.instance.defer();
        var resource = 'ChangeMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        var errMsg = localTextBundle.ParticipantPasteNotSupported;
        messagingService.showError( errMsg );
        deferred.reject( errMsg );
        return deferred.promise;
    }
};
export default exports = {
    getInputForParticipantsConstant,
    processResponseForParticipantsConstant,
    getAllowableParticipantTypes,
    addCurrentUserAsParticipant,
    setCurrentUserAsAnalyst,
    loadDisplayInfo,
    getValidObjectsToAdd,
    addParticipantObjects,
    updateDataProvider,
    populateUserPanelCriteria,
    removeParticipantObjects,
    getEnableParticipantTypeConstInput,
    outputForEnableParticipantTypeConst,
    getFilteredParticipantTypes,
    participantDefaultPasteHandler
};
