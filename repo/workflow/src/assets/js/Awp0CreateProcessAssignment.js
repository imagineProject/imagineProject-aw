// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0CreateProcessAssignment
 */
import appCtxSvc from 'js/appCtxService';
import listBoxService from 'js/listBoxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

/**
 * Populate the create assignment list panel to populate all available
 * templates.
 *
 * @param {Array} allTemplates All templates array
 * @param {Object} workflowTemplateProp Workflow templates property object
 * @return {Object} All available workflow template objects
 *
 */
export let populatePanelData = function( allTemplates, workflowTemplateProp ) {
    var templatesObjects = allTemplates;

    if( templatesObjects && templatesObjects.length > 0 ) {
        var filterTemplates = templatesObjects;
        // Create the list model object that will be displayed
        templatesObjects = listBoxService.createListModelObjects( filterTemplates, 'props.template_name' );
        var templatesObject = templatesObjects[ 0 ];
        var isFnd0InstructionsAvailable = false;

        //Check if fnd0Instructions property is available.
        //If available use fnd0Instructions property as description
        if( templatesObject && templatesObject.propInternalValue && templatesObject.propInternalValue.props.fnd0Instructions ) {
            isFnd0InstructionsAvailable = true;
        }

        // Iterate for each template objects and populate the template description
        // that will be shown on panel
        _.forEach( templatesObjects, function( templateObject ) {
            var descValue = templateObject.propInternalValue.props.object_desc.uiValues[ 0 ];
            if( isFnd0InstructionsAvailable ) {
                descValue = templateObject.propInternalValue.props.fnd0Instructions.uiValues[ 0 ];
            }
            templateObject.propDisplayDescription = descValue;
        } );
    }
    const newWorkflowTemplatesProp = { ...workflowTemplateProp };
    newWorkflowTemplatesProp.dbValue = '';
    newWorkflowTemplatesProp.uiValue = '';

    // Select the default selected process name
    if( templatesObjects && templatesObjects.length > 0 && templatesObjects[ 0 ] ) {
        newWorkflowTemplatesProp.dbValue = templatesObjects[ 0 ].propInternalValue;
        newWorkflowTemplatesProp.uiValue = templatesObjects[ 0 ].propDisplayValue;
        templatesObjects[ 0 ].selected = true;
    }

    return {
        templatesObjects : templatesObjects,
        workflowTemplatesProp : newWorkflowTemplatesProp
    };
};

/**
 * Return the object array that need to be loaded.
 *
 * @param {Object} selTemplate Selected workflow template selected from UI
 * @param {Object} groupMember Group member whose proeprty need to be loaded
 * @return {Array} objectToLoad Object array
 */
export let getObjectsToLoad = function( selTemplate, groupMember ) {
    var objectToLoad = [];
    objectToLoad.push( selTemplate );
    if( groupMember ) {
        var groupMemberObject = cdm.getObject( groupMember );
        if( groupMemberObject ) {
            objectToLoad.push( groupMemberObject );
        }
    }
    return objectToLoad;
};

/**
 * To check if logged in user is DBA group user or current logged in user
 * is group admin for specific group. Based on those validation return true/false.
 *
 * @return {boolean} True/False
 */
var _isPriviledgeUser = function() {
    var isGroupAdmin = false;
    if( appCtxSvc.ctx && appCtxSvc.ctx.userSession && appCtxSvc.ctx.userSession.props
        && appCtxSvc.ctx.userSession.props.group_name
        && appCtxSvc.ctx.userSession.props.fnd0groupmember ) {
        var groupName = appCtxSvc.ctx.userSession.props.group_name.dbValue;
        var groupMember = appCtxSvc.ctx.userSession.props.fnd0groupmember.dbValue;
        var groupMemberObject = cdm.getObject( groupMember );
        // Check if group member obejct is not null and ga property is not 0.
        if( groupMemberObject && groupMemberObject.props.ga && groupMemberObject.props.ga.dbValues ) {
            isGroupAdmin = parseInt( groupMemberObject.props.ga.dbValues[ 0 ] ) !== 0;
        }

        if( isGroupAdmin || groupName === 'dba' ) {
            return true;
        }
    }
    return false;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Populate the existing assignment list for specific selected template
 *
 * @param {Object} data Data view model object
 * @param {Object} selectedTemplate object from panel
 *
 * @returns {Object} Updated property object along with other info like logged in user is priviledge or not.
 */
export let populateAssignmentList = function( data, selectedTemplate ) {
    var assignments = [];
    const newProcessAssignmentProp = { ...data.processAssignment };
    newProcessAssignmentProp.dbValue = '';
    newProcessAssignmentProp.uiValue = '';

    if( selectedTemplate ) {
        selectedTemplate = cdm.getObject( selectedTemplate.uid );
        var processAssignmentListObj = [];

        // Check if assignment list on selected template is not null then only go further
        // to populate the assignment list for template
        if( selectedTemplate && selectedTemplate.props.assignment_lists && selectedTemplate.props.assignment_lists.dbValues &&
            selectedTemplate.props.assignment_lists.dbValues.length > 0 ) {
            var assingmentListDBValues = selectedTemplate.props.assignment_lists.dbValues;
            _.forEach( assingmentListDBValues, function( assingmentListDBValue ) {
                processAssignmentListObj.push( cdm.getObject( assingmentListDBValue ) );
            } );

            // Add the default PAL to list with None interanl and dispaly value.
            var emptyProjectListModel = _getEmptyListModel();
            emptyProjectListModel.propDisplayValue = data.i18n.none;
            emptyProjectListModel.propInternalValue = 'None';
            assignments.push( emptyProjectListModel );
            if( processAssignmentListObj.length > 0 ) {
                var palsList = listBoxService.createListModelObjects( processAssignmentListObj, 'props.object_string' );
                assignments = assignments.concat( palsList );
            }

            // Check if assignment list not null ten by default select the 0th index value
            // in the list.
            if( assignments && !_.isEmpty( assignments ) ) {
                newProcessAssignmentProp.dbValue = assignments[ 0 ].propInternalValue;
                newProcessAssignmentProp.uiValue = assignments[ 0 ].propDisplayValue;
            }
        }
    }
    return {
        assignmentList : assignments,
        processAssignment : newProcessAssignmentProp,
        isPrivilegeUser : _isPriviledgeUser()
    };
};

export default exports = {
    populatePanelData,
    getObjectsToLoad,
    populateAssignmentList
};
