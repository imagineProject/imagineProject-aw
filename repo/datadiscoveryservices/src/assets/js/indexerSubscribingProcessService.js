// Copyright 2023 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link indexerSubscribingProcessService}
 *
 * @module js/indexerSubscribingProcessService
 */
import { getBaseUrlPath } from 'app';
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';
import uwPropertySvc from 'js/uwPropertyService';
import AwPromiseService from 'js/awPromiseService';
import localSvc from 'js/localeService';
import indexerAdminConstants from './indexerAdminConstants';

var exports = {};

/**
   * Get ViewModel objects list for objects
   * @param {Object} objects get objects having name, value as key
   * @returns {Object} ViewModel's object list
   */
export let getObjectListVmos = function( objects ) {
    var tmpProps = getObjects( objects );
    var tmpObjects = tmpProps;

    var i = 0;
    for( const objectDataRow of Object.values( objects ) ) {
        var props = {};

        for( const [ objPropName, objPropVal ] of Object.entries( objectDataRow ) ) {
            let convertedValue = objPropVal;
            if( objPropName === indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN2INTERNALNAME ) {
                convertedValue = getConvertedDateValue( objPropVal );
            }
            props[ objPropName ] = createCell( objPropName, convertedValue );
        }
        tmpObjects[ i ].props = props;
        i++;
    }
    return tmpObjects;
};

/**
   * Converts date in format 'DD-MM-YYYYTHH:MM:SS' date value in format 'MMM DD,YYYY, HH:MM AM/PM'
   * @param {String} objPropVal date string in format 'DD-MM-YYYYTHH:MM:SS'
   * @returns {String} date in format 'MMM DD,YYYY, HH:MM AM/PM'
   */
export let getConvertedDateValue = function( objPropVal ) {
    const timestamp = objPropVal;
    const dateObj = new Date( timestamp );

    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };

    return dateObj.toLocaleString( localSvc.getLocale, options );
};

/**
 * Builds the columns for subscribing applications table as per the data type
 * @param {object} uwDataProvider data provider
 * @param {object} columnProvider column provider
 * @return {Object} promise for async call
 */
export let loadColumnsForObjectList = function( uwDataProvider, columnProvider ) {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [];
    //get columns from column provider
    awColumnInfos = columnProvider.columns;

    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * Creates cell for given table
 * @param {String} key Column name
 * @param {Object} value Field value for cell
 * @return {Object} temp2 Returns the cell object
 */
let createCell = function( key, value ) {
    if( value === undefined || value === null ) {
        value = '';
    }
    var temp2 = {};
    temp2.name = key;
    temp2.propertyName = key;
    temp2.propertyDisplayName = key;
    temp2.dbValue = value.toString();
    temp2.dbValues = [ temp2.dbValue ];
    temp2.type = 'STRING';
    temp2.value = value.toString();
    temp2.displayValue = value.toString();
    temp2.uiValue = value.toString();
    return temp2;
};

/**
 * Created objects from the response for give type
 *
 * @param {Object} objects Objects
 * @returns {Object} cells
 */
let getObjects = function( objects ) {
    var cells = [];

    _.forEach( objects, function( object ) {
        let cell = uwPropertySvc.createViewModelProperty( object.name, object.name, object.ObjectType, '', object.name );
        cell.type = 'STRING';
        cell.typeIconURL = '';
        cells.push( cell );
    } );

    return cells;
};

/**
   * Get filtered list of subscribing application list and column config
   * @param {object} columnProvider column provider
   * @param {object} columnInfo column information
   * @param {Object} subscribingProcessList get objects having name, value as key
   * @param {Integer} dataProvider dataprovider start index
   * @param {Integer} pageSize viewModel's pageSize
   * @returns {Object} filtered subscribing processes list
   */
export let getFilterSubscribingProcessListAndColumnConfig = function( columnProvider, columnInfo, subscribingProcessList, dataProvider, pageSize ) {
    //let subscribingProcessListSearchResults = getObjectListVmos( subscribingProcessList );
    updateColumnProvider( columnProvider, columnInfo );
    updateDataproviderCols(dataProvider);
    let endIndex = dataProvider.startIndex + pageSize;
    let filteredSubscribingProcesses = subscribingProcessList?.slice( dataProvider.startIndex, endIndex );
    let totalFound = subscribingProcessList?.length;
    if( totalFound && dataProvider.viewModelCollection.loadedVMObjects.length >= totalFound ) {
        dataProvider.update( subscribingProcessList, totalFound, { endReached: true } );
        filteredSubscribingProcesses = [];
    }
    return {
        filteredSubscribingProcesses: filteredSubscribingProcesses,
        totalFound: totalFound,
        columnProvider: columnProvider
    };
};

/**
 * Updates the cols in the dataProvider
 * @param {Object} columnProvider column provider
 */
let updateDataproviderCols = function(dataProvider) {
    if (dataProvider.cols) {
        for(var col of dataProvider.cols) {

            // The pinnedLeft needs to be set in data provider cols also so that it is reflected in the table.
            // setting pinnedLeft only in columnProvider does not work.
            col.pinnedLeft = false;
            if ( col.field === indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN0INTERNALNAME ||
                col.field === indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN1INTERNALNAME ) {
                col.pinnedLeft = true;
            }
        }
    }
};

/**
 * Update the column provider with the column info
 * @param {Object} columnProvider column provider
 * @param {Object} columnInfo column information
 */
let updateColumnProvider = function( columnProvider, columnInfo ) {
    if( columnProvider.columns.length === 0 ) {
        for( var attrColumn of columnInfo ) {
            const column = {
                displayName: attrColumn.displayName,
                name: attrColumn.internalName,
                width: 240,
                enableColumnMenu: false,
                pinnedLeft: false
            };
            // Specific properties for status column
            if ( attrColumn.internalName === indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN0INTERNALNAME ) {
                column.minWidth = 30;
                column.maxWidth = 30;
                column.width = 30;
                column.cellRenderers = [ cellRenderer() ];
                column.pinnedLeft = true;
            }
            // Specific properties for App Id column
            else if ( attrColumn.internalName === indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN1INTERNALNAME ) {
                column.pinnedLeft = true;
                column.minWidth = 160;
                column.maxWidth = 160;
                column.width = 160;
            }
            columnProvider.columns.push( column );
        }
    }
};

/**
 * Table Cell Renderer for PL Table
 * @return {Object} - cell content
 */
export let cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            const cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            staleAppStatusRenderer( cellContent );
            return cellContent;
        },
        condition: function() {
            return true;
        }
    };
};

/**
 * Renders the status cell with warning indicator for stale AppId
 *
 * @param {DOMElement} containerElement containerElement
 */
let staleAppStatusRenderer = function( containerElement ) {
    // Get the text content which will be used as tool tip
    var title = containerElement.textContent;

    // If a app id is not stale then the title value will be empty.
    // In this we want to keep the cell empty
    if( title ) {
        // remove the cell text
        if( containerElement.childNodes[ 0 ] ) {
            containerElement.removeChild( containerElement.childNodes[ 0 ] );
        }
        const warningIcon = getBaseUrlPath() + '/image/indicatorWarning16.svg';
        let cellImg = document.createElement( 'img' );
        cellImg.title = title;
        cellImg.src = warningIcon;
        containerElement.appendChild( cellImg );
    }
};

/**
   * Get all subscribing application list
   * @param {object} processList column provider
   * @returns {Object} subscribing processes list
   */
export let getSubscribingProcessObjectList = function( processList ) {
    let objectsList = [];

    _.forEach( processList, function( process ) {
        let tmpCell = {};
        tmpCell.AppID = process.name;
        tmpCell.LastProcessedDate = process.values[0];
        tmpCell.Description = '';
        objectsList.push( tmpCell );
    } );
    return objectsList;
};

/**
   * Update the subscribing application list with stale app status
   * @param {object} staleApps the list of stale apps
   * @param {object} objectList subscription list
   * @param {object} datai18n ViewModel's i18n data
   */
export let updateStaleAppIdStatus = function( staleApps, objectList, datai18n ) {
    _.forEach( staleApps, function( staleApp ) {
        _.forEach( objectList, function( objectItr ) {
            if ( objectItr.AppID === staleApp ) {
                objectItr.Status = datai18n.staleAppToolTip;
            }
        } );
    } );
};

/**
   * Update the subscribing application list with its description
   * @param {object} processList the list of apps to process
   * @param {object} objectList subscription list
   * @param {object} datai18n ViewModel's i18n data
   */
export let updateAppIdDescription = function( processList, objectList ) {
    _.forEach( processList, function( process ) {
        _.forEach( objectList, function( objectItr ) {
            if ( objectItr.AppID === process.name ) {
                objectItr.Description = process.values[0];
            }
        } );
    } );
};

/**
   * Get subscribing application column infomation
   * @param {object} datai18n ViewModel's i18n data
   * @returns {Object} subscribing processes column infomation
   */
export let getSubscribingAppsColumns = function( datai18n ) {
    return [
        {
            displayName: datai18n.subcribingProcessColumn1,
            internalName: indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN1INTERNALNAME
        },
        {
            displayName: datai18n.subcribingProcessColumn2,
            internalName: indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN2INTERNALNAME
        },
        {
            displayName: datai18n.subcribingProcessColumn3,
            internalName: indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN3INTERNALNAME
        }
    ];
};

/**
   * Update subscribing application column information with additional column
   * @param {array} columnInfos The column infos
   */
export let updateSubscribingAppsColumns = function( columnInfos ) {
    // Add the column at first position
    columnInfos.unshift( {
        displayName: '',
        internalName: indexerAdminConstants.SUBSCRIBINGTABLE_COLUMN0INTERNALNAME
    } );
};

export default exports = {
    getConvertedDateValue,
    getFilterSubscribingProcessListAndColumnConfig,
    getObjectListVmos,
    getSubscribingAppsColumns,
    getSubscribingProcessObjectList,
    loadColumnsForObjectList,
    updateStaleAppIdStatus,
    updateAppIdDescription,
    updateSubscribingAppsColumns
};
