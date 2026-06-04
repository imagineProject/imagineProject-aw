// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0PromoteTask
 */
import Awp0InboxUtils from 'js/Awp0InboxUtils';

var exports = {};

/**
 * get the comments entered on the panel.
 *
 * @param {object} data - the data Object
 * @returns {object} data - the return data Object
 */
export let getComments = function( data ) {
    return Awp0InboxUtils.getComments( data );
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @returns {object} - the object which have taskName, description, promoteTask and hasFailurePath value of data property
 */
export let populatePanelData = function( data, selection ) {
    let promoteTaskObjInfo = {};
    let hasFailurePath = false;

    if( selection ) {
        //If selected object is present, get taskName, description and promoteTask details
        promoteTaskObjInfo = Awp0InboxUtils.populatePanelData( data, selection );
        const taskToPromote = promoteTaskObjInfo.actionableTask;

        //Check if taskToPromote has failure path or not
        if( taskToPromote && taskToPromote.props.has_failure_paths && taskToPromote.props.has_failure_paths.dbValues ) {
            hasFailurePath = taskToPromote.props.has_failure_paths.dbValues[ 0 ] === '1';
        }
    }

    return {
        taskName: promoteTaskObjInfo.taskName,
        description: promoteTaskObjInfo.description,
        promoteTask: promoteTaskObjInfo.actionableTask,
        hasFailurePath : hasFailurePath
    };
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0PromoteTask
 */

export default exports = {
    getComments,
    populatePanelData
};
