// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */
/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1ReplaceBaselineCellCommandHandler
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import smConstants from 'js/ScheduleManagerConstants';

var exports = {};

/**
 *
 * @param {object} newBaseline - Schedule Baseline object that will replace one of the available schedule baseline object
 * @param {data provider} getBaselinesProvider - Data provider that has list of schedule baselines
 * @param {data provider} selectedBaselineProvider - Data provider that has list of selected schedule baselines
 */
export let replaceBaseline = function( newBaseline, getBaselinesProvider, selectedBaselineProvider, scheduleNavigationContext ) {
    let replaceBaselineObj;
    let newScheduleNavigationContext = _.clone( scheduleNavigationContext );
    //If selection is there in Baselines section , then the selection will be replaced
    if( !_.isEmpty( selectedBaselineProvider.selectedObjects ) ) {
        replaceBaselineObj = selectedBaselineProvider.selectedObjects[ 0 ];
    }
    //Single baseline is there
    else if ( selectedBaselineProvider.viewModelCollection.loadedVMObjects.length === 1 ) {
        replaceBaselineObj = selectedBaselineProvider.viewModelCollection.loadedVMObjects[0];
    }
    //If none is selected from Baselines then last one is replaced
    else {
        replaceBaselineObj = selectedBaselineProvider.viewModelCollection.loadedVMObjects[ 1 ];
    }

    //remove the decorators
    replaceBaselineObj.cellDecoratorStyle = '';

    //update ctx contents
    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    let idx = _.findIndex( scheduleNavigationCtx.selectedBaselines, function( obj ) {
        return replaceBaselineObj.uid === obj.uid;
    } );
    if( idx !== -1 ) {
        scheduleNavigationCtx.selectedBaselines[ idx ] = newBaseline;
    }
    //now add back the replaced baseline to available baseline objects
    updateDataProviderInfo( getBaselinesProvider, replaceBaselineObj, newBaseline );

    //update the selected baseline with new baseline
    updateDataProviderInfo( selectedBaselineProvider, newBaseline, replaceBaselineObj );
    selectedBaselineProvider.selectionModel.addToSelection( newBaseline );

    //refresh Gantt by updating scheduleNavigationContext
    var updateBaselineList = selectedBaselineProvider.viewModelCollection.loadedVMObjects;
    let baselineUids = updateBaselineList.map( baseline => baseline.uid );
    newScheduleNavigationContext.baselineUids = baselineUids;
    scheduleNavigationContext.update( newScheduleNavigationContext );

    //update the decorators
    let count = selectedBaselineProvider.viewModelCollection.loadedVMObjects.length;
    for( let i = 0; i < count; i++ ) {
        selectedBaselineProvider.viewModelCollection.loadedVMObjects[ i ].cellDecoratorStyle = smConstants.VIEW_BASELINE_DECORATOR_STYLE[ i ];
    }
    eventBus.publish( 'Saw1ReplaceBaselineCommand.replaceBaseline' );
};
/**
 * @param {data provider} dataProvider - Data provider that has list of schedule baselines/selected baselines
 * @param {object} objToAdd - object to add in dataProvider
 * @param {object} objToRemove - object to remove in dataProvider
 */
function updateDataProviderInfo( dataProvider, objToAdd, objToRemove ) {
    var getLoadedObjs = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    var idx = _.findIndex( getLoadedObjs, function( obj ) {
        return objToRemove.uid === obj.uid;
    } );
    objToAdd.selected = false;
    if( idx !== -1 ) {
        getLoadedObjs[ idx ] = objToAdd;
    }
    dataProvider.update( getLoadedObjs, getLoadedObjs.length );
    dataProvider.selectionModel.selectNone();
}


export let activateViewButton = function( ) {
    return true;
};


exports = {
    replaceBaseline,
    activateViewButton
};

export default exports;
