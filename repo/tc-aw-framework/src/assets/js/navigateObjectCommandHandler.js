// Copyright (c) 2020 Siemens

/**
 * This is the command handler for navigate object command which is contributed to cell list. This handler provides
 * command visibility and execution logic.
 *
 * @module js/navigateObjectCommandHandler
 */
import commandsMapSvc from 'js/commandsMapService';
import appCtxService from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Cached CommandsMapService
 */

/**
 * Cached Application Context Service
 */

/**
 * Cached AdapterService
 */

/**
 * Set command context for show object dataset cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
function _setCommandContextIn( context, $scope ) {
    if( commandsMapSvc.isInstanceOf( 'Folder', context.modelType ) ) {
        $scope.cellCommandVisiblilty = true;
    } else {
        $scope.cellCommandVisiblilty = false;
    }
}

/**
 * Set command context for navigate object command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} bCrumbChevronPopup - Breadcrumb chevron popup reference
 */
function _executeAction( context, bCrumbChevronPopup ) {
    // Route the request and let appropriate listeners react to it
    var stateSvc = exports.getState();
    if( stateSvc ) {
        if( context && context.uid ) {
            var selectedObjUid = context.uid;
            var toParams = {};

            if( stateSvc && stateSvc.params ) {
                var newD_uid = '';
                var d_uid = stateSvc.params.d_uids;

                // to support breadcrumb in native and GWT sub location
                var p_uid;
                var scopedObj = appCtxService.getCtx( 'd_uidsChevron' );
                if( scopedObj === undefined ) {
                    p_uid = stateSvc.params.p_uid;
                } else {
                    p_uid = scopedObj.scopedUid;
                }
                var uid = stateSvc.params.uid;

                // remove p_uid and s_uid params
                toParams.p_uid = '';
                toParams.s_uid = '';

                // Add the uid to new route params
                toParams.uid = uid;

                if( p_uid === uid ) {
                    // The root chevron is clicked
                    newD_uid = selectedObjUid;
                } else {
                    // Drilled folder chevron is selected
                    if( d_uid ) {
                        // This command can be executed from cellist in Navigate sublocation or bread crumb widget
                        // Check if the parent uid is part of d_uid and take appropriate action as per algo below:
                        //  Case 1 :
                        //    parent   uid = C
                        //    modelObj uid = D
                        //      d_uid      = A^B^C
                        //      new d_uid  = A^B^C^D
                        //  Case 2 :
                        //    parent   uid = B
                        //    modelObj uid = X
                        //      d_uid      = A^B^C^D^E
                        //      new d_uid  = A^B^X
                        //
                        //  Case 3 : User clicks on the navigate command multiple times in quick succession
                        //    parent   uid = D
                        //    modelObj uid = E
                        //      d_uid      = A^B^C^D^E
                        //      new d_uid  = A^B^C^D^E
                        // build regex from the delimiter and split the d_uids
                        var d_uidsArray = d_uid.split( '^' );

                        for( var counter = 0; counter < d_uidsArray.length; counter++ ) {
                            if( counter > 0 ) {
                                newD_uid += '^';
                            }

                            newD_uid += d_uidsArray[ counter ];

                            if( d_uidsArray[ counter ] === p_uid ) {
                                break;
                            }
                        }

                        // selected obj uid can be already in d_uid if user has clicked the command in quick succession
                        if( newD_uid.lastIndexOf( selectedObjUid ) < 0 ) {
                            newD_uid += '^';
                            newD_uid += selectedObjUid;
                        }
                    } else {
                        newD_uid = !p_uid || uid === p_uid ? selectedObjUid : p_uid + '^' + selectedObjUid;
                    }
                }

                toParams.d_uids = newD_uid;

                // Set the last object as s_uid
                var d_uids = newD_uid.split( '^' );
                if( d_uids.length === 1 && !d_uids[ 0 ] ) {
                    // If empty string use uid instead
                    toParams.s_uid = stateSvc.params.uid;
                } else {
                    // Otherwise use final uid
                    toParams.s_uid = d_uids.slice( -1 )[ 0 ];
                }

                stateSvc.go( stateSvc.current.name, toParams );

                if( bCrumbChevronPopup ) {
                    bCrumbChevronPopup.hide();
                }
                var eventData = {
                    contextUid: context.uid
                };
                eventBus.publish( 'breadcrumb.update', eventData );
            }
        }
    }
}

/**
 * Set command context for navigate object command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    if( context.type === 'Awp0XRTObjectSetRow' ) {
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( [ $scope.vmo ] );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            _setCommandContextIn( adaptedObjs[ 0 ], $scope );
        } );
    } else {
        _setCommandContextIn( context, $scope );
    }
};

/**
 * Retrieve state information
 */
export let getState = function() {
    return AwStateService.instance;
};

/**
 * Set command context for navigate object command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} bCrumbChevronPopup - Breadcrumb chevron popup reference
 */
export let execute = function( context, bCrumbChevronPopup = null ) {
    if( context.type === 'Awp0XRTObjectSetRow' ) {
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( [ context ] );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            _executeAction( adaptedObjs[ 0 ], bCrumbChevronPopup );
        } );
    } else {
        _executeAction( context, bCrumbChevronPopup );
    }
};

exports = {
    setCommandContext,
    getState,
    execute
};
export default exports;
