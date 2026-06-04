// Copyright (c) 2022 Siemens

/**
 * @module js/jitterfreeSchemeSwitchCache
 */

import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';

var _topNodeToExpandedNodesStableIdsMap = {};
var exports = {};

let _getCSIDChainsForExpandedNodes = function( vmc ) {
    var csidChainsOfNodes = [];

    // Ideally we should determine list of expanded nodes using the localStorage but we need CSID chain of each object.
    // It is available only on the loaded objects and hence this code.
    var allNodesInCache = vmc.getLoadedViewModelObjects();
    var expandedNodes = _.filter( allNodesInCache, function( node ) {
        return node.isExpanded && !_.isEmpty( node.stableId );
    } );
    csidChainsOfNodes = _.map( expandedNodes, function( expandedNode ) {
        return expandedNode.stableId;
    } );

    return csidChainsOfNodes;
};

let _findVmoForModelObject = function( vmc, vmoUid ) {
    let moIdx = vmc.findViewModelObjectById( vmoUid );
    var vmo = vmc.getViewModelObject( moIdx );
    if( !vmo ) {
        vmo = cdm.getObject( vmoUid );
    }
    return vmo;
};

let _getSubsetVmoFromSelectedObject = function( vmc, currentVmo ) {
    let worksetUid = vmc.getLoadedViewModelObjects()[0].uid;

    let parentUid = currentVmo.props.awb0Parent.dbValues && currentVmo.props.awb0Parent.dbValues[0];
    if( !_.isEmpty( parentUid ) && parentUid === worksetUid ) {
        return currentVmo;
    }

    return _getSubsetVmoFromSelectedObject( vmc, _findVmoForModelObject( vmc, parentUid ) );
};

// This function caches the expanded nodes of the current opened object organizedby partitions.
// The expanded nodes are cached against the top node SRUID.

export let cacheExpandedNodesOnSchemeSwitch = function( topNodeSruid, orgSchemeBeforeSwitch, vmc, selectedObjUid, viewKey, openedObjectType ) {
    // Fetch the partition scheme UID before the scheme switch UI action
    var orgUidBeforeSwitch =  orgSchemeBeforeSwitch.isNulls && orgSchemeBeforeSwitch.isNulls[0]  ? 'noneObject' : orgSchemeBeforeSwitch.dbValues[0];

    // Find the current set of expanded nodes
    var expandedNodesInCache = _getCSIDChainsForExpandedNodes( vmc );
    var prodSruidToExpandedNodes = _topNodeToExpandedNodesStableIdsMap[viewKey] && _topNodeToExpandedNodesStableIdsMap[viewKey][topNodeSruid];

    // Workset and appsession with workset have to be handled separately as subset lines can have scheme applied.
    if( openedObjectType === 'WorksetRevision' || openedObjectType === 'AppSessionWorkset' ) {
        // Find the subset line for which scheme has changed
        var subsetSchemeChanged = _getSubsetVmoFromSelectedObject( vmc, _findVmoForModelObject( vmc, selectedObjUid ) );
        if( !subsetSchemeChanged ) {
            return;
        }

        // Find the expanded nodes for the changed subset. Scheme can be changed for one subset at a time
        // We only cache the nodes for the subset line for which the scheme has changed.
        var expandedNodes = _.filter( expandedNodesInCache, function( node ) {
            return node.includes( subsetSchemeChanged.stableId );
        } );

        var changedSubsetUID = subsetSchemeChanged.uid.replace( /#(.*)#/, '' );
        if( prodSruidToExpandedNodes && prodSruidToExpandedNodes[changedSubsetUID] ) {
            prodSruidToExpandedNodes[changedSubsetUID] = { ...prodSruidToExpandedNodes[changedSubsetUID], [orgUidBeforeSwitch]: expandedNodes };
        } else if( prodSruidToExpandedNodes ) {
            prodSruidToExpandedNodes = { ...prodSruidToExpandedNodes, [changedSubsetUID]: { [orgUidBeforeSwitch]: expandedNodes } };
        } else {
            prodSruidToExpandedNodes = { [changedSubsetUID]: { [orgUidBeforeSwitch]: expandedNodes } };
        }

        if( _topNodeToExpandedNodesStableIdsMap[viewKey] ) {
            _topNodeToExpandedNodesStableIdsMap[viewKey] = { ..._topNodeToExpandedNodesStableIdsMap[viewKey],
                [topNodeSruid] : prodSruidToExpandedNodes };
        } else {
            _topNodeToExpandedNodesStableIdsMap[viewKey] = { [topNodeSruid] : prodSruidToExpandedNodes };
        }
    } else {
        if( prodSruidToExpandedNodes && prodSruidToExpandedNodes[topNodeSruid] ) {
            prodSruidToExpandedNodes[topNodeSruid] = { ...prodSruidToExpandedNodes[topNodeSruid], [orgUidBeforeSwitch]: expandedNodesInCache };
        } else {
            prodSruidToExpandedNodes = { [topNodeSruid]: { [orgUidBeforeSwitch]: expandedNodesInCache } };
        }

        if( _topNodeToExpandedNodesStableIdsMap[viewKey] ) {
            _topNodeToExpandedNodesStableIdsMap[viewKey] = { ..._topNodeToExpandedNodesStableIdsMap[viewKey],
                [topNodeSruid] : prodSruidToExpandedNodes };
        } else {
            _topNodeToExpandedNodesStableIdsMap[viewKey] = { [topNodeSruid] : prodSruidToExpandedNodes };
        }
    }
};

// This function finds the expanded nodes from the cache and updates them on the transientRequestPref
export let updateTransientReqPrefWithExpandedNodes = function( topNodeSruid, changedOrgUid, vmc, selectedObjUid, viewKey, occContext, openedObjectType ) {
    var expandedNodesCsids = [];

    // Find the subset line for which scheme has changed
    var subsetVmoForOrgSwitch;
    if(  ( openedObjectType === 'WorksetRevision' || openedObjectType === 'AppSessionWorkset' ) && selectedObjUid  ) {
        subsetVmoForOrgSwitch = _getSubsetVmoFromSelectedObject( vmc, _findVmoForModelObject( vmc, selectedObjUid ) );
    }

    // Since we cache nodes only for changed subset lines the key to find has to be changed accordingly.
    // <TODO> Once discovery supports window reuse, "replace( /#(.*)#/, '' )" can go away.
    // Whenever a new bom window is created for workset scenarios, -
    //  1. Workset lines SRUID remains same (across windows)
    //  2. Subset lines SRUID remains same till the last expansionrule parameter.
    // Hence partially removing the string that contains the expansion rule
    var uidOfNodeForOrgSwitch =  subsetVmoForOrgSwitch ? subsetVmoForOrgSwitch.uid.replace( /#(.*)#/, '' ) : topNodeSruid;

    if( _topNodeToExpandedNodesStableIdsMap[viewKey] &&
        _topNodeToExpandedNodesStableIdsMap[viewKey][topNodeSruid] &&
        _topNodeToExpandedNodesStableIdsMap[viewKey][topNodeSruid][uidOfNodeForOrgSwitch] &&
        _topNodeToExpandedNodesStableIdsMap[viewKey][topNodeSruid][uidOfNodeForOrgSwitch][changedOrgUid] ) {
        expandedNodesCsids = _topNodeToExpandedNodesStableIdsMap[viewKey][topNodeSruid][uidOfNodeForOrgSwitch][changedOrgUid];
    }

    if(  openedObjectType === 'WorksetRevision' || openedObjectType === 'AppSessionWorkset'  ) {
        // Get the expanded nodes for current subset
        var currentExpandedNodes = _getCSIDChainsForExpandedNodes( vmc );
        var worksetExpandedNodesCsids = [];
        var modifiedSubsetCsid = subsetVmoForOrgSwitch?.stableId;


        // For workset case -
        //      1. Fetch the current expanded nodes for the whole workset
        //      2. Identify the expanded nodes for the selected subset. This will be different from found in 1.
        //      3. Replace the nodes found in 2. at the exact same location in 1.
        //      The ones calculated on 3. are the set of nodes that we send to the server.
        var replaceWithChachedExpNodes = false;
        for( var inx = 0; inx < currentExpandedNodes.length; inx++ ) {
            if( currentExpandedNodes[inx].includes( modifiedSubsetCsid ) && currentExpandedNodes[inx] !== ':' ) {
                if( !replaceWithChachedExpNodes ) {
                    worksetExpandedNodesCsids = [].concat( worksetExpandedNodesCsids, expandedNodesCsids );
                    replaceWithChachedExpNodes = true;
                }
            } else {
                worksetExpandedNodesCsids.push( currentExpandedNodes[inx] );
            }
        }
        expandedNodesCsids = worksetExpandedNodesCsids;
    }

    let transReqPrefVal = { ...occContext.transientRequestPref, expandedNodes:expandedNodesCsids };
    // Workset and session use cases donot reuse the bom window yet.
    // Setting the returnchildrenNoExpansion enforces the server to skip expanding and return expandedlines. So unset it.
    if( openedObjectType === 'WorksetRevision' || openedObjectType === 'AppSessionWorkset' ) {
        transReqPrefVal = { ...transReqPrefVal, returnChildrenNoExpansion:[ ] };
    }
    occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', transReqPrefVal, occContext, true );
};

export default exports = {
    cacheExpandedNodesOnSchemeSwitch,
    updateTransientReqPrefWithExpandedNodes
};
