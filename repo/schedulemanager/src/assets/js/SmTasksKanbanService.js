// Copyright (c) 2022 Siemens
import _ from 'lodash';
import { getBaseUrlPath } from 'app';
import appCtxSvc from 'js/appCtxService';
import awIconService from 'js/awIconService';
import awKanbanUtils from 'js/AwKanbanUtils';
import awSearchService from 'js/awSearchService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import parsingUtils from 'js/parsingUtils';
import smConstants from 'js/ScheduleManagerConstants';
import SmKanbanViewCallbacks from 'js/SmKanbanViewCallbacks';
import uwPropSvc from 'js/uwPropertyService';

export let processOutput = function( data, dataCtxNode, searchData ) {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

export let initializeKanbanColumns = ( kanbanColumns, atomicDataRef, kanbanId, selectionData, i18n ) => {
    let kanbanColumnObject = {};
    if( kanbanColumns ) {
        kanbanColumns.forEach( ( column ) => {
            let displayName = column.displayName;
            if( displayName ) {
                let localizedDispName = i18n[ displayName ];
                if( localizedDispName ) {
                    column.displayName = localizedDispName;
                }
            }
        } );
        kanbanColumnObject = awKanbanUtils.buildKanbanColumns( kanbanColumns );
    }
    let kanbanProps = { atomicDataRef: atomicDataRef, kanbanId: kanbanId, selectionData: selectionData };
    let smKanbanViewCallbacks = new SmKanbanViewCallbacks( kanbanProps );
    return {
        kanbanColumnObject: kanbanColumnObject,
        callbacks: smKanbanViewCallbacks
    };
};

export let prepareLoadAssignTasksContainer = function( kanbanColumnMap ) {
    let loadTasksInfo = [];
    let maxToLoad = 20;
    let displayLimitPref = appCtxSvc.ctx.preferences.AWC_SM_Tasks_Board_Display_Limit;
    if( displayLimitPref && displayLimitPref[ 0 ] ) {
        maxToLoad = parseInt( displayLimitPref[ 0 ] );
    }
    for( let col in kanbanColumnMap ) {
        let statusContainer = {
            status: col,
            state: kanbanColumnMap[ col ],
            startIndex: 0,
            maxToLoad: maxToLoad,
            loadOptions: {}
        };
        loadTasksInfo.push( statusContainer );
    }
    return loadTasksInfo;
};

export let getSchTaskKanbanBoardDisplayLimitFromPreference = function() {
    let prefValue = appCtxSvc.getCtx( 'preferences.AWC_SM_Tasks_Board_Display_Limit' );

    return prefValue.toString();
};

//Fetching the data for maxToLoad and maxToReturn form Display Limit Preference
//and Multiply display limit by 5, for number of coloumns in kanban board.
export let getMaxToLoadAndReturnValueFromDisplayLimitPreference = function() {
    return parseInt( appCtxSvc.getCtx( 'preferences.AWC_SM_Tasks_Board_Display_Limit' ) * 5 );
};

/**
 * Returns the localized priority value
 * @param {int} priorityInt The Integer value
 * @param {Object} data The viewModel object
 * @returns {String} The Localized priority value
 */
let getPriorityString = function( priorityInt, data ) {
    let priorityString = smConstants.PRIORITY[ priorityInt ];
    if( priorityString ) {
        return data.i18n[ priorityString ];
    }
};

let constructKanbanTask = function( taskObj, data ) {
    let cellProps = taskObj.props.awp0CellProperties.dbValues;
    let priorityInt = taskObj.props.priority.dbValues[ 0 ];
    let taskCardProps = [];
    let taskCardPropValues = [];
    let values;
    let valueProp;
    if( !_.isEmpty( cellProps ) ) {
        for( let prop = 0; prop < cellProps.length; prop++ ) {
            if( prop === 0 ) {
                values = cellProps[prop].split( '\\:' );
                valueProp = '<strong class="aw-scheduleManager-kanbanCardText">' + values[ 1 ] + '</strong>';
            } else {
                values = cellProps[prop].split( '\\:' );
                valueProp = '<strong class="aw-scheduleManager-kanbanCardText">' + values[ 0 ] + ': </strong>' + values[ 1 ];
            }
            if( values.length === 2 && values[ 1 ] !== '' ) {
                taskCardProps.push( valueProp );
                taskCardPropValues.push( values[ 1 ] );
            }
        }
    } else {
        let taskName = '<strong>' + taskObj.props.object_name.propertyDescriptor.displayName + ': </strong>' + taskObj.props.object_name.uiValues[ 0 ];
        let scheduleName = '<strong>' + data.i18n.Saw1Schedule + ': </strong>' + taskObj.props.schedule_tag.uiValues[ 0 ];
        let finishDate = taskObj.props.finish_date.uiValues[ 0 ];
        let finishDateValue = '<strong>' + data.i18n.Saw1FinishDate + ': </strong>' + finishDate;
        let percentComplete = '<strong>' + data.i18n.Saw1PercentComplete + ': </strong>' + taskObj.props.fnd0PercentCompleteString.uiValues[ 0 ];
        let priority = getPriorityString( priorityInt, data );
        let priorityValue = '<strong>' + data.i18n.Saw1Priority + ': </strong>' + priority;
        taskCardProps = [ taskName, scheduleName, finishDateValue, percentComplete, priorityValue ];
        taskCardPropValues = [ taskObj.props.object_name.uiValues[ 0 ], taskObj.props.schedule_tag.uiValues[ 0 ], finishDate,  taskObj.props.fnd0PercentCompleteString.uiValues[ 0 ], priority ];
    }
    let status = taskObj.props.fnd0status.dbValues[ 0 ];
    let cssClass = smConstants.BOARD_PRIORITY_COLOR_CLASSES[ priorityInt ] + ' aw-scheduleManager-kanbanBoardCard aw-aria-border';
    let color = smConstants.BOARD_PRIORITY_COLORS[ priorityInt ];
    let iconURL = awIconService.getTypeIconFileUrl( taskObj );
    let iconTooltip = taskObj.props.object_type.uiValues[ 0 ];
    let iconRightTooltip = data.i18n.Saw1OpenObjectTooltip;
    let iconRightTitle = data.i18n.Saw1ShowScheduleObject;
    return {
        id: taskObj.uid,
        status: status,
        text: '',
        tags: taskCardProps,
        tagValues: taskCardPropValues,
        $css: cssClass,
        color: color,
        iconURL: iconURL,
        iconTooltip: iconTooltip,
        showRightIcon: true,
        iconRightTooltip: iconRightTooltip,
        iconRightTitle: iconRightTitle
    };
};

/**
 *  Reads SOA response and prepares data for webix Kanban
 * @param {Object} response SOA response
 * @param {Object} data ViewModel object
 * @returns {Object} The Data in webix format
 */
export let parseKanbanSOAResponse = function( response, data, kanbanState ) {
    let loadedTasks = [];
    if( response.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        _.forEach( searchResults.objects, function( result ) {
            let resultObject = cdm.getObject( result.uid );
            if( resultObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                let kanbanTask = constructKanbanTask( resultObject, data );
                if( !_.isEmpty( kanbanTask ) ) {
                    loadedTasks.push( kanbanTask );
                }
            }
        } );
    }
    let atomicData = kanbanState.getAtomicData();
    atomicData.loadedObjects = loadedTasks;
    return atomicData;
};

/**
 * Prepares the container for saveViewModelEditAndSubmitWorkflow2
 * @param {Object} dragDropContext The context for drag-n-drop
 * @returns {Object} The container for saveViewModelEditAndSubmitWorkflow2
 */
export let prepareDataForSaveEdit = function( kanbanState ) {
    let inputs = [];
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCard' ) {
        let dragDropContext = kanbanState.operation.value;
        let draggedObjectUidArray = dragDropContext.dragContext.source;
        let statusToUpdate = dragDropContext.dragContext.to.config.status;
        let stateToUpdate = kanbanState.kanbanColumnObject.columnMapping[ statusToUpdate ];
        draggedObjectUidArray.forEach( function( objUid ) {
            let draggedObject = cdm.getObject( objUid );
            if( draggedObject ) {
                let lsd = draggedObject.props.lsd.dbValues[ 0 ];
                let stateProp = uwPropSvc.createViewModelProperty( 'fnd0state', 'State', 'STRING',
                    stateToUpdate, '' );
                stateProp.sourceObjectLastSavedDate = lsd;
                let statusProp = uwPropSvc.createViewModelProperty( 'fnd0status', 'Status', 'STRING',
                    statusToUpdate, '' );
                statusProp.sourceObjectLastSavedDate = lsd;
                let editObject = dms.getSaveViewModelEditAndSubmitToWorkflowInput( draggedObject );
                dms.pushViewModelProperty( editObject, stateProp );
                dms.pushViewModelProperty( editObject, statusProp );
                inputs.push( editObject );
            }
        } );
    }
    return inputs;
};

let updateOperationAtomicData = ( atomicDataRef, actionName, value ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    atomicDataDestructured.operation = {
        action: actionName,
        value: value
    };
    atomicDataRef.setAtomicData( atomicDataDestructured );
};

export const revertSchTaskCardDragDrop = ( atomicDataRef ) => {
    const atomicData = atomicDataRef.getAtomicData();
    let atomicDataDestructured = { ...atomicData };
    updateOperationAtomicData( atomicDataRef, 'dragDropCardFailure', atomicDataDestructured.operation.value );
};

export const updateTaskData = function( data ) {
    let updatedCards = [];
    let updatedObjects = data.eventData.updatedObjects;
    updatedObjects.forEach( function( task ) {
        if( task.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
            var kanbanTask = constructKanbanTask( task, data );
            updatedCards.push( kanbanTask );
        }
    } );
    updateOperationAtomicData( data.atomicDataRef.kanbanState, 'updateCardProps', updatedCards );
};

let exports;
export default exports = {
    processOutput,
    initializeKanbanColumns,
    prepareLoadAssignTasksContainer,
    getMaxToLoadAndReturnValueFromDisplayLimitPreference,
    getSchTaskKanbanBoardDisplayLimitFromPreference,
    parseKanbanSOAResponse,
    prepareDataForSaveEdit,
    revertSchTaskCardDragDrop,
    updateTaskData
};
