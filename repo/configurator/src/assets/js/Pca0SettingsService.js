// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Pca0SettingsService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import Pca0IncompleteFamiliesService from './Pca0IncompleteFamiliesService';
import Pca0RuleDateConfigurationService from 'js/Pca0RuleDateConfigurationService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

/** Testing variable to show ReadOnly/Editable profile settings
 * By default, solver profile entries are read-only
 */
const _profileSettingsEditable = false;
const sliderPos = {
    MIN: 100,
    MEDIUM: 300,
    MAX: 500
};

/**
 * Refresh selections for Validation Severity
 * there is no way (AW5) to discriminate prop change from user/programmatically
 * This is to avoid loop on every prop change due to programmatic selection of severity levels
 * @return {Object} validation severity properties
 */
var refreshValidationSeverity = function() {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsMO = fscContext.settingsMO;
    var settingsCache = fscContext.settingsCache;
    var selectedValidationSeverity = settingsCache.profileSettings.pca0ValidationSeverity;

    var validationSeverityProperties = [];
    var validationLevelLOV = settingsMO.pca0ValidationLevelLOV.lovValues;
    if( validationLevelLOV ) {
        for( var lovExpRow in validationLevelLOV ) {
            if( validationLevelLOV.hasOwnProperty( lovExpRow ) ) {
                var uid = validationLevelLOV[ lovExpRow ].uid;
                var displayValue = validationLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                var checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Expansion Severity
                    Number( uid ) >= Number( selectedValidationSeverity ), // DB value
                    '' ); // displayValuesIn

                // Checkbox for expansion is enabled if profile allows for it
                // and if ValidationSeverity value is higher than that
                checkBoxProperty.isEnabled = _profileSettingsEditable;
                checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                checkBoxProperty.propInternalVal = uid;
                validationSeverityProperties.push( checkBoxProperty );
            }
        }
    }

    return validationSeverityProperties;
};

/**
 * Refresh selections for Expansion Severity
 * Update Enabled State (depending on validation severity) and checkbox values
 * there is no way (AW5) to discriminate prop change from user/programmatically
 * This is to avoid loop on every prop change due to programmatic selection of severity levels
 * @return {Object} expansion severity properties
 */
var refreshExpansionSeverity = function() {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsMO = fscContext.settingsMO;
    var settingsCache = fscContext.settingsCache;
    var selectedExpansionSeverity = settingsCache.profileSettings.pca0ExpansionSeverity;

    var expansionSeverityProperties = [];
    var expansionLevelLOV = settingsMO.pca0ExpansionLevelLOV.lovValues;
    if( expansionLevelLOV ) {
        for( var lovExpRow in expansionLevelLOV ) {
            if( expansionLevelLOV.hasOwnProperty( lovExpRow ) ) {
                var uid = expansionLevelLOV[ lovExpRow ].uid;
                var displayValue = expansionLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                var checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Expansion Severity
                    Number( uid ) >= Number( selectedExpansionSeverity ), // DB value
                    '' ); // displayValuesIn

                // Checkbox for expansion is enabled if profile allows for it
                // and if ValidationSeverity value is higher than that
                var valLevelUID = settingsCache.profileSettings.pca0ValidationSeverity;
                checkBoxProperty.isEnabled = Number( uid ) <= Number( valLevelUID ) && _profileSettingsEditable;
                checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                checkBoxProperty.propInternalVal = uid;
                expansionSeverityProperties.push( checkBoxProperty );
            }
        }
    }

    return expansionSeverityProperties;
};

/**
 * Initialize Settings Content
 * load LOVs if not fetched yet
 * Initialize validation UI and fire event to initialize effectivity
 * @param {Object} variantRuleData - variantRuleData
 */
export let settingsReveal = function( variantRuleData ) {
    //as long as the settings are in edit mode do not reset the cache
    configuratorUtils.initializeCache( Pca0Constants.FSC_CONTEXT );

    // Initialize effectivity
    Pca0FilterCriteriaSettingsService.initializeEffectivity( Pca0Constants.FSC_CONTEXT );

    // Initialize Rule Date
    Pca0RuleDateConfigurationService.initializeRuleDate( Pca0Constants.FSC_CONTEXT );

    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.isSettingsEditMode = true;

    var settingsMO = fscContext.settingsMO;

    if( _.isUndefined( settingsMO ) || !settingsMO.lovsFetched ) {
        eventBus.publish( 'Pca0Settings.loadSettingsData' );
    } else {
        // Initialize validation UI right away
        eventBus.publish( 'Pca0Settings.initializeValidationUI' );
    }
    //interim solution to allow retrieval of the config perspective after several otehr panels have been opened and
    //we lost info of the original props: it needs to be revised for better design
    if( variantRuleData ) {
        let configPerspective = configuratorUtils.getFscConfigPerspective( variantRuleData );
        fscContext.currentConfigPerspective = configPerspective;
    }
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * Reset SettingsCache
 * This is called when Settings panel is closed
 */
export let settingsClose = function() {
    // Clear cache
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    // Undefined check is needed as fscContext may be undefined when closing all dialogs (including SettingsPanel)
    if( fscContext ) {
        delete fscContext.settingsCache;
        appCtxSvc.updateCtx( 'fscContext', fscContext );
    }
};

/**
 * Extract the info from the response string after retrieving the setting data from the server
 * SOA call response contains LOVs only
 * @param {Object} response - The SOA call response
 * @returns {Object} settingsData to initialize fscContext.settingsMO
 */
export let initSettingsLOVs = function( response ) {
    var settingsMO = {
        pca0ValidationLevelLOV: {},
        pca0ExpansionLevelLOV: {},
        pca0IntentsLOV: {}
    };

    if( response ) {
        // LOVs
        var validationLevelLOVs = JSON.parse( response.responseInfo.pca0ValidationLevelLOV[ 0 ] );
        settingsMO.pca0ValidationLevelLOV = validationLevelLOVs;

        var expansionLevelLOVs = JSON.parse( response.responseInfo.pca0ExpansionLevelLOV[ 0 ] );
        settingsMO.pca0ExpansionLevelLOV = expansionLevelLOVs;

        // intents is not in 1905, needs to be added back in when the response is correct
        // var intents = JSON.parse( response.responseInfo.pca0IntentsLOV[ 0 ] );
        // settingsMO.pca0IntentsLOV = intents;

        var profilesLOV = JSON.parse( response.responseInfo.pca0SolverProfilesLOV[ 0 ] );
        settingsMO.solverProfilesLOV = profilesLOV;
        _.forEach( settingsMO.solverProfilesLOV, function( profile ) { configuratorUtils.localizeValidationProfileNames( profile ); } );

        // Save flag for future display of Setting Panel: SOA call must be made on first loading only
        // After that, value is locally synced in local settingsCache
        settingsMO.lovsFetched = true;
    }
    return settingsMO;
};

/**
 * Initialize UI and cached values for Profile Settings from Active Profile
 * @param {Object} data - The ViewModel object
 * @return {Object} Solver Profile info container
 */
export let initializeValidationUI = function( data ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsMO = fscContext.settingsMO;
    var settingsCache = { ...fscContext.settingsCache };

    // Build dropdown list of Profiles
    var profileList = [];
    var profiles = fscContext.settingsMO.solverProfilesLOV;
    for( var profileIdx in profiles ) {
        var profile = profiles[ profileIdx ];
        profileList.push( {
            propInternalValue: profile.pca0ProfileName,
            propDisplayValue: profile.profileDisplayName
        } );
    }

    // Use Active settings to setup local cache and dataModel properties but if already changed, use the previous set ones
    var validationProfile;
    if( fscContext.settingsCache.profileSettingsDirty ) {
        validationProfile = fscContext.settingsCache.profileSettings;
    } else {
        validationProfile = fscContext.appliedSettings.validationProfile;
    }

    // Active profile mode might be Custom (not in list)
    // Add Custom if needed
    if( validationProfile.pca0ProfileName === 'pca0Custom' ) {
        profileList.push( {
            propInternalValue: validationProfile.pca0ProfileName,
            propDisplayValue: validationProfile.profileDisplayName
        } );
    }
    var profileProp = { ...data.profileProp };
    profileProp.dbValue = validationProfile.pca0ProfileName;
    profileProp.uiValue = _.find( profileList, { propInternalValue: profileProp.dbValue } ).propDisplayValue;

    // Initialize cached value for selected Profile Name
    settingsCache.profileSettings.pca0ProfileName = validationProfile.pca0ProfileName;
    settingsCache.profileSettings.profileDisplayName = validationProfile.profileDisplayName;

    var validationSeverityLabel = { ...data.validationSeverityLabel };
    validationSeverityLabel.isRequired = _profileSettingsEditable;
    var expansionSeverityLabel = { ...data.expansionSeverityLabel };
    expansionSeverityLabel.isRequired = _profileSettingsEditable;
    let productHierarchyDepthLabel = { ...data.productHierarchyDepthLabel };
    productHierarchyDepthLabel.isRequired = _profileSettingsEditable;
    var selectionBehaviorLabel = { ...data.selectionBehaviorLabel };
    selectionBehaviorLabel.isRequired = _profileSettingsEditable;

    var contentConfigurationLabel = { ...data.contentConfigurationLabel };
    var expansionBehaviorLabel = { ...data.expansionBehaviorLabel };
    contentConfigurationLabel.isRequired = _profileSettingsEditable;
    expansionBehaviorLabel.isRequired = _profileSettingsEditable;

    // Validation Severity
    // Set initial selection and initialize cache value
    var valLevelUID = validationProfile.pca0ValidationSeverity;
    var validationSeverityProperties = [];
    var validationLevelLOV = settingsMO.pca0ValidationLevelLOV.lovValues;
    if( validationLevelLOV ) {
        for( var lovValRow in validationLevelLOV ) {
            if( validationLevelLOV.hasOwnProperty( lovValRow ) ) {
                var uid = validationLevelLOV[ lovValRow ].uid;
                var displayValue = validationLevelLOV[ lovValRow ].propDisplayValues.lov_values[ 0 ];
                var checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Validation Severity
                    Number( uid ) >= Number( valLevelUID ), // DB value
                    '' ); // displayValuesIn
                checkBoxProperty.isEnabled = _profileSettingsEditable;
                checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                checkBoxProperty.propInternalVal = uid;
                validationSeverityProperties.push( checkBoxProperty );
            }
        }
    }
    settingsCache.profileSettings.pca0ValidationSeverity = valLevelUID;

    // Expansion Severity
    // Set initial selection and initialize cache value
    var expLevelUID = validationProfile.pca0ExpansionSeverity;
    var expansionSeverityProperties = [];
    var expansionLevelLOV = settingsMO.pca0ExpansionLevelLOV.lovValues;
    if( expansionLevelLOV ) {
        for( var lovExpRow in expansionLevelLOV ) {
            if( expansionLevelLOV.hasOwnProperty( lovExpRow ) ) {
                var uid = expansionLevelLOV[ lovExpRow ].uid;
                var displayValue = expansionLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                var checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Validation Severity
                    Number( uid ) >= Number( expLevelUID ), // DB value
                    '' ); // displayValuesIn

                // Checkbox for expansion is enabled if profile allows for it
                // and if ValidationSeverity value is higher than that
                checkBoxProperty.isEnabled = _profileSettingsEditable && Number( valLevelUID ) >= Number( uid );
                checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                checkBoxProperty.propInternalVal = uid;
                expansionSeverityProperties.push( checkBoxProperty );
            }
        }
    }
    settingsCache.profileSettings.pca0ExpansionSeverity = expLevelUID;

    // Allow Multiple Selections
    // Set initial selection and initialize cache value
    var allowMultipleSelections = { ...data.allowMultipleSelections };
    allowMultipleSelections.dbValue = validationProfile.pca0AllowMultipleSelections === 'true';
    allowMultipleSelections.isEnabled = _profileSettingsEditable;
    allowMultipleSelections.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0AllowMultipleSelections = validationProfile.pca0AllowMultipleSelections;

    var applyConstraints = { ...data.applyConstraints };
    // Initialize pca0ApplyConstraints and pca0AllowValidationRulesToExpand only if platform supported

    // Apply Constraints
    // Set initial selection and initialize cache value
    applyConstraints.dbValue = validationProfile.pca0ApplyConstraints === 'true';
    applyConstraints.isEnabled = _profileSettingsEditable;
    applyConstraints.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0ApplyConstraints = validationProfile.pca0ApplyConstraints;

    // Explicit content configuration
    let enableExplicitContentConfiguration = { ...data.enableExplicitContentConfiguration };
    enableExplicitContentConfiguration.dbValue = validationProfile.pca0EnableExplicitContentConfiguration === 'true';
    enableExplicitContentConfiguration.isEnabled = _profileSettingsEditable;
    enableExplicitContentConfiguration.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0EnableExplicitContentConfiguration = validationProfile.pca0EnableExplicitContentConfiguration;

    // Allow Validation Rules to Expand
    var allowValidationRulesToExpand = { ...data.allowValidationRulesToExpand };
    allowValidationRulesToExpand.dbValue = validationProfile.pca0AllowValidationRulesToExpand === 'true';
    allowValidationRulesToExpand.isEnabled = _profileSettingsEditable;
    allowValidationRulesToExpand.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0AllowValidationRulesToExpand = validationProfile.pca0AllowValidationRulesToExpand;

    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );

    return {
        profileList: profileList,
        profileProp: profileProp,
        validationSeverityLabel: validationSeverityLabel,
        expansionSeverityLabel: expansionSeverityLabel,
        productHierarchyDepthLabel: productHierarchyDepthLabel,
        selectionBehaviorLabel: selectionBehaviorLabel,
        contentConfigurationLabel: contentConfigurationLabel,
        expansionBehaviorLabel: expansionBehaviorLabel,
        validationSeverityProperties: validationSeverityProperties,
        expansionSeverityProperties: expansionSeverityProperties,
        allowMultipleSelections: allowMultipleSelections,
        allowValidationRulesToExpand: allowValidationRulesToExpand,
        applyConstraints: applyConstraints,
        enableExplicitContentConfiguration: enableExplicitContentConfiguration
    };
};

/**
 * Update Settings cache for selected Validation Mode
 * Update visibility and values for Validation UI
 * @param {Object} data - The ViewModel object
 */
export let handleProfileSelectionChange = function( data ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsCache = { ...fscContext.settingsCache };
    var validationProfile = _.find( fscContext.settingsMO.solverProfilesLOV, { pca0ProfileName: data.profileProp.dbValue } );

    settingsCache.profileSettings.pca0ProfileName = validationProfile.pca0ProfileName;
    settingsCache.profileSettings.profileDisplayName = validationProfile.profileDisplayName;

    // Validation Severity
    // Update cache and tune settings for loaded ValidationSeverity properties (checkboxes)
    var valLevelUID = validationProfile.pca0ValidationSeverity;
    settingsCache.profileSettings.pca0ValidationSeverity = valLevelUID;

    // Rebuild list
    var validationSeverityProperties = refreshValidationSeverity();

    // Expansion Severity
    // Update cache and tune settings for loaded ExpansionSeverity properties (checkboxes)
    settingsCache.profileSettings.pca0ExpansionSeverity = validationProfile.pca0ExpansionSeverity;

    // Rebuild list
    var expansionSeverityProperties = refreshExpansionSeverity();

    // Allow Multiple Selections
    var allowMultipleSelections = { ...data.allowMultipleSelections };
    allowMultipleSelections.dbValue = validationProfile.pca0AllowMultipleSelections === 'true';
    allowMultipleSelections.isEnabled = _profileSettingsEditable;
    allowMultipleSelections.isEditable = _profileSettingsEditable;

    // Initialize cached value for AllowMultipleSelections
    settingsCache.profileSettings.pca0AllowMultipleSelections = validationProfile.pca0AllowMultipleSelections;

    var applyConstraints = { ...data.applyConstraints };

    // Apply Constraints
    applyConstraints.dbValue = validationProfile.pca0ApplyConstraints === 'true';
    applyConstraints.isEnabled = _profileSettingsEditable;
    applyConstraints.isEditable = _profileSettingsEditable;

    // Initialize cached value for ApplyConstraints
    settingsCache.profileSettings.pca0ApplyConstraints = validationProfile.pca0ApplyConstraints;

    // Explicit content configuration
    var enableExplicitContentConfiguration = { ...data.enableExplicitContentConfiguration };
    enableExplicitContentConfiguration.dbValue = validationProfile.pca0EnableExplicitContentConfiguration === 'true';
    enableExplicitContentConfiguration.isEnabled = _profileSettingsEditable;
    enableExplicitContentConfiguration.isEditable = _profileSettingsEditable;

    // Initialize cached value for explicit content configuration
    settingsCache.profileSettings.pca0EnableExplicitContentConfiguration = validationProfile.pca0EnableExplicitContentConfiguration;

    // Allow Validation Rules to Expand
    data.allowValidationRulesToExpand.dbValue = validationProfile.pca0AllowValidationRulesToExpand === 'true';
    data.allowValidationRulesToExpand.isEnabled = _profileSettingsEditable;
    data.allowValidationRulesToExpand.isEditable = _profileSettingsEditable;

    // Initialize cached value for AllowValidationRulesToExpand
    settingsCache.profileSettings.pca0AllowValidationRulesToExpand = validationProfile.pca0AllowValidationRulesToExpand;

    // Process isDirty Profile Settings
    settingsCache.profileSettingsDirty = !_.isEqual( settingsCache.profileSettings, fscContext.appliedSettings.validationProfile );
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );

    return {
        validationSeverityProperties: validationSeverityProperties,
        expansionSeverityProperties: expansionSeverityProperties,
        allowMultipleSelections: allowMultipleSelections,
        applyConstraints: applyConstraints,
        enableExplicitContentConfiguration: enableExplicitContentConfiguration
    };
};

/**
 * Handle change of selection for Validation Severity
 * @param {Object} prop - The clicked object
 * @param {Object} data - The ViewModel object
 */
export let handleValidationSeveritySelectionChange = function( prop, data ) {
    // This method is called only for testing purposes
    // By default, all profile entries are read only (value of _profileSettingsEditable)

    // Actions needed:
    // - Update Settings cache for selected Validation Severity - De-select is not allowed
    // - Update "checked" values for Validation Severity UI based on value checked by user:
    // - e.g. if Warning is checked, select it and Error too, de-select all others
    //
    // - Refresh expansion severity
    // - process isDirty profile settings

    var checkedValidationSeverity = prop.propInternalVal;

    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsMO = fscContext.settingsMO;
    var settingsCache = { ...fscContext.settingsCache };
    settingsCache.profileSettings.pca0ValidationSeverity = checkedValidationSeverity;

    // Rebuild list
    var validationSeverityProperties = refreshValidationSeverity();

    // Update expansion allowed values and update selection if not compatible;
    // i.e. for selected Error Validation level, all Expansion levels are available
    // for Information Validation level, only Expansion levels of default and below are available
    if( settingsCache.profileSettings.pca0ExpansionSeverity > settingsCache.profileSettings.pca0ValidationSeverity ) {
        // Selection is invalid: Expansion Severity is not compatible
        // Set it to Validation Severity
        settingsCache.profileSettings.pca0ExpansionSeverity = settingsCache.profileSettings.pca0ValidationSeverity;
    }

    // Rebuild list
    var expansionSeverityProperties = refreshExpansionSeverity();

    // Process isDirty Profile Settings
    settingsCache.profileSettingsDirty = !_.isEqual( settingsCache.profileSettings, fscContext.appliedSettings.validationProfile );
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );

    return {
        validationSeverityProperties: validationSeverityProperties,
        expansionSeverityProperties: expansionSeverityProperties
    };
};

/**
 * Handle change of selection for Expansion Severity
 * @param {Object} prop - The clicked object
 * @param {Object} data - The ViewModel object
 */
export let handleExpansionSeveritySelectionChange = function( prop, data ) {
    // This method is called only for testing purposes
    // By default, all profile entries are read only (value of _profileSettingsEditable)

    // Actions needed:
    // - Update Settings cache for selected Expansion Severity - De-select is not allowed
    // - Update "checked" values for Expansion Severity UI based on value checked by user:
    // - e.g. if Warning is checked, select it and Error too, de-select all others
    //
    // - process isDirty profile settings

    var checkedExpansionSeverity = prop.propInternalVal;

    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var settingsCache = { ...fscContext.settingsCache };
    settingsCache.profileSettings.pca0ExpansionSeverity = checkedExpansionSeverity;

    // Rebuild list
    var expansionSeverityProperties = refreshExpansionSeverity();

    // Process isDirty Profile Settings
    settingsCache.profileSettingsDirty = !_.isEqual( settingsCache.profileSettings, fscContext.appliedSettings.validationProfile );
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
    return {
        expansionSeverityProperties: expansionSeverityProperties
    };
};

/**
 * Prepare JSON for the SOA input call, containing values of fscContext config settings (filter criteria)
 * @param {Object} variantRuleData variantRuleData atomic data
 * @returns {String} stringified object for saving
 */
export let getFilterCriteriaToApply = function( variantRuleData ) {
    var inputData = {
        type: 'Pca0ConfigSetting',
        uid: 'uid_config_setting'
    };

    // Get properties from Configuration subpanel "Filter Criteria", formatted for Server-side processing
    // [Revision Rule, Effectivity, Rule Date]
    var filterCriteriaProps = Pca0FilterCriteriaSettingsService.getFilterCriteriaToApply( variantRuleData );

    // Local copy of SOA input: it will be used to match with response
    inputData.props = filterCriteriaProps;
    return JSON.stringify( inputData );
};

/**
 * Process SOA response after Apply settings
 * SOA response contains only Filter Criteria
 * Update Filter Criteria based on applied config settings from server
 * Update Profile Settings based on cached value
 * Process isDirty flag for current configuration
 * Fire events to trigger Refresh of views to reflect new set of settings
 * Clear cached data: settingsCache and cache of Incomplete Families
 * @param {Object} response - The SOA call response
 */
export let handleUpdateSettings = function( response ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var oldConfigSettings = fscContext.appliedSettings.configSettings;
    var settingsCache = { ...fscContext.settingsCache };
    fscContext.reassessSelections = true;

    // Check if Profile Settings feature is supported
    var isValidationModeInitialized = !_.isUndefined( fscContext.appliedSettings.validationProfile );

    // Stop in case error occurred (e.g. RuleDate set to future)
    if( !response.responseInfo || !response.responseInfo.configSettings ) {
        // An error occurred while applying settings, e.g. Rule date is a future date
        var notificationMessage = configuratorUtils.getFscLocaleTextBundle().applySettingsError;
        configuratorUtils.showNotificationMessage( notificationMessage, 'ERROR' );
        return;
    }

    // Reset applied Settings based on SOA response
    fscContext.appliedSettings = {};

    // Profile Settings
    // Update active profile settings (if profile settings feature is supported)
    // Note: Profile settings are not sent to server while applying config settings (filter criteria).
    // Rather, they are saved locally and sent to server whenever a SOA call is made
    // Update of local copy of profile Settings happens here, where changes to Config Settings (Filter Criteria)
    // have been applied and saved to ConfigPerspective in server
    if( isValidationModeInitialized ) {
        fscContext.appliedSettings.validationProfile = _.cloneDeep( settingsCache.profileSettings );
    }

    // Filter Criteria
    // responseInfo.configSettings contains updated information about Filter criteria from perspective
    // (Revision Rule, Rule Date and Effectivity Date/Unit range)
    fscContext.appliedSettings.configSettings = JSON.parse( response.responseInfo.configSettings[ 0 ] );

    if( settingsCache.ruleDateTranslationMode ) {
        // Set Rule Translation Mode to the Mode that was cached earlier
        // NOTE- We do not send rule date translation mode to server in case of apply settings
        // Only in the case of Save/ Save As, the rule date translation bit is sent to server
        fscContext.appliedSettings.ruleDateTranslationMode = settingsCache.ruleDateTranslationMode;
    }

    // Process isDirty flag
    // ProfileSettingsDirty has been already processed from user's selections in Settings Panel
    // Actual changes in Filter Criteria need to be analyzed: it is possible that some updates were not applied
    // For instance, Rule Date might have not changed as requested

    if( /*Revision Rule*/
        fscContext.appliedSettings.configSettings.props.pca0RevisionRule.dbValues[ 0 ] !== oldConfigSettings.props.pca0RevisionRule.dbValues[ 0 ] ||
        /*Effectivity*/
        fscContext.appliedSettings.configSettings.props.pca0Effectivity.dbValues[ 0 ] !== oldConfigSettings.props.pca0Effectivity.dbValues[ 0 ] ||
        /*Rule Date */
        fscContext.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ] !== oldConfigSettings.props.pca0RuleDate.dbValues[ 0 ] ) {
        settingsCache.filterCriteriaChanged = true;
    }

    // Compare cached values with selected Profile Settings: set dirty SVR in case of mismatch
    if( settingsCache.profileSettingsDirty || settingsCache.filterCriteriaChanged ) {
        fscContext.settingsChanged = true;
        var eventData = {
            variantRulePanelDirty: true,
            selectedCtx: Pca0Constants.FSC_CONTEXT
        };
        eventBus.publish( 'customVariantRule.variantRuleDirty', eventData );
    } else {
        fscContext.settingsChanged = false;
    }

    // NOTE: revRule on context is a transient UID
    // this doesn't match with persistentUIDs in RevisionRule dropwdown
    // We need to keep track of selected revRule UID that's been applied
    // This is to:
    // - allow currently active revision Rule to be highlighted in the dropdown
    // --- for when Settings Panel is closed (i.e. settingsCache is reset)
    if( !_.isUndefined( settingsCache.selectedRevisionRule ) ) {
        fscContext.lastAppliedRevisionRuleUid = settingsCache.selectedRevisionRule.uid;
    }

    // Clear cache
    configuratorUtils.initializeCache( Pca0Constants.FSC_CONTEXT );

    // After applying Settings, reset cache of Incomplete Families and reset active family
    Pca0IncompleteFamiliesService.resetIncompleteFamiliesCache( fscContext, undefined );

    delete fscContext.payloadStrings;

    // Delete currentScope: this will force to load Configuration Data and 1st scope information
    delete fscContext.currentScope;
    delete fscContext.currentScopeName;

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

    // Event is fired to trigger scopes reload
    // Note: new platform changes will prevent groups to be considered out
    // So there will be soon no longer need to reload all scopes, but just features
    // re-target this event handling to load features
    //maria: we should not fire multiple events that have effects on the same code
    eventBus.publish( 'Pca0Scopes.clearScopesViolations' );
    eventBus.publish( 'Pca0Features.removeViolationsFromAllGroupLevel' );
    eventBus.publish( 'Pca0Settings.applySettings' );

    // Close dialog
    eventBus.publish( 'Pca0Settings.closeDialog' );
};

/**
 * The method will pop up the switch Configuration Mode Confirmation to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 */
export let switchConfigurationMode = function() {
    var msg = configuratorUtils.getFscLocaleTextBundle().switchConfigurationModeConfirmation;
    var cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    var proceedString = configuratorUtils.getFscLocaleTextBundle().applyCmd;
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
            eventBus.publish( 'Pca0Settings.applySettingsToServer' );
        }

    }
    ];
    messagingService.showWarning( msg, buttons );
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
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    if( variantRuleData ) {
        return configuratorUtils.getFscConfigPerspective( variantRuleData );
    }
    //if we lost the initial props due to panel being replaced and coming now from a rule date subpanel for example
    //use the stored config perspective on appctx
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    return fscContext.currentConfigPerspective;
};

/**
 * Return input view name as active component to be set for navigation
 * @param {String} subView view name
 * @returns {String} active view
 */
export let setActiveView = subView => {
    return subView;
};

/**
 * Initialize layout settings for VCV
 * @param {Object} settingsFields - Object containing setting fields to be initialized in the Settings Panel
 * @returns {Object} Layout settings vmData
 */
export const initVCVLayoutViewSettings = ( settingsFields ) => {
    const viewSettings = pca0CommonUtils.vcvViewSettings();
    // Iterate over all the settingFields, if the field is present in the viewSettings object, update the settingField with
    // the value from the viewSettings object
    Object.keys( settingsFields ).forEach( settingsFieldKey => {
        let settingsField = settingsFields[settingsFieldKey];
        if ( settingsField && viewSettings.hasOwnProperty( settingsFieldKey ) ) {
            settingsField.update( viewSettings[settingsFieldKey] );
        }
    } );
    const nameWidthDBValue = viewSettings.featureWidth;
    let borderSliderValue;
    let featureNameWidthSliderValue;
    let nameWidthUIValue;

    const widthValue = ( dbValue ) => {
        const widthData = {
            uiValue: '',
            sliderValue: ''
        };
        if ( dbValue === 'small' ) {
            widthData.uiValue = configuratorUtils.getFscLocaleTextBundle().smallText;
            widthData.sliderValue = sliderPos.MIN;
        } else if ( dbValue === 'medium' ) {
            widthData.uiValue = configuratorUtils.getFscLocaleTextBundle().mediumText;
            widthData.sliderValue = sliderPos.MEDIUM;
        } else {
            widthData.uiValue = configuratorUtils.getFscLocaleTextBundle().largeText;
            widthData.sliderValue = sliderPos.MAX;
        }
        return widthData;
    };

    const nameData = widthValue( nameWidthDBValue );
    featureNameWidthSliderValue = nameData.sliderValue;
    nameWidthUIValue = nameData.uiValue;

    return {
        nameWidthDBValue,
        nameWidthUIValue,
        featureNameWidthSliderValue,
        borderSliderValue
    };
};

/**
 * Updates view settings in preference
 * @param {Object} data vmData of TEXT view settings section
 * @returns {Object} settings data
 */
export const updateTextViewSettings = ( data ) => {
    const currentViewSettings = pca0CommonUtils.vcvViewSettings();
    const newViewSettings = {
        featureWidth: data.featureWidth.dbValue, // small, medium, large
        showFeatureSideBySide: data.showFeatureSideBySide.dbValue,
        showCompressedData: data.showCompressedData.dbValue, // for compact mode
        showGroupsAsTab: data.showGroupsAsTab.dbValue
    };
    if ( !_.isEqual( currentViewSettings, newViewSettings ) ) {
        const preferenceStrings = [];

        for ( let [ key, value ] of Object.entries( newViewSettings ) ) {
            preferenceStrings.push( key + ':' + value );
        }

        appCtxSvc.updatePartialCtx( 'preferences.PCA_vcv_layout_settings', preferenceStrings );
        appCtxSvc.updatePartialCtx( Pca0Constants.FSC_CONTEXT + '.vcvLayoutSettings', newViewSettings );
        eventBus.publish( 'Pca0Features.updateLayoutSettings', newViewSettings );
        if ( currentViewSettings.showCompressedData !== newViewSettings.showCompressedData && !newViewSettings.showCompressedData ) {
            // When compact mode is turned off, we need to switch to normal mode and need to call extra SOA to fetch the thumbnail data.
            eventBus.publish( 'Pca0Features.toggleCompactMode', { isCompactMode: newViewSettings.showCompressedData } );
        }
    }

    return {
        nameWidthDBValue: data.featureWidth.dbValue,
        nameWidthUIValue: data.featureWidth.uiValue
    };
};

export default exports = {
    settingsReveal,
    settingsClose,
    initSettingsLOVs,
    initializeValidationUI,
    handleProfileSelectionChange,
    handleValidationSeveritySelectionChange,
    handleExpansionSeveritySelectionChange,
    getFilterCriteriaToApply,
    handleUpdateSettings,
    switchConfigurationMode,
    convertSelectedExpressionJsonObjectToString,
    getConfigPerspective,
    setActiveView,
    initVCVLayoutViewSettings,
    updateTextViewSettings
};
