// Copyright (c) 2022 Siemens

/**
 * This implements the method related to drawing the nodes on the graph
 *
 * @module js/Awp0WorkflowDesignerNodeService
 */
import appCtxSvc from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import graphTemplateService from 'js/Awp0WorkflowDesignerGraphTemplateService';
import layoutService from 'js/Awp0WorkflowDesignerLayoutService';
import awIconService from 'js/awIconService';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';
import declUtils from 'js/declUtils';
import graphStyleUtils from 'js/graphStyleUtils';
import workflowUtils from 'js/Awp0WorkflowUtils';
import iconSvc from 'js/iconService';


var exports = {};

var parentData = null;

/**
 * Populate the node info for input object and add to node list so that it can be rendered
 * on graph later.
 *
 * @param {Object} createdObject Object for whom node need to be created
 * @param {Array} nodeObjects Node objects array where created node obejct will be added
 */
var _populateNodeData = function( createdObject, nodeObjects ) {
    var nodeObject = {};
    nodeObject.metaObject = createdObject;
    nodeObject.name = createdObject.props.object_string.dbValues[ 0 ];
    nodeObject.nodeId = createdObject.uid;
    nodeObject.modelObject = createdObject;
    nodeObject.properties = {
        Group: createdObject.type,
        StyleTag: 'ObjectStyle',
        in_degree: 1,
        out_degree: 0
    };

    nodeObject.appData = {
        id: createdObject.uid,
        nodeObject: createdObject,
        isGroup: true,
        category: createdObject.type

    };
    nodeObject.itemType = 'Node';
    nodeObjects.push( nodeObject );
    return nodeObject;
};

/**
 * Create the start and finsih node that need to be shown on graph
 * @param {Obejct} object Selected tempalte object
 * @param {Array} nodeObjects Node object array where start and finsih node will be added
 * @param {Map} nodeDataMap Node data map to store start and finsih node info
 */
var _createStartFinishNode = function( object, nodeObjects, nodeDataMap ) {
    var startNode = null;
    var finishNode = null;

    // Keeping the sequence in thsi way only as when user create new template we need to show
    // start node first and then finish node. Changing the code sequence shows finish node first
    // and then start node.
    finishNode = _populateNodeData( object, nodeObjects );
    finishNode.nodeType = 'finish';
    finishNode.appData.nodeType = 'normal';
    finishNode.appData.isFinishNode = true;
    finishNode.nodeId = 'finish' + finishNode.nodeId;
    finishNode.properties.isGroupNode = false;
    finishNode.properties.isInteractiveTask = true;
    finishNode.properties.child_count = 0;
    nodeDataMap.finishNode = finishNode;

    startNode = _populateNodeData( object, nodeObjects );
    startNode.nodeType = 'start';
    startNode.appData.isStartNode = true;
    startNode.appData.nodeType = 'start';
    startNode.nodeId = 'start' + startNode.nodeId;
    startNode.properties.isGroupNode = false;
    startNode.properties.isInteractiveTask = true;
    startNode.properties.child_count = 0;
    nodeDataMap.startNode = startNode;
};

/**
 * Check for successors and predecessors properties on input object and if combined count > 4
 * then return true else return false.
 *
 * @param {Object} nodeObject EPMTask template obejct whose properties need to be checked
 * @return {boolean} -  true/false value
 */
var _isEdgeCountMore = function( nodeObject ) {
    // We need to check for the following values:
    // Number of successors and predecessors
    // If the combined number of successors and predecessors is greater than 4, or if there are
    // subtasks or subprocesses, then the node will not be rendered as a noninteractive node

    var successorPropObj = nodeObject.props.successors;
    var successorTasksCount = 0;
    if( typeof successorPropObj !== typeof undefined && typeof successorPropObj.dbValues !== typeof undefined ) {
        successorTasksCount = successorPropObj.dbValues.length;
    }

    var predecessorPropObj = nodeObject.props.predecessors;
    var predecessorTasksCount = 0;
    if( typeof predecessorPropObj !== typeof undefined &&
        typeof predecessorPropObj.dbValues !== typeof undefined ) {
        predecessorTasksCount = predecessorPropObj.dbValues.length;
    }

    if( predecessorTasksCount + successorTasksCount > 4 ) {
        return true;
    }
    return false;
};

/**
 * Check for input object has children or not and based on that return true or false
 *
 * @param {Object} nodeObject EPMTask template obejct whose properties need to be checked
 * @return {int} childrenCount  Children count if any children exist then children count else 0
 */
var _getChildrenCount = function( nodeObject ) {
    var childrenCount = 0;
    if( nodeObject && nodeObject.props && nodeObject.props.subtask_template &&
        nodeObject.props.subtask_template.dbValues ) {
        var count = nodeObject.props.subtask_template.dbValues.length;
        if( count > 0 ) {
            childrenCount = count;
        }
    }
    return childrenCount;
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Populate the node information for input selected template from SOA output data
 * and store it in manner as per cleint need.
 *
 * @param {Object} selectedTemplate Selected template for whom graph is being displayed
 * @param {Array} elementDataArray Element data array that will contain nodes info
 */
export let populateNodeData = function( selectedTemplate, elementDataArray, node ) {
    var nodeDataMap = [];
    var nodeObjects = [];
    _.forEach( elementDataArray, function( elementData ) {
        // If element data uid is equal to selected template uid then we need to create
        // start and finish nodes else populate normal node inf0
        if( ( node === undefined || node === null ) && elementData.element.uid === selectedTemplate.uid ) {
            _createStartFinishNode( selectedTemplate, nodeObjects, nodeDataMap );
        } else {
            if( !nodeDataMap[ elementData.element.uid ] || node && node.modelObject.uid !== elementData.element.uid ) {
                var nodeObject = cdmService.getObject( elementData.element.uid );
                //Get typeIconUrl for each task node
                if( nodeObject.type && ( isOfType( nodeObject, 'EPMTask' ) || isOfType( nodeObject, 'EPMTaskTemplate' ) ) ) {
                    nodeObject.typeIconURL = iconSvc.getTypeIconURL( nodeObject.type );
                }
                if( !node || nodeObject.uid !== node.modelObject.uid ) {
                    var subNode = _populateNodeData( nodeObject, nodeObjects );
                    subNode.appData.nodeType = 'normal';
                    var isInteractiveTask = true;
                    if( elementData.elementInfo.isInteractiveTask && elementData.elementInfo.isInteractiveTask[ 0 ] &&
                        elementData.elementInfo.isInteractiveTask[ 0 ] === 'false' ) {
                        isInteractiveTask = false;
                    }

                    // This need to be check when node is non interactive and edge coutn is more
                    // then only that node will be shown as interactive instead of non interactive
                    if( !isInteractiveTask && _isEdgeCountMore( nodeObject ) ) {
                        isInteractiveTask = true;
                    }
                    subNode.properties.isInteractiveTask = isInteractiveTask;
                    subNode.properties.isGroupNode = false;
                    var childCount = _getChildrenCount( nodeObject );
                    subNode.properties.child_count = childCount;
                    if( childCount > 0 ) {
                        subNode.properties.isGroupNode = true;
                    }
                    nodeDataMap[ nodeObject.uid ] = subNode;
                }
            }
        }
    } );
    return {
        nodeDataMap: nodeDataMap,
        nodeObjects: nodeObjects
    };
};

/**
 * Get the node in or out degree based on input node map.
 * @param {String} degreeDir Degree direction string that can be in degree or out degree
 * @param {Map} nodeInfoMap Node info map
 */
var getDegreeCount = function( degreeDir, nodeInfoMap ) {
    if( nodeInfoMap ) {
        var degree = nodeInfoMap[ degreeDir ];
        if( degree ) {
            return degree;
        }
        return 0;
    }
};

/**
 * Draw the input node on the graph
 *
 * @param {Object} nodeData Node data obejct that will stor enode info
 * @param {Object} graphModel Graph model object
 * @param {Object} graph Graph object to create the node
 * @param {Object} groupGraph Group graph object
 * @param {Object} activeLegendView Active legend view object to populat enode style info
 * @param {Object} data Data view model obejct
 */
// eslint-disable-next-line complexity
var _drawNodeObject = function( nodeData, graphModel, graph, groupGraph, activeLegendView, data, fixedLayoutMode, selTemplate ) {
    var isStartOrFinishNode = false;
    var nodeRect;
    var isGroup;

    if( fixedLayoutMode ) {
        var modelObject = nodeData.metaObject;
        var selTemplateUID = '';
        //Only draw the immediate subtasks, not their children
        var modelObjectParentTaskTemplateUID;
        if ( modelObject && modelObject.props && modelObject.props.parent_task_template && modelObject.props.parent_task_template.dbValues ) {
            modelObjectParentTaskTemplateUID = modelObject.props.parent_task_template.dbValues[0];
        }
        if ( selTemplate && selTemplate.uid ) {
            selTemplateUID = selTemplate.uid;
        }

        // This check is needed to check if nodes need to be drawn or not. like if we want to drae review task node then by default it will be collapsed
        // so we don't need to add SST and PS task node. Another check if user select review task from breadcrumb then we need to draw start and finish node as well.
        if ( modelObjectParentTaskTemplateUID !== '' && selTemplateUID !== '' && modelObjectParentTaskTemplateUID !== selTemplateUID && !nodeData.nodeType  ) {
            return;
        }
    }

    if( nodeData && ( nodeData.nodeType === 'start' || nodeData.nodeType === 'finish' ) ) {
        nodeRect = {
            width: 75,
            height: 100
        };
        isStartOrFinishNode = true;
    } else {
        var nodeWidth = 75;
        var nodeHeight = 100;
        var nodeName = nodeData.name;

        if( !nodeName && nodeData.metaObject && nodeData.metaObject.props && nodeData.metaObject.props.object_name.dbValues ) {
            nodeName = nodeData.metaObject.props.object_name.dbValues[ 0 ];
        }
        var widthAdj = 7 * nodeName.length;
        if( nodeName.length < 5 ) {
            widthAdj = 0;
        }
        nodeWidth += widthAdj;

        isGroup = nodeData.properties.isGroupNode;

        nodeRect = {
            width: nodeWidth,
            height: nodeHeight,
            x: 200,
            y: 200
        };
    }

    if( fixedLayoutMode ) {
        var locationX;
        var locationY;
        var scalingFactor = 1.9;

        // Check if node type to be draw is start or finish node then we need to reduce the node size
        if( modelObject.props && modelObject.props.location && isStartOrFinishNode ) {
            var locationPropValue = modelObject.props.location.dbValues[ 0 ];
            var locationPropArray = locationPropValue.split( ',' );
            if( nodeData.nodeType === 'start' ) {
                //get array elements 2 and three, corresponding to the hex x,y coordinates for the start node
                locationX = parseInt( locationPropArray[ 2 ], 16 );
                locationY = parseInt( locationPropArray[ 3 ], 16 );
                nodeRect.x = ( locationX + 100 ) * scalingFactor;
                nodeRect.y = ( locationY - 150 ) * scalingFactor;
            } else if( nodeData.nodeType === 'finish' ) {
                //get array elements 4 and 5, corresponding to the hex x,y coordinates for the finish node
                locationX = parseInt( locationPropArray[ 4 ], 16 );
                locationY = parseInt( locationPropArray[ 5 ], 16 );
                nodeRect.x = ( locationX + 100 ) * scalingFactor;
                nodeRect.y = ( locationY - 150 ) * scalingFactor;
            }
        } else {
            var location1 = modelObject.props.location1;
            var locationArray = location1.dbValues[ 0 ].split( ',' );
            locationX = parseInt( locationArray[ 0 ], 10 );
            locationY = parseInt( locationArray[ 1 ], 10 );
            nodeRect.x = ( locationX + 100 ) * scalingFactor;
            nodeRect.y = ( locationY - 150 ) * scalingFactor;
        }
    }

    var template;
    var bindData;

    var nodeCategory = nodeData.properties.Group;
    var nodeObject = nodeData.metaObject;
    isGroup = nodeData.properties.isGroupNode;
    var props = graphTemplateService.getBindPropertyNames( nodeObject, nodeData );
    var isInteractiveTask = nodeData.properties.isInteractiveTask;
    var childCount = 0;
    if( nodeData.properties && nodeData.properties.child_count ) {
        childCount = nodeData.properties.child_count;
    }

    template = graphTemplateService.getNodeTemplate( graphModel.nodeTemplates, props, isGroup, !isInteractiveTask, fixedLayoutMode );

    var outDegreeCount = getDegreeCount( 'out_degree', nodeData.properties );
    var inDegreeeCount = getDegreeCount( 'in_degree', nodeData.properties );

    // This is needed to provide custom tooptip for start and finish node
    // on the graph
    if( isStartOrFinishNode ) {
        if( nodeData.nodeType === 'start' ) {
            nodeData.nodeName = data.i18n.startTooltip;
        } else {
            nodeData.nodeName = data.i18n.finishTooltip;
        }
    }

    bindData = graphTemplateService.getBindProperties( nodeObject, props, nodeData );

    // For start and finish node name should not be editable from graph
    if( isStartOrFinishNode ) {
        bindData.Name_editable = false;
    }

    //get node style from graph legend
    var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );

    // Check if node stule is invalid then set with some default values
    if( !nodeStyle ) {
        // This is needed when node style is null then use the default node style. Right now
        // SST, PST and notify can't be created so for them use this default style.
        nodeStyle = {
            borderColor: 'rgb(85,160,185)',
            color: 'rgb(85,160,185)',
            priority: '1',
            shape: 'Tile'
        };
    }

    // Start and finsih node will not have node border color
    if( nodeStyle && isInteractiveTask ) {
        bindData.node_fill_color = nodeStyle.borderColor;
    }

    //fill node command binding data
    if( graphModel.nodeCommandBindData ) {
        graphModel.nodeCommandBindData.Awp0ToggleChildren_tooltip = data.i18n.showChildren;
        declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
    }
    var node = null;
    var nodeCreateCase = false;
    if( nodeData.node ) {
        node = nodeData.node;
        nodeCreateCase = true;
        nodeRect = graph.getBounds( node );

        nodeRect.width = nodeWidth;
        if ( !isGroup ) {
            nodeRect.height = 100;
        }
    } else {
        node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
    }

    node.initPosition = nodeRect;
    node.modelObject = nodeObject;
    node.appData = {
        id: nodeData.nodeId,
        nodeObject: nodeObject,
        isGroup: isGroup,
        category: nodeCategory,
        inDegrees: inDegreeeCount,
        outDegrees: outDegreeCount,
        childCount: childCount
    };
    node.itemType = 'Node';
    node.nodeId = nodeObject.uid;

    // This is needed to provide custom tooptip for start and finish node
    // on the graph
    if( isStartOrFinishNode ) {
        if( nodeData.nodeType === 'start' ) {
            node.appData.tooltipOfNode = data.i18n.startTooltip;
            node.appData.nodeType = 'start';
            node.nodeId = nodeData.nodeId;
        } else {
            node.appData.tooltipOfNode = data.i18n.finishTooltip;
            node.appData.nodeType = 'finish';
            node.nodeId = nodeData.nodeId;
        }
    }
    if( isGroup ) {
        node.setGroupingAllowed( true );
        groupGraph.setExpanded( node, false );
    }

    if( nodeCreateCase ) {
        graphModel.graphControl.graph.setNodeStyle( node, template, bindData );
        graphModel.graphControl.graph.updateNodeBinding( node, bindData );
        graphModel.graphControl.graph.updateOnItemsAdded( [ node ] );

        // Check if we are creating new node inside some parent node then
        // parent node add thos eparent node also in the affected node list
        // so that parent node child count can be updated
        var affectedNodeList = [];
        affectedNodeList.push( node );
        var parentNode = groupGraph.getParent( node );
        if( parentNode ) {
            affectedNodeList.push( parentNode );
        }
        exports.updateGraphInfoOnNodes( affectedNodeList, graphModel );
        graphModel.graphControl.layout.resizeNode( node, true );
        graph.setBounds( node, nodeRect );
    }

    //build node map to help create edges
    if( graphModel.nodeMap ) {
        graphModel.nodeMap[ nodeData.nodeId ] = node;
    }
};

/**
 * Draw the input nodes on the graph
 *
 * @param {Array} nodeObjects Node objects array that need to be shown on graph
 * @param {Object} graphModel Graph model object
 * @param {Object} graph Graph object to create the node
 * @param {Object} groupGraph Group graph object
 * @param {Object} activeLegendView Active legend view object to populat enode style info
 * @param {Object} data Data view model obejct
 */
export let drawNodes = function( nodeObjects, graphModel, graph, groupGraph, activeLegendView, data, selTemplate, state ) {
    parentData = data;
    var fixedLayoutMode = false;

    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.WRKFLW_use_fixed_position && appCtxSvc.ctx.preferences.WRKFLW_use_fixed_position[ 0 ] === 'true' ) {
        fixedLayoutMode = true;
    }

    if( state && state.diagram ) {
        fixedLayoutMode = !state.diagram.isAutoLayoutOn;
    } else {
        fixedLayoutMode = false;
    }

    _.forEach( nodeObjects, function( nodeData ) {
        _drawNodeObject( nodeData, graphModel, graph, groupGraph, activeLegendView, data, fixedLayoutMode, selTemplate );
    } );
};

/**
 *update GC when node resized due to word wrap or manually resized
 *
 * @param {array} resizedNodes graph items
 * @param {object} graphControl instance of graph control
 */
var resizeElements = function( resizedNodes, graphControl ) {
    if( resizedNodes && resizedNodes.length > 0 ) {
        var layout = graphControl.layout;
        if( layout && layout.isActive() ) {
            layout.applyUpdate( function() {
                _.forEach( resizedNodes, function( item ) {
                    var node;
                    if( item.node ) {
                        node = item.node;
                    } else {
                        node = item;
                    }
                    if( node && node.getItemType() === 'Node' ) {
                        layout.resizeNode( node, true );
                    }
                } );
            } );
        } else {
            var groupGraph = graphControl.groupGraph;
            var graph = graphControl.graph;
            _.forEach( resizedNodes, function( item ) {
                var node;
                if( item.node ) {
                    node = item.node;
                } else {
                    node = item;
                }
                if( node && groupGraph.isGroup( node ) && ( graph.isNetworkMode() || !groupGraph.isExpanded( node ) ) ) {
                    graphControl.updateHeaderHeight( node, node.getHeight() );
                }
            } );
        }
    }
};

/**
 *update the size of the node based on the wrapped text height
 *
 * @param {object} graphModel graph model
 * @param {array} nodes array of nodes being added in graph
 */
export let setNodeHeightOnWrappedHeightChanged = function( graphModel, nodes ) {
    resizeElements( nodes, graphModel.graphControl );
};

/*
 * converts normal node to Parent Node
 * @param {Object} graphModel graph model
 * @param {Object} selectedNode selected Node object
 */
export let convertNodeToParent = function( graphModel, selectedNode ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var nodeObject = selectedNode.modelObject;
    var nodeRect = graph.getBounds( selectedNode );
    // check if the single selected node is Group node and its valid node
    if( groupGraph && groupGraph.isGroup( selectedNode ) && selectedNode.modelObject ) {
        if( !groupGraph.isExpanded( selectedNode ) ) {
            nodeRect.height *= 2;
            graph.setBounds( selectedNode, nodeRect );
        }
        return;
    }
    if( graphModel && nodeObject ) {
        //update normal node to group node
        var props = graphTemplateService.getBindPropertyNames( nodeObject );
        var nodeTemplate = graphTemplateService.getNodeTemplate( graphModel.nodeTemplates, props, true, false );
        if( !nodeTemplate ) {
            return;
        }
        var bindData = {
            HEADER_HEIGHT: nodeRect.height
        };

        graph.setNodeStyle( selectedNode, nodeTemplate, bindData );
        groupGraph.setAsGroup( selectedNode );
        nodeRect.height *= 2;
        graph.setBounds( selectedNode, nodeRect );
        graphControl.layout.convertToGroup( selectedNode );
    }
};

/**
 * Update the node cell properties if it's changed
 * @param {Object} nodesToUpdate nodes
 * @param {Object} graphModel graph Model
 * @param {Object} data data object
 */
export let updateNodeProperties = function( nodesToUpdate, graphModel, data ) {
    var updateNodes = {};
    var graphControl = graphModel.graphControl;

    var activeLegendView = null;
    var graphContext = appCtxSvc.getCtx( 'graph' );
    if( graphContext && graphContext.legendState ) {
        activeLegendView = graphContext.legendState.activeView;
    }

    _.forEach( nodesToUpdate, function( node ) {
        var modelObject = node.modelObject;
        var props = graphTemplateService.getBindPropertyNames( modelObject );
        var objectBindData = graphTemplateService.getBindProperties( modelObject, props, data );
        var properties = {};
        _.forEach( props, function( prop ) {
            var bindData = node.getAppObj();
            var bindValue = bindData[ prop ];
            if( bindValue && objectBindData[ prop ] !== bindValue ) {
                properties[ prop ] = objectBindData[ prop ];
            }
        } );

        //get node style from graph legend
        var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', modelObject.type, activeLegendView );

        // Check if node stule is invalid then set with some default values
        if( !nodeStyle ) {
            // This is needed when node style is null then use the default node style. Right now
            // SST, PST and notify can't be created so for them use this default style.
            nodeStyle = {
                borderColor: 'rgb(85,160,185)',
                color: 'rgb(85,160,185)',
                priority: '1',
                shape: 'Tile'
            };
        }

        // Start and finsih node will not have node border color and icon
        if( nodeStyle && node.appData && node.appData.nodeType !== 'start' && node.appData.nodeType !== 'finish' ) {
            properties.node_fill_color = nodeStyle.borderColor;

            // This is needed if we want to show updated icon
            var imageUrl = awIconService.getThumbnailFileUrl( modelObject );
            //show type icon instead if thumbnail doesn't exist
            if( !imageUrl ) {
                imageUrl = workflowUtils.getTaskFlowBasedIcon( modelObject );
            }
            properties.thumbnail_image = graphStyleUtils.getSVGImageTag( imageUrl );
        }

        if( Object.keys( properties ).length > 0 ) {
            updateNodes[ node.modelObject.uid ] = properties;
        }
    } );

    if( Object.keys( updateNodes ).length > 0 ) {
        graphControl.graph.update( function() {
            _.forEach( updateNodes, function( value, key ) {
                var node = graphModel.nodeMap[ key ];
                graphControl.graph.updateNodeBinding( node, value );
            } );
        } );
    }
};

/**
 * Update the input bindData based on child updation so that parent node
 * count can be updated
 * @param {Object} node Node object whose information need to be updated
 * @param {Object} bindData Updated proeprty values
 */
var updateChildCountOnNode = function( node, bindData ) {
    // Check if node is valid and it's child load is not needed then only
    // go inside the loop. In case of review or route task creation it will go
    // inside this loop.
    if( node && node.modelObject && !node.isChildrenLoadNeeded ) {
        var modelObject = cdmService.getObject( node.modelObject.uid );
        var childCount = _getChildrenCount( modelObject );
        bindData.child_count = childCount;
        bindData.children_full_loaded = false;
        node.appData.childCount = childCount;
        if( childCount > 0 ) {
            node.appData.childCount = childCount;
            bindData.Awp0ToggleChildren_selected = false;
            bindData.child_count = '';
            bindData.children_full_loaded = true;
            bindData.image_show_subprocess = graphTemplateService.getShowChildrenSVGImage();
            if( parentData ) {
                bindData.Awp0ToggleChildren_tooltip = parentData.i18n.hideChildren;
            }
        }
    }
};

/**
 * Update given nodes for in/out and parent/child degree
 *
 * @param {List} affectedNodeList affected node list
 * @param {Object} graphModel graph model
 * @param {boolean} isRemoveCase True/False based on remove case
 */
export let updateGraphInfoOnNodes = function( affectedNodeList, graphModel, isRemoveCase ) {
    _.forOwn( affectedNodeList, function( node ) {
        var bindData = {};
        // Update the child count based on child addition or removal
        updateChildCountOnNode( node, bindData );

        //update the bindings
        graphModel.graphControl.graph.updateNodeBinding( node, bindData );

        if( isRemoveCase ) {
            // Check if node has only one parent then set the parent as normal node instead of group node
            exports.convertParentNodeToNormalNode( graphModel, node );
        }
    } );
};

/*
 * converts normal node to Parent Node
 * @param {Object} graphModel graph model
 * @param {Object} selectedNode selected Node object
 */
export let convertParentNodeToNormalNode = function( graphModel, node ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    // Check if it has no children and add to nodes to convert to normal node.
    var children = groupGraph.getChildNodes( node );
    if( !children || children.length === 0 ) {
        var nodeObject = node.modelObject;
        if( graphModel && nodeObject ) {
            //update group node to normal node
            var props = graphTemplateService.getBindPropertyNames( nodeObject );
            var nodeStyle = graphTemplateService.getNodeTemplate( graphModel.nodeTemplates,
                props, false, false );
            var bindData = {
                HEADER_HEIGHT: 0
            };
            graph.setNodeStyle( node, nodeStyle, bindData );
            groupGraph.setExpanded( node, false );
            groupGraph.setAsLeaf( node );
            // This is needed to set the correct node width and height when user removes the children
            // and parent node need to be converted to naormal node as no chilren presnet now.
            if( node && node.initPosition && node.initPosition.width &&  node.initPosition.height ) {
                var nodeRect = {
                    width : node.initPosition.width,
                    height: node.initPosition.height
                };
                graph.setBounds( node, nodeRect );
            } else {
                graph.setBounds( node, node.getResizeMinimumSize() );
            }
            layoutService.addNodeToBecomeNormal( node );
        }
    }
};

export default exports = {
    populateNodeData,
    drawNodes,
    setNodeHeightOnWrappedHeightChanged,
    convertNodeToParent,
    updateNodeProperties,
    updateGraphInfoOnNodes,
    convertParentNodeToNormalNode
};
