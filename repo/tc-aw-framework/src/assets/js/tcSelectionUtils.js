// Copyright (c) 2024 Siemens

/**
 * @module js/tcSelectionUtils
 */

let exports = {};

/**
 * Function which returns selected object
 * @param {OBJECT} contextSelectionData - user selected object
 * @param {OBJECT} selected - user selected object
 * @return {OBJECT} returns user selectedObj
 */
export let getSourceObject = ( contextSelectionData, selected ) => {
    if ( contextSelectionData?.selected ) {
        return contextSelectionData.selected[0];
    }
    return selected;
};

/**
 * Function which returns selected objects
 * @param {OBJECT} contextSelectionData - user selected object
 * @param {OBJECTARRAY} mselected - user selected objects
 * @return {OBJECT} returns user selectedObjs
 */
export let getSourceObjects = ( contextSelectionData, mselected ) => {
    if ( contextSelectionData?.selected ) {
        return contextSelectionData.selected;
    }
    return mselected;
};

export default exports = {
    getSourceObject,
    getSourceObjects
};
