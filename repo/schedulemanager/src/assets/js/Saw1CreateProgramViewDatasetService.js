// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1CreateProgramViewDatasetService
 */

import cdm from 'soa/kernel/clientDataModel';
import prgDataSource from 'js/Saw1ProgramViewDataSource';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import _ from 'lodash';
import dmSvc from 'soa/dataManagementService';

var exports = {};
var _addSchedule = null;
var _removeSchedule = null;

export let getProgramViewObject = function( ctx ) {
    return prgDataSource.instance.getProgramViewObject( ctx );
};

/**
  * Add the Selected Schedules in Data provider
  *
  * @param {data} data - The data of view model
  */
export let addIntoSelectedSchedulesProvider = function( data ) {
    if( data.dataProviders && _addSchedule ) {
        var schedules = data.dataProviders.selectedSchedules.viewModelCollection.loadedVMObjects;
        schedules.push( _addSchedule );
        data.dataProviders.selectedSchedules.update( schedules );
    }
};

/**
  * Get the Schedules of Program View
  *
  * @param {ctx} ctx - The ctx of the viewModel
  * @param {data} data - The data of view model
  */
export let getSelectedSchedules = function( programViewConfiguration, dataCurrentSchedules ) {
    if( dataCurrentSchedules ) {
        return dataCurrentSchedules;
    } else if( programViewConfiguration && programViewConfiguration.configFromSOA ) {
        var currentSchedules = [];
        currentSchedules = programViewConfiguration.configFromSOA.scheduleUIDs;

        currentSchedules = _.uniq( currentSchedules );
        var schedules = [];
        for( var index = 0; index < currentSchedules.length; index++ ) {
            schedules.push( cdm.getObject( currentSchedules[ index ] ) );
        }
        return schedules;
    }
    return [];
};

/**
  * Filter search results: Remove current schedules
  * @param {response} response - The response of PerformSearchView call
  * @param {data} data - The data of view model
  */
export let filterSearchResults = function( response, dataCurrentSchedules, totalFound, totalLoaded, lastEndIndex, selectionModel ) {
    let searchResults = JSON.parse( response.searchResultsJSON );
    let uniqueObjects = _.differenceBy( searchResults.objects, dataCurrentSchedules, 'uid' );
    let difference = searchResults.objects.length - uniqueObjects.length;
    searchResults.objects = uniqueObjects;
    totalFound = response.totalFound - difference;
    totalLoaded = response.totalLoaded - difference;
    lastEndIndex = response.endIndex - difference;
    selectionModel.multiSelectEnabled = true;
    selectionModel.mode = 'multiple';
    return searchResults.objects;
};
/**
  * check is program view updated with schedules.
  *
  * @param {ctx} ctx - The ctx of the viewModel
  * @param {data} data - The data of view model
  */
export let isProgramViewUpdated = function( programViewConfiguration, dataCurrentSchedules ) {
    var currentSchedules = [];
    currentSchedules = dataCurrentSchedules;

    for( var index = 0; index < currentSchedules.length; index++ ) {
        if( programViewConfiguration && programViewConfiguration.configFromSOA ) {
            var isNew = _.indexOf( programViewConfiguration.configFromSOA.scheduleUIDs, currentSchedules[ index ].uid );
            if( isNew === -1 ) {
                return true;
            }
        }
        return true;
    }
    return false;
};

/**
  * Get filter box text
  *
  * @param {data} data - The data of view model
  */
export let getFilterValue = function( filterBoxDbValue ) {
    var empty = '*';
    if( filterBoxDbValue !== '' ) {
        return filterBoxDbValue;
    }

    return empty;
};

/**
  * Execute the command.
  * <P>
  * This command is used to add Schedule into Selected Data Provider
  *
  * @param {ViewModelObject} vmo - Schdedule VMO
  */
export let addSchedule = function( vmo ) {
    if( vmo && vmo.uid ) {
        _addSchedule = vmo;
        eventBus.publish( 'Saw1CreateProgramView.addSchedule' );
    }
};

/**
 * Used to get Selected Schedule UIDs for manageProgramView SOA
 * @param {Objects} schedules: selected schedules objects
 * @returns schedule uids
 */
export let getScheduleUIDs = function( schedules ) {
    var scheduleUIDs = [];
    if ( schedules.selectedSchedules.length > 0 ) {
        for ( var i = 0; i < schedules.selectedSchedules.length; i++ ) {
            scheduleUIDs.push( schedules.selectedSchedules[i].uid );
        }
    }
    return scheduleUIDs;
};

/**
  * Used to get Selected Schedule UIDs for manageProgramView SOA and retain the program view filters
  *
  * @param {data} data - The View model data
  * @returns {object} object - The valied Schedule UIDs or undefined
  */
export let getConfigurationForAddUpdateSchedule = function( dataProviders, programViewConfig ) {
    var programViewConfiguration = {};
    if( programViewConfig ) {
        programViewConfiguration = programViewConfig.configFromSOA;
    }
    programViewConfiguration.scheduleUIDs = exports.getScheduleUIDs( dataProviders );
    return programViewConfiguration;
};

/**
  * Execute the command.
  * <P>
  * This command is used to remove Schedule from Selected Data Provider
  *
  * @param {ViewModelObject} vmo - Schdedule VMO
  */
export let removeSchedule = function( vmo ) {
    if( vmo && vmo.uid ) {
        _removeSchedule = vmo;
        eventBus.publish( 'Saw1CreateProgramView.removeSchedule' );
    }
};

/**
  * Getting Last Index.
  * To update the last index of the availableSchedule dataProvider
  *
  * @param {startIndex} startIndex - startIndex of the results
  * @param {data} data - Data
  */
export let getLastIndex = function( startIndex, lastEndIndex ) {
    let lastIndex = 0;
    if( startIndex > 0 ) {
        //it's a scrolling case
        lastIndex = lastEndIndex.toString();
    }
    return lastIndex;
};

/**
  * Getting Total Obj Found.
  * To get the Total Obj Found of the availableSchedule dataProvider
  *
  * @param {startIndex} startIndex - startIndex of the results
  * @param {data} data - Data
  */
export let getTotalObjFound = function( startIndex, totalFound ) {
    let totalObjFound = 0;
    if( startIndex > 0 ) {
        //it's a scrolling case
        totalObjFound = totalFound.toString();
    }
    return totalObjFound;
};

/**
 * this function is used to load schedule objects from UIDs, and to publish event that calls loadSchedulesDataProvider
 * @param {Object} configurations: program view configurations
 * @param {Object} sharedData: sharedData atomic data that is passed from Saw1ProgramViewChangeSchedules
 */
export let loadObjects = function( configurations, sharedData ) {
    if (configurations && configurations.scheduleUIDs && sharedData && sharedData.selectedSchedules) {
        if (configurations.scheduleUIDs.length > 0 && sharedData.selectedSchedules.length === 0) {
            let newSharedData = _.clone(sharedData.getValue());
            let scheduleUIDs = configurations.scheduleUIDs;
            dmSvc.loadObjects(scheduleUIDs).then(function () {
                for (var index = 0; index < scheduleUIDs.length; index++) {
                    let modelObject = cdm.getObject(scheduleUIDs[index]);
                    newSharedData.selectedSchedules.push(modelObject);
                }
                sharedData.update(newSharedData);
                eventBus.publish('saw1AddRemoveSchedulesProgram.callLoadSchedulesDataProvider');
            });
        }
    }
};

/**
 * Add selected schedule objects to sharedData atomic data or selectedSchedules atomic data
 * @param {Objects} selectedScheduleObjects: selected schedule objects
 * @param {Object} sharedData : sharedData atomic data
 */
export let addSchedules = function( selectedScheduleObjects, sharedData ) {
    if ( sharedData ) {
        let newSharedData = _.clone( sharedData.getValue() );
        newSharedData.selectedSchedules = newSharedData.selectedSchedules.concat( selectedScheduleObjects );
        if( !newSharedData.showCreateButton ) {
            newSharedData.showChangeButton = true;
        }
        sharedData.update( newSharedData );
    }
};

/**
 * Remove the selected schedules from sharedData or selectedSchedules atomic data
 * @param {Object} loadSchedulesDataProvider : data provider
 * @param {Object} sharedData : sharedData atomic data
 */
export let removeSelectedSchedules = function( loadSchedulesDataProvider, sharedData ) {
    if( sharedData ) {
        let newSharedData = _.clone( sharedData.getValue() );
        if ( newSharedData.selectedSchedules.length > 0 ) {
            _.remove( newSharedData.selectedSchedules, function( vmo ) {
                if ( vmo.uid && _removeSchedule.uid &&
                    vmo.uid === _removeSchedule.uid ) {
                    return true;
                }
                return false;
            } );
            if( !newSharedData.showCreateButton ) {
                newSharedData.showChangeButton = true;
            }
        }
        loadSchedulesDataProvider.update( newSharedData.selectedSchedules );
        sharedData.update( newSharedData );
    }
};

/**
 * we are updating configurations state, defined in Saw1ProgramViewXRTContentViewModel, using this function
 * @param {Object} PrgViewConfigurations - program view configurations
 * @param {Object} sharedData - sharedData atomic data
 */
export let updateProgramViewConfigurationsState = function( PrgViewConfigurations, sharedData, filterSets ) {
    if ( PrgViewConfigurations ) {
        let newPrgViewConfigurations = _.clone( PrgViewConfigurations );
        newPrgViewConfigurations.isUpdateReq = true;
        if( sharedData && sharedData !== '' ) {
            let schUIDs = [];
            schUIDs = sharedData.selectedSchedules.map( schedule => schedule.uid );
            newPrgViewConfigurations.configurations.scheduleUIDs = schUIDs;
        }
        if( filterSets && filterSets.length > 0 ) {
            newPrgViewConfigurations.configurations.filterSets = filterSets;
        }
        PrgViewConfigurations.update( newPrgViewConfigurations );
    }
};

exports = {
    getProgramViewObject,
    addIntoSelectedSchedulesProvider,
    getSelectedSchedules,
    filterSearchResults,
    isProgramViewUpdated,
    getFilterValue,
    addSchedules,
    removeSelectedSchedules,
    addSchedule,
    getScheduleUIDs,
    getConfigurationForAddUpdateSchedule,
    removeSchedule,
    getLastIndex,
    getTotalObjFound,
    loadObjects,
    updateProgramViewConfigurationsState
};

export default exports;

