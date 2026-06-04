// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowViewerBreadcrumbPanel
 */
import cdmService from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};


/**
 * Return the true or false based on template has child task or not
 *
 * @param {Object} templateObject task object whose children need to be loaded
 *
 * @returns {boolean} True or False
 */
var _hasChildren = function( templateObject ) {
    if( templateObject.props && templateObject.props.child_tasks && templateObject.props.child_tasks.dbValues &&
        templateObject.props.child_tasks.dbValues.length > 0 ) {
        return true;
    }
    return false;
};

/**
 * Update the graph by firing the event based on selected crumb if valid.
 * @param {Object} crumb Selected crumb object
 */
export let onSelectCrumb = function( crumb ) {
    if( crumb && crumb.scopedUid ) {
        var selectedObject = cdmService.getObject( crumb.scopedUid );
        eventBus.publish( 'workflowViewer.updateBreadcrumbData',  { selection:selectedObject } );
    }
};

/**
 * Populate the breadcrumb data in order with parent task template and return the final breadcrumb data.
 * @param {String} selectedCrumbUid Selected crumb uid that need to be shown on graph
 *
 * @returns {Array} Breadcrumb data array
 */
var _populateBreadCrumbData = function( selectedCrumbUid ) {
    if( !selectedCrumbUid ) {
        return;
    }
    var taskObject = cdmService.getObject( selectedCrumbUid );
    var breadCrumb = [];
    var hierarchy = [];

    var loop = true;
    while( loop ) {
        var inputParent = taskObject;
        if( inputParent && inputParent.props.parent_task && inputParent.props.parent_task.dbValues
            && inputParent.props.parent_task.dbValues[ 0 ] ) {
            hierarchy.push( inputParent );
            var parentObject = cdmService.getObject( inputParent.props.parent_task.dbValues[0] );
            if( parentObject ) {
                hierarchy.push( parentObject );
            } else {
                loop = false;
            }
            taskObject = parentObject;
        } else {
            loop = false;
            hierarchy.push( inputParent );
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
                    task: hierarchy,
                    onCrumbClick: ( crumb ) => exports.onSelectCrumb( crumb )
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
 * Build the breadcrumb based on getting the info from context object.
 * @param {Object} workflowViewerContext Context object from where we need to get the object
 *        for breadcrumb need to be generated.
 * @returns {Object} Breadcrumb provider object that contains all crumbs that need to be
 *          shown.
 */
export let buildNavigateBreadcrumb = function( workflowViewerContext ) {
    let breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];

    if( !workflowViewerContext || !workflowViewerContext.rootTaskObject ) {
        return breadCrumbProvider;
    }

    // get the context object from input context and then get the root task object
    // and renderGraphContextObjectUid details from context. renderGraphContextObjectUid
    // will contain the value when user has opened some children in fixed layout and for that
    // we need to show the breadcrum else in fixed layout we need to show the breadcrum for
    // root task object set on the context.
    const localContext = { ...workflowViewerContext.value };
    var renderObject = localContext.rootTaskObject;
    var contextObjectUid = localContext.renderGraphContextObjectUid;
    if( contextObjectUid ) {
        renderObject = cdmService.getObject( contextObjectUid );
    }

    // Check if render object is valid then only populate the breadcrumb for that
    if( renderObject && renderObject.uid ) {
        breadCrumbProvider.crumbs = _populateBreadCrumbData( renderObject.uid );
    }

    // Check if breadcrumb provider is not null and 0th crumb is present then we need to set the 0th
    // crumb as primary crumb.
    if( breadCrumbProvider && breadCrumbProvider.crumbs && breadCrumbProvider.crumbs.length > 0 ) {
        breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
        breadCrumbProvider.crumbs[ 0 ].primaryCrumb = true;
    }

    return breadCrumbProvider;
};

/**
 * load the data to be shown on chevron popup
 *
 * @param {Object} objectUid Object whose object need to be get
 * @return {Object} the resultObject
 */
export let loadChevronPopup = function( objectUid ) {
    var childObjs = [];
    if( objectUid ) {
        var targetObject = cdmService.getObject( objectUid );
        if( targetObject && targetObject.props.child_tasks  ) {
            var childTaskUids = targetObject.props.child_tasks.dbValues;
            for( var ndx = 0; ndx < childTaskUids.length; ndx++ ) {
                var object = cdmService.getObject( childTaskUids[ ndx ] );
                var result = {
                    className: object.type,
                    type: object.type,
                    uid: object.uid
                };
                childObjs.push( result );
            }
        }
    }
    return {
        searchResults: childObjs,
        totalFound: childObjs.length
    };
};

/**
 * Fire the event to update the graph based on selected task from popup and then close
 * the popup panel.
 * @param {Array} selection Selected object array from breadcrum popup list
 * @param {Object} chevronPopup Opened popup panel object that need to be hidden
 */
export let updateWorkflowViewerBreadcrumb = function( selection, chevronPopup ) {
    // Check if selection is valid then only fire the event so that graph can be updated.
    if( selection && selection[ 0 ] ) {
        eventBus.publish( 'workflowViewer.updateBreadcrumbData',  { selection:selection[0] } );
    }
    // Check if popup object is not null then only close the panel
    if( chevronPopup ) {
        chevronPopup.hide();
    }
};

/**
 * Update the breadcrumb and graph when user select some task from breadcrumb
 * @param {Object} selectedObject Selected object selected from breadcrumb for graph need to be updated
 * @param {Object} workflowViewerContext Context object which need to be updated so graph and breadcrumb can be updated
 *        for the same.
 */
export let updateViewerNavigateBreadcrumbData = function( selectedObject, workflowViewerContext ) {
    if( !selectedObject || !selectedObject.uid ) {
        return;
    }
    const localContext = { ...workflowViewerContext.value };
    localContext.renderObject = selectedObject;
    localContext.renderGraphContextObjectUid = selectedObject.uid;
    localContext.isReloadGraph = true;
    workflowViewerContext.update && workflowViewerContext.update( localContext );
};

export default exports = {
    buildNavigateBreadcrumb,
    loadChevronPopup,
    updateWorkflowViewerBreadcrumb,
    updateViewerNavigateBreadcrumbData,
    onSelectCrumb
};
