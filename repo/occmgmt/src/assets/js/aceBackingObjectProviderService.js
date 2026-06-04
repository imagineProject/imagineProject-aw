// Copyright (c) 2022 Siemens

/**
 * Helper API ( getBackingObjects ) to get the backing object's from viewModelObject's of type Awb0Element.
 * Custom code should use this async API to get the backing object's based on the input Awb0Element's.
 * @module js/aceBackingObjectProviderService
 */
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import logger from 'js/logger';

var exports = {};

/**
 * @constructor
 */
var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
 * Async function to get the backing object's for input viewModelObject's.
 * viewModelObject's should be of type Awb0Element.
 * @param {Object} viewModelObjects - of type Awb0Element
 * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
 *
 */
export let getBackingObjects = function( viewModelObjects ) {
    let deferred = AwPromiseService.instance.defer();
    let allLines = getBackingObjectsSync( viewModelObjects );
    deferred.resolve( allLines );
    return deferred.promise;
};

/**
 * API to get the backing object's for input viewModelObject's.
 * viewModelObject's should be of type Awb0Element.
 * @param {Object} viewModelObjects - of type Awb0Element
 * @return {Object} requested backing objects
 */
export let getBackingObjectsSync = function( viewModelObjects ) {
    var bomAdapter = 'AWBCB';
    const asmaintainedAdapter = 'AWBASM';
    var bomLines = [];
    var allLines = [];

    _.forEach( viewModelObjects, function( modelObject, index ) {
        if( modelObject ) {
            switch ( true ) {
                //BOMLine Or Ptn0PartitionLine
                case modelObject.uid.endsWith( bomAdapter ):
                case modelObject.uid.endsWith( asmaintainedAdapter ):
                    bomLines[ index ] = modelObject;
                    break;
                default:
                    logger.warn( 'Object type not supported for getBackingObjectsSync()' );
                    allLines[index] = null;
            }
        } else {
            throw 'Unknown Input element. backing Object provider not supported';
        }
    } );

    if( bomLines.length ) {
        getBomLines( bomLines );
        _.forEach( bomLines, function( bomLine, index ) {
            allLines[ index ] = bomLine;
        } );
    }
    return allLines;
};

//BOMLine Or Ptn0PartitionLine
let getBomLines = function( viewModelObjects ) {
    _.forEach( viewModelObjects, function( modelObject, index ) {
        var modelObjectUid = modelObject.uid;
        if( modelObjectUid ) {
            // Get the index of the BOMLine in the uid
            var bomLineUidIndex = modelObjectUid.indexOf( '..' );
            if( bomLineUidIndex !== -1 ) {
                // Add the length of the Element type and add 2 for .. to reach the start of the backing BOMLine uid
                bomLineUidIndex += 2;
            }

            // Get the index of the adapter at the end of the uid which is after ,,
            var suffixIndex = modelObjectUid.indexOf( ',,' );

            // Get the backing BOMLine uid
            var uid = modelObjectUid.substring( bomLineUidIndex, suffixIndex );

            // Remove Saved BookMark uid if it exists
            if( uid.includes( 'SBM:' ) ) {
                uid = uid.substr( uid.indexOf( ',' ) + 1 );
            }

            if( uid.length ) {
                // Get the BOMLine type by using the first part of the uid till the ..
                var bomLineTypeIndex = uid.indexOf( '..' );
                var bomLineType = uid.substr( 0, bomLineTypeIndex );

                // Add SR::N:: as prefix
                uid = 'SR::N::' + uid;

                // Strip off the parent Partition from the uid when Partition Scheme is applied
                if( uid.includes( '%' ) ) {
                    uid = uid.substr( 0, uid.indexOf( '%' ) );
                }

                viewModelObjects[ index ] = new IModelObject( uid, bomLineType );
            } else {
                var ptnUid = modelObjectUid.match( 'Ptn0PartitionLine(.*),' );
                if( ptnUid !== null ) {
                    ptnUid = 'SR::N::' + ptnUid[ 0 ].replace( ',,', '' );
                    viewModelObjects[ index ] = new IModelObject( ptnUid, 'Ptn0PartitionLine' );
                }
            }
        }
    } );
};

export default exports = {
    getBackingObjects,
    getBackingObjectsSync
};
