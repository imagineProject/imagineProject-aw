// Copyright (c) 2022 Siemens

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';

export const updateLocalSelection = ( parentSelectionData, ganttInstance ) => {
    console.log( 'AwGanttSelectionService updateLocalSelection' );
    if( !ganttInstance || !parentSelectionData || !parentSelectionData.value.selected ) {
        return;
    }

    selectObjectsInGantt( ganttInstance, parentSelectionData.value.selected );
};

const selectObjectsInGantt = ( ganttInstance, selectedIds ) => {
    if( !ganttInstance || !selectedIds ) {
        return;
    }

    // Batch process selection in gantt.
    ganttInstance.batchUpdate( () => {
        if( _.isArray( selectedIds ) && selectedIds.length > 0 ) {
            // Remove deselected objects.
            ganttInstance.eachSelectedTask( ( taskId ) => {
                if( selectedIds.indexOf( taskId ) === -1 ) {
                    ganttInstance.unselectTask( taskId );
                }
            } );
            if( ganttInstance.selectedLink && selectedIds.indexOf( ganttInstance.selectedLink ) === -1 ) {
                selectLink( null, ganttInstance );
            }

            // Update newly selected objects.
            selectedIds.forEach( ( objectUid ) => {
                if( ganttInstance.isTaskExists( objectUid ) ) {
                    if( !ganttInstance.isSelectedTask( objectUid ) ) {
                        ganttInstance.selectTask( objectUid );
                        const task = ganttInstance.getTask( objectUid );
                        ganttInstance.showDate( task.start_date );
                    }
                } else if ( ganttInstance.isLinkExists( objectUid ) ) {
                    selectLink( objectUid, ganttInstance );
                }
            } );
        } else { // Deselect all
            ganttInstance.eachSelectedTask( ( taskId ) => {
                ganttInstance.unselectTask( taskId );
            } );
        }
    } );
};

export const selectLink = ( linkId, ganttInstance ) => {
    if( ganttInstance.selectedLink !== linkId ) {
        let oldSelection = ganttInstance.selectedLink;
        ganttInstance.selectedLink = linkId;
        if( ganttInstance.isLinkExists( oldSelection ) ) {
            ganttInstance.refreshLink( oldSelection );
        }
        if( ganttInstance.isLinkExists( linkId ) ) {
            ganttInstance.refreshLink( linkId );
        }
    }
};

export const updateParentSelection = ( ganttSelIds, parentSelectionData ) => {
    let selectedObjects = ganttSelIds.map( id => cdm.getObject( id ) );
    if( !parentSelectionData.getValue().selected || _.xorBy( selectedObjects, parentSelectionData.getValue().selected, 'uid' ).length > 0 ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected: selectedObjects } );
    }
};

export const updateSelectionData = ( ganttSelIds, selectionData ) => {
    if( !selectionData ) {
        return;
    }
    let parentSelIds = [];
    if( selectionData.getValue().selected ) {
        parentSelIds = selectionData.getValue().selected.reduce( ( output, element ) => {
            output.push( element );
            return output;
        }, [] );
    }

    if( _.xor( ganttSelIds, parentSelIds ).length > 0 ) {
        selectionData.update( { ...selectionData.getValue(), selected: ganttSelIds, id: 'ganttSelectionModel', source: 'gantt' } );
    }
    return {
        selectedUids: ganttSelIds,
        previousSelectedUids: parentSelIds
    };
};

const exports = {
    updateLocalSelection,
    selectLink,
    updateSelectionData,
    updateParentSelection
};

export default exports;
