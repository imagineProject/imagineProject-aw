// Copyright (c) 2022 Siemens

/**
 * This represents the Clone Stable ID (CSID) generator module
 *
 *
 * @module js/aceObjectToCSIDGeneratorService
 */
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import logger from 'js/logger';
import _ from 'lodash';

var exports = {};

// service and module references

/**
 * Function to compute the clone stable chain id for the given Awb0Element model object. The following
 * properties: awb0Parent and awb0CopyStableId are required to be loaded.
 *
 * @param modelObject Awb0Element instance for which the clone stable chain id need to be computed
 *
 * @return uid the clone stable uid
 */
export let getCloneStableIdChain = function( modelObject, style ) {
    if( modelObject && modelObject.props ) {
        if( _.isEqual( style, 'TreeStyleCsidPath' ) ) {
            //above check ensure call is made for tree construction and not for visualization
            return computeCsidChainUsingCopyStableIDForVMNode( modelObject );
        }
        //this is visulization case
        if( modelObject.props.awb0CsidPath && modelObject.props.awb0CsidPath.dbValues[0] ) {
            //this confirms partition applied mode for 3D visualization
            //as this prop is present only for partitioned BVR structure
            return  modelObject.props.awb0CsidPath.dbValues[0];
        }
        //normal BVR visulization case.
        return computeCsidChainUsingCopyStableID( modelObject );
    }
    throw 'Invalid object passed as input.';
};

/**
 * Function to compute the clone stable id chain equivalent to the clone stable id chain
 * present in the stable_id property in getOccurrences SOA response
 *
 * computeCsidChainUsingCopyStableID does not add the top item UID as the first entry in the csid
 * chain, whereas the csid chain in stable_id has the top item UID as the first entry. This leads
 * to an inconsistency in the csid chain stored in the VM node in some use cases.
 *
 * This method will return the exact same csid chain as present in the stable_id property, so the VM node
 * will have a consistent csid chain regardless of whether it is populated from stable_id or using this method
 */
let computeCsidChainUsingCopyStableIDForVMNode = function( modelObject ) {
    var currModelObject = modelObject;
    var csid_path = '';

    // If we are dealing with the top line, return only / as its csid chain
    if( currModelObject.props && currModelObject.props.awb0Parent && !currModelObject.props.awb0Parent.dbValues[ 0 ] ) {
        csid_path = '/';
        return csid_path;
    }

    while( currModelObject ) {
        var props = currModelObject.props;
        if( props.awb0Parent && props.awb0CopyStableId ) {
            // If we have reached the top line it will not have a copy stable id, instead add the top item UID to the csid chain
            if( !props.awb0CopyStableId.dbValues[ 0 ] ) {
                if( props.awb0UnderlyingObject ) {
                    var underlyingObject = clientDataModelSvc.getObject( props.awb0UnderlyingObject.dbValues[ 0 ] );
                    if( underlyingObject && underlyingObject.props.items_tag ) {
                        csid_path = underlyingObject.props.items_tag.dbValues[ 0 ] + '/' + csid_path;
                    }
                }
            } else {
                csid_path = props.awb0CopyStableId.dbValues[ 0 ] + '/' + csid_path;
            }
            currModelObject = clientDataModelSvc.getObject( props.awb0Parent.dbValues[ 0 ] );
            if( !currModelObject ) {
                break;
            }
        } else {
            logger
                .trace( 'CSID Generation failed:  The mandatory property awb0Parent or awb0CopyStableId is missing.' );
            break;
        }
    }

    // Remove the trailing / from the csid chain
    if( csid_path.length > 1 ) {
        csid_path = csid_path.slice( 0, csid_path.length - 1 );
    }
    return csid_path;
};

let computeCsidChainUsingCopyStableID = function( modelObject ) {
    var currModelObject = modelObject;
    var csid_path = '';
    while( currModelObject ) {
        var props = currModelObject.props;
        if( props.awb0Parent && props.awb0CopyStableId ) {
            csid_path = props.awb0CopyStableId.dbValues[ 0 ] + '/' + csid_path;
            currModelObject = clientDataModelSvc.getObject( props.awb0Parent.dbValues[ 0 ] );
            if( !currModelObject ) {
                break;
            }
        } else {
            logger
                .trace( 'CSID Generation failed:  The mandatory property awb0Parent or awb0CopyStableId is missing.' );
            break;
        }
    }

    //Remove the leading and trailing /
    if( csid_path.length > 1 ) {
        csid_path = csid_path.slice( 1, csid_path.length - 1 );
    }
    return csid_path;
};


export default exports = {
    getCloneStableIdChain
};
