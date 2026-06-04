// Copyright (c) 2022 Siemens

/**
 * Service that provides APIs for claiming the task objects.
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1ClaimTaskService
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

/**
 * Gets the Claim Assignment Objects.
 *
 * @param {object} ctx - The context object
 * @returns {Object} Resource Assignment Objects.
 */
export let getClaimAssignments = function( ctx ) {
    var claimAssignments = [];
    var selectedTasks = ctx.mselected;
    var selectedTeam = exports.getSelectedTeam( ctx.state.params );

    if( selectedTasks ) {
        selectedTasks.forEach( function( selectedTask ) {
            var schTask = cdm.getObject( selectedTask.uid );
            var resourcePool = null;
            if( selectedTeam ) {
                resourcePool = selectedTeam;
            }
            if( schTask ) {
                var claimAssignmentData = {
                    scheduleTask: schTask,
                    assignedResourcePool: resourcePool
                };

                claimAssignments.push( claimAssignmentData );
            }
        } );

        return claimAssignments;
    }
};

/**
 * Gets the selected Team.
 *
 * @param {Object} stateParams state params
 * @returns {Object} .
 */
export let getSelectedTeam = function( stateParams ) {
    if( stateParams.team ) {
        var selectedTeam = cdm.getObject( stateParams.team );
        if( selectedTeam ) {
            return selectedTeam;
        }
    }
};

/**
 * Sets the context.
 *
 * @param {String} key - The key
 * @param {String} value - The value
 */
var setContext = function( key, value ) {
    if( appCtxService.getCtx( key ) ) {
        appCtxService.updateCtx( key, value );
    } else {
        appCtxService.registerCtx( key, value );
    }
};

/**
 * Gets the selected Team.
 *
 * @param {object} ctx - The context object
 */
export let getTeamName = function( ctx ) {
    if( ctx.state.params.team ) {
        var selectedTeam = cdm.getObject( ctx.state.params.team );
        if( selectedTeam && selectedTeam.props.object_string ) {
            setContext( 'selectedTeamName', selectedTeam.props.object_string.dbValues[ 0 ] );
        } else if( ctx.state.params.team === 'allTeams' ) {
            setContext( 'selectedTeamName', 'allTeams' );
        }
    }
};


/**
 * UnRegisters the context.
 *
 */
export let unRegisterCommandContext = function() {
    if( appCtxService.getCtx( 'selectedTeamName' ) ) {
        appCtxService.unRegisterCtx( 'selectedTeamName' );
    }
};

exports = {
    getClaimAssignments,
    getSelectedTeam,
    getTeamName,
    unRegisterCommandContext
};

export default exports;
