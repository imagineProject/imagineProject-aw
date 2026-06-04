// Copyright (c) 2024 Siemens

/**
 * This module contain methods to write constraints in
 * Constraints Editor popup using Formula Suggester.
 *
 * @module js/pca0ConstraintsEditorPopupService
 */

import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';


const CONSTRAINT_FORMULA_EDIT_CONTEXT = 'CONSTRAINT_FORMULA_EDIT_CONTEXT';

/**
 * Constraint formula Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
let m_saveHandler;


let exports = {};

/**
 * Initialize Constraint editor popup atomic objects formula with internal formula, display formula and editorObject with propertyDisplayName, editContext, isDirtyFormula etc. for suggester
 * And add editingExpressionType, cfg0ApplicabilityCondition, cfg0SubjectCondition and constraintRuleUid to constraint editor object.
 * @param {Object} popUpContext Popup context data.
 * @param {Object} constraintEditorObj  Constraint editor object
 * @param {Object} formulaRef  Atomic data to store display formula and internal formula.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 * @returns {Object} returns updated constraints editor popup properties .
 */
export const initializeEditorProps = ( popUpContext, constraintEditorObj, formulaRef, editorObject ) => {
    // For suggester use
    let clonedFormulas = { ...formulaRef.getAtomicData() };
    clonedFormulas.internal = popUpContext.prop.dbValue;
    clonedFormulas.display = popUpContext.prop.uiValue;
    formulaRef.setAtomicData( clonedFormulas );

    // For suggester use
    let clonedEditorObject = { ...editorObject.getAtomicData() };
    clonedEditorObject.editContext = 'readOnly';
    clonedEditorObject.isDirtyFormula = false;
    clonedEditorObject.propertyDisplayName = popUpContext.vmo.props.object_string.uiValue + ' - ' + popUpContext.prop.propertyDisplayName;
    clonedEditorObject.useIntellisense = appCtxService.getCtx( 'preferences' )[ pca0Constants.PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE ][0] === 'true';
    editorObject.setAtomicData( clonedEditorObject );

    let clonedConstraintsEditorObj = { ...constraintEditorObj };
    clonedConstraintsEditorObj.editingExpressionType = popUpContext.prop.propertyName;
    clonedConstraintsEditorObj.cfg0ApplicabilityCondition = popUpContext.vmo.props.cfg0ApplicabilityCondition;
    clonedConstraintsEditorObj.cfg0SubjectCondition = popUpContext.vmo.props.cfg0SubjectCondition;
    clonedConstraintsEditorObj.constraintRuleUid = popUpContext.prop.parentUid;

    return clonedConstraintsEditorObj;
};

/**
 * Initialize edit and save handlers. Edit/Save handlers help detect unsaved edits
 * (when changing selection in primary workarea or navigating to another tab)
 * and handle cancel/save actions.
 * @param {Object} declViewModel View model object.
 */
export const initializeEditHandler = ( declViewModel ) => {
    // Edit Handler
    declViewModel.data.constraintFormulaEditHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModel
        } ) );

    // Add new method to identify editing context
    declViewModel.data.constraintFormulaEditHandler.getEditHandlerContext = () => {
        return CONSTRAINT_FORMULA_EDIT_CONTEXT;
    };

    declViewModel.data.constraintFormulaEditHandler.isDirty = () => {
        return awPromiseService.instance.resolve( m_saveHandler.isDirty() );
    };

    declViewModel.data.constraintFormulaEditHandler.saveEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.saveEdits() );
    };

    declViewModel.data.constraintFormulaEditHandler.cancelEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.cancelEdits() );
    };

    editHandlerService.setEditHandler( declViewModel.data.constraintFormulaEditHandler, CONSTRAINT_FORMULA_EDIT_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( CONSTRAINT_FORMULA_EDIT_CONTEXT );

    const waitUntilSaveComplete = () => {
        return new Promise( ( resolve ) => {
            // We need to use event here to get the save action completion notification.
            // As we can't directly call the save action unless the formulas are updated by suggester component
            eventBus.subscribe( 'pca0ConstraintsEditorPopup.saveActionComplete', () => {
                resolve();
            } );
        } );
    };

    // Initialize Save Handler
    m_saveHandler = {
        isDirty: function() {
            return declViewModel.atomicDataRef.editorObject.getAtomicData().isDirtyFormula;
        },
        saveEdits: async function( /*datasource, inputs*/ ) {
            let clonedEditorObject = { ...declViewModel.atomicDataRef.editorObject.getAtomicData() };
            clonedEditorObject.isDirtyFormula = false;
            clonedEditorObject.editContext = 'saveInProgress';
            declViewModel.atomicDataRef.editorObject.setAtomicData( clonedEditorObject );
            // Keep the editor alive until save is complete
            await waitUntilSaveComplete();
        },
        cancelEdits: function() {
            let editorObject = declViewModel.atomicDataRef.editorObject;
            pca0CommonUtils.changeFormulaSuggesterEditContext( editorObject, 'readOnly' );
            exports.closeConstraintsEditorPopup( declViewModel.subPanelContext.popupApi );
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
 * Enable constraint formula editor for editing.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 */
export const startEditConstraintFormula = ( editorObject ) => {
    editHandlerService.setActiveEditHandlerContext( CONSTRAINT_FORMULA_EDIT_CONTEXT );
    const activeEditHandler = editHandlerService.getActiveEditHandler();
    activeEditHandler.startEdit();

    // Notify suggester to enable editing
    pca0CommonUtils.changeFormulaSuggesterEditContext( editorObject, 'editing' );
};

/**
 * Hide constraints editor if it is opened as popup
 * @param {Object} popupApi sub panel context data.
 */
export const closeConstraintsEditorPopup = ( popupApi ) => {
    popupApi.hide();
};

/**
 * Change the edit state of the command VMO
 * @param {Object} vmo command vmo for current editing table cell.
 */
export const changeCommandVmoEditState = ( vmo ) => {
    vmo.isEditing = !vmo.isEditing;
};

/**
 * Check if there are unsaved changes in constraint formula editor and show confirmation dialog if required
 * @return {Boolean} True if there are unsaved changes else false.
 */
export const leaveConfirmationOnConstraintFormulaEditor = async() => {
    if( m_saveHandler && m_saveHandler.isDirty && m_saveHandler.isDirty() ) {
        await editHandlerService.leaveConfirmation();
        return true;
    }
    return false;
};

export default exports = {
    initializeEditorProps,
    initializeEditHandler,
    getSaveHandler,
    startEditConstraintFormula,
    closeConstraintsEditorPopup,
    changeCommandVmoEditState,
    leaveConfirmationOnConstraintFormulaEditor
};
