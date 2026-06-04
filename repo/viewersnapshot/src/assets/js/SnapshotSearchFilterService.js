// Copyright (c) 2022 Siemens

/**
 * Service that provides utility APIs for Snapshot search service.
 *
 * @module js/SnapshotSearchFilterService
 */
import AwStateService from 'js/awStateService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

/**
 * Sets the selected sortOrder as the new params and
 * re-run the search.
 *
 * @function setSelectedSortOrder
 * @param {Object} data data
 */
export let setSelectedSortOrder  = function( fieldName, sortOrder ) {
    var currentSortOrder = AwStateService.instance.params.sortOrder;
    var currentFieldName = AwStateService.instance.params.fieldName;
    if( currentSortOrder !== sortOrder || currentFieldName !== fieldName ) {
        appCtxSvc.updatePartialCtx( 'state.params.fieldName', fieldName );
        appCtxSvc.updatePartialCtx( 'state.params.sortOrder', sortOrder );
        AwStateService.instance.go( '.', {
            fieldName: fieldName,
            sortOrder: sortOrder
        } );
    }
};

export let getSnapshotImageFileUrl = function( data ) {
    return 'fms/fmsdownload/?ticket=' + data.output.views[0].fmsTicket;
};

export default exports = {
    setSelectedSortOrder,
    getSnapshotImageFileUrl
};
