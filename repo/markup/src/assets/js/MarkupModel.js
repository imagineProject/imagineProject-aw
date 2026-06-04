// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup model for highlighting or drawing markups on the viewer panel
 *
 * @module js/MarkupModel
 */
import markupData from 'js/MarkupData';
import markupThread from 'js/MarkupThread';
import markupOperation from 'js/MarkupOperation';
import markupCanvas from 'js/MarkupCanvas';
import markupGeom from 'js/MarkupGeom';
import markupColor from 'js/MarkupColor';

//==================================================
// private variables
//==================================================
/** All markups */
var markups = markupData.markups;
/** All users */
var users = markupData.users;
/** The list of markups to be shown */
var markupList = [];
/** The list of stamps to be shown */
var stampList = [];
/** The version */
var version = '';
/** The message */
var message = '';
/** The role */
var role = '';
/** The sort by */
var sortBy = 'page';
/** The filter text */
var filter = '';
/** The list of filters */
var filterList = [];
/** The login user id */
var loginUserId = '';
/** The login user name */
var loginUserName = '';
/** The user names */
var userNames = [];
/** The current selected markup */
var currentSelect = null;
/** The previous selected markup */
var previousSelect = null;
/** The current editing markup */
var currentEdit = null;
/** The current positioning markup */
var currentPos = null;
/** The current selected stamp */
var currentStamp = null;
/** The original markup before editing */
var originalMarkup = null;
/** The editing markup geom need update */
var needUpdateGeom = false;
/** The editing markup html need update */
var needUpdateHtml = false;
/** The current selected symbols */
var currentSymbols = null;
/** The current symbol size */
var symbolSize = 32;

//==================================================
// public functions
//==================================================
/**
 * Set the login user
 *
 * @param {String} id the login user id
 * @param {String} name the login user name
 */
export function setLoginUser( id, name ) {
    loginUserId = id;
    loginUserName = name;
}

/**
 * Clear the markup list
 */
export function clearMarkupList() {
    for( var i = 0; i < markups.length; i++ ) {
        markups[ i ].visible = false;
    }

    // remove all markups
    markupOperation.showAll( 2 );
    markupList.length = 0;
}

/**
 * Process the markups
 *
 * @param {String} ver the version
 * @param {String} mes the message
 * @param {String} json the markups in json
 */
export function processMarkups( ver, mes, json ) {
    version = ver;
    message = mes;
    role = mes ? mes.split( ' ' )[0] : '';

    if( message.indexOf( 'up_to_date' ) < 0 ) {
        if( message.indexOf( 'append' ) < 0 ) {
            markupData.clearMarkups();
            markupData.clearUsers();
            markupThread.clear();
            markupData.addUser( loginUserId, loginUserName, loginUserId );
        }

        var start = markups.length;
        markupData.parseMarkups( json );
        markupData.addUsersFromMarkups();

        var end = markups.length;
        markupThread.addToThreads( markups, start, end );
    }

    sortBy = 'page';
    filter = '';
    filterList = [];
}

/**
 * Update the markup list
 *
 * @return {Markup} the updated markup list
 */
export function updateMarkupList() {
    clearMarkupList();

    // Show all markups that are visible
    for( var i = 0; i < markups.length; i++ ) {
        var markup = markups[ i ];

        markup.isEditable = isEditable( markup );
        markup.isReplyable = isReplyable( markup );
        markup.isDeletable = isDeletable( markup );
        markup.isIndented = isIndented( markup );
        markup.visible = markup.editMode || !markup.deleted && filterMarkup( markup );
        if( markup.visible ) {
            markupList.push( markup );
        }
    }

    // show all visible markups
    markupOperation.showAll();
    return sortMarkupList();
}

/**
 * Process the stamps
 *
 * @param {String} ver the version
 * @param {String} mes the message
 * @param {String} json the stamps in json
 */
export function processStamps( ver, mes, json ) {
    if( mes.indexOf( 'up_to_date' ) < 0 ) {
        if( mes.indexOf( 'append' ) < 0 ) {
            markupData.clearStamps();
        }
        markupData.parseStamps( json );
    }
}

/**
 * Update the stamp list
 *
 * @return {Markup[]} the updated stamp list
 */
export function updateStampList() {
    stampList.length = 0;

    for( const element of markupData.stamps ) {
        let stamp = element;
        stamp.visible = stamp.stampName && !stamp.deleted && filterStamp( stamp );
        if( stamp.visible ) {
            stampList.push( stamp );
        }
    }

    sortStampList();
    return stampList;
}

/**
 * Get the stamp list
 *
 * @returns {Markup[]} the stamp list
 */
export function getStampList() {
    return stampList;
}

/**
 * Find stamp with given name
 *
 * @param {String} name - the stamp name to be found
 * @param {String} share as public or private, search all if undefined
 * @returns {Markup} the found stamp, or null if not found
 */
export function findStamp( name, share ) {
    return markupData.findStamp( name, share );
}

/**
 * Copy markup as stamp
 *
 * @param {Markup} markup to be copied as stamp
 * @param {String} name the stamp name
 * @param {String} share as public or private
 *
 * @returns {Markup} the new stamp
 */
export function copyMarkupAsStamp( markup, name, share ) {
    var stamp = findStamp( name, share );

    if( !stamp ) {
        stamp = {};
        stamp.userid = markup.userid;
        stamp.username = markup.username;
        stamp.initial = markup.initial;
        stamp.displayname = markup.displayname;

        stamp.date = new Date();
        stamp.created = stamp.date.toISOString();
        stamp.id = 's' + markupData.stamps.length;
        markupData.stamps.push( stamp );
    } else {
        stamp.date = new Date();
    }

    stamp.stampName = name;
    stamp.comment = markup.comment;
    stamp.showOnPage = markup.showOnPage;
    stamp.share = share;
    stamp.type = markup.type;
    stamp.geometry = { list: [] };
    stamp.start = { page: 0, x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    stamp.end = { page: 0, x: -Number.MAX_VALUE, y: -Number.MAX_VALUE };

    var cStr = markup.comment.match( /style="color:[^;"]+/ );
    var color = cStr ? cStr[0].substring( 13 ) : '#000000';
    var vp = markupCanvas.getViewParam();

    for( var i = 0; i < markup.geometry.list.length; i++ ) {
        var geom = markup.geometry.list[i];
        var stampGeom = markupGeom.geomWorldToScreen( geom, vp );

        stampGeom.angle = geom.angle !== undefined ? 0 : undefined;
        stampGeom.cornerRadius = geom.cornerRadius;
        stampGeom.fill = geom.fill ? Object.assign( {}, geom.fill ) : undefined;
        stampGeom.fillImage = geom.fillImage;

        if( !geom.stroke ) {
            stampGeom.stroke = { style: 'solid', width: 2, color: color };
        } else if( geom.stroke.style === 'none' ) {
            stampGeom.stroke = { style: 'none' };
        } else {
            var w = geom.stroke.width;
            stampGeom.stroke = {
                style: geom.stroke.style,
                width: w === 'min' ? 0.5 : w === 'mid' ? 2 : w * vp.scale,
                color: geom.stroke.color !== '' ? geom.stroke.color : color
            };
        }

        var bbox = markupGeom.getGeomBbox( stampGeom );
        stamp.start.x = Math.min( bbox.xmin, stamp.start.x );
        stamp.start.y = Math.min( bbox.ymin, stamp.start.y );
        stamp.end.x = Math.max( bbox.xmax, stamp.end.x );
        stamp.end.y = Math.max( bbox.ymax, stamp.end.y );
        stamp.geometry.list.push( stampGeom );
    }

    if( markup.showOnPage && markup.textParam ) {
        var textParam = Object.assign( {}, markup.textParam );
        var swap = textParam.x * textParam.y < 0;

        textParam.x = -Math.abs( textParam.x );
        textParam.y = ( swap ? 1 : -1 ) * Math.abs( textParam.y );
        textParam.scale /= vp.scale;
        stamp.textParam = textParam;

        stampGeom.angle = swap ? Math.PI / 2 : 0;
    }

    updateStampList();
    return stamp;
}

/**
 * Copy stamp as markup
 *
 * @param {Markup} stamp - the stamp to be copied as markup
 * @param {Point} posGeom - the first geom in world coord, use it to shift other geoms, if any
 * @return {Markup} the new markup
 */
export function copyStampAsMarkup( stamp, posGeom ) {
    var markup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, {}, {}, stamp.type );
    var vp = markupCanvas.getViewParam();
    var index = markupCanvas.getCurrentIndex();
    var dx = 0;
    var dy = 0;

    markup.comment = stamp.comment;
    markup.showOnPage = stamp.showOnPage;
    markup.viewParam = markupOperation.getViewParam();
    markup.userObj = users[ 0 ].userObj;

    markup.geometry = { list: [] };
    markup.start = { page: index, x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    markup.end = { page: index, x: -Number.MAX_VALUE, y: -Number.MAX_VALUE };

    for( var i = 0; i < stamp.geometry.list.length; i++ ) {
        var stampGeom = stamp.geometry.list[i];
        var geom = markupGeom.geomScreenToWorld( stampGeom, vp );
        if( i === 0 ) {
            dx = geom.center ? posGeom.center.x - geom.center.x :
                geom.startPt ? posGeom.startPt.x - geom.startPt.x :
                    geom.vertices ? posGeom.vertices[0].x - geom.vertices[0].x : 0;
            dy = geom.center ? posGeom.center.y - geom.center.y :
                geom.startPt ? posGeom.startPt.y - geom.startPt.y :
                    geom.vertices ? posGeom.vertices[0].y - geom.vertices[0].y : 0;
        }

        if( geom.center ) {
            geom.center.x += dx;
            geom.center.y += dy;
        } else if( geom.startPt && geom.endPt ) {
            geom.startPt.x += dx;
            geom.startPt.y += dy;
            geom.endPt.x += dx;
            geom.endPt.y += dy;
        } else if( geom.vertices ) {
            geom.vertices.forEach( function( v ) {
                v.x += dx;
                v.y += dy;
            } );
        }

        geom.cornerRadius = stampGeom.cornerRadius;
        geom.fill = stampGeom.fill ? Object.assign( {}, stampGeom.fill ) : undefined;
        geom.fillImage = stampGeom.fillImage;
        geom.stroke = stampGeom.stroke ? Object.assign( {}, stampGeom.stroke ) : undefined;
        if( geom.stroke && geom.stroke.width ) {
            geom.stroke.width /= vp.scale;
        }

        var bbox = markupGeom.getGeomBbox( geom );
        markup.start.x = Math.min( bbox.xmin, markup.start.x );
        markup.start.y = Math.min( bbox.ymin, markup.start.y );
        markup.end.x = Math.max( bbox.xmax, markup.end.x );
        markup.end.y = Math.max( bbox.ymax, markup.end.y );
        markup.geometry.list.push( geom );
    }

    if( stamp.showOnPage && stamp.textParam ) {
        markup.textParam = Object.assign( {}, stamp.textParam );
        markup.textParam.scale *= vp.scale;
    }

    if( vp.t >= 0 ) {
        markup.start.t = vp.t;
        markup.end.t = vp.t + 1;
    }

    addMarkupToList( markup );
    return markup;
}

/**
 * Copy symbol as markup
 *
 * @param {Markup} symbol - the symbol to be copied as markup
 * @param {Point} posGeom - the first geom in world coord, use it to shift other geoms, if any
 * @return {Markup} the new markup
 */
export function copySymbolAsMarkup( symbol, posGeom ) {
    var markup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, {}, {}, symbol.type );
    var vp = markupCanvas.getViewParam();
    var index = markupCanvas.getCurrentIndex();

    markup.comment = exports.setSvgSize( symbol.comment, symbolSize );
    markup.showOnPage = symbol.showOnPage;
    markup.viewParam = markupOperation.getViewParam();
    markup.userObj = users[ 0 ].userObj;
    markup.geometry = { list: [] };

    if( symbol.geometry && symbol.geometry.list ) {
        const symbolGeom = symbol.geometry.list[0];
        const ratio = symbolGeom.endPt.x / symbolGeom.endPt.y;
        symbolGeom.endPt.x = ratio * symbolSize;
        symbolGeom.endPt.y = symbolSize;

        var geom = markupGeom.geomScreenToWorld( symbolGeom, vp );
        const dx = posGeom.startPt.x - ( geom.startPt.x + geom.endPt.x ) / 2;
        const dy = posGeom.startPt.y - ( geom.startPt.y + geom.endPt.y ) / 2;
        geom.startPt.x += dx;
        geom.startPt.y += dy;
        geom.endPt.x += dx;
        geom.endPt.y += dy;
        geom.stroke = { style: 'none' };

        var bbox = markupGeom.getGeomBbox( geom );
        markup.start.page = index;
        markup.start.x = bbox.xmin;
        markup.start.y = bbox.ymin;
        markup.end.page = index;
        markup.end.x = bbox.xmax;
        markup.end.y = bbox.ymax;
        markup.geometry.list.push( geom );
    }

    if( vp.t >= 0 ) {
        markup.start.t = vp.t;
        markup.end.t = vp.t + 1;
    }

    addMarkupToList( markup );
    return markup;
}

/**
 * Set Svg width and height according to given size
 *
 * @param {String} svg - the svg string
 * @param {Number} size - the size
 * @returns {String} the new svg string with width and height set
 */
export function setSvgSize( svg, size ) {
    const head = svg.match( /<svg[^>]*>/ );
    if( head ) {
        const width = head[0].match( /width="([0-9.]+)\w*"/ );
        const height = head[0].match( /height="([0-9.]+)\w*"/ );
        const viewBox = head[0].match( /viewBox="([0-9. ,]+)"/ );
        let w = size;
        let newHead = '';

        if( viewBox ) {
            const v = viewBox[1].split( /[ ,]+/ );
            w *= ( v[2] - v[0] ) / ( v[3] - v[1] );
        } else if( width && height ) {
            w *= width[1] / height[1];
        }

        if( width && height ) {
            newHead = head[0].replace( width[0], 'width="' + w + '"' )
                .replace( height[0], 'height="' + size + '"' );
        } else {
            newHead = head[0].replace( '>', ' width="' + w + '" height="' + size + '">' );
        }

        return svg.replace( head[0], newHead );
    }

    return svg;
}

/**
 * Get the Stamp HTML
 *
 * @param {Markup} stamp - the stamp to get its HTML
 * @returns {String} the html
 */
export function getStampHtml( stamp ) {
    var geom = stamp.geometry.list[0];
    if( geom.shape === 'gdnt' ) {
        const className = 'aw-markup-stampMargin';
        return '<div class="' + className + '">' + stamp.comment + '</div>';
    }

    var data = '';
    var text = getTextToBeShown( stamp );
    if( text && stamp.textParam ) {
        var x2 = Math.abs( stamp.textParam.x ) * 2;
        var y2 = Math.abs( stamp.textParam.y ) * 2;
        var reciprocal = 1 / stamp.textParam.scale;
        var swap = stamp.textParam.x * stamp.textParam.y < 0;
        var width = swap ? y2 : x2;
        var height = swap ? x2 : y2;
        var major = swap ? geom.minor : geom.major;
        var minor = swap ? geom.major : geom.minor;
        var left = major + 10 - width * reciprocal / 2;
        var top = minor + 10 - height * reciprocal / 2;
        var clipId = stamp.stampName.replace( /\s+/g, '+' );
        const className = 'aw-markup-canvasFont';

        data = '<g clip-path="url(#' + clipId + ')"><g transform="translate(' + left + ', ' + top + ')">' +
            '<foreignObject width="' + width + '" height="' + height +
            '" transform="scale(' + reciprocal + ',' + reciprocal + ')"' +
            '"><div xmlns="http://www.w3.org/1999/xhtml"' +
            ' class="' + className + '">' +
            text.replace( /<img /, '<img draggable="false" ' ) + '</div></foreignObject></g></g>';
    }

    major = major || geom.major;
    minor = minor || geom.minor;

    var svg = '<svg width="' + ( major * 2 + 20 ) + '" height="' + ( minor * 2 + 20 ) + '">';
    var shape = '';
    if( geom.shape === 'circle' ) {
        shape = '<circle cx="' + ( major + 10 ) + '" cy="' + ( major + 10 ) +
                '" r="' + major + '"';
    } else if( geom.shape === 'ellipse' ) {
        shape = '<ellipse cx="' + ( major + 10 ) + '" cy="' + ( minor + 10 ) +
                '" rx="' + major + '" ry="' + minor + '"';
    } else if( geom.shape === 'rectangle' ) {
        var r = geom.cornerRadius > 0 ? Math.round( geom.cornerRadius * geom.minor ) : 0;
        shape = '<rect x="10" y="10" width="' + major * 2 +
                '" height="' + minor * 2 + '"' +
                ( r > 0 ? ' rx="' + r + '" ry="' + r + '"' : '' );
    }

    var fill = '';
    if( geom.fill && geom.fill.style !== 'none' ) {
        fill = shape + ' fill="' + markupColor.fromHex( geom.fill.color ) + '" />';
    }

    var stroke = '';
    if( geom.stroke && geom.stroke.style !== 'none' ) {
        var w = Math.round( geom.stroke.width );
        var color = ' fill="none" stroke="' + geom.stroke.color + '" stroke-width="' + w + '"';
        var dash = geom.stroke.style === 'solid' ? '' :
            geom.stroke.style === 'dash' ? '"' + w * 5 + ',' + w + '"' :
                geom.stroke.style === 'dot' ? '"' + w + ',' + w + '"' :
                    geom.stroke.style === 'dash-dot' ? '"' + w * 5 + ',' + w + ',' + w + ',' + w + '"' :
                        geom.stroke.style === 'dash-dot-dot' ? '"' + w * 5 + ',' + w + ',' + w + ',' + w + ',' + w + ',' + w + '"' :
                            '';

        stroke = shape + color + ( dash ? ' stroke-dasharray=' + dash : '' ) + ' />';
    }

    var clip = '<defs><clipPath id="' + clipId + '">' + shape + ' /></clipPath></defs>';

    return svg + clip + fill + data + stroke + '</svg>';
}

/**
 * Set the current sort by choice
 *
 * @param {String} inSortBy the sort by "page", "user", "date", or "status"
 *
 * @return {boolean} true if set to a different value
 */
export function setSortBy( inSortBy ) {
    const validKeys = [ 'page', 'user', 'date', 'status' ];
    if( validKeys.indexOf( inSortBy ) >= 0 && inSortBy !== sortBy ) {
        sortBy = inSortBy;
        return true;
    }
    return false;
}

/**
 * Sort the markup list
 *
 * @return {Markup} the sorted markup list
 */
export function sortMarkupList() {
    clearGroups();
    markupList.sort( function( markup0, markup1 ) {
        if( markup0 === markup1 ) {
            return 0;
        }

        if( sortBy === 'status' ) {
            var statusOrder = markupThread.compareStatus( markup0, markup1 );
            if( statusOrder !== 0 ) {
                return statusOrder;
            }
        }

        if( sortBy === 'status' || sortBy === 'page' ) {
            var posOrder = markupThread.comparePosition( markup0, markup1 );
            if( posOrder !== 0 ) {
                return posOrder;
            }

            return markupThread.compareDate( markup0, markup1 );
        }

        if( sortBy === 'user' ) {
            var nameOrder = compareUser( markup0, markup1 );
            if( nameOrder !== 0 ) {
                return nameOrder;
            }
        }

        if( sortBy === 'user' || sortBy === 'date' ) {
            return markupThread.compareDate( markup1, markup0 );
        }

        return 0;
    } );

    insertGroups();
    return markupList;
}

/**
 * Toggle the group between expanded and collapsed
 *
 * @param {String} groupName - group name to be toggled
 * @return {Markup} the updated markup or stamp list
 */
export function toggleGroup( groupName ) {
    let markupIndex =  markupList.findIndex( g => g.groupName === groupName );
    let stampIndex = stampList.findIndex( g => g.groupName === groupName );
    let index = markupIndex >= 0 ? markupIndex : stampIndex >= 0 ? stampIndex : -1;
    let list = markupIndex >= 0 ? markupList : stampIndex >= 0 ? stampList : null;

    if( list ) {
        let group = list[ index ];
        group.expanded = !group.expanded;
        if( group.expanded ) {
            for( let i = 0; i < group.list.length; i++ ) {
                let markup = group.list[ i ];
                markup.visible = true;
                list.splice( index + i + 1, 0, markup );
            }
        } else {
            if( index >= 0 && index + group.list.length < list.length ) {
                let removed = list.splice( index + 1, group.list.length );
                for( let j = 0; j < removed.length; j++ ) {
                    removed[ j ].visible = false;
                }
            }
        }
    }

    if( markupIndex >= 0 ) {
        markupOperation.showAll();
    }

    return list;
}

/**
 * Generate and return the random alphanumeric ID for the newly created markup
 */
function getReqData() {
    var commentId = 'RM::Markup::' + Math.random().toString( 36 ).substr( 2, 10 );

    var reqData = { };
    reqData.commentid = commentId;

    return reqData;
}

/**
 * Add new markup
 *
 * @return {Markup} the newly added markup
 */
export function addNewMarkup() {
    var userSelection = markupOperation.getUserSelection();
    if( !userSelection || !userSelection.reference && !userSelection.geometry ) {
        return null;
    }

    var type = userSelection.geometry ? '2d' : 'text';
    var newMarkup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, userSelection.start,
        userSelection.end, type );

    newMarkup.reference = userSelection.reference;
    newMarkup.geometry = userSelection.geometry;
    newMarkup.objId = userSelection.objId;
    newMarkup.viewParam = markupOperation.getViewParam();
    newMarkup.userObj = users[ 0 ].userObj;
    if( newMarkup.objId ) {
        newMarkup.reqData = getReqData();
    }
    newMarkup.editMode = 'new';

    addMarkupToList( newMarkup );
    return newMarkup;
}

/**
 * Add reply markup
 *
 * @param {Markup} markup - the markup being replied
 *
 * @return {Markup} the replying markup
 */
export function addReplyMarkup( markup ) {
    var replyMarkup = markupData.addMarkup( loginUserId, loginUserName, loginUserId, markup.start, markup.end,
        markup.type );

    replyMarkup.reference = markup.reference;
    replyMarkup.viewParam = markup.viewParam;

    if( markup.geometry && markup.geometry.list ) {
        replyMarkup.geometry = { list: [] };
        markup.geometry.list.forEach( function( g ) {
            var geom = Object.assign( {}, g );
            geom.fill = undefined;
            geom.fillImage = undefined;
            replyMarkup.geometry.list.push( geom );
        } );
    }

    if( markup.objId && markup.reqData ) {
        replyMarkup.reqData = getReqData();
        replyMarkup.objId = markup.objId;

        if( !replyMarkup.reqData.parentCommentid ) {
            if( !markup.reqData.parentCommentid ) {
                replyMarkup.reqData.parentCommentid = markup.reqData.commentid;
            } else {
                replyMarkup.reqData.parentCommentid = markup.reqData.parentCommentid;
            }
        }
    }
    replyMarkup.userObj = users[ 0 ].userObj;
    replyMarkup.editMode = 'reply';

    // Fix D-13968 where the client machines' clocks are significantly out-of-sync
    if( replyMarkup.date <= markup.date ) {
        replyMarkup.date.setTime( markup.date.getTime() + 1 );
    }

    var status = markupThread.getStatus( markup );
    replyMarkup.status = status === 'open' ? 'replied' : status;

    addMarkupToList( replyMarkup );
    return replyMarkup;
}

/**
 * Add new symbol
 *
 * @param {String} svg - the svg
 * @param {String} name - the symbol name
 * @return {Markup} the newly added symbol
 */
export function addNewSymbol( svg, name ) {
    const share = role === 'admin' ? 'public' : 'private';
    const head = svg.match( /<svg[^>]*>/ );
    if( head ) {
        const width = head[0].match( /width="([0-9.]+)"/ );
        const height = head[0].match( /height="([0-9.]+)"/ );
        const viewBox = head[0].match( /viewBox="([0-9. ,]+)"/ );
        const start = { page: 0, x: 0, y: 0 };
        const end = { page: 0, x: 32, y: 32 };

        if( width && height ) {
            end.x = width[1];
            end.y = height[1];
        } else if( viewBox ) {
            const v = viewBox[1].split( /[ ,]+/ );
            end.x = v[2] - v[0];
            end.y = v[3] - v[1];
        }

        const scale = Math.min( end.x, end.y ) / 32;
        end.x *= scale;
        end.y *= scale;

        const newSymbol = markupData.addSymbol( loginUserId, loginUserName, loginUserId, start, end, name, share );
        newSymbol.comment = svg;
        newSymbol.textParam = { scale: scale, x: 0, y: 0 };
        newSymbol.geometry = { list: [ {
            shape: 'symbol',
            startPt: { x: 0, y: 0 },
            endPt: { x: end.x, y: end.y }
        } ] };

        return newSymbol;
    }

    return null;
}

/**
 * delete markup
 *
 * @param {Markup} markup the markup to be deleted
 */
export function deleteMarkup( markup ) {
    markup.deleted = true;
    if( markup.geometry && markup.geometry.list ) {
        markup.geometry.list.forEach( function( g ) {
            g.fillImage = undefined;
        } );
    }
    markupThread.remove( markup );
}

/**
 * Find users to load
 *
 * @return {String} array of user names
 */
export function findUsersToLoad() {
    var userNames = [];
    markupData.users.forEach( function( user ) {
        if( user.userid && !user.userObj ) {
            userNames.push( user.username );
        }
    } );

    return userNames;
}

/**
 * Is markup editable?
 *
 * @param {Markup} markup - the markup being tested
 *
 * @return {boolean} true if editable
 */
export function isEditable( markup ) {
    return canMarkup() && markupData.isMyMarkup( markup ) && markup.share !== 'official' &&
        !markupThread.isInThread( markup, 'frozen' );
}

/**
 * Is markup replyable?
 *
 * @param {Markup} markup - the markup being tested
 *
 * @return {boolean} true if replyable
 */
export function isReplyable( markup ) {
    return canMarkup() && !markupData.isMyMarkup( markup );
}

/**
 * Is markup or stamp deletable?
 *
 * @param {Markup} markup - the markup being tested
 *
 * @return {boolean} true if deletable
 */
export function isDeletable( markup ) {
    return !markup.stampName ? isEditable( markup ) :
        role === 'admin' ? markup.share === 'public' : markup.share === 'private';
}

/**
 * Is markup indented?
 *
 * @param {Markup} markup - the markup being tested
 *
 * @return {boolean} true if indented
 */
export function isIndented( markup ) {
    return ( sortBy === 'page' || sortBy === 'status' ) && filterList.length === 0 &&
        markupThread.isInThread( markup, 'rest' );
}

/**
 * Set filter text
 *
 * @param {String} text - the filter text
 * @return {boolean} true if set to a different value
 */
export function setFilter( text ) {
    if( text !== filter ) {
        filter = text;
        if( text === '' ) {
            filterList = [];
        } else {
            var str = text.trim().toLowerCase();
            filterList = str === '' ? [] : str.split( /\s+/ );
        }
        return true;
    }

    return false;
}

/**
 * Update one markup geometry and then show it only
 *
 * @param {Markup} markup - the markup to be updated
 * @param {boolean} edit - true when in edit mode, false when quit edit mode, undefined when load markups
 */
export function updateMarkupGeom( markup, edit ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        if( edit !== undefined ) {
            markupCanvas.showAsSelected( markup, edit ? 1 : 0 );
        } else {
            markupCanvas.showCurrentPage();
        }
    }
}

/**
 * Update Html according to markup showOnPage option
 *
 * @param {Markup} markup - the markup to be updated
 * @param {boolean} edit - true when in edit mode, false when quit edit mode, undefined when load markups
 */
export function updateMarkupHtml( markup, edit ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        if( markup.geometry.list[0].shape === 'gdnt' ) {
            if( edit ) {
                markupCanvas.updateGdntSize( markup );
            }
        } else if( markup.geometry.list[0].shape === 'weld' ) {
            if( edit ) {
                markupCanvas.updateWeldSize( markup );
            }
        } else if( markup.geometry.list[0].shape === 'leader' ) {
            if( edit ) {
                markupCanvas.updateLeaderSize( markup );
            }
        } else if( markup.geometry.list[0].shape === 'symbol' ) {
            markupCanvas.setFillImage( markup, 0, markup.comment, edit );
        } else {
            var html = getTextToBeShown( markup );
            var geomIndex = findGeomIndex( markup.geometry.list );
            markupCanvas.setFillImage( markup, geomIndex, html, edit );
        }
    }
}

/**
 * Find the geometry index to put HTML, priority:
 *    rectangle, ellipse, circle, polygon, closed-curve, polyline, curve
 *
 * @param {Geometry} geomList
 * @returns {Number} the found index, default 0
 */
function findGeomIndex( geomList ) {
    if( geomList.length > 1 ) {
        var shapes = [ 'rectangle', 'ellipse', 'circle', 'polygon', 'closed-curve', 'polyline', 'curve' ];
        for( var i = 0; i < shapes.length; i++ ) {
            for( var j = 0; j < geomList.length; j++ ) {
                if( geomList[ j ].shape === shapes[ i ] ) {
                    return j;
                }
            }
        }
    }

    return 0;
}

/**
 * Get the markup fill size in screen coordinates - for setting fill image size
 *
 * @param {Markup} markup - the markup
 */
export function getMarkupFillSize( markup ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        var index = findGeomIndex( markup.geometry.list );
        return markupCanvas.getFillSize( markup, index, true );
    }
}

/**
 * Generate the printable HTML page
 *
 * @param {Object} option - can be a markup, a list of markups, 'all' or 'visible'
 * @param {Map} i18n - Hash map for i18n
 * @param {Function} callback - the callback function when HTML is updated
 */
export function generatePrintPage( option, i18n, callback ) {
    var mrkList = [];

    if( option.start ) {
        mrkList.push( markupThread.getFirstMarkupInThread( option ) );
    } else if( option === 'all' || option === 'visible' || option.length > 0 ) {
        markups.forEach( function( markup ) {
            if( option === 'all' || option === 'visible' && markup.visible ||
                option.length && option.indexOf( markup ) >= 0 ) {
                var mrk = markupThread.getFirstMarkupInThread( markup );
                if( mrkList.indexOf( mrk ) < 0 ) {
                    mrkList.push( mrk );
                }
            }
        } );
    }

    if( mrkList.length > 0 ) {
        mrkList.sort( function( markup0, markup1 ) {
            return markupThread.comparePosition( markup0, markup1 );
        } );

        markupOperation.generateRefImage( mrkList, 400, 200, function() {
            const bodyClassName = 'aw-markup-htmlReportBody';
            const floatLClassName = 'aw-markup-htmlReportStatus';
            const floatRClassName = 'aw-markup-htmlReportUtil';
            const tableClassName = 'aw-markup-htmlReportTable';
            const imageCellClassName = 'aw-markup-htmlReportImageCell';
            const imageClassName = 'aw-markup-htmlReportImage';
            const commentCellClassName = 'aw-markup-htmlReportCommentCell';
            const dateClassName = 'aw-markup-htmlReportDate';

            var maxPage = mrkList[ mrkList.length - 1 ].start.page;
            var html = '<html><head><title>' + i18n.printMarkups + '</title></head>' +
                '<body class="' + bodyClassName + '">' + i18n.printMarkups + ' : ' + mrkList.length +
                '<button onclick="window.print()" class="' + floatRClassName + '">' + i18n.print + '</button>' +
                '<table class="' + tableClassName + '" >';

            for( var i = 0; i < mrkList.length; i++ ) {
                var markup = mrkList[i];

                html += '<tr><td class="' + imageCellClassName + '">' +
                        '<img src="' + markup.refImage + '" width="320px" class="' + imageClassName + '" /></td>' +
                        '<td class="' + commentCellClassName + '" >' +
                        '<div class="' + floatLClassName + '">' + i18n[ markupThread.getStatus( markup ) ] + '</div>';

                if( maxPage > 0 ) {
                    html += '<div class="' + floatRClassName + '">' + i18n.page + ' ' + ( markup.start.page + 1 ) + '</div>';
                }

                if( markup.start.t >= 0 ) {
                    html += '<div class="' + floatRClassName + '">' + timeToText( markup.start.t )  + '</div>';
                }

                var mrks = markupThread.getAllMarkupsInThread( markup );
                mrks.forEach( function( mrk ) {
                    html += '<div class="' + dateClassName + '"><strong>' + mrk.displayname + '</strong> ' +
                            mrk.date.toLocaleString() + '</div>' + mrk.comment;
                } );

                html += '</td></tr>';
            }

            html += '</body></html>';
            if( callback ) {
                callback( html );
            }
        } );
    }
}

/**
 * Process the symbols
 *
 * @param {String} ver the version
 * @param {String} mes the message
 * @param {String} json the symbols in json
 */
export function processSymbols( ver, mes, json ) {
    if( mes.indexOf( 'up_to_date' ) < 0 ) {
        if( mes.indexOf( 'append' ) < 0 ) {
            markupData.clearSymbols();
        }
        markupData.parseSymbols( json );
    }
}

/**
 * Get the symbol list
 *
 * @returns {Markup[]} the list containing all the symbols
 */
export function getSymbolList() {
    return markupData.symbols.filter( s => !s.deleted );
}

//==================================================
// private functions
//==================================================
var htmlEntities = {
    nbsp: ' ',
    oslash: 'ø',
    cent: '¢',
    pound: '£',
    yen: '¥',
    euro: '€',
    copy: '©',
    reg: '®',
    quot: '"',
    apos: '\'',
    trade: '™',
    deg: '°',
    plusmn: '±',
    divide: '÷',
    ne: '≠',
    le: '≤',
    gt: '≥',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
    bull: '•',
    mdash: '—',
    ndash: '–',
    oline: '‾',
    hellip: '…',
    permil: '‰',
    larr: '←',
    uarr: '↑',
    rarr: '→',
    darr: '↓',
    harr: '↔',
    crarr: '↵',
    lArr: '⇐',
    uArr: '⇑',
    rArr: '⇒',
    dArr: '⇓',
    hArr: '⇔',
    spades: '♠',
    clubs: '♣',
    hearts: '♥',
    diams: '♦'
};

/**
 * Unescape the HTML string
 *
 * @param {String} str string to be unescaped
 * @returns {String} the unescaped string
 */
function unescapeHTML( str ) {
    return str.replace( /&([^;]+);/g, function( entity, entityCode ) {
        var match;

        if( entityCode in htmlEntities ) {
            return htmlEntities[ entityCode ];
            /*eslint no-cond-assign: 0*/
        } else if( match = entityCode.match( /^#x([\da-fA-F]+)$/ ) ) {
            return String.fromCharCode( parseInt( match[ 1 ], 16 ) );
            /*eslint no-cond-assign: 0*/
        } else if( match = entityCode.match( /^#(\d+)$/ ) ) {
            return String.fromCharCode( ~~match[ 1 ] );
        }
        return entity;
    } );
}

/**
 * Get the text to be shown on page
 *
 * @param {Markup} markup - the markup to get the text
 * @returns {String} the text to be shown on page
 */
function getTextToBeShown( markup ) {
    if( markup.showOnPage && markup.showOnPage !== 'none' ) {
        var html = markup.comment.replace( /<p/g, '<div' ).replace( /<\/p>/g, '</div>' );

        // Fix CKEditor 5 figure that may contain unclosed img
        var figImg = html.match( /<figure[^>]*><img[^>]*>/ );
        if( figImg ) {
            var imgNext = figImg.input.substring( figImg.index + figImg[0].length );
            var imgClose = figImg[0].endsWith( '/>' ) || imgNext.startsWith( '</img>' ) ? '' : '/';
            html = html.replace( /<figure[^>]*>/g, '<div>' ).replace( /><\/figure>/g, imgClose + '></div>' );
        }

        if( markup.showOnPage === 'first' ) {
            var index = html.indexOf( '<div', 1 );
            if( index > 0 ) {
                html = html.substring( 0, index );
            }
        }

        return unescapeHTML( html );
    }

    return '';
}

/**
 * Compare user of two markups, the login user is always first
 *
 * @param {Markup} markup0 the first markup
 * @param {Markup} markup1 the second markup
 * @return {number} markup0 < markup1? -1: markup0 > markup1? 1: 0;
 */
function compareUser( markup0, markup1 ) {
    var isMy0 = markupData.isMyMarkup( markup0 );
    var isMy1 = markupData.isMyMarkup( markup1 );

    if( isMy0 !== isMy1 ) {
        return isMy0 ? -1 : 1;
    }

    return markup0.displayname.localeCompare( markup1.displayname );
}

/**
 * Clear all markup groups before sorting
 */
function clearGroups() {
    for( var i = markupList.length - 1; i >= 0; i-- ) {
        if( markupList[ i ].groupName ) {
            var group = markupList.splice( i, 1 )[ 0 ];
            if( !group.expanded ) {
                for( var j = group.list.length - 1; j >= 0; j-- ) {
                    markupList.splice( i, 0, group.list[ j ] );
                }
            }
        }
    }
}

/**
 * Insert all groups after sorting
 */
function insertGroups() {
    var currentGroup = null;

    // Set today which is at 0:00am today
    var now = new Date();
    var today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );

    for( var i = 0; i < markupList.length; i++ ) {
        var markup = markupList[ i ];
        if( !markup.groupName ) {
            var name = sortBy === 'user' ? markup.displayname : sortBy === 'page' ? 'page ' +
                ( markup.start.page + 1 ) : 'unknown';

            // Split to fix SonarQube issue: conditional operators max allowed 3
            name = sortBy === 'status' ? markupThread.getStatus( markup ) : sortBy === 'date' ? getDateName(
                markup.date, today ) : name;

            if( currentGroup && currentGroup.groupName === name ) {
                currentGroup.list.push( markup );
            } else {
                currentGroup = {
                    groupName: name,
                    list: [ markup ],
                    expanded: true
                };
                markupList.splice( i, 0, currentGroup );
                i++;
            }
        }
    }
}

/**
 * Get the group name of the markup
 *
 * @param {Date} date the date of markup
 * @param {Date} today the date of today at 0:00am
 * @return {String} the date name
 */
function getDateName( date, today ) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var daysDiff = Math.ceil( ( today.getTime() - date.getTime() ) / 86400000 );
    var monthName = month === today.getMonth() ? 'thisMonth' : month < 9 ? 'monthName_0' + ( month + 1 ) + ' ' +
        year : 'monthName_' + ( month + 1 ) + ' ' + year;

    return daysDiff <= 0 ? 'today' : daysDiff === 1 ? 'yesterday' : daysDiff <= 6 ? 'dayName_0' +
        ( date.getDay() + 1 ) : monthName;
}

/**
 * Add a markup into the list
 *
 * @param {Markup} markup the markup to be added
 */
function addMarkupToList( markup ) {
    markupList.push( markup );
    markupThread.add( markup );
    markupOperation.show( markup, 0 );
    sortMarkupList();
}

/**
 * Filter the markup
 *
 * @param {Markup} markup the markup to be tested
 * @return {boolean} true if it is visible through the filter
 */
function filterMarkup( markup ) {
    for( var i = 0; i < filterList.length; i++ ) {
        if( markup.comment.toLowerCase().indexOf( filterList[ i ] ) < 0 ) {
            return false;
        }
    }

    return true;
}

/**
 * Filter the stamp
 *
 * @param {Markup} stamp the stamp to be tested
 * @return {boolean} true if it is visible through the filter
 */
function filterStamp( stamp ) {
    for( var i = 0; i < filterList.length; i++ ) {
        if( stamp.stampName.toLowerCase().indexOf( filterList[ i ] ) < 0 ) {
            return false;
        }
    }

    return true;
}

/**
 * Sort the stamp list according to comment
 *
 * @returns {Markup[]} the sorted stamp list
 */
function sortStampList() {
    stampList.sort( function( stamp0, stamp1 ) {
        if( stamp0.share !== stamp1.share ) {
            return stamp0.share === 'private' ? -1 : 1;
        }

        return stamp0.stampName.localeCompare( stamp1.stampName );
    } );

    insertStampGroups();
    return stampList;
}

/**
 * Insert groups into stampList
 */
function insertStampGroups() {
    var currentGroup = null;

    for( var i = 0; i < stampList.length; i++ ) {
        var stamp = stampList[ i ];
        var groupName = stamp.share === 'public' ? 'sharedStamps' : 'myStamps';
        if( !stamp.groupName ) {
            if( currentGroup && currentGroup.groupName === groupName ) {
                currentGroup.list.push( stamp );
            } else {
                currentGroup = {
                    groupName: groupName,
                    list: [ stamp ],
                    expanded: true
                };
                stampList.splice( i, 0, currentGroup );
                i++;
            }
        }
    }
}

/**
 * Time to text in the format mm:ss
 *
 * @param {Number} t - the time in second
 */
function timeToText( t ) {
    var sec = Math.round( t % 60 );
    var min = Math.floor( t / 60 );
    return min + ':' + ( sec >= 10 ? '' : '0' ) + sec;
}

//==================================================
// exported functions
//==================================================
let exports;
export let getVersion = function() {
    return version;
};
export let getMarkupList = function() {
    return markupList;
};
export let getUsers = function() {
    return markupData.users;
};
export let getStatus = function( markup ) {
    return markupThread.getStatus( markup );
};
export let setUserObj = function( userId, obj ) {
    markupData.setUserObj( userId, obj );
};
export let getCount = function() {
    return markupData.markups.reduce( function( count, markup ) {
        return count + ( markup.deleted ? 0 : 1 );
    }, 0 );
};
export let getSortBy = function() { return sortBy; };
export let getFilter = function() { return filter; };
export let clearAllEditMode = function() {
    markupData.clearAllEditMode();
};
export let stringifyMarkups = function( all ) {
    return markupData.stringifyMarkups( all );
};
export let stringifyMarkup = function( markup ) {
    return markupData.stringifyMarkup( markup );
};
export let stringifyMarkupList = function( list ) {
    return markupData.stringifyMarkupsInList( true, list );
};
export let findMarkup = function( markup ) {
    return markupData.findMarkup( markup );
};
export let findUser = function( id ) {
    return markupData.findUser( id );
};
export let isInThread = function( markup ) {
    return markupThread.isInThread( markup, 'any' );
};
export let getRole = function() {
    return role;
};
export let setRole = function( r ) {
    role = r;
};
export let getUserNames = function() {
    return userNames;
};
export let setUserNames = function( names ) {
    userNames = names;
};
export let getCurrentSelect = function() {
    return currentSelect;
};
export let setCurrentSelect = function( selected, ensureVisible ) {
    if( selected && ensureVisible ) {
        selected = markupData.findMarkup( selected );
    }

    if( currentSelect !== selected ) {
        if( currentSelect ) {
            markupOperation.showAsSelected( currentSelect, 1 );
        }

        if( selected ) {
            markupOperation.showAsSelected( selected, 0 );
            if( ensureVisible ) {
                markupOperation.ensureVisible( selected );
            }
        }

        previousSelect = currentSelect;
        currentSelect = selected;
    }
};
export let getPreviousSelect = function() {
    return previousSelect;
};
export let setPreviousSelect = function( sel ) {
    previousSelect = sel;
};
export let getCurrentEdit = function() {
    return currentEdit;
};
export let setCurrentEdit = function( edit ) {
    currentEdit = edit;
};
export let getCurrentPos = function() {
    return currentPos;
};
export let setCurrentPos = function( pos ) {
    currentPos = pos;
};
export let getCurrentStamp = function() {
    return currentStamp;
};
export let setCurrentStamp = function( stamp ) {
    currentStamp = stamp && markupData.findStamp( stamp.stampName, stamp.share );
};
export let getOriginalMarkup = function() {
    return originalMarkup;
};
export let setOriginalMarkup = function( orig ) {
    originalMarkup = orig;
};
export let getNeedUpdateGeom = function() {
    return needUpdateGeom;
};
export let setNeedUpdateGeom = function( option ) {
    needUpdateGeom = option;
};
export let getNeedUpdateHtml = function() {
    return needUpdateHtml;
};
export let setNeedUpdateHtml = function( option ) {
    needUpdateHtml = option;
};
export let sameMarkup = function( m1, m2 ) {
    return markupData.sameMarkup( m1, m2 );
};
export let canMarkup = function() {
    return role === 'admin' || role === 'author' || role === 'reviewer';
};
export let getStampShare = function() {
    return role === 'admin' ? 'public' : 'private';
};
export let findSymbol = function( name, share, group ) {
    return markupData.findSymbol( name, share, group );
};
export let getCurrentSymbols = function() {
    return currentSymbols;
};
export let setCurrentSymbols = function( list ) {
    currentSymbols = list && list.map( sym => {
        return markupData.findSymbol( sym.symbolName, sym.share, sym.symbolGroup );
    } );
};
export let setSymbolSize = function( size ) {
    symbolSize = size;
};
export let isUpToDate = function() {
    return message.indexOf( 'up_to_date' ) >= 0;
};
export let isAppend = function() {
    return message.indexOf( 'append' ) >= 0;
};
export let hasMore = function() {
    return message.indexOf( 'more' ) >= 0;
};

export default exports = {
    getVersion,
    getMarkupList,
    getUsers,
    getStatus,
    setUserObj,
    setLoginUser,
    getCount,
    setSortBy,
    getSortBy,
    setFilter,
    getFilter,
    processMarkups,
    clearMarkupList,
    updateMarkupList,
    processStamps,
    updateStampList,
    getStampList,
    findStamp,
    copyMarkupAsStamp,
    copyStampAsMarkup,
    copySymbolAsMarkup,
    setSvgSize,
    getStampHtml,
    updateMarkupHtml,
    updateMarkupGeom,
    getMarkupFillSize,
    sortMarkupList,
    toggleGroup,
    addNewMarkup,
    addReplyMarkup,
    addNewSymbol,
    deleteMarkup,
    findMarkup,
    clearAllEditMode,
    stringifyMarkups,
    stringifyMarkup,
    stringifyMarkupList,
    generatePrintPage,
    findUser,
    findUsersToLoad,
    isEditable,
    isReplyable,
    isDeletable,
    isIndented,
    isInThread,
    getRole,
    setRole,
    getCurrentSelect,
    setCurrentSelect,
    getPreviousSelect,
    setPreviousSelect,
    getCurrentEdit,
    setCurrentEdit,
    getCurrentPos,
    setCurrentPos,
    getCurrentStamp,
    setCurrentStamp,
    getOriginalMarkup,
    setOriginalMarkup,
    getNeedUpdateGeom,
    setNeedUpdateGeom,
    getNeedUpdateHtml,
    setNeedUpdateHtml,
    sameMarkup,
    canMarkup,
    getStampShare,
    processSymbols,
    getSymbolList,
    findSymbol,
    getCurrentSymbols,
    setCurrentSymbols,
    setSymbolSize,
    isUpToDate,
    isAppend,
    hasMore
};
