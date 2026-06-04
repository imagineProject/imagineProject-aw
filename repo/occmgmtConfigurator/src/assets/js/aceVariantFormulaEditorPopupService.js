// Copyright (c) 2024 Siemens

/**
 * @module js/aceVariantFormulaEditorPopupService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import parsingUtils from 'js/parsingUtils';
import tableSvc from 'js/splmTablePublishedService';


var exports = {};
const subCtxEditKeyIsDirty = '.variantFormulaIsDirty';

export let formulaTableCellRenderer = () => {
    const CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER = 'aw-cfg-formula-edit-gridCellCommand';
    let _cellCmdElemArr = [];
    let _cellCmdVmoArr = [];

    const createCommandCellHandler = ( cellTop, column, vmo, tableElem ) => {
        return () => {
            if ( !tableElem._tableInstance.isBulkEditing && !tableElem._tableInstance.showCheckBox && cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER ).length === 0 ) {
                if( _cellCmdElemArr.length > 0 ) {
                    _cellCmdElemArr.forEach( ( elem, index ) => {
                        if( elem && !_cellCmdVmoArr[ index ].isEditing ) {
                            destroyHoverCommandElement( elem );
                        }
                    } );
                }
                let cmdElem = tableSvc.createCellCommandElement( column, vmo, false );
                cmdElem.classList.add( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER );
                cellTop.appendChild( cmdElem );

                _cellCmdElemArr.push( cmdElem );
                _cellCmdVmoArr.push( vmo );
            }
        };
    };

    const destroyCommandCellHandler = ( cellTop, column, vmo, tableElem ) => {
        return () => {
            if ( !tableElem._tableInstance.showCheckBox && cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER ).length === 1 && cellTop.getElementsByClassName( 'aw-state-selected' ).length === 0 && !vmo.isEditing ) {
                destroyHoverCommandElement( cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER )[ 0 ] );
            }
        };
    };

    const destroyHoverCommandElement = ( cmdElem ) => {
        if ( cmdElem && cmdElem.parentElement ) {
            cmdElem.parentElement.removeChild( cmdElem );
        }
        const cmdElemIndex = _cellCmdElemArr.indexOf( cmdElem );
        if ( cmdElemIndex > -1 ) {
            _cellCmdElemArr.splice( cmdElemIndex, 1 );
            _cellCmdVmoArr.splice( cmdElemIndex, 1 );
        }
    };

    const addCommandOnHover = ( commandHandlerParent, column, vmo, tableElem ) => {
        // Add event listener for mouseover
        commandHandlerParent.addEventListener( 'mouseover', createCommandCellHandler( commandHandlerParent, column, vmo, tableElem ) );
    };

    const removeCommandOnHover = ( commandHandlerParent, column, vmo, tableElem ) => {
        // Add event listener for mouseleave
        commandHandlerParent.addEventListener( 'mouseleave', destroyCommandCellHandler( commandHandlerParent, column, vmo, tableElem ) );
    };

    return{
        action: ( column, vmo, tableElem, rowElem ) => {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            if ( cellContent ) {
                // Add command on hover
                addCommandOnHover( cellContent, column, vmo, tableElem );
                // Remove command on hover
                removeCommandOnHover( cellContent, column, vmo, tableElem );
            }
            return cellContent;
        },
        condition: ( column ) => {
            return [ 'awb0VariantFormula' ].includes( column.propertyName );
        },
        name: 'formulaTableCellRenderer'
    };
};

export let initialize = function() {
    appCtxSvc.updatePartialCtx( 'customRendererForColumns.formulaTableCellRenderer', [ formulaTableCellRenderer() ] );
};

const _setIsFormulaDirty = ( contextKey, isDirty ) => {
    appCtxSvc.updatePartialCtx( contextKey + subCtxEditKeyIsDirty, isDirty );
};

export const openVariantFormulaPopupEditor = ( commandContext, contextKey ) => {
    // Fetch formula editor properties store in app ctx for given contextKey.
    var formulaEditorProps = { ...appCtxSvc.getCtx( contextKey + '.formulaEditorProps' ) };
    if( !formulaEditorProps ) {
        formulaEditorProps = {};
    }
    var isRefreshRequired = false;
    if( formulaEditorProps.isFormulaEditorOpen ) {
        // If formula editor is already open, then refresh of editor properties is required.
        isRefreshRequired = true;
    } else {
        // Else open the formula editor.
        formulaEditorProps.isFormulaEditorOpen = true;
        formulaEditorProps.selectedObject = {};
    }
    // Get column on which formula editor has been opened.
    formulaEditorProps.selectedObject.uid = commandContext.uid;
    formulaEditorProps.selectedObject.displayName = commandContext.displayName;

    // Update formula editor properties.
    appCtxSvc.updatePartialCtx( contextKey + '.formulaEditorProps', formulaEditorProps );

    if( isRefreshRequired ) {
        // Event to refresh editor properties.
        eventBus.publish( 'AceVariantFormulaEditorPopup.refresh' );
    }

    _setIsFormulaDirty( contextKey, false );
};

/**
 * Prepare SOA input to get variants expression using getVariantExpressionData4
 * @returns {Object} required as input for SOA
 * @param {Object} subPanelContext - subPanel context in hosted configurator mode to get configContext
 */
let prepareSOAInputToGetVariants = function( commandContext ) {
    let selectedObjects = [];
    if ( commandContext && commandContext.uid ) {
        let object = {
            type: 'Awb0Element',
            uid: commandContext.uid
        };
        selectedObjects.push( object );
    }
    return {
        variantExpressionDataInput: {
            configContextProvider: '',
            configContext: '',
            configPerspective: '',
            selectedObjects: selectedObjects,
            currentExpandedFamilies: '',
            filters: {
                intentFilters: [],
                optionFilter: 'pca0_show_current'
            },
            requestInfo: {
                requestType: [],
                jsonGrid: [],
                reassessSelections: [ 'false' ]
            }
        }
    };
};

export let getConfigPerspective = function( subPanelContext ) {
    var input = prepareSOAInputToGetVariants( subPanelContext );

    return soaService.postUnchecked( 'Internal-ProductConfiguratorAw-2024-12-ConfiguratorManagement',
        'getVariantExpressionData4', input ).then( soaResponse => {
        return soaResponse.configPerspective;
    } );
};

export default exports = {
    openVariantFormulaPopupEditor,
    getConfigPerspective,
    initialize,
    formulaTableCellRenderer
};


