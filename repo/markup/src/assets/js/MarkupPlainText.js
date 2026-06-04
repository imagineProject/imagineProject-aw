// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup functions for highlighting markups on the text viewer panel
 *
 * @module js/MarkupPlainText
 */
import markupText from 'js/MarkupText';
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';

//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = window;
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
 * @return {boolean} true if text viewer is found
 */
export function init( inMarkups, inUsers, inThread ) {
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
            option = markup.visible ? 0 : 1;
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
            var markupL = span.offsetLeft - page.offsetLeft;
            var markupT = span.offsetTop - page.offsetTop;
            var markupW = span.offsetWidth;
            var markupH = span.offsetHeight;

            var scrollT = container.scrollTop;
            var scrollL = container.scrollLeft;
            var scrollH = container.scrollHeight;
            var scrollW = container.scrollWidth;
            var clientH = container.clientHeight;
            var clientW = container.clientWidth;

            if( markupT < scrollT || scrollT + clientH < markupT + markupH ) {
                var bestT = markupT + markupH / 2 - clientH / 2;
                container.scrollTop = bestT < 0 ? 0 : bestT > scrollH - clientH ? scrollH - clientH : bestT;
            }

            if( markupL < scrollL || scrollL + clientW < markupL + markupW ) {
                var bestL = markupL + markupW / 2 - clientW / 2;
                container.scrollLeft = bestL < 0 ? 0 : bestL > scrollW - clientW ? scrollW - clientW : bestL;
            }
        }
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    var textRoot = getPageElement();
    if( textRoot ) {
        markupText.setPageTextRoot( textRoot );
        markupText.showCurrentPage();
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
    return doc.getElementById( 'aw-text-page' );
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

//==================================================
// private functions
//==================================================
/**
 * Set the viewer container to show tooltip
 *
 * @return {boolean} true if successful
 */
function setViewerContainer() {
    var doc = frameWindow.document || frameWindow.contentDocument;
    viewerContainer = doc.getElementById( 'aw-text-container' );
    if( viewerContainer ) {
        markupText.setViewerContainer( viewerContainer );
        return true;
    }

    return false;
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
    setCommandCallback
};
