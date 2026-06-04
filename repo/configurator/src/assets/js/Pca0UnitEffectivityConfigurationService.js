// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0UnitEffectivityConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import AwPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import Pca0SvrFilterCriteriaSettingsService from 'js/pca0SvrFilterCriteriaSettingsService';
import policySvc from 'soa/kernel/propertyPolicyService';
import popupService from 'js/popupService';
import _ from 'lodash';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';

/**
 * Processes the unit effectivity by incrementing the end value.
 *
 * @param {string} unitEffectivity - The unit effectivity string to process. It can be in the format "a..b", "..b", or "a..".
 * @returns {string} - The processed unit display string.
 *                     If the input is in the format "..b", it returns "..(b+1)".
 *                     If the input is in the format "a..", it returns the same string.
 *                     If the input is in the format "a..b", it returns "a..(b+1)".
 *                     If the Input containts UP or SO, it returns the same string.
 */
const _processUnitDisplayString = ( unitEffectivity ) => {
    if ( !unitEffectivity.includes( '..' )
        && !unitEffectivity.includes( ApsEffectivityValidationService.instance.UP_UNIT_VAL )
        && !unitEffectivity.includes( ApsEffectivityValidationService.instance.SO_UNIT_VAL ) ) {
        return unitEffectivity;
    }
    const parts = unitEffectivity.split( '..' );
    if ( parts.length !== 2 ) {
        return unitEffectivity;
    }

    const [ start, end ] = parts;
    if ( end === '' ) {
        // Case: a..
        // No action required
        return unitEffectivity;
    }
    if ( start === '' ) {
        // Case: ..b
        const endNumber = parseInt( end, 10 );
        return Number.isNaN( endNumber ) ? unitEffectivity : `..${endNumber + 1}`;
    }
    // Case: a..b
    const endNumber = parseInt( end, 10 );
    return Number.isNaN( endNumber ) ? unitEffectivity : `${start}..${endNumber + 1}`;
};

/**
 * VCA scenario only
 * Get effectivity formula suitable as input for setProperties SOA
 * Maintain in the formula existing value for Date, if effectivity feature is "All"
 * @param {String} contextKey : Name of relevant context.
 * @param {String} startUnit : Effectivity unit Value/Range - Start unit
 * @param {String} endUnit : Effectivity unit Value/Range - End unit
 * @returns {string} - The updated effectivity formula.
 */
const _getEffectivityFormula = ( contextKey, startUnit, endUnit ) => {
    let effectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForUnit( startUnit, endUnit );

    const context = appCtxSvc.getCtx( contextKey );
    if( context.effectivityFeature === 'All' ) {
        // Maintain Date effectivity
        const cachedEffectivity = { ...context.settingsCache.effectivityInfo };
        const startDate = cachedEffectivity.currentStartEffDates.dbValues[ 0 ];
        const endDate = cachedEffectivity.currentEndEffDates.dbValues[ 0 ];
        const dateEffectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForDate( startDate, endDate );
        if( dateEffectivityFormula !== '' ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }
            effectivityFormula += dateEffectivityFormula;
        }
    }
    return effectivityFormula;
};

/**
 * Initialize View Model properties
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 * @param {String} contextKey context key
 * @return {Object} Unit Effectivity VM property Info container
 */
const _initializeVMProps = ( data, contextKey ) => {
    // Get VM property for current Effectivity
    const currentEffectivity = Pca0FilterCriteriaSettingsService.getEffectivityDisplayInfo( contextKey ? contextKey : data.contextKey, 'UnitOnly' );

    // Set value to be displayed in the widget: this way, we allow the user to clear value of unit effectivity
    // We reverse-process string calculated in _apsCoreSvc.getDecoratedUnitEffectivityDisplayStr
    const apsLocalTextBundle = pca0CommonUtils.getLocaleTextBundle( 'ApsEffectivityMessages' );

    let widgetUnitRange = _.cloneDeep( data.widgetUnitRange );

    if ( currentEffectivity.dbValue !== apsLocalTextBundle.ALL_UNITS ) {
        let unitDisplayString = currentEffectivity.dbValue.replace( apsLocalTextBundle.UNIT_PREFIX, '' );

        // In case of In/Out mode ( When value of preference 'TC_Fnd0Booleansolve_EffectivityIntegerRangeFromTo' set to false )
        // When user clicks on the unit effectivity link, the end unit value should be incremented by 1 on the popup.
        if ( !ApsEffectivityValidationService.instance.isUnitEffectivityFromToMode() ) {
            unitDisplayString = _processUnitDisplayString( unitDisplayString );
        }
        widgetUnitRange.dbValue = unitDisplayString;
        // value property is used by AwTextBox component to update propValue onChange Handler.
        widgetUnitRange.value = unitDisplayString;
    }

    return { currentEffectivity, widgetUnitRange };
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Initialize the Unit Effectivity Configuration Section
 * Select value as from appliedSettings
 * Settings cache for selected Effectivity has been already initialized in Filter Criteria Service
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 * @param {Object} subPanelContext - subPanelContext
 * @return {Object} Unit Effectivity Info container
 */
export let initializeUnitEffectivityConfigurationData = function( data, subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isEffectivityReadOnly = {};
    let currentEffectivity = {};
    let widgetUnitRange = {};
    //when the subcomponents are used with a passed in parameter, feed from it, otherwise use the app context - fsc case
    //we should evtl. change this to always use the passed in props so it's reusable independently, then obsolete the app context path

    //The use case where subcomponents are used with a passed in parameter is when used in the svrFilterCriteria, in which the
    //alternate profile settings are based on passed in fetched settings (in order to be able to show SVR profile settings per SVR like in the MultiSvr grid)
    if( subPanelContext.svrSettings ) {
        let svrSettingsValue =  { ...subPanelContext.svrSettings.getValue() };
        let effectivityInfo = svrSettingsValue.settingsCache.effectivityInfo;
        currentEffectivity = Pca0SvrFilterCriteriaSettingsService.getEffectivityDisplayInfo( effectivityInfo, 'UnitOnly' );
        // Set value to be displayed in the widget: this way, we allow the user to clear value of unit effectivity
        // We reverse-process string calculated in _apsCoreSvc.getDecoratedUnitEffectivityDisplayStr
        let apsResource = 'ApsEffectivityMessages';
        let apsLocalTextBundle = localeSvc.getLoadedText( apsResource );
        widgetUnitRange = _.cloneDeep( data.widgetUnitRange );
        if( currentEffectivity.dbValue !== apsLocalTextBundle.ALL_UNITS ) {
            widgetUnitRange.dbValue = currentEffectivity.dbValue.replace( apsLocalTextBundle.UNIT_PREFIX, '' );
        }
        currentEffectivity.isEditable = !subPanelContext.isConfigurationReadOnly;
        isEffectivityReadOnly.dbValue = subPanelContext.isConfigurationReadOnly;
    } else {
        //app ctx based - the current usage out of Fsc
        isEffectivityReadOnly.dbValue = subPanelContext.isConfigurationReadOnly.dbValue;

        let context = appCtxSvc.getCtx( contextKey );
        if( subPanelContext.contextKey !== 'fscContext' && ( !context || _.isUndefined( context.appliedSettings ) ) ) {
            return;
        }

        ( { currentEffectivity, widgetUnitRange } = _initializeVMProps( data, contextKey ) );
        currentEffectivity.isEditable = !subPanelContext.isConfigurationReadOnly.dbValue;
    }

    return { contextKey, isEffectivityReadOnly, currentEffectivity, widgetUnitRange };
};

/**
 * non-VCV: trigger update in perspective
 * VCV: update the selection on the context cache
 * Update Effectivity unit/range on Perspective for other contexts
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 * @param {Object} subPanelContext - subPanelContext
 */
export let applyUnitEffectivity = async function( data, subPanelContext ) {
    let context = appCtxSvc.getCtx( data.contextKey );
    let needToClosePopup = false;

    // Do not proceed if validation Criteria are not satisfied
    // uncomment when ValidationCriteria will support functions (call checkValidUnitRangeEffectivity)
    // let invalidState = false;
    // let conditions = data.getConditionStates();
    // if( conditions.isNotInRegexp ) {
    //     invalidState = true;
    //     break;
    // }

    // Need to validate from apsCore because , as of now, numeric range validation cannot be performed through ValidationCriteria
    // Remove all spaces from the given string
    // Accept empty string as valid (no effectivity)
    let errorMsg = null;
    let unitEffValue = data.widgetUnitRange.dbValue;
    let apsResource = 'ApsEffectivityMessages';
    let apsLocalTextBundle = localeSvc.getLoadedText( apsResource );
    if( unitEffValue !== '' ) {
        unitEffValue = unitEffValue.replace( /\s+/g, '' );
        errorMsg = ApsEffectivityValidationService.instance.checkValidUnitRangeEffectivity( unitEffValue, apsLocalTextBundle );
    }

    if( errorMsg !== null ) {
        messagingService.showError( errorMsg );
        throw new Error( errorMsg );
    } else {
        let effectivityRange = ApsEffectivityValidationService.instance.getUnitRangesFromEffectivityString( data.widgetUnitRange.dbValue );
        let startEffStr = effectivityRange.startUnit;
        let endEffStr = effectivityRange.endUnit;

        if( subPanelContext.svrSettings ) {
            // Update cached value
            let svrSettings = subPanelContext.svrSettings;
            let svrSettingsValue = svrSettings.getValue();
            let settingsCache = { ...svrSettingsValue.settingsCache };
            if( endEffStr === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                endEffStr === ApsEffectivityValidationService.instance.UP_UNIT_VAL ) {
                let endUnitInt = parseInt( endEffStr );
                endUnitInt--;
                endEffStr = endUnitInt.toString();
            }
            settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = startEffStr;
            settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endEffStr;

            // If UnitOnly, delete any other content for Dates
            // Leave Date info otherwise
            if(  appCtxSvc.ctx.preferences.PCA_effectivity_shown_columns[ 0 ] === 'UnitOnly' ) {
                settingsCache.effectivityInfo.currentStartEffDates.dbValues = [ '' ];
                settingsCache.effectivityInfo.currentEndEffDates.dbValues = [ '' ];
            }
            const effectivityChanged = !_.isEqual( svrSettings.appliedSettings.configSettings.effectivityInfo, settingsCache.effectivityInfo );
            settingsCache.effectivityChanged = effectivityChanged;
            settingsCache.filterCriteriaModified = effectivityChanged;
            svrSettingsValue.settingsCache = settingsCache;
            subPanelContext.svrSettings.update( svrSettingsValue );
            needToClosePopup = true;
        } else if ( data.contextKey !== 'fscContext' ) {
            // Variability Explorer -
            // In Advance reuse dialog box if the picker view is open, going back to search panel.
            // In inline authoring mode if revision rule is changed we are resetting the context value.
            pca0CommonUtils.resetAdvancedReuseAndInlineAuthoringMode( context );

            // Get Formula for setProperties
            // Trigger effectivity update on perspective
            // Fire events to update link and reload variant expression data
            let effectivityFormula = _getEffectivityFormula( data.contextKey, startEffStr, endEffStr );

            let response = await pca0CommonUtils.callSetPropertiesSOA( data.contextKey, context, undefined, effectivityFormula, false );
            if( response ) {
                // Update the effectivity on Session Storage after setProperties SOA is called
                pca0CommonUtils.updatePersistentRevRuleMap( context, 'effectivity', effectivityFormula );

                let eventData = {
                    contextKey: data.contextKey
                };
                // Fire events to reload variant expression data and update link
                eventBus.publish( 'Pca0FilterCriteriaSettings.filterCriteriaUpdated', eventData );
                eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' );
            }
            needToClosePopup = true;
        } else {
            // Fix for LCS-537591: Handle UP and SO end unit effectivity scenarios
            // Decrement End Unit value when UP or SO
            // And update the values in settingsCache to be used for SOA input
            if( endEffStr === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                endEffStr === ApsEffectivityValidationService.instance.UP_UNIT_VAL ) {
                let endUnitInt = parseInt( endEffStr );
                endUnitInt--;
                endEffStr = endUnitInt.toString();
            }
            // Update cached value
            let settingsCache = { ...context.settingsCache };
            settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = startEffStr;
            settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endEffStr;

            // If UnitOnly, delete any other content for Dates
            // Leave Date info otherwise
            if( context.effectivityFeature === 'UnitOnly' ) {
                settingsCache.effectivityInfo.currentStartEffDates.dbValues = [ '' ];
                settingsCache.effectivityInfo.currentEndEffDates.dbValues = [ '' ];
            }
            appCtxSvc.updatePartialCtx( data.contextKey + '.settingsCache', settingsCache );

            // Trigger processing of Filter Criteria dirt flag and VM Property update
            eventBus.publish( 'Pca0UnitEffectivity.effectivityChanged' );

            needToClosePopup = true;
        }
    }
    if( needToClosePopup ) {
        popupService.hide( undefined, subPanelContext.popupId );
    }
};

/**
 * VCV scenario only
 * Updates view model data when user closes Effectivity Unit Range popup
 * @param {Object} data - The ViewModel object of the Effectivity Unit view
 * @return {Object} Unit Effectivity VM property Info container
 */
export let updateUnitEffectivityVMProperty = function( data ) {
    return _initializeVMProps( data );
};

/**
 * Toggle Unit Effectivity Link State
 * @param {Boolean} isDisableEffectivityLink true - if Unit Effectivity link state to be disabled
 *                                           false - if Unit Effectivity link state to be enabled
 * @return {Object} - isEffectivityReadOnly
 *
 */
export let toggleEffectivityLinkState = function( isDisableEffectivityLink ) {
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = isDisableEffectivityLink;
    return { isEffectivityReadOnly };
};

export default exports = {
    initializeUnitEffectivityConfigurationData,
    applyUnitEffectivity,
    updateUnitEffectivityVMProperty,
    toggleEffectivityLinkState
};
