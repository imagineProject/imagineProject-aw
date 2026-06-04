/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */
// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/MarkupGeom
 */

'use strict';
//==================================================
// private variables
//==================================================
/** The epsilon to avoid division by zero */
var eps = 0.000001;
/** The half of square root of 2 */
var halfSqrt2 = Math.sqrt( 2 ) / 2;

//==================================================
// public functions
//==================================================
/**
 * Transform a geometry from screen coord to world coord
 *
 * @param {FitPathResult} geom The geometry
 * @param {ViewParam} viewParam The view param
 *
 * @return {FitPathResult} The transformed geometry
 */
export function geomScreenToWorld( geom, viewParam ) {
    var shape = geom.shape;
    var result = {};

    result.shape = shape;
    if( shape === 'freehand' || shape === 'polyline' || shape === 'polygon' ||
        shape === 'curve' || shape === 'closed-curve' ) {
        result.vertices = pointArrayScreenToWorld( geom.vertices, viewParam );
        if( shape === 'polyline' || shape === 'curve' ) {
            result.startArrow = geom.startArrow;
            result.endArrow = geom.endArrow;
        }
    } else if( shape === 'circle' || shape === 'ellipse' || shape === 'rectangle' ) {
        result.center = pointScreenToWorld( geom.center, viewParam );
        result.major = geom.major / viewParam.scale;
        result.minor = geom.minor / viewParam.scale;
        result.angle = geom.angle - ( viewParam.angle2 ? viewParam.angle2 : 0 );
        result.cornerRadius = geom.cornerRadius;
    } else if( shape === 'gdnt' || shape === 'weld' || shape === 'leader' || shape === 'symbol' ) {
        result.startPt = pointScreenToWorld( geom.startPt, viewParam );
        result.endPt = pointScreenToWorld( geom.endPt, viewParam );
        if( geom.vertices ) {
            result.vertices = pointArrayScreenToWorld( geom.vertices, viewParam );
            result.startArrow = geom.startArrow;
            result.stroke = geom.stroke;
            if( result.stroke && isFinite( result.stroke.width ) ) {
                result.stroke = Object.assign( {}, geom.stroke );
                result.stroke.width /= viewParam.scale;
            }
        }
    }
    return result;
}

/**
 * Transform a geometry from world coord to screen coord
 *
 * @param {FitPathResult} geom The geometry
 * @param {ViewParam} viewParam The view param
 *
 * @return {FitPathResult} The transformed geometry
 */
export function geomWorldToScreen( geom, viewParam ) {
    var shape = geom.shape;
    var result = {};
    var transform = interpolate( geom, viewParam.t );

    result.shape = shape;
    if( shape === 'freehand' || shape === 'polyline' || shape === 'polygon' ||
        shape === 'curve' || shape === 'closed-curve' ) {
        result.vertices = pointArrayWorldToScreen( geom.vertices, viewParam, transform );

        if( shape === 'polyline' || shape === 'curve' ) {
            result.startArrow = geom.startArrow;
            result.endArrow = geom.endArrow;
        }
    } else if( shape === 'circle' || shape === 'ellipse' || shape === 'rectangle' ) {
        var center = translatePoint( geom.center, transform );
        result.center = pointWorldToScreen( center, viewParam );
        result.major = geom.major * viewParam.scale;
        result.minor = geom.minor * viewParam.scale;
        result.angle = geom.angle + ( viewParam.angle2 ? viewParam.angle2 : 0 );
        result.cornerRadius = geom.cornerRadius;

        if( transform ) {
            result.major *= transform.scale;
            result.minor *= transform.scale;
            result.angle += transform.angle;
        }
    } else if( shape === 'gdnt' || shape === 'weld' || shape === 'leader' || shape === 'symbol' ) {
        const startPt = translatePoint( geom.startPt, transform );
        const endPt = translatePoint( geom.endPt, transform );
        result.startPt = pointWorldToScreen( startPt, viewParam );
        result.endPt = pointWorldToScreen( endPt, viewParam );
        if( geom.vertices ) {
            result.vertices = pointArrayWorldToScreen( geom.vertices, viewParam, transform );
            result.startArrow = geom.startArrow;
            result.stroke = geom.stroke;
            if( result.stroke && isFinite( result.stroke.width ) ) {
                result.stroke = Object.assign( {}, geom.stroke );
                result.stroke.width *= viewParam.scale;
            }
        }
    }
    return result;
}

/**
 * Transform a point from screen coord to world coord
 *
 * @param {FitPathPoint} point The point
 * @param {ViewParam} viewParam The view param
 *
 * @return {FitPathPoint} The transformed point
 */
export function pointScreenToWorld( point, viewParam ) {
    var cos = Math.cos( viewParam.angle2 ? viewParam.angle2 : 0 );
    var sin = Math.sin( viewParam.angle2 ? viewParam.angle2 : 0 );
    var x = ( point.x - viewParam.x ) / viewParam.scale;
    var y = ( point.y - viewParam.y ) / viewParam.scale;
    var pw = { x: x * cos + y * sin, y: -x * sin + y * cos };
    if( point.c ) {
        pw.c = true;
    }
    return pw;
}

/**
 * Transform a point from world coord to screen coord
 *
 * @param {FitPathPoint} point The point
 * @param {ViewParam} viewParam The view param
 *
 * @return {FitPathPoint} The transformed point
 */
export function pointWorldToScreen( point, viewParam ) {
    var cos = Math.cos( viewParam.angle2 ? viewParam.angle2 : 0 );
    var sin = Math.sin( viewParam.angle2 ? viewParam.angle2 : 0 );
    var x = ( point.x * cos - point.y * sin ) * viewParam.scale + viewParam.x;
    var y = ( point.x * sin + point.y * cos ) * viewParam.scale + viewParam.y;
    var ps = { x, y };
    if( point.c ) {
        ps.c = true;
    }
    return ps;
}

/**
 * Check if a point is in the geometry
 *
 * @param {FitPathPoint} ptWorld The point in world coord
 * @param {FitPathResult} geom the geometry in world coord
 * @param {ViewParam} viewParam The view param
 * @param {Number} extraTol The extra tolerance on screen pixels, default 0
 *
 * @return {boolean} true if it is in the geometry
 */
export function pointInGeom( ptWorld, geom, viewParam, extraTol ) {
    var point = ptWorld;
    var extTol = extraTol ? extraTol / viewParam.scale : 0;
    var bTol =  geom.shape === 'polyline' ? 10 / viewParam.scale : extTol;
    var bbox = getGeomBbox( geom );
    var transform = null;

    if( viewParam.t >= 0 && geom.transform ) {
        var tTol = 0.1;
        if( viewParam.t < geom.transform[0].t - tTol ||
            viewParam.t > geom.transform[geom.transform.length - 1].t + tTol ) {
            return false;
        }
        transform = interpolate( geom, viewParam.t );
        if( transform ) {
            point = translatePoint( ptWorld, transform, true );
        }
    } else if( point.x < bbox.xmin - bTol || point.x > bbox.xmax + bTol ||
        point.y < bbox.ymin - bTol || point.y > bbox.ymax + bTol ) {
        return false;
    }

    var lenTol = 10 / viewParam.scale;
    var lenTol2 = lenTol * lenTol;

    if( geom.shape === 'freehand' ) {
        for( let i = 0; i < geom.vertices.length; i++ ) {
            const dxi = point.x - geom.vertices[ i ].x;
            const dyi = point.y - geom.vertices[ i ].y;
            if( dxi * dxi + dyi * dyi < lenTol2 ) {
                return true;
            }
        }
    } else if( geom.shape === 'polyline' || geom.shape === 'curve' ) {
        const vertices = geom.shape === 'curve' ? getCurveApproxPts( geom ) : geom.vertices;
        for( let i = 0; i < vertices.length - 1; i++ ) {
            if( pointOnLine( point, vertices[ i ], vertices[ i + 1 ], lenTol ) ) {
                return true;
            }
        }
    } else if( geom.shape === 'polygon' || geom.shape === 'closed-curve' ) {
        const vertices = geom.shape === 'closed-curve' ? getCurveApproxPts( geom ) : geom.vertices;
        for( let i = 1; i < vertices.length - 2; i++ ) {
            if( pointInTriangle( point, vertices[ 0 ], vertices[ i ], vertices[ i + 1 ] ) ) {
                return true;
            }
        }
    } else if( geom.shape === 'rectangle' || geom.shape === 'ellipse' ) {
        var major = geom.major * ( transform ? transform.scale : 1 );
        var minor = geom.minor * ( transform ? transform.scale : 1 );
        var angle = geom.angle + ( transform ? transform.angle : 0 );

        var dxc = point.x - geom.center.x;
        var dyc = point.y - geom.center.y;
        var sin = Math.sin( angle );
        var cos = Math.cos( angle );

        var x = dxc * cos + dyc * sin;
        var y = -dxc * sin + dyc * cos;
        var a = major + extTol;
        var b = minor + extTol;

        if( geom.shape === 'rectangle' && Math.abs( x ) <= a && Math.abs( y ) <= b ) {
            return true;
        }

        if( geom.shape === 'ellipse' &&  x * x  / ( a * a ) +  y * y  / ( b * b ) <= 1 ) {
            return true;
        }
    } else if( geom.shape === 'circle' ) {
        var dx0 = point.x - geom.center.x;
        var dy0 = point.y - geom.center.y;
        var r = geom.major * ( transform ? transform.scale : 1 ) + extTol;
        if( dx0 * dx0 + dy0 * dy0 <= r * r ) {
            return true;
        }
    } else if( geom.shape === 'gdnt' || geom.shape === 'weld' || geom.shape === 'leader' || geom.shape === 'symbol' ) {
        if( geom.vertices ) {
            for( let i = 0; i < geom.vertices.length - 1; i++ ) {
                if( pointOnLine( point, geom.vertices[ i ], geom.vertices[ i + 1 ], lenTol ) ) {
                    return true;
                }
            }
        }

        const xmin = Math.min( geom.startPt.x, geom.endPt.x );
        const xmax = Math.max( geom.startPt.x, geom.endPt.x );
        const ymin = Math.min( geom.startPt.y, geom.endPt.y );
        const ymax = Math.max( geom.startPt.y, geom.endPt.y );
        return xmin - extTol <= point.x && point.x <= xmax + extTol &&
               ymin - extTol <= point.y && point.y <= ymax + extTol;
    } else if( geom.shape === 'measurement' ) {
        if( geom.rect ) {
            var bbox = {};
            bbox.xmin = geom.textPt.x - geom.rect.width * 0.5;
            bbox.xmax = geom.textPt.x + geom.rect.width * 0.6;
            bbox.ymin = geom.textPt.y + geom.rect.height * 1.25;
            bbox.ymax = geom.textPt.y;

            if( point.x >= bbox.xmin && point.x <= bbox.xmax &&
                point.y <= bbox.ymin && point.y >= bbox.ymax ) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get the bounding box of a geometry
 *
 * @param {FitPathResult} geom The geometry in world coord
 *
 * @return {Bbox} the bounding box
 */
export function getGeomBbox( geom ) {
    if( geom.bbox ) {
        return geom.bbox;
    }

    var bbox = { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
    if( geom.shape === 'freehand' || geom.shape === 'polyline' || geom.shape === 'polygon' ||
         geom.shape === 'curve' || geom.shape === 'closed-curve' ) {
        let vertices = geom.shape === 'curve' || geom.shape === 'closed-curve' ?
            getCurveApproxPts( geom ) : geom.vertices;

        bbox.xmin = bbox.xmax = vertices[ 0 ].x;
        bbox.ymin = bbox.ymax = vertices[ 0 ].y;

        for( let i = 1; i < vertices.length; i++ ) {
            const x = vertices[ i ].x;
            const y = vertices[ i ].y;

            bbox.xmin = Math.min( bbox.xmin, x );
            bbox.xmax = Math.max( bbox.xmax, x );
            bbox.ymin = Math.min( bbox.ymin, y );
            bbox.ymax = Math.max( bbox.ymax, y );
        }
    } else if( geom.shape === 'circle' || geom.shape === 'ellipse' || geom.shape === 'rectangle' ) {
        var halfW = geom.major;
        var halfH = geom.minor;

        if( geom.angle !== 0 ) {
            var ux = geom.major * Math.cos( geom.angle );
            var uy = geom.major * Math.sin( geom.angle );
            var vx = geom.minor * Math.cos( geom.angle + Math.PI / 2 );
            var vy = geom.minor * Math.sin( geom.angle + Math.PI / 2 );

            if( geom.shape === 'ellipse' || geom.shape === 'circle' ) {
                halfW = Math.sqrt( ux * ux + vx * vx );
                halfH = Math.sqrt( uy * uy + vy * vy );
            } else {
                // rectangle
                halfW = Math.abs( ux ) + Math.abs( vx );
                halfH = Math.abs( uy ) + Math.abs( vy );
            }
        }

        bbox.xmin = geom.center.x - halfW;
        bbox.xmax = geom.center.x + halfW;
        bbox.ymin = geom.center.y - halfH;
        bbox.ymax = geom.center.y + halfH;
    } else if( geom.shape === 'gdnt' || geom.shape === 'weld' || geom.shape === 'leader' || geom.shape === 'symbol' ) {
        bbox.xmin = Math.min( geom.startPt.x, geom.endPt.x );
        bbox.xmax = Math.max( geom.startPt.x, geom.endPt.x );
        bbox.ymin = Math.min( geom.startPt.y, geom.endPt.y );
        bbox.ymax = Math.max( geom.startPt.y, geom.endPt.y );

        if( geom.vertices ) {
            for( let i = 0; i < geom.vertices.length; i++ ) {
                const x = geom.vertices[ i ].x;
                const y = geom.vertices[ i ].y;

                bbox.xmin = Math.min( bbox.xmin, x );
                bbox.xmax = Math.max( bbox.xmax, x );
                bbox.ymin = Math.min( bbox.ymin, y );
                bbox.ymax = Math.max( bbox.ymax, y );
            }
        }
    } else if( geom.shape === 'measurement' ) {
        var mx = geom.startPt.x;
        var my = geom.startPt.y;
        bbox.xmin = Math.min( bbox.xmin, mx );
        bbox.xmax = Math.max( bbox.xmax, mx );
        bbox.ymin = Math.min( bbox.ymin, my );
        bbox.ymax = Math.max( bbox.ymax, my );

        mx = geom.endPt.x;
        my = geom.endPt.y;
        bbox.xmin = Math.min( bbox.xmin, mx );
        bbox.xmax = Math.max( bbox.xmax, mx );
        bbox.ymin = Math.min( bbox.ymin, my );
        bbox.ymax = Math.max( bbox.ymax, my );

        mx = geom.textPt.x;
        my = geom.textPt.y;
        bbox.xmin = Math.min( bbox.xmin, mx );
        bbox.xmax = Math.max( bbox.xmax, mx );
        bbox.ymin = Math.min( bbox.ymin, my );
        bbox.ymax = Math.max( bbox.ymax, my );
    }

    geom.bbox = bbox;
    return bbox;
}

/**
 * Get the area of the geometry
 *
 * @param {FitPathResult} geom The geometry in world coord
 *
 * @return {number} the area of the geometry
 */
export function getGeomArea( geom ) {
    if( geom.area ) {
        return geom.area;
    }

    var area = 0;
    if( geom.shape === 'freehand' || geom.shape === 'polyline' || geom.shape === 'curve' ) {
        const vertices = geom.shape === 'curve' ? getCurveApproxPts( geom ) : geom.vertices;
        for( let i = 1; i < vertices.length; i++ ) {
            const dx = vertices[ i ].x - vertices[ i - 1 ].x;
            const dy = vertices[ i ].y - vertices[ i - 1 ].y;
            area += Math.sqrt( dx * dx + dy * dy );
        }
    } else if( geom.shape === 'polygon' || geom.shape === 'closed-curve' ) {
        const vertices = geom.shape === 'closed-curve' ? getCurveApproxPts( geom ) : geom.vertices;
        for( let i = 1; i < vertices.length; i++ ) {
            area += vertices[ i - 1 ].x * vertices[ i ].y - vertices[ i - 1 ].y * vertices[ i ].x;
        }
        area = Math.abs( area / 2 );
    } else if( geom.shape === 'rectangle' ) {
        area = geom.major * geom.minor * 4;
    } else if( geom.shape === 'circle' || geom.shape === 'ellipse' ) {
        area = geom.major * geom.minor * Math.PI;
    } else if( geom.shape === 'gdnt' || geom.shape === 'weld' || geom.shape === 'leader' || geom.shape === 'symbol' ) {
        area = Math.abs( ( geom.endPt.x - geom.startPt.x ) * ( geom.endPt.y - geom.startPt.y ) );
    } else if( geom.shape === 'measurement' ) {
        if( geom.rect ) {
            area = geom.rect.width * geom.rect.height * 4;
        }
    }

    geom.area = area;

    return area;
}

/**
 * Get a rectangle from a geometry
 *    for geom with center, it's the inscribed rectangle in world coord, with origin at center
 *    for other geom, guess a good size and position of the rectangle in world coord
 *
 * @param {Geom} geom the geometry to calculate
 * @param {Boolean} clip if true replace inscribed rectangle with circumscribed rectangle
 * @returns {Rectangle} the rectangle contains width, height, left, top
 */
export function getGeomRect( geom, clip ) {
    var x = 0;
    var y = 0;
    var w = 1000;
    var h = 1000;
    var bbox = getGeomBbox( geom );

    if( clip ) {
        if( geom.shape === 'circle' || geom.shape === 'ellipse' || geom.shape === 'rectangle' ) {
            w = geom.major * 2;
            h = geom.minor * 2;
            x = -geom.major;
            y = -geom.minor;
        } else {
            w = bbox.xmax - bbox.xmin;
            h = bbox.ymax - bbox.ymin;
            x = bbox.xmin;
            y = bbox.ymin;
        }

        // when clip, make rect larger so that image edges are not shown
        x -= w * 0.05;
        y -= h * 0.05;
        w *= 1.1;
        h *= 1.1;
    } else if( geom.shape === 'rectangle' ) {
        var c = geom.cornerRadius > 0 ? geom.cornerRadius * geom.minor * ( 1 - halfSqrt2 ) : 0;
        w = ( geom.major - c ) * 2;
        h = ( geom.minor - c ) * 2;
        x = -geom.major + c;
        y = -geom.minor + c;
    } else if( geom.shape === 'circle' || geom.shape === 'ellipse' ) {
        w = geom.major * halfSqrt2 * 2;
        h = geom.minor * halfSqrt2 * 2;
        x = -geom.major * halfSqrt2;
        y = -geom.minor * halfSqrt2;
    } else if( geom.shape === 'polygon' || geom.shape === 'closed-curve' ) {
        w = ( bbox.xmax - bbox.xmin ) / 2;
        h = ( bbox.ymax - bbox.ymin ) / 2;
        x = bbox.xmin * 0.75 + bbox.xmax * 0.25;
        y = bbox.ymin * 0.75 + bbox.ymax * 0.25;
    } else if( geom.shape === 'polyline' || geom.shape === 'curve' ) {
        if( bbox.xmax - bbox.xmin > 0.0 ) {
            w =  bbox.xmax - bbox.xmin;
        }
        if( bbox.ymax - bbox.ymin > 0.0 ) {
            h =  bbox.ymax - bbox.ymin;
        }
        var n = !geom.startArrow || geom.startArrow.style === 'none' ? 0 :
            !geom.endArrow || geom.endArrow.style === 'none' ? geom.vertices.length - 1 :
                Math.floor( geom.vertices.length / 2 );
        x = geom.vertices[ n ].x;
        y = geom.vertices[ n ].y;
    } else {
        w = ( bbox.xmax - bbox.xmin ) / 2;
        h = ( bbox.ymax - bbox.ymin ) / 2;
        x = bbox.xmin * 0.75 + bbox.xmax * 0.25;
        y = bbox.ymin * 0.75 + bbox.ymax * 0.25;
    }

    return { width: w, height: h, left: x, top: y };
}

/**
 * Get the geometry turn, i.e. total angle / 2 PI, >0 when ccw, <0 when cw
 *
 * @param {Geometry} geom - the geometry to be calculated
 *
 * @returns {Number} the turn
 */
export function getGeomTurn( geom ) {
    if( geom.shape === 'circle' || geom.shape === 'ellipse' || geom.shape === 'rectangle' ) {
        return 1;
    }

    if( geom.turn !== undefined ) {
        return geom.turn;
    }

    var closed = geom.shape === 'polygon' || geom.shape === 'closed-curve';
    var turn = 0;
    var pt = geom.vertices;
    if( pt && pt.length > 3 ) {
        for( var i = closed ? 0 : 1; i < pt.length - 1; i++ ) {
            var prev = pt[ i > 0 ? i - 1 : pt.length - 2 ];
            var dx0 = pt[i].x - prev.x;
            var dy0 = pt[i].y - prev.y;
            var dx1 = pt[i + 1].x - pt[i].x;
            var dy1 = pt[i + 1].y - pt[i].y;
            var dot = dx0 * dx1 + dy0 * dy1;
            var cross = dx0 * dy1 - dx1 * dy0;
            turn += Math.atan2( cross, dot );
        }
        turn /= Math.PI * 2;
    }

    return turn;
}

/**
 * Get the curve degree starting at the given index
 *
 * @param {Geometry} geom - the current geom
 * @param {Number} index - the current index
 *
 * @returns {Number} the curve degree: 1 = linear, 2 = quadratic, 3 = cubic
 */
export function getCurveDegree( geom, index ) {
    if( geom.vertices ) {
        var c1 = geom.vertices[index + 1] && geom.vertices[index + 1].c;
        var c2 = geom.vertices[index + 2] && geom.vertices[index + 2].c;
        return c1 && c2 ? 3 : c1 ? 2 : 1;
    }

    return 1;
}

/**
 * Get the points of the curve linear approximation
 *
 * @param {Geometry} geom - the geom of curve or closed-curve
 * @param {Number} tol - tolerance for the curve approximation, default 6
 *
 * @returns {Point[]} the points of the curve linear approximation
 */
export function getCurveApproxPts( geom, tol ) {
    if( geom.shape !== 'curve' && geom.shape !== 'closed-curve' ) {
        return [];
    }

    if( geom.approxPts && geom.approxPts.length > 1 ) {
        return geom.approxPts;
    }

    tol = tol || 6;
    geom.approxPts = [];
    pushApproxPt( geom, geom.vertices[0] );
    for( var i = 0; i < geom.vertices.length - 1; ) {
        var d = getCurveDegree( geom, i );
        addCurveApproxPts( geom, i, i + d, 0, 1, geom.vertices[i], geom.vertices[i + d], tol );
        i += d;
    }

    return geom.approxPts;
}

/**
 * Is the geom a closed shape
 *
 * @param {Geom} geom - the geom to be tested
 */
export function isClosedShape( geom ) {
    return geom.shape === 'circle' || geom.shape === 'ellipse' || geom.shape === 'rectangle' ||
           geom.shape === 'polygon' || geom.shape === 'closed-curve';
}

/**
 * Initialize a geometry for transformation
 *
 * @param {Geom} geom - the geom to be initialized for transformation
 * @param {Number} startT - the start time
 * @param {Number} endT - the end time
 */
export function initTransform( geom, startT, endT ) {
    if( !geom.transform ) {
        geom.transform = [ { scale: 1, x: 0, y: 0, angle: 0 }, { scale: 1, x: 0, y: 0, angle: 0 } ];
        geom.transform[0].t = startT;
        geom.transform[1].t = endT;
    }
}

/**
 * Interpolate the geometry transformation according to the input time
 *
 * @param {Geom} geom - the geom
 * @param {Number} t - the time
 *
 * @returns {Transformation} - the interpolated transformation, or null if not available
 */
export function interpolate( geom, t ) {
    if( geom.transform && t >= 0 ) {
        for( var i = 0; i < geom.transform.length; i++ ) {
            var trans = geom.transform[i];
            if( t <= trans.t ) {
                if( i === 0 ) {
                    return Object.assign( {}, trans );
                }
                var prev = geom.transform[i - 1];
                var ratio = ( t - prev.t ) / ( trans.t - prev.t );
                return {
                    x: prev.x * ( 1 - ratio ) + trans.x * ratio,
                    y: prev.y * ( 1 - ratio ) + trans.y * ratio,
                    scale: prev.scale * ( 1 - ratio ) + trans.scale * ratio,
                    angle: prev.angle * ( 1 - ratio ) + trans.angle * ratio,
                    t: t
                };
            }
        }

        return Object.assign( {}, geom.transform[ geom.transform.length - 1 ] );
    }

    return null;
}

/**
 * Translate a point by a transformation
 *
 * @param {Point} pt - the point in world coord
 * @param {Transform} transform - the transformation
 * @param {Boolean} inverse - if true do inverse translation
 */
function translatePoint( pt, transform, inverse ) {
    var n = inverse ? -1 : 1;
    return {
        x: pt.x + ( transform ? transform.x * n : 0 ),
        y: pt.y + ( transform ? transform.y * n : 0 ),
        c: pt.c
    };
}

//==================================================
// private functions
//==================================================
/**
 * Transform an array of points from screen coord to world coord
 *
 * @param [FitPathPoint] array The array of points
 * @param {ViewParam} viewParam The view param
 *
 * @return [FitPathPoint] The array of the transformed points
 */
function pointArrayScreenToWorld( array, viewParam ) {
    if( array ) {
        var result = [];
        for( var i = 0; i < array.length; i++ ) {
            result.push( pointScreenToWorld( array[ i ], viewParam ) );
        }
        return result;
    }
}

/**
 * Transform an array of points from world coord to screen coord
 *
 * @param [FitPathPoint] array the array of points
 * @param {ViewParam} viewParam The view param
 * @param {Transformation} transform - optional extra transformation before transforming the points
 *
 * @return [FitPathPoint] The array of the transformed points
 */
function pointArrayWorldToScreen( array, viewParam, transform ) {
    if( array ) {
        var result = [];
        for( var i = 0; i < array.length; i++ ) {
            var pt = translatePoint( array[ i ], transform );
            result.push( pointWorldToScreen( pt, viewParam ) );
        }
        return result;
    }
}

/**
 * Check if a point is in the triangle
 *
 * @param {FitPathPoint} p The point in world coord
 * @param {FitPathPoint} a The first vertex in world coord
 * @param {FitPathPoint} b The second vertex in world coord
 * @param {FitPathPoint} c The third vertex in world coord
 *
 * @return {boolean} true if it is in the triangle
 */
function pointInTriangle( p, a, b, c ) {
    var v0x = c.x - a.x;
    var v0y = c.y - a.y;
    var v1x = b.x - a.x;
    var v1y = b.y - a.y;
    var v2x = p.x - a.x;
    var v2y = p.y - a.y;

    var dot00 = v0x * v0x + v0y * v0y;
    var dot01 = v0x * v1x + v0y * v1y;
    var dot02 = v0x * v2x + v0y * v2y;
    var dot11 = v1x * v1x + v1y * v1y;
    var dot12 = v1x * v2x + v1y * v2y;
    var denom = dot00 * dot11 - dot01 * dot01;

    if( denom < eps ) {
        return false;
    }

    var u = ( dot11 * dot02 - dot01 * dot12 ) / denom;
    var v = ( dot00 * dot12 - dot01 * dot02 ) / denom;
    return  u >= -eps && v >= -eps && u + v <= 1 + eps;
}

/**
 * Check if a point is on the line
 *
 * @param {FitPathPoint} p The point in world coord
 * @param {FitPathPoint} a The first vertex in world coord
 * @param {FitPathPoint} b The second vertex in world coord
 * @param {Number} tol The tolerance
 *
 * @return {boolean} true if it is on the line
 */
function pointOnLine( p, a, b, tol ) {
    var v0x = b.x - a.x;
    var v0y = b.y - a.y;
    var len2 = v0x * v0x + v0y * v0y;
    var len = Math.sqrt( len2 );

    var v1x = p.x - a.x;
    var v1y = p.y - a.y;
    var t = ( v0x * v1x + v0y * v1y ) / len2;

    if( 0 <= t && t <= 1 && Math.abs( v0x * v1y - v1x * v0y ) / len <= tol ) {
        return true;
    }
}

/**
 * Check if a point is on the start or end point
 *
 * @param {FitPathPoint} p The point in world coord
 * @param {FitPathPoint} s The start point in world coord
 * @param {FitPathPoint} e The last point in world coord
 * @param {Number} tol The tolerance
 *
 * @return {boolean} true if it is on the line
 */
function pointOnPoint( p, s, e, tol ) {
    //Start Point
    var v0x = s.x;
    var v0y = s.y;

    //End Point
    var v1x = e.x;
    var v1y = e.y;

    var resultTag = {
        result: false,
        tag: 0
    };

    //Compare Distance between Start Point to Current Point, then End Point to Current Point
    if( Math.hypot( v0x - p.x, v0y - p.y ) <= tol ) {
        resultTag.result = true;
        resultTag.tag = 1;
    } else if ( Math.hypot( v1x - p.x, v1y - p.y ) <= tol ) {
        resultTag.result = true;
        resultTag.tag = 2;
    }
    return resultTag;
}

/**
 * Add curve approximate points
 *
 * @param {Geometry} geom - the curve geometry
 * @param {Number} startIndex - curve start index
 * @param {Number} endIndex - curve end index
 * @param {Number} startParam - start param
 * @param {Number} endParam - end param
 * @param {Point} startPoint - start point - curve at startParam
 * @param {Point} endPoint - end point - curve at endParam
 * @param {Number} tol - tolerance for the curve approximation
 */
function addCurveApproxPts( geom, startIndex, endIndex, startParam, endParam, startPoint, endPoint, tol ) {
    var degree = endIndex - startIndex;
    if( degree < 2 ) {
        pushApproxPt( geom, geom.vertices[ endIndex ] );
    } else {
        var dx = endPoint.x - startPoint.x;
        var dy = endPoint.y - startPoint.y;
        var len = Math.sqrt( dx * dx + dy * dy );

        if( len < tol ) {
            pushApproxPt( geom, endPoint );
        } else {
            var midParam = ( startParam + endParam ) / 2;
            var midPoint = evaluate( geom.vertices, startIndex, endIndex, midParam );
            var dist = Math.abs( ( midPoint.x - startPoint.x ) * dy - ( midPoint.y - startPoint.y ) * dx ) / len;

            if( dist < tol ) {
                pushApproxPt( geom, endPoint );
            } else {
                addCurveApproxPts( geom, startIndex, endIndex, startParam, midParam, startPoint, midPoint, tol );
                addCurveApproxPts( geom, startIndex, endIndex, midParam, endParam, midPoint, endPoint, tol );
            }
        }
    }
}

/**
 * Evaluate the curve at given parameter
 *
 * @param {Number[]} curve - array of points for a piecewise Bezier curve
 * @param {Number} startIndex - start index of the curve
 * @param {Number} endIndex - end index of the curve
 * @param {Number} param - the parameter to evaluate, in the range of [0, 1]
 */
function evaluate( curve, startIndex, endIndex, param ) {
    var degree = endIndex - startIndex;
    var tmp = curve.slice( startIndex, endIndex + 1 );
    for( var i = 1; i <= degree; i++ ) {
        for( var j = 0; j <= degree - i; j++ ) {
            var x = tmp[j].x * ( 1 - param ) + tmp[j + 1].x * param;
            var y = tmp[j].y * ( 1 - param ) + tmp[j + 1].y * param;
            tmp[j] = { x, y };
        }
    }
    return tmp[0];
}

/**
 * Push the copy of a point into the geom.approxPts
 *
 * @param {Geometry} geom - the geometry
 * @param {Point} point - the point to copied and pushed
 */
function pushApproxPt( geom, point ) {
    geom.approxPts.push( { x: point.x, y: point.y } );
}

//==================================================
// exported functions
//==================================================
let exports;

export default exports = {
    geomScreenToWorld,
    geomWorldToScreen,
    pointScreenToWorld,
    pointWorldToScreen,
    pointInGeom,
    getGeomBbox,
    getGeomArea,
    getGeomRect,
    getGeomTurn,
    getCurveDegree,
    getCurveApproxPts,
    isClosedShape,
    initTransform,
    interpolate,
    translatePoint,
    pointOnPoint
};
