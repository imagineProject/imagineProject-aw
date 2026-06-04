// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Item Report Configuration related method execution only.
 *
 *
 * @module js/configureItemReportService
 */
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import popUpSvc from 'js/popupService';
import localeService from 'js/localeService';

var exports = {};

/**
 * Prepare and send segment tree.
 * TODO: Refactor to handle Segment tree creation from Context. Remove duplicate loop.
 *
 * @param {*} data -
 */
export let updateSegmentTree = function( nwReportsState ) {
    var localTextBundle = localeService.getLoadedText( 'ReportChartMessages' );
    var rootType;
    if( nwReportsState ) {
        rootType = nwReportsState.rootClassSampleObject.length > 0 ? nwReportsState.rootClassSampleObject[0].modelType.displayName : '';
    } else {
        rootType = nwReportsState.reportParameters.rootObjectSelected.props.object_string.dbValues[0];
    }
    var tree = {
        label: rootType + ' (' + localTextBundle.parentSource + ')',
        value: rootType + ' (' + localTextBundle.parentSource + ')',
        expanded: true,
        children: []
    };

    let nextNode = null;

    if( nwReportsState.reportParameters.ReportDefProps && nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams ) {
        _.forEach( nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams, function( segment, index ) {
            var node = {};
            node.label = segment.TreeVal;
            node.searchFilterMap = segment.searchFilterMap;
            node.searchFilterMapCount = segment.searchFilterMap ? Object.keys( segment.searchFilterMap ).length : 0;
            node.value = segment.TreeVal + index;
            node.uid = index;
            node.expanded = true;
            node.children = [];
            if( index === 0 ) {
                tree.children.push( node );
                nextNode = {
                    children: node.children
                };
            } else {
                nextNode.children.push( node );
                nextNode = node;
            }
        } );
    }
    if( nwReportsState ) {
        nwReportsState.segmentTree = [ _.clone( tree ) ];
    }
    return [ tree ];
};

export let showEditReportCriteria = ( popupData, commandData, reportsState ) => {
    var deferred = AwPromiseService.instance.defer();
    popupData.subPanelContext = {};
    popupData.subPanelContext.revRuleLovList = commandData.revRuleLovList;
    popupData.subPanelContext.reportsState = reportsState;
    var reportSearchCriteriaStr = reportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
    var reportSearchCriteria = JSON.parse( reportSearchCriteriaStr );
    if( reportSearchCriteria.relationsPath && reportSearchCriteria.relationsPath.length > 0 && reportSearchCriteria.relationsPath[0].searchMethod === 'BOM' ) {
        var appliedRevRule = reportSearchCriteria.relationsPath[0].revisionRule === '' ? appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0] : reportSearchCriteria.relationsPath[0].revisionRule;
        popupData.subPanelContext.appliedRevRuleObj = _.find( commandData.revRuleLovList, ( revRuleObj ) => {
            return revRuleObj.propDisplayValue === appliedRevRule;
        } );
    }
    popUpSvc.show( popupData ).then( ( id ) => {
        let nwReportsState = reportsState.getValue();
        nwReportsState.criteriaPopupId = id;
        reportsState.update( nwReportsState );
        deferred.resolve( {} );
    } );
    return deferred.promise;
};

export let saveEditReportCriteria = ( revRuleProp, reportsState )  => {
    var newRevRule = revRuleProp.displayValues[0];
    setCtxPayloadRevRule( newRevRule, reportsState );
};

export let getRevRuleLovListFromLovValues = ( responseData ) => {
    var revRuleLovList = [];
    if( responseData && responseData.lovValues && responseData.lovValues.length > 0 ) {
        responseData.lovValues.map( ( revRuleObj ) => {
            if( revRuleObj.propDisplayValues && revRuleObj.propDisplayValues.object_name ) {
                var revRuleVMObj = {
                    propDisplayValue: revRuleObj.propDisplayValues.object_name[ 0 ],
                    propInternalValue: revRuleObj.uid,
                    dispValue: revRuleObj.propDisplayValues.object_name[ 0 ]
                };
                revRuleLovList.push( revRuleVMObj );
            }
        } );
    }
    return revRuleLovList;
};

export let updateRevisionRuleLabel = ( appliedRevRule, i18n, reportsState ) => {
    var newAppliedRevRule = _.clone( appliedRevRule );
    var searchCriteriaStr  = reportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
    if( searchCriteriaStr && searchCriteriaStr.includes( 'searchMethod\":\"BOM' ) ) {
        var searchCriteriaJSON = JSON.parse( searchCriteriaStr );
        var relationsPath = _.find( searchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        var revRule = relationsPath.revisionRule ? relationsPath.revisionRule : appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0];
        // if applied rev-rule will be different than current rev-rule, refresh table
        if( appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0] !== revRule ) {
            let nwReportsState = reportsState.getValue();
            nwReportsState.initRepDisp = true;
            reportsState.update( nwReportsState );
        }
        newAppliedRevRule.uiValue = i18n.appliedRevRule + ': ' + revRule;
        newAppliedRevRule.dbValue = i18n.appliedRevRule + ': ' + revRule;
    }
    return newAppliedRevRule;
};

let setCtxPayloadRevRule = ( newRevRule, reportsState ) => {
    var nwReportsState = reportsState.getValue();
    if ( nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo ) {
        let existingSearchCriteiraString = nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
        let existingSearchCriteriaJSON = {};
        try {
            existingSearchCriteriaJSON = JSON.parse( existingSearchCriteiraString );
        } catch( e ) {
            //Incorrect data, don't set revRule
            return;
        }
        let bomSegIndex =  _.findIndex( existingSearchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        if( bomSegIndex >= 0 && existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule !== newRevRule ) {
            nwReportsState.initRepDisp = true;
        }
        if( bomSegIndex >= 0 && appCtxService.ctx.sublocation.historyNameToken !== 'createReportTemplate' ) {
            existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule = newRevRule;
        } else if( bomSegIndex >= 0 ) {
            existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule = '';
        }
        nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria = JSON.stringify( existingSearchCriteriaJSON );
    }
    reportsState.update( nwReportsState );
};

/**
 * Service variable initialization
/**
 * @param {any} appCtxService - the
 * @param  {any} listBoxService - the
 *
 * @returns {any} exports - the Exports.
 */
export default exports = {
    updateSegmentTree,
    showEditReportCriteria,
    saveEditReportCriteria,
    getRevRuleLovListFromLovValues,
    updateRevisionRuleLabel
};
