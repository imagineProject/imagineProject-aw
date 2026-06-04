// Copyright (c) 2022 Siemens

/**
 * This module provides services for viewer measurement feature
 *
 * @module js/viewerMeasureService
 */
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import viewerSecondaryModelService from 'js/viewerSecondaryModel.service';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

/**
 * Cached reference to AngularJS & AW services.
 */

/**
 * Define public API
 */
var exports = {};

export let PickFilters = {
    PICK_FEATURES_ALL: 'PICK_FEATURES_ALL',
    PICK_PARTS: 'PICK_PARTS',
    PICK_SURFACE: 'PICK_SURFACE',
    PICK_EDGE: 'PICK_EDGE',
    PICK_VERTEX: 'PICK_VERTEX',
    PICK_POINT: 'PICK_POINT',
    PICK_ARC_CENTER: 'PICK_ARC_CENTER'
};

/**
 * Set selected measurement object
 *
 * @param {Object} measurementObject - selected measurement object
 */
var _setSelectedMeasurement = function() {
    eventBus.publish( 'viewerMeasurement.selectedMeasurementChanged', {} );
};

/**
 * Notify pick filter changed
 *
 * @param {Number} value - value to be formatted
 * @param {String} locale - user locale
 */
var _formatNumber = function( value, locale ) {
    var userLang = null;
    if( locale !== null && !_.isUndefined( locale ) ) {
        userLang = locale.replace( /_/g, '-' );
    }
    if( userLang === null ) {
        userLang = navigator.language || navigator.userLanguage;
    }
    return Number( value ).toLocaleString( userLang, {
        minimumFractionDigits: 4
    } );
};

/**
 * Format the value string to be shown on UI
 *
 * @param {Object} value - value to be processed
 */
var _processMeasurementPropertyValue = function( value ) {
    if( value === null || _.isUndefined( value ) ) {
        return null;
    }

    if( !isNaN( value ) ) {
        return _formatNumber( value, localeSvc.getLocale() );
    }

    if( Array.isArray( value ) ) {
        var returnStr = '[';
        _.forEach( value, function( arrayVal ) {
            returnStr += _formatNumber( arrayVal, localeSvc.getLocale() );
            returnStr += ', ';
        } );
        returnStr = returnStr.substr( 0, returnStr.length - 2 );
        returnStr += ']';
        return returnStr;
    }
    return value;
};

/**
 * Register application context variable
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let getSelectedMeasurement = function( viewerCtxNamespace ) {
    var measurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    return measurementCtx.selectedMeasurementObject;
};

/**
 * Toggle quick measurement mode
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let toggleQuickMeasurementMode = function( viewerCtxNamespace ) {
    _initializeQuickMeasurementContext( viewerCtxNamespace );
    var measurementCtx = _getViewerQuickMeasurementCtx( viewerCtxNamespace );
    var isQuickMeasureModeEnabled = measurementCtx.isQuickMeasureModeEnabled;
    if( _.isNull( isQuickMeasureModeEnabled ) || _.isUndefined( isQuickMeasureModeEnabled ) ||
        isQuickMeasureModeEnabled !== 'true' ) {
        _updateQuickMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.isQuickMeasureModeEnabled',
            'true' );
        var selectedQMPickFilter = measurementCtx.selectedQuickMeasurementPickFilters;
        if( _.isNull( selectedQMPickFilter ) || _.isUndefined( selectedQMPickFilter ) ) {
            exports.setQuickMeasurementPickFilter( viewerCtxNamespace, 'PICK_FEATURES_ALL' );
        }
        viewerSecondaryModelService.startViewerQuickMeasurement( viewerCtxNamespace, '' );
    } else {
        _updateQuickMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.isQuickMeasureModeEnabled',
            'false' );
        viewerSecondaryModelService.closeViewerQuickMeasurement( viewerCtxNamespace );
    }
};

/**
 * Set quick measurement pick mode
 *
 */
export let setQuickMeasurementPickFilter = function( viewerCtxNamespace, pickFiltersToBeSelected ) {
    var selectedPickFilters = [];
    if( pickFiltersToBeSelected !== null && !_.isUndefined( pickFiltersToBeSelected ) ) {
        var pickFilterValue = exports.PickFilters[ pickFiltersToBeSelected ];
        if( pickFilterValue !== null && !_.isUndefined( pickFilterValue ) ) {
            selectedPickFilters.push( pickFilterValue );
        }
        _updateQuickMeasurementContext( viewerCtxNamespace,
            'viewerMeasurement.selectedQuickMeasurementPickFilters', selectedPickFilters );
        viewerSecondaryModelService.setQuickMeasurementPickMode( viewerCtxNamespace );
    }
};

/**
 * Do initial load setup
 * @param {Object} viewerCtxNamespace Viewer context name space
* @param {String} mode Measurement mode to be activated doubleMeasurement/singleMeasurement
 */
export let activateMeasurementMode = function( viewerCtxNamespace, measurementMode ) {
    var selectedPickFilters = exports.getSelectedMeasurementPickFilters( viewerCtxNamespace );
    if( selectedPickFilters === null || _.isUndefined( selectedPickFilters ) ) {
        selectedPickFilters = [ exports.PickFilters.PICK_SURFACE,
            exports.PickFilters.PICK_EDGE, exports.PickFilters.PICK_VERTEX, exports.PickFilters.PICK_POINT,
            exports.PickFilters.PICK_ARC_CENTER
        ];
    }
    _updateMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.selectedMeasurementPickFilters', selectedPickFilters );
    _updateMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.isMeasurementPanelRevealed', 'true' );
    _updateQuickMeasurementContext( viewerCtxNamespace,
        'viewerMeasurement.isQuickMeasureModeEnabled', 'false' );
    viewerSecondaryModelService.startViewerMeasurement( viewerCtxNamespace, measurementMode );
    viewerSecondaryModelService.getAllMeasurements( viewerCtxNamespace );
};

/**
 * Get selected measurement object localized text
 *
 * @param {Object} viewerCtxNamespace Viewer context name space
 * @param {Object} localeBundleText - locale bundle
 */
export let getSelectedMeasurementLocalizedText = function( viewerCtxNamespace, localeBundleText ) {
    var measurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    var returnValue = null;
    if( measurementCtx !== null && !_.isUndefined( measurementCtx ) ) {
        var selectedMeasureObj = measurementCtx.selectedMeasurementObject;
        if( selectedMeasureObj !== null && !_.isUndefined( selectedMeasureObj ) ) {
            returnValue = _getLocalizedText( selectedMeasureObj, localeBundleText );
        }
    }
    return returnValue;
};

/**
 * Get localized text
 */
var _getLocalizedText = function( selectedObj, localeBundleText ) {
    var returnValue = {};
    _
        .forOwn(
            selectedObj,
            function( prop, key ) {
                switch ( key.trim() ) {
                    case 'Point':
                        returnValue[ localeBundleText.measurementPropertyPoint ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Length':
                        returnValue[ localeBundleText.measurementPropertyLength ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Center':
                        returnValue[ localeBundleText.measurementPropertyCenter ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Radius':
                        returnValue[ localeBundleText.measurementPropertyRadius ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Angle':
                        returnValue[ localeBundleText.measurementPropertyAngle ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Normal':
                        returnValue[ localeBundleText.measurementPropertyNormal ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Area':
                        returnValue[ localeBundleText.measurementPropertyArea ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Height':
                        returnValue[ localeBundleText.measurementPropertyHeight ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'PartName':
                        returnValue[ localeBundleText.measurementPropertyPartName ] = _processMeasurementPropertyValue( prop );
                        break;
                    case 'Volume':
                        returnValue[ localeBundleText.measurementPropertyVolume ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Centroid':
                        returnValue[ localeBundleText.measurementPropertyCentroid ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Distance':
                        returnValue[ localeBundleText.measurementPropertyDistance ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Deltas':
                        returnValue[ localeBundleText.measurementPropertyDeltas ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'PrincipalMoments':
                        returnValue[ localeBundleText.measurementPropertyPrincipalMoments ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'PrincipalAxis1':
                        returnValue[ localeBundleText.measurementPropertyPrincipalAxis1 ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'PrincipalAxis2':
                        returnValue[ localeBundleText.measurementPropertyPrincipalAxis2 ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'PrincipalAxis3':
                        returnValue[ localeBundleText.measurementPropertyPrincipalAxis3 ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Mass':
                        returnValue[ localeBundleText.measurementPropertyMass ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Minimum Distance':
                        returnValue[ localeBundleText.measurementPropertyMinimumDistance ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Minimum Radius':
                        returnValue[ localeBundleText.measurementPropertyMinimumRadius ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Radii':
                        returnValue[ localeBundleText.measurementPropertyRadii ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Size X':
                        returnValue[ localeBundleText.measurementPropertySizeX ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Size Y':
                        returnValue[ localeBundleText.measurementPropertySizeY ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Size Z':
                        returnValue[ localeBundleText.measurementPropertySizeZ ] = _processMeasurementPropertyValue( prop.value ) + ' ' + prop.unit;
                        break;
                    case 'Measurement Type':
                        returnValue[ localeBundleText.measurementPropertyType ] = _processMeasurementPropertyValue( prop );
                        break;
                    default:
                        break;
                }
            } );
    return returnValue;
};

/**
 * Get measurement pick filters
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let getSelectedMeasurementPickFilters = function( viewerCtxNamespace ) {
    let measurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    return measurementCtx.selectedMeasurementPickFilters;
};

/**
 * Set selected measurement pick filters
 *
 * @param {Array} pickFiltersToBeSelected - array of pick filters to be selected
 * @param {Object} viewerCtxNamespace -- viewer context namespace
 * @param {String} measurementMode -- measurement mode single/double
 */
export let setSelectedMeasurementPickFilters = function( pickFiltersToBeSelected, viewerCtxNamespace, measurementMode ) {
    var selectedPickFilters = [];
    if( pickFiltersToBeSelected !== null && !_.isUndefined( pickFiltersToBeSelected ) ) {
        _.forEach( pickFiltersToBeSelected, function( pickFilter ) {
            var pickFilterValue = exports.PickFilters[ pickFilter ];
            if( pickFilterValue !== null && !_.isUndefined( pickFilterValue ) ) {
                selectedPickFilters.push( pickFilterValue );
            }
        } );
        _updateMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.selectedMeasurementPickFilters', selectedPickFilters );
        viewerSecondaryModelService.setMeasurementPickMode( viewerCtxNamespace, measurementMode );
    }
};

/**
 * Delete selected measurement
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let deleteSelectedMeasurement = function( viewerCtxNamespace ) {
    viewerSecondaryModelService.deleteSelectedMeasurement( viewerCtxNamespace );
};

/**
 * Delete all measurement
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let deleteAllMeasurement = function( viewerCtxNamespace ) {
    viewerSecondaryModelService.deleteAllMeasurement( viewerCtxNamespace );
};

/**
 * disables double measurement
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let disableMeasurement = function( viewerCtxNamespace ) {
    try {
        _updateMeasurementContext( viewerCtxNamespace, 'viewerMeasurement.isMeasurementPanelRevealed', 'false' );
        viewerSecondaryModelService.closeViewerMeasurement( viewerCtxNamespace );
    } catch {
        logger.warn( 'Failed to disable measurement since the viewer is not alive' );
    }
};

/**
 * Sets pick filter selection state to subcommand toolbar from session storage
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let setPickFilterSelectionStateInSubCommandToolBar = function( viewerCtxNamespace ) {
    var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
    if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
        eventBus.publish( 'awsidenav.openClose', {
            id: 'aw_toolsAndInfo',
            commandId: activeToolAndInfoCmd.commandId
        } );
    }
    _initializeMeasurementContext( viewerCtxNamespace );
    viewerSecondaryModelService.setPickFilterSelectionStateInSubCommandToolBar( viewerCtxNamespace );
};

/**
 * Gets pickfilter selection state from measurement context
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
export let getMeasurementSubToolBarCommandState = function( viewerCtxNamespace ) {
    var currentMeasurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    return currentMeasurementCtx.viewerMeasurePickfilterSelectionState;
};

/**
 * Sets pickfilter selection state to measurement context
 * @param {Object} viewerCtxNamespace Viewer context name space
 * @param {Object} subToolBarCommandState command selection state in subtoolcommand bar
 */
export let setMeasurementSubToolBarCommandState = function( viewerCtxNamespace, subToolBarCommandState ) {
    var currentMeasurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    currentMeasurementCtx.viewerMeasurePickfilterSelectionState = subToolBarCommandState;
};

var _initializeQuickMeasurementContext = function( viewerCtxNamespace ) {
    var viewerCtx = appCtxSvc.getCtx( viewerCtxNamespace );
    var currentMeasurementCtx = viewerCtx.viewerMeasurement;
    if( _.isNull( currentMeasurementCtx ) || _.isUndefined( currentMeasurementCtx ) ) {
        var viewerCtx = appCtxSvc.getCtx( viewerCtxNamespace );
        viewerCtx.viewerMeasurement = {};
        appCtxSvc.updateCtx( viewerCtxNamespace, viewerCtx );
    }
};

var _updateQuickMeasurementContext = function( viewerCtxNamespace, partialPath, value ) {
    var updatedPartialPath = viewerCtxNamespace + '.' + partialPath;
    appCtxSvc.updatePartialCtx( updatedPartialPath, value );
};

var _initializeMeasurementContext = function( viewerCtxNamespace ) {
    var currentMeasurementCtx = _getCurrentViewerMeasurementCtx( viewerCtxNamespace );
    if( _.isNull( currentMeasurementCtx ) || _.isUndefined( currentMeasurementCtx ) ) {
        var currentViewerNamespace = viewerCtxNamespace;
        var viewerCtx = appCtxSvc.getCtx( currentViewerNamespace );
        viewerCtx.viewerMeasurement = {};
        appCtxSvc.updateCtx( currentViewerNamespace, viewerCtx );
    }
};

var _updateMeasurementContext = function( viewerCtxNamespace, partialPath, value ) {
    var updatedPartialPath = viewerCtxNamespace + '.' + partialPath;
    appCtxSvc.updatePartialCtx( updatedPartialPath, value );
};

/**
 * Get current viewer measurement context
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
var _getCurrentViewerMeasurementCtx = function( viewerCtxNamespace ) {
    var viewerCtx = appCtxSvc.getCtx( viewerCtxNamespace );
    return viewerCtx.viewerMeasurement;
};

/**
 * Get quick measurement context
 * @param {Object} viewerCtxNamespace Viewer context name space
 */
var _getViewerQuickMeasurementCtx = function( viewerCtxNamespace ) {
    var viewerCtx = appCtxSvc.getCtx( viewerCtxNamespace );
    return viewerCtx.viewerMeasurement;
};

/**
 * Initialize viewer measurement service
 */
export let initializeViewerMeasurementService = function() {
    /**
     * Subscribe for viewer measurement created event
     */
    eventBus.subscribe( 'viewerMeasurement.create', function() {
        _setSelectedMeasurement();
    }, 'viewerMeasureService' );

    /**
     * Subscribe for viewer measurement selected event
     */
    eventBus.subscribe( 'viewerMeasurement.select', function() {
        _setSelectedMeasurement();
    }, 'viewerMeasureService' );
};

initializeViewerMeasurementService();

export default exports = {
    PickFilters,
    getSelectedMeasurement,
    toggleQuickMeasurementMode,
    setQuickMeasurementPickFilter,
    activateMeasurementMode,
    getSelectedMeasurementLocalizedText,
    getSelectedMeasurementPickFilters,
    setSelectedMeasurementPickFilters,
    deleteSelectedMeasurement,
    deleteAllMeasurement,
    initializeViewerMeasurementService,
    disableMeasurement,
    setPickFilterSelectionStateInSubCommandToolBar,
    getMeasurementSubToolBarCommandState,
    setMeasurementSubToolBarCommandState
};
