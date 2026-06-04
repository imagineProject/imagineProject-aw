// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/MarkupText
 */
import markupColor from 'js/MarkupColor';
import markupTooltip from 'js/MarkupTooltip';
import markupGeom from 'js/MarkupGeom';

'use strict';
//==================================================
// private variables
//==================================================
/** The frame window */
var frameWindow = window;
/** The list of all markups */
var markups = [];
/** The text roots */
var textRoots = [];
/** The viewer container */
var viewerContainer = null;
/** Need adjust bounding rect for tooltip */
var adjustBoundingRect = false;
/** The current container index */
var currentIndex = 0;
/** The currently selected markup */
var selectedMarkup = null;
/** The selected range */
var selectedRange = null;
/** The select timeout */
var selectTimeout = null;
/** The select callback */
var selectCallback = null;
/** The findObjId callback */
var findObjId = null;
/** The isBodyContent callback */
var isBodyContent = null;
/** The markup span callback */
var markupSpanChanged = null;
/** The markupThread */
var thread = null;
/** The getUserSelectionFromSingleClick callback */
var getUserSelectionFromSingleClick = null;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {FrameWindow} inFrameWindow The FrameWindow object
 * @param {Markup} inMarkups The list of markups
 * @param {MarkupThread} inThread The MarkupThread object
 */
export function init( inFrameWindow, inMarkups, inThread ) {
    textRoots = [];
    frameWindow = inFrameWindow;
    markups = inMarkups;
    thread = inThread;
    isBodyContent = null;
    findObjId =  null;
    markupSpanChanged = null;
    getUserSelectionFromSingleClick = null;
    selectedMarkup = null;
    selectedRange = null;
    selectTimeout = null;
    selectCallback = null;
}

/**
 * Set the page text root element
 *
 * @param {Element} textRoot The text root
 * @param {int} index The page index, default 0
 */
export function setPageTextRoot( textRoot, index ) {
    index = index || 0;
    textRoots[ index ] = textRoot;
    currentIndex = index;
    textRoot.rootIndex = index;
}

/**
 * Get the user selection of text
 *
 * @return {UserSelection} the user selection
 */
export function getUserSelection() {
    var range = null;
    var selection = frameWindow.getSelection();
    if( selection && selection.rangeCount > 0 ) {
        range = selection.getRangeAt( 0 );
    } else {
        var doc = frameWindow.document || frameWindow.contentDocument;
        selection = doc.getSelection();
        if( selection && selection.rangeCount > 0 ) {
            range = selection.getRangeAt( 0 );
        } else if( selectedRange ) {
            range = selectedRange;
        } else {
            return null;
        }
    }

    return getUserSelectionFromRange( range );
}

/**
 * Clear the user selection
 */
export function clearUserSelection() {
    if( frameWindow ) {
        try {
            var selection = frameWindow.getSelection();
            if( selection && selection.rangeCount > 0 ) {
                selection.removeAllRanges();
            }

            var doc = frameWindow.document || frameWindow.contentDocument;
            selection = doc.getSelection();
            if( selection && selection.rangeCount > 0 ) {
                selection.removeAllRanges();
            }
        } catch ( err ) {
            // ignore errors during removeAllRanges
        }
    }

    selectedRange = null;

    if( selectTimeout ) {
        clearTimeout( selectTimeout );
        selectTimeout = null;
    }
}

/**
 * Show one markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function show( markup, option ) {
    if( markup.type === 'text' ) {
        showTextMarkup( markup, false, option );
    }
}

/**
 * Show all markups
 *
 * @param {number} option The option SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
export function showAll( option ) {
    showTextMarkups( true, option );
}

/**
 * Show markup as selected
 *
 * @param {Markup} markup The markup to be shown
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1
 */
export function showAsSelected( markup, option ) {
    if( markup.type === 'text' ) {
        showTextMarkup( markup, true, option );
        selectedMarkup =  option === 0 ? markup : null;
    }
}

/**
 * Show the current page
 */
export function showCurrentPage() {
    showTextMarkups( false );
}

/**
 * Find the markup start and end info
 *
 * @param {int} start position
 * @param {int} end position
 * @param {String} objId object id, if undefined, use ch (absolute), otherwise use rch (relative)
 *
 * @return {StartEndInfo} the start and end info
 */
export function findStartEndInfo( start, end, objId ) {
    var startPage = start.page;
    var endPage = end.page;
    var startPos =  objId ? start.rch : start.ch;
    var endPos =  objId ? end.rch : end.ch;

    var startNode = null;
    var endNode = null;
    var startOffset = -1;
    var endOffset = -1;

    for( var p = 0; p < 2; p++ ) {
        var textRoot = textRoots[  p === 0 ? startPage : endPage  ];

        if( !textRoot || !textRoot.childNodes ) {
            return null;
        }

        var sumLength = 0;
        var currentObjId;

        for( var node = getFirstNode( textRoot ); node; node = getNextNode( node ) ) {
            if( !isBodyContent || isBodyContent( node ) ) {
                var thisLength = node.length;

                var thisObjId =  findObjId ? findObjId( node ) : undefined;
                if( thisObjId !== currentObjId ) {
                    currentObjId = thisObjId;
                    sumLength = 0;
                }

                if( thisObjId === objId ) {
                    if( p === 0 && sumLength <= startPos && startPos < sumLength + thisLength ) {
                        startNode = node;
                        startOffset = startPos - sumLength;
                    }

                    if( ( startPage === endPage ? p === 0 : p === 1 ) && sumLength < endPos &&
                        endPos <= sumLength + thisLength ) {
                        endNode = node;
                        endOffset = endPos - sumLength;
                    }

                    if( startOffset >= 0 && endOffset >= 0 ) {
                        break;
                    }
                }
                sumLength += thisLength;
            }
        }

        if( startOffset >= 0 && endOffset >= 0 ) {
            break;
        }
    }

    if( startOffset >= 0 && endOffset >= 0 ) {
        return {
            start: {
                page: startPage,
                node: startNode,
                offset: startOffset
            },
            end: {
                page: endPage,
                node: endNode,
                offset: endOffset
            }
        };
    }

    return null;
}

/**
 * Recalculate all the markup positions
 */
export function recalcAllMarkupPositions() {
    thread.clear();
    for( var i = 0; i < markups.length; i++ ) {
        markups[ i ].start.page = -1;
    }

    for( var i = 0; i < textRoots.length; i++ ) {
        if( textRoots[ i ] ) {
            var sumLength = 0;
            var relLength = 0;
            var currentObjId;

            for( var node = getFirstNode( textRoots[ i ] ); node; node = getNextNode( node ) ) {
                if( !isBodyContent || isBodyContent( node ) ) {
                    var thisObjId =  findObjId ? findObjId( node ) : undefined;
                    if( thisObjId !== currentObjId ) {
                        currentObjId = thisObjId;
                        relLength = 0;
                    }

                    recalcMarkupPosition( node, i, sumLength, relLength, currentObjId );
                    relLength += node.length;
                }
                sumLength += node.length;
            }
        }
    }

    for( var j = 0; j < markups.length; j++ ) {
        if( markups[ j ].start.page >= 0 ) {
            thread.add( markups[ j ] );
        } else {
            markups[ j ].deleted = true;
        }
    }
}

/**
 * Remove all spans with markups
 */
export function removeAllMarkupSpans() {
    for( var i = 0; i < textRoots.length; i++ ) {
        if( textRoots[ i ] ) {
            for( var node = getFirstNode( textRoots[ i ] ); node; node = getNextNode( node ) ) {
                if( !isBodyContent || isBodyContent( node ) ) {
                    removeMarkupSpan( node );
                }
            }
        }
    }
}

/**
 * Get Markup highlight rectangles on the page it first appear
 *
 * @param {Markup} markup - the markup
 * @param {Number} viewParam - the viewParam from world to screen
 *
 * @returns {Node[]} the list of highlight rectangles
 */
export function getMarkupHightlight( markup, viewParam ) {
    var textRoot = textRoots[ markup.start.page ];
    var rootRect = textRoot.getBoundingClientRect();
    var list = [];

    for( var node = getFirstNode( textRoot ); node; node = getNextNode( node ) ) {
        if( isMarkupSpan( node.parentNode ) ) {
            if( node.parentNode.markups.indexOf( markup ) > -1 ) {
                var spanRect = node.parentNode.getBoundingClientRect();
                var pt0 = {
                    x: spanRect.left - rootRect.left,
                    y: spanRect.top - rootRect.top
                };
                var pt1 = {
                    x: spanRect.right - rootRect.left,
                    y: spanRect.bottom - rootRect.top
                };

                var pt0w = markupGeom.pointScreenToWorld( pt0, viewParam );
                var pt1w = markupGeom.pointScreenToWorld( pt1, viewParam );

                list.push( {
                    left: Math.min( pt0w.x, pt1w.x ),
                    top: Math.min( pt0w.y, pt1w.y ),
                    width: Math.abs( pt0w.x - pt1w.x ),
                    height: Math.abs( pt0w.y - pt1w.y )
                } );
            }
        }
    }

    return list;
}

//==================================================
// private functions
//==================================================
/**
 * Show text markup
 *
 * @param {Markup} markup The markup to be shown
 * @param {boolean} asSelected Show markup as selected or not
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
function showTextMarkup( markup, asSelected, option ) {
    clearUserSelection();

    if( option === undefined && markup.visible !== undefined ) {
        option =  markup.visible ? 0 : 1;
    }

    var info = findStartEndInfo( markup.start, markup.end, markup.objId );
    if( info ) {
        for( var p = info.start.page; p <= info.end.page; p++ ) {
            var textRoot = textRoots[ p ];
            var startNode =  p === info.start.page ? info.start.node : getFirstNode( textRoot );

            for( var node = startNode; node; node = getNextNode( node ) ) {
                if( !isBodyContent || isBodyContent( node ) ) {
                    var isStartNode =  node === info.start.node;
                    var isEndNode =  node === info.end.node;
                    var startOffset =  isStartNode ? info.start.offset : 0;
                    var endOffset =  isEndNode ? info.end.offset : -1;
                    if( asSelected ) {
                        showNodeAsSelected( node, isStartNode, isEndNode, markup, option );
                    } else {
                        showNodeAsHighlighted( node, startOffset, endOffset, markup, option );
                    }

                    if( isEndNode ) {
                        break;
                    }
                }
            }
        }
    }
}

/**
 * Show text markups
 *
 * @param {boollean} all show all markups or those in the current page
 * @param {number} option The option, SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
function showTextMarkups( all, option ) {
    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];
        if( markup.type === 'text' && ( all || markup.start.page === currentIndex ) ) {
            showTextMarkup( markup, false, option );
        }
    }

    if( selectedMarkup && !all ) {
        showTextMarkup( selectedMarkup, true, option );
    }
}

/**
 * Find the page containing a given node
 *
 * @param {Node} node The given node
 *
 * @return {int} the page index
 */
function findPageByNode( node ) {
    var obj = node;
    while( obj && !isRoot( obj ) ) {
        obj = obj.parentNode;
    }

    return obj ? obj.rootIndex : -1;
}

/**
 * Show markup on a node as highlighted
 *
 * @param {Node} node The node
 * @param {int} startOffset The start offset in the node
 * @param {int} endOffset The end offset in the node
 * @param {Markup} markup The markup to be shown
 * @param {int} option The option SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 */
function showNodeAsHighlighted( node, startOffset, endOffset, markup, option ) {
    var thisNode = node;
    var thisLength = thisNode.length;

    if( thisLength === 0 ) {
        return;
    }

    if( endOffset === -1 ) {
        endOffset = thisLength;
    }

    var hiNode;
    if( startOffset === 0 && endOffset === thisLength ) {
        showNode( thisNode, markup, option );
    } else if( 0 < startOffset && endOffset < thisLength ) {
        hiNode = splitNode( thisNode, endOffset );
        splitNode( hiNode, startOffset );
        showNode( hiNode, markup, option );
    } else if( 0 < startOffset ) {
        splitNode( thisNode, startOffset );
        showNode( thisNode, markup, option );
    } else if( endOffset < thisLength ) {
        hiNode = splitNode( thisNode, endOffset );
        showNode( hiNode, markup, option );
    }
}

/**
 * Show markup on a node as selected
 *
 * @param {Node} node The node node
 * @param {boolean} isStartNode The node is start node
 * @param {boolean} isEndNode The node is end node
 * @param {Markup} markup The markup to be shown
 * @param {int} option The option SHOW_MARKUP=0, HIDE_MARKUP=1
 */
function showNodeAsSelected( node, isStartNode, isEndNode, markup, option ) {
    if( node.length === 0 ) {
        return;
    }

    var color = markupColor.getColor( markup );
    var thisStyle = node.parentNode.style;
    var bg = markupColor.toRGBA( thisStyle.backgroundColor );
    var hi = markupColor.toRGBA( color );

    if( option === 0 ) {
        if( !thisStyle.borderStyle || thisStyle.borderStyle === 'none' ) {
            var isBoth = isStartNode && isEndNode;
            var style =  isBoth ? 'solid' : isStartNode ? 'solid none solid solid' :
                isEndNode ? 'solid solid solid none' : 'solid none solid none';
            var radius =  isBoth ? '4px' : isStartNode ? '4px 0px 0px 4px' :
                isEndNode ? '0px 4px 4px 0px' : '0px';

            thisStyle.borderStyle = style;
            thisStyle.borderWidth = 'thin';
            thisStyle.borderRadius = radius;
            thisStyle.borderColor = markupColor.toDarkColor( color );
            thisStyle.backgroundColor = markupColor.fromRGBA( bg, hi, null );
        }
    } else {
        if( thisStyle.borderStyle ) {
            thisStyle.borderStyle = 'none';
            thisStyle.borderRadius = '0px';
            thisStyle.backgroundColor =  option > 1 ? 'transparent' :
                markupColor.fromRGBA( bg, null, hi );
        }
    }
}

/**
 * Get user selection from range
 *
 * @param {Range} range The range selected by the user
 *
 * @return {UserSelection} the user selection
 */
function getUserSelectionFromRange( range ) {
    if ( getUserSelectionFromSingleClick ) {
        range = getUserSelectionFromSingleClick( range );
    }
    if( !range ) {
        return null;
    }

    var startNode = getFirstNode( range.startContainer );
    var endNode = getFirstNode( range.endContainer );
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    var startPage = findPageByNode( startNode );
    var endPage = findPageByNode( endNode );
    var startCh = -1;
    var endCh = -1;
    var startRch = -1;
    var endRch = -1;
    var currentObjId;

    for( var p = 0; p < 2; p++ ) {
        var textRoot = p === 0 ? textRoots[ startPage ] : textRoots[ endPage ];
        if( !textRoot || !textRoot.childNodes ) {
            return null;
        }

        var sumLength = 0;
        var relLength = 0;

        for( var node = getFirstNode( textRoot ); node; node = getNextNode( node ) ) {
            if( !isBodyContent || isBodyContent( node ) ) {
                var thisObjId = findObjId ? findObjId( node ) : undefined;
                if( thisObjId !== currentObjId ) {
                    if( currentObjId && startCh >= 0 ) {
                        endCh = sumLength;
                        endRch = relLength;
                        break;
                    }
                    currentObjId = thisObjId;
                    relLength = 0;
                }

                if( node === startNode ) {
                    startCh = sumLength + startOffset;
                    startRch = relLength + startOffset;
                }

                if( node === endNode ) {
                    endCh = sumLength + endOffset;
                    endRch = relLength + endOffset;
                }

                if( startCh >= 0 && endCh >= 0 ) {
                    break;
                }

                sumLength += node.length;
                relLength += node.length;
            }
        }

        if( startCh >= 0 && endCh >= 0 ) {
            break;
        }
    }

    if( startPage >= 0 && endPage >= 0 && startCh >= 0 && endCh >= 0 ) {
        return {
            start: {
                page: startPage,
                ch: startCh,
                rch:  currentObjId ? startRch : undefined
            },
            end: {
                page: endPage,
                ch: endCh,
                rch:  currentObjId ? endRch : undefined
            },
            reference: range.toString(),
            objId: currentObjId
        };
    }

    return null;
}

/**
 * Is object a root?
 *
 * @param {Node} obj The object to be tested
 * @param {boolean} ture if it is
 */
function isRoot( obj ) {
    return  !isNaN( obj.rootIndex );
}

/**
 * Is object a span node with markups?
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isMarkupSpan( obj ) {
    return  obj.nodeName === 'SPAN' && obj.markups;
}

/**
 * Is object a text node?
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isText( obj ) {
    return  obj.nodeType === 3;
}

/**
 * Is object a selectable text node? Ignore the inter-element white space
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isSelectableText( obj ) {
    return  obj.nodeType === 3 && obj.parentNode.nodeType === 1 &&
        ( isMarkupSpan( obj.parentNode ) || obj.nodeValue.match( /\S+/ ) || !isInterElement( obj ) );
}

/**
 * Is object inter-element? Given that it is a white space text node
 *
 * @param {Node} obj The object to be tested
 *
 * @return {boolean} true if it is
 */
function isInterElement( obj ) {
    var prev = obj.previousSibling;
    var next = obj.nextSibling;
    var pElem =  prev && !isText( prev ) && !isMarkupSpan( prev );
    var nElem =  next && !isText( next ) && !isMarkupSpan( next );
    return  pElem && nElem || pElem && !next || nElem && !prev;
}

/**
 * Get the first node under the current node
 *
 * @param {Node} node - the current node
 *
 * @return {Node} the first node
 */
function getFirstNode( node ) {
    var first = node;
    while( first.firstChild ) {
        first = first.firstChild;
    }

    return  isSelectableText( first ) ? first : getNextNode( first );
}

/**
 * Get the next node following the current node
 *
 * @param {Node} node - the current node
 *
 * @return {Node} the next node
 */
function getNextNode( node ) {
    var next = node;
    while( next ) {
        if( isRoot( next ) ) {
            return null;
        } else if( next.nextSibling ) {
            return getFirstNode( next.nextSibling );
        }
        next = next.parentNode;
    }

    return null;
}

/**
 * Remove markup span above a node
 *
 * @param {Node} node - the node to remove markup spans
 */
function removeMarkupSpan( node ) {
    var parent = node.parentNode;
    if( isMarkupSpan( parent ) ) {
        var grandParent = parent.parentNode;
        var prev = parent.previousSibling;
        var next = parent.nextSibling;
        var first = parent.firstChild;
        var last = parent.lastChild;

        if( prev && isText( prev ) && first && isText( first ) ) {
            first.nodeValue = prev.nodeValue + first.nodeValue;
            grandParent.removeChild( prev );
        }

        if( next && isText( next ) && last && isText( last ) ) {
            last.nodeValue += next.nodeValue;
            grandParent.removeChild( next );
        }
        removeEventListeners( parent );
        var child = parent.firstChild;
        while( child ) {
            grandParent.insertBefore( child, parent );
            child = parent.firstChild;
        }
        grandParent.removeChild( parent );
    }
}

/**
 * Is it a mobile device?
 *
 * @return {boolean} true on mobile device
 */
function isMobile() {
    return navigator.userAgent.match( /(iPad)|(iPhone)|(iPod)|(android)|(webOS)|(touch)|(tablet)/i );
}

/**
 * show markup on a text node
 *
 * @param {Node} node The node to show markup
 * @param {Markup} markup The markup
 * @param {int} option The option SHOW_MARKUP=0, HIDE_MARKUP=1, REMOVE_MARKUP=2
 *
 * @return {Node} the node or its parent span, existing or new
 */
function showNode( node, markup, option ) {
    var parent = node.parentNode;

    if( isMarkupSpan( parent ) ) {
        if( option === 0 ) {
            addNodeMarkup( parent, markup );
        } else if( option === 1 ) {
            removeNodeMarkup( parent, markup );
        } else {
            parent.markups = [];
            var thisStyle = parent.style;
            thisStyle.backgroundColor = 'transparent';
            thisStyle.borderStyle = 'none';
            thisStyle.borderRadius = '0px';
            if( markupSpanChanged &&  markup.reqData ) {
                markupSpanChanged( parent, markup, option );
            }
        }
        return parent;
    }

    if( option === 0 ) {
        var span = parent.ownerDocument.createElement( 'span' );
        span.style.position = 'static';

        parent.insertBefore( span, node );
        parent.removeChild( node );
        span.appendChild( node );
        addNodeMarkup( span, markup );

        if( markupSpanChanged &&  markup.reqData ) {
            markupSpanChanged( span, markup, option );
        }
        return span;
    }

    return node;
}

/**
 * Split a text node
 *
 * @param {Node} node The node to be split
 * @param {int} offset The offset where to split
 *
 * @return {Node} the new node, which is the left part
 */
function splitNode( node, offset ) {
    var parent = node.parentNode;
    var left = node.nodeValue.substring( 0, offset );
    var right = node.nodeValue.substring( offset );
    var newNode = parent.ownerDocument.createTextNode( left );

    node.nodeValue = right;
    if( isMarkupSpan( parent ) ) {
        var newSpan = parent.ownerDocument.createElement( 'span' );
        newSpan.style.backgroundColor = parent.style.backgroundColor;
        newSpan.markups = parent.markups.slice( 0 );
        addEventListeners( newSpan );
        newSpan.appendChild( newNode );
        parent.parentNode.insertBefore( newSpan, parent );
    } else {
        parent.insertBefore( newNode, node );
    }

    return newNode;
}

/**
 * Add event listeners to a node
 *
 * @param {Node} node The node to add listeners
 */
function addEventListeners( node ) {
    node.addEventListener( 'click', selectListener, false );
    node.addEventListener( 'mouseenter', showTooltipListener, false );
    node.addEventListener( 'mouseleave', hideTooltipListener, false );
    node.addEventListener( 'touchend', selectListener, false );
}

/**
 * Remove event listeners from a node
 *
 * @param {Node} node The node to remove listeners
 */
function removeEventListeners( node ) {
    node.removeEventListener( 'click', selectListener, false );
    node.removeEventListener( 'mouseenter', showTooltipListener, false );
    node.removeEventListener( 'mouseleave', hideTooltipListener, false );
    node.removeEventListener( 'touchend', selectListener, false );
}
/**
 * Add/Remove event listeners from a node
 *
 * @param {Node} node The node to add/remove listeners
 */
export function setMarkupEventListeners( node, option ) {
    if( !option ) {
        addEventListeners( node );
    } else {
        removeEventListeners( node );
    }
}

/**
 * Select listener
 *
 * @param {Event} event The event
 */
function selectListener( event ) {
    var span = event.target;
    if( span.markups && span.markups.length > 0 && selectCallback ) {
        event.preventDefault();
        selectCallback( span.markups[ 0 ] );
    }
}

/**
 * Show tooltip listener
 *
 * @param {Event} event The event
 */
function showTooltipListener( event ) {
    var span = event.target;
    if( span.markups && span.markups.length > 0 ) {
        markupTooltip.showTooltip( viewerContainer, span.markups[ 0 ], span.getBoundingClientRect(), adjustBoundingRect );
    }
}

/**
 * Hide tooltip listener
 */
function hideTooltipListener() {
    markupTooltip.hideTooltip( 'text', 500 );
}

/**
 * Find the position in a node to insert a markup
 *
 * @param {Node} node The node to find position
 * @param {Markup} markup The markup to be inserted
 *
 * @return {int} the position to insert, -1 for the beginning
 */
function findInsertPos( node, markup ) {
    if( !node.markups ) {
        return -1;
    }

    for( var i = 0; i < node.markups.length; i++ ) {
        var m = node.markups[ i ];
        if( markup.reference.length < m.reference.length ) {
            return i;
        }

        if( samePosition( markup, m ) && markup.date < m.date ) {
            return i;
        }
    }

    return -1;
}

/**
 * Find the postion according to the markup thread
 *
 * @param {Node} node The node to find
 * @param {Markup} markup The markup to find
 *
 * @return {int} the position with markup in the same thread, or -1 if not found
 */
function findThreadPos( node, markup ) {
    if( !node.markups ) {
        return -1;
    }

    for( var i = 0; i < node.markups.length; i++ ) {
        var m = node.markups[ i ];
        if( samePosition( markup, m ) && markup.id !== m.id ) {
            return i;
        }
    }

    return -1;
}

/**
 * Test if two markups have the same position
 *
 * @param {Markup} m0 The first markup
 * @param {Markup} m1 The second markup
 *
 * @return {boolean} true if they have the same position
 */
function samePosition( m0, m1 ) {
    if( m0.type === m1.type && m0.start.page === m1.start.page && m0.end.page === m1.end.page ) {
        if( m0.type === 'text' ) {
            return m0.start.ch === m1.start.ch && m0.end.ch === m1.end.ch;
        } else if( m0.type === '2d' ) {
            return m0.start.x === m1.start.x && m0.start.y === m1.start.y && m0.end.x === m1.end.x &&
                m0.end.y === m1.end.y;
        }
    }

    return false;
}

/**
 * Add markup to a node
 *
 * @param {Node} node The node to add markup
 * @param {Markup} markup The markup to be added
 */
function addNodeMarkup( node, markup ) {
    if( !node.markups ) {
        node.markups = [];
        addEventListeners( node );
    }

    var existPos = node.markups.indexOf( markup );
    if( existPos >= 0 ) {
        return;
    }

    var insertPos = findInsertPos( node, markup );
    var threadPos = findThreadPos( node, markup );
    var bg = markupColor.toRGBA( node.style.backgroundColor );
    var hi = markupColor.toRGBA( markupColor.getColor( markup ) );

    if( threadPos === -1 ) {
        node.style.backgroundColor = markupColor.fromRGBA( bg, hi, null );
    } else if( insertPos !== -1 && insertPos <= threadPos ) {
        var old = markupColor.toRGBA( markupColor.getColor( node.markups[ threadPos ] ) );
        node.style.backgroundColor = markupColor.fromRGBA( bg, hi, old );
    }

    if( insertPos === -1 ) {
        node.markups.push( markup );
    } else {
        node.markups.splice( insertPos, 0, markup );
    }
}

/**
 * Recalculate the markup positions associated with a node
 *
 * @param {Node} node - the node that may contain markups
 * @param {Number} page - the page index
 * @param {Number} ch - the absolute character position
 * @param {Number} rch - the relative character position
 * @param {Number} objId - the object id, if undefined, use ch, otherwise use rch
 */
function recalcMarkupPosition( node, page, ch, rch, objId ) {
    if( isMarkupSpan( node.parentNode ) ) {
        var markups = node.parentNode.markups;
        for( var i = 0; i < markups.length; i++ ) {
            var markup = markups[ i ];
            if( markup.start.page < 0 ) {
                markup.start.page = page;
                markup.start.ch = ch;
                markup.start.rch =  objId ? rch : undefined;
                markup.objId = objId;
            }

            markup.end.page = page;
            markup.end.ch = ch + node.length;
            markup.end.rch =  objId ? rch + node.length : undefined;
        }
    }
}

/**
 * Remove markup from a node
 *
 * @param {Node} node The node to remove markup
 * @param {Markup} markup The markup to be removed
 */
function removeNodeMarkup( node, markup ) {
    if( node.markups && node.markups.length > 0 ) {
        var removePos = node.markups.indexOf( markup );
        if( removePos === -1 ) {
            return;
        }

        var threadPos = findThreadPos( node, markup );
        var bg = markupColor.toRGBA( node.style.backgroundColor );
        var hi = markupColor.toRGBA( markupColor.getColor( markup ) );

        if( threadPos === -1 ) {
            node.style.backgroundColor = markupColor.fromRGBA( bg, null, hi );
        } else if( removePos < threadPos ) {
            var old = markupColor.toRGBA( markupColor.getColor( node.markups[ threadPos ] ) );
            node.style.backgroundColor = markupColor.fromRGBA( bg, old, hi );
        }

        if( removePos >= 0 ) {
            node.markups.splice( removePos, 1 );
        }
    }
}

/**
 * Set selection end callback
 *
 * @param {Function} callback The callback
 */
export function setSelectionEndCallback( callback ) {
    if( frameWindow ) {
        addSelectionChangeCallback( callback );
        frameWindow.addEventListener( 'mouseup', function() {
            callback( 'highlight' );
        } );
    }
}

/**
 * Add selection change callback
 *
 * @param {Function} callback The callback
 */
function addSelectionChangeCallback( callback ) {
    var doc = frameWindow.document || frameWindow.contentDocument;
    if( doc && isMobile() ) {
        doc.addEventListener( 'selectionchange', function() {
            var selection = frameWindow.getSelection();
            if( isSelectionInPage( selection ) ) {
                selectedRange = selection.getRangeAt( 0 );
            } else {
                selection = doc.getSelection();
                if( isSelectionInPage( selection ) ) {
                    selectedRange = selection.getRangeAt( 0 );
                }
            }

            if( selectTimeout ) {
                clearTimeout( selectTimeout );
                selectTimeout = null;
            }

            selectTimeout = setTimeout( function() {
                selectTimeout = null;
                callback( 'highlight' );
            }, 1000 );
        } );
    }
}

/**
 * Is the selection in page?
 *
 * @param {Selection} selection the user selection
 * @return {boolean} true if it is in page
 */
function isSelectionInPage( selection ) {
    if( selection && selection.rangeCount > 0 ) {
        var range = selection.getRangeAt( 0 );
        var startPage = findPageByNode( range.startContainer );
        var endPage = findPageByNode( range.endContainer );

        return  startPage >= 0 && endPage >= 0;
    }

    return false;
}

//==================================================
// exported functions
//==================================================
let exports;
export let setViewerContainer = function( container, adjust ) {
    viewerContainer = container;
    adjustBoundingRect = adjust;
};
export let setSelectCallback = function( callback ) {
    selectCallback = callback;
};
export let setFindObjIdCallback = function( callback ) {
    findObjId = callback;
};

export let setIsBodyContentCallback = function( callback ) {
    isBodyContent = callback;
};

export let setMarkupSpanChangedCallback = function( callback ) {
    markupSpanChanged = callback;
};

export let setGetUserSelectionFromSingleClickCallback = function( callback ) {
    getUserSelectionFromSingleClick = callback;
};

export default exports = {
    init,
    setPageTextRoot,
    setViewerContainer,
    getUserSelection,
    clearUserSelection,
    show,
    showAll,
    showAsSelected,
    showCurrentPage,
    findStartEndInfo,
    recalcAllMarkupPositions,
    removeAllMarkupSpans,
    getMarkupHightlight,
    setSelectionEndCallback,
    setSelectCallback,
    setFindObjIdCallback,
    setIsBodyContentCallback,
    setMarkupSpanChangedCallback,
    setMarkupEventListeners,
    setGetUserSelectionFromSingleClickCallback
};
