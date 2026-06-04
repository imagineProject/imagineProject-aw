// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1RemoveResourcePoolCommandHandler
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

        eventBus.publish( 'Saw1RemoveResourcePoolCommand.removeResourcePool' );
    }
};

/**
 * Remove ResourcePool .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeResourcePool = function( data ) {
    removeFromAssignedResourcePool( data, _assignResPool );
    var updateAvailableList = data.dataProviders.getResourcePool.viewModelCollection.loadedVMObjects;

    updateAvailableList.push( _assignResPool );
    data.dataProviders.getResourcePool.update( updateAvailableList );
    data.visibleSaveBtn = true;
};

/**
 * Method to remove ResourcePool from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAssignedResourcePool( data, vmo ) {
    var removeResourcePoolUid = [];
    removeResourcePoolUid.push( vmo.uid );
    var memberModelObjects = data.dataProviders.assignedResourcePool.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( memberModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, removeResourcePoolUid ) === -1;
    } );

    data.dataProviders.assignedResourcePool.update( modelObjects );
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
    removeResourcePool,
    setCommandContext
};
export default exports;
