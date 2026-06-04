// Copyright (c) 2022 Siemens

/**
 * Service responsible for managing BWC state and local storage expansion
 *
 * @module js/aceRestoreBWCStateService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import awTableStateService from 'js/awTableStateService';
import dateTimeService from 'js/dateTimeService';
import localeService from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import soaSvc from 'soa/kernel/soaService';

var exports = {};
var _eventSubDefs = [];
var nullDate = '0001-01-01T00:00:00+00:00';
const INTERACTED_PRODUCT_UIDS = 'interactedProductUids';
var _invalidCommandsForInteraction = [];

// Populate all the commands which are not considered valid for interaction.
_populateInvalidCommandsForInteraction();

/**
 * Initializes restoreBWCState service.
 */
export let initialize = function( contextKey ) {
    // Subscribe to aw-command-logEvent event
    _eventSubDefs.push( eventBus.subscribe( 'aw-command-logEvent', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                return;
            }

            //Check if command is not valid for interaction. Return from here.
            if( _invalidCommandsForInteraction.includes( eventData.sanCommandId ) ) {
                return;
            }

            // Reset command clear the bookmark and expansion state.
            // No need to fire interaction event. Else it will do the same thing again.
            if( eventData.sanCommandId === 'Awb0ResetStructure' ) {
                addInteractedProductToSessionStorage( currentContext.currentState.uid, contextKey );
                return;
            }
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );

    // Below event gets fired while opening create SWC\Session panel from right toolbar
    _eventSubDefs.push( eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                return;
            }
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );
    // listening to events for dialog panels
    _eventSubDefs.push( eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if( eventData.name === 'activeToolsAndInfoCommand' || eventData.name === 'activeNavigationCommand' ) {
            let currentContext = appCtxService.getCtx( contextKey );
            if( currentContext ) {
                if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                    return;
                }
                eventBus.publish( 'occMgmt.interaction' );
            }
        }
    } ) );

    // Below event gets fired while click on expandBelow
    _eventSubDefs.push( eventBus.subscribe( 'acePwaCommand.aceExpandBelowAction', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                return;
            }
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );

    // Below event gets fired while click on split comamnd
    _eventSubDefs.push( eventBus.subscribe( 'enableSplitMode', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                return;
            }
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );

    // Below event gets fired while clicking 'In-Context' command
    _eventSubDefs.push( eventBus.subscribe( 'toggleInContextOverrideOnSelectedParentAssembly', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            if( currentContext.currentState && isProductInteracted( currentContext.currentState.uid ) ) {
                return;
            }
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );

    //  Below event gets fired while click on SWC creation. Just add SWC to session storage.
    _eventSubDefs.push( eventBus.subscribe( 'swc.objectCreated', function( eventData ) {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext && eventData.createdObject && !isProductInteracted( eventData.createdObject.uid ) ) {
            addInteractedProductToSessionStorage( eventData.createdObject.uid, contextKey );
            var swcCreatedObjectUidCtx = eventData.createdObject.uid;
            appCtxService.updatePartialCtx( 'swcCreatedObjectUid', swcCreatedObjectUidCtx );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'session.signOut', function() {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext ) {
            currentContext.signoutInProgress = true;
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'acePwaCommand.awb0StartTreeEdit', function() {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext && !isProductInteracted( currentContext.currentState.uid ) ) {
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'editHandlerStateChange', function( eventData ) {
        if ( eventData && eventData.state === 'saved' ) {
            var currentContext = appCtxService.getCtx( contextKey );
            if( currentContext && !isProductInteracted( currentContext.currentState.uid ) ) {
                eventBus.publish( 'occMgmt.interaction' );
            }
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function() {
        var currentContext = appCtxService.getCtx( contextKey );
        if( currentContext && !isProductInteracted( currentContext.currentState.uid ) ) {
            eventBus.publish( 'occMgmt.interaction' );
        }
    } ) );
};

export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
};

/** Invoke resetUserWorkingContext SOA
 * @param {*} contextKey - contextKey.
 * @param {*} productContextInfo - Product Context Info UID
 */
export let resetUserWorkingContextState = function( contextKey, productContextInfo ) {
    // reset the _current* variables to null first, so that they dont retain the values from last call.
    var currentContext = appCtxService.getCtx( contextKey );
    var productContext = productContextInfo ? productContextInfo : occmgmtUtils.getObject( currentContext.currentState.pci_uid );
    var soaInput = {
        inputData: {
            productContext: productContext,
            requestPref: {}
        }
    };

    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2020-12-OccurrenceManagement', 'resetUserWorkingContextState', soaInput ).then( function( response ) {
        if( !_.isUndefined( response.requestPref ) && !_.isUndefined( response.requestPref.recipeReset ) && _.isEqual( response.requestPref.recipeReset[ 0 ], 'true' ) ) {
            if( !_.isUndefined( contextKey ) ) {
                var value = {
                    requestPref: {
                        recipeReset: true
                    }
                };
                occmgmtUtils.updateValueOnCtxOrState( '', value, contextKey );
            }
        }
    }, function( error ) {
        throw soaSvc.createError( error );
    } );
};

/** Capture expand toggle tree node action.
 * @param {Object} declViewModel - declViewModel.
 * @param {Object} subPanelContext - subPanelContext.
 */
export let toggleTreeNode = function( declViewModel, occContext, vmNode ) {
    if( !isProductInteracted( occContext.currentState.uid ) ) {
        processProductInteraction( occContext );

        // Update the local storage with expanded node
        var gridId = Object.keys( declViewModel.grids )[ 0 ];
        awTableStateService.saveRowExpanded( declViewModel, gridId, vmNode );
    }
};

/** Return true interaction happened for this product in a session. Except selection other action e.g. command intreaction, expand are
 * considered as interaction.
 * @param {*} uid - Product uid.
 * @return {*} return true jf product uid does not exist in session storage.
 */
export let isProductInteracted = function( uid ) {
    var isProductInteracted = true;
    var interactedProductUids = sessionStorage.getItem( INTERACTED_PRODUCT_UIDS );
    if( !interactedProductUids || interactedProductUids === 'null' || !interactedProductUids.includes( uid ) ) {
        isProductInteracted = false;
    }
    return isProductInteracted;
};

/** Return true interaction happened for this product and auto-bookmark exist for the product.
* @param {*} treeLoadOutput - treeLoadOutput.
* @param {*} uid - Product uid.
* @param {Object} subPanelContext - subPanelContext
* @return {*} return true or false
*/
export let isRestoreOptionApplicable = function( treeLoadOutput, occContext ) {
    // If the isRestoreOptionApplicableForProduct is false, return false
    if( occContext.isRestoreOptionApplicableForProduct === false ) {
        return false;
    }

    var autoSavedSessionDateTime = treeLoadOutput.autoSavedSessiontimeForRestoreOption;

    //For split view, do not show "Restore" option. Always open in default mode, with savedSessionMode as 'restore'
    if( appCtxService.ctx.splitView && appCtxService.ctx.splitView.mode ) {
        return false;
    }

    // Return true in both the condition are true
    // 1. isProductInteracted return false
    // 2. autoSavedSessiontime is not null date
    if( !isProductInteracted( occContext.currentState.uid ) && ( autoSavedSessionDateTime && autoSavedSessionDateTime !== nullDate ) ) {
        return true;
    }
    return false;
};

/** Add interacted product to session storage. Except selection other action e.g. command intreaction, expand are considered as
 *  interaction. Also set isProductInteracted = true which will hide the guidance message.
 * @param {Object} subPanelContext - subPanelContext.
 */
export let processProductInteraction = function( occContext ) {
    var deferred = AwPromiseService.instance.defer();
    if( occContext.vmc && occContext.currentState && !isProductInteracted( occContext.currentState.uid ) ) {
        _executeProductInteraction( occContext );
        occmgmtUtils.updateValueOnCtxOrState( 'isRestoreOptionApplicableForProduct', false, occContext );
        // Clear local storage and auto-bookmark
        eventBus.publish( occContext.vmc.name + '.resetState' );

        // Invoke SOA to clear bookmark.
        return resetUserWorkingContextState( occContext.viewKey );
    }
    deferred.resolve( false );
    return deferred.promise;
};

/**
 * Add product to session storage. Clear auto-bookmark and expansion state from local storage.
 * @param {TreeLoadInput} treeLoadInput - treeLoadInput.
 * @param {*} treeLoadOutput - treeLoadOutput.
 * @param {Object} uwDataProvider - data provider
 * @param {Object} subPanelContext - subPanelContext
 *
 * * @return {*} return true or false
 */
export let addOpenedProductToSessionStorage = function( treeLoadInput, treeLoadOutput, uwDataProvider, occContext ) {
    // If product interaction happened already. No need to proceed further return from here.
    if( isProductInteracted( occContext.currentState.uid ) ) {
        return false;
    }

    let markProductInteracted = false;

    var hasDuplicateData = occmgmtUtils.isFeatureSupported( treeLoadOutput.productContextInfo, 'Awb0HasCloneDataFeature' );
    if( hasDuplicateData ) {
        // If product has duplicate data associated. Add product to session storage.
        // Structure with duplicate data should always open in restore mode. Restore message should not come.
        markProductInteracted = true;
    }else if( !_.isNull( occContext.currentState.topLine_uid ) && !_.isUndefined( occContext.currentState.topLine_uid ) ) {
        // When product is opened in AppConnect window sharing mode,
        // New browser tab is used by TC Vis to open product.
        // In this new tab we want to mark this product as interacted to avoid resetUserWorkingContext SOA
        markProductInteracted = true;
    }

    if( markProductInteracted ) {
        addInteractedProductToSessionStorage( occContext.currentState.uid, occContext.viewKey );
        return false;
    }

    // So far interaction has not happened.
    // if it is not url refresh or restore, just return from here.
    var currentContext = appCtxService.getCtx( occContext.viewKey );
    if( !currentContext.restoreProduct && treeLoadInput.openOrUrlRefreshCase && !_.isEqual( treeLoadInput.openOrUrlRefreshCase, 'urlRefresh' ) ) {
        let restoreOptionApplicable = isRestoreOptionApplicable( treeLoadOutput, occContext );

        if( restoreOptionApplicable ) {
            _formatNUpdateRestoreMessageTime( treeLoadOutput );
        }
        return restoreOptionApplicable;
    }

    // Seems to be interaction case e.g. expand sub-assembly, reset, browser refresh, sorting.
    // Clear the expansion for scenarios like sorting, url refresh
    var clearExpansion = true;
    var clearBookmark = true;

    // Dont clear the auto-bookmark in url refresh case. As it will get updated in getOcc call with current client state(default state).
    // Also same flow takes place in copy paste of URL where auto-bookmark should not be cleared out.
    if( _.isEqual( treeLoadInput.openOrUrlRefreshCase, 'urlRefresh' ) ) {
        clearBookmark = false;
    }

    if( currentContext.restoreProduct ) {
        clearExpansion = true;
        clearBookmark = false;
    }
    // Add product to session storage
    _executeProductInteraction( occContext );

    // Clear local storage
    if( clearExpansion ) {
        eventBus.publish( uwDataProvider.name + '.resetState' );
    }

    // Invoke SOA to clear bookmark.
    if( clearBookmark ) {
        resetUserWorkingContextState( occContext.viewKey, treeLoadOutput.productContextInfo );
    }

    return false;
};

/**
 * Action for restore button on default open state message. Update the session storage with product uid as interacted product.
 * Invoke getOcc SOA as first time open case e.g. no PCI, no C_uid, default request pref
 * @param {object} subPanelContext - subPanelContext
 */
export let restoreProduct = function( subPanelContext ) {
    occmgmtUtils.updateValueOnCtxOrState( 'restoreProduct', true, subPanelContext.contextKey );

    var currentContext = appCtxService.getCtx( subPanelContext.contextKey );
    var productUid = currentContext.currentState.uid;
    let occContextValue = {
        currentState: {
            uid: productUid,
            c_uid: null,
            pci_uid: null,
            o_uid: null,
            t_uid: null,
            spageId: null
        },
        transientRequestPref: {
            startFreshNavigation: 'true',
            savedSessionMode: 'restore',
            retainTreeExpansionStates: true,
            restoreProduct: true
        },
        isRestoreOptionApplicableForProduct: false

    };
    var occContext = subPanelContext.occContext;
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    return { ttState: null };
};

/** Format autoSavedSessionDateTime to show date in 'Today' or 'Yesterday' or in date time format.
 *  @param {*} autoSavedSessionDateTime - autoSavedSessionDateTime.
 *  @param {*} contextKey - contextKey.
 */
function _formatNUpdateRestoreMessageTime( treeLoadOput ) {
    // Get the difference from current date
    var currentDate = new Date();
    var autoSavedSessionDateTime = treeLoadOput.autoSavedSessiontimeForRestoreOption;
    var autoSavedSessionDate = new Date( autoSavedSessionDateTime );
    var dateDiff = autoSavedSessionDate.getDate() - currentDate.getDate();

    // Format the date string as pe
    if( dateDiff === 0 || dateDiff === -1 ) {
        var resource = 'OccurrenceManagementConstants';
        var localeTextBundle = localeService.getLoadedText( resource );
        var autoSavedSessionTime = ', ' + dateTimeService.formatSessionTime( autoSavedSessionDateTime );
    }

    var defaultOpenStateMessageTime = '';
    if( dateDiff === 0 ) {
        defaultOpenStateMessageTime = localeTextBundle.occurrenceManagementTodayTitle.concat( autoSavedSessionTime );
    } else if( dateDiff === -1 ) {
        defaultOpenStateMessageTime = localeTextBundle.occurrenceManagementYesterdayTitle.concat( autoSavedSessionTime );
    } else {
        defaultOpenStateMessageTime = dateTimeService.formatNonStandardDate( autoSavedSessionDateTime, dateTimeService.getSessionDateTimeFormat() );
    }

    //defautlOpenStateMessageTime is there on atomic data now...but somehow, message is shown as undefined in UI. So consuming it from ctx at this point.
    treeLoadOput.defaultOpenStateMessageTime = defaultOpenStateMessageTime;
}

/** Add interacted product to session storage.
 *  @param {*} uid - uid.
 *  @param {*} contextKey - contextKey.
 */
export let addInteractedProductToSessionStorage = function( uid, contextKey ) {
    var currentContext = appCtxService.getCtx( contextKey );
    if( currentContext.signoutInProgress ) {
        return;
    }

    var interactedProductUids = [];
    if( sessionStorage.getItem( INTERACTED_PRODUCT_UIDS ) ) {
        interactedProductUids = JSON.parse( sessionStorage.getItem( INTERACTED_PRODUCT_UIDS ) );
    }
    interactedProductUids.push( uid );
    sessionStorage.setItem( INTERACTED_PRODUCT_UIDS, JSON.stringify( interactedProductUids ) );
};

/** Add interacted product to session storage. Except selection other action e.g. command intreaction, expand are considered as
 *  interaction.
 * @param {Object} occContext - occContext.
 */
function _executeProductInteraction( occContext ) {
    // Interaction in skip auto-bookmark mode are not valid interaction
    // If product interaction has happened no need to proceed further
    if( isProductInteracted( occContext.currentState.uid ) ) {
        return;
    }

    // Add interacted product to session storage
    addInteractedProductToSessionStorage( occContext.currentState.uid, occContext.viewKey );

    // Unsubscribe events
    _.forEach( _eventSubDefs, function( subDef ) {
        if( subDef.topic !== 'swc.objectCreated' ) {
            eventBus.unsubscribe( subDef );
        }
    } );

    return;
}

/**
 * Populate all the commands for which interaction is not valid.
 */
function _populateInvalidCommandsForInteraction() {
    _invalidCommandsForInteraction.push( 'Awp0GoHome' );
    _invalidCommandsForInteraction.push( 'Awp0GoBack' );
    _invalidCommandsForInteraction.push( 'Awp0ShowRootFolders' );
    _invalidCommandsForInteraction.push( 'Awa0ShowPredictions' );
    _invalidCommandsForInteraction.push( 'Awp0GoFavorites' );
    _invalidCommandsForInteraction.push( 'Awp0GoInboxWithoutBubble' );
    _invalidCommandsForInteraction.push( 'Awp0GoChanges' );
    _invalidCommandsForInteraction.push( 'Awp0GoSchedules' );
    _invalidCommandsForInteraction.push( 'Awp0GoScheduleTasks' );
    _invalidCommandsForInteraction.push( 'Awp0ShowAlertWithBubble' );
    _invalidCommandsForInteraction.push( 'Awp0HelpGroup' );
    _invalidCommandsForInteraction.push( 'Awp0Help' );
    _invalidCommandsForInteraction.push( 'Awp0HelpAbout' );
    _invalidCommandsForInteraction.push( 'Cm1NoChangeContext' );
    _invalidCommandsForInteraction.push( 'Awp0GoReports' );
    _invalidCommandsForInteraction.push( 'cmdQuickAccess' );
    _invalidCommandsForInteraction.push( 'Awp0ChangeTheme' );
    _invalidCommandsForInteraction.push( 'Awp0ShowCompactLayout' );
    _invalidCommandsForInteraction.push( 'Awp0ShowComfyLayout' );
    _invalidCommandsForInteraction.push( 'Awp0CommandLabelToggle' );
    _invalidCommandsForInteraction.push( 'Awp0ShowReactiveLogging' );
    _invalidCommandsForInteraction.push( 'cmdViewProfile' );
}

/**
 * ace Restore BWC State Service utility
 */
export default exports = {
    initialize,
    destroy,
    isProductInteracted,
    addOpenedProductToSessionStorage,
    processProductInteraction,
    toggleTreeNode,
    restoreProduct,
    isRestoreOptionApplicable,
    addInteractedProductToSessionStorage
};
