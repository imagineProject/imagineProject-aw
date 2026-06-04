// Copyright (c) 2022 Siemens

/**
 * @module js/ProgramView/uiProgramViewTemplates
 */
import iconService from 'js/iconService';
import ganttManager from 'js/uiGanttManager';

var exports = {};

/**
 * Method for adding the template functions
 */
export let addTemplates = function() {
    ganttManager.getGanttInstance().templates.grid_folder = function( item ) {
        var type = item.nodeType;
        var schTaskIcon = iconService.getTypeIconURL( 'ScheduleTask' );
        var scheduleIcon = iconService.getTypeIconURL( 'Schedule' );
        var prgViewIcon = iconService.getTypeIconURL( 'ProgramView' );
        var icon = '';

        switch ( type ) {
            case 'Schedule': {
                icon = scheduleIcon;
                break;
            }
            case 'ScheduleTask': {
                icon = schTaskIcon;
                break;
            }
            case 'ProgramView': {
                icon = prgViewIcon;
                break;
            }
            default: {
                icon = schTaskIcon;
            }
        }

        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };
    ganttManager.getGanttInstance().templates.grid_file = function( item ) {
        var type = item.nodeType;
        var schTaskIcon = iconService.getTypeIconURL( 'ScheduleTask' );
        var scheduleIcon = iconService.getTypeIconURL( 'Schedule' );
        var prgViewIcon = iconService.getTypeIconURL( 'ProgramView' );

        var icon = '';
        switch ( type ) {
            case 'Schedule': {
                icon = scheduleIcon;
                break;
            }
            case 'ScheduleTask': {
                icon = schTaskIcon;
                break;
            }
            case 'ProgramView': {
                icon = prgViewIcon;
                break;
            }
            default: {
                icon = schTaskIcon;
            }
        }
        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };

    ganttManager.getGanttInstance().templates.tooltip_date_format = function( date ) {
        var formatFunc = ganttManager.getGanttInstance().date.date_to_str( '%d-%M-%Y' );
        return formatFunc( date );
    };

    ganttManager.getGanttInstance().templates.tooltip_text = function( start, end, task ) {
        var taskNameColumn = ganttManager.getGanttInstance().locale.labels.tooltip_text;
        var startDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_start_date;
        var finishDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_finish_date;
        var dateText = ganttManager.getGanttInstance().locale.labels.date;

        var tooltipText = '<div class="gantt_tooltip_text">';
        if( task.taskType === 1 ) {
            tooltipText += '<strong>' + task.text + '</strong><br/><strong>' + dateText + ': </strong> ' +
                ganttManager.getGanttInstance().templates.tooltip_date_format( start );
        } else {
            tooltipText += '<strong>' + task.text + '</strong><br/><strong> ' +
                startDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( start ) + '<br/><strong> ' +
                finishDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( end ) + '<br/>';
        }

        return tooltipText + '</div>';
    };

    ganttManager.getGanttInstance().templates.task_class = function( start, end, task ) {
        var task_classes = [];

        if( task.taskType === 1 ) { // Milestone
            task_classes.push( 'milestone' );
        } else if( task.taskType === 2 || task.taskType === 6 ) { // Schedule Summary, Summary task
            task_classes.push( 'summary_task' );
        } else if( task.taskType === 5 ) { //Proxy Task
            task_classes.push( 'proxy_task' );
        } else {
            task_classes.push( 'schedule_task' );
        }
        if( task.progress > 0 ) {
            task_classes.push( 'task_progress_border' );
        }
        if ( ganttManager.getGanttInstance().isSelectedTask( task.id ) ) {
            task_classes.push( 'gantt_selected' );
        }
        return task_classes.join( ' ' );
    };

    //This will return the name of div when we add and modify the task in What-If mode.
    ganttManager.getGanttInstance().templates.grid_row_class = function( start, end, task ) {
        if( ganttManager.getFlagForWhatIf() ) {
            if( task.whatIfMode === 1 && task.type !== 'scheduleSummary' ) {
                return 'task_added_in_whatif_mode';
            }

            if( task.hasWhatIfData && task.type !== 'scheduleSummary' ) {
                return 'modified_in_whatif_mode';
            }
        } else {
            task.whatIfMode = -1;
            task.hasWhatIfData = false;
        }
    };

    ganttManager.getGanttInstance().templates.task_text = function( start, end, task ) {
        return '';
    };
};

export let loadGanttScale = function( viewType ) {
    switch ( viewType ) {
        case 'year':
            ganttManager.getGanttInstance().config.scale_unit = 'day';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.date_scale = '%d, %D';
            ganttManager.getGanttInstance().config.scale_height = 60;
            var weekScaleTemplate = function( date ) {
                var weekText = ganttManager.getGanttInstance().locale.labels.weeks;
                var dateToStr = ganttManager.getGanttInstance().date.date_to_str( '%d %m' );
                var weekNum = ganttManager.getGanttInstance().date.date_to_str( '(' + weekText + ' %W)' );
                var endDate = ganttManager.getGanttInstance().date.add( ganttManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                return dateToStr( date ) + ' - ' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%F, %Y'
            }, {
                unit: 'week',
                step: 1,
                template: weekScaleTemplate
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                if( !ganttManager.getGanttInstance().isWorkTime( date ) ) {
                    return 'week_end';
                }
                return '';
            };
            break;
        case 'day':
            ganttManager.getGanttInstance().config.scale_unit = 'week';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.scale_height = 60;
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%M'
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            var weekScaleTemplate = function( date ) {
                var dateToStr = ganttManager.getGanttInstance().date.date_to_str( '%d' );
                var endDate = ganttManager.getGanttInstance().date.add( ganttManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                var weekNum = ganttManager.getGanttInstance().date.date_to_str( '(%W)' );
                return dateToStr( date ) + '-' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            ganttManager.getGanttInstance().templates.date_scale = weekScaleTemplate;
            break;
        case 'week':
            ganttManager.getGanttInstance().config.scale_unit = 'month';
            ganttManager.getGanttInstance().config.date_scale = '%M';
            ganttManager.getGanttInstance().config.scale_height = 60;
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'year',
                step: 1,
                date: '%Y'
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
        case 'month':
            ganttManager.getGanttInstance().config.scale_unit = 'year';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.date_scale = '%Y';
            ganttManager.getGanttInstance().config.scale_height = 60;
            ganttManager.getGanttInstance().config.subscales = [];
            ganttManager.getGanttInstance().config.row_height = 30;
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
    }
};

export default exports = {
    addTemplates,
    loadGanttScale
};
