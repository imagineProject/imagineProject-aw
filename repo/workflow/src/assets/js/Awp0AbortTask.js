// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0AbortTask
 */
import awp0InboxUtils from 'js/Awp0InboxUtils';

/**
 * Define public API
 */
var exports = {};

/**
 * Populate the properties on the panel and custom condition paths that needs to be displayed.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {object} - Object that will contain task name and task description
 */
export let populatePanelData = function( data, selection ) {
    //Clone and Populate data taskName property
    const newDataTaskName = awp0InboxUtils.populateJobName( data.taskName, selection );

    //Clone and Populate data description property
    const newDataTaskDesc = awp0InboxUtils.populateJobDescription( data.description, selection );

    return {
        taskName: newDataTaskName,
        description: newDataTaskDesc
    };
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0AbortTask
 */

export default exports = {
    populatePanelData
};
