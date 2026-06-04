// Copyright (c) 2021 Siemens

/* global JSCom */

/**
 * Defines {@link NgServices.viewerPreferenceService} which provides utility functions to work with viewer preferneces
 *
 * @module js/viewerPreference.service
 */
import preferenceService from 'soa/preferenceService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import logger from 'js/logger';
import '@swf/ClientViewer';
import appCtxService from 'js/appCtxService';
import viewerOrientationService from 'js/viewerOrientationService';
import eventBus from 'js/eventBus';
// import 'manipulator';

/**
 * NavigationMode's server preference String
 */
var NAVIGATION_MODE = 'AWC_visNavigationMode';

/**
 * FloorVisiblity's server preference String
 */
var FLOOR_VISIBILITY = 'AWC_visFloorOn';

/**
 * FloorOffset's server preference String
 */
var FLOOR_OFFSET = 'AWC_visFloorOffset';

/**
 * Grid's server preference String
 */
var GRID = 'AWC_visGridOn';

/**
 * Shadow's server preference String
 */
var SHADOW = 'AWC_visShadowOn';

/**
 * Reflection's server preference String
 */
var REFLECTION = 'AWC_visReflectionOn';

/**
 * server preference var for apply true shading material.
 */
var APPLYTRUESHADINGMATERIAL = 'AWC_applyTrueShadingMaterial';

/**
 * server preference var for effectivity visibility.
 */
var EFFECTIVITY = 'AWC_visOverlayDisplayEffectivity';

/**
 * server preference var for user affinity when loading assemblies.
 */
var ASSEMBLYUSERAFFINITY = 'AWC_visAssemblyUserAffinity';

/**
 * Preference for occurance type in viewer
 */
var OCCURANCE_TYPE = 'AWC_occuranceType';

/**
 * server preference to show\hide caps and lines in section in viewer
 */
var VIEWER_SHOW_CAPS_AND_LINES = 'AWV0SectionCapsEdgesInitialState';

/**
 * Preference to determine if default model views to be applied when a product is opened for 3D viewing
 */
let VIEWER_APPLY_DEFAULT_MODEL_VIEW = 'AWV0ApplyDefaultModelViewOnOpen';

/**
 * local preference for alternatePCI in viewer
 */
var VIEWER_INDEXED_MODEL = 'AWC_indexedModel';

/**
 * server preference for zoom direction in viewer
 */
var VIEWER_ZOOM_IN = 'AWC_visExamineZoomIn';

/**
 * Reference to open model preferences for viewer
 */
var _openModelPreferences = null;

/**
 * Flag for enable/disable draw preference
 */
var _isDrawingEnabled = true;

/**
 * model unit
 */
var MODEL_UNIT = 'AWC_modelUnit';


/**
 * Render source
 */
var VIEWER_RENDER_OPTION = 'AWV0ViewerRenderOption';

var VIEWER_EXPOSED_BETA = 'AWC_visExposedBetaFeatures';

/**
 * preference to determine how PV should be opened
 */
var PV_OPEN_CONFIG = 'AWC_visProductViewOpenConfiguration';

/**
 * Preference to determine color theme
 */
var VIS_COLOR_SCHEME = 'AWC_visColorScheme';

/**
 * Preference to determine lights intensity factor
 */
var VIS_LIGHTS_INTENSITY_FACTOR = 'AWC_visLightsIntensityFactor';

/**
 * preference for area select limit
 */
var SELECTION_LIMIT = 'AWC_visSelectionLimit';

/**
 * Preference to determine weather PMI is flat or screen
 */
let VIEWER_PMI_OPTION = 'pmiChecked';

/**
 * reference to self
 */
var exports = {};

/**
 * Preference to determine if CSR browser caching is on or off
 */
let VIS_BROWSER_CACHING = 'AWV0VisBrowserCaching';


/**
 * Preference to determine CSR Loading strategy
 */
let VIS_USE_BOM_DELTA_STRUCTURE_UPDATE = 'AWV0UseBOMDeltaForStructureUpdates';

/**
 * Preference to set mouse gesture setting in AW
 */
export const VIS_MOUSE_GESTURE_MAPPING = 'AWV0MouseGestureMapping';
/**
 * server preference to set All On behavior for opening 3D model
 */
export const ALL_ON = 'AWC_visAllOn';
/**
 * display unit
 */
export const DISPLAY_UNIT = 'AWC_3DViewerDisplayUnit';

/**
 * 3DNavigationMode's server preference String
 */
export const THREED_NAVIGATION_MODE_PREF = 'AWC_vis3DNavigationMode';

/**
 * Viewer 3-D Navigation Mode
 */
export const THREED_NAVIGATION_MODE_NAME_MAP = {
    WALK: 'WALK',
    EXAMINE: 'EXAMINE'
};

/**
 * Viewer 3-D Navigation Mode
 */
export const THREED_NAVIGATION_MODE_VALUE_MAP = {
    WALK: 0,
    EXAMINE: 1
};


/**
 * Visualization navigation mode
 */
export const VIS_NAVIGATION_MODE = 'AWC_visNavigationMode';

/**
 * JT File Priority Refsets
 */
export const JT_FILE_PRIORITY_REFSETS = 'JT_File_Priority_Refsets';

/**
 * Preference to set fit type setting in AW
 */
export const VIS_FIT_TYPE = 'AWC_visFitType';

/**
 * Preference to set standard view alignmenet mode
 */
export const VIS_STD_VIEW_ALIGNMENT_MODE = 'AWC_visStandardViewAlignmentMode';

/**
 * ViewOrientationTop's server preference String
 */
export const VIEW_ORIENTATION_TOP = 'AWC_visStdViewOrientationTop';

/**
 * ViewOrientationLeft's server preference String
 */
export const VIEW_ORIENTATION_LEFT = 'AWC_visStdViewOrientationLeft';

/**
 * ViewOrientationFront's server preference String
 */
export const VIEW_ORIENTATION_FRONT = 'AWC_visStdViewOrientationFront';

/**
 * Material's server preference String
 */
export const MATERIAL = 'AWC_visMaterial';

/**
 * FloorOrientation's server preference String
 */
export const FLOOR_ORIENTATION = 'AWC_visFloorPlaneOrientation';

/**
 * server preference for selection behavior in viewer
 */
export const VIEWER_SELECTION_DISPLAY = 'AWC_visSelectionDisplay';

/**
 * Server preference for highlight parts on hover
 */
export const VIEWER_HIGHLIGHT_ON_MOUSE_HOVER = 'AWC_visHighlightPartsOnMouseHover';

/**
 * Server preference to update hover delay to highlight parts
 */
export const VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY = 'AWC_visHighlightPartsOnMouseHoverDelay';

/**
 * Shading's server preference String
 */
export const VIEWER_SHADING = 'AWC_visShading';

/**
 * Trihedron's server preference String
 */
export const VIS_TRIHEDRON = 'AWC_visTrihedronOn';

/**
 *  TC server preference  Awv0SupportPrunningInVisWithAppConnect if window not shared then true
 */
export const  TCVIS_WINDOW_SHARED_APPCONNECT = 'Awv0SupportPrunningInVisWithAppConnect';

/**
 *  TC server preference AWC_visMoveManipulatorDefaultPosition
 */

export const VIEWER_MOVE_MANIPULATOR_POSITION = 'AWC_visMoveManipulatorDefaultPosition';


/**
 * Viewer materials
 */
export let ViewerMaterial = {
    SHINY_METAL: window.JSCom.Consts.Material.SHINY_METAL,
    BRUSHED_METAL: window.JSCom.Consts.Material.BRUSHED_METAL,
    SHINY_PLASTIC: window.JSCom.Consts.Material.SHINY_PLASTIC,
    ANALYSIS: window.JSCom.Consts.Material.ANALYSIS,
    FLAT: window.JSCom.Consts.Material.FLAT,
    RED_GLOSSY_PLASTIC: window.JSCom.Consts.Material.RED_GLOSSY_PLASTIC,
    BLUE_GLOSSY_PLASTIC: window.JSCom.Consts.Material.BLUE_GLOSSY_PLASTIC,
    GREEN_GLOSSY_PLASTIC: window.JSCom.Consts.Material.GREEN_GLOSSY_PLASTIC,
    GRAY_GLOSSY_PLASTIC: window.JSCom.Consts.Material.GRAY_GLOSSY_PLASTIC,
    BLACK_GLOSSY_PLASTIC: window.JSCom.Consts.Material.BLACK_GLOSSY_PLASTIC,
    BROWN_GLOSSY_PLASTIC: window.JSCom.Consts.Material.BROWN_GLOSSY_PLASTIC,
    YELLOW_GLOSSY_PLASTIC: window.JSCom.Consts.Material.YELLOW_GLOSSY_PLASTIC,
    TEAL_GLOSSY_PLASTIC: window.JSCom.Consts.Material.TEAL_GLOSSY_PLASTIC,
    WHITE_GLOSSY_PLASTIC: window.JSCom.Consts.Material.WHITE_GLOSSY_PLASTIC,
    CLEAR_PLASTIC: window.JSCom.Consts.Material.CLEAR_PLASTIC,
    CHROME: window.JSCom.Consts.Material.CHROME,
    COPPER: window.JSCom.Consts.Material.COPPER,
    GOLD: window.JSCom.Consts.Material.GOLD,
    BRASS: window.JSCom.Consts.Material.BRASS,
    STEEL: window.JSCom.Consts.Material.STEEL,
    BRUSHED_CHROME: window.JSCom.Consts.Material.BRUSHED_CHROME,
    BRUSHED_ALUMINUM: window.JSCom.Consts.Material.BRUSHED_ALUMINUM,
    BRUSHED_TITANIUM: window.JSCom.Consts.Material.BRUSHED_TITANIUM,
    GLASS: window.JSCom.Consts.Material.GLASS,
    SMOKEY_GLASS: window.JSCom.Consts.Material.SMOKEY_GLASS,
    RED_PAINT: window.JSCom.Consts.Material.RED_PAINT,
    GRAY_PAINT: window.JSCom.Consts.Material.GRAY_PAINT,
    BLACK_PAINT: window.JSCom.Consts.Material.BLACK_PAINT,
    BLUE_PAINT: window.JSCom.Consts.Material.BLUE_PAINT,
    RUBBER: window.JSCom.Consts.Material.RUBBER
};


/**
 * Viewer shaded with edges
 */
export let ViewerShadedWithEdges = {
    SHADED: window.JSCom.Consts.ShadedWithEdges.SHADED,
    SHADED_WITH_EDGES: window.JSCom.Consts.ShadedWithEdges.SHADED_WITH_EDGES
};

/**
 * Viewer selection types
 */
export let SelectionDisplayStyle = {
    BBOX: window.JSCom.Consts.SelectionDisplayStyle.BBOX,
    HIGHLIGHT: window.JSCom.Consts.SelectionDisplayStyle.HIGHLIGHT,
    BBOX_GRAYSEETHRU: window.JSCom.Consts.SelectionDisplayStyle.BBOX_GRAYSEETHRU,
    HALO_EFFECT: window.JSCom.Consts.SelectionDisplayStyle.HALO_EFFECT
};

/**
 * Viewer context display types
 */
export let ContextDisplayStyle = {
    NONE: window.JSCom.Consts.ContextDisplayStyle.NONE,
    COLOREDSEETHRU: window.JSCom.Consts.ContextDisplayStyle.COLOREDSEETHRU
};

/**
 * Viewer context display types
 */
export let ViewerNavigationModes = {
    ZOOM: 2,
    ROTATE: 0,
    PAN: 1,
    AREA_SELECT: 3,
    AREA_QUERY: 4
    //                'ZOOM': window.JSCom.Consts.NavigationMode.ZOOM,
    //                'ROTATE': window.JSCom.Consts.NavigationMode.ROTATE,
    //                'PAN': window.JSCom.Consts.NavigationMode.PAN
    //                'AREA_SELECT': window.JSCom.Consts.NavigationMode.AREA_SELECT
    //                'AREA_QUERY': window.JSCom.Consts.NavigationMode.AREA_QUERY
};

/**
 * List of Occurance Type
 */
export let occurrenceTypeList = {
    Key: JSCom.Consts.OccurrenceType.Key,
    CloneStableUIDChain: JSCom.Consts.OccurrenceType.CloneStableUIDChain,
    ItemRev: JSCom.Consts.OccurrenceType.ItemRev,
    OTP: JSCom.Consts.OccurrenceType.OTP,
    SubsetUIDChain: JSCom.Consts.OccurrenceType.SubsetUIDChain,
    PartitionUIDChain: JSCom.Consts.OccurrenceType.PartitionUIDChain,
    PartitionSchemeUID: JSCom.Consts.OccurrenceType.PartitionSchemeUID,
    JtPropName: JSCom.Consts.OccurrenceType.JtPropName,
    JtPropNameChain: JSCom.Consts.OccurrenceType.JtPropNameChain,
    SubSetUID: JSCom.Consts.OccurrenceType.SubSetUID,
    SubsetModelElement: JSCom.Consts.OccurrenceType.SubsetModelElement,
    SubsetUIDChainWithJtPropNames: JSCom.Consts.OccurrenceType.SubsetUIDChainWithJtPropNames,
    JtPropNamePSIDChain: JSCom.Consts.OccurrenceType.JtPropNamePSIDChain
};

var AreaSelectLimitMaximum = 5000;

/**
 * Properties present on a model view.
 */
export let ModelViewProperties = {
    VISIBLE: window.JSCom.Consts.ModelViewProperties.VISIBLE,
    NAME: window.JSCom.Consts.ModelViewProperties.NAME
};

/**
 * Returns the preferences for current user session
 *
 * @param {Boolean} isShowAll Sets whether or not all geometry should be visible in the 3D scene
 * @param {Boolean} applyBookmarkWhileOpeningModel Sets whether or not apply bookmark while opening model
 * @param {Boolean} disableBookMark disable bookmark while opening model
 * @param {Boolean} showSuppressed show suppressd or not
 * @param {Number} selectionLimit selection limit
 * @param {Object} viewerContextData viewer context data
 * @return {Promise} A promise resolved once we get viewer preferences
 */
export let getViewerPreferences = function( isShowAll, applyBookmarkWhileOpeningModel, disableBookMark, showSuppressed, selectionLimit, viewerContextData ) {
    return initViewerPreferences( isShowAll, applyBookmarkWhileOpeningModel, disableBookMark, showSuppressed, selectionLimit, viewerContextData );
};

/**
 * Returns the occurnace type value.
 * If doesnot present then set it with CloneStableUIDChain
 * @param {Object} viewerContextData viewer context data
 * @return {String} occurance type value
 */
export let getViewerOccuranceType = function( viewerContextData ) {
    var occuranceType = getPreferenceValue( OCCURANCE_TYPE, viewerContextData );
    if( !occuranceType ) {
        exports.setViewerOccuranceType( exports.occurrenceTypeList.CloneStableUIDChain, viewerContextData );
        return exports.occurrenceTypeList.CloneStableUIDChain;
    }
    return occuranceType;
};

/**
 * Set the occurence type
 * @param {String} occuranceType occurance type value
 */
export let setViewerOccuranceType = function( occuranceType, viewerContextData ) {
    updatePreferenceValue( OCCURANCE_TYPE, occuranceType, false, viewerContextData );
};

/**
 * set the display unit
 */
export let setDisplayUnit = function( displayUnit, viewerContextData ) {
    updatePreferenceValue( DISPLAY_UNIT, [ displayUnit.toString() ], true, viewerContextData );
};

/**
 * get the display unit
 */
export let getDisplayUnit = function( viewerContextData ) {
    return parseInt( getPreferenceValue( DISPLAY_UNIT, viewerContextData ) );
};

/**
 * set the floor offset
 */
export let setFloorOffset = function( floorOffset, viewerContextData ) {
    updatePreferenceValue( FLOOR_OFFSET, [ floorOffset.toString() ], true, viewerContextData );
};

/**
 * get the floor offset
 */
export let getFloorOffset = function( viewerContextData ) {
    return parseFloat( getPreferenceValue( FLOOR_OFFSET, viewerContextData ) );
};

/**
 * set Shadow Visibility
 */
export let setShadowVisibility = function( isVisible, viewerContextData ) {
    updatePreferenceValue( SHADOW, isVisible, true, viewerContextData );
};

/**
 * set Grid Visibility
 */
export let setGridVisibility = function( isVisible, viewerContextData ) {
    updatePreferenceValue( GRID, isVisible, true, viewerContextData );
};

/**
 * set Floor Visibility
 */
export let setFloorVisibility = function( isVisible, viewerContextData ) {
    updatePreferenceValue( FLOOR_VISIBILITY, isVisible, true, viewerContextData );
};

/**
 * set Global Material
 */
export let setGlobalMaterial = function( materialIndex, viewerContextData ) {
    viewerContextData.updateViewerAtomicData( 'viewerPreference.' + MATERIAL, materialIndex );
    preferenceService.setStringValue( MATERIAL, [ materialIndex ] );
};

/**
 * set reflection Visibility
 */
export let setReflectionVisibility = function( isVisible, viewerContextData ) {
    updatePreferenceValue( REFLECTION, isVisible, true, viewerContextData );
};
/**
 * set Trihedron Visibility
 */
export let setTrihedronVisibility = function( isVisible, viewerContextData ) {
    updatePreferenceValue( VIS_TRIHEDRON, isVisible, true, viewerContextData );
};

/**
 * get Trihedron Visibility
 */
export let getTrihedronVisibility = function( viewerContextData ) {
    return getPreferenceValue( VIS_TRIHEDRON, viewerContextData );
};

/**
 * set viewer floor orientation
 */
export let setFloorOrientation = function( planeId, viewerContextData ) {
    updatePreferenceValue( FLOOR_ORIENTATION, planeId, true, viewerContextData );
};

/**
 * set viewer PMI FlatToScreen true/false
 */
export let setPMIOption = function( setFlatToScreen, viewerContextData ) {
    updatePreferenceValue( VIEWER_PMI_OPTION, setFlatToScreen, true, viewerContextData );
};

/**
 * set the Color Theme
 */
export let setColorTheme = function( viewerBackgroundColorTheme, viewerContextData ) {
    updatePreferenceValue( VIS_COLOR_SCHEME, [ viewerBackgroundColorTheme ], true, viewerContextData );
};

/**
 * get the Color Theme
 */
export let getColorTheme = function( viewerContextData ) {
    return getPreferenceValue( VIS_COLOR_SCHEME, viewerContextData );
};


/**
 * set the viewer move manipulator position
 */
export let setMoveManipulatorPos = function( moveManipulatorPositionValue, viewerContextData ) {
    updatePreferenceValue( VIEWER_MOVE_MANIPULATOR_POSITION, moveManipulatorPositionValue, true, viewerContextData );
};

/**
 * get the viewer move manipulator position
 */
export let getMoveManipulatorPos = function( viewerContextData ) {
    return getPreferenceValue( VIEWER_MOVE_MANIPULATOR_POSITION, viewerContextData );
};

/**
 * set the Lights intensity Factor
 */
export let setLightsIntensityFactor = function( viewerLightsIntensityFactor, viewerContextData ) {
    updatePreferenceValue( VIS_LIGHTS_INTENSITY_FACTOR, [ viewerLightsIntensityFactor.toString() ], true, viewerContextData );
};

/**
 * get the Lights intensity Factor
 */
export let getLightsIntensityFactor = function( viewerContextData ) {
    return getPreferenceValue( VIS_LIGHTS_INTENSITY_FACTOR, viewerContextData );
};

/**
 * set the model unit
 */
export let setModelUnit = function( modelUnit, viewerContextData ) {
    updatePreferenceValue( MODEL_UNIT, modelUnit, false, viewerContextData );
};

/**
 * get the model unit
 * @returns {Number} returns model unit
 */
export let getModelUnit = function( viewerContextData ) {
    return getPreferenceValue( MODEL_UNIT, viewerContextData );
};


/**
 * get viewer beta preference
 * @returns {String} returns beta preference value
 */
export let getViewerBetaPref = function( viewerContextData ) {
    let betaPrefValue = getPreferenceValue( VIEWER_EXPOSED_BETA, viewerContextData );
    if( !_.isUndefined( betaPrefValue ) && !_.isNull( betaPrefValue ) ) {
        return betaPrefValue;
    }
    betaPrefValue = preferenceService.getLoadedPrefs().AWC_visExposedBetaFeatures;
    if( betaPrefValue ) {
        return betaPrefValue;
    }
    return null;
};

/**
 * get area select limit
 * @return {Promise} A promise resolved once selection limit is returned from preference
 */
export let getSelectionLimit = function() {
    let returnPromise = AwPromiseService.instance.defer();
    let viewerPrefPromise = preferenceService.getStringValue( SELECTION_LIMIT );
    viewerPrefPromise.then( function( selectionLimit ) {
        if( !selectionLimit ) {
            returnPromise.resolve( 0 );
        } else {
            selectionLimit = parseInt( selectionLimit );
            if( selectionLimit < AreaSelectLimitMaximum ) {
                returnPromise.resolve( selectionLimit );
            } else {
                logger.warn( 'Selection limit exceeds the maximum limit defaulting to 1000' );
                returnPromise.resolve( AreaSelectLimitMaximum );
            }
        }
    }, function( error ) {
        logger.error( 'Error while getting preference : ' + SELECTION_LIMIT );
        logger.error( error );
        returnPromise.resolve( 0 );
    } ).catch( function( error ) {
        logger.error( 'Error while getting preference : ' + SELECTION_LIMIT +
            '. Default value will be used for preference.' );
        logger.error( error );
        returnPromise.resolve( 0 );
    } );
    return returnPromise.promise;
};

/**
 * get viwer brower caching preference
 * @returns {boolean} vis browser caching pref
 */
export let getBrowserCachingPref = function( viewerContextData ) {
    return getPreferenceValue( VIS_BROWSER_CACHING, viewerContextData );
};

/**
 * Enables draw preference
 *
 * @param {Boolean} isToEnable true if set to be ON
 */
export let setEnableDrawingPref = function( isToEnable ) {
    _isDrawingEnabled = isToEnable;

    if( _openModelPreferences && _openModelPreferences.draw ) {
        _openModelPreferences.draw.drawPolicy =
            isToEnable ? window.JSCom.Consts.DrawPolicy.AUTOMATIC : window.JSCom.Consts.DrawPolicy.DISABLED;
    }
};

/**
 * Sets draw preference Internal
 */
function _setDrawingOption() {
    if( _openModelPreferences && _openModelPreferences.draw ) {
        _openModelPreferences.draw.drawPolicy =
            _isDrawingEnabled ? window.JSCom.Consts.DrawPolicy.AUTOMATIC : window.JSCom.Consts.DrawPolicy.DISABLED;
    }
}

let getPsSippingPref = function( betaPrefValues ) {
    for( const prefValue of betaPrefValues ) {
        if( prefValue === 'enablePsSipping' ) {
            return true;
        }
        if( prefValue === 'disablePsSipping' ) {
            return false;
        }
    }
    return true;
};

/**
 * Gets memory threshold
 * @param {Object} viewerContextData viewer context data
 * @return {Number} memory threshold
 */
let getMemoryThreshold = function( viewerContextData ) {
    if( viewerContextData ) {
        if( appCtxService.getCtx( 'splitView.mode' ) ) {
            return viewerContextData.getMemoryThreshold() / 2;
        }
        return viewerContextData.getMemoryThreshold();
    }
};

/**
 * Gets Manipulator type on the basis of preference value
 * @param {String} prefValue preference value
 * @returns {Number} number associated with manipulator type
 */
let getManipulatorType = function( prefValue ) {
    if( prefValue === THREED_NAVIGATION_MODE_NAME_MAP.WALK ) {
        return THREED_NAVIGATION_MODE_VALUE_MAP.WALK;
    }
    return THREED_NAVIGATION_MODE_VALUE_MAP.EXAMINE;
};

/**
 * Initialize the preferences for current user session
 * @param {Boolean} isShowAll Sets whether or not all geometry should be visible in the 3D scene
 * @param {Boolean} applyBookmarkWhileOpeningModel Sets whether or not apply bookmark while opening model
 * @param {Boolean} disableBookMark disable bookmark while opening model
 * @param {Boolean} showSuppressed show suppressd or not
 * @param {Number} selectionLimit selection limit
 * @param {Object} viewerContextData viewer context data
 * @return {Promise} A promise resolved once we initialize viewer preferences
 */
var initViewerPreferences = function( isShowAll, applyBookmarkWhileOpeningModel, disableBookMark, showSuppressed, selectionLimit, viewerContextData ) {
    var returnPromise = AwPromiseService.instance.defer();
    _openModelPreferences = new window.JSCom.Render.OpenModelPreferences();
    var allViewerPrefs = [ NAVIGATION_MODE, THREED_NAVIGATION_MODE_PREF, VIEWER_SHADING, MATERIAL, VIS_TRIHEDRON,
        FLOOR_VISIBILITY, FLOOR_ORIENTATION, FLOOR_OFFSET, GRID, SHADOW, REFLECTION, VIEW_ORIENTATION_TOP,
        VIEW_ORIENTATION_LEFT, VIEW_ORIENTATION_FRONT, APPLYTRUESHADINGMATERIAL, EFFECTIVITY,
        VIEWER_SELECTION_DISPLAY, VIEWER_ZOOM_IN, ALL_ON, DISPLAY_UNIT, VIEWER_EXPOSED_BETA,
        VIS_COLOR_SCHEME, VIS_BROWSER_CACHING, VIEWER_APPLY_DEFAULT_MODEL_VIEW, VIS_MOUSE_GESTURE_MAPPING, VIS_FIT_TYPE,
        VIS_STD_VIEW_ALIGNMENT_MODE, VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY, VIS_LIGHTS_INTENSITY_FACTOR, VIEWER_MOVE_MANIPULATOR_POSITION, JT_FILE_PRIORITY_REFSETS
    ];
    var allViewerPrefsDefaultVals = [ 'ROTATE', 'EXAMINE', 'false', '4',
        'true', 'false', '1', '0',
        'true', 'false', 'false',
        '-z', '+x', '+y', 'true',
        'false', 'true', 'Push', 'true', '3', '', 'siemens', 'true', 'false', 'AW', 'Tight', 'Automotive', 'true', '0.1', '50', 'PartBoundingBoxCenter', '[]'
    ];
    var viewerPrefPromise = preferenceService.getMultiStringValues( allViewerPrefs.slice() );
    viewerPrefPromise.then( function( viewerPrefValuesMap ) {
        _.forEach( allViewerPrefs, function( prefVal, key ) {
            if( _.isNull( viewerPrefValuesMap[ prefVal ] ) || _.isUndefined( viewerPrefValuesMap[ prefVal ] ) ) {
                logger.error( 'Viewer preference not available on TC server : ' + prefVal +
                    '. Add this preference on TC server for normal functioning of viewer. Default value will be used for preference.' );
                viewerPrefValuesMap[ prefVal ] = [ allViewerPrefsDefaultVals[ key ] ];
            } else if( Array.isArray( viewerPrefValuesMap[ prefVal ] ) &&
                _.isNull( viewerPrefValuesMap[ prefVal ][ 0 ] ) ||
                _.isUndefined( viewerPrefValuesMap[ prefVal ][ 0 ] ) ) {
                logger.error( 'Viewer preference value not set in TC server : ' + prefVal +
                    '. Default value will be used for preference.' );
                viewerPrefValuesMap[ prefVal ] = [ allViewerPrefsDefaultVals[ key ] ];
            }
        } );
        exports.setNavigationMode( viewerPrefValuesMap[ NAVIGATION_MODE ][ 0 ], null, viewerContextData );
        exports.setSelectionDisplayPreference( viewerPrefValuesMap[ VIEWER_SELECTION_DISPLAY ][ 0 ], null, viewerContextData );
        _setDrawingOption();
        viewerOrientationService.setCustomOrientaionData(
            {
                TOP:viewerPrefValuesMap[ VIEW_ORIENTATION_TOP ][ 0 ],
                LEFT:viewerPrefValuesMap[ VIEW_ORIENTATION_LEFT ][ 0 ],
                FRONT:viewerPrefValuesMap[ VIEW_ORIENTATION_FRONT ][ 0 ]
            }
        );
        _openModelPreferences.trueShade.material = parseInt( viewerPrefValuesMap[ MATERIAL ][ 0 ] );
        _openModelPreferences.trueShade.floorPlane = parseInt( viewerPrefValuesMap[ FLOOR_ORIENTATION ][ 0 ] );
        _openModelPreferences.trueShade.floorDistance = parseInt( viewerPrefValuesMap[ FLOOR_OFFSET ][ 0 ] );
        _openModelPreferences.trueShade.applyMaterial = viewerPrefValuesMap[ APPLYTRUESHADINGMATERIAL ][ 0 ] === 'true';
        _openModelPreferences.trueShade.gridVisible = viewerPrefValuesMap[ GRID ][ 0 ] === 'true';
        _openModelPreferences.trueShade.floorReflectionVisible = viewerPrefValuesMap[ REFLECTION ][ 0 ] === 'true';
        _openModelPreferences.trueShade.shadowVisible = viewerPrefValuesMap[ SHADOW ][ 0 ] === 'true';
        _openModelPreferences.trueShade.floorVisible = viewerPrefValuesMap[ FLOOR_VISIBILITY ][ 0 ] === 'true';
        _openModelPreferences.trueShade.shadedWithEdges = viewerPrefValuesMap[ VIEWER_SHADING ][ 0 ] === 'true' ? ViewerShadedWithEdges.SHADED_WITH_EDGES : ViewerShadedWithEdges.SHADED;
        _openModelPreferences.draw.trihedronVisible = viewerPrefValuesMap[ VIS_TRIHEDRON ][ 0 ] === 'true';
        _openModelPreferences.draw.navigationCubeVisible = viewerPrefValuesMap[ VIS_TRIHEDRON ][ 0 ] === 'true';
        _openModelPreferences.navigation.zoomReversed = viewerPrefValuesMap[ VIEWER_ZOOM_IN ][ 0 ] !== 'Pull';
        _openModelPreferences.visStdViewAlignmentMode = viewerPrefValuesMap[VIS_STD_VIEW_ALIGNMENT_MODE][0];
        viewerOrientationService.setViewerOrientation( viewerPrefValuesMap[VIS_STD_VIEW_ALIGNMENT_MODE][0] );
        _openModelPreferences.navigation.stdViewOrientation = viewerOrientationService.getStdOrientationCamera( viewerPrefValuesMap[VIS_STD_VIEW_ALIGNMENT_MODE][0] );
        _openModelPreferences.navigation.manipulatorType = getManipulatorType( viewerPrefValuesMap[ THREED_NAVIGATION_MODE_PREF ][0] );
        _openModelPreferences.viewerBetaPref = viewerPrefValuesMap[ VIEWER_EXPOSED_BETA ];
        if( _openModelPreferences.applyDefaultModelViewOnOpen ) {
            _openModelPreferences.applyDefaultModelViewOnOpen = viewerPrefValuesMap[ VIEWER_APPLY_DEFAULT_MODEL_VIEW ][ 0 ] === 'true';
        }
        _openModelPreferences.viewerBackgroundColorTheme = viewerPrefValuesMap[ VIS_COLOR_SCHEME ][ 0 ];
        _openModelPreferences.viewerLightsIntensityFactor = parseInt( viewerPrefValuesMap[ VIS_LIGHTS_INTENSITY_FACTOR ][ 0 ] );
        _openModelPreferences.selection.clientSelectionLimit = parseInt( selectionLimit );
        _openModelPreferences.displayUnit = parseInt( viewerPrefValuesMap[ DISPLAY_UNIT ][ 0 ] );
        _openModelPreferences.performance.useClientCaching = viewerPrefValuesMap[ VIS_BROWSER_CACHING ][ 0 ] === 'true';
        if( isShowAll ) {
            _openModelPreferences.allGeometryVisible = viewerPrefValuesMap[ ALL_ON ][ 0 ] === 'true';
        } else {
            _openModelPreferences.allGeometryVisible = false;
        }
        _openModelPreferences.enableProductStructureSipping = getPsSippingPref( viewerPrefValuesMap[ VIEWER_EXPOSED_BETA ] );
        _openModelPreferences.applyBookmarkWhileOpeningModel = applyBookmarkWhileOpeningModel;
        _openModelPreferences.disableBookMark = disableBookMark;
        _openModelPreferences.showSuppressed = showSuppressed;
        _openModelPreferences.memoryThreshold = getMemoryThreshold( viewerContextData );
        _openModelPreferences.visMouseGesture =  viewerPrefValuesMap[ VIS_MOUSE_GESTURE_MAPPING ][ 0 ];
        _openModelPreferences.fitType = viewerPrefValuesMap[ VIS_FIT_TYPE ][ 0 ];
        _openModelPreferences[VIEWER_MOVE_MANIPULATOR_POSITION] = viewerPrefValuesMap[VIEWER_MOVE_MANIPULATOR_POSITION][0];
        _openModelPreferences.highlightPartsOnHover = viewerPrefValuesMap[VIEWER_HIGHLIGHT_ON_MOUSE_HOVER][0] === 'true';
        let hoverHighlightDelay = parseFloat( viewerPrefValuesMap[VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY][0] ).toFixed( 3 );
        _openModelPreferences.mouseOverDelay = parseInt( hoverHighlightDelay * 1000 );
        _openModelPreferences.prehighlightDelay = parseInt( hoverHighlightDelay * 1000 );
        _openModelPreferences.jtFilePriorityRefsets = viewerPrefValuesMap[ JT_FILE_PRIORITY_REFSETS ];
        updateViewerPreferences( viewerContextData );
        returnPromise.resolve( _openModelPreferences );
    }, function() {
        returnPromise.resolve( _openModelPreferences );
    } );
    return returnPromise.promise;
};

/**
 * Initialize the preferences from vis session
 * @param {ViewerContextData} viewerCtxData Sets whether or not all geometry should be visible in the 3D scene
 */
export let loadViewerPreferencesFromVisSession = function( viewerCtxData ) {
    let vqScenePromise = null;
    let threeDViewPromise = null;
    let drawTrislingPromise = null;
    if( viewerCtxData.getVqSceneManager() ) {
        vqScenePromise = [
            viewerCtxData.getVqSceneManager().getGlobalMaterial(),
            viewerCtxData.getVqSceneManager().getFloorPlaneOrientation(),
            viewerCtxData.getVqSceneManager().getFloorOffset(),
            viewerCtxData.getVqSceneManager().areMaterialsEnabled(),
            viewerCtxData.getVqSceneManager().getFloorGrid(),
            viewerCtxData.getVqSceneManager().isFloorReflectionEnabled(),
            viewerCtxData.getVqSceneManager().isFloorShadowEnabled(),
            viewerCtxData.getVqSceneManager().getFloor()
        ];
    } else {
        vqScenePromise = [ AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve() ];
    }
    if( viewerCtxData.getThreeDViewManager() ) {
        threeDViewPromise = [
            viewerCtxData.getThreeDViewManager().getBasicDisplayMode(),
            viewerCtxData.getThreeDViewManager().getBackgroundColorTheme()
        ];
    } else {
        threeDViewPromise = [ AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve() ];
    }
    if( viewerCtxData.getDrawTrislingManager() ) {
        drawTrislingPromise = [
            viewerCtxData.getDrawTrislingManager().isTrihedronEnabled(),
            viewerCtxData.getDrawTrislingManager().isNavCubeEnabled()
        ];
    } else {
        drawTrislingPromise = [ AwPromiseService.instance.resolve(),
            AwPromiseService.instance.resolve() ];
    }//vqScenePromise.concat( threeDViewPromise, drawTrislingPromise )
    AwPromiseService.instance.all( vqScenePromise.concat( threeDViewPromise, drawTrislingPromise ) ).then( function( viewerPreferenceDataResponse ) {
        if( viewerCtxData.getVqSceneManager() ) {
            _openModelPreferences.trueShade.material = viewerPreferenceDataResponse[ 0 ]; //Number
            _openModelPreferences.trueShade.floorPlane = viewerPreferenceDataResponse[ 1 ]; //Number
            _openModelPreferences.trueShade.floorDistance = viewerPreferenceDataResponse[ 2 ]; //Number
            _openModelPreferences.trueShade.applyMaterial = viewerPreferenceDataResponse[ 3 ]; // Boolean
            _openModelPreferences.trueShade.gridVisible = viewerPreferenceDataResponse[ 4 ]; //Boolean
            _openModelPreferences.trueShade.floorReflectionVisible = viewerPreferenceDataResponse[ 5 ]; //Boolean
            _openModelPreferences.trueShade.shadowVisible = viewerPreferenceDataResponse[ 6 ]; //Boolean
            _openModelPreferences.trueShade.floorVisible = viewerPreferenceDataResponse[ 7 ]; //Boolean
        }
        if( viewerCtxData.getThreeDViewManager() ) {
            _openModelPreferences.trueShade.shadedWithEdges = viewerPreferenceDataResponse[ 8 ]; //Number
            _openModelPreferences.viewerBackgroundColorTheme = viewerPreferenceDataResponse[ 9 ]; //String
        }
        if( viewerCtxData.getDrawTrislingManager() ) {
            _openModelPreferences.draw.trihedronVisible = viewerPreferenceDataResponse[ 10 ]; //Boolean
            _openModelPreferences.draw.navigationCubeVisible = viewerPreferenceDataResponse[ 11 ]; //Boolean
        }
        if( viewerCtxData.getNavigationManager() ) {
            _openModelPreferences.navigation.zoomReversed = viewerCtxData.getNavigationManager().isZoomReversed(); //Boolean
        } else {
            _openModelPreferences.navigation.zoomReversed = false;
        }
        updateViewerPreferences( viewerCtxData );
    } ).catch( function( errorMsg ) {
        logger.error( 'Error while loading Vis preferences from session : ' + errorMsg );
    } );
};

/**
 * Set NavigationMode preference
 *
 * @param {String} navMode string representing viewer navigation mode
 * @param {Boolean} persistValue true if preference value should be persisted
 * @param {Object} viewerContextData viewer atomic data
 */
export let setNavigationMode = function( navMode, persistValue, viewerContextData ) {
    _openModelPreferences.navigation.defaultAction = exports.ViewerNavigationModes[ navMode ];
    updatePreferenceValue( NAVIGATION_MODE, navMode, persistValue, viewerContextData );
};

/**
 * Set the selection display preference.
 *
 * @param {String} selectionDisplayOption Selection behavior option
 * @param {Boolean} persistValue true if preference value should be persisted
 * @param {Object} viewerContextData viewer context data
 */
export let setSelectionDisplayPreference = function( selectionDisplayOption, persistValue, viewerContextData ) {
    if( selectionDisplayOption === 'Transparent' ) {
        _openModelPreferences.selection.selectionDisplayStyle = exports.SelectionDisplayStyle.BBOX_GRAYSEETHRU;
        _openModelPreferences.contextDisplayStyle = exports.ContextDisplayStyle.COLOREDSEETHRU;
    } else  if( selectionDisplayOption === 'PartColor' ) {
        _openModelPreferences.selection.selectionDisplayStyle = exports.SelectionDisplayStyle.HIGHLIGHT;
        _openModelPreferences.contextDisplayStyle = exports.ContextDisplayStyle.NONE;
    } else  if( selectionDisplayOption === 'Halo' ) {
        _openModelPreferences.selection.selectionDisplayStyle = exports.SelectionDisplayStyle.HALO_EFFECT;
        _openModelPreferences.contextDisplayStyle = exports.ContextDisplayStyle.NONE;
    }
    updatePreferenceValue( VIEWER_SELECTION_DISPLAY, selectionDisplayOption, persistValue, viewerContextData );
};

/**
 * Set the alternatePCi preference
 * @param {String} prefValue Preference to save
 * @param {String} occmgmtContextNameKey occmgmtContext name key
 * @param {String} isInitilization Flag indicating if its initialization of setting
 */
export let setUseAlternatePCIPreference = function( prefValue, occmgmtContextNameKey, isInitilization ) {
    appCtxService.updatePartialCtx( 'viewer' + VIEWER_INDEXED_MODEL, prefValue );
    if( !isInitilization ) {
        eventBus.publish( 'useIndexedModelSettingsChangedEvent', { viewToReact:occmgmtContextNameKey } );
    }
};

/**
 * Get the alternatePCi preference
 * @returns {String} viewer indexed model preference
 */
export let getUseAlternatePCIPreference = function() {
    return appCtxService.getCtx( 'viewer' + VIEWER_INDEXED_MODEL );
};

/**
 * Get the shaded with edges preference
 *
 * @returns {String} shaded with edegs preference
 */
export let getShadedWithEdgesPreference = function( viewerContextData ) {
    return getPreferenceValue( VIEWER_SHADING, viewerContextData );
};

/**
 * Set the shaded with edges preference
 *
 * @param {boolean} isShadedWithEdges with edegs preference
 * @param {Object} viewerContextData this contains Viewer Context Data
 */
export let setShadedWithEdgesPreference = function( isShadedWithEdges, viewerContextData ) {
    updatePreferenceValue( VIEWER_SHADING, isShadedWithEdges, true, viewerContextData );
};

/**
 * Set the moden render location preference
 *
 * @param {boolean} renderLocation with CSR or SSR Value
 * @param {Object} viewerContextData this contains Viewer Context Data
 */
export let setModelRenderLocationPreference = function( renderLocation, viewerContextData ) {
    updatePreferenceValue( VIEWER_RENDER_OPTION, renderLocation, true, viewerContextData );
};
/**
 * Set the fit type preference
 *
 * @param {boolean} fitTypeValue with Tight or Spherical Value
 * @param {Object} viewerContextData this contains Viewer Context Data
 */
export let setFitTypePreference = function( fitTypeValue, viewerContextData ) {
    updatePreferenceValue( VIS_FIT_TYPE, fitTypeValue, true, viewerContextData );
};

/**
 * Set True Shading Material
 * @param {boolean} isApply is apply true Shading Material
 * @param {Object} viewerContextData this contains Viewer Context Data
 */
export let setApplyTrueShadingMaterial = function( isApply, viewerContextData ) {
    updatePreferenceValue( APPLYTRUESHADINGMATERIAL, isApply, true, viewerContextData );
};


/**
 * Get PV open configuration
 *
 * @return {Promise} promise that will resolve with PV open config value
 */
export let getPVOpenConfiguration = function() {
    return preferenceService.getStringValue( PV_OPEN_CONFIG );
};

/**
 * Determines whether the 3D Viewer uses BOM-provided deltas when updating viewer
 *
 * @return {Promise} promise that will resolve with whether to use BOM-provided deltas when updating viewer
 */
export let getUseBomDeltaStructureUpdate = function() {
    const loadedPreferences = preferenceService.getLoadedPrefs();
    if( loadedPreferences[ VIS_USE_BOM_DELTA_STRUCTURE_UPDATE ] ) {
        return loadedPreferences[ VIS_USE_BOM_DELTA_STRUCTURE_UPDATE ][0];
    }
    return false;
};


/**
 * Determines whether the Appconnected uses TC Viz Provided Delta
 *
 * @return {Promise} promise that will resolve with whether to use TCVIS provided delta if true then window is not shared if false then window is shared
 */
export let getTcVisWindowSharedUpdate = function() {
    return preferenceService.getStringValue( TCVIS_WINDOW_SHARED_APPCONNECT );
};


/**
 * Gets viewer orientation from loaded preferences
 * @returns {String} viewer orientation
 */
export let getViewerOrientation = function() {
    let orientation = 'Automotive';//default value
    let loadedPreferences = preferenceService.getLoadedPrefs();
    let alignMentModePref = loadedPreferences[ VIS_STD_VIEW_ALIGNMENT_MODE ];
    if( alignMentModePref && _.isArray( alignMentModePref ) && alignMentModePref.length > 0 ) {
        orientation = alignMentModePref[ 0 ];
    }
    return orientation;
};


/**
 * Update preference value for user session
 *
 * @param {String} prefName viewer navigation mode
 * @param {String/Number} prefValue value of preference
 * @param {Boolean} persistValue true if preference value should be persisted
 * @param {Object} viewerContextData viewer context data
 */
var updatePreferenceValue = function( prefName, prefValue, persistValue, viewerContextData ) {
    if( persistValue ) {
        var values = Array.isArray( prefValue ) ? prefValue : [ prefValue.toString() ];
        preferenceService.setStringValues( [ prefName ], [ values ] );
    }
    if( !viewerContextData ) {
        return;
    }
    viewerContextData.updateViewerAtomicData( 'viewerPreference.' + prefName, prefValue );
};

/**
 * Gets preference value
 * @param {String} prefName preference name
 * @param {Object} viewerContextData viewer context data
 * @returns {String/Number} preference value
 */
let getPreferenceValue = function( prefName, viewerContextData ) {
    if( !viewerContextData ) {
        return null;
    }
    var viewerPreference = viewerContextData.getValueOnViewerAtomicData( 'viewerPreference' );
    if( viewerPreference ) {
        return viewerPreference[ prefName ];
    }
    return null;
};

var updateViewerPreferences = function( viewerContextData ) {
    if( _openModelPreferences && viewerContextData ) {
        const viewerPreference = viewerContextData.getValueOnViewerAtomicData( 'viewerPreference' );
        let updatedPreferences = { ...viewerPreference };
        if( viewerContextData.getVqSceneManager() ) {
            updatedPreferences.AWC_visMaterial = _openModelPreferences.trueShade.material.toString();
            updatedPreferences[FLOOR_ORIENTATION] = _openModelPreferences.trueShade.floorPlane.toString();
            updatedPreferences.AWC_visFloorOffset = _openModelPreferences.trueShade.floorDistance.toString();
            updatedPreferences.AWC_applyTrueShadingMaterial = _openModelPreferences.trueShade.applyMaterial;
            updatedPreferences.AWC_visGridOn = _openModelPreferences.trueShade.gridVisible;
            updatedPreferences.AWC_visShadowOn = _openModelPreferences.trueShade.shadowVisible;
            updatedPreferences.AWC_visReflectionOn = _openModelPreferences.trueShade.floorReflectionVisible;
            updatedPreferences.AWC_visFloorOn = _openModelPreferences.trueShade.floorVisible;
        }
        updatedPreferences.AWC_visShading = _openModelPreferences.trueShade.shadedWithEdges === 1;
        updatedPreferences.AWC_visTrihedronOn = _openModelPreferences.draw.trihedronVisible;
        updatedPreferences[THREED_NAVIGATION_MODE_PREF] = _openModelPreferences.navigation.manipulatorType;
        updatedPreferences.AWC_visExamineZoomIn = _openModelPreferences.navigation.zoomReversed;
        updatedPreferences.AWC_visExposedBetaFeatures = _openModelPreferences.viewerBetaPref;
        updatedPreferences.AWC_3DViewerDisplayUnit = _openModelPreferences.displayUnit.toString();
        updatedPreferences.AWC_visColorScheme = [ _openModelPreferences.viewerBackgroundColorTheme ];
        updatedPreferences.AWC_visLightsIntensityFactor = _openModelPreferences.viewerLightsIntensityFactor;
        updatedPreferences.AWC_visSelectionLimit = _openModelPreferences.selection.clientSelectionLimit;
        updatedPreferences.AWC_visAllOn = _openModelPreferences.allGeometryVisible;
        updatedPreferences.AWV0MouseGestureMapping = _openModelPreferences.visMouseGesture;
        updatedPreferences.AWC_visFitType = _openModelPreferences.fitType;
        updatedPreferences[VIEWER_MOVE_MANIPULATOR_POSITION] = _openModelPreferences[VIEWER_MOVE_MANIPULATOR_POSITION];
        updatedPreferences[VIEW_ORIENTATION_TOP] = _openModelPreferences.navigation.stdViewOrientation.top;
        updatedPreferences[VIEW_ORIENTATION_LEFT] = _openModelPreferences.navigation.stdViewOrientation.left;
        updatedPreferences[VIEW_ORIENTATION_FRONT] = _openModelPreferences.navigation.stdViewOrientation.front;
        updatedPreferences[VIS_STD_VIEW_ALIGNMENT_MODE] = _openModelPreferences.visStdViewAlignmentMode;
        updatedPreferences[VIEWER_HIGHLIGHT_ON_MOUSE_HOVER] = _openModelPreferences.highlightPartsOnHover;
        updatedPreferences[VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY] = parseFloat( _openModelPreferences.prehighlightDelay / 1000 ).toFixed( 3 );
        viewerContextData.updateViewerAtomicData( 'viewerPreference', updatedPreferences );
    }
};

/**
 * Makes a call to the Tc server to retrieve all the preferences listed. This
 * method only returns them, it does not save them to the viewerPreferenceContext.
 */
export let getAllVisAWCPreferences = function() {
    var returnPromise = AwPromiseService.instance.defer();

    var allPrefs = [
        'AWV02DViewerRenderOption',
        'AWV0AWVisReuseTCServer',
        'AWV0HostAWInVisUponLaunch',
        'AWV0LaunchAsSession',
        'AWV0SectionCapsEdgesInitialState',
        'AWV0UseAWAppConnect',
        'AWV0VisBrowserCaching',
        'AWV0VisReuseTCServer',
        'AWC_VisStructureContext.SUMMARYRENDERING',
        'AWC_vis3DNavigationMode',
        'AWC_visAllOn',
        'AWC_visColorScheme',
        'AWC_visLightsIntensityFactor',
        'AWC_visExamineZoomIn',
        'AWC_visExposedBetaFeatures',
        'AWC_visFloorOffset',
        'AWC_visFloorOn',
        'AWC_visFloorPlaneOrientation',
        'AWC_visGridOn',
        'AWC_visMaterial',
        'AWC_visNavigationMode',
        'AWC_visOverlayDisplayEffectivity',
        'AWC_visProductViewOpenConfiguration',
        'AWC_visReflectionOn',
        'AWC_visSelectionDisplay',
        'AWC_visSelectionLimit',
        'AWC_visShading',
        'AWC_visShadowOn',
        'AWC_visStdViewOrientationFront',
        'AWC_visStdViewOrientationLeft',
        'AWC_visStdViewOrientationTop',
        'AWC_visTrihedronOn',
        'AWC_visFitType',
        'AWC_visMoveManipulatorDefaultPosition'
    ];
    var viewerPrefPromise = preferenceService.getMultiStringValues( allPrefs.slice() );
    viewerPrefPromise.then( ( output ) => { returnPromise.resolve( output ); } );
    return returnPromise.promise;
};

export default exports = {
    ViewerMaterial,
    ViewerShadedWithEdges,
    SelectionDisplayStyle,
    ContextDisplayStyle,
    ViewerNavigationModes,
    occurrenceTypeList,
    ModelViewProperties,
    VIS_MOUSE_GESTURE_MAPPING,
    ALL_ON,
    DISPLAY_UNIT,
    THREED_NAVIGATION_MODE_PREF,
    THREED_NAVIGATION_MODE_NAME_MAP,
    VIS_FIT_TYPE,
    VIS_NAVIGATION_MODE,
    VIS_STD_VIEW_ALIGNMENT_MODE,
    VIEW_ORIENTATION_TOP,
    VIEW_ORIENTATION_LEFT,
    VIEW_ORIENTATION_FRONT,
    MATERIAL,
    FLOOR_ORIENTATION,
    THREED_NAVIGATION_MODE_VALUE_MAP,
    VIEWER_SELECTION_DISPLAY,
    VIEWER_HIGHLIGHT_ON_MOUSE_HOVER,
    VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY,
    VIEWER_SHADING,
    VIS_TRIHEDRON,
    VIEWER_RENDER_OPTION,
    VIS_LIGHTS_INTENSITY_FACTOR,
    VIEWER_MOVE_MANIPULATOR_POSITION,
    getViewerPreferences,
    getViewerOccuranceType,
    setViewerOccuranceType,
    setDisplayUnit,
    getDisplayUnit,
    getColorTheme,
    setColorTheme,
    setModelUnit,
    getModelUnit,
    getViewerBetaPref,
    setEnableDrawingPref,
    setNavigationMode,
    setSelectionDisplayPreference,
    setUseAlternatePCIPreference,
    getUseAlternatePCIPreference,
    getPVOpenConfiguration,
    loadViewerPreferencesFromVisSession,
    getShadedWithEdgesPreference,
    setModelRenderLocationPreference,
    getSelectionLimit,
    getBrowserCachingPref,
    setFloorOffset,
    getFloorOffset,
    setShadowVisibility,
    setGridVisibility,
    setFloorVisibility,
    setReflectionVisibility,
    setGlobalMaterial,
    setShadedWithEdgesPreference,
    setApplyTrueShadingMaterial,
    setTrihedronVisibility,
    setFloorOrientation,
    setPMIOption,
    getTrihedronVisibility,
    getTcVisWindowSharedUpdate,
    getAllVisAWCPreferences,
    getUseBomDeltaStructureUpdate,
    setFitTypePreference,
    getPreferenceValue,
    updatePreferenceValue,
    getViewerOrientation,
    getLightsIntensityFactor,
    setLightsIntensityFactor,
    setMoveManipulatorPos,
    getMoveManipulatorPos
};
