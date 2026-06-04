// Copyright (c) 2022 Siemens

/**
 * @module js/aceStructureEditService
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import AwTimeoutService from 'js/awTimeoutService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceTreeTableStateService from 'js/aceTreeTableStateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtGetSvc from 'js/aceGetService';

/**
  * {EventSubscriptionArray} Collection of eventBuss subscriptions to be removed when the controller is
  * destroyed.
  */
var _eventSubDefs = [];

var exports = {};

var getParentNodeIndex = function( loadedVMObjects, childItr ) {
    if( childItr < 0 ) {
        return;
    }

    var obj = loadedVMObjects[ childItr ];
    var childLevelNdx = obj.levelNdx;
    var parentNodeIndex = -1;
    while( obj.levelNdx > 0 ) {
        --childItr;
        obj = loadedVMObjects[ childItr ];
        if( obj.levelNdx === childLevelNdx - 1 ) {
            parentNodeIndex = childItr;
            break;
        }
    }

    return parentNodeIndex;
};

var getNumberOfChildRows = function( loadedVmosList, removalNodeInfo, nodeIndexInLoadedVmosList ) {
    var totalNumberOfRowsIncludingParentRow = 0;
    var currentNodeLevel = removalNodeInfo.levelNdx;

    for( var i = nodeIndexInLoadedVmosList + 1; i < loadedVmosList.length; i++ ) {
        if( loadedVmosList[ i ].levelNdx > currentNodeLevel ) {
            ++totalNumberOfRowsIncludingParentRow;
        } else {
            break;
        }
    }
    return totalNumberOfRowsIncludingParentRow;
};

export let removeChildFromParentChildrenArray = function( parentNode, childNode ) {
    if( parentNode && parentNode.children && parentNode.children.length > 0 ) {
        var ndx = _.findLastIndex( parentNode.children, function( vmo ) {
            return vmo.stableId === childNode.stableId || vmo.uid === childNode.uid;
        } );

        if( ndx > -1 ) {
            parentNode.children.splice( ndx, 1 );
            if( parentNode.children.length === 0 ) {
                parentNode.expanded = false;
                parentNode.isExpanded = false;
                parentNode.isLeaf = true;
                delete parentNode.children;
            }
        }
    }
};

export let addChildToParentsChildrenArray = function( parentNode, childNode, childNodeIndex ) {
    if( parentNode ) {
        if( !parentNode.children || parentNode.children.length === 0 ) {
            parentNode.expanded = true;
            parentNode.isExpanded = true;
            parentNode.children = [];
        }

        childNodeIndex < parentNode.children.length ? parentNode.children.splice( childNodeIndex, 0, childNode ) :
            parentNode.children.push( childNode );
        parentNode.isLeaf = false;
        parentNode.totalChildCount = parentNode.children.length;
    }
};

var removeNodesFromSelectionModel = function( removeNodesFromSelection ) {
    // remove hidden elements + already parent is hidden hence its changed elements are stale
    if( removeNodesFromSelection.length > 0 ) {
        appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.removeFromSelection( removeNodesFromSelection );
        if( appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.getCurrentSelectedCount() < 2 ) {
            appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.setMultiSelectionEnabled( false );
        }
    }
};

var replaceOldUidWithNewUidInSelectionModel = function( oldUid, newUid ) {
    if( appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.getSelection().includes( oldUid ) ) {
        appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.removeFromSelection( oldUid );
        appCtxSvc.ctx.aceActiveContext.context.pwaSelectionModel.addToSelection( newUid );
    }
};

var createSimilarNodeWithUidUpdated = function( oldNode, newElementInfo ) {
    var childVMO = occmgmtVMTNodeCreateService.createVMNodeUsingOccInfo( newElementInfo, oldNode.childNdx, oldNode.levelNdx );
    childVMO.expanded = oldNode.expanded;
    childVMO.isExpanded = oldNode.isExpanded;
    childVMO.isLeaf = oldNode.isLeaf;

    if( oldNode.children ) {
        childVMO.children = [].concat( oldNode.children );
        delete oldNode.children;
    }

    return childVMO;
};

export let getVmcIndexForParentsNthChildIndex = function( loadedVMObjects, parentNodeIndex, childIndex ) {
    var parentVMO = loadedVMObjects[ parentNodeIndex ];
    var expectedVmcIndex = parentNodeIndex + 1;
    for( var i = 0; i < childIndex; i++ ) {
        var nextNodeVMO = loadedVMObjects[ expectedVmcIndex ];
        // is next node vmo is uncle?
        if( nextNodeVMO.levelNdx <= parentVMO.levelNdx ) {
            break;
        }
        // next vmo node is sibling
        var numberOfChildNodes = getNumberOfChildRows( loadedVMObjects, loadedVMObjects[ expectedVmcIndex ], expectedVmcIndex );
        expectedVmcIndex = expectedVmcIndex + numberOfChildNodes + 1;
    }
    return expectedVmcIndex;
};

var moveNodeAlongWithChildrenNodesToNewLocation = function( loadedViewModelObjects, currentVmcIndex, nthChildOfParent, parentNodeIndex ) {
    var childVMO = loadedViewModelObjects[ currentVmcIndex ];

    // if child node with same uid is present at same location, do nothing
    var expectedVmcIndex = exports.getVmcIndexForParentsNthChildIndex( loadedViewModelObjects, parentNodeIndex, nthChildOfParent );
    var presentVMOAtExpectedLocation = loadedViewModelObjects[ expectedVmcIndex ];
    if( currentVmcIndex === expectedVmcIndex && childVMO.uid === presentVMOAtExpectedLocation.uid ) {
        return;
    }

    // remove node from its current location
    var numberOfChildNodes = getNumberOfChildRows( loadedViewModelObjects, childVMO, currentVmcIndex );
    var removedChilds = loadedViewModelObjects.splice( currentVmcIndex, numberOfChildNodes + 1 );

    // after removal of nodes under parent, expecting vmc index may change hence recollect.
    expectedVmcIndex = exports.getVmcIndexForParentsNthChildIndex( loadedViewModelObjects, parentNodeIndex, nthChildOfParent );
    for( var i = 0; i < removedChilds.length; i++, expectedVmcIndex++ ) {
        loadedViewModelObjects.splice( expectedVmcIndex, 0, removedChilds[ i ] );
    }
};

var getIndexFromArray = function( arr, nodeInfo ) {
    return arr.findIndex( function( co ) {
        return nodeInfo.stableId && co.stableId === nodeInfo.stableId ||
             nodeInfo.occurrenceId && co.uid === nodeInfo.occurrenceId ||
             nodeInfo.uid && co.uid === nodeInfo.uid;
    } );
};

export let isNodePresentInTree = function( nodeInfo, viewModelcollection ) {
    var loadedVMObjects = viewModelcollection.getLoadedViewModelObjects();
    return getIndexFromArray( loadedVMObjects, nodeInfo ) > -1;
};

export let getTreeNode = function( nodeInfo, loadedVMObjects ) {
    var parentIdx = getIndexFromArray( loadedVMObjects, nodeInfo );
    var parentNode;
    if( parentIdx > -1 ) {
        parentNode = loadedVMObjects[ parentIdx ];
    }
    return parentNode;
};

export let removeNode = function( removalNodeInfo, parentInfo, loadedVMObjects, avoidDeselectOfRemovedNode ) {
    var removalNodeIndex = getIndexFromArray( loadedVMObjects, removalNodeInfo );
    // if object doesnt exist, return
    if( removalNodeIndex < 0 ) {
        return;
    }

    var removalNode = loadedVMObjects[ removalNodeIndex ];
    var parentNodeIndex = parentInfo ? getIndexFromArray( loadedVMObjects, parentInfo ) : getParentNodeIndex( loadedVMObjects, removalNodeIndex );

    var numberOfChildNodes = getNumberOfChildRows( loadedVMObjects, removalNode, removalNodeIndex );
    var removedNodes = loadedVMObjects.splice( removalNodeIndex, numberOfChildNodes + 1 );
    if( _.isUndefined( avoidDeselectOfRemovedNode ) || avoidDeselectOfRemovedNode === false ) {
        removeNodesFromSelectionModel( removedNodes );
    }

    // if removing 0th level node
    if( parentNodeIndex > -1 ) {
        var parentNode = loadedVMObjects[ parentNodeIndex ];
        exports.removeChildFromParentChildrenArray( parentNode, removalNode );
    }
    return loadedVMObjects;
};

export let updateNodeIfUidChanged = function( updateNodeInfo, parentInfo, loadedVMObjects ) {
    var updateNodeIndex = getIndexFromArray( loadedVMObjects, updateNodeInfo );
    if( updateNodeIndex === -1 ) {
        return;
    }

    // return if found no change in uid
    var updateNode = loadedVMObjects[ updateNodeIndex ];
    if( updateNode.uid === ( updateNodeInfo.uid || updateNodeInfo.occurrenceId ) ) {
        return;
    }

    // get parent index before removing the child
    var parentNodeIndex = parentInfo ? getIndexFromArray( loadedVMObjects, parentInfo ) :
        getParentNodeIndex( loadedVMObjects, updateNodeIndex );

    // replace child with new uid node
    var removedNode = loadedVMObjects.splice( updateNodeIndex, 1 )[ 0 ];
    var childVMO = createSimilarNodeWithUidUpdated( removedNode, updateNodeInfo );
    loadedVMObjects.splice( updateNodeIndex, 0, childVMO );
    replaceOldUidWithNewUidInSelectionModel( removedNode.uid, updateNodeInfo.occurrenceId );

    // update parent info
    if( parentNodeIndex > -1 ) {
        var parentNode = loadedVMObjects[ parentNodeIndex ];
        var childIndexInParent = getIndexFromArray( parentNode.children, removedNode );
        parentNode.children.splice( childIndexInParent, 1 );
        parentNode.children.splice( childIndexInParent, 0, childVMO );
    }
    return loadedVMObjects;
};

export let addChildNode = function( childInfoToAdd, nthChildOfParent, parentInfo, loadedViewModelObjects ) {
    var parentNodeIndex = parentInfo ? getIndexFromArray( loadedViewModelObjects, parentInfo ) : -1;
    if( parentNodeIndex < 0 ) {
        return;
    }
    var parentNode = loadedViewModelObjects[ parentNodeIndex ];

    // if child already present in vmc
    var currentChildNodeIndex = getIndexFromArray( loadedViewModelObjects, childInfoToAdd );
    if( currentChildNodeIndex > -1 ) {
        // if uid is also same move it to given location, else update node with new uid
        loadedViewModelObjects[ currentChildNodeIndex ].uid === ( childInfoToAdd.uid || childInfoToAdd.occurrenceId ) ?
            moveNodeAlongWithChildrenNodesToNewLocation( loadedViewModelObjects, currentChildNodeIndex, nthChildOfParent, parentNodeIndex ) :
            exports.updateNodeIfUidChanged( childInfoToAdd, parentInfo );
    } else {
        var newChildNode = occmgmtVMTNodeCreateService.createVMNodeUsingOccInfo( childInfoToAdd, nthChildOfParent, parentNode.levelNdx + 1 );
        var expectedVmcIndex = exports.getVmcIndexForParentsNthChildIndex( loadedViewModelObjects, parentNodeIndex, nthChildOfParent );
        loadedViewModelObjects.splice( expectedVmcIndex, 0, newChildNode );
        //Add the new treeNode to the parentVMO (if one exists) children array
        exports.addChildToParentsChildrenArray( parentNode, newChildNode, nthChildOfParent );
    }
    return loadedViewModelObjects;
};

/**
  * Update parentVMO state ( mark as expanded=true, isLeaf=false)
  */

/**
  * @param {Object} parentVMO parent VMO
  */
let _updateParentNodeToExpandedState = function( parentVMO ) {
    if( parentVMO ) {
        //the parent exists in the VMO lets make sure it is now marked as parent and expanded
        parentVMO.expanded = true;
        parentVMO.isExpanded = true;
        parentVMO.isLeaf = false;
        if( !parentVMO.children ) {
            parentVMO.children = [];
        }
    }
};

/**
  * Inserts objects added under selected parent(contained in the addElementResponse) into the viewModelCollection
  *
  * @param {Object} loadedVMOs loaded VMOs
  * @param {Object} parentVMO The input parent element on which addd is initiated.
  * @param {Object} parentIdx Parent Idx
  * @param {Object} pagedChildOccurrences childOccurrences from addObject() SOA
  * @param {Object} newElements List of new elements to add
  *
  */
let _insertAddedElementIntoSelectedParent = function( loadedVMOs, parentVMO, parentIdx, pagedChildOccurrences, newElements ) {
    for( var i = 0; i < newElements.length; i++ ) {
        var newlyAddedChildElementUid = newElements[ i ].occurrenceId ? newElements[ i ].occurrenceId : newElements[ i ].uid;

        /**
          * addObject SOA only returns pagedOccInfo objects for one of the unique parent.
          */
        var pagedChildIdx = _.findLastIndex( pagedChildOccurrences, function( co ) {
            return co.occurrenceId === newlyAddedChildElementUid;
        } );

        if( pagedChildIdx > -1 ) {
            //In a collapsed parent there will be no child occs in the viewModelCollection.  Need to add them
            //back by looping through each of the pagedOccInfo
            _.forEach( pagedChildOccurrences, function( childOccurrence ) {
                if( parentVMO ) {
                    // In move up, move down case, loadedVMOs is not updated yet with newly added element which is present in parentVMO.children
                    // Hence, always insert added element into tree view.
                    // Anyway "_insertAddedElementIntoTreeView" checks if viewModelCollection already have a vmTreeNode with the same uid.
                    _insertAddedElementIntoTreeView( loadedVMOs,
                        pagedChildOccurrences, parentVMO, parentIdx, -1, childOccurrence );
                } else {
                    //Top level case
                    _insertAddedElementIntoTreeView( loadedVMOs,
                        pagedChildOccurrences, null, parentIdx, -1, childOccurrence );
                }
            } );
        }
    }
};

/**
  * Inserts objects added for reused parent (contained in the addElementResponse) into the viewModelCollection
  *
  * @param {Object} loadedVMOs Loaded ViewModelObjects
  * @param {Object} newElementInfo Single new element info to add
  *
  */
function _insertSingleAddedElementIntoViewModelCollectionForReusedParents( loadedVMOs, parentVMO, newElementInfo ) {
    // This map has the information of new element and its position within parent assembly
    var newElements = newElementInfo.newElementToPositionMap[ 0 ];
    var elementPositions = newElementInfo.newElementToPositionMap[ 1 ];
    //First find if the parent exists in the viewModelCollection
    var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
        return vmo.uid === newElementInfo.parentElement.uid;
    } );

    // We need to create a sorted map which is sorted by their position.
    // This is required so that elements get added at right position.
    var newElementPositions = [];
    for( var i = 0; i < elementPositions.length; i++ ) {
        var newElement = newElementInfo.newElements.filter( function( newElement ) {
            return newElement.occurrenceId === newElements[ i ].uid;
        } );
        newElementPositions.push( {
            element: newElement[ 0 ],
            position: elementPositions[ i ]
        } );
    }
    var orderedElementPositions = _.orderBy( newElementPositions, [ 'position' ], [ 'asc' ] );

    for( var i = 0; i < orderedElementPositions.length; i++ ) {
        var newlyAddedChildElement = orderedElementPositions[ i ].element;
        var newlyAddedChildElementPosition = orderedElementPositions[ i ].position;

        // Add new element at the appropriate position
        if( parentVMO ) {
            var childIdx = _.findLastIndex( parentVMO.children, function( vmo ) {
                return vmo.uid === newlyAddedChildElement.uid;
            } );
            // Only create and insert tree nodes for occs that don't already exist the parents child list
            if( childIdx < 0 ) {
                _insertAddedElementIntoTreeView( loadedVMOs,
                    null, parentVMO, parentIdx, newlyAddedChildElementPosition, newlyAddedChildElement );
            }
        } else {
            // top level case (no parent)
            _insertAddedElementIntoTreeView( loadedVMOs,
                null, null, parentIdx, newlyAddedChildElementPosition, newlyAddedChildElement );
        }
    }
}

/**
  * Inserts objects added (contained in the addElementResponse) into the viewModelCollection
  *
  * @param {Object} loadedVMOs Loaded VMOs
  * @param {Object} pagedChildOccurrences childOccurrences from addObject() SOA
  * @param {Object} parentVMO (null if no parentVMO)
  * @param {Number} parentIdx - index of the parentVMO in the viewModelCollection (-1 if no parentVMO)
  * @param {Number} newChildIdx - index of the newchild in the SOA response (-1 if not found)
  * @param {Object} childOccurrence - child occurrence to add
  */
function _insertAddedElementIntoTreeView( loadedVMOs,
    pagedChildOccurrences, parentVMO, parentIdx, newChildIdx, childOccurrence ) {
    //check to see if childOcc already has vmTreeNode in the viewModelCollection
    var ndx = _.findLastIndex( loadedVMOs, function( vmo ) {
        return vmo.uid === childOccurrence.occurrenceId;
    } );

    if( ndx > -1 ) {
        // already have a vmTreeNode with the same uid in the viewModelCollection -- nothing to do
        return;
    }

    var childlevelIndex = 0;
    var parentUid = null;
    if( parentVMO ) {
        childlevelIndex = parentVMO.levelNdx + 1;
        parentUid = parentVMO.uid;
    }

    var childUid = childOccurrence.uid;
    if( childUid === undefined ) {
        childUid = childOccurrence.occurrenceId;
    }
    //Find the childIndex in the childOccurences (if we can)
    var childIdx = -1;
    if( newChildIdx > -1 ) {
        childIdx = newChildIdx;
    } else {
        childIdx = _.findLastIndex( pagedChildOccurrences, function( co ) {
            return co.occurrenceId === childUid;
        } );

        //Child uid does not exist in the pagedChildOccs just add the end
        if( childIdx < 0 ) {
            childIdx = pagedChildOccurrences.length - 1;
        }
    }

    //corner case not in pagedChildOccs and has no length it is truly empty
    if( childIdx < 0 ) {
        childIdx = 0;
    }

    //Create the viewModelTreeNode from the child ModelObject, child index and level index
    var currentContext = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
    var pciUid = currentContext.productContextInfo.uid;
    var modelObject = cdmSvc.getObject( childUid );
    var modelObjectType = null;
    if( modelObject ) {
        modelObjectType = modelObject.type;
    }
    var childVMO = occmgmtVMTNodeCreateService.createVMNodeUsingOccInfo( childOccurrence, childIdx, childlevelIndex, pciUid, parentUid, modelObjectType );

    //See if we have any expanded children to skip over in the viewModelCollection
    var numFirstLevelChildren = 0;
    for( var i = parentIdx + 1; i < loadedVMOs.length; i++ ) {
        if( numFirstLevelChildren === childIdx && loadedVMOs[ i ].levelNdx <= childlevelIndex ) {
            break;
        }
        if( loadedVMOs[ i ].levelNdx === childlevelIndex ) {
            numFirstLevelChildren++;
        }
        if( loadedVMOs[ i ].levelNdx < childlevelIndex ) {
            // no longer looking at first level children (now looking at an uncle)
            break;
        }
    }
    var newIndex = i;

    // Add the new treeNode to the parentVMO (if one exists) children array
    // In split view mode, when cut paste operation is perform, then contextKey for newly added childVMO is same as parentVMO contextKey
    if( parentVMO && parentVMO.children ) {
        if( childVMO.contextKey !== parentVMO.contextKey ) {
            childVMO.contextKey = parentVMO.contextKey;
        }
        // insert the new treeNode in the parentVMO.children at the correct position
        parentVMO.children.splice( childIdx, 0, childVMO );
        parentVMO.isLeaf = false;
        parentVMO.totalChildCount = parentVMO.children.length;
        // insert the new treeNode in the viewModelCollection at the correct location
        loadedVMOs.splice( newIndex, 0, childVMO );
    }
}

var updateParentsChildrenListWithNewChildNode = function( vmc, srcNode, childNodeToAdd ) {
    if( srcNode.props ) {
        let parentUid = srcNode.props.awb0Parent.dbValues[ 0 ];
        // get parent to updates its children
        var parentVmoIndex = vmc.findViewModelObjectById( parentUid );
        if( parentVmoIndex > -1 ) {
            var parentVMO = vmc.getViewModelObject( parentVmoIndex );
            parentVMO.children.splice( srcNode.childNdx, 1, childNodeToAdd );
        }
    }
};

/**
  * This function will only perform replacement of SRUID objects with nodes in the tree
  * and ignore any other CSID/other entries sent in source UID list
  * @param {String} viewKey view key
  * @param {Object} eventData event data
  * @returns {Boolean} True/False whether object was replaced
  */
var replaceSourceNodeWithTargetNode = function( viewKey, eventData ) {
    let isObjectReplaced = false;

    if( eventData.srcUids && eventData.srcUids.length > 0 ) {
        let viewModelCollection = _.get( appCtxSvc.getCtx(), viewKey + '.vmc' );
        let loadedViewModelObjects = viewModelCollection.getLoadedViewModelObjects();

        for( let i = 0; i < eventData.srcUids.length; i++ ) {
            let sourceIndex = viewModelCollection.findViewModelObjectById( eventData.srcUids[ i ] );
            // Ensure replacement is performed only on valid SRUIDs
            const sruidPrefix = 'SR::N::';
            if( sourceIndex > -1 && eventData.srcUids[ i ].includes( sruidPrefix ) ) {
                let sourceNode = viewModelCollection.getViewModelObject( sourceIndex );
                let numberOfChildRows = getNumberOfChildRows( loadedViewModelObjects, sourceNode, sourceIndex );
                let targetUid = eventData.targetUids ? eventData.targetUids[ i ] : eventData.srcUids[ i ];
                let targetModelObject = cdmSvc.getObject( targetUid );
                let targetNode = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( targetModelObject, sourceNode.childNdx, sourceNode.levelNdx );

                // Preserve the selection state of the source node
                if( sourceNode.selected ) {
                    targetNode.selected = true;
                }

                // If the target node is a clone, retain the alternateID from the source node
                if( targetNode.id === sourceNode.id ) {
                    targetNode.alternateID = sourceNode.alternateID;
                }

                // Update the parent's children list with the new target node
                updateParentsChildrenListWithNewChildNode( viewModelCollection, sourceNode, targetNode );

                // Replace the source node and its children with the target node in the loaded objects
                loadedViewModelObjects.splice( sourceIndex, 1 + numberOfChildRows );
                loadedViewModelObjects.splice( sourceIndex, 0, targetNode );

                isObjectReplaced = true;
            }
        }

        // Update the tree data provider with the modified view model objects
        let treeDataProvider = _.get( appCtxSvc.getCtx(), viewKey + '.treeDataProvider' );
        treeDataProvider.update( loadedViewModelObjects );
    }

    // Notify the event bus to re-render the table on the client
    eventBus.publish( 'reRenderTableOnClient' );

    return isObjectReplaced;
};

var replaceInInactiveView = function( viewKey, eventData ) {
    var affectedElements = occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( viewKey, cdmSvc.getObject( eventData.srcUids[ 0 ] ) );

    var objectsReplaced = replaceSourceNodeWithTargetNode( viewKey, eventData );

    //if objects are replaced in inactive view, means we got updated objects for other view from server. So, reload is not needed.
    if( affectedElements.length > 0 && !objectsReplaced ) {
        for( var i = 0; i < affectedElements.length; i++ ) {
            var affectedObjects = eventData.srcUids.filter( function( mo ) {
                return mo === affectedElements[ i ].id;
            } );
            if( affectedObjects.length === 0 ) {
                _.set( appCtxSvc.getCtx(), viewKey + '.configContext.startFreshNavigation', true );
                eventBus.publish( 'acePwa.reset', { viewToReset: viewKey, silentReload: true } );
                break;
            }
        }
    }
};

var removeAndDeselectGivenNodeFromVMCollectionIfApplicable = function( vmc, loadedVMOs, removedObject, view ) {
    _.remove( loadedVMOs, function( vmo ) {
        if( vmo.props && removedObject.props &&
             vmo.props.awb0CopyStableId.dbValues[ 0 ] === removedObject.props.awb0CopyStableId.dbValues[ 0 ] ) {
            var parentOfVMO = cdmSvc.getObject( vmo.props.awb0Parent.dbValues[ 0 ] );
            var parentOfDeletedElement = cdmSvc.getObject( removedObject.props.awb0Parent.dbValues[ 0 ] );
            if( parentOfDeletedElement && parentOfVMO.props && parentOfDeletedElement.props &&
                 parentOfVMO.props.awb0UnderlyingObject.dbValues[ 0 ] === parentOfDeletedElement.props.awb0UnderlyingObject.dbValues[ 0 ] ) {
                var parentNode = vmc.getViewModelObject( vmc.findViewModelObjectById( vmo.props.awb0Parent.dbValues[ 0 ] ) );
                var childrenNode = vmc.getViewModelObject( vmc.findViewModelObjectById( vmo.uid ) );
                exports.removeChildFromParentChildrenArray( parentNode, childrenNode );
                eventBus.publish( 'aceElementsDeSelectedEvent', {
                    elementsToDeselect: [ vmo ],
                    viewToReact: view
                } );
                return true;
            }
        }
    } );
};

var areUnderlyingOrStableIdSame = function( modelObject1, modelObject2 ) {
    var underlyingObjectOfAffectedElement = _.get( modelObject1, 'props.awb0UnderlyingObject.dbValues[0]' );
    var cloneStableIDOfAffectedElement = _.get( modelObject1, 'props.awb0CopyStableId.dbValues[0]' );
    var cloneStableIDOfVMO = _.get( modelObject2, 'props.awb0CopyStableId.dbValues[0]' );
    var underlyingObjectOfVMO = _.get( modelObject2, 'props.awb0UnderlyingObject.dbValues[0]' );
    return !_.isEmpty( cloneStableIDOfVMO ) && !_.isEmpty( cloneStableIDOfAffectedElement ) &&
         _.isEqual( cloneStableIDOfVMO, cloneStableIDOfAffectedElement ) ||
         !_.isEmpty( underlyingObjectOfVMO ) && !_.isEmpty( underlyingObjectOfAffectedElement ) &&
         _.isEqual( underlyingObjectOfVMO, underlyingObjectOfAffectedElement );
};

export let deleteExpandedNodeCache = function( vmc, eventData ) {
    if( vmc ) {
        let updatedHierarchy = [];
        eventData.updatedObjects.map( function( updatedObject ) {
            updatedHierarchy.push( updatedObject );
            let parentObjectUid = occmgmtUtils.getParentUid( updatedObject );
            while( parentObjectUid ) {
                let parentObject = cdmSvc.getObject( parentObjectUid );
                if( parentObject ) {
                    updatedHierarchy.push( parentObject );
                    parentObjectUid = occmgmtUtils.getParentUid( parentObject );
                }
            }
        } );

        // eslint-disable-next-line array-callback-return
        vmc.getLoadedViewModelObjects().map( function( vmoNode ) {
            if( vmoNode.__expandState ) {
                updatedHierarchy.forEach( function( updatedObject ) {
                    if( areUnderlyingOrStableIdSame( vmoNode, updatedObject ) ) {
                        delete vmoNode.__expandState;
                        delete vmoNode.children;
                    }
                } );
            }
            if( vmoNode.isExpanded === true && vmoNode.props && vmoNode.props.awb0NumberOfChildren && vmoNode.props.awb0NumberOfChildren.dbValues[ 0 ] === '0' && !vmoNode.children ) {
                eventBus.publish( vmc.name + '.addNodeToCollapsedState', vmoNode );
            }
        } );
    }
};

/**
 * Adds new elements into the loaded ViewModelObjects (VMOs) array.
 * @param {Object} vmCollection - The collection of ViewModelObjects.
 * @param {Object} addElementResponse - The response containing new element information.
 */
export let addElementsToLoadedVMO = function( vmCollection, addElementResponse ) {
    if ( !vmCollection || !addElementResponse ) {
        return;
    }
    if( addElementResponse.newElementInfos ) {
        let loadedVMOs = vmCollection.getLoadedViewModelObjects();
        for( var i = 0; i < addElementResponse.newElementInfos.length; ++i ) {
            if ( !_.isEmpty( addElementResponse.newElementInfos[ i ].newElementToPositionMap ) ) {
                var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
                    return vmo.uid === addElementResponse.newElementInfos[ i ].parentElement.uid;
                } );
                if( parentIdx >= 0 ) {
                    var parentVMO = vmCollection.getViewModelObject( parentIdx );
                    // Add the children for expanded parent instances only. If collapsed dont add.
                    if( parentVMO && parentVMO.isExpanded ) {
                        _updateParentNodeToExpandedState( parentVMO );
                        _insertSingleAddedElementIntoViewModelCollectionForReusedParents( loadedVMOs, parentVMO, addElementResponse.newElementInfos[ i ] );
                    }
                }
            }
        }
    }
};

export let initialize = function() {
    var ctx = appCtxSvc.getCtx();
    _eventSubDefs.push( eventBus.subscribe( 'ace.replaceRowsInTree', function( eventData ) {
        replaceSourceNodeWithTargetNode( ctx.aceActiveContext.key, eventData );
        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveView ) {
            replaceInInactiveView( inactiveView, eventData );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'ace.elementsRemoved', function( eventData ) {
        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();

        if( inactiveView ) {
            var context = _.get( appCtxSvc.ctx, inactiveView );
            var vmc = context.vmc;
            var treeDataProvider = context.treeDataProvider;
            var loadedVMOs = vmc.getLoadedViewModelObjects();

            if( !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
                if( eventData && eventData.removedObjects.length > 0 ) {
                    _.forEach( eventData.removedObjects, function( removedObject ) {
                        removeAndDeselectGivenNodeFromVMCollectionIfApplicable( vmc, loadedVMOs, removedObject, inactiveView );
                    } );
                    treeDataProvider.update( loadedVMOs );
                    //removeAndDeselectGivenNodeFromVMCollectionIfApplicable has a condition to check if removedObject exist in the vmc.
                    //Since removedObject is in somecases already removed from vmc, thus aceElementsDeSelectedEvent event is not publish for inactiveview.
                    //deSelectFromInactiveView will publish aceElementsDeSelectedEvent if removedObject was selected in inactive view.
                    exports.deSelectFromInactiveView( eventData.removedObjects, inactiveView );
                }
            } else {
                if( eventData && eventData.removedObjects.length > 0 ) {
                    eventBus.publish( 'aceElementsDeSelectedEvent', {
                        elementsToDeselect: eventData.removedObjects,
                        viewToReact: inactiveView
                    } );
                }
            }
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function( event ) {
        var updatedParentElement = event.updatedParentElement;
        if( !updatedParentElement ) {
            updatedParentElement = event.addElementInput && event.addElementInput.parent ? event.addElementInput.parent : ctx.aceActiveContext.context?.addElement?.parent;
        }
        var viewToReact = event && event.viewToReact ? event.viewToReact : ctx.aceActiveContext.key;
        addNewlyAddedElement( viewToReact, event.addElementResponse, updatedParentElement );
        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveView ) {
            addNewlyAddedElementToInActiveview( inactiveView, event, updatedParentElement );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'occurrenceUpdatedByEffectivityEvent', function( data ) {
        if( !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
            var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
            if( inactiveView && occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveView, ctx.selected ).length > 0 ) {
                eventBus.publish( 'acePwa.reset', { viewToReset: inactiveView, silentReload: true } );
            }
        }
    } ) );

    let updateInactiveViewNeeded = function( addElementResponse, updatedParentElement ) {
        // If there is only one entry in addElementResponse.newElementInfos and the parent is same as the current parent under which the element is added.
        // then there is no need to update the inactive view.
        var updateNeeded = true;
        if( addElementResponse.newElementInfos.length === 1 && addElementResponse.newElementInfos[0].parentElement.uid === updatedParentElement.uid ) {
            updateNeeded = false;
        }

        return updateNeeded;
    };

    var addNewlyAddedElementToInActiveview = function( view, eventData, updatedParentElement ) {
        if( occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
            addNewlyAddedElement( view, eventData.addElementResponse, updatedParentElement );
        } else if( eventData.addElementResponse.newElementInfos && eventData.addElementResponse.newElementInfos.length > 0
                   && updateInactiveViewNeeded( eventData.addElementResponse, updatedParentElement ) ) {
            //AddObject2 soa gives following information about inactive view :
            // newElementToPositionMap, newElements, parentElement which we can use to update the
            // inactive view explicitly rather than refreshing inactive view
            let context = _.get( appCtxSvc.ctx, view );
            let vmCollection = context.vmc;
            let treeDataProvider = context.treeDataProvider;
            addElementsToLoadedVMO( vmCollection, eventData.addElementResponse );
            treeDataProvider.update( vmCollection.getLoadedViewModelObjects() );
        }
    };

    var addNewlyAddedElement = function( view, addElementResponse, updatedParentElement ) {
        var context = _.get( appCtxSvc.ctx, view );
        var vmCollection = context.vmc;
        var treeDataProvider = context.treeDataProvider;
        if( addElementResponse && vmCollection ) {
            var isReloadNeeded = addElementResponse.reloadContent;
            var selectedNewElementsInfos = addElementResponse.selectedNewElementInfos ? addElementResponse.selectedNewElementInfos : [ addElementResponse.selectedNewElementInfo ];
            if( isReloadNeeded ) {
                // In case we are adding content and the reloadContent is required,
                // then make sure to set the startFreshNavigation as true. This is required by the server.
                context.transientRequestPref.startFreshNavigation = true;
                selectedNewElementsInfos.forEach( function( selectedNewElementInfo ) {
                    var newlyAddedChildElementUid;
                    if( selectedNewElementInfo.newElements ) {
                        newlyAddedChildElementUid = selectedNewElementInfo.newElements[ 0 ].uid;
                    } else {
                        newlyAddedChildElementUid = addElementResponse.newElementInfos[ 0 ].newElements[ 0 ].occurrenceId;
                    }
                    AwTimeoutService.instance( function() {
                        aceContextStateMgmtService.updateContextState( view, {
                            c_uid: newlyAddedChildElementUid
                        }, true );
                        // In-case of multi-select we are reloading content, as dataProvider does not support focus action for multi-select.
                        if( selectedNewElementInfo.newElements && selectedNewElementInfo.newElements.length > 1 ) {
                            eventBus.publish( 'acePwa.reset', {
                                viewToReset: ctx.aceActiveContext.key
                            } );
                        }
                    }, 300 );
                } );
            } else {
                // First add the children for selected parent node.
                var loadedVMOs = vmCollection.getLoadedViewModelObjects();
                if( selectedNewElementsInfos?.length > 0 ) {
                    selectedNewElementsInfos.forEach( function( selectedElementInfo ) {
                        addChildrenToSelectedParent( selectedElementInfo, vmCollection, loadedVMOs, updatedParentElement );
                    } );
                }
                if( !_.isEmpty( addElementResponse.newElementInfos ) ) {
                    addElementsToLoadedVMO( vmCollection, addElementResponse );
                }
                treeDataProvider.update( loadedVMOs );
            }
        }
    };

    var addChildrenToSelectedParent = function( selectedElementInfo, vmCollection, loadedVMOs, updatedParentElement ) {
        var pagedChildOccurrences = selectedElementInfo.pagedOccurrencesInfo.childOccurrences;
        var parentElement = selectedElementInfo.parentElement ? selectedElementInfo.parentElement : updatedParentElement;
        var vmoId = vmCollection.findViewModelObjectById( parentElement.uid );
        var parentVMO = loadedVMOs[ vmoId ];
        var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
            return vmo.uid === parentElement.uid;
        } );
        _updateParentNodeToExpandedState( parentVMO );
        if ( pagedChildOccurrences.length > 0 ) {
            _insertAddedElementIntoSelectedParent( loadedVMOs, parentVMO, parentIdx, pagedChildOccurrences, selectedElementInfo.newElements );
        }
    };
};

export let deSelectFromInactiveView = function( removedObjects, inactiveView ) {
    inactiveView = inactiveView ? inactiveView : occmgmtSplitViewUpdateService.getInactiveViewKey();
    var inactiveContext = appCtxSvc.getCtx( inactiveView );
    var pwaSelection = inactiveContext.pwaSelection;
    _.forEach( removedObjects, function( removedObject ) {
        var index = _.findLastIndex( pwaSelection, function( selected ) {
            if( removedObject.hasOwnProperty( 'props' ) && selected.hasOwnProperty( 'props' ) ) {
                //check if removedElement was there in the pwaSelection list
                return removedObject.props.awb0CopyStableId.dbValues[ 0 ] === selected.props.awb0CopyStableId.dbValues[0];
            }
        } );
        if( index >= 0 ) {
            eventBus.publish( 'aceElementsDeSelectedEvent', {
                elementsToDeselect: [ pwaSelection[ index ] ],
                viewToReact: inactiveView
            } );
        }
    } );
};

/**
  * Function to build the occContext based on the getOcc response for load and select action
  *
  * @param {Object} occContext - The 'data' object from viewModel
  * @param {Object} selections Selection to add
  * @param {Object} lastSelection lastSelection
  * @param {Object} elementToPCIMap Element to PCI map
  * @param {Object} pci_uid ProductContextInfo UID
  * @param {Object} isRemoveUnderDifferentParents - true if it is remove multiple elements under different parents case.
  * @param {Object} parents - Array of all parent elements under which multiple elements are being removed.
  * @returns {Object} Updated 'data' object from viewModel
  */
function _buildOccContextValueForLoadNSelect( occContext, selections, lastSelection, elementToPCIMap, pci_uid, isRemoveUnderDifferentParents, parents ) {
    var occContextValue = { ...occContext.getValue() };

    if( isRemoveUnderDifferentParents ) {
        // If it is remove multiple elements under different parents, then setting pwaSelection to all parents to avoid flicker of selection
        // otherwise for each getOcc call each parent was getting selected rsulting into flicker of selection.
        occContextValue.pwaSelection = parents;
        occContextValue.currentState.c_uid = _.last( parents ).uid;
    } else {
        let isMultiSelectEnabled = occContextValue.treeDataProvider.selectionModel.isMultiSelectionEnabled() || occContextValue.pwaSelection.length > 1;
        if ( isMultiSelectEnabled ) {
            let selectionsToAdd = [];
            let numberOfCurrentSelection = occContextValue.pwaSelection.length;
            let numberOfSelections = selections.length;
            for ( var j = 0; j < numberOfSelections; j++ ) {
                let selectionExist = false;
                for ( var i = 0; i < numberOfCurrentSelection; i++ ) {
                    if ( occContextValue.pwaSelection[i].uid === selections[j].uid ) {
                        selectionExist = true;
                        break;
                    }
                }
                if ( !selectionExist ) {
                    selectionsToAdd = selectionsToAdd.concat( selections[j] );
                }
            }

            if ( selectionsToAdd.length > 0 ) {
                occContextValue.pwaSelection = occContextValue.pwaSelection.concat( selectionsToAdd );
            }

            occContextValue.pwaSelection = [ ...occContextValue.pwaSelection ];
        } else {
            occContextValue.pwaSelection = selections;
        }
        occContextValue.currentState.c_uid = lastSelection.uid;
    }
    occContextValue.productContextInfo = elementToPCIMap && elementToPCIMap[lastSelection.uid] ? cdmSvc.getObject( elementToPCIMap[lastSelection.uid] ) : cdmSvc.getObject( pci_uid );
    occContextValue.currentState.pci_uid = occContextValue.productContextInfo.uid;
    occContextValue.elementToPCIMap = elementToPCIMap;
    occContextValue.onPwaLoadComplete += 1;
    occContextValue.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( occContextValue.productContextInfo );
    occContextValue.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( occContextValue.productContextInfo );
    occContextValue.workingContextObj = occmgmtUtils.getSavedWorkingContext( occContextValue.productContextInfo );
    occContextValue.objectSetUri = occContextValue.productContextInfo.props.awb0ClientScopeUri.dbValues[0];
    occContextValue.lastDpAction = 'loadAndSelect';
    return occContextValue;
}

/**
 * @param {Object} occContext - Atomic data
 * @param {Object} selection - selected object
 * @param {Object} productContextInfo - ProductContextInfo
 * @param {Object} nodeToExpandAfterFocus - Case of Object to focus n then Expand (HDD->BasePlate->Motor Electronics Assembly)
 * @param {Object} nodeToExpand - Node to expand after getOccurrences() call
 * @param {Object} updateVmosNContextOnPwaReset - true if you want to do tree update via pwaReset path.
 * @param {Object} getOccSoaInput - getOccSoaInput ( if not provided, will build default one ).
 * @param {Object} retainExpansionState - true if expansion states to be retained ( pass current expanded nodes to server ).
 * @param {Object} isRemoveUnderDifferentParents - true if it is remove multiple elements under different parents case.
 * @param {Object} parents - Array of all parent elements under which multiple elements are being removed.
 */
export let loadAndSelectProvidedObjectInTree = function( occContext, selection, productContextInfo, nodeToExpandAfterFocus,
    nodeToExpand, updateVmosNContextOnPwaReset, getOccSoaInput, retainExpansionState, isRemoveUnderDifferentParents, parents ) {
    var currentContext = _.get( appCtxSvc.ctx, appCtxSvc.ctx.aceActiveContext.key );
    let contextState = {
        context: currentContext,
        occContext: occContext
    };
    var vmCollection = occContext.vmc;
    var loadedVMOs = vmCollection.getLoadedViewModelObjects();

    nodeToExpand = nodeToExpand ? nodeToExpand : nodeToExpandAfterFocus;
    let nodeToExpandIsAlreadyExpanded = false;
    let vmoId = vmCollection.findViewModelObjectById( nodeToExpand );
    if( vmoId !== -1 ) {
        let nodeToExpandVmo = loadedVMOs[ vmoId ];
        nodeToExpandIsAlreadyExpanded = nodeToExpandVmo.isExpanded;
    }

    var lastSelection = _.last( selection );
    vmoId = vmCollection.findViewModelObjectById( lastSelection.uid );
    var currentState = { ...occContext.value.currentState };
    if( vmoId !== -1 && ( nodeToExpandIsAlreadyExpanded || !nodeToExpand ) && !getOccSoaInput ) {
        currentState.c_uid = selection[ 0 ].uid;
        occmgmtUtils.updateValueOnCtxOrState( 'currentState', currentState, occContext );
    } else {
        let parentUid = nodeToExpand ? nodeToExpand : lastSelection.props.awb0BreadcrumbAncestor.dbValues[ 0 ];
        let treeLoadInput = {
            startChildNdx: 0,
            displayMode: 'Tree',
            addAfter: true,
            parentElement: parentUid,
            loadIDs: {
                uid: occContext.currentState.uid
            }
        };

        let soaInput = getOccSoaInput ? getOccSoaInput : occmgmtGetSvc.getDefaultSoaInput();
        let pci_uid = productContextInfo ? productContextInfo.uid : currentState.pci_uid;

        soaInput.inputData.requestPref.loadTreeHierarchyThreshold = [ '50' ];
        soaInput.inputData.config.productContext = cdmSvc.getObject( pci_uid );
        if( !nodeToExpand ) {
            soaInput.inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( lastSelection.uid );
        }else{
            treeLoadInput.skipFocusOccurrenceCheck = true;
        }
        if( retainExpansionState ) {
            let dummyDataProvider = {
                viewModelCollection: vmCollection
            };
            soaInput.inputData.requestPref.expandedNodes = aceTreeTableStateService.getCSIDChainsForExpandedNodes( dummyDataProvider );
        }

        occmgmtGetSvc.getOccurrences( treeLoadInput, soaInput, contextState ).then(
            function( response ) {
                let elementToPCIMap = aceGetOccsResponseService.updateElementToPCIMap( response, contextState );
                let occContextValue = _buildOccContextValueForLoadNSelect( occContext, selection, lastSelection, elementToPCIMap, pci_uid, isRemoveUnderDifferentParents, parents );
                /*When adding multiple products, pwaReset approach is cleaning up multi-selections
                //( because of multiple selection callbacks we get)..Also, product not selected issue we dont get for multi-select
                So, avoiding that path now...will have only one approach going fwd, once other issues are solved.
                */
                if( updateVmosNContextOnPwaReset ) {
                    if( occContextValue.pwaSelection.length > 1 ) {
                        response.objectsToFocusOn = occContextValue.pwaSelection;
                        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect:occContextValue.pwaSelection, overwriteSelections:true }, occContext );
                    }
                    let value = {
                        transientRequestPref: {
                            getOccResponse: response,
                            skipActiveTabUpdate:true,
                            lastDpAction : 'loadAndSelect'
                        },
                        pwaReset: true
                    };
                    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
                } else {
                    var childrenInfo = undefined;
                    let vmoToLookFor =  nodeToExpandAfterFocus && !nodeToExpandIsAlreadyExpanded ? lastSelection.props.awb0BreadcrumbAncestor.dbValues[0] : nodeToExpand;
                    vmoId = vmCollection.findViewModelObjectById( vmoToLookFor  );
                    if( vmoId !== -1 ) {
                        var parentVMO = loadedVMOs[ vmoId ];
                        var parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
                            return vmo.uid === parentVMO.uid;
                        } );
                        _.forEach( response.parentChildrenInfos, function( parentChildInfo ) {
                            if( _.isEqual( parentChildInfo.parentInfo.occurrenceId, vmoToLookFor ) ) {
                                childrenInfo = parentChildInfo.childrenInfo;
                            }
                        } );

                        _updateParentNodeToExpandedState( parentVMO );
                        if( childrenInfo && childrenInfo.length > 0 ) {
                            _insertAddedElementIntoSelectedParent( loadedVMOs, parentVMO, parentIdx, childrenInfo, [ { occurrenceId: childrenInfo[ 0 ].occurrenceId } ] );
                        }
                    }

                    var treeDataProvider = currentContext.treeDataProvider;
                    treeDataProvider.update( loadedVMOs );

                    vmoId = vmCollection.findViewModelObjectById( nodeToExpand );
                    if( vmoId !== -1 ) {
                        var nodeToExpandVMO = loadedVMOs[ vmoId ];
                        if( !nodeToExpandVMO.isExpanded ) {
                            if( nodeToExpandAfterFocus ) {
                                let elementToSelect = cdmSvc.getObject( nodeToExpandAfterFocus );
                                occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect: [ elementToSelect ], overwriteSelections:false }, occContext );
                            }
                            loadAndSelectProvidedObjectInTree( occContext, selection, productContextInfo, undefined, nodeToExpandVMO.id );
                        }else {
                            occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
                        }
                    }
                }
            }
        );
    }
};

/**
 * Adds new elements into Tree (Active View and Inactive View).
 * @internal
 * @param {Object} newElementInfos - The new element information.
 */
export let addElementsInTrees = function( newElementInfos ) {
    if( newElementInfos && newElementInfos.length > 0 ) {
        let inputData = {
            newElementInfos : newElementInfos
        };

        var context = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
        var vmCollection = context.vmc;
        var treeDataProvider = context.treeDataProvider;
        addElementsToLoadedVMO( vmCollection, inputData );
        treeDataProvider.update( vmCollection.getLoadedViewModelObjects() );

        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveView ) {
            var inactiveContext = appCtxSvc.getCtx( inactiveView );
            vmCollection = inactiveContext.vmc;
            treeDataProvider = inactiveContext.treeDataProvider;
            addElementsToLoadedVMO( vmCollection, inputData );
            treeDataProvider.update( vmCollection.getLoadedViewModelObjects() );
        }
    }
};

export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
};

/**
  * Toggle Index Configuration service utility
  */

export default exports = {
    removeChildFromParentChildrenArray,
    addChildToParentsChildrenArray,
    getVmcIndexForParentsNthChildIndex,
    isNodePresentInTree,
    getTreeNode,
    removeNode,
    updateNodeIfUidChanged,
    addChildNode,
    initialize,
    deSelectFromInactiveView,
    loadAndSelectProvidedObjectInTree,
    destroy,
    deleteExpandedNodeCache,
    addElementsToLoadedVMO,
    addElementsInTrees
};
