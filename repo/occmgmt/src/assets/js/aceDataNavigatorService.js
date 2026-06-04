// Copyright (c) 2022 Siemens

/**
 * @module js/aceDataNavigatorService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import Debug from 'debug';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';
import cadBomOccurrenceAlignmentSvc from 'js/CadBomOccurrenceAlignmentService';
import editHandlerSvc from 'js/editHandlerService';
import ctxStateMgmtService from 'js/aceContextStateMgmtService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import { urlParamsMap } from 'js/aceUrlManagementService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import acePartialSelectionService from 'js/acePartialSelectionService';
import aceStructureConfigurationService from 'js/aceStructureConfigurationService';
import narrowMode from 'js/aw.narrowMode.service';
import aceUrlManagementService from 'js/aceUrlManagementService';
import aceServiceManager from 'js/aceServiceManager';
import occmgmtGetSvc from 'js/aceGetService';
import propertyPolicyService from 'soa/kernel/propertyPolicyService';
import logger from 'js/logger';
import awStateService from 'js/awStateService';
const trace = new Debug( 'selection' );

var exports = {};

let onSelectionChangeExtPointHandlers = {};

/**
 * Function to initialize the data navigator component.
 *
 * @internal
 *
 * @param {object} subPanelContext SubPanelContext
 * @param {String} propContextKey view key that represent the view
 * @param {object} aceSearchPolicyOverride Ace serach policy to be used
 * @param {String} useAceDefaultInitializationService Flag indicating if ace initialization services to be used or not
 */
export let initializeDataNavigator = async function( subPanelContext, propContextKey, aceSearchPolicyOverride, useAceDefaultInitializationService ) {
    //TOCHECK : When key is present in subPanelContext, why are we re-populating it?
    const contextKey = propContextKey ? propContextKey : subPanelContext.provider.contextKey;

    if( narrowMode.isNarrowMode() ) {
        subPanelContext.provider.defaultDisplayMode = 'TreeView';
    }
    if( useAceDefaultInitializationService !== 'false' ) {
        const useAutoBookmark = subPanelContext.provider.useAutoBookmark;
        let initialOccContext = aceUrlManagementService.updateState( subPanelContext, true );
        //Context registration is different for CBA and Duplicate, so can not take outside of useAceDefaultInitializationService if block
        registerContext( contextKey, subPanelContext.provider, initialOccContext, subPanelContext.baseSelection, aceSearchPolicyOverride );
        aceServiceManager.initializeOccMgmtServices( contextKey, useAutoBookmark, subPanelContext.provider );
    }
    if( aceSearchPolicyOverride ) {
        appCtxSvc.registerCtx( 'aceSearchPolicyOverride', aceSearchPolicyOverride );
    }
    if( subPanelContext.occContext.delayLoadSublocation ) {
        let urlParams = aceUrlManagementService.getUrlParamMapForCurrentContext( subPanelContext.provider );
        let c_uid = awStateService.instance.params[ urlParams.selectionQueryParamKey];
        if( !_.isUndefined( c_uid ) && c_uid !== null && c_uid !== '' ) {
            let occContext = subPanelContext.occContext;
            let occContexValue = { ...occContext.getValue() };
            occContexValue.delayLoadSublocation = false;
            occmgmtUtils.updateValueOnCtxOrState( '', occContexValue, subPanelContext.occContext, false );
        } else{
            const propertyPolicyId = subPanelContext.provider.policy && await propertyPolicyService.registerPolicyAsync( subPanelContext.provider.policy );
            _delayLoadPwaBasedUponContents( subPanelContext );
        }
    }

    return {
        contextKey,
        alternateSelection: null
    };
};

/**
 * Function to register the context for ACE.
 *
 *
 * @param {String} contextKey view key that represent the view
 * @param {object} provider provider which provides the information about clientScopeURI, requestPref, urlParams, etc
 * @param {object} occContext Atomic data of ACE with initial values
 * @param {String} baseSelection Selection to fall back on when there is no selection in PWA
 * @param {object} aceSearchPolicyOverride Ace serach policy to be used
 */


let registerContext = function( contextKey, provider, occContext, baseSelection, aceSearchPolicyOverride ) {
    let sublocationVal = {
        clientScopeURI: provider.clientScopeURI,
        defaultClientScopeURI: provider.clientScopeURI
    };
    // we are setting columnsToExclude parameters on context
    // specific feature/application can set this for visibility of specific columns until
    // support from framework is available.
    let columnsToExclude = [ 'Awb0ConditionalElement.awb0PendingAction', 'Awb0PositionedElement.pma1UpdateAction', 'Awb0DesignElement.pma1LastAlignedPart',
        'Awb0DesignElement.REF(pma1LastAlignedPart,ItemRevision).release_status_list',
        'Awb0PartElement.pma1LastAlignedDesign', 'Awb0PartElement.REF(pma1LastAlignedDesign,ItemRevision).release_status_list', 'Awb0ConditionalElement.awb0MarkupType'
    ];
    let contextVal = {
        currentState: occContext.currentState,
        previousState: occContext.previousState,
        pwaSelectionModel: {},
        requestPref: provider.requestPref,
        transientRequestPref: {},
        persistentRequestPref: {
            showExplodedLines: false
        },
        expansionCriteria: {},
        urlParams: aceUrlManagementService.getUrlParamMapForCurrentContext( provider ),
        modelObject: baseSelection,
        /*
         *For Now commenting below isMarkupModeEnable as it causing regression for MarkupMode not
         *remain in markup mode after refresh : LCS-820510
         */
        //isMarkupEnabled: false,
        treeLoadingInProgress: true,
        sublocation: sublocationVal,
        columnsToExclude: columnsToExclude
    };
    if( appCtxSvc.ctx.splitView ) {
        if( appCtxSvc.ctx.splitView.resetTreeExpansionState && appCtxSvc.ctx.splitView.resetTreeExpansionState[ contextKey ] ) {
            contextVal.resetTreeExpansionState = true;
            delete appCtxSvc.ctx.splitView.resetTreeExpansionState[ contextKey ];
        }
    } else if( appCtxSvc.ctx.resetTreeExpansionState ) {
        contextVal.resetTreeExpansionState = true;
        appCtxSvc.unRegisterCtx( 'resetTreeExpansionState' );
    }
    appCtxSvc.registerCtx( contextKey, contextVal );
    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[ contextKey ]
    } );
};

export let destroyDataNavigator = function( subPanelContext, useAceDefaultInitializationService ) {
    if( useAceDefaultInitializationService !== 'false' ) {
        let currentContext = appCtxSvc.getCtx( subPanelContext.provider.contextKey );
        // Fix for LCS-852827
        // All the functions from occmgmtContext needs to be deference otherwise the garbage collector will not able to clean the memory from the heap.
        if( currentContext ) {
            unsetReferencesRecursively( currentContext.vmc, true );
            unsetReferencesRecursively( currentContext.treeDataProvider, true );
            occmgmtUtils.updateValueOnCtxOrState( '', currentContext, subPanelContext.provider.contextKey );
        }

        // Remove the reference for dispatch when destroying the sublocation
        let occmgmtContextValue = { ...subPanelContext.occContext.getValue() };
        occmgmtContextValue.updateOccContextStateOnTree = null;
        occmgmtUtils.updateValueOnCtxOrState( '', occmgmtContextValue, subPanelContext.occContext );

        appCtxSvc.unRegisterCtx( 'searchResponseInfo' );
        aceServiceManager.destroyOccMgmtServices( subPanelContext );
        appCtxSvc.unRegisterCtx( subPanelContext.provider.contextKey );
        if( !appCtxSvc.ctx.splitView ) {
            appCtxSvc.unRegisterCtx( 'aceActiveContext' );
        }
    }
    appCtxSvc.unRegisterCtx( 'isRedLineMode' );
    delete appCtxSvc.ctx[ 'ActiveWorkspace:xrtContext' ];
};

var unsetReferencesRecursively = function( Object, isFirstLevelObject ) {
    for ( let key in Object ) {
        if( typeof Object[key] === 'object' && isFirstLevelObject ) {
            unsetReferencesRecursively( Object[key], false );
        } else{
            Object[key] = null;
        }
    }
};

function _delayLoadPwaBasedUponContents( subPanelContext ) {
    let occContext = subPanelContext.occContext;
    let currentContext = appCtxSvc.ctx[subPanelContext.occContext.viewKey];
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    let contextState = {
        context: currentContext,
        occContext: occContext.getValue()
    };

    let treeLoadInput = {};
    treeLoadInput.loadIDs = {
        uid: subPanelContext.openedObject.uid
    };
    treeLoadInput.parentElement = subPanelContext.openedObject.uid;
    treeLoadInput.displayMode = 'Tree';

    return occmgmtGetSvc.getOccurrences( treeLoadInput, soaInput, contextState ).then(
        function( response ) {
            let occContexValue = { ...occContext.getValue() };

            occContexValue.delayLoadSublocation = false;

            if ( !_.isEmpty( response.parentChildrenInfos ) && _.first( response.parentChildrenInfos ).childrenInfo.length > 0 ) {
                occContexValue.transientRequestPref = {
                    getOccResponse: response
                };
            } else {
                occContexValue.AceHeaderForApplication = subPanelContext.provider.AceHeaderForApplication;
                occContexValue.hidTreeForEmptyContents = true;
                subPanelContext.provider.supportedLayouts = subPanelContext.provider.supportedLayoutsForEmptyBOMTab;
            }

            occmgmtUtils.updateValueOnCtxOrState( '', occContexValue, subPanelContext.occContext, false );
        } );
}

/**
    * @param {Object} newState - Changed param-value map
    *
    * @return {Boolean} true if there is any change compared to existing values
    */
function _haveTopParamsOrTheirValuesChanged( newState, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
            * Check if we don't care about this parameter.
            */
        if( name !== 't_uid' || name === 'uid' ) {
            return true;
        }

        if(
            !previousState || !previousState.hasOwnProperty( name ) ||
               previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} // _haveTopParamsOrTheirValuesChanged

/**
    * @param {Object} newState - changed param-value map
    *
    * @return {Boolean} true if there is any change compared to existing values
    */
function _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
            * Check if we don't care about this parameter. Eventually, we want to stop reload via currentState route.
            * Setting atomic data with pwaReset to true should be the way forward.
            *
            * Long term :
            * 1) Stop listening to currentState update in awDataNavigatorViewModel.json
            * 2) Reload call in syncPWASelection call.
            * 3) Looking for URL param updates for reload decision
            * 4) Let applications directly say that they want to reset.
            */
        if( name === 'h_uid' || name === 'page' || name === 'pageId' || name === urlParamsMap.selectionQueryParamKey ||
               name === 'pci_uid' || name === 'spageId'  || name === 'altPwa' || name === 'altPwa_2' || name === 'incontext_uid' || name === 'filter' || name === 'uid' ) {
            return true;
        }

        /**
            * We don't care about o_uid changes when we are in tree viewMode.
            */
        // revisitMe - viewConfig will not be available on subPanelContext (It was done by aw.nav.controller - which is no more applicable)
        if( name === 'o_uid' ) { // && subPanelContext.viewConfig.view === 'tree' ) {
            return true;
        }

        if( !previousState || !previousState.hasOwnProperty( name ) ||
               previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} //_havePwaParamsOrTheirValuesChanged

function _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) {
    var remoteSubsetSelected = false;
    var isObjectBOMWorkset = false;
    if( parentObject && parentObject.props && parentObject.props.awb0UnderlyingObject ) {
        var underlyingObjUid = parentObject.props.awb0UnderlyingObject.dbValues[ 0 ];
        var modelObjForUnderlyingObj = cdm.getObject( underlyingObjUid );
        if( modelObjForUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            isObjectBOMWorkset = true;
            if( selectedObject && selectedObject.props && selectedObject.props.awb0ArchetypeId && selectedObject.props.awb0ArchetypeId.dbValues[ 0 ] === '' ) {
                remoteSubsetSelected = true;
            }
        }
    }
    return remoteSubsetSelected || !isObjectBOMWorkset;
} // _isValidToRetrievePCIFromHierarchy

var reloadPrimaryWorkArea = function( newState, subPanelContext, previousState, pwaSelectionModel ) {
    if( occmgmtUtils.isTreeView() && _haveTopParamsOrTheirValuesChanged( newState, previousState ) ) {
        resetPwaContents( pwaSelectionModel, subPanelContext.provider.editContext );
    } else if( _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) ) {
        resetPwaContents( pwaSelectionModel, subPanelContext.provider.editContext );
    }
};

export let getParentUid = function( view, currentState ) {
    if( view === 'tree' ) {
        return currentState.t_uid;
    }
    return currentState.o_uid;
};

/**
    * Ensure the correct object is selected
    *
    * @param {String} uidToSelect - The uid of the object that should be selected
    */
let updatePWASelection = function( subPanelContext, uidToSelect, pwaSelectionModel ) {
    let contextKey = subPanelContext.contextKey;
    let newSelection = [];
    let currentSelection = pwaSelectionModel.getSelection();
    let currentState = subPanelContext.occContext.currentState;
    /*Control comes to this function when we update current state. From different flows like select on open, select on cross select,
       select on pwa selection. When currentState is updated by some source to update selection ( source like breadcrumb ),
       this API updates pwaSelection for us. But when user select in pwa itself, this call is redundant as selection is already present
       in selection model. But control comes here as we update currentState to keep state in sync. We should do nothing if selection present */
    if( !_.isEmpty( currentSelection ) && currentSelection.indexOf( uidToSelect ) !== -1 ) {
        return;
    }

    //If multi select is enabled ignore single select changes
    if( uidToSelect && ( subPanelContext.occContext.pwaSelection?.length < 2 || currentState.o_uid !== currentState.c_uid ) ) {
        let parentUid = getParentUid(  'tree', currentState  );
        if( ( occmgmtUtils.isTreeView() || occmgmtUtils.isResourceView() ) && uidToSelect === parentUid  && subPanelContext.occContext.showTopNode ) {
            /*TODO : after standard sub-location adoption, base-selection is broken.
                 Commenting this. It will affect Port selection from Architecture tab (need to check flow in new world)
                 */
            newSelection = []; //[ uidToSelect ];
        } else if( uidToSelect === parentUid && ( subPanelContext.occContext.pwaSelection?.length < 2 && !pwaSelectionModel.isMultiSelectionEnabled() ) ) {
            //Ensure the base selection is the only selection
            newSelection = [];
        } else {
            //set new selection if markUpEnabled and not in multiselect.
            //Add new uid to selection if more than one selectedobjects
            if( uidToSelect !== parentUid ) {
                if( subPanelContext.occContext.pwaSelection?.length  > 1 || pwaSelectionModel.isMultiSelectionEnabled() ) {
                    pwaSelectionModel.addToSelection( [ uidToSelect ] );
                    return;
                }
                newSelection = [ uidToSelect ];
            }
        }
    }


    if( !_.isEqual( currentSelection, newSelection ) ) {
        var newSelections = newSelection.map( function( selectedUid ) {
            return cdm.getObject( selectedUid );
        } );
        pwaSelectionModel.setSelection( newSelection );
        //pwaSelectionModel.selectionData.update( { selected: newSelections } );
    }
};

export let syncContextWithPWASelection = function( eventData, subPanelContext, contextKey, pwaSelectionModel ) {
    var newState;
    var previousState;
    if( eventData ) {
        newState = eventData.value[ contextKey ].currentState;
        previousState = eventData.value[ contextKey ].previousState;
    } else {
        newState = subPanelContext.occContext.currentState;
        previousState = subPanelContext.occContext.previousState;
    }
    //Tree will be loaded by dataProvider on 1st load. No need to force reload PWA. It triggers multiple SOA calls.
    if( _.isEmpty( previousState ) ) {
        return;
    }
    reloadPrimaryWorkArea( newState, subPanelContext, previousState, pwaSelectionModel );
    if( newState.hasOwnProperty( urlParamsMap.selectionQueryParamKey ) && newState[ urlParamsMap.selectionQueryParamKey ] !== null ) {
        updatePWASelection( subPanelContext, newState[ urlParamsMap.selectionQueryParamKey ], pwaSelectionModel );
    }
};


/**
    * @param {Object} selectedObject Object representing selection made by the user
    * @param {Object} occContext Object representing ACE atomic data
    *
    * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
    *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
    */
export let getProductInfoForCurrentSelection = function( selectedObject, occContext ) {
    //Default productInfo is current info
    let productInfo = {
        newPci_uid: _getDefaultProductContextInfo( selectedObject, occContext )
    };
    let elementToPCIMap = occContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var parentObject = selectedObject;
        do {
            if( parentObject && elementToPCIMap[ parentObject.uid ] ) {
                productInfo.rootElement = parentObject;
                productInfo.newPci_uid = elementToPCIMap[ parentObject.uid ];

                return productInfo;
            }

            var parentUid = occmgmtUtils.getParentUid( parentObject );
            parentObject = cdm.getObject( parentUid );
        } while( parentObject && _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) );
    } else {
        productInfo.rootElement = occContext.topElement;
    }

    return productInfo;
};

/**
    * @param {Object} selectedObject Object representing selection made by the user
    * @param {Object} occContext Object representing ACE atomic data
    *
    * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
    *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
    */
function _getDefaultProductContextInfo( selectedObject, occContext ) {
    let pci_uid = occContext.currentState.pci_uid;
    if( selectedObject && selectedObject.props && selectedObject.props && selectedObject.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 ) {
        for( var k in occContext.elementToPCIMap ) {
            let pci = occContext.elementToPCIMap[ k ];
            let pciObject = cdm.getObject( pci );
            if( pciObject ) {
                let productObject = cdm.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                if( productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                    pci_uid = pci;
                    break;
                }
            }
        }
    }
    return pci_uid;
}

export const updatePwaContextInformation = ( data, subPanelContext, pwaSelectionModel ) => {
    const alternateSelection = subPanelContext.occContext.baseModelObject;
    let currentContext = appCtxSvc.getCtx( subPanelContext.occContext.viewKey );
    // ToDo - Remove below line once selectedModelObjects is removed from appCtx
    if( _hasSelectionsChanged( subPanelContext.occContext.pwaSelection, currentContext.pwaSelection )  ) {
        appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.pwaSelection', subPanelContext.occContext.pwaSelection );
    }
    //Caller should clearly inform which object to select to avoid any ambiguity
    if( subPanelContext.occContext.pwaSelection !== undefined ) {
        onSelectionChange( data, subPanelContext, data.contextKey, {
            source: 'server',
            selected : subPanelContext.occContext.pwaSelection
        }, pwaSelectionModel, null, subPanelContext.occContext.lastDpAction );
    }
    return alternateSelection;
};

export const _areObjectsToHighlightValid = ( objectsToHighlight ) => {
    let verdict = false;

    _.forEach( objectsToHighlight, function( objectToHighlight ) {
        if( objectToHighlight.uid !== cdm.NULL_UID ) {
            verdict = true;
        }
    } );

    return verdict;
};

export const _isObjectToHighlightLoadedInPWA = ( loadedVMOs, objectToHighlightUid ) => {
    let verdict = false;

    for( let i = 0; i < loadedVMOs.length; i++ ) {
        if( loadedVMOs[i].uid === objectToHighlightUid ) {
            verdict = true;
            break;
        }
    }

    return verdict;
};

export const addUpdatedSelectionToPWA = ( data, eventData, contextKey, selectionModel, subPanelContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        let selectionsToModify = {
            elementsToSelect: eventData.objectsToSelect,
            objectsToHighlight:eventData.objectsToHighlight,
            overwriteSelections: true,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };
        //Select & highlight objects provided by the event
        modifyPwaSelections( selectionModel, subPanelContext.occContext, selectionsToModify, subPanelContext );
    }
};

export const removeSelectionFromPWA = ( eventData, contextKey, subPanelContext, occContext, alternateSelection ) => {
    if( eventData.elementsToDeselect && eventData.elementsToDeselect.length > 0 ) {
        let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
        if( contextKey === viewToReact ) {
            // Update selections by removing elements to deselect from current selections
            let occContextValue = { ...occContext.getValue() };
            let newSelection = _.clone( occContextValue.pwaSelection );
            for( let i = 0; i < eventData.elementsToDeselect.length; i++ ) {
                newSelection.splice( newSelection.indexOf( eventData.elementsToDeselect[i], 1 ) );
            }
            if( _.isEmpty( newSelection ) ) {
                // If all selections are removed, then default to topElement
                newSelection = [ occContextValue.topElement ];
            }
            _processSelectionChange( occContextValue, newSelection, subPanelContext, alternateSelection );
        }
    }
};

export const addSelectionToPWA = ( eventData, contextKey, selectionModel, occContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        let selectionsToModify = {
            elementsToSelect: eventData.elementsToSelect,
            overwriteSelections: eventData.overwriteSelections,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };
        modifyPwaSelections( selectionModel, occContext, selectionsToModify );
    }
};

export const modifyPwaSelections = ( selectionModel, occContext, selectionsToModify, subPanelContext ) => {
    let occContextValue = { ...occContext.getValue() };

    selectionsToModify = selectionsToModify ? selectionsToModify : occContextValue.selectionsToModify;

    if( !_.isEmpty( selectionsToModify.elementsToSelect ) || _.isEqual( selectionsToModify.overwriteSelections, true ) ) {
        let lastSelected = _.last( selectionsToModify.elementsToSelect );
        let overwriteWithEmptySelections = _.isEmpty( selectionsToModify.elementsToSelect ) && selectionsToModify.overwriteSelections;

        // newPwaSelections contains all visible and hidden selections in PWA
        let newPwaSelections = selectionsToModify.elementsToSelect;
        occContextValue.selectionSyncInProgress = selectionsToModify.elementsToSelect.length > 1;
        if( occContextValue.selectionSyncInProgress ) {
            occContextValue.elementsToCrossSelect = selectionsToModify.elementsToSelect;
        }

        if( selectionsToModify.nodeToExpandAfterFocus ) {
            occContextValue.transientRequestPref.nodeToExpandAfterFocus = selectionsToModify.nodeToExpandAfterFocus;
        }
        if( selectionsToModify.overwriteSelections ) {
            selectionModel.setSelection( selectionsToModify.elementsToSelect );
        } else {
            if( selectionModel.getCurrentSelectedCount() > 1 || selectionModel.multiSelectEnabled ) {
                occContextValue.elementsToCrossSelect = _.union( occContextValue.pwaSelection, selectionsToModify.elementsToSelect );
                newPwaSelections = occContextValue.elementsToCrossSelect;
                selectionModel.addToSelection( selectionsToModify.elementsToSelect );
            } else {
                selectionModel.setSelection( selectionsToModify.elementsToSelect );
            }
        }

        occContextValue.selectionsToModify = {};

        if ( _areObjectsToHighlightValid( selectionsToModify.objectsToHighlight ) ) {
            let  objectsToHighlightUids = _.map( selectionsToModify.objectsToHighlight, 'uid' );
            let  objectsToSelectUids = _.map( selectionsToModify.elementsToSelect, 'uid' );
            let gridId;
            let partialSelectionData = {
                objectsToSelect:selectionsToModify.elementsToSelect,
                objectsToHighlight:selectionsToModify.objectsToHighlight,
                viewToReact:occContext.viewKey
            };

            if( subPanelContext.provider ) {
                gridId = subPanelContext.provider.gridId;
            }

            occContextValue.transientRequestPref = {
                objectsToHighlightUids:objectsToHighlightUids,
                objectsToSelectUids:objectsToSelectUids
            };

            let objectToHighlightUid = _.last( occContextValue.transientRequestPref.objectsToHighlightUids );

            acePartialSelectionService.setPartialSelection( partialSelectionData, gridId );
            occContextValue.currentState.h_uid = objectToHighlightUid;
            // Page level toolbar commands rely on selectionData.selected hence, this update is needed
            // Also, it triggers primaryWorkArea.selectionChangeEvent for nonpack master lines
            // Defects reference - LCS-1199649, LCS-1195589
            // TODO: Cleanup needed when we have a holistic fix in framework layer for this issue
            selectionModel.selectionData.update( { selected: newPwaSelections } );
        }

        //We cannot have empty c_uid in session. I see this deletion of c_uid was promoted for compare long back
        //Compare is using this in wrong way. they should use elementsToDeselect structure instead.
        if( overwriteWithEmptySelections ) {
            occContextValue.currentState.c_uid = occContextValue.currentState.t_uid;
            occContextValue.currentState.o_uid = occContextValue.currentState.t_uid;
        } else {
            occContextValue.currentState.c_uid = lastSelected?.uid;
        }
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
    if( !_.isEmpty( selectionsToModify.elementsToDeselect ) || _.isEqual( selectionsToModify.clearExistingSelections, true ) ) {
        var selectionsToClear = selectionsToModify.elementsToDeselect ? selectionsToModify.elementsToDeselect : selectionModel.getSelection();
        selectionModel.removeFromSelection( selectionsToClear );

        occContextValue.selectionsToModify = {};
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
};

/**
 * Get the XRTContext based on newly selected object
 * @param {*} subPanelContext subPanelContext
 * @param {*} selectedModelObject Newly selected object
 * @returns XRTContext with updated PCI information
 */
function _getXRTContextForPrimarySelection( subPanelContext, selectedModelObject ) {
    let xrtContext = subPanelContext.occContext.xrtContext;

    if( !xrtContext ) {
        xrtContext = {};
    }
    if( subPanelContext.occContext.productContextInfo ) {
        xrtContext.productContextUid = subPanelContext.occContext.productContextInfo.uid;
    }
    xrtContext.selectedUid = selectedModelObject.uid;

    return xrtContext;
}

export let onSelectionChangeForPrimary = function( data, subPanelContext, contextKey, old_selectionData, pwaSelectionModel, parentSelectionData, lastDpAction ) {
    let selected = pwaSelectionModel.getSelection().map( function( uid ) {
        return cdm.getObject( uid );
    } );

    let selectionData = {
        selected: selected
    };

    if ( !_.isEmpty( selected ) ) {
        selectionData.source = 'primary_with_visible_or_invisible_selections';
    }else{
        selectionData.source = 'base';
    }

    onSelectionChange( data, subPanelContext, contextKey, selectionData, pwaSelectionModel, parentSelectionData, lastDpAction );
};

export let onSelectionChange = function( data, subPanelContext, contextKey, selectionData, pwaSelectionModel, parentSelectionData, lastDpAction ) {
    if( selectionData ) {
        let selectedObjs = undefined;
        let nodeToExpandAfterFocus = subPanelContext.occContext.transientRequestPref.nodeToExpandAfterFocus;
        let occContextValue = { ...subPanelContext.occContext.getValue() };

        if( selectionData.source === 'primary' ) {
            selectedObjs = _getCurrentlySelectedObjs( occContextValue, selectionData.selected, pwaSelectionModel );
            selectedObjs = selectedObjs.length ? selectedObjs : occContextValue.topElement && [ occContextValue.topElement ];

            //In split view, when you select same object on non-active side ( i.e no selection change but just activation of side with same selection)
            //selectionModel callback doesnt get triggered as selection is same...in that case, global selection doesn't change on activation of window...
            //So, calling updateSelectionIfApplicable() always...This API has checks for objects comparison...so, unncessary selection change trigger is avoided...
            _updateGlobalSelections( selectedObjs, data.alternateSelection, subPanelContext.contextKey );
        } else if( selectionData.source === 'primary_with_visible_or_invisible_selections' ) {
            occContextValue.pwaSelectionSource = 'primary';
            selectedObjs = _processSelectionChange( occContextValue, selectionData.selected, subPanelContext, data.alternateSelection, pwaSelectionModel );
            _updateGlobalSelections( occContextValue.pwaSelection, data.alternateSelection, subPanelContext.contextKey );
        } else if( selectionData.source === 'base' || selectionData.source === undefined  ) {
            /*1) selection can be 'base' only when nothing is selected in PWA
               2) for Workset-Subset case, framework is updating selection change with source as 'base' even though there is
               selection in PWA
               3) This is incorrect call and should be ignored. Need to take this up with framework as to why this is coming.
               */
            let pwaSelectionEmpty = _.isEmpty( pwaSelectionModel.getSelection() );
            occContextValue.pwaSelectionSource = selectionData.source;

            //TODO : This pwaSelectionEmpty logic is handled in _getCurrentlySelectedObjs(). So, this else-if is cleanup candidate
            if( pwaSelectionEmpty ) {
                let topElement = occContextValue.topElement;
                let selected = selectionData.selected && selectionData.selected[ 0 ] ? selectionData.selected : topElement && [ topElement ];
                if( selected !== undefined ) {
                    selectedObjs = _processSelectionChange( occContextValue, selected, subPanelContext, data.alternateSelection, pwaSelectionModel );
                    _updateGlobalSelections( occContextValue.pwaSelection, data.alternateSelection, subPanelContext.contextKey );
                }
            }
        } else if( selectionData.source === 'server' ) {
            //processSelectionFromServer is not needed for lastDpAction=focusAction/focusActionForSelectionFromVis...because selection change n update is triggered prior to server call itself..
            if( lastDpAction === 'focusAction' || lastDpAction === 'focusActionForSelectionFromVis' ) {
                updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext, true, true );
            } else {
                if( lastDpAction === 'loadAndSelect' ) {
                    selectionData.retainExistingSelsInMSMode = true;
                }

                let currentSelection = pwaSelectionModel.selectionData?.selected ? pwaSelectionModel.selectionData.selected : appCtxSvc.getCtx().mselected;
                processSelectionFromServer( pwaSelectionModel, subPanelContext, occContextValue, selectionData, lastDpAction, data.alternateSelection );

                if( lastDpAction === 'loadAndSelect' ) {
                    //XRTContext update and URL currentState update already done in processSelectionFromServer, so passing false for last 2 parameters
                    updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext, false, false );
                }

                if( lastDpAction === 'initializeActionWithWindowReuse' && !_hasSelectionsChanged( currentSelection, selectionData.selected ) ) {
                    var eventData = {};
                    eventData.refreshLocationFlag = true;
                    eventData.relations = '';
                    eventData.forceReloadAceSWA = true;
                    eventData.relatedModified = [];
                    eventData.relatedModified[ 0 ] = occContextValue.pwaSelection[ 0 ];
                    eventBus.publish( 'cdm.relatedModified', eventData );
                }
            }
        } else if( selectionData.source === 'secondary' ) {
            updateSecondarySelection( selectionData.selected, selectionData.relationInfo, subPanelContext.occContext.pwaSelection, data.alternateSelection );
        }
        if( nodeToExpandAfterFocus ) {
            eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
                parentNode: {
                    id: nodeToExpandAfterFocus
                }
            } );
        }
        parentSelectionData && parentSelectionData.update( selectionData );
        trace( 'AwDataNavigator selectionData: ', selectionData );
    } else {
        selectionService.updateSelection( [ data.alternateSelection ] );
    }
};


let updatePrimarySelection = function( occContextValue, parentSelection, subPanelContext ) {
    _.each( onSelectionChangeExtPointHandlers, function( handler ) {
        if( handler.condition( occContextValue, parentSelection, subPanelContext ) ) {
            handler.modifyOccContextAtomicDataOnSelectionChange( occContextValue, parentSelection, subPanelContext );
        }
    } );

    /**
        * LCS-174734: When we get a selection from the 'primaryWorkArea' we assume the processing
        * is complete and it is OK to start sending selections back to the host.
    */
    if ( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        const selectionSentFromHost = appCtxSvc.getCtx( 'aw_selection_sent_from_host' );
        // NOTE: As hosts like NX and TcVis support opening of Session. It is important to make sure that alignment be checked only if the
        // selected object is a Facade object. Selections like Fnd0AppSession are not facade and do not have backing object.
        const isFacadeObjectSelected = occContextValue.pwaSelection?.[0]?.modelType.typeHierarchyArray.includes( 'Awb0Element' );

        appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', false );

        //check for aligned lines if hosting is enabled
        //Fix - LCS-1040627
        //Host type need not be checked as isFacadeObjectSelected checks for Session
        if ( !selectionSentFromHost && isFacadeObjectSelected ) {
            appCtxSvc.updatePartialCtx( 'aw_hosting_state.ignoreSelection', true );
            cadBomOccurrenceAlignmentSvc.getAlignedDesigns( occContextValue.pwaSelection, appCtxSvc.ctx.aw_host_type )
                .finally( () => appCtxSvc.updatePartialCtx( 'aw_hosting_state.ignoreSelection', false ) );
        } else {
            // Fix for LCS-966450 - REG: [Aligned EBOM only] NX viewer to AW tree cross probe deselects geometry in NX viewer
            // We need to delay selection echo back to host until the alligned design map is populated ( doing selection update in async call)
            // If the selection is echoed before the design map is populated then the host does not find the alligned design and results in loosing the selection.
            // The echo should happen once we receive the the getAlignedDesigns response and alligned design map is populated
            appCtxSvc.updatePartialCtx( 'aw_hosting_state.ignoreSelection', selectionSentFromHost );
        }
    }

    let hasPCIChanged = !_.isEqual( occContextValue.productContextInfo.uid, subPanelContext.occContext.productContextInfo.uid );
    if( _shouldOccConextBeUpdated( occContextValue, subPanelContext.occContext, hasPCIChanged ) ) {
        updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext );
    }else if( !_.isEqual( occContextValue.pwaSelectionSource, subPanelContext.occContext.pwaSelectionSource ) ) {
        //If user de-select top node and selection goes to base-selection ( or vice versa), there is no selection change but source changes
        occmgmtUtils.updateValueOnCtxOrState( 'pwaSelectionSource', occContextValue.pwaSelectionSource, subPanelContext.occContext );
    }
};

let updateSecondarySelection = function( selection, relationInfo, pwaSelection, parentSelection ) {
    //If everything was deselected
    if( !selection || selection.length === 0 ) {
        //Revert to the previous selection (primary workarea)
        selectionService.updateSelection( pwaSelection, parentSelection );
    } else {
        //Update the current selection with primary workarea selection as parent
        //Check for valid BusinessObject
        let selectedModelObject = selection[0].modelType && selection[0].modelType.typeHierarchyArray.indexOf( 'BusinessObject' ) > -1 ? pwaSelection[ 0 ] : selection[0];
        selectionService.updateSelection( selection, selectedModelObject, relationInfo );
    }
};

var _cleanDeletedObjectFromChildrenStructure = function( parentObject, deletedObjectUid ) {
    let hasChildrenCountChanged = false;
    if( parentObject && parentObject.children && parentObject.children.length ) {
        _.remove( parentObject.children, function( childVmo ) {
            return childVmo.uid === deletedObjectUid;
        } );
        hasChildrenCountChanged = parentObject.totalChildCount !== parentObject.children.length;
        parentObject.totalChildCount = parentObject.children.length;
    }

    return hasChildrenCountChanged === true ? 1 : 0;
};

var updateParentVmoOfDeleted = function( deletedVmo, vmc ) {
    let parentObject = undefined;
    if( vmc ) {
        let parentObjectUid = occmgmtUtils.getParentUid( deletedVmo );
        let parentVmoNdx = vmc.findViewModelObjectById( parentObjectUid );
        parentObject = vmc.getViewModelObject( parentVmoNdx );
        _cleanDeletedObjectFromChildrenStructure( parentObject, deletedVmo.uid );
    }
};

let _shouldOccConextBeUpdated = function( newOccContextVal, currentOccContextVal, hasPCIChanged ) {
    if( !_.isEqual( newOccContextVal.pwaSelection, currentOccContextVal.pwaSelection ) || hasPCIChanged ) {
        return true;
    }
    return !_.isEmpty( currentOccContextVal.elementsToCrossSelect ) && currentOccContextVal.elementsToCrossSelect.length > 0;
};

export const removeObjectsFromCollection = ( eventData, subPanelContext ) => {
    if( eventData && eventData.deletedObjectUids && eventData.deletedObjectUids.length > 0 ) {
        let vmc = subPanelContext.occContext.vmc;
        let treeDataProvider = subPanelContext.occContext.treeDataProvider;
        let newOccContextValue = { ...subPanelContext.occContext.value };
        let needOccContextUpdate = false;

        if ( eventData.clearDeletedObjectsFromPWASelection === true ) {
            let elementsToDeselect = _.filter( subPanelContext.occContext.pwaSelection, function( pwaSelection ) {
                return _.includes( eventData.deletedObjectUids, pwaSelection.uid );
            } );
            if ( elementsToDeselect.length > 0 ) {
                newOccContextValue.selectionsToModify = {
                    elementsToDeselect : elementsToDeselect
                };
                needOccContextUpdate = true;
            }
        }

        if( treeDataProvider ) {
            let needsUpdatesOnCollection = false;
            let loadedVMOs = vmc.getLoadedViewModelObjects();
            let deletedNodes = 0;

            _.forEach( eventData.deletedObjectUids, function( deletedObjectUid ) {
                _.forEach( loadedVMOs, function( vmo ) {
                    if( vmo && deletedObjectUid === vmo.uid || deletedObjectUid === vmo.parentUid ) {
                        if( vmo.isExpanded ) {
                            aceUpdatePwaDisplayService.purgeExpandedNode( vmo, loadedVMOs );
                        }
                        //Update the parent VMO of deleted uids to reflect the correct children properties ( Drag-Drop, cut, remove)
                        updateParentVmoOfDeleted( vmo, vmc );
                        needsUpdatesOnCollection = true;
                    } else {
                        deletedNodes += _cleanDeletedObjectFromChildrenStructure( vmo, deletedObjectUid );
                    }
                } );

                _.remove( loadedVMOs, function( childVmo ) {
                    return childVmo.uid === deletedObjectUid || childVmo.parentUid === deletedObjectUid;
                } );
            } );

            if(  needsUpdatesOnCollection || deletedNodes  ) {
                var collectionToUpdatedOnProvier = vmc.getLoadedViewModelObjects();
                treeDataProvider.update( collectionToUpdatedOnProvier );
            }
        }


        let elementToPCIMap = subPanelContext.occContext.elementToPCIMap;
        if( elementToPCIMap ) {
            var elementUidsInElementToPCIMap = Object.keys( elementToPCIMap );
            var keysToRemoveFromElementToPciMap = _.intersection(
                elementUidsInElementToPCIMap, eventData.deletedObjectUids );

            if( keysToRemoveFromElementToPciMap.length ) {
                _.forEach( keysToRemoveFromElementToPciMap, function( keyToRemoveFromElementToPciMap ) {
                    delete elementToPCIMap[ keyToRemoveFromElementToPciMap ];
                } );


                //TODO - Below code will be removed once we cleanup usages of elementToPCIMap on global context
                appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.elementToPCIMap', elementToPCIMap );


                newOccContextValue.elementToPCIMap = elementToPCIMap;
                needOccContextUpdate = true;
            }
        }

        //Update occContext if there is elementToPCIMap update or there are candidates to de-select from PWA
        if ( needOccContextUpdate === true ) {
            occmgmtUtils.updateValueOnCtxOrState( '', newOccContextValue, subPanelContext.occContext );
        }
    }
};

export const updateActiveWindow = ( eventData, data, subPanelContext, selectionData, pwaSelectionModel ) => {
    if( appCtxSvc.ctx.aceActiveContext.key !== eventData.key && eventData.key === data.contextKey ) {
        ctxStateMgmtService.updateActiveContext( eventData.key );
        onSelectionChange( data, subPanelContext, data.contextKey, selectionData, pwaSelectionModel );
    }
};

export const resetDataNavigator = ( eventData, contextKey, selectionModel ) => {
    var viewToReset = eventData && eventData.viewToReset ? eventData.viewToReset : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReset ) {
        let currentContext = appCtxSvc.getCtx( contextKey );
        if( currentContext ) {
            if( occmgmtUtils.isTreeView() && eventData && eventData.retainTreeExpansionStates === false && currentContext.vmc ) {
                eventBus.publish( currentContext.vmc.name + '.resetState' );
            }
            currentContext.silentReload = eventData ? eventData.silentReload : false;
        }
        //TODO: reset self dp
        const dp = selectionModel.getDpListener();
        if( dp ) {
            //dp.selectNone();
            dp.resetDataProvider();
        }
    }
};


export const resetTreeDataProvider = ( inputOccContext, occContext ) => {
    let transientRequestPref = inputOccContext.transientRequestPref;
    if( !_.isEmpty( transientRequestPref ) && transientRequestPref.retainTreeExpansionStates === false ) {
        eventBus.publish( occContext.vmc.name + '.resetState' );
    }
    if( editHandlerSvc.editInProgress().editInProgress ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            if( !_.isEmpty( inputOccContext.configContext ) ) {
                aceStructureConfigurationService.resetTreeOnConfigChange( inputOccContext, occContext );
            } else {
                occmgmtUtils.resetTreeDisplayWithProvidedInput( '', inputOccContext, occContext );
            }
        } );
    } else {
        if( !_.isEmpty( inputOccContext.configContext ) ) {
            aceStructureConfigurationService.resetTreeOnConfigChange( inputOccContext, occContext );
        } else {
            occmgmtUtils.resetTreeDisplayWithProvidedInput( '', inputOccContext, occContext );
        }
    }
};

export const resetPwaContents = ( selectionModel, editContext ) => {
    const dp = selectionModel.getDpListener();
    let pwaHandler = editHandlerSvc.getEditHandler( editContext );
    if( dp && pwaHandler && pwaHandler.editInProgress() ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            dp.resetDataProvider();
        } );
    } else if( dp ) {
        dp.resetDataProvider();
    }
};

export const expandNodeForExpandBelow = ( subPanelContext ) => {
    let vmc = subPanelContext.occContext.vmc;
    let loadedVMOs = vmc.getLoadedViewModelObjects();
    let vmoId = vmc.findViewModelObjectById( subPanelContext.occContext.transientRequestPref.scopeForExpandBelow );
    let vmoForExpandBelow = loadedVMOs[ vmoId ];
    vmoForExpandBelow.isExpanded = false;

    eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
        parentNode: {
            id: vmoForExpandBelow.id
        }
    } );
};

export const selectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        if( eventData.selectAll ) {
            dp.selectAll();
        } else {
            dp.selectNone();
        }
    }
};

export const setShowCheckBoxValue = ( eventData ) => {
    return eventData.multiSelect;
};

export const multiSelectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        dp.selectionModel.setMultiSelectionEnabled( eventData.multiSelect );
        return eventData.multiSelect;
    }
    return false;
};

export const handleHostingOccSelectionChange = ( data, eventData, selectionModel, contextKey, subPanelContext ) => {
    // deselect case - host will not send objectsToSelect
    // select rootElement

    appCtxSvc.registerPartialCtx( 'aw_hosting_state.ignoreSelection', true );
    appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', true );

    if( _.isUndefined( eventData.objectsToSelect ) && eventData.operation === 'replace' ) {
        eventData.objectsToSelect = [ subPanelContext.occContext.rootElement ];
    }

    if( eventData.objectsToSelect ) {
        if( eventData.operation === 'replace' ) {
            if( eventData.objectsToSelect.length < 2 ) {
                selectionModel.setMultiSelectionEnabled( false );
            }
            addUpdatedSelectionToPWA( data, eventData, contextKey, selectionModel, subPanelContext );
        } else if( eventData.operation === 'add' ) {
            let selectionsToModify = {
                elementsToSelect: eventData.objectsToSelect
            };
            modifyPwaSelections( selectionModel, subPanelContext.occContext, selectionsToModify );
        } else {
            /**
              * Note: This default case is required to keep some non-hosting use of this hosting
              * event. This default case will be removed once those uses are moved over to use
              * another way to handle their selection.
            */
            addUpdatedSelectionToPWA( data, eventData, contextKey, selectionModel, subPanelContext );
        }
    }
};

const _updateGlobalSelections = ( selection, parentSelection, contextKey ) => {
    let currentContext = appCtxSvc.getCtx( contextKey );
    if( !currentContext.silentReload ) {
        selectionService.updateSelection( selection, parentSelection );
    } else {
        delete currentContext.silentReload;
    }
};

const updateOccContextAndNotifyProductChangeIfApplicable = function( occContextValue, subPanelContext, shouldUpdateXRTContext = true, shouldUpdateURL = true ) {
    let occContext = subPanelContext.occContext;
    let ctxValuesToUpdate = {
        pwaSelection: occContextValue.pwaSelection,
        currentState: occContextValue.currentState
    };

    let isProductChanged = !_.isEqual( occContext.value.productContextInfo, occContextValue.productContextInfo );

    let currentContext = appCtxSvc.getCtx( subPanelContext.provider.contextKey );
    if( !_.isEqual( occContextValue.productContextInfo, currentContext.productContextInfo ) ) {
        ctxValuesToUpdate.productContextInfo = occContextValue.productContextInfo;
        ctxValuesToUpdate.rootElement = occContextValue.rootElement;
        isProductChanged =  true;
    }
    if( shouldUpdateXRTContext ) {
        occContextValue.xrtContext = _getXRTContextForPrimarySelection( subPanelContext, occContextValue.pwaSelection[ 0 ] );
    }

    if( shouldUpdateURL ) {
        aceUrlManagementService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState );
    }

    if( isProductChanged ) {
        occmgmtUtils.populateDisplayToggleOptions( occContextValue.displayToggleOptions, occContextValue.productContextInfo );
    }

    let _occContextDiff = {};
    let _targetValue = occContext.value;
    for( const item in occContextValue ) {
        if( _targetValue.hasOwnProperty( item ) ) {
            if( !_.isEqual( occContextValue[ item ], _targetValue[ item ] ) ) {
                _occContextDiff[ item ] = occContextValue[ item ];
            }
        }else{
            _occContextDiff[ item ] = occContextValue[ item ];
        }
    }

    if( _targetValue.selectionSyncInProgress ) {
        _occContextDiff.selectionSyncInProgress = false;
        _occContextDiff.elementsToCrossSelect = {};
    }

    if( _.keys( _occContextDiff ).length > 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( '', _occContextDiff, occContext );
    }
    occmgmtUtils.updateValueOnCtxOrState( '', ctxValuesToUpdate, occContext.viewKey );

    if( isProductChanged ) {
        let occDataLoadedEventData = {
            dataProviderActionType: 'productChangedOnSelectionChange'
        };
        eventBus.publish( 'occDataLoadedEvent', occDataLoadedEventData );
        let productChangedEventData = {
            newProductContextUID: occContextValue.productContextInfo.uid
        };
        eventBus.publish( 'ace.productChangedEvent', productChangedEventData );
    }
};

const occUpdateStateForSelection = function( occContextValue, subPanelContext ) {
    let selectedObjs = occContextValue.pwaSelection;
    if( selectedObjs.length > 0 ) {
        /**
            * Attempt to locate the single selection object
            */
        var selObj = selectedObjs[ selectedObjs.length - 1 ];

        if( selObj ) {
            /**
                * Set the 'o_uid' to the selected object's immediate parent if one exists
                */
            var parentUid = occmgmtUtils.getParentUid( selObj );
            if( parentUid ) {
                occContextValue.currentState.o_uid = parentUid;
                occContextValue.openedElement = cdm.getObject( parentUid );
            } else {
                occContextValue.currentState.o_uid = selObj.uid;
                occContextValue.openedElement = cdm.getObject( selObj.uid );
            }
        }
    }
    let currentOccContext = subPanelContext.occContext;
    _syncRootElementAndPCIOnSelectionChange( occContextValue, currentOccContext );
};

function _getCurrentlySelectedObjs( occContextValue, selected, pwaSelectionModel ) {
    //If selection-sync is in progress, from 3D/Find Panel to ACE, take selections from elementsToCrossSelect as first priority.


    if( occContextValue.selectionSyncInProgress ) {
        return occContextValue.elementsToCrossSelect;
    }

    let selectedObjects = [];
    //If selections are present in pwaSelectionModel, take selections from it ( it will have selected currently there on screen,
    //selected under collapsed nodes etc.)
    if( pwaSelectionModel && pwaSelectionModel.getSelection().length > 0 ) {
        selectedObjects = pwaSelectionModel.getSelection().map( function( uid ) {
            return cdm.getObject( uid );
        } ).filter( function( mo, idx ) {
            if ( !mo ) {
                logger.error( selected[idx].uid + ' was selected but is not in CDM!' );
            }
            return mo;
        } );
    } else {
        //If there are no selections in selectionModel, take selection from selectionData ( it will have base selection )
        selectedObjects = selected.map( function( obj ) {
            return cdm.getObject( obj.uid );
        } );
    }

    return selectedObjects;
}

function _processSelectionChange( occContextValue, selected, subPanelContext, alternateSelection, pwaSelectionModel ) {
    let selectedObjs = _getCurrentlySelectedObjs( occContextValue, selected, pwaSelectionModel );
    let isClearAllSelectionsCase = pwaSelectionModel && _.isEmpty( pwaSelectionModel.getSelection() );

    // If object that got deselected from tree is Packed Master, and partial selection svc has non-masters under it as selected via Vis, remove them from selection as well.
    let selectedObjsWithPNMsFilteredOut = acePartialSelectionService.removePartialSelection( selectedObjs /* new selections */, occContextValue.pwaSelection /* old selections */, occContextValue );

    //As we de-selected pack master, underlying non-master nodes also need to be de-selected ( Area Select from Vis, de-select pack master from tree ).
    if( selectedObjsWithPNMsFilteredOut && !isClearAllSelectionsCase ) {
        pwaSelectionModel.setSelection( selectedObjsWithPNMsFilteredOut );
        selectedObjs = selectedObjsWithPNMsFilteredOut;
    }

    let lastSelected = _.last( selectedObjs );

    occContextValue.pwaSelection = selectedObjs;
    occContextValue.previousState = occContextValue.currentState;


    if( !_.isEmpty( occContextValue.transientRequestPref.objectsToHighlightUids ) ) {
        let objectToHighlightUid = _.last( occContextValue.transientRequestPref.objectsToHighlightUids );
        let isObjectToHighlightLoadedInPWA = _isObjectToHighlightLoadedInPWA( occContextValue.vmc.getLoadedViewModelObjects(), objectToHighlightUid );

        if( isObjectToHighlightLoadedInPWA ) {
            occContextValue.currentState.h_uid = _.last( occContextValue.transientRequestPref.objectsToHighlightUids );
            occContextValue.transientRequestPref = {};
        }
    } else {
        //current selected & highlighted are different. Case of geunine highlight present.
        if ( occContextValue.currentState.h_uid !== occContextValue.currentState[urlParamsMap.selectionQueryParamKey] ) {
            //if there is user selection, which can happen when loadedVMOs are present, then only overwrite it
            if( occContextValue.vmc.getLoadedViewModelObjects().length > 0 ) {
                occContextValue.currentState.h_uid = lastSelected?.uid;
            }
        }else{
            occContextValue.currentState.h_uid = lastSelected?.uid;
        }
    }

    occContextValue.currentState[urlParamsMap.selectionQueryParamKey] = lastSelected?.uid;


    //Add additional info into newState
    occUpdateStateForSelection( occContextValue, subPanelContext );
    updatePrimarySelection( occContextValue, alternateSelection, subPanelContext );
    return selectedObjs;
}

const _hasSelectionsChanged = function( currentSelection, newSelection ) {
    var currentSelectedUids = currentSelection && currentSelection.map( function( obj ) { return obj.uid; } );
    var newlySelectedUids = newSelection && newSelection.map( function( obj ) { return obj.uid; } );

    /*selected UIDs could be same but objects in currentSelection & newSelection could be different.
     In that case, hasSelectionChanged should be false.*/
    return !_.isEqual( JSON.stringify( currentSelectedUids ), JSON.stringify( newlySelectedUids ) );
};

/**
 *
 * @param {*} pwaSelectionModel Primary Workarea Selection model which has more details about selection mode and current selection
 * @param {*} subPanelContext SubPanelContext
 * @param {*} occContextValue atomic data of ACE with updated values
 * @param {*} selectionData Selection data which has information about new selection to process
 * @param {*} lastDpAction Last data provider action which provides some decision points about when to honor the selection and what all other things to do
 */
function processSelectionFromServer( pwaSelectionModel, subPanelContext, occContextValue, selectionData, lastDpAction, alternateSelection ) {
    let currentSelection = pwaSelectionModel.selectionData?.selected ? pwaSelectionModel.selectionData.selected : appCtxSvc.getCtx().mselected;
    let newSelection =  selectionData.selected;

    if( _hasSelectionsChanged( currentSelection, newSelection ) ) {
        let selectionsInMSMode = pwaSelectionModel.isMultiSelectionEnabled() || pwaSelectionModel.getCurrentSelectedCount() > 1 || newSelection.length > 1;
        /*with reusebom window, existing selections, after server interaction may still be valid...
           In that case, existing selections get retained...its kind of RAC parity, but we want to enable it
           after addressing all gaps around it..so, retainExistingSelsInMSMode keeping true only for cross-select.
           For all other server intractions, we will goto single-select.
           */
        if( selectionsInMSMode ) {
            if( selectionData.retainExistingSelsInMSMode ) {
                pwaSelectionModel.addToSelection( newSelection );
            } else {
                pwaSelectionModel.setSelection( newSelection );
            }
        } else {
            // pwaSelectionModel.setSelection() call would PWA component selection.
            //selectionService.updateSelection() would update global selection. We are supposed to update both.

            //if selection is primary, upating global selection should happen in updateSelectionIfApplicable()
            if( subPanelContext.occContext.pwaSelectionSource === 'base' ) {
                selectionService.updateSelection( newSelection, subPanelContext.occContext.baseModelObject );
            }

            pwaSelectionModel.selectionData?.update( { selected: newSelection } );
        }
    }

    let xrtContext = _getXRTContextForPrimarySelection( subPanelContext, newSelection[ 0 ] ? newSelection[ 0 ] : alternateSelection );

    aceUrlManagementService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState, false );

    if( !_.isEqual( xrtContext.selectedUid, occContextValue.xrtContext.selectedUid ) && !_.isEqual( xrtContext.productContextUid, occContextValue.xrtContext.productContextUid ) ) {
        occUpdateStateForSelection( occContextValue, subPanelContext );
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, subPanelContext.occContext );
    }
}


/**
    * Function to set the ProductContextInfo and RootElement information based on the current selection
    * @param {Object} occContextValue Object representing ACE atomic data
    * @param {Object} currentOccContext currentOccContext
    */
function _syncRootElementAndPCIOnSelectionChange( occContextValue, currentOccContext ) {
    var lastSelectedObject = cdm.getObject( occContextValue.currentState.c_uid );
    var productInfo = exports.getProductInfoForCurrentSelection( lastSelectedObject, currentOccContext );

    _syncPCIOnSelectionChange( productInfo, occContextValue, currentOccContext );

    let currentRootElement = currentOccContext.rootElement;
    let rootElement = productInfo && productInfo.rootElement;
    if( !currentRootElement || rootElement && currentRootElement.uid !== rootElement.uid ) {
        appCtxSvc.updatePartialCtx( currentOccContext.contextKey + '.rootElement', rootElement );
    }
}


/**
    * Function to set the ProductContextInfo based on the current selection
    * @param {Object} productInfo Object representing ProductContextInfo
    * @param {Object} occContextValue Object representing ACE atomic data
    * @param {Object} currentOccContext currentOccContext
    */
function _syncPCIOnSelectionChange( productInfo, occContextValue, currentOccContext ) {
    // We are not triggering either tree reload or pwa.reset for change in pci_uid
    // so make sure it has actually changed and then fire updatePartialCtx
    var currentPci_Uid = currentOccContext.currentState.pci_uid;
    if( productInfo && productInfo.newPci_uid && productInfo.newPci_uid !== currentPci_Uid ) {
        let newPCIObject = cdm.getObject( productInfo.newPci_uid );

        occContextValue.currentState.pci_uid = productInfo.newPci_uid;
        occContextValue.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( newPCIObject );
        occContextValue.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( newPCIObject );
        occContextValue.productContextInfo = newPCIObject;
        occContextValue.rootElement = productInfo.rootElement;
        //Features that server supports but not enabled on client side.
        var disabledFeatures = occContextValue.disabledFeatures;
        for( let i = 0; i < disabledFeatures.length; i++ ) {
            if( occContextValue.supportedFeatures.hasOwnProperty( disabledFeatures[ i ] ) ) {
                delete occContextValue.supportedFeatures[ disabledFeatures[ i ] ];
            }
        }
    }
}
export let registerOnPwaSelectionChangeExtPointHandler = ( handler ) => {
    onSelectionChangeExtPointHandlers[handler.key] = handler;
    return onSelectionChangeExtPointHandlers[handler.key];
};
export let unregisterOnPwaSelectionChangeExtPointHandler = ( handler ) => {
    onSelectionChangeExtPointHandlers[handler.key] = handler;
    return onSelectionChangeExtPointHandlers[handler.key];
};

export default exports = {
    initializeDataNavigator,
    destroyDataNavigator,
    syncContextWithPWASelection,
    getParentUid,
    getProductInfoForCurrentSelection,
    updatePwaContextInformation,
    addUpdatedSelectionToPWA,
    removeSelectionFromPWA,
    addSelectionToPWA,
    updateActiveWindow,
    resetDataNavigator,
    selectActionForPWA,
    setShowCheckBoxValue,
    multiSelectActionForPWA,
    onSelectionChange,
    onSelectionChangeForPrimary,
    resetPwaContents,
    modifyPwaSelections,
    removeObjectsFromCollection,
    expandNodeForExpandBelow,
    handleHostingOccSelectionChange,
    resetTreeDataProvider,
    registerOnPwaSelectionChangeExtPointHandler,
    unregisterOnPwaSelectionChangeExtPointHandler
};
