// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0ViewerSettingsService
 */
import { getBaseUrlPath } from 'app';
import viewerPreferenceService from 'js/viewerPreference.service';
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import _ from 'lodash';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import listBoxService from 'js/listBoxService';
import modelPropertySvc from 'js/modelPropertyService';
import viewerContextService from 'js/viewerContext.service';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import viewerSessionStorageService from 'js/viewerSessionStorageService';
import viewerOcclusionCullingService from 'js/viewerOcclusionCullingService';
import logger from 'js/logger';
import viewerIndexedDbService from 'js/viewerIndexedDbService';
import preferenceService from 'soa/preferenceService';
import viewerGraphicsSupportService from 'js/viewerGraphicsSupportService';
import viewerCtxSvc from 'js/viewerContext.service';
import viewerOrientationService from 'js/viewerOrientationService';

var exports = {};

var Units = {
    MILLIMETERS: 1,
    CENTIMETERS: 2,
    METERS: 3,
    INCHES: 4,
    FEET: 5,
    YARDS: 6,
    MICROMETERS: 7,
    DECIMETERS: 8,
    KILOMETERS: 9,
    MILS: 10
};

let occCullingUIMap = {
    Standard: 0,
    Fast: 1,
    Faster: 2,
    Fastest: 3
};

let stdViewOrientationUIArray = [
    'AUTOMOTIVE',
    'AEROSPACE',
    'CUSTOM'
];

const THEME_FROM_SESSION = 'From Session';

/**
 * offset delta value to be used for calculating floor offset
 */
var m_offsetDelta = 0.5;

const MIN_HIGHLIGHT_DELAY = 0;
const MAX_HIGHLIGHT_DELAY = 2;

var materialData = [ { iconName: '01ShinyMetal', tooltip: getLocalizedText( 'materialTooltip1' ) },
    { iconName: '02BrushedMetal', tooltip: getLocalizedText( 'materialTooltip2' ) },
    { iconName: '03ShinyPlastic', tooltip: getLocalizedText( 'materialTooltip3' ) },
    { iconName: '04Analysis', tooltip: getLocalizedText( 'materialTooltip4' ) },
    { iconName: '05Flat', tooltip: getLocalizedText( 'materialTooltip5' ) },
    { iconName: '06RedGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip6' ) },
    { iconName: '07BlueGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip7' ) },
    { iconName: '08GreenGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip8' ) },
    { iconName: '09GrayGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip9' ) },
    { iconName: '10BlackGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip10' ) },
    { iconName: '11BrownGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip11' ) },
    { iconName: '12YellowGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip12' ) },
    { iconName: '13TealGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip13' ) },
    { iconName: '14WhiteGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip14' ) },
    { iconName: '15ClearPlastic', tooltip: getLocalizedText( 'materialTooltip15' ) },
    { iconName: '16Chrome', tooltip: getLocalizedText( 'materialTooltip16' ) },
    { iconName: '17Copper', tooltip: getLocalizedText( 'materialTooltip17' ) },
    { iconName: '18Gold', tooltip: getLocalizedText( 'materialTooltip18' ) },
    { iconName: '19Brass', tooltip: getLocalizedText( 'materialTooltip19' ) },
    { iconName: '20Steel', tooltip: getLocalizedText( 'materialTooltip20' ) },
    { iconName: '21BrushedChrome', tooltip: getLocalizedText( 'materialTooltip21' ) },
    { iconName: '22BrushedAluminum', tooltip: getLocalizedText( 'materialTooltip22' ) },
    { iconName: '23Titanium', tooltip: getLocalizedText( 'materialTooltip23' ) },
    { iconName: '24Glass', tooltip: getLocalizedText( 'materialTooltip24' ) },
    { iconName: '25SmokeyGlass', tooltip: getLocalizedText( 'materialTooltip25' ) },
    { iconName: '26RedPaint', tooltip: getLocalizedText( 'materialTooltip26' ) },
    { iconName: '27GrayPaint', tooltip: getLocalizedText( 'materialTooltip27' ) },
    { iconName: '28BlackPaint', tooltip: getLocalizedText( 'materialTooltip28' ) },
    { iconName: '29BluePaint', tooltip: getLocalizedText( 'materialTooltip29' ) },
    { iconName: '30Rubber', tooltip: getLocalizedText( 'materialTooltip30' ) }
];

const VIEW_PREF_PMI_CHECKED_PATH = 'viewerPreference.pmiChecked'; //$NON-NLS-1$
const VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH = viewerContextService.VIEWER_NAMESPACE_TOKEN + '.isTransparencyUpdated'; //$NON-NLS-1$

/**
 * Viewer settings panel revealed
 *
 * @function viewerSettingsPanelReveal
 *
 * @param {Object} viewerContextData viewer context data
 * @param {Object} shadedCheckboxProp shaded property
 * @param {Object} navigationRadioProp navigation property[Walk/Examine]
 * @param {Object} useIndexedCheckboxProp useIndexed property
 * @param {Object} modelTitleProp modelTitle property
 * @param {Object} unitTextProp unitText property
 * @param {Object} localeTextBundle localized text
 * @param {Object} renderSourceRadioProp Render Source property (SSR/CSR)
 * @param {Object} modelName model name
 * @param {Object} visAllOnCheckboxProp vis all on view model prop
 * @param {Object} mouseGestureProp mouse gesture view model prop
 * @param {Object} popupId popup id
 * @param {Object} navCubeCheckboxProp navcube checkbox view model prop
 * @param {Object} trihedronCheckboxProp trihedron checkbox view model prop
 * @param {Object} fitTypeRadioProp fit type view model prop
 * @param {Object} useHighlightPartsOnMouseHoverProp use highlight parts on hover view model prop
 * @param {Object} hoverHighlightDelayProp  delay(in seconds) to highlight parts after mouse hover
 * @returns {Object} object containing updated view model prop
 */
export let viewerSettingsPanelRevealed = function( viewerContextData, shadedCheckboxProp, navigationRadioProp, useIndexedCheckboxProp, modelTitleProp, unitTextProp, localeTextBundle, renderSourceRadioProp,
    modelName, visAllOnCheckboxProp, mouseGestureProp, popupId, navCubeCheckboxProp, trihedronCheckboxProp, fitTypeRadioProp, useHighlightPartsOnMouseHoverProp, hoverHighlightDelayProp ) {
    const _unitTextProp = _.clone( unitTextProp );
    const _useIndexedCheckboxProp = _.clone( useIndexedCheckboxProp );
    const _modelTitleProp = _.clone( modelTitleProp );
    const _navigationRadioProp = _.clone( navigationRadioProp );
    let renderSource = viewerContextData.getValueOnViewerAtomicData( 'renderLocation' );

    if( !viewerContextData.isMMVRendering() ) {
        updateViewModelProp( shadedCheckboxProp, viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData ) );
    }
    if( visAllOnCheckboxProp && visAllOnCheckboxProp.update ) {
        visAllOnCheckboxProp.update( viewerPreferenceService.getPreferenceValue( viewerPreferenceService.ALL_ON, viewerContextData ), { isEnabled: true }, { markModified: true } );
    }
    if( useHighlightPartsOnMouseHoverProp && useHighlightPartsOnMouseHoverProp.update ) {
        useHighlightPartsOnMouseHoverProp.update( viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER,
            viewerContextData ), { isEnabled: true }, { markModified: true } );
    }
    if( hoverHighlightDelayProp && hoverHighlightDelayProp.update ) {
        hoverHighlightDelayProp.update( viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY,
            viewerContextData ) );
    }
    updateViewModelProp( mouseGestureProp, viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING, viewerContextData ) !== 'NX' );
    if( renderSource === 'CSR' ) {
        updateViewModelProp( navCubeCheckboxProp, viewerPreferenceService.getTrihedronVisibility( viewerContextData ) );
    }
    if( renderSource === 'SSR' ) {
        updateViewModelProp( trihedronCheckboxProp, viewerPreferenceService.getTrihedronVisibility( viewerContextData ) );
    }
    updateViewModelProp( fitTypeRadioProp, viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIS_FIT_TYPE, viewerContextData ) !== 'Spherical' );
    _navigationRadioProp.isEnabled = navigator.userAgent.indexOf( 'iPad' ) < 0; // not supported on ipad
    _navigationRadioProp.dbValue = viewerPreferenceService.getPreferenceValue( viewerPreferenceService.THREED_NAVIGATION_MODE_PREF, viewerContextData ) ===
        viewerPreferenceService.THREED_NAVIGATION_MODE_VALUE_MAP.EXAMINE;
    let hasAlternatePCI = viewerContextData.getHasAlternatePCI();
    if( hasAlternatePCI ) {
        _useIndexedCheckboxProp.isVisible = true;
        let alternatePCI = viewerPreferenceService.getUseAlternatePCIPreference();
        if( alternatePCI === 'INDEXED' ) {
            _useIndexedCheckboxProp.dbValue = true;
        } else {
            _useIndexedCheckboxProp.dbValue = false;
        }
    } else {
        _useIndexedCheckboxProp.isVisible = false;
    }
    var modelUnit = viewerPreferenceService.getModelUnit( viewerContextData );
    var displayUnit = viewerPreferenceService.getDisplayUnit( viewerContextData );
    for( var key in Units ) {
        if( Units[ key ] === modelUnit ) {
            _modelTitleProp.uiValue = localeTextBundle[ key.toLowerCase() ];
        }
        if( Units[ key ] === displayUnit ) {
            _unitTextProp.uiValue = localeTextBundle[ key.toLowerCase() ];
        }
    }
    updateViewModelProp( renderSourceRadioProp, renderSource === 'SSR' );
    var viewerCurrProdCtx = viewerContextData.getCurrentViewerProductContext();
    var currentProductProperties = viewerCurrProdCtx.props;
    modelName.uiValue = currentProductProperties.object_name !== undefined ? currentProductProperties.object_name.dbValues[ 0 ] : currentProductProperties.object_string.dbValues[ 0 ];
    let _renderSupportInfo = viewerSessionStorageService.getViewerDataFromSessionStorage( 'renderSupportInfo' );
    viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, popupId );
    return {
        navigationRadioProp: _navigationRadioProp,
        useIndexedCheckboxProp: _useIndexedCheckboxProp,
        modelTitleProp: _modelTitleProp,
        unitTextProp: _unitTextProp,
        modelName: modelName,
        renderSupportInfo: _renderSupportInfo
    };
};

/**
 * Init PMI setting on reveal
 *
 * @function initPMISetting
 * @param {Object} viewerContextData this contains value of viewer context data from ctx.panelContext
 * @param {Object} pmiCheckboxProp PMI checkbox view model prop
 * @returns {Object} updated pmi checkbox prop
 */
export let initPMISetting = function( viewerContextData, pmiCheckboxProp ) {
    let pmiMgr = viewerContextData.getPmiManager();
    if( pmiMgr ) {
        return pmiMgr.getHasPMI()
            .then( function( hasPMI ) {
                if( hasPMI ) {
                    return pmiMgr.getInPlane( viewerContextData ).then( function( inPlane ) {
                        viewerContextData.updateViewerAtomicData( VIEW_PREF_PMI_CHECKED_PATH, inPlane );
                        if( !inPlane ) {
                            exports.setPMIFaltToScreen( viewerContextData, true );
                            return updateShowPMIFlatToScreenTrue( pmiCheckboxProp );
                        }
                        return updateShowPMIFlatToScreenFalse( pmiCheckboxProp );
                    } );
                }
                return pmiCheckboxProp;
            } );
    }
    return null;
};

/**
 * Reveal Background theme properties
 * @param {Object} themeViewModelProp theme view model prop
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} edited theme properties
 */
export let revealBackgroundThemeProp = function( themeViewModelProp, viewerContextData ) {
    let deferred = AwPromiseService.instance.defer();
    let threeDViewMgr = viewerContextData.getThreeDViewManager();
    if( threeDViewMgr ) {
        threeDViewMgr.getBackgroundColorThemes().then( function( themesList ) {
            let internalValues = [];
            let values = [];
            let themeToDisplay;
            let themeIndexDisplay;
            let colorThemeToDisplay;
            let colorThemeToDisplayIndex;
            let colorTheme = viewerPreferenceService.getColorTheme( viewerContextData );
            for( let i = 0; i < themesList.length; i++ ) {
                let themeCurrentObject = JSON.parse( themesList[ i ] );
                themeToDisplay = themeCurrentObject.Name;
                themeIndexDisplay = themeCurrentObject.Index;
                if( themeToDisplay === THEME_FROM_SESSION && colorTheme[ 0 ] === themeIndexDisplay ) {
                    themeToDisplay = getLocalizedText( 'fromSession' );
                    colorThemeToDisplay = getLocalizedText( 'fromSession' );
                    colorThemeToDisplayIndex = themeIndexDisplay;
                } else if( colorTheme[ 0 ] === themeIndexDisplay ) {
                    colorThemeToDisplay = themeToDisplay;
                    colorThemeToDisplayIndex = themeIndexDisplay;
                }
                internalValues[ i ] = themeIndexDisplay;
                values[ i ] = themeToDisplay;
            }

            let themeProp = { ...themeViewModelProp };
            let editData = {};
            themeProp.dbValue = colorThemeToDisplayIndex;
            themeProp.dispValue = colorThemeToDisplay;
            themeProp.uiValue = colorThemeToDisplay;

            let colorThemeList = listBoxService.createListModelObjectsFromStrings( values );
            for( let j = 0; j < internalValues.length; j++ ) {
                colorThemeList[ j ].propInternalValue = internalValues[ j ];
                colorThemeList[ j ].propDisplayValue = values[ j ];
            }
            editData = {
                themeProp: themeProp,
                colorThemeList: colorThemeList
            };
            deferred.resolve( editData );
        }, function( reason ) {
            deferred.reject( 'viewerRender: Failed to get list of Themes:' + reason );
        } );
    } else {
        deferred.reject( 'viewerRender: Failed to get list of Themes:' );
    }
    return deferred.promise;
};

/**
 * Update material field property with newly selected material theme index from popup
 *
 * @function materialThemeSelected
 * @param {String} index selected theme index
 * @param {Object} materialProp material field property
 */
export let materialThemeSelected = function( index, materialProp ) {
    let _materialProp = { ...materialProp.value };
    if( index && _materialProp.materialIndex !== index ) {
        _materialProp.materialIndex = index;
        materialProp.update( _materialProp );
    }
};
/**
 * Prepare list of material themes with field data
 *
 * @function initializeMaterialThemesList
 * @param {Array} lstMaterialGridProp this contains list of material property
 * @param {Object} fieldMaterialProp this contains field material property
 * @returns {Array} list of Material Themes List with field data
 */
export let initializeMaterialThemesList = function( lstMaterialGridProp, fieldMaterialProp ) {
    return lstMaterialGridProp.map( prop => {
        return { ...prop, fieldMaterialProp: fieldMaterialProp };
    } );
};

/**
 * Generate viewModel property for material theme
 *
 * @function generateMaterialThemeProp
 * @param {Object} materialGridProp this contains material property
 * @returns {Object} viewModel propetry for material property
 */
export let generateMaterialThemeProp = function( materialGridProp ) {
    return modelPropertySvc.createViewModelProperty( materialGridProp );
};

/**
 * Set shaded mode in viewer
 *
 * @function shadedWithEdgesSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 * @returns {Boolean} viewer options changed outside 3D or not
 */
export let shadedWithEdgesSettingChanged = function( viewerContextData, isChecked ) {
    if( viewerContextData && viewerContextData.getThreeDViewManager() ) {
        viewerContextData.getThreeDViewManager().setBasicDisplayMode( isChecked ? 1 : 0 ).then( function() {
            viewerPreferenceService.setShadedWithEdgesPreference( isChecked, viewerContextData );
            viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.PVW_CONTEXT_MENU, { pvwContext: 'shadedwithEdgesSelected' } );
        } );
    } else {
        viewerPreferenceService.setShadedWithEdgesPreference( isChecked );
    }
    return !viewerContextData;
};

/**
 * Move manipulator position is changed in viewer
 *
 * @function moveManipulatorDefPosChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} posSelected - true if checked
 * @returns {Boolean} viewer options changed outside 3D or not
 */
export let moveManipulatorDefPosChanged = function( viewerContextData, posSelected ) {
    if( viewerContextData && viewerContextData.getThreeDViewManager() ) {
        viewerPreferenceService.setMoveManipulatorPos( posSelected.dbValue, viewerContextData );
    } else {
        viewerPreferenceService.setMoveManipulatorPos( posSelected.dbValue );
    }
    return !viewerContextData;
};


/**
 * Reveals meterial related props
 * @param {Object} viewerContextData viewer context data
 * @param {Object} materialProp material view model prop
 * @param {Object} floorPlanProp floor plane view model prop
 * @param {Object} floorPlanPropValues floor plane values
 * @param {Object} showFloorCheckboxProp show floor checkbox view model pro
 * @param {Object} materialCheckboxProp material checkbox view model prop
 * @param {Object} gridCheckboxProp grid check box view model prop
 * @param {Object} shadowCheckboxProp shadow check box view model prop
 * @param {Object} reflectionCheckboxProp reflection view model prop
 * @returns {Object} modified view model object
 */
let revealMaterialProps = ( viewerContextData, materialProp, floorPlanProp, floorPlanPropValues, showFloorCheckboxProp, materialCheckboxProp, gridCheckboxProp,
    shadowCheckboxProp, reflectionCheckboxProp ) => {
    const _materialProp = _.clone( materialProp );
    const _floorPlanProp = _.clone( floorPlanProp );
    let materialIndex = viewerPreferenceService.getPreferenceValue( viewerPreferenceService.MATERIAL, viewerContextData );
    _materialProp.materialIndex = materialIndex;
    _materialProp.iconName = materialData[ parseInt( materialIndex ) ].iconName;
    _materialProp.tooltip = materialData[ parseInt( materialIndex ) ].tooltip;
    _materialProp.iconUrl = getBaseUrlPath() + '/image/cmd' + materialData[ parseInt( materialIndex ) ].iconName + '24.svg';
    let floorVal = viewerPreferenceService.getPreferenceValue( viewerPreferenceService.FLOOR_ORIENTATION, viewerContextData );
    for( let i = 0; i < floorPlanPropValues.dbValue.length; i++ ) {
        if( floorVal === floorPlanPropValues.dbValue[ i ].propInternalValue ) {
            let floorPlanVal = floorPlanPropValues.dbValue[ i ];
            _floorPlanProp.dbValue = floorPlanVal.propInternalValue;
            _floorPlanProp.uiValue = floorPlanVal.propDisplayValue;
            _floorPlanProp.iconName = floorPlanVal.iconName;
            break;
        }
    }
    let vqsceneManager = viewerContextData.getVqSceneManager();
    return Promise.all( [ vqsceneManager.isTrueShadeEnabled(), vqsceneManager.areMaterialsEnabled(), vqsceneManager.getFloor(), vqsceneManager.getFloorGrid(), vqsceneManager.isFloorShadowEnabled(),
        vqsceneManager.isFloorReflectionEnabled()
    ] ).then( ( responses ) => {
        updateViewModelProp( materialCheckboxProp, responses[ 1 ] );
        updateViewModelProp( showFloorCheckboxProp, responses[ 2 ] );
        updateViewModelProp( gridCheckboxProp, responses[ 3 ] );
        updateViewModelProp( shadowCheckboxProp, responses[ 4 ] );
        updateViewModelProp( reflectionCheckboxProp, responses[ 5 ] );
        return {
            materialProp: _materialProp,
            floorPlanProp: _floorPlanProp,
            isTrueShadeEnabled: responses[ 0 ]
        };
    } );
};

/**
 * Set vis All on preference
 *
 * @function visAllOnSettingChanged
 * @param {boolean} isChecked - true if checked
 * @param {Object} viewerContextData Viewer Context Data
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let visAllOnSettingChanged = function( isChecked, viewerContextData ) {
    viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.ALL_ON, isChecked, true, viewerContextData );
    return !viewerContextData;
};

/**
 * Apply true shading material in viewer
 *
 * @function materialSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let materialSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableMaterials( isChecked ).then( function() {
        viewerPreferenceService.setApplyTrueShadingMaterial( isChecked, viewerContextData );
    } );
};

/**
 * Set trihedron setting for viewer
 * @function trihedronSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let trihedronSettingChanged = function( viewerContextData, isChecked ) {
    viewerPreferenceService.setTrihedronVisibility( isChecked, viewerContextData );
    if( viewerContextData ) {
        viewerContextData.getDrawTrislingManager().drawTrihedron( isChecked );
    }
    return !viewerContextData;
};

/**
 * Set Navigation cube setting for viewer
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
let navCubeCheckboxPropSettingChanged = function( viewerContextData, isChecked ) {
    viewerPreferenceService.setTrihedronVisibility( isChecked, viewerContextData );
    if( viewerContextData ) {
        viewerContextData.getDrawTrislingManager().drawNavCube( isChecked );
        viewerContextData.getDrawTrislingManager().drawTrihedron( isChecked );
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.PVW_CONTEXT_MENU, { pvwContext: 'trihedronChanged' } );
    }
    return !viewerContextData;
};

/**
 * Revert render setting to SSR/CSR
 *
 * @function revertRenderSetting
 *
 * @param {Object} renderSourceRadioProp - render Source[SSR/CSR] property
 * @param {Object} renderOptionEvent - Revert to SSR/CSR
 *
 * @returns {Object} render Source property
 */
export let revertRenderSetting = function( renderSourceRadioProp, renderOptionEvent ) {
    var _renderSourceRadioProp = _.clone( renderSourceRadioProp );

    if( renderOptionEvent === 'RevertToSSR' ) {
        _renderSourceRadioProp.dbValue = true;
    }
    return {
        renderSourceRadioProp: _renderSourceRadioProp
    };
};

/**
 * Reset render source option on user cancellation
 *
 * @function renderSourceChangeCancelled
 *
 * @param {Object} renderSourceRadioProp - render Source property
 *
 * @returns {Object} render Source property
 */
export let renderSourceChangeCancelled = function( renderSourceRadioProp ) {
    const _renderSourceRadioProp = _.clone( renderSourceRadioProp );
    _renderSourceRadioProp.dbValue = !_renderSourceRadioProp.dbValue;
    return {
        renderSourceRadioProp: _renderSourceRadioProp
    };
};

/**
 * set render source as server in UI
 *
 * @function viewerRenderSourceChanged
 * @param {Object} viewerCurrCtx this contains Viewer Context Data
 * @param {Object} renderSourceRadioProp - render Source property
 * @returns {String} which render option changed
 */
export let viewerRenderSourceChanged = function( viewerCurrCtx, renderSourceRadioProp ) {
    let renderOptionEvent = null;
    if( renderSourceRadioProp.dbValue ) {
        renderOptionEvent = 'Server';
    } else {
        if( viewerCurrCtx.isMMVRendering() ) {
            messagingService.showInfo( viewerCurrCtx.getThreeDViewerMsg( 'mmvDataNotViewable' ) );
            renderOptionEvent = 'RevertToSSR';
        } else {
            renderOptionEvent = 'Client';
        }
    }
    return {
        renderOptionEvent: renderOptionEvent
    };
};

/**
 * Updates mouse Gesture Setting on team center preference
 * @param {Object} viewerContextData viewer context data
 * @param {Object} mouseGestureProp mouse gesture prop
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let mouseGestureSettingChanged = function( viewerContextData, mouseGestureProp ) {
    let gestureMode = 'AW';
    if( mouseGestureProp.dbValue === false ) {
        gestureMode = 'NX';
        viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING, gestureMode, true, viewerContextData );
        if( viewerContextData ) {
            viewerCtxSvc.setNXMouseGesture( viewerContextData );
        }
    } else {
        viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING, gestureMode, true, viewerContextData );
        if( viewerContextData ) {
            viewerCtxSvc.setAWMouseGesture( viewerContextData );
        }
    }
    return !viewerContextData;
};

/**
 * Set floor setting for viewer
 *
 * @function showFloorSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let showFloorSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().setFloor( isChecked );
    viewerPreferenceService.setFloorVisibility( isChecked, viewerContextData );
};

/**
 * Set grid setting for viewer
 *
 * @function gridSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let gridSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().setFloorGrid( isChecked );
    viewerPreferenceService.setGridVisibility( isChecked, viewerContextData );
};

/**
 * Set shadow setting for viewer
 *
 * @function shadowSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let shadowSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableFloorShadow( isChecked ).then( function() {
        viewerPreferenceService.setShadowVisibility( isChecked, viewerContextData );
    } );
};

/**
 * Set reflection setting for viewer
 *
 * @function reflectionSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let reflectionSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableFloorReflection( isChecked ).then( function() {
        viewerPreferenceService.setReflectionVisibility( isChecked, viewerContextData );
    } );
};

/**
 * Set navigation 3D mode for viewer
 *
 * @function navigationSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let navigationSettingChanged = function( viewerContextData, isChecked ) {
    if( isChecked ) {
        if( viewerContextData ) {
            viewerContextData.getNavigationManager().setManipulatorType( viewerPreferenceService.THREED_NAVIGATION_MODE_VALUE_MAP.EXAMINE ); /* 1: EXAMINE */
        }
        viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.THREED_NAVIGATION_MODE_PREF, viewerPreferenceService.THREED_NAVIGATION_MODE_NAME_MAP.EXAMINE, true, viewerContextData );
    } else {
        if( viewerContextData ) {
            viewerContextData.getNavigationManager().setManipulatorType( viewerPreferenceService.THREED_NAVIGATION_MODE_VALUE_MAP.WALK ); /* 0: WALK */
        }
        viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.THREED_NAVIGATION_MODE_PREF, viewerPreferenceService.THREED_NAVIGATION_MODE_NAME_MAP.WALK, true, viewerContextData );
    }
    return !viewerContextData;
};

/**
 * Upade material widget
 * @param {Object} viewerContextData viewer context data
 * @param {Object} materialIndex mter
 * @param {Object} materialProp material view model property
 * @returns {Object} modified view model object
 */
export let updateMaterialWidget = function( viewerContextData, materialIndex, materialProp ) {
    const _materialProp = _.clone( materialProp );
    if( materialIndex === null ) {
        return _materialProp;
    }

    _materialProp.iconName = materialData[ materialIndex ].iconName;
    _materialProp.iconUrl = getBaseUrlPath() + '/image/cmd' + materialData[ materialIndex ].iconName + '24.svg';
    _materialProp.tooltip = materialData[ materialIndex ].tooltip;
    _materialProp.materialIndex = materialIndex;

    viewerContextData.getVqSceneManager().setGlobalMaterial( parseInt( materialIndex ) );
    viewerPreferenceService.setGlobalMaterial( materialIndex, viewerContextData );
    return { materialProp: _materialProp };
};

/**
 * Handle slider change event
 *
 * @function handleSliderChangeEvent
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Number} sliderValue - new slider value
 * @param {Object} floorSliderProp - slider property
 *
 * @returns {Object} floor slider modified property
 */
export let handleSliderChangeEvent = function( viewerContextData, sliderValue, floorSliderProp ) {
    var _floorSliderProp = _.clone( floorSliderProp );
    var currentOffset = viewerPreferenceService.getFloorOffset( viewerContextData );
    var newOffsetValue = null;
    if( sliderValue > 50 ) {
        newOffsetValue = currentOffset + m_offsetDelta;
    } else if( sliderValue < 50 ) {
        newOffsetValue = currentOffset - m_offsetDelta;
    }
    if( newOffsetValue !== null ) {
        viewerContextData.getVqSceneManager().setFloorOffset( newOffsetValue );
        viewerPreferenceService.setFloorOffset( newOffsetValue, viewerContextData );

        if( _floorSliderProp !== null ) {
            _floorSliderProp.dbValue[ 0 ].sliderOption.value = 50;
        }
    }
    return _floorSliderProp;
};

/**
 * Handle floor plane change event
 *
 * @function viewerFloorPlaneChanged
 *
 * @param {String} planeId - new viewer plane id
 * @param {Object} viewerContextData - this contains Viewer Context Data
 */
export let viewerFloorPlaneChanged = function( planeId, viewerContextData ) {
    viewerContextData.getVqSceneManager().setFloorPlaneOrientation( parseInt( planeId ) );
    viewerPreferenceService.setFloorOrientation( planeId, viewerContextData );
};

/**
 * Set pmi flat to screen visibility to false
 * @param {Object} pmiCheckboxProp pmi checkbox view model property
 * @returns {Object} modified pmi checkbox prop
 */
export let updateShowPMIFlatToScreenFalse = function( pmiCheckboxProp ) {
    if( !pmiCheckboxProp ) {
        return pmiCheckboxProp;
    }
    const _pmiCheckboxProp = _.clone( pmiCheckboxProp );
    _pmiCheckboxProp.isVisible = true;
    _pmiCheckboxProp.dbValue = false;
    return _pmiCheckboxProp;
};

/**
 * Set pmi flat to screen visibility to true
 * @param {Object} pmiCheckboxProp pmi checkbox view model property
 * @returns {Object} modified pmi checkbox prop
 */
export let updateShowPMIFlatToScreenTrue = function( pmiCheckboxProp ) {
    if( !pmiCheckboxProp ) {
        return pmiCheckboxProp;
    }
    const _pmiCheckboxProp = _.clone( pmiCheckboxProp );

    _pmiCheckboxProp.isVisible = true;
    _pmiCheckboxProp.dbValue = true;

    return _pmiCheckboxProp;
};

/**
 * Cleanup on Viewer Setting panel close
 * @param {object} viewerContextData viewer context data
 * @param {object} subPanelContext subpanel context
 * @param {Boolean} viewerSettingChangedOutside3D viewer setting was changed outside 3D or not
 * @returns {Boolean} viewer setting was changed outside 3D or not
 */
export let cleanupViewerSettingPanelAction = function( viewerContextData, subPanelContext, viewerSettingChangedOutside3D ) {
    if( appCtxSvc.getCtx( VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH ) !== undefined ) {
        appCtxSvc.unRegisterCtx( VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH );
    }
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, null );
    } else {
        if( subPanelContext && subPanelContext.occContext && _.isFunction( subPanelContext.occContext.getValue ) ) {
            let _viewerDataOutside3D = _.get( subPanelContext.occContext.getValue(), 'viewerDataOutside3D' );
            if( _viewerDataOutside3D ) {
                _viewerDataOutside3D.popupId = null;
                const newOccContextData = { ...subPanelContext.occContext.getValue() };
                _.set( newOccContextData, 'viewerDataOutside3D', _viewerDataOutside3D );
                subPanelContext.occContext.update( newOccContextData );
            }
            if( viewerSettingChangedOutside3D === true ) {
                appCtxSvc.updatePartialCtx( 'viewer.viewerSettingChanged', true );
            }
        }
    }
    return false;
};

/**
 * Set selection display mode
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {String} isUseTransparency is use transparency value
 */
export let useTransparencySettingChanged = function( viewerContextData, isUseTransparency ) {
    viewerContextService.styleSelection( viewerContextData, isUseTransparency );
};

/**
 * Set selection display mode
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {String} isHighlightOnMouseHover is use higlight on mouse hover
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let useHighlightPartsOnMouseHoverChanged = function( viewerContextData, isHighlightOnMouseHover ) {
    viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, isHighlightOnMouseHover, true, viewerContextData );
    if( viewerContextData ) {
        viewerContextData.highlightPartsOnMouseHoverChanged( isHighlightOnMouseHover, viewerContextData );
    }
    return !viewerContextData;
};

/**
 * Set delay to highlight parts or showing tootip when mouse hover on part
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Object} hoverHighlightDelay  delay(in seconds) to highlight parts after mouse hover
 * @param {Object} hoverHighlightDelayTimer  holds timer object for to update preference. This is to avoid mutiple calls to server when user still typing
 */
export let hoverHighlightDelayChanged = function( viewerContextData, hoverHighlightDelay, hoverHighlightDelayTimer ) {
    if ( hoverHighlightDelayTimer && hoverHighlightDelayTimer.timerInstance ) {
        AwTimeoutService.instance.cancel( hoverHighlightDelayTimer.timerInstance );
    }

    let delay = parseFloat( hoverHighlightDelay );

    //Check if hoverHighlightDelay value is same as stored in preference no need to process
    let delayPref = preferenceService.getLoadedPrefs()[viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY];
    if ( delayPref && delayPref.length > 0 ) {
        let delayPrefVal = parseFloat( delayPref[0] );
        if ( delayPrefVal === delay ) {
            return {
                viewerSettingChangedOutside3D: false,
                hoverHighlightDelayTimer: null
            };
        }
    }
    if ( _.isNumber( delay ) && delay >= MIN_HIGHLIGHT_DELAY && delay <= MAX_HIGHLIGHT_DELAY ) {
        let _hoverHighlightDelayTimer = new Object();
        _hoverHighlightDelayTimer.timerInstance = AwTimeoutService.instance( () => {
            viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY, delay, true, viewerContextData );
            if ( viewerContextData ) {
                viewerContextData.hoverHighlightDelayChanged( delay );
            }
        }, 1000 );
        return {
            viewerSettingChangedOutside3D: !viewerContextData,
            hoverHighlightDelayTimer: _hoverHighlightDelayTimer
        };
    }
    return {
        viewerSettingChangedOutside3D: !viewerContextData,
        hoverHighlightDelayTimer: null
    };
};

/**
 * Set Indexed/Non-Indexed Model
 *
 * @param {Object} viewerContextData viewer context data
 * @param {Object} useIndexedCheckboxProp object with new Indexed Mode
 */
export let useIndexedSettingChanged = function( viewerContextData, useIndexedCheckboxProp ) {
    var optionValue = useIndexedCheckboxProp.dbValue ? 'INDEXED' : 'NON_INDEXED';
    viewerPreferenceService.setUseAlternatePCIPreference( optionValue, viewerContextData.getOccmgmtContextKey() );
};

/**
 * To set PMI flat to screen
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Boolean} setFlatToScreen - Boolean flag to indicate if PMI should be set flat to screen or not.
 */
export let setPMIFaltToScreen = function( viewerContextData, setFlatToScreen ) {
    let pmiMgr = viewerContextData.getPmiManager();
    if( pmiMgr ) {
        pmiMgr.setInPlane( !setFlatToScreen ).then( function() {
            viewerPreferenceService.setPMIOption( setFlatToScreen, viewerContextData );
        } );
    }
};

/**
 * Set Display unit
 * @param {Object} viewerContextData viewer context data
 * @param {Object} selectedUnit selected unit
 * @param {Object} localeTextBundle locale text bundle
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let setDisplayUnit = function( viewerContextData, selectedUnit, localeTextBundle ) {
    var selDisplayUnit = Object.keys( localeTextBundle ).find( function( key ) {
        return localeTextBundle[ key ] === selectedUnit;
    } );
    var unitConst = Units[ selDisplayUnit.toUpperCase() ];
    viewerPreferenceService.setDisplayUnit( unitConst, viewerContextData );
    if( viewerContextData && viewerContextData.getThreeDViewManager() ) {
        viewerContextData.getThreeDViewManager().setDisplayUnit( unitConst );
    }
    return !viewerContextData;
};

/**
 * Set Occlusion culling
 * @param {Object} viewerContextData viewer context data
 * @param {Number} currentValue value selected in UI
 * @param {Object} productContext product context
 * @return {Promise} Promise which on resolved setting occlusion culling with action is executed outside 3D or not on the basis of viewer context data availability
 */
export let setOccCulling = function( viewerContextData, currentValue, productContext ) {
    return viewerOcclusionCullingService.getOccCulling( productContext ).then( ( occCullingValue ) => {
        let uiIndex = _getOccCullingInternalValueIndex( occCullingValue );
        if( uiIndex !== undefined && uiIndex !== currentValue.dbValue ) {
            let occCullingMode = Object.keys( occCullingUIMap ).find( key => occCullingUIMap[ key ] === currentValue.dbValue );
            viewerOcclusionCullingService.setOccCulling( occCullingMode, productContext, viewerContextData );
            if( viewerContextData ) {
                if( uiIndex === 0 && currentValue.dbValue > 0 || uiIndex > 0 && currentValue.dbValue === 0 ) {
                    eventBus.publish( 'occculling.update', {} );
                } else {
                    if( viewerContextData.getPerformanceManager() ) {
                        viewerContextData.getPerformanceManager().setOcclusionCulling( viewerOcclusionCullingService.getOccCullingValue( occCullingMode ) );
                    }
                }
            }
            return !viewerContextData;
        }
    } );
};

/**
 * Return occlusion culling ui internal value index
 * @param {Number} occCullingValue occlusion culling value
 * @returns {Number} uiIndex
 */
let _getOccCullingInternalValueIndex = ( occCullingValue ) => {
    let occCullingValueKey = Object.keys( viewerOcclusionCullingService.CSRLoadingStrategy ).find( key => viewerOcclusionCullingService.CSRLoadingStrategy[ key ] === occCullingValue );
    return Object.values( occCullingUIMap ).find( value => occCullingUIMap[ occCullingValueKey ] === value );
};

/*
 * Set occlusion culling in UI after panel reveal
 * @param {Object} occCullProp occlusion culling view model prop
 * @param {Object} occCullingList occlusion culling list of values
 * @param {Object} viewerContextData viewer context data
 * @returns {object} modified occlusion culling prop
 */
export let viewerSettingsPanelRevealOccCullingProp = function( occCullProp, occCullingList, productContext ) {
    if( occCullProp.dbValue === '' ) {
        return viewerOcclusionCullingService.getOccCulling( productContext ).then( ( occCullingValue ) => {
            let uiIndex = _getOccCullingInternalValueIndex( occCullingValue );
            if( occCullingValue !== undefined ) {
                let retOccCullProp = { ...occCullProp };
                retOccCullProp.dbValue = occCullingList.dbValue[ uiIndex ].propInternalValue;
                retOccCullProp.dispValue = occCullingList.dbValue[ uiIndex ].propDisplayValue;
                retOccCullProp.uiValue = occCullingList.dbValue[ uiIndex ].propDisplayValue;
                return retOccCullProp;
            }
        } );
    }
    return occCullProp;
};

export let revealMoveManipulatorPosProp = function( moveManipulatorPosProp, moveManipulatorPosList, viewerContextData ) {
    let moveManipulatorPos = null;
    if( _.isUndefined( viewerContextData ) ) {
        let loadedPreferences = preferenceService.getLoadedPrefs();
        if( loadedPreferences[ viewerPreferenceService.VIEWER_MOVE_MANIPULATOR_POSITION ] ) {
            moveManipulatorPos = loadedPreferences[ viewerPreferenceService.VIEWER_MOVE_MANIPULATOR_POSITION ][0];
        }
    }else{
        moveManipulatorPos = viewerPreferenceService.getMoveManipulatorPos( viewerContextData );
    }
    let index = 0;
    if( _.isString( moveManipulatorPos ) ) {
        index = moveManipulatorPosList.findIndex( item => item.propInternalValue === moveManipulatorPos );
    }
    if( moveManipulatorPosProp.dbValue === '' ) {
        let retMoveManipulatorPosProp = { ...moveManipulatorPosProp };
        retMoveManipulatorPosProp.dbValue = moveManipulatorPosList[ index ].propInternalValue;
        retMoveManipulatorPosProp.dispValue = moveManipulatorPosList[ index ].propDisplayValue;
        retMoveManipulatorPosProp.uiValue = moveManipulatorPosList[ index ].propDisplayValue;
        return retMoveManipulatorPosProp;
    }
    return moveManipulatorPosProp;
};

/**
 * viewer setting panel
 * @param {Object} orientationProp orientation view model property
 * @param {Array} orientationList orientation list
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} modified orientation prop
 */
export let revealOrientationProp = function( orientationProp, orientationList ) {
    let orientation = viewerPreferenceService.getViewerOrientation();
    let index = 0;
    if( _.isString( orientation ) ) {
        index = stdViewOrientationUIArray.indexOf( orientation.toUpperCase() );
    }
    if( orientationProp.dbValue === '' ) {
        let retOrientationProp = { ...orientationProp };
        retOrientationProp.dbValue = orientationList.dbValue[ index ].propInternalValue;
        retOrientationProp.dispValue = orientationList.dbValue[ index ].propDisplayValue;
        retOrientationProp.uiValue = orientationList.dbValue[ index ].propDisplayValue;
        return retOrientationProp;
    }
    return orientationProp;
};

/**
 * to set color theme
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Object} currentTheme this contains current theme
 * @param {Array} colorThemeList this contains current theme list
 */
export let setColorTheme = function( viewerContextData, currentTheme, colorThemeList ) {
    if( currentTheme.dbValue.propInternalValue !== THEME_FROM_SESSION ) {
        let colorThemeListData = colorThemeList;
        for( let i = 0; i < colorThemeListData.length; i++ ) {
            if( colorThemeListData[ i ].propInternalValue === THEME_FROM_SESSION ) {
                colorThemeListData[ i ].propDisplayValue = null;
                colorThemeListData[ i ].dispValue = null;
                colorThemeListData[ i ].propInternalValue = null;
                colorThemeListData[ i ] = null;
                colorThemeListData.length -= 1;
            }
        }
        let colorTheme = viewerPreferenceService.getColorTheme( viewerContextData );
        if( colorTheme && colorTheme !== currentTheme.dbValue ) {
            viewerPreferenceService.setColorTheme( currentTheme.dbValue, viewerContextData );
        }
        viewerContextData.getThreeDViewManager().setBackgroundColorTheme( currentTheme.dbValue );
    }
};

/**
 * Get the localized text for given key
 *
 * @param {String} key Key for localized text
 * @return {String} The localized text
 */
function getLocalizedText( key ) {
    var localeTextBundle = getLocaleTextBundle();
    return localeTextBundle[ key ];
}

/**
 * This method finds and returns an instance for the locale resource.
 *
 * @return {Object} The instance of locale resource if found, null otherwise.
 */
function getLocaleTextBundle() {
    var resource = 'ViewerSettingsToolMessages';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
}

/**
 * to download vis diagnostics file
 */
export let downloadVisDiagnosticsFile = function() {
    var launchFileContents = '';

    viewerContextService.logVisDiagnostics( false ).then( function( diagnosticData ) {
        launchFileContents = diagnosticData;

        var hrefValue = 'data:text/plain;charset=utf-8,' + encodeURIComponent( launchFileContents );
        var filename = 'logVisDiagnostics.log';

        //IE doesn't support download attribute; need alternative method to download correct filename
        var browserIsIE = navigator.userAgent.indexOf( 'MSIE' ) > -1 || navigator.appVersion.indexOf( 'Trident/' ) > -1;

        if( browserIsIE ) {
            var file = new Blob( [ launchFileContents ], { type: 'text/plain' } );
            navigator.msSaveOrOpenBlob( file, filename );
        } else {
            var a = document.createElement( 'a' );
            a.setAttribute( 'href', hrefValue );
            a.setAttribute( 'download', filename );

            if( document.createEvent ) {
                var event = document.createEvent( 'MouseEvents' );
                event.initEvent( 'click', true, true );
                a.dispatchEvent( event );
            } else {
                a.click();
            }
        }
    } );
};

/**
 * Return uid from the model object
 * @param {Object} occContext occurence management
 * @returns {String} modelUid
 */
let _getModelObjectUid = ( occContext ) => {
    let topElementModelObj = occContext.topElement || occContext.openedElement;
    return viewerContextService.getModelObjectUid( topElementModelObj );
};

/**
 * Updates view Model property with loaded preferences
 * @param {Object} viewModelProp view model property
 * @param {Object} tcPreference tc preference
 * @param {Object} loadedPreferences lodaed tc preferences to determine value of tc preference
 */
let updateViewModelPropUsingLoadedPreferences = function( viewModelProp, tcPreference, loadedPreferences ) {
    if( loadedPreferences && loadedPreferences[ tcPreference ] && _.isArray( loadedPreferences[ tcPreference ] ) && loadedPreferences[ tcPreference ].length > 0 && viewModelProp && viewModelProp
        .update ) {
        viewModelProp.update( loadedPreferences[ tcPreference ][ 0 ] === 'true', { isEnabled: true }, { markModified: true } );
    }
};

/**
 * Updates view Model property
 * @param {Object} viewModelProp view model property
 * @param {Boolean} value updated value for view model prop
 */
let updateViewModelProp = function( viewModelProp, value ) {
    if( viewModelProp && viewModelProp.update && _.isBoolean( value ) ) {
        viewModelProp.update( value, { isEnabled: true }, { markModified: true } );
    }
};
/**
 * Viewer settings panel revealed
 * @function viewerSettingsPanelRevealed
 * @param {Object} shadedCheckboxProp shaded property
 * @param {Object} renderSourceRadioProp Render Source property (SSR/CSR)
 * @param {Object} occContext model name
 * @param {Object} popupId popup id
 * @param {Object} visAllOnCheckboxProp vis all on view model prop
 * @param {Object} mouseGestureProp mouse gesture view model prop
 * @param {Object} navigationRadioProp navigation property[Walk/Examine]
 * @param {Object} unitTextProp unitText property
 * @param {Object} localeTextBundle localized text
 * @param {Object} fitTypeRadioProp fit type view model prop
 * @param {Object} useHighlightPartsOnMouseHoverProp use highlight parts on hover view model prop
 * @param {Object} navCubeCheckboxProp navcube checkbox view model prop
 * @param {Object} trihedronCheckboxProp trihedron checkbox view model prop
 * @param {Object} hoverHighlightDelayProp delay(in seconds) to highlight parts after mouse hover
 * @returns {Object} object containing updated view model prop
 */
export let viewerSettingsPanelRevealedOutside3DTab = function( shadedCheckboxProp, renderSourceRadioProp, occContext, popupId, visAllOnCheckboxProp, mouseGestureProp, navigationRadioProp,
    unitTextProp, localeTextBundle, fitTypeRadioProp, useHighlightPartsOnMouseHoverProp, navCubeCheckboxProp, trihedronCheckboxProp, hoverHighlightDelayProp ) {
    let uid = _getModelObjectUid( occContext );
    if( popupId && occContext && _.isFunction( occContext.getValue ) ) {
        let _viewerDataOutside3D = _.get( occContext.getValue(), 'viewerDataOutside3D' );
        _viewerDataOutside3D = {};
        _viewerDataOutside3D.popupId = popupId;
        const newOccContextData = { ...occContext.getValue() };
        _.set( newOccContextData, 'viewerDataOutside3D', _viewerDataOutside3D );
        occContext.update( newOccContextData );
    }
    let renderLocation;
    let loadedPreferences = preferenceService.getLoadedPrefs();
    updateViewModelPropUsingLoadedPreferences( shadedCheckboxProp, viewerPreferenceService.VIEWER_SHADING, loadedPreferences );
    updateViewModelPropUsingLoadedPreferences( visAllOnCheckboxProp, viewerPreferenceService.ALL_ON, loadedPreferences );
    updateViewModelPropUsingLoadedPreferences( useHighlightPartsOnMouseHoverProp, viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, loadedPreferences );

    if( loadedPreferences[ viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY ] && hoverHighlightDelayProp.update ) {
        hoverHighlightDelayProp.update( loadedPreferences[ viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER_DELAY ][ 0 ] );
    }
    if( loadedPreferences[ viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING ] && loadedPreferences[ viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING ][ 0 ] &&
        mouseGestureProp && mouseGestureProp.update ) {
        updateViewModelProp( mouseGestureProp, loadedPreferences[ viewerPreferenceService.VIS_MOUSE_GESTURE_MAPPING ][ 0 ] !== 'NX' );
    }
    if( loadedPreferences[ viewerPreferenceService.THREED_NAVIGATION_MODE_PREF ] && loadedPreferences[ viewerPreferenceService.THREED_NAVIGATION_MODE_PREF ][ 0 ] ) {
        updateViewModelProp( navigationRadioProp, loadedPreferences[ viewerPreferenceService.THREED_NAVIGATION_MODE_PREF ][ 0 ] !== viewerPreferenceService.THREED_NAVIGATION_MODE_NAME_MAP.WALK );
    }
    if( loadedPreferences[ viewerPreferenceService.VIS_FIT_TYPE ] && loadedPreferences[ viewerPreferenceService.VIS_FIT_TYPE ][ 0 ] && fitTypeRadioProp && fitTypeRadioProp.update ) {
        updateViewModelProp( fitTypeRadioProp, loadedPreferences[ viewerPreferenceService.VIS_FIT_TYPE ][ 0 ] !== 'Spherical' );
    }
    let displayUnit = parseInt( loadedPreferences[ viewerPreferenceService.DISPLAY_UNIT ][ 0 ] );
    let _unitTextProp = { ...unitTextProp };
    for( let key in Units ) {
        if( Units[ key ] === displayUnit ) {
            _unitTextProp.uiValue = localeTextBundle[ key.toLowerCase() ];
        }
    }
    let promiseArray = [ viewerIndexedDbService.getModelRenderLocationFromDb( uid ) ];
    let _renderSupportInfo = viewerSessionStorageService.getViewerDataFromSessionStorage( 'renderSupportInfo' );
    if( !_renderSupportInfo ) {
        let renderSupportInfoPromise = viewerGraphicsSupportService.getRenderSupportInfoFromJscom();
        promiseArray.push( renderSupportInfoPromise );
    }
    return AwPromiseService.instance.all( promiseArray ).then( ( result ) => {
        if( result && result[ 0 ] ) {
            renderLocation = result[ 0 ];
        } else {
            let renderOptionomPref = loadedPreferences[ viewerPreferenceService.VIEWER_RENDER_OPTION ];
            renderLocation = renderOptionomPref[ 0 ];
        }
        updateViewModelProp( renderSourceRadioProp, renderLocation === 'SSR' );
        if( renderLocation === 'CSR' ) {
            updateViewModelPropUsingLoadedPreferences( navCubeCheckboxProp, viewerPreferenceService.VIS_TRIHEDRON, loadedPreferences );
        } else if( renderLocation === 'SSR' ) {
            updateViewModelPropUsingLoadedPreferences( trihedronCheckboxProp, viewerPreferenceService.VIS_TRIHEDRON, loadedPreferences );
        }
        if( result && result[ 1 ] ) {
            viewerSessionStorageService.setViewerDataIntoSessionStorage( 'renderSupportInfo', result[ 1 ] );
            _renderSupportInfo = result[ 1 ];
        }
        return {
            renderSupportInfo: _renderSupportInfo,
            unitTextProp: _unitTextProp
        };
    } ).catch( ( error ) => {
        logger.error( 'Could not fetch data properly: ' + error );
        return error;
    } );
};

/**
 * Set Model render location mode in viewer
 * @function viewRenderSourceChangeSuccess
 * @param {boolean} renderSourceRadioProp - true if SSR
 * @param {Object} occContext occurence management context
 * @param {Object} viewerContextData viewer context data
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let viewRenderSourceChangeSuccess = function( renderSourceRadioProp, occContext, viewerContextData ) {
    let renderSource = 'CSR';
    if( renderSourceRadioProp ) {
        renderSource = 'SSR';
    }
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( 'renderLocation', renderSource );
    } else {
        viewerPreferenceService.setModelRenderLocationPreference( renderSource );
        //get uid from model object
        let uid = _getModelObjectUid( occContext );
        viewerIndexedDbService.updateModelRenderLocationIntoDb( uid, renderSource );
    }
    return !viewerContextData;
};

/**
 * Get current product details
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occContext occurence management context
 * @returns {Object} current product context
 */
export let getCurrentProductDetails = function( viewerContextData, occContext ) {
    if( occContext && occContext.topElement ) {
        return occContext.topElement;
    } else if( viewerContextData ) {
        return viewerContextData.getCurrentViewerProductContext();
    }
    return null;
};

/**
 * Update shaded with edges to PVW
 * @param {Object} viewerContextData viewer context data
 * @param {Object} shadedEdgesProp shaded with edges prop
 */
export let updateShadedWithEdgesPvw = function( viewerContextData, shadedEdgesProp ) {
    let viewerShadedValue = viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData );

    if( viewerShadedValue !== undefined ) {
        shadedEdgesProp.update( viewerShadedValue, null, { markModified: true } );
    }
};

/**
 * Update nav cube and trihedron in  PVW
 * @param {Object} viewerContextData viewer context data
 * @param {Object} navCubeCheckboxProp nav cube checkbox prop
 */
export let updateTrihedronPvw = function( viewerContextData, navCubeCheckboxProp ) {
    let trihderonValue = viewerPreferenceService.getTrihedronVisibility( viewerContextData );

    if( trihderonValue !== undefined ) {
        navCubeCheckboxProp.update( trihderonValue, null, { markModified: true } );
    }
};

/**
 * Set Orientation in cache and nav cube
 * @param {Object} viewerContextData viewer context data
 * @param {String} SelectedItem selected orientation
 * @param {Object} localeTextBundle locale text bundle
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
let setOrientation = function( viewerContextData, SelectedItem, localeTextBundle ) {
    let selectedOrientation = Object.keys( localeTextBundle ).find( function( key ) {
        return localeTextBundle[ key ] === SelectedItem;
    } );
    viewerPreferenceService.updatePreferenceValue( viewerPreferenceService.VIS_STD_VIEW_ALIGNMENT_MODE, selectedOrientation, true, viewerContextData );
    if( appCtxSvc.getCtx( 'splitView.mode' ) ) {
        eventBus.publish( 'viewerOrientationChanged', { orientation: selectedOrientation } );
    } else {
        viewerOrientationService.setViewerOrientation( selectedOrientation, viewerContextData );
    }
    return !viewerContextData;
};

/**
 * Fit type setting changed
 * @function fitTypeSettingChange
 * @param {Object} fitTypeRadioProp fit options
 * @param {Object} viewerContextData viewer context data
 * @returns {Boolean} viewer options changed outside 3D or not on the basis of viewer context data availability
 */
export let fitTypeSettingChange = function( fitTypeRadioProp, viewerContextData ) {
    let fitTypeValue;
    if( fitTypeRadioProp && fitTypeRadioProp.dbValue === false ) {
        fitTypeValue = 'Spherical';
    } else {
        fitTypeValue = 'Tight';
    }
    viewerPreferenceService.setFitTypePreference( fitTypeValue, viewerContextData );
    if( viewerContextData ) {
        viewerContextData.getNavigationManager().setFitType( fitTypeValue );
    }
    return !viewerContextData;
};

/**
 * Handle lighting slider create event
 *
 * @function lightingSliderInit
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Number} lightingSliderProp - new slider property value
 */
export let lightingSliderInit = function( viewerContextData, lightingSliderProp ) {
    var _lightingSliderProp = _.clone( lightingSliderProp );

    // get lighting value from preference and change the lightingSliderProp
    let lightingPrefValue = viewerPreferenceService.getLightsIntensityFactor( viewerContextData );
    if( lightingPrefValue >= 0 ) {
        _lightingSliderProp.dbValue[ 0 ].sliderOption.value = parseInt( lightingPrefValue );
    }
    return _lightingSliderProp;
};

/**
 * Handle lighting slider change event
 *
 * @function lightingSliderValChange
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Number} sliderValue - new slider value
 */
export let lightingSliderValChange = function( viewerContextData, sliderValue ) {
    let lightingPrefValue = viewerPreferenceService.getLightsIntensityFactor( viewerContextData );
    if( lightingPrefValue >= 0 && sliderValue >= 0 && lightingPrefValue !== sliderValue ) {
        viewerPreferenceService.setLightsIntensityFactor( sliderValue, viewerContextData );
    }
    viewerContextData.getThreeDViewManager().setLightsIntensityFactor( sliderValue );
};


export default exports = {
    viewerSettingsPanelRevealed,
    revealBackgroundThemeProp,
    viewerSettingsPanelRevealOccCullingProp,
    shadedWithEdgesSettingChanged,
    materialSettingChanged,
    trihedronSettingChanged,
    revertRenderSetting,
    renderSourceChangeCancelled,
    viewRenderSourceChangeSuccess,
    viewerRenderSourceChanged,
    showFloorSettingChanged,
    gridSettingChanged,
    shadowSettingChanged,
    reflectionSettingChanged,
    navigationSettingChanged,
    updateMaterialWidget,
    handleSliderChangeEvent,
    viewerFloorPlaneChanged,
    updateShowPMIFlatToScreenFalse,
    updateShowPMIFlatToScreenTrue,
    useTransparencySettingChanged,
    useIndexedSettingChanged,
    setPMIFaltToScreen,
    setDisplayUnit,
    setColorTheme,
    setOccCulling,
    initializeMaterialThemesList,
    generateMaterialThemeProp,
    materialThemeSelected,
    initPMISetting,
    downloadVisDiagnosticsFile,
    cleanupViewerSettingPanelAction,
    viewerSettingsPanelRevealedOutside3DTab,
    getCurrentProductDetails,
    updateShadedWithEdgesPvw,
    updateTrihedronPvw,
    visAllOnSettingChanged,
    mouseGestureSettingChanged,
    navCubeCheckboxPropSettingChanged,
    revealOrientationProp,
    revealMoveManipulatorPosProp,
    setOrientation,
    revealMaterialProps,
    fitTypeSettingChange,
    useHighlightPartsOnMouseHoverChanged,
    moveManipulatorDefPosChanged,
    hoverHighlightDelayChanged,
    lightingSliderInit,
    lightingSliderValChange
};
