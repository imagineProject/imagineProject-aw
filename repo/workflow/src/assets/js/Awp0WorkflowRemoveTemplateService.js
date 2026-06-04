// Copyright (c) 2022 Siemens

/**
 * Thsi will be used for remove nodes or edge cases.
 *
 * @module js/Awp0WorkflowRemoveTemplateService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import layoutService from 'js/Awp0WorkflowDesignerLayoutService';
import nodeService from 'js/Awp0WorkflowDesignerNodeService';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import soaSvc from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {Array} Property internal values array
 */
var _getPropValue = function( modelObject, propName ) {
    var propValue = [];
    if( modelObject && modelObject.props[ propName ] ) {
        propValue = modelObject.props[ propName ].dbValues;
    }
    return propValue;
};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {Array} Property internal values array
 */
var _getParentPropValue = function( modelObject, propName ) {
    var parentPropValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = modelObject.props[ propName ].dbValues;
        if( values && values[ 0 ] ) {
            parentPropValue = values[ 0 ];
        }
    }
    return parentPropValue;
};

/**
 * Get all nodes that needs to be removed.

 *
 * @return {Array} selectedNodes Selected nodes array that can be removed
 */
export let getNodesToBeRemoved = function( ) {
    var nodesToBeDeleted = [];
    var graphModel = appCtxService.ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var nodes = graphControl.getSelected( 'Node' );
    if( nodes && nodes.length > 0 ) {
        _.forEach( nodes, function( node ) {
            var canDelete = Awp0WorkflowDesignerUtils.canGraphItemRemoved( node );
            if( canDelete ) {
                nodesToBeDeleted.push( node );
            }
        } );
    }
    return nodesToBeDeleted;
};

/**
 * Process for input nodes that need to be removed and create the SOA input
 * that will be used for removing.
 * @returns {Array} Model object array that can be deleted
 */
export let getRemoveNodeInput = function( ) {
    var objectsToBeDeleted = [];
    var graphModel = appCtxService.ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var nodes = graphControl.getSelected( 'Node' );
    if( nodes && nodes.length > 0 ) {
        _.forEach( nodes, function( node ) {
            var canDelete = Awp0WorkflowDesignerUtils.canGraphItemRemoved( node );
            if( canDelete && node.modelObject ) {
                objectsToBeDeleted.push( node.modelObject );
            }
        } );
    }
    return objectsToBeDeleted;
};

/**
 * Get all edges that needs to be removed.


 * @return {Array} selectedEdges Selected edges array that can be removed
 */
export let getEdgesToBeRemoved = function( ) {
    var edgesToBeDeleted = [];
    var graphModel = appCtxService.ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var edges = graphControl.getSelected( 'Edge' );
    if( edges && edges.length > 0 ) {
        _.forEach( edges, function( edge ) {
            var canDelete = Awp0WorkflowDesignerUtils.canGraphItemRemoved( edge );
            if( canDelete ) {
                edgesToBeDeleted.push( edge );
            }
        } );
    }
    return edgesToBeDeleted;
};

/**
 * Create the SOA input for input edges that will be removed.
 *
 * @param {Array} edgesToBeDeleted Selected edges array that need to be removed
 *
 * @return {Array} SOA input with removed edge information
 */
var _createRemoveEdgeSOAInput = function( edgesToBeDeleted ) {
    var soaInput = [];
    _.forEach( edgesToBeDeleted, function( edge ) {
        var sourceObject = edge.sourceNode.modelObject;
        var targetObject = edge.targetNode.modelObject;
        var category = edge.category;
        var sourceParentValues = _getPropValue( sourceObject, 'parent_task_template' );
        var targetParentValues = _getPropValue( targetObject, 'parent_task_template' );

        var map = {};
        var propValue = [];
        // Check if source object is not null and same as root process template.
        if( sourceObject && targetParentValues && targetParentValues[ 0 ] && sourceObject.uid === targetParentValues[ 0 ] ) {
            map = {
                parent_predecessor: [ 'false' ]
            };
        } else if( sourceObject && targetObject && sourceParentValues && sourceParentValues[ 0 ] && targetObject.uid === sourceParentValues[ 0 ] ) {
            // Check if target object is not null and same as root process template.
            propValue = _getPropValue( targetObject, 'complete_predecessors' );
            var index = propValue.indexOf( sourceObject.uid );
            if( index !== -1 ) {
                propValue.splice( index, 1 );
            }
            map = {
                complete_predecessors: propValue
            };
        } else {
            // If category is fail then set fail_predecessor
            if( category === 'FailPath' ) {
                // Check if target object is not null and same as root process template.
                propValue = _getPropValue( targetObject, 'fail_predecessors' );
                var failPathIdx = propValue.indexOf( sourceObject.uid );
                if( failPathIdx !== -1 ) {
                    propValue.splice( failPathIdx, 1 );
                }
                map = {
                    fail_predecessors: propValue
                };
            } else {
                // Check if target object is not null and same as root process template.
                propValue = _getPropValue( targetObject, 'predecessors' );
                var successPathIdx = propValue.indexOf( sourceObject.uid );
                if( successPathIdx !== -1 ) {
                    propValue.splice( successPathIdx, 1 );
                }
                map = {
                    predecessors: propValue
                };
            }
        }
        var object = {
            clientID: 'saveTemplate ' + targetObject.uid,
            templateToUpdate: targetObject.uid,
            additionalData: map
        };

        soaInput.push( object );
    } );
    return soaInput;
};

/**
 * Remove the nodes and edges from graph.


 */
export let removeGraphNodeEdges = function( ) {
    var allPromises = [];
    var removeGraphItems = [];
    var nodes = exports.getNodesToBeRemoved();
    // Get all valid nodes that can be deleted and create the SOA input for delete
    if( nodes && nodes.length > 0 ) {
        var objectsToBeDeleted = [];
        var nodesToBeDeleted = [];
        _.forEach( nodes, function( node ) {
            var canDelete = Awp0WorkflowDesignerUtils.canGraphItemRemoved( node );
            if( canDelete ) {
                nodesToBeDeleted.push( node );
                if( node.modelObject ) {
                    objectsToBeDeleted.push( node.modelObject );
                }
            }
        } );
        removeGraphItems = nodesToBeDeleted;

        var deletePromise = soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: objectsToBeDeleted } );
        allPromises.push( deletePromise );
    }
    var edgesToBeDeleted = [];
    // Get all valid edges that can be removed and create the createOrUpdateTemplate SOA input to update
    edgesToBeDeleted = exports.getEdgesToBeRemoved();
    if( edgesToBeDeleted && edgesToBeDeleted.length > 0 ) {
        Array.prototype.push.apply( removeGraphItems, edgesToBeDeleted );
        var inputData = _createRemoveEdgeSOAInput( edgesToBeDeleted );

        var soaInput = {
            input: inputData
        };

        // Check if SOA input is not null and not empty then only make SOA call
        if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
            var promise = soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateTemplate', soaInput );
            allPromises.push( promise );
        }
    }

    // When all SOA gets completed then only call below internal code
    // to update the UI or show the error.
    AwPromiseService.instance.all( allPromises ).then( function() {
        exports.removeGraphElements( removeGraphItems );
    }, function( error ) {
        if( error && error.message ) {
            messagingService.showError( error.message );
        }
    } );
};

/**
 * Process for input edges that need to be removed and create the SOA input
 * that will be used for removing.
 * @param {Object} ctx Context obejct
 * @param {Array} selectedEdges Selected edges array that need to be removed
 * @param {Object} rootProcessTemplate Root process template object
 * @return {Array} SOA input with removed edge information
 */
export let getRemoveEdgeInput = function( selectedEdges, rootProcessTemplate ) {
    var soaInput = [];
    var edgesToBeDeleted = [];
    if( selectedEdges && selectedEdges.length > 0 && rootProcessTemplate ) {
        edgesToBeDeleted = exports.getEdgesToBeRemoved();
        // SOA input with all edge information that will be removed
        soaInput = _createRemoveEdgeSOAInput( edgesToBeDeleted );
    }
    return soaInput;
};

/**
 * Remove the graph elements from graph either edges or nodes. It will calcualte
 * what all nodes and edge will need to be remvoed then remove it from graph and
 * update the graph cache as well.
 * @param {Array} objectstoRemove Objects that need to be removed
 */
var _removeElementsFromGraph = function( objectstoRemove ) {
    var graphModel = appCtxService.ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var layout = graphModel.graphControl.layout;
    var edgeToBeRemoved = [];
    var nodeToBeRemoved = [];
    var addfectedParentNodes = [];
    layoutService.clearGraphItemLists();
    _.forEach( objectstoRemove, function( removeObject ) {
        if( removeObject && removeObject.itemType === 'Edge' ) {
            layoutService.addEdgeToBeRemoved( removeObject );
            edgeToBeRemoved.push( removeObject );
        } else if( removeObject && removeObject.itemType === 'Node' ) {
            nodeToBeRemoved.push( removeObject );
            var parentNode = groupGraph.getParent( removeObject );
            if( parentNode ) {
                addfectedParentNodes.push( parentNode );
            }
            var edges = removeObject.getEdges();
            edgeToBeRemoved = edgeToBeRemoved.concat( edges );
            // Get all childrens that needs to be removed
            var children = groupGraph.getChildNodes( removeObject );
            if( children && children.length > 0 ) {
                nodeToBeRemoved = nodeToBeRemoved.concat( children );
            }
        }
    } );

    // Check if edge removed is not null then only remvoe the edges
    // and update the edge cache.
    if( edgeToBeRemoved && edgeToBeRemoved.length > 0 ) {
        _.forEach( edgeToBeRemoved, function( removeEdge ) {
            layoutService.addEdgeToBeRemoved( removeEdge );
            if( removeEdge.getSourceNode() && removeEdge.getSourceNode().nodeId ) {
                delete graphModel.edgeMap[ removeEdge.getSourceNode().nodeId ];
            }
        } );
        // First deleting the element from cache edge map and then removing the edges
        graph.removeEdges( edgeToBeRemoved );
    }

    // Check if node removed is not null then only remvoe the nodes
    // and update the node cache.
    if( nodeToBeRemoved && nodeToBeRemoved.length > 0 ) {
        graph.removeNodes( nodeToBeRemoved, true );
        _.forEach( nodeToBeRemoved, function( removeNode ) {
            layoutService.addNodeToBeRemoved( removeNode );
            if( removeNode.nodeId ) {
                delete graphModel.nodeMap[ removeNode.nodeId ];
            }
        } );
    }

    // Check fo affected parent node list is not empty then update those
    // parent nodes as well.
    if( addfectedParentNodes && addfectedParentNodes.length > 0 ) {
        nodeService.updateGraphInfoOnNodes( addfectedParentNodes, graphModel, true );
    }
};

/**
 * Remove the graph elements from graph either edges or nodes
 * @param {Array} objectstoRemove Objects that need to be removed
 */
export let removeGraphElements = function( objectstoRemove, data, state ) {
    // Check if input array is not null then only process further
    if( objectstoRemove && objectstoRemove.length > 0 ) {
        var graphModel = appCtxService.ctx.graph.graphModel;
        _removeElementsFromGraph( objectstoRemove );
        // var startNode = _.find( graphModel.nodeMap, function( node ) {
        //     return node && node.appData && node.appData.nodeType && node.appData.nodeType === 'start';
        // } );
        // var scUidToUpdate =  appCtxService.ctx.xrtSummaryContextObject.uid;
        // // This check is mainly needed to get he correct start node we are showing in graph when
        // // graph is in fixed layout and user navigate to inside some task to see its children and then
        // // user remove some children then URL should be updated with that correct start node object URL
        // // and not with main graph object URL
        // if( startNode && startNode.modelObject && startNode.modelObject.uid ) {
        //     scUidToUpdate = startNode.modelObject.uid;
        // }
        // const workflowDgmTempState = { ...state.value };
        // workflowDgmTempState.isRemoveTaskTemplateCommandVisible = false;
        // workflowDgmTempState.selectedEdges = [];
        // workflowDgmTempState.selectedNodes = [];
        // workflowDgmTempState.selectedObject = appCtxService.ctx.xrtSummaryContextObject;
        // state.update && state.update( workflowDgmTempState );
        // Update the selection to root when removed and this will be done via URL update
        //Awp0WorkflowDesignerUtils.updateURL( { sc_uid: scUidToUpdate, source_uid: null, target_uid: null } );
        layoutService.applyGraphLayout( graphModel, true, false, data, state );
        eventBus.publish( 'awGraph.selectionChanged' );
    }
};

export default exports = {
    getRemoveNodeInput,
    removeGraphNodeEdges,
    getRemoveEdgeInput,
    removeGraphElements,
    getNodesToBeRemoved,
    getEdgesToBeRemoved
};
