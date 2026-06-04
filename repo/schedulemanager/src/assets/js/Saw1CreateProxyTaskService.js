// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/Saw1CreateProxyTaskService
 */

import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/**
   * Return the UID of the schedule of the selected task, if select task is schedule, return the schedule uid
   *
   * @param {object} selectedObj - The selected object
   * @return {object} uid of schedule - the UID of the selected schedule or the schedule of the selected task.
   *
   */
export let getScheduleUid = function( selectedObj ) {
    if( cmm.isInstanceOf( 'Schedule', selectedObj.modelType ) ) {
        return selectedObj.uid;
    } else if( cmm.isInstanceOf( 'ScheduleTask', selectedObj.modelType ) ) {
        return selectedObj.props.schedule_tag.dbValues[ 0 ];
    }
};

/**
  * Return New Proxy Task COntainers based on selected tab.
  * @param {object} data - data object
  * @param {object} ctx - ctx object
  * @returns {object} new proxy task containers containing an array of new proxy task inputs.
  */
export let createNewProxyTaskContainersFromTab = function( data, ctx ) {
    let proxyTaskContainers = [];
    let selectedObjs = [];
    if( data.addPanelState.selectedTab &&
         ( data.addPanelState.selectedTab.view === 'SearchTabPageSub' || data.addPanelState.selectedTab.view === 'PaletteTabPageSub' ) ) {
        selectedObjs = data.addPanelState.sourceObjects;
    }

    for ( let index = 0; index < selectedObjs.length; index++ ) {
        proxyTaskContainers.push( {
            schedule: ctx.pselected,
            sublevels: 0,
            taskTag: selectedObjs[ index ],
            refTag: ctx.selected
        } );
    }

    return proxyTaskContainers;
};

/**
   * Process response from SOA create proxy operation and return list of new proxy task objects.
   * @param {object} response - SOA operation response.
   * @returns list of proxy task objects.
   */
export let getCreatedProxyTasks = function( response ) {
    let proxyTasks = [];
    if( response && response.responses ) {
        for ( let index = 0; index < response.responses.length; index++ ) {
            proxyTasks.push( response.responses[index].proxyTask );
        }
    }
    return proxyTasks;
};


/**
   * Update search state with custom data provider and search details
   * @returns {searchState}
   */
export const initializeSearchState = ( searchContentType, searchString, dataProviderName, masterSchedule ) => {
    const newSearchState = {};

    newSearchState.criteria = {
        searchContentType: searchContentType,
        searchString: searchString,
        masterSchedule:masterSchedule
    };
    var searchFilterMap = {
        'WorkspaceObject.object_type': []
    };
    newSearchState.activeFilterMap = searchFilterMap;
    newSearchState.sourceSearchFilterMap = searchFilterMap;
    newSearchState.provider = dataProviderName;
    newSearchState.autoApplyFilters = true;
    return { value: newSearchState, hideFilters: false };
};

exports = {
    getScheduleUid,
    createNewProxyTaskContainersFromTab,
    getCreatedProxyTasks,
    initializeSearchState
};
