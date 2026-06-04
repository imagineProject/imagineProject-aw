// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ImpactedWorkflowTasks
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';
import soaSvc from 'soa/kernel/soaService';
import tcDataManagementService from 'js/tcDataManagementService';
import awColumnSvc from 'js/awColumnService';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import particiapntSvc from 'js/Awp0ParticipantService';
import messagingSvc from 'js/messagingService';
import _addParticipant from 'js/AddParticipant';
import replaceParticipant from 'js/Awp0ReplaceParticipant';
import addParticipants from 'js/AddParticipant';
import viewModelObjectSvc from 'js/viewModelObjectService';
import navigationSvc from 'js/navigationService';
import AwPromiseService from 'js/awPromiseService';
import adapterService from 'js/adapterService';
import Awp0WorkflowUtils from './Awp0WorkflowUtils';

/**
 * Define public API
 */
var exports = {};

var _createProp = function( propName, propValue, uiValue, type, propDisplayName, dbValues ) {
    return {
        type: type,
        hasLov: false,
        isArray: false,
        displayValue: propValue,
        uiValue: uiValue,
        dbValues: [ dbValues ],
        value: propValue,
        propertyName: propName,
        propertyDisplayName: propDisplayName,
        isEnabled: true
    };
};
const initializeParticipantTable = async function( ) {
    let defer = AwPromiseService.instance.defer();
    let ctxTemp = appCtxSvc.getCtx();
    let selObjUID = ctxTemp?.state?.params?.selectedObjectUid;
    let uidsForLoadObject = [];
    uidsForLoadObject.push( selObjUID );
    const data = parseQueryString( ctxTemp?.state?.params?.toAssigneeUID );
    const oldAssigneeData = parseQueryString( ctxTemp?.state?.params?.oldAssigneeUIDString );
    for ( let i = 0; i < data?.length; i++ ) {
        uidsForLoadObject.push( data[i].uid );
    }
    for ( let l = 0; l < oldAssigneeData?.length; l++ ) {
        uidsForLoadObject.push( oldAssigneeData[l].uid );
    }
    await dms.loadObjects( uidsForLoadObject ).then( async function() {
        await viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( selObjUID ), null );
        await dms.getProperties( uidsForLoadObject, [ 'assignee', 'fnd0Participant', 'fnd0AssigneeUser', 'user_id', 'default_group' ] );
        let noOfParticipant;
        let noOfOldAssignee;
        for ( noOfParticipant = 0; noOfParticipant < data?.length; noOfParticipant++ ) {
            viewModelObjectSvc.constructViewModelObjectFromModelObject(
                clientDataModel.getObject( data[noOfParticipant].uid ), null );
        }
        for (  noOfOldAssignee = 0; noOfOldAssignee < oldAssigneeData?.length; noOfOldAssignee++ ) {
            viewModelObjectSvc.constructViewModelObjectFromModelObject(
                clientDataModel.getObject( oldAssigneeData[noOfOldAssignee].uid ), null );
        }

        return defer.resolve();
    } );
    return defer.promise;
};

const loadTableData = function() {
    const savedData = localStorage.getItem( 'tableData' );
    if ( savedData ) {
        return JSON.parse( savedData );
    }
    return [];
};

/**
 * Saves the given table data to local storage.
 *
 * @param {Object} data - The table data to be saved in local storage.
 *
 * @return {Boolean} Returns true if the data is successfully saved,
 *                   otherwise returns false if an error occurs.
 */
const saveTableData = function( data ) {
    try {
        cleanup();
        localStorage.setItem( 'tableData', JSON.stringify( data ) );
    } catch ( e ) {
        console.error( 'Error occurred while saving data:', e );
        return false;
    }
    return true;
};

/**
 * Saves the impacted task table data to local storage.
 *
 * @param {Object} data - The impacted task table data to be saved in local storage.
 *
 * @return {Boolean} Returns true if the data is successfully saved,
 *                   otherwise returns false if an error occurs.
 */
const saveImpactedTaskTableData = function( data ) {
    try {
        localStorage.removeItem( 'savedAddUserPanelState' );
        localStorage.setItem( 'savedAddUserPanelState', JSON.stringify( data ) );
    } catch ( e ) {
        console.error( 'Error occurred while saving data:', e );
        return false;
    }
    return true;
};

const savedAddUserPanelStateCriteria = function( data ) {
    try {
        localStorage.removeItem( 'savedAddUserPanelStateCriteria' );
        localStorage.setItem( 'savedAddUserPanelStateCriteria', JSON.stringify( data ) );
    } catch ( e ) {
        console.error( 'Error occurred while saving data:', e );
        return false;
    }
    return true;
};

/**
 * Loads row objects based on participant assignments.
 *
 * @param {String} participantType - The type of participant involved in the assignment.
 * @param {Object} object - The selected object related to the assignment.
 * @param {Array|Object} newAssign - New assignments provided for the participant.
 * @param {Array|Object} oldAssign - Previous assignments related to the participant.
 * @param {Object} ctx - The context object containing state and parameters.
 * @param {String} dispValOldAssignee - Display value for the old assignee.
 *
 * @return {Promise} Returns a promise that resolves with the table row objects.
 */
const loadRowObject = async function( addUserPanelState, participantType, object, newAssign, oldAssign, ctx, dispValOldAssignee ) {
    await initializeParticipantTable();
    let newAssign2 = [];
    let oldAssign2 = [];
    if( participantType === undefined || participantType === null ) {
        participantType = ctx.state.params.participantType;
    }
    let ctxTemp = appCtxSvc.getCtx();
    let selObjUID = ctxTemp?.state?.params?.selectedObjectUid;

    let selObject = clientDataModel.getObject( selObjUID );
    let uIValueForobject = selObject?.props?.object_string?.dbValues;

    if( !Array.isArray( newAssign ) ) {
        newAssign = newAssign ? [ newAssign ] : [];
    }
    var vmRows = [];
    const data = parseQueryString( ctxTemp?.state?.params?.oldAssigneeUIDString );
    const toAssigneeUIDData = parseQueryString( ctxTemp?.state?.params?.toAssigneeUID );

    for ( let l = 0; l < toAssigneeUIDData.length; l++ ) {
        newAssign2[l] = clientDataModel.getObject( toAssigneeUIDData[l].uid );
    }

    // Loop through the data array to extract UIDs
    for ( let i = 0; i < data.length; i++ ) {
        oldAssign2[i] = clientDataModel.getObject( data[i].uid );
    }
    var vmObject = {};
    var props = {};
    if( oldAssign2?.length > 0 && newAssign2?.length > 0 ) {
        for( let j = 0; j < oldAssign2.length; j++ ) {
            vmObject = {};
            props = {};
            participantType = oldAssign2[j]?.modelType?.displayName;
            props.participantType = _createProp( 'participantType', participantType, participantType, 'STRING', 'Participant Type', 'NULL' );
            props.object = _createProp( 'object', selObject, uIValueForobject, 'OBJECT', 'object', selObjUID );
            if ( oldAssign2[j]?.props !== undefined ) {
                props.previousAssignment = _createProp( 'previousAssignment', oldAssign2[j], getDisplayOldAssignee( oldAssign2[j] ), 'OBJECT', 'Previous Assignment', oldAssign2[j].uid );
            }
            if ( newAssign2[j]?.props !== undefined ) {
                if( newAssign2[j]?.type !== 'GroupMember' ) {
                    let addUserPanelStateData = null;
                    if( addUserPanelState === '[object Object]' ) {
                        const savedData = localStorage.getItem( 'savedAddUserPanelStateCriteria' );
                        if ( savedData ) {
                            addUserPanelStateData = JSON.parse( savedData );
                        }
                    }else{
                        savedAddUserPanelStateCriteria( addUserPanelState.criteria );
                        addUserPanelStateData = addUserPanelState.criteria;
                    }
                    // eslint-disable-next-line no-await-in-loop
                    let newAssigneeObj = await Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelStateData, [ newAssign2[j] ] );
                    newAssign2[j] = newAssigneeObj[0];
                    /* eslint-enable no-await-in-loop */
                }
                props.newAssignment = _createProp( 'newAssignment', newAssign2[j], getDisplayNewAssignee( newAssign2[j] ), 'OBJECT', 'New Assignment', newAssign2[j].uid );
            }
            vmObject.props = props;
            vmRows.push( vmObject );
        }
    }else if( oldAssign2?.length > 0 ) {
        for( let j = 0; j < oldAssign2.length; j++ ) {
            vmObject = {};
            props = {};
            participantType = oldAssign2[j]?.modelType?.displayName;
            props.participantType = _createProp( 'participantType', participantType, participantType, 'STRING', 'Participant Type', 'NULL' );
            props.object = _createProp( 'object', selObject, uIValueForobject, 'OBJECT', 'object', selObjUID );
            if ( oldAssign2[j]?.props !== undefined ) {
                props.previousAssignment = _createProp( 'previousAssignment', oldAssign2[j], getDisplayOldAssignee( oldAssign2[j] ), 'OBJECT', 'Previous Assignment', oldAssign2[j].uid );
            }
            vmObject.props = props;
            vmRows.push( vmObject );
        }
    }else if( newAssign2?.length > 0 ) {
        for( let j = 0; j < newAssign2.length; j++ ) {
            vmObject = {};
            props = {};
            props.participantType = _createProp( 'participantType', participantType, participantType, 'STRING', 'Participant Type', 'NULL' );
            props.object = _createProp( 'object', selObject, uIValueForobject, 'OBJECT', 'object', selObjUID );
            if ( newAssign2[j]?.props !== undefined ) {
                if( newAssign2[j]?.type !== 'GroupMember' ) {
                    let addUserPanelStateData = null;
                    if( addUserPanelState === '[object Object]' ) {
                        const savedData = localStorage.getItem( 'savedAddUserPanelStateCriteria' );
                        if ( savedData ) {
                            addUserPanelStateData = JSON.parse( savedData );
                        }
                    }else{
                        savedAddUserPanelStateCriteria( addUserPanelState.criteria );
                        addUserPanelStateData = addUserPanelState.criteria;
                    }
                    newAssign2[j].selected = true;
                    // eslint-disable-next-line no-await-in-loop
                    let newAssigneeObj = await Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelStateData, [ newAssign2[j] ] );
                    newAssign2[j] = newAssigneeObj[0];
                    /* eslint-enable no-await-in-loop */
                }
                props.newAssignment = _createProp( 'newAssignment', newAssign2[j], getDisplayNewAssignee( newAssign2[j] ), 'OBJECT', 'New Assignment', newAssign2[j].uid );
            }
            vmObject.props = props;
            vmRows.push( vmObject );
        }
    }
    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );
    loadResult.rowObject = vmRows;
    loadResult.rowObjecttotalFound = vmRows.length;
    return loadResult;
};

/**
 * Parses a query string and extracts UID-type pairs into an array.
 *
 * @param {String} queryString - The query string to be parsed.
 *
 * @return {Array} Returns an array of objects, each containing `uid` and `type` properties.
 */
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
 * Retrieves the display value for the old assignee.
 *
 * @param {Object} oldAssign - The object containing old assignee information.
 *
 * @return {String} Returns the display name of the old assignee.
 */
const getDisplayOldAssignee = function( oldAssign ) {
    let oldAssignee = null;
    if( oldAssign?.props?.fnd0AssigneeUser?.uiValues[0] ) {
        oldAssignee = oldAssign?.props?.fnd0AssigneeUser?.uiValues[0];
    }else {
        oldAssignee = oldAssign?.props?.object_string?.dbValues[0];
    }
    return oldAssignee;
};

/**
 * Retrieves the display value for the new assignee.
 *
 * @param {Object} newAssign - The object containing new assignee information.
 *
 * @return {String} Returns the formatted display name of the new assignee.
 */
const getDisplayNewAssignee = function( newAssign ) {
    let dispValNewAssignee;
    if ( newAssign === undefined ) {
        newAssign = '';
    } else if( newAssign.type === 'ResourcePool' ) {
        var resource = '/i18n/WorkflowCommandPanelsMessages.json';
        let anyText =  localeSvc.getLoadedText( resource );
        let group = newAssign.props.group.uiValues[0];
        let role = newAssign.props.role.uiValues[0];
        if( group === '' ) {
            dispValNewAssignee = group.concat( anyText.anyForResourcepool, '/', role );
        } else if( role === '' ) {
            dispValNewAssignee = group.concat( '/', anyText.anyForResourcepool );
        } else{
            dispValNewAssignee = group.concat( '/', role );
        }
    } else if( newAssign.type === 'GroupMember' ) {
        dispValNewAssignee = newAssign?.props?.user?.uiValues[0];
    }
    return dispValNewAssignee;
};

/**
 * Removes the stored table data from local storage.
 *
 */
const cleanup = function() {
    localStorage.removeItem( 'tableData' );
};

/**
 * Generates column information objects for a table based on provided attributes.
 *
 * @param {Array} columns - The list of column attribute objects.
 * @param {Boolean} showRemove - Flag to determine whether to display the "previousAssignment" column.
 * @param {Boolean} showAdd - Flag to determine whether to display the "newAssignment" column.
 *
 * @return {Array} Returns an array of column information objects.
 */
function _getTableColumnInfos( columns, showRemove, showAdd ) {
    var columnInfos = [];
    _.forEach( columns, function( attrObj ) {
        var propName = attrObj.name;
        var propDisplayName = attrObj.displayName;
        var width = attrObj.width;
        var minWidth = attrObj.minWidth;

        var columnInfo = awColumnSvc.createColumnInfo();
        //Set values for common properties
        columnInfo.name = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.enableFiltering = true;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;
        columnInfo.maxWidth = 800;
        columnInfo.modifiable = false;
        columnInfo.isActionColumn = false;
        // Below two variable need to set to hide the Hide columns menu from table
        // As we use hard coded column so we don't have arrange panel right now. So to overcome
        // the issue setting these variables.
        columnInfo.enableHiding = false;
        columnInfo.enableColumnHiding = false;

        if( showAdd !== true && columnInfo.name !== 'newAssignment'   ||  showRemove !== true && columnInfo.name !== 'previousAssignment' ) {
            columnInfos.push( columnInfo );
        }
    } );
    return columnInfos;
}

/**
 * Loads the participant table columns based on provided column attributes.
 *
 * @param {Array} columns - The list of column attribute objects.
 * @param {Boolean} showRemove - Flag to determine whether to display the "previousAssignment" column.
 * @param {Boolean} showAdd - Flag to determine whether to display the "newAssignment" column.
 *
 * @return {Object} Returns an object containing column information.
 */
export let loadParticipantTableColumns = function(  columns, showRemove, showAdd ) {
    // Get the column configuration info and return
    return {
        columnInfos: _getTableColumnInfos( columns, showRemove, showAdd )
    };
};

/**
 * Retrieves the participant type based on the provided parameters.
 *
 * @param {Object} params - The object containing participant-related details.
 *
 * @return {String} Returns the display title of the participant type.
 */
const getParticipantType = function( params ) {
    let pt;
    if ( params?.subPanelContext?.displayTitle || params?.displayTitle ) {
        pt = params.subPanelContext.displayTitle;
    } else if ( params?.addUserPanelState?.participantType ) {
        pt = params.addUserPanelState.participantType;
    } else if ( params?.participantType?.displayTitle ) {
        pt = params.participantType.displayTitle;
    } else {
        pt = params?.addUserPanelState?.displayTitle;
    }
    return pt;
};

/**
 * Retrieves the selected object based on the given parameters.
 *
 * @param {Object} params - The object containing selection-related details.
 * @param {Boolean} isAddParticipant - Flag indicating if it's add case.
 *
 * @return {Object} Returns the selected object based on the provided parameters.
 */
const getObject = function( params, isAddParticipant ) {
    let obj;
    if ( params?.subPanelContext?.selectedObject ) {
        obj = params.subPanelContext.selectedObject;
    } else if( params?.addUserPanelState?.selected && appCtxSvc.getCtx().preferences?.AWC_enable_single_participants_table[0] === 'true' && isAddParticipant === true ) {
        obj = clientDataModel.getObject( params.addUserPanelState?.criteria?.selectedObject );
    } else if( params?.addUserPanelState?.selected ) {
        if( params?.addUserPanelState?.selected?.modelType?.typeHierarchyArray?.indexOf( 'Awb0Element' ) > -1  ) {
            obj = clientDataModel.getObject( params?.addUserPanelState?.openedObject?.uid );
        }else{
            obj = params?.addUserPanelState?.selected;
        }
    } else if( params?.addUserPanelState?.openedObject ) {
        obj = params.addUserPanelState.openedObject;
    }  else if( params?.addUserPanelState?.selectedObjects ) {
        obj = clientDataModel.getObject( params.selectedObjectUid );
    } else {
        obj = params?.addUserPanelState?.selectionData?.pselected;
    }
    return obj;
};

/**
 * Retrieves the old assignee based on the provided parameters.
 *
 * @param {Object} params - The object containing selection-related details.
 *
 * @return {Object} Returns the old assignee object or an array of selected old assignees.
 */
const getOldAssignee = function( params ) {
    let obj;
    let selectedObject = clientDataModel.getObject( params?.selectedObjectUid );
    if ( params?.addUserPanelState?.selected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 ) {
        obj = params?.addUserPanelState?.dataProvider?.selectedObjects;
    }else if ( selectedObject?.type === 'Cm0SimpleChangeRevision' ) {
        let oldassignee = [];
        oldassignee[0] = params?.addUserPanelState?.selParticipantObject;
        if( params?.addUserPanelState?.selectedObjects || params?.addUserPanelState?.selParticipantObject ) {
            obj = params?.addUserPanelState?.selectedObjects ? params?.addUserPanelState?.selectedObjects : oldassignee;
        }else{
            obj = params?.addUserPanelState?.selectedObjects;
        }
    } else{
        if( params?.addUserPanelState?.selectionData?.selected ) {
            obj = params?.addUserPanelState?.selectionData?.selected;
        }else if( params?.addUserPanelState?.selParticipantObject ) {
            let oldAssignee = [];
            oldAssignee[0] = params?.addUserPanelState?.selParticipantObject;
            obj = oldAssignee;
        }
    }
    return obj;
};

/**
 * Retrieves a comma-separated string of old assignee UIDs based on the provided parameters.
 *
 * @param {Object} params - The object containing selection-related details.
 *
 * @return {String} Returns a comma-separated string of old assignee UIDs.
 */
const getOldAssigneeUid = function( params ) {
    let obj;
    if ( params?.addUserPanelState?.pselected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 ) {
        obj = params?.addUserPanelState?.dataProvider?.selectedObjects ? params?.addUserPanelState?.dataProvider?.selectedObjects :
            params?.addUserPanelState?.selected?.selected;
    } else{
        obj = params?.addUserPanelState?.selectionData.selected;
    }
    let oldAssigneeUid = '';
    for ( let i = 0; i < obj?.length; i++ ) {
        if ( obj[i].props.awp0Target ) {
            oldAssigneeUid += obj[i].props.awp0Target.dbValue;
        }else if ( obj[i].props.fnd0Participant ) {
            oldAssigneeUid += obj[i].props.fnd0Participant.dbValue;
        }else{
            oldAssigneeUid += obj[i].uid;
        }
        if ( i < obj.length - 1 ) {
            oldAssigneeUid += ','; // Add a comma between uids except for the last one
        }
    }
    return oldAssigneeUid;
};

/**
 * Retrieves the display value for the old assignee based on the provided parameters.
 *
 * @param {Object} params - The object containing selection-related details.
 *
 * @return {String} Returns the display name of the old assignee.
 */
const getdispValOldAssignee = function( params ) {
    let obj;
    if ( params?.addUserPanelState?.selected?.modelType?.typeHierarchyArray?.indexOf( 'ChangeItemRevision' ) > -1 ) {
        obj = params?.addUserPanelState?.selected?.props?.owning_user?.displayValues[0];
    } else if ( params?.addUserPanelState?.selectedUsers ) {
        obj = params?.addUserPanelState?.selectedUsers[0]?.props?.user?.displayValues[0];
    }else if ( params?.addUserPanelState?.selectedObjects ) {
        obj = params?.addUserPanelState?.selectedObjects[0]?.props?.object_string?.dbValue;
    } else{
        obj = params?.addUserPanelState?.selectionData?.selected[0]?.props?.object_string?.dbValue;
    }
    return obj;
};

/**
 * Updates task notifications and modifies the assignee state in the background.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} data - The object containing notification-related information.
 * @param {Object} notifyAssignees - The service responsible for updating assignees.
 *
 */
const setUpdateTasksAndNotifyInBackground = function( addUserPanelState, data, notifyAssignees ) {
    notifyAssignees.update( data.notifyAssignees.dbValue, {}, { markModified: true } );
    addUserPanelState.notifyAssignees = data.notifyAssignees.dbValue;
};

/**
 * Updates task notifications when the component is mounted.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} data - The object containing notification-related information.
 * @param {Object} notifyAssignees - The service responsible for updating assignees.
 * @param {Object} ctx - The context object containing preferences and configuration.
 *
 */
const setUpdateTasksAndNotifyOnmount = function( addUserPanelState, data, notifyAssignees, ctx ) {
    let notify = false;
    if( ctx?.preferences?.WRKFLW_dynamic_participant_sync_notification?.[0] !== '0' ) {
        notify = true;
    } else {
        notify = false;
    }

    notifyAssignees.update( notify, {}, { markModified: true } );
    addUserPanelState.notifyAssignees = notify;
};

/**
 * Populates panel data and updates notification preferences based on application context.
 *
 * @param {Object} data - The object containing notification-related information.
 * @param {Object} addUserPanelState - The object containing panel state data.
 *
 * @return {Object} Returns an updated object containing notification preferences.
 */
export let populatePanelData = function( data, addUserPanelState ) {
    var syncValue = false;
    if ( appCtxSvc.ctx && appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.WRKFLW_dynamic_participant_sync_notification
        && appCtxSvc.ctx.preferences.WRKFLW_dynamic_participant_sync_notification?.[0] === '1' ) {
        syncValue = true;
    } else {
        syncValue = false;
    }
    const newnotifyAssignees = _.clone( data.notifyAssignees );
    newnotifyAssignees.dbValue = syncValue;
    if( addUserPanelState !== '[object Object]' ) {
        addUserPanelState.notifyAssignees = syncValue;
    }

    let ctx = appCtxSvc.getCtx();
    let received_data = ctx?.state?.params;

    var resource = 'ChangeContentMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    return {
        notifyAssignees: newnotifyAssignees
    };
};

/**
 * call UpdateParticipants Fo rRemove With Or Without Impacted Tasks.
 *
 * @param {Object} ctx - The context object containing state and parameters.
 * @param {Object} commandContext - The context for the executed command.
 * @param {Array} selectedData - The list of selected participants for removal.
 * * @param {Object} data - view model data
 *
 * @return {Promise} Returns a promise that resolves when the participants are updated.
 */
const callUpdateParticipantsForRemoveWithOrWithoutImpactedTasks = async function( ctx, commandContext, selectedData, adaptedObj, data ) {
    if( ctx.state.params.addUserPanelState.selectionData && ctx.state.params.addUserPanelState.selectionData.selected[0].type === 'Awp0XRTObjectSetRow' && ( ctx.mselected && ctx.mselected[0] && ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Participant' ) > -1 ) ) {
        ctx.state.params.addUserPanelState.selectionData.selected = ctx.mselected;
        selectedData = ctx.mselected;
    }
    let sourceObjUids = ctx.state.params.addUserPanelState.selectionData?.selected.map( sourceObj => sourceObj.props?.fnd0Participant?.dbValue ?
        sourceObj.props.fnd0Participant?.dbValue : sourceObj.uid );
    if ( sourceObjUids === undefined || sourceObjUids?.length === 0 ) {
        sourceObjUids = ctx.state.params.addUserPanelState.selected?.selected.map( sourceObj => sourceObj.props?.fnd0Participant?.dbValue ?
            sourceObj.props.fnd0Participant?.dbValue : sourceObj.uid );
    }
    await dms.getProperties( sourceObjUids, [ 'assignee', 'fnd0Participant' ] );
    if ( ctx.state.params.addUserPanelState.selectionData ) {
        ctx.state.params.addUserPanelState.selectionData.pselected = adaptedObj;
    } else { // we enter this else block when addUserPanelState.selectionData is not defined. In the immediate next if block we are testing the value of selectionData.selected. Hence we need to define selectionData.selected here
        ctx.state.params.addUserPanelState.selectionData = {
            pselected : adaptedObj,
            selected: selectedData
        };
    }
    var updateParticipantInfo = replaceParticipant.getMultipleRemoveParticipantInput( ctx.state.params.addUserPanelState, selectedData, ctx, true, data );
    ctx.state.params.selectedObjectUid = ctx.pselected.uid;
    return replaceParticipant.replaceParticipantsInternalNew( updateParticipantInfo, ctx.state.params.addUserPanelState, null, null, ctx );
};

/**
 * Loads impacted workflow task information for participant removal.
 *
 * @param {Object} ctx - The context object containing state and parameters.
 * @param {Object} commandContext - The context for the executed command.
 * @param {Object} data - view model data
 *
 * @return {Promise|Object} Returns a promise that resolves when participants are updated,
 *                          or an object containing impacted workflow task information.
 */
export let loadimpactedWftInfoResultsForRemove = async function( ctx, commandContext, data ) {
    if ( ctx
        && ctx.pselected
        && ctx.pselected.modelType
        && ctx.pselected.modelType.typeHierarchyArray
        && ctx.pselected.modelType.typeHierarchyArray.indexOf( 'ChangeItemRevision' ) > -1 ) {
        if( ctx.state && ctx.state.params ) {
            ctx.state.params = {
                addUserPanelState : {
                    pselected: ctx.pselected,
                    selected: commandContext?.selectionData ? commandContext.selectionData :
                        { selected : ctx.mselected },
                    participantType : commandContext?.showObjectContext ? commandContext.showObjectContext :
                        ctx.selected?.type,
                    selectionData: commandContext?.selectionData
                }
            };
        }

        if( ctx?.state?.params?.addUserPanelState?.selected === undefined ) {
            ctx.state.params.addUserPanelState.selected = ctx?.pselected;
        }

        if( commandContext?.dataProvider ) {
            ctx.state.params.addUserPanelState.dataProvider = commandContext?.dataProvider;
        } else if( commandContext?.selectionData ) {
            ctx.state.params.addUserPanelState.dataProvider = {
                selectedObjects : commandContext?.selectionData?.selected
            };
        }else if( ctx?.state?.params?.addUserPanelState?.dataProvider === undefined && commandContext?.selectedObjects ) {
            ctx.state.params.addUserPanelState.dataProvider = {
                selectedObjects : commandContext.selectedObjects
            };
        }
    } else if( ctx && ctx.state && ctx.state.params ) {
        ctx.state.params = {
            addUserPanelState : {
                selectionData: commandContext?.selectionData ? commandContext.selectionData : commandContext,
                participantType : commandContext?.showObjectContext ? commandContext.showObjectContext :
                    ctx.selected.type
            }
        };
    }
    let selectedData = ctx?.state?.params?.addUserPanelState?.selectionData ? ctx.state.params.addUserPanelState.selectionData.selected :
        ctx?.state?.params?.addUserPanelState?.dataProvider?.selectedObjects;
    let oldAssigneeUid = getOldAssigneeUid( ctx?.state?.params );

    if( ctx
        && ctx.state
        && ctx.state.params
        && ctx.state.params.addUserPanelState !== undefined
    ) {
        ctx.state.params.addUserPanelState.oldAssigneeUid = oldAssigneeUid;
    }

    let selectedObjForRemove = [];
    selectedObjForRemove.push( appCtxSvc.getCtx( 'pselected' ) );
    let adaptedObj = adapterService.getAdaptedObjectsSync( selectedObjForRemove );

    if( ctx
        && ctx.preferences
        && ( ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync === undefined || ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync?.[0] === '0' )
    ) {
        replaceParticipant.clearImpactedTasksFromCtx( ctx );
        return callUpdateParticipantsForRemoveWithOrWithoutImpactedTasks( ctx, commandContext, selectedData, adaptedObj[0], data );
    }
    let inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Awp0PreviewImpactedWorkflowTaskForRemove'
        },
        searchInput: {
            attributesToInflate: [ 'scp0LatestResults' ],
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0DPSyncTasksViewProvider',
            columnFilters: [],
            searchSortCriteria: [ {
                fieldName: 'fnd0AliasTaskName',
                sortDirection: 'DESC'
            }
            ],
            searchCriteria: {
                selectedObject: adaptedObj[0].uid,
                oldAssignee: oldAssigneeUid
            },
            searchFilterFieldSortType: 'Priority',
            startIndex: 0
        },
        inflateProperties: true
    };

    const response = await tcDataManagementService.basePerformSearchViewModel( inputData );
    if ( response?.totalFound > 0 ) {
        let valueOfArrayToReturn = getImpactedTaskResponse( response, null, ctx );
        if( ctx?.preferences?.WRKFLW_dynamic_participant_task_assignee_sync[0] === '1' ) {
            if( ctx?.state?.params?.addUserPanelState?.selectionData === undefined ) {
                ctx.state.params.addUserPanelState.selectionData = {
                    selected : selectedData
                };
            }

            if( ctx?.state?.params?.addUserPanelState !== undefined ) {
                ctx.state.params.addUserPanelState.valueOfArrayToReturn = valueOfArrayToReturn;
                ctx.state.params.addUserPanelState.columnConfig = response.columnConfig;
            }

            return callUpdateParticipantsForRemoveWithOrWithoutImpactedTasks( ctx, commandContext, selectedData, adaptedObj[0] );
        }
        if( commandContext ) {
            commandContext.totalFound = response.totalFound;
            commandContext.valueOfArrayToReturn = valueOfArrayToReturn;
            commandContext.columnConfig = response.columnConfig;
        }


        let impactedTaskTable = new Array( 3 );
        impactedTaskTable[0] = response.totalFound;
        impactedTaskTable[1] = valueOfArrayToReturn;
        impactedTaskTable[2] = response.columnConfig;
        saveImpactedTaskTableData( impactedTaskTable );

        if ( commandContext.selectionData === undefined || commandContext.selectionData?.selected === undefined ) {
            commandContext.selectionData = {
                selected : ctx?.mselected
            };
        }
        return {
            ctx: ctx,
            commandContext: commandContext
        };
    }
    if( ctx ) {
        replaceParticipant.clearImpactedTasksFromCtx( ctx );
        return callUpdateParticipantsForRemoveWithOrWithoutImpactedTasks( ctx, commandContext, selectedData, adaptedObj[0] );
    }
};

/**
 * Replaces participant assignments with or without impacted tasks.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} ctx - The context object containing state and parameters.
 *
 */
const callUpdateParticipantsForReplaceWithOrWithoutImpactedTasks = function( addUserPanelState, ctx ) {
    let oldAssignee;
    let newAssignee;
    if( addUserPanelState?.selParticipantObject ) {
        oldAssignee = clientDataModel.getObject( addUserPanelState?.selParticipantObject?.props?.assignee?.dbValues[0] );
    } else {
        oldAssignee = clientDataModel.getObject( addUserPanelState?.selectionData?.value?.selected?.[0]?.props?.awp0Target?.dbValue );
    }
    Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelState?.criteria, [ oldAssignee ] ).then( function( validOldAssignee ) {
        oldAssignee = validOldAssignee[0];
        Awp0WorkflowUtils.getValidObjectsToAdd( addUserPanelState.criteria, [ addUserPanelState.selectedUsers[0] ] ).then( function( validToAssignee ) {
            newAssignee = validToAssignee[0];
            let updateParticipantInfo = [
                {
                    participantRepositoryWSO: addUserPanelState.selectedObject ? addUserPanelState.selectedObject : addUserPanelState.selected,
                    participantType: addUserPanelState.participant ? addUserPanelState.participant : addUserPanelState.participantType,
                    fromAssignee: oldAssignee,
                    toAssignee: newAssignee,
                    operationType : 'ReplaceParticipant'
                }
            ];
            return replaceParticipant.replaceParticipantsInternalNew( updateParticipantInfo, addUserPanelState, null,
                null, ctx );
        } );
    } );
};

/**
 * Loads impacted workflow task information for participant replacement.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} participantUser - The participant user involved in the replacement.
 * @param {Object} ctx - The context object containing state and preferences.
 *
 * @return {Promise|Object} Returns a promise that resolves when participants are updated,
 *                          or an object containing impacted workflow task information.
 */
export let loadimpactedWftInfoResultsReplace = async function( addUserPanelState, participantUser, ctx ) {
    if ( ctx && ctx.preferences &&
            ( ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync === undefined ||
            ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync?.[0] === '0' ) ) {
        replaceParticipant.clearImpactedTasksFromCtx( ctx );
        return callUpdateParticipantsForReplaceWithOrWithoutImpactedTasks( addUserPanelState, ctx );
    }
    let oldAssignee = null;
    if( addUserPanelState?.selParticipantObject ) {
        oldAssignee = addUserPanelState?.selParticipantObject?.uid;
    }else{
        oldAssignee = addUserPanelState?.selectionData?.value?.selected?.[0]?.props?.awp0Target?.dbValue;
    }
    let inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Awp0PreviewImpactedWorkflowTask'
        },
        searchInput: {
            attributesToInflate: [ 'scp0LatestResults' ],
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0DPSyncTasksViewProvider',
            columnFilters: [],
            searchSortCriteria: [],
            searchCriteria: {
                selectedObject: addUserPanelState?.selectedObject?.uid,
                oldAssignee: oldAssignee
            },
            searchFilterFieldSortType: 'Priority',
            startIndex: 0
        },
        inflateProperties: true
    };

    return tcDataManagementService.basePerformSearchViewModel( inputData )
        .then( function( response ) {
            if ( response.totalFound > 0 ) {
                let valueOfArrayToReturn = getImpactedTaskResponse( response, null, null );
                addUserPanelState.totalFound = response.totalFound;
                addUserPanelState.valueOfArrayToReturn = valueOfArrayToReturn;
                addUserPanelState.columnConfig = response.columnConfig;

                let impactedTaskTable = new Array( 3 );
                impactedTaskTable[0] = response.totalFound;
                impactedTaskTable[1] = valueOfArrayToReturn;
                impactedTaskTable[2] = response.columnConfig;
                saveImpactedTaskTableData( impactedTaskTable );

                if ( ctx?.preferences?.WRKFLW_dynamic_participant_task_assignee_sync[0] === '1' ) {
                    return callUpdateParticipantsForReplaceWithOrWithoutImpactedTasks( addUserPanelState, ctx );
                }
                return { addUserPanelState: addUserPanelState };
            }
            replaceParticipant.clearImpactedTasksFromCtx( ctx );
            return callUpdateParticipantsForReplaceWithOrWithoutImpactedTasks( addUserPanelState, ctx );
        } );
};

/**
 * Adds participants to the workflow without considering impacted tasks.
 *
 * @param {Object} addUserPanelState - addUserPanelState.
 * @param {Object} subPanelContext -subPanelContext.
 * @param {Object} ctx - The context object containing state and preferences.
 *
 * @return {Promise} Returns a promise that resolves when participants are successfully added.
 */
const callUpdateParticipantsForAddWithoutImpactedTasks = async function( addUserPanelState, subPanelContext, ctx ) {
    let updateParticipantInfo = await replaceParticipant.getMultipleAddParticipantInput( addUserPanelState, addUserPanelState.selectedUsers, ctx );
    return replaceParticipant.replaceParticipantsInternalNew( updateParticipantInfo, addUserPanelState, subPanelContext,
        null, ctx );
};

/**
 * Loads impacted workflow task information for participant addition.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} subPanelContext - The context of the sub-panel managing participant additions.
 * @param {Object} ctx - The context object containing state and preferences.
 *
 * @return {Promise|Object} Returns a promise that resolves when participants are updated,
 *                          or an object containing impacted workflow task information.
 */
export let loadimpactedWftInfoResultsForAdd = async function( addUserPanelState, subPanelContext, ctx ) {
    if( addUserPanelState && !addUserPanelState.selectedObject && !addUserPanelState.selected ) {
        addUserPanelState.selected = ctx?.selected;
    }

    if ( ctx && ctx.preferences &&
            ( ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync === undefined ||
            ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync?.[0] === '0' ) ) {
        replaceParticipant.clearImpactedTasksFromCtx( ctx );
        return callUpdateParticipantsForAddWithoutImpactedTasks( addUserPanelState, subPanelContext, ctx );
    }
    let selectedObject = null;
    if( ctx?.preferences?.AWC_enable_single_participants_table[0] === 'false' ) {
        selectedObject = addUserPanelState?.selectedObject ? addUserPanelState.selectedObject.uid : addUserPanelState?.selected?.uid;
    }else {
        selectedObject = addUserPanelState?.criteria?.selectedObject;
    }
    const inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Awp0PreviewImpactedWorkflowTask'
        },
        searchInput: {
            attributesToInflate: [ 'scp0LatestResults' ],
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0DPSyncTasksViewProvider',
            columnFilters: [],
            searchSortCriteria: [],
            searchCriteria: {
                selectedObject: selectedObject,
                participantType: addUserPanelState?.participant ? addUserPanelState?.participant : addUserPanelState?.participantType
            },
            searchFilterFieldSortType: 'Priority',
            startIndex: 0
        },
        inflateProperties: true
    };

    return tcDataManagementService.basePerformSearchViewModel( inputData )
        .then( async function( response ) {
            if ( response?.totalFound > 0 ) {
                let valueOfArrayToReturn = getImpactedTaskResponse( response, null, null );
                if( addUserPanelState ) {
                    addUserPanelState.totalFound = response.totalFound;
                    addUserPanelState.valueOfArrayToReturn = valueOfArrayToReturn;
                    addUserPanelState.columnConfig = response.columnConfig;
                }

                let impactedTaskTable = new Array( 3 );
                impactedTaskTable[0] = response.totalFound;
                impactedTaskTable[1] = valueOfArrayToReturn;
                impactedTaskTable[2] = response.columnConfig;
                saveImpactedTaskTableData( impactedTaskTable );

                if ( ctx
                    && ctx.preferences
                    && ctx.preferences.WRKFLW_dynamic_participant_task_assignee_sync?.[0] === '1'
                ) {
                    let updateParticipantInfo = await replaceParticipant.getMultipleAddParticipantInput( addUserPanelState, addUserPanelState?.selectedUsers, ctx );
                    return replaceParticipant.replaceParticipantsInternalNew( updateParticipantInfo, addUserPanelState, subPanelContext,
                        null, ctx );
                }
                return { addUserPanelState: addUserPanelState };
            }
            replaceParticipant.clearImpactedTasksFromCtx( ctx );
            return callUpdateParticipantsForAddWithoutImpactedTasks( addUserPanelState, subPanelContext, ctx );
        } );
};

/**
 * Loads impacted workflow task information based on participant actions (Add, Replace, Remove).
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} data - The object containing search criteria, filters, and sorting preferences.
 * @param {Object} subPanelContext - The context of the sub-panel managing participant updates.
 * @param {Object} ctx - The context object containing state and preferences.
 *
 * @return {Object|Promise} Returns impacted workflow task information or calls search results function.
 */
export let loadimpactedWftInfoResults = function( addUserPanelState, data, subPanelContext, ctx )  {
    var deferred = AwPromiseService.instance.defer();
    let inputData = '';
    if( data?.columnProviders?.impactedWorkflowTasksColumnProvider?.columnFilters?.length > 0 ||  data?.columnProviders?.impactedWorkflowTasksColumnProvider?.sortCriteria?.length > 0 ) {
        if( data?.conditions?.showAdd === true ) {
            inputData = {
                columnConfigInput: {
                    clientName: 'AWClient',
                    clientScopeURI: 'Awp0PreviewImpactedWorkflowTask'
                },
                searchInput: {
                    attributesToInflate: [ 'scp0LatestResults' ],
                    maxToLoad: 50,
                    maxToReturn: 50,
                    providerName: 'Awp0DPSyncTasksViewProvider',
                    columnFilters: data?.columnProviders?.impactedWorkflowTasksColumnProvider?.columnFilters,
                    searchSortCriteria: data?.columnProviders?.impactedWorkflowTasksColumnProvider?.sortCriteria,
                    searchCriteria: {
                        selectedObject: addUserPanelState?.selectedObject ? addUserPanelState?.selectedObject.uid : addUserPanelState?.selected?.uid,
                        participantType: addUserPanelState?.participant ? addUserPanelState?.participant : addUserPanelState?.participantType
                    },
                    searchFilterFieldSortType: 'Priority',
                    startIndex: 0
                },
                inflateProperties: true
            };
        } else if( data?.conditions?.showReplace === true ) {
            let oldAssignee = null;
            if( addUserPanelState?.selParticipantObject ) {
                oldAssignee = addUserPanelState?.selParticipantObject?.uid;
            } else {
                oldAssignee = addUserPanelState?.selectionData?.value?.selected?.[0]?.props?.awp0Target?.dbValue;
            }
            inputData = {
                columnConfigInput: {
                    clientName: 'AWClient',
                    clientScopeURI: 'Awp0PreviewImpactedWorkflowTask'
                },
                searchInput: {
                    attributesToInflate: [ 'scp0LatestResults' ],
                    maxToLoad: 50,
                    maxToReturn: 50,
                    providerName: 'Awp0DPSyncTasksViewProvider',
                    columnFilters: data?.columnProviders?.impactedWorkflowTasksColumnProvider?.columnFilters,
                    searchSortCriteria: data?.columnProviders?.impactedWorkflowTasksColumnProvider?.sortCriteria,
                    searchCriteria: {
                        selectedObject: addUserPanelState?.selectedObject?.uid,
                        oldAssignee: oldAssignee
                    },
                    searchFilterFieldSortType: 'Priority',
                    startIndex: 0
                },
                inflateProperties: true
            };
        } else if( data.conditions.showRemove === true ) {
            let oldAssigneeUid = getOldAssigneeUid( ctx.state.params );
            inputData = {
                columnConfigInput: {
                    clientName: 'AWClient',
                    clientScopeURI: 'Awp0PreviewImpactedWorkflowTaskForRemove'
                },
                searchInput: {
                    attributesToInflate: [ 'scp0LatestResults' ],
                    maxToLoad: 50,
                    maxToReturn: 50,
                    providerName: 'Awp0DPSyncTasksViewProvider',
                    columnFilters: data.columnProviders.impactedWorkflowTasksColumnProvider.columnFilters,
                    searchSortCriteria: data.columnProviders.impactedWorkflowTasksColumnProvider.sortCriteria,
                    searchCriteria: {
                        selectedObject: ctx.state.params.selectedObjectUid,
                        oldAssignee: oldAssigneeUid
                    },
                    searchFilterFieldSortType: 'Priority',
                    startIndex: 0
                },
                inflateProperties: true
            };
        }
        return getImpactedWFSearchResults( inputData, addUserPanelState, ctx );
    }
    if( addUserPanelState === '[object Object]' ) {
        const savedData = localStorage.getItem( 'savedAddUserPanelState' );
        if ( savedData ) {
            const savedAddUserPanelState = JSON.parse( savedData );
            let savedSearchResult = [];
            _.forEach( savedAddUserPanelState[1],
                function( index ) {
                    let uid = viewModelObjectSvc.constructViewModelObjectFromModelObject( index );
                    savedSearchResult.push( uid );
                } );
            return {
                totalFound : savedAddUserPanelState[0],
                searchResults : savedSearchResult,
                impactedTasks : savedSearchResult,
                originalImpactedTasksList : [],
                columnConfig : savedAddUserPanelState[2]
            };
        }
    }
    if ( data?.conditions?.showAdd === true || data?.conditions?.showReplace === true ) {
        addUserPanelState.clientScopeURI = 'Awp0PreviewImpactedWorkflowTask';
    }else {
        addUserPanelState.clientScopeURI = 'Awp0PreviewImpactedWorkflowTaskForRemove';
    }
    return{
        totalFound : addUserPanelState.totalFound,
        searchResults : addUserPanelState.valueOfArrayToReturn,
        impactedTasks : addUserPanelState.valueOfArrayToReturn,
        originalImpactedTasksList : [],
        columnConfig : addUserPanelState.columnConfig,
        objectSetUri : addUserPanelState.clientScopeURI,
        columns1 : addUserPanelState.columnConfig.columns
    };
};

/**
 * Retrieves impacted workflow task search results based on the provided input data.
 *
 * @param {Object} inputData - The search criteria and configuration for retrieving impacted tasks.
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} ctx - The context object containing state and preferences.
 *
 * @return {Promise} Returns a promise that resolves with impacted workflow task search results.
 */
var getImpactedWFSearchResults = function( inputData, addUserPanelState, ctx ) {
    var deferred = AwPromiseService.instance.defer();
    tcDataManagementService.basePerformSearchViewModel( inputData )
        .then( function( response ) {
            //This is done to keep the original impacted list , no matter how many times filter is applied.
            let originalImpactedTasksList = ctx.originalImpactedTasksList?.length === 0 ? addUserPanelState.valueOfArrayToReturn : ctx.originalImpactedTasksList;
            if ( response.searchResultsJSON ) {
                let valueOfArrayToReturn = getImpactedTaskResponse( response, null, null );
                addUserPanelState.totalFound = response.totalFound;
                addUserPanelState.valueOfArrayToReturn = valueOfArrayToReturn;
                addUserPanelState.columnConfig = response.columnConfig;
            }
            deferred.resolve( {
                addUserPanelState : addUserPanelState,
                totalFound : addUserPanelState.totalFound,
                searchResults : addUserPanelState.valueOfArrayToReturn,
                impactedTasks : addUserPanelState.valueOfArrayToReturn,
                originalImpactedTasksList : originalImpactedTasksList,
                columnConfig : addUserPanelState.columnConfig,
                columns1 : addUserPanelState.columnConfig.columns
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

/**
 * Retrieves the UID of the from-assignee based on participant or item revision details.
 *
 * @param {Object} itemRevObject - The item revision object containing participant details.
 * @param {Object} participantObject - The participant object for assignment reference.
 * @param {String} participantType - The type of participant involved in the assignment.
 * @param {Object} ctx - The context object containing state and parameters.
 *
 * @return {String} Returns the UID of the from-assignee.
 */
export let getFromAssignee = function( itemRevObject, participantObject, participantType, ctx ) {
    var fromAssignee = null;

    if ( participantObject ) {
        var participantObj = clientDataModel.getObject( participantObject.uid );
        fromAssignee = getFromAssigneeFromParticipant( participantObj );
        return participantObj.uid;
    } else if ( itemRevObject ) {
        fromAssignee = getFromAssigneeFromItemRevision( itemRevObject, participantType );
        return fromAssignee.uid;
    }
    fromAssignee = ctx.state.params.addUserPanelState.selectionData.selected[0].props.awp0Target.dbValue;
    return fromAssignee;
};

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
    if ( participantObject && participantObject.props.assignee && participantObject.props.assignee.dbValues.length > 0 ) {
        assignee = clientDataModel.getObject( participantObject.props.assignee.dbValues[0] );
        fromAssignee = {
            type: assignee.type,
            uid: assignee.uid
        };
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
    if ( itemRevObject.props.participants && itemRevObject.props.participants.dbValues.length > 0 ) {
        participants = itemRevObject.props.participants.dbValues;
    }

    // Check if participant objects are not null then iterate for each participant type
    // to find out the correct participant that need to be removed
    if ( participants ) {
        // Iterate for each object object
        _.forEach( participants, function( participant ) {
            var participantObj = clientDataModel.getObject( participant );

            if ( participantObj && participantObj.type === participantType ) {
                fromAssignee = getFromAssigneeFromParticipant( participantObj );
            }
        } );
    }

    return fromAssignee;
};

/**
 * Parses the response and retrieves impacted task objects.
 *
 * @param {Object} response - The response containing search results.
 * @param {Object} data - Additional data (not used in processing).
 * @param {Object} ctx - The context object (not used in processing).
 *
 * @return {Array} Returns an array of impacted task model objects.
 */
export let getImpactedTaskResponse = function( response, data, ctx ) {
    var valueOfArrayToReturn = [];
    var rawSymptomDefectsObjects = JSON.parse( response.searchResultsJSON ).objects;
    valueOfArrayToReturn = rawSymptomDefectsObjects.map( function( obj ) {
        return response.ServiceData.modelObjects[ obj.uid ];
    } );
    return valueOfArrayToReturn;
};

/**
 * Navigates to the impacted workflow tasks view for an item revision.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} subPanelContext - The context of the sub-panel managing workflow updates.
 * @param {Object} toAssignee - The assignee object for updating participant information.
 * @param {String} selectedObjectUid - The UID of the selected object.
 * @param {Object} oldAssignee - The old assignee object whose impact is being reviewed.
 * @param {String} participantType - The type of participant involved in the update.
 * @param {String} headerTitle - The title to be displayed in the impacted workflow tasks view.
 *
 */
export let showImpactedTasksForItemRevision = function( addUserPanelState, subPanelContext, toAssignee, selectedObjectUid, oldAssignee, participantType, headerTitle ) {
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'impactedWorkflowTasks';
    const oldAssigneeUIDString = [];
    let selectedOldAssignee = null;
    if ( oldAssignee?.commandContext?.selectionData?.selected ) {
        selectedOldAssignee = oldAssignee?.commandContext?.selectionData?.selected;
    } else{
        selectedOldAssignee = oldAssignee?.commandContext?.selectedObjects;
    }
    for ( let index = 0; index < selectedOldAssignee?.length; index++ ) {
        let participantObj = addUserPanelState?.selectionData?.selected?.[index] ?
            addUserPanelState.selectionData.selected[index] : addUserPanelState?.selected?.selected[index];
        let type = getRemoveParticipantType( participantObj );
        oldAssigneeUIDString.push( { uid: selectedOldAssignee[index].uid, type: type } );
    }
    const queryString = createQueryString( oldAssigneeUIDString );
    let paramsToWrite = {
        addUserPanelState : addUserPanelState,
        subPanelContext : subPanelContext,
        toAssignee : null,
        selectedObjectUid : selectedObjectUid,
        oldAssigneeUid : selectedOldAssignee,
        participantType : participantType,
        headerTitle : headerTitle,
        oldAssigneeUIDString : queryString
    };
    navigationSvc.navigate( action, paramsToWrite );
};
export let showImpactedTasksForChangeRevision = function( params ) {
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'impactedWorkflowTasks';
    let selectedOldAssignee = null;
    if ( params?.commandContext?.selectionData?.selected ) {
        selectedOldAssignee = params?.commandContext?.selectionData?.selected;
    } else{
        selectedOldAssignee = params?.commandContext?.selectedObjects;
    }
    const oldAssigneeUIDString = [];
    for ( let index = 0; index < selectedOldAssignee?.length; index++ ) {
        let participantObj = params?.commandContext?.selectionData?.selected?.[index] ?
            params.commandContext.selectionData.selected[index] : params?.commandContext?.selected?.selected[index];
        let type = getRemoveParticipantType( participantObj );
        let selObjUid = selectedOldAssignee[index]?.props?.fnd0Participant?.dbValue ? selectedOldAssignee[index]?.props?.fnd0Participant?.dbValue : participantObj?.uid;
        oldAssigneeUIDString.push( { uid: selObjUid, type: type } );
    }
    const queryString = createQueryString( oldAssigneeUIDString );
    let paramsToWrite = {
        addUserPanelState : params?.commandContext,
        subPanelContext : params?.commandContext?.context?.showObjectContext,
        toAssignee : null,
        selectedObjectUid : params?.ctx?.xrtSummaryContextObject?.uid,
        oldAssigneeUid : selectedOldAssignee,
        participantType : params?.commandContext?.showObjectContext,
        headerTitle : params?.ctx?.xrtSummaryContextObject?.props?.object_string.dbValue,
        oldAssigneeUIDString : queryString
    };
    navigationSvc.navigate( action, paramsToWrite );
};

/**
 * Navigates to the impacted workflow tasks view for participant updates.
 *
 * @param {Object} addUserPanelState - The object containing panel state data.
 * @param {Object} subPanelContext - The context of the sub-panel managing workflow updates.
 * @param {Array} toAssignee - The list of assignees being updated.
 * @param {String} selectedObjectUid - The UID of the selected object.
 * @param {String|null} oldAssigneeUid - The UID of the old assignee (if applicable).
 * @param {String} participantType - The type of participant involved in the update.
 * @param {String} headerTitle - The title to be displayed in the impacted workflow tasks view.
 *
 */
export let showImpactedTasks = function( addUserPanelState, subPanelContext, toAssignee, selectedObjectUid, oldAssigneeUid, participantType, headerTitle ) {
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'impactedWorkflowTasks';
    const toAssigneeUID = [];
    let ctxTemp = appCtxSvc.getCtx();
    if( addUserPanelState?.selected && ctxTemp?.preferences?.AWC_enable_single_participants_table[0] === 'true' ) {
        selectedObjectUid = addUserPanelState?.criteria?.selectedObject;
        if( headerTitle === '' || headerTitle === null ) {
            headerTitle = ctxTemp?.xrtSummaryContextObject?.props?.object_string?.dbValue;
        }
    }
    let type = addUserPanelState?.participant ? addUserPanelState.participant : addUserPanelState?.participantType;
    for ( let i = 0; i < toAssignee.length; i++ ) {
        toAssigneeUID.push( { uid: toAssignee[i].uid, type: type } );
    }
    const queryString = createQueryString( toAssigneeUID );
    let paramsToWrite = {
        addUserPanelState : addUserPanelState,
        subPanelContext : subPanelContext,
        toAssignee : toAssignee,
        selectedObjectUid : selectedObjectUid,
        oldAssigneeUid : null,
        participantType : subPanelContext?.displayTitle ? subPanelContext.displayTitle : addUserPanelState?.participantType,
        headerTitle : headerTitle,
        toAssigneeUID : queryString
    };
    navigationSvc.navigate( action, paramsToWrite );
};

/**
 * Creates a query string from an array of objects containing UID and type values.
 *
 * @param {Array} data - The array of objects containing `uid` and `type` properties.
 *
 * @return {String} Returns a properly encoded query string.
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

/**
 * Retrieves the participant type for removal based on the selected object.
 *
 * @param {Object} selected - The object representing the participant to be removed.
 *
 * @return {String} Returns the type of the participant.
 */
export let getRemoveParticipantType = ( selected ) => {
    let participantType;
    if( selected?.props?.fnd0Participant ) {
        const participantObject = clientDataModel.getObject( selected.props.fnd0Participant.dbValue );
        participantType = participantObject.type;
    } else{
        participantType = selected?.type;
    }
    return participantType;
};

export default exports = {
    populatePanelData,
    getFromAssignee,
    getParticipantType,
    getObject,
    getOldAssignee,
    getOldAssigneeUid,
    getdispValOldAssignee,
    loadTableData,
    loadParticipantTableColumns,
    loadRowObject,
    _createProp,
    initializeParticipantTable,
    saveTableData,
    cleanup,
    getImpactedTaskResponse,
    setUpdateTasksAndNotifyInBackground,
    loadimpactedWftInfoResultsForRemove,
    loadimpactedWftInfoResults,
    loadimpactedWftInfoResultsReplace,
    loadimpactedWftInfoResultsForAdd,
    setUpdateTasksAndNotifyOnmount,
    getDisplayNewAssignee,
    saveImpactedTaskTableData,
    showImpactedTasksForChangeRevision,
    showImpactedTasks,
    showImpactedTasksForItemRevision,
    getDisplayOldAssignee,
    getRemoveParticipantType
};
