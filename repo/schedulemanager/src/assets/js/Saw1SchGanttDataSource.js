// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/Saw1SchGanttDataSource
 */
import GanttDataSource from 'js/GanttDataSource';
import cdm from 'soa/kernel/clientDataModel';
import smConstants from 'js/ScheduleManagerConstants';
import appCtxSvc from 'js/appCtxService';
import schGanttUtils from 'js/SchGanttUtils';
import ganttDepUtils from 'js/Saw1GanttDependencyUtils';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import viewModelService from 'js/viewModelService';
import tableSvc from 'js/splmTablePublishedService';

export default class Saw1SchGanttDataSource extends GanttDataSource {
    constructor() {
        super();
        let smGanttCtx = appCtxSvc.getCtx( 'smGanttCtx' );
        this._sourceObject = smGanttCtx && smGanttCtx.sourceScheduleUid ? cdm.getObject( smGanttCtx.sourceScheduleUid ) : appCtxSvc.ctx.selected;
        this.startDateStr = '';
        this.finishDateStr = '';
        this._uid2BaselineDatesMap = {};
        this._baselineInfo = {};
        this._taskUidToIndexMap = {};
        this._taskIndexToUidMap = {};
        this._taskUidToPredDependencyMap = {};
        this._taskUidToSuccDependencyMap = {};

        let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
        if( scheduleNavigationCtx && scheduleNavigationCtx.baselines ) {
            this._baselineInfo.baselines = scheduleNavigationCtx.baselines;
        }
    }

    /**
     * This function will return the source Object.
     *
     * @return {Object} _sourceObject - The Source Object.
     */
    getSourceObject() {
        return this._sourceObject;
    }

    /**
     * Returns the summary task of the source schedule.
     *
     * @return {Object} sourceScheduleSummary - The Source schedule summary task.
     */
    getSourceScheduleSummary() {
        return cdm.getObject( this._sourceObject.props.fnd0SummaryTask.dbValues[ 0 ] );
    }

    getReferenceTask( eventData ) {
        if( eventData && eventData.referenceTaskId !== undefined ) {
            return cdm.getObject( eventData.referenceTaskId );
        }
        return null;
    }

    // Overrride this method, as it gets invoked on deletion of a task.
    deselectTask( uid ) {
        // No-op
    }

    multiSelectTask( tasksList ) {
        let smGanttCtx = appCtxSvc.getCtx( 'smGanttCtx' );
        if( !smGanttCtx ) {
            smGanttCtx = {};
        }

        let taskUID = tasksList[0];
        let taskInfo = this.getTaskInfo( taskUID );
        let taskObj = cdm.getObject( taskUID );
        let schedUid = '';

        if( taskInfo && taskInfo.isProxyTask ) {
            let refTaskUid = taskObj.props.fnd0ref.dbValues[0];
            taskObj = cdm.getObject( refTaskUid );
            schedUid = taskObj.props.schedule_tag.dbValues[0];
        } else if( taskInfo ) {
            schedUid = taskObj.props.schedule_tag.dbValues[0];
        } else {
            if( appCtxSvc.ctx.pselected ) {
                schedUid = appCtxSvc.ctx.pselected.uid;
            } else if( appCtxSvc.ctx.mselected ) {
                schedUid = appCtxSvc.ctx.mselected[0].uid;
            }
        }

        let schedObj = cdm.getObject( schedUid );
        if( !smGanttCtx.selectedTaskSchedule || schedObj && smGanttCtx.selectedTaskSchedule.uid !== schedObj.uid ) {
            smGanttCtx.selectedTaskSchedule = schedObj;
            appCtxSvc.updateCtx( 'smGanttCtx', smGanttCtx );
        }
        if(  taskObj && cmm.isInstanceOf( 'Prg0AbsEvent', taskObj.modelType ) ) {
            let eventlist = [];
            tasksList.forEach( ( taskUid ) => {
                let eventObj = cdm.getObject( taskUid );
                if( eventObj && cmm.isInstanceOf( 'Prg0AbsEvent', eventObj.modelType ) ) {
                    eventlist.push( eventObj );
                }
            } );
            smGanttCtx.isEventActive = true;
            appCtxSvc.updateCtx( 'smGanttCtx', smGanttCtx );
            eventBus.publish( 'gantt.updateSWAForEvent', eventlist );
        } else {
            // If in schedule navigation sublocation, only publish a selection event.
            if( schNavTreeUtils.isScheduleNavigationSublocation() ) {
                let eventData = {
                    selectedTaskUids: tasksList
                };
                eventBus.publish( 'ganttTasksSelected', eventData );
            } else {
                super.multiSelectTask( tasksList );
            }
        }
    }

    getParentTasks( eventData ) {
        let parentTasks = [];
        if( eventData && eventData.parentTaskId ) {
            let parentTask = cdm.getObject( eventData.parentTaskId );
            parentTasks.push( parentTask );
        } else {
            parentTasks.push( this.getSourceScheduleSummary() );
        }
        return parentTasks;
    }

    parseLoadScheduleSOAResponse( response, data ) {
        let eventRanges = response.calendarInfo.eventRanges;
        let dayRanges = response.calendarInfo.dayRanges;
        this.setEventRanges( eventRanges );
        this.setDayRanges( Object.values( dayRanges ) );

        let ganttInfoArray = this.constructGanttTasks( [ this.getSourceScheduleSummary() ], [] );

        return {
            data: ganttInfoArray,
            links: this._linkInfos
        };
    }

    addToTaskIndexMap( taskUid, taskIndex ) {
        this._taskUidToIndexMap[ taskUid ] = taskIndex;
        this._taskIndexToUidMap[ taskIndex ] = taskUid;
    }

    getTaskIndex( taskUid ) {
        return this._taskUidToIndexMap[ taskUid ];
    }

    getTaskByIndex( taskIndex ) {
        return this._taskIndexToUidMap[ taskIndex ];
    }

    addToTaskPredDependencyMap( taskUid, dependencyUids, displayValues ) {
        var predDependency = {
            dependencyUids:dependencyUids,
            displayValues:displayValues
        };
        this._taskUidToPredDependencyMap[ taskUid ] = predDependency;
    }

    getTaskPredDependencies( taskUid ) {
        return this._taskUidToPredDependencyMap[ taskUid ];
    }

    addToTaskSuccDependencyMap( taskUid, dependencyUids, displayValues ) {
        var succDependency = {
            dependencyUids:dependencyUids,
            displayValues:displayValues
        };
        this._taskUidToSuccDependencyMap[ taskUid ] = succDependency;
    }

    getTaskSuccDependencies( taskUid ) {
        return this._taskUidToSuccDependencyMap[ taskUid ];
    }

    clearDependencyMaps() {
        this._taskUidToPredDependencyMap = {};
        this._taskUidToSuccDependencyMap = {};
    }

    constructGanttTasks( schTasksList, parentTasksList, displayedCols ) {
        let ganttInfoArray = [];
        if( !_.isEmpty( schTasksList ) ) {
            let essentialColumns = this.getEssentialColumns();
            ganttInfoArray = this.constructTaskAndSetProps( schTasksList, essentialColumns, parentTasksList );
            let ganttDisplayedCols = this.getDisplayedColumns( displayedCols );
            this.updateTaskSupportingProperties( ganttInfoArray, ganttDisplayedCols );
        }
        return ganttInfoArray;
    }

    getDisplayedColumns( columns ) {
        let displayedColumns = [];
        if( columns ) {
            columns.forEach( ( col ) => {
                displayedColumns.push( col.name );
            } );
        }
        return displayedColumns;
    }

    updateTaskSupportingProperties( ganttTaskInfoList, propertiesArray ) {
        let ganttTaskArray = [];
        ganttTaskInfoList.forEach( function( ganttTaskInfo ) {
            let ganttTask = this._uid2TaskInfoMap[ ganttTaskInfo.id ];
            let taskUid = ganttTaskInfo.id;
            if( ganttTaskInfo.isProxyTask ) {
                taskUid = ganttTaskInfo.homeTaskUid;
            }
            let taskObject = cdm.getObject( taskUid );
            if( taskObject && ganttTask ) {
                this.updateSupportingPropsOnTask( taskObject, propertiesArray, ganttTask );
                ganttTask.isProcessed = true;
                ganttTaskArray.push( ganttTask );
            }
        }, this );
        return ganttTaskArray;
    }

    updateSupportingPropsOnTask( taskObject, propertiesArray, ganttTask ) {
        this.updateTaskProperties( taskObject, propertiesArray, ganttTask );
        let completePercent = taskObject.props.complete_percent.dbValues[ 0 ];
        let workCompleteFloat = 0;
        if( !isNaN( completePercent ) ) {
            if( parseFloat( completePercent ) === 100 ) {
                workCompleteFloat = 1;
            } else {
                let workCompleteValue = ganttTask.work_complete;
                let workEstimate = ganttTask.work_estimate;
                if( workEstimate > 0 ) {
                    workCompleteFloat = workCompleteValue / workEstimate;
                }
            }
        }
        ganttTask.progress = workCompleteFloat;
        let taskType = ganttTask.task_type;
        if( ganttTask.isProxyTask ) {
            taskType = 5;
        }
        if( !isNaN( taskType ) ) {
            let intType = parseInt( taskType );
            if( intType === 6 ) {
                ganttTask.type = 'task';
            } else {
                ganttTask.type = this.getTaskObjectType( intType );
            }
            ganttTask.taskType = intType;
        }
        ganttTask.taskStatusInternal = taskObject.props.fnd0status.dbValues[ 0 ];
        let isSummaryTask = this.isSummaryTask( ganttTask.taskType );
        if( isSummaryTask ) {
            let parentUid = ganttTask.parent;
            let parentTaskInfo = this.getTaskInfo( parentUid );
            if( parentTaskInfo ) {
                let childSummaryTaskList = parentTaskInfo.childSummaryTaskList;
                if( !childSummaryTaskList ) {
                    childSummaryTaskList = [];
                }
                if( childSummaryTaskList.indexOf( ganttTask.id ) < 0 ) {
                    childSummaryTaskList.push( ganttTask.id );
                }
                parentTaskInfo.childSummaryTaskList = childSummaryTaskList;
            }
        }
        ganttTask.$has_child = isSummaryTask && appCtxSvc.ctx.state.params.filter === null;
        if( ganttTask.id === this.getSourceScheduleSummary().uid ) {
            ganttTask.$open = true;
        }
        let whatIfMode = -1;
        let whatIfDataValues = [];
        if( !isNaN( whatIfMode ) &&
            ganttTask.fnd0WhatIfData ) {
            let whatIfModeProp = ganttTask.fnd0WhatIfMode;
            whatIfMode = parseInt( whatIfModeProp );
            whatIfDataValues = ganttTask.fnd0WhatIfData;
        }
        ganttTask.whatIfMode = whatIfMode;
        ganttTask.hasWhatIfData = whatIfDataValues.length > 0;
    }

    setFlagForExpand( ganttTaskList, taskIdsToExpand ) {
        let isSummaryOfExpandParent = false;
        if( ganttTaskList && ganttTaskList.length > 0 ) {
            let ganttTask = ganttTaskList[ 0 ];
            let task = ganttTask;
            while( task && task.parent ) {
                if( taskIdsToExpand.indexOf( task.parent ) >= 0 ) {
                    isSummaryOfExpandParent = true;
                    break;
                }
                task = this.getTaskInfo( task.parent );
            }
        }
        if( isSummaryOfExpandParent ) {
            ganttTaskList.forEach( ( ganttTask ) => {
                if( ganttTask && this.isSummaryTask( ganttTask.taskType ) ) {
                    this.setExpandBelowOnTask( ganttTask, true );
                }
            } );
        }
    }

    getEssentialColumns() {
        return smConstants.SCH_GANTT_ESSENTIAL_COLUMNS;
    }

    setParentTask( ganttTasks, parentTasks ) {
        for( let index = 0; index < ganttTasks.length; index++ ) {
            let ganttTask = ganttTasks[ index ];
            if( ganttTask && parentTasks[ index ] && this.getTaskInfo( parentTasks[ index ].uid ) ) {
                ganttTask.parent = parentTasks[ index ].uid;
            }
        }
    }

    setReferenceTaskForPagination( hasMoreTasks, parentTask, lastTask ) {
        if( hasMoreTasks ) {
            this.setRefTaskForPaginationFlag( lastTask, true );
            this.setRefTaskForPagination( parentTask, lastTask.id );
        } else if( parentTask ) {
            this.setPaginationCompletedForParent( parentTask, true );
            this.setRefTaskForPagination( parentTask, '' );
        }
        parentTask.$open = true;
    }

    resetReferenceTaskForParent( parentTask ) {
        let refTaskUid = this.getRefTaskForPagination( parentTask );
        if( parentTask && refTaskUid ) {
            var referenceTask = this.getTaskInfo( refTaskUid );
            if( referenceTask ) {
                this.setRefTaskForPaginationFlag( referenceTask, false );
                this.setRefTaskForPagination( parentTask, '' );
            }
        }
    }

    processDependencies( taskDependencies ) {
        let taskDependenciesObjects = [];
        if( typeof taskDependencies !== typeof undefined ) {
            taskDependencies.forEach( function( currentTaskDependency ) {
                let taskDependenciesObject = [];
                taskDependenciesObject = cdm.getObject( currentTaskDependency.taskDependency.uid );
                taskDependenciesObject.props.primary_object.dbValues[ 0 ] = currentTaskDependency.properties.primary_object;
                taskDependenciesObject.props.secondary_object.dbValues[ 0 ] = currentTaskDependency.properties.secondary_object;
                taskDependenciesObjects.push( taskDependenciesObject );
            } );
        }

        this.addDependencies( taskDependenciesObjects );
    }

    addDependencies( taskDependencies ) {
        if( taskDependencies !== null && taskDependencies.length > 0 ) {
            taskDependencies.forEach( function( taskDependency ) {
                //Process the dependency
                this.addLinkInfo( taskDependency );
            }, this );
        }
    }

    isSummaryTask( taskType ) {
        return taskType === 2 || taskType === 6;
    }

    getTaskObjectType( taskType ) {
        let taskObjectType;

        switch ( taskType ) {
            case 0: //Standard type
                taskObjectType = 'standard';
                break;
            case 1: //Milestone type
                taskObjectType = 'milestone';
                break;
            case 2: //Summary task type
                taskObjectType = 'summary';
                break;
            case 3: //Phase task type
                taskObjectType = 'phase';
                break;
            case 4: //Gate Task type
                taskObjectType = 'gate';
                break;
            case 5: //Link Task Type
                taskObjectType = 'link';
                break;
            case 6: //Schedule summary task type
                taskObjectType = 'scheduleSummary';
                break;

            default: //invalid type
                taskObjectType = 'invalid';
        }
        return taskObjectType;
    }

    getUpdatedTasks( tasksArray, ganttColumns ) {
        let ganttTasks = super.getUpdatedTasks( tasksArray, ganttColumns );
        this.updateTaskSupportingProperties( ganttTasks, ganttColumns );
        this.updateGanttParent( tasksArray );
        return ganttTasks;
    }

    getParentTaskProp( task ) {
        let parentUid = '';
        if( task && task.props.fnd0ParentTask ) {
            parentUid = task.props.fnd0ParentTask.dbValues[0];
        }
        return parentUid;
    }

    /**
     * Add the baseline task dates to uid2BaselineDatesMap.
     *
     * @param {string} taskUid_baselineUid - The uid of the original schedule task and baseline
     * @param {Date} baselineTaskStartDate - The baseline task start date
     * @param {Date} baselineTaskEndDate - The baseline task end date
     */
    addBaselineTaskDates( taskUid_baselineUid, baselineTaskStartDate, baselineTaskEndDate ) {
        if( baselineTaskStartDate && baselineTaskEndDate ) {
            let baselineTaskDates = {
                startDate: baselineTaskStartDate,
                endDate: baselineTaskEndDate
            };
            this._uid2BaselineDatesMap[ taskUid_baselineUid ] = baselineTaskDates;
        }
    }

    parseCriticalPathResponse( response ) {
        if( response.tasks && Array.isArray( response.tasks ) ) {
            response.tasks.forEach( ( task ) => {
                this.criticalTasksUids.push( task.uid );
            } );
        }
        this.isCriticalPathOn = true;
        schGanttUtils.refreshGanttData();
    }

    clearCriticalTasks() {
        this.isCriticalPathOn = false;
        this.criticalTasksUids = [];
        schGanttUtils.refreshGanttData();
    }

    getObjectType( modelObject ) {
        return schGanttUtils.getObjectType( modelObject );
    }

    getDateFormat() {
        return smConstants.PROGRAM_VIEW_DATE_FORMAT;
    }

    getGanttColumnName( colName ) {
        return smConstants.SCHEDULE_GANTT_SERVER_PROPERTY_MAPPING[ colName ];
    }

    getServerColumnName( colName ) {
        return smConstants.SCHEDULE_SERVER_GANTT_PROPERTY_MAPPING[ colName ];
    }

    /**
     * Checks whether internal value (dbValue) has to be read for a property
     * @param {String} propName The Property name
     * @returns {Boolean} The flag to indicate whether internal value has to be read
     */
    isFetchInternalValue( propName ) {
        return smConstants.SCH_GANTT_PROPS_FOR_INTERNAL_VAL && smConstants.SCH_GANTT_PROPS_FOR_INTERNAL_VAL.indexOf( propName ) >= 0;
    }

    isCriticalTask( taskUid ) {
        return this.criticalTasksUids.indexOf( taskUid ) >= 0;
    }

    isLinkCritical( linkUid ) {
        let answer = false;
        if( this.isCriticalPathOn && this.criticalTasksUids !== null && this.criticalTasksUids.length > 0 ) {
            let dependency = this._uid2DependencyMap[ linkUid ];
            if( dependency !== null && typeof dependency !== typeof undefined ) {
                let successorProp = dependency.props.primary_object.dbValues[ 0 ];
                let predecessorProp = dependency.props.secondary_object.dbValues[ 0 ];
                if( this.criticalTasksUids.indexOf( predecessorProp ) >= 0 && this.criticalTasksUids.indexOf( successorProp ) >= 0 ) {
                    //If predecessor /successor is a critical task then mark dependency as critical.
                    answer = true;
                }
            }
        }
        return answer;
    }

    getBaselineTaskDates( taskUid_baselineUid ) {
        return this._uid2BaselineDatesMap[ taskUid_baselineUid ];
    }

    isFinishDateSchedule( task ) {
        return schGanttUtils.isFinishDateScheduleForTask( task );
    }

    /**
     * This function will return the Start Date.
     * @return {Date} startDateStr - Start Date string.
     */
    getStartDateString() {
        if( !this.startDateStr && this._sourceObject ) {
            let startDateProp = this._sourceObject.props.start_date.dbValues[ 0 ];
            let startDateObj = new Date( startDateProp );
            this.startDateStr = super.getDateString( startDateObj );
        }
        return this.startDateStr;
    }

    /**
     * This function will return the End Date.
     * @return {Date} finishDateStr - Finish Date string.
     */
    getEndDateString() {
        if( !this.finishDateStr && this._sourceObject ) {
            let finishDateProp = this._sourceObject.props.finish_date.dbValues[ 0 ];
            let finishDateObj = new Date( finishDateProp );
            this.finishDateStr = super.getDateString( finishDateObj );
        }
        return this.finishDateStr;
    }

    /**
     * Returns the list of children loaded in Gantt.
     * @param {String} nodeId The UID of the parent task
     * @returns {Array} The list of child tasks
     */
    getGanttChildTasks( nodeId ) {
        return schGanttUtils.getGanttChildTasks( nodeId );
    }

    hasBaseline() {
        return !_.isEmpty( this._baselineInfo.baselines );
    }

    getBaselines() {
        return this._baselineInfo.baselines;
    }

    setBaselines( baselines ) {
        //clear the existing Baseline dates
        this._uid2BaselineDatesMap = {};
        this._baselineInfo.baselines = baselines;
        schGanttUtils.resetGanttConfigForBaseline();
        if( _.isEmpty( baselines ) ) {
            schGanttUtils.renderGanttData();
        }
    }
    updateRowHeightInCompact( gridOptions, rowHeight ) {
        gridOptions.rowHeight = 'LARGE';
        //set splmTable
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
        //set gantt row
        schGanttUtils.setGanttRowHeight( rowHeight + 32 );
    }

    updateRowHeightInComfy( gridOptions, rowHeight ) {
        gridOptions.rowHeight = 'LARGE';
        //set splmTable
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
        //set gantt row
        schGanttUtils.setGanttRowHeight( rowHeight + 24 );
    }

    resetGanttRowHeight( gridOptions, rowHeight ) {
        gridOptions.rowHeight = rowHeight;
        //set splmTable
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
        //set gantt row
        schGanttUtils.setGanttRowHeight( rowHeight );
    }

    updateRowHeight() {
        //update row height
        let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );

        if( viewModel ) {
            let gridOptions = viewModel.grids.scheduleNavigationTree.gridOptions;
            let rowHeight = appCtxSvc.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
            this._baselineInfo.baselines.length > 1 ?  gridOptions && appCtxSvc.ctx.layout === 'comfy' ? this.updateRowHeightInComfy( gridOptions,  rowHeight ) : this.updateRowHeightInCompact( gridOptions, rowHeight )  :  gridOptions.rowHeight ? this.resetGanttRowHeight( gridOptions, rowHeight ) : 'null';
            // this._baselineInfo.baselines.length > 1 ? this.updateRowHeightInComfy( gridOptions, rowHeight ) : gridOptions.rowHeight ? this.resetGanttRowHeight( gridOptions, rowHeight ) : 'null';
        }
    }

    renderBaselineTasks( loadBaselineResponse ) {
        if( loadBaselineResponse.baselineTasksInfo ) {
            for( let key in loadBaselineResponse.baselineTasksInfo ) {
                let baselineInfo = loadBaselineResponse.baselineTasksInfo[key];
                this.addBaselineTaskDates( key, new Date( baselineInfo.properties.startDate ), new Date( baselineInfo.properties.finishDate ) );
            }
            // register task layers
            let eventData = {
                baselines: this._baselineInfo.baselines
            };
            eventBus.publish( 'schGanttDataSource.addTaskLayers', eventData );

            // before rendering to the gantt need to adjust height of row splm table and gantt
            this.updateRowHeight();
            schGanttUtils.renderGanttData();
        }
    }

    renderBaselineTasksTCSOA( loadBaselineResponse ) {
        if( loadBaselineResponse.baselineTasksInfo ) {
            for( let origTaskUid in loadBaselineResponse.baselineTasksInfo ) {
                let baselinesInfo = loadBaselineResponse.baselineTasksInfo[ origTaskUid ];
                baselinesInfo.forEach( baselineInfo => {
                    let key = origTaskUid + '_' + baselineInfo.properties.schedule_tag;

                    this.addBaselineTaskDates( key, new Date( baselineInfo.properties.startDate ), new Date( baselineInfo.properties.finishDate ) );
                } );
            }
            // register task layers
            let eventData = {
                baselines: this._baselineInfo.baselines
            };
            eventBus.publish( 'schGanttDataSource.addTaskLayers', eventData );

            // before rendering to the gantt need to adjust height of row splm table and gantt
            this.updateRowHeight();
            schGanttUtils.renderGanttData();
        }
    }

    getUpdatedLinks( dependencyArray ) {
        let ret = super.getUpdatedLinks( dependencyArray );
        dependencyArray.forEach( dep => {
            ganttDepUtils.updateTaskSuccDependency( dep );
            ganttDepUtils.updateTaskPredDependency( dep );
        } );
        schGanttUtils.refreshGanttData();
        return ret;
    }

    getFilterStartIndex() {
        if( appCtxSvc.ctx.smGanttCtx.searchStartIndex === 0 ) {
            return 0;
        }
        return this.getTaskInfoArray().length;
    }

    cleanup() {
        super.cleanup();
        this._uid2BaselineDatesMap = {};
        this._baselineInfo = {};
        this._taskUidToIndexMap = {};
        this._taskIndexToUidMap = {};
        this._taskUidToPredDependencyMap = {};
        this._taskUidToSuccDependencyMap = {};
    }
}
