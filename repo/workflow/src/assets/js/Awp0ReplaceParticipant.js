// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ReplaceParticipant
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import messagingSvc from 'js/messagingService';
import _addParticipant from 'js/AddParticipant';
import appCtxSvc from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
import dms from 'soa/dataManagementService';
import navigationSvc from 'js/navigationService';
import Awp0WorkflowUtils from './Awp0WorkflowUtils';
import AwPromiseService from 'js/awPromiseService';

/**
 * Define public API
 */
var exports = {};

/**
 * Get the from participant based on input participant object
 *
 * @param {Object} participantObject - The model object for property needs to be populated
 *
 * @return {Object} From participant object that will be replaced
 */
var getFromAssigneeFromParticipant = function( participantObject ) {
    var assignee = null;
    var fromAssignee = null;
    if( participantObject && participantObject.props.assignee && participantObject.props.assignee.dbValues.length > 0 ) {
        assignee = clientDataModel.getObject( participantObject.props.assignee.dbValues[ 0 ] );
        fromAssignee = assignee;
    }
    return fromAssignee;
};

/**
 * Get the from participant based on input item revision object
 *
 * @param {Object} itemRevObject - The model object for property needs to be populated
 * @param {Object} participantType the participant type
 * @return {Object} From participant object that will be replaced
 */
var getFromAssigneeFromItemRevision = function( itemRevObject, participantType ) {
    var fromAssignee = null;
    var participants = null;

    // Get all the participants from input item revision object
    if( itemRevObject.props?.participants?.dbValues?.length > 0 ) {
        participants = itemRevObject.props.participants.dbValues;
    }

    // Check if participant objects are not null then iterate for each participant type
    // to find out the correct participant that need to be removed
    if( participants ) {
        // Iterate for each object object
        _.forEach( participants, function( participant ) {
            var participantObj = clientDataModel.getObject( participant );

            if( participantObj && participantObj.type === participantType ) {
                fromAssignee = getFromAssigneeFromParticipant( participantObj );
            }
        } );
    }

    return fromAssignee;
};

/**
 * Get the object whose properties needs to be loaded in the system.
 *
 * @param {Object} userPanelData COntext object
 * @return {Object} Assignee that need to be reassigned
 */
export let getObjectsToLoad = function( userPanelData ) {
    var objectsToLoad = [];
    // Check if valid userPanelData is null then no need to proceed further and
    // return the empty object list from here
    if( !userPanelData ) {
        return objectsToLoad;
    }

    // If participant object is selected then add that participant to list.
    if( userPanelData.selParticipantObject ) {
        objectsToLoad.push( userPanelData.selParticipantObject );
    }

    // In case of EPMTask or signoff selection add as well
    if( userPanelData.selectedObject && userPanelData.selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
        userPanelData.selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        objectsToLoad.push( userPanelData.selectedObject );
    }
    return objectsToLoad;
};

/**
 * Get the from assignee that need to be replaced
 *
 * @param {Object} itemRevObject the selected item revision object
 * @param {Object} participantObject the participant object that need to be replaced
 * @param {Object} participantType the participant type
 * @return {Object} Assignee that need to be reassigned
 */
export let getFromAssignee = function( itemRevObject, participantObject, participantType ) {
    var fromAssignee = null;

    if( participantObject ) {
        var participantObj = clientDataModel.getObject( participantObject.uid );
        fromAssignee = getFromAssigneeFromParticipant( participantObj );
    } else if( itemRevObject ) {
        fromAssignee = getFromAssigneeFromItemRevision( itemRevObject, participantType );
    }

    return fromAssignee;
};

/**
 * This function retrieves the Workstream Object (WSO) list based on the provided selected object.
 * It checks various conditions and retrieves the appropriate model object based on the selected object's properties.
 *
 * @param {Object} selectedObject - The selected object containing properties to determine the WSO list.
 * @return {Object} - An object containing the `uid` and `type` of the retrieved model object. Returns an empty object if no model object is found.
 */
export let getWsoList = function( selectedObject ) {
    var modelObject = null;
    if( selectedObject.props.fnd0StoreParticipantsOnJob && selectedObject.props.fnd0StoreParticipantsOnJob.dbValues[ 0 ] === '0' && selectedObject.props.root_target_attachments ) {
        modelObject = clientDataModel.getObject( selectedObject.props.root_target_attachments.dbValues[ 0 ] );
    } else {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
            var performSignoffmodelObject = clientDataModel.getObject( selectedObject.props.fnd0ParentTask.dbValues[ 0 ] );
            modelObject = clientDataModel.getObject( performSignoffmodelObject.props.parent_process.dbValues[ 0 ] );
        } else {
            modelObject = clientDataModel.getObject( selectedObject.props.parent_process.dbValues[ 0 ] );
        }
    }
    if( !modelObject ) {
        return {};
    }
    return {
        uid: modelObject.uid,
        type: modelObject.type
    };
};

/**
 * This function retrieves a list of participants to be removed based on the provided selected objects.
 *
 * @param {Array} selectedObjects - An array of selected objects, where each object contains `uid` and `type` properties.
 * @return {Array} selectedPartcipants - An array of objects representing participants, each containing `uid` and `type`.
 */
export let getTaskParticipantsToremove = function( selectedObjects ) {
    var selectedPartcipants = [];
    // Check if selectedObjects is not null and not empty then we need to iterate
    // for each object and add it to respective list.
    if( selectedObjects && !_.isEmpty( selectedObjects ) ) {
        for( var index = 0; index < selectedObjects.length; ++index ) {
            var selected = {
                uid: selectedObjects[ index ].uid,
                type: selectedObjects[ index ].type
            };
            selectedPartcipants.push( selected );
        }
    }
    return selectedPartcipants;
};

var getRemoveParticipant = function( selectedParticipants ) {
    return adapterSvc.getAdaptedObjectsSync( selectedParticipants );
};

/**
 *
 * This method is to get the result from the fulfilled promise
 *
 * @param {Promise} input - promise
 * @returns result of the promise
 */
var _getInputFromPromise = function( input ) {
    let deferred = AwPromiseService.instance.defer();
    input.then( function( result ) {
        input = result;
        return deferred.resolve( input );
    } );
    return deferred.promise;
};

export let clearImpactedTasksFromCtx = function( ctx, addUserPanelState ) {
    ctx.impactedTasks = [];
    ctx.originalImpactedTasksList = [];
    if ( addUserPanelState && addUserPanelState !== '[object Object]' ) {
        addUserPanelState.valueOfArrayToReturn = [];
    }
};

/**
 * Fix for the defect - LCS-942655. Replace participants success events were not triggered causing a refresh issue
 * Used a similar approach to addParticipants for the issue to resolve
 *
 * @param {Object} reassignParticipantInfo - Participant info which needs to be sent as input to SOA
 * @param {Object} addUserPanelState - userPanelState from the panel
 *
 */
export let replaceParticipantsInternal = function( input, addUserPanelState, subPanelContext, selParticipantObject, ctx ) {
    clearImpactedTasksFromCtx( ctx, addUserPanelState );
    return replaceParticipantsInternalNew( input, addUserPanelState, subPanelContext, selParticipantObject, ctx );
};

/**
 * This function is used to store the received input's selected data by retrieving corresponding objects.
 *
 * @param {Array} input - An array of objects where each object may contain a `fromAssignee` property with a `uid`.
 * @return {Array} receivedInput - An array of objects retrieved using the `uid` values from the input.
 */
export let storeReceivedInput = ( input )=>{
    let receivedInput = [];
    for( let index = 0; index < input.length; index++ ) {
        if( input[index]?.fromAssignee?.uid ) {
            receivedInput.push( clientDataModel.getObject( input[index].fromAssignee.uid ) );
        }
    }
    return receivedInput;
};
export let replaceParticipantsInternalNew = async function( input, addUserPanelState, subPanelContext, selParticipantObject, ctx ) {
    if( input instanceof Promise ) {
        input = await _getInputFromPromise( input );
    }
    var inputData = {
        updateParticipantInfo : null,
        updateTasksAndNotifyInBackground : true,
        sendNotification : addUserPanelState?.notifyAssignees
    };
    let receivedInput = storeReceivedInput( input );
    if ( addUserPanelState?.notifyAssignees === undefined || addUserPanelState?.notifyAssignees === null ) {
        inputData.sendNotification = ctx?.preferences?.WRKFLW_dynamic_participant_sync_notification?.[0] === '1';
    }

    let ItemObj = undefined;
    if ( ctx?.state?.params?.selectedObjectUid ) {
        if( input[0].operationType === 'AddParticipant' && ctx?.preferences?.AWC_enable_single_participants_table[0] === 'true' ) {
            ItemObj = clientDataModel.getObject( ctx?.state?.params?.addUserPanelState?.criteria?.selectedObject );
        } else {
            ItemObj = clientDataModel.getObject( ctx?.state?.params?.selectedObjectUid );
        }
    } else {
        ItemObj = clientDataModel.getObject( addUserPanelState?.selectedObject ? addUserPanelState?.selectedObject?.uid : addUserPanelState?.selected?.uid );
    }

    let selParticipantIndex = 1;
    if( input[0].operationType === 'RemoveParticipant' ) {
        if( addUserPanelState?.selectionData?.selected ) {
            selParticipantIndex = addUserPanelState?.selectionData?.selected?.length;
        }else if( addUserPanelState?.selectedObjects ) {
            selParticipantIndex = addUserPanelState?.selectedObjects?.length;
        }else if( input ) {
            selParticipantIndex = input.length;
        }
    } else {
        input[0].updateTaskAssignments = [];
    }

    if ( input && ItemObj && input[ 0 ].operationType !== 'AddParticipant' ) {
        var fromAssignee = [];
        if( addUserPanelState?.participantType ) {
            let oldAssignee = undefined;
            if ( ctx?.state?.params?.oldAssigneeUid ) {
                oldAssignee = clientDataModel.getObject( ctx?.state?.params?.oldAssigneeUid );
            } else {
                if ( addUserPanelState?.selectionData?.value?.selected?.[0].props?.awp0Target?.dbValue ) {
                    oldAssignee = clientDataModel.getObject( addUserPanelState.selectionData.value.selected[0].props.awp0Target.dbValue );
                } else {
                    //Added for Resource Pool.
                    oldAssignee = clientDataModel.getObject( addUserPanelState?.selectionData?.value?.selected?.[0].props?.fnd0Participant?.dbValue );
                }
            }
            fromAssignee = getFromAssignee( ItemObj, oldAssignee, addUserPanelState.participantType );
            if ( fromAssignee &&  ( ctx?.preferences?.WRKFLW_dynamic_participant_task_assignee_sync?.[0] !== '1' && input[ 0 ].operationType === 'ReplaceParticipant' ) ) {
                input[0].fromAssignee = fromAssignee;
            }

            if( fromAssignee && input[0].fromAssignee?.type !== 'GroupMember' ) {
                fromAssignee.selected = true;
                let fromAssigneeObj = await Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelState.criteria, [ fromAssignee ] );
                input[0].fromAssignee = fromAssigneeObj[0];
            }

            if ( input[0].toAssignee?.type !== 'GroupMember' ) {
                let toAssigneeObj = await Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelState.criteria, [ input[0].toAssignee ] );
                input[0].toAssignee = toAssigneeObj[0];
            }
        } else{
            input =  await fetchAndAssignAssignee( input );
        }
    }
    let updateTask = [];
    //This is used if column filters are applied on Preview UI
    if ( ctx?.originalImpactedTasksList?.length > 0 ) {
        updateTask = ctx.originalImpactedTasksList;
    } else {
        updateTask = ctx?.impactedTasks?.length > 0 ? ctx.impactedTasks : addUserPanelState?.valueOfArrayToReturn;
    }
    if ( updateTask && updateTask.length > 0 ) {
        if( input[ 0 ].operationType === 'RemoveParticipant' ) {
            _.forEach( updateTask, function( task ) {
                for( let selIndex = 0; selIndex < selParticipantIndex;  selIndex++ ) {
                    let currSelection = addUserPanelState?.selectionData?.selected?.[selIndex] ? addUserPanelState?.selectionData?.selected?.[selIndex]
                        : receivedInput[selIndex];
                    //Check if Participant type matches or not
                    if ( currSelection?.props?.fnd0ParticipantType?.displayValues?.[0] === task?.props?.fnd0AssigneeOrigin?.uiValues?.[0]
                        || currSelection?.modelType?.displayName === task?.props?.fnd0AssigneeOrigin?.uiValues?.[0] ) {
                        if( input[selIndex].fromAssignee.type === 'ResourcePool' ) {
                            if( task?.modelType?.typeHierarchyArray.indexOf( 'Signoff' ) > -1  &&
                            input[selIndex].fromAssignee.uid === task?.props?.resource_pool?.dbValues[0] ||
                            input[selIndex].fromAssignee.uid === task?.props?.responsible_party?.dbValues[0] ) {
                                input[selIndex].updateTaskAssignments.push( task );
                            }
                        }else if( currSelection?.props?.fnd0AssigneeUser?.dbValue === task?.props?.fnd0Assignee?.dbValues[0]
                        || currSelection?.props['REF(fnd0Participant,Participant).fnd0AssigneeUser']?.dbValues[0] === task?.props?.fnd0Assignee?.dbValues[0]
                        || currSelection?.props?.fnd0AssigneeUser?.dbValues[0] === task?.props?.fnd0Assignee?.dbValues[0]
                        || input[selIndex].fromAssignee.uid === task?.props?.fnd0Assignee?.dbValues[0] ) {
                            input[selIndex].updateTaskAssignments.push( task );
                        }
                    }
                }
            } );
        } else {
            _.forEach( updateTask, function( task ) {
                for( let j = 0; j < input.length;  j++ ) {
                    input[j].updateTaskAssignments.push( task );
                }
            } );
        }
    }

    // SOA call made to add the participant
    inputData.updateParticipantInfo = input;
    soaSvc.postUnchecked( 'Participant-2024-12-Participant', 'updateParticipants', inputData ).then( function( response ) {
        let isAssignmentsTab = false;
        let isPanelPinned = false;
        if( subPanelContext && subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId &&
        subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_Assignments' ) {
            isAssignmentsTab = true;
            // Check if panel is pinned then we need to refresh the location based on pinned value
            // else after operation is done then we need to close the panel
            if( subPanelContext && subPanelContext.panelPinned ) {
                isPanelPinned = true;
            }
        }
        // Refresh the modified object if selected object is not null.
        if( response?.ServiceData?.modelObjects && addUserPanelState && ItemObj && !isAssignmentsTab ) {
            eventBus.publish( 'cdm.relatedModified', {
                relatedModified: [ ItemObj ],
                createdObjects : response.ServiceData.modelObjects
            } );
            if( addUserPanelState?.isParticipantTable ) {
                eventBus.publish( 'workflow.resetParticipantTable' );
            }
            eventBus.publish( 'dynamicParticipants.plTable.reload' );
        } else if ( subPanelContext && subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId &&
        subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_Assignments' ) {
            eventBus.publish( 'cdm.relatedModified', {
                relatedModified: [ addUserPanelState.selectedObject ],
                createdObjects : response.ServiceData.modelObjects,
                refreshLocationFlag: isAssignmentsTab,
                isPinnedFlag: isPanelPinned
            } );
        }
        clearImpactedTasksFromCtx( ctx );
    } );
    clearImpactedTasksFromCtx( ctx );
};

/**
 * This asynchronous function fetches and assigns assignee information for a given input array of participant details.
 *
 * @param {Array} input - An array of objects where each object represents participant details, including `fromAssignee`.
 * @return {Array} revisedInput - The updated input array with assigned assignee details.
 */
export let fetchAndAssignAssignee = async function( input ) {
    let revisedInput = input;
    let fromAssignee = [];
    let participantObjUID = [];
    for( let selIndex = 0; selIndex < input.length;  selIndex++ ) {
        if( input[selIndex].fromAssignee.props.fnd0Participant ) {
            participantObjUID.push( input[selIndex].fromAssignee.props.fnd0Participant.dbValue );
        } else{
            participantObjUID.push( input[selIndex].fromAssignee.uid );
        }
    }
    await dms.getProperties( participantObjUID, [ 'assignee', 'fnd0AssigneeUser' ] );
    let inputIndex;
    for( let selIndex = 0; selIndex < input.length;  selIndex++ ) {
        const participantObject = clientDataModel.getObject( participantObjUID[selIndex] );
        if ( participantObject && participantObject.props && participantObject.props.assignee ) {
            const assignee = clientDataModel.getObject( participantObject.props.assignee.dbValues[0] );
            fromAssignee[selIndex] = {
                type: assignee.type,
                uid: assignee.uid
            };
            for ( inputIndex = 0; inputIndex < input.length; inputIndex++ ) {
                if( participantObjUID[selIndex] === input[inputIndex].fromAssignee.uid ) {
                    break;
                }
                if ( participantObjUID[selIndex] === input[inputIndex].fromAssignee.props?.fnd0Participant?.dbValues[0] ) {
                    break;
                }
            }
            revisedInput[inputIndex].fromAssignee = fromAssignee[selIndex];
        }
    }
    // Assign after retrieving the assignee
    return revisedInput;
};

/**
 * This function retrieves the Item Revision to be replaced based on the provided parameters and context.
 *
 * @param {Object} param - An object containing various participant-related data, including selection and opened objects.
 * @param {Object} ctx - The context object providing additional state and parameter details.
 * @return {Object} itemRev - The Item Revision object to be replaced.
 */
export let getReplaceItemRev = ( param, ctx, data )=>{
    let itemRev = undefined;
    let pselected = param?.selectionData?.pselected ? param?.selectionData?.pselected : param?.pselected;
    pselected = pselected ? pselected : param?.vmo;
    if( pselected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1
    || pselected?.modelType?.typeHierarchyArray?.indexOf( 'ItemRevision' ) > -1 ) {
        itemRev = pselected;
    } else if( param?.selected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 || param?.selected?.modelType?.typeHierarchyArray?.indexOf( 'ItemRevision' ) > -1 ) {
        itemRev = param?.selected;
    }else if( param?.openedObject ) {
        itemRev = param?.openedObject;
    } else if( param?.baseSelection ) {
        itemRev = param?.baseSelection;
    }else if( pselected?.modelType?.typeHierarchyArray?.indexOf( 'EPMTask' ) > -1
    ||  pselected?.modelType?.typeHierarchyArray?.indexOf( 'Signoff' ) > -1 ) {
        itemRev = data?.selectedObject[0];
    } else{
        itemRev = clientDataModel.getObject( ctx.state.params.selectedObjectUid );
    }
    return itemRev;
};

/**
 * This function retrieves the type of participant to be replaced based on the selected object.
 *
 * @param {Object} selected - The selected object containing participant details.
 * @return {string} participantType - The type of the participant to be replaced.
 */
export let getReplaceParticipantType = ( selected ) => {
    let participantType;
    if( selected.props.fnd0Participant ) {
        const participantObject = clientDataModel.getObject( selected.props.fnd0Participant.dbValue );
        participantType = participantObject.type;
    } else{
        participantType = selected.type;
    }
    return participantType;
};

/**
 * This function retrieves the participant repository WSO (Workstream Object) based on the given parameter.
 *
 * @param {Object} param - An object containing the selected participant or related data.
 * @return {Object} participantRepositoryWSO - The Workstream Object (WSO) representing the participant repository.
 */
export let getParticipantRepositoryWSO = ( param ) => {
    let participantRepositoryWSO;
    if( param.selected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 ) {
        participantRepositoryWSO = param.selected;
    } else{
        participantRepositoryWSO = param.selectedObject ? param.selectedObject : param.selected;
    }
    return participantRepositoryWSO;
};

/**
 * This function determines the participant type to be added based on the provided parameter and context.
 *
 * @param {Object} param - An object containing participant details, including `participantType`.
 * @return {string} particiapntType - The participant type to be added.
 */
export let getAddParticipantType = ( param ) => {
    let particiapntType;
    let ctx = appCtxSvc.getCtx();
    if( ctx.preferences?.AWC_enable_single_participants_table && ctx.preferences?.AWC_enable_single_participants_table[0] === 'true' ) {
        particiapntType = param.participantType;
    } else{
        particiapntType = ctx.state.params.addUserPanelState.participantType;
    }
    return particiapntType;
};

/**
 * This function will construct input for Multiple Remove Participant
 *
 * @param {Object} ctx context
 * @return {Object} inputArray for replace
 */
export let getMultipleRemoveParticipantInput = ( addUserPanelState, selectionData, ctx, useProps, data ) => {
    var inputArray = [];
    if( addUserPanelState === '[object Object]' ) {
        let participantRepositoryWSO = clientDataModel.getObject( ctx?.state?.params?.selectedObjectUid );
        const oldAssigneeUIDData = parseQueryString( appCtxSvc.getCtx().state.params.oldAssigneeUIDString );

        for( let index = 0; index < oldAssigneeUIDData.length; ++index ) {
            let input = {};
            input.participantRepositoryWSO =  participantRepositoryWSO;
            input.participantType = oldAssigneeUIDData[index].type;
            input.fromAssignee = clientDataModel.getObject( oldAssigneeUIDData[index].uid );
            input.operationType = 'RemoveParticipant';
            input.updateTaskAssignments = [];
            inputArray.push( input );
        }
    }else{
        for( let index = 0; index < selectionData.length; ++index ) {
            let input = {};
            input.participantRepositoryWSO =  getReplaceItemRev( addUserPanelState, ctx, data );
            let participantObj = addUserPanelState.selectionData?.selected?.[index] ?
                addUserPanelState.selectionData.selected[index] : addUserPanelState.selected.selected[index];
            input.participantType = getReplaceParticipantType( participantObj );
            if ( useProps ) {
                let partDp = clientDataModel.getObject( participantObj.props.fnd0Participant?.dbValue );
                if ( partDp ) {
                    input.fromAssignee = clientDataModel.getObject( partDp.props.assignee?.dbValues[0] );
                } else {
                    let partObj = clientDataModel.getObject( participantObj.uid );
                    input.fromAssignee = clientDataModel.getObject( partObj.props.assignee?.dbValues[0] );
                }
            } else {
                input.fromAssignee = selectionData[index];
            }
            input.operationType = 'RemoveParticipant';
            input.updateTaskAssignments = [];
            inputArray.push( input );
        }
    }
    return inputArray;
};
/**
 * This Function to parse query string
 *
 * @param {string} queryString queryString
 * @return {Object} return uid and type
 */
// Function to parse query string
const parseQueryString = function( queryString ) {
    const params = new URLSearchParams( queryString );
    const data = [];
    let currentUid = null;
    for ( let [ key, value ] of params.entries() ) {
        if ( key === 'uid' ) {
            currentUid = value;
        } else if ( key === 'type' && currentUid !== null ) {
            data.push( { uid: currentUid, type: value } );
            currentUid = null;
        }
    }
    return data;
};
/**
 * This function will construct input for replace participant
 *
 * @param {Object} ctx context
 * @return {Object} inputArray for replace
 */
export let getReplaceParticipantInput = ( ctx ) => {
    let inputArray = [];
    let participantRepositoryWSO = clientDataModel.getObject( ctx?.state?.params?.selectedObjectUid );
    const toAssigneeUIDData = parseQueryString( ctx?.state?.params?.toAssigneeUID );
    const oldAssigneeUIDData = parseQueryString( appCtxSvc.getCtx().state.params.oldAssigneeUIDString );

    let input = {};
    input.participantRepositoryWSO =  participantRepositoryWSO;
    input.participantType = oldAssigneeUIDData[0].type;
    input.toAssignee = clientDataModel.getObject( toAssigneeUIDData[0].uid );
    input.fromAssignee = clientDataModel.getObject( oldAssigneeUIDData[0].uid );
    input.operationType = 'ReplaceParticipant';
    input.updateTaskAssignments = [];
    inputArray.push( input );
    return inputArray;
};

/**
 * This function will construct input for Multiple Add Participant
 *
 * @param {Object} ctx context
 * @return {Object} inputArray for replace
 */
export let getMultipleAddParticipantInput = async( addUserPanelState, selectionData, ctx ) => {
    let inputArray = [];
    let participantRepositoryWSO = null;
    if( addUserPanelState === '[object Object]' ) {
        participantRepositoryWSO = clientDataModel.getObject( ctx?.state?.params?.selectedObjectUid );
        const toAssigneeUIDData = parseQueryString( ctx?.state?.params?.toAssigneeUID );

        for( let index = 0; index < toAssigneeUIDData.length; ++index ) {
            let newAssign2 = clientDataModel.getObject( toAssigneeUIDData[index].uid );
            if( newAssign2 && newAssign2.type !== 'GroupMember' ) {
                let addUserPanelStateData = null;

                const savedData = localStorage.getItem( 'savedAddUserPanelStateCriteria' );
                if ( savedData ) {
                    addUserPanelStateData = JSON.parse( savedData );
                }

                newAssign2.selected = true;
                // eslint-disable-next-line no-await-in-loop
                let newAssigneeObj = await Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelStateData, [ newAssign2 ] );
                toAssigneeUIDData[index].uid = newAssigneeObj[0].uid;
                /* eslint-enable no-await-in-loop */
            }
            let input = {};
            input.participantRepositoryWSO =  participantRepositoryWSO;
            input.participantType = toAssigneeUIDData[index].type;
            input.toAssignee = clientDataModel.getObject( toAssigneeUIDData[index].uid );
            input.operationType = 'AddParticipant';
            input.updateTaskAssignments = [];
            inputArray.push( input );
        }
        return inputArray;
    }
    let deferred = AwPromiseService.instance.defer();
    if( addUserPanelState?.selectedObject ) {
        participantRepositoryWSO = addUserPanelState.selectedObject;
    }else if( ctx?.preferences?.AWC_enable_single_participants_table?.[0] === 'true' && addUserPanelState?.selected ) {
        participantRepositoryWSO = clientDataModel.getObject( addUserPanelState?.criteria?.selectedObject );
    }else {
        participantRepositoryWSO = addUserPanelState?.selected;
    }
    for( let index = 0; index < selectionData?.length; ++index ) {
        let input = {};
        input.participantRepositoryWSO =  participantRepositoryWSO;
        if ( input.participantRepositoryWSO?.modelType?.typeHierarchyArray?.indexOf( 'ItemRevision' ) < 0 ) {
            input.participantRepositoryWSO = ctx?.xrtSummaryContextObject;
        }
        input.participantType = addUserPanelState?.participant ? addUserPanelState?.participant : addUserPanelState?.participantType;
        Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelState?.criteria, [ selectionData[index] ] ).then( function( validObjects ) {
            input.toAssignee = validObjects[0];
            input.operationType = 'AddParticipant';
            input.updateTaskAssignments = [];
            inputArray.push( input );
            if( inputArray.length >= selectionData.length ) {
                return deferred.resolve( inputArray );
            }
        } );
    }
    return deferred.promise;
};

/**
 * This function determines the type of participant to be removed based on the selected object.
 *
 * @param {Object} selected - The selected object containing participant details.
 * @return {string} participantType - The type of participant to be removed.
 */
export let getRemoveParticipantType = ( selected ) => {
    let participantType;
    if( selected.props.fnd0Participant ) {
        const participantObject = clientDataModel.getObject( selected.props.fnd0Participant.dbValue );
        participantType = participantObject.type;
    } else{
        participantType = selected.type;
    }
    return participantType;
};

/**
 * This function navigates to impacted workflow tasks and prepares the required parameters.
 *
 * @param {Object} addUserPanelState - The state of the add user panel containing selected participant details.
 * @param {Object} subPanelContext - The context of the sub-panel.
 * @param {Object} toAssignee - The assignee details (e.g., uid and type) to whom the tasks are assigned.
 * @param {string} selectedObjectUid - The UID of the selected object.
 * @param {string} participantType - The type of participant involved in the tasks.
 * @param {string} headerTitle - The title to be displayed in the header.
 * @return {void}
 */
export let showImpactedTasks = function( addUserPanelState, subPanelContext, toAssignee, selectedObjectUid, participantType, headerTitle ) {
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'impactedWorkflowTasks';
    let selectedOldAssignee = null;
    let selOldAssigneeObj = null;
    if ( addUserPanelState?.selParticipantObject ) {
        selectedOldAssignee = addUserPanelState?.selParticipantObject.uid;
        selOldAssigneeObj = addUserPanelState?.selParticipantObject;
    } else{
        selectedOldAssignee = addUserPanelState?.selectionData?.value?.selected?.[0]?.props?.awp0Target?.dbValue;
        selOldAssigneeObj = addUserPanelState?.selectionData?.value?.selected?.[0];
    }
    const oldAssigneeUIDString = [];
    let type = null;
    if( selOldAssigneeObj ) {
        type = getRemoveParticipantType( selOldAssigneeObj );
    }
    oldAssigneeUIDString.push( { uid: selectedOldAssignee, type: type } );
    const oldAssigneeQString = createQueryString( oldAssigneeUIDString );
    const toAssigneeUID = [];
    toAssigneeUID.push( { uid: toAssignee.uid, type: toAssignee.type } );
    const toAssigneeString = createQueryString( toAssigneeUID );
    let paramsToWrite = {
        addUserPanelState : addUserPanelState,
        subPanelContext : subPanelContext,
        toAssignee : toAssignee,
        selectedObjectUid : selectedObjectUid,
        oldAssigneeUid : selectedOldAssignee,
        participantType : participantType,
        headerTitle : headerTitle,
        toAssigneeUID : toAssigneeString,
        oldAssigneeUIDString : oldAssigneeQString
    };
    navigationSvc.navigate( action, paramsToWrite );
};

/**
 * This function constructs a query string from an array of data objects containing `uid` and `type` properties.
 *
 * @param {Array} data - An array of objects where each object contains `uid` (string) and `type` (string) properties.
 * @return {string} queryString - A URL-encoded query string built from the input data.
 */
export let createQueryString = function( data ) {
    let queryString = '';
    for ( let i = 0; i < data.length; i++ ) {
        queryString += `uid=${encodeURIComponent( data[i].uid )}&type=${encodeURIComponent( data[i].type )}`;
        if ( i < data.length - 1 ) {
            queryString += '&';
        }
    }
    return queryString;
};

export default exports = {
    getObjectsToLoad,
    getFromAssignee,
    getWsoList,
    getAddParticipantType,
    getParticipantRepositoryWSO,
    getTaskParticipantsToremove,
    replaceParticipantsInternal,
    replaceParticipantsInternalNew,
    getReplaceParticipantType,
    getReplaceItemRev,
    getMultipleRemoveParticipantInput,
    getMultipleAddParticipantInput,
    showImpactedTasks,
    clearImpactedTasksFromCtx,
    getReplaceParticipantInput
};
