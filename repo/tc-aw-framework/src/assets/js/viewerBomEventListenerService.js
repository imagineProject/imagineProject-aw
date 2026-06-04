// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Provide service to register/deregister bom event listener
 *
 * @module js/viewerBomEventListenerService
 */

import soaSvc from 'soa/kernel/soaService';
import dms from 'soa/dataManagementService';

/**
 *  Register for delta update BOM event listener
 * @param {Object} bomWindow - Bom window object
 * @returns {response} - The response
 */
const registerForBomEventListener = ( bomWindow ) => {
    return _deltaUpdateRegistrationRequest( bomWindow, 'Start' );
};

/**
 *  Deregister for delta update BOM event listener
 * @param {Object} bomWindow - Bom window object
 * @returns {response} - The response
 */
const deregisterForBomEventListener = ( bomWindow ) => {
    return _deltaUpdateRegistrationRequest( bomWindow, 'Stop' );
};


/**
 * Delta update registration request
 * @param {Array} bomWindow - BOM Window Object
 * @param {String} clientState - The client state
 * @returns {response} - The response
 */
const _deltaUpdateRegistrationRequest = ( bomWindow, clientState ) => {
    if ( !bomWindow ) {
        throw new Error( 'No BOM Window objects found' );
    }
    const soaInput = {
        inputBOMWindows: [ bomWindow ],
        deltaOptions: {
            strToStringVectorMap: {
                ClientState: [ clientState ]
            }
        }
    };
    return soaSvc.post( 'Internal-Visualization-2023-06-StructureManagement', 'getDeltaUpdatesOnSharedBOMWindows', soaInput )
        .catch( ( error ) => {
            throw new Error( 'Error in getting delta update: ' + error );
        } );
};

/**
 * Get BOM window
 * @param {Array} backingObject - The backing object
 * @returns {bomWindow} - The bom window
 */
const getBomWindow = async( backingObject ) => {
    const info = await dms.getPropertiesUnchecked( [ backingObject ], [ 'bl_window' ] );
    if( !info.modelObjects[ backingObject.uid ] ) {
        throw new Error( 'No model object found' );
    }
    const bomLineObject = info.modelObjects[ backingObject.uid ];
    const blWindowUid = bomLineObject.props.bl_window.dbValues[ 0 ];
    return info.modelObjects[ blWindowUid ];
};

export default {
    registerForBomEventListener,
    deregisterForBomEventListener,
    getBomWindow
};
