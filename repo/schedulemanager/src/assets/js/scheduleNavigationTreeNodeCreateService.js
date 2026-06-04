// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeNodeCreateService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awIconService from 'js/awIconService';
import AwStateService from 'js/awStateService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cmm from 'soa/kernel/clientMetaModel';

let exports;

/**
 * Creates a VieWModelTreeNode using the given model object info.
 * @param {Object} modelObject - object for creating view model tree node.
 * @param {String} parentUid - UID of the parent node.
 * @param {int} childNdx - int value for child index.
 * @param {int} levelNdx - int value for level index.
 * @return {Object} vmNode A view model node object containing the details of the node.
 */
export let createViewModelTreeNodeUsingModelObject = ( modelObject, parentUid, childNdx, levelNdx, declViewModel ) => {
    let displayName = _.get( modelObject, 'props.object_string.uiValues[0]', '' );
    let iconURL = awIconService.getTypeIconFileUrl( modelObject );

    let vmNode = awTableTreeSvc.createViewModelTreeNode( modelObject.uid, modelObject.type, displayName, levelNdx, childNdx, iconURL );
    vmNode.alternateID = vmNode.uid;
    vmNode.isLeaf = !containChildren( modelObject, declViewModel );
    vmNode.parentNodeUid = parentUid;

    return vmNode;
};

/**
 * @param {Object} object - object to verify if it contains children
 * @return {Boolean} Returns boolean.
 */
let containChildren = ( object, declViewModel ) => {
    if( cmm.isInstanceOf( 'Schedule', object.modelType ) ) {
        return true;
    }

    // If there are active filters, render the nodes as flat list.
    if( AwStateService.instance.params.filter ) {
        return false;
    }

    //Check if there are column filters
    let columnFilters = [];
    if( declViewModel && declViewModel.columnProviders.scheduleNavigationTreeColumnProvider ) {
        columnFilters = declViewModel.columnProviders.scheduleNavigationTreeColumnProvider.columnFilters;
        if( columnFilters && columnFilters.length > 0 ) {
            return false;
        }
    }

    if( cmm.isInstanceOf( 'ScheduleTask', object.modelType ) &&
        object.props.task_type && (
        object.props.task_type.dbValues[ 0 ] === '2' || // Summary
            object.props.task_type.dbValues[ 0 ] === '3' || // Phase
            object.props.task_type.dbValues[ 0 ] === '6' ) ) { // Schedule Summary
        return true;
    }

    return false;
};

exports = {
    createViewModelTreeNodeUsingModelObject
};

export default exports;
