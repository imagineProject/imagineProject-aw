// Copyright (c) 2025 Siemens

/* global JSCom */

/**
 * This refSet service provider
 *
 * @module js/viewerRefSetManagerProvider
 */
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import assert from 'assert';
import logger from 'js/logger';
import '@swf/ClientViewer';
import viewerPmiManager from 'js/viewerPmiManagerProvider';


/**
 * Root csid
 */
const ROOT_CSID = '';

/**
 * Provides an instance of viewer refSet manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerRefSetManager} Returns viewer refSet manager
 */
export let getRefSetManager = function( viewerView, viewerContextData ) {
    return new ViewerRefSetManager( viewerView, viewerContextData );
};

const GEOANALYSIS_ACTIVE_REFSET = 'activeReferenceSet';

/**
 * Class to hold the viewer refSet data
 *
 * @constructor ViewerRefSetManager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class ViewerRefSetManager {
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null in refSet' );
        assert( viewerContextData, 'Viewer context data can not be null in refSet' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.refSetState = null;
    }

    /**
     * setupAtomicDataTopics when refSet is revealed and get default reference set
     * @param {refSetState} refSetState refSet atomic data
     */
    setupAtomicDataTopicsPanelReveal( refSetState ) {
        this.refSetState = refSetState;
        this.updateRefSet();
    }

    /**
     * Handle pmi atomic data update
     */
    updateRefSet() {
        let targetCSIDs = this.viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
        if( Array.isArray( targetCSIDs ) && targetCSIDs.length >= 1 ) {
            let occ = this.viewerContextData.getViewerCtxSvc().createViewerOccurance( targetCSIDs[0], this.viewerContextData );

            this.viewerView.visibilityMgr.getActiveRefSet( occ )
                .then( result => {
                    this.updateRefSetState( GEOANALYSIS_ACTIVE_REFSET, result );
                } )
                .catch( error => {
                    logger.warn( 'Could not fetch default reference set from server: ' + error );
                } );
        }
    }

    /**
     * update reference set atomic data
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue value to be set on that path
     */
    updateRefSetState( propertyPath, propertyValue ) {
        if( this.refSetState ) {
            propertyValue = propertyValue === undefined || propertyValue === '' ? ' ' : propertyValue; // ensure that undefined is not set
            const newrefSetState = { ...this.refSetState.getValue() };
            if( Array.isArray( propertyValue ) ) {
                newrefSetState[ propertyPath ] = propertyValue.length > 0 ? propertyValue[0] : '';
            } else {
                newrefSetState[ propertyPath ] = propertyValue;
            }
            this.refSetState.update( newrefSetState );
        }
    }

    /**
     * update reference set atomic data
     * @param {String} referenceSet reference set to be applied
     */
    applyReferenceSet( referenceSet ) {
        if( this.refSetState && referenceSet ) {
            let targetCSIDs = this.viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
            if( Array.isArray( targetCSIDs ) && targetCSIDs.length >= 1 ) {
                let occ =  this.viewerContextData.getViewerCtxSvc().createViewerOccurance(  targetCSIDs[0], this.viewerContextData );

                this.viewerView.visibilityMgr.applyRefSet( occ, referenceSet, true )
                    .then( () => {
                        this.viewerView.visibilityMgr.getActiveRefSet( occ )
                            .then( result => {
                                this.updateRefSetState( GEOANALYSIS_ACTIVE_REFSET, result );
                            } )
                            .catch( error => {
                                logger.warn( 'Could not fetch default reference set from server: ' + error );
                            } );
                    } )
                    .catch( error => {
                        logger.warn( 'Could not fetch available reference sets from server: ' + error );
                    } );
            }
        }
    }

    /**
     * update reference set atomic data
     * @returns {Promise} Promise that resolves to list of available reference set.
     */
    getAvailableReferenceSet() {
        var deferred = AwPromiseService.instance.defer();

        let targetCSIDs = this.viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
        if( Array.isArray( targetCSIDs ) && targetCSIDs.length >= 1 ) {
            let occ =  this.viewerContextData.getViewerCtxSvc().createViewerOccurance(  targetCSIDs[0], this.viewerContextData );

            this.viewerView.visibilityMgr.getAvailableRefSets( occ )
                .then( result => {
                    deferred.resolve( result );
                } )
                .catch( error => {
                    logger.warn( 'Could not fetch available reference sets from server: ' + error );
                    deferred.reject( error );
                } );
        } else{
            logger.warn( 'No target CSIDs found. Cannot fetch available reference sets.' );
            deferred.reject( );
        }
        return deferred.promise;
    }

    /**
    * Unsubscribe atomic data after panel is closed
    */
    unsubscribeAtomicDataTopicsPanelClose() {
        this.selectedOcc = null;
        this.refSetState = null;
    }
}

export default {
    getRefSetManager,
    GEOANALYSIS_ACTIVE_REFSET
};
