// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the 3D markup methods for drawing markups on the image viewer panel
 *
 * @module js/MarkupOnScreen3d
 */
import markupCanvas from 'js/MarkupCanvas';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';

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

//==================================================
// private functions
//==================================================
/**
 * Get the div/container for the 3d viewer - the AW Structure Viewer.
 *
 * @return {DOMElement} the AW structure viewer container
 */
function getAWStructureViewerContainer() {
    return document.getElementById( 'awStructureViewer' );
}

/**
 * Synchronize the markup canvas size with the 3D canvas.
 *
 * @param {DOMElement} container The #awStructureViewer div parent of the 3D and markup canvases
 */
function synchCanvasSize( container ) {
    let threeDDOMCanvas = null;
    let markupDOMCanvas = null;
    let canvasCollection = container.getElementsByTagName( 'canvas' );
    for( let i = 0; i < canvasCollection.length; i++ ) {
        if( canvasCollection[ i ].id.indexOf( 'markup' ) === 0 ) {
            markupDOMCanvas = canvasCollection[ i ];
        } else if (canvasCollection[ i ].id.indexOf( 'se-navcube' )  < 0 ) {
            threeDDOMCanvas = canvasCollection[ i ];
        }
    }

    if( threeDDOMCanvas && markupDOMCanvas ) {
        markupDOMCanvas.width = threeDDOMCanvas.clientWidth;
        markupDOMCanvas.height = threeDDOMCanvas.clientHeight;
    }
}

//==================================================
// public functions
//==================================================
/**
 * Initialize this "Operation" markup module.
 *
 * @param {Markup} markups The array of markups already in the markup system
 * @param {User} users The array of users (should only be one here - the current session's user)
 * @param {MarkupThread} thread The MarkupThread object
 *
 * @return {boolean} true if image viewer is found
 */
export function init( markups, users, thread ) {
    let container = getAWStructureViewerContainer();
    if( !container ) {
        return false;
    }

    markupCanvas.init( markups, thread, { top: 72 } );
    markupCanvas.setCanvas( container, 0 );
    synchCanvasSize( container );
    markupCanvas.setViewParam( vp );
    markupCanvas.setFitViewParam( vpFit );
    markupCanvas.setViewerContainer( container );
    markupColor.init( users, thread );
    markupTooltip.init( thread );

    return true;
}

/**
 * Set the current tool & subtool and pass them also to the markup canvas.
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
 * Set the selection end callback
 *
 * @param {function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    markupCanvas.setSelectionEndCallback( function( t ) {
        callback( t );
    } );
}

/**
 * Set position markup
 *
 * @param {Markup} markup The markup to be positioned
 */
export function setPositionMarkup( markup ) {
    markupCanvas.setPositionMarkup( markup );
}

export let showAsSelected = function( markup, option ) {
    markupCanvas.showAsSelected( markup, option );
};

export let addResource = function( name, value ) {
    markupCanvas.addResource( name, value );
};

//==================================================
// exported functions
//==================================================
let exports;
export default exports = {
    init,
    setTool,
    getUserSelection,
    clearUserSelection,
    setSelectionEndCallback,
    setPositionMarkup,
    showAsSelected,
    addResource
};
