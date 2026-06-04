// Copyright (c) 2022 Siemens

/**
 * Facilitates Time-driven property request auto-sizing
 * Compute accurate call times based on weighted average
 * Weight is calculated based on the time taken to process lines by each server call
 * Assign weight based on this data point
 * Higher weight is assigned to results which are processed faster
 *
 * @module js/invoker/propertyCallTimer
 */

import eventBus from 'js/eventBus';
import preferenceSvc from 'soa/preferenceService';
import appCtxSvc from 'js/appCtxService';
import expandRequests from 'js/invoker/expandRequests';

const propertyCallTimer = new Map();
let _columnArrange = null;
let _DEFAULT_PAGE_SIZE = 100;
let _DEFAULT_TIME = 500;

export let initialize = function() {
    _columnArrange = eventBus.subscribe( 'columnArrange', function() {
        propertyCallTimer.clear();
    } );

    preferenceSvc.getStringValue( 'AWB_InitialPropLoadPageSize' ).then( function( prefValue ) {
        if( prefValue && parseInt( prefValue ) > 0 ) {
            _DEFAULT_PAGE_SIZE = parseInt( prefValue );
        }
    } );

    preferenceSvc.getStringValue( 'AWC_BACKGROUND_CALLS_PROPERTY_TIME' ).then( function( prefValue ) {
        if( prefValue && parseInt( prefValue ) > 0 ) {
            _DEFAULT_TIME = parseInt( prefValue );
        }
    } );
};

export let destroy = function() {
    if( _columnArrange ) {
        eventBus.unsubscribe( _columnArrange );
        _columnArrange = null;
        propertyCallTimer.clear();
    }
};

export let setPropertyCallTimer = function( time, noOfLines ) {
    propertyCallTimer.set( time, noOfLines );
};

export let reSetPropertyCallTimer = function() {
    propertyCallTimer.clear();
};

// Compute lines which to process
// Default will use page size to fetch lines unless property timer option is selected
// Default page size is 100 unless page size is specified with preference AWC_BACKGROUND_CALLS_PAGE_SIZE
// Default for property timer option is 800 ms unless time in milliseconds is specified with preference AWC_BACKGROUND_CALLS_PROPERTY_TIME
export let getNumberOfLinesToProcess = function( occContext ) {
    let loadPropsTimer = expandRequests.loadTreePropertiesInBackgroundEnabled();

    if ( loadPropsTimer === true ) {
        if( propertyCallTimer.size === 0 ) {
            console.log( ': propertyCall first call default to 100 lines' + '\n' );
            return 100;
        }
        // Calculate weighted average
        // Weighted average = Sum of weighted terms / Total number of terms
        // wtAvg = w1x1 + w2x2 + w3x3 + ... + wnxn / w1 + w2 + w3 +... + wn
        // Calculate time taken by each server call to process 1 line - this is the weight for that call
        // If more lines processed more the weight and vice versa
        let totalWeight = 0;
        let sumOfWeightedAverage = 0;

        propertyCallTimer.forEach( function( value, key ) {
            var localKey = parseInt( key );
            var localValue = parseInt( value );
            // For weighted average
            // calculate time for 1 line i.e weight
            let weight = localValue / localKey;
            totalWeight += weight;
            let localSumOfWeightedAverage = weight * ( localValue / localKey );
            sumOfWeightedAverage += localSumOfWeightedAverage;
        } );

        let noOfMs = _DEFAULT_TIME;
        let linesToProcess = Math.round( noOfMs * sumOfWeightedAverage / totalWeight );
        // Starategy decided is that if we get less than 40 lines from the weighted arithmatic algorithm we should default to 40 lines
        if( linesToProcess < 40 ) {
            console.log( ': propertyCall called with Timer weighted Average' + ' Got = ' + linesToProcess + ' lines in next call for ' + noOfMs + 'ms' + ' Defaulting to 40 lines' + '\n' );
            linesToProcess = 40;
        }
        if( sumOfWeightedAverage === Infinity ) {
            reSetPropertyCallTimer();
            linesToProcess = 100;
        }
        console.log( ': propertyCall called with Timer weighted Average' + ' Process = ' + linesToProcess + ' lines in next call for ' + noOfMs + 'ms' + '\n' );
        return linesToProcess;
    }

    console.log( ': propertyCall called with Page Size ' + ' Process = ' + _DEFAULT_PAGE_SIZE + ' lines in next call \n' );
    return _DEFAULT_PAGE_SIZE;
};

var exports = {
    setPropertyCallTimer,
    getNumberOfLinesToProcess,
    initialize,
    destroy,
    reSetPropertyCallTimer
};

export default exports;

