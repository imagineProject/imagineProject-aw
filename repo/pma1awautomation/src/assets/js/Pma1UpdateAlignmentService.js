// Copyright (c) 2021 Siemens

/**
 * Update Alignment Service
 * @module js/Pma1UpdateAlignmentService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cbaOccAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cdmSvc from 'soa/kernel/clientDataModel';
import Pma1Constants from 'js/Pma1Constants';
import cbaConstants from 'js/cbaConstants';

/**
 * Get workflow details which contains name, description, workflow template name and attachments.
 * @param {string} selectedUnderlyingObjectUID - UID of selected object which is attachment for workflow
 * @param {string} targetBOMTypeToCreate - Valid parameters: Design, Part, ProductEBOM
 *
 * @returns {object} Workflow details object
 */
export const getWorkflowDetails = async function( selectedUnderlyingObjectUID, targetBOMTypeToCreate ) {
    const underlyingObj = cdmSvc.getObject( selectedUnderlyingObjectUID );
    const workflowProcessTemplate = await getWorkflowProcessTemplate( underlyingObj, targetBOMTypeToCreate );
    const name = workflowProcessTemplate + ' - ' + _.get( underlyingObj, 'props.object_name.uiValues', undefined );
    return {
        name: name,
        description: name,
        wfProcessTemplate: workflowProcessTemplate,
        wfAttachments: [ underlyingObj.uid ],
        isUpdateBOMWorkflow: workflowProcessTemplate === Pma1Constants.WORKFLOW_TEMPLATE_UPDATE_DBOM || workflowProcessTemplate === Pma1Constants.WORKFLOW_TEMPLATE_UPDATE_EBOM,
        isCreatePartEBOMWorkflow: workflowProcessTemplate === Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_PART_EBOM,
        isCreateProductEBOMWorkflow: workflowProcessTemplate === Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_PRODUCT_EBOM,
        isCreateDesignBOMWorkflow: workflowProcessTemplate === Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_DESIGN_BOM
    };
};

/**
 * Get workflow process template
 * @param {object} selectedUnderlyingObject - Selected object which is attachment for workflow
 * @param {string} targetBOMTypeToCreate - Valid paramaters: Design, Part, ProductEBOM
 *
 * @returns {string} Workflow Template name
 */
export const getWorkflowProcessTemplate = async function( selectedUnderlyingObject, targetBOMTypeToCreate ) {
    let workflowProcessTemplate;
    if( targetBOMTypeToCreate ) {
        if( targetBOMTypeToCreate === cbaConstants.DESIGN ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_DESIGN_BOM;
        } else if( targetBOMTypeToCreate === cbaConstants.PART ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_PART_EBOM;
        } else if( targetBOMTypeToCreate === cbaConstants.PRODUCT_EBOM ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_GENERATE_PRODUCT_EBOM;
        }
    } else { // Update Engineering/Design BOM Workflow
        const result = await cbaObjectTypeService.getDesignsAndParts( [ selectedUnderlyingObject ] );
        if( result.designTypes.includes( selectedUnderlyingObject ) ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_UPDATE_EBOM;
        } else if( result.partTypes.includes( selectedUnderlyingObject ) ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_UPDATE_DBOM;
        } else if( result.productTypes.includes( selectedUnderlyingObject ) ) {
            workflowProcessTemplate = Pma1Constants.WORKFLOW_TEMPLATE_UPDATE_DBOM;
        }
    }
    return workflowProcessTemplate;
};

/**
 * Get child objects for a given selected node to perform refresh action
 * @param {object} modelObject - selected model object
 *
 * @returns {Array} array of child object for the given selected object
 */
export const getObjectsToRefresh = function( modelObject ) {
    let objectsToRefresh = [];
    const index = appCtxSvc.ctx.aceActiveContext.context.vmc.findViewModelObjectById( modelObject.uid );
    if( index > -1 ) {
        const selectedVMO = appCtxSvc.ctx.aceActiveContext.context.vmc.getViewModelObject( index );
        objectsToRefresh = cbaOccAlignmentUtil.getChildrenForVMO( selectedVMO );
        objectsToRefresh.push( selectedVMO );
    }
    return objectsToRefresh;
};

const exports = {
    getWorkflowProcessTemplate,
    getWorkflowDetails,
    getObjectsToRefresh
};

export default exports;
