// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 *
 * @module js/ScheduleManagerCommonUtils
 */


import _ from 'lodash';

/**
 * Get the default page size used for max to load/return.
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
 export let getDefaultPageSize = function( defaultPageSizePreference ) {
    var defaultPageSize = 50;

    if( defaultPageSizePreference ) {
        if( _.isArray( defaultPageSizePreference ) ) {
            defaultPageSize = ScheduleManagerCommonUtils.getDefaultPageSize( defaultPageSizePreference[ 0 ] );
        } else if( _.isString( defaultPageSizePreference ) ) {
            defaultPageSize = parseInt( defaultPageSizePreference );
        } else if( _.isNumber( defaultPageSizePreference ) && defaultPageSizePreference > 0 ) {
            defaultPageSize = defaultPageSizePreference;
        }
    }

    return defaultPageSize;
};

const ScheduleManagerCommonUtils = {
    getDefaultPageSize
};

export default ScheduleManagerCommonUtils;