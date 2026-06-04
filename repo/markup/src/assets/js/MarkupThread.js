// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup thread for replying markups
 *
 * @module js/MarkupThread
 */

'use strict';
//==================================================
// private variables
//==================================================
/** the map to store the markup threads */
var threadMap = {};

/** The status list */
export var statusList = [ "open", "replied", "resolved", "rejected", "reopened" ];

//==================================================
// public functions
//==================================================
/**
 * Add markups to thread map
 *
 * @param {Markup} the array of markups
 * @param {int} start the first markup id
 * @param {int} end the last markup id + 1, typically the current length of markups
 */
export function addToThreads( markups, start, end ) {
    for( var i = start; i < end; i++ ) {
        add( markups[ i ] );
    }
}

/**
 * Compare position of two markups
 *
 * @param {Markup} markup0 the first markup
 * @param {Markup} markup1 the second markup
 * @return {int} markup0 < markup1? -1: markup0 > markup1? 1: 0;
 */
export function comparePosition( markup0, markup1 ) {
    var result = comparePos( markup0.start, markup1.start );
    if( result === 0 ) {
        result = comparePos( markup0.end, markup1.end );
    }

    return result;
}

/**
 * Compare date of two markups
 *
 * @param {Markup} markup0 the first markup
 * @param {Markup} markup1 the second markup
 * @return {number} markup0 < markup1? -1: markup0 > markup1? 1: 0;
 */
export function compareDate( markup0, markup1 ) {
    return markup0.date.getTime() - markup1.date.getTime();
}

/**
 * Compare status of two markups, as ordered in the statusList
 *
 * @param {Markup} markup0 the first markup
 * @param {Markup} markup1 the second markup
 * @return {int} markup0 < markup1? -1: markup0 > markup1? 1: 0;
 */
export function compareStatus( markup0, markup1 ) {
    var status0 = statusList.indexOf( getStatus( markup0 ) );
    var status1 = statusList.indexOf( getStatus( markup1 ) );

    return status0 - status1;
}

/**
 * Add a markup into the thread map
 *
 * @param {Markup} markup the markup to be added
 */
export function add( markup ) {
    if( comparePos( markup.start, markup.end ) === 0 || markup.deleted ) {
        return;
    }

    var key = getKey( markup );
    var list = threadMap[ key ];

    if( !list ) {
        list = [];
        threadMap[ key ] = list;
    }

    if( list.indexOf( markup ) >= 0 ) {
        return;
    }

    for( var i = 0; i < list.length; i++ ) {
        if( compareDate( markup, list[ i ] ) < 0 ) {
            list.splice( i, 0, markup );
            return;
        }
    }

    list.push( markup );
}

/**
 * Remove markup from the thread map
 *
 * @param {Markup} the markup to be removed
 */
export function remove( markup ) {
    var key = getKey( markup );
    var list = threadMap[ key ];
    if( list ) {
        var index = list.indexOf( markup );
        if( index >= 0 ) {
            list.splice( index, 1 );
        }
    }
}

/**
 * Is the markup in thread?
 *
 * @param {Markup} the markup to be tested
 * @param {String} where "any" (default), "first", "rest", "last", or "frozen"
 * @return {boolean} true if it is in a thread
 */
export function isInThread( markup, where ) {
    var key = getKey( markup );
    var list = threadMap[ key ];
    if( !list || list.length <= 1 ) {
        return false;
    }

    if( !where || where === "any" ) {
        return true;
    } else if( where === "first" ) {
        return list[ 0 ] === markup;
    } else if( where === "last" ) {
        return list[ list.length - 1 ] === markup;
    } else if( where === "rest" ) {
        for( var i = 1; i < list.length; i++ ) {
            if( markup === list[ i ] ) {
                return true;
            }
        }
    } else {
        // frozen in thread
        for( var j = list.length - 1; j >= 0; j-- ) {
            if( markup === list[ j ] ) {
                return false;
            }

            if( markup.displayname !== list[ j ].displayname ) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get the markup status, determined by its thread
 *
 * @param {Markup} the markup to look
 * @return {String} the status
 */
export function getStatus( markup ) {
    var key = getKey( markup );
    var list = threadMap[ key ];
    return list && list.length > 1 ? list[ list.length - 1 ].status : "open";
}

/**
 * Get the first markup in the thread of the given markup
 *
 * @param {Markup} the given markup
 * @return {Markup} the first markup in thread, or itself if not in a thread
 */
export function getFirstMarkupInThread( markup ) {
    var key = getKey( markup );
    var list = threadMap[ key ];
    return list && list.length > 0 ? list[ 0 ] : markup;
}

/**
 * Get all the markups in the same thread of the given markup
 *
 * @param {Markup} the given markup
 * @return [Markup] all the markups in the same thread
 */
export function getAllMarkupsInThread( markup ) {
    var key = getKey( markup );
    var list = threadMap[ key ];
    var array = [];

    if( list && list.length > 0 ) {
        for( var i = 0; i < list.length; i++ ) {
            array.push( list[ i ] );
        }
    } else {
        array.push( markup );
    }

    return array;
}

//==================================================
// private functions
//==================================================
/**
 * Get the markup key for the thread
 *
 * @param {Markup} the markup
 * @return {String} the key
 */
function getKey( markup ) {
    return JSON.stringify( markup.start ) + "," + JSON.stringify( markup.end );
}

/**
 * Compare two positions
 *
 * @param {Position} pos0 the first position
 * @param {Position} pos1 the second position
 * @return {Number} pos0 < pos1? -n: pos0 > pos1? +n: 0;
 */
function comparePos( pos0, pos1 ) {
    if( pos0.page >= 0 && pos1.page >= 0 ) {
        if( pos0.page !== pos1.page ) {
            return pos0.page - pos1.page;
        }
        if( pos0.ch >= 0 && pos1.ch >= 0 ) {
            return pos0.ch - pos1.ch;
        }
        if( pos0.t >= 0 && pos1.t >= 0 ) {
            return pos0.t - pos1.t;
        }
        if( pos0.y !== undefined && pos1.y !== undefined ) {
            return pos0.y !== pos1.y ? pos0.y - pos1.y : pos0.x - pos1.x;
        }
        return pos0.ch >= 0 ? -1 : 1;
    }

    return 0;
}

//==================================================
// exported functions
//==================================================
let exports;
export let clear = function() {
    threadMap = {};
};

export default exports = {
    statusList,
    clear,
    addToThreads,
    comparePosition,
    compareDate,
    compareStatus,
    add,
    remove,
    isInThread,
    getStatus,
    getFirstMarkupInThread,
    getAllMarkupsInThread
};
