// Copyright (c) 2024 Siemens

/**
 * @module js/pca0MultipleSVRsDisplayService
 */
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import dmSvc from 'soa/dataManagementService';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0AddVariabilityService from 'js/pca0AddVariabilityService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/pca0ExpressionGridService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0MultiSVRGridEditorHeaderService from 'js/pca0MultiSVRGridEditorHeaderService';
import pca0MultiSVRSaveCancelEditsService from 'js/pca0MultiSVRSaveCancelEditsService';
import pca0RendererService from 'js/pca0RendererService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import soaSvc from 'soa/kernel/soaService';
import tableSvc from 'js/splmTablePublishedService';
import variabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

const _localeTextBundleOfCommonMessages = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
const _localeTextBundleOfExplorerMessages = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );


/**
 * Local Util Methods
 */

/**
 * Return the assigned cell Renderer for the column
 * @param {Function} cellClickCallback handleCell click callback
 * @param {UwDataProvider} gridDataProvider - DataProvider
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @param {String} contextKey - context key
 * @param {Boolean} isVCVOpenedFromConfigurator flag to indicate if VCV is opened from variants tab
 * @returns {Object} Cell renderer
 */
let _getColumnCellRenderer = ( cellClickCallback, gridDataProvider, vmGridSelectionState, contextKey ) => {
    // Add generic 'icon' cell renderer
    return pca0RendererService.iconCellRenderer(
        cellClickCallback, // cell Click handler
        contextKey, // contextKey
        gridDataProvider, // treeDataProvider
        vmGridSelectionState, // grid Selection State
        true //maria: the constraints is passing though the matrix flavor for the handle callback, parameter irrelevant to us
    );
};

/**
 * Checks for newly added nodes in the variability tree data that are not present in the VMOs
 *
 * @param {Array} vmo - The array of view model objects (VMOs)
 * @param {Object} variability - The variability tree data
 * @returns {Array} - An array of newly added nodes that are present in the variability tree data but not in the VMOs
 */
let _getVariabilityNodesNotRendered = ( vmo, variability ) => {
    const vmoNodeUids = vmo.map( vmo => vmo.nodeUid );
    const variabilityTreeNodeUids = variability.variabilityTreeData.map( node => node.nodeUid );
    const newlyAddedNodeUids = _.difference( variabilityTreeNodeUids, vmoNodeUids );

    return variability.variabilityTreeData.filter( node =>
        newlyAddedNodeUids.includes( node.nodeUid ) && node.nodeUid !== ''
    );
};

/**
 *  Row background renderer
 */
let _rowBackgroundRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );

        if ( rowElem ) {
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

        let textValue = vmo.props[column.name].uiValue;
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
 * Assign/Update grid data as per settings (initialization or after settings apply):
 * - gridNodes (variability nodes)
 * - VMO map
 * - SelectionMap and backUp map
 * @param {Object} gridData data we want to update
 * @returns {Object} treeData
 */
let _updateGridDataAsPerSettings = ( gridData ) => {
    const gridBusinessObjectToSelectionMap = gridData.businessObjectToSelectionMap;
    const gridVariabilityNodes = gridData.variabilityNodes;
    const gridViewModelObjectMap = gridData.viewModelObjectMap;
    let treeData = {};
    exports.updateBusinessObjectToSelectionMap( gridData, gridBusinessObjectToSelectionMap );
    gridData.variabilityNodes = _.cloneDeep( gridVariabilityNodes );
    gridData.viewModelObjectMap = _.cloneDeep( gridViewModelObjectMap );

    treeData = { ...gridData };
    return { treeData };
};

/**
 * Set Cell Renderers for the input column
 * @param {Object} columnDef input Column Definition
 * @param {Object} columnProps collection of properties with cellRenderers to be copied to new column
 * @param {Object} columnCellRenderer column Cell Renderer to be copied to input column Definition
 */
let _setColumnCellRenderer = ( columnDef, columnProps, columnCellRenderer ) => {
    if ( !_.isUndefined( columnProps.cellRenderers ) ) {
        columnDef.cellRenderers = [ ...columnProps.cellRenderers ];
    }
    columnDef.cellRenderers.push( columnCellRenderer );
};

/**
 * Util to check the selection value being in the allowed similar values we transmit in params
 * @param {Array} numbersArray the numbers to check i.e [1,2,5,9,1,9]
 * @param {Array} presetValues the set to check against i.e [1,5,9] like the similar user selections
 * @returns {Boolean} yes if matching
 */
let _numbersMatchPresetValues = ( numbersArray, presetValues ) => {
    return _.every( numbersArray, num => _.includes( presetValues, num ) );
};

/**
 * Util to get the parent alternate Uids based on the provided alternateUid
 * @param {String} alternateID ff alternate uid
 * @returns {Array} all parent alt uids
 */
let _getAllParentVmosAlternateUids = ( alternateID ) => {
    //todo it has to be smarter for ff as the ff features are in the form: ...:iQpRXj4hJ6JDmB:iQpRXj4hJ6JDmB:200
    const pathArr = alternateID.split( ':' );
    const parentNodesUids = [];
    for ( let i = 0; i < pathArr.length; i++ ) {
        // Join the breadcrumb elements up to the current index to form the parent node
        const parentNode = pathArr.slice( 0, i + 1 ).join( ':' );
        parentNodesUids.push( parentNode );
    }
    return parentNodesUids;
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
            node.props.parentTree[0] === parentTree;
    } );
    let filteredViewModelObjectMap = {};
    filteredVariabilityNodes.forEach( variabilityNode => {
        if ( variabilityNode.nodeUid !== '' ) {
            filteredViewModelObjectMap[variabilityNode.nodeUid] = viewModelObjectMap[variabilityNode.nodeUid];
        }
    } );
    return { filteredVariabilityNodes, filteredViewModelObjectMap };
};

/**
 * returns the LoadedObjects even when there is no SVR selection, meaning the only visible SVR on the screen is the Custom Variant
 * @param {Object} soaResponse - response from SOA
 * @param {Object} selection - array of selected SVRs
 * @param {Number} loadVariantsMaxCountInGrid - the max number of columns to load in the grid
 * @param {Boolean} isVCVOpenedFromConfigurator - flag to indicate if VCV is opened from configurator
 * @param {Object} variantRuleLoadedFromBomFsc - variant rule loaded from BOM FSC
 * @returns {Object} loadedObjects collection
 */
let _getLoadedObjectsIncludingNoSVRSelection = ( soaResponse, selection, loadVariantsMaxCountInGrid, isVCVOpenedFromConfigurator, variantRuleLoadedFromBomFsc ) => {
    let loadedObjects = !isVCVOpenedFromConfigurator ? selection : pca0CommonUtils.getSelectedObjectsForSOA( 'VariantRule' );
    loadedObjects = loadedObjects.slice( 0, loadVariantsMaxCountInGrid );

    //When in BOM FSC, we do apply configuration and switch to details tab and switch back to VCV (list view) the loaded svr is applied in the VCV view
    //When we switch to Grid, the selection and we don't have the vmo for the loaded svr, only have the uid of the loaded svr.
    if ( !_.isUndefined( isVCVOpenedFromConfigurator ) && loadedObjects.length === 0 ) {
        loadedObjects = selection = [ { uid: variantRuleLoadedFromBomFsc[0] } ];
    }

    //in case there is no selection to load svr's the response will be the NewVariant,
    //in which case have the fake column on the response for further processing
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    if ( soaResponse.viewModelObjectMap && ( _.isEmpty( selection ) || selection.length === 1 && selection[0].type === 'Cfg0ProductItem' ) ) {
        soaResponse.viewModelObjectMap.NewVariant = {
            displayName: localeTextBundle.NewVariant,
            sourceType: 'VariantRule',
            sourceUid: 'NewVariant'
        };
        soaResponse.selectedExpressions = [
            '{"NewVariant":[]}'
        ];
        loadedObjects = [ viewModelObjectSvc.createViewModelObject( soaResponse.viewModelObjectMap.NewVariant ) ];
        loadedObjects[0].uid = 'NewVariant';
        loadedObjects[0].sourceType = 'VariantRule';
        loadedObjects[0].uiValue = localeTextBundle.NewVariant;
    }
    return loadedObjects;
};

/**
 * Gets the last part of the alternateUid to use it for comparison where needed group:fam:feat
 * @param {String} alternateUid - alternateUid
 * @returns {String} partial uid
 */
let _getFamilyToLeafUid = ( alternateUid ) => {
    let getGroupToLeafUid = alternateUid;
    let arr = getGroupToLeafUid.split( ':' );
    //special nodeUid for the range values and free form are in the form familyUid:textValue, so they contain more than one member, especially the date type
    //in which case to correctly map family to leaf uid we need to take the right 3+ members of the alternate uid instead of regular 2
    if ( arr.length > 1 ) {
        arr.shift(); //this works for non PIP for now, but when we have modules we have to know how many to take out or from the right side for special featires how many to consider
    }
    getGroupToLeafUid = arr.join( ':' );
    return getGroupToLeafUid;
};

/**
 * Populates violations based on the severity level.
 * @param {Object} violations - An object containing an array of violations for each severity level.
 * @param {Object} bo - The vmo object to which the violations should be added.
 * @param {string} severity - The severity level of the violations to be added.
 * @returns {void}
 */
const _populateViolationsPerSeverity = ( violations, bo, severity ) => {
    //check if we are in no configuration module scenario or on root in a configuration module hierarchy, deliberate explicit check for both these use cases
    let violationIndex = 1;
    let violationId = '';
    let violationMessage = '';
    for ( const violation of violations[severity] ) {
        // violation Id will be in the form violation001#violation002
        // if the features have violations of violation001 and violation002.
        // Similarly, violation Id will be in the form violation001#violation002
        // if the multiple features in same group have violations of violation001 and violation002.
        violationId += _.isEmpty( violationId ) ? violation.violationId : `#${violation.violationId}`;
        // Concatenate multiple violation messages on a feature/group into single violation message string.
        violationMessage += _.isEmpty( violationMessage ) ? `${violationIndex++}. ${violation.violationMessage}` : `\n${violationIndex++}. ${violation.violationMessage}`;
    }
    let violation = undefined;
    violation = {
        violationId: violationId,
        violationMessage: violationMessage,
        violationSeverity: severity
    };
    bo.violationsInfo = violation;
};

/**
 * Returns the list of all groups in the response
 * @param {Object} viewModelObjectMap - viewModelObjectMap of the SOA
 * @returns {Object} family to group map
 */
let _getAllGroupsUidsInResponse = ( viewModelObjectMap ) => {
    let familyGroups = [];
    _.forEach( viewModelObjectMap, viewModelObjectNode => {
        // for pca0CommonUtils.isGroupType(), we are passing entire viewModelObjectNode object instead of viewModelObjectNode.type
        // because viewModelObjectNode.type is not always defined or not a valid type.
        // For example, in case of custom features/groups
        if ( viewModelObjectNode && viewModelObjectNode.sourceType &&
            pca0CommonUtils.isGroupType( '', viewModelObjectNode ) ) {
            familyGroups.push( viewModelObjectNode.sourceUid );
        }
    } );
    return familyGroups;
};

/**
 * Create a map of the group to entire module path
 * it's way too cumbersome at the moment
 * @param {Object} soaResponse - response of the SOA
 * @returns {Object} family to group map
 */
export let _createGroupsToModulesMap = ( soaResponse ) => {
    let groups = _getAllGroupsUidsInResponse( soaResponse.viewModelObjectMap );
    return _createNodeToRootMap( soaResponse, groups );
};

/**
 * Create a map from a certain type of objects out of the received vms to root
 * it's way too cumbersome at the moment
 * @param {Object} soaResponse - response of the SOA
 * @param {Object} typedVMOs - typedVMOs i.e groups or families
 * @returns {Object}  map
 */
let _createNodeToRootMap = ( soaResponse, typedVMOs ) => {
    let nodeToRootMap = {};
    // Generate nodePathToRoot maps for each fam
    const nodePathToRoots = {};
    if ( soaResponse.viewModelObjectMap ) {
        for ( const [ key, value ] of Object.entries( soaResponse.viewModelObjectMap ) ) {
            if ( typedVMOs.includes( key ) ) {
                //recursively generate the module path
                nodePathToRoots[key] = _generateNodePathToRootMap( soaResponse.variabilityTreeData, value.sourceUid, value.sourceUid );
            }
        }
    }

    Object.keys( nodePathToRoots ).forEach( function( key ) {
        if ( typedVMOs.includes( key ) ) {
            nodeToRootMap[key] = nodePathToRoots[key][''];
        }
    } );

    return nodeToRootMap;
};

/**
 * Recursive function to generate nodePathToRoot map
 * it's way too cumbersome at the moment
 * @param {Object} nodes - nodes
 * @param {String} id - id
 * @param {String} forNodeId - path is seeked for the node to exclude it from the concatenation
 * @param {Array} nodePathToRoots - used to traverse the hierarchy
 * @returns {Object} map with the concatenated path with ':' up the hierarchy to the root
 */
let _generateNodePathToRootMap = ( nodes, id, forNodeId, nodePathToRoots = [] ) => {
    const node = nodes.find( obj => obj.nodeUid === id );
    if ( !node ) {
        return {};
    }

    if ( node.nodeUid === '' ) {
        return { [id]: nodePathToRoots.reverse().join( ':' ) }; //will return with root key ''
    }
    if ( node.nodeUid !== forNodeId ) {
        nodePathToRoots.push( node.nodeUid );
    }

    const nodePathToRootMap = {};
    for ( const childId of nodes.filter( o => o.childrenUids?.includes( id ) ).map( o => o.nodeUid ) ) {
        const childnodePathToRoot = _generateNodePathToRootMap( nodes, childId, forNodeId, [ ...nodePathToRoots ] );
        Object.assign( nodePathToRootMap, childnodePathToRoot );
    }
    return nodePathToRootMap;
};

/**
 * create multiple entries when the selection can be found in different parts of the tree
 * @param {Object} selection - selection
 * @param {Object} nodeIDToObject -nodeIDToObject to fill with multiple values for the same selection
 * @param {Object} familyToGroupMap - familyToGroupMap
 * @param {Object} groupToFamiliesMap - groupToFamiliesMap
 * @param {Object} groupsToModulesMap - groupsToModulesMap
 * @param {Object} familiesPresentInMultipleGroups - familiesPresentInMultipleGroups
 */
let _createMultipleEntriesForSelection = ( selection, nodeIDToObject, familyToGroupMap, groupToFamiliesMap, groupsToModulesMap, familiesPresentInMultipleGroups ) => {
    //for the multi variant grid consider the case that a selection is only identified by a feature/family so it can appear
    //under multiple groups and module nodes: build the nodeIDToObject appropriately:
    let groupsWithSameFamily;
    if ( familiesPresentInMultipleGroups ) {
        groupsWithSameFamily = familiesPresentInMultipleGroups[selection.family];
    } else {
        groupsWithSameFamily = Object.keys( groupToFamiliesMap ).filter( g => groupToFamiliesMap[g].includes( selection.family ) );
    }
    let uniqueUID;
    //use a single way to determine the free form /unconfigured features nodeUid as it comes in empty
    let nodeUid = pca0CommonUtils.getNodeUidFromSelection( selection );
    selection.nodeUid = nodeUid;
    if ( groupsWithSameFamily && groupsWithSameFamily.length > 0 ) {
        groupsWithSameFamily.forEach( gr => {
            let moduleUid;
            if ( groupsToModulesMap && groupsToModulesMap[gr] ) {
                moduleUid = groupsToModulesMap[gr];
            }
            if ( selection.nodeUid === selection.family ) /* family level selection */ {
                uniqueUID = moduleUid ? moduleUid + ':' + gr + ':' + selection.family : gr + ':' + selection.family;
            } else /*feature level selection */ {
                uniqueUID = moduleUid ? moduleUid + ':' + gr + ':' + selection.family : gr + ':' + selection.family;
                uniqueUID = pca0CommonUtils.prepareUniqueId( uniqueUID, selection.nodeUid );
            }
            nodeIDToObject[uniqueUID] = selection;
        } );
    } else {
        //level 1 depth
        let familyToGroupID = familyToGroupMap[selection.family];
        //the unconfigured family
        if ( _.isEmpty( selection.family ) ) {
            let famId = selection.familyNamespace + ':' + selection.familyId;
            familyToGroupID = familyToGroupMap[famId];
            uniqueUID = familyToGroupID ? familyToGroupID + ':' + famId : famId;
        } else {
            if ( selection.nodeUid === selection.family ) /* family level selection */ {
                uniqueUID = familyToGroupID ? familyToGroupID + ':' + selection.family : selection.family;
            } else /*feature level selection */ {
                uniqueUID = familyToGroupID ? familyToGroupID + ':' + selection.family : selection.family;
                uniqueUID = pca0CommonUtils.prepareUniqueId( uniqueUID, selection.nodeUid );
            }
        }
        nodeIDToObject[uniqueUID] = selection;
    }
};

/**
 * Merges uniquely the two maps based on  passed in criteria
 * it's way too cumbersome at the moment
 * @param {Object} map1 - map
 * @param {Object} map2 - map
 * @param {Object} by - by what to merge
 * @returns {Object}  map
 */
let _uniquelyMergeMaps = ( map1, map2, by ) => {
    const mergedObjectMap = { ...map1, ...map2 };
    // Create a new object map ensuring uniqueness by 'by' (i.e. sourceUid), with the new one winning
    const uniqueObjectMap = {};
    for ( const key in mergedObjectMap ) {
        uniqueObjectMap[mergedObjectMap[key][by]] = mergedObjectMap[key];
    }
    return uniqueObjectMap;
};

/**
 * Update column properties with the new column width
 * @param {Object} columnProperties - Column Properties
 * @param {Object} gridSettings - Atomic Data defined for the gridSettings
 * @param {Object} multipleVariantsGridTreeDataProvider - the data provider for the grid
 * @param {Object} vmGridSelectionState - the grid selection state
 * @param {String} contextKey - context key
 * @returns {Object} updated column properties
 * */
let _addCustomPropertiesToColumns = ( columnProperties, gridSettings, multipleVariantsGridTreeDataProvider, vmGridSelectionState, contextKey ) =>{
    let columnWidth = gridSettings.useCompactColumnWidth ? pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH : gridSettings.columnWidth;
    columnProperties.forEach( columnProps => {
        columnProps.columnWidth = columnWidth;
        columnProps.width = columnWidth;
        columnProps.maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
        columnProps.minWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;
        columnProps.isVertical = gridSettings.useVerticalColumnHeader;
        let cellRenderer = _getColumnCellRenderer( pca0GridAuthoringService.handleCellClick, multipleVariantsGridTreeDataProvider, vmGridSelectionState, contextKey );
        columnProps.cellRenderers = [ _rowBackgroundRenderer, _propertyColumnCellRenderer, pca0RendererService.rowHighlightRenderer, cellRenderer ];

        // Enable Column Menu - disabled for now for multivar grid
        columnProps.enableColumnMenu = true;
    } );

    return columnProperties;
};

/**
 * Marks the cells for update based on the updated selection
 * We find the difference between the current selection and the backup selection and difference between them is marked as dirty cell (UpdateSVR)
 * in case of paste, we addictionally check whether existing cell value is different from the backup value using intersection
 * first we create arrays of keys for both current and backup selection, then we find interection, difference and union.
 * for updateSVR, we mark the difference as dirty cell and for paste we mark the difference as well as intersection as dirty cell
 * @param {Object} gridData - gridData
 * @param {Object} svrUid - svrUid
 * @param {Object} vmos - vmos
 */
let _markCellsForUpdate = ( gridData, svrUid, vmos ) => {
    let arr1 = Object.keys( gridData.businessObjectToSelectionMap[svrUid] );
    let arr2 = Object.keys( gridData.backupOfBusinessObjectToSelectionMap[svrUid] );

    let intersection = _.intersection( arr1, arr2 );
    let union = _.union( arr1, arr2 );
    let diff = _.difference( union, intersection );
    diff.forEach( key => {
        let vmo = vmos.find( vmo => vmo.alternateID === key );
        {
            if ( vmo ) {
                vmo.props[svrUid].valueUpdated = true;
            }
        }
    } );
    intersection.forEach( key => {
        let backupValue = gridData.backupOfBusinessObjectToSelectionMap[svrUid][key];
        let currentValue = gridData.businessObjectToSelectionMap[svrUid][key];
        {
            if ( backupValue.selectionState !== currentValue.selectionState ) {
                let vmo = vmos.find( vmo => vmo.alternateID === key );
                if ( vmo ) {
                    vmo.props[svrUid].valueUpdated = true;
                }
            }
        }
    } );
};

/**
 * Helper for the post-process of SaveNewVariant
 * @param {Object} createdSVR - createdSVR
 * @param {Object} newVariantUid - newVariantUid
 * @param {Object} variabilityProps - variabilityProps
 * @param {Object} gridData - gridData
 */
let _postProcessSaveNewVariant = ( createdSVR, newVariantUid, variabilityProps, gridData ) => {
    let createdSVRUid = createdSVR.uid;
    variabilityProps.soaResponse.selectedExpressions[createdSVRUid] = variabilityProps.soaResponse.selectedExpressions[newVariantUid];
    delete variabilityProps.soaResponse.selectedExpressions[newVariantUid];

    gridData.businessObjectToSelectionMap[createdSVRUid] = gridData.businessObjectToSelectionMap[newVariantUid];
    delete gridData.businessObjectToSelectionMap[newVariantUid];
    gridData.backupOfBusinessObjectToSelectionMap[createdSVRUid] = gridData.backupOfBusinessObjectToSelectionMap[newVariantUid];
    delete gridData.backupOfBusinessObjectToSelectionMap[newVariantUid];
};


/**
 * Helper to determine the new variant type
 * @returns {String} createVariantType - new variant type
 */
let _getNewVariantType = () => {
    let createVariantType = pca0Constants.CFG_OBJECT_TYPES.TYPE_VARIANT_RULE;//'VariantRule'
    let getPreference = appCtxService.getCtx( 'preferences' );
    if ( getPreference.Cfg0CreateVariantRuleType && !_.isEmpty( getPreference.Cfg0CreateVariantRuleType[0] ) ) {
        createVariantType = getPreference.Cfg0CreateVariantRuleType[0];
    }
    return createVariantType;
};


/**
 * Get the Config Perspective based on the context
 * @param {Object} subPanelContext - subpanel context data
 * @param {Object} modulePerspectiveCtx - configurator context object
 * @returns {Object} cfgPerspective
 * */
let _getConfigPerspective = ( subPanelContext, modulePerspectiveCtx ) => {
    if ( !_.isNil( subPanelContext.isVCVOpenedFromConfigurator ) ) {
        return configuratorUtils.getFscConfigPerspective( subPanelContext.variantRuleData );
    }
    if ( modulePerspectiveCtx.modulePerspectiveForMultiVariants ) {
        return modulePerspectiveCtx.modulePerspectiveForMultiVariants;
    }
    return pca0CommonUtils.getConfigPerspective( veConstants.CONFIG_CONTEXT_KEY );
};

/**
 * Filters out columns that are from COTS and split columns and returns the names of
 * the remaining columns.
 * @param {Array} columns - The array of column objects.
 * @param {Boolean} excludeSplitColumns - Flag to exclude split columns.
 * @returns {Array} - Array of column names that are not from COTS (from server).
 */
const _getSvrColumnNames = ( columns, excludeSplitColumns ) => {
    const columnNames = columns.filter( column => !column.isColumnFromCots ).map( column => column.name );
    if ( excludeSplitColumns ) {
        return columnNames.filter( column => !column.includes( 'split' ) );
    }
    return columnNames;
};

/**
 * Populates violations on the data provider.
 * @param {Array} currentColumnIDs - The array of current column IDs.
 * @param {Object} businessObjectToSelectionMap - The business object to selection map.
 * @param {Array} vmos - The array of view model objects.
 * @param {Object} violationSeverityIndicatorImgMap - The map of violation severity indicators.
 */
const _populateViolationsOnDataProvider = ( currentColumnIDs, businessObjectToSelectionMap, vmos, violationSeverityIndicatorImgMap ) => {
    currentColumnIDs.forEach( columnId => {
        for ( const [ key, value ] of Object.entries( businessObjectToSelectionMap[columnId] ) ) {
            //for unconfigured values we need to find the right vmo, it won't find the alternate vm in the form: "xxx:yyy:yyy:Sony" so try to see if such a key exists
            let keyToConsider = exports.getExistingNodeKeyForUnconfiguredValue( key, value, businessObjectToSelectionMap );
            let vmo = vmos.find( vmo => vmo.alternateID === keyToConsider );
            if ( vmo ) {
                vmo.props[columnId].dbValue = value.selectionState;
                exports.reflectViolationOnDataProviderForVmo( vmo, value.violationsInfo, columnId, violationSeverityIndicatorImgMap );
            }
        }
    } );
};

/**
 * Builds a map of families and their selected child nodes.
 *
 * @param {Object} selectionMap - The map of selections.
 * @returns {Array} The family expansion map.
 */
const _buildFamilyExpansionMap = ( selectionMap ) => {
    let familyExpansionMap = [];

    Object.values( selectionMap ).forEach( ( svrSelections ) => {
        Object.values( svrSelections ).forEach( ( selection ) => {
            let nodeUID = selection.nodeUid ||
                ( selection.props?.isFreeFormFamily?.[0] ? `${selection.family}:${selection.valueText}` : null );

            if ( nodeUID ) {
                let familyNode = familyExpansionMap.find( node => node.id === selection.family );

                if ( !familyNode ) {
                    familyExpansionMap.push( { id: selection.family, childNodes: [ { id: nodeUID } ] } );
                } else {
                    familyNode.childNodes.push( { id: nodeUID } );
                }
            }
        } );
    } );

    return familyExpansionMap;
};

/**
 * Checks if a family has selected expressions.
 *
 * @param {Object} selectionMap - The map of selections.
 * @param {String} familyUID - The UID of the family.
 * @param {Array} familyExpansionMap - The family expansion map.
 * @returns {boolean} True if the family has selected expressions, false otherwise.
 */
const _isFamilyInSelections = ( selectionMap, familyUID, familyExpansionMap ) => {
    return _.some( selectionMap, ( svrSelections ) =>
        _.some( svrSelections, ( selection ) =>
            selection.family === familyUID && _.find( familyExpansionMap, { id: selection.family } )
        )
    );
};

/**
 * Builds the expansion map for all families and their children.
 *
 * @param {Object} gridData - The grid data.
 * @param {Array} familyExpansionMap - The family expansion map.
 * @returns {Array} The expansion map for all families.
 */
const _buildExpansionMapForAllFamilies = ( gridData, familyExpansionMap ) => {
    let rootElement = gridData.variabilityNodes.find( treeNode => treeNode.nodeUid === '' );
    assert( rootElement, 'RootElement is missing in the response' );

    return rootElement.childrenUids.map( groupUID => {
        let groupNode = { id: groupUID, childNodes: [] };
        let groupTreeData = _.find( gridData.variabilityNodes, { nodeUid: groupUID } );

        groupNode.childNodes = groupTreeData.childrenUids.map( familyUID => {
            let familyTreeData = _.find( gridData.variabilityNodes, { nodeUid: familyUID } );

            return {
                id: familyUID,
                childNodes: _isFamilyInSelections( gridData.businessObjectToSelectionMap, familyUID, familyExpansionMap )
                    ? familyTreeData.childrenUids.map( id => ( { id } ) )
                    : undefined
            };
        } );

        return groupNode;
    } );
};

/**
 *   Export APIs section starts
 */
let exports = {};


/**
 * Create a family to group map and group to family map
 * @param {Object} soaResponse - response of the SOA
 * @returns {Object} family to group map and Group to Family Map
 */
export let createFamilyAndGroupMaps = ( soaResponse ) => {
    let groups = new Set( _getAllGroupsUidsInResponse( soaResponse.viewModelObjectMap ) );
    let familyToGroupMap = {};
    let groupToFamilyMap = {};
    let familyToGroups = {};
    let familiesPresentInMultipleGroups = new Map();

    soaResponse.variabilityTreeData.forEach( variabilityNode => {
        if ( groups.has( variabilityNode.nodeUid ) ) {
            let children = [];
            groupToFamilyMap[variabilityNode.nodeUid] = children;
            variabilityNode.childrenUids.forEach( family => {
                familyToGroupMap[family] = variabilityNode.nodeUid;
                children.push( family );

                // Track which groups each family appears in
                if ( !familyToGroups[family] ) {
                    familyToGroups[family] = new Set();
                }
                familyToGroups[family].add( variabilityNode.nodeUid );

                // If a family appears in more than one group, add it to the map
                if ( familyToGroups[family].size > 1 ) {
                    familiesPresentInMultipleGroups[family] = Array.from( familyToGroups[family] );
                }
            } );
        }
    } );

    return { familyToGroupMap, groupToFamilyMap, familiesPresentInMultipleGroups };
};

/**
 * Action "Paste" selections on column for grid
 * Paste copied selections on given column
 * Call utility to update data provider and dispatch changes on atomic Data
 * @param {Object} vmVariabilityProps ViewModel Atomic data <variabilityProps>
 * @param {UwDataProvider} treeDataProvider data provider
 * @param {Object} vmGridData ViewModel Atomic data grid
 * @param {Object} eventData event data info container
 * @param {Object} copiedFromColUid copied column uid value
 *
 */
export let pasteSelectionsOnColumn = ( vmVariabilityProps, treeDataProvider, vmGridData, eventData, copiedFromColUid ) => {
    // VariabilityProps/GridSettings/GridData come as:
    // - props (value/update) from multipleVariantGrid
    // - atomicData (get/set AtomicData) from Grid
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    let gridData = vmGridData.getValue ? { ...vmGridData.getValue() } : { ...vmGridData.getAtomicData() };
    let selections = pca0GridCommonUtils.copySelections( gridData.businessObjectToSelectionMap[copiedFromColUid] ); //clone deep replacement, trying to avoid clone deep for performance reasons
    let columnUid = eventData.column.field;
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

    pca0CommonUtils.handleEditModeSync( veConstants.CONFIG_CONTEXT_KEY, false );

    // Apply selections on the column
    gridData.businessObjectToSelectionMap[columnUid] = selections;

    // Mark cells for update
    _markCellsForUpdate( gridData, columnUid, vmos );
    // Update VMOs
    exports.updateVMOsWithSelections( treeDataProvider, selections, columnUid, gridData );
    // Dispatch changes on grid data
    vmGridData.update ? vmGridData.update( gridData ) : vmGridData.setAtomicData( gridData );

    exports.clearViolations( columnUid, vmGridData, treeDataProvider );
    // Process Dirty Elements
    variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
        // For multiple variants in grid selection changes, keep on collecting updated variants.
        variabilityProps.dirtyElements, // currentDirtyElements
        gridData.businessObjectToSelectionMap, // selection map
        gridData.backupOfBusinessObjectToSelectionMap // backup selection map
    );

    //dirty header cell
    pca0RendererService.colorifyHeaderCell( eventData.column.displayName,
        pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
        veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID );

    // Dispatch changes on Variability Props
    vmVariabilityProps.update ? vmVariabilityProps.update( variabilityProps ) : vmVariabilityProps.setAtomicData( variabilityProps );

    // Set IS_VARIANT_TREE_IN_EDIT_MODE
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );
};

/**
 * Action "updateVMOsWithSelections" on column for grid
 * @param {UwDataProvider} treeDataProvider data provider for
 * @param {Object} selections copied selections from column
 * @param {Object} columnUid column uid value
 * @param {Object} gridData ViewModel Atomic data grid
 *
 */
export let updateVMOsWithSelections = ( treeDataProvider, selections, columnUid, gridData ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let updatedVMOs = [ ...vmos ];
    updatedVMOs.forEach( vmo => {
        let selectionState = 0;
        let originalValue = 0;
        let props = {};
        // Update Summary on all Family nodes
        if ( !vmo.isLeaf && !vmo.isExpanded || vmo.isFamily && vmo.isLeaf && !gridData.expandAll ) {
            pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                gridData.businessObjectToSelectionMap, // selectionMap
                vmo, // tree node being collapsed/expanded
                gridData.viewModelObjectMap, // VMO map
                treeDataProvider.columnConfig.columns, // column Infos
                false,
                veConstants.GRID_CONSTANTS.MULTI_SVR_GRID, //gridMode - This will be removed once we have gridOptions prop for a generic grid component
                updatedVMOs,
                gridData.variabilityNodes
            );
        }
        //for unconfigured values we need to find the right vmo, depending if it is or not partially unconfigured
        //so it won't find the alternate vm in the form: "xxx:yyy:yyy:Sony" so try
        //if the selections does not have the altUId try for partiallyUnconfigured the alternate one
        //partially unconfigured refers to nodes that have an configuredIn svr and a configuredOut svr and the need in the UI to represent those in a single node - on the configuredIn svr
        let calcUnconfiguredAltUId = vmo.alternateID;
        if ( vmo.isPartiallyUnconfigured && !Object.keys( selections ).includes( calcUnconfiguredAltUId ) ) {
            calcUnconfiguredAltUId = pca0GridCommonUtils.getAlternativeUidConsideringPartiallyUnconfigured( vmo );
        }
        if ( Object.keys( selections ).includes( calcUnconfiguredAltUId ) ) {
            // If the key exists, retrieve the `selectionState` associated with this `alternateID`
            selectionState = selections[calcUnconfiguredAltUId].selectionState;
            props = { ...selections[calcUnconfiguredAltUId].props };
            originalValue = selections[calcUnconfiguredAltUId].originalValue;
            //if the vm is unconfigured, copy the unconfigured props from the original vmo otherwise don't as on the new column it might not be unconfigured
            //we just won't know in this case
            if ( !vmo.isUnconfigured ) {
                delete props.isUnconfigured;
                if ( calcUnconfiguredAltUId !== vmo.alternateID ) {
                    //if this is the case we will also need to delete the copied selection from the unconfigured node uid that does not exist on this svr
                    //and add it into the one that does, otherwise upon changes on that node we migh get a mix of positive and negative values when saving
                    exports.replacePastedSelectionFromUnconfiguredNode( gridData.businessObjectToSelectionMap, calcUnconfiguredAltUId, vmo, columnUid );
                }
            }
        }
        if ( !vmo.props[columnUid].valueUpdated && selectionState !== vmo.props[columnUid].dbValue ) {
            vmo.props[columnUid].valueUpdated = true; //do not set valueUpdated for same former selections or if no selections like groups or fams
        }
        vmo.props[columnUid].dbValue = selectionState;
        //we also need to set the props like familyLevelSelection, isUnconfigured etc, so the rendering code can pick them up
        vmo.props[columnUid].props = props;
        vmo.props[columnUid].value = selectionState;
        vmo.props[columnUid].originalValue = originalValue;


        //make sure we update the ui value as well if we are on a family node that is a leaf
        //otherwise we'll have situations after manually toggling a node in which the ui value is cleared but not set.
        //The rendering code will look at the ui value to decide summary for it or not
        if ( vmo.isFamily && vmo.isLeaf && vmo.props[columnUid].uiValue === '' ) {
            vmo.props[columnUid].uiValue = selectionState;
        }
    } );
    treeDataProvider.update( updatedVMOs );
};

/**
 * Filter objectUIDs (families/features) from grid.viewModelObjectMap to query for additional tree properties
 * @param {Object} gridViewModelObjectMap ViewModelObjectMap for the given grid
 * @returns {Array} list of Object UIDs
 */
export let getObjectUidsToLoadTreeProps = ( gridViewModelObjectMap ) => {
    // Remove elements where sourceType is not defined
    let objectUids = [];
    Object.entries( gridViewModelObjectMap ).forEach( ( [ objectID, vmo ] ) => {
        if ( !_.isUndefined( _.get( vmo, 'sourceType' ) ) && vmo.sourceType !== '' ) {
            objectUids.push( objectID );
        }
    } );
    return objectUids;
};

/**
 * Initialize Grid data - reset all data
 * @param {Object} multipleVariantsGridDataProp - View Model Atomic Data <multipleVariantsGrid>
 * @param {Object} singleSVRViewMode - View Model Atomic Data <singleSVRViewMode>
 * @param {Boolean} isVCVOpenedFromConfigurator - Flag to indicate if VCV is opened from configurator
 */
export let initGridData = ( multipleVariantsGridDataProp, singleSVRViewMode, isVCVOpenedFromConfigurator ) => {
    let multipleVariantsGridData = { ...multipleVariantsGridDataProp.getAtomicData() };
    multipleVariantsGridData.gridNodes = [];
    multipleVariantsGridData.businessObjectToSelectionMap = {};
    multipleVariantsGridData.backupOfBusinessObjectToSelectionMap = {};
    multipleVariantsGridData.viewModelObjectMap = {};
    multipleVariantsGridData.variabilityNodes = [];
    multipleVariantsGridData.expandAll = false;
    multipleVariantsGridDataProp.setAtomicData( multipleVariantsGridData );
    if ( _.isUndefined( isVCVOpenedFromConfigurator ) ) {
        let singleSVRViewModeValue = { ...singleSVRViewMode.getValue() };
        singleSVRViewModeValue.isListView = false;
        singleSVRViewMode.update( singleSVRViewModeValue );
    }
};

/**
 * Get RequestInfo for Validation according to requested type of Validation (Initial vs Column)
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} action - The action performed (e.g. 'Initial Validate')
 * @param {Object} gridSelectionMap - selectionMap for grid
 * @returns {Object} RequestInfo with RequestType string for Product Configuration Validation
 */
export let getRequestInfoForValidation = ( validationProps, action, gridSelectionMap ) => {
    let requestInfo = {
        ignoreSelectedExpressions: [ 'true' ]
    };
    if ( action === pca0CommonConstants.EXPRESSION_VALIDATE.INITIAL_VALIDATE ) {
        delete validationProps.columnValidation;
        delete validationProps.columnToValidationMap;
        const loadedRulesUid = Object.keys( gridSelectionMap );

        // Filter selected Objects having selections authored
        const filteredRules = _.filter( loadedRulesUid, loadedRuleUid => {
            return pca0CommonUtils.isColumnWithEdits( loadedRuleUid, gridSelectionMap );
        } );

        _.set( requestInfo, 'requestType', [ pca0Constants.REQ_TYPE_INITIAL_VALIDATION ] );
        _.set( requestInfo, 'configurableObject', filteredRules );
    } else if ( action === pca0CommonConstants.EXPRESSION_VALIDATE.VERBOSE_VALIDATE ) {
        _.set( requestInfo, 'configurableObject', [ validationProps.columnValidation.uid ] );
    }
    return requestInfo;
};

/**
 * Util to build SOA input to fetch expression
 * @param {Object} subPanelCtx - subPanelCtx
 * @param {Object} displayMode -  Grid Editor active Display Mode
 * @param {Object} currentColumns -  the loaded columns
 * @param {Object} variabilityProps -  the loaded variabilityProps
 * @param {Number} loadVariantsMaxCountInGrid -  the max number of columns to load in the grid
 * @param {Array} failedToLoadSVRs - the failed to load SVRs in previous SOA call
 * @returns {Object} with soaInput and failedToLoadSVRs
 */
export let prepareSOAInputToGetMultipleVariants = ( subPanelCtx, displayMode, currentColumns, variabilityProps, loadVariantsMaxCountInGrid, failedToLoadSVRs ) => {
    const source = appCtxService.getCtx( 'state.processed.uid' );
    const configContext = { uid: source, type: 'unknownType' };
    const modulePerspectiveCtx = appCtxService.getCtx( 'ConfiguratorCtx' );
    let filters = pca0CommonUtils.getGridOptionFilters( displayMode );
    let variability = { ...variabilityProps.getAtomicData() };
    // The selection will be limited by loadVariantsMaxCountInGrid to determine the number of columns loaded in the grid
    let selection = subPanelCtx.selection.slice( 0, loadVariantsMaxCountInGrid );

    if ( !_.isNil( subPanelCtx.isVCVOpenedFromConfigurator ) && selection.length === 0 ) {
        selection = [ { uid: subPanelCtx.variantRuleData.variantRuleData[0] } ];
    }

    let requestInfo = {
        useDefaultPerspectiveToLoadVariability: [ 'False' ]
    };
    //if there is no selection the returned obj is the entire Cfg0ProductItem
    if ( selection && selection.length === 1 && selection[0].type === 'Cfg0ProductItem' ) {
        return exports.prepareSOAInputForNewVariant( displayMode );
    }
    //we need to append to existing selections if new selections appended or determine if any removed in which case we need to treat the request input as
    //a new table load ( the variabilityTreeData = [] and the entire selection array gets transmitted) vs the append case in which
    //only the new selections are transmitted and the old variabilityTreeData is transmitted as well
    let foundOverlaps = false;
    let isAnyColumnRemoved = false;
    let isAddedSelection = false;
    let selectionSameAsLoadedObjects = false;
    if ( currentColumns && currentColumns.length > 0 ) {
        const currentColumnUids = _getSvrColumnNames( currentColumns, true );
        const selectionUids = selection.map( sel => sel.uid );
        //we need to determine if the selection is the same as the loaded objects, if any column was removed or if any column was added
        //based on all Svrs that user tries to load in grid(i.e selection sent to server in previous Soa)
        let totalSvrUids = _.union( currentColumnUids, failedToLoadSVRs );
        let newVariants = variability.newVariants;
        totalSvrUids = totalSvrUids.filter( uid => !newVariants.includes( uid ) ); //take care to substract the new variants
        const totalSvrs = totalSvrUids.map( uid => ( { uid: uid } ) );
        selectionSameAsLoadedObjects = _.isEqual( _.sortBy( selectionUids ), _.sortBy( totalSvrUids ) );
        isAnyColumnRemoved = totalSvrUids.some( uid => !selectionUids.includes( uid ) );
        foundOverlaps = selection.some( sel => totalSvrUids.includes( sel.uid ) );
        isAddedSelection = !selectionSameAsLoadedObjects && foundOverlaps && !isAnyColumnRemoved;
        if ( isAddedSelection ) {
            //remove from selection the columns that are not in the currentColumns
            selection = _.filter( selection, ( selectedObj ) => {
                return !_.find( totalSvrs, { uid: selectedObj.uid } );
            } );
        }
    }

    let shouldSendVariabilityTreeData = false;
    if ( isAddedSelection ) {
        //appendSVRs use case for both current and all_features
        //set a flag so we reuse the former soaResponse and merge into it
        variability.soaResponse.mergeServerResponse = true; //set a flag so we reuse the former soaResponse and merge into it
        variabilityProps.setAtomicData( variability );
        shouldSendVariabilityTreeData = true;
    } else if ( ( displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FEATURES || displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FAMILIES )
        && selectionSameAsLoadedObjects ) {
        //move from current to all use case
        //in this case the call to the server needs to include the variabilityTreeData as well but no merging afterwards
        shouldSendVariabilityTreeData = true;
        selection = [];
    } else if ( ( displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FEATURES || displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FAMILIES )
        && isAnyColumnRemoved && foundOverlaps ) {
        //remove SVRs in all_features use case (in the case of current we are like in the initial current state for removal use case)
        //in this case the server will send back only currentViewModelObjects. If we don't keep the old allFeatures viewModelTreeNodes we'll encounter issues
        //collapsing nodes in the grid or after expand configuration as the only viewModelObjectmap objects will be the current state ones ( those with selections )
        variability.soaResponse.mergeViewModelObjectMapServerResponse = true; //set a flag so we reuse the former soaResponse and merge into it
        shouldSendVariabilityTreeData = true;
    } else {
        //reset the formerNewVariantUids - used to determine on which side of the grid the added columns are added
        variability.formerNewVariantUids = [];
        variabilityProps.setAtomicData( variability );
    }
    let cfgPerspective = _getConfigPerspective( subPanelCtx, modulePerspectiveCtx );

    let cfgPerspectiveToTransmit = {
        uid: cfgPerspective.uid,
        type: cfgPerspective.type
    };
    //in the all_features use case in which we completely replace the columns with others, we'll proceed like in the initial current case:
    //no variabilityTreeData and all selections will be transmitted
    //maria: not sure when to send it, seems to cause issues, we'll keep it commented out for now and reinstate it after the server changes
    // if( _.get( variability, 'soaResponse.responseInfo' ) ) {
    //     ret.responseInfo = variability.soaResponse.responseInfo;
    // }

    const inputData = {
        configContextProvider: '',
        configContext: !_.isUndefined( subPanelCtx.isVCVOpenedFromConfigurator ) ? '' : configContext,
        configPerspective: cfgPerspectiveToTransmit,
        selectedObjects: selection,
        currentExpandedFamilies: '',
        filters: {
            intentFilters: [],
            optionFilter: filters
        },
        variabilityTreeData: shouldSendVariabilityTreeData ? variability.soaResponse.variabilityTreeData : [],
        requestInfo: requestInfo
    };
    return {
        multipleVariantsSoaInput: inputData,
        failedToLoadSVRs: isAnyColumnRemoved ? [] : failedToLoadSVRs
    };
};


/**
 * Util to build SOA input for new variant
 * @param {Object} displayMode -  Grid Editor active Display Mode
 * @returns {Object} soaInput
 */
export let prepareSOAInputForNewVariant = ( displayMode ) => {
    const source = appCtxService.getCtx( 'state.processed.uid' );
    const configContext = { uid: source, type: 'unknownType' };
    const modulePerspectiveCtx = appCtxService.getCtx( 'ConfiguratorCtx' );
    let filters = pca0CommonUtils.getGridOptionFilters( displayMode );
    let requestInfo = {
        showCustomVariantGrid: [ 'True' ]
    };
    return {
        configContextProvider: '',
        configContext: configContext,
        // configurator context has config perspective: use it for grid
        configPerspective: modulePerspectiveCtx.modulePerspective ? modulePerspectiveCtx.modulePerspective : pca0CommonUtils.getConfigPerspective( veConstants.CONFIG_CONTEXT_KEY ),
        selectedObjects: [],
        currentExpandedFamilies: '',
        filters: {
            intentFilters: [],
            optionFilter: filters
        },
        requestInfo: requestInfo
    };
};

/**
 * Helper to merge the data in the response for various scenarios that need special adjustments - append, move to AllFeaturesFromCurrent, deselection of Variant
 * @param {Object} soaResponse - response from SOA
 * @param {Object} gridData - gridData
 * @param {Object} variability - variability
 * @param {Array} multiLevelVariants - multiLevelVariants
 * @return {Object} selectedExpressions, changedResponse
 */
export let mergeDataInResponseForVariousScenarios = ( soaResponse, gridData, variability, multiLevelVariants )  => {
    let selectedExpressions;
    let mergedResponse = {};
    //if the response is partial like in the case of appending new SVR's to existing ones, we need to merge the new response with the old one
    if ( _.get( variability, 'soaResponse.mergeServerResponse' ) ) {
        //merge the soaResponse with the new one both nodes appear, you have to remove the original unconfigured vmo
        mergedResponse.viewModelObjectMap = { ...variability.soaResponse.viewModelObjectMap, ...soaResponse.viewModelObjectMap };
        //apparently the variability tree data comes back form the server based on the passed in one
        mergedResponse.variabilityTreeData = soaResponse.variabilityTreeData;
        //moving from current to all does not bring back any selected expressions
        if ( soaResponse.selectedExpressions ) {
            let newSelectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
            let oldSelectedExpressions = variability.soaResponse.selectedExpressions; //they are already in object form
            selectedExpressions = { ...oldSelectedExpressions, ...newSelectedExpressions };
        } else {
            selectedExpressions = variability.soaResponse.selectedExpressions;
        }
        soaResponse.viewModelObjectMap = mergedResponse.viewModelObjectMap;
        soaResponse.variabilityTreeData = mergedResponse.variabilityTreeData;
        //clean up the flag, it only lives between the prepare soa input and process it
        delete variability.soaResponse.mergeServerResponse;
    } else if ( _.get( variability, 'soaResponse.mergeViewModelObjectMapServerResponse' ) ) {
        //merge the soaResponse with the new one both nodes appear, you have to remove the original unconfigured vmo
        mergedResponse.viewModelObjectMap = { ...variability.soaResponse.viewModelObjectMap, ...soaResponse.viewModelObjectMap };
        //apparently the variability tree data comes back form the server based on the passed in one
        mergedResponse.variabilityTreeData = soaResponse.variabilityTreeData;
        selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
        soaResponse.viewModelObjectMap = mergedResponse.viewModelObjectMap;
        soaResponse.variabilityTreeData = mergedResponse.variabilityTreeData;
        delete variability.soaResponse.mergeViewModelObjectMapServerResponse;
    } else if ( _.isEmpty( soaResponse.selectedExpressions ) && multiLevelVariants.length === 0 ) {
        //this is the move from current to all case
        //added extra condition as we don't receive selectedExpressions for multiLevelVariants
        //for now the server does nto send correctly responses for the free form or range values, so we'll merge everything until the server is fixed
        if ( variability.soaResponse ) {
            //need first to copy the selected expressions from the bo's in case they are changed
            let colUids = variability.columnProperties.map( col => col.propertyName );
            let changedExpressions = pca0MultiSVRSaveCancelEditsService.getCurrentSelectedExpressionsFromGrid( gridData, variability, colUids, true );
            selectedExpressions = changedExpressions;// variability.soaResponse.selectedExpressions;
        }

        // Merge the two object maps
        let uniqueObjectMap = soaResponse.viewModelObjectMap;
        if ( _.get( variability, 'soaResponse.viewModelObjectMap' ) ) {
            uniqueObjectMap = _uniquelyMergeMaps( soaResponse.viewModelObjectMap, variability.soaResponse.viewModelObjectMap, 'sourceUid' );
        }
        // Create a new object map ensuring uniqueness by sourceUid, with the new one winning
        // Assign the unique object map back to soaResponse.viewModelObjectMap
        soaResponse.viewModelObjectMap = uniqueObjectMap;
        //because we attach selected expressions to the retrieved response we need an additional prop to signal the move in ciew model
        soaResponse.isMoveFromCurrentToAll = true;
    } else {
        selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
    }

    return selectedExpressions;
};


/**
 * Post-process SOA response:
 *  - initialize atomic Data for grid
 *  - Build variabilityData subsets
 *  - parse and refactor selectedExpressions (overwriting soaResponse itself)
 *  - build column Configuration Array
 *  - build selection maps
 * @param {Object} soaResponse response from SOA
 * @param {Object} gridSettings  Atomic Data defined for the gridSettings
 * @param {Object} variabilityProps  Atomic Data defined for the variabilityProps
 * @param {Object} multipleVariantsGrid  Atomic Data defined for the multipleVariantsGrid
 * @param {Object} selection selection
 * @param {Object} displayMode -active display mode
 * @param {Array} previousFailedToLoadSVRs - the failed to load SVRs in previous SOA call
 * @param {Object} multipleVariantsGridTreeDataProvider - the data provider for the grid
 * @param {Object} vmGridSelectionState - the grid selection state
 * @param {String} lastServerLoadAct - the last server load action
 * @param {Boolean} isVCVOpenedFromConfigurator - flag to indicate if VCV is opened from configurator
 * @param {Boolean} variantRuleLoadedFromBomFsc - uid of loaded variant rule
 * @return {Object} variability
 */
export let postProcessLoadMultiSVRData = function( soaResponse, gridSettings, variabilityProps, multipleVariantsGrid, selection, displayMode,
    previousFailedToLoadSVRs, multipleVariantsGridTreeDataProvider, vmGridSelectionState, lastServerLoadAct, isVCVOpenedFromConfigurator, variantRuleLoadedFromBomFsc ) {
    //currently multilevel svrs can't be loaded in the grid, we don't receive the selectedExpressions for them from soaResponse
    //we need to store the uids of the svrs that can not loaded in the grid to process them later for
    //preparing the soa input for the next load
    //we need to merge with the previous failed svrs if any to keep track of all failed svrs for evaluating
    //the next soa input
    let failedToLoadSVRs = previousFailedToLoadSVRs ? [ ...previousFailedToLoadSVRs ] : [];
    const multiLevelVariants = _.get( soaResponse, 'responseInfo.multiLevelVariants', [] );

    if ( multiLevelVariants.length > 0 ) {
        failedToLoadSVRs.push( ...multiLevelVariants );
    }
    let loadVariantsMaxCountInGrid = gridSettings.loadVariantsMaxCountInGrid;

    let loadedObjects = _getLoadedObjectsIncludingNoSVRSelection( soaResponse, selection, loadVariantsMaxCountInGrid, isVCVOpenedFromConfigurator, variantRuleLoadedFromBomFsc );

    let variability = { ...variabilityProps.getAtomicData() };
    let gridData = { ...multipleVariantsGrid.getAtomicData() };

    // delete expansionMap if we are not in the families display mode
    const activeDisplayMode = _.get( displayMode, 'activeDisplayMode' );
    if ( activeDisplayMode !== pca0Constants.GRID_DISPLAY_MODE.FAMILIES && gridData.expansionMap ) {
        delete gridData.expansionMap;
    }

    //merge the data in the response for various scenarios that need special adjustments - append, move to AllFeaturesFromCurrent, deselection of variant
    //it will set the correct merged data on the soaResponse depending on the scenario
    let selectedExpressions = exports.mergeDataInResponseForVariousScenarios( soaResponse, gridData, variability, multiLevelVariants );

    if ( lastServerLoadAct === 'features' && displayMode.activeDisplayMode === 'current' ) {
        soaResponse.isMoveFromAllToCurrent = true;
    }

    // Clean Cache of Copied Selections
    let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if ( configuratorCtx ) {
        delete configuratorCtx.copiedSelectionsCache;
        // Update Context
        appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
        // Reset Edit Mode status if not moving from current to all
        if ( !soaResponse.isMoveFromCurrentToAll ) {
            appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
        }
    }
    //add new Variant to soaResponse before generating the ColumnPropsAndSelectionMapSVR
    if ( variability.newVariants && variability.newVariants.length > 0 ) {
        variability.newVariants.forEach( newVariant => {
            soaResponse.viewModelObjectMap[newVariant] = variability.soaResponse.viewModelObjectMap[newVariant];
            selectedExpressions = { ...selectedExpressions, ...variability.soaResponse.selectedExpressions[newVariant] };
        } );
    }
    // Convert Selected Expressions
    let clonedExpressions = { ...selectedExpressions };
    soaResponse.variabilityPropertiesToDisplay = [];
    soaResponse.selectedExpressions = {};
    loadedObjects.forEach( ( loadedObject ) => {
        if ( clonedExpressions[loadedObject.uid] ) {
            // Add to selectedExpressions only if the expression is available in soa response
            // as this will be used to create columns in the grid
            soaResponse.selectedExpressions[loadedObject.uid] = clonedExpressions[loadedObject.uid];
        }
    } );

    const nonGridableExpressionsList = [];
    if ( !_.isEmpty( nonGridableExpressionsList ) ) {
        pca0CommonUtils.showNotificationMessageForNonGridableExpressionsIfApplicable( nonGridableExpressionsList, soaResponse.viewModelObjectMap );
    }
    // Populate businessObjectToSelectionMap and get Column Properties
    let columnPropsAndSelectionMapResult = exports.getColumnPropsAndSelectionMapSVR(
        'multipleVariantsConfigGrid',
        soaResponse
    );
    let columnProperties = columnPropsAndSelectionMapResult.columnProperties;
    //add evtl former new Variant column properties to the new ones
    const newVariantsColumnProps = variability.columnProperties.filter( column => variability.newVariants.includes( column.propertyName ) );
    columnProperties = _.unionBy( newVariantsColumnProps, columnProperties, 'propertyName' );

    //add the former keys to the new ones
    let businessObjectToSelectionMap = columnPropsAndSelectionMapResult.businessObjectToSelectionMap;
    columnProperties.forEach( columnProp => {
        if ( !businessObjectToSelectionMap[columnProp.propertyName] ) {
            businessObjectToSelectionMap[columnProp.propertyName] = {};
        }
    } );
    //the new variants dirty elements are not in the generated businessObjectToSelectionMap, so we need to add them from former businessObjectToSelectionMap
    variability.newVariants.forEach( newVariant => {
        businessObjectToSelectionMap[newVariant] = gridData.businessObjectToSelectionMap[newVariant];
    } );

    //add the props for the new loaded nodes for the new variants
    if ( variability.newVariants && variability.newVariants.length > 0 ) {
        let vmos = multipleVariantsGridTreeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        vmos.forEach( vmo => {
            variability.newVariants.forEach( newVariant => {
                // Add value 0 by default for all props[newVariant] if prop not exisiting yet ( was not in current mode before)
                if ( !vmo.props[newVariant] ) {
                    vmo.props[newVariant] = pca0CommonUtils.getViewModelProperty( newVariant, vmo.nodeUid, 0, {} );
                }
            } );
        } );
        multipleVariantsGridTreeDataProvider.update( vmos );
    }
    const variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    const viewModelObjectMap = soaResponse.viewModelObjectMap;

    let propInfoVariabilityNodes = variabilityNodes; //propInfoResults.filteredVariabilityNodes;
    let propInfoViewModelObjectMap = viewModelObjectMap; //propInfoResults.filteredViewModelObjectMap;

    gridData.propInfoVariabilityNodes = propInfoVariabilityNodes;
    gridData.propInfoViewModelObjectMap = propInfoViewModelObjectMap;
    //in order to be able to recursively construct the tree nodes for the new response you need to update the BusinessObjectToSelectionMap
    //for a move from all to current we need to keep the backup map changes and merge them with new ones, but the former existing ones that might be changed need to be kept
    if ( soaResponse.isMoveFromCurrentToAll ) {
        exports.updateBusinessObjectToSelectionMap( gridData, businessObjectToSelectionMap, true ); //this will keep the original backup map and merge only new selections into it if any
    } else {
        exports.updateBusinessObjectToSelectionMap( gridData, businessObjectToSelectionMap );
    }
    let treeData = { ...gridData };
    let multiVariantsResults = _extractSubSetMaps( '', variabilityNodes, viewModelObjectMap );
    let multiVariantsVariabilityNodes = multiVariantsResults.filteredVariabilityNodes;
    let multiVariantsViewModelObjectMap = multiVariantsResults.filteredViewModelObjectMap;

    // Retrieve the appropriate context
    let contextKey = !_.isNil( isVCVOpenedFromConfigurator )
        ? pca0Constants.FSC_CONTEXT
        : veConstants.CONFIG_CONTEXT_KEY;

    // Add custom properties to column definitions:
    // 1) columnWidth property as per Settings (already initialized)
    // 2) rowBackgroundRender
    columnProperties = _addCustomPropertiesToColumns( columnProperties, gridSettings, multipleVariantsGridTreeDataProvider, vmGridSelectionState, contextKey );

    variability.soaResponse = { ...soaResponse };
    variability.columnProperties = [ ...columnProperties ];
    //change the order of elements in this array: the columns with uids in the formerNewVariants array need to be moved to the beginning
    variability.columnProperties = [
        ...columnProperties.filter( column => variability.formerNewVariantUids.includes( column.propertyName ) ),
        ...columnProperties.filter( column => !variability.formerNewVariantUids.includes( column.propertyName ) )
    ];
    treeData.gridNodes = [ '' ];

    treeData.variabilityNodes = _.cloneDeep( multiVariantsVariabilityNodes );
    treeData.viewModelObjectMap = _.cloneDeep( multiVariantsViewModelObjectMap );

    treeData.variabilityNodes = [ ...treeData.variabilityNodes, ...treeData.propInfoVariabilityNodes ];
    treeData.viewModelObjectMap = { ...treeData.viewModelObjectMap, ...treeData.propInfoViewModelObjectMap };

    // Reset dirty elements if not in a new variant and if we didn't just move from current to all features
    if ( !variability.savingOfNewVariant && !variability.soaResponse.isMoveFromCurrentToAll ) {
        let dirtyNewVariants = variability.dirtyElements && variability.dirtyElements.filter( colName => variability.newVariants.includes( colName ) );
        variability.dirtyElements = dirtyNewVariants;
        variabilityProps.setAtomicData( variability );
        multipleVariantsGrid.setAtomicData( treeData );
        //make sure to reset the new variants dirty column header
        if ( dirtyNewVariants ) {
            eventBus.publish( 'Pca0MultiVariantsGrid.updateDirtyHeaders', {
                variabilityProps: variabilityProps
            } );
        }
    } else {
        delete variability.savingOfNewVariant;
        //readd the former dirty other new Variant to the dirty elements
        variability.dirtyElements = [ ...variability.dirtyElements, ...variability.newVariants ];
        variabilityProps.setAtomicData( variability );
        multipleVariantsGrid.setAtomicData( treeData );
    }

    //do not reset if the isMoveFromCurrentToAll is in dirty state
    if ( !soaResponse.isMoveFromCurrentToAll && variability.newVariants.length < 1 ) {
        // reset IS_VARIANT_TREE_IN_EDIT_MODE if no dirty elements
        appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
    }
    let context = appCtxService.getCtx( contextKey );

    // Set autoEditMode to true
    context.autoEditMode = true;

    // Update the context
    appCtxService.updateCtx( contextKey, context );
    // Setup AutoSave
    appCtxService.updateCtx( 'autoSave.dbValue', false );

    //set the new last server action
    let lastServerLoadAction = displayMode && [ pca0Constants.GRID_DISPLAY_MODE.CURRENT, pca0Constants.GRID_DISPLAY_MODE.FEATURES, pca0Constants.GRID_DISPLAY_MODE.FAMILIES ].indexOf( displayMode.activeDisplayMode ) > -1 ? displayMode.activeDisplayMode : 'current';
    displayMode.activeDisplayMode = lastServerLoadAction;

    //update the column headers of dirty columns
    exports.updateAndColorifyDirtyElements( variability, treeData );

    // Return the data which indicates if the selected variants contains split expressions.
    const hasSplitColumns = columnProperties.some( column => column.isSplitColumn );

    return {
        variabilityProps: variability,
        lastServerLoadAction: lastServerLoadAction,
        displayMode: displayMode,
        failedToLoadSVRs: failedToLoadSVRs,
        hasSplitColumns: hasSplitColumns
    };
};

/**
 * @param {Object} variabilityData - Variability Data
 * @param {Array} columnUids of desired variants to retrieve, optional, if undefined, the entire dirty elements array will be returned
 * @returns {Array} Array of JSON string of selected expressions.
 */
export let getSelectedExpressionsToSave = ( variabilityData, columnUids, includeNewVariants ) => {
    let variantsExpression = pca0MultiSVRSaveCancelEditsService.preProcessVariantsExpressionsForSaveAction( variabilityData, columnUids, includeNewVariants );
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( variantsExpression );
};

/**
 * Display error message when number of selected exceeds 100. - added 50 for now to test - there are some issues after todo
 * There are performance reasons:
 * 1- Server can take lot of time to return expressions.
 * 2- AW client can go out of memory while rendering response.
 * Once this message is shown, we set configuratorContext as Selected object and show empty grid.
 * @param {number} fetchedSvrMaxCountPreference - The threshold value for the number of selected variants.
 */
export let showMessageIfLargeNumberOfSVRsSelected = ( fetchedSvrMaxCountPreference ) => {
    let message = _localeTextBundleOfExplorerMessages.Pca0NoOfSVRsInGridEditor.replace( '{0}', fetchedSvrMaxCountPreference );
    let cancelString = _localeTextBundleOfExplorerMessages.cancel;
    let proceedString = _localeTextBundleOfExplorerMessages.continue;
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'primaryWorkarea.selectAction', {
                selectAll: false
            } );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0MultiVariantsGrid.continueLoadVariabilityDataAction' );
        }
    }
    ];
    messagingService.showWarning( message, buttons );
};

/**
 * Util to highlight the background color of MultipleVariants grid header cell
 * @param {Object} columnConfigCols - columns
 * @param {String} columnUid - columnUid
 * @param {Object} vmo - vmo  containing the change
  * @param {Object} vmVariabilityProps - The ViewModel atomic data for VariabilityProps
 */
export let cleanAndColorifyHeaderCells = ( columnConfigCols, columnUid, vmo, vmVariabilityProps ) => {
    let variabilityProps = vmVariabilityProps.getValue ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };

    //first remove color from any other header then set color on the current header

    columnConfigCols.forEach( col => {
        //do not remove any other column than current, it should stay highlighted until not dirty anymore
        if ( col.name === columnUid ) {
            pca0RendererService.unColorifyHeaderCell(
                col.titleName ? col.titleName : col.displayName,
                pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // blue color className,
                veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
            );
            delete col.headerStatusInfo;
        }
    } );
    //if this is a changed cell add it to the column's list of changed cells, if not delete it
    //if the column is empty of changes do not color the header
    const curCol = columnConfigCols.find( ( { uid } ) => uid === columnUid );
    if ( !curCol.changedCells ) {
        curCol.changedCells = [];
    }
    if ( vmo && vmo.props[columnUid].valueUpdated ) {
        if ( !curCol.changedCells.some( entry => entry === vmo.alternateID ) ) {
            curCol.changedCells.push( vmo.alternateID );
        }
    } else {
        const index = curCol.changedCells.indexOf( vmo.alternateID );
        if ( index > -1 ) {
            curCol.changedCells.splice( index, 1 );
        }
    }
    if ( curCol.changedCells && curCol.changedCells.length > 0 ) {
        pca0RendererService.colorifyHeaderCell(
            curCol.displayName, // titleName
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // blue color className
            veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
        );
    } else {
        //Since now no any changedCells present , remove current column from DirtyElements
        //here dirtyElement represents column not cell
        pca0GridCommonUtils.removeDirtyElement( vmVariabilityProps, columnUid );
        if ( variabilityProps.dirtyElements.length === 0 ) {
            //no any dirty column present, so reset the edit mode status
            pca0CommonUtils.resetEditModeStatus();
            eventBus.publish( 'editHandlerStateChange', { state: 'cancelled' } );
        }
    }
};

/**
 * Util to mark the completeness status to stale for MultipleVariants grid header cell
 * @param {Object} columnConfigCols - columns
 * @param {String} columnUid - columnUid
 */
export let markCompletenessStatusToStale = ( columnConfigCols, columnUid ) => {
    let displayName = columnConfigCols.find( ( col ) => col.name === columnUid ).displayName;
    pca0RendererService.staleCompletenessStatusIcon(
        displayName,
        veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID
    );
};

/**
 * handles the Expand/Collapse command and resets the highlightedVmos as well
 * the change in the gridData.expandAll will trigger the dp update. The state of the activeDisplay will stay unchanged.
 * This is now possible because the dp function considers the state and will also take care of the re-comparing
 * @param {string} actionType - The type of action to perform (expand or collapse).
 * @param {Object} multipleVariantsGridData - The atomic data for multiple variants grid.
 * @param {string} criteriaStatus - The status of the criteria, can be 'Valid','InValid' or 'ValidAndInComplete'.

 */
export let handleExpandCollapseAllActionForSVR = ( actionType, multipleVariantsGridData, criteriaStatus ) => {
    let gridData = { ...multipleVariantsGridData.getAtomicData() };
    // Rows should expand only when the criteria status from the SOA response is 'Invalid' in order to show violations on grid cells.
    // For the expand and collapse case, criteriaStatus will be undefined, so a check for undefined was added to ensure that the expandAll toggle happens.
    // The condition is defined in such a way that the expandAll value toggles only when expanding and collapsing, and for validating invalid SVRs.
    if ( !criteriaStatus || criteriaStatus === 'InValid' ) {
        gridData.expandAll = actionType === veConstants.GRID_CONSTANTS.ACTION_EXPAND;
        //cleanup the highlightedVmos if any, (has to be done here from react18 onwards in order to avoid calling the refresh batch which again updates the atomic data too)
        gridData.highlightedVmos = undefined;
        multipleVariantsGridData.setAtomicData( gridData );
    }
    return {
        beforeCompareVmos: []
    };
};

/**
 * This API returns initialVariantRule only when selections are undefined
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getCreatedVariantRule = ( variantRuleData ) => {
    return pca0CommonUtils.getCreatedVariantRule( variantRuleData );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {Object} ConfigPerspective - Returns the config perspective
 */
export let getConfigPerspective = ( variantRuleData ) => {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * Return Profile Settings information
 * @returns {Object} Active Profile Settings for FSC
 */
export let getFscProfileSettings = () => {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * gets the ConfigPerspective for Variant
 * @param {Object} fetchedActiveSettings - fetchedActiveSettings
 * @param {String} currentSVRUid - currentSVRUid
 * @param {Object} multiVariantsConfigPerspective - multiVariantsConfigPerspective
 * @returns {Object} multiVariantsConfigPerspective
 */
export let getConfigPerspectiveforVariant = ( fetchedActiveSettings, currentSVRUid, multiVariantsConfigPerspective ) => {
    if ( !currentSVRUid.startsWith( 'NewVariant' ) ) {
        return fetchedActiveSettings[currentSVRUid].configPerspective;
    }
    return multiVariantsConfigPerspective ? multiVariantsConfigPerspective : fetchedActiveSettings.default.configPerspective;
};

/**
 * gets the profile settings for Variant, either the default for the new Variant or the ones from the SVR
 * @param {Object} fetchedActiveSettings - fetchedActiveSettings
 * @param {String} currentSVRUid - currentSVRUid
 * @returns {String} validationProfileAsString
 */
export let getProfileSettingsForVariant = ( fetchedActiveSettings, currentSVRUid ) => {
    if ( currentSVRUid.startsWith( 'NewVariant' ) && fetchedActiveSettings.default ) {
        return fetchedActiveSettings.default.appliedSettings.validationProfileAsString;
    }
    return fetchedActiveSettings[currentSVRUid].appliedSettings.validationProfileAsString;
};

/**
 * gets the JsonString of the ActiveSelectedExpressions for Variant, helper for the expand
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @param {String} currentSVRUid - currentSVRUid
 * @param {String} action - action optional only transmitted in case of expand or validate
 * @param {Object} variabilityProps - variabilityProps
 * @returns {String} JsonString
 */
export let getJsonStringActiveSelectedExpressionsforVariant = ( businessObjectToSelectionMap, currentSVRUid, action, variabilityProps ) => {
    let isSplitColumn = false;
    let splitColumnNames = [];
    let currentSVRUids = [ currentSVRUid ];
    if( variabilityProps ) {
        const currentColumns = _.get( variabilityProps, 'columnProperties', [] );
        isSplitColumn = currentColumns.find( column => column.propertyName === currentSVRUid )?.isSplitColumn;
        if ( isSplitColumn ) {
            // Get the split columns related to the current column
            const splitColumns = currentColumns.filter( column => column.originalColumnName === currentSVRUid && column.originalColumnName !== column.propertyName );
            splitColumnNames = splitColumns.map( column => column.propertyName );
        }
    }
    // Resets node uids of type isUnconfigured, enumeratedFamilies & freeFormFamilies from selection
    if( splitColumnNames.length > 0 ) {
        currentSVRUids = [ currentSVRUid, ...splitColumnNames ];
    }
    pca0GridCommonUtils.resetNodeUidFromSelection( businessObjectToSelectionMap, currentSVRUids );
    //in the case of validate we need to clean the selections from any selectionState 0 otherwise we encounter server errors.
    //Until that gets fixed we'll add client code
    if ( action && action !== 'expand' ) {
        exports.removeEmptySelectionStates( businessObjectToSelectionMap, currentSVRUid );
    }
    // Get the expression data from the service
    const selectedExpressionData = pca0ExpressionGridService.getColumnValidationPCAGrid( currentSVRUid, businessObjectToSelectionMap );
    // We are using the opcode 18 for Validate action ??? this is in sync with Validate action in FSC List View.
    // Update the expressionType values to 18 for the selected expressions (from below response expressionType is geeting changed to 18),
    // {
    //   "SR::gEmdJP2rJX87LC": [
    //       {
    //           "expressionType": 48,
    //           "configExpressionSet": [
    //               {
    //                   "configExpressionSections": [
    //                       {
    //                           "expressionType": 23,
    //                           "subExpressions": [
    //                               {
    exports.updateExpressionType( selectedExpressionData );

    // Get the current columns and check if the current column is a split column
    if ( isSplitColumn ) {
        // Get the selected expressions for the split columns
        const splitColumnsSelectedExpressions = pca0ExpressionGridService.getSubExpressions( businessObjectToSelectionMap, splitColumnNames );

        // Add the split columns' selected expressions to the main selected expression data
        selectedExpressionData[currentSVRUid][0].configExpressionSet[0].configExpressionSections[0].subExpressions.push( ...splitColumnsSelectedExpressions );
    }

    // Return the JSON string after conversion
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressionData );
};
/**
 * gets the JsonString of the ActiveSelectedExpressions for Variant, helper for the expand
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @returns {String} JsonString
 */
export let getJsonStringActiveSelectedExpressionsForBomFsc = ( businessObjectToSelectionMap ) => {
    //Resets node uids of type isUnconfigured, enumeratedFamilies & freeFormFamilies from selection
    pca0GridCommonUtils.resetNodeUidFromSelection( businessObjectToSelectionMap );
    pca0ExpressionGridService.removeZeroSelections( businessObjectToSelectionMap );
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getPCAGridFromSelectionMap( businessObjectToSelectionMap ) );
};

/**
 * Generates a JSON string containing export data for a variant based on the current column configuration
 * @param {Object} treeDataProvider -  DataProvider to be initialized/loaded
 * @param {Object} multipleVariantsGrid Atomic Data defined for the multipleVariantsGrid
 * @returns {string} - Returns a JSON string containing the export data for the variant.
 */
export let getJsonStringExportDataForVariant = ( treeDataProvider, multipleVariantsGrid ) => {
    let variantData = [];
    let columnConfig = [ ...treeDataProvider.columnConfig.columns ];
    // filtering out the columns from columnConfig which includes columns displayed in grid, newly added variant columns and cots columns.
    // Further column UIDs are used to fetch selections and summaries to export the data, hence excluding the object column.
    let columns = columnConfig.filter( column => column.hiddenFlag === false && column.displayName !== _localeTextBundleOfExplorerMessages.object );
    let multipleVariantsGridData = { ...multipleVariantsGrid.getAtomicData() };
    let standAloneFeaturesUids = multipleVariantsGridData.propInfoVariabilityNodes.filter( node => node.props?.isLeaf && node.props.isLeaf[0] && node.props.parent?.length > 1 ).map( node => node.nodeUid );
    let allVmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let rootNode = multipleVariantsGridData.variabilityNodes.find( node => node.nodeUid === '' );
    if ( rootNode ) {
        const rootNodeChildrenUids = rootNode.childrenUids.filter( uid =>
            allVmos.some( vmo => vmo.nodeUid === uid )
        );
        variantData.push( {
            nodeUid: rootNode.nodeUid,
            children: rootNodeChildrenUids
        } );
    }
    let headerData = [ {
        displayName: _localeTextBundleOfExplorerMessages.object
    } ];

    // For newly added columns, UIDs are present as propertyName. The propertyName and UIDs are the same for all the columns
    // So instead of passing UIDs, passing propertyName to nodeUid, which is a required input for headerData.
    columns.forEach( column => {
        headerData.push( {
            displayName: column.displayName,
            nodeUid: column.propertyName
        } );
    } );
    allVmos.forEach( vmo => {
        pca0CommonUtils.processVariantExportData( vmo, variantData, columns, allVmos, standAloneFeaturesUids );
    } );
    const exportData = {
        variantData: variantData,
        headerData: headerData
    };

    return JSON.stringify( exportData );
};

/**
 * Updates data provider and the related businessObjectToSelectionMap with the expressions from the soaResponse obtained after expand or other VCV3 calls
 * @param {Object} soaResponse SOA response
 * @param {String} currentSVRUid the svr uid
 * @param {Object} vmData current view model
 * @param {Object} treeDataProvider tdp
 * @param {string} validOrExpandAction determines if the action is validate or expand
 */
export let updateSVR = ( soaResponse, currentSVRUid, vmData, treeDataProvider, validOrExpandAction ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

    //maria: deal with violations here in order to fill in the invalid chip or header tooltip with violation info:
    if ( !_.isUndefined( soaResponse.responseInfo ) && !_.isEmpty( soaResponse.responseInfo.isValid ) &&
        soaResponse.responseInfo.isValid[0] === 'false' ) {
        // handleInvalidConfiguration
        // _showViolationsOnValidation( response.labels, response.responseInfo, response.payloadStrings );
    }
    if ( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
        pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
        return;
    }

    let variability = { ...vmData.variabilityProps.getAtomicData() };
    let gridData = { ...vmData.multipleVariantsGrid.getAtomicData() };

    const violationSeverityIndicatorImgMap = {
        [pca0Constants.ERROR_SEVERITIES.ERROR]: 'indicatorError',
        [pca0Constants.ERROR_SEVERITIES.WARNING]: 'indicatorWarning',
        [pca0Constants.ERROR_SEVERITIES.INFO]: 'indicatorInfo'
    };
    if ( validOrExpandAction === 'expand' ) {
        //first we need to clear the system selections
        exports.clearVmoSelectionsForSVR( gridData, treeDataProvider, currentSVRUid, 'clearSystem' );

        // Convert Selected Expressions
        let selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
        let clonedExpressions = { ...selectedExpressions };

        // Populate businessObjectToSelectionMap
        soaResponse.selectedExpressions = clonedExpressions;
        soaResponse.selectedExpressions = {};
        let boKeys = Object.keys( clonedExpressions );
        let loadVariantsDataSoaResponse = variability.soaResponse;
        // replace the former stuff with new data from server
        loadVariantsDataSoaResponse.selectedExpressions[currentSVRUid] = clonedExpressions[boKeys[0]];
        let columnPropsAndSelectionMapResult = exports.getColumnPropsAndSelectionMapForSVR(
            'multipleVariantsConfigGrid',
            loadVariantsDataSoaResponse,
            currentSVRUid,
            gridData.businessObjectToSelectionMap
        );

        // Process Dirty Elements
        variability.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
            variability.dirtyElements,
            gridData.businessObjectToSelectionMap,
            gridData.backupOfBusinessObjectToSelectionMap
        );

        //get the Display Name of the column
        let displayName = pca0VariabilityTreeDisplayService.getDisplayNameForBusinessObject( loadVariantsDataSoaResponse, currentSVRUid );

        //color the header cell
        pca0RendererService.colorifyHeaderCell( displayName,
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
            veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID );

        //mark the cells for update
        _markCellsForUpdate( gridData, currentSVRUid, vmos );

        let businessObjectToSelectionMapKeys = {};
        Object.entries( gridData.businessObjectToSelectionMap ).forEach( ( [ mapKey, mapSelections ] ) => {
            businessObjectToSelectionMapKeys[mapKey] = Object.keys( mapSelections ).sort();
        } );
        //show expanded nodes in collapsed state
        vmos.forEach( vmo => {
            if ( vmo.isFamily ) {
                pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                    gridData.businessObjectToSelectionMap,
                    vmo,
                    gridData.viewModelObjectMap,
                    treeDataProvider.columnConfig.columns,
                    true,
                    veConstants.GRID_CONSTANTS.MULTI_SVR_GRID, //gridMode - This will be removed once we have gridOptions prop for a generic grid component
                    vmos,
                    gridData.variabilityNodes,
                    businessObjectToSelectionMapKeys
                );
            }
        } );

        //update the backup grid data
        gridData.businessObjectToSelectionMap = { ...columnPropsAndSelectionMapResult.businessObjectToSelectionMap };
    }
    //add the violation is any
    let violationsInfos = {
        [pca0Constants.ERROR_SEVERITIES.ERROR]: [],
        [pca0Constants.ERROR_SEVERITIES.WARNING]: [],
        [pca0Constants.ERROR_SEVERITIES.INFO]: []
    };
    let nonSelectedVmosWithViolations = [];

    // Usually, there is only one column for the variant. However, in the case of a variant with split columns,
    // we need to retrieve the column IDs for all the columns corresponding to that variant.
    let currentColumnIDs = variability.columnProperties.filter( column => column.originalColumnName === currentSVRUid )
        .map( column => column.propertyName );

    if ( soaResponse.labels ) {
        let violationInfosResponse = exports.parseResponseAndExtractViolations( soaResponse, gridData.businessObjectToSelectionMap, violationsInfos, vmos, currentColumnIDs );
        nonSelectedVmosWithViolations = violationInfosResponse.nonSelectedVmosWithViolations;
        violationsInfos = violationInfosResponse.violationsInfos;
    }

    // Add soaResponse.responseInfo and violations to column properties of the particular SVR
    if ( soaResponse.responseInfo && currentColumnIDs.length > 0 ) {
        // Also update the data provider's columnConfig.columns
        treeDataProvider.columnConfig.columns.forEach( column => {
            if ( currentColumnIDs.includes( column.propertyName ) ) {
                column.headerStatusInfo = {
                    CompletenessStatus: {
                        completenessStatusId: soaResponse.responseInfo.criteriaStatus[0]
                    },
                    summaryViolationsInfo: violationsInfos,
                    currentSVRUid: currentSVRUid
                };
            }
        } );
    }

    if ( soaResponse.labels || soaResponse.responseInfo.criteriaStatus[0] ) {
        eventBus.publish( 'pca0MultiSVRGridEditor.updateCompletenessStatusAndViolations', {
            CompletenessStatus: {
                completenessStatusId: soaResponse.responseInfo.criteriaStatus[0]
            },
            summaryViolationsInfo: violationsInfos,
            currentSVRUid: currentSVRUid
        } );
    }

    // reflect on tdp
    // Currently, after expanding the invalid SVRs, we are expanding the nodes after post-processing of SVRs.
    // In the collapsed state, VMOs will not be there, and hence reflection on TDP will not be performed.
    // However, recursiveCreateTreeNode will be called after expanding the nodes, which will check for violationsInfo and set grid cell indicators.

    _populateViolationsOnDataProvider( currentColumnIDs, gridData.businessObjectToSelectionMap, vmos, violationSeverityIndicatorImgMap );

    if ( nonSelectedVmosWithViolations.length > 0 ) {
        nonSelectedVmosWithViolations.forEach( vmo => {
            exports.reflectViolationOnDataProviderForVmo( vmo, vmo.violationsInfo, currentSVRUid, violationSeverityIndicatorImgMap );
        } );
    }

    if ( validOrExpandAction === 'expand' ) {
        // Set IS_VARIANT_TREE_IN_EDIT_MODE
        appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );
        // We are identifying newly added nodes and adding them to the treeDataProvider. This is done to ensure that the treeDataProvider is in sync with the gridData.
        // We are taking the union of childrenVmos and vmos because when we manually expand and collapse nodes in the grid,
        // vmos will not have all the nodes. ChildrenVmos will have all the nodes. Once we update the treeDataProvider, vmos are getting updated, so we do
        // not want to add the same node twice. Therefore, both childrenVmos and vmos are taken into consideration.
        let childrenVmos = treeDataProvider.topTreeNode.children;
        const allVmos = _.union( childrenVmos, vmos );
        let allNewlyAddedNodes = _getVariabilityNodesNotRendered( allVmos, variability );
        if( allNewlyAddedNodes && allNewlyAddedNodes.length > 0 ) {
            vmData.variabilityProps.setAtomicData( variability );
            vmData.multipleVariantsGrid.setAtomicData( gridData );
            eventBus.publish( 'multipleVariantsConfigGrid.plTable.reload' );
            return;
        }
    }
    vmData.variabilityProps.setAtomicData( variability );
    vmData.multipleVariantsGrid.setAtomicData( gridData );
    treeDataProvider.update( vmos, vmos.length );
};

/**
 * Clear all & Clear Selections as per the option selected
 * @param {Object} gridData Grid Data
 * @param {Object} treeDataProvider treeDataProvider
 * @param {String} uid svr uid
 * @param {Object} clearType clearAll/ clearSystem
 */
export let clearVmoSelectionsForSVR = ( gridData, treeDataProvider, uid, clearType ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    for ( const [ key, value ] of Object.entries( gridData.businessObjectToSelectionMap[uid] ) ) {
        let keyToConsider = key;
        //for unconfigured values we need to find the right vmo, it won't find the alternate vm in the form: "xxx:yyy:yyy:Sony" so try to see if such a key exists
        keyToConsider = exports.getExistingNodeKeyForUnconfiguredValue( key, value, gridData.businessObjectToSelectionMap );
        let vmo = _.find( vmos, { alternateID: keyToConsider } );
        if ( value && configuratorUtils.getSystemSelectionStates().includes( value.selectionState ) && clearType === 'clearSystem' || clearType === 'clearAll' ) {
            value.selectionState = 0;
            if ( vmo ) {
                vmo.props[uid].dbValue = 0;
                vmo.props[uid].valueUpdated = true;
            }
        }
    }
};

/**
 * Clear all & Clear System Selections as per the option selected
 * @param {Object} vmGridData Grid Data
 * @param {Object} treeDataProvider treeDataProvider
 * @param {Object} eventData eventData
 * @param {Object} clearType clearAll/ clearSystem
 */
export let clearColumnSelectionsForSVR = ( vmGridData, treeDataProvider, eventData, clearType ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let uid = eventData.column.field;
    let variabilityProps = { ...vmGridData.variabilityProps.getAtomicData() };
    let gridData = { ...vmGridData.multipleVariantsGrid.getAtomicData() };
    // Clear system or all selections from vmos
    exports.clearVmoSelectionsForSVR( gridData, treeDataProvider, uid, clearType );

    //Summary update if we are collapsed
    vmos.forEach( vmo => {
        if ( vmo.isFamily ) {
            pca0GridCommonUtils.updateViewModelTreeNodeSummary(
                gridData.businessObjectToSelectionMap,
                vmo,
                gridData.viewModelObjectMap,
                treeDataProvider.columnConfig.columns,
                true,
                veConstants.GRID_CONSTANTS.MULTI_SVR_GRID, //gridMode - This will be removed once we have gridOptions prop for a generic grid component
                vmos,
                gridData.variabilityNodes

            );
        }
    } );


    variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
        // For multiple variants in grid selection changes, keep on collecting updated variants.
        variabilityProps.dirtyElements, // currentDirtyElements
        gridData.businessObjectToSelectionMap, // selection map
        gridData.backupOfBusinessObjectToSelectionMap // backup selection map
    );
    pca0RendererService.colorifyHeaderCell( eventData.column.displayName,
        pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
        veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID );
    treeDataProvider.update( vmos, vmos.length );
    vmGridData.variabilityProps.setAtomicData( variabilityProps );
    vmGridData.multipleVariantsGrid.setAtomicData( gridData );
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );
};

/**
 * Get violations and return them in a map for the current svr
 * @param {Object} response - response
 * @param {Object} businessObjectToSelectionMapForCurrentSVR - businessObjectToSelectionMapForCurrentSVR,
 * @param {Object} violationsInfos - empty violationsInfos object
 * @param {Array} vmos - vmos
 * @returns {Object} violationsInfos - filled violationsInfos object
 */
export let parseResponseAndExtractViolations = ( response, businessObjectToSelectionMap, violationsInfos, vmos, currentColumnIDs ) => {
    let labels = response.labels;
    let nonSelectedVmosWithViolations = [];
    if ( labels !== undefined && labels.violationMap[0] !== undefined && labels.violationMap[0].nodeMap !== undefined ) {
        // Get the violation ids from the labels map and extract the keys.
        const violationIds = Object.keys( labels.violationMap[0].nodeMap );
        if ( violationIds.length > 0 ) {
            let violationIds2 = violationIds.map( id => {
                // free form date comes in the form: GroupUid:CkW5GycSpgwwkB:CkW5GycSpgwwkB:2022-04-19T00:00:00Z"
                // so you have to just ignore the first part in general
                return id.slice( id.indexOf( ':' ) + 1 );
            } );

            // map all the violations to the businessObjectToSelectionMapForCurrentSVR
            let foundViolations = [];
            currentColumnIDs.forEach( columnID => {
                if ( businessObjectToSelectionMap[columnID] !== undefined ) {
                    for ( const [ key, value ] of Object.entries( businessObjectToSelectionMap[columnID] ) ) {
                        let getGroupToLeafUid = _getFamilyToLeafUid( key );
                        if ( violationIds2.includes( getGroupToLeafUid ) ) {
                            value.hasViolation = true;
                            const violationsInfo = configuratorUtils.buildViolationString( value, labels, value.family, veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID );
                            foundViolations.push( { violationId: getGroupToLeafUid, bo: value, vmo: undefined } );
                            const featureViolations = {
                                [pca0Constants.ERROR_SEVERITIES.ERROR]: [],
                                [pca0Constants.ERROR_SEVERITIES.WARNING]: [],
                                [pca0Constants.ERROR_SEVERITIES.INFO]: []
                            };
                            configuratorUtils.populateViolationMap( featureViolations, violationsInfo );
                            // feature level violation population
                            exports.populateViolationsOnBusinessObject( value, featureViolations );
                            violationsInfos[pca0Constants.ERROR_SEVERITIES.ERROR] =
                                _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.ERROR], ...featureViolations[pca0Constants.ERROR_SEVERITIES.ERROR] ], 'violationMessage' );
                            violationsInfos[pca0Constants.ERROR_SEVERITIES.WARNING] =
                                _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.WARNING], ...featureViolations[pca0Constants.ERROR_SEVERITIES.WARNING] ], 'violationMessage' );
                            violationsInfos[pca0Constants.ERROR_SEVERITIES.INFO] =
                                _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.INFO], ...featureViolations[pca0Constants.ERROR_SEVERITIES.INFO] ], 'violationMessage' );
                        }
                    }
                }
            } );

            // some violations are not associated with a bo, they are not selected, use the dp to find the objects
            if ( foundViolations.length !== violationIds2.length ) {
                // get the violations that were not handled
                let notHandledViolations = _.difference( violationIds2, foundViolations.map( violation => violation.violationId ) );
                notHandledViolations.forEach( violationId => {
                    let value = _.find( vmos, function( vmo ) {
                        return vmo.parentUID + ':' + vmo.nodeUid === violationId;
                    } );
                    if ( value ) {
                        nonSelectedVmosWithViolations.push( value );
                        value.hasViolation = true;
                        const violationsInfo = configuratorUtils.buildViolationString( value, labels, value.parentUID );
                        const featureViolations = {
                            [pca0Constants.ERROR_SEVERITIES.ERROR]: [],
                            [pca0Constants.ERROR_SEVERITIES.WARNING]: [],
                            [pca0Constants.ERROR_SEVERITIES.INFO]: []
                        };
                        configuratorUtils.populateViolationMap( featureViolations, violationsInfo );

                        // feature level violation population
                        exports.populateViolationsOnBusinessObject( value, featureViolations );
                        violationsInfos[pca0Constants.ERROR_SEVERITIES.ERROR] =
                            _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.ERROR], ...featureViolations[pca0Constants.ERROR_SEVERITIES.ERROR] ], 'violationMessage' );
                        violationsInfos[pca0Constants.ERROR_SEVERITIES.WARNING] =
                            _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.WARNING], ...featureViolations[pca0Constants.ERROR_SEVERITIES.WARNING] ], 'violationMessage' );
                        violationsInfos[pca0Constants.ERROR_SEVERITIES.INFO] =
                            _.uniqBy( [ ...violationsInfos[pca0Constants.ERROR_SEVERITIES.INFO], ...featureViolations[pca0Constants.ERROR_SEVERITIES.INFO] ], 'violationMessage' );
                    }
                } );
            }
        }
    }
    return { violationsInfos: violationsInfos, nonSelectedVmosWithViolations: nonSelectedVmosWithViolations };
};

/**
 * Populates violation data for all severity levels
 * @param {Object} businessObject - The business object to which the violation indicators should be added.
 * @param {Object} violations - An object containing an array of violations for each severity level.
 * @returns {void}
 */
export const populateViolationsOnBusinessObject = ( businessObject, violations ) => {
    // Show violation icons for each type of severities and its associated violation messages.
    if ( !_.isEmpty( violations[pca0Constants.ERROR_SEVERITIES.INFO] ) ) {
        _populateViolationsPerSeverity( violations, businessObject, pca0Constants.ERROR_SEVERITIES.INFO );
    } else if ( !_.isEmpty( violations[pca0Constants.ERROR_SEVERITIES.WARNING] ) ) {
        _populateViolationsPerSeverity( violations, businessObject, pca0Constants.ERROR_SEVERITIES.WARNING );
    } else if ( !_.isEmpty( violations[pca0Constants.ERROR_SEVERITIES.ERROR] ) ) {
        _populateViolationsPerSeverity( violations, businessObject, pca0Constants.ERROR_SEVERITIES.ERROR );
    }
};

/**
 * Checks if the default profile setting or variant specific setting to be used
 * If the SVRUid starts with 'NewVariant' - it will require default setting
 * Else it will require variant specific setting
 * @param {String} currentSVRUid - currentSVRUid
 * @returns {Boolean} true if new variant
 */
export const checkTypeOfSettingsNeeded = ( currentSVRUid ) => {
    return currentSVRUid.startsWith( 'NewVariant' );
};

/**
 * Populates violation data for all severity levels -todo move to common
 * @param {Object} fetchedActiveSettings fetchedActiveSettings
 * @param {Object} currentSVRUid currentSVRUid
 * @returns {Object} isFetchedActiveSettingForCurrentSVR and object
 */
export let checkActiveSettingsFromMap = ( fetchedActiveSettings, currentSVRUid ) => {
    let isFetchedActiveSettingForCurrentSVR = false;
    if ( fetchedActiveSettings && fetchedActiveSettings.hasOwnProperty( currentSVRUid ) ) {
        isFetchedActiveSettingForCurrentSVR = true;
    }
    return {
        isFetchedActiveSettingForCurrentSVR: isFetchedActiveSettingForCurrentSVR,
        activeSettingForCurrentSVR: fetchedActiveSettings[currentSVRUid]
    };
};

/**
 * Clear violations for the column
 * @param {String} columnUid column ID
 * @param {Object} multipleVariantsGridData atomic data
 * @param {Object} treeDataProvider data provider
 */
export let clearViolations = ( columnUid, multipleVariantsGridData, treeDataProvider ) => {
    //we need to remove violations from both collapsed and expanded nodes, unfortunately we cannot get the non visible nodes from the loaded vmos
    //so we'll go through the max set of vmos
    let childrenVmos = treeDataProvider.topTreeNode.children; //we need all the vmos
    let loadedVmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let allLoadedVmos = _.unionBy( loadedVmos, childrenVmos, 'alternateID' );

    let gridData = { ...multipleVariantsGridData.getAtomicData() };
    let hasViolationsToReset = false;

    //we need to iterate over the vmos first and formost because there might be violation on non selected vmos, like in the case of a family
    //that has a violation but the violations coming from the server are on the features underneath ( VCV legacy because there they cannot be represented )
    allLoadedVmos.forEach( vmo => {
        //remove violations
        _.set( vmo.props[columnUid], 'indicators', undefined );
        let bo = _.find( gridData.businessObjectToSelectionMap[columnUid], ( value, key ) => {
            return key === vmo.alternateID;
        } );
        if ( bo && bo.violationsInfo ) {
            delete bo.violationsInfo;
            hasViolationsToReset = true;
        }
    } );
    //only update the dp if any changes were made
    if ( hasViolationsToReset ) {
        multipleVariantsGridData.setAtomicData( gridData );
        treeDataProvider.update( loadedVmos, loadedVmos.length );
    }
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );
    eventBus.publish( 'pca0MultiSVRGridEditor.updateCompletenessStatusAndViolations', {
        CompletenessStatus: undefined,
        summaryViolationsInfo: undefined,
        currentSVRUid: columnUid
    } );
};

/**
 * Build Column Properties and Selection Map for one svr - uses the common utils that sets more stuff but here we are only interested in the selections
 * @param {String} gridID Grid Identifier
 * @param {Object} soaResponse SOA response
 * @param {String} boKey the svr uid
 * @param {Object} businessObjectToSelectionMap current businessObjectToSelectionMap
 * @returns {Object} Info container for list of column properties and Selection Map
 */
export let getColumnPropsAndSelectionMapForSVR = ( gridID, soaResponse, boKey, businessObjectToSelectionMap ) => {
    let columnProperties = [];
    let columnSplitIDsMap = {};
    let multiVariantsSelectionMap = {};
    let familyAndGroupMaps = exports.createFamilyAndGroupMaps( soaResponse );
    let groupsToModules = _createGroupsToModulesMap( soaResponse );
    exports.getColumnPropsAndSelectionMapForBO( gridID, soaResponse, boKey, columnProperties, columnSplitIDsMap,
        businessObjectToSelectionMap, {}, {}, multiVariantsSelectionMap, familyAndGroupMaps, groupsToModules );

    return { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, multiVariantsSelectionMap };
};

/**
 * Build Column Properties and Selection Map
 * This process is not depending on tree DataProvider and columns creation
 * @param {String} gridID Grid Identifier
 * @param {Object} soaResponse SOA response
 * @returns {Object} Info container for list of column properties and Selection Map
 */
export let getColumnPropsAndSelectionMapSVR = ( gridID, soaResponse ) => {
    let columnProperties = [];
    let columnSplitIDsMap = {};
    let businessObjectToSelectionMap = {};
    let multiVariantsSelectionMap = {};
    let familyAndGroupMaps = exports.createFamilyAndGroupMaps( soaResponse );
    let groupsToModules = _createGroupsToModulesMap( soaResponse );

    let boKeys = Object.keys( soaResponse.selectedExpressions );
    boKeys.forEach( boKey => {
        exports.getColumnPropsAndSelectionMapForBO( gridID, soaResponse, boKey, columnProperties, columnSplitIDsMap,
            businessObjectToSelectionMap, {}, {}, multiVariantsSelectionMap, familyAndGroupMaps, groupsToModules );
    } );

    return { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, multiVariantsSelectionMap };
};

/**
 * Build Column Properties and Selection Map per column (business object)
 * This process is not depending on tree DataProvider and columns creation
 * @param {String} gridID Grid Identifier
 * @param {Object} soaResponse soaResponse
 * @param {Object} boKey selected Expression key - or column uid
 * @param {Object} columnProperties Column Properties
 * @param {Object} columnSplitIDsMap Column Split ID maps
 * @param {Object} businessObjectToSelectionMap businessObjectToSelectionMap
 * @param {Object} subjectSelectionMap subjectSelectionMap
 * @param {Object} conditionSelectionMap conditionSelectionMap
 * @param {Object} multiVariantsSelectionMap multiVariantsSelectionMap
 * @param {Object} familyAndGroupMaps familyAndGroupMaps
 * @param {Object} groupsToModules groupsToModules
 * @returns {Object} Info container for list of column properties and Selection Map
 */
export let getColumnPropsAndSelectionMapForBO = ( gridID, soaResponse, boKey, columnProperties, columnSplitIDsMap,
    businessObjectToSelectionMap, subjectSelectionMap, conditionSelectionMap, multiVariantsSelectionMap, familyAndGroupMaps, groupsToModules ) => {
    // NOTE: for Constraints Authoring, 'selectedExpressions' structure is different from VCA
    // VCA comes with one 'configExpressionSections' for each BO
    // Constraints Authoring comes with two 'configExpressionSections':
    //  one for Subject [exprType: 44] and one for Condition [exprType25]
    // Hence:
    // - when building the selectionMap we need to make sure we don't overwrite selectionMap
    // - Build columns once selectionMap is complete, to avoid duplicates
    columnSplitIDsMap[boKey] = [];

    // Initialize temporary array to store splitColumn keys
    // This is needed because Constraints grid editor requires a different structure for splitColumnMap
    let splitColumnKeys = [];

    let displayName = pca0VariabilityTreeDisplayService.getDisplayNameForBusinessObject( soaResponse, boKey );

    let sourceType = _.get( soaResponse, `viewModelObjectMap[${boKey}].sourceType` );

    let businessObjects = soaResponse.selectedExpressions[boKey];
    let configExpressionSections = _.get( businessObjects, '[0].configExpressionSet[0].configExpressionSections' );
    if ( !_.isUndefined( configExpressionSections ) && configExpressionSections.length > 0 ) {
        configExpressionSections.forEach( configExprSection => {
            const subExpressions = configExprSection.subExpressions;
            if ( _.isUndefined( subExpressions ) ) {
                return; // continue
            }

            let familyToGroupMap = {};
            let groupToFamiliesMap = {};
            let familiesPresentInMultipleGroups = {};
            //maria todo we'll have to create the module:group:family:feature or group:family:feature
            if ( gridID === 'multipleVariantsConfigGrid' && familyAndGroupMaps ) {
                familyToGroupMap = familyAndGroupMaps.familyToGroupMap;
                groupToFamiliesMap = familyAndGroupMaps.groupToFamilyMap;
                familiesPresentInMultipleGroups = familyAndGroupMaps.familiesPresentInMultipleGroups;
            }
            _.forEach( subExpressions, ( subExpression, idx ) => {
                // Process selections
                if ( !subExpression.expressionGroups ) {
                    return;
                }

                // Process Unique Key and update split column Map
                let uniqueKey = boKey;
                if ( idx !== 0 ) {
                    uniqueKey = Pca0VCAUtils.instance.generateSplitColumnKey( boKey, idx );
                    splitColumnKeys.push( uniqueKey );
                }

                let nodeIDToObject = {};
                Object.values( subExpression.expressionGroups ).forEach( selections => {
                    _.forEach( selections, sel => {
                        //for the multi variant grid consider the case that a selection is only identified by a feature/family so it can appear
                        //under multiple groups and module nodes: build the nodeIDToObject appropriately:
                        //copy sel and the props underneath: better performance than assign
                        let selection = { ...sel };
                        for ( let subKey in sel ) {
                            if ( sel.hasOwnProperty( subKey ) && typeof sel[subKey] === 'object' ) {
                                selection[subKey] = { ...sel[subKey] };
                            }
                        }
                        _createMultipleEntriesForSelection( selection, nodeIDToObject, familyToGroupMap, groupToFamiliesMap, groupsToModules, familiesPresentInMultipleGroups );
                    } );
                } );
                if ( _.isUndefined( businessObjectToSelectionMap[uniqueKey] ) ) {
                    businessObjectToSelectionMap[uniqueKey] = {};
                    subjectSelectionMap[uniqueKey] = {};
                    conditionSelectionMap[uniqueKey] = {};
                    multiVariantsSelectionMap[uniqueKey] = {};
                }
                businessObjectToSelectionMap[uniqueKey] = nodeIDToObject;// _.assign( businessObjectToSelectionMap[uniqueKey], nodeIDToObject );
                if ( configExprSection.expressionType === 18 ) {
                    multiVariantsSelectionMap[uniqueKey] = nodeIDToObject; //_.assign( multiVariantsSelectionMap[uniqueKey], nodeIDToObject );
                }
            } );


            // Create column
            let columnProps = {
                gridID: gridID,
                propertyName: boKey,
                propertyDisplayName: displayName,
                propertyUid: boKey,
                sourceType: sourceType,
                originalColumnName: boKey,
                isSplitColumn: splitColumnKeys.length > 0,
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

                columnSplitIDsMap[boKey].push( splitColumnKey );
                columnProperties.push( columnProps );
            } );
        } );
    } else {
        // This is for business object with no expression authored yet
        businessObjectToSelectionMap[boKey] = {};
        subjectSelectionMap[boKey] = {};
        conditionSelectionMap[boKey] = {};
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
            isExpressionNonGridable: undefined
        };
        columnProperties.push( columnProps );
    }
    return { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap, subjectSelectionMap, conditionSelectionMap, multiVariantsSelectionMap };
};

//Future Scope
// eslint-disable-next-line no-unused-vars
export let handleStartEdits = ( multiVariantsEditHandler ) => {
    //TODO: Need to implement as part of future scope
};

//Future Scope
// eslint-disable-next-line no-unused-vars
export let callSaveEditsPostActionsOnEditHandler = ( multiVariantsEditHandler ) => {
    //TODO: Need to implement as part of future scope
};

//Future Scope
// eslint-disable-next-line no-unused-vars
export let enforceStartEdits = ( multiVariantsEditHandler ) => {
    //TODO: Need to implement as part of future scope
};

/**
 * Compare SVRs as per the option selected: similar, identical or different and updates the vmos.
 * In the highlight mode, it highlights the differences on the vmo without removing the nodes.
 * @param {Object} multipleVariantsGridData atomic data
 * @param {Object} treeDataProvider data provider
 * @param {Integer} isSimilarCodeAttempt event code for the type of comparison
 * @param {Object} originalVmos originalVmos
 * @param {Boolean} shouldHighlight if we should highlight the differences on the vmo
 * @param {String} currentActiveDisplayMode current active display mode
 * @param {Object} gridSettings grid settings
 * @returns {Object} new and old vmos
 */
export let compareSVRs = ( multipleVariantsGridData, treeDataProvider, isSimilarCodeAttempt, originalVmos, shouldHighlight, currentActiveDisplayMode, gridSettings ) => {
    let gridData = { ...multipleVariantsGridData.getAtomicData() };
    let mapOfRows = {};
    const similarUserSelections = [ 1, 5, 9 ];
    const similarUserDeselections = [ 2, 6, 10 ];
    // only interested in svr columns
    const columnNames = _getSvrColumnNames( treeDataProvider.columnConfig.columns );

    //depending on the gridSettingsValue the similar code needs to adjust: i.e a similar of 0 with gridSettings includeSeverity will mean actually identical
    let isSimilarCode = isSimilarCodeAttempt;
    //different with severity: the definition of different is either !isSimilar or !isIdentical depending on the situation
    //for now we are required to treat the case depending on the gridSettings include severity or not
    if ( gridSettings.includeSeverityInComparison ) {
        if ( isSimilarCode === 0 ) {
            isSimilarCode = 1;
        } else if ( isSimilarCode === 2 ) {
            isSimilarCode = 3;
        }
    }

    //build the mapOfRows with similarity flags
    _.forEach( gridData.businessObjectToSelectionMap, ( variant ) => {
        _.forEach( variant, ( selection, selectionKey ) => {
            //you need additional logic for unconfigured, because the for the same selection in an unconfigured SVR and a configured in SVR you will
            //get 2 entries with different selectionKeys: path.family.text and path.feature but they are meant to be compared in the same
            //row, they are not de facto different nodes
            if ( _.get( selection, 'props.isUnconfigured.0' ) === 'true' ) {
                let existingNodeKeyWithRealUid = pca0CommonUtils.getExistingNodeKeyWithRealUid( gridData.businessObjectToSelectionMap, selection, selectionKey );
                if ( existingNodeKeyWithRealUid ) {
                    selectionKey = existingNodeKeyWithRealUid;
                }
            }
            if ( !mapOfRows[selectionKey] ) {
                mapOfRows[selectionKey] = { selections: [], isSimilar: false, isIdentical: false, isEmpty: false };
            }
            mapOfRows[selectionKey].selections.push( selection.selectionState );
        } );
    } );

    _.forEach( mapOfRows, ( selectionRow ) => {
        let selections = selectionRow.selections;
        const sameUserSelections = _numbersMatchPresetValues( selections, similarUserSelections );
        const sameUserDeselections = _numbersMatchPresetValues( selections, similarUserDeselections );
        //all selected ones have to have a matching value (unselected do not show up in the businessObjectToSelectionMap)
        if ( selections.length === 0 ) { //none have selections
            selectionRow.isEmpty = true;
        } else {
            if ( selections.length === Object.keys( gridData.businessObjectToSelectionMap ).length ) {
                if ( sameUserSelections || sameUserDeselections ) {
                    selectionRow.isSimilar = true;
                }
                let isSame = new Set( selections ).size === 1;
                selectionRow.isIdentical = isSame;
            }
        }
    } );

    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    //only keep the former current/all if the highlight mode is not on - it is only meant to transition correctly between the similar/different options
    if ( !shouldHighlight && originalVmos && originalVmos.length > 0 ) {
        vmos = [ ...originalVmos ];
    }

    let updatedVmos = [ ...vmos ];
    //change the active compare mode only if we are not highlighting. If we do so, we keep the current mode
    let activeCompareModes = [ 0, 1, 2, 3 ].map( n => n === 0 || n === 1 ? 'similar' : 'different' );
    let activeCompareMode = shouldHighlight ? currentActiveDisplayMode : activeCompareModes[isSimilarCode];
    //build the remaining list so we can remove the rest
    let remainingVmosAlternateUids = [];
    updatedVmos.forEach( vmo => {
        let empty = mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].isEmpty;
        let isSelectedFamily = vmo.isFamily && mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].selections.some( item => typeof item === 'number' );
        if ( vmo.isFamily && !isSelectedFamily ) {
            // Filter vmo.props to keep only the properties listed in columnNames and "VariabilityContent"
            const colProps = _.pick( vmo.props, columnNames );
            //Family - check if all the values across the svr's are the same
            let famSelections = _.map( colProps, prop => _.pick( prop, [ 'uiValue' ] ).uiValue );
            let isSameFam = new Set( famSelections ).size === 1;
            let isEmptyFam = isSameFam && ( famSelections[0] === '' || famSelections[0] === 0 );
            if ( !isEmptyFam && ( isSameFam && ( isSimilarCode === 1 || isSimilarCode === 0 ) || !isSameFam && ( isSimilarCode === 2 || isSimilarCode === 3 ) ) ) {
                remainingVmosAlternateUids.push( vmo.alternateID );
                if ( shouldHighlight ) {
                    _.set( vmo, 'highlight', true );
                }
                let parentNodesUids = _getAllParentVmosAlternateUids( vmo.alternateID );
                parentNodesUids.forEach( uid => {
                    remainingVmosAlternateUids.push( uid );
                } );
            }
        } else if ( empty === false ) {
            let similarToLookFor = false;
            switch ( isSimilarCode ) {
                case 1:
                    //identical
                    similarToLookFor = mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].isIdentical;
                    break;
                case 2:
                    //different
                    similarToLookFor = !( mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].isSimilar );
                    //the definition of different is either !isSimilar or !isIdentical depending on the situation
                    //for now we are required to treat the case depending on the gridSettings include severity or not
                    break;
                case 3:
                    //different with severity: the definition of different is either !isSimilar or !isIdentical depending on the situation
                    //for now we are required to treat the case depending on the gridSettings include severity or not
                    similarToLookFor = !( mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].isIdentical );
                    break;
                default:
                    //similar
                    similarToLookFor = mapOfRows[vmo.alternateID] && mapOfRows[vmo.alternateID].isSimilar;
                    break;
            }
            if ( similarToLookFor ) {
                remainingVmosAlternateUids.push( vmo.alternateID );
                let parentNodesUids = _getAllParentVmosAlternateUids( vmo.alternateID );
                parentNodesUids.forEach( uid => {
                    remainingVmosAlternateUids.push( uid );
                    if ( shouldHighlight ) {
                        _.set( vmo, 'highlight', true );
                    }
                } );
            }
        }
    } );
    //remove all but the picked remaining obj
    if ( updatedVmos ) {
        if ( !shouldHighlight ) {
            _.remove( updatedVmos, function( vmo ) {
                if ( vmo.alternateID && !remainingVmosAlternateUids.includes( vmo.alternateID ) ) {
                    return true;
                }
            } );
        }
        treeDataProvider.update( updatedVmos );
    }
    if ( shouldHighlight ) {
        gridData.highlightedVmos = remainingVmosAlternateUids;
        multipleVariantsGridData.setAtomicData( gridData );
    }
    return {
        activeCompareMode: activeCompareMode,
        beforeCompareVmos: [ ...vmos ],
        comparisonVmos: [ ...updatedVmos ],
        highlightMode: shouldHighlight
    };
};


/**
 * Resets the Vmos To Before Compare State to facilitate another compare
 * @param {UwDataProvider} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Array} originalVmos to restore
 * @param {String} lastServerLoadAction last action
 * @returns {Object} new state
 */
export let clearCompareResult = function( treeDataProvider, originalVmos, lastServerLoadAction ) {
    if ( originalVmos && originalVmos.length > 0 ) {
        treeDataProvider.update( [ ...originalVmos ] );
    }
    return {
        beforeCompareVmos: [],
        activeCompareMode: lastServerLoadAction ? lastServerLoadAction : 'current'
    };
};

/**
 * De-Highlight the differences on the VMOs by resetting the highlight flag and the highlightedVmos on gridData
 * @param {Object} gridAtomicData - Grid Data
 * @param {UwDataProvider} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Object} displayMode - Display Mode
 * @returns {Boolean}  false to set the displayMode.highlightMode
 */
export let deHighlightDifferences = function( gridAtomicData, treeDataProvider, displayMode ) {
    if ( !displayMode.highlightMode ) {
        return false;
    }
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let updatedVmos = [ ...vmos ];
    updatedVmos.forEach( vmo => {
        if ( vmo.highlight ) {
            _.set( vmo, 'highlight', false );
        }
    } );
    treeDataProvider.update( updatedVmos );
    //cleanup the highlightedVmos
    let gridData = { ...gridAtomicData.getAtomicData() };
    gridData.highlightedVmos = undefined;
    gridAtomicData.setAtomicData( gridData );

    return false;
};

/**
 * Initialize required details
 * @param {Object} declViewModel - VM Object
 * @param {String} gridId - grid ID.
 * @param {Object} gridOptions - grid options.
 * @param {boolean} useVerticalColumnHeader - Whether to use vertical column headers.
 */
export let initMultiSVRGridEditor = ( declViewModel, gridId, gridOptions, useVerticalColumnHeader ) => {
    pca0MultiSVRSaveCancelEditsService.initGridEditor( declViewModel );
    // This function updates the grid options based on the header display mode change.
    pca0ConfiguratorExplorerCommonUtils.initializeEnableHeaderResizingOnGrid( gridId, gridOptions, useVerticalColumnHeader );
};


/**
 * Shows info popup message if no similarities or differences
 * @param {Object} comparedVmos - ComparedVMOs
 * @param {Integer} isSimilarCode - provides int value as per comparision
 */
export let showNoSimilaritiesOrDifferencesMessage = ( comparedVmos, isSimilarCode ) => {
    //Show info popup if there is no similarities and differences.
    const _localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    if ( comparedVmos.length === 0 ) {
        let message = ' ';
        if ( isSimilarCode === 0 ) {
            message = _localeTextBundle.noSimilarities;
        } else if ( isSimilarCode === 2 ) {
            message = _localeTextBundle.noDifferences;
        }
        configuratorUtils.showNotificationMessage( message, 'INFO' );
    }
};

/**
 * Set the new compare mode
 * @param {Boolean} isSimilarCode - isSimilarCode
 * @returns {Object} activeCompareMode
 */
export let setNewCompareMode = ( isSimilarCode ) => {
    //0 and 1 are similar and similar incl. severity (aka identical), 2 and 3 are different and different incl. severity
    let activeCompareModes = [ 0, 1, 2, 3 ].map( n => [ 'similar', 'similar', 'different', 'different' ][n] );
    let activeCompareMode = activeCompareModes[isSimilarCode];
    return {
        activeCompareMode: activeCompareMode
    };
};

/**
 * Remove duplicate unconfigured families from the tree nodes
 * @param {Array} treeNodes - Tree nodes
 * @returns {Array} treeNodes - updated tree nodes
 */
export let removeDuplicateUnconfigFamiliesAndFeatures = ( treeNodes ) => {
    const partiallyUnconfiguredNodes = treeNodes.filter( node => node.isPartiallyUnconfigured !== undefined && Array.isArray( node.isPartiallyUnconfigured ) && node.isPartiallyUnconfigured.length > 0 );
    let listOfUnconfiguredFamilyNodes = [];

    partiallyUnconfiguredNodes.forEach( partiallyUnconfiguredNode => {
        let matchingNode;
        const familyNamespace = _.get( partiallyUnconfiguredNode, 'props.cfg0FamilyNamespace.dbValue.0' );
        matchingNode = treeNodes.find( node =>
            partiallyUnconfiguredNode !== node &&
            node.parentUID === partiallyUnconfiguredNode.parentUID &&
            node.nodeUid === `${familyNamespace}:${partiallyUnconfiguredNode.displayName}`
        );
        if ( !matchingNode ) {
            matchingNode = treeNodes.find( node =>
                partiallyUnconfiguredNode !== node &&
                node.parentUID === partiallyUnconfiguredNode.parentUID &&
                node.nodeUid === `${partiallyUnconfiguredNode.parentUID}:${partiallyUnconfiguredNode.displayName}`
            );
        }
        if ( matchingNode ) {
            listOfUnconfiguredFamilyNodes.push( matchingNode );
        }
    } );
    //remove all such nodes
    listOfUnconfiguredFamilyNodes.forEach( node => {
        variabilityTreeDisplayService.removeNodeFromTree( treeNodes, node );
        if ( node.children && node.children.length > 0 ) {
            node.children.forEach( child => {
                variabilityTreeDisplayService.removeNodeFromTree( treeNodes, child );
            } );
        }
    } );

    return treeNodes;
};

/**
 * Delay handling soa call to allow the addition of more than one SVR at the time. Not doing it shoots multiple calls to the server and
 * given the logic we have to recognize new and added SVRs, it will not work properly evtl
 */
export let delayHandlingOfPrimarySelectionChange = _.debounce( function() {
    eventBus.publish( 'Pca0MultiVariantsGrid.handlePrimarySelectionChangeAfterTimer' );
}, 500 );

/**
 * This function processes the response, updates ctx with multiVariantPerspective in case of setProperties soa
 * and returns the multiVariantPerspective.
 * @param {Object} response soa response
 * @param {Object} operationName setProperties or getProperties
 * @returns {Object} multiVariantPerspective from response
 */
export let getConfigPerspectiveFromServerResponse = ( response, operationName ) => {
    let multiVariantPerspective;
    let contextKey = veConstants.CONFIG_CONTEXT_KEY;
    if ( operationName === 'setProperties' && response.ServiceData.modelObjects ) {
        multiVariantPerspective = Object.values( response.ServiceData.modelObjects ).find( modelObject => modelObject.type === 'Cfg0ConfiguratorPerspective' );
    } else if ( response.modelObjects ) {
        multiVariantPerspective = Object.values( response.modelObjects ).find( modelObject => modelObject.type === 'Cfg0ConfiguratorPerspective' );
    }
    //update context with multiVariantPerspective
    appCtxService.updatePartialCtx( contextKey + '.modulePerspectiveForMultiVariants', multiVariantPerspective );
    return multiVariantPerspective;
};

/**
 * Updates data provider and the related businessObjectToSelectionMap with the expressions from the soaResponse obtained after expand or other VCV3 calls
 * @param {Object} vmo the vmo
 * @param {Object} violationsInfo the violationsInfo
 * @param {String} currentSVRUid the svr uid
 * @param {Object} violationSeverityIndicatorImgMap the violationSeverityIndicatorImgMap
 */
export let reflectViolationOnDataProviderForVmo = ( vmo, violationsInfo, currentSVRUid, violationSeverityIndicatorImgMap ) => {
    if ( violationsInfo ) {
        // This tells what should be the indicator icon for the violation to be shown
        // at feature level.
        _.set( vmo.props[currentSVRUid], 'indicators', [ {
            type: 'violation',
            tooltip: violationsInfo.violationMessage,
            image: violationSeverityIndicatorImgMap[violationsInfo.violationSeverity] + '16.svg'
        } ] );
    } else {
        //remove
        _.set( vmo.props[currentSVRUid], 'indicators', undefined );
    }
};

/**
 * toggles the SingleSVR view, set the atomic data for it on the wrapper
 * @param {Object} singleSVRViewModeAtomicData atomic data
 * @param {Boolean} isListViewMode  isListViewMode
 */
export let toggleSingleSVRView = ( singleSVRViewModeAtomicData, isListViewMode ) => {
    let singleSVRViewMode = singleSVRViewModeAtomicData.getValue ? { ...singleSVRViewModeAtomicData.getValue() } : { ...singleSVRViewModeAtomicData.getAtomicData() };

    if ( isListViewMode !== singleSVRViewMode.isListView ) {
        singleSVRViewMode.isListView = isListViewMode;
        // Dispatch changes on Variability Props
        singleSVRViewModeAtomicData.update ? singleSVRViewModeAtomicData.update( singleSVRViewMode ) : singleSVRViewModeAtomicData.setAtomicData( singleSVRViewMode );
    }
};

/**
 * Update ViewModel Collection for the Data Provider and update Column Config
 * Add new  NewVariant in the props list of each ViewModel Object node
 * @param {Object} variabilityProps variabilityProps
 * @param {Object} gridData Atomic Data defined for the ViewModel
 */
export let updateAndColorifyDirtyElements = function( variabilityProps, gridData ) {
    pca0MultiSVRGridEditorHeaderService.unColorifyMultiSVRHeaderCells( variabilityProps );
    let elemToColor = [ ...variabilityProps.dirtyElements, ...variabilityProps.newVariants ];
    variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
        // For multiple variants in grid selection changes, keep on collecting updated variants.
        variabilityProps.dirtyElements, // currentDirtyElements
        gridData.businessObjectToSelectionMap, // selection map
        gridData.backupOfBusinessObjectToSelectionMap // backup selection map
    );

    elemToColor.forEach( dirtyElement => {
        let title = variabilityProps.columnProperties.find( columnProp => { return columnProp.propertyName === dirtyElement; } ).propertyDisplayName;
        if ( !title ) {
            title = dirtyElement;
        }
        pca0RendererService.colorifyHeaderCell( title,
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
            veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID );
    } );
};

/**
 * Update ViewModel Collection for the Data Provider and update Column Config
 * Add new  NewVariant in the props list of each ViewModel Object node
 * @param {Object} newColumnProps newColumnProps
 * @param {Object} vmGridSelectionState vmGridSelectionState
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {Object} gridSettings grid settings
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let createNewColumnFromColumnProps = function( newColumnProps, vmGridSelectionState, treeDataProvider, gridSettings ) {
    let newColumnDef = pca0VariabilityTreeDisplayService.createColumnDef(
        newColumnProps,
        veConstants.CONFIG_CONTEXT_KEY,
        treeDataProvider,
        vmGridSelectionState,
        true // Skip Cell Renderer
    );
    let width = gridSettings.columnWidth;
    newColumnDef.columnWidth = width;
    newColumnDef.width = width;
    newColumnDef.maxWidth = pca0CommonConstants.GRID_CONSTANTS.MAX_COLUMN_WIDTH;
    newColumnDef.minWidth = pca0CommonConstants.GRID_CONSTANTS.COMPACT_COLUMN_WIDTH;

    return newColumnDef;
};

/**
 * Creates and adds a NewVariant (pure client column) column to the grid,
 * in the props list of each ViewModel Object node, updates the gridData and the treeDataProvider
 * @param {Object} soaResponse response from SOA
 * @param {Object} vmData all Atomic Data defined for the ViewModel
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {Object} gridSettings grid settings
 * @param {Object} eventData eventData
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let addNewVariantToGrid = function( soaResponse, vmData, treeDataProvider, gridSettings, eventData ) {
    let variabilityProps = { ...vmData.variabilityProps.getAtomicData() };
    let gridData = { ...vmData.multipleVariantsGrid.getAtomicData() };
    // create a custom variant uis that is unique for internal handling and since in the future we need more of them
    let newVariantUid = eventData.newColumnVmo.sourceUid;
    let displayNameNewVariant = eventData.newColumnVmo.propertyDisplayName;
    let vmGridSelectionState = vmData.gridSelectionState;

    let newColumnProps = _.cloneDeep( variabilityProps.columnProperties[0] );
    newColumnProps.originalColumnName = newVariantUid;//i.e. 'NewVariant1';
    newColumnProps.propertyName = newVariantUid;
    newColumnProps.displayName = displayNameNewVariant;
    newColumnProps.propertyDisplayName = displayNameNewVariant;
    newColumnProps.propertyUid = newVariantUid;
    newColumnProps.uid = newVariantUid;
    newColumnProps.name = newVariantUid;
    newColumnProps.sourceType = _getNewVariantType(); //'VariantRule' but it can be criteria if preference set as such;
    newColumnProps.isSplitColumn = false;//no split columns for new variants

    let newColumnDef = exports.createNewColumnFromColumnProps( newColumnProps, vmGridSelectionState, treeDataProvider, gridSettings );
    // Add new column to the gridData.viewModelObjectMap and selected expressions
    gridData.viewModelObjectMap[newVariantUid] = eventData.newColumnVmo;
    if ( !variabilityProps.soaResponse.selectedExpressions ) {
        variabilityProps.soaResponse.selectedExpressions = [];
    }
    variabilityProps.soaResponse.selectedExpressions[newVariantUid] = [];

    // Set cell Renderers
    let cellRenderer = _getColumnCellRenderer( pca0GridAuthoringService.handleCellClick, treeDataProvider, vmGridSelectionState, veConstants.CONFIG_CONTEXT_KEY );
    _setColumnCellRenderer( newColumnDef, newColumnProps, cellRenderer );

    // Add new column after VariabilityContent and Property Column(s), if any.
    let propColumnIdxs = [];
    treeDataProvider.columnConfig.columns.forEach( columnDef => {
        if ( columnDef.isPropertyColumn || columnDef.isColumnFromCots ) {
            propColumnIdxs.push( _.indexOf( treeDataProvider.columnConfig.columns, columnDef ) );
        }
    } );
    let lastPropertyColumnIdx = _.isEmpty( propColumnIdxs ) ? 0 : _.max( propColumnIdxs );
    treeDataProvider.columnConfig.columns.splice( lastPropertyColumnIdx + 1, 0, newColumnDef );
    variabilityProps.columnProperties.splice( lastPropertyColumnIdx + 1, 0, newColumnDef );
    let propInfoVariabilityNodes = soaResponse.variabilityTreeData;// regardless what the nodes were before, the new variant always brings them all back
    //add new vmo to the response so it behaves like any other column
    variabilityProps.soaResponse.viewModelObjectMap[newVariantUid] = eventData.newColumnVmo;
    let columnPropsAndSelectionMapResult = exports.getColumnPropsAndSelectionMapForSVR(
        'multipleVariantsConfigGrid',
        variabilityProps.soaResponse,
        newVariantUid,
        gridData.businessObjectToSelectionMap
    );

    let treeData = {};
    gridData.variabilityNodes = _.cloneDeep( gridData.variabilityNodes ); //todo not sure we do need to clone here
    gridData.viewModelObjectMap = _.cloneDeep( gridData.viewModelObjectMap );
    exports.updateBusinessObjectToSelectionMap( gridData, columnPropsAndSelectionMapResult.businessObjectToSelectionMap, true );
    treeData = { ...gridData };

    treeData.gridNodes = [ '' ];
    treeData.variabilityNodes = propInfoVariabilityNodes;
    treeData.viewModelObjectMap = variabilityProps.soaResponse.viewModelObjectMap;
    //update vmos in treeDataProvider
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    vmos.forEach( vmo => {
        // Add value 0 by default for all props[newVariant]
        vmo.props[newVariantUid] = pca0CommonUtils.getViewModelProperty( newVariantUid, vmo.nodeUid, 0, {} );
    } );
    // Add newVariant to the newVariants list
    variabilityProps.newVariants.push( newVariantUid );
    //seal in the updates
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );
    vmData.variabilityProps.setAtomicData( variabilityProps );
    vmData.multipleVariantsGrid.setAtomicData( treeData );
    treeDataProvider.update( vmos );
    return {
        ...treeDataProvider.columnConfig,
        columns: [ ...treeDataProvider.columnConfig.columns ]
    };
};

/**
 * This method used to activate the command panel in fsc to save new svr/Variant Criteria or
 * update the saved svr/Variant Criteria.
 * @param {Object} eventData eventData
 * @param {Object} variabilityProps variabilityProps
 * @param {Object} fetchedActiveSettings fetchedActiveSettings for the variant
 */
export let openSaveAsPanel = function( eventData, variabilityProps, fetchedActiveSettings ) {
    const { dialogAction } = eventData.scope.commandContext;
    let title = _localeTextBundleOfCommonMessages.saveAsCmd;
    let panelContext = { ...eventData.scope.commandContext, panelTitle: title };
    panelContext.createVariantPreference = _getNewVariantType();

    const activeSettingsForVariant = _.get( fetchedActiveSettings, eventData.columnUid );
    const savedConfigPerspective = activeSettingsForVariant.configPerspective;

    panelContext.configuratorPerspective = savedConfigPerspective;
    panelContext.selectedExpressionsToSaveAsString = exports.getSelectedExpressionsToSave( variabilityProps, [ eventData.columnUid ] );
    panelContext.profileSettings = activeSettingsForVariant;
    panelContext.newVariantUid = eventData.columnUid; //we need to preserve the former columnUid in order to be able to replace it on the fly with the saved one
    panelContext.showAttachmentChoice = false; //we never show attachment to bom in variants tab context
    panelContext.showFromSection = true;
    panelContext.shouldAppendToSelection = true;

    let options = {
        view: 'Pca0FSCSaveVariantRule',
        placement: 'right',
        width: 'SMALL',
        height: 'FULL',
        parent: '.aw-layout-workarea',
        isCloseVisible: false,
        subPanelContext: panelContext
    };

    //Open the dialog
    dialogAction.show( options );
};

/**
 * This method is used to activate the command panel to add a new column
 * update the saved svr/Variant Criteria.
 * @param {Object} eventData eventData
 */
export let openAddNewColumnPanel = function( eventData ) {
    const { dialogAction } = eventData.scope.commandContext;
    let panelContext = { ...eventData.scope.commandContext };
    let type = _getNewVariantType(); //'VariantRule';
    panelContext.createVariantPreference = type;
    panelContext.type = type;
    let options = {
        view: 'Pca0GridEditorAddNewColumn',
        placement: 'right',
        width: 'SMALL',
        height: 'FULL',
        parent: '.aw-layout-workarea',
        isCloseVisible: false,
        subPanelContext: panelContext
    };

    //Open the dialog
    dialogAction.show( options );
};

/**
 * Removes variant from the data: the businessObjectToSelectionMap and backup, the variabilityProps and the newVariant array as this is targetted for newVariants for now
 * The caller has to update the atomic data passed in in the params
 * @param {Object} gridData gridData
 * @param {Object} variabilityProps variabilityProps
 * @param {String} newVariantUid new variant uid
 */
export let removeVariantFromGridData = function( gridData, variabilityProps, newVariantUid ) {
    delete gridData.businessObjectToSelectionMap[newVariantUid];
    delete gridData.backupOfBusinessObjectToSelectionMap[newVariantUid];
    let toRemoveColPropIndex = variabilityProps.columnProperties.findIndex( columnDef => columnDef.name === newVariantUid );
    variabilityProps.columnProperties.splice( toRemoveColPropIndex, 1 );
    delete variabilityProps.soaResponse.viewModelObjectMap[newVariantUid];
    delete variabilityProps.soaResponse.selectedExpressions[newVariantUid];
    let toRemoveNewVariantIndex = variabilityProps.newVariants.findIndex( uid => uid === newVariantUid );
    if ( toRemoveNewVariantIndex !== -1 ) {
        variabilityProps.newVariants.splice( toRemoveNewVariantIndex, 1 );
    }
    let dirtyNewVariantIndex = variabilityProps.dirtyElements.findIndex( uid => uid === newVariantUid );
    if ( dirtyNewVariantIndex !== -1 ) {
        variabilityProps.dirtyElements.splice( dirtyNewVariantIndex, 1 );
    }
};

/**
 * Removes new  NewVariant in the props list of each ViewModel Object node
 * @param {Object} vmData all Atomic Data defined for the ViewModel
 * @param {UwDataProvider} treeDataProvider DataProvider to be initialized/loaded
 * @param {String} newVariantColumnUid new variant column uid
 * @param {Object} fetchedActiveSettings fetchedActiveSettings for the variant
 * @returns {Object} columnConfig - column config of tree data provider
 */
export let removeVariantFromGrid = function( vmData, treeDataProvider, newVariantColumnUid, fetchedActiveSettings ) {
    let variabilityProps = { ...vmData.variabilityProps.getAtomicData() };
    let gridData = { ...vmData.multipleVariantsGrid.getAtomicData() };
    //remove from data
    exports.removeVariantFromGridData( gridData, variabilityProps, newVariantColumnUid );
    //remove from tdp
    let toRemoveColIndex = treeDataProvider.columnConfig.columns.findIndex( columnDef => columnDef.name === newVariantColumnUid );
    treeDataProvider.columnConfig.columns.splice( toRemoveColIndex, 1 );
    //remove from fetchedActiveSettings
    if ( fetchedActiveSettings ) {
        delete fetchedActiveSettings[newVariantColumnUid];
    }
    vmData.variabilityProps.setAtomicData( variabilityProps );
    vmData.multipleVariantsGrid.setAtomicData( gridData );

    return {
        ...treeDataProvider.columnConfig,
        columns: [ ...treeDataProvider.columnConfig.columns ]
    };
};


/**
 * The new variants are client only entities, before they can set expressions like every other svr they will need to exist on server
 * this function createdsthem analog to the save variant dlg
 * SOA call is made to save selected expressions and taking care of post save actions
 * @param {Object} vmo - View Model Object
 */
export const createNewVariant = async( vmo ) => {
    let compoundCreateInput = {};
    if ( vmo.id ) {
        compoundCreateInput = {
            wso_thread: [
                {
                    boName: vmo.sourceType + 'Thread',
                    propertyNameValues: {
                        fnd0ThreadId: [ vmo.id ]

                    }
                }
            ]
        };
    }
    let createInput = [ {
        clientId: 'CreateObject',
        createData: {
            boName: vmo.sourceType,
            propertyNameValues: {
                object_name: [ vmo.displayName ],
                object_desc: [ vmo.description ? vmo.description : '' ]
            },
            compoundCreateInput: compoundCreateInput
        },
        dataToBeRelated: {},
        pasteProp: '',
        workflowData: {}
    } ];
    const soaResponse = await dmSvc.createRelateAndSubmitObjects( createInput );
    let svrCreated;
    if ( soaResponse.ServiceData.created ) {
        let variantRuleUID = soaResponse.ServiceData.created[0];
        svrCreated = soaResponse.ServiceData.modelObjects[variantRuleUID];
    } else if ( soaResponse.ServiceData.partialErrors ) {
        // Process partial errors
        pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
    }
    return svrCreated;
};

/**
 * The new variants are client only entities, before they can set expressions like every other svr they will need to exist on server
 * this function creates them and sets their expressions analog to the save variant dlg
 * If a new Variant expressions save is not successful, the new variant will save empty expressions
 * SOA call is made to save selected expressions and taking care of post save actions
 * @param {Object} vmData - View Model Atomic Data
 * @param {Object} baseSelection - baseSelection
 * @param {String} newVariantVmo - New Variant VMO
 * @param {Object} profileSettingsForSoaCall - Profile Settings
 * @param {Object} treeDataProvider - DataProvider
 * @param {String} columnUid - Column UID
 */
export const saveNewVariant = async( vmData, baseSelection, newVariantVmo, profileSettingsForSoaCall, treeDataProvider, columnUid ) => {
    let variabilityProps = { ...vmData.variabilityProps.getAtomicData() };
    let gridData = { ...vmData.multipleVariantsGrid.getAtomicData() };
    let createdSVR = await exports.createNewVariant( newVariantVmo ); //store the result in a map for expressions saving
    let createdSVRUid = createdSVR.uid;
    _postProcessSaveNewVariant( createdSVR, newVariantVmo.sourceUid, variabilityProps, gridData );
    //clean all new variants dirty elements to avoid popping of the save dialog
    variabilityProps.dirtyElements = variabilityProps.dirtyElements.filter( variant => !variabilityProps.newVariants.includes( variant ) );
    variabilityProps.newVariants = variabilityProps.newVariants.filter( variant => variant !== newVariantVmo.sourceUid );
    variabilityProps.formerNewVariantUids.unshift( createdSVRUid ); //all those columns need to be up front in the grid, formerNewVariantUids is used to keep track of them
    if ( columnUid ) {
        variabilityProps.savingOfNewVariant = true; //need to know that the next soa call is due to single newVariant saving)
    }
    vmData.variabilityProps.setAtomicData( variabilityProps );
    let expressionsToSave = exports.getSelectedExpressionsToSave( vmData, [ createdSVRUid ], true );
    let activeVariantRules = [];
    activeVariantRules.push( { uid: createdSVRUid, type: 'VariantRule' } );
    await exports.saveNewVariantExpressions( expressionsToSave, baseSelection, profileSettingsForSoaCall, activeVariantRules ).then( result => {
        //further processing: for each new variant: remove the client only column from the grid and update the primary area
        let colConfig = exports.removeVariantFromGrid( vmData, treeDataProvider, newVariantVmo.sourceUid );
        treeDataProvider.gridContextDispatcher( {
            type: 'COLUMN_CONFIG_UPDATE',
            columnConfig: colConfig
        } );
        eventBus.publish( 'Pca0SaveVariantRule.newVariantRuleCreated', { variantRule: activeVariantRules[0], attachVariantRuleToContent: false, formerNewVariantUids: newVariantVmo.sourceUid, shouldAppendToSelection: true } );
        pca0CommonUtils.addUidsOfNewSVRInSelectedObjectsOfSessionStorage( [ createdSVRUid ] );
    } );
};

/**
 * The new variants are client only entities, before they can set expressions like every other svr they will need to exist on server
 * this function createdsthem analog to the save variant dlg
 * SOA call is made to save selected expressions and taking care of post save actions
 *
 * @param {Object} vmData - View Model Atomic Data
 * @param {Object} baseSelection - baseSelection
 * @param {Object} treeDataProvider - DataProvider to be initialized/loaded
 * @param {Object} profileSettings - Profile Settings
 * @param {Object} eventData - Event Data
 */
export const saveNewVariants = async( vmData, baseSelection, treeDataProvider, profileSettings, eventData ) => {
    let variabilityProps = { ...vmData.variabilityProps.getAtomicData() };
    let profileSettingsForSoaCall = pca0CommonUtils.getProfileSettings( '', profileSettings );
    if ( eventData && eventData.columnUid ) {
        let newVariantVmo = variabilityProps.soaResponse.viewModelObjectMap[eventData.columnUid];
        if ( newVariantVmo ) {
            await exports.saveNewVariant( vmData, baseSelection, newVariantVmo, profileSettingsForSoaCall, treeDataProvider, eventData.columnUid );
        }
    } else {
        //we save all the new variants regardless of them having expressions or not
        variabilityProps.newVariants.map( async( newVariantUid ) => {
            let newVariantVmo = variabilityProps.soaResponse.viewModelObjectMap[newVariantUid];
            if ( newVariantVmo ) {
                await exports.saveNewVariant( vmData, baseSelection, newVariantVmo, profileSettingsForSoaCall, treeDataProvider );
            }
        } );
        appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false ); //only chnage the edit mode if saveAll
    }
};

/**
 * SOA call is made to save selected expressions
 * @param {Object} expressionsToSave - expressionsToSave
 * @param {Object} baseSelection - baseSelection
 * @param {Object} profileSettings - profileSettings
 * @param {Object} activeVariantRules - activeVariantRules
 */
export const saveNewVariantExpressions = async( expressionsToSave, baseSelection, profileSettings, activeVariantRules ) => {
    const modulePerspectiveCtx = appCtxService.getCtx( 'ConfiguratorCtx' );
    let cfgPerspective = modulePerspectiveCtx.modulePerspectiveForMultiVariants;
    let soaInput = {
        input: {
            selectedExpressions: expressionsToSave,
            configPerspective: cfgPerspective,
            activeVariantRules: activeVariantRules,
            selectedContext: {
                uid: baseSelection.uid,
                type: baseSelection.type
            },
            scopes: [],
            requestInfo: {
                requestType: [ 'createUpdateVariantRule' ],
                attachVariantRuleToContent: [ 'false' ],
                configurationControlMode: [ 'manual' ],
                expressionExpandedState: [ 'false' ],
                profileSettings: [ profileSettings ]
            }
        }
    };
    let response = await soaSvc.postUnchecked(
        'Internal-ProductConfiguratorAw-2022-12-ConfiguratorManagement',
        'variantConfigurationView3', soaInput );
    if ( response.ServiceData.partialErrors ) {
        // Process partial errors
        pca0CommonUtils.processPartialErrors( response.ServiceData );
    }
};

/**
 * Creates a new vmo of the type pased in by generting a unique intermediary client id and the name, description passed in,
 * //todo move to the commonGrid file Sounak is creating on 2506 branch
 * @param {String} type - type for vmo
 * @param {Object} xrtVMO - xrtVMO for vmo
 * @returns {Object} vmo
 */
export const createNewNamedColumn = ( type, xrtVMO ) => {
    let newColumnUid = 'NewVariant' + new Date().getTime();
    let displayName = xrtVMO.props.object_name.dbValue;
    let description = xrtVMO.props.object_desc.dbValue;
    let wso_ref = xrtVMO.props['REF(wso_thread,Cfg0VariantCriteriaThreadCreI).fnd0ThreadId'];
    let id = wso_ref ? wso_ref.dbValue : '';
    return {
        displayName: displayName,
        description: description,
        propertyDisplayName: displayName,
        sourceType: type,
        sourceUid: newColumnUid,
        id: id
    };
};


/**
 * The method will pop up the Confirmation for 'In order to expand variant, the system will move to the All Features view. Do you want to proceed?'
 * @param {String} currentSVRUid - current SVR Uid
 */
export let determineIfContinueExpand = function( currentSVRUid ) {
    let msg = _localeTextBundleOfExplorerMessages.confirmationToMoveToAllFeaturesBeforeExpand;
    let cancelString = _localeTextBundleOfExplorerMessages.cancel;
    let proceedString = _localeTextBundleOfExplorerMessages.continue;
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0MultiVariantsGrid.continueExpandAction', {
                currentSVRUid: currentSVRUid
            } );
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Checks if grid data load is required based on the current column configuration and sub-panel context.
 *
 * @param {UwDataProvider} gridDataProvider - DataProvider of the grid.
 * @param {Object} subPanelCtx - The subpanel Context received from parent component..
 * @returns {boolean} - Returns true if grid data load is required, otherwise false.
 */
export const isGridDataLoadNeeded = ( gridDataProvider, subPanelCtx ) => {
    const columnConfig = gridDataProvider.columnConfig;
    // If columnConfig is undefined, grid data load is required
    if ( !columnConfig ) {
        return true;
    }
    // Count the number of columns from COTS
    const currentSvrCount = columnConfig.columns.length - columnConfig.columns.filter( column => column.isColumnFromCots ).length;
    const maxVariantAllowed = subPanelCtx.gridSettings.getValue().loadVariantsMaxCountInGrid;
    return currentSvrCount <= maxVariantAllowed || subPanelCtx.selection.length <= currentSvrCount;
};

/**
 * Checks the current selection in the PWA and updates the view mode accordingly.
 * If the selection is empty or contains only one item of type 'Cfg0ProductItem', the view mode is switched to list view.
 * Updates the `singleSVRViewMode` atomic data to reflect the change in view mode.
 *
 * @param {Array} selection - The current selection in the PWA.
 * @param {Object} singleSVRViewMode - Atomic data representing the single SVR view mode.
 */
export const updateViewModeBasedOnSelection = ( selection, singleSVRViewMode ) => {
    //return if the singleSVRViewMode is not defined
    //this is the case when the user is in the grid from the BOM view
    if( !singleSVRViewMode ) {
        return;
    }
    let isNoSelection = _.isEmpty( selection ) || selection.length === 1 && selection[0].type === 'Cfg0ProductItem';
    if ( isNoSelection ) {
        let singleSVRViewModeValue = { ...singleSVRViewMode.getValue() };
        singleSVRViewModeValue.isListView = true;
        singleSVRViewMode.update( singleSVRViewModeValue );
    }
};

/**
 * Checks if single variant rule is not dirty and not more than 1 then returns shouldCreateCustomRule
 * @param {UwDataProvider} treeDataProvider - DataProvider of the grid.
 * @param {Object} vmVariabilityProps - The ViewModel atomic data
 * @returns {Object} - shouldCreateCustomRule and variantRuleForApplyConfiguration
 */
export let checkIfSingleVariantRuleAndNotDirty = ( treeDataProvider, vmVariabilityProps ) => {
    // Extract dirtyElements
    const { dirtyElements } = vmVariabilityProps.getAtomicData();

    // Filter rules loaded in the table
    const rulesLoadedInTable = treeDataProvider.cols.filter( col => !col.isTreeNavigation && col.originalColumnName === col.propertyName && ( col.sourceType === 'VariantRule' || col.sourceType === 'Cfg0VariantCriteria' ) );
    const ruleCount = rulesLoadedInTable.length;

    // If no rules are loaded
    if ( ruleCount === 0 ) {
        return { shouldCreateCustomRule: false, variantRuleForApplyConfiguration: null };
    }

    // If exactly one rule is loaded
    if ( ruleCount === 1 ) {
        // If there are dirty elements
        if ( dirtyElements.length > 0 ) {
            return { shouldCreateCustomRule: true, variantRuleForApplyConfiguration: null };
        }

        // Otherwise, use the single loaded rule's UID for configuration
        const variantRuleForApplyConfiguration = rulesLoadedInTable[0].uid;
        return { shouldCreateCustomRule: false, variantRuleForApplyConfiguration };
    }

    // If multiple rules are loaded, we should create a custom rule
    return { shouldCreateCustomRule: true, variantRuleForApplyConfiguration: null };
};

/**
 * Verifies if any family-level node in the tree data provider is expanded before exporting.
 *
 * @param {Object} treeDataProvider - The tree data provider containing the view model collection.
 * @returns {boolean} - Returns true if any family-level node is expanded, otherwise false.
 */
export let verifyExpandCollapseStateBeforeExport = ( treeDataProvider ) => {
    let isNodeExpanded = false;
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    for ( const vmo of vmos ) {
        if ( vmo.levelNdx === 0 && vmo.children?.length > 0 ) {
            isNodeExpanded = vmo.children.some( child => child.isExpanded );
            if ( isNodeExpanded ) {
                break;
            }
        }
    }
    return isNodeExpanded;
};

/**
 * Checks if dirtyElements contains something else than newVariants
 * @param {Object} vmVariabilityProps - The ViewModel atomic data
 * @returns {Boolean} - true if dirtyElements contains something else than newVariants
 */
export let checkIfDirtyExistingSVRs = ( vmVariabilityProps ) => {
    const { dirtyElements } = vmVariabilityProps.getAtomicData();
    return dirtyElements.some( dirtyElement => !dirtyElement.startsWith( 'NewVariant' ) );
};

/**
 * Update the expressionType values to 18
 * @param {Object} data - businessObjectToSelectionMap
 */
export let updateExpressionType = ( data ) => {
    if ( data.hasOwnProperty( 'expressionType' ) ) {
        data.expressionType = 18;
    }

    for ( let key in data ) {
        if ( data[key] && typeof data[key] === 'object' ) {
            updateExpressionType( data[key] );
        }
    }
};

/**
 * Removes entries from the selection map if their selection state is 0.
 * This is an interim function for the validate scenario, that fails in the server if it encounters 0 selections
 *
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @param {String} currentSVRUid - the current SVR
 */
export let removeEmptySelectionStates = ( businessObjectToSelectionMap, currentSVRUid ) => {
    for ( const [ key, value ] of Object.entries( businessObjectToSelectionMap[currentSVRUid] ) ) {
        if ( value.selectionState === 0 ) {
            delete businessObjectToSelectionMap[currentSVRUid][key];
        }
    }
};

/**
 * Remove the properties 'hasViolation' and 'violationsInfo' from the object
 * @param {Object} multipleVariantsGridData atomic data
 * @param {Object} columns of the column configuration
 * @param {String} currentSVRUid current SVR Uid
 */
export let removeViolationsForSoaInput = ( multipleVariantsGridData, columns, currentSVRUid ) => {
    let gridData = { ...multipleVariantsGridData.getAtomicData() };
    //results in original column plus all eventual split ones
    let splitColumns = pca0CommonUtils.getAllSplitColumnsForOriginalColumn( columns, currentSVRUid, true );
    let businessObjectToSelectionMapData = gridData.businessObjectToSelectionMap;

    // If the object has the properties 'hasViolation' and 'violationsInfo', delete them
    // Loop only over the split columns, only those violations will get removed
    splitColumns.forEach( col => {
        if ( businessObjectToSelectionMapData[col] ) {
            const item = businessObjectToSelectionMapData[col];

            // Check if the item contains the 'hasViolation' property and remove it along with 'violationsInfo'
            if ( item.hasViolation ) {
                delete item.hasViolation;
                delete item.violationsInfo;
            }

            // Check for nested objects within the item, and remove violations if present
            if ( typeof item === 'object' && item !== null ) {
                for ( let subKey in item ) {
                    const subItem = item[subKey];
                    if ( subItem.hasViolation ) {
                        delete subItem.hasViolation;
                        delete subItem.violationsInfo;
                    }
                }
            }
        }
    } );

    gridData.businessObjectToSelectionMap = businessObjectToSelectionMapData;
    multipleVariantsGridData.setAtomicData( gridData );
};

/**
 * Switches the BOM FSC grid to List view.
 *
 * - This option is available only when a single SVR is loaded.
 * - The toggle is accessible only when the grid is in BOM FSC.
 * - It is independent of the grid in the Variants tab (MultiSvrWrapper).
 * @param {Object} fscState - commandcontext passed in from command
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @param {Object} variantRuleData - variantRuleData
 * @param {Object} variabilityProps - variabilityProps
 */
export let showFscListView = ( fscState, businessObjectToSelectionMap, variantRuleData, variabilityProps ) => {
    let fscContext = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );

    let newFscState = {};
    newFscState = { ...fscState.getValue() };

    let newVariantRuleData = {};
    newVariantRuleData = { ...variantRuleData.getValue() };

    let vmVariabilityProps = { ...variabilityProps.getAtomicData() };

    // Do not proceed if List mode is active already
    if ( !newFscState.treeDisplayMode ) {
        return;
    }

    if ( !businessObjectToSelectionMap ) {
        return;
    }

    const nonGridableExpressionsList = [];
    if ( vmVariabilityProps.dirtyElements.length > 0 ) {
        pca0ExpressionGridService.removeZeroSelections( businessObjectToSelectionMap );
        newFscState.isGridDirty = true;
    }

    // Don't override selectedExpressions if it contains non-gridable expressions
    if ( nonGridableExpressionsList.length === 0 ) {
        pca0GridCommonUtils.resetNodeUidFromSelection( businessObjectToSelectionMap );
        fscContext.selectedExpressions = pca0ExpressionGridService.getPCAGridFromSelectionMap( businessObjectToSelectionMap );
    }

    // Initialize applied SVR: keep loaded SVR (ignore any selection from OccMgmt context)
    fscContext.currentAppliedVRs = [ newVariantRuleData.variantRulesToLoad ? newVariantRuleData.variantRulesToLoad[0].uid : newVariantRuleData.variantRuleData[0].uid ];
    // set treeDisplayMode is false as switching to list view
    newFscState.treeDisplayMode = false;
    fscContext.currentScope = '';
    appCtxService.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );

    // update the state of the parent and avoid having to use global context and events
    // isSwitchingFromGridToListView flag is true when configuration view is switched from grid to list view
    newFscState.isSwitchingFromGridToListView = true;
    // When switching from grid to list view and if grid view is dirty, then make variantRuleDirty as true
    newFscState.variantRuleDirty = newFscState.isGridDirty;
    fscState.update( newFscState );
};

/**
 * This method is used to get the existing node key for unconfigured value where the key evaluating ends in parentUId:displayName and the real node due to another
 * configured In value has a different id.
 * It is used in the context of partially unconfigured nodes, which refers to nodes that have an configuredIn svr and a configuredOut svr
 * and the need in the UI to represent those in a single node on the configuredIn svr. Ttherefore we often need to look up the real alternateID of the real node
 * in order to make updates on the column represented as "xxx:yyy:yyy:Sony" for example
 * @param {String} key - key
 * @param {Object} value - value
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @returns {String} - keyToConsider
 */
export let getExistingNodeKeyForUnconfiguredValue = ( key, value, businessObjectToSelectionMap ) => {
    let keyToConsider = key;
    if ( _.get( value, 'props.isUnconfigured.0' ) === 'true' ) {
        let existingNodeKeyWithRealUid = pca0CommonUtils.getExistingNodeKeyWithRealUid( businessObjectToSelectionMap, value, key );
        if ( existingNodeKeyWithRealUid ) {
            keyToConsider = existingNodeKeyWithRealUid;
        }
    }
    return keyToConsider;
};

/**
 * This method replaces takes care of replacement of the pasted selection from an unconfigured node uid that does not exist with a selection on the real vmo
 * @param {Object} businessObjectToSelectionMap - businessObjectToSelectionMap
 * @param {String} calcUnconfiguredAltUId - calcUnconfiguredAltUId
 * @param {Object} vmo - vmo
 * @param {String} columnUid - columnUid
 */
export let replacePastedSelectionFromUnconfiguredNode = ( businessObjectToSelectionMap, calcUnconfiguredAltUId, vmo, columnUid ) => {
    //if this is the case we will also need to delete the copied selection from the unconfigured node uid that does not exist on this svr
    //and add it into the one that does, otherwise upon changes on that node we migh get a mix of positive and negative values when saving
    businessObjectToSelectionMap[columnUid][vmo.alternateID] = businessObjectToSelectionMap[columnUid][calcUnconfiguredAltUId];
    businessObjectToSelectionMap[columnUid][vmo.alternateID].nodeUid = vmo.nodeUid; //the unconfigured has no nodeUid, so add the current one
    delete businessObjectToSelectionMap[columnUid][calcUnconfiguredAltUId];
    delete businessObjectToSelectionMap[columnUid][vmo.alternateID].props?.isUnconfigured;
};


/**
 * Handles the action to expand and show all families in the grid.
 * This function updates the grid data to reflect the expanded state of all families.
 *
 * @param {Object} multipleVariantsGridData - The atomic data for multiple variants grid.
 */
export let handleExpandForShowAllFamiliesAction = ( multipleVariantsGridData ) => {
    let gridData = { ...multipleVariantsGridData.getAtomicData() };
    gridData.expandAll = false;

    let familyExpansionMap = _buildFamilyExpansionMap( gridData.businessObjectToSelectionMap );
    let expansionMap = _buildExpansionMapForAllFamilies( gridData, familyExpansionMap );

    gridData.expansionMap = expansionMap;
    multipleVariantsGridData.setAtomicData( gridData );
};

/**
 * Displays a confirmation message for unloading the SVR.
 * This function shows a warning message with options to cancel or proceed with unloading the SVR.
 *
 * @param {Object} eventData - The event data to be passed when unloading the SVR.
 */
export let showConfirmationMessageForUnload = ( eventData ) => {
    const msg = configuratorUtils.getFscLocaleTextBundle().loadConfirmation;
    const cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    const proceedString = configuratorUtils.getFscLocaleTextBundle().load;
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0MultiVariantsGrid.unloadSVR', eventData );
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Updates data provider and the related businessObjectToSelectionMap with the expressions from the soaResponse obtained after expand or other VCV3 calls
 * @param {Object} soaResponse SOA response
 * @param {Object} vmData current view model
 */
export let updateVmosAndVariability = ( soaResponse, vmData ) => {
    let gridData = { ...vmData.multipleVariantsGrid.getAtomicData() };
    let variability = { ...vmData.variabilityProps.getAtomicData() };
    //for free forms there can be new ones after the expand, so we need to add them to the vmos, the selected expressions and the variability tree data
    // Merge the two object maps
    let uniqueObjectMap = soaResponse.viewModelObjectMap;
    if ( _.get( variability, 'soaResponse.viewModelObjectMap' ) ) {
        uniqueObjectMap = _uniquelyMergeMaps( soaResponse.viewModelObjectMap, variability.soaResponse.viewModelObjectMap, 'sourceUid' );
    }
    //ideally we get all objects but for ff in some cases like weights in volvo data we will only get the calc one and are supposed to keep the other node around but with no selection
    //so for now do a smart merge: if we find a parent in both old and new variability data, we merge the children, otherwise we just replace the old with the new
    variability.soaResponse.viewModelObjectMap = uniqueObjectMap;
    let newVariability = exports.mergeVariabilityDataForPotentialNewChildernUnderParent( variability.soaResponse.variabilityTreeData, soaResponse.variabilityTreeData );
    variability.variabilityTreeData = newVariability;
    variability.soaResponse.variabilityTreeData = newVariability;
    gridData.variabilityNodes = newVariability;
    gridData.viewModelObjectMap = uniqueObjectMap;
    vmData.multipleVariantsGrid.setAtomicData( gridData );
    vmData.variabilityProps.setAtomicData( variability );
};

/**
 * Merges the new variability tree data into the existing variability tree data.
 * If a node exists in both the old and new data, their children are merged.
 * Otherwise, the new node is added to the merged data.
 *
 * @param {Array} oldvariabilityTreeData - The existing variability tree data.
 * @param {Array} newvariabilityTreeData - The new variability tree data to be merged.
 * @returns {Array} The merged variability tree data.
 */
export let mergeVariabilityDataForPotentialNewChildernUnderParent = ( oldvariabilityTreeData, newvariabilityTreeData ) => {
    let mergedVariabilityTreeData = [ ...oldvariabilityTreeData ];
    newvariabilityTreeData.forEach( newVariabilityNode => {
        let existingNodeIndex = mergedVariabilityTreeData.findIndex( oldVariabilityNode => oldVariabilityNode.nodeUid === newVariabilityNode.nodeUid );

        if ( existingNodeIndex !== -1 ) {
            let existingNode = mergedVariabilityTreeData[existingNodeIndex];
            if ( existingNode.childrenUids && newVariabilityNode.childrenUids ) {
                existingNode.childrenUids = Array.from( new Set( [ ...existingNode.childrenUids, ...newVariabilityNode.childrenUids ] ) );
            } else if ( newVariabilityNode.childrenUids ) {
                existingNode.childrenUids = newVariabilityNode.childrenUids;
            }
        } else {
            mergedVariabilityTreeData.push( newVariabilityNode );
        }
    } );

    return mergedVariabilityTreeData;
};

/**
 * Checks if the cell selection is relevant for the current cell based on type.
 * In Multivariantsgrid we don't really care for anything else than family or feature selection from a functional perspective.
 * So handling the event can be unnecessary and even detrimental
 * @param {Object} vmo - View Model Object
 * @returns {Boolean} - true if cell selection is relevant, otherwise false
 *  */
export let isCellSelectionRelevant = ( vmo ) => {
    let ret = true;
    if ( !( vmo.isFamily || vmo.isFeature || vmo.isParentFreeForm || vmo.isParentEnumerated ) ) {
        ret = false;
    }
    return ret;
};


/**
 * Util to update both gridData.businessObjectToSelectionMap and its backup
 * @param {Object} gridData gridData to set on
 * @param {Object} data - data to set
 * @param {Boolean} preserveBackup - true if we want to merge the backup, preserve the original one so the changes made are still seen - used for the move from current to all use case
 */
export let updateBusinessObjectToSelectionMap = ( gridData, data, preserveBackup ) => {
    let oldBackupOfBusinessObjectToSelectionMap = gridData.backupOfBusinessObjectToSelectionMap;
    let { businessObjectToSelectionMap, backupOfBusinessObjectToSelectionMap } = pca0GridCommonUtils.copyBusinessObjectToSelectionMap( data );
    if ( preserveBackup ) {
        // if we want to merge the backup, we need to preserve the original one so the changes made are still seen - used for the move from current to all use case
        //also when adding a new variant while already having changes on the grid, we cannot override the backup
        let newBackupOfBusinessObjectToSelectionMap = _.merge( {}, backupOfBusinessObjectToSelectionMap, oldBackupOfBusinessObjectToSelectionMap ); //old map wins
        //we also need to take care of the newVariants: remove them from the backup map
        //gridData.backupOfBusinessObjectToSelectionMap = _.omitBy( newBackupOfBusinessObjectToSelectionMap, ( value, key ) => key.startsWith( 'NewVariant' ) );
        gridData.backupOfBusinessObjectToSelectionMap = newBackupOfBusinessObjectToSelectionMap;
        // Set selectionState to 0 for all values that start with NewVariant on the backup map so the current selection remains dirty
        Object.keys( gridData.backupOfBusinessObjectToSelectionMap ).forEach( key => {
            if ( key.startsWith( 'NewVariant' ) ) {
                Object.values( gridData.backupOfBusinessObjectToSelectionMap[key] ).forEach( subMap => {
                    subMap.selectionState = 0;
                } );
            }
        } );
    } else {
        gridData.backupOfBusinessObjectToSelectionMap = backupOfBusinessObjectToSelectionMap;
    }
    gridData.businessObjectToSelectionMap = businessObjectToSelectionMap;
};


export default exports = {
    createFamilyAndGroupMaps,
    pasteSelectionsOnColumn,
    updateVMOsWithSelections,
    checkActiveSettingsFromMap,
    showMessageIfLargeNumberOfSVRsSelected,
    getRequestInfoForValidation,
    getObjectUidsToLoadTreeProps,
    prepareSOAInputForNewVariant,
    prepareSOAInputToGetMultipleVariants,
    initGridData,
    mergeDataInResponseForVariousScenarios,
    postProcessLoadMultiSVRData,
    getSelectedExpressionsToSave,
    cleanAndColorifyHeaderCells,
    markCompletenessStatusToStale,
    handleExpandCollapseAllActionForSVR,
    getCreatedVariantRule,
    getFscProfileSettings,
    getConfigPerspective,
    getConfigPerspectiveforVariant,
    getJsonStringActiveSelectedExpressionsforVariant,
    getJsonStringExportDataForVariant,
    getJsonStringActiveSelectedExpressionsForBomFsc,
    getProfileSettingsForVariant,
    updateSVR,
    getColumnPropsAndSelectionMapForSVR,
    getColumnPropsAndSelectionMapSVR,
    clearVmoSelectionsForSVR,
    clearColumnSelectionsForSVR,
    populateViolationsOnBusinessObject,
    checkTypeOfSettingsNeeded,
    clearViolations,
    handleStartEdits,
    callSaveEditsPostActionsOnEditHandler,
    enforceStartEdits,
    getColumnPropsAndSelectionMapForBO,
    compareSVRs,
    clearCompareResult,
    parseResponseAndExtractViolations,
    deHighlightDifferences,
    initMultiSVRGridEditor,
    showNoSimilaritiesOrDifferencesMessage,
    setNewCompareMode,
    removeDuplicateUnconfigFamiliesAndFeatures,
    delayHandlingOfPrimarySelectionChange,
    reflectViolationOnDataProviderForVmo,
    getConfigPerspectiveFromServerResponse,
    toggleSingleSVRView,
    createNewColumnFromColumnProps,
    addNewVariantToGrid,
    updateAndColorifyDirtyElements,
    openSaveAsPanel,
    isGridDataLoadNeeded,
    updateViewModeBasedOnSelection,
    removeVariantFromGridData,
    removeVariantFromGrid,
    openAddNewColumnPanel,
    createNewVariant,
    saveNewVariant,
    saveNewVariants,
    saveNewVariantExpressions,
    createNewNamedColumn,
    determineIfContinueExpand,
    checkIfSingleVariantRuleAndNotDirty,
    verifyExpandCollapseStateBeforeExport,
    checkIfDirtyExistingSVRs,
    removeEmptySelectionStates,
    updateExpressionType,
    removeViolationsForSoaInput,
    showFscListView,
    getExistingNodeKeyForUnconfiguredValue,
    replacePastedSelectionFromUnconfiguredNode,
    handleExpandForShowAllFamiliesAction,
    showConfirmationMessageForUnload,
    updateVmosAndVariability,
    mergeVariabilityDataForPotentialNewChildernUnderParent,
    isCellSelectionRelevant,
    updateBusinessObjectToSelectionMap
};
