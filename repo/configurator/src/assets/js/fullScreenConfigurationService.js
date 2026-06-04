// Copyright (c) 2022 Siemens

/**
 *
 * @module js/fullScreenConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import Pca0IncompleteFamiliesService from 'js/Pca0IncompleteFamiliesService';
import popupService from 'js/popupService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

let m_editHandler;
let m_saveHandler;
var FSC_SAVE_COMMAND = 'save';
var FSC_SAVEAS_COMMAND = 'saveAs';

// Helper functions #################################################################################################### - Start

/**
 * Sets the mode parameters i.e. guided mode or manual mode for a given Full Screen Configuration (FSC) state object based on user preferences
 * @param {Object} fscState - The FSC state atomic data to be updated.
 * @returns {void} The function does not return anything; it directly modifies the passed `fscState` object.
 */
const _setModeParametersFromPreferenceForVCV = fscState => {
    const prefMode = appCtxSvc.getCtx( 'preferences' ).PCA_default_mode_for_VCV ? appCtxSvc.getCtx( 'preferences' ).PCA_default_mode_for_VCV :
        pca0Constants.VARIANT_CONFIG_MODES.GUIDED_MODE;
    if( _.lowerCase( prefMode ) === pca0Constants.VARIANT_CONFIG_MODES.MANUAL_MODE ) {
        fscState.isManualConfiguration = true;
        fscState.guidedMode = false;
    } else {
        fscState.isManualConfiguration = false;
        fscState.guidedMode = true;
    }
};

/**
 * Unregisters the Full Screen Configuration (FSC) context based on reloading event data.
 * The FSC context is not unregistered if the view is being reloaded or if the application is switching from grid to list view.
 * @param {Object} fscContext - The FSC context to be unregistered.
 * @param {Object} newFscState - The new FSC state.
 * @param {Object} vcvReloadingEventData - The reloading event data for the Variant Configuration View (VCV).
 * @returns {void} The function does not return anything; it directly modifies the passed `fscContext` object.
 */
const _unregisterFscContextBasedOnReloadingEventData = ( fscContext, newFscState, vcvReloadingEventData ) => {
    // Do not unregister fscContext if view is being reloaded.
    // This would cause Pca0Summary view to be destroyed and exception when onMountedInitializer is called on reloadVCV
    if( fscContext && _.isUndefined( vcvReloadingEventData ) && !newFscState.isSwitchingFromGridToListView ) {
        appCtxSvc.unRegisterCtx( pca0Constants.FSC_CONTEXT ); //we clean up the entires fscContext here
    }
};

/**
 * Gets the current applied Variant Rule (VR) and selected object based on the provided selected VR and new Variant Rule data.
 * @param {string} selectedVR - The selected Variant Rule.
 * @param {Object} newVariantRuleData - The new Variant Rule data.
 * @property {boolean} newVariantRuleData.useDefaultConfigPerspective - Indicates if the default configuration perspective should be used.
 * @returns {Object} An object containing `currentAppliedVRs` and `selectedModelObjects`.
 * @property {Array} currentAppliedVRs - The current applied Variant Rules.
 * @property {Array} selectedModelObjects - The selected model objects i.e. Configurator Context UID.
 */
const _getCurrentAppliedVRAndSelectedObject = ( selectedVR, newVariantRuleData ) => {
    //this is the variants tab use case
    let currentAppliedVRs;
    let selectedModelObjects;

    if( !_.isEmpty( selectedVR ) ) {
        newVariantRuleData.useDefaultConfigPerspective = false;
        let uids = [ selectedVR ];
        currentAppliedVRs = uids;
    }
    //let the configurator context apply for all the other cases: i.e. configuration modules
    let modelContext = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();
    selectedModelObjects = [ {
        uid: modelContext
    } ];

    return { currentAppliedVRs, selectedModelObjects };
};

/**
 * Registers the Full Screen Configuration (FSC) context with the application context service.
 * @param {Array} currentAppliedVRs - The current applied Variant Rules.
 * @param {Array} selectedModelObjects - The selected model objects.
 * @param {boolean} _isVCVOpenedFromConfigurator - Indicates if the VCV is opened from the configurator.
 * @param {boolean} isGuidedMode - Indicates if the guided mode is enabled.
 * @param {Object} [configPerspective={}] - The configuration perspective. Defaults to an empty object.
 * @returns {void} The function does not return anything; it directly registers the FSC context with the application context service.
 */
const _registerFscContext = ( currentAppliedVRs, selectedModelObjects, _isVCVOpenedFromConfigurator, isGuidedMode, configPerspective = {} ) => {
    appCtxSvc.registerCtx( pca0Constants.FSC_CONTEXT, {
        currentAppliedVRs: currentAppliedVRs,
        selectedModelObjects: selectedModelObjects,
        isVCVOpenedFromConfigurator: _isVCVOpenedFromConfigurator,
        guidedMode: isGuidedMode,
        configPerspective: configPerspective,
        defaultConfigPerspective: configPerspective,
        showConfigurationModules: true
    } );
};

/**
 * Updates the atomic data of the Full Screen Configuration (FSC) state and the Variant Rule data if they are not equal to the new states provided.
 * If the current FSC state's atomic data is not equal to the new FSC state, it sets the atomic data of the FSC state to the new FSC state.
 * If the current Variant Rule data's atomic data is not equal to the new Variant Rule data, it sets the atomic data of the Variant Rule data to the new Variant Rule data.
 * @param {Object} fscState - The current FSC state.
 * @param {Object} newFscState - The new FSC state.
 * @param {Object} variantRuleData - The current Variant Rule data.
 * @param {Object} newVariantRuleData - The new Variant Rule data.
 * @returns {void} The function does not return anything; it directly updates the atomic data of the FSC state and the Variant Rule data.
 */
const _updateFscAtomicData = ( fscState, newFscState, variantRuleData, newVariantRuleData ) => {
    if( fscState && !_.isEqual( fscState.getAtomicData(), newFscState ) ) {
        fscState.setAtomicData( newFscState );
    }
    if( variantRuleData && !_.isEqual( variantRuleData.getAtomicData(), newVariantRuleData ) ) {
        variantRuleData.setAtomicData( newVariantRuleData );
    }
};

/**
 * Manages event subscriptions for the Full Screen Configuration (FSC).
 * Unsubscribes from existing events and subscribes to new ones to avoid duplicate Reload/Reset confirmation messages.
 * This is necessary because the `initFSCConfiguration` method is explicitly called from the `showListView` method other than onMount lifecycle hook.
 * @param {Object} fscState - The current FSC state.
 * @param {Object} variantRuleData - The current Variant Rule data.
 * @returns {void} The function does not return anything; it directly manages event subscriptions.
 */
const _manageEventSubscriptionForFsc = ( fscState, variantRuleData ) => {
    // unsubscribe event as FSC view is being loaded.
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( synchronizeAppliedVRsEvent ) {
        eventBus.unsubscribe( synchronizeAppliedVRsEvent );
    }
    synchronizeAppliedVRsEvent = eventBus.subscribe( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs', function() {
        exports.synchronizeAppliedVRs( fscState, variantRuleData );
    } );

    // unsubscribe event as FSC view is being loaded
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( subLocationContentSelectionChangeEvent ) {
        eventBus.unsubscribe( subLocationContentSelectionChangeEvent );
    }
    subLocationContentSelectionChangeEvent = eventBus.subscribe( 'AM.SubLocationContentSelectionChangeEvent', function( eventData ) {
        eventBus.publish( 'dataProvider.selectionChangeEvent', {
            selected: eventData.selections,
            source: 'secondaryWorkArea'
        } );
    } );

    // unsubscribe event as FSC view is being loaded
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( processPartialErrorEvent ) {
        eventBus.unsubscribe( processPartialErrorEvent );
    }
    processPartialErrorEvent = eventBus.subscribe( 'Pca0FullScreenConfiguration.processPartialError', function( eventData ) {
        pca0CommonUtils.processPartialErrors( eventData.ServiceData );
    } );
};

/**
 * Synchronizes the variant for the Full Screen Configuration (FSC).
 * @param {Object} subPanelContext - The sub panel context.
 * @param {Object} newFscState - The new FSC state.
 * @param {Object} newVariantRuleData - The new Variant Rule data.
 * @param {Object} variantRuleData - The current Variant Rule data.
 * @param {boolean} _isVCVOpenedFromConfigurator - Indicates if the VCV is opened from the configurator.
 * @param {string} selectedVR - The selected Variant Rule.
 * @param {Object} newConfigPerspective - The new configuration perspective.
 * @returns {void} The function does not return anything; it directly synchronizes the variant for the FSC.
 */
const _synchronizeVariantForFsc = ( subPanelContext, newFscState, newVariantRuleData, variantRuleData, _isVCVOpenedFromConfigurator, selectedVR, newConfigPerspective ) => {
    //PLM711151: when starting in the context of occ management, there might be a variant selected already. We have to use it
    //TODO: we will have to replace this with a common variant location btw. fsc and occ man; for now this will work.
    //Note: we also did remove the other instance in fsc where we know the occ man path in the related PLM710995
    const occContext = _.get( subPanelContext, 'context.occContext' );
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    // fire synchronizeEvent if config context set by consumer application
    let synchronizeVariant = _.get( subPanelContext, 'configCtx' );
    if( _.get( occContext, 'productContextInfo.props.awb0CurrentVariantRules.dbValues' ) && !newFscState.isSwitchingFromGridToListView &&
        !_.isEqual( fscContext.currentAppliedVRs, occContext.productContextInfo.props.awb0CurrentVariantRules.dbValues ) ) {
        let svrs = occContext.productContextInfo.props.awb0CurrentVariantRules.dbValues;
        fscContext.currentAppliedVRs = svrs;
        newVariantRuleData.variantRuleData = svrs;
        synchronizeVariant = true;
    } else if( _isVCVOpenedFromConfigurator && selectedVR === '' ) {
        fscContext.currentAppliedVRs = [];
        newVariantRuleData.variantRuleData = [];
        newVariantRuleData.configPerspective = newConfigPerspective;
        newVariantRuleData.defaultConfigPerspective = newConfigPerspective;
        synchronizeVariant = true;
    } else if ( synchronizeVariant && Array.isArray( _.get( subPanelContext, 'selection' ) ) && _.get( subPanelContext, 'selection[0].type' ) === 'VariantRule' ) {
        // Hosted Mode
        let uid = _.get( subPanelContext, 'selection[0].uid' );
        let svrs = uid ? [ uid ] : [];
        fscContext.currentAppliedVRs = svrs;
        fscContext.isSVRLoadedFromHostedMode = true;
        newVariantRuleData.variantRuleData = svrs;
    }

    if( synchronizeVariant ) {
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        newVariantRuleData.useDefaultConfigPerspective = false;
        variantRuleData.setAtomicData( newVariantRuleData );
        eventBus.publish( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs' );
    }
};

/**
 * Handles the window resize event for the Full Screen Configuration (FSC).
 * Adds an event listener to the window's resize event and calls the `handleFSCResize` function when the event is triggered.
 * @param {Object} fscState - The current FSC state.
 * @returns {void} The function does not return anything; it directly adds an event listener to the window's resize event.
 */
const _handleWindowResizeForFsc = ( fscState ) => {
    // Handle Window resize event, with a threshold of 1000px
    window.addEventListener( 'resize', ( evt ) => handleFSCResize( fscState, evt ) );
};

/**
 * Helper function which returns the reversed id, in the form the soa call requires it, empty for root
 * @param {String} alternateID - alternate ID
 * @returns {String} module id as string or empty if root
 */
export let _getReversedModuleId = ( alternateID ) => {
    //if there is no event data, use the fscContext data
    if ( !alternateID ) {
        return ''; //return empty for root
    }
    //alternate uid's build from parent to leaf, the breadcrumb requires reversal
    if ( alternateID.split( ':' ).length < 2 ) {
        return ''; //don't return root as the server needs empty for root
    }

    return alternateID.split( ':' ).reverse().join( ':' );
};
// Helper functions #################################################################################################### - End

/**
 * initialize edit handler for variants tab
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 */
export let initializeEditHandler = function( fscState, variantRuleData ) {
    // Edit Handler
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let declVM = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );

    if( _.isNull( declVM ) ) {
        return;
    }
    declVM.fscState = fscState;
    m_editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declVM
        } ) );

    // Add new method to identify editing context
    m_editHandler.getEditHandlerContext = function() {
        return pca0Constants.FSC_CONTEXT;
    };

    m_editHandler.cancelEdits = () => {
        pca0CommonUtils.setVisibilityOfEditCommandInPWA( true /*visibility*/ );
        exports.updateEditHandlerToFscContext(); //maria: I do question this as this the starting of edits used after a selection and making the svr dirty
        let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
        let fscStateModify = fscState && { ...fscState.getAtomicData() };
        // We are doing variantRuleDirty as false as workaround case in
        // Variants tab where we are seeing unsaved edits notification twice
        // if we dirty the variant rule and select some other sublocation ( ex. Constraints )
        // Reason - isDirty is called again when we discard unsaved edits with VCV view open and variantRuleDirty is true in that case.
        // Hence, we are making it false explicitly.
        if( fscContext && fscContext.isVCVOpenedFromConfigurator && fscStateModify && fscStateModify.variantRuleDirty !== false ) {
            fscStateModify.variantRuleDirty = false;
            fscState.setAtomicData( fscStateModify );
        }
    };

    // Save Handler
    m_saveHandler = {
        isDirty: function( dataSource ) {
            var fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
            let fscState;
            var isDirty = false;
            if( dataSource && dataSource.getDeclViewModel() ) {
                let vmData = dataSource.getDeclViewModel();
                fscState = vmData.fscState;
            }
            if( fscState && fscState.getAtomicData() ) {
                isDirty = fscState.getAtomicData().variantRuleDirty;
            }

            // Return false if new variant creation is in progress
            if( variantRuleData && variantRuleData.getAtomicData() ) {
                //maria todo: we should change the newVariantCreationState from the toggle variable it is now could be called wrongly
                //better would be to explicitly set it to idle or creating
                const newVariantCreationState = variantRuleData.getAtomicData().newVariantCreationState;
                if( newVariantCreationState === 'creating' ) {
                    return false;
                }
            }

            // Return true if all of the following conditions are true:
            // 1. fscContext is truthy
            // 2. fscContext.isVCVOpenedFromConfigurator is truthy
            // 3. fscContext.currentAppliedVRs is not empty
            // 4. isDirty is truthy
            // Note: the ?. operator is the optional chaining operator in JavaScript,
            // used to avoid errors when accessing properties of an object that might be null or undefined
            return Boolean( fscContext?.isVCVOpenedFromConfigurator ) && !_.isEmpty( fscContext?.currentAppliedVRs ) && Boolean( isDirty );
        },
        saveEdits: function() {
            pca0CommonUtils.setVisibilityOfEditCommandInPWA( true /*visibility*/ );
            return saveVariantExpressions();
        }
    };

    const editHandler = editHandlerService.getEditHandler( pca0Constants.TABLE_CONTEXT );
    if( !_.isNull( editHandler ) && editHandler._editing ) {
        exports.updateEditHandlerToTableContext();
    }
};

/**
 * To set edit handler to TABLE CONTEXT only if PWA table in EDITING mode is true
 */
export let updateEditHandlerToTableContext = () => {
    editHandlerService.setActiveEditHandlerContext( pca0Constants.TABLE_CONTEXT );
};

/**
 * Update edit handler context to FSC if "customVariantRule.variantRuleDirty"
 * When user makes changes in open VR or change in settings
 */
export let updateEditHandlerToFscContext = () => {
    const editHandler = editHandlerService.getEditHandler( pca0Constants.TABLE_CONTEXT );
    if( editHandler && !editHandler._editing && m_editHandler ) {
        editHandlerService.setEditHandler( m_editHandler, pca0Constants.VARIANT_FSC_CONTEXT );
        editHandlerService.setActiveEditHandlerContext( pca0Constants.VARIANT_FSC_CONTEXT );
        m_editHandler._editing = true;
        appCtxSvc.updateCtx( 'editInProgress', true );
        m_editHandler.startEdit();
    }
};

/**
 * Return Save Handler for active Edit Context
 * @return {Object} Save Handler
 */
export let getSaveHandler = function() {
    return editHandlerService.getActiveEditHandlerContext() === pca0Constants.VARIANT_FSC_CONTEXT ? m_saveHandler : null;
};

/**
 * Save selected VR in variants TAB
 */
export let saveVariantExpressions = function() {
    let varContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let eventData = {
        variantRule: varContext.initialVariantRule,
        selectedCtx: pca0Constants.FSC_CONTEXT
    };
    eventBus.publish( 'Pca0FullScreenConfiguration.updateVariantRule', eventData );
};

var exports = {};

/** default Preference Value  */
var CFG0_CREATEVARIANTRULETYPE = 'VariantRule'; //NON-NLS-1
var synchronizeAppliedVRsEvent = null;
var subLocationContentSelectionChangeEvent = null;
var processPartialErrorEvent = null;

/**
 * Handle window resize event in FSC
 * @param {Object} fscState fscState atomic data
 */
function handleFSCResize( fscState ) {
    if( !fscState || fscState.getAtomicData() === undefined ) {
        return;
    }
    var newFscState = { ...fscState.getAtomicData() };
    var newIsHorizontalLayout = newFscState.isHorizontalLayout;
    if( window.innerWidth <= 1000 && newFscState.isHorizontalLayout ) {
        newIsHorizontalLayout = false;
    } else if( window.innerWidth > 1000 && !newFscState.isHorizontalLayout ) {
        newIsHorizontalLayout = true;
    }
    if( newIsHorizontalLayout !== newFscState.isHorizontalLayout ) {
        // Update context and fire event if layout actually changed
        newFscState.isHorizontalLayout = newIsHorizontalLayout;
        //we need this to be able to trigger the scopes mount actions but stay on current selected group
        //and skip actions meant for load/unload SVR's. It will get reset by the scopes as soon as it's done mounting
        newFscState.isLayoutResize = true;
        fscState.setAtomicData( newFscState );
    }
}

/**
 * Toggle the summary button
 */
export let toggleShowSummaryPanel = function() {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( context ) {
        if( context.showSummary === undefined ) {
            context.showSummary = false;
        } else {
            context.showSummary = !context.showSummary;
        }
    }
};

export let getSelectionForVariantContext = function( context, subPanelContext ) {
    return pca0CommonUtils.getSelectionForVariantContext( context, subPanelContext.configCtx );
};

/**
 * This API returns initialVariantRule only when selections are undefined
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function( variantRuleData ) {
    return configuratorUtils.getFscActiveVariantRules( variantRuleData );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {Object} ConfigPerspective - Returns the config perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * Return Profile Settings information
 * @returns {Object} Active Profile Settings for FSC
 */
export let getProfileSettingsForFsc = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * This API updates context with Active Profile Settings and Filter Criteria
 * Settings might derive from loaded SVR or default behavior (preference)
 * Also, this API updates the intial variant rule in case of loading the variant rule in Hosted configurator if variant
* @param {Object} response - The response received by SOA service,
 * @param {Object} variantRuleData - The variantRuleData
 * @returns {Object} - Returns information on Applied Settings for the context
 */
export let initSettings = ( response, variantRuleData ) => {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let urlAttributes = appCtxSvc.getCtx( 'state' ).urlAttributes;

    // In Hosted configurator while we load the variant rule using uid, we get its VMO from VCV response, thus need to fetch that VMO from response 
    // and assign it to initalVariantRule
    if( urlAttributes.ah === 'true' ) {    // mode = Hosted
        const modelObjects = response.ServiceData.modelObjects;
        const persistentSVRUid = _.get( fscContext, 'currentAppliedVRs[0]' );
        // Find the VMO for current applied SVR from hosted view
        const svrMO = persistentSVRUid ? Object.values( modelObjects ).find( modelObject => _.get( modelObject, 'props.fnd0objectId.dbValues[0]' ) === persistentSVRUid ) : undefined;

        if( svrMO ) {
            // Adding below check to avoid unnecessary repeated update of context and summary chip
            if( persistentSVRUid !== svrMO.uid ) {
                // Update the current Applied VRs and initial variant rule in the context
                fscContext.currentAppliedVRs[ 0 ] = svrMO.uid;
                let svrVMO = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( svrMO.uid ), 'EDIT' );
                fscContext.initialVariantRule = svrVMO;
                appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
                eventBus.publish( 'Pca0Summary.updateSummaryChip' );
            }
        }
    }

    let saveAsDefault = false;
    let newVariantRuleData = { ...variantRuleData.getAtomicData() };
    if( !newVariantRuleData.defaultConfigPerspective.uid && newVariantRuleData.useDefaultConfigPerspective ) {
        newVariantRuleData.defaultConfigPerspective = response.configPerspective;
        saveAsDefault = true;
    }
    newVariantRuleData.configPerspective = response.configPerspective;
    variantRuleData.setAtomicData( newVariantRuleData );

    const appliedSettings = {};

    // Filter Criteria are always returned
    let configSettings = _.get( response, 'responseInfo.configSettings' );
    if( configSettings ) {
        configSettings = JSON.parse( configSettings[ 0 ] );
        appliedSettings.configSettings = configSettings;

        // Active Validation Mode
        const activeValidationProfile = JSON.parse( response.responseInfo.activeSolverProfileSettings[ 0 ] );
        // Localize for OOTB Overlay/Order and for Custom profiles
        configuratorUtils.localizeValidationProfileNames( activeValidationProfile );

        // Check if rule Date Translation Mode exists in response
        // NOTE- ruleDateTranslationMode will be available from tc14.1 releases only
        if( response.responseInfo.ruleDateTranslationMode && response.responseInfo.ruleDateTranslationMode[ 0 ] ) {
            // Set Rule Date Translation Mode
            appliedSettings.ruleDateTranslationMode = response.responseInfo.ruleDateTranslationMode[ 0 ];
        }

        if( !_.isEmpty( fscContext.initialVariantRule ) && activeValidationProfile.pca0ProfileName === 'pca0Custom' ) {
            const notificationMessage =
                configuratorUtils.getFscLocaleTextBundle().profileSettingsNotMatchingLoadingCustom.replace(
                    '{0}', fscContext.initialVariantRule.props.object_string.dbValue );
            configuratorUtils.showNotificationMessage( notificationMessage, 'WARNING' );
        }
        appliedSettings.validationProfile = activeValidationProfile;
        fscContext.appliedSettings = appliedSettings;
        fscContext.configPerspective = newVariantRuleData.configPerspective;
        fscContext.currentConfigPerspective = newVariantRuleData.configPerspective;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        eventBus.publish( 'Pca0FullScreenConfiguration.activeSettingsLoaded' );
    }
    //save the applied settings as default so they can be retrieved as default perspective reinstated
    if( fscContext && saveAsDefault ) {
        fscContext.defaultAppliedSettings = _.cloneDeep( appliedSettings );
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }

    return appliedSettings;
};

/**
 * Handle Apply Configuration
 * @param {Object} commandContext containing selection atomic data
 */
export let handleFSCConfiguration = function( commandContext ) {
    //Close the package panel first
    eventBus.publish( 'Pca0Configurator.closeDialog' );

    let variantRuleDirty = false;

    if( commandContext.fscState && commandContext.fscState.getAtomicData ) {
        variantRuleDirty = commandContext.fscState.getAtomicData().variantRuleDirty;
    } else if( commandContext.fscState && commandContext.fscState.value ) {
        variantRuleDirty = commandContext.fscState.value.variantRuleDirty;
    }
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( variantRuleDirty || fscContext.initialVariantRule === undefined ) {
        eventBus.publish( 'Pca0FullScreenConfiguration.applyConfiguration', {
            conditionFlag: 'false'
        } );
    } else {
        const customRule = fscContext.customVariantRule;
        let ruleUid;
        if( fscContext.initialVariantRule && fscContext.initialVariantRule.uid ) {
            ruleUid = fscContext.initialVariantRule.uid;
        } else if( customRule && customRule.uid ) {
            ruleUid = customRule.uid;
        }

        if( ruleUid ) {
            eventBus.publish( 'Pca0FullScreenConfiguration.configureContent', {
                variantRules: [ ruleUid ]
            } );
        }
    }
};

/**
 * This method used to activate the command panel in fsc to save new svr/Variant Criteria or
 * update the saved svr/Variant Criteria.
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} commandContext command context of the panel
 */
export let fscActivateCommandPanel = function( commandId, location, commandContext ) {
    const { dialogAction } = commandContext;
    let getPreference = appCtxSvc.getCtx( 'preferences' );
    let panelContext = { ...commandContext, panelTitle: FSC_SAVE_COMMAND };
    let showAttachmentChoice = _.get( panelContext, 'activeTab.data.showAttachmentChoice' );
    if( panelContext.isVCVOpenedFromConfigurator ) {
        //in Variants tab we never show attachments to bom
        showAttachmentChoice = false;
    }
    showAttachmentChoice !== undefined && _.set( panelContext, 'showAttachmentChoice', showAttachmentChoice );
    let varContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    varContext.createVariantPreference = CFG0_CREATEVARIANTRULETYPE;
    if( getPreference.Cfg0CreateVariantRuleType && !_.isEmpty( getPreference.Cfg0CreateVariantRuleType[ 0 ] ) ) {
        varContext.createVariantPreference = getPreference.Cfg0CreateVariantRuleType[ 0 ];
    }
    //the event will call server funct which taps into the value of the fscContext, make sure to update it
    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, varContext );

    if( !varContext.initialVariantRule || varContext.initialVariantRule.props.object_string.dbValue === configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
        let options = {
            view: commandId,
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            parent: location,
            isCloseVisible: false,
            subPanelContext: panelContext
        };

        //Open the dialog
        dialogAction.show( options );
    } else {
        var eventData = {
            variantRule: varContext.initialVariantRule,
            selectedCtx: pca0Constants.FSC_CONTEXT
        };
        eventBus.publish( 'Pca0FullScreenConfiguration.updateVariantRule', eventData );
    }
};

/**
 * This method used to activate the command panel in fsc to save current svr with new name
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} commandContext command context of the panel
 */
export let fscActivateSaveAsCommandPanel = function( commandId, location, commandContext ) {
    const { dialogAction } = commandContext;
    let getPreference = appCtxSvc.getCtx( 'preferences' );
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let panelContext = { ...commandContext, panelTitle: FSC_SAVEAS_COMMAND };
    let showAttachmentChoice = _.get( panelContext, 'activeTab.data.showAttachmentChoice' );
    if( panelContext.isVCVOpenedFromConfigurator ) {
        //in Variants tab we never show attachments to bom
        showAttachmentChoice = false;
    }
    showAttachmentChoice !== undefined && _.set( panelContext, 'showAttachmentChoice', showAttachmentChoice );
    fscContext.createVariantPreference = CFG0_CREATEVARIANTRULETYPE;
    if( getPreference.Cfg0CreateVariantRuleType && !_.isEmpty( getPreference.Cfg0CreateVariantRuleType[ 0 ] ) ) {
        fscContext.createVariantPreference = getPreference.Cfg0CreateVariantRuleType[ 0 ];
    }
    let options = {
        view: commandId,
        placement: 'right',
        width: 'SMALL',
        height: 'FULL',
        parent: location,
        isCloseVisible: false,
        subPanelContext: panelContext
    };

    //Open the dialog
    dialogAction.show( options );
};

/**
 * Initialize fscContext with syncObject data
 * @param {Object} subPanelContext subPanelContext
 * @returns {Boolean} return true if input flag isVCVOpenedFromConfigurator value is true, else return false and the selectedSVR uid
 */
export let isVCVOpenedFromConfigurator = function( subPanelContext ) {
    // isVCVOpenedFromConfigurator flag to identify if VCV is opened from Configurator Context
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    let _isVCVOpenedFromConfigurator = false;
    let selectedVR = '';
    if( configuratorCtx && !_.isUndefined( configuratorCtx.variantRuleData ) ) {
        const isVCVOpenedFromConfigurator = configuratorCtx.variantRuleData.isVCVOpenedFromConfigurator;
        // if this flag is true, assign the value to local variable
        if( isVCVOpenedFromConfigurator ) {
            _isVCVOpenedFromConfigurator = isVCVOpenedFromConfigurator;
        }
        // if selectedObjects is empty, it means variant rule is not selected
        selectedVR = configuratorCtx.variantRuleData.selectedObjects ? configuratorCtx.variantRuleData.selectedObjects[ 0 ].uid : '';
    } else if( subPanelContext && !_.isUndefined( subPanelContext.singleSVRViewMode ) && !_.isUndefined( subPanelContext.selection ) ) {
        _isVCVOpenedFromConfigurator = true; //we have to set it that way from the MultiSVRView as well to fulfill all the paths this is getting checked
        let type = _.get( subPanelContext, 'selection.0.type' );
        if( type === 'VariantRule' || type === 'Cfg0VariantCriteria' ) {
            selectedVR = subPanelContext.selection[ 0 ].uid;
        } else {
            selectedVR = '';
        }
    }
    return { _isVCVOpenedFromConfigurator, selectedVR };
};

/**
 * Initialize Full Screen Configuration Page
 * Re-initialize atomic Data in case VCV is being reloaded
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @param {Object} vcvReloadingEventData - the vcvReload event Info container
 * @param {Object} subPanelContext - subPanel context in hosted-configurator mode to load fsc
 * @returns {Boolean} true if initialized successfully
 */
export let initFSCConfiguration = ( fscState, variantRuleData, vcvReloadingEventData, subPanelContext ) => {
    let newFscState = { ...fscState.getAtomicData() };
    let newVariantRuleData = { ...variantRuleData.getAtomicData() };

    // initialize fscContext with input data
    const { _isVCVOpenedFromConfigurator, selectedVR } = exports.isVCVOpenedFromConfigurator( subPanelContext );

    let currentAppliedVRs;
    let selectedModelObjects;

    // Tells in what mode the VCV should start. i.e. guided mode or manual mode depending on preference value
    _setModeParametersFromPreferenceForVCV( newFscState );

    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    // get hold of the current applied VRs and selected model objects.
    if( fscContext ) {
        currentAppliedVRs = fscContext.currentAppliedVRs;
        selectedModelObjects = fscContext.selectedModelObjects;
    }

    // unregister the old fscContext. Don't unregister only in case
    // 1. vcvReloadingEventData is present
    // 2. view is switched from grid to list view
    _unregisterFscContextBasedOnReloadingEventData( fscContext, newFscState, vcvReloadingEventData );

    //this is the variants tab use case
    // selected VR is the Variant Rule selected in PWA table in Variants Tab
    // selectedModelObjects is the current configurator context
    if( _isVCVOpenedFromConfigurator ) {
        ( { currentAppliedVRs, selectedModelObjects } = _getCurrentAppliedVRAndSelectedObject( selectedVR, newVariantRuleData ) );
    }
    //get the default settings set via the last fetchActiveSettingsCall for the variants tab use case in which the config perspective we need to use is the one
    //gotten from the server after the fetchSettings call
    let newConfigPerspective;
    // FSC starts in Horizontal Mode
    // Check if other applications have set currentAppliedVariantRules
    if( currentAppliedVRs && currentAppliedVRs.length > 0 ) {
        if( newFscState.isSwitchingFromGridToListView ) {
            // if Variant Rule is already present, applied and when switching from grid view to list view, update fscContext
            // retain selectedExpressions and other context information
            newFscState.isHorizontalLayout = true;
            if( fscContext.guidedMode === false ) {
                newFscState.isManualConfiguration = true;
            }
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        } else {
            _registerFscContext( currentAppliedVRs, selectedModelObjects, _isVCVOpenedFromConfigurator, newFscState.guidedMode );

            _updateFscAtomicData( fscState, newFscState, variantRuleData, newVariantRuleData );
            // if Variant Rule is already present and applied, synchronize the current VR
            exports.synchronizeAppliedVRs( fscState, variantRuleData );
            if( _isVCVOpenedFromConfigurator ) {
                exports.initializeEditHandler( fscState, variantRuleData );
            }
        }
    } else {
        // case 1: when variant configuration is reset, register new fscContext
        // case 2: when there is no Variant Rule applied, register new fscContext
        // case 3: when opened from the configurator for modules tab, reuse the config perspective

        // Send empty perspective if no VR selected in PWA in Variants Tab
        if( _isVCVOpenedFromConfigurator ) {
            newConfigPerspective = {};
        }
        //the default is to show Configuration Modules panel
        _registerFscContext( undefined, selectedModelObjects, _isVCVOpenedFromConfigurator, newFscState.guidedMode, newConfigPerspective );
    }

    _updateFscAtomicData( fscState, newFscState );

    // All event subscriptions, un-subscriptions are handled in the below API
    _manageEventSubscriptionForFsc( fscState, variantRuleData );

    // Synch VCV for
    // 1. occMgmt case
    // 2. VCV in variants tab when no VR selected in PWA
    // 3. Hosted case
    _synchronizeVariantForFsc( subPanelContext, newFscState, newVariantRuleData, variantRuleData, _isVCVOpenedFromConfigurator, selectedVR, newConfigPerspective );

    // as we mount fsc content set the singleSVRViewMode if it exists on the subPanel context, it will be used to set the view mode
    if( subPanelContext && subPanelContext.singleSVRViewMode ) {
        let singleSVRViewModeValue = { ...subPanelContext.singleSVRViewMode.getValue() };
        singleSVRViewModeValue.isListView = true;
        subPanelContext.singleSVRViewMode.update( singleSVRViewModeValue );
    }

    _handleWindowResizeForFsc( fscState );
    const vcvLayoutSettings = pca0CommonUtils.vcvViewSettings();
    return { vcvLayoutSettings };
};

/**
 * Destroy Full Screen Configuration Page
 */
export let destroyFSCConfiguration = function() {
    // LCS-1016316: When VCV is opened from configurator, and no SVRs are applied, setting NONE._editing to false if it is true.
    // NONE._editing is being set to true by us when there is any dirty custom variant rule.
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    const inEditState = appCtxSvc.getCtx( 'NONE._editing' );
    const editModeShouldReset = _.get( fscContext, 'isVCVOpenedFromConfigurator', false ) && _.isEmpty( fscContext.currentAppliedVRs ) && inEditState;
    if( editModeShouldReset ) {
        appCtxSvc.updatePartialCtx( 'NONE._editing', false );
    }

    if( synchronizeAppliedVRsEvent ) {
        eventBus.unsubscribe( synchronizeAppliedVRsEvent );
    }
    if( subLocationContentSelectionChangeEvent ) {
        eventBus.unsubscribe( subLocationContentSelectionChangeEvent );
    }
    if( processPartialErrorEvent ) {
        eventBus.unsubscribe( processPartialErrorEvent );
    }
    window.removeEventListener( 'resize', handleFSCResize );
    appCtxSvc.unRegisterCtx( pca0Constants.FSC_CONTEXT );
    m_editHandler = undefined;
    m_saveHandler = undefined;
    //Close dialog if open
    popupService.hide();
};

/*
 * This method handles the change in Variant Rules from Configuration
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 */
export let synchronizeAppliedVRs = function( fscState, variantRuleData ) {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let selectedVariant = null;
    /**
     * List view is not applicable when multiple variants or single variants with split expressions are loaded in Grid view.
     * Needs to switch back in list view when no variants selected as we dont allow to synch VR in Grid View
     */
    var newFscState = { ...fscState.getAtomicData() };
    var newVariantRuleData = { ...variantRuleData.getAtomicData() };
    if( newFscState.treeDisplayMode ) {
        return;
    }
    if( fscContext.currentAppliedVRs && fscContext.currentAppliedVRs[ 0 ] ) {
        selectedVariant = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );
        if( selectedVariant ) {
            selectedVariant.cellHeader1 = selectedVariant.props.object_string.uiValue;
            selectedVariant.cellHeader2 = selectedVariant.props.object_string.uiValue;
        }
    }

    if( newVariantRuleData.configPerspective.uid === undefined ) {
        //This is the case when user is coming inside Variant configuration tab
        if( selectedVariant !== null ) {
            fscContext.initialVariantRule = selectedVariant;
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        }
        // 'Custom Configuration' is a pseudo object which has language specific dbValue and uiValue. Hence now comparing the uiValue.
        if( selectedVariant === null || selectedVariant.props.object_string.uiValue !== configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
            //This is the case when user switches to Variant Configuration tab from other tabs in Secondary view
            eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVR' );
        }
    } else if( selectedVariant === null || selectedVariant.props.object_string.uiValue !== configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
        //This is the case when Variant configuration tab is already opened and we want to synch the variant rule change.
        //We do not want to synch a 'Custom Configuration', this is the case when user clicks on 'Apply Configuration' command.

        //coming in via the header svr change we always load in manual mode and need to show a message if the current mode is guided
        //this is the same path after changing a loaded svr to the guided mode and hitting apply: in that case we should not pop the message
        //so check for the svr to be different from the applied one
        let isDifferentVariant = _.get( newVariantRuleData, 'variantRulesToLoad[0].uid' ) && selectedVariant !== null &&
            newVariantRuleData.variantRulesToLoad[ 0 ].uid !== selectedVariant.uid || newVariantRuleData.variantRulesToLoad.length === 0;
        if( newFscState.isManualConfiguration === false && isDifferentVariant && selectedVariant !== null ) {
            //driving the showing of the message box by a preference, if existing and set the message would be skip in order to avoid annoying power users
            let pref = appCtxSvc.getCtx( 'preferences' );
            let prefMode = pref.PCA_VCV_show_info_switch_to_manual_mode ? pref.PCA_VCV_show_info_switch_to_manual_mode[ 0 ] : 'true';
            if( prefMode === 'true' ) {
                configuratorUtils.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().LoadingSVRInManualMode, 'INFO' );
            }
        }
        fscContext.vrSyncPerformed = true;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVR' );
    } else {
        //This is the case when user is inside the Variant Configuration tab and clicks on 'Apply Configuration' command
        //Do nothing
    }
};

/**
 * Processes the current variant rule change from occ management or any other place that changes it
 * @param {Array} newSVRUid array Containing SVRUids
 */
export let processCurrentVariantRuleChange = function( newSVRUid ) {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( newSVRUid && fscContext && ( !fscContext?.currentAppliedVRs || !_.isEqual( fscContext?.currentAppliedVRs, newSVRUid ) ) ) {
        fscContext.currentAppliedVRs = newSVRUid;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );

        // handle fscContext.currentAppliedVRs change
        eventBus.publish( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs' );
    }
};

/**
 * The method will pop up the switch Configuration Mode Confirmation to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 * @param {Object} vcvReloadEventData info data container for VCV Reload event
 */
export let wipConfirmHandleSVRChange = function( vcvReloadEventData ) {
    var msg = configuratorUtils.getFscLocaleTextBundle().syncSVRChangeConfirmation;
    var cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    var proceedString = configuratorUtils.getFscLocaleTextBundle().reload;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            if( !_.isUndefined( vcvReloadEventData ) ) {
                eventBus.publish( 'Pca0FullScreenConfiguration.reloadConfirmed', vcvReloadEventData );
            } else {
                eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVRConfirmed' );
            }
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Call initialization method to process "computeNextIncompleteFamily" SOA response
 * @param {Object} soaResponse the SOA response for "computeNextIncompleteFamily" VCV2 call
 * @returns {Object} incomplete families information
 */
export let initIncompleteFamiliesInfo = function( soaResponse ) {
    return Pca0IncompleteFamiliesService.initIncompleteFamiliesInfo( soaResponse );
};

/**
 * Switch to Grid view
 * @param {Boolean} reset - option to reset
 * @param {Object} commandContext containing the fscState atomic data
 */
export let showGridView = function( reset, commandContext ) {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );

    if( !commandContext || !commandContext.fscState || !commandContext.fscState.getAtomicData && !commandContext.fscState.value ) {
        return;
    }
    let fscState = commandContext.fscState;
    //since it may come either from fsc directly or via command, take care of both cases
    var newFscState = fscState.value ? { ...fscState.value } : { ...fscState.getAtomicData() };

    // Do not proceed if Grid mode is active already
    if( newFscState && newFscState.treeDisplayMode ) {
        return;
    }

    let configContext = appCtxSvc.getCtx( 'configuratorContext' );

    if( !configContext ) {
        configContext = {
            vcvVariabilityDisplayModeInGrid: pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxSvc.registerCtx( 'configuratorContext', configContext );
    }

    if( reset ) {
        newFscState.variantRuleDirty = false;
        delete fscContext.payloadStrings;
        delete fscContext.selectedExpressions;
    }

    if( newFscState.variantRuleDirty ) {
        // Show confirmation dialog
        eventBus.publish( 'Pca0FullScreenConfiguration.confirmSwitchingToTreeMode', {} );
    } else {
        // No user edits, switch to tree mode
        newFscState.treeDisplayMode = true;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }
    fscState.update ? fscState.update( newFscState ) : fscState.setAtomicData( newFscState );
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Reset AtomicData to initial values, reload VCV with initial Variant Rule (if any)
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @param {Object} vcvReloadingEventData - the vcvReload event Info container
 */
export let resetContextAndAtomicData = ( fscState, variantRuleData, vcvReloadingEventData ) => {
    // Update Context
    _.set( appCtxSvc, 'ctx.fscContext.appliedSettings', undefined ); // this will enforce fetching of perspective and other settings
    _.set( appCtxSvc, 'ctx.fscContext.currentScope', undefined ); // this will enforce selection of first scope
    _.set( appCtxSvc, 'ctx.fscContext.selectedModelObjects', vcvReloadingEventData.selectedModelObjects ); // this is needed to process selectedContext for SOA calls
    _.set( appCtxSvc, 'ctx.fscContext.currentAppliedVRs', vcvReloadingEventData.currentAppliedVRs ); // this is needed to load the right Configuration
    _.set( appCtxSvc, 'ctx.fscContext.expressionExpandedState', false ); // this is needed to know if the expression in FSC is in expanded clean state or not.

    let newFscState = { ...fscState.getAtomicData() };
    let newVariantRuleData = { ...variantRuleData.getAtomicData() };

    // Reset fscState:
    newFscState = {
        completenessStatus: '',
        isCompletenessStatusChipEnabled: true,
        violationSeverity: '',
        isSwitchingFromGridToListView: false,
        variantRuleDirty: false,
        guidedMode: true,
        isManualConfiguration: false,
        isHorizontalLayout: true,
        treeDisplayMode: false,
        isGridDirty: false,
        isValidationInProgress: false,
        savedVariant: false,
        unloadedVariant: false
    };

    // Reset variantRuleData
    newVariantRuleData = {
        isExpressionNonGridable: false,
        initialVariantRule: {},
        variantRulesToLoad: [],
        configPerspective: {},
        defaultConfigPerspective: {},
        useDefaultConfigPerspective: true
    };

    // Dispatch updates
    fscState.setAtomicData( newFscState );
    variantRuleData.setAtomicData( newVariantRuleData );
};

/**
 * This function returns the object containing the module selection details.
 * @param {Object} selectedObject - selected module object
 * @returns {Object} module selection details including configurationModuleHierarchy representing the module id
 *  and isModuleConfiguredOut flag
 */
export let getModuleSelectionDetails = ( selectedObject ) => {
    let alternateID = selectedObject?.alternateID;
    let isModuleConfiguredOut = selectedObject?.configuredOut === true;
    let configurationModuleHierarchy =  _getReversedModuleId( alternateID );
    //save it on the fsc context for future use
    appCtxSvc.updatePartialCtx( pca0Constants.FSC_CONTEXT + '.configurationModuleHierarchy', configurationModuleHierarchy );
    return {
        configurationModuleHierarchy:configurationModuleHierarchy,
        isModuleConfiguredOut: isModuleConfiguredOut
    };
};

/**
 * Updates the ConfigurationModulesPanel visibility based on the depth
 * @param {String} contextKey, the fscContext
 * @returns {Boolean} true or false depending if the configuration module panel needs to display or not
 */
export let updateConfigurationModulesPanelVisibility = ( contextKey ) => {
    const fscContext = appCtxSvc.getCtx( contextKey );
    const depth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues[0]' );
    let showPanel = true;
    if( !depth || depth === '1' ) {
        showPanel = false;
    }
    return showPanel;
};

/**
 * Sets the NextExecutedFlag used to flag the first time we execute a next soa call on a root node to fire an expand
 * returning false for everytime after and resetting when reset is true
 * @param {Object} response, the soa response, gets passed into the function by default
 * @param {String} currentValue, the current flag state
 * @param {Boolean} reset, the flag to reset the state, called when the config module changes
 * @returns {Boolean} true or false
 */
export let setNextExecutedFlag = ( response, currentValue, reset ) => {
    if( reset ) {
        return 0;
    }
    if( currentValue === 0 ) {
        return 1;
    }
    return 2;
};

/**
 * returns the flag if to call for the getPopulateConfigurationForProductHierarchy or not depending on a set of conditions
 * (needed because evaluating this every time, it would be a performance drag)
 * @param {String} firstGetNextExecuted, the current firstGetNextExecuted flag state
 * @returns {Boolean} true or false
 */
export let getPopulateConfigurationForProductHierarchyFlag = ( firstGetNextExecuted ) => {
    let ret = 'false';
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    const depth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues[0]' );
    const firstGetNextCall = firstGetNextExecuted === undefined || firstGetNextExecuted === 0;
    //regardless if on root or not, it is just the first call after the user selection
    if( firstGetNextCall && depth && depth !== '1' ) {
        ret = 'true';
    }
    return ret;
};

/**
 * This function returns whether the soa response has modules or not
 * @param {Object} soaResponse, the soa response, gets passed into the function by default
 * @returns {Boolean} true if SOA response contains modules
 */
export let checkRootModuleHasChildren = ( soaResponse ) => {
    let moduleType = _.find( soaResponse.modelObjects, { type: 'Cfg0ConfigurationModule' } );
    return !_.isUndefined( moduleType );
};

/**
 * This function returns the current selection for the computeNextIncompleteFamily soa call based on the active family
 * @returns {String} "" or the active family uid
 */
export let getCurrentSelection = () => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( _.isNil( fscContext.activeFamilyUID ) ) {
        return '';
    }
    return fscContext.activeFamilyUID;
};

/**
 * This API updates the data with Active Profile Settings and Filter Criteria for a specific svr
 * @param {Object} response - The response received by SOA service,
 * @param {Object} fetchedActiveSettings - The fetchedActiveSettings map
 * @param {String} currentSVRUid - The currentSVRUid
 * @returns {Object} - Returns information on Applied Settings for the context
 */
export let updateFetchedActiveSettingsForMultipleSVRs = ( response, fetchedActiveSettings, currentSVRUid ) => {
    if( response && response.responseInfo ) {
        let svrUid = currentSVRUid;
        if( !currentSVRUid ) {
            svrUid = 'default';
        }
        fetchedActiveSettings[ svrUid ] = {};
        fetchedActiveSettings[ svrUid ].configPerspective = response.configPerspective;
        let configSettings = JSON.parse( response.responseInfo.configSettings[ 0 ] );
        fetchedActiveSettings[ svrUid ].configSettings = configSettings;
        var appliedSettings = {};

        // Active Validation Mode
        var activeValidationProfile = JSON.parse( response.responseInfo.activeSolverProfileSettings[ 0 ] );
        // Localize for OOTB Overlay/Order and for Custom profiles
        configuratorUtils.localizeValidationProfileNames( activeValidationProfile );
        if( response.responseInfo.ruleDateTranslationMode && response.responseInfo.ruleDateTranslationMode[ 0 ] ) {
            // Set Rule Date Translation Mode
            appliedSettings.ruleDateTranslationMode = response.responseInfo.ruleDateTranslationMode[ 0 ];
        }
        appliedSettings.validationProfile = activeValidationProfile;
        appliedSettings.validationProfileAsString = response.responseInfo.activeSolverProfileSettings[ 0 ];
        fetchedActiveSettings[ svrUid ].appliedSettings = appliedSettings;
    }
    return fetchedActiveSettings;
};

/**
 * We get to know if the expression was expanded by user and no dirtyness after expand has been performed.
 * i.e. user has not loaded some other SVR, not unloaded the SVR, has not made any selection of Feature/ Family,
 * has not made any profile change in settings panel, has not clear selections, etc. after hitting the expand action, then
 * this function will return false, else true.
 * @returns {String} - 'true' if user has expanded the expression else 'false'
 */
export const getExpressionExpandedState = () => {
    return pca0CommonUtils.getExpressionExpandedState();
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForVCV = () => {
    return pca0CommonUtils.getPropertyPolicy( 'variantConfigurationView' );
};

/**
 * Toggles the selection summary state.
 * This function is called whenever selection summary is opened or closed.
 *
 * @param {boolean} isSelectionSummaryOpened - Indicates whether the selection summary is currently opened.
 * @param {boolean} isSelectionSummaryOpenedFromChip - Indicates whether the selection summary is opened from a chip.
 * @returns {boolean} - Returns false if the selection summary was opened and is now closed, otherwise returns true.
 */
export let toggleSelectionSummary = ( isSelectionSummaryOpened, isSelectionSummaryOpenedFromChip ) => {
    if( isSelectionSummaryOpened ) {
        return { isSelectionSummaryOpened: false, isSelectionSummaryOpenedFromChip: false };
    }

    return { isSelectionSummaryOpened: true, isSelectionSummaryOpenedFromChip: isSelectionSummaryOpenedFromChip };
};

/**
 * Updates the staleness flag for the selection summary.
 *
 * @param {boolean} isStale - The staleness flag indicating whether the selection summary is stale.
 * @returns {boolean} returns false always for guided mode as we are always in Sync, when in manual mode returns false if the configuration is expanded 
 * else returns true if any selection change is done .
 */
export let updateStalenessFlagForSelectionSummary = ( isStale ) => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( fscContext.guidedMode ) {
        return false;
    }
    return isStale;
};

/**
 * Get current Configuration mode
 * @param {String} ctx name of current context
 * @returns {String} current variant mode Guided/Manual
 */
export let getConfigurationMode = ( ctx ) =>  {
    return configuratorUtils.getConfigurationMode( ctx );
};

/**
 * Retrieves a ViewModelObject for newly created variant rule.
 *
 * @param {Object} response - The response object containing service data.
 * @param {Object} response.ServiceData - The SOA response.
 * @returns {Object|undefined} The created ViewModelObject, or undefined if not available.
 */
export let getVariantRuleVMO = ( response ) => {
    if( !_.isUndefined( _.get( response, 'ServiceData.created' ) ) ) {
        return viewModelObjectService.createViewModelObject( response.ServiceData.created[ 0 ] );
    }
    return undefined;
};

/**
 * Retrieves the persistent UID from the response object.
 *
 * @param {Object} response - The response object containing ServiceData.
 * @returns {string|undefined} The persistent UID if found, otherwise undefined.
 */
export let getSVRPersistentUid = ( response ) => {
    const svrTransientUid = _.get( response, [ 'ServiceData', 'created', 0 ] );
    return _.get( response, [ 'ServiceData', 'modelObjects', svrTransientUid, 'props', 'fnd0objectId', 'dbValues', 0 ] );
};

/**
 * Retrieves the active variant rule for a given setting expression based on the event data and provided variant rule.
 *
 * @param {Object} eventData - The event data containing information about the action type.
 * @param {Object} variantRule - The variant rule to be used when creating a new rule.
 * @returns {Object[]} An array containing the active variant rule. If the action type is 'create', returns an array with the provided variant rule.
 *                     Otherwise, returns an array with the initial variant rule from the FSC context if available, or an empty array.
 */
export let getActiveVariantRuleForSettingExpression = ( eventData, variantRule ) => {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );

    if( _.get( eventData, 'actionType' ) === 'create' ) { return [ variantRule ]; }
    return fscContext.initialVariantRule ? [ fscContext.initialVariantRule ] : [];
};

export default exports = {
    initializeEditHandler,
    toggleShowSummaryPanel,
    getSelectionForVariantContext,
    getActiveVariantRules,
    getProfileSettingsForFsc,
    initSettings,
    handleFSCConfiguration,
    fscActivateCommandPanel,
    fscActivateSaveAsCommandPanel,
    initFSCConfiguration,
    destroyFSCConfiguration,
    synchronizeAppliedVRs,
    processCurrentVariantRuleChange,
    wipConfirmHandleSVRChange,
    isVCVOpenedFromConfigurator,
    initIncompleteFamiliesInfo,
    updateEditHandlerToTableContext,
    updateEditHandlerToFscContext,
    getSaveHandler,
    saveVariantExpressions,
    showGridView,
    getConfigPerspective,
    convertSelectedExpressionJsonObjectToString,
    resetContextAndAtomicData,
    getModuleSelectionDetails,
    updateConfigurationModulesPanelVisibility,
    setNextExecutedFlag,
    getPopulateConfigurationForProductHierarchyFlag,
    checkRootModuleHasChildren,
    getCurrentSelection,
    updateFetchedActiveSettingsForMultipleSVRs,
    getExpressionExpandedState,
    getPropertyPolicyForVCV,
    toggleSelectionSummary,
    updateStalenessFlagForSelectionSummary,
    getConfigurationMode,
    getVariantRuleVMO,
    getSVRPersistentUid,
    getActiveVariantRuleForSettingExpression
};
