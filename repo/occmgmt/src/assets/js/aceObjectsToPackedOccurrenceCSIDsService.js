// Copyright (c) 2022 Siemens

/**
 * Defines a service that can accept product and set of model objects return chain of Clone Stable Ids (CSIDs) of packed
 * occurrences corresponding to those.
 *
 * @module js/aceObjectsToPackedOccurrenceCSIDsService
 */
import _cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import acePartialSelectionService from 'js/acePartialSelectionService';

let exports = {};

export let isPackedOccurrencePresentInParentHierarchy = function( selectedObject ) {
    if( !( selectedObject && selectedObject.props && selectedObject.props.awb0IsPacked ) ) {
        // awb0IsPacked is not present in property policy
        // decision can not be made whether selected object or its parent are packed occurrences
        // return true to make getPackedOccurrenceCSIDs SOA call
        return true;
    }

    if( !( selectedObject && selectedObject.props && selectedObject.props.awb0QuantityManaged ) ) {
        // awb0QuantityManaged is not present in property policy
        // decision can not be made whether selected object or its parent are quantity managed occurrences
        // return true to make getPackedOccurrenceCSIDs SOA call
        return true;
    }

    let object = selectedObject;
    while( object && object.props && object.props.awb0Parent && !_.isEmpty( object.props.awb0Parent.dbValues[ 0 ] ) ) {
        if( object.props && object.props.awb0IsPacked && _.isEqual( object.props.awb0IsPacked.dbValues[ 0 ], '1' ) ) {
            // if any of the occurrence in parent hierarchy is packed
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        if( !( object.props && object.props.awb0IsPacked ) ) {
            // if any of the parent do not have the awb0IsPacked or awb0QuantityManaged property
            // decision can not be made whether selected object or its parent are packed occurrences
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        if( object.props && ( !object.props.awb0QuantityManaged || !_.isEqual( object.props.awb0QuantityManaged.dbValues[ 0 ], '0' ) ) ) {
            // if any of the parent do not have the awb0QuantityManaged property
            // decision can not be made whether selected object or its parent are packed occurrences
            // or if any of the parent is quantity managed then
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        let parentUid = object.props.awb0Parent.dbValues[ 0 ];
        object = _cdm.getObject( parentUid );
    }
    // we do not have any packed occurrences in parent hierarchy
    // return false, to avoid making getPackedOccurrenceCSIDs SOA call for selectedObject
    return false;
};

/**
 * Retrieves clone stable IDs for packed occurrences from selected objects.
 * 
 * Filters selected objects to identify those with packed occurrences in their parent hierarchy,
 * excluding partially selected objects unless they are quantity managed. Makes a SOA service call
 * to retrieve the packed occurrence CSIDs for the filtered objects.
 * 
 * @param {Object} productContextInfo - The product context information for the operation
 * @param {Array} selectedObjects - Array of selected objects to process
 * @returns {Promise|undefined} Promise resolving to packed occurrence CSIDs, or undefined if no valid objects found
 * @throws {Error} May throw errors from the SOA service call
 */
export let getCloneStableIDsWithPackedOccurrences = function( productContextInfo, selectedObjects ) {
    let packedOccurrenceInputObjects = [];
    // Fix for Defect - LCS-1309855
    // In case of packed/unpacked lines, pack master is selected then no partial selection as Visible Element and Element are same,
    // so we need to consider the pack master for getting the packed occurrence CSIDs. 
    // For Quantity managed(Summary/Exploded) cases we need ignore the partially selected objects and fetch CSIDs as 
    // there will always partial selection as we dont show exploded lines in tree.

    _.forEach( selectedObjects, function( selectedObject ) {
        if( isPackedOccurrencePresentInParentHierarchy( selectedObject ) &&
             !acePartialSelectionService.isPartiallySelected( selectedObject.uid )  ) {
            packedOccurrenceInputObjects.push( selectedObject );
        }
    } );

    if( packedOccurrenceInputObjects.length === 0 ) {
        return;
    }

    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2017-12-OccurrenceManagement',
        'getPackedOccurrenceCSIDs', {
            occurrences: selectedObjects,
            productContextInfo: productContextInfo
        }, {} );
};

export default exports = {
    getCloneStableIDsWithPackedOccurrences,
    isPackedOccurrencePresentInParentHierarchy
};
