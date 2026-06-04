// Copyright (c) 2022 Siemens

/**
 * @module js/fileDownloadService
 */

import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import { forEach, max } from 'lodash';
import messagingService from 'js/messagingService';
var exports = {};

/**
 * Prepare download file message
 * @param {OBJECT} data - declarative ViewModel Information
 * @param {String} textMsgParamForImanFileObj  - file name derived from ImanFile object
 * @param {String} textMsgParamForDatasetObj  - file name derived from Dataset object
 * @return {String } finalMessage - Final message to be displayed in the sublocation view
 */
export let prepareMessageBeforeDownload = function( data, textMsgParamForImanFileObj, textMsgParamForDatasetObj ) {
    let finalMessage = null;
    if( textMsgParamForImanFileObj !== undefined ) {
        finalMessage = data.i18n.fileDownloadRetryMessage.replace( '{0}', textMsgParamForImanFileObj );
    }
    if( textMsgParamForDatasetObj !== undefined ) {
        finalMessage = data.i18n.fileDownloadRetryMessage.replace( '{0}', textMsgParamForDatasetObj );
    }
    return finalMessage;
};

/**
 * Get file ticket info
 * @param {Object} selectionModel  - Command Context selectionModel Object
 * @returns {Promise} This promise will be 'resolved' or 'rejected'  */
export let downloadImanFile = function( selectionModel ) {
    let imanFileUIDs = selectionModel?.getSelection();
    if( imanFileUIDs ) {
        let imanFiles = [];
        forEach( imanFileUIDs, function( fileUid ) {
            let modelObject = cdm.getObject( fileUid );
            if( modelObject.type === 'ImanFile' ) {
                imanFiles.push( modelObject );
            }
        } );

        return soaSvc.post( 'Core-2006-03-FileManagement', 'getFileReadTickets', {
            files: imanFiles
        } );
    }
};

export let prepareMessageAfterDownload = function( eventData ) {
    let finalMessage = '';
    let modelObjectDBValue =  eventData?.scope?.data?.iModelObject?.props?.object_string?.dbValues && eventData.scope?.data?.iModelObject?.props?.object_string?.dbValues.length > 0  ?
        eventData.scope?.data?.iModelObject?.props?.object_string?.dbValues[0]  : '';
    if( eventData && eventData.scope && eventData.scope.errorCode ) {
        finalMessage =  eventData.scope.errorCode.code === 525202 && modelObjectDBValue  ?
            eventData.scope.data?.i18n.permissionDeniedMessage.replace( '{0}', modelObjectDBValue ) : eventData.scope.errorCode.message;
    } else if( eventData && eventData.scope && eventData.scope.errorCodes && eventData.scope.errorCodes.length > 0 ) {
        finalMessage =  eventData.scope.errorCodes[0].code === 525202  ?
            eventData.scope.data?.i18n.permissionDeniedMessage.replace( '{0}', modelObjectDBValue ) : eventData.scope.errorCodes[0].message;
    }
    return finalMessage;
};

/**
 * process for partial errors
 * @param {*} serviceData download response
 * @return {*} message object to display
 */
export let processDownloadMessages = function( response, data ) {
    let emptyFileTicketCount = 0;
    let accessDeniedFiles = [];
    if ( response?.output?.length > 0 ) {
        emptyFileTicketCount = response.output.reduce( ( count, output ) =>
            !output.fileTicket ? count + 1 : count, 0 );
        // permission denied is handled at the client side for the objects which have fileName but no fileTicket.
        // This will be updated later to be handled on the server side.
        accessDeniedFiles = response.output.filter( output =>
            output.fileName.trim() !== '' &&  !output.fileTicket
        );
    }
    if( emptyFileTicketCount > 3 ) {
        if( data.inputModelObjects.length === emptyFileTicketCount ) {
            messagingService.showError( data.i18n.multipleObjectsDownloadedFullFailureMessage );
        } else {
            messagingService.showError( data.i18n.multipleObjectsDownloadedPartialSuccessMessage.replace( '{0}',
                data.inputModelObjects.length - emptyFileTicketCount ).replace( '{1}', data.inputModelObjects.length ) );
        }
    } else if( emptyFileTicketCount === 0 && accessDeniedFiles.length === 0 ) {
        messagingService.showInfo(  data.inputModelObjects.length > 1  ? data.i18n.multipleObjectsWereDownloadedMessage.replace( '{0}',
            data.inputModelObjects.length ) : data.i18n.singleObjectWasDownloadedMessage );
    } else {
        preparePartialErrorMessages( emptyFileTicketCount, accessDeniedFiles, data, response );
    }
};

const preparePartialErrorMessages = function( emptyFileTicketCount, accessDeniedFiles, data, response ) {
    const partialErrors = response?.ServiceData?.partialErrors ? response?.ServiceData?.partialErrors : [];
    let msgObj = {
        msg: '',
        level: 0
    };
    let accessDeniedMessages = [];
    forEach( accessDeniedFiles, function( file ) {
        accessDeniedMessages.push( {
            errorValues: [
                {
                    message: data.i18n.downloadPermissionDeniedMesssage.replace( '{0}', file.fileName ),
                    level: 3
                }
            ]
        } );
    } );
    if( response?.ServiceData?.partialErrors?.length > 0 ) {
        partialErrors[ 0 ].errorValues[ 0 ].message = data.i18n.multipleObjectsPartialDownloadedMessage.replace( '{0}',
            data.inputModelObjects.length - emptyFileTicketCount ).replace( '{1}', data.inputModelObjects.length );
    } else {
        partialErrors.push( {
            errorValues: [
                {
                    message: data.i18n.multipleObjectsPartialDownloadedMessage.replace( '{0}',
                        data.inputModelObjects.length - accessDeniedFiles.length ).replace( '{1}', data.inputModelObjects.length ),
                    level: 3
                }
            ]
        } );
    }
    partialErrors.push( ...accessDeniedMessages );
    forEach( partialErrors, function( partialError ) {
        getMessageString( partialError.errorValues, msgObj );
    } );
    messagingService.showError( msgObj.msg );
};

/**
 * Gets message string
 * @param {*} messages Messages to display
 * @param {*} msgObj msgObj
 */
const getMessageString = function( messages, msgObj ) {
    forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = max( [ msgObj.level, object.level ] );
    } );
};

export default exports = {
    prepareMessageBeforeDownload,
    downloadImanFile,
    prepareMessageAfterDownload,
    processDownloadMessages
};
