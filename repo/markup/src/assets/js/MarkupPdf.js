// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup functions for highlighting or drawing markups on the pdf viewer panel
 *
 * @module js/MarkupPdf
 */
import markupText from 'js/MarkupText';
import markupCanvas from 'js/MarkupCanvas';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';

//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = null;
/** The PDFView object */
var pdfView = null;
/** The list of all markups */
var markups = null;
/** The current tool */
var tool = null;
/** The subTool, defined only when tool is shape */
var subTool = null;

/** The current view param */
var vp = { scale: 1, x: 0, y: 0, angle2: 0 };
/** The current page index */
var currentIndex = 0;
/** The markup panel is currently revealed */
var revealed = false;
/** The viewer container */
var viewerContainer = null;
/** The data to generate ref images */
var toGenRefImage = null;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {Markup} inMarkups The list of markups
 * @param {User} inUsers The list of users
 * @param {MarkupThread} inThread The MarkupThread object
 * @param {Element} inElement the PDF frame window or its ancestor
 *
 * @return {boolean} true if PDV viewer is found
 */
export function init( inMarkups, inUsers, inThread, inElement ) {
    frameWindow = getFrameWindow( inElement );
    if( !frameWindow ) {
        return false;
    }

    markups = inMarkups;
    viewerContainer = null;

    markupText.init( frameWindow, inMarkups, inThread );
    markupCanvas.init( inMarkups, inThread );
    markupCanvas.setViewParam( vp );
    markupCanvas.setFitViewParam( { scale: 1, x: 0, y: 0, angle2: 0 } );
    markupColor.init( inUsers, inThread );
    markupTooltip.init( inThread );

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
    if( inTool === 'freehand' || inTool === 'shape' && inSubTool !== 'symbol' ) {
        showOverlay();
    } else if( inTool === 'highlight' ) {
        hideOverlay();
    } else {
        hideOverlay();
        markupText.clearUserSelection();
    }

    tool = inTool;
    subTool = inSubTool;
}

/**
 * Get the user selection of text
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelection() {
    return !isPdfViewReady() ? null :
        tool === 'highlight' ? markupText.getUserSelection() : markupCanvas.getUserSelection();
}

/**
 * Show one markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function show( markup, option ) {
    if( isPdfViewReady() && markup.start !== markup.end ) {
        if( option === undefined && markup.visible !== undefined ) {
            option = markup.visible ? 0 : 1;
        }

        if( markup.type === 'text' ) {
            markupText.show( markup, option );
        } else if( markup.type === '2d' ) {
            markupCanvas.show( markup, option );
        }
    }
}

/**
 * Show all markups
 *
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAll( option ) {
    if( isPdfViewReady() && ( revealed || option ) ) {
        markupText.showAll( option );
        markupCanvas.showAll( option );
    }
}

/**
 * Show markup as selected
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAsSelected( markup, option ) {
    if( isPdfViewReady() && markup.start !== markup.end ) {
        if( markup.type === 'text' ) {
            markupText.showAsSelected( markup, option );
        } else if( markup.type === '2d' ) {
            markupCanvas.showAsSelected( markup, option );
        }
    }
}

/**
 * Ensure markup is visible
 *
 * @param {Markup} markup The markup to be ensured as visible
 */
export function ensureVisible( markup ) {
    if( !isPdfViewReady() || markup.start === markup.end ||
        markup.start.page < 0 || markup.start.page >= pdfView.pagesCount ) {
        return;
    }

    if( markup.start.page !== currentIndex ) {
        pdfView.scrollPageIntoView( { pageNumber: markup.start.page + 1 } );
    }

    var page = pdfView._pages[ markup.start.page ];
    if( page && page.div ) {
        page = page.div;
    }
    var markupT = 0;
    var markupL = 0;
    var markupH = 0;
    var markupW = 0;
    for( var el = page; el && el.tagName && el.tagName !== 'BODY'; el = el.offsetParent ) {
        markupT += el.offsetTop;
        markupL += el.offsetLeft;
    }

    if( markup.type === 'text' ) {
        var info = markupText.findStartEndInfo( markup.start, markup.end );
        if( info && info.start && info.start.node ) {
            var span = info.start.node.parentNode;
            var div = span ? span.parentNode : null;
            if( span && div ) {
                markupL += span.offsetLeft + div.offsetLeft;
                markupT += span.offsetTop + div.offsetTop;
                markupW = span.offsetWidth;
                markupH = span.offsetHeight;
            }
        }
    } else if( markup.type === '2d' ) {
        var scale = getCurrentScale();

        var cos = Math.cos( vp.angle2 ? vp.angle2 : 0 );
        var sin = Math.sin( vp.angle2 ? vp.angle2 : 0 );

        markupL += ( markup.start.x * cos - markup.start.y * sin ) * scale + vp.x;
        markupT += ( markup.start.x * sin + markup.start.y * cos ) * scale + vp.y;
        markupW = ( markup.end.x - markup.start.x ) * scale;
        markupH = ( markup.end.y - markup.start.y ) * scale;
    } else {
        return;
    }

    var container = pdfView.container;
    var scrollT = container.scrollTop || document.body.scrollTop;
    var scrollL = container.scrollLeft || document.body.scrollLeft;
    var scrollH = container.scrollHeight || document.body.scrollHeight;
    var scrollW = container.scrollWidth || document.body.scrollWidth;
    var clientH = container.clientHeight || document.body.clientHeight;
    var clientW = container.clientWidth || document.body.clientWidth;

    if( markupT < scrollT || scrollT + clientH < markupT + markupH ) {
        var bestT = markupT + markupH / 2 - clientH / 2;
        container.scrollTop = bestT < 0 ? 0 : bestT > scrollH - clientH ? scrollH - clientH : bestT;
    }

    if( markupL < scrollL || scrollL + clientW < markupL + markupW ) {
        var bestL = markupL + markupW / 2 - clientW / 2;
        container.scrollLeft = bestL < 0 ? 0 : bestL > scrollW - clientW ? scrollW - clientW : bestL;
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    var wait = false;
    if( isPdfViewReady() ) {
        setViewerContainer();

        var textContainer = getPageContainer( 'text' );
        if( textContainer ) {
            markupText.setPageTextRoot( textContainer, currentIndex );
            if( pageHasMarkup( 'text' ) ) {
                if( textContainer.children && textContainer.children.length > 0 ) {
                    markupText.showCurrentPage();
                } else {
                    wait = true;
                }
            }
        } else {
            wait = true;
        }

        if( pageHasMarkup( '2d' ) || tool !== 'highlight' ) {
            var canvasContainer = getPageContainer( '2d' );
            if( canvasContainer ) {
                if( markupCanvas.setCanvas( canvasContainer, currentIndex ) ) {
                    addEventListeners();
                }

                markupCanvas.showCurrentPage();
                if( tool === 'freehand' || tool === 'shape' && subTool === 'cloud' ) {
                    markupCanvas.showOverlay();
                }
            } else {
                wait = true;
            }
        }
    } else {
        wait = true;
    }

    if( wait && frameWindow ) {
        frameWindow.setTimeout( showCurrentPage, 200 );
    }
}

/**
 * Set view param change callback
 *
 * @param {function} callback The callback
 */
export function setViewParamChangeCallback( callback ) {
    if( frameWindow ) {
        frameWindow.addEventListener( 'scalechange', function( event ) {
            if( revealed && Math.abs( vp.scale - event.scale ) > 0.000001 ) {
                var f = event.scale / vp.scale;
                vp.x *= f;
                vp.y *= f;
                vp.scale = event.scale;

                callback( vp );
            }
        } );

        frameWindow.addEventListener( 'rotationchange', function( event ) {
            if( revealed ) {
                setVewParamFromRotation();
                callback( vp );
            }
        } );

        frameWindow.addEventListener( 'refresh', function() {
            if( revealed ) {
                callback( vp );
            }
        } );
    }
}

/**
 * Set page change callback
 *
 * @param {function} callback The callback
 */
export function setPageChangeCallback( callback ) {
    if( frameWindow ) {
        frameWindow.addEventListener( 'pagechange', function( event ) {
            hideOverlay();
            currentIndex = event.pageNumber - 1;
            setVewParamFromRotation();
            if( revealed ) {
                callback( currentIndex );
            }

            if( toGenRefImage ) {
                frameWindow.setTimeout( genListRefImage, 500 );
            }
        } );
    }
}

/**
 * Set select callback
 *
 * @param {function} callback The callback
 */
export function setSelectCallback( callback ) {
    /**
     * A simple callback function.
     * @param {Object} markup the markup
     */
    function mySelectCallback( markup ) {
        if( revealed ) {
            callback( markup );
        }
    }

    markupText.setSelectCallback( mySelectCallback );
    markupCanvas.setSelectCallback( mySelectCallback );
}

/**
 * Set selection end callback
 *
 * @param {function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    /**
     * A simple callback function.
     * @param {String} t the tool
     * @param {String} st the subTool
     */
    function mySelectionEndCallback( t, st ) {
        if( revealed && ( tool === t && subTool === st ||
            tool === 'position' && ( t === 'stamp' || st === 'symbol' ) ) ) {
            callback( t, st );
        }
    }

    markupText.setSelectionEndCallback( mySelectionEndCallback );
    markupCanvas.setSelectionEndCallback( mySelectionEndCallback );
}

/**
 * Get page count
 *
 * @return {int} the page count
 */
export function getPageCount() {
    return isPdfViewReady() && pdfView._pages ? pdfView.pagesCount : 0;
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

    if( isPdfViewReady() && pdfView._pages && pageIndex >= 0 && pageIndex < pdfView.pagesCount ) {
        info.width = pdfView._pages[ pageIndex ].width;
        info.height = pdfView._pages[ pageIndex ].height;
        info.scale = getCurrentScale();
    }

    return info;
}

/**
 * Get the page element
 *
 * @param {int} pageIndex The page index
 *
 * @return {Element} the page element
 */
export function getPageElement( pageIndex ) {
    if( isPdfViewReady() && pdfView._pages ) {
        if( pageIndex >= 0 && pageIndex < pdfView.pagesCount && pdfView._pages[ pageIndex ] ) {
            return pdfView._pages[ pageIndex ].div;
        }
    }

    return null;
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

    vp.scale = getCurrentScale();
    setVewParamFromRotation();
}

/**
 * Generate the refImage of one markup or a list of markups
 *
 * @param {Markup} markupOrList - the markup to generate and update refImage, OR
 *                                the list of markups to generate refImage only if not exist
 * @param {Number} width - width of the generated image
 * @param {Number} height - height of the generated image
 * @param {Function} callback - the callback when the list is finished
 */
export function generateRefImage( markupOrList, width, height, callback ) {
    if ( markupOrList.start ) {
        genOneRefImage( markupOrList, width, height );
    } else if ( markupOrList.length > 0 ) {
        var list = [];
        for ( var i = 0; i < markupOrList.length; i++ ) {
            if ( !markupCanvas.hasRefImage( markupOrList[i] ) ) {
                list.push( markupOrList[i] );
            }
        }

        if( list.length === 0 ) {
            toGenRefImage = null;
            if( callback ) {
                callback();
            }
        } else {
            var prevIndex = currentIndex;
            toGenRefImage = { list, width, height, callback, prevIndex };
            genListRefImage();
        }
    }
}

//==================================================
// private functions
//==================================================
/**
 * Generate the reference image of one markup
 *
 * @param {Markup} markup - the markup to be used to generate image
 * @param {Number} width - width of the generated image
 * @param {Number} height - height of the generated image
 */
function genOneRefImage( markup, width, height ) {
    var pageIndex = markup.start.page;
    var pageContainer = getPageContainer( 'all', pageIndex );
    var baseImage = null;
    if( pageContainer ) {
        baseImage = pageContainer.querySelector( 'div.canvasWrapper canvas' );
    }

    if ( baseImage ) {
        var f = baseImage.width / baseImage.clientWidth;
        var baseParam = {
            scale: vp.scale * f,
            x: vp.x * f,
            y: vp.y * f,
            angle2: vp.angle2
        };
        var highlight = null;

        if ( markup.type === 'text' ) {
            var textContainer = getPageContainer( 'text', pageIndex );
            if( textContainer ) {
                markupText.setPageTextRoot( textContainer, pageIndex );
                highlight = markupText.getMarkupHightlight( markup, vp );
            }
        }

        markupCanvas.generateRefImage( markup, width, height, baseImage, baseParam, highlight );
    }
}

/**
 * Generate the reference image of a list of markups, if not already exist
 *
 * The parameters are stored in var toGenRefImage:
 *     {Markup[]} list - the list (sorted by page) to generate refImage
 *     {Number} width - width of the generated image
 *     {Number} height - height of the generated image
 *     {Function} callback - the callback when finished
 *     {Number} preIndex - the current index before this function is called
 */
function genListRefImage() {
    if( toGenRefImage ) {
        if( toGenRefImage.list.length === 0 ) {
            var prevIndex = toGenRefImage.prevIndex;
            var callback = toGenRefImage.callback;
            toGenRefImage = null;

            if( prevIndex !== currentIndex ) {
                pdfView.scrollPageIntoView( { pageNumber: prevIndex + 1 } );
            }

            if( callback ) {
                callback();
            }
        } else if( toGenRefImage.list[0].start.page === currentIndex ) {
            while( toGenRefImage.list.length > 0 && toGenRefImage.list[0].start.page === currentIndex ) {
                var markup = toGenRefImage.list.shift();
                genOneRefImage( markup, toGenRefImage.width, toGenRefImage.height );
            }
            genListRefImage();
        } else {
            pdfView.scrollPageIntoView( { pageNumber: toGenRefImage.list[0].start.page + 1 } );
        }
    }
}

/**
 * Update x, y and angle2 for ViewParam due to rotation
 *
 */
function setVewParamFromRotation() {
    if( pdfView && !isNaN( pdfView.pagesRotation ) ) {
        var degree = pdfView.pagesRotation % 360;
        if( degree === 0 ) {
            vp.x = 0;
            vp.y = 0;
        } else if( degree === 90 ) {
            vp.x = pdfView._pages[ currentIndex ].width;
            vp.y = 0;
        } else if( degree === 180 ) {
            vp.x = pdfView._pages[ currentIndex ].width;
            vp.y = pdfView._pages[ currentIndex ].height;
        } else if( degree === 270 ) {
            vp.x = 0;
            vp.y = pdfView._pages[ currentIndex ].height;
        }

        vp.angle2 = Math.PI * degree / 180;
    }
}

/**
 * Get the frame window
 *
 * @param {Element} element - the PDF frame window or its ancestor
 * @return {iFrame} the frame window
 */
function getFrameWindow( element ) {
    if( element ) {
        if( element.pdfjsLib ) {
            return element;
        }

        const iframe = element.querySelector( 'iframe' );
        if( iframe && iframe.contentWindow && iframe.contentWindow.pdfjsLib ) {
            return iframe.contentWindow;
        }
    }

    const frames = window.frames;
    for( let i = 0; i < frames.length; i++ ) {
        if( frames[ i ].pdfjsLib ) {
            return frames[ i ];
        }
    }

    return null;
}

/**
 * Is the PDFView ready?
 *
 * @return {boolean} true if it is ready
 */
function isPdfViewReady() {
    if( frameWindow && frameWindow.pdfjsLib ) {
        pdfView = null;
        if( frameWindow.PDFViewerApplication ) {
            pdfView = frameWindow.PDFViewerApplication.pdfViewer;
        } else {
            pdfView = frameWindow.pdfjsLib.pdfViewer;
        }
        if( pdfView && getCurrentPageNumber() > 0 && getCurrentScale() > 0 ) {
            currentIndex = getCurrentPageNumber() - 1;
            vp.scale = getCurrentScale();
            return true;
        }
    }

    return false;
}

/**
 * The page has at least one markup of the given type
 *
 * @param {string} type The markup type "text", "2d", or "all"
 * @param {int} index The page index, default the current page index
 *
 * @return {boolean} true if it has at least one markup of the give type
 */
function pageHasMarkup( type, index ) {
    index = index || currentIndex;
    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];
        if( markup.start.page === index && ( type === 'all' || type === markup.type ) ) {
            return true;
        }
    }

    return false;
}

/**
 * Get the page container of the given type
 *
 * @param {string} type The container type "text", "2d", or "all"
 * @param {int} index The page index, default the current page index
 *
 * @return {div} the page container of the type, null if not ready
 */
function getPageContainer( type, index ) {
    index = index === undefined ? currentIndex : index;
    var container = null;

    if( index < pdfView.pagesCount ) {
        container = pdfView._pages[ index ];
        if( container ) {
            container = container.div;
        }

        if( container && ( type === 'text' ||  type === '2d' && container.canvas  ) ) {
            var className =  type === 'text' ? 'textLayer' : 'canvasWrapper';
            var elements = null;
            if( type === 'text' ) {
                elements = container.getElementsByClassName( className );
            } else if( type === '2d' && container.canvas ) {
                elements = container.canvas.getElementsByClassName( className );
            }
            container =  elements && elements.length > 0 ? elements[ 0 ] : null;
        }
    }

    return container;
}

/**
 * Set the viewer container to show tooltip
 */
function setViewerContainer() {
    if( !viewerContainer ) {
        var doc = frameWindow.document || frameWindow.contentDocument;
        viewerContainer = doc.getElementById( 'viewerContainer' );
        if( viewerContainer ) {
            markupCanvas.setViewerContainer( viewerContainer );
            markupText.setViewerContainer( viewerContainer );
        }
    }
}

/**
 * Add event listeners to the current page container
 */
function addEventListeners() {
    var pageContainer = getPageContainer( 'all' );
    if( pageContainer ) {
        pageContainer.addEventListener( 'mousemove', mouseMoveHandler );
        pageContainer.addEventListener( 'click', clickHandler );
        pageContainer.addEventListener( 'touchend', touchEndHandler );
        pageContainer.addEventListener( 'touchcancel', touchCancelHandler );
    }
}

/**
 * A simple handler function
 * @param {Object} e the handler event
 */
function mouseMoveHandler( e ) {
    pointChanged( e, 'mousemove' );
}

/**
 * A simple handler function
 * @param {Object} e the handler event
 */
function clickHandler( e ) {
    pointChanged( e, 'click' );
}

/**
 * A simple handler function
 * @param {Object} e the handler event
 */
function touchEndHandler( e ) {
    pointChanged( e, 'touchend' );
}

/**
 * A simple handler function
 * @param {Object} e the handler event
 */
function touchCancelHandler( e ) {
    pointChanged( e, 'touchcancel' );
}

/**
 * Show the overlay canvas
 */
function showOverlay() {
    if( isPdfViewReady() ) {
        var canvasContainer = getPageContainer( '2d' );
        if( canvasContainer ) {
            if( markupCanvas.setCanvas( canvasContainer, currentIndex ) ) {
                addEventListeners();
            }

            markupCanvas.showOverlay();
        }
    }
}

/**
 * Hide the overlay canvas
 */
function hideOverlay() {
    markupCanvas.hideOverlay();
}

/**
 * Common logic for event handlers
 *
 * @param {event} e The event
 * @param {eType} eType The event type
 */
function pointChanged( e, eType ) {
    e = e || frameWindow.event;

    if( !revealed || tool === 'freehand' || tool === 'shape' && subTool === 'cloud' ) {
        return;
    }

    var t = e.currentTarget;
    var p = getPageContainerIndex( t );

    if( t && p >= 0 ) {
        var rect = t.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        markupCanvas.pointChangeCallback( x, y, eType, p );
    }
}

/**
 * Get the index of page container
 *
 * @param {Element} element The element
 *
 * @return {int} the index of the page container, or -1 if it is not a page container
 */
function getPageContainerIndex( element ) {
    return  element && element.dataset && element.dataset.pageNumber ?
        parseInt( element.dataset.pageNumber ) - 1 : -1;
}

/**
 * Get the current page index
 *
 * @return {int} the current page index
 */
function getCurrentPageIndex() {
    return  isPdfViewReady() && pdfView.page ? pdfView.page - 1 : 0;
}

/**
 * Get the current page number
 *
 * @return {int} the current page number
 */
function getCurrentPageNumber() {
    if( pdfView && pdfView._currentPageNumber ) {
        return pdfView._currentPageNumber;
    } else if( pdfView && pdfView.currentPageNumber ) {
        return pdfView.currentPageNumber;
    }
    return 0;
}

/**
 * Get the current scale
 *
 * @return {number} the current scale
 */
function getCurrentScale() {
    if( pdfView && pdfView._currentScale ) {
        return pdfView._currentScale;
    } else if( pdfView && pdfView.currentScale ) {
        return pdfView.currentScale;
    }
    return 1;
}

//==================================================
// exported functions
//==================================================
let exports;
export let setPdfFrame = function( frame ) {
    frameWindow = frame;
};
export let clearUserSelection = function() {
    markupText.clearUserSelection();
};
export let getViewParam = function() {
    return vp;
};
export let setUnloadCallback = function( callback ) {
    frameWindow.addEventListener( 'unload', callback );
};
export let addResource = function( name, value ) {
    markupCanvas.addResource( name, value );
    markupTooltip.addResource( name, value );
};
export let setPositionMarkup = function( markup ) {
    markupCanvas.setPositionMarkup( markup );
};
export let setCommandCallback = function( callback ) {
    markupTooltip.setCommandCallback( callback );
};

export default exports = {
    init,
    setPdfFrame,
    setTool,
    show,
    showAll,
    showAsSelected,
    ensureVisible,
    showCurrentPage,
    getUserSelection,
    clearUserSelection,
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
    setPositionMarkup,
    setCommandCallback
};
