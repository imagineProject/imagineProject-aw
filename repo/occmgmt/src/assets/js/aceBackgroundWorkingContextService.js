// Copyright (c) 2022 Siemens

/**
 * Service responsible for saving Background Working Context
 *
 * @module js/aceBackgroundWorkingContextService
 */
import soaSvc from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import AwPromiseService from 'js/awPromiseService';
import messagingSvc from 'js/messagingService';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';

var exports = {};

var _eventSubDefs = [];
var _swcPromise = null;

var isUserContextSaveRequired = function( eventData, currentContext, inputRequestPref ) {
    var _currentOpenedObjectUid = null;
    let currentActiveContext = appCtxService.ctx.aceActiveContext && appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
    let activeContext = appCtxService.ctx.aceActiveContext && appCtxService.ctx.aceActiveContext.context;

    //If opened object has changed between currentState and previouState and currentActiveContext is not yet populated,
    //make saveUserWorkingContextState2() call with previousState. Its required for usecases e.g. when user go to Home Folder
    if( _.isUndefined( currentActiveContext ) && !_.isEqual( activeContext.currentState.uid, activeContext.previousState.uid ) ) {
        if( !_.isEmpty( activeContext.previousState ) ) {
            _currentOpenedObjectUid = activeContext.previousState.uid;
        }
    } else if( activeContext.currentState ) {
        _currentOpenedObjectUid = activeContext.currentState.uid;
    }
    // If clone data is present on context then we want to save it.
    var addInWorkingCtxData = appCtxService.getCtx( 'addInWorkingCtxData' );
    if( addInWorkingCtxData ) {
        if( addInWorkingCtxData.requestPref && addInWorkingCtxData.requestPref.deleteCloneData && addInWorkingCtxData.requestPref.deleteCloneData[ 0 ] === 'true' ) {
            return true;
        }
        if( addInWorkingCtxData.cloneContentSaveSpecifications && Object.keys( addInWorkingCtxData.cloneContentSaveSpecifications.data ).length > 0 ) {
            return true;
        }
    }

    if( inputRequestPref && inputRequestPref.syncAutoBookmark && inputRequestPref.syncAutoBookmark[0] === 'true' ) {
        return true;
    }

    if( currentContext && !aceRestoreBWCStateService.isProductInteracted( _currentOpenedObjectUid ) ) {
        return false;
    }

    if( !currentContext.isUserContextSaveRequired && ( eventData === null || eventData === undefined ) ) {
        return false;
    }

    if( currentContext.isUserContextSaveRequired && !( eventData && _.isEqual( eventData.source, 'timer' ) ) ) {
        return true;
    }

    if( eventData && eventData.swc ) {
        return true;
    }

    // call soa when it it is called from aceInContextOverrideService i.e. when set in context is toggled
    if( eventData && eventData.incontext_uid ) {
        return true;
    }

    if( eventData && eventData.saveContextStateToServer ) {
        return true;
    }

    return false;
};

var populateCloneContentSaveSpecifications = function( soaInput ) {
    var addInWorkingCtxData = appCtxService.getCtx( 'addInWorkingCtxData' );
    if( addInWorkingCtxData ) {
        if( addInWorkingCtxData.requestPref && addInWorkingCtxData.requestPref.deleteCloneData && addInWorkingCtxData.requestPref.deleteCloneData[ 0 ] === 'true' ) {
            var deleteCloneData = addInWorkingCtxData.requestPref.deleteCloneData;
            soaInput.requestPref.deleteCloneData = deleteCloneData;
            appCtxService.updatePartialCtx( 'addInWorkingCtxData.requestPref.deleteCloneData', [ 'false' ] );
        }
        if( addInWorkingCtxData.cloneContentSaveSpecifications ) {
            var cloneInfo = addInWorkingCtxData.cloneContentSaveSpecifications.data;
            var cloneData = Object.keys( cloneInfo ).map( function( dupInfo ) { return cloneInfo[ dupInfo ]; } );

            if( cloneData.length > 0 ) {
                var productModelObj = { uid: appCtxService.ctx.aceActiveContext.context.productContextInfo.uid, type: appCtxService.ctx.aceActiveContext.context.productContextInfo.type };
                soaInput.contextState.cloneContentSaveSpecifications = [
                    [ productModelObj ],
                    [ cloneData ]
                ];
            }
            if( addInWorkingCtxData.cloneContentSaveSpecifications.removeOnRead ) {
                Object.keys( cloneInfo ).forEach( function( key ) { delete cloneInfo[ key ]; } );
            }
        }
    }
};

var handleFailedStateForCloneData = function( soaInput, failedUIDs ) {
    var addInWorkingCtxData = appCtxService.getCtx( 'addInWorkingCtxData' );
    if( addInWorkingCtxData ) {
        var cloneInfo = addInWorkingCtxData.cloneContentSaveSpecifications.data;
        var cloneData = Object.keys( cloneInfo ).map( function( dupInfo ) { return cloneInfo[ dupInfo ]; } );
        for( var j = 0, len = failedUIDs.length; j < len; ++j ) {
            //Check if failed occurrence has already been applied any new action.
            if( indexOfFailedUid( cloneData, failedUIDs[ j ] ) === -1 ) {
                //If occurrence does not have new action then get previous action from soaInput
                if( soaInput.contextState.cloneContentSaveSpecifications.length > 0 ) {
                    var inputArray = soaInput.contextState.cloneContentSaveSpecifications[ 1 ][ 0 ];
                    var index = indexOfFailedUid( inputArray, failedUIDs[ j ] );
                    if( index > -1 ) {
                        var id = inputArray[ index ].element.uid;
                        cloneInfo[ id ] = inputArray[ index ];
                    }
                }
            }
        }
    }
};
var indexOfFailedUid = function( cloneData, failedUID ) {
    var index = -1;
    for( var i = 0, length = cloneData.length; i < length; ++i ) {
        if( cloneData[ i ].element.uid === failedUID ) {
            index = i;
            break;
        }
    }
    return index;
};
/**
 * Initialize the Background Working Context service - called when Content location is revealed
 */
export let initialize = function( contextKey ) {
    _eventSubDefs.push( eventBus.subscribe( 'StartSaveAutoBookmarkEvent', function( eventData ) {
        exports.saveUserWorkingContextState( false, eventData );
    } ) );

    // To Do - ge rid of event and use atomic data update of selectedModelObjects
    _eventSubDefs.push( eventBus.subscribe( 'primaryWorkArea.selectionChangeEvent', function( event ) {
        let currentContext = appCtxService.getCtx( contextKey );
        if( currentContext && currentContext.treeLoadingInProgress === false ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isUserContextSaveRequired', true, contextKey );
        }
    } ) );
};

/**
 * Ensure that page is not in the process of saving working context
 */
export let ensureSaveComplete = function() {
    return _swcPromise ? _swcPromise : AwPromiseService.instance.when();
};

/**
 * Make a SaveUserWorkingContextState SOA call to save the current user client state information for the opened
 * object.
 */
export let saveUserWorkingContextState = function( shouldFireEventOnSuccess, eventData, subPanelContext, inputRequestPref = {} ) {
    // reset the _current* variables to null first, so that they dont retain the values from last call.
    var currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );

    if( !isUserContextSaveRequired( eventData, currentContext, inputRequestPref ) ) {
        if( shouldFireEventOnSuccess ) {
            eventBus.publish( 'saveBWC.success' );
        }
        return AwPromiseService.instance.resolve();
    }

    var soaInput = {
        contextState: {
            openedObject: cdmSvc.getObject( currentContext.currentState.o_uid ),
            sublocationAttributes: {},
            cloneContentSaveSpecifications: [
                [],
                []
            ]
        },
        requestPref: inputRequestPref
    };

    if( currentContext.pwaSelection && currentContext.pwaSelection.length > 0 ) {
        if( !_.isEqual( currentContext.currentState.c_uid, currentContext.currentState.h_uid ) ) {
            soaInput.contextState.sublocationAttributes.awb0SelectedElementPath = [ currentContext.currentState.h_uid ];
        } else {
            soaInput.contextState.sublocationAttributes.awb0SelectedElementPath = [ currentContext.pwaSelection[ 0 ].uid ];
        }
    }

    // process awb0OverrideContextElement only if this soa is called from aceInContextOverrideService
    if( eventData && eventData.incontext_uid ) {
        soaInput.contextState.sublocationAttributes.awb0OverrideContextElement = [ eventData.incontext_uid ];
        let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
        soaInput.requestPref.isSetCase = _.isEqual( currentContext.currentState.incontext_uid, eventData.incontext_uid ) ? [ 'false' ] : [ 'true' ];
    }

    populateCloneContentSaveSpecifications( soaInput );

    try {
        _swcPromise = soaSvc.post( 'Internal-ActiveWorkspaceBom-2019-06-OccurrenceManagement',
            'saveUserWorkingContextState2', soaInput ).then( function( response ) {
            _swcPromise = null;

            if( response ) {
                if( appCtxService.ctx.aceActiveContext ) {
                    occmgmtUtils.updateValueOnCtxOrState( 'isUserContextSaveRequired', false, appCtxService.ctx.aceActiveContext.key );
                }

                if( shouldFireEventOnSuccess ) {
                    eventBus.publish( 'saveBWC.success' );
                }
            }
            return AwPromiseService.instance.resolve();
        },
        function( error ) {
            if( error.cause && error.cause.plain ) {
                handleFailedStateForCloneData( soaInput, error.cause.plain );
                var errMessage = messagingSvc.getSOAErrorMessage( error );
                messagingSvc.showError( errMessage );
            }
        } );
    } catch ( e ) {
        eventBus.publish( 'saveBWC.failure' );
    }
    return _swcPromise;
};

/**
 * Reset the Background Working Context service - called when user navigates away from Content
 */
export let reset = function( subPanelContext ) {
    exports.saveUserWorkingContextState( false, null, subPanelContext );
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
};

/**
 * Background Working Context service utility
 */

export default exports = {
    initialize,
    ensureSaveComplete,
    saveUserWorkingContextState,
    reset
};
