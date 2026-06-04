// Copyright (c) 2022 Siemens

/**
 * This implements the method related to drawing the edges on the graph
 *
 * @module js/Awp0WorkflowViewerGraphService
 */
import cdmService from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import graphConstants from 'js/graphConstants';
import templateService from 'js/Awp0WorkflowTemplateService';
import popupService from 'js/popupService';
import viewModelObjectService from 'js/viewModelObjectService';

var exports = {};

/**
 * Return the true or false based on auto layout is on or off.
 * @param {object} data View model object
 * @returns {boolean} True or False
 */
var _isFixedLayoutMode = function( data ) {
    if( data && data.workflowViewerContext && data.workflowViewerContext.diagram ) {
        return !data.workflowViewerContext.diagram.isAutoLayoutOn;
    }
    return false;
};

/**
 * Return all sub process present for input node object.
 *
 * @param {Object} node Nod eobejct for sub process need to be shown in popup window
 *
 * @returns {Object} results to be shown
 */
export let populateSubProcessData = function( node ) {
    var subProcessesObjects = [];
    if( node && node.appData.nodeObject && node.appData.nodeObject.props.sub_processes_states
        && node.appData.nodeObject.props.sub_processes_states.dbValues ) {
        var subProcesses = node.appData.nodeObject.props.sub_processes_states.dbValues;
        _.forEach( subProcesses, function( subProcessUid ) {
            var splitedSubProcessUids = subProcessUid.split( ',' );
            if( splitedSubProcessUids && splitedSubProcessUids[ 0 ] ) {
                var subProcessObject = viewModelObjectService.createViewModelObject( splitedSubProcessUids[ 0 ] );
                if( subProcessObject ) {
                    subProcessesObjects.push( subProcessObject );
                }
            }
        } );
    }

    return {
        searchResults: subProcessesObjects,
        totalFound: subProcessesObjects.length
    };
};

/**
 * Popup options that need to be shown for sub process
 */
const popupOptions = {
    view: 'Awp0MySubProcessPopup',
    reference: '',
    width: 320,
    height: 150,
    isModal: false,
    placement: 'right-end',
    clickOutsideToClose: true
};

/**
 * This expand or collapse the parent node where sub process exist. It will only
 * show the sub process in fixed layout.
 * @param {Object} node Node which need to be expand or collapse
 */
export let expandSubProcess = function( node ) {
    // Check if input node object is not valid then no need to process further
    // and return from here.
    if( !node ) {
        return;
    }
    var option = popupOptions;
    if( option ) {
        // Get the node SVG DOM element
        var domElemnt = node.getSVGDom();
        //Get the node first child element to show the popup next to it
        // This is needed when two nodes are far apart and we want to show the popup
        // next to node and not next to end point of edge. SO better to get the first
        // child of node DOM and get it's id and use that to show the popup
        if( domElemnt && domElemnt.firstElementChild ) {
            domElemnt = domElemnt.firstElementChild;
        }

        // Set the reference for popup options and set it correct node DOM element
        option.reference = domElemnt;
        popupService.show( option );
    }
};

var incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

/**
 * Toggle child node expand for the given node.
 * @param {Object} graphModel Graph model object
 * @param {Object} node Node which need to be expand or collapse
 * @param {Object} workflowViewerContext Workflow viewer context object
 * @param {Object} data Data view model object
 *
 * @returns {Object} Updated workflow viewer context object
 */
export let expandChildren = function( graphModel, node, workflowViewerContext, data  ) {
    if( graphModel && node ) {
        // Check if fixed layout is activated or not. In case of fixed layout
        // we need to update node details on workflow context object so that new graph
        // can be rendered for this new data.
        var isFixedLayout = _isFixedLayoutMode( data );
        if( isFixedLayout ) {
            const workflowViewerCtx = { ...workflowViewerContext };
            workflowViewerCtx.renderObject = node.appData.nodeObject;
            workflowViewerCtx.renderGraphContextObjectUid = node.appData.nodeObject.uid;
            workflowViewerCtx.isReloadGraph = true;
            return workflowViewerCtx;
        }
        var graphControl = graphModel.graphControl;
        var groupGraph = graphControl.groupGraph;
        var isExpanded = groupGraph.isExpanded( node );
        groupGraph.setExpanded( node, !isExpanded );

        //update command selection state
        var updateBindData = {};
        updateBindData.Awp0ToggleChildren_selected = !node.getProperty( 'Awp0ToggleChildren_selected' );
        updateBindData.Awp0ToggleChildren_tooltip = isExpanded ? data.i18n.showChildren : data.i18n.hideChildren;
        updateBindData.Awp0ToggleSubProcess_tooltip = isExpanded ? data.i18n.showSubProcess : data.i18n.hideSubProcess;
        updateBindData.Awp0ToggleSubProcessAutoLayout_selected = !node.getProperty( 'Awp0ToggleSubProcessAutoLayout_selected' );

        var subProcessCount = 0;
        var childCount = 0;
        // Get the sub process count and children count seperately and then combine in case of
        // auto layout
        if( node.appData.nodeObject.props.sub_processes_states.dbValues.length > 0 ) {
            subProcessCount = node.appData.nodeObject.props.sub_processes_states.dbValues.length;
        }
        if( node.appData.nodeObject.props.child_tasks.dbValues.length > 0 &&
            node.appData.nodeObject.uid !== node.appData.nodeObject.props.root_task.dbValues[ 0 ] ) {
            childCount = node.appData.nodeObject.props.child_tasks.dbValues.length;
        }
        if( isExpanded ) {
            updateBindData.child_count = subProcessCount + childCount;
        } else {
            updateBindData.child_count = '';
        }
        graphControl.graph.updateNodeBinding( node, updateBindData );

        //apply incremental update layout
        var layout = graphControl.layout;
        if( incUpdateActive( layout ) ) {
            layout.applyLayout();
        }
        // Pan to view in auto layout in expand or collapse cases. Pan in all cases as in case
        // of fixed layout also we are showing the children there as well. If we don't show the children there
        // then we don't need to pan it in fixed layout.
        graphControl.panToView( [ node ], graphConstants.PanToViewOption.AUTO );
    }
    return workflowViewerContext;
};

/**
 * Get the root task object for current dispalyed diagram
 * @param {Object} workflowData Workflow data object
 *
 * @returns {Object} Root task object
 */
export let getRootTaskObject = function( workflowData ) {
    var rootTaskObject = null;
    var rootTaskUid = null;
    if( workflowData && workflowData.workflow_root_task && workflowData.workflow_root_task[ 0 ] ) {
        rootTaskUid = workflowData.workflow_root_task[ 0 ];
    } else if( workflowData && workflowData.elementData[ 0 ] && workflowData.elementData[ 0 ].element ) {
        var nodeObject = cdmService.getObject( workflowData.elementData[ 0 ].element.uid );
        if( nodeObject && nodeObject.props && nodeObject.props.root_task && nodeObject.props.root_task.dbValues &&
            nodeObject.props.root_task.dbValues.length > 0 ) {
            rootTaskUid = nodeObject.props.root_task.dbValues[ 0 ];
        }
    }
    if( rootTaskUid ) {
        rootTaskObject = cdmService.getObject( rootTaskUid );
    }
    return rootTaskObject;
};

/**
 * Set the task that is started in focus by defualt.
 * @param {Object} graphModel Graph model object
 * @param {Object} workflowData Workflow data object
 */
export let setFocusTaskObject = function( graphModel, workflowData ) {
    var foucsTaskUid = null;
    var foucsTaskNode = null;
    if( workflowData && workflowData.task_to_focus && workflowData.task_to_focus[ 0 ] && graphModel ) {
        foucsTaskUid = workflowData.task_to_focus[ 0 ];
    }
    if( foucsTaskUid ) {
        foucsTaskNode = graphModel.nodeMap[ foucsTaskUid ];
    }
    var graphControl = graphModel.graphControl;
    if( foucsTaskNode && graphControl ) {
        // Pan to view in center fit to show started task in foxus
        graphControl.panToView( [ foucsTaskNode ], graphConstants.PanToViewOption.CENTER_FIT );
    }
};

/**
 * Set the graph configuration based on layout.
 *
 * @param {String} layout Layout option that will be applied on graph
 * @param {Object} graphModel Graph model object where layout configuration will be set
 */
export let setDiagramConfigForLayout = function( layout, graphModel ) {
    if( layout === 'FixedLayout' ) {
        graphModel.graphControl.setAutoRoutingType( graphConstants.AutoRoutingtype.STRAIGHT_LINE );
        graphModel.graphControl.setGroupNodeBoundaryUpdateMode( false );
    } else {
        graphModel.graphControl.setAutoRoutingType( graphConstants.AutoRoutingtype.HV_SEGMENT3 );
        graphModel.graphControl.setGroupNodeBoundaryUpdateMode( true );
    }
};

/**
 * This method will update the workflow page based on selected crumb in fixed layout
 * or user change the layout between auto and fixed layout or user is updating the
 * process from breadcrumb for target complete task to show the complete task panel
 * on workflow page.
 *
 * @param {Object} graphModel Graph model object where layout configuration will be set
 * @param {String} layoutOption Layout option that will be applied on graph
 * @param {Object} workflowViewerContext Context object that hold viewer context info
 * @param {Object} selected Object for graph need to be rendered
 * @returns {Object} Updated workflow viewer context object
 */
export let updateWorkflowViewerPage = function( graphModel, layoutOption, workflowViewerContext, selected, isResetSubProcess ) {
    if( !graphModel || !graphModel.initialized ) {
        return workflowViewerContext;
    }
    // Check if graph model is not null and anitialized proeprly then only fire this event to
    // change the layout. This is needed when we apply layout before graph loaded then no need
    // to fire the event.
    graphModel.nodeMap = null;
    graphModel.edgeMap = null;

    exports.setDiagramConfigForLayout( layoutOption, graphModel );

    const workflowViewerCtx = { ...workflowViewerContext };
    // If selected object is not null then update the render object for graph needs to be displayed.
    // Right now selected object only come in case when user is updating the process from workflow page
    // where we show breadcrumb for target complete task panel.
    if( selected && selected.uid ) {
        var modelObject = cdmService.getObject( selected.uid );
        workflowViewerCtx.renderObject = modelObject;
    }

    if( layoutOption !== 'FixedLayout' && workflowViewerCtx.hasOwnProperty( 'workflowGraphShowSubProcessData' ) ) {
        // Check if this key is present then we need to delete it from context object and update
        delete workflowViewerCtx.workflowGraphShowSubProcessData;
    }
    // Set this boolean to true so that graph can be reloaded when user swtiching between the layout
    workflowViewerCtx.isReloadGraph = true;
    // Reset the open sub process case when input value is true. This will be mainly needed when user open
    // the sub process from viewer and then update the breadcrumb selected process from target object.
    if( isResetSubProcess ) {
        workflowViewerCtx.isOpenSubProcess = false;
    }
    return workflowViewerCtx;
};

/**
 * Update the node based on input updated model objects
 * @param {Object} data Data view model object
 * @param {Array} modelObjects Model obejcts that are updated
 * @param {Object} graphModel Graph model object where layout configuration will be set
 */
export let callForOnNodeUpdatedMethod = function( data, modelObjects, graphModel ) {
    if( typeof graphModel === typeof undefined || graphModel && typeof graphModel.nodeMap === typeof undefined
        || !graphModel || graphModel && !graphModel.nodeMap ) {
        return;
    }
    var updateNodes = {};
    var graphControl = graphModel.graphControl;
    _.forEach( modelObjects, function( modelObject ) {
        var node = graphModel.nodeMap[ modelObject.uid ];
        if( node ) {
            var isFixedLayout = _isFixedLayoutMode( data );
            var rootTaskObject = graphModel.rootTaskObject;
            var props = templateService.getBindPropertyNames( modelObject, null, rootTaskObject );
            var objectBindData = templateService.getBindProperties( isFixedLayout, rootTaskObject, modelObject, props );
            var properties = {};
            var bindData = node.getAppObj();
            _.forEach( props, function( prop ) {
                var bindValue = bindData[ prop ];
                if( objectBindData[ prop ] !== bindValue ) {
                    if( prop === 'due_date' || prop === 'fnd0EndDate' ) {
                        properties.datePropDispName = objectBindData.datePropDispName;
                        properties.date_prop_value = objectBindData.date_prop_value;
                        properties.date_prop_style_svg = objectBindData.date_prop_style_svg;
                    } else if( prop === 'state_value' ) {
                        properties.image_task_state = objectBindData.image_task_state;
                    }else {
                        if( prop === 'fnd0Assignee' ) {
                            if( modelObject.type !== 'EPMPerformSignoffTask' ) {
                                properties[ prop ] = objectBindData[ prop ];
                            }
                        } else {
                            properties[ prop ] = objectBindData[ prop ];
                        }
                    }
                }
            } );
            if( Object.keys( properties ).length > 0 ) {
                updateNodes[ modelObject.uid ] = properties;
            }
        }
    } );

    if( Object.keys( updateNodes ).length > 0 ) {
        graphControl.graph.update( function() {
            _.forEach( updateNodes, function( value, key ) {
                var node = graphModel.nodeMap[ key ];
                graphControl.graph.updateNodeBinding( node, value );
            } );
        } );
    }
};

/**
 * Get the workflow graph SOA input structure from context info and return from here.
 * @param {Object} workflowViewerContext Workflow viewer context object that hold all information
 * @returns {Array} SOA input data array
 */
export let getWorkflowGraphInputData = function( workflowViewerContext ) {
    var input = [];
    // Check if render object is not valid then no need to process further and return empty
    // array from here.
    if( !workflowViewerContext.renderObject || !workflowViewerContext.renderObject.uid ) {
        return input;
    }
    var inputData = {
        selection :  {
            type: workflowViewerContext.renderObject.type,
            uid: workflowViewerContext.renderObject.uid
        }
    };
    inputData.workflowGraphInfo = {};
    // Check if renderGraphContextObjectUid is not null then it means user is in fixed layout mode and trying to open
    // specific task object. So in that case workflowGraphContext need to be passed so we can get only that task graph
    if( workflowViewerContext.renderGraphContextObjectUid ) {
        inputData.workflowGraphInfo.workflowGraphContext = [ workflowViewerContext.renderGraphContextObjectUid ];
    }
    // Add the layout info to SOA input structure
    if( workflowViewerContext.diagram ) {
        inputData.workflowGraphInfo.workflowGraphFixedLayout = [ ( !workflowViewerContext.diagram.isAutoLayoutOn ).toString() ];

        // Add the workflowGraphShowSubProcessData info to SOA input structure. Mainly this need to be set as false
        // in case of fixed layout where we don't show sub process node on graph when rendering the graph for parent node.
        // If this value is false then only we need to pass the false to server so that sub process nodes are not displayed
        // else don't send this variable to server and server will conside it true by default. If this is fixed layout then only
        // we need it to pass to server.
        if( workflowViewerContext.workflowGraphShowSubProcessData === false && !workflowViewerContext.diagram.isAutoLayoutOn ) {
            inputData.workflowGraphInfo.workflowGraphShowSubProcessData = [ 'false' ];
        }
    }

    return [ inputData ];
};


export default exports = {
    expandSubProcess,
    expandChildren,
    getRootTaskObject,
    setFocusTaskObject,
    setDiagramConfigForLayout,
    updateWorkflowViewerPage,
    callForOnNodeUpdatedMethod,
    populateSubProcessData,
    getWorkflowGraphInputData
};
