// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/ScheduleNavigationDependencyCacheService
 */
import appCtxService from 'js/appCtxService';

var exports = {};

/**
 * Register dependency managment related maps
 */
export let registerMaps = function() {
    appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache = {
        taskUidToPredDependencyMap : {},
        taskUidToSuccDependencyMap : {}
    };
};

/**
 * Add Dependency To Predecessor Dependency Map 
 *
 * @param {string} taskUid - Uid of Task
 * @param {string Array} dependencyUids - Array of dependency uids
 * @param {string} displayValues - Predecessor Display Value 
 */
export let addToTaskPredDependencyMap = function( taskUid, dependencyUids, displayValues ) {
    var predDependency = {
        dependencyUids:dependencyUids,
        displayValues:displayValues
    };
    if( appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap ) {
        appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap[ taskUid ] = predDependency;
    }
};

/**
 * Get Dependency From Predecessor Dependency Map 
 *
 * @param {string} taskUid - Uid of Task
 * @return {Dependency} dependency - Returns dependency for Uid
 */
export let getTaskPredDependencies = function( taskUid ) {
    if( appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache ) {
        let taskUidToPredDependencyMap = appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap;
        if( taskUidToPredDependencyMap && taskUidToPredDependencyMap[ taskUid ] ) {
            return taskUidToPredDependencyMap[ taskUid ];
        }
        return [];
    }
    return [];
};

/**
 * Add Dependency To Successor Dependency Map 
 *
 * @param {string} taskUid - Uid of Task
 * @param {string Array} dependencyUids - Array of dependency uids
 * @param {string} displayValues - Successor Display Value 
 */
export let addToTaskSuccDependencyMap = function( taskUid, dependencyUids, displayValues ) {
    var succDependency = {
        dependencyUids:dependencyUids,
        displayValues:displayValues
    };
    if( appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap ) {
        appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap[ taskUid ] = succDependency;
    }
};

/**
 * Get Dependency From Successor Dependency Map 
 *
 * @param {string} taskUid - Uid of Task
 * @return {Dependency} dependency - Returns dependency for Uid
 */
export let getTaskSuccDependencies = function( taskUid ) {
    if( appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache ) {
        let taskUidToSuccDependencyMap = appCtxService.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap;
        if( taskUidToSuccDependencyMap && taskUidToSuccDependencyMap[ taskUid ] ) {
            return taskUidToSuccDependencyMap[ taskUid ];
        }
        return [];
    }
    return [];
};

export default exports = {
    addToTaskPredDependencyMap,
    getTaskSuccDependencies,
    addToTaskSuccDependencyMap,
    getTaskPredDependencies,
    registerMaps
};
