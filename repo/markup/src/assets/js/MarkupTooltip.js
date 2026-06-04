// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/MarkupTooltip
 */

//==================================================
// private variables
//==================================================
/** The markupThread */
var thread = null;
/** The container to show tooltip */
var container = null;
/** The owner document */
var ownerDoc = null;
/** The markup currently shown tooltip */
var currentMarkup = null;
/** The currently shown tooltip */
var currentTooltip = null;
/** The resources */
var resources = {};
/** The command callback */
var commandCallback = null;
/** The tooltip color */
var color = 'rgb(0, 0, 0)';
/** The tooltip background color */
var bgColor = 'rgb(255, 255, 222)';
/** The tooltip border color */
var borderColor = 'rgb(32, 32, 32)';
/** The tooltip width */
var width = 350;
/** The tooltip max height */
var maxHeight = 300;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param {MarkupThread} inThread The MarkupThread
 */
export function init( inThread ) {
    thread = inThread;
    commandCallback = null;
}

/**
 * Show tool tip
 *
 * @param {Element} inContainer The container to be shown with markup tooltip
 * @param {Markup} inMarkup The markup to be shown with its tooltip
 * @param {Rectangle} boundingRect The bounding rectangle in screen coordinates
 * @param {Boolean} adjust if true adjust the boundingRect
 */
export function showTooltip( inContainer, inMarkup, boundingRect, adjust ) {
    container = inContainer;
    currentMarkup = inMarkup;
    ownerDoc = container.ownerDocument;
    var divMarkups = ownerDoc.getElementById( 'markupTooltip' );
    var divArrowFace = ownerDoc.getElementById( 'markupArrowFace' );
    var divArrowBorder = ownerDoc.getElementById( 'markupArrowBorder' );

    if( !divMarkups || !divArrowFace || !divArrowBorder ) {
        divMarkups = ownerDoc.createElement( 'div' );
        divMarkups.id = 'markupTooltip';
        divMarkups.style.borderStyle = 'solid';
        divMarkups.style.borderColor = borderColor;
        divMarkups.style.borderWidth = '1px';
        divMarkups.style.borderRadius = '6px';
        divMarkups.style.padding = '6px';
        divMarkups.style.width = width + 'px';
        divMarkups.style.maxHeight = maxHeight + 'px';
        divMarkups.style.color = color;
        divMarkups.style.backgroundColor = bgColor;
        divMarkups.style.position = 'absolute';
        divMarkups.style.font = '9pt verdana,arial,sans-serif';
        divMarkups.style.overflow = 'auto';
        divMarkups.style.zIndex = '1001001';

        divMarkups.addEventListener( 'mouseenter', enterTooltip, false );
        divMarkups.addEventListener( 'mouseleave', leaveTooltip, false );
        ownerDoc.body.appendChild( divMarkups );

        divArrowFace = ownerDoc.createElement( 'div' );
        divArrowFace.id = 'markupArrowFace';
        divArrowFace.style.borderStyle = 'solid';
        divArrowFace.style.borderColor = 'transparent';
        divArrowFace.style.borderWidth = '10px';
        divArrowFace.style.width = '0px';
        divArrowFace.style.height = '0px';
        divArrowFace.style.position = 'absolute';
        divArrowFace.style.zIndex = '1001002';
        divArrowFace.style.pointerEvents = 'none';
        ownerDoc.body.appendChild( divArrowFace );

        divArrowBorder = divArrowFace.cloneNode( true );
        divArrowBorder.id = 'markupArrowBorder';
        divArrowBorder.style.zIndex = '1001000';
        divArrowBorder.style.pointerEvents = 'none';
        ownerDoc.body.appendChild( divArrowBorder );

        var ulSheet = ownerDoc.createElement( 'style' );
        ulSheet.innerHTML = 'div#markupTooltip ul { list-style: disc outside; }';
        ownerDoc.body.appendChild( ulSheet );

        var olSheet = ownerDoc.createElement( 'style' );
        olSheet.innerHTML = 'div#markupTooltip ol { list-style: decimal outside; }';
        ownerDoc.body.appendChild( olSheet );
    }

    while( divMarkups.hasChildNodes() ) {
        divMarkups.removeChild( divMarkups.firstChild );
    }
    var markups = thread.getAllMarkupsInThread( inMarkup );
    divMarkups.appendChild( createContent( markups ) );

    var containerRect = container.getBoundingClientRect();
    var adjustLeft = adjust ? containerRect.left : 0;
    var adjustTop = adjust ? containerRect.top : 0;
    var center = ( boundingRect.left + boundingRect.right ) / 2 + adjustLeft;
    var left = center - width / 2;

    if( left < containerRect.left ) {
        left = containerRect.left;
    }

    if( left + width > containerRect.left + container.clientWidth ) {
        left = containerRect.left + container.clientWidth - width;
    }

    var top = boundingRect.bottom + 10 + adjustTop;
    var arrowTop = boundingRect.bottom - 10 + adjustTop;

    divMarkups.style.top = top + 'px';
    divMarkups.style.left = left + 'px';
    divMarkups.style.display = 'block';

    var height = divMarkups.clientHeight;
    var arrowUp =  top + height <= containerRect.top + container.clientHeight;

    if( arrowUp ) {
        divArrowFace.style.borderColor = 'transparent transparent ' + bgColor + ' transparent';
        divArrowBorder.style.borderColor = 'transparent transparent ' + borderColor + ' transparent';
    } else {
        top = boundingRect.top - 10 - height + adjustTop;
        arrowTop = boundingRect.top - 10 + adjustTop;
        divMarkups.style.top = top + 'px';

        divArrowFace.style.borderColor = bgColor + ' transparent transparent transparent';
        divArrowBorder.style.borderColor = borderColor + ' transparent transparent transparent';
    }

    divArrowFace.style.top =  arrowTop + ( arrowUp ? 1 : -1 )  + 'px';
    divArrowFace.style.left =  center - 10  + 'px';
    divArrowFace.style.display = 'block';

    divArrowBorder.style.top = arrowTop + 'px';
    divArrowBorder.style.left =  center - 10  + 'px';
    divArrowBorder.style.display = 'block';
}

/**
 * Clear the currently shown tooltip
 *
 * @param {string} type The type of tooltip to be cleared
 *
 */
export function clearTooltip( type ) {
    if( container && currentMarkup && ( !type || type === currentMarkup.type ) ) {
        var divMarkups = ownerDoc.getElementById( 'markupTooltip' );
        var divArrowFace = ownerDoc.getElementById( 'markupArrowFace' );
        var divArrowBorder = ownerDoc.getElementById( 'markupArrowBorder' );

        if( divMarkups && divArrowFace && divArrowBorder ) {
            divMarkups.style.display = 'none';
            divArrowFace.style.display = 'none';
            divArrowBorder.style.display = 'none';
        }
        currentMarkup = null;
    }
}

/**
 * Hide the currently shown tooltip after a delay
 *
 * @param {string} type The type of tooltip to hide
 * @param {Number} delay of milliseconds
 *
 */
export function hideTooltip( type, delay ) {
    if( delay > 0 ) {
        window.setTimeout( function() {
            if( !currentTooltip ) {
                clearTooltip( type );
            }
        }, delay );
    } else {
        clearTooltip( type );
    }
}

/**
 * Add resource
 *
 * @param {String} name - the resource name
 * @param {Object} value - the resource value
 */
export function addResource( name, value ) {
    resources[ name ] = value;
}

/**
 * Set the command callback function
 *
 * @param {function} callback - the callback function
 */
export function setCommandCallback( callback ) {
    commandCallback = callback;
}

//==================================================
// private functions
//==================================================
/**
 * enter tooltip listener
 *
 * @param {Event} event The event
 */
function enterTooltip( event ) {
    currentTooltip = event.target;
}

/**
 * leave tooltip listener
 *
 * @param {Event} event The event
 */
function leaveTooltip( event ) {
    clearTooltip();
    currentTooltip = null;
}

/**
 * Create content from markups in a thread
 *
 * @param {Markup[]} markups - the markups in thread
 * @returns {Element} the div element
 */
function createContent( markups ) {
    if( markups.length === 1 ) {
        return createOne( markups[0], true );
    }

    const divAll = ownerDoc.createElement( 'div' );
    divAll.appendChild( createStatus( markups ) );

    for( var i = 0; i < markups.length; i++ ) {
        divAll.appendChild( createOne( markups[ i ] ) );
    }

    return divAll;
}

/**
 * Create content from one markup
 *
 * @param {Markup} markup - the markup to create
 * @param {Boolean} showReply - show the reply button if true
 * @returns {Element} the div element
 */
function createOne( markup, showReply ) {
    const divOne = ownerDoc.createElement( 'div' );

    if( commandCallback ) {
        divOne.style.display = 'flex';

        const divLeft = ownerDoc.createElement( 'div' );
        divLeft.style.flex = '1 1 auto';
        divLeft.innerHTML = createHTML( markup );
        divOne.appendChild( divLeft );

        const divRight = ownerDoc.createElement( 'div' );
        divRight.style.flex = '0 0 16px';
        divOne.appendChild( divRight );

        if( markup.isEditable ) {
            divRight.appendChild( createCmd( 'cmdEdit', markup ) );
        }

        if( markup.isReplyable && showReply ) {
            divRight.appendChild( createCmd( 'cmdReply', markup ) );
        }

        if( markup.isDeletable ) {
            divRight.appendChild( createCmd( 'cmdDelete', markup ) );
        }
    } else {
        divOne.innerHTML = createHTML( markup );
    }

    return divOne;
}

/**
 * Create a command
 *
 * @param {String} id - the command id
 * @param {Markup} markup - the markup of the command
 *
 * @returns {Element} the img element
 */
function createCmd( id, markup ) {
    const imgCmd = ownerDoc.createElement( 'img' );

    imgCmd.id = id;
    imgCmd.markup = markup;
    imgCmd.style.width = '16px';
    imgCmd.style.height = '16px';
    imgCmd.style.marginTop = '4px';
    imgCmd.style.cursor = 'pointer';
    imgCmd.src = resources.images[ id ];
    imgCmd.addEventListener( 'click', cmdClicked, false );

    return imgCmd;
}

/**
 * Create HTML from markup
 *
 * @param {Markup} markup - the markup
 * @returns {String} the HTML of the markup
 */
function createHTML( markup ) {
    const className = 'aw-markup-tooltip';
    return '<p class="' + className + '"><strong>' +
        markup.displayname + '</strong> ' +
        markup.date.toLocaleString() + '</p>' + markup.comment;
}

/**
 * Command click event handler
 *
 * @param {Event} event - the event
 */
function cmdClicked( event ) {
    if( commandCallback ) {
        commandCallback( event.currentTarget.id, event.currentTarget.markup );
    }
}

/**
 * Create status and the reply command
 *
 * @param {Markup[]} markups - all markups in a thread
 * @returns {Element} the div element
 */
function createStatus( markups ) {
    const status = markups[ markups.length - 1 ].status;
    const markup = markups.find( ( m ) => { return m.isReplyable; } );
    const divStatus = ownerDoc.createElement( 'div' );

    if( commandCallback && markup ) {
        divStatus.style.display = 'flex';

        const divLeft = ownerDoc.createElement( 'div' );
        divLeft.style.marginTop = '4px';
        divLeft.style.flex = '1 1 auto';
        divLeft.innerHTML = resources.i18n[ status ];
        divStatus.appendChild( divLeft );

        const divRight = ownerDoc.createElement( 'div' );
        divRight.style.flex = '0 0 16px';
        divRight.appendChild( createCmd( 'cmdReply', markup ) );
        divStatus.appendChild( divRight );
    } else {
        divStatus.innerHTML = resources.i18n[ status ];
    }

    return divStatus;
}

//==================================================
// exported functions
//==================================================
let exports;

export default exports = {
    init,
    showTooltip,
    clearTooltip,
    hideTooltip,
    addResource,
    setCommandCallback
};
