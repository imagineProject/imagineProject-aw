// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ContextManagementService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * This function sets the properties on newly created perspective of new tab with the persistent rev rule & effectivity of last opened PI of original tab and
 * sync the session storage
 * @param {Object} configCtxPerspectiveMap - Config Context Map
 * @param {String} configuratorContextUID - Configurator Context UID
 * @param {String} lastOpenedProductItem - Last Opened Product Item
 */
let _setPropertiesUsingExistingSettings = async( configCtxPerspectiveMap, configuratorContextUID, lastOpenedProductItem ) => {
    let configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let persistentRevRuleMap = pca0CommonUtils.getPersistentRevRuleMapFromSessionStorage();

    // Check if old perspective settings (persistent revisionRule & Effectivity) are available in session storage assosiated with this context
    // Case Refresh, Duplicate, Open in new tab
    if( persistentRevRuleMap.hasOwnProperty( lastOpenedProductItem ) ) {
        // set properties on new perspective

        // Revision Rule on Perspective is transient property, if we call set properties soa call using this, then for 2 different
        // perspective there will be only 1 revision rule, updating it for 1 perspective will update it for other perspective  as well
        // which is not the required behavior.
        // Thus we need to set this using persistent object of revision rule.
        let effectivityToSet = _.isUndefined( persistentRevRuleMap[ lastOpenedProductItem ].effectivity ) ? undefined : persistentRevRuleMap[ lastOpenedProductItem ].effectivity;
        let revisionRuleToSet = _.isUndefined( persistentRevRuleMap[ lastOpenedProductItem ].revisionRule ) ? undefined : persistentRevRuleMap[ lastOpenedProductItem ].revisionRule;
        let response = await pca0CommonUtils.callSetPropertiesSOA( veConstants.CONFIG_CONTEXT_KEY, configContext, revisionRuleToSet, effectivityToSet, false );

        if( response ) {
            // Update the appliedSettings (i.e call initializeFilterCriteriaForContext) after setProperties call is done.
            const configPerspectiveData = response.ServiceData.modelObjects[configContext.configPerspective.uid];
            if ( configPerspectiveData && configPerspectiveData.props ) {
                // Initialize Effectivity Feature
                const revRuleData = configPerspectiveData.props.cfg0RevisionRule;
                // DB value of revision rule name which remain in english and necessary to fetch variants as SOA takes only revision rule name not UID
                // As its runtime object so server finds exact rule using name and gives data accordingly
                const revisionRuleDBName = _.get( response, 'ServiceData.modelObjects.' + revRuleData.dbValues[0] + '.props.object_name.dbValues.0' );
                configPerspectiveData.revisionRuleDBName = revisionRuleDBName;
                configuratorUtils.initializeFilterCriteriaForContext( configPerspectiveData, veConstants.CONFIG_CONTEXT_KEY );
            }

            // In case when 1st productItem is opened for 1st in tab, in that case we dont want to update the persistent object map so doing this in if condition
            // Clear the persistent object map from session storage
            // Update the Map with the applied persistent revision rule for the opened product item
            persistentRevRuleMap[ configuratorContextUID ] = {
                revisionRule: revisionRuleToSet,
                effectivity: effectivityToSet
            };
            sessionStorage.setItem( 'Pca0ConfigCtxPersistentRevRuleMap', JSON.stringify( persistentRevRuleMap ) );
        }
    } else {
        // 1st productItem opened for 1st time in tab
    }

    // Get the updated config context, in initializeFilterCriteriaForContext function call, we update appliedSettings in configContext.
    // in else case (i.e. 1st productItem opened for 1st time in tab) nothing is updated in configContext so we will get same context here
    configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    // Clear the old perspective from session storage for all context
    // Supppose from tab1 context1 if we open constraints/variants belonging to context2 in tab2 and if we dont delete old perspective from session storage,
    // and when we try to open any constraints/variants belonging to context1 in tab3 from tab2, in that case perspective of tab1 will be used in tab3 as session storage
    // of tab2 contains perspective mapped for context1 from tab1 which is wrong.Thus clear all old perspective from session storage for all contexts.
    sessionStorage.removeItem( veConstants.CONFIG_CONTEXT_PERSPECTIVE_MAP );
    configCtxPerspectiveMap = {};

    // one use case in which we dont want to empty session storage is below, If in future we get some better approch to handle this, then we will keep session storage
    // If we open PI1 in tab1 and then open PI2 in same tab and do refresh, in that case PI1 setting will get removed from session storage

    // Set the new perspective in session storage so that when we open a PI for 2nd time in same tab, we can reuse the perspective
    _updateConfigCtxMapWithNewPerspective( configCtxPerspectiveMap, configuratorContextUID );

    // Update last opened product item in session storage
    lastOpenedProductItem = configuratorContextUID;
    sessionStorage.setItem( 'Pca0LastOpenedProductItem', lastOpenedProductItem );

    // Fire events to reload variant expression data and update link
    let eventData = {
        appliedRevisionRule: _.get( configContext, 'appliedSettings.configSettings.props.pca0RevisionRule' ),
        contextKey: veConstants.CONFIG_CONTEXT_KEY
    };
    eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', eventData ); // This event is for updating the revision rule in UI
    eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' ); // This event is for update the effectivity in UI
};

/**
 * This function updates the config map with the new perspective
 * @param {Object} configCtxPerspectiveMap - Config Context Map
 * @param {String} configuratorContextUID - Configurator Context UID
 */
let _updateConfigCtxMapWithNewPerspective = ( configCtxPerspectiveMap, configuratorContextUID ) => {
    let configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    // Update the Map with the new perspective
    configCtxPerspectiveMap[ configuratorContextUID ] = {
        configPerspective: configContext.configPerspective,
        appliedSettings: configContext.appliedSettings,
        effectivityFeature: configContext.effectivityFeature,
        isContextPositiveBiased: configContext.isContextPositiveBiased,
        openedObjectType: configContext.openedObjectType

    };
    sessionStorage.setItem( veConstants.CONFIG_CONTEXT_PERSPECTIVE_MAP, JSON.stringify( configCtxPerspectiveMap ) );
};

/**
 * Register the Configurator Context with the application context.
 * Fetch configuration information from Session Storage if available.
 * Trigger getProperties SOA call if needed.
 * Whenever the header is initialized, this function is called.
 */
export let registerConfiguratorCtx = function() {
    let configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let usedProductItems = appCtxSvc.getCtx( 'Cfg0OpenedProductItems' );
    let getPropsSOACallNeeded = true;
    let configuratorContextUID = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();

    if( !configContext || _.isEmpty( configContext ) ) {
        configContext = {};

        // If ConfiguratorCtx and Cfg0OpenedProductItems both are empty this means either the page is refreshed, duplicated, opened in new tab or opened 1st productItem 1st time in tab
        // We need to create a new perspective and set Properties on it.
        // In case of 1st productItem opened for 1st time in tab, we dont have to use perspective of last opened product item, this is handled further in code
        if( !usedProductItems || _.isEmpty( usedProductItems ) ) {
            configContext.shouldUsePerspectiveOfLastOpenedProductItem = true;

            // Update Cfg0OpenedProductItems with the current context
            usedProductItems = [];
            usedProductItems.push( configuratorContextUID );
            appCtxSvc.registerCtx( 'Cfg0OpenedProductItems', usedProductItems );
        } else {
            // If ConfiguratorCtx is empty but Cfg0OpenedProductItems is not empty, this means we are opening another product item in the same tab or
            // reopening the same PI.
            // Here we dont want to use the perspective of last opened product item
            configContext.shouldUsePerspectiveOfLastOpenedProductItem = false;

            const configCtxPerspectiveMap = pca0ConfiguratorExplorerCommonUtils.getConfigCtxPerspectiveMapFromSessionStorage();

            // If ProdctItem is already opened once, use the same stored perspective from configCtxPerspectiveMap
            // Here we cant use openedProductItems to check if ProductItem was opened once because in case of refresh, openedProductItems will be empty
            // Also, here we cant use persistentRevRuleMap to check if ProductItem was opened once because we never clear persistentRevRuleMap from session storage and It is carried
            // from old tab to new one, if we use it here to check if ProductItem was opened once, below case will break :
            // In 1st if I have opened PI1 & PI2 and I have those in persistentRevRuleMap, now when I open PI1 using where used in tab2, Now in tab2 I open PI2, in that case expected behaviour
            // is that PI2 should be opened will default settings, but we have its entry in persistentRevRuleMap, so old tab's setting will be used, which is wrong.
            // So use configCtxPerspectiveMap to check if ProductItem was opened once
            if(  configCtxPerspectiveMap.hasOwnProperty( configuratorContextUID ) ) {
                configContext.configPerspective = configCtxPerspectiveMap[ configuratorContextUID ].configPerspective;
                configContext.appliedSettings = configCtxPerspectiveMap[ configuratorContextUID ].appliedSettings;
                configContext.effectivityFeature = configCtxPerspectiveMap[ configuratorContextUID ].effectivityFeature;
                configContext.isContextPositiveBiased = configCtxPerspectiveMap[ configuratorContextUID ].isContextPositiveBiased;
                configContext.openedObjectType = configCtxPerspectiveMap[ configuratorContextUID ].openedObjectType;
                getPropsSOACallNeeded = false;

                // Save last opened product item in session storage
                sessionStorage.setItem( 'Pca0LastOpenedProductItem', configuratorContextUID  );
            } else {
                // We are opening a new product item in the same tab
                // Make flag true so that getProperties soa will be called which will create new perspective with default setting for the newly opened product item in same tab
                getPropsSOACallNeeded = true;
            }
            // Update Cfg0OpenedProductItems with the current context
            usedProductItems.push( configuratorContextUID );
            appCtxSvc.updateCtx( 'Cfg0OpenedProductItems', usedProductItems );
        }
        appCtxSvc.registerCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );
        let eventName = getPropsSOACallNeeded ?
            'pca0VariabilityExplorerHeaderService.getRequiredProperties' :
            'pca0VariabilityExplorerHeaderService.initializeHeader';
        eventBus.publish( eventName );
    }
    // Else switching between the constraints/variants/Modules tab etc, do nothing
};

/**
 * Unregister the configurator context from the application context:
 * - If selected tab is not Model/Features/Variants/Constraints
 * - If navigating back to parent context from child context
 */
export let unregisterConfiguratorCtx = function() {
    const state = appCtxSvc.getCtx( 'state' );
    const configCtx = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    if( state.params.pageId !== 'tc_xrt_Models' &&
        state.params.pageId !== 'tc_xrt_Features' &&
        state.params.pageId !== 'tc_xrt_Variants' &&
        state.params.pageId !== 'tc_xrt_Modules' &&
        state.params.pageId !== 'tc_xrt_Constraints' ||
        _.get( configCtx, 'configPerspective.props.cfg0ProductItems.dbValues[0]' ) !== state.processed.uid ) {
        appCtxSvc.updatePartialCtx( 'clientScopeURI', '' );
        appCtxSvc.unRegisterCtx( veConstants.CONFIG_CONTEXT_KEY );
    }
};

/**
 * Save Configurator Context Header information on SessionStorage
 */
export let syncSessionStorage = () => {
    let configCtxPerspectiveMap = pca0ConfiguratorExplorerCommonUtils.getConfigCtxPerspectiveMapFromSessionStorage();
    let configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    let configuratorContextUID = _.get( configContext, 'configPerspective.props.cfg0ProductItems.dbValues[0]' );
    configCtxPerspectiveMap[ configuratorContextUID ] = {
        configPerspective: configContext.configPerspective,
        appliedSettings: configContext.appliedSettings,
        effectivityFeature: configContext.effectivityFeature,
        isContextPositiveBiased: configContext.isContextPositiveBiased,
        openedObjectType: configContext.openedObjectType
    };
    sessionStorage.setItem( veConstants.CONFIG_CONTEXT_PERSPECTIVE_MAP, JSON.stringify( configCtxPerspectiveMap ) );
};

/**
 * Save Configurator Context Export information
 * @param {Object} commandContext Command Context
 */
export let registerConfiguratorCtxForExportOptions = ( commandContext ) => {
    const pageId = _.get( commandContext, 'showObjectContext.activeTab.id' );
    let configPerspective = _.get( commandContext, 'headerData.cfg0ConfigPerspective.value' );
    // If configPerspective is not available in commandContext, then fetch it from configuratorCtx
    // LCS-1166562 - Export to Excel panel not getting opened after opening Export to Excel report
    if( !configPerspective ) {
        const configuratorCtx = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        configPerspective = _.get( configuratorCtx, 'configPerspective.uid' );
    }

    const extraExportOptions = [
        {
            option: 'pageId',
            optionvalue: pageId
        },
        {
            option: 'configPerspective',
            optionvalue: configPerspective
        }
    ];
    appCtxSvc.registerCtx( 'extraExportOptions', extraExportOptions );
};

/**
 * This function sets the properties on newly created perspective of new tab with the properties of last perspective of original tab and sync the session storage
 * If 1st product item is opened for 1st time in tab, in that case we dont have to use perspective of last opened product item
 * If a tab is duplicated or opened in new tab, in that case we use the perspective of last opened product item
 * If a tab is refreshed in that case also we use the perspective of last opened product item
 * If a new product item(other than 1st) is opened for the first time in the same tab, then it just sync the session storage with the new perspective
 * Case 1 : 1st ProductItem opened for 1st time in tab
 * case 2 : Duplication of tab,open in new tab
 * Case 3 : Refreshing the current tab
 * case 4 : New productItem(other than 1st) opened for 1st time in same tab
 */
export let setPropertiesOnNewlyCreatedPerspective = async() => {
    let configCtxPerspectiveMap = pca0ConfiguratorExplorerCommonUtils.getConfigCtxPerspectiveMapFromSessionStorage();
    let configContext = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let configuratorContextUID = _.get( configContext, 'configPerspective.props.cfg0ProductItems.dbValues[0]' );
    let shouldUsePerspectiveOfLastOpenedProductItem = _.get( configContext, 'shouldUsePerspectiveOfLastOpenedProductItem' );
    let lastOpenedProductItem = sessionStorage.getItem( 'Pca0LastOpenedProductItem' );

    if( shouldUsePerspectiveOfLastOpenedProductItem ) {
        // Case 1 : 1st ProductItem opened for 1st time in tab
        // case 2 : Duplication of tab,open in new tab
        // Case 3 : Refreshing the current tab
        await _setPropertiesUsingExistingSettings( configCtxPerspectiveMap, configuratorContextUID, lastOpenedProductItem );
    } else {
        // Case 4 : New productItem opened for 1st time in same tab.
        _updateConfigCtxMapWithNewPerspective( configCtxPerspectiveMap, configuratorContextUID );

        // Update last opened product item in session storage
        lastOpenedProductItem = configuratorContextUID;
        sessionStorage.setItem( 'Pca0LastOpenedProductItem', lastOpenedProductItem );
    }
};

export default exports = {
    registerConfiguratorCtx,
    registerConfiguratorCtxForExportOptions,
    unregisterConfiguratorCtx,
    syncSessionStorage,
    setPropertiesOnNewlyCreatedPerspective
};
