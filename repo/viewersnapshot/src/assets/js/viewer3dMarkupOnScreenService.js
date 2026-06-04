// Copyright (c) 2022 Siemens

/**
 * Note: This module controls user adding On Screen 3D markups.
 *
 * @module js/viewer3dMarkupOnScreenService
 */
import appCtxSvc from 'js/appCtxService';
import markupService from 'js/Awp0MarkupService';
import markupModel from 'js/MarkupModel';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import viewerContextService from 'js/viewerContext.service';

var exports = {};

var _vsOpenCloseSubscriber = null;
var _vsAWWindowResizeSubscriber = null;
var _vsFullScreenEventSubscriber = null;

// Locale variables
var addAnnotationButtonLabel = '';
var addAnnotationErrorMsg = '';
var clearAnnotationsErrorMsg = '';


localeSvc.getTextPromise( 'ViewerSnapshotMessages', true ).then( function( i18n ) {
    addAnnotationButtonLabel = i18n[ '3dOnScreenAddAnnotationButtonLabel' ];
    addAnnotationErrorMsg = i18n[ '3dOnScreenAddAnnotationErrorMsg' ];
    clearAnnotationsErrorMsg = i18n[ '3dOnScreenClearAnnotationsErrorMsg' ];
} );

//-----------------------------------------------------------------------------
/**
 * The OpenClose event is triggered twice, once for an open, and once for a close.  On the close, this happens for
 * both the clicking of the create button, or clicking of the close[x] button.  We'll handle either case the same way
 * by cleaning up the markup environment and getting ready for creation of another markup.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 * @param {Object} data view model data
 */
function _VSOpenCloseEventHandler( vmo, viewerContextData, data ) { //awsidenav.openClose
    let OS3dMrkpCtx = getOnScreen3dMarkupContext( viewerContextData );

    if ( data.commandId === 'Awp0MarkupEditMain' && data.command !== undefined ) { // The markup panel is opening
        OS3dMrkpCtx.isMarkupPanelOpen = !OS3dMrkpCtx.isMarkupPanelOpen;

        if( !OS3dMrkpCtx.isMarkupPanelOpen ) { // If the panel is closing, assure proper state of the tool.  (Nothing to do on open)
            onScreen3dSetTool( vmo, viewerContextData, null );
        }
    } else if ( data.commandId === 'Awp0MarkupEditMain' && data.command === undefined ) { //Panel is closing
        if ( OS3dMrkpCtx.isMarkupPanelOpen === true ) { // may get this event twice, so only do this if panel is open and then closing the first time
            OS3dMrkpCtx.isMarkupPanelOpen = false;
            onScreen3dSetTool( vmo, viewerContextData, null );
        }
    } else { // Another panel is being opened or closed, such as the Image Gallery
        OS3dMrkpCtx.isMarkupPanelOpen = false;

        if ( OS3dMrkpCtx.otherPanelName === '' ) { //opening new other panel, no other panel is open
            OS3dMrkpCtx.otherPanelName = data.commandId;
            OS3dMrkpCtx.isOtherPanelOpen = true;
            onScreen3dSetTool( vmo, viewerContextData, null ); // Clear the tool and start over
        } else if ( OS3dMrkpCtx.otherPanelName === data.commandId ) { //closing opened other panel
            OS3dMrkpCtx.isOtherPanelOpen = false;
            OS3dMrkpCtx.otherPanelName = '';
        } else { // switching to another other panel, so an other panel is still open
            OS3dMrkpCtx.otherPanelName = data.commandId;
            OS3dMrkpCtx.isOtherPanelOpen = true;
        }
    }
}

//-----------------------------------------------------------------------------
/**
 * Subscribe to the events that are of interest while in the 3d markup context, such as button presses
 * that take the user out of the context of creating a markup, opening/closing side panels and
 * window resize.
 * On receipt of these events, the context and markup system may need to be cleaned up.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 */
function addHandlersForImportantEvents( vmo, viewerContextData ) {
    if ( viewerContextData ) { // ask to be notified that we should close 3d markup toolbar
        viewerContextData.get3DMarkupManager().add3dMarkupToolbarCloseListener( cleanup3dToolbarListener );
    }

    if( !_vsOpenCloseSubscriber ) {
        _vsOpenCloseSubscriber = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
            _VSOpenCloseEventHandler( vmo, viewerContextData, eventData );
        } );
    }
    if( !_vsAWWindowResizeSubscriber ) {
        _vsAWWindowResizeSubscriber = eventBus.subscribe( 'aw.windowResize', function() { // No event data is passed
            onScreen3dSetTool( vmo, viewerContextData, null ); // Clear the tool and start over
        } );
    }
    if( !_vsFullScreenEventSubscriber ) {
        _vsFullScreenEventSubscriber = eventBus.subscribe( 'commandBarResized', function() { // No event data is passed
            onScreen3dSetTool( vmo, viewerContextData, null ); // Clear the tool and start over
            closeToolsAndInfoPanel( viewerContextData ); // Close Panel via event (before removing the handlers)
        } );
    }
}

/**
* Notification that 3d Markup toolbar should be closed
*/
function cleanup3dToolbarListener( viewerContextData ) {
    markupService.selectTool( null, undefined ); // this will hide markup canvas
    unRegisterOnScreen3dMarkupContext();
    removeHandlersForImportantEvents( viewerContextData );
    closeToolsAndInfoPanel( viewerContextData ); // Close the markup panel
}

//-----------------------------------------------------------------------------
/**
 * While in the 3d markup context we're interested in certain events.
 * This function removes the handlers that we registered.
 * @param {Object} viewerContextData viewer context data
 */
function removeHandlersForImportantEvents( viewerContextData ) {
    if( _vsOpenCloseSubscriber ) {
        eventBus.unsubscribe( _vsOpenCloseSubscriber );
        _vsOpenCloseSubscriber = null;
    }

    if( _vsAWWindowResizeSubscriber ) {
        eventBus.unsubscribe( _vsAWWindowResizeSubscriber );
        _vsAWWindowResizeSubscriber = null;
    }

    if( _vsFullScreenEventSubscriber ) {
        eventBus.unsubscribe( _vsFullScreenEventSubscriber );
        _vsFullScreenEventSubscriber = null;
    }

    if ( viewerContextData ) {
        viewerContextData.get3DMarkupManager().remove3dMarkupToolbarCloseListener( cleanup3dToolbarListener );
    }
}

//-----------------------------------------------------------------------------
/**
 * The onScreen3dMarkupContext is responsible for holding the state related to markup including
 * the tool in use, panels opened or closed, etc.
 *
 * @param { ViewModelObject } vmo - the viewModelObject
 * @param { String } viewerType - this viewer type: 'aw-onscreen-3d-markup-viewer'
 */
function registerOnScreen3dMarkupContext( vmo, viewerType ) {
    var viewerCtx = appCtxSvc.getCtx( 'viewerContext' );

    if( viewerCtx ) {
        viewerCtx.vmo = vmo;
        viewerCtx.type = viewerType;
        appCtxSvc.updateCtx( 'viewerContext', viewerCtx );
    } else {
        appCtxSvc.registerCtx( 'viewerContext', { vmo: vmo, type: viewerType } );
    }
}

//-----------------------------------------------------------------------------
/** Register the onScreen3dMarkupContext with the application context service. */
function unRegisterOnScreen3dMarkupContext() {
    appCtxSvc.unRegisterCtx( 'viewerContext' );
}

//-----------------------------------------------------------------------------
/** Get the onScreen3dMarkupContext from the application context service.
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} onScreen3dMarkupContext object from viewer atomic data
*/
function  getOnScreen3dMarkupContext( viewerContextData ) {
    if( viewerContextData ) {
        return viewerContextData.getValueOnViewerAtomicData( 'onScreen3dMarkupContext' );
    }
    return null;
}

/**
 * update 3d markup context
 * @param {Object} viewerContextData viewer context data
 * @param {String} path property path
 * @param {Object/String} value property value
 */
function updateOnScreen3dMarkupContext( viewerContextData, path, value ) {
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( path, value );
    }
}

//-----------------------------------------------------------------------------
/**
 * Set the override functions
 *
 * @param { String } viewerType - this viewer type: 'aw-onscreen-3d-markup-viewer'
 * @param {Object} viewerContextData viewer context data
 */
function setOverrideFunctions( viewerType, viewerContextData ) {
    const response = {
        version: '',
        message: 'author',
        markups: '[]'
    };

    markupService.setOverrideLoad( viewerType, function() {
        markupService.processMarkups( response );
    } );

    markupService.setOverrideSave( viewerType, function( baseObject, version, markup ) {
        const json = '[' + markupModel.stringifyMarkup( markup ) + ']';
        const container = document.getElementById( 'awStructureViewer' );
        const canvas = container.getElementsByTagName( 'canvas' );
        const rect = canvas && canvas.length > 0 ? canvas[0] : container.getBoundingClientRect();
        viewerContextData.get3DMarkupManager().addAnnotationLayer( json, rect.clientHeight, rect.clientWidth )
            .then( function() {
            // do nothing at this time for success result
            }, function() {
                messagingService.showError( addAnnotationErrorMsg );
            } );

        markupService.processMarkups( response );
    } );

    markupService.setOverrideUiOptions( viewerType, function( baseObject, version, markup ) {
        let options = {
            showTextTab: false,
            showStyleTab: true,
            showCreateStamp: false,
            showOnPageVisible: false,
            applyOnPageVisible: false,
            showShareAs: false,
            allowCorner: false,
            allowInsertImage: false,
            saveButtonText: addAnnotationButtonLabel
        };

        if( markup && markup.geometry && markup.geometry.list && markup.geometry.list.length === 1 ) {
            const geom = markup.geometry.list[0];
            if( geom.shape === 'rectangle' ) {
                markup.showOnPage = 'all';
                options.showTextTab = true;
                options.applyOnPageVisible = true;
            }
        }

        return options;
    } );
}

//-----------------------------------------------------------------------------
/** Close any tools and info panels open. */
function closeToolsAndInfoPanel( viewerContextData ) {
    viewerContextData.closeActiveDialog();
}

//-----------------------------------------------------------------------------
// Exported markup functions
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
/**
 * Entry point for the 3dOnScreen markup toolbar and context.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 */
export let onScreen3dStartMarkup = function( vmo, viewerContextData ) {
    if( !vmo || !viewerContextData ) {
        return;
    }
    viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_CREATE_MARKUP_BEGIN );

    let  onScreen3dMarkupContext = getOnScreen3dMarkupContext( viewerContextData );
    onScreen3dMarkupContext.isMarkupPanelOpen = false;
    onScreen3dMarkupContext.isOtherPanelOpen =  false;
    onScreen3dMarkupContext.otherPanelName =  '';
    onScreen3dMarkupContext.tool = null;
    onScreen3dMarkupContext.display3dMarkupToolbar = !onScreen3dMarkupContext.display3dMarkupToolbar;
    updateOnScreen3dMarkupContext( viewerContextData, 'onScreen3dMarkupContext', onScreen3dMarkupContext );

    closeToolsAndInfoPanel( viewerContextData ); // Close Panel if any open

    const viewerType = 'aw-onscreen-3d-markup-viewer';
    if( onScreen3dMarkupContext.display3dMarkupToolbar ) {
        setOverrideFunctions( viewerType, viewerContextData );
        registerOnScreen3dMarkupContext( vmo, viewerType );
        var viewerCtx = appCtxSvc.getCtx( 'viewerContext' );
        markupService.setContext( viewerCtx );
        onScreen3dSetTool( vmo, viewerContextData, 'freehand' ); // make freehand default tool and enable it
        addHandlersForImportantEvents( vmo, viewerContextData );
    } else {
        onScreen3dSetTool( vmo, viewerContextData, null );
        unRegisterOnScreen3dMarkupContext();
        removeHandlersForImportantEvents( viewerContextData );
    }
    viewerContextService.setDefaultActionNavigation( viewerContextData );
};

//-----------------------------------------------------------------------------
/**
 * This function processes the user input of wanting to remove all active markups.
 * @param {Object} commandContext command context
 */
export let onScreen3dRemoveAllAnnotations = function( commandContext ) {
    commandContext.viewerContextData.get3DMarkupManager().removeAllAnnotationLayer()
        .then( function() {
            // do nothing at this time for success result
        }, function() {
            messagingService.showError( clearAnnotationsErrorMsg ); // error occurred
        } );
};

//-----------------------------------------------------------------------------
/**
 * Selection of the tool & subTool.  This handles the various states and transitions when selecting
 * different tools, taking into account other state such as open panels in the onScreen3dMarkupContext.
 * Current tool state must be one of "none", "freehand", or "shape".  Incoming data to trigger a transition
 * can be one of those, plus the subtool of the markup shape tool.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 * @param {String} tool tool
 * @param {String} subTool subtool
 */
export let onScreen3dSetTool = function( vmo, viewerContextData, tool, subTool ) {
    let OS3dMrkpCtx = getOnScreen3dMarkupContext( viewerContextData );
    if( !OS3dMrkpCtx || !vmo || !viewerContextData ) {
        return;
    }

    if( OS3dMrkpCtx.isMarkupPanelOpen ) {
        closeToolsAndInfoPanel( viewerContextData ); // Close the markup panel
        return;
    } else if( OS3dMrkpCtx.isOtherPanelOpen ) {
        closeToolsAndInfoPanel( viewerContextData ); // Close any right-hand panel before continuing to enable markup
        // and continue. . .
    }

    if(  tool === 'shape'  &&  subTool !== 'rectangle'  &&  subTool !== 'ellipse'  &&  subTool !== 'arrow'  ) {
        // Default and/or catch unintended lack of shape
        subTool = 'rectangle';
    }

    let newTool = OS3dMrkpCtx.tool === tool && OS3dMrkpCtx.subTool === subTool ? null : tool;

    let newSubTool = newTool === 'shape' ? subTool : undefined;
    markupService.selectTool( newTool, newSubTool );

    OS3dMrkpCtx.tool =  newTool;
    OS3dMrkpCtx.subTool =  newSubTool;
    updateOnScreen3dMarkupContext( viewerContextData, 'onScreen3dMarkupContext', OS3dMrkpCtx );
};

//-----------------------------------------------------------------------------

export default exports = {
    onScreen3dStartMarkup,
    onScreen3dSetTool,
    onScreen3dRemoveAllAnnotations
};
