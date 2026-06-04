// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/SMGantt/GanttConstants
 */
var exports = {};

export let GANTT_TOOLTIP_TASK_STATUS = {
    not_started: 'gantt_tooltip_not_started_task',
    in_progress: 'gantt_tooltip_in_progress_task',
    needs_attention: 'gantt_tooltip_needs_attention_task',
    pending: 'gantt_tooltip_pending_task',
    paused: 'gantt_tooltip_paused_task',
    unable_to_complete: 'gantt_tooltip_unable_to_complete_task',
    late: 'gantt_tooltip_late_task',
    complete: 'gantt_tooltip_complete_task',
    abandoned: 'gantt_tooltip_abandoned_task',
    aborted: 'gantt_tooltip_aborted_task'
};
//Icon size (16)+padding(8) , so 24
export let GANTT_TASK_STATUS_ICON_SIZE = '24';

// The source object type on the Gantt Task
export let GANTT_TASK_SOURCE_TYPE_EVENT = 'Event';

// stacked event offsets

export let GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS = {
    DAY: 3,
    WEEK: 12,
    MONTH: 48,
    QUARTER: 200,
    YEAR: 360
};

export let GANTT_MILLISECONDS_IN_HOUR = 3600000;

export let GANTT_TASK_HEIGHT_PER_LAYOUT = {
    COMFY: 12,
    COMPACT: 10
};

export default exports = {
    GANTT_TOOLTIP_TASK_STATUS,
    GANTT_TASK_STATUS_ICON_SIZE,
    GANTT_TASK_SOURCE_TYPE_EVENT,
    GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS,
    GANTT_MILLISECONDS_IN_HOUR,
    GANTT_TASK_HEIGHT_PER_LAYOUT
};
