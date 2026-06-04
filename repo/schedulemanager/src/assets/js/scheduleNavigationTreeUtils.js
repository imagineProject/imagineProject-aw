// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global define
    angular
*/

/**
 * @module js/scheduleNavigationTreeUtils
 */

import _ from 'lodash';
import appCtx from 'js/appCtxService';
import eventBus from 'js/eventBus';
import cmm from 'soa/kernel/clientMetaModel';
import selectionSvc from 'js/selection.service';
import viewModelService from 'js/viewModelService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';

let exports;

/**
 * @returns {object} Schedule Navigation tree table
 */
export let getScheduleNavigationTreeTableElement = () => {
    return document.getElementById( 'scheduleNavigationTree' );
};

/**
 * @returns {object} Schedule Navigation Gantt
 */
export let getScheduleNavigationGanttElement = () => {
    let ganttElement;
    let ganttWrapper = document.getElementsByClassName('aw-ganttInterface-ganttWrapper');
    if( ganttWrapper && ganttWrapper.length > 0) {
        ganttElement = ganttWrapper[0];
    }
    return ganttElement;
};

/**
 * Determines if the current sublocation is Schedule navigation sublocation
 *
 * @returns {boolean} true, if the current sublocation is Schedule navigation sublocation; false otherwise.
 */
export let isScheduleNavigationSublocation = () => {
    return appCtx.ctx.locationContext &&
           appCtx.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.schmgt:ScheduleNavigationSubLocation';
};

/**
 * Returns the UIDs of the given tree nodes.
 *
 * @param {Array} treeNodes view model tree nodes
 * @returns {Array} Uids uids of the tree nodes
 */
export let getUidsOfTreeNodes = ( treeNodes ) => {
    let uids = [];
    if( Array.isArray( treeNodes ) ) {
        treeNodes.forEach( ( node ) => {
            uids.push( node.uid );
        } );
    }

    return uids;
};

/**
 * Returns the root node (schedule summary task) in the tree.
 * This returns the ViewModelTreeeNode object and NOT ViewModelObject.
 * @returns {Object} The root view model tree node.
 */
export let getRootTreeNode = () => {
    let rootTreeNode;
    let smGanttCtx = appCtx.getCtx( "smGanttCtx" );
    if( smGanttCtx && smGanttCtx.treeDataProvider ) {
        rootTreeNode = smGanttCtx.treeDataProvider.viewModelCollection.loadedVMObjects[ 0 ];
    }
    return rootTreeNode;
};

/**
 * Returns the immediate children of the given parent node.
 * NOTE: This takes care of collapsed parent node as well.
 *
 * @param {Array} parentNode parent node
 * @returns {Array} Uids uids of the tree nodes
 */
let getImmediateChildren = ( parentNode ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    return childNodes;
};

/**
 * Returns all the children in the hierarchy of the given parent node.
 *
 * @param {Array} parentNode parent node
 * @returns {Array} All child nodes in the hierarchy of the given parent node.
 */
export let getChildrenInHierarchy = ( parentNode ) => {
    let children = [];
    let childNodes = getImmediateChildren( parentNode );

    if( childNodes ) {
        children = childNodes;
        childNodes.forEach( ( node ) => {
            if( !node.isLeaf ) {
                children = children.concat( getChildrenInHierarchy( node ) );
            }
        } );
    }

    return children;
};

/**
 * Prepares the comma separted string for UIDs of objects
 * @param {Array} objectsList The list of object
 * @returns {String} Uid of input objects in comma separated string
 */
export let listToUidString = function( objectsList ) {
    let commaSepartedStr = '';
    for( let index = 0; index < objectsList.length; index++ ) {
        if( objectsList[ index ] ) {
            let objectUid = objectsList[ index ];
            if( objectUid.uid ) {
                objectUid = objectUid.uid;
            }
            commaSepartedStr += objectUid;
            if( index !== objectsList.length - 1 ) {
                commaSepartedStr += ',';
        }
    }
    }
    return commaSepartedStr;
};

/**
 *  Deselect object from tree table if selected object is of event type
 *  @param {data} data view model data
 */
export let deSelectObjectFromTreeOnEventSelection = ( data ) => {
    if( !_.isEmpty( data.eventData ) ) {
        data.dataProviders.scheduleNavigationTreeDataProvider.selectionModel.selectNone( );
    }
};

/**
 * @param {data} data view model data
 */
export let listenPrimarySelection = ( data ) => {
    let eventData = data.eventMap['scheduleNavigationTree.selectEventForSecondaryEvent'];
    let vmos = [];
    if( !_.isEmpty( eventData ) && !_.isEmpty( eventData.vmo ) ) {
        vmos = eventData.vmo;
    }
    if( vmos && vmos.length > 0 ) {
        let nativeSub = document.getElementsByTagName( 'aw-native-sublocation' );
        if( nativeSub && nativeSub[ 0 ] ) {
            let nativeScope = angular.element( nativeSub ).scope();
            nativeScope.$$childHead.modelObjects = vmos;
        }
        let smGanttCtx = appCtx.getCtx( 'smGanttCtx' );
        smGanttCtx.selectedTaskSchedule = vmos;
        appCtx.updateCtx( 'smGanttCtx', smGanttCtx );
        selectionSvc.updateSelection( vmos );
    }
};

/**
 * Update secondary work area information to schedule objec
 */
 export let updateSWAInfoToSchedule = () => {
    if( appCtx.ctx.mselected && appCtx.ctx.mselected.length > 0  ) {
        let selectedObjects = appCtx.ctx.mselected;
        let isEventSelected = false;
        for( let i = 0; i < selectedObjects.length; i++  ) {
            if( cmm.isInstanceOf( 'Prg0AbsEvent', selectedObjects[i].modelType ) ) {
                isEventSelected = true;
                break;
            }
        }
        if( isEventSelected ) {
            eventBus.publish( 'gantt.updateSWAForEvent', [ appCtx.ctx.locationContext.modelObject ] );
        }
    }
};

exports = {
    getScheduleNavigationTreeTableElement,
    getScheduleNavigationGanttElement,
    isScheduleNavigationSublocation,
    getUidsOfTreeNodes,
    getRootTreeNode,
    getChildrenInHierarchy,
    listToUidString,
    deSelectObjectFromTreeOnEventSelection,
    listenPrimarySelection,
    updateSWAInfoToSchedule
};

export default exports;
