// Copyright (c) 2022 Siemens

import awGanttConstants from 'js/AwGanttConstants';
import cdm from 'soa/kernel/clientDataModel';

export const getLimitedObjectsFromUids = ( uids, selectedObjectUid ) => {
    let objects = [];
    let selectedUidIndex = uids.indexOf( selectedObjectUid );
    let maxLimit = awGanttConstants.GANTT_SHOW_MAX_OBJECTS_IN_POPUP;
    if( selectedUidIndex > maxLimit - 1 ) {
        uids.splice( selectedUidIndex, 1 );
        uids.splice( 2, 0, selectedObjectUid );
    }
    for( let index = 0; index < uids.length && index < maxLimit; index++ ) {
        let object = cdm.getObject( uids[ index ] );
        if( object ) {
            objects.push( object );
        }
    }
    return objects;
};

export const getObjectsFromUids = ( uids ) => {
    return uids.map( uid => cdm.getObject( uid ) );
};

const exports = {
    getLimitedObjectsFromUids,
    getObjectsFromUids
};

export default exports;
