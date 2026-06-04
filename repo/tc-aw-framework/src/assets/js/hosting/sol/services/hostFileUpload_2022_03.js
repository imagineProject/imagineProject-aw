// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/hosting/sol/services/hostFileUpload_2022_03
 * @namespace hostFileUpload_2022_03
 */
 import hostFactorySvc from 'js/hosting/hostFactoryService';
 import hostServices from 'js/hosting/hostConst_Services';
 import _ from 'lodash';
 import logger from 'js/logger';
 import messagingSvc from 'js/messagingService';
 import localeService from 'js/localeService';


// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// FileUploadSvc
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Service used by the host to request file upload.
 *
 * @constructor
 * @memberof hostFileUpload_2022_03
 * @extends hostFactoryService.BaseCallableService
 */
 var FileUploadSvc = function() {
    hostFactorySvc.getCallableService().call( this,
        hostServices.CS_FILE_UPLOAD_SVC,
        hostServices.VERSION_2022_03 );
};

FileUploadSvc.prototype = hostFactorySvc.extendCallableService();


/**
 * This is an incoming call to this service trigger the related event handlers.
 *
 * @function handleIncomingEvent
 * @memberof hostFileUpload_2022_03.FileUploadSvc
 *
 * @param {String} jsondata - JSON encoded data from the host. It contains
 */
 FileUploadSvc.prototype.handleIncomingEvent = function( jsondata ) {
    try {
        if( jsondata ) {
            const payloadData = JSON.parse( jsondata );
            const fileUploadURL = payloadData.URL;
            const fileFullPath = payloadData.fileFullPath;
            const base64BlobData = payloadData.base64BlobData;
            const fmsWriteTicket = payloadData.fmsTicket;
            const XSRFToken = payloadData.XSRFToken;
            const type = payloadData.requestType;

            const blob = this._base64ToBlob( base64BlobData );
            let newFormData = new FormData();
            newFormData.append( 'fmsFile', blob );
            newFormData.append( 'fmsTicket', fmsWriteTicket );

            const promise =  new Promise( function( resolve, reject ) {
                let xhr = new XMLHttpRequest();
                xhr.onload = function() {
                  if ( xhr.status >= 200 && xhr.status < 300 ) {
                      resolve( {
                          status: xhr.status,
                          statusText: 'Upload Successful',
                          type: type
                      });
                  } else {
                      let localTextBundle = localeService.getLoadedText( 'hostingMessages' );
                      let errMsg = localTextBundle.HostingFileUploadSvcUploadError;
                      errMsg = errMsg.replace( '{0}', fileFullPath );
                      errMsg = errMsg.replace( '{1}', xhr.statusText );
                      messagingSvc.showInfo( errMsg );
                      logger.error( 'Error: ' + errMsg );
                      reject( {
                          status: xhr.status,
                          statusText: xhr.statusText,
                          type: type
                      } );
                  }
                };
                xhr.onerror = function() {
                    let localTextBundle = localeService.getLoadedText( 'hostingMessages' );
                    let errMsg = localTextBundle.HostingFileUploadSvcUploadError;
                    errMsg = errMsg.replace( '{0}', fileFullPath );
                    errMsg = errMsg.replace( '{1}', xhr.statusText );
                    messagingSvc.showInfo( errMsg );
                    logger.error( 'Error: ' + errMsg );
                    reject( {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        type: type
                    } );
                };

                xhr.open( 'POST', fileUploadURL, false );
                if( XSRFToken ) {
                    xhr.setRequestHeader( 'X-XSRF-TOKEN', XSRFToken );
                }
                xhr.send( newFormData );
            } );
            
            promise.then( (value) => {
                var msg = createFileUploadMsg();
                msg.setStatus ( value.status );
                msg.setStatusText ( value.statusText );
                msg.setType ( value.type );
                createFileUploadResponseProxy().fireHostEvent ( msg );
            } );
        }
    } catch ( error ) {
        logger.error( error );
        messagingSvc.showInfo( error );
    }
};

/**
 * This class is used for constructing file upload response message
 * 
 * @constructor
 * @memberof hostFileUpload_2022_03
 */
var FileUploadMsg = function ( ) {
    hostFactorySvc.getDataContract().call( this, hostServices.VERSION_2022_03 );
};

FileUploadMsg.prototype = hostFactorySvc.extendDataContract();

/**
 * Set file upload status code
 * 
 * @param {*} value - 200 or 500
 */
FileUploadMsg.prototype.setStatus = function( value ) {
    this.status = value;
};

/**
 * Set file upload status information
 * 
 * @param {*} value - Error message or successful message
 */
FileUploadMsg.prototype.setStatusText = function ( value ) {
    this.statusText = value;
};

/**
 * What type of file upload operation
 * 
 * @param {*} value - Request Type for file upload operation
 */
FileUploadMsg.prototype.setType = function ( value ) {
    this.type = value;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// FileUploadResponseProxy
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This class is used by the 'client' to invoke with the service implementation on the 'host' for file upload complete message.
 *
 * @constructor
 * @memberof hostFileUpload_2022_03
 */
var FileUploadResponseProxy = function () {
    hostFactorySvc.getProxy().call( this,
        hostServices.HS_FILE_UPLOAD_RESPONSE,
        hostServices.VERSION_2022_03 );
};

FileUploadResponseProxy.prototype = hostFactorySvc.extendProxy();

/**
 * Process file upload outgoing 'event' type call to the host
 * 
 * @function fireHostEvent
 * @param {GetFileUploadMsg} inputData - Data object who's properties define data sent to host
 */
FileUploadResponseProxy.prototype.fireHostEvent = function( inputData ) {
    var payload = JSON.stringify( inputData );

    this._invokeHostEvent( payload );
};

/**
 * Convert given base64 data to Blob
 *
 * @function _base64ToBlob
 * @memberof hostFileUpload_2022_03.FileUploadSvc
 *
 * @private
 *
 * @param {String} base64 - base64 file data
 */
 FileUploadSvc.prototype._base64ToBlob = function( base64 ) {
    let binary = atob( base64 );
    let len = binary.length;
    let buffer = new ArrayBuffer( len );
    let view = new Uint8Array( buffer );
    for ( let i = 0; i < len; i++ ) {
        view[i] = binary.charCodeAt( i );
    }
    return new Blob( [ view ] );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Create new client-side service.
 *
 * @memberof hostFileUpload_2022_03
 *
 * @returns {FileUploadSvc} New instance of the service message object.
 */
export let createFileUploadSvc = function() {
    return new FileUploadSvc();
};

/**
 * Register client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostFileUpload_2022_03
 */
export let registerHostingModule = function() {
    exports.createFileUploadSvc().register();
};

/**
 * Create File upload message
 * 
 * @returns {FileUploadMsg} New instance of the file upload response message
 */
export let createFileUploadMsg = function ( ) {
    return new FileUploadMsg( );
};

/**
 * Create file upload response proxy service.
 * 
 * @returns {FileUploadResponseProxy} New instance of file upload response call back service
 * 
 */
export let createFileUploadResponseProxy = function() {
    return new FileUploadResponseProxy();
};

export default exports = {
    createFileUploadMsg,
    createFileUploadResponseProxy,
    createFileUploadSvc,
    registerHostingModule
};
