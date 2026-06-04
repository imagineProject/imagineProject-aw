// Copyright (c) 2022 Siemens

/**
 * @module js/accessMgmtService
 */
import _ from 'lodash';
import iconSvc from 'js/iconService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import uwPropertyService from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';
import addObjectUtils from 'js/addObjectUtils';
import tableSvc from 'js/splmTablePublishedService';
import Am0RuleCutPasteService from 'js/Am0RuleCutPasteService';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import awColumnSvc from 'js/awColumnService';
import messagingSvc from 'js/messagingService';
import __soaSvc from 'soa/kernel/soaService';
import leavePlaceService from 'js/leavePlace.service';
import localStorage from 'js/localStorage';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';

var leaveHandler = {};

/**
  * creating view model structure for child nodes
  * @param {object} objUid  uid
  * @param {string} vmNodeType - type of of child node
  * @param {string} displayName - display name of child node
  * @param {integer} level - level index of child node
  * @param {integer} childIdx - child index of child node
  * @param {object} child - Loaded View Model Objects
  * @return {object} VMO of child nodes
  */
export let createVMOStructure = function( objUid, vmNodeType, displayName, level, childIdx, child, parent, isPendingCut, isValidForPaste ) {
    var vmNode = '';
    var iconURL = iconSvc.getTypeIconURL( 'Rule' );
    var treeNode = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( objUid ) );
    vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, vmNodeType, displayName, level, childIdx, iconURL );
    vmNode.isLeaf = child.isLeafNode;
    vmNode.isEditable = child.isEditable;
    vmNode.typeIconURL = iconURL;
    vmNode.props = treeNode ? { ...treeNode.props } : {};
    vmNode.modelType = treeNode ? treeNode.modelType : {};

    var resource = 'AccessmgmtConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );

    var conditionName = uwPropertyService.createViewModelProperty( 'rule_name', localTextBundle.condition, 'STRING', child.conditionName, [ child.conditionName ] );
    vmNode.props.rule_name = conditionName;
    vmNode.props.rule_name.parentUid = objUid;

    var value = uwPropertyService.createViewModelProperty( 'rule_arg', localTextBundle.value, 'STRING', child.conditionArg, [ child.conditionArg ] );
    vmNode.props.rule_arg = value;
    vmNode.props.rule_arg.parentUid = objUid;

    var acl = uwPropertyService.createViewModelProperty( 'acl', localTextBundle.objectAclName, 'STRING', child.aclInfo.acl.uid, [ child.aclInfo.aclName ] );
    vmNode.props.acl = acl;
    vmNode.props.acl.parentUid = objUid;

    //Below code is used for childCount in createAmRuleStruture
    vmNode.parent = parent;

    vmNode.isPendingCut = isPendingCut ? isPendingCut : false;
    vmNode.isValidForPaste = isValidForPaste !== false;

    return vmNode;
};

/**
  * creating childNodes Array
  * @param {Array} result - getAMTree2 SOA response
  * @param {integer} level - level index of child node
  * @return {Array} child nodes Array
  */
export let createAmRuleStruture = function( result, level, dataProvider ) {
    var vmNodes = [];
    var displayName = '';
    var objUid = '';
    var vmNode = '';
    var vmNodeType = '';
    var childCount = '';
    var isPendingCut = false;
    var isValidForPaste = true;
    var clipBoardContent = appCtxSvc.getCtx( 'awClipBoardProvider' );
    for ( var i = 0; i < result.parentChildrenInfos.length; i++ ) {
        if ( result.parentChildrenInfos[i].childrenInfo && result.parentChildrenInfos[i].childrenInfo.length > 0 ) {
            for ( var j = 0; j < result.parentChildrenInfos[i].childrenInfo.length; j++ ) {
                //checking clipBoardContent to make node greyed out after expanded
                if ( clipBoardContent && clipBoardContent.length > 0 ) {
                    //in this function after expanding node, checking parent of children or children itself is greyed out
                    //based on condition returning pendingForcut and pasteValidNode true or false
                    let currentNodeInfo = result.parentChildrenInfos[i].currentNodeInfo;
                    let children = result.parentChildrenInfos[i].childrenInfo[j];
                    var pendingCutPasteValidFlag = Am0RuleCutPasteService.setGreyOutAndIsPasteValidFlagAfterReExpand( dataProvider, currentNodeInfo, children );
                    isPendingCut = pendingCutPasteValidFlag.pendingForCut;
                    isValidForPaste = pendingCutPasteValidFlag.pasteValidNode;
                }
                var child = result.parentChildrenInfos[i].childrenInfo[j];
                objUid = child.treeNode.uid;
                displayName = child.conditionName;
                vmNodeType = child.treeNode.type;
                var parentUid = result.parentChildrenInfos[i].currentNodeInfo.treeNode.uid;
                childCount = result.parentChildrenInfos[i].childrenInfo.length - 1;
                var parent = {
                    uid: parentUid,
                    childCount: childCount
                };
                //creating VMO structure for child nodes
                vmNode = createVMOStructure( objUid, vmNodeType, displayName, level, j, child, parent, isPendingCut, isValidForPaste );
                vmNodes.push( vmNode );
            }
        }
    }
    return vmNodes;
};

/**
  * creating childNodes Array
  * @param {Array} result - getAMTree2 SOA response
  * @param {Array} treeLoadInput - treeLoadInput
  * @return {Array} - treeLoadResult array having parentNode and ChildNode
  */
export let loadAMTreeTableData = function( result, treeLoadInput, dataProvider ) {
    // Simulates server call/response
    var parentNode = treeLoadInput.parentNode;
    var level = parentNode.levelNdx + 1;
    var vmNodes = [];
    var endReachedVar = result.numReturned === result.totalFound;
    var startReachedVar = true;

    var tempCursorObject = {
        endReached: endReachedVar,
        startReached: true
    };
    if( result.cursor ) {
        tempCursorObject = result.cursor;
    }

    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    var rootNode = {};

    if ( isTopNode ) {
        var currentNode = result.parentChildrenInfos[0].currentNodeInfo;
        rootNode = createVMOStructure( currentNode.treeNode.uid, currentNode.treeNode.type, currentNode.conditionName, level, 0, currentNode, '' );
        rootNode.isExpanded = true;
        rootNode.totalFound = result.totalFound;
        rootNode.cursorObject =  _.cloneDeep( tempCursorObject );
        level += 1;
    }

    let childNodes = createAmRuleStruture( result, level, dataProvider );

    if ( isTopNode ) {
        rootNode.children = childNodes;
        vmNodes.unshift( rootNode );
    }

    vmNodes.push( ...childNodes );


    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReachedVar,
        endReachedVar, treeLoadInput.parentNode );

    treeLoadResult.parentNode.cursorObject =  _.cloneDeep( tempCursorObject );
    treeLoadResult.parentNode.totalFound = result.totalFound;
    return treeLoadResult;
};

/**
  * load Properties required to show in tables'
  * @param {Object} propertyLoadInput - Property Load Input
  * @return {Object} propertyLoadResult
  */
export let loadTableProperties = function( propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if ( !childNode.props && childNode.id !== 'top' ) {
                childNode.props = {};
            }

            if ( childNode.id !== 'top' ) {
                allChildNodes.push( childNode );
            }
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );
    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};

/**
  * providing uid and type as input to parentNode of getAMTree2 SOA
  * @return {object} Object of uid and type
  */
export let getExpandedNodeData = function( data ) {
    //initially we are giving blank value as input to parentNode of getAMTree2 SOA
    if ( data.parentNode.uid === 'top' && data.parentNode.levelNdx === -1 ) {
        return '';
    }
    return {
        uid: data.parentNode.uid,
        type: data.parentNode.type
    };
};

/**
  * Load properties to be shown in the tree structure
  * @return {object} Output of loadTableProperties
  */
export let loadPropertiesJS = function( ) {
    var propertyLoadInput = arguments.length > 0 ? arguments[ 1 ] : null;
    /** * Load the 'child' nodes for the 'parent' node. */
    if ( propertyLoadInput !== null &&
        propertyLoadInput !== undefined &&
        propertyLoadInput !== 'undefined' ) {
        return exports.loadTableProperties( propertyLoadInput );
    }
};
/**
  * Process partial errors to display proper message on create ACL failure
  *
  * @param {Object} SOA reponse
  * @return {message} to be displayed
  */
export let processPartialErrors = function( response ) {
    var message = '';
    var partialErrors = '';
    // Check if input response is not null and contains partial errors then only
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }
    // create the error message
    if ( partialErrors  ) {
        _.forEach( partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                message += '\n' + object.message;
            } );
        } );
    }
    return message;
};

/**
  * delete the selected am rule(s)
  * @param {Object} selectedObjects - Selected Object
  */
export let deleteAMObject = function( selectedObjects ) {
    var deleteInput = {};
    var deleteNode = { deleteNodeInfo: [] };
    for ( var i = 0; i < selectedObjects.length; i++ ) {
        deleteInput = {
            node: {
                type: selectedObjects[i].type,
                uid: selectedObjects[i].id
            },
            clientId: selectedObjects[i].uid
        };
        deleteNode.deleteNodeInfo.push( deleteInput );
    }
    return deleteNode.deleteNodeInfo;
};

/**
  * Process partial errors to display proper message on delete AM tree nodes
  *
  * @param {Object} SOA reponse
  * @return {message} to be displayed
  */
export let getDeleteObjectsPartialErrors = function( response, selectedObject ) {
    var clientId = '';
    var message = '';
    // Check if input response is not null and contains partial errors then only
    // create the error message
    if ( response && response.partialErrors ) {
        _.forEach( response.partialErrors, function( partialError ) {
            clientId = partialError.clientId;
            for ( var j = 0; j < selectedObject.length; j++ ) {
                //check if selected clientId and partial error client id is same so as to return the display name
                if ( selectedObject[j].uid === clientId ) {
                    var reuturnDisplayName = selectedObject && selectedObject[j].props.rule_arg.value !== '' ? selectedObject[j].displayName + ' - ' + selectedObject[j].props.rule_arg.value : selectedObject[j].displayName;
                    selectedObject[j].displayName;
                    _.forEach( partialError.errorValues, function( object ) {
                        message += '<BR/>';
                        if ( selectedObject.length > 1 ) {
                            message += '\n' + '"' + reuturnDisplayName + '"' + '\t' + object.message;
                        } else {
                            message += '\n' + object.message;
                        }
                    } );
                }
            }
        } );
    }
    return message;
};

/**
  * to construct the display name for AM tree in 'condition-value' format
  * @param {Object} selectedRuleNode - Selected Rule
  * @param {String} returnedValue - returns display name
  */
//This method will be called in case of single confirmation/delete for displaying confirmation/successful/failure Messages only.
export let getDisplayValueForAmTreeRuleNode = function( selectedRuleNode ) {
    //check if value is present.
    return selectedRuleNode && selectedRuleNode.props.rule_arg.value !== '' ? selectedRuleNode.displayName + ' - ' + selectedRuleNode.props.rule_arg.value : selectedRuleNode.displayName;
};


/**
  * Method for creating the input to deleteACLs SOA
  * @param {object} selected - selected ACL Names from the list
  */
export let getObjectACLsToRemove = function( selected ) {
    var input = [];
    for( var i = 0; i < selected.length; i++ ) {
        if( selected[ i ] ) {
            input.push( {
                uid: selected[ i ].propInternalValue,
                type: 'AM_ACL'
            } );
        }
    }
    return input;
};

/**
  * Method for getting the search string for getACL SOA
  * @param {object} filterValue - filter string for getACL method
  */
export let getFilterString = function( filterValue ) {
    //checking filterValue
    var filterString = '';
    if ( filterValue !== null && filterValue !== undefined ) {
        filterString = filterValue;
    }
    return filterString;
};

/**
  * This function is called when we add new rule to collapsed node.
  * This usecase needs to call getAMTree2 soa to fetch childnodes(including newly added rule) of selected collpased node.
  * Calling getAMTree2 soa by publishing toggleTreeNode event to fetch newly added node
  * @return {Object} Obj for isPinned, isNodeAdded, ruleUid which is later used in setSelection
  */
export let addRuleInNotExpandedNode = function( eventData ) {
    var selectedNode = eventData.selectedNode;
    var ruleUid = eventData.rule.created[0];
    selectedNode.isExpanded = true;
    eventBus.publish( 'accessRuleTree.plTable.toggleTreeNode', selectedNode );
    /*
     "amRuleTreeDataProvider.treeNodesLoaded" event is invoking after tree node updates(framework event),  we want this event to exceute only new rule is added.
     "isNodeAdded" is set to true to decide if action on amRuleTreeDataProvider.treeNodesLoaded is invoking or not
     "isNodeAdded" is reset in set selection outputData
     */

    return {
        isPinned: eventData.isPinned,
        isNodeAdded: true,
        ruleUid: ruleUid
    };
};
/**
  * To select newly added node in primary workarea
  * @param {*} data
  * @param {*} ruleUid -  newly created node uid
  */
export let setSelectionForAddNewRule = function( data, ruleUid ) {
    //Condition to check if pannel is pinned or unpinned
    //Make newly added node selected if pannel is unpinned
    if ( !data.isPinned ) {
        var childNodes = data.treeLoadResult.childNodes;
        var newRuleObj = childNodes.filter( child => child.uid === ruleUid );
        data.dataProviders.amRuleTreeDataProvider.selectionModel.setSelection( newRuleObj );
    }
    //setSelectionForAddNewRule called to select new rule when added it in collapsed node and when panel is unpinned
    //after adding rule if we do save tree than tree gets reload and in that case we are selecting root node so this function
    //calling again while reloading tree because it is called on treeNodesLoaded event and it is giving issue to select rootNode on save tree,
    //so returning false and this value taken in outputData variable 'isNodeAdded' and isNodeAdded = true is used as conditon
    //to call setSelectionForAddNewRule function.so after returning false that it will call only once after adding rule.
    return false;
};
/**
  *
  * Usecase - To make node as parent node if adding new rule underneath to this node
  * setting parent node properties
  * @param {*} parentVMO
  */
var updateParentNodeState = function( parentVMO ) {
    if ( parentVMO ) {
        //the parent exists in the VMO lets make sure it is now marked as parent and expanded
        parentVMO.expanded = true;
        parentVMO.isExpanded = true;
        parentVMO.isLeaf = false;
        if ( !parentVMO.children ) {
            parentVMO.children = [];
        }
    }
};

/**
  * This function is called when new rule is adding in expanded node or leaf node.
  * This function is creating vmo for the new rule, decide the position in data provider and update the dataprovider with new rule.
  * then setSelection setting new rule as selected node when pannel is unpinned.
  * when pannel is pinned selection is remain as it is. selection does not change.
  * @param {*} eventData - new AM Rule data
  * @param {*} dataProvider
  */
export let addRuleInExpandedAndLeafNode = function( eventData, dataProvider ) {
    var selectedParentNode = eventData.selectedNode;
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs = vmc.getLoadedViewModelObjects();
    var vmoId = vmc.findViewModelObjectById( selectedParentNode.uid );
    var parentVMO = loadedVMOs[vmoId];
    var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
        return vmo.uid === selectedParentNode.uid;
    } );

    var objUid = eventData.rule.modelObjects[eventData.rule.created[0]].uid;
    var displayName = eventData.condition.dbValue;
    var vmNodeType = eventData.rule.modelObjects[eventData.rule.created[0]].type;

    var vmNode = '';
    var childIdx = parentVMO.children ? parentVMO.children.length : 0;
    var level = parentVMO.levelNdx + 1;
    var childInfo = {
        isLeafNode: true,
        isEditable: true,
        conditionName: eventData.condition.dbValue,
        conditionArg: eventData.ruleValue.dbValue,
        aclInfo: {
            acl: {
                uid: eventData.objectAclName.dbValue
            },
            aclName: eventData.objectAclName.uiValue
        }
    };
    var parent = {
        uid: parentVMO.uid,
        childCount: parentVMO.children ? parentVMO.children.length - 1 : 0
    };
    vmNode = createVMOStructure( objUid, vmNodeType, displayName, level, childIdx, childInfo, parent );

    var childLevelIndex = vmNode.levelNdx;

    if ( parentVMO.isLeaf ) {
        updateParentNodeState( parentVMO );
    }

    //Add the new treeNode to the parentVMO (if one exists) children array
    if ( parentVMO && parentVMO.children ) {
        parentVMO.children.push( vmNode );
        parentVMO.isLeaf = false;
        parentVMO.totalChildCount = parentVMO.children.length;
        //Below loop is used to find exact position for new rule in data provider
        for ( var i = parentIdx + 1; i < loadedVMOs.length; i++ ) {
            //This condition is used to check if the loadedVMOs[i] node is sibling of parent node then do not need to check further
            //so the i is the position of new rule
            //This condition is satisfy when we adding new rule in middle nodes
            if ( loadedVMOs[i].levelNdx < childLevelIndex ) {
                // no longer looking at first level children (now looking at an uncle)
                break;
            }
        }
        var newIndex = i;
        // insert the new treeNode in the viewModelCollection at the correct location
        loadedVMOs.splice( newIndex, 0, vmNode );
    }

    dataProvider.update( loadedVMOs, loadedVMOs.length );

    if ( !eventData.isPinned ) {
        dataProvider.selectionModel.setSelection( vmNode );
    }
};
/**
 /**
   * to re-order the selected rule move to top
   * @param {Object} selectedNode
   */
export let moveTreeNodeToTop = function( eventData, dataProvider, selectionData ) {
    let selectedParentNode = eventData.selectedNode[0].parent;
    let selectedNode = eventData.selectedNode[0];

    var vmc = dataProvider.viewModelCollection;
    var loadedTree = vmc.getLoadedViewModelObjects();
    // find the parent index and selected node index so as we can get the hierarchy from the indexes that needs to be moved up.
    var parentIndex = getNodeIndex( selectedParentNode, dataProvider );
    var selectedNodeIndex = getNodeIndex( selectedNode, dataProvider );
    var endIndex = selectedNodeIndex;
    // get the elements from the tree from parent index upto selected node index so as to update the load tree with new position of elements.
    const hierarchy = loadedTree.slice( parentIndex + 1, endIndex + 1 );
    selectedNode.childNdx = 0;
    loadedTree[parentIndex + 1] = selectedNode;
    var i = parentIndex + 2;
    for ( var j = 0; j < hierarchy.length - 1; i++, j++ ) {
        hierarchy[j].childNdx = hierarchy[j].childNdx + 1;
        loadedTree[i] = hierarchy[j];
    }
    let newSelectionData = { ...selectionData.getValue() };
    newSelectionData.selected = [ loadedTree[parentIndex + 1] ];
    selectionData.update( newSelectionData );
    dataProvider.update( loadedTree, loadedTree.length );
};

/**
  * This function returns the index of selected node and its parent node.
  * @param {Object} node
  * @param {*} loadedTree
  * @returns index
  */
export let getNodeIndex = function( node, dataProvider ) {
    return dataProvider.viewModelCollection.loadedVMObjects.findIndex( ( obj ) => obj.uid === node.uid );
};

/**
  *
  * @param {Object} selectedNode
  * This function will be called when selected node is expanded.
  * This function will collapse the selected node's child nodes.
  */
export let collapseTreeNode = function( selectedNode ) {
    selectedNode.isExpanded = false;
    eventBus.publish( 'accessRuleTree.plTable.toggleTreeNode', selectedNode );
};

/**
  *
  * @param {Object} selectedNode
  * This function will be called when selected node is collapsed.
  * This function will expand the selected node with child nodes.
  */
export let expandTreeNode = function( selectedNode ) {
    selectedNode.isExpanded = true;
    eventBus.publish( 'accessRuleTree.plTable.toggleTreeNode', selectedNode );
};

/**
/**
 *
 * @param {Object} dataProvider The data provider that will be used to get the correct content
 * @param {Object} selectedNode Selected Tree Node Object
 * @param {object} selectionData Selection Data
 * @param {boolean} isMoveUp True if Move up node command is invoked
 */
export let moveNodes = function( dataProvider, selectedNode, selectionData, isMoveUp ) {
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs = vmc.getLoadedViewModelObjects();
    var currIdx = _.findIndex( loadedVMOs, selectedNode );
    var replaceIdx = isMoveUp ? currIdx - 1 : currIdx + 1;


    //swap node indexes
    var tmp = loadedVMOs[replaceIdx];
    loadedVMOs[replaceIdx] = loadedVMOs[currIdx];
    loadedVMOs[currIdx] = tmp;

    //Move Node to one level up/down
    var tmpChildNdx = loadedVMOs[replaceIdx].childNdx;
    loadedVMOs[replaceIdx].childNdx = loadedVMOs[currIdx].childNdx;
    loadedVMOs[currIdx].childNdx = tmpChildNdx;

    dataProvider.update( loadedVMOs, loadedVMOs.length );

    let newSelectionData = { ...selectionData.getValue() };
    newSelectionData.selected = [ loadedVMOs[replaceIdx] ];
    selectionData.update( newSelectionData );
};

/**
 * This function will find destintaion node.
 * @param {dataProvider} dataProvider The data provider that will be used to get the correct content
 * @param {Object} selectedNode Selected Tree Node Object
 * @param {boolean} isMoveUp True if Move Up node command is invoked
 */
export let getDestinationTreeNode = function( dataProvider, selectedNode, isMoveUp ) {
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs = vmc.getLoadedViewModelObjects();
    var newIndex = selectedNode.childNdx + 1;
    if ( isMoveUp ) {
        newIndex = selectedNode.childNdx - 1;
    }
    var nodeNdx = loadedVMOs.findIndex( ( obj ) => obj.childNdx === newIndex && obj.levelNdx === selectedNode.levelNdx );
    return loadedVMOs[nodeNdx];
};

/**
 * Update search state with new array nodeInfo structure containing actions moveup, movedown, movetotop
 * @param {*} searchStateAtomicDataRef search state
 * @param {*} searchStateUpdater dispatcher
 */
export let initializeNodeInfoInSearchState = function( searchState ) {
    if ( searchState ) {
        let newSearchState = { ...searchState.value };
        newSearchState.nodeInfo = [];
        if ( searchState.update ) {
            searchState.update( newSearchState );
        }
    }
};
/**
 * Update nodeInfo structure by pushing actions like moveup, movedown, movetotop
 * @param {*} eventData selectedNode
 * @param {*} actionType actions like MOVEUP. MOVEDOWN, MOVETOTOP
 * @param {*} arrangeNodeStructure array of selected nodes with actions performed by user
 * @return {arrangeNodeStructure} final array to be rearranged
 */
export let updateNodeInfo = function( eventData, actionType, arrangeNodeStructure  ) {
    let selectedNode = eventData.selectedNode;
    let actionTypeString = '';

    for ( var i = 0; i < selectedNode.length; i++ ) {
    //this block will execute only when actionType is PASTE
    //creating objects of nodes which needs to CUT before paste and pushing into the arrangeNodeStructure
        if ( actionType === 'PASTE' ) {
            var cutActionObj = {
                actionType: 'CUT',
                node: selectedNode[i],
                clientId: actionType + '_' + selectedNode[i].uid
            };
            arrangeNodeStructure.push( cutActionObj );
        }
        //creating object and pushing into arrangeNodeStructure when actionType = MOVEUP, MOVEDOWN, MOVETOTOP, PASTE
        var actionObj = {
            actionType: actionType,
            node: selectedNode[i],
            clientId: actionTypeString
        };
        actionObj.clientId = actionType + '_' + selectedNode[i].uid;
        //If actionaType = PASTE then adding newParentNode into the object
        if ( actionType === 'PASTE' ) {
            actionObj.newParentNode = eventData.newParentNode;
        }
        arrangeNodeStructure.push( actionObj );
    }

    return arrangeNodeStructure;
};
/**
 * reset atomic data nodeInfo and then debounce soa call rearrangeAMTree
 * @param {*} eventData searchState and nodeInfo to update atomic data and parameter to soa
 */
export let debounceRearrangeAMTree = _.debounce( function( eventData ) {
    var tempnodeInfo = _.cloneDeep( eventData.nodeInfo );
    addObjectUtils.updateAtomicDataValue( eventData.searchState, { nodeInfo: [] } );
    eventBus.publish( 'accessManagerTreeView.rearrangeAMTree', tempnodeInfo );
}, 1000 );
/**
  * Process partial errors to display proper message on rearrange AM tree nodes
  *
  * @param {Object} SOA reponse
  * @param {selectedObject} array of selected nodes with actions performed by user
  * @param {dataProvider} to get the loadedVMObjects
  * @return {message} to be displayed
  */
export let getRearrangeObjectsPartialErrors = function( response, selectedObject, dataProvider  ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMObjects = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    var clientId = '';
    var message = '';
    var reuturnDisplayName = '';
    // Check if input response is not null and contains partial errors then only
    // create the error message
    if ( response && response.partialErrors ) {
        _.forEach( response.partialErrors, function( partialError ) {
            clientId = partialError.clientId;
            for ( var j = 0; j < selectedObject.length; j++ ) {
                //check if selected clientId and partial error client id is same so as to return the display name
                if ( selectedObject[j].actionType + '_' + selectedObject[j].node.uid === clientId ) {
                    //this block will execute when action type=PASTE
                    if( selectedObject[j].actionType === 'PASTE' ) {
                        reuturnDisplayName =  selectedObject[j].newParentNode.displayName;
                    } else //this block will execute when action type = MOVEUP,MOVEDOWN,MOVETOTOP
                    {
                        var index = vmc.findViewModelObjectById( selectedObject[j].node.parent.uid );
                        if ( index !== -1 ) {
                            reuturnDisplayName =  loadedVMObjects[index].displayName;
                        }
                    }
                    _.forEach( partialError.errorValues, function( object ) {
                        message += '<BR/>';
                        message += '\n' + '"' + reuturnDisplayName + '"' + '\t' + object.message;
                    } );
                }
            }
        } );
    }

    return message;
};


/**
 * this _greyedOutElementRenderer pushed in tree columns cell renderer to add style to greyed out selected row on condition basis.
 */
var _greyedOutElementRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );

        //add class to cell content to greyed out row
        cellContent.classList.add( 'aw-tcWidgets-partialOpacity' );

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isPendingCut;
    },
    name: '_greyedOutElementRenderer'
};

/**
 * Function to create tree columns
 * <pre>
 * {
 *     columnInfos : An array of columns created by this service.
 * }
 * </pre>
 */
export let loadTreeColumns = function() {
    var resource = 'AccessmgmtConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var awColumnInfos = [];
    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'rule_name',
        displayName: localTextBundle.condition,
        minWidth: 150,
        width: 250,
        isTreeNavigation: true,
        enableColumnHiding: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'rule_arg',
        displayName: localTextBundle.value,
        minWidth: 150,
        width: 150,
        isTreeNavigation: false,
        enableColumnHiding: false
    } ) );

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'acl',
        displayName: localTextBundle.objectAclName,
        minWidth: 150,
        width: 200,
        isTreeNavigation: false,
        enableColumnHiding: false
    } ) );

    for ( var index = 0; index < awColumnInfos.length; index++ ) {
        var column = awColumnInfos[index];
        column.cellRenderers = [];
        column.cellRenderers.push( _greyedOutElementRenderer );
    }

    return {
        columns: awColumnInfos
    };
};

/**
 * This function will be called only when the rule and ACE table properties from SWA is updated. So it updates the PWA tree table.
 * This function is updating tree dataprovider in PWA with the changed properties
 * This function is updating subPanelContext selection data that will render SWA with updated rule properties and ACE table
 * @param {*} subPanelContext sub panel context
 * @param {*} eventData - modified properties from SWA
 * @param {*} dataProvider - AM tree data provider
 */
export let updateSelectionData = function( subPanelContext, eventData, dataProvider ) {
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs = vmc.getLoadedViewModelObjects();
    var ruleObj = eventData;
    var vmoId = vmc.findViewModelObjectById( ruleObj.uid );
    if( loadedVMOs[vmoId].props.rule_name.dbValue !== ruleObj.props.rule_name.dbValue ) {
        loadedVMOs[vmoId].displayName = ruleObj.props.rule_name.dbValue;
        loadedVMOs[vmoId].props.rule_name.dbValue = ruleObj.props.rule_name.dbValue;
        loadedVMOs[vmoId].props.rule_name.uiValue = ruleObj.props.rule_name.uiValue;
    }
    if( loadedVMOs[vmoId].props.rule_arg.dbValue !== ruleObj.props.rule_arg.dbValue ) {
        loadedVMOs[vmoId].props.rule_arg.dbValue = ruleObj.props.rule_arg.dbValue;
        loadedVMOs[vmoId].props.rule_arg.uiValue = ruleObj.props.rule_arg.uiValue;
    }
    if( loadedVMOs[vmoId].props.acl.dbValue !== ruleObj.props.acl.dbValue ) {
        loadedVMOs[vmoId].props.acl.dbValue = ruleObj.props.acl.dbValue;
        loadedVMOs[vmoId].props.acl.uiValue = ruleObj.props.acl.uiValue;
    }
    dataProvider.update( loadedVMOs, loadedVMOs.length );

    let newSelectionData = { ...subPanelContext.selectionData.getValue() };
    newSelectionData.selected = [ ...subPanelContext.pwaSelectionModel.selectionData.selected ];
    subPanelContext.selectionData.update( newSelectionData );
};

/**
  * this function is called to set isNodePasted flag true for paste after soa success response
  * @param {Object} SOA reponse
  * @param {selectedObject} array of selected nodes which will cut and paste
  * @return {isNodePasted} flag to be return
  */
export let setIsNodePastedFlagTrue = function( response, rearrangeAMTreeSoaInput ) {
    // Check if input response is not null and contains updated array
    // set the flag isNodePasted = true if actionType="CUT"
    var isNodePasted = false;
    if ( response && response.updated ) {
        //checked actionType
        for ( var i = 0; i < rearrangeAMTreeSoaInput.length; i++ ) {
            if ( rearrangeAMTreeSoaInput[i].actionType === 'CUT' ) {
                isNodePasted = true;
                break;
            }
        }
    }
    //making this flag true to use as a condition for reloadTree, expandNode and setSelectionForPasteNode
    //reloadTree, expandNode will be called when actionType = PASTE
    //setSelectionForPasteNode should called once after node pasted and after getAmTree2 response i.e after tree props load
    return isNodePasted;
};
/**
 * Set location change listener for leaveConfirmation and unregister context
 */
export let setLocationChangeListener = function() {
    var defer = AwPromiseService.instance.defer();
    leavePlaceService.registerLeaveHandler( {
        okToLeave: function( targetNavDetails, oldState, newState ) {
            var isAccessManagerLocation = newState && newState.state && newState.state.name === 'accessManagerSublocation';
            if ( !isAccessManagerLocation ) {
                return leaveConfirmation();
            }
            defer.resolve();
            return defer.promise;
        }
    } );
};
/**
  * this function calls the functions for deregisterLeaveHandler, displayConfirmationMessages, unRegisterContext
  */
export let leaveConfirmation = function() {
    //unRegistering SELECTED_ACCESSORTYPES_ACCESSORS context
    appCtxSvc.unRegisterCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
    appCtxSvc.unRegisterCtx( 'ATTRIBUTE_ACCESSORS' );
    //selectedAMRule stored in ctx to retain it after reload tree because.
    //So when moving location it is not needed so unregistering it.
    appCtxSvc.unRegisterCtx( 'selectedAMRule' );
    var isAMTreeDirty = appCtxSvc.getCtx( 'isAMTreeDirty' );
    //checking isDirty parameter to displayConfirmationMessage
    if ( isAMTreeDirty ) {
        leavePlaceService.deregisterLeaveHandler( leaveHandler );
        return displayConfirmationMessageForSaveTree();
    }
    var defer = AwPromiseService.instance.defer();
    defer.resolve();
    return defer.promise;
};

/**
  * this function shows confirmation dialouge with message and cancel and save button
  */
export function displayConfirmationMessageForSaveTree() {
    var resource = 'AccessmgmtConstants';
    var deferred = AwPromiseService.instance.defer();
    var localTextBundle = localeSvc.getLoadedText( resource );
    var buttonArray = [];
    //creating cancel button
    buttonArray.push( createButton( localTextBundle.cancel, function( $noty ) {
        $noty.close();
        deferred.resolve();
    } ) );

    //creating save button
    buttonArray.push( createButton( localTextBundle.saveButtonTitle, function( $noty ) {
        __soaSvc.post( 'Internal-AccessManager-2022-12-AwAccessManager', 'saveAMTree', {} ).then(
            function( response ) {
                if ( response && response.ServiceData && response.ServiceData.partialErrors ) {
                    var message = processPartialErrors( response );
                    messagingSvc.showError( message );
                }else{
                    localStorage.publish( 'isAMTreeDirty', false );
                    appCtxSvc.registerCtx( 'isAMTreeDirty', false );
                    deferred.resolve();
                }
            },
            function( error ) {
                messagingSvc.showError( error );
            } );
        $noty.close();
    } ) );

    var confirmationMessage = localTextBundle.confirmationMessage;
    messagingSvc.showWarning( confirmationMessage, buttonArray );
    return deferred.promise;
}

/**
 * Create button for use in confirmation messages
 *
 * @param {String} label label
 * @param {Function} callback callback
 * @return {Object} button
 */
export function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

/**
  * this function saves isAMTreeDirty flag in local storage and register's in ctx
  * @param {*} updatedFlagValue updated value of isAMTreeDirty flag true/false
  */
export let updateisAMTreeDirtyFlag = function( updatedFlagValue ) {
    //saves isAMTreeDirty flag in local storage
    localStorage.publish( 'isAMTreeDirty', updatedFlagValue.isAMTreeDirty );
    // Register's ctx with isAMTreeDirty flag for save/Discard command visibility
    appCtxSvc.registerCtx( 'isAMTreeDirty', updatedFlagValue.isAMTreeDirty );
};

/**
  * this function is called on load of the page
  * this function is called to get isAMTreeDirty flag from local storage and register's in ctx
  * @param {*} updatedFlagValue updated value of isAMTreeDirty flag true/false
  */
export let getIsAMTreeDirtyFlagFromLocalStorage = function() {
    var isAMTreeDirty = false;
    var isAMTreeDirtyValue = localStorage.get( 'isAMTreeDirty' );
    if ( isAMTreeDirtyValue ) { //checks value got local storage
        isAMTreeDirty = isAMTreeDirtyValue === 'true';
    } else { //if value not found in local storage, flag set as a false
        isAMTreeDirty = false;
    }
    appCtxSvc.registerCtx( 'isAMTreeDirty', isAMTreeDirty );

    eventBus.subscribe( 'session.signOut', function() {
        // On sign-out removes isAMTreeDirty flag from local storage and Unregister's ctx
        localStorage.removeItem( 'isAMTreeDirty' );
        appCtxSvc.unRegisterCtx( 'isAMTreeDirty' );
    } );
    //registering previous selection with empty selectedObjects on load of page
    setCtxRuleSelection( [] );
};

/**
  * this function is called to set root node on load of the page, on cancel edit and save rule tree
  * this function also maintains selection on reload of the tree on failure of rearrange operation
  * @param {*} data to get the root node from treeLoadResult
  * @param {*} selectionData to update new selection
  */
export let preserveSelection = function( data, selectionModel ) {
    var selectedAMRule = appCtxSvc.getCtx( 'selectedAMRule' );
    //setSelectionForPasteNode and preserveSelection both are calling on treeNodesLoadedEvent
    //So in CutPaste selection this function should not call so adding data.isNodePasted === false conditon
    if( ( !data.dataProviders.amRuleTreeDataProvider.selectedObjects || data.dataProviders.amRuleTreeDataProvider.selectedObjects.length === 0 ) && data.isNodePasted === false ) {
        //checking if selectedAMRule not exist than set root node in the tree
        //this block will execute on load of the page, on saveEdits, on CancelEdit
        if( !selectedAMRule || selectedAMRule.length === 0 ) {
            var rootNode = [ data.dataProviders.amRuleTreeDataProvider.viewModelCollection.loadedVMObjects[0] ];
            setSelection( data.dataProviders.amRuleTreeDataProvider, selectionModel, rootNode );
        } else{
            setSelection( data.dataProviders.amRuleTreeDataProvider, selectionModel, selectedAMRule );
        }
    }
};

/**
  * this function is called to make the selection empty on cancel edit and
    on save of AM rule tree because we want root node selection after performing these operations.
  * and empty selectedObjects from ctx is used as a condition in preserveSelection method to make  root node
    selection.
  */
export let clearAMTreeSelection = function( data, selectionModel ) {
    data.dataProviders.amRuleTreeDataProvider.selectionModel.setSelection( [] );
    data.dataProviders.amRuleTreeDataProvider.selectedObjects = [];
    selectionModel.selectionData.update( {} );
    setCtxRuleSelection( [] );
};

/**
  * this function is called to set root node on load of the page, on cancel edit, on save rule tree and on delete rule from tree
  * also this is called whenever we need to retain selection after reload of the tree.
  */
export const setSelection = ( dataProvider, selectionModel, rootNode  ) => {
    let newSelectionData = { ...selectionModel.selectionData.getValue() };
    newSelectionData.selected = rootNode;
    selectionModel.selectionData.update( newSelectionData );
    dataProvider.selectionModel.setSelection( rootNode );
    setCtxRuleSelection( rootNode );
};

/**
  * This function is called whenever we need to retain a selection which can be used after the tree is reload.
    Like, Cut/Paste,SaveEdits,CancelEdits etc..
  */
export const setCtxRuleSelection = ( selectedObjects ) => {
    appCtxSvc.updateCtx( 'selectedAMRule', selectedObjects );
};

export const processOutput = ( data, dataCtxNode, searchData ) => {
    const newSearchData = { ...searchData.value };
    newSearchData.totalFound = data.totalFound;
    newSearchData.totalLoaded = data.totalLoaded;
    newSearchData.endIndex = data.endIndex;
    newSearchData.startIndex = data.cursor.startIndex;
    searchData.update( newSearchData );
};

const exports = {
    processOutput,
    loadAMTreeTableData,
    createAmRuleStruture,
    loadTableProperties,
    loadPropertiesJS,
    getExpandedNodeData,
    createVMOStructure,
    deleteAMObject,
    processPartialErrors,
    getDeleteObjectsPartialErrors,
    getDisplayValueForAmTreeRuleNode,
    addRuleInNotExpandedNode,
    setSelectionForAddNewRule,
    addRuleInExpandedAndLeafNode,
    getObjectACLsToRemove,
    getFilterString,
    moveTreeNodeToTop,
    getNodeIndex,
    collapseTreeNode,
    expandTreeNode,
    moveNodes,
    getDestinationTreeNode,
    initializeNodeInfoInSearchState,
    updateNodeInfo,
    debounceRearrangeAMTree,
    getRearrangeObjectsPartialErrors,
    loadTreeColumns,
    updateSelectionData,
    setIsNodePastedFlagTrue,
    setLocationChangeListener,
    displayConfirmationMessageForSaveTree,
    leaveConfirmation,
    updateisAMTreeDirtyFlag,
    getIsAMTreeDirtyFlagFromLocalStorage,
    preserveSelection,
    clearAMTreeSelection,
    setSelection,
    setCtxRuleSelection
};
export default exports;

