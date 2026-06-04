// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0VariantConditionAuthoringGridService
 */
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import configuratorUtils from 'js/configuratorUtils';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/pca0ExpressionGridService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import Pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import popupService from 'js/popupService';
import propertyPolicyService from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Event listeners
 */
var _vcaTableReloadListener = null;

/**
 * Constant for reusable event name to load Variability data from server
 */
const _loadVariabilityDataFromServerEventName = 'Pca0VariantConditionAuthoringGrid.loadVariabilityData';

/**
 * Grid Event Handlers
 * splm edit/save handlers help detect unsaved edits
 * (when changing selection in primary workarea or navigating to another tab)
 * and handle cancel/save actions
 */
var m_editHandler; // TODO plan to declare in VM
var m_saveHandler;

/**
 * Update the viewModelObjectMap and selectedExpression in getVariantExpressionData4 soaResponse with selected column data(uid,display name,grid expression) received from hosting app
 * @param {Object} soaResponse getVariantExpressionData4 soaResponse
 * @param {Object} subpanelContext To get hosting app selection data
 */
let _updateViewModelObjectMapAndSelectedExpressions = function( soaResponse, subpanelContext ) {
    let hostingAppSelectionData = subpanelContext.selection;
    if( hostingAppSelectionData ) {
        hostingAppSelectionData.forEach( element => {
            let viewModelObject = {
                [ element.uid ]: {
                    sourceUid: element.uid,
                    displayName: element.displayName,
                    viewModelObject: ''
                }
            };
            soaResponse.viewModelObjectMap = _.extend( soaResponse.viewModelObjectMap, viewModelObject );
        } );
    }
};

/**
 * Return filter string for VCA2 SOA call
 * @returns {String} filter string
 */
let _getGridOptionFiltersForVca = function() {
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    switch ( configuratorContext.vcaVariabilityDisplayModeInGrid ) {
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT:
            return 'pca0_show_current';
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT_FAMILIES:
            return 'pca0_show_current_families';
        default:
            return 'pca0_show_all';
    }
};

/**
 * Verify if tree must be expanded
 * @returns {Boolean} true if expandAll needs to be set to true
 */
let _isExpansionRequired = function() {
    let expand = true;
    // Populate tree load result
    // Analyze tree structure based on current Display Mode and populate expansion map
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    if( configuratorContext && configuratorContext.vcaVariabilityDisplayModeInGrid &&
        configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FAMILIES ) {
        expand = false;
    }
    return expand;
};

/**
 * Trigger save actions
 * @param {Object} viewModelObjectMap - VMP map
 * @param {Object} selectionMap - businessObjectToSelectionMap
 * @param {Object} subPanelContext - subPanel context to check if configurator is in hosted mode and give override for save behavior
 * @param {Array} dirtyElements - Array of bom lines which have updated user selections
 */
let _triggerSaveVariantExpressions = function( viewModelObjectMap, selectionMap, subPanelContext, dirtyElements ) {
    // Hosted-configurator mode has override for Save behavior
    if( _.get( subPanelContext, Pca0Constants.HOSTED_CONFIGURATOR_MODE ) ) {
        eventBus.publish( 'vcagrid.save', selectionMap );
        return;
    }
    // Integration MFG has override for Save behavior
    if( appCtxService.getCtx( 'variantConditionContext.consumerAppsOverrideSave' ) ) {
        var expressions = [];
        let boKeys = Object.keys( selectionMap );
        _.forEach( boKeys, boKey => {
            var elementExpressions = {
                affectedObject: pca0CommonUtils.getOriginalColumnKeyFromSplitColumnKey( boKey ),
                familySelections: {},
                userSelections: {}
            };

            // Get displayName
            var viewModelObject = viewModelObjectMap[ boKey ];
            elementExpressions.displayValue = viewModelObject && viewModelObject.displayName ? viewModelObject.displayName : boKey;

            let selections = selectionMap[ boKey ];
            let selectionKeys = Object.keys( selections );
            _.forEach( selectionKeys, selectionKey => {
                let selection = selections[ selectionKey ];

                // Family selection, format:
                // familySelections:
                //   isRh2P2YI7h15C: 1
                if( selection.props && selection.props.isFamilyLevelSelection && selection.props.isFamilyLevelSelection[ 0 ] ) {
                    elementExpressions.familySelections[ selection.nodeUid ] = selection.selectionState;
                } else {
                    // User selection, format:
                    // userSelections:
                    //  iwTh2P2YI7h15C:
                    //    0: {optionValue: "30", selectionState: 1}
                    if( !elementExpressions.userSelections.hasOwnProperty( selection.family ) ) {
                        elementExpressions.userSelections[ selection.family ] = [];
                    }

                    var optionValue = '';
                    if( !selection.nodeUid && _.get( selection, 'props.isFreeFormFamily.0' ) ) {
                        optionValue = selection.valueText;
                    } else {
                        optionValue = selection.nodeUid;
                    }
                    elementExpressions.userSelections[ selection.family ].push( {
                        optionValue: optionValue,
                        selectionState: selection.selectionState
                    } );
                }
            } );

            expressions.push( elementExpressions );
        } );
        eventBus.publish( 'vcagrid.save', { expressions, dirtyElements } );
        return;
    }
    eventBus.publish( 'Pca0VariantConditionAuthoringGrid.SaveExpressions', {} );
};

/**
 * Remove Split Columns with no authored conditions.
 * @param {Object} businessObjectToSelectionMap - selection Map
 * @param {Array} columns - Tree DataProvider Columns
 */
let _removeEmptySplitColumns = function( businessObjectToSelectionMap, columns ) {
    let selectionMap = businessObjectToSelectionMap;
    let boKeys = Object.keys( selectionMap );
    //  let boKeysToRemove = [];
    _.forEach( boKeys, boKey => {
        if( _.find( columns, { uid: boKey, isSplitColumn: true } ) && Object.keys( selectionMap[ boKey ] ).length === 0 ) {
            delete businessObjectToSelectionMap[ boKey ];
        }
    } );
};

/**
 * Checks whether variant condition authoring grid contains unsaved edits.
 * @param {Object} backupSelectionMap - businessObjectToSelectionMap [ Backup value initialized on Start Edit Mode]
 * @param {Object} activeSelectionMap - businessObjectToSelectionMap current value updated with edits by user in Edit Mode
 * @return {Boolean} true if variant condition authoring grid is dirty, false otherwise.
 */
let _isVCADirty = function( backupSelectionMap, activeSelectionMap ) {
    var isVCAInEdit = appCtxService.getCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE );
    return isVCAInEdit && !_.isEqual( backupSelectionMap, activeSelectionMap );
};

/**
 * Reset Edit Mode
 * @param {Object} vcaEditState - Atomic data which stores the state of edit for VCA table
 */
let _resetEditMode = ( vcaEditState ) => {
    Pca0VCAUtils.instance.resetContextOfTableOrTree( vcaEditState, false );
};

/**

 * Initialize context and edit handler with respect to VM DATA
 * @param {Object} declViewModel VM Data to initialize view
 */
let _contextInitialization = function( declViewModel ) {
    // Reset Edit Mode
    _resetEditMode( declViewModel.atomicDataRef.vcaEditState );
    exports.toggleFilterCriteriaSettingsState( declViewModel.data.subPanelContextInfo.isConfigurationReadOnly, false );

    // Reset selection state for FreeForm families: dispatch atomic data changes
    let gridSelectionState = declViewModel.atomicDataRef.gridSelectionState.getAtomicData();
    let newGridSelectionState = { ...gridSelectionState };
    newGridSelectionState.isFreeFormOptionValueSelected = false;
    declViewModel.atomicDataRef.gridSelectionState.setAtomicData( newGridSelectionState );

    // Edit Handler
    m_editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModel
        } ) );

    // Add new method to identify editing context
    m_editHandler.getEditHandlerContext = function() {
        return Pca0Constants.VCA_CONTEXT;
    };

    editHandlerService.setEditHandler( m_editHandler, Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );

    // Save Handler
    m_saveHandler = {
        isDirty: function() {
            let atomicDataRef = declViewModel.atomicDataRef;
            var variabilityProps = atomicDataRef.variabilityProps.getAtomicData();
            return _isVCADirty( variabilityProps.backupOfBusinessObjectToSelectionMap, variabilityProps.businessObjectToSelectionMap );
        },
        saveEdits: function( /*datasource, inputs*/ ) {
            let vmVariabilityProps = declViewModel.atomicDataRef.variabilityProps;

            // Clone current status for atomic data
            var variabilityProps = { ...vmVariabilityProps.getAtomicData() };
            var soaResponse = variabilityProps.soaResponse;

            // Remove Split columns with no authored conditions.
            _removeEmptySplitColumns( variabilityProps.businessObjectToSelectionMap, declViewModel.dataProviders.treeDataProvider.cols );

            // Dispatch atomic data changes
            vmVariabilityProps.setAtomicData( variabilityProps );

            //SubpanelContext is passed to give override for save action if hosted-configurator mode
            let subPanelContext = _.get( declViewModel, 'subPanelContext' );
            // Trigger Save actions
            _triggerSaveVariantExpressions( soaResponse.viewModelObjectMap, variabilityProps.businessObjectToSelectionMap, subPanelContext, [ ...variabilityProps.dirtyElements ] );
        },
        cancelEdits: () => {
            pca0CommonUtils.setVisibilityOfEditCommandInPWA( true );
        }
    };
};

let _buildTreeData = ( soaResponse, vmVariabilityProps, vmGridSelectionState, treeDataProvider ) => {
    // Populate businessObjectToSelectionMap and get Column Properties
    let { columnProperties, columnSplitIDsMap, businessObjectToSelectionMap } =
    Pca0VariabilityTreeDisplayService.getColumnPropsAndSelectionMap(
        Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION,
        soaResponse );

    // Variability Props <Atomic Data>
    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };
    variabilityProps.soaResponse = { ...soaResponse };
    variabilityProps.columnProperties = [ ...columnProperties ];
    variabilityProps.businessObjectToSelectionMap = businessObjectToSelectionMap;

    // Build columns
    let variabilityColumnProps = {
        displayTreeNavigationText: true,
        enableColumnMenu: true,
        variabilityPropertiesToDisplay: soaResponse.variabilityPropertiesToDisplay
    };

    // Enable column menus
    let tableColumnProps = _.cloneDeep( columnProperties );
    _.forEach( tableColumnProps, columnProps => {
        columnProps.enableColumnMenu = true;
    } );

    let loadColumnsResult = Pca0VariabilityTreeDisplayService.loadColumns(
        tableColumnProps,
        variabilityColumnProps,
        Pca0Constants.VCA_CONTEXT,
        treeDataProvider,
        vmGridSelectionState );

    let variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );

    // Initialize properties to be dispatched as VM updates (data and fields)
    // Such data will be used for loading TreeLoadResult
    var expansionMap = undefined;
    var expandAll = _isExpansionRequired();
    if( !expandAll ) {
        expansionMap = pca0CommonUtils.getShowFamiliesExpansionMap( variabilityNodes, businessObjectToSelectionMap );
    }
    variabilityProps.expandAll = expandAll;
    variabilityProps.expansionMap = expansionMap;

    // Look for root Node and get list of families
    // Look for isFreeForm and for cfg0ValueDataType properties for each family
    // Save a map with free form values
    var freeFormAndEnumeratedValuesMap = {};
    var rootNode = _.find( variabilityNodes, { nodeUid: '' } );
    assert( rootNode, 'RootElement is missing in the response' );
    var optionFamilies = rootNode.childrenUids;
    if( !_.isUndefined( optionFamilies ) ) {
        for( var kx = 0; kx < optionFamilies.length; kx++ ) {
            var familyUID = optionFamilies[ kx ];
            var familyNode = _.find( soaResponse.variabilityTreeData.variabiltyNodes ?
                soaResponse.variabilityTreeData.variabiltyNodes : soaResponse.variabilityTreeData, { nodeUid: familyUID } );
            assert( familyNode, 'Family node is missing in the response' );
            var familyObject = soaResponse.viewModelObjectMap[ familyUID ];
            assert( familyObject, 'Family object is missing in the response' );

            if( familyObject.props && familyObject.props.isFreeForm && familyObject.props.isFreeForm[ 0 ] === 'true' ||
                pca0CommonUtils.isEnumeratedFamily( familyObject ) ) {
                freeFormAndEnumeratedValuesMap[ familyUID ] = familyNode.childrenUids;
            }
        }
    }

    // Perform post processing after getVariantExpressionData4 SOA response is returned
    // In case of empty Variant Conditions, force "Show All Features" as selected display mode
    var emptyVCs = true;
    let elemKeys = Object.keys( soaResponse.selectedExpressions );
    _.forEach( elemKeys, elemKey => {
        let businessObjects = soaResponse.selectedExpressions[ elemKey ];

        // Empty Variant Condition can come either as empty selectedExpressions for that element
        // or as empty configExpressionSections array []
        if( businessObjects.length !== 0 &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet ) &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections ) &&
            businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections.length !== 0 ) {
            emptyVCs = false; // Element has variant conditions defined
        }
    } );

    if( emptyVCs ) {
        variabilityProps.expandAll = true;
        let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
        let updatedConfiguratorContext = { ...configuratorContext };
        updatedConfiguratorContext.vcaVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.FEATURES;
        appCtxService.updateCtx( 'configuratorContext', updatedConfiguratorContext );
    }
    vmVariabilityProps.setAtomicData( variabilityProps );

    // Grid Selection State <Atomic Data>
    // Reset selection state for FreeForm families: dispatch atomic data changes
    let newGridSelectionState = { ...vmGridSelectionState.getAtomicData() };
    newGridSelectionState.isFreeFormOptionValueSelected = false;
    vmGridSelectionState.setAtomicData( newGridSelectionState );

    // View Model internal data treeMaps
    let treeMaps = {
        soaResponseConfigPerspectiveUid: soaResponse.configPerspective.uid, // used when resetting filter and in Formula Editor
        soaResponseSelectedExpressions: soaResponse.selectedExpressions,
        columnSplitIDsMap: columnSplitIDsMap,
        freeFormAndEnumeratedValuesMap: freeFormAndEnumeratedValuesMap
    };

    // Column Configuration
    // Add context key only to 1st column
    // --> pca0RendererService.populateHeaderIcon calls _setContainerHeight only once for the entire tree.
    loadColumnsResult.columnInfos[ 0 ].contextKey = Pca0Constants.VCA_CONTEXT;

    const treeColumnConfig = {
        ...treeDataProvider.columnConfig,
        columns: loadColumnsResult.columnInfos
    };

    return { treeMaps, treeColumnConfig, isDataLoaded: true, objectSetUri: 'Pca0VariantConditions' };
};

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Get Property Policy for Configurator perspective
 * @returns {String} registered policy ID
 */
export let getConfigPerspectivePolicy = function() {
    return pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY.types;
};

/**
 * Prepare SOA input to get variants expression using getVariantExpressionData4
 * @returns {Object} required as input for SOA
 * @param {Object} subPanelContext - subPanel context in hosted configurator mode to get configContext
 */
export let prepareSOAInputToGetVariants = function( subPanelContext ) {
    let configPerspective = {};
    let selectedObjects = [];
    let selectedExpressions = [];
    let reassessSelectionsFlag = [ 'false' ];

    // set configPerspective received from hosting app in hosted-configurator mode as SOA input to getVariantExpressionData4.
    // set selectedObjects null as selected objects for hosting mode are non teamcenter objects.
    // send selected expressions through request info against "jsonGrid" key.
    // selectedExpressions will be array of selections made in hosted mode
    if( _.get( subPanelContext, Pca0Constants.HOSTED_CONFIGURATOR_MODE ) ) {
        configPerspective = subPanelContext.configPerspective;
        selectedObjects = [];
        subPanelContext.selection.forEach( ( expression ) => {
            let expressionString = JSON.stringify( expression.gridExpression );
            //Add the element in selectedExpressions array.
            selectedExpressions.push( expressionString );
            reassessSelectionsFlag[ 0 ] = 'true';
        } );
    } else {
        configPerspective = exports.getConfigPerspective();
        selectedObjects = pca0CommonUtils.getSelectedObjectsForSOA( Pca0Constants.VCA_CONTEXT, subPanelContext );
    }

    return {
        variantExpressionDataInput: {
            configContextProvider: '',
            configContext: '',
            configPerspective: configPerspective,
            selectedObjects: selectedObjects,
            currentExpandedFamilies: '',
            filters: {
                intentFilters: [],
                optionFilter: _getGridOptionFiltersForVca()
            },
            requestInfo: {
                requestType: [],
                jsonGrid: selectedExpressions,
                reassessSelections: reassessSelectionsFlag
            }
        }
    };
};

/**
 * Return Perspective information for getVariantExpressionData4 SOA Input
 * @returns {Object} Perspective Object
 */
export let getConfigPerspective = function() {
    let variantConditionContext = appCtxService.getCtx( Pca0Constants.VCA_CONTEXT );
    var allowConsumerAppsToLoadData = variantConditionContext.allowConsumerAppsToLoadData;
    if( allowConsumerAppsToLoadData && variantConditionContext.configPerspectiveFromConsumerApps ) {
        return {
            uid: variantConditionContext.configPerspectiveFromConsumerApps,
            type: 'Cfg0ConfiguratorPerspective'
        };
    }
    return pca0CommonUtils.getConfigPerspective( Pca0Constants.VCA_CONTEXT );
};

/**
 * Handle Initialization actions
 * Initialize context with PWA selection
 * Initialize Display Mode
 * [consumerApps] Setup listeners for Primary Work Area selection changes
 * @param {Object} subPanelContext - SubPanelContext
 * @param {Object} declViewModel - VM Object
 * @return {Object} PWA selection to be cached
 */
export let handleInitActions = function( subPanelContext, declViewModel ) {
    // Initialize and register Context
    let variantConditionContext = {
        selectedModelObjects: subPanelContext.selection
    };
    appCtxService.registerCtx( Pca0Constants.VCA_CONTEXT, variantConditionContext );

    // Initialize Display Mode: set "current" as default if not already set
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    if( !configuratorContext ) {
        configuratorContext = {
            vcaVariabilityDisplayModeInGrid: Pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxService.registerCtx( 'configuratorContext', configuratorContext );
    } else {
        if( _.isUndefined( configuratorContext.vcaVariabilityDisplayModeInGrid ) ) {
            configuratorContext.vcaVariabilityDisplayModeInGrid = Pca0Constants.GRID_DISPLAY_MODE.CURRENT;
            appCtxService.updateCtx( 'configuratorContext', configuratorContext );
        }
    }

    // Handling of events from/to other projects using VCA table
    // MBSE - attrtargetmgmt
    // MFG - EasyPlan, using VCA as popup
    // Initialize subscriber to event fired from external project
    // (Event handling from viewModel.json does not work in this case)
    // Event handling is firing the event to trigger data provider update
    _vcaTableReloadListener = eventBus.subscribe( 'configuratorVcaTable.reload', function() {
        eventBus.publish( _loadVariabilityDataFromServerEventName, { resetFilter: false } );
    } );

    const activeEditHandler = editHandlerService.getActiveEditHandler();
    if( _.isNull( activeEditHandler ) || !activeEditHandler._editing ) {
        _contextInitialization( declViewModel );
    } else {
        eventBus.subscribe( 'editHandlerStateChange', function( eventData ) {
            const key = _.get( eventData, 'dataSource.contextKey' );
            if( eventData.state === 'canceling' && key !== Pca0Constants.VCA_CONTEXT ) {
                _contextInitialization( declViewModel );
            }
        } );
    }
    return subPanelContext.selection;
};

/**
/**
 * Close actions
 * Unregister variantConditionContext, all event listeners and publish events to handle grid unMount
 */
export let doVcaGridUnmount = function() {
    eventBus.unsubscribe( _vcaTableReloadListener );

    // Unregister variantConditionContext on unload of view. This is required to clear the perspective object and other data.
    // Without this, even when the loaded structure is different, the old variability data was shown since perspective object was not cleared.
    appCtxService.unRegisterCtx( Pca0Constants.VCA_CONTEXT );
    eventBus.publish( 'Pca0VariantsGrid.GridUnloaded' ); // For MFG integration
    eventBus.publish( 'configuratorVcaTable.gridUnloaded' ); // For MBSE integration and other generic listeners

    //Close dialog if open
    popupService.hide();
};

/**
 * Load VariabilityData through getVariantExpressionData4 SOA
 * Post process SOA response and restore column order
 * Initialize VM data and atomic data
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSelectionState - View Model Atomic Data (Grid Selection State)
 * @param {UwDataProvider} treeDataProvider - Data Provider to be initialized/loaded
 * @param {Array} variabilityPropertiesToDisplay - Array of additional variability properties to display as columns
 * @param {Object} subPanelContext - subPanel Context in hosted-configurator mode to get selected configContext in hosting app
 * @return {Object} container of VM data and Boolean to flag if VM is initialized
 */
export let loadVariabilityData = function( vmVariabilityProps, vmGridSelectionState, treeDataProvider, variabilityPropertiesToDisplay, subPanelContext ) {
    // Prepare SOA Input
    var input = exports.prepareSOAInputToGetVariants( subPanelContext );

    // Register Policy to get Config Perspective
    // Set the policy before SOA call
    var policyId = propertyPolicyService.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );

    return soaService.postUnchecked( 'Internal-ProductConfiguratorAw-2024-12-ConfiguratorManagement',
        'getVariantExpressionData4', input ).then( soaResponse => {
        if( policyId ) {
            propertyPolicyService.unregister( policyId );
        }

        // Handle partial errors
        if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
            pca0CommonUtils.processPartialErrors( soaResponse.ServiceData );
            // If Cfg0DefaultEffectivity preference value is in an invalid format, then we will get this error code "350005".
            // If we get this error code from the SOA response, then we will continue with further process without breaking.
            if( !( _.get( soaResponse, 'ServiceData.partialErrors.length' ) === 1 && _.get( soaResponse, 'ServiceData.partialErrors[0].errorValues[0].code' ) === 350005 ) ) {
                return { treeMaps: {}, treeColumnConfig: treeDataProvider.columnConfig, objectSetUri: 'Pca0VariantConditions' };
            }
        }

        // Enforce disabling Edit Mode when Variability Data is reloaded from server
        appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );

        // Initialize Filter Criteria
        configuratorUtils.initializeFilterCriteriaForContext( soaResponse.ServiceData.modelObjects[ soaResponse.configPerspective.uid ], Pca0Constants.VCA_CONTEXT );

        // Process SOA response and restore input column order
        let selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( soaResponse.selectedExpressions );
        var clonedExpressions = { ...selectedExpressions };

        // set selected expressions if it is in hosted mode
        // else use selected objects
        if( _.get( subPanelContext, Pca0Constants.HOSTED_CONFIGURATOR_MODE ) ) {
            soaResponse.selectedExpressions = clonedExpressions;
        } else {
            soaResponse.selectedExpressions = {};
            _.forEach( input.variantExpressionDataInput.selectedObjects, ( selectedObject ) => {
                soaResponse.selectedExpressions[ selectedObject.uid ] = clonedExpressions[ selectedObject.uid ];
            } );
        }

        const nonGridableExpressionsList = pca0CommonUtils.getNonGridableExpressionList( soaResponse.selectedExpressions );

        if( !_.isEmpty( nonGridableExpressionsList ) ) {
            pca0CommonUtils.showNotificationMessageForNonGridableExpressionsIfApplicable( nonGridableExpressionsList, soaResponse.viewModelObjectMap );
        }

        if( appCtxService.getCtx( 'variantConditionContext.allowConsumerAppsToLoadData' ) ) {
            eventBus.publish( 'Pca0VariantCondition.consumerAppsPostLoadAction', soaResponse.configPerspective.uid );
        }

        // Update SOA response
        soaResponse.variabilityPropertiesToDisplay = variabilityPropertiesToDisplay;

        //Update the soaResponse with selected Object from hosting app if configurator is in hosted-configurator mode
        if( _.get( subPanelContext, Pca0Constants.HOSTED_CONFIGURATOR_MODE ) && _.get( subPanelContext, 'selection' ).length > 0 ) {
            _updateViewModelObjectMapAndSelectedExpressions( soaResponse, subPanelContext );
        }

        return _buildTreeData( soaResponse, vmVariabilityProps, vmGridSelectionState, treeDataProvider );
    } );
};

/**
 * Trigger Data provider Action
 * @param {Boolean} needToResetFilter - True if Column Filter must be reset
 */
export let triggerDataProviderAction = ( needToResetFilter ) => {
    if( needToResetFilter ) {
        // This event will fire data provider action while also resetting column filter
        eventBus.publish( 'pltable.columnFilterApplied', {
            gridId: Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION
        } );
    } else {
        eventBus.publish( 'Pca0VariantConditionAuthoringGrid.refreshTreeDataProvider' );
    }
};

/**
 * Get tree result and required column config using provided inputs.
 * @param {Object} pwaSelection - selection in Primary Work Area
 * @param {Object} treeLoadInput - nodeBeingExpanded for the Tree Table
 * @param {UwDataProvider} treeDataProvider - Data Provider to be initialized/loaded
 * @param {Object} treeColumnProvider - Column provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @returns {Object} TreeLoadResult for the Tree Table
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TODO move to Common code and adjust VCV GRID code also
// This will become as pca0VariabilityTreeDisplayService.loadTreeProviderData MINUS SOA CALL
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export let loadTreeDataProvider = ( isDataLoaded, treeLoadInput, treeDataProvider, treeColumnProvider, vmVariabilityProps, vmTreeMaps ) => {
    // If variability Data has not been initialized
    if( !isDataLoaded ) {
        return {
            treeLoadResult: {
                parentNode: {},
                childNodes: [],
                totalChildCount: 0,
                startChildNdx: 0
            },
            treeLoadParentNode: {
                $$treeLevel: -1,
                childNdx: 0,
                displayName: 'top',
                iconURL: null,
                id: 'variabilityTreeData',
                levelNdx: -1,
                svgString: undefined,
                type: 'unknown',
                uid: 'variabilityTreeData',
                visible: true
            }
        };
    }

    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };
    let treeMaps = { ...vmTreeMaps };

    // Check for active filters and update atomic data
    let columnFilters = treeColumnProvider.columnFilters;
    if( columnFilters && columnFilters.length > 0 ) {
        variabilityProps.activeFilter = columnFilters;
    } else {
        delete variabilityProps.activeFilter;
    }

    vmVariabilityProps.setAtomicData( variabilityProps );

    var treeLoadResult = Pca0VariabilityTreeDisplayService.getTreeLoadResult(
        Pca0Constants.VCA_CONTEXT, // contextKey
        treeLoadInput.parentNode, // nodeBeingExpanded,
        treeMaps, // treeMaps
        variabilityProps, // variabilityProps
        treeDataProvider, // treeDataProvider
        undefined, // operation,
        undefined, // subsetUIDs
        undefined, // gridData
        undefined // gridEditorSelections
    );

    // fix for LCS-853721 - Aw63 - Start Edit command is getting disappeared while clicking on Edit command when Variant Formula popup not getting loaded
    // returning isCommandBarVisible as true to make 'aw_Vca_CommandBar' visible after the tree is loaded

    return {
        treeLoadResult: treeLoadResult,
        treeLoadParentNode: treeLoadInput.parentNode,
        treeMaps: treeMaps,
        isCommandBarVisible: true
    };
};

/**
 * Handle Edit Mode change
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {String} editOperation - start/cancel/save
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 * @param {Object} isConfigurationReadOnly - VM data 'isConfigurationReadOnly'
 * @returns {Object} updated VM data and atomic data
 */
export let handleEditModeChanged = function( treeDataProvider, editOperation, vmTreeMaps, vmVariabilityProps, isConfigurationReadOnly ) {
    // Clone current status for VM data and fields (atomic data)
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let columnInfos = [ ...treeDataProvider.columnConfig.columns ];
    let mustRefreshContent = false;

    // Operations on Maps
    switch ( editOperation ) {
        case Pca0Constants.GRID_EDIT_OPERATION.START:
            // Create backup maps: Create backup copies of selections and column splits
            variabilityProps.backupOfBusinessObjectToSelectionMap = _.cloneDeep( variabilityProps.businessObjectToSelectionMap );
            treeMaps.backupOfColumnSplitIDsMap = _.cloneDeep( treeMaps.columnSplitIDsMap ); // CloneDeep is needed: changes are propagated otherwise when split columns are added

            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, true );
            break;
        case Pca0Constants.GRID_EDIT_OPERATION.CANCEL:
            // Restore VMOs to original DB values
            pca0GridAuthoringService.setPropertiesToValue( treeDataProvider, true );

            // Maps: revert to backup Maps
            variabilityProps.businessObjectToSelectionMap = { ...variabilityProps.backupOfBusinessObjectToSelectionMap };

            // Split changes: in case of split columns added:
            // - revert changes into columnConfig
            // - set flag to refresh table content
            var splitChanges = !_.isEqual( treeMaps.backupOfColumnSplitIDsMap, treeMaps.columnSplitIDsMap );
            if( splitChanges ) {
                Object.entries( treeMaps.columnSplitIDsMap ).forEach( ( [ boKey, splitColumnIDs ] ) => {
                    _.forEach( splitColumnIDs, splitColumnId => {
                        if( !treeMaps.backupOfColumnSplitIDsMap[ boKey ].includes( splitColumnId ) ) {
                            _.remove( columnInfos, { uid: splitColumnId } );
                        }
                    } );
                } );
                treeMaps.backupOfColumnSplitIDsMap = _.cloneDeep( treeMaps.columnSplitIDsMap );
                mustRefreshContent = true;
            }

            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, false );

            variabilityProps.dirtyElements = [];
            break;
        case Pca0Constants.GRID_EDIT_OPERATION.SAVE_COMPLETE: {
            pca0CommonUtils.setVisibilityOfEditCommandInPWA( true );
            // Set VMOs to current DB values
            pca0GridAuthoringService.setPropertiesToValue( treeDataProvider, false );

            // Adjust FilterCriteria component layout
            exports.toggleFilterCriteriaSettingsState( isConfigurationReadOnly, false );
            variabilityProps.dirtyElements = [];
        }
            break;
    }

    const treeColumnConfig = {
        ...treeDataProvider.columnConfig,
        columns: [ ...columnInfos ]
    };

    return {
        mustRefreshContent: mustRefreshContent,

        // <TODO> optimization point Valentina
        // DO not return columnConfig which will cause a resetColumn on native SPLM code
        // hence all VMOs are being repainted
        // Rather, do as in Constraints: return a collection of columns to be removed
        // This way, if no splitChanges, VMOs will not be repainted
        columnConfig: treeColumnConfig,
        treeMaps: treeMaps,
        variabilityProps: variabilityProps,
        editOperation: editOperation
    };
};

/**
 * Start Edit Mode for VCA2 grid
 * @param {Object} vcaEditState - Atomic data of VCA table edit state
 */
export let startEditVCA2Table = function( vcaEditState ) {
    editHandlerService.setActiveEditHandlerContext( Pca0Constants.GRID_CONSTANTS.VARIANT_TREE_CONTEXT );

    // Add to the appCtx about the editing state: alternative of setting m_editHandler.startEdit();
    // This way we are not using native edit mode template for cells
    m_editHandler._editing = true;
    appCtxService.updateCtx( 'editInProgress', true );

    // Set Edit Mode for atomic data vcaEditState to edit in progress
    Pca0VCAUtils.instance.setVcaEditState( vcaEditState, true );

    pca0CommonUtils.setVisibilityOfEditCommandInPWA( false );

    // Set edit state in the app context
    appCtxService.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );

    // Reset cache for copied selections
    appCtxService.updatePartialCtx( 'variantConditionContext.copiedSelectionsCache', undefined );
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export let getSaveHandler = function() {
    return m_saveHandler;
};

/**
 * Launch actions to save authored Variant Expressions
 */
export let saveEditVCA2Table = function() {
    m_saveHandler.saveEdits();
};

/**
 * Post processing of setVariantExpression SOA - for successful SOA response
 * @param {Object} vcaEditState - edit state atomic data
 */
export let postProcessSetVariantExpressionData = function( vcaEditState ) {
    // Reset edit state in the app context
    _resetEditMode( vcaEditState );

    // Fire event to reload Variability Data
    eventBus.publish( _loadVariabilityDataFromServerEventName, { resetFilter: false } );
    m_editHandler._editing = false;
};

/**
 * Cancel Edit Mode for VCA2 grid
 * @param {Object} vcaEditState - edit state atomic data
 */
export let cancelEditVCA2Table = function( vcaEditState ) {
    // Reset edit state in the app context
    _resetEditMode( vcaEditState );

    // Notify edit handler to cancel edits
    m_saveHandler.cancelEdits();
    m_editHandler._editing = false;
};

/**
 * Reset Edit Mode status: update app context, PWA and toggle Filter Criteria to editable status
 * @param {Object} readOnlyProperty - The ViewModel readOnlyProperty
 * @param {Object} vcaEditState - Atomic data of VCA table edit state
 */
export let resetEditModeStatus = ( readOnlyProperty, vcaEditState ) => {
    _resetEditMode( vcaEditState );

    // Notify edit handler to cancel edits
    m_saveHandler.cancelEdits();

    exports.toggleFilterCriteriaSettingsState( readOnlyProperty, false );
};

/**
 * This function is helpful get expression of modified authored conditions in JSON format.
 * First, selectionMap is filtered and cleared of unedited data, then converted to PCA grid and JSON string for AW server processing.
 * @param {Object} variabilityProps - VM atomic data
 * @param {Object} columnSplitIDsMap - contains the map of generated split column UIDs
 * @returns {JSON.String} PCA Grid from selection map in JSON String.
 */
export let getExpressionData = function( variabilityProps, columnSplitIDsMap ) {
    // Filter unedited BOM lines from selection map
    let selectionMap = { ...variabilityProps.businessObjectToSelectionMap };

    // Note: 'dirtyElements' array does NOT take into account split columns (with or without expressions)
    // Process split columns for edited BOM lines: if they do not contain edits, remove them
    let bomLinesWithEdits = [];

    for( let bomLineUID of variabilityProps.dirtyElements ) {
        // Add column UID to list of constraints to send to server for update
        bomLinesWithEdits.push( bomLineUID );

        // If column contains splits, look for selections: send to server only non-empty split columns
        if( _.has( columnSplitIDsMap, bomLineUID ) ) {
            for( let splitColumnUid of columnSplitIDsMap[ bomLineUID ] ) {
                if( pca0CommonUtils.isColumnWithEdits( splitColumnUid, selectionMap ) ) {
                    bomLinesWithEdits.push( splitColumnUid ); // edit was found: split column must stay
                }
            }
        }
    }
    // Remove from selection map the bomLines that don't need to be sent to server
    selectionMap = _.pick( selectionMap, bomLinesWithEdits );

    // Remove now selections with 0 selection state.
    pca0ExpressionGridService.removeZeroSelections( selectionMap );

    // Get PCA Grid from selectionMap
    let pcaGrid = pca0ExpressionGridService.getPCAGridFromSelectionMap( selectionMap );

    // Call Util to get JSON format
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( pcaGrid );
};

/**
 * Get PCA grid from selections for Validation
 * Send individual expressions instead of bulk subExpressions in case of split columns
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} businessObjectToSelectionMap - Selection Map
 * @returns {Object} PCA Grid for validation purposes
 */
export let getExpressionDataForValidation = function( validationProps, businessObjectToSelectionMap ) {
    if( !_.isUndefined( validationProps.columnValidation ) ) {
        return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getColumnValidationPCAGrid( validationProps.columnValidation.field,
            businessObjectToSelectionMap ) );
    }
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( pca0ExpressionGridService.getValidationPCAGrid( businessObjectToSelectionMap ) );
};

/**
 * Get RequestInfo for Validation according to requested type of Validation (Initial vs Column)
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} action - The action performed (e.g. 'Initial Validate')
 * @returns {Object} RequestInfo with RequestType string for Product Configuration Validation
 */
export let getRequestInfoForValidation = function( validationProps, action ) {
    if( action === pca0CommonConstants.EXPRESSION_VALIDATE.INITIAL_VALIDATE ) {
        delete validationProps.columnValidation;
        return { requestType: [ Pca0Constants.REQ_TYPE_INITIAL_VALIDATION ] };
    }
    return {};
};

/**
 * Handle Display Mode change
 * Update context and trigger grid refresh
 * @param {Object} commandContext - the command context (atomicData: variabilityProps)
 * @param {String} displayMode - selected display mode: "Show Current Expressions"/"Show All Families"/"Show All Features"
 */
export let handleDisplayModeChange = function( commandContext, displayMode ) {
    let configuratorContext = appCtxService.getCtx( 'configuratorContext' );
    const isFilterResetRequired = !commandContext.keepFilterActive;

    // TODO REMOVE USAGE OF USECACHEDDATA

    // Do nothing if user selects active Display Mode
    if( configuratorContext.vcaVariabilityDisplayModeInGrid === displayMode ) {
        return;
    }

    let variabilityProps = { ...commandContext.variabilityProps.value };
    switch ( displayMode ) {
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT:
        case Pca0Constants.GRID_DISPLAY_MODE.CURRENT_FAMILIES:
            // Transition to "Show Current Expressions" and "Show Current Families" always requires a SOA call.
            variabilityProps.useCachedData = false;
            delete variabilityProps.expansionMap;
            variabilityProps.expandAll = true; // Expand all nodes, leaf nodes excluded
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FAMILIES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            // Transition from "Show Current Expressions" always requires a SOA call.
            variabilityProps.useCachedData = configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FEATURES;

            // if Cache data is used, create expansionMap if needed
            if( variabilityProps.useCachedData && _.isUndefined( variabilityProps.expansionMap ) ) {
                let variabilityNodes = pca0CommonUtils.getVariabilityNodes( variabilityProps.soaResponse );
                variabilityProps.expansionMap = pca0CommonUtils.getShowFamiliesExpansionMap( variabilityNodes, variabilityProps.businessObjectToSelectionMap );
            }
            variabilityProps.expandAll = false; // Expansion map will be used
            break;
        case Pca0Constants.GRID_DISPLAY_MODE.FEATURES:
            // Transition between Families-Features doesn't require a SOA call. Use cached data.
            variabilityProps.useCachedData = configuratorContext.vcaVariabilityDisplayModeInGrid === Pca0Constants.GRID_DISPLAY_MODE.FAMILIES;

            delete variabilityProps.expansionMap;
            variabilityProps.expandAll = true; // Expand all nodes, leaf nodes excluded
            break;
        default:
            return;
    }

    // if column filter saving status is true then skip resetting the filter
    if( isFilterResetRequired ) {
        // Reset filter
        delete variabilityProps.activeFilter;
        delete variabilityProps.filterApplied;
    }

    // Update atomic data
    commandContext.variabilityProps.update( variabilityProps );

    // Reset selection status for Free Form Values when changing display mode
    var gridSelectionState = { ...commandContext.gridSelectionState.value };
    gridSelectionState.isFreeFormOptionValueSelected = false;
    commandContext.gridSelectionState.update( gridSelectionState );

    configuratorContext.vcaVariabilityDisplayModeInGrid = displayMode;
    appCtxService.updateCtx( 'configuratorContext', configuratorContext );

    if( variabilityProps.useCachedData ) {
        exports.triggerDataProviderAction( isFilterResetRequired );
    } else {
        // Trigger loading of variability data, enforcing filter reset only if column filter saving status is false
        eventBus.publish( _loadVariabilityDataFromServerEventName, { resetFilter: isFilterResetRequired } );
    }
};

/**
 * Add free form option value for FF and enumerated families
 * @param {Object} vmGridSelectionState - View Model Atomic Data (Grid Selection State)
 * @param {Object} vmtreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} eventData - Event data container
 * @param {UwDataProvider} treeDataProvider - Tree data provider
 */
export let addFreeFormOptionValue = function( vmGridSelectionState, vmtreeMaps, vmVariabilityProps, eventData, treeDataProvider ) {
    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    var newFreeFormValue = eventData.valueText;
    if( !newFreeFormValue ) {
        return;
    }

    // Get information of selected Free Form family
    let gridSelectionStateFromAtomicData = vmGridSelectionState.getAtomicData();
    let gridSelectionState = { ...gridSelectionStateFromAtomicData };

    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };

    let freeFormMap = vmtreeMaps.freeFormAndEnumeratedValuesMap;
    let familyNode = gridSelectionState.selectionInfo;
    if( _.isUndefined( freeFormMap[ familyNode.nodeUid ] ) ) {
        freeFormMap[ familyNode.nodeUid ] = [];
    }
    // Server is sending free form option values with nodeID as <familyUid>:<valueText>
    // Use same format.
    var nodeUid = familyNode.nodeUid + ':' + newFreeFormValue;
    if( !freeFormMap[ familyNode.nodeUid ].includes( nodeUid ) ) {
        freeFormMap[ familyNode.nodeUid ].push( nodeUid );
    } else {
        let value = newFreeFormValue;
        messagingService.showError( localeTextBundle.showDuplicateFreeFormValueErrorMessage.replace( '{0}', value ) );
        return;
    }
    if( familyNode.isExpanded ) {
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        let vmos = viewModelCollection.getLoadedViewModelObjects();
        let updatedVMOs = [ ...vmos ];
        let familyVMO = _.find( updatedVMOs, { nodeUid: familyNode.nodeUid } );
        let featureNode = Pca0VariabilityTreeDisplayService.createViewModelTreeNode(
            Pca0Constants.VCA_CONTEXT, // contextKey
            nodeUid, // nodeUid
            familyVMO.levelNdx + 1, // levelNdx
            familyVMO.nodeUid, // parentNodeUid,
            familyVMO.alternateID, // parentNode alternateID,
            _.last( familyVMO.children ).childNdx + 1, // childNdx
            variabilityProps.soaResponse, // soaResponse
            variabilityProps.businessObjectToSelectionMap, // selectionMap
            variabilityProps.backupOfBusinessObjectToSelectionMap, // backupSelectionMap
            false // isSpecialBackgroundCell
        );

        // Add element to view model collection: add vmo to the end of the features list for that family
        let lastChildFeatureIdx = _.indexOf( updatedVMOs, _.last( familyNode.children ) );
        updatedVMOs.splice( lastChildFeatureIdx + 1, 0, featureNode );

        // Add to familyNode
        familyVMO.children.push( featureNode );

        treeDataProvider.update( updatedVMOs );
    } else {
        eventBus.publish( treeDataProvider.name + '.expandTreeNode', {
            parentNode: familyNode
        } );
    }
};

/**
 * Toggle Filter Criteria Settings State
 * @param {Object} readOnlyProperty - The ViewModel readOnlyProperty
 * @param {Boolean} isReadOnlyMode     true - if filter criteria state to be disabled
 *                                     false - if filter criteria state to be enabled
 */
export let toggleFilterCriteriaSettingsState = function( readOnlyProperty, isReadOnlyMode ) {
    readOnlyProperty.dbValue = isReadOnlyMode;
    var eventData = {
        isReadOnlyMode: isReadOnlyMode
    };
    eventBus.publish( 'Pca0Settings.toggleFilterCriteriaSettingsState', eventData );
};

/**
 * Reset the filter applied to the variability column
 * @param {Object} treeColumnProvider - Column provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data
 */
export let resetColumnFilters = function( treeColumnProvider, vmVariabilityProps ) {
    // Note: this is direct manipulation and should be avoided. TODO <revisit me>
    treeColumnProvider.columnFilters = [];

    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    let variabilityProps = { ...variabilityPropFromAtomicData };

    // Reset filter
    delete variabilityProps.activeFilter;
    delete variabilityProps.filterApplied;

    vmVariabilityProps.setAtomicData( variabilityProps );
};

/**
 * In context of ECN the variant condition needs to be saved on the split element ( and NOT original element)
 * @param {Object} vmVariabilityProps The ViewModel atomic data
 * @param {Object} vmtreeMaps - View Model data property treeMaps
 * @param {Object} eventData EventData containing a map having elementUID as its key and splitElementUID as its value
 * @returns {Object} Updated atomic data having map of newly split business object as key and user selections as its value
 */
export let saveExpressionsInECNContext = function( vmVariabilityProps, vmtreeMaps, eventData ) {
    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };
    let businessObjectToSelectionMap = variabilityProps.businessObjectToSelectionMap;
    let dirtyElements = [ ...variabilityProps.dirtyElements ];
    Object.keys( eventData ).forEach( originalElementUID => {
        let effectivitySplitElementUID = eventData[ originalElementUID ];
        businessObjectToSelectionMap[ effectivitySplitElementUID ] = businessObjectToSelectionMap[ originalElementUID ];
        dirtyElements.push( effectivitySplitElementUID );
        const elementIndex = dirtyElements.indexOf( originalElementUID );
        elementIndex > -1 ? dirtyElements.splice( elementIndex, 1 ) : '';
        delete businessObjectToSelectionMap[ originalElementUID ];

        if( vmtreeMaps.columnSplitIDsMap && Object.keys( vmtreeMaps.columnSplitIDsMap ).includes( originalElementUID ) ) {
            let variabilitySplitElementIDs = _.uniq( vmtreeMaps.columnSplitIDsMap[ originalElementUID ] );
            variabilitySplitElementIDs.forEach( variabilitySplitElementID => {
                const splitColumnId = Pca0VCAUtils.instance.generateSplitColumnKey( effectivitySplitElementUID );
                businessObjectToSelectionMap[ splitColumnId ] = businessObjectToSelectionMap[ variabilitySplitElementID ];
                const splitColIds = vmtreeMaps.columnSplitIDsMap[ effectivitySplitElementUID ];
                vmtreeMaps.columnSplitIDsMap[ effectivitySplitElementUID ] = splitColIds ? [ ...splitColIds, splitColumnId ] : [ splitColumnId ];
                delete businessObjectToSelectionMap[ variabilitySplitElementID ];
                delete vmtreeMaps.columnSplitIDsMap[ variabilitySplitElementID ];
            } );
        }
    } );
    variabilityProps.businessObjectToSelectionMap = businessObjectToSelectionMap;
    variabilityProps.dirtyElements = dirtyElements;
    return { variabilityProps, vmtreeMaps };
};

/**
 * Create a split column
 * Add new column, update BusinessObjects selection map and internal ID maps
 * @param {String} contextKey - Current Context Key
 * @param {Object} eventData - data carried by validate trigger event
 * @param {Object} vmTreeMaps - View Model data property treeMaps
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} vmGridSelectionState - View Model Atomic Data <gridSelectionState>
 * @returns {Object} - Collection of data to be dispatched
 */
export let createSplitColumn = function( contextKey, eventData, vmTreeMaps, vmVariabilityProps, vmGridSelectionState ) {
    // Clone current status for VM data and fields (atomic data)
    var treeMaps = { ...vmTreeMaps };
    let variabilityPropFromAtomicData = vmVariabilityProps.getAtomicData();
    var variabilityProps = { ...variabilityPropFromAtomicData };
    let treeDataProvider = eventData.treeDataProvider;
    let columnDef = eventData.columnDef;
    columnDef.enableColumnMenu = true;

    let splitColumnDef = Pca0VariabilityTreeDisplayService.createColumnDef( columnDef, contextKey, treeDataProvider, vmGridSelectionState );
    let cols = treeDataProvider.columnConfig.columns;

    // For VCA we also have hidden columns, So we also need to count them
    const numberOfHiddenColumns = _.countBy( cols, 'hiddenFlag' ).true || 0;
    const insertionIndex = eventData.newColumnIndexToInsert + numberOfHiddenColumns;

    cols.splice( insertionIndex, 0, splitColumnDef );

    // Update Map of Split Columns
    if( !treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ] ) {
        treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ] = [];
    }
    treeMaps.columnSplitIDsMap[ splitColumnDef.originalColumnName ].push( splitColumnDef.name );

    var vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, vmo => {
        vmo.props[ columnDef.propertyUid ] = pca0CommonUtils.getViewModelProperty( columnDef.propertyUid, vmo.parentUID, 0, {} );
    } );

    // Add entry to selection map
    variabilityProps.businessObjectToSelectionMap[ columnDef.propertyUid ] = {};

    const treeColumnConfig = {
        ...treeDataProvider.columnConfig,
        columns: [ ...cols ]
    };
    return {
        columnConfig: treeColumnConfig,
        treeMaps: treeMaps,
        variabilityProps: variabilityProps
    };
};

/**
 * Action "Clear" selections on column
 * Call utility to update data provider
 * Process DirtyElements
 * Dispatch changes on atomic Data
 * @param {UwDataProvider} treeDataProvider data provider
 * @param {Object} vmVariabilityProps ViewModel Atomic data <variabilityProps>
 * @param {Object} eventData event data info container
 */
export let clearColumnSelections = ( treeDataProvider, vmVariabilityProps, eventData ) => {
    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };
    pca0GridAuthoringService.clearColumnSelections( treeDataProvider, variabilityProps.businessObjectToSelectionMap, eventData );

    // Process Dirty Elements
    variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
        variabilityProps.dirtyElements, // currentDirtyElements
        variabilityProps.businessObjectToSelectionMap, // selection map
        variabilityProps.backupOfBusinessObjectToSelectionMap // backup selection map
    );

    // Dispatch changes on Variability Props
    vmVariabilityProps.setAtomicData( variabilityProps );
};

/**
 * Action "Paste" selections on column for Top/Bottom grid
 * Apply copied selections on given column
 * Call utility to update data provider
 * Process DirtyElements
 * dispatch changes on atomic Data
 * @param {Object} treeDataProvider - Tree Data Provider
 * @param {Object} vmVariabilityProps - View Model Atomic Data <variabilityProps>
 * @param {Object} eventData - data carried by Paste trigger event
 */
export let pasteSelectionsOnColumn = ( treeDataProvider, vmVariabilityProps, eventData ) => {
    let copiedSelections = appCtxService.getCtx( 'variantConditionContext.copiedSelectionsCache' );

    let variabilityProps = { ...vmVariabilityProps.getAtomicData() };

    // Call Util from pca0GridAuthoring to reset VMOs selections in DataProvider and get updated selection map
    pca0GridAuthoringService.pasteSelectionsOnColumn( treeDataProvider, variabilityProps.businessObjectToSelectionMap, eventData, copiedSelections );

    // Process Dirty Elements
    variabilityProps.dirtyElements = pca0GridAuthoringService.updateDirtyElements(
        variabilityProps.dirtyElements, // currentDirtyElements
        variabilityProps.businessObjectToSelectionMap, // selection map
        variabilityProps.backupOfBusinessObjectToSelectionMap // backup selection map
    );

    // Dispatch changes on Variability Props
    vmVariabilityProps.setAtomicData( variabilityProps );
};

/**
 * Find column to select in grid based on selectionData from parent component
 * Update selection on dataProvider
 * @param {Object} dataProvider - Tree Data Provider
 * @param {Object} selectionData - Selection Data provided by parent component
 */
export let updateColumnSelection = ( dataProvider, selectionData ) => {
    // Clear any selection
    dataProvider.selectNone();
    let selection = selectionData.selected.slice( -1 );
    const result = dataProvider.cols.find( ( { uid } ) => uid === selection[0].svrUID );
    if ( result ) {
        result.colSelected = true;
        exports.setCellColumnSelection( dataProvider, result );
    }
};

/**
 * Select column in matrix grid
 * Update selection on dataProvider
 * @param {Object} dataProvider - Tree Data Provider
 * @param {Object} columnDef - Column to be selected
 * @returns {String} - UID of selected column
 */
export let setCellColumnSelection = ( dataProvider, columnDef ) => {
    // Clear any selection
    dataProvider.selectNone();
    dataProvider.gridContextDispatcher && dataProvider.gridContextDispatcher( {
        type: 'UPDATE_VALUES',
        selectedColumn: columnDef
    } );
    return columnDef.uid;
};

export default exports = {
    getConfigPerspectivePolicy,
    prepareSOAInputToGetVariants,
    getConfigPerspective,
    handleInitActions,
    doVcaGridUnmount,
    loadVariabilityData,
    triggerDataProviderAction,
    loadTreeDataProvider,
    handleEditModeChanged,
    startEditVCA2Table,
    getSaveHandler,
    saveEditVCA2Table,
    postProcessSetVariantExpressionData,
    cancelEditVCA2Table,
    resetEditModeStatus,
    getExpressionData,
    getExpressionDataForValidation,
    getRequestInfoForValidation,
    handleDisplayModeChange,
    addFreeFormOptionValue,
    toggleFilterCriteriaSettingsState,
    resetColumnFilters,
    saveExpressionsInECNContext,
    createSplitColumn,
    clearColumnSelections,
    pasteSelectionsOnColumn,
    setCellColumnSelection,
    updateColumnSelection
};
