// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0SettingsUtilsService
 */
import uwPropertyService from 'js/uwPropertyService';
import lbs from 'js/listBoxService';
import 'js/viewModelObjectService';

var exports = {};

/**
 * Get settings lov list if the list has a lov_values prop the way the settings properties have
 *
 * @param {Object} response - The 'response' object from server in lov form.
 * @return {Object} lov list
 */
export let getSettingsLovList = function( response ) {
    var settingsList = [];
    if( response.lovValues ) {
        for( var lovValRow in response.lovValues ) {
            if( response.lovValues.hasOwnProperty( lovValRow ) ) {
                var exp = response.lovValues[ lovValRow ].propDisplayValues.lov_values[ 0 ];
                settingsList.push( exp );
            }
        }
    }
    return lbs.createListModelObjectsFromStrings( settingsList );
};

/**
 * Gets the corresponding lov uid for a value
 *
 * @param {object} lov - the lov
 * @param {string} val - the lov value
 * @return {int} uid
 */
export let getLovUid = function( lov, val ) {
    var uid;
    if( lov.lovValues ) {
        for( var lovValRow in lov.lovValues ) {
            if( lov.lovValues.hasOwnProperty( lovValRow ) && lov.lovValues[ lovValRow ].propDisplayValues.lov_values[ 0 ] === val ) {
                uid = lov.lovValues[ lovValRow ].uid;
                break;
            }
        }
    }
    return uid;
};

/**
 * converts a String Model Property Into a VMProperty
 *
 * @param {Object} currentProp - The 'currentProp'
 * @return {Object} VMProperty for UI use
 */
export let convertStringModelPropertyIntoVMProperty = function( currentProp ) {
    var VMProperty = uwPropertyService.createViewModelProperty(
        currentProp.dbValues[ 0 ],
        currentProp.uiValues[ 0 ], 'STRING', currentProp.dbValues[ 0 ], '' );
    VMProperty.uiValue = currentProp.uiValues[ 0 ];
    VMProperty.classData = currentProp;
    return VMProperty;
};

/**
 * creates a VMProperty from a LOVEntry
 *
 * @param {String} lovEntry - The list of value entry
 * @return {Object} VMProperty for UI use
 */
export let convertLOVEntryIntoVMProperty = function( lovEntry ) {
    var VMProperty = uwPropertyService.createViewModelProperty(
        lovEntry.uid,
        lovEntry.propDisplayValues.lov_values[ 0 ], 'STRING', lovEntry.uid, '' );
    VMProperty.uiValue = lovEntry.propDisplayValues.lov_values[ 0 ];
    VMProperty.classData = '';
    return VMProperty;
};

/**
 * Revision Rule Configuration service utility
 * @param {Object} uwPropertyService - The uwPropertyService
 * @param {Object} lbs - The list box service
 * @return {Object} exports
 */

export default exports = {
    getSettingsLovList,
    getLovUid,
    convertStringModelPropertyIntoVMProperty,
    convertLOVEntryIntoVMProperty
};
