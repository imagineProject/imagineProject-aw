// Copyright (c) 2024 Siemens

/**
 * Service defines functionality related to automated updates
 * @module js/cbaAutomatedUpdateService
 */

import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cbaConstants from 'js/cbaConstants';
import cdmSvc from 'soa/kernel/clientDataModel';
import logger from 'js/logger';

/**
 * Update OccContext after automated update
 * @param { object } occContext - OccContext to update
 * @param { object } topNode - new top node 
 */
export const updateOccContextPostAutomatedUpdate = function( occContext, topNode ) {
    if( topNode &&  occContext.value.currentState.uid && topNode.uid !== occContext.value.currentState.uid ) {
        let occContextValue = { ...occContext.value };
        occContextValue.currentState.uid = topNode.uid;
        delete occContextValue.currentState.pci_uid;
        delete occContextValue.currentState.t_uid;

        occContext.update( occContextValue );

        const isTargetUpdated = occContext.viewKey === cbaConstants.CBA_TRG_CONTEXT;
        let currentState = {};
        if( isTargetUpdated ) {
            currentState.uid2 = topNode.uid;
            currentState.t_uid2 = undefined;
            currentState.trg_uid = undefined;
            currentState.o_uid2 = undefined;
        } else{
            currentState.uid = topNode.uid;
            currentState.t_uid = undefined;
            currentState.src_uid = undefined;
            currentState.o_uid = undefined;
        }
        CadBomOccurrenceAlignmentUtil.addParametersOnUrl( currentState );
    }
};

/**
 * Check if model object is a new revision of the target item
 * @param { object } modelObj - Model object to check
 * @param { string } itemId - Target item ID
 * @param { string } itemRev - Target item revision
 * @returns { boolean } true if model object is a new revision
 */
const _isNewRevision = ( modelObj, itemId, itemRev ) => {
    const objItemId = modelObj?.props?.item_id?.dbValues?.[0];
    const objItemRev = modelObj?.props?.item_revision_id?.dbValues?.[0];
    return objItemId && objItemRev && itemId === objItemId && itemRev !== objItemRev;
};

/**
 * Process automated update response
 * @param { object } response Automated update response
 * @param { object } commandContext Command context from where autoated update performed
 * @returns { object } new revision of target top
 */
export const processAutomatedUpdateResponse = function( response, commandContext ) {
    let updatedModelObject;
    if( response && commandContext?.cbaContext ) {
        const isDBOMToEBOMAutoUpdate = commandContext.contextKey === cbaConstants.CBA_SRC_CONTEXT;
        let targetStructure = isDBOMToEBOMAutoUpdate ? commandContext.cbaContext.trgStructure : commandContext.cbaContext.srcStructure;
        if( !targetStructure ) {
            logger.debug( 'Target structure not found in the command context' );
            return updatedModelObject;
        }

        let targetItemId = targetStructure?.props?.item_id?.dbValues?.[0];
        let targetItemRev = targetStructure?.props?.item_revision_id?.dbValues?.[0];

        if( !targetItemId || !targetItemRev ) {
            logger.debug( 'Target item ID or revision not found in the structure' );
            return updatedModelObject;
        }

        if( !response.modelObjects ) {
            logger.debug( 'No model objects found in the automated update response' );
            return updatedModelObject;
        }

        let responseModelObjects = response.modelObjects;
        for ( const modelObject of Object.values( responseModelObjects ) ) {
            if( _isNewRevision( modelObject, targetItemId, targetItemRev ) ) {
                updatedModelObject = modelObject;
                logger.debug( 'New revision found in the automated update response' );
                break;
            }
        }

        if( updatedModelObject ) {
            let viewModelObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmSvc.getObject( updatedModelObject.uid ), null );

            const srcOrTrgStructure = isDBOMToEBOMAutoUpdate ? 'trgStructure' : 'srcStructure';
            occmgmtUtils.updateValueOnCtxOrState( srcOrTrgStructure, viewModelObject, commandContext.cbaContext );
            occmgmtUtils.updateValueOnCtxOrState( srcOrTrgStructure, viewModelObject, 'cbaContext' );
        }
    }
    return updatedModelObject;
};
/**
 * CBA Automated Update Service
 */

const exports = {
    updateOccContextPostAutomatedUpdate,
    processAutomatedUpdateResponse
};
export default exports;
