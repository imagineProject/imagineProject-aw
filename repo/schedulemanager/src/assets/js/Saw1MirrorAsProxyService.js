// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1MirrorAsProxyService
 */
var exports = {};

/**
 * get fetchAllLevelSubschedules.dbValue property (boolean),
 * convert to String, and save in dbValueForSoa property.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let getStringFromBoolean = function( data ) {
    var selectedOne = String( data.fetchAllLevelSubschedules.dbValue );
    data.fetchAllLevelSubschedules.dbValueForSoa = selectedOne;
};

/**
 * Convert the list of sub-schedules returned from performSearch
 * to array suitable for Soa call createProxyTasks().
 * Note that always set sublevels=0, because performSearch always
 * handles the sub-sub-schedule searching.
 *
 * @param {Object} schTask - The selected Task
 * @param {Object} data - The qualified data of the viewModel
 * @returns {object} The input for createProxyTasks
 *
 */
export let getCreateProxyTaskContainer = function( schTask, data ) {
    var input = [];
    let schedules = [];
    schedules = data.searchResults;
    if( schedules ) {
        for( var i = 0; i < schedules.length; i++ ) {
            let sched = schedules[i];
            let inp = {
                schedule: sched,
                sublevels: 0,
                taskTag: schTask
                //refTag: no need to set this; server code will compute it
            };
            input.push( inp );
        }
    }

    return input;
};

exports = {
    getStringFromBoolean,
    getCreateProxyTaskContainer
};
export default exports;
