// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link ddsCommonUtils}
 *
 * @module js/ddsCommonUtils
 */
import _ from 'lodash';

var exports = {};

/**
 * Create export option
 * @function createExportOptions
 * @param {String} name - name
 * @param {String} state - status
 * @return {Object} Export options
 */
export let createExportOptions = function(name, state) {
    let exportFileName = getExportExcelFileName(name, state);
    return {
        exportUID: 'true',
        excelExportFileName: exportFileName
    };
};

/**
 * Get the input search filter map
 * @function getExportExcelFileName
 * @param {String} name - data
 * @param {String} state - status
 * @return {String} Export excel file name
 */
let getExportExcelFileName = function(name, state) {
    // e.g FC_Fail_YYYYMMDDHHMMSS, where FC is file content

    // If FileContent, then it will return FC
    let nameAcronym = name ? name.match(/[A-Z]/g).join('') : '';
    // Remove space from state
    let newState = state ? state.replace(/ /g, "") : '';
    return `${nameAcronym}_${newState}_${getCurrentDate()}`;
};

/**
 * Get current date in YYYYMMDDHHMMSS format
 * @function getCurrentDate
 * @return {String} Input search Filter Map
 */
let getCurrentDate = function() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

export default exports = {
    createExportOptions
};
