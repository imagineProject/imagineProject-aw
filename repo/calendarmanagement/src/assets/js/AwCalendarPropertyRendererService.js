// Copyright (c) 2022 Siemens

/**
 * @module js/AwCalendarPropertyRendererService
 */

var exports = {};

/**
   * Working days table cell rendering function.
   *
   * @param {Object} vmo - view model object
   * @param {Object} containerElem - table cell
   * @param {Object} columnName - the column name
   */
export let workingDaysGridCellRendererFn = function( vmo, containerElem, columnName ) {
    let colData = vmo.props[columnName];
    containerElem.className = 'aw-working-hours';
    let objSpan = document.createElement( 'div' );
    containerElem.title = colData.uiValue;
    objSpan.innerHTML = colData.uiValue;
    objSpan.className = 'aw-splm-tableCellText';
    if( vmo.props.totalHours.displayValue === '00:00' ) {
        containerElem.className = 'aw-non-working-hours';
    }
    containerElem.appendChild( objSpan );
};

exports = {
    workingDaysGridCellRendererFn
};

export default exports;
