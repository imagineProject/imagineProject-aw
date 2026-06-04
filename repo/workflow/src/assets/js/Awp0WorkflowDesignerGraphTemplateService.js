// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0WorkflowDesignerGraphTemplateService
 */
import awIconService from 'js/awIconService';
import iconSvc from 'js/iconService';
import graphTemplateService from 'js/graphTemplateService';
import _ from 'lodash';
import logger from 'js/logger';
import graphStyleUtils from 'js/graphStyleUtils';
import workflowUtils from 'js/Awp0WorkflowUtils';
import { svgString as cmdChild } from 'image/cmdChild24.svg';

var exports = {};

var PROPERTY_NAME = 'awp0CellProperties';
var THUMBNAIL_URL = 'thumbnail_image';
var TEMPLATE_ID_DELIMITER = '-';
var TEMPLATE_VALUE_CONN_CHAR = '\\:';

var NODE_TEMPLATE_NAME = 'WorkflowDesignerTileNodeTemplate';

var GROUP_NODE_TEMPLATE_NAME = 'WorkflowDesignerGroupTileNodeTemplate';

var FIXED_NODE_TEMPLATE_NAME = 'WorkflowDesignerTileNodeFixedTemplate';

var FIXED_GROUP_NODE_TEMPLATE_NAME = 'WorkflowDesignerGroupTileNodeFixedTemplate';

/**
 * Binding class name for node
 */
export let NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

/**
 * Binding class name for text inside the tile
 */
export let TEXT_HOVERED_CLASS = 'relation_TEXT_hovered_style_svg';

/**
 * Binding the color bar width for node
 */
var COLOR_BAR_WIDTH = 'barWidth';

/**
 * Binding Class Name for root node border style
 */
var ROOTNODE_BORDER_STYLE = 'rootnode_border_style';

/**
 * The interpolate delimiter used in node SVG template
 */
var _nodeTemplateInterpolate = {
    interpolate: /<%=([\s\S]+?)%>/g
};

/**
 * Construct node SVG template from a base template by interpolate the binding properties into the property
 * binding placeholder. The constant interpolate placeholder <%=PROPERTY_LIST%> is especially supported to bind
 * a list of properties.
 *
 * The binding placeholder may like: <%=title%>, <%=sub_title%>, <%=PROPERTY_LIST%>.
 *
 * @param baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param templateData {Object} the template data used for template interpolate. The constant array property
 *            'PROPERTY_LIST' should be defined in templateData if it's been used in node template. For example:
 *            <p>
 *            baseTemplateString='<g><text>{PropertyBinding("<%=title%>")}</text><g><%=PROPERTY_LIST%></g></g>'
 *
 * templateData = { title: 'object_name', sub_title: 'object_id', PROPERTY_LIST: ['propName1', 'propName2'] }
 * </p>
 * @return the constructed template string
 */
var constructNodeTemplate = function( baseTemplateString, templateData ) {
    if( !baseTemplateString ) {
        return '';
    }

    var bindData = {};
    if( templateData ) {
        bindData = _.clone( templateData );
    }

    if( !bindData.property_list ) {
        bindData.property_list = [];
    }

    var nodeTemplate = _.template( baseTemplateString, _nodeTemplateInterpolate );
    return nodeTemplate( bindData );
};

/**
 * Construct the node template from a base template with the bind properties. The first two properties will be
 * interpolate to title and sub_title. The remaining properties will bind to property list.
 *
 *
 * @param templateId the template ID of the constructed template. If not given, the template ID will be the
 *            string of bind property Names joined by '-'.
 * @param baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param propertyNames the array of bind property names
 * @return the generated template string with bind property names been interpolated.
 */
var getTemplateContent = function( templateId, baseTemplateString, propertyNames ) {
    var templateData = {};
    templateData.sub_title = null;

    if( propertyNames instanceof Array ) {
        if( !templateId ) {
            templateId = propertyNames.join( '-' );
        }

        var len = propertyNames.length;
        if( len > 0 ) {
            templateData.title = propertyNames[ 0 ];
            templateData.title_editable = propertyNames[ 0 ] + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }

        if( len > 1 ) {
            templateData.sub_title = propertyNames[ 1 ];
            templateData.sub_title_editable = propertyNames[ 1 ] + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }
    }

    if( templateId ) {
        templateData.template_id = templateId;
    }
    return constructNodeTemplate( baseTemplateString, templateData );
};

/**
 * Get node template by populate the base template with given binding property names
 *
 * @param {Object} nodeTemplateCache Node Template Cache
 * @param {Array} propertyNames the names of node object property
 * @param {boolean} isGroup flag
 * @param {boolean} isNonInteractiveNode flag
 * @returns {Object} node template
 */
export let getNodeTemplate = function( nodeTemplateCache, propertyNames, isGroup, isNonInteractiveNode, isFixedLayoutMode ) {
    //template doesn't exist, construct it and put in template cache
    var baseTemplateId = null;

    if ( isNonInteractiveNode ) {
        baseTemplateId = 'WorkflowDesignerNodeNonInteractiveTemplate';
    } else {
        baseTemplateId = isGroup ? FIXED_GROUP_NODE_TEMPLATE_NAME : FIXED_NODE_TEMPLATE_NAME;
    }

    var baseTemplate = nodeTemplateCache[ baseTemplateId ];
    if( !baseTemplate ) {
        logger.error( 'SVG template has not been registered. Template ID: ' + baseTemplateId );
        return null;
    }

    var templateId = baseTemplateId;
    if( propertyNames && propertyNames.length > 0 ) {
        templateId += TEMPLATE_ID_DELIMITER;
        templateId += propertyNames.join( TEMPLATE_ID_DELIMITER );
    }
    var newTemplate = _.cloneDeep( baseTemplate );
    newTemplate.templateId = templateId;
    newTemplate.templateContent = getTemplateContent( templateId, baseTemplate.templateContent, propertyNames );

    return newTemplate;
};

/**
 * Get cell property names for the node object.
 *
 * @param {Object} nodeObject the node model object
 * @param {Object} nodeData the node data object
 * @return {Array} the array of cell property names
 */
export let getBindPropertyNames = function( nodeObject, nodeData ) {
    var properties = [];
    var propsArray = [];
    // If node is non interactive then show only the icon else show
    // cell properties
    if( nodeData && !nodeData.properties.isInteractiveTask ) {
        propsArray = nodeObject.props[ PROPERTY_NAME ].uiValues;
        var nameValue = propsArray[ 0 ].split( TEMPLATE_VALUE_CONN_CHAR );
        properties.push( nameValue[ 0 ] );
    } else {
        if( nodeObject.props && nodeObject.props[ PROPERTY_NAME ] ) {
            propsArray = nodeObject.props[ PROPERTY_NAME ].uiValues;
            _.forEach( propsArray, function( prop ) {
                var nameValue = prop.split( TEMPLATE_VALUE_CONN_CHAR );
                properties.push( nameValue[ 0 ] );
            } );
        }
    }
    return properties;
};

/**
 * Check if input model object is process template or not.
 *
 * @param {Object} nodeObject Node obejct whose properties need to be check
 * @return {Boolean} True/False based on obejct is process tempalte or not
 */
var _isProcessTemplate = function( nodeObject ) {
    var _isProcess = false;
    if( nodeObject && nodeObject.props.template_classification && nodeObject.props.template_classification.dbValues ) {
        var templateClassificationDBValues = nodeObject.props.template_classification.dbValues;

        if( templateClassificationDBValues && templateClassificationDBValues[ 0 ] && templateClassificationDBValues[ 0 ] === '0' ) {
            _isProcess = true;
        }
    }
    return _isProcess;
};

/**
 * Set the thumbnail image on input object.
 * @param {Object} nodeObject the node model object
 * @param {Array} bindProperties the array of properties to bind
 * @param {String} nodeType Node type. This will be used for start or finish node
 */
var setNodeThumbnailProperty = function( nodeObject, bindProperties, nodeType ) {
    var imageUrl = awIconService.getThumbnailFileUrl( nodeObject );
    if( nodeType === 'start' ) {
        imageUrl = iconSvc.getTypeIconFileUrl( 'typeFlowStartTask48.svg' );
    } else if( nodeType === 'finish' ) {
        imageUrl = iconSvc.getTypeIconFileUrl( 'typeFlowStopTask48.svg' );
    }

    //show type icon instead if thumbnail doesn't exist
    if( !imageUrl ) {
        imageUrl = workflowUtils.getTaskFlowBasedIcon( nodeObject );
    }

    // Check if subtask_template property is not null and not empty and object is not process template
    // then only process further to show the show children command on node
    if( nodeObject.props.subtask_template && nodeObject.props.subtask_template.dbValues.length > 0 &&
        !_isProcessTemplate( nodeObject ) ) {
        var childUrl = iconSvc.getTypeIconFileUrl( 'cmdShowChildren24.svg' );
        bindProperties.image_show_subprocess = graphStyleUtils.getSVGImageTag( childUrl );
    }

    bindProperties[ THUMBNAIL_URL ] = graphStyleUtils.getSVGImageTag( imageUrl );
};

/**
 * Set hover node property
 * @param {Array} properties the array of property names
 * @param {String} hoveredClass Hovered class string
 */
var setHoverNodeProperty = function( properties, hoveredClass ) {
    if( hoveredClass ) {
        properties[ exports.NODE_HOVERED_CLASS ] = hoveredClass;
        properties[ exports.TEXT_HOVERED_CLASS ] = hoveredClass;
    } else {
        properties[ exports.NODE_HOVERED_CLASS ] = 'aw-graph-noeditable-area';
        properties[ exports.TEXT_HOVERED_CLASS ] = '';
    }
};

/**
 * Set the root node property.
 *
 * @param {Array} properties the array of property names
 * @param {Boolean} isRoot True/False value
 */
var setRootNodeProperty = function( properties, isRoot ) {
    if( isRoot ) {
        properties[ ROOTNODE_BORDER_STYLE ] = 'aw-relations-seedNodeSvg';
        properties[ COLOR_BAR_WIDTH ] = 15;
    } else {
        properties[ ROOTNODE_BORDER_STYLE ] = 'aw-relations-noneSeedNodeSvg';
        properties[ COLOR_BAR_WIDTH ] = 10;
    }
};

/**
 * Get the binding properties for the given node object
 *
 * @param {Object} nodeObject the node model object
 * @param {Array} propertyNames the names of node object property to display
 * @param {Object} nodeData data
 * @return {Object} the object including all the required binding properties for a node template
 */
export let getBindProperties = function( nodeObject, propertyNames, nodeData ) {
    var properties = {};

    if( nodeObject && nodeObject.props && nodeObject.props[ PROPERTY_NAME ] ) {
        var propsArray = nodeObject.props[ PROPERTY_NAME ].uiValues;
        for( var i = 0; i < propsArray.length; ++i ) {
            var nameValue = propsArray[ i ].split( TEMPLATE_VALUE_CONN_CHAR );
            properties[ nameValue[ 0 ] ] = i > 1 ? nameValue[ 0 ] + ': ' + nameValue[ 1 ] : nameValue[ 1 ];

            //First property from bind data is populate correct node name for start or finish node
            if( i === 0 && nodeData && nodeData.nodeType && nodeData.nodeName ) {
                properties[ nameValue[ 0 ] ] = nodeData.nodeName;
            }
        }
    }

    setHoverNodeProperty( properties, null );
    setRootNodeProperty( properties, false );
    if( nodeData ) {
        //get thumbnail for node
        setNodeThumbnailProperty( nodeObject, properties, nodeData.nodeType );
        // Check if child_count present then only add it to properties
        if( nodeData && nodeData.properties && nodeData.properties.child_count ) {
            properties.child_count = nodeData.properties.child_count;
            properties.show_child_img = cmdChild;
        }
    }

    properties.children_full_loaded = true;
    return properties;
};

/**
 * Get the show children SVG image
 *
 * @returns{object} Show children SVG image
 */
export let getShowChildrenSVGImage = function() {
    var childUrl = iconSvc.getTypeIconFileUrl( 'cmdShowChildren24.svg' );
    return graphStyleUtils.getSVGImageTag( childUrl );
};

/**
 * Get the under construction SVG image
 *
 * @returns{object} Show under construction SVG image
 */
export let getUnderConstructionSVGImage = function() {
    var childUrl = iconSvc.getTypeIconFileUrl( 'typePerformSignoffTask48.svg' );
    return graphStyleUtils.getSVGImageTag( childUrl );
};

export default exports = {
    NODE_HOVERED_CLASS,
    TEXT_HOVERED_CLASS,
    getNodeTemplate,
    getBindPropertyNames,
    getBindProperties,
    getShowChildrenSVGImage,
    getUnderConstructionSVGImage
};
