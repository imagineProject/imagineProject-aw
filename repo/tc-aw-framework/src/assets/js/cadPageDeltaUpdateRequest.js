
// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Retrieve Delta updates on shared BOM windows
 *
 * @module js/cadPageDeltaUpdateRequest
 */
import soaSvc from 'soa/kernel/soaService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import logger from 'js/logger';
import cadPageDeltaUpdateResultProcessor from 'js/cadPageDeltaUpdateResultProcessor';
import viewerBomEventListenerService from 'js/viewerBomEventListenerService';
/**
 * Class to fetch delta update
 */
export class CadPageDeltaUpdateRequest {
    constructor() {
        this.pageSize = 2000;
    }

    /**
     * Request page delta update
     * @param {Array} backingObjects - The backing objects
     * @param {Object} uidToCsidChainMap - The uid to csid chain map
     * @returns {responseArray} - The delta response array
     */
    async requestPageDeltaUpdate( backingObjects, uidToCsidChainMap ) {
        if ( !backingObjects || !Array.isArray( backingObjects ) || backingObjects.length === 0 ) {
            throw new Error( 'No backing objects found' );
        }
        const policyId = propertyPolicySvc.register( CadPageDeltaUpdateRequest.getVisPropertyPolicy() );
        try {
            const bomWindow = await viewerBomEventListenerService.getBomWindow( backingObjects[0] );
            const soaInput = {
                inputBOMWindows: [ bomWindow ],
                pageSize: this.pageSize,
                deltaOptions: {
                    strToIntegerVectorMap: {
                        RequestedDeltaType: [ 255 ]
                    }
                }
            };
            const deltaUpdateSOAStartTime = window.performance.now();
            let responseArray = [];
            await this.fetchDeltaUpdate( soaInput, responseArray );
            const deltaUpdateSOAEndTime = window.performance.now();
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }
            logger.info( 'Got next response in  : ' + ( deltaUpdateSOAEndTime - deltaUpdateSOAStartTime ) / 1000 + ' s' );
            return  cadPageDeltaUpdateResultProcessor.processDeltaUpdateResponse( responseArray, backingObjects[0], uidToCsidChainMap );
        } catch ( error ) {
            logger.error( 'Error in getting delta update: ' + error );
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }
            throw error;
        }
    }

    /**
     * Fetch delta update
     * @param {Object} soaInput - The soa input
     * @param {Array} responseArray - The response array
     * @param {Object} response - The response
     * @returns {responseArray} - The delta response array
     */
    async fetchDeltaUpdate( soaInput, responseArray, response ) {
        if( response && ( !response.estimatedObjectsLeft || response.estimatedObjectsLeft && response.estimatedObjectsLeft === 0 ) ) {
            return responseArray;
        }
        const nextResponse = await soaSvc.post( 'Internal-Visualization-2023-06-StructureManagement', 'getDeltaUpdatesOnSharedBOMWindows', soaInput );
        responseArray.push( nextResponse );
        return this.fetchDeltaUpdate( soaInput, responseArray, nextResponse );
    }

    static getVisPropertyPolicy() {
        return {
            types: [ {
                name: 'BOMLine',
                properties: [ {
                    name: 'bl_has_children'
                },
                {
                    name: 'bl_parent'
                },
                {
                    name: 'bl_clone_stable_occurrence_id'
                }
                ]
            } ]
        };
    }
}
