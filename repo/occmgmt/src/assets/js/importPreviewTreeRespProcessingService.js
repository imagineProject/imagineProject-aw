//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/importPreviewTreeRespProcessingService
 */
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import iconSvc from 'js/iconService';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

let exports = {};

/** Constant for default business object name to get default icon for nodes */
const defaultBOForIcon = 'ItemRevision';
/**
 * @param {Object} obj - object sent by server
 * @param {childNdx} childNdx Index
 * @return {ViewModelTreeNode} View Model Tree Node
 */
let createOccInfoUsingObjectInfo = function( obj, nodeToPropsArray, levelIndex ) {
    let objUid = obj.nodeId;
    let displayName = obj.displayName;
    let objType = obj.underlyingObjectType;
    nodeToPropsArray[ objUid ] = obj.propNameValueMap;
    let iconURL = iconSvc.getTypeIconURL( objType );
    if( _.isNull( iconURL ) || _.isUndefined( iconURL ) || _.isEmpty( iconURL ) ) {
        iconURL = iconSvc.getTypeIconURL( defaultBOForIcon );
    }
    let vmo = awTableTreeSvc.createViewModelTreeNode( objUid, objType,
        displayName, levelIndex, 0, iconURL );
    vmo.alternateID = vmo.uid;
    vmo.isLeaf = obj.numberOfChildren === 0;
    vmo.isExpanded = !vmo.isLeaf;
    // If item_id is available, set on the VMO. This item_id will be used to set actions on lines
    if ( obj.propNameValueMap.item_id ) {
        vmo.item_id = obj.propNameValueMap.item_id;
    }
    return vmo;
};

/**
 * This API checks whether incoming node's parent is available in collapsed
 * nodes or not. If yes then it return that node otherwise it return undefined.
 * @param {*} parentNodeUid
 */
let getParentFromCollapsedNodes = function( parentNodeUid ) {
    let parentNode = undefined;
    let activeContext = appCtxService.getCtx( 'aceActiveContext' );
    if( !_.isUndefined( activeContext ) &&
        !_.isUndefined( activeContext.context.vmc ) ) {
        let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
        let lastNodeOfLoadedNodes = loadedVMOs[ loadedVMOs.length - 1 ];
        if( lastNodeOfLoadedNodes && lastNodeOfLoadedNodes.__expandState ) {
            _.forEach( lastNodeOfLoadedNodes.__expandState.expandedNodes, function( node ) {
                if( _.isEqual( node.uid, parentNodeUid ) ) {
                    parentNode = node;
                }
            } );
        }
    }
    return parentNode;
};

/**
 * This API find parent VMO for current node. First it searches its parent node in already created nodes.
 * If it does not find it then it searches them in already loaded nodes.
 * @param {*} collectionOfCreatedNodes Created Node list
 */
let findParentNodeUsingUidInCollection = function( collectionOfCreatedNodes, parentUid ) {
    if( collectionOfCreatedNodes ) {
        let length = collectionOfCreatedNodes.length;
        for( let i = 0; i < length; ++i ) {
            if( parseInt( collectionOfCreatedNodes[ i ].uid ) === parentUid ) {
                return collectionOfCreatedNodes[ i ];
            }
        }
    }
};

/**
 * Finds parent node for current level.
 * @param {*} collectionOfCreatedNodes Collection of created nodes
 * @param {*} treeNode Node for which we need to find parent node
 */
let findParentNodeForTreeNode = function( collectionOfCreatedNodes, treeNode ) {
    let parentNode = findParentNodeUsingUidInCollection( collectionOfCreatedNodes, treeNode.parentIndex );
    if( _.isUndefined( parentNode ) && appCtxService.getCtx( 'aceActiveContext.context.vmc' ) ) {
        let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
        parentNode = getParentFromCollapsedNodes( treeNode.parentIndex );
        if( _.isUndefined( parentNode ) ) {
            parentNode = findParentNodeUsingUidInCollection( loadedVMOs, treeNode.parentIndex );
        }
    }
    return parentNode;
};

/**
 * Adds VMO to collection of created nodes array if it parent node of new node is not
 * collapsed.
 * @param {*} treeNode
 * @param {*} collectionOfCreatedNodes
 * @param {*} vmo
 */
let addVMOToCollectionIfNotPartOfCachedNodes = function( treeNode, collectionOfCreatedNodes, vmo ) {
    let parentNode = findParentNodeForTreeNode( collectionOfCreatedNodes, treeNode );
    let isParentNodeCollapsed = getParentFromCollapsedNodes( treeNode.propNameValueMap.ParentInx );
    if( _.isUndefined( isParentNodeCollapsed ) ) {
        vmo.parentUid = parentNode.uid;
        collectionOfCreatedNodes.push( vmo );
    } else {
        let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
        let lastNodeOfLoadedNodes = loadedVMOs[ loadedVMOs.length - 1 ];
        vmo.parentUid = isParentNodeCollapsed.uid;
        if( lastNodeOfLoadedNodes && lastNodeOfLoadedNodes.__expandState ) {
            lastNodeOfLoadedNodes.__expandState.expandedNodes.push( vmo );
            _.forEach( lastNodeOfLoadedNodes.__expandState.expandedNodes, function( vmo ) {
                if( vmo.incompleteTail ) {
                    vmo.incompleteTail = false;
                }
            } );
        }
    }
};

/**
 * Creates tree structure from flat list
 * @param {*} nodeInfos flat list of nodes.
 * @param {*} nodeToPropsArray node to property array
 * @param {*} collectionOfCreatedNodes list which will contain resultant nodes.
 */
let createTree = function( nodeInfos, nodeToPropsArray, collectionOfCreatedNodes ) {
    if( nodeInfos.length > 0 ) {
        for( let index = 0; index < nodeInfos.length; index++ ) {
            let treeNode = nodeInfos[ index ];
            let nodeLevel = treeNode.level;
            if( nodeLevel === 0  ) {
                let vmo = createOccInfoUsingObjectInfo( treeNode, nodeToPropsArray, nodeLevel );
                collectionOfCreatedNodes.push( vmo );
            } else {
                let vmo = createOccInfoUsingObjectInfo( treeNode, nodeToPropsArray, nodeLevel );
                addVMOToCollectionIfNotPartOfCachedNodes( treeNode, collectionOfCreatedNodes, vmo );
            }
        }
    }
};

/**
 * This API will populate all the tree nodes which we are going to render in import preview
 * @param {*} parentChildInfoMap map of parent nodes to their children nodes
 * @param {*} nodeToPropsArray map of nodes to their properties
 * @param {*} createdNodes tree nodes which we need to render
 */
export let populateTreeNodes = function( nodeInfos, nodeToPropsArray, createdNodes ) {
    createTree( nodeInfos, nodeToPropsArray, createdNodes );
};

/**
 * This API will make sure that the first column in column config
 * @param {*} columns columns in table
 */
let shiftNameColumnToBeginning = function( columns ) {
    let indexOfNameColumn = 0;
    for( let index = 0; index < columns.length; index++ ) {
        if( _.isEqual( columns[ index ].displayName.toUpperCase(), 'NAME' ) ) {
            indexOfNameColumn = index;
            break;
        }
    }
    if( indexOfNameColumn === 0 ) {
        return;
    }
    let nameColumn = columns.splice( indexOfNameColumn, 1 );
    columns.unshift( nameColumn[ 0 ] );
};

/**
 * API checks whether we need to update column config on dataprovider or not
 * @param {*} dataProviderColumnConfig Column Configuration saved on data provider
 * @param {*} columnConfig column config coming from server
 */
let isRespConfigSameAsDataProviderColumnConfig = function( dataProviderColumnConfig, columnConfig ) {
    if( !dataProviderColumnConfig ) {
        return true;
    }
    if( dataProviderColumnConfig.columns.length !== columnConfig.columns.length ) {
        return true;
    }
    for( let index = 0; index < columnConfig.columns.length; index++ ) {
        if( !_.isEqual( dataProviderColumnConfig.columns[ index ].displayName, columnConfig.columns[ index ].displayName ) ) {
            return true;
        }
    }
    return false;
};

/**
 * API checks number of column coming from server. If no column comes in column config from server then we
 * add a dummy column to column config to make sure splm table widget gets rendered on UI.
 * @param {*} columnFromServer columns returned by server
 */
let addFirstColumnWhenNoColInColConfig = function( columnFromServer ) {
    if( columnFromServer.length === 0 ) {
        columnFromServer[ 0 ] = {
            name: '',
            displayName: '',
            typeName: '',
            width: 300,
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: false
        };
    }
};

/**
 * This API does following things
 * 1) Disbale column moving on first column.
 * 2) Hide all columns which are added for response processing and tree rendering.
 * 3) Set column config coming from server to the data provider
 * @param {*} columnConfig column config from response
 * @param {*} dataProvider dataProvider for import BOM tree
 * @param {*} internalColumnNames internal column names array which should not get added to the tree
 */
export let populateTreeColumns = function( columnConfig, dataProvider, internalColumnNames ) {
    let filteredColumns = _.filter( columnConfig.columns, function( column ) {
        return column.displayName && !internalColumnNames.includes( column.displayName );
    } );
    columnConfig.columns = filteredColumns;
    _.forEach( filteredColumns, function( column ) {
        column.enableColumnMoving = false;
        column.enableColumnHiding = false;
    } );
    shiftNameColumnToBeginning( columnConfig.columns );
    if( isRespConfigSameAsDataProviderColumnConfig( dataProvider.columnConfig, columnConfig ) ) {
        addFirstColumnWhenNoColInColConfig( filteredColumns );
        dataProvider.columnConfig = columnConfig;
    }
};

/**
 * Finds parent by Uid in passed list. If it does not find it in this list then it searched for it in loaded view model object
 * @param {*} nodeList node list
 * @param {*} parentNodeUid parent node's Uid
 */
let findParentNodeByUid = function( nodeList, parentNodeUid ) {
    let parentNode = undefined;
    _.forEach( nodeList, function( node ) {
        if( _.isEqual( node.uid, parentNodeUid ) ) {
            parentNode = node;
        }
    } );
    if( _.isUndefined( parentNode ) ) {
        let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
        parentNode = getParentFromCollapsedNodes( parentNodeUid );
        if( _.isUndefined( parentNode ) ) {
            _.forEach( loadedVMOs, function( node ) {
                if( _.isEqual( node.uid, parentNodeUid ) ) {
                    parentNode = node;
                }
            } );
        }
    }
    return parentNode;
};

/**
 * It will take the node and see whether parent node level index is 1 or not. If index is not one then it will
 * add that node in collectionOdParentNode array adn search for its parent node recurrsively unless it gets parent
 * node with level index 1.
 * @param {*} collectionOfParentNode
 * @param {*} childNodeList
 * @param {*} levelIdx
 */
let collectParentNodesTillLevel1ForLastChild = function( collectionOfParentNode, childNodeList, element ) {
    if( element.levelNdx > 1 ) {
        let parentNode = findParentNodeByUid( childNodeList, element.parentUid );
        collectionOfParentNode.push( parentNode );
        collectParentNodesTillLevel1ForLastChild( collectionOfParentNode, childNodeList, parentNode );
    }
};

/**
 * Before setting incomplete nodes on tree, we need to remove all existing incomplete nodes.
 * Otherwise they will trigger pagination at wrong point of time and cause mis managed tree.
 */
let clearAllExistingInCompleteTailNodes = function() {
    let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
    for( let index = 0; index < loadedVMOs.length; index++ ) {
        delete loadedVMOs[ index ].incompleteTail;
    }
};

/**
 * Populates incompleteTail variable on all incomplete nodes
 */
export let populateInCompleteTailInLoadedResult = function( treeLoadResult, endReached ) {
    clearAllExistingInCompleteTailNodes();
    if( endReached === false ) {
        if( treeLoadResult.childNodes.length === 0 ) {
            let loadedVMOs = appCtxService.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
            if( loadedVMOs.length > 0 ) {
                let lastNodeOfLoadedNodes = loadedVMOs[ loadedVMOs.length - 1 ];
                lastNodeOfLoadedNodes.incompleteTail = true;
            }
        } else {
            let lastElement = treeLoadResult.childNodes[ treeLoadResult.childNodes.length - 1 ];
            let inCompleteParentNodes = [];
            collectParentNodesTillLevel1ForLastChild( inCompleteParentNodes, treeLoadResult.childNodes, lastElement );
            _.forEach( inCompleteParentNodes, function( inCompleteParentNode ) {
                inCompleteParentNode.incompleteTail = true;
            } );
        }
    }
};

export default exports = {
    populateTreeNodes,
    populateTreeColumns,
    populateInCompleteTailInLoadedResult
};
