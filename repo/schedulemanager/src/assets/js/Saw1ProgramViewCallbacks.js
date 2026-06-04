// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import AwGanttCallbacks from 'js/AwGanttCallbacks';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import ganttScrollService from 'js/Saw1ScheduleGanttScrollService';
import programViewTemplates from 'js/Saw1ProgramViewTemplates';
import dms from 'soa/dataManagementService';
import _ from 'lodash';

export class Saw1ProgramViewCallbacks extends AwGanttCallbacks {
    constructor() {
        super();
        // this.schedule = schedule;
    }

    //Scroll into view on gantt for any selected task
    onObjectsSelected( selectedUids ){
        //scroll to latest selected task
        const task = this.ganttInstance.getTask( selectedUids[selectedUids.length-1] );
        this.ganttInstance.showDate( task.start_date );
    }

    onBeforeGanttReady() {
        super.onBeforeGanttReady();
        this.ganttInstance.templates.grid_folder = ( task ) => { return programViewTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_file = ( task ) => { return programViewTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.task_class = ( start, end, task ) => { return programViewTemplates.getTaskClass( task, this.ganttInstance ); };
        this.ganttInstance.templates.task_text = ( start, end, task ) => { return ''; };
        this.ganttInstance.templates.tooltip_date_format = ( date ) => { return this.ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
        this.ganttInstance.templates.tooltip_text = ( start, end, task ) => { return programViewTemplates.getTooltipText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.timeline_cell_class = ( task, date ) => {
            if( !this.ganttInstance.isWorkTime( date ) ) {
                return 'week_end';
            }
            return '';
        };
    }

    onGanttScroll( left, top ) {
        ganttScrollService.scrollTable();
        let scrollTimeout;
        clearTimeout( scrollTimeout );
        scrollTimeout = setTimeout( () => {
            fetchAndUpdateVisibleTasks( this.ganttInstance );
        }, 100 );
    }

    onTaskOpened( id ) {
        if( cdm.getObject( id ) === null || cdm.getObject( id ).type !== 'ProgramView' ) {
            eventBus.publish( 'saw1PrgView.loadSchTasks', { uid: id } );
        }
    }
}

export const onObjectsUpdated = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    eventData.updatedObjects && eventData.updatedObjects.forEach( modelObject => ganttDataService.updateGanttObject( modelObject.uid, atomicData.ganttInstance ) );
};

let getVisibleTasks = ( ganttInstance ) => {
    let visibleTasks = [];
    if( document.querySelector( '.gantt_grid_data' ) ) {
        let childNodes = document.querySelector( '.gantt_grid_data' ).childNodes;
        childNodes.forEach( ( child ) => {
            if( child && child.attributes[ 'data-task-id' ] ) {
                let uid = child.attributes[ 'data-task-id' ].nodeValue;
                if( uid ) {
                    let taskInfo = ganttInstance.getTask( uid );
                    if( taskInfo ) {
                        visibleTasks.push( taskInfo );
                    }
                }
            }
        } );
        return visibleTasks;
    }
};

let getNodeVMOs = ( nodes ) => {
    var vmoArray = [];
    nodes.forEach( function( node ) {
        var VMO = {
            uid: node.id,
            type: node.nodeType
        };
        vmoArray.push( VMO );
    } );
    return vmoArray;
};

let getBasicPropertiesToLoad = ()=> {
    return [ 'duration',
        'complete_percent',
        'work_estimate',
        'work_complete',
        'task_type',
        'saw1WorkEffort' ];
};

let getGanttTask = ( taskUid, ganttInstance ) => {
    let ganttTask;
    if( taskUid && ganttInstance.isTaskExists( taskUid ) ) {
        ganttTask = ganttInstance.getTask( taskUid );
    }
    return ganttTask;
};

let setPropertiesOnGanttTask = ( propName, propValue, ganttTaskInfo ) => {
    let updatedPropName = propName;
    if( updatedPropName ) {
        propName = updatedPropName;
    }

    if( propValue && 'true' === propValue ) {
        propValue = true;
    } else if( propValue && 'false' === propValue ) {
        propValue = false;
    }

    ganttTaskInfo[ propName ] = propValue;
};

let updateTaskProperties = ( taskObject, propertiesArray, ganttTask ) => {
    if( taskObject ) {
        propertiesArray.forEach( function( propName ) {
            if( ganttTask && ganttTask.isProxyTask && propName === 'text' ) {
                //Do not update proxy Task name as its already updated
                return;
            }
            let updatedPropName = propName;
            if( updatedPropName ) {
                propName = updatedPropName;
            }
            let propValue;
            if( taskObject.props.hasOwnProperty( propName ) ) {
                propValue = taskObject.props[ propName ].uiValues[ 0 ];
                let propDescMap = taskObject.modelType.propertyDescriptorsMap;
                if( propDescMap && propDescMap[ propName ] ) {
                    let propDesc = propDescMap[ propName ];
                    if( propDesc && propDesc.anArray ) {
                        propValue = taskObject.props[ propName ].uiValues;
                    }
                }
            } else if( ganttTask && !ganttTask.isProxyTask && propName === 'uid' ) {
                propValue = taskObject.uid;
            }
            if( propValue !== undefined ) {
                setPropertiesOnGanttTask( propName, propValue, ganttTask );
            }
        } );
    }
};

let getUpdateTasksWithProperties = ( uidArray, propertiesArray, ganttInstance ) => {
    var ganttTaskArray = [];
    uidArray.forEach( function( uid ) {
        var taskObject = cdm.getObject( uid );
        let ganttTask = getGanttTask( uid, ganttInstance );
        if( taskObject && ganttTask ) {
            updateTaskProperties( taskObject, propertiesArray, ganttTask );
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
                ganttTask.type = intType;
                ganttTask.type ? ganttTask.type = 'milestone' : '';
                ganttTask.taskType = intType;
            }
            ganttTask.isProcessed = true;
            ganttTaskArray.push( ganttTask );
        }
    } );
    return ganttTaskArray;
};

let afterRenderCallback = ( visibleTasks, ganttColumns, ganttInstance ) => {
    if( visibleTasks && visibleTasks.length > 0 ) {
        var unprocessedTasks = _.filter( visibleTasks, [ 'isProcessed', false ] );
        if( unprocessedTasks.length > 0 ) {
            var vmoArray = getNodeVMOs( unprocessedTasks );
            var propertiesToBeLoaded = getBasicPropertiesToLoad();
            ganttColumns.forEach( function( col ) {
                let colName = col.name;
                if( colName !== 'start_date' && colName !== 'end_date' ) {
                    var updatedColName = colName;
                    if( updatedColName ) {
                        colName = updatedColName;
                    }
                    propertiesToBeLoaded.push( colName );
                }
            } );

            dms.getPropertiesUnchecked( vmoArray, propertiesToBeLoaded ).then( function() {
                var uidArray = [];
                vmoArray.forEach( function( task ) {
                    uidArray.push( task.uid );
                } );
                ganttInstance.batchUpdate( () => {
                    getUpdateTasksWithProperties( uidArray, propertiesToBeLoaded, ganttInstance );
                } );
            } );
        }
    }
};

export let fetchAndUpdateVisibleTasks = ( ganttInstance, atomicDataRef ) => {
    ganttInstance = ganttInstance && ganttInstance !== '' ? ganttInstance : atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let visibleTasks = getVisibleTasks( ganttInstance );
    afterRenderCallback( visibleTasks, ganttInstance.config.columns, ganttInstance );
};

export default {
    onObjectsUpdated,
    fetchAndUpdateVisibleTasks
};
