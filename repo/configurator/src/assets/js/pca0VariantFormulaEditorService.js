// Copyright (c) 2022 Siemens

/**
 * This module contain methods to author variant conditions in
 * Variant Formula Editor.
 *
 * @module js/pca0VariantFormulaEditorService
 */
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0RendererService from 'js/pca0RendererService';
import _ from 'lodash';

const subCtxEditKey = '.variantFormulaEditInProgress';
const subCtxEditKeyIsDirty = '.variantFormulaIsDirty';
const FORMULA_EDIT_CONTEXT = 'FORMULA_EDIT_CONTEXT';

/**
 * Sets the display formula in the editor for the selected object on which variant formula editor has been opened.
 * First check if display formula is cached, if not then retrieve it from getVariantFormulae soa.
 * @param {Object} subPanelContext - subpanel view model.
 * @returns {String} Display formula for the selected object.
 */
const _getDisplayFormulaInEditor = ( subPanelContext ) => {
    const configPerspectiveUid = subPanelContext.configPerspectiveUid;
    const formula = _getVariantFormulaFromSelectedObj( subPanelContext );

    // get Cached display formula.
    const formulaMap = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap' ) };
    var displayFormula = '';
    if( formulaMap && formulaMap[ configPerspectiveUid ] && formulaMap[ configPerspectiveUid ][ formula ] ) {
        displayFormula = formulaMap[ configPerspectiveUid ][ formula ];
    } else if( !_.get( subPanelContext, pca0Constants.HOSTED_CONFIGURATOR_MODE ) ) {
        // Fire event to get display formula from soa if not in hosted-configurator mode and then set in
        // on variant formula editor.
        eventBus.publish( 'pca0VariantFormulaEditor.setDisplayFormulaInEditor' );
    }
    return displayFormula;
};

/**
 * Returns the variant formula for selected object from cache soaResponse in subPanelContext.
 * @param {Object} subPanelContext subPanel view model.
 * @returns {String} the variant formula for the selected object.
 */
const _getVariantFormulaFromSelectedObj = ( subPanelContext ) => {
    const selectedObject = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.selectedObject' ) };
    return subPanelContext.selectedExpressions[ selectedObject.uid ][ 0 ].formula;
};

const _setIsFormulaDirty = ( contextKey, isDirty ) => {
    appCtxService.updatePartialCtx( contextKey + subCtxEditKeyIsDirty, isDirty );
};

/**
 * Grid Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
let m_saveHandler;

/**
 * Variable to store if selected object changed and will be used only in this file.
 */
let m_isSelectedObjectChanged;

/**
 * Exports start here.
 */
let exports = {};

/**
 * Opens the variant formula editor if not already open, o.w. refresh editor properties.
 * @param {Object} commandContext - The ViewModel object.
 * @param {Object} contextKey - contextKey for app context where formula editor properties are stored.
 */
export const openVariantFormulaEditor = ( commandContext, contextKey ) => {
    // Fetch formula editor properties store in app ctx for given contextKey.
    var formulaEditorProps = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps' ) };
    if( !formulaEditorProps ) {
        formulaEditorProps = {};
    }
    var isRefreshRequired = false;
    if( formulaEditorProps.isFormulaEditorOpen ) {
        // If formula editor is already open, then refresh of editor properties is required.
        isRefreshRequired = true;

        //Remove previously highlighted column header
        pca0RendererService.unColorifyHeaderCell(
            formulaEditorProps.selectedObject.displayName, // titleName
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // color className
            pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION // Grid Id
        );
    } else {
        // Else open the formula editor.
        formulaEditorProps.isFormulaEditorOpen = true;
        formulaEditorProps.selectedObject = {};
    }
    // Get column on which formula editor has been opened.
    formulaEditorProps.selectedObject.uid = commandContext.gridContext.columnDef.uid;
    formulaEditorProps.selectedObject.displayName = commandContext.columnDef.displayName;

    //Highlight column header for which formula editor is opened
    pca0RendererService.colorifyHeaderCell(
        commandContext.columnDef.displayName, // titleName
        pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // color className
        pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION // Grid Id
    );

    // Update formula editor properties.
    appCtxService.updatePartialCtx( contextKey + '.formulaEditorProps', formulaEditorProps );

    if( isRefreshRequired ) {
        // Event to refresh editor properties.
        eventBus.publish( 'pca0VariantFormulaEditor.refresh' );
    }

    _setIsFormulaDirty( contextKey, false );
};

/**
 * Discard edited changes and disable the editing of the Formula editor.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 */
export const cancelEditVariantFormulaEditor = ( contextKey, editorObject ) => {
    // Notify edit handler to cancel edits
    let editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler._editing = false;

    // Reset editor properties
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, false );
    _setIsFormulaDirty( contextKey, false );

    pca0CommonUtils.changeFormulaSuggesterEditContext( editorObject, 'readOnly' );
};

/**
 * Enable variant formula editor for editing.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 */
export const startEditVariantFormulaEditor = ( contextKey, editorObject ) => {
    let editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( FORMULA_EDIT_CONTEXT );

    // Add to the appCtx about the editing state: alternative of setting editHandler.startEdit();
    // This way we are not using native edit mode template for cells
    editHandler._editing = true;

    // Set edit state in context
    _setIsFormulaDirty( contextKey, true );
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, true );

    pca0CommonUtils.changeFormulaSuggesterEditContext( editorObject, 'editing' );
};

/**
 * Close the variant formula editor. Unsaved changes are handled by edit handler.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 */
export const closeVariantFormulaEditor = ( contextKey ) => {
    // Notify edit handler to cancel edits
    let editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler.cancelEdits();

    // Reset editor properties
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, false );

    // Fetch formula editor properties store in app ctx for given contextKey.
    let formulaEditorProps = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps' ) };
    //Remove column header highlighting
    pca0RendererService.unColorifyHeaderCell(
        formulaEditorProps.selectedObject.displayName, // titleName
        pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // color className
        pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION // Grid Id
    );

    formulaEditorProps.isFormulaEditorOpen = false;
    formulaEditorProps.selectedObject = {};
    appCtxService.updatePartialCtx( contextKey + '.formulaEditorProps', formulaEditorProps );

    _setIsFormulaDirty( contextKey, false );
};

/**
 * Post processing of successful variant formula save.
 * It resets edit command visibility in PWA and in VCA and disables edit mode of Formula Editor.
 */
export let postProcessSaveVariantFormula = () => {
    let editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler.cancelEdits();
};

/**
 * Sets the display formula in the editor retrieved by getVariantFormulae SOA.
 * Caches the response as well.
 * @param {Object} subPanelContext - sub panel context data.
 * @param {Object} soaResponse - getVariantFormulae SOA Response.
 * @returns {String} Returns display formula fetched by soa.
 */
export const postProcessSetDisplayFormulaeInEditor = ( subPanelContext, soaResponse ) => {
    var displayFormula = '';
    const configPerspectiveUid = subPanelContext.configPerspectiveUid;
    const formula = _getVariantFormulaFromSelectedObj( subPanelContext );
    if( soaResponse.formulae[ 0 ].displayFormula ) {
        displayFormula = soaResponse.formulae[ 0 ].displayFormula;
        var displayFormulaMap = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap' ) };
        if( !displayFormulaMap ) {
            displayFormulaMap = [];
        }
        if( !displayFormulaMap[ configPerspectiveUid ] ) {
            displayFormulaMap[ configPerspectiveUid ] = [];
        }
        // Cache the display Formula
        displayFormulaMap[ configPerspectiveUid ][ formula ] = displayFormula;
        appCtxService.updatePartialCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap', displayFormulaMap );
    }
    return displayFormula;
};

/**
 * Initialized formula editor properties such as Display name, variant formula and display formula.
 * Close the editor if selected object is no longer available.
 * @param {Object} subPanelContext sub panel context data.
 * @param {Object} formulaRef  Atomic data to store display formula and internal formula.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 * @returns {Object} returns updated variant formula editor properties.
 */
export const initializeEditorProps = ( subPanelContext, formulaRef, editorObject ) => {
    let clonedEditorObject = { ...editorObject.getAtomicData() };
    let contextKey = subPanelContext.contextKey;
    let selectedObject = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
    let localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    if( selectedObject.uid && subPanelContext.selectedExpressions[ selectedObject.uid ] ) {
        let clonedFormulas = { ...formulaRef.getAtomicData() };
        let formula = _getVariantFormulaFromSelectedObj( subPanelContext );
        clonedFormulas.internal = formula;
        let displayFormula = _getDisplayFormulaInEditor( subPanelContext );
        clonedFormulas.display = displayFormula;
        clonedEditorObject.useIntellisense = appCtxService.getCtx( 'preferences' )[ pca0Constants.PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE ][0] === 'true';
        clonedEditorObject.editContext = 'readOnly';
        clonedEditorObject.isDirtyFormula = false;
        clonedEditorObject.propertyDisplayName = localeTextBundle.for + ': ' + selectedObject.displayName;
        m_isSelectedObjectChanged = false;
        return { contextKey, formula : clonedFormulas, editorObject:clonedEditorObject };
    }

    if( clonedEditorObject.isDirtyFormula || clonedEditorObject.editContext === 'saveInProgress' ) {
        // If formula is dirty don't close the editor it will be closed after save or discard action completes
        m_isSelectedObjectChanged = true;
    }else{
        // If formula is not dirty show popup that editor will close and close editor.
        messagingService.showInfo( localeTextBundle.closingVariantFormulaEditorMessage.replace( '{0}', selectedObject.displayName ) );
        exports.closeVariantFormulaEditor( contextKey, subPanelContext.isHostedPCAMode );
    }
};

/**
 * Initialize edit and save handlers. Edit/Save handlers help detect unsaved edits
 * (when changing selection in primary workarea or navigating to another tab)
 * and handle cancel/save actions.
 * @param {Object} declViewModel View model object.
 */
export const initializeEditHandler = ( declViewModel ) => {
    // Edit Handler
    declViewModel.data.variantFormulaEditHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModel
        } ) );

    // Add new method to identify editing context
    declViewModel.data.variantFormulaEditHandler.getEditHandlerContext = () => {
        return FORMULA_EDIT_CONTEXT;
    };

    declViewModel.data.variantFormulaEditHandler.isDirty = () => {
        return awPromiseService.instance.resolve( m_saveHandler.isDirty() );
    };

    declViewModel.data.variantFormulaEditHandler.saveEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.saveEdits() );
    };

    declViewModel.data.variantFormulaEditHandler.cancelEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.cancelEdits() );
    };

    editHandlerService.setEditHandler( declViewModel.data.variantFormulaEditHandler, FORMULA_EDIT_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( FORMULA_EDIT_CONTEXT );


    // Initialize Save Handler
    m_saveHandler = {
        isDirty: function() {
            return declViewModel.atomicDataRef.editorObject.getAtomicData().isDirtyFormula;
        },
        saveEdits: function( /*datasource, inputs*/ ) {
            let clonedEditorObject = { ...declViewModel.atomicDataRef.editorObject.getAtomicData() };
            clonedEditorObject.isDirtyFormula = false;
            clonedEditorObject.editContext = 'saveInProgress';
            declViewModel.atomicDataRef.editorObject.setAtomicData( clonedEditorObject );
        },
        cancelEdits: function() {
            let contextKey = declViewModel.contextKey;
            let editorObject = declViewModel.atomicDataRef.editorObject;
            exports.cancelEditVariantFormulaEditor( contextKey, editorObject );

            // Show popup that editor will close and call close editor action if selected object is changed
            if( m_isSelectedObjectChanged ) {
                m_isSelectedObjectChanged = false;
                let localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
                let selectedObject = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
                messagingService.showInfo( localeTextBundle.closingVariantFormulaEditorMessage.replace( '{0}', selectedObject.displayName ) );
                exports.closeVariantFormulaEditor( contextKey );
            }
        }
    };
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export const getSaveHandler = () => {
    return m_saveHandler;
};

/**
 * Return uid of the selected object in formula editor.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @returns {String} Uid of the selected object.
 */
export const getSelectedObjUid = ( contextKey ) => {
    var selectedObjUid = '';
    const selectedObject = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
    if( selectedObject && selectedObject.uid ) {
        selectedObjUid = selectedObject.uid;
    }
    return selectedObjUid;
};

/**
 * Changes editor view mode from saveInProgress to editing and returns partial errors
 * @param {Object} ServiceData - Save action soa response servicedata
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 */
export const handleSaveActionFailure = ( ServiceData, editorObject ) => {
    if( m_isSelectedObjectChanged ) {
        // If save action is failed after leave confirmation then call cancel edits to update ctx and close editor
        let editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
        editHandler.cancelEdits();
    }else{
        // Change edit context back to editing and set errors on editor object to show in the editor
        pca0CommonUtils.changeFormulaSuggesterEditContext( editorObject, 'editing', ServiceData );
    }
};

/**
 * Update reloadVariabilityDataKey with random value to reload variability data.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 */
export const reloadVariabilityData = ( editorObject ) => {
    let clonedEditorObject = { ...editorObject.getAtomicData() };
    clonedEditorObject.reloadVariabilityDataKey = Date.now();
    editorObject.setAtomicData( clonedEditorObject );
};

/**
 * Service to operate variant formula editor.
 */
export default exports = {
    openVariantFormulaEditor,
    cancelEditVariantFormulaEditor,
    startEditVariantFormulaEditor,
    closeVariantFormulaEditor,
    postProcessSaveVariantFormula,
    postProcessSetDisplayFormulaeInEditor,
    initializeEditorProps,
    initializeEditHandler,
    getSaveHandler,
    getSelectedObjUid,
    handleSaveActionFailure,
    reloadVariabilityData
};
