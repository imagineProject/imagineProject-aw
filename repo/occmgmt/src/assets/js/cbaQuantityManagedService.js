// Copyright (c) 2023 Siemens

/**
 * Service defines functionality summary and exploded lines for cadbomalignment module.
 * @module js/cbaQuantityManagedService
 */

import cdmSvc from 'soa/kernel/clientDataModel';
import logger from 'js/logger';

/**
 * Checks if object is summary line/ child of summary line or not
 * 
 * @param {object} modelObject - loaded viewModelObject from ACE Tree
 * @return {Boolean} - verdict TRUE, if input modelObject is quantity managed node or children of qty managed node. FALSE otherwise. 
 */
let isQuantityManagedLine = function( modelObject ) {
    if( !modelObject ) {
        logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: modelObject is null or undefined, returning false' );
        return false;
    }
    logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: Checking if object is quantity managed, Name:', modelObject.props?.awb0ArchetypeId?.uiValues[0], 'uid:', modelObject.uid );
    
    let parentObj = modelObject;
    if( !parentObj.props ) {
        logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: Object has no props, returning false' );
        return false;
    }
    
    do {
        if( parentObj.props.awb0QuantityManaged && parentObj.props.awb0QuantityManaged.dbValues && parentObj.props.awb0QuantityManaged.dbValues.length > 0 && parentObj.props.awb0QuantityManaged.dbValues[ 0 ] === '1' ) {
            logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: Found quantity managed object, Name:', parentObj.props?.awb0ArchetypeId?.uiValues[0],'uid:', parentObj.uid , ', returning true' );
            return true;
        }
        
        if( parentObj.props.awb0Parent && parentObj.props.awb0Parent.dbValues && parentObj.props.awb0Parent.dbValues.length > 0 ) {
            let parentUid = parentObj.props.awb0Parent.dbValues[ 0 ];
            parentObj = cdmSvc.getObject( parentUid );
        } else {
            logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: No parent found, returning false' );
            return false;
        }
    } while( parentObj && parentObj.props );

    logger.debug( 'cbaQuantityManagedService.isQuantityManagedLine: Reached end of hierarchy, returning false' );
    return false;
};

/**
 * Get exploded lines CSIDs for passed modelObject
 * 
 * @param {object} summaryLine Summary line object for which exploded line CSIDs to fetch
 * @returns {array} List of exploded lines for given summaryLine object, if not summaryLine then return empty array
 */
let getExplodedCSIDs = function( summaryLine ) {
    logger.debug( 'cbaQuantityManagedService.getExplodedCSIDs: Getting exploded CSIDs for summaryLine Name:', summaryLine?.props?.awb0ArchetypeId?.uiValues[0],'uid:', summaryLine?.uid );
    let csids;
    if( summaryLine?.props?.awb0ExplodedLineCSIDs?.dbValues )
    {
        logger.debug( 'cbaQuantityManagedService.getExplodedCSIDs: Property awb0ExplodedLineCSIDs Found' );
        csids = summaryLine.props.awb0ExplodedLineCSIDs.dbValues;
    }
    else{
        logger.debug( 'cbaQuantityManagedService.getExplodedCSIDs: Property awb0ExplodedLineCSIDs NOT Found' );
        csids = [];
    }
    logger.debug( 'cbaQuantityManagedService.getExplodedCSIDs: Found', csids.length, 'exploded CSIDs:', csids );
    return csids;
};

const exports = {
    isQuantityManagedLine,
    getExplodedCSIDs
};

export default exports;
