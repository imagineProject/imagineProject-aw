// Copyright (c) 2022 Siemens

import ganttDataService, { AwGanttDataService } from 'js/AwGanttDataService';

/**
 * Program View data transform service
 */
export default class Saw1ProgramViewDataService extends AwGanttDataService {
    constructor() {
        super();
        this.createFnMap = new Map( [
            [ 'ProgramView', Saw1ProgramViewDataService.programViewCreateFn ],
            [ 'Schedule', Saw1ProgramViewDataService.scheduleCreateFn ],
            [ 'ScheduleTask', Saw1ProgramViewDataService.scheduleTaskCreateFn ]
        ] );

        this.updateFnMap = new Map( [
            [ 'ProgramView', Saw1ProgramViewDataService.programViewUpdateFn ]
        ] );
    }

    static programViewCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.$has_child = modelObject.props.hasChildren;
        ganttObject.$open = modelObject.props.hasChildren;
        ganttObject.unscheduled = true;
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTaskText = ( start, end, ganttTask, ganttInstance ) => { return ''; };
        return ganttObject;
    }

    static scheduleCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = modelObject.props.object_name.dbValue;
        if( modelObject.props.hasChildren.dbValue === 'true' ) {
            ganttObject.$has_child = true;
        }
        ganttObject.isProcessed = false;
        ganttObject.start_date = new Date( modelObject.props.start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( modelObject.props.finish_date.dbValues[ 0 ] );
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTaskText = ( start, end, ganttTask, ganttInstance ) => { return ''; };
        ganttObject.getCssClass = () => { return getTaskCssClass( ganttObject ); };
        ganttObject.unscheduled = true;
        return ganttObject;
    }

    static scheduleTaskCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = modelObject.props.object_name.dbValues[0];
        ganttObject.isProcessed = false;
        if( modelObject.props.hasChildren.dbValue === 'true' ) {
            ganttObject.$has_child = true;
        }
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getScheduleTaskTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTaskText = ( start, end, ganttTask, ganttInstance ) => { return ''; };
        ganttObject.start_date = new Date( modelObject.props.start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( modelObject.props.finish_date.dbValues[ 0 ] );
        ganttObject.getCssClass = () => { return getTaskCssClass( ganttObject ); };
        ganttObject.type === '1' ? ganttObject.type = 'milestone' : '';
        ganttObject.unscheduled = false;
        return ganttObject;
    }

    static programViewUpdateFn( ganttObjectId, ganttInstance ) {
        let ganttObject = ganttInstance.getTask( ganttObjectId );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttInstance.updateTask( ganttObject.id );
    }
}

const canShowTooltip = ( ganttInstance ) => {
    return ganttInstance.showGanttTaskInfo !== 'true';
};

const addTaskTooltip = ( tooltipText, start, end, ganttTask, ganttInstance, statusProp ) => {
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    tooltipText.push( '<strong>' + ganttTask.text + '</strong>' );
    tooltipText.push( '<br/>' );
    if( ganttTask.type === '1' ) {
        tooltipText.push( '<strong>' + ganttInstance.locale.labels.date + ': </strong> ' + ganttInstance.templates.tooltip_date_format( start ) );
        tooltipText.push( '<br/>' );
    } else {
        tooltipText.push( '<strong>' + ganttInstance.locale.labels.tooltip_start_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( start ) );
        tooltipText.push( '<br/>' );
        tooltipText.push( '<strong> ' + ganttInstance.locale.labels.tooltip_finish_date + ' : </strong> ' + ganttInstance.templates.tooltip_date_format( end ) );
        tooltipText.push( '<br/>' );
    }
};

const getScheduleTaskTooltip = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];

    if( canShowTooltip( ganttInstance ) ) {
        addTaskTooltip( tooltipText, start, end, ganttTask, ganttInstance, 'fnd0status' );
    }

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

const getTaskCssClass = ( ganttTask ) => {
    return ganttTask.type === '1' ? 'milestone' :
        ganttTask.type === '2' || ganttTask.type === '3' || ganttTask.type === '6'  ? 'summary_task' : 'schedule_task';
};


