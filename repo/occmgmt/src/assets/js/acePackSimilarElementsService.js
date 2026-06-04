// Copyright (c) 2022 Siemens

/**
 * @module js/acePackSimilarElementsService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import appCtxSvc from 'js/appCtxService';
import aceStructureEditService from 'js/aceStructureEditService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import acePartialSelectionService from 'js/acePartialSelectionService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Get display mode using add elements service.
 */
export let getTreeOrListDisplayMode = function() {
    return 'Tree';
};

/**
 * Get selections.
 */
export let getSelections = function( subPanelContext ) {
    if( subPanelContext.occContext.pwaSelection.length > 0 ) {
        var mselected = [];
        _.forEach( subPanelContext.occContext.pwaSelection, function( selected ) {
            if( acePartialSelectionService.isPartiallySelected( selected.uid ) ) {
                var visibleNodeUid = acePartialSelectionService.getVisibleNodeForHiddenNodeInPartialSelection( selected.uid );
                var visibleNode = cdm.getObject( visibleNodeUid );
                if( visibleNode ) {
                    mselected.push( visibleNode );
                }
            } else {
                mselected.push( selected );
            }
        } );
        return mselected;
    }
    return subPanelContext.occContext.pwaSelection;
};

/*
* Get the array of uids corresponding to selections
*/
export let getSelectedUids = function( commandContext ) {
    return occmgmtUtils.getSelectedObjectUids( commandContext.occContext.pwaSelection );
};

/*
* Get the array of uids corresponding to selections
*/
export let getSelectedUidsForUnpack = function( selectedModelObjects ) {
    return occmgmtUtils.getSelectedObjectUids( selectedModelObjects );
};

/**
 * Get packed elements from service data.
*/

export let getPackedElementsFromServiceData = function( deletedObj ) {
    if( deletedObj ) {
        var mselected = appCtxSvc.ctx.mselected.map( function( obj ) {
            return obj.uid;
        } );
        return _.intersection( deletedObj, mselected );
    }
};

/**
 * Get Pack Similar Elements Configuration Data
 */
export let getInitialPackSimilarElementsConfigurationData = function( productContextInfo ) {
    let packSimilarElementsValue = false;
    if( productContextInfo && productContextInfo.props.awb0WindowStateToggles && productContextInfo.props.awb0WindowStateToggles.dbValues[ 0 ] ) {
        let windowToggles = productContextInfo.props.awb0WindowStateToggles.dbValues[ 0 ];
        packSimilarElementsValue = occMgmtStateHandler.getPackedState( windowToggles );
    }
    return packSimilarElementsValue;
};
var updateVmcLoadedObjectsAsPerAllChildren = function( parentInfo, allChildren, loadedViewModelObjects ) {
    // parent uid may also have changed
    for( var childIndex = 0; childIndex < allChildren.length; childIndex++ ) {
        aceStructureEditService.updateNodeIfUidChanged( allChildren[ childIndex ], parentInfo, loadedViewModelObjects );
    }

    var parentVMO = aceStructureEditService.getTreeNode( parentInfo, loadedViewModelObjects );
    var childsDeleted = [];
    if( parentVMO.children && parentVMO.children.length > 0 ) {
        var allChildrenStableIds = allChildren.map( function( obj ) {
            return obj.stableId;
        } );
        _.forEach( parentVMO.children, function( child ) {
            if( !allChildrenStableIds.includes( child.stableId ) ) {
                childsDeleted.push( child );
            }
        } );
    }

    _.forEach( childsDeleted, function( child ) {
        aceStructureEditService.removeNode( child, parentInfo, loadedViewModelObjects, true );
    } );

    for( var childIndex = 0; childIndex < allChildren.length; childIndex++ ) {
        aceStructureEditService.addChildNode( allChildren[ childIndex ], childIndex, parentInfo, loadedViewModelObjects );
    }

    acePartialSelectionService.restorePartialSelection();
};

export let postProcessPackUnpackResponse = function( parentChildrenInfos, occContext, packMode, elementsToBeSelected, viewToReset ) {
    var loadedViewModelObjects = occContext.vmc.getLoadedViewModelObjects();
    let VMOchanged = false;
    if( parentChildrenInfos && loadedViewModelObjects.length > 0 && occmgmtUtils.isTreeView() ) {
        _.forEach( parentChildrenInfos, function( parentChildrenInfo ) {
            // check parent itself is not hidden when multiselected and packed
            if( aceStructureEditService.isNodePresentInTree( parentChildrenInfo.parentInfo, occContext.vmc ) ) {
                updateVmcLoadedObjectsAsPerAllChildren( parentChildrenInfo.parentInfo, parentChildrenInfo.childrenInfo, loadedViewModelObjects );
                VMOchanged = true;
            }
        } );
    }
    if( VMOchanged ) {
        occContext.treeDataProvider.update( loadedViewModelObjects );
        // remove hidden nodes
        acePartialSelectionService.removeHiddenNodesFromSelection( occContext );
    }

    //Call this event to perform tree pack/Unpack Successfully
    eventBus.publish( 'tree.packUnpackSuccessful', { parentChildrenInfos: parentChildrenInfos, packMode: packMode, elementsToBeSelected: elementsToBeSelected, viewToReset: viewToReset } );
};

/**
 * packSimilarElementsCompletedAction to perform action after perform similarElements SOA response
 */

export let packSimilarElementsCompletedAction = function( response ) {
    postProcessPackUnpackResponse( response.parentChildrenInfos, response.occContext, response.packMode, response.elementsToBeSelected, response.viewToReset );
};

/**
 * Pack Similar Elements Configuration service utility
 */

export default exports = {
    getTreeOrListDisplayMode,
    getSelections,
    getSelectedUids,
    getInitialPackSimilarElementsConfigurationData,
    postProcessPackUnpackResponse,
    getSelectedUidsForUnpack,
    packSimilarElementsCompletedAction,
    getPackedElementsFromServiceData
};
