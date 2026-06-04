// Copyright (c) 2022 Siemens

/**
 * Helper service for handling guided navigation through incomplete families and features
 *
 * @module js/Pca0IncompleteFamiliesService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import Pca0Constants from 'js/Pca0Constants';
import pca0ScopesService from 'js/pca0ScopesService';
import _ from 'lodash';

var exports = {};

/**
 * Get Navigation Info from Cached Data when Active Family is set
 * Next/Previous UID will be processed starting from current Active Family
 * Next: start looking from next (top-down) family starting from Active Family
 * Previous: start looking from previous (bottom-up) family starting from Active Family
 * @param {String} activeFamilyUID current family serving as starting point for next/previous search
 * @returns {Object} navigation information: group and family UIDs
 */
let _getNavigationInfoGivenFamily = function( activeFamilyUID ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let cachedUIDs = context.incompleteFamiliesInfo.incompleteFamilies;
    let cachedTreeNodes = context.incompleteFamiliesInfo.incompleteFamiliesTreeData;
    let navigationFamilyUID = undefined;
    let navigationGroupUID = undefined;

    if( cachedUIDs ) {
        // Circular search: get next/previous index from cached list of UIDs
        // Next: if end of list is reached, get first element from list
        // Previous: if first of list is reached, get last element from list
        let currentIdx = cachedUIDs.indexOf( activeFamilyUID );
        let navIdx;
        context.moduleChangedByNextPreviousRequired = false;

        if ( context.goPrevious ) {
            navIdx = ( currentIdx - 1 + cachedUIDs.length ) % cachedUIDs.length;
            navigationFamilyUID = cachedUIDs[navIdx];
            // when depth is >1 and we are in modular configuration data, if we are at the top of the list then we move to the previous module.
            // Check if the next family is the last incomplete family in the current module
            if ( context.incompleteFamiliesInfo.lastIncompleteFamily === cachedUIDs[navIdx] ) {
                context.moduleChangedByNextPreviousRequired = true;
                navigationFamilyUID = cachedUIDs[currentIdx];
            }
        } else {
            navIdx = ( currentIdx + 1 ) % cachedUIDs.length;
            // when depth is >1 and we are in modular configuration data, if we are at the end of the list then we move to the next module.
            // Check if the current family is the last incomplete family in the current module
            if ( context.incompleteFamiliesInfo.lastIncompleteFamily && context.incompleteFamiliesInfo.lastIncompleteFamily === cachedUIDs[currentIdx] ) {
                context.moduleChangedByNextPreviousRequired = true;
                navigationFamilyUID = cachedUIDs[currentIdx];
            } else {
                if ( navIdx >= cachedUIDs.length ) {
                    navIdx = 0;
                }
                navigationFamilyUID = cachedUIDs[navIdx];
            }
        }
        let navigationFamilyNode = _.find( cachedTreeNodes, { nodeUid: navigationFamilyUID } );
        navigationGroupUID = navigationFamilyNode.parentUids[0];
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );
    }
    return {
        navigationGroupUID,
        navigationFamilyUID
    };
};

/**
 * Get Navigation Info from Cached Data when Active Family is not set
 * Next/Previous UID will be processed starting from current group
 * Next: start looking from first family in current group
 * Previous: start looking from last family in previous group (always a change of scope)
 * @param {Object} scopes atomic data
 * @returns {Object} navigation information: group and family UIDs
 */
let _getNavigationInfoGivenGroup = function( scopes ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let cachedTreeNodes = context.incompleteFamiliesInfo.incompleteFamiliesTreeData;
    let navigationFamilyUID = undefined;
    let navigationGroupUID = undefined;
    let currentGroupUID = _.isUndefined( context.currentScope ) ?
        Pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID : context.currentScope;

    // Note: a Next/Previous is always found (eventually coming back to current group) when in depth 1
    //when we have PIP and there is a navigation to another module happening the cachedTreeNodes can be empty and
    //the assumption that a Next/Previous is always found can run into endless recurssion
    if( cachedTreeNodes && context.goPrevious ) {
        // goPrevious: always start from previous group
        let prevScopeFound = false;
        navigationGroupUID = currentGroupUID;
        while( !prevScopeFound ) {
            navigationGroupUID = pca0ScopesService.getPreviousScope( navigationGroupUID, scopes );
            let prevScopeNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
            if( !_.isUndefined( prevScopeNode ) ) {
                prevScopeFound = true;
                navigationFamilyUID = prevScopeNode.childrenUids[ prevScopeNode.childrenUids.length - 1 ];
            }
        }
    } else if( cachedTreeNodes ) {
        // Start from current group
        navigationGroupUID = currentGroupUID;
        let groupNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
        if( _.isUndefined( groupNode ) ) {
            let nextScopeFound = false;
            while( !nextScopeFound ) {
                navigationGroupUID = pca0ScopesService.getNextScope( navigationGroupUID, scopes );
                let nextScopeNode = _.find( cachedTreeNodes, { nodeUid: navigationGroupUID } );
                if( !_.isUndefined( nextScopeNode ) ) {
                    nextScopeFound = true;
                    groupNode = nextScopeNode;
                }
            }
        }
        navigationFamilyUID = groupNode.childrenUids[ 0 ];
    }
    return {
        navigationGroupUID,
        navigationFamilyUID
    };
};

/**
 * Trigger navigation
 * @param {Boolean} resetCachedSoa reset cached soaResponse
 */
let _triggerNavigation = function( resetCachedSoa ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    // If Navigation Family is in current scope, do UI adjustments
    if( context.navigateTo.groupUid === context.currentScope ) {
        eventBus.publish( 'Pca0Features.focusToFamily' );
    }else if( context.incompleteFamiliesInfo.currentIncompleteModule && context.navigateTo.currentSelectedModule !== context.incompleteFamiliesInfo.currentIncompleteModule ) {
        // If a selection is done such that the module is complete, clicking on "next" or "previous" will trigger this event to navigate to the next module.
        context.currentScope = context.navigateTo.groupUid;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );
        eventBus.publish( 'Pca0FscConfigurationModuleTree.changeModuleSelection', { moduleChanged: true } );
    } else {
        // Navigation Family is in a different scope: enforce scope selection
        if( resetCachedSoa ) {
            // Invalidate cached SOA: a new SOA call will be made to download new scope data
            delete context.navigateTo.soaResponse;
        }
        context.currentScope = context.navigateTo.groupUid;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );
        eventBus.publish( 'Pca0Scopes.scopeSelectionUpdate', { scopeUid: context.navigateTo.groupUid, loadScopeData: true } );
    }
};

/**
 * Get "Next"/"Previous" navigation information from cached data
 * @param {Object} scopes atomic data,
 */
let _getNavigationInfoFromCachedData = function( scopes ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Navigation target based on Active Family
    // ActiveFamily may be
    // - the target of Next/Previous navigation
    // - family owning last selected feature
    let navigationInfo = !_.isUndefined( context.activeFamilyUID ) ?
        _getNavigationInfoGivenFamily( context.activeFamilyUID ) : // Active Family is still set, start research for Next/Previous from there
        _getNavigationInfoGivenGroup( scopes ); // Active Family is not set. This occurs when scope selection was changed by the user

    // Update Navigation information on context
    context.navigateTo = {};
    context.navigateTo.groupUid = navigationInfo.navigationGroupUID;
    context.navigateTo.familyUid = navigationInfo.navigationFamilyUID;
    context.navigateTo.currentSelectedModule = context.configurationModuleHierarchy === '' ? '' : context.configurationModuleHierarchy.split( ':' )[0]; // When the hierarchy depth is greater than 1, retrieve the currently selected module in order to compare it when navigating from the current module to the next/previous module.

    // Trigger navigation
    // Invalidate cached SOA: a new SOA call will be made to download new scope data if needed
    // If module is changed, don't trigger navigation
    if( !context.moduleChangedByNextPreviousRequired ) {
        _triggerNavigation( true );
    } else {
        eventBus.publish( 'Pca0FullScreenConfiguration.getNextRequired' );  //if we need to change module we need a soa call
    }

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );
};

/**
 * Process "computeNextIncompleteFamily" SOA response and Initialize completeness and Navigation Information
 * @param {Object} soaResponse the SOA response for "computeNextIncompleteFamily" VCV2 call
 * @returns {Object} incomplete families Information
 */
export let initIncompleteFamiliesInfo = function( soaResponse ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let incompleteFamiliesInfo = soaResponse.responseInfo && soaResponse.responseInfo.incompleteFamiliesInfo ? JSON.parse( soaResponse.responseInfo.incompleteFamiliesInfo[ 0 ] ) : [];
    //set currentIncompleteModule from response. If we are getting the "" it means we are on the root, set it accordingly from the current module hierarchy
    incompleteFamiliesInfo.currentIncompleteModule = soaResponse.responseInfo.currentIncompleteConfigurationModule ? soaResponse.responseInfo.currentIncompleteConfigurationModule[0].split( ':' )[0]
        : undefined;
    let familyNode = undefined;
    let groupNode = undefined;
    let navigationGroupUID = undefined;
    // When the hierarchy depth is greater than 1, retrieve the currently selected module in order to compare it when navigating from the current module to the next/previous module.
    // As when a selection is done at the last family of a module and the next/previous is clicked, that time we need to verify if we have switched to the next/previous module or not.
    let currentSelectedModule = context.configurationModuleHierarchy === '' ? '' : context.configurationModuleHierarchy.split( ':' )[0];

    const configurationModuleHierarchyArray = context.configurationModuleHierarchy.split( ':' );
    const root = configurationModuleHierarchyArray[configurationModuleHierarchyArray.length - 1];
    if( _.isEmpty( incompleteFamiliesInfo.currentIncompleteModule ) && !_.isEmpty( root ) ) {
        incompleteFamiliesInfo.currentIncompleteModule = root;
    }

    // Get next/previous navigation Group
    let navigationFamilyUID = soaResponse.responseInfo && soaResponse.responseInfo.currentIncompleteFamily ? soaResponse.responseInfo.currentIncompleteFamily[ 0 ] : undefined;
    if( !_.isEmpty( incompleteFamiliesInfo ) ) {
        familyNode = _.find( incompleteFamiliesInfo.incompleteFamiliesTreeData, { nodeUid: navigationFamilyUID } );
        groupNode = _.find( incompleteFamiliesInfo.incompleteFamiliesTreeData, { nodeUid: familyNode.parentUids[ 0 ] } );
        navigationGroupUID = groupNode.nodeUid;

        // Update Navigation information on context
        // (TODO to be enhanced) soaResponse will be used when changing scope to navigate to next family
        // features are cached, without unnecessary soa call
        context.navigateTo = {
            groupUid: navigationGroupUID,
            familyUid: navigationFamilyUID,
            soaResponse: soaResponse,
            currentSelectedModule: currentSelectedModule
        };
    }
    context.incompleteFamiliesInfo = incompleteFamiliesInfo;
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

    // Trigger navigation. If module is changed, don't trigger navigation
    if( !_.isUndefined( context.navigateTo ) ) {
        _triggerNavigation( false );
    }
    return incompleteFamiliesInfo;
};

/**
 * Navigate to Next/Previous Required
 * If cached data is available:
 * - get Next/Previous Required from cached data.
 * - If on different group, call SOA to fetch configuration data.
 * - If on same active group, adjust UI for navigation and highlight
 * - If on the last incomplete family within a module, then navigate to next/previous incomplete module and call SOA to fetch configuration data
 * If cached data is not available:
 * - call SOA to re-compute incompleteness and navigate to next/previous Required
 * @param {Boolean} goPrevious True if "Previous Required" command was clicked
 * @param {Object} scopeInfo - Current scopes VM Data
 */
export let navigateToNextIncompleteFamily = function( goPrevious, scopeInfo ) {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    context.goPrevious = goPrevious;

    // If Next is clicked, set property conditions to enable Previous Required
    if( !goPrevious ) {
        context.isNextRequiredClicked = true;
    }
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

    if( _.isUndefined( context.incompleteFamiliesInfo ) ) {
        // Cached data is not available: trigger SOA call
        eventBus.publish( 'Pca0FullScreenConfiguration.getNextRequired' );
    } else {
        // Process Next/Previous Required and navigate
        _getNavigationInfoFromCachedData( scopeInfo );
    }
};

/**
 * Reset incomplete families cache to compute Next/Previous Required
 * @param {Object} context Context to delete incompleteFamiliesInfo and update with new active family
 * @param {Object} familyUID active family on context
 */
export let resetIncompleteFamiliesCache = function( context, familyUID ) {
    delete context.incompleteFamiliesInfo;
    context.activeFamilyUID = familyUID;
    appCtxSvc.updateCtx( 'fscContext', context );
};

export default exports = {
    initIncompleteFamiliesInfo,
    navigateToNextIncompleteFamily,
    resetIncompleteFamiliesCache
};
