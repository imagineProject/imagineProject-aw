// Copyright (c) 2023 Siemens

/**
 * @module js/aceSplitEffectivityService
 */

var exports = {};

export let getPropertyNameForSplit  = function( data ) {
    if( data.splitOccurrenceCheckBox.dbValue ) {
        return [ 'MANUAL_SPLIT_OCCURRENCE' ];
    }
    return [];
};

/**
 * Add Element service
 */

export default exports = {
    getPropertyNameForSplit
};
