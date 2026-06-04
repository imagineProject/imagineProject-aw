//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/* global Gantt gantt */

/**
 * @module js/uiGanttManager
 */
 import { gantt, Gantt } from '@swf/dhtmlxgantt';

var exports = {};
var _instance = null;
var _watchDeregistrationfn = null;
var isWhatIfSessionStarted = true;
var _columnDefs = [];
var selectedLink = null;

/**
 * getter to get selected link uid.
 *
 * @return uid of selected link.
 */
export let getSelectedLink = function() {
    return selectedLink;
};

/**
 * setter to set selected link uid.
 */
export let setSelectedLink = function( link ) {
    selectedLink = link;
};

/**
 * Method for providing the singleton access for the gantt instance.
 *
 * @return The gantt instance.
 */
export let getGanttInstance = function() {
    if( !_instance ) {
        _instance = Gantt.getGanttInstance();
    }
    return _instance;
};

/**
 * Method to check if a gantt instance exists.
 *
 * @return true if a gantt instance exists; false otherwise.
 */
export let isGanttInstanceExists = function() {
    return Boolean( _instance );
};

/**
 * Method for getting the flag when what If Session started and the current user is the Lock Owner.
 *
 * @return {boolean} isWhatIfSessionStarted - The flag for what if session.
 */
export let getFlagForWhatIf = function() {
    return isWhatIfSessionStarted;
};

/**
 * Method for setting the flag of whatIfSession and Lock owner details.
 *
 * @param {boolean} whatIfflag - The value will be true when what if session started or the Lock owner is same as
 *            the current user, false when what if session ends or the current user is not same as Lock Owner.
 *
 */
export let setFlagForWhatIf = function( whatIfflag ) {
    isWhatIfSessionStarted = whatIfflag;
};

/**
 * Method for providing the localised value for the gantt instance.
 *
 * @param {object} date - The localised value of calendar.
 * @param {object} labels - The other lables that are used in Gantt.
 */
export let setLocalisedValues = function( date, labels ) {
    gantt.locale.date = date;
};

/**
 * Method for cleanup of the gantt instance. Also de registers all the gantt watch functions.
 *
 */
export let destroyGanttInstance = function() {
    if( _instance ) {
        _instance.destructor();
    }
    _instance = null;
    if( _watchDeregistrationfn ) {
        _watchDeregistrationfn();
    }
    this.startPaginate = null;
    selectedLink = null;
};

/**
 * Method for setting the watch deregister callback.
 *
 * @param {object} listener - The watch de registration function.
 */
export let setWatchDeregistration = function( listener ) {
    _watchDeregistrationfn = listener;
};

/**
 * Method for formatting date from the GWT date string.
 *
 * @param {sting} dateStr - The date string to format.
 */
export let formatDate = function( dateStr ) {
    var ua = window.navigator.userAgent;
    if( ua.indexOf( 'MSIE' ) !== -1 || navigator.appVersion.indexOf( 'Trident/' ) > 0 ||
        navigator.appVersion.indexOf( 'Safari/' ) > 0 ) {
        /* Microsoft Internet Explorer or Safari detected. */
        var a = dateStr.split( ' ' );
        var d = a[ 0 ].split( '-' );
        var t = a[ 1 ].split( ':' );
        var date = new Date( d[ 0 ],  d[ 1 ] - 1, d[ 2 ], t[ 0 ], t[ 1 ] );
        return date.toGMTString();
    }
    return dateStr;
};

/**
 * Writes the message to the console.
 *
 * @param {string} msg - The message to write to console.
 */
export let debugMessage = function( msg ) {
    console.log( msg );
};

/**
 * Method for getting the columns of the gantt.
 *
 * @return columnsDefs.
 */
export let getColumnDefs = function() {
    return _columnDefs;
};

/**
 * Method for setting the columns of the gantt.
 *
 * @param columnDefs -The value of column definitions of gantt.
 *
 */
export let setColumnDefs = function( columnDefs ) {
    _columnDefs = columnDefs;
};

export default exports = {
    getSelectedLink,
    setSelectedLink,
    getGanttInstance,
    isGanttInstanceExists,
    getFlagForWhatIf,
    setFlagForWhatIf,
    setLocalisedValues,
    destroyGanttInstance,
    setWatchDeregistration,
    formatDate,
    debugMessage,
    getColumnDefs,
    setColumnDefs
};
