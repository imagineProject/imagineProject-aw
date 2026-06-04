// Copyright (c) 2022 Siemens

/**
 * @module js/aceDefaultCutCopyService
 */
import appCtxService from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import aceViewModelTreeNodeCreateService from 'js/aceViewModelTreeNodeCreateService';

var exports = {};
var _cutVMOs = [];
var _awClipBoardUpdateEventSubscription = null;
var _addElementListener = null;
var _replaceElementListener = null;

var _setGreyOut = function( pwaSelection, vmc, dataProvider ) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    var temp = [];
    //set isPendingCut prop on VMO true
    for( var selection in pwaSelection ) {
        var index = vmc.findViewModelObjectById( pwaSelection[ selection ].uid );
        if( index !== -1 ) {
            loadedVMObjects[ index ].isPendingCut = true;
            temp.push( loadedVMObjects[ index ] );
        }
    }

    //need to check why we are caching this.
    if( !_.isEmpty( temp ) ) {
        _cutVMOs = temp;
    }

    dataProvider.update( loadedVMObjects );
    // refresh the pltable
    var eventData = { refreshAllViews: true };
    eventBus.publish( 'reRenderTableOnClient', eventData );
};

var _resetCutAction = function() {
    // if cut after cut -->keep greyout
    // if copy after cut --> remove greyout
    if( appCtxService.ctx.cutIntent && appCtxService.ctx.cutIntent === true ) {
        appCtxService.unRegisterCtx( 'cutIntent' );

        //already pending for cut ? make it false
        if( !_.isEmpty( _cutVMOs ) ) {
            var parentLine = null;
            var isSelectionFromDiffParent = false;
            for( var ndx in _cutVMOs ) {
                if( _cutVMOs[ ndx ].isPendingCut ) {
                    let cutNode = _cutVMOs[ ndx ];
                    let context = appCtxService.ctx[ cutNode.contextKey ];
                    if( context && context.vmc ) {
                        let vmTreeNodeIndex = context.vmc.findViewModelObjectById( _cutVMOs[ ndx ].uid );
                        let vmTreeNode = context.vmc.getViewModelObject( vmTreeNodeIndex );
                        delete vmTreeNode?.isPendingCut;
                        let parentTreeNodeIndex = context.vmc.findViewModelObjectById( cutNode.parentUid );
                        if( parentLine !== null && parentLine !== context.vmc.getViewModelObject( parentTreeNodeIndex ) ) {
                            isSelectionFromDiffParent = true;
                        }
                        parentLine = context.vmc.getViewModelObject( parentTreeNodeIndex );
                    }
                    delete _cutVMOs[ ndx ].isPendingCut;
                }
            }

            // In splitview, when we perform cut-paste operation then ( in non splitview mode the focus changed to paste target element )
            // Cut single element --> Parent element selected
            // Cut multiple element from same parent --> Parent element selected
            // Cut multiple element from different parent --> Top element selected
            if( !_.isUndefined( appCtxService.ctx.splitView ) && appCtxService.ctx.splitView.mode === true && parentLine !== null ) {
                var parentElement = null;
                if( isSelectionFromDiffParent === false ) {
                    parentElement = parentLine;
                } else {
                    parentElement = appCtxService.ctx[ _cutVMOs[0].contextKey ].topElement;
                }
                eventBus.publish( 'aceElementsSelectionUpdatedEvent', {
                    objectsToSelect: [ parentElement ],
                    viewToReact: _cutVMOs[0].contextKey
                } );
            }
        }
        var eventData = { refreshAllViews: true };
        eventBus.publish( 'reRenderTableOnClient', eventData );
    }
};

const NodeGreyOutHandler = {
    key: 'greyOutNode',
    callbackFunction: ( vmNode ) => {
        _.each( _cutVMOs, ( cutVmo ) => {
            if( cutVmo.isPendingCut && cutVmo.uid === vmNode.uid ) {
                vmNode.isPendingCut = true;
            }
        } );
    },
    condition: ( treeLoadInput ) => {
        if( treeLoadInput === undefined || ( treeLoadInput.dataProviderActionType === 'initializeAction' && treeLoadInput.openOrUrlRefreshCase !== 'backButton' || treeLoadInput.isResetRequest ===
                true ) ) { return false; }
        return true;
    }
};

var _initializeEventSubscriptions = () => {
    //subscribe to clipboard change event for remove greyout after cut/copy toggle
    if( !_awClipBoardUpdateEventSubscription ) {
        _awClipBoardUpdateEventSubscription = eventBus.subscribe( 'appCtx.register', ( eventData ) => {
            if( eventData.name === 'awClipBoardProvider' ) {
                _resetCutAction();
            }
        } );
    }

    //subscribe to addElement event for remove greyout after element added from add panel
    if( !_addElementListener ) {
        _addElementListener = eventBus.subscribe( 'addElement.elementsAdded', function() {
            if( appCtxService.ctx.cutIntent ) {
                _resetCutAction();
            }
        } );
    }

    //subscribe to addElement event for remove greyout after element added from add panel
    if( !_replaceElementListener ) {
        _replaceElementListener = eventBus.subscribe( 'replaceElement.elementReplacedSuccessfully', function() {
            if( appCtxService.ctx.cutIntent ) {
                _resetCutAction();
            }
        } );
    }
    aceViewModelTreeNodeCreateService.registerTreeNodeHandler( NodeGreyOutHandler );
};

export let aceCutContentsToClipboard = function( occContext ) {
    _initializeEventSubscriptions();
    // call set content
    ClipboardService.instance.setContents( occContext.pwaSelection );
    _cutVMOs = [];
    //apply cut on new vmo
    _setGreyOut( occContext.pwaSelection, occContext.vmc, occContext.treeDataProvider );
    //populate cut intent
    appCtxService.updatePartialCtx( 'cutIntent', true );
};

/**
 * post successful paste clear out the cut action
 */
export let acePostPasteAction = function() {
    _resetCutAction();
    //empty the clipboard
    ClipboardService.instance.setContents();

    // post paste complete lifycycle of all events and unsubscribe them
    if( _awClipBoardUpdateEventSubscription ) {
        eventBus.unsubscribe( _awClipBoardUpdateEventSubscription );
        _awClipBoardUpdateEventSubscription = null;
    }

    if( _addElementListener ) {
        eventBus.unsubscribe( _addElementListener );
        _addElementListener = null;
    }

    if( _replaceElementListener ) {
        eventBus.unsubscribe( _replaceElementListener );
        _replaceElementListener = null;
    }

    aceViewModelTreeNodeCreateService.unRegisterTreeNodeHandler( NodeGreyOutHandler );
};

/**
 * when leaving occmgmt clear the service
 */

export let destroy = function() {
    // destroy all subscription except _treeReloadCompleteEvent which we need to reinitialize subscriptions post tree reload
    // when navigating back into ace

    if( _addElementListener ) {
        eventBus.unsubscribe( _addElementListener );
        _addElementListener = null;
    }

    if( _replaceElementListener ) {
        eventBus.unsubscribe( _replaceElementListener );
        _replaceElementListener = null;
    }
};

export default exports = {
    aceCutContentsToClipboard,
    acePostPasteAction,
    destroy
};
