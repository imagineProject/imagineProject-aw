// Copyright (c) 2024 Siemens

/**
 *
 * @module js/pca0SvrFilterCriteriaSettingsService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityAuthoringService from 'js/apsEffectivityAuthoringService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';


/**
 * Returns the productHierarchyDepthValue and productHierarchyDepthProperties LOV -hardcoded on client for now -
 * based on the level we are given for the init of the HierarchyDepth
 * @param {String} valLevelProductHierarchyDepthUID : Level of HierarchyDepth
 * @returns {Object} structure with current productHierarchyDepthValue and the LOV
 */
let _getProductHierarchyDepthProperties = ( valLevelProductHierarchyDepthUID ) => {
    //we hardcoded this on client but keep implementation similar to the rest for later when we might have it
    //from server:  settingsMO.pca0ProductHierarchyDepthLevelLOV.lovValues;
    let productHierarchyDepthProperties = [ {
        propInternalValue: '1',
        propDisplayValue: '1'
    },
    {
        propInternalValue: '2',
        propDisplayValue: '2'
    },
    {
        propInternalValue: '3',
        propDisplayValue: '3'
    },
    {
        propInternalValue: '4',
        propDisplayValue: '4'
    }
    ];

    let productHierarchyDepthValue = _.find( productHierarchyDepthProperties, { propInternalValue: valLevelProductHierarchyDepthUID } );
    return {
        productHierarchyDepthValue: productHierarchyDepthValue,
        productHierarchyDepthProperties: productHierarchyDepthProperties
    };
};

let exports = {};

/**
 * Create and get a view model property based on current effectivity
 * Code has been copied and adapted from occmgmt4js/fgfConfigurationService
 *
 * @param {Object} effectivityInfo : effectivityInfo
 * @param {String} effectivityFeature : Effectivity feature currently processing.
 * @return {Object} Property: current effectivity view model property
 * NOTE: It might contain mixed date/unit information if preference PCA_Effectivity_shown_columns changed value DateOnly/UnitOnly/All
 * This might occur on first load, before any user changes: in this case, proper formatting is applied
 */
export let getEffectivityDisplayInfo = function( effectivityInfo, effectivityFeature ) {
    let endUnit = effectivityInfo.currentEndEffUnits.dbValues[0];
    let vmProperty;

    // Get Effectivity feature currently processing
    switch ( effectivityFeature ) {
        case 'DateOnly':
            var currentlyAppliedDateEffStr = ApsEffectivityAuthoringService.getDecoratedDateEffectivityDisplayStr(
                effectivityInfo.currentStartEffDates.dbValues[0], effectivityInfo.currentEndEffDates.dbValues[0] );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedDateEffStr, currentlyAppliedDateEffStr, 'STRING', currentlyAppliedDateEffStr, '' );
            vmProperty.uiValue = currentlyAppliedDateEffStr;
            break;

        case 'UnitOnly':
            // Fix for LCS-537591: Handle UP and SO end unit effectivity scenarios
            // Increment End Unit value when UP or SO
            // Use endUnit to display the value in UI
            if ( endUnit === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                ( parseInt( ApsEffectivityValidationService.instance.SO_UNIT_VAL ) - 1 ).toString() === endUnit ) {
                let endUnitInt = parseInt( endUnit );
                endUnitInt++;
                endUnit = endUnitInt.toString();
            }
            var currentlyAppliedUnitEffStr = ApsEffectivityAuthoringService.getDecoratedUnitEffectivityDisplayStr(
                effectivityInfo.currentStartEffUnits.dbValues[0], endUnit );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedUnitEffStr, currentlyAppliedUnitEffStr, 'STRING', currentlyAppliedUnitEffStr, '' );
            vmProperty.uiValue = currentlyAppliedUnitEffStr;
            vmProperty.isEditable = true; // needs to be set explicitly as the default is false
            break;

        default:
            vmProperty = uwPropertyService.createViewModelProperty(
                '', '', 'STRING', '', '' );
            vmProperty.uiValue = '';
    }
    return vmProperty;
};

/**
 * Initialize effectivity
 * Based on values from settings or settingsMO, populate settingsCache
 * @param {Object} svrSettingsAtomicData : svrSettingsAtomicData
 */
export let initializeEffectivity = function( svrSettingsAtomicData ) {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };

    let configSettings = svrSettings.appliedSettings.configSettings;
    let settingsCache = svrSettings.settingsCache ? svrSettings.settingsCache : { effectivityInfo: {} };
    let settingsEffectivity = configSettings.props.pca0Effectivity;

    // Effectivity is provided in following format
    // "dateIn..dateOut & unitIn..unitOut"
    let tokens = settingsEffectivity.dbValues[0].split( ' & ' );

    // Process Dates
    // Dates are in Zulu Time (UTC)
    // "2015-06-01T05:30:00Z..9999-12-30T00:00:00Z"; //2015-06-01..UP
    let effDateArray = tokens[0].split( '..' );
    let startEffDateStr = effDateArray.length >= 1 ? effDateArray[0] : '';
    let endEffDateStr = effDateArray.length === 2 ? effDateArray[1] : '';

    // Update cached value
    settingsCache.effectivityInfo.currentStartEffDates.dbValues[0] = startEffDateStr;
    settingsCache.effectivityInfo.currentEndEffDates.dbValues[0] = endEffDateStr;

    // Process Units
    // 1..10
    // ..10
    // 1..
    // 1..UP
    // ..SO
    let effUnitArray = tokens[1].split( '..' );
    let startEffUnitStr = effUnitArray.length >= 1 && effUnitArray[0] !== '' ? effUnitArray[0] : '-1';
    let endEffUnitStr = effUnitArray.length === 2 && effUnitArray[1] !== '' ? effUnitArray[1] : '-1';

    // Update cached value
    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[0] = startEffUnitStr;
    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[0] = endEffUnitStr;
    configSettings.effectivityInfo = _.cloneDeep( settingsCache.effectivityInfo );

    svrSettings.settingsCache = settingsCache;
    svrSettings.appliedSettings.configSettings = configSettings;
    // Update atomic data
    svrSettingsAtomicData.update( svrSettings );
};

/**
 * Initialize ProductHierarchyDepth
 * Based on values from applied settings populate settingsCache
 * @param {Object} svrSettingsAtomicData - svrSettingsAtomicData
 * @returns {Object} product hierarchy depth properties object
 */
export let initializeProductHierarchyDepth = function( svrSettingsAtomicData ) {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };
    let appliedSettings = svrSettings.appliedSettings;
    let settingsCache = { ...svrSettings.settingsCache };

    // Set initial selection and initialize cache value
    let valLevelProductHierarchyDepthUID = appliedSettings.configSettings.props.pca0ProductHierarchyDepth ? appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues[0] : '1';
    if ( !_.isUndefined( settingsCache.profileSettings ) ) {
        settingsCache.profileSettings.pca0ProductHierarchyDepth = valLevelProductHierarchyDepthUID;
        // Update atomic data
        svrSettingsAtomicData.update( svrSettings );
    }

    return _getProductHierarchyDepthProperties( valLevelProductHierarchyDepthUID );
};

/**
 * Processes the Effectivity Dates into string format
 * @param {Object} settingsCache settings cache
 * @returns {String} strEffectivity changed effectivity string
 */
export let processEffectivityDates = ( settingsCache ) => {
    // Process Effectivity Dates: for "DateOnly" and "All"
    // We need to provide a ISO-8601 format with indication of Z time
    // Issue on server when setting a ISO string formatted with milliseconds: 2015-03-04T00:00:00.000Z
    let startDateUTC = '';
    let endDateUTC = '';
    if( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] !== '' ) {
        let startDateGMT = new Date( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] );
        startDateUTC = new Date( startDateGMT ).toISOString().slice( 0, -5 ) + 'Z';
    }
    if( settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] !== '' ) {
        let endDateGMTStr = settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ];

        // If UP ("9999-12-30T00:00:00") or StockOut ("9999-12-26T00:00:00") are used, do not convert, just add Z
        if( endDateGMTStr === ApsEffectivityValidationService.instance.EFFECTIVITY_UP_DATE_WITH_TIME || endDateGMTStr === ApsEffectivityValidationService.instance
            .EFFECTIVITY_SO_DATE_WITH_TIME ) {
            endDateUTC = endDateGMTStr + 'Z';
        } else {
            let endDateGMT = new Date( endDateGMTStr );
            endDateUTC = new Date( endDateGMT ).toISOString().slice( 0, -5 ) + 'Z'; // need to provide format: "2019-06-01T05:30:00Z"
        }
    }
    let dateRangeStrStr = startDateUTC + '..' + endDateUTC;
    return dateRangeStrStr !== '..' ? dateRangeStrStr : '';
};

/**
 * Processes the Unit Effectivity into string format
 * @param {Object} settingsCache settings cache
 * @returns {String} strEffectivity changed effectivity string
 */
export let processEffectivityUnits = ( settingsCache ) => {
    // Units can have unitIn and/or unitOut
    let unitIn = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
    let unitInStr = unitIn !== '-1' ? unitIn : '';
    let unitOut = settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
    let unitOutStr = unitOut !== '-1' ? unitOut : '';

    let unitStr = unitInStr + '..' + unitOutStr;
    return unitStr !== '..' ? unitStr : '';
};

/**
 * VCV - Gets current and updated configuration settings from local Cache
 * These values will be sent back to server to be saved
 * @param {Object} svrSettingsAtomicData svrSettings atomic data
 * @returns {Object} enhanced array to use for saving the settings properties
 */
export let getFilterCriteriaToApply = ( svrSettingsAtomicData ) => {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };
    let configSettingsProps = {};
    //if we lost the initial props due to panel being replaced and coming now from a rule date subpanel for example
    //use the stored config perspective on atomic data svrSettings.
    let configPerspectiveUid = _.get( svrSettings, 'configPerspective.uid', _.get( svrSettings, 'currentConfigPerspective.uid' ) );

    configSettingsProps.pca0ConfigPerspective = [ configPerspectiveUid ];
    let settingsCache = svrSettings.settingsCache;
    if( settingsCache ) {
        // Revision Rule
        if( !_.isUndefined( settingsCache.selectedRevisionRule ) ) {
            // Sending to AW server selected RevisionRule UID
            configSettingsProps.pca0RevisionRule = [ settingsCache.selectedRevisionRule.uid ];
        } else {
            // Do not send Revision Rule if no change was done
        }

        // Rule Date - make sure you always have one set so we never transmit null, server has issues with it
        // For "No Rule Date" and "System Default" trasmit back String Value
        // "No Rule Date" (selectedRuleDate: "NoRuleDate")
        // "System Default" (selectedRuleDate: "Default")
        let strRuleDate;
        if( !settingsCache.selectedRuleDate ) {
            if( settingsCache.ruleDateTranslationMode ) {
                strRuleDate = settingsCache.ruleDateTranslationMode;
            } else{
                // Default to latest
                let nowDate = new Date();
                strRuleDate = JSON.stringify( Math.floor( nowDate.getTime() / 1000 ) );
            }
        } else if( typeof settingsCache.selectedRuleDate === 'string' ) {
            if( settingsCache.selectedRuleDate === 'latest' ) {
                let nowDate = new Date();
                strRuleDate = JSON.stringify( Math.floor( nowDate.getTime() / 1000 ) );
            } else {
                strRuleDate = settingsCache.selectedRuleDate;
            }
        } else {
            strRuleDate = JSON.stringify( settingsCache.selectedRuleDate );
        }
        configSettingsProps.pca0RuleDate = [ strRuleDate ];

        // Effectivity: provide format like "dateIn..dateOut & unitIn..unitOut"
        let strEffectivity = '';
        let isUnitOnly =  appCtxSvc.ctx.preferences.PCA_effectivity_shown_columns[ 0 ]  === 'UnitOnly';
        let isDateOnly =  appCtxSvc.ctx.preferences.PCA_effectivity_shown_columns[ 0 ]  === 'DateOnly';
        // Process Effectivity Dates: for "DateOnly" and "All"
        if( !isUnitOnly ) {
            // Process Effectivity Dates: for "DateOnly" and "All"
            strEffectivity = exports.processEffectivityDates( settingsCache );
        }

        // Add delimiter
        strEffectivity += ' & ';

        // Process Effectivity Units: for "UnitOnly" and "All"
        if( !isDateOnly ) {
            // Units can have unitIn and/or unitOut
            let effUnit = exports.processEffectivityUnits( settingsCache );
            strEffectivity += effUnit;
        }
        configSettingsProps.pca0Effectivity = [ strEffectivity ];
    }
    return configSettingsProps;
};


export default exports = {
    initializeEffectivity,
    getEffectivityDisplayInfo,
    initializeProductHierarchyDepth,
    processEffectivityDates,
    processEffectivityUnits,
    getFilterCriteriaToApply
};
