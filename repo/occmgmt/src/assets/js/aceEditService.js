// Copyright (c) 2022 Siemens

/**
 * @module js/aceEditService
 */
import soaSvc from 'soa/kernel/soaService';

var exports = {};

/**
 * Remove an occurrence.
 *
 * @param {removeElementsFromProductInputData} inputs - Object of removeElementsFromProductInputData type
 */
export let removeElementsFromProduct = function( inputs ) {
    soaSvc.post( 'Internal-ActiveWorkspaceBom-2012-10-OccurrenceManagement', 'removeElementsFromProduct',
        inputs );
};
/**
 * occuremceManagementEditService service utility
 */

export default exports = {
    removeElementsFromProduct
};
