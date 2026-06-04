// Copyright (c) 2022 Siemens

/**
 * @module js/checkoutUtils
 */

import adapterService from 'js/adapterService';

let exports = {};


export const getCheckoutableAdaptedObjects = ( selectedObjects ) => {
    const adaptedObjects = adapterService.getAdaptedObjectsSync( selectedObjects );

    let checkoutInput = [];

    for( const object of adaptedObjects ) {
        if( object.modelType?.typeHierarchyArray.indexOf( 'WorkspaceObject' ) > -1 ) {
            checkoutInput.push( object );
        }
    }

    return checkoutInput;
};

export default exports = {
    getCheckoutableAdaptedObjects
};
