/* eslint-disable no-nested-ternary */


// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/MarkupCanvas
 */
import markupDraw from 'js/MarkupDraw';
import markupGeom from 'js/MarkupGeom';
import markupFitPath from 'js/MarkupFitPath';
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
/** The view param for drawing on screen */
var vpScreen = {
    scale: 1,
    x: 0,
    y: 0,
    angle2: 0
};
/** The list of all markups */
var markups = [];
/** The markup thread */
var thread = null;
/** The resources */
var resources = {};
/** The current tool */
var tool = null;
/** The subTool, defined only when tool is shape */
var subTool = null;

/** The list of cached canvas */
var canvasList = [];
/** The current canvas to show and draw markups */
var currentCanvas = null;
/** The current context to show and draw markups */
var currentCtx = null;
/** The current container index */
var currentIndex = 0;
/** The current selection of markups */
var currentSelection = null;
/** The canvas rectangle */
var canvasRect = {
    left: 0,
    top: 0,
    width: 100,
    height: 100
};
/** The viewer container */
var viewerContainer = null;
/** The hit markup */
var hitMarkup = null;

/** The x coord of the event */
var eventX = 0;
/** The y coord of the event */
var eventY = 0;
/** The count events added to path */
var eventN = 0;
/** The pen is on */
var penOn = false;
/** The overlay is on */
var overlayOn = false;
/** The user selection */
var userSelection = null;
/** The selection change callback */
var selectionEndCallback = null;
/** The select callback */
var selectCallback = null;

/** The image button Done */
var imgDone = null;
/** The image button Undo */
var imgUndo = null;
/** The image button Redo */
var imgRedo = null;
/** The image button Delete */
var imgDelete = null;

/** The constant value 2 PI */
var angle2PI = Math.PI * 2;
/** The right angle */
var angleRight = Math.PI / 2;
/** The snap tolerance */
var angleSnap = Math.PI / 32;

/** The markup currently being positioned  */
var posMarkup = null;
/** The geometry currently being positioned */
var posGeom = null;
/** the index of posGeom in the geometry list */
var posIndex = 0;
/** The original geometry before positioned */
var oriGeom = null;
/** The current position mode MOVE=1, RESIZE=2, ROTATE=4, RESIZE_ROTATE=6, MOVE_POINT=8 */
var posMode = 0;
/** The current point being targeted NULL=0, START_POINT=1, END_POINT=2 */
var tarPoint = 0;
/** The time ticks for markup position on video */
var posTicks = null;
/** Button dimension: top, gap, and size, default all 32 */
var btnDim = { top: 32, gap: 32, size: 32 };

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {Markup} inMarkups The list of markups
 * @param {MarkupThread} inThread the markup thread
 * @param {Object} buttonDim - optional button dimension for customizing top, gap, and size
 */
export function init( inMarkups, inThread, buttonDim ) {
    imgDone = imgUndo = imgRedo = imgDelete = currentCtx = currentCanvas = null;
    markups = inMarkups;
    thread = inThread;
    canvasList = [];
    posMarkup = null;
    posGeom = null;
    oriGeom = null;
    posMode = 0;
    tarPoint = 0;
    currentSelection = null;
    btnDim.top = buttonDim && buttonDim.top || 32;
    btnDim.gap = buttonDim && buttonDim.gap || 32;
    btnDim.size = buttonDim && buttonDim.size || 32;
}

/**
 * Get the canvas for markup from the given container
 *
 * @param {Element} container The container to be tested
 *
 * @return {Canvas} the existing canvas or null
 */
export function getCanvas( container ) {
    var list = container.getElementsByTagName( 'canvas' );
    for( var i = 0; i < list.length; i++ ) {
        if( list[ i ].id.indexOf( 'markup' ) === 0 ) {
            return list[ i ];
        }
    }

    return null;
}

/**
 * Set the current markup canvas, create if not already exist
 *
 * @param {Element} container The current container
 * @param {number} index The current index, default 0
 *
 * @return {boolean} true if a new canvas is created
 */
export function setCanvas( container, index ) {
    index = index || 0;
    currentCanvas = getCanvas( container );
    currentIndex = index;

    if( currentCanvas ) {
        currentCtx = currentCanvas.getContext( '2d' );
        canvasList[ index ] = currentCanvas;
        setCanvasRect( container, currentCanvas );
        return false;
    }

    currentCanvas = container.ownerDocument.createElement( 'canvas' );
    currentCanvas.id = 'markup' + ( index + 1 );
    currentCanvas.style.touchAction = 'none';
    currentCanvas.style.pointerEvents = 'none';
    currentCanvas.style.zIndex = '100';

    currentCtx = currentCanvas.getContext( '2d' );
    canvasList[ index ] = currentCanvas;

    container.appendChild( currentCanvas );
    setCanvasRect( container, currentCanvas );

    if( window.navigator.pointerEnabled ) {
        currentCanvas.addEventListener( 'pointerdown', penPointerStart );
        currentCanvas.addEventListener( 'pointermove', penPointerMove );
        currentCanvas.addEventListener( 'pointerup', penPointerStop );
        currentCanvas.addEventListener( 'pointerout', penPointerStop );
    } else {
        currentCanvas.addEventListener( 'mousedown', penMouseStart );
        currentCanvas.addEventListener( 'mousemove', penMouseMove );
        currentCanvas.addEventListener( 'mouseup', penStop );
        currentCanvas.addEventListener( 'mouseout', penStop );
    }

    currentCanvas.addEventListener( 'touchstart', penTouchStart );
    currentCanvas.addEventListener( 'touchmove', penTouchMove );
    currentCanvas.addEventListener( 'touchend', penTouchEnd );
    currentCanvas.addEventListener( 'touchcancel', penTouchEnd );

    container.addEventListener( 'dragover', stampDragOver );
    container.addEventListener( 'drop', stampDrop );

    return true;
}

/**
 * Set the markup canvas rectangle
 *
 * @param {Element} container The container to set its markup canvas
 * @param {Canvas} canvas The canvas to be set, default the markup canvas in the container
 */
export function setCanvasRect( container, canvas ) {
    canvas = canvas || getCanvas( container );
    if( container && canvas ) {
        var docRect = container.ownerDocument.documentElement.getBoundingClientRect();
        var containerRect = container.getBoundingClientRect();

        canvasRect.width = containerRect.right - containerRect.left;
        canvasRect.height = containerRect.bottom - containerRect.top;
        canvasRect.left = containerRect.left - docRect.left;
        canvasRect.top = containerRect.top - docRect.top;

        canvas.width = canvasRect.width;
        canvas.height = canvasRect.height;
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.position = 'absolute';
    }
}

/**
 * Set the current tool
 * @param {String} inTool - the tool to be set
 * @param {String} inSubTool - the subTool, defined only when tool is shape
 */
export function setTool( inTool, inSubTool ) {
    tool = inTool === 'freehand' || inTool === 'shape' ||
           inTool === 'stamp' || inTool === 'position' ? inTool : null;
    subTool = inTool === 'shape' ? inSubTool : null;
}

/**
 * Show overlay for user drawing and positioning
 */
export function showOverlay() {
    if( currentCanvas && currentCtx ) {
        currentCanvas.style.pointerEvents = 'auto';
        currentCanvas.style.cursor = tool === 'freehand' || tool === 'shape' ? 'crosshair' :
            tool === 'stamp' && posMarkup ? 'move' : 'pointer';
        overlayOn = true;
        markupFitPath.clearMergeStack( true );
        showMergeResults();
    }

    hideButtons();
}

/**
 * Hide overlay for user drawing
 */
export function hideOverlay() {
    if( currentCanvas ) {
        overlayOn = false;
        currentCanvas.style.pointerEvents = 'none';
        currentCanvas.style.cursor = 'pointer';
        showCurrentPage();
    }

    hideButtons();
}

/**
 * Show one markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function show( markup, option ) {
    var canvas = currentCanvas;
    var ctx = currentCtx;

    if( markup.start.page !== currentIndex ) {
        canvas = canvasList[ markup.start.page ];
        ctx =  canvas ? canvas.getContext( '2d' ) : null;
    }

    var hasGeomList = ctx && markup.geometry && markup.geometry.list;
    if( hasGeomList && ( option === 0 || option === undefined && markup.visible ) ) {
        var geomList = markup.geometry.list;
        var color = markupColor.getColor( markup );
        var selected = markup === currentSelection;
        var tol = 0.1;

        if( markup.start.t && markup.end.t ) {
            var showStart = vp.t >= markup.start.t - tol;
            var showEnd = vp.t <= markup.end.t + tol;
            if( markup === posMarkup && posTicks && posTicks.length > 1 ) {
                showStart = showStart || posTicks[0].seek;
                showEnd = showEnd || posTicks[posTicks.length - 1].seek;
            }

            if( !showStart || !showEnd ) {
                return;
            }
        }

        for( var i = 0; i < geomList.length; i++ ) {
            var geom = geomList[ i ];
            var html = commentDrawnOnPage( markup, geom );
            markupDraw.drawGeom( ctx, geom, html, vp, markup.textParam, color, selected, markup.editMode );
        }
    }
}

/**
 * Show all markups
 *
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAll( option ) {
    clearAllCanvas();

    if( option === 0 || option === undefined ) {
        for( var i = 0; i < markups.length; i++ ) {
            var markup = markups[ i ];
            if( markup.type === '2d' ) {
                exports.show( markup, option );
            }
        }
    }
}

/**
 * Show markup as selected
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAsSelected( markup, option ) {
    currentSelection =  option === 0 ? markup : null;
    exports.showCurrentPage();
}

/**
 * Show markups on the current page
 */
export function showCurrentPage() {
    clearCanvas( currentIndex );

    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];
        if( markup.type === '2d' && markup.start.page === currentIndex ) {
            exports.show( markup );
        }
    }
}

/**
 * Point change callback
 *
 * @param {number} x The x coord in screen coord
 * @param {number} y The y coord in screen coord
 * @param {string} eType The event type
 * @param {number} index The page index, default 0
 */
export function pointChangeCallback( x, y, eType, index ) {
    index = index || 0;
    if( eType === 'mousemove' || eType === 'click' || eType === 'touchend' ) {
        var markup = findHitMarkup( x, y, vp, index );
        var doSelection = false;

        if( markup === null ) {
            if( hitMarkup ) {
                markupTooltip.hideTooltip( '2d', 500 );
            }
        } else if( eType === 'click' ||  eType === 'touchend' && markup === hitMarkup  ) {
            doSelection = true;
        } else if( markup !== hitMarkup ) {
            var canvas = canvasList[ index ];
            if( canvas && !overlayOn ) {
                var rect = canvas.getBoundingClientRect();
                var boundingRect = {
                    left: rect.left + x - 1,
                    right: rect.left + x + 1,
                    top: rect.top + y - 1,
                    bottom: rect.top + y + 1
                };
                markupTooltip.showTooltip( viewerContainer, markup, boundingRect );
            }
        }

        hitMarkup = markup;

        if( doSelection && selectCallback ) {
            markupTooltip.clearTooltip( '2d' );
            selectCallback( markup );
        }
    } else {
        markupTooltip.clearTooltip( '2d' );
        hitMarkup = null;
    }
}

/**
 * Set Html as Image to the geometry of the markup
 *
 * @param {Markup} markup - the markup to be set
 * @param {Number} index - the index of the geometry in the list
 * @param {String} html - the html, or null to remove
 * @param {boolean} edit - true when in edit mode, false when quit edit mode, undefined when load markups
 */
export function setFillImage( markup, index, html, edit ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        if( html ) {
            let data;
            if( html.match( /<svg[^>]*>/ ) ) {
                data = html;
            } else {
                if( edit || markup.textParam === undefined ) {
                    var scale = edit !== undefined ? vp.scale : markup.viewParam.scale * vpFit.scale;
                    var angle = edit !== undefined ? vp.angle2 : 0;
                    adjustMarkupByImageSize( markup, index, html, angle );
                    markup.textParam = calcTextParam( markup, index, html, scale, angle );
                }

                var w = Math.abs( markup.textParam.x ) * 2;
                var h = Math.abs( markup.textParam.y ) * 2;
                var swap = markup.textParam.x * markup.textParam.y < 0;
                var width = swap ? h : w;
                var height = swap ? w : h;
                const className = 'aw-markup-canvasFont';

                data = '<svg xmlns="http://www.w3.org/2000/svg" ' +
                    'width="' + width + '" height="' + height + '">' +
                    '<foreignObject width="' + width + '" height="' + height +
                    '"><div xmlns="http://www.w3.org/1999/xhtml"' +
                    ' class="' + className + '">' +
                    html + '</div></foreignObject></svg>';
            }

            var img = new Image();
            img.onload = function() {
                markup.geometry.list[index].fillImage = img;
                if( edit !== undefined ) {
                    showAsSelected( markup, edit ? 1 : 0 );
                } else if( !markup.stampName ) {
                    showCurrentPage();
                }
            };
            img.crossOrigin = 'anonymous';
            var blob = new Blob( [ data ], { type : 'image/svg+xml' } );
            var reader = new FileReader();
            reader.onload = function( e ) {
                img.src = e.target.result;
            };
            reader.readAsDataURL( blob );
        } else {
            markup.geometry.list[index].fillImage = undefined;
            if( edit !== undefined ) {
                showAsSelected( markup, edit ? 1 : 0 );
            }
        }
    }
}

/**
 * Get the markup fill size in screen coordinates
 *
 * @param {Markup} markup - the markup
 * @param {Number} index - the index of the geometry in the list
 * @param {Boolean} inScreen - true in screen coord, false in world coord
 */
export function getFillSize( markup, index, inScreen ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        var geom = markup.geometry.list[ index ];
        var scale = inScreen ? vp.scale : 1;
        var rect = markupGeom.getGeomRect( geom );

        if( ( geom.shape === 'rectangle' || geom.shape === 'ellipse' ) &&
            ( Math.round( geom.angle / angleRight ) + 16 ) % 2 ) {
            return { width: rect.height * scale, height: rect.width * scale };
        }

        return { width: rect.width * scale, height: rect.height * scale };
    }
}

/**
 * Update the GD&T markup size according to its html
 * @param {Markup} markup - the markup
 */
export function updateGdntSize( markup ) {
    markupDraw.updateGdntSize( currentCtx, markup, vp );
    showCurrentPage();
}

/**
 * Update the Weld markup size according to its html
 * @param {Markup} markup - the markup
 */
export function updateWeldSize( markup ) {
    markupDraw.updateWeldSize( currentCtx, markup, vp );
    showCurrentPage();
}

/**
 * Update the Leader markup size according to its html
 * @param {Markup} markup - the markup
 */
export function updateLeaderSize( markup ) {
    markupDraw.updateLeaderSize( currentCtx, markup, vp );
    showCurrentPage();
}

/**
 * Update the Symbol markup size according to its html
 * @param {Markup} markup - the markup
 */
export function updateSymbolSize( markup ) {
    markupDraw.updateSymbolSize( currentCtx, markup, vp );
    showCurrentPage();
}

/**
 * Set the markup to be positioned
 *
 * @param {Markup} markup - the markup to be positioned
 */
export function setPositionMarkup( markup ) {
    posMarkup = markup;
    posGeom = null;
    oriGeom = null;
    posMode = 0;
    tarPoint = 0;
    posTicks = null;

    if( markup ) {
        showOverlay();
    }
}

/**
 * Time the position markup
 *
 * @param {Number} t - the current time
 * @param {Tick} ticks - array of ticks on the time line
 */
export function timePositionMarkup( t, ticks ) {
    if( posMarkup && ticks ) {
        posTicks = ticks;

        updateTransformFromTicks( posMarkup, ticks );

        for( var i = 0; i < ticks.length; i++ ) {
            if( ticks[i].seek ) {
                if( i === 0 ) {
                    posMarkup.start.t = ticks[i].t;
                } else if( i === ticks.length - 1 ) {
                    posMarkup.end.t = ticks[i].t;
                }

                posMarkup.geometry.list.forEach( function( geom ) {
                    if( geom.transform ) {
                        geom.transform[i].t = t;
                    }
                } );

                break;
            }
        }
    }
}

/**
 * Generate refImage from base image and markup, store in markup
 *
 * @param {Markup} markup - the markup to be in the generated image
 * @param {Number} width - the width of the generated image
 * @param {Number} height - the height of the generated image
 * @param {Image} baseImage - the base image
 * @param {Number} baseParam - the map from world to baseImage
 * @param {Rectangle[]} highlight - the highlight rectangles
 */
export function generateRefImage( markup, width, height, baseImage, baseParam, highlight ) {
    if( navigator.userAgent.match( /QtWebEngine/i ) ) {
        return;
    }

    var canvas = document.createElement( 'canvas' );
    var ctx = canvas.getContext( '2d' );

    canvas.width = width;
    canvas.height = height;
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.position = 'absolute';

    // calculate refParam to show markup in center with some surrounding area
    var xmin = Number.MAX_VALUE;
    var xmax = -Number.MAX_VALUE;
    var ymin = Number.MAX_VALUE;
    var ymax = -Number.MAX_VALUE;

    if( markup.type === 'text' && highlight ) {
        highlight.forEach( function( rect ) {
            xmin = Math.min( xmin, rect.left );
            xmax = Math.max( xmax, rect.left + rect.width );
            ymin = Math.min( ymin, rect.top );
            ymax = Math.max( ymax, rect.top + rect.height );
        } );
    } else if( markup.type === '2d' ) {
        var transform = markupGeom.interpolate( markup.geometry.list[0], vp.t );
        var start = markupGeom.translatePoint( markup.start, transform );
        var end = markupGeom.translatePoint( markup.end, transform );

        xmin = start.x;
        xmax = end.x;
        ymin = start.y;
        ymax = end.y;
    }

    var imageW = baseImage.naturalWidth || baseImage.videoWidth || baseImage.width;
    var imageH = baseImage.naturalHeight || baseImage.videoHeight || baseImage.height;
    if( Math.round( baseParam.angle2 / angleRight ) % 2 === 1 ) {
        var tmp = imageW;
        imageW = imageH;
        imageH = tmp;
    }

    var markupW = Math.min( imageW / baseParam.scale, ( xmax - xmin ) * 2 );
    var markupH = Math.min( imageH / baseParam.scale, ( ymax - ymin ) * 2 );
    if( Math.round( markup.viewParam.angle2 / angleRight ) % 2 === 1 ) {
        var temp = markupW;
        markupW = markupH;
        markupH = temp;
    }

    var refParam = {};
    refParam.scale = Math.min( width / markupW, height / markupH, 1 );
    refParam.angle2 = markup.viewParam.angle2;

    var cos = Math.cos( refParam.angle2 );
    var sin = Math.sin( refParam.angle2 );
    var px = ( xmin + xmax ) / 2;
    var py = ( ymin + ymax ) / 2;
    refParam.x = width / 2 - refParam.scale * ( px * cos - py * sin );
    refParam.y = height / 2 - refParam.scale * ( px * sin + py * cos );
    refParam.t = vp.t;

    // draw base image
    var scale = refParam.scale / baseParam.scale;
    ctx.save();
    ctx.translate( refParam.x, refParam.y );
    ctx.scale( scale, scale );
    ctx.rotate( refParam.angle2 - baseParam.angle2 );
    ctx.drawImage( baseImage, -baseParam.x, -baseParam.y );
    ctx.restore();

    // draw markup
    var color = markupColor.getColor( markup );
    if( markup.type === 'text' ) {
        ctx.save();
        ctx.translate( refParam.x, refParam.y );
        ctx.scale( refParam.scale, refParam.scale );
        ctx.rotate( refParam.angle2 );
        ctx.fillStyle = color;
        highlight.forEach( function( rect ) {
            ctx.beginPath();
            ctx.rect( rect.left, rect.top, rect.width, rect.height );
            ctx.closePath();
            ctx.fill();
        } );
        ctx.restore();
    } else if( markup.type === '2d' ) {
        var geomList = markup.geometry.list;
        for( var i = 0; i < geomList.length; i++ ) {
            var geom = geomList[ i ];
            var html = commentDrawnOnPage( markup, geom );
            markupDraw.drawGeom( ctx, geom, html, refParam, markup.textParam, color, false, markup.editMode );
        }
    }

    markup.refImage = canvas.toDataURL();
    canvas.remove();
}

/**
 * Test if a markup has generated refImage, excluding filename
 *
 * @param {Markup} markup - the markup to be tested
 * @returns {boolean} true if the markups has generated refImage
 */
export function hasRefImage( markup ) {
    return markup && markup.refImage && markup.refImage.startsWith( 'data:image/png;base64,' );
}

//==================================================
// private functions
//==================================================
/**
 * Find a hit markup
 *
 * @param {number} x The x coord in screen coord on canvas
 * @param {number} y The y coord in screen coord on canvas
 * @param {ViewParam} viewParam The view param
 * @param {number} index The container index, default 0
 *
 * @return {Markup} The hit markup
 */
function findHitMarkup( x, y, viewParam, index ) {
    index = index || 0;
    var hitMarkup = null;
    var hitArea = Number.MAX_VALUE;

    var worldP = markupGeom.pointScreenToWorld( { x, y }, viewParam );
    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];
        if( markup.visible && markup.start.page === index && markup.geometry && markup.geometry.list ) {
            var geomList = markup.geometry.list;
            for( var j = 0; j < geomList.length; j++ ) {
                var geom = geomList[ j ];
                if( markupGeom.pointInGeom( worldP, geom, viewParam ) ) {
                    var area = markupGeom.getGeomArea( geom );
                    if( !hitMarkup || area < hitArea || area === hitArea && markup.date < hitMarkup.date ) {
                        hitMarkup = markup;
                        hitArea = area;
                    }
                }
            }
        }
    }

    return hitMarkup;
}

/**
 * Find the hit geometry in a markup
 *
 * @param {Markup} markup The markup to be tested
 * @param {number} x The x coord in screen coord on canvas
 * @param {number} y The y coord in screen coord on canvas
 * @param {ViewParam} viewParam The view param
 * @param {Number} extraTol Extra tolerance in screen coord, default 0
 *
 * @returns {Geometry} the hit geometry, or null if not found
 */
function findHitGeom( markup, x, y, viewParam, extraTol ) {
    if( markup ) {
        var worldP = markupGeom.pointScreenToWorld( { x, y }, viewParam );
        for( var i = 0; i < markup.geometry.list.length; i++ ) {
            var geom = markup.geometry.list[ i ];
            if( markupGeom.pointInGeom( worldP, geom, viewParam, extraTol ) ) {
                posIndex = i;
                return geom;
            }
        }
    }

    return null;
}

/**
 * The common logic for pen start
 *
 * @param {number} x The x coord
 * @param {number} y The y coord
 */
function penStart( x, y ) {
    penOn = true;
    if( tool === 'position' || tool === 'stamp' ) {
        posGeomInit( x, y );
        showMergeResults();
        eventX = x;
        eventY = y;
    } else if( tool === 'freehand' || tool === 'shape' && subTool === 'cloud' ) {
        currentCtx.beginPath();
        currentCtx.strokeStyle = markupColor.toSolidColor( markupColor.getMyColor() );
        currentCtx.lineWidth = 2;
        currentCtx.moveTo( x, y );
        markupFitPath.start( x, y );
        eventX = x;
        eventY = y;
        eventN = 0;
    } else if( tool === 'shape' ) {
        posGeomInitShape( x, y );
        showMergeResults();
        eventX = x;
        eventY = y;
    }
}

/**
 * The common logic for pen move
 *
 * @param {number} x The x coord
 * @param {number} y The y coord
 */
function penMove( x, y ) {
    if( penOn ) {
        if( tool === 'position' ) {
            if( posMode & 1 ) {
                posGeomMove( x - eventX, y - eventY );
                showMergeResults();
                eventX = x;
                eventY = y;
            } else if( posMode & 6 && ( posGeom.center || posGeom.shape === 'symbol' ) ) {
                const vc = posGeom.center ? posGeom.center : {
                    x: ( posGeom.startPt.x + posGeom.endPt.x ) / 2,
                    y: ( posGeom.startPt.y + posGeom.endPt.y ) / 2
                };
                var v0 = { x: eventX - vc.x, y: eventY - vc.y };
                var v1 = { x: x - vc.x, y: y - vc.y };
                var len0 = Math.sqrt( v0.x * v0.x + v0.y * v0.y );
                var len1 = Math.sqrt( v1.x * v1.x + v1.y * v1.y );
                var tol = 0.000001;

                if( len0 > tol && len1 > tol ) {
                    if( posMode & 2 ) {
                        var scale = len1 / len0;
                        posGeomResize( scale );
                    }

                    if( posMode & 4 ) {
                        var dot = v0.x * v1.x + v0.y * v1.y;
                        var cross = v0.x * v1.y - v0.y * v1.x;
                        var angle = Math.atan2( cross, dot );
                        posGeomRotate( angle );
                    }

                    showMergeResults();
                }
            } else if( posMode & 8 ) {
                posGeomPointMove( x, y, eventX, eventY );
                showMergeResults();
                eventX = x;
                eventY = y;
            }
        } else if( ( tool === 'freehand' || tool === 'shape' && subTool === 'cloud' ) && penStroke( x, y ) ) {
            currentCtx.lineTo( x, y );
            currentCtx.stroke();
            markupFitPath.add( x, y );
            eventX = x;
            eventY = y;
            eventN++;
        } else if( tool === 'shape' && subTool !== 'cloud' ) {
            posGeomAdjustShape( eventX, eventY, x, y );
            showMergeResults();
        } else if( tool === 'stamp' ) {
            posGeomMove( x - eventX, y - eventY );
            showMergeResults();
            eventX = x;
            eventY = y;
        }
    } else if( tool === 'position' ) {
        var geom = findHitGeom( posMarkup, x, y, vp );
        if( geom ) {
            currentCanvas.style.cursor = 'move';
        } else {
            geom = findHitGeom( posMarkup, x, y, vp, 30 );
            if( geom && ( geom.center || geom.shape === 'symbol' ) ) {
                currentCanvas.style.cursor = 'nw-resize';
            } else {
                currentCanvas.style.cursor = 'pointer';
            }
        }
    }
}

/**
 * The common logic for pen stop
 */
function penStop() {
    if( penOn ) {
        penOn = false;
        if( tool === 'position' ) {
            updatePositionMarkup();
            if( selectionEndCallback ) {
                selectionEndCallback( 'position' );
            }
        } else if( tool === 'stamp' ) {
            setUserSelection( [ posGeom ] );
            if( selectionEndCallback ) {
                selectionEndCallback( 'stamp' );
            }
        } else if( tool === 'freehand' && eventN > 2 ) {
            markupFitPath.fit();
            showMergeResults();
        } else if( tool === 'shape' ) {
            if( subTool === 'cloud' ) {
                if( eventN > 2 ) {
                    markupFitPath.fit();
                    showMergeResults();
                }
            } else {
                const ms = subTool === 'gdnt' || subTool === 'weld' || subTool === 'leader' ? 500 : 1;
                setTimeout( () => {
                    if( posGeom && posGeom.adding ) {
                        posGeom.adding = undefined;
                    } else if( posGeomValidShape() ) {
                        setUserSelection( [ posGeom ] );
                        hideOverlay();
                        if( selectionEndCallback ) {
                            selectionEndCallback( 'shape', subTool );
                        }
                        eventX = 0;
                        eventY = 0;
                    }
                }, ms );
            }
        }
    }
}

/**
 * The common logic to decide if a pen stroke is acceptible
 *
 * @param {number} x The x coord
 * @param {number} y The y coord
 *
 * @return {boolean} true if it is acceptible
 */
function penStroke( x, y ) {
    var dx = x - eventX;
    var dy = y - eventY;
    return  dx * dx + dy * dy >= 9;
}

/**
 * Pen mouse start event handler
 *
 * @param {Event} e The event
 */
function penMouseStart( e ) {
    e = e || window.event;
    var x = e.offsetX || e.layerX;
    var y = e.offsetY || e.layerY;
    penStart( x, y );
}

/**
 * Pen mouse move event handler
 *
 * @param {Event} e The event
 */
function penMouseMove( e ) {
    e = e || window.event;
    var x = e.offsetX || e.layerX;
    var y = e.offsetY || e.layerY;
    penMove( x, y );
}

/**
 * Pen touch start event handler
 *
 * @param {Event} e The event
 */
function penTouchStart( e ) {
    e = e || window.event;
    e.preventDefault();

    var x = e.touches[ 0 ].pageX - canvasRect.left;
    var y = e.touches[ 0 ].pageY - canvasRect.top;
    penStart( x, y );
}

/**
 * Pen touch move event handler
 *
 * @param {Event} e The event
 */
function penTouchMove( e ) {
    e = e || window.event;
    e.preventDefault();

    var x = e.touches[ 0 ].pageX - canvasRect.left;
    var y = e.touches[ 0 ].pageY - canvasRect.top;
    penMove( x, y );
}

/**
 * Pen touch end event handler
 *
 * @param {Event} e The event
 */
function penTouchEnd( e ) {
    e = e || window.event;
    e.preventDefault();
    penStop();
}

/**
 * Pen pointer start event handler
 *
 * @param {Event} e The event
 */
function penPointerStart( e ) {
    e = e || window.event;
    if( e.pointerType === 'touch' ) {
        e.preventDefault();
    }
    penMouseStart( e );
}

/**
 * Pen pointer move event handler
 *
 * @param {Event} e The event
 */
function penPointerMove( e ) {
    e = e || window.event;
    if( e.pointerType === 'touch' ) {
        e.preventDefault();
    }
    penMouseMove( e );
}

/**
 * Pen pointer stop event handler
 *
 * @param {Event} e The event
 */
function penPointerStop( e ) {
    e = e || window.event;
    if( e.pointerType === 'touch' ) {
        e.preventDefault();
    }
    penStop();
}

/**
 * Clear the current canvas
 *
 * @param {Number} index The canvas index
 */
function clearCanvas( index ) {
    var canvas = currentCanvas;
    var ctx = currentCtx;

    if( index !== currentIndex ) {
        canvas = canvasList[ index ];
        ctx =  canvas ? canvas.getContext( '2d' ) : null;
    }

    if( ctx && canvas ) {
        ctx.clearRect( 0, 0, canvas.width, canvas.height );
    }
}

/**
 * Clear all the canvas
 */
export function clearAllCanvas() {
    for( var i = 0; i < canvasList.length; i++ ) {
        clearCanvas( i );
    }
}

/**
 * Set the user selection
 *
 * @param {FitPathResult} results the merge results
 */
function setUserSelection( results ) {
    var xmin = Number.MAX_VALUE;
    var xmax = -Number.MAX_VALUE;
    var ymin = Number.MAX_VALUE;
    var ymax = -Number.MAX_VALUE;
    var geomList = [];

    for( var i = 0; i < results.length; i++ ) {
        var geomScreen = results[ i ];
        var geomWorld = markupGeom.geomScreenToWorld( geomScreen, vp );
        var bbox = markupGeom.getGeomBbox( geomWorld );

        xmin = Math.min( xmin, bbox.xmin );
        xmax = Math.max( xmax, bbox.xmax );
        ymin = Math.min( ymin, bbox.ymin );
        ymax = Math.max( ymax, bbox.ymax );

        geomList.push( geomWorld );
    }

    userSelection = {
        start: {
            page: currentIndex,
            x: xmin,
            y: ymin
        },
        end: {
            page: currentIndex,
            x: xmax,
            y: ymax
        },
        geometry: {
            list: geomList
        }
    };
}

/**
 * Show the Done, Undo, Redo, Delete buttons
 */
function showButtons() {
    var ownerDoc = viewerContainer.ownerDocument;
    imgDone = ownerDoc.getElementById( 'markupImgDone' );
    imgUndo = ownerDoc.getElementById( 'markupImgUndo' );
    imgRedo = ownerDoc.getElementById( 'markupImgRedo' );
    imgDelete = ownerDoc.getElementById( 'markupImgDelete' );

    if( !imgDone || !imgUndo || !imgRedo || !imgDelete ) {
        imgDone = ownerDoc.createElement( 'img' );
        imgDone.style.width = btnDim.size + 'px';
        imgDone.style.height = btnDim.size + 'px';
        imgDone.style.visible = 'none';
        imgDone.style.position = 'absolute';
        imgDone.style.zIndex = '1000';

        imgUndo = imgDone.cloneNode();
        imgRedo = imgDone.cloneNode();
        imgDelete = imgDone.cloneNode();

        imgDone.id = 'markupImgDone';
        imgDone.addEventListener( 'click', onButtonClick );
        ownerDoc.body.appendChild( imgDone );

        imgUndo.id = 'markupImgUndo';
        imgUndo.addEventListener( 'click', onButtonClick );
        ownerDoc.body.appendChild( imgUndo );

        imgRedo.id = 'markupImgRedo';
        imgRedo.addEventListener( 'click', onButtonClick );
        ownerDoc.body.appendChild( imgRedo );

        imgDelete.id = 'markupImgDelete';
        imgDelete.addEventListener( 'click', onButtonClick );
        ownerDoc.body.appendChild( imgDelete );

        imgDone.src = resources.images.miscAccept;
        imgUndo.src = resources.images.miscUndo;
        imgRedo.src = resources.images.miscRedo;
        imgDelete.src = resources.images.miscDelete;
    }

    var containerRect = viewerContainer.getBoundingClientRect();
    var center = containerRect.left + 0.5 * viewerContainer.clientWidth;
    var top = containerRect.top + btnDim.top;

    imgDone.style.left =  center + 1.5 * btnDim.gap + btnDim.size + 'px';
    imgDone.style.top = top + 'px';
    imgUndo.style.left =  center - 0.5 * btnDim.gap - btnDim.size  + 'px';
    imgUndo.style.top = top + 'px';
    imgRedo.style.left =  center + 0.5 * btnDim.gap + 'px';
    imgRedo.style.top = top + 'px';
    imgDelete.style.left = center - 1.5 * btnDim.gap - 2 * btnDim.size + 'px';
    imgDelete.style.top = top + 'px';

    var sLen = markupFitPath.getMergeStack().length;
    var sTop = markupFitPath.getMergeStackTop();

    imgDone.style.display =  0 <= sTop && sTop < sLen ? 'block' : 'none';
    imgUndo.style.display =  0 < sTop && sTop < sLen ? 'block' : 'none';
    imgRedo.style.display =  0 <= sTop && sTop < sLen - 1 ? 'block' : 'none';
    imgDelete.style.display =  0 <= sTop && sTop < sLen ? 'block' : 'none';
}

/**
 * Hide the buttons
 */
function hideButtons() {
    if( imgDone && imgUndo && imgRedo && imgDelete ) {
        imgDone.style.display = 'none';
        imgUndo.style.display = 'none';
        imgRedo.style.display = 'none';
        imgDelete.style.display = 'none';
    }
}

/**
 * Button click listener
 *
 * @param {Event} event The event
 */
function onButtonClick( event ) {
    var stack = markupFitPath.getMergeStack();
    var sTop = markupFitPath.getMergeStackTop();
    var target = event.currentTarget;

    if( target === imgDone ) {
        setUserSelection( stack[ sTop ] );
        hideOverlay();

        if( selectionEndCallback ) {
            if( !subTool ) {
                selectionEndCallback( tool ); // this is important for subTool comparison
            } else {
                selectionEndCallback( tool, subTool );
            }
        }

        return;
    } else if( target === imgDelete ) {
        markupFitPath.clearMergeStack( true );
    } else if( target === imgUndo ) {
        markupFitPath.setMergeStackTop( sTop - 1 );
    } else if( target === imgRedo ) {
        markupFitPath.setMergeStackTop( sTop + 1 );
    }

    showMergeResults();
}

/**
 * Show existing markups and merge results
 */
function showMergeResults() {
    showCurrentPage();

    if( tool === 'freehand' || tool === 'shape' && subTool !== 'symbol' ) {
        currentCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        currentCtx.fillRect( 0, 0, currentCanvas.width, currentCanvas.height );
    }

    var color = markupColor.getMyColor();
    if( tool === 'freehand' || tool === 'shape' && subTool === 'cloud' ) {
        var stack = markupFitPath.getMergeStack();
        var sTop = markupFitPath.getMergeStackTop();

        if( sTop >= 0 && stack.length > 0 ) {
            var results = stack[ sTop ];
            for( var i = 0; i < results.length; i++ ) {
                markupDraw.drawGeom( currentCtx, results[ i ], null, vpScreen, null, color, false, null );
            }
        }
        showButtons();
    } else if( posGeom ) {
        markupDraw.drawGeom( currentCtx, posGeom, null, vpScreen, null, color, false, null );
    }
}

/**
 * Initialize position geometry
 * @param {Number} x the init x coord to set
 * @param {Number} y the init x coord to set
 */
function posGeomInit( x, y ) {
    if( tool === 'position' ) {
        var geom = findHitGeom( posMarkup, x, y, vp );
        if( geom ) {
            posGeom = markupGeom.geomWorldToScreen( geom, vp );
            posMode = 1;
            if( ( geom.shape === 'leader' || geom.shape === 'weld' || geom.shape === 'gdnt' ) && geom.vertices ) {
                var worldP = markupGeom.pointScreenToWorld( { x, y }, vp );
                //Tolerance for move Point command is here
                var result = markupGeom.pointOnPoint( worldP, geom.vertices[geom.vertices.length - 1], geom.vertices[0], 30 / vp.scale, tarPoint );
                tarPoint = result.tag;
                if( result.result ) {
                    posMode = 8;
                }
            }
        } else {
            geom = findHitGeom( posMarkup, x, y, vp, 30 );
            if( geom ) {
                posGeom = markupGeom.geomWorldToScreen( geom, vp );
                posMode = geom.center ? 6 : geom.shape === 'symbol' ? 2 : 0;
            }
        }
    } else if( tool === 'stamp' ) {
        posGeom = markupGeom.geomWorldToScreen( posMarkup.geometry.list[ 0 ], vpScreen );
        posMode = 1;

        if( posGeom.center ) {
            posGeomMove( x - posGeom.center.x, y - posGeom.center.y );
        } else if( posGeom.vertices ) {
            posGeomMove( x - posGeom.vertices[0].x, y - posGeom.vertices[0].y );
        } else if( posGeom.startPt ) {
            posGeomMove( x - posGeom.startPt.x, y - posGeom.startPt.y );
        }
    }

    oriGeom = JSON.parse( JSON.stringify( posGeom ) );
}

/**
 * Initialize the geometry according to the predefined shape
 *
 * @param {Number} x - the current x coord
 * @param {Number} y - the current y coord
 */
function posGeomInitShape( x, y ) {
    if( tool === 'shape' ) {
        if( subTool === 'rectangle' ) {
            posGeom = {
                shape : 'rectangle',
                center : { x: x, y: y },
                major: 1,
                minor: 1,
                angle: 0
            };
        } else if( subTool === 'ellipse' ) {
            posGeom = {
                shape : 'ellipse',
                center : { x: x, y: y },
                major: 1,
                minor: 1,
                angle: 0
            };
        } else if( subTool === 'arrow' ) {
            posGeom = {
                shape : 'polyline',
                vertices : [ { x: x, y: y }, { x: x + 1, y: y + 1 } ],
                endArrow: { style: 'open' }
            };
        } else if( subTool === 'gdnt' && !addVertexCloseToLast( x, y ) ) {
            posGeom = {
                shape : 'gdnt',
                startPt: { x: x, y: y },
                endPt: { x: x + 40, y: y + 20 },
                vertices : [ { x: x, y: y }, { x: x + 1, y: y + 1 } ],
                startArrow: { style: 'datum' }
            };
        } else if( subTool === 'weld' || subTool === 'leader' && !addVertexCloseToLast( x, y ) ) {
            posGeom = {
                shape : subTool,
                startPt: { x: x, y: y - 16 },
                endPt: { x: x + 64, y: y + 16 },
                vertices : [ { x: x, y: y }, { x: x + 1, y: y + 1 } ],
                startArrow: { style: 'filled' }
            };
        }
    }
}

/**
 * Add a vertext if the current mouse is close to the last existing vertex
 *
 * @param {Number} x - the current x coord
 * @param {Number} y - the current y coord
 * @returns {Boolean} true if added
 */
function addVertexCloseToLast( x, y ) {
    if( posGeom && posGeom.vertices ) {
        const last = posGeom.vertices[posGeom.vertices.length - 1];
        const dx = last.x - x;
        const dy = last.y - y;
        if( dx * dx + dy * dy <= 64 ) {
            posGeom.adding = true;
            posGeom.vertices.push( { x: x + 1, y: y + 1 } );
            return true;
        }
    }

    return false;
}

/**
 * Move the postion geometry
 *
 * @param {Number} dx the delta x
 * @param {Number} dy the delta y
 */
function posGeomMove( dx, dy ) {
    if( posGeom ) {
        if( posGeom.center ) {
            posGeom.center.x += dx;
            posGeom.center.y += dy;
        }

        if( posGeom.vertices ) {
            posGeom.vertices.forEach( function( v ) {
                v.x += dx;
                v.y += dy;
            } );
        }

        if( posGeom.startPt && posGeom.endPt ) {
            posGeom.startPt.x += dx;
            posGeom.startPt.y += dy;
            posGeom.endPt.x += dx;
            posGeom.endPt.y += dy;
        }
    }
}

/**
 * Move the postion geometry of a single point
 *
 * @param {Number} x - target x coord
 * @param {Number} y - target y coord
 * @param {Number} eventX - current x coord
 * @param {Number} eventY - current y coord
 */
function posGeomPointMove( x, y, eventX, eventY ) {
    if( posGeom ) {
        if( tarPoint === 1 && posGeom.startPt && posGeom.endPt ) {
            const n = adjustLastVertex( eventX, eventY, x, y );
            //GDNT requires special different points compared to weld and leader shape types
            if( posGeom.shape === 'gdnt' ) {
                posGeom.startPt.x = x;
                posGeom.startPt.y = n === 0 || n === 1 ? y : y - 20;
                posGeom.endPt.x = x + 40;
                posGeom.endPt.y = n === 0 || n === 1 ? y + 20 : y;
            } else {
                posGeom.startPt.x = n === 0 || n === 3 ? x : x - 64;
                posGeom.startPt.y = y - 16;
                posGeom.endPt.x = n === 0 || n === 3 ? x + 64 : x;
                posGeom.endPt.y = y + 16;
            }
        } else if( tarPoint === 2 ) {
            adjustFirstVertex( eventX, eventY, x, y );
        }
    }
}

/**
 * Resize the geometry with center only
 *
 * @param {Number} scale the scale factor
 */
function posGeomResize( scale ) {
    if( posGeom && posGeom.center ) {
        posGeom.major = oriGeom.major * scale;
        posGeom.minor = oriGeom.minor * scale;
    } else if( posGeom.shape === 'symbol' ) {
        const vc = {
            x: ( oriGeom.startPt.x + oriGeom.endPt.x ) / 2,
            y: ( oriGeom.startPt.y + oriGeom.endPt.y ) / 2
        };
        const v0 = {
            x: oriGeom.startPt.x - vc.x,
            y: oriGeom.startPt.y - vc.y
        };
        const v1 = {
            x: oriGeom.endPt.x - vc.x,
            y: oriGeom.endPt.y - vc.y
        };
        posGeom.startPt.x = vc.x + scale * v0.x;
        posGeom.startPt.y = vc.y + scale * v0.y;
        posGeom.endPt.x = vc.x + scale * v1.x;
        posGeom.endPt.y = vc.y + scale * v1.y;
    }
}

/**
 * Rotate the geometry with center only
 *
 * @param {Number} angle the rotation
 */
function posGeomRotate( angle ) {
    if( posGeom && posGeom.center ) {
        posGeom.angle = oriGeom.angle + angle;
    }
}

/**
 * Adjust the geometry according to the predefined shape
 *
 * @param {Number} x0 - the initial x coord
 * @param {Number} y0 - the initial y coord
 * @param {Number} x - the current x coord
 * @param {Number} y - the current y coord
 */
function posGeomAdjustShape( x0, y0, x, y ) {
    if( posGeom.shape === 'rectangle' || posGeom.shape === 'ellipse' ) {
        posGeom.center.x = ( x0 + x ) / 2;
        posGeom.center.y = ( y0 + y ) / 2;
        posGeom.major = Math.abs( x0 - x ) / 2;
        posGeom.minor = Math.abs( y0 - y ) / 2;
    } else if( posGeom.shape === 'polyline' ) {
        adjustLastVertex( x0, y0, x, y );
    } else if( posGeom.shape === 'gdnt' ) {
        const n = adjustLastVertex( x0, y0, x, y );
        posGeom.startPt.x = x;
        posGeom.startPt.y = n === 0 || n === 1 ? y : y - 20;
        posGeom.endPt.x = x + 40;
        posGeom.endPt.y = n === 0 || n === 1 ? y + 20 : y;
    } else if( posGeom.shape === 'weld' || posGeom.shape === 'leader' ) {
        const n = adjustLastVertex( x0, y0, x, y );
        posGeom.startPt.x = n === 0 || n === 3 ? x : x - 64;
        posGeom.startPt.y = y - 16;
        posGeom.endPt.x = n === 0 || n === 3 ? x + 64 : x;
        posGeom.endPt.y = y + 16;
    }
}

/**
 * Adjust the last vertex and return the direction
 *
 * @param {Number} x0 - the initial x coord
 * @param {Number} y0 - the initial y coord
 * @param {Number} x - the current x coord
 * @param {Number} y - the current y coord
 * @returns {Number} 0 last vertex on top-left corner, 1 top-right, 2 bottom-right, 3 bottom-left
 */
function adjustLastVertex( x0, y0, x, y ) {
    if( posGeom && posGeom.vertices ) {
        const n = posGeom.vertices.length - 1;
        posGeom.vertices[n].x = x;
        posGeom.vertices[n].y = y;

        const dx = x - x0;
        const dy = y - y0;
        return dx >= 0 && dy >= 0 ? 0 : dx < 0 && dy >= 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
    }

    return -1;
}

/**
 * Adjust the first vertex and return the direction
 *
 * @param {Number} x0 - the initial x coord
 * @param {Number} y0 - the initial y coord
 * @param {Number} x - the current x coord
 * @param {Number} y - the current y coord
 * @returns {Number} 0 first vertex on top-left corner, 1 top-right, 2 bottom-right, 3 bottom-left
 */
function adjustFirstVertex( x0, y0, x, y ) {
    if( posGeom && posGeom.vertices ) {
        posGeom.vertices[0].x = x;
        posGeom.vertices[0].y = y;

        const dx = x - x0;
        const dy = y - y0;
        return dx >= 0 && dy >= 0 ? 0 : dx < 0 && dy >= 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
    }

    return -1;
}

/**
 * Check if the posGeom is valid for the predefined shape
 *
 * @returns {Boolean} true if valid
 */
function posGeomValidShape() {
    if( posGeom.shape === 'rectangle' || posGeom.shape === 'ellipse' ) {
        if( posGeom.major >= 5 && posGeom.minor >= 5 ) {
            if( posGeom.major < posGeom.minor ) {
                var t = posGeom.major;
                posGeom.major = posGeom.minor;
                posGeom.minor = t;
                posGeom.angle = angleRight;
            }

            if( posGeom.shape === 'ellipse' &&
                Math.abs( posGeom.major - posGeom.minor ) / posGeom.major < 0.05 ) {
                var r = ( posGeom.major + posGeom.minor ) / 2;
                posGeom.shape = 'circle';
                posGeom.major = r;
                posGeom.minor = r;
                posGeom.angle = 0;
            }

            return true;
        }
    } else if( posGeom.shape === 'polyline' ) {
        return true;
    } else if( posGeom.shape === 'gdnt' || posGeom.shape === 'weld' || posGeom.shape === 'leader' ) {
        posGeom.stroke = { style: 'solid', color: '#000000', width: 1 };
        return true;
    }

    return false;
}

/**
 * Update the postion markup
 */
function updatePositionMarkup() {
    var dxs = 0;
    var dys = 0;
    var f = 1;
    var da = 0;

    if( !posGeom ) {
        return;
    } else if( posGeom.center ) {
        dxs = posGeom.center.x - oriGeom.center.x;
        dys = posGeom.center.y - oriGeom.center.y;
        f = posGeom.major / oriGeom.major;
        da = posGeom.angle - oriGeom.angle;
    } else if( posGeom.startPt && tarPoint !== 2 ) {
        dxs = posGeom.startPt.x - oriGeom.startPt.x;
        dys = posGeom.startPt.y - oriGeom.startPt.y;
        if( posGeom.shape === 'symbol' ) {
            const posDx = posGeom.endPt.x - posGeom.startPt.x;
            const posDy = posGeom.endPt.y - posGeom.startPt.y;
            const oriDx = oriGeom.endPt.x - oriGeom.startPt.x;
            const oriDy = oriGeom.endPt.y - oriGeom.startPt.y;
            f = Math.sqrt( posDx * posDx + posDy * posDy ) / Math.sqrt( oriDx * oriDx + oriDy * oriDy );
        }
    } else if( posGeom.vertices ) {
        dxs = posGeom.vertices[0].x - oriGeom.vertices[0].x;
        dys = posGeom.vertices[0].y - oriGeom.vertices[0].y;
    }

    var cos = Math.cos( vp.angle2 );
    var sin = Math.sin( vp.angle2 );
    var dxw = ( dxs * cos + dys * sin ) / vp.scale;
    var dyw = ( -dxs * sin + dys * cos ) / vp.scale;

    var geom = posMarkup.geometry.list[ posIndex ];
    if( vp.t >= 0 ) {
        markupGeom.initTransform( geom, posMarkup.start.t, posMarkup.end.t );

        var tTol = 0.1;
        for( var i = 0; i < geom.transform.length; i++ ) {
            var transform =  geom.transform[i];
            if( Math.abs( vp.t - transform.t ) < tTol ) {
                transform.x += dxw;
                transform.y += dyw;
                transform.scale *= f;
                transform.angle += da;
                break;
            }
        }
    } else {
        if( geom.center ) {
            geom.center.x += dxw;
            geom.center.y += dyw;
            geom.major *= f;
            geom.minor *= f;
            geom.angle = snapAngle( geom.angle + da );
        }

        if( geom.startPt && geom.endPt && tarPoint !== 2 ) {
            const geomDx = geom.endPt.x - geom.startPt.x;
            const geomDy = geom.endPt.y - geom.startPt.y;
            geom.startPt.x += dxw;
            geom.startPt.y += dyw;
            geom.endPt.x = geom.startPt.x + f * geomDx;
            geom.endPt.y = geom.startPt.y + f * geomDy;
        }

        if( geom.vertices ) {
            var first = false;
            geom.vertices.forEach( function( v ) {
                if( !first ) {
                    if( tarPoint !== 1 ) {
                        v.x += dxw;
                        v.y += dyw;
                    }
                    first = true;
                } else {
                    if( tarPoint !== 2 ) {
                        v.x += dxw;
                        v.y += dyw;
                    }
                }
            } );
        }

        tarPoint = 0;

        if( geom.approxPts ) {
            geom.approxPts.forEach( function( v ) {
                v.x += dxw;
                v.y += dyw;
            } );
        }

        adjustStartEnd( posMarkup, geom );

        if( posMarkup.textParam ) {
            posMarkup.textParam.scale /= f;
        }
    }

    showCurrentPage();
}

/**
 * Adjust the markup start and end after a geometry is modified
 *
 * @param {Markup} markup - the markup whose start and end to be adjusted
 * @param {Geometry} geom - the geometry that has been modified
 */
function adjustStartEnd( markup, geom ) {
    if( geom ) {
        geom.bbox = undefined;
        geom.area = undefined;
    }

    markup.start.x = Number.MAX_VALUE;
    markup.start.y = Number.MAX_VALUE;
    markup.end.x = -Number.MAX_VALUE;
    markup.end.y = -Number.MAX_VALUE;

    markup.geometry.list.forEach( function( g ) {
        var bbox = markupGeom.getGeomBbox( g );
        markup.start.x = Math.min( markup.start.x, bbox.xmin );
        markup.start.y = Math.min( markup.start.y, bbox.ymin );
        markup.end.x = Math.max( markup.end.x, bbox.xmax );
        markup.end.y = Math.max( markup.end.y, bbox.ymax );
    } );
}

/**
 * Snap the angle to be multiple of PI/2 with tolerance of PI/32
 * @param {Number} angle - the input angle
 * @returns {Number} the output angle
 */
function snapAngle( angle ) {
    var ang = angle > Math.PI ? angle - angle2PI : angle < -Math.PI ? angle + angle2PI : angle;
    return Math.abs( ang ) < angleSnap ? 0 :
        Math.abs( ang - angleRight ) < angleSnap ? angleRight :
            Math.abs( ang + angleRight ) < angleSnap ? -angleRight :
                Math.abs( ang - Math.PI ) < angleSnap ? Math.PI :
                    Math.abs( ang + Math.PI ) < angleSnap ? Math.PI : ang;
}

/**
 * Calculate the textParam, i.e. the texture map parameter
 *
 * @param {Markup} markup - The markup being calculated
 * @param {Number} index - the index of geom
 * @param {String} html - the html
 * @param {Number} scale - scale from world to screen
 * @param {Number} angle - rotate angle
 *
 * @returns {Object} textParam with property scale, x, y
 */
function calcTextParam( markup, index, html, scale, angle ) {
    var geom = markup.geometry.list[index];
    var imgSize = getImageSize( html );
    var rect = markupGeom.getGeomRect( geom, imgSize !== null );
    var geomAngle = geom.angle ? geom.angle : 0;
    var n = ( Math.round( ( angle + geomAngle ) / angleRight ) + 16 ) % 4;
    var width = rect.width * scale;
    var height = rect.height * scale;

    if( imgSize ) {
        width = n % 2 === 0 ? imgSize.width : imgSize.height;
        height = n % 2 === 0 ? imgSize.height : imgSize.width;
        scale = Math.min( width / rect.width, height / rect.height );
    } else if( html.indexOf( 'text-align:center' ) > 0 ) {
        var div = document.createElement( 'div' );
        document.body.appendChild( div );

        div.style = 'font-family:sans-serif,Arial,Verdana;font-size:13px;width:' +
                    ( n % 2 === 0 ? width : height ) + 'px';
        div.innerHTML = html;
        var h = div.getBoundingClientRect().height;
        document.body.removeChild( div );

        if( n % 2 === 0 && h < height ) {
            height = h;
        } else if( n % 2 === 1 && h < width ) {
            width = h;
        }
    }

    return {
        scale: scale,
        x: ( n === 0 || n === 1 ? -width : width ) / 2,
        y: ( n === 0 || n === 3 ? -height : height ) / 2
    };
}

/**
 * Get image size if the HTML contains image only
 *
 * @param {String } html - the HTML being tested
 * @returns {Size} the image size or null if not matched
 */
function getImageSize( html ) {
    if( html.match( /^<div[^>]*><img [^>]*><\/div>\s*$/ ) ) {
        var w = html.match( /width="[0-9.]+/ )[ 0 ];
        var h = html.match( /height="[0-9.]+/ )[ 0 ];
        var width = Number( w.substring( 7 ) );
        var height = Number( h.substring( 8 ) );
        return { width, height };
    }

    return null;
}

/**
 * Adjust the markup according to image size
 *
 * @param {Markup} markup - The markup being adjusted
 * @param {Number} index - the index of geom
 * @param {String} html - the html
 * @param {Number} angle - the rotation angle
 */
function adjustMarkupByImageSize( markup, index, html, angle ) {
    var imgSize = getImageSize( html );
    if( imgSize ) {
        var geom = markup.geometry.list[ index ];
        if( geom.shape === 'rectangle' || geom.shape === 'ellipse' ) {
            var geomRatio = geom.minor / geom.major;
            var imgRatio = Math.min( imgSize.width, imgSize.height ) / Math.max( imgSize.width, imgSize.height );
            if( Math.abs( geomRatio - imgRatio ) > 0.001 ) {
                geom.minor = geom.major * imgRatio;
                var n = ( Math.round( ( angle + geom.angle ) / angleRight ) + 4 ) % 2;
                if( n === 0 && imgSize.width < imgSize.height ||
                    n === 1 && imgSize.width > imgSize.height ) {
                    geom.angle += geom.angle > 0 ? -angleRight : angleRight;
                }
                adjustStartEnd( markup, geom );
            }
        }
    }
}

/**
 * Event handler for stamp drag over
 * @param {Event} ev the dragover event
 * @returns {Boolean} false, or nothing
 */
function stampDragOver( ev ) {
    if( posMarkup && ( posMarkup.stampName || posMarkup.symbolName ) ) {
        ev.stopPropagation();
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        return false;
    }
}

/**
 * Event handler for stamp drop
 * @param {Event} ev - the drop event
 */
function stampDrop( ev ) {
    if( posMarkup && ( posMarkup.stampName || posMarkup.symbolName ) ) {
        ev.stopPropagation();
        ev.preventDefault();
        var stampName = posMarkup.stampName;
        var stamp = posMarkup;
        if( stamp && stamp.geometry.list ) {
            var x = ev.offsetX;
            var y = ev.offsetY;
            var target = ev.target;

            for ( ; target && target !== ev.currentTarget; target = target.offsetParent ) {
                x += target.offsetLeft;
                y += target.offsetTop;
            }

            var geom = Object.assign( {}, stamp.geometry.list[0] );
            if( geom.center ) {
                geom.center = { x, y };
            } else if ( geom.startPt && geom.endPt ) {
                geom.endPt = { x: x + geom.endPt.x - geom.startPt.x, y: y + geom.endPt.y - geom.startPt.y };
                geom.startPt = { x, y };
            }

            setUserSelection( [ geom ] );
            if( selectionEndCallback ) {
                if( stampName ) {
                    userSelection.stampName = stampName;
                    selectionEndCallback( 'stamp' );
                } else {
                    selectionEndCallback( 'shape', 'symbol' );
                }
            }
        }
    }
}

/**
 * Update the transformation from ticks that's changed by the play control
 *
 * @param {Markup} markup - the markup whose transformation is to be updated
 * @param {Tick[]} ticks - the ticks from play control
 */
function updateTransformFromTicks( markup, ticks ) {
    if( markup && ticks ) {
        markup.geometry.list.forEach( function( geom ) {
            if( geom.transform.length !== ticks.length ) {
                for( var i = 0; i < geom.transform.length && i < ticks.length; i++ ) {
                    if( !sameTime( geom.transform[i], ticks[i] ) ) {
                        if( sameTime( geom.transform[i], ticks[i + 1] ) ) {
                            var trans = markupGeom.interpolate( geom, ticks[i].t );
                            geom.transform.splice( i, 0, trans );
                            break;
                        } else if( sameTime( geom.transform[i + 1], ticks[i] ) ) {
                            geom.transform.splice( i, 1 );
                            break;
                        }
                    }
                }
            }
        } );
    }
}

/**
 * Test if two ticks have the same time
 *
 * @param {Tick} tick0 the first tick
 * @param {Tick} tick1 the second tick
 * @returns {Boolean} true if the time is the same
 */
function sameTime( tick0, tick1 ) {
    return tick0 && tick1 && Math.abs( tick0.t - tick1.t ) < 0.1;
}

/**
 * comment to be drawn on page
 *
 * @param {Markup} markup - the markup
 * @param {Geom} geom - the geom
 * @returns {String} the comment to be drawn on page
 */
function commentDrawnOnPage( markup, geom ) {
    if( geom.shape === 'gdnt' || geom.shape === 'weld' ||
        geom.shape === 'leader' || geom.shape === 'symbol' ) {
        return thread.getFirstMarkupInThread( markup ).comment;
    }

    return null;
}

//==================================================
// exported functions
//==================================================
let exports;
export let setViewerContainer = function( container ) {
    viewerContainer = container;
};
export let setViewParam = function( viewParam ) {
    vp = viewParam;
};
export let getViewParam = function() {
    return vp;
};
export let setFitViewParam = function( viewParam ) {
    vpFit = viewParam;
};
export let getCurrentIndex = function() {
    return currentIndex;
};
export let getUserSelection = function() {
    return userSelection;
};
export let setSelectionEndCallback = function( callback ) {
    selectionEndCallback = callback;
};
export let setSelectCallback = function( callback ) {
    selectCallback = callback;
};
export let addResource = function( name, value ) {
    resources[ name ] = value;
};

export default exports = {
    init,
    getCanvas,
    setCanvas,
    setCanvasRect,
    setViewerContainer,
    setTool,
    showOverlay,
    hideOverlay,
    show,
    showAll,
    showCurrentPage,
    showAsSelected,
    setViewParam,
    getViewParam,
    setFitViewParam,
    getCurrentIndex,
    pointChangeCallback,
    getUserSelection,
    setSelectionEndCallback,
    setSelectCallback,
    addResource,
    setFillImage,
    clearAllCanvas,
    getFillSize,
    updateGdntSize,
    updateWeldSize,
    updateLeaderSize,
    updateSymbolSize,
    setPositionMarkup,
    timePositionMarkup,
    generateRefImage,
    hasRefImage
};
