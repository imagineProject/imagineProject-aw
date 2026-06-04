// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ClaimTask
 */
import cdmSvc from 'soa/kernel/clientDataModel';
import inboxSvc from 'js/aw.inbox.service';

/**
  * Define public API
  */
var exports = {};

/**
  * Get the supporting object for claim action.
  *
  * @param {object} selectedObjection Selected object for claim action will be perfomed
  *
  *  @return {Object} Supporting object that need to be claimed
  */
export let getClaimSupportingObject = function( selectedObjection ) {
    var supportingObject = null;
    if( selectedObjection !== null && selectedObjection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        var supportingObjectUid = selectedObjection.uid;
        if( supportingObjectUid !== null && supportingObjectUid !== '' ) {
            supportingObject = cdmSvc.getObject( supportingObjectUid );
        }
    }
    return supportingObject;
};

/**
  * Get the action object for claim action. If user selects the signoff object then it will return
  * parent PS task object
  *
  * @param {object} selectedObjection Selected object for claim action will be perfomed
  *
  *  @return {Object} Action object that need to be claimed
  */
export let getActionableObject = function( selectedObjection ) {
    if( !selectedObjection || !selectedObjection.uid ) {
        return;
    }
    return inboxSvc.getValidEPMTaskObject( selectedObjection.uid );
};

/**
  * This factory creates a service and returns exports
  *
  * @member Awp0ClaimTask
  */

export default exports = {
    getClaimSupportingObject,
    getActionableObject
};
