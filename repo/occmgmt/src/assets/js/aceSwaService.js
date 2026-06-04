// Copyright (c) 2022 Siemens

/**
 * @module js/aceSwaService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import aceUrlMgmtService from 'js/aceUrlManagementService';
import eventBus from 'js/eventBus';

/**
 * {EventSubscriptionArray} Collection of eventBuss subscriptions to be removed when the controller is
 * destroyed.
 */
var exports = {};
var _tabsSupportedForSplitView = [ 'tc_xrt_Overview', 'tc_xrt_Finishes', 'tc_xrt_MadeFrom',
    'web_whereused', 'tc_xrt_Changes', 'tc_xrt_History', 'attachments', 'tc_xrt_Simulation', 'Awb0ViewerFeature', 'Awv0StructureViewerPageContainer', 'tc_xrt_AttributesForDCP', 'Awb0XRViewerFeature', 'AwXRSViewerPage'
];

export let isTabSupportedForSplitView = function( pageId ) {
    return _tabsSupportedForSplitView.includes( pageId );
};

/**
 * on SWA tab change, set isUserContextSaveRequired to true. To invoke saveUserWorkingContextState SOA
 */
export let swaTabChange = function( subPanelContext ) {
    var currentContext = appCtxService.getCtx( subPanelContext.contextKey );
    if( currentContext && currentContext.treeLoadingInProgress === false ) {
        //Get the SWA page id present on the URL and the one in the CFX atomic data to check URL update needed or not
        var activeTab = subPanelContext.occContext.currentState.spageId;
        if( _.isUndefined( activeTab ) ) {
            //If spageId not available then get the value what is sent by server in the SOA response
            activeTab = !_.isUndefined( currentContext.sublocationAttributes ) ? currentContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] : undefined;
        }
        var secondaryActiveTabId = subPanelContext.pageContext.sublocationState.secondaryActiveTabId;
        if( secondaryActiveTabId !== activeTab ) {
            if( secondaryActiveTabId !== 'SelectionSummary' ) {
                var contextState = aceContextStateMgmtService.createContextState( subPanelContext.occContext, {
                    spageId: secondaryActiveTabId
                }, true );

                var value = {
                    isUserContextSaveRequired: true,
                    currentState: contextState.currentState,
                    previousState: contextState.previousState
                };
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.contextKey );
                aceUrlMgmtService.updateUrlFromCurrentState( subPanelContext.provider, contextState.currentState );
            }
        }
    }
};

const handleAltPwaChange = ( subPanelContext ) => {
    if( subPanelContext.baseSelection ) {
        let altPwaViews = _.get( subPanelContext, 'pageContext.sublocationState.viewModeContext.displayedViewModes.altPwaViews' );
        let swaViews = _.get( subPanelContext, 'pageContext.sublocationState.viewModeContext.displayedViewModes.swaViews' );
        var altPwa = altPwaViews.length > 0 ? altPwaViews[ 0 ] : null;
        var altPwa_2 = altPwaViews.length > 1 ? altPwaViews[ 1 ] : null;
        var spageId = swaViews.length > 0 ? swaViews[ 0 ] : null;

        let isAltPwaPresent = subPanelContext.occContext.currentState.hasOwnProperty('altPwa');
        let isAltPwa_2Present = subPanelContext.occContext.currentState.hasOwnProperty('altPwa_2');

        // If altPwa or altPwa_2 doesn't exist yet in currentState and displayedViewModes.altPwaViews has nothing to set (null)
        // then, no need to update anything on url
        if( ( !( isAltPwaPresent === false && altPwa === null ) && altPwa !== subPanelContext.occContext.currentState.altPwa ) ||
            ( !( isAltPwa_2Present === false && altPwa_2 === null ) && altPwa_2 !== subPanelContext.occContext.currentState.altPwa_2 ) ) {
            var contextState = aceContextStateMgmtService.createContextState( subPanelContext.occContext, {
                altPwa: altPwa,
                altPwa_2: altPwa_2,
                spageId:spageId
            }, true );

            var value = {
                currentState: contextState.currentState,
                previousState: contextState.previousState
            };
            occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
            occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.contextKey );
            aceUrlMgmtService.updateUrlFromCurrentState( subPanelContext.provider, contextState.currentState );
        }
    }
};

export default exports = {
    swaTabChange,
    isTabSupportedForSplitView,
    handleAltPwaChange
};
