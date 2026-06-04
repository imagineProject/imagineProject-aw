// Copyright (c) 2022 Siemens

/**
 * This implements the selection handler interface APIs defined by aw-graph widget to provide selection functionalities.
 *
 * @module js/Awp0WorkflowGraphSelectionService
 */
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Function to be called when we select items on grpah and will update the context.
 * @param {Object} graphModel Graph model object
 * @param {Object} selected - The selected Object.
 * @param {Object} unselected - The unselected Object.
 * @param {Object} workflowViewerContext Context object
 * @param {Object} parentSelectionData Selection data object comes from parent component
 *
 * @returns {Object} Updated context object with selected node info
 */
export let updateContextSelection = function( graphModel, selected, unselected, workflowViewerContext, parentSelectionData ) {
    const workflowViewerCtx = { ...workflowViewerContext };

    // Check if graph is not valid then no need to process further and return from here
    if( !graphModel || !graphModel.graphControl ) {
        return workflowViewerCtx;
    }
    var graphControl = graphModel.graphControl;
    var selectedNodes = graphControl.getSelected( 'Node' );

    // Set the viewer graph selected nodes on context. This is need to enable some commands
    // like create sub process based on graph selection. For finish node this command should not
    // be visible.
    workflowViewerCtx.selectedNodes = selectedNodes;

    // Check if selected or unselected any one input is null then no need to
    // process further.
    if( !selected || !unselected ) {
        return workflowViewerCtx;
    }

    var selectedModelObject = null;
    // Check if graph selection is not null and valid then get 0th index object and get the model object
    if( selected.length > 0 && typeof selected[ '0' ].appData !== typeof undefined && selected[ '0' ].appData.nodeObject ) {
        selectedModelObject = selected[ '0' ].appData.nodeObject;
    }
    // Check if model object is not null and contains valid UID then add it to list and update the parent selection
    var selectedObjects = [];
    if( selectedModelObject && selectedModelObject.uid ) {
        selectedObjects = [ selectedModelObject ];
    }

    // Get the parent selection data and update it with correct selection happening from graph
    const selData = { ...parentSelectionData.value };
    selData.selected = selectedObjects;
    parentSelectionData.update && parentSelectionData.update( selData );
    eventBus.publish( 'Workflow.closeOpenedPanel' );
    return workflowViewerContext;
};

export default exports = {
    updateContextSelection
};
