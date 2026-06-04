// Copyright (c) 2022 Siemens

/**
 * @module js/partitionAddPartitionService
 */
import aceAddElementService from 'js/aceAddElementService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};
const _ABSDESGINPRODUCTREVISION = 'Fnd0AbsDgnProdRevision';

/*
 * The Function returns the topline SRUID.
 * 1 Under Workset Hierarchy it finds the topline uid by searching in the elementToPCIMap using pci_uid
 * 2 If not under Workset it returns the t_uid.
 */
export let getProductTopLine = function( occContext ) {
    let product = cdm.getObject( occContext.currentState.uid );
    if ( product.type === 'Fnd0WorksetRevision' || product.type === 'Fnd0AppSession' ) {
        return _.findKey( occContext.elementToPCIMap, _.matches( occContext.currentState.pci_uid ) );
    }
    return occContext.currentState.t_uid;
};


/*
 * Wrapper for setStateAddElementInputParentElementToSelectedElement from aceAddElementService
 */
export let setStateAddElementInputParentElementToSelectedElement = function( newAddElementState, occContext ) {
    var selectedObjects = occContext.pwaSelection;
    var parentToLoadAllowedTypes = getProductTopLine( occContext );
    if ( parentToLoadAllowedTypes !== null ) {
        return aceAddElementService.setStateAddElementInputParentElementToSelectedElement( selectedObjects, newAddElementState, parentToLoadAllowedTypes );
    }
};

/**
 * Determines the panel ID to be used for adding a member based on the type of the root element.
 *
 * @param {Object} rootElement - The root element containing the underlying object type.
 * @returns {string} - The panel ID to be used for adding a member.
 */
export let getAddMemberPanelId = function( rootElement ) {
    let rootElementType = rootElement.props.awb0UnderlyingObject.dbValues[0];
    let rootObject = cdm.getObject( rootElementType );
    if( rootObject.modelType.typeHierarchyArray.indexOf( _ABSDESGINPRODUCTREVISION ) > -1 ) {
        return 'PartitionAddMember';
    }
    return 'Awb0AddChildElementDeclarative';
};

export default exports = {
    getProductTopLine,
    setStateAddElementInputParentElementToSelectedElement,
    getAddMemberPanelId
};
