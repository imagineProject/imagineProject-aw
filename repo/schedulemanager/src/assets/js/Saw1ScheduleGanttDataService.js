// Copyright (c) 2022 Siemens

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import ganttConstants from 'js/SMGantt/GanttConstants';
import ganttDataService, { AwGanttDataService } from 'js/AwGanttDataService';

/**
 * Schedule Gantt data transform service
 */
export default class Saw1ScheduleGanttDataService extends AwGanttDataService {
    constructor() {
        super();
        this.createFnMap = new Map( [
            [ 'ScheduleTask', Saw1ScheduleGanttDataService.scheduleTaskCreateFn ],
            [ 'Fnd0ProxyTask', Saw1ScheduleGanttDataService.fnd0ProxyTaskCreateFn ],
            [ 'Prg0AbsEvent', Saw1ScheduleGanttDataService.prg0AbsEventCreateFn ],
            [ 'TaskDependency', Saw1ScheduleGanttDataService.taskDependencyCreateFn ],
            [ 'Prg0EventDependencyRel', Saw1ScheduleGanttDataService.milestoneEventDependencyCreateFn ]
        ] );

        this.updateFnMap = new Map( [
            [ 'ScheduleTask', Saw1ScheduleGanttDataService.scheduleTaskUpdateFn ],
            [ 'Fnd0ProxyTask', Saw1ScheduleGanttDataService.fnd0ProxyTaskUpdateFn ],
            [ 'Prg0AbsEvent', Saw1ScheduleGanttDataService.prg0AbsEventUpdateFn ],
            [ 'TaskDependency', Saw1ScheduleGanttDataService.taskDependencyUpdateFn ]
        ] );
    }

    static scheduleTaskCreateFn( modelObject ) {
        let completePercent = modelObject.props.complete_percent.dbValues[ 0 ];
        let workEstimate = modelObject.props.work_estimate.dbValues[ 0 ];
        let workComplete = modelObject.props.work_complete.dbValues[ 0 ];
        let taskProgress = isNaN( completePercent ) ? 0 : parseFloat( completePercent ) === 100 ? 1 :
            workEstimate > 0 ? workComplete / workEstimate : 0;

        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( modelObject.props.start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( modelObject.props.finish_date.dbValues[ 0 ] );
        ganttObject.type = ganttObject.getDbValue( 'task_type' ).toString();
        if( ganttObject.type === '6' ) {
            ganttObject.render = 'split';
        }
        ganttObject.progress = taskProgress;
        ganttObject.getCssClass = () => { return getTaskCssClass( ganttObject ); };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTaskText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskRightSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.canDragStart = () => { return canDragTask( ganttObject, 'resizeStart' ); };
        ganttObject.canDragEnd = () => { return canDragTask( ganttObject, 'resizeEnd' ); };
        ganttObject.canDragMove = () => { return canDragTask( ganttObject, 'move' ); };
        ganttObject.canDragProgress = () => { return canDragTask( ganttObject, 'progress' ); };
        return ganttObject;
    }

    static fnd0ProxyTaskCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( modelObject.props.fnd0start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( modelObject.props.fnd0finish_date.dbValues[ 0 ] );
        ganttObject.type = ganttObject.getDbValue( 'fnd0type' ).toString();
        ganttObject.progress = ganttObject.getDbValue( 'fnd0percent_work_complete' );
        ganttObject.getCssClass = () => { return 'proxy_task'; };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getProxyTaskTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTaskText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskRightSideText( start, end, ganttTask, ganttInstance ); };
        return ganttObject;
    }

    static prg0AbsEventCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.getCssClass = () => { return 'event'; };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getEventTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.type = '1';
        let plannedDateStr = modelObject.props.prg0PlannedDate.dbValues[ 0 ];
        let plannedDateObj = new Date( plannedDateStr );
        let plannedDate = dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
        ganttObject.start_date = plannedDate;
        ganttObject.end_date = plannedDate;
        ganttObject.isSplitChild = true;   //Object to be in same row as parent
        ganttObject.canDragMove = () => { return true; };
        return ganttObject;
    }

    static taskDependencyCreateFn( modelObject ) {
        let dependencyType = modelObject.props.dependency_type.dbValues[ 0 ];
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.source = ganttObject.getDbValue( 'secondary_object' );
        ganttObject.target = ganttObject.getDbValue( 'primary_object' );
        ganttObject.type = [ '0', '1', '2', '3' ].includes( dependencyType ) ? dependencyType : dependencyType === '4' ? '1' : '0';
        return ganttObject;
    }

    static milestoneEventDependencyCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.source = ganttObject.getDbValue( 'secondary_object' );
        ganttObject.target = ganttObject.getDbValue( 'primary_object' );
        ganttObject.type = '0';
        return ganttObject;
    }

    static scheduleTaskUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getTask( ganttObjectId );
        let completePercent = ganttObject.getDbValue( 'complete_percent' );
        let workEstimate = ganttObject.getDbValue( 'work_estimate' );
        let workComplete = ganttObject.getDbValue( 'work_complete' );

        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( ganttObject.getDbValue( 'start_date' ) );
        ganttObject.end_date = new Date( ganttObject.getDbValue( 'finish_date' ) );
        ganttObject.type = ganttObject.getDbValue( 'task_type' ).toString();
        ganttObject.progress = isNaN( completePercent ) ? 0 : parseFloat( completePercent ) === 100 ? 1 :
            workEstimate > 0 ? workComplete / workEstimate : 0;
        ganttInstance.updateTask( ganttObject.id );
    }

    static fnd0ProxyTaskUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getTask( ganttObjectId );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( ganttObject.getDbValue( 'fnd0start_date' ) );
        ganttObject.end_date = new Date( ganttObject.getDbValue( 'fnd0finish_date' ) );
        ganttObject.type = ganttObject.getDbValue( 'fnd0type' ).toString();
        ganttObject.progress = ganttObject.getDbValue( 'fnd0percent_work_complete' );
        ganttInstance.updateTask( ganttObject.id );
    }

    static prg0AbsEventUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getTask( ganttObjectId );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
        ganttObject.end_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
        ganttInstance.updateTask( ganttObject.id );
    }

    static taskDependencyUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getLink( ganttObjectId );
        let dependencyType = ganttObject.getDbValue( 'dependency_type' );
        ganttObject.source = ganttObject.getDbValue( 'secondary_object' );
        ganttObject.target = ganttObject.getDbValue( 'primary_object' );
        ganttObject.type = [ '0', '1', '2', '3' ].includes( dependencyType ) ? dependencyType : dependencyType === '4' ? '1' : '0';
        ganttInstance.updateLink( ganttObject.id );
    }
}

const getTaskCssClass = ( ganttTask ) => {
    return ganttTask.type === '1' ? 'milestone' :
        ganttTask.type === '2' || ganttTask.type === '3' || ganttTask.type === '6'  ? 'summary_task' : 'schedule_task';
};

const canDragTask = ( ganttTask, mode ) => {
    // Only Standard, Milestone and Gate types can be dragged.
    if( ganttTask.type === '0' || ganttTask.type === '1' || ganttTask.type === '4' ) {
        if( mode === 'move' || mode === 'progress' ) {
            return true;
        }
        let object = cdm.getObject( ganttTask.getDbValue( 'schedule_tag' ) );
        if( mode === 'resizeStart' && object ) {
            let isEndDateSchedule = object.props.end_date_scheduling.dbValues[ 0 ];
            return isEndDateSchedule === 'true' || isEndDateSchedule === '1';
        }
        if( mode === 'resizeEnd' && object ) {
            let isEndDateSchedule = object.props.end_date_scheduling.dbValues[ 0 ];
            return !( isEndDateSchedule === 'true' || isEndDateSchedule === '1' );
        }
    }
    return false; // Block all other types
};

const getScheduleTaskTooltip = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];

    addTaskTooltip( tooltipText, start, end, ganttTask, ganttInstance, 'fnd0status' );

    // Always show the assignee information
    let assignees = ganttTask.getUiValues( 'ResourceAssignment' );
    if( assignees && assignees.length > 0 ) {
        if( tooltipText.length === 0 ) {
            tooltipText.push( '<div class=\'gantt_tooltip_resource_assignee\'>' );
        }
        tooltipText.push( '<table><tr>' );
        tooltipText.push( '<td class="gantt_resource_assignee"><strong>' + ganttInstance.locale.labels.resource + ' : </strong></td>' );
        tooltipText.push( '<td class="gantt_resource_assignee">' + assignees.join( '<br/>' ) + '</td>' );
        tooltipText.push( '</tr></table>' );
    }
    return tooltipText.join( '' );
};

const getProxyTaskTooltip = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];
    addTaskTooltip( tooltipText, start, end, ganttTask, ganttInstance, 'fnd0status' );
    return tooltipText.join( '' );
};

const addTaskTooltip = ( tooltipText, start, end, ganttTask, ganttInstance, statusProp ) => {
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    tooltipText.push( '<strong>' + ganttTask.text + '</strong>' );
    tooltipText.push( '<br/>' );

    if( ganttInstance.baselineUids.length > 0 ) { // TODO: Proxy task does not have baseline, so is this needed?
        tooltipText.push( '<strong>' + ganttInstance.locale.labels.status + ' : </strong> ' + ganttTask.getUiValue( statusProp ) );
        tooltipText.push( '<br/>' );
    } else {
        if( ganttTask.type === '1' ) {
            tooltipText.push( '<strong>' + ganttInstance.locale.labels.date + ': </strong> ' + ganttInstance.templates.tooltip_date_format( start ) );
            tooltipText.push( '<br/>' );
        } else {
            tooltipText.push( '<strong>' + ganttInstance.locale.labels.tooltip_start_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( start ) );
            tooltipText.push( '<br/>' );
            tooltipText.push( '<strong> ' + ganttInstance.locale.labels.tooltip_finish_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( end ) );
            tooltipText.push( '<br/>' );
            tooltipText.push( '<strong>' + ganttInstance.locale.labels.status + ' : </strong> ' + ganttTask.getUiValue( statusProp ) );
            tooltipText.push( '<br/>' );
        }
    }
};

const getEventTooltip = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    tooltipText.push( '<strong>' + ganttTask.text + '</strong>' );
    tooltipText.push( '<br/>' );
    tooltipText.push( '<strong>' + ganttInstance.locale.labels.date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( start ) );
    tooltipText.push( '<br/>' );
    tooltipText.push( '<strong> ' + ganttInstance.locale.labels.status + ' : </strong> ' + ganttTask.getUiValue( 'prg0State' ) );
    tooltipText.push( '</br>' );
    return tooltipText.join( '' );
};

const canShowTaskText = ( ganttInstance ) => {
    return ganttInstance.showGanttTaskInfo === 'true' && ganttInstance.baselineUids.length <= 0;
};

const getScheduleTaskText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) ) {
        return '';
    }

    let statusIcon = ganttConstants.GANTT_TOOLTIP_TASK_STATUS[ ganttTask.getDbValue( 'fnd0status' ) ];
    let placementInfo = getTextPlacementInfo( ganttTask, 24, ganttInstance );
    let taskText = [];
    // Show Task & Status icon
    if( placementInfo.placement === 'center' ) {
        taskText.push( '<div class="gantt_taskbar">' );
        taskText.push( '<div class="gantt_task_text">' + ganttTask.text + '</div>' );
        taskText.push( '</div>' );
        taskText.push( '<div class=\'gantt_center_align_text gantt_task_status ' + statusIcon + '\'>' );
        taskText.push( '</div>' );
        return taskText.join( '' );
    }

    // Show only the status icon
    if( placementInfo.taskBarWidth >= ganttConstants.GANTT_TASK_STATUS_ICON_SIZE ) {
        return '<div class=\'gantt_task_icon_center gantt_task_status ' + statusIcon + '\'</div>';
    }
    return '';
};

const getScheduleTaskLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) ) {
        return;
    }

    let taskText = [];
    if( !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
        taskText.push( '<div class="gantt_task_date">' + dateTimeSvc.formatDate( ganttTask.start_date ) + '</div>' );
    }

    appendSideText( taskText, ganttTask, ganttInstance, 'left' );
    return taskText.join( '' );
};

const getScheduleTaskRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) ) {
        return;
    }

    let taskText = [];
    appendSideText( taskText, ganttTask, ganttInstance, 'right' );

    if( ganttInstance.isCurrentZoomLevel( 'day' ) ) {
        let assignees = ganttTask.getUiValues( 'ResourceAssignment' );
        if( assignees && assignees.length > 0 ) {
            taskText.push( '<div class=\'gantt_taskbar_person_icon\'></div>' );
        }
    } else {
        taskText.push( '<div class="gantt_task_date">' + dateTimeSvc.formatDate( ganttTask.end_date ) + '</div>' );
    }
    return taskText.join( '' );
};

const appendSideText = ( taskText, ganttTask, ganttInstance, placementSide ) => {
    let placementInfo = getTextPlacementInfo( ganttTask, 24, ganttInstance );
    if( placementInfo.placement !== placementSide ) {
        return;
    }
    taskText.push( '<div class="gantt_taskbar">' );
    taskText.push( '<div class="gantt_task_text">' + ganttTask.text + '</div>' );
    taskText.push( '</div>' );
    if( placementInfo.taskBarWidth < ganttConstants.GANTT_TASK_STATUS_ICON_SIZE ) {
        let statusIcon = ganttConstants.GANTT_TOOLTIP_TASK_STATUS[ ganttTask.getDbValue( 'fnd0status' ) ];
        taskText.push( '<div class=\'gantt_task_status ' + statusIcon + '\'>' );
        taskText.push( '</div>' );
    }
};

const getTextWidth = ( text ) => {
    if( !getTextWidth.context ) {
        var element = document.createElement( 'canvas' );
        var context = element.getContext( '2d' );
        var fontSize = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontSize;
        var fontFamily = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontFamily;
        context.font = fontSize + ' ' + fontFamily;
        getTextWidth.context = context;
    }
    return getTextWidth.context.measureText( text ).width;
};

const getTextPlacementInfo = ( ganttTask, padding, ganttInstance ) => {
    let taskBarWidth = ganttInstance.getTaskPosition( ganttTask, ganttTask.start_date, ganttTask.end_date ).width;
    let textWidth = getTextWidth( ganttTask.text ) + padding;
    let placement = 'center';
    if( taskBarWidth < textWidth ) {
        placement = 'right';
        let widthTillGanttEnd = ganttInstance.posFromDate( ganttInstance.getState().max_date );
        let widthTillTaskEnd = ganttInstance.posFromDate( ganttTask.end_date );
        if( widthTillGanttEnd - widthTillTaskEnd < textWidth ) {
            placement = 'left';
        }
    }
    return { taskBarWidth: taskBarWidth, textWidth: textWidth, placement: placement };
};
