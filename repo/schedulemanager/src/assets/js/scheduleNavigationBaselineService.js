// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationBaselineService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';

let exports;

/**
 * Prepares the input info for the load baseline SOA
 * @param {String} schedule the owning schedule of the baseline
 * @param {String} baselines the baselines UIDS
 * @param {Array} treeNodes objects in the tree to fetch the baselines for
 * @returns baseline input info.
 */
export let getLoadBaselineInput = ( schedule, baselines, treeNodes ) => {

    var baseline = {
        type: 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };

    let loadBaselineInfo = {
        sourceSchedule: schedule,
        baselineSchedule: baseline, // empty
        scheduleTasks: [],
        loadOptions: {
            baselineUids: baselines.map( baseline => baseline.uid ).join( ',' )
        }
    };

    // Filter out non-ScheduleTask objects e.g. ProxyTask, as they are not baselined.
    let scheduleTaskObjects = _.transform( treeNodes, ( result, node ) => {
        let modelObject = cdm.getObject( node.uid );
        if( cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) ) {
            result.push( modelObject );
        }
    }, [] );

    loadBaselineInfo.scheduleTasks = scheduleTaskObjects;

    return loadBaselineInfo;
};

export let prepareLoadBaselinesInput = function( schedule, baselines, treeNodes ) {
    let baselineArr = [];
    for( let i = 0; i < baselines.length; i++ ) {
        baselineArr.push( cdm.getObject( baselines[ i ].uid ) );
    }

    let loadBaselines = {
        sourceSchedule: schedule,
        baselineSchedules: baselineArr,
        scheduleTasks: [],
        loadOptions: {}
    };

    // Filter out non-ScheduleTask objects e.g. ProxyTask, as they are not baselined.
    let scheduleTaskObjects = _.transform( treeNodes, ( result, node ) => {
        let modelObject = cdm.getObject( node.uid );
        if( cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) ) {
            result.push( modelObject );
        }
    }, [] );

    loadBaselines.scheduleTasks = scheduleTaskObjects;

    return loadBaselines;
};


exports = {
    getLoadBaselineInput,
    prepareLoadBaselinesInput
};

export default exports;
