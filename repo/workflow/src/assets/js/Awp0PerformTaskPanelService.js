// Copyright (c) 2022 Siemens

/**
 * Service for getting the correct perform task panel in secondary area or tool and info area.
 *
 * @module js/Awp0PerformTaskPanelService
 */
import AwPromiseService from 'js/awPromiseService';
import conditionService from 'js/conditionService';
import cfgSvc from 'js/configurationService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * Define public API
 */
var exports = {};

/**
 * Cache information like different task perform panel Id, active panel Id and
 * is panel activated from 'tool and info area'.
 */
var activePanelInfo = {};

/**
 * Get contributing perform task panels that will be visible to user
 *
 * @param {String} key COntribution key for contribtuion need to be search
 * @param {Object} modelObject Selected obejct from UI
 * @param {Object} isToolAndInfoAreaContext True/false value based on panel need to be showin in tool and info area or secondary area
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let populateContributedPerformTaskPanel = function( key, modelObject, isToolAndInfoAreaContext ) {
    var deferred = AwPromiseService.instance.defer();
    cfgSvc.getCfg( key ).then( function( performTaskPanels ) {
        var contributedPerformPanels = [];

        if( !performTaskPanels || performTaskPanels.length <= 0 ) {
            return deferred.resolve( null );
        }
        _.forEach( performTaskPanels, function( panel ) {
            var performPanel = {
                priority: panel.priority,
                condition: panel.condition,
                performPanelId: panel.performPanelId,
                id: panel.id
            };

            contributedPerformPanels.push( performPanel );
        } );

        // Check all contributed panels are not null and length > 0 then only
        // get the active perform panel to shwon the user based on condition
        if( contributedPerformPanels.length > 0 ) {
            var activePerformPanelId = null;
            var activePerformPanel = exports.getActivePerformPanel( contributedPerformPanels, modelObject );
            if( activePerformPanel && activePerformPanel.performPanelId ) {
                activePerformPanelId = activePerformPanel.performPanelId;
            }

            // Cache information about different task perform panel Id, active panel Id and panel info
            activePanelInfo = {
                contributingPerformTaskPanels: contributedPerformPanels,
                isToolAndInfoAreaContext: isToolAndInfoAreaContext
            };

            deferred.resolve( activePerformPanelId );
        } else {
            deferred.resolve( null );
        }
    } );
    return deferred.promise;
};

/**
 * Update the opened perform task panel context or if not opened then re-render
 * valid perform task panel that will be shown to the user.
 *
 * @param {Object} data - Data object
 * @param {object} modelObject - the current selection object from UI
 *
 * @returns {Object} Object tat hold info for perform task panel based on input object
 */
export let updatePerformTaskPanelContent = function( data, modelObject ) {
    // Check if context is set already then use that information otherwise get the active perform task
    // panel information by reading all contributions
    if( activePanelInfo && activePanelInfo.contributingPerformTaskPanels && activePanelInfo.isToolAndInfoAreaContext ) {
        var activePerformTaskPanelId = null;
        var activePerformPanel = exports.getActivePerformPanel( activePanelInfo.contributingPerformTaskPanels, modelObject );
        if( activePerformPanel ) {
            activePerformTaskPanelId = activePerformPanel.performPanelId;
        }

        // Check if previous active perform task panel id property on data is same as new active
        // panel id then fire event to update the task panel otherwise re-render active perform task panel
        if( data.activePerformTaskPanelId === activePerformTaskPanelId ) {
            eventBus.publish( 'Awp0PerformTask.updateInternalPanel' );
            return activePerformTaskPanelId;
        }

        return activePerformTaskPanelId;
    }
    return exports.populateContributedPerformTaskPanel( 'performTaskPanelConfiguration.perfromTaskToolAreaContribution', modelObject, true );
};

/**
 * Evaluate conditions for all given panels and return the one with valid condition and highest priority
 * @param {Array} panels all contributing panels
 * @param {object} modelObject - the current selection object from UI
 *
 * @returns {Object} active perform task panel
 */
export let getActivePerformPanel = function( panels, modelObject ) {
    var activePerformPanel = null;
    if( panels ) {
        _.forEach( panels, function( panel ) {
            if( panel.condition ) {
                if( typeof panel.condition === 'string' ) {
                    var isConditionTrue = conditionService.evaluateCondition( {
                        modelObject: modelObject
                    }, panel.condition );
                    if( isConditionTrue ) {
                        if( !activePerformPanel || panel.priority > activePerformPanel.priority ) {
                            activePerformPanel = panel;
                        }
                    }
                }
            }
        } );
    }
    return activePerformPanel;
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0PerformTaskPanelService
 */

export default exports = {
    populateContributedPerformTaskPanel,
    updatePerformTaskPanelContent,
    getActivePerformPanel
};
