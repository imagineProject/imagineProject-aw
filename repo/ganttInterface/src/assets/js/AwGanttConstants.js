// Copyright (c) 2022 Siemens

/**
 * @module js/AwGanttConstants
 */
let exports = {};

// stacked event offsets

export let GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS = {
    DAY: 3,
    WEEK: 12,
    MONTH: 48,
    QUARTER: 200,
    YEAR: 360
};

export let GANTT_MILLISECONDS_IN_HOUR = 3600000;

export let GANTT_SHOW_MAX_OBJECTS_IN_POPUP = 3;

export default exports = {
    GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS,
    GANTT_MILLISECONDS_IN_HOUR,
    GANTT_SHOW_MAX_OBJECTS_IN_POPUP
};
