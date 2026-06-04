// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Pca0FilterCriteriaSettingsService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityAuthoringService from 'js/apsEffectivityAuthoringService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import utils from 'js/Pca0SettingsUtilsService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

let exports = {};

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
    },
    {
        propInternalValue: '5',
        propDisplayValue: '5'
    }
    ];

    let productHierarchyDepthValue = _.find( productHierarchyDepthProperties, { propInternalValue: valLevelProductHierarchyDepthUID } );
    return {
        productHierarchyDepthValue: productHierarchyDepthValue,
        productHierarchyDepthProperties: productHierarchyDepthProperties
    };
};

/**
 * Convert a date to ISO string format, formatted as YYYY-MM-DDTHH:mm:ssZ.
 * This function convert the date(2025-01-30T12:11:48.000Z) to a string formatted as "2025-01-30T18:30:00Z".
 * The server expect date in ISO format with time as T18:30:00Z.
 * @param {Date} dateToFormat - Date object to convert
 * @returns {String} Formatted ISO date string as "2025-01-30T18:30:00Z"
 * Note: If required the UTC formatted date with time as T00:00:00Z (2025-01-30T00:00:00Z), use getFormattedDateString.
 */
let _formatDateToISOStringAsServerFormat = ( dateToFormat ) => {
    let dateGMT = new Date( dateToFormat );
    // Setting time to 0 to avoid time zone difference with machine time and date picker time.
    dateGMT.setHours( 0, 0, 0, 0 );
    // The slice method is used to remove the last five characters from the ISO string("22025-01-30T18:30:00.000Z").
    // This effectively removes the milliseconds and the trailing Z from the string, resulting in a format like YYYY-MM-DDTHH:mm:ss ("2025-01-30T18:30:00").
    return dateGMT.toISOString().slice( 0, -5 ) + 'Z'; // Need to provide format: "2025-01-30T18:30:00Z"
};

/**
 * Init the configuration settings object after retrieving the setting data from the server
 * Update context
 *
 * @param {Object} subPanelContextInfo - The view model object information from calling View
 */
export let initViewDataSettings = function( subPanelContextInfo ) {
    let context = appCtxSvc.getCtx( subPanelContextInfo.contextKey );

    // Effectivity feature is part of AW startup preferences
    let ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    let effectivityFeature = ctxPreferences.PCA_effectivity_shown_columns[ 0 ];
    context.effectivityFeature = effectivityFeature;
    appCtxSvc.updateCtx( subPanelContextInfo.contextKey, context );
};

/**
 * Initialize effectivity
 * Based on values from settings or settingsMO, populate settingsCache
 * @param {String} contextKey : Name of relevant context.
 */
export let initializeEffectivity = function( contextKey ) {
    const context = appCtxSvc.getCtx( contextKey );
    let configSettings = context.appliedSettings.configSettings;
    let settingsCache = { ...context.settingsCache };
    const settingsEffectivity = configSettings.props.pca0Effectivity;

    if( contextKey !== Pca0Constants.FSC_CONTEXT ) {
        // Effectivity is provided in following format
        // "[Teamcenter::]Date >= 2020-07-15T00:00:00-0400 & [Teamcenter::]Date < 9999-12-30T00:00:00+00:00"

        const effectivityValue = settingsEffectivity.dbValues[ 0 ];
        if( effectivityValue !== null ) {
            // Effectivity is provided in following format
            // "[Teamcenter::]Unit >= 1 & [Teamcenter::]Unit < 11 | [Teamcenter::]Unit >= 20 & [Teamcenter::]Unit < 30"
            let tokens = settingsEffectivity.dbValues[ 0 ].split( ' | ' );
            tokens = tokens[0].split( ' & ' );
            const dateGTE = '[Teamcenter::]Date >= ';
            const dateGT = '[Teamcenter::]Date > ';
            const dateLTE = '[Teamcenter::]Date <= ';
            const dateLT = '[Teamcenter::]Date < ';
            const unitGTE = '[Teamcenter::]Unit >= ';
            const unitGT = '[Teamcenter::]Unit > ';
            const unitLTE = '[Teamcenter::]Unit <= ';
            const unitLT = '[Teamcenter::]Unit < ';
            const unitEQ = '[Teamcenter::]Unit = ';

            for( let idx = 0; idx < tokens.length; idx++ ) {
                // dateGTE: [Date >=]
                if( tokens[ idx ].includes( dateGTE ) ) {
                    settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateGTE, '' );
                }
                // dateGT: [Date >]
                else if( tokens[ idx ].includes( dateGT ) ) {
                    settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateGT, '' );
                }
                // dateLTE: [Date <=]
                else if( tokens[ idx ].includes( dateLTE ) ) {
                    settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateLTE, '' );
                }
                // dateLT: [Date <]
                else if( tokens[ idx ].includes( dateLT ) ) {
                    settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateLT, '' );
                }
                // unitGTE: [Unit >=]
                else if( tokens[ idx ].includes( unitGTE ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitGTE, '' );
                }
                // unitGT: [Unit >]
                else if( tokens[ idx ].includes( unitGT ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitGT, '' );
                }
                // unitLTE: [Unit <=]
                else if( tokens[ idx ].includes( unitLTE ) ) {
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitLTE, '' );
                }
                // unitLT: [Unit <]
                else if( tokens[ idx ].includes( unitLT ) ) {
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitLT, '' );

                    // Server is taking care of sending correct effectivity values on the formula depending
                    // on the preference 'TC_Fnd0Booleansolve_EffectivityIntegerRangeFromTo'
                    // If the Formula is Unit <, decrement the value by 1
                    const startUnit = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
                    const endUnit = settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
                    if( endUnit !== ApsEffectivityValidationService.instance.UP_UNIT_VAL &&
                            endUnit !== ApsEffectivityValidationService.instance.SO_UNIT_VAL && startUnit !== endUnit ) {
                        let endUnitInt = parseInt( endUnit );
                        --endUnitInt;
                        settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endUnitInt.toString();
                    }
                }
                // unitEQ: [Unit =]
                else if( tokens[ idx ].includes( unitEQ ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitEQ, '' );
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
                }
            }
        }
    } else {
        // Effectivity is provided in following format
        // "dateIn..dateOut & unitIn..unitOut"
        let tokens = settingsEffectivity.dbValues[ 0 ].split( ' & ' );

        // Process Dates
        // Dates are in Zulu Time (UTC)
        // "2015-06-01T05:30:00Z..9999-12-30T00:00:00Z"; //2015-06-01..UP
        const effDateArray = tokens[ 0 ].split( '..' );
        const startEffDateStr = effDateArray.length >= 1 ? effDateArray[ 0 ] : '';
        const endEffDateStr = effDateArray.length === 2 ? effDateArray[ 1 ] : '';

        // Update cached value
        settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = startEffDateStr;
        settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = endEffDateStr;

        // Process Units
        // 1..10
        // ..10
        // 1..
        // 1..UP
        // ..SO
        const effUnitArray = tokens[ 1 ].split( '..' );
        const startEffUnitStr = effUnitArray.length >= 1 && effUnitArray[ 0 ] !== '' ? effUnitArray[ 0 ] : '-1';
        const endEffUnitStr = effUnitArray.length === 2 && effUnitArray[ 1 ] !== '' ? effUnitArray[ 1 ] : '-1';

        // Update cached value
        settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = startEffUnitStr;
        settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endEffUnitStr;
        configSettings.effectivityInfo = _.cloneDeep( settingsCache.effectivityInfo );
    }

    // Update context
    appCtxSvc.updatePartialCtx( contextKey + '.settingsCache', settingsCache );
};

/**
 * non-VCV scenario Only
 * Get effectivity formula suitable as input for setProperties SOA
 * Formula processed is for Effectivity Date only, from cached Values
 * @param {String} startDate : Effectivity date Range - Start date
 * @param {String} endDate : Effectivity date Range - End date
 * @returns {String} Effectivity formula for the given date range
 */
export let getEffectivityFormulaForDate = function( startDate, endDate ) {
    let effectivityFormula = '';
    if( startDate.length !== 0 ) {
        effectivityFormula += '[Teamcenter::]Date >= ' + startDate;
    }

    if( endDate.length !== 0 ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }

        // Check for From/To vs In/Out
        // if From/To: Activates the inclusion of the end value
        if( ApsEffectivityValidationService.instance.isDateEffectivityFromToMode() ) {
            effectivityFormula += '[Teamcenter::]Date <= ';
        } else {
            effectivityFormula += '[Teamcenter::]Date < ';
        }
        effectivityFormula += endDate;
    }
    return effectivityFormula;
};

/**
 * non-VCV scenario Only
 * Get effectivity formula suitable as input for setProperties SOA
 * Formula processed is for Effectivity Unit part only
 * @param {String} startUnit : Effectivity unit Value/Range - Start unit
 * @param {String} endUnit : Effectivity unit Value/Range - End unit
 */

export let getEffectivityFormulaForUnit = ( startUnit, endUnit ) => {
    if( startUnit !== '-1' && endUnit !== '-1' && startUnit === endUnit ) {
        return '[Teamcenter::]Unit = ' + startUnit;
    }

    let effectivityFormula = '';
    if( startUnit !== '-1' ) {
        effectivityFormula += '[Teamcenter::]Unit >= ' + startUnit;
    }

    if( endUnit !== '-1' ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }

        // non-VCV scenario- Check for From/To vs In/Out
        // if From/To: Activates the inclusion of the end value. To include the end value here we are incrementing the end value by one.
        // For instance input unit range is 1..100
        // The effectivity formula for From/To will be :  [Teamcenter::]Unit >= 1 &&  [Teamcenter::]Unit < 101 )
        // The effectivity formula for In/Out will be :  [Teamcenter::]Unit >= 1 &&  [Teamcenter::]Unit < 100 )
        if( ApsEffectivityValidationService.instance.isUnitEffectivityFromToMode() &&
            endUnit !== ApsEffectivityValidationService.instance.UP_UNIT_VAL &&
            endUnit !== ApsEffectivityValidationService.instance.SO_UNIT_VAL ) {
            let endUnitInt = parseInt( endUnit );
            ++endUnitInt;
            endUnit = endUnitInt.toString();
        }
        effectivityFormula += '[Teamcenter::]Unit < ' + endUnit;
    }
    return effectivityFormula;
};

/**
 * Handle selection change for Intents: TODO when intents is supported again
 *
 * @param {Object} data - The view model object
 */
export let handleIntentSelectionChange = function( data ) {
    // TODO
};

/**
 * VCV - Gets current and updated configuration settings from local Cache
 * These values will be sent back to server to be saved
 * @param {Object} variantRuleData variantRuleData atomic data
 * @returns {Object} enhanced array to use for saving the settings properties
 */
export let getFilterCriteriaToApply = function( variantRuleData ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let configSettingsProps = {};
    //if we lost the initial props due to panel being replaced and coming now from a rule date subpanel for example
    //use the stored config perspective on appctx
    let configPerspectiveUid = variantRuleData ? variantRuleData.value.configPerspective.uid : fscContext.currentConfigPerspective.uid;

    configSettingsProps.pca0ConfigPerspective = [ configPerspectiveUid ];
    let settingsCache = fscContext.settingsCache;
    if( settingsCache ) {
        // Revision Rule
        if( !_.isUndefined( settingsCache.selectedRevisionRule ) ) {
            // Sending to AW server selected RevisionRule UID
            configSettingsProps.pca0RevisionRule = [ settingsCache.selectedRevisionRule.uid ];
        } else {
            // Do not send Revision Rule if no change was done
        }


        // ProductHierarchyDepth
        if( _.get( settingsCache, 'profileSettings.pca0ProductHierarchyDepth' ) ) {
            // Sending to AW server selected depth
            configSettingsProps.pca0ProductHierarchyDepth = [ settingsCache.profileSettings.pca0ProductHierarchyDepth ];
        }
        // Rule Date
        // For "No Rule Date" and "System Default" trasmit back String Value
        // "No Rule Date" (selectedRuleDate: "NoRuleDate")
        // "System Default" (selectedRuleDate: "Default")
        let strRuleDate;
        if( typeof settingsCache.selectedRuleDate === 'string' ) {
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

        // Process Effectivity Dates: for "DateOnly" and "All"
        if( fscContext.effectivityFeature !== 'UnitOnly' ) {
            // We need to provide a ISO-8601 format with indication of Z time
            // Issue on server when setting a ISO string formatted with milliseconds: 2015-03-04T00:00:00.000Z
            let startDateUTC = '';
            let endDateUTC = '';
            if( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] !== '' ) {
                // Get converted ISO date string "2023-11-30T18:30:00Z".
                startDateUTC = _formatDateToISOStringAsServerFormat( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] );
            }
            if( settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] !== '' ) {
                let endDateGMTStr = settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ];
                // The slice method is used to remove the last six characters from the date string("9999-12-30T00:00:00+05:30").
                endDateGMTStr = endDateGMTStr.slice( 0, -6 );
                // If UP ("9999-12-30T00:00:00") or StockOut ("9999-12-26T00:00:00") are used, do not convert, just add Z
                if( endDateGMTStr === ApsEffectivityValidationService.instance.EFFECTIVITY_UP_DATE_WITH_TIME || endDateGMTStr === ApsEffectivityValidationService.instance
                    .EFFECTIVITY_SO_DATE_WITH_TIME ) {
                    endDateUTC = endDateGMTStr + 'Z';
                } else {
                    // Get converted ISO date string "2023-12-30T18:30:00Z".
                    endDateUTC = _formatDateToISOStringAsServerFormat( settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] );
                }
            }
            let dateRangeStrStr = startDateUTC + '..' + endDateUTC;
            let effDateStr = dateRangeStrStr !== '..' ? dateRangeStrStr : '';
            strEffectivity = effDateStr;
        }

        // Add delimiter
        strEffectivity += ' & ';

        // Process Effectivity Units: for "UnitOnly" and "All"
        if( fscContext.effectivityFeature !== 'DateOnly' ) {
            // Units can have unitIn and/or unitOut
            let unitIn = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
            let unitInStr = unitIn !== '-1' ? unitIn : '';
            let unitOut = settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
            let unitOutStr = unitOut !== '-1' ? unitOut : '';

            let unitStr = unitInStr + '..' + unitOutStr;
            let effUnit = unitStr !== '..' ? unitStr : '';

            strEffectivity += effUnit;
        }
        configSettingsProps.pca0Effectivity = [ strEffectivity ];
    }
    return configSettingsProps;
};

/**
 * Get intents level list
 * @param {Object} lov - lov for Intents as from server response
 * @returns {Object} Lov List
 */
export let getIntentList = function( lov ) {
    return utils.getSettingsLovList( lov );
};

/**
 * Create and get a view model property based on current effectivity
 * Code has been copied and adapted from occmgmt4js/fgfConfigurationService
 *
 * @param {String} contextKey : Name of relevant context.
 * @param {String} effectivityFeature : Effectivity feature currently processing.
 * @return {Object} Property: current effectivity view model property
 * NOTE: It might contain mixed date/unit information if preference PCA_Effectivity_shown_columns changed value DateOnly/UnitOnly/All
 * This might occur on first load, before any user changes: in this case, proper formatting is applied
 */
export let getEffectivityDisplayInfo = function( contextKey, effectivityFeature ) {
    let context = appCtxSvc.getCtx( contextKey );
    let effectivityInfo = context.settingsCache.effectivityInfo;
    let endUnit = effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
    let vmProperty;

    // Get Effectivity feature currently processing
    switch ( effectivityFeature ) {
        case 'DateOnly': {
            let currentlyAppliedDateEffStr = ApsEffectivityAuthoringService.getDecoratedDateEffectivityDisplayStr(
                effectivityInfo.currentStartEffDates.dbValues[ 0 ], effectivityInfo.currentEndEffDates.dbValues[ 0 ] );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedDateEffStr, currentlyAppliedDateEffStr, 'STRING', currentlyAppliedDateEffStr, '' );
            vmProperty.uiValue = currentlyAppliedDateEffStr;
            break;
        }
        case 'UnitOnly': {
            // Fix for LCS-537591: Handle UP and SO end unit effectivity scenarios
            // Increment End Unit value when UP or SO
            // Use endUnit to display the value in UI
            if( contextKey === Pca0Constants.FSC_CONTEXT &&
                ( endUnit === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                    ( parseInt( ApsEffectivityValidationService.instance.SO_UNIT_VAL ) - 1 ).toString() === endUnit ) ) {
                let endUnitInt = parseInt( endUnit );
                endUnitInt++;
                endUnit = endUnitInt.toString();
            }
            let currentlyAppliedUnitEffStr = ApsEffectivityAuthoringService.getDecoratedUnitEffectivityDisplayStr(
                effectivityInfo.currentStartEffUnits.dbValues[ 0 ], endUnit );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedUnitEffStr, currentlyAppliedUnitEffStr, 'STRING', currentlyAppliedUnitEffStr, '' );
            vmProperty.uiValue = currentlyAppliedUnitEffStr;

            // value property is used by AwTextBox component to update propValue onChange Handler.
            vmProperty.value = currentlyAppliedUnitEffStr;

            vmProperty.isEditable = true; // needs to be set explicitly as the default is false
            break;
        }
        default:
            vmProperty = uwPropertyService.createViewModelProperty(
                '', '', 'STRING', '', '' );
            vmProperty.uiValue = '';
    }
    return vmProperty;
};

/**
 * VCV scenario only
 * Update flag on fscContext.settingsCache for changes in Filter Criteria
 */
export let filterCriteriaModified = function() {
    if( _.isUndefined( appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ) ) || _.isUndefined( appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ).settingsCache ) ) {
        return;
    }
    const context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let settingsCache = { ...context.settingsCache };

    if( typeof settingsCache.selectedRuleDate === 'number' ) {
        settingsCache.selectedRuleDate = String( settingsCache.selectedRuleDate );
    }
    const ruleDateChanged = context.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ] !== settingsCache.selectedRuleDate;
    const effectivityChanged = !_.isEqual( context.appliedSettings.configSettings.effectivityInfo, settingsCache.effectivityInfo );

    // SettingsCache contains the updated RevisionRule, if the user made a change.
    let revisionRuleChanged;
    revisionRuleChanged = !_.isUndefined( settingsCache.selectedRevisionRule );

    if( revisionRuleChanged || ruleDateChanged || effectivityChanged ) {
        settingsCache.filterCriteriaModified = true;
    } else {
        settingsCache.filterCriteriaModified = false;
    }
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
};

/**
 * Toggle Filter Criteria Settings State
 * @param {Object} subPanelContextInfo - sub panel context Info container
 * @param {Boolean} eventMap  event data container
 * @returns {Object} updated subPanelContext info
 */
export let toggleFilterCriteriaSettingsState = function( subPanelContextInfo, eventMap ) {
    let key = 'Pca0Settings.toggleFilterCriteriaSettingsState';
    let eventData = pca0CommonUtils.getEventDataFromEventMap( eventMap, key );
    let isDisableFilterCriteria = eventData.isReadOnlyMode;

    subPanelContextInfo.isConfigurationReadOnly.dbValue = isDisableFilterCriteria;

    // Publish event(s) to toggle specific Filter Criteria Settings
    let revRuleEventData = {
        isDisableRevisionRuleLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0RevisionRule.toggleRevisionRuleLinkState', revRuleEventData );
    let ruleDateEventData = {
        isDisableRuleDateLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0RuleDate.toggleRuleDateLinkState', ruleDateEventData );
    let dateEffectivityEventData = {
        isDisableEffectivityLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0DateEffectivity.toggleEffectivityLinkState', dateEffectivityEventData );
    let unitEffectivityEventData = {
        isDisableEffectivityLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0UnitEffectivity.toggleEffectivityLinkState', unitEffectivityEventData );

    return { subPanelContextInfo };
};


/**
 * Initialize ProductHierarchyDepth
 * Based on values from applied settings populate settingsCache
 * @param {String} contextKey : Name of relevant context.
 * @returns {Object} product hierarchy depth properties object
 */
export let initializeProductHierarchyDepth = function( contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    let appliedSettings = context.appliedSettings;
    let settingsCache = { ...context.settingsCache };

    // Set initial selection and initialize cache value
    let valLevelProductHierarchyDepthUID = _.get( settingsCache, 'profileSettings.pca0ProductHierarchyDepth' ) ?? _.get( appliedSettings, 'configSettings.props.pca0ProductHierarchyDepth.dbValues[0]', '1' );
    if( !_.isUndefined( settingsCache.profileSettings ) ) {
        settingsCache.profileSettings.pca0ProductHierarchyDepth = valLevelProductHierarchyDepthUID;
        // Update context
        appCtxSvc.updatePartialCtx( contextKey + '.settingsCache', settingsCache );
    }

    return _getProductHierarchyDepthProperties( valLevelProductHierarchyDepthUID );
};

/**
 * Handle change of selection for Product Hierarchy Depth
 * @param {Object} productHierarchyDepth - productHierarchyDepth
 */
export let handleProductHierarchyDepthChange = function( productHierarchyDepth ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let settingsCache = { ...fscContext.settingsCache };
    settingsCache.profileSettings.pca0ProductHierarchyDepth = productHierarchyDepth.dbValue; //selected one
    // Process isDirty Profile Settings
    settingsCache.profileSettingsDirty = !_.isEqual( settingsCache.profileSettings, fscContext.appliedSettings.validationProfile );
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
};

export default exports = {
    initViewDataSettings,
    initializeEffectivity,
    getEffectivityFormulaForDate,
    getEffectivityFormulaForUnit,
    handleIntentSelectionChange,
    getFilterCriteriaToApply,
    getIntentList,
    getEffectivityDisplayInfo,
    filterCriteriaModified,
    toggleFilterCriteriaSettingsState,
    initializeProductHierarchyDepth,
    handleProductHierarchyDepthChange
};
