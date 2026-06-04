// Copyright (c) 2022 Siemens

/**
 * @module js/discoverySubscriptionService
 */
import appCtxSvc from 'js/appCtxService';
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import aceFilterService from 'js/aceFilterService';
import cdmService from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import discoveryFilterService from 'js/discoveryFilterService';
import discoveryPropertyPolicyService from 'js/discoveryPropertyPolicyService';
import createWorksetService from 'js/createWorksetService';
import occmgmtUtils from 'js/occmgmtUtils';
import messageSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import structureFilterService from 'js/structureFilterService';
import occmgmtGetSvc from 'js/aceGetService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import AwStateService from 'js/awStateService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import columnFilterService from 'js/columnFilterService';


var exports = {};
var _eventSubDefs = [];
var _continueWithUnsaved = false;
var _contextKey = null;
var _showingUserChoiceForWorksetSave;
var _showingUserChoiceForWorksetRefresh;

const WORKSET_REVISION = 'WorksetRevision';
const APPSESSION = 'AppSession';
const APPSESSION_WORKSET = 'AppSessionWorkset';
const FND0WORKSET_REVISION = 'Fnd0WorksetRevision';
const CRITERIA_TYPE_COLUMN = 'Column';

/**
  * Initialize
  * @param {Object} continueWithoutSave set flag indicating continue without save usecase
*/
export let setContinueWithUnsaved = function( continueWithoutSave ) {
    _continueWithUnsaved = continueWithoutSave;
};

export let postProcessingWorksetSaveAsRevise = function( newObjectUid, topElement, openedObjectType ) {
    // Below publish event will add the newly created workset in interacted product list
    // so that getOcc SOA will get called with restore mode. This is needed so that the server
    // can create the autobookmark on getOcc call
    let createdObject = {
        uid: newObjectUid
    };
    let eventData = {
        createdObject: createdObject
    };
    eventBus.publish( 'swc.objectCreated', eventData );
    if ( _continueWithUnsaved && openedObjectType !== undefined && openedObjectType === WORKSET_REVISION && topElement !== undefined ) {
        // continueWithUnSaved true reflects workset is dirty
        let localizedMessages = localeSvc.getLoadedText( 'OccurrenceManagementSubsetConstants' );
        let openedWorksetObject = cdmService.getObject( topElement.props.awb0UnderlyingObject.dbValues[0] );
        if ( openedWorksetObject.props.is_modifiable.dbValues[0] === '1' ) {
            messageSvc.showInfo( localizedMessages.saveAsWorksetWithPersistedChanges );
        } else{
            messageSvc.showInfo( localizedMessages.saveAsWorksetWithNoWriteAccess );
        }
    }
    _continueWithUnsaved = false;
};

let initializeContextKey = function( key ) {
    _contextKey = key;
};

/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibility = function( selectedObjs, occContextValue ) {
    let enableVCA = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsVariantConditionAuthoring' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        let validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProductFromOccContext( true, occContextValue, false );
        if( validSelections.length === selectedObjs.length ) {
            // Now call the ace service to verify that the selections are valid for VCA.
            enableVCA = aceConfiguratorTabsEvaluationService.evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
        }
    }
    return enableVCA;
};

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @param {Object} selectedObjs An array of currently selected objects
 * @param {Object} occContextValue An updated version of subPanelContext objectprovided by the parent view
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibility = function( selectedObjs, occContextValue ) {
    let enableVCV = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsFullScreenVariantConfiguration' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        let validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProductFromOccContext( false, occContextValue, false );
        if( validSelections.length === selectedObjs.length ) {
            enableVCV = true;
        }
    }
    return enableVCV;
};

/**
 * Determine whether filter panel should be repainted based on user action
 * @param {Object} loadInput TreeLoadInput
 * @param {Object} soaInput Input for GetOcc soa
 * @returns {boolean} true if user action is not navigation
 */
let shouldFetchFilterData = function( loadInput, soaInput ) {
    return appCtxSvc.ctx.sidenavCommandId && appCtxSvc.ctx.sidenavCommandId === 'Awb0StructureFilterCommand' && discoveryFilterService.isDiscoveryIndexed() &&
                loadInput.dataProviderActionType !== 'nextAction' && loadInput.dataProviderActionType !== 'previousAction' &&
                ( !soaInput.inputData.expansionCriteria || !soaInput.inputData.expansionCriteria.expandBelow );
};


/**
* Pre getOccurrences SOA extension point registration
*/
const registerPreGetOccDiscoveryExtPoints = function() {
    // Variant change handler registration
    let variantInfoChangeConditionFunc = function( _loadInput, occContext ) {
        //  We need this handling due to VOO changes.
        // The AW server expected filterOrRecipeChange to be true when removing VOO via
        // "No Variant Rule" action in client. This is because although VOO is shown as a
        // variant rule in UI, it is actually a Recipe option and is bookmarked via Recipe.
        // Check for VARIANT_RULE_CHANGE user gesture and if it is present then
        // we can conclude that user is trying to unset the VOO via SVR application.
        if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.userGesture &&  occContext.transientRequestPref.userGesture === 'VARIANT_RULE_CHANGE' && occContext.supportedFeatures.Awb0ConfiguredByProximity ) {
            return true;
        }
        return false;
    };
    let variantInfoChangeOccInputFunc = function( _loadInput, _occContext, _currentContext, soaInput ) {
        soaInput.inputData.requestPref.filterOrRecipeChange = [ 'true' ];
    };

    let variantChangeExtPoint = {
        key : 'discoveryVariantChangeHandler', //unique identifier
        condition: variantInfoChangeConditionFunc,
        populateGetOccInput: variantInfoChangeOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( variantChangeExtPoint );

    // Discovery Reset structure handler registration
    let resetStructureConditionFunc = function( _loadInput, occContext ) {
        if( occContext && occContext.transientRequestPref && ( occContext.transientRequestPref.savedSessionMode === 'reset' || occContext.transientRequestPref.replayRecipe === 'true' ) && ( discoveryFilterService.isDiscoveryIndexed() ||
            occContext.topElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 || createWorksetService.isWorkset( appCtxSvc.ctx.mselected[0] ) ) ) {
            return true;
        }
        return false;
    };
    let resetStructureOccInputFunc = function( ) {
        discoveryFilterService.clearAllCacheOnReset();
        discoveryFilterService.setResetInitiated();
    };
    let resetStructureExtPoint = {
        key : 'discoveryResetStructureHandler', //unique identifier
        condition: resetStructureConditionFunc,
        populateGetOccInput: resetStructureOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( resetStructureExtPoint );

    // Discovery config change structure handler registration
    let configChangeConditionFunc = function( _loadInput, occContext, soaInput  ) {
        var isToggle = false;
        if ( soaInput.inputData.requestPref.userGesture && soaInput.inputData.requestPref.userGesture[0].includes( 'TOGGLE_CHANGE' ) ) {
            isToggle = true;
        }
        return ( !_.isEmpty( occContext.configContext ) || isToggle ) && ( discoveryFilterService.isDiscoveryIndexed() || createWorksetService.isAutoSaveWorksetEnabled( occContext.openedObjectType ) );
    };
    let configChangeOccInputFunc = function( _loadInput, occContext ) {
        if( discoveryFilterService.isDiscoveryIndexed() ) {
            discoveryFilterService.clearAllCacheOnReset();
        }
        if( createWorksetService.isAutoSaveWorksetEnabled( occContext.openedObjectType ) ) {
            registerPartialErrorOverride(  );
        }
    };
    let configChangeExtPoint = {
        key : 'discoveryConfigChangeHandler', //unique identifier
        condition: configChangeConditionFunc,
        populateGetOccInput: configChangeOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( configChangeExtPoint );

    // Discovery filter param input handler
    let filterParamConditionFunc = function( treeLoadInput, occContext ) {
        // Return FALSE if 4GD Feature
        var supportedFeatures =  occmgmtStateHandler.getSupportedFeaturesFromPCI( cdmService.getObject( occContext.currentState.pci_uid ) );
        if( supportedFeatures && supportedFeatures['4GStructureFeature'] ) {
            return false;
        }
        return true;
    };
    let filterParamInputFunc = function( loadInput, occContext, currentContext, soaInput ) {
        if( shouldFetchFilterData( loadInput, soaInput ) ) {
            soaInput.inputData.requestPref.calculateFilters = [ 'true' ];
            soaInput.inputData.requestPref.activeRecipeGroupIndex = [ occContext.activeGroupIndex.toString() ];
        }
        // Populate filter params in SOA input
        if ( occContext.openedObjectType === WORKSET_REVISION || occContext.openedObjectType === APPSESSION_WORKSET  || discoveryFilterService.isDiscoveryIndexed() ) {
            populateDiscoveryFilterParams( soaInput.inputData, currentContext, occContext );
        } else {
            populateFilterParameters( loadInput, occContext, currentContext, soaInput );
        }
        let wsRevision;
        if ( occContext.openedObjectType === WORKSET_REVISION ) {
            wsRevision = cdmService.getObject( occContext.topElement.props.awb0UnderlyingObject.dbValues[0] );
        } else if ( occContext.openedObjectType === APPSESSION_WORKSET ) {
            wsRevision = cdmService.getObject( occContext.rootElementInSession.props.awb0UnderlyingObject.dbValues[0] );
        }
        if( wsRevision && wsRevision.props.lsd ) {
            soaInput.inputData.requestPref.worksetRevLastSavedDate = [ wsRevision.props.lsd.dbValues[0] ];
        }
        // Idenfity if snapshot is being applied through getOccurrences call
        // On snapshot apply, do not retain tree expansion state
        if ( soaInput.inputData.requestPref.userGesture && soaInput.inputData.requestPref.userGesture[0] === 'APPLY_SNAPSHOT' ) {
            loadInput.isFocusedLoad = true;
            loadInput.retainTreeExpansionStates = false;
        }
    };
    let filterParamExtPoint = {
        key : 'discoveryFilterParamHandler', //unique identifier
        condition: filterParamConditionFunc,
        populateGetOccInput: filterParamInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( filterParamExtPoint );

    // Discovery selection sync handler for SWC
    let SWCSelectionSyncConditionFunc = function( loadInput, occContext, soaInput ) {
        return occContext.openedObjectType === 'SaveWorkingContext' && loadInput.dataProviderActionType === 'focusAction' &&
        soaInput.inputData.focusOccurrenceInput && soaInput.inputData.focusOccurrenceInput.element;
    };
    let SWCSelectionSyncOccInputFunc = function( _loadInput, _occContext, currentContext, soaInput ) {
        var productPCI;
        var parentObject = soaInput.inputData.focusOccurrenceInput.element;
        var rootObj;
        var parentHierarchy = [];
        var x = 0;
        do {
            rootObj = parentObject;
            parentHierarchy[x] = rootObj;
            var parentUid = occmgmtUtils.getParentUid( parentObject );
            if ( parentUid === null && parentHierarchy.length > 1 ) {
                // we have reached the root i.e. the swc
                break;
            }
            parentObject = cdmService.getObject( parentUid );
            x++;
        } while( parentObject );

        if( currentContext.elementToPCIMap[ parentHierarchy[x - 1].uid ] ) {
            // we want the product that the focusOcc is under, so we use the second to last element
            productPCI = currentContext.elementToPCIMap[ parentHierarchy[x - 1].uid ];
        }
        soaInput.inputData.config.productContext = occmgmtUtils.getObject( productPCI );
    };

    let SWCSelectionSyncExtPoint = {
        key : 'discoverySWCSelectionSyncHandler', //unique identifier
        condition: SWCSelectionSyncConditionFunc,
        populateGetOccInput: SWCSelectionSyncOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( SWCSelectionSyncExtPoint );
};

/**
* Post getOccurrences SOA extension point registration
*/
let registerPostGetOccDiscoveryExtPoints = function() {
    // variable to hold "Open" or "RefreshUrl" cases type. Undefined if neither is true.
    let openOrURLRefresh = undefined;

    // Post getOccurrences response handler registration
    let postGetOccConditionFunc = function( soaInput, treeLoadInput ) {
        openOrURLRefresh = treeLoadInput.openOrUrlRefreshCase;
        return true;
    };
    let postGetOccFunc = function( _response, finalOccContextValue, inputOccContext, treeLoadOutput ) {
        evaluateConfiguratorTabVisibilityForWorksetOrAppSession( finalOccContextValue );
        _setOpenedObjectInfo( finalOccContextValue, treeLoadOutput );
        // Set retainTreeExpansionStatesForOpen to false if we are in AppSession, Workset or AppSessionWorkset
        // TODO: <pmbcs2>: We need to remove this extra processing once the jitterFreeRefreshAndBackButton feature key gets implemented
        // for discovery objects as well. This work is getting tracked via story: LCS-928542
        if( !_.isUndefined( openOrURLRefresh ) && openOrURLRefresh === 'open' ) {
            _setDoNotRetainTreeExpansionStateOnOpen( treeLoadOutput );
            openOrURLRefresh = undefined;
        }
    };
    let postGetOccExtPoint = {
        key : 'discoveryPostGetOccHandler', //unique identifier
        condition: postGetOccConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFunc
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccExtPoint );
    // End Post getOccurrences response handler registration

    // Post getOccurrences filter handler registration
    let postGetOccFilterConditionFunc = function( soaInput  ) {
        if( soaInput && soaInput.inputData && soaInput.inputData.requestPref &&
            ( soaInput.inputData.requestPref.filterOrRecipeChange &&  soaInput.inputData.requestPref.filterOrRecipeChange[0] === 'true' ) ||
             soaInput.inputData.requestPref.filterChange &&  soaInput.inputData.requestPref.filterChange[0] === 'true'  ) {
            return true;
        }
        return false;
    };
    let postGetOccFilterFunc = function( response, finalOccContextValue, inputOccContext, treeLoadOutput ) {
        performPostProcessingForFilterChange( response, finalOccContextValue, inputOccContext, treeLoadOutput );
    };
    let postGetOccFilterExtPoint = {
        key : 'discoveryPostGetOccFilterHandler', //unique identifier
        condition: postGetOccFilterConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFilterFunc
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccFilterExtPoint );
};


let registerOnPWASelectionChangeExtPoint = function() {
    let _onPwaSelectionChangeExtPoint = {
        key : 'evalConfiguratorTabsOnSelectionChangeForWorksetOrAppSession', //unique identifier
        condition: function( occContextValue, parentSelection, subPanelContext ) {
            if (  occContextValue.openedObjectType === 'WorksetRevision' || occContextValue.openedObjectType === 'AppSessionWorkset' || occContextValue.openedObjectType === 'AppSession' ) {
                return true;
            }
            return false;
        },
        modifyOccContextAtomicDataOnSelectionChange: function( occContextValue, parentSelection, subPanelContext ) {
            evaluateConfiguratorTabVisibilityForWorksetOrAppSession( occContextValue );
        }
    };

    aceDataNavigatorService.registerOnPwaSelectionChangeExtPointHandler( _onPwaSelectionChangeExtPoint );
};

export let initialize = function( contextKey, subPanelContext ) {
    // Register property policy overrides form discovery subtypes.
    discoveryPropertyPolicyService.registerPropertyPolicy();
    discoveryFilterService.setContextKey( contextKey );
    createWorksetService.setContextKey( contextKey );
    initializeContextKey( contextKey );

    // Register pre and post getOccurrences extension points for column filtering
    if( subPanelContext && subPanelContext.isFilteringEnabled ) {
        columnFilterService.initialize();
    }

    registerPostGetOccDiscoveryExtPoints();
    registerPreGetOccDiscoveryExtPoints();
    registerOnPWASelectionChangeExtPoint();

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.register', function( eventData ) {
        // ChangeBOMSubLocation displays multiple products in tree. The discovery multiselect validation for a single product is not required and applicable
        if( eventData.name === 'mselected' && appCtxSvc.getCtx( _contextKey ) && appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) !== 'ChangeBom' ) {
            evaluateValidityOfSelections();
            evaluateEnablementOfFindButton();
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.update', function( data ) {
        let occMgmtCtx = appCtxSvc.getCtx( _contextKey );
        if( data.target === 'isRestoreOptionApplicableForProduct' && occMgmtCtx && occMgmtCtx.productContextInfo && occMgmtCtx.productContextInfo &&
        occMgmtCtx.productContextInfo.props.awb0Snapshot !== undefined && occMgmtCtx.productContextInfo.props.awb0Snapshot.dbValues[0] !== '' && !_.isNull( occMgmtCtx.productContextInfo.props.awb0Snapshot.dbValues[0] ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isRestoreOptionApplicableForProduct', false, contextKey );
        }
        if(  data.name === 'aceActiveContext' ) {
            evaluateValidityOfSelections();
            evaluateEnablementOfFindButton();
        }
    } ) );

    // Subscribe to elementsAdded for addition of subset handling
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function( eventData ) {
        var selectedNewElementInfos = eventData.addElementResponse.selectedNewElementInfos ? eventData.addElementResponse.selectedNewElementInfos : [ eventData.addElementResponse.selectedNewElementInfo ];
        if( selectedNewElementInfos?.length > 0 ) {
            selectedNewElementInfos.forEach( function( selectedElementInfo ) {
                let newElements = selectedElementInfo.newElements;
                let updatedParentElement = selectedElementInfo.parentElement ? selectedElementInfo.parentElement : eventData.updatedParentElement;
                if( !updatedParentElement ) {
                    updatedParentElement = eventData.addElementInput && eventData.addElementInput.parent ? eventData.addElementInput.parent : appCtxSvc.getCtx( _contextKey ).addElement.parent;
                }
                if( newElements && newElements.length > 0 && createWorksetService.isWorkset( updatedParentElement ) ) {
                    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
                    // Setting returnChildrenNoExpansion true, will honor and process expandedNodes requestpref at server side while processing getOcc call
                    // As a result, complete parentChildrenInfo map will be created in getOcc responce.
                    soaInput.inputData.requestPref.returnChildrenNoExpansion = [ 'true' ];
                    if ( newElements.length === 1 ) {
                        soaInput.inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( _.last( newElements ).uid );
                    }

                    if( createWorksetService.isAppSessionWorkset( appCtxSvc.getCtx( _contextKey ).topElement, appCtxSvc.getCtx( _contextKey ).elementToPCIMap ) ) {
                        // Send startFreshNavigation to true when subset is added to Workset in Session - this will ensure Subset is selected after add
                        soaInput.inputData.requestPref.startFreshNavigation = [ 'true' ];
                    }
                    eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
                        objectsToSelect: newElements,
                        viewToReact: _contextKey,
                        parentToExpand: updatedParentElement.uid,
                        updateVmosNContextOnPwaReset: true,
                        getOccSoaInput: soaInput,
                        retainExpansionState : true
                    } );
                }
            } );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'workset.overridePartialErrorProcessing', function( ) {
        registerPartialErrorOverride();
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'submissionSuccessful', function( eventData ) {
        if( createWorksetService.isAutoSaveWorksetEnabled( eventData.createChangeData.subPanelContext.occContext.openedObjectType ) && eventData.createChangeData.pageId === 'Awp0NewWorkflowProcessWorkflowTab' ) {
            // Reload PWA now.
            let occContextValue = {
                pwaReset: true
            };
            occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, eventData.createChangeData.subPanelContext.occContext );
        }
    } ) );
};

var populateDiscoveryFilterParams = function( inputData, currentContext, occContext ) {
    inputData.filter.searchFilterCategories = [];
    inputData.filter.searchFilterMap = {};
    let recipe;

    //Populate recipe when recipe is modified via applying proximity or delete or operator change
    if( occContext.updatedRecipe ) {
        recipe = occContext.updatedRecipe;
        inputData.requestPref.recipeUpdated =  [ 'true' ];
    }

    inputData.filter.fetchUpdatedFilters = false;
    if ( !inputData.filter.recipe || inputData.filter.recipe.length > 0 && inputData.filter.recipe[0].criteriaType !== CRITERIA_TYPE_COLUMN ) {
        inputData.filter.recipe = [];
        let criteriaTypeStr = currentContext.requestPref && currentContext.requestPref.criteriaType;

        if( criteriaTypeStr ) {
            let recipeInfo = {
                criteriaType: criteriaTypeStr
            };

            inputData.filter.recipe.push( recipeInfo );
        }

        if( recipe ) {
            inputData.filter.recipe.push.apply( inputData.filter.recipe, recipe );
        }
    }

    inputData.filter.searchFilterFieldSortType = 'Priority';
    inputData.filter.searchSortCriteria = [];
};

var processFilterStringInfoForAceIndexedProduct = function( loadInput, occContext, currentContext, soaInput ) {
    let inputFilterString;

    // Processing for the expansion through breadcrumb path and multi product scenarios
    if( occContext.elementToPCIMap ) {
        let pci_uid;
        if( loadInput.pci_uid ) {
            pci_uid = loadInput.pci_uid;
        } else if( loadInput.parentNode ) {
            pci_uid = occmgmtUtils.getProductContextForProvidedObject( loadInput.parentNode, occContext );
        }
        if( pci_uid ) {
            soaInput.inputData.config.productContext = occmgmtUtils.getObject( pci_uid );
            // Get Filter string for product being expanded if product is not active product
            if( pci_uid !== occContext.currentState.pci_uid && ( !soaInput.inputData.requestPref.calculateFilters || soaInput.inputData.requestPref.calculateFilters[0] === 'false' ) ) {
                inputFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( pci_uid );
            }
        }
    }else if( loadInput.pci_uid !== undefined && loadInput.pci_uid !== occContext.currentState.pci_uid && ( !soaInput.inputData.requestPref.calculateFilters || soaInput.inputData.requestPref.calculateFilters[0] === 'false' ) ) {
        inputFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( loadInput.pci_uid );
    }

    let filterString = null;
    let parentElementUid = loadInput.parentElement;

    // Get Filter string for filter input
    if( inputFilterString !== undefined && inputFilterString !== null ) {
        filterString = inputFilterString;
    } else {
        let object =  cdmService.getObject( parentElementUid );
        if( object ) {
            let pciForSelection =  occmgmtUtils.getProductContextForProvidedObject( object, occContext );
            if( pciForSelection ) {
                let computedFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( pciForSelection );
                filterString = computedFilterString;
            } else{
                filterString = occContext.currentState.filter;
            }
        }else{
            if( appCtxSvc.ctx.splitView ) {
                filterString = AwStateService.instance.params[ appCtxSvc.getCtx( _contextKey ).urlParams.subsetFilterParamKey ];
            } else {
                filterString = occContext.currentState.filter;
            }
        }
    }
    return filterString;
};

var populateFilterParameters = function( loadInput, occContext, currentContext, soaInput  ) {
    let filterString = processFilterStringInfoForAceIndexedProduct( loadInput, occContext, currentContext, soaInput );
    let filter = soaInput.inputData.filter;
    filter.searchFilterCategories = [];
    filter.searchFilterMap = {};

    // Populate filters/recipe only when filters are applied from this action OR when a filtered structure is being refreshed
    // or expanded
    let recipe;
    if( occContext.appliedFilters ) {
        recipe = occContext.recipe;
        let appliedFilters = occContext.appliedFilters;
        if( appliedFilters.filterCategories && appliedFilters.filterMap ) {
            filter.searchFilterCategories = appliedFilters.filterCategories;
            filter.searchFilterMap = appliedFilters.filterMap;
        }
    } else if( filterString && !currentContext.updatedRecipe ) {
        if( !occmgmtSubsetUtils.isUserGestureToChangeConfig( occContext ) ) {
            let categoriesInfo = aceFilterService.extractFilterCategoriesAndFilterMap( filterString );
            filter.searchFilterCategories = categoriesInfo.filterCategories;
            filter.searchFilterMap = categoriesInfo.filterMap;
            recipe = currentContext.recipe;
        }

        // Set calculateFilters to true as they are needed to initialize the filter panel
        // in case of ACE indexed product refresh
        if( loadInput.openOrUrlRefreshCase === 'urlRefresh' || loadInput.openOrUrlRefreshCase === 'backButton' ) {
            soaInput.inputData.requestPref.calculateFilters = [ 'true' ];
        }
    }

    if( occContext.updatedRecipe ) {
        recipe = occContext.updatedRecipe;
        soaInput.inputData.requestPref.recipeUpdated =  [ 'true' ];
    }

    filter.fetchUpdatedFilters = false;

    if( !filter.recipe || filter.recipe.length > 0 && filter.recipe[0].criteriaType !== CRITERIA_TYPE_COLUMN ) {
        filter.recipe = [];
        let criteriaTypeStr = currentContext.requestPref && currentContext.requestPref.criteriaType;

        if( criteriaTypeStr ) {
            let recipeInfo = {
                criteriaType: criteriaTypeStr
            };
            filter.recipe.push( recipeInfo );
        }

        if( recipe ) {
            filter.recipe.push.apply( filter.recipe, recipe );
        }
    }

    filter.searchFilterFieldSortType = 'Priority';
    filter.searchSortCriteria = [];
};


var performPostProcessingForFilterChange = function( response, finalOccContextValue, inputOccContext, treeLoadOutput ) {
    let publishContentReloadedEvent = true;
    if( !_.isUndefined( response.ServiceData.partialErrors ) && response.ServiceData.partialErrors.length > 0 ) {
        // If there are partial errors returned by SOA, then we do not need to publish an event for 3D Viewer.
        publishContentReloadedEvent = false;
    }

    if( inputOccContext && ( inputOccContext.updatedRecipe || inputOccContext.appliedFilters ) ) {
        discoveryFilterService.clearTransientRecipeInfo();
        //Publish the event so that any views that are interested when the PWA contents are updated
        //due to filter/recipe change update as necessary. Currently, this will be used by 3D Viewer.
        //This event must not be published in case of Workset or AppSession in Workset in 14.2 where
        //update of 3DViewer(SWA tabs) is performed based on reloadDependentTabs requestPref in getOcc
        //SOA response

        if( publishContentReloadedEvent && !createWorksetService.isAutoSaveWorksetEnabled( treeLoadOutput.openedObjectType ) ) {
            eventBus.publish( 'primaryWorkArea.contentsReloaded', {
                viewToReact: _contextKey
            } );
        }
        if( finalOccContextValue.updatedRecipe ) {
            finalOccContextValue.updatedRecipe = undefined;
        }
        if( finalOccContextValue.appliedFilters ) {
            finalOccContextValue.appliedFilters = undefined;
        }
        // Clear finalOccContextValue.searchFilterMap and category if no search filter map and category are returned from the server
        if( treeLoadOutput.filter.searchFilterCategories.length <= 0 ) {
            if( _.isUndefined( finalOccContextValue.searchFilterCategories ) ) {
                finalOccContextValue.searchFilterCategories = [];
            } else{
                finalOccContextValue.searchFilterCategories.length = 0;
            }
            finalOccContextValue.searchFilterMap = {};
            // Clear Cache
            discoveryFilterService.clearAllCacheOnReset();
        }
    }
};

var _setOpenedObjectInfo = ( finalOccContextValue, treeLoadOutput ) => {
    if( treeLoadOutput.openedObjectType === WORKSET_REVISION ) {
        const openedObject = treeLoadOutput.topElement.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ? cdmService.getObject( treeLoadOutput.topElement.props.awb0UnderlyingObject.dbValues[0] ) : treeLoadOutput.topElement;
        if ( openedObject.props && openedObject.props.items_tag ) {
            let worksetItemUid = openedObject.props.items_tag.dbValues[0];
            finalOccContextValue.worksetItemObject = cdmService.getObject( worksetItemUid );
        }
    }else if( treeLoadOutput.openedObjectType === APPSESSION_WORKSET ) {
        for( let elementUid in treeLoadOutput.elementToPCIMap ) {
            let pciUid = treeLoadOutput.elementToPCIMap[ elementUid ];
            let pciObject = cdmService.getObject( pciUid );
            if( pciObject ) {
                let productObject = cdmService.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                let isAppSessionWithWorkset = productObject && productObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1;

                if( isAppSessionWithWorkset ) {
                    finalOccContextValue.rootElementInSession = cdmService.getObject( elementUid );
                    break;
                }
            }
        }
    }
};

var _setDoNotRetainTreeExpansionStateOnOpen = ( treeLoadOutput ) => {
    var isJitterFreeBackBtnSupported = occmgmtUtils.isFeatureSupported( treeLoadOutput.productContextInfo, 'Awb0JitterFreeRefreshBackButton' );
    if( !isJitterFreeBackBtnSupported &&
            ( treeLoadOutput.openedObjectType === WORKSET_REVISION ||
                treeLoadOutput.openedObjectType === APPSESSION || treeLoadOutput.openedObjectType === APPSESSION_WORKSET ) ) {
        treeLoadOutput.retainTreeExpansionStatesForOpen = false;
    }
};

var evaluateValidityOfSelections = function() {
    let validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
    discoveryFilterService.validateTermsToIncludeOrExclude( validSelectedObjects );
    let isInWorksetContext = createWorksetService.isWorkset( appCtxSvc.getCtx( _contextKey ).topElement );
    let isInAppSessionWorksetContext = createWorksetService.isAppSessionWorkset( appCtxSvc.getCtx( _contextKey ).topElement, appCtxSvc.getCtx( _contextKey ).elementToPCIMap );
    if ( isInWorksetContext || isInAppSessionWorksetContext ) {
        let currentVisibility = _.get( appCtxSvc, 'ctx.filter.validSelectionsInSingleSubsetInWorkset' );
        if( validSelectedObjects && validSelectedObjects.length >= 1 && validSelectedObjects.length === appCtxSvc.ctx.mselected.length ) {
            if( !currentVisibility ) {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', true, 'filter' );
            }
        } else if( currentVisibility || _.isUndefined( currentVisibility ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', false, 'filter' );
        }
    }

    // TODO: Unable to remove context key dependency as there is no way we can identify pci of a selected Awb0DesignElement objects
    // for comparison with all selections to ensure all selections belong to same subset in Workset. THis can only be done in JS file by traversing the parent of selection
};

//Evaluate the enablement of find button when in workset or appSessionWorkset.
//Find button will be enabled if any of the subset has "Awb0FindInStructure" featurekey set as true
var evaluateEnablementOfFindButton = function() {
    let context = appCtxSvc.getCtx( _contextKey ); //context of current selection
    let topElement = context.topElement; //top element of current selection
    let isInWorksetContext = createWorksetService.isWorkset( topElement );
    let isInAppSessionWorksetContext = createWorksetService.isAppSessionWorkset( topElement, context.elementToPCIMap );

    if ( isInWorksetContext || isInAppSessionWorksetContext ) {
        let currentVisibility = _.get( appCtxSvc, 'ctx.filter.isFindEnabled' );
        var enableFindInStructure = occmgmtSubsetUtils.isFindSupportedForOpenedObject( context );
        if( enableFindInStructure && !currentVisibility ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isFindEnabled', true, 'filter' );
        }else if( !enableFindInStructure && ( currentVisibility || _.isUndefined( currentVisibility ) ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isFindEnabled', false, 'filter' );
        }
    }
};

export let registerPartialErrorOverride = function( ) {
    let context = appCtxSvc.getCtx( _contextKey );
    if( context && !context.processPartialErrorsFunc ) {
        occmgmtUtils.updateValueOnCtxOrState( 'processPartialErrorsFunc', processPartialErrorsFunc, _contextKey );
    }
};

var processPartialErrorsFunc = function( soaResponse, contextState ) {
    let isFurtherProcessingReq = true;
    // Look for our specific error code in partial error.
    if( soaResponse.ServiceData.partialErrors ) {
        _.forEach( soaResponse.ServiceData.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( errorValue ) {
                let resource = 'OccurrenceManagementSubsetConstants';
                let localTextBundle = localeSvc.getLoadedText( resource );
                if( errorValue.code === 126276 ) {
                    if( _showingUserChoiceForWorksetSave ) {
                        isFurtherProcessingReq = false;
                        return isFurtherProcessingReq;
                    }
                    _showingUserChoiceForWorksetSave = true;
                    // Create buttons for concurrent save warning message.
                    let buttons = [ {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.CancelText,
                        onClick: function( $noty ) {
                            _showingUserChoiceForWorksetSave = false;
                            $noty.close();
                            // Case: Cancel
                            eventBus.publish( 'ace.cancelUserChanges' );
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.OverwriteText,
                        onClick: function( $noty ) {
                            $noty.close();
                            _showingUserChoiceForWorksetSave = false;
                            // Case: Overwrite
                            eventBus.publish( 'ace.redoUserChanges' );
                        }
                    } ];

                    // display the pop-up dialog now with warning info.
                    messageSvc.showWarning( errorValue.message, buttons );
                    // Inform framework that we will take care of message display and do not need them
                    // to process it any further after we are done.
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                if( errorValue.code === 126281 ) {
                    if( _showingUserChoiceForWorksetRefresh ) {
                        isFurtherProcessingReq = false;
                        return isFurtherProcessingReq;
                    }
                    _showingUserChoiceForWorksetRefresh = true;
                    // Create buttons for concurrent refresh warning message.
                    let cancelAndRefreshButton = [ {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.CancelText,
                        onClick: function( $noty ) {
                            _showingUserChoiceForWorksetRefresh = false;
                            $noty.close();
                            // Case: Cancel
                            eventBus.publish( 'ace.cancelUserChanges' );
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.RefreshText,
                        onClick: function( $noty ) {
                            $noty.close();
                            _showingUserChoiceForWorksetRefresh = false;
                            // Case: Refresh
                            let options = {};
                            options.inherit = false;
                            options.reload = true;
                            return AwStateService.instance.go( 'com_siemens_splm_clientfx_tcui_xrt_showObject', {
                                uid: contextState.context.topElement.props.awb0UnderlyingObject.dbValues[0]
                            }, options );
                        }
                    } ];
                    // display the pop-up dialog now with warning info.
                    messageSvc.showWarning( errorValue.message, cancelAndRefreshButton );
                    // Inform framework that we will take care of message display and do not need them
                    // to process it any further after we are done.
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                if ( contextState.occContext.currentState.snap_uid && errorValue.code === 126282 ) {
                    contextState.occContext.currentState.snap_uid = null;
                    contextState.context.currentState.snap_uid = null;
                    messageSvc.showError( errorValue.message );
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                return isFurtherProcessingReq;
            } );
        } );
    }
    return isFurtherProcessingReq;
};

export let cancelUserChanges = function( occContext ) {
    if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.filterOrRecipeChange ) {
        eventBus.publish( 'awDiscovery.recipeUpdateFailOnConcurrentSave' );
    }

    let onPwaLoadComplete = occContext.onPwaLoadComplete ? occContext.onPwaLoadComplete : 0;
    let occContextValue = {
        configContext: {},
        disabledFeatures: [],
        transientRequestPref: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined
    };
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

export let redoUserChanges = function( occContext ) {
    let occContextValue = {};
    if(  occContext.transientRequestPref.filterOrRecipeChange ) {
        // Case: recipe update
        occContextValue = {
            transientRequestPref: {
                calculateFilters: true,
                retainTreeExpansionStates: true,
                filterOrRecipeChange: true,
                jitterFreePropLoad: true,
                overwrite: true
            },
            updatedRecipe: occContext.updatedRecipe,
            pwaReset: !occContext.pwaReset // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.transientRequestPref.replayRecipe ) {
        // Case: replay
        occContextValue = {
            transientRequestPref: {
                replayRecipe: true,
                jitterFreePropLoad: true,
                currentSelections: occmgmtUtils.getSelectedObjectUids( occContext.pwaSelection ),
                overwrite: true,
                userGesture: 'REPLAY'
            },
            pwaReset: !occContext.pwaReset  // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.configContext ) {
        // Case: configuration update
        occContextValue = {
            transientRequestPref: {
                overwrite: true,
                jitterFreePropLoad: true,
                userGesture: occContext.transientRequestPref.userGesture
            },
            pwaReset: !occContext.pwaReset
        };
    }
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

export let evaluateCompareButtonVisibilityInSplitMode = function( occContext ) {
    let urlParams = { ...AwStateService.instance.params };
    let t_uid = urlParams.t_uid;
    let t_uid_isWorkset = false;
    let currentVisibilityOfCompare = appCtxSvc.getCtx( 'splitView' ).isCompareValidForDiscovery;
    let disableCompare = false;
    if( t_uid  ) {
        let object =  cdmService.getObject( t_uid );
        if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AbsConfigBaseline' ) > -1 ) {
            disableCompare = false;
        }else if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 ) {
            disableCompare = true;
        }else if( object ) {
            let underlyingObject = cdmService.getObject( object.props.awb0UnderlyingObject.dbValues[0] );
            if( underlyingObject && underlyingObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1 ) {
                t_uid_isWorkset = true;
            }
        }
    }
    let t_uid2 = urlParams.t_uid2;
    let t_uid2_isWorkset = false;
    if( t_uid2  ) {
        let object =  cdmService.getObject( t_uid2 );
        if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AbsConfigBaseline' ) > -1 ) {
            disableCompare = false;
        }else if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1  ) {
            disableCompare = true;
        }else if( object ) {
            let underlyingObject = cdmService.getObject( object.props.awb0UnderlyingObject.dbValues[0] );
            if( underlyingObject && underlyingObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1 ) {
                t_uid2_isWorkset = true;
            }
        }
    }

    if( t_uid && t_uid2 && t_uid === t_uid2 && t_uid_isWorkset && t_uid2_isWorkset ) {
        disableCompare = true;
    }

    // Evaluate Compare button visibility in panel
    if( appCtxSvc.getCtx( 'splitView' ).mode ) {
        let occmgmtContext1 = appCtxSvc.getCtx( 'occmgmtContext' );
        let occmgmtContext2 = appCtxSvc.getCtx( 'occmgmtContext2' );
        occmgmtSubsetUtils.performPostProcessingForStaleTreeGuidanceBanner( occContext, occmgmtContext1, occmgmtContext2, true );
    }

    if( disableCompare && currentVisibilityOfCompare !== false ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isCompareValidForDiscovery', false, 'splitView' );
        return;
    }

    if( !disableCompare && !currentVisibilityOfCompare ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isCompareValidForDiscovery', true, 'splitView' );
    }
};


/**
 * Destroy
 */
export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );

    // Unregister property policy overrides on destroy.
    discoveryPropertyPolicyService.unRegisterPropertyPolicy();

    // Destroy column filter service
    columnFilterService.destroy();
};

export let evaluateConfiguratorTabVisibilityForWorksetOrAppSession = function( occContextValue ) {
    if ( occContextValue.openedObjectType === 'WorksetRevision' || occContextValue.openedObjectType === 'AppSessionWorkset' ) {
        let configuratorViewsDisplayContext = {
            showVariantConditionsView: _evaluateVariantConditionsTabVisibility( occContextValue.pwaSelection, occContextValue ),
            showVariantConfigurationView: _evaluateVariantConfigurationTabVisibility( occContextValue.pwaSelection, occContextValue )
        };
        occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
    }

    if ( occContextValue.openedObjectType === 'AppSession' ) {
        let topUid = _.get( occContextValue, 'currentState.t_uid' );
        const selectedUid = occContextValue.pwaSelection[0].uid;
        if ( occContextValue.pwaSelection.length === 1 && topUid === selectedUid ) {
            // Session is selected, the Variant Conditions/Variant configurations tab should not be visible
            let configuratorViewsDisplayContext = {
                showVariantConditionsView: false,
                showVariantConfigurationView: false
            };
            occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
        }
        else{
            let isProductSelected = false;
            for ( var i = 0; i < occContextValue.pwaSelection.length; i++ ) {
                var parentUid = occmgmtSubsetUtils.getParentUid( occContextValue.pwaSelection[i] );
                if ( parentUid && parentUid === topUid ) {
                    isProductSelected = true;
                    break;
                }
            }
            if (isProductSelected)
            {
                //Product under session is selected. In this case, variant configuration view visiibility is evaluated
                //in aceConfiguratorTabsEvaluationService. However, we need to set the variant conditions view visibility
                //to false in this case.
                let configuratorViewsDisplayContext = {
                    showVariantConditionsView: false,
                    showVariantConfigurationView: _evaluateVariantConfigurationTabVisibility( occContextValue.pwaSelection, occContextValue )
                };
                occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
            }
            else{
                //Product under session is not selected. In this case, variant configuration view and variant condition view
                //visiibility need to be evaluated in aceConfiguratorTabsEvaluationService.
                let configuratorViewsDisplayContext = {
                    showVariantConditionsView: _evaluateVariantConditionsTabVisibility( occContextValue.pwaSelection, occContextValue ),
                    showVariantConfigurationView: _evaluateVariantConfigurationTabVisibility( occContextValue.pwaSelection, occContextValue )
                };
                occContextValue.configuratorViewsDisplayContext = configuratorViewsDisplayContext;
            }
        }
    }
};

export default exports = {
    initialize,
    destroy,
    setContinueWithUnsaved,
    postProcessingWorksetSaveAsRevise,
    redoUserChanges,
    cancelUserChanges,
    registerPartialErrorOverride,
    evaluateCompareButtonVisibilityInSplitMode,
    evaluateConfiguratorTabVisibilityForWorksetOrAppSession
};

