// Copyright (c) 2022 Siemens

/**
 * This implements the tooltip handler interface APIs defined by aw-graph widget to provide tooltip functionalities.
 *
 * @module js/Awp0WorkflowDesignerTooltipHandler
 */
var exports = {};

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
        tooltip = bindData.Name;
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
