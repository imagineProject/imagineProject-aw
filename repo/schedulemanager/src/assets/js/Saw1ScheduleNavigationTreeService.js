// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1ScheduleNavigationTreeService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';


// Source component from which the selection has happened.
let _selectionSource;

export const handleTreeSelectionChange = ( treeSelectionData, parentSelectionData, atomicDataRef ) => {
    if( _selectionSource === 'gantt' ) {
        _selectionSource = '';
        return;
    }
    _selectionSource = 'tree';
    if( treeSelectionData && treeSelectionData.selected ) {
        atomicDataRef.ganttSelectionData.setAtomicData( { id: 'ganttSelectionModel', selected: treeSelectionData.selected, source: 'tree' } );
    }
    updateParentSelection( parentSelectionData, treeSelectionData.selected );
};

export const handleGanttSelectionChange = ( ganttSelectionData, parentSelectionData, treeSelectionModel ) => {
    if( _selectionSource === 'tree' ) {
        _selectionSource = '';
        return;
    }
    _selectionSource = 'gantt';

    if( ganttSelectionData && ganttSelectionData.selected ) {
        let treeNodes = filterTreeNodes( treeSelectionModel, ganttSelectionData.selected );
        if( treeNodes.length <= 0 && treeSelectionModel.getCurrentSelectedCount() <= 0 ) {
            _selectionSource = '';
        }
        treeSelectionModel.setSelection( treeNodes );
    }

    let treeNodes = convertModelObjectsToTreeNodes( treeSelectionModel, ganttSelectionData.selected );
    updateParentSelection( parentSelectionData, treeNodes );
};

const filterTreeNodes = ( selectionModel, modelObjects ) => {
    let treeNodes = [];
    let vmCollection = _.get( selectionModel.getDpListener(), 'vmCollectionObj.vmCollection' );

    if( modelObjects && vmCollection ) {
        modelObjects.forEach( modelObject => {
            let vmoIndex = vmCollection.findViewModelObjectById( modelObject.uid );
            if( vmoIndex > -1 ) {
                treeNodes.push( vmCollection.getViewModelObject( vmoIndex ) );
            }
        } );
    }
    return treeNodes;
};

const convertModelObjectsToTreeNodes = ( selectionModel, modelObjects ) => {
    let vmCollection = _.get( selectionModel.getDpListener(), 'vmCollectionObj.vmCollection' );
    if( !vmCollection ) {
        return modelObjects;
    }

    return modelObjects.map( modelObject => {
        let vmoIndex = vmCollection.findViewModelObjectById( modelObject.uid );
        return vmoIndex > -1 ? vmCollection.getViewModelObject( vmoIndex ) : modelObject;
    } );
};

const updateParentSelection = ( parentSelectionData, selectedObjects ) => {
    if( parentSelectionData && _.isArray( selectedObjects ) ) {
        selectedObjects  = cdm.isModelObject( selectedObjects[0] ) ?  [ viewModelObjectSvc.createViewModelObject( selectedObjects[0] ) ] : selectedObjects;
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected : selectedObjects ? selectedObjects : [] } );
    }
};

export const setBaselinesToView = ( scheduleNavigationContext, eventData ) => {
    if( scheduleNavigationContext && eventData ) {
        scheduleNavigationContext.update( {
            ...scheduleNavigationContext.getValue(),
            baselineUids: Array.isArray( eventData.baselines ) ? eventData.baselines.map( vmo => vmo.uid ) : []
        } );
    }
};

export const getObjectsToRefresh = ( schedule ) => {
    let objectUids = schedule.props.saw1ScheduleMembers.dbValues; //schedule memeber
    objectUids.push(  schedule.props.fnd0SummaryTask.dbValues[0] ); //schedule summary task
    return objectUids.reduce( ( modelObjects, uid ) => {
        modelObjects.push( cdm.getObject( uid ) );
        return modelObjects;
    }, [] );
};
