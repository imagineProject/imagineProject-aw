// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0WorkflowService
 */
import declUtils from 'js/declUtils';
import templateService from 'js/Awp0WorkflowTemplateService';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';
import policySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import adapterSvc from 'js/adapterService';
import graphService from 'js/awGraphService';
import workflowGraphStyles from 'js/Awp0WorkflowGraphStyles';
import ctxService from 'js/appCtxService';
import workflowLegendSvc from 'js/Awp0WorkflowViewerGraphLegendManager';
import workflowGraphService from 'js/Awp0WorkflowViewerGraphService';
import workflowUtils from 'js/Awp0WorkflowUtils';
import AwStateService from 'js/awStateService';
import ssoAuthenticator from 'js/ssoAuthenticator';
import eventBus from 'js/eventBus';
import commandPanelService from 'js/commandPanel.service';
import iconSvc from 'js/iconService';

var MIN_NODE_SIZE = [ 50, 50 ];

var exports = {};

var incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

var layoutActive = function( layout ) {
    return incUpdateActive( layout );
};

var isExceptionNode = function( nodeObject ) {
    // - Presence of subtasks
    // - Presence of subprocesses
    var childTasksPropObj = nodeObject.props.child_tasks;
    if( typeof childTasksPropObj !== typeof undefined &&
        typeof childTasksPropObj.dbValues !== typeof undefined && childTasksPropObj.dbValues[ 0 ] ) {
        return true;
    }

    var subprocessPropObj = nodeObject.props.sub_processes_states;
    if( typeof subprocessPropObj !== typeof undefined &&
        typeof subprocessPropObj.dbValues !== typeof undefined && subprocessPropObj.dbValues[ 0 ] ) {
        return true;
    }
    return false;
};
var isEdgeCountMore = function( nodeObject ) {
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

var hasSubProcess = function( nodeObject ) {
    var subprocessPropObj = nodeObject.props.sub_processes_states;
    if( typeof subprocessPropObj !== typeof undefined &&
        typeof subprocessPropObj.dbValues !== typeof undefined && subprocessPropObj.dbValues[ 0 ] ) {
        return true;
    }

    return false;
};

/**
 * Get the start node location value that need to be used to show the start node
 * at specific position.
 *
 * @param {Object} nodeObject Start node object
 * @param {Array} taskPosition Current start node position value
 *
 * @returns {Object} start node location proeprty value
 */
var _getStartNodePosition = function( nodeObject, taskPosition ) {
    // Check if tc version is tc12.4 or more then use the input task position for start node as it has the correct
    // index in platform code that returns the correct value and on older release it's incorrect so for older release
    // getting it from template object
    return taskPosition;
};

/**
 * Return the true or false based on auto layout is on or off.
 * @param {Object} data Data view model object
 * @returns {boolean} True or False
 */
var _isFixedLayoutMode = function( data ) {
    if( data && data.workflowViewerContext && data.workflowViewerContext.diagram ) {
        return !data.workflowViewerContext.diagram.isAutoLayoutOn;
    }
    return false;
};

/**
 * Get the node position
 * @param {Object} data Data view model object
 * @param {Object} nodeObject Node obejct whose postion need to be fetched
 * @param {boolean} isStartFinishNode True or false value
 * @param {String} nodeType Node type string value
 * @param {int} nodeHeight height of interactive nodes and start/finish nodes
 * @param {int} nonInteractiveNodeHeight height of non-interactive nodes symbol
 * @param {int} nonInteractiveNodeWidth width of non-interactive nodes symbol
 *
 * @returns {Object} Node positions
 */
var _getNodeXYCoordinates = function( data, nodeObject, isStartFinishNode, nodeType, nodeHeight, nonInteractiveNodeHeight, nonInteractiveNodeWidth ) {
    var locationX;
    var locationY;
    var nodeXPosition = 200;
    var nodeYPosition = 200;
    var originalNonInteractiveNodeWidth;

    var isFixedLayout = _isFixedLayoutMode( data );
    // Check if we are in autolayout then we don't need to return the node positions and automatic
    // positions will be used.
    if( !isFixedLayout ) {
        return {
            nodeXPosition: nodeXPosition,
            nodeYPosition : nodeYPosition
        };
    }

    var scalingFactor = 1.9;
    var locationPropName = 'location';
    if( isStartFinishNode && nodeType === 'start' && nodeObject.props.start_node_location ) {
        locationPropName = 'start_node_location';
    } else if( isStartFinishNode && nodeType === 'finish' && nodeObject.props.complete_node_location ) {
        locationPropName = 'complete_node_location';
    }
    // Get the node location value for specific property and then parse the correct value and return the node positions
    if( nodeObject && nodeObject.props && nodeObject.props[ locationPropName ] && nodeObject.props[ locationPropName ].dbValues ) {
        var location = nodeObject.props[ locationPropName ].dbValues;

        var interactiveNode = true;

        // Checks if node is non-interactive
        if ( isStartFinishNode && nodeType === false && locationPropName === 'location' ) {
            interactiveNode = false;
        }
        if( locationPropName === 'start_node_location' ) {
            location = _getStartNodePosition( nodeObject, location );
        }
        if( location && location[ 0 ] ) {
            var locationArray = location[ 0 ].split( ',' );
            locationX = parseInt( locationArray[ 0 ], 10 );
            locationY = parseInt( locationArray[ 1 ], 10 );
            nodeXPosition = ( locationX + 100 ) * scalingFactor;
            nodeYPosition = ( locationY - 150 ) * scalingFactor;
        }
        // Makes the x and y positions correct for the smaller non-interactive icons and now they are now centered
        // compared to where they were placed when created.
        if( interactiveNode === false ) {
            var nodeName = nodeObject.props.object_name.dbValues[ 0 ];
            // The if statement calculates the width of the node based on the name.
            originalNonInteractiveNodeWidth = 75;
            if ( nodeName.length >= 5 ) {
                originalNonInteractiveNodeWidth += nodeName.length * 7;
            }
            // The non-interactive nodes just show their symbol in the workflow viewer and get placed with cordinates
            // based off of the cordinates when the node was full size and not just the symbol.
            nodeYPosition += nodeHeight / 2 - nonInteractiveNodeHeight / 2;
            nodeXPosition += originalNonInteractiveNodeWidth / 2 - nonInteractiveNodeWidth / 2;
        }
    }

    return  {
        nodeXPosition: nodeXPosition,
        nodeYPosition : nodeYPosition
    };
};

/**
 * Get the node rectanlge and return
 * @param {Object} data Data view model object
 * @param {Object} nodeObject Node obejct whose postion need to be fetched
 * @param {boolean} isStartFinishNode True or false value
 * @param {boolean} isGroup True or false value based on node is group node or not
 * @param {String} nodeType Node type string value
 * @param {Object} bindData Bind data that will contain all properties to be shown on node
 *
 * @returns {Object} Node positions rectangle
 */
var _getNodeRectObject = function( data, nodeObject, isStartFinishNode, isGroup, nodeType, bindData ) {
    var nodeRect = {
        width: 50,
        height: 50
    };
    var nodeWidth = 75;
    var nodeHeight = 100;
    var nodeName = '';
    // Check if input bind data is not null and job name present on bind data
    // then use job name to calculate the node width else use the object name
    if( !nodeType && bindData && bindData.job_name ) {
        nodeName = bindData.job_name;
    } else if( nodeObject && nodeObject.props.object_name.dbValues ) {
        nodeName = nodeObject.props.object_name.dbValues[ 0 ];
    }

    var nodeCoordinates = _getNodeXYCoordinates( data, nodeObject, isStartFinishNode, nodeType, nodeHeight, nodeRect.height, nodeRect.width );
    // Check if node is start or finish node and it's not group node or node type is finish
    // where start node can be group node but finish node can't be group node so just calculate
    // the node width for group start node or all other nodes.
    if( isStartFinishNode && ( !isGroup || nodeType === 'finish' ) ) {
        if( nodeType === 'finish' || nodeType === 'start' ) {
            nodeRect.width = 75;
            nodeRect.height = 100;
        }
        nodeRect.x = nodeCoordinates.nodeXPosition;
        nodeRect.y = nodeCoordinates.nodeYPosition;
        return nodeRect;
    }
    nodeRect.x = nodeCoordinates.nodeXPosition;
    nodeRect.y = nodeCoordinates.nodeYPosition;

    if( isStartFinishNode && ( isGroup && nodeType === 'start' ) ) {
        nodeRect.width = 125;
        nodeRect.height = nodeHeight;
        return nodeRect;
    }

    var widthAdj = 7 * nodeName.length;
    if( nodeName.length < 5 ) {
        widthAdj = 0;
    }
    nodeWidth += widthAdj;
    nodeRect.width = nodeWidth;
    nodeRect.height = nodeHeight;
    return nodeRect;
};

var getStartFinishNode = function( data, nodeObj, graph, graphModel, nodeType, tooltip, stateValue, activeLegendView, rootTaskObject ) {
    var isStartNode = true;
    var props = templateService.getBindPropertyNames( nodeObj, null, rootTaskObject );
    var isFixedLayout = _isFixedLayoutMode( data );
    var bindData = templateService.getBindProperties( isFixedLayout, rootTaskObject, nodeObj, props, nodeType );
    var isGroup = hasSubProcess( nodeObj );
    var nodeCategory = 'EPM_completed';
    var template = null;
    var nodeRect = {
        width: 50,
        height: 50
    };
    // Get the node rectangle that will be used for node size
    nodeRect = _getNodeRectObject( data, nodeObj, true, isGroup, nodeType, bindData );
    if( isGroup && nodeType === 'start' ) {
        template = templateService.getNodeTemplate( isFixedLayout, graphModel.nodeTemplates, props, isGroup );
        if( stateValue === '32' ) {
            nodeCategory = 'EPM_aborted';
        }
        var legendStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );
        bindData.node_fill_color = legendStyle.borderColor;
        bindData.job_name = tooltip;
        bindData.task_state_style_svg = 'hidden';
        bindData.open_process = '';
    } else {
        // Check if node type is start or finish then we need to show it as normal node
        // similar to workflow designer to handle that case where we can create more than 4 connection from
        // less prominetn node to other node.
        if( nodeType === 'start' || nodeType === 'finish' ) {
            isStartNode = false;
            bindData.job_name = tooltip;
            nodeCategory = workflowUtils.getStartFinishNodeCategory( nodeType, stateValue );
            var legendStyle1 = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );
            bindData.node_fill_color = legendStyle1.borderColor;
        }
        template = templateService.getNodeTemplate( isFixedLayout, graphModel.nodeTemplates, props, isGroup, isStartNode );
    }
    var node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
    if( isGroup ) {
        node.setGroupingAllowed( true );
        graphModel.graphControl.groupGraph.setExpanded( node, false );
        graph.setBounds( node, nodeRect );
    }
    node.appData = {
        nodeObject: nodeObj,
        tooltipOfNode: tooltip,
        isGroup: isGroup,
        isStartFinishNode: nodeType,
        isFixedLayout : isFixedLayout
    };
    return node;
};

var applyGraphLayout = function( graphModel, data ) {
    var isFixedLayout = _isFixedLayoutMode( data );
    // If we are in fixed layout then no need to apply the layout
    if( isFixedLayout ) {
        return;
    }
    //the layout is initialized by GC by default, it's directly available
    var layout = graphModel.graphControl.layout;
    if( layout ) {
        //need apply global layout first for incremental update
        layout.applyLayout();
        layout.activate( false );
    }
};

/**
 * Sets the node height and group node header height based on the wrapped text height
 * @param {Object} graphModel Graph model object
 * @param {Array} nodes Nodes obejct array for height changed happens.
 */
export let setNodeHeightOnWrappedHeightChanged = function( graphModel, nodes ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var layout = graphControl.layout;

    var sizeChangedNodes = [];
    _.forEach( nodes, function( nodeTextInfo ) {
        var currentWrappedHeight = nodeTextInfo.currentWrappedHeight;
        var node = nodeTextInfo.node;

        if( currentWrappedHeight ) {
            var currentHeight = node.getHeight();
            var padding = 60;
            var layoutHeight = currentWrappedHeight + padding;
            var newHeight = layoutHeight;

            var isResize = false;
            if( groupGraph.isGroup( node ) ) {
                if( groupGraph.isExpanded( node ) ) {
                    var offset = graphControl.updateHeaderHeight( node, newHeight );
                    newHeight = currentHeight + offset;
                    if( newHeight !== currentHeight ) {
                        isResize = true;
                    }
                } else if( newHeight > currentHeight || newHeight !== currentHeight &&
                    graphModel.config.enableEdit ) {
                    isResize = true;
                    graphControl.updateHeaderHeight( node, newHeight );
                }
            } else {
                if( newHeight > currentHeight ) {
                    isResize = true;
                }
            }

            if( isResize ) {
                graph.update( function() {
                    node.setHeight( newHeight );
                } );

                sizeChangedNodes.push( node );
            }
        }
    } );

    if( layoutActive( layout ) && sizeChangedNodes.length > 0 ) {
        layout.applyUpdate( function() {
            _.forEach( sizeChangedNodes, function( sizeChangedNode ) {
                layout.resizeNode( sizeChangedNode, true );
            } );
        } );
    }
};

/**
 * Return the applied layout option on the diagram. If no layout applied then by
 * default it will return 'GcLeftToRightLayout' layout option.
 * @param {Object} data Data view model object
 * @returns {String} Default layout string.
 */
var _getAppliedLayoutOption = function( data ) {
    if( data.workflowViewerContext && data.workflowViewerContext.diagram && data.workflowViewerContext.diagram.layoutOption ) {
        return data.workflowViewerContext.diagram.layoutOption;
    }
    return 'GcLeftToRightLayout';
};

/**
 * Create all edges that need to be shown on the graph and return thos edges.
 *
 * @param {Object} data Data view model obejct
 * @param {Array} edgeDataArray Edge data array that will contain all edge information that need to be shown
 * @param {Object} startNode Start node object
 * @param {Object} finishNode Finish node object
 * @param {Object} graphModel Graph model object
 * @param {Object} activeLegendView Active legend view object to populate node style info
 *
 * @return {Array} addedEdges All actual edge objects
 */
var _drawEdges = function( data, edgeDataArray, startNode, finishNode, graphModel, activeLegendView ) {
    var addedEdges = [];
    if( !edgeDataArray || edgeDataArray.length <= 0 || !graphModel ) {
        return addedEdges;
    }
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var rootTaskObject = graphModel.rootTaskObject;

    var edgeStyles = workflowGraphStyles.parseGraphStyleXML( data.legend.presentationStylesXML );


    _.forEach( edgeDataArray, function( edgeData ) {
        var sourceNode;
        var targetNode;

        sourceNode = graphModel.nodeMap[ edgeData.end1Element.uid ];
        targetNode = graphModel.nodeMap[ edgeData.end2Element.uid ];
        if( typeof rootTaskObject !== typeof undefined ) {
            if( edgeData.end1Element.uid === rootTaskObject.uid ) {
                sourceNode = startNode;
            }
            if( edgeData.end2Element.uid === rootTaskObject.uid ) {
                targetNode = finishNode;
            }
        }

        var edge;
        var edgeCategory = edgeData.edgeInfo.edgeType[ 0 ];

        // Check if edge category is structure and there are multiple nodes as target nodes
        // that can happen only in case of sub process where duplicate sub process need to be
        // rendered on UI inside the parent node correctly.
        if( edgeCategory === 'Structure' && _.isArray( targetNode ) ) {
            var multiTargetNodes = targetNode;
            // Set the target node as first node. This is mainly to handle any unknown issue
            targetNode = targetNode[0];

            // Iterate for all target node and then check for each node if any node
            // has parent node already set then don't use that node to create structure
            // relation. If parent is not set then use that node and create the structure relation
            // and break the loop.
            for( var idx1 = 0; idx1 < multiTargetNodes.length; idx1++ ) {
                var node = multiTargetNodes[ idx1 ];
                var parent = groupGraph.getParent( node );
                if( !parent ) {
                    targetNode = node;
                    break;
                }
            }
        }
        edgeData.relationType = edgeCategory;
        var isFailPath = false;
        //get edge style from graph legend
        var legendEdgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory,
            activeLegendView );
        var edgeStyleObject = null;
        if( legendEdgeStyle && ( edgeCategory === 'FailSuccessor' || edgeCategory === 'PendingFailSuccessor' ) ) {
            edgeStyleObject = edgeStyles.FailSuccessorStyle;
            isFailPath = true;
        } else if( legendEdgeStyle && ( edgeCategory === 'CompleteSuccessor' || edgeCategory === 'PendingCompleteSuccessor' ) ) {
            edgeStyleObject = edgeStyles.CompleteSuccessorStyle;
        }
        // Get the correct edge category style from all edge styles and then set the correct style on edge.
        if( edgeStyles[ edgeCategory ] ) {
            edgeStyleObject = edgeStyles[ edgeCategory ];
        }
        if( edgeStyleObject ) {
            if( isFailPath ) {
                legendEdgeStyle.dashStyle = edgeStyleObject.dashStyle;
            }
            legendEdgeStyle.targetArrow = edgeStyleObject.targetArrow;
            legendEdgeStyle.thickness = edgeStyleObject.thickness;
            legendEdgeStyle.targetArrow.fillInterior = true;
        }

        if( sourceNode && targetNode ) {
            if( edgeCategory === 'Structure' ) {
                groupGraph.setAsGroup( sourceNode );

                groupGraph.setParent( sourceNode, [ targetNode ] );

                //the group node is in group display by default, it can be switched to network display
                sourceNode.isNestedDisplay = true;
            } else {
                edge = graph.createEdgeWithNodesStyleAndTag( sourceNode, targetNode, legendEdgeStyle, null );
            }
        }

        if( edge ) {
            if( typeof edgeData.edgeInfo.edgeName !== typeof undefined ) {
                graph.setLabel( edge, edgeData.edgeInfo.edgeName[ 0 ] );
                edge.category = edgeCategory;
            }
            // record all added edges
            addedEdges.push( edge );
        }
    } );
    return addedEdges;
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
 * Create all node that need to be shown on the graph and return those nodes.
 *
 * @param {Object} data Data view model object
 * @param {Array} elementDataArray Node data array that will contain all node information that need to be shown
 * @param {Object} graphModel Graph model object
 * @param {Object} rootTaskObject Root task object
 * @param {Object} activeLegendView Active legend view object to populate node style info
 *
 * @return {Array} addedNodes All actual node objects
 */
var _drawNodes = function( data, elementDataArray, graphModel, rootTaskObject, activeLegendView ) {
    var addedNodes = [];
    if( !elementDataArray || elementDataArray.length <= 0 || !graphModel ) {
        return addedNodes;
    }
    var isFixedLayout = _isFixedLayoutMode( data );
    var nodeRect = {
        width: 300,
        height: 100,
        x: 200,
        y: 200
    };
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var parentNodeMap = {};
    for( var i = 0; i < elementDataArray.length; i++ ) {
        var nodeData = data.workflowOutput.elementData[ i ];
        var nodeObject = cdm.getObject( nodeData.element.uid );
        //Add typeIconUrl for each task node
        if( nodeObject.type && ( isOfType( nodeObject, 'EPMTask' ) || isOfType( nodeObject, 'EPMTaskTemplate' ) ) ) {
            nodeObject.typeIconURL = iconSvc.getTypeIconURL( nodeObject.type );
        }
        var perform_signoff_assignees = [];

        if( rootTaskObject && ( rootTaskObject === nodeObject || rootTaskObject.uid === nodeObject.uid ) ) {
            var nodeType = 'start';
            var startNode = getStartFinishNode( data, nodeObject, graph, graphModel, nodeType,
                data.i18n.startTooltip, nodeObject.props.state_value.dbValues[ 0 ], activeLegendView, rootTaskObject );
            addedNodes.push( startNode );
            graphModel.nodeMap.startNode = startNode;

            nodeType = 'finish';
            var finishNode = getStartFinishNode( data, nodeObject, graph, graphModel, nodeType,
                data.i18n.finishTooltip, nodeObject.props.state_value.dbValues[ 0 ], activeLegendView, rootTaskObject );
            graphModel.nodeMap.finishNode = finishNode;
            addedNodes.push( finishNode );

            continue;
        }

        if( typeof graphModel.nodeMap !== typeof undefined ) {
            var isInteractiveTask = true;
            var nodeCategory = data.workflowOutput.elementData[ i ].elementInfo.elementType[ 0 ];
            if( nodeObject.props.fnd0Status.dbValues === 'Error' ) {
                nodeCategory = 'EPM_failed';
            }
            if( data.workflowOutput.elementData[ i ].elementInfo.isInteractiveTask ) {
                isInteractiveTask = data.workflowOutput.elementData[ i ].elementInfo.isInteractiveTask[ 0 ];
            }

            if( isInteractiveTask === 'false' ) {
                var taskExecStatus = nodeObject.props.fnd0TaskExecutionStatus;

                //check the fnd0TaskExecutionStatus property.  If it is set to 2, don't add as a non-interactive list
                if( taskExecStatus && taskExecStatus.dbValues && taskExecStatus.dbValues.length > 0 ) {
                    var statusValue = taskExecStatus.dbValues[ 0 ];

                    // Additionaly check for this node needs to be shown as interactive node based
                    // on validation like child process or sub process exist on non interactive task
                    if( statusValue !== '2' && !isExceptionNode( nodeObject ) && !isEdgeCountMore( nodeObject ) ) {
                        isInteractiveTask = false;
                        var prominentNode = getStartFinishNode( data, nodeObject, graph, graphModel,
                            isInteractiveTask );
                        prominentNode.setMinNodeSize( MIN_NODE_SIZE );
                        addedNodes.push( prominentNode );
                        graphModel.nodeMap[ nodeData.element.uid ] = prominentNode;
                        continue;
                    }
                }
            }
            if( typeof data.workflowOutput.elementData[ i ].elementInfo.perform_signoff_assignees !== typeof undefined ) {
                perform_signoff_assignees = data.workflowOutput.elementData[ i ].elementInfo.perform_signoff_assignees;
            }
            var isGroup = isExceptionNode( nodeObject );
            var props = templateService.getBindPropertyNames( nodeObject, perform_signoff_assignees, rootTaskObject );
            var template = templateService.getNodeTemplate( isFixedLayout, graphModel.nodeTemplates, props, isGroup, !isInteractiveTask );

            var bindData = templateService.getBindProperties( isFixedLayout, rootTaskObject, nodeObject, props, false,
                perform_signoff_assignees );

            //get node style from graph legend
            var nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );
            if( nodeStyle ) {
                bindData.node_fill_color = nodeStyle.borderColor;
            }

            //fill node command binding data
            if( graphModel.nodeCommandBindData ) {
                graphModel.nodeCommandBindData.Awp0ToggleChildren_tooltip = data.i18n.showChildren;
                graphModel.nodeCommandBindData.Awp0ToggleSubProcess_tooltip = data.i18n.showSubProcess;
                declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
            }
            // Get the node rectangle that will be used for node size
            nodeRect = _getNodeRectObject( data, nodeObject, false, isGroup, null,  bindData );
            var node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
            node.appData = {
                nodeObject: nodeObject,
                isGroup: isGroup,
                category: nodeCategory,
                isFixedLayout : isFixedLayout
            };
            addedNodes.push( node );
            if( isGroup ) {
                node.setGroupingAllowed( true );
                var isExpanded = false;

                // Check for value of fnd0TaskExecutionErrors on container task
                // If a child task has an error we want to auto-expand the container and it's parents to show the task error more clearly
                if ( nodeObject.props.fnd0TaskExecutionErrors.uiValues && nodeObject.props.fnd0TaskExecutionErrors.uiValues[0] && nodeObject.props.fnd0TaskExecutionErrors.uiValues[0] !== '' ) {
                    isExpanded = true;
                    if( nodeObject.props.parent_task && nodeObject.props.parent_task.dbValues.length > 0 ) {
                        expandParents( nodeObject, parentNodeMap, groupGraph );
                    }
                } else {
                    parentNodeMap[nodeObject.uid] = node;
                }
                groupGraph.setExpanded( node, isExpanded );
            }

            //build node map to help create edges
            var nodeObj = node;
            // Check if graph model node map already contains the node UID and we are trying
            // to add same UID again that means it's duplicate node case and that can happen only in
            // case of sub process where dependency arguemnt is not present. So to handle that case
            // in case of duplicate nodes, we are adding all duplicate nodes to the map and that will
            // be used while creating edge. Duplicate case will happen only in Structure edge case.
            // Fix for defect LCS-604269
            if(  graphModel.nodeMap[ nodeData.element.uid ] ) {
                var nodes = graphModel.nodeMap[ nodeData.element.uid ];
                // If it's not array then create array and add the new node to that array and then
                // add it to map.
                if( !_.isArray( nodes ) ) {
                    nodes = [ nodes ];
                }
                nodes.push( node );
                nodeObj = nodes;
            }
            graphModel.nodeMap[ nodeData.element.uid ] = nodeObj;
        }
    }
    return addedNodes;
};

/**
 * Draw the graph in auto or fixed layout
 * @param {Object} nodeObject The node object
 * @param {Object} parentNodeMap Parent object to node map
 * @param {String} groupGraph Group graph to expand
 */
let expandParents = function( nodeObject, parentNodeMap, groupGraph ) {
    if( nodeObject && nodeObject.props && nodeObject.props.parent_task && nodeObject.props.parent_task.dbValues.length > 0 ) {
        var parentNode = parentNodeMap[nodeObject.props.parent_task.dbValues[0]];
        if( parentNode ) {
            groupGraph.setExpanded( parentNode, true );
            var parentObj = cdm.getObject( nodeObject.props.parent_task.dbValues[0] );
            expandParents( parentObj, parentNodeMap, groupGraph );
        }
    }
};

/**
 * Draw the graph in auto or fixed layout
 * @param {Object} data Declarative view model object
 * @param {Object} graphModel Graph model object
 * @param {String} layout Applied layout string
 * @param {Object} activeLegendView Active legend view object to populate node style info
 */
var _drawGraph = function( data, graphModel, layout, activeLegendView ) {
    var rootTaskObject = null;
    if( typeof data.workflowOutput !== typeof undefined && data.workflowOutput ) {
        rootTaskObject = workflowGraphService.getRootTaskObject( data.workflowOutput );
        // Set the root task on graph model so that it can be used in all other places. This is mainly
        // needed in fixed layout when user oepning up the task which has children.
        graphModel.rootTaskObject = rootTaskObject;
    }
    // If we are in fixed layout and we need to show the breadcrumb then only show the breadcrumb
    if( layout === 'FixedLayout' && data.workflowViewerContext.renderObject
    && data.workflowViewerContext.renderGraphContextObjectUid ) {
        rootTaskObject = cdm.getObject( data.workflowViewerContext.renderGraphContextObjectUid );
        // Set the root task object on graph model
        graphModel.rootTaskObject = rootTaskObject;
    }

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var addedNodes = [];
    var addedEdges = [];

    // Iterate for each workflow output to create the diagram node and edges
    // that will be shown on the diagram
    if( typeof data.workflowOutput !== typeof undefined ) {
        addedNodes = _drawNodes( data, data.workflowOutput.elementData, graphModel, rootTaskObject, activeLegendView );
        addedEdges = _drawEdges( data, data.workflowOutput.edgeData, graphModel.nodeMap.startNode, graphModel.nodeMap.finishNode, graphModel, activeLegendView );
    }

    // Get the default layout option and apply on the graph
    var defaultLayout = _getAppliedLayoutOption( data );

    if( graphModel && graphModel.graphControl ) {
        applyGraphLayout( graphModel, data );
        graphControl.fitGraph();
        if( defaultLayout && defaultLayout !== 'FixedLayout' ) {
            graphService.setActiveLayout( graphModel, defaultLayout );
        }
    }

    //apply graph filters and notify item added event
    graph.updateOnItemsAdded( addedNodes.concat( addedEdges ) );
};

/**
 *
 * @param {Object} workflowViewerContext Workflow viewer context object
 * @returns {String} Applied layout string value
 */
var _getGraphLayout = function( workflowViewerContext ) {
    if( workflowViewerContext && workflowViewerContext.diagram && workflowViewerContext.diagram.layoutOption ) {
        return workflowViewerContext.diagram.layoutOption;
    }
    return 'GcLeftToRightLayout';
};

/**
 *
 * Draw the graph in auto or fixed layout. First it will clear the graph if it has any content then only it will
 * draw the graph based on new content.
 * @param {Object} data Declarative view model object
 * @returns {Object} Updated workflow viewer context object
 */
export let drawGraph = function( data ) {
    var graphModel = data.graphModel;

    var activeLegendView = null;
    if( data.legend.legendViews ) {
        activeLegendView = data.legend.legendViews[ 0 ];
    }

    // Clear the graph node map and edge map if not empty
    var isClearGraph = false;
    if( graphModel.nodeMap ) {
        isClearGraph = true;
    }
    graphModel.nodeMap = {};
    graphModel.edgeMap = {};
    if( !graphModel.categoryApi ) {
        workflowLegendSvc.initGraphCategoryApi( graphModel );
    }

    // Get the layout to check if it's fixed layout that means all layout will be disabled and we need
    // to set differnt edge routing algorithm.
    var layout = _getGraphLayout( data.workflowViewerContext );
    workflowGraphService.setDiagramConfigForLayout( layout, graphModel );

    // Initially clear the graph
    if( isClearGraph && graphModel && graphModel.graphControl ) {
        //clear the graph
        var graph = graphModel.graphControl.graph;
        if( graph ) {
            graph.update( function() {
                graph.clear();
            } );
        }
    }
    // Draw nodes and edges on the graph
    if( graphModel && layout && activeLegendView  ) {
        _drawGraph( data, graphModel, layout, activeLegendView );
    }
    // When graph rendering is done then add the updated info on context object and return
    // the updated context object. Once graph is rendered we reset the variable to false
    // so that SOA will not be called again. We are using onUpdateHook on this variable
    // so when this variable is true, it will call soa to render the graph.
    const workflowViewerCtx = { ...data.workflowViewerContext };
    workflowViewerCtx.isReloadGraph = false;
    workflowViewerCtx.renderGraphContextObjectUid = '';
    // Below variable is mainly going to build the breadcrumb in case of fixed layout.
    workflowViewerCtx.rootTaskObject = graphModel.rootTaskObject;
    return workflowViewerCtx;
};

export let checkForReauthentication = function( data ) {
    // Check for TcSSO reauth parameter in URL, indicating reauthorization has already occurred. Perform task with retrieved SSO token
    var reauth = _getTrueParameterValue( AwStateService.instance.params.reauthorize );
    var locationContext = ctxService.getCtx( 'locationContext.ActiveWorkspace:Location' );
    var isInboxLocation = locationContext && locationContext === 'com.siemens.splm.client.inbox.tasksLocation';
    var isShowObjectLocation = ctxService.ctx && ctxService.ctx.locationContext['ActiveWorkspace:Location'] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation';
    var isEPMTaskOrSignoff = ctxService.ctx.xrtSummaryContextObject && ( ctxService.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
    ctxService.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 );
    var reauthLocation = isShowObjectLocation && isEPMTaskOrSignoff || isInboxLocation;

    const tokenValue = ssoAuthenticator.getReauthToken();
    if ( reauth && reauth === 'true' && tokenValue.length > 0 && reauthLocation ) {
        var actionableObjectUID = _getTrueParameterValue( AwStateService.instance.params.actionableObjectUID );
        var graph = ctxService.getCtx( 'graph' );
        var graphControl = graph.graphModel.graphControl;
        var item = graph.graphModel.nodeMap[ actionableObjectUID ];
        graphControl.setSelected( [ item ], true, true );
        commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
    }
};

let _getTrueParameterValue = function( value ) {
    if ( Array.isArray( value ) ) {
        return value[value.length - 1];
    }
    return value;
};

// Move elements with incremental / sorted layout update
var moveElements = function( movedNodes, layout ) {
    if( layoutActive( layout ) &&  movedNodes.length > 0  ) {
        layout.applyUpdate( function() {
            _.forEach( movedNodes, function( node ) {
                layout.moveNode( node );
            } );
        } );
    }
};

export let graphItemsMoved = function( items, graphModel ) {
    var movedNodes = [];
    if( items ) {
        items.forEach( function( element ) {
            if( element.getItemType() === 'Node' ) {
                movedNodes.push( element );
            }
        } );
        var layout = graphModel.graphControl.layout;
        moveElements( movedNodes, layout );
    }
};

var setNodeHoverStyle = function( node, hoveredClass ) {
    var bindData = node.getAppObj();
    templateService.setHoverNodeProperty( bindData, hoveredClass );
    if( node.getSVG() ) {
        node.getSVG().bindNewValues( templateService.NODE_HOVERED_CLASS );
        node.getSVG().bindNewValues( templateService.TEXT_HOVERED_CLASS );
    }
};

export let hoverChanged = function( hoveredItem, unHoveredItem ) {
    if( unHoveredItem && unHoveredItem.getItemType() === 'Node' ) {
        setNodeHoverStyle( unHoveredItem, null );
    }
    if( hoveredItem && hoveredItem.getItemType() === 'Node' ) {
        setNodeHoverStyle( hoveredItem, 'aw-widgets-cellListItemNodeHovered' );
    }
};

/**
 * Clear the current graph.
 * @param {Object} graphModel Graph model object
 */
export let clearTheCurrentGraphAW = function( graphModel ) {
    if( graphModel && graphModel.graphControl ) {
        graphModel.graphControl.clear();
    }
};

/**
 * Populate the parent process link based on input process and return the updated
 * parent process link with updated value.
 *
 * @param {Object} modelObject Process object for link need to be shown.
 * @param {Object} parentProcessProp Parent process property object
 * @param {Object} data Data view model object
 * @returns {Object} Updated parent process link property object
 */
var _populateProcessLink = function( modelObject, parentProcessProp, data ) {
    const parentProcessLinkProp = { ...parentProcessProp };
    if( !modelObject || !modelObject.props.job_name ) {
        parentProcessLinkProp.propertyDisplayName = '';
        parentProcessLinkProp.uiValue = '';
        return parentProcessLinkProp;
    }
    // Get the job name property from input parent process object and build
    // the job label and
    var jobNameProp = modelObject.props.job_name;

    // Parent process property is not null and has some value then only set it
    if( typeof jobNameProp !== typeof undefined && typeof jobNameProp.dbValues[ 0 ] !== typeof undefined ) {
        var jobLabel = data.i18n.backTo + jobNameProp.dbValues[ 0 ];
        parentProcessLinkProp.propertyDisplayName = jobLabel;
        parentProcessLinkProp.uiValue = jobLabel;
    }
    return parentProcessLinkProp;
};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {String} Property internal value string
 */
var _getPropValue = function( modelObject, propName ) {
    if( !modelObject || !modelObject.uid ) {
        return null;
    }
    if( modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues
        && modelObject.props[ propName ].dbValues[ 0 ] ) {
        return modelObject.props[ propName ].dbValues[ 0 ];
    }
    return null;
};

/**
 * Open the input process object and populate the link to navigate back to parent process.
 *
 * @param {Object} graphModel Graph model object
 * @param {Object} parentProcessProp Parent process link property object
 * @param {Object} nodeObject Process that need to be opened
 * @param {Object} data Data view model object
 * @param {Object} xrtState XRT state object that will be used to update signoff object set table
 * @returns {Object} Updated parent process link along with updated context info
 */
export let openSubProcess = function( graphModel, parentProcessProp, nodeObject, data, xrtState ) {
    let parentProcessLinkProp = { ...parentProcessProp };
    const workflowViewerCtx = { ...data.workflowViewerContext };
    var rootTaskObject = null;

    // Get the root task object from workflowOutput object from here we get the root task for
    // graph is being rendered and then that will be used to get the job name and populate the
    // back to parent process link
    if( typeof data.workflowOutput !== typeof undefined && data.workflowOutput ) {
        rootTaskObject = workflowGraphService.getRootTaskObject( data.workflowOutput );
    }
    // Check if root task object is not valid then no need to process further and return from here
    if( !rootTaskObject ) {
        return {
            parentProcess : parentProcessLinkProp,
            workflowViewerContext: workflowViewerCtx
        };
    }

    // Clear the current showing graph before showing the new graph
    exports.clearTheCurrentGraphAW( graphModel );

    var previousParentProcesses = null;
    // Get the previous parent process objects from context object and if not present then
    // initialize with empty array and then add the root task to this array so that when user
    // click on link, we can render the old graph.
    previousParentProcesses = workflowViewerCtx.previousParentProcesses;
    if( previousParentProcesses === undefined ) {
        previousParentProcesses = [];
    }
    previousParentProcesses.push( rootTaskObject );
    // Populate the parent process link to navigate back to parent process
    parentProcessLinkProp = _populateProcessLink( rootTaskObject, parentProcessLinkProp, data );

    // Update the signoff table and target complete task panel when user open sub process
    var parentProcess = _getPropValue( nodeObject, 'parent_process' );
    if( !parentProcess ) {
        parentProcess = nodeObject;
    }
    workflowUtils.updateCustomContextXRTState( xrtState, parentProcess, true );
    // Get the object that need to be rendered
    if( !parentProcess.uid || _.isString( parentProcess ) ) {
        parentProcess = cdm.getObject( parentProcess );
    }

    workflowViewerCtx.isOpenSubProcess = true;
    workflowViewerCtx.renderObject = parentProcess;
    workflowViewerCtx.previousParentProcesses = previousParentProcesses;
    workflowViewerCtx.isReloadGraph = true;
    return {
        parentProcess : parentProcessLinkProp,
        workflowViewerContext: workflowViewerCtx
    };
};

/**
 * Navigate back to parent process and populate the link based on we need to show the link or not.
 *
 * @param {Object} graphModel Graph model object
 * @param {Object} parentProcessLink Parent process link property object
 * @param {Object} workflowViewerContext Workflow viewer context object that hold all process related info.
 * @param {Object} data Data view model object
 * @param {Object} xrtState XRT state object that will be used to update signoff object set table
 * @returns {Object} Updated parent process link along with updated context info
 */
export let returnToParentProcess = function( graphModel, parentProcessLink, workflowViewerContext, data, xrtState ) {
    const workflowViewerCtx = { ...workflowViewerContext };
    let parentProcessLinkProp = { ...parentProcessLink };
    var previousParentProcesses = workflowViewerCtx.previousParentProcesses;
    if( typeof previousParentProcesses === typeof undefined || previousParentProcesses.length <= 0 ) {
        return {
            parentProcess : parentProcessLinkProp,
            workflowViewerContext: workflowViewerCtx
        };
    }

    // Clear the current showing graph before showing the new graph
    exports.clearTheCurrentGraphAW( graphModel );

    // Get the parent process which need to be rendered when user click on back to parent process link
    var parentProcess = previousParentProcesses[ previousParentProcesses.length - 1 ];
    previousParentProcesses.splice( previousParentProcesses.length - 1, 1 );

    // Set the isOpenSubProcess set to false so that link can be hidden and if there are
    // multiple parent processes user has navigated to then we go back to parent process
    // one by one step. SO in case of multiple we keep this varaible as true as still we need
    // to show the link.
    workflowViewerCtx.isOpenSubProcess = false;
    parentProcessLinkProp = _populateProcessLink( null, parentProcessLinkProp, data );
    if( previousParentProcesses.length > 0 ) {
        workflowViewerCtx.isOpenSubProcess = true;
        // In case of multiple processes we need to get it from array after removing the last
        // parent process and then build the back to parent process link as we go from last to 0th index.
        var parentOfParentProcess = previousParentProcesses[ previousParentProcesses.length - 1 ];
        parentProcessLinkProp = _populateProcessLink( parentOfParentProcess, parentProcessLinkProp, data );
    }
    // Get the parent_process property and if not null then use that to render the graph
    var parentProcessObject = _getPropValue( parentProcess, 'parent_process' );
    if( !parentProcessObject ) {
        parentProcessObject = parentProcess;
    }

    // Get the object that need to be rendered
    if( !parentProcessObject.uid || _.isString( parentProcessObject ) ) {
        parentProcessObject = cdm.getObject( parentProcessObject );
    }

    // Update the context object with new object for graph need to be rendered and
    // along with that we set the rootTaskObject as well and this is mainly going to used
    // in case of fixed layout where we need to show the breadcrumb based on this root task object
    // when user is navigating back to parent process and layout is fixed layout.
    workflowViewerCtx.renderObject = parentProcessObject;
    workflowViewerCtx.rootTaskObject = parentProcessObject;
    workflowViewerCtx.isReloadGraph = true;

    // Update the signoff table as per selection
    workflowUtils.updateCustomContextXRTState( xrtState, parentProcessObject, true );

    return {
        parentProcess : parentProcessLinkProp,
        workflowViewerContext: workflowViewerCtx
    };
};

/**
 * Register workflow properties
 *
 * @param {Object} policy Policy that need to be registered
 * @returns {String} Policy Id string
 */
export let registerWorkflowProp = function( policy ) {
    if( policy ) {
        return policySvc.register( policy );
    }
    return null;
};

/**
 * Unregister workflow properties
 * @param {String} policyId Policy that need to be unregister
 */
export let unregisterWorkflowProp = function( policyId ) {
    if( policyId !== null ) {
        policySvc.unregister( policyId );
    }
};

/**
 * Initialize the workflow viewer context object when workflow graph need to be rendered.
 *
 * @param {Object} workflowViewerContext Workflow viewer context object
 * @param {Object} selection Selected object from UI for graph need to be rendered
 * @param {Object} subPanelContext Context object that holds all information.
 * @returns {Object} Workflow viewer context object
 */
export let setInitialGraphLayout = function( workflowViewerContext, selection, subPanelContext ) {
    // Copy the existing value from context object and if it is undefined then
    // initialize with some default values
    var workflowViewerCtx = { ...workflowViewerContext };
    if( !workflowViewerCtx || _.isEmpty( workflowViewerCtx )  ) {
        workflowViewerCtx = {
            diagram: {}
        };
    }
    var layoutOption = 'GcLeftToRightLayout';
    var isAutoLayoutOn = true;
    var workflowGraphShowSubProcessData = true;
    // Get the preferred workflow diagram preference value and based on the value set the values
    // on context object so that it can be used to render graph correctly.
    if ( ctxService.ctx.preferences.WRKFLW_preferred_diagram_layout ) {
        var selectionLayoutDirection = ctxService.ctx.preferences.WRKFLW_preferred_diagram_layout[0];
        if ( selectionLayoutDirection === 'FixedLayout' ) {
            layoutOption = selectionLayoutDirection;
            isAutoLayoutOn = false;
            workflowGraphShowSubProcessData = false;
        } else {
            layoutOption = selectionLayoutDirection;
            isAutoLayoutOn = true;
        }
    }
    workflowViewerCtx.workflowGraphShowSubProcessData = workflowGraphShowSubProcessData;
    workflowViewerCtx.diagram.layoutOption = layoutOption;
    workflowViewerCtx.diagram.isAutoLayoutOn = isAutoLayoutOn;
    // Set the input selection as
    var renderObject = selection;
    // Set the default object for graph need to be rendered.
    if( ( !selection || !selection.uid ) && subPanelContext && subPanelContext.selected ) {
        // We are using adapter service here to get the adpated object like in case of content
        // tab when Awb0DesignElement is shown we need to show graph based on underlying object.
        // So we need to get that first and then use it for graph rendering.
        var adaptedObjects = adapterSvc.getAdaptedObjectsSync( [ selection ] );
        if( adaptedObjects && adaptedObjects[ 0 ] ) {
            renderObject = adaptedObjects[ 0 ];
        }
    }

    workflowViewerCtx.renderObject = renderObject;

    // Set the page context on workflow viewer context object. So that it can be used for command
    // visiblity. In case of show object location pageContext is directly present on subPanelContext
    // object but in case when task is selected from inbox location then it's stored on
    // context object from subPanelContext. So get the correct values and then set it on context object.
    if( subPanelContext && subPanelContext.pageContext ) {
        workflowViewerCtx.pageContext = subPanelContext.pageContext;
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.pageContext ) {
        workflowViewerCtx.pageContext = subPanelContext.context.pageContext;
    }
    return workflowViewerCtx;
};

/**
 * Unregister the policy for workflow page and update the xrt state if it contains
 * any custom context object info
 * @param {Object} xrtState XRT state context object
 * @param {Object} policyId Policy that need to be unregistered
 *
 */
export let clearWorkflowCustomContextProcessInfo = function( xrtState, policyId ) {
    exports.unregisterWorkflowProp( policyId );

    // Check if XRT state is not null then only process further
    if( xrtState ) {
        let newAtomicObj = { ...xrtState.getValue() };
        if( newAtomicObj && newAtomicObj.customContext && newAtomicObj.customContext.selectedProcess ) {
            newAtomicObj.customContext = null;
            xrtState.update && xrtState.update( newAtomicObj );
        }
    }
};


export default exports = {
    setNodeHeightOnWrappedHeightChanged,
    drawGraph,
    graphItemsMoved,
    hoverChanged,
    clearTheCurrentGraphAW,
    returnToParentProcess,
    registerWorkflowProp,
    unregisterWorkflowProp,
    openSubProcess,
    setInitialGraphLayout,
    clearWorkflowCustomContextProcessInfo,
    checkForReauthentication
};
