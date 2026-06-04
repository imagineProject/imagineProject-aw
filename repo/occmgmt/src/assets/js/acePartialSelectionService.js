//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Records object to select and corresponding object to highlight data.
 * Provides services to set/remove partial selection in tree
 *
 * @module js/acePartialSelectionService
 */

import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import aceGetService from 'js/aceGetService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import awPromiseService from 'js/awPromiseService';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';
import logger from 'js/logger';

'use strict';

let exports = {};
let _contextKey = null;

let postGetOccFunc = function( response, finalOccContextValue, inputOccContext, treeLoadOutput, treeLoadInput, soaInput ) {
    if( treeLoadInput.dataProviderActionType === 'focusAction' && !_.isEmpty( soaInput.inputData.requestPref.selectedObject ) ) {
        let context = appCtxSvc.getCtx( inputOccContext.viewKey );
        let acePartialSelection = context.acePartialSelection;

        //For focus case, with objectToSelect-objectToHighlight information sent to server, server doesnt echo it back ( due to missing support/
        // SRUID changed etc.)
        //in that case, cleanup stale cache...otherwise, highlight on tree node remains in UI
        if ( treeLoadOutput.currentState.h_uid === treeLoadOutput.currentState.c_uid ) {
            acePartialSelection.partialSelectionInfo.delete( soaInput.inputData.requestPref.selectedObject[0] );
            appCtxSvc.updatePartialCtx( inputOccContext.viewKey + '.acePartialSelection', acePartialSelection );

            logger.warn( 'objectToHighlight-objectToSelect information passed to getOcc not honored.' );
        }
        return;
    }

    //Multi-select nodes, perform configuration change, only last selection remains in system.
    //This logic takes care of applying final selection ( pwaSelection ) after action and clear other selections from partial selection svc.
    //This fixes cases where node remains highlighted incorrectly in system ( LCS-1092427 - Failure related to Delta Response Cases )
    removePartialSelection( finalOccContextValue.pwaSelection, inputOccContext.pwaSelection, inputOccContext );
};

// Post getOccurrences response handler registration
let postGetOccConditionFunc = function( soaInput, treeLoadInput ) {
    if( treeLoadInput && ( treeLoadInput.dataProviderActionType === 'initializeAction' || treeLoadInput.dataProviderActionType === 'focusAction' ) ) {
        return true;
    }
    return false;
};

/**
  * Initialize
  * @param {contextKey} contextKey context key
*/
export let initialize = function( contextKey ) {
    _contextKey = contextKey;

    let resetStructureExtPoint = {
        key : 'acePartialSelectionServiceResetStructureHandler', //unique identifier
        condition: resetStructureConditionFunc
    };

    let postGetOccExtPoint = {
        key : 'partialSelectionSvcPostGetOccHandler', //unique identifier
        condition: postGetOccConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFunc
    };


    aceGetService.registerGetOccInputProvider( resetStructureExtPoint );
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccExtPoint );
};

// acePartialSelectionService reset structure handler registration
let resetStructureConditionFunc = function( _loadInput ) {
    if( _.isEqual( _loadInput.isResetRequest, true ) ) {
        // configuration reset requested, clear partial selection information
        clearPartialSelectionInTree( _contextKey );
    }
};

let evaluateIsUnpackCommandVisibility = function() {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    acePartialSelection.isPackedHiddenNodeSelected = false;
    for( const [ key, value ] of acePartialSelection.partialSelectionInfo.entries() ) {
        if (  key !== value ) {
            let visibleObject = cdm.getObject( value );
            if ( !_.isUndefined( visibleObject ) &&
                !_.isUndefined( visibleObject.props.awb0IsPacked ) &&
                visibleObject.props.awb0IsPacked.dbValues.length > 0 &&
                visibleObject.props.awb0IsPacked.dbValues[ 0 ] === '1' ) {
                //Set the isPackedHiddenNodeSelected only when selected object and object to highlight are different
                acePartialSelection.isPackedHiddenNodeSelected = true;
                break;
            }
        }
    }
    appCtxSvc.updateCtx( contextKey + '.acePartialSelection', acePartialSelection );
    aceContextStateMgmtService.updateActiveContext( contextKey );
};

export let removeHiddenNodesFromSelection = function( occContext ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if(   _.isUndefined( context ) || _.isUndefined( context.vmc ) || _.isUndefined( occContext ) || _.isUndefined( occContext.pwaSelection ) ) {
        return;
    }
    let size = occContext.pwaSelection.length;
    for( let inx = 0; inx < size; inx++ ) {
        let selected = occContext.pwaSelection[inx];
        // check if vm node exists for selection, else its hidden selection
        let isHiddenNode = context.vmc.findViewModelObjectById( selected.uid ) === -1;
        if( isHiddenNode === true ) {
            // need to remove hidden node from mselected.
            for( var ndx = 0; ndx < size; ndx++ ) {
                if( selected.uid === occContext.pwaSelection[ndx].uid ) {
                    occContext.pwaSelection.splice( ndx, 1 );
                    // after splice, array size is size-1
                    // And next element in the array (next to removed element) is now at inx index. Hence, decreasing inx to iterate over it.
                    size--;
                    inx--;
                    break;
                }
            }
        }
    }
};

export let restorePartialSelection = function() {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );

    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( context.vmc ) || _.isUndefined( appCtxSvc.ctx.mselected ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    _.forEach( appCtxSvc.ctx.mselected, function( selected ) {
        // check if vm node exists for selection, else its hidden selection
        let isHiddenNode = context.vmc.findViewModelObjectById( selected.uid ) === -1;

        if( isHiddenNode === true ) {
            // we have hidden node, we need to find corresponding visible node
            _.forEach( acePartialSelection.partialSelectionInfoCache, function( partialSelectionInfoCacheSet ) {
                if( partialSelectionInfoCacheSet.has( selected.uid ) === true ) {
                    _.forEach( Array.from( partialSelectionInfoCacheSet ), function( elementUid ) {
                        let isVisibleNode = context.vmc.findViewModelObjectById( elementUid ) !== -1;
                        if( isVisibleNode === true ) {
                            acePartialSelection.partialSelectionInfo.set( selected.uid, elementUid );
                            acePartialSelection.partialSelectionInfo.set( elementUid, elementUid );
                            return false; // break;
                        }
                    } );
                }
            } );
        }
    } );
};
/**
 * Set the partial selection on tree
 * @param {*} partialSelectionData partialSelectionData Info
 * @param {*} gridId GridId of grid who should listen to the scroll event
 * @param {*} contextKey View key
 */
export let setPartialSelection = function( partialSelectionData, gridId ) {
    let objectsToSelect = partialSelectionData.objectsToSelect;
    let objectsToHighlight = partialSelectionData.objectsToHighlight;

    if( _.isUndefined( objectsToSelect ) || _.isUndefined( objectsToHighlight ) ) {
        return;
    }

    let context = appCtxSvc.getCtx( partialSelectionData.viewToReact );
    if( _.isUndefined( context.acePartialSelection ) ) {
        context.acePartialSelection = {
            partialSelectionInfo: new Map(),
            partialSelectionInfoCache: [],
            isPackedHiddenNodeSelected: false
        };
    }

    if( objectsToSelect.length === 1 && objectsToHighlight.length === 1 && objectsToSelect[0].uid !== objectsToHighlight[0].uid && objectsToHighlight[0].uid !== cdm.NULL_UID ) {
        _setPartialSelectionInTree( context, objectsToSelect[0].uid );
    }
    let acePartialSelection = context.acePartialSelection;
    let partialSelectionChanged = false;
    let foundPartialSelection = false;

    for( let inx = 0; inx < objectsToSelect.length; inx++ ) {
        if( !_.isUndefined( objectsToHighlight[ inx ] ) ) {
            let objectToHighligh = cdm.getObject( objectsToHighlight[ inx ].uid );
            if( !_.isUndefined( objectToHighligh ) && objectToHighligh !== null ) {
                foundPartialSelection = true;
                partialSelectionChanged = true;
                acePartialSelection.partialSelectionInfo.set( objectsToSelect[ inx ].uid, objectsToHighlight[ inx ].uid );

                // update partialSelectionInfoCache
                let partialSelectionSetExist = false;
                _.forEach( acePartialSelection.partialSelectionInfoCache, function( partialSelectionInfoCacheSet ) {
                    if( partialSelectionInfoCacheSet.has( objectsToSelect[ inx ].uid ) ||
                        partialSelectionInfoCacheSet.has( objectsToHighlight[ inx ].uid ) ) {
                        partialSelectionSetExist = true;
                        partialSelectionInfoCacheSet.add( objectsToSelect[ inx ].uid );
                        partialSelectionInfoCacheSet.add( objectsToHighlight[ inx ].uid );
                        return false; // break
                    }
                } );
                if( partialSelectionSetExist === false ) {
                    let partialSelectionInfoCacheSet = new Set();
                    partialSelectionInfoCacheSet.add( objectsToSelect[ inx ].uid );
                    partialSelectionInfoCacheSet.add( objectsToHighlight[ inx ].uid );
                    acePartialSelection.partialSelectionInfoCache.push( partialSelectionInfoCacheSet );
                }
            }
        }
    }

    if( objectsToHighlight.length <= 0 || foundPartialSelection === false ) {
        // Deselection requested
        acePartialSelection.partialSelectionInfo.clear();
        partialSelectionChanged = true;
    }

    if( partialSelectionChanged === true ) {
        eventBus.publish( 'reRenderTableOnClient' );
        evaluateIsUnpackCommandVisibility();
        //if it is deselect use case then no need to trigger the scroll event
        if( objectsToHighlight.length > 0 ) {
            let eventData = {};
            eventData.rowUids = [ objectsToHighlight[objectsToHighlight.length - 1].uid ];
            eventData.gridId = gridId;
            eventBus.publish( 'plTable.scrollToRow', eventData );
        }
    }
};


/**
 * Check if given node has multiple entries against it. If yes, it is PackMaster)
 * @param {*} objectUid Object UID
 */

var _isProvidedSelectionPackedMaster = function( objectUid, contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    let numberOfEntriesForGivenObject = 0;

    for( const [ key, value ] of context.acePartialSelection.partialSelectionInfo.entries() ) {
        if( !_.isUndefined( value ) && value === objectUid ) {
            numberOfEntriesForGivenObject++;
        }
    }

    return numberOfEntriesForGivenObject > 1;
};

export let removePartialSelection = function( newSelections, oldSelections, occContext ) {
    if( _.isUndefined( newSelections ) || _.isUndefined( oldSelections ) || !_.isArray( oldSelections ) ) {
        return;
    }

    let contextKey = occContext ? occContext.viewKey : appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    let removedSelections = _.filter( oldSelections, function( oldSelection ) {
        return !_.includes( newSelections, oldSelection );
    } );
    let partialSelectionChanged = false;
    let packNonMasterToBeClearedFromSelection = false;
    for( let inx = 0; inx < removedSelections.length; ++inx ) {
        //If de-select has happened from tree and not as result of selection sync from 3D/Find Panel.

        if( isPartiallySelected( removedSelections[ inx ].uid, contextKey ) ) {
            partialSelectionChanged = true;
            let objectsToHighlightUids = occContext && occContext.transientRequestPref && occContext.transientRequestPref.objectsToHighlightUids || [];

            //1) ( Use-case-> Select All from AreaSelect in 3D (ACE_PACK_JT), de-select master from tree)
            //2) Counter use-case that was broken because of 1) was de-select pack-master from Find Panel when user selects non-packmaster under it..
            if( _isProvidedSelectionPackedMaster( removedSelections[ inx ].uid, contextKey ) ) {
                let isRemovedPackedMasterPartOfHightlightForNewSelections = objectsToHighlightUids.includes( removedSelections[inx].uid );
                if( !isRemovedPackedMasterPartOfHightlightForNewSelections ) {
                    //If PackMaster is getting de-selected from Tree, de-select its non-master nodes also ( that's the behavior between Tree & 3D )
                    for( const [ packNonMasterOrMasterUid, packMasterNodeUid ] of context.acePartialSelection.partialSelectionInfo.entries() ) {
                        if( !_.isUndefined( packMasterNodeUid ) && packMasterNodeUid === removedSelections[ inx ].uid ) {
                            acePartialSelection.partialSelectionInfo.delete( packNonMasterOrMasterUid );
                            //Remove packNonMaster from provided selections
                            _.remove( newSelections, cdm.getObject( packNonMasterOrMasterUid ) );
                            packNonMasterToBeClearedFromSelection = true;
                        }
                    }
                }
            }
            acePartialSelection.partialSelectionInfo.delete( removedSelections[ inx ].uid );
        }
    }
    if( partialSelectionChanged === true || newSelections.length === 0 ) {
        eventBus.publish( 'reRenderTableOnClient' );
        //in certain cases, re-render table event is not good enough to update tree/execute all its renderers...( LCS-1156511 )...
        //updating tree nodes for that case to trigger render cycle.
        occContext.vmc.update( occContext.vmc.getLoadedViewModelObjects() );
        evaluateIsUnpackCommandVisibility();
    }

    return packNonMasterToBeClearedFromSelection ? newSelections : null;
};

export let isPartiallySelected = function( elementUid, contextKey ) {
    contextKey = !_.isUndefined( contextKey ) ? contextKey : appCtxSvc.ctx.aceActiveContext.key;
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }
    return context.acePartialSelection.partialSelectionInfo.has( elementUid );
};

export let isPartiallySelectedInTree = function( elementUid, contextKey ) {
    contextKey = !_.isUndefined( contextKey ) ? contextKey : appCtxSvc.ctx.aceActiveContext.key;
    let context = appCtxSvc.getCtx( contextKey ); //$NON-NLS-1$
    var isNodeVisibleInTree = context.vmc.findViewModelObjectById( elementUid ) !== -1;
    if( !isNodeVisibleInTree ) {
        //If the node is not visible it may be hidden under packed visible node
        var visibleUid = context.acePartialSelection.partialSelectionInfo.get( elementUid );
        // In the event of a partition scheme change, the SR UID of the element changes, as a result its necessary to get the bomline UID to locate the corresponding element.
        // If there is at least one element that includes it, it signifies that the bomline is a member under a partition and is already loaded in the tree.
        // In this case, there is no requirement for the focus Action getOccurrence call.
        //TODO: The below logic will need to remove once getOcc SOA start returning the visible element and hidden element in the tree as a part of focus element.
        const visibleNodeBackingObject = aceBackingObjectProviderService.getBackingObjectsSync( [ cdm.getObject( visibleUid ) ] );
        let loadedVMOs = context.vmc.getLoadedViewModelObjects();
        var isElementVisible = _.filter( aceBackingObjectProviderService.getBackingObjectsSync( loadedVMOs ), function( backingObject ) {
            return backingObject.uid === visibleNodeBackingObject[0].uid;
        } );
    }
    if( isNodeVisibleInTree || isElementVisible && isElementVisible.length > 0 ) {
        return true;
    }
    _setPartialSelectionInTree( context, elementUid );
    return false;
};

/**
 * Function to populate acePartialSelection with unpacked or hidden node
 *
 * @param {object} context current context
 * @param {elementUid} elementUid of the unpacked or hidden node
 */
let _setPartialSelectionInTree = function( context, elementUid ) {
    context.acePartialSelection.hiddenNode = null;
    context.acePartialSelection.hiddenNode = elementUid;
    context.transientRequestPref.focusSelectionFromViz = true;
};

/**
 * Function to clear acePartialSelection with unpacked or hidden node
 *
 * @param {contextKey} contextKey context key
 */
export let clearPartialSelectionInTree = function( contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    if( context.acePartialSelection ) {
        delete context.acePartialSelection;
        appCtxSvc.updateCtx( contextKey, context );
        eventBus.publish( 'reRenderTableOnClient' );
    }
};

let _doesContainHiddenPackedSelection = function( context ) {
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( context.acePartialSelection.hiddenNode ) ) {
        return false;
    }
    return context.acePartialSelection.hiddenNode !== null;
};

export let doesContainHiddenPackedSelectionBasedOnPCI = function( pci_uid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( !_.isUndefined( pci_uid ) ) {
        var productCtx = cdm.getObject( pci_uid );
        if( productCtx  && !_.isUndefined( productCtx.props ) && !_.isUndefined( productCtx.props.awb0WindowStateToggles ) && productCtx.props.awb0WindowStateToggles.dbValues[ 0 ] ) {
            let windowToggles = productCtx.props.awb0WindowStateToggles.dbValues[ 0 ];
            let isPacked = occMgmtStateHandler.getPackedState( windowToggles );
            if( isPacked && context && context.acePartialSelection ) {
                let newAcePartialSelection = context.acePartialSelection;
                newAcePartialSelection.hiddenNode = null;
                appCtxSvc.updatePartialCtx( contextKey + '.acePartialSelection', newAcePartialSelection );
                return false;
            }
        }
    }
    return _doesContainHiddenPackedSelection( context );
};

export let doesContainPartialSelections = function( elements ) {
    let isPartialSelection = false;
    _.forEach( elements, function( element ) {
        if( !_.isUndefined( element ) && isPartiallySelected( element.uid ) ) {
            isPartialSelection = true;
            return false; // break
        }
    } );
    return isPartialSelection;
};

export let isHiddenNodePresentInPartialSelection = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }
    if( context.acePartialSelection.partialSelectionInfo.has( elementUid ) ) {
        let visibleUid = context.acePartialSelection.partialSelectionInfo.get( elementUid );
        return visibleUid !== elementUid; // hidden node will have different visible node.
    }
    return false;
};

/**
 * Checks if given pack master node is present in partialSelectionInfo entries
 *
 * @param {elementUid} elementUid element uid of pack master
 * @param {contextKey} contextKey context key
 */
export let isGivenNodeHighlightedPackMaster = function( elementUid, contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }

    for( const [ key, value ] of context.acePartialSelection.partialSelectionInfo.entries() ) {
        if( !_.isUndefined( value ) && value === elementUid ) {
            return true;
        }
    }
    return false;
};

export let getVisibleNodeForHiddenNodeInPartialSelection = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return;
    }

    if( context.acePartialSelection.partialSelectionInfo.has( elementUid ) ) {
        return context.acePartialSelection.partialSelectionInfo.get( elementUid );
    }
};

let partialSelectionRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        if( rowElem && isGivenNodeHighlightedPackMaster( vmo.uid, vmo.contextKey ) === true ) {
            rowElem.classList.add( 'aw-occmgmtjs-partialSelection' );
        }else{
            rowElem.classList.remove( 'aw-occmgmtjs-partialSelection' );
        }
        return cellContent;
    },
    condition: function( column, vmo, tableElem, rowElem ) {
        return isGivenNodeHighlightedPackMaster( vmo.uid, vmo.contextKey ) === true || rowElem && rowElem.classList.contains( 'aw-occmgmtjs-partialSelection' );
    },
    name: 'partialSelectionRenderer'
};

export let getObjectsToHighlightForGivenObjects = function( inputObjects ) {
    let deferred = awPromiseService.instance.defer();
    aceBackingObjectProviderService.getBackingObjects( inputObjects ).then( function( bomlinesResponse ) {
        var bomlineSRUIDs = [];
        let objectsToSelect = [];
        let objectsToHighlight = [];
        let selectionsInfo = {};

        _.forEach( bomlinesResponse, function( bomLine, index ) {
            if ( bomLine && bomLine.uid ) {
                bomlineSRUIDs[ index ] = bomLine.uid;
            }
        } );

        if ( bomlineSRUIDs.length > 0 ) {
            csidsToObjSvc.doPerformSearchForProvidedSRUIDs( bomlineSRUIDs, 'true' ).then( function( response ) {
                _.forEach( response.elementsInfo, function( elementInfo ) {
                    objectsToSelect.push( elementInfo.element );
                    objectsToHighlight.push( elementInfo.visibleElement );
                } );

                selectionsInfo.elementsToSelect = objectsToSelect;
                selectionsInfo.objectsToHighlight = objectsToHighlight;
                deferred.resolve( selectionsInfo );
            } );
        }else{
            selectionsInfo.elementsToSelect = inputObjects;
            deferred.resolve( selectionsInfo );
        }
    } );
    return deferred.promise;
};

export default exports = {
    initialize,
    setPartialSelection,
    clearPartialSelectionInTree,
    removePartialSelection,
    removeHiddenNodesFromSelection,
    restorePartialSelection,
    isPartiallySelected,
    isPartiallySelectedInTree,
    doesContainHiddenPackedSelectionBasedOnPCI,
    doesContainPartialSelections,
    isHiddenNodePresentInPartialSelection,
    isGivenNodeHighlightedPackMaster,
    getVisibleNodeForHiddenNodeInPartialSelection,
    partialSelectionRenderer,
    getObjectsToHighlightForGivenObjects
};
