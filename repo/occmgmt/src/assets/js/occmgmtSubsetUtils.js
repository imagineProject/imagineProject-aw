// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtSubsetUtils
 */
import appCtxService from 'js/appCtxService';
import commandMapSvc from 'js/commandsMapService';
import cdmService from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import _ from 'lodash';
import aceObjectToCSIDGeneratorService from 'js/aceObjectToCSIDGeneratorService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};
var _configChangeParams = [ 'REVISION_RULE_CHANGE', 'VARIANT_RULE_CHANGE', 'EFFECTIVITY_CHANGE', 'VIEW_TYPE_CHANGE', 'CLOSURE_RULE_CHANGE', 'ARRANGEMENT_CHANGE' ];

/**
 * Return the selected objects if they belong to the same product/subset
 * @param {boolean} excludeSubsetLine Pass in True if you want to exclude the subset line from validation, false otherwise.
 *                                  This is required while checking selection for VCV, where selecting the subset line is a valid selection.
 * @returns {Object} Valid target objects
  */
export let validateSelectionsToBeInSingleProduct = function( excludeSubsetLine ) {
    var selections = appCtxService.getCtx( 'mselected' );
    var selectionObjs = [];
    if ( !( appCtxService.ctx.aceActiveContext && appCtxService.ctx.aceActiveContext.context &&
        appCtxService.ctx.aceActiveContext.context.openedElement && appCtxService.ctx.aceActiveContext.context.openedElement.modelType ) ) {
        return selectionObjs;
    }
    if( selections && selections.length > 0 ) {
        // fetch product of last selected element and it should be equal to product of rest selections
        var pciOfLastSelectedElement = cdmService.getObject( getProductContextForProvidedObject( selections[ selections.length - 1 ] ) );
        if( pciOfLastSelectedElement && selections !== null && selections.length > 0 ) {
            for( var i = 0; i < selections.length; i++ ) {
                if( commandMapSvc.isInstanceOf( 'Fgf0PartitionElement', selections[ i ].modelType ) ) {
                    // Partitions are not supported in AW 5.2 for inclusion in recipe
                    continue;
                }
                var underlyingObj = null;
                //  Subset under Workset is not supported as valid object for recipe creation and VCA
                if( excludeSubsetLine ) {
                    var parentUid = exports.getParentUid( selections[ i ] );
                    if( parentUid ) {
                        var parentObj = cdmService.getObject( parentUid );
                        if( parentObj ) {
                            if( parentObj.props.awb0UnderlyingObject ) {
                                var parentUnderlyingObj = cdmService.getObject( parentObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
                                if( parentUnderlyingObj && parentUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                                    continue;
                                }
                            }else{
                                continue;
                            }
                        }
                    }
                }

                if( commandMapSvc.isInstanceOf( 'Awb0Element', selections[ i ].modelType ) &&
                        pciOfLastSelectedElement.uid === cdmService.getObject( getProductContextForProvidedObject( selections[ i ] ) ).uid &&
                        appCtxService.ctx.aceActiveContext.context.openedElement.uid !== selections[ i ].uid  ) {
                    underlyingObj = selections[ i ].props && selections[ i ].props.awb0UnderlyingObject ? cdmService.getObject( selections[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] ) : null;
                }
                if( underlyingObj !== null ) {
                    selectionObjs.push( selections[ i ] );
                }
            }
        }
    }
    return selectionObjs;
};

/**
  * Get the product context for the given object
  * @param {Object} object Object whose UID needs to be figured out
  * @return {Object} Uid of the productContext corresponding to the selected object if it is available in the elementToPCIMap;
  *         the productContext from the URL otherwise
  */
export let getProductContextForProvidedObject = function( object ) {
    if( appCtxService.ctx.aceActiveContext && appCtxService.ctx.aceActiveContext.context ) {
        if( appCtxService.ctx.aceActiveContext.context.elementToPCIMap ) {
            var parentObject = object;

            do {
                if( appCtxService.ctx.aceActiveContext.context.elementToPCIMap[ parentObject.uid ] ) {
                    return appCtxService.ctx.aceActiveContext.context.elementToPCIMap[ parentObject.uid ];
                }

                var parentUid = exports.getParentUid( parentObject );
                parentObject = cdmService.getObject( parentUid );
            } while( parentObject );
        } else {
            return appCtxService.ctx.aceActiveContext.context.currentState.pci_uid;
        }
    }
    return null;
};


/**
 * Return the selected objects if they belong to the same product/subset
 * @param {boolean} excludeSubsetLine Pass in True if you want to exclude the subset line from validation, false otherwise.
 *                                  This is required while checking selection for VCV, where selecting the subset line is a valid selection.
 * @param {Object} occContext ace atomic data
 * @param {boolean} isFilterUsecase Pass in True When the function is used in proximity filter usecases
 *                                  Pass in False for Variant Condition and Variant configuration tab visibility usecase
 * @returns {Object} Valid target objects
  */
export let validateSelectionsToBeInSingleProductFromOccContext = function( excludeSubsetLine, occContext, isFilterUsecase ) {
    var selectionObjs = [];
    if ( !( occContext &&
        occContext.openedElement && occContext.openedElement.modelType ) ) {
        return selectionObjs;
    }
    var selections = occContext.pwaSelection;
    if( selections && selections.length > 0 ) {
        // fetch product of last selected element and it should be equal to product of rest selections
        var pciOfLastSelectedElement = cdmService.getObject( getProductContextForProvidedObjectFromOccContext( selections[ selections.length - 1 ], occContext ) );
        if( pciOfLastSelectedElement && selections !== null && selections.length > 0 ) {
            for( var i = 0; i < selections.length; i++ ) {
                // The validateSelectionsToBeInSingleProductFromOccContext function is getting called to decide VCA and VC tab visibilty and proximity filter
                // Currently partition selection is not valid for proximity Filter.
                if( isFilterUsecase && commandMapSvc.isInstanceOf( 'Fgf0PartitionElement', selections[ i ].modelType ) ) {
                    // Partitions are not supported in AW 5.2 for inclusion in recipe
                    continue;
                }
                var underlyingObj = null;
                //  Subset under Workset is not supported as valid object for recipe creation and VCA
                if( excludeSubsetLine ) {
                    var parentUid = exports.getParentUid( selections[ i ] );
                    if( parentUid ) {
                        var parentObj = cdmService.getObject( parentUid );
                        if( parentObj ) {
                            if( parentObj.props.awb0UnderlyingObject ) {
                                var parentUnderlyingObj = cdmService.getObject( parentObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
                                if( parentUnderlyingObj && parentUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                                    continue;
                                }
                            }else{
                                continue;
                            }
                        }
                    }
                }

                if( commandMapSvc.isInstanceOf( 'Awb0Element', selections[ i ].modelType ) &&
                        pciOfLastSelectedElement.uid === cdmService.getObject( getProductContextForProvidedObjectFromOccContext( selections[ i ], occContext ) ).uid &&
                        occContext.topElement.uid !== selections[ i ].uid  ) {
                    underlyingObj = cdmService.getObject( selections[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
                }
                if( underlyingObj !== null ) {
                    selectionObjs.push( selections[ i ] );
                }
            }
        }
    }
    return selectionObjs;
};

/**
  * Get the product context for the given object
  * @param {Object} object Object whose UID needs to be figured out
  * @param {Object} occContext ace atomic data
  * @return {Object} Uid of the productContext corresponding to the selected object if it is available in the elementToPCIMap;
  *         the productContext from the URL otherwise
  */
export let getProductContextForProvidedObjectFromOccContext = function( object, occContext ) {
    if( occContext && occContext.elementToPCIMap ) {
        var parentObject = object;
        do {
            if( occContext.elementToPCIMap[ parentObject.uid ] ) {
                return occContext.elementToPCIMap[ parentObject.uid ];
            }

            var parentUid = exports.getParentUid( parentObject );
            parentObject = cdmService.getObject( parentUid );
        } while( parentObject );
    } else {
        return occContext.currentState.pci_uid;
    }

    return null;
};

/** Returns the parent UID
  * @param {IModelObject} modelObject - model object
  * @return {Object} parent uid if found or null
  */
export let getParentUid = function( modelObject ) {
    if( modelObject && modelObject.props ) {
        var props = modelObject.props;

        var uid;

        if( props.awb0BreadcrumbAncestor && !_.isEmpty( props.awb0BreadcrumbAncestor.dbValues ) ) {
            uid = props.awb0BreadcrumbAncestor.dbValues[ 0 ];
        } else if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
            uid = props.awb0Parent.dbValues[ 0 ];
        }

        if( cdmService.isValidObjectUid( uid ) ) {
            return uid;
        }
    }

    return null;
};

/** Sets the ui value for replay date
  * @param {Object} data - view model data object
  */
export let setReplayDate = function( data ) {
    if( data && data.replayDate ) {
        var date = new Date( data.replayDate.dbValue );

        if( date && date.getTime() ) {
            return dateTimeSvc.formatSessionDateTime( date );
        }
    }
};

/**
 * This method is used for calling Drag and drop functionality to Session object
 */
export let sessionPasteHandler = function() {
    // Disable paste for session object
    return;
};

/* To navigate back to discovery sub panel
 * @param {Object} sharedData - shared data
 * @param {String} nextActiveView - Active view value
 */
export let navigateBackToDiscoverySubPanel = ( activeViewSharedData, sharedData, nextActiveView ) => {
    let newActiveViewSharedData;
    if( !_.isUndefined( activeViewSharedData ) ) {
        newActiveViewSharedData = activeViewSharedData && activeViewSharedData.value ? { ...activeViewSharedData.getValue() } : { ...activeViewSharedData };
    } else {
        newActiveViewSharedData = {};
    }

    newActiveViewSharedData.activeView = nextActiveView;
    let newSharedData = resetRecipeOnSharedData( sharedData );
    return { newViewSharedData: newActiveViewSharedData, sharedData: newSharedData };
};

/**
 * To navigate away from discovery sub panel
 * @param {Object} activeViewSharedData - active view shared data
 * @param {Object} sharedData - shared data
 * @param {String} nextActiveView - Active view value
 *  @param {String} autoApply - if autoApply is true/false
 */
export const updateFilterTogglesOnSharedData = ( activeViewSharedData, sharedData, nextActiveView, autoApply, includeWithChildren ) => {
    let newActiveViewSharedData;
    if( !_.isUndefined( activeViewSharedData ) ) {
        newActiveViewSharedData = activeViewSharedData && activeViewSharedData.value ? { ...activeViewSharedData.getValue() } : { ...activeViewSharedData };
    } else {
        newActiveViewSharedData = {};
    }

    let newSharedData;
    if( !_.isUndefined( sharedData ) ) {
        newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : { ...sharedData };
    } else {
        newSharedData = {};
    }
    if ( autoApply !== undefined ) {
        newSharedData.autoApply = autoApply;
        if( _.isUndefined( newSharedData.autoApplyPrefSet ) ) {
            newSharedData.autoApplyPrefSet = true;
        }
    }
    if ( includeWithChildren !== undefined ) {
        newSharedData.includeWithChildren = includeWithChildren;
        if( _.isUndefined( newSharedData.includeWithChildrenPrefSet ) ) {
            newSharedData.includeWithChildrenPrefSet = true;
        }
    }
    sharedData && sharedData.update && sharedData.update( newSharedData );

    if ( nextActiveView  && !_.isEmpty( nextActiveView ) ) {
        newActiveViewSharedData.activeView = nextActiveView;
        activeViewSharedData && activeViewSharedData.update && activeViewSharedData.update( newActiveViewSharedData );
    }
};


let resetRecipeOnSharedData = ( sharedData ) => {
    let newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : sharedData;
    newSharedData.recipeTermToAdd = undefined;
    newSharedData.spatialRecipeIndexToUpdate = undefined;
    return newSharedData;
};

export const updateSharedDataWithRecipeBeforeNavigate = ( activeViewSharedData, sharedData, recipeTerm, spatialRecipeIndexToUpdate, nextActiveView, recipeOperator, selectedObj, newActiveGroupIndex ) => {
    let newActiveViewSharedData;
    if( !_.isUndefined( activeViewSharedData ) ) {
        newActiveViewSharedData = activeViewSharedData && activeViewSharedData.value ? { ...activeViewSharedData.getValue() } : { ...activeViewSharedData };
    } else {
        newActiveViewSharedData = {};
    }
    let newSharedData;
    if( !_.isUndefined( sharedData ) ) {
        newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : { ...sharedData };
    } else {
        newSharedData = {};
    }

    if( recipeTerm ) {
        newSharedData.recipeTermToAdd = recipeTerm;
        if( spatialRecipeIndexToUpdate >= 0 ) {
            newSharedData.spatialRecipeIndexToUpdate =  spatialRecipeIndexToUpdate;
        }
        if( newActiveGroupIndex >= 0 ) {
            newSharedData.activeGroupIndex = newActiveGroupIndex;
        }
    } else{
        newSharedData.recipeTermToAdd = undefined;
        newSharedData.spatialRecipeIndexToUpdate = undefined;
    }
    if( recipeOperator ) {
        newSharedData.recipeOperator = recipeOperator;
    }
    if( selectedObj ) {
        newSharedData.clickedObj = selectedObj;
    }
    sharedData && sharedData.update && sharedData.update( newSharedData );

    if( nextActiveView ) {
        newActiveViewSharedData.activeView = nextActiveView;
        activeViewSharedData && activeViewSharedData.update && activeViewSharedData.update( newActiveViewSharedData );
    }
};

export const performPostProcessingForStaleTreeGuidanceBanner = ( occContext, occmgmtContext, occmgmtContext2, isSplitView ) => {
    var isTreeContentStale = false;
    var isTreeContentStaleSplitView = false;
    if( isSplitView && occmgmtContext?.openedElement?.uid && occmgmtContext2?.openedElement?.uid ) {
        // Get the PCI for the top node and check for stale tree feature there for both windows in split view.
        for ( let eachElement in occmgmtContext.elementToPCIMap ) {
            var pciModelObj1 = cdmService.getObject( occmgmtContext.elementToPCIMap[eachElement] );
            if( occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObj1 ).Awb0StaleTreeContent === true ) {
                isTreeContentStaleSplitView = true;
                break;
            }
        }
        if( !isTreeContentStaleSplitView ) {
            for ( let eachElement in occmgmtContext2.elementToPCIMap ) {
                var pciModelObj2 = cdmService.getObject( occmgmtContext2.elementToPCIMap[eachElement] );
                if( occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObj2 ).Awb0StaleTreeContent === true ) {
                    isTreeContentStaleSplitView = true;
                    break;
                }
            }
        }
    }
    if( occContext.openedElement && occContext.openedElement.uid && !_.isEmpty( occContext.elementToPCIMap ) ) {
        // Get the PCI for the top node and check for stale tree feature there.
        for ( let eachElement in occContext.elementToPCIMap ) {
            var pciModelObj = cdmService.getObject( occContext.elementToPCIMap[eachElement] );
            if( occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObj ).Awb0StaleTreeContent === true ) {
                isTreeContentStale = true;
                break;
            }
        }
    }
    if( isSplitView ) {
        appCtxService.updatePartialCtx( 'isTreeContentStaleSplitView', isTreeContentStaleSplitView );
    }
    return { isTreeContentStale: isTreeContentStale, isTreeContentStaleSplitView: isTreeContentStaleSplitView };
};

//The function is used to enable find button on workset
//By checking for find feature key through all the subsets and return true if any of the subset has the find feature key present
export const isFindSupportedForOpenedObject = ( occContext )=>{
    var enableFindInStructure = false;
    if( occContext.openedElement && occContext.openedElement.uid && !_.isEmpty( occContext.elementToPCIMap ) ) {
        // Get the PCIs and check for find in structure feature there.
        for ( let eachElement in occContext.elementToPCIMap ) {
            var pciModelObj = cdmService.getObject( occContext.elementToPCIMap[eachElement] );
            if( pciModelObj && occmgmtStateHandler.getSupportedFeaturesFromPCI( pciModelObj ).Awb0FindInStructure === true ) {
                enableFindInStructure = true;
                break;
            }
        }
    }
    return enableFindInStructure;
};

export let isUserGestureToChangeConfig = function( occContext ) {
    let isUserGestureToChangeConfig = false;
    if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.userGesture && _configChangeParams.indexOf( occContext.transientRequestPref.userGesture ) > -1 ) {
        isUserGestureToChangeConfig = true;
    }
    return isUserGestureToChangeConfig;
};

export const getCSIDChainForSelected = ( selected ) => {
    var selectedObjCloneIds = [];
    _.forEach( selected, function( selection ) {
        var csid_path = aceObjectToCSIDGeneratorService.getCloneStableIdChain( selection );
        selectedObjCloneIds.push( csid_path );
    } );

    return selectedObjCloneIds;
};

export const updateReplayCSID = ( occContext ) => {
    var selectedObjCloneIds = getCSIDChainForSelected( occContext.pwaSelection );

    let value = {
        transientRequestPref: {
            replayRecipe: 'true',
            currentSelections: selectedObjCloneIds,
            jitterFreePropLoad: true,
            startFreshNavigation: true,
            userGesture: 'REPLAY'
        },
        pwaReset: true
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
};

export let isAdvancedFilterComponentHosted = function() {
    let advancedFilterInfo = appCtxService.getCtx( 'advanced_filter_candidates' );
    return advancedFilterInfo && advancedFilterInfo.IsEmbeddedComponent;
};

export let isPackedOccurrencePresentInParentHierarchy = function( selectedObject ) {
    let object = selectedObject;
    while( object && object.props && object.props.awb0Parent && !_.isEmpty( object.props.awb0Parent.dbValues[ 0 ] ) ) {
        if( !( object.props && object.props.awb0IsPacked ) ) {
            // if any of the parent do not have the awb0IsPacked property
            // decision can not be made whether selected object or its parent are packed occurrences
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        if( object.props && object.props.awb0IsPacked && _.isEqual( object.props.awb0IsPacked.dbValues[ 0 ], '1' ) ) {
            // if any of the occurrence in parent hierarchy is packed
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        let parentUid = object.props.awb0Parent.dbValues[ 0 ];
        object = cdmService.getObject( parentUid );
    }
    // we do not have any packed occurrences in parent hierarchy
    // return false, to avoid making getPackedOccurrenceCSIDs SOA call for selectedObject
    return false;
};

export default exports = {
    validateSelectionsToBeInSingleProduct,
    getProductContextForProvidedObject,
    validateSelectionsToBeInSingleProductFromOccContext,
    getProductContextForProvidedObjectFromOccContext,
    getParentUid,
    setReplayDate,
    sessionPasteHandler,
    navigateBackToDiscoverySubPanel,
    updateFilterTogglesOnSharedData,
    updateSharedDataWithRecipeBeforeNavigate,
    performPostProcessingForStaleTreeGuidanceBanner,
    isFindSupportedForOpenedObject,
    isUserGestureToChangeConfig,
    updateReplayCSID,
    getCSIDChainForSelected,
    isAdvancedFilterComponentHosted,
    isPackedOccurrencePresentInParentHierarchy
};

