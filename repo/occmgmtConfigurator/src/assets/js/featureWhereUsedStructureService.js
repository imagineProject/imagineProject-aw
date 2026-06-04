// Copyright (c) 2024 Siemens

/**
 * @module js/featureWhereUsedStructureService
 */
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import localeService from 'js/localeService';
import Pca0WhereUsedService from 'js/Pca0WhereUsedService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

/**
 * SessionStorage name for 'Structures' section in CFG WhereUsed page
 */
const CFG_WHERE_USED_STRUCTURES_SECTION_EXP_MAP = 'occMgmtStructuresInWhereUsed';

/**
 * Const internal name for 'Structures' LayoutSlot
 */
const CFG_STRUCTURES_LAYOUTSLOT_NAME = 'occmgmtConfigurator_structures';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * OnMount actions
 * Initialize Structure-ConsumerApp layoutSlotDefinition and notify parent component through update callback
 * Query SessionStorage to get expand/collapse state for the section
 * @param {Function} settingsUpdateCallback - Callback function to update settings for the layoutSlot on parent component
 * @return {Object} updated Object to update AtomicData for expand status of 'Structures' section
 */
export let onMountStructuresObjectSetActions =  settingsUpdateCallback  => {
    // Initialize LayoutSlot definition
    const localeTextBundle = localeService.getLoadedText( 'OccurrenceVariantConstants' );
    let layoutSlotSettings = {
        layoutSlotDisplayName: localeTextBundle.structure
    };
    settingsUpdateCallback( { slotSettings: layoutSlotSettings, slotInternalName: CFG_STRUCTURES_LAYOUTSLOT_NAME } );

    // Initialize value for Atomic Data
    // Initialize 'Structures' section expanded by default
    let sectionExpStatusCache = {
        structuresExpanded: true
    };

    // Query SessionStorage
    const sectionsExpMapJSON = sessionStorage.getItem( CFG_WHERE_USED_STRUCTURES_SECTION_EXP_MAP );
    let sectionsExpCacheFromStorage = {};
    if( !_.isNull( sectionsExpMapJSON ) && !_.isUndefined( sectionsExpMapJSON ) ) {
        sectionsExpCacheFromStorage = JSON.parse( sectionsExpMapJSON );
        if( sectionsExpCacheFromStorage.hasOwnProperty( 'structuresExpanded' ) ) {
            sectionExpStatusCache.structuresExpanded = sectionsExpCacheFromStorage.structuresExpanded;
        }
    } else {
        // Create info on SessionStorage
        sessionStorage.setItem( CFG_WHERE_USED_STRUCTURES_SECTION_EXP_MAP,
            JSON.stringify( sectionExpStatusCache )
        );
    }

    // return new object to initialize Atomic Data
    return sectionExpStatusCache;
};

export let getBomLineInContextOverrides = function( vmoHovered, data ) {
    if( vmoHovered && vmoHovered.props && vmoHovered.props.bl_property_overrides ) {
        var overrideData = {
            contextValue : []
        };

        var overriddenProps = vmoHovered.props.bl_property_overrides.dbValues;
        var propertiesForEachContext = [];
        _.forEach( overriddenProps, function( prop ) {
            let propName = prop.split( ';' )[0];
            if( vmoHovered.props.hasOwnProperty( propName ) ) {
                propertiesForEachContext.push( vmoHovered.props[propName].propertyDisplayName );
            }
        } );
        propertiesForEachContext = propertiesForEachContext.join( ', ' );
        var propertyValue = uwPropertyService.createViewModelProperty( data.i18n.properties, data.i18n.properties, 'STRING', data.i18n.properties, [ propertiesForEachContext ] );
        overrideData.contextValue.push( propertyValue );
        return overrideData;
    }
};

export let loadVMOs = ( selectionData, selectionModel ) => {
    let parentObjectsToLoad = [];
    let parentProperty = {};
    let parentUID = '';
    let parentObject = {};
    if( selectionData.selected && selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {
            parentProperty = selectionModel.selectionData.selected[idx].props['REF(bl_window,BOMWindow).REF(top_line,BOMLine).REF(bl_revision,ItemRevision).object_string'];
            parentUID = uwPropertyService.getSourceObjectUid( parentProperty );
            parentObject = cdm.getObject( parentUID );
            if( parentObject === null ) {
                parentObjectsToLoad.push( parentUID );
            }
        }
        if( parentObjectsToLoad.length > 0 ) {
            return dataManagementSvc.loadObjects( parentObjectsToLoad ).then( function() {
            } );
        }
    }
};

export let updateSelectionData = ( selectionData, selectionModel ) => {
    let parentProperty = {};
    let parentUID = '';
    let parentObject = {};
    if( selectionData.selected && selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {
            parentProperty = selectionModel.selectionData.selected[idx].props['REF(bl_window,BOMWindow).REF(top_line,BOMLine).REF(bl_revision,ItemRevision).object_string'];
            parentUID = uwPropertyService.getSourceObjectUid( parentProperty );
            parentObject = cdm.getObject( parentUID );
            tcViewModelObjectService.mergeObjects( selectionData.selected[idx], parentObject );
        }
    }
    return selectionData;
};

/**
 * This function creates navigation params required to open selected structure
 * @param {Object} commandContext - commandContext of Open command.
 * @return {Object} Navigation params to open selected configurator objects.
 */
export let createNavigationParameters = async( commandContext ) => {
    let navigateToPageId;
    let contextUid;

    // If navigating from 'Where used tab' using 'open in new tab' for bulk selection
    // All the selected obejcts belongs to same context thus fetching context from 1st selected object
    if( commandContext.objectSetUri &&  _.get( commandContext, 'selectionModel.selectionData.selected.length' ) > 0 ) {
        //navigateToPage = 'Variants';
        navigateToPageId = 'tc_xrt_Overview';
        if( _.get( commandContext.selectionModel.selectionData.selected[0].props, 'REF(bl_window,BOMWindow).REF(top_line,BOMLine).REF(bl_revision,ItemRevision).object_string' ) ) {
            contextUid = uwPropertyService.getSourceObjectUid( commandContext.selectionModel.selectionData.selected[0].props['REF(bl_window,BOMWindow).REF(top_line,BOMLine).REF(bl_revision,ItemRevision).object_string'] );
        }
    }

    return {
        //navigateToPage: navigateToPage,
        navigateToPageId: navigateToPageId,
        contextUid :contextUid
    };
};

export default exports = {
    onMountStructuresObjectSetActions,
    getBomLineInContextOverrides,
    loadVMOs,
    updateSelectionData,
    createNavigationParameters
};
