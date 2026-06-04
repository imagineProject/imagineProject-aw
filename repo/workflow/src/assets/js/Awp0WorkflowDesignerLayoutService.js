// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowDesignerLayoutService
 */
import _ from 'lodash';

var exports = {};

var _nodesToAddWithPosition = [];
var _nodesToAdd = [];
var _edgesToAdd = [];
var _nodesToRemove = [];
var _edgesToRemove = [];
var _groupNodesToExpand = [];
var _groupNodesToCollapse = [];
var _nodesToBecomeGroup = [];
var _nodesToBecomeNormal = [];

/**
 * Layout each graph item list
 *
 * @param {Object} graphModel the graph model object
 * @param {Object} layout the layout model object
 */
var procesGraphItemLists = function( graphModel, layout ) {
    if( !graphModel || !layout ) {
        return;
    }

    layout.applyUpdate( function() {
        // First process removed item lists
        _.forEach( _nodesToRemove, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.removeNode( node, true );
            }
        } );
        _.forEach( _edgesToRemove, function( edge ) {
            layout.removeEdge( edge );
        } );

        // Now process added and updated item lists
        _.forEach( _nodesToBecomeGroup, function( node ) {
            layout.convertToGroup( node );
        } );

        _.forEach( _nodesToAddWithPosition, function( node ) {
            if( !layout.containsNode( node ) ) {
                layout.addNode( node, true );
            }
        } );

        _.forEach( _nodesToAdd, function( node ) {
            if( !layout.containsNode( node ) ) {
                layout.addNode( node, false );
            }
        } );

        _.forEach( _edgesToAdd, function( edge ) {
            if( !layout.containsEdge( edge ) ) {
                layout.addEdge( edge );
            }
        } );

        _.forEach( _groupNodesToExpand, function( node ) {
            layout.expandGroupNode( node );
            layout.fitGroupNode( node );
        } );

        _.forEach( _nodesToBecomeNormal, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.convertGroupNodeToNode( node );
            }
        } );
        _.forEach( _groupNodesToCollapse, function( node ) {
            // Check if node is in layout
            if( layout.containsNode( node ) ) {
                layout.collapseGroupNode( node );
            }
        } );
    } );
};

/**
 * Apply layout to graph
 *
 * @param {Object} graphModel the graph model object
 * @param {Boolean} isKeepPosition the flag to keep graph items position or not.
 * @param {Boolean} isRecallCase the flag to indicate if this is recall case or not.
 * @param {Boolean} isApplyGlobalLayout the flag to apply global layout or not.
 */
export let applyGraphLayout = function( graphModel, isKeepPosition, isApplyGlobalLayout, data, state ) {
    //the layout is initialized by GC by default, it's directly available
    var layout = graphModel.graphControl.layout;
    var keepPosition = isKeepPosition;

    if( !layout ) {
        return;
    }

    // If we are in fixed layout then we don't need to apply layout so clear updated graph item list
    if( state && state.diagram && !state.diagram.isAutoLayoutOn ) {
        exports.clearGraphItemLists();
        return;
    }

    if( isApplyGlobalLayout ) {
        //need apply global layout first for incremental update
        layout.applyLayout();
        keepPosition = false;
        layout.activate( keepPosition );
    } else {
        // activate method does nothing if layout is active. So we can call activate method directly.
        layout.activate( keepPosition );
        procesGraphItemLists( graphModel, layout );
    }
    exports.clearGraphItemLists();
};


/**
 * Clear all graph items list
 */
export let clearGraphItemLists = function() {
    _nodesToAddWithPosition = [];
    _nodesToAdd = [];
    _groupNodesToExpand = [];
    _nodesToBecomeGroup = [];
    _edgesToAdd = [];
    _nodesToRemove = [];
    _edgesToRemove = [];
    _nodesToBecomeNormal = [];
    _groupNodesToCollapse = [];
};

export let setLayoutType = function( data, layoutCommandId, layoutOption, layoutString ) {
    data.layoutCommandId = layoutCommandId;
    data.layoutOption = layoutOption;
    data.layoutString = layoutString;
};

/**
 * Add node to the list of nodes to be added to layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBeAdded = function( node ) {
    if( _.indexOf( _nodesToAdd, node ) === -1 ) {
        _nodesToAdd.push( node );
    }
};

/**
 * Add node to the list of nodes to be added to layout with position
 * @param {Object} node the node to add to list
 */
export let addNodeToBeAddedWithPosition = function( node ) {
    if( _.indexOf( _nodesToAddWithPosition, node ) === -1 ) {
        _nodesToAddWithPosition.push( node );
    }
};

/**
 * Remove node from the list of nodes to be added to layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBeAdded = function( node ) {
    _.pull( _nodesToAdd, node );
};

/**
 * Add groupNode to the list of groupNodes to be expanded in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupNodeToExpand = function( groupNode ) {
    if( _.indexOf( _groupNodesToExpand, groupNode ) === -1 ) {
        _groupNodesToExpand.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to be expanded in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeGroupNodeToExpand = function( groupNode ) {
    _.pull( _groupNodesToExpand, groupNode );
};

/**
 * Add groupNode to the list of groupNodes to collapse in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addGroupNodesToCollapse = function( groupNode ) {
    if( _.indexOf( _groupNodesToCollapse, groupNode ) === -1 ) {
        _groupNodesToCollapse.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to collapse in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeGroupNodesToCollapse = function( groupNode ) {
    _.pull( _groupNodesToCollapse, groupNode );
};

/**
 * Add node to the list of nodes to become groupNode in layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBecomeGroup = function( node ) {
    if( _.indexOf( _nodesToBecomeGroup, node ) === -1 ) {
        _nodesToBecomeGroup.push( node );
    }
};

/**
 * Remove node from the list of nodes to become groupNode in layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBecomeGroup = function( node ) {
    _.pull( _nodesToBecomeGroup, node );
};

/**
 * Add edge to the list of edges to be added in layout
 * @param {Object} edge the edge to add to list
 */
export let addEdgeToBeAdded = function( edge ) {
    if( _.indexOf( _edgesToAdd, edge ) === -1 ) {
        _edgesToAdd.push( edge );
    }
};

/**
 * Remove edge from the list of edges to be added in layout
 * @param {Object} edge the edge to remove from list
 */
export let removeEdgeToBeAdded = function( edge ) {
    _.pull( _edgesToAdd, edge );
};

/**
 * Add node to the list of nodes to be removed from layout
 * @param {Object} node the node to add to list
 */
export let addNodeToBeRemoved = function( node ) {
    if( _.indexOf( _nodesToRemove, node ) === -1 ) {
        _nodesToRemove.push( node );
    }
};

/**
 * Remove node from the list of nodes to be removed from layout
 * @param {Object} node the node to remove from list
 */
export let removeNodeToBeRemoved = function( node ) {
    _.pull( _nodesToRemove, node );
};

/**
 * Add edge to the list of edges to be removed from layout
 * @param {Object} edges edges to add to list
 */
export let addEdgeToBeRemoved = function( edges ) {
    _.forEach( edges, function( edge ) {
        if( _.indexOf( _edgesToRemove, edge ) === -1 ) {
            _edgesToRemove.push( edge );
        }
    } );
};

/**
 * Remove edge from the list of edges to be removed from layout
 * @param {Object} edge the edge to remove from list
 */
export let removeEdgeToBeRemoved = function( edge ) {
    _.pull( _edgesToRemove, edge );
};

/**
 * Add groupNode to the list of groupNodes to become normalNode in layout
 * @param {Object} groupNode the groupNode to add to list
 */
export let addNodeToBecomeNormal = function( groupNode ) {
    if( _.indexOf( _nodesToBecomeNormal, groupNode ) === -1 ) {
        _nodesToBecomeNormal.push( groupNode );
    }
};

/**
 * Remove groupNode from the list of groupNodes to become normalNode in layout
 * @param {Object} groupNode the groupNode to remove from list
 */
export let removeNodeToBecomeNormal = function( groupNode ) {
    _.pull( _nodesToBecomeNormal, groupNode );
};

export default exports = {
    applyGraphLayout,
    clearGraphItemLists,
    setLayoutType,
    addNodeToBeAdded,
    addNodeToBeAddedWithPosition,
    removeNodeToBeAdded,
    addGroupNodeToExpand,
    removeGroupNodeToExpand,
    addGroupNodesToCollapse,
    removeGroupNodesToCollapse,
    addNodeToBecomeGroup,
    removeNodeToBecomeGroup,
    addEdgeToBeAdded,
    removeEdgeToBeAdded,
    addNodeToBeRemoved,
    removeNodeToBeRemoved,
    addEdgeToBeRemoved,
    removeEdgeToBeRemoved,
    addNodeToBecomeNormal,
    removeNodeToBecomeNormal
};
