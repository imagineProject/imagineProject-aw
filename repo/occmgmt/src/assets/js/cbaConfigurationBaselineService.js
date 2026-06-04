// Copyright (c) 2024 Siemens

/**
 * Service defines configuration baseline functionality related CBA
 * @module js/cbaConfigurationBaselineService
 */

import _ from 'lodash';
import aceGetService from 'js/aceGetService';
import cadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaConstants from 'js/cbaConstants';
import appCtxSvc from 'js/appCtxService';

/** CBA configuration baseline handler */
let cbaConfigurationBaselineHandler  = null;

/**
 * Register pre getOccurrence handler
 */
const _registerHandlerPreGetOccCBAExtPoint = function(){

    if( !cbaConfigurationBaselineHandler )
    {
        let conditionFunction = function( _loadInput, occContext ) {
            return !!(cadBomOccurrenceAlignmentUtil.isCBAView() && occContext?.currentState?.configbaseline_uid);
        };
        let inputParamFunc = function( _loadInput, _occContext, _currentContext, soaInput ) {
            soaInput.inputData.requestPref.configbaseline = [ _occContext.currentState.configbaseline_uid ];
            soaInput.inputData.requestPref.savedSessionMode = [ 'reset' ];
            soaInput.inputData.requestPref.startFreshNavigation = [ 'true' ];
            soaInput.inputData.requestPref.startFreshNavigation = [ 'true' ];
            soaInput.inputData.requestPref.cbaEBOM = _occContext.viewKey === cbaConstants.CBA_TRG_CONTEXT?[ 'true' ]:[ 'false' ];
        };
        cbaConfigurationBaselineHandler = {
            key : 'cbaConfigurationBaselineHandler', //unique identifier
            condition: conditionFunction,
            populateGetOccInput: inputParamFunc
        };
    }
    aceGetService.registerGetOccInputProvider( cbaConfigurationBaselineHandler );
};

/**
 * Unregister cba configuration baseline handler
 */
const unRegisterCbaConfigurationBaselineHandler = function(){
    if( cbaConfigurationBaselineHandler ) {
        aceGetService.unregisterGetOccInputProvider( cbaConfigurationBaselineHandler );
    }
};

export const initializeService = function(){
    _registerHandlerPreGetOccCBAExtPoint();
};

/**
 * Populate configuration baseline information on object
 * 
 * @param {object} objectToUpdate object on which configuration baseline info to populate
 * @param {object} occContext occContext object which have currentState object
 */
export const populateConfigurationBaselineInfo = function(objectToUpdate, occContext){
    if( occContext?.currentState?.configbaseline_uid )
        {
            if(occContext.supportedFeatures.Awb0PartStructureFeature || occContext.supportedFeatures.ProductEBOMFeature)
            {
                objectToUpdate.configbaseline_uid = occContext.currentState.configbaseline_uid;
                objectToUpdate.configbaseline_uid2 = occContext.currentState.configbaseline_uid;
            }
            if(occContext.supportedFeatures.Awb0DesignStructureFeature)
            {
                objectToUpdate.configbaseline_uid = occContext.currentState.configbaseline_uid;
            }
        }
};

/**
 * Get configuration baseline uid from given occContext, 
 * if occContext is not provided then it will read the config baseline uid from the context object on ctx for provided contextKey.
 * if contextKey is also not provided then it will read the config baseline uid from the context object on ctx for active context.
 * 
 * @param {object} occContext occContext object from which config baseline uid to read
 * @param {string} contextKey context key on ctx from which config baseline uid to read
 * @returns {string} configuration baseline uid
 */
export const getConfiguredBaselineUid = function( occContext,contextKey ){
    if(occContext)
    {
        return occContext.currentState?.configbaseline_uid;
    }
    contextKey = contextKey || appCtxSvc.getCtx( 'aceActiveContext.key' );
    const contextObject = appCtxSvc.getCtx( contextKey );
    return contextObject?.currentState?.configbaseline_uid;
};

/**
 * Enable config baseline for CBA view
 * It will return based on value of a startup preference CBA_ENABLE_BASELINE
 * @returns true to enable baseline for CBA else false
 */
export const enableConfigBaselineForCBA = function( ){
    let preferences = _.get( appCtxSvc, 'ctx.preferences' );
    if(preferences?.CBA_ENABLE_BASELINE && preferences.CBA_ENABLE_BASELINE.length > 0 )
    {
        return preferences.CBA_ENABLE_BASELINE[0].toUpperCase() === 'TRUE';
    }
    return false;
};

/**
 * CBA Configuration Baseline Service
 */
const exports = {
    initializeService,
    populateConfigurationBaselineInfo,
    getConfiguredBaselineUid,
    unRegisterCbaConfigurationBaselineHandler,
    enableConfigBaselineForCBA
};
export default exports;