// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0ConversationService2
 */
import app from 'app';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import convUtils from 'js/Ac0ConversationUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';

var exports = {};

export let getInflatedSourceObjectList = function( vmData ) {
    //load objects in sourceObjectList and retrieve thumbnail for objects
    var promiseArray = [];
    for( var ll = 0; ll < vmData.searchResults.length; ll++ ) {
        var vmObject = vmData.searchResults[ll];
        var srcObjsUids = [];
        for( var ii = 0; ii < vmObject.props.sourceObjList.dbValues.length; ii++ ) {
            srcObjsUids.push( vmObject.props.sourceObjList.dbValues[ii].uid );
        }
        if( srcObjsUids.length > 0 ) {
            vmObject.props.srcObjsUids = srcObjsUids;
            promiseArray.push( dms.loadObjects( srcObjsUids ) );
        }
    }
    return Promise.all( promiseArray ).then( function( values ) {
        _.forEach( values, function( value, index ) {
            var vmObj = vmData.searchResults[index];
            var sourceObjUids = [];
            for( var ii = 0; ii < vmObj.props.sourceObjList.dbValues.length; ii++ ) {
                sourceObjUids.push( vmObj.props.sourceObjList.dbValues[ii].uid );
            }
            var totalNoOfsrc = sourceObjUids.length;
            for( var nn = 0; nn < totalNoOfsrc; nn++ ) { //total no. of participants to be visible initially
                vmObj.props.inflatedSrcObjList = [];
                var srcObj = cdm.getObject( sourceObjUids[nn] );
                let vmo = viewModelObjectSvc.createViewModelObject( srcObj );
                vmObj.props.inflatedSrcObjList.push( vmo );
            }
        } );
    } );
};

// Small helper function to ensure the ctx.newConvObj is populated correctly
let ensureCtxNewConvObjIsPopulated = function( tmpCurDiscussionObj, vmObj, vmo ) {
    if( typeof tmpCurDiscussionObj !== 'undefined' && tmpCurDiscussionObj !== null && tmpCurDiscussionObj.uid === vmObj.uid ) {
        if( typeof tmpCurDiscussionObj.props.inflatedRelatedObjList === 'undefined' ) {
            tmpCurDiscussionObj.props.inflatedRelatedObjList = [];
        }
        if( !tmpCurDiscussionObj.props.inflatedRelatedObjList.some( tmpObj => tmpObj.uid === vmo.uid ) ) {
            // This object is not in the list add it
            tmpCurDiscussionObj.props.inflatedRelatedObjList.push( vmo );
        } else {
            // This object is in the list replace it with the provided one
            var foundIndex = tmpCurDiscussionObj.props.inflatedRelatedObjList.findIndex( tmpObj => tmpObj.uid === vmo.uid );
            tmpCurDiscussionObj.props.inflatedRelatedObjList[foundIndex] = vmo;
        }
    }
};

// Function to get the correct data for inflating RelatedObjectInfos
export let getInflatedRelatedObjectList = function( vmData ) {
    var promiseArray = [];
    for( var j = 0; j < vmData.searchResults.length; j++ ) {
        var vmObject = vmData.searchResults[j];
        var collabRelatedObjectInfoUids = [];
        vmObject.props.inflatedRelatedObjList = [];
        for( var ii = 0; ii < vmObject.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
            collabRelatedObjectInfoUids.push( vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid );
            // Resolving timing issue where the ui dataprovider is expecting info before it is populated.
            // put something in the inflatedRelatedObjList this will be overwritten in when processing the promise
            vmObject.props.inflatedRelatedObjList.push( {
                uid:vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid,
                type: vmObject.props.collabRelatedObjectInfo.dbValues[ii].type
            } );
        }
        if( collabRelatedObjectInfoUids.length > 0 ) {
            vmObject.props.collabRelatedObjectInfoUids = collabRelatedObjectInfoUids;
            promiseArray.push( dms.loadObjects( collabRelatedObjectInfoUids ) );
        }
    }

    return Promise.all( promiseArray ).then( function() {
        var tmpCurDiscObj = appCtxSvc.getCtx( 'newConvObj' );
        for( var index = 0; index < vmData.searchResults.length; index++ ) {
            var vmObj = vmData.searchResults[index];
            vmObj.props.inflatedRelatedObjList = [];
            var relatedObjUids = [];
            for( var ii = 0; ii < vmObj.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
                relatedObjUids.push( vmObj.props.collabRelatedObjectInfo.dbValues[ii].uid );
            }
            var totalNoOfobj = relatedObjUids.length;
            for( var nn = 0; nn < totalNoOfobj; nn++ ) { //total no. of participants to be visible initially
                var relatedObj = cdm.getObject( relatedObjUids[nn] );
                let vmo = viewModelObjectSvc.createViewModelObject( relatedObj );
                vmObj.props.inflatedRelatedObjList.push( vmo );

                // There is an issue where the 'newConvObj' object
                // (which is a clone of this object) does not have its
                // inflatedRelatedObjList value populated correctly at all times
                // ensure that it is populated here
                ensureCtxNewConvObjIsPopulated( tmpCurDiscObj, vmObj, vmo );
            }
        }
    } );
};

export let updateOnObjPanelSourceObj = function( vmData, sourceObjects ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.selected = sourceObjects[0];
    var tmpSharedData = { ...vmData.sharedData.value };
    tmpSharedData.selectedObj = sourceObjects[0];
    tmpSharedData.overridedSelectedObj = sourceObjects[0];
    //Product Gallery usecase, when we open discussion from snapshot, then overrride the source selection.
    if( convCtx.currentSelectedSnapshot ) {
        delete convCtx.currentSelectedSnapshot;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    vmData.sharedData.update( tmpSharedData );
    return { pselected: sourceObjects[0], selected: sourceObjects[0] };
};

/**
 * Ac0ConversationService factory
 */

export default exports = {
    getInflatedSourceObjectList,
    getInflatedRelatedObjectList,
    updateOnObjPanelSourceObj
};
app.factory( 'Ac0ConversationService2', () => exports );
