// Copyright (c) 2022 Siemens

/**
 * @module js/occMgmtDuplicateCellService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import occMgmtDuplicateActionService from 'js/occMgmtDuplicateActionService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import localeService from 'js/localeService';
import Trv from 'js/splmTableTraversal';
import tableSvc from 'js/splmTablePublishedService';

let resource = '/i18n/OccMgmtDuplicateMessages.json';
let localeTextBundle = localeService.getLoadedText( resource );

let exports = {};

export let inlineEditingSupportedProperties = new Map();

const CSS_CLASS_FOR_EDITABILITY_INDICATOR = 'aw-occmgmt-duplicateEditableIndicator';
let supportedFeatures = null;
/**
 * Cell Renderer for editable properties in duplicate location for PL Table
 */
let _duplicateEditCellRender = {
    action: function( column, vmo, tableElem ) {
        compareAndUpdateOldValueAndNewValue( vmo );
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( CSS_CLASS_FOR_EDITABILITY_INDICATOR );
        cellContent = populateInlineEditingMouseAdapter( cellContent, column, vmo );
        return cellContent;
    },
    condition: function( column, vmo ) {
        let isInlineEditingSuppForProperty;
        if ( inlineEditingSupportedProperties.has( vmo.type ) ) {
            let propsToEdit = inlineEditingSupportedProperties.get( vmo.type );
            isInlineEditingSuppForProperty = propsToEdit.indexOf( column.propertyName ) > -1;
        }

        if( supportedFeatures === null ) {
            supportedFeatures = occMgmtStateHandler.getSupportedFeaturesFromPCI( appCtxSvc.ctx.occmgmtContext.productContextInfo );
        }
        if( supportedFeatures.Awb0AdditionalPropertyEditSupportInDuplicateMode === true &&
            isInlineEditingSuppForProperty &&
            isInlineEditSupportedForCurrentDuplicateAction( vmo ) ) {
            return true;
        }
        return false;
    },
    name: 'cellRendererForInlineEditInDuplicateLocation'
};

/**
 * Cell Renderer for editable properties in duplicate location for PL Table
 */
let _duplicateNonEditCellRender = {
    action: function( column, vmo, tableElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        let pinnedContentElement = new Trv( tableElem ).getPinContentElementFromTable();
        let imgElement = cellContent.getElementsByClassName( tableSvc.CLASS_GRID_CELL_IMAGE )[ 0 ];
        attachResetHandlerToPinnedElement( pinnedContentElement );
        attachResetElementToIMageElement( imgElement );
        resetEditHandlerState();
        if( !isInlineEditSupportedForCurrentDuplicateAction( vmo ) && vmo && vmo.props && vmo.props[ column.propertyName ] ) {
            vmo.props[ column.propertyName ].isEditable = false;
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        let isInlineEditingSuppForProperty;
        if ( inlineEditingSupportedProperties.has( vmo.type ) ) {
            let propsToEdit = inlineEditingSupportedProperties.get( vmo.type );
            isInlineEditingSuppForProperty = propsToEdit.indexOf( column.propertyName ) > -1;
        }

        if( supportedFeatures === null ) {
            supportedFeatures = occMgmtStateHandler.getSupportedFeaturesFromPCI( appCtxSvc.ctx.occmgmtContext.productContextInfo );
        }
        if( !isInlineEditingSuppForProperty &&
            supportedFeatures.Awb0AdditionalPropertyEditSupportInDuplicateMode === true ) {
            return true;
        } else if( !isInlineEditSupportedForCurrentDuplicateAction( vmo ) ) {
            return true;
        }
        return false;
    },
    name: 'cellRendererForInlineNonEditInDuplicateLocation'
};
/**
 * Populate inline Editing Mouse adapter adds some mouse listeners to each cell of the splm table and
 * stores the cell's column and row information.
 *
 * @param {*} cellContent cell element on which mouse adapter will add action listeners
 * @param {*} column holds information of the column
 * @param {*} vmo vmo of the cell.
 */
let populateInlineEditingMouseAdapter = function( cellContent, column, vmo ) {
    let propertyName = column.propertyName;
    if ( vmo.props[ propertyName ] )
    {
        if( !isInlineEditSupportedForCurrentDuplicateAction( vmo ) ) {
            vmo.props[ propertyName ].isEditable = false;
        }
        else {
            vmo.props[ propertyName ].isEditable = true;
        }
        cellContent.addEventListener( 'click', function() {
            vmo.props[ propertyName ].isEditable = true;
            initializeEditState();
            // In next PI we are going to align with framework direct cell editing.
            // This code is a stop gap solution and will be removed in future after alignment.
            let event = new FocusEvent( 'focus' );
            cellContent.dispatchEvent( event );
        } );
    }
    return cellContent;
};

/**
 * This API give us the mark up UI in duplicate location.
 */
let compareAndUpdateOldValueAndNewValue = function( vmo ) {
    let isRequestUpdateRequired = false;
    for( let propertyName in vmo.props ) {
        let isInlineEditingSuppForProperty;
        let propsToEdit = inlineEditingSupportedProperties.get( vmo.type );
        isInlineEditingSuppForProperty = propsToEdit.indexOf( propertyName ) > -1;

        if( isInlineEditingSuppForProperty ) {
            let vmoProp = vmo.props[ propertyName ];
            // When user changes original value to some new value then we show all affected object in mark up location.
            if( !_.isUndefined( vmoProp.newValue ) && !_.isEqual( vmoProp.newValue, vmoProp.oldValue && vmoProp.valueUpdated) ) {
                vmoProp.oldValue = vmoProp.prevDisplayValues[ 0 ];
                vmoProp.dbValue = vmoProp.value;
                vmoProp.uiValue = vmoProp.newValue;
                isRequestUpdateRequired = true;
            }
            // When user reverts back to original value we render them as their original way.
            else if( vmoProp.oldValue && _.isEqual( vmoProp.newValue, vmoProp.oldValue ) ) {
                var oldValue = vmoProp.oldValue;
                vmoProp.oldValue = undefined;
                vmoProp.uiValue = oldValue;
                isRequestUpdateRequired = true;
            }
        }
    }
    if( isRequestUpdateRequired ) {
        occMgmtDuplicateActionService.updateCloneObjectInfo( vmo );
    }
};

/**
 * Resets edit handler to non edit location.
 */
let resetEditHandlerState = function() {
    let editService = editHandlerService.getEditHandler( appCtxSvc.ctx.occmgmtContext.vmc.name );
    if( editService._editing ) {
        editService.cancelEdits();
    }
};

/**
 * Notify the save state changes
 */
let initializeEditState = function() {
    let editService = editHandlerService.getEditHandler( appCtxSvc.ctx.occmgmtContext.vmc.name );
    let dataSource = editService.getDataSource();
    editService._editing = true;
    // Add to the appCtx about the editing state
    let context = {
        state: 'starting'
    };
    appCtxSvc.updateCtx( 'editInProgress', editService._editing );
    eventBus.publish( 'editInProgress', editService._editing );
    context.dataSource = dataSource.getSourceObject();
    eventBus.publish( 'editHandlerStateChange', context );
};

/**
 * This API checked whether Editability should be enabled or not based on action column value.
 * @param {*} vmo table row's vmo
 */
let isInlineEditSupportedForCurrentDuplicateAction = function( vmo ) {
    let effectiveactionValue = occMgmtDuplicateActionService.getEffectiveDuplicateOperation( vmo );
    if( effectiveactionValue === 0 || effectiveactionValue === 6 ) {
        return true;
    }
    return false;
};

/**
 * This API will make sure that resetEditHandler gets added to the pinned element of
 * splm table widget only once.
 * @param {HTMLElement} pinnedContentElement
 */
let attachResetHandlerToPinnedElement = function( pinnedContentElement ) {
    if( pinnedContentElement ) {
        let isClickListenerAttached = pinnedContentElement.onclick;
        if( !_.isUndefined( isClickListenerAttached ) ) {
            pinnedContentElement.onclick = function() {
                resetEditHandlerState();
            };
        }
    }
};

let attachResetElementToIMageElement = function( imgElement ) {
    if( !_.isUndefined( imgElement ) ) {
        imgElement.addEventListener( 'click', function() {
            resetEditHandlerState();
        } );
    }
};

export var getOccMgmtDuplicateCellRenderers = function() {
    return [ _duplicateEditCellRender, _duplicateNonEditCellRender ];
};

let getExtendedToolTipData = function( columnField ) {
    let actionMessageInfo = {};
    actionMessageInfo.actionKey = columnField;
    actionMessageInfo.actionMessage = localeTextBundle.occMgmtDuplicateActionTooltipMessage;
    return actionMessageInfo;
};

/**
 * Custom renderer for Column Header
 * @param {Object} column column information
 */
export let populateColHeaderDetails = function( column ) {
    let extendedToolTipdata = getExtendedToolTipData( column.displayName );
    let outputData = {
        tooltipViewName: '',
        columnDisplayName: '',
        extendedTooltipData: extendedToolTipdata
    };
    if( !column.isSplitColumn ) {
        outputData.tooltipViewName = 'OccMgmtDuplicateColHeaderTooltip';
        outputData.columnDisplayName = column.displayName;
    }
    return outputData;
};

/**
 * Inline Editing Service in duplicate location.
 * @param {Object} appCtxSvc - appCtxService to use.
 * @returns {Object} - Object.
 */

export default exports = {
    _duplicateEditCellRender,
    _duplicateNonEditCellRender,
    getOccMgmtDuplicateCellRenderers,
    inlineEditingSupportedProperties,
    populateColHeaderDetails
};
