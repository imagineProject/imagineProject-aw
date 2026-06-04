// Copyright (c) 2024 Siemens

/**
 *
 * @module js/viewerPvwVisualReportLegendService
 */

import _ from 'lodash';
let exports = {};


/**
 * Initialize visual report legend component
 * @param {Object} viewerContextData viewer Context data
 * @returns {Object} object which contains PLMVisWeb handle and PLMVisWeb viewer instance created in JSCOM
 */
let initializeVisualReportLegend = ( viewerContextData ) => {
    let data = viewerContextData.getAfxPVWInitializationValues();

    return {
        PLMVisWeb: data.PLMVisWeb,
        viewer: data.viewer
    };
};



export default exports = {

    initializeVisualReportLegend
};
