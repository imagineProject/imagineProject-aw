// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeScrollService
 */

import _ from 'lodash';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import tableSvc from 'js/splmTablePublishedService';

let exports;

let _tableScrollBar = null;
let _ganttScrollBar = null;
let _isScrollSyncEnabled = false;

/**
 * Enables/disables the synchronization of Tree table and Gantt scroll bars.
 * @param {Boolean} enable Should enable synchronization of scroll bars ?
 */
export let enableScrollSync = ( enable ) => {
    _isScrollSyncEnabled = enable;
};

/**
 * @returns {Boolean} Is the the synchronization of Tree table and Gantt scroll bars enabled ?
 */
export let isScrollSyncEnabled = () => {
    return _isScrollSyncEnabled;
};

/**
 * @returns the scroll bar of the schedule navigation tree table.
 */
let getTableScrollBar = () => {
    let tableScrollBar = null;
    let scheduleNavigationTreeTable = schNavTreeUtils.getScheduleNavigationTreeTableElement();
    if( scheduleNavigationTreeTable ) {
        tableScrollBar = tableSvc.getTableScrollBar( scheduleNavigationTreeTable );
    }

    return tableScrollBar;
};

/**
 * @returns the scroll bar of the schedule navigation gantt chart.
 */
let getGanttScrollBar = () => {
    let ganttScrollBar = null;
    let scheduleNavigationGantt = schNavTreeUtils.getScheduleNavigationGanttElement();
    if( scheduleNavigationGantt ) {
        ganttScrollBar = scheduleNavigationGantt.getElementsByClassName( 'gantt_ver_scroll' )[ 0 ];
    }

    return ganttScrollBar;
};

/**
 * Scrolls the tree table based on the Gantt scrollbar position.
 */
export let scrollTable = ( ) => {
    let tableScrollBar = getTableScrollBar();
    let ganttScrollBar = getGanttScrollBar();
    if( tableScrollBar && ganttScrollBar &&  tableScrollBar.scrollTop !== ganttScrollBar.scrollTop ) {
        tableScrollBar.scrollTop = ganttScrollBar.scrollTop;
    }
};

/**
 * Scrolls the Gantt based on the tree table scrollbar position.
 */
export let scrollGantt = ( ) => {
    let tableScrollBar = getTableScrollBar();
    let ganttScrollBar = getGanttScrollBar();
    if( tableScrollBar && ganttScrollBar && tableScrollBar.scrollTop !== ganttScrollBar.scrollTop ) {
        ganttScrollBar.scrollTop = tableScrollBar.scrollTop;
    }
};

/**
 * Callback function to scroll the Gantt based on the tree table scroll position.
 *
 * @param {object} event object containing the scroll event information
 */
let scrollGanttCallbackFn = ( event ) => {
    if( !_isScrollSyncEnabled ) {
        return;
    }

    let ganttScrollBar = getGanttScrollBar();
    if( ganttScrollBar ) {
        ganttScrollBar.scrollTop = event.currentTarget.scrollTop;
    }
};

/**
 * Registers a scroll event listener to table scroll bar, to scroll the Gantt
 * based on the table scroll position.
 */
export let registerTable2GanttScrollSync = () => {
    _tableScrollBar = getTableScrollBar();

    if( _tableScrollBar ) {
        _tableScrollBar.addEventListener( 'scroll', scrollGanttCallbackFn );
    }
};

/**
 * Removes the scroll event listener from table scroll bar.
 */
export let unRegisterTable2GanttScrollSync = () => {
    if( _tableScrollBar ) {
        _tableScrollBar.removeEventListener( 'scroll', scrollGanttCallbackFn );
        _tableScrollBar = null;
    }
};

exports = {
    enableScrollSync,
    isScrollSyncEnabled,
    scrollTable,
    scrollGantt,
    registerTable2GanttScrollSync,
    unRegisterTable2GanttScrollSync
};

export default exports;
