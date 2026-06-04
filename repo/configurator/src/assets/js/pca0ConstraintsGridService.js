// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ConstraintsGridService
 */
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import ConfiguratorDefaultEditHandler from 'js/pca0DefaultEditHandler';
import dataSourceService from 'js/dataSourceService';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0ConstraintsDisplayService from 'js/pca0ConstraintsDisplayService';
import pca0ExpressionGridService from 'js/pca0ExpressionGridService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0GridHeaderService from 'js/pca0GridHeaderService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import pcaObjectTypeLOVComponentService from 'js/PcaObjectTypeLOVComponentService';
import popupService from 'js/popupService';
import soaSvc from 'soa/kernel/soaService';
import tableSvc from 'js/splmTablePublishedService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

/**
 * Update subject and condition table height
 * When 'useAllVariabilityInGridEditorValue' preference is true
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @param {Boolean} isVerticalMode - Indicates if Vertical Column Header is enabled
 */
let _updateBottomAndTopTableHeight = ( displayMode, isVerticalMode ) => {
    let bottomTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-bottomTreeHeight' );
    let topTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-topTreeHeight' );
    const configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    if( configContext.getUseAllVariabilityInGridEditor && pca0ConstraintsDisplayService.getGridOptionFiltersForConstraintGrid( displayMode ) === 'pca0_show_all' ) {
        // as we have show to all the variability in the subject and condition section
        // give equal spaces to both the table
        // set maxHeight to 50%, so that scroll bar takes the charge once height is more than 50% of the parent container
        // In case of Vertical header, The header takes most of the space on top grid, so give more space to top grid.
        const topTableHeight = isVerticalMode ? '60%' : '50%';
        const bottomTableHeight = isVerticalMode ? '40%' : '50%';
        topTreeTableRowElement[ 0 ].style.maxHeight = topTableHeight;
        topTreeTableRowElement[ 0 ].style.height = topTableHeight;
        bottomTreeTableRowElement[ 0 ].style.maxHeight = bottomTableHeight;
        bottomTreeTableRowElement[ 0 ].style.height = bottomTableHeight;
    } else /* show current features or useAllVariability is toggled off */ {
        // as we have to show only the minimal variability, set the top table and bottom table
        // height to 'auto' i.e. the height of table will be as much is required to show the content
        // However, the height shouldn't exceed a certain limit
        // For top table, the height shouldn't exceed 40%.
        // For bottom table, the height shouldn't exceed 60%.
        // The reason to not get it divided it into equal halves is because
        // we have the functionality to increase the top table height in the settings panel, and
        // user can increase or decrease the height of table as per convenience.
        // In case of Vertical header, The header takes most of the space on top grid, so give more space to top grid.
        const topTableHeight = isVerticalMode ? '60%' : '40%';
        const bottomTableHeight = isVerticalMode ? '40%' : '60%';
        topTreeTableRowElement[ 0 ].style.maxHeight = topTableHeight;
        bottomTreeTableRowElement[ 0 ].style.maxHeight = bottomTableHeight;
        bottomTreeTableRowElement[ 0 ].style.height = 'auto';
        topTreeTableRowElement[ 0 ].style.height = 'auto';
    }
};

/**
 * Returns an array of UIDs for all loaded rules in a constraints grid, based on an array of tree columns.
 * @param {Array} topGridSelectionMap - An array of objects representing the tree columns in the constraints grid.
 * @returns {Array} An array of UIDs for all loaded rules in the constraints grid.
 */
let _getLoadedRulesUidForConstraintsGrid = ( topGridSelectionMap ) => {
    // ignore split UIDs as they are redundant.
    return _.filter( Object.keys( topGridSelectionMap ), ( uid ) => !uid.includes( pca0Constants.SPLIT_COLUMN_DELIMITER ) );
};

/**
 *  Row background renderer
 */
let _rowBackgroundRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );

        if( rowElem ) {
            rowElem.classList.add( 'aw-cfg-headerBackgroundCell' );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isSpecialBackgroundCell;
    },
    name: '_rowBackgroundRenderer'
};

/**
 *  Cell Renderer for Property Columns
 */
let _propertyColumnCellRenderer = {
    action: ( column, vmo, tableElem, rowElement ) => {
        let cell = tableSvc.createElement( column, vmo, tableElem, rowElement );
        cell.classList.add( 'aw-cfg-variantgridCell' );
        cell.classList.add( 'aw-cfg-variantgridTextCell' ); // align text with some margin

        let textValue = vmo.props[ column.name ].uiValue;
        cell.innerText = textValue;

        // Set title: title is allowing for tooltip to appear in case of longer text with ellipsis
        cell.setAttribute( 'title', textValue );

        return cell;
    },
    condition: function( column ) {
        return column.isPropertyColumn;
    },
    name: '_propertyColumnCellRenderer'
};

/**
 * Get the Viewport of the Top tree table
 * @returns {Object} ViewPort DOM instance for Top tree table
 */
let _getTopGridViewport = () => {
    let viewPort = null;
    let topTreeTable = document.getElementById( veConstants.GRID_CONSTANTS.PCA_GRID );
    if( topTreeTable ) {
        viewPort = tableSvc.getTableScrollBar( topTreeTable );
    }
    return viewPort;
};

/**
 * Get the Viewport of the Bottom tree table
 * @returns {Object} ViewPort DOM instance for Bottom tree table
 */
let _getBottomGridViewport = () => {
    let viewPort = null;
    let bottomTreeTable = document.getElementById( veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID );
    if( bottomTreeTable ) {
        viewPort = tableSvc.getTableScrollBar( bottomTreeTable );
    }
    return viewPort;
};

/**
 * Callback function to scroll Horizontally the Top grid
 * based on the scroll position in Bottom grid.
 * @param {object} event object containing the scroll event information
 */
let _scrollFirstTableCallbackFn = ( event ) => {
    let topTableViewPort = _getTopGridViewport();
    if( topTableViewPort ) {
        topTableViewPort.scrollLeft = event.currentTarget.scrollLeft;
    }
};

/**
 * Assign/Update grid data as per settings (initialization or after settings apply):
 * - gridNodes (variability nodes)
 * - VMO map
 * - SelectionMap and backUp map
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 * @param {Object} topGridData data we want to update in topGrid
 * @param {Object} bottomGridData data we want to update bottomGrid
 * @param {Boolean} changeDataInGrids - To update data in grids
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @return {Object} Object with topGrid and bottomGrid
 */
let _updateGridDataAsPerSettings = ( vmGridSettings, topGridData, bottomGridData, changeDataInGrids, displayMode ) => {
    let gridSettingsData = { ...vmGridSettings.getAtomicData() };
    const topBusinessObjectToSelectionMap = topGridData.businessObjectToSelectionMap;
    const topBkpOfBusinessObjectMap = topGridData.backupOfBusinessObjectToSelectionMap;
    const topVariabilityNodes = topGridData.variabilityNodes;
    const topViewModelObjectMap = topGridData.viewModelObjectMap;
    const bottomBusinessObjectToSelectionMap = bottomGridData.businessObjectToSelectionMap;
    const bottomBkpOfBusinessObjectMap = bottomGridData.backupOfBusinessObjectToSelectionMap;
    const bottomVariabilityNodes = bottomGridData.variabilityNodes;
    const bottomViewModelObjectMap = bottomGridData.viewModelObjectMap;

    let topData = {};
    let bottomData = {};
    if( gridSettingsData.showPropsInfoInGrid && gridSettingsData.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
    } else if( gridSettingsData.showPropsInfoInGrid && !gridSettingsData.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
    } else if( !gridSettingsData.showPropsInfoInGrid && gridSettingsData.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
    } else if( !gridSettingsData.showPropsInfoInGrid && !gridSettingsData.showSubjectInTopGrid ) {
        topGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ];
        bottomGridData.gridNodes = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ];
    }

    if( changeDataInGrids ) {
        // Remove 'Properties Information' from top grid before assigning it to bottom
        let filteredTopVariabilityNodes = _.filter( topVariabilityNodes, node => {
            return node.nodeUid === '' ||
                _.get( node, 'props.parentTree[0]' ) &&
                node.props.parentTree[ 0 ] !== veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID;
        } );
        let filteredTopViewModelObjectMap = {};
        _.forEach( filteredTopVariabilityNodes, variabilityNode => {
            filteredTopViewModelObjectMap[ variabilityNode.nodeUid ] = topViewModelObjectMap[ variabilityNode.nodeUid ];
        } );

        topGridData.businessObjectToSelectionMap = _.cloneDeep( bottomBusinessObjectToSelectionMap );
        topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomBkpOfBusinessObjectMap );
        topGridData.variabilityNodes = _.cloneDeep( bottomVariabilityNodes );
        topGridData.viewModelObjectMap = _.cloneDeep( bottomViewModelObjectMap );
        bottomGridData.businessObjectToSelectionMap = _.cloneDeep( topBusinessObjectToSelectionMap );
        bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topBkpOfBusinessObjectMap );
        bottomGridData.variabilityNodes = _.cloneDeep( filteredTopVariabilityNodes );
        bottomGridData.viewModelObjectMap = _.cloneDeep( filteredTopViewModelObjectMap );

        // Add to topGrid 'Properties Information' if needed
        if( gridSettingsData.showPropsInfoInGrid ) {
            topGridData.variabilityNodes = [ ...topGridData.variabilityNodes, ...topGridData.propInfoVariabilityNodes ];
            topGridData.viewModelObjectMap = { ...topGridData.viewModelObjectMap, ...topGridData.propInfoViewModelObjectMap };
        }
    } else {
        topGridData.businessObjectToSelectionMap = _.cloneDeep( topBusinessObjectToSelectionMap );
        topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topBkpOfBusinessObjectMap );
        topGridData.variabilityNodes = _.cloneDeep( topVariabilityNodes );
        topGridData.viewModelObjectMap = _.cloneDeep( topViewModelObjectMap );
        bottomGridData.businessObjectToSelectionMap = _.cloneDeep( bottomBusinessObjectToSelectionMap );
        bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomBkpOfBusinessObjectMap );
        bottomGridData.variabilityNodes = _.cloneDeep( bottomVariabilityNodes );
        bottomGridData.viewModelObjectMap = _.cloneDeep( bottomViewModelObjectMap );
    }

    _updateBottomAndTopTableHeight( displayMode, gridSettingsData.useVerticalColumnHeader );
    topData = { ...topGridData };
    bottomData = { ...bottomGridData };
    return { topData, bottomData };
};

/**
 * Verify if a column contains edits in given selectionMaps
 * @param {String} columnUID UID of the column
 * @param {Object} topGridSelectionMap - selectionMap for top grid
 * @param {Object} bottomGridSelectionMap - selectionMap for bottom grid
 * @returns {Boolean} true if column has edits in input maps
 */
let _isColumnWithEditsInMaps = ( columnUID, topGridSelectionMap, bottomGridSelectionMap ) => {
    return pca0CommonUtils.isColumnWithEdits( columnUID, topGridSelectionMap ) || pca0CommonUtils.isColumnWithEdits( columnUID, bottomGridSelectionMap );
};

/**
 * Checks if all loaded objects are of type 'Cfg0AbsArithmeticConstraint'
 *
 * @param {Array} loadedObjects - The context array containing elements loaded in the grid editor.
 * @returns {boolean} - Returns `true` if all elements are of type 'Cfg0AbsArithmeticConstraint', otherwise `false`.
 */
const _areAllArithmeticRulesLoaded = ( loadedObjects ) => {
    return _.every( loadedObjects, element => element.modelType?.parentTypeName === 'Cfg0AbsArithmeticConstraint' );
};

/**
 * Filters out arithmetic constraints from the provided filtered rules.
 *
 * @param {Array} filteredRules - The array of rule UIDs to be filtered.
 * @param {Array} loadedObjects - The context array containing elements loaded in the grid editor.
 * @param {Object} arithmeticRuleValidationProps - The data object containing validation flags for Arithmetic Constraint.
 * @returns {Array} - The filtered array of rule UIDs, excluding arithmetic constraints if applicable.
 */
let _filterArithmeticConstraints = ( filteredRules, loadedObjects, arithmeticRuleValidationProps ) => {
    // Extract UIDs of arithmetic constraints from subPanelContext
    const arithmeticConstraintUids = loadedObjects
        .filter( element => element.modelType.parentTypeName === 'Cfg0AbsArithmeticConstraint' )
        .map( element => element.uid );

    // Check if there are any arithmetic constraints
    const hasArithmeticConstraints = arithmeticConstraintUids.length > 0;

    // If there are arithmetic constraints and they are not all in the grid editor
    if( hasArithmeticConstraints && !arithmeticRuleValidationProps.allArithmeticRulesLoaded ) {
        arithmeticRuleValidationProps.isAtLeastOneArithmeticRuleLoaded = true;

        // Filter out the rules that are arithmetic constraints
        return filteredRules.filter( rule => !arithmeticConstraintUids.includes( rule ) );
    }
    arithmeticRuleValidationProps.isAtLeastOneArithmeticRuleLoaded = false;

    // Return the original filteredRules if no conditions are met
    return filteredRules;
};

/**
 * Validate non-empty split column (beside copied-over selections)
 *
 * @param {String} splitColumnUID UID of the split column
 * @param {String} isSplitSubject true if split column is Subject Split
 * @param {Boolean} showSubjectInTopGrid true if Subject section is displayed in Top Grid
 * @param {Object} topGridSelectionMap selection Map for Top Grid
 * @param {Object} bottomGridSelectionMap selection Map for Bottom Grid
 * @returns {Boolean} true if split Column contains edits
 */
let _isNotEmptySplitColumn = ( splitColumnUID, isSplitSubject, showSubjectInTopGrid, topGridSelectionMap, bottomGridSelectionMap ) => {
    if( // Top Grid is the editable section
        ( showSubjectInTopGrid && isSplitSubject || !showSubjectInTopGrid && !isSplitSubject ) &&
        pca0CommonUtils.isColumnWithEdits( splitColumnUID, topGridSelectionMap ) ||
        // Bottom Grid is the editable section
        ( showSubjectInTopGrid && !isSplitSubject || !showSubjectInTopGrid && isSplitSubject ) &&
        pca0CommonUtils.isColumnWithEdits( splitColumnUID, bottomGridSelectionMap ) ) {
        return true; // edit was found in top/bottom grid: constraint must stay
    }
    return false;
};

/**
 * Extract variability nodes and viewModelObjectMap for the given subset from SOA response
 * @param {String} parentTree string ID for parentTree sub branch
 * @param {Object} variabilityNodes variabilityNodes fom SOA response
 * @param {Object} viewModelObjectMap VMO map from SOA response
 * @param {Boolean} skipRootNode true if rootNode must be skipped
 * @returns {Object} variability Nodes and viewModelObject map collections
 */
let _extractSubSetMaps = ( parentTree, variabilityNodes, viewModelObjectMap, skipRootNode ) => {
    let filteredVariabilityNodes = _.filter( variabilityNodes, node => {
        return !skipRootNode && node.nodeUid === '' ||
            _.get( node, 'props.parentTree[0]' ) &&
            node.props.parentTree[ 0 ] === parentTree;
    } );
    let filteredViewModelObjectMap = {};
    _.forEach( filteredVariabilityNodes, variabilityNode => {
        filteredViewModelObjectMap[ variabilityNode.nodeUid ] = viewModelObjectMap[ variabilityNode.nodeUid ];
    } );
    return { filteredVariabilityNodes, filteredViewModelObjectMap };
};

/**
 * Verify if selections can be applied/enforced - do not proceed for non editable section on Split Column
 * @param {Object} columnProps Properties Info container for the given column in grid
 * @param {Object} splitColumnsMap map of split columns
 * @param {String} treeDataProviderName internal name for Tree DataProvider
 * @param {Boolean} showSubjectInTopGrid true if Subject section is displayed in Top Grid
 * @returns {Boolean} true if selections can be applied/enforced on given column
 */
let _canApplySelectionsOnColumn = ( columnProps, splitColumnsMap, treeDataProviderName, showSubjectInTopGrid ) => {
    if( !columnProps.isSplitColumn ) {
        return true; // no limitations for regular columns
    }

    let originalColumnName = columnProps.originalColumnName;
    let splitColumnIndex = _.findIndex( splitColumnsMap[ originalColumnName ], { uid: columnProps.propertyUid } );
    let splitColumnDef = splitColumnsMap[ originalColumnName ][ splitColumnIndex ];
    if( splitColumnDef.isSplitSubject ) {
        if( showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ||
            !showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.PCA_GRID_DP ) {
            return false;
        }
    } else {
        if( showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.PCA_GRID_DP ||
            !showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ) {
            return false;
        }
    }
    return true;
};

/**
 * Get list of loaded objects given array of AwColumnInfo
 * @param {Array} columns Array of columns present in dataprovider
 * @returns {Array} list of loaded objects
 */
let _getLoadedObjectsForConstraintGrid = ( columns ) => {
    let selectedObjects = [];
    columns.forEach( column => {
        if( !column.isSplitColumn ) {
            // For newly added constraints, sourceType is undefined and it is present at props.object_type.parentAbstractClass
            if( !_.isUndefined( column.sourceType ) ) {
                selectedObjects.push( {
                    uid: column.uid,
                    type: column.sourceType
                } );
            } else if( _.get( column, 'props.object_type.parentAbstractClass' ) ) {
                selectedObjects.push( {
                    uid: column.uid,
                    type: column.props.object_type.parentAbstractClass
                } );
            }
        }
    } );
    return selectedObjects;
};

/**
 * Get List of Split Column given column UID
 * List is empty if split columns are editable for given sub grid
 * @param {Object} columnProps Properties Info container for the given column in grid
 * @param {Object} splitColumnsMap map of split columns
 * @param {String} treeDataProviderName internal name for Tree DataProvider
 * @param {Boolean} showSubjectInTopGrid true if Subject section is displayed in Top Grid
 * @returns {Array} list of editable split columns
 */
let _getSplitColumnsToApplySelections = ( columnProps, splitColumnsMap, treeDataProviderName, showSubjectInTopGrid ) => {
    if( columnProps.isSplitColumn ) {
        return []; // no nested splits (split column cannot have any splits)
    }
    // For Subject split, we can only enforce selection on Condition section
    if( columnProps.hasSplitSubject ) {
        if( showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.PCA_GRID_DP ||
            !showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ) {
            return [];
        }
    } else {
        // For Condition split, we can only enforce selection on Subject section
        if( showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ||
            !showSubjectInTopGrid && treeDataProviderName === veConstants.GRID_CONSTANTS.PCA_GRID_DP ) {
            return [];
        }
    }

    // This is the case when we are applying (clear/paste) selections on new constraints (not contained in splitColumnsMap)
    if( _.isUndefined( splitColumnsMap[ columnProps.propertyUid ] ) ) {
        return [];
    }
    return splitColumnsMap[ columnProps.propertyUid ];
};

/**
 * Grid Save Handler
 * NOTE: this must be an internal variable as it is accessed by external services to get correct saveHandler instance
 */
let m_saveHandler;

/**
 * Callback for handling 'isDirty'
 * Validate if unsaved edits are present in the model
 * @param {Object} declViewModel ViewModel
 * @returns {Boolean} true if model is dirty, i.e. unsaved edits are detected
 */
const _isDirtyCallback = declViewModel => {
    let atomicDataRef = declViewModel.atomicDataRef;
    let variabilityProps = { ...atomicDataRef.variabilityProps.getAtomicData() };
    //If SWA is in edit mode and new constraint is being created, then return false
    if( variabilityProps.newConstraintCreationState === 'creating' ) {
        return false;
    }

    let topGridData = { ...atomicDataRef.topGrid.getAtomicData() };
    let bottomGridData = { ...atomicDataRef.bottomGrid.getAtomicData() };

    return !_.isEqual( topGridData.businessObjectToSelectionMap, topGridData.backupOfBusinessObjectToSelectionMap ) ||
        !_.isEqual( bottomGridData.businessObjectToSelectionMap, bottomGridData.backupOfBusinessObjectToSelectionMap );
};

/**
 * Callback for handling 'cancelEdits'
 * @param {Object} declViewModel ViewModel
 */
const _cancelEditsCallback = ( declViewModel ) => {
    let atomicDataRef = declViewModel.atomicDataRef;
    let variabilityProps = { ...atomicDataRef.variabilityProps.getAtomicData() };

    if( variabilityProps.newConstraintCreationState !== 'creating' ) {
        declViewModel.data.constraintsEditHandler.dataSource.resetEditiableStates();
        appCtxService.updateCtx( 'editInProgress', false );
        let context = {
            dataSource: declViewModel.data.constraintsEditHandler.getDataSource().getSourceObject(),
            state: 'canceling'
        };
        context.dataSource.editContext = veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT;
        eventBus.publish( 'editHandlerStateChange', context );
        let editHandler = declViewModel.data.constraintsEditHandler;
        editHandler.notifySaveStateChanged( 'canceling', true );
    }
};

/**
 * Callback for handling 'startEdit'
 * We do NOT call loadViewModelForEditing2 SOA to fetch cell editability
 * @param {Object} declViewModel ViewModel
 * @param {Object} editOptions - optional parameter collecting info about VMOs and editing props
 * @returns {Promise} fulfilled promise
 */
const _startEditCallback = ( declViewModel, editOptions ) => {
    // If editOptions is defined, startEdit has been called from single/double click to fetch and cache editability
    // If undefined, it's full (bulk) edit mode started by the user
    let editHandler = declViewModel.data.constraintsEditHandler;
    if( _.isUndefined( editOptions ) ) {
        editHandler._editing = true;
        editHandler.notifySaveStateChanged( 'starting', true );
    } else if( !_.isNil( editOptions.vmos ) && !_.isNil( editOptions.vmos ) ) {
        editOptions.vmos.forEach( vmo => {
            // Cell editability doesn't depend on the column
            let isVmoEditable = pca0GridCommonUtils.isCellEditable( vmo );
            editOptions.propertyNames.forEach( propName => {
                if( vmo.props.hasOwnProperty( propName ) ) {
                    const prop = vmo.props[ propName ];
                    prop.isPropertyModifiable = isVmoEditable;
                    uwPropertyService.setEditable( prop, isVmoEditable );
                    uwPropertyService.setEditState( prop, isVmoEditable, true );
                }
            } );
        } );
        editHandler.addSaveListener( editOptions );
    }
    return Promise.resolve( true );
};

/**
 * Internal flags to keep track of action completion
 * This is needed when we need to trigger post actions
 * making sure action was performed in both grids
 */
let _topGridActionComplete = false;
let _bottomGridActionComplete = false;

/**
 * Reset VM flags to track is Action has completed in both grids
 * @returns {Boolean} false value to set VM property isActionCompleteInAllGrids
 */
let _resetActionCompletenessFlags = () => {
    _topGridActionComplete = false;
    _bottomGridActionComplete = false;
    return false; // isColumnActionComplete
};

/**
 * Get JSON string of processed/filters selectedExpressions to be saved
 * this will Populate 'selectedExpressions' SOA Input required for SetVariantExpressionData SOA.
 * 1 - process/filter selectionMap [preProcessConstraintsExpressionsForSaveAction]
 * 2 - Convert to PCA Grid format [getPCAGridWithMultiGridFromSelectionMap called by preProcessConstraintsExpressionsForSaveAction]
 * 3 - Convert selected expression JSON object to selected expression json string array
 * for ex.
 * {
 *  objectUid1:  [ ConfigExprSet: [] ],
 *  objectUid2: [ ConfigExprSet: [] ],
 *  objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 * [
 *  { objectUid1: [ ConfigExprSet: [] ] },
 *  { objectUid2: [ ConfigExprSet: [] ] },
 *  { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} variabilityData - Variability Data
 * @param {String} gridEditorMode - active grid Editor mode
 * @returns {Array} Array of JSON string of selected expressions.
 */
let _getSelectedExpressionsToSave = ( variabilityData, gridEditorMode ) => {
    let constraintsExpressions = exports.preProcessConstraintsExpressionsForSaveAction( variabilityData, gridEditorMode );
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( constraintsExpressions );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Initialize required details for Constraints Grid Editor
 * @param {Object} declViewModel - VM Object
 * @param {String} gridEditorMode - active grid Editor mode
 */
export let initConstraintsGridEditor = ( declViewModel, gridEditorMode ) => {
    // Setup context
    let configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );

    // Setup Grid Editor Mode
    let isSnOMatrixGridEditor = declViewModel.subPanelContext.gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;

    // Set autoEdit mode for Constraints Grid
    configContext.autoEditMode = true;

    // Update Context
    appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );

    // Initialize Save Handler
    m_saveHandler = {
        isDirty: declViewModel => _isDirtyCallback( declViewModel ),
        saveEdits: () => exports.saveEditsCallback( declViewModel.atomicDataRef, gridEditorMode ),
        cancelEdits: () => _cancelEditsCallback( declViewModel )
    };

    /**
     * Initialize Edit handler
     * - for SnO matrix, use Bottom DataProvider.
     * ----- This is to allow Editing ViewModels (e.g. LOV dropdown) to appear when editing cells on bottom grid
     * - for Grid Editor, use Declarative View Model
     */
    let dataSource = {};
    if( isSnOMatrixGridEditor ) {
        dataSource.dataProvider = declViewModel.dataProviders.bottomGridTreeDataProvider;
    } else {
        dataSource.declViewModel = declViewModel;
    }
    let createdDataSource = dataSourceService.createNewDataSource( dataSource );
    let editContextKey = veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT;
    declViewModel.data.constraintsEditHandler =
        new ConfiguratorDefaultEditHandler(
            veConstants.CONFIG_CONTEXT_KEY, // contextKey
            editContextKey, // editContext
            createdDataSource, // dataSource
            [ 's_uid', 'd_uids' ], // editSupportParams
            _isDirtyCallback, // isDirtyFn
            saveEditsCallback, // saveEditsFn
            _cancelEditsCallback, // cancelEditsFn
            _startEditCallback, // startEditFn
            declViewModel,
            pca0CommonUtils.getLocaleTextBundle( 'ConfiguratorCommonMessages' ).unsavedEditsWarningMessage,
            gridEditorMode // grid Editor mode
        );

    // Initialize Edit Handler: add entry to the cfx map of edit handlers
    editHandlerService.setEditHandler( declViewModel.data.constraintsEditHandler, veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );

    // Set edit handler as the active one (or subscribe to canceling events)
    const activeEditHandler = editHandlerService.getActiveEditHandler();
    if( _.isNull( activeEditHandler ) || !activeEditHandler._editing ) {
        editHandlerService.setActiveEditHandlerContext( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );
    } else {
        eventBus.subscribe( 'editHandlerStateChange', eventData => {
            const key = _.get( eventData, 'dataSource.editContext' );
            if( eventData.state === 'canceling' && key !== veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT ) {
                editHandlerService.setActiveEditHandlerContext( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );
            }
        } );
    }

    // Initialize Context with usage of complete variability flag
    configuratorUtils.initializeUseOfAllVariabilityForContext( veConstants.CONFIG_CONTEXT_KEY, isSnOMatrixGridEditor );
};

/**
 * Callback for handling 'saveEdits'
 * This API is called both from 'Save Edits' command from toolbar and on leaveConfirmation prompt (Save option)
 * SOA call is made to save selected expressions and taking care of post save actions
 *
 * @param {Object} variabilityData - View Model Atomic Data
 * @param {String} gridEditorMode - active grid Editor mode
 */
export const saveEditsCallback = async( variabilityData, gridEditorMode ) => {
    let expressionsToSave = _getSelectedExpressionsToSave( variabilityData, gridEditorMode );

    const soaInput = {
        input: {
            selectedExpressions: expressionsToSave,
            requestInfo: {
                requestType: []
            }
        }
    };
    const response = await soaSvc.postUnchecked(
        'Internal-ProductConfiguratorAw-2022-12-ConfiguratorManagement',
        'setVariantExpressionData3', soaInput );

    if( response.ServiceData.partialErrors ) {
        // Process partial errors
        pca0CommonUtils.processPartialErrors( response.ServiceData );
    }
    eventBus.publish( 'Pca0ConstraintsGridEditor.postProcessSaveEdits', { ServiceData: response.ServiceData } );
};

/**
 * Initialize Grid data - reset all data
 * @param {Object} topGridDataProp - View Model Atomic Data <topGrid>
 * @param {Object} bottomGridDataProp - View Model Atomic Data <bottomGrid>
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 */
export let initGridData = ( topGridDataProp, bottomGridDataProp, vmGridSettings ) => {
    let topGridData = { ...topGridDataProp.getAtomicData() };
    topGridData.gridNodes = [];
    topGridData.businessObjectToSelectionMap = {};
    topGridData.backupOfBusinessObjectToSelectionMap = {};
    topGridData.viewModelObjectMap = {};
    topGridData.variabilityNodes = [];
    topGridDataProp.setAtomicData( topGridData );

    let bottomGridData = { ...bottomGridDataProp.getAtomicData() };
    bottomGridData.gridNodes = [];
    bottomGridData.businessObjectToSelectionMap = {};
    bottomGridData.backupOfBusinessObjectToSelectionMap = {};
    bottomGridData.viewModelObjectMap = {};
    bottomGridData.variabilityNodes = [];
    bottomGridData.expandAll = true;
    bottomGridDataProp.setAtomicData( bottomGridData );

    // Set TopTableHeight:
    // When selection changes in PWA, we want to reset topHeaderHeight property
    let gridSettings = { ...vmGridSettings.getAtomicData() };
    if( gridSettings.topTableHeight !== veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.TOP_TABLE_HEIGHT ) {
        gridSettings.topTableHeight = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.TOP_TABLE_HEIGHT;
        vmGridSettings.setAtomicData( gridSettings );
    }
};

/**
 * Register a scroll event listener
 * When scroll action is performed on Bottom grid,
 * then scroll the Top grid based on the scroll position.
 */
export let registerScrollSync = () => {
    let bottomTableViewPort = _getBottomGridViewport();
    if( bottomTableViewPort ) {
        bottomTableViewPort.addEventListener( 'scroll', _scrollFirstTableCallbackFn );
    }
};

/**
 * Unregister hooks or events on unMount
 * @param {Object} editHandler - instance of constraints edit handler
 */
export let gridUnmount = function( editHandler ) {
    let configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let bottomTableViewPort = _getBottomGridViewport();
    if( configContext ) {
        delete configContext[ veConstants.CONSTRAINTS_CONTEXT_KEY ];
        appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configContext );
    }

    // Remove the scroll event listener
    if( bottomTableViewPort ) {
        bottomTableViewPort.removeEventListener( 'scroll', _scrollFirstTableCallbackFn );
        bottomTableViewPort = null;
    }

    //Close dialog if open
    popupService.hide();

    // Reset edit state and handler
    editHandler.cancelEdits();
    pca0CommonUtils.resetEditModeStatus();

    // Remove Edit Handler
    editHandlerService.removeEditHandler( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );
};

/**
 * Util to build SOA input to fetch constraints expression
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @param {Boolean} isUidToBeLoadedFromTree if Uid to be loaded from tree then true else false
 * @param {Object} treeDataProvider - Data provider for Constraints Grid Editor
 * @returns {Object} Required for getVariantExpressionData4
 */
export let prepareSOAInputToGetConstraints = function( gridEditorMode, displayMode, isUidToBeLoadedFromTree, treeDataProvider ) {
    const source = appCtxService.getCtx( 'state.processed.uid' );
    const configContext = { uid: source, type: 'unknownType' };
    let loadedObjects = [];
    if( isUidToBeLoadedFromTree ) {
        loadedObjects = _getLoadedObjectsForConstraintGrid( treeDataProvider.cols );
    } else {
        loadedObjects = pca0ConstraintsDisplayService.getSelectedObjectsForConstraintsGrid();
    }

    let soaRequestInfo = {};
    let shouldUseAllVariabilityInGridEditor = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).getUseAllVariabilityInGridEditor;

    // Handle special parameters when authoring Matrix Rules
    if( gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE ) {
        // This parameter is needed to call all Matrix-related code
        soaRequestInfo.showMatrixGrid = [ 'True' ];

        // Request Feature disposition LOVs if not cached already
        let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        if( _.isUndefined( configuratorCtx.featureDispositionsLov ) ) {
            /* This property 'getCfg0MatrixLOVs' will give us
            1. MatrixDelimiterLOVs
            2. FeatureDispositionLOVs
            from server */
            soaRequestInfo.getCfg0MatrixLOVs = [ 'True' ];
        }
    }

    if( loadedObjects.length === 0 && !shouldUseAllVariabilityInGridEditor ) {
        soaRequestInfo.showEmptyConstraintsGrid = [ 'True' ];
    }

    return {
        configContextProvider: '',
        configContext: configContext,
        // configurator context has config perspective: use it for constraints grid
        configPerspective: pca0CommonUtils.getConfigPerspective( veConstants.CONFIG_CONTEXT_KEY ),
        selectedObjects: loadedObjects,
        currentExpandedFamilies: '',
        filters: {
            intentFilters: [],
            optionFilter: pca0ConstraintsDisplayService.getGridOptionFiltersForConstraintGrid( displayMode )
        },
        requestInfo: soaRequestInfo
    };
};

/**
 * Handle 'Expand All'/'Collapse All' action
 * - Set 'expandAll' and dispatch atomic data changes
 * No need to fire special events as we are updating atomicData.
 * @param {Object} eventData - subject/condition
 * @param {Object} vmGridSettingsData - View Model Atomic Data <gridSettings>
 * @param {Object} topGridData - View Model Atomic Data <topGrid>
 * @param {Object} bottomGridData - View Model Atomic Data <bottomGrid>
 */
export let handleExpandCollapseAllActionForConstraints = ( eventData, vmGridSettingsData, topGridData, bottomGridData ) => {
    /* Important note about atomic data:
        If a field of atomic data is already set to some value 'X', and
        if we again set that field to same value 'X', and call setAtomicData API,
        the observer action for that atomic data field will NOT be called.
        In our case, if expandAll field is set to true initially, and then
        we set expandAll to true again and call setAtomicData, observer action will not be called.
       Explanation of when this case may occur:
        If I invoke Expand All command in subject, the value of expandAll will be set to true
        Later, If I collapse any of family in subject section, the value of expandAll will still be true
        Later, If I again I invoke Expand All command in subject, the value of expandAll will be set to true
        which was already true. Hence, in this case observer action for expandAll will not get triggered.
       Hence, it is necessary to trigger event in this case which does the same action as what would be done
       if expandAll is set to true/false afresh.
    */
    let gridSettingsData = { ...vmGridSettingsData.getAtomicData() };
    if( eventData.grid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_SECTION && gridSettingsData.showSubjectInTopGrid ||
        eventData.grid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_SECTION && !gridSettingsData.showSubjectInTopGrid ) {
        let topData = { ...topGridData.getAtomicData() };
        // If action is expand, but expandAll is already true, then trigger the event, else if
        // expandAll is false, then just setAtomicData-- observer action will take care in this case
        if( topData.expandAll === ( eventData.actionType === veConstants.GRID_CONSTANTS.ACTION_EXPAND ) ) {
            eventBus.publish( 'pca0Grid.plTable.reload' );
        } else {
            topData.expandAll = eventData.actionType === veConstants.GRID_CONSTANTS.ACTION_EXPAND;
            topGridData.setAtomicData( topData );
        }
    } else if( eventData.grid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_SECTION && !gridSettingsData.showSubjectInTopGrid ||
        eventData.grid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_SECTION && gridSettingsData.showSubjectInTopGrid ) {
        let bottomData = { ...bottomGridData.getAtomicData() };
        // If action is expand, but expandAll is already true, then trigger the event, else if
        // expandAll is false, then just setAtomicData-- observer action will take care in this case
        if( bottomData.expandAll === ( eventData.actionType === veConstants.GRID_CONSTANTS.ACTION_EXPAND ) ) {
            eventBus.publish( 'bottomConstraintsGrid.plTable.reload' );
        } else {
            bottomData.expandAll = eventData.actionType === veConstants.GRID_CONSTANTS.ACTION_EXPAND;
            bottomGridData.setAtomicData( bottomData );
        }
    }
};

/**
 * Post-process Apply Settings
 * - handle changes after toggle action to show/hide 'Properties Information' icons/tooltips
 * - handle changes after toggle action to show Subject section in top/bottom grid
 * @param {Object} vmData - ViewModel data Object
 * @param {Boolean} changeDataInGrids - True when data need to be switched between subject and bottom grids
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 */
export let postProcessSettingsChanged = ( vmData, changeDataInGrids, displayMode ) => {
    let topGridData = { ...vmData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmData.bottomGrid.getAtomicData() };
    let { topData, bottomData } = _updateGridDataAsPerSettings( vmData.gridSettings, topGridData, bottomGridData, changeDataInGrids, displayMode );
    vmData.topGrid.setAtomicData( topData );
    vmData.bottomGrid.setAtomicData( bottomData );

    // Clean Cache of Copied Selections
    let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    delete configuratorCtx.copiedSelectionsCache;
    appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
};

/**
 * Post-process SOA response:
 *  - initialize atomic Data for top/bottom grids in Constraint Grid Editor
 *  - Build variabilityData subsets for Subject/Condition/PropertiesInformation
 *  - parse and refactor selectedExpressions (overwriting soaResponse itself)
 *  - build column Configuration Array and map of split columns
 *  - build selection maps for Subject and Condition sections
 * @param {Object} soaResponse response from SOA
 * @param {Object} vmData all Atomic Data defined for the ViewModel
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @param {Boolean} isUidToBeLoadedFromTree if Uid to be loaded from tree then true else false
 * @param {Object} treeDataProvider - Data provider for Constraints Grid Editor
 * @param {Object} arithmeticRuleValidationProps - properties for arithmetic rule validation
 * @return {Boolean} flag for successful initialization
 */
export let processConstraintsData = function( soaResponse, vmData, displayMode, isUidToBeLoadedFromTree, treeDataProvider, arithmeticRuleValidationProps ) {
    if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
        pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
        return false;
    }

    // Clean Cache of Copied Selections
    let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    delete configuratorCtx.copiedSelectionsCache;

    // Update Context
    appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );

    // Reset Edit Mode status
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );

    let variability = { ...vmData.variabilityProps.getAtomicData() };

    // Convert Selected Expressions
    let selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
    let clonedExpressions = { ...selectedExpressions };
    const gridSettingsData = { ...vmData.gridSettings.getAtomicData() };
    let topGridData = { ...vmData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmData.bottomGrid.getAtomicData() };
    let loadedObjects = [];
    if( isUidToBeLoadedFromTree ) {
        loadedObjects = _getLoadedObjectsForConstraintGrid( treeDataProvider.cols );
        loadedObjects = loadedObjects.map( element => cdm.getObject( element.uid ) );
    } else {
        loadedObjects = pca0ConstraintsDisplayService.getSelectedObjectsForConstraintsGrid();
    }
    soaResponse.variabilityPropertiesToDisplay = [];

    // If the loaded object is of type 'Cfg0ArithmeticConstraint', then we should not enable the 'validateAll' command
    arithmeticRuleValidationProps.allArithmeticRulesLoaded = _areAllArithmeticRulesLoaded( loadedObjects );

    // [LCS-1020457] NOTE of misalignment:
    // If user quickly selects items one by one in PWA,
    // Our logic might not have the time to fully initiate a SOA call and process its response.
    // This is a risk of misalignment between:
    // - loadedObjects: list of objects selected in UI (PWA) and
    // - keys from soaResponse
    // This can cause soaResponse.selectedExpressions to have keys with 'undefined' content if we do not filter what's coming from SOA.
    // This is a risk of crash when processing nonGridableExpressions
    // Fix: add keys to soaResponse.selectedExpressions only if included in soaResponse
    // NOTE: eventually the final SOA response is processed without further overlapping
    // and data is displayed correctly
    soaResponse.selectedExpressions = {};
    loadedObjects.forEach( loadedObject => {
        if( !_.isUndefined( clonedExpressions[ loadedObject.uid ] ) ) {
            soaResponse.selectedExpressions[ loadedObject.uid ] = clonedExpressions[ loadedObject.uid ];
        }
    } );

    const nonGridableExpressionsList = pca0CommonUtils.getNonGridableExpressionList( soaResponse.selectedExpressions );

    if( !_.isEmpty( nonGridableExpressionsList ) ) {
        pca0CommonUtils.showNotificationMessageForNonGridableExpressionsIfApplicable( nonGridableExpressionsList, soaResponse.viewModelObjectMap );
    }
    // Populate businessObjectToSelectionMap and get Column Properties
    let columnPropsAndSelectionMapResult = pca0VariabilityTreeDisplayService.getColumnPropsAndSelectionMap(
        pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID,
        soaResponse
    );
    let columnProperties = columnPropsAndSelectionMapResult.columnProperties;
    let subjectSelectionMap = columnPropsAndSelectionMapResult.subjectSelectionMap;
    let conditionSelectionMap = columnPropsAndSelectionMapResult.conditionSelectionMap;

    // Save map of Split Columns
    let splitColumnsMap = columnPropsAndSelectionMapResult.columnSplitIDsMap;

    // Updating the isVertical flag for columnProperties
    columnProperties.forEach( columnProps => {
        columnProps.isVertical = gridSettingsData.useVerticalColumnHeader;
    } );

    const variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    const viewModelObjectMap = soaResponse.viewModelObjectMap;

    // Build subsets variabilityNodes/viewModelObjectMap for 'Properties Information' section
    let propInfoResults = _extractSubSetMaps( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, variabilityNodes, viewModelObjectMap, true );
    let propInfoVariabilityNodes = propInfoResults.filteredVariabilityNodes;
    let propInfoViewModelObjectMap = propInfoResults.filteredViewModelObjectMap;
    topGridData.propInfoVariabilityNodes = propInfoVariabilityNodes;
    topGridData.propInfoViewModelObjectMap = propInfoViewModelObjectMap;

    // Reset TopTable height setting
    // This is necessary after refresh to reflect actual table height, which is given 'auto' value
    gridSettingsData.topTableHeight = veConstants.GRID_CONSTANTS.DEFAULT_SETTINGS.TOP_TABLE_HEIGHT;
    vmData.gridSettings.setAtomicData( gridSettingsData );

    let { topData, bottomData } = _updateGridDataAsPerSettings( vmData.gridSettings, topGridData, bottomGridData, conditionSelectionMap, displayMode );

    // Build subsets variabilityNodes/viewModelObjectMap for subject/condition sections
    let subjectResults = _extractSubSetMaps( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID, variabilityNodes, viewModelObjectMap );
    let subjectVariabilityNodes = subjectResults.filteredVariabilityNodes;
    let subjectViewModelObjectMap = subjectResults.filteredViewModelObjectMap;
    let conditionResults = _extractSubSetMaps( veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID, variabilityNodes, viewModelObjectMap );
    let conditionVariabilityNodes = conditionResults.filteredVariabilityNodes;
    let conditionViewModelObjectMap = conditionResults.filteredViewModelObjectMap;

    if( gridSettingsData.showSubjectInTopGrid ) {
        topData.businessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        topData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        bottomData.businessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        bottomData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );

        topData.variabilityNodes = _.cloneDeep( subjectVariabilityNodes );
        topData.viewModelObjectMap = _.cloneDeep( subjectViewModelObjectMap );
        bottomData.variabilityNodes = _.cloneDeep( conditionVariabilityNodes );
        bottomData.viewModelObjectMap = _.cloneDeep( conditionViewModelObjectMap );
    } else {
        topData.businessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        topData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( conditionSelectionMap );
        bottomData.businessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );
        bottomData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( subjectSelectionMap );

        topData.variabilityNodes = _.cloneDeep( conditionVariabilityNodes );
        topData.viewModelObjectMap = _.cloneDeep( conditionViewModelObjectMap );
        bottomData.variabilityNodes = _.cloneDeep( subjectVariabilityNodes );
        bottomData.viewModelObjectMap = _.cloneDeep( subjectViewModelObjectMap );
    }

    // Add to topGrid 'Properties Information' if needed
    if( gridSettingsData.showPropsInfoInGrid ) {
        topData.variabilityNodes = [ ...topData.variabilityNodes, ...topData.propInfoVariabilityNodes ];
        topData.viewModelObjectMap = { ...topData.viewModelObjectMap, ...topData.propInfoViewModelObjectMap };
    }

    // Add custom properties to column definitions:
    // 1) columnWidth property as per Settings (already initialized)
    // 2) rowBackgroundRender
    let columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    if( gridSettingsData.useCompactColumnWidth ) {
        columnWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
    } else {
        columnWidth = gridSettingsData.columnWidth;
    }
    _.forEach( columnProperties, columnProps => {
        columnProps.columnWidth = columnWidth;
        columnProps.cellRenderers = [ _rowBackgroundRenderer, _propertyColumnCellRenderer ];

        // Set flag on Column if constraint has no selections
        columnProps.hasNoSelections = !_isColumnWithEditsInMaps( columnProps.propertyUid, subjectSelectionMap, conditionSelectionMap );

        // Enable Column Menu
        // it will be disabled for bottom grid when building columns for bottom DP
        columnProps.enableColumnMenu = true;
    } );
    variability.soaResponse = { ...soaResponse };
    variability.columnProperties = [ ...columnProperties ];
    variability.splitColumnsMap = { ...splitColumnsMap };
    variability.backupOfSplitColumnsMap = _.cloneDeep( splitColumnsMap );

    // Reset dirty elements.
    variability.dirtyElements = [];

    vmData.variabilityProps.setAtomicData( variability );
    vmData.topGrid.setAtomicData( topData );
    vmData.bottomGrid.setAtomicData( bottomData );

    return true;
};

/**
 * PostProcess LOVs from SOA response for Matrix grid mode
 * Parse and save LOVs for feature dispositions and separators when authoring Matrix Rules
 * Update internal data if needed (no action if SOA doesn't contain LOV data, i.e. not on first loading)
 * @param {Object} soaResponse response from SOA
 * @param {Array} matrixLegendDetails - Matrix Rules Legend info container (to be updated when provided by SOA response)
 * @returns {Object} data container to initialize internal data and matrix legend component
 */
export let postProcessLOVsForMatrix = ( soaResponse, matrixLegendDetails ) => {
    // Process Feature Dispositions if provided by SOA
    if( !_.isUndefined( _.get( soaResponse, 'responseInfo.Cfg0FeatureDispositionLOV' ) ) ) {
        let featureDispositionLOVFromServer = JSON.parse( soaResponse.responseInfo.Cfg0FeatureDispositionLOV[ 0 ] );
        let featureDispositionsLov = featureDispositionLOVFromServer.Cfg0FeatureDispositions;

        // Make sure operator code is sent as Integer number
        featureDispositionsLov.forEach( lovEntry => {
            lovEntry.operatorCode = Number( lovEntry.operatorCode );
        } );

        // Update Context
        // Note: we need to save LOV in the context as it's globally available
        // The component for renderingHint [pcaFeatureDispositionLovEdit] will only have access to the vmo
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.featureDispositionsLov', featureDispositionsLov );
    }

    // Feature dispositions may be cached already in context
    let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let featureDispositionsLOV = configuratorCtx.featureDispositionsLov;

    // Build Matrix Legend Details if undefined
    // (e.g. first load or when navigating back to Matrix view)
    if( _.isUndefined( matrixLegendDetails ) ) {
        matrixLegendDetails = {
            legendType: 'MatrixLOVLegend',
            legendItems: [],
            legendContent: ''
        };
        let lastIdx = featureDispositionsLOV.length - 1;

        // Build inner String with full legend content
        // This is intended for testing purposes only, not for display
        let legendContent = '';

        featureDispositionsLOV.forEach( ( lovEntry, lovIdx ) => {
            matrixLegendDetails.legendItems.push( {
                legendItemKey: lovEntry.lovKey,
                legendItemValue: lovEntry.description,
                hasMoreValues: lovIdx !== lastIdx
            } );

            // Add entry to content string
            legendContent += lovEntry.lovKey + ': ' + lovEntry.description;
            if( lovIdx !== lastIdx ) {
                legendContent += ', ';
            }
        } );
        matrixLegendDetails.legendContent = legendContent;
    }

    // Process and save LOVs for Matrix Rules delimiters/separators in ViewModel data
    if( !_.isUndefined( _.get( soaResponse, 'responseInfo.Cfg0MatrixRuleSubjectSeparatorsLOV' ) ) ) {
        let delimitersLOVFromServer = JSON.parse( soaResponse.responseInfo.Cfg0MatrixRuleSubjectSeparatorsLOV[ 0 ] );
        let matrixRuleSubjectDelimitersLov = delimitersLOVFromServer.Cfg0MatrixRuleSubjectSeparators;

        // Update Context
        // Note: we need to save LOV in the context as it's globally available
        // This is to prevent issues (LCS-926439) when displaying Summary after we navigate back to Matrix view
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.matrixRuleSubjectDelimitersLov', matrixRuleSubjectDelimitersLov );
    }

    return matrixLegendDetails;
};

/**
 * LIVE Update top table height
 * @param {Object} eventData slider dbValue to update to tree height
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 * @returns {Boolean} value has been updated
 */
export let updateTopTableHeight = ( eventData, vmGridSettings ) => {
    let gridSettings = { ...vmGridSettings.getAtomicData() };

    let topTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-topTreeHeight' );
    let bottomTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-bottomTreeHeight' );
    // Reset the max-height of top and bottom table
    // Else the height of top table won't increase.
    topTreeTableRowElement[ 0 ].style.maxHeight = '';
    bottomTreeTableRowElement[ 0 ].style.maxHeight = '';
    if( eventData ) {
        if( eventData.sliderValue[ 0 ].sliderOption.value === eventData.sliderValue[ 0 ].sliderOption.min ) {
            topTreeTableRowElement[ 0 ].style.height = 'auto';
        } else {
            topTreeTableRowElement[ 0 ].style.height = eventData.sliderValue[ 0 ].sliderOption.value + '%';
        }
        gridSettings.topTableHeight = eventData.sliderValue[ 0 ].sliderOption.value;
        // Update Atomic Data
        vmGridSettings.setAtomicData( gridSettings );
    }
    return true;
};

/**
 * Process top/bottom selection maps:
 * Filter out unedited constraints, clean empty splits and remove zero selections
 * Result will be used to populate SetVariantExpressionData SOA input 'selectedExpressions'.
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @param {String} gridEditorMode - active grid Editor mode
 * @returns {Object} Processed/Filtered Selected Expressions PCAGrid
 */
export let preProcessConstraintsExpressionsForSaveAction = function( variabilityData, gridEditorMode ) {
    const gridSettingsData = { ...variabilityData.gridSettings.getAtomicData() };
    let topGridData = { ...variabilityData.topGrid.getAtomicData() };
    let bottomGridData = { ...variabilityData.bottomGrid.getAtomicData() };
    let variabilityProps = { ...variabilityData.variabilityProps.getAtomicData() };

    // Copy deep as we do not want to update actual businessObjectToSelectionMap
    // We just want to remove unedited constraints from selection maps for Save
    let topGridSelectionMap = _.cloneDeep( topGridData.businessObjectToSelectionMap );
    let bottomGridSelectionMap = _.cloneDeep( bottomGridData.businessObjectToSelectionMap );

    // Note: 'dirtyElements' array does NOT take into account split columns (with or without expressions)
    // Process split columns for edited constraints: if they do not contain edits, remove them
    let constraintsWithEdits = [];

    for( let constraintColumnUID of variabilityProps.dirtyElements ) {
        // Add column UID to list of constraints to send to server for update
        constraintsWithEdits.push( constraintColumnUID );

        // If column contains splits, look for selections: send to server only non-empty split columns
        if( _.has( variabilityProps.splitColumnsMap, constraintColumnUID ) ) {
            for( let splitColumnDef of variabilityProps.splitColumnsMap[ constraintColumnUID ] ) {
                if( _isNotEmptySplitColumn( splitColumnDef.uid, splitColumnDef.isSplitSubject, gridSettingsData.showSubjectInTopGrid, topGridSelectionMap, bottomGridSelectionMap ) ) {
                    constraintsWithEdits.push( splitColumnDef.uid ); // edit was found: split column must stay
                }
            }
        }
    }

    // Remove from selection maps constraint keys that don't need to be sent to server
    topGridSelectionMap = _.pick( topGridSelectionMap, constraintsWithEdits );
    bottomGridSelectionMap = _.pick( bottomGridSelectionMap, constraintsWithEdits );

    // Clean selectionMaps:
    // 1- Remove zero selections
    // 2- Filter actual selections, removing copied selections from Split action
    pca0ExpressionGridService.removeZeroSelections( topGridSelectionMap );
    pca0ExpressionGridService.removeZeroSelections( bottomGridSelectionMap );

    let subjectSelectionMap = gridSettingsData.showSubjectInTopGrid ? _.cloneDeep( topGridSelectionMap ) : _.cloneDeep( bottomGridSelectionMap );
    let conditionSelectionMap = gridSettingsData.showSubjectInTopGrid ? _.cloneDeep( bottomGridSelectionMap ) : _.cloneDeep( topGridSelectionMap );

    pca0ExpressionGridService.removeCopiedSplitSelections( variabilityProps.columnProperties, subjectSelectionMap, conditionSelectionMap );
    return pca0ExpressionGridService.getPCAGridWithMultiGridFromSelectionMap( subjectSelectionMap, conditionSelectionMap, gridEditorMode );
};

/**
 * API to handle Cancel Edits. It resets the businessObjectToSelectionMap using backup.
 * As we are updating variabilityProps.soaResponse, treeData will be reloaded.
 * @param {Object} vmGridData - View Model Atomic Data for view model
 * @return {Object} set of Boolean flags/Objects to trigger backup data actions
 */
export let handleCancel = vmGridData => {
    let topGridData = { ...vmGridData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmGridData.bottomGrid.getAtomicData() };
    let variabilityPropsData = { ...vmGridData.variabilityProps.getAtomicData() };
    let mustRevertTopGridToBackupContent = false;
    let mustRevertBottomGridToBackupContent = false;
    let splitColumnsToRemove;

    // DO NOT reload table: reset vmo selection state to original state
    // Keep visible all the added
    // Selection Maps: revert to backup Maps
    mustRevertTopGridToBackupContent = pca0GridCommonUtils.isSelectionMapRestoredToBackup( topGridData, veConstants.GRID_CONSTANTS.TOP_GRID, vmGridData );
    mustRevertBottomGridToBackupContent = pca0GridCommonUtils.isSelectionMapRestoredToBackup( bottomGridData, veConstants.GRID_CONSTANTS.BOTTOM_GRID, vmGridData );
    // Set completeness flags for 'revert to backup value' action on top/bottom grids
    _topGridActionComplete = !mustRevertTopGridToBackupContent;
    _bottomGridActionComplete = !mustRevertBottomGridToBackupContent;

    // Split changes: in case of split columns added:
    // - build map of split Columns to remove from each dataProvider columnConfig
    // - revert splitColumn map to backup
    var splitChanges = !_.isEqual( variabilityPropsData.backupOfSplitColumnsMap, variabilityPropsData.splitColumnsMap );
    if( splitChanges ) {
        splitColumnsToRemove = {};
        Object.entries( variabilityPropsData.splitColumnsMap ).forEach( ( [ constraintKey, splitColumns ] ) => {
            splitColumnsToRemove[ constraintKey ] = [];
            splitColumns.forEach( splitColumn => {
                if( !_.find( variabilityPropsData.backupOfSplitColumnsMap[ constraintKey ], { uid: splitColumn.uid } ) ) {
                    splitColumnsToRemove[ constraintKey ].push( splitColumn.uid );
                }
            } );
        } );
        variabilityPropsData.splitColumnsMap = _.cloneDeep( variabilityPropsData.backupOfSplitColumnsMap );
    }

    // Reset dirty elements.
    variabilityPropsData.dirtyElements = [];
    vmGridData.variabilityProps.setAtomicData( variabilityPropsData );

    return {
        mustRevertTopGridToBackupContent,
        mustRevertBottomGridToBackupContent,
        splitColumnsToRemove
    };
};

/**
 * Update ViewModel Collection for the Data Provider and update Column Config
 * Remove Constraint columns from:
 * - props list of each ViewModel Object node
 * - selectionMap
 * Scenario:
 * - Cancel Edits when new split columns were introduced
 * - Save Edits when a split column has no expressions authored
 * @param {UwDataProvider} treeDataProvider DataProvider to be updated
 * @param {Object} splitColumnsToRemove - Maps of columns to be removed from columnConfig
 * @param {Object} vmGridData - View Model Atomic Data with respect to top/bottom tree
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let removeSplitColumns = function( treeDataProvider, splitColumnsToRemove, vmGridData ) {
    let newColumnInfos = [ ...treeDataProvider.columnConfig.columns ];
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    // VariabilityProps/GridSettings/GridData come as:
    // - props (value/update) from topGrid
    // - atomicData (get/set AtomicData) from bottomGrid
    let gridData = vmGridData.getValue ? { ...vmGridData.getValue() } : { ...vmGridData.getAtomicData() };

    Object.entries( splitColumnsToRemove ).forEach( ( [ originalConstraintKey, columnIDs ] ) => {
        _.forEach( columnIDs, columnId => {
            // Remove Constraint from columnInfos
            let idx = _.findIndex( newColumnInfos, { uid: columnId } );
            newColumnInfos.splice( idx, 1 );

            // Look for remaining (pre-existing) split columns for given originalColumn key
            // If no splitColumns are present, reset flag on original column
            let originalColumnDef = _.find( newColumnInfos, { uid: originalConstraintKey } );
            let preExistingSplitColumns = _.filter( newColumnInfos, column => {
                return column.uid !== originalConstraintKey && column.originalColumnName === originalConstraintKey;
            } );
            if( preExistingSplitColumns.length === 0 ) {
                delete originalColumnDef.hasSplitSubject;
            }

            // Delete prop on each VMO
            _.forEach( vmos, vmo => { delete vmo.props[ columnId ]; } );

            // Remove Constraint from selectionMap and backup
            delete gridData.businessObjectToSelectionMap[ columnId ];
            delete gridData.backupOfBusinessObjectToSelectionMap[ columnId ];
        } );
    } );

    // Update selectionMap: dispatch changes on grid data
    vmGridData.update ? vmGridData.update( gridData ) : vmGridData.setAtomicData( gridData );

    return {
        treeColumnConfig: {
            columns: newColumnInfos
        }
    };
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export let getSaveHandler = function() {
    return m_saveHandler;
};

/**
 * API to handle Manual Start Edits.
 * @param {Object} editHandler - instance of constraints edit handler
 */
export let handleStartEdits = editHandler => {
    // Set Active Edit handler Context
    editHandlerService.setActiveEditHandlerContext( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );

    pca0CommonUtils.handleEditModeStart( veConstants.CONFIG_CONTEXT_KEY );

    // Call CFX startEdit on declared edit handler
    // This way we are using native edit mode template for cells in Matrix Rules
    // --> DropDown is displayed for family/feature dispositions LOVs
    // Other cells with custom edits (i.e. cellClick to change TICK|NOT|BLANK icon) are set as non editable
    editHandler.startEdit();
};

/**
 * API to Handle and Enforce Manual Start Edits.
 * Scenario: new constraint has been added to grid.
 * Call leave confirmation on any other active handler, reset completeness flags.
 * @param {Object} editHandler - instance of constraints edit handler
 * @returns {Object} action flag 'isActionCompleteInAllGrids' reset
 */
export let enforceStartEdits = editHandler => {
    // If table is in edit mode already, do not call leave Confirmation
    if( appCtxService.getCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE ) ) {
        return {
            isActionCompleteInAllGrids: _resetActionCompletenessFlags()
        };
    }

    // If active handler (may be the same or in any other WorkArea) is not editing:
    // enforce edit mode in Constraints
    // do not call leave Confirmation
    const activeEditHandler = editHandlerService.getActiveEditHandler();
    let isActiveHandlerNotEditing = _.isNull( activeEditHandler ) || !activeEditHandler._editing;
    if( isActiveHandlerNotEditing ) {
        exports.handleStartEdits( editHandler );
        return {
            isActionCompleteInAllGrids: _resetActionCompletenessFlags()
        };
    }

    // For any other active handler in edit mode, call leave Confirmation
    return editHandlerService.leaveConfirmation().then( () => {
        exports.handleStartEdits( editHandler );
        return {
            isActionCompleteInAllGrids: _resetActionCompletenessFlags()
        };
    } );
};

/**
 * Post-processing of Save action
 * Handle Edit Mode change
 * Sync maps with backup maps
 * As we are updating variabilityProps.soaResponse, treeData will be reloaded.
 * @param {Object} vmGridData - View Model Atomic Data with respect to top/bottom tree
 * @param {Object} editHandler - instance of constraints edit handler
 * @param {Object} unsavedColumns - list of columns that were not saved due to partial errors
 * @return {Object} Map of split columns that must be removed from grid after save
 */
export let postProcessSaveEdits = ( vmGridData, editHandler, unsavedColumns ) => {
    /**
     * GENERAL ASSUMPTIONS on EMPTY unsavedColumns list:
     * - No errors occurred during save
     * - Variant Table is no longer in Edit mode
     * - all input columns have been successfully saved
     * - dirtyElements collection (constraints with edits) is reset
     */
    let isSaveSuccessful = unsavedColumns.length === 0;

    const gridSettingsData = { ...vmGridData.gridSettings.getAtomicData() };
    let topGridData = { ...vmGridData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmGridData.bottomGrid.getAtomicData() };
    let variabilityPropsData = { ...vmGridData.variabilityProps.getAtomicData() };

    if( isSaveSuccessful ) {
        // edit button in PWA should be visible if save edit command is successful in SWA
        pca0CommonUtils.setVisibilityOfEditCommandInPWA( true /* visibility */ );

        // Reset IS_VARIANT_TREE_IN_EDIT_MODE
        appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
    } else {
        // Save was not successful: activate Edit Mode on Variant table ('Bulk Edit')
        exports.handleStartEdits( editHandler );
    }

    // Split changes:
    // - build map of split Columns to remove if needed (empty splits)
    // --- this is to update each dataProvider columnConfig, vmo.props {TODO} and selectionMaps
    // - update backup of split columns
    // Evaluate split changes only for successfully saved columns
    let splitColumnsToRemove = {};
    Object.entries( variabilityPropsData.splitColumnsMap ).forEach( ( [ constraintKey, splitColumns ] ) => {
        if( isSaveSuccessful || !unsavedColumns.includes( constraintKey ) ) {
            splitColumnsToRemove[ constraintKey ] = [];
            splitColumns.forEach( splitColumn => {
                let splitColumnIndex = _.findIndex( variabilityPropsData.splitColumnsMap[ constraintKey ], { uid: splitColumn.uid } );
                let splitColumnDef = variabilityPropsData.splitColumnsMap[ constraintKey ][ splitColumnIndex ];
                let isColumnToRemove = false;
                if( splitColumnDef.isSplitSubject ) {
                    if( gridSettingsData.showSubjectInTopGrid && _.isEmpty( topGridData.businessObjectToSelectionMap[ splitColumn.uid ] ) ||
                        !gridSettingsData.showSubjectInTopGrid && _.isEmpty( bottomGridData.businessObjectToSelectionMap[ splitColumn.uid ] ) ) {
                        isColumnToRemove = true;
                    }
                } else {
                    if( gridSettingsData.showSubjectInTopGrid && _.isEmpty( bottomGridData.businessObjectToSelectionMap[ splitColumn.uid ] ) ||
                        !gridSettingsData.showSubjectInTopGrid && _.isEmpty( topGridData.businessObjectToSelectionMap[ splitColumn.uid ] ) ) {
                        isColumnToRemove = true;
                    }
                }
                if( isColumnToRemove ) {
                    splitColumnsToRemove[ constraintKey ].push( splitColumn.uid );
                    variabilityPropsData.splitColumnsMap[ constraintKey ].splice( splitColumnIndex, 1 );
                    delete topGridData.businessObjectToSelectionMap[ splitColumn.uid ];
                    delete bottomGridData.businessObjectToSelectionMap[ splitColumn.uid ];
                }
            } );
        }
    } );

    if( isSaveSuccessful ) {
        // Reset dirty elements.
        variabilityPropsData.dirtyElements = [];

        variabilityPropsData.backupOfSplitColumnsMap = _.cloneDeep( variabilityPropsData.splitColumnsMap );

        // Selection Maps: update Backup of selections with saved data.
        if( !_.isEqual( topGridData.businessObjectToSelectionMap, topGridData.backupOfBusinessObjectToSelectionMap ) ) {
            topGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( topGridData.businessObjectToSelectionMap );
            vmGridData.topGrid.setAtomicData( topGridData );
        }
        if( !_.isEqual( bottomGridData.businessObjectToSelectionMap, bottomGridData.backupOfBusinessObjectToSelectionMap ) ) {
            bottomGridData.backupOfBusinessObjectToSelectionMap = _.cloneDeep( bottomGridData.businessObjectToSelectionMap );
            vmGridData.bottomGrid.setAtomicData( bottomGridData );
        }
        // Reset highlighted background for new constraints header cells
        pca0GridHeaderService.cleanHeaderCells( variabilityPropsData.newConstraints, pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, veConstants.GRID_CONSTANTS.PCA_GRID );

        // Reset newConstraints
        // NOTE: we are clearing newConstraints and we are keeping newConstraintColumnProps
        // newConstraintColumnProps is needed to get 'Properties information' data from new columns
        // (note we are not calling GET after SET, so this info is not contained in soaResponse until a new GET call is done)
        variabilityPropsData.newConstraints = [];
    } else {
        // TODO: update dirty elements and align backup only for successfully saved columns
    }

    vmGridData.variabilityProps.setAtomicData( variabilityPropsData );

    return splitColumnsToRemove;
};


/**
 * Open Pick&Choose command dialog if applicable for target DataProvider
 * @param {Object} eventData EventData Info container
 * @param {UwDataProvider} dataProvider grid Data Provider
 * @param {Object} gridData grid atomic data
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 */
export let initializeAddVariabilityDialogData = ( eventData, dataProvider, gridData, gridEditorMode ) => {
    // Proceed with the action is pertinent to target DataProvider
    let commandContext = eventData.commandContext;

    let isTopGrid;
    if( !_.isUndefined( eventData.isTopGrid ) /*this parameter is added by Cell Command*/ ) {
        isTopGrid = eventData.isTopGrid;
    } else {
        isTopGrid = eventData.isSubjectAction /*this parameter is added by Toolbar*/ &&
            commandContext.gridSettings.getValue().showSubjectInTopGrid ||
            !eventData.isSubjectAction && !commandContext.gridSettings.getValue().showSubjectInTopGrid;
    }

    let canAddVariability =
        dataProvider.name === veConstants.GRID_CONSTANTS.PCA_GRID_DP && isTopGrid ||
        dataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP && !isTopGrid;

    if( !canAddVariability ) {
        return;
    }

    let selectedData = new Set();
    _.forEach( gridData.backupOfBusinessObjectToSelectionMap, mapObject => {
        _.forEach( mapObject, selection => {
            selection.family && selection.nodeUid ? selectedData.add( selection.family + ':' + selection.nodeUid ) : false;
        } );
    } );
    let parentVMO;
    const vmos = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, ( vmoData ) => {
        if( vmoData.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID || vmoData.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) {
            parentVMO = vmoData;
        } else {
            // here we create id with family and feature uid only we don't require uid of subject to add into it
            const alternatedID = vmoData.parentUID + ':' + vmoData.uid;
            selectedData.add( alternatedID );
        }
    } );

    // What if the features are collapsed in grid editor? We won't get those VMOS in dataProvider.
    // Hence, those will not be shown as ticked in Pick and choose panel.
    // Fortunately, we have all the newly added features in gridData variabilityNodes.
    _.forEach( gridData.variabilityNodes, ( variabilityNode ) => {
        if( variabilityNode.nodeUid && variabilityNode.parent ) {
            const alternatedID = variabilityNode.parent[ 0 ] + ':' + variabilityNode.nodeUid;
            selectedData.add( alternatedID );
        }
    } );

    commandContext.isTopGrid = isTopGrid;
    commandContext.gridEditorMode = gridEditorMode;
    commandContext.selectedData = [ ...selectedData ];
    commandContext.vmo = parentVMO;
};

/**
 * Checks if variabilityProps.availableConstraintTypes is empty and call SOA to fetch 'availableConstraintTypes'
 *        else use them to open dialog
 * Open 'Add Constraint' fly-out dialog
 * Build subPanelContext with relevant information to initialize sub-components
 * @param {Object} input - CommandContext info container for opening Dialog
 */
export let openAddConstraintPanel = ( input ) => {
    let { commandContext } = input;
    const isOpenedFromPWA = Boolean( input.constraintsTableData );
    // While openAddConstraintPanel is called from PWA, constraintsTableData will be available
    let addConstraintPanelProps = isOpenedFromPWA ? input.constraintsTableData.getAtomicData() : commandContext.variabilityProps.getValue();
    const dialogAction = _.get( commandContext, 'dialogAction' ) ?? appCtxService.getCtx( 'globalDialog' );
    commandContext = {
        ...commandContext,
        gridEditorMode: isOpenedFromPWA ? 'allConstraintRules' : commandContext.gridEditorMode,
        availableConstraintTypes: addConstraintPanelProps.availableConstraintTypes,
        variabilityTreeData: isOpenedFromPWA ? null : addConstraintPanelProps.soaResponse.variabilityTreeData,
        baseSelection: _.get( commandContext, 'context.baseSelection' ) ?
            _.get( commandContext, 'context.baseSelection' ) : _.get( commandContext, 'baseSelection' )
    };

    if( _.isEmpty( addConstraintPanelProps.availableConstraintTypes ) ) {
        const eventType = isOpenedFromPWA ? 'Pca0ConstraintsTable.fetchAvailableConstraintTypes' : 'Pca0ConstraintsGridEditor.fetchAvailableConstraintTypes';
        eventBus.publish( eventType, { commandContext } );
    } else {
        const ruleTypes = addConstraintPanelProps.availableConstraintTypes.map( a => a.propInternalValue ).join( ',' );
        let options = {
            view: input.commandId,
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            parent: '.aw-layout-workarea',
            isCloseVisible: false,
            isPinUnpinEnabled: true,
            subPanelContext: { ...commandContext, ruleTypes, isOpenedFromPWA }
        };
        dialogAction.show( options );
    }
};

/**
 * Call Utils to build SOA input to get the list of applicable BO types that can be instantiated
 * @param {String} selectedType entity object to query
 * @returns {Array} list of input data with detail on requested BO type and exclusion list
 */
export let getInputForApplicableTypes = function( selectedType ) {
    return pcaObjectTypeLOVComponentService.getInputForApplicableTypes( selectedType );
};

/**
 * Update shared Constraint Data
 * This will avoid a SOA call if 'Add Constraint' panel is reopened in Constraints view
 * @param {Object} response Contains VMO of applicable rules
 * @param {Object} eventData Contains required data like variabilityProps and dialogOptions
 * @param {Object} constraintsTableData Contains constraints table data
 */
export let cacheLoadedConstraintTypes = ( response, eventData, constraintsTableData ) => {
    const commandContext = { ...eventData.commandContext };
    const loadedConstraintTypes = pcaObjectTypeLOVComponentService.processSoaResponseForBOTypes( response );
    if( constraintsTableData ) {
        const updatedConstraintsTableData = constraintsTableData.getAtomicData();
        updatedConstraintsTableData.availableConstraintTypes = [ ...loadedConstraintTypes ];
        constraintsTableData.setAtomicData( updatedConstraintsTableData );
        exports.openAddConstraintPanel( { ...eventData, commandId: 'Pca0ConstraintsGridEditorAdd', constraintsTableData: constraintsTableData } );
    } else {
        const updatedVariabilityProps = { ...commandContext.variabilityProps.getValue() };
        updatedVariabilityProps.availableConstraintTypes = [ ...loadedConstraintTypes ];
        commandContext.variabilityProps.update( updatedVariabilityProps );
        exports.openAddConstraintPanel( { ...eventData, commandId: 'Pca0ConstraintsGridEditorAdd' } );
    }
};

/**
 * Get Property Policy for Constraint Rule being created
 * Dynamically build Policy based on Properties Information received from getVariantExpressionData4 SOA response
 * @param {String} selectedConstraintType selected constraint type
 * @param {Array} variabilityTreeData Variability Nodes
 * @returns {String} registered policy ID
 */
export let getConstraintGridEditorPolicyTypes = ( selectedConstraintType, variabilityTreeData ) => {
    let types = [ {
        name: selectedConstraintType.type,
        properties: []
    } ];

    // Get Properties Information nodes
    // They will be used to build policy
    let propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( variabilityTreeData );
    // object_type should always be the part of property policy as we need to show
    // object type every time irrespective of whether it is present in COTS.xml
    if( !propInfoUIDs.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ) ) {
        propInfoUIDs.push( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID );
    }
    _.forEach( propInfoUIDs, propUID => {
        types[ 0 ].properties.push( { name: propUID } );
    } );
    return types;
};

/**
 * Prepare the SOA input to create a new Constraint
 * Add ProductItem to the input
 * @param {Object} data the ViewModel data of the Add Constraint Panel
 * @param {Object} panelContext panel context
 * @param {Object} editHandler for the fly-out panel
 * @param {Object} xrtTypeLoaded to get type of selected rule
 * @returns {Object} createRelateAndSubmitObjects SOA input
 */
export let getConstraintCreateInput = ( data, panelContext, editHandler, xrtTypeLoaded ) => {
    let extensionVMProps = null;
    if( _.get( appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ), 'openedObjectType' ) === pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY ) {
        extensionVMProps = {};
        extensionVMProps.cfg0IsGlobal = uwPropertyService.createViewModelProperty( 'cfg0IsGlobal', '', 'BOOLEAN', true );
    }

    let input = addObjectUtils.getCreateInput(
        data,
        extensionVMProps, {
            props: {
                type_name: {
                    dbValues: [ xrtTypeLoaded.type ]
                }
            }
        },
        editHandler
    );

    // If cfg0Severity is not set, set it to 'Error' as default severity
    if( _.isUndefined( _.get( input, '[0].createData.propertyNameValues.cfg0Severity' ) ) ) {
        const allEditableProperties = editHandler.dataSource.getAllEditableProperties();
        // If cfg0Severity is present in allEditableProperties then set it to 'Error'
        if( allEditableProperties.some( obj => obj.propertyName === 'cfg0Severity' ) ) {
            input[ 0 ].createData.propertyNameValues.cfg0Severity = [ 'Error' ];
        }
    }

    let productItem = _.get( panelContext, 'baseSelection.uid' );
    if( input && input.length > 0 ) {
        input[ 0 ].createData.propertyNameValues.cfg0ProductItems = [ productItem ];
    }
    return input;
};

/**
 * Get created constraint rules from SOA response
 * @param {Object} soaResponse - createRelateAndSubmitObjects SOA response
 * @param {Boolean} isOpenedFromPWA - true if opened from PWA
 * @param {String} secondaryActiveTabId - active tab id of secondary workarea
 * @returns {object} object with created constraints and flag to can load in editor
 */
export let getCreatedConstraints = ( soaResponse, isOpenedFromPWA, secondaryActiveTabId ) => {
    let createdConstraints = [];
    if( !_.isUndefined( soaResponse.ServiceData.created ) ) {
        const constraintUIDs = soaResponse.ServiceData.created;
        for( const constraintUID of constraintUIDs ) {
            // Check if modelObject typeHierarchyArray contains 'cfg0AbsRule'
            const modelObject = soaResponse.ServiceData.modelObjects[ constraintUID ];
            if( modelObject.modelType.typeHierarchyArray.includes( 'Cfg0AbsRule' ) ) {
                createdConstraints.push( modelObject );
            }
        }
    }
    const parentTypeName = _.get( createdConstraints[ 0 ], 'modelType.parentTypeName' );
    const ruleTypes = [ 'Cfg0AbsDefaultRule', 'Cfg0AbsIncludeRule', 'Cfg0AbsExcludeRule', 'Cfg0AbsAvailabilityRule', 'Cfg0AbsExceptionRule' ];
    const canLoadInGridEditor = secondaryActiveTabId === 'Pca0ConstraintsGridEditorWrapper' && ruleTypes.includes( parentTypeName );
    const canLoadInMatrix = secondaryActiveTabId === 'Pca0ConstraintsSnOMatrixWrapper' && parentTypeName === 'Cfg0AbsMatrixRule';
    const canLoadInTextEditor = secondaryActiveTabId === 'Pca0FreeFormEditor' && parentTypeName === 'Cfg0AbsFreeFormRule';
    const canLoadInEditor = !isOpenedFromPWA || canLoadInGridEditor || canLoadInMatrix || canLoadInTextEditor;
    return { createdConstraints, canLoadInEditor };
};

/**
 * Post process created Constraint
 * Update VariabilityProps with new column (constraint) properties
 * Add new entry in top/bottom selection maps and backups
 * @param {Array} constraintModelObjects Array of created constraints model objects
 * @param {Object} vmData GridEditor ViewModel atomic data
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @param {String} popupId - popupId of dialog
 * @param {Boolean} isPanelPinned true if Panel is pinned: dialog must be closed when not pinned
 */
export let postProcessCreatedConstraint = ( constraintModelObjects, vmData, displayMode ) => {
    // Clone current status for VM data and fields (atomic data)
    let variability = { ...vmData.variabilityProps.getAtomicData() };
    const gridSettingsData = { ...vmData.gridSettings.getAtomicData() };
    let topGridData = { ...vmData.topGrid.getAtomicData() };
    let bottomGridData = { ...vmData.bottomGrid.getAtomicData() };

    // Update newConstraintCreationState to creating
    variability.newConstraintCreationState = 'creating';

    // Set width based on Settings
    let columnWidth = gridSettingsData.useCompactColumnWidth ?
        pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH :
        gridSettingsData.columnWidth;

    for( const constraintModelObject of constraintModelObjects ) {
        // Create new Column Property
        // Add custom properties to column definitions:
        // 1) columnWidth property as per Settings Cache (already initialized)
        // 2) rowBackgroundRender
        let objectName = _.get( constraintModelObject, 'props.object_string.uiValues[0]' );
        let constraintUID = constraintModelObject.uid;

        let newColumnProperties = {
            gridID: pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID,
            columnWidth: columnWidth,
            cellRenderers: [ _rowBackgroundRenderer, _propertyColumnCellRenderer ],
            originalColumnName: constraintUID,
            propertyDisplayName: objectName,
            propertyName: constraintUID,
            propertyUid: constraintUID,
            enableColumnMenu: true,
            isSplitColumn: false,
            isVertical: gridSettingsData.useVerticalColumnHeader,
            newConstraintColumnProps: {},
            hasNoSelections: true
        };

        // Update list of new constraints
        // This is needed when creating propertyMap on each VMO
        variability.newConstraints.push( newColumnProperties );

        // Build column properties:
        // 1. get the list of properties needed
        //  (query the available 'Properties Information' nodes from getVariantExpressionData4 'viewModelObjectMap')
        // 2. Query created constraint for such properties
        // This way, other props returned in ServiceData are filtered
        // Build locale Text bundle for 'Properties Information'
        let localePropInfoMap = pca0GridCommonUtils.getPropInfoFromSOAResponse( variability.soaResponse );

        let propInfoNode = _.find( variability.soaResponse.variabilityTreeData, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } );
        if( !_.isUndefined( propInfoNode ) && !_.isUndefined( propInfoNode.childrenUids ) ) {
            _.forEach( propInfoNode.childrenUids, internalPropKey => {
                // Not all constraints contain all properties requested (e.g. DefaultRule has no message/severity)
                if( Object.keys( constraintModelObject.props ).includes( internalPropKey ) ) {
                    newColumnProperties.newConstraintColumnProps[ internalPropKey ] = {
                        // response.ServiceData contains Properties Information [internalKey + localized uiValue], e.g.:
                        // object_type: {dbValues: ["Cfg0DefaultRule"], uiValues: ["Localized Constraint Type"]}
                        // Re-arrange structure to accommodate localized Property Display Name, e.g.:
                        // {object_type: {propDisplayName: 'Type', propDisplayValue: 'Localized Constraint Type', sourceType:'Cfg0DefaultRule'}}
                        propDisplayName: localePropInfoMap[ internalPropKey ],
                        propDisplayValue: constraintModelObject.props[ internalPropKey ].uiValues[ 0 ],
                        sourceType: constraintModelObject.props[ internalPropKey ].dbValues[ 0 ]
                    };

                    // Add info on Parent Abstract Class for object_type
                    if( internalPropKey === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ) {
                        let parentAbstractClass = '';
                        let relatedObj = cdm.getObject( constraintUID );
                        if( !_.isUndefined( relatedObj ) ) {
                            parentAbstractClass = relatedObj.modelType.parentTypeName;
                        }
                        newColumnProperties.newConstraintColumnProps[ internalPropKey ].parentAbstractClass = parentAbstractClass;
                    }
                }
            } );
            // If object_type property is not present in COTS.xml, we need to add the
            // prop in columnProps separately as we need it to show the object_type in column header
            if( !( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID in newColumnProperties.newConstraintColumnProps ) ) {
                let relatedObj = cdm.getObject( constraintUID );
                newColumnProperties.newConstraintColumnProps[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] = {
                    propDisplayName: relatedObj.props.object_type.propertyDescriptor.displayName,
                    propDisplayValue: relatedObj.props.object_type.uiValues[ 0 ],
                    parentAbstractClass: relatedObj.modelType.parentTypeName,
                    isPropertyNotFromCots: true
                };
            }
        }

        // Update columnProperties on variabilityProps
        let columnProperties = [ ...variability.columnProperties ];
        columnProperties.splice( 0, 0, newColumnProperties );
        variability.columnProperties = columnProperties;

        // Update selection maps: add entry to selectionMap of top/bottom grids
        topGridData.businessObjectToSelectionMap[ constraintUID ] = {};
        topGridData.backupOfBusinessObjectToSelectionMap[ constraintUID ] = {};
        bottomGridData.businessObjectToSelectionMap[ constraintUID ] = {};
        bottomGridData.backupOfBusinessObjectToSelectionMap[ constraintUID ] = {};
    }

    vmData.variabilityProps.setAtomicData( variability );
    vmData.topGrid.setAtomicData( topGridData );
    vmData.bottomGrid.setAtomicData( bottomGridData );

    _updateBottomAndTopTableHeight( displayMode, gridSettingsData.useVerticalColumnHeader );
};

/**
 * Update 'Properties Information' for the constraint in:
 * - variabilityProps VMO map
 * - Data provider VMOs (Properties Information VMOs)
 * - Data Provider column config: column config contains props for each constraint
 * Updated information is carried by eventData after making changes in Info Panel
 * @param {Object} eventData eventData containing updated Properties Information
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSettings - View Model Atomic Data <gridSettings>
 *
 */
export let updateConstraintPropertiesInformation = function( eventData, treeDataProvider, vmVariabilityProps, vmGridSettings ) {
    let xrtVMO = eventData.getValue().xrtVMO;
    let constraintUidToBeUpdated = xrtVMO.uid;

    // VariabilityProps and gridSettings come as props (value/update) [method is called from topGrid only]
    let variabilityProps = { ...vmVariabilityProps.getValue() };
    let variabilityNodes = variabilityProps.soaResponse.variabilityTreeData;
    let viewModelObjectMap = variabilityProps.soaResponse.viewModelObjectMap;
    let gridSettings = { ...vmGridSettings.getValue() };

    if( _.isUndefined( constraintUidToBeUpdated ) || _.isUndefined( viewModelObjectMap[ constraintUidToBeUpdated ] ) ) {
        return;
    }

    // Get Properties fields (children of __Pca0_Constraints_Properties_Section__)
    let propertyUids = _.find( variabilityNodes, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } ).childrenUids;

    // Update grid viewModelObjectMap with latest values
    _.forEach( propertyUids, ( propertyUid ) => {
        if( !_.isUndefined( xrtVMO.props[ propertyUid ] ) ) {
            viewModelObjectMap[ constraintUidToBeUpdated ].props[ propertyUid ] = xrtVMO.props[ propertyUid ].displayValues;
        }
    } );

    // Update atomic data
    vmVariabilityProps.update( variabilityProps );

    // Update Data provider (columnConfig) with updated Properties Information
    let colToBeUpdated = _.find( treeDataProvider.columnConfig.columns, { uid: constraintUidToBeUpdated } );
    _.forOwn( colToBeUpdated.props, ( propValue, propKey ) => {
        if( xrtVMO.props[ propKey ] ) {
            propValue.propDisplayValue = xrtVMO.props[ propKey ].displayValues[ 0 ];
        }
    } );

    // Update Data provider (ViewModelObject collection) with values we received in eventData.
    if( gridSettings.showPropsInfoInGrid ) {
        let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        let updatedVMOs = [ ...vmos ];
        _.forEach( updatedVMOs, vmo => {
            if( propertyUids.includes( vmo.uid ) ) {
                vmo.props[ constraintUidToBeUpdated ].prevDisplayValues = xrtVMO.props[ vmo.uid ].prevDisplayValues;
                vmo.props[ constraintUidToBeUpdated ].displayValues = xrtVMO.props[ vmo.uid ].displayValues;
                vmo.props[ constraintUidToBeUpdated ].dbValue = xrtVMO.props[ vmo.uid ].displayValues;
                vmo.props[ constraintUidToBeUpdated ].value = xrtVMO.props[ vmo.uid ].value;
                vmo.props[ constraintUidToBeUpdated ].uiValue = xrtVMO.props[ vmo.uid ].uiValue;
            }
        } );
        treeDataProvider.update( updatedVMOs );
    }
};

/**
 * Display error message when number of constraints selected exceeds 500.
 * There are performance reasons:
 * 1- Server can take lot of time to return expressions.
 * 2- AW client can go out of memory while rendering response.
 * Once this message is shown, we set ConfiguratorContext as Selected object and show empty grid.
 */
export let showMessageIfLargeNumberOfConstraintsSelected = function() {
    let configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let configuratorContextUID = configContext.configPerspective.props.cfg0ProductItems.dbValues[ 0 ];
    let configContextVmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( configuratorContextUID ), 'EDIT' );

    let selectedVmos = [];
    selectedVmos.push( configContextVmo );

    appCtxService.updateCtx( 'selected', selectedVmos );
    appCtxService.updateCtx( 'mselected', selectedVmos );

    configuratorUtils.showNotificationMessage( localeService.getLoadedText( 'ConfiguratorExplorerMessages' ).Pca0NoOfConstraintsInGridEditor, 'ERROR' );
};

/**
 * Get Perspective information for getVariantExpressionData4 SOA Input
 * @returns {Object} Configurator Perspective
 */
/**
 * Return Perspective information for getVariantExpressionData4 SOA Input
 * @param { String } contextKey - To get data related to context string
 * @returns {Object} Perspective Object
 */
export let getConfigPerspective = () => {
    return pca0CommonUtils.getConfigPerspective( veConstants.CONFIG_CONTEXT_KEY );
};

/**
 * Get RequestInfo for Validation according to requested type of Validation (Initial vs Column)
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} action - The action performed (e.g. 'Initial Validate')
 * @param {Object} topGridSelectionMap - selectionMap for top grid
 * @param {Object} bottomGridSelectionMap - selectionMap for bottom grid
 * @param {Object} loadedObjects - objects loaded in the grid editor
 * @param {Object} arithmeticRuleValidationProps - properties for arithmetic rule validation
 * @returns {Object} RequestInfo with RequestType string for Product Configuration Validation
 */
export let getRequestInfoForValidation = function( validationProps, action, topGridSelectionMap, bottomGridSelectionMap, loadedObjects, arithmeticRuleValidationProps ) {
    let requestInfo = {
        ignoreSelectedExpressions: [ 'true' ]
    };
    if( action === pca0CommonConstants.EXPRESSION_VALIDATE.INITIAL_VALIDATE ) {
        delete validationProps.columnValidation;
        delete validationProps.columnToValidationMap;
        const loadedRulesUid = _getLoadedRulesUidForConstraintsGrid( topGridSelectionMap );

        // Filter selected Objects having selections authored
        let filteredRules = _.filter( loadedRulesUid, loadedRuleUid => {
            return _isColumnWithEditsInMaps( loadedRuleUid, topGridSelectionMap, bottomGridSelectionMap );
        } );

        filteredRules = _filterArithmeticConstraints( filteredRules, loadedObjects, arithmeticRuleValidationProps );

        _.set( requestInfo, 'requestType', [ pca0Constants.REQ_TYPE_INITIAL_VALIDATION ] );
        _.set( requestInfo, 'configurableObject', filteredRules );
    } else if( action === pca0CommonConstants.EXPRESSION_VALIDATE.VERBOSE_VALIDATE ) {
        _.set( requestInfo, 'configurableObject', [ validationProps.columnValidation.uid ] );
    }
    return requestInfo;
};

/**
 * Set flag on each column definition based on presence of selections in both grids
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 * @param {Object} topGridSelectionMap - selection Map for top grid
 * @param {Object} bottomGridSelectionMap - selection Map for bottom grid
 * @returns {Object} updated columnConfig
 */
export let markEmptyColumns = ( treeDataProvider, topGridSelectionMap, bottomGridSelectionMap ) => {
    let columns = [ ...treeDataProvider.columnConfig.columns ];
    columns.forEach( columnDef => {
        if( !columnDef.isColumnFromCots ) {
            columnDef.hasNoSelections = !_isColumnWithEditsInMaps( columnDef.uid, topGridSelectionMap, bottomGridSelectionMap );
        }
    } );
    return {
        treeColumnConfig: {
            columns: columns
        }
    };
};

/**
 * Action "Clear" selections on column
 * Verify if selections can be cleared - do not proceed for non editable section on Split Column
 * Call utility to update data provider
 * Update DirtyElements and dispatch changes on atomic Data
 * @param {Object} vmVariabilityProps ViewModel Atomic data <variabilityProps>
 * @param {Object} vmGridSettings ViewModel Atomic data gridSettings>
 * @param {UwDataProvider} treeDataProvider data provider
 * @param {Object} vmGridData ViewModel Atomic data top/bottom grid
 * @param {Object} eventData event data info container
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 * @param {Array} matrixRuleLovDelimiters - List of Subject Delimiters for Matrix Rules (to be updated when provided by SOA response)
 */
export let clearColumnSelections = ( vmVariabilityProps, vmGridSettings, treeDataProvider, vmGridData, eventData, gridEditorMode, matrixRuleLovDelimiters ) => {
    let columnUID = eventData.column.field;

    // VariabilityProps/GridSettings/GridData come as:
    // - props (value/update) from topGrid
    // - atomicData (get/set AtomicData) from bottomGrid
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    const columnProps = _.find( variabilityProps.columnProperties, { propertyUid: columnUID } );
    let gridSettings = vmGridSettings.getValue ? { ...vmGridSettings.getValue() } : { ...vmGridSettings.getAtomicData() };
    let gridData = vmGridData.getValue ? { ...vmGridData.getValue() } : { ...vmGridData.getAtomicData() };

    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let canClearSelections = _canApplySelectionsOnColumn( columnProps, variabilityProps.splitColumnsMap, treeDataProvider.name, gridSettings.showSubjectInTopGrid );

    if( canClearSelections ) {
        // Sync Edit Mode is only needed when authoring non-Matrix rules
        // When authoring Matrix Rules, 'Clear' action is allowed only when EditMode is already active
        if( !isSnOMatrixGridEditor ) {
            let canEdit = pca0CommonUtils.handleEditModeSync( veConstants.CONFIG_CONTEXT_KEY, false );
            if( !canEdit ) {
                return;
            }
        }
        // Call Util from pca0GridAuthoring to reset VMOs selections in DataProvider and get updated selection map
        eventData.gridEditorData = {
            isSnOMatrixGridEditor: isSnOMatrixGridEditor,
            splitColumns: _getSplitColumnsToApplySelections( columnProps, variabilityProps.splitColumnsMap, treeDataProvider.name, gridSettings.showSubjectInTopGrid )
        };

        pca0GridAuthoringService.clearColumnSelections( treeDataProvider, gridData.businessObjectToSelectionMap, eventData );

        // Dispatch changes on grid data
        vmGridData.update ? vmGridData.update( gridData ) : vmGridData.setAtomicData( gridData );

        // Trigger Summary update
        pca0GridCommonUtils.updateAllNodesSummary(
            treeDataProvider, gridData.businessObjectToSelectionMap, gridData.viewModelObjectMap, false, matrixRuleLovDelimiters );

        // Process Dirty Elements
        variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
            // For top and bottom grid selection changes, keep on collecting updated constraints.
            variabilityProps.dirtyElements, // currentDirtyElements
            gridData.businessObjectToSelectionMap, // selection map
            gridData.backupOfBusinessObjectToSelectionMap // backup selection map
        );

        // Dispatch changes on Variability Props
        vmVariabilityProps.update ? vmVariabilityProps.update( variabilityProps ) : vmVariabilityProps.setAtomicData( variabilityProps );
    }
};

/**
 * Action "Copy" selections from column
 * Copy selections from Top/Bottom grid for the given column
 * @param {Object} vmTopGridData - View Model Atomic Data <topGrid>
 * @param {Object} vmBottomGridData - View Model Atomic Data <bottomGrid>
 * @param {Object} eventData - data carried by Copy trigger event
 */
export let copyColumnSelections = ( vmTopGridData, vmBottomGridData, eventData ) => {
    let topGridData = vmTopGridData.getAtomicData();
    let topGridSelectionMap = topGridData.businessObjectToSelectionMap;
    let bottomGridData = vmBottomGridData.getAtomicData();
    let bottomGridSelectionMap = bottomGridData.businessObjectToSelectionMap;
    let columnUid = eventData.column.field;
    let topColumnSelections = { ...topGridSelectionMap[ columnUid ] };
    let bottomColumnSelections = { ...bottomGridSelectionMap[ columnUid ] };
    let copiedSelectionsCache = {
        topGrid: {},
        bottomGrid: {}
    };
    if( Object.keys( topColumnSelections ).length > 0 ) {
        copiedSelectionsCache.topGrid = topColumnSelections;
    }
    if( Object.keys( bottomColumnSelections ).length > 0 ) {
        copiedSelectionsCache.bottomGrid = bottomColumnSelections;
    }

    // [Note] copied selections are saved on global app context to be easily accessible from commandsViewModel
    // in commandsViewModel we validate if cache is initialized/contains data
    // If such info container is part of atomic data, unlike from command-bar, it cannot be accessed from handler of column menu action
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY + '.copiedSelectionsCache', copiedSelectionsCache );
};

/**
 * Action "Paste" selections on column for Top/Bottom grid
 * Paste copied selections on given column
 * Verify if selections can be applied - do not proceed for non editable section on Split Column
 * Call utility to update data provider and dispatch changes on atomic Data
 * @param {Object} vmVariabilityProps ViewModel Atomic data <variabilityProps>
 * @param {Object} vmGridSettings ViewModel Atomic data gridSettings>
 * @param {UwDataProvider} treeDataProvider data provider
 * @param {Object} vmGridData ViewModel Atomic data top/bottom grid
 * @param {Object} eventData event data info container
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 */
export let pasteSelectionsOnColumn = ( vmVariabilityProps, vmGridSettings, treeDataProvider, vmGridData, eventData, gridEditorMode ) => {
    let columnUID = eventData.column.field;

    // VariabilityProps/GridSettings/GridData come as:
    // - props (value/update) from topGrid
    // - atomicData (get/set AtomicData) from bottomGrid
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    const columnProps = _.find( variabilityProps.columnProperties, { propertyUid: columnUID } );
    let gridSettings = vmGridSettings.getValue ? { ...vmGridSettings.getValue() } : { ...vmGridSettings.getAtomicData() };
    let gridData = vmGridData.getValue ? { ...vmGridData.getValue() } : { ...vmGridData.getAtomicData() };

    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let canApplySelections = _canApplySelectionsOnColumn( columnProps, variabilityProps.splitColumnsMap, treeDataProvider.name, gridSettings.showSubjectInTopGrid );

    if( canApplySelections ) {
        // Sync Edit Mode is only needed when authoring non-Matrix rules
        // When authoring Matrix Rules, 'Paste' action is allowed only when EditMode is already active
        if( !isSnOMatrixGridEditor ) {
            let canEdit = pca0CommonUtils.handleEditModeSync( veConstants.CONFIG_CONTEXT_KEY, false );
            if( !canEdit ) {
                return;
            }
        }

        let copiedSelectionsCache = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY + '.copiedSelectionsCache' );
        let copiedSelections = treeDataProvider.name === veConstants.GRID_CONSTANTS.PCA_GRID_DP ? copiedSelectionsCache.topGrid :
            copiedSelectionsCache.bottomGrid;

        // Call Util from pca0GridAuthoring to reset VMOs selections in DataProvider and get updated selection map
        eventData.gridEditorData = {
            isSnOMatrixGridEditor: isSnOMatrixGridEditor,
            splitColumns: _getSplitColumnsToApplySelections( columnProps, variabilityProps.splitColumnsMap, treeDataProvider.name, gridSettings.showSubjectInTopGrid )
        };
        pca0GridAuthoringService.pasteSelectionsOnColumn( treeDataProvider, gridData.businessObjectToSelectionMap, eventData, copiedSelections );

        // Dispatch changes on grid data
        vmGridData.update ? vmGridData.update( gridData ) : vmGridData.setAtomicData( gridData );

        // Trigger Summary update
        pca0GridCommonUtils.updateAllNodesSummary(
            treeDataProvider, gridData.businessObjectToSelectionMap, gridData.viewModelObjectMap, false );

        // Process Dirty Elements
        variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
            // For top and bottom grid selection changes, keep on collecting updated constraints.
            variabilityProps.dirtyElements, // currentDirtyElements
            gridData.businessObjectToSelectionMap, // selection map
            gridData.backupOfBusinessObjectToSelectionMap // backup selection map
        );

        // Dispatch changes on Variability Props
        vmVariabilityProps.update ? vmVariabilityProps.update( variabilityProps ) : vmVariabilityProps.setAtomicData( variabilityProps );
    }
};

/**
 * Scenario: Matrix Rules
 * Handle Authoring through selection changed via Dropdown
 * Handle EditMode change if needed, update selectionMap and VMO props
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} lovSelectionData - event info data container
 * @param {UwDataProvider} treeDataProvider - DataProvider which VMO triggering the action belongs to
 * @param {Object} vmGridData - atomic data <gridData>
 */
export let handleCellEditByLOVSelection = ( vmVariabilityProps, lovSelectionData, treeDataProvider, vmGridData ) => {
    // Sync Edit Mode
    let canEdit = pca0CommonUtils.handleEditModeSync( veConstants.CONFIG_CONTEXT_KEY, true );
    // NOTE: Drop down is activated by "DirectEdit"
    // Framework is handling the leaveConfirmation upon cell click in the grid
    if( !canEdit ) {
        return;
    }

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let vmo = _.find( vmos, { alternateID: lovSelectionData.vmo.alternateID } );
    let selectedItem = lovSelectionData.selectedObjects[ 0 ];
    let newSelectionStateDbValue = _.isUndefined( selectedItem.selectionState ) ? 0 : selectedItem.selectionState;

    // Update selection Map
    let eventData = {
        gridId: treeDataProvider.json.gridId,
        vmo: vmo,
        columnField: lovSelectionData.viewModelProp.propertyName,
        dbValue: newSelectionStateDbValue,
        // Set freeStandingSelection to true: selections on families do not impact selections on features
        freeStandingSelection: true,
        isColumnAction: false
    };
    let updatedVariabilityProps = pca0GridAuthoringService.populateUserEdits(
        vmVariabilityProps, // vmVariabilityProps
        eventData, // eventData
        vmGridData // gridData
    );

    // Update variabilityProps (dirtyElements)
    vmVariabilityProps.setAtomicData( updatedVariabilityProps );

    // Call API to update VMO props/flags
    pca0GridAuthoringService.updateVMOByDropdownSelection( lovSelectionData, treeDataProvider );
};

/**
 * Process incoming eventData and keep trace of action completeness in all grids.
 * Applicability: new column (constraint) added.
 * @param {eventData} eventData - eventData info container for the grid completing the action
 * @returns {Boolean} true if action has completed in all (top/bottom) grids
 */
export let validateActionCompleteInAllGrids = eventData => {
    if( eventData.gridID === veConstants.GRID_CONSTANTS.PCA_GRID ) {
        _topGridActionComplete = true;
    } else {
        _bottomGridActionComplete = true;
    }

    return _topGridActionComplete && _bottomGridActionComplete;
};

/**
 * Call cancelEdits on editHandler. This will trigger the reset of editable states and reload of vmos.
 * @param {Object} editHandler constraints edit handler
 */
export let callCancelEditsOnEditHandler = editHandler => {
    editHandler.cancelEdits();
};

/**
 * Call saveEditsPostActions on editHandler. This will update VMOs inner properties when Edit mode is deactivated.
 * @param {Object} editHandler constraints edit handler
 */
export let callSaveEditsPostActionsOnEditHandler = editHandler => {
    editHandler.saveEditsPostActions( true );
};
/**
 * This function adds the uid of newly created constraints in session storage and update it, so that new constraint is visible in pwa of new tab.
 * @param {Array} createdConstraintUids - uids of newly created constraints.
 */
export let addNewConstraintsInSelectedObjectsOfSessionStorage = ( createdConstraintUids ) => {
    let newConstraintsUidsToAdd = [];

    // Iterate through createdConstraintUids and remove modelObjects of "Cfg0AbsRuleThread"
    for( let modelObject in createdConstraintUids ) {
        if( !createdConstraintUids[ modelObject ].modelType.typeHierarchyArray.includes( 'Cfg0AbsRuleThread' ) ) {
            newConstraintsUidsToAdd.push( createdConstraintUids[ modelObject ].uid );
        }
    }

    // Get previously selected object uid's from session storage
    let selectedObjectUidsFromSession = sessionStorage.getItem( 'Cfg0SelectedObjUids' );

    let newSelectedObjectUids = JSON.parse( selectedObjectUidsFromSession ) ?? [];

    newSelectedObjectUids.push( ...newConstraintsUidsToAdd );

    // Set selected object uid's in session storage
    sessionStorage.setItem( 'Cfg0SelectedObjUids', JSON.stringify( newSelectedObjectUids ) );
};

/**
 * This function will add the newly created constraints in constraints table.
 * Add it on top in primary work area table and append the selection.
 *@param {object} modelObjects modelObjects containing newly created constraints
 * @param {Object} dataProvider dataProvider which needs to be updated
 * @param {Number} totalFound total number of constraints found
 * @param {Array} newlyCreatedObjUids newly created constraints object uids
 * @param {Boolean} isSaveAsAction - true if action is SaveAs, Setting the default value to false.
 * @returns {Object} updated totalFound and newlyCreatedObjUids
 */
export let addCreatedConstraintsToPWA = ( modelObjects, dataProvider, totalFound, newlyCreatedObjUids, isSaveAsAction = false ) => {
    let createdConstraints = modelObjects.objects;
    let constraints = [ ...dataProvider.viewModelCollection.loadedVMObjects ];
    // Add newly created constraints on top in primary work area table
    constraints.unshift( ...createdConstraints );
    dataProvider.update( constraints, totalFound + createdConstraints.length );
    const uids = createdConstraints.map( constraint => constraint.uid );
    if( isSaveAsAction ) {
        // In case of saveAs set the selection with newly created constraints
        dataProvider.selectionModel.setSelection( [ ...uids ] );
    } else {
        // append the selection with newly created constraints
        dataProvider.selectionModel.setSelection( [ ...dataProvider.selectionModel.getSelection(), ...uids ] );
    }
    // Scroll to the newly created constraints
    pca0CommonUtils.scrollToRow( 'pca0ConstraintsGrid', uids );
    totalFound += createdConstraints.length;
    newlyCreatedObjUids.push( ...uids );
    return {
        totalFound: totalFound,
        newlyCreatedObjUids: newlyCreatedObjUids
    };
};

/**
 * This function updates the bottom grid column config based on the top grid column config
 * after columns arrange / column config changes are done for top grid or any new column is
 * added into the top grid. 
 * Instead of directly assigning the column config from top grid to bottom grid,
 * we selectively update the cellRenderers of matching columns. So that bottom grid cells are renderered properly.
 * 
 * @param {Object} topGridColumnConfig - Column config of top grid
 * @param {Object} bottomGridColumnConfig - Column config of bottom grid
 * @returns {Object} Updated bottom grid column config
 */
export let updateBottomGridColumnConfig = ( topGridColumnConfig, bottomGridColumnConfig ) => {
    // Created a map<colName,col> for columns in bottomGridColumnConfig for quick lookup
    const nameToColumnMap = new Map( bottomGridColumnConfig.columns.map( col => [ col.propertyName, col ] ) );

    // Iterate through topGridColumnConfig and update the cell renderer of matching columns
    const updatedColumns = topGridColumnConfig.columns.map( col => {
        const columnAlreadyPresentInBotttomGrid = nameToColumnMap.get( col.propertyName );
        if ( columnAlreadyPresentInBotttomGrid ) {
            // Return a new object with updated cellRenderer
            return { ...col, cellRenderers: [ ...columnAlreadyPresentInBotttomGrid.cellRenderers ] }; // overwrite cellRenderer
        }
        // If no match, keep col as is
        return { ...col };
    } );

    // Update bottom grid column config
    bottomGridColumnConfig.columns = updatedColumns;
    return bottomGridColumnConfig;
};

export default exports = {
    initConstraintsGridEditor,
    saveEditsCallback,
    initGridData,
    registerScrollSync,
    gridUnmount,
    prepareSOAInputToGetConstraints,
    handleExpandCollapseAllActionForConstraints,
    postProcessSettingsChanged,
    processConstraintsData,
    postProcessLOVsForMatrix,
    updateTopTableHeight,
    preProcessConstraintsExpressionsForSaveAction,
    handleCancel,
    removeSplitColumns,
    getSaveHandler,
    handleStartEdits,
    enforceStartEdits,
    postProcessSaveEdits,
    initializeAddVariabilityDialogData,
    openAddConstraintPanel,
    getInputForApplicableTypes,
    cacheLoadedConstraintTypes,
    getConstraintGridEditorPolicyTypes,
    getConstraintCreateInput,
    getCreatedConstraints,
    postProcessCreatedConstraint,
    updateConstraintPropertiesInformation,
    showMessageIfLargeNumberOfConstraintsSelected,
    getConfigPerspective,
    getRequestInfoForValidation,
    markEmptyColumns,
    clearColumnSelections,
    copyColumnSelections,
    pasteSelectionsOnColumn,
    handleCellEditByLOVSelection,
    validateActionCompleteInAllGrids,
    callCancelEditsOnEditHandler,
    callSaveEditsPostActionsOnEditHandler,
    addNewConstraintsInSelectedObjectsOfSessionStorage,
    addCreatedConstraintsToPWA,
    updateBottomGridColumnConfig
};
