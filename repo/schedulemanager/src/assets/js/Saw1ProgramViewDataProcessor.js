// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/Saw1ProgramViewDataProcessor
 */
import dataSource from 'js/Saw1ProgramViewDataSource';
import programViewTemplates from 'js/ProgramView/uiProgramViewTemplates';
import uiProgramViewEventHandler from 'js/ProgramView/uiProgramViewEventHandler';
import smConstants from 'js/ScheduleManagerConstants';
import eventBus from 'js/eventBus';
import ganttManager from 'js/uiGanttManager';
import GanttDataProcessor from 'js/GanttDataProcessor';

export default class Saw1ProgramViewDataProcessor extends GanttDataProcessor {
    constructor() {
        super();
        this.propertyPolicyID = '';
    }

    getEventDateRanges() {
        return dataSource.instance.getAllEventDateRanges();
    }

    getDateFormat() {
        return smConstants.PROGRAM_VIEW_DATE_FORMAT;
    }

    getAllDateRanges() {
        return dataSource.instance.getAllDateRanges();
    }

    clearAndReInitGantt( response, ctx, data, operationType, isToSetColumns ) {
        ganttManager.getGanttInstance().clearAll();
        dataSource.instance.cleanup();
        let ganttData = dataSource.instance.parseManagePrgViewSOAResponse( response, ctx, data, operationType );
        ganttManager.getGanttInstance().parse( ganttData, 'json' );
    }

    initGanttCustomisations( data ) {
        programViewTemplates.addTemplates();
        //year is passed here, so day's scale will be picked up. The same function is used for the scale change as well.
        this.setScaleForGantt( 'year' );
        uiProgramViewEventHandler.registerGanttEvents( this, data );
        uiProgramViewEventHandler.registerAWEvents();
    }

    getDataSource() {
        return dataSource.instance;
    }

    setScaleForGantt( scale ) {
        programViewTemplates.loadGanttScale( scale );
    }

    getGanttColumnName( colName ) {
        return smConstants.PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING[ colName ];
    }

    getServerColumnName( colName ) {
        return  smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ colName ];
    }

    getReferenceTaskForPagination( visibleTasks ) {
        return dataSource.instance.getVisibleReferenceTask( visibleTasks );
    }

    getUpdatedTaskArray( uidArray, propertiesToBeLoaded ) {
        return dataSource.instance.getUpdateTasksWithProperties( uidArray, propertiesToBeLoaded );
    }

    getGanttHeight() {
        var subLocHeight = document.getElementsByClassName( 'aw-layout-sublocationContent' )[ 0 ].clientHeight;
        var xrtTabs = document.getElementsByClassName( 'aw-xrt-tabsContainer' )[ 0 ];

        var xrtTabHeight = xrtTabs ? xrtTabs.clientHeight : 0;
        if( isNaN( xrtTabHeight ) ) {
            xrtTabHeight = 0;
        }

        var toolbar = document.getElementsByClassName( 'aw-schedulemanager-prgView-toolbar' );
        var toolbarHeight = toolbar && toolbar.length > 0 ? toolbar[ 0 ].clientHeight : 0;
        toolbarHeight += 28; // to compensate margins
        var columnHeight = 85;
        var height = subLocHeight - xrtTabHeight - toolbarHeight - columnHeight;
        if( height < 200 ) {
            height = 200;
        }
        return height;
    }


    getNodeVMOs( nodes ) {
        var vmoArray = [];
        nodes.forEach( function( node ) {
            var VMO = {
                uid: node.id,
                type: node.nodeType
            };
            vmoArray.push( VMO );
        } );
        return vmoArray;
    }

    paginateForTaskOpened( parentTaskId, referenceTaskId ) {
        var isPaginationCompleted = dataSource.instance.isPaginationCompletedForParent( parentTaskId );
        if( !isPaginationCompleted ) {
            var eventData = {
                parentTaskId: parentTaskId,
                referenceTaskId: referenceTaskId
            };
            eventBus.publish( 'saw1ProgramView.paginate', eventData );
        }
    }

    /**
     * Returns the column config Id for program view
     * @returns {String} Column config Id for program view
     */
    getColumnConfigId() {
        return 'Saw1ProgramViewColumns';
    }


    getActualPropFromGanttProp( ganttPropName ) {
        var name = ganttPropName;
        var updatedColName = smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ name ];
        if( updatedColName ) {
            name = updatedColName;
        }
        return name;
    }

    cleanup() {
        dataSource.instance.cleanup();
        uiProgramViewEventHandler.unregisterEvents();
    }
}
