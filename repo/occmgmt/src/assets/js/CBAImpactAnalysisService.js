// Copyright (c) 2022 Siemens

/**
 * Service defines functionalities when CBA Page is launched from Change (ECN)
 * @module js/CBAImpactAnalysisService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cbaConstants from 'js/cbaConstants';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import eventBus from 'js/eventBus';


/**
 * Check if in Impact Analysis Mode
 *
 * @return {Boolean} true if in Impact Analysis Mode else false.
 */
export let isImpactAnalysisMode = function() {
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    return impactAnalysis ? Boolean( impactAnalysis.isImpactAnalysisMode ) : Boolean( impactAnalysis );
};

/**
 * Get the provider name to fetch Aligned Objects when in Impact Analysis
 *
 * @returns {Promise} Promise after getting the provider name
 */
export let getProviderName = function() {
    let deferred = AwPromiseService.instance.defer();
    // If ECN is not set we send the provider name as an empty string.
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    let providerName = impactAnalysis.alignedTargetProviderInECN ? impactAnalysis.alignedTargetProviderInECN : '';
    let output = {
        providerName: providerName
    };
    deferred.resolve( output );
    return deferred.promise;
};

/**
 * Filter the columnsToExclude for the given provider
 * @param {String} provider - provider
 *
 * @return {Array} Columns to exclude.
 */
export let filterColumnsToExclude = function( provider ) {
    // The action column should be shown only when the CBA page is launched from Change Summary Page
    const toParams = appCtxSvc.getCtx( 'state.params' );

    if( toParams.isIA_mode && toParams.isIA_mode === true && toParams.ecn_uid ) {
        let columnToInclude = 'Awb0ConditionalElement.awb0MarkupType';

        //The Action Column(awb0MarkupType) should be shown only for the Solution Item Structure which was opened from change
        // For all other cases awb0MarkupType will be excluded from the columns to be loaded.
        if( provider && toParams.adaptObj_uid && toParams.adaptObj_uid === provider.baseSelection.uid ) {
            let columnsToExclude;
            // Remove the columnToInclude from columnsToExclude for the given contextKey
            columnsToExclude = provider.columnsToExclude.filter( function( column ) {
                return column !== columnToInclude;
            } );
            return columnsToExclude;
        }
    }
    return provider.columnsToExclude;
};

/**
 * Evaluates whether to show redlines in Impact Analysis Mode
 *
 * @returns {Boolean} true or false
 */
export let shouldShowRedlinesInIA = function() {
    let toParams = appCtxSvc.getCtx( 'state.params' );
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    // When launch Guided Update Page from Change Summary Table, if top item of source or target structure was associated current ECN, should enable redlining mode
    return Boolean( impactAnalysis && impactAnalysis.ECNForImpactAnalysis && ( impactAnalysis.sourceTopItem.uid === toParams.src_uid || impactAnalysis.sourceTopItem.uid === toParams.trg_uid ) );
};

/**
 * Check if guided update launch from ACE or not
 * 
 * @returns { boolean } true if guided update is launched from ACE else false
 */
export const isGuidedUpdatelaunchedFromACE = function() {
    const isImpactAnalysisMode = exports.isImpactAnalysisMode();
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    return Boolean( isImpactAnalysisMode && impactAnalysis && !impactAnalysis.ECNForImpactAnalysis );
};

/**
 * Check if need to restore saved session while launching guided update
 * 
 * @param {*} contextKey viewKey for which saved session to restore
 * @param {*} ecnSourceTopItem source top from which guided update launched 
 * @returns 
 */
export const isRestoreSavedSessionMode = function( contextKey, ecnSourceTopItem ) {
    if( exports.isGuidedUpdatelaunchedFromACE() ) {
        const qualifier = cbaObjectTypeService.getObjectsQualifierType( [ ecnSourceTopItem ] );
        if( qualifier[ cbaConstants.DESIGN ] && contextKey === cbaConstants.CBA_SRC_CONTEXT ) {
            return true;
        }

        // Fix the Defect: LCS-1158489 - Tc2506_GUFocusMode: Focus mode toggle state is Off by default if guided update panel launched from ACE on part.
        // Case - For Usage BOM, when launch Guided Update from ACE for skip node, should retain the expanded state of the source structure
        if( ( qualifier[ cbaConstants.PART ] || qualifier[ cbaConstants.PRODUCT_EBOM ] ) && contextKey === cbaConstants.CBA_TRG_CONTEXT ) {
            return true;
        }
    }
    return false;
};

/**
 * Set restore saved session if launching and performing guided update
 * 
 * @param { object } contextObject viewKey for which saved session to restore
 * @param { string } contextKey viewKey for which saved session to restore
 * @param { object } ecnSourceTopItem source top from which guided update launched 
 * @returns 
 */
export const setRestoreSavedSessionMode = function( contextObject, contextKey, ecnSourceTopItem ) {
    let isRestoreSavedSessionMode = exports.isRestoreSavedSessionMode( contextKey, ecnSourceTopItem );
    let isRestoreSavedSessionModeCTX = appCtxSvc.getCtx( contextKey + '.isRestoreSavedSessionMode' );

    // isRestoreSavedSessionMode = true when launch guided update from ACE
    // isRestoreSavedSessionModeCTX = true when perform guided update and page changes from Guided Update to CBA Page
    if( isRestoreSavedSessionMode || isRestoreSavedSessionModeCTX ) {
        delete contextObject.transientRequestPref.startFreshNavigation;
        contextObject.requestPref.savedSessionMode = 'restore';
        contextObject.isRestoreSavedSessionMode = true;
    }
};

/**
 * Suscribe data load event
 */
eventBus.subscribe( 'occDataLoadedEvent', function( eventData ) {
    // after guided update perform when navigate to CBA page at that time clear the flag
    if( eventData && ( eventData.contextKey === cbaConstants.CBA_SRC_CONTEXT ||
        eventData.contextKey === cbaConstants.CBA_TRG_CONTEXT ) &&
        eventData.dataProviderActionType === 'initializeAction' && !exports.isImpactAnalysisMode() ) {
        exports.clearRestoreSavedSessionMode( eventData.contextKey );
    }
} );

/**
 * Clear restore saved session mode
 */
export const clearRestoreSavedSessionMode = function( contextKey ) {
    appCtxSvc.unRegisterCtx( contextKey + '.isRestoreSavedSessionMode' );
};


/**
 * CBA ImpactAnalysis Service
 */

const exports = {
    isImpactAnalysisMode,
    getProviderName,
    filterColumnsToExclude,
    shouldShowRedlinesInIA,
    isGuidedUpdatelaunchedFromACE,
    isRestoreSavedSessionMode,
    setRestoreSavedSessionMode,
    clearRestoreSavedSessionMode
};
export default exports;
