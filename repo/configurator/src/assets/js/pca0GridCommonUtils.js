// Copyright (c) 2024 Siemens

/**
 * @module js/pca0GridCommonUtils
 */

import appCtxService from 'js/appCtxService';
import assert from 'assert';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import localeService from 'js/localeService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0ConstraintsDisplayService from 'js/pca0ConstraintsDisplayService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0MultipleSVRsDisplayService from 'js/pca0MultipleSVRsDisplayService';
import pca0RendererService from 'js/pca0RendererService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import splmTablePublishedService from 'js/splmTablePublishedService';
import variabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import _ from 'lodash';

const localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
let pca0OperatorDisplayStrings;
let anyTitle  = 'Any'; //preliminary defaults for jest, they get replaced in loadGridDataProvider if not yet filled pca0OperatorDisplayStrings
let noneTitle = 'None';


/**
 * Local Util Methods
 */

/**
 * Return the assigned cell Renderer for the column
 * @param {UwDataProvider} dataProvider - DataProvider
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridData - Grid data
 * @param {String} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @param {Boolean} isSubjectSectionForMatrixRule true if authoring Matrix Rules and column belongs to Subject section
 * @param {String} contextKey - Context Key
 * @returns {Object} Cell renderer
 */
let _getColumnCellRenderer = ( dataProvider, vmGridSelectionState, vmVariabilityProps, vmGridData, gridMode, isSubjectSectionForMatrixRule, contextKey ) => {
    if( isSubjectSectionForMatrixRule ) {
        // 'LOV' cell renderer only for Matrix Grid - Subject section
        return pca0RendererService.lovMatrixCellRenderer( vmVariabilityProps, vmGridData );
    }

    const cellClickCallback = gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ? pca0GridAuthoringService.handleCellClick : pca0ConstraintsDisplayService.constraintHandleCellClick;
    const isSnOMatrixGridEditor = gridMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;

    // Add generic 'icon' cell renderer
    return pca0RendererService.iconCellRenderer(
        cellClickCallback, // cell Click handler
        contextKey, // contextKey
        dataProvider, // treeDataProvider
        vmGridSelectionState, // grid Selection State
        isSnOMatrixGridEditor // isSnOMatrixGridEditor
    );
};

/**
 * Set Cell Renderers for the input column
 * @param {Object} column input Column Definition
 * @param {Object} columnProps collection of properties with cellRenderers to be copied to new column
 * @param {Object} columnCellRenderer column Cell Renderer to be copied to input column Definition
 */
const _setColumnCellRenderer = ( column, columnProps, columnCellRenderer ) => {
    column.cellRenderers = columnProps.cellRenderers ? [ ...columnProps.cellRenderers ] : [];
    column.cellRenderers.push( columnCellRenderer );
};

/**
 * Get the cell renderers for the columns based on the grid mode.
 * @param {String} gridMode - Mode of the grid. (e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule')
 * @param {String} contextKey - Context key for the renderer.
 * @param {Object} dataProvider - Tree data provider.
 * @param {Object} gridSelectionState - VM gridSelectionState atomic data.
 * @returns {Array} - Array of cell renderer functions.
 */
const _getColumnCellRenderers = ( gridMode, contextKey, dataProvider, gridSelectionState ) => {
    let cellRenderers = [ pca0RendererService.filterCellRenderer( pca0GridAuthoringService.handleCellClick, contextKey, dataProvider, gridSelectionState ) ];
    if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        cellRenderers.push( pca0RendererService.variabilityContentBackgroundRenderer );
        cellRenderers.push( pca0RendererService.rowHighlightRenderer );
    }
    return cellRenderers;
};

/**
 * Util to create properties info container for the columns
 * This is used by Tree Header module to render header cell
 * @param {Object} column Column
 * @param {Object} variabilityData - View Model Atomic Data <variabilityProps>
 * @param {Object} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 */
let _createColumnProps = ( column, variabilityData, gridMode ) => {
    // Build locale Text bundle for 'Properties Information'
    let localePropInfoMap = exports.getPropInfoFromSOAResponse( variabilityData.soaResponse, gridMode );

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
        let columnViewModelObject = {};
        let awServerColumnProps = _.get( variabilityData, 'soaResponse.viewModelObjectMap.' + column.name + '.props' );

        const isConstraintRule = gridMode === veConstants.CFG_OBJECT_TYPES.ABS_CONSTRAINT_RULE ||
                                 gridMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
        if( isConstraintRule ) {
            let viewModelObjects = _.get( variabilityData, 'soaResponse.viewModelObjectMap.' + column.name + '.viewModelObject' );
            let parsedObject = JSON.parse( viewModelObjects );
            const viewModelObjectProps = parsedObject.props;

            if( viewModelObjectProps ) {
                Object.entries( viewModelObjectProps ).forEach( ( [ propertyDisplayName, uiValues ] ) => {
                    const propUiValue = _.get( uiValues, 'uiValues[0]', ' ' );
                    columnViewModelObject[ propertyDisplayName ] = {
                        propDisplayName: localePropInfoMap[ propertyDisplayName ],
                        propDisplayValue: propUiValue
                    };
                } );
            }
        }

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
            if( gridMode !== veConstants.GRID_CONSTANTS.MULTI_SVR_GRID && !( veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID in columnProps ) && !_.isUndefined( relatedObj ) ) {
                columnProps[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] = {
                    propDisplayName: relatedObj.props.object_type.propertyDescriptor.displayName,
                    propDisplayValue: relatedObj.props.object_type.uiValues[ 0 ],
                    parentAbstractClass: relatedObj.modelType.parentTypeName,
                    isPropertyNotFromCots: true // This property is not present in COTS file
                };
            }
        }
        column.viewModelObject = columnViewModelObject;
        column.props = columnProps;
    }
};

/**
 * Get Summary string for the family being collapsed
 * For MatrixRule in Condition section and all other rules:
 * --- map will contain familyUid as index, and value is a csv list of selected features
 * For MatrixRule in Subject section:
 * --- map will have two keys:
 * ------ familySelection: it contains selected disposition (displayName) for the family, if applicable
 * ------ features: it contains a sub-map with selected features and their dispositions
 * For Summary in Matrix/Subject section, a further processing is needed using delimiters enum provided by Server
 *
 * Summary string is evaluated for the selected feature: this will be appended on family cell uiValue
* This is needed when collapsing a family for summary and filtering purposes
* @param {Object} familyUid unique UID of the input family being collapsed
* @param {Object} summarySelectionMap map of selected features and feature dispositions for the input family
* @returns {String} formatted string for family Cell
*/
let _getFamilySummaryString = ( familyUid, summarySelectionMap ) => {
    if ( !_.isUndefined( summarySelectionMap[familyUid] ) ) {
        return summarySelectionMap[familyUid];
    }

    // Process Family Summary
    let familySummary = '';

    // For Summary in Matrix/Subject section:
    // format like "M" for family level selection only
    // format like "FeatureA: D, FeatureB: S" for feature-level selections only
    // format like "M {FeatureA: D, FeatureB: S}" for family-level and feature-level selections

    // Process Family-level selection
    if ( !_.isUndefined( summarySelectionMap.familySelection ) ) {
        familySummary += summarySelectionMap.familySelection;
    }

    // Process Features selections
    if ( !_.isUndefined( summarySelectionMap.features ) && summarySelectionMap.features !== '' ) {
        if ( familySummary === '' ) {
            familySummary += summarySelectionMap.features;
        } else {
            let matrixRuleSubjectDelimitersLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).matrixRuleSubjectDelimitersLov;
            let featureStartsWith = matrixRuleSubjectDelimitersLov.find( item => item.lovKey === '{' );
            let featureEndsWith = matrixRuleSubjectDelimitersLov.find( item => item.lovKey === '}' );
            familySummary += ' ' + featureStartsWith.displayName + summarySelectionMap.features + featureEndsWith.displayName;
        }
    }
    return familySummary;
};

/**
 * Add trailing whitespace to string if it's not a special character
 * @param {String} inputString Input String
 * @returns {String} The Input String with or without trailing Whitespace
 */
let _addTrailingWhitespaceIfNotSpecialCharacter = ( inputString ) => {
    // Define a regular expression pattern for special characters
    const specialCharPattern = /[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/;
    // Check if the string contains special characters
    specialCharPattern.test( inputString );
    if ( specialCharPattern.test( inputString ) ) {
        // If special characters are present, return the original string without adding whitespace
        return inputString;
    }
    // If special characters are not present, add trailing whitespace
    return inputString + ' ';
};

/**
 * Update map of selected feature dispositions: it will be used to build Family Summary string
 * @param {Object} selectionState selectionState of selected item from dropdown
 * @param {Object} summarySelectionMap map of selected Feature dispositions
 * @param {String} selectedItemDisplayName vmo displayName to append
 * @param {Array} featureDispositionsLov - LOV for feature dispositions
 * @param {Array} matrixRuleSubjectDelimitersLov - LOV for MatrixRule Delimiters for subject section
 */
let _updateSummaryFeatureDispositionSelectionMap = ( selectionState, summarySelectionMap, selectedItemDisplayName, featureDispositionsLov, matrixRuleSubjectDelimitersLov ) => {
    // Context holds information about all dispositions (non-filtered for family/feature use case)
    let selectedDisposition = featureDispositionsLov.find( item => item.operatorCode === selectionState );
    let lovKey = selectedDisposition.lovKey;

    // Special case for 'M'
    // Add empty entry, indexed by 'M' if family is selected
    if ( lovKey === 'M' ) {
        summarySelectionMap.familySelection = selectedDisposition.displayName;
    } else {
        if ( _.isUndefined( summarySelectionMap.features ) ) {
            summarySelectionMap.features = '';
        }
        let featureDispositionsSummary = summarySelectionMap.features;
        if ( featureDispositionsSummary.length >= 1 ) {
            let featureSeparator = matrixRuleSubjectDelimitersLov.find( item => item.lovKey === ',' );
            featureDispositionsSummary += featureSeparator.displayName + ' ';
        }
        let featureAndDispositionSeparator = matrixRuleSubjectDelimitersLov.find( item => item.lovKey === ':' );
        featureDispositionsSummary += selectedItemDisplayName;
        featureDispositionsSummary += featureAndDispositionSeparator.displayName + ' ';
        featureDispositionsSummary += selectedDisposition.displayName;
        summarySelectionMap.features = featureDispositionsSummary;
    }
};

/**
 * Get the summary string for the selection node
 * @param {Object} familyUid unique UID of the input family being collapsed
 * @param {Object} selectionState selectionState of the selectionNode (family/feature) for the input family
 * @param {Object} selectionNodeUid nodeUid of the selectionNode (family/feature) for the input family
 * @param {String} selectedItemDisplayName displayName of the selectionNode (family/feature) for the input family
 * @returns {String} summary string for the selection node
 */
let _getSelectionNodeSummaryString = ( familyUid, selectionState, selectionNodeUid, selectedItemDisplayName ) => {
    if( !pca0OperatorDisplayStrings ) {
        pca0OperatorDisplayStrings = JSON.parse( sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS ) );
    }
    let selectionNodeSummaryString = '';
    if ( ( selectionState === 1 || selectionState === 9 || selectionState === 5 ) && familyUid === selectionNodeUid ) {
        selectionNodeSummaryString = anyTitle;
    } else if ( ( selectionState === 2 || selectionState === 10 || selectionState === 6 ) && familyUid === selectionNodeUid ) {
        selectionNodeSummaryString = noneTitle;
    } else if ( selectionState === 1 || selectionState === 9 || selectionState === 5 ) {
        selectionNodeSummaryString += selectedItemDisplayName;
    } else if ( selectionState === 2 || selectionState === 10 || selectionState === 6 ) {
        selectionNodeSummaryString += _addTrailingWhitespaceIfNotSpecialCharacter( pca0OperatorDisplayStrings.k_variant_op_not ) + selectedItemDisplayName;
    }
    return selectionNodeSummaryString;
};

/**
 * Process selectionEntry to build Summary String for the family being collapsed
 * @param {Object} familyUid unique UID of the input family being collapsed
 * @param {Object} selectionState selectionState of the selectionNode (family/feature) for the input family
 * @param {Object} selectionNodeUid nodeUid of the selectionNode (family/feature) for the input family
 * @param {String} selectedItemDisplayName displayName of the selectionNode (family/feature) for the input family
 * @param {Object} summarySelectionMap map of selected features and feature dispositions for the input family
 * @param {boolean} isSingleSelect True if Family is single select
 */
let _processSelectionEntryForSummary = ( familyUid, selectionState, selectionNodeUid, selectedItemDisplayName, summarySelectionMap, isSingleSelect ) => {
    // Validate the type of selectionState: if it belongs to featureDisposition operatorCode, process for matrix mode
    let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    let featureDispositionOpCodes = [];
    if ( !_.isUndefined(  _.get( configuratorCtx, 'featureDispositionsLov' ) ) ) {
        featureDispositionOpCodes = _.map( configuratorCtx.featureDispositionsLov, 'operatorCode' );
    }

    if ( featureDispositionOpCodes.includes( selectionState ) ) {
        // For MatrixRule in Subject section: build and update a selection map of all featureDispositions
        // indexed by featureDisposition Key
        _updateSummaryFeatureDispositionSelectionMap( selectionState, summarySelectionMap, selectedItemDisplayName,
            configuratorCtx.featureDispositionsLov, configuratorCtx.matrixRuleSubjectDelimitersLov );
    } else {
        // For MatrixRule in Condition section and all other constraint types:
        // build and update the selection map at a constant key to incrementally build a summary string
        if ( _.isUndefined( summarySelectionMap[familyUid] ) ) {
            summarySelectionMap[familyUid] = ''; // initialize with empty string for familyUid
        }

        let selectionNodeSummaryString = _getSelectionNodeSummaryString( familyUid, selectionState, selectionNodeUid, selectedItemDisplayName );

        let summaryString = summarySelectionMap[familyUid];
        if ( summaryString.length >= 1 && selectionNodeSummaryString !== '' ) {
            summaryString += ' ';
            if ( isSingleSelect ) {
                summaryString += _addTrailingWhitespaceIfNotSpecialCharacter( pca0OperatorDisplayStrings.k_variant_op_or );
            } else {
                summaryString += _addTrailingWhitespaceIfNotSpecialCharacter( pca0OperatorDisplayStrings.k_variant_op_and );
            }
        }
        summaryString += selectionNodeSummaryString;
        summarySelectionMap[familyUid] = summaryString;
    }
};

/**
 * Function to know if input node is free form selection or enumerated range selection or unconfigured selection.
 * @param {Object} props - node props
 * @return {Boolean} true if a node is freeform \ enumerated range \ unconfigured selection.
 */
let _isSelectionFreeFormOrRangeOrUnconfigured = function( props ) {
    return _.get( props, 'isFreeFormFamily[0]' ) === 'true' ||
    _.get( props, 'isEnumeratedRangeExpressionSelection[0]' ) === 'true' ||
    _.get( props, 'isUnconfigured[0]' ) === 'true';
};

/** Returns Family alternate Uid for Free Form uids
 *
 * @param {String} alternateID alternate uid
 * @returns {String} family alternate uid
 */
let _extractFamilyAlternateUidFromFreeFormUid = ( alternateID ) => {
    let arr = alternateID.split( ':' );
    let ret = alternateID;
    //find the one that has the same name as the parent as the ff features are in the form: ...:iQpRXj4hJ6JDmB:iQpRXj4hJ6JDmB:200
    const duplicates = arr.filter( node => arr.indexOf( node ) !== arr.lastIndexOf( node ) );
    const famIndexes = arr.reduce( ( indexes, a, i ) => {
        if ( duplicates.includes( a ) ) {
            indexes.push( i );
        }
        return indexes;
    }, [] );
    if ( famIndexes.length > 1 ) {
        ret = arr.slice( 0, famIndexes[1] ).join( ':' );
    }
    return ret;
};

/**
 * Get the unique node UID for a selection node.
 * @param {Object} selectionNode - The selection node.
 * @param {ViewModelTreeNode} viewModelTreeNode - Family tree node being collapsed.
 * @param {String} gridMode - Mode of the grid.
 * @param {Object} [variabilityTreeNodes] - All tree nodes needed only for unconfigured linkage.
 * @param {Object} viewModelObjectMap - Map of VMOs as from soaResponse.
 * @returns {String} Unique node UID.
 */
let _getUniqueNodeUid = ( selectionNode, viewModelTreeNode, gridMode, variabilityTreeNodes, viewModelObjectMap ) => {
    let uniqueNodeUid = selectionNode.nodeUid;

    if ( selectionNode.nodeUid === '' && _isSelectionFreeFormOrRangeOrUnconfigured( selectionNode.props ) ) {
        // This has to be done if node have freeForm selection\enumerated range Or node is unconfigured.
        uniqueNodeUid = selectionNode.family !== '' ? selectionNode.family + ':' + selectionNode.valueText :
            selectionNode.familyNamespace + ':' + selectionNode.familyId + ':' + selectionNode.valueText;
    } else if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID && _isSelectionFreeFormOrRangeOrUnconfigured( selectionNode.props ) ) {
        //the unconfigured use case is with a nodeUid like: "famUid:UnconfiguredTextValue" but there is a chance, depending on the scenario, in which
        //the nodeUid is not part of the children, as the child might be configured in anotehr svr and it's tranmitted withits real Uid. So use the
        //variabilityTreeNodes to get the real nodeUid and build the summary string as it this would be configured in the current svr
        let node = variabilityTreeNodes.find( node => {
            return node.nodeUid !== uniqueNodeUid && viewModelTreeNode.childrenUids && viewModelTreeNode.childrenUids.includes( node.nodeUid ) &&
                viewModelObjectMap[node.nodeUid] && viewModelObjectMap[node.nodeUid].displayName === selectionNode.valueText;
        } );
        if ( node ) {
            uniqueNodeUid = node.nodeUid; //it's a fake temporary nodeUid to create the summary string for the unconfigured node that is not a child of the node as in famUid:UnconfiguredTextValue
        }
    }

    return uniqueNodeUid;
};

/**
 * Check if a selection is relevant for the summary.
 * @param {Object} selectionNode - The selection node.
 * @param {ViewModelTreeNode} viewModelTreeNode - Family tree node being collapsed.
 * @param {String} uniqueNodeUid - Unique node UID.
 * @returns {Boolean} True if the selection is relevant, false otherwise.
 */
let _isSelectionRelevant = ( selectionNode, viewModelTreeNode, uniqueNodeUid ) => {
    return selectionNode.selectionState !== 0 && viewModelTreeNode.uid === uniqueNodeUid ||
        !_.isUndefined( viewModelTreeNode.childrenUids ) && viewModelTreeNode.childrenUids.includes( uniqueNodeUid );
};

/**
 * Get the display name for a selection node.
 * @param {String} uniqueNodeUid - Unique node UID.
 * @param {Object} selectionNode - The selection node.
 * @param {Object} viewModelObjectMap - Map of VMOs as from soaResponse.
 * @param {String} gridMode - Mode of the grid.
 * @returns {String} Display name.
 */
let _getDisplayName = ( uniqueNodeUid, selectionNode, viewModelObjectMap, gridMode ) => {
    return gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ? viewModelObjectMap[uniqueNodeUid]
        ? viewModelObjectMap[uniqueNodeUid].displayName
        : selectionNode.valueText
        : viewModelObjectMap[uniqueNodeUid].displayName;
};

/** Helper that expands recursively all the nodes leading to a family up to the point of collapsing node but not including it
 *
 * @param {Object} familyNode familyNode
 * @param {Object} vmos tree data provider nodes
 * @param {Object} viewModelTreeNode viewModelTreeNode that gets collapsed
 */
let _recursiveExpandAllNodesHigherThanFamily = ( familyNode, vmos, viewModelTreeNode ) => {
    let higherNodeUId = familyNode.alternateID.split( ':' ).slice( 0, -1 ).join( ':' );
    let higherNode = vmos?.find( node => node.alternateID === higherNodeUId );

    if ( higherNode && viewModelTreeNode.alternateID !== higherNodeUId ) {
        higherNode.isExpanded = true; //the node will be expanded so make sure the icon is shown correctly
        _recursiveExpandAllNodesHigherThanFamily( higherNode );
    }
};

/**
 *  * Clearing the summary text on the family if one of the above nodes collapsed, so when we expand it again it's not showing summary and feature underneath.
 * Evaluate summary string for selection node belonging to a family being collapsed
 * Summary string is evaluated for the selected feature:
 * -- this will be appended on family cell uiValue
 * This is needed when collapsing a family for summary and filtering purposes
 * @param {Object} mapSelections map of selections for a given Constraint Rules
 * @param {ViewModelTreeNode} viewModelTreeNode family treeNode being collapsed
 * @param {Object} viewModelObjectMap map of VMOs as from soaResponse
 * @param {String} gridMode - Mode of the grid. (e.g., 'multiSvrGrid', 'Cfg0AbsMatrixRule')
 * @param {Object} [vmos] - all tree data provider objects, needed only for multiSvrGrid
 * @param {String} [svrKey] - column key, needed only for multiSvrGrid
 * @param {Object} [variabilityTreeNodes] - all tree nodes needed only for unconfigured linkage as we build the summary string and the child actually does not exist
 * @param {Array} [businessObjectToSelectionMapKeys] - keys of the mapSelections, needed only for performance
 * @returns {String} summary string for the family being collapsed
 */
let _buildFamilySelectionSummary = ( mapSelections, viewModelTreeNode, viewModelObjectMap, gridMode, vmos, svrKey, variabilityTreeNodes,  businessObjectToSelectionMapKeys ) => {
    // Build selection map
    // This will be used to add features/feature dispositions selected
    let summarySelectionMap = {};
    let ret = '';

    //depending if the node is relevant to summary text ( family node or not ) we need to either delete all the summary texts in the lower hierarchy
    //or add the summary text to the collapsing fam
    //get all relevant selections for node collapsed:

    //performance: this can be slow for a large number of mapSelections, so we are not using _.filter, includes etc. to determine it
    //but the most performant way for our use case, reaching the block of keys, adding them all then stopping the iteration
    let relevantNodeSelectionsKeys = [];
    if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID && businessObjectToSelectionMapKeys ) {
        // solution to not unnecessary iterate once the block of relevant keys in the map has been discovered - the keys are sorted coming into it
        for ( let key of businessObjectToSelectionMapKeys ) {
            if ( key.startsWith( viewModelTreeNode.alternateID ) ) {
                relevantNodeSelectionsKeys.push( key );
            } else if ( relevantNodeSelectionsKeys.length > 0 ) {
                // Stop the loop once we have found all relevant keys
                break;
            }
        }
    } else {
        relevantNodeSelectionsKeys = gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID
            ? _.filter( Object.keys( mapSelections ), k => _.includes( k, viewModelTreeNode.alternateID ) )
            : Object.keys( mapSelections ).sort();
    }

    if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID && !viewModelTreeNode.isFamily ) {
        //get all relevant selections for node collapsed:
        //no need to recurse, this is a flat object list based on the hierarchy
        relevantNodeSelectionsKeys.forEach( mapKey => {
            let relevantNode = vmos.find( node => node.alternateID === mapKey );
            if ( relevantNode && ( relevantNode.isFeature || relevantNode.isParentFreeForm || relevantNode.isParentEnumerated ) ) {
                let famUId = relevantNode.alternateID.split( ':' ).slice( 0, -1 ).join( ':' );
                if ( relevantNode.isParentFreeForm || relevantNode.isParentEnumerated ) {
                    famUId = _extractFamilyAlternateUidFromFreeFormUid( relevantNode.alternateID );
                }
                let familyNode = vmos.find( node => node.alternateID === famUId );
                if ( familyNode ) {
                    familyNode.props[svrKey].uiValue = '';
                    familyNode.isExpanded = true; // the node will be expanded so make sure the icon is shown correctly
                    _recursiveExpandAllNodesHigherThanFamily( familyNode, vmos, viewModelTreeNode );
                }
            }
        } );
        //delete all the former texts on all the underneath families
    } else {
        // Reorder the relevantNodeSelectionsKeys to match the order of viewModelTreeNode.childrenUids
        // We need to ensure iteration order, this will avoid flaky failures when validating summary content in ATDD
        if( relevantNodeSelectionsKeys.length > 1 && gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
            // Check if the family node is relevant itself, has a new selection or had a selection that got removed
            // which is the only case in which the family and a feature underneath can coexist for a column
            let shouldAddNodeItself = relevantNodeSelectionsKeys.includes( viewModelTreeNode.alternateID );

            relevantNodeSelectionsKeys = viewModelTreeNode.childrenUids
                .filter( uid => relevantNodeSelectionsKeys.some( key => key.endsWith( `:${uid}` ) ) )
                .map( uid => relevantNodeSelectionsKeys.find( key => key.endsWith( `:${uid}` ) ) );
            if( shouldAddNodeItself ) {
                relevantNodeSelectionsKeys.push( viewModelTreeNode.alternateID );
            }
        }

        relevantNodeSelectionsKeys.forEach( mapKey => {
            // Validate if selection belongs to the family or its features
            let selectionNode = mapSelections[mapKey];
            // we have to rely on alt id because of the module hierarchy in the multivariants tab not the  viewModelTreeNode.uid
            if ( mapKey.indexOf( viewModelTreeNode.uid ) > -1 ) {
                let uniqueNodeUid = _getUniqueNodeUid( selectionNode, viewModelTreeNode, gridMode, variabilityTreeNodes, viewModelObjectMap );

                if ( _isSelectionRelevant( selectionNode, viewModelTreeNode, uniqueNodeUid ) ) {
                    let displayName = _getDisplayName( uniqueNodeUid, selectionNode, viewModelObjectMap, gridMode );

                    _processSelectionEntryForSummary(
                        viewModelTreeNode.uid, // familyUid
                        selectionNode.selectionState, // selectionState
                        uniqueNodeUid, // selectionNode [unique] Uid
                        displayName, // selectedItemDisplayName
                        summarySelectionMap, // features/feature dispositions selection map
                        viewModelTreeNode.isSingleSelect //is Family single select
                    );
                }
            }
        } );
        ret = _getFamilySummaryString( viewModelTreeNode.uid, summarySelectionMap );
    }

    return ret;
};

/**
 * This function checks the treenodes and filter out the extra nodes from variabilityTreeData in the SOA response.
 * This is being used when we apply filters on multiple columns in the grid.
 * @param {Object} treeNodes - VMO nodes
 * @param {Object} soaResponse - SOA response
 */
const _filterSoaResponseWithTreeNodes = ( treeNodes, soaResponse ) => {
    const nodesToKeep = treeNodes.map( node => node.uid );
    soaResponse.variabilityTreeData = soaResponse.variabilityTreeData.filter( node => {
        if ( node.nodeUid === '' ) {
            node.childrenUids = node.childrenUids.filter( uid => nodesToKeep.includes( uid ) );
            return true; // Keep root node
        } else if ( _.get( soaResponse, `viewModelObjectMap[${node.nodeUid}].props.isFeature[0]` ) === 'true' ) {
            return true; // Keep all features
        }
        return nodesToKeep.includes( node.nodeUid );
    } );
};

/**
 * Expands and filters tree nodes based on active filters and expansion state.
 *
 * This function is responsible for expanding the children of a given tree node and applying any active column filters.
 * 1.When a filter is applied, the tree node hierarchy will be expanded up to the nodes, that satisfy the filter.
 * 2. When a node is expanded manually, the function checks if either the node itself or its parent node (for Multi-SVR grids) satisfies the filter criteria.
 * If so, it allows the node's children to expand and updates the tree structure accordingly.
 * Based on the grid's expansion mode (expand all or collapse all), it uses the appropriate action.
 * recursive tree node creation method.
 *
 * @param {Boolean} isManualExpand - True if the expansion is triggered manually by the user; false otherwise.
 * @param {Boolean} isConstraintsGrid - True if the grid is a constraints grid.
 * @param {Object} inputNode - The node being expanded, which contains children UIDs and other properties.
 * @param {Number} expandingLevel - Level # for the node being expanded.
 * @param {Object} variabilityProps - Variability properties containing active filters and other configurations.
 * @param {String} contextKey - Context key of the tree nodes.
 * @param {Object} rootNode - The root node for expansion.
 * @param {Array} treeNodes - Array of tree nodes to be processed.
 * @param {Object} soaResponse - SOA response containing variability tree data.
 * @param {Object} gridData - Grid data containing business object to selection map and other configurations.
 * @param {Object} gridColumns - Grid columns configuration.
 * @param {Array} subsetUIDs - Subset UIDs for filtering.
 * @param {Boolean} isBottomConstraintsGrid - True if grid is a bottom constraints grid.
 * @param {String} gridID - ID of the grid.
 * @return {Array} - The updated array of tree nodes after expansion and filtering.
 * */
let _expandAndFilterTreeNodes = ( isManualExpand, isConstraintsGrid, inputNode, expandingLevel, variabilityProps, contextKey, rootNode, treeNodes, soaResponse, gridData, gridColumns,
    subsetUIDs, isBottomConstraintsGrid, gridID ) => {
    let filteredColumns = variabilityProps.activeFilter ? [ ...variabilityProps.activeFilter ] : [];
    // filtercollection object is used to store filteredNodeUids & acceptedNodeUids array
    let filterCollection = {};
    // filteredNodeUids is used to store the alternateIDs of filtered nodes after each filter is applied
    // so that we can use these previously filtered out alternateIDs for the next filter.
    // acceptedNodeUids is used to store the alternateIDs that are accepted after applying the filters in collapsed mode.
    // Scenario: When a filter is applied and a family node satisfies the filter, we do not show its child nodes in collapsed mode. To handle this,
    // the child nodes alternateID are stored in acceptedNodeUids. Later, these acceptedNodeUids are added to filteredNodeUids, which can then be used to expand the corresponding tree nodes.

    // If multiple column filters are active, apply each filter sequentially to progressively narrow down the tree nodes.
    //This code checks if a filter is applied to a column in the grid.
    ( variabilityProps.activeFilter || [ {} ] ).forEach( filter => {
        // If the treeNode is not Manually expanded, we can skip it.
        // If the filter is not applied, we can skip it.
        if ( filter.values && isManualExpand ) {
            // we are filtering expanded rootNode based on the active filter
            //If a filter is present, it determines whether the expanded rootNode meets the filter criteria,
            //which is required to allow its children to be expanded.
            //For Multi-SVR grids, the code also checks the group node (the parent of the node being expanded).
            //For example, if a filter matches the group node but not the node being expanded (such as when the node is a family node),
            //all children of that node should still be expanded, since the group node satisfies the filter criteria.
            let filterSatisfied = false;
            // For Multi-SVR grids, check the group node
            // If the expanded rootNode is a family node, we need to check the group node for filter satisfaction.
            if ( rootNode.isFamily && gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
                const groupNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
                    contextKey, // contextKey
                    rootNode.parentUID, // nodeUid for group node
                    rootNode.levelNdx - 1, // levelNdx
                    undefined, // parentNodeUid
                    undefined, // alternateID
                    1, //childNdx
                    soaResponse, // soaResponse
                    gridData.businessObjectToSelectionMap, //selectionMap
                    gridData.backupOfBusinessObjectToSelectionMap, //backupSelectionMap
                    !_.isUndefined( variabilityProps.specialBackgroundCells ) &&
                    variabilityProps.specialBackgroundCells.includes( rootNode.parentUID ), // isSpecialBackgroundCell
                    gridData, // top/bottom grid data
                    gridColumns, // columnInfos to extract newColumnProps
                    variabilityProps.splitColumnTypesMap // splitColumn type map
                );

                // Check if the group node satisfies the filter criteria
                // If the group node satisfies the filter, allow all children of the expanded rootNode to be expand.
                let groupDisplayName = _.get( groupNode, `props[${filter.columnName}].uiValue` );
                if ( groupDisplayName ) {
                    filterSatisfied = pca0CommonUtils.isFilterCriteriaSatisfied(
                        groupDisplayName,
                        filter.values,
                        filter.operation
                    );
                    if ( filterSatisfied ) {
                        filter.allowAllChild = rootNode.nodeUid;
                    }
                }
            }
            // nodeDisplayName is the value present in the column being filtered.
            let nodeDisplayName = _.get( rootNode, `props[${filter.columnName}].uiValue` );
            // if group node does not satisfy the filter, check the expanded rootNode itself
            // This is the case where we are filtering the expanded rootNode itself.
            if ( !filterSatisfied && nodeDisplayName ) {
                filterSatisfied = pca0CommonUtils.isFilterCriteriaSatisfied(
                    nodeDisplayName,
                    filter.values,
                    filter.operation
                );
                if ( filterSatisfied ) {
                    filter.allowAllChild = rootNode.nodeUid;
                }
            }
        } else if ( !isManualExpand ) {
            // Filter SOA response for Constraints: remove from rootNode.childrenUids all non matching UIDs.
            if ( isConstraintsGrid ) {
                rootNode.childrenUids = rootNode.childrenUids.filter( id => subsetUIDs.includes( id ) );
            } else {
                rootNode.childrenUids = _.uniq( inputNode.childrenUids );
            }
        }

        // this is the case where we are filtering the Children of the rootNode.
        if ( gridData.expandAll ) {
            pca0VariabilityTreeDisplayService.recursiveCreateTreeNode(
                contextKey, // contextKey
                rootNode, // rootNode
                expandingLevel, // levelNdx
                treeNodes, // treeNodes
                [], // childrenUids
                soaResponse, // soaResponse
                gridData.businessObjectToSelectionMap, // businessObjectToSelectionMap
                gridData.backupOfBusinessObjectToSelectionMap, // backupOfBusinessObjectToSelectionMap
                subsetUIDs, // subsetUIDs
                undefined, // collapseAllLevel
                undefined, // summaryLevel
                gridData, // gridData
                gridColumns, // gridColumns
                undefined, // columnInfos
                variabilityProps.splitColumnsMap, // splitColumnsMap
                filter, // filter
                isBottomConstraintsGrid, // isBottomConstraintsGrid
                gridID, // gridID
                filterCollection // filterCollection to store filteredNodeUids and acceptedNodeUids
            );
        } else {
            // When the Active display mode is 'families', we need to expand only those nodes which have some selections.
            if ( gridData.expansionMap ) {
                pca0VariabilityTreeDisplayService.recursiveCreateTreeNodeWithMap( contextKey, rootNode, expandingLevel, gridData.expansionMap, treeNodes, [],
                    soaResponse, gridData.businessObjectToSelectionMap, gridData.backupOfBusinessObjectToSelectionMap );
            } else {
                // When collapsing all, look for expand option for each dataProvider
                pca0VariabilityTreeDisplayService.recursiveCreateTreeNode(
                    contextKey, // contextKey
                    rootNode, // rootNode
                    expandingLevel, // levelNdx
                    treeNodes, // treeNodes
                    [],  // childrenUids
                    soaResponse, // soaResponse
                    gridData.businessObjectToSelectionMap, // businessObjectToSelectionMap
                    gridData.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
                    subsetUIDs, // subsetUIDs
                    gridData.expandOptions.collapseAllLevel, // collapseAllLevel
                    gridData.expandOptions.summaryLevel, // summaryLevel
                    gridData, // gridData
                    gridColumns, // gridColumns
                    undefined, // columnInfos
                    variabilityProps.splitColumnsMap, // splitColumnsMap
                    filter, // filter
                    isBottomConstraintsGrid, // isBottomConstraintsGrid
                    gridID, // gridID
                    filterCollection // filterCollection to store filteredNodeUids and acceptedNodeUids
                );
            }
        }

        // Store the filtered tree node alternateIDs in filteredNodeUids after each filter is applied
        if( filter.values ) {
            filterCollection.filteredNodeUids = filterCollection.acceptedNodeUids && filterCollection.acceptedNodeUids.length > 0 ?
                [ ...treeNodes.map( node => node.alternateID ), ...filterCollection.acceptedNodeUids ] :
                treeNodes.map( node => node.alternateID );
            delete filterCollection.acceptedNodeUids; // Remove acceptedNodeUids property after processing
        }

        if( filter.allowAllChild ) {
            delete filter.allowAllChild; // Remove allowAllChild property after processing
        }
        // Remove the column from the filteredColumns array. The column is removed to reduce the length of the filteredColumns array,
        // We don't need to clear treeNodes after the last filter is applied, because it's already the final result with all filters applied.
        filteredColumns = filteredColumns.filter( column => Object.keys( column ).length === 0 || column.columnName !== filter.columnName );
        if ( filteredColumns.length > 0 ) {
            treeNodes = [];
        }
    } );
    // treeNodes is the final result after applying all filters and expanding nodes
    return treeNodes;
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Util to get 'Properties Information' to display Data in labels/tooltips, etc.
 * e.g. {cfg0Message: 'Message'}
 * This is to avoid carrying entire variabilityTreeData for i18n purposes
 * [Property Names come localized from the server]
 * @param {Object} variabilitySoaResponse - soaResponse containing variability information
 * @param {Object} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @returns {Object} localized Prop Info Map
 */
export let getPropInfoFromSOAResponse = ( variabilitySoaResponse, gridMode ) => {
    let localePropInfoMap = {};
    const uid = gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ? '_Unassigned_' : veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID;
    let propInfoNode = variabilitySoaResponse.variabilityTreeData.find( node => node.nodeUid === uid );
    if( !_.isUndefined( propInfoNode ) ) {
        let vmoMap = variabilitySoaResponse.viewModelObjectMap;
        propInfoNode.childrenUids.forEach( propKey => {
            localePropInfoMap[propKey] = vmoMap[propKey].displayName;
        } );
    }
    return localePropInfoMap;
};

/**
 * Update the column width in the ColumnConfig based on the eventData.
 * @param {UwDataProvider} dataProvider - Grid Data provider
 * @param {Object} eventData - the eventData info container
 * @returns {Object} - New ColumnConfig to be updated
 */
export let handleColumnArrange = ( dataProvider, eventData ) => {
    let newColumnInfos = [ ...dataProvider.columnConfig.columns ];
    newColumnInfos.forEach( columnInfo => {
        const updatedWidth = eventData.columns.find( column => column.propertyName === columnInfo.propertyName )?.drawnWidth;
        if ( updatedWidth ) {
            columnInfo.width = updatedWidth;
            columnInfo.pixelWidth = updatedWidth;
        }
    } );
    if( eventData.reloadDataProvider ) {
        splmTablePublishedService.reloadTableWithDataProvider( dataProvider );
    }
    return {
        ...dataProvider.columnConfig,
        columns: [ ...newColumnInfos ]
    };
};

/**
 * Loads and configures grid columns based on the provided parameters.
 *
 * @param {Object} vmVariabilityProps - Variability properties from grids.
 * @param {Object} dataProvider - Data provider containing grid data.
 * @param {Object} vmGridSelectionState - Grid selection state.
 * @param {Array} serverColumns - Array of server columns. ( Columns coming from COTS as per clientScopeURI )
 * @param {string} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @param {Object} vmGridData - Grid data. ( It is being used only for Matrix use case )
 * @param {Object} gridSettings - Settings for the grid. ( It is an atomic data containing the grid settings from settings panel like column width, header orientation etc. )
 * @param {Object} gridOptions - Options for the grid. ( Object containting grid options like columnConfigId, clientScopeURI etc. )
 * @param {Boolean} isVCVOpenedFromConfigurator - Flag to indicate if VCV is opened from configurator.
 * @returns {Object} An object containing the configured columns.
 */
export let loadGridColumns = ( vmVariabilityProps, dataProvider, vmGridSelectionState, serverColumns, gridMode, vmGridData, gridSettings, gridOptions, isVCVOpenedFromConfigurator ) => {
    // VariabilityProps comes as:
    // - props (value/update) from Constraints top grid
    // - atomicData (get/set AtomicData) from multiSvr and Constraints buttom grid
    let variabilityProps = vmVariabilityProps.value ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    const gridId = _.get( dataProvider, 'json.gridId', '' );
    // This is temporary check, It will be removed when all views use same grid.
    const isCommonGrid = [ 'pca0Grid', 'multipleVariantsConfigGrid' ].includes( gridId );
    const isSubjectSectionForMatrixRule = gridMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE && !isCommonGrid;
    let contextKey = !_.isUndefined( isVCVOpenedFromConfigurator ) ? pca0Constants.FSC_CONTEXT : veConstants.CONFIG_CONTEXT_KEY;

    // Variability Columns
    let variabilityColumnProps = {
        enableColumnMenu: isCommonGrid,
        variabilityPropertiesToDisplay: variabilityProps.soaResponse.variabilityPropertiesToDisplay,
        serverColumns: serverColumns
    };

    const loadColumnsResult = pca0VariabilityTreeDisplayService.loadColumns(
        variabilityProps.columnProperties, // columnProperties
        variabilityColumnProps, // variabilityColumnProps
        contextKey, // contextKey
        dataProvider, // treeDataProvider
        vmGridSelectionState, // gridSelectionState
        true // skipCellRenderer
    );

    // Set cell Renderers
    let cellRenderer = _getColumnCellRenderer( dataProvider, vmGridSelectionState, vmVariabilityProps, vmGridData, gridMode, isSubjectSectionForMatrixRule, contextKey );

    loadColumnsResult.columnInfos.forEach( ( column ) => {
        // When the grid loads for the first time, it will not have any stored column widths, so the column widths will be set according to the grid settings.
        // Once a column is resized, the new width will be stored in columnConfig and will be used the next time the grid loads.
        let storedColumn = dataProvider.columnConfig ? dataProvider.columnConfig.columns.find( col => col.propertyName === column.propertyName ) : null;

        if( !column.isColumnFromCots  ) {
            // Set Cell Renderers as per variabilityProps.columnProperties
            let columnProps = variabilityProps.columnProperties.find( prop => prop.propertyName === column.propertyName );
            _setColumnCellRenderer( column, columnProps, cellRenderer );

            // Generate Column 'props'
            column.props = {};

            if( !column.isSplitColumn ) {
                _createColumnProps( column, variabilityProps, gridMode );
            }

            // Declare LOV component to display Lov Entries in dropdown
            // For Matrix Rule only in (Subject) Bottom grid
            if( isSubjectSectionForMatrixRule ) {
                column.renderingHint = veConstants.PCA_FEATURE_DISPOSITION_LOV_EDIT;
            }

            // For constraints grid the display name is already populated in the column properties when we create the column
            // And for buttom the display name is required to be blank, so adding the check for multiSvrGrid
            // TODO: Move this logic where we create the columns for multiSvrGrid as well. ( Function - loadColumns )
            if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
                let colInfo = _.filter( variabilityProps.columnProperties, ( col ) => {
                    return col.propertyUid === column.name;
                } );
                if ( colInfo.length > 0 ) {
                    column.displayName = colInfo[0].propertyDisplayName;
                }
            }

            if ( gridSettings ) {
                const width = storedColumn ? storedColumn.width : gridSettings.columnWidth;
                column.columnWidth = width;
                column.width = width;
            }
            column.maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
            column.minWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
        } else if ( !column.hiddenFlag ) { // Server columns which are not hidden
            if( storedColumn ) {
                column.columnWidth = storedColumn.width;
                column.width = storedColumn.width;
            }
            if ( gridMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
                column.cellRenderers.push( pca0RendererService.variabilityContentBackgroundRenderer );
                column.cellRenderers.push( pca0RendererService.rowHighlightRenderer );
            }
        }
    } );

    const columnConfig = {
        columns: loadColumnsResult.columnInfos,
        typesForArrange : [ 'Cfg0AbsOptionValue', 'Cfg0AbsOptionFamily' ]
    };
    // columnConfigId is required on the columnConfig to enable the new column arrangement 'Save' feature in arrange panel.
    if ( gridOptions?.columnConfigId ) {
        columnConfig.columnConfigId = gridOptions.columnConfigId;
    }
    return columnConfig;
};

/**
 * Filters the columnConfig and returns only the server columns.
 * @param {Array} columns - columns from treeDataProvider
 * @returns {Arrsay} - filtered server columns
 */
export let getGridServerColumns = ( columns ) => {
    // we are using associatedTypeName to identify the columns coming from cots file
    return columns.filter( column => column.associatedTypeName );
};

/**
 * Updates the column configuration after reset operation in VCA grid using soa response
 * @param {Object} soaResponse - soa response
 * @param {Object} dataProvider - tree data provider.
 * @param {Object} gridSelectionState - VM gridSelectionState atomic data
 * @param {String} contextKey - context key for the renderer.
 * @param {String} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @returns {Object} - updated column configuration
 */
export let postResetUpdateColumnConfig = ( soaResponse, dataProvider, gridSelectionState, contextKey, gridMode ) => {
    const cellRenderers = _getColumnCellRenderers( gridMode, contextKey, dataProvider, gridSelectionState );
    let updatedColumnConfig = _.cloneDeep( dataProvider.columnConfig );
    const updatedServerColumns = _.get( soaResponse, 'columnConfigurations[0].columnConfigurations[0].columns', [] );

    if ( updatedServerColumns.length > 0 ) {
        updatedServerColumns.forEach( ( updatedColumn ) => {
            const columnIndexToUpdate = updatedColumnConfig.columns.findIndex(
                existingColumn => existingColumn.propertyName === updatedColumn.propertyName
            );
            if ( columnIndexToUpdate !== -1 ) {
                updatedColumn.isColumnFromCots = true;
                updatedColumn.pinnedLeft = true;
                updatedColumn.cellRenderers = cellRenderers;
                updatedColumnConfig.columns[columnIndexToUpdate] = updatedColumn;
            }
        } );
    }
    return updatedColumnConfig;
};

/**
 * Updates the column configuration properties after arrange operation in VCA grid
 * @param {Object} soaResponse - soa response
 * @param {Object} dataProvider - tree data provider.
 * @param {Object} gridSelectionState - VM gridSelectionState atomic data
 * @param {String} contextKey - context key for the renderer.
 * @param {String} gridMode - Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @returns {Object} - updated column configuration
 */
export let postArrangeUpdateColumnConfig = ( soaResponse, dataProvider, gridSelectionState, contextKey, gridMode ) => {
    const cellRenderers = _getColumnCellRenderers( gridMode, contextKey, dataProvider, gridSelectionState );
    let columnConfig = _.cloneDeep( dataProvider.columnConfig );
    columnConfig.columns.forEach( column => {
        if( column.associatedTypeName && !column.hiddenFlag ) {
            column.pinnedLeft = true;
            column.isColumnFromCots = true;
            column.cellRenderers = cellRenderers;
        }
    } );
    return columnConfig;
};

/**
 * Handle Display Mode change
 * @param {Object} currentDisplayMode - Grid Editor's current display mode
 * @param {String} selectedDisplayMode - selected display mode from Toolbar (Show Current Expressions/Show All Features)
 * @returns {Object} - updated display mode(new state)
 */
export let handleDisplayModeChange = ( currentDisplayMode, selectedDisplayMode ) => {
    currentDisplayMode.activeDisplayMode = selectedDisplayMode;
    return currentDisplayMode;
};

/**
 * Resets node uids of type isUnconfigured, enumeratedFamilies & freeFormFamilies from selection
 * @param {Object} businessObjectToSelectionMap businessObjectToSelectionMap
 * @param {Array} svrUids svrUids - optional for the multiSvrGrid per column use case
 */
export const resetNodeUidFromSelection = ( businessObjectToSelectionMap, svrUids ) => {
    // In the Variants tab,
    // reset the nodeUid for unconfigured, enumeratedFamilies, and freeFormFamilies from the selected expression
    // for a specific variant rule during validation or expansion of the configuration.
    // svrUids - not a single svrUid - because for split columns we need to do that for the svcUid and every related split column
    if( svrUids && svrUids.length > 0 ) {
        svrUids.forEach( svrUid => {
            if ( svrUid && businessObjectToSelectionMap[svrUid] ) {
                Object.keys( businessObjectToSelectionMap[svrUid] ).forEach( key => {
                    const value = businessObjectToSelectionMap[svrUid][key];
                    if ( _isSelectionFreeFormOrRangeOrUnconfigured( value.props ) ) {
                        value.nodeUid = '';
                    }
                } );
            }
        } );
    } else {
        // For BOM FSC,
        // reset the nodeUid for unconfigured, enumeratedFamilies, and freeFormFamilies from the selected expression
        // for all variant rules during apply configuration.
        Object.values( businessObjectToSelectionMap ).forEach( selectionMap => {
            Object.values( selectionMap ).forEach( value => {
                if ( _isSelectionFreeFormOrRangeOrUnconfigured( value.props ) ) {
                    value.nodeUid = '';
                }
            } );
        } );
    }
};


/**
 * Centralized logic to process the editability for the Cell
 * @param {ViewModelTreeNode} treeNode - input VMO for which we need to process editability
 * @param {Boolean} isPropertyColumn true if column is propertyColumn
 * @returns {Boolean} true if Cell can be edited in bulk/direct edit
 */
export let isCellEditable = ( treeNode, isPropertyColumn ) => {
    if( isPropertyColumn || treeNode.isSpecialBackgroundCell ) {
        return false;
    }
    let isEditable = treeNode.isLeaf || treeNode.isExpanded;
    if( treeNode.isFamily && ( !treeNode.isSingleSelect || !treeNode.isOptional ) ) {
        isEditable = false;
    }
    return isEditable;
};

/**
 * Adjust ViewModelObject/ViewModelTreeNode Props in Subject Section when authoring Matrix Rules
 * In Subject section for given Column Definition:
 * - Enable LOV entries for Family/Feature dispositions (this is to show dropdown in edit mode)
 * - Overwrite some TreeNode properties to accommodate FeatureDisposition Key value instead of selection state
 * For Property columns or SpecialBackground cells (no editable values associated), set property as not modifiable
 * @param {Object} treeNode input ViewModelTreeNode
 * @param {Object} columnDef column Definition
 * @param {Boolean} enforceUIValueUpdate flag set to true if uiValue update must be enforced
 */
export let setSubjectVmoPropsInSnOMatrixGridEditor = ( treeNode, columnDef, enforceUIValueUpdate ) => {
    treeNode.props[ columnDef.name ].hasLov = true;
    treeNode.props[ columnDef.name ].isEnabled = true;
    treeNode.props[ columnDef.name ].isArray = false;

    // Get Value and assign to VMO
    let featureDispositionsLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov;
    let featureDisposition;
    if( treeNode.props[ columnDef.name ].dbValue !== 0 ) {
        featureDisposition = featureDispositionsLov.find( item => item.operatorCode === treeNode.props[columnDef.name].dbValue );
        assert( featureDisposition, 'Feature Disposition is not supported' );
    } else {
        // Setup temporary empty disposition
        featureDisposition = { lovKey: '', displayName: '', description: '', operatorCode: 0 };
    }
    let keyValue = featureDisposition.lovKey;
    let displayValue = featureDisposition.displayName;
    treeNode.props[ columnDef.name ].dbValue = featureDisposition.operatorCode;
    treeNode.props[ columnDef.name ].displayValues = [ displayValue ];
    treeNode.props[ columnDef.name ].originalValue = keyValue;
    treeNode.props[ columnDef.name ].prevDisplayValues = [ displayValue ];
    treeNode.props[ columnDef.name ].value = keyValue;

    // Set uiValue only for leaf or expanded nodes
    // (this is to avoid overwriting summary value)
    // OR if flag is set to enforce the UI value update
    // -- please refer to LCS-939645 for a new constraint being added:
    // --- if families are collapsed, we need to enforce uiValue update or we will get a '0'
    if( treeNode.isLeaf || treeNode.isExpanded || enforceUIValueUpdate ) {
        treeNode.props[ columnDef.name ].uiValue = displayValue;
    }

    // Fetch and set editability for the cell: this is necessary when starting full (bulk) edit mode
    let isEditable = exports.isCellEditable( treeNode, columnDef.isPropertyColumn );
    treeNode.props[ columnDef.name ].isEditable = isEditable;
    treeNode.props[ columnDef.name ].isModifiable = isEditable;
    treeNode.props[ columnDef.name ].isPropertyModifiable = isEditable;

    // Add/ Update the property ( isAddRangeNotSupported ) for the VMOs of the
    // subject section in Matrix grid
    if( treeNode.isEnumerated || treeNode.isFreeForm ) {
        treeNode.isAddRangeNotSupported = true;
    }
};


/**
 * Set uiValue of collapsed/expanded node
 * If family is collapsed, uiValue represents the summary for the family
 * @param {Object} selectionMap - businessObjectToSelectionMap
 * @param {ViewModelTreeNode} viewModelTreeNode treeNode which is collapsed/expanded to set uiValue which will be displayed as summary
 * @param {Object} viewModelObjectMap - From soaResponse (needed to read displayName of features)
 * @param {Array} columnInfos - columnDefinitions for the treeDataProvider containing the viewModelTreeNode
 * @param {Boolean} isBottomGrid - true if Summary is being evaluated for cells in bottom grid: special handling needed for Matrix Rules
 * @param {String} gridMode - Mode of the grid. (e.g., 'multiSvrGrid', 'Cfg0AbsMatrixRule')
 * @param {Object} [vmos] - all tree data provider objects, needed only for multiSvrGrid
 * @param {Array} [variabilityTreeNodes] - variability tree nodes, needed only for multiSvrGrid for linkage of the unconfigured nodes
 * @param {Object} businessObjectToSelectionMapKeys - keys of the mapSelections for better performance - optional
 * @returns {String} rowSummary string used for filtering purposes
 */
export let updateViewModelTreeNodeSummary = ( selectionMap, viewModelTreeNode, viewModelObjectMap, columnInfos, isBottomGrid, gridMode, vmos, variabilityTreeNodes, businessObjectToSelectionMapKeys ) => {
    let rowSummary = '';

    Object.entries( selectionMap ).forEach(
        ( [ mapKey /*constraintRule UID*/, mapSelections /*selections indexed by node alternateID*/] ) => {
            let selectionDisplayStr = '';

            // [LCS-1020457] NOTE of misalignment:
            // If user quickly selects items one by one in PWA,
            // Our logic might not have the time to fully process SOA response and create columns.
            // This is a risk of misalignment between selectionMap, VMOs and columnInfos.
            // This can cause a key in selectionMap to not be found in columns array
            // Fix: Proceed with summary update only for initialized columns
            // NOTE: eventually the final SOA response is processed without further overlapping
            // and data is displayed correctly
            let columnDef = columnInfos.find( column => column.name === mapKey );

            // Leave unchanged uiValue for property columns: cell won't change value if expanded/collapsed
            if ( !_.isUndefined( columnDef ) && !_.isUndefined( viewModelTreeNode.props[mapKey] ) ) {
                if ( columnDef.isPropertyColumn ) {
                    selectionDisplayStr = viewModelTreeNode.props[mapKey].uiValue;
                } else {
                    let isMatrixRuleColumn;
                    if ( columnDef.isSplitColumn ) {
                        isMatrixRuleColumn = columnDef.sourceType === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
                    } else {
                        let objType = _.get( columnDef, 'props.object_type.parentAbstractClass' );
                        isMatrixRuleColumn = objType ? objType === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE : false;
                    }

                    // If node is expanded, uiValue:
                    // - must be reset "" for:
                    // --- MatrixRule in Condition Section and for all other constraint types in both Subject/Condition sections
                    // - must be set as current featureDisposition string for MatrixRule in Subject Section
                    // If node is collapsed, uiValue:
                    // - must be reset "" for:
                    // --- MatrixRule in Condition Section and for all other constraint types in both Subject/Condition sections
                    // - must be set as current featureDisposition string for MatrixRule in Subject Section
                    if ( viewModelTreeNode.isExpanded ) {
                        if ( isMatrixRuleColumn && isBottomGrid ) {
                            selectionDisplayStr = viewModelTreeNode.props[mapKey].value;
                        } else {
                            selectionDisplayStr = '';
                        }
                    } else {
                        // Note on values for isExpanded:
                        // - undefined comes from cfx when manually collapsing node
                        // - false value when tree is being loaded recursively
                        let businessObjectToSelectionMapKeysForColumn = businessObjectToSelectionMapKeys ? businessObjectToSelectionMapKeys[mapKey] : undefined;
                        selectionDisplayStr = _buildFamilySelectionSummary( mapSelections, viewModelTreeNode, viewModelObjectMap, gridMode,
                            vmos, mapKey, variabilityTreeNodes, businessObjectToSelectionMapKeysForColumn );
                    }
                    rowSummary += selectionDisplayStr + ' ';
                    viewModelTreeNode.props[mapKey].uiValue = selectionDisplayStr;
                }
            }
        } );
    return rowSummary;
};

/**
 * Update summary for input View Model Tree Node
 * @param {ViewModelTreeNode} viewModelTreeNode - ViewModelTreeNode toggled in the grid
 * @param {UwDataProvider} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Object} gridData - grid Information container (including selection map for the grid)
 * @param {String} gridMode - Mode of the grid. (e.g., 'multiSvrGrid', 'Cfg0AbsMatrixRule')
 */
export let updateNodeSummary = ( viewModelTreeNode, treeDataProvider, gridData, gridMode ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let updatedVMOs = [ ...vmos ];
    let vmo = updatedVMOs.find( vmo => vmo.alternateID === viewModelTreeNode.alternateID );
    let gridProps = gridData.getValue ? gridData.getValue() : gridData.getAtomicData();
    let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    let allVmos = treeDataProvider.topTreeNode?.children;
    allVmos = allVmos ? allVmos : vmos;

    // Update VMOs
    exports.updateViewModelTreeNodeSummary(
        gridProps.businessObjectToSelectionMap, // selectionMap
        vmo, // viewModelTreeNode,
        gridProps.viewModelObjectMap, // viewModelObjectMap
        treeDataProvider.columnConfig.columns, // column Infos
        isBottomGrid, // isBottomGrid
        gridMode, // gridMode
        allVmos, // all tree data provider objects
        gridProps.variabilityNodes // variability tree nodes,
    );

    // Adjust TreeNodes Props for Subject section
    let isSnOMatrixGridEditor = gridMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    if ( isSnOMatrixGridEditor && isBottomGrid ) {
        treeDataProvider.columnConfig.columns.forEach( columnDef => {
            if ( !columnDef.isColumnFromCots ) {
                exports.setSubjectVmoPropsInSnOMatrixGridEditor( vmo, columnDef );
            }
        } );
    }

    if ( !viewModelTreeNode.isExpanded ) {
        // Call dispatch on data provider
        treeDataProvider.update( updatedVMOs, updatedVMOs.length );
    }
};

/**
 * Update Summary on all Family nodes
 * @param {UwDataProvider} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Object} selectionMap businessObjectToSelectionMap
 * @param {Object} viewModelObjectMap VMO map
 * @param {Boolean} skipDataProviderUpdate True if DataProvider update action must be skipped
 */
export let updateAllNodesSummary = ( treeDataProvider, selectionMap, viewModelObjectMap, skipDataProviderUpdate ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let isBottomGrid = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    vmos.forEach( vmo => {
        if ( !vmo.isLeaf && !vmo.isExpanded ) {
            exports.updateViewModelTreeNodeSummary(
                selectionMap, // selectionMap
                vmo, // tree node being collapsed/expanded
                viewModelObjectMap, // VMO map
                treeDataProvider.columnConfig.columns, // column Infos
                isBottomGrid
            );
        }
    } );

    if ( !skipDataProviderUpdate ) {
        treeDataProvider.update( vmos, vmos.length );
    }
};

/**
 * Populate data provider with subsets processed out of the soaResponse.
 * Also, it take care of following things
 * 1. Filtering ( Column level, Similar/Different Display Modes )
 * 2. Highlight difference.
 * 3. Expand all.
 * @param {Object} treeLoadInput - nodeBeingExpanded for the Tree Table
 * @param {UwDataProvider} gridDataProvider - DataProvider to be initialized/loaded
 * @param {UwDataProvider} columnProvider - column provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} gridProps - Properties for respective grid
 * @param {String} gridEditorMode - Active grid Editor mode
 * @param {Object} gridOptions - grid options, including clientScopeURI and columnConfigID
 * @param {Object} gridSettings - grid Settings to pass down for compare determination of including or not severity
 * @param {Array} beforeCompareVmos - Vmos before compare
 * @param {Object} displayMode - Grid Editor active Display Mode
 * @param {Object} formerResult - Former result to compare with
 * @param {Boolean} isVCVOpenedFromConfigurator - Flag to indicate if VCV is opened from configurator
 * @returns {Object} TreeLoadResult for the Tree Table
 */
export let loadGridDataProvider = ( treeLoadInput, gridDataProvider, columnProvider, vmVariabilityProps, gridProps, gridEditorMode, gridOptions,
    gridSettings, beforeCompareVmos, displayMode, formerResult, isVCVOpenedFromConfigurator ) => {
    if( !pca0OperatorDisplayStrings ) {
        pca0OperatorDisplayStrings = JSON.parse( sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS ) );
        anyTitle =  _.isUndefined( localeTextBundle.anyTitle ) ? pca0OperatorDisplayStrings.k_variant_optional_family_any_value : localeTextBundle.anyTitle;
        noneTitle = _.isUndefined( localeTextBundle.noneTitle ) ? pca0OperatorDisplayStrings.k_variant_optional_family_none_value : localeTextBundle.noneTitle;
    }
    // Do not proceed until dataProvider columns are initialized
    if ( _.isUndefined( _.get( gridDataProvider, 'columnConfig.columns' ) ) || gridDataProvider.columnConfig.columns.length === 0 ) {
        return {
            gridTreeResult: {},
            beforeCompareVmos: beforeCompareVmos,
            highlightMode: displayMode?.highlightMode
        };
    }
    if ( !treeLoadInput && gridDataProvider.topTreeNode ) {
        treeLoadInput = gridDataProvider.topTreeNode;
    }

    let contextKey = !_.isNil( isVCVOpenedFromConfigurator ) ? pca0Constants.FSC_CONTEXT : veConstants.CONFIG_CONTEXT_KEY;
    const isBottomConstraintsGrid = gridDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    const isMultiSvrGrid = gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID;
    const topNodeId = pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY;

    let beforeVmos = beforeCompareVmos;
    let filteredGridTreeLoadResult = undefined;
    let highlightMode = _.get( displayMode, 'highlightMode' );
    if ( isMultiSvrGrid ) {
        //keep the before compare or not depending on the use case: reset for a full load, keep for a partial load on a node ( manual expand collapse on a node)
        if ( treeLoadInput.uid === topNodeId ) {
            beforeVmos = [];
            //reset the highlightedVmos if we do an expandAll/collapseAll - only if we need to
            if( highlightMode ) {
                highlightMode = pca0MultipleSVRsDisplayService.deHighlightDifferences( gridProps, gridDataProvider, displayMode );
            }
        }
        //if there is a compare/filter result followed by a group input node expansion, just return the former result, we are not expanding the group node with
        //all the non matching filtered nodes (rn a call to the dp with an input node will bypass the filtering, but this is something we should improve)
        // for pca0CommonUtils.isGroupType(), we are passing entire treeLoadInput object instead of treeLoadInput.type
        // because treeLoadInput.type is not always defined or not a valid type. For example, in case of custom features/groups
        if( formerResult && treeLoadInput.uid !== topNodeId && pca0CommonUtils.isGroupType( '', treeLoadInput ) && _.isNil( treeLoadInput.isInExpandBelowMode ) &&
        ( displayMode.activeDisplayMode === 'similar' || displayMode.activeDisplayMode === 'different' ) ) {
            return {
                gridTreeResult: formerResult,
                beforeCompareVmos: beforeVmos,
                highlightMode: highlightMode
            };
        }
    }

    // VariabilityProps and gridProps come as:
    // - props (value/update) from top constraint Grid
    // - atomicData (get/set AtomicData) from buttom Constraints grid and multiSvr Grid
    let variability = vmVariabilityProps.value ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    let gridData = gridProps.value ? { ...gridProps.getValue() } : { ...gridProps.getAtomicData() };

    if( !isBottomConstraintsGrid ) {
        // Check for active filters and update atomic data
        let columnFilters = columnProvider.columnFilters;
        if( columnFilters && columnFilters.length > 0 ) {
            variability.activeFilter = columnFilters;
        } else {
            delete variability.activeFilter;
        }
        vmVariabilityProps.setAtomicData ? vmVariabilityProps.setAtomicData( { ...variability } ) : vmVariabilityProps.update( { ...variability } );
    }

    let gridTreeResult = exports.getGridTreeResult(
        treeLoadInput, // nodeBeingExpanded
        variability, // variabilityProps
        gridDataProvider, // treeDataProvider
        gridData, //gridProps
        gridEditorMode, // grid editor mode
        contextKey // contextKey
    );

    //Compare SVRs for Similar/Different Display Modes if we are in one of the two modes that require basically an additional filtering on top of
    //the one done in the 'getGridTreeResult' API above;
    //this dp function is not getting called even as we are requested to compare if we are in the filtered state so the node filtering is done before the
    //compare filtering
    const activeDisplayMode = _.get( displayMode, 'activeDisplayMode' );
    if( isMultiSvrGrid && treeLoadInput.uid === topNodeId && ( activeDisplayMode === 'similar' || activeDisplayMode === 'different' ) ) {
        beforeVmos = gridTreeResult.childNodes; //use the filtered but not yet compared Vmos to store in the beforeVmos
        let similarCode = activeDisplayMode === 'similar' ? 0 : 2;
        let comparedSVRs = pca0MultipleSVRsDisplayService.compareSVRs( gridProps, gridDataProvider, similarCode, gridTreeResult.childNodes, false, activeDisplayMode, gridSettings );
        gridTreeResult.childNodes = comparedSVRs.comparisonVmos;
        filteredGridTreeLoadResult = gridTreeResult;
    }

    return {
        gridTreeResult: gridTreeResult,
        beforeCompareVmos: beforeVmos,
        highlightMode: highlightMode,
        filteredGridTreeLoadResult: filteredGridTreeLoadResult,
        objectSetUri: gridOptions?.clientScopeURI
    };
};


/**
 * This is a performace enhancing function to prepare the grid data for tree build:
 * it parses the soaResponse it sets the isUnconfiguredPresent, generates the businessObjectToSelectionMapKeys and sets the variabilityNodesMap on grid data
 * both allowing a faster retrieval of the nodes in the recursive code following
 * @param {Object} variabilityProps - Atomic props which holds extra details required to render tree like filtering text
 * @param {Object} gridData - gridData to set those props on
 * @returns {Object} - soaResponse
 */
export let prepareGridDataForTreeBuild = ( variabilityProps, gridData ) => {
    // faster deep copy of soaResponse
    // also determine if we need or not bother down the recursivity stream with unconfigured nodes
    let jsonString = JSON.stringify( variabilityProps.soaResponse );
    const isUnconfiguredPresent = jsonString.includes( 'isUnconfigured' );
    let soaResponse = JSON.parse( jsonString );

    //performance improvement - transform the varProps into a map for faster access
    if( gridData && !gridData.variabilityNodesMap ) {
        gridData.variabilityNodesMap = gridData.variabilityNodes?.reduce( ( map, prop ) => {
            map[prop.nodeUid] = prop;
            return map;
        }, {} );
    }
    //do this only once and reuse it down the stream when building summary, also sort them so you can break the search once block found
    let businessObjectToSelectionMapKeys = {};
    Object.entries( gridData.businessObjectToSelectionMap ).forEach( ( [ mapKey, mapSelections ] ) => {
        businessObjectToSelectionMapKeys[mapKey] = Object.keys( mapSelections ).sort();
    } );
    gridData.businessObjectToSelectionMapKeys = businessObjectToSelectionMapKeys;

    //set the isUnconfiguredPresent flag in the gridData
    isUnconfiguredPresent ? gridData.isUnconfiguredPresent = true : delete gridData.isUnconfiguredPresent;

    return soaResponse;
};

/**
 * Generate the Tree Load Result:
 * i.e. the stricture needed to feed the DataProvider in the splm-table in tree mode.
 * This function is exported to reduce the test complexity and efforts.
 * @param {ViewModelTreeNode} nodeBeingExpanded - Parent node that is expanded initial parent node is always "variabilityTreeData"
 * @param {Object} variabilityProps - Atomic props which holds extra details required to render tree like filtering text
 * @param {UwDataProvider} gridDataProvider - Tree Data Provider
 * @param {Object} gridData - Grid specific details: this function can be used as generic so consumer grid should pass required details to it.
 * @param {String} gridEditorMode active grid Editor mode (MatrixRule, grid editor, multiSvrGrid)
 * @param {String} contextKey - Unique Key for the active context
 * @returns {Object} - The Tree Load Result
 */
export let getGridTreeResult = ( nodeBeingExpanded, variabilityProps, gridDataProvider, gridData, gridEditorMode, contextKey ) => {
    let parentNode = nodeBeingExpanded;
    let subsetUIDs = gridData.gridNodes; //UIDs for the subset rootNodes to be displayed
    /**
     * <TODO>
     * variabilityProps is intended to store basic details, not whole response
     * Need to remove soaResponse from variabilityProps
     */
    //prepare the gridData with props that will be used in the tree build in a more performant way
    let soaResponse = exports.prepareGridDataForTreeBuild( variabilityProps, gridData );

    let treeNodes = [];
    let variabilityNodes = gridData.variabilityNodes;
    let inputNode = _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } );
    let gridColumns = gridDataProvider.columnConfig.columns;
    const gridID = _.get( gridDataProvider, 'json.gridId', '' );

    const isMultiSvrGrid = gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID;
    const isSnOMatrixGrid = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    const isConstraintsGrid = isSnOMatrixGrid || gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_CONSTRAINT_RULE;
    const isBottomConstraintsGrid = gridDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP;
    const isConstraintsSubjectGrid = subsetUIDs.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID );

    const topNodeId = pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY;

    let parentGridNode = _.find( variabilityNodes, ( variabilityNode ) => {
        return variabilityNode.nodeUid === nodeBeingExpanded.uid &&
            _.every( variabilityNode.props.parentTree, ( parent ) => subsetUIDs.includes( parent ) );
    } );

    if( inputNode ) {
        // There may be more than 1 input nodes present in SoaResponse's variabilityTreeData.
        // For ex. Fuel family may be present in Subject as well as condition. The differentiation between these 2 nodes
        // is done via props ( parentTree property ).
        // The below logic is written to select the correct input node based on subsetUID
        // (ex. select Fuel family node of Condition table from SoaResponse variabilityTreeData if subsetUID is condition table).

        // Below array contains the children Node already present in NodeBeingExpanded. Make sure we don't
        // add those elements in childrenUids of inputNode otherwise it may cause duplication of nodes.
        let childrenNodesInNodeBeingExpanded = [];
        if( nodeBeingExpanded.children ) {
            childrenNodesInNodeBeingExpanded = _.map( nodeBeingExpanded.children, ( child ) => {
                return child.nodeUid;
            } );
        }

        // Find variabilityNode in subset of variability nodes for the grid
        inputNode = _.cloneDeep( _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } ) );

        // parentGridNode will be defined only if family is newly added in table using Pick And choose.
        if( parentGridNode ) {
            inputNode.childrenUids = _.union( inputNode.childrenUids, parentGridNode.childrenUids && _.filter( parentGridNode.childrenUids, ( child ) => {
                return !childrenNodesInNodeBeingExpanded.includes( child );
            } ) );
        } else {
            // This is the case where family is not newly added but features are newly added in table using pick and choose.
            let childrenUids = _.reduce( variabilityNodes, ( childUids, variabilityNode ) => {
                if( variabilityNode.parent && _.isEqual( nodeBeingExpanded.uid, variabilityNode.parent[ 0 ] ) &&
                    !childrenNodesInNodeBeingExpanded.includes( variabilityNode.nodeUid ) ) {
                    childUids.push( variabilityNode.nodeUid );
                }
                return childUids;
            }, [] );
            inputNode.childrenUids = _.union( inputNode.childrenUids, childrenUids );
        }

        // filter childrenUids in such a way that there is no duplication of nodes in nodeBeingExpanded and inputNodes's childrenUids.
        inputNode.childrenUids = _.union( inputNode.childrenUids, childrenNodesInNodeBeingExpanded ); //union insures uniqueness
    } else {
        // For the generic input node, look in the entire variability data
        // This contains al nodes, including 'Properties information' that do not belong to specific grids
        // inputNode = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: isMultiSvrGrid ? '' : parentNode.nodeUid } );
        inputNode = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: '' } );
    }

    // Tree Structure reload
    // recursive tree load operation starting from Root Node
    if ( nodeBeingExpanded.id ===  topNodeId ) { // First level
        //Constraints -
        // [LCS-1020457] NOTE of misalignment:
        // If user quickly selects items one by one in PWA,
        // Our logic might not have the time to fully initiate a SOA call and process its response.
        // This is a risk of crash when initializing gridData
        // More specifically variabilityNodes (rootNode is not initialized)
        // Fix: return empty gridResult when this happens
        // NOTE: eventually the final SOA response is processed without further overlapping
        // and data is displayed correctly
        // MultiSvr -
        //if we select a multi level variants with out any single level variants, then we don't have
        //variability nodes, so we need to return with empty data
        if( variabilityNodes.length === 0 ) {
            return {
                parentNode: nodeBeingExpanded,
                childNodes: [],
                totalChildCount: 0,
                startChildNdx: 0
            };
        }
        let rootElement = variabilityNodes.filter( treeNode => treeNode.nodeUid === '' );
        assert( rootElement, 'RootElement is missing in the response' );
        parentNode = rootElement[0];
        let rootNode = { ...parentNode };
        // This function is used to expand &  filter the treeNodes based on the active filters.
        // which removes the nodes that do not match the filter criteria.
        // this function returns the filtered treeNodes
        treeNodes = _expandAndFilterTreeNodes(
            false, // false means this is an initial load
            isConstraintsGrid, // isConstraintsGrid
            inputNode, // inputNode
            nodeBeingExpanded.levelNdx + 1, // levelNdx
            variabilityProps, // variabilityProps
            contextKey, // contextKey
            rootNode, // rootNode
            treeNodes, // treeNodes
            soaResponse, // soaResponse
            gridData, // gridData
            gridColumns, // gridColumns
            subsetUIDs, // subsetUIDs
            isBottomConstraintsGrid, // isBottomConstraintsGrid
            gridID // gridID
        );
    } else if ( inputNode ) {
        // Manual expansion of a tree node
        var childIDs = inputNode.childrenUids;

        // If there are no child elements, update isLeaf property based on SOA response
        if ( !childIDs && inputNode.hasOwnProperty( 'props' ) && inputNode.props.hasOwnProperty( 'isLeaf' ) ) {
            pca0CommonUtils.setIsLeafProperty( inputNode, nodeBeingExpanded );
        }

        // here we are creating inputNode as a rootNode.
        let rootNode = {
            ...inputNode,
            parentUID: nodeBeingExpanded.parentUID,
            alternateID: nodeBeingExpanded.alternateID,
            levelNdx: nodeBeingExpanded.levelNdx,
            isFamily: nodeBeingExpanded.isFamily,
            props: { ...nodeBeingExpanded.props }
        };
        // This function is used to expand & filter the treeNodes based on the active filters.
        // which removes the nodes that do not match the filter criteria.
        // this function returns the filtered treeNodes
        treeNodes = _expandAndFilterTreeNodes(
            true, // true means this is a manual expand
            isConstraintsGrid, // isConstraintsGrid
            inputNode, // inputNode
            nodeBeingExpanded.levelNdx + 1, // levelNdx
            variabilityProps, // variabilityProps
            contextKey, // contextKey
            rootNode, // rootNode
            treeNodes, // treeNodes
            soaResponse, // soaResponse
            gridData, // gridData
            gridColumns, // gridColumns
            subsetUIDs, // subsetUIDs
            isBottomConstraintsGrid, // isBottomConstraintsGrid
            gridID // gridID
        );
    }

    //MultiSVR: remove duplicate nodes, resulting from former viewModemap entries that still exist due to merging vmos
    if ( isMultiSvrGrid ) {
        let cleanedOfDuplicateUnconfigFamiliesTreeNodes = pca0MultipleSVRsDisplayService.removeDuplicateUnconfigFamiliesAndFeatures( treeNodes );
        let filteredTreeNodes = cleanedOfDuplicateUnconfigFamiliesTreeNodes;
        if ( variabilityProps.activeFilter ) {
            filteredTreeNodes = variabilityTreeDisplayService.getFilteredTreeLoadResult( [ ...treeNodes ], variabilityProps.activeFilter, gridDataProvider.columnConfig.columns );
        }
        return {
            parentNode: nodeBeingExpanded,
            childNodes: filteredTreeNodes,
            totalChildCount: filteredTreeNodes.length,
            startChildNdx: 0
        };
    }

    // Matrix rules : Adjust TreeNodes Props for Subject section when authoring
    if( isConstraintsSubjectGrid && isSnOMatrixGrid ) {
        gridColumns.forEach( columnDef => {
            if( !columnDef.isColumnFromCots ) {
                treeNodes.forEach( treeNode => {
                    exports.setSubjectVmoPropsInSnOMatrixGridEditor( treeNode, columnDef );
                } );
            }
        } );
    }

    return {
        parentNode: nodeBeingExpanded,
        childNodes: treeNodes,
        totalChildCount: treeNodes.length,
        startChildNdx: 0
    };
};

/**
 * Extracts clientScopeURI and columnConfigId from the provided gridOptions object.
 *
 * @param {Object} gridOptions - The grid options object.
 * @returns {Object} An object containing clientScopeURI and columnConfigId.
 */
export let getClientScopeURIAndColumnConfigId = ( gridOptions ) => {
    return {
        clientScopeURI: gridOptions?.clientScopeURI,
        columnConfigId: gridOptions?.columnConfigId
    };
};

/**
 * Reverts the grid data to its backup state if the current state is different from the backup state.
 *
 * @param {Object} gridData - The current grid data.
 * @param {String} gridKey - The key to identify the grid in vmGridData.
 * @param {Object} vmGridData - The view model grid data containing atomic data.
 * @returns {Boolean} - Returns true if the grid data was reverted to the backup state, otherwise false.
 */
export let isSelectionMapRestoredToBackup = ( gridData, gridKey, vmGridData ) => {
    if ( !_.isEqual( gridData.businessObjectToSelectionMap, gridData.backupOfBusinessObjectToSelectionMap ) ) {
        gridData.businessObjectToSelectionMap = _.cloneDeep( gridData.backupOfBusinessObjectToSelectionMap );
        vmGridData[gridKey].setAtomicData( gridData );
        return true;
    }
    return false;
};

/**
* Get alternative UID for partially unconfigured node, returning the alternateID as is if node is not partially unconfigured
* family is in the form of 'namespace:displayName' whereas feature is in the form of 'parentUID:displayName'
* @param {Object} vmo - ViewModelObject
* @return {String} - alternateID
 */
export let getAlternativeUidConsideringPartiallyUnconfigured = ( vmo ) => {
    let newAltUId = vmo.alternateID;
    if( vmo.isPartiallyUnconfigured ) {
        let unconfiguredAltUidArr =  vmo.alternateID.split( ':' ).slice( 0, -1 );
        if( vmo.isFamily ) {
            let famNamespace = _.get( vmo, 'props.cfg0FamilyNamespace.dbValue.0' );
            unconfiguredAltUidArr.push( famNamespace );
            unconfiguredAltUidArr.push( vmo.displayName );
            newAltUId = unconfiguredAltUidArr.join( ':' );
        } else{
            unconfiguredAltUidArr.push( vmo.parentUID );
            unconfiguredAltUidArr.push( vmo.displayName );
            newAltUId = unconfiguredAltUidArr.join( ':' );
        }
    }
    return newAltUId;
};

/**
 * This method aims to copy selections in a more performant way and replaces the former cloneDeep on selections
 * Performance wise this is a bit faster on our small structure than the lodash cloneDeep
 * @param {Object} origSelections - origSelections
 * @returns {Object} - copied selections
 */
export let copySelections = ( origSelections ) => {
    let selections = { ...origSelections };
    for ( let key in selections ) {
        if ( selections.hasOwnProperty( key ) && typeof selections[key] === 'object' ) {
            selections[key] = { ...selections[key] };
            for ( let subKey in selections[key] ) {
                if ( selections[key].hasOwnProperty( subKey ) && typeof selections[key][subKey] === 'object' ) {
                    selections[key][subKey] = { ...selections[key][subKey] };
                }
            }
        }
    }
    return selections;
};

/**
 * This method aims to copy the response BusinessObjectToSelectionMap into both the BusinessObjectToSelectionMap and its backup in one single swwop and avoid the deepClone
 * which causes performance issues - is a bit faster on our small structure than the lodash cloneDeep
 * Note: This is specific to the the struct of the object and the numbers of layers we do have in that struct thus it cannot be used generically for other cloneDeep replacements without double checking
 * @param {Object} data - data
 * @returns {Object} - businessObjectToSelectionMap and its backupOfBusinessObjectToSelectionMap
 */
export let copyBusinessObjectToSelectionMap = ( data ) => {
    let businessObjectToSelectionMap = { ...data };
    let backupOfBusinessObjectToSelectionMap = { ...data };
    for ( let key in businessObjectToSelectionMap ) {
        if ( businessObjectToSelectionMap.hasOwnProperty( key ) && typeof businessObjectToSelectionMap[key] === 'object' ) {
            businessObjectToSelectionMap[key] = { ...businessObjectToSelectionMap[key] };
            backupOfBusinessObjectToSelectionMap[key] = { ...backupOfBusinessObjectToSelectionMap[key] };
            for ( let subKey in businessObjectToSelectionMap[key] ) {
                if ( businessObjectToSelectionMap[key].hasOwnProperty( subKey ) && typeof businessObjectToSelectionMap[key][subKey] === 'object' ) {
                    businessObjectToSelectionMap[key][subKey] = { ...businessObjectToSelectionMap[key][subKey] };
                    backupOfBusinessObjectToSelectionMap[key][subKey] = { ...backupOfBusinessObjectToSelectionMap[key][subKey] };
                    for ( let subSubKey in businessObjectToSelectionMap[key][subKey] ) {
                        if ( businessObjectToSelectionMap[key][subKey].hasOwnProperty( subSubKey ) && typeof businessObjectToSelectionMap[key][subKey][subSubKey] === 'object' ) {
                            businessObjectToSelectionMap[key][subKey][subSubKey] = { ...businessObjectToSelectionMap[key][subKey][subSubKey] };
                            backupOfBusinessObjectToSelectionMap[key][subKey][subSubKey] = { ...backupOfBusinessObjectToSelectionMap[key][subKey][subSubKey] };
                        }
                    }
                }
            }
        }
    }
    return { businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap };
};

/**
 * Remove a dirty element from the variabilityProps and update the vmVariabilityProps
 * @param {Object} vmVariabilityProps - The ViewModel atomic data for VariabilityProps
 * @param {String} columnUid - The UID of the column to be removed from dirty elements
 */
export let removeDirtyElement = ( vmVariabilityProps, columnUid ) => {
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    let dirtyVariantIndex = variabilityProps.dirtyElements.indexOf( columnUid );
    if ( dirtyVariantIndex > -1 ) {
        variabilityProps.dirtyElements.splice( dirtyVariantIndex, 1 );
        vmVariabilityProps.update ? vmVariabilityProps.update( variabilityProps ) : vmVariabilityProps.setAtomicData( variabilityProps );
    }
};

export default exports = {
    handleColumnArrange,
    loadGridColumns,
    getPropInfoFromSOAResponse,
    getGridServerColumns,
    postResetUpdateColumnConfig,
    postArrangeUpdateColumnConfig,
    handleDisplayModeChange,
    resetNodeUidFromSelection,
    isCellEditable,
    setSubjectVmoPropsInSnOMatrixGridEditor,
    updateViewModelTreeNodeSummary,
    updateNodeSummary,
    updateAllNodesSummary,
    loadGridDataProvider,
    prepareGridDataForTreeBuild,
    getGridTreeResult,
    getClientScopeURIAndColumnConfigId,
    isSelectionMapRestoredToBackup,
    getAlternativeUidConsideringPartiallyUnconfigured,
    copySelections,
    copyBusinessObjectToSelectionMap,
    removeDirtyElement
};
