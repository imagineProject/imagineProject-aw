
/**
 * @module js/tableConfigsService
 */
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import tcarrangeService from 'js/tcarrange.service';
import eventBus from 'js/eventBus';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import messageService from 'js/messagingService';
import tableConfigsEditHandlerExtService from 'js/tableConfigsEditHandlerExtService';
import AwSummaryHeaderProperties from 'viewmodel/AwSummaryHeaderPropertiesViewModel';
import TableConfigsTableDefaultEditHandler from 'js/tableConfigsTableDefaultEditHandler';
import dataSourceService from 'js/dataSourceService';

/**
 * Creates a new SOA column configuration object for adding a column.
 *
 * @param {string} propertyName - The name of the property associated with the column.
 * @param {string} associatedTypeName - The name of the type associated with the column.
 * @param {boolean} hiddenFlag - Indicates whether the column is hidden.
 * @param {number} pixelWidth - The width of the column in pixels.
 * @param {boolean} isFilteringEnabled - Indicates whether filtering is enabled for the column.
 * @param {number} columnOrder - The order of the column among other columns.
 * @returns {Object} An object representing the SOA column configuration.
 */
const createAddSOAColumn = ( propertyName, associatedTypeName, hiddenFlag, pixelWidth, isFilteringEnabled, columnOrder ) => {
    return {
        displayName: '',
        hiddenFlag: hiddenFlag,
        pixelWidth: pixelWidth,
        propertyName: propertyName,
        associatedTypeName: associatedTypeName,
        isFilteringEnabled: isFilteringEnabled,
        isFrozen: false,
        columnOrder: columnOrder,
        sortPriority: 0,
        action: 'add',
        isTextWrapped: false,
        sortDirection: '',
        dataType: '',
        filterDefinitionKey: '',
        uid: '',
        filters: []
    };
};

/**
 * Creates a new column configuration object from the provided data fields and table configuration state.
 *
 * @param {Object} dataFields - An object containing the input fields from the UI for creating a new column.
 * @param {Object} tableConfigState - The current state of the table configuration, used to determine the new column's order.
 * @returns {Object} A new column configuration object ready to be added to the table configuration.
 */
const createColumnsFromAddProperties = ( dataFields, tableConfigState ) => {
    const lastColumnOrder = tableConfigState?.getValue()?.lastColumnOrder;
    let newColumnOrder = lastColumnOrder > 0 ? lastColumnOrder + 100 : 1000;
    let propertyType = getTypeValueFromSelected( dataFields?.objectTypeListBox );
    let createdColumns = [];

    if ( dataFields?.columnComplexity?.dbValue === 'basic' ) {
        _.forEach( dataFields.associatedProperties?.dbValue, function( currentProperty ) {
            let createdColumn = createAddSOAColumn( currentProperty, propertyType,
                !dataFields.columnHidden?.dbValue, dataFields.columnWidth?.dbValue, dataFields.columnFiltering?.dbValue, newColumnOrder );
            createdColumns.push( createdColumn );
            newColumnOrder += 100;
        } );
    } else if ( dataFields?.columnComplexity?.dbValue === 'advanced' ) {
        let createdColumn = createAddSOAColumn( dataFields.dcpProperty?.dbValue, propertyType,
            !dataFields.columnHidden?.dbValue, dataFields.columnWidth?.dbValue, dataFields.columnFiltering?.dbValue, newColumnOrder );
        createdColumns.push( createdColumn );
    }

    return createdColumns;
};

/**
 * Initiates the edit process for table configurations.
 *
 * @param {Object} data - An object containing various data providers, including the loadedColumnConfigDataProvider.
 * @returns {Array} An array of ViewModel objects representing the loaded column configurations.
 */
export const startEdit = function( data ) {
    return data.dataProviders.loadedColumnConfigDataProvider.getViewModelCollection().getLoadedViewModelObjects();
};

/**
 * Validates whether input string is a valid DCP or not.
 *
 * @param {string} dcpString - Input dcp string.
 * @returns {boolean} Returns true if the input string is a valid DCP, otherwise false.
 */
export const isValidDCP = function( dcpString ) {
    const dcpRegEx = /\b(REF|GRM|REFBY|GRMREL|GRMS2P|GRMS2PREL)\(\w.+,\w.+\)\.\w.+$/;
    return dcpString?.match( dcpRegEx ) !== null;
};

/**
 * Asynchronously adds a new column to a table configuration.
 *
 * @param {Object} dataFields - The data fields used to create the new column.
 * @param {Object} dataProvider - The data provider that will be reset after the column is added.
 * @param {Object} tableConfig - The table configuration to which the column will be added.
 * @param {Object} tableConfigState - The current state of the table configuration.
 * @param {Object} i18n Localized strings
 * @returns {Promise<void>} A promise that resolves when the column has been added and the data provider has been reset.
 */
export const addTableConfigColumn = async function( dataFields, dataProvider, tableConfig, tableConfigState, i18n ) {
    // Validate whether input DCP syntax is correct for advanced case.
    if( dataFields?.columnComplexity?.dbValue === 'advanced' ) {
        const inputDCPPropertyValue = dataFields.dcpProperty?.dbValue;
        if( !isValidDCP( inputDCPPropertyValue ) ) {
            messageService.showError( i18n.invalidDCP );
            return Promise.reject( new Error( i18n.invalidDCP ) );
        }
    }
    let addedColumns = createColumnsFromAddProperties( dataFields, tableConfigState );
    const soaInput = {
        tableConfigId: tableConfig.uid,
        columns: addedColumns,
        saveOptions: {}
    };
    let response = await soaSvc.postUnchecked( 'Internal-AWS2-2025-06-UiConfig', 'saveTableConfiguration2', soaInput );
    if ( response?.ServiceData?.partialErrors ) {
        const err = soaSvc.createError( response.ServiceData );
        const errMessage = messageService.getSOAErrorMessage( err );
        messageService.showError( errMessage );
        return response;
    }
    dataProvider.resetDataProvider();
};

/**
 * Asynchronously removes selected columns from a table configuration.
 *
 * @param {Object} dataProvider - The data provider containing the selected table configuration columns.
 * @param {Object} tableConfig - The table configuration object, including its unique identifier (`uid`).
 * @returns {Promise<void>} A promise that resolves once the SOA service call is complete and the data provider has been reset.
 */
export const removeTableConfigColumn = async function( dataProvider, tableConfig ) {
    let selectedColumns = dataProvider.getSelectedObjects();
    let soaColumns = [];
    _.forEach( selectedColumns, function( currentColumn ) {
        soaColumns.push( tableConfigsEditHandlerExtService.createSOAColumnsFromTableColumnObjects( currentColumn, 'remove' ) );
    } );

    const soaInput = {
        tableConfigId: tableConfig.uid,
        columns: soaColumns,
        saveOptions: {}
    };
    await soaSvc.postUnchecked( 'Internal-AWS2-2025-06-UiConfig', 'saveTableConfiguration2', soaInput );
    dataProvider.resetDataProvider();
};

/**
 * Swaps the 'columnOrder' properties between two column objects.
 *
 * @param {Object} toBeLowerColumn - The first column object, containing a 'columnOrder' property.
 * @param {Object} toBeHigherColumn - The second column object, also containing a 'columnOrder' property.
 */
const switchColumnOrderValues = function( toBeLowerColumn, toBeHigherColumn ) {
    const toBeLowerColumnOrder = toBeLowerColumn.props.columnOrder;
    const toBeHigherColumnOrder = toBeHigherColumn.props.columnOrder;

    // Ensure that the column order values are not the same ( increase the lower so it will be swapped with the higher )
    if ( toBeLowerColumnOrder.value === toBeHigherColumnOrder.value ) {
        toBeLowerColumnOrder.value += 1;
        if ( toBeLowerColumnOrder.dbValue ) {
            toBeLowerColumnOrder.dbValue += 1;
        }
        if ( toBeLowerColumnOrder.dbValues ) {
            toBeLowerColumnOrder.dbValues[0] += 1;
        }
    }

    let originalColumn1ColumnOrderValues = {
        value: toBeLowerColumnOrder.value,
        displayValues: toBeLowerColumnOrder.displayValues,
        isNull: toBeLowerColumnOrder.isNull,
        editable: toBeLowerColumnOrder.editable,
        isEditable: toBeLowerColumnOrder.isEditable,
        isPropertyModifiable: toBeLowerColumnOrder.isPropertyModifiable,
        sourceObjectLastSavedDate: toBeLowerColumnOrder.sourceObjectLastSavedDate,
        isEnabled: toBeLowerColumnOrder.isEnabled,
        dbValues: toBeLowerColumnOrder.dbValues,
        dbValue: toBeLowerColumnOrder.dbValue,
        uiValue: toBeLowerColumnOrder.uiValue,
        uiValues: toBeLowerColumnOrder.uiValues
    };
    uwPropertySvc.copyModelData( toBeLowerColumnOrder, toBeHigherColumnOrder );
    toBeLowerColumnOrder.dbValue = toBeHigherColumnOrder.dbValue;
    uwPropertySvc.copyModelData( toBeHigherColumnOrder, originalColumn1ColumnOrderValues );
    toBeHigherColumnOrder.dbValue = originalColumn1ColumnOrderValues.dbValue;
    toBeLowerColumnOrder.valueUpdated = true;
    toBeHigherColumnOrder.valueUpdated = true;
};

/**
 * Debounces the save operation for table configuration columns.
 */
const saveTableConfigColumnsDebounce = _.debounce( async function() {
    eventBus.publish( 'tableConfigSummary.saveEdit' );
}, 1000, {
    maxWait: 10000,
    trailing: true,
    leading: false
} );

/**
 * Moves selected table configuration columns up or down.
 *
 * @param {boolean} isMoveUp - Determines the direction of the move; true for up, false for down.
 * @param {Object} dataProvider - The data provider containing the column objects.
 */
export const moveTableConfigColumn = function( isMoveUp, dataProvider ) {
    let columnObjects = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    if ( isMoveUp ) {
        for( let i = 0; i < columnObjects.length; i++ ) {
            let currentColumn = columnObjects[ i ];
            // First column cannot be moved up
            if ( i !== 0 && currentColumn.selected && !columnObjects[ i - 1 ].selected ) {
                switchColumnOrderValues( currentColumn, columnObjects[ i - 1 ] );
                const tempColumn = columnObjects[ i ];
                columnObjects[ i ] = columnObjects[ i - 1 ];
                columnObjects[ i - 1 ] = tempColumn;
            }
        }
    } else {
        for( let i = columnObjects.length - 1; i >= 0; i-- ) {
            // Last column cannot be moved down
            if ( i !== columnObjects.length - 1 && columnObjects[ i ].selected && !columnObjects[ i + 1 ].selected ) {
                switchColumnOrderValues( columnObjects[ i + 1 ], columnObjects[ i ] );
                const tempColumn = columnObjects[ i ];
                columnObjects[ i ] = columnObjects[ i + 1 ];
                columnObjects[ i + 1 ] = tempColumn;
            }
        }
    }

    dataProvider.update( columnObjects );
    saveTableConfigColumnsDebounce();
};

/**
 * Extracts the type value from a selected object's database value.
 *
 * @param {Object} selected - The selected object containing the `dbValue` property.
 * @returns {string} The extracted type value from the `dbValue` property, or an empty string if not available.
 */
const getTypeValueFromSelected = function( selected ) {
    let typeArray = selected?.dbValue?.split( '::' );
    return typeArray?.length ? typeArray[ 1 ] : '';
};

/**
 * Loads associated properties for a selected object type.
 *
 * @param {Object} data - The data object containing optional filter criteria.
 * @param {Object} selected - The selected object from which the type is extracted.
 * @param {number} p_startIndex - The starting index for the associated properties.
 * @returns {Promise<Array>} A promise that resolves to an array of objects representing the associated properties.
 */
export const loadAssociatedProperties = async function( data, selected, p_startIndex = 0 ) {
    let type = getTypeValueFromSelected( selected );
    let additionalColumnsData = {
        maxToReturn: 1000,
        startIndex: p_startIndex,
        filterString: data.associatedProperties?.filterString || '',
        columnsToExclude: [],
        objectTypes: [ type ],
        isTextWrapped: false,
        lastColumnOrder: 1000,
        columnConfigId: '',
        columnConfigUid: '',
        columnsToInclude: []
    };
    let availableColumnsResults = await tcarrangeService.getAdditionalColumns( additionalColumnsData );
    let associatedProperties = [];

    if ( availableColumnsResults?.additionalColumns?.length > 0 ) {
        for( let currentColumn of availableColumnsResults.additionalColumns ) {
            let propDisplayDescription = currentColumn.isDuplicate ? currentColumn.propertyName : '';
            associatedProperties.push( {
                propDisplayValue: currentColumn.displayName,
                propInternalValue: currentColumn.propertyName,
                propDisplayDescription: propDisplayDescription,
                valueTooltip: currentColumn.displayName + ' (' + currentColumn.propertyName + ')'
            } );
        }
    }

    return {
        associatedProperties: associatedProperties,
        totalFound: availableColumnsResults?.totalFound
    };
};

/**
 * Loads column properties for a given table configuration.
 *
 * @param {Object} wrapTextState - The state indicating whether text wrapping is enabled.
 * @param {Object} subPanelContext - The context from which the table configuration ID is extracted.
 * @param {Object} tableConfigState - The state object to be updated with the loaded column properties.
 * @returns {Promise<Object>} A promise that resolves to an object containing the loaded column properties.
 */
export async function loadColumnProperties( wrapTextState, subPanelContext, tableConfigState ) {
    return await tableConfigsEditHandlerExtService.loadColumnProperties( wrapTextState, subPanelContext, tableConfigState );
}

export const toggleWrapText = ( loadedVMOs, wrapTextState ) => {
    let wrapTextValue = wrapTextState.getValue();
    let toggleWrapTextValue = !wrapTextValue.isTextWrapped;

    for ( let vmo of loadedVMOs ) {
        uwPropertySvc.copyModelData( vmo.props.isTextWrapped, {
            value: toggleWrapTextValue,
            displayValues: [ toggleWrapTextValue ],
            dbValues: [ toggleWrapTextValue ]
        } );
        vmo.props.isTextWrapped.valueUpdated = true;
    }

    wrapTextValue.isTextWrapped = toggleWrapTextValue;
    wrapTextState.update( wrapTextValue );
    eventBus.publish( 'tableConfigSummary.saveEdit' );
};

/**
 * Initializes the sort panel LOVs with the current sorted column and direction
 * @param {Array} columns Array of column VMOs
 * @param {Object} fields Fields object containing the sortBy and sortDirection fields
 * @param {Object} i18n Localized strings
 * @returns {Array} Array of column LOV entries
 */
export function initializeSortPanel( columns, fields, i18n ) {
    let sortDirectionDisplayValue = i18n.noSorting;
    let sortDirectionDbValue = 'NoSorting';

    let groupedColumns = _.groupBy( columns, 'props.displayName.uiValue' );
    for( let key in groupedColumns ) {
        if( groupedColumns[ key ].length > 1 ) {
            for( let currentColumn of groupedColumns[ key ] ) {
                currentColumn.isDuplicate = true;
            }
        }
    }

    const columnsForLov = columns.map( ( vmo ) => {
        let displayValue = vmo?.props?.displayName?.uiValue;
        let duplicateDisplayDescription = `${vmo?.props?.associatedTypeDisplayName?.uiValue || ''} : ${vmo?.props?.propertyName?.uiValue || ''}`;
        const lovEntry = {
            propDisplayValue: displayValue,
            propInternalValue: vmo?.uid,
            valueTooltip: displayValue + ' (' + duplicateDisplayDescription + ')',
            propDisplayDescription: vmo?.isDuplicate ? duplicateDisplayDescription : ''
        };

        if ( vmo?.props?.sortPriority?.dbValue === 1 ) {
            fields?.sortBy?.setLovVal( {
                lovEntry
            } );

            if ( vmo.props.sortDirection.dbValue === 'Ascending' ) {
                sortDirectionDbValue = 'Ascending';
                sortDirectionDisplayValue = i18n.ascending;
            } else if ( vmo.props.sortDirection.dbValue === 'Descending' ) {
                sortDirectionDbValue = 'Descending';
                sortDirectionDisplayValue = i18n.descending;
            }
        }
        return lovEntry;
    } );
    fields?.sortDirection?.setLovVal( {
        lovEntry: {
            propInternalValue: sortDirectionDbValue,
            propDisplayValue: sortDirectionDisplayValue
        }
    } );

    return columnsForLov;
}

export const updateSortDirection = ( columnPropertySortState, sortDirection, uid )=>{
    let columnProperty = columnPropertySortState.getValue();
    columnProperty.uid = uid;
    columnProperty.sortDirection.dbValue = sortDirection;
    columnPropertySortState.update( columnProperty );
};

export const updateColumnsSortDirection = ( dataProvider, columnPropertySortState )=>{
    const uid = columnPropertySortState.uid;
    const sortDirection = columnPropertySortState.sortDirection.dbValue;
    if ( uid && sortDirection || uid === '' && sortDirection ) {
        const loadedVMOs = dataProvider.viewModelCollection.loadedVMObjects;
        for ( let vmo of loadedVMOs ) {
            if( vmo.uid !== uid && vmo.props.sortDirection.dbValue ) {
                uwPropertySvc.copyModelData( vmo.props.sortDirection, {
                    value: '',
                    displayValues: [ '' ],
                    dbValues: [ '' ]
                } );
                vmo.props.sortDirection.valueUpdated = true;
                uwPropertySvc.copyModelData( vmo.props.sortPriority, {
                    value: 0,
                    displayValues: [ '0' ],
                    dbValues: [ 0 ]
                } );
                vmo.props.sortPriority.valueUpdated = true;
            } else if( vmo.uid === uid ) {
                uwPropertySvc.copyModelData( vmo.props.sortDirection, {
                    value: sortDirection,
                    dbValues: [ sortDirection ],
                    displayValues: [ sortDirection ]
                } );
                vmo.props.sortDirection.valueUpdated = true;
                uwPropertySvc.copyModelData( vmo.props.sortPriority, {
                    value: 1,
                    displayValues: [ '1' ],
                    dbValues: [ 1 ]
                } );
                vmo.props.sortPriority.valueUpdated = true;
            }
        }
        eventBus.publish( 'colConfigDefinitionGrid.plTable.clientRefresh' );
        eventBus.publish( 'tableConfigSummary.saveEdit' );
    }
};

export const cellRendererFn = ( vmo, containerElement )=>{
    const props = {
        columnProperty: vmo.props.displayName.dbValue,
        sortDirection: vmo.props.sortDirection.dbValue
    };
    let cellElement = includeComponent( 'AwTableConfigCellRenderer', props );
    if( containerElement ) {
        renderComponent( cellElement, containerElement );
    }
    return containerElement;
};

/**
 * Initializes the table configurations table.
 *
 * @param {Object} dataProvider - The data provider object.
 * @param {Object} [context={}] - The context object, default is an empty object.
 * @param {object} wrapTextState - The state indicating whether text wrapping is enabled.
 * @param {Object} tableConfigState - The state of the table configuration.
 */
export const initializeTableConfigsTable = function( dataProvider, context = {}, wrapTextState = {}, tableConfigState = {} ) {
    if( dataProvider ) {
        let dataSource = dataSourceService.createNewDataSource( { dataProvider: dataProvider } );
        let tableConfigsEditHandler = new TableConfigsTableDefaultEditHandler( dataSource, dataProvider.editSupportParamKeys, context, wrapTextState, tableConfigState );
        tableConfigsEditHandlerExtService.setEditHandler( tableConfigsEditHandler, 'TABLE_CONFIG' );
    }
};

/**
 * Clears the sort by value in the LOV if the sort direction is set to 'NoSorting'
 * @param {Object} sortBy Lov field for sort by
 * @param {String} sortDirection Current sort direction
 * @param {Object} i18n Localized strings
 */
export function clearSortByLov( sortBy, sortDirection, i18n ) {
    if ( sortDirection === 'NoSorting' || sortDirection === i18n.noSorting ) {
        sortBy.setLovVal( {
            lovEntry: {
                propInternalValue: '',
                propDisplayValue: ''
            }
        } );
    }
}

/**
 * Sets the sort direction to no sorting if the sort by value is cleared or ascending if the sort by value is changed to non empty and no sorting was the previous value
 * @param {Object} sortDirection Lov field for sort direction
 * @param {String} sortColumn Current sorted by column
 * @param {Object} i18n Localized strings
 */
export function setSortDirectionInLov( sortDirection, sortColumn, i18n ) {
    if ( sortColumn === '' ) {
        sortDirection.setLovVal( {
            lovEntry: {
                propInternalValue: 'NoSorting',
                propDisplayValue: i18n.noSorting
            }
        } );
    } else if ( sortDirection.value === 'NoSorting' || sortDirection.value === i18n.noSorting ) {
        sortDirection.setLovVal( {
            lovEntry: {
                propInternalValue: 'Ascending',
                propDisplayValue: i18n.ascending
            }
        } );
    }
}

/**
 * Clears the associated properties by updating their display values and setting their values to empty arrays.
 *
 * @param {Array} associatedProperties - The properties to be cleared.
 * @returns {Array} The cleared associated properties.
 */
export function clearAssociatedProperties( associatedProperties ) {
    uwPropertySvc.updateDisplayValues( associatedProperties, [] );
    uwPropertySvc.setValue( associatedProperties, [] );
    return associatedProperties;
}

/**
 * Updates the column config id and client scope uri fields with the values from the header properties
 * @param {Object} fields Fields object containing the columnConfigId and clientScopeUri fields
 * @param {Array} headerVmo Array of ViewModelObjects representing the header properties
 */
export function updateHeaderProps( fields, headerVmo ) {
    if ( headerVmo[ 0 ]?.props?.columnConfigId && headerVmo[ 0 ]?.props?.clientScopeUri ) {
        fields.columnConfigId.update( headerVmo[ 0 ].props.columnConfigId.uiValue );
        fields.clientScopeUri.update( headerVmo[ 0 ].props.clientScopeUri.uiValue );
    }
}

/**
 * Renders the header properties in the summary header properties component
 * @param {Object} fields Fields object containing the columnConfigId and clientScopeUri fields
 * @returns {React.ReactElement} A React element representing the header properties
 */
export function headerPropsRenderer( { fields } ) {
    const context = {
        headerProps: [
            {
                property: fields.columnConfigId,
                renderingHint: 'overflow',
                renderingStyle: ''
            },
            {
                property: fields.clientScopeUri,
                renderingHint: 'overflow',
                renderingStyle: ''
            }
        ]
    };
    return <AwSummaryHeaderProperties subPanelContext={context} ></AwSummaryHeaderProperties>;
}

export const incrementReloadColumns = ( reloadColumns ) => ++reloadColumns;
