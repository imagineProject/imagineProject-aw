// Copyright (c) 2022 Siemens

/**
 * This implements the graph edit handler interface APIs defined by aw-graph widget to provide graph authoring
 * functionalities for Network tab
 *
 * @module js/Awp0WorkflowDesignerGraphService
 */
import appCtxSvc from 'js/appCtxService';
import graphLegendManager from 'js/Awp0WorkflowDesignerGraphLegendManager';
import cdmService from 'soa/kernel/clientDataModel';
import nodeService from 'js/Awp0WorkflowDesignerNodeService';
import edgeService from 'js/Awp0WorkflowDesignerEdgeService';
import policySvc from 'soa/kernel/propertyPolicyService';
import awGraphService from 'js/awGraphService';
import selectionService from 'js/Awp0WorkflowDesignerSelectionService';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import Awp0WorkflowDesignerLayoutService from 'js/Awp0WorkflowDesignerLayoutService';
import Awp0WorkflowDesignerGraphEditHandler from 'js/Awp0WorkflowDesignerGraphEditHandler';
import Awp0WorkflowDesignerAutoLayoutHandler from 'js/Awp0WorkflowDesignerAutoLayoutHandler';
import tcVmoService from 'js/tcViewModelObjectService';
import graphConstants from 'js/graphConstants';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import graphSaveSvc from 'js/Awp0WorkflowDesignerGraphSaveService';
import editService from 'js/Awp0WorkflowAssignmentEditService';
import { DOMAPIs as dom } from 'js/domUtils';

var exports = {};

var workflowPropertyPolicy = null;

/**
  * Set the graph configuration based on layout.
  *
  * @param {String} layout Layout option that will be applied on graph
  * @param {Object} graphModel Graph model object where layout configuration will be set
  */
var _setDiagramConfigForLayout = function( layout, graphModel ) {
    if( layout === 'FixedLayout' ) {
        graphModel.graphControl.setAutoRoutingType( graphConstants.AutoRoutingtype.STRAIGHT_LINE );
        graphModel.graphControl.setGroupNodeBoundaryUpdateMode( false );
        graphModel.graphControl.setMinSegmentLength( 0 );
    } else {
        graphModel.graphControl.setAutoRoutingType( graphConstants.AutoRoutingtype.HV_SEGMENT3 );
        graphModel.graphControl.setGroupNodeBoundaryUpdateMode( true );
    }
};

/**
  * Get the value of the preference WRKFLW_preferred_diagram_layout and apply to the graph
  */
var _setInitialContextFromPreference = function( state ) {
    var selectionLayoutDirection = 'GcLeftToRightLayout';
    var isAutoLayout = true;
    if( appCtxSvc.ctx.preferences ) {
        selectionLayoutDirection = appCtxSvc.ctx.preferences.WRKFLW_preferred_diagram_layout[0];
        if ( selectionLayoutDirection === 'FixedLayout' ) {
            isAutoLayout = false;
        }
    }
    // Get the preferred workflow diagram preference value and based on the value set the values
    // on context object so that it can be used to render graph correctly.
    state.diagram.layoutOption = selectionLayoutDirection;
    state.diagram.isAutoLayoutOn = isAutoLayout;
};

/**
  * Return the true or false based on auto layout is on or off.
  *
  * @returns {boolean} True or False
  */
var _isFixedLayoutMode = function( data, state ) {
    if( data && data.workflowDgmState && data.workflowDgmState.diagram ) {
        return !data.workflowDgmState.diagram.isAutoLayoutOn;
    }
    return false;
};

/**
  * Draw the nodes and edges on the graph.
  *
  * @param {Object} data Declarative view model object
  * @param {Object} graphModel Graph model object
  * @param {Object} selTemplate Selected root process template object
  * @param {Object} node Node whose children need to be shown on graph
  */
var _drawGraph = function( data, graphModel, selTemplate, node, state ) {
    //Make sure edge routing type is angled line
    //data.graphModel.config.autoEdgeRoutingType = 'HV_SEGMENT3';

    var activeLegendView = null;
    var graphContext = appCtxSvc.getCtx( 'graph' );
    if( graphContext && graphContext.legendState ) {
        activeLegendView = graphContext.legendState.activeView;
    }
    if( !graphModel || !graphModel.graphControl || !graphModel.graphControl.graph || !graphModel.graphControl.groupGraph ) {
        return;
    }
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;

    // Check if workflowOutput is empty then no need to process futher
    // and return from here
    if( typeof data.workflowOutput === typeof undefined ) {
        return;
    }

    // Poupulate the node and edge data to show on graph
    var returnData = nodeService.populateNodeData( selTemplate, data.workflowOutput.elementData, node );
    if( returnData && returnData.nodeObjects && returnData.nodeDataMap ) {
        var addedNodes = returnData.nodeObjects;
        var addedEdges = edgeService.populateEdgeData( data.workflowOutput.edgeData, returnData.nodeDataMap, selTemplate, node );
        nodeService.drawNodes( addedNodes, graphModel, graph, groupGraph, activeLegendView, data, selTemplate.workflowDgmState, state );
        edgeService.drawEdges( addedEdges, graphModel, graph, groupGraph, activeLegendView );
    }

    // This is needed to expand the node which is just being created to show its children
    if( node && !_isFixedLayoutMode( data, state ) ) {
        node.setGroupingAllowed( true );
        groupGraph.setExpanded( node, true );
        var updateBindData = {};
        updateBindData.Awp0ToggleChildren_selected = !node.getProperty( 'Awp0ToggleChildren_selected' );
        updateBindData.Awp0ToggleChildren_tooltip = data.i18n.hideChildren;
        updateBindData.child_count = '';
        if( node.appData.childCount ) {
            updateBindData.child_count = '';
        }
        graphControl.graph.updateNodeBinding( node, updateBindData );
    }

    graph.updateOnItemsAdded();

    //Update grid setting
    if ( graphModel && graphModel.graphControl && graphModel.graphControl.grid && graphModel.graphControl.grid.preferences ) {
        var preferences = graphModel.graphControl.grid.preferences;
        var workflowDiagramGridPreference = appCtxSvc.getCtx( 'workflowDiagramGridPreference' );
        if( preferences && workflowDiagramGridPreference ) {
            var graph = graphModel.graphControl.graph;
            graph.update( function() {
                preferences.enabled = workflowDiagramGridPreference.gridOptions;
                preferences.showMajorLines = workflowDiagramGridPreference.majorLines;
                preferences.showMinorLines = workflowDiagramGridPreference.minorLines;
            } );
        }
    }
};

/**
  * Apply the layout on the graph
  * @param {Object} graphModel Graph model object
  */
var _applyGraphLayout = function( graphModel ) {
    if( !graphModel || !graphModel.graphControl ) {
        return;
    }

    //the layout is initialized by GC by default, it's directly available
    var layout = graphModel.graphControl.layout;
    if( layout ) {
        //need apply global layout first for incremental update
        layout.applyLayout();
        layout.activate( true );
    }
};

export let applyGraphLayout = function( graphModel ) {
    _applyGraphLayout( graphModel );
};


/**
  * Return the applied layout option on the diagram. If no layout is applied then by
  * default it will return 'GcLeftToRightLayout' layout option.
  *
  * @returns {String} Default layout string.
  */
var _getAppliedLayoutOption = function( state ) {
    if( state && state.diagram && state.diagram.layoutOption ) {
        return state.diagram.layoutOption;
    }
    return null;
};

/**
  * Method to draw graph that will be shown on the canvas.
  * @param {Object} data Declarative view model object
  * @param {Object} node Node object whose children need to be loaded
  * @param {Object} modelObject the model object
  * @param {Object} a_graphModel graph model
  */
export let drawGraph = function( data, node, modelObject, a_graphModel ) {
    const state = { ...data.workflowDgmState };

    // Check if we are drawing the graph after doing the start edit then we need to show
    // the graph in layout before start edit action so check if that information is present then
    // set the initial graph layout option and then unregister it from context.
    var previousLayout;
    if( appCtxSvc.ctx && appCtxSvc.ctx.startEditGraphLayout ) {
        previousLayout = appCtxSvc.ctx.startEditGraphLayout;
        appCtxSvc.unRegisterCtx( 'startEditGraphLayout' );
    } else if( appCtxSvc.ctx && appCtxSvc.ctx.initializeLayoutFromPreference ) {
        _setInitialContextFromPreference( state );
        appCtxSvc.unRegisterCtx( 'initializeLayoutFromPreference' );
    } else if( appCtxSvc.ctx && appCtxSvc.ctx.workflowDgmState ) {
        previousLayout = appCtxSvc.ctx.workflowDgmState.diagram.layoutOption;
    } else {
        previousLayout = 'GcLeftToRightLayout';
    }
    if( previousLayout ) {
        var isPrevAutoLayout = true;
        if( previousLayout === 'FixedLayout' ) {
            isPrevAutoLayout = false;
        }
        state.diagram.layoutOption = previousLayout;
        state.diagram.isAutoLayoutOn = isPrevAutoLayout;
    }

    var isFixedLayout = _isFixedLayoutMode( data, state );
    var layout = _getAppliedLayoutOption( state );
    if ( isFixedLayout ) {
        return exports.drawGraphFixedLayout( data, node, modelObject, a_graphModel, state );
    }
    var graphModel = data.graphModel;
    var isClearGraph = false;
    if( !graphModel.nodeMap ) {
        graphModel.nodeMap = {};
        isClearGraph = true;
    }
    if( !graphModel.edgeMap ) {
        graphModel.edgeMap = {};
    }
    if( !graphModel.categoryApi ) {
        graphLegendManager.initGraphCategoryApi( graphModel );
    }
    // Get the layout to check if it's fixed layout that means all layout will be disabled and we need
    // to set differnt edge routing algorithm.
    _setDiagramConfigForLayout( layout, graphModel );
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
    // Get the root process template whose details need to be shown
    var selTemplate = cdmService.getObject( appCtxSvc.ctx.xrtSummaryContextObject.uid );
    if( selTemplate && state && !state.selectedObject ) {
        selectionService.setSourceObject( selTemplate );
        state.selectedObject = selTemplate;
    }
    //copy properties from model object to xrtSummaryContextObject
    tcVmoService.mergeObjects( appCtxSvc.ctx.xrtSummaryContextObject, selTemplate );
    // Draw the data on the graph
    _drawGraph( data, graphModel, selTemplate, node, state );
    // This is when user trying to expand created node where child info is
    // not present in the graph alreay so draw these nodes and expand the created group node.
    if( node ) {
        Awp0WorkflowDesignerLayoutService.addGroupNodeToExpand( node );
        Awp0WorkflowDesignerLayoutService.applyGraphLayout( graphModel, true, true );
        return;
    }
    // Get the default layout option and apply on the graph
    var defaultLayout = _getAppliedLayoutOption( state );
    if( graphModel && graphModel.graphControl ) {
        _applyGraphLayout( graphModel );
        graphModel.graphControl.fitGraph();
        if( defaultLayout && defaultLayout !== 'FixedLayout' ) {
            awGraphService.setActiveLayout( graphModel, defaultLayout );
        }
        exports.setGraphEditMode( selTemplate, appCtxSvc.ctx );
    }
    state.diagram.isAutoLayoutOn = true;
    state.diagram.layoutOption = defaultLayout;
    // If we are creating new process or task template then task palette panel should be open by default
    if( graphModel && appCtxSvc.ctx &&  appCtxSvc.ctx.openTaskPalette && appCtxSvc.ctx.graph
         && appCtxSvc.ctx.graph.legendState ) {
        //Fix for defect # LCS-662284 . This is remporary fix and need to be handle more better way.
        // Check if graph is in edit mode then we set taskLegendPaletteMode mode to true
        state.taskLegendPaletteMode = true;
        appCtxSvc.unRegisterCtx( 'openTaskPalette' );
        exports.showTaskLegendPalettePanel( data, graphModel, appCtxSvc.ctx.graph.legendState );
    }

    // Set the default selection on graph. If any sc_uid present in URL that node need to be selected by default.
    selectionService.setDefaultGraphSelection( data, state.selectedObject, appCtxSvc.ctx.state.params );
    return state;
};

/**
  * Return the true or false based on template has sub task or not
  *
  * @param {Object} templateObject Template object whose children need to be loaded
  *
  * @returns {boolean} True or False
  */
var _hasChildren = function( templateObject ) {
    if( templateObject.props && templateObject.props.subtask_template && templateObject.props.subtask_template.dbValues &&
         templateObject.props.subtask_template.dbValues.length > 0 ) {
        return true;
    }
    return false;
};

/**
  * Populate the breadcrumb data in order with parent task template and return the final breadcrumb data.
  *
  * @param {String} selectedCrumbUid Selected crumb uid that need to be shown on graph
  * @param {String} rootTemplateUid Root task template uid
  *
  * @returns {Array} Breadcrumb data array
  */
var _populateBreadCrumbData = function( selectedCrumbUid, rootTemplateUid ) {
    var taskTemplate = cdmService.getObject( selectedCrumbUid );
    var breadCrumb = [];
    var hierarchy = [];

    var loop = true;
    while( loop ) {
        var inputParent = taskTemplate;
        if( inputParent && inputParent.props.parent_task_template && inputParent.props.parent_task_template.dbValues
             && inputParent.props.parent_task_template.dbValues[ 0 ] ) {
            hierarchy.push( inputParent );
            var parentObject = cdmService.getObject( inputParent.props.parent_task_template.dbValues[0] );
            if( parentObject ) {
                hierarchy.push( parentObject );
            }
            taskTemplate = parentObject;
        } else if( inputParent && rootTemplateUid === inputParent.uid ) {
            hierarchy.push( inputParent );
            loop = false;
        }
    }
    hierarchy = _.uniq( hierarchy );
    var hierarchyArray = _.reverse( hierarchy );
    // Create the breadcrumb data that need to be shown.
    if( hierarchyArray && hierarchyArray.length > 0 ) {
        _.forEach( hierarchyArray, function( hierarchy ) {
            if( hierarchy && hierarchy.props.object_string.uiValues && hierarchy.props.object_string.uiValues[ 0 ] ) {
                // Check if tempalte has no children then set the boolean to false so that breadcrumb arrow will nto be shown.
                var hasChildren = _hasChildren( hierarchy );
                breadCrumb.push( {
                    clicked: false,
                    displayName: hierarchy.props.object_string.uiValues[0],
                    selectedCrumb: false,
                    showArrow: hasChildren,
                    scopedUid: hierarchy.uid,
                    template: hierarchy
                } );
            }
        } );
    }
    // Set the last crumb as selected by default
    if( breadCrumb && breadCrumb.length > 0 ) {
        breadCrumb[ breadCrumb.length - 1 ].selectedCrumb = true;
    }
    return breadCrumb;
};


/**
  * Fixed Layout Method to draw graph that will be shown on the canvas.
  * @param {Object} data Declarative view model object
  * @param {Object} node Node object whose children need to be loaded
  */
export let drawGraphFixedLayout = function( data, node, modelObject, a_graphModel, state ) {
    var graphModel = data.graphModel;

    if( !graphModel ) {
        graphModel = a_graphModel;
    }
    var isClearGraph = false;
    var eventMap = data.eventMap;
    // Check if load children values present then we need to check that and based on that breadcrumb
    // will be updated.
    var mapValue = eventMap[ 'workflowDesigner.loadChildren' ];
    if( !graphModel.nodeMap || graphModel.nodeMap === {} || modelObject || mapValue ) {
        graphModel.nodeMap = {};
        isClearGraph = true;
    }
    if( !graphModel.edgeMap || modelObject ) {
        graphModel.edgeMap = {};
    }
    if( !graphModel.categoryApi ) {
        graphLegendManager.initGraphCategoryApi( graphModel );
    }
    _setDiagramConfigForLayout( 'FixedLayout', graphModel );

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

    var selTemplate;
    var childMapNode;
    if( mapValue ) {
        childMapNode = mapValue.node;
    }

    var selectedSubTask;
    if ( data && data.workflowDgmState && data.workflowDgmState.subTaskTemplateSelection ) {
        selectedSubTask = data.workflowDgmState.subTaskTemplateSelection;
    }

    if( selectedSubTask ) {
        selTemplate = selectedSubTask;
        node = childMapNode;

        var keySelectedCrumb = parseInt( _.findKey( data.provider.crumbs, {
            scopedUid: selectedSubTask.uid
        } ) );

        if( keySelectedCrumb === -1 || isNaN( keySelectedCrumb ) ) {
            //add the selected task to the end of the breadcrumb
            var currentCrumbs = data.provider.crumbs;
            var showArrow = _hasChildren( selectedSubTask );

            var newCrumb = {
                clicked: false,
                displayName: selectedSubTask.props.object_string.uiValues[ 0 ],
                selectedCrumb: false,
                showArrow: showArrow,
                scopedUid: selectedSubTask.uid,
                template: selectedSubTask
            };

            _.forEach( currentCrumbs, function( crumb ) {
                crumb.selectedCrumb = false;
                crumb.showArrow = true;
            } );

            currentCrumbs.push( newCrumb );
        }
        appCtxSvc.unRegisterCtx( 'workflowDesignerCrumbSelectionUid' );
    } else {
        // Get the root process template whose details need to be shown
        selTemplate = cdmService.getObject( appCtxSvc.ctx.xrtSummaryContextObject.uid );
        //copy properties from model object to xrtSummaryContextObject
        tcVmoService.mergeObjects( appCtxSvc.ctx.xrtSummaryContextObject, selTemplate );
    }

    // Draw the data on the graph
    _drawGraph( data, graphModel, selTemplate, node, state );

    delete eventMap[ 'workflowDesigner.loadChildren' ];

    if( graphModel && graphModel.graphControl ) {
        graphModel.graphControl.fitGraph();
        exports.setGraphEditMode( appCtxSvc.ctx.xrtSummaryContextObject, appCtxSvc.ctx );
    }
    var provider = {
        crumbs: data.provider.crumbs,
        onSelect: function( data ) {
            if( data.scopedUid ) {
                appCtxSvc.registerCtx( 'workflowDesignerCrumbSelectionUid', data.scopedUid );
                Awp0WorkflowDesignerUtils.updateURL( { sc_uid: data.scopedUid } );
            }
        }
    };

    data.provider = provider;
    // Have the updated final breadcrumb here
    data.provider.crumbs = _populateBreadCrumbData( selTemplate.uid, appCtxSvc.ctx.xrtSummaryContextObject.uid );

    // Set the default selection as current selected object from primary work area
    if( selTemplate ) {
        selectionService.setSourceObject( selTemplate );
        if( state ) {
            state.selectedObject = selTemplate;
            state.diagram.isAutoLayoutOn = false;
            state.diagram.layoutOption = 'FixedLayout';
        }
    }

    // If we are creating new process or task template then task palette panel should be open by default
    if( graphModel && appCtxSvc.ctx &&  appCtxSvc.ctx.openTaskPalette && appCtxSvc.ctx.graph
        && appCtxSvc.ctx.graph.legendState ) {
        data.workflowDgmState.taskLegendPaletteMode = true;
        appCtxSvc.unRegisterCtx( 'openTaskPalette' );
        exports.showTaskLegendPalettePanel( data, graphModel, appCtxSvc.ctx.graph.legendState );
    }

    var graphControl = graphModel.graphControl;
    var gridPreferences = graphControl.grid.preferences;
    var alignPreferences = graphControl.alignment.preferences;
    var graph = graphModel.graphControl.graph;
    var layout = graphModel.graphControl.layout;

    if( layout ) {
        layout.deactivate();
        graph.update( function() {
            //Enable auto alignment on auto layout OFF
            gridPreferences.enableSnapping = true;
            alignPreferences.enabled = true;
        } );
    }

    // Set the default selection on graph. If any sc_uid present in URL that node need to be selected by default.
    selectionService.setDefaultGraphSelection( data, selTemplate, appCtxSvc.ctx.state.params );

    // When graph rendering is done then add the updated info on context object and return
    // the updated context object. Once graph is rendered we reset the variable to false
    // so that SOA will not be called again. We are using onUpdateHook on this variable
    // so when this variable is true, it will call soa to render the graph.
    const workflowDesignerCtx = { ...data.workflowDgmState };
    workflowDesignerCtx.isReloadGraph = false;
    workflowDesignerCtx.renderGraphContextObjectUid = '';
    // Below variable is mainly going to build the breadcrumb in case of fixed layout.
    workflowDesignerCtx.rootTaskObject = selTemplate;

    // Remove subtask selection if required
    if ( !selectedSubTask ) {
        workflowDesignerCtx.subTaskTemplateSelection = null;
    }
    return workflowDesignerCtx;
};

/**
  * This method will update the workflow page.
  * @param {Object} ctx the context object
  * @param {Object} data the data object
  */
export let updateWorkflowDesignerPage = function( ctx, data ) {
    var graphModel;
    if( data && data.provider && data.provider.crumbs && ctx.workflowDesignerCrumbSelectionUid ) {
        //clear the graph
        graphModel = data.graphModel;
        graphModel.nodeMap = null;
        graphModel.edgeMap = null;
        var selectedCrumbUid = ctx.workflowDesignerCrumbSelectionUid;

        // Populate the final breadcrumb data
        data.provider.crumbs = _populateBreadCrumbData( ctx.workflowDesignerCrumbSelectionUid, ctx.xrtSummaryContextObject.uid );
        var selectedTaskTemplate = cdmService.getObject( selectedCrumbUid );

        if( selectedTaskTemplate ) {
            //appCtxSvc.registerCtx( 'workflowDesignerSubTaskTemplateSelection', selectedTaskTemplate );

            eventBus.publish( 'workflowDesigner.loadChildren',  {
                object: selectedTaskTemplate,
                node: null
            } );
            // Fire this event to reset the connection if already selected in legend panel
            eventBus.publish( 'workflowDesigner.resetConnectionMode' );

            return;
        }
    } else if( ctx && ctx.graph && ctx.graph.graphModel ) {
        graphModel = ctx.graph.graphModel;
        graphModel.nodeMap = null;
        graphModel.edgeMap = null;
    }

    eventBus.publish( 'workflowDesigner.legendInitialized' );
};

/**
  * Method to get whether workflow task legend panel Mode is On
  * @param {Object} data object
  * @return {boolean} true when workflow task legend panel Mode is On, false otherwise
  */
var _isLegendPanelActive = function( data ) {
    if( data && data.workflowDgmState.taskLegendPaletteMode ) {
        return data.workflowDgmState.taskLegendPaletteMode;
    }
    return false;
};

/**
  * Register workflow properties
  */
export let registerPropPolicy = function() {
    var policy = {
        types: [ {
            name: 'EPMTaskTemplate',
            properties: [ {
                name: 'template_name'
            },
            {
                name: 'object_string'
            },
            {
                name: 'subtask_template'
            },
            {
                name: 'parent_task_template'
            },
            {
                name: 'template_classification'
            }
            ]
        } ]
    };
    workflowPropertyPolicy = policySvc.register( policy );
};

/**
  * Unregister workflow properties
  */
export let unRegisterPropPolicy = function() {
    if( workflowPropertyPolicy ) {
        policySvc.unregister( workflowPropertyPolicy );
        workflowPropertyPolicy = null;
    }
    var workflowDgmCtx = appCtxSvc.getCtx( 'workflowDgmCtx' );
    if( workflowDgmCtx ) {
        appCtxSvc.unRegisterCtx( 'workflowDgmCtx' );
    }
};

var incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

var layoutActive = function( layout ) {
    return incUpdateActive( layout );
};

// Move elements with incremental / sorted layout update
var _moveElements = function( movedNodes, layout ) {
    if( layoutActive( layout ) && movedNodes.length > 0 ) {
        layout.applyUpdate( function() {
            _.forEach( movedNodes, function( node ) {
                layout.moveNode( node );
            } );
        } );
    }
};

/**
  * Apply the layout when user is trying to move the nodes in the graph.
  *
  * @param {Array} items Graph items that will be moved
  * @param {Object} graphModel Graph model object
  */
export let graphItemsMoved = function( items, graphModel, data ) {
    var movedNodes = [];
    const state = { ...data.workflowDgmState };
    var isFixedLayout = _isFixedLayoutMode( data, state );

    if( items ) {
        items.forEach( function( element ) {
            if( element.getItemType() === 'Node' ) {
                movedNodes.push( element );
            }
        } );
        var layout = graphModel.graphControl.layout;
        if ( !isFixedLayout ) {
            _moveElements( movedNodes, layout );
        }
    }
    if ( isFixedLayout ) {
        graphSaveSvc.saveGraphPositions( null );
    }
};

/**
  * Check and save the nodes positions present in the graph.
  */
export let checkAndUpdateWorkflowDesignerPage = function() {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    var graph = graphControl.graph;
    var totalNodesInGraph = graph.getNodes();
    var emptyLocationNodes = [];
    _.forEach( totalNodesInGraph, function( node ) {
        var modelObject = node.modelObject;
        var propToCheck = 'location1';
        // For start and finish node check start node or complete node location and check if proeprty value exist
        // then no need to save it again.
        if( node.appData && ( node.appData.nodeType === 'finish' || node.appData.nodeType === 'start' ) ) {
            if( node.appData.nodeType === 'finish' ) {
                propToCheck = 'complete_node_location';
            } else if( node.appData.nodeType === 'start' ) {
                propToCheck = 'start_node_location';
            }
        }
        if( modelObject && modelObject.props && modelObject.props[ propToCheck ] ) {
            var location1 = modelObject.props[ propToCheck ];
            var locationArray = location1.dbValues[0].split( ',' );
            var locationX = parseInt( locationArray[0], 10 );
            var locationY = parseInt( locationArray[1], 10 );
            if( locationX === 0 && locationY === 0 ) {
                emptyLocationNodes.push( node );
            }
        }
    } );
    // Check if array is empty then no need to process anything
    if( emptyLocationNodes.length <= 0 ) {
        return;
    }
    if( emptyLocationNodes.length ===  totalNodesInGraph.length ) {
        graphSaveSvc.saveGraphPositions( null );
    } else {
        graphSaveSvc.saveGraphPositions( emptyLocationNodes );
    }
};

/**
  * Toggle child node expand for the given node
  *
  * @param {Object} graphModel Graph model object
  * @param {Object} node  which user is trying to expand or collapse
  * @param {Object} data Data vie wmodel object
  * @param {Object} subPanelContext subpanel context object
  */
export let expandChildren = function( graphModel, node, workflowDgmState, data ) {
    // Check if node is not null and child load is needed then fire the event
    // to load the children and return from here
    var eventMap = data.eventMap;
    delete eventMap[ 'workflowDesigner.CreateNodeUpdateEvent' ];

    var isFixedLayout = _isFixedLayoutMode( data );
    if( node && isFixedLayout && node.modelObject ) {
        appCtxSvc.registerCtx( 'workflowDesignerCrumbSelectionUid', node.modelObject.uid );
        var uidToCheck = null;
        // Check if URL is already updated with task which is going to expand then directly fire the event to load the children
        // else update the URL and graph will be updated through update graph URL mechanism.
        if( appCtxSvc.ctx.state && appCtxSvc.ctx.state.params && appCtxSvc.ctx.state.params.sc_uid ) {
            uidToCheck = appCtxSvc.ctx.state.params.sc_uid;
        }
        Awp0WorkflowDesignerUtils.updateURL( { sc_uid: node.modelObject.uid } );
        // if( uidToCheck === node.modelObject.uid ) {
        // Get the edit handler and if not null then save the edits if any edit is done before applying the layout
        var editHandler = editService.getActiveEditHandler();
        if( editHandler && editHandler.isDirty() ) {
            editHandler.saveEdits();
        }
        eventBus.publish( 'workflowDesigner.loadChildren', {
            object: node.modelObject,
            node: null
        } );

        node.isChildrenLoadNeeded = null;
        //}

        // Fire this event to reset the connection if already selected in legend panel
        eventBus.publish( 'workflowDesigner.resetConnectionMode' );
        const workflowDesignerCtx = { ...workflowDgmState };
        workflowDesignerCtx.renderObject = node.appData.nodeObject;
        workflowDesignerCtx.renderGraphContextObjectUid = node.appData.nodeObject.uid;
        workflowDesignerCtx.isReloadGraph = true;
        workflowDesignerCtx.subTaskTemplateSelection = node.appData.nodeObject;
        return workflowDesignerCtx;
    } else if( node && node.isChildrenLoadNeeded ) {
        eventBus.publish( 'workflowDesigner.loadChildren', {
            object: node.modelObject,
            node: node
        } );
        node.isChildrenLoadNeeded = null;
        return;
    }

    if ( isFixedLayout ) {
        // display the selected task in the viewer
        var newNode;
        var taskTemplateModelObject = node.modelObject;
        exports.drawGraph( data, newNode, taskTemplateModelObject, graphModel );
    } else {
        // Check if input graphModel and node is not null then process further
        // to expand or collapse the child on the node
        if( graphModel && node ) {
            var graphControl = graphModel.graphControl;
            var groupGraph = graphControl.groupGraph;
            var isExpanded = groupGraph.isExpanded( node );
            groupGraph.setExpanded( node, !isExpanded );

            //update command selection state
            var updateBindData = {};
            updateBindData.Awp0ToggleChildren_selected = !node.getProperty( 'Awp0ToggleChildren_selected' );
            updateBindData.Awp0ToggleChildren_tooltip = isExpanded ? data.i18n.showChildren :
                data.i18n.hideChildren;
            updateBindData.child_count = '';
            if( node.appData.childCount ) {
                updateBindData.child_count = isExpanded ? node.appData.childCount : '';
            }
            graphControl.graph.updateNodeBinding( node, updateBindData );

            if( isExpanded ) {
                Awp0WorkflowDesignerLayoutService.addGroupNodesToCollapse( node );
            } else {
                Awp0WorkflowDesignerLayoutService.addGroupNodeToExpand( node );
            }
            Awp0WorkflowDesignerLayoutService.applyGraphLayout( graphModel, true, true );
            // Pan to view in auto layout in expand or collapse cases.
            graphControl.panToView( [ node ], graphConstants.PanToViewOption.AUTO );
        }
    }
};

/**
  * Populate the properties from context values and set the correct property values and return those
  * updated property widgets.
  * @param {Object} showGridData Show grid property widget
  * @param {Object} majorLines Major lines property widget
  * @param {Object} minorLines Minor lines property widget
  * @param {Object} gridSettingContext Grid setting context object
  * @returns {Object} Updated property object with updated property values
  */
export let populateGridSettingPanelData = function( showGridData, majorLines, minorLines, gridSettingContext ) {
    const showGridDataProp = { ...showGridData };
    const majorLinesProp = { ...majorLines };
    const minorLinesProp = { ...minorLines };
    if( gridSettingContext ) {
        showGridDataProp.dbValue = gridSettingContext.gridOptions;
        majorLinesProp.dbValue = gridSettingContext.majorLines;
        minorLinesProp.dbValue = gridSettingContext.minorLines;
    }
    return {
        showGridData : showGridDataProp,
        majorLines : majorLinesProp,
        minorLines : minorLinesProp
    };
};

/*
  * Update Grid Setting
  *
  * @param {data} data - The qualified data of the viewModel
  */
export let applyGridSetting = function( data ) {
    var graphModel = appCtxSvc.ctx.graph.graphModel;
    var preferences = graphModel.graphControl.grid.preferences;
    if( preferences ) {
        var graph = graphModel.graphControl.graph;
        graph.update( function() {
            preferences.enabled = data.showGridData.dbValue;
            preferences.showMajorLines = data.majorLines.dbValue;
            preferences.showMinorLines = data.minorLines.dbValue;
        } );
    }

    // Update the context information with grid infomation
    var workflowDiagramGridPreference = appCtxSvc.getCtx( 'workflowDiagramGridPreference' );
    if( workflowDiagramGridPreference ) {
        workflowDiagramGridPreference.gridOptions = data.showGridData.dbValue;
        workflowDiagramGridPreference.majorLines = data.majorLines.dbValue;
        workflowDiagramGridPreference.minorLines = data.minorLines.dbValue;
        appCtxSvc.updateCtx( 'workflowDiagramGridPreference', workflowDiagramGridPreference );
    } else {
        workflowDiagramGridPreference = {
            gridOptions: data.showGridData.dbValue,
            majorLines: data.majorLines.dbValue,
            minorLines: data.minorLines.dbValue,
            lineStyle: ''
        };
        appCtxSvc.registerCtx( 'workflowDiagramGridPreference', workflowDiagramGridPreference );
    }
};

/**
  * Set the graph model edit mode based on process template is under construction or not.
  *
  * @param {Object} selectedProcessTemplate Process template for diagram is shown
  * @param {Object} ctx Context object
  */
export let setGraphEditMode = function( selectedProcessTemplate, ctx ) {
    var enableEdit = false;
    // Check if template is under construction or not and if yes then set edit mode
    // to true on graph
    if( Awp0WorkflowDesignerUtils.isTemplateEditMode( selectedProcessTemplate, ctx ) ) {
        enableEdit = true;
    }

    if( ctx.graph && ctx.graph.graphModel && ctx.graph.graphModel.config ) {
        ctx.graph.graphModel.config.enableEdit = enableEdit;
        var viewMode = 'viewInputMode';
        if( enableEdit && Awp0WorkflowDesignerUtils.isOOTBTaskTempleGraphEditable( selectedProcessTemplate ) ) {
            viewMode = 'editInputMode';
        }
        ctx.graph.graphModel.config.inputMode = viewMode;
    }
};

/**
  * Show or hide the task information panel. If tab is already present and not a toggle
  * case then passed the previous tab id to URL only.
  *
  * @param {String} tabIdToShow Tab id that will be shown by default
  * @param {String} toggleCase True or false based on task info panel need to be shown or
  */
export let showTaskRelatedInfoPanel = function( tabIdToShow, toggleCase ) {
    // This variable only be true when user has clicked on command specifically.
    if( toggleCase ) {
        if( tabIdToShow && tabIdToShow !== null ) {
            tabIdToShow = null;
        } else {
            tabIdToShow = 'Awp0TaskPropertiesTab';
        }
    }
    // Check if input tab to show is not null and toggle case is undefined that means
    // either we want to show the tabs by default or tab id and user hasn't click on command.
    if( !tabIdToShow && toggleCase === undefined ) {
        tabIdToShow = 'Awp0TaskPropertiesTab';
    }
    // Update the input tab name or valid tab name to URL
    Awp0WorkflowDesignerUtils.updateURL( { ttab_name: tabIdToShow } );
};

/**
  * Set the legend panel container height based on legend panel mode. If mode is on
  * then style need to set else it need to be cleared.
  */
var _setLegendPanelContainerHeight = function( data ) {
    var taskLegendPaletteMode = _isLegendPanelActive( data );
    var graphRowContianer = dom.get( '[data-row-id=workflowGraphContainer]' );
    if( !taskLegendPaletteMode && graphRowContianer ) {
        dom.clearStyles( graphRowContianer );
        return;
    }
    // Get the graph element and get the client height to set it as container height
    var graphElement = dom.get( '[graph-id=workflowDesignerGraph]' );
    var graphHeight = null;
    if( graphElement ) {
        graphHeight = graphElement.clientHeight;
    }
    // Set the container height based on graph height
    if( graphHeight && graphRowContianer ) {
        dom.setStyles( graphRowContianer, { height:  graphHeight  + 'px;' } );
    }
};


/**
  * Fit the graph based on availabel area
  * @param {Object} graphContext Graph context object
  */
export let fitGraphVisibility = function( graphContext, data ) {
    if( graphContext && graphContext.graphModel && graphContext.graphModel.graphControl ) {
        graphContext.graphModel.graphControl.fitGraph();
    }

    // Set the legend panel container height based on legend palette is on or off.
    _setLegendPanelContainerHeight( data );
    //appCtxSvc.ctx.hideLegendPanel = false;
};

/**
  * Update the workflow task legend panel mode info on context to show task legend panel on or off.
  *
  * @param {Object} workflowDgmCtx Workflwo diagram context
  * @param {Object} graphModel - the graph model object
  * @param {Object} legendState Legend state object
  */
export let showTaskLegendPalettePanel = function( data, graphModel, legendState ) {
    let taskLegendPaletteMode = !_isLegendPanelActive( data );
    const workflowDgmTempState = { ...data.workflowDgmState.value };
    workflowDgmTempState.taskLegendPaletteMode = taskLegendPaletteMode;
    data.workflowDgmState.update && data.workflowDgmState.update( workflowDgmTempState );

    // Set the legend panel container height based on legend palette is on or off.
    _setLegendPanelContainerHeight( data );
    Awp0WorkflowDesignerGraphEditHandler.resetRelationCreateLegendState( graphModel, legendState );
};

/**
  * Convert the selected generic EPM task node to group node and children can be added there.
  */
export let convertToParent = function( workflowDgmState ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    if( graphContext && graphContext.graphModel && graphControl ) {
        var selectedNodes = graphControl.getSelected( 'Node' );
        if( selectedNodes && selectedNodes.length === 1 ) {
            nodeService.convertNodeToParent( graphContext.graphModel, selectedNodes[ 0 ] );
            const workflowDgmTempState = { ...workflowDgmState.value };
            workflowDgmTempState.isGroupSelectedNode = true;
            workflowDgmState.update && workflowDgmState.update( workflowDgmTempState );
        }
    }
};

/**
  * Update the node details on graph based on input modified obejcts.
  *
  * @param { Array} modifiedObjects  Modified objects from UI
  * @param {Object} graphModel Graph model object
  * @param { Object} data Data view model object
  */
export let updateModelOnObjectChanged = function( modifiedObjects, graphModel, data ) {
    var node = null;
    var nodeToUpdate = [];
    // Check for all input modifeid objects and not empty and nodes present
    // on graph then only put it in the node to update array.
    if( modifiedObjects && modifiedObjects.length > 0 && graphModel ) {
        _.forEach( modifiedObjects, function( modelObject ) {
            if( graphModel.nodeMap ) {
                node = graphModel.nodeMap[ modelObject.uid ];
                if( node ) {
                    var selTemplate = cdmService.getObject( modelObject.uid );
                    if( selTemplate && node.modelObject ) {
                        node.modelObject = selTemplate;
                        node.appData.nodeObject = selTemplate;
                        node.appData.category = selTemplate.type;
                    }
                    nodeToUpdate.push( node );
                    return true;
                }
            }
        } );

        //Check if array length > 0 then only update the node properties.
        if( nodeToUpdate.length > 0 ) {
            nodeService.updateNodeProperties( nodeToUpdate, graphModel, data );
        }
    }
};

/**
  * Reset the node data when failure occurs.
  *
  * @param { Object} editNode Edited node that need to be reset.
  * @param { Object} data Data view model object
  * @param {Object} graphModel Graph model object
  *
  */
export let resetNodeData = function( editNode, data, graphModel ) {
    if( editNode ) {
        nodeService.updateNodeProperties( [ editNode ], graphModel, data );
    }
};

/**
  * Verfiy that node change properties need to be saved or not.
  * @param { Object} editNode Edited node that need to be reset.
  * @param { String} oldValue Old node name value
  * @param {Object} newValue New node name value
  *
  */
export let verifyEditNodeData = function( editNode, oldValue, newValue ) {
    // Check if edit node is null or invalid and new name and old name both are same then no need to do anything
    // and return from here. Else fire the event to save the properties.
    // If new name is empty then also no need to save it and return from here.
    if( !editNode || !editNode.modelObject || oldValue === newValue || !newValue || _.trim( newValue ) === '' ) {
        return;
    }
    eventBus.publish( 'workflowDesigner.nodePropsEditCommitted' );
};


export let loadGraphPositions = function( ctx ) {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    var graph = graphControl.graph;
    var totalNodesInGraph = graph.getNodes();

    _.forEach( totalNodesInGraph, function( node ) {
        //processPosition
        var nodeRect = graph.getBounds( node );
        var modelObject = node.modelObject;
        var locationX;
        var locationY;

        if( node.appData && ( node.appData.nodeType === 'finish' || node.appData.nodeType === 'start' ) ) {
            var locationPropValue = modelObject.props.location.dbValues[ 0 ];
            var locationPropArray = locationPropValue.split( ',' );
            if( node.appData.nodeType === 'start' ) {
                //get array elements 2 and three, corresponding to the hex x,y coordinates for the start node
                locationX = parseInt( locationPropArray[ 2 ], 16 );
                locationY = parseInt( locationPropArray[ 3 ], 16 );
                nodeRect.x = ( locationX + 100 ) * 1.90;
                nodeRect.y = ( locationY - 150 ) * 1.90;
                graph.setBounds( node, nodeRect );
            } else if( node.appData.nodeType === 'finish' ) {
                //get array elements 4 and 5, corresponding to the hex x,y coordinates for the finish node
                locationX = parseInt( locationPropArray[ 4 ], 16 );
                locationY = parseInt( locationPropArray[ 5 ], 16 );
                nodeRect.x = ( locationX + 100 ) * 1.90;
                nodeRect.y = ( locationY - 150 ) * 1.90;
                graph.setBounds( node, nodeRect );
            }
        } else {
            var location1 = modelObject.props.location1;
            var locationArray = location1.dbValues[ 0 ].split( ',' );
            locationX = parseInt( locationArray[ 0 ], 10 );
            locationY = parseInt( locationArray[ 1 ], 10 );
            nodeRect.x = ( locationX + 100 ) * 1.90;
            nodeRect.y = ( locationY - 150 ) * 1.90;
            graph.setBounds( node, nodeRect );
        }
    } );
};

export default exports = {
    applyGraphLayout,
    drawGraph,
    drawGraphFixedLayout,
    updateWorkflowDesignerPage,
    registerPropPolicy,
    unRegisterPropPolicy,
    graphItemsMoved,
    expandChildren,
    populateGridSettingPanelData,
    applyGridSetting,
    setGraphEditMode,
    showTaskRelatedInfoPanel,
    fitGraphVisibility,
    showTaskLegendPalettePanel,
    convertToParent,
    updateModelOnObjectChanged,
    resetNodeData,
    verifyEditNodeData,
    loadGraphPositions,
    checkAndUpdateWorkflowDesignerPage
};
