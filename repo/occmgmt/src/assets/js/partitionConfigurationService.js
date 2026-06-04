// Copyright (c) 2022 Siemens

/**
 * A service that manages the 4G specific sections displayed in the ACE configuration panel.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/partitionConfigurationService
 */
import _ from 'lodash';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import tcVmoSvc from 'js/tcViewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};

/**
 * Create and get a view model property based on the current organization scheme property stored on product
 * context info.
 *
 * @param {Object} productContextInfo: PCI
 * @return {Object} Property current organization scheme view model property
 */
var getOrganizationSchemeAsVMProperty = function( productContextInfo ) {
    var vmProperty = null;
    if( productContextInfo.props.fgf0PartitionScheme ) {
        vmProperty = uwPropertyService.createViewModelProperty(
            productContextInfo.props.fgf0PartitionScheme.dbValues[ 0 ],
            productContextInfo.props.fgf0PartitionScheme.uiValues[ 0 ], 'STRING',
            productContextInfo.props.fgf0PartitionScheme.dbValues[ 0 ], '' );
        vmProperty.uiValue = productContextInfo.props.fgf0PartitionScheme.uiValues[ 0 ];
    }
    return vmProperty;
};

export let getNoneOptionDisplayName = function() {
    var resource = 'Occmgmt4GFMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    return localTextBundle.FgfNone;
};

/**
 * get partition scheme from PCI object
 */
var getPartitionSchemeFromProductContextInfo = function( productContextInfo ) {
    if( productContextInfo ) {
        var currentPartitionScheme = productContextInfo.props.fgf0PartitionScheme;
        if( currentPartitionScheme && currentPartitionScheme.dbValues &&
            currentPartitionScheme.dbValues.length > 0 ) {
            return getOrganizationSchemeAsVMProperty( productContextInfo );
        }
    }
    return null;
};

/**
 * method to get partition Scheme
 */
var populatePartitionSchemes = function( productContextInfo ) {
    var currentPartitionScheme = getPartitionSchemeFromProductContextInfo( productContextInfo );
    if( currentPartitionScheme === null || !currentPartitionScheme.uiValue ) {
        var noneDisplayName = exports.getNoneOptionDisplayName();
        currentPartitionScheme = uwPropertyService.createViewModelProperty( '', noneDisplayName, 'STRING', '', '' );
        currentPartitionScheme.uiValue = noneDisplayName;
        currentPartitionScheme.ruleIndex = 0;
    }

    return currentPartitionScheme;
};

/**
 * Clear dataprovider content.
 */
var clearDataProviderContent = function( dataProvider ) {
    if( dataProvider ) {
        dataProvider.viewModelCollection.clear();
        dataProvider.selectionModel.selectedObjects = [];
    }
};

/**
 * Get current application model from PCI and set it on currentApplicationModel. When selected object belongs to
 * a different application model, clear dataProvider content.
 */
var populateCurrentApplicationModel = function( data, productContextInfo ) {
    var newApplicationModel;
    if( productContextInfo && productContextInfo.props && productContextInfo.props.awb0Product &&
        productContextInfo.props.awb0Product.dbValues ) {
        newApplicationModel = productContextInfo.props.awb0Product.dbValues[ 0 ];
        if( data.currentApplicationModel !== newApplicationModel && data.dataProviders &&
            data.dataProviders.getOrganizationSchemes &&
            data.dataProviders.getOrganizationSchemes.viewModelCollection &&
            data.dataProviders.getOrganizationSchemes.viewModelCollection.loadedVMObjects.length > 0 ) {
            clearDataProviderContent( data.dataProviders.getOrganizationSchemes );
        }
    }
    return newApplicationModel;
};

/**
 * Function to get the Occurrence Scheme information as ViewModelProperty from the product context info
 *
 * @return (Void)
 */
export let getOrganizationSchemeInfo = function( data ) {
    if( data ) {
        var valuesFromPCI = {
            currentOrganizationScheme: null,
            currentApplicationModel: null
        };
        var productContextInfo = data.subPanelContext.occContext.productContextInfo;
        if( productContextInfo ) {
            valuesFromPCI.currentApplicationModel = populateCurrentApplicationModel( data, productContextInfo );
            valuesFromPCI.currentOrganizationScheme = populatePartitionSchemes( productContextInfo );
        }
    }
    return valuesFromPCI;
};

/**
 * process perfromSearch SOA response containing list of partition scheme VMOs. Add 'None' option in the
 * beginning of the schemes list when Fgf0NoOrganizationSchemeFeature is supported
 */
export let processOrganizationSchemesResp = function( response, data ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    var organizationSchemes = [];

    if( response.searchResults ) {
        organizationSchemes = response.searchResults;
    }

    // Add 'None' only when Fgf0NoOrganizationSchemeFeature is supported
    if( data.contextKeyObject && data.contextKeyObject.supportedFeatures.Fgf0NoOrganizationSchemeFeature ) {
        var noneDisplayName = exports.getNoneOptionDisplayName();
        var noneScheme = tcVmoSvc.createViewModelObjectById( 'noneObject' );
        noneScheme.props = {
            object_string: {
                dbValue: noneDisplayName
            }
        };
        //Add 'No Scheme" option and increase totalFound count
        organizationSchemes.splice( 0, 0, noneScheme );
        response.totalFound += 1;
    }
    return organizationSchemes;
};
/**
 * Adds 'None' option to source context list.
 *
 * @return (Object) - The search results for source contexts.
 */
export let addNoneOptionToResults = function( response ) {
    if( !response.searchResults ) {
        response.searchResults = [];
    }

    if( response.totalLoaded <= 20 ) {
        var noneDisplayName = exports.getNoneOptionDisplayName();

        var noneOption = tcVmoSvc.createViewModelObjectById( 'noneObject' );
        noneOption.props = {
            object_name: {
                dbValue: noneDisplayName
            }
        };

        // Add 'None' option to search results
        response.searchResults.splice( 0, 0, noneOption );
        response.totalFound++;
    }

    return response.searchResults;
};

export let evaluateStartIndexForSourceContextDataProvider = function( data ) {
    if( data.dataProviders.getSourceContexts.startIndex === 0 ) {
        return 0;
    }

    if( data.dataProviders.getSourceContexts.viewModelCollection.loadedVMObjects &&
        data.dataProviders.getSourceContexts.viewModelCollection.loadedVMObjects.length > 0 ) {
        return data.dataProviders.getSourceContexts.viewModelCollection.loadedVMObjects.length - 1;
    }
};

let _partitionProps = [
    {
        name: 'awb0CsidPath',
        modifiers: [ {
            name: 'excludeUiValues',
            Value: 'true'
        } ]
    }
];
const partitionPropertyHandler = {
    key: 'partitionProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        aceTreeTableDataService.updateOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0Element', _partitionProps );
    },
    condition: ( occContext ) => {
        if( !_.isUndefined( occContext.productContextInfo ) && !_.isUndefined( occContext.productContextInfo.props ) && !_.isUndefined( occContext.productContextInfo.props.fgf0PartitionScheme )
        && occContext.productContextInfo.props.fgf0PartitionScheme.dbValues[0] !== null && occContext.productContextInfo.props.fgf0PartitionScheme.isNulls === undefined &&
        !_.isUndefined( occContext.supportedFeatures ) && _.isUndefined( occContext.supportedFeatures['4GStructureFeature'] )
        || occContext.openedObjectType === 'WorksetRevision'
        ||  !_.isUndefined( occContext.supportedFeatures ) && _.isUndefined( occContext.supportedFeatures['4GStructureFeature'] ) && !_.isUndefined( occContext.configContext ) && !_.isUndefined( occContext.configContext.org_uid ) ) {
            return true;
        } else if( !_.isUndefined( occContext.currentState ) && !_.isUndefined( occContext.currentState.c_uid ) && !_.isUndefined( occContext.currentState.h_uid )
            && occContext.currentState.c_uid !== occContext.currentState.h_uid ) {
            // This is mostly Browser Refresh usecase,
            // We need awb0CsidPath prop to compute occThreadChain for h_uid and c_uid objects
            return true;
        }
        return false;
    }
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenProperties = function( ) {
    aceTreeTableDataService.registerOverriddenPropertyPolicyHandler( partitionPropertyHandler );
};

/**
 * Updates the occurrence management context with the change toggle state.
 *
 * @param {string} changeToggleState - The state of the change toggle, 'true' if change is enabled, otherwise 'false'.
 */
export let updateCtxWithShowChangeValue = function( changeToggleState ) {
    // Retrieve the active context key from the application context service
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;

    // Update the partial context to set the 'isChangeEnabled' property based on the changeToggleState
    appCtxSvc.updatePartialCtx( contextKey + '.isChangeEnabled', changeToggleState === 'true' );

    // Update the context to set the 'isRedLineMode' property based on the changeToggleState
    appCtxSvc.updateCtx( 'isRedLineMode', changeToggleState );

    // Update the partial context to set the 'showChange' property based on the changeToggleState
    appCtxSvc.updatePartialCtx( 'showChange', changeToggleState === 'true' );
};

export default exports = {
    getOrganizationSchemeAsVMProperty,
    getNoneOptionDisplayName,
    getPartitionSchemeFromProductContextInfo,
    populatePartitionSchemes,
    getOrganizationSchemeInfo,
    processOrganizationSchemesResp,
    populateCurrentApplicationModel,
    addNoneOptionToResults,
    clearDataProviderContent,
    evaluateStartIndexForSourceContextDataProvider,
    registerHandlerForOverriddenProperties,
    updateCtxWithShowChangeValue
};
