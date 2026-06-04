// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0DateEffectivityConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import awPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import dateTimeSvc from 'js/dateTimeService';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import Pca0SvrFilterCriteriaSettingsService from 'js/pca0SvrFilterCriteriaSettingsService';
import policySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';

/**
 *
 * @param {Object} clonedData info container for start/end date and options for date range effectivity
 * @param {Array} dbValue array containing dbValue for effectivity date range set
 * @returns {String} display Value for date range option
 */
let _getEndDateOptionsLabel = function( clonedData, dbValue ) {
    let lovEntry = clonedData.endDateList.dbValue.find( entry => entry.propInternalValue === dbValue );
    return lovEntry.propDisplayValue;
};

/**
 * Implementing own version of ApsEffectivityValidationService.populateDateRangeEffectivityDates
 * Method from ApsEffectivityValidationService is setting endDate equal to startDte if they differ from 1 day
 * Populates existing effectivity into start and end date widgets
 *
 * @param {Object} effectivityInfo : Existing Effectivity
 * @param {Object} clonedData onbject container of start/end date and options for effectivity date range
 */
let _populateDateRangeEffectivityDates = function( effectivityInfo, clonedData ) {
    let startDate = clonedData.startDate;
    let endDate = clonedData.endDate;
    let endDateOptions = clonedData.endDateOptions;

    var sDateStr = effectivityInfo.currentStartEffDates.dbValues[ 0 ];
    var eDateStr = effectivityInfo.currentEndEffDates.dbValues[ 0 ];

    startDate.dbValue = new Date( sDateStr ).getTime();
    startDate.dateApi.dateObject = dateTimeSvc.getJSDate( startDate.dbValue );

    if( eDateStr !== null &&
        ( eDateStr.indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_UP_DATE ) !== -1 || eDateStr
            .indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_DATE_DECEMBER_29 ) !== -1 ) ) {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.UP;
        endDateOptions.uiValue = _getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.UP );
    } else if( eDateStr !== null &&
        ( eDateStr.indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_SO_DATE ) !== -1 || eDateStr
            .indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_DATE_DECEMBER_25 ) !== -1 ) ) {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.SO;
        endDateOptions.uiValue = _getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.SO );
    } else {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.DATE;
        endDateOptions.uiValue = _getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.DATE );
        endDate.dbValue = new Date( eDateStr ).getTime();
        endDate.dateApi.dateObject = dateTimeSvc.getJSDate( endDate.dbValue );
    }
};

/**
 * VCA scenario only
 * Get effectivity formula suitable as input for setProperties SOA
 * Maintain in the formula existing value for Unit, if effectivity feature is "All"
 * @param {String} contextKey : Name of relevant context.
 * @param {String} startDate : Effectivity date Range - Start date
 * @param {String} endDate : Effectivity date Range - End date
 * @param {String} endEffectivityOption : Effectivity date Range - End date options (Date/SO/UP)
 */
let _getEffectivityFormula = function( contextKey, startDate, endDate, endEffectivityOption ) {
    // Date formula calculatio is not exposed in FilterCriteria as it strongly depends on dateAPIs
    let effectivityFormula = '';

    // Get start Date String
    let startDateString = ApsEffectivityValidationService.instance.getStringFromDate( startDate.dateApi.dateObject );

    if( startDateString.length !== 0 ) {
        effectivityFormula += '[Teamcenter::]Date >= ' + startDateString;
    }

    if( endEffectivityOption === ApsEffectivityValidationService.instance.UP ) {
        // _UP_DATE_WITH_TIME_IN_GMT = "9999-12-30T00:00:00+00:00";
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }
        effectivityFormula += '[Teamcenter::]Date < 9999-12-30T00:00:00+00:00';
    } else if( endEffectivityOption === ApsEffectivityValidationService.instance.SO ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }
        effectivityFormula += '[Teamcenter::]Date < 9999-12-26T00:00:00+00:00';
    } else {
        let endDateString = ApsEffectivityValidationService.instance.getStringFromDate( endDate.dateApi.dateObject );

        if( endDateString.length !== 0 ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }

            // Single Date effectivity, set End Date as next day from Start Date
            if( dateTimeSvc.compare( startDate.dateApi.dateObject, endDate.dateApi.dateObject ) === 0 ) {
                // Pass startDate date object in the Date constructor to clone the date object
                // If not passed then it will return current date
                let endDateAsNextDate = new Date( startDate.dateApi.dateObject );
                // Add 1 day to the start date (getDate returns on day of the month i.e between 1 to 31)
                endDateAsNextDate.setDate( startDate.dateApi.dateObject.getDate() + 1 );
                endDateAsNextDate.setHours( 0 );
                endDateAsNextDate.setMinutes( 0 );
                endDateAsNextDate.setSeconds( 0 );
                endDateString = ApsEffectivityValidationService.instance.getStringFromDate( endDateAsNextDate );
            }
            effectivityFormula += '[Teamcenter::]Date < ' + endDateString;
        }
    }

    let context = appCtxSvc.getCtx( contextKey );

    if( context.effectivityFeature === 'All' ) {
        // Maintain Unit effectivity
        let cachedEffectivity = context.settingsCache.effectivityInfo;
        let startUnit = cachedEffectivity.currentStartEffUnits.dbValues[ 0 ];
        let endUnit = cachedEffectivity.currentEndEffUnits.dbValues[ 0 ];

        let unitEffectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForUnit( startUnit, endUnit );
        if( unitEffectivityFormula !== '' ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }
            effectivityFormula += unitEffectivityFormula;
        }
    }
    return effectivityFormula;
};

var exports = {};

/**
 * Initialize the Date Effectivity Configuration Section
 * This is called on onMount:
 * - opening Settings Panel
 * - on closure of Date Effectivity Range subpanel
 * Select value as from appliedSettings
 * Settings cache for selected Effectivity has been already initialized in Filter Criteria Service
 * @param {Object} subPanelContext - subPanelContext
 * @return {Object} Date Effectivity Info container
 */
export let initializeDateEffectivityConfigurationData = function( subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isEffectivityReadOnly = {};
    let currentEffectivity = {};
    //when the subcomponents are used with a passed in parameter, feed from it, otherwise use the app context - fsc case
    //we should evtl. change this to always use the passed in props so it's reusable independently, then obsolete the app context path

    //The use case where subcomponents are used with a passed in parameter is when used in the svrFilterCriteria, in which the
    //profile settings are based on passed in fetched settings (in order to be able to show SVR profile settings per SVR like in the MultiSvr grid)
    if( subPanelContext.svrSettings ) {
        let svrSettingsValue =  { ...subPanelContext.svrSettings.getValue() };
        let effectivityInfo = svrSettingsValue.settingsCache?.effectivityInfo;
        currentEffectivity = Pca0SvrFilterCriteriaSettingsService.getEffectivityDisplayInfo( effectivityInfo, 'DateOnly' );
        currentEffectivity.isEditable = !subPanelContext.isConfigurationReadOnly;
        isEffectivityReadOnly.dbValue = subPanelContext.isConfigurationReadOnly;
        svrSettingsValue.value  ? svrSettingsValue.value.settingsCache.effectivityInfo = effectivityInfo : svrSettingsValue.settingsCache.effectivityInfo = effectivityInfo;
        subPanelContext.svrSettings.update( svrSettingsValue );
    } else {
        //app ctx based still used in fsc
        var context = appCtxSvc.getCtx( contextKey );
        isEffectivityReadOnly.dbValue = _.get( subPanelContext, 'isConfigurationReadOnly.dbValue', false );
        if( subPanelContext.contextKey !== pca0Constants.FSC_CONTEXT && ( !context || _.isUndefined( context.appliedSettings ) ) ) {
            return;
        }
        // Get VM property for current Effectivity
        currentEffectivity = Pca0FilterCriteriaSettingsService.getEffectivityDisplayInfo( contextKey, 'DateOnly' );
        currentEffectivity.isEditable = !_.get( subPanelContext, 'isConfigurationReadOnly.dbValue', false );
    }


    return { contextKey, isEffectivityReadOnly, currentEffectivity };
};

/**
 * Initialize data for the subView in use in VCA/VCV context.
 * @param {Object} data - The ViewModel object of the Effectivity Date Range subView
 * @param {Object} subPanelContext - context passed by calling component when initialing the dialog/subview
 * @return {Object} Effectivity Date Range subview info container
 */
export let initializeSubViewData = function( data, subPanelContext ) {
    const contextKey = subPanelContext.contextKey;
    let settingsCache;
    if( subPanelContext.svrSettings ) {
        let svrSettingsValue = subPanelContext.svrSettings.getValue();
        settingsCache = svrSettingsValue.settingsCache;
    } else {
        let context = appCtxSvc.getCtx( contextKey );
        settingsCache = context.settingsCache;
    }
    let clonedData = _.cloneDeep( data );
    _populateDateRangeEffectivityDates( settingsCache.effectivityInfo, clonedData );
    let startDate = clonedData.startDate;
    let endDate = clonedData.endDate;
    let endDateOptions = clonedData.endDateOptions;
    return { contextKey, startDate, endDate, endDateOptions };
};

/**
 * non-VCV: trigger update in perspective
 * VCV: update the selection on the context cache
 * Update Effectivity date range on Perspective for other contexts
 * @param {Object} data The ViewModel object of the Effectivity Date Range subView
 */
export let applyDateRangeEffectivityFromSubPanel = async( data ) => {
    let context = appCtxSvc.getCtx( data.data.contextKey );

    if( data.data.contextKey !== pca0Constants.FSC_CONTEXT && !data.subPanelContext.svrSettings ) {
        // Get Formula for setProperties
        // Trigger effectivity update on perspective
        // Fire events to update link and reload variant expression data
        let effectivityFormula = _getEffectivityFormula( data.data.contextKey, data.data.startDate, data.data.endDate, data.data.endDateOptions.dbValue );

        let response = await pca0CommonUtils.callSetPropertiesSOA( data.data.contextKey, context, undefined, effectivityFormula, true );

        if( response ) {
            // Update the effectivity on Session Storage after setProperties SOA is called
            pca0CommonUtils.updatePersistentRevRuleMap( context, 'effectivity', effectivityFormula );

            let eventData = {
                contextKey: data.data.contextKey
            };
            // Fire events to reload variant expression data and update link
            eventBus.publish( 'Pca0FilterCriteriaSettings.filterCriteriaUpdated', eventData );
            eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' );
        }
        // Close Dialog
        eventBus.publish( 'Pca0EffectivityDateRange.closeDialog' );
    } else {
        let effectivityRange = ApsEffectivityValidationService.instance.getDateRangesFromEffectivityDates( data.data.startDate, data.data.endDate, data.data.endDateOptions.dbValue );
        let startJSDate;
        let endJSDate;

        if( effectivityRange.startDate === ApsEffectivityValidationService.instance.NULLDATE_WITH_TIME ) {
            startJSDate = '';
        } else {
            startJSDate = effectivityRange.startDate;
        }

        // UP
        // "UP" value for date effectivity with time format in GMT. */
        // _UP_DATE_WITH_TIME_IN_GMT = "9999-12-30T00:00:00+00:00";
        if( data.data.endDateOptions.dbValue === ApsEffectivityValidationService.instance.UP ) {
            endJSDate = '9999-12-30T00:00:00+00:00';
        }

        // SO
        // "SO" (Stock Out) value for date effectivity with time format in GMT. */
        // _SO_DATE_WITH_TIME_IN_GMT = "9999-12-26T00:00:00+00:00";
        else if( data.data.endDateOptions.dbValue === ApsEffectivityValidationService.instance.SO ) {
            endJSDate = '9999-12-26T00:00:00+00:00';
        } else {
            if( effectivityRange.endDate === ApsEffectivityValidationService.instance.NULLDATE_WITH_TIME ) {
                endJSDate = '';
            } else {
                endJSDate = effectivityRange.endDate;
            }
        }

        if( data.subPanelContext.svrSettings ) {
            // Update cached value
            let svrSettings = data.subPanelContext.svrSettings;
            let svrSettingsValue = svrSettings.getValue();
            let settingsCache = { ...svrSettingsValue.settingsCache };
            settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = startJSDate;
            settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = endJSDate;

            // If DateOnly, delete any other content for Units
            // Leave Unit info otherwise
            if( svrSettings.effectivityFeature === 'DateOnly' ) {
                settingsCache.effectivityInfo.currentStartEffUnits.dbValues = [ '-1' ];
                settingsCache.effectivityInfo.currentEndEffUnits.dbValues = [ '-1' ];
            }
            const effectivityChanged = !_.isEqual( svrSettings.appliedSettings.configSettings.effectivityInfo, settingsCache.effectivityInfo );
            settingsCache.effectivityChanged = effectivityChanged;
            settingsCache.filterCriteriaModified = effectivityChanged;
            svrSettingsValue.settingsCache = settingsCache;
            data.subPanelContext.svrSettings.update( svrSettingsValue );
        } else {
            // Update cached value
            context = appCtxSvc.getCtx( data.data.contextKey );
            let settingsCache = { ...context.settingsCache };
            settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = startJSDate;
            settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = endJSDate;

            // If DateOnly, delete any other content for Units
            // Leave Unit info otherwise
            if( context.effectivityFeature === 'DateOnly' ) {
                settingsCache.effectivityInfo.currentStartEffUnits.dbValues = [ '-1' ];
                settingsCache.effectivityInfo.currentEndEffUnits.dbValues = [ '-1' ];
            }
            appCtxSvc.updatePartialCtx( data.data.contextKey + '.settingsCache', settingsCache );

            // Trigger processing of Filter Criteria dirt flag
            eventBus.publish( 'Pca0DateEffectivity.effectivityChanged' );
        }
    }
};

/**
 * Toggle Date Effectivity Link State
 * @param {Boolean} isDisableEffectivityLink     true - if Effectivity link state to be disabled
 *                                              false - if Effectivity link state to be enabled
 * @returns {Object} read-only VM property
 *  */
export let toggleEffectivityLinkState = function( isDisableEffectivityLink ) {
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = isDisableEffectivityLink;
    return { isEffectivityReadOnly };
};

export default exports = {
    initializeDateEffectivityConfigurationData,
    initializeSubViewData,
    applyDateRangeEffectivityFromSubPanel,
    toggleEffectivityLinkState
};
