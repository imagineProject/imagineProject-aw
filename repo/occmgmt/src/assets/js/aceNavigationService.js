// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * This represents the Occmgmt Navigation Module
 *
 * @module js/aceNavigationService
 */
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import logger from 'js/logger';

import 'js/leavePlace.service';

var exports = {};

// service and module references

/**
 * Function to transition to ACE with the focus on the occurrence identified by the input clone stable id chain.
 *
 * @param {String} objectToBeOpened Teamcenter object uid to be lunch in Content tab
 * @param {String} revisionRuleUid Revision Rule uid
 * @param {String} variantRuleInfo variantRuleUid; String variantRuleOwiningItemId;
 * @param {Date}  effectivityInfo dateEffectivity; int unitEffectivity; String endItemId;
 * @param {Object} cloneStableIdChain Clone stable chain id for the occurrence to focus
 * @param {Boolean} cleanupBookmarkData if true then delete the BookmarkData
 * @param {Boolean} reload if true then will force transition even if no state or params have changed
 * @param {String} partitionSchemeUid Partition Scheme Uid;
 */
export let createURLAndLaunchContent = function( objectToBeOpened, revisionRuleUid, variantRuleInfo,
    effectivityInfo, cloneStableIdChain, cleanupBookmarkData, reload, partitionSchemeUid ) {
    if( !objectToBeOpened ) {
        throw 'Mandatory argument objectToBeOpened not defined.';
    }
    if ( !revisionRuleUid ) {
        throw 'Mandatory argument revisionRuleUid not defined.';
    }
    if ( !cloneStableIdChain ) {
        throw 'Mandatory argument cloneStableIdChain not defined.';
    }

    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};

    toParams.page = 'Content';
    toParams.pageId = 'tc_xrt_Content';
    toParams.uid = objectToBeOpened;

    var options = {};
    if( reload ) {
        options.reload = reload;
    }
    var systemLocatorParams = {};

    systemLocatorParams.RevisionRule = revisionRuleUid;
    systemLocatorParams.OccThreadChain = cloneStableIdChain;
    //This is Focus Occurrence with clone stable id chain use case.So, setting isFocusedLoad to true
    systemLocatorParams.isFocusedLoad = true;

    if( variantRuleInfo && variantRuleInfo.variantRuleUid ) {
        systemLocatorParams.VariantRule = variantRuleInfo.variantRuleUid;
    }

    if( partitionSchemeUid ) {
        systemLocatorParams.occurrenceScheme = partitionSchemeUid;
    }

    if( effectivityInfo ) {
        systemLocatorParams.EndItemUid = effectivityInfo.endItemUid;
        systemLocatorParams.ToUnit = effectivityInfo.unitEffectivity;
        systemLocatorParams.EndDate = effectivityInfo.endDate;
        systemLocatorParams.dateEffectivity = effectivityInfo.dateEffectivity;
    }

    if( cleanupBookmarkData ) {
        systemLocatorParams.savedSessionMode = 'reset';
    }

    appCtxSvc.registerCtx( 'systemLocator', systemLocatorParams );

    logger.trace( '#### locationChangeSuccess with params : ' + toParams );
    logger.trace( '#### locationChangeSuccess with params : ' + systemLocatorParams );
    AwStateService.instance.go( transitionTo, toParams, options );
};

export let navigateWithGivenParams = function( urlParamsMap, urlParamsWithValue ) {
    var paramWithKeys = Object.keys( urlParamsWithValue );
    var urlParams = { ...AwStateService.instance.params };
    for( var param in urlParamsMap ) {
        if( paramWithKeys.includes( param ) ) {
            urlParams[ urlParamsMap[ param ] ] = urlParamsWithValue[ param ];
        } else {
            urlParams[ urlParamsMap[ param ] ] = null;
        }
    }
    AwStateService.instance.go( '.', urlParams );
};

/* Function to open the content tab with the given Teamcenter object with set of configuration.
*
* @published
* @param {String} objectToBeOpened - Teamcenter object to be opened in Content tab
* @param {Object} configurationContext - Object used to hold the configuration related information.
* It includes information about revision rules, variant rules, effectivity, and partition schemes.
*
* Properties:
*
* @property {Object} revisionRuleObject - An object representing the revision rule configuration.
*
* @property {Object} variantRuleObject - An object representing the variant rule configuration.
*
* @property {Object} effectivityInfo - An object containing effectivity information.
* @property {string} effectivityInfo.dateEffectivity - A string representing the date effectivity.
* @property {string} effectivityInfo.unitEffectivity - A string representing the unit effectivity.
* @property {string} effectivityInfo.endItemUid - A string representing the end item UID.
*
* @property {Object} partitionSchemeObject - An object representing the partition scheme configuration.
* @param {String} cloneStableIdChain - Clone stable chain id for the occurrence to focus seperated by ':'
*/
export let openInContentTab = function( objectToBeOpened, configurationContext, cloneStableIdChain  ) {
    if( !objectToBeOpened ) {
        throw 'Mandatory argument objectToBeOpened not defined.';
    }
    let variantRuleInfo = {
        variantRuleUid: configurationContext.variantRuleObject.uid
    };
    exports.createURLAndLaunchContent( objectToBeOpened.uid, configurationContext.revisionRuleObject.uid, variantRuleInfo,
        configurationContext.effectivityInfo, cloneStableIdChain, true/*cleanupBookmarkData*/, false/*reload*/, configurationContext.partitionSchemeObject.uid );
};

export default exports = {
    createURLAndLaunchContent,
    navigateWithGivenParams,
    openInContentTab
};
