// Copyright (c) 2024 Siemens

/**
 * @module js/viewerSessionFileUtils
 */
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import logger from 'js/logger';
import soaSvc from 'soa/kernel/soaService';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
let exports = {};

/**
 * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
let WEB_XML_FMS_PROXY_CONTEXT = 'fms';

/**
 * Relative path to the FMS proxy download service.
 */
let CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/';

/**
 * Gets Transient file ticket for uploading blob to Volume
 * @param {String} fileName file name
 * @returns {String} fmsTicket
 */
export const getTransientFileTicketForUpload = ( fileName ) => {
    let deferred = AwPromiseService.instance.defer();
    try {
        const inputData = {
            transientFileInfos: [ {
                fileName: fileName && fileName !== '' ? fileName : 'VisData.vf',
                isBinary: true,
                deleteFlag: true
            } ]
        };
        soaSvc.post( 'Core-2007-01-FileManagement', 'getTransientFileTicketsForUpload', inputData )
            .then( ( fileuploadResponse ) => {
                logger.debug( 'executed getTransientFileTicketsForUpload' );
                logger.debug( 'Result: ' + fileuploadResponse );
                if( !fileuploadResponse.transientFileTicketInfos || fileuploadResponse.transientFileTicketInfos.length === 0 ) {
                    deferred.reject( 'No transient file tickets found' );
                }
                deferred.resolve( fileuploadResponse.transientFileTicketInfos[ 0 ].ticket );
            } ).catch( ( error ) => {
                logger.error( 'Error in getTransientFileTicketsForUpload: ' + error );
                deferred.reject( 'Error in getTransientFileTicketsForUpload' );
            } );
    } catch ( error ) {
        logger.error( 'Failed to get TransientFileTicket for upload' + error );
        deferred.reject( 'Failed to get TransientFileTicket for upload' );
    }
    return deferred.promise;
};

/**
 * Uploads file to volume using fms ticket
 * @param {ArrayBuffer} arrayBuffer array buffer data of session
 * @param {String} fmsTicket fms ticket
 * @returns {Promise} promise which resolve on successful upload and reject on failure
 */
export const uploadFileToVolume = ( arrayBuffer, fmsTicket ) => {
    if( !arrayBuffer || arrayBuffer && !_.isArrayBuffer( arrayBuffer ) ) {
        logger.error( 'Array buffer is null or undefined' );
        return AwPromiseService.instance.reject( 'Array buffer is null or undefined' );
    }
    let deferred = AwPromiseService.instance.defer();
    try {
        const blob = new Blob( [ arrayBuffer ], { type: 'application/octet-stream' } );
        logger.debug( 'INFO: Calling FMS upload ... ' );
        let baseUrl = browserUtils.getBaseURL();
        const fmsURL = baseUrl + 'fms/fmsupload/';
        const XHR = new XMLHttpRequest();
        // This is Synchronous call
        XHR.open( 'POST', fmsURL, false );
        //now requires XSRF-TOKEN in request header
        XHR.setRequestHeader( 'X-XSRF-TOKEN', getXSRFToken() );
        const formData = new FormData();
        formData.append( 'fmsFile', blob );
        formData.append( 'fmsTicket', fmsTicket );
        XHR.send( formData );
        if( XHR.status === 200 ) {
            logger.debug( 'INFO: FMS Upload successful' );
            deferred.resolve( fmsTicket );
        } else {
            logger.error( 'ERROR: FMS Upload failed' );
            deferred.reject( 'FMS Upload failed' );
        }
    } catch ( error ) {
        logger.error( 'Failed to upload session data' + error );
        deferred.reject( 'FMS Upload failed' );
    }
    return deferred.promise;
};

/**
 * Gets the XSRF token from document cookie
 * @return {String} token
 */
const getXSRFToken = () => {
    let token = '';
    if( document !== null && document !== undefined && document.cookie.search( 'XSRF-TOKEN' ) > -1 ) {
        let splitAtr = document.cookie.split( 'XSRF-TOKEN=' );
        if( splitAtr.length === 2 ) {
            //returns the first element
            token = splitAtr[ 1 ].split( ';' )[ 0 ];
        }
    }
    return token;
};

/**
 * Download file from volume using fms ticket and return ArrayBuffer object
 * @param {String} fileTicket file ticket of the file
 * @returns {Object} ArrayBuffer object
 */
export const downloadFileFromVolume = ( fileTicket ) => {
    let fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    let downloadUri = CLIENT_FMS_DOWNLOAD_PATH + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    let baseUrl = browserUtils.getBaseURL();
    const url = baseUrl + downloadUri;
    let returnPromise = AwPromiseService.instance.defer();
    fetch( url ).then( function( response ) {
        response.arrayBuffer().then( function( data ) {
            returnPromise.resolve( data );
        } ).catch( function( error ) {
            returnPromise.reject( error );
            logger.error( 'Returned file ticket has an error while converting into a buffer: ' + error );
        } );
    } );
    return returnPromise.promise;
};

/**
 * Gets the session information from the session object
 * @param {Object} sessionObject TC Object containing session information
 * @returns {ArrayBuffer} vfInfo object containing vfBuffer, applySnapshot0 and isBookmark
 */
export const getVisSessionInfo = ( sessionObject ) => {
    let deferred = AwPromiseService.instance.defer();
    soaSvc.post( 'Cad-2020-01-AppSessionManagement', 'openSavedSession', {
        sessionsToOpen: [ sessionObject ],
        filter: {
            relAndTypesFilter: [ {
                namedRefHandler: 'UseNamedRefsList',
                relatedObjAndNamedRefs: [ {
                    objectTypeName: 'Dataset',
                    namedReferenceNames: [ 'Session' ]
                } ],
                relationName: 'Fnd0ISessionCADData'
            } ]
        }
    } ).then( function( response ) {
        if( response.sessionOutputs[ 0 ].relatedObjectInfos[ 0 ].namedRefList.length === 0 ) {
            deferred.resolve( null );
            return;
        }
        deferred.resolve( response.sessionOutputs[ 0 ].relatedObjectInfos[ 0 ].namedRefList[ 0 ].fileTicket );
    } ).catch( function( error ) {
        deferred.reject( error );
        logger.error( 'Returned file ticket has an error: ' + error );
    } );
    return deferred.promise;
};

export default exports = {
    downloadFileFromVolume,
    getTransientFileTicketForUpload,
    uploadFileToVolume,
    getVisSessionInfo
};
