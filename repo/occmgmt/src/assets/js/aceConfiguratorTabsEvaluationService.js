// Copyright (c) 2022 Siemens

/**
 * @module js/aceConfiguratorTabsEvaluationService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtUtils from 'js/occmgmtUtils';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import commandMapSvc from 'js/commandsMapService';
import preferenceSvc from 'soa/preferenceService';


var exports = {};
var _onLoadingOfACESubLocationEventListener = null;
var _mpref4GDDisableVariantConfTabs = '4G_Disable_Variant_Configuration_Tabs';
let hideVariantConfigurationTabs = false;

let _onSelectionChangeExtPoint = {
    key : 'evalConfiguratorTabsOnSelectionChange', //unique identifier
    condition: function( occContextValue, parentSelection, subPanelContext ) {
        if (  (occContextValue && occContextValue.supportedFeatures && occContextValue.supportedFeatures['4GStructureFeature'] ) || occContextValue.openedObjectType === 'WorksetRevision' || occContextValue.openedObjectType === 'AppSessionWorkset' || occContextValue.openedObjectType === 'AppSession' || _.isUndefined( occContextValue.openedObjectType ) ) {
            return false;
        }
        return true;
    },
    modifyOccContextAtomicDataOnSelectionChange: function( occContextValue, parentSelection, subPanelContext ) {
        // Selection's are being updated on the occContext and ConfiguratorTabsVisibility is evaluated based on the ctx
        // Need to add debounce to let the updates complete before Tabs are evaluated
        let configuratorViewsDisplayContext = evaluateConfiguratorTabsVisibility( occContextValue.pwaSelection, occContextValue );
        occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
    }
};

let _postGetOccExtPoint = {
    key : 'occmgmtConfiguratorPostGetOccHandler', //unique identifier
    condition: function( soaInput, treeLoadInput, treeLoadOutput, inputOccContext ) {
        if (  ( inputOccContext.value && inputOccContext.value.supportedFeatures && inputOccContext.value.supportedFeatures['4GStructureFeature'] ) || treeLoadOutput.openedObjectType === 'WorksetRevision' || treeLoadOutput.openedObjectType === 'AppSessionWorkset' || treeLoadOutput.openedObjectType === 'AppSession' || _.isUndefined( treeLoadOutput.openedObjectType ) ) {
            return false;
        }
        return true;
    },
    addOccContextAtomicDataForUpdate: function( response, finalOccContextValue, inputOccContext, treeLoadOutput ) {
        let configuratorViewsDisplayContext = evaluateConfiguratorTabsVisibility( finalOccContextValue.pwaSelection, finalOccContextValue, inputOccContext );
        finalOccContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
    }
};


let _onSelectionChangeExtPointFor4G = {
    key : 'evalConfiguratorTabsOnSelectionChangeFor4G', //unique identifier
    condition: function( occContextValue ) {
        return occContextValue && occContextValue.supportedFeatures && occContextValue.supportedFeatures['4GStructureFeature'];
    },
    modifyOccContextAtomicDataOnSelectionChange: function( occContextValue ) {
        let configuratorViewsDisplayContext =  evaluateConfiguratorTabsVisibilityFor4G( occContextValue );
        occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;      
    }
};

let _postGetOccExtPointFor4G= {
    key : '4GDPostGetOccHandler', //unique identifier
    condition: function( _soaInput, _treeLoadInput, _treeLoadOutput, occContextValue ) {
        let isStructure4G = occContextValue.value && occContextValue.value.supportedFeatures && occContextValue.value.supportedFeatures['4GStructureFeature'];
        return isStructure4G;
    },
    addOccContextAtomicDataForUpdate: function( _response, occContextValue, _treeLoadInput, _treeLoadOutput ) {
        let configuratorViewsDisplayContext =  evaluateConfiguratorTabsVisibilityFor4G( occContextValue );
        if ( configuratorViewsDisplayContext !== undefined ) {
            occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
        }
    }
};


/**
 * Evaluate the visibility of "Variant Conditions" tab for EBOM
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
export let evaluateVariantConditionsTabVisibilityOnSelection = function( selectedObjs, occContextValue ) {
    let isVariantConditionTabVisible = true; //set default as true
    if ( !selectedObjs ) {   return isVariantConditionTabVisible; }

    // retrieve the product uid for comparison
    let productUid = _.get( occContextValue, 'currentState.t_uid' );
    //Validate "Variant Conditions" tab visibility, if selected objects are valid Part types
    for( var i = 0; i < selectedObjs.length; i++ ) {
        // get the current selection uid from list
        const selectedUid = selectedObjs[i].uid;
        // if root node is present in selection list, the Variant Conditions tab should not be visible
        // MultiBOM tab shows multiple products check for root node is in the selection list by inspecting awb0Parent property
        if( selectedObjs[ i ] && selectedObjs[ i ].props && selectedObjs[ i ].props.awb0Parent && !selectedObjs[ i ].props.awb0Parent.dbValues[ 0 ] ) {
            isVariantConditionTabVisible = false;
            break;
        }
        // Check for product context of each selection and hide the Variant Conditions tab if any of product context does not support Awb0SupportsVariantConditionAuthoring
        let pciForselectedObj = cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( selectedObjs[ i ], occContextValue ) );
        if( pciForselectedObj ) {
            let supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( pciForselectedObj );
            if( Object.entries( supportedFeatures ).length && supportedFeatures.Awb0SupportsVariantConditionAuthoring === undefined ) {
                isVariantConditionTabVisible = false;
                break;
            }
        }
        if( productUid === selectedUid ) {
            // Invalid Selection
            isVariantConditionTabVisible = false;
            break;
        }

        //start- parameter specific evaluation
        var parameterSupportedParentType = appCtxSvc.ctx.preferences.PLE_MeasurableAttrParentObjectTypes;
        if( selectedObjs[ i ].props && selectedObjs[ i ].props.awb0UnderlyingObject ) {
            var parentAdpObj = cdm.getObject( selectedObjs[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
            var isParameterSupported = _.find( parameterSupportedParentType, function( allowedParentType ) {
                if( parentAdpObj.modelType.typeHierarchyArray.indexOf( allowedParentType ) > -1 ) {
                    return true;
                }
            } );

            //hide OOTB variant tab in case of parameter supported objects
            if( isParameterSupported ) {
                isVariantConditionTabVisible = false;
                break;
            }
        }
        //End - parameter specific evaluation
    }

    return isVariantConditionTabVisible;
};

/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @param {Object} inputOccContext Occ Context input
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibility = function( selectedObjs, occContextValue, inputOccContext ) {
    let supportsVCA = occContextValue.supportedFeatures && occContextValue.supportedFeatures.Awb0SupportsVariantConditionAuthoring ||
    inputOccContext && inputOccContext.supportedFeatures && inputOccContext.supportedFeatures.Awb0SupportsFullScreenVariantConfiguration;
    return supportsVCA && !_.get( appCtxSvc, 'ctx.splitView.mode' ) && evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
};

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @param {Object} inputOccContext Occ Context input
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibility = function( occContextValue, inputOccContext ) {
    return ( occContextValue.supportedFeatures && occContextValue.supportedFeatures.Awb0SupportsFullScreenVariantConfiguration || inputOccContext &&
        inputOccContext.supportedFeatures && inputOccContext.supportedFeatures.Awb0SupportsFullScreenVariantConfiguration ) && !_.get( appCtxSvc, 'ctx.splitView.mode' );
};

/**
   *
  * Evaluate the visibility of Configurator tabs
  * @param {Array} selectedObjs The selected objects collection
  * @param {Object} occContextValue Context passed to ACE sub-location
  * @param {Object} inputOccContext Occ Context input
  * @return {object} retrun configuratorViewsDisplayContext
   */
export let evaluateConfiguratorTabsVisibility = function( selectedObjs, occContextValue, inputOccContext ) {
    return {
        showVariantConditionsView : _evaluateVariantConditionsTabVisibility( selectedObjs, occContextValue, inputOccContext ),
        showVariantConfigurationView : _evaluateVariantConfigurationTabVisibility( occContextValue, inputOccContext )
    };
};

/**
 * Initialize the configurator tab evaluation service
 */
export let initialize = function() {
    _onLoadingOfACESubLocationEventListener = eventBus.subscribe( 'occDataLoadedEvent', eventData => {
        if( eventData.dataProviderActionType === 'initializeAction' && !(eventData.occContext && eventData.occContext.supportedFeatures && eventData.occContext.supportedFeatures['4GStructureFeature'] ) ) {
            evaluateConfiguratorTabsVisibility( _.get( eventData, 'scope.subPanelContext.occContext.pwaSelection' ), _.get( eventData, 'scope.subPanelContext.occContext' ) );
        }
    } );

    getPreferenceValue();

    aceDataNavigatorService.registerOnPwaSelectionChangeExtPointHandler( _onSelectionChangeExtPoint );
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( _postGetOccExtPoint );

    // 4G specific handler registration for Variant Tabs visibility
    aceDataNavigatorService.registerOnPwaSelectionChangeExtPointHandler( _onSelectionChangeExtPointFor4G );        
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( _postGetOccExtPointFor4G );
};


var getPreferenceValue = function() {
    preferenceSvc.getLogicalValue( _mpref4GDDisableVariantConfTabs ).then( function( result ) {
        if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
            hideVariantConfigurationTabs = true;
        } else {
            hideVariantConfigurationTabs = false;
        }        
    });
};


let evaluateConfiguratorTabsVisibilityFor4G = function( occContext ) {
    var selections = occContext.pwaSelection;    

    if ( selections && occContext ) {      
        // Check the preference value to see if Variant Configuration tabs need to be hidden.
         if ( hideVariantConfigurationTabs === true ) {
            return {
                showVariantConditionsView: false,
                showVariantConfigurationView: false
            };
        } else {
            return {
                showVariantConditionsView: _evaluateVariantConditionsTabVisibilityFor4G( selections, occContext ),
                showVariantConfigurationView: _evaluateVariantConfigurationTabVisibilityFor4G( occContext )
            };
        }                
    }          
};


/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibilityFor4G = function( selectedObjs, occContextValue ) {
    var enableVCA = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsVariantConditionAuthoring' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        enableVCA = _enableVCAFor4GObjectsSelected( selectedObjs, occContextValue );
        // Check further if any of the below conditions are making VCA visibility to false.
        if ( enableVCA ) {
            // Verify that the selected objects are valid and belong to the same product.
            var validSelections = validateSelectionsToBeInSingleProduct( true, occContextValue );
            if ( validSelections.length === selectedObjs.length ) {
                // Now call the ace service to verify that the selections are valid for VCA.
                enableVCA = evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
            }
        }
    }
    return enableVCA;
};

/**
 * Return the selected objects if they belong to the same product/subset
 * @param {boolean} excludeSubsetLine Pass in True if you want to exclude the subset line from validation, false otherwise.
 *                                  This is required while checking selection for VCV, where selecting the subset line is a valid selection.
 * @returns {Object} Valid target objects
  */
let validateSelectionsToBeInSingleProduct = function( excludeSubsetLine, occContext ) {
    var selections = appCtxSvc.getCtx( 'mselected' );
    var selectionObjs = [];


    if ( !( occContext.openedElement && occContext.openedElement.modelType ) ) {
        return selectionObjs;
    }
    if ( selections && selections.length > 0 ) {
        // fetch product of last selected element and it should be equal to product of rest selections
        var pciOfLastSelectedElement = cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( selections[selections.length - 1], occContext ) );
        if ( pciOfLastSelectedElement && selections !== null && selections.length > 0 ) {
            for ( var i = 0; i < selections.length; i++ ) {
                if ( commandMapSvc.isInstanceOf( 'Fgf0PartitionElement', selections[i].modelType ) ) {
                    // Partitions are not supported in AW 5.2 for inclusion in recipe
                    continue;
                }
                var underlyingObj = null;
                //  Subset under Workset is not supported as valid object for recipe creation and VCA
                if ( excludeSubsetLine ) {
                    var parentUid = occmgmtUtils.getParentUid( selections[i] );
                    if ( parentUid ) {
                        var parentObj = cdm.getObject( parentUid );
                        if ( parentObj ) {
                            if ( parentObj.props.awb0UnderlyingObject ) {
                                var parentUnderlyingObj = cdm.getObject( parentObj.props.awb0UnderlyingObject.dbValues[0] );
                                if ( parentUnderlyingObj && parentUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        }
                    }
                }

                if ( commandMapSvc.isInstanceOf( 'Awb0Element', selections[i].modelType ) &&
                    pciOfLastSelectedElement.uid === cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( selections[i], occContext ) ).uid &&
                    occContext.openedElement.uid !== selections[i].uid ) {
                    underlyingObj = cdm.getObject( selections[i].props.awb0UnderlyingObject.dbValues[0] );
                }
                if ( underlyingObj !== null ) {
                    selectionObjs.push( selections[i] );
                }
            }
        }
    }
    return selectionObjs;
};


/**
 * Evaluate the visibility of "Variant Conditions" tab for 4G objects
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */

let _enableVCAFor4GObjectsSelected = function( selectedObjs, occContextValue ) {
    if ( isVariantConfigurableSelected( occContextValue, selectedObjs ) ) {
        return false;
    }
    var invalidObjsSelected = false;
    let currentProductUid = _.get( occContextValue, 'currentState.t_uid' );
    if ( currentProductUid ) {
        var product = cdm.getObject( currentProductUid );
        if ( product &&
            product.modelType &&
            ( product.modelType.typeHierarchyArray.indexOf( 'Cpd0DesignSubsetElement' ) > -1 || product.modelType.typeHierarchyArray
                .indexOf( 'Cpd0WorksetRevision' ) > -1 ) ) {
            invalidObjsSelected = areInvalid4GObjectsSelected( selectedObjs );
        }
    }
    return !invalidObjsSelected;
};


/**
 * Checks if variant configurable object is selected
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @param {Array} selectedObjs The selected objects collection
 * @returns {boolean} true if variant configurable object is selected
 */
function isVariantConfigurableSelected( occContextValue, selectedObjs ) {
    var productUid = occContextValue.productContextInfo.props.awb0Product.dbValues[0];
    // if selections include the Top Bom line, return true else return false
    return selectedObjs.some( currentSelection => {
        let selectedUid;
        if ( currentSelection && currentSelection.props && currentSelection.props.awb0UnderlyingObject && currentSelection.props.awb0UnderlyingObject.dbValues ) {
            selectedUid = currentSelection.props.awb0UnderlyingObject.dbValues[0];
        }
        return productUid === selectedUid;
    } );
}


/**
 * Checks if any 4G objects that don't support authoring variant conditions selected or object that have
 * different product context selected
 * @param {Array} selectedObjs The selected objects collection
 * @returns {boolean} true if invalid 4G object is selected
 */
function areInvalid4GObjectsSelected( selectedObjs ) {
    var invalidObjsSelected = false;
    var parentUids = [];

    for ( var i = 0; i < selectedObjs.length; i++ ) {
        // check if selection is a subset
        if ( selectedObjs[i].modelType.typeHierarchyArray.indexOf( 'Fgd0DesignSubsetElement' ) > -1 ) {
            invalidObjsSelected = true;
            break;
        }
        if ( selectedObjs[i].props.awb0Parent ) {
            parentUids.push( selectedObjs[i].props.awb0Parent.dbValues[0] );
        }
    }
    // At least one of the selection is Subset so return
    if ( invalidObjsSelected ) {
        return true;
    }

    parentUids = _.uniq( parentUids );
    if ( parentUids.length > 1 ) {
        //When there are more than one parent objects for selections then
        // Check if parent of any selected element is a design subset element
        for ( var j = 0; j < parentUids.length; j++ ) {
            var parent = cdm.getObject( parentUids[j] );
            if ( parent && parent.modelType &&
                parent.modelType.typeHierarchyArray.indexOf( 'Fgd0DesignSubsetElement' ) > -1 ) {
                invalidObjsSelected = true;
                break;
            }
        }
    }
    return invalidObjsSelected;
}

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibilityFor4G = function( occContextValue ) {
    var enableVCV = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsFullScreenVariantConfiguration' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // The code in AW61 is looking at worksetTopNode on the context. If worksetTopNode is not defined then it was returning TRUE.
        // In 4G worksetTopNode is always undefined. Hence returning ture below.
        enableVCV = true;
    }
    return enableVCV;
};

/**
 * Destroy and unsubscribe configurator tab evaluation service
 */
export let destroy = function() {
    aceDataNavigatorService.unregisterOnPwaSelectionChangeExtPointHandler( _onSelectionChangeExtPoint );
    aceTreeLoadResultBuilderService.unregisterOccContextAtomicDataProvider( _postGetOccExtPoint );
    aceDataNavigatorService.unregisterOnPwaSelectionChangeExtPointHandler( _onSelectionChangeExtPointFor4G );
    aceTreeLoadResultBuilderService.unregisterOccContextAtomicDataProvider( _postGetOccExtPointFor4G );
    eventBus.unsubscribe( _onLoadingOfACESubLocationEventListener );
    appCtxSvc.updatePartialCtx( 'configuratorViewsDisplayContext', {
        showVariantConditionsView : false,
        showVariantConfigurationView : false
    } );
    appCtxSvc.updatePartialCtx( 'solutionVariantViewsDisplayContext', {
        showSolutionVariantsView : false
    } );
};

export default exports = {    
    evaluateVariantConditionsTabVisibilityOnSelection,
    evaluateConfiguratorTabsVisibility,
    initialize,
    destroy
};
