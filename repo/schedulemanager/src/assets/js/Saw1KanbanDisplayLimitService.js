// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';

var exports = {};

export let populateDisplayLimit = function( data, fields, newValue ) {
    var dispLimitValue = newValue ? newValue : 2;
    var displayLimitPref = appCtxSvc.ctx.preferences.AWC_SM_Tasks_Board_Display_Limit;
    if( !newValue && displayLimitPref && displayLimitPref[ 0 ] ) {
        dispLimitValue = parseInt( displayLimitPref[ 0 ] );
    }

    let displayLimit = _.clone( data.displayLimit );
    displayLimit.dbValue = dispLimitValue;
    displayLimit.value = dispLimitValue;
    if( fields ) {
        fields.displayLimit.update( dispLimitValue );
    }
};

export let updateDisplayLimitPreference = function( data, value ) {
    if( !value ) {
        value = data.SM_TASKS_KANBAN_BOARD_DEFAULT_DISPLAY_LIMIT;
    }
    var valueStr = value.toString();
    appCtxSvc.ctx.preferences.AWC_SM_Tasks_Board_Display_Limit[ 0 ] = valueStr;
    return valueStr;
};

export let updateDisplayLimit = function( searchState, displayLimit ) {
    const newSearchState = { ...searchState.getValue() };
    newSearchState.displayLimit = displayLimit;
    searchState.update( newSearchState );
};

exports = {
    populateDisplayLimit,
    updateDisplayLimitPreference,
    updateDisplayLimit
};

export default exports;
