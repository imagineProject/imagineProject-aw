// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0Scopes View
 *
 * @module js/pca0ScopesService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import viewModelObjectSvc from 'js/viewModelObjectService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';
let exports = {};


/**
 * This function updates the dp with the scopes info
 * @param {Object} dp - data provider
 * @param {Object} scopesList - scopesList
 * @param {Object} oldVMObjectsIndicatorsOnly - existing loadedVMObjects indicators only
 * @returns {Object} New scopes list
 */
let _refreshDataProviderWithScopeInfo = function( dp, scopesList, oldVMObjectsIndicatorsOnly ) {
    let newScopesList = [];
    let viewModelCollection = dp.getViewModelCollection();
    let loadedVMObjects = [ ...viewModelCollection.getLoadedViewModelObjects() ];

    scopesList.forEach( function( scope ) {
        if( scope ) {
            const loadedVMO = loadedVMObjects.find( ( vmo ) => vmo.uid === scope.uid );
            let updateVMO = loadedVMO ? cdm.getObject( loadedVMO.uid ) : undefined;
            if( updateVMO ) {
                updateVMO = viewModelObjectSvc.createViewModelObject( loadedVMO.uid, 'EDIT' );
                updateVMO.tabKey = loadedVMO.uid;
                updateVMO.name = loadedVMO.cellHeader1;
            } else {
                updateVMO = loadedVMO ? { ...loadedVMO } : { ...scope };
            }
            const indicators = _.get( scope, 'vmo.indicators', [] ).length > 0 ? _.get( scope, 'vmo.indicators', [] ) : _.get( scope, 'indicators', [] );
            _.set( updateVMO, 'indicators', indicators );
            _.set( scope, 'indicators', indicators );
            _.set( updateVMO, 'iconId', _.get( indicators, '0.image' ) ); // This change to show icon on TAB view currently it supports only one icon.
            newScopesList.push( updateVMO );
        }
    } );
    if ( !_.isEqual( newScopesList, loadedVMObjects ) ) {
        dp.update( newScopesList );
    }
    return newScopesList;
};

/**
 * This function updates the dp with the updated VMO with refreshed indicators only if there are changes in indicator statuses
 * thus helping avoid unnecessary dp updates that also cause selection change events
 * @param {Object} dp - data provider
 * @param {Array} oldVMObjectsIndicatorsOnly - existing loadedVMObjects indicators only
 * @param {Array} newVMObjects - newVMObjects list
 */
let _refreshIndicatorsInDataProvider = (  dp, oldVMObjectsIndicatorsOnly, newVMObjects ) => {
    //do not unnecessarily update the dp if it's already clear
    let newVMObjectsIndicatorsOnly = newVMObjects.map( vmo => _.pick( vmo, [ 'indicators' ] ) );

    let isScopesSame = _.isEqual( newVMObjectsIndicatorsOnly, oldVMObjectsIndicatorsOnly );
    if( !isScopesSame ) {
        dp.update( newVMObjects );
    }
};

/**
 * Updates the group UID in the FSC context based on the new scopes provided.
 * In the selection summary, group information for a specific family may be missing, requiring  a getProperties call to retrieve all groups for that family.
 * During cross-probing, multiple group UIDs may exist for a family.
 * This function filters the group UID from the new scopes list and updates the group UID in the context.
 *
 * @param {Object} fscContext - The FSC context object.
 * @param {Object} newScopes - The new scopes object containing a list of scopes.
 * @returns {number} - The index of the found UID in the new scopes list.
 */
let _updateGroupUid = ( fscContext, newScopes ) => {
    let groupUid = fscContext.navigateTo.groupUid;
    const foundUid = newScopes.scopesList.find( scope => groupUid.includes( scope.uid ) )?.uid;

    if ( foundUid ) {
        fscContext.navigateTo.groupUid = foundUid;
    }else{
        fscContext.navigateTo.groupUid = Pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID;
    }
    fscContext.navigateTo.crossProbingSelectionSummary = false;

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

    return newScopes.scopesList.findIndex( vmo => vmo.uid === foundUid );
};


/**
 * This API is called when Variant Configuration tab is loaded (scopes are loaded for the first time)
 * and change in loaded Variant Rule occurs (either new loaded rule or removed)
 * Force selection of first Scope
 * @param {Object} soaResponse - The soa response return
 * @param {Object} scopesListDataProvider - data provider to show items in list
 * @param {Object} scopes - The atomic data for scopes
 * @param {String} scopeUid - The scopeUid optional; if not defined the first one is set
 * @param {Object} vmSelectedTab - The selected tab atomic data
 */
let _selectScopeByUid = function( soaResponse, scopesListDataProvider, scopes, scopeUid, vmSelectedTab ) {
    let newScopes = { ...scopes };
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    if( newScopes.scopesList && newScopes.scopesList.length > 0 ) {
        var currentScopeUidIndex = 0;
        // scopeUid undefined means selecting the first scope

        if( !_.isUndefined( scopeUid ) ) {
            currentScopeUidIndex = newScopes.scopesList.findIndex( ( vmo ) => vmo.uid === scopeUid );
        } else {
            //generally it's the first one as a default but for the prev next navigation use case the default index might not be the 0 one
            //so find the currently expanded one as the default one, this also insures that we'll never present an ampty features panel
            currentScopeUidIndex = newScopes.scopesList.findIndex( ( vmo ) => _.get( vmo, 'families.length' ) > 0 );
        }
        if( !_.isUndefined( fscContext.navigateTo ) && fscContext.navigateTo.crossProbingSelectionSummary ) {
            // When performing cross probing in selection summary, filtering the group Uids from the new scopes list
            currentScopeUidIndex = _updateGroupUid( fscContext, newScopes );
        }
        if( currentScopeUidIndex > -1 ) {
            // Refresh middle panel with data coming from 1st scope/group
            // soaResponse when loading all scopes contains information on 1st group
            // Cache soaResponse, to be used in MiddlePanel without calling unnecessary SOA
            exports.handleScopeSelectionChange( scopesListDataProvider,
                { scopeUid: newScopes.scopesList[ currentScopeUidIndex ].uid, loadScopeData: true, soaResponse: soaResponse }, vmSelectedTab, newScopes.scopesList );
        }
    }
};

/**
 * Processes an array of indicators and returns an object containing an array of processed indicators and a tooltip.
 *
 * @param {Array} indicators - The array of indicator objects to process.
 * @param {number} position - The position to assign to each processed indicator.
 * @returns {Object} An object containing:
 *   - {Array} indicatorsArray: An array of processed indicator objects with properties: position, iconId, type, tooltip, and violationId.
 *   - {string} tabTooltip: The tooltip of the last processed indicator.
 */
const _processIndicators = ( indicators, position ) => {
    let indicatorsArray = [];
    let tabTooltip = '';
    indicators.forEach( function( indicator ) {
        if ( indicator.type ) {
            indicatorsArray.push( {
                position: position,
                iconId: indicator.image,
                image: indicator.image,
                type: indicator.type,
                tooltip: indicator.tooltip,
                violationId: indicator.violationId
            } );
            tabTooltip = indicator.tooltip;
        }
    } );
    return { indicatorsArray, tabTooltip };
};

/**
 * Updates the scopes list with tab data.
 *
 * @param {Array} scopesList - The list of scopes to be updated.
 * @returns {Array} The updated scopes list with tab data.
 */
const _updateScopesListWithTabData = ( scopesList ) => {
    let updatedScopesList = [];
    let priority = 1000;
    if( scopesList ) {
        scopesList.forEach( function( scope ) {
            let indicatorsArray = [];
            let tabTooltip = '';
            if ( scope.indicators?.length > 0 ) {
                ( { indicatorsArray, tabTooltip } = _processIndicators( scope.indicators, 'left' ) );
            }
            const scopeItem = {
                ...scope,
                tabId: scope.uid,
                tabKey: scope.uid,
                visibleWhen: true,
                title: scope.cellHeader1,
                description: tabTooltip,
                indicators: indicatorsArray,
                priority: priority++
            };
            updatedScopesList.push( scopeItem );
        } );
    }
    return updatedScopesList;
};


/**
 * Sets the selection of a tab in the view model.
 *
 * @param {Object} vmSelectedTab - The view model atomicData representing the selected tab.
 * @param {string} tabId - The ID of the tab to be selected.
 * @param {Array} scopesList - The list of scope objects containing tab information.
 */
const _setTabSelection = ( vmSelectedTab, tabId ) => {
    if( !_.isUndefined( vmSelectedTab ) ) {
        const selectedTabData = vmSelectedTab.getAtomicData();
        selectedTabData.tabId = tabId;
        vmSelectedTab.setAtomicData( selectedTabData );
    }
};

/**
 * Retrieves the tab ID from the selected tab's atomic data.
 *
 * @param {Object} vmSelectedTab - The selected tab object.
 * @returns {string} The tab ID of the selected tab.
 */
const _getTabSelection = ( vmSelectedTab ) => {
    return vmSelectedTab.getAtomicData().tabId;
};

/**
 * Retrieves the selected UID from the provided list provider. If the selected UID is an alternate ID
 * it attempts to find the corresponding UID from the view model objects.
 * This is a solution for cases where the framework creates an alternate ID during the first-time
 * loading of a configurator context in the same session.
 *
 * @param {Object} listProvider - The list provider object containing the selection model and view model collection.
 * @param {Object} listProvider.selectionModel - The selection model used to retrieve the current selection.
 * @param {Function} listProvider.getViewModelCollection - Function to retrieve the view model collection.
 * @returns {string} The UID of the selected item, or the resolved UID if an alternate ID is encountered.
 */
let _getSelectionFromListProvider = ( listProvider ) => {
    //Whenever a group is created from variants tab, we create an AlternateId for the same, which is cached in the CDM for faster access.
    //In the same session in which the group is created whenever getSelection API is called from DP, the framework returns the
    //it returns the alternateID present in CDM which is not the one we want.
    //This solution is to retrieve the uid of the group which has that particular alternateId returned by getSelection API of DataProvider.
    let selectedUid = listProvider.selectionModel.getSelection()[ 0 ];
    const loadedVMObjects = _.get( listProvider, 'vmCollectionObj.vmCollection.loadedVMObjects' );
    const foundVMO = loadedVMObjects.find( vmo => {
        if( vmo.alternateID ) {
            return vmo.alternateID === selectedUid;
        }
        return vmo.uid === selectedUid;
    } );
    if( foundVMO ) {
        selectedUid = foundVMO.uid;
    }
    return selectedUid;
};

/**
 * This API is responsible for triggering actions to initialize configuration data
 *
 * @param {Object} data - The view data
 * @param {Boolean } applySettings - flag for apply settings
 */
export let getConfigurationData = function( data, applySettings ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Note: when entering FSC with loaded SVR/CBOS, event "Pca0Scopes.loadedSVRChanged" was fired
    // but Active Settings are not fetched yet: SKIP all actions
    if( data.eventMap && Object.keys( data.eventMap ).indexOf( 'Pca0Scopes.loadedSVRChanged' ) !== -1 ) {
        delete data.eventMap[ 'Pca0Scopes.loadedSVRChanged' ];

        // Scenario: entering FSC with SVR/CBOS
        if( _.isUndefined( data.eventData ) && ( _.isUndefined( fscContext.appliedSettings ) || Object.keys( fscContext.appliedSettings ).length === 0 ) ) {
            return;
        }
        // Scenario: loading SVR
        if( !applySettings ) {
            delete fscContext.appliedSettings;
        }
    }
};

/**
 * This API processes the server response and constructs the client data model
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} scopesListDataProvider - The view data
 * @param {Object} scopeInfo - VM Data to store list of scope VMO'S
 * @param {boolean} isFullScreen - True if fullscreen else false
 * @param {String} moduleHierarchy -  temporary transmit the module hierarchy in order to determine the read only groups an families
 * @param {Object} variantRuleData - Atomic Data to maintain variant rule data
 * @param {Object} vmSelectedTab - The selected tab atomic data
 * @return {Object} - Returns scopelist that we want to show and determines visibility of text box
 */
export let getScopesData = function( response, scopesListDataProvider, scopeInfo, isFullScreen, moduleHierarchy, variantRuleData, vmSelectedTab ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let moduleHierarchyString = exports.getConfigurationModuleHierarchy( moduleHierarchy );
    let scopeInfoCopy = { ...scopeInfo };
    // Delete reassessSelections from context now that configuration data has been refreshed
    // It might have been set when updating settings
    delete fscContext.reassessSelections;

    //in guided mode the new response is variabilityTreeData = [], but in manual mode is an object with props but no childrenUids
    if( _.isEmpty( response.variabilityTreeData ) ||  response.variabilityTreeData.length === 1 && _.isEmpty( response.variabilityTreeData[0].childrenUids )  ) {
        scopeInfoCopy.scopesList = null;
        if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
            pca0CommonUtils.processPartialErrors( response.ServiceData );
        } else {
            eventBus.publish( 'Pca0Scopes.noVariabilityReasons', {} );
        }

        delete fscContext.currentScope;
        let selectionModel = scopesListDataProvider.selectionModel;
        selectionModel.setSelection( [] );
        eventBus.publish( 'Pca0Features.clearScopeData' );
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        return {
            scopesList: [],
            isfilterBoxVisible: false
        };
    }

    let newVariantRuleData = { ...variantRuleData.getValue() };
    if( !_.isEmpty( response.selectedExpressions ) ) {
        const selectedExpressionsJson = configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions );
        const nonGridableExpressionsList = pca0CommonUtils.getNonGridableExpressionList( selectedExpressionsJson );

        if( !_.isEmpty( nonGridableExpressionsList ) && !_.isEmpty( response.viewModelObjectMap ) ) {
            // There is observer in the pca0SummaryView that will update the icon and the tooltip for the non gridable expression
            newVariantRuleData.isExpressionNonGridable = true;
            variantRuleData.update( newVariantRuleData );
            pca0CommonUtils.showNotificationMessageForNonGridableExpressionsIfApplicable( nonGridableExpressionsList, response.viewModelObjectMap );
        } else {
            // There is observer in the pca0SummaryView that will update the icon and the tooltip for the non gridable expression
            newVariantRuleData.isExpressionNonGridable = false;
            variantRuleData.update( newVariantRuleData );
        }
    }

    //update the scope informations
    let scopesList = configuratorUtils.populateScopes( response, fscContext.violations || scopeInfoCopy.labels );
    let labels = scopeInfo.labels;

    //This field is added due to the framework defect where tabs are not getting rendered as per latest scopelist
    //Will remove this check once framework defect is fixed
    //Polarian ID: LCS-1172102
    fscContext.isScopeListChanged = !_.isEqual( scopeInfoCopy.scopesList.length, scopesList.length );
    fscContext.configurationModuleHierarchy = moduleHierarchyString; //update the context with module hierarchy string, if none present it will be set to "" for the rest of the session
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

    if( fscContext.vcvLayoutSettings.showGroupsAsTab ) {
    //add tabBar required data to the scopesList
        scopesList = _updateScopesListWithTabData( scopesList );
    }

    //add this for the config modules in order to force the update of the groups panel
    const viewModelCollection = scopesListDataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.getLoadedViewModelObjects();
    if( !_.isEqual( scopesList, loadedVMObjects ) ) {
        //scopesListDataProvider.viewModelCollection.clear();
        scopesListDataProvider.update( scopesList );
    }

    //select the current set scope - this is the case when the window resizes to the vertical layout or back to horizontal
    //and there are things already selected on the scope
    scopeInfoCopy.scopesList = scopesList;
    if( scopeInfoCopy.scopesList && scopeInfoCopy.scopesList.length > 0 && fscContext.currentScope && fscContext.currentScope !== scopeInfoCopy.scopesList[ 0 ].uid ) {
        _selectScopeByUid( response, scopesListDataProvider, scopeInfoCopy, fscContext.currentScope, vmSelectedTab );
    } else {
        //load first scope
        _selectScopeByUid( response, scopesListDataProvider, scopeInfoCopy, undefined, vmSelectedTab );
    }

    const isfilterBoxVisible = configuratorUtils.determineIfShowFilterBox( scopesList.length, isFullScreen );
    const isSplit = _.get( response, 'responseInfo.isSplit.0' );
    return { scopesList, isfilterBoxVisible, labels, isSplit, moduleHierarchyString };
};

/**
 * Handles the scope selection change event.
 *
 * @param {Object} listProvider - The provider for the list of scopes.
 * @param {Object} eventInfo - Information about the current selection.
 * @param {Object} vmSelectedTab - The view model for the selected tab.
 * @param {Array} scopesList - The list of available scopes.
 */
export let handleScopeSelectionChange = ( listProvider, eventInfo, vmSelectedTab, scopesList ) => {
    if ( scopesList && scopesList.length > 0 ) {
        let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
        let selectionMetaInfo = {};
        let loadVariability = eventInfo?.loadScopeData;
        let systemSelectedScope = '';
        let manualSelectedScope = '';

        // Expected empty on following cases:
        // 1. When loads variability for the first time for the configurator context.
        if( !_.isNil( eventInfo ) && !_.isEmpty( eventInfo ) ) {
            selectionMetaInfo = eventInfo ? eventInfo : {};
            systemSelectedScope = selectionMetaInfo.scopeUid;
            if( vmSelectedTab ) {
                _setTabSelection( vmSelectedTab, systemSelectedScope );
            } else {
                // This will again trigger the handleScopeSelectionChange with listProvider and selectionInfo populated by listProvider
                listProvider.selectionModel.setSelection( systemSelectedScope );
            }
            // This is when we are in group as tab view and we need to set the tab selection to fscContext.currentScope in next/previous navigation
        } else if( fscContext.vcvLayoutSettings.showGroupsAsTab &&  fscContext.currentScope !== '' ) {
            const found = scopesList.find( scope => scope.uid === fscContext.currentScope );
            if( !found || fscContext.isScopeListChanged ) { //Extra check where tabs not getting rendered as per latest scopelist.
            // This will be removed once framework defect is fixed Polarian ID: LCS-1172102
                _setTabSelection( vmSelectedTab, fscContext.currentScope );
                loadVariability = false;
                selectionMetaInfo = { scopeUid: fscContext.currentScope };
                manualSelectedScope = fscContext.currentScope;

                //This extra check is made due to framework defect where tabs are not getting rendered as per latest scopelist
                //Will remove this check once framework defect is fixed //Polarian ID: LCS-1172102
                fscContext.isScopeListChanged = false;
                appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
            } else {
                selectionMetaInfo = { scopeUid: _getTabSelection( vmSelectedTab ) };
                loadVariability = fscContext.currentScope !== selectionMetaInfo.scopeUid;
                manualSelectedScope =  selectionMetaInfo.scopeUid;
            }
            // This is when deselction in list view is done then we need to set the tab selection to fscContext.currentScope
        } else if( fscContext.currentScope !== '' ) {
            selectionMetaInfo = { scopeUid: _getSelectionFromListProvider( listProvider ) };

            // This is the deselection case
            if( _.isEmpty( selectionMetaInfo.scopeUid ) ) {
                selectionMetaInfo = { scopeUid: fscContext.currentScope };
                listProvider.selectionModel.setSelection( fscContext.currentScope );
            }
            loadVariability = fscContext.currentScope !== selectionMetaInfo.scopeUid;
            manualSelectedScope =  selectionMetaInfo.scopeUid;
        }

        //Set the scopeUid to system
        let scopeUid = systemSelectedScope !== '' ? systemSelectedScope : manualSelectedScope;
        if( scopeUid !== fscContext.currentScope ) {
        // Shifted this inside for a Next/Previous required usecase.
        // When in guided mode, if we are in a module and select a feature, then switch to a different module and select a feature there, this function is invoked.
        // However, in this scenario, we do not want this function to be called, as we are only setting is again the scopeUid and don't want to delete activeFamilyUID as the scope is same.
            delete fscContext.activeFamilyUID;
            delete fscContext.activeSelectedData;
            fscContext.currentScope = scopeUid;
            appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        }
        // this triggers the cached path for the features - only trigger something if you have a scope
        if ( loadVariability  ) {
            eventBus.publish( 'Pca0Features.scopeSelectionChanged', { currentScopeSelectionUid: fscContext.currentScope, soaResponse: selectionMetaInfo.soaResponse } );
        }
    }
};

/**
 * Updates the scope selection based on the provided parameters.
 * Passes event data to the handleScopeSelectionChange function with listProvider or
 * vmSelectedTab based on the showTabs flag.
 *
 * @param {Object} listProvider - The provider for the list.
 * @param {Object} eventData - The event data associated with the selection change.
 * @param {Object} vmSelectedTab - The selected tab in the view model.
 * @param {Array} scopesList - The list of scopes.
 * @param {string} showTabs - A flag indicating whether to show tabs ('true') or not.
 */
export let updateScopeSelection = ( listProvider, eventData, vmSelectedTab, scopesList, showTabs ) => {
    if( showTabs === 'true' ) {
        exports.handleScopeSelectionChange( undefined, eventData, vmSelectedTab, scopesList );
    }else{
        exports.handleScopeSelectionChange( listProvider, eventData, undefined, scopesList );
    }
};

/**
 * Helps to get configurator context with respective to module
 * @param {String} contextName - Name of context that we need to fetch from global ctx
 * @param {Object} configCtx - Configurator context provided by consumer apps
 * @returns {Object} VariantContext required to call VCV3 SOA
 */
export let getSelectionForVariantContext = function( contextName, configCtx ) {
    return pca0CommonUtils.getSelectionForVariantContext( contextName, configCtx );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * This API returns initialVariantRule only when selections are undefined
 *
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function() {
    return configuratorUtils.getFscActiveVariantRules();
};

/**
 * Get configuration mode
 * @param {Object} fscCtxName - The fsc Context Name
 * @param {Object} fscState - The fscState
 * @returns {String} configuration mode
 */
export let getConfigurationMode = function( fscCtxName, fscState ) {
    // If a variant rule is applied then open that variant rule diretly in manual mode
    let fscContext = appCtxSvc.getCtx( fscCtxName );
    let newState = { ...fscState.getValue() };
    if( configuratorUtils.getFscActiveVariantRules() !== null && !newState.flagLoadInGuidedMode ) {
        newState.isManualConfiguration = true;

        fscContext.guidedMode = false;
        appCtxSvc.updateCtx( fscCtxName, fscContext );
    }
    if( newState.flagLoadInGuidedMode ) {
        //reset the flag to its original value
        newState.flagLoadInGuidedMode = false;
    }

    !_.isEqual( newState, fscState.getValue() ) ? fscState.update( newState ) : '';
    return pca0CommonUtils.getConfigurationMode( fscCtxName );
};
/**
 * Return Profile Settings information
 * @returns {Object} - Returns profile settings
 */
export let getProfileSettings = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};


/**
 * Refreshes the groups in the scope view.
 *
 * @param {Object} dp - The data provider object.
 * @param {Object} fscState - The FSC state object.
 * @param {Object} eventData - The event data object containing scope information.
 * @param {Object} scopeInfo - The current scope information.
 * @param {Object} filterBox - The filter box object.
 * @param {Object} selectedGroup - The selected group object.
 * @param {string} showTab - A flag indicating whether to show the tab.
 * @returns {Object} An object containing the new scope information, fetchActiveSettings flag, and filterBox.
 */
export let refreshGroupsInScopeView = function( dp, fscState, eventData, scopeInfo, filterBox, selectedGroup, showTab ) {
    let newScopeInfo = {};

    newScopeInfo.scopesList = [ ...eventData.scopeInfoList ];
    newScopeInfo.labels = eventData.labels;


    if( showTab !== 'true' ) {
        let oldVMObjectsIndicatorsOnly = scopeInfo.scopesList.map( vmo => _.pick( vmo, [ 'indicators' ] ) );
        newScopeInfo.isfilterBoxVisible = scopeInfo.isfilterBoxVisible;
        if( newScopeInfo.scopesList.findIndex( scope => scope.uid === _getSelectionFromListProvider( dp ) ) === -1 ) {
        // LCS-926319: Scopes list may be empty
            let scopeUid = _.get( newScopeInfo, 'scopesList.0.uid' ) ? newScopeInfo.scopesList[ 0 ].uid : undefined;
            exports.handleScopeSelectionChange( dp, { scopeUid: scopeUid, loadScopeData: false } );
        }
        if( !fscState.getValue().isManualConfiguration ) {
            // THIS IS NOT NEEDED FOR GUIDED MODE NEED TO CHECK WHY ITS ADDED
            newScopeInfo.scopesList.forEach( function( scope ) {
                if( _.isUndefined( scope.indicators ) || scope.indicators.length !== 0 ) {
                    scope.indicators = [];
                }
            } );
        }
        let updatedScopesList = _refreshDataProviderWithScopeInfo( dp, newScopeInfo.scopesList, oldVMObjectsIndicatorsOnly );

        newScopeInfo.scopesList = updatedScopesList;

        //we have to return here the filtered groups in case there is filtering. Also it cannot be done in json because
        //we manipulate the scopesList twice which would cause flickering
        if( scopeInfo.isfilterBoxVisible ) {
            let filterScopesResult = exports.filterScopes( filterBox, newScopeInfo, dp, selectedGroup );
            newScopeInfo.scopesList = filterScopesResult.scopesList;
            newScopeInfo.fullScopesListCopy = filterScopesResult.fullScopesListCopy;
        }
    } else {
        newScopeInfo.isfilterBoxVisible = scopeInfo.isfilterBoxVisible;
        newScopeInfo.scopesList = _updateScopesListWithTabData( newScopeInfo.scopesList );
    }
    return { newScopeInfo, fetchActiveSettings: false, filterBox: filterBox };
};

/**
 * Sets the state following a mode change
 * @param {Object} response - response
 * @param {Object} fscState - Atomic data to maintain state of application
 */
export let renderToggleMode = function( response, fscState ) {
    // Hide Toggle mode if required minimum platform version is not greater than or equal to 11.4
    // We'll hold this information in variantConfigContext in appcontext so that main view where toggle
    // is displayed can access this.

    // Update application context
    const context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( fscState && fscState.update && ( context.guidedMode === true || context.guidedMode === undefined ) ) {
        let newState = { ...fscState.getValue() };
        // it is initialized to false because we land to the configuration panel in guided mode.
        newState.isManualConfiguration = false;
        fscState.update( newState );
    }
};

/**
 * Reset isSwitchingFromGridToListView flag when configuration view is switched from grid to list view
 * @param {Object} fscState - The atomic data for fscState
 */
export let resetIsSwitchingFromGridToListViewFlag = function( fscState ) {
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        //do not trigger unnecessary updates
        if( newState.isSwitchingFromGridToListView ) {
            newState.isSwitchingFromGridToListView = false;
            fscState.update( newState );
        }
    }
};

/**
 * Returns the switchingToGuidedMode flag
 * @returns {string} - flag as string
 */
export let getSwitchingToGuidedMode = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( context && context.switchingToGuidedMode ) {
        return 'true';
    }
    return 'false';
};

/**
 * Get previous scope, given input scope UID.
 * If top of list is reached, get last element
 * @param {String} groupUID - input group UID, next to be found starting from it
 * @param {Object} scopes - The atomic data for scopes
 * @returns {String} next group UID
 */
export let getPreviousScope = function( groupUID, scopes ) {
    let newScopes = [ ...scopes.scopesList ];
    let prevIndex = _.findIndex( newScopes, function( scope ) {
        return scope.uid === groupUID;
    } ) - 1;
    if( prevIndex <= -1 ) {
        prevIndex = newScopes.length - 1;
    }
    return newScopes[ prevIndex ].uid;
};

/**
 * Get next scope, given input scope UID.
 * If end of list is reached, get first element
 * @param {String} groupUID - input group UID, next to be found starting from it
 * @param {Object} scopes - The atomic data for scopes
 * @returns {String} next group UID
 */
export let getNextScope = function( groupUID, scopes ) {
    let newScopes = [ ...scopes.scopesList ];
    let nextIndex = _.findIndex( newScopes, function( scope ) {
        return scope.uid === groupUID;
    } ) + 1;
    if( nextIndex >= newScopes.length ) {
        nextIndex = 0;
    }
    return newScopes[ nextIndex ].uid;
};

/**
 * Reset resetVariantState after variant gets saved or unloaded
 * @param {Object} fscState - The atomic data for fscState
 */
export let resetVariantState = function( fscState ) {
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        //do not trigger unnecessary updates
        if( newState.savedVariant || newState.unloadedVariant ) {
            newState.savedVariant = false;
            newState.unloadedVariant = false;
            fscState.update( newState );
        }
    }
};

/**
 * Reset the Layout Resize flag after the scopes mounts and loads
 * We need this flag to be able to trigger the scopes mount actions but stay on current selected group
 * and skip actions meant for load/unload SVR's.
 * @param {Object} fscState - The atomic data for fscState
 */
export let resetLayoutResize = function( fscState ) {
    let newState = { ...fscState.value };
    if( newState.isLayoutResize === true ) {
        newState.isLayoutResize = false;
        fscState.update( newState );
    }
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Updates the  Violation Icon on the groups
 * @param {Object} dataProvider - the data provider to update
 * @param {Object} scopes - The atomic data for scopes
 * @param {Object} violationLabels - the  violation labels from the last response parsing
 * @param {Boolean} clearViolation - true if we need to clear the violation
 * @returns {Object} New scopes list
 */
export let updateViolationIcon = function( dataProvider, scopes, violationLabels, clearViolation = false ) {
    let newScopes = { ...scopes };
    let vmObjectsIndicatorsOnly =  _.cloneDeep( scopes.scopesList.map( vmo => _.pick( vmo, [ 'indicators' ] ) ) );
    let viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = [ ...viewModelCollection.getLoadedViewModelObjects() ];
    let context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let configurationModulePath = _.get( context, 'configurationModuleHierarchy', '' );
    let currentSelectedModule = configurationModulePath ? configurationModulePath.split( ':' )[0] : '';

    if( newScopes ) {
        //update path: when the config module gets changed, the entire groups list
        //gets reloaded and we'll have to set the violations as before (from the last response parsing)
        if( !_.isEmpty( violationLabels ) ) {
            configuratorUtils.parseResponseAndExtractViolations( violationLabels, undefined, newScopes, currentSelectedModule  );
            _refreshDataProviderWithScopeInfo( dataProvider, newScopes.scopesList, vmObjectsIndicatorsOnly );
        } else {
            //former clear violations path
            let newVMObjects = [];
            delete newScopes.labels;
            newScopes.scopesList.forEach( function( scope, index ) {
                const loadedVMO = { ...loadedVMObjects[ index ] };
                //update the loaded objects
                if( loadedVMO ) {
                    _.set( loadedVMO, 'indicators', scope.indicators );
                    _.set( scope, 'indicators', scope.indicators );
                    _.set( loadedVMO, 'iconId', _.get( scope, 'indicators.0.image' ) );
                    // Delete all violation icons from scope
                    _.remove( scope.indicators, {
                        type: 'violation'
                    } );
                }
                newVMObjects.push( loadedVMO );
            } );

            //do not unnecessarily update the dp if it's already clear
            _refreshIndicatorsInDataProvider( dataProvider, vmObjectsIndicatorsOnly, newVMObjects );
        }
    }
    return newScopes;
};

/**
 * Get Filter data for the scopes
 *
 * @param {Object} filter the filter String
 * @param {Object} scopeInfo - scope list VM data
 * @param {Object} listProvider - List provider to set selection
 * @param {String} selectedGroup - Preveious selected scope value
 * @return {Object} the filter data
 */
export let filterScopes = function( filter, scopeInfo, listProvider, selectedGroup ) {
    let scopesList = [];
    let filteredScopesList = [];
    let fullScopesListCopy = scopeInfo.fullScopesListCopy ? scopeInfo.fullScopesListCopy : scopeInfo.scopesList;
    scopesList = [ ...fullScopesListCopy ];
    let filterString = filter.dbValue;
    filter.prevDisplayValues[ 0 ] = filterString;

    let isValidStr = /\d/;
    if( !filterString ) {
        filterString = '*';
        scopesList = fullScopesListCopy; //revert to original
        fullScopesListCopy = undefined;
    }
    if( filterString && !isValidStr.test( filterString ) ) {
        var filterStr = function( fil ) {
            var hasWildcardChar = /[%*]/g;

            if( hasWildcardChar.test( filterString ) ) {
                var wildcrdRegex = new RegExp( filterString.replace( /[%*]/ig, '.*' ), 'ig' );
                if( wildcrdRegex.test( fil.cellHeader1 ) ) {
                    return fil;
                }
            } else if( fil.cellHeader1.toLowerCase().indexOf( filterString.toLowerCase() ) > -1 ) {
                return fil;
            }
        };
        filteredScopesList = scopesList.filter( filterStr );
    }
    // LCS-738746 - Group selection issue when filter is applied
    // Set selection on previous selected group
    let selGroup = _.find( scopesList, { uid: selectedGroup } );
    if( selGroup && _getSelectionFromListProvider( listProvider ) !== selectedGroup ) {
        listProvider.selectionModel.setSelection( selGroup );
    }
    listProvider.update( filteredScopesList );
    return { scopesList: filteredScopesList, isfilterBoxVisible: scopeInfo.isfilterBoxVisible, isSplit: scopeInfo.isSplit, fullScopesListCopy: fullScopesListCopy };
};

/**
 * Resets currentScope after variant gets saved or unloaded
 * @return {Boolean} true to set the afterConfigModuleChange
 */
export let clearCurrentScope = function( selectionModel ) {
    appCtxSvc.updatePartialCtx( Pca0Constants.FSC_CONTEXT + '.currentScope', '' );
    selectionModel.selectNone();
    return true;
};
/**
 * Updates and returns the configurationModuleHierarchy string needed for the call
 * it returns an empty string if the moduleHierarchy is undefined, as expected by the server api
 * @param {String} cfgModuleHierarchy the current ModuleHierarchy
 * @return {Object} updated cfgModuleHierarchy string
 */
export let getConfigurationModuleHierarchy = function( cfgModuleHierarchy ) {
    let configurationModuleHierarchy = '';
    if( cfgModuleHierarchy ) {
        configurationModuleHierarchy = cfgModuleHierarchy;
    }

    return configurationModuleHierarchy;
};

/**
 * This function updates the dp with the scopes info
 * @param {Object} dp - data provider
 * @param {Object} scopesList - scopesList
 */
export let updateDataProviderWithNewScopeInfo = function( dp, scopesList ) {
    dp.viewModelCollection.clear();
    dp.update( scopesList );
    if( scopesList.length > 0 ) {
        dp.selectionModel.setSelection( scopesList[ 0 ] );
    }
};

/**
 * Select group on scopes DataProvider
 * Get current Group selection and setSelection if different
 * @param {UwDataProvider} dataProvider Scopes Data Provider
 * @param {Object} scopeUID Navigation Target Scope
 */
export let selectScope = function( dataProvider, scopeUID ) {
    let vmc = dataProvider.viewModelCollection;
    let curSelection = dataProvider.selectionModel.getSelection();
    //don't set the same selection again
    if( _.get( curSelection, '0' ) === scopeUID ) {
        return;
    }
    let index = vmc.findViewModelObjectById( scopeUID );
    //if the currentSelection reset, go back to first one
    if( index < 0 ) {
        index = 0;
    }
    var vmo = vmc.getViewModelObject( index );
    if( vmo ) {
        //update the data provider with new selection
        dataProvider.selectionModel.setSelection( vmo );
    }
};

/**
 * This function returns the input scope for the soa call to retrieve the groups + expanded group for the features panel
 * In case of prev/next navigation this is the scope saved on context after the getIncompleteFamilies soa call, in case we are not after a mod change
 * we'll use the scopeSelectionUid
 * @param {Boolean} afterModChange flag
 * @return {String} updated scopeUid for the soa call input
 */
export let getInputScope = function( afterModChange ) {
    let ret = '';
    const context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let scopeSelectionUid = context.currentScope;

    //this is the previous next path where we need to update the scope selection as well
    if( afterModChange && _.get( context, 'moduleChangedByNextPreviousRequired' ) &&  _.get( context, 'navigateTo.groupUid' ) ) {
        ret = context.navigateTo.groupUid;
    } else if( !afterModChange && scopeSelectionUid ) {
        ret = scopeSelectionUid;
    }
    return ret;
};

/**
 * Returns the cleared filterbox
 * @param {Object} filterBox - the filterBox
 * @returns {Object} the cleared filterbox
 */
export const clearFilter = ( filterBox ) => {
    filterBox.dbValue = undefined;
    filterBox.uiValue = '';
    return filterBox;
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForVCV = ( ) => {
    return pca0CommonUtils.getPropertyPolicy( 'variantConfigurationView' );
};


export default exports = {
    getConfigurationData,
    getScopesData,
    handleScopeSelectionChange,
    updateScopeSelection,
    getSelectionForVariantContext,
    getActiveVariantRules,
    getConfigurationMode,
    getProfileSettings,
    refreshGroupsInScopeView,
    renderToggleMode,
    resetIsSwitchingFromGridToListViewFlag,
    getSwitchingToGuidedMode,
    getPreviousScope,
    getNextScope,
    convertSelectedExpressionJsonObjectToString,
    getConfigPerspective,
    resetVariantState,
    resetLayoutResize,
    updateViolationIcon,
    filterScopes,
    clearCurrentScope,
    getConfigurationModuleHierarchy,
    updateDataProviderWithNewScopeInfo,
    selectScope,
    getInputScope,
    getPropertyPolicyForVCV,
    clearFilter
};
