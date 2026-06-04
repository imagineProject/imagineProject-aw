// Copyright (c) 2022 Siemens

/**
 * AutoLayout command handler for workflwo viewer
 *
 * @module js/Awp0WorkflowViewerAutoLayoutHandler
 */
var exports = {};

/*
 * Disable auto layout
 * @param {Object} ctx Context object
 * @param {String} layoutOption Selected Layout string object
 */
export let disableAutoLayout = function( graphModel, workflowViewerContext, layoutOption ) {
    //Need to return autoLayoutState to avoid execution of enable and disable auto layout in one flow
    if( !workflowViewerContext || !workflowViewerContext.diagram || !graphModel ) {
        return;
    }
    var autoLayoutState = workflowViewerContext.diagram.isAutoLayoutOn;
    var graphControl = graphModel.graphControl;
    var layout = graphControl.layout;

    if( layout ) {
        layout.deactivate();
        const workflowViewerCtx = { ...workflowViewerContext.value };
        if( workflowViewerCtx && workflowViewerContext.value && workflowViewerCtx.diagram ) {
            workflowViewerCtx.diagram.isAutoLayoutOn = false;
            workflowViewerCtx.diagram.layoutOption = layoutOption;
            workflowViewerCtx.diagram.isSwitchingBetweenAutoLayout = false;
            workflowViewerCtx.workflowGraphShowSubProcessData = false;
            workflowViewerContext.update && workflowViewerContext.update( workflowViewerCtx );
        }
    }
    return autoLayoutState;
};

/*
 * Enable auto layout
 * @param {Object} ctx Context object
 * @param {String} layoutOption Selected Layout string object
 */
export let enableAutoLayout = function( graphModel, workflowViewerContext, layoutOption ) {
    // Check if not valid then no need to process further
    if( !workflowViewerContext || !workflowViewerContext.diagram || !graphModel ) {
        return;
    }
    var graphControl = graphModel.graphControl;
    var layout = graphControl.layout;
    if( layout ) {
        layout.activate();
        if( workflowViewerContext && workflowViewerContext.value && workflowViewerContext.diagram ) {
            const workflowViewerCtx = { ...workflowViewerContext.value };
            var oldLayoutValue = workflowViewerCtx.diagram.isAutoLayoutOn;
            workflowViewerCtx.diagram.isAutoLayoutOn = true;
            workflowViewerCtx.diagram.layoutOption = layoutOption;
            workflowViewerCtx.diagram.isSwitchingBetweenAutoLayout = oldLayoutValue;
            // Check if this key is present then we need to delete it from context object and update
            if( workflowViewerCtx.hasOwnProperty( 'workflowGraphShowSubProcessData' ) ) {
                delete workflowViewerCtx.workflowGraphShowSubProcessData;
            }
            workflowViewerContext.update && workflowViewerContext.update( workflowViewerCtx );
        }
    }
};

export default exports = {
    disableAutoLayout,
    enableAutoLayout
};
