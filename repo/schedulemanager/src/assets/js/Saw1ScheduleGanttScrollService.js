// Copyright (c) 2022 Siemens

import eventBus from 'js/eventBus';
import ganttLayoutService from 'js/Saw1ScheduleGanttLayoutService';

let _awSubscriptions = [];
let _tableScrollBar = null;
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
    if( !_tableScrollBar ) {
        _tableScrollBar = document.querySelector( '#scheduleNavigationTree .aw-splm-tableViewport' );
    }
    return _tableScrollBar;
};

/**
 * @returns the scroll bar of the schedule navigation gantt chart.
 */
let getGanttScrollBar = () => {
    return document.querySelector( '#scheduleNavigationGantt .gantt_ver_scroll' );
};

/**
 * Scrolls the tree table based on the Gantt scrollbar position.
 */
export let scrollTable = () => {
    if( !_isScrollSyncEnabled ) {
        return;
    }
    let tableScrollBar = getTableScrollBar();
    let ganttScrollBar = getGanttScrollBar();
    if( tableScrollBar && ganttScrollBar && tableScrollBar.scrollTop !== ganttScrollBar.scrollTop ) {
        tableScrollBar.scrollTop = ganttScrollBar.scrollTop;
    }
};

/**
 * Scrolls the Gantt based on the tree table scrollbar position.
 */
export let scrollGantt = () => {
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
    let tableScrollBar = getTableScrollBar();
    let ganttScrollBar = getGanttScrollBar();
    if( ganttScrollBar && tableScrollBar && ganttScrollBar.scrollTop !== tableScrollBar.scrollTop ) {
        ganttScrollBar.scrollTop = tableScrollBar.scrollTop;
    }
};

/**
 * Registers a scroll event listener to table scroll bar, to scroll the Gantt
 * based on the table scroll position.
 */
export let registerTableGanttScrollSync = () => {
    _tableScrollBar = getTableScrollBar();
    if( _tableScrollBar ) {
        _tableScrollBar.addEventListener( 'scroll', scrollGanttCallbackFn );
    }

    _awSubscriptions.push( eventBus.subscribe( 'aw.windowResize', () => {
        let ganttEl = document.getElementById( 'scheduleNavigationGantt' );
        if( ganttEl ) {
            ganttLayoutService.debounceResetGanttRowHeight( ganttEl.gantt );
        }
    } ) );
};

/**
 * Removes the scroll event listener from table scroll bar.
 */
export let unRegisterTableGanttScrollSync = () => {
    if( _tableScrollBar ) {
        _tableScrollBar.removeEventListener( 'scroll', scrollGanttCallbackFn );
        _tableScrollBar = null;
    }
    for( const awEvent of _awSubscriptions ) {
        eventBus.unsubscribe( awEvent );
    }
    _awSubscriptions = [];
    _isScrollSyncEnabled = false;
};

export default {
    enableScrollSync,
    isScrollSyncEnabled,
    scrollTable,
    scrollGantt,
    registerTableGanttScrollSync,
    unRegisterTableGanttScrollSync
};
