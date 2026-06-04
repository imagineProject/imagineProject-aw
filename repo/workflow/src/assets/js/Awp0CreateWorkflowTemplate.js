// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0CreateWorkflowTemplate
 */
import listBoxService from 'js/listBoxService';
import cdm from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import cfgSvc from 'js/configurationService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

/**
 * Populate the create assignment list panel to populate all available
 * templates.
 *
 * @param {Object} data object
 * @return {Object} All available workflow template objects
 */
export let populatePanelData = function( data ) {
    var templatesObjects = [];
    let validTaskTemplateTypes = [];
    var selectedTaskTemplateType = data.createTaskTemplateType.dbValue;
    if( selectedTaskTemplateType === 'workflow' ) {
        templatesObjects = data.allTemplates;
    } else if( selectedTaskTemplateType === 'task' && data.taskTemplateSearchResultJSON ) {
        templatesObjects = data.taskTemplateSearchResultJSON.objects;
    }

    var dummyNoneStringArr = [ data.i18n.none ];
    var noneTemplateList = listBoxService.createListModelObjectsFromStrings( dummyNoneStringArr );

    if( templatesObjects && templatesObjects.length > 0 ) {
        // Create the list model object that will be displayed
        templatesObjects = listBoxService.createListModelObjects( templatesObjects, 'props.template_name' );
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
            var descValue = '';
            if( templateObject.propInternalValue.props && templateObject.propInternalValue.props.object_desc ) {
                descValue = templateObject.propInternalValue.props.object_desc.uiValues[ 0 ];
            }
            if( isFnd0InstructionsAvailable ) {
                descValue = templateObject.propInternalValue.props.fnd0Instructions.uiValues[ 0 ];
            }
            templateObject.propDisplayDescription = descValue;
            // Check if state property is not null and it's value is 1 then append Offline before the template name
            if( templateObject.propInternalValue && templateObject.propInternalValue.props.stage &&
                templateObject.propInternalValue.props.stage.dbValues && templateObject.propInternalValue.props.stage.dbValues[ 0 ] === '1' ) {
                templateObject.propDisplayValue = '(' + data.i18n.offlineOption + ') ' + templateObject.propDisplayValue;
            }
        } );
    }
    let workflowProcessTemplates = { ... data.workflowProcessTemplates };
    let workflowTaskTemplates = { ...data.workflowTaskTemplates };

    // If none list is not empty then only add to template list at 0th index
    if( selectedTaskTemplateType === 'workflow' && templatesObjects && noneTemplateList && noneTemplateList.length > 0 ) {
        templatesObjects.splice( 0, 0, noneTemplateList[ 0 ] );

        // Select the default selected 0th index process name
        if( templatesObjects.length > 0 && templatesObjects[ 0 ] ) {
            // Select the default process template
            workflowProcessTemplates.dbValue = templatesObjects[0];
            workflowProcessTemplates.uiValue = templatesObjects[ 0 ].propDisplayValue;
        }
    } else if( selectedTaskTemplateType === 'task' && templatesObjects ) {
        // Select the default selected 0th index process name
        var defaultTaskTemplate = _.find( templatesObjects, function( taskTemplate ) {
            return taskTemplate.propInternalValue && taskTemplate.propInternalValue.type === 'EPMTaskTemplate'
            && taskTemplate.propInternalValue.props.object_name.dbValues && taskTemplate.propInternalValue.props.object_name.dbValues[0] === 'Task';
        } );
        if( defaultTaskTemplate && defaultTaskTemplate.propInternalValue ) {
            workflowTaskTemplates.dbValue = defaultTaskTemplate.propInternalValue;
            workflowTaskTemplates.uiValue = defaultTaskTemplate.propDisplayValue;

            // Check if object types are already loaded then populate all valid type for template type to be shown on the widget
            if( data.taskTemplateObjectTypes ) {
                validTaskTemplateTypes = exports.populateValidTaskTemplateTypes(  data, defaultTaskTemplate.propInternalValue, data.taskTemplateObjectTypes );
            }
        }
    }
    let taskTemplates = [];
    let processTemplates = [];
    if( selectedTaskTemplateType === 'task' ) {
        taskTemplates = templatesObjects;
        if( data.processTemplates && data.processTemplates.length > 0 ) {
            processTemplates = data.processTemplates;
        }
    } else {
        processTemplates = templatesObjects;
    }
    return {
        taskTemplates:taskTemplates,
        processTemplates:processTemplates,
        validTaskTemplateTypes:validTaskTemplateTypes,
        workflowProcessTemplates:workflowProcessTemplates,
        workflowTaskTemplates:workflowTaskTemplates
    };
};

/**
 * Create the help link for custom task template creation and set it on widget.
 *
 * @param {Object} data Data view model object
 */
var _createHelpLink = function( data ) {
    cfgSvc.getCfg( 'versionConstants' ).then( function( versionConstants ) {
        var awversion = versionConstants.version;
        var defaultVersion = '4.3';
        awversion = awversion.split( '.' );
        if( awversion && awversion[ 0 ] && awversion[ 1 ] ) {
            defaultVersion =  awversion[ 0 ] + '.' + awversion[ 1 ];
        }
        data.customTaskTemplateLinkProp.urlString = 'http://docsstage.plm.automation.siemens.com/tdoc/aw/' + defaultVersion + '/aw_html_collection/#uid:xid1481813';
    } );
};

/**
 * Populate the task template objects and types if not loaded and user is selecting task type from
 * create option.
 *
 * @param {Object} data Data view model object
 *
 */
export let createTaskTemplateTypeChangeAction = function( data ) {
    var selectedTaskTemplateType = data.createTaskTemplateType.dbValue;
    if( ( !data.taskTemplates || data.taskTemplates.length <= 0 ) && selectedTaskTemplateType === 'task' ) {
        eventBus.publish( 'workflowDesigner.loadTaskTemplateObjects' );
    }
    if( ( !data.taskTemplateObjectTypes || data.taskTemplateObjectTypes.length <= 0 ) && selectedTaskTemplateType === 'task' ) {
        eventBus.publish( 'workflowDesigner.loadTaskTemplateTypes' );
    }
    if( selectedTaskTemplateType === 'task' ) {
        _createHelpLink( data );
    }
};

/**
 * This method is used to get the LOV values for the release status list.
 * @param {Object} response the response of the getLov soa
 *
 * @returns {Object} value the LOV value
 */
export let getTaskTemplateObjectTypeList = function( response ) {
    var objectTypeList = [];
    if( response.searchResults ) {
        _.forEach( response.searchResults, function( searchResults ) {
            if( searchResults ) {
                var statusObject = cdm.getObject( searchResults.uid );
                var object = {
                    propDisplayValue: statusObject.props.type_name.uiValues[ 0 ],
                    propDisplayDescription: '',
                    propInternalValue: statusObject.props.type_name.dbValues[ 0 ]
                };
                objectTypeList.push( object );
            }
        } );
    }
    // Sort the task template object list by default with dispaly name
    objectTypeList = _.sortBy( objectTypeList, 'propDisplayValue' );
    return objectTypeList;
};

/**
 * Set the default task template type on the proeprty widget.
 *
 * @param {Object} objectTypeProp Property obejct where default value will be set.
 * @param {Array} templateTypes Template object types array
 */
export let selectDefaultTaskTemplateType = function( objectTypeProp, templateTypes  ) {
    if( objectTypeProp && templateTypes ) {
        var defaultTaskTemplate = _.find( templateTypes, function( templateType ) {
            return templateType.propInternalValue === 'EPMTaskTemplate';
        } );
        if( defaultTaskTemplate ) {
            objectTypeProp.dbValue = defaultTaskTemplate.propInternalValue;
            objectTypeProp.uiValue = defaultTaskTemplate.propDisplayValue;
        }
    }
};

/**
 * Populate the task template object types based on selected task template object selected
 * in based on ui value.
 *
 * @param {Object} data Data view model object
 * @param {Object} selectedTaskTemplateProp Property object value
 * @param {Array} templateTypes Template object types array
 */
export let populateValidTaskTemplateTypes = function( data, selectedTaskTemplateProp, templateTypes ) {
    var taskTypeList = Awp0WorkflowDesignerUtils.getValidTaskTemplateTypeList( selectedTaskTemplateProp, templateTypes );
    let validTaskTemplateTypes = taskTypeList;
    // Check if valid template selected then select the defualt value in LOV control
    if( selectedTaskTemplateProp && taskTypeList && taskTypeList[ 0 ] ) {
        var valueToFind = selectedTaskTemplateProp.type;
        // In case of None we need to select the default Task template in LOV
        if( !valueToFind ) {
            valueToFind = 'EPMTaskTemplate';
        }

        var defaultTaskTemplate = _.find( taskTypeList, function( templateType ) {
            return templateType.propInternalValue === valueToFind;
        } );
        if( defaultTaskTemplate ) {
            data.workflowTaskTemplateObjectType.dbValue = defaultTaskTemplate.propInternalValue;
            data.workflowTaskTemplateObjectType.uiValue = defaultTaskTemplate.propDisplayValue;
        }
    }
    return validTaskTemplateTypes;
};

/**
 * Get the based template object uid that needs to be passed to create the process or task template.
 *
 * @param {Object} data Data view model object
 *
 * @returns {Object} Based template Uid string
 */
export let getSelectedBaseTemplateUid = function( data ) {
    var baseTemplateUid = '';
    // Check if user is trying to create the task template then only find the origianl OOTB
    // task template object based on type and object name property and then only pass to server
    if( data.createTaskTemplateType.dbValue === 'task' && data.workflowTaskTemplates.dbValue ) {
        baseTemplateUid = data.workflowTaskTemplates.dbValue.uid;
        if( !baseTemplateUid ) {
            baseTemplateUid = '';
            var defaultTaskTemplate = _.find( data.taskTemplates, function( taskTemplate ) {
                return taskTemplate.propInternalValue && taskTemplate.propInternalValue.type === 'EPMTaskTemplate'
                && taskTemplate.propInternalValue.props.object_name.dbValues && taskTemplate.propInternalValue.props.object_name.dbValues[0] === 'Task';
            } );
            if( defaultTaskTemplate && defaultTaskTemplate.propInternalValue ) {
                baseTemplateUid = defaultTaskTemplate.propInternalValue.uid;
            }
        }
    } else {
        baseTemplateUid = data.workflowProcessTemplates.dbValue.uid;
    }
    return baseTemplateUid;
};

/**
 * Get the additional data that needs to be passed to create the workflow or task template.
 *
 * @param {Object} data Data view model object
 *
 * @returns {Object} Additional data that will be used to create the object
 */
export let getCreateAdditionalData = function( data ) {
    var additionalData = {
        stage: [ '1' ]
    };
    // Check if user is trying to create task template then we need to pass the
    // additional selected task template type as well so that correct type can be set on newly
    // created task template object
    if( data.createTaskTemplateType.dbValue === 'task' ) {
        var value = data.workflowTaskTemplateObjectType.dbValue;
        if( value ) {
            additionalData.task_type = [ value ];
        }
    }
    return additionalData;
};

export default exports = {
    populatePanelData,
    createTaskTemplateTypeChangeAction,
    getTaskTemplateObjectTypeList,
    getSelectedBaseTemplateUid,
    getCreateAdditionalData,
    selectDefaultTaskTemplateType,
    populateValidTaskTemplateTypes
};
