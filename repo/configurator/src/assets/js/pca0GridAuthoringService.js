// Copyright (c) 2022 Siemens

/**
 *
 * UTIL for Authoring APIs in generic grid service.
 */

/**
 * @module js/pca0GridAuthoringService
 */
import appCtxService from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import htmlUtils from 'js/htmlUtils';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0EnumeratedFeatureService from 'js/pca0EnumeratedFeatureService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import _ from 'lodash';

/**
 * Save internally the Cell being edited in DirectEdit for Matrix View
 * If a Direct Edit is in progress, prevent editing on any other cells
 */
let _directEditCellInfo = null;

/**
 * Removes event handler
 * @param {CallbackHandler} globalClickEventHandler - global click handler
 */
let _removeListener = ( globalClickEventHandler ) => {
    document.body.removeEventListener( 'click', globalClickEventHandler );
};

/**
 * [Constraints Grid Editor Matrix view]
 * Handle Direct Edit post actions.
 * @param {Object} cellData - cell info container
 * @returns {undefined}
 */
let _addListenersToCellOutOfEditMode = ( cellData ) => {
    _directEditCellInfo = cellData.cell;

    let _focusoutEventHandler = event => {
        // Need to trigger 'Save' action on focusout when clicking away
        // this means clicking on a target Element which is clean AND that is not the same cell
        // (same 'clean' cell occurs when user clicks multiple times and comes back to the same/previous selectionState)
        let targetElement = !_.isNull( event.relatedTarget ) ? event.relatedTarget : event.target;
        const targetCell = htmlUtils.closestElement( targetElement, '.ui-grid-cell' /*splmTableConstants <Const.CLASS_CELL>*/ );
        // targetCell may be null if user clicked somewhere in splm-table viewPort (not on a cell)
        let targetCellID = !_.isNull( targetCell ) ? targetCell.id : '';
        let editingCellID = _.get( _directEditCellInfo, 'parentElement.id' );
        if( _directEditCellInfo && editingCellID !== targetCellID ) {
            // Trigger save action
            _removeListener( _globalClickEventHandler );
            _globalClickEventHandler = null;
            eventBus.publish( 'Pca0ConstraintsGridEditor.handleSaveEdits' );
            _directEditCellInfo = null;
        }
    };

    let _globalClickEventHandler = ( eventData ) => {
        if( eventData && eventData.type === 'scroll' && _.isNull( _directEditCellInfo ) ) {
            return;
        }
        _focusoutEventHandler( eventData );
    };
    _removeListener( _globalClickEventHandler );
    document.body.addEventListener( 'click', _globalClickEventHandler, true );
};

/**
 * Validate Edit Action is allowed on clicked cell
 * @param {Object} cellDetails - cell details
 * @param {Boolean} isProductItem - true if openedObjectType is 'Cfg0ProductItem'
 * @param {Boolean} isGlobal - true if isGlobal is 'true'
 * @param {String} contextKey - context key
 * @return {Boolean} True if edit action is allowed on clicked cell
 */
let _isCellEditingAllowed = ( cellDetails, isProductItem, isGlobal, contextKey ) => {
    if( cellDetails.column.isTreeNavigation ) {
        return false;
    }
    const gridID = _.get( cellDetails, 'treeDataProvider.json.gridId' );
    const isMultiSVRFamilyLevelAssessment = cellDetails.vmo.isFamily && gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID;

    // Cell is not editable if isGlobal flag is set to true when opened object is of type Cfg0ProductItem
    if( isProductItem && isGlobal === 'true' ) {
        return false;
    }

    // Family-level click for Constraints Grid Editor
    // Disable editing on Family nodes in Constraints grid Editor if family has children and is collapsed
    // If Family has no children (i.e. when existing selection is at family level), allow edits
    if( ( cellDetails.vmo.parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
            cellDetails.vmo.parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID || isMultiSVRFamilyLevelAssessment ) /* Family-level assessment*/ &&
        !cellDetails.vmo.isExpanded /* Family is collapsed*/ &&
        !_.isUndefined( cellDetails.vmo.childrenUids ) && cellDetails.vmo.childrenUids.length > 0 /* Family has feature nodes defined in the tree*/
    ) {
        return false;
    }

    // Editing is disabled in Constraints Grid Editor for <Properties Information, Subject, Condition> nodes
    if( cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID || cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
        cellDetails.vmo.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) {
        return false;
    }

    //Multivariant grid: if group or split column cell is clicked in the variants grid ('ConfiguratorCtx' ), do not allow editing. 
    //Split column in a bom grid is allowed as before.
    let isMultiVariantColumn  =  cellDetails.column.sourceType === pca0Constants.CFG_OBJECT_TYPES.TYPE_VARIANT_RULE || cellDetails.column.sourceType === 'Cfg0VariantCriteria';
    if(  pca0CommonUtils.isGroupType( '', cellDetails.vmo ) || cellDetails.column.isSplitColumn && contextKey === veConstants.CONFIG_CONTEXT_KEY && isMultiVariantColumn ) {
        return false;
    }

    // Editing is disabled in Constraints Grid Editor for childNodes of <Properties Information>
    if( cellDetails.vmo.parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID ) {
        return false;
    }

    // Editing is disabled in Constraints Grid Editor for split columns in sections where values were copied over from original
    // NOTE: this IF statement is not necessary if we use 'disabled' class on split-copy cells (all actions are disabled)
    // We keep it just in case there is a requirement for a different UX style on those cells
    if( _.get( cellDetails, 'vmo.props[' + cellDetails.column.field + '].props.isSplitCellEditDisabled' ) &&
        cellDetails.vmo.props[ cellDetails.column.field ].props.isSplitCellEditDisabled === true ) {
        return false;
    }

    // Disable editing on any child node whose parentNode has selections
    const vmos = cellDetails.treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    const vmo = _.find( vmos, { nodeUid: cellDetails.vmo.nodeUid } );
    const parentNode = _.find( vmos, { nodeUid: vmo.parentUID } );
    if( _.get( parentNode, 'props[' + cellDetails.column.field + ']' ) &&
        parentNode.props[ cellDetails.column.field ].dbValue !== 0 ) {
        return false;
    }

    // [Constraints Grid Editor Matrix view]
    // Prevent click/edit on any cell if there's a direct edit in progress on another cell
    if( !_.isNull( _directEditCellInfo ) ) {
        let directEditingCellID = _directEditCellInfo.parentElement.id;
        let editingCellID = _.get( cellDetails, 'cell.parentElement.id' );
        return directEditingCellID === editingCellID;
    }

    return true;
};

/**
 * Update the cell click on VMO and SOA structure.
 * Fire event to trigger UI VMO update - necessary after removing the $watch from code
 * Fire event to update selection map
 * @param {String} gridId - Grid Identifier
 * @param {Object} vmo - View Model Object to be updated
 * @param {String} columnField - Column Identifier
 * @param {Boolean} isVMOReset - true if VMO selection state needs to be reset
 * @param {Number} isSingleClick - CLick number to identify progress in dbValue change
 * @param {Boolean} isColumnAction - true if VMO update is triggered by a Column action (e.g. Clear/Paste).
 * ** NOTE: this information is to be passed to the logic
 * ** deciding if AutoSave must be performed after each single VMO update.
 */
let _updateCellData = ( gridId, vmo, columnField, isVMOReset, isSingleClick, isColumnAction, cell ) => {
    var dbValue = 0;

    // Scenario: family selection. Update on childVMOs is called with isVMOReset set to true
    if( isVMOReset ) {
        vmo.props[ columnField ].dbValue = dbValue;
        if( vmo.props[ columnField ].originalValue === dbValue ) {
            vmo.props[ columnField ].dirty = false;
            vmo.props[ columnField ].valueUpdated = false;
            vmo.props[ columnField ].displayValueUpdated = false;
        } else {
            vmo.props[ columnField ].dirty = true;
            vmo.props[ columnField ].valueUpdated = true;
            vmo.props[ columnField ].displayValueUpdated = true;
        }
    } else {
        if( vmo.props[ columnField ].dbValue ) {
            dbValue = vmo.props[ columnField ].dbValue;
        }
        // If click value is 3 don't change value as it is updated in clear/paste operation
        if( isSingleClick === 3 ) {
            dbValue = vmo.props[ columnField ].dbValue;
        } else if( isSingleClick ) {
            dbValue = ( dbValue + 1 ) % 3;
        }
        vmo.props[ columnField ].dbValue = dbValue;
        // update the ui value as well for a family, it does not matter for any other than the family level selection when the family has a real selection in current mode
        // ( family is also leaf). Usually in the code we assume the uiValue is overwritten by the summary and use this for comparison for example, but in the
        // case that it has a real selection and it's a leaf it has to behave more like a feature, therefore keep the uiValue updated as well
        if( vmo.isFamily ) {
            vmo.props[ columnField ].uiValue = dbValue;
        }

        if( vmo.props[ columnField ].originalValue === dbValue ) {
            vmo.props[ columnField ].dirty = false;
            vmo.props[ columnField ].valueUpdated = false;
            vmo.props[ columnField ].displayValueUpdated = false;
        } else {
            vmo.props[ columnField ].dirty = true;
            vmo.props[ columnField ].valueUpdated = true;
            vmo.props[ columnField ].displayValueUpdated = true;
        }

        // Prepare event data to trigger logic to update selection map
        const eventData = {
            gridId: gridId,
            vmo: vmo,
            columnField: columnField,
            dbValue: dbValue,
            isColumnAction: isColumnAction,
            cell: cell
        };

        // Trigger logic to update selection map
        eventBus.publish( 'Pca0GridAuthoring.populateUserEdits', eventData );
    }
};

/**
 * Format Date string
 * @param {String} dateString - input Date String
 * @returns {String} formatted expression
 */
let _getFormattedDateString = dateString => {
    let expStr = '';
    const result = dateString.split( ' ' );

    if( result.length > 1 ) {
        const fromOp = result[ 0 ];
        const fromDate = result[ 1 ];
        const toOp = result[ 3 ];
        const toDate = result[ 4 ];

        expStr = fromOp + ' ' + pca0CommonUtils.getFormattedDateString( new Date( fromDate ) );
        if( result[ 3 ] && result[ 4 ] ) {
            const toDateStr = pca0CommonUtils.getFormattedDateString( new Date( toDate ) );
            expStr += ' & ' + toOp + ' ' + toDateStr;
        }
    } else {
        expStr = pca0CommonUtils.getFormattedDateString( new Date( dateString ) );
    }
    return expStr;
};

/**
 * Create entry in selection map
 * @param {String} parentUID - UID of parent Node
 * @param {Object} parentObject - Parent Node from viewModelObjectMapin soaResponse
 * @param {String} nodeID - UID of Node
 * @param {Object} variabilityNode - Node from variabiltyNodes collection in soaResponse
 * @param {Object} eventData - eventData
 * @param {Object} selectionMap - selectionMap
 * @returns {Object} selection map entry
 */
let _createEntryInSelectionMap = ( parentUID, parentObject, nodeID, variabilityNode, eventData, selectionMap ) => {
    // Scenario: FreeForm/Enumerated selection
    let isRangeExpr = false;
    let textForRangeExpr = '';

    let isFreeFormFamily = pca0CommonUtils.isObjectFreeForm( parentObject );
    if( isFreeFormFamily || pca0CommonUtils.isEnumeratedFamily( parentObject ) ) {
        // Scenario: FreeForm/Enumerated family selection
        if( parentUID === nodeID ) {
            selectionMap[ eventData.vmo.alternateID ] = {
                family: parentUID,
                nodeUid: nodeID,
                selectionState: eventData.dbValue,
                props: {
                    isFamilyLevelSelection: [ 'true' ]
                }
            };
            // Scenario: FreeForm/Enumerated feature selection
        } else {
            // valueText should be added if nodeID is part of rangeExpression of freeForm or enumerated family
            // e.g. of range expr as ' familyUID:<= 2 ' or 'familyUID:>3.4 & <5.6'
            const nodeIDValues = nodeID.split( /:(.*)/s );
            if( nodeIDValues && nodeIDValues.length > 1 &&
                nodeIDValues[ 0 ] === parentUID && nodeIDValues[ 1 ] === eventData.vmo.displayName ) {
                isRangeExpr = true;
                if( eventData.vmo.isParentEnumerated ) {
                    textForRangeExpr = pca0EnumeratedFeatureService.getServerNamesForEnumeratedFeature( eventData.vmo.displayName,
                        parentObject.props.cfg0ChildrenIDs,
                        parentObject.props.cfg0ChildrenDisplayNames, parentObject.props.cfg0ValueDataType[ 0 ] );
                } else {
                    textForRangeExpr = eventData.vmo.displayName;
                }
            }

            let enumeratedFeatureUID = '';
            if( !isRangeExpr ) {
                // Keep node uid
                enumeratedFeatureUID = nodeID;
            }
            selectionMap[ eventData.vmo.alternateID ] = {
                family: parentUID,
                familyId: '',
                nodeUid: enumeratedFeatureUID,
                props: {
                    isEnumeratedRangeExpressionSelection: [],
                    isFreeFormFamily: []
                },
                selectionState: eventData.dbValue,
                valueText: textForRangeExpr
            };
        }
        if( isFreeFormFamily ) {
            selectionMap[ eventData.vmo.alternateID ].props.isFreeFormFamily = [ 'true' ];
        }
        if( isRangeExpr && eventData.vmo.isParentEnumerated ) {
            selectionMap[ eventData.vmo.alternateID ].props.isEnumeratedRangeExpressionSelection = [ 'true' ];
        }

        if( parentObject && parentObject.props && parentObject.props.cfg0ValueDataType[ 0 ] === 'Date' &&
            _.get( parentObject, 'props.isFreeForm[0]' ) === 'true' ) {
            selectionMap[ eventData.vmo.alternateID ].valueText = _getFormattedDateString( selectionMap[ eventData.vmo.alternateID ].valueText );
        }
        return selectionMap[ eventData.vmo.alternateID ];
    } else if( !_.isUndefined( variabilityNode ) && variabilityNode.props && variabilityNode.props.isUnconfigured && variabilityNode.props.isUnconfigured[ 0 ] ) {
        // Scenario: Unconfigured selection
        selectionMap[ nodeID ] = {
            family: parentUID,
            familyId: '',
            //familyNamespace is mandatory in case of unconfigured selection
            familyNamespace: parentObject.props.cfg0FamilyNamespace[ 0 ],
            nodeUid: '',
            props: {
                isUnconfigured: [ 'true' ]
            },
            selectionState: eventData.dbValue,
            valueText: eventData.vmo.valueText ? eventData.vmo.valueText : eventData.vmo.displayName
        };
        return selectionMap[ nodeID ];
    } else if( parentUID === nodeID ) {
        // Scenario: Family selection
        let nodeIDtoSet = eventData.gridId === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ? eventData.vmo.alternateID : nodeID;
        selectionMap[ nodeIDtoSet ] = {
            family: parentUID,
            nodeUid: nodeID,
            selectionState: eventData.dbValue,
            props: {
                isFamilyLevelSelection: [ 'true' ]
            }
        };
        return selectionMap[ nodeID ];
        // Scenario: Feature selection
    }
    selectionMap[ eventData.vmo.alternateID ] = {
        family: parentUID,
        nodeUid: nodeID,
        props: {},
        selectionState: eventData.dbValue
    };
    return selectionMap[ eventData.vmo.alternateID ];
};

/**
 * Validate input Node UID refers to a familyGroup/Subject/Condition node.
 * This is required in a VCV Matrix view and in a Constraints Grid Editor to know if a given selection
 * is a family level selection.
 * @param {Object} nodeUID -input node UID.
 * @param {Object} viewModelObjectMap - View Model Object Map from SOAResponse.
 * @returns {Boolean} True if parentUID is of group type or Subject Or Condition to know it is a family level selection.
 */
let _isNodeAtGroupLevel = ( nodeUID, viewModelObjectMap ) => {
    if( nodeUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
        nodeUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ||
        nodeUID === pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID ||
        nodeUID === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
        return true;
    }
    let parentObject = viewModelObjectMap[ nodeUID ];
    if( parentObject && parentObject.sourceType === 'Cfg0FamilyGroup' ) {
        return true;
    }
    return false;
};

/**
 * Enforce same status as mainColumn
 * @param {String} gridId - Grid Identifier
 * @param {Array} splitColumns list of splitColumns where dbValue must be enforced
 * @param {Object} vmo - View Model Object to be updated
 * @param {Boolean} isVMOReset - true if VMO selection state needs to be reset
 * @param {Number} dbValue selectionState to be enforced (provided if !isVMOReset)
 * @param {Object} cell - cell info container
 */
let _enforceValueOnSplitCells = ( gridId, splitColumns, vmo, isVMOReset, dbValue, cell ) => {
    // Set isSingleClick to 3 (do not change status based on dbValue rotation)
    // This is needed especially when clearing clear/paste on mainColumn
    let isSingleClick = 3;
    splitColumns.forEach( splitColumnDef => {
        if( !isVMOReset ) {
            vmo.props[ splitColumnDef.uid ].dbValue = dbValue;
        }

        // NOTE: isColumnAction flag is not used here as Split Columns are not supported for Matrix
        // TODO adjust if support is added
        _updateCellData( gridId, vmo, splitColumnDef.uid, isVMOReset, isSingleClick, cell );
    } );
};

/**
 * Update ViewModelObject for cell
 * Dispatch Data Provider changes
 * @param {Object} vmo - View Model Object to be updated
 * @param {Object} cellDetails - cell details
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} gridId - Grid ID
 */
let _updateEachVMO = ( vmo, cellDetails, treeDataProvider, gridId ) => {
    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    // Save ColumnAction edit flag (i.e. Clear/Paste)
    // Applicable to all scenarios
    // However it is used in Constraints Grid Editor - Matrix mode
    // This will be used to trigger/prevent autosave actions if needed
    let isColumnAction = cellDetails.isColumnAction;
    let columnUid = cellDetails.column.field;

    // [Constraints Grid Editor scenario only]
    // if selection happens on 'main' column:
    // automatically reflect it on read-only sections of split columns, if needed
    let splitColumns = [];
    let containsSplit = !cellDetails.column.isSplitColumn && !_.isUndefined( cellDetails.column.hasSplitSubject );
    if( containsSplit ) {
        const columns = treeDataProvider.columnConfig.columns;
        splitColumns = _.filter( columns, column => {
            return !column.isColumnFromCots &&
                column.originalColumnName === columnUid /* main column is the one generating click event */ &&
                column.uid !== columnUid /* needed because each column has 'itself' defined as originalColumnName */ &&
                _.get( vmo.props[ column.uid ], 'props.isSplitCellEditDisabled' ) === true;
        } );
    }

    // Leaf changes: update VMO only if parentNode has no selections
    // parentUID is different for Leaf nodes in VCV and VCA: analyze isLeaf property instead of parentUID value
    if(  vmo.isLeaf && vmo.parentUID !== '' ) {
        let parentVMO = _.find( vmos, { nodeUid: vmo.parentUID } );
        if( parentVMO.props[ columnUid ].dbValue.length === 0 ||
            parentVMO.props[ columnUid ].dbValue[ 0 ] === 0 ) {
            _updateCellData( gridId, vmo, columnUid, false, cellDetails.isSingleClick, isColumnAction, cellDetails.cell );

            _enforceValueOnSplitCells( gridId, splitColumns, vmo, false, vmo.props[ columnUid ].dbValue, cellDetails.cell );
        }
        // If family is single select( optional/mandatory/boolean/any type),
        // then only family level selection is allowed. This behaviour is as per RAC.
    } else if( vmo.isSingleSelect ) {
        // If VMO is not a leaf, update VMO and reset children VMOs
        _updateCellData( gridId, vmo, columnUid, false, cellDetails.isSingleClick, isColumnAction, cellDetails.cell );
        _enforceValueOnSplitCells( gridId, splitColumns, vmo, false, vmo.props[ columnUid ].dbValue, cellDetails.cell );

        if( !vmo.children ) {
            vmo.children = [];
        }
        for( var cIDx = 0; cIDx < vmo.children.length; cIDx++ ) {
            _updateCellData( gridId, vmo.children[ cIDx ], columnUid, true, isColumnAction, cellDetails.cell );
            _enforceValueOnSplitCells( gridId, splitColumns, vmo.children[ cIDx ], true, cellDetails.cell );
        }
    }
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Trigger validation for authored expressions
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} eventData - data carried by validate trigger event
 * @returns {Object} updated Validation Properties container
 */
export let validateProductConfigurations = ( validationProps, eventData ) => {
    // Process Initial Validation vs. Column Validation
    delete validationProps.columnValidation;
    delete validationProps.columnToValidationMap;
    if( !_.isUndefined( eventData ) && Object.keys( eventData ).indexOf( 'column' ) > -1 ) {
        // This is single column validation
        validationProps.columnValidation = eventData.column;
        return validationProps;
    }
};

/**
 * Update ViewModelObject for cell
 * Dispatch Data Provider changes
 * @param {Object} cellDetails - cell details
 */
export let updateVMO = cellDetails => {
    let treeDataProvider = cellDetails.treeDataProvider;
    let gridId = treeDataProvider.json.gridId;
    let columnUid = cellDetails.column.field;

    // Save ColumnAction edit flag (i.e. Clear/Paste)
    // Applicable to all scenarios
    // However it is used in Constraints Grid Editor - Matrix mode
    // This will be used to trigger/prevent autosave actions if needed
    let isColumnAction = cellDetails.isColumnAction;

    // Prevent any further actions for VMO with no edits allowed.
    if( !_.isUndefined( treeDataProvider.json.minEditLevelNdx ) && cellDetails.vmo.levelNdx < treeDataProvider.json.minEditLevelNdx ) {
        return;
    }

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    var updatedVMOs = [ ...vmos ];

    let vmo = _.find( updatedVMOs, { alternateID: cellDetails.vmo.alternateID } );
    if( gridId === 'multipleVariantsConfigGrid' ) {
        let matchingVmos; //vmos that match the alternateUid which will need update
        //extract just the family and or feature from alternate UID then look for all instances of those occurences
        matchingVmos = _.filter( updatedVMOs, function( vmo ) {
            //if feature and both family and feature match or is family and it matches
            return vmo.uid === cellDetails.vmo.uid && vmo.parentUID === cellDetails.vmo.parentUID || vmo.uid === cellDetails.vmo.uid && vmo.isFamily;
        } );
        matchingVmos.forEach( vmo => {
            _updateEachVMO( vmo, cellDetails, treeDataProvider, gridId );
        } );
    }

    // [Constraints Grid Editor scenario only]
    // if selection happens on 'main' column:
    // automatically reflect it on read-only sections of split columns, if needed
    let splitColumns = [];
    let containsSplit = !cellDetails.column.isSplitColumn && !_.isUndefined( cellDetails.column.hasSplitSubject );
    if( containsSplit ) {
        const columns = treeDataProvider.columnConfig.columns;
        splitColumns = _.filter( columns, column => {
            return !column.isColumnFromCots &&
                column.originalColumnName === columnUid /* main column is the one generating click event */ &&
                column.uid !== columnUid /* needed because each column has 'itself' defined as originalColumnName */ &&
                _.get( vmo.props[ column.uid ], 'props.isSplitCellEditDisabled' ) === true;
        } );
    }

    // Leaf changes: update VMO only if parentNode has no selections
    // parentUID is different for Leaf nodes in VCV and VCA: analyze isLeaf property instead of parentUID value
    if( vmo.isLeaf && vmo.parentUID !== '' ) {
        let parentVMO = _.find( vmos, { nodeUid: vmo.parentUID } );
        if( parentVMO.props[ columnUid ].dbValue.length === 0 ||
            parentVMO.props[ columnUid ].dbValue === 0 ) {
            _updateCellData( gridId, vmo, columnUid, false, cellDetails.isSingleClick, isColumnAction, cellDetails.cell );

            _enforceValueOnSplitCells( gridId, splitColumns, vmo, false, vmo.props[ columnUid ].dbValue, cellDetails.cell );
        }
        // If family is single select( optional/mandatory/boolean/any type),
        // then only family level selection is allowed. This behaviour is as per RAC.
    } else if( vmo.isSingleSelect ) {
        // If VMO is not a leaf, update VMO and reset children VMOs
        _updateCellData( gridId, vmo, columnUid, false, cellDetails.isSingleClick, isColumnAction, cellDetails.cell );
        _enforceValueOnSplitCells( gridId, splitColumns, vmo, false, vmo.props[ columnUid ].dbValue, cellDetails.cell );

        if( !vmo.children ) {
            vmo.children = [];
        }
        for( var cIDx = 0; cIDx < vmo.children.length; cIDx++ ) {
            _updateCellData( gridId, vmo.children[ cIDx ], columnUid, true, isColumnAction, cellDetails.cell );
            _enforceValueOnSplitCells( gridId, splitColumns, vmo.children[ cIDx ], true, cellDetails.cell );
        }
    }

    // Call dispatch on data provider
    treeDataProvider.update( updatedVMOs, updatedVMOs.length );
};

/**
 * Update ViewModelObject for cell: selection changed via Dropdown
 * Dispatch Data Provider changes
 * @param {Object} lovSelectionData - event info data container
 * @param {UwDataProvider} treeDataProvider - DataProvider which VMO triggering the action belongs to
 */
export let updateVMOByDropdownSelection = ( lovSelectionData, treeDataProvider ) => {
    let selectedItem = lovSelectionData.selectedObjects[ 0 ];

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    var updatedVMOs = [ ...vmos ];
    let vmo = _.find( updatedVMOs, { alternateID: lovSelectionData.vmo.alternateID } );

    // NOTE: dropdown scenario is different from regular TICK|NOT|BLANK icon scenario
    // - leaf and parent can BOTH have selections defined in selection map
    // ---[e.g., in MatrixRule we can define feature disposition for both family and its feature]
    // - action on parent doesn't affect selection on children: set 'freeStandingSelection' to true

    // Update VMO cell data
    let selectedVmoProp = lovSelectionData.viewModelProp.propertyName;
    let newValue = selectedItem.propInternalValue;

    // Set displayValues array: this is needed when enforcing values in clear/paste/reset (not by dropdown action)
    vmo.props[ selectedVmoProp ].displayValues = [ selectedItem.propInternalValue ];

    // Empty selected Item is added natively 'emptyLOVEntry' and has no selectionState/operatorCode mapped.
    // For empty entry, enforce 0 as selectionState.
    let newSelectionStateDbValue = _.isUndefined( selectedItem.selectionState ) ? 0 : selectedItem.selectionState;
    vmo.props[ selectedVmoProp ].dbValue = newSelectionStateDbValue;
    let isDirty = vmo.props[ selectedVmoProp ].originalValue !== newValue;
    vmo.props[ selectedVmoProp ].dirty = isDirty;
    vmo.props[ selectedVmoProp ].valueUpdated = isDirty;
    vmo.props[ selectedVmoProp ].displayValueUpdated = isDirty;

    // Call dispatch on data provider
    treeDataProvider.update( updatedVMOs, updatedVMOs.length );
};

/**
 * Handle click event on the cell
 * @param {String} contextKey - the Context key
 * @param {Object} cellDetails - cell details
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {Boolean} isSnOMatrixGridEditor true if Variant Table is authoring Matrix Rules
 */
export let handleCellClick = ( contextKey, cellDetails, vmGridSelectionState, isSnOMatrixGridEditor ) => {
    const contextInfo  = appCtxService.getCtx( contextKey );
    const objectType = 'Cfg0ProductItem';
    const openedObjectType = contextInfo.openedObjectType;
    const isProductItem = openedObjectType === objectType;
    const isGlobal = _.get( cellDetails, 'column.props.cfg0IsGlobal.propDisplayValue' );

    // Close Add Range dialog in VCA
    if( contextKey === pca0Constants.VCA_CONTEXT ) {
        eventBus.publish( 'Pca0Configurator.closeDialog' );
    }

    var isFreeForm = false;
    if( cellDetails.vmo ) {
        isFreeForm = cellDetails.vmo.isFreeForm;
    }

    // Update Atomic Data with Grid Selection State
    // Dispatch atomic data changes
    let newGridSelectionState = {
        selectionInfo: cellDetails.vmo,
        isFreeFormOptionValueSelected: isFreeForm
    };
    vmGridSelectionState.setAtomicData( newGridSelectionState );

    if( event ) {
        event.stopPropagation();
    }

    // Validate if cell can be edited
    // This logic evaluates:
    // - cell level
    // - editable status
    // - VMO value of feature vs belonging family
    // DirectEdit in progress for Constraints Matrix mode
    if( !_isCellEditingAllowed( cellDetails, isProductItem, isGlobal, contextKey ) ) {
        return;
    }

    //if we are in a isSnOMatrixGridEditors we are now sending an event to interested grids
    //so they can handle it and use it like the Multivariant tab by highlighting the column selection in the header cell
    if( isSnOMatrixGridEditor ) {
        eventBus.publish( 'Pca0Configurator.setCellColumnSelection', { columnUid: cellDetails.column.uid, vmo: cellDetails.vmo } );
    }

    const gridId = _.get( cellDetails, 'treeDataProvider.json.gridId' );
    // Sync Edit Mode and validate if Variant Table can be edited
    let canEdit = pca0CommonUtils.handleEditModeSync( contextKey, isSnOMatrixGridEditor, gridId );
    if( canEdit ) {
        const autoSave = appCtxService.getCtx( 'autoSave' ).dbValue;
        const isVariantTableEditing = appCtxService.getCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE );
        if( !isVariantTableEditing && autoSave && isSnOMatrixGridEditor && _.isNull( _directEditCellInfo ) &&
            cellDetails.vmo.alternateID.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID ) ) {
            _addListenersToCellOutOfEditMode( cellDetails );
        }
        cellDetails.isSingleClick = true;
        exports.updateVMO( cellDetails );
    }
};

/**
 * Update Selection Map
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} eventData - Event Data
 * @param {Object} gridData - This is useful to update gridData with respective to constraints grid only.
 * @return {Object} atomic data to be dispatched
 */
export let populateUserEdits = ( vmVariabilityProps, eventData, gridData ) => {
    // Clone current status for VM data and fields (atomic data)
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let nodeID = eventData.vmo.nodeUid;
    let businessObjectToSelectionMap = variabilityProps.businessObjectToSelectionMap;
    let backupOfBusinessObjectToSelectionMap = variabilityProps.backupOfBusinessObjectToSelectionMap;
    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( variabilityProps.soaResponse );
    let viewModelObjectMap = variabilityProps.soaResponse.viewModelObjectMap;
    let gridProps = undefined;
    if( gridData ) {
        gridProps = gridData.getAtomicData();
        backupOfBusinessObjectToSelectionMap = { ...gridProps.backupOfBusinessObjectToSelectionMap }; // in case of constraints grid we need to update,
        businessObjectToSelectionMap = gridProps.businessObjectToSelectionMap;
        variabilityNodes = gridProps.variabilityNodes;
        viewModelObjectMap = gridProps.viewModelObjectMap;
    }
    let variabilityNode = _.find( variabilityNodes, { nodeUid: nodeID } );
    let selectionMap = businessObjectToSelectionMap[ eventData.columnField ];
    let node = !_.isUndefined( selectionMap[ eventData.vmo.alternateID ] ) ? selectionMap[ eventData.vmo.alternateID ] : selectionMap[ nodeID ];
    //for unconfigured which is now editable in client, we need to update the selectionMap with the new value
    //partially unconfigured refers to nodes that have an configuredIn svr and a configuredOut svr and the need in the UI to represent those in a single node - on the configuredIn svr
    //therefore we often need to look up the real alternateID of the real node in order to make updates on the column represented as "xxx:yyy:yyy:Sony" for example
    if( !node && eventData.gridId === 'multipleVariantsConfigGrid' && eventData.vmo.isPartiallyUnconfigured && eventData.vmo.isPartiallyUnconfigured.includes( eventData.columnField ) ) {
        let newAltUId = pca0GridCommonUtils.getAlternativeUidConsideringPartiallyUnconfigured( eventData.vmo );
        node = !_.isUndefined( selectionMap[ newAltUId] ) ? selectionMap[ newAltUId ] : selectionMap[ nodeID ];
    }
    if( node ) {
        node.selectionState = eventData.dbValue;
    } else if( eventData.dbValue !== 0 ) {
        // Create node only if selection state is not 0 (blank)
        let parentUID = eventData.vmo.parentUID !== '' ? eventData.vmo.parentUID : eventData.vmo.nodeUid;
        // if parentUID is of Group(VCV)/Subject(Constraints)/Condition(Constraints): it is a family level selection.
        // Set parentUID = nodeID -> _createEntryInSelectionMap() takes care of family level selection if(parentUID = nodeID).
        if( _isNodeAtGroupLevel( parentUID, viewModelObjectMap ) ) {
            parentUID = nodeID;
        }
        let parentObject = viewModelObjectMap[ parentUID ];
        node = _createEntryInSelectionMap( parentUID, parentObject, nodeID, variabilityNode, eventData, selectionMap );
    }

    // For family selections, make sure to clear all feature selections for that family
    // Only if familySelection is not set as free-standing. In such case, it won't affect feature selections
    // E.g., features disposition for Matrix Rule are independent from disposition set at family level
    if( _.get( node, 'props.isFamilyLevelSelection[0]' ) && node.props.isFamilyLevelSelection[ 0 ] === 'true' &&
        !eventData.freeStandingSelection ) {
        var featureSelections = _.filter( selectionMap, { family: nodeID } );
        _.forEach( featureSelections, featureSelection => {
            if( featureSelection.family !== featureSelection.nodeUid ) {
                featureSelection.selectionState = 0;
            }
        } );
    }

    if( gridData ) {
        gridData.setAtomicData ? gridData.setAtomicData( { ...gridProps } ) : gridData.update( { ...gridProps } );
    }

    // <TODO>
    // by Valentina - Performance
    // Add variable to skip update Dirty when edit action is driven by a column action (e.g.Clear/Paste)
    // </TODO>
    variabilityProps.dirtyElements = exports.updateDirtyElements(
        // For top and bottom grid selection changes, keep on collecting updated constraints.
        gridData ? variabilityProps.dirtyElements : [], // currentDirtyElements
        businessObjectToSelectionMap, // selection map
        backupOfBusinessObjectToSelectionMap // backup selection map
    );

    // Return AtomicData (containing updated selection map) to be dispatched
    return variabilityProps;
};

/**
 * This function will keep a track of dirty elements that contain unsaved user edits in a tree.
 * @param {Object} businessObjectToSelectionMap - BusinessObject to selection map
 * @param {Object} backupOfBusinessObjectToSelectionMap - Backup BusinessObject to selection map
 * @returns {Array} Array containing list of elements containing user edits
 */
export let markElementsDirtyOnUserEdit = ( businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap ) => {
    let clonedSelectionMap = _.cloneDeep( businessObjectToSelectionMap );
    let dirtyElements = [];
    if( !_.isEqual( clonedSelectionMap, backupOfBusinessObjectToSelectionMap ) ) {
        let keys = Object.keys( clonedSelectionMap );
        keys.forEach( key => {
            let originalSelectionMap = backupOfBusinessObjectToSelectionMap[ key ];
            let newSelectionMap = clonedSelectionMap[ key ];
            if( !_.isEqual( originalSelectionMap, newSelectionMap ) ) {
                key = pca0CommonUtils.getOriginalColumnKeyFromSplitColumnKey( key );
                if( !dirtyElements.includes( key ) ) {
                    dirtyElements.push( key );
                }
            }
        } );
    }
    return dirtyElements;
};

/**
 * Get instance of Save Handler, based on active Edit Handler
 * @returns {Object} instance of Save Handler
 */
import pca0ConstraintsGridService from 'js/pca0ConstraintsGridService';
import pca0VariantConditionAuthoringGridService from 'js/Pca0VariantConditionAuthoringGridService';
import pca0VariantFormulaEditorService from 'js/pca0VariantFormulaEditorService';
export let getSaveHandler = () => {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if( activeEditHandler && activeEditHandler.getEditHandlerContext ) {
        var activeEditContext = activeEditHandler.getEditHandlerContext();
        switch ( activeEditContext ) {
            case pca0Constants.VCA_CONTEXT:
                return pca0VariantConditionAuthoringGridService.getSaveHandler();
            case pca0Constants.FORMULA_EDITOR_CONTEXT:
                return pca0VariantFormulaEditorService.getSaveHandler();
            case veConstants.CONFIG_CONTEXT_KEY:
                return pca0ConstraintsGridService.getSaveHandler();
            default:
                return null;
        }
    }
};

/**
 * Clear selections for the given column
 * - Clear selections on selectionMap
 * - Update VMOs
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} businessObjectToSelectionMap - selectionMap
 * @param {Object} eventData - data carried by Clear trigger event
 */
export let clearColumnSelections = ( treeDataProvider, businessObjectToSelectionMap, eventData ) => {
    let columnUid = eventData.column.field;
    let isSnOMatrixGridEditor = false;

    // Clear selectionMap for the given column
    businessObjectToSelectionMap[ columnUid ] = {};

    // [Constraints Grid Editor scenario only]
    // if Clear action is on main column:
    // Clear selection Map of provided read-only sections of split columns
    if( !_.isUndefined( eventData.gridEditorData ) ) {
        // Grid Editor mode
        isSnOMatrixGridEditor = eventData.gridEditorData.isSnOMatrixGridEditor;

        // Split columns
        eventData.gridEditorData.splitColumns.forEach( splitColumn => {
            businessObjectToSelectionMap[ splitColumn.uid ] = {};
        } );
    }

    // Update VMOs
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let tableColumn = _.find( treeDataProvider.cols, col => col.uid === columnUid );

    _.forEach( vmos, vmo => {
        // Skip "Clear" action if VMO is part of 'Properties Information' subset for Constraints Grid Editor
        let skipAction = false;
        if( !_.isUndefined( eventData.gridEditorData ) && pca0CommonUtils.isConstraintsEditorPropInfoNode( vmo ) ) {
            skipAction = true;
        }
        if( !skipAction ) {
            let dbVal = vmo.props[ columnUid ].dbValue instanceof Array ? vmo.props[ columnUid ].dbValue[ 0 ] : vmo.props[ columnUid ].dbValue;
            // [Performance enhancement] only updateVMO for values that are not already clear
            if( dbVal !== 0 ) {
                let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;

                // Update VMO based on Column (Constraint Rule type) and DataProvider
                if( isSnOMatrixGridEditor && isBottomGrid ) {
                    let lovSelectionData = {
                        vmo: vmo,
                        viewModelProp: vmo.props[ columnUid ],
                        selectedObjects: [ {
                            propInternalValue: '',
                            propDisplayValue: '',
                            selectionState: 0
                        } ]
                    };
                    exports.updateVMOByDropdownSelection( lovSelectionData, treeDataProvider );
                } else {
                    vmo.props[ columnUid ].dbValue = 0;
                    let cellDetails = {
                        vmo: vmo,
                        column: tableColumn,
                        treeDataProvider: treeDataProvider,
                        isSingleClick: 3,
                        isColumnAction: true
                    };
                    exports.updateVMO( cellDetails );
                }
            }
        }
    } );
};

/**
 * Copy selections for the given column
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} eventData - data carried by Copy trigger event
 * @param {String} contextKey - Context Key
 */
export let copyColumnSelections = ( vmVariabilityProps, eventData, contextKey ) => {
    // Clone current status for atomic data
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let businessObjectToSelectionMap = variabilityProps.businessObjectToSelectionMap;
    let columnUid = eventData.column.field;
    let columnSelections = { ...businessObjectToSelectionMap[ columnUid ] };
    let copiedSelectionCache = undefined;
    if( Object.keys( columnSelections ).length > 0 ) {
        copiedSelectionCache = columnSelections;
    }
    appCtxService.updatePartialCtx( contextKey + '.copiedSelectionsCache', copiedSelectionCache );
};

/**
 * Paste copied selections on given column:
 * - Apply copied selections on VMOs
 * - Update VMOs
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} businessObjectToSelectionMap - selectionMap
 * @param {Object} eventData - data carried by Clear trigger event
 * @param {Object} copiedSelections - Cached copied selections
 */
export let pasteSelectionsOnColumn = ( treeDataProvider, businessObjectToSelectionMap, eventData, copiedSelections ) => {
    let columnUid = eventData.column.field;
    let isSnOMatrixGridEditor = false;

    // Apply selections on the column
    businessObjectToSelectionMap[ columnUid ] = _.cloneDeep( copiedSelections );

    // [Constraints Grid Editor scenario only]
    // if Paste action is on main column:
    // Copy cached selections from cache on selection Map of provided read-only sections of split columns
    if( !_.isUndefined( eventData.gridEditorData ) ) {
        // Grid Editor mode
        isSnOMatrixGridEditor = eventData.gridEditorData.isSnOMatrixGridEditor;

        // Split columns
        eventData.gridEditorData.splitColumns.forEach( splitColumn => {
            businessObjectToSelectionMap[ splitColumn.uid ] = _.cloneDeep( copiedSelections );
        } );
    }

    // Update VMOs
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let tableColumn = _.find( treeDataProvider.cols, col => col.uid === columnUid );

    _.forEach( vmos, vmo => {
        // Skip "Paste" action if VMO is part of 'Properties Information' subset for Constraints Grid Editor
        let skipAction = false;
        if( !_.isUndefined( eventData.gridEditorData ) && pca0CommonUtils.isConstraintsEditorPropInfoNode( vmo ) ) {
            skipAction = true;
        }

        if( !skipAction ) {
            var selectionState = 0;
            // SelectionMap key could be either nodeUid or alternateID
            if( Object.keys( copiedSelections ).includes( vmo.alternateID ) ) {
                selectionState = copiedSelections[ vmo.alternateID ].selectionState;
            } else if( Object.keys( copiedSelections ).includes( vmo.nodeUid ) ) {
                selectionState = copiedSelections[ vmo.nodeUid ].selectionState;
            }

            // [Performance enhancement] Update VMO only if selectionState is different
            if( vmo.props[ columnUid ].dbValue !== selectionState ) {
                let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;

                // Update VMO based on Column (Constraint Rule type) and DataProvider
                if( isSnOMatrixGridEditor && isBottomGrid ) {
                    // Get Value and assign to VMO
                    let featureDispositionsLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov;
                    let featureDisposition;
                    if( selectionState !== 0 ) {
                        featureDisposition = _.find( featureDispositionsLov, { operatorCode: selectionState } );
                    } else {
                        // Setup temporary empty disposition
                        featureDisposition = { lovKey: '', displayName: '', description: '', operatorCode: 0 };
                    }

                    let lovSelectionData = {
                        vmo: vmo,
                        viewModelProp: vmo.props[ columnUid ],
                        selectedObjects: [ {
                            propInternalValue: featureDisposition.lovKey,
                            propDisplayValue: featureDisposition.displayName,
                            selectionState: selectionState
                        } ]
                    };
                    exports.updateVMOByDropdownSelection( lovSelectionData, treeDataProvider );
                } else {
                    vmo.props[ columnUid ].dbValue = selectionState;
                    let cellDetails = {
                        vmo: vmo,
                        column: tableColumn,
                        treeDataProvider: treeDataProvider,
                        isSingleClick: 3,
                        isColumnAction: true
                    };
                    exports.updateVMO( cellDetails );
                }
            }
        }
    } );
};

/**
 * Set VMOs properties
 * - to original values from DB OR
 * - to status-quo value
 * This API is called when reverting to backup or after save (VCA only)
 * @param {Object} treeDataProvider - Tree Data Provide
 * @param {Boolean} reset - True if values need to be reset to original value (i.e. Cancel operation), false to set to current value (i.e. Save operation)
 * @param {Boolean} needToUpdateSummary - True if summary must be updated for all (non-leaf collapsed) nodes
 * @param {Object} businessObjectToSelectionMap - Updated selectionMap for given gridData
 * @param {Object} viewModelObjectMap - ViewModelObjectMap for given gridData
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule vs all other Constraint Rule types)
 * @param {Boolean} skipDataProviderUpdate true if dataProvider must not be updated (e.g. update is performed at a later stage of the code, like when cancelling edits)
 */
export let setPropertiesToValue = ( treeDataProvider, reset, needToUpdateSummary, businessObjectToSelectionMap, viewModelObjectMap, gridEditorMode, skipDataProviderUpdate ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    let featureDispositionsLov = isSnOMatrixGridEditor && isBottomGrid ? appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov : [];

    for( let iDx = 0; iDx < vmos.length; iDx++ ) {
        let vmoProps = vmos[ iDx ].props;
        let nodeUid = vmos[ iDx ].nodeUid;

        // Loop for value set/reset only for ViewModelProperties defined through getViewModelProperty util
        Object.values( vmoProps ).filter( propValue => !_.isUndefined( propValue.originalValue ) ).forEach(
            propValue => {
                if( isSnOMatrixGridEditor && isBottomGrid ) {
                    // NOTE: In Edit mode, dbValue was set to string natively when dropdown is initialized
                    // There can be issue if we clear with families collapsed then clear with families expanded
                    // Because propValue gets created in edit mode with originalValue empty
                    // For Matrix mode, refer to selection Map which has been updated already

                    // Find selection in selectionMap
                    let selections = !_.isUndefined( businessObjectToSelectionMap[ propValue.name ] ) ?
                        Object.values( businessObjectToSelectionMap[ propValue.name ] ) : {};
                    let selectionEntry = _.find( selections, { nodeUid: nodeUid } );
                    // In Edit mode, dbValue was set to string natively when dropdown is initialized
                    // We are exiting edit mode: set now dbValue again to operatorCode
                    if( reset ) {
                        let setDbValue = 0;
                        let setUiValue = '';

                        // If selectionEntry is defined, reset to previous value
                        // Otherwise, reset to 0 selection
                        if( !_.isUndefined( selectionEntry ) ) {
                            let featureDisposition = _.find( featureDispositionsLov, { operatorCode: selectionEntry.selectionState } );
                            if( !_.isUndefined( featureDisposition ) ) {
                                setDbValue = featureDisposition.operatorCode;
                                setUiValue = featureDisposition.displayName;
                            }
                        }
                        propValue.dbValue = setDbValue;
                        propValue.uiValue = setUiValue;

                        // Set displayValues array: this is needed when enforcing values in clear/paste/reset (not by dropdown action)
                        propValue.displayValues = [ setUiValue ];
                    } else {
                        // Not applicable for Constraints Grid Editor
                    }
                } else if( propValue.originalValue !== propValue.dbValue ) {
                    if( reset ) {
                        propValue.dbValue = propValue.originalValue;
                    } else {
                        propValue.originalValue = propValue.dbValue;
                    }
                    propValue.dirty = false;
                    propValue.valueUpdated = false;
                    propValue.displayValueUpdated = false;
                }
            } );
    }

    if( !skipDataProviderUpdate ) {
        // Trigger Summary update
        if( needToUpdateSummary ) {
            pca0GridCommonUtils.updateAllNodesSummary(
                treeDataProvider, businessObjectToSelectionMap, viewModelObjectMap, true );
        }
        treeDataProvider.update( vmos, vmos.length );
    }
};

/**
 * get list of updated selected objects with edits in variability Atomic Data
 * @param {Array} currentDirtyElements - Array of existing dirty elements. If provided, union is performed
 * @param {Object} businessObjectToSelectionMap - updated Selection Map
 * @param {Object} backupOfBusinessObjectToSelectionMap - Backup Selection Map
 * @returns {Array} updated array of Dirty elements
 */
export let updateDirtyElements = ( currentDirtyElements, businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap ) => {
    let newDirtyElements = exports.markElementsDirtyOnUserEdit( businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap );
    return _.union( currentDirtyElements, newDirtyElements );
};

/**
 * Trigger validation for authored expressions
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} eventData - data carried by validate trigger event
 * @returns {Object} updated Validation Properties container
 */
export let validateProductConfigurationsForMultiSVR = ( validationProps, eventData ) => {
    // Process Initial Validation vs. Column Validation
    delete validationProps.columnValidation;
    delete validationProps.columnToValidationMap;
    if( !_.isUndefined( eventData ) && Object.keys( eventData ).indexOf( 'column' ) > -1 ) {
        // This is single column validation
        validationProps.columnValidation = eventData.column;
        return {
            validationProps: validationProps,
            option: eventData.option
        };
    }
};

export default exports = {
    validateProductConfigurations,
    updateVMO,
    updateVMOByDropdownSelection,
    handleCellClick,
    populateUserEdits,
    markElementsDirtyOnUserEdit,
    getSaveHandler,
    clearColumnSelections,
    copyColumnSelections,
    pasteSelectionsOnColumn,
    setPropertiesToValue,
    updateDirtyElements,
    validateProductConfigurationsForMultiSVR
};
