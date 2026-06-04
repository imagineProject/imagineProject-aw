// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ConstraintsDisplayService
 */
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import editHandlerService from 'js/editHandlerService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0RendererService from 'js/pca0RendererService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import _ from 'lodash';

/**
 * Local Util Methods
 */

/**
 * Util to create properties info container for the Constraint column
 * This is used By Tree Header module to render header cell
 * @param {Object} column Column
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 */
let _createConstraintColumnProps = ( column, variabilityData ) => {
    // Build locale Text bundle for 'Properties Information'
    let localePropInfoMap = pca0GridCommonUtils.getPropInfoFromSOAResponse( variabilityData.soaResponse );

    if( !_.isUndefined( column.newConstraintColumnProps ) &&
        Object.keys( column.newConstraintColumnProps ).length !== 0 ) {
        // Use props as coming from 'createRelateAndSubmitObjects' soa response.ServiceData
        // These props have been already processed
        column.props = { ...column.newConstraintColumnProps };
    } else {
        // AW Server is sending props with localized value, e.g.: {object_type:['Localized Constraint Type']}
        // Re-arrange structure to accommodate localized Property Display Name, e.g.:
        // {object_type: {propDisplayName: 'Type', propDisplayValue: 'Localized Constraint Type', sourceType:'Cfg0DefaultRule'}}
        let columnProps = {};
        let awServerColumnProps = _.get( variabilityData, 'soaResponse.viewModelObjectMap.' + column.name + '.props' );
        if( awServerColumnProps ) {
            let relatedObj = cdm.getObject( column.name );
            Object.entries( awServerColumnProps ).forEach( ( [ internalPropKey, propValue ] ) => {
                columnProps[ internalPropKey ] = {
                    propDisplayName: localePropInfoMap[ internalPropKey ],
                    propDisplayValue: propValue[ 0 ]
                };

                // For Constraint Type, get internal Type
                // Use ClientDataModel utility to get Parent Abstract Class
                if( internalPropKey === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID && !_.isUndefined( relatedObj ) ) {
                    columnProps[ internalPropKey ].parentAbstractClass = relatedObj.modelType.parentTypeName;
                }
            } );

            // If object_type property is not present in COTS.xml, we need to add the
            // prop in columnProps separately as we need it to show the object_type in column header
            if( !( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID in columnProps ) && !_.isUndefined( relatedObj ) ) {
                columnProps[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] = {
                    propDisplayName: relatedObj.props.object_type.propertyDescriptor.displayName,
                    propDisplayValue: relatedObj.props.object_type.uiValues[ 0 ],
                    parentAbstractClass: relatedObj.modelType.parentTypeName,
                    isPropertyNotFromCots: true // This property is not present in COTS file
                };
            }
        }
        column.props = columnProps;
    }
};

/**
 * Set height of top/bottom table when Work with features is toggled on
 * When top/bottom is expanded, set height of both the tables to acquire 50% of the available space
 * @param {Boolean} isTopGrid - true if topGrid is expanded else false
 * @param {Boolean} tableInformation - table information
 */
const _setTableHeight = ( isTopGrid, tableInformation ) => {
    let topTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-topTreeHeight' );
    let bottomTreeTableRowElement = document.getElementsByClassName( 'aw-cfg-bottomTreeHeight' );
    var configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( configContext.getUseAllVariabilityInGridEditor ) {
        if( isTopGrid === true ) {
            // Expanding top grid
            // Bottom table is assigned 50% if it's expanded, 10% otherwise
            if( tableInformation.topTableExpanded ) {
                bottomTreeTableRowElement[ 0 ].style.height = tableInformation.bottomTableExpanded ? '50%' : '10%';
            } else {
                // Collapsing top grid
                bottomTreeTableRowElement[ 0 ].style.height = '90%';
            }
        } else {
            // Expanding bottom grid
            // Bottom table is assigned 50% if top is expanded, 90% otherwise
            if( tableInformation.bottomTableExpanded ) {
                topTreeTableRowElement[ 0 ].style.maxHeight = '50%';
                bottomTreeTableRowElement[ 0 ].style.height = tableInformation.topTableExpanded ? '50%' : '90%';
            } else {
                // Collapsing top grid
                topTreeTableRowElement[ 0 ].style.maxHeight = '100%';
                bottomTreeTableRowElement[ 0 ].style.height = '10%';
            }
        }
    }
};

/**
 * Update table expansion/collapse information
 * @param {Object} tableInformation - View Model Atomic Data <variabilityProps>
 * @param {Boolean} isTopGrid - true if topGrid is expanded/collapsed else false
 * @param {Boolean} isExpanded true if the table is expanded
 */
let _updateTableExpansionCollapse = ( tableInformation, isTopGrid, isExpanded ) => {
    if( isTopGrid ) {
        tableInformation.topTableExpanded = isExpanded;
    } else {
        tableInformation.bottomTableExpanded = isExpanded;
    }
};

/**
 * Return the assigned cell Renderer for the column
 * @param {Boolean} isSnOMatrixGridEditor true if authoring Matrix Rules
 * @param {Boolean} isSubjectSectionForMatrixRule true if authoring Matrix Rules and column belongs to Subject section
 * @param {Object} vmGridData - View Model Atomic Data <top/bottom grid data>
 * @param {Function} cellClickCallback handleCell click callback
 * @param {UwDataProvider} gridDataProvider - DataProvider
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @returns {Object} Cell renderer
 */
let _getColumnCellRenderer = ( isSnOMatrixGridEditor, isSubjectSectionForMatrixRule, vmGridData, cellClickCallback, gridDataProvider, vmGridSelectionState, vmVariabilityProps ) => {
    if( isSubjectSectionForMatrixRule ) {
        // Add 'LOV' cell renderer for Matrix Grid - Subject section
        return pca0RendererService.lovMatrixCellRenderer( vmVariabilityProps, vmGridData );
    }
    // Add generic 'icon' cell renderer
    return pca0RendererService.iconCellRenderer(
        cellClickCallback, // cell Click handler
        veConstants.CONFIG_CONTEXT_KEY, // contextKey
        gridDataProvider, // treeDataProvider
        vmGridSelectionState, // grid Selection State
        isSnOMatrixGridEditor // isSnOMatrixGridEditor
    );
};

/**
 * Set Cell Renderers for the input column
 * @param {Object} columnDef input Column Definition
 * @param {Object} columnProps collection of properties with cellRenderers to be copied to new column
 * @param {Object} columnCellRenderer column Cell Renderer to be copied to input column Definition
 */
let _setColumnCellRenderer = ( columnDef, columnProps, columnCellRenderer ) => {
    if( !_.isUndefined( columnProps.cellRenderers ) ) {
        columnDef.cellRenderers = [ ...columnProps.cellRenderers ];
    }
    columnDef.cellRenderers.push( columnCellRenderer );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Return filter string for Constraint Grid SOA call
 * If the constraintsGridSetting is false then return 'pca0_show_current'
 * If the constraintsGridSetting is true then based on the active display mode return the filter accordingly
 * @param {Object} displayMode - Constraints Grid Editor active Display Mode
 * @returns {String} filter string
 */
export let getGridOptionFiltersForConstraintGrid = ( displayMode ) => {
    var configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( configContext.getUseAllVariabilityInGridEditor && displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FEATURES ) {
        return 'pca0_show_all';
    }
    return 'pca0_show_current';
};

/**
 * Function to populate selected object for Constraints Grid Editor.
 * @return {Array} Selected objects in Primary work Area.
 * If Cfg0ProductItem or Cfg0Dictionary is selected, then it returns empty array.
 */
export let getSelectedObjectsForConstraintsGrid = () => {
    let selectedObjectsInPWA = pca0CommonUtils.getSelectedObjectsForSOA( veConstants.CONSTRAINTS_CONTEXT_KEY );
    let configuratorContextFound = false;
    // There is no possibility that we will get more than 1 selected objects where one of the object is Cfg0ProductItem or Cfg0Dictionary.
    if( selectedObjectsInPWA.length === 1 && ( selectedObjectsInPWA[ 0 ].type === pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM ||
            selectedObjectsInPWA[ 0 ].type === pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY ) ) {
        configuratorContextFound = true;
    }
    return configuratorContextFound === true ? [] : selectedObjectsInPWA;
};

/**
 * Handle click event on the cell
 * @param {String} contextKey - the Context key
 *  @param {Object} cellDetails - info container with cell details (cell element, vmo, column and DataProvider)
 *  @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 */
export let constraintHandleCellClick = ( contextKey, cellDetails, vmGridSelectionState, gridEditorMode ) => {
    // Set active Edit Handler Context to Constraints Editor Tree Context when a cell in the Constraints Grid Editor is clicked.
    // This is necessary for the following scenario:
    // If we are in the constraints grid editor and initiate an edit, then cancel the edits in PWA, the active edit handler context switches to PWA.
    // Therefore, to receive the unsaved notification message, we need to reset the active edit handler context to Constraints Editor Tree Context when a cell in the constraints grid editor is clicked.
    let activeEditHandler = editHandlerService.getActiveEditHandler();
    let gridEditorEditHandler = editHandlerService.getEditHandler( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );
    if( _.isNull( activeEditHandler ) || !activeEditHandler._editing && !_.isEqual( activeEditHandler, gridEditorEditHandler ) ) {
        editHandlerService.setActiveEditHandlerContext( veConstants.GRID_CONSTANTS.CONSTRAINTS_EDITOR_TREE_CONTEXT );

        // Set editOptions. This is for single/double click on cell
        // If we do not set editOptions, editHandlerService will consider it as a full (bulk) edit mode
        let editOptions = {
            vmos: [ cellDetails.vmo ],
            propertyNames: [ cellDetails.column.uid ]
        };
        gridEditorEditHandler.startEdit( editOptions );
    }
    pca0GridAuthoringService.handleCellClick( contextKey, cellDetails, vmGridSelectionState, gridEditorMode );
};

/**
 * Add split column information to variability map:
 * - Update map of split column IDs
 * - Create new column definition in atomic data [columnProperties]
 * - Add new entry in selection map for top/bottom grids
 * @param {Object} eventData - data carried by validate trigger event
 * @param {Object} vmGridSettingsData - View Model Atomic Data <gridSettings>
 * @param {Object} vmTopGridData - View Model Atomic Data <topGrid>
 * @param {Object} vmBottomGridData - View Model Atomic Data <bottomGrid>
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 */
export let createSplitColumn = function( eventData, vmGridSettingsData, vmTopGridData, vmBottomGridData, vmVariabilityProps ) {
    // Clone current status for VM data and fields (atomic data)
    let gridSettingsData = { ...vmGridSettingsData.getAtomicData() };
    let topGridData = { ...vmTopGridData.getAtomicData() };
    let bottomGridData = { ...vmBottomGridData.getAtomicData() };
    var variabilityProps = { ...vmVariabilityProps.getAtomicData() };

    let splitColumnProps = eventData.columnDef;
    splitColumnProps.enableColumnMenu = true;
    splitColumnProps.gridID = pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID;

    // Set width based on Settings
    splitColumnProps.columnWidth = gridSettingsData.useCompactColumnWidth ?
        pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH :
        gridSettingsData.columnWidth;

    let originalColumnName = splitColumnProps.originalColumnName;
    let splitColumnUID = splitColumnProps.propertyUid;

    // Update Map of Split Columns
    if( !variabilityProps.splitColumnsMap[ originalColumnName ] ) {
        variabilityProps.splitColumnsMap[ originalColumnName ] = [];
    }
    variabilityProps.splitColumnsMap[ originalColumnName ].push( {
        uid: splitColumnUID,
        isSplitSubject: splitColumnProps.isSplitSubject
    } );

    // Update list of new constraints
    // This is needed when creating propertyMap on each VMO
    variabilityProps.newConstraints.push( { isSplitColumn: true, propertyUid: splitColumnUID, originalColumnName: originalColumnName, isSplitSubject: splitColumnProps.isSplitSubject } );

    // Update columnProperties on variabilityProps
    // 1 - update Original Column Definition to mark a split action is active
    // 2 - add new SplitColumn Def to the array
    let columnProperties = [ ...variabilityProps.columnProperties ];
    let originalColumnDef = _.find( variabilityProps.columnProperties, { propertyUid: originalColumnName } );
    originalColumnDef.hasSplitSubject = splitColumnProps.isSplitSubject;

    // NOTE: we use '-1' as index was calculated as columnDef.index is based on an array including variabilityContent column
    columnProperties.splice( eventData.newColumnIndexToInsert - variabilityProps.soaResponse.variabilityPropertiesToDisplay.length - 1, 0, splitColumnProps );
    variabilityProps.columnProperties = columnProperties;

    // Update selection maps:
    // - add entry to selectionMap of top/bottom grids
    // // - copy over non-editable selections
    //   so they won't be sent to server on Save
    topGridData.businessObjectToSelectionMap[ splitColumnUID ] = {};
    bottomGridData.businessObjectToSelectionMap[ splitColumnUID ] = {};
    let sourceSelectionMap;
    if( /*Copy over Condition expressions in bottom grid if split subject and subject is in top grid*/
        splitColumnProps.isSplitSubject && gridSettingsData.showSubjectInTopGrid ||
        /*Copy over Subject expressions in bottom grid if split condition and subject is in bottom grid*/
        !splitColumnProps.isSplitSubject && !gridSettingsData.showSubjectInTopGrid
    ) {
        sourceSelectionMap = _.cloneDeep( bottomGridData.businessObjectToSelectionMap[ originalColumnName ] ); // {...} is not enough
        bottomGridData.businessObjectToSelectionMap[ splitColumnUID ] = sourceSelectionMap;
        bottomGridData.backupOfBusinessObjectToSelectionMap[ splitColumnUID ] = { ...sourceSelectionMap };
    } else {
        // Copy over Condition expressions in top grid if split subject and subject is in bottom grid OR
        // Copy over Subject expressions in top grid if split condition and subject is in top grid
        sourceSelectionMap = _.cloneDeep( topGridData.businessObjectToSelectionMap[ originalColumnName ] ); // {...} is not enough
        topGridData.businessObjectToSelectionMap[ splitColumnUID ] = sourceSelectionMap;
        topGridData.backupOfBusinessObjectToSelectionMap[ splitColumnUID ] = { ...sourceSelectionMap };
    }

    // Update AtomicData
    vmVariabilityProps.setAtomicData( variabilityProps );
    vmTopGridData.setAtomicData( topGridData );
    vmBottomGridData.setAtomicData( bottomGridData );
};

/**
 * Update ViewModel Collection for the Data Provider
 * Add new Split Column in the props list of each ViewModel Object node
 * Copy selections from original column when needed
 * Update Column Config
 * @param {String} splitColumnUID unique identifier of new Split Column
 * @param {UwDataProvider} treeDataProvider - Tree Data Provider
 * @param {Object} vmGridData View Model Atomic Data <topGrid>/<bottomGrid>
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let addSplitColumnToGrid = function( splitColumnUID, treeDataProvider, vmGridData, vmVariabilityProps, vmGridSelectionState ) {
    let gridData = vmGridData.getAtomicData ? vmGridData.getAtomicData() : vmGridData.getValue();
    let variabilityProps = vmVariabilityProps.getAtomicData ? vmVariabilityProps.getAtomicData() : vmVariabilityProps.getValue();
    let splitColumnIndex = _.findIndex( variabilityProps.columnProperties, { propertyUid: splitColumnUID } );
    let splitColumnProps = variabilityProps.columnProperties[ splitColumnIndex ];
    let originalColumnName = splitColumnProps.originalColumnName;
    let isSubjectGrid = gridData.gridNodes.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID );

    // Special flag for read-only copied selections from original column
    let isSectionReadOnly = splitColumnProps.isSplitSubject && !isSubjectGrid ||
        !splitColumnProps.isSplitSubject && isSubjectGrid;

    // Add new Split column to ViewModelCollection and update column Config
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, vmo => {
        vmo.props[ splitColumnUID ] = pca0CommonUtils.getViewModelProperty(
            splitColumnUID, // name
            vmo.parentUID, // parentUid
            isSectionReadOnly ? vmo.props[ originalColumnName ].dbValue : 0, // propertyValue
            { isSplitCellEditDisabled: isSectionReadOnly } // props
        );
    } );

    // Create new column definition for new constraint
    let splitColumnDef = pca0VariabilityTreeDisplayService.createColumnDef( splitColumnProps, veConstants.CONFIG_CONTEXT_KEY, treeDataProvider, vmGridSelectionState );
    let newColumnInfos = [ ...treeDataProvider.columnConfig.columns ];
    const serverColumnCount = _.countBy( newColumnInfos, 'isColumnFromCots' ).true || 0;
    newColumnInfos.splice( splitColumnIndex + variabilityProps.soaResponse.variabilityPropertiesToDisplay.length + serverColumnCount, 0,
        splitColumnDef );

    // Update property on original column
    let originalColumnDef = _.find( newColumnInfos, { uid: originalColumnName } );
    let originalColumnProps = _.find( variabilityProps.columnProperties, { propertyUid: originalColumnName } );
    originalColumnDef.hasSplitSubject = originalColumnProps.hasSplitSubject;

    return {
        treeColumnConfig: {
            columns: newColumnInfos
        }
    };
};

/**
 * Update ViewModel Collection for the Data Provider and update Column Config
 * Add new Constraint in the props list of each ViewModel Object node
 * @param {Array} constraints Array of created constraint
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridData - View Model Atomic Data <top/bottom grid data>
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let addNewConstraintToGrid = function( constraints, treeDataProvider, vmVariabilityProps, vmGridData, vmGridSelectionState, gridEditorMode ) {
    const constraintUIDs = constraints.map( constraint => constraint.uid );
    // Create new column definition for new constraint
    let variabilityProps = vmVariabilityProps.getAtomicData ? vmVariabilityProps.getAtomicData() : vmVariabilityProps.getValue();
    let newColumnProps = variabilityProps.columnProperties[ 0 ]; // new constraint is added on top of the list
    let newColumnDef = pca0VariabilityTreeDisplayService.createColumnDef(
        newColumnProps,
        veConstants.CONFIG_CONTEXT_KEY,
        treeDataProvider,
        vmGridSelectionState,
        true // Skip Cell Renderer
    );

    // Set cell Renderers
    let isTopGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.PCA_GRID_DP;
    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let isSubjectSectionForMatrixRule = isSnOMatrixGridEditor && !isTopGrid;
    let cellRenderer = _getColumnCellRenderer( isSnOMatrixGridEditor, isSubjectSectionForMatrixRule,
        vmGridData, pca0GridAuthoringService.handleCellClick, treeDataProvider, vmGridSelectionState, vmVariabilityProps );
    _setColumnCellRenderer( newColumnDef, newColumnProps, cellRenderer );

    if( !newColumnDef.isSplitColumn ) {
        _createConstraintColumnProps( newColumnDef, variabilityProps );
    }

    // Declare LOV component to display Lov Entries in dropdown
    // For Matrix Rule only in (Subject) Bottom grid
    let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    if( newColumnProps.newConstraintColumnProps.object_type.parentAbstractClass === 'Cfg0AbsMatrixRule' && isBottomGrid ) {
        newColumnDef.renderingHint = veConstants.PCA_FEATURE_DISPOSITION_LOV_EDIT;
    }

    // Add new column after Object and other server column(s), if any.
    let newColumnInfos = [ ...treeDataProvider.columnConfig.columns ];
    let propColumnIdxs = [];
    newColumnInfos.forEach( columnDef => {
        if( columnDef.isPropertyColumn ) {
            propColumnIdxs.push( _.indexOf( newColumnInfos, columnDef ) );
        }
    } );
    let lastPropertyColumnIdx = _.isEmpty( propColumnIdxs ) ? 0 : _.max( propColumnIdxs );

    const serverColumnCount = _.countBy( newColumnInfos, 'isColumnFromCots' ).true || 0;
    newColumnInfos.splice( lastPropertyColumnIdx + serverColumnCount, 0, newColumnDef );

    let propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( variabilityProps.soaResponse.variabilityTreeData );
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, vmo => {
        // Add value 0 by default for all VMOs
        let propertyValue = 0;

        // Special handling for 'Properties Information': add values based on column props
        if( pca0CommonUtils.isConstraintsEditorPropInfoNodeUid( vmo.nodeUid, propInfoUIDs ) &&
            !_.isUndefined( _.get( newColumnDef, 'newConstraintColumnProps["' + vmo.nodeUid + '"].propDisplayValue' ) ) ) {
            propertyValue = newColumnDef.newConstraintColumnProps[ vmo.nodeUid ].propDisplayValue;
        }

        for( let constraintUID of constraintUIDs ) {
            vmo.props[ constraintUID ] = pca0CommonUtils.getViewModelProperty( constraintUID, vmo.nodeUid, propertyValue, {} );
        }

        // Adjust TreeNodes Props for Subject section
        let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
        let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
        if( isSnOMatrixGridEditor && isBottomGrid ) {
            pca0GridCommonUtils.setSubjectVmoPropsInSnOMatrixGridEditor( vmo, newColumnDef, true );
        }
    } );
    return {
        treeColumnConfig: {
            columns: newColumnInfos
        }
    };
};

/**
 * Set Display Mode
 * This Util is called when loading Variability Data (first loading and any PWA selection change)
 * ViewModel property displayMode is used to:
 * - prepare SOA input to get variability data and
 * - to tune toolbar shuttle command for displayMode setting
 *
 * We need to understand the use of property wasAnyConstraintsSelected
 * - 1st scenario ( Work with all features is toggled on & we enter into Grid Editor without any selection in PWA ):
 *   - We see entire variability in grid editor ( Reason - We come to this function when we enter into grid editor.
 *   if( configContext.getUseAllVariabilityInGridEditor ) evaluates to true & if( selectedObjects.length === 0 ) evaluates
 *   to true, and the active display mode is set to ALL FEATURES. wasAnyConstraintsSelected is set to false ( which it already was))
 * - 2nd scenario ( Work with all features is toggled on & we enter into Grid Editor with SOME selection in PWA ):
 *   - We see minimal variability in grid editor ( Reason - We come to this function when we enter into grid editor.
 *   if( configContext.getUseAllVariabilityInGridEditor ) evaluates to true & if( selectedObjects.length === 0 ) evaluates
 *   to false, if( !displayMode.wasAnyConstraintsSelected ) evaluates to true ( because default value of wasAnyConstraintsSelected is false
 *   and we have not changed it anywhere till now),
 *   and the active display mode is set to CURRENT. wasAnyConstraintsSelected is set to true now )
 * - 3rd scenario ( In the continuation of 2nd scenario ) - If I turn display mode to Show All features
 *   - We see entire variability of selected constraints ( Reason -We come to this function when we enter into grid editor.
 *   if( configContext.getUseAllVariabilityInGridEditor ) evaluates to true & if( selectedObjects.length === 0 ) evaluates
 *   to false ( because we have something selected in PWA), if( !displayMode.wasAnyConstraintsSelected ) evaluates to false ( because
 *   in scenario 2, we turned in to true, hence, we honor whatever value was already there in displayMode( ALL features )
 *   and the active display mode is set to ALL FEATURES.
 * - 4th scenario ( In continuation of 3rd scenario ) - If I select any other constraint
 *   - We see entire variability of selected constraints i.e. display mode set by user in scenario 3 is honored ( Reason:
 *    if( configContext.getUseAllVariabilityInGridEditor ) evaluates to true, if( selectedObjects.length === 0 ) evaluates to false, if( !displayMode.wasAnyConstraintsSelected )
 *   evaluates to false, hence, display mode is not set to CURRENT, and display mode of user which was set user by user scenario 3 ( Show All features ) is honored  )
 * @param {Object} displayMode ViewModel Property of active DisplayMode in GridEditor
 * @returns {Object} ViewModelProperty displayMode to be updated
 */
export let setDisplayMode = ( displayMode ) => {
    // DisplayMode is adjusted based on Preference value.
    // If preference is not set to get all variability, display mode is not modified ('current' value was set on init Actions)
    // If preference is set to get all variability, display mode change is updated.
    var configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let newDisplayMode = { ...displayMode };
    let selectedObjects = exports.getSelectedObjectsForConstraintsGrid();
    if( configContext.getUseAllVariabilityInGridEditor ) {
        if( selectedObjects.length === 0 ) {
            newDisplayMode.activeDisplayMode = pca0Constants.GRID_DISPLAY_MODE.FEATURES;
            newDisplayMode.wasAnyConstraintsSelected = false;
        } else {
            // At least one constraint is selected
            // DisplayMode to be set depends on previous number of selected constraints:
            // - if previously *no* constraints were selected, we do *not* honor the preference value and enforce 'Current Expressions'
            // - otherwise (one or more constraints were previously selected) keep current value
            if( !displayMode.wasAnyConstraintsSelected ) {
                newDisplayMode.activeDisplayMode = pca0Constants.GRID_DISPLAY_MODE.CURRENT;
            }
            newDisplayMode.wasAnyConstraintsSelected = true;
        }
    } else if( selectedObjects.length > 0 ) {
        newDisplayMode.wasAnyConstraintsSelected = true;
    }
    return newDisplayMode;
};

/**
 * DOM manipulation to adjust top/bottom tree table height
 * @param {ViewModelTreeNode} viewModelTreeNode - ViewModelTreeNode toggled in the grid
 * @param {Object} isTopGrid - true if action performed on topGrid else false
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 */
export let updateTopAndBottomTableHeight = function( viewModelTreeNode, isTopGrid, vmVariabilityProps ) {
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    const isRoot = viewModelTreeNode.id === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
        viewModelTreeNode.id === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID;
    if( !viewModelTreeNode.isExpanded && isRoot ) {
        _updateTableExpansionCollapse( variabilityProps.tableInformation, isTopGrid, false );
        _setTableHeight( isTopGrid, variabilityProps.tableInformation );
    } else if( isRoot ) {
        _updateTableExpansionCollapse( variabilityProps.tableInformation, isTopGrid, true );
        _setTableHeight( isTopGrid, variabilityProps.tableInformation );
    }
    vmVariabilityProps.setAtomicData ? vmVariabilityProps.setAtomicData( { ...variabilityProps } ) : vmVariabilityProps.update( { ...variabilityProps } );
};

export default exports = {
    getGridOptionFiltersForConstraintGrid,
    getSelectedObjectsForConstraintsGrid,
    constraintHandleCellClick,
    createSplitColumn,
    addSplitColumnToGrid,
    addNewConstraintToGrid,
    setDisplayMode,
    updateTopAndBottomTableHeight
};
