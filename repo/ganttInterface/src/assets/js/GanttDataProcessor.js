// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/* eslint-disable class-methods-use-this */

/**
 * @module js/GanttDataProcessor
 */

import dateTimeSvc from 'js/dateTimeService';
import dms from 'soa/dataManagementService';
import AwBaseService from 'js/awBaseService';
import _ from 'lodash';
import awColumnSvc from 'js/awColumnService';
import AwTimeoutService from 'js/awTimeoutService';
import appCtxSvc from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import cdm from 'soa/kernel/clientDataModel';
import ganttUtils from 'js/GanttUtils';
import eventBus from 'js/eventBus';
import tableSvc from 'js/splmTablePublishedService';

export default class GanttDataProcessor extends AwBaseService {
    getEventDateRanges() {
        //To be implemented by child class
    }

    getDateFormat() {
        //To be implemented by child class
    }

    getAllDateRanges() {
        //To be implemented by child class
    }

    getGanttColumnName( colName ) {
        //To be implemented by child class
    }

    getServerColumnName( colName ) {
        //To be implemented by child class
    }

    getReferenceTaskForPagination( visibleTasks ) {
        //To be implemented by child class
    }

    getUpdatedTaskArray( uidArray, propertiesToBeLoaded ) {
        //To be implemented by child class
    }

    getDataSource() {
        //To be implemented by child class
    }

    getSelectedTaskID() {
        //To be implemented by child class
    }

    getUpdatedTasks( tasks, ganttColumns ) {
        //To be implemented by child class
    }

    getColumnConfigId() {
        //To be implemented by child class
    }

    paginateForTaskOpened() {
        //To be implemented by child class
    }

    getSummaryTasksInList( visibleTasks, expandBelowParentNodeId ) {
        //To be implemented by child class
    }

    openGanttTask( taskUid ) {
        //To be implemented by child class
    }

    closeGanttTask( taskUid ) {
        //To be implemented by child class
    }

    getGanttHeight() {
        //To be implemented by child class
    }

    /**
     * Return the localized variables for Gantt
     * @param {Object} data ViewModel object
     * @returns {Object} Localized labels
     */
    getLocalizedLabels( data ) {
        var labels = {};
        labels.new_task = data.i18n.gantt_label_new_task;
        labels.icon_save = data.i18n.gantt_label_icon_save;
        labels.icon_cancel = data.i18n.gantt_label_icon_cancel;
        labels.icon_details = data.i18n.gantt_label_icon_details;
        labels.icon_edit = data.i18n.gantt_label_icon_edit;
        labels.icon_delete = data.i18n.gantt_label_icon_delete;
        labels.confirm_closing = '';
        labels.confirm_deleting = data.i18n.gantt_label_confirm_deleting;
        labels.section_description = data.i18n.gantt_label_section_description;
        labels.section_time = data.i18n.gantt_label_section_time;
        labels.section_type = data.i18n.gantt_label_section_type;
        labels.column_text = data.i18n.gantt_label_column_text;
        labels.tooltip_text = data.i18n.gantt_tooltip_label_text;
        labels.column_start_date = data.i18n.gantt_label_column_start_date;
        labels.tooltip_start_date = data.i18n.gantt_tooltip_start_date;
        labels.column_duration = data.i18n.gantt_label_column_duration;
        labels.column_add = '';
        labels.link = data.i18n.gantt_label_link;
        labels.link_start = data.i18n.gantt_label_link_start;
        labels.link_end = data.i18n.gantt_label_link_end;
        labels.type_task = data.i18n.gantt_label_type_task;
        labels.type_project = data.i18n.gantt_label_type_project;
        labels.type_milestone = data.i18n.gantt_label_type_milestone;
        labels.minutes = data.i18n.gantt_label_minutes;
        labels.hours = data.i18n.gantt_label_hours;
        labels.days = data.i18n.gantt_label_days;
        labels.weeks = data.i18n.gantt_label_weeks;
        labels.months = data.i18n.gantt_label_months;
        labels.years = data.i18n.gantt_label_years;
        labels.today = data.i18n.gantt_label_today;
        labels.column_finish_date = data.i18n.gantt_column_finish_date;
        labels.tooltip_finish_date = data.i18n.gantt_tooltip_finish_date;
        labels.deliverables = data.i18n.gantt_label_deliverables;
        labels.members = data.i18n.gantt_label_members;
        labels.date = data.i18n.gantt_label_date;
        labels.status = data.i18n.gantt_tooltip_status;
        labels.resource = data.i18n.gantt_tooltip_resource;
        return labels;
    }

    /**
     * Returns the config options for Gantt
     * @returns {Object} Config options for DHX Gantt
     */
    getConfigOptions( isShowGrid ) {
        var ganttConfig = {};
        ganttConfig.readOnly = true;
        ganttConfig.order_branch = false;
        ganttConfig.drag_move = false;
        ganttConfig.drag_resize = false;
        ganttConfig.drag_progress = false;
        ganttConfig.drag_links = false;
        ganttConfig.details_on_dblclick = false;
        ganttConfig.auto_scheduling = false;
        ganttConfig.auto_scheduling_initial = false;
        ganttConfig.auto_scheduling_strict = false;
        ganttConfig.round_dnd_dates = false;
        ganttConfig.startDate = '2015-08-22 08:00';
        ganttConfig.endDate = '2020-09-12 17:00';
        ganttConfig.xml_date = '%Y-%m-%d %H:%i';
        ganttConfig.grid_width = 550;
        ganttConfig.work_time = true;
        ganttConfig.correct_work_time = false;
        ganttConfig.grid_resize = true;
        ganttConfig.branch_loading = true;
        ganttConfig.smart_rendering = true;
        ganttConfig.static_background = true;
        ganttConfig.keyboard_navigation = true;
        ganttConfig.keyboard_navigation_cells = true;
        ganttConfig.show_grid = isShowGrid;
        // Set the row height based on the display mode, similar to splm table.
        let rowHeight = appCtxSvc.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
        ganttConfig.row_height = rowHeight + 1;
        ganttConfig.autoscroll_speed = 0;
        return ganttConfig;
    }

    /**
     * @param {String} date The date which has a deviation in its working hours.
     * @param {Array} range An array of ranges. A Range is a pair of start and end time of working hours. A day can have
     *            multiple ranges with breaks in-between in a working day.
     * @return {Object} The JavaScript object representation.
     */
    constructOddWorkingHours( date, range ) {
        var exception = {};
        var jsDate = new Date( date );
        exception.date = jsDate;
        exception.hours = range;
        return exception;
    }

    /**
     * @param {String} date The date which is a Holiday.
     * @return {Object} The JavaScript object representation.
     */
    constructHoliday( date ) {
        var holiday = {};
        var jsDate = new Date( date );
        holiday.date = jsDate;
        holiday.hours = false;
        return holiday;
    }

    /**
     * Set up the event dates and their respective ranges. The events are exceptions where the working hours are
     * different from the default working hours.
     * @return{Array} Java-script object array representing the exceptions.
     */
    initEventRanges() {
        var eventDateRanges = this.getEventDateRanges();
        var events = [];
        if( eventDateRanges !== null && typeof eventDateRanges !== typeof undefined ) {
            var eventDateKeys = Object.keys( eventDateRanges );
            for( var index = 0; index < eventDateKeys.length; index++ ) {
                var currentDate = eventDateKeys[ index ];
                var ranges = eventDateRanges[ currentDate ];
                var dateObj = new Date( currentDate );
                var date = dateTimeSvc.formatNonStandardDate( dateObj, this.getDateFormat() );
                if( !ranges ) {
                    //Holidays
                    var holiday = this.constructHoliday( date );
                    events.push( holiday );
                } else {
                    //Different work hours than regular.
                    var exception = this.constructOddWorkingHours( date, ranges );
                    events.push( exception );
                }
            }
        }
        return events;
    }

    /**
     * @param {Object} dayOfWeek The day of the week. Sunday to Saturday (0-6)
     * @param {Object} range An array of ranges. A Range is a pair of start and end time of working hours. A day can have
     *            multiple ranges with breaks in-between in a working day.
     * @return {Object} The JavaScript object representation.
     */
    constructDayWorkingHours( dayOfWeek, range ) {
        var workDay = {};
        workDay.day = range.day;
        workDay.hours = range.ranges;
        return workDay;
    }

    /**
     * Set up the days and their respective ranges.
     * @return {Array} Java-script array day ranges object representation.
     */
    initDayRanges() {
        var dateRanges = this.getAllDateRanges();
        var days = [];
        if( dateRanges && dateRanges.length > 0 ) {
            for( var i = 0; i < dateRanges.length; ++i ) {
                var ranges = dateRanges[ i ];
                days.push( this.constructDayWorkingHours( i, ranges ) );
            }
        }
        return days;
    }

    /**
     * Creates the columns required for Arrange panel and open the panel
     * @param {Array} configColumns List of columns for Arrange panel
     */
    arrangeColumns( configColumns ) {
        let columns = [];
        configColumns.forEach( ( col ) => {
            let arrangeCol = this.getAWColumnInfo( col );
            if( arrangeCol ) {
                columns.push( arrangeCol );
            }
        } );
        let columnConfigId = this.getColumnConfigId();
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
    }

    /**
     * Prepares the columns in format required by Gantt
     * @param {Array} columns The list of columns
     * @param {Object} data ViewModel object
     * @returns {Array} The list of columns in format required by Gantt
     */
    prepareColumnsForGantt( columns, data ) {
        var ganttColumns = [];
        data.ganttActualColumns = [];
        columns.forEach( function( col ) {
            var colName = col.field ? col.field : col.name;
            if( colName && colName !== 'icon' && !col.hiddenFlag ) {
                var updatedColName = this.getGanttColumnName( colName );
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
                data.ganttActualColumns.push( colName );
            }
        }, this );
        return ganttColumns;
    }

    /**
     * Returns the column information required for Arrange panel
     * @param {Object} col Column to display in Arrange panel
     * @returns {Object} column information for Arrange panel
     */
    getAWColumnInfo( col ) {
        return awColumnSvc.createColumnInfo( {
            name: col.propDescriptor.propertyName,
            propertyName: col.propDescriptor.propertyName,
            displayName: col.propDescriptor.displayName,
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
    }

    /**
     * Sets columns in data provider and returns the list of columns for Gantt.
     * @param {Object} colResponse The response from getOrResetUiConfig SOA
     * @param {Object} dataProvider The data provider for Gantt
     * @returns {Array} The list of columns for Gantt.
     */
    getAWColumnInfoList( colResponse, dataProvider ) {
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
        dataProvider.columnConfig = {
            columns: columnArrayVisible
        };
        return columnArray;
    }

    getVisibleTasks() {
        let visibleTasks = [];
        let childNodes = document.querySelector( '.gantt_grid_data' ).childNodes; //[0].attributes['data-task-id'].nodeValue;
        childNodes.forEach( ( child ) => {
            if( child && child.attributes[ 'data-task-id' ] ) {
                let uid = child.attributes[ 'data-task-id' ].nodeValue;
                if( uid ) {
                    let taskInfo = this.getDataSource().getTaskInfo( uid );
                    if( taskInfo ) {
                        visibleTasks.push( taskInfo );
                    }
                }
            }
        } );
        return visibleTasks;
    }

    /**
     * Returns the basic properties for Gantt to load
     * @returns {Array} The list of basic properties for Gantt to load
     */
    getBasicPropertiesToLoad() {
        return [ 'duration', 'complete_percent', 'work_estimate', 'work_complete', 'task_type' ];
    }

    /**
     * The function called after rendering data on Gantt
     * @param {Array} visibleTasks List of visible tasks in Gantt
     * @param {Array} ganttColumns The list of columns displayed in Gantt
     * @param {boolean} isDelayLoadProps The flag to indicate if delay loading of properties.
     * @param {Object} data ViewModel object
     * @param {Function} callbackFunction The callback function after execution of this function
     */
    afterRenderCallback( visibleTasks, ganttColumns, isDelayLoadProps, data, callbackFunction ) {
        if( visibleTasks && visibleTasks.length > 0 ) {
            if( isDelayLoadProps ) {
                var unprocessedTasks = _.filter( visibleTasks, [ 'isProcessed', false ] );
                if( unprocessedTasks.length > 0 ) {
                    var vmoArray = this.getNodeVMOs( unprocessedTasks );
                    var propertiesToBeLoaded = this.getBasicPropertiesToLoad();
                    ganttColumns.forEach( function( col ) {
                        let colName = col.name;
                        var updatedColName = this.getServerColumnName( colName );
                        if( updatedColName ) {
                            colName = updatedColName;
                        }
                        propertiesToBeLoaded.push( colName );
                    }, this );
                    /* if( !this.propertyPolicyID ) {
                        var types = {};
                        var typeList = [];
                        ganttColumns.forEach( function( col ) {
                            var colName = col.name;
                            var updatedColName = smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ colName ];
                            if( updatedColName ) {
                                colName = updatedColName;
                            }
                            var objectTypeNames = [ 'Schedule', 'ScheduleTask', 'ProgramView' ];
                            objectTypeNames.forEach( function( objTypeName ) {
                                var propertiesContainer = [];
                                var objectType = {};
                                objectType.name = objTypeName;
                                propertiesContainer.push( {
                                    name: colName
                                } );

                                objectType.properties = propertiesContainer;
                                typeList.push( objectType );
                            } );
                        } );
                        types.types = typeList;
                        this.propertyPolicyID = propPolicySvc.register( types );
                    } */
                    const self = this;
                    dms.getPropertiesUnchecked( vmoArray, propertiesToBeLoaded ).then( function() {
                        var uidArray = [];
                        vmoArray.forEach( function( task ) {
                            uidArray.push( task.uid );
                        } );
                        var ganttTaskArray = self.getUpdatedTaskArray( uidArray, propertiesToBeLoaded );
                        callbackFunction( ganttTaskArray );
                    } );
                }
                // propPolicySvc.unregister( this.propertyPolicyID );
            }
            var referenceTask = this.getReferenceTaskForPagination( visibleTasks );
            if( referenceTask ) {
                this.paginateForTaskOpened( referenceTask.parent, referenceTask.id );
            }
            if( !_.isEmpty( data.expandBelowParentNodeIds ) ) {
                var summaryTaskList = this.getSummaryTasksInList( visibleTasks, data.expandBelowParentNodeId );
                summaryTaskList.forEach( ( summaryTaskId ) => {
                    //AwTimeoutService is needed to run the events in the next tick/ digest cycle in AngularJS
                    AwTimeoutService.instance( () => {
                        this.getDataSource().setExpandBelowOnTask( this.getDataSource().getTaskInfo( summaryTaskId ), false );
                        this.openGanttTask( summaryTaskId );
                    } );
                } );
            }
        }
    }

    /**
     * Returns ViewModelObject arrays
     * @param {Array} nodes The objects in Gantt
     * @returns {Array} The list of viewModelObjects
     */
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

    /**
     * Updates the objects in Gantt
     * @param {*} objectsArray Updated objects
     * @param {*} ganttColumns Columns displayed in Gantt
     */
    updateGanttObjects( objectsArray, ganttColumns ) {
        let tasksArray = [];
        let linksArray = [];
        if( !_.isEmpty( objectsArray ) ) {
            objectsArray.forEach( ( object ) => {
                if( object ) {
                    let objType = this.getDataSource().getObjectType( object );
                    if( objType === 1 || objType === 3 ) { //Schedule task or Proxy Task
                        tasksArray.push( object );
                    } else if( objType === 2 ) { //Task Dependency
                        linksArray.push( object );
                    }
                }
            } );
        }
        if( !_.isEmpty( tasksArray ) ) {
            let ganttTasks = this.getDataSource().getUpdatedTasks( tasksArray, ganttColumns );
            ganttUtils.refreshGanttTasks( ganttTasks );
        }
        if( !_.isEmpty( linksArray ) ) {
            let ganttLinks = this.getDataSource().getUpdatedLinks( linksArray );
            ganttUtils.refreshGanttLinks( ganttLinks );
        }
    }

    /**
     * Creates new task on Gantt
     * @param {String} selectedTaskUID The uid of selected task
     * @param {String} prevSiblingUID The uid of the task previous to the newly created task
     * @param {Object} createdObject The newly created object
     * @param {Object} data ViewModel object
     * @returns {objType} The Gantt task object to be added in Gantt
     */
    createNewTask( selectedTaskUID, prevSiblingUID, createdObject, data ) {
        //Get the selected task on the gantt this will be our sibling of newly created task.
        var parentTask = null;
        let ganttTask;

        if( selectedTaskUID ) {
            let selectedTaskInfo = this.getDataSource().getTaskInfo( selectedTaskUID );

            if( selectedTaskInfo.taskType !== 6 ) {
                if( createdObject.props.fnd0ParentTask.dbValues[0] === selectedTaskInfo.parent ) {
                    parentTask = this.getDataSource().getTask( selectedTaskInfo.parent );
                } else {
                    parentTask = this.getDataSource().getTask( createdObject.props.fnd0ParentTask.dbValues[0] );
                    prevSiblingUID = null;
                }
            } else {
                parentTask = cdm.getObject( selectedTaskUID );
            }
        } else {
            var scheduleSummaryTaskProp = this.getDataSource().getSourceObject().props.fnd0SummaryTask.dbValues[ 0 ];
            parentTask = cdm.getObject( scheduleSummaryTaskProp );
        }

        // If all the pages are loaded, then simply add the last child
        // of the parent as the sibling.
        if( parentTask && ( selectedTaskUID || this.getDataSource().isPaginationCompletedForParent( parentTask.uid ) ) ) {
            let schTasksList = [];
            schTasksList.push( createdObject );
            let parentTasksList = [];
            parentTasksList.push( parentTask );
            let ganttTasks = this.getDataSource().constructGanttTasks( schTasksList, parentTasksList, data.ganttColumns );
            if( ganttTasks && !_.isEmpty( ganttTasks ) ) {
                ganttTask = ganttTasks[ 0 ];
                if( prevSiblingUID ) {
                    this.getDataSource().setTaskPreviousSibling( ganttTask, prevSiblingUID );
                }
            }
        }
        return ganttTask;
    }

    /**
     * Creates new objects on Gantt
     * @param {Arrayy} createdObjects The list of created objects
     * @param {Object} data ViewModel object
     */
    createObjectsOnGantt( createdObjects, data ) {
        let tasks = [];
        let proxiesToHide = [];
        let links = [];
        let selectedTaskInfo;
        let prevSiblingUID;
        let selectedTaskUID = this.getSelectedTaskID();

        if( selectedTaskUID ) {
            selectedTaskInfo = this.getDataSource().getTaskInfo( selectedTaskUID );
            prevSiblingUID = selectedTaskUID;
        }
        createdObjects.forEach( ( createdObject ) => {
            var type = this.getDataSource().getObjectType( createdObject );
            switch ( type ) {
                case 1: //Schedule Task
                {
                    let ganttTask = this.createNewTask( selectedTaskUID, prevSiblingUID, createdObject, data );
                    if( ganttTask ) {
                        tasks.push( ganttTask );
                    }
                    // In case of multiple tasks with one or more summary task storing the previous sibling of parent of the summary task
                    if( selectedTaskInfo && createdObject.props.fnd0ParentTask.dbValues[0] === selectedTaskInfo.parent ) {
                        prevSiblingUID = createdObject.uid;
                    }
                    break;
                }
                case 2: //Task Dependency
                {
                    let taskDep = this.getDataSource().addLinkInfo( createdObject );
                    if( links.length === 0 || !ganttUtils.isOtherSideLinkPresent( links, taskDep ) ) {
                        links.push( taskDep );
                    }
                    break;
                }
                case 3: //Proxy Task
                {
                    let ProxyTasks = [ createdObject ];
                    let refTask = createdObject.props.fnd0ref;
                    if( refTask ) {
                        selectedTaskUID = refTask.dbValues[0];
                    }
                    let selectedTaskInfo = this.getDataSource().getTaskInfo( selectedTaskUID );
                    let parentUid = selectedTaskUID && selectedTaskInfo && selectedTaskInfo.parent ? selectedTaskInfo.parent : this.getDataSource().getSourceScheduleSummary().uid;
                    let essentialColumns = this.getDataSource().getEssentialColumns();
                    let proxyTaskInfoList = this.getDataSource().createProxyTasks( ProxyTasks, parentUid, essentialColumns );
                    let ganttDisplayedCols = this.getDataSource().getDisplayedColumns( data.ganttColumns );
                    this.getDataSource().updateTaskSupportingProperties( proxyTaskInfoList, ganttDisplayedCols );
                    if( proxyTaskInfoList.length > 0 ) {
                        if( !selectedTaskInfo.proxies ) {
                            selectedTaskInfo.proxies = [];
                        }
                        selectedTaskInfo.proxies.push( proxyTaskInfoList[0] );
                        let prevSibling;
                        if( selectedTaskInfo.proxies.length > 1 ) {
                            prevSibling = selectedTaskInfo.proxies[ selectedTaskInfo.proxies.length - 2 ];
                        } else if( selectedTaskInfo.taskType !== 6 ) {
                            prevSibling = selectedTaskInfo;
                        }
                        if( prevSibling ) {
                            this.getDataSource().setTaskPreviousSibling( proxyTaskInfoList[0], prevSibling.id );
                        }
                        tasks.push( proxyTaskInfoList[ 0 ] );
                    }
                    break;
                }
                default:
                    break;
            }
        } );
        if( tasks.length > 0 || links.length > 0 ) {
            ganttUtils.updateCreatedObjectsOnGantt( tasks, links );
            //exports.checkForCriticalPath();
            // To Do- Have to fire an event that will call the SOA for Critical Task
        }
        if( proxiesToHide.length > 0 ) {
            // removeDeletedObjectsOnGantt( proxiesToHide );
        }
    }

    /**
     * Selects the object in Gantt
     * @param {String} uid The uid of task to be selected in Gantt
     */
    selectNode( uid ) {
        this.getDataSource().selectTask( uid );
    }
    /**
     * Deselects the object in Gantt
     * @param {String} uid The uid of task to be deselected in Gantt
     */
    deselectNode( uid ) {
        this.getDataSource().deselectTask( uid );
    }

    /**
     * Selects multiple bjects in Gantt
     * @param {String} tasksList The list of task to be selected in Gantt
     */
    multiSelectNode( tasksList ) {
        this.getDataSource().multiSelectTask( tasksList );
    }

    /**
     * Expand the selected parent task recursively
     * @param {String} parentTaskId The Uid of parent task
     */
    expandNodeRecursive( parentTaskId ) {
        let parentTask = this.getDataSource().getTaskInfo( parentTaskId );
        if( parentTask ) {
            this.getDataSource().setExpandBelowOnTask( parentTask, false );
            this.openGanttTask( parentTaskId );
            let childSummaryTaskList = parentTask.childSummaryTaskList;
            if( childSummaryTaskList ) {
                childSummaryTaskList.forEach( ( child ) => {
                    //AwTimeoutService is needed to run the events in the next tick/ digest cycle in AngularJS
                    AwTimeoutService.instance( () => {
                        this.expandNodeRecursive( child );
                    } );
                } );
            }
        }
    }

    /**
     * Sets the flag of expand below on the given parent node.
     * @param {Object} data ViewModel object
     * @param {String} parentTaskId The uid of parentTask
     */
    setExpandBelowFlag( data, parentTaskId ) {
        if( !data.expandBelowParentNodeIds ) {
            data.expandBelowParentNodeIds = [];
        }
        data.expandBelowParentNodeIds.push( parentTaskId );
        this.expandNodeRecursive( parentTaskId );
    }

    /**
     * Collapses all the nodes below the selected node including the selected node.
     * @param {Object} data ViewModel object
     * @param {String} nodeId The Uid of task to collapse below
     */
    collapseBelowNode( data, nodeId ) {
        let expandBelowIds = data.expandBelowParentNodeIds;
        let index = expandBelowIds ? expandBelowIds.indexOf( nodeId ) : -1;
        if( index >= 0 ) {
            expandBelowIds.splice( index, 1 );
        }
        let childTaskIds = this.getDataSource().getGanttChildTasks( nodeId );
        if( !_.isEmpty( childTaskIds ) ) {
            childTaskIds.forEach( ( taskId ) => {
                let taskInfo = this.getDataSource().getTaskInfo( taskId );
                if( taskInfo && this.getDataSource().isSummaryTask( taskInfo.taskType ) ) {
                    this.closeGanttTask( taskId );
                    this.collapseBelowNode( data, taskId );
                }
            } );
            this.closeGanttTask( nodeId );
        }
    }

    registerEventListeners( declViewModel ) {
        let awEvents = [];

        awEvents.push( eventBus.subscribe( 'cdm.updated',  ( eventData ) => {
            this.updateGanttObjects( eventData.updatedObjects, declViewModel.ganttActualColumns );
        }, this ) );

        return awEvents;
    }

    /**
     * Returns the plugins required for Gantt widget
     * @returns Plugins for Gantt widget
     */
    getGanttPlugins() {
        return {
            critical_path: true,
            tooltip: true,
            marker: true
        };
    }
}
