// Copyright (c) 2024 Siemens

/**
 * @module js/pca0GridSettingsService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import editHandlerService from 'js/editHandlerService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0Constants from 'js/Pca0Constants';

/**
 * Local Util Methods
 */

/**
 * Get the preference name and check if it is a SnO Matrix Grid Editor.
 * @param {String} gridEditorMode - The active grid editor mode.
 * @returns {Object} An object containing the preference name and a boolean indicating if it is a SnOMatrixGridEditor.
 */
let  _getPreferenceName = ( gridEditorMode ) => {
    let gridSettingsPreferenceName;
    let isSnOMatrixGridEditor = false;

    if ( gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_CONSTRAINT_RULE ) {
        gridSettingsPreferenceName = veConstants.PCA_CONSTRAINT_GRID_SETTINGS_PREFERENCE;
    } else if ( gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE ) {
        gridSettingsPreferenceName = veConstants.PCA_MATRIX_GRID_SETTINGS_PREFERENCE;
        isSnOMatrixGridEditor = true;
    } else if ( gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        gridSettingsPreferenceName = veConstants.PCA_MULTISVR_GRID_SETTINGS_PREFERENCE;
    }

    return { gridSettingsPreferenceName, isSnOMatrixGridEditor };
};

/**
 * Get the value of the preference entries for Grid Editor
 * depending on active grid Editor mode
 * @param {String} gridEditorMode - active grid Editor mode
 * @return {Array} Collection of Settings as per Preference Entries
 */
let _getPcaGridSettingPreferenceValue = ( gridEditorMode ) => {
    let columnWidth;
    let useVerticalColumnHeader;
    let includeSeverityInComparison;
    let showPropsInfoInGrid;
    let showSubjectInTopGrid;
    let useAllVariabilityInGridEditor;
    let showLegend;
    let { gridSettingsPreferenceName, isSnOMatrixGridEditor } = _getPreferenceName( gridEditorMode );
    let gridEditorSettingsMap = appCtxService.getCtx( 'preferences' )[ gridSettingsPreferenceName ];
    if( _.isUndefined( gridEditorSettingsMap ) ) {
        gridEditorSettingsMap = [];
    }
    for( let index = 0; index < gridEditorSettingsMap.length; index++ ) {
        let preferenceEntry = gridEditorSettingsMap[ index ].split( ':' );
        var preferenceValue = preferenceEntry[ 1 ].toLowerCase() === 'true';
        switch ( preferenceEntry[ 0 ] ) {
            case veConstants.GRID_SETTINGS.COLUMN_WIDTH: {
                columnWidth = Number( preferenceEntry[ 1 ] );
                columnWidth = columnWidth > pca0CommonConstants.GRID_CONSTANTS.MAX_SLIDER_COLUMN_WIDTH ? pca0CommonConstants.GRID_CONSTANTS.MAX_SLIDER_COLUMN_WIDTH : columnWidth;
                break;
            }
            case veConstants.GRID_SETTINGS.USE_VERTICAL_COLUMN_HEADER: {
                useVerticalColumnHeader = preferenceValue;
                break;
            }
            case veConstants.GRID_SETTINGS.INCLUDE_SEVERITY_IN_COMPARISON: {
                includeSeverityInComparison = preferenceValue ? preferenceValue : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.INCLUDE_SEVERITY_IN_COMPARISON;
                break;
            }
            case veConstants.GRID_SETTINGS.SHOW_PROPERTIES_INFORMATION_IN_GRID: {
                showPropsInfoInGrid = preferenceValue;
                break;
            }
            case veConstants.GRID_SETTINGS.SHOW_SUBJECT_IN_TOP_GRID: {
                if( isSnOMatrixGridEditor ) {
                    showSubjectInTopGrid = false;
                } else {
                    showSubjectInTopGrid = preferenceValue;
                }
                break;
            }
            case veConstants.GRID_SETTINGS.USE_ALL_VARIABILITY_IN_GRID_EDITOR: {
                useAllVariabilityInGridEditor = preferenceValue;
                break;
            }
            case veConstants.GRID_SETTINGS.SHOW_LEGEND: {
                if( isSnOMatrixGridEditor ) {
                    showLegend = preferenceValue;
                } else {
                    showLegend = false;
                }
                break;
            }
        }
    }
    return [ columnWidth, useVerticalColumnHeader, includeSeverityInComparison, showPropsInfoInGrid, showSubjectInTopGrid, useAllVariabilityInGridEditor, showLegend ];
};

/**
 * Initialize Default values if something is not set
 * This can happen if new parameters are added to the Preference configuration at different times
 * @param {Object} gridSettings - Atomic Data <gridSettings>
 * @param {String} gridEditorMode active grid Editor mode
 */
let _initMissingGridSettingsWithDefaultValues = ( gridSettings, gridEditorMode ) => {
    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let [ columnWidth,
        useVerticalColumnHeader,
        includeSeverityInComparison,
        showPropsInfoInGrid,
        showSubjectInTopGrid,
        useAllVariabilityInGridEditor,
        showLegend ] =  _getPcaGridSettingPreferenceValue( gridEditorMode );

    // Use Vertical Column Header
    if( _.isUndefined( gridSettings.useVerticalColumnHeader ) ) {
        gridSettings.useVerticalColumnHeader = !_.isUndefined( useVerticalColumnHeader ) ? useVerticalColumnHeader : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_VERTICAL_COLUMN_HEADER;
    }

    // Use Compact Column Width
    if( _.isUndefined( gridSettings.useCompactColumnWidth ) ) {
        if( columnWidth ) {
            gridSettings.useCompactColumnWidth = columnWidth === pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH ? true : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_COMPACT_COLUMN_WIDTH;
        } else {
            gridSettings.useCompactColumnWidth = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_COMPACT_COLUMN_WIDTH;
        }
    }

    // Column Width
    if( _.isUndefined( gridSettings.columnWidth ) ) {
        gridSettings.columnWidth = columnWidth ? columnWidth : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.COLUMN_WIDTH;
    }

    // includeSeverityInComparison
    if( _.isUndefined( gridSettings.includeSeverityInComparison ) ) {
        gridSettings.includeSeverityInComparison = includeSeverityInComparison ? includeSeverityInComparison : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.INCLUDE_SEVERITY_IN_COMPARISON;
    }

    // Show 'Properties Information' in grid
    if( _.isUndefined( gridSettings.showPropsInfoInGrid ) ) {
        gridSettings.showPropsInfoInGrid = !_.isUndefined( showPropsInfoInGrid ) ? showPropsInfoInGrid : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.SHOW_PROPERTIES_INFORMATION_IN_GRID;
    }

    // Top Table Height
    if( _.isUndefined( gridSettings.topTableHeight ) ) {
        gridSettings.topTableHeight = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.TOP_TABLE_HEIGHT;
    }

    // Show 'Subject' section in Top grid
    if( _.isUndefined( gridSettings.showSubjectInTopGrid ) ) {
        if( isSnOMatrixGridEditor ) {
            gridSettings.showSubjectInTopGrid = false;
        } else {
            gridSettings.showSubjectInTopGrid = !_.isUndefined( showSubjectInTopGrid ) ? showSubjectInTopGrid : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.SHOW_SUBJECT_IN_TOP_GRID;
        }
    }

    // Use All Variability
    if( _.isUndefined( gridSettings.useAllVariabilityInGridEditor ) ) {
        gridSettings.useAllVariabilityInGridEditor = !_.isUndefined( useAllVariabilityInGridEditor ) ?
            useAllVariabilityInGridEditor : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.USE_ALL_VARIABILITY_IN_GRID_EDITOR;
    }

    // Show Legend
    if( _.isUndefined( gridSettings.showLegend ) ) {
        if( isSnOMatrixGridEditor ) {
            gridSettings.showLegend = !_.isUndefined( showLegend ) ?
                showLegend : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.SHOW_LEGEND;
        } else {
            gridSettings.showLegend = false;
        }
    }
};

/**
 * Helper function is to remove the header size from local storage if present.
 * @param {String} gridId - Grid ID
 */
let _removeHeaderSizeLocalStorage = ( gridId ) => {
    const key = `${gridId}_gridId_headerHeight:/`;
    const storedValue = localStorage.getItem( key );
    if ( !_.isNull( storedValue ) ) {
        localStorage.removeItem( key );
    }
};

/**
 * Update the value of cfg grid Settings preference when a setting is changed in Settings Panel.
 * @param {Object} gridSettings updated set of Settings for Grid Editor
 * @param {Object} gridEditorMode Mode of the Grid Editor (ex: "Cfg0AbsMatrixRule", "multiSvrGrid")
 *
 */
let _setGridSettingsInPreference = function( gridSettings, gridEditorMode ) {
    let { gridSettingsPreferenceName, isSnOMatrixGridEditor } = _getPreferenceName( gridEditorMode );

    let gridSettingsData = [];
    let preferenceGridSettings = [
        veConstants.GRID_SETTINGS.COLUMN_WIDTH,
        veConstants.GRID_SETTINGS.USE_VERTICAL_COLUMN_HEADER
    ];

    if ( gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        preferenceGridSettings.push(
            veConstants.GRID_SETTINGS.INCLUDE_SEVERITY_IN_COMPARISON
        );
    } else {
        preferenceGridSettings.push(
            veConstants.GRID_SETTINGS.SHOW_PROPERTIES_INFORMATION_IN_GRID,
            veConstants.GRID_SETTINGS.SHOW_SUBJECT_IN_TOP_GRID,
            veConstants.GRID_SETTINGS.USE_ALL_VARIABILITY_IN_GRID_EDITOR,
            veConstants.GRID_SETTINGS.SHOW_LEGEND
        );
    }

    preferenceGridSettings.forEach( preferenceGridSetting => {
        // Add N.A. Value for:
        // - 'showSubjectInTopGrid' when authoring Matrix Rules
        // - 'showLegend' when authoring all Constraint Rule Types except Matrix Rules
        if( preferenceGridSetting === veConstants.GRID_SETTINGS.SHOW_SUBJECT_IN_TOP_GRID && isSnOMatrixGridEditor ||
            preferenceGridSetting === veConstants.GRID_SETTINGS.SHOW_LEGEND && !isSnOMatrixGridEditor ) {
            gridSettingsData.push( preferenceGridSetting + ':' + 'NA' );
        } else {
            gridSettingsData.push( preferenceGridSetting + ':' + String( gridSettings[ preferenceGridSetting ] ) );
        }
    } );

    // Updating the value of the preference
    appCtxService.updatePartialCtx( 'preferences.' + gridSettingsPreferenceName, gridSettingsData );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Initialize Grid Settings (from Session Storage or default values)
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 * @param {String} gridEditorMode - active grid Editor mode
 * @returns {object} true every time to indicate that the settings are initialized and the max count of variants to be loaded in grid
 */
export let initGridSettings = ( vmGridSettings, gridEditorMode ) => {
    let gridSettings = {}; // Clear before re-initializing

    // Use default values if something is not set (i.e. parameters added a different times)
    _initMissingGridSettingsWithDefaultValues( gridSettings, gridEditorMode );

    if( gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        let maxLoadPref = appCtxService.getCtx( 'preferences.PCA_LoadVariantsMaxCountInGrid' );
        let newLoadPref = appCtxService.getCtx( 'preferences.PCA_NewVariantsMaxCountInGrid' );
        let loadVariantsMaxCountInGrid = maxLoadPref && maxLoadPref[ 0 ];
        let newVariantsMaxCountInGrid = newLoadPref && newLoadPref[ 0 ];
        //the max nr of variants in grid is per preference or 10 as default value
        //the max nr of new variants in grid is per preference or 2 as default value
        gridSettings.loadVariantsMaxCountInGrid = loadVariantsMaxCountInGrid ? parseInt( loadVariantsMaxCountInGrid, 10 ) : pca0CommonConstants.GRID_CONSTANTS.DEFAULT_LOAD_VARIANTS_MAX_COUNT_IN_GRID;
        gridSettings.newVariantsMaxCountInGrid = newVariantsMaxCountInGrid ? parseInt( newVariantsMaxCountInGrid, 10 ) :  pca0CommonConstants.GRID_CONSTANTS.DEFAULT_NEW_VARIANTS_MAX_COUNT_IN_GRID;
    } else {
        // Save 'showPropsInfoInGrid' on context
        // This is necessary for Header initialization
        // When Header is initialized (headerComponent defined in propertyRendererTemplates)
        // we need access to showPropsInfoInGrid flag which is in ViewModel Data (not available)
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.showPropsInfoInGrid', gridSettings.showPropsInfoInGrid );
    }

    // Update atomic data
    vmGridSettings.setAtomicData( gridSettings );

    // returning true every time to indicate that the settings are initialized
    return true;
};


/**
 * Initialize Settings Panel with data from Grid Settings atomic data
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings> passed from parent component
 * @param {Object} fields - Object containing fields to be updated in the Settings Panel
 * @returns {Object} Info Container of active settings to initialize data and components in Settings Panel
 */
export let initializeSettingsPanel = ( vmGridSettings, fields ) => {
    let gridSettings = vmGridSettings.getValue();

    // Iterate over all the fields, if the field is present in the gridSettings object, update the field with 
    // the value from the gridSettings object
    Object.keys( fields ).forEach( fieldKey => {
        let field = fields[fieldKey];
        if ( field && gridSettings.hasOwnProperty( fieldKey ) ) {
            field.update( gridSettings[fieldKey] );
        }
    } );

    // For slider we don't update using fields.update method
    // Thus returning all the values in grid settings to initalize the slider value based on slider in output of caller
    return { ...vmGridSettings.getValue() };
};

/**
 * Apply Settings
 * Synchronize Session Storage with values coming from Settings Panel
 * Update preference on "Show all Variability" entry
 * @param {Object} GridSettingsDataForColumnHeaderFromPanel - The grid settings object for the column header.
 * @param {Object} gridSettingsFromPanel - gridSettings (Settings Panel ViewModel data)
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @param {String} gridEditorMode - mode of the grid editor(ex: "Cfg0AbsMatrixRule", "multiSvrGrid")
 * @return {Object} set of Boolean flags/Objects to trigger Grids update
 */
export let applyGridSettings = ( GridSettingsDataForColumnHeaderFromPanel, gridSettingsFromPanel, vmGridSettings, displayMode, gridEditorMode ) => {
    // NOTE: need to implement smarter logic like FSC Settings Panel
    // LCS-1143896 - Implement Smarter logic like FSC for pca0GRID for applying settings
    // to check on actual changes for the APPLY button to appear.

    let gridSettingsDataForColumnHeader = { ...GridSettingsDataForColumnHeaderFromPanel.getAtomicData() };
    let gridSettings = vmGridSettings.value;
    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;

    // Initialize flags for triggering updates
    let mustTriggerNewColumnWidthUpdate = -1;
    let mustTriggerHeaderOrientationChange = false;
    let mustTriggerUpdateIncludeSeverityInComparison = false;
    let mustTriggerPropertiesInformationChanged = false;
    let mustTriggerConfigurationSectionsChanged = false;

    // Column Width
    // Adjust column Width on both tables
    let columnWidthChanged = false;
    if( gridSettingsDataForColumnHeader.columnWidth.dbValue[ 0 ].sliderOption.value !== gridSettings.columnWidth ) {
        gridSettings.columnWidth = gridSettingsDataForColumnHeader.columnWidth.dbValue[ 0 ].sliderOption.value;
        columnWidthChanged = true;
    }else if( gridSettingsDataForColumnHeader.useCompactColumnWidth.valueUpdated ) {
        gridSettings.useCompactColumnWidth = gridSettingsDataForColumnHeader.useCompactColumnWidth.dbValue;
        // Updating the column width when user enters and exists from compact mode.
        gridSettings.columnWidth = gridSettings.useCompactColumnWidth ?
            pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH :
            veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.COLUMN_WIDTH;
        columnWidthChanged = true;
    }
    if( columnWidthChanged ) {
        mustTriggerNewColumnWidthUpdate = gridSettings.columnWidth;
        gridSettings.useCompactColumnWidth = gridSettings.columnWidth === pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    }

    // Column Header ( Vertical/Horizontal)
    if( gridSettingsDataForColumnHeader.useVerticalColumnHeader.valueUpdated &&
        gridSettingsDataForColumnHeader.useVerticalColumnHeader.dbValue !== gridSettings.useVerticalColumnHeader ) {
        mustTriggerHeaderOrientationChange = true;
        gridSettings.useVerticalColumnHeader = gridSettingsDataForColumnHeader.useVerticalColumnHeader.dbValue;

        // When user enters and exits from vertical mode the compact mode will be same as vertical mode until user manually changes.
        if( !gridSettingsDataForColumnHeader.useCompactColumnWidth.valueUpdated && !columnWidthChanged ) {
            gridSettings.useCompactColumnWidth = gridSettingsDataForColumnHeader.useVerticalColumnHeader.dbValue;

            // Updating the column width when user enters and exists from vertical mode.
            gridSettings.columnWidth = gridSettings.useCompactColumnWidth
                ? pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH
                : veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.COLUMN_WIDTH;
            mustTriggerNewColumnWidthUpdate = gridSettings.columnWidth;
        }
    }

    // Include Severity In Comparison
    if( gridSettingsFromPanel.includeSeverityInComparison.valueUpdated ) {
        mustTriggerUpdateIncludeSeverityInComparison = true;
        gridSettings.includeSeverityInComparison = gridSettingsFromPanel.includeSeverityInComparison.dbValue;
    }

    // Show 'Properties Information'
    if( gridSettingsFromPanel.showPropsInfoInGrid.valueUpdated &&
            gridSettingsFromPanel.showPropsInfoInGrid.dbValue !== gridSettings.showPropsInfoInGrid ) {
        gridSettings.showPropsInfoInGrid = gridSettingsFromPanel.showPropsInfoInGrid.dbValue;
        // Update Context: this flag is needed to properly update Header Component
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.showPropsInfoInGrid', gridSettings.showPropsInfoInGrid );
        mustTriggerPropertiesInformationChanged = true;
    }

    // Show Subject in Top Grid
    // NOTE: if GridEditor is in Matrix mode, showSubjectInTopGrid should always be false
    if( isSnOMatrixGridEditor ) {
        gridSettings.showSubjectInTopGrid = false;
    } else if( gridSettingsFromPanel.showSubjectInTopGrid.valueUpdated &&
        gridSettingsFromPanel.showSubjectInTopGrid.dbValue !== gridSettings.showSubjectInTopGrid ) {
        gridSettings.showSubjectInTopGrid = gridSettingsFromPanel.showSubjectInTopGrid.dbValue;
        mustTriggerConfigurationSectionsChanged = true;
    }

    // Show all variability in the Grid Editor
    if( gridSettingsFromPanel.useAllVariabilityInGridEditor.valueUpdated &&
            gridSettingsFromPanel.useAllVariabilityInGridEditor.dbValue !== gridSettings.useAllVariabilityInGridEditor ) {
        gridSettings.useAllVariabilityInGridEditor = gridSettingsFromPanel.useAllVariabilityInGridEditor.dbValue;

        // Update context
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.getUseAllVariabilityInGridEditor', gridSettings.useAllVariabilityInGridEditor );

        let eventData = {
            isUidToBeLoadedFromTree: true
        };
        editHandlerService.leaveConfirmation().then( () => {
            eventBus.publish( 'Pca0ConstraintsGrid.loadConstraintGridData', eventData );
            if( displayMode.wasAnyConstraintsSelected ) {
                displayMode.activeDisplayMode = pca0Constants.GRID_DISPLAY_MODE.FEATURES;
            }
        } );
    }

    // Show Legend
    // NOTE: if GridEditor is not in Matrix mode, showLegend should always be false
    if( !isSnOMatrixGridEditor ) {
        gridSettings.showLegend = false;
    } else if( gridSettingsFromPanel.showLegend.valueUpdated &&
        gridSettingsFromPanel.showLegend.dbValue !== gridSettings.showLegend ) {
        gridSettings.showLegend = gridSettingsFromPanel.showLegend.dbValue;
    }

    // Update preference
    _setGridSettingsInPreference( gridSettings, gridEditorMode );

    // Update Atomic Data
    vmGridSettings.update( gridSettings );

    return { mustTriggerNewColumnWidthUpdate,
        mustTriggerHeaderOrientationChange,
        mustTriggerUpdateIncludeSeverityInComparison,
        mustTriggerPropertiesInformationChanged,
        mustTriggerConfigurationSectionsChanged };
};

/**
 * Update Width of all Table Columns
 * Action is performed when user clicks on "Apply" button in Settings Panel
 * @param {Object} columnWidth - Column Width (px)
 * @param {Array} treeDataProvider - Data provider for Grid Editor
 * @param {Object} variabilityProps - Atomic Data variabilityData
 * @returns {Object} - New Column Configuration to be dispatched on grid
 */
export let updateColumnWidth = function( columnWidth, treeDataProvider, variabilityProps ) {
    let columnConfig = { columns: [] };
    let colConfig = [ ...treeDataProvider.columnConfig.columns ];
    _.forEach( colConfig, column => {
        if( !column.isColumnFromCots ) {
            column.width = columnWidth;
            column.pixelWidth = columnWidth;
        } else if ( column.pixelWidth && !column.hiddenFlag ) {
            column.width = column.pixelWidth;
        }
        column.minWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
        column.maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
    } );
    columnConfig.columns = colConfig;

    // Update atomic data <variabilityProps> which is used to construct columnConfig
    let variabilityData = { ...variabilityProps.getValue ? variabilityProps.getValue() : variabilityProps.getAtomicData() };
    _.forEach( variabilityData.columnProperties, column => {
        if( !column.isColumnFromCots ) {
            column.columnWidth = columnWidth;
        } else  {
            // when user updates first col width and try to change columns width settings
            column.columnWidth = column.pixelWidth;
        }
    } );
    variabilityProps.setAtomicData ? variabilityProps.setAtomicData( variabilityData ) : variabilityProps.update( variabilityData );

    return columnConfig;
};

/**
 * Changes the header orientation and the header size of a grid.
 * @param {Object} columnConfig - The column configuration from data provider.
 * @param {boolean} useVerticalColumnHeader - Whether to use vertical column headers.
 * @param {String} gridId - grid ID.
 * @param {string} gridEditorMode - Active grid Editor mode
 * @param {Object} gridOptions - grid options.
 * @returns {Object} The updated column configuration object.
 */
export let updateGridHeaderOrientationAndSize = ( columnConfig, useVerticalColumnHeader, gridId, gridEditorMode, gridOptions ) => {
    // Updating the header orientation
    columnConfig.columns.forEach( column => {
        column.isVertical = useVerticalColumnHeader;
    } );

    if( !useVerticalColumnHeader ) {
        _removeHeaderSizeLocalStorage( gridId );
        // Updating the header height
        if ( gridOptions ) {
            // for multiSVr gridOptions will be undefined hence only need to check ABS_MATRIX_RULE
            gridOptions.headerHeight = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE ? 24 : 40;
            gridOptions.enableHeaderResizing = false;
        }
    }
    // We need to refresh the SWA because header orientation  and the gridOption 'enableHeaderResizing' can not be enabled dynamically
    eventBus.publish( 'Pca0GridEditorWrapper.refresh' );
    return columnConfig;
};

/**
 * Updates the atomic data for a column header in the grid settings.
 *
 * @param {Object} data - updated data for the column header.
 * @param {Object} gridSettingsDataForColumnHeader - The grid settings object for the column header.
 */
export let updateAtomicDataForColumnHeader = ( data, gridSettingsDataForColumnHeader ) => {
    gridSettingsDataForColumnHeader.update( data );
};

export default exports = {
    initGridSettings,
    initializeSettingsPanel,
    applyGridSettings,
    updateColumnWidth,
    updateGridHeaderOrientationAndSize,
    updateAtomicDataForColumnHeader
};
