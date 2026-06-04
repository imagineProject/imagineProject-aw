// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup methods for drawing markups on the image viewer panel
 *
 * @module js/MarkupImage
 */
import markupCanvas from 'js/MarkupCanvas';
import markupGeom from 'js/MarkupGeom';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';

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

/** The instance of ImgViewer */
var imgViewer = null;
/** The container */
var container = null;
/** The current tool */
var tool = null;
/** The subTool, defined only when tool is shape */
var subTool = null;
/** The view param change callback */
var viewParamChangeCallback = null;
/** The current page index */
var currentIndex = 0;
/** The markup panel is currently revealed */
var revealed = false;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {Markup} markups The list of markups
 * @param {User} users The list of users
 * @param {MarkupThread} thread The MarkupThread object
 * @param {Object} viewerElement The viewer element
 *
 * @return {boolean} true if image viewer is found
 */
export function init( markups, users, thread, viewerElement ) {
    imgViewer = viewerElement.imgViewer;
    const container = imgViewer && imgViewer.getContainer();
    if( !container || !container.getBoundingClientRect() ) {
        return false;
    }

    vp = imgViewer.getViewParam();
    vpFit = imgViewer.getFitViewParam();
    imgViewer.setViewParamChangeCallback( myViewParamChangeCallback );
    imgViewer.setPointChangeCallback( markupCanvas.pointChangeCallback );
    imgViewer.setResizeCallback( function() {
        markupCanvas.setCanvas( container );
    } );

    markupCanvas.init( markups, thread );
    markupCanvas.setCanvas( container );
    markupCanvas.setViewParam( vp );
    markupCanvas.setFitViewParam( vpFit );
    markupCanvas.setViewerContainer( container );

    markupColor.init( users, thread );
    markupTooltip.init( thread );

    return true;
}

/**
 * Set the current tool
 *
 * @param {string} inTool the tool
 * @param {String} inSubTool - the subTool, defined only when tool is shape
 */
export function setTool( inTool, inSubTool ) {
    markupCanvas.setTool( inTool, inSubTool );
    if( inTool === 'freehand' || inTool === 'shape' ) {
        markupCanvas.showOverlay();
    } else {
        markupCanvas.hideOverlay();
    }

    tool = inTool;
    subTool = inSubTool;
}

/**
 * Get the user selection
 *
 * @return {Selection} the current user selection
 */
export function getUserSelection() {
    var userSel = markupCanvas.getUserSelection();
    var duration = imgViewer.getDuration();

    if( userSel && vp.t && duration ) {
        if( vp.t < duration - 0.25 ) {
            userSel.start.t = vp.t;
            userSel.end.t = Math.min( vp.t + 1, duration );
        } else {
            userSel = undefined;
        }
    }
    return userSel;
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
    markupCanvas.setSelectionEndCallback( function( t, st ) {
        if( revealed && ( tool === t && subTool === st ||
            tool === 'position' && ( t === 'stamp' || st === 'symbol' ) ) ) {
            callback( t, st );
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
}

/**
 * Generate the refImage of one markup or a list of markups
 *
 * @param {Markup} markupOrList - the markup to generate and update refImage, OR
 *                                the list of markups to generate refImage only if not exist
 * @param {Number} width - width of the generated image
 * @param {Number} height - height of the generated image
 * @param {Function} callback - the callback when finished
 */
export function generateRefImage( markupOrList, width, height, callback ) {
    var baseImage = imgViewer.getImage();
    var baseParam = { scale: 1, x: 0, y: 0, angle2: 0 };

    if( markupOrList.start ) {
        markupCanvas.generateRefImage( markupOrList, width, height, baseImage, baseParam );
    } else if( markupOrList.length === 0 ) {
        if( callback ) {
            callback();
        }
    } else if( vp.t >= 0 ) {
        var markup = markupOrList[0];
        var list = markupOrList.slice( 1 );

        if( markupCanvas.hasRefImage( markup ) ) {
            generateRefImage( list, width, height, callback );
        } else {
            imgViewer.playInterval( markup.start.t, markup.start.t + 0.5, function() {
                generateRefImage( markup, width, height );
                generateRefImage( list, width, height, callback );
            } );
        }
    } else {
        for( var i = 0; i < markupOrList.length; i++ ) {
            var markup = markupOrList[i];
            if( !markupCanvas.hasRefImage( markup ) ) {
                markupCanvas.generateRefImage( markup, width, height, baseImage, baseParam );
            }
        }

        if( callback ) {
            callback();
        }
    }
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
        angle2: viewParam.angle2,
        t: viewParam.t
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
    var vpF = viewParam.angle2 === undefined || viewParam.angle2 === vpFit.angle2 ? vpFit :
        imgViewer.getFitViewParam( viewParam.angle2 );
    var s = viewParam.scale * vpF.scale;
    var x = vpF.x - viewParam.x * s;
    var y = vpF.y - viewParam.y * s;

    return {
        scale: s,
        x: x,
        y: y,
        angle2: vpF.angle2,
        t: viewParam.t
    };
}

/**
 * My view param change callback
 *
 * @param {ViewParam} viewParam The view param at the end of the change
 */
function myViewParamChangeCallback( viewParam ) {
    markupTooltip.clearTooltip( '2d' );
    if( viewParam.t >= 0 ) {
        markupCanvas.timePositionMarkup( viewParam.t, imgViewer.getTicks() );
    }

    if( revealed && viewParamChangeCallback ) {
        viewParamChangeCallback( toNormalizedViewParam( viewParam ) );
    }
}

/**
 * Set page change callback
 *
 * @param {function} callback The callback
 */
export function setPageChangeCallback( callback ) {
    if( container ) {
        container.addEventListener( 'pagechange', function( event ) {
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
    imgViewer.setViewParam( fromNormalizedViewParam( markup.viewParam ) );
    imgViewer.playInterval( markup.start.t, markup.end.t );
}

/**
 * Set position markup
 *
 * @param {Markup} markup The markup to be positioned
 */
export function setPositionMarkup( markup ) {
    markupCanvas.setPositionMarkup( markup );
    if( vp.t >= 0 ) {
        if( markup && markup.start.t >= 0 && markup.end.t >= 0 ) {
            markup.geometry.list.forEach( function( geom ) {
                markupGeom.initTransform( geom, markup.start.t, markup.end.t );
            } );

            var ticks = markup.geometry.list[0].transform.map( function( trans ) {
                return { t: trans.t };
            } );
            imgViewer.setTicks( ticks );
        } else {
            imgViewer.setTicks( null );
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
    imgViewer.setViewParam( fromNormalizedViewParam( viewParam ) );
};
export let show = function( markup, option ) {
    markupCanvas.show( markup, option );
};
export let showAll = function( option ) {
    markupCanvas.showAll( option );
};
export let showAsSelected = function( markup, option ) {
    markupCanvas.showAsSelected( markup, option );
};
export let setViewParamChangeCallback = function( callback ) {
    viewParamChangeCallback = callback;
};
export let setUnloadCallback = function() {
    /* do nothing */ };
export let setPlayChangeCallback = function( callback ) {
    imgViewer.setPlayChangeCallback( callback );
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
    generateRefImage,
    setPositionMarkup,
    setPlayChangeCallback,
    setCommandCallback
};
