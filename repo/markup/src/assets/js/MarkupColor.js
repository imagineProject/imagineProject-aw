// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/MarkupColor
 */

'use strict';
//==================================================
// private variables
//==================================================
/** The list of all users */
var users = [];
/** The markupThread */
var thread = null;

//==================================================
// public functions
//==================================================
/**
 * Initialize this module
 *
 * @param [User] inUsers The list of users
 * @param {MarkupThread} inThread The MarkupThread
 */
export function init( inUsers, inThread ) {
    users = inUsers;
    thread = inThread;
}

/**
 * Get the color of a markup
 *
 * @param {Markup} inMarkup The markup to be shown
 *
 * @return {Color} the color of the markup
 */
export function getColor( inMarkup ) {
    var markup = thread.getAllMarkupsInThread( inMarkup )[ 0 ];
    if( !markup ) {
        return null;
    }

    if( markup.color && markup.color.length > 0 ) {
        return markup.color;
    }

    for( var i = 0; i < users.length; i++ ) {
        if( markup.displayname === users[ i ].displayname ) {
            return users[ i ].color;
        }
    }

    return null;
}

/**
 * Convert the color into solid, i.e. totally opaque
 *
 * @param {Color} the original color
 *
 * @return {Color} the solid color
 */
export function toSolidColor( color ) {
    if( color && color.indexOf( 'rgba' ) === 0 ) {
        return 'rgb' + color.substring( 4, color.lastIndexOf( ',' ) ) + ')';
    }

    return color;
}

/**
 * Convert the color into richer color, i.e. less transparent
 *
 * @param {Color} the original color
 *
 * @return {Color} the richer color
 */
export function toRichColor( color ) {
    var v = toRGBA( color );
    if( !v ) {
        return color;
    }

    var a = v[ 3 ] * 2;
    v[ 3 ] =  a < 0 ? 0 : a > 1 ? 1 : a.toFixed( 3 );

    return 'rgba(' + v[ 0 ] + ', ' + v[ 1 ] + ', ' + v[ 2 ] + ', ' + v[ 3 ] + ')';
}

/**
 * Convert the color into dark color
 *
 * @param {Color} the original color
 *
 * @return {Color} the richer color
 */
export function toDarkColor( color ) {
    var v = toRGBA( color );
    if( !v ) {
        return color;
    }

    for( var i = 0; i < 3; i++ ) {
        var val = v[ i ] / 3;
        v[ i ] =  val < 0 ? 0 : val > 255 ? 255 : val.toFixed();
    }

    return 'rgb(' + v[ 0 ] + ', ' + v[ 1 ] + ', ' + v[ 2 ] + ')';
}

/**
 * Convert the color into array of RGBA values
 *
 * @param {Color} the original color
 *
 * @return [r, g, b, a] the array of RGBA values
 */
export function toRGBA( color ) {
    if( !color || color.indexOf( 'rgb' ) !== 0 ) {
        return null;
    }

    var v = color.substring( color.indexOf( '(' ) + 1 ).split( ',' );
    for( var i = 0; i < v.length; i++ ) {
        v[ i ] = parseFloat( v[ i ] );
    }

    if( v.length < 4 ) {
        v.push( 1.0 );
    }

    return v;
}

/**
 * Combine RGBA values into one color
 *
 * @param [r, g, b, a] base the base color
 * @param [r, g, b, a] plus the color to be added
 * @param [r, g, b, a] minus the color to be subtracted
 *
 * @return {Color} the combined color
 */
export function fromRGBA( base, plus, minus ) {
    var v1 =  base ? base : [ 0, 0, 0, 0 ];
    var v2 =  plus ? plus : [ 0, 0, 0, 0 ];
    var v3 =  minus ? minus : [ 0, 0, 0, 0 ];
    var a1 = v1[ 3 ];
    var a2 = v2[ 3 ];
    var a3 = v3[ 3 ];
    var a = a1 + a2 - a3;

    if( a < 0.01 ) {
        return '';
    }

    if( a > 1 ) {
        a = 1;
    }

    var v = [];
    for( var i = 0; i < 3; i++ ) {
        var val = ( v1[ i ] * a1 + v2[ i ] * a2 - v3[ i ] * a3 ) / a;
        v[ i ] =  val <= 0 ? 0 : val >= 255 ? 255 : val.toFixed();
    }

    return 'rgba(' + v[ 0 ] + ', ' + v[ 1 ] + ', ' + v[ 2 ] + ', ' + a.toFixed( 3 ) + ')';
}

/**
 * Convert the color into array of CMY values
 *
 * @param {Color} the original color
 *
 * @return [c, m, y] the array of CMY values
 */
export function toCMY( color ) {
    if( !color || color.charAt( 0 ) !== '#' ) {
        return null;
    }

    var r = parseInt( color.substring( 1, 3 ), 16 );
    var g = parseInt( color.substring( 3, 5 ), 16 );
    var b = parseInt( color.substring( 5, 7 ), 16 );

    return [ 255 - r, 255 - g, 255 - b ];
}

/**
 * Combine CMY values into one color
 *
 * @param [c, m, y] base the base CMY value
 * @param [c, m, y] plus the CMY value to be added
 * @param [c, m, y] minus the CMY value to be subtracted
 *
 * @return {Color} the combined color
 */
export function fromCMY( base, plus, minus ) {
    var v1 =  base ? base : [ 0, 0, 0 ];
    var v2 =  plus ? plus : [ 0, 0, 0 ];
    var v3 =  minus ? minus : [ 0, 0, 0 ];
    var v = [ 0, 0, 0 ];

    for( var i = 0; i < 3; i++ ) {
        var val = v1[ i ] + v2[ i ] - v3[ i ];
        v[ i ] =  val <= 0 ? 255 : val >= 255 ? 0 : 255 - Math.floor( val );
    }

    return '#' + Number( 0x1000000 + v[ 0 ] * 0x10000 + v[ 1 ] * 0x100 + v[ 2 ] ).toString( 16 ).substring( 1 );
}

/**
 * Convert color from rgba to hex format
 *
 * @param {Color} color - in rgba format
 * @return {Color} color in hex format
 */
export function toHex( color ) {
    if( color.startsWith( '#' ) ) {
        return color;
    }

    var v = toRGBA( color );
    var hex = '#' + Number( 0x1000000 + v[ 0 ] * 0x10000 + v[ 1 ] * 0x100 + v[ 2 ] ).toString( 16 ).substring( 1, 7 );
    if( v[ 3 ] < 1.0 ) {
        hex += Number( 0x100 + v[ 3 ] * 256 ).toString( 16 ).substring( 1, 3 );
    }
    return hex;
}

/**
 * Convert color from hex to rgba format
 *
 * @param {Color} hex - color in hex format #RRGGBBBAA
 * @return {Color} color in rgba format
 */
export function fromHex( hex ) {
    if( hex.startsWith( '#' ) ) {
        var r = parseInt( hex.substring( 1, 3 ), 16 );
        var g = parseInt( hex.substring( 3, 5 ), 16 );
        var b = parseInt( hex.substring( 5, 7 ), 16 );
        var a = hex.length > 7 ? parseInt( hex.substring( 7, 9 ), 16 ) / 255 : 1;
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a.toFixed( 3 ) + ')';
    }
    return hex;
}

//==================================================
// private functions
//==================================================

//==================================================
// exported functions
//==================================================
let exports;
export let getMyColor = function() {
    return users[ 0 ].color;
};

export default exports = {
    init,
    getColor,
    getMyColor,
    toSolidColor,
    toRichColor,
    toDarkColor,
    toRGBA,
    fromRGBA,
    toCMY,
    fromCMY,
    toHex,
    fromHex
};
