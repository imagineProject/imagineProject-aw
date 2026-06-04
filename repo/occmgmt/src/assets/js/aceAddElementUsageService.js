// Copyright (c) 2024 Siemens

/**
 * @module js/aceAddElementUsageService
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};
const _ABSDESGINPRODUCTREVISION = 'Fnd0AbsDgnProdRevision';
const _PARTITIONELEMENT = 'Fgf0PartitionElement';

/**
* check if given value is there in the preference values
* @param {Object} preferenceValues This is  name of the preference
* @param {Object} value This the value that to be found out from values in preference.
* @returns {boolean} This function will return true if the value is there in the preference else false
*/
let _preferenceHasValue = function( preferenceValues, value ) {
    if( preferenceValues && preferenceValues.indexOf( value ) !== -1 ) {
        return true;
    }
    return false;
};

/**
* check whether usage needs to create or not.
* @internal
* @param {Object} rootElement root element of selected object ACE location
* @param {Object} selectedObjects Selected object in the PWA
* @param {Object} addElementState addElementState
* @returns {boolean} This function will return true if the usage is supported else false
*/
//LCS-990464: TODO::The below logic needs to move on the server side.
export let shouldUsageToBeCreated = function( rootElement, selectedObjects, addElementState ) {
    if( selectedObjects?.length > 0 && rootElement?.props?.awb0UnderlyingObjectType ) {
        var selectedObject = _.last( selectedObjects );
        let rootElementType = rootElement.props.awb0UnderlyingObjectType.dbValues[0];
        let collabRevisionPreferences = appCtxService.ctx.preferences.FND0_COLLABORATIVE_ITEMREVISION_TYPES;
        if(  addElementState.siblingElements.length === 0 ) {
            //add child use case
            if( selectedObject.props.awb0UnderlyingObjectType !== undefined ) {
                var selectedObjectUnderlyingObjType = selectedObject.props.awb0UnderlyingObjectType.dbValues[0];
            }
            // For selected Object
            if( _preferenceHasValue( collabRevisionPreferences, selectedObjectUnderlyingObjType ) ) {
                return true;
            }
            // For Partition selection Scenario.
            if( selectedObject.modelType.typeHierarchyArray.indexOf( _PARTITIONELEMENT ) > -1 && _preferenceHasValue( collabRevisionPreferences, rootElementType ) ) {
                return true;
            }
        }else{
            //Add sibling use case
            var siblingElement = _.last(addElementState.siblingElements);            
            let parentVMO = cdm.getObject( siblingElement.props.awb0Parent.dbValues[0] );
            let parsistentModelObject = cdm.getObject( rootElement.props.awb0UnderlyingObject.dbValues[0] );
            if( parentVMO && ( parentVMO.props.awb0UnderlyingObjectType && _preferenceHasValue( collabRevisionPreferences, parentVMO.props.awb0UnderlyingObjectType.dbValues[0] ) ||
                parentVMO.type === _PARTITIONELEMENT && parsistentModelObject.modelType && parsistentModelObject.modelType.typeHierarchyArray.indexOf( _ABSDESGINPRODUCTREVISION ) > -1 ) ) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Below function calls updates the addElementState with occurrence type.
 *  @internal
 *  @param {object} - addElementState - addElementState
 *  @param {object} - occurrenceTypeInfo - occurrence information
 */
export let updateAddElementStateWithOccurrenceType = function( addElementState, occurrenceTypeInfo ) {
    let elementState = { ...addElementState.value };
    elementState.occurrenceTypeName = occurrenceTypeInfo.preferredType;
    addElementState.update( elementState );
};
/**
 * Add Element usage service
 */

export default exports = {
    shouldUsageToBeCreated,
    updateAddElementStateWithOccurrenceType
};
