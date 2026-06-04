// Copyright (c) 2022 Siemens

/**
 * @module js/aceChangeService
 */
import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtGetSvc from 'js/aceGetService';

var exports = {};

var _aceElementRemovedEvent = null;

var _aceElementDragDropEvent = null;

/**
 * Related the children based on input element.
 *
 * @param {String} currentParent Parent element that need to be reloaded
 */
var _reloadParent = function( currentParent, isRemoveUnderDifferentParents, parents ) {
    if( !currentParent ) {
        return;
    }
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    let eventData = {
        objectsToSelect: [ currentParent ],
        viewToReact: contextKey,
        nodeToExpandAfterFocus: currentParent.uid,
        getOccSoaInput: soaInput
    };
    if( isRemoveUnderDifferentParents ) {
        eventData.isRemoveUnderDifferentParents = true;
        eventData.parents = parents;
    }
    eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', eventData );
};

/**
 * Initializes Change service.
 */
export let initialize = function() {
    if( _aceElementRemovedEvent === null ) {
        _aceElementRemovedEvent = eventBus.subscribe( 'ace.elementsRemoved', function( eventData ) {
            var operationName = '';
            if( eventData.operationName ) {
                operationName = eventData.operationName;
            }

            if( occmgmtUtils.isTreeView() && operationName === 'removeElement'
                && ( appCtxSvc.ctx.occmgmtContext && appCtxSvc.ctx.occmgmtContext.isChangeEnabled ) ) {
                if( eventData.removedObjects?.length > 0 ) {
                    let parentSet = new Set();
                    _.forEach( eventData.removedObjects, function( removedObject ) {
                        parentSet.add( cdmSvc.getObject (occmgmtUtils.getParentUid( removedObject )) );
                    } );
                    let parents = Array.from( parentSet );
                    if(parents.length === 1) {
                        _reloadParent( parents[ 0 ] );
                    }
                    else {
                        // handling remove of multiple objects under different parents
                        parents.forEach(parent => {
                            _reloadParent(parent, true /* isRemoveUnderDifferentParents */, parents);
                        });
                    }
                }
            }
        } );
    }
    if( _aceElementDragDropEvent === null ) {
        _aceElementDragDropEvent = eventBus.subscribe( 'ace.elementsMoved', function() {
            if( occmgmtUtils.isTreeView() && appCtxSvc.ctx.occmgmtContext.isChangeEnabled &&
                appCtxSvc.ctx.aceActiveContext.context.addElementInput &&
                appCtxSvc.ctx.aceActiveContext.context.addElementInput.parentElement ) {
                _reloadParent( appCtxSvc.ctx.aceActiveContext.context.addElementInput.parentElement );
            }
        } );
    }
};

export let destroy = function() {
    if( _aceElementRemovedEvent ) {
        eventBus.unsubscribe( _aceElementRemovedEvent );
        _aceElementRemovedEvent = null;
    }

    if( _aceElementDragDropEvent ) {
        eventBus.unsubscribe( _aceElementDragDropEvent );
        _aceElementDragDropEvent = null;
    }
};

/**
 * Show BOM Change Configuration service utility
 * @param {appCtxService} appCtxSvc - Service to use
 * @param {occmgmtUtils} occmgmtUtils - Service to use
 * @returns {object} - object
 */

export default exports = {
    initialize,
    destroy
};
