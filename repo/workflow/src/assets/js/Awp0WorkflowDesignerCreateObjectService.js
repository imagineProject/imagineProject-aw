// Copyright (c) 2022 Siemens

/**
 * This implements the graph edit handler interface APIs defined by aw-graph widget to provide graph authoring
 * functionalities for workflow designer tab
 *
 * @module js/Awp0WorkflowDesignerCreateObjectService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import nodeService from 'js/Awp0WorkflowDesignerNodeService';
import edgeService from 'js/Awp0WorkflowDesignerEdgeService';
import layoutService from 'js/Awp0WorkflowDesignerLayoutService';
import workflowUtils from 'js/Awp0WorkflowDesignerUtils';
import cdm from 'soa/kernel/clientDataModel';
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

var exports = {};

var _soaCreateNodeClientIdMap = [];
var _soaCreateEdgeClientIdMap = [];

/**
 * execute createOrUpdateTemplate soa call
 *
 * @param {object} creInput input data
 */
var executeCreateObject = function( creInput ) {
    eventBus.publish( 'workflowDesigner.CreateObjectEvent', { createInput: creInput } );
};

/**
 * execute createOrUpdateTemplate soa call
 *
 * @param {object} creInput input data
 */
var executeCreateEdgeObject = function( creInput ) {
    eventBus.publish( 'workflowDesigner.CreateEdgeEvent', { createInput: creInput } );
};

/**
 * Hook to event awGraph.nodeEditCommitted
 *
 * @param {object} eventData - event data about the element created on graph
 */
export let onNodeEditCommitted = function( eventData ) {
    if( !eventData && !eventData.nodeCategory ) {
        return;
    }
    var node = eventData.editNode;
    var objectName = eventData.newValue;

    // Format the position data from the new node
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    var graph = graphControl.graph;
    var position = graph.getBounds( node );
    var formattedPositionValues = workflowUtils.formatNodePositionValues( position, null );

    // Create map for location data, to be added at object creation
    var additionalDataMap = {};
    additionalDataMap.location1 = [ formattedPositionValues ];

    var templateId = 'WorkflowDesignerDummyNodeTemplate';
    if( node && node.style ) {
        templateId = node.style.templateId;
    }
    var isDummy = templateId === 'WorkflowDesignerDummyNodeTemplate';
    // Where user is trying to add the new task template either inside
    // root task template or inside genric EPMTaskTemplate as sub child
    var parentNode = eventData.parentNode;
    // Get the root task node shown on graph as start node and use that to add the newly
    // created template. In case of fixed layout where we navigate through breadcrumb this will
    // be used to add child task on some level.
    var startNode = _.find( appCtxSvc.ctx.graph.graphModel.nodeMap, function( node ) {
        return node && node.appData && node.appData.nodeType && node.appData.nodeType === 'start';
    } );

    var parentTempalteUid = appCtxSvc.ctx.xrtSummaryContextObject.uid;
    // Check if start node is not null and contians model object then only use that
    if( startNode && startNode.modelObject ) {
        parentTempalteUid = startNode.modelObject.uid;
    }
    if( parentNode && parentNode.modelObject ) {
        parentTempalteUid = parentNode.modelObject.uid;
    }
    // Find the base template index from new object need to be created
    var baseTemplateUid = eventData.templateUid;

    if( !baseTemplateUid ) {
        logger.error( 'node creation failed due to missing base template data' );
        eventBus.publish( 'workflowDesigner.nodeEditCancelled', node );
        return;
    }

    // for dummy node, add newly created modelobject from server side to dummy node
    if( isDummy ) {
        var cliendId = 'createTemplateNode' + new Date().getTime();
        var input = [ {
            clientID: cliendId,
            baseTemplate: baseTemplateUid,
            parentTemplate: parentTempalteUid,
            templateName: objectName,
            additionalData: additionalDataMap
        } ];
        _soaCreateNodeClientIdMap[ cliendId ] = eventData;
        executeCreateObject( input );
    }
};

/**
 * removes the dummy node in case error occurred
 *
 * @param {object} graphModel architecture graph model
 * @param {object} node Node item
 */
var removeDummyNodeOnError = function( graphModel, node ) {
    var templateId;
    // Get the template id from input dummty node
    if( node && node.style && node.style.templateId ) {
        templateId = node.style.templateId;
    }
    //remove dummy node
    if( templateId === 'WorkflowDesignerDummyNodeTemplate' ) {
        graphModel.graphControl.graph.removeNodes( [ node ] );
    }
};


/**
 * Remove the dummy node because of node creation cancelled.
 *
 * @param {object} graphModel graphModel object
 * @param {object} eventData - Event data that contains dummy node that need to be removed
 */
export let onNodeEditCancelled = function( graphModel, eventData ) {
    if( !graphModel || !eventData || !eventData.nodes.length > 0 ) {
        return;
    }
    removeDummyNodeOnError( graphModel, eventData.nodes[ 0 ] );
};

/*
 * method to get createOrUpdateTemplate SOA response and pass it to create node complete event for further processing.
 */
export let getCreateNodeResponse = function( response ) {
    var createNodeResponse = _.clone( response );
    var eventData = {
        createNodeData: createNodeResponse
    };
    eventBus.publish( 'workflowdesigner.createNodeComplete', eventData );
    return createNodeResponse;
};

/*
 * method to get createOrUpdateTemplate SOA response and pass it to create edge complete event for further processing.
 */
export let getCreateEdgeResponse = function( response ) {
    var createEdgeResponse = _.clone( response );
    var eventData = {
        createEdgeData: createEdgeResponse
    };
    eventBus.publish( 'workflowdesigner.createEdgeComplete', eventData );
    return createEdgeResponse;
};

/**
 * removes the dummy edge in case error occurred
 *
 * @param {object} graphModel architecture graph model
 * @param {object} edge edge item
 */
var removeDummyEdgeOnError = function( graphModel, edge ) {
    if( graphModel.graphControl && graphModel.graphControl.graph ) {
        var graph = graphModel.graphControl.graph;
        graph.removeEdges( [ edge ] );
    }
};

/**
 * remove the dummy edge
 *
 * @param {object} graphModel graphModel object
 * @param {object} eventData - event data with dummy node
 */
export let onEdgeCreationCancelled = function( graphModel, eventData ) {
    if( !graphModel || !eventData || !eventData.edge ) {
        return;
    }
    // Remove the dummy edge
    removeDummyEdgeOnError( eventData.edge );
};

/**
 * Shows text Editor for newly created dummy node
 *
 * @param {object} graphModel graphmodel data
 * @param {object} node node to be edit
 *
 * @returns {Object} Promise for edit node property
 */
export let showTextEditor = function( graphModel, node ) {
    // by default, create a deferred promise with reject
    var deferred = AwPromiseService.instance.defer();
    //deferred.reject();
    if( !graphModel || !node ) {
        return deferred.promise;
    }
    // show inline editor
    var nodePropertyEditHandler = graphModel.graphControl.nodePropertyEditHandler;
    if( nodePropertyEditHandler ) {
        //find the name element
        var property = 'Name';
        var selector = 'text.aw-graph-modifiableProperty[data-property-name="Name"]';
        var nameElement = $( selector, node.getSVGDom() );
        if( nameElement && nameElement[ 0 ] ) {
            return nodePropertyEditHandler.editNodeProperty( node, nameElement[ 0 ], property, node
                .getProperty( property ) );
        }
    }
    return deferred.promise;
};

/**
 * quick create the node item from relation legend panel
 *
 * @param {object} data declarative view model
 * @param {object} eventData - event data about the element created on graph
 */
export let templateNodeCreateAction = function( data, eventData ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var objectType = eventData.objectTypeToCreate;
    var parentNode = eventData.parentNode;
    var templateUid = eventData.templateUid;
    var graphModel = null;
    if( graphContext.graphModel ) {
        graphModel = graphContext.graphModel;
    }

    if( !objectType || !eventData.nodes ) {
        logger.error( 'node creation failed due to missing node data' );
        removeDummyNodeOnError( graphModel, eventData.nodes[ 0 ] );
        return;
    }

    _.defer( function() {
        exports.showTextEditor( graphModel, eventData.nodes[ 0 ] ).then(
            function( editData ) {
                //Check if new node value is empty then no need to create the node
                if( _.trim( editData.newValue ) === '' ) {
                    removeDummyNodeOnError( graphModel, editData.editNode );
                    return;
                }
                editData.nodeCategory = objectType;
                editData.parentNode = parentNode;
                editData.Name = editData.newValue;
                editData.templateUid = templateUid;
                eventBus.publish( 'workflowDesigner.nodeEditCommitted', editData );
            },
            function() {
                //cancel edit, so remove dummy node
                eventBus.publish( 'workflowDesigner.nodeEditCancelled', eventData.nodes[ 0 ] );
            }
        );
    } );
};

/**
 * Get the input object property and return the internal value.
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
 * Hook to event edge creation
 *
 * @param {object} selTemplate - Template object
 * @param {object} eventData - event data about the element created on graph
 */
export let quickEdgeCreateAction = function( selTemplate, eventData ) {
    if( !eventData || !selTemplate ) {
        return;
    }

    var sourceObj = eventData.sourceNode.modelObject;
    var targetObj = eventData.targetNode.modelObject;
    var map = {};

    var propValue = [];
    var sourceParentValues = _getPropValue( sourceObj, 'parent_task_template' );
    var targetParentValues = _getPropValue( targetObj, 'parent_task_template' );
    // Check if source object is parent for target then we need to set parent_predecessor proeprty
    if( sourceObj && targetParentValues && targetParentValues[ 0 ] && sourceObj.uid === targetParentValues[ 0 ] ) {
        map = {
            parent_predecessor: [ 'true' ]
        };
    } else if( sourceObj && targetObj && sourceParentValues && sourceParentValues[ 0 ] && targetObj.uid === sourceParentValues[ 0 ] ) {
        // If case is of complete predecessor then set that property correctly. This case when target is source node parent
        propValue = _getPropValue( targetObj, 'complete_predecessors' );
        if( propValue && propValue.length > 0 ) {
            propValue.push( sourceObj.uid );
        } else {
            propValue = [];
            propValue = [ sourceObj.uid ];
        }
        map = {
            complete_predecessors: propValue
        };
    } else {
        // Check if user is trying to create fail path then we need to set fail predecessor property
        if( eventData.categoryType === 'FailPath' ) {
            propValue = _getPropValue( targetObj, 'fail_predecessors' );
            if( propValue && propValue.length > 0 ) {
                propValue.push( sourceObj.uid );
            } else {
                propValue = [];
                propValue = [ sourceObj.uid ];
            }
            map = {
                fail_predecessors: propValue
            };
        } else {
            // In all other cases set the predecessor proeprty.
            propValue = _getPropValue( targetObj, 'predecessors' );
            if( propValue && propValue.length > 0 ) {
                propValue.push( sourceObj.uid );
            } else {
                propValue = [];
                propValue = [ sourceObj.uid ];
            }
            map = {
                predecessors: propValue
            };
        }
    }
    var cliendId = 'createEdge' + new Date().getTime();
    var input = [ {
        clientID: cliendId,
        templateToUpdate: targetObj.uid,
        additionalData: map
    } ];
    _soaCreateEdgeClientIdMap[ cliendId ] = eventData;
    executeCreateEdgeObject( input );
};

/**
 * Add the newly created edge on graph and update the layout.
 * @param {Obejct} graphModel Graph model object
 * @param {Object} createEdgeResponse Create edge response
 * @param {Object} data Data view model object
 */
export let addEdgeOnGraph = function( graphModel, createEdgeResponse, data ) {
    var activeLegendView = null;
    var graphContext = appCtxSvc.getCtx( 'graph' );
    if( graphContext && graphContext.legendState ) {
        activeLegendView = graphContext.legendState.activeView;
    }
    // Check if SOA response is not valid then return from here
    if( !createEdgeResponse || !createEdgeResponse.ServiceData || !createEdgeResponse.createdorUpdatedObjects ) {
        return;
    }
    // Get the client id and service data and created template object
    var clientId = createEdgeResponse.createdorUpdatedObjects[ 0 ].clientID;
    var templateObject = createEdgeResponse.createdorUpdatedObjects[ 0 ].templateObject;
    var serviceData = createEdgeResponse.ServiceData;

    var eventToProcess = _soaCreateEdgeClientIdMap[ clientId ];
    if( !eventToProcess || !eventToProcess.edge ) {
        return;
    }

    try {
        // Check if template object is null or service data has partial errors then remove the
        // dummy edge
        if( !templateObject || serviceData && serviceData.partialErrors ) {
            removeDummyEdgeOnError( graphModel, eventToProcess.edge );
            return;
        }
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        var groupGraph = graphControl.groupGraph;
        var edgeData = {
            edge: eventToProcess.edge,
            sourceNode: eventToProcess.sourceNode,
            targetNode: eventToProcess.targetNode,
            relationType: eventToProcess.categoryType
        };
        if( edgeData.sourceNode && edgeData.sourceNode.modelObject.type === 'EPMConditionTaskTemplate' && edgeData.relationType === 'SuccessPath' ) {
            graph.setLabel( edgeData.edge, 'true' );
        } else if( edgeData.sourceNode && edgeData.sourceNode.modelObject.type === 'EPMValidateTaskTemplate' && edgeData.relationType === 'FailPath' ) {
            graph.setLabel( edgeData.edge, 'ANY' );
        }
        edgeService.drawEdges( [ edgeData ], graphModel, graph, groupGraph, activeLegendView );
        layoutService.clearGraphItemLists();
        layoutService.addEdgeToBeAdded( eventToProcess.edge );
        layoutService.applyGraphLayout( graphModel, true, false, data, data.workflowDgmState );
    } catch ( ex ) {
        removeDummyEdgeOnError( graphModel, eventToProcess.edge );
        logger.error( 'Error in creating edge : ' + ex.message );
    } finally {
        delete _soaCreateEdgeClientIdMap[ clientId ];
    }
};

/**
 * Get the parent object if user is adding task template inside some parent task template
 * other than root ask template then only it will return task template otherwise it will return
 * null as object.
 * @param {Object} ctx Context object
 * @param {Object} createTemplateObject Newly created task template object
 *
 * @returns {Object} Object that need to open itself inside in fixed layout
 */
var _isTaskTemplateOpenObject = function( ctx, createTemplateObject ) {
    var openObject = null;
    var parentValues = _getPropValue( createTemplateObject, 'parent_task_template' );
    var graphModel = ctx.graph.graphModel;
    var startNode = _.find( graphModel.nodeMap, function( node ) {
        return node && node.appData && node.appData.nodeType && node.appData.nodeType === 'start';
    } );
    if( startNode && startNode.modelObject && parentValues && parentValues[ 0 ] &&
        startNode.modelObject.uid !== parentValues[ 0 ] && parentValues[ 0 ] !== '' ) {
        openObject = cdm.getObject( parentValues[ 0 ] );
    }
    return openObject;
};

/**
 * Add the newly created node on graph and update the layout.
 * @param {Obejct} graphModel Graph model object
 * @param {Object} createNodeResponse Newly created template obejct SOA response
 * @param {Object} data Data view model object
 */
export let addNodeOnGraph = function( graphModel, createNodeResponse, data ) {
    var activeLegendView = null;
    var graphContext = appCtxSvc.getCtx( 'graph' );
    if( graphContext && graphContext.legendState ) {
        activeLegendView = graphContext.legendState.activeView;
    }
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var isGroup = false;
    var childCount = 0;

    // Check if SOA response is not valid then return from here
    if( !createNodeResponse || !createNodeResponse.ServiceData || !createNodeResponse.createdorUpdatedObjects ) {
        return;
    }

    // Get the client id and service data and created template object
    var clientId = createNodeResponse.createdorUpdatedObjects[ 0 ].clientID;
    var createdTemplateObject = createNodeResponse.createdorUpdatedObjects[ 0 ].templateObject;
    var createNodeServiceData = createNodeResponse.ServiceData;

    try {
        var eventToProcess = _soaCreateNodeClientIdMap[ clientId ];
        if( !eventToProcess || !eventToProcess.editNode ) {
            return;
        }
        var editNode = eventToProcess.editNode;
        if( !createdTemplateObject || createNodeServiceData && createNodeServiceData.partialErrors ) {
            removeDummyNodeOnError( graphModel, editNode );
            return;
        }

        // Check if we are in fixed layout mode and we are create new template then we need to set the location for new template as well
        // so that it can be rendered correctly.
        if( data.workflowDgmState && data.workflowDgmState.diagram && !data.workflowDgmState.diagram.isAutoLayoutOn ) {
            var position = graph.getBounds( editNode );
            var formattedPositionValues = workflowUtils.formatNodePositionValues( position, null );
            var cliendId =  'updateNode' + new Date().getTime();
            // Create map for location data, to be added at object creation
            var additionalDataMap = {};
            additionalDataMap.location1 = [ formattedPositionValues ];
            var input = [ {
                clientID: cliendId,
                templateToUpdate: createdTemplateObject.uid,
                additionalData: additionalDataMap
            } ];
            var openObject = _isTaskTemplateOpenObject( appCtxSvc.ctx, createdTemplateObject );
            var node = null;
            if ( openObject && openObject.uid ) {
                node = graphModel.nodeMap[ openObject.uid ];
            }
            eventBus.publish( 'workflowDesigner.CreateNodeUpdateEvent', { createInput: input, openObject: openObject, node: node } );

            // If object is not null that means we are in fixed layout and we want to open parent object
            // itself when user is adding children to some task template other than root task template
            if( openObject ) {
                //appCtxSvc.registerCtx( 'workflowDesignerSubTaskTemplateSelection', openObject );
                //workflowUtils.updateURL( { sc_uid: openObject.uid } );
                return;
            }
        }

        if( createdTemplateObject && createdTemplateObject.props.subtask_template && createdTemplateObject.props.subtask_template.dbValues &&
            createdTemplateObject.props.subtask_template.dbValues.length > 0 ) {
            isGroup = true;
            editNode.isChildrenLoadNeeded = true;
            childCount = createdTemplateObject.props.subtask_template.dbValues.length;
        }
        var nodeData = {
            node: editNode,
            nodeId: createdTemplateObject.uid,
            properties: {
                Group: eventToProcess.nodeCategory,
                isGroupNode: isGroup,
                isInteractiveTask: true,
                child_count: childCount
            },
            metaObject: createdTemplateObject
        };
        
        layoutService.clearGraphItemLists();
        layoutService.addNodeToBeAddedWithPosition( editNode );
        layoutService.applyGraphLayout( graphModel, true, false, data, data.workflowDgmState );
        nodeService.drawNodes( [ nodeData ], graphModel, graph, groupGraph, activeLegendView, data );
    } catch ( ex ) {
        removeDummyNodeOnError( graphModel, editNode );
        logger.error( 'Error in creating node : ' + ex.message );
    } finally {
        delete _soaCreateNodeClientIdMap[ clientId ];
    }
};

export default exports = {
    onNodeEditCommitted,
    onNodeEditCancelled,
    getCreateNodeResponse,
    getCreateEdgeResponse,
    onEdgeCreationCancelled,
    showTextEditor,
    templateNodeCreateAction,
    quickEdgeCreateAction,
    addEdgeOnGraph,
    addNodeOnGraph
};
