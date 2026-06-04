// Copyright (c) 2022 Siemens

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import { Saw1ProgramViewCallbacks } from 'js/Saw1ProgramViewCallbacks';
import Saw1ProgramViewDataService from 'js/Saw1ProgramViewDataService';
import logger from 'js/logger';
import awColumnSvc from 'js/awColumnService';
import appCtxSvc from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import smConstants from 'js/ScheduleManagerConstants';

/**
 * Initializes the required properties for the Gantt to be loaded.
 * @param {Object} atomicDataRef Atomic data
 */
export const initializeProgramViewChartState = ( atomicDataRef, configColumns ) => {
    document.getElementsByClassName( 'aw-panelSection' )[0].classList.add( 'h-12', 'aw-scheduleManager-programView' ); // This is for when we open the object
    document.getElementsByClassName( 'aw-layout-wrap' )[0] ? document.getElementsByClassName( 'aw-layout-wrap' )[0].classList.add( 'h-12' ) : ''; // This is for when we open the object in secondary work area
    atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        ganttConfig: getProgramViewGanttConfig( configColumns ),
        zoomLevel: 'day',
        callbacks: new Saw1ProgramViewCallbacks()
    } );

    return {
        isProgramViewInited: true,
        programViewDataService: new Saw1ProgramViewDataService()
    };
};

/**
 * This function is used to clear Gantt
 * @param {Object} atomicDataRef : Atomic data
 */
export const clearGantt = ( atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    ganttInstance.clearAll();
};

/**
 * This function is used to clear Gantt
 * @param {Object} atomicDataRef : Atomic data
 * @param {Array} configColumns List of columns for Arrange panel
 */
export const updateGanttColumns = ( atomicDataRef, configColumns ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    ganttInstance.config.columns = prepareColumnsForGantt( configColumns );
    ganttInstance.render();
};

/**
 * Initialize the basic Program View properties for loading the chart.
 * @returns {Object} The Program View properties
 */
const getProgramViewGanttConfig = ( configColumns ) => {
    let ganttConfig = awGanttConfigService.getDefaultConfiguration();
    ganttConfig.scale_height = 72; // XLARGE
    ganttConfig.bar_height = 'full';
    ganttConfig.columns = prepareColumnsForGantt( configColumns );
    return ganttConfig;
};

/**
 * Pushes the work time and set the schedule UIDs to toolbar component. This is done after the Gantt Chart is initialized and ready to parse the data to be displayed in Gantt.
 */
export const loadInitialDataToProgramView = ( response, atomicDataRef ) => {
    let isProgramViewDataInited = false;
    if( response && response.configuration && response.programView && response.programViewNodes ) {
        try {
            atomicDataRef.programViewConfigurations.setAtomicData( {
                ...atomicDataRef.programViewConfigurations.getAtomicData(),
                configurations: response.configuration,
                isUpdateReq: false,
                openedObj: response.programView
            } );
            let calendarInfo = {
                dayRanges: response.dayRanges,
                eventRanges: response.eventDateRanges
            };
            atomicDataRef.ganttChartState.setAtomicData( {
                ...atomicDataRef.ganttChartState.getAtomicData(),
                workTimes: getWorkTimes( calendarInfo )
            } );

            isProgramViewDataInited = true;
        } catch( error ) {
            logger.error( 'Failed to load inital data in Gantt: ', error );
        }
    }

    return { isProgramViewDataInited: isProgramViewDataInited };
};

/**
 * This will push the Initial data to Program View Chart.
 * @param {object} response - response fom SOA
 * @param {object} atomicDataRef - Atomic data
 * @param {object} programViewDataService - Instance of data service
 */

export const loadInitialObjects = ( response, atomicDataRef, programViewDataService ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( ganttInstance ) {
        ganttInstance.batchUpdate( () => {
            let obj = cdm.getObject( response.programView.uid );
            // This will determine if ProgramView has child or not.
            obj.props.hasChildren = response.configuration.scheduleUIDs ? response.configuration.scheduleUIDs.length > 0 : false;
            let rootNode = programViewDataService.constructGanttObject( obj );
            ganttInstance.addTask( rootNode );
            addChildNodesToProgramView( response.programViewNodes, programViewDataService, ganttInstance, rootNode.uid );
        } );
    }
};

/**
 * This will add the hasChildren prop to model object
 * @param {object} node - programViewNodes return from SOA
 * @param {object} modelObj - model object to set the prop
 */
const addHasChildProp = ( node, modelObj ) => {
    let childProp = _.find( node.nodeProperties, function( o ) {
        if( o.name === 'hasChildren' ) {
            return o;
        }
    } );
    modelObj.props.hasChildren = {
        dbValue: childProp.stringValue
    };
};

/**
 * This will create the dummy model object.
 * @param {Object} node - programViewNodes return from the server
 * @returns modelObject
 */
const createDummyModelObjs = ( node ) => {
    let typeProp = _.find( node.nodeProperties, function( o ) {
        if( o.name === 'nodeType' ) {
            return o;
        }
    } );
    let uidProp = _.find( node.nodeProperties, function( o ) {
        if( o.name === 'uid' ) {
            return o;
        }
    } );
    let props = {};
    node.nodeProperties.forEach( function( prop ) {
        if( prop.name !== 'nodeType' && prop.name !== 'uid' ) {
            props[ prop.name ] = {
                dbValues: [ prop.stringValue ],
                uiValues: [ prop.stringValue ],
                dbValue: prop.stringValue,
                uiValue: prop.stringValue
            };
        }
    } );
    return {
        type: typeProp.stringValue,
        uid: uidProp.stringValue,
        props: props,
        modelType: {
            typeHierarchyArray: [ typeProp.stringValue ]
        }
    };
};

/**
 * This will add the child nodes in the chart
 * @param {object} childObjs - child objects to add
 * @param {object} programViewDataService - Instance of program view data service
 * @param {object} ganttInstance - GanttInstance
 * @param {string} parentNodeUid - uid of parent node
 * @param {object} childResponse - ProgramViewNodes returned from SOA
 */
const addChildNodesToProgramView = ( childObjs, programViewDataService, ganttInstance, parentNodeUid, childResponse ) => {
    childObjs.forEach( ( obj ) => {
        let modelObj = obj;
        if( !obj.modelType ) {
            modelObj = createDummyModelObjs( obj );
        } else {
            let node = _.find( childResponse.programViewNodes, function( o ) {
                return _.find( o.nodeProperties, function( t ) {
                    return t.name === 'uid' && t.stringValue === modelObj.uid;
                } );
            } );
            addHasChildProp( node, modelObj );
        }

        let ganttChildObj = programViewDataService.constructGanttObject( modelObj );

        ganttInstance.addTask( ganttChildObj, parentNodeUid );
    } );
};

export let validateAndLoadProps = () => {
    return document.getElementsByClassName( 'gantt_ver_scroll' )[0] ? 'scrollIsPresent' : 'loadProps';
};

/**
 * This will add and display the data
 * @param {object} childResponse - programView Nodes returned from SOA
 * @param {object} childObjs - Child Objects to add.
 * @param {object} atomicDataRef - atomic data
 * @param {object} programViewDataService - Instance of programDataService
 * @param {String} parentNodeUid - uid to add child
 */
export const displayChildData = ( childResponse, childObjs, atomicDataRef, programViewDataService, parentNodeUid ) => {
    if( childObjs && childObjs.length > 0 ) {
        let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
        addChildNodesToProgramView( childObjs, programViewDataService, ganttInstance, parentNodeUid, childResponse );
    }
};

/**
 * This will parse the repsonse from SOA
 * @param {object} childResponse - programViewNodes got from SOA
 * @returns child Objects
 */
export const parseChildData = ( childResponse ) => {
    let childObjs = [];
    if( childResponse && childResponse.programView && childResponse.programViewNodes ) {
        childResponse.programViewNodes && childResponse.programViewNodes.forEach( ( node ) => {
            childObjs.push( createDummyModelObjs( node ) );
        } );
    }
    return childObjs;
};

/**
 * Returns the work times as per the Gatt chart expected format, built
 * using the input calendar information.
 * @param {Object} calendarInfo The calendar information.
 * @returns {Array} Array of work times
 */
const getWorkTimes = ( calendarInfo ) => {
    let workTimes = [];

    if( calendarInfo && calendarInfo.dayRanges ) {
        calendarInfo.dayRanges.forEach( function( dayRange ) {
            let hours = [];
            if( dayRange.ranges ) {
                for( let i = 0; i < dayRange.ranges.length; i += 2 ) {
                    hours.push( dayRange.ranges[ i ] + '-' + dayRange.ranges[ i + 1 ] );
                }
            }
            workTimes.push( {
                day: dayRange.day,
                hours: hours.length > 0 ? hours : false
            } );
        } );
    }

    if( calendarInfo && calendarInfo.eventRanges ) {
        workTimes.push( { date: new Date( calendarInfo.eventRanges.eventDate ) } );
    }
    return workTimes;
};

/**
    * Creates the columns required for Arrange panel and open the panel
    * @param {Array} configColumns List of columns for Arrange panel
*/
export const arrangeColumns = ( configColumns ) => {
    let columns = [];
    configColumns.forEach( ( col ) => {
        let arrangeCol = getAWColumnInfo( col );
        if( arrangeCol ) {
            columns.push( arrangeCol );
        }
    } );
    let columnConfigId = 'Saw1ProgramViewColumns';
    var columnsSetting = {
        name: 'gridView',
        columns: columns,
        columnConfigId: columnConfigId,
        objectSetUri: columnConfigId
    };
    appCtxSvc.registerCtx( 'ArrangeClientScopeUI', columnsSetting );
    let config = {
        width: 'EXTRAWIDE'
    };
    commandPanelService.activateCommandPanel( 'arrange', 'aw_toolsAndInfo', null, null, null, config );
};

/**
    * Returns the column information required for Arrange panel
    * @param {Object} col Column to display in Arrange panel
    * @returns {Object} column information for Arrange panel
    */
const getAWColumnInfo = ( col ) => {
    return awColumnSvc.createColumnInfo( {
        associatedTypeName:col.associatedTypeName,
        name: col.propDescriptor ? col.propDescriptor.propertyName : col.propertyName,
        propertyName: col.propDescriptor ? col.propDescriptor.propertyName : col.propertyName,
        displayName: col.propDescriptor ? col.propDescriptor.displayName : col.displayName,
        typeName: col.columnSrcType,
        columnOrder: col.columnOrder,
        visible: !col.hiddenFlag,
        pixelWidth: col.pixelWidth,
        sortDirection: 'Descending',
        sortPriority: col.sortPriority,
        sortBy: col.sortByFlag,
        hiddenFlag: col.hiddenFlag,
        showIcon: col.showIcon,
        isFilteringEnabled: false
    } );
};

/**
     * This function will create soaColumnsInfo.
     * @param {Object} eventData event data
     * @returns {Array} The columns list for saveUIColumnConfigs SOA
     */
export const getArrangeCols = ( eventData ) => {
    let soaColumnInfos = [];
    let index = 100;
    _.forEach( eventData.columns, function( col ) {
        let soaColumnInfo = awColumnSvc.createSoaColumnInfo( col, index );
        soaColumnInfos.push( soaColumnInfo );
        index += 100;
    } );
    return soaColumnInfos;
};

/**
* Returns the list of columns for Gantt.
* @param {Object} colResponse The response from getOrResetUiConfig SOA
* @returns {Array} The list of columns for Gantt.
*/
export const getAWColumnInfoList = ( colResponse ) => {
    let columnArray = colResponse.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
    if( columnArray && columnArray.length > 0 ) {
        columnArray[ 0 ].showIcon = true;
    }
    let columnArrayVisible = [];
    for( let i = 0; i < columnArray.length; i++ ) {
        if( columnArray[ i ].hiddenFlag === false ) {
            columnArrayVisible.push( columnArray[ i ] );
        }
    }
    return columnArray;
};

/**
     * Prepares the columns in format required by Gantt
     * @param {Array} columns The list of columns
     * @returns {Array} The list of columns in format required by Gantt
     */
const prepareColumnsForGantt = ( columns ) => {
    var ganttColumns = [];
    columns.forEach( function( column ) {
        let col = getAWColumnInfo( column );
        var colName = col.field ? col.field : col.name;
        if( colName && colName !== 'icon' && !col.hiddenFlag ) {
            var updatedColName = smConstants.PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING[ colName ];
            if( updatedColName ) {
                colName = updatedColName;
            }
            var column = {};
            column.name = colName;
            column.tree = col.showIcon;
            column.label = col.displayName;
            if( col.pixelWidth ) {
                column.width = col.pixelWidth;
            } else {
                column.width = 150;
            }
            let minWidth = col.displayName.length * 9;
            column.min_width = minWidth;
            if( column.width < minWidth ) {
                column.width = minWidth;
            }
            column.resize = true;
            column.columnSrcType = col.columnSrcType;
            column.template = col.template;
            ganttColumns.push( column );
        }
    } );
    return ganttColumns;
};

export let resetFlagForAllTasks = ( atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let allLoadedTasks = ganttInstance.getTaskBy( 'isProcessed', true );
    allLoadedTasks.forEach( function( task ) {
        task.isProcessed = false;
    } );
};
