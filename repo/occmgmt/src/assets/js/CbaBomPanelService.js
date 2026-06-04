// Copyright (c) 2022 Siemens

/**
 * Service for CbaBomPanel view.
 * @module js/CbaBomPanelService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import aceServiceManager from 'js/aceServiceManager';
import aceUrlMgmtService from 'js/aceUrlManagementService';
import occmgmtUtils from 'js/occmgmtUtils';
import dmSvc from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import cadBomAlignmentUtil from 'js/CadBomAlignmentUtil';

let _eventSubDefs = [];

/**
 * Get request preference object
 *
 * @param {object} provider - provider/subPanelContext object
 * @returns {object} - Request preference object
 */
let _getRequestPrefObject = function( provider ) {
    let requestPref = appCtxSvc.ctx.requestPref ? _.clone( appCtxSvc.ctx.requestPref ) : {
        savedSessionMode: 'ignore'
    };
    //if requestPref is already exists then set savedSessionMode to ignore on cloned requestPref
    requestPref.savedSessionMode = 'ignore';

    if( provider.openMode ) {
        requestPref.openWPMode = provider.openMode;
    }

    // Check whether the CBA page is launched through a change
    if( CBAImpactAnalysisService.isImpactAnalysisMode() && CBAImpactAnalysisService.shouldShowRedlinesInIA()
        || CadBomOccurrenceAlignmentUtil.isSplitViewKey( provider.viewKey ) && provider.isRedlineModeEnabled ) {
        // Enable redlining only for the source strucutre which is associated to ECN context.
        // No Show change in request preference => redline is enabled by default if the context top item is associated with ECN
        // Show change = false in reuqest preference => redline is not enabled even if the context top item is associated with ECN
        // Show change = true in request preference => redline is enabled even if the context top item is associated with closed ECN
        requestPref.showChange = [ 'true' ];
    } else {
        // For the the target structure which is yet to be updated; redline should not be enabled
        // So explicity pass show chnage = false in request preference
        requestPref.showChange = [ 'false' ];
    }
    return requestPref;
};

/**
 * Set default display view mode
 *
 * @param {object} provider - provider/subPanelContext object
 */
let _setDefaultDisplayMode = function( provider ) {
    let cbaViewModePrefValue = appCtxSvc.getCtx( 'preferences.AW_SubLocation_CBASublocation_ViewMode' );
    provider.defaultDisplayMode = cbaViewModePrefValue ? cbaViewModePrefValue[ 0 ] : provider.defaultDisplayMode;
};

/**
 * Update breadcrumb
 *
 * @param {object} eventData - Event data
 * @param {object} provider - provider/subPanelContext object
 */
let _updateBreadCrumbs = function( eventData, provider ) {
    if( eventData.lastSelectedObject ) {
        eventBus.publish( provider.breadcrumbConfig.vm + '.updateBreadCrumb', eventData );
    }
};

/**
 * Set expansion state of context
 *
 * @param {string} contextKey - context key
 */
let _setExpansionState = function( contextKey ) {
    if( appCtxSvc.ctx.cbaContext.resetTreeExpansionState ) {
        appCtxSvc.ctx[ contextKey ].resetTreeExpansionState = true;
    }
};

let _getPciData = function( requestPref ) {
    if( CBAImpactAnalysisService.isImpactAnalysisMode() ) {
        let stateParamMap = AwStateService.instance.params;
        let pci_uid = stateParamMap.pci_uid;
        let pciObj = cdmSvc.getObject( pci_uid );
        _addChangeInfoToPci( pciObj, requestPref );
        pci_uid = stateParamMap.pci_uid2;
        pciObj = cdmSvc.getObject( pci_uid );
        _addChangeInfoToPci( pciObj, requestPref );
    }
};

let _addChangeInfoToPci = function( pciObj, requestPref ) {
    if( pciObj && pciObj.props ) {
        if(  pciObj.props.awb0ShowChange && pciObj.props.awb0ShowChange.dbValues[0] === '0' ) {
            requestPref.showChange = 'false';
        }else{
            requestPref.showChange = 'true';
        }
    }
};

/**
 * Register context for CBA BOM Panel
 *
 * @param {object} provider - provider/subPanelContext object
 * @param {object} subPanelContext - sub panel context object
 */
let  _registerContext = function( provider, subPanelContext ) {
    let requestPref = _getRequestPrefObject( provider );
    _getPciData( requestPref );
    appCtxSvc.registerCtx( 'requestPref', requestPref );
    provider.columnsToExclude = CBAImpactAnalysisService.filterColumnsToExclude( provider );
    // Distinguish from fresh load and from alignment check notification link for ebom
    // If from alignment check notification link, get exploded mode of ebom from preference.
    let explodeFlag = false;
    if( provider.viewKey === 'CBATrgContext' && appCtxSvc.getCtx( 'cbaContext.alignmentCheckContext.dataSetUID' ) !== undefined ) {
        explodeFlag = appCtxSvc.getCtx( 'preferences.FND0_IS_COMPARE_MODE_EXPLODED' ) !== undefined && appCtxSvc.getCtx( 'preferences.FND0_IS_COMPARE_MODE_EXPLODED' )[0] === 'true';
    }
    let contextObject = {
        currentState: {
            uid: provider.baseSelection.uid
        },
        pwaSelectionModel: {},
        previousState: {},
        requestPref: requestPref,
        modelObject: provider.baseSelection,
        readOnlyFeatures: {},
        urlParams: provider.urlParams,
        expansionCriteria: {},
        isRowSelected: false,
        supportedFeatures: [],
        columnsToExclude: provider.columnsToExclude,
        transientRequestPref: {
            startFreshNavigation:true
        },
        persistentRequestPref: {
            showExplodedLines: explodeFlag
        }
    };

    // Defect : LCS-1042758 : if launch guided update from ACE with partition scheme applied, then guided update should retain partition and partition scheme
    CBAImpactAnalysisService.setRestoreSavedSessionMode( contextObject, provider.contextKey, subPanelContext?.cbaContext?.ImpactAnalysis?.sourceTopItem );
    appCtxSvc.registerCtx( provider.contextKey, contextObject );
};

/**
 * Update ACE active context
 *
 * @param {string} contextKey - context key
 */
let _updateAceActiveContext = function( contextKey ) {
    appCtxSvc.updatePartialCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.getCtx( contextKey )
    } );
};

/**
 * Method to update the sub panel context
 *
 * @param {object} data - CBA BOM Panel View model
 */
const updateSubPanelContext = ( subPanelContext ) => {
    if( appCtxSvc.ctx ) {
        return {
            modelObject: appCtxSvc.ctx[ subPanelContext.viewKey ].modelObject,
            provider: subPanelContext
        };
    }
    return null;
};

/**
 * Register occDataLoadedEvent event
 *
 * @param {object} data CBA BOM Panel view model
 */
let _registerOccDataLoadedEvent = function( eventData, subPanelContext ) {
    let contextInfo = {};
    let baseSelection = {};
    if( eventData && eventData.contextKey && eventData.contextKey === subPanelContext.contextKey ) {
        contextInfo = updateSubPanelContext( subPanelContext );
        _updateBreadCrumbs( {
            id: eventData.contextKey,
            lastSelectedObject: eventData.context
        }, subPanelContext );
        baseSelection = contextInfo.modelObject;
    }
    return {
        contextInfo: contextInfo,
        baseSelection: baseSelection
    };
};

/**
 * Register breadcrumb config view model refresh event
 *
 * @param {object} data CBA BOM Panel view model
 */
let _registerBreadcrumbConfigVMRefreshEvent = function( subPanelContext, data ) {
    let eventTopic = subPanelContext.breadcrumbConfig.vm + '.refresh';
    let breadcrumbConfigVMRefreshSubDef = eventBus.subscribe( eventTopic, function( eventData ) {
        if( eventData.lastSelectedObject ) {
            _updateBreadCrumbs( eventData, subPanelContext );
        } else {
            if( data.ctx && data.ctx[ subPanelContext.viewKey ].modelObject ) {
                _updateBreadCrumbs( {
                    id: subPanelContext.viewKey,
                    lastSelectedObject: data.ctx[ subPanelContext.viewKey ].modelObject
                }, subPanelContext );
            }
        }
    } );
    _eventSubDefs.push( breadcrumbConfigVMRefreshSubDef );
};

/**
 * Register register event listerner
 *
 * @param {object} data CBA BOM Panel view model
 */
let _registerEventListeners = function( subPanelContext, data ) {
    _registerBreadcrumbConfigVMRefreshEvent( subPanelContext, data );
};

/**
 * Update occContext with exploded flag
 * @param {*} showExplodedLines Exploded value
 * @param {*} subPanelContext sub-panel context
 */
let _updateOccContextWithExplodedFlag = function( showExplodedLines, subPanelContext ) {
    if( showExplodedLines === '1' ) {
        let transientRequestPref = subPanelContext.occContext.transientRequestPref;
        transientRequestPref.showExplodedLines = false;
        let value = { ...subPanelContext.occContext.value };
        value.transientRequestPref.showExplodedLines = false;
        value.currentState.pci_uid = '';
        occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
    }
};

/**
 * Initialize cbaBomPanel
 *
 * @param {object} subPanelContext - panel data
 * @param {object} data - Declarative data
 */
export let initializeCbaBomPanel = function( subPanelContext, data ) {
    let provider = subPanelContext.provider;
    let contextKey = subPanelContext.provider.contextKey;

    _setDefaultDisplayMode( provider );
    _registerContext( provider, subPanelContext );
    _updateAceActiveContext( contextKey );

    let toParams = appCtxSvc.getCtx( 'state.params' );

    // Enable CBA View in redline mode according the "Show Redlines" command state(turn on or off) in ACE view
    // Make the redline mode is configurable
    // Check whether the CBA page is launched through a change
    // If the CBA page is launched from Change Summary table, we didn't need to update the isChangeEnabled prop,
    // directly fetch the requestPref.showChange prop from global context
    // If the CBA page is launched from ACE view, we can fetch the requestPref.showChange prop from isChangeEnabled of currentContext
    // TO DO: will track this code whenever we restructure the code.
    if( !( cadBomAlignmentUtil.getBooleanValue( toParams.isIA_mode ) && toParams.ecn_uid ) ) {
        if( CadBomOccurrenceAlignmentUtil.isSplitViewKey( contextKey ) && subPanelContext.provider.isRedlineModeEnabled ) {
            // For CBA view, if isRedlineModeEnabled is true, make the lines enable change
            appCtxSvc.updatePartialCtx( contextKey + '.isChangeEnabled', true );
        } else{
            appCtxSvc.updatePartialCtx( contextKey + '.isChangeEnabled', false );
        }
    }

    _registerEventListeners( provider, data );
    aceServiceManager.initializeOccMgmtServices( contextKey );
    CadBomOccurrenceAlignmentUtil.registerSplitViewMode();
    aceUrlMgmtService.updateState( subPanelContext, true );

    let stateParamMap = AwStateService.instance.params;
    let pci_uid = stateParamMap.pci_uid2;

    let pciObj = occmgmtUtils.getObject( pci_uid );
    if( pciObj && pciObj.props ) {
        if( pciObj.props.awb0ShowExplodedLines && pciObj.props.awb0ShowExplodedLines.dbValues ) {
            let showExpLine = pciObj.props.awb0ShowExplodedLines.dbValues[0];
            _updateOccContextWithExplodedFlag( showExpLine, subPanelContext );
        } else{
            dmSvc.getProperties( [ pci_uid ], [ 'awb0ShowExplodedLines' ] ).then( function( ) {
                pciObj = occmgmtUtils.getObject( pci_uid );
                let showExpLine = pciObj.props.awb0ShowExplodedLines.dbValues[0];
                _updateOccContextWithExplodedFlag( showExpLine, subPanelContext );
            } );
        }
    }

    _setExpansionState( contextKey );

    const updateUrlFromCurrentStateEventSubscription = eventBus.subscribe( 'appCtx.update', function( event ) {
        if( event.name === contextKey && event.target === 'currentState' ) {
            aceUrlMgmtService.updateUrlFromCurrentState( event, subPanelContext );
        }
    } );
    return { provider, contextKey, updateUrlFromCurrentStateEventSubscription };
};

/**
 * Cleanup registration done by cbaBomPanel
 */
export let cleanupCbaBomPanel = function( subPanelContext ) {
    aceServiceManager.destroyOccMgmtServices( subPanelContext );

    let requestPref = appCtxSvc.getCtx( 'requestPref' );
    if( requestPref ) {
        occmgmtUtils.updateValueOnCtxOrState( 'savedSessionMode', 'restore', 'requestPref' );
    }
    _.forEach( _eventSubDefs, function( eventSubDef ) {
        eventBus.unsubscribe( eventSubDef );
    } );
    _eventSubDefs.length = 0;
};

/**
 * Open single structure dialog
 *
 * @param {object} dialogAction - dialog action
 * @param {object} eventData - event data
 * @param {object} subPanelContext - panel data
 * @param {object} occContext - occContext object
 * @param {object} occContext2 - occContext2 object
 */
export const openSingleDialog = ( dialogAction, eventData, subPanelContext, occContext, occContext2 ) => {
    let activeContext = occContext;
    let inactiveContext = occContext2;

    if( eventData.contextKey === occContext.viewKey ) {
        inactiveContext = occContext;
        activeContext = occContext2;
    }

    if( dialogAction ) {
        let options = {
            view: 'CbaOpenInViewPanel',
            parent: '.aw-layout-workarea',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            placement:'right',
            isPinUnpinEnabled: false,
            eventData,
            subPanelContext: subPanelContext,
            occContext: activeContext,
            inactiveContext: inactiveContext
        };
        dialogAction.show( options );
    }
};

const exports = {
    initializeCbaBomPanel,
    cleanupCbaBomPanel,
    _registerOccDataLoadedEvent,
    openSingleDialog
};

export default exports;
