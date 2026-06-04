// @<COPYRIGHT>@
// ==================================================
// Copyright 2025.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/cbaFocusService
 */

import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cbaConstants from 'js/cbaConstants';
import LocationNavigationService from 'js/locationNavigation.service';
import cdmSvc from 'soa/kernel/clientDataModel';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';

let _eventSubDefs = [];
let _focusedContextMap = {};

/**
 * Initializes the service for Focus Mode
 */
export const initializeService = () => {
    _subscribeEvents();
};

/**
 * Destroys the service for Focus Mode
 */
export const destroyService = () => {
    _unSubscribeEvents();
};

/**
 * Subscribes to the 'cba.enableFocusMode' and 'cba.disableFocusMode' events if not already subscribed.
 * Adds the event subscriptions to the _eventSubDefs array.
 */
const _subscribeEvents = () => {
    if( _eventSubDefs.length === 0 ) {
        _eventSubDefs.push( eventBus.subscribe( 'cba.enableFocusMode', enableFocusMode ) );
        _eventSubDefs.push( eventBus.subscribe( 'cba.disableFocusMode', disableFocusMode ) );
    }
};

/**
 * Unsubscribes from all events defined in the _eventSubDefs array and clears the array.
 * Iterates over each subscription definition in the _eventSubDefs array and unsubscribes from the event using the eventBus.
 * After unsubscribing from all events, it resets the _eventSubDefs array to an empty state.
 */
const _unSubscribeEvents = () => {
    _.forEach( _eventSubDefs, function( subDef ) {
        if( subDef ) {
            eventBus.unsubscribe( subDef );
        }
    } );
    _eventSubDefs.length = 0;
};

/**
 * Enables focus mode for a given event data.
 *
 * @param {Object} eventData - The event data containing information to enable focus mode.
 */
export const enableFocusMode = ( eventData ) => {
    if( eventData ) {
        _focusedContextMap[eventData.sourceOccContext?.viewKey] = eventData.sourceRootOcc;
        _toggleFocusModeOnSelectedParentAssemblyInTreeView( eventData.srcViewKey, eventData.sourceRootOcc, eventData.sourceRootElement, eventData.sourceOccContext );
    }
};

/**
 * Disables the focus mode for the given event data.
 *
 * @param {Object} eventData - The event data containing the occurrence contexts.
 */
export const disableFocusMode = ( eventData ) => {
    if( eventData?.occContexts ) {
        eventData.occContexts.forEach( occContext => {
            if( occContext?.viewKey in _focusedContextMap ) {
                let loadedVMOs = occContext?.vmc?.getLoadedViewModelObjects();
                // Fix Console error: LCS-1183880
                if( loadedVMOs && loadedVMOs.length > 0 ) {
                    // Remove the 'isGreyedOutElement' flag from each loaded VMO
                    loadedVMOs.forEach( ( vmo ) => delete vmo.isGreyedOutElement );
                    occContext?.treeDataProvider.update( loadedVMOs );
                }
            }
        } );
    }

    // Update the context to turn off the Focus Mode toggle in the panel
    appCtxService.updatePartialCtx( cbaConstants.CTX_PATH_FOCUS_MODE, false );
};

/**
 * Parent Assembly on which "Set In-Context" is applied
 * @param {Array} loadedVMOs The loaded view model objects.
 * @returns {ViewModelObject} on which "Set In-Context" is applied
 */
function _getCurrentContextOverriddenVMO( loadedVMOs ) {
    return loadedVMOs.filter( function( vmo ) { return vmo.isInContextOverrideSet; } )[ 0 ];
}

/**
 * Populate parent nodes to greyed-out state
 * @param {Object} vmo - The view model object to populate parent nodes to greyed-out state.
 */
function _populateParentNodesToGreyedOutState( vmo ) {
    let vmoChildren =  vmo.__expandState ? vmo.__expandState.children : vmo.children;
    _.forEach( vmoChildren, function( vmoChild ) {
        vmoChild.isGreyedOutElement = true;
        if( vmoChild.__expandState || vmoChild.children ) {
            _populateParentNodesToGreyedOutState( vmoChild );
        }
    } );
}

/**
 * Set the VMOs in a greyed-out state.
 * @param {Array} loadedVMOs - The loaded view model objects.
 * @param {Object} vmoToApplyContextOverrideOn - The ViewModelObject to apply context override on.
 * @returns {Array} The updated view model objects.
 */
function _setVMOsInGreyedOutState(  loadedVMOs, vmoToApplyContextOverrideOn ) {
    for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
        loadedVMOs[ ndx ].isGreyedOutElement = true;
        // Should not apply greyed-out state on the children of selected node
        if( loadedVMOs[ ndx ].id !== vmoToApplyContextOverrideOn.id && loadedVMOs[ ndx ].__expandState ) {
            _populateParentNodesToGreyedOutState( loadedVMOs[ndx] );
        }
    }
    return loadedVMOs;
}

/**
 * Set Focus Mode on the provided assembly.
 * @param {Object} vmoToApplyContextOverrideOn - The ViewModelObject to apply context override on.
 * @param {Object} sourceOccContext - The source occurrence context.
 */
function _setFocusModeOnProvidedAssembly( vmoToApplyContextOverrideOn, sourceOccContext ) {
    let begNdx = -1;
    let nDelete = 0;

    let vmosToBeGreyedOut = _setVMOsInGreyedOutState( sourceOccContext.vmc.getLoadedViewModelObjects(), vmoToApplyContextOverrideOn );

    //Set inContextOveride on VMO under action.
    vmoToApplyContextOverrideOn.isInContextOverrideSet = true;

    //Delete isGreyedOutElement property on VMO under action and all its children.
    delete vmoToApplyContextOverrideOn.isGreyedOutElement;

    for( var ndx = 0; ndx < vmosToBeGreyedOut.length; ndx++ ) {
        if( vmosToBeGreyedOut[ ndx ].id === vmoToApplyContextOverrideOn.id ) {
            begNdx = ndx + 1;
            nDelete = 0;
        } else if( begNdx >= 0 ) {
            if( vmosToBeGreyedOut[ ndx ].levelNdx > vmoToApplyContextOverrideOn.levelNdx ) {
                nDelete++;
            } else {
                break;
            }
        }
    }

    //TODO : probable data mutation case
    for( ndx = 0; ndx < nDelete; ndx++ ) {
        delete vmosToBeGreyedOut[ begNdx + ndx ].isGreyedOutElement;
    }
    sourceOccContext.treeDataProvider.update( vmosToBeGreyedOut );
}

/**
 * Toggles the Focus Mode on the selected parent assembly in the tree view.
 * @param {string} srcViewKey - The source view key.
 * @param {Object} sourceRootOcc - The source root occurrence.
 * @param {Object} sourceRootElement - The source root element.
 * @param {Object} sourceOccContext - The source occurrence context.
 */
function _toggleFocusModeOnSelectedParentAssemblyInTreeView( srcViewKey, sourceRootOcc, sourceRootElement, sourceOccContext ) {
    let currentVMC = appCtxService.getCtx( srcViewKey )?.vmc;

    if( currentVMC ) {
        let vmoIdToApplyContextOverrideOn = currentVMC.findViewModelObjectById( sourceRootOcc.uid );

        if( vmoIdToApplyContextOverrideOn === -1 ) {
            let vmosInTree = currentVMC.getLoadedViewModelObjects();
            vmoIdToApplyContextOverrideOn = vmosInTree.findIndex( ( obj ) => {
                if ( obj?.props?.awb0CopyStableId ) {
                    return obj.props.awb0CopyStableId.dbValues[0] === sourceRootElement.props.awb0CopyStableId.dbValues[0];
                }
                // When select object under Partition and launch Guided Update Page from ACE, Focus Mode toggle should be ON
                let vmo = cdmSvc.getObject( obj?.uid );
                return vmo?.props?.awb0CopyStableId?.dbValues[0] === sourceRootElement.props.awb0CopyStableId.dbValues[0];
            } );
        }

        if( vmoIdToApplyContextOverrideOn !== -1 ) {
            var loadedVMOs = currentVMC.getLoadedViewModelObjects();
            var vmoToApplyContextOverrideOn = loadedVMOs[ vmoIdToApplyContextOverrideOn ];

            var currentContextOverriddenVMO = _getCurrentContextOverriddenVMO( loadedVMOs );

            //TODO : probable data mutation case
            if( currentContextOverriddenVMO ) {
                delete currentContextOverriddenVMO.isInContextOverrideSet;
            }

            _setFocusModeOnProvidedAssembly( vmoToApplyContextOverrideOn, sourceOccContext );
            eventBus.publish( 'reRenderTableOnClient' );
            eventBus.publish( 'overridenContextChanged' );


            // Case#1: Select Skip nide, turn ON/OFF Show Redlines toggle, select the top node and open in ACE, then go back to Guided Update page from ACE
            // Should update the selectedIA_uid after the table reload. Otherwise, the table will be collapsed after go back
            // Case#2: Select DBOM object and launch Guided Update panel from ACE/CBA by clicking Guided Update command from align group,
            // Click EBOM object and update Guided Update panel by clicking Context Menu
            // Open Top node of EBOM in ACE, then go back to Guided Update page from ACE, the panel should not be empty
            const toParams = appCtxService.getCtx( 'state.params' );
            if ( toParams.selectedIA_uid !== vmoToApplyContextOverrideOn.uid ) {
                Object.assign( toParams, {
                    selectedIA_uid: vmoToApplyContextOverrideOn.uid,
                    adaptObj_uid: sourceOccContext.topElement.props.awb0UnderlyingObject.dbValues[0]
                } );
                LocationNavigationService.instance.go( 'CADBOMAlignment', toParams );
            }

            // Update the context to turn on the Focus Mode toggle in the panel
            appCtxService.updatePartialCtx( cbaConstants.CTX_PATH_FOCUS_MODE, true );
        }else if ( !CBAImpactAnalysisService.isGuidedUpdatelaunchedFromACE() ) {
            // TODO: Need to fix the Issue: LCS-1164581 - Cannot get the selected part uid from current VMC when launch Guided Update from EBOM at the first time
            // Fix the Defect: LCS-1158489 - Tc2506_GUFocusMode: Focus mode toggle state is Off by default if guided update panel launched from ACE on part.
            // For Usage BOM, when launch Guided Update panel from ACE (from EBOM to DBOM), cannot find the selected object in currentVMC, so do not turn off the Focus Mode toggle,
            // we can enable the focus mode after loadTreeTableProperties (fire enableFocusMode event again after loadTreeTableProperties in CbaSplitTrgTreeViewModel.json)
            // Update the context to turn off the Focus Mode toggle in the panel
            appCtxService.updatePartialCtx( cbaConstants.CTX_PATH_FOCUS_MODE, false );
        }
    }
}

const exports = {
    initializeService,
    destroyService,
    enableFocusMode,
    disableFocusMode
};
export default exports;
