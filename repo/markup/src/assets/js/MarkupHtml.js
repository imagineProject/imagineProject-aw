// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup functions for showing markups on the html viewer panel
 *
 * @module js/MarkupHtml
 */
import markupText from 'js/MarkupText';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';
import MarkupCanvas from 'js/MarkupCanvas';

//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = null;
/** The current tool */
var tool = null;
/** The markup panel is currently revealed */
var revealed = false;
/** The viewer container */
var viewerContainer = null;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {Markup} inMarkups The list of markups
 * @param {User} inUsers The list of users
 * @param {MarkupThread} inThread The MarkupThread object
 * @param {Element} inElement the HTML frame's ancestor
 *
 * @return {boolean} true if text viewer is found
 */
export function init( inMarkups, inUsers, inThread, inElement ) {
    frameWindow = getFrameWindow( inElement );
    if( !frameWindow ) {
        return false;
    }

    if( !setViewerContainer() ) {
        return false;
    }

    markupText.init( frameWindow, inMarkups, inThread );
    markupColor.init( inUsers, inThread );
    markupTooltip.init( inThread );
    return true;
}

/**
 * Set the current tool
 *
 * @param {string} inTool the tool
 */
export function setTool( inTool ) {
    if( inTool !== 'highlight' ) {
        markupText.clearUserSelection();
    }

    tool = inTool;
}

/**
 * Get the user selection of text
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelection() {
    return markupText.getUserSelection();
}

/**
 * Show one markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function show( markup, option ) {
    if( markup.start !== markup.end ) {
        if( option === undefined && markup.visible !== undefined ) {
            option =  markup.visible ? 0 : 1;
        }

        if( markup.type === 'text' ) {
            markupText.show( markup, option );
        }
    }
}

/**
 * Show all markups
 *
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAll( option ) {
    markupText.showAll( option );
}

/**
 * Show markup as selected
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAsSelected( markup, option ) {
    if( markup.start !== markup.end ) {
        if( markup.type === 'text' ) {
            markupText.showAsSelected( markup, option );
        }
    }
}

/**
 * Ensure markup is visible
 *
 * @param {Markup} markup The markup to be ensured as visible
 */
export function ensureVisible( markup ) {
    if( markup.start === markup.end || markup.type !== 'text' ) {
        return;
    }

    var page = getPageElement();
    var container = viewerContainer;
    var info = markupText.findStartEndInfo( markup.start, markup.end );

    if( page && container && info && info.start && info.start.node ) {
        var span = info.start.node.parentNode;
        if( span ) {
            var boundingRect = span.getBoundingClientRect();
            var clientH = container.clientHeight;
            var clientW = container.clientWidth;

            if( boundingRect.left >= 0 && boundingRect.left <= clientW &&
                boundingRect.top >= 0 && boundingRect.top <= clientH ) {
                return;
            }

            var markupT = 0;
            var markupL = 0;
            var markupH = span.offsetHeight;
            var markupW = span.offsetWidth;
            for( var el = span; el && el.tagName && el.tagName !== 'BODY'; el = el.offsetParent ) {
                markupT += el.offsetTop;
                markupL += el.offsetLeft;
            }

            var bestT = markupT + markupH / 2 - clientH / 2;
            var bestL = markupL + markupW / 2 - clientW / 2;
            container.contentWindow.scrollTo( bestL, bestT );
        }
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    var textRoot = getPageElement();
    if( textRoot && textRoot.firstChild ) {
        markupText.setPageTextRoot( textRoot );
        markupText.showCurrentPage();
    } else {
        frameWindow.setTimeout( showCurrentPage, 200 );
    }
}

/**
 * Set select callback
 *
 * @param {function} callback The callback
 */
export function setSelectCallback( callback ) {
    function mySelectCallback( markup ) {
        if( revealed ) {
            callback( markup );
        }
    }

    markupText.setSelectCallback( mySelectCallback );
}

/**
 * Set selection end callback
 *
 * @param {function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    function mySelectionEndCallback( t ) {
        if( revealed && tool === t ) {
            callback( t );
        }
    }

    markupText.setSelectionEndCallback( mySelectionEndCallback );
}

/**
 * Get the page info
 *
 * @param {int} pageIndex The page index
 *
 * @return {PageInfo} the page info
 */
export function getPageInfo( pageIndex ) {
    var info = { width: 0.0, height: 0.0, scale: 1.0 };
    var elm = getPageElement();

    if( elm ) {
        info.width = elm.width;
        info.height = elm.height;
    }

    return info;
}

/**
 * Get the page element
 *
 * @return {Element} the page element
 */
export function getPageElement() {
    var doc = frameWindow.document || frameWindow.contentDocument;
    return doc.body;
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
    if( allHaveRefImage( markupOrList ) ) {
        if( callback ) {
            callback();
        }
    } else {
        var selected = markupOrList.selected ? markupOrList :
            markupOrList.length > 0 && markupOrList[0].selected ? markupOrList[0] : null;

        genBaseImage( selected, function( baseImage, baseParam ) {
            if( markupOrList.start ) {
                genRefImage( markupOrList, width, height, baseImage, baseParam );
            } else if( markupOrList.length > 0 ) {
                for( var i = 0; i < markupOrList.length; i++ ) {
                    var markup = markupOrList[i];
                    if( !MarkupCanvas.hasRefImage( markup ) ) {
                        genRefImage( markup, width, height, baseImage, baseParam );
                    }
                }

                if( callback ) {
                    callback();
                }
            }
        } );
    }
}

//==================================================
// private functions
//==================================================
/**
 * Get the frame window
 *
 * @param {Element} element - the HTML frame's ancestor
 * @return {iFrame} the frame window
 */
function getFrameWindow( element ) {
    if( element ) {
        const iframe = element.querySelector( 'iframe' );
        if( iframe && iframe.contentWindow ) {
            return iframe.contentWindow;
        }
    }

    const frames = window.frames;
    for( let i = 0; i < frames.length; i++ ) {
        const frameElement = frames[ i ].frameElement;
        if( frameElement && frameElement.parentElement &&
            frameElement.parentElement.id === 'aw-html-viewer' ) {
            return frames[ i ];
        }
    }

    return null;
}
/**
 * Set the viewer container to show tooltip
 *
 * @return {boolean} true if successful
 */
function setViewerContainer() {
    viewerContainer = frameWindow.frameElement;
    if( viewerContainer ) {
        markupText.setViewerContainer( viewerContainer, true );
        return true;
    }

    return false;
}

/**
 * Check if all markups in the list have existing refImage
 *
 * @param {Markup[]} markupOrList - single markup or a list of markups
 * @return {boolean} true if all exist
 */
function allHaveRefImage( markupOrList ) {
    if( markupOrList.start ) {
        return false;
    }

    for( var i = 0; i < markupOrList.length; i++ ) {
        if( !MarkupCanvas.hasRefImage( markupOrList[i] ) ) {
            return false;
        }
    }

    return true;
}

/**
 * Generate the base image
 *
 * @param {Markup} selected - the current selected markup
 * @param {Function} callback - callback when image generated
 */
function genBaseImage( selected, callback ) {
    var textRoot = getPageElement();
    var width = textRoot.offsetWidth;
    var height = textRoot.offsetHeight;

    if( selected ) {
        markupText.showAsSelected( selected, 1 );
    }
    markupText.showAll( 1 );

    var html = textRoot.innerHTML;
    var data = '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="' + width + '" height="' + height + '">' +
        '<foreignObject width="' + width + '" height="' + height + '">' +
        '<div xmlns="http://www.w3.org/1999/xhtml">' +
        html + '</div></foreignObject></svg>';

    markupText.showAll( 0 );
    if( selected ) {
        markupText.showAsSelected( selected, 0 );
    }

    var baseParam = { scale: 1, x: 0, y: 0 };
    var img = new Image();
    img.onload = function() {
        callback( img, baseParam );
    };
    img.crossOrigin = 'anonymous';

    var blob = new Blob( [ data ], { type : 'image/svg+xml' } );
    var reader = new FileReader();
    reader.onload = function( e ) {
        img.src = e.target.result;
    };
    reader.readAsDataURL( blob );
}

/**
 * Generate the ref image
 *
 * @param {Markup} markup - the markup
 * @param {Number} width - width of ref image
 * @param {Number} height - width of ref image
 * @param {Canvas} baseImage - the base image
 * @param {Number} baseParam - the map from world to baseImage
 */
function genRefImage( markup, width, height, baseImage, baseParam ) {
    var canvas = document.createElement( 'canvas' );
    var ctx = canvas.getContext( '2d' );

    canvas.width = width;
    canvas.height = height;
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.position = 'absolute';

    // calculate refParam to show markup in center with some surrounding area
    var vp = { scale: 1, x: 0, y: 0, angle2: 0 };
    var highlight = markupText.getMarkupHightlight( markup, vp );

    var xmin = Number.MAX_VALUE;
    var xmax = -Number.MAX_VALUE;
    var ymin = Number.MAX_VALUE;
    var ymax = -Number.MAX_VALUE;

    highlight.forEach( function( rect ) {
        xmin = Math.min( xmin, rect.left );
        xmax = Math.max( xmax, rect.left + rect.width );
        ymin = Math.min( ymin, rect.top );
        ymax = Math.max( ymax, rect.top + rect.height );
    } );

    var imageW = baseImage.naturalWidth || baseImage.width;
    var imageH = baseImage.naturalHeight || baseImage.height;
    var markupW = Math.min( imageW, ( xmax - xmin ) * 2 );
    var markupH = Math.min( imageH, ( ymax - ymin ) * 2 );

    var refParam = {};
    refParam.scale = Math.min( width / markupW, height / markupH, 1 );
    refParam.x = width / 2 - refParam.scale * ( xmin + xmax ) / 2;
    refParam.y = height / 2 - refParam.scale * ( ymin + ymax ) / 2;

    // draw base image
    var scale = refParam.scale / baseParam.scale;
    ctx.save();
    ctx.translate( refParam.x, refParam.y );
    ctx.scale( scale, scale );
    ctx.drawImage( baseImage, -baseParam.x, -baseParam.y );
    ctx.restore();

    // draw markup
    var color = markupColor.getColor( markup );
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

    // draw border
    ctx.beginPath();
    ctx.rect( 0, 0, width, height );
    ctx.stroke();

    markup.refImage = canvas.toDataURL();
    canvas.remove();
}

//==================================================
// exported functions
//==================================================
let exports;
export let clearUserSelection = function() {
    markupText.clearUserSelection();
};
export let setViewParam = function() {};
export let getViewParam = function() {
    return { scale: 1, x: 0, y: 0 };
};
export let getPageCount = function() {
    return 1;
};
export let setViewParamChangeCallback = function() {};
export let setPageChangeCallback = function() {};
export let setUnloadCallback = function() {};
export let addResource = function( name, value ) {
    markupTooltip.addResource( name, value );
};
export let setCommandCallback = function( callback ) {
    markupTooltip.setCommandCallback( callback );
};

export default exports = {
    init,
    setTool,
    show,
    showAll,
    showAsSelected,
    ensureVisible,
    showCurrentPage,
    getUserSelection,
    clearUserSelection,
    setViewParam,
    getViewParam,
    getPageCount,
    getPageInfo,
    getPageElement,
    setViewParamChangeCallback,
    setPageChangeCallback,
    setSelectCallback,
    setSelectionEndCallback,
    setUnloadCallback,
    addResource,
    setRevealed,
    generateRefImage,
    setCommandCallback
};
