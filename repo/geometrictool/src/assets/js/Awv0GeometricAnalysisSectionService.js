// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0GeometricAnalysisSectionService
 */
import viewerContextService from 'js/viewerContext.service';
import soa_preferenceService from 'soa/preferenceService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import viewerSectionProvider from 'js/viewerSectionManagerProvider';
import viewerPerformanceService from 'js/viewerPerformance.service';
import logger from 'js/logger';
import dialogService from 'js/dialogService';

var exports = {};

var _showCapsAndLines = null;
var _offsetUpdateTimer = null;

const sectionCreatorOptionsForSurface = {
    SECTION_MODE: window.JSCom.Consts.SectionMode.ALIGN_TO_SURFACE,
    PICK_FILTER: window.JSCom.Consts.PickFilterState.SURFACE
};
const sectionCreatorOptionsForEdge = {
    SECTION_MODE: window.JSCom.Consts.SectionMode.NORMAL_TO_CURVE,
    PICK_FILTER: window.JSCom.Consts.PickFilterState.EDGE
};
var dialogActionObject = null;
var viewId = '';

/**
 * Viewer section panel revealed
 * @function geometricAnalysisSectionPanelRevealed
 * @param {object} data viewModel data
 * @param {object} viewerData global atomic data
 * @param {object} geometricSectionState local atomic date state
 * @param {object} subPanelContext sub panel context
 * @returns {Promise} A promise resolved after panel is revealed
 */
export let geometricAnalysisSectionPanelRevealed = function( data, geometricSectionState, subPanelContext, cutLineProp ) {
    let deferred = AwPromiseService.instance.defer();
    if( subPanelContext.viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_IS_NAV_MODE_AREA_SELECT ) === true ) {
        viewerContextService.setDefaultActionNavigation( subPanelContext.viewerContextData );
    }
    subPanelContext.viewerContextData.getSectionManager().initializeSectionsFromContext( geometricSectionState, subPanelContext ).then( () => {
        let editData = updateEditSectionDetails( data, subPanelContext.viewerContextData, cutLineProp );
        editData.viewerCtxNamespace = subPanelContext.viewerContextData.getViewerCtxNamespace();
        editData.capsValue = data.capsValue;
        if( _.isNull( _showCapsAndLines ) || _.isUndefined( _showCapsAndLines ) ) {
            soa_preferenceService.getStringValue( 'AWV0SectionCapsEdgesInitialState' ).then( function( prefValue ) {
                if( _.isNull( prefValue ) || _.isUndefined( prefValue ) || _.toUpper( prefValue ) === 'TRUE' ) {
                    _showCapsAndLines = true;
                } else {
                    _showCapsAndLines = false;
                }
                updateCapsValue( editData.capsValue, subPanelContext.viewerContextData );
                deferred.resolve( editData );
            } ).catch( () => {
                _showCapsAndLines = true;
                updateCapsValue( editData.capsValue, subPanelContext.viewerContextData );
                editData.isShowCapsAndCutLines = _showCapsAndLines;
                deferred.resolve( editData );
            } );
        } else {
            editData.capsValue.dbValue = _showCapsAndLines;
            deferred.resolve( editData );
        }
        subPanelContext.viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, subPanelContext.subPanelContext.popupOptions.popupId );
    } ).catch( error => {
        logger.error( error );
    } );
    return deferred.promise;
};

/**
 * Get all sections data
 * @param {Object} dataProvider data providers
 * @param {Object} viewerData section atomic data
 * @returns {Object} to update data Provider
 */
export let getAllSectionsData = function( dataProvider, viewerContextData ) {
    let sectionList = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_LIST );
    let sectionListLength = 0;
    let newSectionList = _.cloneDeep( sectionList );
    sectionListLength = newSectionList.length;
    dataProvider.selectionModel.selectNone();
    for( let i = 0; i < sectionListLength; i++ ) {
        newSectionList[ i ].clipData = newSectionList[ i ].sectionClipStateList[ newSectionList[ i ].sectionClipState ];
        newSectionList[ i ].planeIconButton = { iconName: newSectionList[ i ].planeThumbnailIcon, tooltip: newSectionList[ i ].sectionPlaneLabel };
        if( newSectionList[ i ].selected ) {
            dataProvider.selectionModel.setSelection( newSectionList[ i ] );
        }
    }
    return {
        allSectionsData: newSectionList,
        totalFound: sectionListLength
    };
};

/**
 * Select section in list
 * @param {Object} dataProvider data providers
 * @param {Object} viewerContextData section atomic data
 */
export let selectSectionInList = function( dataProvider, viewerContextData ) {
    let sectionInfo = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SELECTED_SECTION_IN_3D );
    let sectionToBeUpdated = viewerContextData.getSectionManager().getSectionDataById( sectionInfo.sectionData.sectionId );
    viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IGNORE_OFFSET_UPDATE, true );
    viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SKIP_SELECTION_UPDATE, true );
    if( !sectionInfo.isSelected ) {
        viewerContextData.getSectionManager().deselectExistingSections( true );
    } else {
        viewerContextData.getSectionManager().deselectExistingSections( true );
        sectionToBeUpdated.selected = true;
    }
    viewerContextData.getSectionManager().updateSectionListToViewerContext();
};

/**
 * Section value changed
 *
 * @param {Object} sectionId section id
 * @param {Object} sliderData slider model object
 * @param {Object} viewerContextData viewer context data
 *
 * @returns {Number} new offset value
 */
export let sliderValueChanged = function( sectionId, sliderData, viewerContextData ) {
    const ignoreUpdate = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IGNORE_OFFSET_UPDATE );
    if( !sectionId || ignoreUpdate ) {
        return null;
    }
    let newValue = sliderData.dbValue[ 0 ].sliderOption.value;
    _setSectionOffsetValue( sectionId, newValue, viewerContextData, 'STOP' );
    return newValue;
};

/**
 * Section value moving
 *
 * @param {String} sectionId section id
 * @param {Object} sliderData slider model object
 * @param {Object} viewerContextData viewer context data
 *
 * @returns {Number} new offset value
 */
export let sliderValueMoving = function( sectionId, sliderData, viewerContextData ) {
    const ignoreUpdate = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IGNORE_OFFSET_UPDATE );
    if( !sectionId || ignoreUpdate ) {
        return;
    }
    let newValue = sliderData.dbValue[ 0 ].sliderOption.value;
    _moveSectionOffsetValue( sectionId, newValue, viewerContextData );
    return newValue;
};

/**
 * Create viewer section
 *
 * @param {Object} viewerData Viewer global data
 * @param {String} planeId plane id to create section
 */
export let createViewerSection = function( viewerData, planeId ) {
    viewerData.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_CREATE_SECTION_BEGIN );
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.CreateSection );
    }
    let promise = viewerData.viewerContextData.getSectionManager().createViewerSection( planeId );
    promise.then( function() {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Section created : ' );
            viewerPerformanceService.setViewerPerformanceMode( false );
        }
        if( viewerData.viewId !== 'Awv0GeometricAnalysisSection' ) {
            viewerContextService.setDefaultActionNavigation( viewerData.viewerContextData );
            AwTimeoutService.instance( function() {
                viewerContextService.activateViewerCommandDialog( 'Awv0GeometricAnalysisSection', viewerData, true );
            }, 1000 );
        } else {
            _notifySectionListUpdated();
        }
    } );
};

/**
 *
 * @param {Object} viewerData Viewer global data
 * @param {String} sectionMode type of scetion
 */
export let enterSectionCreationModeUsingEntities = function( viewerData, sectionMode ) {
    viewerData.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_CREATE_SECTION_BEGIN );
    let dialogToolAndInfo = appCtxSvc.getCtx( 'activeToolsAndInfoCommand_dialog' );
    if( viewerData.viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_IS_SUB_COMMANDS_TOOLBAR_ENABLED ) ) {
        viewerContextService.closeSubCommandsToolbar( viewerData.viewerContextData ); //close measurement subcommandtoolbar and deactivate measurement mode
    } else {
        //firing the complete event should be removed once all sidenavs are converted to dialogs
        if( !dialogToolAndInfo ) {
            let activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
            if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId !== 'Awv0GeometricAnalysisSection' ) {
                let eventData = {
                    source: 'toolAndInfoPanel'
                };
                eventBus.publish( 'complete', eventData );
            }
        }
    }
    dialogActionObject = viewerData.dialogAction;
    viewId = viewerData.viewId;
    if( sectionMode === 'ALIGN_TO_SURFACE' ) {
        viewerData.viewerContextData.getSectionManager().enterSectionCreationModeUsingEntities( sectionCreatorOptionsForSurface );
    } else if( sectionMode === 'NORMAL_TO_CURVE' ) {
        viewerData.viewerContextData.getSectionManager().enterSectionCreationModeUsingEntities( sectionCreatorOptionsForEdge );
    }
    if( _.isUndefined( dialogToolAndInfo ) || dialogToolAndInfo.commandId !== 'Awv0GeometricAnalysisSection'  ) {
        viewerContextService.setDefaultActionNavigation( viewerData.viewerContextData );
    }
    let sectionViewId = viewerData.subPanelContext && viewerData.subPanelContext.popupOptions ? viewerData.subPanelContext.popupOptions.popupId : undefined;
    viewerData.viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( handleEscapeKeyboardSectionIn3d.bind( { viewerContextData:viewerData.viewerContextData,
        sectionViewId:sectionViewId } ) );
    viewerData.viewerContextData.getSectionManager().registerforCustomSectionCreationListener( revealPanelWhenSectionCreatedWithEntities );
};

/**
 * handler for escape keyboard listener in section
 * @this handleEscapeKeyboardSectionIn3d
 *
 */
let  handleEscapeKeyboardSectionIn3d = function( ) {
    if( this.sectionViewId ) {
        closeSectionPanel( this.viewerContextData, this.sectionViewId );
    }else{
        exports.cleanupGeoAnalysisSectionPanel( this.viewerContextData );
        this.viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( null );
    }
    let data =  this.viewerContextData.getAfxPVWInitializationValues();
    data.viewer.clearHighlight();
};

/**
 * @param {Object} viewerContextData Viewer global data
 */
export let revealPanelWhenSectionCreatedWithEntities = function( viewerContextData ) {
    let viewerAtomicData = viewerContextData.getViewerAtomicData();
    let viewerData = {
        viewerAtomicData: viewerAtomicData,
        viewerContextData: viewerContextData,
        dialogAction: dialogActionObject
    };
    viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( null );
    let dialogToolAndInfo = appCtxSvc.getCtx( 'activeToolsAndInfoCommand_dialog' );
    let dialogView = dialogToolAndInfo && dialogToolAndInfo.commandId ? dialogToolAndInfo.commandId : undefined;
    if( dialogView !== 'Awv0GeometricAnalysisSection' ) {
        AwTimeoutService.instance( function() {
            viewerContextService.activateViewerCommandDialog( 'Awv0GeometricAnalysisSection', viewerData, true );
        }, 1000 );
    }
    _notifySectionListUpdated();
};

/**
 * Modify viewer section
 *
 * @param {String} sectionId section id
 * @param {String} newNormal orientation new value
 * @param {Object} viewerContextData viewer context data
 */
export let modifySection = function( sectionId, newNormal, viewerContextData ) {
    if( !sectionId || !newNormal ) {
        return;
    }
    var promise = viewerContextData.getSectionManager().modifySection( sectionId, newNormal );
    promise.then( function() {
        viewerContextData.getSectionManager().updateEditSectionIdToViewerContext( sectionId );
        _notifySectionListUpdated();
    } );
};

/**
 * Select viewer section
 * @param {Object} viewerContextData viewer context data
 * @param {Object} dataProvider data provider
 * @returns {Promise} A promise resolved after panel is revealed
 *
 */
export let handleSectionSelectionChangeEvent = function( viewerContextData, dataProvider ) {
    const ignoreSelectionUpdate = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SKIP_SELECTION_UPDATE );
    if( ignoreSelectionUpdate ) {
        return null;
    }
    let selectedSection = dataProvider.selectionModel.getSelection();
    let sectionId = null;
    if( Array.isArray( selectedSection ) && selectedSection.length > 0 ) {
        sectionId = selectedSection[ 0 ].sectionId;
    }
    if( sectionId ) {
        viewerContextData.getSectionManager().deselectExistingSections();
        return viewerContextData.getSectionManager().setSectionSelection( sectionId, true );
    }
    viewerContextData.getSectionManager().deselectExistingSections();
    return null;
};

let closeSectionPanel = function( viewerContextData, viewId ) {
    dialogService.closeDialog( 'INFO_PANEL_CONTEXT', viewId );
    viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( null );
    exports.cleanupGeoAnalysisSectionPanel( viewerContextData );
};

/**
 * Delete all sections
 * @param  {Object} viewerContextData viewer context data
 */
export let deleteAllSections = function( viewerContextData, geometricSectionProp, viewId ) {
    let newGeometricSectionProp = { ...geometricSectionProp.getValue() };
    newGeometricSectionProp.isSectionListUpdateNeeded = false;
    geometricSectionProp.update( newGeometricSectionProp );

    let promise = viewerContextData.getSectionManager().deleteAllSections();
    promise.then( () => {
        closeSectionPanel( viewerContextData, viewId );
    } ).catch( error => {
        logger.error( error );
    } );
};

/**
 * Show delete confirmation
 *
 * @param {Object} vmo object
 * @param {object} geometricSectionState local atomic date state
 */
export let deleteSelectedSection = function( vmo, geometricSectionState ) {
    let newSectionPropState = { ...geometricSectionState.getValue() };
    let viewerSectionToBeDeleted = {};
    viewerSectionToBeDeleted.sectionId = vmo.sectionId;
    viewerSectionToBeDeleted.sectionText = vmo.offsetLabel.toString() + ' = ' + vmo.offsetValue.toString();
    newSectionPropState.viewerSectionToBeDeleted = viewerSectionToBeDeleted;
    geometricSectionState.update( { ...newSectionPropState } );
};

/**
 * Delete selected sections
 * @param {Object} viewerContextData viewer context data
 */
export let deleteSelectedSectionAction = function( props ) {
    let sectionToBeDeleted = props.viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_TO_BE_DELETED );
    if( sectionToBeDeleted && sectionToBeDeleted.sectionId ) {
        let promise = props.viewerContextData.getSectionManager().deleteSection( sectionToBeDeleted.sectionId );
        promise.then( function() {
            props.viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_TO_BE_DELETED, {} );
            let sectionList = props.viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_LIST );
            if( sectionList && sectionList.length === 0 ) {
                closeSectionPanel( props.viewerContextData, props.subPanelContext.popupOptions.popupId );
            } else {
                _notifySectionListUpdated();
            }
        } );
    }
};

/**
 * Show caps and cut lines changed
 *
 * @param {String} settingValue new value
 * @param {Object} viewerContextData viewer context data
 */
export let showCapsAndCutLinesChanged = function( settingValue, viewerContextData ) {
    var promise = viewerContextData.getSectionManager().setShowCapsAndCutLines( settingValue );
    promise.then( function() {
        _showCapsAndLines = settingValue;
    } );
};

/**
 * Section offset value updated
 *
 * @param {String} sectionId section id
 * @param {String} newValue new value
 * @param {Boolean} isValid is valid offset value
 * @param {Object} viewerContextData viewer context data
 *
 * @returns {any} new value
 */
export let sectionOffsetUpdated = function( sectionId, newValue, isValid, viewerContextData ) {
    const ignoreUpdate = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IGNORE_OFFSET_UPDATE );
    if( sectionId && isValid && !ignoreUpdate ) {
        if( _offsetUpdateTimer ) {
            AwTimeoutService.instance.cancel( _offsetUpdateTimer );
        }
        _offsetUpdateTimer = AwTimeoutService.instance( () => {
            _setSectionOffsetValue( sectionId, newValue, viewerContextData, 'OFFSET' );
            _offsetUpdateTimer = null;
        }, 1000 );
        return newValue;
    }
    return null;
};

/**
 * Section visibility value updated
 * @param {String} sectionId section id
 * @param {Object} viewerContextData viewer context data
 *
 */
export let sectionVisibilityUpdated = function( sectionId, viewerContextData ) {
    if( !sectionId ) {
        return;
    }
    viewerContextData.getSectionManager().toggleSectionVisibility( sectionId );
};

/**
 * Set setShowCapsAndEdges preference
 *
 *  @param {Object} viewerContextData viewer context data
 *  @param {Object} capsValueData view Model
 *
 * @returns {Boolean} boolean indicating whether to show caps and cutlines
 */
export let setShowCapsAndEdgesAction = function( viewerContextData, capsValueData ) {
    viewerContextData.getSectionManager().setCapping( _showCapsAndLines );
    viewerContextData.getSectionManager().setGlobalCutLines( _showCapsAndLines );
    let capsValue = _.clone( capsValueData );
    capsValue.dbValue = _showCapsAndLines;
    return capsValue;
};

/**
 * Updated the clip state of a cross section
 *
 * @param {String} sectionId section id
 * @param {Object} clipState Clipset to be updated
 * @param {Object} viewerContextData viewer context data
 */
export let updateClipState = function( sectionId, clipState, viewerContextData ) {
    if( !sectionId ) {
        return;
    }
    var promise = viewerContextData.getSectionManager().updateClipState( sectionId, Number( clipState ) );
    promise.then( function() {
        _notifySectionListUpdated();
    } );
};

/**
 * Sets whether capping for cross sections should be drawn
 *
 * @param {String} viewerContextData viewer context
 * @param {Boolean} showCapping Object containing show caps value
 */
export let showCaps = function( viewerContextData, showCapping ) {
    _showCapsAndLines = showCapping;
    viewerContextData.getSectionManager().setCapping( showCapping );
};

/**
 * Sets whether cut lines for the new cross sections should be drawn
 *
 * @param {Object} data Object containing create cut lines value
 * @param {Object} viewerContextData viewer context data
 */
export let createCutLines = function( data, viewerContextData ) {
    viewerContextData.getSectionManager().setGlobalCutLines( data.dbValue[ 0 ].isChecked );
};

/**
 * Sets whether the Cut Lines status of the cross section
 *
 * @param {String} sectionId section id
 * @param {Object} cutLinesState Clipset to be updated
 * @param {Object} viewerContextData viewer context data
 */
export let showCutLinesPerSection = function( sectionId, cutLinesState, viewerContextData ) {
    if( !sectionId ) {
        return;
    }
    viewerContextData.getSectionManager().setCutLines( cutLinesState, sectionId );
    viewerContextData.getSectionManager().setGlobalCutLines( cutLinesState );
};

/**
 * Sets the offset value
 *
 * @param {Number} sectionOffsetValue new offset value
 * @param {Object} offsetPropValue view model object
 *
 * @returns {object} offaetProp updated value
 */
export let setOffsetPropertyValue = function( sectionOffsetValue, offsetPropValue ) {
    let offsetProp = _.clone( offsetPropValue );
    offsetProp.dbValue = sectionOffsetValue;
    return offsetProp;
};

/**
 * Sets the offset value
 * @param {Object} viewerContextData viewer context data
 * @param {Object} sectionPanelOffsetSliderProp view model object
 * @returns {object} updated value
 */
export let sectionPlanePositionChange = function( viewerContextData, sectionPanelOffsetSliderProp ) {
    const newSliderProp = { ...sectionPanelOffsetSliderProp };
    let editSectionData = null;
    let sectionList = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_LIST );
    if( sectionList && Array.isArray( sectionList ) && sectionList.length > 0 ) {
        let sectionListLength = sectionList.length;
        for( let i = 0; i < sectionListLength; i++ ) {
            if( sectionList[ i ].selected ) {
                editSectionData = sectionList[ i ];
                break;
            }
        }
    }
    if( editSectionData ) {
        newSliderProp.dbValue[ 0 ].sliderOption.value = editSectionData.offsetValue;
    }
    return {
        sectionPanelOffsetSliderProp: newSliderProp
    };
};

/**
 * Sets the offset value
 * @param {Object} viewerContextData viewer context data
 * @param {Object} offsetProp view model object
 * @returns {object} updated value
 */
export let updateSectionOffsetBox = function( viewerContextData, offsetProp ) {
    const newOffsetProp = { ...offsetProp };
    let editSectionData = null;
    let sectionList = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_LIST );
    if( sectionList && Array.isArray( sectionList ) && sectionList.length > 0 ) {
        let sectionListLength = sectionList.length;
        for( let i = 0; i < sectionListLength; i++ ) {
            if( sectionList[ i ].selected ) {
                editSectionData = sectionList[ i ];
                break;
            }
        }
    }
    if( editSectionData ) {
        newOffsetProp.dbValue = editSectionData.offsetValue;
    }
    return {
        offsetProp: newOffsetProp
    };
};

/**
 * Sets the offset slider
 * @param {Object} selectedSectionId selected section id
 * @param {Object} viewerContextData viewer context data
 * @param {Number} offsetProp new offset value
 * @param {Object} sliderProp view model object
 * @returns {object} updated value
 */
export let updateOffsetBoxAndSlider = function( selectedSectionId, viewerContextData, offsetProp, sliderProp ) {
    const newOffsetProp = { ...offsetProp };
    const newSliderProp = { ...sliderProp };
    const offsetVal = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_OFFSET_FROM_3D );
    viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IS_EDIT_SECTION_UPDATE_NEEDED, false );
    viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_IGNORE_OFFSET_UPDATE, true );
    viewerContextData.getSectionManager().updateGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SKIP_SELECTION_UPDATE, true );
    newOffsetProp.dbValue = offsetVal.offsetValue;
    newSliderProp.dbValue[ 0 ].sliderOption.value = offsetVal.offsetValue;
    viewerContextData.getSectionManager().updateSectionOffsetInViewerContext( selectedSectionId, offsetVal.offsetValue, false );
    viewerContextData.getSectionManager().updateSectionListToViewerContext();
    return {
        offsetProp: newOffsetProp,
        sliderProp: newSliderProp
    };
};

/**
 * Section edit panel details
 * @param {Object} data data object
 * @param {Object} viewerContextData viewer context data
 * @returns {Promise} A promise that is resolved with properties value
 */
export let updateEditSectionDetails = function( data, viewerContextData, cutLineProp ) {
    let sectionToggleData = _.cloneDeep( data.sectionToggle );
    let offsetPropData = _.cloneDeep( data.offsetProp );
    let sectionPlaneData = _.cloneDeep( data.sectionPlane );
    let clipStateData = _.cloneDeep( data.clipState );
    let clipStateList = _.cloneDeep( data.clipStateProps.dbValue );
    let sectionProps = _.cloneDeep( data.normalSectionProps );
    let sectionPanelOffsetSliderProp = _.cloneDeep( data.sectionPanelOffsetSliderProp );
    let minValue = 0;
    let maxValue = 0;
    let finalErrorMessage = '';
    let sectionList = viewerContextData.getSectionManager().getValueOnGeometricSectionState( viewerSectionProvider.GEOANALYSIS_SECTION_LIST );
    if( sectionList && Array.isArray( sectionList ) && sectionList.length > 0 ) {
        let editSectionData = null;
        let sectionListLength = sectionList.length;
        for( let i = 0; i < sectionListLength; i++ ) {
            if( sectionList[ i ].selected ) {
                editSectionData = sectionList[ i ];
                break;
            }
        }
        if( !editSectionData ) {
            editSectionData = data.dataProviders.sectionsDataProvider.selectedObjects[ 0 ];
        }
        if( editSectionData ) {
            if( editSectionData.sectionPlaneNamesProp.length > 3 ) {
                sectionProps = data.customSectionProps;
            } else {
                sectionProps = data.normalSectionProps;
            }
            cutLineProp.update( editSectionData.sectionCutLinesState, null, { markModified: true } );
            sectionToggleData.dbValue = editSectionData.isSectionVisible;
            sectionPlaneData.dbValue = editSectionData
                .sectionPlaneSelectionIdProp.toString();
            sectionPlaneData.dispValue = editSectionData.sectionPlaneLabel;
            sectionPlaneData.uiValue = editSectionData.sectionPlaneLabel;
            if( Array.isArray( sectionPlaneData.newDisplayValues ) && sectionPlaneData.newDisplayValues.length > 0 ) {
                sectionPlaneData.newDisplayValues = null;
            }
            clipStateData
                .dbValue = editSectionData.sectionClipState.toString();
            clipStateData.dispValue = editSectionData.sectionClipStateList[ editSectionData.sectionClipState ];
            clipStateData.uiValue =
                editSectionData.sectionClipStateList[ editSectionData.sectionClipState ];
            clipStateData
                .iconName = clipStateList[ editSectionData.sectionClipState ].iconName;
            offsetPropData.dbValue = Number( editSectionData.offsetValue );

            minValue = editSectionData.offsetMinValue;
            maxValue = editSectionData.offsetMaxValue;
            sectionPanelOffsetSliderProp.dbValue[ 0 ].sliderOption.min = minValue;
            sectionPanelOffsetSliderProp
                .dbValue[ 0 ].sliderOption.max = maxValue;
            let sliderStep = ( maxValue - minValue ) / 50;
            sectionPanelOffsetSliderProp.dbValue[ 0 ].sliderOption.step = _.round( sliderStep, 6 );
            sectionPanelOffsetSliderProp.dbValue[ 0 ].sliderOption
                .value = _.round( editSectionData.offsetValue, 6 );

            let resource = 'GeometricAnalysisMessages';
            let localTextBundle = localeSvc.getLoadedText( resource );
            finalErrorMessage = localTextBundle.getInvalidEditboxValueWarning;
            finalErrorMessage = finalErrorMessage.replace( '{0}',
                minValue );
            finalErrorMessage = finalErrorMessage.replace( '{1}', maxValue );
        }
    }

    return {
        sectionProps: sectionProps,
        sectionPanelOffsetSliderProp: sectionPanelOffsetSliderProp,
        sectionToggleData: sectionToggleData,
        sectionPlaneData: sectionPlaneData,
        clipStateData: clipStateData,
        offsetPropData: offsetPropData,
        minValue: Number( minValue ),
        maxValue: Number( maxValue ),
        finalErrorMessage: String( finalErrorMessage )
    };
};

/**
 * Set section offset value
 *
 * @param {String} sectionId section id
 * @param {String} newValue new value
 * @param {Object} viewerContextData viewer context data
 * @param {Object} type type of operation
 */
var _setSectionOffsetValue = function( sectionId, newValue, viewerContextData, type ) {
    viewerContextData.getSectionManager().addRequestToUpdateOffset( sectionId, newValue, type );
};

/**
 * Move section offset value
 *
 * @param {String} sectionId section id
 * @param {String} newValue new value
 * @param {Object} viewerContextData viewer context data
 */
var _moveSectionOffsetValue = function( sectionId, newValue, viewerContextData ) {
    viewerContextData.getSectionManager().addRequestToUpdateOffset( sectionId, newValue, 'MOVE' );
};

/**
 * Notify to select edited
 */
var _notifySectionListUpdated = function() {
    //remove this function
};
/**
 * Get caps value
 * @param {boolean} capsValue - boolean value
 * @param {object} viewerContextData - global viewer context data
 */
var updateCapsValue = function( capsValue, viewerContextData ) {
    viewerContextData.getSectionManager().setCapping( _showCapsAndLines );
    capsValue.dbValue = _showCapsAndLines;
};
/**
 * Is valid input section offset value
 *
 * @param {Number} newValue new offset value
 * @param {Number} minValue minimum offset value
 * @param {Number} maxValue maximum offset value
 *
 * @returns {Boolean} isValid
 */
export let isValidInputSectionValue = function( newValue, minValue, maxValue ) {
    return minValue <= newValue && newValue <= maxValue;
};

/**
 * Show edit section slider
 *
 * @returns {boolean} show section slider
 */
export let showEditSectionSlider = function() {
    return true;
};

/**
 * Clean up and unmount section panel
 * @param {Object} viewerContextData viewer context data
 */
export let cleanupGeoAnalysisSectionPanel = function( viewerContextData ) {
    viewerContextData.getSectionManager().cleanupGeoAnalysisSection();
    viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, null );
    if( viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_IS_NAV_MODE_AREA_SELECT ) === false ) {
        viewerContextService.setDefaultActionNavigation( viewerContextData );
    }
    viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.SECTION_PANEL_CLOSED );
};

/**
 * Update value from section plane position change
 * @param {object} geometricSectionState local atomic date state
 */
export let resetSectionUpdateSkipFlags = function( geometricSectionState ) {
    let newGeometricSectionStateVal = { ...geometricSectionState.getValue() };
    newGeometricSectionStateVal.isSectionListUpdateNeeded = true;
    newGeometricSectionStateVal.isEditSectionUpdateNeeded = true;
    newGeometricSectionStateVal.updateSectionSlider = false;
    newGeometricSectionStateVal.skipSelectionUpdate = false;
    newGeometricSectionStateVal.ignoreOffsetUpdate = false;
    newGeometricSectionStateVal.updateSectionOffset = false;
    geometricSectionState.update( newGeometricSectionStateVal );
};

export default exports = {
    geometricAnalysisSectionPanelRevealed,
    getAllSectionsData,
    sliderValueChanged,
    sliderValueMoving,
    createViewerSection,
    enterSectionCreationModeUsingEntities,
    modifySection,
    handleSectionSelectionChangeEvent,
    deleteAllSections,
    deleteSelectedSection,
    deleteSelectedSectionAction,
    showCapsAndCutLinesChanged,
    sectionOffsetUpdated,
    sectionVisibilityUpdated,
    setShowCapsAndEdgesAction,
    updateClipState,
    showCaps,
    createCutLines,
    showCutLinesPerSection,
    updateEditSectionDetails,
    setOffsetPropertyValue,
    isValidInputSectionValue,
    showEditSectionSlider,
    revealPanelWhenSectionCreatedWithEntities,
    cleanupGeoAnalysisSectionPanel,
    selectSectionInList,
    updateOffsetBoxAndSlider,
    resetSectionUpdateSkipFlags,
    sectionPlanePositionChange,
    updateSectionOffsetBox
};
