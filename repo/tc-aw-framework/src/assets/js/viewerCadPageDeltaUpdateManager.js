// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Instantiate  and interact with CadPageDeltaUpdateRequest class
 *
 * @module js/viewerCadPageDeltaUpdateManager
 */
import { CadPageDeltaUpdateRequest } from 'js/cadPageDeltaUpdateRequest';
import logger from 'js/logger';
import _ from 'lodash';

export class ViewerCadPageDeltaUpdateManager {
    /**
     * Constructs a new ViewerCadPageDeltaUpdateManager.
     * @param {Object} viewerContextData - The viewer context data.
     */
    constructor( viewerContextData ) {
        this.viewerContextData = viewerContextData;
        this.setupAtomicDataTopics();
        this.cadPageDeltaUpdateRequest = new CadPageDeltaUpdateRequest();
        this.deltaOperationInProcess = false;
    }

    /**
     * Sets up atomic data topics.
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.APPLY_DELTA_UPDATE, this );
    }

    /**
     * Unregisters atomic data topics.
     */
    unregisterAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( this.viewerContextData.APPLY_DELTA_UPDATE, this );
    }

    /**
     * Updates the viewer based on the topic and data provided.
     * @param {string} topic - The topic to update.
     * @param {Object} data - The data to use for the update.
     */
    async update( topic, data ) {
        if( topic === this.viewerContextData.APPLY_DELTA_UPDATE && this.deltaOperationInProcess === false && data && data.csidChainArray ) {
            try {
                this.deltaOperationInProcess = true;
                this.viewerContextData.getPsLoader().notifyProductStructurePreDelta();
                const seedBOMLine = await this.viewerContextData.getPsLoader().getSeedBOMLine( data.csidChainArray );
                const uidToCsidChainMap = this.viewerContextData.getPsLoader().getUidToCsidChainMap();
                const response = await this.cadPageDeltaUpdateRequest.requestPageDeltaUpdate( seedBOMLine, uidToCsidChainMap );
                const deltaUpdatePromise = this.viewerContextData.getPsLoader().notifyProductStructureDeltaResultLoaded( response.deltaUpdateData );
                if( deltaUpdatePromise ) {
                    deltaUpdatePromise.then( () => {
                        if( data.additionalData && data.additionalData.isApplySnapshot && data.additionalData.productContextInfo ) {
                            this.viewerContextData.getSnapshotManager().applySnapshotFromPCI( data.additionalData.productContextInfo ).catch( error => {
                                logger.error( 'Error while applying Product Snapshot : ' + error );
                            } );
                        }
                        this.viewerContextData.getViewerAtomicDataSubject().notify( this.viewerContextData.DELTA_UPDATE_COMPLETED, {
                            pwaSelection: data.pwaSelection,
                            viewToReact: data.viewToReact
                        } );
                        this.deltaOperationInProcess = false;
                    } ).catch( error => {
                        this.deltaOperationInProcess = false;
                        logger.error( 'Error while performing delta update', error );
                    } );
                } else {
                    this.viewerContextData.getViewerAtomicDataSubject().notify( this.viewerContextData.DELTA_UPDATE_COMPLETED, {
                        pwaSelection: data.pwaSelection,
                        viewToReact: data.viewToReact
                    } );
                    this.deltaOperationInProcess = false;
                }
                if( response && _.isMap( response.newUidToCsidMap ) && response.newUidToCsidMap.size > 0 ) {
                    this.viewerContextData.getPsLoader().updateUidToCsidChainMap( response.newUidToCsidMap );
                }
            } catch ( error ) {
                this.deltaOperationInProcess = false;
                logger.error( 'Error in getting delta updates on shared BOM windows', error );
            }
        }
    }
}
