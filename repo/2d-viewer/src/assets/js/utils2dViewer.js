// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/**
 * This file contains the utility methods for aw-2d-viewer directive
 *
 * @module js/utils2dViewer
 */
var exports = {};

/** The current view param */
var vp = {
    scale: 1,
    x: 0,
    y: 0,
    angle2: 0
};

/** flag to enable picture slinging */
var usePictureSlinging = false;

/** The resize callback */
var clearCanvasCallback = null;

/** The resize callback */
var resizeCallback = null;

/** The page callback */
var pageCallback = null;

/** The page index callback */
var pageIndexCallback = null;

/** The fit all callback */
var fit2DCallback = null;

/** The clockwise rotate 90 degree callback */
var rotateCWCallback = null;

/** The counter clockwise rotate 90 degree callback */
var rotateCCWCallback = null;

/** The set mouse move to pan */
var mouseMovePanCallback = null;

/** The set current page callback */
var _setCurrentPageCallback = null;

/** The callback to set the viewport to the vp of a markup */
var setViewportForMarkupCB = null;

/** The app context */

export let setUsePictureSlinging = function( value ) {
    usePictureSlinging = value;
};

export let getUsePictureSlinging = function() {
    return usePictureSlinging;
};

export let setClearCanvasCallback = function( callback ) {
    clearCanvasCallback = callback;
};

export let clearCanvas = function() {
    if( clearCanvasCallback ) {
        clearCanvasCallback();
    }
};

export let setResizeCallback = function( callback ) {
    resizeCallback = callback;
};

export let getViewport = function() {
    return vp;
};

export let resize = function( view ) {
    vp.scale = view.scale;
    vp.x = view.x;
    vp.y = view.y;
    vp.angle2 = view.angle2;

    if( resizeCallback ) {
        resizeCallback( view );
    }
};

export let setPageCallback = function( callback ) {
    pageCallback = callback;
};

export let setFit2DCallback = function( callback ) {
    fit2DCallback = callback;
};

export let setRotateCWCallback = function( callback ) {
    rotateCWCallback = callback;
};

export let setRotateCCWCallback = function( callback ) {
    rotateCCWCallback = callback;
};

export let setMouseMovePanCallback = function( callback ) {
    mouseMovePanCallback = callback;
};

export let setPageIndexCallback = function( callback ) {
    pageIndexCallback = callback;
};

export let setCurrentPageCallback = function( callback ) {
    _setCurrentPageCallback = callback;
};

export let setViewportForMarkupCallback = function( callback ) {
    setViewportForMarkupCB = callback;
};

export let pageUp = function( commandContext ) {
    if( pageCallback ) {
        pageCallback( commandContext, 'up' );
    }
};

export let pageDown = function( commandContext ) {
    if( pageCallback ) {
        pageCallback( commandContext, 'down' );
    }
};

export let pan2D = function( commandContext ) {
    let atomicData = commandContext.getValue();
    atomicData.navMode = 'pan';
    commandContext.update( atomicData );

    if( mouseMovePanCallback ) {
        return mouseMovePanCallback( true );
    }
};

export let zoom2D = function( commandContext, extra ) {
    let atomicData = commandContext.getValue();
    atomicData.navMode = 'zoom';
    commandContext.update( atomicData );

    if( mouseMovePanCallback ) {
        return mouseMovePanCallback( false );
    }
};

export let fit2D = function() {
    if( fit2DCallback ) {
        return fit2DCallback();
    }
};

export let rotateCW = function() {
    if( rotateCWCallback ) {
        return rotateCWCallback();
    }
};

export let rotateCCW = function() {
    if( rotateCCWCallback ) {
        return rotateCCWCallback();
    }
};

export let setMouseMovePan = function( bPan ) {
    if( mouseMovePanCallback ) {
        return mouseMovePanCallback( bPan );
    }
};

export let goToPage = function( commandContext, page ) {
    if( pageCallback ) {
        pageCallback( commandContext, page );
    }
};

export let getPageIndex = function() {
    if( pageIndexCallback ) {
        return pageIndexCallback();
    }

    return 0;
};

export let setCurrentPage = function( commandContext, numPage ) {
    if( _setCurrentPageCallback ) {
        return _setCurrentPageCallback( commandContext, numPage );
    }
};

// Function callable by a module such as Markup2d to pass down to aw-2d-viewer.directive
// to, in turn, pass down to JSCom.
export let setViewportForMarkup = function( markup ) {
    if( setViewportForMarkupCB ) {
        setViewportForMarkupCB( markup );
    }
};

export default exports = {
    setUsePictureSlinging,
    getUsePictureSlinging,
    setClearCanvasCallback,
    clearCanvas,
    setResizeCallback,
    getViewport,
    resize,
    setPageCallback,
    setFit2DCallback,
    setRotateCWCallback,
    setRotateCCWCallback,
    setMouseMovePanCallback,
    setPageIndexCallback,
    setCurrentPageCallback,
    setViewportForMarkupCallback,
    pageUp,
    pageDown,
    pan2D,
    zoom2D,
    fit2D,
    rotateCW,
    rotateCCW,
    setMouseMovePan,
    goToPage,
    getPageIndex,
    setCurrentPage,
    setViewportForMarkup
};
