// Copyright (c) 2021 Siemens

/**
 * This Session service provider
 *
 * @module js/viewerSessionManagerProvider
 */
import AwPromiseService from 'js/awPromiseService';
import assert from 'assert';
import '@swf/ClientViewer';
import soaSvc from 'soa/kernel/soaService';
import logger from 'js/logger';
import viewerContextService from 'js/viewerContext.service';
import viewerSessionFileUtils from 'js/viewerSessionFileUtils';
import AwTimeoutService from 'js/awTimeoutService';


export default class ViewerSessionManager {
    /**
     * Constructor
     * @param {Object} viewerView Viewer view
     * @param {Object} viewerContextData Viewer Context data
     * @param {Object} bookmarkProviderInstance bookmark provider instance
     *
     */
    constructor( viewerView, viewerContextData, bookmarkProviderInstance ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this._bookmarkProviderInstance = bookmarkProviderInstance;
        this.disableVisBookmark = false;
        this.setupAtomicDataTopics();
        this.ignoreAutoSave = false;
    }

    /**
     * setupAtomicDataTopics ViewerMeasurementManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.AUTO_SAVE_VIS_BOOKMARK, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === this.viewerContextData.AUTO_SAVE_VIS_BOOKMARK ) {
            if( data === 'save' ) { //start save of bookmark
                this.autoSaveVisbookmark();
            } else if( data === 'stop' ) { //ignore any save notification
                this.ignoreAutoSave = true;
                this.cancelAutoSaveVisbookmark();
            } else if( data === 'start' ) { //reset ignore flag
                this.ignoreAutoSave = false;
            }
        }
    }

    /**
     * Update App Session
     * @param {String} ccUid uid
     * @param {String} pciUid pci uid
     * @param {String} last_mod_date last modified date
     * @returns {Promise} promise that resolves when app session is updated
     */
    updateAppSession( ccUid, pciUid, last_mod_date ) {
        let deferred = AwPromiseService.instance.defer();
        this.viewerView.sessionMgr.updateAppSession( ccUid, pciUid, last_mod_date )
            .then( function() {
                deferred.resolve();
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Cancel Auto Save Vis Autobookmark
     */
    cancelAutoSaveVisbookmark() {
        if( this.timeoutPromise ) {
            AwTimeoutService.instance.cancel( this.timeoutPromise );
            this.timeoutPromise = null;
        }
    }

    /**
     * Auto save autobookmark after certain events
     */
    autoSaveVisbookmark() {
        const productContextInfo = this.viewerContextData.getCurrentProductContextInfo();
        if( this.ignoreAutoSave || this.disableVisBookmark || !productContextInfo ) { //ignore auto save if save already in progress
            return;
        }
        this.cancelAutoSaveVisbookmark();//cancel previous timeout if active any
        this.timeoutPromise = AwTimeoutService.instance( async() => {
            try {
                this.ignoreAutoSave = true;
                await this.saveAutoBookmark( productContextInfo, false );
                this.timeoutPromise = null;
                AwTimeoutService.instance( () => {
                    this.ignoreAutoSave = false;
                }, 3000 );
            } catch ( error ) {
                logger.error( 'Error in autoSaveVisbookmark:', error );
            }
        }, 30000 );
    }

    /**
     * get Flat flat buffer for session
     * @param {String} sessionName session name
     * @returns {Promise} promise
     */
    getFlatBufferForSession( sessionName ) {
        let deferred = AwPromiseService.instance.defer();
        this.viewerView.sessionMgr.getFlatBufferForSession( { sessionName: sessionName, jtName: sessionName } )
            .then( ( arrayBuffer ) => {
                logger.debug( 'ArrayBuffer received' );
                deferred.resolve( arrayBuffer );
            } ).catch( ( error ) => {
                logger.error( 'Error in getting array buffer' + error );
                deferred.reject( error );
            } );
        return deferred.promise;
    }

    /**
     *
     * @param {Object} productContextInfo product context info
     * @param {Boolean} cacheFlatBuffer cache flat buffer or notnot
     * @returns {Promise} promise that resolves when bookmark is saved
     */
    saveAutoBookmark( productContextInfo, cacheFlatBuffer ) {
        if( this.disableVisBookmark ) {
            logger.debug( 'Autobookmark is disabled' );
            return AwPromiseService.instance.resolve( 'Autobookmark is disabled' );
        }
        if( viewerContextService.isServerless() ) {
            const fileName = 'VisBkMrk_' + new Date().toISOString().replace( /[^0-9]/g, '' ) + '_S' + Math.floor( Math.random() * 10000 ) + '.vf';
            const transientTicketPromise =  viewerSessionFileUtils.getTransientFileTicketForUpload( fileName );
            const flatBufferPromise = this.getFlatBufferForSession( 'default' );
            return AwPromiseService.instance.all( [ transientTicketPromise, flatBufferPromise ] )
                .then( ( result ) => {
                    if( cacheFlatBuffer ) {
                        this.viewerContextData.setFlatBuffer( result[1] ); //cache flat buffer to use it for saving session outside 3D viewer
                    }
                    return this._bookmarkProviderInstance.saveVisBookmarkInfo( result[1], productContextInfo, result[0] );
                } ).catch( ( error ) => {
                    logger.error( 'Error in saveAutoBookmark:', error );
                } );
        }
        return this.saveVisBookmarkForCSR();
    }

    /**
     * Save Vis Bookmark for CSR
     * @returns {Promise} promise that resolve when bookmark is saved
     */
    saveVisBookmarkForCSR() {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.sessionMgr.saveBookMark()
            .then( function() {
                deferred.resolve();
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Apply Bookmark
     *
     * @return {Promise} promise
     */
    applyAutoBookmark() {
        return this.viewerView.sessionMgr.applyBookMark();
    }

    /**
     * Is autobookmark disabled
     * @returns {Boolean} true if autobookmark is Disabled
     */
    isAutoBookmarkDisabled() {
        return this.disableVisBookmark;
    }

    /**
     * Disable bookmark
     * @param {Boolean} disable disable autobookmark
     * @return {Promise} promise
     */
    disableBookmark( disable ) {
        if( viewerContextService.isServerless() ) {
            this.disableVisBookmark = disable;
            return AwPromiseService.instance.resolve();
        }
        return this.viewerView.sessionMgr.disableBookMark( disable );
    }

    /**
     * Update Teamcenter Product Snapshot with TcVis session data
     * @param {String} snapshotUID - UID of the created Teamcenter Product Snapshot
     * @return {Promise} promise
     *
     */
    updateProductSnapshot( snapshotUID ) {
        let deferred = AwPromiseService.instance.defer();
        /* JSComm API name might change in future */
        this.viewerView.sessionMgr.updateTCSnapshot( snapshotUID, '' )
            .then( function() {
                deferred.resolve();
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Apply Teamcenter Product Snapshot with Vis session data
     * @param {String} snapshotUID - UID of the created Teamcenter Product Snapshot
     * @param {String} pciUid - UID of current PCI
     * @param {Boolean} applyFilterFlag - flag that returns true if there are filters on either side of the snapshot
     * @return {Promise} promise
     */
    applyProductSnapshot( snapshotUID, pciUid, applyFilterFlag ) {
        let deferred = AwPromiseService.instance.defer();
        if( this.viewerContextData.getDynamicUpdateMgr() ) {
            this.viewerContextData.getDynamicUpdateMgr().applyTCSnapshot( snapshotUID, pciUid, applyFilterFlag )
                .then( function() {
                    deferred.resolve();
                } )
                .catch( function( err ) {
                    deferred.reject( err );
                } );
        }
        deferred.reject( 'Dynamic update manager not defined' );
        return deferred.promise;
    }

    /**
     * Gets the vf file info for the given session object
     * @param {Object} appSessionObject app session information object
     * @returns {Promise }vf file information in arraybuffer format
     */
    // eslint-disable-next-line class-methods-use-this
    returnVFInfoForSession( appSessionObject ) {
        return viewerSessionFileUtils.getVisSessionInfo( appSessionObject )
        .then( ( fileticket )=>{
            logger.debug( 'Session File ticket received' );
            return viewerSessionFileUtils.downloadFileFromVolume( fileticket ).then( function( fileBuffer ) {
                logger.debug( 'File Buffer received from volume' );
                return {
                    vfBuffer:fileBuffer,
                    applySnapshot0: false,
                    isBookmark: false
                };
            } );
        }).catch((error)=>{
            logger.error( 'Error while getting vis session info:' + error );
        });
    }

    /**
     * Gets the vf file info for the given app session object
     * @param {Object} appSessionObject app session information object
     * @returns {Promise }vf file information in arraybuffer format
     */
    getVFInfoForAppSession( productContextInfo, appSessionObject ) {
        return this._bookmarkProviderInstance.getVisBookmarkInfo( productContextInfo ).then( ( ticket ) => {
            if( !ticket ) {
                logger.debug( 'No bookmark ticket found for the app session, loading session data' );
                return this.returnVFInfoForSession( appSessionObject );
            }
            return viewerSessionFileUtils.downloadFileFromVolume( ticket ).then( function( result ) {
                logger.debug( 'Bookmark File Buffer received from volume' );
                return {
                    vfBuffer: result,
                    applySnapshot0: false,
                    isBookmark: true
                };
            } );
        } ).catch( ( error ) => {
            logger.error( 'Returned file ticket has an error: ' + error );
        } );
    }

    /**
     * Gets vis bookmark info
     * @param {Object} productContextInfo product context info
     * @returns {Promise} promise which resolves on returning vis bookmark info
     */
    getVFInfoForProduct( productContextInfo ) {
        return this._bookmarkProviderInstance.getVFInfoForProduct( productContextInfo );
    }
}
