// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/**
 * @module js/Saw1ResourceChartService
 */

import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import smConstants from 'js/ScheduleManagerConstants';
import AwPromiseService from 'js/awPromiseService';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

var _graphStartDate = null;

/**
   * Load the column configuration into the data provider.
   *
   * @param {Object} dataProvider - the data provider
   */
export let loadColumns = function( dataProvider, i18n ) {
    var deferred = AwPromiseService.instance.defer();
    dataProvider.columnConfig = {
        columns: buildFlatTableColumnInfos( i18n )
    };
    deferred.resolve( {
        columnInfos: buildFlatTableColumnInfos( i18n )
    } );
    return deferred.promise;
};

/**
  * @param {data} data - The qualified data of the viewModel
  * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
  */
function buildFlatTableColumnInfos( i18n ) {
    var columnInfos = [];

    /**
       * Set 1st column to special 'name' column to support tree-table.
       */
    var propName;
    let propDisplayName;
    let propDisplayDay;
    var isTableCommand;
    var dateArray = [];

    dateArray = createColumnArray( _graphStartDate );

    let numOfColumnsIn = 15;
    let months = initializeMonthFull( i18n );
    let weekDays = initializeDayFull( i18n );

    for( var colNdx = 0; colNdx < numOfColumnsIn; colNdx++ ) {
        var columnNumber = colNdx;
        var columnInfo = awColumnSvc.createColumnInfo();
        if( colNdx === 0 ) {
            propName = 'object_name';
            propDisplayName = i18n.resources;
            isTableCommand = true;
            columnInfo.width = 160;
            columnInfo.height = 25;
            columnInfo.minHeight = 25;
            columnInfo.maxHeight = 25;
        } else {
            propName = 'prop' + columnNumber;
            propDisplayName = convertToFormat_DDMMMYYYY( dateArray[colNdx - 1], months );
            propDisplayDay = getDay( dateArray[colNdx - 1], weekDays );
            isTableCommand = true;
            columnInfo.width = 90;
            columnInfo.height = 25;
            columnInfo.minHeight = 25;
            columnInfo.maxHeight = 25;
            columnInfo.dbValue = dateTimeSvc.formatUTC( dateArray[colNdx - 1] );
        }
        columnInfo.name = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.displayDay = propDisplayDay;
        columnInfo.isTableCommand = isTableCommand;
        columnInfos.push( columnInfo );
    }
    return columnInfos;
}

/**
  * @param {date} date - Date to convert into format dd-mmm-yyyy.
  * @param {data} data - The qualified data of the viewModel
  * @returns Returns formated string.
  */
function convertToFormat_DDMMMYYYY( date, months ) {
    var day = date.getDate();
    if( day < 10 ) {
        day = '0' + day;
    }
    var month_index = date.getMonth();
    var year = date.getFullYear();
    return day + '-' + months[month_index] + '-' + year;
}

function getDay( date, weekDays ) {
    var today = date.getDay();
    return weekDays[today];
}

function initializeMonthFull( i18n ) {
    var month_full = [];
    month_full.push( i18n.saw1Month_Jan );
    month_full.push( i18n.saw1Month_Feb );
    month_full.push( i18n.saw1Month_Mar );
    month_full.push( i18n.saw1Month_Apr );
    month_full.push( i18n.saw1Month_May_short );
    month_full.push( i18n.saw1Month_Jun );
    month_full.push( i18n.saw1Month_Jul );
    month_full.push( i18n.saw1Month_Aug );
    month_full.push( i18n.saw1Month_Sep );
    month_full.push( i18n.saw1Month_Oct );
    month_full.push( i18n.saw1Month_Nov );
    month_full.push( i18n.saw1Month_Dec );
    return month_full;
}

function initializeDayFull( i18n ) {
    var days = [];
    days.push( i18n.saw1Day_Sun );
    days.push( i18n.saw1Day_Mon );
    days.push( i18n.saw1Day_Tue );
    days.push( i18n.saw1Day_Wed );
    days.push( i18n.saw1Day_Thu );
    days.push( i18n.saw1Day_Fri );
    days.push( i18n.saw1Day_Sat );
    return days;
}

/**
  * Function to create an array for dates within mentioned date range
  * @param {date} startDate - start Date for column array
  * @returns Array of columns string.
  */
function createColumnArray( startDate ) {
    var dateArray = [];
    var day = startDate.getDay();
    var offsets = smConstants.DAY_CONSTANTS[day];
    var nextDaysToShow = offsets[ 1 ];

    // seconds * minutes * hours * milliseconds = 1 day
    var day = 60 * 60 * 24 * 1000;
    if( day !== 0 ) {
        var prevDaysToshow = offsets[0];
        for( var prevCount = prevDaysToshow; prevCount > 0; prevCount-- ) {
            var dateToPush = new Date( startDate.getTime() - day * prevCount );
            dateArray.push( dateToPush );
        }
    }
    dateArray.push( startDate );
    for( var nextCount = 1; nextCount <= nextDaysToShow; nextCount++ ) {
        var dateToPush = new Date( startDate.getTime() + day * nextCount );
        dateArray.push( dateToPush );
    }
    return dateArray;
}

/**
  * get start in UTC format
  * @param {data} data - The qualified data of the viewModel
  * @param {ctx}  ctx  - Context Object
  */
export let getStartDate = function( dataStartDate, eventData, ctx ) {
    if( eventData && eventData.newStartDate ) {
        dataStartDate = new Date( dateTimeSvc.formatUTC( eventData.newStartDate ) );
    } else if( ctx.twoWeeksDate ) {
        dataStartDate = ctx.twoWeeksDate;
    }else if( !dataStartDate && ctx.resourceLoadTableData ) {
        dataStartDate = ctx.resourceLoadTableData.startDate;
    }else {
        dataStartDate = new Date();
    }

    var day = dataStartDate.getDay();
    var offsets = smConstants.DAY_CONSTANTS[day];
    var prevDaysToshow = offsets[0];
    dataStartDate.setDate( dataStartDate.getDate() - prevDaysToshow );
    var startDateString = dateTimeSvc.formatUTC( dataStartDate );
    _graphStartDate = dataStartDate;
    return startDateString;
};

/**
  * get workload option (All Schedule/Current Schedule)
  * @param {data} data - The qualified data of the viewModel
  * @param {ctx}  ctx  - Context Object
  */
export let getWorkload = function( eventData, ctx ) {
    if( eventData && eventData.newStartDate ) {
        ctx.radioSelection = eventData.radioSelection;
    }
    var workload = [];
    if( !ctx.isAllSchedules ) {
        workload.push( ctx.xrtSummaryContextObject );
    } else{
        ctx.radioSelection = false;
    }
    return workload;
};

/**
  * @param {response} response - SOA response
  * @param {data} data - The qualified data of the viewModel
  * @param {ctx}  ctx  - Context Object
  */
export let loadTableData = function( response, resourceLoadResponse, i18n, dataSearchIndex, ctx, resourceChartDataProvider ) {
    resourceLoadResponse = response;
    var searchResults = loadFlatTableData( resourceLoadResponse, i18n, dataSearchIndex, ctx );
    resourceChartDataProvider.viewModelCollection.loadedVMObjects = searchResults;
    return searchResults;
};

/**
  * Get a page of row data for a 'flat' table.
  * @param {Object} data - An Object (usually the DeclViewModel on the $scope) this action function is invoked from. The r/o 'pageSize' and r/w 'searchIndex' properties on this object are used.
  * @param {String} decoration - Text to pre-pend to cell displayVals
  * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
  */
function loadFlatTableData( resourceLoadResponse, i18n, dataSearchIndex, decoration ) {
    if( !decoration ) {
        decoration = '';
    }
    var deferred = AwPromiseService.instance.defer();
    let flatTableRows = buildFlatTableRows( resourceLoadResponse, buildFlatTableColumnInfos( i18n ) );

    var loadData = loadFlatTableRows( dataSearchIndex, deferred, flatTableRows );
    deferred.promise;
    if( loadData ) {
        return loadData.searchResults;
    }
    return '';
}

/**
  * Function to build rows of Resource Load Graph
  * @param {AwTableColumnInfoArray} columnInfos - Array of column objects to use when building the table rows.
  * @param {data} data - The qualified data of the viewModel
  * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
  */
function buildFlatTableRows( resourceLoadResponse, columnInfos ) {
    var vmRows = [];
    var load = 0;
    var scheduleMembersObjs = [];

    for( var count = 0; count < resourceLoadResponse.resourceChartInfoList.length; count++ ) {
        var obj = tcViewModelObjectSvc.createViewModelObjectById( resourceLoadResponse.resourceChartInfoList[ count].resource );
        scheduleMembersObjs.push( obj );
    }

    for( var rowNdx = 0; rowNdx < resourceLoadResponse.resourceChartInfoList.length; rowNdx++ ) {
        var rowNumber = rowNdx + 1;

        var vmObject = scheduleMembersObjs[rowNdx];

        var dbValues;
        var displayValues;

        _.forEach( columnInfos, function( columnInfo, columnNdx ) {
            var columnNumber = columnNdx;
            if( columnNumber === 0 ) {
                dbValues = [ rowNumber ];
                displayValues = [ scheduleMembersObjs[rowNumber - 1].cellHeader1 ];
            } else if( columnInfo.isTableCommand ) {
                dbValues = [ rowNumber ];
                //Get Percent load from response
                load = resourceLoadResponse.resourceChartInfoList[rowNumber - 1].resourceInfoPerDay[columnNumber - 1].resourceInfo[3].keyValue;
                var isWorkingDay = JSON.parse( resourceLoadResponse.resourceChartInfoList[rowNumber - 1].resourceInfoPerDay[columnNumber - 1].resourceInfo[4].keyValue );
                if( load % 1 === 0 ) {
                    load = Math.trunc( load );
                }
                if ( isWorkingDay ) {
                    displayValues = [ String( load ) + '%' ];
                } else{
                    displayValues = [ '-' ];
                }
            }


            var vmProp = uwPropertySvc.createViewModelProperty( columnInfo.name, columnInfo.displayName,
                columnInfo.typeName, dbValues, displayValues );
            vmProp.propertyDescriptor = {
                displayName: columnInfo.displayName,
                displayDay: columnInfo.displayDay,
                rowIdx: rowNdx,
                rowDate: columnInfo.dbValue
            };
            vmObject.props[columnInfo.name] = vmProp;
        } );

        vmRows.push( vmObject );
    }

    return vmRows;
}

/**
  * Resolve the 'next' page of row data.
  * @param {Object} data - An Object (usually the DeclViewModel on the $scope) this action function is invoked from. The r/o 'pageSize' and r/w 'searchIndex' properties on this object are used.
  * <pre>
  * {
  *     pageSize : {Number} (Optional) Maximum number of rows to return. If not set, default is 20.
  *     searchIndex : {Number} Next page index to be returned (or -1 if no more data)
  * }
  * </pre>
  * @param {DeferredResolution} deferred - Deferral to resolve with the requested row data.
  * @param {ViewModelRowArray} vmRows - Array of all rows in the table.
  */
function loadFlatTableRows( dataSearchIndex, deferred, vmRows ) {
    var pageSize = vmRows.length;
    var searchIndex = 0;

    if( dataSearchIndex ) {
        searchIndex = dataSearchIndex;
    }

    if( searchIndex < 0 ) {
        deferred.resolve( tableDPReqRespHelper.createTableLoadResult( vmRows.length ) );
        return;
    }

    var begNdx = searchIndex * pageSize;

    if( begNdx >= vmRows.length ) {
        deferred.resolve( tableDPReqRespHelper.createTableLoadResult( vmRows.length ) );
        return;
    }

    var endNdx = begNdx + pageSize;

    if( endNdx > vmRows.length ) {
        endNdx = vmRows.length;
    }

    var nextSearchIndex = searchIndex + 1;

    if( endNdx === vmRows.length ) {
        nextSearchIndex = -1;
    }

    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );

    loadResult.searchResults = vmRows.slice( begNdx, endNdx );
    loadResult.searchIndex = nextSearchIndex;

    deferred.resolve( loadResult );
    return loadResult;
}

/**
  * Sets cell renderers for the PL table
  */
export let resourceLoadGridCellRendererFn = function( vmo, containerElem, columnName ) {
    let colData = vmo.props[columnName];
    if( colData ) {
        let objSpan = document.createElement( 'div' );
        let cellImg = document.createElement( 'img' );
        let imgSrc = null;
        cellImg.tabIndex = 0;
        imgSrc = vmo.typeIconURL;
        containerElem.className = 'aw-splm-tableCellTop';
        cellImg.className = 'aw-base-icon aw-type-icon aw-splm-tableIcon';
        cellImg.src = imgSrc;
        cellImg.alt = colData.uiValue;
        let loadVal = parseFloat( colData.uiValue );
        //condition to check for first Row and add click to navigate to child
        if ( columnName === 'object_name' ) {
            containerElem.title = colData.uiValue;
            objSpan.innerHTML = colData.uiValue;
            objSpan.className = 'aw-splm-tableCellText';
            containerElem.appendChild( cellImg );
            objSpan.style.borderStyle = 'solid';
        } else {
            //adding col and row data to display in tooltip
            containerElem.title = vmo.cellHeader1 + '\n' + colData.propertyDescriptor.displayName + '\n' + colData.propertyDescriptor.displayDay;
            objSpan.innerHTML = colData.uiValue;

            if ( loadVal <= 25 ) {
                containerElem.className = 'aw-scheduleManager-resourceLoad25';
            } else if ( loadVal <= 50 ) {
                containerElem.className = 'aw-scheduleManager-resourceLoad50';
            } else if ( loadVal <= 75 ) {
                containerElem.className = 'aw-scheduleManager-resourceLoad75';
            } else if ( loadVal <= 100 ) {
                containerElem.className = 'aw-scheduleManager-resourceLoad100';
            } else if ( loadVal > 100 ) {
                containerElem.className = 'aw-scheduleManager-resourceLoad101';
            } else {
                containerElem.className = 'aw-scheduleManager-resourceLoadWeekend';
            }
        }

        if( columnName !== 'object_name' ) {
            containerElem.onclick = function() {
                var selectedObjects = [];

                var rowUid = vmo.uid;
                var rowObj = cdm.getObject( rowUid );
                var startDateStr = vmo.props[ columnName ].propertyDescriptor.rowDate;
                if( rowObj ) {
                    selectedObjects.push( rowObj );
                }
                selectedObjects.push( startDateStr );
                var selectionData = {
                    selection: selectedObjects
                };
                eventBus.publish( 'resourceLoadViewTable.gridCellSelection', selectionData );
            };
        }

        containerElem.appendChild( objSpan );
    }
};

export let resourceLoadGridHeaderRender = function( containerElement, columnField, tooltip, column ) {
    var headerContent = document.createElement( 'div' );
    var lineBreak = document.createElement( 'br' );

    var labelText1 = document.createElement( 'div' );
    var labelText2 = document.createElement( 'div' );
    labelText1.textContent = column.displayName;
    labelText2.textContent = column.displayDay;

    labelText1.classList.add( 'aw-splm-tableHeaderCellLabel' );
    labelText2.classList.add( 'aw-splm-tableHeaderCellLabel' );
    containerElement.style.textAlign = 'center';

    if( labelText1.textContent === 'Resources' ) {
        containerElement.title = column.displayName;
    } else {
        containerElement.title = column.displayName + '\n' + column.displayDay;
    }

    headerContent.appendChild( labelText1 );
    headerContent.appendChild( lineBreak );
    headerContent.appendChild( labelText2 );

    containerElement.appendChild( headerContent );
};


/**
 * selection logic to select the cell in resourseGraph grid
 * @param {object} eventData event data from the grid cell selection
 */
export let setResourceCellSelection = function( eventData, ctx ) {
    var resources = eventData.selection[0].uid;
    var startDateStr = eventData.selection[1];
    var assignedObject = ctx.xrtSummaryContextObject.uid;
    eventData.startDate = {};
    eventData.resources = {};
    eventData.assignedObjects = {};
    if ( startDateStr && resources && assignedObject ) {
        eventData.startDate = startDateStr;
        eventData.resources = resources;
        eventData.assignedObjects = assignedObject;
        let schToInclude = '';
        if( !ctx.isAllSchedules ) {
            schToInclude = assignedObject;
        }
        eventData.schedulesToInclude = schToInclude;
        eventBus.publish( 'Saw1ResourceChart.cellSelected', eventData );
    }
};

/**
   * set command context.
   * @param {data} data - The qualified data of the viewModel
   * @param {ctx}  ctx  - Context Object
   */
export let setCommandContextSearchCriteria = function( commandContext, eventMap, ctx ) {
    if ( commandContext ) {
        commandContext = {};
    }
    if( eventMap ) {
        commandContext.searchCriteria = {
            searchContentType: 'ResourceChartAssignedTasks',
            resources: eventMap['Saw1ResourceChart.cellSelected'].resources,
            assignedObjects: eventMap['Saw1ResourceChart.cellSelected'].assignedObjects,
            startDate: eventMap['Saw1ResourceChart.cellSelected'].startDate,
            endDate: eventMap['Saw1ResourceChart.cellSelected'].startDate,
            schedulesToInclude: eventMap['Saw1ResourceChart.cellSelected'].schedulesToInclude,
            objectSet: 'Saw1TaskSearchProvider.ScheduleTask',
            parentUid: ctx.xrtSummaryContextObject.uid
        };

        let contextObjectName = ctx.xrtSummaryContextObject.props.object_name.dbValues[0];
        commandContext.displayTitle = contextObjectName.replace( /\s/g, '_' ) + '_assignedTasks';
        return commandContext;
    }
};
/**
   * set start date as Next two weeks or Previous Two Weeks
   * @param {bool} isNextWeek - true Next two weeks/ false Previous Two Weeks
   * @param {ctx}  ctx  - Context Object
   */
export let setTwoWeeksDate = function( ctx, isNextWeek ) {
    var day = 60 * 60 * 24 * 1000;
    let updatedStartDate;
    if( isNextWeek === true ) {
        updatedStartDate = new Date( _graphStartDate.getTime() + day * 14 );
        ctx.twoWeeksDate = updatedStartDate;
    } else if( isNextWeek === false ) {
        updatedStartDate = new Date( _graphStartDate.getTime() - day * 14 );
        ctx.twoWeeksDate = updatedStartDate;
    } else {
        ctx.twoWeeksDate = new Date();
    }
    return ctx.twoWeeksDate;
};
export let selectAssignedTasks = function( eventData, selectionData ) {
    let selectedObjects = eventData.selectedUids.map( uid => cdm.getObject( uid ) );
    selectionData.update( { ...selectionData.getValue(), selected:selectedObjects } );
};

/**
   * set All Schedules or Current Schedules for viewing Assigned Tasks
   * @param {ctx}  ctx  - Context Object
   */
export let toggleToAllSchedules = function( ctx ) {
    if( ctx.isAllSchedules ) {
        ctx.isAllSchedules = false;
    } else {
        ctx.isAllSchedules = true;
    }
    return ctx.isAllSchedules;
};

export let setGoToDate = function( ctx, data ) {
    ctx.twoWeeksDate = new Date( data.goToDate.dbValue );
    return ctx.twoWeeksDate;
};

export default exports = {
    loadColumns,
    getStartDate,
    getWorkload,
    loadTableData,
    resourceLoadGridCellRendererFn,
    resourceLoadGridHeaderRender,
    setResourceCellSelection,
    setCommandContextSearchCriteria,
    setTwoWeeksDate,
    toggleToAllSchedules,
    setGoToDate,
    selectAssignedTasks
};


