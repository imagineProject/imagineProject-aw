// Copyright (c) 2022 Siemens

/**
 * This implements the graph edit handler interface APIs defined by aw-graph widget to provide graph authoring
 * functionalities.
 *
 * @module js/Awp0WorkflowGraphOverlayHandler
 */
import templateService from 'js/Awp0WorkflowTemplateService';
import graphLegendSvc from 'js/graphLegendService';
import appCtxService from 'js/appCtxService';
import workflowUtils from 'js/Awp0WorkflowUtils';

var exports = {};

var getNodeStyle = function( isFixedLayout, nodeObject, node, isGroup, graphModel ) {
    // Get the cell property names and the template name based on those cell properties
    var cellPropNames = templateService.getBindPropertyNames( nodeObject, null, graphModel.rootTaskObject );

    // Check if map already contains the template name then no need to create the new template
    // just return the existing template
    var style = null;
    style = templateService.getNodeTemplate( isFixedLayout, graphModel.nodeTemplates, cellPropNames, isGroup );
    return style;
};

export let setOverlayNode = function( graphModel, node, pointOnPage ) {
    if( graphModel && graphModel.graphControl ) {
        var nodeSize = {
            width: 300,
            height: 100
        };
        node.style.textOverflow = 'ELLIPSIS';
        var isGroup = false;
        var isFixedLayout = false;
        if( node.appData && node.appData.isGroup ) {
            isGroup = node.appData.isGroup;
            // Check if we are getting the overlay for finish node then we don't want to show as group node.
            // Only start ndoe will be shown as group node.
            if( node.appData.isStartFinishNode === 'finish' ) {
                isGroup = false;
            }
        }
        // Get the layout from node itself
        if( node.appData && node.appData.isFixedLayout ) {
            isFixedLayout = node.appData.isFixedLayout;
        }
        var overlayNodeStyle = getNodeStyle( isFixedLayout, node.appData.nodeObject, node, isGroup, graphModel );
        var nodeData = node.getAppObj();
        if( typeof node.appData.category === typeof undefined ) {
            var status = node.appData.nodeObject.props.fnd0Status.dbValues[ 0 ];
            var firstLetter = status.charAt( 0 ).toLowerCase();
            node.appData.category = 'EPM_' + firstLetter + status.substr( 1 );

            var stateValueProp = node.appData.nodeObject.props.state_value.dbValues[ 0 ];
            var stateValue = parseInt( stateValueProp );
            if( node.appData.isStartFinishNode === 'start' || node.appData.isStartFinishNode === 'finish' ) {
                node.appData.category = workflowUtils.getStartFinishNodeCategory( node.appData.isStartFinishNode, stateValue );
            }
            if( node.appData.tooltipOfNode ) {
                nodeData.job_name = node.appData.tooltipOfNode;
                nodeData.image_task_state = '';
                nodeData.open_process = '';
            }

            var ctx = appCtxService.ctx;

            var activeLegendView = ctx.graph.legendState.activeView;
            var legendStyle = graphLegendSvc
                .getStyleFromLegend( 'objects', node.appData.category, activeLegendView );
            nodeData.node_fill_color = legendStyle.borderColor;
        }

        // Based on the node name set the overlay node width if it's greater than 300
        var currentNodeWidth = node.getWidth();
        if( currentNodeWidth > 300 ) {
            nodeSize.width = currentNodeWidth;
        }

        nodeData.borderWidth = '5px';
        nodeData.barWidth = '10px';
        graphModel.graphControl.setCustomOverlayNode( node, overlayNodeStyle, nodeSize, nodeData, pointOnPage );
    }
};

export default exports = {
    setOverlayNode
};
