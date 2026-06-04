// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1AddBaselineCellCommandHandler
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import smConstants from 'js/ScheduleManagerConstants';

var exports = {};
var _assignBaseline = null;

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
        _assignBaseline = vmo;

        let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
        if( scheduleNavigationCtx.selectedBaselines.length < 2 ) {
            scheduleNavigationCtx.selectedBaselines.push( vmo );
            appCtxSvc.updateCtx( 'scheduleNavigationCtx', scheduleNavigationCtx );
            eventBus.publish( 'Saw1BaselineCommand.addBaseline' );
        }
    }
};

/**
 * Add Baseline .Called when clicked on the add cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let addBaseline = function( dataProviders, scheduleNavigationContext ) {
    var updateBaselineList = dataProviders.selectedBaseline.viewModelCollection.loadedVMObjects;
    let newScheduleNavigationContext = _.clone(scheduleNavigationContext);
    removeFromAvailableBaseline( dataProviders, _assignBaseline );
    // set decorator
    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    if( _.isEmpty( scheduleNavigationCtx.selectedBaselines ) ) // first time add
    {
        Object.assign( _assignBaseline, { cellDecoratorStyle : smConstants.VIEW_BASELINE_DECORATOR_STYLE[ 0 ] } );
    } else {
        let idx = _.findIndex( scheduleNavigationCtx.selectedBaselines, function( obj ) { return obj.uid === _assignBaseline.uid; } );
        Object.assign( _assignBaseline, { cellDecoratorStyle : smConstants.VIEW_BASELINE_DECORATOR_STYLE[ idx ] } );
    }
    updateBaselineList.push( _assignBaseline );
    let baselineUids = updateBaselineList.map( baseline => baseline.uid);
    newScheduleNavigationContext.baselineUids = baselineUids;
    scheduleNavigationContext.update(newScheduleNavigationContext);
    dataProviders.selectedBaseline.update( updateBaselineList );
    let visibleSaveBtn = true;

    return {
        visibleSaveBtn : visibleSaveBtn,
        dataProviders : dataProviders
    };
};

/**
 * Method to remove  Baseline from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAvailableBaseline( dataProviders, vmo ) {
    var assignedBaselineUid = [];
    if( !_.isEmpty( vmo ) ) {
        assignedBaselineUid.push( vmo.uid );
        var availModelObjects = dataProviders.getBaselines.viewModelCollection.loadedVMObjects;

        var idx = _.findIndex( availModelObjects, ( obj ) => assignedBaselineUid[0] === obj.uid );
        if( idx > -1 ) {
            availModelObjects.splice( idx, 1 );
        }

        dataProviders.getBaselines.update( availModelObjects );
    }
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
    addBaseline,
    setCommandContext
};

export default exports;
