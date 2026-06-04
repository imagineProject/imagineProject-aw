// Copyright (c) 2023 Siemens

/* eslint-disable no-await-in-loop */

import fmsUtils from 'js/fmsUtils';
import AwHttpService from 'js/awHttpService';
import SparkMD5 from 'spark-md5';
import Debug from 'debug';

import logger from 'js/logger';
import serviceUtils from 'js/serviceUtils';

const trace = new Debug( 'fileUpload' );

let exports = {};

const CHUNK_UPLOAD_THRESHOLD =  1024 * 1024 * 128; // 150 MB

const maxRetries = 4; // Initial try plus maxRetries = 5 tries

/**
  * Gets the XSRF-TOKEN from the document cookie
  *
  * @returns {string} the XSRF token
  */
function _getXSRFToken() {
    let token = '';
    if ( document !== null && document !== undefined && document.cookie.search( 'XSRF-TOKEN' ) > -1 ) {
        const splitAtr = document.cookie.split( 'XSRF-TOKEN=' );
        if ( splitAtr.length === 2 ) {
            // returns the first element
            token = splitAtr[ 1 ].split( ';' )[ 0 ];
        }
    }
    return token;
}

/**
 * Delay x ms
 *
 * @param {Integer} ms - amount of time to delay
 * @returns {Promise} promise resolution after x ms
 */
const _delay = ms => new Promise( ( resolve ) => {
    setTimeout( () => resolve(), ms );
} );

/**
 * Update the datasetState atomic data
 *
 * @param {String} fileName - name of the current file to update
 * @param {Object} datasetState - file upload state atomic data
 * @param {Number} loadPercent - current load percent of file uploaded
 */
const updateDatasetState = ( fileName, datasetState, loadPercent ) => {
    if( datasetState ) {
        const newDatasetState = { ...datasetState.getValue() };
        if( newDatasetState.files ) {
            const currentFileIdx = newDatasetState.files.findIndex( myFile => myFile.fileName === fileName );
            if( currentFileIdx !== -1 ) {
                newDatasetState.files[ currentFileIdx ] = { ...newDatasetState.files[ currentFileIdx ], loadPercent };
                datasetState.update( newDatasetState );
            }
        }
    }
};

/**
 * Call fms to upload a single file in full
 *
 * @param {Object} formData - FormData obtained from file upload widget
 * @param {Object} optionalHeaders - optional headers to be used on http call
 * @param {Object} datasetState - state to keep track of upload
 */
const uploadFile = async( formData, optionalHeaders, datasetState ) => {
    const file = formData.get( 'fmsFile' );
    if( file.size > CHUNK_UPLOAD_THRESHOLD ) {
        return chunkFile( formData, optionalHeaders, datasetState );
    }
    const $http = AwHttpService.instance;
    const uploadHeaders = optionalHeaders || {};
    uploadHeaders[ 'Content-type' ] = undefined;
    const uploadPromise = await $http.post( fmsUtils.getFMSFullUploadUrl(), formData, { headers: uploadHeaders } );
    updateDatasetState( file.name, datasetState, 100 );
    return uploadPromise;
};

/**
 * Loop over file data calling fms to upload in 'chunks'
 *
 * @param {Object} formDataObj - FormData obtained from file upload widget
 * @param {Object} optionalHeaders - optional headers to be used on http call
 * @param {Object} datasetState -
 * @returns {Promise} - resolved/rejected chunked file upload promise
 */
const chunkFile = async( formDataObj, optionalHeaders, datasetState ) => {
    const file = formDataObj.get( 'fmsFile' );
    const fmsTicket = formDataObj.get( 'fmsTicket' );
    await initiateChunkedUpload( file, fmsTicket );
    updateDatasetState( file.name, datasetState, 1 );
    formDataObj.delete( 'fmsFile' );

    // chunk calculation
    const chunkSize = fmsUtils.getChunkSize();
    const MAX_CONCURRENT_CHUNKS = fmsUtils.getMaxConcurrentChunks();
    const chunks = Math.ceil( file.size / chunkSize );

    trace( 'Using chunked upload settings: ', JSON.stringify( {
        'Chunk Size': chunkSize,
        'Number of Chunks': chunks
    } ) );

    const XSRF = _getXSRFToken();

    optionalHeaders = optionalHeaders || {};
    optionalHeaders[ 'X-XSRF-TOKEN' ] = XSRF;

    const chunkPromises = [];

    // File hash
    const fileMd5 = new SparkMD5.ArrayBuffer();

    let currentChunk = 1;
    while( currentChunk < chunks ) {
        const { formData, fileHeaders } = await generateChunk( optionalHeaders, file, fmsTicket, fileMd5, currentChunk, chunkSize );
        const chunkPromise = uploadChunk( formData, fileHeaders, currentChunk );
        chunkPromises.push( chunkPromise );
        if( currentChunk % MAX_CONCURRENT_CHUNKS === 0 ) {
            await Promise.all( chunkPromises );
            chunkPromises.splice( 0 );
            updateDatasetState( file.name, datasetState, currentChunk / chunks * 100 );
        }
        currentChunk++;
    }
    if( chunkPromises.length > 0 ) {
        await Promise.all( chunkPromises );
        updateDatasetState( file.name, datasetState, currentChunk / chunks * 100 );
    }
    const { formData, fileHeaders } = await generateChunk( optionalHeaders, file, fmsTicket, fileMd5, currentChunk, chunkSize, true );
    const chunkPromise = await uploadChunk( formData, fileHeaders, currentChunk );
    updateDatasetState( file.name, datasetState, 100 );
    return chunkPromise;
};

/**
 * Generate a a single file chunk data obj
 *
 * @param {Object} optionalHeaders - optional headers to be used on http call
 * @param {File} file - file
 * @param {String} fmsTicket - fms ticket
 * @param {SparkMD5.ArrayBuffer} fileMd5 - SparkMD5 hash object
 * @param {Integer} currentChunk - Current chunk in which to upload
 * @param {Integer} chunkSize - default chunk size to use
 * @param {Boolean} isLastChunk - flag for last chunk
 * @returns {Promise} - resolves chunk upload headers and formData
 */
const generateChunk = ( optionalHeaders, file, fmsTicket, fileMd5, currentChunk, chunkSize, isLastChunk = false ) => {
    const loaded = currentChunk * chunkSize - chunkSize;
    const reader = new FileReader();

    return new Promise( ( resolve, reject ) => {
        const fileReaderOnLoad = ( e ) => {
            // First create the chunk hash and update
            const formData = new FormData();
            const chunk = e.target.result;
            const rangeStr = 'Bytes' + ' ' + loaded + '-' + Math.min( loaded + chunkSize - 1, file.size - 1 );
            trace( 'Byte range: ', rangeStr );

            const chunkHash = btoa( SparkMD5.ArrayBuffer.hash( chunk, true ) );
            fileMd5.append( chunk );

            trace( 'Current Chunk: ', currentChunk );
            trace( `Chunk MD5: ${chunkHash}` );

            const fileHeaders = {
                'X-Content-Range': rangeStr,
                'X-Ticket': fmsTicket,
                'X-FSC-Partial-Digest': chunkHash,
                'x-correlation-id': logger.getCorrelationID2(),
                'x-siemens-operation-id': logger.getCorrelationID(),
                'x-siemens-session-id': serviceUtils.getSessionID(),
                ...optionalHeaders
            };

            if( isLastChunk ) {
                const fileHash = btoa( fileMd5.end( true ) );
                trace( `File MD5: ${fileHash}` );
                fileHeaders[ 'X-Digest' ] = `${fileHash}`;
            }

            formData.set( 'fmsTicket', fmsTicket );
            formData.set( 'chunk', new Blob( [ chunk ] ) );
            formData.set( 'fileSize', file.size );
            formData.set( 'datasetName', file.name );

            resolve( {
                formData,
                fileHeaders
            } );
        };
        const fileReaderOnError = ( e ) => {
            trace( 'Error reading file' );
            reject( e );
        };

        const loadNext = () => {
            reader.onload = fileReaderOnLoad;
            reader.onerror = fileReaderOnError;
            const start = loaded;
            const end = Math.min( start + chunkSize, file.size );
            reader.readAsArrayBuffer( file.slice( start, end ) );
        };
        loadNext();
    } );
};

/**
 * Upload a a single file chunk
 *
 * @param {FormData} formData - formData containing chunk, datasetName, fmsTicket, fileSize
 * @param {Object} fileHeaders - file headers to be used on http call
 * @param {Integer} currentChunk - Current chunk in which to upload
 * @returns {Promise} - resolve/reject on successful upload to gateway
 */
const uploadChunk = async( formData, fileHeaders, currentChunk ) => {
    let currentTry = 1;
    let retry = true;

    const uploadNext = async() => {
        return fetch( `${fmsUtils.getFMSFullChunkUploadUrl()}`, {
            method: 'POST',
            headers: fileHeaders,
            body: formData
        } );
    };
    let response;

    // Retry logic
    while ( retry ) {
        response = await uploadNext();
        if( response.ok ) {
            trace( 'Chunk uploaded successful: ', JSON.stringify( {
                currentChunk,
                fileHeaders
            } ) );
            retry = false;
        } else {
            if( currentTry <= maxRetries ) {
                currentTry++;
                trace( 'Retrying upload, current try: ', currentTry );
                await _delay( currentTry * 200 ); // 200ms * current try
            } else {
                retry = false;
                trace( 'Maximum number of retries exceeded, chunk upload failed at chunk: ', currentChunk );
                const body = await response.json();
                const error = new Error( 'Chunk upload failure' );
                error.data = {
                    errorCode: body?.errorCode || '',
                    statusMessage: body?.statusMessage || ''
                };
                error.status = response.status;
                throw error;
            }
        }
    }
    return response;
};

/**
 * Call the fms initiate chunk upload route
 *
 * @param {Object} file - file object with byte stream
 * @param {String} fmsTicket - ticket string generated from fms
 */
const initiateChunkedUpload = async( file, fmsTicket ) => {
    trace( 'Initiating Chunk upload for: ', file.name );
    const fileHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Policy': 'TST',
        'X-Metadata': true,
        'X-Ticket': fmsTicket
    };
    const metadataContent = 'Status=Pending\nfileSize=' + file.size + '\n\n';
    const chunk = new Blob( [ metadataContent ], {
        type: 'application/octet-stream'
    } );

    const formData = new FormData();
    formData.set( 'chunk', chunk );

    const $http = AwHttpService.instance;
    const queryStr = `?datasetName=${encodeURIComponent( file.name )}&fileSize=${file.size}`;
    return $http.post( `${fmsUtils.getFMSFullInitChunkUploadUrl()}${queryStr}`, formData, { headers: fileHeaders } );
};

export default exports = {
    uploadFile,
    chunkFile,
    updateDatasetState,
    CHUNK_UPLOAD_THRESHOLD

};
