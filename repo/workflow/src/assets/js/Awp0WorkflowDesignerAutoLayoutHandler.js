// Copyright (c) 2022 Siemens

/**
 *AutoLayout command handler
 *
 * @module js/Awp0WorkflowDesignerAutoLayoutHandler
 */
import editService from 'js/Awp0WorkflowAssignmentEditService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

/*
 * Disable auto layout
 * @param {Object} ctx Context object
 * @param {String} layoutOption Selected Layout string object
 */
export let disableAutoLayout = function( ctx, layoutOption, workflowDgmState ) {
    //Need to return autoLayoutState to avoid execution of enable and disable auto layout in one flow
    if( !workflowDgmState || !workflowDgmState.diagram ) {
        return;
    }
    // Get the edit handler and if not null then save the edits if any edit is done before applying the layout
    var editHandler = editService.getActiveEditHandler();
    if( editHandler && editHandler.isDirty() ) {
        editHandler.saveEdits();
    }

    var autoLayoutState = workflowDgmState.diagram.isAutoLayoutOn;
    var graphModel = ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var gridPreferences = graphControl.grid.preferences;
    var alignPreferences = graphControl.alignment.preferences;
    var graph = graphControl.graph;
    var layout = graphControl.layout;

    if( layout ) {
        layout.deactivate();
        graph.update( function() {
            //Enable auto alignment on auto layout OFF
            gridPreferences.enableSnapping = true;
            alignPreferences.enabled = true;
        } );
        if( workflowDgmState && workflowDgmState.diagram ) {
            const workflowDgmTempState = { ...workflowDgmState.value };
            workflowDgmTempState.diagram.isAutoLayoutOn = false;
            workflowDgmTempState.diagram.layoutOption = layoutOption;
            workflowDgmTempState.diagram.isSwitchingBetweenAutoLayout = false;
            workflowDgmState.update && workflowDgmState.update( workflowDgmTempState );
            appCtxSvc.ctx.workflowDgmState = workflowDgmState;
        }
    }
    return autoLayoutState;
};

/*
 * Enable auto layout
 * @param {Object} ctx Context object
 * @param {String} layoutOption Selected Layout string object
 */
export let enableAutoLayout = function( ctx, layoutOption, workflowDgmState ) {
    // Check if not valid then no need to process further
    if( !ctx.graph || !ctx.graph.graphModel ) {
        return;
    }
    // Get the edit handler and if not null then save the edits if any edit is done before applying the layout
    var editHandler = editService.getActiveEditHandler();
    if( editHandler ) {
        editHandler.saveEdits();
    }

    var graphControl = ctx.graph.graphModel.graphControl;
    var gridPreferences = graphControl.grid.preferences;
    var alignPreferences = graphControl.alignment.preferences;
    var graph = graphControl.graph;
    var layout = graphControl.layout;
    if( layout ) {
        layout.activate();
        graph.update( function() {
            //Disable auto alignment and snapping on auto layout ON
            gridPreferences.enableSnapping = false;
            alignPreferences.enabled = false;
        } );
        if( workflowDgmState && workflowDgmState.diagram ) {
            const workflowDgmTempState = { ...workflowDgmState.value };
            var oldLayoutValue = workflowDgmTempState.diagram.isAutoLayoutOn;
            workflowDgmTempState.diagram.isAutoLayoutOn = true;
            workflowDgmTempState.diagram.layoutOption = layoutOption;
            workflowDgmTempState.diagram.isSwitchingBetweenAutoLayout = oldLayoutValue;
            workflowDgmState.update && workflowDgmState.update( workflowDgmTempState );
            appCtxSvc.ctx.workflowDgmState = workflowDgmState;
        }
    }
};

export default exports = {
    disableAutoLayout,
    enableAutoLayout
};
