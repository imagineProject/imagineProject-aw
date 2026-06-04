// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0WorkflowTemplateService
 */
import graphTemplateService from 'js/graphTemplateService';
import _ from 'lodash';
import logger from 'js/logger';
import graphStyleUtils from 'js/graphStyleUtils';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import dateTimeSvc from 'js/dateTimeService';
import workflowUtils from 'js/Awp0WorkflowUtils';
import browserUtils from 'js/browserUtils';
import { svgString as cmdChild } from 'image/cmdChild24.svg';
import { svgString as cmdShowOutgoingRelations } from 'image/cmdShowOutgoingRelations24.svg';
import { svgString as cmdOpen } from 'image/cmdOpen24.svg';

var exports = {};

var THUMBNAIL_URL = 'thumbnail_image';
var TASK_STATE = 'image_task_state';
var TASK_STATE_TOOLTIP = 'status_tooltip';
var TEMPLATE_ID_DELIMITER = '-';
var OPEN_PROCESS = 'open_process';
var NODE_TEMPLATE_NAME = 'WorkflowTileNodeTemplate';
var GROUP_NODE_TEMPLATE_NAME = 'WorkflowGroupTileNodeTemplate';
var GROUP_FIXED_NODE_TEMPLATE_NAME = 'WorkflowGroupTileNodeFixedTemplate';

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
 * The template for property interpolate placeholder <%=PROPERTY_LIST%>.
 */
var _propertyTextTemplate = _
    .template(
        '<text y="<%=y%>" id="<%=id%>" class=\'{ BooleanPropertyBinding("<%=propertyName%>_editable", "GC_NODE_MODIFIABLE_PROPERTY_CLASS", "GC_NODE_PROPERTY_CLASS") }\' ' +
        'data-property-name="<%=propertyName%>" data-width="100%-80">{PropertyBinding("<%=propertyName%>")}</text>',
        _nodeTemplateInterpolate );

/**
 * Construct node SVG template from a base template by interpolate the binding properties into the property
 * binding placeholder. The constant interpolate placeholder <%=PROPERTY_LIST%> is especially supported to bind
 * a list of properties.
 *
 * The binding placeholder may like: <%=title%>, <%=sub_title%>, <%=PROPERTY_LIST%>.
 *
 * @param {String} baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param {Object} templateData the template data used for template interpolate. The constant array property
 *            'PROPERTY_LIST' should be defined in templateData if it's been used in node template. For example:
 *            <p>
 *            baseTemplateString='<g><text>{PropertyBinding("<%=title%>")}</text><g><%=PROPERTY_LIST%></g></g>'
 *
 * templateData = { title: 'object_name', sub_title: 'object_id', PROPERTY_LIST: ['propName1', 'propName2'] }
 * </p>
 * @return {String} the constructed template string
 */
var constructNodeTemplate = function( baseTemplateString, templateData ) {
    if( !baseTemplateString ) {
        return '';
    }

    var bindData = {};
    if( templateData ) {
        bindData = _.clone( templateData );
        bindData.PROPERTY_LIST = '';
        // this initial value of 'topAlignOfCommand' need be revisited when enhance SVG node word wrap, it not has to be "subTitle"
        bindData.topAlignOfCommand = 'subTitle';

        var propertyList = templateData.PROPERTY_LIST || templateData.property_list;
        if( propertyList && propertyList instanceof Array ) {
            for( var i = 0; i < propertyList.length; ++i ) {
                var propertyListData = {
                    y: ( i + 1 ) * 15,
                    id: 'DProp' + i,
                    propertyName: propertyList[ i ]
                };

                bindData.PROPERTY_LIST += _propertyTextTemplate( propertyListData, _nodeTemplateInterpolate );
                if( i !== propertyList.length - 1 ) {
                    bindData.PROPERTY_LIST += '\n';
                } else {
                    bindData.topAlignOfCommand = propertyListData.id;
                }
            }
        }

        bindData.property_list = bindData.PROPERTY_LIST;
    }

    var nodeTemplate = _.template( baseTemplateString, _nodeTemplateInterpolate );
    return nodeTemplate( bindData );
};

/**
 * Construct the node template from a base template with the bind properties. The first two properties will be
 * interpolate to title and sub_title. The remaining properties will bind to property list.
 *
 *
 * @param {String} templateId the template ID of the constructed template. If not given, the template ID will be the
 *            string of bind property Names joined by '-'.
 * @param {String} baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param {Array} propertyNames the array of bind property names
 * @return {Object} the generated template string with bind property names been interpolated.
 */
var getTemplateContent = function( templateId, baseTemplateString, propertyNames ) {
    var templateData = {};
    templateData.sub_title = null;
    // This is needed in case of showing sub process on normal node or start node
    templateData.datePropDispName = null;
    templateData.date_prop_value = null;

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

        if( len > 2 ) {
            templateData.property_list = propertyNames.slice( 3 );
            templateData.datePropDispName = 'datePropDispName';
            templateData.date_prop_value = 'date_prop_value';
        }
    }

    if( templateId ) {
        templateData.template_id = templateId;
    }
    return constructNodeTemplate( baseTemplateString, templateData );
};

/**
 * Get node template by populate the base template with given binding property names
 */
/**
 * Get node template by populate the base template with given binding property names.
 *
 * @param {boolean} isFixedLayout True/False based on graph is is fixed layour or auto layout
 * @param {Object} nodeTemplateCache Cached node templates
 * @param {Array} propertyNames Properties array that need to be shown on nodes
 * @param {boolean} isGroup True/False based on node has children or not
 * @param {boolean} isNonInteractiveNode True/False based on node need to be non interactive or not
 * @returns {Object} Template object that will be used to render the node
 */
export let getNodeTemplate = function( isFixedLayout, nodeTemplateCache, propertyNames, isGroup, isNonInteractiveNode ) {
    //template doesn't exist, construct it and put in template cache
    var baseTemplateId = null;
    if( isNonInteractiveNode ) {
        baseTemplateId = 'WorkflowNodeNonInteractiveTemplate';
    } else if( isFixedLayout ) {
        baseTemplateId = isGroup ? GROUP_FIXED_NODE_TEMPLATE_NAME : NODE_TEMPLATE_NAME;
    } else {
        baseTemplateId = isGroup ? GROUP_NODE_TEMPLATE_NAME : NODE_TEMPLATE_NAME;
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

    var template = nodeTemplateCache[ templateId ];
    if( template ) {
        return template;
    }

    var newTemplate = _.cloneDeep( baseTemplate );
    newTemplate.templateId = templateId;
    newTemplate.templateContent = getTemplateContent( templateId, baseTemplate.templateContent, propertyNames );

    //cache the new template
    nodeTemplateCache[ templateId ] = newTemplate;
    return newTemplate;
};

/**
 * Get the input object property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Get cell property names for the node object.
 *
 * @param {Object} nodeObject the node model object
 * @param {Array} perform_signoff_assignees PS task assignee array
 * @param {Object} rootTaskObject Root task object for current displayed graph
 * @return {Array} the array of cell property names
 */
export let getBindPropertyNames = function( nodeObject, perform_signoff_assignees, rootTaskObject ) {
    var properties = [];
    if( nodeObject && nodeObject.props ) {
        var endDate = _getPropValue( nodeObject, 'fnd0EndDate', true );
        var rootTaskUid = _getPropValue( nodeObject, 'root_task' );

        if( rootTaskUid === nodeObject.uid || rootTaskObject && rootTaskObject.uid === nodeObject.uid ) {
            properties.push( 'job_name' );
            // Check if browser is IE or edge then only add this dummy property for root task start or finish node
            // to avoid showing undefined on UI. Discussed this apporach with GC team and implemented based on their
            // suggestion.
            if( browserUtils.isIE ) {
                properties.push( 'dummyRootTaskNodeProp' );
            }
        } else if( rootTaskUid !== nodeObject.uid && endDate !== '' ) {
            properties.push( 'object_name' );
            properties.push( 'fnd0Assignee' );
            properties.push( 'fnd0EndDate' );
            properties.push( 'state_value' );
        } else if( rootTaskUid !== nodeObject.uid && endDate === '' ) {
            properties.push( 'object_name' );
            properties.push( 'fnd0Assignee' );
            properties.push( 'due_date' );
            properties.push( 'state_value' );
        }
    }
    if( perform_signoff_assignees && perform_signoff_assignees !== undefined && perform_signoff_assignees.length > 0 ) {
        properties.push( 'perform_signoff_assignees' );
    }
    return properties;
};

/**
 * Check the due date or end date if not late from current date.
 *
 * @param {Object} nodeObject Model obejct whose property need to be checked
 *
 * @returns{ boolean} True or false based on due date or end date is late or not
 */
var _isTaskLate = function( nodeObject ) {
    var isLate = false;
    var todayDate;
    var endDate = _getPropValue( nodeObject, 'fnd0EndDate' );
    var dueDate = _getPropValue( nodeObject, 'due_date' );
    var parsedEndDate = null;
    var parsedDueDate = null;
    if( typeof dateTimeSvc !== typeof undefiend ) {
        todayDate = new Date();
        todayDate = Date.parse( todayDate );
    }
    if( dueDate ) {
        parsedDueDate = Date.parse( dueDate );
    }
    if( endDate ) {
        parsedEndDate = Date.parse( endDate );
    }

    if( parsedEndDate !== null && parsedDueDate !== null && parsedDueDate < parsedEndDate ||
        ( parsedEndDate === null || isNaN( parsedEndDate ) ) && parsedDueDate !== null && parsedDueDate < todayDate ) {
        isLate = true;
    }
    return isLate;
};

/**
 * Get the task execution error for task that need to be shown on graph
 * @param {Object} nodeObject Node object for error need to be shown
 *
 * @returns {String} Error status string
 */
var _getTaskExecutionErrorsTooltip = function( nodeObject ) {
    var errorTooltip = null;
    if( !nodeObject.props.fnd0TaskExecutionErrors || !nodeObject.props.fnd0TaskExecutionErrors.uiValues ||
        nodeObject.props.fnd0TaskExecutionErrors.uiValues.length <= 0 ) {
        return errorTooltip;
    }
    errorTooltip = '';
    for( var i = 0; i < nodeObject.props.fnd0TaskExecutionErrors.uiValues.length; ++i ) {
        if( errorTooltip === '' ) {
            errorTooltip = nodeObject.props.fnd0TaskExecutionErrors.uiValues[ i ];
        } else {
            errorTooltip = errorTooltip + '<br>' + nodeObject.props.fnd0TaskExecutionErrors.uiValues[ i ];
        }
    }
    return errorTooltip;
};

var setTaskStateStyleNodeIcon = function( nodeObject ) {
    if( !iconSvc ) {
        return;
    }

    if( !localeService ) {
        return;
    }
    var imageTaskStyleUrl = null;
    var statusToolTip = null;
    var taskState = nodeObject.props.state_value.dbValues[ 0 ];
    var resource = 'WorkflowCommandPanelsMessages';
    var localTextBundle = localeService.getLoadedText( resource );

    if( taskState === '4' ) { //started
        if( nodeObject.props.fnd0TaskExecutionStatus.dbValues[ 0 ] === '1' ) { //background processing
            imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorProcessing16.svg' );
            statusToolTip = localTextBundle.inProgressStatus;
        } else if( nodeObject.props.fnd0TaskExecutionStatus.dbValues[ 0 ] === '2' ) { //error image
            imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorFailed16.svg' );
            // Get error on task that need to be shown on indicator as tooltip
            statusToolTip = _getTaskExecutionErrorsTooltip( nodeObject );
            if( !statusToolTip || statusToolTip === '' ) {
                statusToolTip = localTextBundle.failedStatus;
            }
        } else { //in progress
            if( _isTaskLate( nodeObject ) ) {
                imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorDelayed16.svg' );
                // Show the tooltip as late if task is late
                if( nodeObject.props.fnd0Status && nodeObject.props.fnd0Status.uiValues && nodeObject.props.fnd0Status.uiValues[ 0 ] ) {
                    statusToolTip = nodeObject.props.fnd0Status.uiValues[ 0 ];
                }
            } else {
                imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorInProgress16.svg' );
                statusToolTip = localTextBundle.startedStatus;
            }
        }
    } else if( taskState === '8' ) { // completed
        statusToolTip = localTextBundle.completedStatus;
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorCompleted16.svg' );
    } else if( taskState === '32' ) { // aborted
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorCancelled16.svg' );
        statusToolTip = localTextBundle.abortedStatus;
    } else if( taskState === '64' ) { // failed
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorCancelled16.svg' );
        statusToolTip = _getTaskExecutionErrorsTooltip( nodeObject );
        if( !statusToolTip || statusToolTip === '' ) {
            statusToolTip = localTextBundle.failedStatus;
        }
    } else if( parseInt( taskState ) >= 128 ) { // Suspended state will be 128 or greater than 128
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorPaused16.svg' );
        statusToolTip = localTextBundle.suspendedStatus;
    } else if( taskState === '16' ) { // Skipped
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorSkipped16.svg' );
        statusToolTip = localTextBundle.skippedStatus;
    } else if( taskState === '1' ) { // Unassigned
        imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorUnassigned16.svg' );
        statusToolTip = localTextBundle.unassignedStatus;
    } else {
        if( nodeObject.props.fnd0TaskExecutionStatus.dbValues[ 0 ] === '2' ) { //error image
            imageTaskStyleUrl = iconSvc.getTypeIconFileUrl( 'indicatorFailed16.svg' );
            // Get error on task that need to be shown on indicator as tooltip
            statusToolTip = _getTaskExecutionErrorsTooltip( nodeObject );
            if( !statusToolTip || statusToolTip === '' ) {
                statusToolTip = localTextBundle.failedStatus;
            }
        }
    }
    return {
        imageTaskStyleStateUrl: imageTaskStyleUrl,
        imageTaskStyleStateToolTip: statusToolTip
    };
};

/**
 * Populate the node properties in fixed layout.
 * @param {Object} nodeObject Model obejct for propertoes need to be fetched
 * @param {Obejct} bindProperties Properties that need to be populated
 * @param {Object} rootTaskObject Root task object
 *
 * @returns {Object} Updated bind properites
 */
var _populateNodePropertyFixedLayout = function( nodeObject, bindProperties, rootTaskObject ) {
    var isSubProcessExist = false;
    var isChildrenExist = false;
    var localBindProperties = _.clone( bindProperties );
    localBindProperties.image_show_children = null;
    localBindProperties.image_show_subprocess = null;
    if( nodeObject.props.sub_processes_states.dbValues.length > 0 ) {
        localBindProperties.subprocess_count = nodeObject.props.sub_processes_states.dbValues.length;
        isSubProcessExist = true;
    }

    // Check if node obejct has children and it's uid is not same as current opened graph root object
    // ( open opening the review task in fixed layout) or it's root task uid same as itself that means
    // it's a root task itself then we don't need to populate the children
    if( nodeObject.props.child_tasks.dbValues.length > 0 && ( rootTaskObject && nodeObject.uid !== rootTaskObject.uid &&
            nodeObject.props.root_task.dbValues[ 0 ] !== nodeObject.uid ) ) {
        localBindProperties.child_count = nodeObject.props.child_tasks.dbValues.length;
        isChildrenExist = true;
    }
    if( isSubProcessExist && isChildrenExist ) {
        localBindProperties.subprocess_children_full_loaded = true;
        localBindProperties.children_full_loaded = true;
    } else if( isSubProcessExist && !isChildrenExist ) {
        localBindProperties.only_subprocess_full_loaded = true;
    } else if( !isSubProcessExist && isChildrenExist ) {
        localBindProperties.children_full_loaded = true;
    }
    return localBindProperties;
};

/**
 * Populate the node properties in auto layout.
 * @param {Object} nodeObject Model obejct for propertoes need to be fetched
 * @param {Obejct} bindProperties Properties that need to be populated
 * @param {Object} nodeType Node type string like start or finish
 *
 * @returns {Object} Updated bind properites
 */
var _populateNodePropertyAutoLayout = function( nodeObject, bindProperties, nodeType ) {
    var localBindProperties = _.clone( bindProperties );
    var isSubProcessExist = false;
    var isChildrenExist = false;
    var childCount = 0;
    var subProcessCount = 0;
    if( nodeObject.props.sub_processes_states.dbValues.length > 0 ) {
        isSubProcessExist = true;
        subProcessCount = nodeObject.props.sub_processes_states.dbValues.length;
    }
    if( nodeObject.props.child_tasks.dbValues.length > 0 &&
        nodeObject.uid !== nodeObject.props.root_task.dbValues[ 0 ] ) {
        isChildrenExist = true;
        childCount = nodeObject.props.child_tasks.dbValues.length;
    }
    if( isSubProcessExist && isChildrenExist ) {
        localBindProperties.subprocess_children_full_loaded = true;
        childCount += subProcessCount;
    } else if( isSubProcessExist && !isChildrenExist ) {
        localBindProperties.only_subprocess_full_loaded = true;
        childCount = subProcessCount;
    } else if( !isSubProcessExist && isChildrenExist ) {
        localBindProperties.children_full_loaded = true;
    }

    // This is need to show the open icon for sub process root task node on the graph
    if( nodeType !== 'start' && nodeType !== 'finish' && nodeObject.props.root_task.dbValues[ 0 ] === nodeObject.uid ) {
        localBindProperties.open_only_subprocess_full_loaded = true;
    }
    localBindProperties.child_count = childCount;
    return localBindProperties;
};

var setNodeThumbnailProperty = function( isFixedLayout, rootTaskObject, nodeObject, bindProperties, nodeType ) {
    if( !iconSvc ) {
        return bindProperties;
    }
    var localBindProperties = _.clone( bindProperties );
    var imageUrl = null;
    if( nodeType === 'start' ) {
        imageUrl = iconSvc.getTypeIconFileUrl( 'typeFlowStartTask48.svg' );
    } else if( nodeType === 'finish' ) {
        imageUrl = iconSvc.getTypeIconFileUrl( 'typeFlowStopTask48.svg' );
    }
    localBindProperties.open_subprocess_full_loaded = false;
    //show type icon instead if thumbnail doesn't exist
    if( !imageUrl ) {
        imageUrl = workflowUtils.getTaskFlowBasedIcon( nodeObject );
    }

    if( nodeObject.props.root_task.dbValues[ 0 ] === nodeObject.uid ) {
        var openProcessUrl = iconSvc.getTypeIconFileUrl( 'cmdOpen24.svg' );
    }

    if( isFixedLayout && rootTaskObject ) {
        localBindProperties = _populateNodePropertyFixedLayout( nodeObject, localBindProperties, rootTaskObject );
    } else {
        localBindProperties = _populateNodePropertyAutoLayout( nodeObject, localBindProperties, nodeType );
    }

    var imageTaskStyle = setTaskStateStyleNodeIcon( nodeObject );

    var imageSVGStyle = 'hidden';
    // Check of image value is not null then only set the style to visible
    if( imageTaskStyle && imageTaskStyle.imageTaskStyleStateUrl !== null && imageTaskStyle.imageTaskStyleStateUrl !== '' ) {
        imageSVGStyle = 'visible';
    }

    // Task state icon should not be shown for start and finish nodes
    if( nodeType === 'start' || nodeType === 'finish' ) {
        imageSVGStyle = 'hidden';
    }

    localBindProperties[ TASK_STATE ] = graphStyleUtils.getSVGImageTag( imageTaskStyle.imageTaskStyleStateUrl );
    if( openProcessUrl ) {
        localBindProperties[ OPEN_PROCESS ] = graphStyleUtils.getSVGImageTag( openProcessUrl );
        // This is need to show the process icon for sub process root task node on the graph
        if( nodeType !== 'start' && nodeType !== 'finish' ) {
            imageUrl = iconSvc.getTypeIconFileUrl( 'typeWorkflowProcess48.svg' );
        }
    }

    localBindProperties[ THUMBNAIL_URL ] = graphStyleUtils.getSVGImageTag( imageUrl );

    localBindProperties.task_state_style_svg = imageSVGStyle;
    localBindProperties[ TASK_STATE_TOOLTIP ] = imageTaskStyle.imageTaskStyleStateToolTip;
    localBindProperties.show_child_img = cmdChild;
    localBindProperties.show_outgoing_img = cmdShowOutgoingRelations;
    localBindProperties.show_open_img = cmdOpen;
    return localBindProperties;
};

var getPerformSignOffAssignee = function( perform_signoff_assignees ) {
    var signOffAssignees = '';
    for( var i = 0; i < perform_signoff_assignees.length; ++i ) {
        if( signOffAssignees === '' ) {
            signOffAssignees = perform_signoff_assignees[ i ];
        } else {
            signOffAssignees = signOffAssignees + ', ' + perform_signoff_assignees[ i ];
        }
        if( signOffAssignees.length > 25 ) {
            signOffAssignees = signOffAssignees.substring( 0, 25, -1 );
            signOffAssignees += '...'; //NON-NLS-1
            break;
        }
    }
    return signOffAssignees;
};

var getPerformSignOffAssigneeTooltip = function( perform_signoff_assignees ) {
    var signOffAssigneesTooltip = '';
    for( var i = 0; i < perform_signoff_assignees.length; ++i ) {
        if( signOffAssigneesTooltip === '' ) {
            signOffAssigneesTooltip = perform_signoff_assignees[ i ];
        } else {
            signOffAssigneesTooltip = signOffAssigneesTooltip + ', ' + '<' + 'br' + '>' +
                perform_signoff_assignees[ i ];
        }
    }
    return signOffAssigneesTooltip;
};

var setTaskDatePropDataMap = function( nodeObject, propertyNames, properties ) {
    var datePropDispName = '';
    var datePropValue = '';
    var datePropStyle = 'aw-widgets-propertyValue aw-base-small';
    var endDate = null;
    var dueDate = null;
    var todayDate;
    var parsedEndDate = null;
    var parsedDueDate = null;
    var parseStartDate = null;
    if( typeof dateTimeSvc !== typeof undefiend ) {
        todayDate = new Date();
        todayDate = Date.parse( todayDate );
    }

    if( typeof nodeObject.props.due_date !== typeof undefined &&
        typeof nodeObject.props.due_date.dbValues !== typeof undefined ) {
        dueDate = nodeObject.props.due_date.dbValues[ 0 ];
        parsedDueDate = Date.parse( dueDate );
    }

    // Get the start date of the task
    if( typeof nodeObject.props.fnd0StartDate !== typeof undefined &&
        typeof nodeObject.props.fnd0StartDate.dbValues !== typeof undefined ) {
        var startDate = nodeObject.props.fnd0StartDate.dbValues[ 0 ];
        parseStartDate = Date.parse( startDate );
    }

    if( properties.fnd0EndDate !== undefined && properties.fnd0EndDate !== '' ) {
        endDate = nodeObject.props.fnd0EndDate.dbValues[ 0 ];
        parsedEndDate = Date.parse( endDate );
        datePropDispName = nodeObject.props.fnd0EndDate.propertyDescriptor.displayName + ': ';
        datePropValue = dateTimeSvc.formatSessionDateTime( parsedEndDate );
        properties.taskDateTooltip = datePropDispName + datePropValue;
    } else {
        var datePropTooltip = '';
        if( parseStartDate ) {
            var startPropDispName = nodeObject.props.fnd0StartDate.propertyDescriptor.displayName + ': ';
            var startDatePropValue = dateTimeSvc.formatSessionDateTime( parseStartDate );
            datePropTooltip = startPropDispName + startDatePropValue;
        }

        // Merge the start date and due date in tooptip if present on node
        if( properties.due_date !== undefined && properties.due_date !== '' ) {
            datePropDispName = nodeObject.props.due_date.propertyDescriptor.displayName + ': ';
            datePropValue = dateTimeSvc.formatSessionDateTime( parsedDueDate );
            if( datePropTooltip === '' ) {
                datePropTooltip += datePropDispName + ' ' + datePropValue;
            } else {
                datePropTooltip += '<br>' + datePropDispName + ' ' + datePropValue;
            }
        }
        properties.taskDateTooltip = datePropTooltip;
    }

    if( parsedEndDate !== null && parsedDueDate < parsedEndDate ||
        parsedEndDate === null && parsedDueDate < todayDate ) {
        datePropStyle = datePropStyle + ' ' + 'aw-theme-errorText'; //NON-NLS-1
    }
    properties.datePropDispName = datePropDispName;
    properties.date_prop_value = datePropValue;
    properties.date_prop_style_svg = datePropStyle;
};

var setRootNodeProperty = function( nodeObject, properties, isRoot ) {
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
 * @param nodeObject the node model object
 * @param propertyNames the names of node object property to display
 * @return the object including all the required binding properties for a node template
 */
export let getBindProperties = function( isFixedLayout, rootTaskObject, nodeObject, propertyNames, nodeType, perform_signoff_assignees ) {
    var properties = {};

    if( nodeObject && nodeObject.props ) {
        var endDate = nodeObject.props.fnd0EndDate.uiValues[ 0 ];
        for( var i = 0; i < propertyNames.length; ++i ) {
            if( propertyNames[ i ] === 'due_date' || propertyNames[ i ] === 'fnd0EndDate' ) {
                if( endDate !== '' ) {
                    properties.fnd0EndDate = endDate;
                } else if( nodeObject.props.due_date.uiValues[ 0 ] !== '' ) {
                    properties.due_date = nodeObject.props.due_date.uiValues[ 0 ];
                }
            }
            if( perform_signoff_assignees !== undefined && propertyNames[ i ] === 'fnd0Assignee' &&
                nodeObject.type === 'EPMPerformSignoffTask' && perform_signoff_assignees.length > 0 ) {
                var signOffAssignees = getPerformSignOffAssignee( perform_signoff_assignees );
                properties[ propertyNames[ i ] ] = signOffAssignees;
                var signOffAssigneeTooltip = getPerformSignOffAssigneeTooltip( perform_signoff_assignees );
                properties.perform_signoff_assignees = signOffAssigneeTooltip;
            }
            if( propertyNames[ i ] === 'fnd0Assignee' && nodeObject.type !== 'EPMPerformSignoffTask' ) {
                properties.fnd0Assignee = nodeObject.props.fnd0Assignee.uiValues[ 0 ];
            }
            if( propertyNames[ i ] === 'object_name' ) {
                properties.object_name = nodeObject.props.object_name.uiValues[ 0 ];
            }
            if( propertyNames[ i ] === 'job_name' ) {
                properties.job_name = nodeObject.props.job_name.uiValues[ 0 ];
            }
            if( propertyNames[ i ] === 'state_value' ) {
                properties.state_value = nodeObject.props.state_value.uiValues[ 0 ];
            }
            if( propertyNames[ i ] === 'dummyRootTaskNodeProp' ) {
                // Set the property value to empty on node and this is mainly for IE and edge browser where
                // we are using dummy property with this dummyRootTaskNodeProp name and setting the value as
                // empty string to avoid showing undefined on those browser.
                properties.dummyRootTaskNodeProp = '';
            }
        }
    }
    setTaskDatePropDataMap( nodeObject, propertyNames, properties );
    exports.setHoverNodeProperty( properties, null );
    setRootNodeProperty( nodeObject, properties, false );
    //get thumbnail for node
    properties = setNodeThumbnailProperty( isFixedLayout, rootTaskObject, nodeObject, properties, nodeType );
    properties.children_number_style_svg = 'aw-widgets-propertyLabel aw-base-small aw-relations-nodeChildCountSvg';
    return properties;
};

export let setHoverNodeProperty = function( properties, hoveredClass ) {
    if( hoveredClass ) {
        properties[ exports.NODE_HOVERED_CLASS ] = hoveredClass;
        properties[ exports.TEXT_HOVERED_CLASS ] = hoveredClass;
    } else {
        properties[ exports.NODE_HOVERED_CLASS ] = 'aw-graph-noeditable-area';
        properties[ exports.TEXT_HOVERED_CLASS ] = '';
    }
};
export default exports = {
    NODE_HOVERED_CLASS,
    TEXT_HOVERED_CLASS,
    getNodeTemplate,
    getBindPropertyNames,
    getBindProperties,
    setHoverNodeProperty
};
