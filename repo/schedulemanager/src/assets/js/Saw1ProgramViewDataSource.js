// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/Saw1ProgramViewDataSource
 */
import cdm from 'soa/kernel/clientDataModel';
import smConstants from 'js/ScheduleManagerConstants';
import appCtxSvc from 'js/appCtxService';
import prgAddFilter from 'js/Saw1ProgramAddFilterService';
import GanttDataSource from 'js/GanttDataSource';
import ganttUtils from 'js/GanttUtils';

export default class Saw1ProgramViewDataSource extends GanttDataSource {
    constructor() {
        super();
        this._parentTaskUid = '';
        this._referenceTaskUid = '';
        this._sourceTaskUid = null;
    }

    parseManagePrgViewSOAResponse( response, ctx, data, operationType ) {
        var programViewNodes = response.programViewNodes;
        var newTasks = [];

        //Do it only for first SOA call, no need to do it for pagination calls
        if( this._taskInfoArray.length === 0 ) {
            var configuration = {
                operationType: operationType ? operationType : smConstants.MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD,
                configFromSOA: response.configuration
            };
            // Commenting for now , will be testing again once Program View gets integrated.
            /*if( configuration.configFromSOA ) {
               configuration.configFromSOA.columns = data.ganttColumns;
            }*/
            //add the program view node
            var prgViewNode = this.createProgramViewNode( ctx, data );
            newTasks.push( prgViewNode );

            appCtxSvc.registerCtx( 'programViewConfiguration', configuration );
            prgAddFilter.getPropertyPreferenceForFilters( ctx, data );
            var eventRanges = response.eventRanges;
            var dayRanges = response.dayRanges;
            this.setEventRanges( eventRanges );
            this.setDayRanges( dayRanges );
        }
        if( programViewNodes ) {
            programViewNodes.forEach( function( node ) {
                var columns = [];
                if( data && data.ganttActualColumns ) {
                    columns = data.ganttActualColumns;
                }
                var ganttTaskInfo = this.getTaskInfoFromNode( node, columns, this._parentTaskUid );
                this.addTaskInfoToArray( ganttTaskInfo );
                newTasks.push( ganttTaskInfo );
            }, this );
        }
        this.resetReferenceTask();
        this.setReferenceTaskForPagination( response, this._taskInfoArray );
        return {
            data: newTasks
        };
    }
    getOperationType( ctx ) {
        var operationType = smConstants.MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD;
        if( ctx.programViewConfiguration && ctx.programViewConfiguration.operationType ) {
            operationType = ctx.programViewConfiguration.operationType;
        }
        return operationType;
    }

    getProgramViewObject( ctx ) {
        return this._sourceTaskUid && this._uid2TaskMap[ this._sourceTaskUid ] ? this._uid2TaskMap[ this._sourceTaskUid ] : ctx.selected;
    }
    getProgramViewConfig( ctx ) {
        var config = {};
        if( ctx.programViewConfiguration && ctx.programViewConfiguration.configFromSOA ) {
            config = ctx.programViewConfiguration.configFromSOA;
        }
        return config;
    }

    getReferenceTaskUid( data ) {
        var referenceTask;
        if( data && data.referenceTaskId ) {
            referenceTask = data.referenceTaskId;
            this._referenceTaskUid = referenceTask;
        }
        return referenceTask;
    }

    getParentTaskUid( data, ctx ) {
        var parentTask;
        if( data && data.parentTaskId ) {
            parentTask = data.parentTaskId;
        } else if( this._sourceTaskUid ) {
            parentTask = this._sourceTaskUid;
        } else {
            parentTask = ctx.selected.uid;
        }
        this._parentTaskUid = parentTask;
        return parentTask;
    }

    createProgramViewNode( ctx, data ) {
        var uid = ctx.xrtSummaryContextObject.uid;
        var node = {
            isTcObject: true,
            nodeProperties: [ {
                name: 'uid',
                stringValue: uid
            },
            {
                name: 'start_date',
                stringValue: ''
            },
            {
                name: 'finish_date',
                stringValue: ''
            },
            {
                name: 'nodeType',
                stringValue: 'ProgramView'
            }
            ]
        };
        var ganttTaskInfo = this.getTaskInfoFromNode( node, data.ganttActualColumns, this._parentTaskUid );
        ganttTaskInfo.$open = true;
        this.addTaskInfoToArray( ganttTaskInfo );
        this._sourceTaskUid = uid;
        return ganttTaskInfo;
    }

    resetReferenceTask() {
        if( this._referenceTaskUid ) {
            var referenceTask = this._uid2TaskInfoMap[ this._referenceTaskUid ];
            if( referenceTask ) {
                referenceTask.isReferenceTask = false;
            }
        }
    }

    setReferenceTaskForPagination( response, tasksArray ) {
        var hasMoreTasks = false;
        var options = response.options;
        if( options && options.length > 0 ) {
            options.forEach( function( option ) {
                if( option ) {
                    var name = option.name;
                    if( name && name.toLowerCase() === 'hasmoretasks' ) {
                        var value = option.stringValue;
                        if( value && 'true' === value.toLowerCase() ) {
                            hasMoreTasks = true;
                            return;
                        }
                    }
                }
            } );
        }
        if( hasMoreTasks ) {
            tasksArray[ tasksArray.length - 1 ].isReferenceTask = true;
        } else {
            var parentTask = this._uid2TaskInfoMap[ this._parentTaskUid ];
            if( parentTask ) {
                parentTask.areAllChildrenLoaded = true;
            }
        }
    }

    getTaskInfoFromNode( node, ganttColumns, parentTaskUid ) {
        let ganttTaskInfo = super.getTaskInfoFromNode( node, ganttColumns, parentTaskUid );
        ganttTaskInfo.isTcObject = node.isTcObject;
        ganttTaskInfo.isProcessed = false;
        var isUnscheduled = this.isUnscheduledTask( ganttTaskInfo );
        ganttTaskInfo.unscheduled = isUnscheduled;
        return ganttTaskInfo;
    }

    isUnscheduledTask( ganttTask ) {
        var unScheduledTaskTypes = [ 'ProgramView', 'Schedule', 'Group' ];
        if( unScheduledTaskTypes.indexOf( ganttTask.nodeType ) >= 0 ) {
            return true;
        }
        return false;
    }

    getServerColumnName( colName ) {
        return smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ colName ];
    }

    /**
     * Checks whether internal value (dbValue) has to be read for a property
     * @param {String} propName The Property name
     * @returns {Boolean} The flag to indicate whether internal value has to be read
     */
    isFetchInternalValue( propName ) {
        return smConstants.SCH_GANTT_PROPS_FOR_INTERNAL_VAL && smConstants.SCH_GANTT_PROPS_FOR_INTERNAL_VAL.indexOf( propName ) >= 0;
    }

    getUpdateTasksWithProperties( uidArray, propertiesArray ) {
        var ganttTaskArray = [];
        uidArray.forEach( function( uid ) {
            var taskObject = cdm.getObject( uid );
            let ganttTask = ganttUtils.getGanttTask( uid );
            this._uid2TaskInfoMap[ uid ] = ganttTask;
            if( taskObject && ganttTask ) {
                this._uid2TaskMap[ uid ] = taskObject;
                this.updateTaskProperties( taskObject, propertiesArray, ganttTask );
                var completePercent = ganttTask.complete_percent;
                var workCompleteFloat = 0;
                if( !isNaN( completePercent ) ) {
                    if( parseFloat( completePercent ) === 100 ) {
                        workCompleteFloat = 1;
                    } else {
                        var workCompleteValue = ganttTask.work_complete;
                        var workEstimate = ganttTask.work_estimate;
                        if( workEstimate > 0 ) {
                            workCompleteFloat = workCompleteValue / ( workEstimate * 60 );
                        }
                    }
                }
                ganttTask.progress = workCompleteFloat;
                var taskType = ganttTask.task_type;
                if( !isNaN( taskType ) ) {
                    let intType = parseInt( taskType );
                    ganttTask.type = this.getTaskObjectType( intType );
                    ganttTask.taskType = intType;
                }
                var whatIfMode = -1;
                var whatIfDataValues = [];
                if( ganttTask.fnd0WhatIfData ) {
                    var whatIfModeProp = ganttTask.fnd0WhatIfMode;
                    whatIfMode = parseInt( whatIfModeProp );
                    whatIfDataValues = ganttTask.fnd0WhatIfData;
                }
                ganttTask.whatIfMode = whatIfMode;
                ganttTask.hasWhatIfData = whatIfDataValues.length > 0;
                ganttTask.isProcessed = true;
                ganttTaskArray.push( ganttTask );
            }
        }, this );
        return ganttTaskArray;
    }

    getTotalFoundCount() {
        var modelData = this.getDataForGanttInit();
        return modelData.data.length;
    }

    getTaskObjectType( taskType ) {
        var taskObjectType;

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

    getPrgViewConfigWithNewCols( ctx, eventData ) {
        let prgViewConfig = {};
        if( ctx.programViewConfiguration ) {
            prgViewConfig = ctx.programViewConfiguration.configFromSOA;
        }
        if( eventData.columns ) {
            prgViewConfig.columns = [];
            let colIndex = 1;
            for( let index = 0; index < eventData.columns.length; index++ ) {
                let col = eventData.columns[ index ];
                if( !col.hiddenFlag ) {
                    prgViewConfig.columns.push( {
                        columnName: col.propertyName,
                        order: ''
                    } );
                    colIndex++;
                }
            }
        }
        return prgViewConfig;
    }

    getEssentialColumns() {
        return smConstants.PRG_VIEW_ESSENTIAL_COLUMNS;
    }

    getGanttColumnName( colName ) {
        return smConstants.PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING[ colName ];
    }

    getDateFormat() {
        return smConstants.PROGRAM_VIEW_DATE_FORMAT;
    }

    getSourceTask() {
        return this._uid2TaskMap[ this._sourceTaskUid ];
    }

    cleanup() {
        super.cleanup();
        this._sourceTaskUid = null;
        appCtxSvc.unRegisterCtx( 'programViewConfiguration' );
    }
}
