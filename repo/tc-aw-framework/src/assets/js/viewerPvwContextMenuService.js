// Copyright (c) 2023 Siemens

/**
 *
 * @module js/viewerPvwContextMenuService
 */

import _ from 'lodash';
import viewerPreferenceService from 'js/viewerPreference.service';
import viewerContextService from 'js/viewerContext.service';
let exports = {};

let pvwContextMenu = {
    fitAllCmd: window.JSCom.Consts.ContextMenuEvent.FITALL,
    showAllCmd: window.JSCom.Consts.ContextMenuEvent.SHOWALL,
    hideAllCmd: window.JSCom.Consts.ContextMenuEvent.HIDEALL,
    hidePartCmd: window.JSCom.Consts.ContextMenuEvent.HIDEPART,
    showOnlyCmd: window.JSCom.Consts.ContextMenuEvent.SHOWPARTONLY,
    showSelectedOnlyCmd: window.JSCom.Consts.ContextMenuEvent.SHOWSELECTEDONLY,
    hideSelectedCmd: window.JSCom.Consts.ContextMenuEvent.HIDESELECTED,
    topViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWTOP,
    bottomViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWBOTTOM,
    leftViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWLEFT,
    rightViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWRIGHT,
    frontViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWFRONT,
    backViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWBACK,
    positiveIsometricViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWPLUSISOMETRIC,
    negativeIsometricViewCmd: window.JSCom.Consts.ContextMenuEvent.STANDARDVIEWMINUSISOMETRIC,
    SHADEDWITHEDGESONCmd: window.JSCom.Consts.ContextMenuEvent.SHADEDWITHEDGESON,
    SHADEDWITHEDGESOFFCmd: window.JSCom.Consts.ContextMenuEvent.SHADEDWITHEDGESOFF,
    TRIHEDRONONCmd: window.JSCom.Consts.ContextMenuEvent.TRIHEDRONON,
    TRIHEDRONOFFCmd: window.JSCom.Consts.ContextMenuEvent.TRIHEDRONOFF,
    deleteMeasurementCmd: window.JSCom.Consts.ContextMenuEvent.DELETEMEASUREMENT,
    deleteSectionCmd: window.JSCom.Consts.ContextMenuEvent.DELETESECTION,
    xyOrientSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONPLANEXY,
    xzOrientSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONPLANEXZ,
    yzOrientSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONPLANEYZ,
    customOrientSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONPLANETHETA,
    negativeClipSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONCLIPNEAR,
    positiveClipSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONCLIPFAR,
    bothClipSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONCLIPBOTH,
    neitherClipSectionCmd: window.JSCom.Consts.ContextMenuEvent.SECTIONCLIPNONE,
    hidePMICmd:window.JSCom.Consts.ContextMenuEvent.PMIHIDE
};

/**
 * Initialize clearance results component
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 * @returns {Object} object which contains PLMVisWeb handle and PLMVisWeb viewer instance created in JSCOM
 */
let initializeContextMenu = ( viewerContextData, contextMenuPreferences ) => {
    let data = viewerContextData.getAfxPVWInitializationValues();
    let _contextMenuPref = { ...contextMenuPreferences.getValue() };
    _contextMenuPref.isTrihedronSelected = viewerPreferenceService.getTrihedronVisibility( viewerContextData );
    _contextMenuPref.shadedWithEdgesSelected = viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData );
    contextMenuPreferences.update( _contextMenuPref );
    return {
        PLMVisWeb: data.PLMVisWeb,
        viewer: data.viewer
    };
};

/**
 * Defined pvw context menu Trihedron
 * @param {Object} commandContext pvw command context
 */
let pvwContextMenuTrihedron = ( commandContext ) => {
    if( commandContext.preferences.command !== undefined ) {
        let _commandContext = { ...commandContext.preferences.getValue() };
        _commandContext.command = 'toggleTrihedronCmd';
        _commandContext.isTrihedronSelected = !_commandContext.isTrihedronSelected;
        commandContext.viewerContextData.getDrawTrislingManager().drawTrihedron( _commandContext.isTrihedronSelected );
        commandContext.viewerContextData.getDrawTrislingManager().drawNavCube( _commandContext.isTrihedronSelected );
        commandContext.preferences.update( _commandContext );
    }
    commandContext.parentPopupAction.hide();
};

/**
 * Defined pvw context menu Trihedron
 * @param {Object} commandContext pvw command context
 */
let pvwContextMenuClean3dView = ( commandContext ) => {
    if( commandContext.preferences.command !== undefined ) {
        let _commandContext = { ...commandContext.preferences.getValue() };
        _commandContext.command = 'pvwClean3DViewCmd';
        commandContext.preferences.update( _commandContext );
    }
    commandContext.parentPopupAction.hide();
};

/**
 * Update Shaded with edges preference from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updateShadedViewerPreferenceFromPVW = ( viewerContextData, contextMenuPreferences ) => {
    let contextMenuCmd =  pvwContextMenu.SHADEDWITHEDGESOFFCmd;
    let pvwContextMenuPref = contextMenuPreferences.getValue();
    let viewerShadedValue = viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData );
    if( viewerShadedValue !== undefined && pvwContextMenuPref.shadedWithEdgesSelected !== undefined && pvwContextMenuPref.shadedWithEdgesSelected !== viewerShadedValue ) {
        viewerPreferenceService.setShadedWithEdgesPreference( pvwContextMenuPref.shadedWithEdgesSelected, viewerContextData );
        if( pvwContextMenuPref.shadedWithEdgesSelected === true ) {
            contextMenuCmd = pvwContextMenu.SHADEDWITHEDGESONCmd;
        }
    }
    updateCtxtAtomicDataNotifyCtxtMenu( viewerContextData, contextMenuPreferences, contextMenuCmd );
};

/**
 * Update Trihedron preference from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updateTrihedronFromPVW = ( viewerContextData, contextMenuPreferences ) => {
    let contextMenuCmd = pvwContextMenu.TRIHEDRONOFFCmd;
    let pvwContextMenuPref = contextMenuPreferences.getValue();
    let viewerTrihedronValue = viewerPreferenceService.getTrihedronVisibility( viewerContextData );
    if( viewerTrihedronValue !== undefined && pvwContextMenuPref.isTrihedronSelected !== undefined && pvwContextMenuPref.isTrihedronSelected !== viewerTrihedronValue ) {
        viewerPreferenceService.setTrihedronVisibility( pvwContextMenuPref.isTrihedronSelected, viewerContextData );
        if( pvwContextMenuPref.isTrihedronSelected === true ) {
            contextMenuCmd = pvwContextMenu.TRIHEDRONONCmd;
        }
    }
    updateCtxtAtomicDataNotifyCtxtMenu( viewerContextData, contextMenuPreferences, contextMenuCmd );
};

/**
 * Update pvw context menu for shaded with edges from AW viewerSettings panel
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updatePvwContextMenuShadedWithEdges = ( viewerContextData, contextMenuPreferences ) => {
    let pvwContextMenuPref = { ...contextMenuPreferences.getValue() };
    let viewerShadedValue = viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData );
    if( pvwContextMenuPref.shadedWithEdgesSelected !== undefined && pvwContextMenuPref.shadedWithEdgesSelected !== viewerShadedValue ) {
        pvwContextMenuPref.shadedWithEdgesSelected = viewerShadedValue;
        contextMenuPreferences.update( pvwContextMenuPref );
    }
};

/**
 * Update pvw context menu for Trihderon from AW viewerSettings panel
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updatePvwContextMenuTrihedron = ( viewerContextData, contextMenuPreferences ) => {
    let pvwContextMenuPref = { ...contextMenuPreferences.getValue() };
    let viewerTrihedronValue = viewerPreferenceService.getTrihedronVisibility( viewerContextData );
    if( pvwContextMenuPref.isTrihedronSelected !== undefined && pvwContextMenuPref.isTrihedronSelected !== viewerTrihedronValue ) {
        pvwContextMenuPref.isTrihedronSelected = viewerTrihedronValue;
        contextMenuPreferences.update( pvwContextMenuPref );
    }
};

let clean3dViewFromPvw = (  contextMenuPreferences ) => {
    updateContextMenuAtomicData( contextMenuPreferences, 'command', '' );
};

/**
 * Update viewer if convenience command are clicked from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updatePvwContextMenuCommand = ( viewerContextData, contextMenuPreferences ) => {
    let _contextMenuPref = contextMenuPreferences.getValue();
    let contextMenuCmd = pvwContextMenu[ _contextMenuPref.command ];
    let objectIndex = null;
    if( _contextMenuPref.command === 'showSelectedOnlyCmd' || _contextMenuPref.command === 'hideSelectedCmd' || _contextMenuPref.command === 'hidePartCmd' || _contextMenuPref.command ===
        'showOnlyCmd' ) {
        objectIndex = getOccurance( _contextMenuPref.partsSelected, viewerContextData );
    }
    updateCtxtAtomicDataNotifyCtxtMenu( viewerContextData, contextMenuPreferences, contextMenuCmd, objectIndex );
};

/**
 * Delete measurement from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let deleteMeasurementFromPVW = ( viewerContextData, contextMenuPreferences ) => {
    let _contextMenuPref = contextMenuPreferences.getValue();
    let contextMenuCmd = pvwContextMenu[ _contextMenuPref.command ];
    if( viewerContextData.getMeasurementManager() ) {
        viewerContextData.getMeasurementManager().updateSelectedMeasurementAtomicData().then( ()=>{
            viewerContextData.getMeasurementManager().updateSelectedMeasurementContext( null );
        } );
    }
    let objectIndex = _contextMenuPref.measurementsDeleted;
    updateCtxtAtomicDataNotifyCtxtMenu( viewerContextData, contextMenuPreferences, contextMenuCmd, objectIndex );
};

/**
 * Update edit/delete section panel from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let updateSectionCmdFromPVW = ( viewerContextData, contextMenuPreferences ) => {
    if( viewerContextData.getContextMenuMgr() ) {
        let _contextMenuPref = contextMenuPreferences.getValue();
        let contextMenuCmd = pvwContextMenu[ _contextMenuPref.command ];
        let pvwObject = _contextMenuPref.planeSelected ? _contextMenuPref.planeSelected : _contextMenuPref.planeDeleted;
        let objectIndex = pvwObject.planeId;
        updateContextMenuAtomicData( contextMenuPreferences, 'command', '' );
        viewerContextData.getContextMenuMgr().notifyContextMenuMgrForSection( contextMenuCmd, objectIndex, _contextMenuPref );
    }
};

/**
 * hide pmi from pvw
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 */
let hidePmiEntityFromPVW = ( viewerContextData, contextMenuPreferences ) => {
    let _contextMenuPref = contextMenuPreferences.getValue();
    let contextMenuCmd = pvwContextMenu[ _contextMenuPref.command ];
    let objectIndex = _contextMenuPref.pmisSelected;
    viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.PMI_ENTITY_HIDE_FROM_PVW_CONTEXT_MENU, { pvwContextCmd: _contextMenuPref.command, pvwObject: objectIndex } );
    updateCtxtAtomicDataNotifyCtxtMenu( viewerContextData, contextMenuPreferences, contextMenuCmd, objectIndex[0] );
};

/**
 * Update edit/delete section panel from pvw
 * @param {Array} csidChains list of csid value
 * @param {Object} viewerContextData viewer Context data
 * @returns {Array} occurrences list of occ for csidChain
 */
let getOccurance = ( csidChains, viewerContextData ) => {
    let occurrences = [];
    _.forEach( csidChains, function( csidChain ) {
        let occ = null;
        occ = viewerContextData.getViewerCtxSvc().createViewerOccurance( csidChain, viewerContextData );
        occurrences.push( occ );
    } );
    return occurrences;
};

/**
 * Notify context menu and clean command atomic data
 * @param {Object} viewerContextData viewer Context data
 * @param {Object} contextMenuPreferences pvw context menu object
 * @param {Number} contextMenuCmd cmd value from JSCOM
 * @param {object} objectIndex additional object
 */

let updateCtxtAtomicDataNotifyCtxtMenu = ( viewerContextData, contextMenuPreferences, contextMenuCmd, objectIndex ) => {
    updateContextMenuAtomicData( contextMenuPreferences, 'command', '' );
    notifyContextMgr( viewerContextData, contextMenuCmd, objectIndex );
};

/**
 * Update context menu atomic data
 * @param {Object} contextMenuAtomicData viewer Context data
 * @param {String} propertyPath path of property on atomic data value
 * @param {Object} propertyValue vlaue to be set on that path
 */
let updateContextMenuAtomicData = ( contextMenuAtomicData, propertyPath, propertyValue ) => {
    const newContextMenuAtomicData = { ...contextMenuAtomicData.getValue() };
    _.set( newContextMenuAtomicData, propertyPath, propertyValue );
    contextMenuAtomicData.update( newContextMenuAtomicData );
};

/**
 * Notify contextmenu manager
 * @param {Object} viewerContextData viewer Context data
 * @param {Number}  contextMenuCmd cmd value from JSCOM
 * @param {object} objectIndex additional object
 */
let notifyContextMgr = ( viewerContextData, contextMenuCmd, objectIndex ) => {
    if( viewerContextData.getContextMenuMgr() ) {
        viewerContextData.getContextMenuMgr().notifyContextMenuMgr( contextMenuCmd, objectIndex );
    }
};

export default exports = {
    pvwContextMenuTrihedron,
    initializeContextMenu,
    updatePvwContextMenuShadedWithEdges,
    updatePvwContextMenuTrihedron,
    updatePvwContextMenuCommand,
    notifyContextMgr,
    updateShadedViewerPreferenceFromPVW,
    updateTrihedronFromPVW,
    deleteMeasurementFromPVW,
    hidePmiEntityFromPVW,
    updateSectionCmdFromPVW,
    pvwContextMenuClean3dView,
    clean3dViewFromPvw,
    getOccurance,
    pvwContextMenu
};
