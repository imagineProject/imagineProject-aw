// Copyright (c) 2022 Siemens

/**
 * This implements the graph edit handler interface APIs defined by aw-graph widget to provide graph authoring
 * functionalities for workflow designer tab
 *
 * @module js/Awp0WorkflowDesignerGraphEditHandler
 */
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import nodeSvc from 'js/Awp0WorkflowDesignerNodeService';
import graphTemplateSvc from 'js/Awp0WorkflowDesignerGraphTemplateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphLegendSvc from 'js/graphLegendService';

var exports = {};

/**
 * Check if input object is of type input type. If yes then
 * return true else return false.
 *
 * @param {Obejct} obj Object to be match
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
 * Check if Object is of not type of OOTB template type other than EPMTaskTemplate
 * then only return true else it will be false
 * @param {Object} modelObject Model object whose type need to be checked
 * @returns {boolean} True/False based on object type
 */
var _isSubTaskCanBeAdded = function( modelObject ) {
    if( modelObject && !isOfType( modelObject, 'EPMReviewTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMAcknowledgeTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMAddStatusTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMConditionTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMDoTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMOrTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMRouteTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMValidateTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMSelectSignoffTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMPerformSignoffTaskTemplate' ) &&
        !isOfType( modelObject, 'EPMNotifyTaskTemplate' ) ) {
        return true;
    }
    return false;
};

/**
 * Function to be called to determine whether can create node at given location.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} contextGroupNode - the clicked group node during node creation.
 * @return {boolean} return true to create node, return false to cancel the node creation
 */
export let canCreateNode = function( graphModel, contextGroupNode ) {
    if( contextGroupNode ) {
        // Check if group node is input and model obejct is not null and type is EPMTaskTemplate or custom task template
        // then only user can add sub task
        if( contextGroupNode.modelObject && _isSubTaskCanBeAdded( contextGroupNode.modelObject ) ) {
            return true;
        }
        return false;
    }
    if( graphModel && graphModel.nodeMap ) {
        var startNode = _.find( graphModel.nodeMap, function( node ) {
            return node && node.appData && node.appData.nodeType && node.appData.nodeType === 'start';
        } );
        if( startNode && startNode.modelObject ) {
            return _isSubTaskCanBeAdded( startNode.modelObject );
        }
    }
    return true;
};

/**
 * Function to be called to tell if the edge was permitted to reconnect
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} updatedEndPoint - the connection end type, could be "source" or "target"
 * @param {Object} edge - the edge to reconnect
 * @return {boolean} flag whether the edge can be reconnected
 */
export let canReconnectEdge = function() {
    return true;
};

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} source - the source whether the edge can be created from
 * @return  {boolean} flag whether the edge can be reconnected
 */
export let canCreateEdgeFrom = function( graphModel, source ) {
    if( !source || !graphModel ) {
        return false;
    }

    if( !_.isEmpty( source.getItemType() ) && source.getItemType() === 'Node' ) {
        return true;
    }
};

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} target - the target whether the edge can be created to
 * @return  {boolean} flag whether the edge can be reconnected
 */
export let canCreateEdgeTo = function( graphModel, target ) {
    if( !target || !graphModel ) {
        return false;
    }

    if( !_.isEmpty( target.getItemType() ) && target.getItemType() === 'Node' ) {
        return true;
    }
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
 * Check if edge can be created between input source and target parent node.
 *
 * @param {Object} sourceNode Source node object
 * @param {Object} sourceModelObject Source node model object
 * @param {Object} targetNode Target node object
 * @param {Object} targetModelObject Target node model object
 * @param {Object} graphModel graph model object
 * @returns {boolean} True/False based on validation
 */
var _isEdgeCreationCriteriaPassed = function( sourceNode, sourceModelObject, targetNode, targetModelObject, graphModel ) {
    var isValidToCreate = false;
    var sourceParentValue = _getParentPropValue( sourceModelObject, 'parent_task_template' );
    var targetParentValue = _getParentPropValue( targetModelObject, 'parent_task_template' );
    var isParentSame = false;
    var isChildParentCase = false;
    var sourceParentObject = null;
    var targetParentObject = null;

    // Check if source parent value and target value value is not null and both are either have same parent
    // or source node parent value is same as target node id or source node id is same as target parent value then
    // set the variable to true.
    // We have template like Start-> Do1 -> Do2 -> Review -> Finish
    // Case 1- User can create from Start to Do1 and not other way.
    // Case 2 - User can connect Do1 to Do2 or Do2 to Do1 but once one conenction exist then another can't be created.
    // Case 3- User can connect from Do task to Review or Review to Do or finish but not to child of Review task.

    // Check if both parent are same then only set this to true.
    if( sourceParentValue && targetParentValue && sourceParentValue === targetParentValue ) {
        isParentSame = true;
    } else if( sourceParentValue === targetModelObject.uid || sourceModelObject.uid === targetParentValue ) {
        // Check if source parent is target or source is target panret that mesans it's a case when user
        // trying to create realtion between child and parent in any direction. This variable will be true
        // for all container tasks but for review, acknowledge or route it will not being used and some additional
        // check will return false.
        isParentSame = true;
        isChildParentCase = true;
        // isChildParentCase variable is needed in case when user is creating the conenction between container task and child task.
    }

    // Get the source parent object if source parent value is not null
    if( sourceParentValue ) {
        sourceParentObject = cdm.getObject( sourceParentValue );
    }

    // Get the target parent object if source parent value is not null
    if( targetParentValue ) {
        targetParentObject = cdm.getObject( targetParentValue );
    }

    // Check if source parent is not null and not of type of these three task types or
    // target parent is not null and not of type of these three task types then only we can create the
    // edge further otherwise return from here.
    // As we don't allow any connection inside these three OOTB task types so to avoid that issue checking  here
    // If user is trying to create connection from SST task to review then also in that case isParentSame variable
    // will be true from earlier checks but with below check it will not process further and return false.
    var ootbTaskArray = [ 'EPMReviewTaskTemplate', 'EPMAcknowledgeTaskTemplate', 'EPMRouteTaskTemplate' ];
    if( sourceParentObject && ootbTaskArray.indexOf( sourceParentObject.type ) > -1 || targetParentObject && ootbTaskArray.indexOf( targetParentObject.type ) > -1 ) {
        return isValidToCreate;
    }

    // Check if both parent the same
    if( isParentSame ) {
        // Check if source or target both are same or edge already exist between source or target then set the valid on edge data
        // to false as edge is already exist.
        if( sourceNode.nodeId !== targetNode.nodeId && graphModel.edgeMap[ sourceNode.nodeId ] !== targetNode.nodeId &&
            sourceModelObject.uid !== targetModelObject.uid ) {
            isValidToCreate = true;
        } else if( isChildParentCase && ( graphModel.edgeMap[ targetNode.nodeId ] !== sourceNode.nodeId ||
                graphModel.edgeMap[ sourceNode.nodeId ] !== targetNode.nodeId ) ) {
            // Above check is needed in case when user is creating the edge from child source node to container task or container task to
            // child target node then this should be allowed as for now we don't have specific start and finish nodes for container task and
            // in that case user want to connect from child to parnet condainter task and then parent coantienr to child node to complete the
            // start and complete flow. isChildParentCase variable will only be true in container case in all other case that variable is false
            // so that user will not allow to create duplicate connection between same parent tasks in all directions.
            isValidToCreate = true;
            // This is mainly needed when there is already one edge created between same source and target then no need
            // to create the edge agaim so setting this variable to false will handle this case. Not touching the above main
            // condition to reduce the imapct of change for container task.
            if( graphModel.edgeMap[ sourceNode.nodeId ] === targetNode.nodeId ) {
                isValidToCreate = false;
            }
        }
    }
    return isValidToCreate;
};

/**
 * Function to get the all inforamtion related to dummy edge
 *
 * @param {object} graphModel - Graph model object
 * @param {object} previewEdge - dummy edge
 * @returns {Object} edge data
 */
var _getEdgeData = function( graphModel, previewEdge ) {
    var edgeData = {};
    edgeData.edge = previewEdge;
    edgeData.valid = false;
    var sourceNode = previewEdge.getSourceNode();
    var targetNode = previewEdge.getTargetNode();
    var sourceModelObject = null;
    var targetModelObject = null;
    if( sourceNode && sourceNode.modelObject ) {
        edgeData.sourceNode = sourceNode;
        sourceModelObject = sourceNode.modelObject;
    }
    if( targetNode && targetNode.modelObject ) {
        edgeData.targetNode = targetNode;
        targetModelObject = targetNode.modelObject;
    }

    // Check if any one of source model obejct or target model object is null then return from here
    // and edge can't be created
    if( !sourceModelObject || !targetModelObject ) {
        return edgeData;
    }

    // Check if user is trying to create the relation from finish node to any other node or from any other node to start node
    // then set the valid on edge data to false and return from here.
    if( sourceNode.appData && sourceNode.appData.nodeType && sourceNode.appData.nodeType === 'finish' ||
        targetNode.appData && targetNode.appData.nodeType && targetNode.appData.nodeType === 'start' ) {
        return edgeData;
    }

    // Check if edge can be created based on certain validations and accordingly set the value to edge data. That value
    // will be used either edge will be created or remove the dummy edge
    edgeData.valid = _isEdgeCreationCriteriaPassed( sourceNode, sourceModelObject, targetNode, targetModelObject, graphModel );

    var graphContext = appCtxSvc.getCtx( 'graph' );
    var creatingSubCategory = null;
    var creatingCategory = graphContext.legendState.creatingCategory;
    // Check if creatingSubCategory present on legend state then use that and if not then check if
    // creatingCategory is not null and then get the authorableSubCategories and use the 0th index
    // sub category to create the relation.
    if( graphContext.legendState.creatingSubCategory ) {
        creatingSubCategory = graphContext.legendState.creatingSubCategory;
    } else if( creatingCategory && creatingCategory.authorableSubCategories
        && creatingCategory.authorableSubCategories[ 0 ] ) {
        creatingSubCategory = creatingCategory.authorableSubCategories[ 0 ];
    }

    // Check if creating sub category is not null then set it correctly for edge creation
    if( creatingSubCategory && creatingCategory ) {
        var subCategoryType = creatingSubCategory.internalName;
        var categoryType = creatingCategory.internalName;
        edgeData.objectTypeToCreate = subCategoryType;
        edgeData.categoryType = categoryType;
    }

    // Check if edge data is valid and edge type is Fail path then do some extra checks as fail path
    // is only allowed between sibling tasks and not with root or container.
    if( edgeData.valid && edgeData.categoryType === 'FailPath' ) {
        var sourceParentValue = _getParentPropValue( sourceModelObject, 'parent_task_template' );
        var targetParentValue = _getParentPropValue( targetModelObject, 'parent_task_template' );
        if( sourceParentValue !== targetParentValue ) {
            edgeData.valid = false;
        }
    }
    return edgeData;
};


/**
 * Function to create edge.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} previewEdge - the preview edge.
 */
export let createEdge = function( graphModel, previewEdge ) {
    var edgeData = {};
    edgeData = _getEdgeData( graphModel, previewEdge );
    // Check if edge data is not null and valid then only go futther to create
    // the edge else remove the dummy edge.
    if( edgeData && edgeData.valid ) {
        eventBus.publish( 'workflowDesigner.edgeCreated', edgeData );
    } else {
        // Remove the dummy edge
        graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
    }
};

/**
 * Get the new node name based on subtask_template property on parent.
 *
 * @param {String} typeDispalyName Type dispaly name
 * @param {Object} parentObject Parent obejct where child will be added
 *
 * @returns {String} New task name string
 */
var _getNewNodeName = function( typeDispalyName, parentObject ) {
    var prefix = '';
    var localTextBundle = localeService.getLoadedText( 'TCUICommandPanelsMessages' );
    if( localTextBundle && localTextBundle.new ) {
        prefix = localTextBundle.new;
    }
    var subTaskObjects = [];

    if( parentObject ) {
        var modelObject = cdm.getObject( parentObject.uid );
        var subTasks = modelObject.props.subtask_template.dbValues;
        if( subTasks && subTasks.length > 0 ) {
            _.forEach( subTasks, function( subTaskUid ) {
                var subTaskObject = cdm.getObject( subTaskUid );
                if( subTaskObject ) {
                    subTaskObjects.push( subTaskObject );
                }
            } );
        }
    }

    var goOn = false;
    var newName = '';
    var truncatedName = prefix + ' ' + typeDispalyName + ' ';
    var count = 1;

    // This code is simialr to RAC code and this is being used to get the
    // New task name. If same name task is already presnet then update the counter
    // to get the new task name.
    for( ;; ) {
        goOn = false;
        newName = truncatedName + count++;
        for( var idx = 0; idx < subTaskObjects.length; idx++ ) {
            if( subTaskObjects[ idx ].props.object_string && subTaskObjects[ idx ].props.object_string.uiValues &&
                subTaskObjects[ idx ].props.object_string.uiValues[ 0 ] === newName ) {
                goOn = true;
                break;
            }
        }

        if( !goOn ) {
            break;
        }
    }
    return newName;
};

/**
 * Function to create node at given location.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} contextGroupNode - the clicked group node during node creation.
 * @param {PointD} location - the location to create node on the sheet coordinate
 */
export let createNode = function( graphModel, contextGroupNode, location ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var legendState = null;
    if( graphContext && graphContext.legendState ) {
        legendState = graphContext.legendState;
    }
    var nodeCategory = '';
    var nodeSubCategoryDisplayName = '';
    var nodeSubCategoryInternalName = '';
    var templateUid = '';
    var nodeStyle;

    if( legendState ) {
        nodeCategory = legendState.creatingCategory.internalName;
        nodeSubCategoryDisplayName = legendState.creatingSubCategory.displayName;
        nodeSubCategoryInternalName = legendState.creatingSubCategory.internalName;
        templateUid = legendState.creatingSubCategory.uid;
        nodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, legendState.activeView );
    }

    var defaultNodeStyle = graphModel.config.defaults.nodeStyle;
    var defaultNodeSize = graphModel.config.defaults.nodeSize;
    var rect = {
        x: location.x,
        y: location.y,
        width: defaultNodeSize.width,
        height: defaultNodeSize.height
    };
    var graph = graphModel.graphControl.graph;

    if( defaultNodeStyle && defaultNodeStyle.templateId ) {
        var templateId = defaultNodeStyle.templateId;
        var registeredTemplate = graphModel.nodeTemplates[ templateId ];
    }
    if( registeredTemplate ) {
        var bindData = registeredTemplate.initialBindData;
        if( nodeStyle ) {
            bindData.node_fill_color = nodeStyle.borderColor;
        }

        // This is needed where template is being added to get the new task name
        var parentTemplate = appCtxSvc.ctx.xrtSummaryContextObject;
        if( contextGroupNode && contextGroupNode.modelObject ) {
            parentTemplate = contextGroupNode.modelObject;
        }
        // Get the new node name
        var nodeName = _getNewNodeName( nodeSubCategoryDisplayName, parentTemplate );
        bindData.Name = nodeName;

        // To adjust the node width for dummy node
        var nodeWidth = 75;
        var widthAdj = 7 * nodeName.length;
        if( nodeName.length < 5 ) {
            widthAdj = 0;
        }
        nodeWidth += widthAdj;
        rect.width = nodeWidth;
        bindData.thumbnail_image = graphTemplateSvc.getUnderConstructionSVGImage();
        var node = graph.createNodeWithBoundsStyleAndTag( rect, registeredTemplate, bindData );
        var nodeData = {};
        nodeData.nodes = [ node ];
        nodeData.nodeType = 'normal';
        nodeData.Group = nodeCategory;
        nodeData.parentNode = contextGroupNode;
        nodeData.objectTypeToCreate = nodeSubCategoryInternalName;
        nodeData.nodeCategory = nodeCategory;
        nodeData.templateUid = templateUid;
    }

    //create node inside group
    if( contextGroupNode ) {
        // Check where user is trying to add the child is not group node already then only convert it
        // to group node. All these checkes are being done in this method
        nodeSvc.convertNodeToParent( graphModel, contextGroupNode );
        graph.update( function() {
            contextGroupNode.addGroupMember( node );
        } );
    } else {
        node.isRoot( true );
    }

    eventBus.publish( 'workflowDesigner.nodeCreated', nodeData );
};

/**
 * API to check whether the graph item can be the target item of the DnD operation
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the graph item under the dragging cursor, null for empty area of the graph
 * @param {String} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {Object[]} outItems - the dragging graph items just out of graph items, the app can update the status when
 *            the DnD out of some graph items.
 * @param {PointD} cursorLocation - the cursor location
 * @return {Boolean} - true if the hoveredGraphItem is a valid droppable graph item, otherwise false
 */
export let onGraphDragOver = function( graphModel, draggingItems, hoveredGraphItem, dragEffect, outItems, cursorLocation ) {
    // Check if connection mode exist then reset it first before doing the drag validation.
    exports.resetConnectionMode( graphModel, graphModel.pathDataProvider );

    // Check if draggingItems is not null and not empty then only check if all create task template category
    // is presnet in input dragging item category then only process further
    if( draggingItems && draggingItems.length > 0 ) {
        var taskTemplateCategory = null;
        var allCategories = appCtxSvc.ctx.graph.legendState.activeView.categoryTypes[0].categories;
        // var taskTemplateCategory = _.find( allCategories, function( category ) {
        //     category.uid === draggingItems[ 0 ];
        // } );
        for( var i = 0; i < allCategories.length; ++i ) {
            if( allCategories[i].subCategories[0].uid ===  draggingItems[ 0 ] ) {
                taskTemplateCategory = allCategories[i].subCategories[0];
            }
        }
        if( !taskTemplateCategory ) {
            return false;
        }
    }
    if( hoveredGraphItem ) {
        // Check if user is trying to drop on node on another node then check that it should not be
        // start or finish node as we can't create children inside that node.
        if( hoveredGraphItem.appData && ( hoveredGraphItem.appData.nodeType === 'start'
        || hoveredGraphItem.appData.nodeType === 'finish' ) ) {
            return false;
        }
        // Check if group node is input and model obejct is not null and type is EPMTaskTemplate or custom task template
        // then only user can add sub task
        if( hoveredGraphItem.modelObject && _isSubTaskCanBeAdded( hoveredGraphItem.modelObject ) ) {
            var groupGraph = graphModel.graphControl.groupGraph;
            if( groupGraph.isGroup( hoveredGraphItem ) && !groupGraph.isExpanded( hoveredGraphItem ) ) {
                return false;
            }
            return true;
        }
        return false;
    }
    var startNode = _.find( graphModel.nodeMap, function( node ) {
        return node && node.appData && node.appData.nodeType && node.appData.nodeType === 'start';
    } );
    if( startNode && startNode.modelObject ) {
        return _isSubTaskCanBeAdded( startNode.modelObject );
    }
    return true;
};

/**
 * Reset the legend state mode state for node and edge.
 * @param {Object} graphModel - the graph model object
 * @param {Object} legendState Legend state object
 */
export let resetRelationCreateLegendState = function( graphModel, legendState ) {
    if( legendState && legendState.creatingCategory && legendState.creatingCategory.categoryType === 'relations' ) {
        legendState.creatingCategory.creationMode = 0;
        if( legendState.creatingSubCategory ) {
            legendState.creatingSubCategory.creationMode = 0;
        }
        graphLegendSvc.updateCreationCategory( graphModel, legendState, legendState.creatingCategory, legendState.creatingSubCategory );
        graphModel.refreshUI();
    }
};

/**
 * API to be called when the graph item being dropped on the targetGraphModel
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the target graph item, null for empty area of the graph
 * @param {String} inputAction - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {PointD} outItems - the cursor location
 * @param {PointD} cursorLocation - the cursor location
 *
 * @return {Boolean} - true if the app handle the gesture normally, otherwise false to let the GC handle it.
 */
export let onGraphDrop = function( graphModel, draggingItems, hoveredGraphItem, inputAction, outItems, cursorLocation ) {
    if( draggingItems && draggingItems.length <= 0 ) {
        return false;
    }
    var allCategories = appCtxSvc.ctx.graph.legendState.activeView.categoryTypes[0].categories;
    // var taskTemplateCategory = _.find( allCategories, function( category ) {
    //     category.uid === draggingItems[ 0 ];
    // } );
    var taskTemplateCategory = null;
    for( var i = 0; i < allCategories.length; ++i ) {
        if( allCategories[i].subCategories[0].uid ===  draggingItems[ 0 ] ) {
            taskTemplateCategory = allCategories[i].subCategories[0];
        }
    }

    if( !taskTemplateCategory || !taskTemplateCategory.parent ) {
        return false;
    }
    var mainCategory = taskTemplateCategory.parent;
    appCtxSvc.ctx.graph.legendState.creatingCategory = mainCategory;
    appCtxSvc.ctx.graph.legendState.creatingSubCategory = taskTemplateCategory;
    exports.createNode( graphModel, hoveredGraphItem, outItems );
};

/**
 * Create the connection path that need to be created.
 * @param {Object} graphModel the graph model object
 * @param {Object} legendState  the legend state object
 * @param {Object} createPath  Create path object that need to be created
 * @param {Object} taskDataProvider Task data provider that will be used to reset task selection
 * @param {Object} pathDataProvider path data provider that will be used to reset task selection
 */
export let createConnectionPath = function( graphModel, legendState, createPath, taskDataProvider, pathDataProvider ) {
    // If create path is null or empty then no need to proceed further and return from here
    if( !createPath || !createPath.uid ) {
        exports.resetRelationCreateLegendState( graphModel, legendState );
        return;
    }

    // Get all categories and find the matching category to create
    var allCategories = appCtxSvc.ctx.graph.legendState.activeView.categoryTypes[1].categories;
    var relationCategory = null;
    for( var i = 0; i < allCategories.length; ++i ) {
        if( allCategories[i].subCategories[0].internalName ===  createPath.uid ) {
            relationCategory = allCategories[i].subCategories[0];
        }
    }
    // var relationCategory = _.find( allCategories, function( category ) {
    //     return category.subCategories[0].internalName === createPath.uid;
    // } );

    // Check if category is not valid then no need to process further. Just
    // reset the state and return from here
    if( !relationCategory || !relationCategory.parent ) {
        exports.resetRelationCreateLegendState( graphModel, legendState );
        return;
    }

    // Reset the task selection in task data provider and reset the relation creation mode
    exports.resetConnectionMode( graphModel, taskDataProvider );

    // Set the path data provider on graph model as this will be used when user is doing task drag and drop
    // then we need to clear path selection.
    graphModel.pathDataProvider = pathDataProvider;
    var mainCategory = relationCategory.parent;
    mainCategory.creationMode = 1;
    legendState.creatingCategory = relationCategory.parent;
    legendState.creatingSubCategory = relationCategory;
    graphLegendSvc.updateCreationCategory( graphModel, legendState, mainCategory, relationCategory );

    graphModel.refreshUI();
};

/**
 * Reset the connection mode and reset it on legend create state as well.
 * @param {Object} graphModel the graph model object
 * @param {Object} dataProvider  Data provider where selection need to reset
 *
 */
export let resetConnectionMode = function( graphModel, dataProvider ) {
    // Reset the selection in input data provider and reset the relation creation mode
    var resetDataProvider = dataProvider;
    // If input data provider is null and we already have some path selected in legend panel
    // then while legend panel is up and user apply the layout or expand in fixed layout we need
    // to reset the selection for path in legend panel. So to fix this added below code for defect # LCS-341575
    if( !dataProvider && graphModel.pathDataProvider ) {
        resetDataProvider = graphModel.pathDataProvider;
    }
    if( resetDataProvider ) {
        if( resetDataProvider.selectionModel ) {
            resetDataProvider.selectNone();
        }
        resetDataProvider.selectedObjects = [];
    }
    // Reset the relation creation mode first if set already and then fire the event to reset the
    // conenction path value to empty.
    exports.resetRelationCreateLegendState( graphModel, appCtxSvc.ctx.graph.legendState );
};

export default exports = {
    canCreateNode,
    canReconnectEdge,
    canCreateEdgeFrom,
    canCreateEdgeTo,
    createEdge,
    createNode,
    onGraphDragOver,
    resetRelationCreateLegendState,
    onGraphDrop,
    createConnectionPath,
    resetConnectionMode
};
