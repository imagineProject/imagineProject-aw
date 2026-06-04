// Copyright (c) 2024 Siemens

/**
 * tableConfigsEditHandlerExtService
 *
 *  Registration and extension service for tableConfigs table to use custom EditHandler
 *  @module js/tableConfigsEditHandlerExtService
 *
 */
import editHandlerService from 'js/editHandlerService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import tcDataManagementService from 'js/tcDataManagementService';
import { constructViewModelObject } from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import localeService from 'js/localeService';

let exports = {};

let editHandlers = {};

/**
 * Sets the edit handler and the active edit handler context.
 *
 * @param {Object} editHandler - The edit handler object.
 * @param {string} editContext - The context for the edit handler.
 */
export const setEditHandler = function( editHandler, editContext ) {
    editHandlerService.setEditHandler( editHandler, editContext );
    editHandlerService.setActiveEditHandlerContext( editContext );
};

/**
 * Updates the table configuration state based on the provided columns.
 *
 * @param {Object[]} columns - An array of column objects, each containing a `props` object with a `columnOrder` property.
 * @param {Object} tableConfigState - An object representing the current table configuration state.
 * This object should have a `getValue` method to retrieve the current state and an `update` method to update the state.
 */
const updateTableConfigStateFromColumns = ( columns, tableConfigState ) => {
    let lastColumnOrder = 100;
    let newTableConfigState = tableConfigState.getValue();

    _.forEach( columns, function( currentColumn ) {
        lastColumnOrder = Math.max( lastColumnOrder, currentColumn.props.columnOrder.dbValue );
    } );

    newTableConfigState.lastColumnOrder = lastColumnOrder;
    tableConfigState.update( newTableConfigState );
};

/**
 * Processes column properties from a given response object.
 *
 * @param {Object} response - The response object containing the named column configurations in JSON format.
 * @returns {Object} An object containing the array of ViewModel objects (`loadedColumns`) and the total count of these objects (`loadedColumnsTotalFound`).
 */
export const processColumnProperties = async( response ) => {
    let columnVmos = [];
    let namedColumnConfig;

    if ( response?.namedColumnConfigsJSON ) {
        namedColumnConfig = JSON.parse( response.namedColumnConfigsJSON );
        let responseColumns = namedColumnConfig?.columnConfig?.columns;
        const tableConfigsLocalizedMessages = await localeService.getLoadedText( 'tableConfigs' );
        _.forEach( responseColumns, function( currentColumn ) {
            const columnObject = {
                uid: currentColumn.uid,
                props: createColumnProps( currentColumn, tableConfigsLocalizedMessages )
            };
            const columnVmo = constructViewModelObject( columnObject );
            columnVmos.push( columnVmo );
        } );
    }

    return {
        loadedColumns: columnVmos,
        loadedColumnsTotalFound: columnVmos.length
    };
};

/**
 * Creates a properties object for a table column.
 *
 * @param {Object} column - The current column configuration from which to generate the properties object.
 * @returns {Object} An object containing detailed properties for the column, suitable for UI rendering or further processing.
 */
const createColumnProps = ( column, tableConfigsLocalizedMessages = {} ) => {
    column.modifiable = column.options?.modifiable !== 'false';

    const trueText = tableConfigsLocalizedMessages.trueText || 'True';
    const falseText = tableConfigsLocalizedMessages.falseText || 'False';
    const columnFilteringDisplayText = column.isFilteringEnabled ? trueText : falseText;
    const isTextWrappedDisplayText = column.isTextWrapped ? trueText : falseText;
    const isFrozenDisplayText = column.isFrozen ? trueText : falseText;
    const isDisplayedColumn = column.hiddenFlag ? falseText : trueText;
    const modifiableDisplayText = column.modifiable ? trueText : falseText;

    return {
        displayName: {
            name: 'displayName',
            value: [ column.displayName ],
            displayValue: [ column.displayName ],
            isModifiable: false,
            isEditable: false,
            field: 'displayName',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        typeName: {
            name: 'typeName',
            value: [ column.typeName ],
            displayValue: [ column.typeName ],
            isModifiable: false,
            isEditable: false,
            field: 'typeName',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        propertyName: {
            name: 'propertyName',
            value: [ column.propertyName ],
            displayValue: [ column.propertyName ],
            isModifiable: true,
            isEditable: true,
            field: 'propertyName',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        associatedTypeName: {
            name: 'associatedTypeName',
            value: [ column.associatedTypeName ],
            displayValue: [ column.associatedTypeName ],
            isModifiable: true,
            isEditable: true,
            field: 'associatedTypeName',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        associatedTypeDisplayName: {
            name: 'associatedTypeDisplayName',
            value: [ column.associatedTypeDisplayName ],
            displayValue: [ column.associatedTypeDisplayName ],
            isModifiable: false,
            isEditable: false,
            field: 'associatedTypeDisplayName',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        pixelWidth: {
            name: 'pixelWidth',
            value: [ column.pixelWidth ],
            displayValue: [ column.pixelWidth ],
            isModifiable: true,
            isEditable: true,
            field: 'pixelWidth',
            type: 'INTEGER',
            propType: 'INTEGER',
            hasLov: false,
            isEnabled: true
        },
        columnOrder: {
            name: 'columnOrder',
            value: [ column.columnOrder ],
            displayValue: [ column.columnOrder ],
            isModifiable: true,
            isEditable: true,
            field: 'columnOrder',
            type: 'INTEGER',
            propType: 'INTEGER',
            hasLov: false,
            isEnabled: true
        },
        displayedColumn: {
            name: 'displayedColumn',
            value: [ !column.hiddenFlag ],
            displayValue: [ isDisplayedColumn ],
            isModifiable: true,
            isEditable: true,
            field: 'hiddenFlag',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        },
        sortPriority: {
            name: 'sortPriority',
            value: [ column.sortPriority ],
            displayValue: [ column.sortPriority ],
            isModifiable: true,
            isEditable: true,
            field: 'sortPriority',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        sortDirection: {
            name: 'sortDirection',
            value: [ column.sortDirection ],
            displayValue: [ column.sortDirection ],
            isModifiable: true,
            isEditable: true,
            field: 'sortDirection',
            type: 'STRING',
            propType: 'STRING',
            hasLov: false,
            isEnabled: true
        },
        isFilteringEnabled: {
            name: 'isFilteringEnabled',
            value: [ column.isFilteringEnabled ],
            displayValue: [ columnFilteringDisplayText ],
            isModifiable: true,
            isEditable: true,
            field: 'isFilteringEnabled',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        },
        filters: {
            name: 'filters',
            value: [ column.filters ],
            displayValue: [ column.filters ],
            isModifiable: true,
            isEditable: true,
            field: 'filters',
            type: 'STRINGARRAY',
            propType: 'STRINGARRAY',
            hasLov: false,
            isEnabled: true
        },
        isTextWrapped: {
            name: 'isTextWrapped',
            value: [ column.isTextWrapped ],
            displayValue: [ isTextWrappedDisplayText ],
            isModifiable: true,
            isEditable: true,
            field: 'isTextWrapped',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        },
        isFrozen: {
            name: 'isFrozen',
            value: [ column.isFrozen ],
            displayValue: [ isFrozenDisplayText ],
            isModifiable: true,
            isEditable: true,
            field: 'isFrozen',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        },
        modifiable: {
            name: 'modifiable',
            value: [ column.modifiable ],
            displayValue: [ modifiableDisplayText ],
            isModifiable: true,
            isEditable: true,
            field: 'modifiable',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        },
        // Used for actual modifiablilty of the column in the table UI
        is_modifiable: {
            name: 'is_modifiable',
            value: [ true ],
            displayValue: [ tableConfigsLocalizedMessages.trueText ],
            isModifiable: true,
            isEditable: true,
            field: 'is_modifiable',
            type: 'BOOLEAN',
            propType: 'BOOLEAN',
            hasLov: false,
            isEnabled: true
        }
    };
};

export const loadColumnProperties = async function( wrapTextState, subPanelContext, tableConfigState ) {
    const soaInput = {
        namedColumnConfigInput: {
            clientName: 'AWClient',
            clientScopeUri: '',
            columnConfigId: '',
            columnsToExclude: [],
            columnConfigName: ''
        },
        namedColumnConfigCriteria: {
            tableConfigId: subPanelContext.selection[0].uid
        }
    };
    let response = await tcDataManagementService.baseGetNamedColumnConfigs( soaInput );
    let columnProperties = await processColumnProperties( response );
    updateTableConfigStateFromColumns( columnProperties.loadedColumns, tableConfigState );

    let wrapTextValue = wrapTextState.getValue();
    wrapTextValue.isTextWrapped = columnProperties?.loadedColumns?.[0].props?.isTextWrapped?.dbValue;
    wrapTextState.update( wrapTextValue );

    return columnProperties;
};

/**
 * Saves edits made to table configuration columns.
 *
 * @param {Object} data - Additional data for the save operation (unused in the current implementation).
 * @param {Object} dataProvider - The data provider containing the column view models.
 * @param {Object} subPanelContext - The context from which the table configuration ID is extracted.
 * @param {Array} saveInputs - An array of objects containing identifiers for the columns to be saved.
 * @returns {Promise<Object>} A promise that resolves to the response from the SOA service call.
 */
export const saveEdit = async function( modifiedPropsMap, subPanelContext ) {
    let soaColumns = [];
    _.forEach( modifiedPropsMap, modifiedObj => {
        let currentColumn = modifiedObj.viewModelObject;
        soaColumns.push( createSOAColumnsFromTableColumnObjects( currentColumn ) );
    } );

    if ( soaColumns.length !== 0 ) {
        const soaInput = {
            tableConfigId: subPanelContext?.selection[0]?.uid,
            columns: soaColumns,
            saveOptions: {}
        };
        return await soaSvc.postUnchecked( 'Internal-AWS2-2025-06-UiConfig', 'saveTableConfiguration2', soaInput );
    }
    return AwPromiseService.instance.resolve();
};

/**
 * Creates an SOA column configuration object from a table column object.
 *
 * @param {Object} columnObject - The column object containing properties to be used in the SOA column configuration.
 * @param {string} [action='edit'] - The action to be applied to the column (e.g., 'edit', 'add', 'remove'). Defaults to 'edit'.
 * @returns {Object} An object representing the SOA column configuration, including all relevant properties and the specified action.
 */
export const createSOAColumnsFromTableColumnObjects = ( columnObject, action = 'edit' ) => {
    let columnOrder = columnObject.props.columnOrder?.dbValue;
    if ( _.isNil( columnOrder ) ) {
        columnOrder = !_.isNil( columnObject.props.columnOrder?.dbValues?.[0] ) ? columnObject.props.columnOrder.dbValues[0] : 1000;
    }
    const hiddenFlag = !_.isNil( columnObject.props.displayedColumn?.dbValue ) ? !columnObject.props.displayedColumn?.dbValue : false;
    return {
        displayName: '',
        hiddenFlag: hiddenFlag,
        pixelWidth: columnObject.props.pixelWidth?.dbValue || 100,
        propertyName: columnObject.props.propertyName.dbValue,
        associatedTypeName: columnObject.props.associatedTypeName.dbValue,
        isFilteringEnabled: columnObject.props.isFilteringEnabled?.dbValue || false,
        isFrozen: columnObject.props.isFrozen?.dbValue || false,
        columnOrder: columnOrder,
        sortPriority: columnObject.props.sortPriority?.dbValue || 0,
        action: action,
        isTextWrapped: columnObject.props.isTextWrapped?.dbValue || false,
        sortDirection: columnObject.props.sortDirection?.dbValue || '',
        dataType: columnObject.props.typeName?.dbValue || '',
        filterDefinitionKey: columnObject.props.filterDefinitionKey?.dbValue || '',
        uid: columnObject.uid,
        filters: columnObject.props.filters?.dbValue || [],
        options: {
            modifiable: columnObject.props.modifiable?.dbValue === false  ? 'false': 'true'
        }
    };
};

/**
 * Determines if a table load is necessary based on the modified properties map.
 *
 * @param {Object} modifiedPropsMap - A map of modified properties.
 * @returns {boolean} - Returns true if a table load is necessary, otherwise false.
 */
export const isTableLoadNecessary = ( modifiedPropsMap ) => {
    let isTableLoadNecessary = false;

    _.forEach( modifiedPropsMap, modifiedObj => {
        if ( modifiedObj.viewModelProps?.length ) {
            for( const currentProp of modifiedObj.viewModelProps ) {
                if ( currentProp.propertyName === 'propertyName' || currentProp.propertyName === 'associatedTypeName' ) {
                    isTableLoadNecessary = true;
                    return false;
                }
            }
        }
    } );

    return isTableLoadNecessary;
};

exports = {
    setEditHandler,
    loadColumnProperties,
    createSOAColumnsFromTableColumnObjects,
    saveEdit,
    processColumnProperties,
    isTableLoadNecessary
};

export default exports;
