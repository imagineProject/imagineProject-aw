// Copyright (c) 2022 Siemens

/**
 * This implements the graph overlay handler for Architecture tab
 *
 * @module js/Awp0WorkflowDesignerGraphOverlayHandler
 */
import appCtxSvc from 'js/appCtxService';
import Awp0WorkflowDesignerGraphTemplateService from 'js/Awp0WorkflowDesignerGraphTemplateService';
import graphLegendSvc from 'js/graphLegendService';

var exports = {};

export let setOverlayNode = function( graphModel, node, pointOnPage ) {
    if( graphModel && graphModel.graphControl ) {
        var nodeSize = {
            width: 300,
            height: 100
        };
        node.style.textOverflow = 'ELLIPSIS';
        var nodeStyle = node.style;
        var nodeData = node.getAppObj();

        // Check if node is start or finish node then show then as interactive node template
        if( node.appData && ( node.appData.nodeType === 'start' || node.appData.nodeType === 'finish' ) ) {
            var cellPropNames = Awp0WorkflowDesignerGraphTemplateService.getBindPropertyNames( node.modelObject );
            nodeStyle = Awp0WorkflowDesignerGraphTemplateService.getNodeTemplate( graphModel.nodeTemplates, cellPropNames, false );

            // Set the node property using tooltip. This will be present only for start and finish node
            if( node.appData.tooltipOfNode ) {
                nodeData.Name = node.appData.tooltipOfNode;
            }
        }
        if( node.appData.isGroup ) {
            nodeSize.height = node.getAppObj().HEADER_HEIGHT;
        }

        // Set node fill color based on node category
        var ctx = appCtxSvc.ctx;

        var activeLegendView = ctx.graph.legendState.activeView;
        var legendStyle = graphLegendSvc
            .getStyleFromLegend( 'objects', node.appData.category, activeLegendView );
        nodeData.node_fill_color = legendStyle.borderColor;

        // Based on the node name set the overlay node width if it's greater than 300
        var currentNodeWidth = node.getWidth();
        if( currentNodeWidth > 300 ) {
            nodeSize.width = currentNodeWidth;
        }

        nodeData.borderWidth = '5px';
        nodeData.barWidth = '10px';
        graphModel.graphControl.setCustomOverlayNode( node, nodeStyle, nodeSize, nodeData, pointOnPage );
    }
};

export default exports = {
    setOverlayNode
};
