// Copyright (c) 2023 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import ganttLayoutService from 'js/Saw1ScheduleGanttLayoutService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';

export const showBaselines = ( baselineUids, treeTableData, atomicDataRef, schedule ) => {
    const ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( !ganttInstance ) {
        return;
    }

    if( ganttInstance.baselineUids.length !== baselineUids.length || !ganttInstance.baselineUids.every( ( uid, index ) => uid === baselineUids[ index ] ) ) {
        ganttInstance.baselineUids = baselineUids;
        ganttInstance.baselineInfo = {};
        ganttLayoutService.updateGanttRowHeight( atomicDataRef );
        if( ganttInstance.baselineUids.length > 0 ) {
            loadBaselines( schedule, baselineUids, [ treeTableData.getValue().rootNode ].concat( schNavTreeUtils.getChildrenInHierarchy( treeTableData.getValue().rootNode ) ) );
        }
    }
};

export const loadBaselines = ( schedule, baselineUids, treeNodes ) => {
    // Filter out non-ScheduleTask objects e.g. ProxyTask, as they are not baselined.
    let scheduleTasks = _.transform( treeNodes, ( result, node ) => {
        let modelObject = cdm.getObject( node.uid );
        if( cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) ) {
            result.push( modelObject );
        }
    }, [] );

    let baselineObjects = _.transform( baselineUids, ( result, uid ) => result.push( cdm.getObject( uid ) ), [] );
    let loadBaselineInput = {
        sourceSchedule: schedule,
        baselineSchedules: baselineObjects,
        scheduleTasks: scheduleTasks,
        loadOptions: {}
    };
    eventBus.publish( 'scheduleGantt.loadBaselines', { loadBaselineInput: loadBaselineInput } );
};

const addBaselineTaskLayer = ( ganttInstance ) => {
    // Skip, if the task layer already exists.
    if( !ganttInstance || ganttInstance.baselineTaskLayerId ) {
        return;
    }
    ganttInstance.baselineTaskLayerId = ganttInstance.addTaskLayer( ganttTask => {
        if( ganttInstance.baselineUids.length <= 0 ) {
            return false;
        }

        let baselineParentEl = document.createElement( 'div' );
        ganttInstance.baselineUids.forEach( ( baselineUid, index ) => {
            let baselineSchedule = cdm.getObject( baselineUid );
            if ( !baselineSchedule ) {
                return;
            }
            let baselineTaskInfo = ganttInstance.getBaselineTaskInfo( baselineUid, ganttTask );
            if( baselineTaskInfo.start_date && baselineTaskInfo.finish_date ) {
                let baselineTaskStart = ganttInstance.date.parseDate( baselineTaskInfo.start_date, 'xml_date' );
                let baselineTaskEnd = ganttInstance.date.parseDate( baselineTaskInfo.finish_date, 'xml_date' );

                let baselineEl = document.createElement( 'div' );
                baselineEl.className = 'gantt_baseline';

                if( baselineSchedule?.props && baselineSchedule?.props?.object_string ) {
                    baselineEl.baselineName = baselineSchedule.props.object_string.uiValues[ 0 ];
                }
                baselineEl.start_date = baselineTaskStart;
                baselineEl.finish_date = baselineTaskEnd;

                let sizes = ganttInstance.getTaskPosition( ganttTask, baselineTaskStart, baselineTaskEnd );
                if( baselineTaskInfo.start_date.getTime() === baselineTaskInfo.finish_date.getTime() ) { // Milestone baseline task
                    baselineEl.style.left = sizes.left - 4 + 'px';
                    let baselineClass = ganttInstance.baselineUids.length === 1 ? 'gantt_base_milestone_' + ( appCtxSvc.ctx.layout === 'comfy' ? 'comfy' : 'compact' ) :
                        index === 0 ? 'gantt_baseline1_milestone' : 'gantt_baseline2_milestone';
                    baselineEl.classList.add( baselineClass );
                    baselineEl.style.top = sizes.top + ganttInstance.getTaskBarHeight( ganttTask.id ) + ( index >= 1 ? 8 : 5 ) + 'px';
                } else {
                    baselineEl.style.width = sizes.width + 'px';
                    baselineEl.style.left = sizes.left + 'px';
                    let baselineClass = ganttInstance.baselineUids.length === 1 ? 'gantt_baseline_' + ( appCtxSvc.ctx.layout === 'comfy' ? 'comfy' : 'compact' ) :
                        index === 0 ? 'baseline1' : 'baseline2';
                    baselineEl.classList.add( baselineClass );
                    baselineEl.style.top = sizes.top + ganttInstance.getTaskBarHeight( ganttTask.id ) + ( index >= 1 ? 26 : 14 ) + 'px';
                }
                baselineParentEl.appendChild( baselineEl );
            }
        } );
        return baselineParentEl;
    } );
};

export const getBaselineTooltip = ( ganttInstance ) => {
    return {
        selector: '.gantt_baseline',
        html: function( event, node ) {
            let tooltipText = [];
            tooltipText.push( '<div class="gantt_tooltip_text">' );
            tooltipText.push( '<strong>' + node.baselineName + '</strong>' );
            tooltipText.push( '<br/>' );
            tooltipText.push( '<strong>' + ganttInstance.locale.labels.tooltip_start_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( node.start_date ) );
            tooltipText.push( '<br/>' );
            tooltipText.push( '<strong> ' + ganttInstance.locale.labels.tooltip_finish_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( node.finish_date ) );
            tooltipText.push( '<br/>' );
            return tooltipText.join( '' );
        }
    };
};

export const processLoadBaselineResponse = ( response, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( !response.baselineTasksInfo || !ganttInstance ) {
        return;
    }

    // Reset baseline information
    let checkBaselineInfoIsEmpty =  Object.keys( ganttInstance.baselineInfo ).length === 0;
    if( checkBaselineInfoIsEmpty ) {
        ganttInstance.baselineInfo = {};
        ganttInstance.baselineUids.forEach( baselineUid => ganttInstance.baselineInfo[ baselineUid ] = {} );
    }

    for( const [ taskUid, tasksInfo ] of Object.entries( response.baselineTasksInfo ) ) {
        tasksInfo.forEach( taskInfo => addBaselineTaskInfo( ganttInstance, taskInfo.properties.schedule_tag, taskUid, taskInfo ) );
    }
    addBaselineTaskLayer( ganttInstance );
    ganttInstance.render();
};

const addBaselineTaskInfo = ( ganttInstance, baselineUid, taskUid, taskInfo ) => {
    ganttInstance.baselineInfo[ baselineUid ][ taskUid ] = {
        start_date: new Date( taskInfo.properties.startDate ),
        finish_date: new Date( taskInfo.properties.finishDate )
    };
};

export default {
    showBaselines,
    getBaselineTooltip,
    processLoadBaselineResponse,
    loadBaselines
};
