// Copyright (c) 2022 Siemens

/**
* @module js/pca0VariabilityExplorerService
*/
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awIconService from 'js/awIconService';
import awPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import localeService from 'js/localeService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import pca0RendererService from 'js/pca0RendererService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import selectionService from 'js/selection.service';
import treeTableDataService from 'js/treeTableDataService';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';

/**
 * Function to update tree table columns props and icon urls
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
function _updateColumnPropsAndNodeIconURLs( propColumns, childNodes ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
            if( col.propertyName === 'object_type' ) {
                col.renderingHint = 'PcaObjectTypeLOVComponent';
            } else if( col.propertyName === 'object_name' || col.propertyName === 'cfg0ObjectId' ) {
                col.renderingHint = 'PcaAllocationLOVComponent';
            }
        }
    } );
    if( propColumns && propColumns.length > 0 ) {
        propColumns[ 0 ].enableColumnMoving = false;
        let firstColumnPropertyName = propColumns[ 0 ].propertyName;

        _.forEach( childNodes, function( childNode ) {
            childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
            treeTableDataService.updateVMODisplayName( childNode, firstColumnPropertyName );
        } );
    }
}

/**
 * Add a column to pick and choose panel
 * @return {object} A Object consisting of column properties
 */
let _addCheckboxColumnToPickAndChoose = () => {
    return  {
        propertyName: 'variabilityCheckBox',
        gridID: 'variabilityPickAndChooseGrid',
        dataType:'String',
        columnWidth: 50,
        isTreeNavigation: false
    };
};

/**
 * Callback function to update column properties
 * @param {object} columnsToDisableSort List of columns that do not support sorting
 * @param {object} columnsToDisableFilter List of columns that do not support filtering
 * @return {Object} A Object consisting of callback function.
 */
function _getDataForUpdateColumnPropsAndNodeIconURLs( columnsToDisableSort, columnsToDisableFilter ) {
    var updateColumnPropsCallback = {};

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        _updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes );
        let columnConfig = response.output.columnConfig;
        columnConfig.columns = pca0ConfiguratorExplorerCommonUtils.disableColumnSortingAndFiltering( columnConfig.columns, columnsToDisableSort, columnsToDisableFilter );

        const formulaTableCellRenderer = pca0RendererService.formulaTableCellRenderer();
        // Add custom cell renderers for the "cfg0Condition" column
        columnConfig.columns
            .filter( element => element.propertyName === 'cfg0Condition' )
            .forEach( element => {
                element.cellRenderers = [ formulaTableCellRenderer ];
            } );

        return columnConfig;
    };

    return updateColumnPropsCallback;
}
/**
 * Callback function to update column properties for PickAndChoose Panel
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 * @return {Object} A Object consisting of callback function.
 */
function _updateColumnPropsAndNodeIconURLsForPickAndChooseGrid( treeDataProvider ) {
    var updateColumnPropsCallback = {};
    let skipCellRenderer = true;
    let vmGridSelectionState;

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        let columnConfig = response.output.columnConfig;
        let newColumnDef = pca0VariabilityTreeDisplayService.createColumnDef( _addCheckboxColumnToPickAndChoose(), veConstants.CONFIG_CONTEXT_KEY,
            treeDataProvider, vmGridSelectionState, skipCellRenderer );
        newColumnDef.enableSorting = false;
        columnConfig.columns.splice( 0, 0, newColumnDef );
        _.forEach( columnConfig.columns, ( column, indexOFColumn ) => {
            column.enableColumnHiding = false;
            //Making isTreeNavigation 'false' for the first column so the content of the 2nd column doesn't shift into it
            if( indexOFColumn === 0 ) {
                column.isTreeNavigation = false;
            } else if ( indexOFColumn === 1 ) {
                column.isTreeNavigation = true;
            }
        } );
        return columnConfig;
    };

    return updateColumnPropsCallback;
}

/**
 * Function to update the properties of families and features while moving between group.
 * @param {Array} rowsToBeMoved - List of families and features being moved.
 * @param {object} targetGroup - target group where families are being moved.
 */
let _updateParentAndAlternateId = ( rowsToBeMoved, targetGroup ) => {
    rowsToBeMoved.forEach( row => {
        // Updating the parent group details of the family.
        row.parentUID = targetGroup.uid;
        // Updating the alternateID for the family and features
        // We keep the format of alternateID as- parentAlternateID:uid, Since we are changing the group we are maintaining the format.
        row.alternateID = pca0CommonUtils.prepareUniqueId( targetGroup.alternateID, row.nodeUid );
        if( row.children && row.children.length > 0 ) {
            row.children.forEach( child => {
                child.alternateID = pca0CommonUtils.prepareUniqueId( row.alternateID, child.nodeUid );
            } );
        }
    } );
};

/**
 * Add the indicator column to Configuration Modules
 * @return {object} A Object consisting of column properties
 */
let _addIndicatorColumnToConfigurationModules = () => {
    //pixelWidth is needed to be set for the arrange panel calls to complete successfully
    //even if hidden, the column will be part of the newColumns array
    return  {
        propertyName: 'validationStateIcon',
        name: 'validationStateIcon',
        gridID: 'fscConfigurationModulesGrid',
        dataType:'String',
        columnWidth: 35,
        isTreeNavigation: false,
        displayName: '',
        minWidth: 35,
        pixelWidth:35,
        width: 35,
        enableColumnMenu: false,
        enableColumnMoving: false,
        enableColumnResizing: false,
        enableFiltering: false,
        enablePinning: false,
        enableSorting: false
    };
};

/**
 * Callback function to update column properties for ConfigurationModules tree table
 * @return {Object} A Object consisting of callback function.
 */
let _updateColumnPropsAndNodeIconURLsForConfigurationModulesGrid = () => {
    var updateColumnPropsCallback = {};
    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        let columnConfig = response.output.columnConfig;
        let colProps = _addIndicatorColumnToConfigurationModules();
        let newColumnDef = awColumnSvc.createColumnInfo( colProps );
        const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
        newColumnDef.isClientColumn = true;
        //make sure you are not adding additional first cols (it will be after column arrangements)
        //also the first cols settings would need to be reapplied, so better re-add it each time than check for it
        if( _.find( columnConfig.columns, { propertyName: 'validationStateIcon' } ) ) {
            columnConfig.columns.splice( 0, 1 );
        }
        //it needs to have the obj_string first; we now cannot rely anymore on the order as the type is now first so we'll have to reconstruct it
        let treeCol = {};
        let treeColIndex = _.findIndex( columnConfig.columns, { propertyName: 'object_string' } );
        if( treeColIndex > -1 ) {
            treeCol = columnConfig.columns[treeColIndex];
            columnConfig.columns.splice( treeColIndex, 1 );
        }
        columnConfig.columns.splice( 0, 0, newColumnDef );
        columnConfig.columns.splice( 1, 0, treeCol );

        _.forEach( columnConfig.columns, ( column ) => {
            //isTreeNavigation should be false for the first column, but true for the name column which is now the second column
            if ( column.propertyName === 'object_string' ) {
                column.isTreeNavigation = true;
                column.displayName = localeTextBundle.moduleHierarchy;
            }
            if ( column.propertyName === 'object_string' || column.propertyName === 'validationStateIcon' ) {
                column.enableColumnHiding = false;
            } else {
                column.enableColumnHiding = true;
            }
        } );
        return columnConfig;
    };

    return updateColumnPropsCallback;
};

/**
 * Utility function to extract thread properties from a source object
 * @param {Object} sourceObject - sourceObject for which thread properties are to be extracted.
 * @return {Object} A Object consisting of thread properties
 */
const _extractThreadProps = ( sourceObject ) => {
    const wsoThread = sourceObject.props.wso_thread;
    return {
        uid: wsoThread.dbValues[0],
        type: wsoThread.propertyDescriptor.constantsMap.ReferencedTypeName,
        parentUID: sourceObject.parentUID // This will be undefined if not present, which is fine for returnChildrenWSOThreadObjects
    };
};

/**
 *   Export APIs section starts here
 */

let exports = {};

/**
 * The function populates the initial columns to be to be updated on treeDataProviders column config
 * @param {Object} response - soaResponse.
 * @param {String} view - View name of the configurator.
 * @param {Object} treeDataProvider - tree data provider.
 * @param {Object} gridSelectionState - VM gridSelectionState atomic data
 * @return {Object} containing initial columns
 */
export const loadTreeColumns = ( response, view, treeDataProvider, gridSelectionState ) => {
    const objectStringColumn = {
        name: 'object_string',
        displayName: '...',
        typeName: 'WorkspaceObject',
        width: 300,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false
    };
    // We need to update the props of object_string column, So user can not move the column by drag and drop
    const _updateObjectStringColumnNavigation = ( columns ) => {
        const objectStringColumn = columns.find( column => column.propertyName === 'object_string' );
        if ( objectStringColumn ) {
            objectStringColumn.isTreeNavigation = true;
            objectStringColumn.enableColumnMoving = false;
        }
    };
    switch ( view ) {
        case 'variantConditions': {
            const columns = _.get( response, 'output.columnConfig.columns', [] ).map( column => ( {
                ...column,
                isColumnFromCots: true,
                pinnedLeft: true,
                cellRenderers : [ pca0RendererService.filterCellRenderer( pca0GridAuthoringService.handleCellClick, pca0Constants.VCA_CONTEXT, treeDataProvider, gridSelectionState ) ]
            } ) );
            _updateObjectStringColumnNavigation( columns );
            return {
                columns : columns,
                columnConfigId : 'Pca0VariantConditionsColConfig',
                typesForArrange : [ 'Cfg0AbsOptionValue', 'Cfg0AbsOptionFamily' ]
            };
        }
        case 'multiSvrGrid':{
            let columns = _.get( response, 'output.columnConfig.columns', [] ).map( column => ( {
                ...column,
                isColumnFromCots: true,
                pinnedLeft: true
            } ) );
            _updateObjectStringColumnNavigation( columns );
            return columns;
        }
        case 'constraints': {
            let columns = _.get( response, 'output.columnConfig.columns', [] ).map( column => ( {
                ...column,
                enableColumnMenu: true,
                enableColumnMoving: false,
                isColumnFromCots: true,
                pinnedLeft: true
            } ) );
            _updateObjectStringColumnNavigation( columns );
            return columns;
        }
        case 'variabilityPicker':{
            // 'variabilityCheckBox' column is required in the case of pick and choose panel only.
            const variabilityCheckBoxColumn = {
                name: 'variabilityCheckBox',
                displayName: '',
                width: 50,
                isTreeNavigation: false,
                enableSorting: false,
                enableColumnMoving: false,
                enableColumnResizing: false
            };
            return { columns: [ variabilityCheckBoxColumn, objectStringColumn ] };
        }
        default:
            return { columns: [ objectStringColumn ] };
    }
};

/**
 * Get a page of row column data for a tree-table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {PropertyLoadInput} propertyLoadInput - (found within the 'arguments' property passed to this function) The
 * PropertyLoadInput contains an array of PropertyLoadRequest objects this action function is invoked to
 * resolve.
 *
 * @return {Promise} A Promise resolved with a 'PropertyLoadResult' object containing the details of the result.
 */
export let loadTreeProperties = function() {
    let data = arguments[ 0 ].declViewModel;
    const gridId = arguments[ 0 ].gridId;
    if( gridId === 'variabilityPickAndChooseGrid' ) {
        arguments[ 0 ].updateColumnPropsCallback = _updateColumnPropsAndNodeIconURLsForPickAndChooseGrid( arguments[ 0 ].variabilityPickerTreeDataProvider );
    } else if( gridId === 'fscConfigurationModulesGrid' ) {
        arguments[ 0 ].updateColumnPropsCallback = _updateColumnPropsAndNodeIconURLsForConfigurationModulesGrid();
    } else {
        arguments[ 0 ].updateColumnPropsCallback = _getDataForUpdateColumnPropsAndNodeIconURLs( data.columnsToDisableSort, data.columnsToDisableFilter );
    }
    return awPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};

/**
 * Updates the tree columns based on the client scope URI.
 * @param {Object} vmNodes - The tree table nodes collection
 * @param {Object} declViewModel - view model
 * @param {Object} uwDataProvider - tree data provider
 * @param {Object} context - the viewModel context
 * @param {Object} contextKey - the context key
 *
 * @returns {Promise} Promise containing tree table properties
 */
export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey ) {
    /*
        Note:- The variability explorer view shows configurator context as top node of tree but VCA and VCV
        views do not show configurator context as top node of tree, as we are using common tree rendering
        framework we use "variabilityTreeData" as common dummy node as top node. As it is not having valid uid,
        to filter out it from input to getTableViewModelProperties SOA we are populating its props as empty array.
        It is stopgap solution as we don't have direct hook to control getTableViewModelProperties SOA input.
    */
    uwDataProvider.topTreeNode.props = {};

    var updateColumnPropsCallback = _getDataForUpdateColumnPropsAndNodeIconURLs( declViewModel.columnsToDisableSort, declViewModel.columnsToDisableFilter );
    return awPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes, declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback ) );
};

/**
 * Get Configurator Perspective based on active context
 * @param {Object} subPanelContext - subPanelContext passed from parent Component
 * @returns {Object} - Returns the configurator perspective
 */
export let populateConfigPerspective = subPanelContext => {
    let { configPerspective } = pca0CommonUtils.getConfigPerspectiveAndContextUid( subPanelContext.variantRuleData );
    return configPerspective;
};

/**
 * Returns configurator context if perspective is empty.
 * For Advance reuse use case this function returns empty context.
 * @param {Object} data - the viewModel data
 * @param {String} viewMode - Indicates the mode in which the function is called.
 * @returns {Object} - Returns the configurator context
 */
export let populateConfigContext = ( data, viewMode ) => {
    if( viewMode === 'advancedReuse' ) {
        return {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    return pca0ConfiguratorExplorerCommonUtils.populateConfigContext( data );
};

/**
 * Returns config perspective to be set in case of picker view.
 * @param {Object} contextUidInReuse - perspective available in case of Advanced reuse.

 * @returns {Object} - Returns the request info soa input for getVariability3.
 */
export let populateRequestInfoForVariabilityPicker = ( contextUidInReuse ) =>{
    const requestInfo = {
        sourceContext: [ contextUidInReuse ]
    };
    return contextUidInReuse ? requestInfo : {};
};

/**
 * Returns the request type to be set for fetching variability
 * Empty request type will be returned if parentNodeUid is being set for variability request
 * @param {Object} data - the viewModel data
 * @returns {Object} requestTypes - Request type for fetching variability
 */
export let populateRequestType = function( data ) {
    let requestType = '';
    let xrtID = appCtxSvc.getCtx( 'state.params.pageId' );
    if( xrtID === 'tc_xrt_Models' ) {
        requestType = 'Model';
    } else if( xrtID === 'tc_xrt_Features' ) {
        requestType = 'Group';
    } else if( xrtID === 'tc_xrt_Modules' ) {
        requestType = 'ConfigurationModule';
    } else if( xrtID === 'tc_xrt_Constraints' || xrtID === 'tc_xrt_Content' || xrtID === 'tc_xrt_ChangeContent' || xrtID === 'tc_xrt_Variants' ) {
        requestType = _.get( data, 'subPanelContext.tabKey' ) === 'tc_xrt_Models' ? 'Model' : 'Group';
    }

    // Check if parentNodeUid is not being set first, otherwise return empty request type
    let requestTypes = [];
    if( populateParentNode( data ).length === 0 ) {
        requestTypes.push( requestType );
    }

    let jsonRequestType = {
        requestType: requestTypes
    };

    // If getVariabililty() SOA is called from Grid we want some additional stuff in response.
    // Hence we pass viewType to let server know about how variability explorer is opened.
    // This viewTypes are defined under on enum on AW server.
    // Copying it here for a reference.
    // If we start populating viewTypes from other code than this enum we will define it in AW client.
    // enum class PCA0_view_type_t
    // {
    //     PCA0_default = 0, /** Don't know, don't care. Probably can be removed once VCA,FSC add their own enum values here. */
    //     PCA0_ve = 1, /** Variability Explorer. */
    //     PCA0_grid = 2, /** VCV Grid view. */
    //     PCA0_constraints_grid = 3, /** Constraints Grid view. */
    //     PCA0_ve_openedFrom_grid = 4 /** VE is opened from Constraints Grid to add Variability.
    // };
    if( data.variabilityPickerFromGrid ) {
        jsonRequestType = {
            requestType: requestTypes,
            viewType: 4 // 'PCA0_ve_openedFrom_grid'
        };
    }

    // Always if not modules, send requestType in JSON string form.
    if( xrtID !== 'tc_xrt_Modules' ) {
        requestTypes = [];
        requestTypes.push( JSON.stringify( jsonRequestType ) );
        return requestTypes;
    }
    return [ requestType ]; //the modules does not have the form: requestType: ["{"requestType":["ConfigurationModule"]}"]
};

/**
 * Returns the request type to be set for fetching variability in case of expand functionality
 * Empty request type will be returned if parentNodeUid is being set for variability request
 * @param {Object} data - the viewModel data
 * @param {Object} selectedNode - selected Node
 * @returns {Object} requestTypes - Request type for fetching variability
 */
export let populateRequestTypeForExpand = function( data, selectedNode ) {
    let requestType = '';
    let xrtID = appCtxSvc.getCtx( 'state.params.pageId' );
    if( xrtID === 'tc_xrt_Models' ) {
        requestType = 'Model';
    } else if( xrtID === 'tc_xrt_Features' ) {
        requestType = 'Group';
    } else if( xrtID === 'tc_xrt_Constraints' || xrtID === 'tc_xrt_Content' || xrtID === 'tc_xrt_BOM' ) {
        requestType = _.get( data, 'subPanelContext.tabKey' ) === 'tc_xrt_Models' ? 'Model' : 'Group';
    }
    let requestTypes = [];
    // check if selected node is not of type product context
    // if false add empty value as request type
    if( populateParentNodeForExpand( selectedNode ).length === 0 ) {
        requestTypes.push( requestType );
    }
    let jsonRequestType = {
        requestType: requestTypes
    };
    if( data.variabilityPickerFromGrid ) {
        jsonRequestType = {
            requestType: requestTypes,
            viewType: 4 // 'PCA0_ve_openedFrom_grid'
        };
    }
    requestTypes = [];
    requestTypes.push( JSON.stringify( jsonRequestType ) );
    return requestTypes;
};

/**
 * Returns the uid of node being expanded.
 * Empty array will be returned if node being expanded is top node.
 * @param {Object} data - the viewModel data
 * @returns {Object} - Returns the parent node uid
 */
export let populateParentNode = function( data ) {
    let parentNodeUids = [];
    let parentNode = _.get( data, 'treeLoadInput.parentNode' );
    // This case is valid when the user tries to add variablity through the pick and choose panel in the 'constraints' tab.
    // This check is required to skip the 'request type' value as 'group' when passing input in getVariability3 SOA call
    if( !parentNode || !parentNode.id ) {
        return [ '' ];
    }
    // This case is valid when user try to render the structure of a tree table through following way
    // while loading the tree table and while expanding the strucure using "Show Children" chevron command
    // from command cell
    let parentNodeUid = parentNode.id;
    const typesToCheckRootNode = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM,
        pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY
    ];
    // Both checks ensure that if the selected node is of type 'configurator context' or 'dictionary',
    // then that UID is skipped when passing parentUids as input in getVariability3 SOA call
    if( parentNodeUid !== pca0Constants.GRID_CONSTANTS.TREE_CONTAINER_KEY
            && !_.intersection( _.get( parentNode, 'modelType.typeHierarchyArray', [] ), typesToCheckRootNode ).length > 0 ) {
        parentNodeUids.push( parentNodeUid );
    }
    return parentNodeUids;
};

/**
 * Returns the uid of node being expanded for expand functionality.
 * Empty array will be returned if node being expanded is top node.
 * @param {Object} selectedNode - selected Node
 * @param {Array} data  - the viewModel data
 * @returns {Object} - Returns the parent node uid
 */
export let populateParentNodeForExpand = function( selectedNode ) {
    let parentNodeUids = [];
    //if selected object is type of group then only add the entries in parentNodeUids
    if( selectedNode && ( selectedNode.type === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID
        || _.get( selectedNode, 'modelType.typeHierarchyArray', [] ).includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP ) ) ) {
        parentNodeUids.push( selectedNode.uid );
    }
    //else return empty array
    return parentNodeUids;
};

/**
 * Returns the level of node being expanded.
 * @param {Object} selectedNode - selected node
 * @returns {Integer} - Returns the level of node
 */
export let populateLevelIndex = function( selectedNode ) {
    const typesToCheckRootNode = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM,
        pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY
    ];
    const typesToCheckFamilyGroupNode = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP
    ];
    // check if selected type is of product item or dictionary return level as -1
    // else if selected type is of type family group or unassinged family group return level as 1
    if ( _.intersection( _.get( selectedNode, 'modelType.typeHierarchyArray', [] ), typesToCheckRootNode ).length > 0 ) {
        return -1;
    }else if ( _.intersection( _.get( selectedNode, 'modelType.typeHierarchyArray', [] ), typesToCheckFamilyGroupNode ).length > 0 ||
    _.get( selectedNode, 'type' ) === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID  ) {
        return 1;
    }
    return 0;
};

//Set the config perspective policy before SOA call
export let getConfigPerspectivePolicy = function() {
    return pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY.types;
};

/**
 * This API creates the VMOs for features and models under un-expanded families
 * @param {Object} soaResponse - SOA response
 * @param {Object} selectedVariability - selectedVariability
 */
export const getInfoAboutNonExpandedFamilies = ( soaResponse, selectedVariability ) => {
    // Reset column properties (props not required)
    soaResponse.resetColumnProperties = true;
    // Extract variability tree data from SOA response
    const variabilityTreeData = pca0CommonUtils.getVariabilityNodes( soaResponse );
    // Get families that are not expanded from the selectedVariability
    const familiesNotExpanded = selectedVariability.getValue().familiesNotExpanded;
    // Arrays to store features and models to be added
    const featuresToBeAdded = [];
    const modelsToBeAdded = [];

    // Iterate through non-expanded families and their children
    for ( const familyNotExpanded of familiesNotExpanded ) {
        // Find the corresponding family node in the variability tree data
        const familyNotExpandedVNode = variabilityTreeData.find(
            ( node ) => node.nodeUid === familyNotExpanded.nodeUid );

        // Get the UIDs of children of the family
        const childrenUids = _.get( familyNotExpandedVNode, 'childrenUids', [] );
        // Iterate through children UIDs along with their indices

        for ( const [ index, childUid ] of childrenUids.entries() ) {
            // Determine the target array based on the family's type
            const targetType = familyNotExpanded.modelType.typeHierarchyArray.includes( 'Cfg0AbsModelFamily' )
                ? 'modelsSelected'
                : 'featureSelected';

            // Create a ViewModelTreeNode for each child
            const targetNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
                veConstants.CONFIG_CONTEXT_KEY,
                childUid,
                3,
                familyNotExpandedVNode.nodeUid,
                familyNotExpanded.alternateID,
                index,
                soaResponse
            );

            // Set the model type based on the family's type
            targetNode.modelType = {
                typeHierarchyArray: familyNotExpanded.modelType.typeHierarchyArray.includes( 'Cfg0AbsFeatureFamily' )
                    ? [ 'Cfg0AbsFeature' ]
                    : [ 'Cfg0AbsValue' ]
            };

            // Add the targetNode to the appropriate array based on the family's type
            targetType === 'modelsSelected'
                ? modelsToBeAdded.push( targetNode )
                : featuresToBeAdded.push( targetNode );
        }
    }

    // Update selectedVariability with the newly added features and models
    const selectedVariabilityProps = { ...selectedVariability.getValue() };
    selectedVariabilityProps.featureSelected.push( ...featuresToBeAdded );
    selectedVariabilityProps.modelsSelected.push( ...modelsToBeAdded );
    selectedVariabilityProps.vmoSelected.push( ...featuresToBeAdded, ...modelsToBeAdded );
    // Remove duplicates based on 'alternateID'
    _.uniqBy( selectedVariabilityProps.vmoSelected, 'alternateID' );
    // Update selectedVariability with the modified properties
    selectedVariability.update( selectedVariabilityProps );
};

/**
 * This function will return array of UID of families not expanded in pick and choose panel
 * @param {Array} familiesNotExpanded - families not expanded in pick and choose panel
 * @returns {Array} - Returns array of family UID not expanded
 */
export let populateFamiliesNotExpanded = function( familiesNotExpanded ) {
    return _.map( familiesNotExpanded, familyNotExpanded => familyNotExpanded.uid );
};

/**
* This function will return the target object based on the remove operation and object types.
* @param {Object} eventData - event data
* @param {Object} treeDataProvider - treeDataProvider
* @returns {Object} - Returns target object
*/
export let getTargetObject = function( eventData, treeDataProvider ) {
    //For Standalone feature cut use case we need to fetch parent from treeDataProvider
    if ( _.get( eventData, pca0Constants.VARIABILITY_OPERATIONS.REMOVEOPTYPE ) === pca0Constants.VARIABILITY_OPERATIONS.CUT ) {
        return pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, eventData.sourceObjects[0].parentUID );
    }
    return eventData.targetObject;
};

/**
 * This function will return the property name based on the operation and object types.
 * @param {Object} selectedObject - VMO of the selected row
 * @param {Object} eventData - event data
 * @returns {String} - Returns the property name
 */
export let getPropertyName = function( selectedObject, eventData ) {
    const validTypesToAddMembership = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE
    ];
    const typeHierarchyArray = _.get( eventData, 'targetObject.modelType.typeHierarchyArray', _.get( selectedObject, 'modelType.typeHierarchyArray' ) );
    const isOperationType = ( operation ) =>
        _.get( eventData, pca0Constants.VARIABILITY_OPERATIONS.REMOVEOPTYPE ) === operation ||
        _.get( eventData, pca0Constants.VARIABILITY_OPERATIONS.ADDOPTYPE ) === operation;

    // For moving families between groups.
    // We update cfg0FamilyThreads while moving families from one group to another.
    if( isOperationType( pca0Constants.VARIABILITY_OPERATIONS.DRAG_DROP_FAMILY ) ) {
        return pca0Constants.PROPERTY_NAMES.CFG_FAMILY_THREADS;
    }
    // For adding/removing Characteristics features, Package feature members and Summary feature members.
    if( _.get( eventData, pca0Constants.VARIABILITY_OPERATIONS.REMOVEOPTYPE ) === pca0Constants.VARIABILITY_OPERATIONS.PASTE
    && typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL ) || pca0CommonUtils.doesObjectContainType( '', validTypesToAddMembership, typeHierarchyArray ) ) {
        return pca0Constants.PROPERTY_NAMES.CFG_OPTION_VALUES;
    }
    // For cut/paste use case for standalone features.
    // We update cfg0FeatureThreads while moving standalone features across multiple dynamic families.
    if( isOperationType( pca0Constants.VARIABILITY_OPERATIONS.CUT ) || typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY ) ) {
        return pca0Constants.PROPERTY_NAMES.CFG_FEATURE_THREADS;
    }
    // For adding/removing Summarized models.
    return pca0Constants.PROPERTY_NAMES.CFG_MODELS;
};

/**
 * This function will select the Summary model if it is not selected and return True/False if secondary work area need to be refreshed
 * @param {Object} selectionModel - Selection model
 * @param {Object} targetObject - VMO of the target object
 * @returns {Boolean} - Returns True if secondary work area need to be refreshed false otherwise
 */
export let postProductModelOrFeatureDropHandler = function( selectionModel, targetObject ) {
    let currentSelection = selectionService.getSelection().selected;
    //Checking if the target object is already selected
    //Returning true to identify the secondary work area needs to be refreshed
    if( currentSelection.length === 1 && currentSelection[ 0 ].uid === targetObject.uid ) {
        return true;
    }
    //If the target object is not selected we don't need to refresh the SWA
    selectionModel.setSelection( targetObject );
    return false;
};

/**
 * This function will Move the family and the features to the target group and expand the group in client after drag and drop action
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Array} familiesToBeMoved - List of families which is being moved
 * @param {Object} targetGroup - Group in which the family is being moved
 * @param {Boolean} expandTargetNode - Indicates if the target node needs to be expanded
 */
let postFamilyMoveHandler = function( treeDataProvider, familiesToBeMoved, targetGroup, expandTargetNode ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();

    // When moving family to unassigned family group we have the target Object undefined.
    if( !targetGroup ) {
        targetGroup = viewModelCollection.getViewModelObject( viewModelCollection.findViewModelObjectById( pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) );
    }

    // Go through all of the families and the features and collect them all.
    const familyUIDs = new Set( familiesToBeMoved.map( family => family.uid ) );
    let rowsToBeMoved = familiesToBeMoved.flatMap( family => [ family, ...family.children || [] ] );

    const rowsToBeRemovedUIDs = new Set( rowsToBeMoved.map( row => row.uid ) );
    rowsToBeMoved = viewModelObjects.filter( row => rowsToBeRemovedUIDs.has( row.uid ) );
    viewModelCollection.removeLoadedObjects( rowsToBeMoved );

    let sourceParent = viewModelCollection.getViewModelObject( viewModelCollection.findViewModelObjectById( familiesToBeMoved[0].parentUID ) );
    if ( sourceParent ) {
        sourceParent.children = sourceParent.children.filter( child => !familyUIDs.has( child.uid ) );
        // Removing the expand icon from the source group if there is no family under it.
        if ( sourceParent.children.length === 0 ) {
            sourceParent.isLeaf = true;
        }
    }
    targetGroup.isLeaf = false;


    // If the target group is cached or already expanded we need to add the family to the target group directly.
    // With .__expandState we can identify the family is cached unexpanded state.
    if ( targetGroup.isExpanded ) {
        _updateParentAndAlternateId( rowsToBeMoved, targetGroup );
        // Adding the Family and the features under the target group.
        const sourceObjectUpdatedIndex = viewModelCollection.findViewModelObjectById( targetGroup.uid ) + 1;
        rowsToBeMoved.forEach( ( row, index ) => {
            viewModelObjects.splice( sourceObjectUpdatedIndex + index, 0, row );
        } );
    } else if ( targetGroup.__expandState ) {
        treeDataProvider.resetCollapseCache();
    }

    if( expandTargetNode ) {
        // Expand the target group if not already expanded.
        pca0ConfiguratorExplorerCommonUtils.expandNodeIfCollapsed( treeDataProvider, targetGroup );
        targetGroup.isExpanded = true;
        treeDataProvider.selectionModel.setSelection( targetGroup.alternateID );
        treeDataProvider.update( viewModelObjects );
    }
};

/**
 * This function will update the treeDataProvider and expand the targetFamilyObject forcefully after paste
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} sourceStandaloneFeatures - sourceStandaloneFeatures being copied
 * @param {Object} targetFamilyObj - DynamicFamily where standalone features are being copied
 */
export let postStandaloneFeaturePasteHandler = function( treeDataProvider, sourceStandaloneFeatures, targetFamilyObj ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    if( targetFamilyObj.isLeaf ) {
        targetFamilyObj.isLeaf = false;
    }
    // Adding the Standalone Feature under the target Dynamic Family.
    // If the target dynamic family is cached or already expanded we need to add the standalone features to the target dynamic family
    // With .__expandState we can identify the family is cached unexpanded state.
    if( targetFamilyObj.isExpanded ) {
        // Remove all the children of selected dynamic family from viewModelObjects
        // and make isExpanded to false, which will force full expand the tree after paste is performed
        let sourceObjectUpdatedIndex = viewModelCollection.findViewModelObjectById( targetFamilyObj.uid );
        if ( targetFamilyObj.children && targetFamilyObj.children.length > 0 ) {
            viewModelObjects.splice( sourceObjectUpdatedIndex + 1, targetFamilyObj.children.length );
            viewModelObjects[sourceObjectUpdatedIndex].children = [];
        }
        targetFamilyObj.childrenUids ? delete targetFamilyObj.childrenUids : null;
        targetFamilyObj.isExpanded = false;
    } else if ( targetFamilyObj.__expandState ) {
        // This will help us in expanding cached node with latest data
        treeDataProvider.resetCollapseCache();
    }
    // Expand the target group if not already expanded.
    pca0ConfiguratorExplorerCommonUtils.expandNodeIfCollapsed( treeDataProvider, targetFamilyObj );
};

/**
 * This function will cut the standalone features from dynamic family and update the variability tree
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} sourceStandaloneFeatures - sourceStandaloneFeatures being cut
 */
export let updateTreeDataProviderPostCut = ( treeDataProvider, sourceStandaloneFeatures ) => {
    const viewModelCollection = treeDataProvider.getViewModelCollection();
    const viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    sourceStandaloneFeatures.forEach( ( sourceStandaloneFeature ) => {
        let parentVMO = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, sourceStandaloneFeature.parentUID );
        // Update the parentVMO children array
        parentVMO.children.splice( parentVMO.children.indexOf( sourceStandaloneFeature ), 1 );
        if( parentVMO.children.length > 0 ) {
            parentVMO.isLeaf = false;
        } else {
            parentVMO.isLeaf = true;
        }
        // This splice is required to update the VMO removed after cut from tree.
        viewModelObjects.splice( viewModelObjects.indexOf( sourceStandaloneFeature ), 1 );
    } );
    treeDataProvider.update( viewModelObjects );
};

/**
 * Return Perspective information for getConfigPerspectiveForConfigurationModule getVariability3 SOA Input
 * @returns {Object} Perspective Object
 */
export let getConfigPerspectiveForConfigurationModule = () => {
    let context = appCtxSvc.getCtx( 'ConfiguratorCtx' );
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    if( fscContext && _.get( fscContext, 'appliedSettings.configSettings.props.pca0ConfigPerspective' ) ) {
        return {
            uid: fscContext.appliedSettings.configSettings.props.pca0ConfigPerspective.dbValues[ 0 ],
            type: 'Cfg0ConfiguratorPerspective'
        };
    } else if( context && context.configPerspective ) {
        //the modules tab use case
        return {
            uid: context.configPerspective.uid,
            type: 'Cfg0ConfiguratorPerspective'
        };
    }
    return {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
};

/**
 * This function processes the response and builds the column filters array based on the filters from response.
 * @param {Object} response of getTableViewModelProperties soa
 * @returns {Array} columnFilters
 */
export let updateInitialColumnfilters = ( response ) => {
    const newColumnConfig = _.get( response, 'output.columnConfig' );
    let columnsWithFilters = newColumnConfig.columns.filter( ( column )=>column.filters.length !== 0 );
    return columnsWithFilters.map( ( col ) => {
        const { propertyName, filters } = col;
        const updatedFilters = filters.map( ( filter ) => {
            return { ...filter, columnName: propertyName };
        } );
        return updatedFilters[0];
    } );
};

/**
 * This function processes the response, updates ctx with modulePerspective in case of setProperties soa
 * and returns the modulePerspective.
 * @param {Object} response soa response
 * @param {Object} operationName setProperties or getProperties
 * @returns {Object} modulePerspective from response
 */
export let getConfigPerspectiveFromServerResponse = ( response, operationName ) => {
    let modulePerspective;
    let contextKey = veConstants.CONFIG_CONTEXT_KEY;
    if( operationName === 'setProperties' ) {
        modulePerspective = _.find( response.ServiceData.modelObjects, {
            type: 'Cfg0ConfiguratorPerspective'
        } );
    } else {
        modulePerspective = _.find( response.modelObjects, {
            type: 'Cfg0ConfiguratorPerspective'
        } );
    }
    //update context with modulePerspective
    appCtxSvc.updatePartialCtx( contextKey + '.modulePerspective', modulePerspective );
    return modulePerspective;
};

/**
 * This function processes the response and returns true/false based on modules from getVariability3 soa
 * @param {Object} response of getVariability3 soa
 * @param {Array} columnFilters applied on PWA tree in Modules tab
 * @returns {Boolean} true if modules are present in getVariability3 response
 */
export let getModulesFromResponse = ( response, columnFilters ) => {
    let treeNodes = response.viewModelObjectMap;
    // This function should return true when response has no modules based on the filters applied so that
    // PWA tree is shown and user can reset/clear the filters.
    return _.size( treeNodes ) > 1 || columnFilters.length > 0;
};

/**
 * This function strips all client columns before save&load column config
 * @param {Array} columns all columns
 * @returns {Array} stripped columns of any client column
 */
export let stripClientColumnsFromColumnConfig = ( columns ) => {
    let serverColsOnly = [];
    columns.forEach( column => {
        if ( column.propertyName !== 'validationStateIcon' ) {
            serverColsOnly.push( column );
        }
    } );
    return serverColsOnly;
};

/**
 * function to load wso_thread property, extract and return array of wso_thread property object from a sourceObjects.
 * @param {Array} sourceObjects array of objects for which wso_thread properties are to be loaded
 * @returns {Array} array of thread property objects containing only uid, type, and parentUID properties.
 */
export let loadAndReturnWsoThreadProp = async( sourceObjects ) => {
    const sourceObjectThreads = [];
    if( sourceObjects.length !== 0 ) {
        const sourceObjUids = sourceObjects.map( sourceObj => sourceObj.uid );
        await dmSvc.getProperties( sourceObjUids, [ 'wso_thread' ] );
        // This piece of code is always expected to be executed while moving standalone features across dynamic families.
        sourceObjectThreads.push( ...sourceObjects.map( _extractThreadProps ) );
    }
    return sourceObjectThreads;
};

/**
 * function to extract and return array of wso_thread property object from a sourceObjects.
 * @param {Array} sourceObjects array of objects for which wso_thread properties are to be loaded
 * @returns {Array} array of thread property objects containing only uid, type, and parentUID properties.
 */
export let returnChildrenWSOThreadObjects = ( sourceObjects ) => {
    return sourceObjects.map( _extractThreadProps ).map( ( { uid, type } ) => ( { uid, type } ) ); // Explicitly returning only uid and type
};

/**
 * Get the property policy for the SOA getModulePerspectiveProperties
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForModules = () => {
    return pca0CommonUtils.getPropertyPolicy( 'getModulePerspectiveProperties' );
};

export default exports = {
    loadTreeColumns,
    loadTreeProperties,
    loadTreeTablePropertiesOnInitialLoad,
    populateConfigPerspective,
    populateConfigContext,
    populateRequestInfoForVariabilityPicker,
    populateRequestType,
    populateRequestTypeForExpand,
    populateParentNode,
    populateParentNodeForExpand,
    populateLevelIndex,
    getConfigPerspectivePolicy,
    getInfoAboutNonExpandedFamilies,
    populateFamiliesNotExpanded,
    getTargetObject,
    getPropertyName,
    postProductModelOrFeatureDropHandler,
    postFamilyMoveHandler,
    postStandaloneFeaturePasteHandler,
    updateTreeDataProviderPostCut,
    getConfigPerspectiveForConfigurationModule,
    updateInitialColumnfilters,
    getConfigPerspectiveFromServerResponse,
    getModulesFromResponse,
    stripClientColumnsFromColumnConfig,
    loadAndReturnWsoThreadProp,
    returnChildrenWSOThreadObjects,
    getPropertyPolicyForModules
};
