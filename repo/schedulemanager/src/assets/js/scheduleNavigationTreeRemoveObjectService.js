// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeRemoveObjectService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';

let exports;

/**
 * After the objects are deleted from the view model collection, we need to
 * clean up the references(parent-children) to the deleted nodes.
 *
 * @param {Object} vmo The VMO to traverse down the hierarchy, to remove the deleted nodes.
 * @param {Array} uidsToRemove The UIDs of the nodes to remove.
 * @param {Object} deletedData Object containing the data of deleted(in the database) UIDs
 *                             and the nodes(deleted & affected) removed from the tree.
 */
export let removeDeletedTreeNodes = ( vmo, uidsToRemove, deletedData ) => {
    if( vmo.isLeaf || uidsToRemove.length <= 0 ) {
        return;
    }

    // Some other view model has deleted a node whose parent is collapsed in the tree.
    if( vmo.__expandState ) {
        let deletesFromExpansionCache = _.remove( vmo.__expandState.expandedNodes, ( expandedNode ) => {
            return _.indexOf( uidsToRemove, expandedNode.uid ) > -1;
        } );

        // Some other view model has deleted these nodes. Simple delete the
        // expansion cache, so that we can reload the children during expansion.
        if( deletesFromExpansionCache.length > 0 ) {
            deletedData.removedNodes = deletedData.removedNodes.concat( vmo.__expandState.children );
            delete vmo.__expandState;
        } else {
            // Traverse and clean up the nodes down the hierarchy.
            for( let index = 0; index < vmo.__expandState.children.length; ++index ) {
                if( !vmo.__expandState.children[index].isLeaf ) {
                    removeDeletedTreeNodes( vmo.__expandState.children[index], uidsToRemove, deletedData );
                }
            }
        }
    } else {
        let deletedNodes = _.remove( vmo.children, ( node ) => {
            return _.indexOf( uidsToRemove, node.uid ) > -1;
        } );

        if( deletedNodes.length > 0 ) {
            deletedData.removedNodes = deletedData.removedNodes.concat( deletedNodes );
            // Update the child index and count.
            updateVmoForDeletedChildren( vmo, deletedNodes.length );
        }

        // Traverse and clean up nodes down the hierarchy.
        if( vmo.children ) {
            vmo.children.forEach( child => {
                if( !child.isLeaf ) {
                    removeDeletedTreeNodes( child, uidsToRemove, deletedData );
                }
            } );
        }
    }
};

/**
 * Update the given VMO's total child count and child index of it's children
 * @param {*} vmo The VMO to update
 * @param {*} nDeletedChildren Number of deleted children
 */
let updateVmoForDeletedChildren = ( vmo, nDeletedChildren ) => {
    if( nDeletedChildren <= 0 ) {
        return;
    }
    if( vmo.children.length === 0 ) {
        // Top level schedule summary should always show the expand/collapse icon.
        if( vmo.uid === appCtxSvc.getCtx( 'scheduleNavigationCtx.sourceScheduleSummary' ).uid ) {
            vmo.totalChildCount = 0;
            delete vmo.children;
        } else {
            vmo.isLeaf = true;
            delete vmo.isExpanded;
            delete vmo.totalChildCount;
            delete vmo.children;
        }
    } else {
        for( let index = 0; index < vmo.children.length; ++index ) {
            vmo.children[index].childNdx = index;
        }
        vmo.totalChildCount -= nDeletedChildren;
    }
};

exports = {
    removeDeletedTreeNodes
};

export default exports;
