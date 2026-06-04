// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/Saw1SchTaskDeliverableEditHandler
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import saveEditUtils from 'js/saveEditUtils';

var exports = {};

var saveHandler = {};

export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * custom save handler save edits called by framework
 *
 * @return promise
 */
saveHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    var input = {};
    input = getSaveEditInput( dataSource );

    exports.callSaveEditSoa( input ).then( function() {
        deferred.resolve();
        refreshSelectedObjects( null );
    }, function( err ) {
        deferred.reject();
    } );
    return deferred.promise;
};

var getSaveEditInput = function( dataSource ) {
    // Get all properties that are modified
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    var modifiedPropsMap = dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );

    // Prepare the SOA input
    var inputs = [];
    _.forEach( modifiedPropsMap, function( modifiedObj ) {
        var modelObject;
        var viewModelObject = modifiedObj.viewModelObject;
        if( viewModelObject && viewModelObject.uid ) {
            modelObject = cdm.getObject( viewModelObject.uid );
        }

        if( !modelObject ) {
            modelObject = {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            };
        }

        var viewModelProps = modifiedObj.viewModelProps;
        var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput( modelObject );
        _.forEach( viewModelProps, function( props ) {
            dms.pushViewModelProperty( input, props );
        } );
        inputs.push( input );
    } );

    return inputs;
};

/**
 * Call save edit soa
 * @param {deferred} deferred
 * @return  {promise} promise when all modified Function Specification properties get saved
 */
export let callSaveEditSoa = function( input ) {
    return saveEditUtils.saveEdits( input ).then(
        function( response ) {
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            throw error;
        }
    );
};

/**
 * 
 * @param {*} activeEditHandler 
 */
var refreshSelectedObjects = function( activeEditHandler ) {
    if( activeEditHandler ) {
        activeEditHandler.saveEditsPostActions( true );
    }

    if( appCtxService.ctx.selected.modelType.typeHierarchyArray.indexOf( 'SchTaskDeliverable' ) > -1 && ( appCtxService.ctx.xrtPageContext.secondaryXrtPageID === 'tc_xrt_Overview' || appCtxService.ctx
        .xrtPageContext.primaryXrtPageID === 'tc_xrt_Overview' ) ) {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [
                appCtxService.ctx.locationContext.modelObject
            ]
        } );
    }
};

/**
 * Returns dirty bit.
 * @returns {Boolean} isDirty bit
 */
saveHandler.isDirty = function( dataSource ) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    if( modifiedPropCount === 0 ) {
        return false;
    }
    return true;
};

export default exports = {
    getSaveHandler,
    callSaveEditSoa
};
