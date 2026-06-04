// Copyright (c) 2022 Siemens

/**
 * This implements the selection handler interface APIs defined by aw-graph widget to provide selection functionalities.
 *
 * @module js/Awp0WorkflowDesignerSelectionService
 */
import appCtxSvc from 'js/appCtxService';
import selectionService from 'js/selection.service';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

var sourceObj;

/**
 * This function will set the source object to the context.
 * @param {Object} selection - The selected Object
 */
export let setSourceObject = function( selection ) {
    sourceObj = selection;
    selectionService.updateSelection( sourceObj );
};

/**
 * Based on selected nodes from UI update the context values that will be used
 * for command visibility.
 * @param {Array} selectedNodes Selected nodes from graph
 * @param {Array} selectedEdges Selected edges from graph
 */
var _updateWorkflowGraphCommandVisibility = function( selectedNodes, selectedEdges, workflowDgmTempState ) {
    var isRemoveTaskTemplateCommandVisible = false;
    // Check if selected nodes are not null and selected node is not
    // root task template then only set the variabel to true.
    if( selectedNodes && selectedNodes.length > 0 ) {
        isRemoveTaskTemplateCommandVisible = true;

        // Check if only one node is selected then set the remove variable
        if( selectedNodes.length === 1 && selectedNodes[ 0 ] ) {
            isRemoveTaskTemplateCommandVisible = Awp0WorkflowDesignerUtils.canGraphItemRemoved( selectedNodes[ 0 ] );
        }
    } else if( !isRemoveTaskTemplateCommandVisible && selectedEdges && selectedEdges.length > 0 ) {
        isRemoveTaskTemplateCommandVisible = true;
        // Check if only one node is selected then set the remove variable
        if( selectedEdges.length === 1 && selectedEdges[ 0 ] ) {
            isRemoveTaskTemplateCommandVisible = Awp0WorkflowDesignerUtils.canGraphItemRemoved( selectedEdges[ 0 ] );
        }
    }
    workflowDgmTempState.isRemoveTaskTemplateCommandVisible = isRemoveTaskTemplateCommandVisible;
    return workflowDgmTempState;
};

/**
 * Check if input object is of type input type. If yes then
 * return true else return false.
 *
 * @param {Obejct} obj Object to be match
 * @param {String} type Object type to match
 *
 * @return {boolean} True/False
 */
var _isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * This special check is needed when selected object is EPMReviewTaskTemplate or EPMAcknowledgeTaskTemplate then
 * check if it's under route task then return true so that assignemnt tab will be hidden else it show the tab.
 * @param {Object} selObject Selected object from UI
 *
 * @returns {boolean} True/False
 */
var _isInValidForAssignmentTab = function( selObject ) {
    if( selObject && _isOfType( selObject, 'EPMReviewTaskTemplate' ) || _isOfType( selObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        var parentTemplate = Awp0WorkflowDesignerUtils.getParentTaskTemplate( selObject );
        if( parentTemplate && _isOfType( parentTemplate, 'EPMRouteTaskTemplate' ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Update the context information for workflow designer for workflow graph.
 */
var _updateWorkflowGraphCtx = function( workflowDgmTempState ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var isGroupSelectedNode = false;
    var graphControl = graphContext.graphModel.graphControl;
    var groupGraph = graphControl.groupGraph;
    var selectedNodes = workflowDgmTempState.selectedNodes;
    var selectedEdges = workflowDgmTempState.selectedEdges;
    // var selectedLabel = graphControl.getSelected( 'Label' );
    // if( selectedLabel && selectedLabel.length > 0 && selectedLabel[ 0 ] ) {
    //     selectedEdges.push( selectedLabel[ 0 ].getOwner() );
    // }
    var selNode = null;
    var selObject = null;
    if( groupGraph && selectedNodes && selectedNodes.length > 0 ) {
        selNode = selectedNodes[ 0 ];
        selObject = selNode.modelObject;
        // check if the single selected node is Group node and its valid node
        if( groupGraph && groupGraph.isGroup( selectedNodes[ 0 ] ) && selectedNodes[ 0 ].modelObject ) {
            isGroupSelectedNode = true;
        }
    }
    // Check if current selection assignemnt tab will be shown or hidden
    var isInvalidSelectionAssignmentTab = _isInValidForAssignmentTab( selObject );
    if( workflowDgmTempState ) {
        workflowDgmTempState.isGroupSelectedNode = isGroupSelectedNode;
        // workflowDgmTempState.selectedNodes = selectedNodes;
        // workflowDgmTempState.selectedEdges = selectedEdges;
        // if( selObject ) {
        //     workflowDgmTempState.selectedObject = selObject;
        // }
        workflowDgmTempState.isInvalidSelectionAssignmentTab = isInvalidSelectionAssignmentTab;
    }
    return _updateWorkflowGraphCommandVisibility( selectedNodes, selectedEdges, workflowDgmTempState );
};

/**
 * Function to be called when we select items on grpah and will update the context.
 * @param {Object} selected - The selected Object.
 * @param {Object} unselected - The unselected Object.
 */
export let updateContextSelection = function( workflowDgmTempState ) {
    var selectedObjects = [];
    var graph = appCtxSvc.getCtx( 'graph' );

    // Check if graph is not valid then no need to process further and return from here
    if( !graph || !graph.graphModel || !graph.graphModel.graphControl ) {
        return;
    }
    var graphControl = graph.graphModel.graphControl;

    // Get all selected nodes from graph and based on that update the selection
    // on selection service
    _.forEach( graphControl.getSelected( 'Node' ), function( selectedNode ) {
        // Check if node has valid model obejct then only add it to selection
        if( selectedNode.modelObject ) {
            selectedObjects.push( selectedNode.modelObject );
        }
    } );

    // // Check if selected object is empty then set the source root task template as selected object.
    // if( selectedObjects && selectedObjects.length === 0 ) {
    //     selectedObjects.push( sourceObj );
    // }

    // // This is fix for defect # LCS-302944. Set the selection only in case if there is any selection
    // // in primary work area else no need to update the graph selection to main root selection
    // if( appCtxSvc.ctx.selected && selectedObjects[ 0 ] ) {
    //     selectionService.updateSelection( selectedObjects, sourceObj );
    // }
    return _updateWorkflowGraphCtx( workflowDgmTempState );
};

/**
 * Function to be called when we select items on grpah. This method check if latest selection on graph
 * is node or edge then based on that it will update the URL and show corresponding tabs.
 * @param {Object} selected - The selected Object.
 * @param {Object} unselected - The unselected Object.
 */
export let updateGraphSelection = function( selected, unselected, workflowDgmState, selectionData, currentTab ) {
    const workflowDgmTempState = { ...workflowDgmState };
    var graph = appCtxSvc.getCtx( 'graph' );
    // Check if graph is not valid then no need to process further and return from here
    if( !graph || !graph.graphModel || !graph.graphModel.graphControl ) {
        return;
    }
    // handling the case where edge is removed
    if( !selected && currentTab === 'Awp0EdgeInfoProperties' ) {
        currentTab = 'Awp0TaskPropertiesTab';
    }
    if( unselected && unselected[0] && ( unselected[0].itemType === 'Edge' || !unselected[0].itemType ) ) {
        currentTab = 'Awp0TaskPropertiesTab';
    }
    if( selected && selected[0] && ( selected[0].itemType === 'Edge' || !selected[0].itemType ) ) {
        currentTab = 'Awp0EdgeInfoProperties';
    }
    // Based on input selected object array that the first selection that will be always latest selection
    var selectedGraphItem = null;
    if( _.isArray( selected ) && selected && selected[ 0 ] ) {
        selectedGraphItem = selected[ 0 ];
    } else if( !_.isArray( selected ) && selected ) {
        selectedGraphItem = selected;
    }
    // Check if model object is not null and contains valid UID then add it to list and update the parent selection
    var selectedObjects = [];
    // Based on input selected object array that the first selection that will be always latest selection
    if( selectedGraphItem && selectedGraphItem.itemType ) {
        if( selectedGraphItem.itemType === 'Node' ) {
            selectedObjects.push( selectedGraphItem.modelObject );
            workflowDgmTempState.selectedEdges = [];
            workflowDgmTempState.selectedNodes = selected;
            Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selectedObjects[ 0 ].uid, source_uid: null, target_uid: null, ttab_name:currentTab } );
        } else if( selectedGraphItem.itemType === 'Edge' ) {
            selectedObjects.push( appCtxSvc.ctx.xrtSummaryContextObject );
            workflowDgmTempState.selectedEdges = selected;
            workflowDgmTempState.selectedNodes = [];
            Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selectedObjects[0].uid, source_uid: selected[0].sourceNode.nodeId, target_uid: selected[0].targetNode.nodeId, ttab_name:currentTab  } );
        }
    } else if( selectedGraphItem && !selectedGraphItem.itemType ) {
        selectedObjects.push( appCtxSvc.ctx.xrtSummaryContextObject );
        let selectedEdge = selectedGraphItem.getOwner();
        workflowDgmTempState.selectedEdges.push( selectedEdge );
        workflowDgmTempState.selectedNodes = [];
        Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selectedObjects[0].uid, source_uid: selectedEdge.sourceNode.nodeId, target_uid: selectedEdge.targetNode.nodeId, ttab_name:currentTab  } );
    } else {
        selectedObjects.push( appCtxSvc.ctx.xrtSummaryContextObject );
        Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selectedObjects[ 0 ].uid, source_uid: null, target_uid: null, ttab_name:currentTab  } );
        workflowDgmTempState.selectedEdges = [];
        workflowDgmTempState.selectedNodes = [];
    }
    // Get the parent selection data and update it with correct selection happening from graph
    const selData = { ...selectionData.value };
    selData.selected = selectedObjects;
    selectionData.update && selectionData.update( selData );
    workflowDgmTempState.selectedObject = selectedObjects[0];
    return exports.updateContextSelection( workflowDgmTempState );
};

/**
 * Check if uid on URL and obejct that need to be selected in PWA both are same
 * then update the selection on graph as well. This is needed for defect # LCS-344143
 * @param {Object} selectionData current selectionData which needs to be updated
 * @param {Object} selectionModel Selection model object
 * @param {Object} ctx App Context  object
 * 
 */
export let syncPWASelectionInGraph = function( selectionData, selectionModel, ctx, workflowDgmState ) {
    if( ctx.state.params && selectionModel ) {
        const workflowDgmTempState = { ...workflowDgmState };
        var selObjArray = selectionModel;
        // Check if selection is not empty and contians first selection then
        // only set the selection on graph if it match with PWA selection
        if( selObjArray && selObjArray.length === 1 && selObjArray[ 0 ] ) {
            workflowDgmTempState.selectedObject = selObjArray[0];

            // Check if selected nodes or edges are not null then we need to clear the graph selection from here
            // and then return the workflow state with no nodes selection. This will be use in case like user modified some
            // properties from task information tab and then click on save edit command to make the template online that time
            // primary work area will get refresh and reset and selection will be set again on PWA. We need to clear the graph selection
            // in that case so correct object properties are shown.
            if( workflowDgmTempState.selectedNodes && workflowDgmTempState.selectedNodes.length > 0 ||  workflowDgmTempState.selectedEdges && workflowDgmTempState.selectedEdges.length > 0 ) {
                var graph = appCtxSvc.getCtx( 'graph' );
                if( graph && graph.graphModel && graph.graphModel.graphControl ) {
                    graph.graphModel.graphControl.setSelected( null, true );
                }
                workflowDgmTempState.selectedNodes = [];
                workflowDgmTempState.selectedEdges = [];
            }

            if( selObjArray[ 0 ] && selObjArray[ 0 ].uid ===  ctx.state.params.uid ) {
                return workflowDgmTempState;
            }
            selectionData && selectionData.update( selObjArray[0] );
            Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selObjArray[ 0 ].uid, source_uid: null, target_uid: null } );
        }else{
            Awp0WorkflowDesignerUtils.updateURL( { sc_uid: null, source_uid: null, target_uid: null } );
        }
        return workflowDgmTempState;
    }
};

/**
 * Set the default selection on graph as it can be node or edge as based on that selection
 * respective tab will show the information. This is mainly needed in refresh case.
 *
 * @param {Object} selection Selected root task template object.
 * @param {Object} parameters object that will contain all parameters info present on URL.
 */
export let setDefaultGraphSelection = function( data, selection, parameters ) {
    if( !parameters ) {
        return;
    }

    // Get the node id, source uid and target uid from URL and based on that respective
    // grpah item need to be selected.
    var selObjectUid = parameters.sc_uid;
    var sourceNodeId = parameters.source_uid;
    var targetNodeId = parameters.target_uid;

    // Check if no selection infomation present on URL then jsut set the root task template id on URL
    // and return from here
    if( !selObjectUid && selection && !sourceNodeId && !targetNodeId ) {
        Awp0WorkflowDesignerUtils.updateURL( { sc_uid: selection.uid } );
        return;
    }

    var graph = appCtxSvc.getCtx( 'graph' );

    // Check if graph is not valid then no need to process further and return from here
    if( !graph || !graph.graphModel || !graph.graphModel.graphControl ) {
        return;
    }
    var graphControl = graph.graphModel.graphControl;
    var item = null;
    // Check if node need to be selected
    if( selObjectUid && graph.graphModel.nodeMap[ selObjectUid ] ) {
        item = graph.graphModel.nodeMap[ selObjectUid ];
        // Check if item is not visible by default then get the top level parent node and highlight that top node
        if( item && !item.isVisible() ) {
            item = Awp0WorkflowDesignerUtils.getTopLevelParentNode( graphControl.groupGraph, item );
        }
    } else if( sourceNodeId && targetNodeId && graph.graphModel.nodeMap[ sourceNodeId ] ) {
        // Edge need to be selected then get the correct edge from source id and check the target node id
        // to match it.
        var sourceNode = graph.graphModel.nodeMap[ sourceNodeId ];
        var outEdges = sourceNode.getEdges( 'OUT' );
        if( outEdges && outEdges.length > 0 ) {
            for( var idx = 0; idx < outEdges.length; idx++ ) {
                if( outEdges[ idx ] && outEdges[ idx ].targetNode && outEdges[ idx ].targetNode.nodeId === targetNodeId ) {
                    item = outEdges[ idx ];
                    break;
                }
            }
        }
    }

    // If graph item need to be selected then call the graph API to select it.
    if( item ) {
        graphControl.setSelected( [ item ], true, true );
    }
    //exports.updateContextSelection( data.workflowDgmState );
};

export default exports = {
    setSourceObject,
    updateContextSelection,
    updateGraphSelection,
    setDefaultGraphSelection,
    syncPWASelectionInGraph
};
