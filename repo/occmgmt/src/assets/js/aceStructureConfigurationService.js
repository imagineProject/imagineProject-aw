// Copyright (c) 2022 Siemens

/**
 * @module js/aceStructureConfigurationService
 */
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import appCtxSvc from 'js/appCtxService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * The configurationContext object holds various configuration-related data in detailed.
 * It includes information about revision rule, variant rule, effectivity, and partition scheme.
 */
export let configurationContext = {
    /**
     * An object representing the revision rule configuration.
     * This object is expected to be populated with properties related to the revision rule.
     * @type {Object}
     */
    revisionRuleObject: {},

    /**
     * An object representing the variant rule configuration.
     * This object is expected to be populated with properties related to the variant rule.
     * @type {Object}
     */
    variantRuleObject: {},

    /**
     * An object containing effectivity information.
     * @type {Object}
     * @property {string} endItemUid - A string representing the end item UID for effectivity.
     * @property {string} endDate - A string representing the end date for effectivity.
     * @property {string} dateEffectivity - A string representing the date effectivity.
     * @property {string} unitEffectivity - A string representing the unit effectivity.
     */
    effectivityInfo: {
        endItemUid: '',
        endDate: '',
        dateEffectivity: '',
        unitEffectivity: ''
    },

    /**
     * An object representing the partition scheme configuration.
     * This object is expected to be populated with properties related to the partition scheme.
     * @type {Object}
     */
    partitionSchemeObject: {}
};

export let updatedbValue = function( input ) {
    return input === true || input === 'true';
};
export let updateConfiguration = function( occContext ) {
    if( occContext && occContext.configContext && !occContext.skipReloadOnConfigParamChange && !_.isEmpty( occContext.configContext ) ) {
        eventBus.publish( 'configurationChangeStarted' );
        if( !_.isUndefined( occContext.currentState ) && !aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid ) ) {
            aceRestoreBWCStateService.processProductInteraction( occContext ).then( function( ) {
                ///control will come here when resetUserWorkingContextState is complete
                aceUpdatePwaDisplayService.resetPwaContents( { viewToReset: occContext.viewKey }, occContext );
            } );
        } else{
            aceUpdatePwaDisplayService.resetPwaContents( { viewToReset: occContext.viewKey }, occContext );
        }
    }
};

export let resetTreeOnConfigChange = function( configChangeVal, occContext ) {
    if( configChangeVal && !occContext.skipReloadOnConfigParamChange ) {
        eventBus.publish( 'configurationChangeStarted' );
        if( !_.isUndefined( occContext.currentState ) && !aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid ) ) {
            aceRestoreBWCStateService.processProductInteraction( occContext ).then( function( ) {
                ///control will come here when resetUserWorkingContextState is complete
                occmgmtUtils.resetTreeDisplayWithProvidedInput( '', configChangeVal, occContext );
            } );
        } else{
            occmgmtUtils.resetTreeDisplayWithProvidedInput( '', configChangeVal, occContext );
        }
    }else{
        occmgmtUtils.updateValueOnCtxOrState( '', configChangeVal, occContext );
    }
};

/**
  * Populate the contextKeyObject on data object from viewModel.
  *
  * @param {Object} data - The 'data' object from viewModel
  * @returns {Object} The 'data' object from viewModel
  */
export let populateContextKey = function( data ) {
    if( data.subPanelContext ) {
        if( _.get( data, 'subPanelContext.configurationInPanel' ) ) {
            const contextKeyObject = appCtxSvc.getCtx( 'aceActiveContext.context' );
            const contextKey = 'aceActiveContext.context';
            const viewKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
            return { contextKeyObject, contextKey, viewKey };
        } else if( _.get( data, 'subPanelContext.provider.contextKey' ) ) {
            const contextKeyObject = appCtxSvc.getCtx( data.subPanelContext.provider.contextKey );
            const contextKey = data.subPanelContext.provider.contextKey;
            const viewKey = data.subPanelContext.provider.contextKey;
            return { contextKeyObject, contextKey, viewKey };
        }
    }
    const contextKeyObject = appCtxSvc.getCtx( 'aceActiveContext.context' );
    const contextKey = 'aceActiveContext.context';
    const viewKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    return { contextKeyObject, contextKey, viewKey };
};

/**
  * Get the data object from viewModel.
  *
  * @param {Object} data - The 'data' object from viewModel
  * @returns {Object} The 'data' object from viewModel
  */
export let getViewModelData = function( data ) {
    return data;
};

/**
  * Get the correct provider name.
  *
  * @param {Object} providerName - The input 'provider name'
  * @returns {Object} The 'provider name' with correct prefix
  */
export let getProviderName = function( providerName ) {
    var prefix = 'Fnd0';
    return prefix + providerName;
};

/* Function to change the configuration on a product.
*
* @published
* @param {Object} subPanelContext - Current UI page/sublocation information passed down from parent component.
* @param {Object} configurationContext - Object containing the configuration information.
* It includes information about revision rules, variant rules, effectivity, and partition schemes.
*
* Properties:
* @property {Object} revisionRuleObject - An object representing the revision rule configuration.
*
* @property {Object} variantRuleObject - An object representing the variant rule configuration.
*
* @property {Object} effectivityInfo - An object containing effectivity information.
* @property {string} effectivityInfo.dateEffectivity - A string representing the date effectivity.
* @property {string} effectivityInfo.unitEffectivity - A string representing the unit effectivity.
* @property {string} effectivityInfo.endItemUid - A string representing the end item UID.
*
* @property {Object} partitionSchemeObject - An object representing the partition scheme configuration.
*
*/
export let applyConfiguration = function( subPanelContext, configurationContext ) {
    // Initialize the value object with a configurationContext property.
    let value = {
        configContext: {}
    };
    if( !subPanelContext.occContext ) {
        throw 'Required atomic data is not defined.';
    }
    // Set the revision rule UID if provided.
    if( configurationContext.revisionRuleObject && configurationContext.revisionRuleObject.uid ) {
        value.configContext.r_uid = configurationContext.revisionRuleObject.uid;
    }
    // Set the variant rule UID if provided
    if( configurationContext.variantRuleObject && configurationContext.variantRuleObject.uid ) {
        value.configContext.var_uids = [ configurationContext.variantRuleObject.uid ];
    }
    // Set the end item UID if provided.
    if( configurationContext.effectivityInfo && configurationContext.effectivityInfo.endItemUid && configurationContext.effectivityInfo.endItemUid !== '' ) {
        value.configContext.ei_uid = configurationContext.effectivityInfo.endItemUid;
    }
    // Set the unit effectivity if provided.
    if( configurationContext.effectivityInfo && configurationContext.effectivityInfo.unitEffectivity && configurationContext.effectivityInfo.unitEffectivity !== '' ) {
        value.configContext.ue = configurationContext.effectivityInfo.unitEffectivity;
    }
    // Set the date effectivity if provided.
    if( configurationContext.effectivityInfo && configurationContext.effectivityInfo.dateEffectivity && configurationContext.effectivityInfo.dateEffectivity !== '' ) {
        value.configContext.de = configurationContext.effectivityInfo.dateEffectivity;
    }
    // Set the partition scheme if provided.
    if( configurationContext.partitionSchemeObject && configurationContext.partitionSchemeObject.uid ) {
        value.configContext.org_uid = configurationContext.partitionSchemeObject.uid;
    }
    occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
};

export default exports = {
    populateContextKey,
    getViewModelData,
    updateConfiguration,
    resetTreeOnConfigChange,
    getProviderName,
    updatedbValue,
    configurationContext,
    applyConfiguration
};
