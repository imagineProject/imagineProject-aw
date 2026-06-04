// Copyright (c) 2022 Siemens

/**
 * Workflow designer graph save service
 *
 * @module js/Awp0WorkflowDesignerGraphSaveService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';

var exports = {};


var _saveGraphPositions  = function( positionDataArray ) {
    var inputData = [];
    for ( var key in positionDataArray ) {
        if ( positionDataArray.hasOwnProperty( key ) ) {
            var additionalDataMap = {};
            var positionObject = positionDataArray[key];
            if( positionObject.start_node_location ) {
                additionalDataMap.start_node_location = [ positionObject.start_node_location ];
            }
            if( positionObject.complete_node_location ) {
                additionalDataMap.complete_node_location = [ positionObject.complete_node_location ];
            }
            if( positionObject.location1 ) {
                additionalDataMap.location1 = [ positionObject.location1 ];
            }
        }
        var object = {
            clientID: 'saveEditTemplate - ' + key,
            templateToUpdate:key,
            additionalData:additionalDataMap
        };
        inputData.push( object );
    }
    var soaInput = {
        input: inputData
    };

    // Check if SOA input is not null and not empty then only make SOA call
    if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
        var deferred = AwPromiseService.instance.defer();
        var promise = soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateTemplate', soaInput );
        promise.then( function() {
            deferred.resolve();
        } ).catch( function( error ) {
            deferred.reject( error );
        } );
    }
};

/**
 * Based on input nodes save the postions. If invalid then save for all nodes
 * @param {Array} nodePositionsToBeSaved Node positions that need to be saved
 */
export let saveGraphPositions = function( nodePositionsToBeSaved ) {
    var nonInteractiveNodeHeightAdjustment = 25;
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    var groupGraph = graphControl.groupGraph;
    var graph = graphControl.graph;

    var positionDataArray = new Object();
    var validNodesToSaved = nodePositionsToBeSaved;
    if( !validNodesToSaved ) {
        validNodesToSaved = graph.getNodes();
    }

    //Calculate the top-most and left-mode values for the current nodes
    var deltaXY = exports.findDeltaXYOfCurrentDiagram( validNodesToSaved, graph );

    _.forEach( validNodesToSaved, function( node ) {
        //processPosition
        var position = graph.getBounds( node );
        var parentNode = groupGraph.getParent( node );
        var modelObject = node.modelObject;
        var nodeTemplateUid = modelObject.uid;
        var finalX = position.x + deltaXY[0];
        var finalY = position.y + deltaXY[1];

        //scaling the position data by scaling factor
        finalX /= 1.9;
        finalX = Math.round( finalX );
        finalY /= 1.9;
        finalY = Math.round( finalY );

        var start_node_location = null;
        var complete_node_location = null;
        var location1 = null;
        var positionValue = finalX + ',' + finalY;
        if( node.appData && ( node.appData.nodeType === 'finish' || node.appData.nodeType === 'start' ) ) {
            if( node.appData.nodeType === 'finish' ) {
                complete_node_location = positionValue.toString();
            } else if( node.appData.nodeType === 'start' ) {
                start_node_location = positionValue.toString();
            }
        } else {
            if( parentNode && parentNode.modelObject )  {
                var parentModelObject = parentNode.modelObject;
                if( parentModelObject && parentModelObject.type !== 'EPMReviewTaskTemplate' && parentModelObject.type !== 'EPMAcknowledgeTaskTemplate'
                && parentModelObject.type !== 'EPMRouteTaskTemplate' ) {
                    location1 = positionValue.toString();
                    // set for normal EPM task Template
                }
            } else {
                location1 = positionValue.toString();
            }
        }

        if( positionDataArray[ nodeTemplateUid ] ) {
            var existingObject = positionDataArray[ nodeTemplateUid ];
            if( existingObject.start_node_location ) {
                start_node_location = existingObject.start_node_location;
            }
            if( existingObject.complete_node_location ) {
                complete_node_location = existingObject.complete_node_location;
            }
            if( existingObject.location1 ) {
                location1 = existingObject.location1;
            }
        }
        if( start_node_location || complete_node_location || location1 ) {
            var object = {
                start_node_location : start_node_location,
                complete_node_location : complete_node_location,
                location1 : location1
            };
            positionDataArray[nodeTemplateUid ] = object;
        }
    } );
    _saveGraphPositions( positionDataArray );
};

/**
 * Update the node details on graph based on input modified objects.
 *
 * @param { Array} totalNodesInGraph  All node objects in graph
 * @param {Array} currentGraph the current graph
 *
 * @returns {Array} Delta array values for X and Y coordinate
 */
export let findDeltaXYOfCurrentDiagram = function( totalNodesInGraph, currentGraph ) {
    var currentMinXValue = -9999;
    var currentMinYValue = -9999;

    var deltaX;
    var deltaY;
    var deltaArray = [];

    if( totalNodesInGraph && totalNodesInGraph.length > 0 ) {
        _.forEach( totalNodesInGraph, function( node ) {
            var position = currentGraph.getBounds( node );
            var positionX = position.x;
            var positionY = position.y;

            if ( currentMinXValue === -9999 ) {
                currentMinXValue = positionX;
            } else if ( positionX < currentMinXValue ) {
                currentMinXValue = positionX;
            }
            if ( currentMinYValue === -9999 ) {
                currentMinYValue = positionY;
            } else if ( positionY < currentMinYValue ) {
                currentMinYValue = positionY;
            }
        } );
        deltaX = 10 - currentMinXValue;
        deltaY = 40 - currentMinYValue;
        deltaArray[0] = deltaX;
        deltaArray[1] = deltaY;
    }


    return deltaArray;
};

export default exports = {
    saveGraphPositions,
    findDeltaXYOfCurrentDiagram
};
