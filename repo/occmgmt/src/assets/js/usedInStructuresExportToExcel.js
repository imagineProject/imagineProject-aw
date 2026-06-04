// Copyright (c) 2023 Siemens

/**
 * Module for the Export to Excel panel
 *
 * @module js/usedInStructuresExportToExcel
 */

import cdm from 'soa/kernel/clientDataModel';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import fileMgmtSvc from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';

let exports = {};

/**
 * Downloads the dataset named reference for a notification object
 *
 * @param {Object} notificationObj - notification object
 */
var downloadExportedFile = function( data ) {
    let notificationObj = data.object;
    var imanFile = null;
    var datasetObject = cdm.getObject( notificationObj.props.fnd0TargetObject.dbValues[ 0 ] );
    //get Named reference File
    if( datasetObject.props.ref_list && datasetObject.props.ref_list.dbValues.length > 0 ) {
        imanFile = datasetObject.props.ref_list.dbValues[ 0 ];
        downloadImanFile( imanFile );
    }
};

/**
 * Downloads the File attached with named reference for a notification object
 *
 * @param {Object} notificationObj - notification object
 * @param {Object} imanFile - imanFile object
 */
var downloadImanFile = function( imanFile ) {
    //Get iman file object from uid
    var imanFileModelObject = cdm.getObject( imanFile );
    //downloadTicket
    var files = [ imanFileModelObject ];
    var promise = fileMgmtSvc.getFileReadTickets( files );
    promise.then( function( readFileTicketsResponse ) {
        processReadTicketResponse( readFileTicketsResponse.tickets );
    } );
};
/**
 * to localize file name based on current local configuration
 * @param {string} fileName
 */
let getLocaleFileName = function( fileName ) {
    /**
     * Server returning filename like
     * 'usedinstructure_ItemName_timestamp.xsml' or 'toplevel_ItemName_timestamp.xlsm'
     * so based on intial prefix still first '_' identifying file belong to which section
     * and appending that locale value.
     */

    let section = fileName.split( '_' )[ 0 ];
    let sectionInLocale = localeSvc.getLoadedText( 'UsedInStructure' );
    let sectionStr = '';
    if( section === 'usedinstructure' ) {
        sectionStr = sectionInLocale.usedInStructure.split( ' ' );
    } else {
        sectionStr = sectionInLocale.topLevel.split( ' ' );
    }
    let fileNameWithLocalWord = sectionStr[ 0 ];
    for( let i = 1; i < sectionStr.length; i++ ) {
        fileNameWithLocalWord = fileNameWithLocalWord + '_' + sectionStr[ i ];
    }
    return fileNameWithLocalWord + fileName.slice( section.length );
};

/**
 * Download/open file with given fms ticket.
 *
 * @param {Object} readFileTicketsResponse - file tickets
 */
var processReadTicketResponse = function( readFileTicketsResponse ) {
    let exportToExcelFileNameVal = '';
    if( readFileTicketsResponse && readFileTicketsResponse[ 0 ][ 0 ].props && readFileTicketsResponse[ 0 ][ 0 ].props.original_file_name.uiValues[ 0 ] ) {
        /**
         * Code reach here in case of Run In Background
         */
        exportToExcelFileNameVal = getLocaleFileName( readFileTicketsResponse[ 0 ][ 0 ].props.original_file_name.uiValues[ 0 ] );
        fmsUtils.openFile( readFileTicketsResponse[ 1 ][ 0 ], exportToExcelFileNameVal );
    } else if( readFileTicketsResponse ) {
        var length = readFileTicketsResponse[ 1 ].length;
        exportToExcelFileNameVal = getLocaleFileName( getFileName( readFileTicketsResponse[ 1 ] ) );
        fmsUtils.openFile( readFileTicketsResponse[ 0 ], exportToExcelFileNameVal );
    } else {
        showNoFileMessage();
    }
};

var getFileName = function( fileTicketsFromServer ) {
    let position = fileTicketsFromServer.search( 'usedinstructure' );
    let length = fileTicketsFromServer.length;
    if( position < 0 ) {
        position = fileTicketsFromServer.search( 'toplevel' );
    }
    return fileTicketsFromServer.slice( position, length );
};

var showNoFileMessage = function() {
    localeSvc.getTextPromise().then( function( localTextBundle ) {
        msgSvc.showInfo( localTextBundle.NO_FILE_TO_DOWNLOAD_TEXT );
    } );
};

/* return selected properties
 * @param {Object} data - The view model data
 */
export let getSelectedProperties = function( selectedColumns ) {
    let columnArray = [];
    columnArray = selectedColumns.dbValue;
    let properties = [];
    _.forEach( columnArray, function( column ) {
        let internalName = column.propertyName;
        let displayName = column.propertyDisplayName;
        properties.push( internalName.concat( ':', displayName ) );
    } );
    return properties;
};

export let getExportOptionValueForExcel = function( data, props ) {
    var exportOptions = [];
    if( data.runInBackground && data.runInBackground.dbValue ) {
        exportOptions.push( {
            option: 'RunInBackground',
            optionvalue: 'RunInBackground'
        } );
    }
    if( props.level === 'IMMEDIATE_PARENTS' ) {
        exportOptions.push( {
            option: 'whereusedLevel',
            optionvalue: '-1'
        } );
    } else if( props.level === 'TOP_LEVEL_PARENTS' ) {
        exportOptions.push( {
            option: 'whereusedLevel',
            optionvalue: '-2'
        } );
    }
    if( data.subPanelContext.toggleButtonState.dbValue ) {
        exportOptions.push( {
            option: 'isConfigured',
            optionvalue: 'true'
        } );
    } else {
        exportOptions.push( {
            option: 'isConfigured',
            optionvalue: 'false'
        } );
    }
    return exportOptions;
};

exports = {
    getSelectedProperties,
    getExportOptionValueForExcel,
    downloadExportedFile,
    processReadTicketResponse
};
export default exports;
