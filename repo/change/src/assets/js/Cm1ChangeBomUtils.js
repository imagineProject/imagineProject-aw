// Copyright (c) 2024 Siemens

/**
 * Service responsible for managing Change Bom Utilities
 *
 * @module js/Cm1ChangeBomUtils
 */
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import aceGetService from 'js/aceGetService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';

var exports = {};
const TRUE = 'true';
const FALSE = 'false';
const INTERACTED_PRODUCT_UIDS = 'interactedProductUids';
var _freshECNInteraction = false;
let openNavigateEcnParameterExtPoint = null;

export let markECNInteracted = function( subPanelContext ) {
    var listOfInteractedPrducts = sessionStorage.getItem( INTERACTED_PRODUCT_UIDS );
    let isEcnAlreadyInteracted = false;
    if( listOfInteractedPrducts ) {
        isEcnAlreadyInteracted = listOfInteractedPrducts.includes( subPanelContext.openedObject.uid );
    }
    if( !isEcnAlreadyInteracted ) {
        _freshECNInteraction = true;
        aceRestoreBWCStateService.addInteractedProductToSessionStorage( subPanelContext.openedObject.uid );
    }
    return true;// Indicate that the interaction was successful
};

/**
 * Selects all top levels
 *
 * @param {Object} occContext - Object representing ACE atomic data
 */
export let selectAllTopParents = function( occContext ) {
    let loadedVMOs = occContext.vmc.getLoadedViewModelObjects();
    let allTopLevels = [];

    _.forEach( loadedVMOs, function( currentlyLoadedVmo ) {
        if( currentlyLoadedVmo.levelNdx === 0 ) {
            allTopLevels.push( currentlyLoadedVmo );
        }
    } );

    // clear existing selection and select only top levels
    let selectionsToModify = {
        elementsToSelect: allTopLevels,
        overwriteSelections: true
    };
    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
};

/**
 * Selects all elements of the current item(s)
 *
 * @param {Object} occContext - Object representing ACE atomic data
 */
export let selectAllMatchingElements = function( occContext ) {
    let currentlySelectedObjects = occContext.pwaSelection;
    let selectedObjUids = new Set();
    _.forEach( currentlySelectedObjects, function( selectedObj ) {
        selectedObjUids.add( selectedObj.props.awb0UnderlyingObject.dbValues[0] );
    } );

    let loadedVMOs = occContext.vmc.getLoadedViewModelObjects();
    let relatedElementSet = new Set();
    for( let vmoIndex = 0; vmoIndex < loadedVMOs.length; vmoIndex++ ) {
        let currentlyLoadedVmo = loadedVMOs[vmoIndex];
        if( selectedObjUids.has( currentlyLoadedVmo.props.awb0UnderlyingObject.dbValues[0] ) ) {
            relatedElementSet.add( cdm.getObject( currentlyLoadedVmo.uid ) );
        }
        // LCS-1211711: Select all matching elements should select all loaded elements even if under a collapsed node
        if( !currentlyLoadedVmo.isLeaf && currentlyLoadedVmo.__expandState?.children && !_.isEmpty( currentlyLoadedVmo.__expandState.children ) ) {
            let childrenUnderCollapsedNode = currentlyLoadedVmo.__expandState.children;
            for( let childIndex = 0; childIndex < childrenUnderCollapsedNode.length; childIndex++ ) {
                if( selectedObjUids.has( childrenUnderCollapsedNode[childIndex].props.awb0UnderlyingObject.dbValues[0] ) ) {
                    relatedElementSet.add( cdm.getObject( childrenUnderCollapsedNode[childIndex].uid ) );
                }
            }
        }
    }

    let relatedElements = Array.from( relatedElementSet );

    // clear existing selection and select all elements of the current selection
    let selectionsToModify = {
        elementsToSelect: relatedElements,
        overwriteSelections: true
    };
    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
};

/**
 * Checks if the column filter is enabled based on user preferences and dispatches the result.
 *
 * @param {Function} dispatch - The dispatch function to update the state.
 */
export let isColumnFilterEnabled = function( dispatch ) {
    // Initialize the column filter enabled flag to false
    let isColumnFilterEnable = false;

    // Retrieve the startup preferences from the application context service
    let preferences = appCtxSvc.getCtx( 'preferences' );
    if( preferences && preferences.EnableMultiBOMFeatures ) {
        isColumnFilterEnable = preferences.EnableMultiBOMFeatures.indexOf( 'ColumnFilter' ) >= 0;
    }
    // Dispatch the result to update the state
    dispatch( { path: 'data._sublocation.isFilteringEnabled', value: isColumnFilterEnable } );
};

/**
 * Expands collapsed nodes in the view model collection based on the current selection.
 *
 * @param {Object} vmc - The view model collection
 * @param {Object} pwaSelection - primary work area selection
 */
export let expandCollapsedNodes = function( vmc, pwaSelection ) {
    let selectedObjUids = new Set();
    _.forEach( pwaSelection, function( selectedObj ) {
        selectedObjUids.add( selectedObj.uid );
    } );

    let loadedVMOs = vmc.getLoadedViewModelObjects();

    for( let vmoIndex = 0; vmoIndex < loadedVMOs.length; vmoIndex++ ) {
        let currentlyLoadedVmo = loadedVMOs[vmoIndex];
        // If the currently loaded VMO is selected and has children in collapsed cache, expand it
        if( selectedObjUids.has( currentlyLoadedVmo.uid ) && currentlyLoadedVmo.__expandState?.children && !_.isEmpty( currentlyLoadedVmo.__expandState.children ) ) {
            eventBus.publish( vmc.name + '.expandTreeNode', { parentNode: { id: currentlyLoadedVmo.id } } );
        }
    }
};

const _populateInputIfApplicable = ( loadInput, occContext, currentContext, soaInput ) => {
    if( _freshECNInteraction ) {
        soaInput.inputData.requestPref.startFreshNavigation = [ TRUE ];
        _freshECNInteraction = false; // Reset the flag after setting it
    } else {
        soaInput.inputData.requestPref.startFreshNavigation = [ FALSE ];
    }
};

export const registerPreGetOccOpenNavigateEcnExtPoints = function() {
    // Define the condition function for the column filter parameter extension point.
    let openNavigateEcnParameterCondition = function( loadInput, occContext, soaInput ) {
        return soaInput.inputData?.product?.modelType.typeHierarchyArray.includes( 'ChangeNoticeRevision' ) &&
               _.isUndefined( soaInput?.inputData?.requestPref?.userGesture ) &&
               _.isUndefined( occContext.pwaReset ) &&
               _.isUndefined( soaInput?.inputData?.requestPref?.useActiveECNEff );
    };

    // Define the function to populate column filters.
    let openNavigateEcnParameterFunction = function( loadInput, occContext, currentContext, soaInput ) {
        _populateInputIfApplicable( loadInput, occContext, currentContext, soaInput );
    };

    // Define the column filter parameter extension point object.
    openNavigateEcnParameterExtPoint = {
        key: 'openNavigateEcnPreGetOccHandler', // Unique identifier for the extension point.
        condition: openNavigateEcnParameterCondition, // Condition function to check if the extension point should be applied.
        populateGetOccInput: openNavigateEcnParameterFunction // Function to populate column filters.
    };

    // Register the column filter parameter extension point with the aceGetService.
    aceGetService.registerGetOccInputProvider( openNavigateEcnParameterExtPoint );
};

export const unregisterHandlerPreGetOccOpenNavigateParamExtPoints = function() {
    aceGetService.unregisterGetOccInputProvider( openNavigateEcnParameterExtPoint );
};

/**
 * Registers a post-get-occurrence extension point for handling the scenario where an ECN
 * has no children. When triggered, this extension point updates the context to show an empty BOM tab view and
 * modifies the provider's supported layouts accordingly. It also unregisters the handler after execution.
 *
 * @param {Object} subPanelContext - The context object containing occContext, baseSelection, and provider information.
 */
export let registerPostGetRevertInEcnExtPoint = function( subPanelContext ) {
    let postGetOccConditionFunc = function( soaInput, treeLoadInput, treeLoadOutput, inputOccContext, response ) {
        // Invoke the extension point only when there are no childern to ECN
        return response?.parentChildrenInfos[0]?.childrenInfo?.length === 0;
    };
    let postGetOccFunc = function() {
        // Adding Cm1ChangeBomEmptyTab view when there are no children to ECN
        let occContexValue = { ...subPanelContext.occContext.getValue() };
        occContexValue.onPwaLoadComplete += 1;
        occContexValue.baseModelObject = subPanelContext.baseSelection;
        occContexValue.AceHeaderForApplication = subPanelContext.provider.AceHeaderForApplication;
        occContexValue.hidTreeForEmptyContents = true;
        subPanelContext.provider.supportedLayouts = subPanelContext.provider.supportedLayoutsForEmptyBOMTab;
        // unsubscribe the handler
        aceTreeLoadResultBuilderService.unregisterOccContextAtomicDataProvider( postGetOccExtPoint );
        occmgmtUtils.updateValueOnCtxOrState( '', occContexValue, subPanelContext.occContext, false );
    };
    let postGetOccExtPoint = {
        key : 'cm1RevertMergePostGetOccHandler', // unique identifier
        condition: postGetOccConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFunc
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccExtPoint );
};

/**
 * Registers a pre-get-occurrence extension point for the ECN revert scenario.
 * This extension point sets the request preferences to indicate a refresh operation
 * and ensures that navigation does not start fresh. It is used to modify the SOA input
 * before fetching occurrences when reverting in ECN context.
 */
export let aceRegisterPreGetOccRevertInEcnExtPoint = function() {
    let conditionFunc = function() {
        return true;
    };

    let populateFunc = function( soaInput, treeLoadInput, treeLoadOutput, inputOccContext ) {
        inputOccContext.inputData.requestPref.startFreshNavigation = [ FALSE ];
        inputOccContext.inputData.requestPref.userGesture = [ 'REFRESH' ];
        aceGetService.unregisterGetOccInputProvider( preGetOccRevertExtPoint );
    };

    // Register the extension point with the aceGetService.
    let preGetOccRevertExtPoint = {
        key: 'revertInEcnPreGetOccHandler',
        condition: conditionFunc,
        populateGetOccInput: populateFunc
    };

    aceGetService.registerGetOccInputProvider( preGetOccRevertExtPoint );
};

/**
 * Filters and processes revised objects based on selected objects to determine which objects should be sent for updates.
 * Only includes revised objects that have a corresponding selected object with a valid parent.
 *
 * @param {Array} selected - Array of selected objects from the primary work area
 * @param {Array} revisedObjects - Array of revised objects containing originalObject references
 * @returns {Object} Object containing selectedObjects and filtered revisedObjects
 * @returns {Array} returns.selectedObjects - The original selected objects array
 * @returns {Array} returns.revisedObjects - Filtered array of revised objects that have a parent
 */
export let getUpdatedObjectsToSend = function( selected, revisedObjects ) {
    let updatedObjects = [];

    let selectedObjectsMap = new Map();
    for( let j = 0; j < selected.length; j++ ) {
        selectedObjectsMap.set( selected[j].props.awb0UnderlyingObject.dbValues[0], selected[j] );
    }

    for( let i = 0; i < revisedObjects.length; i++ ) {
        let revisedObj = revisedObjects[i];
        let selectedObject = selectedObjectsMap.get( revisedObj.originalObject.uid );
        if( selectedObject && selectedObject.props.awb0Parent.dbValues[0] ) {
            updatedObjects.push( revisedObj );
        }
    }

    return { selectedObjects: selected, revisedObjects: updatedObjects };
};

/**
 * Change bom Service utility
 */
export default exports = {
    markECNInteracted,
    selectAllTopParents,
    selectAllMatchingElements,
    isColumnFilterEnabled,
    expandCollapsedNodes,
    registerPreGetOccOpenNavigateEcnExtPoints,
    unregisterHandlerPreGetOccOpenNavigateParamExtPoints,
    registerPostGetRevertInEcnExtPoint,
    aceRegisterPreGetOccRevertInEcnExtPoint,
    getUpdatedObjectsToSend
};
