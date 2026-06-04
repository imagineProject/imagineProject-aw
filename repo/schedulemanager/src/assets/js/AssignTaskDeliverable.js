// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/AssignTaskDeliverable
 */
import AwPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import _ from 'lodash';

import 'js/listBoxService';
import 'js/appCtxService';

var exports = {};

// Make includeType as comma separated string
export let populateValidIncludeTypes = function( data, ctx ) {
    var prefValues = ctx.preferences.ScheduleDeliverableWSOTypes;

    var includeDataTypes = '';

    if(prefValues){
        for( let i = 0; i < prefValues.length; i++ ) {
            if( i === prefValues.length - 1 ) {
                includeDataTypes = includeDataTypes.concat( prefValues[ i ] );
            } else {
                includeDataTypes = includeDataTypes.concat( prefValues[ i ], ',' );
            }
        }
    }

    data.includeTypes = includeDataTypes;
};

/**
 * Check Schedule Deliverable Name of the Deliverable to be added
 * @param {Object} data - Data of ViewModelObject
 * @param {Object} ctx - Context Object
 * @returns {Promise} Promise for getting sch_task_deliverable_list property
 */
export let checkSchDeliverableName = function( data, ctx ) {
    var deferred = AwPromiseService.instance.defer();

    dms
        .getProperties( [ ctx.selected.uid ], [ 'sch_task_deliverable_list' ] )
        .then(
            function() {
                if( ctx.selected.props.sch_task_deliverable_list &&
                    data.dataProviders.scheduleDeliverableSearch.selectedObjects &&
                     ctx.selected.props.sch_task_deliverable_list.uiValue === data.dataProviders.scheduleDeliverableSearch.selectedObjects[ '0' ].props.object_name.uiValue  ) {
                    deferred.reject( data.i18n.sameInstanceNameErrorMsg );
                }
                deferred.resolve();
            } );
    return deferred.promise;
};

exports = {
    populateValidIncludeTypes,
    checkSchDeliverableName
};
export default exports;
