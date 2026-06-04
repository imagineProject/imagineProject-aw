// Copyright (c) 2023 Siemens

/**
 * @module js/awPanelHeaderSectionService
 */
import uwPropertyService from 'js/uwPropertyService';

var exports = {};


let _getUpdatedHeaderSectionElements = function( headerElementArray, populatedHeaderSectionElements ) {
    let headerSectionElements = populatedHeaderSectionElements;
    if( headerElementArray?.length > 0 ) {
        headerSectionElements = [];
        for( let i = 0; i < headerElementArray.length; i++ ) {
            let vmProp = uwPropertyService.createViewModelProperty( headerElementArray[i], '', 'STRING', '', '' );
            vmProp.uiValue = headerElementArray[i].props.object_string.uiValues[0];
            headerSectionElements.push( vmProp );
        }
    }
    return headerSectionElements;
};

/**
* Update data from props when panel loading
* @param {Object} headerLabelToUpdate header label to update
* @param {Object} headerElementToUpdate header element to update
* @param {Object} headerHintDisplayNameToUpdate header hint display name to update
* @param {Object} headerHintValueToUpdate header hint value to update
* @param {Object} headerElementArray header element array to update.
* @param {Object} populatedHeaderSectionElements populated header section elements
* @return {Object} any
*/
export function updateDataFromProps( headerLabelToUpdate, headerElementToUpdate, headerHintDisplayNameToUpdate, headerHintValueToUpdate, headerElementArray, populatedHeaderSectionElements ) {
    let headerHintLabelPosition = headerHintDisplayNameToUpdate ? 'PROPERTY_LABEL_AT_SIDE' : 'NO_PROPERTY_LABEL';
    let updatedHeaderSectionElements = _getUpdatedHeaderSectionElements( headerElementArray, populatedHeaderSectionElements );

    return { headerLabel: headerLabelToUpdate,
        headerElement: headerElementToUpdate,
        headerHintDispName: headerHintDisplayNameToUpdate,
        headerHintValue: headerHintValueToUpdate,
        headerHintLabelDisplay: headerHintLabelPosition,
        headerSectionElements: updatedHeaderSectionElements
    };
}

/**
* Toggle show more flag for header section elements
* @param {boolean} showMoreFlag more flag
* @return {boolean} showMoreFlag
*/
export function toggleShowMoreFlagForHeaderSectionElements( showMoreFlag ) {
    return !showMoreFlag;
}

/**
* Initializes params before loading ACE panel
* @param {Object} headerSectionString I18 header section string
* @param {Object} selectedObjects number of object selected
* @return {String} headerSectionString
*/
export let getHeaderSectionTitle = function( headerSectionString, selectedObjects ) {
    if( headerSectionString ) {
        if( selectedObjects.length > 1 ) {
            headerSectionString = headerSectionString.replace( '{0}', selectedObjects.length );
        } else {
            headerSectionString = selectedObjects[0].props.object_string.uiValues[0];
        }
    }
    return headerSectionString;
};

export default exports = {
    updateDataFromProps,
    toggleShowMoreFlagForHeaderSectionElements,
    getHeaderSectionTitle
};
