// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1AddDisciplineCommandHandler
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

        eventBus.publish( 'Saw1AddDisciplineCommand.addDiscipline' );
    }
};

/**
 * Add Discipline .Called when clicked on the add cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let addDiscipline = function( data ) {
    for( var index = 0; index < data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects.length; index++ ) {
        if( data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects[ index ].uid === _assignDisc.uid ) {
            throw 'assignmentDisciplineError';
        }
    }
    removeFromAvailableDiscipline( data, _assignDisc );
    var updateMemberList = data.dataProviders.assignedDisciplineList.viewModelCollection.loadedVMObjects;

    updateMemberList.push( _assignDisc );
    data.dataProviders.assignedDisciplineList.update( updateMemberList );
    data.visibleSaveBtn = true;
};

/**
 * Method to remove discipline from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAvailableDiscipline( data, vmo ) {
    var assignedDisciplinesUid = [];

    assignedDisciplinesUid.push( vmo.uid );
    var availModelObjects = data.dataProviders.getDisciplines.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( availModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, assignedDisciplinesUid ) === -1;
    } );
    data.dataProviders.getDisciplines.update( modelObjects );
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
    addDiscipline,
    setCommandContext
};

export default exports;
