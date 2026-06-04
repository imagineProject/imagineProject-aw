// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 afxWeakImport
 */

/**
 * Defines the markup methods for drawing markups on the 2d viewer panel
 *
 * @module js/Markup2d
 */
import markupCanvas from 'js/MarkupCanvas';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';
import appCtxSvc from 'js/appCtxService';

'use strict';

//==================================================
// private variables
//==================================================

/** The current view param */
var vp = {
    scale: 1,
    x: 0,
    y: 0,
    angle2: 0
};

/** The fit view param */
var vpFit = {
    scale: 1,
    x: 0,
    y: 0,
    angle2: 0
};

/** The container */
var container = null;

/** The current tool */
var tool = null;

/** The view param change callback */
var viewParamChangeCallback = null;

/** The current page index */
var currentIndex = 0;

/** The markup panel is currently revealed */
var revealed = false;

/** The 2dViewer */
var utils2dViewer = null;

//==================================================
// public functions
//==================================================

/**
 * Initialize this module
 *
 * @param {Markup} markups The list of markups
 * @param {User} users The list of users
 * @param {MarkupThread} thread The MarkupThread object
 *
 * @return {boolean} true if image viewer is found
 */
export function init( markups, users, thread ) {
    var pageIndex = 0;
    utils2dViewer = appCtxSvc.getCtx( 'viewer2dMarkupContext' );

    if( utils2dViewer && utils2dViewer.getUsePictureSlinging() ) {
        pageIndex = utils2dViewer.getPageIndex();

        var doc = window.document || window.contentDocument;
        container = doc.getElementById( 'awImageViewer' );
        container.addEventListener( 'mousemove', mouseMoveHandler );

        var view = utils2dViewer.getViewport();
        vp.scale = view.scale;
        vp.x = view.x;
        vp.y = view.y;
        vp.angle2 = view.angle2;
    } else {
        return false;
    }

    markupCanvas.init( markups );
    markupCanvas.setCanvas( container, pageIndex );
    markupCanvas.setViewParam( vp );
    markupCanvas.setFitViewParam( vpFit );
    markupCanvas.setViewerContainer( container );

    markupColor.init( users, thread );
    markupTooltip.init( thread );

    if( utils2dViewer ) {
        utils2dViewer.setClearCanvasCallback( exports.clearCanvas );
        utils2dViewer.setResizeCallback( exports.resize );
    }

    return true;
}

/**
 * Set the current tool
 *
 * @param {string} inTool the tool
 * @param {String} subTool - the subTool, defined only when tool is shape
 */
export function setTool( inTool, subTool ) {
    markupCanvas.setTool( inTool, subTool );
    if( inTool === 'freehand' || inTool === 'shape' ) {
        markupCanvas.showOverlay();
    } else {
        markupCanvas.hideOverlay();
    }

    tool = inTool;
}

/**
 * Get the user selection
 *
 * @return {Selection} the current user selection
 */
export function getUserSelection() {
    return markupCanvas.getUserSelection();
}

/**
 * Clear the user selection
 */
export function clearUserSelection() {
    if( window.getSelection() ) {
        window.getSelection().removeAllRanges();
    }
    markupCanvas.hideOverlay();
}

/**
 * Set the select callback
 *
 * @param {function} callback The callback
 */
export function setSelectCallback( callback ) {
    markupCanvas.setSelectCallback( function( markup ) {
        if( revealed ) {
            callback( markup );
        }
    } );
}

/**
 * Set the selection end callback
 *
 * @param {function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    markupCanvas.setSelectionEndCallback( function( t ) {
        if( revealed && ( tool === t || t === 'stamp' && tool === 'position' ) ) {
            callback( t );
        }
    } );
}

/**
 * Set revealed
 *
 * @param {boolean} reveal - true to reveal or false to hide
 */
export function setRevealed( reveal ) {
    revealed = reveal;
    markupTooltip.clearTooltip();
    setTool( null );

    var view = utils2dViewer.getViewport();
    vp.scale = view.scale;
    vp.x = view.x;
    vp.y = view.y;
}

/**
 * resize - only used by picture slinging
 *
 * @param {float} view - viewport
 */
export function resize( view ) {
    // apply new scale factor
    vp.scale = view.scale;
    vp.x = view.x;
    vp.y = view.y;
    vp.angle2 = view.angle2;

    if( container ) {
        var index = 0;
        if( utils2dViewer ) {
            index = utils2dViewer.getPageIndex();
        }

        // resize the markup canvas
        markupCanvas.setCanvas( container, index );
        currentIndex = index;

        myViewParamChangeCallback( vp );

        // refresh page
        markupCanvas.showCurrentPage();
    }
}

/**
 * clearCanvas - - only used by picture slinging
 *
 * @param {float} scale - scale
 */
export function clearCanvas() {
    markupCanvas.clearAllCanvas();
}

//==================================================
// private functions
//==================================================

/**
 * Map to the normalized view param, i.e. the fit view param is mapped to {1, 0, 0}
 *
 * @param {ViewParam} viewParam The view param to be normalized
 *
 * @return {ViewParam} The normalized view param
 */
function toNormalizedViewParam( viewParam ) {
    var sn = viewParam.scale / vpFit.scale;
    var xn = ( vpFit.x - viewParam.x ) / viewParam.scale;
    var yn = ( vpFit.y - viewParam.y ) / viewParam.scale;

    return {
        scale: sn,
        x: xn,
        y: yn,
        angle2: viewParam.angle2
    };
}

/**
 * Map from the normalized view param, i.e. the view param {1, 0, 0} is mapped to the fit view param
 *
 * @param {ViewParam} viewParam The normalized view param
 *
 * @return {ViewParam} The original view param
 */
function fromNormalizedViewParam( viewParam ) {
    var s = viewParam.scale * vpFit.scale;
    var x = vpFit.x - viewParam.x * s;
    var y = vpFit.y - viewParam.y * s;

    return {
        scale: s,
        x: x,
        y: y,
        angle2: vpFit.angle2
    };
}

/**
 * My view param change callback
 *
 * @param {ViewParam} viewParam The view param at the end of the change
 */
function myViewParamChangeCallback( viewParam ) {
    markupTooltip.clearTooltip( '2d' );
    if( revealed && viewParamChangeCallback ) {
        viewParamChangeCallback( toNormalizedViewParam( viewParam ) );
    }
}

/**
 * Mouse move event handler
 *
 * @param {event} e The event
 */
function mouseMoveHandler( e ) {
    e = e || window.event;
    const x = e.offsetX || e.layerX;
    const y = e.offsetY || e.layerY;
    markupCanvas.pointChangeCallback( x, y, 'mousemove', currentIndex );
}

/**
 * Set page change callback
 *
 * @param {function} callback The callback
 */
export function setPageChangeCallback( callback ) {
    if( container ) {
        container.addEventListener( 'pagechange', function( event ) {
            markupCanvas.hideOverlay();
            currentIndex = event.pageNumber - 1;
            if( revealed ) {
                callback( currentIndex );
            }
        } );
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    markupCanvas.showCurrentPage();
}

/**
 * Ensure markup is visible
 *
 * @param {Markup} markup The markup to be ensured as visible
 */
export function ensureVisible( markup ) {
    if( utils2dViewer ) {
        var index = utils2dViewer.getPageIndex();

        if( markup.start.page !== index ) {
            utils2dViewer.setCurrentPage( null, markup.start.page + 1 );
            if( container ) {
                markupCanvas.setCanvas( container, markup.start.page );
            }
        }
        if ( markup.editMode !== 'new' ) {
            utils2dViewer.setViewportForMarkup( markup );
        }
    }
}

//==================================================
// exported functions
//==================================================
let exports;
export let getViewParam = function() {
    return toNormalizedViewParam( vp );
};
export let setViewParam = function( viewParam ) {

};
export let show = function( markup, option ) {
    markupCanvas.show( markup, option );
};
export let showAll = function( option ) {
    if( option ) {
        markupCanvas.showAll( option );
    } else {
        markupCanvas.showCurrentPage();
    }
};
export let showAsSelected = function( markup, option ) {
    markupCanvas.showAsSelected( markup, option );
};
export let setViewParamChangeCallback = function( callback ) {
    viewParamChangeCallback = callback;
};
export let setUnloadCallback = function() {
    /* do nothing */
};
export let addResource = function( name, value ) {
    markupCanvas.addResource( name, value );
    markupTooltip.addResource( name, value );
};
export let setCommandCallback = function( callback ) {
    markupTooltip.setCommandCallback( callback );
};

export default exports = {
    init,
    setTool,
    getUserSelection,
    clearUserSelection,
    getViewParam,
    setViewParam,
    show,
    showAll,
    showAsSelected,
    showCurrentPage,
    ensureVisible,
    setViewParamChangeCallback,
    setPageChangeCallback,
    setSelectCallback,
    setSelectionEndCallback,
    setUnloadCallback,
    addResource,
    setRevealed,
    resize,
    clearCanvas,
    setCommandCallback
};
