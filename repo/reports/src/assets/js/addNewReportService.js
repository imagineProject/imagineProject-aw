// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Add Report related method execution only.
 *
 * @module js/addNewReportService
 */
import navigationUtils from 'js/navigationUtils';
import reportsCommonSrvc from 'js/reportsCommonService';
import _ from 'lodash';

var exports = {};

/**
 * Get Type value for new Report
 * @param {*} data -
 * @returns {int} repType - Type value
 */
export let getReportType = function( data ) {
    if( data.reportType.dbValue === 'AdvanceSummaryReport' || data.reportType === '0' ) {
        return 0;
    } else if( data.reportType.dbValue === 'AdvanceItemReport' || data.reportType === '1' ) {
        return 1;
    }
};

/**
 * @param  {any} data - the
 * @param  {any} selectedReport - selected report
 * @returns {any} encodedParamString
 */
export let getEscapedUrlParameters = function( selectedReport ) {
    var reportParam = {};
    reportParam.title = selectedReport.props.rd_name.dbValues;
    reportParam.reportId = selectedReport.props.rd_id.dbValues;
    reportParam.uid = selectedReport.uid;
    reportParam.configure = 'false';
    return navigationUtils.buildEncodedParamString( 'showReport', reportParam );
};

export let getNewReportId = function( response, reportId ) {
    let nwreportId = { ...reportId };
    nwreportId.dbValue = response.reportdefinitionIds[ 0 ].reportDefinitionId;
    nwreportId.uiValue = response.reportdefinitionIds[ 0 ].reportDefinitionId;
    return nwreportId;
};

export let  updateSearchStateWithUID = ( state, data ) => {
    var value = state.getValue();
    value.saveAsReportUID = data;
    state.update( value );
};

export let getSaveAsReportName = ( i18nName, replaceTxt, reportName )=>{
    let nwReportName = { ...reportName };
    let replacedName = i18nName.replace( '{0}', replaceTxt );
    nwReportName.dbValue = replacedName;
    nwReportName.uiValue = replacedName;
    nwReportName.dbValues[0] = replacedName;
    nwReportName.uiValues[0] = replacedName;
    nwReportName.valueUpdated = true;
    return nwReportName;
};

export const getSelectedObjects = ( selectedObjects ) => {
    let selectedObjectsList = [];
    _.forEach( selectedObjects, function( value ) {
        selectedObjectsList.push( reportsCommonSrvc.getUnderlyingObject( value ) );
    } );
    return selectedObjectsList;
};

export default exports = {
    getEscapedUrlParameters,
    getReportType,
    getNewReportId,
    updateSearchStateWithUID,
    getSaveAsReportName,
    getSelectedObjects
};
