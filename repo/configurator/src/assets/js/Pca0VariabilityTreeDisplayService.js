// <TODO> remove below complexity ignore lines and address the issue
// Complexity check is temporarily commented to ease readability

/* eslint-disable sonarjs/cognitive-complexity */

// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariabilityTreeDisplayService
 */
import actionService from 'js/actionService';
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import declUtils from 'js/declUtils';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0RendererService from 'js/pca0RendererService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import _ from 'lodash';

const _localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );

/*
 *   Internal functions
 */

/**
 * Helper function to validate if the filter criteria is satisfied for the given Tree node.
 * @param {Object} treeNode - VMO that need to check.
 * @param {Object} filter - Filter details. It contains column name, operation and values.
 * @returns {boolean} True if filter satisfied return true else false.
 */
const _isFilterCriteriaSatisfied = ( treeNode, filter ) => {
    const propValue =  _.get( treeNode, `props[${filter.columnName}].uiValue` );
    if( !propValue ) {
        return false;
    }
    return pca0CommonUtils.isFilterCriteriaSatisfied( propValue, filter.values, filter.operation, filter.dataType );
};

/**
 * If filter is applied, check treeNode is satisfying filtering criteria then add it to treeData
 * If filter is NOT applied then add tree Node in treeData always.
 * @param {Object} filterData - Filtering details
 * @param {Object} treeNode - VMO that need to check
 * @param {Object} treeNodes - Tree nodes that we want to show in tree table
 * @param {String} gridID - Current grid ID
 * @returns {boolean} True if filter applied and node satisfy filtering criteria return true else false
 *                         if filter not applied then retrun true always
 */
let _checkFilteringCriteriaAndUpdateTreeNodes = ( filterData, treeNode, treeNodes, gridID ) => {
    let filterSatisfied = true;
    const isMultiSvrGrid = gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID;
    const isConstraintsGrid =
    gridID === veConstants.GRID_CONSTANTS.PCA_GRID ||
    gridID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID;

    const isConstraintNode = treeNode.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID;
    const isNonRootNode = treeNode.levelNdx !== 0;
    let nodeDisplayName = '';

    if ( filterData && Object.keys( filterData ).length > 0 ) {
        nodeDisplayName = _.get( treeNode, `props[${filterData.columnName}].uiValue` );
        if( treeNode.uid !== veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID && _.isUndefined( filterData.allowAllChild ) &&
        nodeDisplayName && !pca0CommonUtils.isFilterCriteriaSatisfied( nodeDisplayName, filterData.values, filterData.operation ) ) {
            filterSatisfied = false;
        }
    }
    // For MultiSvrGrid: If the treeNode is a group type, set filterData.allowAllChild to the treeNode's UID.
    // For ConstraintsGrid: If the treeNode is not a root node OR is a constraint property node, set filterData.allowAllChild to the treeNode's UID.
    // The filterData.allowAllChild property ensures that all child nodes of the treeNode are included in the filter.
    // This means the entire subtree under this node will be preserved, including all descendants,
    // until recursion unwinds and allowAllChild is reset for the next sibling.
    // For example, if allowAllChild is set on a group node, all families and all features under those families
    // will be included in the filter, even if they do not individually satisfy the criteria.
    if( filterSatisfied || !treeNode.isLeaf ||
        treeNode.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ||
        treeNode.uid === veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID  ) {
        treeNode.children = [];
        treeNodes.push( treeNode );
        // for pca0CommonUtils.isGroupType(), we are passing entire treeNode object instead of treeNode.type
        // because treeNode.type is not always defined or not a valid type. For example, in case of custom features/groups
        if ( filterData && nodeDisplayName && !treeNode.isLeaf && filterSatisfied && ( isConstraintNode || isNonRootNode ||
            pca0CommonUtils.isGroupType( '', treeNode ) ) ) {
            // Preserve the previous allowAllChild if set
            filterData.allowAllChild = filterData.allowAllChild || treeNode.uid;
        }
    }
    return filterSatisfied;
};

/**
 * Local function to create child nodes for collapsed parent nodes during filtering.
 * After that, the children's alternate IDs are collected in acceptedNodeUids, which are then added to filteredNodeUids and used in the next filter.
 * Scenario:  When the first filter is applied to the family and the family satisfies the filter, and the second filter is applied to their features —
 * in that case, if a feature's alternate ID is present in filteredNodeUids, then the feature is included in the filtered results.
 *
 * For multi-variant grids, the childNode is pushed into treeNode.children to keep track of child nodes associated with the parent node.
 * This is necessary because, when a filter is later applied on the groups/families, the childNode must be present in treeNode.children to display the filtered child.
 *
 * @param {Object} treeNode - The parent tree node.
 * @param {String} contextKey - The context key.
 * @param {Number} expandingLevel - Current expansion level.
 * @param {Object} soaResponse - SOA response.
 * @param {Object} selectionMap - Selection map.
 * @param {Object} backupSelectionMap - Backup selection map.
 * @param {Array} specialBackgroundCells - Special background cells.
 * @param {Object} gridData - Grid data.
 * @param {Array} columnInfos - Column information.
 * @param {Object} splitColumnTypesMap - Split column types map.
 * @param {Object} filterCollection - Filter collection.
 * @param {String} gridID - Grid ID.
 */
const _createChildNodesForCollapsedParent = ( treeNode, contextKey, expandingLevel, soaResponse, selectionMap,
    backupSelectionMap, specialBackgroundCells, gridData, columnInfos, splitColumnTypesMap,
    filterCollection, gridID ) => {
    treeNode.childrenUids && treeNode.childrenUids.forEach( childId => {
        let childNode = exports.createViewModelTreeNode(
            contextKey, // contextKey
            childId, // nodeUid
            expandingLevel + 1, // levelNdx
            treeNode.nodeUid, // parentNodeUid
            treeNode.alternateID, //Alternate ID
            treeNode.childrenUids.indexOf( childId ), //childNdx
            soaResponse, // soaResponse
            selectionMap, // selectionMap
            backupSelectionMap, // backupSelectionMap
            !_.isUndefined( specialBackgroundCells ) && specialBackgroundCells.includes( childId ), // isSpecialBackgroundCell
            gridData, // top/bottom grid data
            columnInfos, // columnInfos to extract newColumnProps
            splitColumnTypesMap // splitColumn type map
        );
            // acceptedNodeUids is used to store the alternateIDs of childNode.
            // Later, these acceptedNodeUids are added to filteredNodeUids,
        if( !filterCollection.acceptedNodeUids ) {
            filterCollection.acceptedNodeUids = [];
        }
        filterCollection.acceptedNodeUids.push( childNode.alternateID );
        //  childNode is pushed into treeNode.children to keep track of child nodes associated with the parent node.
        if( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID && filterCollection.filteredNodeUids && filterCollection.filteredNodeUids.includes( childNode.alternateID ) ) {
            treeNode.children.push( childNode );
        }
    } );
};

/**
 * // This function will populate isFeature as true if the VMO is feature else if the VMO is family it will populate isFamily as true
 * @param {Object} vmTreeNode - tree node
 * @param {Object} viewModelObject - viewModelObject
 */
let _populateVMOType = ( vmTreeNode, viewModelObject ) => {
    if( _.get( viewModelObject, 'props.isFamily[0]' ) ) {
        vmTreeNode.isFamily = _.get( viewModelObject, 'props.isFamily[0]' ) === 'true';
    } else if( _.get( viewModelObject, 'props.isFeature[0]' ) ) {
        vmTreeNode.isFeature = _.get( viewModelObject, 'props.isFeature[0]' ) === 'true';
    }
};

/**
 * Create View Model Object for the given node
 * @param {String} contextKey - the Context Key
 * @param {Object} node Variability Node
 * @param {Object} viewModelObject node corresponding VMO from variability data
 * @param {Number} levelNdx - The # of levels down from the Root of the tree-table
 * @param {Number} childNdx - The index to this 'child' within the immediate 'parent'
 * @param {Boolean} isParentFreeForm true if Parent is FreeForm
 * @param {Boolean} isParentEnumerated true if Parent is Enumerated
 * @param {Boolean} isSpecialBackgroundCell - true if cell needs a special header-like background style
 * @param {Boolean} isConstraintsEditorPropInfoNodeUid - true if node belongs to 'Properties Information' subset,
 * @param {Object} partiallyUnconfigured - props from the unconfigured 'fake' variability tree node that will need to be attached to the real node
 * @param {Boolean} isMultipleVariantsGrid - true if the grid is multiple variants grid
 * @return {Object} View Model Object - structure to build ViewModelTreeNode
 */
let _createVMO = ( contextKey, node, viewModelObject, levelNdx, childNdx, isParentFreeForm, isParentEnumerated, isSpecialBackgroundCell,
    isConstraintsEditorPropInfoNodeUid, partiallyUnconfigured, isMultipleVariantsGrid ) => {
    let vmTreeNode;
    let iconURL = !isSpecialBackgroundCell ? pca0CommonUtils.getIconURL(
        contextKey, // contextKey
        viewModelObject, // viewModelObject
        node, // node
        levelNdx, // levelNdx
        isParentFreeForm || isParentEnumerated, // isParentFreeFormOrEnumerated
        isConstraintsEditorPropInfoNodeUid // isPropInfoNode
    ) : '';

    // Create node and initialize additional properties needed
    let type = _.get( viewModelObject, 'props.cfg0ValueDataType[0]' );

    type = type || viewModelObject.sourceType;

    vmTreeNode = awTableTreeSvc.createViewModelTreeNode( node.nodeUid, type, viewModelObject.displayName, levelNdx, childNdx, iconURL );
    // This function will populate isFeature as true if the VMO is feature else if the VMO is family it will populate isFamily as true
    _populateVMOType( vmTreeNode, viewModelObject );
    vmTreeNode.isFreeForm = _.get( viewModelObject, 'props.isFreeForm[0]' ) === 'true';
    vmTreeNode.isEnumerated = !vmTreeNode.isFreeForm ? pca0CommonUtils.isEnumeratedFamily( viewModelObject ) : false;

    // If isSingleSelect exists and is true, set isSingleSelect to true
    // because isSingleSelect prop on feature/group doesn't make sense
    if ( _.has( viewModelObject, 'props.isSingleSelect[0]' ) ) {
        vmTreeNode.isSingleSelect = _.get( viewModelObject, 'props.isSingleSelect[0]' ) === 'true';
    }
    vmTreeNode.isOptional = _.get( viewModelObject, 'props.cfg0IsDiscretionary[0]' ) === 'true';

    //the multivariants unconfigured will be in the form: isUnconfigured:["Svr1",'Svr2'] not a boolean coming in as a string but it's attached to the 'fake'
    //variability tree nodes so it has to be determined first
    vmTreeNode.isUnconfigured = pca0CommonUtils.isTreeNodeUnconfigured( node );
    vmTreeNode.isPartiallyUnconfigured = partiallyUnconfigured ? partiallyUnconfigured : false;

    // Storing allocation uid for Group/Family/Feature
    const allocationUid = _.get( node, 'props.associationObject[0]' );
    if( allocationUid ) {
        vmTreeNode.allocationUid = allocationUid;
    }

    // Checking if the object is already Allocated and setting the preselected flag
    const isAllocated = _.get( node, 'props.isAllocated[0]' );
    if ( isAllocated === 'true' ) {
        vmTreeNode.isPreselected = true;
    }
    //for both constraints and multivariants use the orange vmo decorator for the isUnconfigured:["Svr1",'Svr2'] use case - all cell in the row are unconfigured
    if( vmTreeNode.isUnconfigured && !vmTreeNode.isPartiallyUnconfigured ) {
        vmTreeNode.colorTitle = pca0CommonUtils.getUnconfiguredIndicatorTooltipForGrid(
            levelNdx, // levelNdx
            contextKey // contextKey
        );
        // $Siemens_Yellow_11 [#eb780a]
        vmTreeNode.gridDecoratorStyle = 'aw-cfg-variantTreeUnconfiguredCellDecoratorStyle';
    }


    vmTreeNode.dataType = _.get( viewModelObject, 'props.cfg0ValueDataType[0]' );
    vmTreeNode.isParentFreeForm = isParentFreeForm;
    vmTreeNode.isParentEnumerated = isParentEnumerated;

    // Add flag for special header-like background style if needed
    vmTreeNode.isSpecialBackgroundCell = isSpecialBackgroundCell;

    // Create childrenUids if defined.
    // In GridEditor, VCA2 and VCV the node is a Leaf if it has children
    vmTreeNode.isLeaf = true;
    if( !_.isUndefined( node.childrenUids ) && node.childrenUids.length > 0 ) {
        vmTreeNode.childrenUids = node.childrenUids;
        vmTreeNode.isLeaf = false;
    }
    vmTreeNode.typeIconURL = iconURL;

    if( viewModelObject && viewModelObject.props && viewModelObject.props.cfg0ChildrenDisplayNames ) {
        vmTreeNode.childrenDispValues = viewModelObject.props.cfg0ChildrenDisplayNames;
    }
    if( viewModelObject && viewModelObject.props && viewModelObject.props.cfg0ChildrenIDs ) {
        vmTreeNode.cfg0ChildrenIDs = viewModelObject.props.cfg0ChildrenIDs;
    }
    return vmTreeNode;
};

/**
 * Create View Model Object for Free Form\Enumerated node
 * @param {String} parentNodeUid - UID of parent Node
 * @param {Boolean} isParentFreeForm - true if parent is Free Form
 * @param {Boolean} isParentEnumerated - true if parent is Enumerated
 * @param {String} nodeUid - UID of Node
 * @param {Number} levelNdx - The # of levels down from the 'root' of the tree-table for the Node.
 * @param {Number} childNdx - The index to this Node ('child') within the immediate 'parent'.
 * @return {ViewModelTreeNode} Newly created wrapper initialized with properties from the given inputs.
 */
let _createFreeFormEnumeratedVMO = function( parentNodeUid, isParentFreeForm, isParentEnumerated, nodeUid, levelNdx, childNdx ) {
    // We fall here when creating a new freeForm/enumerated value node
    var parentPrefix = parentNodeUid + ':';
    var valueText = nodeUid.replace( parentPrefix, '' );
    let vmTreeNode = awTableTreeSvc.createViewModelTreeNode( valueText, undefined, valueText, levelNdx, childNdx, undefined );

    // Force "feature" icon for Free Form and Enumerated features
    let iconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    vmTreeNode.typeIconURL = iconURL;
    vmTreeNode.isParentFreeForm = isParentFreeForm;
    vmTreeNode.isParentEnumerated = isParentEnumerated;
    vmTreeNode.valueText = valueText;
    vmTreeNode.isLeaf = true;

    return vmTreeNode;
};

/*
 * Find and return a node in the Expansion Map, given its ID
 * @param {Object} expansionMap expansion Map
 * @param {String} nodeID - UID for the Tree Node
 * @return {ViewModelTreeNode} View Model Tree Node from map, null if not found
 */
let _recursiveFindNodeInExpansionMap = function( expansionMap, nodeID ) {
    for( var idx = 0; idx < expansionMap.length; idx++ ) {
        var node = expansionMap[ idx ];
        if( node.id === nodeID ) {
            return node;
        }

        var childNodes = node.childNodes;
        if( node.childNodes ) {
            var childNode = _recursiveFindNodeInExpansionMap( childNodes, nodeID );
            if( childNode ) {
                return childNode;
            }
        }
    }
    return null;
};

/**
 * This method filters the tree nodes based on a user entered search filter
 * @param {Object} allLoadedObjects loaded view model objects in the tree structure
 * @param {Object} treeNode - node to recursively apply filtering
 * @param {String} filter - filter string
 */
let _recursiveApplyFilter = function( allLoadedObjects, treeNode, filter ) {
    // If treeNode has no children, we have reached the end of the tree and no filter matched so far
    // children object could even be undefined if node has been expanded by user.
    if( !treeNode.children || treeNode.children.length === 0 ) {
        return;
    }

    let clonedTreeChildren = [ ...treeNode.children ];
    for( let idx = 0; idx < clonedTreeChildren.length; idx++ ) {
        let tNode = clonedTreeChildren[ idx ];

        if ( tNode ) {
            if( _isFilterCriteriaSatisfied( tNode, filter ) ) {
                continue;
            }
            _recursiveApplyFilter( allLoadedObjects, tNode, filter );

            // If no result is matching filter, remove node
            if( !tNode.children || tNode.children.length === 0 ) {
                exports.removeNodeFromTree( allLoadedObjects, tNode );
                exports.removeNodeFromTree( treeNode.children, tNode );
            }
        }
    }
};

/**
 * Create a map of family to its group
 * @param {Object} soaResponse - response of the SOA
 * @returns {Object} family to group map
 */
let _createFamilyToGroupMap = function( soaResponse ) {
    let familyGroups = [];
    let familyToGroupMap = {};
    _.forEach( soaResponse.viewModelObjectMap, viewModelObjectNode => {
        if( viewModelObjectNode.sourceType === 'Cfg0FamilyGroup' ||
            viewModelObjectNode.sourceType === pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID ||
            viewModelObjectNode.sourceType === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
            familyGroups.push( viewModelObjectNode.sourceUid );
        }
    } );

    _.forEach( soaResponse.variabilityTreeData, variabilityNode => {
        if( familyGroups.includes( variabilityNode.nodeUid ) ) {
            _.forEach( variabilityNode.childrenUids, family => {
                familyToGroupMap[ family ] = variabilityNode.nodeUid;
            } );
        }
    } );

    return familyToGroupMap;
};

/**
 * Get variability Node, VMO and parentVMO from variability data
 * @param {String} nodeUid  - UID for the node in the tree table
 * @param {String} parentNodeUid - UID of parent node in the tree table
 * @param {Object} gridData - Atomic grid data for topGrid/bottomGrid
 * @param {Object} soaResponse - the Cached SOA response
 * @return {Object} Node Info container
 */
let _getNodeObjectsFromVariabilityData = ( nodeUid, parentNodeUid, gridData, soaResponse ) => {
    let variabilityNodes = [];
    let viewModelObject;
    let parentObject;
    let propInfoUIDs;
    let isConstraintsEditorPropInfoNodeUid;
    // 'Properties Information' subset is part of the SOA response, not belonging to subject/condition maps
    if ( gridData ) {
        propInfoUIDs = pca0CommonUtils.getPropertiesInformationUIDs( soaResponse.variabilityTreeData );
        isConstraintsEditorPropInfoNodeUid = pca0CommonUtils.isConstraintsEditorPropInfoNodeUid( nodeUid, propInfoUIDs );
    }
    if( !_.isUndefined( gridData ) && !isConstraintsEditorPropInfoNodeUid ) {
        variabilityNodes = gridData.variabilityNodes;
        viewModelObject = gridData.viewModelObjectMap[ nodeUid ];
        parentObject = gridData.viewModelObjectMap[ parentNodeUid ];
    } else {
        variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
        viewModelObject = soaResponse.viewModelObjectMap[ nodeUid ];
        parentObject = soaResponse.viewModelObjectMap[ parentNodeUid ];
    }
    let node;
    if ( variabilityNodes ) {
        // performance improvement: use the map if it's there and has the node so we don't go find the node in the huge array for every single node
        //also we need the check of the node id present in the map as constraints further manipulates it later
        if( gridData && gridData.variabilityNodesMap && gridData.variabilityNodesMap[ nodeUid ] ) {
            node = gridData.variabilityNodesMap[ nodeUid ];
        } else {
            node = variabilityNodes.find( item => item.nodeUid === nodeUid );
        }
    }
    return { node, viewModelObject, parentObject, propInfoUIDs, isConstraintsEditorPropInfoNodeUid };
};

/**
 * Function to prepare uniqueID based on current grid and node selection ( freeform\range\unconfigured ).
 * @param {Object} configExprSection Section for which uniqueUid to be prepared.
 * @param {Object} selection - Selection for which uniqueUid to be prepared.
 * @param {String} gridID - Current gridID.
 * @param {Object} familyToGroupMap - Family to Group Map.
 * @return {String} Unique ID created for each selection.
 */
let _prepareUniqueId = function( configExprSection, selection, gridID, familyToGroupMap ) {
    let uniqueUID = '';
    if( pca0Constants.EXPRESSION_TYPES.SUBJECT_EXPRESSION === configExprSection.expressionType ) {
        uniqueUID = veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID + ':';
    } else if( configExprSection.expressionType === pca0Constants.EXPRESSION_TYPES.CONDITION_EXPRESSION ) {
        uniqueUID = veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID + ':';
    }
    // Process FreeForm/Enumerated/Unconfigured properties first
    if( !selection.nodeUid && !_.isUndefined( selection.props ) ) {
        if( _.get( selection, 'props.isFreeFormFamily.0' ) ||
            _.get( selection, 'props.isEnumeratedRangeExpressionSelection.0' ) ) {
            if( gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
                // unique ID for free form feature is : "subset:family:family:valueText"
                uniqueUID = `${uniqueUID}${selection.family}:${selection.family}:${selection.valueText}`;
            } else {
                uniqueUID = selection.family + ':' + selection.valueText;
            }
        } else if( _.get( selection, 'props.isUnconfigured.0' ) ) {
            if( !selection.family ) { // Family is Configure-out
                if( gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
                    uniqueUID = `${uniqueUID}${selection.familyNamespace}:${selection.familyId}:${selection.familyNamespace}:${selection.familyId}:${selection.valueText}`;
                } else {
                    uniqueUID = selection.familyNamespace + ':' + selection.familyId + ':' + selection.valueText;
                }
            } else {
                if( gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
                    uniqueUID = `${uniqueUID}${selection.family}:${selection.family}:${selection.valueText}`;
                } else {
                    uniqueUID = selection.family + ':' + selection.valueText;
                }
            }
        }
    } else if( gridID === pca0Constants.GRID_CONSTANTS.VARIANT_CONFIGURATION ) {
        if( selection.nodeUid === selection.family ) /* family level selection */ {
            uniqueUID = familyToGroupMap[ selection.family ] + ':' + selection.family;
        } else /*feature level selection */ {
            uniqueUID = pca0CommonUtils.prepareUniqueId( familyToGroupMap[ selection.family ] + ':' + selection.family,
                selection
                    .nodeUid );
        }
    } else if ( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
        let moduleUid;
        if ( selection.nodeUid === selection.family ) /* family level selection */ {
            uniqueUID = moduleUid ? moduleUid + ':' + familyToGroupMap[ selection.family ] + ':' + selection.family : familyToGroupMap[ selection.family ] + ':' + selection.family;
        } else /*feature level selection */ {
            uniqueUID = moduleUid ? moduleUid + ':' + familyToGroupMap[ selection.family ] + ':' + selection.family : familyToGroupMap[ selection.family ] + ':' + selection.family;
            uniqueUID = pca0CommonUtils.prepareUniqueId( uniqueUID, selection.nodeUid );
        }
    } else {
        // This is for normal features which have nodeUid from TC DB
        uniqueUID += pca0CommonUtils.prepareUniqueId( selection.family, selection.nodeUid );
    }
    return uniqueUID;
};

/**
 * Helper function to populate props in propertyMap
 * @param {Object} propertyMap - propertyMap to be populated in VMO.
 * @param {Object} props - props to be populated received from SOA response.
 */
const _populatePropsInPropertyMap = ( propertyMap, props ) => {
    if ( props ) {
        Object.entries( props ).forEach( ( [ propKey, prop ] ) => {
            if ( !propertyMap[propKey] ) {
                propertyMap[propKey] = {
                    uiValue: prop[0],
                    dbValue: prop
                };
            }
        } );
    }
};

/**
 * Helper to set summary for family without children.
 * The use case is that an SVR can be loaded in current expressions only mode, so the family node will have no children but it might have a
 * summary value if for example the family node is 'any' or 'none'. With the code below excluding only the non summary grids
 * @param {Object} treeNode - treeNode to be changed
 * @param {Object} columnInfos - columnInfos
 */
const _setSummaryForFamilyWithoutChildren = ( treeNode, columnInfos ) => {
    const columnNames = columnInfos.filter( col => !col.isColumnFromCots ).map( col => col.name );
    const colProps = _.filter( treeNode.props, prop => columnNames.includes( prop.name ) );
    colProps.forEach( prop => {
        if ( [ 2, 10, 6 ].includes( prop.uiValue ) ) {
            prop.uiValue = _localeTextBundle.noneTitle;
        } else if ( [ 1, 9, 5 ].includes( prop.uiValue ) ) {
            prop.uiValue = _localeTextBundle.anyTitle;
        }
    } );
};

/**
 * Get node types from properties.
 *
 * @param {Object} props - The properties object.
 * @returns {Object} An object containing the node types.
 * @returns {boolean} isPseudoNode - True if the node is a pseudo node.
 * @returns {boolean} isGroup - True if the node is a group.
 * @returns {boolean} isFamily - True if the node is a family.
 * @returns {boolean} isFeature - True if the node is a feature.
 */
const _identifyNodeTypes = ( props ) => ( {
    isPseudoNode: _.isUndefined( props ),
    isGroup: _.get( props, 'isGroup[0]' ) === 'true',
    isFamily: _.get( props, 'isFamily[0]' ) === 'true',
    isFeature: _.get( props, 'isFeature[0]' ) === 'true'
} );

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Recursive util to create treeNodes according to expansion map provided
 * @param {String} contextKey - the Context Key
 * @param {Object} rootNode - Root Node for the structure to be created recursively
 * @param {Number} expandingLevel - Level # for the node being created
 * @param {Object} expansionMap - expansion Map
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} nodeBeingExpandedChildren - List of children for the node being created (and expanded recursively)
 * @param {Object} soaResponse - SOA response
 * @param {Object} selectionMap - selectionMap
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {String} alternateID - alternate ID
 */
export let recursiveCreateTreeNodeWithMap = ( contextKey, rootNode, expandingLevel, expansionMap, treeNodes, nodeBeingExpandedChildren, soaResponse, selectionMap, backupSelectionMap, alternateID ) => {
    rootNode.childrenUids.forEach( id => {
        let nodeInExpansionMap = _recursiveFindNodeInExpansionMap( expansionMap, id );
        if( nodeInExpansionMap ) {
            var tNode = exports.createViewModelTreeNode( contextKey,
                id, expandingLevel, rootNode.nodeUid, alternateID, rootNode.childrenUids.indexOf( id ), soaResponse,
                selectionMap, backupSelectionMap );

            tNode.children = [];
            treeNodes.push( tNode );

            // Iterate through children if present in expansionMap
            if( nodeInExpansionMap.childNodes && nodeInExpansionMap.childNodes.length !== 0 ) {
                tNode.isExpanded = true;
                var newStartNode = pca0CommonUtils.getVariabilityNodes( soaResponse ).find( node => node.nodeUid === id );
                exports.recursiveCreateTreeNodeWithMap( contextKey, newStartNode, expandingLevel + 1, expansionMap, treeNodes, tNode.children, soaResponse, selectionMap, backupSelectionMap, tNode
                    .alternateID );
            }
            if( expandingLevel !== 0 ) {
                nodeBeingExpandedChildren.push( tNode );
            }
        }
    } );
};

/**
 * Build Column Definition for TreeNavigation column, including renderers.
 * @param {String} contextKey - context key
 * @param {String} propertyName - Name of property for TreeNavigation column
 * @param {String} propertyDisplayName - Display Name of property for TReeNavigation column
 * @param {Number} width - width for the column
 * @param {Boolean} enableColumnMenu - true if columnMenu is enabled
 * @return {Object} Column Definition
 */
export const createVariabilityColumnDef = ( contextKey, propertyName, propertyDisplayName, width, enableColumnMenu ) => {
    return {
        name: propertyName,
        propertyName: propertyName,
        displayName: propertyDisplayName,
        minWidth: width,
        width: width,
        enableColumnMenu: enableColumnMenu, // Menu can be disabled, i.e. hidden header in Constraints Grid Editor
        pinnedLeft: true,
        enableColumnHiding: false, // disable command "Hide Column",
        isTreeNavigation: true
    };
};

/**
 * Get Display Name for Business Object to use for column header text
 * @param {Object} soaResponse - the Cached SOA response
 * @param {String} businessObjectUid - UID of the Business Object
 * @return {String} Display Name for the Business Object
 */
export let getDisplayNameForBusinessObject = function( soaResponse, businessObjectUid ) {
    let viewModelObject = soaResponse.viewModelObjectMap[ businessObjectUid ];
    return viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : businessObjectUid;
};

export let getColumnPropsAndSelectionMap = ( gridID, soaResponse ) => {
    let columnProperties = [];
    let columnSplitIDsMap = {};
    let businessObjectToSelectionMap = {};
    let subjectSelectionMap = {};
    let conditionSelectionMap = {};
    const nonGridableExpressionsList = pca0CommonUtils.getNonGridableExpressionList( soaResponse.selectedExpressions, soaResponse.viewModelObjectMap );

    let boKeys = Object.keys( soaResponse.selectedExpressions );
    _.forEach( boKeys, boKey => {
        // NOTE: for Constraints Authoring, 'selectedExpressions' structure is different from VCA
        // VCA comes with one 'configExpressionSections' for each BO
        // Constraints Authoring comes with two 'configExpressionSections':
        //  one for Subject [exprType: 44] and one for Condition [exprType25]
        // Hence:
        // - when building the selectionMap we need to make sure we don't overwrite selectionMap
        // - Build columns once selectionMap is complete, to avoid duplicates
        columnSplitIDsMap[ boKey ] = [];

        // Initialize temporary array to store splitColumn keys
        // This is needed because Constraints grid editor requires a different structure for splitColumnMap
        let splitColumnKeys = [];

        let displayName = exports.getDisplayNameForBusinessObject( soaResponse, boKey );

        let sourceType = soaResponse.viewModelObjectMap[ boKey ].sourceType;

        let businessObjects = soaResponse.selectedExpressions[ boKey ];
        let configExpressionSections = _.get( businessObjects, '[0].configExpressionSet[0].configExpressionSections' );
        if( !_.isUndefined( configExpressionSections ) && configExpressionSections.length > 0 ) {
            _.forEach( configExpressionSections, configExprSection => {
                const subExpressions = configExprSection.subExpressions;
                if( _.isUndefined( subExpressions ) ) {
                    return; // continue
                }

                let familyToGroupMap = {};
                // create Map of family to group for creation of unique UID ( group:family:feature ) for VCV Grid.
                if( gridID === pca0Constants.GRID_CONSTANTS.VARIANT_CONFIGURATION ) {
                    familyToGroupMap = _createFamilyToGroupMap( soaResponse );
                }
                //maria todo we'll have to create the module:group:family:feature or group:family:feature
                else if( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
                    familyToGroupMap = _createFamilyToGroupMap( soaResponse );
                }
                _.forEach( subExpressions, ( subExpression, idx ) => {
                    // Process selections
                    if( !subExpression.expressionGroups ) {
                        return;
                    }

                    // Process Unique Key and update split column Map
                    let uniqueKey = boKey;
                    if( idx !== 0 ) {
                        uniqueKey = Pca0VCAUtils.instance.generateSplitColumnKey( boKey );
                        splitColumnKeys.push( uniqueKey );
                    }

                    let nodeIDToObject = {};
                    Object.values( subExpression.expressionGroups ).forEach( selections => {
                        _.forEach( selections, selection => {
                            let uniqueUID = _prepareUniqueId( configExprSection, selection, gridID, familyToGroupMap );
                            nodeIDToObject[ uniqueUID ] = selection;
                        } );
                    } );

                    if( _.isUndefined( businessObjectToSelectionMap[ uniqueKey ] ) ) {
                        businessObjectToSelectionMap[ uniqueKey ] = {};
                        subjectSelectionMap[ uniqueKey ] = {};
                        conditionSelectionMap[ uniqueKey ] = {};
                    }
                    _.assign( businessObjectToSelectionMap[ uniqueKey ], nodeIDToObject );
                    if( pca0Constants.EXPRESSION_TYPES.SUBJECT_EXPRESSION === configExprSection.expressionType ) {
                        _.assign( subjectSelectionMap[ uniqueKey ], nodeIDToObject );
                    } else if( configExprSection.expressionType === pca0Constants.EXPRESSION_TYPES.CONDITION_EXPRESSION ) {
                        _.assign( conditionSelectionMap[ uniqueKey ], nodeIDToObject );
                    }
                } );
            } );

            // Create column
            let columnProps = {
                gridID: gridID,
                propertyName: boKey,
                propertyDisplayName: displayName,
                propertyUid: boKey,
                sourceType: sourceType,
                originalColumnName: boKey,
                isSplitColumn: false,
                isVertical: false,
                formula: _.get( businessObjects, '[0].formula' )
            };

            columnProperties.push( columnProps );

            // Add split columns
            splitColumnKeys.forEach( splitColumnKey => {
                columnProps = {
                    gridID: gridID,
                    propertyName: splitColumnKey,
                    propertyDisplayName: '',
                    propertyUid: splitColumnKey,
                    sourceType: sourceType,
                    originalColumnName: boKey,
                    isSplitColumn: true,
                    isVertical: false
                };

                // Special scenario for Constraints Grid Editor: mark type of split column
                if( gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
                    let isSplitSubject; // to set property on split column
                    if( _.isEmpty( subjectSelectionMap[ splitColumnKey ] ) ) {
                        // Split column is 'Split Condition'
                        // Need to copy over selections from subject section
                        isSplitSubject = false;
                        let subjectSelectionsToCopy = _.cloneDeep( subjectSelectionMap[ boKey ] );
                        subjectSelectionMap[ splitColumnKey ] = subjectSelectionsToCopy;
                    } else {
                        // Split column is 'Split Subject'
                        // Need to copy over selections from condition section
                        isSplitSubject = true;
                        let conditionSelectionsToCopy = _.cloneDeep( conditionSelectionMap[ boKey ] );
                        conditionSelectionMap[ splitColumnKey ] = conditionSelectionsToCopy;
                    }
                    columnProps.isSplitSubject = isSplitSubject;
                    let originalColumn = _.find( columnProperties, { propertyUid: boKey } );
                    originalColumn.hasSplitSubject = columnProps.isSplitSubject; // property on originalColumn

                    // Add entry to column Split Map
                    columnSplitIDsMap[ boKey ].push( { uid: splitColumnKey, isSplitSubject: isSplitSubject } );
                } else {
                    // Add entry to column Split Map
                    columnSplitIDsMap[ boKey ].push( splitColumnKey );
                }
                columnProperties.push( columnProps );
            } );
        } else {
            // This is for business object with no expression authored yet
            businessObjectToSelectionMap[ boKey ] = {};
            subjectSelectionMap[ boKey ] = {};
            conditionSelectionMap[ boKey ] = {};
            let columnProps = {
                gridID: gridID,
                propertyName: boKey,
                propertyDisplayName: displayName,
                propertyUid: boKey,
                sourceType: sourceType,
                originalColumnName: boKey,
                isSplitColumn: false,
                isVertical: false,
                formula: _.get( businessObjects, '[0].formula' ),
                isExpressionNonGridable: nonGridableExpressionsList.includes( boKey ) ? true : undefined
            };
            columnProperties.push( columnProps );
        }
    } );
    return { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, subjectSelectionMap, conditionSelectionMap };
};


/**
 * Build Column Definition, including renderers.
 * @param {Array} columnProperties - column information array
 * @param {String} currentContextKey - context key
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {Boolean} skipCellRenderer - when we want a custom cell render for the column then make skipCellRenderer true to return cellRenderers as empty
 * @return {Object} Column Definition
 */
export let createColumnDef = function( columnProperties, currentContextKey, treeDataProvider, vmGridSelectionState, skipCellRenderer ) {
    // Note: in order to have "Hide Column" disabled for the whole table:
    // <Thomas Stark> have your columnProvider return false from the "isArrangeSupported" function

    // Set columnWidth
    // Also set Maximum Width for Constraints Grid Editor columns
    let _columnWidth;
    let _maxWidth;
    if( columnProperties.gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
        _columnWidth = columnProperties.columnWidth;
        _maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
    } else {
        _columnWidth = pca0CommonConstants.GRID_CONSTANTS.BUSINESS_OBJECT_COLUMN_WIDTH;
        _maxWidth = _columnWidth;
    }

    // Cell Renderers
    let cellRenderers = [];
    if( !skipCellRenderer ) {
    // Add custom cell Renderers if specified for the column
        if( !_.isUndefined( columnProperties.cellRenderers ) ) {
            cellRenderers = [ ...columnProperties.cellRenderers ];
        }
        // Add generic 'icon' cell renderer
        cellRenderers.push( pca0RendererService.iconCellRenderer( pca0GridAuthoringService.handleCellClick, currentContextKey,
            treeDataProvider, vmGridSelectionState ) );
    }

    const colDisplayName = treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ? '' : columnProperties.propertyDisplayName;

    let columnDef = {
        // NOTE on headerTooltip flag:
        // if set to false, it will disable showing header tooltip (BO/SVR/Constraint name)
        // Setting it to false is helpful in case of violations, to prevent overlapping between the two tooltips
        // BUT it will also remove the 'title' attribute from the cell, which is needed for header highlight (e.g. new constraints)
        // headerTooltip: false,
        hiddenFlag: false,
        dataType: 'String',
        propertyName: columnProperties.propertyName,
        propertyDisplayName: columnProperties.propertyDisplayName,
        name: columnProperties.propertyName,
        displayName: colDisplayName,
        uid: columnProperties.propertyUid,
        originalColumnName: columnProperties.originalColumnName,
        sourceType: columnProperties.sourceType,
        minWidth: pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH,
        width: _columnWidth,
        maxWidth: _maxWidth,
        isSplitColumn: columnProperties.isSplitColumn,
        isVertical: columnProperties.isVertical,
        isPropertyColumn: columnProperties.isPropertyColumn,
        hasNoSelections: columnProperties.hasNoSelections,
        cellRenderers: cellRenderers,
        menuItems: [],
        isFilteringEnabled: false,
        formula: columnProperties.formula,
        isExpressionNonGridable: columnProperties.isExpressionNonGridable,
        enableColumnHiding: false, // disable command "Hide Column"
        enableColumnSelection: true, // additional "Select Column" column menu action will appear
        enableColumnMenu: treeDataProvider.name === veConstants.GRID_CONSTANTS.BOTTOM_GRID_CONSTRAINTS_DP ? false : columnProperties
            .enableColumnMenu // Menu can be disabled, i.e. hidden header in Constraints Grid Editor
    };

    if( !_.isUndefined( columnProperties.newConstraintColumnProps ) ) {
        columnDef.newConstraintColumnProps = { ...columnProperties.newConstraintColumnProps };
    }

    if( columnProperties.gridID === pca0CommonConstants.GRID_CONSTANTS.CONSTRAINTS_GRID ) {
        columnDef.hasSplitSubject = columnProperties.hasSplitSubject; // property on originalColumn
        columnDef.enableColumnMoving = false;
        if( columnProperties.isSplitColumn ) {
            columnDef.isSplitSubject = columnProperties.isSplitSubject; // property on split column
        }
    }

    return columnDef;
};

/**
 * Launch action to populate splm grid data provider
 * @param {Object} viewModel - ViewModel data
 * @param {String} viewModelAction - ViewModel Action Name for performing SOA call
 * @param {String} contextKey - context key
 * @param {Object} fscState - FSC state atomic data (VCV grid only)
 * @param {Object} variantRuleData - VariantRule atomic data (VCV grid only)
 * @param {Object} consumerData - Consumer data object having information about configContext, isHostedPcaMode and configPerspective
 * @returns {Object} TreeLoadResult and updated view model data/atomic data to dispatch
 */
// NOTE: this method is now used only for VE-VariabilityPicker grids.
// We should refactor and use same approach as in VCA and make a new common method
export let loadTreeProviderData = function( viewModel, viewModelAction, contextKey, fscState, variantRuleData, userSelectionsPickAndChooseGrid, consumerData ) {
    // Clone current status for VM data and fields (atomic data)

    let variabilityPropsFromAtomicData = viewModel.atomicDataRef.variabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropsFromAtomicData };

    var treeMaps = { ...viewModel.data.treeMaps };

    let nodeBeingExpanded = viewModel.treeLoadInput.parentNode;
    if ( nodeBeingExpanded.uid === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) {
        nodeBeingExpanded.props = {
            tempKey: {}
        };
    }
    let treeDataProvider = viewModel.dataProviders.treeDataProvider ? viewModel.dataProviders.treeDataProvider : viewModel.dataProviders.variabilityPickerTreeDataProvider;
    let treeLoadResult;
    // check for initialColumnFilters(present only for first time on page load) and
    // populate them into columnFilters of treeColumnProvider
    const initialColumnFilters = _.get( viewModel.data, 'initialColumnFilters' );
    if( !_.isEmpty( initialColumnFilters ) ) {
        viewModel.columnProviders.treeColumnProvider.columnFilters = viewModel.data.initialColumnFilters;
    }
    // Check for active filters
    let columnFilters = viewModel.columnProviders.treeColumnProvider.columnFilters;
    if( columnFilters && columnFilters.length > 0 ) {
        var columnFilter = _.filter( columnFilters, function( filter ) {
            return filter.columnName === pca0Constants.GRID_CONSTANTS.VARIABILITY_CONTENT;
        } );
        if( columnFilter.length > 0 ) {
            variabilityProps.activeFilter = columnFilter[ 0 ];
        }
    } else {
        delete variabilityProps.activeFilter;
    }

    // For Variability Browsing, server call is made for each expand action except when it was already expanded.
    // For VCA, "childrenUids" attribute will always be pre-populated if node has child elements. Server call should be avoided in such case.
    // Hence added a check on "childrenUids" element to verify that if node was already expanded.
    // However in case of free form family, server call needs to be skipped regardless of view i.e. VCA or Variability Browsing
    if( nodeBeingExpanded.id === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY || !nodeBeingExpanded.hasOwnProperty( 'childrenUids' ) && !nodeBeingExpanded.isFreeForm ) {
        if( variabilityProps.useCachedData ) {
            // Refresh grid content
            // SelectionMap doesn't need to be recalculated
            // Scenarios:
            // - refreshing grid after a variant Rule has been unloaded from VCV grid view
            // - switching display mode, e.g.: from "Show All Families" to "Show All Features"
            // No need for a new SOA call.
            treeLoadResult = exports.getTreeLoadResult( contextKey, nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );

            // Cache TreeLoadResult for filtering purposes
            treeMaps.cachedTreeLoad = treeLoadResult;

            variabilityProps.useCachedData = undefined;
        } else if( ( variabilityProps.activeFilter || !_.isUndefined( variabilityProps.filterApplied ) ) &&
            ( !viewModel.data.operation || !_.isEqual( viewModel.data.operation, pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE ) ) ) {
            // Refresh grid content using filters or reset filters
            // Use cached SOA Response
            // Do no reload columns
            treeLoadResult = exports.getTreeLoadResult( contextKey, nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );

            variabilityProps.filterApplied = true;

            // In case filter is being reset
            if( !variabilityProps.activeFilter ) {
                variabilityProps.filterApplied = undefined;
            }
        } else {
            // Make Server call
            // Build configPerspective and Context UID based on active context
            let { configPerspective } = pca0CommonUtils.getConfigPerspectiveAndContextUid( variantRuleData );

            let evaluationCtx = {
                data: viewModel,
                ctx: appCtxService.ctx,
                props: {
                    fscstate: fscState,
                    variant: variantRuleData,
                    configCtx:  _.get( consumerData, 'configContext' ) ? consumerData.configContext : undefined,
                    isHostedPcaMode: consumerData ? consumerData.isHostedPcaMode : undefined,
                    configPerspective: _.get( consumerData, 'configPerspective' ) ? consumerData.configPerspective : configPerspective
                }
            };
            let svrAction = viewModel.getAction( viewModelAction );
            if( svrAction.deps ) {
                return declUtils.loadDependentModule( svrAction.deps ).then(
                    function( debModuleObj ) {
                        return actionService.executeAction( viewModel, svrAction, evaluationCtx, debModuleObj ).then( function( actionResult ) {
                            // Add context key only to 1st column so that populateHeaderIcon function calls _setContainerHeight only once for complete tree.
                            if( _.get( actionResult, 'columnConfig.columns.0' ) ) {
                                actionResult.columnConfig.columns[ 0 ].contextKey = contextKey;
                            }

                            // ***NOTE: Temporary solution***
                            // ExecuteAction will return:
                            // - a SOA response for Variability Explorer
                            // - a JS object for VCV grid containing soaResponse plus configParams (containsConfigData is set to true)
                            // VCV is a special case where soaResponse needs post-processing before calling exports.loadDataInTree
                            let soaResponse;
                            let operation;
                            if( actionResult.containsConfigData ) {
                                // Update Load params array with dynamic configuration data coming from soaResponse post-processing
                                variabilityProps = { ...actionResult.variabilityProps };
                                let cachedTreeLoad = { ...treeMaps.cachedTreeLoad };
                                treeMaps = { ...actionResult.treeMaps };
                                // cachedTreeLoad is needed to create treeNodes in getTreeLoadResult function in case filter on column is applied
                                treeMaps.cachedTreeLoad = cachedTreeLoad;
                                soaResponse = variabilityProps.soaResponse;
                            } else {
                                // Update Load params array with soaResponse
                                soaResponse = actionResult;
                                if( _.get( viewModel, '_internal.viewId' ) === 'pca0VariabilityExplorerTree' && variabilityProps.soaResponse ) {
                                    variabilityProps.soaResponse.ServiceData = soaResponse.ServiceData;
                                    variabilityProps.soaResponse.configPerspective = soaResponse.configPerspective;
                                    variabilityProps.soaResponse.resetColumnProperties = soaResponse.resetColumnProperties;
                                    //merge the new response onto the existing variability data
                                    const map = new Map();
                                    variabilityProps.soaResponse.variabilityTreeData.forEach( item => map.set( item.nodeUid, { ...map.get( item.nodeUid ), ...item } ) );
                                    soaResponse.variabilityTreeData.forEach( item => map.set( item.nodeUid, item ) );
                                    const mergedArr = Array.from( map.values() );
                                    variabilityProps.soaResponse.variabilityTreeData = mergedArr;
                                    variabilityProps.soaResponse.viewModelObjectMap = {
                                        ...variabilityProps.soaResponse.viewModelObjectMap,
                                        ...soaResponse.viewModelObjectMap
                                    };
                                } else {
                                    variabilityProps.soaResponse = soaResponse;
                                }
                            }
                            // Process Partial Errors
                            let partialErrors = _.get( soaResponse, 'ServiceData.partialErrors' );
                            if( partialErrors ) {
                                pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
                                return;
                            }

                            // Update Load params array with static configuration data
                            if( !_.isUndefined( variabilityProps.resetColumnProperties ) ) {
                                variabilityProps.soaResponse.resetColumnProperties = variabilityProps.resetColumnProperties;
                            }

                            // NOTE this is direct VM manipulation, avoid!
                            // TODO
                            if( viewModel.data && viewModel.data.operation ) {
                                operation = viewModel.data.operation;
                                // Delete operation to avoid its persistence so next time we don't use old operation
                                delete viewModel.data.operation;
                            }

                            // Load tree result according to config parameters specific for each variability tree service
                            var treeLoadResult = exports.getTreeLoadResult( contextKey, nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider, operation,
                                viewModel.gridEditorSelections, userSelectionsPickAndChooseGrid );

                            if( !variabilityProps.activeFilter ) {
                                // Cache TreeLoadResult for filtering purposes
                                treeMaps.cachedTreeLoad = treeLoadResult;
                            }
                            //do not replace the treeDataProvider.columnConfig with the action result columnConfig if undefined
                            let colCfg = actionResult.columnConfig ? actionResult.columnConfig : treeDataProvider.columnConfig;
                            return {
                                treeLoadResult: treeLoadResult,
                                columnConfig: colCfg,
                                treeLoadParentNode: nodeBeingExpanded,
                                treeMaps: treeMaps,
                                variabilityProps: variabilityProps,
                                initialColumnFilters: []
                            };
                        }, function( err ) {
                            // Display error message
                            messagingService.showError( String( err ) );
                            return {
                                treeLoadResult: [],
                                treeLoadParentNode: nodeBeingExpanded
                            };
                        } );
                    } );
            }
        }
    } else {
        // Load intermediate nodes
        // Notes:
        // 1- do not update expandAll. If set to false, it can prevent tree reloading when a filter is cleared
        // 2- do not update cached treeLoadResult used for filtering: in this case treeLoadResult is the list of childNodes for the node being expanded
        treeLoadResult = exports.getTreeLoadResult( contextKey, nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider );
    }
    // Delete operation to avoid its persistence so next time we don't use old operation
    if( viewModel.data && viewModel.data.operation ) {
        delete viewModel.data.operation;
    }

    return {
        treeLoadResult: treeLoadResult,
        columnConfig: treeDataProvider.columnConfig,
        treeLoadParentNode: nodeBeingExpanded,
        treeMaps: treeMaps,
        variabilityProps: variabilityProps
    };
};

/**
 * Load columns and selections map
 * @param {Array} columnProperties - list of Column Properties
 * @param {Object} variabilityColumnProps - data container for Variability columns properties
 * @param {String} contextKey - Context Key
 * @param {UwDataProvider} treeDataProvider - Data Provider instance
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {Boolean} skipCellRenderer - true if cellRenderers must not be processed for BO/SVR/Constraints columns
 * @returns {Object} Column Definitions
 */
export let loadColumns = function( columnProperties, variabilityColumnProps, contextKey, treeDataProvider, vmGridSelectionState, skipCellRenderer ) {
    let columnInfos = [];
    const gridId = _.get( treeDataProvider, 'json.gridId', '' );
    if ( [ 'pca0Grid', 'bottomConstraintsGrid', 'multipleVariantsConfigGrid' ].includes( gridId ) ) {
        const serverColumns = variabilityColumnProps.serverColumns;
        if ( serverColumns ) {
            serverColumns.forEach( column => {
                column.cellRenderers = [ pca0RendererService.filterCellRenderer( pca0GridAuthoringService.handleCellClick, contextKey, treeDataProvider, vmGridSelectionState ) ];
                columnInfos.push( column );
            } );
        }
    }

    // Build BO columns
    _.forEach( columnProperties, columnProps => {
        columnInfos.push( exports.createColumnDef( columnProps, contextKey, treeDataProvider, vmGridSelectionState, skipCellRenderer ) );
    } );

    // In VCA we also need to read the column config file and show th extra columns in the grid
    // So here, we are stiching the 'variabilityContent' column + columns received from cots file ( Example - Intents ) + Selected BOM line expressions in Primary work area.
    if ( gridId === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        const existingColumnConfig = _.get( treeDataProvider, 'columnConfig.columns', [] ).filter( column => !( 'formula' in column ) );
        columnInfos = [ ...existingColumnConfig, ...columnInfos ];
    }

    return {
        columnInfos: columnInfos
    };
};

/**
 * Create the View Model Tree Node
 * @param {String} contextKey - the Context Key
 * @param {String} nodeUid  - UID for the node in the tree table
 * @param {Number} levelNdx - The # of levels down from the Root of the tree-table
 * @param {String} parentNodeUid - UID of parent node in the tree table
 * @param {String} parentNodeAlternateUid - alternate UID of parent node in the tree table
 * @param {Number} childNdx - The index to this 'child' within the immediate 'parent'
 * @param {Object} soaResponse - the Cached SOA response
 * @param {Object} selectionMap - selectionMap
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Boolean} isSpecialBackgroundCell - true if cell needs a special header-like background style
 * @param {Object} gridData - [Constraints Grid editor only] To get selection map with respective to constraints grid topGrid/bottomGrid
 * @param {Array} columnInfos - [ConstraintsGridEditor scenario only] columnInfo to extract newColumnProps if needed
 * @param {Object} splitColumnTypesMap - [Constraints Grid editor only] map of Split Column types
 * @return {ViewModelTreeNode} View Model Tree Node complete of all mandatory properties
 */
export let createViewModelTreeNode = function( contextKey, nodeUid, levelNdx, parentNodeUid, parentNodeAlternateUid, childNdx, soaResponse, selectionMap, backupSelectionMap, isSpecialBackgroundCell,
    gridData, columnInfos, splitColumnTypesMap ) {
    let vmPropsDelete = false;

    let { node, viewModelObject, parentObject, propInfoUIDs, isConstraintsEditorPropInfoNodeUid } = _getNodeObjectsFromVariabilityData( nodeUid, parentNodeUid, gridData, soaResponse );
    let { isParentFreeForm, isParentEnumerated } = pca0CommonUtils.validateFreeFormAndEnumeratedParentVMO( parentNodeUid, parentObject, viewModelObject );

    var vmTreeNode;
    //the config modules path, at the leaf there is no node info
    if( _.isUndefined( node ) && !_.isUndefined( viewModelObject ) ) {
        node = {
            displayName: viewModelObject.displayName,
            sourceType: viewModelObject.sourceType,
            uid: viewModelObject.sourceUid,
            isExpanded: false,
            nodeUid: viewModelObject.sourceUid
        };
    }
    if( !_.isUndefined( node ) && !_.isUndefined( viewModelObject ) ) {
        // determine if the node is partially unconfigured: in the multivariant soa response we do get the unconfigured children
        // and props in the variability tree data but not in the viewModelObjectMap, so we need to determine if a node is
        // partially unconfigured and attach that info to the vmo
        let partiallyUnconfigured = undefined;
        //only usw the partially unconfigured for multivariants and for performance reasons skip groups as well
        //also do not bother with unconfigured nodes at all if the response does not have any - performance enhancement
        if( gridData && gridData.isUnconfiguredPresent && gridData.gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID && parentObject ) {
            partiallyUnconfigured = pca0CommonUtils.getPartiallyUnconfiguredProps( soaResponse.variabilityTreeData, viewModelObject, parentObject );
        }

        vmTreeNode = _createVMO(
            contextKey, // contextKey
            node, // node
            viewModelObject, // viewModelObject
            levelNdx, // levelNdx
            childNdx, // childNdx
            isParentFreeForm, // isParentFreeForm
            isParentEnumerated, // isParentEnumerated
            isSpecialBackgroundCell, // isSpecialBackgroundCell
            isConstraintsEditorPropInfoNodeUid, // isConstraintsEditorPropInfoNodeUid
            partiallyUnconfigured,
            gridData ? gridData.gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID : undefined
        );
        if( isParentEnumerated ) {
            vmTreeNode.familyType = _.get( parentObject, 'props.cfg0ValueDataType[0]' );
        }

        // Handle Variability Explorer scenario
        if( soaResponse.resetColumnProperties ) {
            pca0CommonUtils.setIsLeafProperty( node, vmTreeNode );
            vmPropsDelete = true;
        }
    } else if( ( isParentFreeForm || isParentEnumerated ) && _.isUndefined( viewModelObject ) ) {
        vmTreeNode = _createFreeFormEnumeratedVMO( parentNodeUid, isParentFreeForm, isParentEnumerated, nodeUid, levelNdx, childNdx );
    }

    //return in case of trying to create one of the fake unconfigured nodes that multivariants can get
    if( !_.isUndefined( node ) && _.isUndefined( viewModelObject ) && _.get( node, 'props.isUnconfigured' ) ) {
        return undefined;
    }

    // Initialize properties for the ViewModelTreeNode that were not created by awTableService.createViewModelTreeNode
    vmTreeNode.nodeUid = nodeUid;
    vmTreeNode.parentUID = parentNodeUid; // needed when creating VM properties

    // Expansion state is evaluated when rendering the tree nodes (default is false)
    vmTreeNode.isExpanded = false;

    // AW6.0 - Add dummy property on unassigned group object to ensure that framework doesn't invoke recursive server calls to fetch properties
    // Refer LCS-541819
    if( Object.values( pca0Constants.PSEUDO_GROUPS_UID ).includes( vmTreeNode.nodeUid ) ) {
        // this will allow to visible commands on unassigned object type cell
        // expand below and collapse below commands get visible with this change
        vmTreeNode.props = vmTreeNode.nodeUid === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ? {
            object_string: {
                uiValue: vmTreeNode.displayName,
                dbValue: vmTreeNode.displayName,
                uiValues: [ vmTreeNode.displayName ]
            }
        } : {
            dummy_property: []
        };
    }

    // Following are used by framework to differentiate common uid used in multiple family
    // Also, we use alternateID to differentiate common features
    vmTreeNode.alternateID = pca0CommonUtils.prepareUniqueId( parentNodeAlternateUid ? parentNodeAlternateUid : parentNodeUid, nodeUid );
    vmTreeNode.getId = function() {
        return vmTreeNode.alternateID;
    };

    if( !vmPropsDelete ) {
        let isSubjectGrid = !_.isUndefined( gridData ) ? gridData.gridNodes.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID ) : undefined;

        vmTreeNode.props = exports.generatePropertyMap(
            vmTreeNode, // vmTreeNode
            soaResponse.variabilityPropertiesToDisplay, // variabilityPropertiesToDisplay
            soaResponse.viewModelObjectMap, // viewModelObjectMap
            selectionMap, // selectionMap
            backupSelectionMap, // backupSelectionMap,
            columnInfos, // for Constraints Grid editor only
            splitColumnTypesMap, // map of Split Column Types
            isSubjectGrid, // is grid containing Subject section
            propInfoUIDs, // list of 'Properties Information' node UIDs
            !_.isUndefined( gridData ) ? gridData.viewModelObjectMap : undefined // grid viewModelObjectMap
        );
    }


    //this is for multiSvr highlighting - can be used for other highlighting as well in order to trigger a rendering with a specific style
    //in order to restore the highlighted obj after manual expansion/collapse
    if( _.get( gridData, 'highlightedVmos' ) &&  gridData.highlightedVmos.includes( vmTreeNode.alternateID ) ) {
        vmTreeNode.highlight = true;
    }

    //in the case of multivariants unconfigured features we need to disable the feature and here we'll map the selection which comes in as altId:unconfiguredFeatureName
    if( vmTreeNode.isPartiallyUnconfigured ) {
        let famNamespace = _.get( vmTreeNode, 'props.cfg0FamilyNamespace.dbValue.0' );
        let selectedExp;
        vmTreeNode.isPartiallyUnconfigured.forEach( svr => {
            let unconfiguredAlternateID;
            if( vmTreeNode.isFeature  ) {
                unconfiguredAlternateID = vmTreeNode.alternateID.split( ':' ).map( ( value, index, origAltUid ) => index === origAltUid.length - 1 ? origAltUid[origAltUid.length - 2] : value ).join( ':' );
                selectedExp = gridData.businessObjectToSelectionMap[ svr ][unconfiguredAlternateID + ':' + vmTreeNode.displayName ];
            } else if( vmTreeNode.isFamily ) {
                unconfiguredAlternateID = vmTreeNode.alternateID.split( ':' ).slice( 0, -1 ).join( ':' );
                selectedExp = gridData.businessObjectToSelectionMap[ svr ][unconfiguredAlternateID + ':' + famNamespace + ':' + vmTreeNode.displayName ];
            }
            //split the altUid to get the selection in the column as parentUi:displayName as it's stored in the businessObjectToSelectionMap
            if( selectedExp ) {
                vmTreeNode.props[svr].dbValue = selectedExp.selectionState;
                vmTreeNode.props[svr].originalValue = selectedExp.selectionState;
                vmTreeNode.props[svr].props = selectedExp.props;
            }
        } );
    }
    return vmTreeNode;
};

/**
 * Recursive util to create treeNodes and expanding them all, except leaf nodes.
 * @param {String} contextKey - the Context Key
 * @param {Object} rootNode - Root Node for the structure to be created recursively
 * @param {Number} expandingLevel - Level # for the node being created
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} nodeBeingExpandedChildren - List of children for the node being created (and expanded recursively)
 * @param {Object} soaResponse - SOA response
 * @param {Object} selectionMap - selectionMap
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Array} specialBackgroundCells - list of cells that need a special header-like background style
 * @param {Integer} stopExpansionLevel - levelNdx where we need to stop recursive expansion
 * @param {Integer} showSummaryForLevelNdx - levelNdx where summary of childrenUids selections must be displayed
 * @param {Object} gridData - [ConstraintsGridEditor scenario only] topGrid/bottomGrid data
 * @param {Array} columnInfos - [ConstraintsGridEditor scenario only]
 * @param {Array} gridEditorSelections - [ConstraintsGridEditor-Pick&Choose panel scenario only] existing selections in grid Editor to be used for preselecting family/features
 * @param {Object} splitColumnTypesMap - [ConstraintsGridEditor] map of SplitColumn Types
 * @param {Object} filterData - Applied filter details
 * @param {Boolean} isBottomGrid - [ConstraintsGridEditor]true if recursive node creation is happening in bottom grid
 * @param {Object} gridID - gridID
 * @param {object} filterCollection - // filterCollection used to store filteredNodeUids and acceptedNodeUids

 */
export let recursiveCreateTreeNode = ( contextKey, rootNode, expandingLevel, treeNodes, nodeBeingExpandedChildren, soaResponse, selectionMap, backupSelectionMap,
    specialBackgroundCells, stopExpansionLevel, showSummaryForLevelNdx, gridData, columnInfos, gridEditorSelections, splitColumnTypesMap, filterData,
    isBottomGrid, gridID, filterCollection ) => {
    //attach the gridID to the rootNode to the gridData as we need it down the road multiple times
    if( gridData ) {
        gridData.gridID = gridID;
    }


    // eslint-disable-next-line complexity
    rootNode.childrenUids && rootNode.childrenUids.forEach(  id => {
        // If filters are being applied multiple columns and the node id is not present in the filteredNodeUids list, skip processing this node.
        // filteredNodeUids contains alternateIDs that passed previous filter criteria.
        // If filterData is not present, we process all nodes.
        if( filterData?.values?.length && filterCollection.filteredNodeUids?.length  ) {
            // here we check if the node id is present in the filteredNodeUids list (containing alternateIDs)
            if( !filterCollection.filteredNodeUids.some( alternateID => alternateID && alternateID.includes( id ) ) ) {
                return;
            }
        }
        let treeNode = exports.createViewModelTreeNode(
            contextKey, // contextKey
            id, // nodeUid
            expandingLevel, // levelNdx
            rootNode.nodeUid, // parentNodeUid
            rootNode.alternateID,
            rootNode.childrenUids.indexOf( id ), //childNdx
            soaResponse, // soaResponse
            selectionMap, // selectionMap
            backupSelectionMap, // backupSelectionMap
            !_.isUndefined( specialBackgroundCells ) && specialBackgroundCells.includes( id ), // isSpecialBackgroundCell
            gridData, // top/bottom grid data
            columnInfos, // columnInfos to extract newColumnProps
            splitColumnTypesMap // splitColumn type map
        );
        //unconfigured families as well as feature nodes may result in undefined nodes, just skip them
        if( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID && !treeNode ) {
            return;
        }

        let filterSatisfied = _checkFilteringCriteriaAndUpdateTreeNodes( filterData, treeNode, treeNodes, gridID );

        // Iterate through children if iteration can continue
        if( !treeNode.isLeaf && !_.isUndefined( treeNode.childrenUids ) && treeNode.childrenUids.length > 0 ) {
            const { isPseudoNode, isGroup, isFamily, isFeature } = _identifyNodeTypes( _.get( gridData, `viewModelObjectMap[${id}].props` ) );

            treeNode.isExpanded = _.isUndefined( stopExpansionLevel ) || stopExpansionLevel !== treeNode.levelNdx && stopExpansionLevel >= 0
                                    || stopExpansionLevel === -1 && ( isPseudoNode || isGroup || !isFamily );
            let rowSummary = '';
            // Update Summary if needed
            // treeNode is collapsed then we want to show summary for all grids
            if( gridData && !_.isUndefined( showSummaryForLevelNdx ) && ( showSummaryForLevelNdx === expandingLevel || showSummaryForLevelNdx === -1 && !isFeature && !isGroup ) ) {
                if( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
                    pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                        gridData.businessObjectToSelectionMap, // only for constraints grid
                        treeNode, // viewModelTreeNode,
                        gridData.viewModelObjectMap,
                        columnInfos,
                        isBottomGrid, // isBottomGrid
                        veConstants.GRID_CONSTANTS.MULTI_SVR_GRID, //gridMode - This will be removed once we have gridOptions prop for a generic grid component
                        undefined, //vmos
                        gridData.variabilityNodes,
                        gridData.businessObjectToSelectionMapKeys
                    );
                } else{
                    pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                        gridData.businessObjectToSelectionMap, // only for constraints grid
                        treeNode, // viewModelTreeNode,
                        gridData.viewModelObjectMap,
                        columnInfos,
                        isBottomGrid, // isBottomGrid
                        ''
                    );
                }
            }
            const currentNodes = treeNodes.length;


            if( treeNode.isExpanded ) {
                exports.recursiveCreateTreeNode( contextKey, treeNode, expandingLevel + 1, treeNodes, treeNode.children,
                    soaResponse, selectionMap, backupSelectionMap, specialBackgroundCells, stopExpansionLevel,
                    showSummaryForLevelNdx, gridData, columnInfos, gridEditorSelections, splitColumnTypesMap,
                    filterData, isBottomGrid, gridID, filterCollection );
            } else if( filterData && Object.keys( filterData ).length > 0 && gridData && !filterSatisfied ) {
                // If parent is not satisfying filter criteria and it's not expanded but child is satisfying criteria then keep it
                // If any parent node cell is empty for a column, we still need to keep it in order to check for its child nodes.
                treeNode.isExpanded = true;
                exports.recursiveCreateTreeNode( contextKey, treeNode, expandingLevel + 1, treeNodes, treeNode.children,
                    soaResponse, selectionMap, backupSelectionMap, specialBackgroundCells, stopExpansionLevel,
                    showSummaryForLevelNdx, gridData, columnInfos, gridEditorSelections, splitColumnTypesMap,
                    filterData, isBottomGrid, gridID, filterCollection );
            } else if( !treeNode.isExpanded && filterData && Object.keys( filterData ).length > 0 && filterSatisfied ) {
                // If parent is satisfying filter criteria and it's not expanded then keep it
                _createChildNodesForCollapsedParent( treeNode, contextKey, expandingLevel, soaResponse, selectionMap, backupSelectionMap,
                    specialBackgroundCells, gridData, columnInfos, splitColumnTypesMap, filterCollection, gridID
                );
            }
            if( currentNodes === treeNodes.length && filterData && Object.keys( filterData ).length > 0 && treeNode.levelNdx !== 0 && !treeNode.isLeaf && !filterSatisfied ) {
                treeNodes.pop();
            }
            // allow all the subnodes to be part of the filtering regardless of the match - true for example for group node filtering or some special constraint nodes
            filterData && filterData.allowAllChild === treeNode.uid ? delete filterData.allowAllChild : '';
        } else if( gridID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID && !gridData.expandAll && !treeNode.isExpanded && treeNode.isFamily ) {
            _setSummaryForFamilyWithoutChildren( treeNode, columnInfos );
            //the use case is that an SVR can be loaded in current expressions only mode, so the family node will have no children but it might have a
            //summary value if for example the family node is 'any' or 'none'. With the code below excluding only the non summary grids
        }
        if( expandingLevel !== 0 ) {
            nodeBeingExpandedChildren.push( treeNode );
        }
    } );
};

/**
 * Helps to prepare selections to show on tree
 * @param {Array} presentSelections - array of selection came from selectionModel
 * @param {Array} userSelectionsPickAndChooseGrid - Array of alternateIDs of user made selection in features and models tab in pick and choose panel
 * @param {Array} treeNodes - list of tree nodes
 * @param {Array} gridEditorSelections - Array of selections present in grid editor that we have to reflect in Pick and choose panel
 * */
let _updateUserSelectionInTree = ( presentSelections, userSelectionsPickAndChooseGrid, treeNodes, gridEditorSelections ) => {
    // This is needed for Pick and choose panel to show preselected Group/Family/Features and disable them, as those are already allocated or reused.
    if( !_.isEmpty( userSelectionsPickAndChooseGrid ) || !_.isEmpty( gridEditorSelections ) ) {
        // This code is to show active selections user did for model and features TAB in pick and choose panel BEFORE allocation or reusing them.
        treeNodes.filter( node => {
            for( const userSelection of userSelectionsPickAndChooseGrid ) {
                if ( node.alternateID === userSelection || node.uid === userSelection ) {
                    !presentSelections.includes( node.alternateID ) && presentSelections.push( node.alternateID );
                }
            }

            // following block of code is gets executed when user is opening the pick and choose panel from the grid editor
            // as grid uid do not containts context or group uid instead it contains subject and condition as parent uid for family
            // e.g. "__Pca0_Constraints_Subject_Section__:GOV52$$Rp0UAMA" where __Pca0_Constraints_Subject_Section__ is the parent uid as subject
            // due to this we need to set family isPreselected.
            if ( node.isFamily ) {
                for( const gridEditorSelection of gridEditorSelections ) {
                    const parentUid = ':' + node.uid;
                    if ( gridEditorSelection.includes( parentUid )  ) {
                        node.isPreselected = true;
                        presentSelections.push( node.alternateID );
                    }
                }
            }
        } );
    }
    // This is needed for Pick and choose panel to preselect the Group/Family/Features
    presentSelections.push( ...treeNodes.filter( node => node.isPreselected ).map( node => node.alternateID ) );
};

//
/**
 * Get Tree Load result to populate grid data provider
 * @param {String} contextKey - the Context Key
 * @param {ViewModelTreeNode} nodeBeingExpanded - View Model Tree Node being expanded
 * @param {Object} treeMaps - View Model data property treeMaps
 * @param {Object} variabilityProps - View Model Atomic Data
 * @param {UwDataProvider} treeDataProvider - Tree Data Provider
 * @param {String} operation - The command action that is performed
 * @param {Array} gridEditorSelections - Array of selections present in grid editor that we have to reflect in Pick and choose panel
 * @param {Array} userSelectionsPickAndChooseGrid - Array of alternateIDs of user made selection in features and models tab in pick and choose panel
 * @returns {Object} - The Tree Load Result
 */
export let getTreeLoadResult = function( contextKey, nodeBeingExpanded, treeMaps, variabilityProps, treeDataProvider, operation, gridEditorSelections, userSelectionsPickAndChooseGrid ) {
    let parentNode = nodeBeingExpanded;
    let soaResponse = variabilityProps.soaResponse;
    let treeNodes = [];
    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );

    let inputNode = _.find( variabilityNodes, { nodeUid: parentNode.nodeUid } );
    let presentSelections = gridEditorSelections ? treeDataProvider.selectionModel.getSelection() : [];
    // Tree Structure reload
    // recursive tree load operation starting from Root Node
    if( nodeBeingExpanded.id === pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ) { // First level
        let variantTreeData = soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes ?
            soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ].variabiltyNodes : soaResponse[ pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY ];
        let rootElement = variantTreeData.filter( treeNode => treeNode.nodeUid === '' );
        assert( rootElement, 'RootElement is missing in the response' );
        parentNode = rootElement[ 0 ];

        // Process active filters
        // Note: filter operation can be done once tree load is complete
        // if user switches display mode, any active filter is reset.
        // if( data.activeFilter && data.activeFilter.operation === 'contains' ) {
        if( variabilityProps.activeFilter ) {
            // In case of active filters, tree nodes is rendered already
            // Use cached treeLoad information to apply filter
            let treeData;
            if( _.isUndefined( treeMaps.cachedTreeLoad ) ) {
                // new logic for VCA
                // TODO: change to recreate treeLoadResult filtered instead of fullCreate+applyFilter
                // TODO: apply this to VCV and VE. No need to carry around a cached treeLoad result
                // Get Full Tree Load Result
                let treeLoadResultNodes = [];
                if( variabilityProps.expansionMap ) {
                    exports.recursiveCreateTreeNodeWithMap( contextKey, parentNode, nodeBeingExpanded.levelNdx + 1, variabilityProps.expansionMap, treeLoadResultNodes, [], soaResponse,
                        variabilityProps.businessObjectToSelectionMap, variabilityProps.backupOfBusinessObjectToSelectionMap );
                } else if( variabilityProps.expandAll ) {
                    exports.recursiveCreateTreeNode( contextKey, parentNode, nodeBeingExpanded.levelNdx + 1, treeLoadResultNodes, [], soaResponse, variabilityProps.businessObjectToSelectionMap,
                        variabilityProps.backupOfBusinessObjectToSelectionMap, undefined,
                        undefined, undefined, undefined, undefined, [] );
                }
                treeData = {
                    // Performance Note: cloneDeep is necessary
                    // or filter operation will clear childrenUids of families not matching the filter
                    childNodes: _.cloneDeep( treeLoadResultNodes )
                };
            } else {
                // Performance Note: cloneDeep is necessary
                // or filter operation will clear childrenUids of families not matching the filter
                treeData = _.cloneDeep( treeMaps.cachedTreeLoad );
            }

            // TODO REVISIT FOR CONSTRAINTS when filtering functionality is added: add handling for splitColumnTypesMap
            treeNodes =  exports.getFilteredTreeLoadResult( [ ...treeData.childNodes ], variabilityProps.activeFilter, treeDataProvider.columnConfig.columns );

            // If the operation is save in VCA and filter is applied on column, update the props value of each treeNode
            // with the latest soaResponse, so that correct selection states are shown in grid view
            if( _.isEqual( operation, pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE ) ) {
                _.forEach( treeNodes, ( treeNode ) => {
                    treeNode.props = exports.generatePropertyMap( treeNode, soaResponse );
                } );
            }
            variabilityProps.filterApplied = true;
        } else {
            // This is the main entry point: dataProvider objects initialization
            // Tree is being loaded for the first time, OR
            // any user action triggered data reload (e.g. change of display mode)
            if( variabilityProps.expansionMap ) {
                exports.recursiveCreateTreeNodeWithMap( contextKey, parentNode, nodeBeingExpanded.levelNdx + 1, variabilityProps.expansionMap, treeNodes, [], soaResponse,
                    variabilityProps.businessObjectToSelectionMap, variabilityProps.backupOfBusinessObjectToSelectionMap );
            } else if( variabilityProps.expandAll ) {
                exports.recursiveCreateTreeNode( contextKey, parentNode, nodeBeingExpanded.levelNdx + 1, treeNodes, [], soaResponse, variabilityProps.businessObjectToSelectionMap,
                    variabilityProps.backupOfBusinessObjectToSelectionMap );
            }
        }
    } else if( inputNode ) {
        // Manual expansion of a tree node
        // Note: when expanding a node, ignore any active filters:
        // If node is present, this means node is filtered -> children are filtered by default
        var childIDs = inputNode.childrenUids;

        // If there are no child elements, update isLeaf property based on SOA response
        if( !childIDs && inputNode.hasOwnProperty( 'props' ) && inputNode.props.hasOwnProperty( 'isLeaf' ) ) {
            pca0CommonUtils.setIsLeafProperty( inputNode, nodeBeingExpanded );
        }

        // For Free Form Values add nodes from freeFormMap
        // which also includes free form option values recently added by user
        const parentUID = parentNode.nodeUid;
        // When expanding empty Unassigned Families group viewModelObjectMap is undefined getting parentObject from variabilityTreeData
        //let parentObject = soaResponse.viewModelObjectMap ? soaResponse.viewModelObjectMap[ parentUID ] : soaResponse.variabilityTreeData.variabiltyNodes[ 0 ];
        //TBD
        let parentObject = soaResponse.viewModelObjectMap ? soaResponse.viewModelObjectMap[ parentUID ] : _.get( soaResponse, 'variabilityTreeData.variabiltyNodes.0' );
        var loadedObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        var parentVMO = _.find( loadedObjects, { nodeUid: parentUID } );
        //TBD
        if ( parentObject && ( pca0CommonUtils.isObjectFreeForm( parentObject ) || pca0CommonUtils.isEnumeratedFamily( parentObject ) ) &&
            treeMaps.freeFormAndEnumeratedValuesMap && !_.isUndefined( treeMaps.freeFormAndEnumeratedValuesMap[ parentUID ] ) && treeMaps.freeFormAndEnumeratedValuesMap[
            parentUID ].length !== 0 ) {
            // Get list of values from local map, containing all free form values for that parent
            var freeFormChildIDs = treeMaps.freeFormAndEnumeratedValuesMap[ parentUID ];

            // Add childIDs that are not loaded yet
            childIDs = _.filter( freeFormChildIDs, function( childID ) {
                return _.isUndefined( _.find( parentVMO.children, { nodeUid: childID } ) );
            } );

            // isLeaf property is being re-evaluated to include future possibility to remove freeForm
            nodeBeingExpanded.isLeaf = freeFormChildIDs.length === 0;
        }

        childIDs && childIDs.forEach( id => {
            var childNdx = childIDs.indexOf( id );

            let expandingLevel = nodeBeingExpanded.levelNdx + 1;
            let treeNode = exports.createViewModelTreeNode(
                contextKey, // contextKey
                id, // nodeUid
                expandingLevel, // levelNdx
                nodeBeingExpanded.nodeUid, // parentNodeUid,
                nodeBeingExpanded.alternateID, // parentNode alternateID,
                childNdx, // childNdx
                soaResponse, // soaResponse
                variabilityProps.businessObjectToSelectionMap, // selectionMap
                variabilityProps.backupOfBusinessObjectToSelectionMap, // selectionMap
                false, // isSpecialBackgroundCell
                undefined, // grid data
                [], // for constraint grids: treeDataProvider columns
                undefined // for constraint grids:  map for splitColumn Types
            );
            // following code is specific to Pick and choose panel
            if( gridEditorSelections && !_.isEmpty( gridEditorSelections ) && treeNode.isLeaf ) {
                _.find( gridEditorSelections, gridEditorData => {
                    if( treeNode.alternateID.includes( gridEditorData ) ) {
                        treeNode.isPreselected = true;
                        return true;
                    }
                } );
            }
            treeNodes.push( treeNode );
        } );
    }
    _updateUserSelectionInTree( presentSelections, userSelectionsPickAndChooseGrid, treeNodes, gridEditorSelections );
    return {
        parentNode: nodeBeingExpanded,
        childNodes: treeNodes,
        totalChildCount: treeNodes.length,
        startChildNdx: 0,
        presentSelections
    };
};

/**
 * Generate Property Map for the ViewModel TreeNode
 * @param {ViewModelTreeNode} vmTreeNode - the treeNode to attach the map to.
 * @param {Array} variabilityPropertiesToDisplay - additional variability properties to display
 * @param {Object} soaResponseViewModelObjectMap - viewModelObjectMap from SOA response
 * @param {Object} selectionMap - selectionMap
 * @param {Object} backupSelectionMap - backup SelectionMap (Used when creating nodes in Edit Mode)
 * @param {Array} columnInfos - [ConstraintsGridEditor scenario only] columnInfo to extract newColumnProps if needed
 * @param {Object} splitColumnTypesMap - [Constraints Grid editor only] map of Split Column types
 * @param {Boolean} isSubjectGrid - [Constraints Grid editor only] true if current VMO is being build for Subject grid
 * @param {Array} propInfoUIDs - [Constraints Grid editor only] UIDs of 'Properties information' nodes
 * @param {Object} gridViewModelObjectMap - [Constraint Grid Editor] viewModelObjectMap
 * @return {Object} propertyMap - map of ViewModelProperty objects for the treeNode
 */
export let generatePropertyMap = function( vmTreeNode, variabilityPropertiesToDisplay, soaResponseViewModelObjectMap, selectionMap, backupSelectionMap,
    columnInfos, splitColumnTypesMap, isSubjectGrid, propInfoUIDs, gridViewModelObjectMap ) {
    const rangeDetails = _.get( soaResponseViewModelObjectMap, vmTreeNode.uid + '.props.rangeInfo.0' );
    const violationSeverityIndicatorImgMap = {
        [pca0Constants.ERROR_SEVERITIES.ERROR]: 'indicatorError',
        [pca0Constants.ERROR_SEVERITIES.WARNING]: 'indicatorWarning',
        [pca0Constants.ERROR_SEVERITIES.INFO]: 'indicatorInfo'
    };
    let propertyMap = {
        object_string: {
            uiValue: vmTreeNode.displayName,
            dbValue: 5
        },
        rangeInfo: {
            uiValue: rangeDetails
        }
    };

    let isConstraintNodePropInfo = pca0CommonUtils.isConstraintsEditorPropInfoNodeUid( vmTreeNode.nodeUid, propInfoUIDs );

    let viewModelObject;

    // 'Properties information' nodes come from SOA response
    if( !_.isUndefined( gridViewModelObjectMap ) && !isConstraintNodePropInfo ) {
        viewModelObject = gridViewModelObjectMap[ vmTreeNode.nodeUid ];
    } else if( soaResponseViewModelObjectMap[ vmTreeNode.nodeUid ] ) {
        viewModelObject = soaResponseViewModelObjectMap[ vmTreeNode.nodeUid ];
    }

    if( viewModelObject ) {
        propertyMap[ pca0Constants.GRID_CONSTANTS.SOURCE_TYPE ] = pca0CommonUtils.getViewModelProperty( pca0Constants.GRID_CONSTANTS.SOURCE_TYPE, vmTreeNode.parentUID, viewModelObject.sourceType );
        _populatePropsInPropertyMap( propertyMap, viewModelObject.props );
    }

    if( !vmTreeNode.isParentFreeForm && !vmTreeNode.isParentEnumerated ) {
        variabilityPropertiesToDisplay.forEach( propertyName => {
            let propertyValue = '';
            if( viewModelObject.props ) {
                propertyValue = viewModelObject.props[ propertyName ][ 0 ];
            }
            propertyMap[ propertyName ] = pca0CommonUtils.getViewModelProperty( propertyName, vmTreeNode.parentUID, propertyValue );
        } );
    }

    // Create PropertyMap looping through businessObjectToSelectionMap
    // Note: businessObjectToSelectionMap has all column indexes, even in case no selections are set
    let businessObjectKeys = !_.isUndefined( Object.keys( selectionMap ) ) ? Object.keys( selectionMap ) : [];
    businessObjectKeys.forEach( key => {
        let propertyVal = 0;
        let searchUid = vmTreeNode.alternateID;
        let selectedObject = _.get( selectionMap[ key ], searchUid ) ? _.get( selectionMap[ key ], searchUid ) : _.get( selectionMap[ key ], vmTreeNode.nodeUid );
        let exprVal = '';
        let columnDef = _.find( columnInfos, { uid: key } );
        let props = !_.isUndefined( selectedObject ) && _.get( selectedObject, 'props' ) ? _.cloneDeep( selectedObject.props ) : {};
        if( !_.isUndefined( selectedObject ) ) {
            propertyVal = selectedObject.selectionState;
            exprVal = selectedObject.expressionType;
            propertyMap.expressionType = {
                uiValue: exprVal,
                dbValue: exprVal
            };
        } else if( isConstraintNodePropInfo ) {
            // For 'Properties Information' subset, get properties from SOA ViewModelObjectMap
            // In case of new constraint, viewModelObjectMap is not populated: use newConstraintColumnProps
            if( !_.isUndefined( _.get( soaResponseViewModelObjectMap, '[' + key + '].props["' + vmTreeNode.nodeUid + '"][0]' ) ) ) {
                propertyVal = soaResponseViewModelObjectMap[ key ].props[ vmTreeNode.nodeUid ][ 0 ];
            } else if( !_.isUndefined( columnDef ) /* this check is necessary as sometimes DP action is called before column config creation */ &&
                !_.isUndefined( _.get( columnDef, 'newConstraintColumnProps["' + vmTreeNode.nodeUid + '"].propDisplayValue' ) ) ) {
                propertyVal = columnDef.newConstraintColumnProps[ vmTreeNode.nodeUid ].propDisplayValue;
            }
        }

        // Create 'Key' ViewModelProperty for the VMO
        // nodeUid will be referred to as 'parentUid' of the property for that vmo
        // This is used in splmTableFillDownHelper to build fillDown eventData
        propertyMap[ key ] = pca0CommonUtils.getViewModelProperty( key, vmTreeNode.nodeUid, propertyVal, props );

        // Handle special case for split sections in Constraints Grid Editor

        if( !_.isUndefined( selectedObject ) && !_.isUndefined( selectedObject.violationsInfo ) ) {
            _.set( propertyMap[key], 'indicators', [ {
                type: 'violation',
                tooltip: selectedObject.violationsInfo.violationMessage,
                image: violationSeverityIndicatorImgMap[selectedObject.violationsInfo.violationSeverity] + '16.svg'
            } ] );
        }
        if( !_.isUndefined( splitColumnTypesMap ) ) {
            Object.entries( splitColumnTypesMap ).forEach( ( [ , splitColumns ] ) => {
                splitColumns.forEach( splitColumn => {
                    if( splitColumn.uid === key ) {
                        let isSplitSubjectColumn = splitColumn.isSplitSubject;
                        // Handle special case for expressions copied from Split Action
                        // these cells are not editable
                        props.isSplitCellEditDisabled = isSplitSubjectColumn && !isSubjectGrid ||
                            !isSplitSubjectColumn && isSubjectGrid;
                    }
                } );
            } );
        }

        // Scenario: VMO is being re-created while Edit Mode is active
        // This can happen when:
        // 1- Whole tree is reloaded after an SVR was unloaded
        // 2- A node is expanded
        // There might be uncommitted changes for that node.
        // VMO Original value must be set from backup, not from updated selection Map
        // --> This will restore the style for changed values
        // Also, in case of Split Columns just created, the Key is not present in backup map
        if( appCtxService.getCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE ) ) {
            let originalPropertyVal = 0;

            if( !_.isUndefined( backupSelectionMap[ key ] ) &&
                !_.isUndefined( backupSelectionMap[ key ][ searchUid ] ) ) {
                originalPropertyVal = _.get( backupSelectionMap[ key ][ searchUid ], 'selectionState' );
                if( _.isUndefined( originalPropertyVal ) ) {
                    originalPropertyVal = 0;
                }
            }
            if( !isConstraintNodePropInfo ) {
                propertyMap[ key ].originalValue = originalPropertyVal;
                propertyMap[ key ].dirty = propertyMap[ key ].dbValue !== propertyMap[ key ].originalValue;
                propertyMap[ key ].valueUpdated = propertyMap[ key ].dbValue !== propertyMap[ key ].originalValue;
            }
        }
    } );

    return propertyMap;
};

/**
 * Helps to add selection on tree
 * @param {Array} presentSelection - array of alternate ids that we want to set on tree.
 * @param {Object} selectionModel - selectionModel of tree
 */
export const setSelectionOnTree = ( presentSelection, selectionModel ) => {
    if( !_.isEmpty( presentSelection ) ) {
        selectionModel.addToSelection( presentSelection );
    }
};

/**
 * Utility to remove treeNode from tree structure
 * Removes node itself and its references from parent node (children and childrenUids)
 * @param {Array} treeNodes - list of tree nodes
 * @param {Object} treeNode - tree to be removed
 */
export const removeNodeFromTree = ( treeNodes, treeNode )  => {
    _.remove( treeNodes, { nodeUid: treeNode.nodeUid } );
    var parentNode = _.find( treeNodes, function( node ) {
        return node.levelNdx === treeNode.levelNdx - 1 && !_.isUndefined( node.childrenUids ) &&
            node.childrenUids.includes( treeNode.nodeUid );
    } );
    if( parentNode ) {
        _.remove( parentNode.children, { nodeUid: treeNode.nodeUid } );
        //do not remove childrenUids, you will not get the same result back after clear
    }
};


/**
 * Build tree structure matching active filter.
 * Get updated treeLoadResult to display
 * @param {Object} loadedObjects - loaded VMOs
        we need it as filtering action is reloading the whole structure, and we need to access loaded VMOs
 * @param {String} filters - the filter data
 * @param {Object} columns - columns information from the grid
 * @return {Object} TreeLoadResult for nodes matching filter
 */
export const getFilteredTreeLoadResult = function( loadedObjects, filters, columns ) {
    const filtersToApply = pca0CommonUtils.convertToArray( filters );
    filtersToApply.forEach( filter => {
        let clonedObjects = [ ...loadedObjects ];
        for( let idx = 0; idx < clonedObjects.length; idx++ ) {
            const filteredColumn = _.find( columns, { propertyName: filter.columnName } );
            filter.dataType = _.get( filteredColumn, 'dataType', 'String' );

            // If a parent node is filtered, add it to filteredNodes list with all its children
            // If a parent node is not filtered, apply filtering on children
            const treeNode = clonedObjects[ idx ];

            if( treeNode.levelNdx !== 0 ) {
                // Process Level 0 only
                continue;
            }

            if( _isFilterCriteriaSatisfied( treeNode, filter ) ) {
                continue;
            }

            // Recursion will take care of filtering and removing nodes from tree structure pertaining to that given node.
            let tNode = _.find( loadedObjects, { nodeUid: treeNode.nodeUid } );
            if ( tNode ) {
                _recursiveApplyFilter( loadedObjects, tNode, filter );

                // If no result is matching filter, remove node
                if( tNode.children && tNode.children.length === 0 ) {
                    exports.removeNodeFromTree( loadedObjects, tNode );
                }
            }
        }
    } );
    return loadedObjects;
};

export default exports = {
    recursiveCreateTreeNodeWithMap,
    createVariabilityColumnDef,
    getColumnPropsAndSelectionMap,
    createColumnDef,
    loadTreeProviderData,
    loadColumns,
    createViewModelTreeNode,
    recursiveCreateTreeNode,
    getTreeLoadResult,
    generatePropertyMap,
    setSelectionOnTree,
    getDisplayNameForBusinessObject,
    removeNodeFromTree,
    getFilteredTreeLoadResult
};
