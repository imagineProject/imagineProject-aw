// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/ScheduleManagerConstants
 */
var exports = {};

//Constant for ScheduleTask type
export let TASK_TYPE = {
    T: '0',
    M: '1',
    S: '2',
    P: '3',
    G: '4',
    L: '5',
    SS: '6',
    O: '7'
};

//Constant for ScheduleTask type
export let SCHEDULE_TYPE = {
    S: '0',
    M: '1',
    SUB: '2',
    MS: '3'
};

//Constant for Dependency type
export let DEPENDENCY_TYPE = {
    FS: 0,
    FF: 1,
    SS: 2,
    SF: 3,
    PG: 4
};

export let DEPENDENCY_TYPE_INT = {
    0: 'FS',
    1: 'FF',
    2: 'SS',
    3: 'SF',
    4: 'PG'
};

//Constant for Priority
export let PRIORITY = {
    0: 'Saw1PriorityLowest',
    1: 'Saw1PriorityLow',
    2: 'Saw1PriorityMediumLow',
    3: 'Saw1PriorityMedium',
    4: 'Saw1PriorityHigh',
    5: 'Saw1PriorityVeryHigh',
    6: 'Saw1PriorityHighest'
};

//Constant for Priority colors
export let BOARD_PRIORITY_COLORS = {
    0: '#006487',
    1: '#006487',
    2: '#55a0b9',
    3: '#55a0b9',
    4: '#EB780A',
    5: '#DC0000',
    6: '#DC0000'
};

//Constants for Resource Graph Columns values
export let DAY_CONSTANTS = {
    0: [ 0, 13 ], // Number of Previous Days from current date, Number of next Days from current Date
    1: [ 1, 12 ],
    2: [ 2, 11 ],
    3: [ 3, 10 ],
    4: [ 4, 9 ],
    5: [ 5, 8 ],
    6: [ 6, 7 ]
};

//Constant for Priority CSS classes
export let BOARD_PRIORITY_COLOR_CLASSES = {
    0: 'aw-schedulemanager-priorityLowest',
    1: 'aw-schedulemanager-priorityLow',
    2: 'aw-schedulemanager-priorityMediumLow',
    3: 'aw-schedulemanager-priorityMedium',
    4: 'aw-schedulemanager-priorityHigh',
    5: 'aw-schedulemanager-priorityVeryHigh',
    6: 'aw-schedulemanager-priorityHighest'
};

//Constants for Program View Filters Field Conditions
export let PROGRAM_VIEW_CONDITIONS_LIST = {
    2: [ 'Equal To', 'Not Equal To', 'Less Than', 'Greater Than', 'Between' ], //start_date,finish_date,actual_start_date,actual_finish_date
    3: [ 'Equal To', 'Not Equal To', 'Less Than', 'Greater Than', 'Less Than or equal To', 'Greater Than or equal To', 'Between' ], //complete_percent
    5: [ 'Equal To', 'Not Equal To', 'Less Than', 'Greater Than', 'Less Than or equal To', 'Greater Than or equal To', 'Between' ], //work_complete,duration,work_estimate,priority
    8: [ 'Equal To', 'Not Equal To' ], //object_desc,object_name,fnd0state,fnd0status
    14: [ 'Equal To', 'Not Equal To' ] //ResourceAssignment
};

//Constants for Program View Filters field widgte types
export let PROGRAM_VIEW_WIDGET_TYPE_LIST = {
    start_date: 'DATE',
    finish_date: 'DATE',
    actual_start_date: 'DATE',
    actual_finish_date: 'DATE',
    complete_percent: 'DOUBLE',
    work_complete: 'STRING',
    duration: 'STRING',
    work_estimate: 'STRING',
    ResourceAssignment: 'PANEL',
    object_desc: 'STRING',
    object_name: 'STRING',
    priority: 'LISTBOX',
    fnd0state: 'LISTBOX',
    fnd0status: 'LISTBOX'
};

//Constants for Value types and widget types for new fields to be added in RAC prefrence ProgramViewFilterProperties
export let PROGRAM_VIEW_VALUE_TYPE_TO_WIDGET_TYPE_LIST = {
    1: 'STRING',
    2: 'DATE',
    3: 'DOUBLE',
    4: 'STRING',
    5: 'INTEGER',
    6: 'BOOLEAN',
    7: 'INTEGER',
    8: 'STRING',
    9: 'STRING', //TypedReference
    10: 'STRING', //UnTypedReference
    11: 'STRING', //unknown
    12: 'STRING', //unknown
    13: 'STRING', //unknown
    14: 'STRING'
};

//Constants for Program View Filters Criteria Map
export let PROGRAM_VIEW_CRITERIA_TYPE_LIST = {
    'Equal To': 'equal',
    'Not Equal To': 'notEqual',
    'Less Than': 'lessThan',
    'Greater Than': 'greaterThan',
    'Less Than or equal To': 'lessThanOrEqualTo',
    'Greater Than or equal To': 'greaterThanOrEqualTo',
    Between: 'between'
};

//Constants for Program View Filters Criteria Map
export let PROGRAM_VIEW_CRITERIA_SYMBOL_LIST = {
    'Equal To': '=',
    'Not Equal To': '!=',
    'Less Than': '<',
    'Greater Than': '>',
    'Less Than or equal To': '<=',
    'Greater Than or equal To': '>='
};

//Constants for Program View Critera Internal Name to i18n key map
export let PROGRAM_VIEW_CRITERIA_i18n_KEY_MAP = {
    'Equal To': 'Saw1EqualTo',
    'Not Equal To': 'Saw1NotEqualTo',
    'Less Than': 'Saw1LessThan',
    'Greater Than': 'Saw1GreaterThan',
    'Less Than or equal To': 'Saw1LessThanOrEqTo',
    'Greater Than or equal To': 'Saw1GreaterThanOrEqTo',
    Between: 'Saw1Between'
};

//Constants for Program View Filters Criteria Map to Internal Names
export let PROGRAM_VIEW_CRITERIA_INTERNAL_NAME_LIST = {
    equal: 'Equal To',
    notEqual: 'Not Equal To',
    lessThan: 'Less Than',
    greaterThan: 'Greater Than',
    lessThanOrEqualTo: 'Less Than or equal To',
    greaterThanOrEqualTo: 'Greater Than or equal To',
    between: 'Between'
};

//Constants for Program View Filters Criteria Map
export let PROGRAM_VIEW_VALID_OBJECT_LIST = {
    Schedule: 'Schedule',
    'Schedule Task': 'ScheduleTask'
};

//Constants for Program View Filters Criteria Map
export let PROGRAM_VIEW_VALID_OBJECT_INTERNAL_NAME_LIST = {
    Schedule: 'Schedule',
    ScheduleTask: 'Schedule Task'
};
//Constants for the mapping of properties on task in program view to Gantt properties
export let PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING = {
    uid: 'id',
    object_name: 'text',
    start_date: 'start_date',
    finish_date: 'end_date',
    hasChildren: '$has_child'
};

//Constants for the mapping of properties on task in program view to Gantt properties
export let PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING = {
    id: 'uid',
    text: 'object_name',
    start_date: 'start_date',
    end_date: 'finish_date',
    $has_child: 'hasChildren'
};


//Constants for the mapping of properties on task in Schedule Gantt to DHX Gantt properties
export let SCHEDULE_GANTT_SERVER_PROPERTY_MAPPING = {
    uid: 'id',
    object_string: 'text',
    start_date: 'start_date',
    finish_date: 'end_date',
    hasChildren: '$has_child',
    fnd0ParentTask: 'parent'
};

//Constants for the mapping of properties on task in Schedule to  DHX Gantt properties
export let SCHEDULE_SERVER_GANTT_PROPERTY_MAPPING = {
    id: 'uid',
    text: 'object_string',
    start_date: 'start_date',
    end_date: 'finish_date',
    $has_child: 'hasChildren',
    parent: 'fnd0ParentTask'
};

export let PROGRAM_VIEW_DATE_FORMAT = 'yyyy-MM-dd HH:mm';

export let MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD = 'load';

export let MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD_USING_CONFIG = 'loadUsingInputConfig';

//Constants for the mapping of Schedule Task status and icon for graphical renderer
export let SCHEDULE_TASK_RENDERER_STATUS_ICON_MAP = {
    not_started: 'indicatorNotStarted16.svg',
    in_progress: 'indicatorInProgress16.svg',
    needs_attention: 'indicatorWarning16.svg',
    pending: 'indicatorPending16.svg',
    paused: 'indicatorPaused16.svg',
    unable_to_complete: 'indicatorUnableToComplete16.svg',
    late: 'indicatorDelayed16.svg',
    complete: 'indicatorCompleted16.svg',
    abandoned: 'indicatorAbandoned16.svg',
    aborted: 'indicatorAborted16.svg'
};

//Constants for the mapping of Schedule Task status and icon for graphical renderer
export let SCHEDULE_TASK_RENDERER_STATE_ICON_MAP = {
    not_started: 'indicatorNotStarted16.svg',
    in_progress: 'indicatorInProgress16.svg',
    complete: 'indicatorCompleted16.svg',
    closed: 'indicatorClosed16.svg',
    aborted: 'indicatorAborted16.svg'
};

//Constant for essential columns for Program view
export let PRG_VIEW_ESSENTIAL_COLUMNS = [ 'duration', 'complete_percent', 'work_estimate', 'work_complete', 'start_date', 'finish_date', 'task_type' ];

//Constant for Program View default column
export let PRG_VIEW_DEFAULT_COLUMN = 'ProgramView.object_name';

//Constant for essential columns for Program view
export let SCH_GANTT_ESSENTIAL_COLUMNS = [ 'uid', 'object_string', 'duration', 'complete_percent', 'work_estimate', 'work_complete', 'start_date', 'finish_date', 'task_type', 'fnd0status', 'ResourceAssignment', 'fnd0WhatIfMode', 'fnd0WhatIfData' ];

//Constant for list of properties to fetch internal values
export let SCH_GANTT_PROPS_FOR_INTERNAL_VAL = [ 'start_date', 'finish_date', 'fnd0WhatIfMode', 'fnd0WhatIfData' ];

//Constants for decorator style of view baseline
export let VIEW_BASELINE_DECORATOR_STYLE = {
    0: 'saw1-border-chartColor1',
    1: 'saw1-border-chartColor2',
    None: ''
};

export default exports = {
    TASK_TYPE,
    SCHEDULE_TYPE,
    DEPENDENCY_TYPE,
    DEPENDENCY_TYPE_INT,
    PRIORITY,
    BOARD_PRIORITY_COLORS,
    BOARD_PRIORITY_COLOR_CLASSES,
    PROGRAM_VIEW_CONDITIONS_LIST,
    PROGRAM_VIEW_WIDGET_TYPE_LIST,
    PROGRAM_VIEW_VALUE_TYPE_TO_WIDGET_TYPE_LIST,
    PROGRAM_VIEW_CRITERIA_TYPE_LIST,
    PROGRAM_VIEW_CRITERIA_SYMBOL_LIST,
    PROGRAM_VIEW_CRITERIA_i18n_KEY_MAP,
    PROGRAM_VIEW_CRITERIA_INTERNAL_NAME_LIST,
    PROGRAM_VIEW_VALID_OBJECT_LIST,
    PROGRAM_VIEW_VALID_OBJECT_INTERNAL_NAME_LIST,
    PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING,
    PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING,
    SCHEDULE_GANTT_SERVER_PROPERTY_MAPPING,
    SCHEDULE_SERVER_GANTT_PROPERTY_MAPPING,
    PROGRAM_VIEW_DATE_FORMAT,
    MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD,
    MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD_USING_CONFIG,
    SCHEDULE_TASK_RENDERER_STATUS_ICON_MAP,
    SCHEDULE_TASK_RENDERER_STATE_ICON_MAP,
    PRG_VIEW_ESSENTIAL_COLUMNS,
    PRG_VIEW_DEFAULT_COLUMN,
    SCH_GANTT_ESSENTIAL_COLUMNS,
    DAY_CONSTANTS,
    SCH_GANTT_PROPS_FOR_INTERNAL_VAL,
    VIEW_BASELINE_DECORATOR_STYLE
};
