// Copyright (c) 2022 Siemens

/**
 * This implements the tooltip handler interface APIs defined by aw-graph widget to provide tooltip functionalities.
 *
 * @module js/Awp0WorkflowTooltipHandler
 */
var exports = {};

/**
 * Get the tooltip for non root task node
 * @param {Object} graphItem Graph item object
 * @param {Object} bindData Bind data object that will contain all object properties
 *
 * @returns {String} non root node tooltip
 */
var _getNonRootNodeTooltip = function( graphItem, bindData ) {
    var tooltip = bindData.object_name;
    var performAssignee = null;
    if( graphItem.appData.nodeObject.type === 'EPMPerformSignoffTask' &&
        bindData.perform_signoff_assignees !== undefined ) {
        performAssignee = bindData.perform_signoff_assignees;
    }
    // Get the task date tooltip value and append to tooltip
    if( bindData.taskDateTooltip && bindData.taskDateTooltip !== '' ) {
        tooltip += '<br>' + bindData.taskDateTooltip;
    }
    // If task is PS task then get all assignee and append in tooltip
    if( performAssignee && performAssignee !== '' ) {
        tooltip += '<br>' + performAssignee;
    }
    return tooltip;
};

/**
 * Function to be called to get tooltip
 *
 */
export let getTooltip = function( graphItem ) {
    var tooltip = null;
    if( graphItem.appData !== undefined && graphItem.appData.tooltipOfNode !== undefined ) {
        tooltip = graphItem.appData.tooltipOfNode;
    } else if( graphItem.getItemType() === 'Node' ) {
        var bindData = graphItem.getAppObj();

        if( graphItem.appData.nodeObject.props.root_task.dbValues[ 0 ] === graphItem.appData.nodeObject.uid ) {
            tooltip = bindData.job_name;
        } else {
            tooltip = _getNonRootNodeTooltip( graphItem, bindData );
        }
    } else if( graphItem.getItemType() === 'Edge' ) {
        var label = graphItem.getLabel();
        if( label ) {
            tooltip = label.getText();
        }
    } else if( graphItem.getItemType() === 'Label' ) {
        tooltip = graphItem.getText();
    }
    return tooltip;
};

export default exports = {
    getTooltip
};
