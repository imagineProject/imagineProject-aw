// Copyright 2024 Siemens Product Lifecycle Management Software Inc.
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */

import markupGeom from 'js/MarkupGeom';
import measurement from 'js/Measurement';
import markupColor from 'js/MarkupColor';

//==================================================
// exported functions
//==================================================
let exports;
const angleRight = Math.PI / 2;

/**
 * Draw geometry
 *
 * @param {Context} ctx the context
 * @param {FitPathResult} geom the geom
 * @param {String} fillHtml the html to be rendered inside geom
 * @param {ViewParam} viewParam the view param
 * @param {ViewParam} textParam the text param
 * @param {Color} color the color
 * @param {boolean} selected true if selected
 * @param {String} editMode current edit mode of markup
 */
export function drawGeom( ctx, geom, fillHtml, viewParam, textParam, color, selected, editMode ) {
    const richColor = markupColor.toRichColor( color );
    const solidColor = markupColor.toSolidColor( color );

    ctx.save();
    ctx.translate( viewParam.x, viewParam.y );
    ctx.scale( viewParam.scale, viewParam.scale );
    ctx.rotate( viewParam.angle2 );

    // now in world coord system
    const transform = markupGeom.interpolate( geom, viewParam.t );
    if( transform ) {
        ctx.translate( transform.x, transform.y );
        textParam = Object.assign( {}, textParam );
        textParam.scale /= transform.scale;
    }

    if( geom.shape === 'freehand' || geom.shape === 'polyline' ) {
        ctx.beginPath();
        ctx.moveTo( geom.vertices[ 0 ].x, geom.vertices[ 0 ].y );
        for( let i = 1; i < geom.vertices.length; i++ ) {
            ctx.lineTo( geom.vertices[ i ].x, geom.vertices[ i ].y );
        }
        drawContent( ctx, geom, textParam );
    } else if( geom.shape === 'polygon' ) {
        drawPolygon( ctx, geom, viewParam, textParam, color );
    } else if( geom.shape === 'curve' || geom.shape === 'closed-curve' ) {
        drawCurve( ctx, geom, viewParam, textParam, color );
    } else if( geom.shape === 'rectangle' ) {
        drawRectangle( ctx, geom, viewParam, textParam, transform, color );
    } else if( geom.shape === 'ellipse' || geom.shape === 'circle' ) {
        drawEllipse( ctx, geom, viewParam, textParam, transform, color );
    } else if( geom.shape === 'gdnt' ) {
        drawGdnt( ctx, geom, fillHtml, viewParam );
    } else if( geom.shape === 'weld' ) {
        drawWeld( ctx, geom, fillHtml, viewParam );
    } else if( geom.shape === 'leader' ) {
        drawLeader( ctx, geom, fillHtml, viewParam );
    } else if( geom.shape === 'symbol' ) {
        drawSymbol( ctx, geom, fillHtml, viewParam );
    } else if( geom.shape === 'measurement' ) {
        var highlight = {
            selected: selected,
            lineWidth: 10 / viewParam.scale,
            color: richColor
        };
        measurement.draw( ctx, geom, highlight );
        ctx.restore();
        return;
    } else {
        return;
    }

    // highlight if selected
    if( selected ) {
        drawHighlight( ctx, geom, richColor, viewParam );
    }

    // Draw stroke and arrows in world coord system
    drawStroke( ctx, geom, solidColor, viewParam, selected, editMode );

    // Draw hatch in world coord system
    drawHatch( ctx, geom, solidColor, viewParam );
    ctx.restore();
}


/**
 * Update the markup size according to its html, i.e. the GD&T
 * @param {Context} ctx the context
 * @param {Markup} markup - the markup to be updated
 * @param {ViewParam} viewParam - the current view param
 */
export function updateGdntSize( ctx, markup, viewParam ) {
    if( markup && markup.geometry && markup.geometry.list[0].shape === 'gdnt' ) {
        const info = calcGdntInfo( ctx, markup.comment );
        const screenWidth = info ? info.width : 40;
        const screenHeight = info ? info.height : 20;

        const geom = markup.geometry.list[0];
        const worldWidth = screenWidth / viewParam.scale;
        const worldHeight = screenHeight / viewParam.scale;

        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const swap = dx * dy < 0;
        const worldDx = ( dx > 0 ? 1 : -1 ) * ( swap ? worldHeight : worldWidth );
        const worldDy = ( dy > 0 ? 1 : -1 ) * ( swap ? worldWidth : worldHeight );
        const lastPt = geom.vertices ? geom.vertices[ geom.vertices.length - 1 ] : null;
        const tol = 0.001;

        if( !lastPt || Math.abs( lastPt.y - geom.startPt.y ) < tol ) {
            geom.endPt.y = geom.startPt.y + worldDy;
        } else {
            geom.startPt.y = geom.endPt.y - worldDy;
        }
        geom.endPt.x = geom.startPt.x + worldDx;

        geom.bbox = null;
        const bbox = markupGeom.getGeomBbox( geom );
        markup.start.x = bbox.xmin;
        markup.start.y = bbox.ymin;
        markup.end.x = bbox.xmax;
        markup.end.y = bbox.ymax;
    }
}

/**
 * Update the weld markup size according to its html
 * @param {Context} ctx the context
 * @param {Markup} markup - the markup to be updated
 * @param {ViewParam} viewParam - the current view param
 */
export function updateWeldSize( ctx, markup, viewParam ) {
    if( markup && markup.geometry && markup.geometry.list[0].shape === 'weld' ) {
        const info = calcWeldInfo( ctx, markup.comment );
        const screenWidth = info ? info.width : 64;
        const screenHeight = info ? info.height : 32;

        const geom = markup.geometry.list[0];
        const worldWidth = screenWidth / viewParam.scale;
        const worldHeight = screenHeight / viewParam.scale;

        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const swap = dx * dy < 0;
        const worldDx = ( dx >= 0 ? 1 : -1 ) * ( swap ? worldHeight : worldWidth );
        const worldDy = ( dy >= 0 ? 1 : -1 ) * ( swap ? worldWidth : worldHeight );
        const lastPt = geom.vertices ? geom.vertices[ geom.vertices.length - 1 ] : null;
        const tol = 0.001;

        if( !swap ) {
            if( !lastPt || Math.abs( lastPt.x - geom.startPt.x ) < tol ) {
                geom.endPt.x = geom.startPt.x + worldDx;
            } else {
                geom.startPt.x = geom.endPt.x - worldDx;
            }

            const midY = ( geom.startPt.y + geom.endPt.y ) / 2;
            geom.startPt.y = midY - worldDy / 2;
            geom.endPt.y = midY + worldDy / 2;
        } else {
            if( !lastPt || Math.abs( lastPt.y - geom.startPt.y ) < tol ) {
                geom.endPt.y = geom.startPt.y + worldDy;
            } else {
                geom.startPt.y - geom.endPt.y - worldDy;
            }

            const midX = ( geom.startPt.x + geom.endPt.x ) / 2;
            geom.startPt.x = midX - worldDx / 2;
            geom.endPt.x = midX + worldDx / 2;
        }

        geom.bbox = null;
        const bbox = markupGeom.getGeomBbox( geom );
        markup.start.x = bbox.xmin;
        markup.start.y = bbox.ymin;
        markup.end.x = bbox.xmax;
        markup.end.y = bbox.ymax;
    }
}

/**
 * Update the Leader markup size according to its html
 * @param {Context} ctx the context
 * @param {Markup} markup - the markup to be updated
 * @param {ViewParam} viewParam - the current view param
 */
export function updateLeaderSize( ctx, markup, viewParam ) {
    if( markup && markup.geometry && markup.geometry.list[0].shape === 'leader' ) {
        const info = calcLeaderInfo( ctx, markup.comment );
        const screenWidth = info ? info.width : 40;
        const screenHeight = info ? info.height : 20;

        const geom = markup.geometry.list[0];
        const worldWidth = screenWidth / viewParam.scale;
        const worldHeight = screenHeight / viewParam.scale;

        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const swap = dx * dy < 0;
        const worldDx = ( dx >= 0 ? 1 : -1 ) * ( swap ? worldHeight : worldWidth );
        const worldDy = ( dy >= 0 ? 1 : -1 ) * ( swap ? worldWidth : worldHeight );
        const lastPt = geom.vertices[ geom.vertices.length - 1 ];
        const tol = 0.001;

        if( !swap ) {
            if( Math.abs( lastPt.x - geom.startPt.x ) < tol ) {
                geom.endPt.x = geom.startPt.x + worldDx;
            } else {
                geom.startPt.x = geom.endPt.x - worldDx;
            }

            if( markup.showOnPage === 'centered' ) {
                geom.startPt.y = lastPt.y - worldDy / 2;
                geom.endPt.y = lastPt.y + worldDy / 2;
            } else {
                geom.startPt.y = lastPt.y - worldDy;
                geom.endPt.y = lastPt.y;
            }
        } else {
            if( Math.abs( lastPt.y - geom.startPt.y ) < tol ) {
                geom.endPt.y = geom.startPt.y + worldDy;
            } else {
                geom.startPt.y - geom.endPt.y - worldDy;
            }

            if( markup.showOnPage === 'centered' ) {
                geom.startPt.x = lastPt.x - worldDx / 2;
                geom.endPt.x = lastPt.x + worldDx / 2;
            } else {
                geom.startPt.x = lastPt.x - worldDx;
                geom.endPt.x = lastPt.x;
            }
        }

        geom.bbox = null;
        const bbox = markupGeom.getGeomBbox( geom );
        markup.start.x = bbox.xmin;
        markup.start.y = bbox.ymin;
        markup.end.x = bbox.xmax;
        markup.end.y = bbox.ymax;
    }
}

/**
 * Update the Symbol markup size according to its html
 * @param {Context} ctx the context
 * @param {Markup} markup - the markup to be updated
 * @param {ViewParam} viewParam - the current view param
 */
export function updateSymbolSize( ctx, markup, viewParam ) {
    if( markup && markup.geometry && markup.geometry.list[0].shape === 'symbol' ) {
        const info = calcSymbolInfo( ctx, markup.comment );
        const screenWidth = info ? info.width : 32;
        const screenHeight = info ? info.height : 32;

        const geom = markup.geometry.list[0];
        const worldWidth = screenWidth / viewParam.scale;
        const worldHeight = screenHeight / viewParam.scale;

        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const swap = dx * dy < 0;
        const worldDx = ( dx >= 0 ? 1 : -1 ) * ( swap ? worldHeight : worldWidth );
        const worldDy = ( dy >= 0 ? 1 : -1 ) * ( swap ? worldWidth : worldHeight );

        if( !swap ) {
            geom.endPt.x = geom.startPt.x + worldDx;
            const midY = ( geom.startPt.y + geom.endPt.y ) / 2;
            geom.startPt.y = midY - worldDy / 2;
            geom.endPt.y = midY + worldDy / 2;
        } else {
            geom.endPt.y = geom.startPt.y + worldDy;
            const midX = ( geom.startPt.x + geom.endPt.x ) / 2;
            geom.startPt.x = midX - worldDx / 2;
            geom.endPt.x = midX + worldDx / 2;
        }

        geom.bbox = null;
        const bbox = markupGeom.getGeomBbox( geom );
        markup.start.x = bbox.xmin;
        markup.start.y = bbox.ymin;
        markup.end.x = bbox.xmax;
        markup.end.y = bbox.ymax;
    }
}

//==================================================
// private functions
//==================================================

/**
 * Draw a bumpy "cloud" line from x1,y1 to x2,y2.
 * @param {Context} ctx the 2d context
 * @param {Geom} geom the geom
 * @param {int} x1 point 1 x
 * @param {int} y1 point 1 y
 * @param {int} x2 point 2 x
 * @param {int} y2 point 2 y
 * @param {ViewParam} viewParam the view param
 */
function drawCloudLine( ctx, geom, x1, y1, x2, y2, viewParam ) {
    var x = x1;
    var y = y1;
    var dx = x2 - x;
    var dy = y2 - y;
    var len = Math.sqrt( dx * dx + dy * dy );

    var dia = calcLineWidth( geom, viewParam ) * 10;
    var hop = Math.max( Math.floor( len / dia ), 1 );
    dx /= hop;
    dy /= hop;
    x += dx / 2;
    y += dy / 2;

    var rotation = Math.atan2( dy, dx ) - Math.PI;
    var ccw = markupGeom.getGeomTurn( geom ) < 0;
    for( var j = 0; j < hop; j++, x += dx, y += dy ) {
        ctx.ellipse( x, y, dia / 2, dia / 3, rotation, 0, Math.PI, ccw );
    }
}

/**
 * Draw polygon
 * @param {Context} ctx - the 2d context
 * @param {Geom} geom - the geom
 * @param {ViewParam} viewParam - the view param
 * @param {TextParam} textParam - the text param
 * @param {Color} color - the color
 */
function drawPolygon( ctx, geom, viewParam, textParam, color ) {
    ctx.beginPath();
    ctx.moveTo( geom.vertices[ 0 ].x, geom.vertices[ 0 ].y );
    for( var i = 1; i < geom.vertices.length; i++ ) {
        if( geom.stroke && geom.stroke.style === 'cloud' ) {
            drawCloudLine( ctx, geom, geom.vertices[i - 1].x, geom.vertices[i - 1].y, geom.vertices[i].x, geom.vertices[i].y,
                viewParam );
        } else {
            ctx.lineTo( geom.vertices[ i ].x, geom.vertices[ i ].y );
        }
    }

    // draw fill and image in world coord system
    ctx.closePath();
    drawFill( ctx, geom, color );
    drawContent( ctx, geom, textParam );
}

/**
 * Draw curve and closed-curve
 * @param {Context} ctx - the 2d context
 * @param {Geom} geom - the geom
 * @param {ViewParam} viewParam - the view param
 * @param {TextParam} textParam - the text param
 * @param {Color} color - the color
 */
function drawCurve( ctx, geom, viewParam, textParam, color ) {
    const pts = geom.vertices;
    if( geom.debug ) {
        // draw lines connecting control points
        ctx.beginPath();
        ctx.moveTo( pts[0].x, pts[0].y );
        for( let i = 1; i < pts.length; i++ ) {
            ctx.lineTo( pts[i].x, pts[i].y );
        }
        ctx.strokeStyle = 'green';
        ctx.stroke();

        // draw control and end points
        const r = calcLineWidth( geom, viewParam ) * 2;
        for( let i = 0; i < pts.length; i++ ) {
            ctx.beginPath();
            ctx.arc( pts[i].x, pts[i].y, r, 0, 2 * Math.PI );
            ctx.strokeStyle = pts[i].c ? 'green' : 'red';
            ctx.stroke();
        }

        // draw approximate lines
        const appPts = markupGeom.getCurveApproxPts( geom );
        ctx.beginPath();
        ctx.moveTo( appPts[0].x, appPts[0].y );
        for( let i = 1; i < appPts.length; i++ ) {
            ctx.lineTo( appPts[i].x, appPts[i].y );
        }
        ctx.strokeStyle = 'blue';
        ctx.stroke();

        // draw bbox
        const bbox = markupGeom.getGeomBbox( geom );
        ctx.beginPath();
        ctx.rect( bbox.xmin, bbox.ymin, bbox.xmax - bbox.xmin, bbox.ymax - bbox.ymin );
        ctx.strokeStyle = 'gray';
        ctx.stroke();
    }

    // draw the curve
    ctx.beginPath();
    for( let i = 0; i < pts.length - 1; ) {
        const d = markupGeom.getCurveDegree( geom, i );
        if( i === 0 ) {
            ctx.moveTo( pts[0].x, pts[0].y );
        }
        if( d === 1 ) {
            ctx.lineTo( pts[i + 1].x, pts[i + 1].y );
        } else if( d === 2 ) {
            ctx.quadraticCurveTo( pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y );
        } else if( d === 3 ) {
            ctx.bezierCurveTo( pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y, pts[i + 3].x, pts[i + 3].y );
        }

        i += d;
    }

    if( geom.shape === 'closed-curve' ) {
        ctx.closePath();
        drawFill( ctx, geom, color );
    }
    drawContent( ctx, geom, textParam );
}

/**
 * Draw Rectangle
 * @param {Context} ctx - the 2d context
 * @param {Geom} geom - the geom
 * @param {ViewParam} viewParam - the view param
 * @param {TextParam} textParam - the text param
 * @param {ViewParam} transform - transform for animation
 * @param {Color} color - the color
 */
function drawRectangle( ctx, geom, viewParam, textParam, transform, color ) {
    let a = geom.major;
    let b = geom.minor;
    let r = geom.cornerRadius > 0 ? geom.cornerRadius * b : 0;
    let angle = geom.angle;

    if( transform ) {
        a *= transform.scale;
        b *= transform.scale;
        r *= transform.scale;
        angle += transform.angle;
    }

    ctx.translate( geom.center.x, geom.center.y );
    ctx.rotate( angle );
    ctx.beginPath();
    ctx.moveTo( a, b - r );
    if( geom.stroke && geom.stroke.style === 'cloud' ) {
        drawCloudLine( ctx, geom, a, b - r, -a + r, b, viewParam );
        drawCloudLine( ctx, geom, -a + r, b, -a, -b + r, viewParam );
        drawCloudLine( ctx, geom, -a, -b + r, a - r, -b, viewParam );
        drawCloudLine( ctx, geom, a - r, -b, a, b - r, viewParam );
    } else {
        r > 0 && ctx.arc( a - r, b - r, r, 0, Math.PI / 2 );
        ctx.lineTo( -a + r, b );
        r > 0 && ctx.arc( -a + r, b - r, r, Math.PI / 2, Math.PI );
        r < b && ctx.lineTo( -a, -b + r );
        r > 0 && ctx.arc( -a + r, -b + r, r, Math.PI, Math.PI * 3 / 2 );
        ctx.lineTo( a - r, -b );
        r > 0 && ctx.arc( a - r, -b + r, r, Math.PI * 3 / 2, Math.PI * 2 );
        r < b && ctx.lineTo( a, b - r );
    }
    ctx.closePath();
    // draw fill and image in world coord system, with origin at center and rotated
    drawFill( ctx, geom, color );
    drawContent( ctx, geom, textParam );
}

/**
 * Transform Ellipse to Polygon
 * @param {Number} cx - the ellipse center x
 * @param {Number} cy - the ellipse center y
 * @param {Number} major - the ellipse major length
 * @param {Number} minor - the ellipse minor length
 * @param {Number} rotation - the ellipse rotation angle
 * @returns {Array} vertices - the polygon vertices
 */
function transformEllipseToPolygon( cx, cy, major, minor, rotation ) {
    let numSegments = 16;
    let shift = 2 * Math.PI / numSegments;
    let phi = 0;
    let vertices = [];

    for( let i = 0; i < numSegments; ++i ) {
        phi += shift;
        let offsetX = major * Math.cos( phi );
        let offsetY = minor * Math.sin( phi );
        let rotatedX = offsetX * Math.cos( rotation ) - offsetY * Math.sin( rotation );
        let rotatedY = offsetX * Math.sin( rotation ) + offsetY * Math.cos( rotation );
        vertices.push( {
            x: cx + rotatedX,
            y: cy + rotatedY
        } );
    }
    vertices.push( vertices[0] );

    return vertices;
}

/**
 * Draw Ellipse
 * @param {Context} ctx - the 2d context
 * @param {Geom} geom - the geom
 * @param {ViewParam} viewParam - the view param
 * @param {TextParam} textParam - the text param
 * @param {ViewParam} transform - transform for animation
 * @param {Color} color - the color
 */
function drawEllipse( ctx, geom, viewParam, textParam, transform, color ) {
    let major = geom.major;
    let minor = geom.minor;
    let angle = geom.angle;

    if( transform ) {
        major *= transform.scale;
        minor *= transform.scale;
        angle += transform.angle;
    }

    if( geom.stroke && geom.stroke.style === 'cloud' ) {
        let vertices = transformEllipseToPolygon( geom.center.x, geom.center.y, major, minor, angle );

        ctx.beginPath();
        ctx.moveTo( vertices[ 0 ].x, vertices[ 0 ].y );
        for( var i = 1; i < vertices.length; i++ ) {
            drawCloudLine( ctx, geom, vertices[i - 1].x, vertices[i - 1].y, vertices[i].x, vertices[i].y,
                viewParam );
        }
        ctx.closePath();
    } else {
        ctx.translate( geom.center.x, geom.center.y );
        ctx.rotate( angle );
        ctx.save();
        ctx.scale( major, minor );

        ctx.beginPath();
        ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
        ctx.restore();
    }
    // draw fill and image in world coord system, with origin at center and rotated
    drawFill( ctx, geom, color );
    drawContent( ctx, geom, textParam );
}

/**
 * Draw geometry with fill color
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom - the geometry
 * @param {Color} color - the default color
 */
function drawFill( ctx, geom, color ) {
    if( geom.fill && geom.fill.style === 'solid' ) {
        ctx.fillStyle = geom.fill.color ? markupColor.fromHex( geom.fill.color ) : color;
        ctx.fill();
    }
}

/**
 * Draw geometry with hatch
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom - the geometry
 * @param {Color} color - the default color
 * @param {ViewParam} viewParam The view param
 */
function drawHatch( ctx, geom, color, viewParam ) {
    if( geom.fill && geom.fill.style ) {
        var style = geom.fill.style.substring( 0, 5 );
        if( style === 'hatch' || style === 'cross' ) {
            var r = 0;
            if( geom.shape === 'ellipse' || geom.shape === 'circle' ) {
                r = geom.major;
            } else if( geom.shape === 'rectangle' ) {
                r = Math.sqrt( geom.major * geom.major + geom.minor * geom.minor );
            } else {
                var x = 0;
                var y = 0;
                for( var i = 0; i < geom.vertices.length; i++ ) {
                    x += geom.vertices[ i ].x;
                    y += geom.vertices[ i ].y;
                }

                x /= geom.vertices.length;
                y /= geom.vertices.length;

                for( var j = 0; j < geom.vertices.length; j++ ) {
                    var dx = geom.vertices[ j ].x - x;
                    var dy = geom.vertices[ j ].y - y;
                    var d = Math.sqrt( dx * dx + dy * dy );
                    if( d > r ) {
                        r = d;
                    }
                }
                ctx.translate( x, y );
            }

            var space = geom.fill.space ? geom.fill.space : 10;
            var hatch = viewParam.scale > 0 ? space / viewParam.scale : space;
            var degree = geom.fill.degree ? geom.fill.degree : geom.fill.style.substring( 5 );
            var extra = geom.angle === angleRight ? angleRight : 0;

            ctx.clip();
            ctx.save();
            ctx.rotate( -degree * Math.PI / 180 + extra );
            for( var v = -r; v < r; v += hatch ) {
                ctx.moveTo( -r, v );
                ctx.lineTo( r, v );
                if( style === 'cross' ) {
                    ctx.moveTo( v, -r );
                    ctx.lineTo( v, r );
                }
            }

            ctx.restore();
            ctx.strokeStyle = geom.fill.color ? markupColor.fromHex( geom.fill.color ) : color;
            ctx.lineWidth = 0.5 / viewParam.scale;
            ctx.setLineDash( [] );
            ctx.stroke();
        }
    }
}

/**
 * Draw highlight with default color
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom - the geometry
 * @param {Color} color - the default color
 * @param {ViewParam} viewParam The view param
 */
function drawHighlight( ctx, geom, color, viewParam ) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 10 / viewParam.scale;
    ctx.lineCap = 'round';
    ctx.setLineDash( [] );
    ctx.stroke();
}

/**
 * Draw geometry with stoke color and style
 *
 * @param {Context2D} ctx - the context of the canvas
 * @param {Geometry} geom - the geometry
 * @param {Color} color - the default color
 * @param {ViewParam} viewParam The view param
 * @param {Boolean} selected the selected markup
 * @param {String} editMode the edit mode of the markup
 */
function drawStroke( ctx, geom, color, viewParam, selected, editMode ) {
    if( !geom.stroke || geom.stroke.style !== 'none' ) {
        var lineColor = geom.stroke && geom.stroke.color ? markupColor.fromHex( geom.stroke.color ) : color;
        var lineWidth = calcLineWidth( geom, viewParam );
        var w = lineWidth < 1 ? 1 : lineWidth;

        var seg = !geom.stroke || geom.stroke.style === 'solid' || geom.stroke.style === 'cloud' ? [] :
            geom.stroke.style === 'dash' ? [ w * 5, w ] :
                geom.stroke.style === 'dot' ? [ w, w ] :
                    geom.stroke.style === 'dash-dot' ? [ w * 5, w, w, w ] :
                        geom.stroke.style === 'dash-dot-dot' ? [ w * 5, w, w, w, w, w ] : [];

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = lineColor;
        ctx.setLineDash( seg );
        ctx.stroke();
        ctx.setLineDash( [] );

        //Draw Yellow Circles for leader line edits
        if( selected && editMode === 'edit' && ( geom.shape === 'leader' || geom.shape === 'weld' || geom.shape === 'gdnt' ) ) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect( geom.vertices[geom.vertices.length - 1].x - 10, geom.vertices[geom.vertices.length - 1].y - 10, 20, 20, 90 );
            ctx.roundRect( geom.vertices[0].x - 10, geom.vertices[0].y - 10, 20, 20, 90 );
            ctx.lineWidth = 2 / viewParam.scale;
            ctx.strokeStyle = 'yellow';
            ctx.stroke();
            ctx.restore();
        }

        // draw arrows for polyline, curve, gdnt (aw6.2+) or weld or leader lines
        if( geom.vertices ) {
            if( geom.startArrow ) {
                drawArrow( ctx, geom, 0, lineColor, viewParam );
            }

            if( geom.endArrow ) {
                drawArrow( ctx, geom, geom.vertices.length - 1, lineColor, viewParam );
            }
        }
    }
}

/**
 * Draw an arrow
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geometry} geom - the geometry
 * @param {Number} index - the arrowhead index, either 0 or n-1
 * @param {Color} color - the color
 * @param {ViewParam} viewParam The view param
 */
function drawArrow( ctx, geom, index, color, viewParam ) {
    const arrow = index === 0 ? geom.startArrow : geom.endArrow;
    const style = arrow === true ? 'open' : arrow.style;
    if( style !== 'none' ) {
        const v0 = geom.vertices[ index === 0 ? 0 : index ];
        const v1 = geom.vertices[ index === 0 ? 1 : index - 1 ];
        const dx = v1.x - v0.x;
        const dy = v1.y - v0.y;
        const angle = Math.atan2( v1.y - v0.y, v1.x - v0.x );
        const width = arrow.width ? arrow.width :
            !geom.stroke || geom.stroke.width === 'mid' ? 8 / viewParam.scale :
                geom.stroke.width === 'min' ? 4 : Math.max( 4, 4 * geom.stroke.width );
        const length = arrow.length ? arrow.length :
            style === 'open' || style === 'closed' || style === 'filled' ? 2 * width : width;

        if( Math.sqrt( dx * dx + dy * dy ) > length ) {
            ctx.save();
            ctx.translate( v0.x, v0.y );
            ctx.rotate( angle );
            ctx.scale( length, width );
            ctx.beginPath();
            if( style === 'open' || style === 'closed' || style === 'filled' ) {
                ctx.moveTo( 1, 0.5 );
                ctx.lineTo( 0, 0 );
                ctx.lineTo( 1, -0.5 );
                if( style === 'closed' || style === 'filled' ) {
                    ctx.closePath();
                    ctx.fillStyle = style === 'closed' ? 'white' : color;
                    ctx.fill();
                }
            } else if( style === 'cross' ) {
                ctx.moveTo( 1, 0.5 );
                ctx.lineTo( -1, -0.5 );
                ctx.moveTo( -1, 0.5 );
                ctx.lineTo( 1, -0.5 );
            } else if( style === 'datum' ) {
                ctx.moveTo( 0, 0.5 );
                ctx.lineTo( 1, 0 );
                ctx.lineTo( 0, -0.5 );
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
            } else if( style === 'circle' || style === 'disk' ) {
                ctx.arc( 0.5, 0, 0.5, 0, 2 * Math.PI );
                ctx.fillStyle = style === 'circle' ? 'white' : color;
                ctx.fill();
            }

            ctx.restore();
            ctx.stroke();
        }
    }
}

/**
 * Calculate the line width in the world coord system
 *
 * @param {Geometry} geom - the geometry
 * @param {ViewParam} viewParam - the view param
 * @returns {Number} line width
 */
function calcLineWidth( geom, viewParam ) {
    const minWidth = 0.5 / viewParam.scale;
    const midWidth = 2 / viewParam.scale;
    return !geom.stroke || geom.stroke.width === 'mid' ? midWidth :
        geom.stroke.width === 'min' ? minWidth :
            isFinite( geom.stroke.width ) ? Math.max( minWidth, geom.stroke.width ) : midWidth;
}

/**
 * Draw content of image or text if exist on geometry
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geomety} geom - the geometry
 * @param {ViewParam} textParam - the text param
 */
function drawContent( ctx, geom, textParam ) {
    if( geom.fillImage || geom.text ) {
        var rect = markupGeom.getGeomRect( geom );
        var x = rect.left;
        var y = rect.top;

        ctx.save();
        if( markupGeom.isClosedShape( geom ) ) {
            ctx.clip();
        }

        if( textParam ) {
            if( geom.shape === 'polyline' || geom.shape === 'curve' ) {
                ctx.translate( rect.left, rect.top );
            } else if( geom.shape === 'polygon' || geom.shape === 'closed-curve' || geom.shape === 'freehand' ) {
                ctx.translate( rect.left + rect.width / 2, rect.top + rect.height / 2 );
            }

            ctx.scale( 1 / textParam.scale, 1 / textParam.scale );
            x = textParam.x;
            y = textParam.y;
            var n = x < 0 && y < 0 ? 0 : x < 0 && y > 0 ? 1 : x > 0 && y > 0 ? 2 : 3;
            ctx.rotate( -n * angleRight );
            x = geom.shape === 'polyline' || geom.shape === 'curve' ? 0 : -Math.abs( x );
            y = geom.shape === 'polyline' || geom.shape === 'curve' ? 0 : -Math.abs( y );
            if( n === 1 || n === 3 ) {
                var t = x;
                x = y;
                y = t;
            }
        }

        if( geom.fillImage ) {
            ctx.drawImage( geom.fillImage, x, y );
        }

        if( geom.text ) {
            drawText( ctx, x, y, geom.text );
        }
        ctx.restore();
    }
}

/**
 * Draw text
 *
 * @param {Context} ctx - The canvas 2d context
 * @param {Number} x - The start coord x
 * @param {Number} y - The start coord y
 * @param {Object} text - The text to be drawn, containing properties:
 *      color: the text color
 *      font: the font including size, style, family
 *      string: the text string, using <br/> for line break
 *      baseLine: "alphabetic|top|hanging|middle|ideographic|bottom"
 *      lineHeight: the line height, i.e. font height + spacing
 *      maxWidth: the maximum width, if any text line exceeds it, scale all to make it fit
 */
function drawText( ctx, x, y, text ) {
    ctx.fillStyle = text.color;
    ctx.font = text.font;
    ctx.textBaseline = text.baseLine;

    var lines = text.string.split( '<br/>' );
    var maxWidth = 0;
    lines.forEach( function( t ) {
        maxWidth = Math.max( maxWidth, ctx.measureText( t ).width );
    } );
    var scale = maxWidth > text.maxWidth ? text.maxWidth / maxWidth : 1.0;

    ctx.translate( x, y );
    ctx.scale( scale, scale );
    lines.forEach( function( t, i ) {
        ctx.fillText( t, 0, text.lineHeight * i );
    } );
}

/**
 * Calculate the GD&T info in screen coordinates
 *
 * @param {Context} ctx The canvas 2d context
 * @param {String} fillHtml The fill html
 *
 * @returns {Object} the info
 *    e.g. { font: "12px sans-serif", width: 160, height: 20, rowWidth, colWidth, list }
 *    where list e.g. [[ rowspan, symbol, tolerance, refA, refB, refC ], ...]
 *    rowWidth e.g. [ 120, 160, 140 ], colWidth e.g. [ 20, 100, 20, 20 ]
 */
function calcGdntInfo( ctx, fillHtml ) {
    if( ctx && fillHtml ) {
        let info = {};

        const trs = fillHtml.split( '</tr><tr>' );
        info.list = trs.map( ( tr ) => {
            const tds = tr.match( />[^<]*<\/td>/gu );
            const vals = tds.map( ( v ) => v.substring( 1, v.length - 5 ) );
            const attrs = tr.match( /rowspan="\d+"/ );
            const rowspan = attrs && attrs.length > 0 ? Number( attrs[0].match( /\d+/ )[0] ) : 1;
            return [ rowspan, ...vals ];
        } );

        // set rowspan, 0 if covered by above row, remove empty trailing columns
        for( let i = 0; i < info.list.length; i++ ) {
            const row = info.list[i];
            const rowspan = row[0];
            for( let j = 1; j < rowspan; j++ ) {
                info.list[i + j][0] = 0;
            }

            const len = rowspan > 0 ? 3 : 2;
            while( row.length > len ) {
                if( row[ row.length - 1 ] ) {
                    break;
                }
                row.pop();
            }
        }

        // Calculate the column width, max of the same column in all rows
        const font = fillHtml.match( /font:[^;]*;/ );
        info.font = font ? font[0].substring( 5, font[0].length - 1 ) : '12px sans-serif';
        ctx.font = info.font;

        const fontSize = info.font.match( /\d+/ );
        info.height = info.list.length * ( fontSize * 1.3 + 6 ); // add margin top 2 bottom 2 border 1
        info.colWidth = [ 0, 0, 0, 0, 0 ];

        info.list.forEach( ( row ) => {
            for( let i = 1; i < row.length; i++ ) {
                if( row[i] ) {
                    const w = ctx.measureText( row[i] ).width + 9; // add margin left 4 right 4 border 1
                    const index = row[0] ? i - 1 : i;
                    info.colWidth[ index ] = Math.max( w, info.colWidth[ index ] );
                }
            }
        } );

        // Calculate the row width, sum of all columns in the row
        info.rowWidth = info.list.map( ( row ) => {
            let sum = row[0] ? 0 : info.colWidth[0];
            for( let i = 1; i < row.length; i++ ) {
                sum += info.colWidth[ row[0] ? i - 1 : i ];
            }
            return sum;
        } );

        info.width = Math.max( ...info.rowWidth );
        return info;
    }

    return null;
}

/**
 * Draw GD&T
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geometry} geom The geometry
 * @param {String} fillHtml The fill html
 * @param {ViewParam} viewParam The view param
 */
function drawGdnt( ctx, geom, fillHtml, viewParam ) {
    ctx.beginPath();

    const info = calcGdntInfo( ctx, fillHtml );
    if( info && info.list && info.list.length > 0 ) {
        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const n = dx > 0 && dy > 0 ? 0 : dx < 0 && dy > 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
        const scale = Math.abs( n % 2 ? dy : dx ) / info.width;
        const lineWidth = calcLineWidth( geom, viewParam );
        const lineColor = geom.stroke && geom.stroke.color ? markupColor.fromHex( geom.stroke.color ) : 'black';

        ctx.save();
        ctx.translate( geom.startPt.x, geom.startPt.y );
        ctx.scale( scale, scale );
        ctx.rotate( n * angleRight );
        ctx.beginPath();

        ctx.font = info.font;
        ctx.textBaseline = 'top';
        ctx.fillStyle = lineColor;
        ctx.strokeStyle = lineColor;
        ctx.lineCap = 'square';
        ctx.lineWidth = lineWidth / scale;

        let top = 0;
        const rowHeight = info.height / info.list.length;

        // draw leftmost vertical line
        ctx.moveTo( 0, 0 );
        ctx.lineTo( 0, info.height );

        // draw text and vertical line at its right
        info.list.forEach( ( row, i ) => {
            const rowspan = row[0];
            let left = rowspan ? 0 : info.colWidth[0];
            row.slice( 1 ).forEach( ( col, j ) => {
                const down = rowspan > 1 && j === 0 ? rowHeight * ( rowspan - 1 ) / 2 : 0;
                ctx.fillText( col, left + 5, top + down + 6 );

                left += info.colWidth[ j + ( rowspan ? 0 : 1 ) ];
                ctx.moveTo( left, top );
                ctx.lineTo( left, top + ( rowspan > 1 && j === 0 ? rowspan : 1 ) * rowHeight );
            } );
            top += rowHeight;
        } );

        // draw horizontal lines
        top = 0;
        for( let i = 0; i < info.list.length; i++ ) {
            if( i === 0 ) {
                ctx.moveTo( 0, 0 );
                ctx.lineTo( info.rowWidth[0], 0 );
            }

            const last = i === info.list.length - 1;
            const left = last || info.list[i + 1][0] ? 0 : info.colWidth[0];
            const right = Math.max( info.rowWidth[i], last ? 0 : info.rowWidth[i + 1] );

            top += rowHeight;
            ctx.moveTo( left, top );
            ctx.lineTo( right, top );
        }

        ctx.stroke();
        ctx.restore();
    } else {
        ctx.moveTo( geom.startPt.x, geom.startPt.y );
        ctx.lineTo( geom.startPt.x, geom.endPt.y );
        ctx.lineTo( geom.endPt.x, geom.endPt.y );
        ctx.lineTo( geom.endPt.x, geom.startPt.y );
        ctx.lineTo( geom.startPt.x, geom.startPt.y );
    }

    // draw optional leader lines
    if( geom.vertices ) {
        ctx.moveTo( geom.vertices[ 0 ].x, geom.vertices[ 0 ].y );
        for( var i = 1; i < geom.vertices.length; i++ ) {
            ctx.lineTo( geom.vertices[ i ].x, geom.vertices[ i ].y );
        }
    }
}

/**
 * Calculate the Weld info in screen coordinates
 *
 * @param {Context} ctx The canvas 2d context
 * @param {String} fillHtml The fill html
 *
 * @returns {Object} the info in screen coordinates
 *    e.g. { font: "12px sans-serif", width: 64, height: 32, ref, list }
 *    where list contains 3 rows, each row e.g. [ {t: '123', w: 35}, ... ]
 *    width and height are the basic size, not include the optional text on top, bottom, or tail
 *    ref is the symbol center x-coord from the left on the reference line
 */
function calcWeldInfo( ctx, fillHtml ) {
    if( ctx && fillHtml ) {
        let info = {};
        const font = fillHtml.match( /font:[^;]*;/ );
        info.font = font ? font[0].substring( 5, font[0].length - 1 ) : '12px sans-serif';
        ctx.font = info.font;

        const trs = fillHtml.split( '</tr><tr>' );
        info.list = trs.map( ( tr ) => {
            const tds = tr.split( '</td><td>' );
            return tds.map( ( td ) => {
                const iSvg = td.indexOf( '<svg' );
                const iTd = td.indexOf( '<td>' );
                const iTdEnd = td.indexOf( '</td>' );
                const t = iSvg >= 0 ? svgToSymbols( td ) : iTd >= 0 ? td.substring( iTd + 4 ) :
                    iTdEnd >= 0 ? td.substring( 0, iTdEnd ) : td;
                const w = t ? ctx.measureText( t ).width : 0;
                return { t, w };
            } );
        } );

        const left = Math.max( info.list[0][0].w, info.list[2][0].w ) + 32;
        const right = Math.max( info.list[0][2].w, info.list[2][2].w ) + 32;
        const fontSize = info.font.match( /\d+/ );

        info.width = left + right;
        info.height = Math.max( 32, fontSize * 1.3 * 2 );
        info.ref = left;
        return info;
    }

    return null;
}

/**
 * Convert SVG string to symbols
 * @param {String} svg - the SVG string
 * @returns {String} symbols separated by space
 */
function svgToSymbols( svg ) {
    const ids = svg.match( /id="\w+"/g );
    const syms = ids ? ids.map( ( s ) => s.substring( 4, s.length - 1 ) ) : [];
    return syms.join( ' ' );
}

/**
 * Draw Weld
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geometry} geom The geometry
 * @param {String} fillHtml The fill html
 * @param {ViewParam} viewParam The view param
 */
function drawWeld( ctx, geom, fillHtml, viewParam ) {
    ctx.beginPath();

    const dx = geom.endPt.x - geom.startPt.x;
    const dy = geom.endPt.y - geom.startPt.y;
    const n = dx > 0 && dy > 0 ? 0 : dx < 0 && dy > 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
    const x0 = geom.startPt.x + ( n % 2 ? dx / 2 : 0 );
    const y0 = geom.startPt.y + ( n % 2 ? 0 : dy / 2 );
    const x1 = geom.startPt.x + ( n % 2 ? dx / 2 : dx );
    const y1 = geom.startPt.y + ( n % 2 ? dy : dy / 2 );

    const info = calcWeldInfo( ctx, fillHtml );
    if( info && info.list && info.list.length > 0 ) {
        const scale = Math.abs( n % 2 ? dy : dx ) / info.width;
        const lineWidth = calcLineWidth( geom, viewParam );
        const lineColor = geom.stroke && geom.stroke.color ? markupColor.fromHex( geom.stroke.color ) : 'black';

        ctx.save();
        ctx.translate( x0, y0 );
        ctx.scale( scale, scale );
        ctx.rotate( n * angleRight );
        ctx.beginPath();

        ctx.font = info.font;
        ctx.textBaseline = 'top';
        ctx.fillStyle = lineColor;
        ctx.strokeStyle = lineColor;
        ctx.lineCap = 'square';
        ctx.lineWidth = lineWidth / scale;
        ctx.moveTo( 0, 0 );
        ctx.lineTo( info.width, 0 );
        ctx.stroke();

        // draw symbols at center, and texts around it
        ctx.save();
        ctx.translate( info.ref, 0 );
        const syms = info.list[1][0].t.split( /\s+/ );
        syms.forEach( ( sym ) => {
            if( !isEndSymbol( sym ) ) {
                const path = new Path2D( pathd[ sym ] );
                if( sym === '_meltthru' ) {
                    ctx.fill( path );
                } else {
                    ctx.stroke( path );
                }
            }
        } );

        for( let i = 0; i <= 2; i += 2 ) {
            for( let j = 0; j <= 2; j++ ) {
                const text = info.list[i][j];
                if( text.w > 0 ) {
                    let x = j === 0 ? -text.w - 16 : j === 2 ? 16 : -text.w / 2;
                    let y = i === 0 ? 4 - info.height / 2 : 4;
                    if( j === 1 ) {
                        y += i === 0 ? -12 : 12;
                    }
                    ctx.fillText( text.t, x, y );
                }
            }
        }
        ctx.restore();

        // draw symbols at start
        const lastPt = geom.vertices ? geom.vertices[ geom.vertices.length - 1 ] : null;
        const startOnLeft = !lastPt || ( n % 2 ? lastPt.y === geom.startPt.y : lastPt.x === geom.startPt.x );

        ctx.save();
        if( !startOnLeft ) {
            ctx.translate( info.width, 0 );
        }

        if( syms.indexOf( 'around' ) >= 0 ) {
            ctx.stroke( new Path2D( pathd.around ) );
        }

        if( syms.indexOf( 'field' ) >= 0 ) {
            ctx.fill( new Path2D( pathd[ startOnLeft ? 'field' : '_field'] ) );
            ctx.moveTo( 0, 0 );
            ctx.lineTo( 0, -14.5 );
            ctx.stroke();
        }
        ctx.restore();

        // draw tail symbol and text
        const tail = info.list[1][1];
        if( syms.indexOf( 'tail' ) >= 0 || tail.t ) {
            ctx.save();
            if( startOnLeft ) {
                ctx.translate( info.width, 0 );
            }

            if( syms.indexOf( 'tail' ) >= 0 ) {
                ctx.stroke( new Path2D( pathd[ startOnLeft ? 'tail' : '_tail' ] ) );
            }

            if( tail.t ) {
                const x = startOnLeft ? 16 : -16 - tail.w;
                ctx.fillText( tail.t, x, 3 - info.height / 4 );
            }
            ctx.restore();
        }

        ctx.restore();
    } else {
        ctx.moveTo( x0, y0 );
        ctx.lineTo( x1, y1 );
    }

    // draw optional leader lines
    if( geom.vertices ) {
        ctx.moveTo( geom.vertices[ 0 ].x, geom.vertices[ 0 ].y );
        for( var i = 1; i < geom.vertices.length; i++ ) {
            ctx.lineTo( geom.vertices[ i ].x, geom.vertices[ i ].y );
        }
    }
}

const isEndSymbol = sym => {
    return sym === 'around' || sym === 'field' || sym === 'tail';
};

const pathd = {
    fillet: 'M-6,0 v12 l12,-12',
    _fillet: 'M-6,0 v-12 l12,12',
    plug: 'M-8,0 v8 h16 v-8',
    _plug: 'M-8,0 v-8 h16 v8',
    spot: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    _spot: 'M-6,-6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    __spot: 'M-6,0 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    stud: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m2,-4 l8,8 m0,-8 l-8,8',
    backing: 'M-6,0 a6,6 0 0 0 12,0',
    _backing: 'M-6,0 a6,6 0 0 1 12,0',
    seam: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    _seam: 'M-6,-6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    __seam: 'M-6,0 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    surfacing: 'M-10,0 a5,5 0 0 0 10,0 a5,5 0 0 0 10,0',
    edge: 'M-8,0 v10 h16 v-10 M0,0 v10',
    _edge: 'M-8,0 v-10 h16 v10 M0,0 v-10',
    square: 'M-3,0 v12 M3,0 v12',
    _square: 'M-3,0 v-12 M3,0 v-12',
    vgroove: 'M-8,8 l8,-8 l8,8',
    _vgroove: 'M-8,-8 l8,8 l8,-8',
    bevel: 'M-4,9 v-9 l8,8',
    _bevel: 'M-4,-9 v9 l8,-8',
    ugroove: 'M0,0 v6 m-6,6 a6,6 0 0 1 12,0',
    _ugroove: 'M0,0 v-6 m-6,-6 a6,6 0 0 0 12,0',
    jgroove: 'M-3,0 v12 m0,-6 a6,6 0 0 1 6,6',
    _jgroove: 'M-3,0 v-12 m0,6 a6,6 0 0 0 6,-6',
    flarev: 'M-3,0 a8,8 0 0 1 -8,8 M3,0 a8,8 0 0 0 8,8',
    _flarev: 'M-3,0 a8,8 0 0 0 -8,-8 M3,0 a8,8 0 0 1 8,-8',
    flarebeval: 'M-3,0 v9 M3,0 a8,8 0 0 0 8,8',
    _flarebeval: 'M-3,0 v-9 M3,0 a8,8 0 0 1 8,-8',
    scarf: 'M-3,0 l-6,12 M3,0 l-6,12',
    _scarf: 'M-3,0 l6,-12 M3,0 l6,-12',
    around: 'M-5,0 a5,5 0 0 0 10,0 a5,5 0 0 0 -10,0',
    field: 'M0,-15 v15 v-7 l10,-4Z',
    _field: 'M0,-15 v15 v-7 l-10,-4Z',
    tail: 'M12,-12 l-12,12 l12,12',
    _tail: 'M-12,-12 l12,12 l-12,12',
    _meltthru: 'M-6,0 a6,6 0 0 1 12,0',
    _insert: 'M-6,0 v-12 h12 v12',
    _flush: 'M-8,-8 h16',
    _convex: 'M-8,-8 a12,12 0 0 1 16,0',
    _concave: 'M-8,-10 a12,12 0 0 0 16,0'
};

/**
 * Calculate the Leader lines info in screen coordinates
 *
 * @param {Context} ctx The canvas 2d context
 * @param {String} fillHtml The fill html
 *
 * @returns {Object} the info in screen coordinates
 *    e.g. { font: "12px sans-serif", width: 40, height: 10, list }
 *    where list e.g. [ 'text1', 'text2' ]
 */
function calcLeaderInfo( ctx, fillHtml ) {
    if( ctx && fillHtml ) {
        let info = {};
        const font = fillHtml.match( /font:[^;]*;/ );
        info.font = font ? font[0].substring( 5, font[0].length - 1 ) : '12px sans-serif';
        ctx.font = info.font;

        info.list = fillHtml.replace( /^<div>/, '' ).replace( /<\/div>$/, '' ).split( '</div><div>' );

        const fontSize = info.font.match( /\d+/ );
        info.height = Math.max( 10, fontSize * 1.3 * info.list.length );

        info.width = 0;
        info.list.forEach( ( t ) => {
            const w = ctx.measureText( t ).width;
            info.width = Math.max( info.width, w );
        } );
        info.width += 20;

        return info;
    }

    return null;
}

/**
 * Draw Leader lines
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geometry} geom The geometry
 * @param {String} fillHtml The fill html
 * @param {ViewParam} viewParam The view param
 */
function drawLeader( ctx, geom, fillHtml, viewParam ) {
    ctx.beginPath();

    const dx = geom.endPt.x - geom.startPt.x;
    const dy = geom.endPt.y - geom.startPt.y;
    const n = dx > 0 && dy > 0 ? 0 : dx < 0 && dy > 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
    const x0 = geom.startPt.x + ( n % 2 ? dx / 2 : 0 );
    const y0 = geom.startPt.y + ( n % 2 ? 0 : dy / 2 );
    const x1 = geom.startPt.x + ( n % 2 ? dx / 2 : dx );
    const y1 = geom.startPt.y + ( n % 2 ? dy : dy / 2 );

    const tol = 0.001;
    const lastPt = geom.vertices[ geom.vertices.length - 1 ];
    const lastAt0 = Math.abs( lastPt.x - x0 ) + Math.abs( lastPt.y - y0 ) < tol;
    const lastAt1 = Math.abs( lastPt.x - x1 ) + Math.abs( lastPt.y - y1 ) < tol;

    const info = calcLeaderInfo( ctx, fillHtml );
    if( info && info.list && info.list.length > 0 ) {
        const scale = Math.abs( n % 2 ? dy : dx ) / info.width;
        const lineWidth = calcLineWidth( geom, viewParam );
        const lineColor = geom.stroke && geom.stroke.color ? markupColor.fromHex( geom.stroke.color ) : 'black';

        ctx.save();
        ctx.translate( x0, y0 );
        ctx.scale( scale, scale );
        ctx.rotate( n * angleRight );
        ctx.beginPath();

        ctx.font = info.font;
        ctx.textBaseline = 'top';
        ctx.fillStyle = lineColor;
        ctx.strokeStyle = lineColor;
        ctx.lineCap = 'square';
        ctx.lineWidth = lineWidth / scale;

        let x = lastAt0 ? 20 : lastAt1 ? 0 : 10;
        let y = 2 - info.height / 2;
        const h = info.height / info.list.length;

        for( let i = 0; i < info.list.length; i++, y += h ) {
            ctx.fillText( info.list[i], x, y );
        }

        if( lastAt0 ) {
            ctx.moveTo( 0, 0 );
            ctx.lineTo( 15, 0 );
        } else if( lastAt1 ) {
            ctx.moveTo( info.width, 0 );
            ctx.lineTo( info.width - 15, 0 );
        } else {
            ctx.moveTo( 0, info.height / 2 );
            ctx.lineTo( info.width, info.height / 2 );
        }

        ctx.restore();
    } else {
        let dx0 = lastAt0 || lastAt1 ? 0 : n % 2 ? dx / 2 : 0;
        let dy0 = lastAt0 || lastAt1 ? 0 : n % 2 ? 0 : dy / 2;

        ctx.moveTo( x0 + dx0, y0 + dy0 );
        ctx.lineTo( x1 + dx0, y1 + dy0 );
    }

    // draw leader lines
    if( geom.vertices ) {
        ctx.moveTo( geom.vertices[ 0 ].x, geom.vertices[ 0 ].y );
        for( var i = 1; i < geom.vertices.length; i++ ) {
            ctx.lineTo( geom.vertices[ i ].x, geom.vertices[ i ].y );
        }
    }
}

/**
 * Calculate the Symbol info in screen coordinates
 *
 * @param {Context} ctx The canvas 2d context
 * @param {String} fillHtml The fill html
 *
 * @returns {Object} the info
 *    e.g. { font: "12px sans-serif", width: 32, height: 32 }
 */
function calcSymbolInfo( ctx, fillHtml ) {
    if( ctx && fillHtml ) {
        let info = {};

        const head = fillHtml.match( /<svg[^>]*>/ );
        if( head ) {
            const width = head[0].match( /width="([0-9.]+)"/ );
            const height = head[0].match( /height="([0-9.]+)"/ );
            const viewBox = head[0].match( /viewBox="([0-9. ,]+)"/ );

            if( width && height ) {
                info.width = width[1];
                info.height = height[1];
            } else if( viewBox ) {
                const v = viewBox[1].split( /[ ,]+/ );
                info.width = v[2] - v[0];
                info.height = v[3] - v[1];
            }
        }

        return info;
    }

    return null;
}

/**
 * Draw Symbol
 *
 * @param {Context} ctx The canvas 2d context
 * @param {Geometry} geom The geometry
 * @param {String} fillHtml The fill html
 * @param {ViewParam} viewParam The view param
 */
function drawSymbol( ctx, geom, fillHtml, viewParam ) {
    ctx.beginPath();

    const info = calcSymbolInfo( ctx, fillHtml );
    if( info && geom.fillImage ) {
        const dx = geom.endPt.x - geom.startPt.x;
        const dy = geom.endPt.y - geom.startPt.y;
        const n = dx > 0 && dy > 0 ? 0 : dx < 0 && dy > 0 ? 1 : dx < 0 && dy < 0 ? 2 : 3;
        const scale = Math.abs( n % 2 ? dy : dx ) / info.width;

        ctx.save();
        ctx.translate( geom.startPt.x, geom.startPt.y );
        ctx.scale( scale, scale );
        ctx.rotate( n * angleRight );
        ctx.drawImage( geom.fillImage, 0, 0 );
        ctx.restore();
    }

    ctx.moveTo( geom.startPt.x, geom.startPt.y );
    ctx.lineTo( geom.startPt.x, geom.endPt.y );
    ctx.lineTo( geom.endPt.x, geom.endPt.y );
    ctx.lineTo( geom.endPt.x, geom.startPt.y );
    ctx.lineTo( geom.startPt.x, geom.startPt.y );
    ctx.closePath();
}

export default exports = {
    drawGeom,
    updateGdntSize,
    updateWeldSize,
    updateLeaderSize,
    updateSymbolSize
};
