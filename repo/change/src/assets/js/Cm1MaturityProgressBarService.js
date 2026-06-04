// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1MaturityProgressBarService
 */
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Returns the array of 1st position, last position and current position
 * @param {ObjectArray} allLovEntries The array of steps
 * @param {Object} currValue current property value
 * @return {ObjectArray} The array of 1st position, last position and current position
 */
function getBegEndPosition( allLovEntries, currValue ) {
    var length = allLovEntries.length;
    var beg = 0;
    var end = length - 1;

    var currentElemPos = -1;
    for( var k = 0; k < length; ++k ) {
        if( allLovEntries[ k ] === currValue ) {
            currentElemPos = k;
            break;
        }
    }

    // Even if page has enough width we show only 6 relevant elements which is computed by below logic
    var maxPosition = 5;
    var halfMaxPosition = Math.floor( maxPosition / 2 );
    if( end > maxPosition ) {
        // current state is among 1st 3 LOV values then show first 6 elements.
        if( currentElemPos <= halfMaxPosition ) {
            end = maxPosition;
        }
        // current state is among last 3 LOV values then show last 3 elements.
        else if( end - currentElemPos <= halfMaxPosition ) {
            beg = end - maxPosition;
        }
        // current state is not any of 3 begin or end states
        else {
            // count of initial state to current state is less than or equal to count of end state to current state + 1
            if( currentElemPos <= end - currentElemPos ) {
                beg = currentElemPos - halfMaxPosition;
                end = currentElemPos + halfMaxPosition + 1;
            }
            // count of initial state to current state is more than count of end state to current state + 1
            else {
                beg = currentElemPos - halfMaxPosition - 1;
                end = currentElemPos + halfMaxPosition;
            }
        }
    }

    return [ beg, end, currentElemPos ];
}

/**
 * Returns the states
 * @param {Object} selectedUid uid of the selected object in primary workarea
 * @param {Object} propName property name
 * @param {ObjectArray} states The array of steps
 * @return {ObjectArray} The view model properties for each state
 */
export let showSteps = function( selectedUid, propName, states ) {
    var allLovEntries = [];
    var lovEntries = [];
    var currState;
    var selectedObj = cdm.getObject( selectedUid );
    if ( selectedObj && cmm.isInstanceOf( 'Awb0Element', selectedObj.modelType ) ) {
        var uid = selectedObj.props.awb0UnderlyingObject.dbValues[0];
        selectedObj = cdm.getObject( uid );
    }
    var prop = selectedObj.props[propName];
    if ( prop && prop.uiValues && prop.uiValues.length > 0 ) {
        currState = prop.uiValues[0];
        prop.propertyDisplayName = prop.uiValues[0];
        if ( !prop.uiValue ) {
            prop.uiValue = prop.uiValues[0];
        }
    }
    for ( var i = 0; i < states.length; ++i ) {
        if ( states[i].propDisplayValues && states[i].propDisplayValues.lov_values && states[i].propDisplayValues.lov_values.length > 0 ) {
            allLovEntries.push( states[i].propDisplayValues.lov_values[0] );
            states[i].propertyDisplayName = states[i].propDisplayValues.lov_values[0];
            if ( !states[i].uiValue ) {
                states[i].uiValue = states[i].propDisplayValues.lov_values[0];
            }
        }
    }
    var beg = 0;
    var end = 0;
    var positions = getBegEndPosition( allLovEntries,
        currState );
    beg = positions[0];
    end = positions[1];

    for ( var j = beg; j <= end; ++j ) {
        if( currState === states[j].uiValue ) {
            states[j].isCurrentActive = true;
            prop = states[j];
        }
        lovEntries.push( states[j] );
    }
    if ( !prop || !prop.uiValue ) {
        prop = lovEntries[0];
    }
    return {
        states: lovEntries,
        currState: prop
    };
};

/*
    If Selected change object is updated, we need to update the progress bar.
*/
export let handleUpdatedEvent = function( updatedObjects ) {
    if ( updatedObjects ) {
        for ( var inx = 0; inx < updatedObjects.length; ++inx ) {
            if ( updatedObjects[inx].uid === appCtxSvc.ctx.selected.uid ) {
                eventBus.publish( 'updateMaturityProgressBar' );
                break;
            }
        }
    }
};

export let selectedChangeObject = function( selectedObject ) {
    return selectedObject;
};

/**
 * This is a workaround added to fetch changetype from selection
 * when change is opened.For this particular use-case xrtSummaryContextObject is 
 * showing inconsistent behaviour and sometimes it comes as undefined.
 */
export let getSelectedChangeType = function() {
    var summaryContextObj = appCtxSvc.ctx.xrtSummaryContextObject;
    var changeType = '';

    if ( summaryContextObj !== null && summaryContextObj !== undefined ) {
        changeType = summaryContextObj.type;
    } else if ( changeType === '' ) {
        var selectedObj = appCtxSvc.ctx.selected;
        changeType = selectedObj !== null && selectedObj !== undefined ? selectedObj.type : '';
    }
    return changeType;
};
export default exports = {
    showSteps,
    selectedChangeObject,
    getSelectedChangeType,
    handleUpdatedEvent
};
