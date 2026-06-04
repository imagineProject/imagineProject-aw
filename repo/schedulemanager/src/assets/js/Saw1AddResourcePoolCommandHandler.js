// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1AddResourcePoolCommandHandler
 */
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};
var _assignResPool = null;

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let execute = function( vmo ) {
    if( vmo && vmo.uid ) {
        _assignResPool = vmo;
        eventBus.publish( 'Saw1AddResourcePoolCommand.addResourcePool' );
    }
};

/**
 * Add ResourcePool .Called when clicked on the add cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let addResourcePool = function( data ) {
    for( var index = 0; index < data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects.length; index++ ) {
        if( data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects[ index ].uid === _assignResPool.uid ) {
            throw 'assignmentsResPoolErrorMsg';
        }
    }
    removeFromAvailableResourcePool( data, _assignResPool );
    var updateMemberList = data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects;

    updateMemberList.push( _assignResPool );

    data.dataProviders.assignedResourcePool.update( updateMemberList );
    data.visibleSaveBtn = true;
};

/**
 * Method to remove ResourcePool from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAvailableResourcePool( data, vmo ) {
    var assignedResourcePoolUid = [];
    assignedResourcePoolUid.push( vmo.uid );
    var availModelObjects = data.dataProviders.getResourcePool.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( availModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, assignedResourcePoolUid ) === -1;
    } );

    data.dataProviders.getResourcePool.update( modelObjects );
}

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

exports = {
    execute,
    addResourcePool,
    setCommandContext
};

export default exports;
