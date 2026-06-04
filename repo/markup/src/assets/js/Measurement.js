'use strict';
// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/Measurement
 */

'use strict';
//==================================================
// private variables
//==================================================
var mFontHightCache = [];
// var dbgCtx; // So the context can be used below where it's not passed in as a param

//==================================================
// public functions
//==================================================

/**
 * Draw a measurement entity
 *
 * @param {Context2D} ctx the context
 * @param {Geometry} geom the geom
 * @param {Highlight} highlight object for highlighting
 */
export function draw( ctx, geom, highlight ) {
    // dbgCtx = ctx; // So the context can be used below where it's not passed in as a param
    var textRect = {};
    calculateTextRectangle( ctx, geom, textRect );

    var witnessLine1 = {};
    var witnessLine2 = {};
    var arrowLine1 = {};
    var arrowLine2 = {};
    calculateDistanceMeasurePoints( geom, textRect, witnessLine1, witnessLine2, arrowLine1, arrowLine2 );

    // Draw arrows and lines
    drawArrow( ctx, geom.style.color, textRect.height, arrowLine1, 0, highlight );
    drawArrow( ctx, geom.style.color, textRect.height, arrowLine2, 0, highlight );

    // Draw witness lines
    drawLine( ctx, geom.style.color, witnessLine1, highlight );
    drawLine( ctx, geom.style.color, witnessLine2, highlight );

    // Draw the text distance
    drawMeasurementText( ctx, geom, textRect, highlight );

    // Save rectangle in geometry to be used later for selecting it on click
    geom.rect = textRect;
}

//==================================================
// private functions
//==================================================

/**
 * Calculate the height of a font
 *
 * @param {Font} fontStyle - the font
 * @return {Integer} the height in pixels
 */
function determineFontHeightInPixels( fontStyle ) {
    var result = mFontHightCache[ fontStyle ];

    if( !result ) {
        var fontDraw = document.createElement( 'canvas' );
        var ctx = fontDraw.getContext( '2d' );
        ctx.fillRect( 0, 0, fontDraw.width, fontDraw.height );
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'white';
        ctx.font = fontStyle;
        ctx.fillText( 'gjM', 0, 0 );
        var pixels = ctx.getImageData( 0, 0, fontDraw.width, fontDraw.height ).data;
        var start = -1;
        var end = -1;
        for( var row = 0; row < fontDraw.height; row++ ) {
            for( var column = 0; column < fontDraw.width; column++ ) {
                var index = ( row * fontDraw.width + column ) * 4;
                if( pixels[ index ] === 0 ) {
                    if( column === fontDraw.width - 1 && start !== -1 ) {
                        end = row;
                        row = fontDraw.height;
                        break;
                    }
                    continue;
                } else {
                    if( start === -1 ) {
                        start = row;
                    }
                    break;
                }
            }
        }

        result = end - start;
        mFontHightCache[ fontStyle ] = result;
    }

    return result;
}

/**
 * Calculate distance find its width and height
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom the geom
 * @param {Rectangle} rect with the upper left & lower left points of the text rectangle (returned)
 */
function calculateTextRectangle( ctx, geom, rect ) {
    // pythagoras theorem
    var a = geom.startPt.x - geom.endPt.x;
    var b = geom.startPt.y - geom.endPt.y;
    var c = Math.sqrt( a * a + b * b );

    // adjust based on calibration
    var distance = c * geom.calibration.scale / 96.0; // TODO Should this 96 already be factored into the calibration?

    rect.string = '';
    if( geom.error > 0 ) {
        rect.string += '~';
    }
    rect.string += distance.toFixed( geom.precision ).toString( 10 );

    // Set units abbreviation
    switch ( geom.calibration.units ) {
        case 'millimeters':
            rect.string += 'mm';
            break;
        case 'inches':
            rect.string += '"';
            break;
        case 'feet':
            rect.string += '\'';
            break;
        case 'centimeters':
            rect.string += 'cm';
            break;
        case 'meters':
            rect.string += 'm';
            break;
        case 'yards':
            rect.string += 'yd';
            break;
        default:
            rect.string += ' ';
    }

    ctx.font = geom.style.font;

    // Set the text center, width and height. Add a margin.
    rect.center = { x: geom.textPt.x, y: geom.textPt.y };
    rect.width = ctx.measureText( rect.string ).width;
    rect.height = determineFontHeightInPixels( geom.style.font );
    rect.margin = { x: rect.width * 0.25, y: rect.height * 0.25 };
    rect.width += rect.margin.x;
    rect.height += rect.margin.y;
}

/**
 * Draw highlight
 * @param {Context2D} ctx - the context of the canvas
 * @param {Highlight} highlight -
 */
function drawHighlight( ctx, highlight ) {
    if( highlight.selected ) {
        ctx.save();
        ctx.strokeStyle = highlight.color;
        ctx.lineWidth = highlight.lineWidth;
        ctx.lineCap = 'round';
        ctx.setLineDash( [] );
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Draw a line
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Color} color the line color
 * @param {Line} line the line
 * @param {Highlight} highlight object for highlighting
 */
function drawLine( ctx, color, line, highlight ) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo( line.vertices[ 0 ].x, line.vertices[ 0 ].y );
    ctx.lineTo( line.vertices[ 1 ].x, line.vertices[ 1 ].y );
    ctx.stroke();
    ctx.restore();

    drawHighlight( ctx, highlight );
}

/**
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom the geom
 * @param {Rectangle} rect with the upper left & lower left points of the text rectangle
 * @param {Highlight} highlight object for highlighting
 */
function drawMeasurementText( ctx, geom, rect, highlight ) {
    if( highlight.selected ) {
        ctx.save();
        ctx.fillStyle = highlight.color;
        ctx.strokeStyle = highlight.color;
        ctx.lineWidth = highlight.lineWidth;
        ctx.lineCap = 'round';

        var bbox = {};
        bbox.xmin = geom.textPt.x - rect.width / 2;
        bbox.xmax = geom.textPt.x + rect.width / 2;
        bbox.ymin = geom.textPt.y + rect.height / 2;
        bbox.ymax = geom.textPt.y - rect.height / 2;

        ctx.beginPath();
        ctx.moveTo( bbox.xmin, bbox.ymin );
        ctx.lineTo( bbox.xmax, bbox.ymin );
        ctx.lineTo( bbox.xmax, bbox.ymax );
        ctx.lineTo( bbox.xmin, bbox.ymax );
        ctx.closePath();

        ctx.setLineDash( [] );
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }

    // Set the translation.  Adjust for the y-margin so it's more centered in its bbox.
    // Leave off the x-margin so it is less likely that the units string will overlap an arrow.
    var translation = {
        x: geom.textPt.x - rect.width / 2.0,
        y: geom.textPt.y + rect.height / 2.0 - rect.margin.y * 0.75
    };

    // Draw the text string
    ctx.save();
    ctx.font = geom.style.font;
    ctx.fillStyle = geom.style.color;
    ctx.textBaseline = 1;
    ctx.translate( translation.x, translation.y );
    ctx.fillText( rect.string, 0, 0 );
    ctx.restore();
}

/**
 * Draw line with arrow head
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Color} color the arrow color
 * @param {Integer} size the size of the arrow
 * @param {Line} line the line the arrow is on
 * @param {Integer} whichEnd the vertices that the arrow is drawn on
 * @param {Highlight} highlight object for highlighting
 */
function drawArrow( ctx, color, size, line, whichEnd, highlight ) {
    var v0 = line.vertices[ whichEnd === 0 ? 0 : whichEnd ];
    var v1 = line.vertices[ whichEnd === 0 ? 1 : whichEnd - 1 ];
    var angle = Math.atan2( v1.y - v0.y, v1.x - v0.x );
    var width = size * 0.5;
    var length = size;

    // draw the line
    drawLine( ctx, color, line, highlight );

    // draw the arrow
    ctx.save();
    ctx.translate( v0.x, v0.y );
    ctx.rotate( angle );
    ctx.scale( length, width );
    ctx.beginPath();

    ctx.moveTo( 1, 0.5 );
    ctx.lineTo( 0, 0 );
    ctx.lineTo( 1, -0.5 );

    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    drawHighlight( ctx, highlight );
}

/**
 * Calculate all required parts of a point-to-point measurement
 *
 * @param {Geometry} geom the geom
 * @param {Rectangle} textRect with the upper left & lower left points of the text rectangle
 * @param {Line} witnessLine1 (returned)
 * @param {Line} witnessLine2 (returned)
 * @param {Line} arrowLine1 (returned)
 * @param {Line} arrowLine2 (returned)
 */
function calculateDistanceMeasurePoints( geom, textRect, witnessLine1, witnessLine2, arrowLine1, arrowLine2 ) {
    var DM = new DistanceMeasure( geom.startPt, geom.endPt, textRect );

    witnessLine1.vertices = DM.getWitness1();
    witnessLine2.vertices = DM.getWitness2();
    arrowLine1.vertices = DM.getLeader1();
    arrowLine2.vertices = DM.getLeader2();
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/**
 * Create a point-to-point distance measurement object having the following API:
 *     getWitness1(): returns vertices defining a line starting near one input end point and ending near the input text rectangle.
 *     getWitness2(): returns vertices defining a line starting near the other input end point and ending near the input text rectangle.
 *     getLeader1(): returns vertices defining an arrow with point touching one of the witness lines and ending at the text rectangle.
 *     getLeader2(): returns vertices defining an arrow with point touching the other witness line and ending at the text rectangle.
 * The witness lines are parallel to each other and perpendicular to the line defined by the two input points.
 *
 * @param {Point} startPt the start point of a measurement
 * @param {Point} endPt the end point of a measurement
 * @param {Rectangle} textRect the center, width and height of the measurement text
 */
function DistanceMeasure( startPt, endPt, textRect ) {
    var minLeader = 1.0;
    var minAllowableLeader = 1.0;
    var minWitness = 1.0;
    var minWitnessGap = 1.0;
    var tolerance = 0.0001;

    setWitnessAndLeaderMinimums( textRect.height );

    var perpData = definePerpendicularsThroughSegmentEndPoints( startPt, endPt );

    // Get the y-intercept of the line through center of text
    //     with the same slope as the two parallel lines
    var txtXyInt = 0.0;
    if( perpData.lType === 'SlopeHorizontal' ) {
        txtXyInt = textRect.center.y;
    } else if( perpData.lType === 'SlopeVertical' ) {
        txtXyInt = textRect.center.x;
    } else {
        txtXyInt = textRect.center.y - perpData.lSlope * textRect.center.x;
    }

    // Is the text line left or right of the "left" perpendicular intercept
    //                                              coord-1,   coord-2
    var tv1flag = checkLineOrder( perpData.lType, txtXyInt, perpData.leftXyIntercept );

    // Is the text line left or right of "right" perpendicular intercept
    var tv2flag = checkLineOrder( perpData.lType, txtXyInt, perpData.rightXyIntercept );
    var txtPlacement = tv1flag === '2RightOf1' && tv2flag === '2RightOf1' ? 'right' :
        tv1flag === '2LeftOf1' && tv2flag === '2LeftOf1' ? 'left' : 'center';

    // Create witness and leader lines depending
    // on the text position relative to the two calculated perpendicular lines.
    var witness1 = [];
    var witness2 = [];
    var leader1 = { ldrPts: [ { x: 0.0, y: 0.0 }, { x: 0.0, y: 0.0 } ] };
    var leader2 = { ldrPts: [ { x: 0.0, y: 0.0 }, { x: 0.0, y: 0.0 } ] };

    if( txtPlacement === 'right' ) {
        // Text is right of both lines.
        // Check for legal leader from text box to the "right" line.
        // If not legal, don't draw any leaders.
        computeLeader( 'right', perpData, textRect, leader1 );
        // There was a legal leader to the rightmost line.
        // Make a minimum leader to the leftmost line
        makeMinimumLeader( 'left', perpData, textRect.center, leader2 );
        makeWitness( 'right', perpData, leader1.ldrPts[ 0 ], witness1 );
        makeWitness( 'left', perpData, leader2.ldrPts[ 0 ], witness2 );
    } else if( txtPlacement === 'left' ) {
        // Text is left of both lines.
        // Check for legal leader from text box to the "left" line.
        // If not legal, don't draw any leaders.
        computeLeader( 'left', perpData, textRect, leader1 );
        // There was a legitimate witness line to the leftmost line
        // Make a minimum leader to the rightmost line
        makeMinimumLeader( 'right', perpData, textRect.center, leader2 );
        makeWitness( 'left', perpData, leader1.ldrPts[ 0 ], witness2 );
        makeWitness( 'right', perpData, leader2.ldrPts[ 0 ], witness1 );
    } else { // Text is between the two lines.
        // If both lines have leaders use them, otherwise draw two minimum length external leaders.
        var rFlag = computeLeader( 'right', perpData, textRect, leader1 );
        var lFlag = computeLeader( 'left', perpData, textRect, leader2 );

        if( rFlag && lFlag ) { // Use internal leaders.
            makeWitness( 'right', perpData, leader1.ldrPts[ 0 ], witness1 );
            makeWitness( 'left', perpData, leader2.ldrPts[ 0 ], witness2 );
        } else { // Use external leaders.
            makeMinimumLeader( 'right', perpData, textRect.center, leader1 );
            makeMinimumLeader( 'left', perpData, textRect.center, leader2 );
            makeWitness( 'right', perpData, leader1.ldrPts[ 0 ], witness1 );
            makeWitness( 'left', perpData, leader2.ldrPts[ 0 ], witness2 );
        }
    }

    //==================================================
    // DistanceMeasure API methods.  See the description of DistanceMeasure above.
    //==================================================
    this.getWitness1 = function() { return witness1; };
    this.getWitness2 = function() { return witness2; };
    this.getLeader1 = function() { return leader1.ldrPts; };
    this.getLeader2 = function() { return leader2.ldrPts; };

    //==================================================
    // private DistanceMeasure functions
    //==================================================
    /**
     * Create a line object defined by the given end points.
     *
     * @param {Float} reference the reference value(e.g., text height) upon which the min values are based.
     */
    function setWitnessAndLeaderMinimums( reference ) {
        const minLeaderFactor = 3.0;
        const minAllowableLeaderFactor = 0.5;
        const minWitnessFactor = 0.5;
        const minWitnessGapFactor = 0.5;
        const tolFactor = 0.0001;

        minLeader = reference > 0.0 ? reference : 1.0;
        minAllowableLeader = reference > 0.0 ? reference : 1.0;
        minWitness = reference > 0.0 ? reference : 1.0;
        minWitnessGap = reference > 0.0 ? reference : 1.0;
        tolerance = 0.0001;

        // Minimum leader length
        minLeader = minLeaderFactor * reference;
        minAllowableLeader = minAllowableLeaderFactor * reference;

        // Minimum extension of witness line past leader
        minWitness = minWitnessFactor * reference;

        // Minimum gap between witness line and line
        minWitnessGap = minWitnessGapFactor * reference;

        // Tolerance for equality
        tolerance = tolFactor * reference;
    }

    /**
     * Determine whether lines are left or right of each other based on their given x or y intercepts.
     *
     * @param {String} type1 Slope type of lines
     * @param {Float} xyint1 Line 1 y-intercept if not vertical else x-intercept
     * @param {Float} xyint2 Line 2 y-intercept if not vertical else x-intercept
     * @return {Integer} the height in pixels
     * @return {String} whether line2 is right or left of line1
     */
    function checkLineOrder( type1, xyint1, xyint2 ) {
        if( type1 === 'SlopePositive' || type1 === 'SlopeHorizontal' ) {
            if( xyint1 < xyint2 ) { return '2RightOf1'; }
            return '2LeftOf1';
        }

        if( xyint1 < xyint2 ) { return '2LeftOf1'; }
        return '2RightOf1';
    }

    /**
     * Calculate the angle of a line based on the input delta(change in) x and y of its endpoints.
     *
     * @param {Object} delta line point2.x - point1.x, point2.y - point1.y
     * @return {Float} the angle of the line
     */
    function getAngleFromVector( delta ) {
        var angle = Math.atan2( delta.y, delta.x );
        if( angle < 0.0 ) { angle += 2.0 * Math.PI; }

        // Set angles exactly within tolerance
        if( Math.abs( angle ) < tolerance ) {
            angle = 0.0;
            delta.y = 0.0;
        } else if( Math.abs( angle - 0.5 * Math.PI ) < tolerance ) {
            angle = 0.5 * Math.PI;
            delta.x = 0.0;
        } else if( Math.abs( angle - Math.PI ) < tolerance ) {
            angle = Math.PI;
            delta.y = 0.0;
        } else if( Math.abs( angle - 1.5 * Math.PI ) < tolerance ) {
            angle = 1.5 * Math.PI;
            delta.x = 0.0;
        }
        return angle;
    }

    /**
     * Create a line object defined by the given end points.
     *
     * @param {Point} startPt the start point of a line
     * @param {Point} endPt the end point of a line
     * @returns {Object} a structure with containing the attributes of the line
     */
    function defineLine( startPt, endPt ) {
        var line = {
            lStart: { x: startPt.x, y: startPt.y },
            lEnd: { x: endPt.x, y: endPt.y }
        };

        var delta = { x: endPt.x - startPt.x, y: endPt.y - startPt.y };

        // Angle between 0 and 2PI
        line.lXangle = getAngleFromVector( delta );
        line.lSine = Math.sin( line.lXangle );
        line.lCosine = Math.cos( line.lXangle );
        line.lLength = Math.sqrt( delta.x * delta.x + delta.y * delta.y );

        // If both deltas are zero the line is a point
        if( delta.x === 0.0 && delta.y === 0.0 ) {
            line.lType = 'SlopeNone';
            line.lInvSlope = 0.0;
            line.lSlope = 0.0;
            line.lXyInt = 0.0;
            // If one delta is zero line is horizontal or vertical (deltas have already been "snapped" to zero by getAngleFromVector)
        } else if( delta.x === 0.0 ) {
            line.lType = 'SlopeVertical';
            line.lInvSlope = 0.0;
            line.lXyInt = line.lStart.x;
        } else if( delta.y === 0.0 ) {
            line.lType = 'SlopeHorizontal';
            line.lSlope = 0.0;
            line.lXyInt = line.lStart.y;
        } else { // General case
            // Get the line perpendicular to line 1 through start1
            // Note that a1 is the slope and b1 the y-intercept of this
            // perpendicular.
            line.lSlope = delta.y / delta.x;
            if( line.lSlope < 0.0 ) {
                line.lType = 'SlopeNegative';
            } else {
                line.lType = 'SlopePositive';
            }
            line.lInvSlope = -delta.x / delta.y;
            line.lXyInt = line.lStart.y - line.lSlope * line.lStart.x;
        }
        return line;
    }

    /**
     * Similar to defineLine above, but here lines are defined that are perpendicular to
     * the given line segment and passing through its end points.  In addition, a notion of
     * rightness and leftness is given to them to guide functions needing to use them.
     *
     * @param {Point} point1 the start point of a line
     * @param {Point} point2 the end point of a line
     * @returns {Object} a structure containing all required attributes of the lines perpendicular to the input line and passing through its end points
     */
    function definePerpendicularsThroughSegmentEndPoints( point1, point2 ) {
        var delta = { x: point2.x - point1.x, y: point2.y - point1.y };

        // If one delta is zero perpendicular is horizontal or vertical
        // Deltas have already been "snapped" to zero by GetAngleFromVector
        var data = {
            lStart: { x: point1.x, y: point1.y },
            lEnd: { x: point2.x, y: point2.y }
        };
        var lXyInt1;
        var lXyInt2;
        if( delta.x === 0.0 ) { // Perpendicular is vertical
            data.lType = 'SlopeHorizontal';
            data.lSlope = 0.0;
            lXyInt1 = point1.y;
            lXyInt2 = point2.y;
        } else if( delta.y === 0.0 ) {
            data.lType = 'SlopeVertical';
            data.lInvSlope = 0.0;
            lXyInt1 = point1.x;
            lXyInt2 = point2.x;
        } else { // General case
            // The slope of the line is the slope of the perpendicular
            data.lSlope = -delta.x / delta.y;
            if( data.lSlope < 0.0 ) {
                data.lType = 'SlopeNegative';
            } else {
                data.lType = 'SlopePositive';
            }
            data.lInvSlope = delta.y / delta.x;
            lXyInt1 = point1.y - data.lSlope * point1.x;
            lXyInt2 = point2.y - data.lSlope * point2.x;
            data.lXangle = Math.atan2( delta.y, -delta.x );
            data.lSine = Math.sin( data.lXangle );
            data.lCosine = Math.cos( data.lXangle );
        }

        // Determine "left" and "right" lines
        // Is line 1 left or right of line2
        // Note: the wording is wrong in this section of VisDraw/Draw3.
        if( checkLineOrder( data.lType, lXyInt1, lXyInt2 ) === '2RightOf1' ) {
            data.rightXyIntercept = lXyInt1;
            data.leftXyIntercept = lXyInt2;
            data.leftPt = { x: point2.x, y: point2.y };
            data.rightPt = { x: point1.x, y: point1.y };
        } else {
            data.rightXyIntercept = lXyInt2;
            data.leftXyIntercept = lXyInt1;
            data.leftPt = { x: point1.x, y: point1.y };
            data.rightPt = { x: point2.x, y: point2.y };
        }

        return data;
    }

    /**
     * Compute and return leader parameters for given line and text
     *
     * @param {String} whichSide a string denoting which reference line end point from which to build a leader line ("right" or "left")
     * @param {Object} lPtr the structure containing all required attributes of the lines perpendicular to a reference line and passing through its end points
     * @param {Rectangle} txtRect the center, width and height of the measurement text
     * @param {Object} leader Returned.  The points of the leader line
     * @return {boolean} false if leader is too short
     */
    function computeLeader( whichSide, lPtr, txtRect, leader ) {
        var tailPt = { x: 0.0, y: 0.0 }; // RealPtT
        var headPt = { x: 0.0, y: 0.0 }; // RealPtT
        var txtCenter = txtRect.center;

        // Get arrowhead point of line through text center
        //    and  perpedicular to given line
        computePerpPt( whichSide, lPtr, txtCenter, headPt );

        // Find the intersection of line between arrowhead and text center
        // with text box by checking for intersection.
        // There will only be one such intersection
        var halfWidth = txtRect.width * 0.5;
        var halfHeight = txtRect.height * 0.5;
        var txtLL = { x: txtCenter.x - halfWidth, y: txtCenter.y - halfHeight };
        var txtUR = { x: txtCenter.x + halfWidth, y: txtCenter.y + halfHeight };
        var txtUL = { x: txtLL.x, y: txtUR.y };
        var txtLR = { x: txtUR.x, y: txtLL.y };
        // ::Dbg:: var line = {vertices:[]};  line.vertices[0] = txtLL;  line.vertices[1] = txtUL;  drawLine( dbgCtx, "green", line, "yellow" ); Etc.

        if( findSegIntersect( txtLL, txtUL, txtCenter, headPt, tailPt ) === false ) {
            if( findSegIntersect( txtUL, txtUR, txtCenter, headPt, tailPt ) === false ) {
                if( findSegIntersect( txtUR, txtLR, txtCenter, headPt, tailPt ) === false ) {
                    findSegIntersect( txtLR, txtLL, txtCenter, headPt, tailPt );
                }
            }
        }

        // Compute length of leader to test against minimum required
        var ldrLen = getDistance( headPt, txtCenter ) -
            getDistance( tailPt, txtCenter );

        // Set leader variables
        leader.ldrPts[ 0 ] = headPt;
        leader.ldrPts[ 1 ] = tailPt;
        return ldrLen >= minAllowableLeader;
    }

    /**
     * Compute the distance between two points
     *
     * @param {Point} pt1 point 1 of the line segment
     * @param {Point} pt2 point 2 of the line segment
     * @return {Float} the distance between the two points.
     */
    function getDistance( pt1, pt2 ) {
        var dx = pt2.x - pt1.x;
        var dy = pt2.y - pt1.y;
        return Math.sqrt( dx * dx + dy * dy );
    }

    /**
     * Find the intersection (if any) between the two given line segments.
     * Intersection must lie between the two given endpoints within tolerance.
     *
     * @param {Point} s1p1 point 1 of line segment 1
     * @param {Point} s1p2 point 1 of line segment 2
     * @param {Point} s2p1 point 2 of line segment 1
     * @param {Point} s2p2 point 2 of line segment 2
     * @param {Point} intersect the intersection point, if any, between the two lines
     * @return {boolean} true if an interection point is found, false otherwise
     */
    function findSegIntersect( s1p1, s1p2, s2p1, s2p2, intersect ) {
        if( !findLineIntersect( s1p1, s1p2, s2p1, s2p2, intersect ) ) {
            return false;
        }

        // Check intersection within segment bounds
        return pointInBounds( intersect, s1p1, s1p2 ) && pointInBounds( intersect, s2p1, s2p2 );
    }

    /**
     * Find the intersection (if any) between the two given line segments.
     * Order points so that point 1 is closest to intersection
     *
     * @param {Point} s1p1 point 1 of line segment 1
     * @param {Point} s1p2 point 1 of line segment 2
     * @param {Point} s2p1 point 2 of line segment 1
     * @param {Point} s2p2 point 2 of line segment 2
     * @param {Point} intersect the intersection point, if any, between the two lines
     * @return {boolean} true if an interection point is found, false otherwise
     */
    function findLineIntersect( s1p1, s1p2, s2p1, s2p2, intersect ) {
        var m1; // Slopes of lines 1 and 2
        var m2;

        // First check for either line vertical (constant x)
        if( Math.abs( s1p1.x - s1p2.x ) <= tolerance ) { // Line1 vertical
            if( Math.abs( s2p1.x - s2p2.x ) <= tolerance ) { // Parallel vertical
                return false;
            }
            intersect.x = s1p1.x;
            m2 = ( s2p2.y - s2p1.y ) / ( s2p2.x - s2p1.x );
            intersect.y = m2 * ( intersect.x - s2p1.x ) + s2p1.y;
        } else if( Math.abs( s2p1.x - s2p2.x ) <= tolerance ) { // Line2 vertical
            intersect.x = s2p1.x;
            m1 = ( s1p2.y - s1p1.y ) / ( s1p2.x - s1p1.x );
            intersect.y = m1 * ( intersect.x - s1p1.x ) + s1p1.y;
        } else { // Compute slopes and check for parallel
            m1 = ( s1p2.y - s1p1.y ) / ( s1p2.x - s1p1.x );
            m2 = ( s2p2.y - s2p1.y ) / ( s2p2.x - s2p1.x );
            if( m1 === m2 ) {
                return false;
            }
            // Solve for intersection point
            intersect.x = ( m1 * s1p1.x - s1p1.y -
                ( m2 * s2p1.x - s2p1.y ) ) / ( m1 - m2 );
            intersect.y = m2 * ( intersect.x - s2p1.x ) + s2p1.y;
        }

        return true;
    }

    /**
     * Check to see if the given point lies bewteen the two given line segment endpoints
     *
     * @param {Point} point point 1 of line segment 1
     * @param {Point} p1 point 1 of line segment 2
     * @param {Point} p2 point 2 of line segment 1
     * @return {boolean} true if the point lies between the two endpoints
     */
    function pointInBounds( point, p1, p2 ) {
        var xmin;
        var xmax;
        var ymin;
        var ymax;

        // Set minimum and maxium values for two points
        if( p1.x <= p2.x ) {
            xmin = p1.x;
            xmax = p2.x;
        } else {
            xmin = p2.x;
            xmax = p1.x;
        }

        if( p1.y <= p2.y ) {
            ymin = p1.y;
            ymax = p2.y;
        } else {
            ymin = p2.y;
            ymax = p1.y;
        }

        return point.x >= xmin - tolerance && point.x <= xmax + tolerance &&
            point.y >= ymin - tolerance && point.y <= ymax + tolerance;
    }

    /**
     * Compute and return leader parameters for offset and text
     *
     * @param {String} whichSide a string denoting which reference line end point from which to build a leader line ("right" or "left")
     * @param {Object} lPtr the structure containing all required attributes of the lines perpendicular to a reference line and passing through its end points
     * @param {Point} tCenter the center of the measurement text
     * @param {Object} leader Returned.  The points of the leader line.
     */
    function makeMinimumLeader( whichSide, lPtr, tCenter, leader ) {
        var headPt = { x: 0.0, y: 0.0 }; // RealPtT
        var delx;
        var dely;

        // Get arrowhead point of line through text center
        //    and  perpedicular to given line
        computePerpPt( whichSide, lPtr, tCenter, headPt );

        // Make line from text point to arrohead point
        var leaderLine = defineLine( tCenter, headPt );

        // The end point is defined in direction of text center to head
        leader.ldrPts[ 0 ] = headPt;
        delx = leaderLine.lCosine * minLeader;
        dely = leaderLine.lSine * minLeader;
        leader.ldrPts[ 1 ].x = headPt.x + delx;
        leader.ldrPts[ 1 ].y = headPt.y + dely;
    }

    /**
     * Compute point on given line which is on the perpendicular to the line through the given point
     *
     * @param {String} whichSide a string denoting which reference line end point from which to build a leader line ("right" or "left")
     * @param {Object} lPtr the structure containing all required attributes of the lines perpendicular to a reference line and passing through its end points
     * @param {Point} defPt the center of the measurement text
     * @param {Point} intsctPt Returned. The intersection point on the reference line.
     */
    function computePerpPt( whichSide, lPtr, defPt, intsctPt ) {
        var tincpt;
        var lXyInt = whichSide === 'left' ? lPtr.leftXyIntercept : lPtr.rightXyIntercept;

        if( lPtr.lType === 'SlopeVertical' ) {
            intsctPt.x = lXyInt;
            intsctPt.y = defPt.y;
        } else if( lPtr.lType === 'SlopeHorizontal' ) {
            intsctPt.x = defPt.x;
            intsctPt.y = lXyInt;
        } else {
            // Get the equation of the perpendicular of "lPtr" through
            // "defPt".  The y-intercept is "tincpt".  We already know
            // that the slope is "lPtr.lInvSlope".
            tincpt = defPt.y - lPtr.lInvSlope * defPt.x;

            // The point we want is the intersection of the perpendicular
            // calculated above and "lPtr".
            intsctPt.x = ( lXyInt - tincpt ) /
                ( lPtr.lInvSlope - lPtr.lSlope );
            intsctPt.y = lXyInt + lPtr.lSlope * intsctPt.x;
        }
    }

    /**
     * Make a measurement witness line.
     *
     * @param {String} whichSide a string denoting which reference line end point from which to build a leader line ("right" or "left")
     * @param {Object} lPtr the structure containing all required attributes of the lines perpendicular to a reference line and passing through its end points
     * @param {Point} headPt the point where the leader intersects the extended line
     * @param {Array} witness Returned.  The start and end points of the witness line
     */
    function makeWitness( whichSide, lPtr, headPt, witness ) {
        var len; // Length of extensor from line end to pointer arrow
        var nearPt = whichSide === 'left' ? lPtr.leftPt : lPtr.rightPt; // point closest to arrowhead

        // In horizontal case check against x. otherwise use y
        // If arrowhead point is outside of line end find nearest line endpoint and compute distance from
        // endpoint or nearpoint to arrowhead.
        if( lPtr.lType === 'SlopeHorizontal' ) {
            len = Math.abs( headPt.x - nearPt.x );
        } else {
            len = getDistance( nearPt, headPt );
        }

        var start = { x: 0.0, y: 0.0 };
        var end = { x: 0.0, y: 0.0 };

        // Set the end points of the extensor
        // minWitnessGap is distance between end of the line and extensor
        if( lPtr.lType === 'SlopeHorizontal' ) {
            start.y = headPt.y;
            end.y = headPt.y;
            if( headPt.x < nearPt.x ) { // Head point left of near point
                start.x = nearPt.x - minWitnessGap;
                end.x = nearPt.x - ( len + minWitness );
            } else { // Head point right of near point
                start.x = nearPt.x + minWitnessGap;
                end.x = nearPt.x + len + minWitness;
            }
        } else if( lPtr.lType === 'SlopeVertical' ) {
            start.x = headPt.x;
            end.x = headPt.x;
            if( headPt.y < nearPt.y ) { // Head point below near point
                start.y = nearPt.y - minWitnessGap;
                end.y = nearPt.y - ( len + minWitness );
            } else { // Head point above near point
                start.y = nearPt.y + minWitnessGap;
                end.y = nearPt.y + len + minWitness;
            }
        } else { // Not horzontal or vertical
            // Build a line from near point to head point
            var wLine = defineLine( nearPt, headPt );

            // Compute deltas from nearPt for witness gap and set witness end pts
            var dx1 = minWitnessGap * wLine.lCosine;
            var dy1 = minWitnessGap * wLine.lSine;
            var dx2 = ( len + minWitness ) * wLine.lCosine;
            var dy2 = ( len + minWitness ) * wLine.lSine;
            start.x = nearPt.x + dx1;
            start.y = nearPt.y + dy1;
            end.x = nearPt.x + dx2;
            end.y = nearPt.y + dy2;
        }

        witness[ 0 ] = start;
        witness[ 1 ] = end;
    }
}

//==================================================
// exported functions
//==================================================
let exports;
export let _calcTextRect = calculateTextRectangle;
export let _calcDistanceMeasurePts = calculateDistanceMeasurePoints;

export default exports = {
    draw,
    _calcTextRect,
    _calcDistanceMeasurePts
};
