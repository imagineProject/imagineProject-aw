// Copyright (c) 2022 Siemens

/**
 * @module js/variantInfoConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import omStateHandler from 'js/occurrenceManagementStateHandler';
import viewModelObjectService from 'js/viewModelObjectService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import endItemUnitEffectivityService from 'js/endItemUnitEffectivityConfigurationService';
import localeService from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtBackingObjProviderSvc from 'js/aceBackingObjectProviderService';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import _localeSvc from 'js/localeService';
import messagingSvc from 'js/messagingService';
import TcSessionData from 'js/TcSessionData';
import dataManagementSvc from 'soa/dataManagementService';
import dataProviderFactory from 'js/dataProviderFactory';
import declDataProviderSvc from 'js/declDataProviderService';
import modelPropSvc from 'js/modelPropertyService';

var exports = {};

var _productContextInfo = null;
var _defaultVariantRule = null;
var _customVariantRule = null;
var _isSeparatorAdded = false;
var _data = null;
var _eventSubDefs = [];


var populateProductContextInfo = function( context, configSvrEndItem ) {
    if( context ) {
        if( context.productContextInfo && _productContextInfo !== context.productContextInfo ) {
            // A change in ProductContext doesn't imply a change in product.
            // Check if the product has changed and fire an event.
            // The custom variant panel needs to react to this event.
            if( _productContextInfo !== null &&
                _productContextInfo.props.awb0Product !== null &&
                context.productContextInfo.props.awb0Product !== null &&
                _productContextInfo.props.awb0Product.dbValues[ 0 ] !== context.productContextInfo.props.awb0Product.dbValues[ 0 ] ) {
                eventBus.publish( 'ConfiguratorContextContainerChangedEvent' );
            }

            _productContextInfo = context.productContextInfo;
            occmgmtUtils.updateValueOnCtxOrState( 'svrOwningItemToRender', '', configSvrEndItem );
        }
    } else {
        _productContextInfo = null;
    }
    return context.productContextInfo;
};

var populateOpenedProduct = function( context ) {
    if( context ) {
        var productContextInfo = context.productContextInfo;
        if( productContextInfo ) {
            return productContextInfo.props.awb0Product;
        }
    }
};

var populateReadOnlyFeaturesInfo = function( context ) {
    appCtxSvc.updatePartialCtx( 'variantRule', appCtxSvc.ctx.variantRule ? appCtxSvc.ctx.variantRule : {} );
    appCtxSvc.updatePartialCtx( 'variantRule.isVariantRuleFeatureReadOnly', context.readOnlyFeatures ? context.readOnlyFeatures.Awb0VariantFeature : false );
};

var getSVROwningItemFromProductContextInfo = function( context ) {
    if( context ) {
        var svrOwningItemRev = context.productContextInfo.props.awb0VariantRuleOwningRev;
        if( svrOwningItemRev && !_.isEmpty( svrOwningItemRev.dbValues[ 0 ] ) ) {
            return cdm.getObject( svrOwningItemRev.dbValues[ 0 ] );
        } else if( context.productContextInfo.props.awb0Product ) {
            return cdm.getObject( context.productContextInfo.props.awb0Product.dbValues[ 0 ] );
        }
        return svrOwningItemRev;
    }
};

var getOpenedProductUIDFromProductContextInfo = function( contextInfo ) {
    if( contextInfo ) {
        return contextInfo.productContextInfo.props.awb0Product.dbValues[ 0 ];
    }
};

var handleSVROwningItemChangeIfThePanelIsGettingReInitialized = function( occContext, svrOwningItemToRender, contextKey ) {
    if( occContext && svrOwningItemToRender ) {
        var svrOwningItemUID = svrOwningItemToRender.uid;
        if( svrOwningItemUID === getOpenedProductUIDFromProductContextInfo( occContext ) ) {
            svrOwningItemUID = null;
        }
        var eventData = {
            svrOwningItem: {
                uid: svrOwningItemUID
            },
            variantRule: null,
            viewKey: contextKey
        };
        eventBus.publish( 'awConfigPanel.variantInfoChanged', eventData );
    }
    occmgmtUtils.updateValueOnCtxOrState( 'svrOwningItemSelected', '', occContext );
};

var updatePanelWithSVROwningItemToRender = function( svrOwningItemToRender, configSvrEndItem ) {
    if( svrOwningItemToRender ) {
        occmgmtUtils.updateValueOnCtxOrState( 'svrOwningItemToRender', svrOwningItemToRender, configSvrEndItem );
    }
};

var isClassicVariantsSupported = function() {
    var supportedFeatures = omStateHandler.getSupportedFeatures();
    if( supportedFeatures.Awb0SupportsClassicVariantsRule ) {
        return true;
    }
    return false;
};

export let updatePartialCtx = function( path, value ) {
    appCtxSvc.updatePartialCtx( path, value );
};

var newSVROwningItemSelected = function( occContext ) {
    return occContext.svrOwningItemSelected;
};

var populateSVROwningItems = function( context, contextKey, configSvrEndItem ) {
    if( context ) {
        var svrOwningItemToRender = newSVROwningItemSelected( context );
        if( svrOwningItemToRender ) {
            handleSVROwningItemChangeIfThePanelIsGettingReInitialized( context, svrOwningItemToRender, contextKey );
            updatePanelWithSVROwningItemToRender( svrOwningItemToRender, configSvrEndItem );
        } else {
            var svrOwningItemFromPCI = getSVROwningItemFromProductContextInfo( context );
            updatePanelWithSVROwningItemToRender( svrOwningItemFromPCI, configSvrEndItem );
        }
    }
};

var convertVariantRulesIntoVMProperty = function( productContextInfoModelObject ) {
    var variantRuleVMProperties = [];
    for( var i = 0; i < productContextInfoModelObject.props.awb0VariantRules.dbValues.length; i++ ) {
        var variantRuleVMProperty = uwPropertyService.createViewModelProperty(
            productContextInfoModelObject.props.awb0VariantRules.dbValues[ i ],
            productContextInfoModelObject.props.awb0VariantRules.uiValues[ i ], 'STRING',
            productContextInfoModelObject.props.awb0VariantRules.dbValues[ i ], '' );
        variantRuleVMProperty.uiValue = productContextInfoModelObject.props.awb0VariantRules.uiValues[ i ];
        //Set an index for applied rules. This index will be used to determine the index of clicked rule link in case of overlay.
        //This will be helpful when user has applied the same rule multiple times and we want to determine which link of the rule has been clicked.
        variantRuleVMProperty.ruleIndex = i;
        variantRuleVMProperty.isEditable = true;
        variantRuleVMProperties[ i ] = variantRuleVMProperty;
    }

    return variantRuleVMProperties;
};

var getVariantRuleFromProductContextInfo = function( occContext ) {
    if( occContext && occContext.supportedFeatures && occContext.supportedFeatures.Awb0ConfiguredByProximity ) {
        // Create Configured by Proximity text to display if Structure is configured by proximity
        var resource = 'OccurrenceManagementSubsetConstants'; //Configure by Proximity is only possible if we have a proximity recipe term.
        var localeTextBundle = localeService.getLoadedText( resource );
        var configuredByProximityName = localeTextBundle.configuredByProximityVariantName;
        var validOverlayVMProperty = uwPropertyService.createViewModelProperty(
            configuredByProximityName,
            configuredByProximityName, 'STRING',
            configuredByProximityName, '' );
        validOverlayVMProperty.uiValue = configuredByProximityName;
        validOverlayVMProperty.ruleIndex = 0;
        return [ validOverlayVMProperty ];
    }
    if( occContext ) {
        var currentVariantRules = occContext.productContextInfo.props.awb0VariantRules;
        if( currentVariantRules && currentVariantRules.dbValues && currentVariantRules.dbValues.length > 0 ) {
            return convertVariantRulesIntoVMProperty( occContext.productContextInfo );
        }
    }
};

var getDefaultVariantRule = function( data ) {
    if( data ) {
        return _.clone( data.defaultVariantRule, true );
    }
};

var populateVariantRule = function( data, occContext ) {
    if( occContext ) {
        var currentVariantRules = getVariantRuleFromProductContextInfo( occContext );
        appCtxSvc.updatePartialCtx( 'variantRule', appCtxSvc.ctx.variantRule ? appCtxSvc.ctx.variantRule : {} );
        if( !currentVariantRules || !currentVariantRules[ 0 ].uiValue ) {
            currentVariantRules = [];
            var defaultVariantRule = getDefaultVariantRule( data );
            if( defaultVariantRule ) {
                defaultVariantRule.ruleIndex = 0;
            }
            currentVariantRules[ 0 ] = defaultVariantRule;
            appCtxSvc.updatePartialCtx( 'variantRule.showOverlayCommand', false );
        } else {
            appCtxSvc.updatePartialCtx( 'variantRule.showOverlayCommand', true );
        }
        return currentVariantRules;
    }
};

export let updateCurrentVariantRule = function( data, eventData ) {
    if( data && data.appliedVariantRules && eventData.selectedObject && eventData.index !== undefined ) {
        var appliedVariantRules = data.appliedVariantRules;
        appliedVariantRules.splice( eventData.index, 1, eventData.selectedObject.props.object_string );
        return { appliedVariantRules };
    }
};

/**
 * Get SVROwningItems
 */
export let getSVROwningItems = function( configSvrEndItem ) {
    if( configSvrEndItem ) {
        var svrOwningItemToRender = configSvrEndItem.svrOwningItemToRender;
        if( svrOwningItemToRender ) {
            var svrOwningItems = [];
            svrOwningItems.push( svrOwningItemToRender );
            return svrOwningItems;
        }
    }
};

var clearDataProviderCache = function( data ) {
    if( data && data.dataProviders && data.dataProviders.getAllVariantRules ) {
        data.dataProviders.getAllVariantRules.viewModelCollection.clear();
        data.dataProviders.getAllVariantRules.selectedObjects = [];
    }
};

export let addNewVariantRule = function( data ) {
    if( data.appliedVariantRules && data.newVariantRule ) {
        var newVariantRule = _.cloneDeep( data.newVariantRule );
        newVariantRule.ruleIndex = data.appliedVariantRules.length;
        var appliedVariantRules = _.cloneDeep( data.appliedVariantRules );
        appliedVariantRules.push( newVariantRule );
        let variantRule = appCtxSvc.getCtx( 'variantRule' );
        let updatedVariantRule = variantRule ? { ...variantRule } : {};
        updatedVariantRule.showOverlayCommand = false;
        appCtxSvc.updatePartialCtx( 'variantRule', updatedVariantRule );
        return { newVariantRule, appliedVariantRules };
    }
};

/**
 * Fires the event to navigate to the 'Custom Variant panel'
 */
export let showCustomVariantPanel = function( variantRuleToEdit ) {
    appCtxSvc.unRegisterCtx( 'variantConfigContext' );
    if( variantRuleToEdit !== undefined && variantRuleToEdit !== null ) {
        variantRuleToEdit = viewModelObjectService.createViewModelObject( variantRuleToEdit );
    }

    // Set initial variant rule
    var variantConfigContext = {};
    if( variantRuleToEdit ) {
        variantConfigContext = {
            initialVariantRule: variantRuleToEdit
        };
    }

    // Register variant context
    variantConfigContext.guidedMode = true;
    variantConfigContext.customVariantPanelInitializing = true;
    // Fire event to launch 'Custom variant panel'

    appCtxSvc.registerCtx( 'variantConfigContext', variantConfigContext );
    if( isClassicVariantsSupported() ) {
        appCtxSvc.updatePartialCtx( 'classicCfgContext.isSavePanelDirty', false );

        appCtxSvc.unRegisterCtx( 'classicCfgContext' );
        appCtxSvc.registerCtx( 'classicCfgContext', {} );
    }
};

/**
 * This API evaluates variant rules to apply while applying the custom configuration and returns the list of
 * variant rule UIDs
 */
export let getVariantRulesToApply = function( occContext ) {
    //Get the current applied rule list
    var currentAppliedVRs = occContext.productContextInfo.props.awb0VariantRules.dbValues;
    var variantRules = currentAppliedVRs;
    var variantConfigContext = appCtxSvc.getCtx( 'variantConfigContext' );
    var index;

    // In case of classic variants, we do not support multiple variant rules like PCA
    // so add only one variant rule.
    if( isClassicVariantsSupported() ) {
        if( variantConfigContext.customVariantRule ) {
            variantRules[ 0 ] = variantConfigContext.customVariantRule.uid;
        } else {
            if( variantConfigContext.initialVariantRule !== undefined ) {
                variantRules[ 0 ] = variantConfigContext.initialVariantRule.uid;
            }
        }
        return variantRules;
    }

    //If Custom variant panel was opened with an initial variant rule then replace the initial variant rule in awb0VariantRules
    //with newly created custom variant rule
    if( variantConfigContext.initialVariantRule !== undefined ) {
        var initialVariantRuleUID = variantConfigContext.initialVariantRule.uid;
        index = variantRules.indexOf( initialVariantRuleUID ) !== -1 ? variantRules
            .indexOf( initialVariantRuleUID ) : variantRules.length;
    } else {
        index = variantRules.length;
    }
    if( variantConfigContext.customVariantRule ) {
        variantRules[ index ] = variantConfigContext.customVariantRule.uid;
    } else {
        if( variantConfigContext.initialVariantRule !== undefined ) {
            variantRules[ index ] = variantConfigContext.initialVariantRule.uid;
        }
    }
    return variantRules;
};

/**
 * Initialize the Variant Info Configuration Section
 */
export let getInitialVariantConfigurationData = function( data, occContext, configSvrEndItem ) {
    if( data ) {
        var productContextInfo = populateProductContextInfo( occContext, configSvrEndItem );
        if( productContextInfo ) {
            populateReadOnlyFeaturesInfo( occContext );
            const appliedVariantRules = populateVariantRule( data, occContext );
            const openProduct = populateOpenedProduct( occContext );
            if( data.defaultVariantRule ) {
                _defaultVariantRule = data.defaultVariantRule.propertyDisplayName;
            }
            if( data.customVariantRule ) {
                _customVariantRule = data.customVariantRule.propertyDisplayName;
            }
            clearDataProviderCache( data );
            if( _data !== data ) {
                _data = data;
            }
            return { appliedVariantRules, openProduct };
        }
    }
};

/**
 * Initialize SVR Owning end items Section
 *
 * @param {Object} data - The 'data' object from viewModel.
 */
export let initSVROwningItems = function( contextInfo, contextKey, configSvrEndItem ) {
    if( contextInfo ) {
        var productContextInfo = populateProductContextInfo( contextInfo, configSvrEndItem );
        if( productContextInfo ) {
            populateSVROwningItems( contextInfo, contextKey, configSvrEndItem );
            eventBus.publish( 'configPanel.getTopLineCC' );
        }
    }
};

/**
 * Clears the current saved variant selection
 */
export let clearVariantConfigurationData = function( data ) {
    if( data ) {
        clearDataProviderCache( data );
        eventBus.publish( 'configPanel.revealSVROwningItems' );
        if( _data !== data ) {
            _data = data;
        }
    }
};

/**
 * Update Config Items
 */
export let updateConfigItems = function( newItemSelected, occContext ) {
    if( newItemSelected ) {
        occmgmtUtils.updateValueOnCtxOrState( 'svrOwningItemSelected', newItemSelected, occContext );
    }
};

export let processSVROwningItems = function( response, occContext ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }

    var svrOwningItems = endItemUnitEffectivityService
        .populateEndItemsOrSVROwningItems( response.preferredVarRuleOwningObjects );
    svrOwningItems = endItemUnitEffectivityService.addOpenObjectAsPreferredIfApplicable( svrOwningItems,
        response.addOpenObjAsPreferredEndItem, occContext );
    return svrOwningItems;
};

/**
 * Find Subtype Business Object
 */
export let fetchSubBOTypesForVariant = function( data ) {
    if( !data.subBusinessObjects || data.subBusinessObjects.length === 0 ) {
        eventBus.publish( 'searchSVROwningItems.fetchSubBOTypes' );
    } else {
        eventBus.publish( 'searchSVROwningItems.doSearch' );
    }
};

var addSeparatorToVariantRulesList = function( response, variantRules, increment ) {
    //create separator object with marker information
    var separatorObject = tcViewModelObjectService.createViewModelObjectById( 'separatorObject' );
    separatorObject.marker = response.marker + increment;
    separatorObject.props.object_string = {
        dbValue: '',
        uiValues: [ '' ]
    };
    //add separator object to response to render separator in list
    if( !_isSeparatorAdded && response.marker >= 0 && response.marker <= response.endIndex ) {
        variantRules.splice( response.marker, 0, separatorObject );
        response.totalFound++;
        _isSeparatorAdded = true;
    }
};

var showFilteredVariantRules = function( response, variantRules, customRuleSupported ) {
    if( response.endIndex <= 20 ) {
        var matchedItem = null;
        var allVariants = tcViewModelObjectService.createViewModelObjectById( '_defaultVariantRule' );

        allVariants.props.object_string = uwPropertyService.createViewModelProperty(
            _defaultVariantRule,
            _defaultVariantRule, 'STRING',
            _defaultVariantRule, '' );

        allVariants.cellHeader1 = _defaultVariantRule;

        var customRule = tcViewModelObjectService.createViewModelObjectById( '_customVariantRule' );

        customRule.props.object_string = uwPropertyService.createViewModelProperty(
            _customVariantRule,
            _customVariantRule, 'STRING',
            _customVariantRule, '' );

        customRule.cellHeader1 = _customVariantRule;

        // No matching rule with search string
        if( response.totalFound === 0 && !_.isUndefined( _data ) && !_.isUndefined( _data.variantRuleFilterBox ) && _data.variantRuleFilterBox.dbValue ) {
            // Show rule based on matching search criteria
            if( _.startsWith( _defaultVariantRule.toUpperCase(), _data.variantRuleFilterBox.dbValue
                .toUpperCase() ) ) {
                matchedItem = allVariants;
            } else if( customRuleSupported &&
                _.startsWith( _customVariantRule.toUpperCase(), _data.variantRuleFilterBox.dbValue
                    .toUpperCase() ) ) {
                matchedItem = customRule;
            }
        }

        var increment = 1;
        if( matchedItem ) {
            variantRules.splice( 0, 0, matchedItem );
        } else {
            if( customRuleSupported ) {
                // add 'custom' rule at 1st position in response
                variantRules.splice( 0, 0, customRule );
                //add all variants object at 2nd position in response
                variantRules.splice( 1, 0, allVariants );
                increment = 2;
            } else {
                //add all variants object at 1st position in response
                variantRules.splice( 0, 0, allVariants );
            }
        }
        response.totalFound += increment;
    }
};

/**
 * Process the response from Server
 */
export let processVariantRules = function( response, subPanelContext ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    var variantRules = [];
    if( response.endIndex <= 20 ) {
        _isSeparatorAdded = false;
    }

    var increment = 1;
    var customRuleSupported = isClassicVariantsSupported() || omStateHandler.isFeatureSupported( 'Awb0SupportsCustomVariantRule' );

    if( subPanelContext && subPanelContext.variantInHeader ) {
        customRuleSupported = false;
    }

    if( customRuleSupported ) {
        increment = 2;
    }

    // Add separator
    if( response.variantRules ) {
        variantRules = response.variantRules;
        addSeparatorToVariantRulesList( response, variantRules, increment );
    }
    // Show filtered items based on search string
    showFilteredVariantRules( response, variantRules, customRuleSupported );

    return variantRules;
};

/**
 * Evaluate starting index of variant rule data provider
 *
 * @param {Object} dp - The variant rule data provider object.
 * @return {integer} start index for variant rule data provider
 */
export let evaluateStartIndexForVariantRuleDataProvider = function( dp ) {
    if( dp.startIndex === 0 ) {
        return 0;
    }

    var isMarkerPresent = false;

    for( var i = 0; i < dp.viewModelCollection.loadedVMObjects.length; i++ ) {
        if( dp.viewModelCollection.loadedVMObjects[ i ].marker ) {
            isMarkerPresent = true;
            break;
        }
    }

    var extraObjectsInList = 1; // When only 'No Variant Rule' is present in list
    if( isMarkerPresent ) {
        extraObjectsInList++;
    }
    if( omStateHandler.isFeatureSupported( 'Awb0SupportsCustomVariantRule' ) ) {
        extraObjectsInList++;
    }

    return dp.viewModelCollection.loadedVMObjects.length -
        extraObjectsInList;
};

export let showVariantTooltip = function( vmo ) {
    var variantData = {};

    var tooltip;
    //  Update tooltip label with object string of vmo
    if( vmo.props.awb0VariantFormula && !_.isEmpty( vmo.props.awb0VariantFormula.dbValues[ 0 ] ) ) {
        tooltip = uwPropertyService.createViewModelProperty( '', '', 'STRING', '', '' );
        uwPropertyService.setDisplayValue( tooltip, [ vmo.props.awb0VariantFormula.dbValues[ 0 ] ] );
        variantData.variantTooltip = {};
        variantData.variantTooltip = tooltip;
    } else {
        tooltip = uwPropertyService.createViewModelProperty( '', '', 'STRING', '', '' );
        uwPropertyService.setDisplayValue( tooltip, [ vmo.props.awb0HasVariant.propertyDisplayName ] );
        variantData.variantTooltip = {};
        variantData.variantTooltip = tooltip;
    }
    variantData.variantTooltip.propertyLabelDisplay = 'NO_PROPERTY_LABEL';
    return variantData;
};

var handleNoVariantRuleSelected = function( eventData, data ) {
    var activeContext = data.subPanelContext.occContext;
    //Get the current applied rule list
    var currentAppliedVRs = activeContext.productContextInfo.props.awb0VariantRules.dbValues;
    var variantRules = currentAppliedVRs;

    //If there is only 1 rule applied then set the appliedVRs to null
    if( currentAppliedVRs.length === 1 ) {
        variantRules = null;
    } else { //Remove the rule from currently applied rule list
        variantRules.splice( data.subPanelContext.variantRule.ruleIndex, 1 );
    }
    eventData.variantRules = variantRules;
};

var updateAppliedRulesList = function( eventData, data ) {
    var activeContext = data.subPanelContext.occContext;
    //Get the current applied rule list
    var currentAppliedVRs = activeContext.productContextInfo.props.awb0VariantRules.dbValues;
    var variantRules = currentAppliedVRs;
    variantRules[ data.subPanelContext.variantRule.ruleIndex ] = eventData.selectedObjects[ 0 ].uid;

    eventData.variantRules = variantRules;
};

var setVariantRule = function( eventData ) {
    eventBus.publish( 'awConfigPanel.variantInfoChanged', eventData );
};

var setSvrOwningItemforVariantEff = function( eventData, subPanelContext, configSvrEndItem ) {
    var svrowningitem;

    if( configSvrEndItem ) {
        svrowningitem = configSvrEndItem.svrOwningItemToRender;
    }

    if( !svrowningitem ) {
        svrowningitem = getSVROwningItemFromProductContextInfo( subPanelContext.occContext );
    }

    if( svrowningitem ) {
        var SVRowningItemUID = svrowningitem.uid;
        if( !SVRowningItemUID && svrowningitem.dbValues ) {
            SVRowningItemUID = svrowningitem.dbValues[ 0 ];
        }

        eventData.svrOwningItem = {
            uid: SVRowningItemUID
        };
    }

    if( eventData.svrOwningItem !== null ) {
        var productUid = populateOpenedProduct( subPanelContext.occContext );
        var itemRevOwningVarRuleIsSameAsProduct = productUid.dbValues[ 0 ] === eventData.svrOwningItem.uid;
        if( eventData.variantRules === null && itemRevOwningVarRuleIsSameAsProduct ) {
            eventData.svrOwningItem = null;
        }
    }
    var indexOfVarRule;
    if( subPanelContext.indexOfRule !== null ) {
        indexOfVarRule = subPanelContext.indexOfRule;
    }

    setVariantRule( {
        svrOwningItem: eventData.svrOwningItem,
        variantRules: eventData.variantRules,
        selectedObject: eventData.selectedObjects[ 0 ],
        index: indexOfVarRule,
        viewKey: subPanelContext.contextKey
    } );
};

export let updateVariantRule = function( eventData, data, configSvrEndItem ) {
    var isCustomVariantRuleApplied;
    if( eventData.selectedObjects.length ) {
        if( eventData.selectedObjects[ '0' ].marker >= 0 ) { // Handle Separator selected
            exports.selectVariantRule();
        } else if( eventData.selectedObjects[ '0' ].props.object_string.dbValue === data.defaultVariantRule.propertyDisplayName ) { // Handle "No Variant Rule" variant rule selected
            //When user clicks on 'New' and selects 'No Variant Rule', then 'New' will be removed from the list and overlay command will be displayed
            if( data.subPanelContext.variantRule.propertyDisplayName === data.newVariantRule.propertyDisplayName ) {
                data.subPanelContext.appliedVariantRules.splice(
                    data.subPanelContext.variantRule.ruleIndex, 1 );
                appCtxSvc.updatePartialCtx( 'variantRule', appCtxSvc.ctx.variantRule ? appCtxSvc.ctx.variantRule : {} );
                appCtxSvc.updatePartialCtx( 'variantRule.showOverlayCommand', true );
                popupService.hide();
            } else if( data.subPanelContext.variantRule.propertyDisplayName !== data.defaultVariantRule.propertyDisplayName ) { //User clicks on any applied rules and selects 'No Variant Rule'
                handleNoVariantRuleSelected( eventData, data );
                setSvrOwningItemforVariantEff( eventData, data.subPanelContext, configSvrEndItem );
            }
        } else if( eventData.selectedObjects[ '0' ].props.object_string.dbValue === data.customVariantRule.propertyDisplayName ) { // Handle "Custom" variant rule selected
            eventData.svrOwningItem = null;
            eventData.ruleToEdit = data.subPanelContext.variantRule;

            // Publish event to launch panel
            var selectedModelObj = appCtxSvc.getCtx( 'selected' );
            if( selectedModelObj ) {
                eventBus.publish( 'awConfigPanel.customVariantClicked', eventData );
            }
            isCustomVariantRuleApplied = true;
            //popupService.hide();
        } else if( eventData.selectedObjects[ 0 ].uid &&
            data.subPanelContext.variantRule.dbValue !== eventData.selectedObjects[ 0 ].uid ) { // Handle variant rule selected
            updateAppliedRulesList( eventData, data );
            setSvrOwningItemforVariantEff( eventData, data.subPanelContext, configSvrEndItem );
        }
    } else { //Handle Current variant rule selected
        if( !data.isCustomVariantRuleApplied && _.isEmpty( data.variantRuleFilterBox.dbValue ) ) {
            popupService.hide();
        }
    }
    return { isCustomVariantRuleApplied };
};

export let selectVariantRule = function( data, dataProvider ) {
    if( dataProvider && dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        //Find Index of current variant rule and select it
        if( data.subPanelContext.variantRule.dbValue ) {
            var indexOfCurrentRev = dataProvider.viewModelCollection.loadedVMObjects
                .map( function( x ) {
                    return x.uid;
                } ).indexOf( data.subPanelContext.variantRule.dbValue );
            if( indexOfCurrentRev >= 0 ) {
                dataProvider.changeObjectsSelection( indexOfCurrentRev,
                    indexOfCurrentRev, true );
            } else {
                //Deselect "Custom" Variant Rule from List.
                if( dataProvider.selectedObjects.length ) {
                    dataProvider.selectNone();
                }
            }
        } else if( data.subPanelContext.variantRule.propertyDisplayName === data.defaultVariantRule.propertyDisplayName ) { //Select "No Variant Rule" from List
            var indexOfAllRev = dataProvider.viewModelCollection.loadedVMObjects
                .map( function( x ) {
                    return x.props.object_string.dbValue;
                } ).indexOf( data.subPanelContext.variantRule.propertyDisplayName );

            dataProvider.changeObjectsSelection( indexOfAllRev,
                indexOfAllRev, true );
        } else if( data.subPanelContext.variantRule.propertyDisplayName === data.newVariantRule.propertyDisplayName && data.isCustomVariantRuleApplied ) {
            dataProvider.selectNone();
        }
    }
};

export let publishAddNewVariantRuleEvent = function() {
    eventBus.publish( 'awb0AddNewVariantRuleCmdEvent' );
};

export let applyVariantConfigChange = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

export let initialize = function( contextKey ) {
    _setupEventListeners( contextKey );
};

var _setupEventListeners = function( contextKey ) {
    // Subcribe to productContextChangedEvent This event with productChangedOnSelectionChange providertype is fired when PCI changes.
    _eventSubDefs.push( eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
        if( eventData && eventData.dataProviderActionType && eventData.dataProviderActionType === 'productChangedOnSelectionChange' ) {
            var activeContext = appCtxSvc.getCtx( contextKey );
            if( activeContext.pwaSelection && activeContext.pwaSelection[ 0 ] && !_.isUndefined( activeContext.pwaSelection[ 0 ].modelType ) ) {
                if( activeContext.pwaSelection[ 0 ].modelType.typeHierarchyArray.indexOf( 'Awb0PositionedElement' ) > -1 &&
                    !omStateHandler.isFeatureSupported( '4GStructureFeature' ) &&
                    omStateHandler.isFeatureSupported( 'Awb0SupportsFullScreenVariantConfiguration' ) &&
                    ( activeContext.currentState[ activeContext.urlParams.secondaryPageIdQueryParamKey ] === 'Pca0FullScreenConfiguration' ||
                        activeContext.currentState[ activeContext.urlParams.alternatePwaKey ] === 'Pca0FullScreenConfiguration' ||
                        activeContext.currentState[ activeContext.urlParams.alternatePwa2Key ] === 'Pca0FullScreenConfiguration' ) ) {
                    updateVCVOnProductChange( activeContext );
                }
            }
        }
    } ) );
};

var updateVCVOnProductChange = function( activeContext ) {
    let viewModelObjects = appCtxSvc.getCtx( 'mselected' );
    //Update for Variant configuration view
    _.set( appCtxSvc, 'ctx.fscContext.configPerspective', '' );
    _.set( appCtxSvc, 'ctx.fscContext.selectedModelObjects', viewModelObjects );
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    if( fscContext && !fscContext.vrSyncPerformed ) {
        let eventData = {
            selectedModelObjects: viewModelObjects,
            currentAppliedVRs: activeContext.productContextInfo.props.awb0VariantRules.dbValues
        };
        eventBus.publish( 'Pca0FullScreenConfiguration.reload', eventData );
    }
    fscContext.vrSyncPerformed = false;
    appCtxSvc.updateCtx( 'fscContext', fscContext );
};

export let destroy = function() {
    _productContextInfo = null;
    _defaultVariantRule = null;
    _customVariantRule = null;
    _isSeparatorAdded = false;
    resetConsumerAppsData();
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
    _eventSubDefs = [];
    _data = null;
};

let resetConsumerAppsData = function() {
    appCtxSvc.unRegisterCtx( 'variantConditionContext' );
};

export let getLOVValues = ( listValues ) => {
    let lovEntries = [];
    for( var index = 0; index < listValues.length; index++ ) {
        if( listValues[ index ].propDisplayValue !== '' ) {
            lovEntries.push( {
                propDisplayValue: listValues[ index ].propDisplayValue,
                propInternalValue: listValues[ index ].propInternalValue
            } );
        }
    }

    return lovEntries;
};
/**
 * Create view model property for the header
 *
 * @param {Object} optionList - viewModelProperties to retrieve list values from
 * @returns {Object} listOfPossibleResponses - array of all option data
 */

export let populateListboxValues = function( optionList ) {
    var listOfPossibleResponses = [];

    for( let index = 0; index < optionList.length; index++ ) {
        let lov = getLOVValues( optionList[ index ].listValues );
        let response = {
            displayName: optionList[ index ].propertyDisplayName,
            type: 'STRING',
            lov: lov,
            uiValue: optionList[ index ].dbValue,
            dbValue: optionList[ index ].dbValue
        };
        listOfPossibleResponses.push( response );
    }
    appCtxSvc.updatePartialCtx( 'classicCfgContext.vmpForOptions', listOfPossibleResponses );
    return listOfPossibleResponses;
};

export const mergeVmpAndDpMethod = ( lovbox, dataprovider ) => {
    let prop = {
        displayName: lovbox.displayName,
        type: lovbox.type,
        dbValue: lovbox.dbValue,
        isEditable: true,
        dispValue: lovbox.uiValue,
        hasLov: true
    };

    if( prop.dbValue === null ) {
        prop.dbValue = '';
    }
    if( prop.dispValue === null ) {
        prop.dispValue = '';
    }

    var vmProp = modelPropSvc.createViewModelProperty( prop );
    vmProp.dataProvider = dataprovider;
    return vmProp;
};

export const getDpValuesMethod = ( data ) => {
    return data;
};

export let populateCustomVariantTitle = function( data, subPanelContext ) {
    let customVariantTitle = subPanelContext.variantRule.uiValue;
    if( customVariantTitle === data.i18n.useNoVariantRuleLabel ) {
        customVariantTitle = data.i18n.customCVConfigurationTitle;
    }
    return { customVariantTitle };
};

/**
 * This function creates navigation params required to open selected structure
 * @param {Object} commandContext - commandContext of Open command.
 * @return {Object} Navigation params to open selected configurator objects.
 */
export let createNavigationParameters = async( commandContext ) => {
    let navigateToPageId;
    let contextUid;

    // If navigating from 'Where used tab' using 'open in new tab' for bulk selection
    // All the selected obejcts belongs to same context thus fetching context from 1st selected object
    if( commandContext.objectSetUri &&  _.get( commandContext, 'selectionModel.selectionData.selected.length' ) > 0 ) {
        //navigateToPage = 'Variants';
        navigateToPageId = 'tc_xrt_Overview';
        if( _.get( commandContext.selectionModel.selectionData.selected[0].props, 'REF(bl_parent,BOMLine).REF(bl_revision,ItemRevision).object_string' ) ) {
            contextUid = uwPropertyService.getSourceObjectUid( commandContext.selectionModel.selectionData.selected[0].props['REF(bl_parent,BOMLine).REF(bl_revision,ItemRevision).object_string'] );
        }
    }

    return {
        //navigateToPage: navigateToPage,
        navigateToPageId: navigateToPageId,
        contextUid :contextUid
    };
};

export let loadVMOs = ( selectionData, selectionModel ) => {
    let parentObjectsToLoad = [];
    let parentProperty = {};
    let parentUID = '';
    let parentObject = {};
    if( selectionData.selected && selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {
            parentProperty = selectionModel.selectionData.selected[ idx ].props[ 'REF(bl_parent,BOMLine).REF(bl_revision,ItemRevision).object_string' ];
            parentUID = uwPropertyService.getSourceObjectUid( parentProperty );
            parentObject = cdm.getObject( parentUID );
            if( parentObject === null ) {
                parentObjectsToLoad.push( parentUID );
            }
        }
        if( parentObjectsToLoad.length > 0 ) {
            return dataManagementSvc.loadObjects( parentObjectsToLoad ).then( function() {} );
        }
    }
};

export let updateSelectionData = ( selectionData, selectionModel ) => {
    let parentProperty = {};
    let parentUID = '';
    let parentObject = {};
    if( selectionData.selected && selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {
            parentProperty = selectionModel.selectionData.selected[ idx ].props[ 'REF(bl_parent,BOMLine).REF(bl_revision,ItemRevision).object_string' ];
            parentUID = uwPropertyService.getSourceObjectUid( parentProperty );
            parentObject = cdm.getObject( parentUID );
            tcViewModelObjectService.mergeObjects( selectionData.selected[ idx ], parentObject );
        }
    }
    return selectionData;
};

export let checkTopLineForConfigContext = ( occContext, data ) => {
    if( data.topLineCC ){
        return data.topLineCC;
    }

    let deferred = AwPromiseService.instance.defer();
    let topLineUID = '';
    if (occContext && occContext.topElement && occContext.topElement.props && occContext.topElement.props.awb0Archetype) {
        topLineUID = occContext.topElement.props.awb0Archetype.dbValues[0];
    }

    if (occContext && occContext.rootElement && occContext.rootElement && occContext.rootElement.props.awb0Archetype && topLineUID === ''){
        topLineUID = occContext.rootElement.props.awb0Archetype.dbValues[0];
    }

    if(topLineUID !== ''){
        var input = {
            objects: [{
                uid: topLineUID
            }]
        };
        soaService.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then(
            function( soaResponse ) {
                var values = Object.values( soaResponse.modelObjects );
                var itemObject = {};
                _.forEach( values, function( item ) {
                    if ( !_.isUndefined( item.props.items_tag ) && !_.isUndefined( item.props.items_tag.dbValues ) ) {
                        itemObject = {
                            uid: item.props.items_tag.dbValues[0]
                        };
                        return false; // this works as break in lodash.
                    }
                } );
                var input2 = {
                    objects: [itemObject],
                    attributes: [ 'Smc0HasVariantConfigContext' ]
                };
                soaService.post( 'Core-2006-03-DataManagement', 'getProperties', input2 ).then(
                    function( soaResponse2 ) {
                        var configContext = null;
                        _.forEach( Object.values( soaResponse2.modelObjects ), function( modelObjects ) {
                            if ( modelObjects.type === 'Cfg0ProductItem') {
                                configContext = modelObjects;
                                return false; // this works as break in lodash.
                            }
                        } );
                        deferred.resolve( configContext );
                    }
                );
            }
        );
        return deferred.promise;
    }
    return deferred.resolve( null );
};

/**
 * Variant Info Configuration service utility
 */
export default exports = {
    initialize,
    destroy,
    updatePartialCtx,
    getSVROwningItems,
    getVariantRulesToApply,
    getInitialVariantConfigurationData,
    initSVROwningItems,
    clearVariantConfigurationData,
    updateConfigItems,
    processSVROwningItems,
    fetchSubBOTypesForVariant,
    processVariantRules,
    evaluateStartIndexForVariantRuleDataProvider,
    showVariantTooltip,
    addNewVariantRule,
    updateVariantRule,
    selectVariantRule,
    updateCurrentVariantRule,
    publishAddNewVariantRuleEvent,
    applyVariantConfigChange,
    showCustomVariantPanel,
    populateListboxValues,
    mergeVmpAndDpMethod,
    getDpValuesMethod,
    populateCustomVariantTitle,
    createNavigationParameters,
    updateSelectionData,
    loadVMOs,
    checkTopLineForConfigContext
};
