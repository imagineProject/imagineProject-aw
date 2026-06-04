// Copyright (c) 2022 Siemens

/**
 * This implements the method related to drawing the edges on the graph
 *
 * @module js/Awp0WorkflowDesignerEdgeService
 */
import cdmService from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import graphLegendSvc from 'js/graphLegendService';

var exports = {};

/**
 * Populate the edge info based on input information and add to edge list.
 *
 * @param {Obejct} sourceNode Source node object
 * @param {Obejct} targetNode Target node obejct
 * @param {String} edgeTitle Edge title string that need to be set on edge
 * @param {String} edgeCategory Edge category that will be used to set the edge style
 * @param {Array} edgeObjects Edge object array to store all edges that need to be drawn
 */
var _createEdgeObject = function( sourceNode, targetNode, edgeTitle, edgeCategory, edgeObjects ) {
    var edgeObject = {};
    var modelObject = modelObject;
    var relationType = edgeCategory;
    if( edgeCategory === 'FailSuccessor' || edgeCategory === 'PendingFailSuccessor' ) {
        relationType = 'FailPath';
    } else if( edgeCategory === 'CompleteSuccessor' || edgeCategory === 'PendingCompleteSuccessor' ) {
        relationType = 'SuccessPath';
    } else if( edgeCategory === 'Structure' ) {
        relationType = 'Structure';
    }

    edgeObject.relationType = relationType;
    edgeObject.leftNodeId = sourceNode;
    edgeObject.rightNodeId = targetNode;
    edgeObject.edgeTitle = edgeTitle;
    edgeObjects.push( edgeObject );
};

/**
 * Populate the edge data information that needs to be drawn on graph.
 *
 * @param {Array} edgeDataArray Edge data array that needs to be shown on graph
 * @param {Map} nodeMap Node data map that will be used to get the nodes correctly for edges
 * @param {Object} selTemplate Selected template obejct for which graph need to be shown
 */
export let populateEdgeData = function( edgeDataArray, nodeMap, selTemplate, parentNode ) {
    var edgeObjects = [];
    _.forEach( edgeDataArray, function( edgeData ) {
        var edgeCategory = edgeData.edgeInfo.edgeType[ 0 ];
        var sourceNode;
        var targetNode;

        var end1Element = edgeData.end1Element;
        var end2Element = edgeData.end2Element;

        if( end1Element.uid && end2Element.uid ) {
            var sourceObject = cdmService.getObject( end1Element.uid );
            var targetObject = cdmService.getObject( end2Element.uid );

            if( sourceObject && targetObject ) {
                targetNode = nodeMap[ targetObject.uid ];
                sourceNode = nodeMap[ sourceObject.uid ];

                // Check if source obejct UID is tempalte UID then use start node and if target object UID
                // is template UID then use finish node.
                if( sourceObject.uid === selTemplate.uid ) {
                    sourceNode = nodeMap.startNode;
                } else if( targetObject.uid === selTemplate.uid ) {
                    targetNode = nodeMap.finishNode;
                }

                // This is needed for creating the child nodes for create case
                if( parentNode && parentNode.modelObject && parentNode.modelObject.uid === sourceObject.uid ) {
                    sourceNode = parentNode;
                } else if( parentNode && parentNode.modelObject && parentNode.modelObject.uid === targetObject.uid ) {
                    targetNode = parentNode;
                }

                var edgeTitle = null;
                if( typeof edgeData.edgeInfo.edgeName !== typeof undefined ) {
                    edgeTitle = edgeData.edgeInfo.edgeName[ 0 ];
                }
                // Create edge client data object that will store all edge info
                _createEdgeObject( sourceNode, targetNode, edgeTitle, edgeCategory, edgeObjects );
            }
        }
    } );
    return edgeObjects;
};

/**
 * Draw the input edges on the graph
 *
 * @param {Array} edgesToBeDrawn Edges objects array that need to be shown on graph
 * @param {Object} graphModel Graph model object
 * @param {Object} graph Graph object to create the node
 * @param {Object} groupGraph Group graph object
 * @param {Object} activeLegendView Active legend view object to populat enode style info
 *
 */
export let drawEdges = function( edgesToBeDrawn, graphModel, graph, groupGraph, activeLegendView ) {
    _.forEach( edgesToBeDrawn, function( edgeData ) {
        var sourceNode = null;
        var targetNode = null;

        if( edgeData.leftNodeId && edgeData.leftNodeId.nodeId ) {
            sourceNode = graphModel.nodeMap[ edgeData.leftNodeId.nodeId ];
        }
        if( edgeData.rightNodeId && edgeData.rightNodeId.nodeId ) {
            targetNode = graphModel.nodeMap[ edgeData.rightNodeId.nodeId ];
        }
        var edge;
        var edgeCategory = edgeData.relationType;
        var edgeStyle;
        var isAddEdgeCase = false;

        if( edgeData.edge ) {
            isAddEdgeCase = true;
            sourceNode = edgeData.sourceNode;
            targetNode = edgeData.targetNode;
            edge = edgeData.edge;
        }
        //get edge style from graph legend
        var legendEdgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeCategory, activeLegendView );
        if( legendEdgeStyle ) {
            edgeStyle = legendEdgeStyle;
        }

        // Check if edge style is not present then use default hardcoded style.
        if( !edgeStyle ) {
            edgeStyle = {
                borderColor: 'rgb(85,160,185)',
                color: 'rgb(135,155,170)',
                dashStyle: 'SOLID',
                shape: 'Polyline',
                targetArrow: { arrowScale: '2', arrowShape: 'TRIANGLE', fillInterior: 'true' },
                thickness: '2',
                thicknessMultiplier: '2'
            };
        }

        // Check if source and target node are not null and edge category is structure then show it differntly
        // else create the edge and reder differntly
        if( sourceNode && targetNode ) {
            if( edgeCategory === 'Structure' ) {
                if( !groupGraph.isGroup( sourceNode ) ) {
                    groupGraph.setAsGroup( sourceNode );
                }
                // This code is needed in some case when group node height is not correct when
                // children order is not correct.
                if( sourceNode !== groupGraph.getParent( targetNode ) ) {
                    groupGraph.setExpanded( sourceNode, true );
                    groupGraph.setParent( sourceNode, [ targetNode ] );
                    groupGraph.setExpanded( sourceNode, false );
                }

                //the group node is in group display by default, it can be switched to network display
                sourceNode.isNestedDisplay = true;
            } else if( !isAddEdgeCase ) {
                var edgeTitle = edgeData.edgeTitle;
                edge = graph.createEdgeWithNodesStyleAndTag( sourceNode, targetNode, edgeStyle, null );

                if( edgeTitle ) {
                    graph.setLabel( edge, edgeTitle );
                }
            }
            if( edge ) {
                edge.category = edgeCategory;
                edge.modelObject = edgeData.metaObject;
                edge.sourceNode = sourceNode;
                edge.targetNode = targetNode;
                edge.itemType = 'Edge';
                graphModel.graphControl.graph.setEdgeStyle( edge, edgeStyle );
                graphModel.graphControl.graph.updateOnItemsAdded( [ edge ] );
            }
            graphModel.edgeMap[ sourceNode.nodeId ] = targetNode.nodeId;
        }
    } );
};

export default exports = {
    populateEdgeData,
    drawEdges
};
