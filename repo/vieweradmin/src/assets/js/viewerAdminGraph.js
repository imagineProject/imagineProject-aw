// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerAdminGraph
 */
import viewerAdminHealth from 'js/viewerAdminHealth';
import svgTextUtils from 'js/svgTextUtils';
import _ from 'lodash';
import graphPathsService from 'js/graphPathsService';

var exports = {};

var m_template = undefined;

/**
 * CSS Class for TC_GATEWAY_MEDIUM_TILE
 */
var TC_GATEWAY_MEDIUM_TILE = '#ababab';

/**
 * HIDDEN
 */
var HIDDEN = 'hidden';

/**
 * CSS Class for VIEWER_ADMIN_NODE_TYPE_COLOR
 */
var VIEWER_ADMIN_NODE_TYPE_COLOR = 'aw-viewerAdmin-nodeTypeColor';

/**
 * CSS Class for VIEWER_ADMIN_NODE_NORMAL_BORDER_STYLE_SVG
 */
var VIEWER_ADMIN_NODE_NORMAL_BORDER_STYLE_SVG = 'aw-viewerAdmin-nodeNormalBorderStyleSvg';

/**
 * CSS Class for VIEWER_ADMIN_DETAIL_NODE_NAME_SVG
 */
var VIEWER_ADMIN_DETAIL_NODE_NAME_SVG = 'aw-widgets-cellListCellTitle';

/**
 * CSS Class for VIEWER_ADMIN_DETAIL_NODE_NAME_RECT_SVG
 */
var VIEWER_ADMIN_DETAIL_NODE_NAME_RECT_SVG = 'hidden';

/**
 * CSS Class for VIEWER_ADMIN_SUB_DETAIL_NODE_NAME_SVG
 */
var VIEWER_ADMIN_SUB_DETAIL_NODE_NAME_SVG = 'aw-base-x-large';

/**
 * CSS Class for VIEWER_ADMIN_INTERMEDIATE_NODE_NAME_SVG
 */
var VIEWER_ADMIN_INTERMEDIATE_NODE_NAME_SVG = 'aw-base-x-large';

/**
 * CSS Class for VIEWER_ADMIN_DETAIL_NODE_SUBTITLE_SVG
 */
var VIEWER_ADMIN_DETAIL_NODE_SUBTITLE_SVG = 'aw-widgets-cellListCellItemType aw-base-small aw-viewerAdmin-subTitle';

/**
 * CSS Class for VIEWER_ADMIN_NODE_OUT_DEGREE_SVG
 */
var VIEWER_ADMIN_NODE_OUT_DEGREE_SVG = 'aw-viewerAdmin-nodeOutDegreeSvg';

/**
 * CSS Class for VIEWER_ADMIN_INTERMEDIATE_NODE_SUBTITLE_SVG
 */
var VIEWER_ADMIN_INTERMEDIATE_NODE_SUBTITLE_SVG = 'aw-base-normal';

/**
 * CSS Class for VIEWER_ADMIN_SUB_DETAIL_NODE_SUBTITLE_SVG
 */
var VIEWER_ADMIN_SUB_DETAIL_NODE_SUBTITLE_SVG = 'aw-base-small';

/**
 * CSS Class for VIEWER_ADMIN_OVERVIEW_NODE_NAME_SVG
 */
var VIEWER_ADMIN_OVERVIEW_NODE_NAME_SVG = 'aw-base-x-large';

/**
 * CSS Class for VIEWER_ADMIN_SUB_DETAIL_NODE_DESC_SVG
 */
var VIEWER_ADMIN_SUB_DETAIL_NODE_DESC_SVG = 'aw-base-normal';

/**
 * CSS Class for SVG_DEFAULT
 */
var SVG_DEFAULT = 'aw-widgets-svgdefault';

/**
 * CSS Class for SVG_TOOLS_PANEL_TEXT_AREA
 */
var SVG_TOOLS_PANEL_TEXT_AREA = 'aw-widgets-svgtoolsPanelTextArea';

/**
 * CSS Class for SVG_LOCATION_SUB_TOPIC
 */
var SVG_LOCATION_SUB_TOPIC = 'aw-widgets-svglocationSubTopic';

/**
 * CSS Class for SVG_TOOLS_PANEL_SECTION_TITLE
 */
var SVG_TOOLS_PANEL_SECTION_TITLE = 'aw-layout-panelSectionTitle';

/**
 * CSS Class for SVG_PROPERTY_LABEL
 */
var SVG_PROPERTY_LABEL = 'aw-widgets-propertyLabel';

/** node_fill_color */
var NODE_FILL_COLOR = 'node_fill_color';

/** node_type_color_class */
var NODE_TYPE_COLOR_CLASS = 'node_type_color_class';

/** node_type_indicator_class */
var NODE_TYPE_INDICATOR_CLASS = 'node_type_indicator_class';

/** node_border_style_svg */
var NODE_BORDER_STYLE_SVG = 'node_border_style_svg';

/** detailnode_name_svg */
var DETAILNODE_NAME_SVG = 'detailnode_name_svg';

/** detailnode_name_rect_svg */
var DETAILNODE_NAME_RECT_SVG = 'detailnode_name_rect_svg';

/** detailnode_subtitle_svg */
var DETAILNODE_SUBTITLE_SVG = 'detailnode_subtitle_svg';

/** in_degree_arrow_style_intermediate_svg */
var IN_DEGREE_ARROW_STYLE_INTERMEDIATE_SVG = 'in_degree_arrow_style_intermediate_svg';

/** in_degree_number_style_svg */
var IN_DEGREE_NUMBER_STYLE_SVG = 'in_degree_number_style_svg';

/** in_degree_arrow_style_svg */
var IN_DEGREE_ARROW_STYLE_SVG = 'in_degree_arrow_style_svg';

/** in_degree_target_style_svg */
var IN_DEGREE_TARGET_STYLE_SVG = 'in_degree_target_style_svg';

/** in_degree_number_style_intermediate_svg */
var IN_DEGREE_NUMBER_STYLE_INTERMEDIATE_SVG = 'in_degree_number_style_intermediate_svg';

/** in_degree */
var IN_DEGREE = 'in_degree';

/** out_degree_number_style_svg */
var OUT_DEGREE_NUMBER_STYLE_SVG = 'out_degree_number_style_svg';

/** out_degree_number_style_intermediate_svg */
var OUT_DEGREE_NUMBER_STYLE_INTERMEDIATE_SVG = 'out_degree_number_style_intermediate_svg';

/** out_degree_arrow_style_intermediate_svg */
var OUT_DEGREE_ARROW_STYLE_INTERMEDIATE_SVG = 'out_degree_arrow_style_intermediate_svg';

/** out_degree_target_style_svg */
var OUT_DEGREE_TARGET_STYLE_SVG = 'out_degree_target_style_svg';

/** toggle_parent_cmd_visiblity */
var TOGGLE_PARENT_CMD_VISIBLITY = 'toggle_parent_cmd_visiblity';

/** toggle_children_cmd_visiblity */
var TOGGLE_CHILDREN_CMD_VISIBLITY = 'toggle_children_cmd_visiblity';

/** child_count */
var CHILD_COUNT = 'child_count';

/** sub_detailnode_name_svg */
var SUB_DETAILNODE_NAME_SVG = 'sub_detailnode_name_svg';

/** sub_detailnode_subtitle_svg */
var SUB_DETAILNODE_SUBTITLE_SVG = 'sub_detailnode_subtitle_svg';

/** sub_detailnode_desc_svg */
var SUB_DETAILNODE_DESC_SVG = 'sub_detailnode_desc_svg';

/** intermediatenode_name_svg */
var INTERMEDIATENODE_NAME_SVG = 'intermediatenode_name_svg';

/** intermediatenode_subtitle_svg */
var INTERMEDIATENODE_SUBTITLE_SVG = 'intermediatenode_subtitle_svg';

/** child_number_style_svg */
var CHILD_NUMBER_STYLE_SVG = 'child_number_style_svg';

/** overviewnode_name_svg */
var OVERVIEWNODE_NAME_SVG = 'overviewnode_name_svg';

/** property_sub_1 */
var PROPERTY_SUB_1 = 'property_sub_1';

/** property_int_1 */
var PROPERTY_INT_1 = 'property_int_1';

/** property_over_1 */
var PROPERTY_OVER_1 = 'property_over_1';

/** property_sub_2 */
var PROPERTY_SUB_2 = 'property_sub_2';

/** property_int_2 */
var PROPERTY_INT_2 = 'property_int_2';

/** property_1 */
var PROPERTY_1 = 'property_1';

/** property_2 */
var PROPERTY_2 = 'property_2';

var _nodeTemplateInterpolate = {
    interpolate: /<%=([\s\S]+?)%>/g
};

/**
 * data objects currently available for display in node.
 */
var _textTypes = {
    Title: 'title',
    SubTitle: 'SubTitle',
    FootNote: 'FootNote'
};

/**
 * template properties binding mappings
 */
var _templatePropNamesMappings = {
    g_object_property1: '{PropertyBinding(\'property_1\')}',
    g_object_property2: '{PropertyBinding(\'property_2\')}',
    DetailNodeStyleTemplate: 'detailTemplateId',
    SubDetailNodeStyleTemplate: 'subDetailTemplateId',
    IntermediateNodeStyleTemplate: 'intermediateTemplateId',
    OverviewNodeStyleTemplate: 'overviewTemplateId',
    g_sub_object_property1: '{PropertyBinding(\'property_sub_1\')}',
    g_sub_object_property2: '{PropertyBinding(\'property_sub_2\')}',
    g_sub_object_property3: '{PropertyBinding(\'property_sub_3\')}',
    g_int_object_property1: '{PropertyBinding(\'property_int_1\')}',
    g_int_object_property2: '{PropertyBinding(\'property_int_2\')}',
    g_over_object_property1: '{PropertyBinding(\'property_over_1\')}'
};

/**
 * Set node styling for data element displayed in the node. Applies styling to the overview, sub-detail,
 * intermediate, and regular views. This allows the node to use different styling depending on the zoom level.
 *
 * @param {Object} customAttributes attributes.
 * @param {String} propertyLine text to display
 * @param {_textTypes} textType text type
 */
var setNodeAttributes = function( customAttributes, propertyLine,
    textType ) {
    if( customAttributes !== undefined &&
        propertyLine !== undefined ) {
        if( textType === _textTypes.Title ) {
            //normal view
            customAttributes[ PROPERTY_1 ] = svgTextUtils
                .truncateSvgText( propertyLine, SVG_DEFAULT,
                    233, true );
            //sub detail view
            customAttributes[ PROPERTY_SUB_1 ] = svgTextUtils
                .truncateSvgText( propertyLine,
                    SVG_TOOLS_PANEL_TEXT_AREA, 220, true );
            //intermediate view
            customAttributes[ PROPERTY_INT_1 ] = svgTextUtils
                .truncateSvgText( propertyLine,
                    SVG_LOCATION_SUB_TOPIC, 220, true );
            //overview
            customAttributes[ PROPERTY_OVER_1 ] = svgTextUtils
                .truncateSvgText( propertyLine,
                    SVG_TOOLS_PANEL_SECTION_TITLE, 250,
                    true );
        } else if( textType === _textTypes.SubTitle ) {
            customAttributes[ PROPERTY_2 ] = svgTextUtils
                .truncateSvgText( propertyLine, SVG_DEFAULT,
                    210, true );
            //sub detail view
            customAttributes[ PROPERTY_SUB_2 ] = svgTextUtils
                .truncateSvgText( propertyLine,
                    SVG_PROPERTY_LABEL, 185, true );
            //intermediate view
            customAttributes[ PROPERTY_INT_2 ] = svgTextUtils
                .truncateSvgText( propertyLine,
                    SVG_PROPERTY_LABEL, 170, true );
        } else {
            customAttributes[ PROPERTY_1 ] = svgTextUtils
                .truncateSvgText( propertyLine, SVG_DEFAULT,
                    233, true );
            customAttributes[ PROPERTY_2 ] = svgTextUtils
                .truncateSvgText( propertyLine, SVG_DEFAULT,
                    233, true );
        }
    }
};

/**
 * Apply a hidden style
 *
 * @return {String}string hidden.
 */
var getHidden = function() {
    return HIDDEN;
};

/**
 * Populates custom attributes with help of health object
 * @param  {HealthObjectType} typeHealthObj health obj
 * @param  {Object} customAttributes attribute object
 */
var attachCustomArrtibutes = function( typeHealthObj, customAttributes ) {
    // This creates the border around the node.
    customAttributes[ NODE_FILL_COLOR ] = TC_GATEWAY_MEDIUM_TILE;
    customAttributes[ NODE_TYPE_COLOR_CLASS ] = VIEWER_ADMIN_NODE_TYPE_COLOR;
    customAttributes[ NODE_TYPE_INDICATOR_CLASS ] = getHidden();
    customAttributes[ NODE_BORDER_STYLE_SVG ] = VIEWER_ADMIN_NODE_NORMAL_BORDER_STYLE_SVG;
    customAttributes[ DETAILNODE_NAME_SVG ] = VIEWER_ADMIN_DETAIL_NODE_NAME_SVG;
    customAttributes[ DETAILNODE_NAME_RECT_SVG ] = VIEWER_ADMIN_DETAIL_NODE_NAME_RECT_SVG;
    customAttributes[ DETAILNODE_SUBTITLE_SVG ] = VIEWER_ADMIN_DETAIL_NODE_SUBTITLE_SVG;

    customAttributes[ IN_DEGREE_NUMBER_STYLE_SVG ] = getHidden();
    customAttributes[ IN_DEGREE_ARROW_STYLE_INTERMEDIATE_SVG ] = getHidden();
    customAttributes[ IN_DEGREE_ARROW_STYLE_SVG ] = getHidden();
    customAttributes[ IN_DEGREE_TARGET_STYLE_SVG ] = getHidden();
    customAttributes[ IN_DEGREE_NUMBER_STYLE_INTERMEDIATE_SVG ] = getHidden();
    customAttributes[ IN_DEGREE ] = 0; //$NON-NLS-2$
    customAttributes[ OUT_DEGREE_NUMBER_STYLE_SVG ] = getHidden();
    customAttributes[ OUT_DEGREE_NUMBER_STYLE_INTERMEDIATE_SVG ] = getHidden();
    customAttributes[ OUT_DEGREE_ARROW_STYLE_INTERMEDIATE_SVG ] = getHidden();
    customAttributes[ OUT_DEGREE_TARGET_STYLE_SVG ] = getHidden();
    customAttributes[ TOGGLE_PARENT_CMD_VISIBLITY ] = typeHealthObj
        .getParent() !== undefined;
    customAttributes[ TOGGLE_CHILDREN_CMD_VISIBLITY ] = _
        .size( typeHealthObj.getImmediateChildren() ) > 0;
    customAttributes[ CHILD_COUNT ] = _.size( typeHealthObj
        .getImmediateChildren() );
    customAttributes[ SUB_DETAILNODE_NAME_SVG ] = VIEWER_ADMIN_SUB_DETAIL_NODE_NAME_SVG;
    customAttributes[ SUB_DETAILNODE_SUBTITLE_SVG ] = VIEWER_ADMIN_SUB_DETAIL_NODE_SUBTITLE_SVG;
    customAttributes[ SUB_DETAILNODE_DESC_SVG ] = VIEWER_ADMIN_SUB_DETAIL_NODE_DESC_SVG;
    customAttributes[ INTERMEDIATENODE_NAME_SVG ] = VIEWER_ADMIN_INTERMEDIATE_NODE_NAME_SVG;
    customAttributes[ INTERMEDIATENODE_SUBTITLE_SVG ] = VIEWER_ADMIN_INTERMEDIATE_NODE_SUBTITLE_SVG;
    customAttributes[ CHILD_NUMBER_STYLE_SVG ] = VIEWER_ADMIN_NODE_OUT_DEGREE_SVG;
    customAttributes[ OVERVIEWNODE_NAME_SVG ] = VIEWER_ADMIN_OVERVIEW_NODE_NAME_SVG;
};

/**
 * Gets the template
 * @param  {Object} viewModel view model object
 * @returns {Object} template
 */
var getTemplate = function( viewModel ) {
    if( m_template === undefined && viewModel ) {
        var template = _
            .cloneDeep( viewModel.graphModel.nodeTemplates.vaThreeLevelNodeTemplate );
        var baseTemplateStr = template.templateContent;
        var nodeTemplateFn = _.template( baseTemplateStr,
            _nodeTemplateInterpolate ); // creates lodash function read here  https://learn.co/lessons/javascript-lodash-templates
        var mappedTemplateStr = nodeTemplateFn( _templatePropNamesMappings );
        template.templateContent = mappedTemplateStr;
        m_template = template;
    }
    return m_template;
};

/**
 * Creates incoming edge on the node
 * @param  {Object} graph grapg object
 * @param  {Object} targetNode node for incoming edge
 * @returns {Object} edge object
 */
var createIncomingEdge = function( graph, targetNode ) {
    var edge = undefined;
    if( targetNode === undefined ) {
        return;
    }

    var parentHealthObj = targetNode.healthObject.getParent();

    if( parentHealthObj !== undefined ) {
        var sourceNode = parentHealthObj.getNode();

        if( sourceNode !== undefined && targetNode !== undefined ) {
            edge = graph.createEdgeWithNodesStyleAndTag( sourceNode,
                targetNode );
            sourceNode.isOutGoingExpanded = true;
            targetNode.isInComingExpanded = true;
        }
    }
    return edge;
};

/**
 * Creates node with incoming edge
 *
 * @param  {HealthObjectType} typeHealthObj health object
 * @param  {Object} template template to be used
 * @param  {Object} graph graph object
 * @param {Object} graphNewConstructs graph items object
 */
var createNodeWithIncomingEdges = function( typeHealthObj, template, graph, graphNewConstructs ) {
    // same as createNodeWithBoundsStyleAndTag
    var nodeRect = {
        width: 210,
        height: 45,
        x: 0,
        y: 0
    };

    var bindData = {};
    setNodeAttributes( bindData, typeHealthObj.getDisplayType(),
        _textTypes.Title );
    setNodeAttributes( bindData, typeHealthObj.getId(),
        _textTypes.SubTitle );

    attachCustomArrtibutes( typeHealthObj, bindData );

    var node = graph.createNodeWithBoundsStyleAndTag( nodeRect,
        template, bindData );

    if( graphNewConstructs ) {
        graphNewConstructs.nodes.push( node );
    }

    graph.setNodeMinSizeConfig( node, [ 210, 45 ] ); //Minimum_node_size

    typeHealthObj.setNode( node );
    node.healthObject = typeHealthObj;

    var edge = createIncomingEdge( graph, node );
    if( graphNewConstructs && edge ) {
        graphNewConstructs.edges.push( edge );
    }
};

/**
 * Draws ViewerAdmin graph
 * @param  {Object} data model
 */
export let drawGraph = function( data ) {
    var allHealthObjs = viewerAdminHealth.getAllHealthObjects();
    var groupedObjs = _.groupBy( allHealthObjs, 'type' );
    var graphControl = data.graphModel.graphControl;
    var graph = graphControl.graph;

    var template = getTemplate( data );

    // create nodes from top hierarchy
    _.forEach( viewerAdminHealth.HealthObjectType,
        function( type ) {
            var typeObjs = _.get( groupedObjs, type );
            _.forEach( typeObjs, function( typeHealthObj ) {
                createNodeWithIncomingEdges( typeHealthObj,
                    template, graph );
            } );
        } );

    graphControl.layout.applyLayout();
    graphControl.layout.activate(); // In case of incremental layout, this call casuses active (Incremental Layout) layout to route to edge path.
    graphControl.fitGraph();
};

/**
 * Gets children nodes for given node
 * @param  {Object} node node object
 * @returns {Object[]} children nodes
 */
var getChildrenNodes = function( node ) {
    var childrenNodes = [];
    var allHealthObjs = viewerAdminHealth.getAllHealthObjects();

    var childrenHealthObjs = _.filter( allHealthObjs, function(
        healthObject ) {
        return node.healthObject === healthObject.getParent();
    } );

    _.forEach( childrenHealthObjs, function( healthObj ) {
        var nodeObj = healthObj.getNode();
        childrenNodes.push( nodeObj );
    } );

    return childrenNodes;
};

/**
 * Adds graph items in the layout
 * @param  {Object} graphModel model
 * @param  {Object} graphNewConstructs graph items
 */
var addInLayout = function( graphModel, graphNewConstructs ) {
    var layout = graphModel.graphControl.layout;
    layout.applyUpdate( function() {
        _.each( graphNewConstructs.nodes, function( node ) {
            if( !layout.containsEdge( node ) ) {
                layout.addNode( node );
            }
        } );

        _.each( graphNewConstructs.edges, function( edge ) {
            if( !layout.containsEdge( edge ) ) {
                layout.addEdge( edge );
            }
        } );
    } );
};

/**
 * Adds graph items in the layout
 * @param  {Object} graphModel model
 * @param  {Object} graphItems graph items
 */
var removeFromLayout = function( graphModel, graphItems ) {
    var layout = graphModel.graphControl.layout;
    layout.applyUpdate( function() {
        _.each( graphItems.edges, function( edge ) {
            if( layout.containsEdge( edge ) ) {
                layout.removeEdge( edge );
            }
        } );

        _.each( graphItems.nodes, function( node ) {
            if( layout.containsEdge( node ) ) {
                layout.removeEdge( node );
            }
        } );
    } );
};

/**
 * Toggle incoming edges visibility for the give node
 * @param  {Object} graphModel graph Model
 * @param  {Object} node node to operate
 */
export let toggleIncomingEdges = function( graphModel, node ) {
    if( graphModel && node && node.healthObject ) {
        var graph = graphModel.graphControl.graph;
        var isInComingExpanded = node.isInComingExpanded;

        if( isInComingExpanded ) {
            var parentHealthObj = node.healthObject.getParent(); // if you are able to click icon, means there is a parent
            parentHealthObj.hiddenChildrenCount++;

            if( parentHealthObj.hiddenChildrenCount === _
                .size( parentHealthObj.getImmediateChildren() ) ) {
                var attachedNode = parentHealthObj.getNode();
                attachedNode.isOutGoingExpanded = false;
            }
            var nodesToRemove = graphPathsService
                .getConnectedGraph( [ node ], getChildrenNodes );
            var removedGraphItems = graph
                .removeNodes( nodesToRemove );

            removeFromLayout( graphModel, removedGraphItems );

            node.isInComingExpanded = false;

            // show the children count
            var newBindData = {};
            var parentNode = parentHealthObj.getNode();
            newBindData.out_degree = parentHealthObj.hiddenChildrenCount;
            newBindData.out_degree_number_style_svg = VIEWER_ADMIN_NODE_OUT_DEGREE_SVG;
            graphModel.graphControl.graph.updateNodeBinding(
                parentNode, newBindData );
        }
    }
};

/**
 * Toggle outgoing edges visibility for the give node
 * @param  {Object} graphModel graph Model
 * @param  {Object} node node to operate
 */
export let toggleOutgoingEdges = function( graphModel, node ) {
    if( graphModel && node && node.healthObject ) {
        var graph = graphModel.graphControl.graph;
        var isNodeOutGoingExpanded = node.isOutGoingExpanded;
        var newBindData = {};

        if( isNodeOutGoingExpanded ) {
            var nodesToRemove = graphPathsService
                .getConnectedGraph( [ node ], getChildrenNodes );
            // graph adds start node as well.
            _.remove( nodesToRemove, function( nodeObj ) {
                return node === nodeObj;
            } );

            var removedGraphItems = graph
                .removeNodes( nodesToRemove );

            removeFromLayout( graphModel, removedGraphItems );

            node.isOutGoingExpanded = false;

            // show the children count
            newBindData.out_degree = _.size( node.healthObject
                .getImmediateChildren() );
            newBindData.out_degree_number_style_svg = VIEWER_ADMIN_NODE_OUT_DEGREE_SVG;
        } else {
            var graphNewConstructs = {
                nodes: [],
                edges: []
            };
            var hierarchy = viewerAdminHealth
                .getDescendants( node.healthObject );

            _.forEach( hierarchy, function( healthObj ) {
                createNodeWithIncomingEdges( healthObj,
                    getTemplate(), graph, graphNewConstructs );
            } );

            addInLayout( graphModel, graphNewConstructs );

            node.isOutGoingExpanded = true;
            node.healthObject.hiddenChildrenCount = 0;
            newBindData.out_degree_number_style_svg = getHidden();
        }
        //update command state
        graphModel.graphControl.graph.updateNodeBinding( node,
            newBindData );
        graphModel.graphControl.layout.applyLayout();
    }
};

export let updateLayoutOnNodeMovement = function( data, movedNodes ) {
    var layout = data.graphModel.graphControl.layout;

    layout.applyUpdate( function() {
        _.forEach( movedNodes, function( node ) {
            layout.moveNode( node );
        } );
    } );
};

export default exports = {
    drawGraph,
    toggleIncomingEdges,
    toggleOutgoingEdges,
    updateLayoutOnNodeMovement
};
