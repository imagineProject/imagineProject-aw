// Copyright (c) 2025 Siemens

/**
 * @module js/Cm1CreateChangeProcessTemplates
 */
import listBoxService from 'js/listBoxService';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';

/**
 * Convert the template objects to LOV values that needs to be shown on UI.
 * This is a helper function, similar to the one in Awp0NewWorkflowProcess.js.
 *
 * @param {Array} templatesObjects - Array of actual ModelObjects (from CDM)
 * @returns {Array} LOV template values array
 */
const _populateTemplateValuesForChange = function(templatesObjects) {
    let templateLOVValues = [];
    if (templatesObjects && !_.isEmpty(templatesObjects)) {
        // Create the list model object that will be displayed
        templateLOVValues = listBoxService.createListModelObjects(templatesObjects, 'props.template_name');
        const templatesObject = templateLOVValues[0];
        let isFnd0InstructionsAvailable = false;

        //Check if fnd0Instructions property is available. If available use fnd0Instructions property as description
        if (templatesObject && templatesObject.propInternalValue && templatesObject.propInternalValue.props.fnd0Instructions) {
            isFnd0InstructionsAvailable = true;
        }

        for (let idx = 0; idx < templateLOVValues.length; idx++) {
            const object = templateLOVValues[idx];
            let descValue = object.propInternalValue.props.object_desc.uiValues[0];
            if (isFnd0InstructionsAvailable) {
                descValue = object.propInternalValue.props.fnd0Instructions.uiValues[0];
            }
            templateLOVValues[idx].propDisplayDescription = descValue;
        }
    }
    return templateLOVValues;
};

/**
 * Get the filter templates from SOA response and return to be shown on UI.
 * This is similar to getWorkflowTemplatesData in Awp0NewWorkflowProcess.js.
 *
 * @param {Object} response SOA response object that contains template values
 *
 * @returns {Object} Returns filter template object
 */
export let getWorkflowTemplatesDataForChange = function(response) {
    let filterTemplates = [];
    if (response && response.templatesOutput) {
        const filterTemplateOutput = response.templatesOutput.filter(object => object.clientId === 'filterTemplates');
        if (filterTemplateOutput.length > 0) {
            filterTemplates = filterTemplateOutput[0].workflowTemplates;
        }
    }
    if (filterTemplates && !_.isEmpty(filterTemplates)) {
        filterTemplates = _populateTemplateValuesForChange(filterTemplates);
    }
    return {
        filterTemplates: filterTemplates
    };
};

/**
 * Populate the panel data based on selected type and templates data.
 * This is similar to populatePanelData in Awp0NewWorkflowProcess.js.
 *
 * @param {Object} templatesData - Template data object that contains filter template list
 * @param {Object} subPanelContext - The subPanelContext object
 * @param {Object} processTemplatesProp - The awp0ProcessTemplates property object to update.
 *
 * @returns {Object} Object with updated info need to be shown on UI.
 */
export let populateChangeProcessTemplates = function(templatesData, subPanelContext, processTemplatesProp) {
    if (!templatesData) {
        return {
            templateList: [],
            awp0ProcessTemplates: processTemplatesProp
        };
    }

    // Only use filtered templates - no fallback to all templates
    // If no filtered templates are available, user will see an empty list
    const templates = templatesData.filterTemplates || [];
    const updatedProcessTemplatesProp = { ...processTemplatesProp };

    // Default selection logic: select the first available template.
    const validTemplate = templates.find(function (template) {
        return template && template.propInternalValue && template.propInternalValue.uid &&
            template.propDisplayValue && template.propDisplayValue !== '';
    });

    // Store the internal template name from template_name.dbValues for workflow processing
    const internalTemplateName = validTemplate?.propInternalValue?.props?.template_name?.dbValues?.[0] || '';

    updatedProcessTemplatesProp.dbValue = internalTemplateName;
    updatedProcessTemplatesProp.uiValue = validTemplate?.propDisplayValue || '';
    updatedProcessTemplatesProp.value = internalTemplateName;

    // Disable the awp0ProcessTemplates field if the subPanelContext's declarativeKeyContext is set to 'disabled'
    if (subPanelContext?.declarativeKeyContext === 'disabled') {
        updatedProcessTemplatesProp.isEditable = false;
    }

    return {
        templateList: templates, // The list of LOV values for the dataProvider
        awp0ProcessTemplates: updatedProcessTemplatesProp // The updated property for the UI component
    };
};

/**
 * This method is used to make the typeHierarchyArray from the response
 * @param {Object} response - response from getTypeDescriptions2
 * @returns {Array} - typeHierarchyArray of selected Change item
 */
export let getTypeInformation = function(response) {
    let typeList = [];
    if (response?.types?.length > 0) {
        const allTypes = response.types[0].typeHierarchy.split(',');
        for (let inx = 0; inx < allTypes.length; ++inx) {
            if (allTypes[inx] === 'ChangeItemRevision') {
                break;
            }
            typeList.push(allTypes[inx]);
        }
    }

    return typeList;
};

/**
 * This method is used to get selected type from xrtState for change template loading
 * @param {Object} xrtTypeLoaded - The xrtTypeLoaded object containing type information
 * @returns {String} - returns selected Change item revision type
 */
export let getSelectedType = function(xrtTypeLoaded) {
    if (xrtTypeLoaded && xrtTypeLoaded.type) {
        let targetTypeName = xrtTypeLoaded.type;

        if (cmm.isInstanceOf('Item', cmm.getType(targetTypeName)) && !targetTypeName.endsWith('Revision')) {
            targetTypeName += 'Revision';
        }

        return [targetTypeName]; // Return as array of type names
    }
    return [];
};

/**
 * This method is used to update the process templates in xrtState
 * @param {Object} processTemplates - selected workflow process templates.
 * @param {Object} xrtState - xrtState of create change panel based on selected type
 */
export let updateXrtVMOProps = function(processTemplates, xrtState) {
    let creI = xrtState?.getValue()?.xrtVMO?.modelType?.name;
    const newXrtState = { ...xrtState?.getValue?.() };
    if( newXrtState?.xrtVMO?.props ) {
        newXrtState.xrtVMO.props.awp0ProcessTemplates = processTemplates;
        newXrtState.xrtVMO.props.awp0ProcessTemplates.propertyName = `REF(revision,${ creI }).awp0ProcessTemplates`;
    }
    xrtState?.update?.( newXrtState );
};

export default {
    getWorkflowTemplatesDataForChange,
    populateChangeProcessTemplates,
    getTypeInformation,
    getSelectedType,
    updateXrtVMOProps
};