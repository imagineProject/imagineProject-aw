// Copyright (c) 2021 Siemens

/**
 * This Snapshot service provider
 *
 * @module js/viewerSnapshotManagerProvider
 */
import AwPromiseService from 'js/awPromiseService';
import assert from 'assert';
import viewerContextService from 'js/viewerContext.service';
import contributionService from 'js/contribution.service';
import logger from 'js/logger';
import _ from 'lodash';
import frameAdapterService from 'js/frameAdapter.service';
import viewerSessionFileUtils from 'js/viewerSessionFileUtils';
import cdm from 'soa/kernel/clientDataModel';

import '@swf/ClientViewer';

/**
 * Snapshot module installed state
 */
let snapshotModuleInstalled = null;

/**
 * Provides an instance of viewer Snapshot manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerSnapshotManager} Returns viewer Snapshot manager
 */
export let getSnapshotManager = function( viewerView, viewerContextData ) {
    if( snapshotModuleInstalled === null ) {
        checkIfSnapshotModuleInstalled();
    }
    return new ViewerSnapshotManager( viewerView, viewerContextData );
};

/**
 * check if snapshot module Installed
 */
let checkIfSnapshotModuleInstalled = function() {
    contributionService.loadContributions( 'createSnapshotService' ).then( function( depModule ) {
        if( Array.isArray( depModule ) && depModule.length > 0 ) {
            snapshotModuleInstalled = true;
        } else {
            snapshotModuleInstalled = false;
        }
    } ).catch( error => {
        logger.info( 'Failed to get the snapshot contribution : ' + error );
        snapshotModuleInstalled = false;
    } );
};

/**
 * Class to hold the viewer Snapshot data
 *
 * /
 */
class ViewerSnapshotManager {
    /*
     * @constructor ViewerSnapshotManager
     *
     * @param {Object} viewerView Viewer view
     * @param {Object} viewerContextData Viewer Context data
     */
    constructor( viewerView, viewerContextData ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.setupAtomicDataTopics();
    }

    /**
     * setupAtomicDataTopics ViewerMeasurementManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_VIEW_MODE_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_VISIBILITY_TOKEN, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic ) {
        let viewerViewMode = this.viewerContextData.getViewerAtomicData().getValue().viewerViewMode;
        let isViewerRevealed = this.viewerContextData.getViewerAtomicData().getValue().isViewerRevealed;
        if( ( topic === viewerContextService.VIEWER_VIEW_MODE_TOKEN || topic === viewerContextService.VIEWER_VISIBILITY_TOKEN ) && viewerViewMode === 'VIEWER3D' && isViewerRevealed === true ) {
            this.viewerContextData.updateViewerAtomicData( 'snapshotModuleInstalled', snapshotModuleInstalled );
        }
    }

    /**
     * Create snapshot
     *
     * @return {Promise} promise
     */
    createSnapshot() {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.CreateSnapshot()
            .then( function( newSnapshotObject ) {
                deferred.resolve( newSnapshotObject );
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Fetches snapshots from server
     * @return {Promise} promise
     */
    getAllSnapshots() {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.getAllSnapshots()
            .then( function( snapshotList ) {
                deferred.resolve( snapshotList );
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * get Flat flat buffer for Product Snapshot
     * @param {Object} headerInfo header info
     * @returns {Promise} promise
     */
    getFlatBufferForSnapshot( headerInfo ) {
        let deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.getFlatBufferForSnapshot( headerInfo )
            .then( ( arrayBuffer ) => {
                logger.debug( 'Product Snapshot arraybuffer received' );
                deferred.resolve( arrayBuffer );
            } ).catch( ( error ) => {
                logger.error( 'Error while getting arraybuffer for Product Snapshot' + error );
                deferred.reject( error );
            } );
        return deferred.promise;
    }

    /**
     * Apply snapshot using PCI
     * @param {Object} productContextInfo product context info
     * @returns {Object} Apply snapshot promise
     */
    applySnapshotFromPCI( productContextInfo ) {
        var deferred = AwPromiseService.instance.defer();
        this.getVisSnapshotInfo( productContextInfo ).then( snapshotresponse => {
            this.applySnapshot( snapshotresponse.vfBuffer ).then( () => {
                deferred.resolve( true );
            } ).catch( error => {
                deferred.reject( error );
                logger.error( 'Error while applying Product Snapshot : ' + error );
            } );
        } ).catch( error => {
            deferred.reject( error );
            logger.error( 'Error while retrieving Product Snapshot : ' + error );
        } );
        return deferred.promise;
    }

    /**
     * Fetches snapshots from server
     * @param {Object} vfFileFlatBuffer Flat buffer of VF file
     * @return {Promise} promise
     */
    applySnapshot( vfFileFlatBuffer ) {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.applySnapshot( 0, vfFileFlatBuffer )
            .then( () => {
                logger.debug( 'Product snapshot applied successfully' );
                deferred.resolve();
            } )
            .catch( err => {
                logger.error( 'Error while applying Product Snapshot : ' + err );
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Deletes all snapshots
     * @return {Promise} promise
     */
    deleteAllSnapshots() {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.getAllSnapshots()
            .then( function( snapshotList ) {
                return snapshotList.deleteAllSnapshots();
            } )
            .then( function() {
                deferred.resolve();
            } ).catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Get snapshot info
     * @param {Object} productContextInfo product context info
     * @returns {Object} Object containing session information
     */
    // eslint-disable-next-line class-methods-use-this
    async getVisSnapshotInfo( productContextInfo ) {
        if( productContextInfo && productContextInfo.props && productContextInfo.props.awb0Snapshot && _.isArray( productContextInfo.props.awb0Snapshot.dbValues ) &&
            productContextInfo.props.awb0Snapshot.dbValues[ 0 ] ) {
            const snapshotUid = productContextInfo.props.awb0Snapshot.dbValues[ 0 ];
            const snapshotObject = cdm.getObject( snapshotUid );
            logger.debug( 'Snapshot object: ' + snapshotObject );
            return viewerSessionFileUtils.getVisSessionInfo( snapshotObject )
                .then( ( fileticket ) => {
                    logger.debug( 'Session File ticket received for Snapshot' );
                    return viewerSessionFileUtils.downloadFileFromVolume( fileticket ).then( function( fileBuffer ) {
                        logger.debug( 'File Buffer received from volume' );
                        return {
                            vfBuffer: fileBuffer,
                            applySnapshot0: true,
                            isBookmark: false
                        };
                    } ).catch( ( error ) => {
                        logger.error( 'Error while getting vis snapshot info:' + error );
                    } );
                } ).catch( ( error ) => {
                    logger.error( 'Error while getting vis snapshot info:' + error );
                } );
        }
    }

    /**
     * Get image size
     * @param {Number} imageWidth image width in pixels
     * @param {Number} imageHeight image height in pixels
     * @param {Number} isThumbnail is image capture for thumbnail
     * @returns {Object} Object containing image width and height
     * @private
     * */
    // eslint-disable-next-line class-methods-use-this
    getImageSize( imageWidth, imageHeight, isThumbnail ) {
        let width = 0;
        let height = 0;
        if( isThumbnail ) {
            width = imageWidth && _.isNumber( imageWidth ) ? imageWidth : window.JSCom.Consts.ThumbnailSize.Width;
            height = imageHeight && _.isNumber( imageHeight ) ? imageHeight : window.JSCom.Consts.ThumbnailSize.Height;
        } else {
            width = imageWidth && _.isNumber( imageWidth ) ? imageWidth : window.JSCom.Consts.LargeImageSize.Width;
            height = imageHeight && _.isNumber( imageHeight ) ? imageHeight : window.JSCom.Consts.LargeImageSize.Height;
        }
        return {
            width: width,
            height: height
        };
    }

    /**
     * Capture image bytes
     * @param {Number} imageWidth image width in pixels
     * @param {Number} imageHeight image height in pixels
     * @param {Number} isThumbnail is image capture for thumbnail
     * @returns {Array} Array buffer
     */
    captureImageBytes( imageWidth, imageHeight, isThumbnail ) {
        const { width, height } = this.getImageSize( imageWidth, imageHeight, isThumbnail );
        let deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.captureImageBytes( width, height, isThumbnail )
            .then( ( imageBytes ) => {
                logger.debug( 'image bytes received' );
                deferred.resolve( imageBytes );
            } ).catch( ( error ) => {
                logger.error( 'Error in getting image bytes data' + error );
                deferred.reject( error );
            } );
        return deferred.promise;
    }

    /**
     * capture image
     * @param {Number} imageWidth image width in pixels
     * @param {Number} imageHeight image height in pixels
     * @param {Number} isThumbnail is image capture for thumbnail
     * @returns {String} image url
     */
    captureImage( imageWidth, imageHeight, isThumbnail ) {
        const { width, height } = this.getImageSize( imageWidth, imageHeight, isThumbnail );
        let deferred = AwPromiseService.instance.defer();
        this.viewerView.snapshotMgr.captureImage( width, height, isThumbnail )
            .then( ( imageUrl ) => {
                logger.debug( 'image Url received' );
                deferred.resolve( imageUrl );
            } ).catch( ( error ) => {
                logger.error( 'Error in getting image url data' + error );
                deferred.reject( error );
            } );
        return deferred.promise;
    }

    /**
     * Get Header Info
     * @param {Object} snapshotObject snapshot object
     * @param {Object} recipeObject recipe object
     * @returns {object} header info
     */
    // eslint-disable-next-line class-methods-use-this
    getHeaderInfo( snapshotObject, recipeObject ) {
        if( !snapshotObject || !recipeObject ) {
            logger.error( 'Snapshot Object or Recipe Object is not available' );
            return {};
        }
        const snapshotTitle = snapshotObject.props.object_string.dbValues[0];
        const titleProduct = snapshotObject.props.fnd0Roots.uiValues[0];
        const respositaryId = frameAdapterService.getDefaultSoaPath();
        const launchedObject_UID = snapshotObject.props.fnd0Roots.dbValues[0];
        return {
            type: 'VisStructureContext',
            sessionName:snapshotTitle,
            docTitle: titleProduct,
            repoType: 'Teamcenter',
            repoId: respositaryId,
            docIDType: 'TC UID',
            docID: recipeObject.uid, //fnd0StructureContext uid
            client : 'AW',
            fileTypeID : 'PLMIntegration.Document',
            launchedOjectType : 'VisStructureContext',
            launchedOjectUID : launchedObject_UID, //item revision uid
            operation : 'Open',
            serverType : 'TEAMCENTER',
            server_Type : 'TEAMCENTER',
            transientDoc : false,
            transientDocument : false
        };
    }
}

export default {
    getSnapshotManager
};
