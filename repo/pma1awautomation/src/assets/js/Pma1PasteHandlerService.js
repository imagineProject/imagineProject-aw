// Copyright (c) 2021 Siemens

/**
 * Special Handlers For Drag & Drop Support in Enterprise BOM (Tc12BOM)
 * @module js/Pma1PasteHandlerService
 */
import _ from 'lodash';
import aceAddElementService from 'js/aceAddElementService';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import clientDataModel from 'soa/kernel/clientDataModel';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import eventBus from 'js/eventBus';
import aceDefaultPasteHandler from 'js/aceDefaultPasteHandler';
import messagingSvc from 'js/messagingService';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaConstants from 'js/cbaConstants';

const dragDataCache = {
    draggedObjects: [],
    draggedObjUids: [],
    draggedFromView: null
};

// Global variable to store view name where dragged object is being dropped
let droppedToView = null;

/* *
 * This API generates Source BOM to Target BOM when there is an Action of Drag and drop.
 * This API invokes addObject2 and updates target structure tree withought explicit refresh in foreground mode.
 *
 * @param {Object} sourceObjects - objects to be added.
 * @param {Object} targetObject - object under which source Bom needs to be generated.
 */
export const addSrcBomToTgtBom = function( sourceObjects, targetObject ) {
    if( !sourceObjects || !targetObject ) {
        return;
    }
    const addElementInput = {
        parentElement: targetObject,
        addObjectIntent: 'Pma1Automation'
    };

    let activeView = droppedToView === 'CbaSplitSrcTree' ? appCtxService.ctx.splitView.viewKeys[ 0 ] : appCtxService.ctx.splitView.viewKeys[ 1 ];

    // Update the activeContext with the view to which the drop action performed on the target node
    aceContextStateMgmtService.updateActiveContext( activeView );
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
    aceAddElementService.processAddElementInput();
    var deferred = AwPromiseService.instance.defer();

    const context = {
        occContext: {
            productContextInfo: appCtxService.ctx.aceActiveContext.context.productContextInfo
        }
    };
    aceDefaultPasteHandler.addElement( sourceObjects, targetObject, context ).then(
        ( response ) => {
            if ( response.ServiceData && !response.ServiceData.partialErrors ) {
                // If usecase is DragAndDrop and reuse the occurrence, no newly element added.
                // ACE will not publish addElement.elementsAdded event, so it needs to publish 'pma1.reusedOccurrenceAdded' to update indicator
                // LCS - 1016911
                if( _isDragDropReusingOccurrenceCondition( response ) ) {
                    _handleDragDropForReuseOccurrence( response );
                }
            }

            deferred.resolve();
        },
        ( err ) => {
            if ( err ) {
                messagingSvc.showError( err.message );
            }
            deferred.reject( err );
        }
    );
};

//Clear the local dragged objects cache as soon as dran and drop action completes.
const _clearDragDataCache = () => {
    dragDataCache.draggedObjects = [];
    dragDataCache.draggedObjUids = [];
    dragDataCache.draggedFromView = null;
    dragDataCache.draggedObjectsPciInfo = [];
};

/**
 * Get all objects selected in drag action start
 * Fill up local cache containing dragged objects and their uids, The awDragData is not available in drop action handler in firefox browser.
 * From dragStart to dragEnd DnDParams.targetObjects holds dragged objects.
 * @returns {} .
 */
export const handleDragStart = ( dragAndDropParams ) => {
    if( dragAndDropParams && dragAndDropParams.targetObjects ) {
        dragDataCache.draggedObjects = dragAndDropParams.targetObjects;
        dragDataCache.draggedObjUids = dragAndDropParams.targetObjects.map( object => object.uid );

        dragDataCache.draggedFromView = dragAndDropParams.declViewModel._internal.viewId;
        dragDataCache.draggedObjectsPciInfo = dragAndDropParams.declViewModel.subPanelContext.provider.occContext.value.productContextInfo;
    } else {
        dragAndDropParams.event.preventDefault();
    }
};

/**
 * Get all objects selected to drop on target
 * @returns {Objects} Source objects that are being dropped.
 */
var _getDraggedObjects = function( ) {
    const sourceObjects = [];

    for( let i = 0; i < dragDataCache.draggedObjUids.length; i++ ) {
        if( dragDataCache.draggedObjUids[i] !== 'undefined' && dragDataCache.draggedObjUids[i] !== null ) {
            const draggedObject = clientDataModel.getObject( dragDataCache.draggedObjUids[ i ] );
            if( draggedObject !== undefined && draggedObject !== null ) {
                sourceObjects.push( draggedObject );
            }
        }
    }
    return sourceObjects;
};

/**
 * Get product context info for dragged object
 * @returns {object} Product context info for dragged object
 */
const _getDraggedObjectsPciInfo = () => {
    if( dragDataCache.draggedObjectsPciInfo ) {
        return dragDataCache.draggedObjectsPciInfo;
    }
    return null;
};

/**
 * Check if non-draggable object is present in given list.
 *
 * @param {List} objectList - Object list to check for non-draggable object
 * @returns {boolean} - True if non-draggable object present in the list else false.
 */
const isNonDraggableObjectPresent = function( objectList ) {
    // List of types not supported for drag.
    const nonDraggableObjects = [ 'Fgf0PartitionElement' ];
    for ( let index = 0; index < objectList.length; index++ ) {
        const obj = objectList[ index ];
        const isNonDraggableObject = obj.modelType.typeHierarchyArray.some( type => nonDraggableObjects.includes( type ) );
        if ( isNonDraggableObject ) {
            return true;
        }
    }
    return false;
};

/**
 * Check if target object is valid to drop upon in CBA page
 *
 * @param {List} targetObject Object to check
 * @returns {boolean} True if targetObject is valid to drop upon
 */
const isTargetObjectValidForDrop = function( targetObject ) {
    return targetObject ? CadBomOccurrenceAlignmentUtil.getObjectQualifierTypeFromVMO( targetObject ) !== cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN : false;
};

/**
 * "dropHandlers" are used to enable and customize the drop operation for a view and
 * the components inside it. If a dropHandler is activated for a certain view, then
 * the same dropHandler becomes applicable to all the components inside the view.
 * This means, we can handle any drop/dragEnter/dragOver operation for any component
 * inside a view at the view level. Not all the components used inside a view have
 * drop configured, when a dropHandler is active for a view.
 * The action associated bind-ed with drag actions is expected to be a synchronous
 * javascript action. we can only associate declarative action type syncFunction with
 * drag actions. At runtime the js function (bind-ed with drag action) receives a system
 * generated object as the last parameter of the function.
 *
 * For more info  :- http://swf/showcase/#/showcase/Declarative%20Configuration%20Points/dragAndDrop
 *
 * @param {default parameters for DnD} dragAndDropParams
 *
 * When top nodes selected and dragged, we want to disable drga-drop by assigning 'None' dropEffect in CBA UI.
 */
export const handleDropEffectBasedOnSrcSelection = ( dragAndDropParams ) => {
    if( dragAndDropParams && dragAndDropParams.targetObjects && dragAndDropParams.targetObjects.length > 0 ) {
        // Store view name where dragged object is being dropped
        droppedToView = dragAndDropParams.declViewModel._internal.viewId;
        // Dont allow drop in same view from where drag is perfomed
        let isSameView = dragDataCache.draggedFromView === droppedToView;
        if( !isSameView && !isNonDraggableObjectPresent( _getDraggedObjects() ) && isTargetObjectValidForDrop( dragAndDropParams.targetObjects[ 0 ] ) ) {
            return {
                dropEffect: 'copy',
                stopPropagation: true,
                preventDefault : true
            };
        }
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

export const isGenerateBOMActionEnabled = function() {
    return false;
};

/**
 * Prepares input needed by paste operation and Invokes paste event.
 * @param {default parameters for DnD} dragAndDropParams
 */
export const prepareSourceAndTargetObjsAndInvokePaste = ( dragAndDropParams ) => {
    const pasteInputData = [];
    var sourceObjects = [];
    sourceObjects = _getDraggedObjects();
    var srcProductContextInfo = _getDraggedObjectsPciInfo();
    _clearDragDataCache();

    pasteInputData.targetObject = dragAndDropParams.targetObjects[0];
    pasteInputData.sourceObjects = sourceObjects;
    pasteInputData.srcProductContextInfo = srcProductContextInfo;
    eventBus.publishOnChannel( {
        channel: 'paste',
        topic: 'drop',
        data: {
            pasteInput: [ pasteInputData ]
        }
    } );
};

/**
 * Determine whether the current situation is reusing occurrence from on drag and drop
 *
 * @param {Object} response - SOA response
 */
let _isDragDropReusingOccurrenceCondition = function( response ) {
    let isDragDropReusingOccurrenceCondition = false;

    let totalObjectsAdded = aceAddElementService.getTotalNumberOfChildrenAdded( response );
    if( totalObjectsAdded === 0 ) {
        //If only reuse occurrence case
        return true;
    }

    //reuse occurrence + new added case
    let targetView = appCtxService.getCtx( 'aceActiveContext.key' );
    let updatedUids = response.ServiceData.updated;
    let sourceView = cbaConstants.CBA_SRC_CONTEXT === targetView ? cbaConstants.CBA_TRG_CONTEXT : cbaConstants.CBA_SRC_CONTEXT;
    let selectedSourceLines = [];
    for( const updatedUid of updatedUids ) {
        if( sourceView === cbaConstants.CBA_SRC_CONTEXT && _.includes( updatedUid, 'SR::N::Awb0DesignElement' ) ||
                sourceView === cbaConstants.CBA_TRG_CONTEXT && _.includes( updatedUid, 'SR::N::Awb0PartElement' ) ) {
            selectedSourceLines.push( updatedUid );
        }
    }

    return  selectedSourceLines.length > totalObjectsAdded;
};

/**
 * Handle the logic when dragdrop for reuse occurrence.
 *
 * Example case:
 * D_Top             PTop                     (Have Occurrence Alignment & Have PartCad Alignment)
 *  D_skip            P_skip
 *   D_child           P_child                (No Occurrence Alignment & Have PartCad Alignment)
 * Action: Drag drop D_child to P_skip.
 *
 * @param {Object} response - SOA response
 */
let _handleDragDropForReuseOccurrence = function( response ) {
    let eventData = {
        objectsToSelect: aceAddElementService.getAddElementResponse( response ).newlyAddedChildElements,
        addElementResponse: response,
        addElementInput: appCtxService.ctx.aceActiveContext.context.addElement,
        viewToReact: appCtxService.getCtx( 'aceActiveContext.key' ),
        isReusingOccurrence: true
    };
    eventBus.publish( 'pma1.reusedOccurrenceAdded', eventData );
};

const exports = {
    addSrcBomToTgtBom,
    isGenerateBOMActionEnabled,
    handleDragStart,
    handleDropEffectBasedOnSrcSelection,
    prepareSourceAndTargetObjsAndInvokePaste
};

export default exports;
