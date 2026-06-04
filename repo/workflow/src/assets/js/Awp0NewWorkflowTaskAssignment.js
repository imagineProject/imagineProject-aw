// Copyright (c) 2022 Siemens

/**
 * This implements the workflow task assignements implementation
 *
 * @module js/Awp0NewWorkflowTaskAssignment
 */
import workflowAssignmentSvc from 'js/Awp0WorkflowAssignmentService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Update the task related assignemnt information that will be like assignee, reviewers, acknowledgers or notifyers
 * and along with deferred particiapnt information.
 *
 * @param {Object} data Data view model object
 * @param {Object} panelContext Panel context that will contain all information when user make changes from panel
 * @param {Object} selectedTask Task Object whose information need to be updated
 * @param {Object} context Context object where particpant related changes will be stored
 * @param {String} mainPanelId Main panel id string which need to be visible when user click on modify button
 */
export let updateTaskAssignmentData = function( data, panelContext, selectedTask, context, mainPanelId ) {
    workflowAssignmentSvc.updateTaskAssignments( data, panelContext, selectedTask, context );

    context.enableModifyButton = false;
    data.activeView = mainPanelId;

    if( mainPanelId ) {
        var closeSubPanelEvent = {
            source: mainPanelId
        };
        data.activeView = mainPanelId;
        data.previousView = mainPanelId;
        eventBus.publish( 'complete.subPanel', closeSubPanelEvent );
    }
    // Update the table with new assignments
    eventBus.publish( 'taskTreeTable.plTable.reload' );
};

/**
 *
 * @param {Object} data Data view model object
 * @param {String} mainPanelId Main panel id string which need to o back to main panel
 */
export let backToMainPanel = function( data, mainPanelId ) {
    if( mainPanelId ) {
        data.activeView = mainPanelId;
        data.previousView = mainPanelId;
        var closeSubPanelEvent = {
            source: mainPanelId
        };
        eventBus.publish( 'complete.subPanel', closeSubPanelEvent );
    }
};

export default exports = {
    updateTaskAssignmentData,
    backToMainPanel
};
