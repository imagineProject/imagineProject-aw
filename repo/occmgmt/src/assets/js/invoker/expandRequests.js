// Copyright (c) 2022 Siemens

/**
 * Facilitates tree loading in background when server is idle.
 *
 * @module js/invoker/expandRequests
 */

import AppPropertyCallProvider from 'js/invoker/appPropertyCallProvider';
import ExpandBelowCallProvider from 'js/invoker/expandBelowCallProvider';
import ExpandOneCallProvider from 'js/invoker/expandOneCallProvider';
import PropertyCallProvider from 'js/invoker/propertyCallProvider';
import ReconfigureWindowCallProvider from 'js/invoker/reconfigureWindowCallProvider';
import requestQueue from 'js/invoker/requestQueue';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

/**
 * Trigger calls for reconfiguration of current window
 * @param {String} gesture Gesture name
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 */
export const reconfigureWindow = function( gesture, commandContext ) {
    let invokerId = 'ReconfigureWindow';
    let expansionCriteria = {
        expandBelow: false,
        loadTreeHierarchyThreshold: 500,
        levelsToExpand: 1
    };
    let chain2 = new PropertyCallProvider( commandContext, null );
    let chain1 = new ReconfigureWindowCallProvider( commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { replace: true } );
};

/**
 * Trigger calls for expand below of current window
 * @param {String} parentNode Top VMO or VMTN
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 * @param {Object} expansionCriteria optional expansionCriteria may include
 *                  { scopeForExpandBelow, levelsToExpand }
 */
export const expandBelow = function( parentNode, commandContext, expansionCriteria, getPropertiesCallBack ) {
    let request = requestQueue.current();
    if( request && request.firstInChain && request.firstInChain instanceof ExpandBelowCallProvider && request.firstInChain.soaInput.inputData.expansionCriteria.scopeForExpandBelow === parentNode.uid ) {
        return;
    }
    let invokerId = 'ExpandBelow_' + parentNode.uid;
    let callBackChain = [];
    let inx = 0;
    _.each( getPropertiesCallBack, function( callBackFunction, index ) {
        inx = index;
        callBackChain[index] = index > 0 ?
            new AppPropertyCallProvider( commandContext, callBackChain[index - 1], false, callBackFunction ) :
            new AppPropertyCallProvider( commandContext, null, false, callBackFunction );
    } );
    let chain2 = new PropertyCallProvider( commandContext, callBackChain[inx], true );
    let chain1 = new ExpandBelowCallProvider( parentNode, commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { replace: true } );
};

/**
 * Trigger calls for expand single parent in current window
 * @param {String} parentNode Top VMO or VMTN
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 */
export const expandOne = function( parentNode, commandContext ) {
    let invokerId = 'ExpandOne_' + parentNode.uid;
    let expansionCriteria = {
        expandBelow: false,
        loadTreeHierarchyThreshold: 500,
        levelsToExpand: 1
    };
    let chain2 = new PropertyCallProvider( commandContext, null );
    let chain1 = new ExpandOneCallProvider( parentNode, commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { queue: true } );
};

/**
 * Trigger calls for loading tree properties in background
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 */
export const loadTreePropertiesInBackground = function( commandContext, getPropertiesCallBack ) {
    let invokerId = 'TreePropertiesInBackground_';
    let callBackChain = [];
    let inx = 0;
    _.each( getPropertiesCallBack, function( callBackFunction, index ) {
        inx = index;
        callBackChain[index] = index > 0 ?
            new AppPropertyCallProvider( commandContext, callBackChain[index - 1], false, callBackFunction ) :
            new AppPropertyCallProvider( commandContext, null, false, callBackFunction );
    } );
    let chain1 = new PropertyCallProvider( commandContext, callBackChain[inx], false, true );
    requestQueue.queue( invokerId, chain1, { queue: true } );
};

export const reconfigureEnabled = function( ) {
    return false;
};

const _isBackgroundCallsEnabled = function() {
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.AWB_DISABLE_BACKGROUND_CALLS && appCtxSvc.ctx.preferences.AWB_DISABLE_BACKGROUND_CALLS[ 0 ] && appCtxSvc.ctx.preferences.AWB_DISABLE_BACKGROUND_CALLS[ 0 ].toUpperCase() === 'FALSE' ) {
        return false;
    }
    return true;
};

export const expandBelowEnabled = function( ) {
    return _isBackgroundCallsEnabled();
};

export const expandOneEnabled = function( ) {
    return false;
};

export const loadTreePropertiesInBackgroundEnabled = function( ) {
    return _isBackgroundCallsEnabled();
};

var exports = {
    reconfigureWindow,
    reconfigureEnabled,
    expandBelow,
    expandBelowEnabled,
    expandOne,
    expandOneEnabled,
    loadTreePropertiesInBackground,
    loadTreePropertiesInBackgroundEnabled
};
export default exports;
