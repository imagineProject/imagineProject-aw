// Copyright (c) 2024 Siemens

/**
 * @module js/Pca0WhereUsedService
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dialogService from 'js/dialogService';
import localeService from 'js/localeService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

/**
 * Preference name for Settings in Where is used tab
 */
const _settingsPreferenceName = veConstants.PCA_WHERE_USED_SETTINGS_PREFERENCE;

/**
 * Constant for ObjectType property
 */
const OBJECT_TYPE_PROP = 'GRMS2P(IMAN_reference,WorkspaceObject).object_type';

const localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );

/**
 * Get the value of the preference entries for Where Used
 * @return {Array} Collection of Settings as per Preference Entries
 */
let _getSettingPreferenceValue = () => {
    let showAllRevisions;
    let showDataFromAllContexts;
    let sectionsVisibility = {};

    // Expected Preference Format:
    // [ 'showAllRevisions:false', 'showDataFromAllContexts:true', 'section_showContexts:true', 'section_showConstraints:true', 'section_showVariants:true' ] );

    let settingsMap = appCtxService.getCtx( 'preferences' )[ _settingsPreferenceName ];
    if( _.isUndefined( settingsMap ) ) {
        settingsMap = [];
    }
    let currentSublocation = appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    for( let settingsEntry of settingsMap ) {
        let [ preferenceEntry, preferenceValue ] = settingsEntry.split( ':' );

        preferenceValue = preferenceValue.toLowerCase() === 'true';
        switch ( preferenceEntry ) {
            case veConstants.WHERE_USED_SETTINGS.SHOW_ALL_REVISIONS:
                showAllRevisions = preferenceValue;
                break;
            case veConstants.WHERE_USED_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS:
                // If Where used tab is opened in locations other than features in that case show all the data from all the contexts
                showDataFromAllContexts = currentSublocation === 'Pca0VariabilityExplorerFeaturesSubLocation' ? preferenceValue : true;
                break;
            case veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONTEXTS:
                sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONTEXTS ] = preferenceValue;
                break;
            case veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONSTRAINTS:
                sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONSTRAINTS ] = preferenceValue;
                break;
            case veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_VARIANTS:
                sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_VARIANTS ] = preferenceValue;
                break;
            default:
                // Layout Slots
                if( preferenceEntry.startsWith( veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_LAYOUTSLOT_PREFIX ) ) {
                    let layoutSlotName = preferenceEntry.replace( veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_LAYOUTSLOT_PREFIX, '' );
                    sectionsVisibility[ layoutSlotName ] = preferenceValue;
                }
                break;
        }
    }
    return [ showAllRevisions, showDataFromAllContexts, sectionsVisibility ];
};

/**
 * Update the value of the preference for Where Used
 * @param {Object} updatedSettings updated set of Settings
 */
let _setSettingsInPreference = updatedSettings => {
    const settings = [];

    // SHOW_ALL_REVISIONS
    settings.push( veConstants.WHERE_USED_SETTINGS.SHOW_ALL_REVISIONS + ':' +
        String( updatedSettings[ veConstants.WHERE_USED_SETTINGS.SHOW_ALL_REVISIONS ] ) );

    // SHOW_DATA_FROM_ALL_CONTEXTS
    settings.push( veConstants.WHERE_USED_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS + ':' +
        String( updatedSettings[ veConstants.WHERE_USED_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS ] ) );

    // Sections Visibility (OOTB and Layout Slots)
    Object.entries( updatedSettings.sectionsVisibility ).forEach( ( [ sectionEntryKey, sectionEntryValue ] ) => {
        let preferenceEntryKey = sectionEntryValue.isLayoutSlot ?
            veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_LAYOUTSLOT_PREFIX + sectionEntryKey : sectionEntryKey;
        settings.push( preferenceEntryKey + ':' + String( sectionEntryValue.value ) );
    } );

    // Update Preference on Global CTX
    appCtxService.updatePartialCtx( 'preferences.' + _settingsPreferenceName, settings );
};

/**
 * Set Visibility Flags on Section
 * Logic for Option 'isSettingsOptionVisible':
 **** Configurator OOTB sections: based on PWA selection type
 * --- (special cases for ModelFamily and Group)
 **** Layout Slots sections:
 * (AND logic):
 * - 1) consumer App is initialized
 * --- we don't want the option/section to be visible if consumerApp is not installed
 * - 2) PWA selection type (not shown for Group)
 *
 * Logic for section Visibility in the UI 'isSectionVisibleInUI' (AND logic):
 * Same logic for both CFG OOTB and LayoutSlots:
 * - 1) isSettingsOptionVisible is true
 * - 2) Preference/Default Value
 *
 * @param {Object} selection item selected in SubPanelContext
 * @param {Object} sectionEntryValue setting entry for the input section
 */
let _updateVisibilityFlagsOnSection = ( selection, sectionEntryValue ) => {
    const includesModelFamily = _.some( [ 'Cfg0AbsModel', 'Cfg0AbsModelFamily' ], entry => selection.modelType.typeHierarchyArray.includes( entry ) );
    const includesGroup = pca0CommonUtils.isGroupType( selection.modelType.parentTypeName );

    let isSettingsOptionVisible;
    if( sectionEntryValue.isLayoutSlot ) {
        isSettingsOptionVisible = sectionEntryValue.isInitialized && !includesGroup;
    } else {
        isSettingsOptionVisible =
            ( includesModelFamily ? sectionEntryValue.showInModelFamily : true ) &&
            ( includesGroup ? sectionEntryValue.showInGroup : true );
    }
    let isSectionVisibleInUI = sectionEntryValue.value && isSettingsOptionVisible;

    // LCS-1162306: Enforce visibility of sections that must be visible for Groups if Settings are untoggled
    if( includesGroup && sectionEntryValue.showInGroup && !sectionEntryValue.value ) {
        isSectionVisibleInUI = true;
        isSettingsOptionVisible = false;
    }
    sectionEntryValue.isSectionVisibleInUI = isSectionVisibleInUI;
    sectionEntryValue.isSettingsOptionVisible = isSettingsOptionVisible;
};

/**
 * Process visibility flags for all sections
 * - isSectionVisibleInUI flag to show/hide section in the UI
 * - isSettingsOptionVisible flag Set to show/hide the option in Settings Panel
 * @param {Object} subPanelContextSelection - item selected in SubPanelContext
 * @param {Object} settings - Atomic Data <settings>: collection of Settings for Where Used
 */
let _updateVisibilityFlagsForAllSections = ( subPanelContextSelection, settings ) => {
    Object.values( settings.sectionsVisibility ).forEach( sectionEntryValue => {
        _updateVisibilityFlagsOnSection( subPanelContextSelection, sectionEntryValue );
    } );
};

/**
 * Initialize Settings
 * - First, get value from Preference
 * --- If preference doesn't hold a value, use default values
 * - Then, update visibility flags based on PWA selection
 * @param {Object} vmSettings - View Model Atomic Data <settings>
 * @param {Array} listOfConsumerApps - list of supported consumerApps (layout slot names)
 * @param {Object} subPanelContextSelection - item selected in SubPanelContext
 */
let _initSettings = ( vmSettings, listOfConsumerApps, subPanelContextSelection ) => {
    // Clear before re-initializing
    const settings = {
        sectionsVisibility: {}
    };

    // Use default values if something is not set (i.e. parameters added a different times)
    const [ showAllRevisions, showDataFromAllContexts, sectionsVisibility ] = _getSettingPreferenceValue();

    // Show All Revisions
    settings[ veConstants.WHERE_USED_SETTINGS.SHOW_ALL_REVISIONS ] = !_.isUndefined( showAllRevisions ) ? showAllRevisions : veConstants.WHERE_USED_CONSTANTS.DEFAULT_SETTINGS.SHOW_ALL_REVISIONS;

    // Show Data from All Contexts
    settings[ veConstants.WHERE_USED_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS ] = !_.isUndefined( showDataFromAllContexts ) ?
        showDataFromAllContexts : veConstants.WHERE_USED_CONSTANTS.DEFAULT_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS;

    // Sections Visibility: show all sections by default if preference is not provided

    // Show Contexts
    let contextsValue = !_.isUndefined( sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONTEXTS ] ) ?
        sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONTEXTS ] : true;
    settings.sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONTEXTS ] = {
        value: contextsValue,
        showInModelFamily: false, // If PWA selection is Model Family, 'Contexts' section should be hidden
        showInGroup: true
    };

    // Show Constraints
    let constraintsValue = !_.isUndefined( sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONSTRAINTS ] ) ?
        sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONSTRAINTS ] : true;
    settings.sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_CONSTRAINTS ] = {
        value: constraintsValue,
        showInModelFamily: true,
        showInGroup: false // If PWA selection is Group, 'Constraints' section should be hidden
    };

    // Show Variants
    let variantsValue = !_.isUndefined( sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_VARIANTS ] ) ?
        sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_VARIANTS ] : true;
    settings.sectionsVisibility[ veConstants.WHERE_USED_SETTINGS.SECTION_SHOW_VARIANTS ] = {
        value: variantsValue,
        showInModelFamily: true,
        showInGroup: false // If PWA selection is Group, 'Variants' section should be hidden
    };

    // Layout slots
    listOfConsumerApps.forEach( layoutSlotName => {
        // If preference is not set for that LayoutSlot, set true value by default for that slot
        // Do not set isInitialized flag on component: it will be set after consumerApp rendering is done
        let layoutSlotVisibilityValue = !_.isUndefined( sectionsVisibility[ layoutSlotName ] ) ?
            sectionsVisibility[ layoutSlotName ] : true;
        settings.sectionsVisibility[ layoutSlotName ] = {
            isLayoutSlot: true,
            value: layoutSlotVisibilityValue
        };
    } );

    _updateVisibilityFlagsForAllSections( subPanelContextSelection, settings );

    // Update atomic data
    vmSettings.setAtomicData( settings );
};

/**
 * This function returns the context uid of the selected item by making getProperties Soa call
 * @param {String} selectedItemUid Uid of selected item (constraint or variant)
 */
const _getContextUidUsingGetPropertiesSOA = async( selectedItemUid ) => {
    const serviceName = 'Core-2006-03-DataManagement';
    const operationName = 'getProperties';
    const soaInput = {
        objects: [ { uid: selectedItemUid } ],
        attributes: [ 'cfg0ProductItems' ]
    };

    const response = await soaSvc.postUnchecked( serviceName, operationName, soaInput );
    const modelObjects = response.modelObjects ? response.modelObjects : response.ServiceData.modelObjects;
    const contextObj = _.find( modelObjects, obj => obj.type === 'Cfg0ProductItem' || obj.type === 'Cfg0Dictionary' );
    return contextObj && contextObj.uid ? contextObj.uid : undefined;
};

/**
 * This function returns the context uid of the selected item by making whereReferenced Soa call
 * @param {String} selectedItemUid Uid of selected item (constraint or variant)
 * @param {String} selectedItemType Type of selected item (constraint or variant)
 */
const _getContextUidUsingWhereReferencedSOA = async( selectedItemUid, selectedItemType ) => {
    const serviceName = 'Core-2007-01-DataManagement';
    const operationName = 'whereReferenced';
    const soaInput = {
        objects: [ {
            uid: selectedItemUid,
            type: selectedItemType
        } ],
        numLevels: 1
    };

    const response = await soaSvc.postUnchecked( serviceName, operationName, soaInput );
    const modelObjects = response.modelObjects ? response.modelObjects : response.ServiceData.modelObjects;
    const contextObj = _.find( modelObjects, obj => obj.type === 'Cfg0ProductItem' || obj.type === 'Cfg0Dictionary' );
    return contextObj && contextObj.uid ? contextObj.uid : undefined;
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * onMount lifecycleHook
 * Initialize ViewModel data and settings
 * Manage SessionStorage for caching expansion status of CFG OOTB sections
 * @param {Object} subPanelContext - SubPanelContext
 * @param {Object} vmSettings - View Model Atomic Data <settings>
 * @param {Array} listOfConsumerApps - list of supported consumerApps (layout slot names)
 * @return {Object} updated sectionExpStatusCache to be dispatched on VM
 */
export let handleInitActions = ( subPanelContext, vmSettings, listOfConsumerApps ) => {
    // Initialize Settings
    _initSettings( vmSettings, listOfConsumerApps, subPanelContext.selection[ 0 ] );

    // Initialize with all sections expanded by default
    let sectionExpStatusCache = {
        contextsExpanded: true,
        constraintsExpanded: true,
        variantsExpanded: true
    };

    // Query SessionStorage to get expand/collapse state for all sections
    const sectionsExpMapJSON = sessionStorage.getItem( veConstants.CFG_WHERE_USED_SECTIONS_EXP_MAP );
    let sectionsExpCacheFromStorage = {};
    if( !_.isNull( sectionsExpMapJSON ) && !_.isUndefined( sectionsExpMapJSON ) ) {
        sectionsExpCacheFromStorage = JSON.parse( sectionsExpMapJSON );

        // <Where is Used> in Contexts
        if( sectionsExpCacheFromStorage.hasOwnProperty( 'contextsExpanded' ) ) {
            sectionExpStatusCache.contextsExpanded = sectionsExpCacheFromStorage.contextsExpanded;
        }

        // <Where is Used> in Constraints
        if( sectionsExpCacheFromStorage.hasOwnProperty( 'constraintsExpanded' ) ) {
            sectionExpStatusCache.constraintsExpanded = sectionsExpCacheFromStorage.constraintsExpanded;
        }

        // <Where is Used> in Variants
        if( sectionsExpCacheFromStorage.hasOwnProperty( 'variantsExpanded' ) ) {
            sectionExpStatusCache.variantsExpanded = sectionsExpCacheFromStorage.variantsExpanded;
        }
    } else {
        // Create info on SessionStorage
        sessionStorage.setItem(
            veConstants.CFG_WHERE_USED_SECTIONS_EXP_MAP,
            JSON.stringify( sectionExpStatusCache )
        );
    }

    // Define Search Criteria for the sections
    const configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    const perspective = _.get( configuratorCtx, 'configPerspective' );
    const settings = { ...vmSettings.getAtomicData() };
    const xrtContext = {
        configPerspective: perspective ? perspective.uid : undefined,
        allRevisions: settings ? settings.showAllRevisions : false,
        allContexts: settings ? settings.showDataFromAllContexts : false
    };

    return {
        sectionExpStatusCache: sectionExpStatusCache,
        pwaSelectionData: subPanelContext.selection,
        xrtContext: xrtContext
    };
};

/**
 * Handle updates (and initialization) on layout slots
 * Update visibility flags as per preference/default value
 * This action is done only once component is mounted
 * @param {ViewModelTreeNode} subPanelContextSelection - item selected in SubPanelContext
 * @param {Object} vmSettings - View Model Atomic Data <settings>
 * @param {Object} slotSettings - layoutSlot settings
 * @param {String} slotInternalName - Internal Name of the LayoutSlot definition
 */
export let handleLayoutSlotUpdate = (  subPanelContextSelection, vmSettings, slotSettings, slotInternalName ) => {
    // Update Visibility Flags on layout slot when it is mounted/initialized
    // This is because preference may be set, but consumerApp is not installed
    // In that case, we don't want to display the visibility option in Settings Panel
    let settings = { ...vmSettings.getAtomicData() };
    settings.sectionsVisibility[ slotInternalName ].layoutSlotDisplayName = slotSettings.layoutSlotDisplayName;
    settings.sectionsVisibility[ slotInternalName ].isInitialized = true;
    _updateVisibilityFlagsOnSection( subPanelContextSelection, settings.sectionsVisibility[ slotInternalName ] );
    vmSettings.setAtomicData( settings );
};

/**
 * Update VM data and Session storage when a section is expanded/collapsed
 * if a section is expanded, evaluate if xrtContext update is needed
 * @param {Object} vmSectionExpStatusCache - View Model Atomic Data <sectionExpStatusCache>
 * @param {String} sessionStorageUid - unique uid for the sessionStorgae to be queried/updated
 * @param {String} cacheEntryId - unique uid of entry for the section in the panel
 * @param {Boolean} isCollapsed - true if panel is collapsed from eventData
 * @param {Object} xrtContext - xrtContext used to create searchInputCriteria for performSearchViewModel SOA
 * @param {Object} vmObjectSet - contexts/constraints/variants objectSet atomic data
 * @param {Boolean} isSectionOutOfSync - true if section content is flagged as outdated and must be reloaded
 * @returns {Boolean} updated out-of-sync flag
 */
export let updateSectionExpStatus = ( vmSectionExpStatusCache, sessionStorageUid, cacheEntryId, isCollapsed, xrtContext, vmObjectSet, isSectionOutOfSync ) => {
    // Get/Set status of expand/collapse state for all sections
    let sectionsExpMapJSON = sessionStorage.getItem( sessionStorageUid );
    let sectionsExpCacheFromStorage = !_.isNull( sectionsExpMapJSON ) && !_.isUndefined( sectionsExpMapJSON ) ? JSON.parse( sectionsExpMapJSON ) : {};

    // Update local cache and Session Storage
    let sectionExpStatusCache = vmSectionExpStatusCache.getAtomicData();
    sectionExpStatusCache[ cacheEntryId ] = !isCollapsed;
    vmSectionExpStatusCache.setAtomicData( sectionExpStatusCache );

    sectionsExpCacheFromStorage[ cacheEntryId ] = !isCollapsed;
    sessionStorage.setItem( sessionStorageUid, JSON.stringify( sectionsExpCacheFromStorage ) );

    // If section is being expanded and its content is outdated:
    // we need to refresh the objectSet
    if( !isCollapsed && isSectionOutOfSync ) {
        exports.reloadObjectSet( vmObjectSet, xrtContext );
        isSectionOutOfSync = !isSectionOutOfSync;
    }
    return isSectionOutOfSync;
};

/**
 * Initialize Settings Panel with data from Grid Settings atomic data
 * @param {Object} vmSettings - View Model Atomic Data <settings> passed from parent component
 * @param {Object} settingsFields - Object containing setting fields to be initialized in the Settings Panel
 * @returns {Object} Info Container of active settings to initialize data and components in Settings Panel
 */
export let initializeSettingsPanel = ( vmSettings, settingsFields ) => {
    let settings = { ...vmSettings.getValue() };
    let settingsProps = {};
    let currentSublocation = appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    // Iterate over all the fields, if the field is present in the settings object, update the field with
    // the value from the settings object
    Object.keys( settingsFields ).forEach( settingsFieldKey => {
        let settingsField = settingsFields[settingsFieldKey];
        if ( settingsField && settings.hasOwnProperty( settingsFieldKey ) ) {
            // Show Data from All Contexts
            if( settingsFieldKey === veConstants.WHERE_USED_SETTINGS.SHOW_DATA_FROM_ALL_CONTEXTS ) {
                // If Where used tab is opened in locations other than Features or Models tab
                // we don't have information about the ProductItem
                // In such case we always have to load all the data from all the contexts
                // So in this case toggle button always selected else it will be select the predefined value
                settingsField.update( currentSublocation !== 'Pca0VariabilityExplorerFeaturesSubLocation' && currentSublocation !== 'Pca0VariabilityExplorerModelsSubLocation' ? true : settings[settingsFieldKey] );
            }else {
                // set the predefined value
                settingsField.update( settings[settingsFieldKey] );
            }
        }
    } );

    // To enable/disable the toggle button for 'Show Data from All Contexts'
    settingsProps.canShowDataFromAllContexts = currentSublocation !== 'Pca0VariabilityExplorerModelsSubLocation';

    // Sections Visibility
    settingsProps.sectionsVisibility = [];
    let sectionsVisibilityFromSettings = settings.sectionsVisibility;
    let isAtLeastOneSectionToggledOn = false;

    Object.entries( sectionsVisibilityFromSettings ).forEach( ( [ sectionEntryKey, sectionEntryValue ] ) => {
        // Set Display Text for toggle component in Settings Panel
        // if property is from a Layout Slot, get text from 'layoutSlotDisplayName'
        // Otherwise, get localized Settings name, if available
        let propertyDisplayValue;
        if( sectionEntryValue.isLayoutSlot ) {
            propertyDisplayValue = sectionEntryValue.layoutSlotDisplayName;
        } else {
            propertyDisplayValue = localeTextBundle.hasOwnProperty( sectionEntryKey ) ?
                localeTextBundle[ sectionEntryKey ] : sectionEntryKey;
        }

        // Create Toggle Button VM properties for section visibility entries:
        // Only show the settings that need to be shown
        // (e.g. 'isSettingsOptionVisible': according to PWA selection)
        if( sectionEntryValue.isSettingsOptionVisible ) {
            let propertyValue = sectionEntryValue.isSectionVisibleInUI;
            if( propertyValue ) {
                isAtLeastOneSectionToggledOn = true;
            }
            const dbValue = Boolean( propertyValue );
            let displayValuesIn = dbValue ? [ 'True' ] : [ 'False' ];
            let toggleButtonProperty = uwPropertyService.createViewModelProperty(
                sectionEntryKey, // Property internal name
                propertyDisplayValue, // Property display name
                'BOOLEAN', // DataType
                dbValue, // DB value
                displayValuesIn ); // displayValuesIn
            toggleButtonProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
            toggleButtonProperty.propInternalVal = sectionEntryKey;
            toggleButtonProperty.isEditable = true;
            settingsProps.sectionsVisibility.push( toggleButtonProperty );
        }
    } );
    settingsProps.isAtLeastOneSectionToggledOn = isAtLeastOneSectionToggledOn;

    return settingsProps;
};

/**
 * Handle updates on a toggle property in Settings panel
 * This API is looking for any changes in toggle components, regardless if OOTB CFG or layoutSlots
 * @param {Array} sectionsVisibility list of flags to set the visibility of each section
 * @returns {Boolean} true if visibility was modified in any sections and at least one section is toggled ON
 */
export let handleSectionsVisibilityChanged = sectionsVisibility => {
    let isAnySectionsVisibilitySettingDirty = false;
    let isAtLeastOneSectionToggledOn = false;
    sectionsVisibility.forEach( sectionVisibilityEntry => {
        if( sectionVisibilityEntry.valueUpdated &&
            sectionVisibilityEntry.value !== sectionVisibilityEntry.newValue ) {
            isAnySectionsVisibilitySettingDirty = true;
            if( sectionVisibilityEntry.newValue ) {
                isAtLeastOneSectionToggledOn = true;
            }
        } else if( sectionVisibilityEntry.value ) {
            isAtLeastOneSectionToggledOn = true;
        }
    } );
    return { isAnySectionsVisibilitySettingDirty, isAtLeastOneSectionToggledOn };
};

/**
 * Apply Settings
 * Update Settings preference
 * Update XRT context
 * Trigger Data reload if needed
 * @param {Object} settingsFromPanel - settings (Settings Panel ViewModel data)
 * @param {Object} vmSettings - View Model Atomic Data <settings>
 * @param {String} popupId - popupId of dialog
 * @return {Object} set of Boolean flags/Objects to trigger update
 */
export let applySettings = ( settingsFromPanel, vmSettings, popupId ) => {
    let settings = { ...vmSettings.getAtomicData() };

    // Initialize flags for triggering data reload
    let mustTriggerDataReload = false;

    // Show All Revisions
    if( settingsFromPanel.showAllRevisions.valueUpdated &&
        settingsFromPanel.showAllRevisions.dbValue !== settings.showAllRevisions ) {
        settings.showAllRevisions = settingsFromPanel.showAllRevisions.dbValue;
        mustTriggerDataReload = true;
    }

    // Show Data from All Contexts
    if( settingsFromPanel.showDataFromAllContexts.valueUpdated &&
        settingsFromPanel.showDataFromAllContexts.dbValue !== settings.showDataFromAllContexts ) {
        settings.showDataFromAllContexts = settingsFromPanel.showDataFromAllContexts.dbValue;
        mustTriggerDataReload = true;
    }

    // Sections
    settingsFromPanel.sectionsVisibility.forEach( sectionVMO => {
        let propName = sectionVMO.propertyName;
        if( sectionVMO.valueUpdated && sectionVMO.dbValue !== settings.sectionsVisibility[ propName ].isSectionVisibleInUI ) {
            settings.sectionsVisibility[ propName ].isSectionVisibleInUI = sectionVMO.dbValue;

            // This is the only occurrence where value is changed
            // the change will be reflected into preference right after this block
            settings.sectionsVisibility[ propName ].value = sectionVMO.dbValue;
        }
    } );

    // Update preference
    _setSettingsInPreference( settings );

    // Close dialog
    dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );

    // Update Atomic Data
    vmSettings.setAtomicData( settings );

    // Update xrtContext
    const configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    const perspective = _.get( configuratorCtx, 'configPerspective' );
    const xrtContext = {
        configPerspective: perspective.uid,
        allRevisions: settings.showAllRevisions,
        allContexts: settings.showDataFromAllContexts
    };
    return { mustTriggerDataReload, xrtContext };
};

/**
 * Update visibility flags for Sections based on item type of selection in PWA
 * Update Settings
 * @param {ViewModelTreeNode} subPanelContextSelection - item selected in SubPanelContext
 * @param {Object} vmSettings - View Model Atomic Data <settings>
 */
export let updateSectionsVisibility = ( subPanelContextSelection, vmSettings ) => {
    const settings = { ...vmSettings.getAtomicData() };
    _updateVisibilityFlagsForAllSections( subPanelContextSelection, settings );
    vmSettings.setAtomicData( settings );
};

/**
 * Update xrtContext on Object set
 * Update 'objsetdata' to trigger data reload
 * @param {Object} vmObjectSet - contexts/constraints/variants objectSet atomic data
 * @param {Object} xrtContext - xrtContext (used to create searchInputCriteria for performSearchViewModel SOA)
 */
export let reloadObjectSet = ( vmObjectSet, xrtContext ) => {
    let objectSet = { ...vmObjectSet.getAtomicData() };
    objectSet.xrtContext = xrtContext;

    // NOTE from CFX: Updating object set data is enough to trigger data reload of the object set
    objectSet.objsetdata = { ...objectSet.objsetdata };
    vmObjectSet.setAtomicData( objectSet );
};

/**
 * Trigger data reload on each object-set if needed.
 * (data reload is necessary for expanded sections only).
 * Update flags to mark objectSet as out-of-sync (this will trigger reload when section is expanded)
 * @param {Boolean} isSectionExpanded - true if section is expanded
 * @param {Object} vmObjectSet - contexts/constraints/variants atomic data
 * @param {Object} xrtContext - xrtContext (used to create searchInputCriteria for performSearchViewModel SOA)
 * @returns {Object} updated set of out-of-sync flags to guide the reload of object-set components
 */
export let refreshObjectSet = ( isSectionExpanded, vmObjectSet, xrtContext ) => {
    // Object sets must be refreshed in case of
    // 1) PWA selection change
    // 2) Settings change
    // Note: if it was only scenario 1):
    // -------key could have been set in html to {{props.subPanelContext.selection[0].uid}}
    // -------and there would not be any need for any API (everything would be handled automatically by objectSet component)
    // but we need to enforce data reload for applySettings (props.subPanelContext.selection being the same)

    // If section is expanded, objectSet is automatically refreshed (because of update of key element)
    // If section is collapsed, we do not want to make a SOA call: we need to destroy the component.
    // ---- Hence, we consider the section content as out-of-sync
    // ---- When section gets expanded, new SOA will be made to take care of loading fresh data
    let isSectionOutOfSync = !isSectionExpanded;
    if( isSectionExpanded ) {
        exports.reloadObjectSet( vmObjectSet, xrtContext );
    }
    return isSectionOutOfSync;
};

/**
 * Set 'reloadObjectSet' flag of <reloadObjectSetState> atomic data to True value
 * This will be used to decide if component reload is needed
 * @param {Object} vmReloadObjectSetState - Atomic data <reloadObjectSetState>
 */
export let setMustReloadFlag = vmReloadObjectSetState => {
    let reloadObjectSetState = { ...vmReloadObjectSetState.getValue() };
    reloadObjectSetState.reloadObjectSet = true;
    vmReloadObjectSetState.update( reloadObjectSetState );
};

/**
 * Update 'smartObjSet' flag on subPanelContext (objsetdata) props.
 * Any update on this flag will trigger re-rendering of the component
 * This will trigger re-rendering of objectSet content
 * @param {Object} subPanelContext - SubPanelContext
 */
export let updateSmartObjSetFlag = subPanelContext => {
    const localSubPanelContext = { ...subPanelContext.getValue() };
    localSubPanelContext.objsetdata.smartObjSet = subPanelContext.fullScreenState.value;
    subPanelContext.update( localSubPanelContext );
};

/**
 * Check if the selected variants belongs to the same context or not and according update the selection state in ctx
 * @param {Object} eventData - Event Data
 */
export let checkIfSelectionIsInSameContextForVariants = ( eventData ) => {
    // If no selection then set the flag to false
    let isSameContext = false;
    const selectedObjects = eventData.selectedObjects;

    // If there is a selection then check if all the selected objects are in the same context
    if( selectedObjects.length > 0 ) {
        // Get the context UID of the first selected object and use as reference to compare with other selected objects
        const contextUID = uwPropertyService.getSourceObjectUid( selectedObjects[ 0 ].props[ OBJECT_TYPE_PROP ] );

        for( let selectedObject of selectedObjects ) {
            // If any of the selected object is not in the same context then set the flag to false update ctx and return
            if( uwPropertyService.getSourceObjectUid( selectedObject.props[ OBJECT_TYPE_PROP ] ) !== contextUID ) {
                isSameContext = false;
                appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.Pca0WhereUsedIsSelectionInSameContextForVariants', isSameContext );
                return;
            }
        }
        // If all the selected objects are in the same context then set the flag to true
        isSameContext = true;
    }
    // Check if selected objects are not attached to ItemRevision, if they are attached then set the flag to false
    if( isSameContext && selectedObjects[ 0 ].props[ OBJECT_TYPE_PROP ].dbValue === 'ItemRevision' ) {
        isSameContext = false;
    }
    // Update the ctx with the flag
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.Pca0WhereUsedIsSelectionInSameContextForVariants', isSameContext );
};

/**
 * Check if the selected constraints belongs to the same context or not and according update the selection state in ctx
 * "Open In New Tab" should be enabled in following cases:
 * 1) If the all the selected constraints belongs to one same context.
 * 2) If constraint is shared among multiple context then the current context will be considered,
 * if the current context is not present then 0th context will be considered.
 * 3) If selected constraints consists of global constraints then those will be considered to be opened with respect to current context.
 * 4) If all the selected constraints are global constraints then those will be opened with respect to current context.
 * NOTE : If selected constraints consists of global constraints and constraints from different context then command will be disabled.
 * @param {Object} eventData - Event Data
 */
export let checkIfSelectionIsInSameContextForConstraints = ( eventData ) => {
    // If no selection then set the flag to false
    let isSameContext = false;
    const selectedObjects = eventData.selectedObjects;

    // Get hold of current open configurator context
    const configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    const perspective = _.get( configuratorCtx, 'configPerspective' );
    const currentContext = _.get( perspective, 'props.cfg0ProductItems.dbValues[0]' );

    const constraintsInDictionary = new Set();
    const constraintsInContext = new Set();
    let contextToOpen = '';

    // Iterate through the selected objects and check :
    // 1) If there are any shared constraints (present in more than 1 product Item ) then first check if current product Item is one
    //    of the product Items, if yes then consider current product Item else consider the zeroth product Item.
    // 2) Check wether the constraint is present in dictionary or product Item and accordingly update the uids in respective set.

    for( let selectedObject of selectedObjects ) {
        // Get list of all product items/dictionaries to which this constraint is attached/shared
        let productItems = selectedObject.props.cfg0ProductItems.dbValue;
        let confContext;

        // If the constraint is shared among multiple product items then check if the current product item is one of the product items
        if( productItems.includes( currentContext ) ) {
            confContext = currentContext;
        } else {
            // consider the zeroth product item
            confContext = selectedObject.props.cfg0ProductItems.dbValue[ 0 ];
        }

        // Get the view model object of the context so that we can get the type of the context
        let vmo = cdm.getObject( confContext );

        if( vmo.type === 'Cfg0ProductItem' ) {
            constraintsInContext.add( confContext );
        } else {
            constraintsInDictionary.add( confContext );
        }
    }

    // If there are more than one context in which the constraints are present then set the flag to false
    if( constraintsInContext.size > 1 ) {
        isSameContext = false;
        contextToOpen = undefined;
    } else {
        // If there is only one context in which the constraints are present then check if the current context is the same context
        if( constraintsInContext.size === 1 ) {
            if( Array.from( constraintsInContext )[ 0 ] === currentContext ) {
                // If the current context is the same context then set the flag to true and update the uid to current context
                // This means that constraint is present in the current context and may/maynot be present in dictionary
                // For dictionary, we will open constraint in the current context always
                isSameContext = true;
                contextToOpen = currentContext;
            } else {
                if( constraintsInDictionary.size === 0 ) {
                    // If the current context is not the same context and there are no dictionaries which means all constraints belong to the same context (other than current)
                    // In this case open constraints with respect to the context in which constraints are present
                    isSameContext = true;
                    contextToOpen = Array.from( constraintsInContext )[ 0 ];
                } else {
                    // If selected constraints contains global constraints and constraints from different context then we disable the command
                    isSameContext = false;
                    contextToOpen = undefined;
                }
            }
        } else {
            // If there are no constraints in context and all constraints are in dictionary (i.e all constraints are global constraints)
            // In this case open constraints with respect to current context
            isSameContext = true;
            contextToOpen = currentContext;
        }
    }

    // Update the ctx with the flag
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.Pca0WhereUsedSelectionForConstraints', {
        isSelectionInSameContext: isSameContext,
        contextToOpen: contextToOpen
    } );
};

/**
 * This function is used to store the selected object uids in session storage.
 * This stored object uids will be used to pass as input to (constraints and variants provider) performSearchViewModel SOA.
 * @param {Object} commandContext - commandContext of "Open in new tab" command.
 */
export let setSelectedCfgObjUidsInSessionStorage = ( commandContext ) => {
    let selectedItems = [];
    if( commandContext.selectionModel && _.get( commandContext, 'selectionModel.selectionData.selected' ) ) {
        // If selected items are from "where used tab"
        selectedItems = commandContext.selectionModel.selectionData.selected;
    } else if( _.get( commandContext, 'vmo' ) ) {
        // Opened object using open object cell command.
        selectedItems = [ commandContext.vmo ];
    } else {
        // Opened using open commands present at the top header of the page (Awp0ShowObject)
        selectedItems = commandContext.selectionData.selected;
    }

    let selectedObjUids = [];
    if( selectedItems && selectedItems.length > 0 ) {
        for( let i = 0; i < selectedItems.length; i++ ) {
            // If selected items are from "where used tab"
            if( selectedItems[ i ].type === 'Awp0XRTObjectSetRow' && selectedItems[ i ].props.object_string ) {
                let contextUid = uwPropertyService.getSourceObjectUid( selectedItems[ i ].props.object_string );
                if( contextUid ) {
                    selectedObjUids.push( contextUid );
                }
            } else {
                // If object is opened using open object cell command
                selectedObjUids.push( selectedItems[ i ].uid );
            }
        }
    }

    // Set selected object uid's in session storage
    sessionStorage.setItem( 'Cfg0SelectedObjUids', JSON.stringify( selectedObjUids ) );
};

/**
 * This function creates navigation params required to open selected configurator objects(constraints or variants) in respective new tab.
 * @param {Object} commandContext - commandContext of "Open in new tab" command.
 * @return {Object} Navigation params to open selected configurator objects.
 */
export let createNavigationParams = async( commandContext ) => {
    let navigateToPage;
    let navigateToPageId;
    let contextUid;

    // If navigating from 'Where used tab' using 'open in new tab' for bulk selection
    // All the selected obejcts belongs to same context thus fetching context from 1st selected object
    if( commandContext.objectSetUri && _.get( commandContext, 'selectionModel.selectionData.selected.length' ) > 0 ) {
        if( commandContext.objectSetUri === 'Pca0RefVariants' ) {
            navigateToPage = 'Variants';
            navigateToPageId = 'tc_xrt_Variants';
            if( _.get( commandContext.selectionModel.selectionData.selected[ 0 ].props, 'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ) ) {
                contextUid = uwPropertyService.getSourceObjectUid( commandContext.selectionModel.selectionData.selected[ 0 ].props[ 'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ] );
            }
        } else {
            navigateToPage = 'Constraints';
            navigateToPageId = 'tc_xrt_Constraints';
            const configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
            // Uid of context to be opened in already present in ctx, fetch uid from ctx
            contextUid = _.get( configuratorCtx, 'Pca0WhereUsedSelectionForConstraints.contextToOpen' );
        }
    } else {
        // Opening using open object cell command ( Awp0ShowObjectCell or Awp0ShowObjectCellForObjectNavigation )
        // Awp0ShowObjectCell command -> when opened using open object cell command in whereused as well as in search results in advanced search
        // Awp0ShowObjectCellForObjectNavigation command -> when opened using open object cell command in Home folder
        // Awp0ShowObject -> When opened using open command present at the top header of the page
        // In this case we dont have objectSetUri, so we need to check the object type of selected object
        // Also, sometimes when we try to open using open object cell command from home folder, object_type is not present in vmo.props

        let selectedObjectType = _.get( commandContext, 'vmo.props.object_type.dbValue' ) ? _.get( commandContext, 'vmo.props.object_type.dbValue' ) : _.get( commandContext, 'vmo.type' );

        if( selectedObjectType ) {
            if( selectedObjectType === 'VariantRule' || selectedObjectType === 'Cfg0VariantCriteria' ) {
                const ruleType = _.get( commandContext.vmo.props, 'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ) ? _.get( commandContext.vmo.props,
                    'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ) :
                    _.get( commandContext.vmo.props, 'GRMS2P(IMAN_reference,WorkspaceObject).object_string' );
                navigateToPage = 'Variants';
                navigateToPageId = 'tc_xrt_Variants';
                if( ruleType ) { contextUid = uwPropertyService.getSourceObjectUid( ruleType ); }
            } else {
                navigateToPage = 'Constraints';
                navigateToPageId = 'tc_xrt_Constraints';
                if( _.get( commandContext.vmo.props, 'cfg0ProductItems' ) ) {
                    // considering first attached context
                    contextUid = commandContext.vmo.props.cfg0ProductItems.value[ 0 ];
                }
            }
        } else {
            // When opened using open commands present at the top header of the page (Awp0ShowObject, Awp0OpenInNewTab etc)
            let selectedObject = _.get( commandContext, 'selectionData.selected[0]' );
            if( selectedObject.type === 'VariantRule' || selectedObject.type === 'Cfg0VariantCriteria' ) {
                const ruleType = _.get( selectedObject.props, 'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ) ? _.get( selectedObject.props,
                    'GRMS2P(IMAN_reference,WorkspaceObject).object_type' ) :
                    _.get( selectedObject.props, 'GRMS2P(IMAN_reference,WorkspaceObject).object_string' );
                navigateToPage = 'Variants';
                navigateToPageId = 'tc_xrt_Variants';
                if( ruleType ) { contextUid = uwPropertyService.getSourceObjectUid( ruleType ); }
            } else {
                navigateToPage = 'Constraints';
                navigateToPageId = 'tc_xrt_Constraints';
                if( _.get( selectedObject.props, 'cfg0ProductItems' ) ) {
                    // considering first attached context
                    contextUid = selectedObject.props.cfg0ProductItems.value[ 0 ];
                }
            }
        }
    }

    // If Product Item uid is not available for selected object take object uid and make appropriate soa calls to get product item uid
    if( _.isEmpty( contextUid ) ) {
        let selectedItemUid;
        let selectedItemType;
        // If object is opened using open object cell command in where used tab
        if( _.get( commandContext, 'vmo.type' ) === 'Awp0XRTObjectSetRow' && _.get( commandContext, 'vmo.props.object_string' ) ) {
            selectedItemUid = uwPropertyService.getSourceObjectUid( commandContext.vmo.props.object_string );
            selectedItemType = commandContext.vmo.props.object_type.dbValue;
        } else if( _.get( commandContext, 'vmo.uid' ) ) {
            // If object is opened using open object cell command from home folder or advanced search
            selectedItemUid = commandContext.vmo.uid;
            selectedItemType = commandContext.vmo.type;
        } else {
            // When opened using open commands present at the top header of the page (Awp0ShowObject, Awp0OpenInNewTab etc)
            selectedItemUid = commandContext.selectionData.selected[ 0 ].uid;
            selectedItemType = commandContext.selectionData.selected[ 0 ].type;
        }

        // For constraints If in column configuration, cfg0ProductItems is not present, we need to make a getProperties soa call to get the product item uid
        if( navigateToPage === 'Constraints' ) {
            contextUid = await _getContextUidUsingGetPropertiesSOA( selectedItemUid );
        } else {
            // For variants, we need to make a whereReferenced soa call to get the product item uid
            contextUid = await _getContextUidUsingWhereReferencedSOA( selectedItemUid, selectedItemType );
        }
    }

    return {
        navigateToPage: navigateToPage,
        navigateToPageId: navigateToPageId,
        cfgSelectedItemsInPage: Boolean( contextUid ),
        contextUid: contextUid
    };
};

export default exports = {
    handleInitActions,
    handleLayoutSlotUpdate,
    updateSectionExpStatus,
    initializeSettingsPanel,
    handleSectionsVisibilityChanged,
    applySettings,
    updateSectionsVisibility,
    reloadObjectSet,
    refreshObjectSet,
    setMustReloadFlag,
    updateSmartObjSetFlag,
    checkIfSelectionIsInSameContextForVariants,
    checkIfSelectionIsInSameContextForConstraints,
    setSelectedCfgObjUidsInSessionStorage,
    createNavigationParams
};
