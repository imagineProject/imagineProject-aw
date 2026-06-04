// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Service which provides helper methods for CadPage requests.
 *
 * @module js/cadPageRequestsUtils
 *
 */
import logger from 'js/logger';

/**
 * Compute CSID path
 *
 * @param {Object} currModelObject - The current model object.
 * @param {Object} bomLineModelObjects - The BOM line model objects.
 * @param {Object} topBOMLine - The top BOM line.
 * @param {Map} uidToCsidChainMap - The map of BOM line UID to CSID.
 * @returns {String} The CSID path.
 */
export const computeCsidPath = ( currModelObject, bomLineModelObjects, topBOMLine, uidToCsidChainMap ) => {
    let csid_path = '';
    if( currModelObject && currModelObject.props && currModelObject.props.bl_parent && currModelObject.props.bl_parent.dbValues[0] ) {
        while( currModelObject ) {
            let currModelObjectCsidChain = uidToCsidChainMap.get( currModelObject.uid );
            if( currModelObjectCsidChain ) {
                csid_path = currModelObjectCsidChain + '/' + csid_path;
                break;
            }
            let props = currModelObject.props;
            if( props.bl_parent && props.bl_clone_stable_occurrence_id ) {
                if( props.bl_clone_stable_occurrence_id.dbValues[ 0 ] ) {
                    csid_path = props.bl_clone_stable_occurrence_id.dbValues[ 0 ] + '/' + csid_path;
                }
                if( props.bl_parent.dbValues[ 0 ] ) {
                    currModelObject = bomLineModelObjects[ props.bl_parent.dbValues[ 0 ] ];
                } else {
                    currModelObject = null;
                }
            } else {
                if( topBOMLine.uid !== currModelObject.uid ) {
                    logger.error( 'CSID Generation failed: The mandatory property bl_parent or bl_clone_stable_occurrence_id is missing. : ' + currModelObject.props );
                }
                break;
            }
        }
        // Remove the trailing / from the csid chain
        if( csid_path.length > 1 ) {
            csid_path = csid_path.slice( 0, csid_path.length - 1 );
        }
    }
    return csid_path;
};

export default {
    computeCsidPath
};
