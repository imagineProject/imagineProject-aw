// Copyright (c) 2024 Siemens

/**
 * @module js/pca0MultiSVRSaveCancelEditsService
 */
import actionService from 'js/actionService';
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import declUtils from 'js/declUtils';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/pca0ExpressionGridService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0MultipleSVRsDisplayService from 'js/pca0MultipleSVRsDisplayService';
import pca0MultiSVRGridEditorHeaderService from 'js/pca0MultiSVRGridEditorHeaderService';
import pca0RendererService from 'js/pca0RendererService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import popupService from 'js/popupService';
import _ from 'lodash';

var _editHandlerEventSelectionChangeGridView = null;
var _editHandlerEventSelectionChangeListView = null;

/**
 * Helper to get dirty variants with and without new Variants, all if columnUids is undefined. All newVariants are considered dirty regardless of their selection state.
 * @param {Object} variabilityProps variabilityProps
 * @param {Array} columnUids of desired variants to retrieve, optional, if undefined, the entire dirty elements array will be returned
 * @param {Boolean} includeNewVariants - flag to indicate if only existing SVRs should be returned
 * @returns {Array} List of variants with edits
 */
const _getVariantsWithEdits = ( variabilityProps, columnUids, includeNewVariants ) => {
    let ret = [];
    //if the flag includeNewVariants is undefined, we are in saveAll mode and we'll exclude the newVariants, which will get saved separately as they need to create first
    if ( !includeNewVariants ) {
        ret = variabilityProps.dirtyElements.filter( variantColumnUID => {
            return !variabilityProps.newVariants.includes( variantColumnUID ) && ( _.isUndefined( columnUids ) || columnUids.includes( variantColumnUID ) );
        } );
    } else {
        // If columnUids is undefined, return all new variants otherwise the ones passed in
        ret = _.isUndefined( columnUids ) ? variabilityProps.newVariants : columnUids;
    }
    return ret;
};

/**
 * it updates the node summary
 * @param {Object} multipleVariantsGridData multipleVariantsGridData
 * @param {Object} treeDataProvider treeDataProvider
 * @param {Object} vmos vmos
 */
let _updateNodeSummary = ( multipleVariantsGridData, treeDataProvider, vmos ) => {
    vmos.forEach( vmo => {
        if ( vmo.isFamily ) {
            pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                multipleVariantsGridData.businessObjectToSelectionMap,
                vmo,
                multipleVariantsGridData.viewModelObjectMap,
                treeDataProvider.columnConfig.columns,
                true,
                veConstants.GRID_CONSTANTS.MULTI_SVR_GRID, //gridMode - This will be removed once we have gridOptions prop for a generic grid component
                vmos,
                multipleVariantsGridData.variabilityNodes
            );
        }
    } );
};

/**
 * Resets the ViewModelObjects (VMOs) for a specific column in the grid data.
 *
 * @param {Object} multipleVariantsGridData - The grid data containing business object to selection map.
 * @param {string} colID - The column ID for which the VMOs need to be reset.
 * @param {Array} vmos - The array of ViewModelObjects to be updated.
 */
let _revertColumnVmos = ( multipleVariantsGridData, colID, vmos ) => {
    for ( const [ key, value ] of Object.entries( multipleVariantsGridData.businessObjectToSelectionMap[colID] ) ) {
        const vmo = _.find( vmos, { alternateID: key } );
        if ( vmo ) {
            vmo.props[colID].dbValue = value.selectionState;
            vmo.props[colID].valueUpdated = false;
        }
    }
};

/**
 * Process a dirty element by updating node summary, reverting column VMOs, and clearing violations.
 * @param {Object} gridData - The grid data.
 * @param {String} dirtyElement - The dirty element to process.
 * @param {Object} treeDataProvider - The tree data provider.
 * @param {Object} vmos - The view model objects.
 * @param {Object} vmGridData - The view model grid data.
 */
const _processDirtyElement = ( gridData, dirtyElement, treeDataProvider, vmos, vmGridData ) => {
    _updateNodeSummary( gridData, treeDataProvider, vmos );
    _revertColumnVmos( gridData, dirtyElement, vmos );
    pca0MultipleSVRsDisplayService.clearViolations( dirtyElement, vmGridData.multipleVariantsGrid, treeDataProvider );
};

/**
 * handle the Column def (cancel edits for Column / Grid)
 * @param {String} columnDef columnDef
 * @param {Object} multipleVariantsGridData multipleVariantsGridData
 * @param {Object} vmGridData vmGridData
 * @param {Object} variabilityProps variabilityProps
 * @param {Array} leftOverDirtyColumns leftOverDirtyColumns
 * @param {Object} treeDataProvider treeDataProvider
 * @param {Object} vmos vmos
 * @returns {Object} shouldRevertToBackup, leftOverDirtyColumns
 */
let _cancelColumnEdits = ( columnDef, multipleVariantsGridData, vmGridData, variabilityProps, leftOverDirtyColumns, treeDataProvider, vmos ) => {
    let shouldRevertToBackup = false;
    if ( !_.isUndefined( columnDef ) ) {
        multipleVariantsGridData.businessObjectToSelectionMap[columnDef.field] = _.cloneDeep( multipleVariantsGridData.backupOfBusinessObjectToSelectionMap[columnDef.field] );
        vmGridData.multipleVariantsGrid.setAtomicData( multipleVariantsGridData );
        shouldRevertToBackup = true;

        for ( const variantColumnUID of variabilityProps.dirtyElements ) {
            //add everything else to the leftOverDirtyColumns but the current one and the newVariants, which have to stay dirty event without any selections
            if ( columnDef.field.startsWith( 'NewVariant' ) || variantColumnUID !== columnDef.field ) {
                leftOverDirtyColumns.push( variantColumnUID );
            }
        }
        //uncolorify the header cell, but not if it's a newVariant column
        if ( !columnDef.field.startsWith( 'NewVariant' ) ) {
            pca0RendererService.unColorifyHeaderCell(
                columnDef.titleName || columnDef.displayName,
                pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
                veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
            );
        }
        _processDirtyElement( multipleVariantsGridData, columnDef.field, treeDataProvider, vmos, vmGridData );
    } else {
        shouldRevertToBackup = pca0GridCommonUtils.isSelectionMapRestoredToBackup( multipleVariantsGridData, veConstants.GRID_CONSTANTS.MULTIPLE_VARIANTS_GRID, vmGridData );

        variabilityProps.dirtyElements.forEach( dirtyElement => {
            _processDirtyElement( multipleVariantsGridData, dirtyElement, treeDataProvider, vmos, vmGridData );
        } );
        pca0MultiSVRGridEditorHeaderService.unColorifyMultiSVRHeaderCells( variabilityProps );
    }
    return shouldRevertToBackup;
};

/**
 * Set Variants grid Handler as the active edit Handler
 * @param {Object} editHandler VM Data to initialize view
 */
let _setActiveEditHandler = ( editHandler ) => {
    editHandlerService.setEditHandler( editHandler, veConstants.VARIANTS_EDITOR_TREE_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( veConstants.VARIANTS_EDITOR_TREE_CONTEXT );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Grid Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
let m_saveHandler;


/**
 * Process Grid selection maps wrapper, takes entire variabilityData
 * Used either to save all dirty elements or a specific column or a specific subset of dirty columns like the newVariants
 * Filter out unedited SVRs, remove zero selections
 * Result will be used to populate SetVariantExpressionData SOA input 'selectedExpressions'.
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @param {Array} columnUids of desired variants to retrieve, optional, if undefined, the entire dirty elements array will be returned
 * @param {Boolean} includeNewVariants - flag to indicate if only existing SVRs should be saved
 * @returns {Object} Processed/Filtered Selected Expressions PCAGrid
 */
export let preProcessVariantsExpressionsForSaveAction = ( variabilityData, columnUids, includeNewVariants ) => {
    const multipleVariantsGrid = { ...variabilityData.multipleVariantsGrid.getAtomicData() };
    const variabilityProps = { ...variabilityData.variabilityProps.getAtomicData() };
    return exports.getCurrentSelectedExpressionsFromGrid( multipleVariantsGrid, variabilityProps, columnUids, includeNewVariants );
};

/**
 * Process Grid selection maps used either to save all dirty elements or a specific column or a specific subset of dirty columns like the newVariants
 * Filter out unedited SVRs, remove zero selections
 * Result will be used to populate SetVariantExpressionData SOA input 'selectedExpressions'.
 * @param {Object} multipleVariantsGrid -multipleVariantsGrid Atomic Data for view model
 * @param {Object} variabilityProps -variabilityProps Atomic Data for view model
 * @param {Array} columnUids of desired variants to retrieve, optional, if undefined, the entire dirty elements array will be returned
 * @param {Boolean} includeNewVariants - flag to indicate if only existing SVRs should be saved
 * @returns {Object} Processed/Filtered Selected Expressions PCAGrid
 */
export let getCurrentSelectedExpressionsFromGrid = (  multipleVariantsGrid, variabilityProps, columnUids, includeNewVariants ) => {
    // Copy deep as we do not want to update actual businessObjectToSelectionMap
    // We just want to remove unedited SVR from selection maps for Save
    let multipleVariantGridSelectionMap = { ...multipleVariantsGrid.businessObjectToSelectionMap };

    // Note: 'dirtyElements' array does NOT take into account split columns (with or without expressions)
    let variantsWithEdits = _getVariantsWithEdits( variabilityProps, columnUids, includeNewVariants );
    if ( variantsWithEdits.length > 0 ) {
        // Remove from selection maps keys that don't need to be sent to server
        //this is the case for saving new variant, in this case we have dirty columns
        multipleVariantGridSelectionMap = _.pick( multipleVariantGridSelectionMap, variantsWithEdits );

        // Resets node uids of type isUnconfigured, enumeratedFamilies & freeFormFamilies from selection
        pca0GridCommonUtils.resetNodeUidFromSelection( multipleVariantGridSelectionMap, variantsWithEdits );
    } else {
        //this is the case for performing saveAs on a column, in this case we don't have
        //any dirty columns so we should pick the column on which saveAs is performed
        multipleVariantGridSelectionMap = _.pick( multipleVariantGridSelectionMap, columnUids[0] );
        // Resets node uids of type isUnconfigured, enumeratedFamilies & freeFormFamilies from selection
        pca0GridCommonUtils.resetNodeUidFromSelection( multipleVariantGridSelectionMap, [ columnUids[0] ] );
    }

    // Clean selectionMaps:
    // 1- Remove zero selections
    // 2- Filter actual selections, removing copied selections
    pca0ExpressionGridService.removeZeroSelections( multipleVariantGridSelectionMap );

    return pca0ExpressionGridService.getPCAGridWithMultiGridFromSelectionMap( multipleVariantGridSelectionMap );
};


/**
 * Post-processing of Save action
 * Handle Edit Mode change
 * Sync maps with backup maps
 * As we are updating variabilityProps.soaResponse, treeData will be reloaded.
 * @param {Object} vmGridData - View Model Atomic Data
 * @param {Object} unsavedColumns - unsaved List of columns
 * @param {Object} columnDef - column Definition in case we are performing action on column
 * @return {Object} leftOverDirtyColumns

 */
export let postProcessSaveEdits = ( vmGridData, unsavedColumns, columnDef ) => {
    /**
     * GENERAL ASSUMPTIONS on EMPTY unsavedColumns list:
     * - No errors occurred during save
     * - Variant Table is no longer in Edit mode
     * - all input columns have been successfully saved
     * - dirtyElements collection (SVRs with edits) is reset
     */
    let isSaveSuccessful = unsavedColumns.length === 0;
    let multipleVariantsGridData = { ...vmGridData.multipleVariantsGrid.getAtomicData() };
    let variabilityPropsData = { ...vmGridData.variabilityProps.getAtomicData() };
    let leftOverDirtyColumns = [];
    leftOverDirtyColumns = leftOverDirtyColumns.concat( unsavedColumns );

    if ( !_.isUndefined( columnDef ) && !unsavedColumns.includes( columnDef.field ) ) {
        for ( let variantColumnUID of variabilityPropsData.dirtyElements ) {
            // Add column UID to list of variants to send to server for update
            if ( variantColumnUID !== columnDef.field ) {
                leftOverDirtyColumns = leftOverDirtyColumns.concat( variantColumnUID );
            }
        }
        pca0RendererService.unColorifyHeaderCell(
            columnDef.titleName ? columnDef.titleName : columnDef.displayName,
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // blue color className,
            veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
        );
        if ( !_.isEqual( multipleVariantsGridData.businessObjectToSelectionMap, multipleVariantsGridData.backupOfBusinessObjectToSelectionMap ) ) {
            multipleVariantsGridData.backupOfBusinessObjectToSelectionMap[columnDef.field] = _.cloneDeep( multipleVariantsGridData.businessObjectToSelectionMap[columnDef.field] );
            vmGridData.multipleVariantsGrid.setAtomicData( multipleVariantsGridData );
        }
    }

    if ( isSaveSuccessful ) {
        if ( leftOverDirtyColumns.length === 0 ) {
            // Reset IS_VARIANT_TREE_IN_EDIT_MODE
            appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
            pca0MultiSVRGridEditorHeaderService.unColorifyMultiSVRHeaderCells( variabilityPropsData );
        }
    } else {
        // Save was not successful: activate Edit Mode on Variant table ('Bulk Edit')
        // exports.handleStartEdits( editHandler );
    }
    // Reset dirty elements.
    variabilityPropsData.dirtyElements = leftOverDirtyColumns;
    if ( isSaveSuccessful ) {
        // Selection Maps: update Backup of selections with saved data.
        if ( !_.isEqual( multipleVariantsGridData.businessObjectToSelectionMap, multipleVariantsGridData.backupOfBusinessObjectToSelectionMap ) && columnDef === undefined ) {
            multipleVariantsGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( multipleVariantsGridData.businessObjectToSelectionMap );
            vmGridData.multipleVariantsGrid.setAtomicData( multipleVariantsGridData );
            // we need to make sure to update now the soa response as well because otherwise the changes only saved in businessObjectToSelectionMap and
            // tdp will not reflect for any other change in the grid that involves a new soa call and subsequently a reload of the tree based on the soa response
            //like in the case of adding newly saved new variants or else move from current to all which also involves a soa call
            let expressionsForSoaResponse = pca0ExpressionGridService.getPCAGridFromSelectionMap( multipleVariantsGridData.businessObjectToSelectionMap );
            variabilityPropsData.soaResponse.selectedExpressions = expressionsForSoaResponse;
        }
    } else {
        // TODO: update dirty elements and align backup only for successfully saved columns
        if ( !_.isEqual( multipleVariantsGridData.businessObjectToSelectionMap, multipleVariantsGridData.backupOfBusinessObjectToSelectionMap ) && columnDef === undefined ) {
            // Update non-unsaved columns' UIDs
            Object.keys( multipleVariantsGridData.backupOfBusinessObjectToSelectionMap )
                .filter( key => !unsavedColumns.includes( key ) )
                .forEach( key => {
                    multipleVariantsGridData.backupOfBusinessObjectToSelectionMap[key] = _.cloneDeep( multipleVariantsGridData.businessObjectToSelectionMap[key] );
                    let loadVariantsDataSoaResponse = variabilityPropsData.soaResponse;
                    let displayName = pca0VariabilityTreeDisplayService.getDisplayNameForBusinessObject( loadVariantsDataSoaResponse, key );
                    pca0RendererService.unColorifyHeaderCell(
                        displayName,
                        pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // blue color className,
                        veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
                    );
                } );

            // Align backup only for successfully saved columns
            vmGridData.multipleVariantsGrid.setAtomicData( multipleVariantsGridData );
        }
    }
    vmGridData.variabilityProps.setAtomicData( variabilityPropsData );
    const activeEditHandler = editHandlerService.getActiveEditHandler();
    let context = {
        dataSource: { editContext: veConstants.VARIANTS_EDITOR_TREE_CONTEXT },
        state: 'saved'
    };
    eventBus.publish( 'editHandlerStateChange', context );
    activeEditHandler.notifySaveStateChanged( 'saved', true );
    return leftOverDirtyColumns;
};
/**
 * API to handle Cancel Edits. It resets the businessObjectToSelectionMap using backup.
 * As we are updating variabilityProps.soaResponse, treeData will be reloaded.
 * @param {Object} vmGridData -multipleVariantsGrid Atomic Data for view model
 * @param {Object} columnDef -Column Definition
 * @param {Object} treeDataProvider -Tree Data Provider
 * @return {Object} set of Boolean flags/Objects to trigger backup data actions & returns leftOverDirtyColumns
 */
export let handleCancel = ( vmGridData, columnDef, treeDataProvider ) => {
    const vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let multipleVariantsGridData = { ...vmGridData.multipleVariantsGrid.getAtomicData() };
    let variabilityProps = { ...vmGridData.variabilityProps.getAtomicData() };
    let shouldRevertToBackup = false;
    let leftOverDirtyColumns = [];
    let removedNewVariants = false;
    let regularDirtyColumns = variabilityProps.dirtyElements.filter( dirtyElement => !dirtyElement.startsWith( 'NewVariant' ) );

    if( !_.isEmpty( multipleVariantsGridData.businessObjectToSelectionMap ) ) {
        let columnsToBeCleared = columnDef !== undefined ? [ columnDef.field ] : regularDirtyColumns;
        if( columnsToBeCleared.length > 0 ) {
            pca0CommonUtils.clearCellsUpdate( multipleVariantsGridData, columnsToBeCleared, vmos );
        }
        shouldRevertToBackup = _cancelColumnEdits( columnDef, multipleVariantsGridData, vmGridData, variabilityProps, leftOverDirtyColumns, treeDataProvider, vmos );
    }
    variabilityProps.dirtyElements = leftOverDirtyColumns;
    let context = {
        dataSource: { editContext: veConstants.VARIANTS_EDITOR_TREE_CONTEXT },
        state: 'cancelled'
    };
    eventBus.publish( 'editHandlerStateChange', context );
    if ( leftOverDirtyColumns.length === 0 ) {
        pca0CommonUtils.resetEditModeStatus();
    }
    let colConfig =  { ...treeDataProvider.columnConfig };
    //remove newVariants entirely: from tdp, columnConfig and soaResponse if there is no column def ( general cancel edits )
    //for the scenario that the cancel Edits is triggered via context menu on a newVariant column, we cannot remove the newVariant from the grid
    if ( variabilityProps.newVariants && variabilityProps.newVariants.length > 0 && !columnDef ) {
        _.forEach( variabilityProps.newVariants, newVariantUid => {
            colConfig = pca0MultipleSVRsDisplayService.removeVariantFromGrid( vmGridData, treeDataProvider, newVariantUid );
            removedNewVariants = true;
        } );
    }
    vmGridData.multipleVariantsGrid.setAtomicData( multipleVariantsGridData );
    vmGridData.variabilityProps.setAtomicData( variabilityProps );
    treeDataProvider.update( vmos, vmos.length );

    return {
        shouldRevertToBackup: shouldRevertToBackup,
        leftOverDirtyColumns: leftOverDirtyColumns,
        removedNewVariants: removedNewVariants,
        columnConfig: colConfig
    };
};

/**
 * Initialize required details for Variants Grid Editor
 * @param {Object} declViewModel - VM Object
 */
export let initGridEditor = ( declViewModel ) => {
    /**
     * Initialize Edit handler
     * use Declarative View Model for Grid Editor
     */
    let dataSource = {};
    dataSource.declViewModel = declViewModel;

    declViewModel.data.svrEditHandler =
        editHandlerFactory.createEditHandler( dataSourceService.createNewDataSource( dataSource ) );

    // Add new method to identify editing context
    declViewModel.data.svrEditHandler.getEditHandlerContext = () => {
        return veConstants.VARIANTS_EDITOR_TREE_CONTEXT;
    };

    declViewModel.data.svrEditHandler.isDirty = () => {
        return awPromiseService.instance.resolve( m_saveHandler.isDirty() );
    };

    declViewModel.data.svrEditHandler.saveEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.saveEdits() );
    };

    declViewModel.data.svrEditHandler.cancelEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.cancelEdits() );
    };

    // Initialize Edit Handler
    _setActiveEditHandler( declViewModel.data.svrEditHandler );

    //maria not sure what this is for, but there are toggle view instances in which this hits and the svrEditHandler and data source set is null
    //taking it out but leaving it in until tests confirm it's unnecessary
    //const activeEditHandler = editHandlerService.getActiveEditHandler();
    //if ( _.isNull( activeEditHandler ) || !activeEditHandler._editing ) {
    //   _setActiveEditHandler( declViewModel.data.svrEditHandler );
    // } else {
    // eventBus.subscribe( 'editHandlerStateChange', eventData => {
    //     const key = _.get( eventData, 'dataSource.editContext' );
    //     // if ( eventData.state === 'canceling' && key !== veConstants.VARIANTS_EDITOR_TREE_CONTEXT ) {
    //     //     _setActiveEditHandler( declViewModel.data.svrEditHandler );
    //     // }
    // } );
    //}

    let atomicDataRef = declViewModel.atomicDataRef;
    let triggerSelectionEventName = 'Pca0MultipleVariantsConfigurationWrapper.confirmedSelectionChanged';
    let setPrimaryAreaSelectionEventName = 'Pca0MultipleVariantsConfigurationWrapper.setPrimaryAreaSelection';
    // Initialize Save Handler
    m_saveHandler = {
        isMultiVariantsHandler: true,
        isDirty: () => {
            let variabilityProps = { ...atomicDataRef.variabilityProps.getAtomicData() };
            return variabilityProps.dirtyElements.length !== 0;
        },
        saveEdits: async function() {
            //invoking the viewModel action to directly save when dirty - reusing the view model actions
            //both calls are required because for new Variants we also need to create the objects first
            let ctx = appCtxService.getCtx();
            let evaluationCtx = {
                data: declViewModel,
                ctx: ctx
            };
            let selections = appCtxService.getCtx( 'mselected' );
            let svrNewVariantsAction = declViewModel.getAction( 'saveNewVariants' );
            declUtils.loadDependentModule( svrNewVariantsAction.deps ).then(
                function( debModuleObj ) {
                    return actionService.executeAction( declViewModel, svrNewVariantsAction, evaluationCtx, debModuleObj );
                }
            );
            let svrAction = declViewModel.getAction( 'saveVariantsExpressions' );
            declUtils.loadDependentModule( svrAction.deps ).then(
                function( debModuleObj ) {
                    return actionService.executeAction( declViewModel, svrAction, evaluationCtx, debModuleObj ).then( function() {
                        let isNoSelection = _.isEmpty( selections ) || selections.length === 1 && selections[0].type === 'Cfg0ProductItem';
                        if ( !isNoSelection ) {
                            eventBus.publish( 'Pca0MultiVariantsGrid.doServerReload' ); //needs to reflect the change, only matters in append use case
                            eventBus.publish( setPrimaryAreaSelectionEventName, { selection: selections } ); //continue with the selection change
                        } else{
                            eventBus.publish( 'Pca0MultiVariantsGridEditor.toggleListViewDisplayMode' );
                        }
                    } );
                }
            );
        },
        cancelEdits: function() {
            let variabilityProps = { ...atomicDataRef.variabilityProps.getAtomicData() };
            let selections = appCtxService.getCtx( 'mselected' );
            let isNoSelection = _.isEmpty( selections ) || selections.length === 1 && selections[0].type === 'Cfg0ProductItem';
            //do not deal with the grid view if there are no selections: following the discard click we should in this case unmount the grid
            //and load the list view (which is the default behavior if no selection)
            if ( variabilityProps.dirtyElements.length > 0 && !isNoSelection ) {
                let gridData = { ...atomicDataRef.multipleVariantsGrid.getAtomicData() };
                //if we have new variants they will have to be removed from the grid now.
                //While handleCancel could be handling that, it is better to clean of it now in case the load happens faster than the cancel edit handling
                if( variabilityProps.newVariants && variabilityProps.newVariants.length > 0 ) {
                    _.forEach( variabilityProps.newVariants, newVariantUid => {
                        pca0MultipleSVRsDisplayService.removeVariantFromGridData( gridData, variabilityProps, newVariantUid );
                    } );
                    atomicDataRef.variabilityProps.setAtomicData( variabilityProps );
                    atomicDataRef.multipleVariantsGrid.setAtomicData( gridData );
                }
                eventBus.publish( 'Pca0MultiVariantsGridEditor.handleCancelEdits' );
                eventBus.publish( triggerSelectionEventName, { selection: selections } ); //continue with the selection change
            } else if ( isNoSelection ) {
                //this is the case for when we are in the grid view and we click on discard
                //in this case we need to unmount the grid and load the list view.
                //It is better to do it here vs. via complex conditions in json which can fire simultaneously
                eventBus.publish( 'Pca0MultiVariantsGridEditor.toggleListViewDisplayMode' );
            }
        }
    };
};

/**
 * Unregister hooks or events on unMount
 * @param {Object} editHandler - instance of variants edit handler
 */
export let gridUnmount = ( editHandler ) => {
    //Close dialog if open
    popupService.hide();

    if ( !_.isUndefined( editHandler ) ) {
        // Reset edit state and handler
        pca0CommonUtils.resetEditModeStatus();

        // Remove Edit Handler
        editHandlerService.removeEditHandler( veConstants.VARIANTS_EDITOR_TREE_CONTEXT );
    }
};

/**
 * Handle Primary Variant Rule Selection Change by dealing with the current handler edit mode situation.
 * We need to redirect the selection through this common component in order to not have the
 * list view or multivariant view component be gone by the time we deal with the save/cancel edits when primary area selections change,
 * which happens via conditions if the selection is dealt with directly on the list view or multivariant view component
 * @param {Object} selection - selection
 * @param {Object} singleSVRViewMode - singleSVRViewMode
 * @param {Object} multiSvrSelection - multiSvrSelection
 */
export  let handlePrimaryVariantRuleSelectionChange = ( selection, singleSVRViewMode, multiSvrSelection ) => {
    //get current edit handler
    let editHandler = editHandlerService.getActiveEditHandler();
    let ctx = appCtxService.getCtx();
    const triggerSelectionEventName = 'Pca0MultipleVariantsConfigurationWrapper.selectionChanged';
    //because multiple observers in the initial setup this function might be called twice, so we need to check if the selection is the same
    let isSameSelection = false;
    if ( multiSvrSelection && selection.length === multiSvrSelection.length ) {
        isSameSelection = selection.every( selObj =>
            multiSvrSelection.some( multiSvrObj => selObj.uid === multiSvrObj.uid )
        );
    }
    if ( isSameSelection ) {
        return;
    }
    //if only primary area edit handler active then we can directly publish the selection change event
    if ( !isSameSelection && ( !editHandler || _.isNull( editHandler ) || !ctx.VARIANTS_EDITOR_TREE_CONTEXT && !ctx.VARIANT_FSC_CONTEXT ) ) {
        eventBus.publish( triggerSelectionEventName, { selection: selection } );
        return;
    }
    if ( ctx.VARIANTS_EDITOR_TREE_CONTEXT && selection && selection.length >= 1 && !singleSVRViewMode.isListView ) {
        editHandler =  ctx.VARIANTS_EDITOR_TREE_CONTEXT;
        if ( ctx.isVariantTableEditing ) {
            editHandler.isDirty().then( function( isDirty ) {
                if ( !isDirty ) {
                    eventBus.publish( triggerSelectionEventName, { selection: selection } );
                } else {
                    editHandlerService.setActiveEditHandlerContext( veConstants.VARIANTS_EDITOR_TREE_CONTEXT );
                    editHandlerService.leaveConfirmation();
                }
            } );
        } else {
            let isNoSelection = _.isEmpty( selection ) || selection.length === 1 && selection[0].type === 'Cfg0ProductItem';
            if ( isNoSelection ) {
                //move to list view if there are no selections in PWA.
                eventBus.publish( 'Pca0MultiVariantsGridEditor.toggleListViewDisplayMode' );
            }
            eventBus.publish( triggerSelectionEventName, { selection: selection } );
        }
    } else if ( ctx.VARIANT_FSC_CONTEXT && selection && selection.length > 1 && multiSvrSelection.length === 1 && singleSVRViewMode.isListView ) {
        //this is for the use case in which on a single svr in list view the selection got moved to 2 svrs but the triggering selection is still 1
        //Note: we don't need to care here for the list view to list view svr selection change as it will be handled by the list view component entirely as
        //the view doesn't switch and fullscreen configuration is still alive
        editHandler = ctx.VARIANT_FSC_CONTEXT;
        if ( ctx.editInProgress ) {
            editHandler.isDirty().then( function( isDirty ) {
                if ( !isDirty ) {
                    eventBus.publish( triggerSelectionEventName, { selection: selection } );
                } else if ( isDirty ) {
                    _editHandlerEventSelectionChangeListView ? eventBus.unsubscribe( _editHandlerEventSelectionChangeListView ) : '';
                    // the cancelling state is already on in this case, we just need to delay the switch and check the state change
                    _editHandlerEventSelectionChangeListView = eventBus.subscribe( 'editHandlerStateChange', eventData => {
                        //the starting is questionable; I made a comment where it's done, basically the fsc sets the state to starting after canceling
                        //so we'll use that for now to limit the changes to the primary area selection change, but we should revisit the edit handling there as well
                        if ( eventData.state === 'saved' || eventData.state === 'starting' ) {
                            eventBus.publish( triggerSelectionEventName, { selection: selection } );
                            eventBus.unsubscribe( _editHandlerEventSelectionChangeListView );
                            _editHandlerEventSelectionChangeListView = null;
                        }
                    } );
                }
            } );
        } else {
            eventBus.publish( triggerSelectionEventName, { selection: selection } );
        }
    } else {
        eventBus.publish( triggerSelectionEventName, { selection: selection } );
    }
};

/**
 * Sets programatically the list view mode on singleSVRViewMode atomic data
 * @param {Object} singleSVRViewMode singleSVRViewMode atomic data to set list view on
 */
export let toggleListViewMode = ( singleSVRViewMode ) => {
    let singleSVRViewModeValue = { ...singleSVRViewMode.getAtomicData() };
    singleSVRViewModeValue.isListView = true;
    singleSVRViewMode.setAtomicData( singleSVRViewModeValue );
};

/**
 * we should not flicker when we enter multiSelectionGrid view, so set the initial value of the view mode based on the selection
 * @param {Object} singleSVRViewMode singleSVRViewMode atomic data to set list view on
 * @param {Array} selection pwa selection
 */
export let setIntialViewMode = ( singleSVRViewMode, selection ) => {
    let singleSVRViewModeValue = { ...singleSVRViewMode.getAtomicData() };
    if( selection.length > 1 ) {
        singleSVRViewModeValue.isListView = false;
        singleSVRViewMode.setAtomicData( singleSVRViewModeValue );
    } // do nothing else because the initial view is already set as list view by default
};


export default exports = {
    preProcessVariantsExpressionsForSaveAction,
    getCurrentSelectedExpressionsFromGrid,
    postProcessSaveEdits,
    handleCancel,
    initGridEditor,
    gridUnmount,
    handlePrimaryVariantRuleSelectionChange,
    toggleListViewMode,
    setIntialViewMode
};
