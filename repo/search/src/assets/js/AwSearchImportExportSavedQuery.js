
// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global */

/**
 *
 * @module js/AwSearchImportExportSavedQuery
 */

import clientDataModel from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import AwChartDataProviderService from 'js/awChartDataProviderService';
import filterPanelService from 'js/filterPanelService';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import navigationUtils from 'js/navigationUtils';
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import dateTimeService from 'js/dateTimeService';
import searchConstants from 'js/searchConstants';
const _EPOCH_TIME = '_epoch_time';

export let processLanguages = function( response ) {
    let langsCode = [];
    let langList = response.languageList;
    if( response.languageList !== 0 ) {
        for( let i = 0; i < langList.length; i++ ) {
            langsCode.push( langList[i].languageCode );
        }
    } else {
        langsCode = [ 'en_US' ]; // Default to English if no language is provided in the response.
    }

    return langsCode;
};
export let viewExportedLogFile = function() {
    setTimeout( function() {
        eventBus.publish( 'exportTemplate.openLogFile' );
    }, 1000 );
};

/**
 * Get the object that need to be exported.
 *
 * @param {Object} selectionData Selection data object that holds the selections
 * @return {Array} Selected Objects array
 */
export let getExportObjects = function( data ) {
    let selectionData = data.selectionData;
    var objects = [];
    var selectedObjects = selectionData.selected;
    var parentSelected = selectionData.pselected;
    // Check if parent selection is not null then use that else use mselected
    if ( parentSelected ) {
        selectedObjects = [ parentSelected ];
    }
    _.forEach( selectedObjects, function( selObj ) {
        objects.push( {
            uid: selObj.uid,
            type: selObj.type
        } );
    } );
    return objects;
};

/**
 * Get the transfer mode object based on import or export case and selected options from UI .
 *
 * @param {Object} data View model object
 * @return {Object} Transfer mode obejct that will be used for import/export
 */
export let getTransferModeUid = function( data ) {
    if( !data.transferModeObjects || data.transferModeObjects.length <= 0 ) {
        return null;
    }
    var modelObject = null;
    // Iterate for all transfer modes to find the valid transfer mode and return
    for( var idx = 0; idx < data.transferModeObjects.length; idx++ ) {
        var transferMode = data.transferModeObjects[ idx ];
        if( transferMode && transferMode.props && transferMode.props.object_name.dbValues[ 0 ] === data.context ) {
            modelObject = transferMode;
            break;
        }
    }
    // Check if no match found and model obejct is null then return null from here
    if( !modelObject ) {
        return modelObject;
    }
    return {
        uid: modelObject.uid,
        type: modelObject.type
    };
};
/**
 * Get the file name user entered in UI. If file name doesn't have
 * extension then it will add extension .xml by default.
 *
 * @param {String} fileName File name user entered
 * @return {String} File name user entered with extension if not present
 */
export let getExportFileName = function( data ) {
    let selectionData = data.selectionData;
    var fileName;
    var selected = selectionData.selected;
    var parentSelected = selectionData.pselected;
    // Check if parent selection is not null then use that else use mselected
    if ( parentSelected ) {
        selected = [ parentSelected ];
        fileName = selected[0].cellHeader1;
    }else{
        fileName = selected[0].cellHeader1;
    }

    if( !fileName ) {
        return null;
    }

    // Get the file extension and if extension is not present
    // then add the extension.
    var fileExtensionPresent = _getFileExtension( fileName );
    if( !fileExtensionPresent ) {
        fileName += '.xml';
    }
    return fileName;
};

/**
 * Get file name extension from file name
 *
 * @param {String} fileName file name
 * @return {String} file name extension
 */
var _getFileExtension = function( fileName ) {
    // Check if input file name nds with .xml extension or not
    if( _.endsWith( fileName, '.xml' ) ) {
        var extIndex = fileName.lastIndexOf( '.' );
        if( extIndex > -1 ) {
            return fileName.substring( extIndex + 1 );
        }
    }
    return null;
};
/**
 * Utility method to get the initial selection Uid string.
 *
 * @param {String} selectedUid Initial selection Uid
 * @returns {String} Initial selection Uid string
 */
export const cacheSelection = selectedUid => {
    return selectedUid;
};

export const setLocalePropertyValuesForName = function( propertyNameArray ) {
    let propertyValues = [];

    for( let i = 1; i < propertyNameArray.length; i++ ) {
        let language = propertyNameArray[i][0].locale;
        let master = false;

        propertyValues[ i - 1 ] =  { name : 'query_name', locale : language, master, seqNum : 0, status : [ 'Approved' ], values : [ propertyNameArray[i][0].propertyName ] };
    }

    return propertyValues;
};

export const setLocalePropertyValuesForDescription = function( propertyDescArray ) {
    let propertyValues = [];

    for( let i = 1; i < propertyDescArray.length; i++ ) {
        let language = propertyDescArray[i][0].locale;
        let master = false;

        propertyValues[ i - 1 ] =  { name : 'query_desc', locale : language, master, seqNum : 0, status : [ 'Approved' ], values : [ propertyDescArray[i][0].propertyDesc ] };
    }

    return propertyValues;
};

export const importSavedQueryHandleImportSavedQuery = async( formData, ctx )=>{
    let xmlValues = appCtxService.getCtx( 'xmlValues' );
    let text  = await formData.get( 'fmsFile' ).text();
    let values = [];
    let  filexml;
    try {
        // Code that may throw an exception
        let parsedXMLDOc = $.parseXML( text );
        filexml = $( parsedXMLDOc );
        let description = filexml.find( 'Description' ).get( 0 );
        let queryClausesString = [];
        if( description ) {
            queryClausesString = filexml.find( '#id4' ).get( 0 ) ? filexml.find( '#id4' ).get( 0 ).attributes.stringValue.textContent : queryClausesString;
        }else{
            queryClausesString = filexml.find( '#id3' ).get( 0 ) ? filexml.find( '#id3' ).get( 0 ).attributes.stringValue.textContent : queryClausesString;
        }
        let revrule;
        if( queryClausesString.length !== 0 ) {
            // Find the REVRULE value using regex
            const revruleMatch = queryClausesString.match( /REVRULE\s+(.+)/ );
            // Extract REVRULE if found
            revrule = revruleMatch ? revruleMatch[1] : '';
        }
        let propertyNameArray = [ { masterlanguage : filexml.find( '#id2' ).get( 0 ).attributes[1].textContent, masterlanguageValue  : filexml.find( '#id1' ).get( 0 ).attributes.name.textContent } ];
        let propertyDescArray = [ { masterlanguage : filexml.find( '#id2' ).get( 0 ).attributes[1].textContent, masterlanguageValue  : filexml.find( '#id1' ).get( 0 ).attributes.name.textContent } ];
        let length = filexml.find( '#id2' ).get( 0 ).childNodes.length;
        let propertyNameValue = filexml.find( '#id2' ).get( 0 ).childNodes;
        let propertyDescValue = filexml.find( '#id3' ).get( 0 ) ? filexml.find( '#id3' ).get( 0 ).childNodes : '';
        for( let i = 1; i < length / 2 + 1; i++ ) {
            propertyNameArray[ i ] = [ { propertyName : propertyNameValue[2 * i - 1].innerHTML, locale : propertyNameValue[2 * i - 1].attributes[0].textContent } ];
        }
        for( let i = 1; i < length / 2 + 1 && propertyDescValue !== ''; i++ ) {
            propertyDescArray[ i ] = [ { propertyDesc : propertyDescValue[2 * i - 1].innerHTML, locale : propertyNameValue[2 * i - 1].attributes[0].textContent } ];
        }
        description = description ? filexml.find( 'Description' ).get( 0 ).innerHTML : '';
        values = [ { name  : filexml.find( '#id1' ).get( 0 ).attributes.name.textContent, desc : description, searchType : filexml.find( '#id1' ).get( 0 ).attributes.queryClass.textContent, queryClause : queryClausesString, revRule :  revrule, propertyNameArray, propertyDescArray } ];
        appCtxService.updatePartialCtx( 'xmlValues', values );
        return values;
    }catch ( error ) {
        // Code to handle the exception
        values.error = error.message;
    }
};

// Decode HTML entities
const htmlDecode = ( input ) => {
    const doc = new DOMParser().parseFromString( input, 'text/html' );
    return doc.documentElement.textContent;
};

/**
 * Get query clauses vector from the given query clause string.
 *
 * @param {String} queryClausesString Query clause string in SQL format
 */
const  decodeSQLToQueryClauses = ( queryClauseString ) => {
    const clausePattern = /"([^"]+)"\s*(>=|<=|=|>|<|!=|IS_NULL|IS_NOT_NULL)\s*("\$\{([^"]+)\s*=\s*([^}]*)\}"|"([^"]+)")/g;
    let match;
    const clauses = [];
    let lastLogicalOperator = '';

    while ( ( match = clausePattern.exec( queryClauseString ) ) !== null ) {
        const attribute = match[1];
        const mathOperator = match[2];
        const userEntryKey = match[4] || '';
        const defaultValue = match[5] || match[6] || ''; // Handle cases with or without a user entry key

        // Determine the logical operator; If there is no logical operator between the clauses, use the default
        const logicalOperator = lastLogicalOperator;

        // Add the clause to the array
        clauses.push( {
            attribute: attribute,
            logicalOperator: logicalOperator,
            userEntryKey: userEntryKey,
            userEntryDisplay: userEntryKey,
            mathOperator: mathOperator,
            defaultValue: defaultValue
        } );

        // Update the last logical operator based on the current clause's operator
        // Logical operators are determined by the operators in the query
        const logicalMatch = /\s*(AND|OR)\s*/g.exec( queryClauseString.substring( clausePattern.lastIndex ) );
        lastLogicalOperator = logicalMatch ? logicalMatch[1] : 'AND';
    }
    return clauses;
};

/**
 * Get query clauses vector from the given query clause string.
 *
 * @param {String} queryClausesString Query clause string in SQL format
 */
export const getQueryClausesVector = function( queryClausesString ) {
    let queryClausestr = queryClausesString;
    let queryClausesVector = [];
    if ( queryClausestr.includes( '<' ) || queryClausestr.includes( '>' ) ) {
        queryClausestr = queryClausestr.replace( /</g, '&lt;'  ).replace( />/g, '&gt;' );
    }
    const decodedQueryString = htmlDecode( queryClausestr );
    queryClausesVector = decodeSQLToQueryClauses( decodedQueryString );

    return queryClausesVector;
};

/**
 * Get query rev rule from the given query clause string.
 *
 * @param {String} queryClausesString Query clause string in SQL format
 */
export const getQueryRevRule = function( queryClausesString ) {
    let indexOfRevRule = queryClausesString.indexOf( 'REVRULE' );
    if( indexOfRevRule >= 0 ) {
        let revRuleArr = queryClausesString.split( 'REVRULE' );
        return revRuleArr[ 1 ].trim();
    }
    return '';
};

/**
 * Get query sorter from the given query clause string.
 *
 * @param {String} queryClausesString Query clause string in SQL format
 */
export const getQuerySorter = function( queryClausesString ) {
    let indexOfSorter = queryClausesString.indexOf( 'ORDER BY' );
    if( indexOfSorter >= 0 ) {
        let sorterArr = queryClausesString.split( 'ORDER BY' );
        let sorterString = sorterArr[ 1 ].trim();
        let indexOfRevRule = sorterString.indexOf( 'REVRULE' );
        if( indexOfRevRule >= 0 ) {
            sorterString = sorterString.split( 'REVRULE' )[ 0 ].trim();
        }

        let sorterParams = sorterString.split( ' ' );
        if( sorterParams.length === 4 ) {
            return {
                attribute: sorterParams[ 0 ],
                order: sorterParams[ 1 ],
                entryKey: sorterParams[ 3 ]
            };
        }
    }
    return {
        attribute: '',
        order: '',
        entryKey: ''
    };
};

const AwSearchImportExportSavedQuery = {
    processLanguages,
    viewExportedLogFile,
    getExportObjects,
    getTransferModeUid,
    getExportFileName,
    cacheSelection,
    importSavedQueryHandleImportSavedQuery,
    getQueryClausesVector,
    setLocalePropertyValuesForName,
    setLocalePropertyValuesForDescription,
    getQueryRevRule,
    getQuerySorter
};

export default AwSearchImportExportSavedQuery;
