// Copyright (c) 2022 Siemens

/**
 * Service responsible for setting Background Working Context Timer
 * 
 * @module js/aceBackgroundWorkingContextTimerService
 */
import AwIntervalService from 'js/awIntervalService';
import soa_preferenceService from 'soa/preferenceService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

var DEFAULT_FREQUENCY_IN_MILLISECONDS = 30000;
var timer = null;

/**
 * Initialize the Background Working Context Timer - called when Content location is revealed
 */
export let initialize = function() {
    var timerDelay = 0;

    //The preference is not found or not defined. Use the default value and enable timer
    // If the preference is defined AND value is more than 0, use the pref value and enable timer
    // If the preference is defined AND value is less than 1, disable timer
    soa_preferenceService.getStringValue( 'AWBBackgroundContextAutoSaveFrequency' ).then( function( prefValue ) {
        if( _.isNull( prefValue ) || _.isUndefined( prefValue ) ) {
            timerDelay = DEFAULT_FREQUENCY_IN_MILLISECONDS;
        } else {
            var prefIntVal = parseInt( prefValue );
            if( prefIntVal > 0 ) {
                timerDelay = prefIntVal * 1000;
            }
        }
        if( timerDelay > 0 ) {
            timer = AwIntervalService.instance( function() {
                var eventData = {
                    source : 'timer'
                };
                eventBus.publish( 'StartSaveAutoBookmarkEvent', eventData );
            }, timerDelay );
        }
    } );
};

/**
 * Reset the Background Working Context Timer - called when user navigates away from Content
 */
export let reset = function() {
    if( timer ) {
        AwIntervalService.instance.cancel( timer );
    }
};

/**
 * Background Working Context Timer utility
 */

export default exports = {
    initialize,
    reset
};
