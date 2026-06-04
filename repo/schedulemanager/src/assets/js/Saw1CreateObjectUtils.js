// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1CreateObjectUtils
 */
import _ from 'lodash';
import dateTimeSvc from 'js/dateTimeService';

let exports;

/**
 * Updates the addPanelState with the newly created object.
 * @param {*} createdObject The created object
 * @param {*} addPanelState The addPanelState atomic data
 */
export let setCreatedObjectOnState = ( createdObject, addPanelState ) => {
    if( addPanelState && createdObject ) {
        let newAddPanelState = { ...addPanelState };
        if( Array.isArray( createdObject ) ) {
            newAddPanelState.createdObject = [ ...createdObject ];
        } else {
            newAddPanelState.createdObject = { ...createdObject };
        }
        return newAddPanelState;
    }
};

/**
 * Returns the source schedule (new/palette/search) to relate.
 * @param {*} addPanelState The addPanelState atomic data
 */
export let getSourceObjectsForPasteOperation = ( addPanelState ) => {
    let sourceObjects = [];
    if( addPanelState ) {
        if( addPanelState.selectedTab.tabKey === 'new' ) {
            if( Array.isArray( addPanelState.createdObject ) ) {
                sourceObjects = addPanelState.createdObject;
            } else {
                sourceObjects = [ addPanelState.createdObject ];
            }
        } else {
            sourceObjects = addPanelState.sourceObjects;
        }
    }
    return sourceObjects;
};

/**
 * Sets the date as start of finish time of a day.
 * @param {*} date the given date
 * @param {*} isFinishDate if true, set the hours as end of working day i.e.17.
 */
export let resetTimeForDate = ( date, isFinishDate ) => {
    let hours = 8;
    if( isFinishDate ) {
        hours = 17;
    }
    date.setHours( hours );
    date.setMinutes( 0 );
    date.setSeconds( 0 );
    return date;
};

/**
 * Get the property value
 *
 * @param {Object} vmProp - View model property
 * @return {String} value - The value as string
 */
export let getValueAsString = ( vmProp ) => {
    if( vmProp.type === 'DATE' ) {
        return dateTimeSvc.formatUTC( vmProp.dbValue );
    }

    let value = vmProp.dbValue;
    if( !_.isUndefined( value ) && !_.isNull( value ) ) {
        return value.toString();
    }
    return '';
};

exports = {
    setCreatedObjectOnState,
    getSourceObjectsForPasteOperation,
    resetTimeForDate,
    getValueAsString
};

export default exports;
