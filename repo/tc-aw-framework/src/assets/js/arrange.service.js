// Copyright (c) 2022 Siemens

/**
 * @module js/arrange.service
 */
import appCtxSvc from 'js/appCtxService';
import awColumnFilterService from 'js/awColumnFilterService';
import _ from 'lodash';
import commandConfigurationService from 'js/commandConfigurationService';
import eventBus from 'js/eventBus';
import preferenceService from 'soa/preferenceService';
import tcarrangeService from './tcarrange.service';
import dialogService from 'js/dialogService';

let exports = {};

// State constants for tracking if a column would require only a save or a save and load of all columns
const STATE_LOAD_COLUMN = 'load';
const STATE_PREVENT_LOAD = 'prevent';
const STATE_NONE = 'none';

/**
 * Set the visibility of the columns
 *
 * @param {Array} columns - columnDefs
 */
let setVisibilityOfColumns = function( columns ) {
    for( const currentColumn of columns ) {
        currentColumn.visible = currentColumn.dbValue;
        currentColumn.hiddenFlag = !currentColumn.dbValue;
    }
};

/**
 * Remove sort from columns if saving disabled.
 *
 * @param {Array} columns - table columns
 * @param {object} arrangeData - data sent to arrange panel
 */
let processSortOfColumnsForSaving = function( columns, arrangeData ) {
    if ( arrangeData.enableSaveSortCriteria === false ) {
        for( let currentColumn of columns ) {
            currentColumn.sortPriority = 0;
            currentColumn.sortDirection = '';
        }
    }
};

/**
 * Return the column config that has set 'isCurrent'.
 *
 * @param {Array} columnConfigs - saved/loaded/existing named column configs
 * @returns {Object} the current named column config, or empty object
 */
let getCurrentColumnConfig = function( columnConfigs ) {
    let returnColumnConfig = {};
    if( _.isArray( columnConfigs ) ) {
        _.forEach( columnConfigs, function( columnConfig ) {
            if( columnConfig.isCurrent ) {
                returnColumnConfig = columnConfig;
                return false;
            }
        } );
    }
    return returnColumnConfig;
};

/**
 * Unload the loaded column config from the panel.
 *
 * @param {ViewModel} data - arrange panel viewModel
 * @param {Object} removedColumnConfig - removed/deleted column config
 */
let unloadColumnConfig = function( data, removedColumnConfig ) {
    data.arrangeData.loadedColumnConfigUid = data.arrangeData.originalColumnConfig.columnConfigUid;
    data.newColumnConfigName.dbValue = removedColumnConfig.columnConfigName;
    data.newColumnConfig.dbValue = true;
    data.columnConfigName.uiValue = '';
    data.arrangeData.originalColumnConfig.columnConfig.columns = _.cloneDeep( data.arrangeData.originallyLoadedColummnDefs );
};

/**
 * Set the arrange status for button visibility.
 *
 * @param {ViewModel} data - arrange panel viewModel
 */
let setArrangeStatus = function( data ) {
    if( data.newColumnConfig.dbValue ) {
        data.arrangeData.isArrange = false;
        data.arrangeData.isArrangeAndSave = false;
        data.arrangeData.isArrangeAndCreate = true;
    } else if( data.arrangeData.isExistingColumnConfigLoaded || data.arrangeData.originalColumnConfig && data.arrangeData.originalColumnConfig.columnConfigName ) {
        data.arrangeData.isArrange = false;
        data.arrangeData.isArrangeAndSave = true;
        data.arrangeData.isArrangeAndCreate = false;
    } else {
        data.arrangeData.isArrange = true;
        data.arrangeData.isArrangeAndSave = false;
        data.arrangeData.isArrangeAndCreate = false;
    }
};

/**
 * Create a column object for named column config SOAs.
 *
 * @param {Object} column - column info from arrange panel
 * @returns {Object} - SOA column object
 */
let createNamedSoaColumn = function( column ) {
    return {
        displayName: column.displayName,
        associatedTypeName: column.typeName ? column.typeName : column.associatedTypeName,
        propertyName: column.propertyName,
        pixelWidth: column.pixelWidth,
        columnOrder: column.columnOrder,
        hiddenFlag: column.hiddenFlag,
        sortPriority: column.sortPriority,
        sortDirection: column.sortDirection,
        filters: column.savedFilters || column.filters,
        isTextWrapped: column.isTextWrapped,
        filterDefinitionKey: column.filterDefinitionKey,
        isFilteringEnabled: column.isFilteringEnabled,
        dataType: column.dataType,
        isFrozen: column.isFrozen
    };
};

/**
 * Set the columns for filteredColumnDefs based on displayName of column and filter string.
 *
 * @param {*} filter - filter string from user
 * @param {*} columnDefs - all columns to loop through
 * @param {*} filteredColumnDefs - array of columns to push found columns to
 * @param {*} startIndex - start of columns to filter from
 * @param {*} pageSize - loop through this many columns when filtering
 */
let setFilteredColumns = function( filter, columnDefs, filteredColumnDefs, startIndex = 0, pageSize = columnDefs.length ) {
    for( let i = startIndex; i < startIndex + pageSize; i++ ) {
        const columnDef = columnDefs[ i ];
        if( filter !== '' ) {
            let displayName = columnDef.displayName.toLocaleLowerCase().replace( /\\|\s/g,
                '' );
            if( displayName.indexOf( filter.toLocaleLowerCase().replace( /\\|\s/g, '' ) ) !== -1 ) {
                // Filter matches a column name
                filteredColumnDefs.push( columnDef );
            }
        } else {
            // No filter
            filteredColumnDefs.push( columnDef );
        }
    }
};

/**
 * Get the final arranged columns in a single list of static/displayed/available columns.
 *
 * @param {Object} arrangeData - All arrange panel information.
 * @param {boolean} includeClientColumns - Whether to include client columns in the final list
 * @returns {Array} Final columns list from arrange panel
 */
let getOutputColumns = function( arrangeData, includeClientColumns ) {
    let arrangeColumns = _.concat( arrangeData.columnDefs, arrangeData.hiddenAvailableColumnDefs );
    setVisibilityOfColumns( arrangeColumns );
    if ( includeClientColumns && arrangeData.clientColumns.length ) {
        arrangeColumns = _.concat( arrangeColumns, arrangeData.clientColumns );
    }
    arrangeColumns = _.orderBy( arrangeColumns, [ 'columnOrder' ], [ 'asc' ] );
    return arrangeColumns;
};

/**
 * Determines if a column is arrangeable.
 *
 * @param {object} column - The column to check.
 * @param {boolean} useStaticFirstCol - Whether to use a static first column.
 * @param {number} columnIndex - The index of the column.
 * @returns {boolean} False if the column is arrangeable, true otherwise.
 */
const isNotColumnArrangeable = function( column, useStaticFirstCol, columnIndex ) {
    return column.isClientColumn || column.enableColumnHiding === false && ( useStaticFirstCol && columnIndex !== 0 || !useStaticFirstCol );
};

/**
 * Set the disability of the buttons for arrange.
 *
 * @param {boolean} isDisabled - whether to disable/enable arrange buttons
 */
export let setDisabilityOfArrange = function( isDisabled ) {
    let buttonElements = document.getElementsByClassName( 'arrange_submitButton' );
    _.forEach( buttonElements, function( currentButtonElement ) {
        if( isDisabled ) {
            currentButtonElement.classList.add( 'disabled' );
        } else {
            currentButtonElement.classList.remove( 'disabled' );
        }
    } );
};

/**
 * Create the SOA columns for named column config input.
 *
 * @param {Object} arrangeData - contains arrange panel information
 * @param {Array} columns - column defs of the column config from arrange panel
 * @returns {Array} array of columns in simplified format
 */
export let createNamedSoaColumns = function( arrangeData ) {
    // Skip first column if useStaticFirstCol is true
    let soaColumns = [];
    let arrangeColumns = getOutputColumns( arrangeData );
    processSortOfColumnsForSaving( arrangeColumns, arrangeData );
    let soaArrangeColumns = arrangeColumns.map( function( currentColumn ) {
        return createNamedSoaColumn( currentColumn );
    } );

    soaColumns.push( ...soaArrangeColumns );

    return _.uniqBy( soaColumns, function( column ) {
        return tcarrangeService.getColumnUid( column, column.propertyName );
    } );
};

/**
 * Get the clientScopeUri of the current table/sublocation.
 *
 * @returns {String} clientScopeUri
 */
export let getClientScopeUri = function() {
    return appCtxSvc.ctx.ArrangeClientScopeUI.objectSetUri || appCtxSvc.ctx.sublocation.clientScopeURI;
};

/**
 * Mark arrange data as dirty when column visibility changed.
 *
 * @param {ViewModel} data - arrange panel viewModel
 * @returns {Object} arrange data and columnConfig data
 */
export let columnVisibilityChanged = function( data ) {
    data = {
        arrangeData: _.cloneDeep( data.arrangeData ),
        newColumnConfig: _.cloneDeep( data.newColumnConfig )
    };

    let allColumnsVisible = true;
    data.arrangeData.isColumnsSelected = false;
    for( let element of data.arrangeData.columnDefs ) {
        // Name column is always visible
        if( ( element.propertyName === 'object_name' || data.arrangeData.staticColumn && element.propertyName === data.arrangeData.staticColumn.propertyName ) && !element.dbValue ) {
            element.dbValue = true;
        }

        if( element.dbValue === true ) {
            data.arrangeData.isColumnsSelected = true;
        }
    }

    for( let element of data.arrangeData.columnDefs ) {
        if( !element.dbValue ) {
            allColumnsVisible = false;
            break;
        }
    }

    data.arrangeData.allColumnsVisible = allColumnsVisible;
    markDirty( data );
    let output = {};
    output.arrangeData = data.arrangeData;
    output.newColumnConfig = data.newColumnConfig;
    return output;
};

/**
 * Call the columnConfigLoadRedirect for arrange panel.
 *
 * @param {Object} loadedColumnConfig - named column config
 */
export let preLoadColumnConfig = function( loadedColumnConfig ) {
    eventBus.publish( 'arrangePanel.columnConfigLoadRedirect', loadedColumnConfig );
};

/**
 * Load an existing column configuration into the arrange panel.
 *
 * @param {ViewModel} data - View Model of the arrange panel
 * @param {Object} loadedColumnConfig - Column config to load in the arrange panel
 * @returns {Object} All new column config information
 */
export let loadExistingColumnConfig = function( data, loadedColumnConfig ) {
    if( loadedColumnConfig?.columnConfig?.columns ) {
        data.arrangeData.columnDefs.length = 0;
        data.arrangeData.orgColumnDefs.length = 0;
        data.arrangeData.availableColumnDefs.length = 0;
        data.arrangeData.hiddenAvailableColumnDefs.length = 0;
        data.arrangeData.staticColumn = null;

        data.arrangeData.loadedColumnConfig = loadedColumnConfig;
        data.arrangeData.loadedColumnConfigUid = loadedColumnConfig.columnConfigUid;
        data.columnConfigName.uiValue = loadedColumnConfig.columnConfigName || '';
        data.newColumnConfigName.dbValue = loadedColumnConfig.columnConfigName + '_copy';
        data.arrangeData.isDefaultColumnConfigLoaded = tcarrangeService.isDefaultColumnConfig( loadedColumnConfig.columnConfigUid );
        data.arrangeData.isExistingColumnConfigLoaded = data.arrangeData.loadedColumnConfigUid !== data.arrangeData.originalColumnConfig.columnConfigUid;

        for( let i = 0; i < loadedColumnConfig.columnConfig.columns.length; ++i ) {
            let column = loadedColumnConfig.columnConfig.columns[ i ];

            if( column.displayName && column.displayName !== '' ) {
                let columnDef = tcarrangeService.initializeColumnDef( column, column.columnOrder, column.propertyName );
                // Skip first column if useStaticFirstCol is true
                if( data.arrangeData.useStaticFirstCol && i === 0 ) {
                    data.arrangeData.staticColumn = columnDef;
                }
                if( columnDef.visible ) {
                    data.arrangeData.columnDefs.push( columnDef );
                    let orgColumnDef = _.clone( columnDef );
                    data.arrangeData.orgColumnDefs.push( orgColumnDef );
                } else {
                    data.arrangeData.availableColumnDefs.push( columnDef );
                }
            }
        }

        data.arrangeData.availableColumnDefs = _.sortBy( data.arrangeData.availableColumnDefs, function( column ) {
            return column.displayName;
        } );

        data.arrangeData.hiddenAvailableColumnDefs = data.arrangeData.availableColumnDefs;

        // Reset panel inputs
        data.newColumnConfig.dbValue = false;
        data.filterBox.dbValue = '';
        data.arrangeData.filter = '';
        data.arrangeData.isLoadingAdditionalColumns = false;

        data.arrangeData.filteredColumnDefs = [];
        setFilteredColumns( data.arrangeData.filter, data.arrangeData.columnDefs, data.arrangeData.filteredColumnDefs );

        data.arrangeData.filteredAvailableColumnDefs = [];
        setFilteredColumns( data.arrangeData.filterAvailable, data.arrangeData.availableColumnDefs, data.arrangeData.filteredAvailableColumnDefs );

        data.dataProviders.dataProviderColumnConfigs.update( data.arrangeData.filteredColumnDefs, data.arrangeData.filteredColumnDefs.length );
        data.dataProviders.dataProviderAvailableColumnConfigs.update( data.arrangeData.filteredAvailableColumnDefs, data.arrangeData.filteredAvailableColumnDefs.length );
        setDisabilityOfArrange( false );
        let output = {};
        output.arrangeData = data.arrangeData;
        output.newColumnConfig = data.newColumnConfig;
        output.columnConfigName = data.columnConfigName;
        output.newColumnConfigName = data.newColumnConfigName;
        output.filterBox = data.filterBox;
        output.dataProviderColumnConfigs = data.dataProviders.dataProviderColumnConfigs;
        output.dataProviderAvailableColumnConfigs = data.dataProviders.dataProviderAvailableColumnConfigs;
        return output;
    }
};

/**
 * Call the columnConfigRemoveRedirect for arrange panel.
 *
 * @param {Object} namedColumnConfig - named column config to remove
 */
export let preRemoveColumnConfig = function( namedColumnConfig ) {
    eventBus.publish( 'arrangePanel.columnConfigRemoveRedirect', namedColumnConfig );
};

/**
 * Remove the column config from the list of existing/saved.
 *
 * @param {ViewModel} data - View Model of the arrange panel
 * @param {Object} columnConfig - column config to remove
 * @returns {Object} saved column configs
 */
export let removeNamedColumnConfigFromProvider = function( data, columnConfig ) {
    let removedConfigs = _.remove( data.arrangeData.savedColumnConfigs, function( currentConfig ) {
        return currentConfig.columnConfigUid === columnConfig.columnConfigUid;
    } );

    if( removedConfigs[ 0 ] ) {
        if( removedConfigs[ 0 ].isCurrent ) {
            reset( data.arrangeData );
        } else if( removedConfigs[ 0 ].columnConfigUid === data.arrangeData.loadedColumnConfigUid ) {
            unloadColumnConfig( data, removedConfigs[ 0 ] );
            preLoadColumnConfig( data.arrangeData.originalColumnConfig );
        }
    }
    return data.arrangeData.savedColumnConfigs;
};

/**
 * Filter and return list of column configs.
 *
 * @param {viewModelJson} data - The view model data
 */
export let actionFilterList = async function( data, popupId ) {
    let output = {};
    if( data.arrangeData.columnDefs === null ) {
        let arrangeClientScopeUI = appCtxSvc.getCtx( 'ArrangeClientScopeUI' );
        data.arrangeData.columnConfigId = arrangeClientScopeUI.columnConfigId;
        data.arrangeData.objectSetUri = arrangeClientScopeUI.objectSetUri;
        data.arrangeData.clientScopeUri = arrangeClientScopeUI.objectSetUri || appCtxSvc.ctx.sublocation.clientScopeURI;
        data.arrangeData.operationType = arrangeClientScopeUI.operationType;
        data.arrangeData.name = arrangeClientScopeUI.name;
        data.arrangeData.enableSaveSortCriteria = arrangeClientScopeUI.enableSaveSortCriteria;
        data.arrangeData.useStaticFirstCol = arrangeClientScopeUI.useStaticFirstCol;
        data.arrangeData.columnsData = arrangeClientScopeUI.columnsData;
        data.arrangeData.getAdditionalColumnsAction = arrangeClientScopeUI.getAdditionalColumnsAction;
        data.arrangeData.hasAdditionalColumnsAction = arrangeClientScopeUI.hasAdditionalColumnsAction;
        data.arrangeData.popupId = popupId;

        data.arrangeData.originalColumnConfig = getCurrentColumnConfig( data.arrangeData.savedColumnConfigs );
        data.arrangeData.isDefaultColumnConfigLoaded = tcarrangeService.isDefaultColumnConfig( data.arrangeData.originalColumnConfig.columnConfigUid );
        data.arrangeData.loadedColumnConfigUid = data.arrangeData.originalColumnConfig.columnConfigUid;
        data.columnConfigName.uiValue = data.arrangeData.originalColumnConfig.columnConfigName || '';
        let newColumnConfigDefaultName = data.arrangeData.originalColumnConfig.columnConfigName ? data.arrangeData.originalColumnConfig.columnConfigName + '_copy' : data.i18n.defaultNewColumnConfigName;
        data.newColumnConfigName.dbValue = newColumnConfigDefaultName;
        data.arrangeData.dataProviders = data.dataProviders;

        data.arrangeData.columnDefs = [];
        data.arrangeData.availableColumnDefs = [];
        data.arrangeData.hiddenAvailableColumnDefs = [];
        data.arrangeData.orgColumnDefs = [];
        data.arrangeData.originallyLoadedColummnDefs = [];//The column Defs with which the arrange panel is loaded with.
        data.arrangeData.clientColumns = [];
        data.arrangeData.savedColumnFilters = [];
        let columnOrder = 100;
        for( let i = 0; i < arrangeClientScopeUI.columns.length; ++i ) {
            let column = arrangeClientScopeUI.columns[ i ];

            if( isNotColumnArrangeable( column, data.arrangeData.useStaticFirstCol, i ) ) {
                if ( column.isClientColumn ) {
                    data.arrangeData.clientColumns.push( column );
                }
                continue;
            }
            if( column.savedFilters?.length > 0 ) {
                _.forEach( column.savedFilters, function( filter ) {
                    let savedColumnsFiltersInfo = {
                        columnName: column.field || column.propertyName,
                        operation: filter?.operation,
                        values: filter?.values
                    };
                    data.arrangeData.savedColumnFilters.push( savedColumnsFiltersInfo );
                } );
            }

            if( column.displayName && column.displayName !== '' ) {
                let columnDefPropName = column.field ? column.field : column.name;
                let columnDef = tcarrangeService.initializeColumnDef( column, columnOrder, columnDefPropName );
                columnOrder += 100;
                // Skip first column if useStaticFirstCol is true
                if( data.arrangeData.useStaticFirstCol && i === 0 ) {
                    data.arrangeData.staticColumn = columnDef;
                }
                data.arrangeData.originallyLoadedColummnDefs.push( columnDef );
                if( columnDef.visible ) {
                    data.arrangeData.columnDefs.push( columnDef );
                    let orgColumnDef = _.clone( columnDef );
                    data.arrangeData.orgColumnDefs.push( orgColumnDef );
                } else {
                    data.arrangeData.availableColumnDefs.push( columnDef );
                }
            }
        }

        data.arrangeData.availableColumnDefs = _.sortBy( data.arrangeData.availableColumnDefs, function( column ) {
            return column.displayName;
        } );

        data.arrangeData.hiddenAvailableColumnDefs = data.arrangeData.availableColumnDefs;

        appCtxSvc.unRegisterCtx( 'ArrangeClientScopeUI' );

        if( !data.arrangeData.operationType && appCtxSvc.ctx.searchResponseInfo && appCtxSvc.ctx.searchResponseInfo.columnConfig &&
            appCtxSvc.ctx.searchResponseInfo.columnConfig.operationType ) {
            data.arrangeData.operationType = appCtxSvc.ctx.searchResponseInfo.columnConfig.operationType
                .toLowerCase();
        }

        let columnConfigNameChangeEvent = function() {
            data.columnConfigName.dirty = true;
            if( !data.arrangeData.loadedColumnConfig || data.arrangeData.loadedColumnConfig !== data.columnConfigName.uiValue ) {
                data.arrangeData.isExistingColumnConfigLoaded = false;
                data.arrangeData.isDefaultColumnConfigLoaded = false;
            }
            markDirty( data );
        };

        if( data.arrangeData.columnConfigName ) {
            data.columnConfigName.propApi = data.columnConfigName.propApi || {};
            data.columnConfigName.propApi.fireValueChangeEvent = columnConfigNameChangeEvent;
        }
    }

    if( data.filterBox.dbValue ) {
        data.arrangeData.filter = data.filterBox.dbValue;
    } else {
        data.arrangeData.filter = '';
    }

    if( data.filterAvailableBox.dbValue ) {
        data.arrangeData.filterAvailable = data.filterAvailableBox.dbValue;
    } else {
        data.arrangeData.filterAvailable = '';
    }

    data.arrangeData.filteredColumnDefs = [];
    setFilteredColumns( data.arrangeData.filter, data.arrangeData.columnDefs, data.arrangeData.filteredColumnDefs );

    data.arrangeData.filteredAvailableColumnDefs = [];
    setFilteredColumns( data.arrangeData.filterAvailable, data.arrangeData.availableColumnDefs, data.arrangeData.filteredAvailableColumnDefs );

    output.arrangeData = data.arrangeData;
    output.dataProviderAvailableColumnConfigs = data.dataProviders.dataProviderAvailableColumnConfigs;
    output.dataProviderColumnConfigs = data.dataProviders.dataProviderColumnConfigs;
    output.columnConfigName = data.columnConfigName;
    output.newColumnConfigName = data.newColumnConfigName;
    return output;
};

/**
 * Initializes the arrangement selection check.
 *
 * @param {Object} data - The data object that contains the list options. This object will be updated with a selection check function.
 */
export let initializeArrangementSelectionCheck = function( data ) {
    data.listOptions = data.listOptions || {};
    data.listOptions.selectionCheck = function( item ) {
        return item.isCurrent;
    };
};

/**
 * Initialize the named column configs from list in input.
 *
 * @param {ViewModel} data - arrange panel view model
 * @param {Object} subPanelContext - context info for arrange panel from table
 * @returns {Object} all the named column configs
 */
export let initializeUserNamedColumnConfigs = function( data, subPanelContext ) {
    let namedColumnConfigs = [];
    let savedColumnConfigs = [];
    let output = {};
    if( subPanelContext ) {
        savedColumnConfigs = subPanelContext.savedColumnConfigs;
    }
    if( _.isArray( savedColumnConfigs ) ) {
        _.forEach( savedColumnConfigs, function( columnConfig ) {
            const isDefault = tcarrangeService.isDefaultColumnConfig( columnConfig.columnConfigUid );
            if( !columnConfig.isAdmin || isDefault ) {
                let newColumnConfig = {
                    propertyName: 'named_column_config',
                    propertyDisplayName: columnConfig.columnConfigName,
                    tooltipDisplayName: columnConfig.columnConfigDetails || columnConfig.columnConfigName,
                    isModifiable: columnConfig.isModifiable,
                    columnConfigUid: columnConfig.columnConfigUid,
                    selected: columnConfig.isCurrent,
                    isCurrent: columnConfig.isCurrent,
                    isDefault: isDefault,
                    getId: function() {
                        return this.columnConfigUid;
                    }
                };
                namedColumnConfigs.push( newColumnConfig );
            }
        } );
    }

    data.userNamedColumnConfigs = namedColumnConfigs;
    output.userNamedColumnConfigs = namedColumnConfigs;
    return output;
};

/**
 * Initialize the named column configs from list in input.
 *
 * @param {ViewModel} data - arrange panel view model
 * @param {Object} subPanelContext - context info for arrange panel from table
 * @returns {Object} all the named column configs
 */
export let initializeAdminNamedColumnConfigs = function( data, subPanelContext ) {
    let namedColumnConfigs = [];
    let savedColumnConfigs = [];
    let output = {};
    if( subPanelContext ) {
        savedColumnConfigs = subPanelContext.savedColumnConfigs;
    }
    if( _.isArray( savedColumnConfigs ) ) {
        _.forEach( savedColumnConfigs, function( columnConfig ) {
            const isDefault = tcarrangeService.isDefaultColumnConfig( columnConfig.columnConfigUid );
            if( columnConfig.isAdmin && !isDefault ) {
                let tooltipDisplayName = columnConfig.columnConfigName;
                if( columnConfig.isAdmin ) {
                    tooltipDisplayName += ' (' + data.i18n.arrangeAdminTitle + ')';
                }
                let newColumnConfig = {
                    propertyName: 'named_column_config',
                    propertyDisplayName: columnConfig.columnConfigName,
                    tooltipDisplayName: columnConfig.columnConfigDetails || tooltipDisplayName,
                    isModifiable: columnConfig.isModifiable,
                    columnConfigUid: columnConfig.columnConfigUid,
                    selected: columnConfig.isCurrent,
                    isCurrent: columnConfig.isCurrent,
                    isDefault: isDefault,
                    getId: function() {
                        return this.columnConfigUid;
                    }
                };

                namedColumnConfigs.push( newColumnConfig );
            }
        } );
    }

    data.adminNamedColumnConfigs = namedColumnConfigs;
    output.adminNamedColumnConfigs = namedColumnConfigs;
    return output;
};

/**
 * Test whether column is in selected list.
 *
 * @param {Object} testColumn - column being tested
 * @param {Object} selectedColumns - columns selected
 * @returns {boolean} whether column is selected or not
 */
const isColumnSelected = function( testColumn, selectedColumns ) {
    let isColumnSelected = false;
    for( const currentColumn of selectedColumns ) {
        if ( currentColumn.uid === testColumn.uid ) {
            isColumnSelected = true;
        }
    }
    return isColumnSelected;
};

/**
 * Update the command condition variables used for visibility and enable.
 *
 * @param {Object} arrangeData - The arrange data
 * @param {UwDataProvider} dataProvider - DataProvider to retrieve selected objects in displayed columns
 * @param {Object} eventData - eventData to retrieve selected objects
 */
const updateCommandConditionVariables = function( arrangeData, dataProvider, eventData = {} ) {
    let selectedColumns = eventData.selectedObjects?.length ? eventData.selectedObjects : dataProvider.selectedObjects;
    let updatedSelectedColumns = _.intersectionBy( arrangeData.columnDefs, selectedColumns, 'uid' );
    if ( arrangeData.staticColumn && arrangeData.columnDefs.length > 1 && isColumnSelected( arrangeData.columnDefs[1], updatedSelectedColumns ) ) {
        arrangeData.isColumnBelowStaticSelected = true;
    } else {
        arrangeData.isColumnBelowStaticSelected = false;
    }
};

/**
 * Select one or more columns.
 *
 * @param {viewModelJson} data - The view model data
 * @param {viewModelJson} eventData - Event data
 * @returns {Object} dataproviders for displayed and available columns
 */
export let selectColumn = function( data, eventData ) {
    data = {
        dataProviders: _.cloneDeep( data.dataProviders ),
        arrangeData: data.arrangeData
    };

    let selectedColumns = eventData.selectedObjects.length ? eventData.selectedObjects : data.dataProviders.dataProviderColumnConfigs.selectedObjects;
    if( selectedColumns.length > 0 ) {
        // Set selectedColumns array to the order they appear on the arrange panel, not the order in which they were added to the selection
        let updatedSelectedColumns = _.intersectionBy( data.arrangeData.columnDefs, selectedColumns, 'uid' );
        if( updatedSelectedColumns.length > 0 ) {
            data.dataProviders.dataProviderColumnConfigs.selectionModel.setSelection( updatedSelectedColumns );
            updateCommandConditionVariables( data.arrangeData, data.dataProviders.dataProviderColumnConfigs, eventData );
        }
        data.dataProviders.dataProviderAvailableColumnConfigs.selectionModel.setSelection( [] );
    } else {
        if( data.dataProviders.dataProviderColumnConfigs.selectedObjects.length > 0 || eventData.selectedObjects.length > 0 ) {
            data.dataProviders.dataProviderColumnConfigs.selectionModel.setSelection( [] );
        }
    }
    let output = {};
    output.dataProviderAvailableColumnConfigs = data.dataProviders.dataProviderAvailableColumnConfigs;
    output.dataProviderColumnConfigs = data.dataProviders.dataProviderColumnConfigs;
    return output;
};

/**
 * Select one or more columns.
 *
 * @param {viewModelJson} data - The view model data
 * @param {viewModelJson} eventData - Event data
 * @returns {Object} displayed columns dataProvider
 */
export let selectAvailableColumn = function( data, eventData ) {
    data = {
        dataProviders: _.cloneDeep( data.dataProviders ),
        arrangeData: data.arrangeData
    };

    let selectedColumns = eventData.selectedObjects.length ? eventData.selectedObjects : data.dataProviders.dataProviderAvailableColumnConfigs.getSelectedObjects();
    if( selectedColumns.length > 0 ) {
        // Set selectedColumns array to the order they appear on the arrange panel, not the order in which they were added to the selection
        // let updatedSelectedAvailableColumns = _.intersectionBy( data.arrangeData.hiddenAvailableColumnDefs, selectedColumns, 'uid' );
        // data.dataProviders.dataProviderAvailableColumnConfigs.selectionModel.setSelection( updatedSelectedAvailableColumns );
        data.dataProviders.dataProviderColumnConfigs.selectionModel.setSelection( [] );
    } else {
        data.dataProviders.dataProviderAvailableColumnConfigs.selectionModel.setSelection( [] );
    }

    let output = {};
    output.dataProviderColumnConfigs = data.dataProviders.dataProviderColumnConfigs;
    output.dataProviderAvailableColumnConfigs = data.dataProviders.dataProviderAvailableColumnConfigs;
    return output;
};

/**
 * Sets the columnOrder on each columnDef.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 */
let setColumnOrder = function( arrangeData ) {
    // matt(02-28-2024) - instead of re-creating column orders, may need to maintain the column orders and perform swap operations.
    let columnOrder = 100;
    for( const currentColumn of arrangeData.columnDefs ) {
        currentColumn.columnOrder = columnOrder;
        columnOrder += 100;
    }
};

/**
 * Move selected column up.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {viewModelJson} dataProvider - The dataProvider
 * @returns {Object} dataproviders for displayed and available columns
 */
export let moveUp = function( arrangeData, dataProvider ) {
    setColumnOrder( arrangeData );
    dataProvider = _.cloneDeep( dataProvider );

    let selectedColumns = dataProvider.getSelectedObjects();
    _.forEach( selectedColumns, function( column ) {
        for( let i = 0; i < arrangeData.columnDefs.length; ++i ) {
            if( arrangeData.columnDefs[ i ].uid === column.uid && arrangeData.columnDefs[ i - 1 ] !== arrangeData.staticColumn ) {
                arrangeData.columnDefs[ i ] = arrangeData.columnDefs[ i - 1 ];
                arrangeData.filteredColumnDefs[ i ] = arrangeData.columnDefs[ i - 1 ];
                arrangeData.columnDefs[ i - 1 ] = column;
                arrangeData.filteredColumnDefs[ i - 1 ] = column;
                updateCommandConditionVariables( arrangeData, dataProvider );
                break;
            }
        }

        // If the column was not added, then we do not need to load the column when arranging
        if ( arrangeData.columnsLoadInfo[ column.uid ] !== STATE_LOAD_COLUMN ) {
            arrangeData.columnsLoadInfo[ column.uid ] = STATE_PREVENT_LOAD;
        }
    } );

    setColumnOrder( arrangeData );

    eventBus.publish( 'columnChanged', {
        arrangeData: arrangeData
    }, true );

    let output = {};
    output.arrangeData = arrangeData;
    output.dataProviderAvailableColumnConfigs = dataProvider.dataProviderAvailableColumnConfigs;
    output.dataProviderColumnConfigs = dataProvider.dataProviderColumnConfigs;
    return output;
};

/**
 * Move selected column down.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {dataProvider} dataProvider - The dataProvider
 * @returns {Object} dataproviders for displayed and available columns
 */
export let moveDown = function( arrangeData, dataProvider ) {
    setColumnOrder( arrangeData );
    dataProvider = _.cloneDeep( dataProvider );

    let selectedColumns = dataProvider.getSelectedObjects();
    // Iterates through the array of selected columns, starting with the last object (the bottom-most selected column)
    _.forEachRight( selectedColumns, function( column ) {
        for( let i = arrangeData.columnDefs.length - 1; i >= 0; --i ) {
            if( arrangeData.columnDefs[ i ].uid === column.uid && arrangeData.columnDefs[ i + 1 ] && arrangeData.columnDefs[ i ] !== arrangeData.staticColumn ) {
                arrangeData.columnDefs[ i ] = arrangeData.columnDefs[ i + 1 ];
                arrangeData.filteredColumnDefs[ i ] = arrangeData.columnDefs[ i + 1 ];
                arrangeData.columnDefs[ i + 1 ] = column;
                arrangeData.filteredColumnDefs[ i + 1 ] = column;
                updateCommandConditionVariables( arrangeData, dataProvider );
                break;
            }
        }

        // If the column was not added, then we do not need to load the column when arranging
        if ( arrangeData.columnsLoadInfo[ column.uid ] !== STATE_LOAD_COLUMN ) {
            arrangeData.columnsLoadInfo[ column.uid ] = STATE_PREVENT_LOAD;
        }
    } );

    setColumnOrder( arrangeData );

    eventBus.publish( 'columnChanged', {
        arrangeData: arrangeData
    }, true );

    let output = {};
    output.arrangeData = arrangeData;
    output.dataProviderAvailableColumnConfigs = dataProvider.dataProviderAvailableColumnConfigs;
    output.dataProviderColumnConfigs = dataProvider.dataProviderColumnConfigs;
    return output;
};

/**
 * GH Copilot Generated - start
 *
 * Adds new columns to displayed columns data providers.
 *
 * @param {Array} availableColumns - The available columns.
 * @param {Object} selectedColumn - The selected column to be added.
 * @param {Object} arrangeData - The data related to the arrangement.
 * @param {Object} eventData - The data related to the event.
 * @param {boolean} isDropEvent - A flag indicating if the event is a drop event.
 * @param {Array} addedColumns - The selected columns.
 * @returns {boolean} Returns true if the drag operation is from the same list, false otherwise.
 *
 * GH Copilot Generated - end
 */
const addNewColumnsToDisplayedColumnsDataProviders = function( availableColumns, selectedColumn, arrangeData, eventData, isDropEvent, addedColumns ) {
    let localSelectedColumn = selectedColumn;
    const idx = _.findIndex( arrangeData.filteredAvailableColumnDefs, function( availableColumn ) {
        return availableColumn.uid === localSelectedColumn.uid;
    } );
    if ( idx >= 0 ) {
        localSelectedColumn = arrangeData.filteredAvailableColumnDefs[ idx ];
    }
    let isDragFromSameList = false;
    _.remove( availableColumns, function( availableColumn ) {
        return availableColumn.uid === localSelectedColumn.uid;
    } );
    _.remove( arrangeData.filteredAvailableColumnDefs, function( availableColumn ) {
        return availableColumn.uid === localSelectedColumn.uid;
    } );
    _.remove( arrangeData.hiddenAvailableColumnDefs, function( availableColumn ) {
        return availableColumn.uid === localSelectedColumn.uid;
    } );

    localSelectedColumn.visible = true;
    localSelectedColumn.hiddenFlag = false;
    localSelectedColumn.selected = false;
    localSelectedColumn.dbValue = true;

    let insertIndex;
    // Drag and drop on top of
    if ( eventData?.targetObjects?.length && isDropEvent ) {
        const targetColumn = eventData.targetObjects[0];
        const isDropBelowTarget = tcarrangeService.isDropBelowTarget( arrangeData.highlightedElement ) || targetColumn.uid === arrangeData.staticColumn?.uid;
        _.remove( arrangeData.columnDefs, function( availableColumn ) {
            const isSameColumn = availableColumn.uid === localSelectedColumn.uid;
            isSameColumn && ( isDragFromSameList = true );
            return isSameColumn;
        } );
        let insertIndex = _.findIndex( arrangeData.columnDefs, function( column ) {
            return column.uid === targetColumn.uid;
        } );
        isDropBelowTarget && insertIndex++;
        if ( insertIndex < 0 ) {
            arrangeData.columnDefs.push( localSelectedColumn );
        } else {
            arrangeData.columnDefs.splice( insertIndex, 0, localSelectedColumn );
        }

        _.remove( arrangeData.filteredColumnDefs, function( availableColumn ) {
            return availableColumn.uid === localSelectedColumn.uid;
        } );
        insertIndex = _.findIndex( arrangeData.filteredColumnDefs, function( column ) {
            return column.uid === targetColumn.uid;
        } );
        isDropBelowTarget && insertIndex++;
        if ( insertIndex < 0 ) {
            arrangeData.filteredColumnDefs.push( localSelectedColumn );
        } else {
            arrangeData.filteredColumnDefs.splice( insertIndex, 0, localSelectedColumn );
        }
    } else {
        let insertIndex = _.findIndex( arrangeData.columnDefs, function( column ) {
            return column.columnOrder > localSelectedColumn.columnOrder;
        } );
        if ( insertIndex < 0 ) {
            arrangeData.columnDefs.push( localSelectedColumn );
        } else {
            arrangeData.columnDefs.splice( insertIndex, 0, localSelectedColumn );
        }

        insertIndex = _.findIndex( arrangeData.filteredColumnDefs, function( column ) {
            return column.columnOrder > localSelectedColumn.columnOrder;
        } );
        if ( insertIndex < 0 ) {
            arrangeData.filteredColumnDefs.push( localSelectedColumn );
        } else {
            arrangeData.filteredColumnDefs.splice( insertIndex, 0, localSelectedColumn );
        }
    }

    addedColumns.push( localSelectedColumn );
    return isDragFromSameList;
};

/**
 * Move adds selected columns to Table Columns list.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {viewModelJson} dataProviders - The dataProviders
 * @param {viewModelJson} eventData - Event data
 * @returns {Object} arrangeData and displayed columns dataProvider
 */
export let addColumns = function( arrangeData, dataProviders, eventData ) {
    arrangeData = _.cloneDeep( arrangeData );
    const isDropEvent = tcarrangeService.isDropEvent( eventData?.event );
    let selectedAvailableColumns = eventData?.eventTargetObjs || dataProviders.dataProviderAvailableColumnConfigs.getSelectedObjects();
    if ( isDropEvent && arrangeData.draggedColumns ) {
        selectedAvailableColumns = arrangeData.draggedColumns;
    }
    const availableColumnsViewModelCollection = dataProviders.dataProviderAvailableColumnConfigs.getViewModelCollection();
    let availableColumns = availableColumnsViewModelCollection.getLoadedViewModelObjects();
    let availableColumnsLoaded = availableColumns.length;

    if( selectedAvailableColumns ) {
        let addedColumns = [];
        selectedAvailableColumns = _.cloneDeep( selectedAvailableColumns );
        let isDragFromSameList = false;

        _.forEach( selectedAvailableColumns, function( selectedColumn ) {
            if ( !arrangeData.staticColumn || selectedColumn.uid !== arrangeData.staticColumn.uid ) {
                isDragFromSameList = addNewColumnsToDisplayedColumnsDataProviders( availableColumns, selectedColumn, arrangeData, eventData, isDropEvent, addedColumns );
                if ( !isDragFromSameList ) {
                    // If this column was previously removed, then we neither require a save nor a save and load
                    // Otherwise we indicate that the column is added and would require a save and load
                    if ( arrangeData.columnsLoadInfo[ selectedColumn.uid ] === STATE_PREVENT_LOAD ) {
                        arrangeData.columnsLoadInfo[ selectedColumn.uid ] = STATE_NONE;
                    } else {
                        arrangeData.columnsLoadInfo[ selectedColumn.uid ] = STATE_LOAD_COLUMN;
                    }
                }
            }
        } );

        if ( arrangeData.draggedColumns ) {
            setColumnOrder( arrangeData );
            delete arrangeData.draggedColumns;
            delete arrangeData.draggedDataProviderName;
        }

        tcarrangeService.unhighlightDisplayedDropArea( arrangeData.highlightedElement );

        eventBus.publish( 'columnChanged', {
            arrangeData: arrangeData,
            selectedColumns: addedColumns,
            disableSelect: isDragFromSameList
        }, true );

        const totalAvailableColumnsRemoved = availableColumnsLoaded - availableColumns.length;
        dataProviders.dataProviderAvailableColumnConfigs.update( availableColumns, availableColumnsViewModelCollection.getTotalObjectsFound() - totalAvailableColumnsRemoved );

        let output = {};
        output.arrangeData = arrangeData;
        output.dataProviderColumnConfigs = dataProviders.dataProviderColumnConfigs;
        return output;
    }
};

/**
 * Move adds selected columns to Table Columns list.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {viewModelJson} eventData - Event data
 * @param {viewModelJson} dataProviders - The dataProviders
 * @returns {Object} arrangeData and displayed columns dataProvider
 */
export let removeColumns = function( arrangeData, dataProviders, eventData ) {
    arrangeData = _.cloneDeep( arrangeData );
    const isDropEvent = tcarrangeService.isDropEvent( eventData?.event );
    let selectedColumns = eventData?.eventTargetObjs || dataProviders.dataProviderColumnConfigs.getSelectedObjects();
    if ( isDropEvent && arrangeData.draggedColumns ) {
        selectedColumns = arrangeData.draggedColumns;
    }
    const availableColumnsViewModelCollection = dataProviders.dataProviderAvailableColumnConfigs.getViewModelCollection();
    let availableColumns = availableColumnsViewModelCollection.getLoadedViewModelObjects();
    let availableColumnsLoaded = availableColumns.length;

    // Cannot rearrange available columns within itself
    if( selectedColumns && arrangeData.draggedDataProviderName !== dataProviders.dataProviderAvailableColumnConfigs.name ) {
        _.forEach( selectedColumns, function( selectedColumn ) {
            if( selectedColumn.propertyName === 'object_name' || selectedColumn.uid === arrangeData.staticColumn?.uid ) {
                selectedColumn.selected = false;
                return;
            }
            _.remove( arrangeData.columnDefs, function( column ) {
                return column.uid === selectedColumn.uid;
            } );
            _.remove( arrangeData.filteredColumnDefs, function( column ) {
                return column.uid === selectedColumn.uid;
            } );
            selectedColumn.visible = false;
            selectedColumn.hiddenFlag = true;
            selectedColumn.selected = false;
            selectedColumn.dbValue = false;

            availableColumns.splice( _.sortedIndexBy( availableColumns, selectedColumn, 'displayName' ), 0, selectedColumn );
            arrangeData.filteredAvailableColumnDefs.push( selectedColumn );
            arrangeData.hiddenAvailableColumnDefs.push( selectedColumn );

            // If the column was previously added, then we neither require a save nor a save and load
            // if the column is only being removed and there is a filter applied on the column we need to save and load,
            // otherwise we only need a save and do not need to reload the data again
            if ( arrangeData.columnsLoadInfo[ selectedColumn.uid ] === STATE_LOAD_COLUMN ) {
                arrangeData.columnsLoadInfo[ selectedColumn.uid ] = STATE_NONE;
            } else if ( selectedColumn.savedFilters?.length > 0 ) {
                arrangeData.columnsLoadInfo[ selectedColumn.uid ] = STATE_LOAD_COLUMN;
            } else {
                arrangeData.columnsLoadInfo[ selectedColumn.uid ] = STATE_PREVENT_LOAD;
            }
        } );

        arrangeData.hiddenAvailableColumnDefs = _.sortBy( arrangeData.hiddenAvailableColumnDefs, function( column ) {
            return column.displayName;
        } );

        arrangeData.filteredAvailableColumnDefs = _.sortBy( arrangeData.filteredAvailableColumnDefs, function( column ) {
            return column.displayName;
        } );

        dataProviders.dataProviderColumnConfigs.selectionModel.setSelection( [] );

        if ( arrangeData.draggedColumns ) {
            setColumnOrder( arrangeData );
            delete arrangeData.draggedColumns;
            delete arrangeData.draggedDataProviderName;
        }
        tcarrangeService.unhighlightAvailableDropArea( arrangeData.highlightedElement );

        eventBus.publish( 'columnChanged', {
            arrangeData: arrangeData
        }, true );

        const totalAvailableColumnsAdded = availableColumns.length - availableColumnsLoaded;
        dataProviders.dataProviderAvailableColumnConfigs.update( availableColumns, availableColumnsViewModelCollection.getTotalObjectsFound() + totalAvailableColumnsAdded );

        let output = {};
        output.arrangeData = arrangeData;
        output.dataProviderColumnConfigs = dataProviders.dataProviderColumnConfigs;
        return output;
    }
};

/**
 * Clear filter when operation type changes.
 *
 * @param {viewModelJson} data - View model data
 * @returns {Object} arrange data and filter box
 */
export let operationTypeChanged = function( data ) {
    data.filterBox.dbValue = '';
    markDirty( data );
    let output = {};
    output.filterBox = data.filterBox;
    output.arrangeData = data.arrangeData;
    return output;
};

/**
 * Arrange columns.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {String} arrangeType - The arrange type
 */
export let arrange = function( arrangeData, arrangeType ) {
    let eventColumns = getOutputColumns( arrangeData, true );

    // If in the arrange panel the user clicks show all or is saving a new column arrangement or has selected a named column config, then we need to save and load
    // the columns regardless if the column was only removed
    if ( !arrangeData.showAllChanged && arrangeType !== 'saveAsNewColumnAndLoadAction' && !arrangeData.loadedColumnConfig ) {
        const columnsInfo = Object.values( arrangeData.columnsLoadInfo );
        // If no columns were added, then we only save the columns
        if ( columnsInfo.length > 0 && !columnsInfo.includes( STATE_LOAD_COLUMN ) ) {
            arrangeType = 'saveColumnAction';
        }
    }

    let hasStaleFilters = false;
    let staleFilters = awColumnFilterService.getStaleFilters( arrangeData.savedColumnFilters, eventColumns );
    hasStaleFilters = staleFilters.length > 0;

    const eventData = {
        name: arrangeData.name,
        arrangeType: arrangeType,
        columns: eventColumns,
        columnConfigId: arrangeData.columnConfigId,
        operationType: arrangeData.operationType,
        objectSetUri: arrangeData.objectSetUri,
        hasStaleFilters: hasStaleFilters
    };
    if( arrangeData.loadedColumnConfigUid !== arrangeData.originalColumnConfig.columnConfigUid ) {
        for( const column of eventColumns ) {
            if( column.savedFilters && column.savedFilters.length > 0 ) {
                eventData.columnFilterSavingStatus = true;
                break;
            }
        }
    }

    if ( arrangeData.columnsData?.update ) {
        arrangeData.columnsData.update( eventData );
    } else {
        eventBus.publish( 'columnArrange', eventData );
    }

    if( arrangeType !== 'saveAsNewColumnAndLoadAction' ) {
        dialogService.closeDialog( 'TABLE_CONTEXT', arrangeData.popupId );
        appCtxSvc.unRegisterCtx( 'activeToolsAndInfoCommand' );
    }
};

/**
 * Reset column config.
 *
 * @param {viewModelJson} arrangeData - The arrange data
 */
export let reset = function( arrangeData ) {
    const eventData = {
        name: arrangeData.name,
        arrangeType: 'reset',
        columns: [],
        columnConfigId: arrangeData.columnConfigId,
        operationType: arrangeData.operationType ? arrangeData.operationType : 'union',
        objectSetUri: arrangeData.objectSetUri
    };

    if ( arrangeData.columnsData?.update ) {
        arrangeData.columnsData.update( eventData );
    } else {
        eventBus.publish( 'columnArrange', eventData );
    }

    dialogService.closeDialog( 'TABLE_CONTEXT', arrangeData.popupId );
    appCtxSvc.unRegisterCtx( 'activeToolsAndInfoCommand' );
};

/**
 * Update data provider and mark arrange data as dirty.
 *
 * @param {viewModelJson} data - The arrange data
 * @param {viewModelJson} eventData - Event data
 * @returns {Object} arrange data and displayed columns dataProvider
 */
export let updateColumns = function( data, eventData ) {
    data = {
        dataProviders: _.cloneDeep( data.dataProviders ),
        arrangeData: _.cloneDeep( data.arrangeData )
    };

    if( eventData?.arrangeData ) {
        data.dataProviders.dataProviderColumnConfigs.update( eventData.arrangeData.filteredColumnDefs,
            eventData.arrangeData.filteredColumnDefs.length );

        data.arrangeData = eventData.arrangeData;
    } else {
        data.dataProviders.dataProviderColumnConfigs.update( data.arrangeData.filteredColumnDefs,
            data.arrangeData.filteredColumnDefs.length );
    }

    if( eventData?.selectedColumns && !eventData.disableSelect ) {
        data.dataProviders.dataProviderColumnConfigs.selectionModel.setSelection( eventData.selectedColumns );
    }
    let output = {};
    output.arrangeData = data.arrangeData;
    output.dataProviderColumnConfigs = data.dataProviders.dataProviderColumnConfigs;
    output.dataProviderAvailableColumnConfigs = data.dataProviders.dataProviderAvailableColumnConfigs;
    return output;
};

/**
 * Mark arrange data as dirty.
 *
 * @param {viewModelJson} data - The arrange data
 * @returns {Object} arrange data and new column config
 */
export let markDirty = function( data ) {
    data.arrangeData.dirty = false;
    if( data.arrangeData.orgColumnDefs.length !== data.arrangeData.columnDefs.length ) {
        data.arrangeData.dirty = true;
    } else {
        for( let i = 0; i < data.arrangeData.orgColumnDefs.length; ++i ) {
            if( data.arrangeData.orgColumnDefs[ i ].uid !== data.arrangeData.columnDefs[ i ].uid ||
                data.arrangeData.orgColumnDefs[ i ].dbValue !== data.arrangeData.columnDefs[ i ].dbValue ) {
                data.arrangeData.dirty = true;
                break;
            }
        }
    }

    // Check if operation type has changed
    if( !data.arrangeData.dirty && !data.arrangeData.isExistingColumnConfigLoaded && !data.arrangeData.isDefaultColumnConfigLoaded ) {
        if( !data.arrangeData.originalOperationType && !data.arrangeData.objectSetUri ) {
            let oldOperationType = 'configured';
            if( appCtxSvc.ctx.searchResponseInfo?.columnConfig?.operationType ) {
                oldOperationType = appCtxSvc.ctx.searchResponseInfo.columnConfig.operationType.toLowerCase();
            }

            if( oldOperationType !== data.arrangeData.operationType ) {
                data.arrangeData.dirty = true;
            }
        } else if( data.arrangeData.originalOperationType && data.arrangeData.originalOperationType !== data.arrangeData.operationType ) {
            data.arrangeData.dirty = true;
        }
    }

    // Set to new column config if user modifies the admin version
    updateNewColumnConfig( data );
    setArrangeStatus( data );
    setVisibilityOfColumns( data.arrangeData.columnDefs );
    let output = {};
    output.arrangeData = { ...data.arrangeData };
    output.newColumnConfig = { ...data.newColumnConfig };
    return output;
};

/**
 * Update the newColumnConfig(Save as new arrangement - checkbox) editability based on the active column configurations.
 * If the columnConfig is admin provided column configuration then the checkbox is disabled and defaulted to true.
 *
 * @param { viewModelJson } data - The arrange data
 */
let updateNewColumnConfig = function( data ) {
    const isLoadedColumnConfigAdmin = data.arrangeData.loadedColumnConfig && data.arrangeData.loadedColumnConfig.isAdmin;
    const isOriginalColumnConfigAdmin = data.arrangeData.originalColumnConfig && data.arrangeData.originalColumnConfig.isAdmin;
    const isLoadedColumnConfigNotAdmin = data.arrangeData.loadedColumnConfig && !data.arrangeData.loadedColumnConfig.isAdmin;
    const isExistingColumnConfig = data.arrangeData.isExistingColumnConfigLoaded;
    const isArrangeDataDirty = data.arrangeData.dirty;
    const newColumnConfigValue = data.newColumnConfig.dbValue;

    if( isArrangeDataDirty && !newColumnConfigValue && ( isExistingColumnConfig && isLoadedColumnConfigAdmin || !isExistingColumnConfig && isOriginalColumnConfigAdmin ) ) {
        data.newColumnConfig.dbValue = true;
    }

    if( isArrangeDataDirty && ( !isExistingColumnConfig && isOriginalColumnConfigAdmin ) ) {
        data.newColumnConfig.isEditable = false;
    }

    if( !data.newColumnConfig.isEditable && ( isExistingColumnConfig && isLoadedColumnConfigNotAdmin ) ) {
        data.newColumnConfig.isEditable = true;
    }
};

/**
 * Get a list of types based columns in both displayed columns and available columns.
 *
 * @param {Object} arrangeData - Gives access to all columns in arrange panel
 * @returns {Array} list of object types
 */
const getColumnTypes = function( arrangeData ) {
    const columnTypes = [];
    for( let currentColumn of arrangeData.columnDefs ) {
        const columnType = currentColumn.associatedTypeName || currentColumn.typeName;
        if ( columnType ) {
            columnTypes.push( columnType );
        }
    }

    for( let currentColumn of arrangeData.hiddenAvailableColumnDefs ) {
        const columnType = currentColumn.associatedTypeName || currentColumn.typeName;
        if ( columnType ) {
            columnTypes.push( columnType );
        }
    }
    return _.uniqBy( columnTypes );
};

/**
 * Get all column uids of columns.
 *
 * @param {Array} columnDefs - Columns to exclude
 * @returns {Array} list of uids to exclude
 */
const getUidOfColumns = function( columnDefs ) {
    const uidOfColumns = [];
    for( let currentColumn of columnDefs ) {
        uidOfColumns.push( currentColumn.uid );
    }
    return uidOfColumns;
};

/**
 * Get the current status of text wrapping through columns.
 *
 * @param {Array} columns - Columns to check for text wrapping.
 * @returns {boolean} is text wrapped in table
 */
const getTextWrapped = function( columns ) {
    let isTextWrapped = false;
    if ( columns && columns.length > 0 ) {
        isTextWrapped = Boolean( columns[0].isTextWrapped );
    }
    return isTextWrapped;
};

/**
 * Get the highest columnOrder value in both displayed and available columns.
 *
 * @param {Object} arrangeData  - Gives access to all columns info in arrange panel
 * @returns {Number} The highest value of columnOrder
 */
const getLastColumnOrder = function( arrangeData ) {
    let lastColumnOrder = 0;

    for ( let currentColumn of arrangeData.columnDefs ) {
        lastColumnOrder = Math.max( lastColumnOrder, currentColumn.columnOrder );
    }
    for ( let currentColumn of arrangeData.hiddenAvailableColumnDefs ) {
        lastColumnOrder = Math.max( lastColumnOrder, currentColumn.columnOrder );
    }
    return lastColumnOrder;
};

// The below method uses internal APIs from commands framework. Do not use the below method in any other cases.
export const isArrangeMoreColumnsCommandVisible = async function() {
    // If the current workspace excludedCommands has this command, then return false.
    let ctxVal = appCtxSvc.getCtx();
    if( ctxVal?.workspace?.excludedCommands?.includes( 'arrangeMoreColumns' ) ) {
        return false;
    }

    // If the command is part of AWC_HiddenCommands, then return false;
    const hiddenCommandPreference = await preferenceService.getStringValues( 'AWC_HiddenCommands' );
    if( hiddenCommandPreference?.includes( 'arrangeMoreColumns' ) ) {
        return false;
    }

    // Evaluate the visibility of the command from the activeHandler
    const commandContext = commandConfigurationService.getCommandContext( null, 'arrangeMoreColumnsAnchor' );
    const scope = {
        commandContext,
        ctx: ctxVal
    };
    const commandData = await commandConfigurationService.getCommand(  'arrangeMoreColumns' );
    const activeHandler = commandConfigurationService.getActiveCommandHandler( commandData.handlers, scope );
    return activeHandler && commandConfigurationService.getCommandAndCheckVisibility( activeHandler, scope );
};

/**
 * Get all the extra available columns that can be used in the arrange panel.
 *
 * @param {ViewModel} data - arrange panel viewModel
 * @returns {Object} available columns and totalFound
 */
export let loadAvailableColumns = async function( data ) {
    let availableColumnsResults = {};
    const commandVisible = await isArrangeMoreColumnsCommandVisible();
    // Switch on 'more columns' if filter box is used from available columns
    if ( data.filterAvailableBox.dbValue && data.arrangeData.columnConfigId && commandVisible ) {
        data.arrangeData.isLoadingAdditionalColumns = true;
    }

    if ( data.arrangeData.isLoadingAdditionalColumns ) { // if you clicked more...
        let additionalColumnsData = {
            maxToReturn: data.arrangeData.maxToReturn || 300,
            startIndex: data.dataProviders.dataProviderAvailableColumnConfigs.startIndex,
            filterString: data.filterAvailableBox.dbValue || '',
            columnsToExclude: getUidOfColumns( data.arrangeData.columnDefs ),
            objectTypes: getColumnTypes( data.arrangeData ),
            isTextWrapped: getTextWrapped( data.arrangeData.columnDefs ),
            lastColumnOrder: getLastColumnOrder( data.arrangeData ),
            columnConfigId: data.arrangeData.columnConfigId,
            columnConfigUid: data.arrangeData.loadedColumnConfigUid,
            columnsToInclude: data.arrangeData.availableColumnDefs
        };
        if ( data.arrangeData.hasAdditionalColumnsAction ) {
            availableColumnsResults = await data.arrangeData.getAdditionalColumnsAction( additionalColumnsData );
        } else {
            availableColumnsResults = await tcarrangeService.getAdditionalColumns( additionalColumnsData );
            availableColumnsResults.availableColumns = availableColumnsResults.additionalColumns;
        }
    } else {
        data.arrangeData.filteredAvailableColumnDefs = [];
        let filterString = data.filterAvailableBox.dbValue || '';
        setFilteredColumns( filterString, data.arrangeData.hiddenAvailableColumnDefs, data.arrangeData.filteredAvailableColumnDefs );
        availableColumnsResults.availableColumns = data.arrangeData.filteredAvailableColumnDefs;
        availableColumnsResults.totalFound = data.arrangeData.filteredAvailableColumnDefs.length;
    }
    return availableColumnsResults;
};

/**
 * Toggle the loading additional columns value to true/false.
 *
 * @param {ViewModel} data - arrange panel viewModel
 */
export let toggleLoadingAdditionalColumns = function( data ) {
    data.arrangeData.isLoadingAdditionalColumns = !data.arrangeData.isLoadingAdditionalColumns;
};
/**
 * GH Copilot Generated - start
 *
 * Loads more available columns to available dataProvider list.
 *
 * @param {Object} arrangeData - The data related to the arrangement. This object will be updated with the loading status.
 * @param {Object} availableDataProvider - The data provider for the available columns. This data provider will be reset.
 *
 * GH Copilot Generated - end
 */
export let loadMoreAvailableColumns = function( arrangeData, availableDataProvider ) {
    arrangeData.isLoadingAdditionalColumns = !arrangeData.isLoadingAdditionalColumns;
    availableDataProvider.resetDataProvider();
};

export default exports = {
    setDisabilityOfArrange,
    columnVisibilityChanged,
    createNamedSoaColumns,
    getClientScopeUri,
    preLoadColumnConfig,
    loadExistingColumnConfig,
    preRemoveColumnConfig,
    removeNamedColumnConfigFromProvider,
    actionFilterList,
    initializeArrangementSelectionCheck,
    initializeUserNamedColumnConfigs,
    initializeAdminNamedColumnConfigs,
    selectColumn,
    selectAvailableColumn,
    moveUp,
    moveDown,
    addColumns,
    removeColumns,
    operationTypeChanged,
    arrange,
    reset,
    updateColumns,
    markDirty,
    isArrangeMoreColumnsCommandVisible,
    loadAvailableColumns,
    toggleLoadingAdditionalColumns,
    loadMoreAvailableColumns
};
