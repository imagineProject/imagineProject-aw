// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup data for highlighting or drawing markups on the viewer panel
 *
 * @module js/MarkupData
 */

'use strict';
//==================================================
// private variables
//==================================================
/** The list of all users */
export var users = [];
/** The list of all markups */
export var markups = [];
/** The list of all stamps */
export var stamps = [];
/** The list of all symbols */
export var symbols = [];

/** The default user colors */
var userColors = [ 'rgba(255, 0, 0, 0.125)', 'rgba(0, 255, 0, 0.125)', 'rgba(0, 0, 255, 0.125)',
    'rgba(0, 255, 155, 0.125)', 'rgba(155, 0, 255, 0.125)', 'rgba(255, 155, 0, 0.125)',
    'rgba(0, 155, 255, 0.125)', 'rgba(255, 0, 155, 0.125)', 'rgba(155, 255, 0, 0.125)'
];

/** The valid keys to save, including top level key "" */
var validKeys = [ '', 'comment', 'created', 'date', 'initial', 'reference', 'share', 'status',
    'type', 'userid', 'username', 'start', 'end', 'objId', 'viewParam', 'textParam', 'showOnPage',
    'stampName', 'symbolName', 'symbolGroup', 'scale', 'page', 'ch', 'rch', 'x', 'y', 't',
    'angle', 'angle2', 'refImage'
];
/** all properties under geometry are saved except for the following */
var excludeKeys = [ 'fillImage', 'approxPts' ];

//==================================================
// public functions
//==================================================
/**
 * Clear the users
 */
export function clearUsers() {
    users.length = 0;
}

/**
 * Add user
 *
 * @param {String} userid - the user id
 * @param {String} username - the user name
 * @param {String} initial - the user initial
 * @param {String} color - the optional user color
 *
 * @return {Object} the newly added user
 */
export function addUser( userid, username, initial, color ) {
    var user = {};
    user.id = users.length;
    user.userid = userid;
    user.username = username;
    user.initial = initial;
    user.color = color ? color : userColors[ user.id % 9 ];
    user.visible = true;
    user.displayname = username + ( userid.length > 0 ? ' (' + userid + ')' : ' [' + initial + ']' );

    users.push( user );
    return user;
}

/**
 * Find the user by its userid
 *
 * @param {String} userid - the user id
 *
 * @return {Object} the user found, or null if not found
 */
export function findUser( userid ) {
    for( var i = 0; i < users.length; i++ ) {
        if( users[ i ].userid === userid ) {
            return users[ i ];
        }
    }

    return null;
}

/**
 * Find the user of a markup
 *
 * @param {Object} markup - the markup to be checked
 *
 * @return {Object} the user found, or null if not found
 */
export function findUserOfMarkup( markup ) {
    for( var i = 0; i < users.length; i++ ) {
        if( users[ i ].displayname === markup.displayname ) {
            return users[ i ];
        }
    }

    return null;
}

/**
 * Add users from markups
 */
export function addUsersFromMarkups() {
    markups.forEach(
        function( markup ) {
            var user = findUserOfMarkup( markup );
            if( !user ) {
                addUser( markup.userid, markup.username, markup.initial );
            }
        }
    );
}

/**
 * Set User object
 *
 * @param {String} userId - the user id
 * @param {Object} userObj - the user object
 */
export function setUserObj( userId, userObj ) {
    users.forEach(
        function( user ) {
            if( user.userid === userId ) {
                user.userObj = userObj;
            }
        }
    );

    markups.forEach(
        function( markup ) {
            if( markup.userid === userId ) {
                markup.userObj = userObj;
            }
        }
    );
}

/**
 * Clear the markups
 */
export function clearMarkups() {
    markups.length = 0;
}

/**
 * Add a markup
 *
 * @param {String} userid - the user id
 * @param {String} username - the user name
 * @param {String} initial - the user initial
 * @param {Position} start - the start position of the markup
 * @param {Position} end - the end position of the markup
 * @param {String} type - the markup type, either "text" or "2d"
 *
 * @return {Object} the newly added markup
 */
export function addMarkup( userid, username, initial, start, end, type ) {
    var markup = {};
    markup.userid = userid;
    markup.username = username;
    markup.initial = initial;

    markup.date = new Date();
    markup.created = markup.date.toISOString();
    markup.displayname = username + ( userid.length > 0 ? ' (' + userid + ')' : ' [' + initial + ']' );
    markup.start = start;
    markup.end = end;
    markup.type = type;
    markup.comment = '';
    markup.reference = '';
    markup.share = 'public';
    markup.status = 'open';
    markup.visible = true;
    markup.editMode = null;
    markup.selected = false;

    markup.id = markups.length;
    markups.push( markup );
    return markup;
}

/**
 * Compare two markup copies are the same
 *
 * @param {Markup} markup1 - first markup to be compared
 * @param {Markup} markup2 - second markup to be compared
 * @returns {boolean} true if they are the same
 */
export function sameMarkup( markup1, markup2 ) {
    return markup1 === markup2 || markup1.displayname === markup2.displayname && markup1.created === markup2.created;
}

/**
 * Find the markup in markups that is the same as the input copy
 *
 * @param {Markup} markup - the input markup
 * @returns {Markup} the found markup, or null if not found
 */
export function findMarkup( markup ) {
    for( var i = 0; i < markups.length; i++ ) {
        if( sameMarkup( markups[ i ], markup ) ) {
            return markups[i];
        }
    }

    return null;
}

/**
 * Parse markups
 *
 * @param {String} json - the json representation of the markups
 */
export function parseMarkups( json ) {
    parseMarkupsToList( json, markups );
}

/**
 * Parse markups and push them into a list
 *
 * @param {String} json - the json representation of the markups
 * @param {List} list - the list to push into
 * @param {String} idPrefix - the prefix of id
 */
export function parseMarkupsToList( json, list, idPrefix ) {
    var escaped = json.replace( /[\u007f-\uffff]/g, function( c ) {
        return '\\u' + ( '0000' + c.charCodeAt( 0 ).toString( 16 ) ).slice( -4 );
    } );

    var objs = JSON.parse( escaped, function( key, value ) {
        return  key === 'date' ? new Date( value ) :
            key === 'geometry' && typeof value === 'string' ? JSON.parse( value ) : value;
    } );

    for( var i = 0; i < objs.length; i++ ) {
        var markup = objs[ i ];
        markup.id = ( idPrefix ? idPrefix : '' ) + list.length;
        markup.username = markup.username.replace( /\s*\([^)]+\)$/, '' );
        markup.displayname = markup.username +
            ( markup.userid.length > 0 ? ' (' + markup.userid + ')' :
                ' [' + markup.initial + ']' );

        markup.visible = true;
        markup.editMode = null;
        markup.selected = false;
        list.push( markup );
    }
}

/**
 * check valid key for stringifyMarkup
 *
 * to fix SonarQube issue: Define this function outside of a loop
 *
 * @param {String} key - the key
 * @param {Object} value - the value
 *
 * @return {Object} the value if valid or undefined otherwise
 */
function checkValidKey( key, value ) {
    return validKeys.indexOf( key ) >= 0 || !isNaN( key ) ? value : undefined;
}

/**
 * check excluded key under geometry for stringifyMarkup
 *
 * @param {String} key - the key
 * @param {Object} value - the value
 *
 * @return {Object} the value if valid or undefined otherwise
 */
function checkExcludedKey( key, value ) {
    return excludeKeys.indexOf( key ) >= 0 ? undefined : value;
}

/**
 * Stringify the markups
 *
 * @param {boolean} all - true to get all markups, false to get login user's markups
 *
 * @return {String} the json representation of the markups
 */
export function stringifyMarkups( all ) {
    return stringifyMarkupsInList( all, markups );
}

/**
 * Stringify the markups in a given list
 *
 * @param {boolean} all - true to get all markups, false to get login user's markups
 * @param {Markup[]} list - the list containing markups to be stringified
 *
 * @return {String} the json representation of the markups
 */
export function stringifyMarkupsInList( all, list ) {
    var displayname = users.length > 0 ? users[ 0 ].displayname : '';
    var json = '[';
    for( var i = 0; i < list.length; i++ ) {
        var markup = list[ i ];
        if( !markup.deleted && ( all || displayname === markup.displayname ) ) {
            json += ( json === '[' ? '' : ',\n' ) + stringifyMarkup( markup );
        }
    }

    json += ']';
    return json;
}

/**
 * Stringify one markup
 *
 * Note: Only the valid keys are included, with 3 exceptions:
 *
 *    1. geometry will included all its children except fillImage
 *    2. reqData will include all its children without check
 *    3. visData will include all its children without check
 *
 * @param {Markup} markup - the markup to be stringified
 * @returns {String} the json string
 */
export function stringifyMarkup( markup ) {
    var json = JSON.stringify( markup, checkValidKey );
    if( markup.geometry ) {
        var geom = ',"geometry":' + JSON.stringify( markup.geometry, checkExcludedKey ) + '}';
        json = json.replace( /[}]$/, geom );
    }

    if( markup.reqData ) {
        var reqData = ',"reqData":' + JSON.stringify( markup.reqData ) + '}';
        json = json.replace( /[}]$/, reqData );
    }

    if( markup.visData ) {
        var visData = ',"visData":' + JSON.stringify( markup.visData ) + '}';
        json = json.replace( /[}]$/, visData );
    }

    return json.replace( /[\u007f-\uffff]/g, function( c ) {
        return '\\u' + ( '0000' + c.charCodeAt( 0 ).toString( 16 ) ).slice( -4 );
    } );
}

/**
 * Is my markup, i.e. created by the login user?
 *
 * @param {Markup} markup to be tested
 * @return {boolean} true if it is my markup
 */
export function isMyMarkup( markup ) {
    return markup.displayname === users[ 0 ].displayname;
}

/**
 * Clear all markups' editMode and selected
 */
export function clearAllEditMode() {
    markups.forEach( function( markup ) {
        markup.editMode = null;
        markup.selected = false;
    } );
}

/**
 * Clear the stamps
 */
export function clearStamps() {
    stamps.length = 0;
}

/**
 * Parse stamps
 *
 * @param {String} json - the json representation of the stamps
 */
export function parseStamps( json ) {
    parseMarkupsToList( json, stamps, 's' );
}

/**
 * Find stamp with given name
 *
 * @param {String} name - the stamp name to be found
 * @param {String} share as public or private, search all if undefined
 * @returns {Markup} the found stamp, or null if not found
 */
export function findStamp( name, share ) {
    for( var i = 0; i < stamps.length; i++ ) {
        var stamp = stamps[ i ];
        if( !stamp.deleted && ( !share || share === stamp.share ) && stamp.stampName === name ) {
            return stamp;
        }
    }

    return null;
}

/**
 * Add a symbol
 *
 * @param {String} userid - the user id
 * @param {String} username - the user name
 * @param {String} initial - the user initial
 * @param {Position} start - the start position of the symbol
 * @param {Position} end - the end position of the symbol
 * @param {String} name - the symbol name
 * @param {String} share - the share, 'public' or 'private'
 *
 * @return {Object} the newly added symbol
 */
export function addSymbol( userid, username, initial, start, end, name, share ) {
    var symbol = {};
    symbol.userid = userid;
    symbol.username = username;
    symbol.initial = initial;

    symbol.date = new Date();
    symbol.created = symbol.date.toISOString();
    symbol.displayname = username + ( userid.length > 0 ? ' (' + userid + ')' : ' [' + initial + ']' );
    symbol.start = start;
    symbol.end = end;
    symbol.type = '2d';
    symbol.symbolName = name;
    symbol.comment = '';
    symbol.share = share;
    symbol.status = 'open';
    symbol.showOnPage = 'all';
    symbol.visible = true;
    symbol.editMode = null;
    symbol.selected = false;

    symbol.id = 'b' + symbols.length;
    symbols.push( symbol );
    return symbol;
}

/**
 * Clear the symbols
 */
export function clearSymbols() {
    symbols.length = 0;
}

/**
 * Parse symbols
 *
 * @param {String} json - the json representation of the symbols
 */
export function parseSymbols( json ) {
    parseMarkupsToList( json, symbols, 'b' );
}

/**
 * Find symbol with given name
 *
 * @param {String} name - the symbol name to be found
 * @param {String} share - as public or private, search all if undefined
 * @param {String} group - the group name, search all in share if undefined
 * @returns {Markup} the found symbol, or null if not found
 */
export function findSymbol( name, share, group ) {
    for( var i = 0; i < symbols.length; i++ ) {
        var symbol = symbols[ i ];
        if( !symbol.deleted && ( !share || share === symbol.share ) &&
            ( !group || group === symbol.symbolGroup ) && name === symbol.symbolName ) {
            return symbol;
        }
    }

    return null;
}

//==================================================
// exported functions
//==================================================
let exports;

export default exports = {
    users,
    clearUsers,
    addUser,
    setUserObj,
    findUser,
    findUserOfMarkup,
    addUsersFromMarkups,
    markups,
    clearMarkups,
    addMarkup,
    sameMarkup,
    findMarkup,
    parseMarkups,
    parseMarkupsToList,
    stringifyMarkup,
    stringifyMarkups,
    stringifyMarkupsInList,
    isMyMarkup,
    clearAllEditMode,
    stamps,
    clearStamps,
    parseStamps,
    findStamp,
    symbols,
    addSymbol,
    clearSymbols,
    parseSymbols,
    findSymbol
};
