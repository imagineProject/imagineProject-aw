/* eslint-disable class-methods-use-this */
// Copyright (c) 2024 Siemens
import soaSvc from 'soa/kernel/soaService';
import logger from 'js/logger';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import viewerSessionFileUtils from 'js/viewerSessionFileUtils';

export default class StructureViewerBookmarkProvider {
    /**
     * Constructor for StructureViewerBookmarkProvider
     */
    constructor() {}

    /**
     * Saves the vis bookmark info
     * @param {ArrayBuffer} arrayBuffer array buffer
     * @param {Object} productContextInfo product context info
     * @param {String} fmsTicket fms ticket
     * @returns {Promise} promise
     * */
    saveVisBookmarkInfo( arrayBuffer, productContextInfo, fmsTicket ) {
        if( !arrayBuffer || arrayBuffer && !_.isArrayBuffer( arrayBuffer ) ) {
            logger.error( 'Array buffer is null or undefined' );
            return AwPromiseService.instance.reject( 'Array buffer is null or undefined' );
        }
        if( !productContextInfo || productContextInfo && !_.isObject( productContextInfo ) ) {
            logger.error( 'Product context info is null or undefined' );
            return AwPromiseService.instance.reject( 'Product context info is null or undefined' );
        }
        return viewerSessionFileUtils.uploadFileToVolume( arrayBuffer, fmsTicket ).then( () => {
            return this._saveVisBookmark( productContextInfo, fmsTicket );
        } ).catch( ( error ) => {
            logger.error( 'Error in uploadAndSaveVisBookmark: ' + error );
        } );
    }

    /**@private
     * Saves the vis bookmark
     * @param {Object} productContextInfo product context info
     * @param {String} fmsTicket fms ticket
     * @returns {Promise} promise
     */
    _saveVisBookmark( productContextInfo, fmsTicket ) {
        const saveAutoBookmarkInput = {
            saveBookmarkInfos: [ {
                productContextInfo: productContextInfo,
                visBookmarkTransientFileTicket: fmsTicket
            } ]
        };
        let deferred = AwPromiseService.instance.defer();
        soaSvc.post( 'Internal-ActiveWorkspaceVis-2014-11-OccurrenceManagement', 'saveVisBookmarkInfo', saveAutoBookmarkInput )
            .then( ( response ) => {
                logger.debug( 'executed saveVisBookmarkInfo' + response );
                deferred.resolve();
            } ).catch( ( error ) => {
                logger.error( 'Error in saveVisBookmarkInfo: ' + error );
                deferred.reject( 'Error in saveVisBookmarkInfo' );
            } );
        return deferred.promise;
    }

    /**
     * Gets VFInfo for product
     * @param {Object} productContextInfo product context info
     * @returns {Promise} promise which resolve with vf info
     */
    getVFInfoForProduct( productContextInfo ) {
        if( !productContextInfo || productContextInfo && !_.isObject( productContextInfo ) ) {
            logger.error( 'Product context info is null or undefined' );
            return AwPromiseService.instance.reject( 'Product context info is null or undefined' );
        }
        let deferred = AwPromiseService.instance.defer();
        this.getVisBookmarkInfo( productContextInfo ).then( ( ticket ) => {
            if( !ticket ) {
                logger.debug( 'No vis bookmark info found' );
                deferred.resolve( null );
                return;
            }
            viewerSessionFileUtils.downloadFileFromVolume( ticket ).then( function( result ) {
                logger.debug( 'File Buffer received from volume' );
                let vfInfo = {
                    vfBuffer: result,
                    applySnapshot0: false,
                    isBookmark: true
                };
                deferred.resolve( vfInfo );
            } ).catch( function( error ) {
                deferred.resolve( null );
                logger.error( 'Error in getVFInfoForProduct: ' + error );
            } );
        } ).catch( function( error ) {
            deferred.resolve( null );
            logger.error( 'Returned file ticket has an error: ' + error );
        } );
        return deferred.promise;
    }

    /**
     * Gets the vis bookmark info
     * @param {Object} productContextInfo product context info
     * @returns {Promise} promise which resolve with vis bookmark file read ticket
     */
    getVisBookmarkInfo( productContextInfo ) {
        if( !productContextInfo || productContextInfo && !_.isObject( productContextInfo ) ) {
            logger.error( 'Product context info is null or undefined' );
            return AwPromiseService.instance.reject( 'Product context info is null or undefined' );
        }
        let productContextInfos = [ productContextInfo ];
        let deferred = AwPromiseService.instance.defer();
        soaSvc.post( 'Internal-ActiveWorkspaceVis-2014-11-OccurrenceManagement', 'getVisBookmarkInfo', { productContextInfos } )
        .then( function( response ) {
            if( response.visBookmarkInfos.length === 0 ) {
                logger.debug( 'No vis bookmark info found' );
                deferred.resolve( null );
                return;
            }
            logger.debug( 'Vis bookmark info found' );
            deferred.resolve( response.visBookmarkInfos[ 0 ].visBookmarkFileReadTicket );
        } ).catch( function( error ) {
            deferred.resolve( null );
            logger.error( 'Returned file ticket has an error: ' + error );
        } );
        return deferred.promise;
    }
}
