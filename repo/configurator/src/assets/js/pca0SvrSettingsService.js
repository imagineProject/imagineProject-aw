// Copyright (c) 2024 Siemens

/**
 * @module js/pca0SvrSettingsService
 */
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import Pca0SvrFilterCriteriaSettingsService from 'js/pca0SvrFilterCriteriaSettingsService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';


/** Testing variable to show ReadOnly/Editable profile settings
 * By default, solver profile entries are read-only
 */
const _profileSettingsEditable = false;

let exports = {};

/**
 * Initialize the main settings panel with the data from props into atomic data that can be set from its children.
 * @param {Object} svrSettingsFromProps - the passed in settings from the props
 * @param {Object} svrSettingsAtomicData - the atomic data that will be updated
 * @param {String} caption - the localized caption
 * @param {String} displayName - the display name of the panel
 * @returns {String} caption - the caption for the command panel
 */
export let initSvrSettings = function( svrSettingsFromProps, svrSettingsAtomicData, displayName ) {
    let svrSettings =  { ...svrSettingsAtomicData.getAtomicData() };
    svrSettings.settingsMO = svrSettingsFromProps.settingsMO;
    svrSettings.isLOVRevRuleDataCached = svrSettingsFromProps.isLOVRevRuleDataCached;
    svrSettings.appliedSettings = svrSettingsFromProps.appliedSettings;
    svrSettings.appliedSettings.configSettings = svrSettingsFromProps.configSettings;
    svrSettings.configPerspective = svrSettingsFromProps.configPerspective;
    svrSettingsAtomicData.setAtomicData( svrSettings );
    //returns the label for the command panel
    return displayName;
};

/**
 * Initialize Settings Cache
 * @param {Object} svrSettingsAtomicData - svrSettingsAtomicData
 */
export let initializeSettingsCache = function(  svrSettingsAtomicData ) {
    let svrSettings =  { ...svrSettingsAtomicData.getValue() };
    let settingsCache = {
        effectivityInfo: {
            currentStartEffDates: { dbValues: [ '' ] },
            currentEndEffDates: { dbValues: [ '' ] },
            currentStartEffUnits: { dbValues: [ '-1' ] },
            currentEndEffUnits: { dbValues: [ '-1' ] }
        },
        ruleDateTranslationMode:'',
        filterCriteriaModified: false,
        profileSettingsDirty: false,
        profileSettings: {}
    };
    svrSettings.settingsCache = settingsCache;
    svrSettingsAtomicData.update( svrSettings );
};

/**
 * Initialize effectivity
 * Based on values from settings or settingsMO, populate settingsCache
 * @param {Object} svrSettingsAtomicData : svrSettingsAtomicData
 */
export let initializeEffectivity = function(  svrSettingsAtomicData ) {
    Pca0SvrFilterCriteriaSettingsService.initializeEffectivity( svrSettingsAtomicData );
};

/**
 * Extract the info from the response string after retrieving the setting data from the server
 * SOA call response contains LOVs only
 * @param {Object} response - The SOA call response
 * @param {Object} svrSettingsAtomicData svrSettingsAtomicData
 */
export let initSettingsLOVs = function( response, svrSettingsAtomicData ) {
    let settingsMO = {
        pca0ValidationLevelLOV: {},
        pca0ExpansionLevelLOV: {},
        pca0IntentsLOV: {}
    };
    let svrSettings = { ...svrSettingsAtomicData.getValue() };

    if( response ) {
        // LOVs
        let validationLevelLOVs = JSON.parse( response.responseInfo.pca0ValidationLevelLOV[ 0 ] );
        settingsMO.pca0ValidationLevelLOV = validationLevelLOVs;

        let expansionLevelLOVs = JSON.parse( response.responseInfo.pca0ExpansionLevelLOV[ 0 ] );
        settingsMO.pca0ExpansionLevelLOV = expansionLevelLOVs;
        let profilesLOV = JSON.parse( response.responseInfo.pca0SolverProfilesLOV[ 0 ] );
        settingsMO.solverProfilesLOV = profilesLOV;
        _.forEach( settingsMO.solverProfilesLOV, function( profile ) { configuratorUtils.localizeValidationProfileNames( profile ); } );

        // Save flag for future display of Setting Panel: SOA call must be made on first loading only
        // After that, value is locally synced in local settingsCache
        settingsMO.lovsFetched = true;
    }
    svrSettings.settingsMO = settingsMO;
    svrSettingsAtomicData.update( svrSettings );
};

/**
 * Initialize UI and cached values for Profile Settings from Active Profile
* @param {Object} svrSettingsAtomicData - svrSettingsAtomicData object
* @param {Object} profileList - Profile List
* @param {Object} profileProp - Profile Property
* @param {Object} validationSeverityLabel - Validation Severity Label
* @param {Object} expansionSeverityLabel - Expansion Severity Label
* @param {Object} productHierarchyDepthLabel - Product Hierarchy Depth Label
* @param {Object} selectionBehaviorLabel - Selection Behavior Label
* @param {Object} contentConfigurationLabel - Content Configuration Label
* @param {Object} expansionBehaviorLabel - Expansion Behavior Label
* @param {Object} validationSeverityProperties - Validation Severity Properties
* @param {Object} expansionSeverityProperties - Expansion Severity Properties
* @param {Object} allowValidationRulesToExpand - Allow Validation Rules to Expand
* @param {Object} allowMultipleSelections - Allow Multiple Selections
* @param {Object} applyConstraints - Apply Constraints
* @param {Object} enableExplicitContentConfiguration - Enable Explicit Content Configuration
* @return {Object} modified info container for the props driving the UI
 */
export let initializeValidationUI = function( svrSettingsAtomicData,
    profileList, profileProp, validationSeverityLabel, expansionSeverityLabel, productHierarchyDepthLabel, selectionBehaviorLabel,
    contentConfigurationLabel, expansionBehaviorLabel, validationSeverityProperties, expansionSeverityProperties, allowValidationRulesToExpand, allowMultipleSelections,
    applyConstraints, enableExplicitContentConfiguration ) {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };

    let settingsMO = svrSettings.settingsMO;
    let settingsCache = { ...svrSettings.settingsCache };
    let appliedSettings =  { ...svrSettings.appliedSettings };

    // Build dropdown list of Profiles
    let profileListCopy = [];
    let profiles = settingsMO.solverProfilesLOV;
    for( let profileIdx in profiles ) {
        let profile = profiles[ profileIdx ];
        profileListCopy.push( {
            propInternalValue: profile.pca0ProfileName,
            propDisplayValue: profile.profileDisplayName
        } );
    }

    // Use Active settings to setup local cache and dataModel properties but if already changed, use the previous set ones
    let validationProfile;
    if( settingsCache.profileSettingsDirty ) {
        validationProfile = settingsCache.profileSettings;
    } else {
        validationProfile = appliedSettings.validationProfile;
    }

    // Active profile mode might be Custom (not in list)
    // Add Custom if needed
    if( validationProfile.pca0ProfileName === 'pca0Custom' ) {
        profileListCopy.push( {
            propInternalValue: validationProfile.pca0ProfileName,
            propDisplayValue: validationProfile.profileDisplayName
        } );
    }
    let profilePropCopy = { ...profileProp };
    profilePropCopy.dbValue = validationProfile.pca0ProfileName;
    profilePropCopy.uiValue = _.find( profileListCopy, { propInternalValue: validationProfile.pca0ProfileName } ).propDisplayValue;

    // Initialize cached value for selected Profile Name
    settingsCache.profileSettings.pca0ProfileName = validationProfile.pca0ProfileName;
    settingsCache.profileSettings.profileDisplayName = validationProfile.profileDisplayName;

    let validationSeverityLabelCopy = { ...validationSeverityLabel };
    validationSeverityLabelCopy.isRequired = _profileSettingsEditable;
    let expansionSeverityLabelCopy = { ...expansionSeverityLabel };
    expansionSeverityLabelCopy.isRequired = _profileSettingsEditable;
    let productHierarchyDepthLabelCopy = { ...productHierarchyDepthLabel };
    productHierarchyDepthLabelCopy.isRequired = _profileSettingsEditable;
    let selectionBehaviorLabelCopy = { ...selectionBehaviorLabel };
    selectionBehaviorLabelCopy.isRequired = _profileSettingsEditable;
    let contentConfigurationLabelCopy = { ...contentConfigurationLabel };
    contentConfigurationLabelCopy.isRequired = _profileSettingsEditable;
    let expansionBehaviorLabelCopy = { ...expansionBehaviorLabel };
    expansionBehaviorLabelCopy.isRequired = _profileSettingsEditable;

    // Validation Severity
    // Set initial selection and initialize cache value
    let valLevelUID = validationProfile.pca0ValidationSeverity;
    let validationSeverityPropertiesCopy = [];
    let validationLevelLOV = settingsMO.pca0ValidationLevelLOV.lovValues;
    if( validationLevelLOV ) {
        for( let lovValRow in validationLevelLOV ) {
            if( validationLevelLOV.hasOwnProperty( lovValRow ) ) {
                let uid = validationLevelLOV[ lovValRow ].uid;
                let displayValue = validationLevelLOV[ lovValRow ].propDisplayValues.lov_values[ 0 ];
                let checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Validation Severity
                    Number( uid ) >= Number( valLevelUID ), // DB value
                    '' ); // displayValuesIn
                checkBoxProperty.isEnabled = _profileSettingsEditable;
                checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
                checkBoxProperty.propInternalVal = uid;
                validationSeverityPropertiesCopy.push( checkBoxProperty );
            }
        }
    }
    settingsCache.profileSettings.pca0ValidationSeverity = valLevelUID;

    // Expansion Severity
    // Set initial selection and initialize cache value
    let expLevelUID = validationProfile.pca0ExpansionSeverity;
    let expansionSeverityPropertiesCopy = [];
    let expansionLevelLOV = settingsMO.pca0ExpansionLevelLOV.lovValues;
    if( expansionLevelLOV ) {
        for( let lovExpRow in expansionLevelLOV ) {
            if( expansionLevelLOV.hasOwnProperty( lovExpRow ) ) {
                let uid = expansionLevelLOV[ lovExpRow ].uid;
                let displayValue = expansionLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                let checkBoxProperty = uwPropertyService.createViewModelProperty(
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
                expansionSeverityPropertiesCopy.push( checkBoxProperty );
            }
        }
    }
    settingsCache.profileSettings.pca0ExpansionSeverity = expLevelUID;

    // Allow Multiple Selections
    // Set initial selection and initialize cache value
    let allowMultipleSelectionsCopy = { ...allowMultipleSelections };
    allowMultipleSelectionsCopy.dbValue = validationProfile.pca0AllowMultipleSelections === 'true';
    allowMultipleSelectionsCopy.isEnabled = _profileSettingsEditable;
    allowMultipleSelectionsCopy.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0AllowMultipleSelections = validationProfile.pca0AllowMultipleSelections;

    let applyConstraintsCopy = { ...applyConstraints };
    // Initialize pca0ApplyConstraints and pca0AllowValidationRulesToExpand only if platform supported
    // Apply Constraints
    // Set initial selection and initialize cache value
    applyConstraintsCopy.dbValue = validationProfile.pca0ApplyConstraints === 'true';
    applyConstraintsCopy.isEnabled = _profileSettingsEditable;
    applyConstraintsCopy.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0ApplyConstraints = validationProfile.pca0ApplyConstraints;

    // Explicit content configuration
    let enableExplicitContentConfigurationCopy = { ...enableExplicitContentConfiguration };
    enableExplicitContentConfigurationCopy.dbValue = validationProfile.pca0EnableExplicitContentConfiguration === 'true';
    enableExplicitContentConfigurationCopy.isEnabled = _profileSettingsEditable;
    enableExplicitContentConfigurationCopy.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0EnableExplicitContentConfiguration = validationProfile.pca0EnableExplicitContentConfiguration;

    // Allow Validation Rules to Expand
    let allowValidationRulesToExpandCopy = { ...allowValidationRulesToExpand };
    allowValidationRulesToExpandCopy.dbValue = validationProfile.pca0AllowValidationRulesToExpand === 'true';
    allowValidationRulesToExpandCopy.isEnabled = _profileSettingsEditable;
    allowValidationRulesToExpandCopy.isEditable = _profileSettingsEditable;
    settingsCache.profileSettings.pca0AllowValidationRulesToExpand = validationProfile.pca0AllowValidationRulesToExpand;


    if( appliedSettings.ruleDateTranslationMode ) {
        settingsCache.ruleDateTranslationMode = appliedSettings.ruleDateTranslationMode;
    }
    svrSettings.settingsCache = settingsCache;
    svrSettingsAtomicData.update( svrSettings );

    return {
        profileList: profileListCopy,
        profileProp: profilePropCopy,
        validationSeverityLabel: validationSeverityLabelCopy,
        expansionSeverityLabel: expansionSeverityLabelCopy,
        productHierarchyDepthLabel: productHierarchyDepthLabelCopy,
        selectionBehaviorLabel: selectionBehaviorLabelCopy,
        contentConfigurationLabel: contentConfigurationLabelCopy,
        expansionBehaviorLabel: expansionBehaviorLabelCopy,
        validationSeverityProperties: validationSeverityPropertiesCopy,
        expansionSeverityProperties: expansionSeverityPropertiesCopy,
        allowValidationRulesToExpand: allowValidationRulesToExpandCopy,
        allowMultipleSelections: allowMultipleSelectionsCopy,
        applyConstraints: applyConstraintsCopy,
        enableExplicitContentConfiguration: enableExplicitContentConfigurationCopy
    };
};

/**
 * The method will pop up the switch Configuration Mode Confirmation to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 */
export let switchConfigurationMode = () => {
    let msg = configuratorUtils.getFscLocaleTextBundle().switchConfigurationModeConfirmation;
    let cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    let proceedString = configuratorUtils.getFscLocaleTextBundle().applySaveCmd;
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: ( $noty ) => {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: ( $noty ) => {
            $noty.close();
            eventBus.publish( 'Pca0SvrSettings.applySettingsToServer' );
        }

    }
    ];
    messagingService.showWarning( msg, buttons );
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
 * @param {Object} svrSettings - svrSettings
 */
export let handleUpdateSettings = ( response, svrSettingsAtomicData ) => {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };
    let oldConfigSettings = svrSettings.appliedSettings.configSettings;
    let settingsCache = { ...svrSettings.settingsCache };
    svrSettings.reassessSelections = true;

    // Check if Profile Settings feature is supported
    let isValidationModeInitialized = !_.isUndefined( svrSettings.appliedSettings.validationProfile );

    // Stop in case error occurred (e.g. RuleDate set to future)
    if( !response.responseInfo || !response.responseInfo.configSettings ) {
        // An error occurred while applying settings, e.g. Rule date is a future date
        let notificationMessage = configuratorUtils.getFscLocaleTextBundle().applySettingsError;
        configuratorUtils.showNotificationMessage( notificationMessage, 'ERROR' );
        return;
    }

    // Reset applied Settings based on SOA response
    svrSettings.appliedSettings = {};

    // Profile Settings
    // Update active profile settings (if profile settings feature is supported)
    // Note: Profile settings are not sent to server while applying config settings (filter criteria).
    // Rather, they are saved locally and sent to server whenever a SOA call is made
    // Update of local copy of profile Settings happens here, where changes to Config Settings (Filter Criteria)
    // have been applied and saved to ConfigPerspective in server
    if( isValidationModeInitialized ) {
        svrSettings.appliedSettings.validationProfile = _.cloneDeep( settingsCache.profileSettings );
    }

    // Filter Criteria
    // responseInfo.configSettings contains updated information about Filter criteria from perspective
    // (Revision Rule, Rule Date and Effectivity Date/Unit range)
    svrSettings.appliedSettings.configSettings = JSON.parse( response.responseInfo.configSettings[ 0 ] );

    if( settingsCache.ruleDateTranslationMode ) {
        // Set Rule Translation Mode to the Mode that was cached earlier
        // NOTE- We do not send rule date translation mode to server in case of apply settings
        // Only in the case of Save/ Save As, the rule date translation bit is sent to server
        svrSettings.appliedSettings.ruleDateTranslationMode = settingsCache.ruleDateTranslationMode;
    }

    // Process isDirty flag
    // ProfileSettingsDirty has been already processed from user's selections in Settings Panel
    // Actual changes in Filter Criteria need to be analyzed: it is possible that some updates were not applied
    // For instance, Rule Date might have not changed as requested

    if( /*Revision Rule*/
        svrSettings.appliedSettings.configSettings.props.pca0RevisionRule.dbValues[ 0 ] !== oldConfigSettings.props.pca0RevisionRule.dbValues[ 0 ] ||
        /*Effectivity*/
        svrSettings.appliedSettings.configSettings.props.pca0Effectivity.dbValues[ 0 ] !== oldConfigSettings.props.pca0Effectivity.dbValues[ 0 ] ||
        /*Rule Date */
        svrSettings.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ] !== oldConfigSettings.props.pca0RuleDate.dbValues[ 0 ] ) {
        settingsCache.filterCriteriaChanged = true;
    }

    // NOTE: revRule on context is a transient UID
    // this doesn't match with persistentUIDs in RevisionRule dropwdown
    // We need to keep track of selected revRule UID that's been applied
    // This is to:
    // - allow currently active revision Rule to be highlighted in the dropdown
    // --- for when Settings Panel is closed (i.e. settingsCache is reset)
    if( !_.isUndefined( settingsCache.selectedRevisionRule ) ) {
        svrSettings.lastAppliedRevisionRuleUid = settingsCache.selectedRevisionRule.uid;
    }
    svrSettings.settingsCache = settingsCache;
    svrSettingsAtomicData.update( svrSettings );
};

/**
 * Refresh selections for Validation Severity
 * there is no way (AW5) to discriminate prop change from user/programmatically
 * This is to avoid loop on every prop change due to programmatic selection of severity levels
 * @return {Object} validation severity properties
 */
let refreshValidationSeverity = ( svrSettings ) => {
    let settingsMO = svrSettings.settingsMO;
    let settingsCache = svrSettings.settingsCache;
    let selectedValidationSeverity = settingsCache.profileSettings.pca0ValidationSeverity;

    let validationSeverityProperties = [];
    let validationLevelLOV = settingsMO.pca0ValidationLevelLOV.lovValues;
    if( validationLevelLOV ) {
        for( let lovExpRow in validationLevelLOV ) {
            if( validationLevelLOV.hasOwnProperty( lovExpRow ) ) {
                let uid = validationLevelLOV[ lovExpRow ].uid;
                let displayValue = validationLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                let checkBoxProperty = uwPropertyService.createViewModelProperty(
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
let refreshExpansionSeverity = ( svrSettings ) => {
    let settingsMO = svrSettings.settingsMO;
    let settingsCache = svrSettings.settingsCache;
    let selectedExpansionSeverity = settingsCache.profileSettings.pca0ExpansionSeverity;

    let expansionSeverityProperties = [];
    let expansionLevelLOV = settingsMO.pca0ExpansionLevelLOV.lovValues;
    if( expansionLevelLOV ) {
        for( let lovExpRow in expansionLevelLOV ) {
            if( expansionLevelLOV.hasOwnProperty( lovExpRow ) ) {
                let uid = expansionLevelLOV[ lovExpRow ].uid;
                let displayValue = expansionLevelLOV[ lovExpRow ].propDisplayValues.lov_values[ 0 ];
                let checkBoxProperty = uwPropertyService.createViewModelProperty(
                    uid, // Property internal name
                    displayValue, // Property display name
                    'BOOLEAN', // DataType
                    // Given CheckBox UI: select all values higher than current Expansion Severity
                    Number( uid ) >= Number( selectedExpansionSeverity ), // DB value
                    '' ); // displayValuesIn

                // Checkbox for expansion is enabled if profile allows for it
                // and if ValidationSeverity value is higher than that
                let valLevelUID = settingsCache.profileSettings.pca0ValidationSeverity;
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
 * Update Settings cache for selected Validation Mode
 * Update visibility and values for Validation UI
 * @param {Object} data - The ViewModel object
 */
export let handleProfileSelectionChange = ( data, svrSettingsAtomicData ) => {
    let svrSettings = { ...svrSettingsAtomicData.getValue() };
    let settingsCache = svrSettings.settingsCache;
    let validationProfile = _.find( svrSettings.settingsMO.solverProfilesLOV, { pca0ProfileName: data.profileProp.dbValue } );

    settingsCache.profileSettings.pca0ProfileName = validationProfile.pca0ProfileName;
    settingsCache.profileSettings.profileDisplayName = validationProfile.profileDisplayName;

    // Validation Severity
    // Update cache and tune settings for loaded ValidationSeverity properties (checkboxes)
    let valLevelUID = validationProfile.pca0ValidationSeverity;
    settingsCache.profileSettings.pca0ValidationSeverity = valLevelUID;

    // Rebuild list
    let validationSeverityProperties = refreshValidationSeverity( svrSettings );

    // Expansion Severity
    // Update cache and tune settings for loaded ExpansionSeverity properties (checkboxes)
    settingsCache.profileSettings.pca0ExpansionSeverity = validationProfile.pca0ExpansionSeverity;

    // Rebuild list
    let expansionSeverityProperties = refreshExpansionSeverity( svrSettings );

    // Allow Multiple Selections
    let allowMultipleSelections = { ...data.allowMultipleSelections };
    allowMultipleSelections.dbValue = validationProfile.pca0AllowMultipleSelections === 'true';
    allowMultipleSelections.isEnabled = _profileSettingsEditable;
    allowMultipleSelections.isEditable = _profileSettingsEditable;

    // Initialize cached value for AllowMultipleSelections
    settingsCache.profileSettings.pca0AllowMultipleSelections = validationProfile.pca0AllowMultipleSelections;

    let applyConstraints = { ...data.applyConstraints };

    // Apply Constraints
    applyConstraints.dbValue = validationProfile.pca0ApplyConstraints === 'true';
    applyConstraints.isEnabled = _profileSettingsEditable;
    applyConstraints.isEditable = _profileSettingsEditable;

    // Initialize cached value for ApplyConstraints
    settingsCache.profileSettings.pca0ApplyConstraints = validationProfile.pca0ApplyConstraints;

    // Explicit content configuration
    let enableExplicitContentConfiguration = { ...data.enableExplicitContentConfiguration };
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
    settingsCache.profileSettingsDirty = !_.isEqual( settingsCache.profileSettings, svrSettings.appliedSettings.validationProfile );
    svrSettingsAtomicData.update( svrSettings );
    return {
        validationSeverityProperties: validationSeverityProperties,
        expansionSeverityProperties: expansionSeverityProperties,
        allowMultipleSelections: allowMultipleSelections,
        applyConstraints: applyConstraints,
        enableExplicitContentConfiguration: enableExplicitContentConfiguration
    };
};

/**
 * Prepare JSON for the SOA input call, containing values of fscContext config settings (filter criteria)
 * @param {Object} svrSettingsAtomicData svrSettings atomic data
 * @returns {String} stringified object for saving
 */
export let getFilterCriteriaToApply = function( svrSettingsAtomicData ) {
    let inputData = {
        type: 'Pca0ConfigSetting',
        uid: 'uid_config_setting'
    };

    // Get properties from Configuration subpanel "Filter Criteria", formatted for Server-side processing
    // [Revision Rule, Effectivity, Rule Date]
    let filterCriteriaProps = Pca0SvrFilterCriteriaSettingsService.getFilterCriteriaToApply( svrSettingsAtomicData );

    // Local copy of SOA input: it will be used to match with response
    inputData.props = filterCriteriaProps;
    return JSON.stringify( inputData );
};

/**
 * Get Applied profile Settings for Single Variant
 * @param {Object} svrSettings svrSettings atomic data
 * @returns {String} Profile Settings information - JSON string
 */
export let getProfileSettingsForVariant = ( svrSettingsAtomicData ) => {
    if( !svrSettingsAtomicData ) {
        return '';
    }
    let svrSettings =  { ...svrSettingsAtomicData.getValue() };
    if( !svrSettings.appliedSettings || !svrSettings.appliedSettings.validationProfile ) {
        return '';
    }
    let profileSettings = configuratorUtils.getProfileSettingsAsRequestInput( svrSettings.appliedSettings );
    return JSON.stringify( profileSettings );
};

/**
 * Updates the data on Applied Settings that will get transmitted to server based on the cached settings
 * @param {Object} svrSettings svrSettings atomic data
 */
export let updateAppliedSettings = ( svrSettings ) => {
    if( !svrSettings ) {
        return;
    }
    let svrSettingsValue =  { ...svrSettings.getValue() };
    svrSettingsValue.appliedSettings.validationProfile = svrSettingsValue.settingsCache.profileSettings;
    svrSettingsValue.appliedSettings.ruleDateTranslationMode = svrSettingsValue.settingsCache.ruleDateTranslationMode;
    svrSettings.update( svrSettingsValue );
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicy = () => {
    return configuratorUtils.getPropertyPolicy( 'variantConfigurationView' );
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
 * Clears the changed flags, so it allows the renavigation back from subpanels repeadedly, otherwise it only works once
 * @param {Object} svrSettings svrSettings atomic data
 */
export let clearChangedFlags = ( svrSettings ) => {
    if( !svrSettings ) {
        return;
    }
    let svrSettingsValue =  { ...svrSettings.getAtomicData() };
    svrSettingsValue.settingsCache.effectivityChanged = false;
    svrSettingsValue.settingsCache.ruleDateChanged = false;
    svrSettings.setAtomicData( svrSettingsValue );
};

export default exports = {
    initSvrSettings,

    initializeSettingsCache,
    initializeEffectivity,
    initSettingsLOVs,
    initializeValidationUI,
    setActiveView,
    switchConfigurationMode,
    handleProfileSelectionChange,
    handleUpdateSettings,
    getFilterCriteriaToApply,
    getProfileSettingsForVariant,
    updateAppliedSettings,
    getPropertyPolicy,
    clearChangedFlags
};
