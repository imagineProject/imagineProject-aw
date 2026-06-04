// Copyright (c) 2022 Siemens

/**
 * @module js/aceContextStateMgmtService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import aceUrlMgmtService from 'js/aceUrlManagementService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

/**
 * @param {Object} paramsToBeStoredOnUrl - parameter map to store on URL.
 */
export let getContextKeyFromParentScope = function( data ) {
    return data.subPanelContext && data.subPanelContext.viewKey ? data.subPanelContext.viewKey : '';
};

let updateContextStateOnCtx = function( contextKey, newState, mergeWithCurrentState ) {
    //get Current State and store as Previous State
    var currentState = appCtxSvc.getCtx( contextKey ).currentState;
    appCtxSvc.updatePartialCtx( contextKey + '.previousState', JSON.parse( JSON.stringify( currentState ) ) );
    //Create new merged state using Current State and New State and store as Current State
    if( mergeWithCurrentState ) {
        newState = _.assign( {}, currentState, newState );
    } else {
        _.forEach( currentState, function( value, name ) {
            if( !newState.hasOwnProperty( name ) ) {
                newState[ name ] = null;
            }
        } );
    }
    appCtxSvc.updatePartialCtx( contextKey + '.currentState', JSON.parse( JSON.stringify( newState ) ) );
    eventBus.publish( 'syncContextWithPWASelection' );
};

export let updateContextState = function( contextKey, newState, mergeWithCurrentState, occContext ) {
    if( contextKey ) {
        //Keeping this for backword compatibility. Once all consumers uses occContext this can be deleted.
        updateContextStateOnCtx( contextKey, newState, mergeWithCurrentState );
    } else {
        let state = createContextState( occContext, newState, mergeWithCurrentState );
        occmgmtUtils.updateValueOnCtxOrState( undefined, state, occContext );
        //Keeping below code till time all consumers are converted to use occContext
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.previousState', JSON.parse( JSON.stringify( state.previousState ) ) );
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.currentState', JSON.parse( JSON.stringify( state.currentState ) ) );
    }
};

export let updateUrlAndContextState = function( contextKey, newState, mergeWithCurrentState, subPanelContext ) {
    updateContextState( contextKey, newState, mergeWithCurrentState, subPanelContext.occContext );
    let currentState = { ...subPanelContext.occContext.value.currentState, ...newState };
    aceUrlMgmtService.updateUrlFromCurrentState( subPanelContext.provider, currentState, false );
};

let syncContextStateOnCtx = function( contextKey, newState ) {
    //get Current State and create new Merged State using Current State and New State
    var currentState = appCtxSvc.getCtx( contextKey ).currentState;
    var mergedState = _.assign( {}, currentState, newState );
    //Store Previous and Current state as new merged state
    appCtxSvc.updatePartialCtx( contextKey + '.previousState', JSON.parse( JSON.stringify( mergedState ) ) );
    appCtxSvc.updatePartialCtx( contextKey + '.currentState', JSON.parse( JSON.stringify( mergedState ) ) );
    eventBus.publish( 'syncContextWithPWASelection' );
};

export let syncContextState = function( contextKey, newState, occContext ) {
    if( contextKey ) {
        //Keeping this for backword compatibility. Once all consumers uses occContext this can be deleted.
        syncContextStateOnCtx( contextKey, newState );
    } else {
        //get Current State and create new Merged State using Current State and New State
        var state = createSyncState( occContext, newState );
        occmgmtUtils.updateValueOnCtxOrState( undefined, state, occContext );
        //Keeping below code till time all consumers are converted to use occContext
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.previousState', JSON.parse( JSON.stringify( state.previousState ) ) );
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.currentState', JSON.parse( JSON.stringify( state.currentState ) ) );
    }
};

export let createContextState = function( occContext, newState, mergeWithCurrentState ) {
    var currentState = { ...occContext.currentState };
    //Create new merged state using Current State and New State and store as Current State
    if( mergeWithCurrentState ) {
        newState = _.assign( {}, currentState, newState );
    } else {
        _.forEach( currentState, function( value, name ) {
            if( !newState.hasOwnProperty( name ) ) {
                newState[ name ] = null;
            }
        } );
    }
    return {
        currentState: JSON.parse( JSON.stringify( newState ) ),
        previousState: JSON.parse( JSON.stringify( currentState ) )
    };
};

export let createSyncState = function( occContext, newState ) {
    let currentState = { ...occContext.currentState };
    let mergedState = _.assign( {}, currentState, newState );
    return {
        currentState: JSON.parse( JSON.stringify( mergedState ) ),
        previousState: JSON.parse( JSON.stringify( mergedState ) )
    };
};

export let updateActiveContext = function( contextKey, newState ) {
    var oldContextkey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    var activeContext = _.clone( appCtxSvc.ctx[ contextKey ] );

    if( activeContext === undefined ) {
        return;
    }

    if( newState ) {
        activeContext.currentState = JSON.parse( JSON.stringify( newState ) );
    }
    //below fields are not used from aceActiveContext.context path
    let fieldsToNotPopulateOnActiveContext = {
        sublocationAttributes:{},
        expansionCriteria:{},
        getOccInput:{},
        previousFilterValue:{},
        previousState:{},
        pwaSelectionModel:{},
        isUserContextSaveRequired:{},
        readOnlyFeatures:{},
        treeLoadingInProgress:{},
        treeDataProvider:{},
        searchFilterCategories:{},
        searchFilterMap:{},
        recipe:{}
    };

    _.forEach( fieldsToNotPopulateOnActiveContext, function( value, name ) {
        delete activeContext[name];
    } );

    appCtxSvc.updatePartialCtx( 'aceActiveContext', {
        key: contextKey,
        context: activeContext
    } );
    if( contextKey !== oldContextkey ) {
        appCtxSvc.updatePartialCtx( 'locationContext.modelObject', appCtxSvc.ctx[ contextKey ].modelObject );

        eventBus.publish( 'occDataLoadedEvent', {
            dataProviderActionType: 'activateWindow'
        } );
        eventBus.publish( 'aceActiveContextChanged' );
    }
};
export default exports = {
    getContextKeyFromParentScope,
    updateContextState,
    updateUrlAndContextState,
    syncContextState,
    updateActiveContext,
    createSyncState,
    createContextState
};
