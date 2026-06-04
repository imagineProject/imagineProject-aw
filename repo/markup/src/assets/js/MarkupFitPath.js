
// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/**
 * This class implements an algorithm to fit hand drawing curve with polygon or ellipse
 * <p>
 * Overview of the algorithm:
 * </p>
 * <ol>
 * <li>Analyze the curvature of the input curve</li>
 * <li>Find the vertices</li>
 * <li>If vertices are found, try to fit with a polyline</li>
 * <li>If it's a polyline, try to close it as a polygon</li>
 * <li>If it's a polygon, check if it's a rectangle within tolerance</li>
 * <li>If the polyline is open, check if there are arrows at the start/end points</li>
 * <li>If the input curve is nearly smooth and turning about 2 PI, try to fit with an ellipse
 * <ul>
 * <li>Find the center</li>
 * <li>Find the major and minor axis lengths</li>
 * <li>If major and minor lengths are within tolerance, it's a circle</li>
 * <li>Stabilize the major axis vector</li>
 * <li>Verify that all the points are on the ellipse within tolerance</li>
 * </ul>
 * </li>
 * <li>Otherwise, it's a freehand drawing</li>
 * </ol>
 * <p>
 * The complexity of the algorithm is O(n) where n is the number of input points
 * </p>
 *
 * @module js/MarkupFitPath
 */

'use strict';
//==================================================
// private variables
//==================================================
/** the input point list */
var ptList = [];
/** the parameters */
var params = {};
/** the input point array */
var pt = [];
/** the curvature array */
var cv = [];
/** the fit result */
var fitResult = {};
/** the merge results stack */
var mergeStack = [];
/** the merge results stack top index */
var mergeStackTop = -1;
/** do auto-merge when fit */
var autoMerge = false;
/** the sum of ds */
var sumDs = 0;
/** the sum of dt */
var sumDt = 0;
/** the indices of vertices */
var indices = [];
/** constant value 2 PI */
var angle2PI = Math.PI * 2;
/** the constant of right angle, i.e. half PI */
var angleRight = Math.PI / 2;

//==================================================
// public functions
//==================================================
/**
 * Start point of the user drawing, to be called by mousedown or touchstart
 *
 * @param {number} x the raw x coordinate
 * @param {number} y the raw y coordinate
 */
export function start( x, y ) {
    ptList = [];
    ptList.push( { x: x, y: y } );
}

/**
 * Add point of the user drawing, to be called by mousedrag or touchmove
 *
 * @param {number} x the raw x coordinate
 * @param {number} y the raw y coordinate
 */
export function add( x, y ) {
    ptList.push( { x: x, y: y } );
}

/**
 * Fit the input points in array, return result object
 *
 * @param {[FitPoint]} path the input point array, default ptList
 * @return {FitPathResult} the fit result
 */
export function fit( path ) {
    pt = path || ptList;
    if( !params.angleVertex ) {
        setDefaultParams();
    }

    // Fit points into a result
    fitResult = {};
    if( analyze() ) {
        if( fitPolyLine( fitResult ) ) {
            if( !fitArrow( fitResult ) && fitPolygon( fitResult ) ) {
                fitRectangle( fitResult );
            }
        } else {
            if( !fitEllipse( fitResult ) ) {
                fitCurve( fitResult );
            }
        }
    }

    // allow undo ellipse, circle, rectangle, polygon, polyline
    var prevResult = {};
    if( fitResult.shape !== 'curve' && fitResult.shape !== 'closed-curve' ) {
        fitCurve( prevResult );
    }

    // If autoMerge, merge fitResult into the previous merge results
    if( autoMerge ) {
        // remove elements after mergeStackTop, which could be -1 means delete all
        if( mergeStackTop < mergeStack.length - 1 ) {
            mergeStack.splice( mergeStackTop + 1, mergeStack.length - mergeStackTop - 1 );
        }

        if( mergeStack.length === 0 ) {
            if( prevResult.shape ) {
                pushToMergeStack( [ prevResult ] );
            }
            pushToMergeStack( [ fitResult ] );
        } else {
            var mergeResults = mergeStack[mergeStack.length - 1];
            if( prevResult.shape ) {
                pushToMergeStack( mergeResults.concat( [ prevResult ] ) );
            }

            var toMerge = [];
            toMerge.push( fitResult );
            for( var i = 0; i < mergeResults.length; i++ ) {
                toMerge.push( mergeResults[i] );
            }

            pushToMergeStack( toMerge );
            mergeResults = merge( toMerge );
            if( mergeResults.length < toMerge.length ) {
                pushToMergeStack( mergeResults );
            }
        }
    }

    return fitResult;
}

/**
 * Fit the input points in array, return result in Json
 *
 * @param {[FitPoint]} path the input point array, default ptList
 * @return {String} the fit result in Json
 */
export function fitJson( path ) {
    var result = fit( path );
    return JSON.stringify( result );
}

/**
 * Set the default params
 */
export function setDefaultParams() {
    /** angle tolerance over a vertex */
    params.angleVertex = Math.PI / 4;

    /** angle tolerance over a full circle or ellipse */
    params.angleFull = Math.PI / 3;

    /** angle tolerance to snap a rectangle or ellipse to the x y coordinate axes */
    params.angleSnap = Math.PI / 32;

    /** angle between two lines to form an arrow */
    params.angleArrow = Math.PI / 3;

    /** max length of the arrow */
    params.lenArrow = 80;

    /** length of the small arc over a vertex */
    params.lenVertex = 5;

    /** ratio of the length tolerance over a line segment length */
    params.ratioSegTol = 0.1;

    /** ratio of the length tolerance over circle/ellipse circumference */
    params.ratioLenTol = params.ratioSegTol / Math.PI;

    /** ratio between the lengths of the two opposite edges of a rectangle */
    params.ratioRect = 0.8;

    /** ratio of dy/dx or dx/dy to snap a line to x y coordinate axes */
    params.ratioSnap = 0.1;

    /** minimum ratio of intersection point inside the line segment */
    params.ratioInterMin = 0.6;

    /** maximum ratio of intersection point outside the line segment */
    params.ratioInterMax = 1.6;

    /** minimum ratio of a line segment length over the total length */
    params.ratioColiMin = 0.2;

    /** maximum ratio of a line segment length over the total length */
    params.ratioColiMax = 0.8;

    /** the epsilon to eliminate divide by zero exception */
    params.eps = 0.000001;

    /** the tolerance to fit curve */
    params.curveTol = 16;

    /** the tolerance to close curve or connect curves */
    params.closedCurveTol = 24;

    /** the ratio to close curve */
    params.closedCurveRatio = 0.1;
}

/**
 * Adjust the params
 *
 * @param {number} factor the factor 1.0 same, >1.0 more tolerate <1.0 more precise
 */
export function adjustParams( factor ) {
    params.angleFull *= factor;
    params.angleSnap *= factor;
    params.angleArrow *= factor;
    params.ratioLenTol *= factor;
    params.ratioSegTol *= factor;
    params.ratioRect *= factor;
    params.ratioSnap *= factor;
}

/**
 * Clear the merge results stack
 *
 * @param {boolean} doAutoMerge do automatic merge when fit
 */
export function clearMergeStack( doAutoMerge ) {
    autoMerge = doAutoMerge;
    mergeStack = [];
    mergeStackTop = -1;
}

/**
 * Push results into the stack
 *
 * @param [FitPathResult] results the results to be pushed
 */
export function pushToMergeStack( results ) {
    mergeStack.push( results );
    mergeStackTop = mergeStack.length - 1;
}

/**
 * Get the input/output data in Json
 *
 * @return {String} the input/output data in Json
 */
export function getJsonData() {
    var data = {};
    data.path = pt;
    data.fitResult = fitResult;
    data.mergeStack = mergeStack;
    return JSON.stringify( data );
}

/**
 * merge input results
 *
 * @param [FitPathResult] toBeMerged the input results to be merged
 * @return [FitPathResult] the output results after merge
 */
export function merge( toBeMerged ) {
    if( toBeMerged === null ) {
        return null;
    }

    var candidates = [];
    var processed = [];

    // split input list into candidates and processed lists
    for( var i = 0; i < toBeMerged.length; i++ ) {
        var res = toBeMerged[i];
        if( isOpenPolylineOrCurve( res ) ) {
            candidates.push( res );
        } else {
            processed.push( res );
        }
    }

    // process each result in the candidates until all are processed
    while( candidates.length > 0 ) {
        var merging = candidates.shift();
        var merged = true;

        while( merged ) {
            merged = false;
            for( var j = 0; j < candidates.length; j++ ) {
                var resl = mergePolylinesOrCurves( merging, candidates[j] );
                if( resl !== null ) {
                    merging = resl;
                    merged = true;
                    candidates.splice( j--, 1 );
                }
            }
        }

        processed.push( merging );
    }

    return processed;
}

//==================================================
// private functions
//==================================================
/**
 * Analyze the data
 *
 * @return {boolean} true if successful
 */
function analyze() {
    if( !pt || pt.length < 2 ) {
        return false;
    }

    sumDs = 0.0;
    sumDt = 0.0;
    cv = [];

    analyzeArcLength();
    analyzeCurvature();
    analyzeCurvatureOnArc();

    return true;
}

/**
 * Fit the data into polyline
 *
 * @param {FitPathResult} result the input and output result
 * @return {boolean} true if successful
 */
function fitPolyLine( result ) {
    createIndices();
    if( verifyIndices() ) {
        result.shape = 'polyline';
        result.vertices = [];
        for( var i = 0; i < indices.length; i++ ) {
            var index = indices[i];
            result.vertices.push( { x: pt[index].x, y: pt[index].y } );
        }

        return true;
    }

    return false;
}

/**
 * Fit the data into arrow
 *
 * @param {FitPathResult} result the input and output result
 * @return {boolean} true if successful
 */
function fitArrow( result ) {
    result.startArrow = false;
    result.endArrow = false;

    // do not fit arrow on an arrowhead
    if( isArrowhead( result ) ) {
        return false;
    }

    // detect if there is a start arrow
    var vertices = result.vertices;
    if( vertices.length > 2 ) {
        result.startArrow = detectArrow( vertices, 0, 1, 2 );
    }

    // detect if there is an end arrow
    if( vertices.length > ( result.startArrow ? 3 : 2 ) ) {
        var n = vertices.length - 2;
        result.endArrow = detectArrow( vertices, n + 1, n, n - 1 );
    }

    // Rearrange the vertices
    if( result.startArrow || result.endArrow ) {
        result.vertices = removeVertices( result.vertices, result.startArrow, result.endArrow );
    }

    snapLineSegments( result.vertices );
    return result.startArrow || result.endArrow;
}

/**
 * Fit the data into polygon
 *
 * @param {FitPathResult} result the input and output result
 * @return {boolean} true if successful
 */
function fitPolygon( result ) {
    if( result.shape === 'polyline' && !result.startArrow && !result.endArrow && result.vertices.length > 3 ) {
        // find the intersection of the first and last segments
        var vertices = result.vertices;
        var n = vertices.length - 1;
        var p = intersection( vertices[0], vertices[1], vertices[n - 1], vertices[n] );
        if( p ) {
            result.shape = 'polygon';
            vertices[0].x = p.x;
            vertices[n].x = p.x;
            vertices[0].y = p.y;
            vertices[n].y = p.y;
        }

        // check if the first and last segments are colinear
        if( vertices.length > 4 && isFullCircle() &&
            colinear( vertices[0], vertices[1], vertices[n - 1], vertices[n] ) ) {
            result.shape = 'polygon';
            vertices = result.vertices = removeVertices( result.vertices, false, true );
            vertices[0].x = vertices[n - 1].x;
            vertices[0].y = vertices[n - 1].y;
        }
    }

    return result.shape === 'polygon';
}

/**
 * Fit the data to freehand
 *
 * @param {FitPathResult} result the input and output result
 */
function fitFreehand( result ) {
    result.shape = 'freehand';
    result.vertices = [];
    for( var i = 0; i < pt.length; i++ ) {
        result.vertices.push( { x: pt[i].x, y: pt[i].y } );
    }
}

/**
 * Fit the data into rectangle
 *
 * @param {FitPathResult} result the input and output result
 * @return {boolean} true if successful
 */
function fitRectangle( result ) {
    if( result.shape === 'polygon' && result.vertices.length === 5 ) {
        var xV = [];
        var yV = [];
        var rV = [];
        findEdgesAndDiagonals( result.vertices, xV, yV, rV );

        var ratio0 = rV[0] > rV[2] ? rV[2] / rV[0] : rV[0] / rV[2];
        var ratio1 = rV[1] > rV[3] ? rV[3] / rV[1] : rV[1] / rV[3];
        var ratio2 = rV[4] > rV[5] ? rV[5] / rV[4] : rV[4] / rV[5];

        if( ratio0 > params.ratioRect && ratio1 > params.ratioRect && ratio2 > params.ratioRect ) {
            var len0 = rV[0] + rV[2];
            var len1 = rV[1] + rV[3];
            var xDir = len0 > len1 ? xV[0] - xV[2] : xV[1] - xV[3];
            var yDir = len0 > len1 ? yV[0] - yV[2] : yV[1] - yV[3];
            var angle = Math.atan2( yDir, xDir );

            result.shape = 'rectangle';
            result.center = findRectangleCenter( result.vertices );
            result.major = ( len0 > len1 ? len0 : len1 ) / 4;
            result.minor = ( len0 > len1 ? len1 : len0 ) / 4;
            result.angle = snapAngle( angle );
            result.vertices = [];
            return true;
        }
    }

    return false;
}

/**
 * Fit the data into ellipse
 *
 * @param {FitPathResult} result the input and output result
 * @return {boolean} true if successful
 */
function fitEllipse( result ) {
    if( pt.length > 10 && !result.startArrow && !result.endArrow && isFullCircle() ) {
        var min = [];
        var max = [];
        var center = findCenterMinMax( min, max );

        var err = Math.max( params.lenVertex, sumDs * params.ratioLenTol );
        if( max[2] - min[2] < 2 * err ) {
            result.shape = 'circle';
            result.center = center;
            result.major = ( min[2] + max[2] ) / 2;
            result.minor = result.major;
            result.angle = 0;
            return true;
        }

        var dot = ( min[0] * max[0] + min[1] * max[1] ) / ( min[2] * max[2] );
        if( Math.abs( dot ) > 0.5 ) {
            return false;
        }

        var angle = stabilizeAngle( center, min, max );
        if( verifyEllipse( center, min, max, angle ) ) {
            result.shape = 'ellipse';
            result.center = center;
            result.major = max[2];
            result.minor = min[2];
            result.angle = snapAngle( angle );
            return true;
        }
    }
    return false;
}

/**
 * Fit the data to curve
 *
 * @param {FitPathResult} result the input and output result
 *
 * @return {boolean} true if successful
 */
function fitCurve( result ) {
    var n = pt.length;

    if( n > 2 ) {
        result.shape = 'curve';
        result.vertices = [];
        result.vertices.push( setControl( pt[0] ) );

        var tan1 = subtract( pt[1], pt[0] );
        var tan2 = subtract( pt[n - 2], pt[n - 1] );
        fitCubic( result, params.curveTol, 0, n - 1, tan1, tan2 );
        fitClosedCuve( result );

        return true;
    }

    return false;
}

/**
 * Fit the data into closed curve
 *
 * @param {FitPathResult} result the input and output result
 *
 * @return {boolean} true if successful
 */
function fitClosedCuve( result ) {
    if( result.shape === 'curve' && !result.startArrow && !result.endArrow && result.vertices.length > 3 ) {
        var vertices = result.vertices;
        var len = 0;
        for( var i = 0; i < vertices.length - 1; i++ ) {
            len += getDistance( vertices[i], vertices[i + 1] );
        }

        var tol = Math.min( params.closedCurveTol, params.closedCurveRatio * len );
        if( getDistance( vertices[0], vertices[vertices.length - 1] ) < tol ) {
            result.shape = 'closed-curve';
            vertices.push( setControl( vertices[0] ) );
            return true;
        }
    }

    return false;
}

/**
 * Is the data forming a full circle with tolerance?
 *
 * @return {boolean} true if it is
 */
function isFullCircle() {
    var absSumDt = Math.abs( sumDt );
    return absSumDt > angle2PI - params.angleFull && absSumDt < angle2PI + params.angleFull * 2;
}

/**
 * Remove the vertices at the ends of polyline
 *
 * @param [FitPathPoint] vertices the input vertices
 * @param {boolean} removeFirst remove the first vertex
 * @param {boolean} removeLast remove the last vertex
 * @return [FitPathPoint] the new vertices
 */
function removeVertices( vertices, removeFirst, removeLast ) {
    var minVertices = removeFirst && removeLast ? 4 : 3;
    if( !removeFirst && !removeLast || vertices.length < minVertices ) {
        return vertices;
    }

    var n = vertices.length - ( removeFirst && removeLast ? 2 : 1 );
    var newVertices = [];

    for( var i = 0; i < n; i++ ) {
        newVertices.push( vertices[removeFirst ? i + 1 : i] );
    }

    return newVertices;
}

/**
 * find intersection point of two polylines at their start/end segments with specified conditions
 *
 * @param {FitPathPoint} p0 the start point of the first polyline
 * @param {FitPathPoint} p1 the mid/end point of the first polyline
 * @param {FitPathPoint} p2 the mid/start point of the second polyline
 * @param {FitPathPoint} p3 the end point of the second polyline
 * @param {boolean} onSeg01 if ture the intersection must be on segment p0 p1, else use params.ratioInterMin/Max
 * @param {boolean} onSeg23 if ture the intersection must be on segment p2 p3, else use params.ratioInterMin/Max.
 * @return {FitPathPoint} the intersection point, or null if no intersection
 */
function intersection( p0, p1, p2, p3, onSeg01, onSeg23 ) {
    var v1x = p0.x - p1.x;
    var v1y = p0.y - p1.y;
    var v2x = p3.x - p2.x;
    var v2y = p3.y - p2.y;
    var v3x = p2.x - p1.x;
    var v3y = p2.y - p1.y;

    var det12 = v1x * v2y - v1y * v2x;
    var det32 = v3x * v2y - v3y * v2x;
    var det31 = v3x * v1y - v3y * v1x;

    if( Math.abs( det12 ) > params.eps ) {
        var s = det32 / det12;
        var t = det31 / det12;
        var sMin = onSeg01 ? 0 : params.ratioInterMin;
        var sMax = onSeg01 ? 1 : params.ratioInterMax;
        var tMin = onSeg23 ? 0 : params.ratioInterMin;
        var tMax = onSeg23 ? 1 : params.ratioInterMax;

        if( sMin <= s && s <= sMax && tMin <= t && t <= tMax ) {
            var x = s * p0.x + ( 1 - s ) * p1.x;
            var y = s * p0.y + ( 1 - s ) * p1.y;
            return { x: x, y: y };
        }
    }

    return null;
}

/**
 * find if two polylines' start/end segments are colinear within tolerance
 *
 * @param {FitPathPoint} p0 the start point of the first polyline
 * @param {FitPathPoint} p1 the mid/end point of the first polyline
 * @param {FitPathPoint} p2 the mid/start point of the second polyline
 * @param {FitPathPoint} p3 the end point of the second polyline
 * @return {boolean} true if colinear
 */
function colinear( p0, p1, p2, p3 ) {
    var v1x = p0.x - p1.x;
    var v1y = p0.y - p1.y;
    var v2x = p3.x - p2.x;
    var v2y = p3.y - p2.y;
    var v3x = p2.x - p1.x;
    var v3y = p2.y - p1.y;

    var det31 = v3x * v1y - v3y * v1x;
    var det32 = v3x * v2y - v3y * v2x;
    var dot33 = v3x * v3x + v3y * v3y;
    var len3 = Math.sqrt( dot33 );
    var tol = Math.max( params.lenVertex, len3 * params.ratioSegTol );

    if( len3 > tol && Math.abs( det31 / len3 ) < tol && Math.abs( det32 / len3 ) < tol ) {
        var s = ( v1x * v3x + v1y * v3y ) / dot33;
        var t = -( v2x * v3x + v2y * v3y ) / dot33;
        return params.ratioColiMin <= s && s <= params.ratioColiMax &&
            params.ratioInterMin <= t && t <= params.ratioColiMax;
    }

    return false;
}

/**
 * Snap the angle into x y coordinate axes if within tolerance
 *
 * @param {number} angle the input angle
 * @return {number} the output angle
 */
function snapAngle( angle ) {
    var ang = angle > angleRight ? angle - Math.PI : angle < -angleRight ? angle + Math.PI : angle;
    var absAngle = Math.abs( ang );
    return absAngle < params.angleSnap ? 0 : angleRight - absAngle < params.angleSnap ? angleRight : ang;
}

/**
 * Is the input result an open polyline or curve?
 *
 * @param {FitPathResult} res the input result
 * @return {boolean} true if it is an open polyline
 */
function isOpenPolylineOrCurve( res ) {
    return ( res.shape === 'polyline' || res.shape === 'curve' ) &&
        !( res.startArrow && res.endArrow ) && res.vertices.length > 1;
}

/**
 * Is the input result an arrowhead?
 *
 * @param {FitPathResult} res the input result
 * @return {boolean} true if it is an arrowhead
 */
function isArrowhead( res ) {
    if( res.shape === 'polyline' && !res.startArrow && !res.endArrow && res.vertices.length === 3 ) {
        var v1x = res.vertices[0].x - res.vertices[1].x;
        var v1y = res.vertices[0].y - res.vertices[1].y;
        var v2x = res.vertices[2].x - res.vertices[1].x;
        var v2y = res.vertices[2].y - res.vertices[1].y;
        var len1 = Math.sqrt( v1x * v1x + v1y * v1y );
        var len2 = Math.sqrt( v2x * v2x + v2y * v2y );

        if( params.lenVertex <= len1 && len1 <= params.lenArrow &&
            params.lenVertex <= len2 && len2 <= params.lenArrow ) {
            var dot = v1x * v2x + v1y * v2y;
            var cross = v1x * v2y - v1y * v2x;
            var angle = Math.atan2( cross, dot );
            return Math.abs( angle ) <= 2 * params.angleArrow;
        }
    }

    return false;
}

/**
 * Is the input arrowhead on the input line segment
 *
 * @param {FitPathResult} arrowhead the input arrowhead
 * @param {FitPathPoint} start the start point of the line segment
 * @param {FitPathPoint} other the other point of the line segment
 * @return {boolean} true if the arrowhead is on the line segment within tolerance
 */
function isArrowheadOnSegment( arrowhead, start, other ) {
    var p = intersection( start, other, arrowhead.vertices[0], arrowhead.vertices[2], false, true );

    if( p ) {
        var dx = start.x - p.x;
        var dy = start.y - p.y;
        if( Math.sqrt( dx * dx + dy * dy ) <= params.lenArrow ) {
            var v1x = start.x - other.x;
            var v1y = start.y - other.y;
            var v2x = arrowhead.vertices[1].x - p.x;
            var v2y = arrowhead.vertices[1].y - p.y;
            return v1x * v2x + v1y * v2y > 0;
        }
    }

    return false;
}

/**
 * Merge two polylines, curves, or mixed
 *
 * @param {FitPathResult} res1 the first input result
 * @param {FitPathResult} res2 the second input result
 * @return {FitPathResult} the merged result
 */
function mergePolylinesOrCurves( res1, res2 ) {
    if( isOpenPolylineOrCurve( res1 ) && isOpenPolylineOrCurve( res2 ) ) {
        var isArrowhead1 = isArrowhead( res1 );
        var isArrowhead2 = isArrowhead( res2 );

        if( isArrowhead1 && !isArrowhead2 ) {
            return mergeArrow( res1, res2 );
        } else if( isArrowhead2 && !isArrowhead1 ) {
            return mergeArrow( res2, res1 );
        } else if( res1.shape === 'curve' || res2.shape === 'curve' ) {
            return mergeOpenCurves( res1, res2 );
        }
        return mergeOpenPolylines( res1, res2 );
    }

    return null;
}

/**
 * Merge an arrowhead with an open polyline or curve
 *
 * @param {FitPathResult} arrowhead the input arrowhead
 * @param {FitPathResult} openPolyline the input polyline
 * @return {FitPathResult} the merged result, or null if cannot merge
 */
function mergeArrow( arrowhead, openPolyline ) {
    var vtx = openPolyline.vertices;
    var n = vtx.length - 1;
    var startArrow = !openPolyline.startArrow && isArrowheadOnSegment( arrowhead, vtx[0], vtx[1] );
    var endArrow = !startArrow && !openPolyline.endArrow && isArrowheadOnSegment( arrowhead, vtx[n], vtx[n - 1] );

    if( startArrow || endArrow ) {
        var merged = {};
        merged.shape = openPolyline.shape;
        merged.vertices = openPolyline.vertices;
        merged.startArrow = startArrow || openPolyline.startArrow;
        merged.endArrow = endArrow || openPolyline.endArrow;
        return merged;
    }

    return null;
}

/**
 * Add all the points from the array to the list
 *
 * @param [FitPathPoint] list the list of points
 * @param [FitPathPoint] array the array of points
 * @param {boolean} skipFirst skip the first point in the array
 * @param {boolean} skipLast skip the last point in the array
 * @param {boolean} reverse add the array (after skip points) in reverse order
 */
function addVertices( list, array, skipFirst, skipLast, reverse ) {
    var index = list.length;
    var start = skipFirst ? 1 : 0;
    var end = array.length - ( skipLast ? 1 : 0 );

    for( var i = start; i < end; i++ ) {
        if( reverse ) {
            list.splice( index, 0, cloneVertex( array[i] ) );
        } else {
            list.push( cloneVertex( array[i] ) );
        }
    }
}

/**
 * Clone a vertex
 *
 * @param {FitPathPoint} vertex the input vertex
 * @return {FitPathPoint} the cloned vertex
 */
function cloneVertex( vertex ) {
    return { x: vertex.x, y: vertex.y, c: vertex.c };
}

/**
 * Merge two open polylines
 *
 * @param {FitPathResult} res1 the first open polyline
 * @param {FitPathResult} res2 the second open polyline
 * @return {FitPathResult} the merged result or null if cannot merge
 */
function mergeOpenPolylines( res1, res2 ) {
    return mergeStartToStart( res1, res2 ) || mergeEndToEnd( res1, res2 ) ||
        mergeStartToEnd( res1, res2 ) || mergeEndToStart( res1, res2 );
}

/**
 * Analyze arc length: ds
 */
function analyzeArcLength() {
    for( var i = 0; i < pt.length; i++ ) {
        cv[i] = {};

        if( i === 0 ) {
            cv[i].ds = 0;
            sumDs = 0;
        } else {
            var dx = pt[i].x - pt[i - 1].x;
            var dy = pt[i].y - pt[i - 1].y;
            var ds = Math.sqrt( dx * dx + dy * dy );
            cv[i].ds = ds;
            sumDs += ds;
        }
    }
}

/**
 * Analyze curvature at a point: dt
 */
function analyzeCurvature() {
    for( var i = 0; i < pt.length - 1; i++ ) {
        if( i === 0 ) {
            cv[i].dt = 0;
            sumDt = 0;
        } else {
            var ds0 = cv[i].ds;
            var dx0 = ( pt[i].x - pt[i - 1].x ) / ds0;
            var dy0 = ( pt[i].y - pt[i - 1].y ) / ds0;

            var ds1 = cv[i + 1].ds;
            var dx1 = ( pt[i + 1].x - pt[i].x ) / ds1;
            var dy1 = ( pt[i + 1].y - pt[i].y ) / ds1;

            var dot = dx0 * dx1 + dy0 * dy1;
            var cross = dx0 * dy1 - dx1 * dy0;

            var dt = -Math.atan2( cross, dot );
            cv[i].dt = dt;
            sumDt += dt;
        }
    }
}

/**
 * Analyze curvature on a small arc: adt
 */
function analyzeCurvatureOnArc() {
    for( var i = 1; i < pt.length - 1; i++ ) {
        cv[i].adt = cv[i].dt;
        var arcLength = cv[i].ds;
        for( var j = i - 1; j > 0 && arcLength < params.lenVertex; j-- ) {
            cv[i].adt += cv[j].dt;
            arcLength += cv[j].ds;
        }

        arcLength = cv[i + 1].ds;
        for( var k = i + 1; k < pt.length - 1 && arcLength < params.lenVertex; k++ ) {
            cv[i].adt += cv[k].dt;
            arcLength += cv[k].ds;
        }
    }
}

/**
 * Create indices for polyline
 */
function createIndices() {
    indices = [];
    for( var i = 0; i < pt.length; i++ ) {
        if( i === 0 ) {
            indices.push( i );
        } else if( i === pt.length - 1 || Math.abs( cv[i].adt ) > params.angleVertex ) {
            var len = 0;
            for( var j = i; j > indices[indices.length - 1]; j-- ) {
                len += cv[j].ds;
                if( len >= params.lenVertex * 2 ) {
                    break;
                }
            }

            if( len < params.lenVertex * 2 ) {
                continue;
            }

            indices.push( i );
        }
    }
}

/**
 * Verify if the polyline indices are valid
 *
 * @return {boolean} true if valie
 */
function verifyIndices() {
    // verify if the polyline is OK
    if( indices.length < 2 ) {
        return false;
    }

    var lenTol = Math.max( params.lenVertex, sumDs * params.ratioLenTol );
    var ok = true;

    for( var i = 1; i < indices.length && ok; i++ ) {
        var i1 = indices[i - 1];
        var i2 = indices[i];
        var x1 = pt[i1].x;
        var x2 = pt[i2].x;
        var y1 = pt[i1].y;
        var y2 = pt[i2].y;
        var dx = x2 - x1;
        var dy = y2 - y1;
        var len = Math.sqrt( dx * dx + dy * dy );
        var segTol = Math.max( lenTol, len * params.ratioSegTol );

        for( var j = i1 + 1; j < i2 && ok; j++ ) {
            var x0 = pt[j].x;
            var y0 = pt[j].y;
            var d = Math.abs( dy * x0 - dx * y0 - x1 * y2 + x2 * y1 ) / len;
            ok = d < segTol;
        }
    }

    return ok;
}

/**
 * Detect if there is an arrow formed by three vertices
 *
 * @param [FitPathPoint] vertices the vertices to be tested
 * @param {number} v0 the vertex 0 index
 * @param {number} v1 the vertex 1 index
 * @param {number} v2 the vertex 2 index
 * @return {boolean} true if it forms an arrow
 */
function detectArrow( vertices, v0, v1, v2 ) {
    var dx0 = vertices[v0].x - vertices[v1].x;
    var dy0 = vertices[v0].y - vertices[v1].y;
    var ds0 = Math.sqrt( dx0 * dx0 + dy0 * dy0 );

    var dx1 = vertices[v2].x - vertices[v1].x;
    var dy1 = vertices[v2].y - vertices[v1].y;
    var ds1 = Math.sqrt( dx1 * dx1 + dy1 * dy1 );

    if( params.lenVertex <= ds0 && ds0 <= params.lenArrow && ds0 < ds1 / 2 ) {
        var dot = ( dx0 * dx1 + dy0 * dy1 ) / ( ds0 * ds1 );
        var angle = Math.acos( dot );
        return angle <= params.angleArrow;
    }

    return false;
}

/**
 * Snap the line segments if parallel to x or y axes
 *
 * @param [FitPathPoint] vertices the input vertices
 */
function snapLineSegments( vertices ) {
    for( var i = 1; i < vertices.length; i++ ) {
        var dx = Math.abs( vertices[i].x - vertices[i - 1].x );
        var dy = Math.abs( vertices[i].y - vertices[i - 1].y );
        var len = Math.sqrt( dx * dx + dy * dy );
        var segTol = Math.max( params.lenVertex, len * params.ratioSegTol );

        if( dx < segTol && dx < dy * params.ratioSnap ) {
            vertices[i].x = vertices[i - 1].x;
        } else if( dy < segTol && dy < dx * params.ratioSnap ) {
            vertices[i].y = vertices[i - 1].y;
        }
    }
}

/**
 * Find the center of the input rectangle
 *
 * @param [FitPathPoint] vertices the input vertices of a rectangle
 * @return {FitPathPoint} the center of the rectangle
 */
function findRectangleCenter( vertices ) {
    var xCenter = 0;
    var yCenter = 0;
    var area = 0;

    for( var i = 0; i < 4; i++ ) {
        var det = vertices[i].x * vertices[i + 1].y - vertices[i + 1].x * vertices[i].y;
        area += det;
        xCenter += ( vertices[i].x + vertices[i + 1].x ) * det;
        yCenter += ( vertices[i].y + vertices[i + 1].y ) * det;
    }

    area /= 2.0;
    xCenter /= 6.0 * area;
    yCenter /= 6.0 * area;

    return { x: xCenter, y: yCenter };
}

/**
 * Find the edges and diagonals of the input quadrilateral
 *
 * @param [FitPathPoint] vertices the vertices of the quadrilateral
 * @param [number] xV the x coordinates of edges 0-3 and diagonals 4-5
 * @param [number] yV the y coordinates of edges 0-3 and diagonals 4-5
 * @param [number] rV the lengths of edges 0-3 and diagonals 4-5
 */
function findEdgesAndDiagonals( vertices, xV, yV, rV ) {
    for( var i = 0; i < 6; i++ ) {
        if( i < 4 ) {
            xV[i] = vertices[i + 1].x - vertices[i].x;
            yV[i] = vertices[i + 1].y - vertices[i].y;
        } else {
            xV[i] = vertices[i - 2].x - vertices[i - 4].x;
            yV[i] = vertices[i - 2].y - vertices[i - 4].y;
        }
        rV[i] = Math.sqrt( xV[i] * xV[i] + yV[i] * yV[i] );
    }
}

/**
 * Find the ellipse center and min/max for major/minor axes
 *
 * @param [number] min the array contains xMin, yMin, rMin
 * @param [number] max the array contains xMax, yMax, rMax
 * @return {FitPathPoint} the center of the ellipse
 */
function findCenterMinMax( min, max ) {
    // find the center
    var xSum = 0.0;
    var ySum = 0.0;
    for( var i = 1; i < pt.length; i++ ) {
        xSum += 0.5 * ( pt[i - 1].x + pt[i].x ) * cv[i].ds;
        ySum += 0.5 * ( pt[i - 1].y + pt[i].y ) * cv[i].ds;
    }

    // find major and minor axis
    var xCenter = xSum / sumDs;
    var yCenter = ySum / sumDs;
    var xMin = 0;
    var yMin = 0;
    var xMax = 0;
    var yMax = 0;
    var rMax = 0;
    var rMin = Number.MAX_VALUE;

    for( var j = 0; j < pt.length; j++ ) {
        var dx = pt[j].x - xCenter;
        var dy = pt[j].y - yCenter;
        var r = dx * dx + dy * dy;

        if( r < rMin ) {
            xMin = dx;
            yMin = dy;
            rMin = r;
        }

        if( r > rMax ) {
            xMax = dx;
            yMax = dy;
            rMax = r;
        }
    }

    min[0] = xMin;
    min[1] = yMin;
    min[2] = Math.sqrt( rMin );
    max[0] = xMax;
    max[1] = yMax;
    max[2] = Math.sqrt( rMax );

    return { x: xCenter, y: yCenter };
}

/**
 * Stabilize the angle of the major axis of an ellipse
 *
 * @param {FitPathPoint} center the center of the ellipse
 * @param [number] min the array contains xMin, yMin, rMin
 * @param [number] max the array contains xMax, yMax, rMax
 * @return {number} the stabilized angle
 */
function stabilizeAngle( center, min, max ) {
    var rMid2 = ( min[2] * min[2] + max[2] * max[2] ) / 2;
    var vXsum = 0.0;
    var vYsum = 0.0;

    for( var i = 1; i < pt.length; i++ ) {
        var vX = 0.5 * ( pt[i - 1].x + pt[i].x ) - center.x;
        var vY = 0.5 * ( pt[i - 1].y + pt[i].y ) - center.y;
        var r2 = vX * vX + vY * vY;

        if( r2 > rMid2 ) {
            var r = Math.sqrt( r2 );
            vX = vX * cv[i].ds / r;
            vY = vY * cv[i].ds / r;
        } else {
            vX = pt[i].x - pt[i - 1].x;
            vY = pt[i].y - pt[i - 1].y;
        }

        var dot = vX * max[0] + vY * max[1];
        vXsum += dot > 0 ? vX : -vX;
        vYsum += dot > 0 ? vY : -vY;
    }

    var vRsum = Math.sqrt( vXsum * vXsum + vYsum * vYsum );
    var sinA = vYsum / vRsum;
    var cosA = vXsum / vRsum;
    return Math.atan2( sinA, cosA );
}

/**
 * Verify if the ellipse is valid
 *
 * @param {FitPathPoint} center the center of the ellipse
 * @param [number] min the array contains xMin, yMin, rMin
 * @param [number] max the array contains xMax, yMax, rMax
 * @param {number} angle the angle of the major axis
 * @return {boolean} true if valid
 */
function verifyEllipse( center, min, max, angle ) {
    var err = Math.max( params.lenVertex, sumDs * params.ratioLenTol );
    var sinA = Math.sin( angle );
    var cosA = Math.cos( angle );

    var amax2 = max[2] + err;
    var amin2 = max[2] - err;
    var bmax2 = min[2] + err;
    var bmin2 = min[2] - err;

    amax2 *= amax2;
    amin2 *= amin2;
    bmax2 *= bmax2;
    bmin2 *= bmin2;
    var ok = true;
    for( var i = 0; i < pt.length && ok; i++ ) {
        var dx = pt[i].x - center.x;
        var dy = pt[i].y - center.y;
        var x = dx * cosA + dy * sinA;
        var y = dy * cosA - dx * sinA;
        var f = x * x / amax2 + y * y / bmax2;
        var g = x * x / amin2 + y * y / bmin2;
        ok = f < 1 && g > 1;
    }

    return ok;
}

/**
 * Merge two polylines start to start
 *
 * @param {FitPathResult} res1 the first polyline
 * @param {FitPathResult} res2 the second polyline
 * @return {FitPathResult} the merged result or null if cannot be merged
 */
function mergeStartToStart( res1, res2 ) {
    var vtx1 = res1.vertices;
    var vtx2 = res2.vertices;
    var list = [];

    if( !res1.startArrow && !res2.startArrow ) {
        var p = intersection( vtx1[0], vtx1[1], vtx2[1], vtx2[0] );
        if( p || colinear( vtx1[0], vtx1[1], vtx2[1], vtx2[0] ) ) {
            addVertices( list, vtx1, true, false, true );
            if( p ) {
                list.push( p );
            }
            addVertices( list, vtx2, true, false, false );
            var startArrow = res1.endArrow;
            var endArrow = res2.endArrow;

            return createMergeResult( list, startArrow, endArrow );
        }
    }

    return null;
}

/**
 * Merge two polylines end to end
 *
 * @param {FitPathResult} res1 the first polyline
 * @param {FitPathResult} res2 the second polyline
 * @return {FitPathResult} the merged result or null if cannot be merged
 */
function mergeEndToEnd( res1, res2 ) {
    var vtx1 = res1.vertices;
    var vtx2 = res2.vertices;
    var n1 = vtx1.length - 1;
    var n2 = vtx2.length - 1;
    var list = [];

    if( !res1.endArrow && !res2.endArrow ) {
        var p = intersection( vtx1[n1], vtx1[n1 - 1], vtx2[n2 - 1], vtx2[n2] );
        if( p || colinear( vtx1[n1], vtx1[n1 - 1], vtx2[n2 - 1], vtx2[n2] ) ) {
            addVertices( list, vtx1, false, true, false );
            if( p ) {
                list.push( p );
            }
            addVertices( list, vtx2, false, true, true );
            var startArrow = res1.startArrow;
            var endArrow = res2.startArrow;

            return createMergeResult( list, startArrow, endArrow );
        }
    }
    return null;
}

/**
 * Merge two polylines start to end
 *
 * @param {FitPathResult} res1 the first polyline
 * @param {FitPathResult} res2 the second polyline
 * @return {FitPathResult} the merged result or null if cannot be merged
 */
function mergeStartToEnd( res1, res2 ) {
    var vtx1 = res1.vertices;
    var vtx2 = res2.vertices;
    var n2 = vtx2.length - 1;
    var list = [];

    if( !res1.startArrow && !res2.endArrow ) {
        var p = intersection( vtx1[0], vtx1[1], vtx2[n2 - 1], vtx2[n2] );
        if( p || colinear( vtx1[0], vtx1[1], vtx2[n2 - 1], vtx2[n2] ) ) {
            addVertices( list, vtx1, true, false, true );
            if( p ) {
                list.push( p );
            }
            addVertices( list, vtx2, false, true, true );
            var startArrow = res1.endArrow;
            var endArrow = res2.startArrow;

            return createMergeResult( list, startArrow, endArrow );
        }
    }
    return null;
}

/**
 * Merge two polylines end to start
 *
 * @param {FitPathResult} res1 the first polyline
 * @param {FitPathResult} res2 the second polyline
 * @return {FitPathResult} the merged result or null if cannot be merged
 */
function mergeEndToStart( res1, res2 ) {
    var vtx1 = res1.vertices;
    var vtx2 = res2.vertices;
    var n1 = vtx1.length - 1;
    var list = [];

    if( !res1.endArrow && !res2.startArrow ) {
        var p = intersection( vtx1[n1], vtx1[n1 - 1], vtx2[1], vtx2[0] );
        if( p || colinear( vtx1[n1], vtx1[n1 - 1], vtx2[1], vtx2[0] ) ) {
            addVertices( list, vtx1, false, true, false );
            if( p ) {
                list.push( p );
            }
            addVertices( list, vtx2, true, false, false );
            var startArrow = res1.startArrow;
            var endArrow = res2.endArrow;

            return createMergeResult( list, startArrow, endArrow );
        }
    }
    return null;
}


/**
 * Create a new result of merged polylines
 *
 * @param [FitPathPoint] list the list of vertices
 * @param {boolean} startArrow the start is an arrow
 * @param {boolean} endArrow the end is an arrow
 * @return {FitPathResult} the result of merged polylines
 */
function createMergeResult( list, startArrow, endArrow ) {
    var isCurve = hasControl( list );
    var res = {};

    res.shape = isCurve ? 'curve' : 'polyline';
    res.vertices = list;
    res.startArrow = startArrow;
    res.endArrow = endArrow;

    if( isCurve ) {
        fitClosedCuve( res );
    } else if( fitPolygon( res ) ) {
        fitRectangle( res );
    }

    return res;
}

/**
 * Merge two open curves into one
 *
 * @param {FitPathResult} res1 - the first curve
 * @param {FitPathResult} res2 - the second curve
 *
 * @returns {boolean} true if merged
 */
function mergeOpenCurves( res1, res2 ) {
    var n1 = res1.vertices.length - 1;
    var n2 = res2.vertices.length - 1;
    var list = [];

    if( getDistance( res1.vertices[0], res2.vertices[0] ) < params.closedCurveTol ) {
        list = list.concat( res1.vertices ).reverse().concat( res2.vertices );
        return createMergeResult( list, res1.endArrow, res2.endArrow );
    } else if( getDistance( res1.vertices[n1], res2.vertices[n2] ) < params.closedCurveTol ) {
        list = res1.vertices.concat( list.concat( res2.vertices ).reverse() );
        return createMergeResult( list, res1.startArrow, res2.startArrow );
    } else if( getDistance( res1.vertices[n1], res2.vertices[0] ) < params.closedCurveTol ) {
        list = res1.vertices.concat( res2.vertices );
        return createMergeResult( list, res1.startArrow, res2.endArrow );
    } else if( getDistance( res1.vertices[0], res2.vertices[n2] ) < params.closedCurveTol ) {
        list = res2.vertices.concat( res1.vertices );
        return createMergeResult( list, res2.startArrow, res1.endArrow );
    }

    return null;
}

/**
 * Fit a cubic Bezier curve
 *
 * @param {FitPathResult} result - the input and output result
 * @param {Number} error - the error allowed
 * @param {Number} first - the first point index
 * @param {Number} last - the last point index
 * @param {Point} tan1 - the first tangent
 * @param {Point} tan2 - the last tangent
 */
function fitCubic( result, error, first, last, tan1, tan2 ) {
    var points = pt;
    if( last - first === 1 ) {
        result.vertices.push( setControl( points[last] ) );
        return;
    }

    var uPrime = chordLengthParameterize( first, last );
    var maxError = Math.max( error, error * error );
    var split;
    var parametersInOrder = true;

    for( var i = 0; i <= 4; i++ ) {
        var curve = generateBezier( first, last, uPrime, tan1, tan2 );
        var max = findMaxError( first, last, curve, uPrime );
        if( max.error < error && parametersInOrder ) {
            result.vertices.push( setControl( curve[1], true ) );
            result.vertices.push( setControl( curve[2], true ) );
            result.vertices.push( setControl( curve[3] ) );
            return;
        }

        split = max.index;
        if( max.error >= maxError ) {
            break;
        }

        parametersInOrder = reparameterize( first, last, uPrime, curve );
        maxError = max.error;
    }
    var tanCenter = subtract( points[split - 1], points[split + 1] );
    fitCubic( result, error, first, split, tan1, tanCenter );
    fitCubic( result, error, split, last, multiply( tanCenter, -1 ), tan2 );
}

/**
 * Generate a cubic Bezier curve
 *
 * @param {Number} first - the first point index
 * @param {Number} last - the last point index
 * @param {Number[]} uPrime - the prime parameter u
 * @param {Point} tan1 - the first tangent
 * @param {Point} tan2 - the last tangent
 *
 * @returns {Point[]} the Bezier curve points: [ end, control, control, end ]
 */
function generateBezier( first, last, uPrime, tan1, tan2 ) {
    var epsilon = 1e-12;
    var points = pt;
    var pt1 = points[first];
    var pt2 = points[last];
    var C = [ [ 0, 0 ], [ 0, 0 ] ];
    var X = [ 0, 0 ];

    for( var i = 0, l = last - first + 1; i < l; i++ ) {
        var u = uPrime[i];
        var t = 1 - u;
        var b = 3 * u * t;
        var b0 = t * t * t;
        var b1 = b * t;
        var b2 = b * u;
        var b3 = u * u * u;
        var a1 = normalize( tan1, b1 );
        var a2 = normalize( tan2, b2 );
        var tmp = subtract( points[first + i], multiply( pt1, b0 + b1 ) );

        tmp = subtract( tmp, multiply( pt2, b2 + b3 ) );
        C[0][0] += dot( a1, a1 );
        C[0][1] += dot( a1, a2 );
        C[1][0] = C[0][1];
        C[1][1] += dot( a2, a2 );
        X[0] += dot( a1, tmp );
        X[1] += dot( a2, tmp );
    }

    var detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1];
    var alpha1;
    var alpha2;
    if( Math.abs( detC0C1 ) > epsilon ) {
        var detC0X = C[0][0] * X[1] - C[1][0] * X[0];
        var detXC1 = X[0] * C[1][1] - X[1] * C[0][1];
        alpha1 = detXC1 / detC0C1;
        alpha2 = detC0X / detC0C1;
    } else {
        var c0 = C[0][0] + C[0][1];
        var c1 = C[1][0] + C[1][1];
        alpha1 = alpha2 = Math.abs( c0 ) > epsilon ? X[0] / c0 :
            Math.abs( c1 ) > epsilon ? X[1] / c1 : 0;
    }

    var segLength = getDistance( pt2, pt1 );
    var eps = epsilon * segLength;
    var handle1;
    var handle2;
    if( alpha1 < eps || alpha2 < eps ) {
        alpha1 = alpha2 = segLength / 3;
    } else {
        var line = subtract( pt2, pt1 );
        handle1 = normalize( tan1, alpha1 );
        handle2 = normalize( tan2, alpha2 );
        if( dot( handle1, line ) - dot( handle2, line ) > segLength * segLength ) {
            alpha1 = alpha2 = segLength / 3;
            handle1 = handle2 = null;
        }
    }

    return [ pt1,
        addPoints( pt1, handle1 || normalize( tan1, alpha1 ) ),
        addPoints( pt2, handle2 || normalize( tan2, alpha2 ) ),
        pt2 ];
}

/**
 * Parameterize according to chord length, i.e. approximation of the curve length
 *
 * @param {Number} first - the first point index
 * @param {Number} last - the last point index
 *
 * @returns {Number[]} the prime parameter u in the range of [0, 1]
 */
function chordLengthParameterize( first, last ) {
    var u = [ 0 ];
    for( var i = first + 1; i <= last; i++ ) {
        u[i - first] = u[i - first - 1] + getDistance( pt[i], pt[i - 1] );
    }
    for( var i = 1, m = last - first; i <= m; i++ ) {
        u[i] /= u[m];
    }
    return u;
}

/**
 * Reparameterize so that curve at u is the closest to the corresponding point
 *
 * @param {Number} first - the first point index
 * @param {Number} last - the last point index
 * @param {Number[]} u - the input and output parameters
 * @param {Point[]} curve - the curve
 *
 * @returns {boolean} true if parameters are in order
 */
function reparameterize( first, last, u, curve ) {
    for( var i = first; i <= last; i++ ) {
        u[i - first] = findRoot( curve, pt[i], u[i - first] );
    }
    for( var i = 1, l = u.length; i < l; i++ ) {
        if( u[i] <= u[i - 1] ) {
            return false;
        }
    }
    return true;
}

/**
 * Find the param u so that curve at u is the closest to the point
 *
 * @param {Point[]} curve - the curve
 * @param {Point} point - the point
 * @param {Number} u - the input parameter
 *
 * @returns {Number} the output parameter
 */
function findRoot( curve, point, u ) {
    var curve1 = [];
    var curve2 = [];
    for( var i = 0; i <= 2; i++ ) {
        curve1[i] = multiply( subtract( curve[i + 1], curve[i] ), 3 );
    }
    for( var i = 0; i <= 1; i++ ) {
        curve2[i] = multiply( subtract( curve1[i + 1], curve1[i] ), 2 );
    }

    var p = evaluate( 3, curve, u );
    var pt1 = evaluate( 2, curve1, u );
    var pt2 = evaluate( 1, curve2, u );
    var diff = subtract( p, point );
    var df = dot( pt1, pt1 ) + dot( diff, pt2 );
    return isMachineZero( df ) ? u : u - dot( diff, pt1 ) / df;
}

/**
 * Test if a value is machine zero
 *
 * @param {Number} val - the input value
 *
 * @returns {Boolean} true if it is the machine zero
 */
function isMachineZero( val ) {
    return val >= -1.12e-16 && val <= 1.12e-16;
}

/**
 * Evaluate the curve at a given parameter
 *
 * @param {Number} degree - the curve degree, can be 1, 2, or 3
 * @param {Point[]} curve - the curve, can be 2, 3, or 4 points
 * @param {Number} t - the parameter
 *
 * @returns {Point} the point of the curve at parameter t
 */
function evaluate( degree, curve, t ) {
    var tmp = curve.slice();
    for( var i = 1; i <= degree; i++ ) {
        for( var j = 0; j <= degree - i; j++ ) {
            tmp[j] = addPoints( multiply( tmp[j], 1 - t ), multiply( tmp[j + 1], t ) );
        }
    }
    return tmp[0];
}

/**
 * Find the maximum error from pt[i] to the curve at u[i]
 *
 * @param {Number} first - the first point index
 * @param {Number} last - the last point index
 * @param {Point[]} curve - the curve
 * @param {Number[]} u - the curve parameters
 */
function findMaxError( first, last, curve, u ) {
    var index = Math.floor( ( last - first + 1 ) / 2 );
    var maxDist = 0;
    for( var i = first + 1; i < last; i++ ) {
        var P = evaluate( 3, curve, u[i - first] );
        var v = subtract( P, pt[i] );
        var dist = v.x * v.x + v.y * v.y;
        if( dist >= maxDist ) {
            maxDist = dist;
            index = i;
        }
    }
    return {
        error: maxDist,
        index: index
    };
}

/**
 * Subtract two points
 *
 * @param {Point} p1 - the first point
 * @param {Point} p2 - the second point
 *
 * @returns {Point} the result point
 */
function subtract( p1, p2 ) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
}

/**
 * Add two points
 *
 * @param {Point} p1 - the first point
 * @param {Point} p2 - the second point
 *
 * @returns {Point} the result point
 */
function addPoints( p1, p2 ) {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
}

/**
 * Multiply a point/vector by a scalar
 *
 * @param {Point} p - the point
 * @param {Number} num - the scalar
 *
 * @returns {Point} the result point
 */
function multiply( p, num ) {
    return { x: p.x * num, y: p.y * num };
}

/**
 * Dot product of two vectors
 *
 * @param {Point} v1 - the first vector
 * @param {Point} v2 - the second vector
 *
 * @returns {Number} - the result
 */
function dot( v1, v2 ) {
    return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Set Control point
 *
 * @param {Point} p - the point
 * @param {Boolean} isControl - true for control point, false for end point
 *
 * @return {Point} the result point
 */
function setControl( p, isControl ) {
    return isControl ? { x: p.x, y: p.y, c: true } : { x: p.x, y: p.y };
}

/**
 * Test if a list of points has any control point
 *
 * @param {Point[]} list - a list of points to be tested
 *
 * @returns {Boolean} true if contain at least one control point
 */
function hasControl( list ) {
    for( var i = 0; i < list.length; i++ ) {
        if( list[i].c ) {
            return true;
        }
    }

    return false;
}

/**
 * Get the distance between two points
 *
 * @param {Point} p1 - the first point
 * @param {Point} p2 - the second point
 *
 * @return {Number} the distance
 */
function getDistance( p1, p2 ) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    return Math.sqrt( dx * dx + dy * dy );
}

/**
 * Normalize the vector, the optionally scale it
 *
 * @param {Point} v - the vector
 * @param {Number} length - the optinal length, default 1
 *
 * @returns {Point} the normalized and scaled vector
 */
function normalize( v, length ) {
    if( length === undefined ) {
        length = 1;
    }

    var current = Math.sqrt( v.x * v.x + v.y * v.y );
    var scale = current > 0 ? length / current : 0;
    return multiply( v, scale );
}

//==================================================
// exported functions
//==================================================
let exports;
export let getPath = function() {
    return pt;
};
export let getCurvature = function() {
    return cv;
};
export let getParams = function() {
    return params;
};
export let getFitResult = function() {
    return fitResult;
};
export let getMergeStack = function() {
    return mergeStack;
};
export let getMergeStackTop = function() {
    return mergeStackTop;
};
export let setMergeStackTop = function( top ) {
    mergeStackTop = top;
};
export let getSumDs = function() {
    return sumDs;
};
export let getSumDt = function() {
    return sumDt;
};
export let getIndices = function() {
    return indices;
};

export default exports = {
    start,
    add,
    fit,
    fitJson,
    setDefaultParams,
    adjustParams,
    getPath,
    getCurvature,
    getParams,
    getFitResult,
    getMergeStack,
    pushToMergeStack,
    clearMergeStack,
    getMergeStackTop,
    setMergeStackTop,
    getSumDs,
    getSumDt,
    getIndices,
    getJsonData,
    merge
};
