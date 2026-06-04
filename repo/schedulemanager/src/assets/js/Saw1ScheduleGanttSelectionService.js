// Copyright (c) 2022 Siemens

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';

/**
 * Updates the parent selection based on the local selection.
 * @param {Object} localSelectionData Local selection data
 * @param {Object} parentSelectionData Parent selection data
 */
export const updateParentSelection = ( localSelectionData, parentSelectionData ) => {
    // Return, if local selection is not initialized yet.
    if( !localSelectionData.selected ) {
        return;
    }

    let selObjects = [];
    localSelectionData.selected.forEach( taskId => selObjects.push( cdm.getObject( taskId ) ) );

    if( !parentSelectionData.getValue().selected || _.xorBy( selObjects, parentSelectionData.getValue().selected, 'uid' ).length > 0 ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected: selObjects, source: localSelectionData.source } );
    }
};

/**
 * Updates the local selection based on the parent selection.
 * @param {*} parentSelectionData Parent selection data
 * @param {*} atomicDataRef Atomic data
 */
export const updateLocalSelection = ( parentSelectionData, atomicDataRef ) => {
    parentSelectionData && parentSelectionData.getValue().selected && atomicDataRef.selectionData.setAtomicData( {
        id: 'selectionData',
        selected: parentSelectionData.getValue().selected.map( object => object.uid )
    } );
};
