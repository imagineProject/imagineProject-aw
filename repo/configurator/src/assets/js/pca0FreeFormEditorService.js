// Copyright (c) 2024 Siemens
/**
 * This file contains functionality for SMT free form editor.
 *
 * @module js/pca0FreeFormEditorService
 */
import appCtxSvc from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import dmService from 'soa/dataManagementService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import * as monaco from 'monaco-editor';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pcaObjectTypeLOVComponentService from 'js/PcaObjectTypeLOVComponentService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

/**
 * Grid Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
let m_saveHandler;
let m_localizedMessages;

/* SMT2 language configuration */
const smt2_conf = {
    autoClosingPairs: [
        { open: '(', close: ')' }
    ]
};
/* SMT2 language definition (borrowed from monaco editor languages) */
const smt2_lang = {

    // Set defaultToken to invalid to see what you do not tokenize yet
    // defaultToken: 'invalid',

    keywords: [
        'define-fun', 'define-const', 'assert', 'push', 'pop', 'assert', 'check-sat',
        'declare-const', 'declare-fun', 'get-model', 'get-value', 'declare-sort',
        'declare-datatypes', 'reset', 'eval', 'set-logic', 'help', 'get-assignment',
        'exit', 'get-proof', 'get-unsat-core', 'echo', 'let', 'forall', 'exists',
        'define-sort', 'set-option', 'get-option', 'set-info', 'check-sat-using', 'apply', 'simplify',
        'display', 'as', '!', 'get-info', 'declare-map', 'declare-rel', 'declare-var', 'rule',
        'query', 'get-user-tactics'
    ],

    operators: [
        '=', '&gt;', '&lt;', '&lt;=', '&gt;=', '=&gt;', '+', '-', '*', '/'
    ],

    builtins: [
        'mod', 'div', 'rem', '^', 'to_real', 'and', 'or', 'not', 'distinct',
        'to_int', 'is_int', '~', 'xor', 'if', 'ite', 'true', 'false', 'root-obj',
        'sat', 'unsat', 'const', 'map', 'store', 'select', 'sat', 'unsat',
        'bit1', 'bit0', 'bvneg', 'bvadd', 'bvsub', 'bvmul', 'bvsdiv', 'bvudiv', 'bvsrem',
        'bvurem', 'bvsmod',  'bvule', 'bvsle', 'bvuge', 'bvsge', 'bvult',
        'bvslt', 'bvugt', 'bvsgt', 'bvand', 'bvor', 'bvnot', 'bvxor', 'bvnand',
        'bvnor', 'bvxnor', 'concat', 'sign_extend', 'zero_extend', 'extract',
        'repeat', 'bvredor', 'bvredand', 'bvcomp', 'bvshl', 'bvlshr', 'bvashr',
        'rotate_left', 'rotate_right', 'get-assertions'
    ],

    brackets: [
        [ '(', ')', 'delimiter.parenthesis' ],
        [ '{', '}', 'delimiter.curly' ],
        [ '[', ']', 'delimiter.square' ]
    ],

    // we include these common regular expressions
    symbols:  /[=&gt;&lt;~&amp;|+\-*\/%@#]+/,

    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
        root: [
            // identifiers and keywords
            [ /[a-z_][\w\-\.']*/, { cases: { '@builtins': 'predefined.identifier',
                '@keywords': 'keyword',
                '@default': 'identifier' } } ],
            [ /[A-Z][\w\-\.']*/, 'type.identifier' ],
            [ /[:][\w\-\.']*/, 'string.identifier' ],
            [ /[$?][\w\-\.']*/, 'constructor.identifier' ],

            // whitespace
            { include: '@whitespace' },

            // delimiters and operators
            [ /[()\[\]]/, '@brackets' ],
            [ /@symbols/, { cases: { '@operators': 'predefined.operator',
                '@default'  : 'operator' } } ],


            // numbers
            [ /\d*\.\d+([eE][\-+]?\d+)?/, 'number.float' ],
            [ /0[xX][0-9a-fA-F]+/, 'number.hex' ],
            [ /#[xX][0-9a-fA-F]+/, 'number.hex' ],
            [ /#b[0-1]+/, 'number.binary' ],
            [ /\d+/, 'number' ],

            // delimiter: after number because of .\d floats
            [ /[,.]/, 'delimiter' ],

            // strings
            [ /"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            [ /"/,  { token: 'string.quote', bracket: '@open', next: '@string' } ],

            // user values
            [ /\{/, { token: 'string.curly', bracket: '@open', next: '@uservalue' } ]
        ],

        uservalue: [
            [ /[^\\\}]+/, 'string' ],
            [ /\}/,       { token: 'string.curly', bracket: '@close', next: '@pop' } ],
            [ /\\\}/,     'string.escape' ],
            [ /./,        'string' ]  // recover
        ],

        string: [
            [ /[^\\"]+/,  'string' ],
            [ /@escapes/, 'string.escape' ],
            [ /\\./,      'string.escape.invalid' ],
            [ /"/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
        ],

        whitespace: [
            [ /[ \t\r\n]+/, 'white' ],
            [ /;.*$/,    'comment' ]
        ]
    }
};

/**
 * Initialize the Free Form Editor Edit Handler
 * @param {Object} declViewModel - Declaration View Model
 */
const _initializeEditHandlerForMonacoEditor = ( declViewModel ) => {
    let dataSource = {};
    dataSource.declViewModel = declViewModel;
    declViewModel.data.freeFormEditorHandler = editHandlerFactory.createEditHandler( dataSourceService.createNewDataSource( dataSource ) );

    // Add new method to identify editing context
    declViewModel.data.freeFormEditorHandler.getEditHandlerContext = () => {
        return veConstants.FREEFORM_CONSTANTS.FREEFORM_EDITOR_CONTEXT;
    };

    declViewModel.data.freeFormEditorHandler.isDirty = () => {
        return awPromiseService.instance.resolve( m_saveHandler.isDirty() );
    };

    declViewModel.data.freeFormEditorHandler.saveEdits = () => {
        return awPromiseService.instance.resolve( m_saveHandler.saveEdits() );
    };

    editHandlerService.setEditHandler( declViewModel.data.freeFormEditorHandler, veConstants.FREEFORM_CONSTANTS.FREEFORM_EDITOR_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( veConstants.FREEFORM_CONSTANTS.FREEFORM_EDITOR_CONTEXT );

    // Initialize Save Handler
    m_saveHandler = {
        isDirty: () => {
            let freeFormEditorDataAtmData = declViewModel.atomicDataRef.freeFormEditorData.getAtomicData();
            // If no constraint is loaded, then editor is not dirty
            if( _.isUndefined( freeFormEditorDataAtmData.currentConstraintLoaded ) ) {
                return false;
            }
            if ( freeFormEditorDataAtmData.newConstraintCreatedState === 'creating' ) {
                return false;
            }
            let isDirty = freeFormEditorDataAtmData.isDirty;
            if( isDirty ) {
                let selectedObjects = appCtxSvc.getCtx( 'mselected' );
                // Check if newly selected object is different from the object loaded in the editor OR multiple objects are selected
                // This condition will be true if user has selected a different object in PWA or selected multiple objects in PWA.
                // In such case, isDirty gets called again. Hence, leave confirmation depends on the second call of isDirty()
                // Hence, not making isDirty flag false in this case.
                if( selectedObjects.length > 1 ||  selectedObjects.length === 1 && selectedObjects[ 0 ].uid !== freeFormEditorDataAtmData.currentConstraintLoaded.uid ) {
                    // In this case, don't change isDirty flag to false
                } else {
                    // We are here, because sub-location has been changed. In that case, we should turn isDirty flag to false.
                    // In this case also, isDirty gets called multiple-times. But once we get isDirty as true, leave confirmation
                    // comes up. If I don't change isDirty to false, I see multiple leave confirmation dialogs.
                    declViewModel.atomicDataRef.freeFormEditorData.setAtomicData( { ...freeFormEditorDataAtmData, isDirty: false } );
                }
            }
            return isDirty;
        },
        saveEdits: () => {
            // TODO : Jinesh - Remove event. Instead call saveFreeFormExpressionOnConstraint directly.
            // But the view model data is not updated. Hence, instead of using viewModelData, see
            // if editor.getValues() can be used to get the content of the editor.
            eventBus.publish( 'Pca0FreeFormEditor.saveExpression', { isSavedFromLeaveHandler: true } );
        }
    };
};

/**
 * Return an empty ListModel object.
 * @return {Object} - Empty ListModel object.
 */
const _getEmptyListModel = () => {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Populate the templates for the editor
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @returns {Array} - Array of templates
 */
const _populateTemplatesForEditor = ( freeFormEditorData ) => {
    if( !_.isEmpty( freeFormEditorData.getAtomicData().listOfTemplates ) ) {
        return;
    }
    let emptyTemplate = _getEmptyListModel();

    let mathematicalAdditionTemplate = _getEmptyListModel();
    mathematicalAdditionTemplate.propDisplayValue = 'Mathematical addition';
    mathematicalAdditionTemplate.propInternalValue = '(assert(= |[namepace]Family_Sum| (+ |[namespace]Family_A| |[namespace]Family_B| ))) ; formula: Sum = A + B';
    mathematicalAdditionTemplate.propDisplayDescription = mathematicalAdditionTemplate.propInternalValue;

    let mathematicalMultiplicationWithVariableDefinitionTemplate = _getEmptyListModel();
    mathematicalMultiplicationWithVariableDefinitionTemplate.propDisplayValue = 'Mathematical multiplication With Variable Definition';
    // spacing for below formula is removed on purpose for right alignment.
    mathematicalMultiplicationWithVariableDefinitionTemplate.propInternalValue =
`(assert
    (let
        (
            (volume |[namespace]NFAM4|)        ;variable definition: Volume = NFAM4
            (length |[namespace]NFAM1|)
            (depth  |[namespace]NFAM2|)
            (width  |[namespace]NFAM3|)
        )
            (= volume ( * length width depth )) ;formula: Volume=length*width*depth
    )
)`;
    mathematicalMultiplicationWithVariableDefinitionTemplate.propDisplayDescription = mathematicalMultiplicationWithVariableDefinitionTemplate.propInternalValue;

    let ifThenElseTemplate = _getEmptyListModel();
    ifThenElseTemplate.propDisplayValue = 'If Then Else';
    // spacing for below formula is removed on purpose for right alignment.
    ifThenElseTemplate.propInternalValue =
`(assert
    (ite
        (>= |[Teamcenter]Fam| 5)
        (= |[Teamcenter]Box| "Box1")
        (= |[Teamcenter]Box| "Box2")
    ) ;IF Fam >= 5 then Box= Box1, ELSE Box=Box2
)`;

    ifThenElseTemplate.propDisplayDescription = ifThenElseTemplate.propInternalValue;

    let templatesArray = [ emptyTemplate, mathematicalAdditionTemplate, mathematicalMultiplicationWithVariableDefinitionTemplate, ifThenElseTemplate ];
    freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), listOfTemplates : templatesArray } );
};

/** Get the selected object in PWA or header VMO in SWA
 * @param {Object} subPanelContext - Sub Panel Context
 * @param {Object} headerVmo - Header VMO
*/
const _getSelectedObjectInPWA = ( subPanelContext, headerVmo ) => {
    let selectedObjects = [];
    if( headerVmo && _.get( subPanelContext, 'summaryContext.headerVmo' )  ) {
        selectedObjects = subPanelContext.summaryContext.headerVmo;
    } else if( _.get( subPanelContext, 'selection' ) ) {
        selectedObjects = subPanelContext.selection;
    } else {
        selectedObjects = appCtxSvc.getCtx( 'mselected' );
    }
    // Filter out the product items and dictionaries i.e. base selection
    return selectedObjects.filter( selectedObject => selectedObject.type !== pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM &&
        selectedObject.type !== pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY );
};

const _getLocalizedMessage = ( key ) => {
    if( !m_localizedMessages ) {
        m_localizedMessages = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    }
    return m_localizedMessages[ key ];
};

/** Fallback mechanism to read clipboard text in case Clipboard API is not available */
const _fallbackReadClipboard = () => {
    // Create a temporary textarea element
    const textarea = document.createElement( 'textarea' );
    // Append the textarea to the body
    document.body.appendChild( textarea );
    // Make the textarea readonly and move it off-screen
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.setAttribute( 'readonly', '' );

    // Focus the textarea and execute the paste command
    textarea.focus();
    document.execCommand( 'paste' );
    // Read the pasted text from the textarea
    const text = textarea.value;
    // Remove the textarea element from the DOM
    document.body.removeChild( textarea );

    return text;
};

/**
 * Set the editor in start edit mode.
 */
const _setEditorInStartEditMode = () => {
    // The edit button in PWA should not be visible.
    pca0CommonUtils.setVisibilityOfEditCommandInPWA( false /* visibility */ );
    // Set active edit handler context to Free form editor.
    editHandlerService.setActiveEditHandlerContext( veConstants.FREEFORM_CONSTANTS.FREEFORM_EDITOR_CONTEXT );
    const activeEditHandler = editHandlerService.getActiveEditHandler();
    // Free form editor should be in edit mode
    activeEditHandler.startEdit();
};

/**
 * Set the editor in cancel edit mode.
 */
const _setEditorInCancelEditMode = () => {
    // The edit button in PWA should be visible.
    pca0CommonUtils.setVisibilityOfEditCommandInPWA( true /* visibility */ );
    // Free form editor should not be in edit mode
    editHandlerService.cancelEdits();
    // Set Active Edit handler Context to PWA table.
    editHandlerService.setActiveEditHandlerContext( 'TABLE_CONTEXT' );
};

/*
 *   Export APIs section starts
 */
let exports = {};

export const getSaveHandler = () => {
    return m_saveHandler;
};

/**
 * Remove completionProviderHandle from editor instance
 * @param { Object } completionProviderHandle - Represents the instance of the completionProviderHandle registered with tcFormulaLanguage for the monaco editor instance.
 */
export const disposeMonacoInstance = ( completionProviderHandle ) => {
    //It will ensure every time we open formula suggester i.e. monaco editor, only fresh completion provider items are available
    completionProviderHandle && completionProviderHandle.dispose();

    // Reset edit state and handler
    let tableContext = appCtxSvc.getCtx( 'TABLE_CONTEXT' );
    // It means editor was in edit mode and the view has been unmounted.
    // In that case, we need to cancel the edit mode of free form editor and
    // change active edit handler context to PWA table.
    if( tableContext && !tableContext?._editing ) {
        _setEditorInCancelEditMode();
    } else {
        // Set Active Edit handler Context to PWA table.
        editHandlerService.setActiveEditHandlerContext( 'TABLE_CONTEXT' );
    }
    // Remove Edit Handler
    editHandlerService.removeEditHandler( veConstants.FREEFORM_CONSTANTS.FREEFORM_EDITOR_CONTEXT );
};

/**
 * Save the free form expression on constraint
 * @param {Object} subPanelContext - Sub Panel Context
 * @param {Object} commandContext - Command Context
 * @param {Array} availableConstraintTypes - Available Constraint Types for creating new constraint
 * @param {Object} monacoContent - Monaco Content
 * @param {Boolean} isSavedFromLeaveHandler - Flag to indicate if the save is from leave handler
 * @param {Array} constraints - Constraints ( this is optional if you want to save expression on given constraint instead of selection in PWA constraint)
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @param {Object} monacoGlobalConfig - Monaco Global Configuration
 * @returns {Promise} - Promise
 */
export const saveFreeFormExpressionOnConstraint = async( subPanelContext, commandContext, availableConstraintTypes, monacoContent,
    isSavedFromLeaveHandler, constraints, freeFormEditorData, monacoGlobalConfig )=> {
    let policyId = policySvc.register( pca0CommonConstants.CFG0FREEFORMCONSTRAINT_POLICY );
    // Whatever is loaded in header of SWA, should be taken as selected object while saving
    // Because, leaveHandler will be called before the selection is updated in SWA, but after
    // selection is updated in PWA
    let [ pwaSelection ] = constraints ? [ constraints ] : _getSelectedObjectInPWA( subPanelContext, true );

    if( !_.isUndefined( pwaSelection ) ) {
        let content = monacoContent.dbValue;
        let propName = 'cfg0ExpScript';
        dmService.setProperties( [ {
            object: {
                uid: pwaSelection.uid,
                type: 'Cfg0AbsFreeFormRule'
            },
            vecNameVal: [ {
                name: propName,
                values: [ content ]
            } ]
        } ] ).then( ( reponse ) => {
            _setEditorInCancelEditMode();
            if( !isSavedFromLeaveHandler ) {
                freeFormEditorData.setAtomicData( { originalDataInEditor : content, isDirty: false } );
            }
            messagingService.showInfo( _getLocalizedMessage( 'freeFormExpressionSave' ).replace( '{0}', pwaSelection.props.object_string.dbValues[ 0 ] ) );
            if( policyId ) {
                policySvc.unregister( policyId );
            }
        }, ( err ) => {
            pca0CommonUtils.processPartialErrors( err.cause );

            // Set error model markers to show the error in the editor
            const errorMessage = err.message;
            const globalConfig = monacoGlobalConfig.getAtomicData();
            // Regex to extract error message and line number, column number
            // E.g. (error "line 1 column 1: error message")
            const regex = /\(error "line (\d+) column (\d+): ([^"]*)"/g;
            const errorMarkers = [];
            let match;
            // Loop through all error statements
            while ( ( match = regex.exec( errorMessage ) ) !== null ) {
                const lineNumber = parseInt( match[1], 10 );
                const columnNumber = parseInt( match[2], 10 );

                const errorMessagePart = match[3].trim();
                // Create an error marker
                errorMarkers.push( {
                    startLineNumber: lineNumber,
                    startColumn: columnNumber,
                    endLineNumber: lineNumber,
                    endColumn: columnNumber + 1, // Show the error at the start of the column as we don't have error length information
                    message: errorMessagePart,
                    severity: globalConfig.MarkerSeverity.Error
                } );
            }
            globalConfig.editor.setModelMarkers( globalConfig.editor.getModels()[0], 'freeFormRuleErrorMarkers', errorMarkers );
        } );
    } else {
        // Else open the dialog and then save the expression on the newly created constraint
        const { dialogAction } = commandContext;
        let loadedConstraintTypes;
        if( availableConstraintTypes.length === 0 ) {
            let displayNameSubBusinessObjectInput = pcaObjectTypeLOVComponentService.getInputForApplicableTypes( veConstants.CFG_OBJECT_TYPES.ABS_FREEFORM_RULE );
            let inputEnclosedDisplayNameSubBusinessObject = {
                input: displayNameSubBusinessObjectInput
            };
            let displayNameSubBusinessObjectResponse = await soaSvc.post(
                'Core-2010-04-DataManagement',
                'findDisplayableSubBusinessObjectsWithDisplayNames',
                inputEnclosedDisplayNameSubBusinessObject
            );
            loadedConstraintTypes = pcaObjectTypeLOVComponentService.processSoaResponseForBOTypes( displayNameSubBusinessObjectResponse );
        } else {
            loadedConstraintTypes = availableConstraintTypes;
        }
        commandContext = {
            ...commandContext,
            gridEditorMode: 'freeFormRule',
            availableConstraintTypes: availableConstraintTypes,
            variabilityTreeData: null,
            baseSelection: _.get( commandContext, 'context.baseSelection' ) ?
                _.get( commandContext, 'context.baseSelection' ) : _.get( commandContext, 'vmo' )
        };

        const ruleTypes = loadedConstraintTypes.map( a => a.propInternalValue ).join( ',' );
        let options = {
            view: 'Pca0ConstraintsGridEditorAdd',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            parent: '.aw-layout-workarea',
            isCloseVisible: false,
            isPinUnpinEnabled: true,
            subPanelContext: { ...commandContext, ruleTypes, isOpenedFromPWA: false }
        };
        dialogAction.show( options );
    }
};

/**
 * Cancel edit mode of the editor. Revert the changes made in the editor.
 * @param {Object} monacoContent - Monaco Content
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 */
export const cancelFreeFormExpression = ( monacoContent, freeFormEditorData ) => {
    _setEditorInCancelEditMode();
    // TODO: Jinesh - Need to check if executeEdits is sufficient here or updateModelData is required
    uwPropertyService.updateModelData( monacoContent, freeFormEditorData.getAtomicData().originalDataInEditor, [ freeFormEditorData.getAtomicData().originalDataInEditor ], false, true, true, {} );
    freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: false } );
};

/**
 * select all text in the editor
 * @param {Object} monacoEditor - Monaco Editor Instance
 */
export const selectAllFreeFormExpression = ( monacoEditor ) => {
    let monacoEditorAtmData = monacoEditor.getAtomicData();
    let model = monacoEditorAtmData.getModel();
    const fullRange = model.getFullModelRange();
    monacoEditorAtmData.setSelection( fullRange );
    monacoEditorAtmData.focus();
};

/**
 * Handle comment/ uncomment action on the selected lines in the editor
 * @param {Object} monacoEditor - Monaco Editor Instance
 * @param {String} action - Action to be performed on the expression i.e. comment, uncomment
 */
export const freeFormExpressionCommentUncomment = ( monacoEditor, action ) => {
    const editor = monacoEditor.getAtomicData();
    const model = editor.getModel();
    const selection = editor.getSelection();

    const startLineNumber = selection.startLineNumber;
    const endLineNumber = selection.endLineNumber;

    // Create an array to hold the edits
    const edits = [];

    if( action === 'comment' ) {
        Array.from( { length: endLineNumber - startLineNumber + 1 }, ( _, i ) => {
            const lineNumber = startLineNumber + i;
            const lineContent = model.getLineContent( lineNumber );
            const edit = {
                range: new monaco.Range( lineNumber, 1, lineNumber, lineContent.length + 1 ),
                text: `;${ lineContent }`
            };
            edits.push( edit );
        } );
    } else if( action === 'uncomment' ) {
        Array.from( { length: endLineNumber - startLineNumber + 1 }, ( _, i ) => {
            const lineNumber = startLineNumber + i;
            const lineContent = model.getLineContent( lineNumber );
            let newText = lineContent.trim(); // Remove leading and trailing whitespace

            // Check if the line starts with a semicolon and remove it
            if ( newText.startsWith( ';' ) ) {
                newText = newText.substring( 1 ); // Remove the first character (semicolon)
                const edit =  {
                    range: new monaco.Range( lineNumber, 1, lineNumber, lineContent.length + 1 ),
                    text: newText
                };
                edits.push( edit );
            }
        } );
    }
    editor.executeEdits( '', edits );
};

/**
 * Handle Primary Selection Change for Free Form Editor
 * @param {Object} subPanelContext - Sub Panel Context
 * @param {Object} monacoContent - Monaco Content
 * @param {Object} config - Monaco Configuration
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @param {Object} templateBox - Template Box
 * @param {Object} monacoEditor - Monaco Editor Instance
 * @returns {Object} - Monaco Content and Configuration
 */
export const handlePrimarySelectionChangeFreeForm = async( subPanelContext, monacoContent, config, freeFormEditorData, templateBox, monacoEditor ) => {
    let tableCtx = appCtxSvc.getCtx( 'TABLE_CONTEXT' );

    // If PWA table is in edit mode that means, active edit handler context is Free Form Editor.
    // Only in that case, we need to show leave confirmation dialog if editor is dirty.
    if( !tableCtx._editing ) {
        await editHandlerService.leaveConfirmation();
    }
    // reset template box to empty
    uwPropertyService.updateModelData( templateBox, '', [ '' ], false, true, true, {} );

    // Whatever is selected in PWA, should be taken as selected object while loading the editor
    let [ pwaSelection ] = _getSelectedObjectInPWA( subPanelContext, false );

    let freeFormEditorDataAtmData = { ...freeFormEditorData.getAtomicData() };
    let editorConfig = _.defaultsDeep( {}, config );
    let isProductItem = false;
    let isGlobal = false;

    if( !_.isUndefined( pwaSelection ) ) {
        let getPropertiesInput = {
            objects: [ pwaSelection ],
            attributes: [ 'cfg0ExpScript', 'cfg0IsGlobal', 'cfg0ProductItems' ]
        };
        let getPropertiesResponse = await soaSvc.post(
            'Core-2006-03-DataManagement',
            'getProperties',
            getPropertiesInput
        );
        let cfg0ExpScriptProp = getPropertiesResponse.modelObjects[ pwaSelection.uid ].props.cfg0ExpScript;
        let cfg0IsGlobalProp = getPropertiesResponse.modelObjects[ pwaSelection.uid ].props.cfg0IsGlobal;
        isGlobal = cfg0IsGlobalProp.uiValues[0] === 'True';
        const contextInfo  = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        const objectType = pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM;
        const openedObjectType = contextInfo.openedObjectType;
        isProductItem = openedObjectType === objectType;

        if( cfg0ExpScriptProp.dbValues[ 0 ] !== null ) {
            uwPropertyService.updateModelData( monacoContent, cfg0ExpScriptProp.uiValues[ 0 ], cfg0ExpScriptProp.uiValues, false, true, true, {} );
            freeFormEditorDataAtmData.originalDataInEditor = cfg0ExpScriptProp.uiValues[ 0 ];
            freeFormEditorDataAtmData.isDirty = false;
        } else {
            // One space is required else editor becomes non-editable.
            uwPropertyService.updateModelData( monacoContent, ' ', [ ' ' ], false, true, true, {} );
            freeFormEditorDataAtmData.originalDataInEditor = ' ';
            freeFormEditorDataAtmData.isDirty = false;
            monacoEditor.getAtomicData().setPosition( { lineNumber: 1, column: 1 } );
        }

        // Editor is not editable if isGlobal flag is set to true when opened object is of type Cfg0ProductItem
        editorConfig.options.readOnly = isProductItem && isGlobal;
    } else {
        uwPropertyService.updateModelData( monacoContent, ' ', [ ' ' ], false, true, true, {} );
        freeFormEditorDataAtmData.originalDataInEditor = ' ';
        freeFormEditorDataAtmData.isDirty = false;
        monacoEditor.getAtomicData().focus();
        monacoEditor.getAtomicData().setPosition( { lineNumber: 1, column: 1 } );
    }
    monacoEditor.getAtomicData().focus();
    freeFormEditorDataAtmData.currentConstraintLoaded = pwaSelection;
    freeFormEditorData.setAtomicData( freeFormEditorDataAtmData );
    _populateTemplatesForEditor( freeFormEditorData );

    return { monacoContent, editorConfig };
};

/**
 * Perform action on the expression in the editor
 * @param {Object} monacoContent - Monaco Content
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @param {String} action - Action to be performed on the expression i.e. cut, copy, clear
 * @param {Object} monacoEditor - Monaco Editor Instance
 */
export const performActionOnExpression = ( monacoContent, freeFormEditorData, action, monacoEditor ) => {
    let editor = monacoEditor.getAtomicData();
    let currentSelection = editor.getSelection();
    let content = '';
    let currentSelectionToCut;
    // If just the line is selected but text is not selected
    // then content should be the whole line else just the selected text. Similar to how notepad++ works
    if( currentSelection.isEmpty() ) {
        let lineNumber = currentSelection.startLineNumber;
        content = editor.getModel().getLineContent( lineNumber );
        currentSelectionToCut = new monaco.Range( lineNumber, 1, lineNumber, content.length + 1 );
    } else {
        content = editor.getModel().getValueInRange( currentSelection );
        currentSelectionToCut = currentSelection;
    }

    if( [ 'clear' ].includes( action ) ) {
        // Clear the content of the editor
        uwPropertyService.updateModelData( monacoContent, ' ', [ ' ' ], false, true, true, {} );
        freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: true } );
        editor.setPosition( { lineNumber: 1, column: 1 } );
    } else if ( [ 'cut' ].includes( action ) ) {
        pca0CommonUtils.copyContentToOSClipboard( content );
        editor.executeEdits( '', [ {
            range: currentSelectionToCut,
            text: ''
        } ] );
        freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: true } );
        messagingService.showInfo( _getLocalizedMessage( 'cutTextToClipboard' ).replace( '{0}', content ) );
    }
    if( [ 'copy' ].includes( action ) ) {
        pca0CommonUtils.copyContentToOSClipboard( content );
        messagingService.showInfo( _getLocalizedMessage( 'copiedTextToClipboard' ).replace( '{0}', content ) );
    }
};

/**
 * Find the text in the editor
 * @param {Object} monacoEditor - Monaco Editor Instance
 */
export const findFreeFormExpression = ( monacoEditor ) => {
    let editor = monacoEditor.getAtomicData();
    editor.trigger( 'keyboard', 'actions.find' );
};

/**
 * Paste the content from the clipboard to the editor
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @param {Object} monacoEditor - Monaco Editor Instance
 */
export const pasteFreeFormExpression = async( freeFormEditorData, monacoEditor ) => {
    // !!! IMPORTANT !!!
    // With DevTools open, this function will not work as expected as the Focussed element will not be Browser.
    // Hence, close the devtools and try the paste command
    // !!! IMPORTANT !!!
    // This functionality will not work on http sites as clipboard API is not available on http sites.
    // It will work only for HTTPS sites and localhost.
    // Hence, one needs to add the site to the trusted sites in the browser settings Insecure origins treated as secure
    // for production env. For localhost, it will work without any issues.
    // For more details Google the issue or contact Jinesh Nadar.
    let text;
    try {
        // Check if the clipboard API is available
        if ( navigator.clipboard ) {
            // Read the text from the clipboard
            text = await navigator.clipboard.readText();
        } else {
            // fall back mechanism in case any browser doesn't support clipboard API
            console.debug( 'Clipboard API not available' );
            text =  _fallbackReadClipboard();
        }
    } catch ( error ) {
        console.error( 'Failed to read clipboard text: ', error );
        text =  _fallbackReadClipboard();
    }

    if( text ) {
        // Get current location of cursor in editor and then append the text
        let editor = monacoEditor.getAtomicData();

        const position = editor.getPosition();
        const range = new monaco.Range( position.lineNumber, position.column, position.lineNumber, position.column );
        const id = { major: 1, minor: 1 }; // Unique identifier for the operation
        const textToInsert = text;
        const operation = {
            identifier: id,
            range: range,
            text: textToInsert,
            forceMoveMarkers: true
        };
        editor.executeEdits( 'my-source', [ operation ] );
        // Set the editor dirty
        freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: true } );
    }
};

/**
 * Initialize the Free Form Editor
 * @param {Object} declViewModel - Declaration View Model
 * @param {Object} monacoEditorAtmData - Monaco Editor Atomic Data
 * @param {Object} freeFormEditorData - Free Form Editor Atomic Data
 * @param {Object} monacoGlobalConfig - Monaco Global Configuration
 * @returns {Object} - CompletionProviderHandle once intellisense enabled until then undefined
 */
export let initAction = ( declViewModel, monacoEditorAtmData, freeFormEditorData, monacoGlobalConfig ) => {
    let monacoEditor = monacoEditorAtmData.getAtomicData();
    const globalConfig = monacoGlobalConfig.getAtomicData();

    if( !_.isEmpty( monacoEditor ) ) {
        // Initialize Edit Handler for Monaco Editor.
        // This will take care of leave confirmation and other edit handler related functionalities
        _initializeEditHandlerForMonacoEditor( declViewModel );

        // If cursor position is changed, then update the row and column number in the editor
        monacoEditor.onDidChangeCursorPosition( e => {
            const position = e.position;
            if ( position ) {
                let lineNumber = document.getElementById( 'freeForm-row' );
                let columnNumber = document.getElementById( 'freeForm-column' );
                let totalCount = monacoEditor.getModel().getLineCount();
                let totalCountElement = document.getElementById( 'freeForm-total' );
                lineNumber.innerHTML = position.lineNumber + ', ';
                columnNumber.innerHTML = position.column + ', ';
                totalCountElement.innerHTML = totalCount;
            }
        } );
        // If the editor is dirty, then set the editor in edit mode
        monacoEditor.onDidChangeModelContent( e => {
            if( freeFormEditorData.getAtomicData().isDirty === false && freeFormEditorData.getAtomicData().originalDataInEditor !== monacoEditor.getValue() ) {
                // editor in edit mode
                _setEditorInStartEditMode();
                freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: true } );
            }

            // If editor content is changed, and if there are any error markers, then remove them
            if( globalConfig.editor.getModelMarkers( { resource: monacoEditor.getModel().uri } ).length > 0 ) {
                globalConfig.editor.setModelMarkers( globalConfig.editor.getModels()[0], 'freeFormRuleErrorMarkers', [] );
            }
        } );

        /* TODO - Jinesh - Commenting the below code as UX is not aligned for the keyboard shortcuts for the editor
        If UX is aligned we will start the keyboard shortcuts for the editor and uncomment the below code */

        // monacoEditor.addAction({
        //     // An unique identifier of the contributed action.
        //     id: 'comment-line-freeForm',

        //     // A label of the action that will be presented to the user.
        //     label: 'Toggle Comment',

        //     // An optional array of keybindings for the action.
        //     keybindings: [
        //         monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash
        //     ],

        //     // A precondition for this action.
        //     precondition: null,

        //     // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        //     keybindingContext: null,

        //     contextMenuGroupId: 'navigation',

        //     contextMenuOrder: 1.5,

        //     // Method that will be executed when the action is triggered.
        //     run: function( ed ) {
        //         eventBus.publish( 'Pca0FreeFormEditor.commentExpression' ); // event to comment the expression
        //         eventBus.publish( 'Pca0FreeFormEditor.uncommentExpression' ); // event to uncomment the expression
        //     }
        // });

        globalConfig.languages.register( { id: 'smt2' } );

        globalConfig.languages.setLanguageConfiguration( 'smt2', smt2_conf );
        globalConfig.languages.setMonarchTokensProvider( 'smt2', smt2_lang );

        // Define custom theme for the free form rule editor.
        globalConfig.editor.defineTheme( 'freeFormRuleEditorTheme', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editorHoverWidget.background': '#fbeeed' // To have same background colour as AW error popup.
            }
        } );
        globalConfig.editor.setTheme( 'freeFormRuleEditorTheme' );


        // Populate the templates for the editor
        _populateTemplatesForEditor( freeFormEditorData );
    }

    // Once intellisense is enabled, then handler will be returned to dispose it when required
    return undefined;
};

/**
 * Free Form Template Selection. This method is called when user selects a template from the template box.
 * @param {Object} templateBox - Template Box Model
 * @param {Object} monacoContent - Monaco Editor Model
 * @param {Object} freeFormEditorData - Free Form Editor Model
 */
export const freeFormTemplateSelection = ( templateBox, monacoContent, freeFormEditorData ) => {
    let templateText = templateBox.dbValue;
    let monacoEditorText = monacoContent.dbValue;
    if( templateText !== '' ) {
        // Old text present in editor is appended with the selected template text
        let newMonacoText = monacoEditorText + templateText;
        // TODO - Jinesh : Check if there is any issue with editor.executeEdits instead
        // of uwPropertyService.updateModelData. If there is no issue, then we can remove
        // uwPropertyService.updateModelData and use editor.executeEdits
        uwPropertyService.updateModelData( monacoContent, newMonacoText, [ newMonacoText ], false, true, true, {} );
        // Set the editor dirty
        freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), isDirty: true } );
        _setEditorInStartEditMode();
    }
};

/**
 * Post Process Free Form Constraint Created. Once new constraint is created, save the expression from editor on this new constraint.
 * @param {Object} freeFormEditorData - Atomic data of free form editor
 * @param {Object} eventData - Event data
 * @param {Object} subPanelContext - Sub Panel Context
 */
export const postProcessFreeFormConstraintCreated = ( freeFormEditorData, eventData, subPanelContext ) => {
    let freeFormEditorDataAtmData = { ...freeFormEditorData.getAtomicData() };
    // Set the state of new constraint creation to 'creating' so that we can skip handlePrimarySelectionChangeFreeForm
    // and editHandler is handled properly
    freeFormEditorDataAtmData.newConstraintCreatedState = 'creating';
    freeFormEditorDataAtmData.currentConstraintLoaded = eventData.constraints[ 0 ];
    freeFormEditorData.setAtomicData( freeFormEditorDataAtmData );

    // TODO - Jinesh : remove event. We may have to shift to editor.getValue() to get the content
    // and not rely on view model data at all. Need to check if there are issues with such approach.

    // We are not saving from leave handler, so isSavedFromLeaveHandler is false
    // constraint is the newly created constraint and not yet loaded in PWA, hence getting constraint
    // from PWA may go wrong. Hence, send the constraint from here for safe side.
    let [ pwaSelection ] = _getSelectedObjectInPWA( subPanelContext, false );
    if( _.isUndefined( pwaSelection ) ) {
        eventBus.publish( 'Pca0FreeFormEditor.saveExpression', { isSavedFromLeaveHandler: false, constraint : eventData.constraints[ 0 ] } );
    }
};

/**
  * Reset New Constraint Creation State to 'idle'. This is called when new constraint creation is completed.
  * @param {Object} freeFormEditorData - Atomic data of free form editor
*/
export let resetNewConstraintCreationState = ( freeFormEditorData ) => {
    freeFormEditorData.setAtomicData( { ...freeFormEditorData.getAtomicData(), newConstraintCreatedState: 'idle' } );
};

export default exports = {
    getSaveHandler,
    disposeMonacoInstance,
    saveFreeFormExpressionOnConstraint,
    cancelFreeFormExpression,
    selectAllFreeFormExpression,
    freeFormExpressionCommentUncomment,
    findFreeFormExpression,
    handlePrimarySelectionChangeFreeForm,
    performActionOnExpression,
    pasteFreeFormExpression,
    initAction,
    freeFormTemplateSelection,
    postProcessFreeFormConstraintCreated,
    resetNewConstraintCreationState
};
