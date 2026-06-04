// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariabilityTreeCustomMenuService
 */
import eventBus from 'js/eventBus';
import Pca0VCAUtils from 'js/pca0VCAUtils';

/**
 * Trigger "Validate" column action
 * @param {String} gridID - Grid Identifier
 * @param {AwColumnInfo} columnDef - Column Def
 */
export let performColumnValidate = function( gridID, columnDef, option ) {
    // Create eventData to trigger validation
    let eventData = {
        gridID: gridID,
        column: columnDef,
        option: option
    };
    eventBus.publish( 'Pca0VariabilityTreeCustomMenuService.performColumnValidate', eventData );
};

/**
 * Trigger "Split" column action to add a split column
 * @param {String} gridID - Grid Identifier
 * @param {AwColumnInfo} columnDef - Column Def
 * @param {UwDataProvider} treeDataProvider - Tree Data Provider
 * @param {Boolean} isSplitSubject - [Constraints Grid Editor only] true if split conditions must be editable for Subject section
 */
export let performSplitColumn = function( gridID, columnDef, treeDataProvider, isSplitSubject ) {
    var newColumnIndexToInsert = columnDef.index + 1;
    let splitColumnUid;
    let originalColumnName;
    if( columnDef.isSplitColumn ) {
        originalColumnName = columnDef.originalColumnName;
    } else {
        originalColumnName = columnDef.name;
    }
    splitColumnUid = Pca0VCAUtils.instance.generateSplitColumnKey( originalColumnName );

    let eventData = {
        columnDef: {
            isSplitColumn: true,
            isSplitSubject: isSplitSubject,
            originalColumnName: originalColumnName,
            propertyName: splitColumnUid, //This needs to be unique in case of split columns
            propertyDisplayName: '',
            propertyUid: splitColumnUid
        },
        gridID: gridID,
        newColumnIndexToInsert: newColumnIndexToInsert,
        treeDataProvider: treeDataProvider
    };
    eventBus.publish( 'Pca0VariabilityTreeDisplayService.performSplitColumn', eventData );
};

/**
 * Trigger "Clear" column action
 * @param {String} gridID - Grid Identifier
 * @param {AwColumnInfo} columnDef - Column Def
 */
export let performColumnClearSelections = function( gridID, columnDef, command ) {
    let eventData = {
        gridID: gridID,
        column: columnDef,
        command: command
    };
    eventBus.publish( 'Pca0VariabilityTreeCustomMenuService.performColumnClearSelections', eventData );
};

/**
 * Trigger "Copy" column action
 * @param {String} gridID - Grid Identifier
 * @param {AwColumnInfo} columnDef - Column Def
 */
export let performColumnCopySelections = function( gridID, columnDef ) {
    let eventData = {
        gridID: gridID,
        column: columnDef
    };
    eventBus.publish( 'Pca0VariabilityTreeCustomMenuService.performColumnCopySelections', eventData );
};

/**
 * Trigger "Paste" column action
 * @param {String} gridID - Grid Identifier
 * @param {AwColumnInfo} columnDef - Column Def
 */
export let performPasteSelectionsOnColumn = function( gridID, columnDef ) {
    let eventData = {
        gridID: gridID,
        column: columnDef
    };
    eventBus.publish( 'Pca0VariabilityTreeCustomMenuService.performPasteSelectionsOnColumn', eventData );
};

/**
 * Performs a freeze or unfreeze action on a specified column in the grid.
 *
 * @param {string} gridID - The unique identifier of the grid.
 * @param {Object} columnDef - The definition object of the column to be frozen or unfrozen.
 * @param {boolean} isFreezeCommand - Indicates whether the action is to freeze (true) or unfreeze (false) the column.
 * @param {number} defaultColumnPinIndex - The default index for pinning the column.
 */
export let performFreezeActionOnColumn = ( gridID, columnDef, isFreezeCommand, defaultColumnPinIndex ) => {
    let eventData = {
        gridID: gridID,
        columnDef: columnDef,
        isFreezeCommand: isFreezeCommand,
        defaultColumnPinIndex:defaultColumnPinIndex
    };
    eventBus.publish( 'Pca0VariabilityTreeCustomMenuService.performColumnFreezeAction', eventData );
};

/*
 *   Export APIs section starts
 */

let exports = {};

export default exports = {
    performColumnValidate,
    performSplitColumn,
    performColumnClearSelections,
    performColumnCopySelections,
    performPasteSelectionsOnColumn,
    performFreezeActionOnColumn
};
