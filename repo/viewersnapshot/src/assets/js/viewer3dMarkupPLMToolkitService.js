// Copyright (c) 2022 Siemens

/**
 * Note: This module controls user adding On Screen 3D markups.
 *
 * @module js/viewer3dMarkupPLMToolkitService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import preferenceService from 'soa/preferenceService';
import viewerContextService from 'js/viewerContext.service';
import logger from 'js/logger';

var exports = {};

const DEFAULT_STYLE = 'solid';
const DEFAULT_COLOR  = '#000000';
const DEFAULT_WIDTH  = '1';
const DEFAULT_POINT_SIZE = '12';
const DEFAULT_OPACITY = '0';
const DEFAULT_END_POINT = 'none';

const DEFAULT_FONT_NAME = 'georgia';
const DEFAULT_FONT_SIZE  = '16pt';
const DEFAULT_FONT_STYLE = 'normal';
const DEFAULT_FONT_WEIGHT = 'normal';
const DEFAULT_TEXT_CONTAINER  = 'rect';
const DEFAULT_MARKUP_MODE = 'select';
const DEFAULT_ANCHOR_MODE  = 'disabled';
const DEFAULT_TEXT_DECORATOR = 'none';

const DEFAULT_LEADERLINE_STYLE = 'solid';
const DEFAULT_LEADERLINE_COLOR = '#000000';
const DEFAULT_LEADERLINE_WIDTH = '3';

const AWV03dMarkupPreferences = 'AWV03dMarkupPreferences';

var initValues = null;


//-----------------------------------------------------------------------------
/**
 * Subscribe to the events that are of interest while in the snapshot markup context, such as button presses
 * that take the user out of the context of creating a markup for snapshot, opening/closing side panels and
 * window resize.
 * On receipt of these events, the context and markup system may need to be cleaned up.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 */
function addHandlersForImportantEvents( vmo, viewerContextData ) {
    if ( viewerContextData && viewerContextData.get3DMarkupManager() ) { // ask to be notified that we should close 3d markup
        viewerContextData.get3DMarkupManager().add3dMarkupToolbarCloseListener( cleanup3dToolbarListener );
    }
}


//-----------------------------------------------------------------------------
/**
 * While in the snapshot markup context we're interested in certain events.
 * This function removes the handlers that we registered.
 * @param {Object} viewerContextData viewer context data
 */
function removeHandlersForImportantEvents( viewerContextData ) {
    if ( viewerContextData && viewerContextData.get3DMarkupManager() ) {
        viewerContextData.get3DMarkupManager().remove3dMarkupToolbarCloseListener( cleanup3dToolbarListener );
    }
}

//-----------------------------------------------------------------------------
/**
 * The onScreen3dMarkupContext is responsible for holding the state related to markup including
 * the tool in use, panels opened or closed, etc.
 *
 * @param { ViewModelObject } vmo - the viewModelObject
 * @param { String } viewerType - this viewer type: 'aw-onscreen-3d-markup-viewer'
 */
function registerOnScreen3dMarkupContext( vmo, viewerType ) {
    var viewerCtx = appCtxSvc.getCtx( 'viewerContext' );

    if( viewerCtx ) {
        viewerCtx.vmo = vmo;
        viewerCtx.type = viewerType;
        appCtxSvc.updateCtx( 'viewerContext', viewerCtx );
    } else {
        appCtxSvc.registerCtx( 'viewerContext', { vmo: vmo, type: viewerType } );
    }
}

//-----------------------------------------------------------------------------
/** Register the onScreen3dMarkupContext with the application context service.
 *
*/
function unRegisterOnScreen3dMarkupContext() {
    appCtxSvc.unRegisterCtx( 'viewerContext' );
}

//-----------------------------------------------------------------------------
/** Get the onScreen3dMarkupContext from the application context service.
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} onScreen3dMarkupContext object from viewer atomic data
*/
function  getOnScreen3dMarkupContext( viewerContextData ) {
    if( viewerContextData ) {
        return viewerContextData.getValueOnViewerAtomicData( 'onScreen3dMarkupContext' );
    }
    return null;
}

/**
 * update 3d markup context
 * @param {Object} viewerContextData viewer context data
 * @param {String} path property path
 * @param {Object/String} value property value
 */
function updateOnScreen3dMarkupContext( viewerContextData, path, value ) {
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( path, value );
    }
}

/**
* Notification that 3d Markup toolbar should be closed
* @param {Object} viewerContextData viewer context data
*/
function cleanup3dToolbarListener( viewerContextData ) {
    unRegisterOnScreen3dMarkupContext();
    removeHandlersForImportantEvents( viewerContextData );
}

/**
* Utility function to parse the properties from the database into an array
* of keys and an array of values
* @param {String} props viewer context data
* @returns {String} key value pairs of markup properties
*/
function parseProperties( props ) {
    let keysArr = [];
    let valuesArr = [];

    var pair;

    for ( var i = 0; i < props.length; i++ ) {
        if ( props[i] !== null && props[i] !== undefined ) {
            pair = props[i].split( '=' );
            if ( pair.length > 1 ) {
                keysArr.push( pair[0].replace( /\s+/g, '' ).toLowerCase() );
                valuesArr.push( pair[1].replace( /\s+/g, '' ).toLowerCase() );
            }
        }
    }

    return {
        keys: keysArr,
        values: valuesArr
    };
}


/**
* This will setup a data object that will be used to pass properties to the
* edit property panel and assists to initializes the PLM toolkit
* @param {Object} propertyPairs viewer context data
* @returns {Object} markup properties
*/
function parsePropertyPairs( propertyPairs ) {
    var lineStyle = { dbValue:DEFAULT_STYLE };
    var lineColor = { dbValue:DEFAULT_COLOR };
    var lineWidth = { dbValue:DEFAULT_WIDTH };
    var lineStartEndPointWidthSize = { dbValue:DEFAULT_POINT_SIZE };
    var lineStartEndPointHeightSize = { dbValue:DEFAULT_POINT_SIZE };
    var lineEndEndPointWidthSize = { dbValue:DEFAULT_POINT_SIZE };
    var lineEndEndPointHeightSize = { dbValue:DEFAULT_POINT_SIZE };

    var startEndpoint = { dbValue:DEFAULT_END_POINT };
    var endEndpoint = { dbValue:DEFAULT_END_POINT };

    var edgeStyle = { dbValue:DEFAULT_STYLE };
    var edgeColor = { dbValue:DEFAULT_COLOR };
    var edgeWidth = { dbValue:DEFAULT_WIDTH };

    var fillStyle = { dbValue:DEFAULT_STYLE };
    var fillColor = { dbValue:DEFAULT_COLOR };
    var fillOpacity = { dbValue:DEFAULT_OPACITY };

    var fontName = { dbValue:DEFAULT_FONT_NAME };
    var fontSize = { dbValue:DEFAULT_FONT_SIZE };
    var fontColor = { dbValue:DEFAULT_COLOR };
    var fontStyle = { dbValue:DEFAULT_FONT_STYLE };
    var fontWeight = { dbValue:DEFAULT_FONT_WEIGHT };
    var textContainer = { dbValue:DEFAULT_TEXT_CONTAINER };
    var textDecorator =  { dbValue:DEFAULT_TEXT_DECORATOR };
    var markupMode = { dbValue:DEFAULT_MARKUP_MODE };
    var anchorMode = { dbValue:DEFAULT_ANCHOR_MODE };

    var leaderLineStyle = { dbValue:DEFAULT_LEADERLINE_STYLE };
    var leaderLineColor = { dbValue:DEFAULT_LEADERLINE_COLOR };
    var leaderLineWidth = { dbValue:DEFAULT_LEADERLINE_WIDTH };

    let data = {

        lineStyle,
        lineColor,
        lineWidth,
        startEndpoint,
        endEndpoint,
        lineStartEndPointWidthSize,
        lineStartEndPointHeightSize,
        lineEndEndPointWidthSize,
        lineEndEndPointHeightSize,
        edgeStyle,
        edgeColor,
        edgeWidth,
        fillStyle,
        fillColor,
        fillOpacity,
        fontName,
        fontSize,
        fontStyle,
        fontWeight,
        fontColor,
        textContainer,
        markupMode,
        anchorMode,
        textDecorator,
        leaderLineStyle,
        leaderLineColor,
        leaderLineWidth

    };

    // Process the properties returned from the database
    for ( var i = 0; i < propertyPairs.keys.length; i++ ) {
        switch ( propertyPairs.keys[i] ) {
            case 'linecolor':
                data.lineColor.dbValue = propertyPairs.values[i];
                break;
            case 'linewidth':
                data.lineWidth.dbValue = propertyPairs.values[i];
                break;
            case 'linestyle':
                data.lineStyle.dbValue  = propertyPairs.values[i];
                break;
            //case 'linestartarrow':
            //    data.startArrow.dbValue = propertyPairs.values[i];
            //    break;
                // case 'lineendarrow':
                // data.endArrow.dbValue = propertyPairs.values[i];
                //  break;
            case 'startendpoint':
                data.startEndpoint.dbValue = propertyPairs.values[i];
                break;
            case 'endendpoint':
                data.endEndpoint.dbValue = propertyPairs.values[i];
                break;
            case 'linestartendpointwidthsize':
                data.lineStartEndPointWidthSize.dbValue = propertyPairs.values[i];
                break;
            case 'linestartendpointheightsize':
                data.lineStartEndPointHeightSize.dbValue = propertyPairs.values[i];
                break;
            case 'lineendendpointwidthsize':
                data.lineEndEndPointWidthSize.dbValue = propertyPairs.values[i];
                break;
            case 'lineendendpointheightsize':
                data.lineEndEndPointHeightSize.dbValue = propertyPairs.values[i];
                break;
            case 'edgecolor':
                data.edgeColor.dbValue = propertyPairs.values[i];
                break;
            case 'edgewidth':
                data.edgeWidth.dbValue = propertyPairs.values[i];
                break;
            case 'edgestyle':
                data.edgeStyle.dbValue = propertyPairs.values[i];
                break;

            case 'fillcolor':
                data.fillColor.dbValue = propertyPairs.values[i];
                break;
            case 'fillstyle':
                data.fillStyle.dbValue = propertyPairs.values[i];
                break;
            case 'fillopacity':
                data.fillOpacity.dbValue = propertyPairs.values[i];
                break;

            case 'fontcolor':
                data.fontColor.dbValue = propertyPairs.values[i];
                break;
            case 'fontname':
                data.fontName.dbValue = propertyPairs.values[i];
                break;
            case 'fontsize':
                data.fontSize.dbValue = propertyPairs.values[i];
                break;
            case 'fontstyle':
                data.fontStyle.dbValue = propertyPairs.values[i];
                break;
            case 'fontweight':
                data.fontWeight.dbValue = propertyPairs.values[i];
                break;
            case 'textcontainer':
                data.textContainer.dbValue = propertyPairs.values[i];
                break;
            case 'textdecorator':
                data.textDecorator.dbValue = propertyPairs.values[i];
                break;
            case 'markupmode':
                data.markupMode.dbValue = propertyPairs.values[i];
                break;
            case 'anchormode':
                data.anchorMode.dbValue = propertyPairs.values[i];
                break;
            case 'leaderlinestyle':
                data.leaderLineStyle.dbValue = propertyPairs.values[i];
                break;
            case 'leaderlinecolor':
                data.leaderLineColor.dbValue = propertyPairs.values[i];
                break;
            case 'leaderlinewidth':
                data.leaderLineWidth.dbValue = propertyPairs.values[i];
                break;
            default:
                break;
        }
    }


    return data;
}
//-----------------------------------------------------------------------------
// Exported markup functions
//-----------------------------------------------------------------------------


//-----------------------------------------------------------------------------
/**
 * Entry point for the 3dOnScreen markup toolbar and context.
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 */
export let onScreen3dStartMarkupPVW = function( vmo, viewerContextData ) {
    if( !vmo || !viewerContextData ) {
        return;
    }


    if( viewerContextData.getValueOnViewerAtomicData( 'renderLocation' ) === 'SSR' ) {
        return;
    }

    const viewerType = 'aw-onscreen-3d-markup-viewer';
    let  onScreen3dMarkupContext = getOnScreen3dMarkupContext( viewerContextData );
    onScreen3dMarkupContext.display3dMarkupToolbar = !onScreen3dMarkupContext.display3dMarkupToolbar;
    updateOnScreen3dMarkupContext( viewerContextData, 'onScreen3dMarkupContext', onScreen3dMarkupContext );

    if( onScreen3dMarkupContext.display3dMarkupToolbar ) {
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_CREATE_MARKUP_BEGIN );

        try {
            if( viewerContextData.get3DMarkupManager() ) {
                initValues = viewerContextData.get3DMarkupManager().getAfxPVWInitializationValues();
            }
        } catch ( ex ) {
            logger.error( 'Viewer3dMarkupPLMToolkitService: Setting mode to enabled failed: ' + ex );
        }


        try {
            registerOnScreen3dMarkupContext( vmo, viewerType );
            addHandlersForImportantEvents( vmo, viewerContextData );
        } catch ( ex ) {
            logger.error( 'Viewer3dMarkupPLMToolkitService: Setting properties on initialization failed: ' + ex );
        }
    } else {
        try {
            if( viewerContextData.get3DMarkupManager() ) {
                viewerContextData.get3DMarkupManager().setPLMVisMode( window.JSCom.Consts.MarkupMode.SELECT );
            }
        } catch ( ex ) {
            logger.error( 'Viewer3dMarkupPLMToolkitService: Setting mode to select failed: ' + ex );
        }
        unRegisterOnScreen3dMarkupContext();
        removeHandlersForImportantEvents( viewerContextData );
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_CREATE_MARKUP_END );
    }

    viewerContextService.setDefaultActionNavigation( viewerContextData );
};


let convertToFillStyle = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'solid':
            value = 'Solid';
            break;
        case 'backwardsdiagonal':
            value = 'BackwardsDiagonal';
            break;
        case 'cross':
            value = 'Cross';
            break;
        case 'diagonalcross':
            value = 'DiagonalCross';
            break;
        case 'forwarddiagonal':
            value = 'ForwardCross';
            break;
        case 'horizontal':
            value = 'Horizontal';
            break;
        case 'vertical':
            value = 'Vertical';
            break;
        default:
            value = 'Solid';
            break;
    }

    return value;
};

let convertToLineEdgeStyle = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'solid':
            value = 'Solid';
            break;
        case 'dot':
            value = 'Dot';
            break;
        case 'dash':
            value = 'Dash';
            break;
        case 'dashdot':
            value = 'DashDot';
            break;
        case 'dashdotdot':
            value = 'DashDotDot';
            break;
        case 'longdash':
            value = 'LongDash';
            break;
        case 'longdashdot':
            value = 'LongDashDot';
            break;
        case 'longdashdoubledot':
            value = 'LongDashDoubleDot';
            break;
        case 'longdashtripledot':
            value = 'LongDashTripleDot';
            break;
        case 'longdashdoubleshortdash':
            value = 'LongDashDoubleShortDash';
            break;
        default:
            value = 'Solid';
    }

    return value;
};

let convertToEndStartPointStyle = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'arrow':
            value = 'Arrow';
            break;
        case 'circle':
            value = 'Circle';
            break;
        case 'cross':
            value = 'Cross';
            break;
        case 'fillarrow':
            value = 'FillArrow';
            break;
        case 'fillcircle':
            value = 'FillCircle';
            break;
        case 'fillplunger':
            value = 'FillPlunger';
            break;
        case 'none':
            value = 'None';
            break;
        case 'plunger':
            value = 'Plunger';
            break;
        default:
            value = 'None';
    }

    return value;
};

let convertToFontStyle = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'normal':
            value = 'Normal';
            break;
        case 'italic':
            value = 'Italic';
            break;
        default:
            value = 'Normal';
    }

    return value;
};

let convertToFontWeight = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'normal':
            value = 'Normal';
            break;
        case 'bold':
            value = 'Bold';
            break;
        default:
            value = 'Normal';
    }

    return value;
};

let convertTextContainer = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'circle':
            value = 'Circle';
            break;
        case 'ellipse':
            value = 'Ellipse';
            break;
        case 'none':
            value = 'None';
            break;
        case 'rect':
            value = 'Rect';
            break;
        default:
            value = 'Rect';
    }

    return value;
};

let convertTextDecorator = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'none':
            value = 'None';
            break;
        case 'strikeout':
            value = 'Strikeout';
            break;
        case 'underline':
            value = 'Underline';
            break;
        case 'underlinestrikeout':
            value = 'UnderlineStrikeout';
            break;
        default:
            value = 'None';
    }

    return value;
};

let convertTextFontName = ( data ) => {
    let value = null;

    switch ( data ) {
        case 'arial':
            value = 'Arial';
            break;
        case 'couriernew':
            value = 'Courier New';
            break;
        case 'georgia':
            value = 'Georgia';
            break;
        case 'lucidasansunicode':
            value = 'Lucida Sans Unicode';
            break;
        case 'tahoma':
            value = 'Tahoma';
            break;
        case 'timesnewroman':
            value = 'Times New Roman';
            break;
        case 'trebuchetms':
            value = 'Trebuchet MS';
            break;
        case 'verdana':
            value = 'Verdana';
            break;
        default:
            value = 'Courier New';
    }

    return value;
};


let updatePreferences = ( input ) => {
    var updatedValues = [];

    if ( input === null || input === undefined ) {
        return;
    }

    updatedValues.push( 'linecolor' + '=' + input.lineColor );
    updatedValues.push( 'linestyle' + '=' + input.lineStyle );
    updatedValues.push( 'linewidth' + '=' + input.lineWidth );
    updatedValues.push( 'startendpoint' + '=' + input.startEndpoint );
    updatedValues.push( 'endendpoint' + '=' + input.endEndpoint );

    updatedValues.push( 'linestartendpointwidthsize' + '=' + input.lineStartEndPointWidthSize );
    updatedValues.push( 'linestartendpointheightsize' + '=' + input.lineStartEndPointHeightSize );
    updatedValues.push( 'lineendendpointwidthsize' + '=' + input.lineEndEndPointWidthSize );
    updatedValues.push( 'lineendendpointheightsize' + '=' + input.lineEndEndPointHeightSize );

    updatedValues.push( 'edgecolor' + '=' + input.edgeColor );
    updatedValues.push( 'edgestyle' + '=' + input.edgeStyle );
    updatedValues.push( 'edgewidth' + '=' + input.edgeWidth );

    updatedValues.push( 'fillcolor' + '=' + input.fillColor );
    updatedValues.push( 'fillopacity' + '=' + input.fillOpacity );
    updatedValues.push( 'fillstyle' + '=' + input.fillStyle );

    updatedValues.push( 'fontcolor' + '=' + input.fontColor );
    updatedValues.push( 'fontname' + '=' + input.fontName );
    updatedValues.push( 'fontsize' + '=' + input.fontSize );
    updatedValues.push( 'fontstyle' + '=' + input.fontStyle );
    updatedValues.push( 'fontweight' + '=' + input.fontWeight );
    updatedValues.push( 'textcontainer' + '=' + input.textContainer );
    updatedValues.push( 'textdecorator' + '=' + input.textDecorator );

    updatedValues.push( 'markupmode' + '=' + input.markupMode );
    updatedValues.push( 'anchormode' + '=' + input.anchorMode );

    updatedValues.push( 'leaderlinestyle' + '=' + input.leaderLineStyle );
    updatedValues.push( 'leaderlinecolor' + '=' + input.leaderLineColor );
    updatedValues.push( 'leaderlinewidth' + '=' + input.leaderLineWidth );


    preferenceService.setStringValue( AWV03dMarkupPreferences, updatedValues );
};

/**
 * Initialize markup component
 * @param {Object} input markup preferences
 * @returns {Object} object which contains PLMVisWeb handle and PLMVisWeb viewer instance created in JSCOM
 */
let initializeMarkup = ( input ) => {
    try {
        let viewer = initValues.viewer;
        let PLMVisWeb = initValues.PLMVisWeb;

        // get the stored markup properties from teamcenter
        var threeDPreferences = preferenceService.getLoadedPrefs().AWV03dMarkupPreferences;
        let propertyPairs = [];
        if( threeDPreferences ) {
            propertyPairs = parseProperties( threeDPreferences );
        }

        let props = parsePropertyPairs( propertyPairs );

        let newInput = { ...input.getValue() };
        newInput.lineStyle = convertToLineEdgeStyle( props.lineStyle.dbValue );
        newInput.lineColor = props.lineColor.dbValue;
        newInput.lineWidth = props.lineWidth.dbValue;
        newInput.startEndpoint = convertToEndStartPointStyle( props.startEndpoint.dbValue );
        newInput.endEndpoint = convertToEndStartPointStyle( props.endEndpoint.dbValue );

        newInput.lineStartEndPointWidthSize = props.lineStartEndPointWidthSize.dbValue;
        newInput.lineStartEndPointHeightSize = props.lineStartEndPointHeightSize.dbValue;
        newInput.lineEndEndPointWidthSize = props.lineEndEndPointWidthSize.dbValue;
        newInput.lineEndEndPointHeightSize = props.lineEndEndPointHeightSize.dbValue;

        newInput.edgeColor = props.edgeColor.dbValue;
        newInput.edgeStyle = convertToLineEdgeStyle( props.edgeStyle.dbValue );
        newInput.edgeWidth = props.edgeWidth.dbValue;

        newInput.fillStyle = convertToFillStyle( props.fillStyle.dbValue );
        newInput.fillColor = props.fillColor.dbValue;
        newInput.fillOpacity = props.fillOpacity.dbValue;

        newInput.fontColor = props.fontColor.dbValue;
        newInput.fontName = convertTextFontName( props.fontName.dbValue );
        newInput.fontSize = props.fontSize.dbValue;
        newInput.fontStyle = convertToFontStyle( props.fontStyle.dbValue );
        newInput.fontWeight = convertToFontWeight( props.fontWeight.dbValue );
        newInput.textContainer = convertTextContainer( props.textContainer.dbValue );
        newInput.textDecorator = convertTextDecorator( props.textDecorator.dbValue );
        // these 2 properties help set the toolbar buttons to the last used state
        newInput.markupMode = props.markupMode.dbValue;
        newInput.anchorMode = props.anchorMode.dbValue;

        newInput.leaderLineStyle = convertToLineEdgeStyle (props.leaderLineStyle.dbValue);
        newInput.leaderLineColor = props.leaderLineColor.dbValue;
        newInput.leaderLineWidth = props.leaderLineWidth.dbValue;


        input.update( newInput ); // send the initial properties back to plmVisWeb

        return {
            viewer,
            PLMVisWeb
        };
    } catch ( ex ) {
        logger.error( 'Viewer3dMarkupPLMToolkitService: Setting init values failed: ' + ex );
    }
};


//-----------------------------------------------------------------------------

export default exports = {
    onScreen3dStartMarkupPVW,
    updatePreferences,
    initializeMarkup

};
