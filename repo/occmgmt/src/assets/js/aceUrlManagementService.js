// Copyright (c) 2024 Siemens

/**
 * @module js/aceUrlManagementService
 */

import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

// Global counter to track dual context loads
let viewLoadCounter = 0;

export let urlParamsMap = {
    rootQueryParamKey: 'uid',
    selectionQueryParamKey: 'c_uid',
    openStructureQueryParamKey: 'o_uid',
    productContextQueryParamKey: 'pci_uid',
    csidQueryParamKey: 'c_csid',
    secondaryPageIdQueryParamKey: 'spageId',
    topElementQueryParamKey: 't_uid',
    pageIdQueryParamKey: 'pageId',
    recipeParamKey: 'recipe',
    subsetFilterParamKey: 'filter',
    contextOverride: 'incontext_uid',
    alternatePwaKey : 'altPwa',
    alternatePwa2Key : 'altPwa_2',
    highlightQueryParamKey: 'h_uid'
};

export let getUrlParamMapForCurrentContext = function( provider ) {
    if( provider.customEditContext ) {
        let isRightView = _.includes( provider.customEditContext, 'right' );

        //In split view, left side context & URL params are same as single product case.
        //For right side, URL params are added with like 'uid2' if single product has it as 'uid'
        //Instead of maintaing urlParams separately in JSON, we can just have those in states.json
        //and look for params with '2' in it from URL than maintaining that list in JSON.
        if( isRightView ) {
            let urlParamMapForCurrentContext = _.clone( urlParamsMap );
            _.forEach( urlParamMapForCurrentContext, function( value, key ) {
                urlParamMapForCurrentContext[ key ] = value + '2';
            } );

            return urlParamMapForCurrentContext;
        } //instead of

        return urlParamsMap;
    }

    return provider.urlParams;
};

export let updateState = function( subPanelcontext, sublocInitialization ) {
    var newState = {
        pageId: 'tc_xrt_Content'
    };
    var isStateChanged = false;
    var previousState = subPanelcontext.occContext.previousState;

    if( appCtxSvc.ctx.splitView ) {
        var urlParamMapForCurrentContext = getUrlParamMapForCurrentContext( subPanelcontext.provider );

        _.forEach( AwStateService.instance.params, function( value, parameter ) {
            if( _.values( urlParamMapForCurrentContext ).indexOf( parameter ) > -1 ) {
                var queryParam = _.invert( urlParamMapForCurrentContext )[ parameter ];
                var currentStateParam = urlParamsMap[ queryParam ];

                if( currentStateParam && value ) {
                    newState[ currentStateParam ] = value;
                } else if( subPanelcontext.occContext.currentState[ currentStateParam ] ) {
                    newState[ currentStateParam ] = subPanelcontext.occContext.currentState[ currentStateParam ];
                }

                isStateChanged = isStateChanged ? true : ( AwStateService.instance.params[ parameter ] || previousState[ currentStateParam ] ) &&
                    AwStateService.instance.params[ parameter ] !== previousState[ currentStateParam ];
            }
        } );
    } else {
        _.forEach( AwStateService.instance.params, function( value, name ) {
            if( AwStateService.instance.params[ name ] ) {
                newState[ name ] = value;
            }
        } );
        isStateChanged = _.keys( AwStateService.instance.params ).filter( function( key ) {
            return ( AwStateService.instance.params[ key ] || previousState[ key ] ) &&
                AwStateService.instance.params[ key ] !== previousState[ key ];
        } ).length !== 0;
    }

    var value = {};
    // On exiting the split view from inactive view, the expanded nodes have to be updated
    if( appCtxSvc.ctx.expandedNodes && subPanelcontext.occContext.transientRequestPref && _.isEmpty( subPanelcontext.occContext.transientRequestPref.expandedNodes ) ) {
        value.transientRequestPref = {
            expandedNodes: appCtxSvc.ctx.expandedNodes.map( ( { stableId } ) => stableId )
        };
    }

    if( isStateChanged && ( _.isEqual( newState.pageId, 'tc_xrt_Content' ) || _.isEqual( newState.pageId, subPanelcontext.provider.pageIdForContent ) ) ) {
        if( !_.isEmpty( subPanelcontext.occContext.currentState.uid ) && newState.uid !== subPanelcontext.occContext.currentState.uid ) {
            let currentState = { ...subPanelcontext.occContext.currentState };
            let mergedState = _.assign( {}, currentState, newState );
            value.currentState = mergedState;
        } else if( !_.isEqual( newState, subPanelcontext.occContext.currentState ) ) {
            // 1. In case of selection change in PWA, AwDataNavigator performs URL update.
            // 2. After URL update, AwDataNavigator syncs occContext's currentState with newState URL params
            // 3. Next, baseLocationService detects and fires locationChangeSuccess event as URL params got changed.
            // 4. That in turn triggers occmgmtSublocation component update, i.e., current API call.
            // 5. So by the time control comes here in case of selection change, occContext has already been synced with newState.
            // 6. Above if check is added to update context state only if newState and occContext currentState does NOT match.
            // This reduces unnecessary rendering of AwDataNavigator
            let state = aceContextStateMgmtService.createContextState( subPanelcontext.occContext, newState, true );
            value.currentState = state.currentState;
            value.previousState = state.previousState;

            if ( !sublocInitialization ) {
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelcontext.occContext.viewKey );
            }
        }
    }

    if( !_.isEmpty( value ) ) {
        occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelcontext.occContext );
    }

    return value;
};
var isURLUpdateToAddNewURLParameterInContentTabUrl = function() {
    var isUrlParamUpdate = false;
    _.forEach( AwStateService.instance.params, function( value, name ) {
        if( !_.isEqual( name, 'uid' ) && !_.isEqual( name, 'page' ) && !_.isEqual( name, 'pageId' ) && !_.isUndefined( value ) && !_.isNull( value ) && !isUrlParamUpdate ) {
            isUrlParamUpdate = true;
        }
    } );
    return isUrlParamUpdate;
};

export let updateUrlFromCurrentState = function( provider, currentState, replaceLocation  ) {
    var paramsToNavigate = { ...AwStateService.instance.params };
    if( appCtxSvc.ctx.splitView ) {
        var urlParamMapForCurrentContext = getUrlParamMapForCurrentContext( provider );

        _.forEach( currentState, function( value, parameter ) {
            if( _.values( urlParamsMap ).indexOf( parameter ) > -1 ) {
                var queryParam = _.invert( urlParamsMap )[ parameter ];
                if( queryParam && value ) {
                    paramsToNavigate[ urlParamMapForCurrentContext[ queryParam ] ] = value;
                } else if( paramsToNavigate[ urlParamMapForCurrentContext[ queryParam ] ] ) {
                    paramsToNavigate[ urlParamMapForCurrentContext[ queryParam ] ] = null;
                }
            }
        } );
    } else {
        _.forEach( currentState, function( value, name ) {
            paramsToNavigate[ name ] = value;
        } );
    }

    paramsToNavigate.edit = undefined;

    if( viewLoadCounter === 2 || AwStateService.instance.params.gesture === 'dualContextExit' ) {
        paramsToNavigate.gesture = undefined;
        if( viewLoadCounter !== 0 ) {
            viewLoadCounter = 0;
        }
    }

    if( isURLUpdateToAddNewURLParameterInContentTabUrl() && replaceLocation !== false ) {
        AwStateService.instance.go( AwStateService.instance.current.name, paramsToNavigate, { location: 'replace' } );
    } else {
        AwStateService.instance.go( AwStateService.instance.current.name, paramsToNavigate );
    }
};

/**
 * Increments the global counter to track the dual context view loads completion status.
 *
 * @param {*} onPwaLoadCompleteForLeftView - Indicates if the left view has completed loading.
 * @param {*} onPwaLoadCompleteForRightView - Indicates if the right view has completed loading.
 */
export let updateViewLoadCounter = function( onPwaLoadCompleteForLeftView, onPwaLoadCompleteForRightView) {
    if( ( onPwaLoadCompleteForLeftView === 1 || onPwaLoadCompleteForRightView === 1 ) && AwStateService.instance.params.gesture === 'dualContextEnter' ) {
        viewLoadCounter++;

        // There is a timing issue in methods updateUrlFromCurrentState and updateViewLoadCounter, which causes the gesture to sometimes clear correctly and sometimes not.
        // To resolve this, the gesture is now being cleared in both methods.
        if( viewLoadCounter === 2 ) {
            let paramsToNavigate = { ...AwStateService.instance.params };
            paramsToNavigate.gesture = undefined;
            AwStateService.instance.go( AwStateService.instance.current.name, paramsToNavigate );
        }
    }
};

export default exports = {
    updateState,
    updateUrlFromCurrentState,
    getUrlParamMapForCurrentContext,
    updateViewLoadCounter
};
