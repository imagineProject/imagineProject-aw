// Copyright (c) 2022 Siemens

/**
 * @module js/Am0ImportExportService
 */
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';

var _localTextBundle = localeSvc.getLoadedText( 'AccessmgmtConstants' );

/**
 * This function sets the default value for file name
 * @param {object} data
 * @returns file name
 */
export let populateExportTreePanel = function( data ) {
    var fileName = { ...data.am0FileName };
    var date = new Date();
    var month = date.getMonth() + 1;
    var defaultFileName = 'RuleTree_' + month + date.getDate() + date.getFullYear() + '.xml';
    fileName.dbValue = defaultFileName;
    fileName.uiValue = defaultFileName;
    return fileName;
};

/**
 * Download File *
 * @param {String} fileURL fileUrl
 */
export let downloadFile = function( fileURL, downloadFileName ) {
    //Get XMLHttpRequest is called to check if file will download or not
    //If FMS is down then this request returns 500 error and will not call window.open
    var xhr = new XMLHttpRequest();
    xhr.open( 'GET', fileURL, true );
    xhr.onload = function( e ) {
        if( this.status === 200 ) {
            window.open( fileURL, '_self', 'enabled' );
        } else{
            var errorMsg = _localTextBundle.exportFailOnFMS.replace( '{0}', downloadFileName );
            messagingService.showError( errorMsg );
        }
    };
    xhr.send();
};

/**
 * Eport AM tree
 * This function process file ticket and get the base url of the file
 * @param {*} response - export soa response
 * @param {*} data
 */
export let exportTreeUsingFileTicket = function( response, data ) {
    // Build URL from FileTicket
    var fileTicket = response.fileTicket;
    var downloadFileName = data.am0FileName.dbValue;
    var fileName = '';
    if( downloadFileName && downloadFileName.length > 0 ) {
        var fileNameArr = downloadFileName.split( '.' );
        if( fileNameArr.length > 1 && fileNameArr[fileNameArr.length - 1] !== 'xml' ) {
            downloadFileName += '.xml';
        }
        if( fileNameArr.length === 1 ) {
            downloadFileName += '.xml';
        }
        fileName = encodeURIComponent( downloadFileName );
    } else {
        fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    }
    var downloadUri = 'fms/fmsdownload/' + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    var baseUrl = browserUtils.getBaseURL();
    var fileURL = baseUrl + downloadUri;
    // Download File
    exports.downloadFile( fileURL, downloadFileName );
};

/**
  * Process partial errors to display proper message on failure
  *
  * @param {Object} SOA reponse
  * @return {message} to be displayed
  */
export let processPartialErrors = function( response ) {
    var message = '';
    var partialErrors = '';
    // Check if input response is not null and contains partial errors then only
    if( response && response.partialErrors ) {
        partialErrors = response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }
    // create the error message
    if ( partialErrors  ) {
        _.forEach( partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                message += '\n' + object.message;
            } );
        } );
    }
    return message;
};

/**
 * This is dummy action used to sets isEnabledCloseBtn flag to false. This flag us used to disable close button when import button is clicked.
 * OutputData in viewmodel will set value when function returns the value.
 * @returns false
 */
export const dummyAction = ( ) => {
    return false;
};

const exports = {
    populateExportTreePanel,
    exportTreeUsingFileTicket,
    downloadFile,
    processPartialErrors,
    dummyAction
};
export default exports;

