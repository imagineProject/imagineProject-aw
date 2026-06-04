// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0LoadSavedVariants Panel
 *
 * @module js/pca0LoadSavedVariantsService
 */
import advancedSearchService from 'js/advancedSearchService';
import advancedSearchUtils from 'js/advancedSearchUtils';
import appCtxSvc from 'js/appCtxService';
import clientDataModel from 'soa/kernel/clientDataModel';
import configuratorUtils from 'js/configuratorUtils';
import dialogService from 'js/dialogService';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/pca0ExpressionGridService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ExpressionGridService from 'js/pca0ExpressionGridService';
import pca0FormulaSuggesterService from 'js/pca0FormulaSuggesterService';
import soaService from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

/**
 * Tells if the search criteria is a saved query
 * @param {Object} str - str
 * @returns {Object} - returns true if it is saved query using the suffix
 */
const _isSavedQuery = ( str ) => {
    const suffix = '#::SavedQuery';
    return str.endsWith( suffix );
};

let exports = {};

/**
 * @param {Object} data - data object
 * @param {String} staticDisplayValue -display value of the search criteria
 * @param {Object} staticElementObject - static element object
 * @returns {Object} - searchCriteriaLink object
 */
export const getSearchCriteriaLink = ( data, staticDisplayValue, staticElementObject ) => {
    const propertyDisplayName = staticDisplayValue;
    const searchCriteriaLink = data.searchCriteriaLink;
    // Check if selected search criteria is Saved Query
    const isSavedQuery = _isSavedQuery( staticElementObject );
    searchCriteriaLink.isSavedQuery = isSavedQuery;
    uwPropertyService.updateModelData( searchCriteriaLink, staticElementObject, [ propertyDisplayName ], false, true, true, {} );
    searchCriteriaLink.dbValues = [ staticElementObject ];
    searchCriteriaLink.propertyDisplayName = propertyDisplayName;

    return searchCriteriaLink;
};

/**
 * This API processes the server response and constructs the client data model
 *
 * @param {Object} dp - The data provider object
 * @returns {Number} - Returns the start index for data provider
 */
export let evaluateStartIndexForVariantRuleDataProvider = ( dp ) => {
    if( dp.startIndex === 0 ) {
        return 0;
    }
    return dp.viewModelCollection.loadedVMObjects.length;
};

/**
 * This API updates the fscContext
 * It updates lists of currently applied VRs
 * It triggers fetching of Active Settings (filter criteria and profile settings) in case of single loaded SVR in List mode
 * It triggers fetching of variant rule selections in the variant configuration tab
 * Event is called when a SVR is loaded from side panel "Load Saved Variants" or
 * when a change (single selection) in applied SVR happens in Variant header/side-panel configurator
 * @param {Object} selectedVariants - The selected saved variants
 * @param {Object} fscState - The fscState object
 * @param {Object} variantRuleData - The variantRuleData object
 * @param {Boolean} loadInManualMode - used to load in guided or manual mode
 * @param {Boolean} appendSVRElement - optional, used for tree view append
 * @param {String} popupId - popupId of Dialog
 *
 */
export let loadSavedVariants = function( selectedVariants, fscState, variantRuleData, loadInManualMode, appendSVRElement, popupId ) {
    //only do the fsc state adjustments if we stay in the same view otehrwise we'll rerender unnecessarily the scopes before switching over
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let newFscState = fscState.value ? { ...fscState.getValue() } : { ...fscState.getAtomicData() };
    if( selectedVariants.length === 1 ) {
        // the change in fscContext.initialVariantRule is observed by the scopes which then triggers the soa call to update the loaded svr
        fscContext.initialVariantRule = { ...selectedVariants[ 0 ] };

        //since it may come either from fsc directly or via command, take care of both cases
        newFscState.variantRuleDirty = false;
        //we should not change the state if coming thorugh the load SVR panel and not having manual mode explicitely set
        //we still do it when changed via header dropdown - LCS-777144 - Enable Load Variant command in Guided Mode
        if( loadInManualMode ) {
            newFscState.isManualConfiguration = true;
            fscContext.guidedMode = false;
        } else {
            newFscState.flagLoadInGuidedMode = true;
        }

        fscState.update ? fscState.update( newFscState ) : fscState.setAtomicData( newFscState );
    } else {
        delete fscContext.initialVariantRule;
        if( loadInManualMode ) {
            fscContext.guidedMode = false;
        }
    }

    let newVariantRuleData = variantRuleData.value ? { ...variantRuleData.value } : { ...variantRuleData.getAtomicData() };
    // expressionExpandedState is used while creating or saving VR
    // When the user has expanded the expression and saves the VR, this flag is send as true in input of Save/Create
    // We are resetting the flag here, because other VR has been loaded now
    fscContext.expressionExpandedState = false;
    delete fscContext.payloadStrings;
    delete fscContext.selectedExpressions;

    if( newFscState.treeDisplayMode ) {
        if( appendSVRElement ) {
            //adjust the variantRulesToLoad for re-appended ones
            let trimmedVariantRulesToLoad = _.uniqBy( [ ...newVariantRuleData.variantRulesToLoad, ...selectedVariants ], 'uid' );
            newVariantRuleData.variantRulesToLoad = trimmedVariantRulesToLoad;
        } else {
            newVariantRuleData.variantRulesToLoad = selectedVariants;
        }

        // If loading Single VR, fetch active settings
        // Otherwise, fire event to append or reload the SVRs
        if( newVariantRuleData.variantRulesToLoad.length === 1 ) {
            newVariantRuleData.useDefaultConfigPerspective = false;
        } else {
            newVariantRuleData.useDefaultConfigPerspective = true;
        }
    } else {
        //setting the treeMode on fsc has been removed, doen now via flag on data
        if( [ ...selectedVariants ].length > 1 ) {
            newVariantRuleData.useDefaultConfigPerspective = true;
        } else {
            // As only single variant rule is to be loaded, land back to 1st scope
            newVariantRuleData.useDefaultConfigPerspective = false;
        }
        newVariantRuleData.variantRulesToLoad = [ ...selectedVariants ];
    }

    // Delete currentScope: this will force to load SVR Configuration Data and 1st scope information
    delete fscContext.currentScope;

    // Delete lastAppliedRevisionRuleUid when new SVR(s) is being loaded
    delete fscContext.lastAppliedRevisionRuleUid;

    delete fscContext.appliedSettings;

    // While loading new variant, delete the old violations.
    delete fscContext.violations;

    // While loading new variant, delete the violation messages
    // and criteria status.
    delete fscContext.responseInfo;

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    variantRuleData.update ? variantRuleData.update( newVariantRuleData ) : variantRuleData.setAtomicData( newVariantRuleData );

    //close dialog
    if( popupId ) {
        dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
    }
};

/**
 * This API processes loaded (applied) SVRs and performs synchronization into FSC
 * In case of no single selection (no SVRs are loaded OR multiple SVRs are loaded), no variant rule should be applied into FSC
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData - Variant Rule Details
 * */
export let handleSVRChange = function( fscState, variantRuleData ) {
    const fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( fscContext.currentAppliedVRs && !_.isEmpty( fscContext.currentAppliedVRs[ 0 ] ) && !_.isUndefined( fscContext.currentAppliedVRs[ 0 ] ) && fscContext.currentAppliedVRs.length === 1 ) {
        if( !fscContext.initialVariantRule || fscContext.currentAppliedVRs[ 0 ] !== fscContext.initialVariantRule.uid ) {
            const selectedVariants = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );
            if ( !selectedVariants ) {
                eventBus.publish( 'Pca0FullScreenConfiguration.fetchActiveSettings' );
            } else {
                exports.loadSavedVariants( [ selectedVariants ], fscState, variantRuleData, true );
            }
        }
    } else {
        // Force unloading of any variant rule from FSC
        eventBus.publish( 'Pca0LoadSavedVariants.unloadSVR' ); //this is the main path of unloading svr, do not call it directly
    }
};

/**
 * Unload SVR - triggered from ListView
 * This API removes requested variant rule from fscContext
 * It updates lists of currently applied VRs
 * It triggers fetching of Active Settings (filter criteria and profile settings) in List mode
 * It fires event to reload the variant configuration tab
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData atomic data
 */
export let handleSVRUnload = function( fscState, variantRuleData ) {
    var fscContext = { ...appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ) };
    // expressionExpandedState is used while creating or saving VR
    // When the user has expanded the expression and saves the VR, this flag is send as true in input of Save/Create
    // We are resetting the flag here, because the VR has been unloaded
    fscContext.expressionExpandedState = false;
    if( fscState && fscState.getAtomicData ) {
        var newFscState = { ...fscState.getAtomicData() };
        newFscState.variantRuleDirty = false;
        if( !_.isEqual( newFscState, fscState.getAtomicData() ) ) {
            fscState.setAtomicData( newFscState );
        }
    }

    if( variantRuleData && variantRuleData.getAtomicData() ) {
        var newVariantRuleData = { ...variantRuleData.getAtomicData() };
        newVariantRuleData.variantRulesToLoad = [];
        newVariantRuleData.useDefaultConfigPerspective = true;
        if( newVariantRuleData.defaultConfigPerspective.uid === undefined ) {
            // Delete current Active Settings (filter criteria and profile settings) information
            delete fscContext.appliedSettings;
        } else {
            //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
            fscContext.appliedSettings = fscContext.defaultAppliedSettings;
        }
        variantRuleData.setAtomicData( newVariantRuleData );
    }
    [ 'initialVariantRule',
        'payloadStrings',
        'selectedExpressions',
        'allSelectionsExt',
        'configPerspective',
        'violations',
        'responseInfo'
    ].forEach( function( prop ) {
        delete fscContext[ prop ];
    } );

    // Delete currentScope: this will force to load new Configuration Data and 1st scope information
    delete fscContext.currentScope;

    // Delete lastAppliedRevisionRuleUid when new SVR(s) is being loaded
    delete fscContext.lastAppliedRevisionRuleUid;

    // while unloading SVR, update violation icon to default in
    // list summary view.
    eventBus.publish( 'Pca0Summary.updateViolationIcon', { summaryViolationsInfo: undefined, violationLabels: undefined, validationErrorMessage: '' } );

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * Unload SVR - triggered from GridView
 * This API removes requested variant rule from fscContext
 * It updates lists of currently applied VRs
 * @param {String} variantRuleUID - UID of SVR to be unloaded
 * @param {Object} fscState - The fsc State atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * */
export let handleUnloadSVRInGridView = function( variantRuleUID, fscState, variantRuleData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Remove SVR from list
    //_.remove( fscContext.variantRulesToLoad, { uid: variantRuleUID } );
    if( variantRuleData && variantRuleData.getAtomicData() ) {
        var newVariantRuleData = { ...variantRuleData.getAtomicData() };
        _.remove( newVariantRuleData.variantRulesToLoad, { uid: variantRuleUID } );

        // Set initialVariantRule if SVR(s) are still loaded within configuration
        // Force List View mode otherwise
        if( newVariantRuleData.variantRulesToLoad.length > 1 ) {
            fscContext.initialVariantRule = newVariantRuleData.variantRulesToLoad[ 0 ];
            newVariantRuleData.useDefaultConfigPerspective = true;
        } else if( newVariantRuleData.variantRulesToLoad.length === 1 ) {
            fscContext.initialVariantRule = newVariantRuleData.variantRulesToLoad[ 0 ];
            newVariantRuleData.useDefaultConfigPerspective = false;
        } else {
            delete fscContext.initialVariantRule;
            newVariantRuleData.variantRulesToLoad = [];
            if( fscState && fscState.getAtomicData() ) {
                var newFscState = { ...fscState.getAtomicData() };
                newFscState.treeDisplayMode = false;
                newFscState.unloadedVariant = true;
                fscState.setAtomicData( newFscState );
                newVariantRuleData.useDefaultConfigPerspective = true;
                if( newVariantRuleData.defaultConfigPerspective.uid === undefined ) {
                    // Delete current Active Settings (filter criteria and profile settings) information
                    delete fscContext.appliedSettings;
                } else {
                    //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
                    fscContext.appliedSettings = fscContext.defaultAppliedSettings;
                }
            }
        }
        variantRuleData.setAtomicData( newVariantRuleData );
    }

    [ 'payloadStrings',
        'selectedExpressions',
        'allSelectionsExt'
    ].forEach( function( prop ) {
        delete fscContext[ prop ];
    } );

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * Clear the data provider vmo
 * @param {Object} data - The VM object
 * @returns {Object} updated DataProvider and VariantRules
 */
export let clearSearchDataProvider = data => {
    // If no results found, clear the data provider vmo
    let ret = { ...data };
    ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria.viewModelCollection.clear();
    ret.variantRules = [];
    return {
        pdGetAllVariantRulesBasedOnSearchCriteria: ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria,
        variantRules: ret.variantRules
    };
};

/**
 * Build the Result of the search
 * @param {Object} data - The VM object
 * @returns {Object} the results object
 * TODO: This function is getting called on success and failure of performSearch
 * No need to call on failure of performSearch
 */
export const buildSearchResults = ( data ) => {
    const totalLoadedUntilNow = _.isNull( data.totalLoadedVariants ) ? data.totalLoaded : data.totalLoadedVariants + data.totalLoaded;
    const totalFoundComplete = data.totalFoundVariants || data.totalFound;

    let resultStr = configuratorUtils.getFscLocaleTextBundle().resultsString.replace( /\{0}/g, totalLoadedUntilNow ).replace( /\{1}/g, totalFoundComplete );

    let subPanelContext = data.subPanelContext;
    let activeSearchResultPropLabel = { ...data.activeSearchResultPropLabel };
    activeSearchResultPropLabel.propertyDisplayName = subPanelContext.searchCriteriaObj.searchCriteriaLink.uiValue;
    activeSearchResultPropLabel.uiValue = subPanelContext.searchCriteriaObj.searchCriteria.uiValue;
    return {
        resultsStringValue: resultStr,
        activeSearchResultPropLabel: activeSearchResultPropLabel,
        pdGetAllVariantRulesBasedOnSearchCriteria: data.dataProviders.getAllVariantRulesBasedOnSearchCriteria,
        variantRules: data.variantRules,
        totalFoundVariants: totalFoundComplete,
        totalLoadedVariants: totalLoadedUntilNow
    };
};

/**
 * Returns loaded variant rule from SOA response
 * @param {Object} response the response from the variant configuration view SOA
 * @returns {Object} loaded variant rules.
 */
export let getVariantRules = function( response ) {
    var vrList = [];
    var variantRules = _.get( response, 'responseInfo.variantRules', null );
    if( variantRules !== null ) {
        variantRules.forEach( function( vrUid ) {
            vrList.push( response.ServiceData.modelObjects[ vrUid ] );
        } );
    }
    return vrList;
};

/**
 * Publish the event with Active search criteria
 * @param {Object} data - The VM object
 * @returns {Object} updated active search criteria
 */
export let processSVRSearchCriteriaSelection = async( data ) => {
    const searchCriteriaLink = getSearchCriteriaLink( data, data.eventData.property.staticDisplayValue, data.eventData.property.staticElementObject );

    if( searchCriteriaLink.isSavedQuery ) {
        // make SOA call to get the saved query criteria
        let queryName = data.eventData.property.staticElementObject.split( '#::' )[ 0 ];
        const findQueryInputData = {
            inputCriteria: [ {
                queryNames: [ queryName ]
            } ]
        };
        let responseSavedQuery = await soaService.postUnchecked( 'Query-2010-04-SavedQuery', 'findSavedQueries', findQueryInputData );
        let advancedSearchState = data.atomicDataRef.advancedSearchState.getAtomicData();
        advancedSearchState.savedQuery = {};
        advancedSearchState.savedQuery.dbValue = responseSavedQuery.savedQueries[ 0 ].uid;
        advancedSearchState.savedQuery.value = responseSavedQuery.savedQueries[ 0 ].uid;
        advancedSearchState.savedQuery.uiValue = responseSavedQuery.savedQueries[ 0 ].props.object_string.uiValues[ 0 ];
        advancedSearchState.savedQuery.uiValues = responseSavedQuery.savedQueries[ 0 ].props.object_string.uiValues;
        data.atomicDataRef.advancedSearchState.setAtomicData( advancedSearchState );
    }
    let loadVariantSearchCriteria = data.eventData.property.dbValue;
    appCtxSvc.updatePartialCtx( 'fscContext.loadVariantSearchCriteria', loadVariantSearchCriteria );
    // If the active tab is Results, force it back to Input
    if( data.selectedTab.tabKey === 'Results' ) {
        eventBus.publish( 'Pca0LoadSVRSearchTab.tabChange', {
            tabKey: 'Input'
        } );
    }

    return {
        searchCriteriaLink: searchCriteriaLink,
        activeSearchCriteria: data.eventData.property.dbValue,
        dispValueSearchCriteria: data.eventData.property.uiValue
    };
};

/**
 * Update the Active search criteria for tabs
 * And Total selected features from groups
 * @param {Object} data - The VM object
 * @returns {Object} updated Search criteria
 */
export let handleSelectionInSearchInputTab = function( data ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let totalSelection = {};
    let length = 0;

    let configMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );
    if( !_.isEmpty( configMap ) && configMap !== undefined ) {
        totalSelection = configMap;
        for( const key in totalSelection ) {
            if( totalSelection.hasOwnProperty( key ) ) {
                length += totalSelection[ key ].length;
            }
        }
    }

    let eventData = pca0CommonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0LoadSVRSearchCriteriaPanel.updateActiveSearchCriteria' );
    let modifiedData = { ...data };
    modifiedData.activeSearchCriteria = eventData.activeSearchCriteria;
    modifiedData.featurePropLabel.propertyDisplayName = configuratorUtils.getFscLocaleTextBundle().featurePropLabel.replace( '{0}', length );
    if( data.activeSearchResultPropLabel ) {
        modifiedData.activeSearchResultPropLabel.propertyDisplayName = eventData.dispValue;
    }

    let searchCriteriaLink = getSearchCriteriaLink( data, modifiedData.activeSearchCriteria.staticDisplayValue, modifiedData.activeSearchCriteria.staticElementObject );
    return {
        activeSearchCriteria: modifiedData.activeSearchCriteria,
        featurePropLabel: modifiedData.featurePropLabel,
        activeSearchResultPropLabel: modifiedData.activeSearchResultPropLabel,
        searchCriteriaLink: searchCriteriaLink
    };
};

/**
 * Get all variant rules from response
 * If no variant results found then this will clear the results data provider vmo
 *@param {Object} response the response from the perform search SOA
 * @returns {Object} VariantRules
 */
export let getVariantRulesBasedOnCriteria = function( response ) {
    let vrList = [];
    if( response.searchResults !== null && response.searchResults !== undefined ) {
        response.searchResults.forEach( ( obj ) => {
            let vmoObj = viewModelObjectService.createViewModelObject( obj.uid );
            vrList.push( vmoObj );
        } );
    }
    //if no results found retund null and the dp will get cleared after
    if( !response.searchResults || !vrList ) {
        return null;
    }
    return vrList;
};

/**
 * Create and return the search criteria saved on the parent
 * @param {Object} data - The VM object
 * @returns {Object} updated revision rule and search criteria
 */
export let initializeLoadSVRInputPanel = data => {
    // When we open Load Variants Panel for first time, subPanelContext will send "Name" as searchCriteriaLink
    // which will not be an Object. Reason: we initialize the searchCriteriaLink as ViewModelProperty
    // only on change in selection of criteria. Hence, we need to check if it is object or not.
    // If it is not object, use searchCriteriaLink from current component.
    let link = _.isObject( data.subPanelContext.searchCriteriaLink ) ? { ...data.subPanelContext.searchCriteriaLink } : { ...data.searchCriteriaLink };

    if( _.get( data, 'subPanelContext.value.searchCriteriaLink.value' ) ) {
        var propertyDisplayName = data.subPanelContext.searchCriteriaLink.uiValue;
        uwPropertyService.updateModelData( link, data.subPanelContext.searchCriteriaLink.value, [ propertyDisplayName ], false, true, true, {} );
        link.propertyDisplayName = propertyDisplayName;
    }
    let considerRevRuleForSearch = { ...data.considerRevRuleForSearch };
    if( _.get( data, 'subPanelContext.value.considerRevRuleForSearch' ) ) {
        considerRevRuleForSearch = data.subPanelContext.value.considerRevRuleForSearch;
    }

    let revisionRule = { ...data.currentRevisionRule };
    if( _.get( data, 'subPanelContext.value.revisionRule' ) ) {
        revisionRule = data.subPanelContext.value.revisionRule;
    }

    let featurePropLabel = { ...data.featurePropLabel };
    if( _.get( data, 'subPanelContext.value.featurePropLabel' ) ) {
        featurePropLabel.propertyDisplayName = data.subPanelContext.value.featurePropLabel;
    }

    let expressionPropLabel = { ...data.expressionPropLabel };
    if( _.get( data, 'subPanelContext.value.expressionPropLabel' ) ) {
        expressionPropLabel.propertyDisplayName = data.subPanelContext.value.expressionPropLabel;
    }

    let searchCriteria = { ...data.searchCriteria };
    if( _.get( data, 'subPanelContext.value.searchCriteria' ) ) {
        searchCriteria = data.subPanelContext.value.searchCriteria; //preserve the search criteria input between tab swaps
    }

    // Initialize Formula Editor context
    // We use directly pca0FormulaSuggester and we need to initialize it
    // We don't use another component encapsulating the monaco editor/formulaSuggester like in VCA (i.e. Pca0VariantFormulaEditor)
    // Possible enhancement: move this code on action on link if "expression" gets selected manually/programmatically
    // Ideally, initialization happens if/when Expression is selected
    // aw-link-with-popup-menu is deprecated and doesn't support action
    // we need to replace with aw-link
    // Set Intellisense: based on preference
    let editorObject = { ...data.subPanelContext.editorObject.getValue() };
    editorObject.useIntellisense = appCtxSvc.getCtx( 'preferences' )[ Pca0Constants.PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE ][ 0 ] === 'true';
    data.subPanelContext.editorObject.update( editorObject );

    // Start editing
    // We need to make sure editor right away after rendering
    pca0CommonUtils.changeFormulaSuggesterEditContext( data.subPanelContext.editorObject, 'editing' );

    // Get config Perspective UID
    // This is needed for formula conversion
    let variantRuleData = _.get( data, 'subPanelContext.variantRuleData' );
    let { configPerspective } = pca0CommonUtils.getConfigPerspectiveAndContextUid( variantRuleData );
    return {
        revisionRule: revisionRule,
        searchCriteriaLink: link,
        considerRevRuleForSearch: considerRevRuleForSearch,
        featurePropLabel: featurePropLabel,
        expressionPropLabel: expressionPropLabel,
        searchCriteria: searchCriteria,
        configPerspectiveUid: configPerspective.uid,
        isWaitingForTcFormulaUpdate: false
    };
};

/**
 * Create and return the search criteria input for perform search SOA
 * @param {Object} vmData - The VM object
 */
export let setSearchCriteria = ( vmData ) => {
    let newSubPanelContext = { ...vmData.subPanelContext.getValue() };
    if( !newSubPanelContext.searchCriteriaLink.isSavedQuery ) {
        // In case of saved query, we will not show search criteria
        // in results tab. We will show only the search criteria link.
        newSubPanelContext.searchCriteria = vmData.searchCriteria;
    } else {
        // Empty out the searchCriteria in case of saved query
        uwPropertyService.updateModelData( vmData.searchCriteria, '', [ '' ], false, true, true, {} );
        vmData.dbValue = '';
        vmData.newValue = '';
        newSubPanelContext.searchCriteria = vmData.searchCriteria;
    }
    newSubPanelContext.searchCriteriaLink = vmData.searchCriteriaLink;
    newSubPanelContext.considerRevRuleForSearch = vmData.considerRevRuleForSearch;
    newSubPanelContext.revisionRule = vmData.currentRevisionRule.dbValue ? vmData.currentRevisionRule : '';
    newSubPanelContext.featurePropLabel = vmData.featurePropLabel.propertyDisplayName;
    newSubPanelContext.ootbSavedQueryUID = vmData.subPanelContext.ootbSavedQueryUID;

    if( vmData.subPanelContext.update ) {
        vmData.subPanelContext.update( newSubPanelContext );
    }
};

/**
 * Create and return the search criteria input for perform search SOA
 * @param {Object} subPanelContext - subPanelContext passed by parent component
 * @param {String} lastLoadedVariantUid - UID of last loadedSVR
 * @param {Number} startIndex - startIndex for input DataProvider
 * @returns {Object} updated revision rule and Search Criteria
 */
export let getSearchCriteria = ( subPanelContext, lastLoadedVariantUid, startIndex ) => {
    const fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    let searchCriteriaLinkData = subPanelContext.searchCriteriaObj.searchCriteriaLink;

    let selectedContext = '';
    let configuratorContext = '';

    if( _.get( subPanelContext, 'configCtx' ) ) {
        // set configurator context as input to search saved variants soa if in hosted configurator mode
        configuratorContext = subPanelContext.configCtx.uid;
    } else {
        selectedContext = pca0CommonUtils.getSelectionForVariantContext( Pca0Constants.FSC_CONTEXT ).uid;
    }

    let searchInput = {
        selectedContext: selectedContext,
        configuratorContext: configuratorContext,
        revisionRule: fscContext.revRule || configuratorUtils.initCurrentRevisionRuleFromSettingsForFSC().dbValue
    };

    if( !_.isEmpty( lastLoadedVariantUid ) && startIndex > 0 ) {
        // Only set uidOfLastRule if startIndex is greater than 0
        searchInput.uidOfLastRule = lastLoadedVariantUid;
    }

    if( !searchCriteriaLinkData.isSavedQuery ) {
        let allRevisions = !_.get( subPanelContext, 'searchCriteriaObj.considerRevRuleForSearch.dbValue' );
        searchInput.allRevisions = allRevisions.toString();
        let searchCriteria = _.get( subPanelContext, 'searchCriteriaObj.searchCriteria.dbValue' );
        let activeSearchCriteria = _.get( subPanelContext, 'searchCriteriaObj.searchCriteriaLink.dbValue' ) ?
            subPanelContext.searchCriteriaObj.searchCriteriaLink.dbValue : subPanelContext.searchCriteriaObj.searchCriteriaLink;
        if( activeSearchCriteria === Pca0Constants.SEARCH_CRITERIA.FEATURE && fscContext.selectedExpressions ) {
            // Call commonUtil to get Feature-based search parameters for SOA Input
            // But Delete the returned ConfigPerspective:
            // We should not send the perspective from the client in SOA input for load variants panel.
            // We should send either context uid ( configuratorContext ) or structure uid ( selectedContext )
            // along with the revision rule.
            // Server builds the perspective from provided context/product uid and revision rule.
            let filterByFeatureInput = pca0ConfiguratorExplorerCommonUtils.getInputAndReviseCriteria(
                lastLoadedVariantUid, // uidOfObject
                '', // tag
                subPanelContext.searchState, // searchState
                [], // newlyCreatedObjUids
                startIndex, // startIndex
                subPanelContext.variantRuleData // variantRuleData
            );
            delete filterByFeatureInput.configPerspective;
            searchInput = { ...searchInput, ...filterByFeatureInput };
        } else if( activeSearchCriteria === Pca0Constants.SEARCH_CRITERIA.EXPRESSION && fscContext.selectedExpressions ) {
            // When filtering by "Expression", we come here when internal formula has been updated in Editor
            searchInput.tcFormula = subPanelContext.formula.internal;
        } else {
            searchInput.queryUID = subPanelContext.ootbSavedQueryUID;
            searchInput.useImanRelation = 'true';
            // Send the search criteria in JSON format
            let savedQueryInput = {
                [ activeSearchCriteria ]: searchCriteria
            };
            searchInput.savedQueryInput = JSON.stringify( savedQueryInput );
        }
    } else {
        // It is an OOTB 'Variant Rules' Saved Query
        let advancedSearchState = subPanelContext.advancedSearchState.getValue();
        searchInput.savedQueryInput = JSON.stringify( advancedSearchState.savedQueryAttributes );
        let allRevisions = !_.get( advancedSearchState, 'considerRevRuleForSearch.dbValue' );
        searchInput.allRevisions = allRevisions.toString();
        searchInput.useImanRelation = 'true';
        searchInput.queryUID = advancedSearchState.savedQuery.value;
    }
    return searchInput;
};

/**
 * Build the input searchFilterMap for performSearchViewModel SOA
 * Calling common util for generating the map
 * @param {Object} subPanelContext - subPanelContext passed by parent component
 * @return {Object} searchFilterMap containing information about the selected features
 */
export let getInputSearchFilterMap = subPanelContext => {
    let activeSearchCriteria = _.get( subPanelContext, 'searchCriteriaObj.searchCriteriaLink.dbValue' ) ?
        subPanelContext.searchCriteriaObj.searchCriteriaLink.dbValue : subPanelContext.searchCriteriaObj.searchCriteriaLink;
    if( activeSearchCriteria === Pca0Constants.SEARCH_CRITERIA.FEATURE ) {
        return pca0ConfiguratorExplorerCommonUtils.getInputSearchFilterMap( subPanelContext.searchState );
    }
    // Return empty map for filter type other than Feature
    return {};
};

/**
 * Get selection data from Results
 * @param {Object} eventData - The event data
 * @returns {Object} selected object
 */
export let handleResultsSelectionChange = function( eventData ) {
    let ret;
    if( eventData && eventData.selectedObjects ) {
        ret = eventData.selectedObjects;
    }
    return ret;
};

/**
 * Initialize Tabs and update context
 * @param {Array} visibleTabs the panel tabs
 * @param {Object} viewModel - The VM object
 * @returns {Object} List of visible tabs and callback for when user switches tab
 *  together with fields that need initialization
 */
export let handleInitializeActions = function( visibleTabs, viewModel ) {
    // Update context
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.isSearchContext = true;
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

    // Load Panel tabs
    const tabChangeCallback = ( pageId, tabTitle ) => {
        //let { dispatch } = viewModel;
        let selectedTab = visibleTabs.filter( function( tab ) {
            return tab.pageId === pageId || tab.name === tabTitle;
        } )[ 0 ];

        viewModel.dispatch( { path: 'data.activeTab', value: selectedTab } );
    };

    let defaultTab = visibleTabs.filter( function( tab ) {
        return tab.selectedTab;
    } )[ 0 ];

    if( defaultTab ) {
        return {
            activeTab: defaultTab,
            visibleTabs: visibleTabs,
            api: tabChangeCallback
        };
    }

    return {
        visibleTabs: visibleTabs,
        api: tabChangeCallback
    };
};

/**
 * Programmatically switch to tab
 *
 * @param {Array} visibleTabs All visible tabs
 * @param {String} pageId Selected tab page ID to show
 * @param {String} tabKey Tab Key to show
 * @param {Object} searchCriteria VMprop selected filter/searchCriteria value
 * @param {Object} searchCriteriaLink VMprop of selected filter/searchCriteria category
 * @param {Object} considerRevRuleForSearch VMprop of checkbox to include(true)/exclude(false) RevisionRule as part of the SVR search criterion
 * @returns {Object} Active tab object and reset selectedResultObjects
 */
export let handleTabChange = ( visibleTabs, pageId, tabKey, searchCriteria, searchCriteriaLink, considerRevRuleForSearch ) => {
    let selectedTab = visibleTabs.filter( function( tab ) {
        return tab.pageId === pageId || tab.tabKey === tabKey;
    } )[ 0 ];

    eventBus.publish( 'awTab.setSelected', selectedTab );

    // Clear search result and update search Criteria to be passed to parent component
    return {
        selectedTab: selectedTab,
        selectedResultObjects: [],
        searchCriteriaObj:{
            searchCriteria:searchCriteria,
            searchCriteriaLink: searchCriteriaLink,
            considerRevRuleForSearch:considerRevRuleForSearch
        }
    };
};

/**
 * Set active tab
 * @param {Object} data - The VM object
 * @returns {Object} Active panel id string and reset selectedResultObjects
 */
export let setActiveView = function( data ) {
    //reset the selectedResultObjects as well
    return {
        activeView: data.selectedTab.panelId,
        selectedResultObjects: []
    };
};

/**
 * The method will pop up the show Confirmation Message For Load to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 * @param {string} editContext - edit Context
 * @param {string} popupId - popupId of Dialog
 */
export let showConfirmationMessageForLoad = function( editContext, popupId ) {
    var msg = configuratorUtils.getFscLocaleTextBundle().loadConfirmation;
    var cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    var proceedString = configuratorUtils.getFscLocaleTextBundle().load;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            dialogService.closeDialog( editContext, popupId );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0LoadSVRSearchTab.loadSavedVariants' );
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};
/**
 * Clean up action data for view UnMount
 * @returns {Object} searchCriteria
 */
export let cleanUp = function() {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.revRule = '';
    delete fscContext.loadVariantSearchCriteria;
    delete fscContext.isSearchContext;
    appCtxSvc.updateCtx( 'fscContext', fscContext );

    // Reset searchCriteriaLink to Name, so next time when Load Variant Tab is opened, it opens with 'Name' Search Criteria
    return { searchCriteriaLink: 'Name' };
};

/**
 * Clean up action data for view UnMount
 * @param {Object} searchByCriteriaListInput - The searchByCriteriaListInput
 * @param {Object} ootbSavedQueryUIDInput - The ootbSavedQueryUIDInput
 * @returns {Object} searchCriteria
 */
export let populateSearchCriteria = async( searchByCriteriaListInput, ootbSavedQueryUIDInput ) => {
    // return searchByCriteriaListInput if it is not empty. No need to re-compute the search criteria again.
    if( !_.isEmpty( searchByCriteriaListInput ) && !_.isEmpty( ootbSavedQueryUIDInput ) ) {
        return { response: searchByCriteriaListInput, ootbSavedQueryUID: ootbSavedQueryUIDInput };
    }

    let searchByCriteriaList = [];

    // variantRuleSavedQuerxies contains saved query 'Variant Rules' then fetch the search criteria from the saved query 'Variant Rules'
    // and add it to the searchByCriteriaList

    const findQueryInputData = {
        inputCriteria: [ {
            queryNames: [ 'Variant Rules' ]
        } ]
    };
    let responseSavedQuery = await soaService.postUnchecked( 'Query-2010-04-SavedQuery', 'findSavedQueries', findQueryInputData );
    let ootbSavedQueryUID = responseSavedQuery.savedQueries[ 0 ].uid;

    let request = {
        selectedQuery: {
            uid: responseSavedQuery.savedQueries[ 0 ].uid,
            type: 'ImanQuery'
        }
    };

    // Get the selected query criteria from the saved query 'Variant Rules'
    let responseSelectedQueryCriteria = await soaService.post( 'Internal-AWS2-2016-12-AdvancedSearch', 'getSelectedQueryCriteria', request );

    let searchUid = responseSavedQuery.savedQueries[ 0 ].uid;
    let modelObject = clientDataModel.getObject( responseSelectedQueryCriteria.advancedQueryCriteria.uid );
    let attributesViewModelObj = advancedSearchService.processAttributesViewModelObj( advancedSearchService.createAttributesViewModelObject( searchUid, modelObject ) );

    let queryAttributes = await advancedSearchUtils.populateQueryAttributesForSavedSearch( attributesViewModelObj );

    // Iterate over props
    // Whatever be the search criteria attributes, we should add it to the searchByCriteriaList
    // only if they are the part of given list
    const searchCriteriaAttributesList = [ 'object_name', 'object_desc', 'ID' ];
    for( let prop in queryAttributes.props ) {
        if( searchCriteriaAttributesList.includes( prop ) ) {
            let searchCriteria = {
                staticDisplayValue: queryAttributes.props[ prop ].propertyDisplayName,
                staticElementObject: queryAttributes.props[ prop ].propertyName,
                selected: false
            };
            searchByCriteriaList.push( searchCriteria );
        }
    }

    // Add the search criteria 'Feature' to the searchByCriteriaList
    searchByCriteriaList.push( {
        staticDisplayValue: configuratorUtils.getFscLocaleTextBundle().feature,
        staticElementObject: 'Feature',
        selected: false
    } );

    // Add the search criteria 'Expression' to the searchByCriteriaList
    searchByCriteriaList.push( {
        staticDisplayValue: configuratorUtils.getFscLocaleTextBundle().expression,
        staticElementObject: 'Expression',
        selected: false
    } );

    let variantRuleSavedQueries = appCtxSvc.getCtx( 'preferences' )[ Pca0Constants.PCA_VARIANTRULE_SAVEDQUERIES_PREFERENCE ];

    if( variantRuleSavedQueries ) {
        // Iterate over variantRuleSavedQueries and add saved queries to the searchByCriteriaList
        for( let variantRuleSavedQuery of variantRuleSavedQueries ) {
            //append display Name with '(Saved Query)'
            const displayName = variantRuleSavedQuery + ` (${configuratorUtils.getFscLocaleTextBundle().savedQuery})`;
            searchByCriteriaList.push( {
                staticDisplayValue: displayName,
                // This wierd splitter "#::" is used so that it doesn't collide with the actual saved query name
                staticElementObject: variantRuleSavedQuery + '#::SavedQuery',
                selected: false
            } );
        }
    }
    return { response: searchByCriteriaList, ootbSavedQueryUID };
};

/**
 * Handles the selection change by looking at the length of the selection and
 * if more than 1 returning true (for manual mode) otherwise leaving it unchanged
 * @param {Boolean} loadInManualMode - the current vmo value
 * @param {Integer} length - the selection length
 * @returns {Boolean} true or false for the db value of the checkbox
 */
export let handleMultipleSelectionChange = ( loadInManualMode, length ) => {
    if( length > 1 ) {
        return true;
    }
    return loadInManualMode;
};

/**
 * This API returns the list of active variant rules based on the selected objects to prep for the soa call
 * @param {Array} selectedObjects - list of selected objects
 * @returns {Array} list of active variant rules
 */
export let getActiveVariantRules = ( selectedObjects ) => {
    let svrList = [];
    if( selectedObjects ) {
        selectedObjects.forEach( function( selection ) {
            svrList.push( { uid: selection.uid, type: 'VariantRule' } );
        } );
    }
    return svrList;
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {Object} ConfigPerspective - Returns the config perspective
 */
export let getFscConfigPerspective = ( variantRuleData ) => {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * Return Profile Settings information
 * @returns {Object} Active Profile Settings for FSC
 */
export let getProfileSettingsForFsc = () => {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * Convert selected expression json object to selected expression json string array.
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = ( selectedExpressions ) => {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/** Helps to get configurator context with respect to module
 * @param {String} contextName - Name of context that we need to fetch from global ctx
 * @param {Object} configCtx - Configurator context provided by consumer apps
 * @returns {Object} VariantContext required to call VCV3 SOA
 */
export let getSelectionForVariantContext = ( contextName, configCtx ) => {
    return pca0CommonUtils.getSelectionForVariantContext( contextName, configCtx );
};

//this methow will need adjustment when the check SOA call is implemented. Code right now makes use of the matrix SOA call
//sort through the retrieved stuff and put back in the selected objects only the admissible ones
//then show message for the removed ones and proceed to switch for the admissible ones
/**
 * Checks if the load of SVRs is allowed, based on the response
 * @param {Object} response - response object
 * @returns {Boolean} true or false, depending if the response allows moving on with at least some SVRs
 */
export let checkIfLoadAllowed = ( response ) => {
    //if there is no viewModelObjectMap return false, otherwise true (either from all passing the check or partially some passing it)
    if( !response.viewModelObjectMap ) {
        return false;
    }

    return true;
};

/**
 * Delivers the reduced list of SVRs in a mixed used case with only the allowed ones returning, based on the response
 * @param {Object} response - response object
 * @param {Array} selectedObjects - selectedObjects Array
 * @returns {Array} reduced list of selected Objects
 */
export let getSVRsToLoad = ( response, selectedObjects ) => {
    //return the objects in viewModelObjectMap if there is no response info or there is one but completed with error (meaning some did, some did not pass the check)
    if( response.viewModelObjectMap && ( !response.responseInfo || response.responseInfo && response.responseInfo.isCompletedWithError ) ) {
        //return only the ones that came back from the response
        return _.filter( selectedObjects, function( obj ) {
            if( response.viewModelObjectMap[ obj.uid ] ) {
                return obj;
            }
        } );
    }

    return selectedObjects;
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForVCV = () => {
    return pca0CommonUtils.getPropertyPolicy( 'variantConfigurationView' );
};

export const getLastUid = ( response ) => {
    return pca0ConfiguratorExplorerCommonUtils.getLastUid( response );
};

/**
 * Overwrite EditorObject content with DisplayFormula from SOA response
 * @param {Object} formulaRef formula internal object of Pca0FormulaSuggester component
 * @param {String} formulaString displayFormula to be overwritten on the editor, as from soaResponse
 */
export let writeFormulaIntoEditorObject = ( formulaRef, formulaString ) => {
    let formulaObj = { ...formulaRef.getValue() };
    formulaObj.display = formulaString.trim();
    formulaRef.update( formulaObj );
};

/**
 * Prepare Expressions input for the convertVariantExpressions (grid to formula) SOA
 * Using selections Map from input context
 * @param {String} contextKey - context UID
 * @returns {Array} Array of json string of selected expressions.
 */
export let getVariantExpressionsForConversionToTcFormula = contextKey => {
    // Get expressionMap from context
    let context = appCtxSvc.getCtx( contextKey );
    let selectedExpressions = context.selectedExpressions;

    // Remove selections with 0 selection state.
    pca0ExpressionGridService.removeZeroSelections( selectedExpressions );

    // Remove 'affectedNodes': this causes a crash in 'convertVariantExpression' SOA
    let selectedExpr = Object.values( selectedExpressions )[ 0 ];
    let expressions = selectedExpr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ].subExpressions[ 0 ].expressionGroups;
    Object.values( expressions ).forEach( exprArray => exprArray.forEach( expr => {
        delete expr.affectedNodes;
    } ) );

    // Create plain array of selectedExpressions JSON object and selected object uid
    let variantExpressions = [];

    // Iterate through the selectedExpressionsObject
    Object.keys( selectedExpressions ).forEach( key => {
        // Create JSON object of single selected expression
        let variantExpression = {
            applicationConfigExpression: selectedExpressions[ key ]
        };
        let variantExpressionString = JSON.stringify( variantExpression );

        //Add the elements
        variantExpressions.push( variantExpressionString );
    } );

    return variantExpressions;
};
/**
 * Validate if there are any expressions authored for the input context
 * This is needed when converting to formula: if no expressions are authored, SOA call is skipped.
 * @param {String} contextKey Active Context identifier
 * @returns {Boolean} true if any expressions are authored
 */
export let validateIfAnyExprsAreAuthored = contextKey => {
    let context = appCtxSvc.getCtx( contextKey );
    let selectedExpressions = context.selectedExpressions;
    return Object.keys( selectedExpressions ).length > 0;
};

/**
 * Returns perspective model object.
 * Call Util 'getPerspectiveForFormulaSyntaxCheck' from Formula Suggester Component.
 * If parent view has sent it, it will be used else perspective generated while getting variability data will be used.
 * @param {String} perspectiveUidFromParent perspective uid from parent view
 * @param {String} generatedPerspectiveUid perspective uid from getVariability3 soa response
 * @returns {Object} configPerspective model object
 */
export const getPerspectiveForFormulaConversion = ( perspectiveUidFromParent, generatedPerspectiveUid ) => {
    return pca0FormulaSuggesterService.getPerspectiveForFormulaSyntaxCheck( perspectiveUidFromParent, generatedPerspectiveUid );
};

export default exports = {
    getSearchCriteriaLink,
    evaluateStartIndexForVariantRuleDataProvider,
    loadSavedVariants,
    handleSVRChange,
    handleSVRUnload,
    handleUnloadSVRInGridView,
    clearSearchDataProvider,
    buildSearchResults,
    getVariantRules,
    processSVRSearchCriteriaSelection,
    handleSelectionInSearchInputTab,
    getVariantRulesBasedOnCriteria,
    initializeLoadSVRInputPanel,
    setSearchCriteria,
    getSearchCriteria,
    getInputSearchFilterMap,
    handleResultsSelectionChange,
    handleInitializeActions,
    handleTabChange,
    setActiveView,
    showConfirmationMessageForLoad,
    cleanUp,
    populateSearchCriteria,
    handleMultipleSelectionChange,
    getActiveVariantRules,
    getFscConfigPerspective,
    getProfileSettingsForFsc,
    convertSelectedExpressionJsonObjectToString,
    getSelectionForVariantContext,
    checkIfLoadAllowed,
    getSVRsToLoad,
    getPropertyPolicyForVCV,
    getLastUid,
    writeFormulaIntoEditorObject,
    getVariantExpressionsForConversionToTcFormula,
    validateIfAnyExprsAreAuthored,
    getPerspectiveForFormulaConversion
};
