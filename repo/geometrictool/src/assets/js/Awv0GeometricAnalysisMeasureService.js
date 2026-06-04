// Copyright (c) 2022 Siemens

/**
 * @module js/Awv0GeometricAnalysisMeasureService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import tcClipboardService from 'js/tcClipboardService';
import viewerCtxSvc from 'js/viewerContext.service';

var exports = {};

/**
 * Activates measurement mode with pickfilters selected
 *
 * @param {String} commandId command id
 * @param {Object} viewerContextData Viewer context data
 */
export let toggleDoubleMeasurementSubCommandsToolbar = function( commandId, viewerContextData ) {
    if( viewerContextData.toggleSubCommandsToolbar( commandId ) ) {
        closeToolAndInfoCommand( viewerContextData );
        viewerContextData.getMeasurementManager().startViewerMeasurement( viewerContextData.getMeasurementManager().MEASUREMENT_MODE.DOUBLE );
    }
};

/**
 * Activates measurement mode with pickfilters selected
 *
 * @param {String} commandId command id
 * @param {Object} viewerContextData Viewer context data
 */
export let toggleSingleMeasurementSubCommandsToolbar = function( commandId, viewerContextData ) {
    if( viewerContextData.toggleSubCommandsToolbar( commandId ) ) {
        closeToolAndInfoCommand( viewerContextData );
        viewerContextData.getMeasurementManager().startViewerMeasurement( viewerContextData.getMeasurementManager().MEASUREMENT_MODE.SINGLE );
    }
};

/**
 * Close any other command panel that was open before Measurement command
 */
export let closeToolAndInfoCommand = function( viewerContextData ) {
    viewerContextData.closeActiveDialog();
    viewerCtxSvc.setDefaultActionNavigation( viewerContextData );//disables default action on measurement mode
};

/**
 * Sets parts as a picking filter and deselects all feature filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let partsSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();

    if( !subToolBarCommandState.partsFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = true;
        subToolBarCommandState.surfaceFilterSelected = false;
        subToolBarCommandState.vertexFilterSelected = false;
        subToolBarCommandState.edgeFilterSelected = false;
        subToolBarCommandState.pointFilterSelected = false;
        subToolBarCommandState.arcCenterFilterSelected = false;
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS );
    } else {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.surfaceFilterSelected = true;
        subToolBarCommandState.vertexFilterSelected = true;
        subToolBarCommandState.edgeFilterSelected = true;
        subToolBarCommandState.pointFilterSelected = true;
        subToolBarCommandState.arcCenterFilterSelected = true;
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_SURFACE );
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_EDGE );
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_VERTEX );
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_POINT );
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_ARC_CENTER );
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets surface as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let surfaceSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();
    if( !subToolBarCommandState.surfaceFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.surfaceFilterSelected = true;
        selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_SURFACE );
    } else {
        if( !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.edgeFilterSelected &&
            !subToolBarCommandState.pointFilterSelected && !subToolBarCommandState.arcCenterFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.surfaceFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_SURFACE );
        } else {
            selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_SURFACE;
            } );
            subToolBarCommandState.surfaceFilterSelected = false;
        }
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets edge as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let edgeSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();
    if( !subToolBarCommandState.edgeFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.edgeFilterSelected = true;
        selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_EDGE );
    } else {
        if( !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.pointFilterSelected && !subToolBarCommandState.arcCenterFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.edgeFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_EDGE );
        } else {
            selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_EDGE;
            } );
            subToolBarCommandState.edgeFilterSelected = false;
        }
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets vertex as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let vertexSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();
    if( !subToolBarCommandState.vertexFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.vertexFilterSelected = true;
        selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_VERTEX );
    } else {
        if( !subToolBarCommandState.edgeFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.pointFilterSelected && !subToolBarCommandState.arcCenterFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.vertexFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_VERTEX );
        } else {
            selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_VERTEX;
            } );
            subToolBarCommandState.vertexFilterSelected = false;
        }
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets point as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let pointSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();
    if( !subToolBarCommandState.pointFilterSelected ) {
        subToolBarCommandState.pointFilterSelected = true;
        subToolBarCommandState.partsFilterSelected = false;
        selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_POINT );
    } else {
        if( !subToolBarCommandState.edgeFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.arcCenterFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.pointFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_POINT );
        } else {
            selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_POINT;
            } );
            subToolBarCommandState.pointFilterSelected = false;
        }
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets arcCenter as a picking filter
 *
 * @param {Object} viewerContextData Viewer context name space
 */
export let arcCenterSelectValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMeasurementManager().getMeasurementSubToolBarCommandState();
    if( !subToolBarCommandState.arcCenterFilterSelected ) {
        subToolBarCommandState.arcCenterFilterSelected = true;
        subToolBarCommandState.partsFilterSelected = false;
        selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_ARC_CENTER );
    } else {
        if( !subToolBarCommandState.edgeFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.pointFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.arcCenterFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_ARC_CENTER );
        } else {
            selectedPickFilters = viewerContextData.getMeasurementManager().getSelectedMeasurementPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMeasurementManager().PICK_FILTERS.PICK_ARC_CENTER;
            } );
            subToolBarCommandState.arcCenterFilterSelected = false;
        }
    }
    viewerContextData.getMeasurementManager().setSelectedMeasurementPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Delete selected measurement
 * @param {Object} viewerContextData Viewer context data
 */
export const deleteSelectedMeasurement = function( viewerContextData ) {
    viewerContextData.getMeasurementManager().deleteSelectedMeasurementFromAW();
};

/**
 * Delete all measurement
 * @param {Object} viewerContextData Viewer context data
 */
export const deleteAllMeasurement = function( viewerContextData ) {
    viewerContextData.getMeasurementManager().deleteAllMeasurements();
};

/**
 * Copy localized text to clipboard
 * @param {Object} data viewmodel data
 * @param {Object} viewerContextData Viewer context data
 */
export let copyMeasurementTextToClipboard = function( data, viewerContextData ) {
    let localizedSelectedMeasurementData = null;
    localizedSelectedMeasurementData = getSelectedMeasurementLocalizedText( viewerContextData, data.i18n );
    var formattedString = [];
    for( let localizedData in localizedSelectedMeasurementData ) {
        formattedString.push( localizedData + ': ' + localizedSelectedMeasurementData[ localizedData ] );
    }
    let verdict = tcClipboardService.copyContentToOSClipboard( formattedString );
    if( verdict === false ) {
        data.copiedMeasurementText = null;
    } else {
        data.copiedMeasurementText = formattedString;
    }
};

/**
 * Get selected measurement object localized text
 *
 * @param {Object} viewerContextData Viewer context data
 * @param {Object} localeBundleText - locale bundle
 * @returns {String} selected measurement localized text
 */
export let getSelectedMeasurementLocalizedText = function( viewerContextData, localeBundleText ) {
    let selectedMeasureObj = viewerContextData.getMeasurementManager().getSelectedMeasurementObject();
    if( selectedMeasureObj ) {
        return _getLocalizedText( selectedMeasureObj, localeBundleText );
    }
};

/**
 * Format the number
 *
 * @param {Number} value - value to be formatted
 * @param {String} locale - user locale
 * @returns {Number} formatted number
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
 * @returns {String} formatted value
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
 *
 * @param {Object} selectedObj selected measurement object
 * @param {Object} localeBundleText locale bundle text
 * @returns {String} localized text
 */
var _getLocalizedText = function( selectedObj, localeBundleText ) {
    var returnValue = {};
    _.forOwn( selectedObj,
        // eslint-disable-next-line complexity
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

export default exports = {
    toggleDoubleMeasurementSubCommandsToolbar,
    toggleSingleMeasurementSubCommandsToolbar,
    partsSelectValueChanged,
    surfaceSelectValueChanged,
    edgeSelectValueChanged,
    vertexSelectValueChanged,
    pointSelectValueChanged,
    arcCenterSelectValueChanged,
    copyMeasurementTextToClipboard,
    deleteSelectedMeasurement,
    deleteAllMeasurement
};
