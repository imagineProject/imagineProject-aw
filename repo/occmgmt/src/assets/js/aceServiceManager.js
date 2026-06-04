// Copyright (c) 2022 Siemens

/**
 * @module js/aceServiceManager
 */
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import backgroundWorkingCtxTimer from 'js/aceBackgroundWorkingContextTimerService';
import backgroundWorkingCtxSvc from 'js/aceBackgroundWorkingContextService';
import aceToggleIndexConfigurationService from 'js/aceToggleIndexConfigurationService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import aceColorDecoratorService from 'js/aceColorDecoratorService';
import structureFilterService from 'js/structureFilterService';
import discoveryFilterService from 'js/discoveryFilterService';
import discoverySubscriptionService from 'js/discoverySubscriptionService';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import aceStructureEditService from 'js/aceStructureEditService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import aceChangeService from 'js/aceChangeService';
import aceDefaultCutCopyService from 'js/aceDefaultCutCopyService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import acePropertyPolicyService from 'js/acePropertyPolicyService';
import variantInfoConfigurationService from 'js/variantInfoConfigurationService';
import propertyCallTimer from 'js/invoker/propertyCallTimer';
import requestQueue from 'js/invoker/requestQueue';
import effectivityService from 'js/effectivityService';
import configurationBaselineService from 'js/configurationBaselineService';
import acePartialSelectionService from 'js/acePartialSelectionService';
var exports = {};

/**
 * Initialize occurrence management services
 */
export let initializeOccMgmtServices = function( contextKey, useAutoBookmark, provider ) {
    occMgmtStateHandler.initializeOccMgmtStateHandler( contextKey );
    if( useAutoBookmark ) {
        backgroundWorkingCtxTimer.initialize( contextKey );
        backgroundWorkingCtxSvc.initialize( contextKey );
        aceRestoreBWCStateService.initialize( contextKey );
    }
    aceUpdatePwaDisplayService.initialize( contextKey );
    aceColorDecoratorService.initializeColorDecors( contextKey );
    aceToggleIndexConfigurationService.initialize( contextKey );
    structureFilterService.initializeContextKey( contextKey );
    discoverySubscriptionService.initialize( contextKey, provider );
    aceTreeTableDataService.initialize( contextKey );
    aceStructureEditService.initialize( contextKey );
    aceChangeService.initialize( contextKey );
    aceExpandBelowService.initialize( contextKey );
    variantInfoConfigurationService.initialize( contextKey );
    aceConfiguratorTabsEvaluationService.initialize( contextKey );
    effectivityService.initialize( contextKey );
    propertyCallTimer.initialize();
    requestQueue.initialize();
    configurationBaselineService.initialize();
    acePartialSelectionService.initialize( contextKey );

    //Following call to register policy will be removed in future with polarion item :
    // LCS-545909 - Remove property policy on client JS code for 'awb0QuantityManaged' and implement proper fix
    acePropertyPolicyService.registerPropertyPolicy();
};

/**
 * Destroy occurrence management services
 */
export let destroyOccMgmtServices = function( subPanelContext ) {
    let contextKey = subPanelContext.provider.contextKey;
    if( subPanelContext.provider.useAutoBookmark ) {
        backgroundWorkingCtxTimer.reset();
        backgroundWorkingCtxSvc.reset( subPanelContext );
    }

    aceToggleIndexConfigurationService.reset( contextKey );
    aceUpdatePwaDisplayService.destroy( contextKey );
    occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
    aceColorDecoratorService.destroyColorDecors( contextKey );
    structureFilterService.destroy( contextKey );
    discoveryFilterService.destroy( contextKey );
    aceTreeTableDataService.destroy();
    aceStructureEditService.destroy( contextKey );
    aceExpandBelowService.destroy( contextKey );
    aceChangeService.destroy( contextKey );
    aceDefaultCutCopyService.destroy( contextKey );
    aceRestoreBWCStateService.destroy( contextKey );
    discoverySubscriptionService.destroy( contextKey );
    variantInfoConfigurationService.destroy( contextKey );
    aceConfiguratorTabsEvaluationService.destroy( contextKey );
    effectivityService.destroy( contextKey );
    propertyCallTimer.destroy();
    requestQueue.destroy();
    configurationBaselineService.destroy();

    //Following call to register policy will be removed in future with polarion item :
    // LCS-545909 - Remove property policy on client JS code for 'awb0QuantityManaged' and implement proper fix
    acePropertyPolicyService.unRegisterPropertyPolicy();
};

/**
 * Occurrence Management Service Manager
 */

export default exports = {
    initializeOccMgmtServices,
    destroyOccMgmtServices
};
