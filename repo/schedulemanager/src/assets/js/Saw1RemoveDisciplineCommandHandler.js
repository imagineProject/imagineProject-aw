// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1RemoveDisciplineCommandHandler
 */
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};
var _assignDisc = null;

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
        _assignDisc = vmo;
        eventBus.publish( 'Saw1RemoveDisciplineCommand.removeUser' );
    }
};

/**
 * Remove Discipline .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeDiscipline = function( data ) {
    removeFromAssignedDisciplines( data, _assignDisc );
    var updateAvailableList = data.dataProviders.getDisciplines.viewModelCollection.loadedVMObjects;

    updateAvailableList.push( _assignDisc );
    data.dataProviders.getDisciplines.update( updateAvailableList );
    data.visibleSaveBtn = true;
};

/**
 * Method to remove discipline from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAssignedDisciplines( data, vmo ) {
    var removeDisciplinesUid = [];
    removeDisciplinesUid.push( vmo.uid );
    var memberModelObjects = data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( memberModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, removeDisciplinesUid ) === -1;
    } );
    data.dataProviders.assignedDisciplineList.update( modelObjects );
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
    removeDiscipline,
    setCommandContext
};
export default exports;
