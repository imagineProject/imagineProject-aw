/* eslint-disable class-methods-use-this */

// Copyright (c) 2023 Siemens

/**
 * CbaOccVisibilityProvider
 *
 * Responsible for providing occ visibility and toggle visibility by calling functions registered structure viewer for Summary Lines.

 * @module js/cbaOccVisibilityProvider
 */

import GenericOccVisibilityProvider from 'js/viewer/genericOccVisibilityProvider';
import cbaQuantityManagedService from 'js/cbaQuantityManagedService';
import cdmSvc from 'soa/kernel/clientDataModel';
import logger from 'js/logger';

const CSID_CHAIN = 'CSID_CHAIN';

export default class CbaOccVisibilityProvider extends GenericOccVisibilityProvider {
    // Construct an CbaOccVisibilityProvider
    constructor( ) {
        super();
        this.key = 'CbaOccVisibilityProvider';
        logger.debug( 'CbaOccVisibilityProvider: Constructor called, key set to:', this.key );
    }

    condition( modelObject ) {
        logger.debug( 'CbaOccVisibilityProvider.condition: Checking if modelObject is quantity managed, uid:', modelObject?.uid );
        const isQuantityManaged = cbaQuantityManagedService.isQuantityManagedLine( modelObject );
        logger.debug( 'CbaOccVisibilityProvider.condition: Result:', isQuantityManaged );
        return isQuantityManaged;
    }

    toggleOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz, toggleOccVisibilityFunctionRegisteredByViz ) {
        logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: Called for modelObject uid:', modelObject?.uid );
        let csidChains = this.getCsidChain( modelObject );
        logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: Retrieved', csidChains.length, 'CSID chains' );

        let isVisible = true;
        for ( let index = 0; index < csidChains.length; index++ ) {
            const csid = csidChains[index];
            let visibility = getOccVisibilityFunctionRegisteredByViz( csid, CSID_CHAIN );
            logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: CSID', csid, 'visibility:', visibility );
            if( visibility ) {
                // If one of the CSIDs is visible, that means thumbnail was toggled ON, now we need to turn all OFF.
                isVisible = false;
                logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: Found visible CSID, will toggle all OFF' );
                break;
            }
        }

        if( csidChains.length > 0 ) {
            let csidObject = {
                csids : csidChains,
                isVisible: isVisible
            };
            logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: Toggling visibility to:', isVisible );
            toggleOccVisibilityFunctionRegisteredByViz( csidObject, CSID_CHAIN );
            logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: Visibility toggled successfully, returning true' );
        }else{
            logger.debug( 'CbaOccVisibilityProvider.toggleOccVisibility: No CSID chains found, returning null' );
            return null;
        }
        return true;
    }

    getOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz, toggleOccVisibilityFunctionRegisteredByViz ) {
        logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: Called for modelObject uid:', modelObject?.uid );
        let csidChains = this.getCsidChain( modelObject );
        logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: Retrieved', csidChains.length, 'CSID chains' );
        
        for ( let index = 0; index < csidChains.length; index++ ) {
            const csid = csidChains[index];
            let isVisible = getOccVisibilityFunctionRegisteredByViz( csid, CSID_CHAIN );
            logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: CSID', csid, 'visibility:', isVisible );
            if( isVisible ) {
                // If one of the CSIDs is visible, return true.
                // If any exploded lines is visible , we will show thumbnail as visible.
                logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: Found visible CSID, returning true' );
                return true;
            }
        }

        // If no CSID chains are found, return null to indicate no visibility state.
        if( csidChains.length === 0 ) {
            logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: No CSID chains found, returning null' );
            return null;
        }
        logger.debug( 'CbaOccVisibilityProvider.getOccVisibility: All CSIDs hidden, returning false' );
        return false;
    }

    getCsidChain( modelObject ) {
        logger.debug( 'CbaOccVisibilityProvider.getCsidChain: Called for modelObject uid:', modelObject?.uid );
        let updatedModelObject = cdmSvc.getObject( modelObject.uid );
        const isQuantityManaged = cbaQuantityManagedService.isQuantityManagedLine( updatedModelObject );
        if( isQuantityManaged ) {
            const csids = cbaQuantityManagedService.getExplodedCSIDs( updatedModelObject );
            logger.debug( 'CbaOccVisibilityProvider.getCsidChain: Retrieved', csids.length, 'exploded CSIDs' );
            return csids;
        }
        logger.debug( 'CbaOccVisibilityProvider.getCsidChain: Not quantity managed, returning empty array' );
        return [];
    }
}

