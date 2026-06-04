// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/configuratorService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import pca0CommonUtils from 'js/pca0CommonUtils';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

var _optionGroups = null;
var _summaryGroup = null;
/*
 * Create group structure to display in view
 */
export let populateScopes = function( response ) {
    return configuratorUtils.populateScopes( response );
};

/**
 * Returns groups from SOA response
 *
 * @param {Object} response the response from the variant configuration SOA
 *
 * @returns {ObjectArray} The array of option groups to be displayed.
 */
export let getGroups = function( response ) {
    var context = appCtxSvc.getCtx( 'variantConfigContext' );

    //This is the case when user tries to switch to Guided mode with invalid configuration.
    //Server should not send any groups in the response
    if( response.responseInfo.isValid[ 0 ] === 'false' && response.allScopes.length === 0 ) {
        configuratorUtils.handleInvalidConfiguration( 'variantConfigContext' );
        pca0CommonUtils.processPartialErrors( response.ServiceData );
        this.showViolationsOnValidation( response.labels, response.responseInfo, response.payloadStrings );
    } else {
        // Populate option group structure
        var tmpScopes = this.populateScopes( response );

        // Update application context
        if( response.scopes.length !== 0 ) {
            context.currentScope = response.scopes[ 0 ];
        }
        context.configPerspective = response.configPerspective;
        context.payloadStrings = response.payloadStrings;
        context.selections = response.selections;

        if( context.guidedMode === undefined ) {
            context.guidedMode = true;
        }
        appCtxSvc.updateCtx( 'variantConfigContext', context );
        _optionGroups = tmpScopes;
    }

    // switch the mode to manual if response is invalid and the suggested mode to open panel is guided.
    if( response.responseInfo.isValid[ 0 ] === 'false' && context.guidedMode === true ) {
        eventBus.publish( 'awCustomVariantPanel.updateVariantMode', { stayInManualMode: true } );
    }
    //do not publish here as it is before the panel is rendered.(status before and after scroll will be the same).It has to be published after rendering, as json event
    //eventBus.publish("selectValue.complete", {});
    return _optionGroups;
};

export let getSelectionForVariantContext = function() {
    return pca0CommonUtils.getSelectionForVariantContext();
};

/**
 * Displays the error message when switching to guided mode from manual is not allowed.
 *
 * @param {data} data
 *
 */
export let showUnableToSwitchToGuidedModeMessage = function( data ) {
    configuratorUtils.showUnableToSwitchToGuidedModeMessage( data );
};

/**
 * Function to stay in manual mode.
 *
 */
export let stayInManualMode = function() {
    eventBus.publish( 'awCustomVariantPanel.updateVariantMode', { stayInManualMode: true } );
};

/**
 * Function to clear violation message.
 *
 */
export let cleanupViolationMessage = function( cntx ) {
    configuratorUtils.cleanupViolationMessage( cntx );
};

/**
 * Displays validation error message.
 *
 * @param {data} data
 * @param {context } cntx
 *
 */
export let showValidationErrorMessage = function( data, cntx ) {
    configuratorUtils.showValidationErrorMessage( data, cntx );
};

/**
 * Displays the violation message if validation is invoked in manual mode.
 *
 * @param {ObjectArray} labels - The violationLabels returned by SOA service which will be rendered on features
 * @param {Object} responseInfo - Additional information about response returned by SOA service
 * @param {String} payloadStrings -Map of <string,String[]> returned by SOA service
 *
 */
export let showViolationsOnValidation = function( labels, responseInfo, payloadStrings ) {
    let currentGroup;
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    currentGroup = context.currentScope;
    if( currentGroup !== undefined ) {
        for( var i = 0; i < _optionGroups.length; i++ ) {
            configuratorUtils.parseResponseAndExtractViolations( labels, _optionGroups[ i ].optGroup );
        }
        if( !_.isUndefined( responseInfo.validationErrorMessage ) ) {
            context.violationLabel = responseInfo.validationErrorMessage[ 0 ];
        } else {
            context.violationLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().noViolations;
        }
        context.payloadStrings = payloadStrings;
        appCtxSvc.updateCtx( 'variantConfigContext', context );
        eventBus.publish( 'awCustomVariantPanel.updateViolationIcon', {} );
    }
};


/**
 * This API returns initialVariantRule only when custom variant panel is being initialized
 *
 * @returns {String} initialVariantRule - Returns the currently active variant rule in custom variant panel
 */
export let getActiveVariantRules = function() {
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    if( context.customVariantPanelInitializing ) {
        delete context.customVariantPanelInitializing;
        return [ context.initialVariantRule ];
    }
    return null;
};

/**
 * This API returns current variant mode i.e. Guide/Manual
 * @param{Object} ctx - config context
 * @returns {String} variantMode - Returns the current variant mode i.e. Guide/Manual
 */
export let getConfigurationMode = function( ctx ) {
    return pca0CommonUtils.getConfigurationMode( ctx );
};

/**
 * Returns created variant rule from SOA response
 *
 * @param {Object} response the response from the variant configuration view SOA
 *
 * @returns {Object} Created variant rule.
 */
export let getCreatedVariantRule = function( response ) {
    return pca0CommonUtils.getCreatedVariantRule( response );
};

//Build summary group to show selected family values
export let buildSummary = function( response ) {
    var summaryGroup = {};
    summaryGroup.optGroup = response.selectionsSummary.internalName;
    summaryGroup.groupDisplayName = response.selectionsSummary.displayName;

    //Ensure we don't compare empty string with summary group name -
    // In case of invalid configuration, server doesn't populate any group information in SOA response
    if( response.scopes[ 0 ] !== '' && response.scopes.indexOf( response.selectionsSummary.internalName ) > -1 ) {
        summaryGroup.expand = true;
        // Update application context
        var context = appCtxSvc.getCtx( 'variantConfigContext' );
        context.currentScope = response.scopes[ 0 ];
        context.configPerspective = response.configPerspective;
        appCtxSvc.updateCtx( 'variantConfigContext', context );
    } else {
        summaryGroup.expand = false;
    }

    _summaryGroup = summaryGroup;

    return _summaryGroup;
};

//Build summary group to show selected family values
export let populateSelections = function( response ) {
    var selections = [];

    if( response.selectionsSummary.summaryOfSelections ) {
        for( var i = 0; i < response.selectionsSummary.summaryOfSelections.length; i++ ) {
            var summary = {};
            var selectionInfo = response.selectionsSummary.summaryOfSelections[ i ];
            summary.familyDisplayName = selectionInfo.familyDisplayName;
            summary.selectionState = selectionInfo.selectionState;
            summary.valueDisplayValue = selectionInfo.valueDisplayName;
            selections.push( summary );
        }
    }

    return selections;
};

// Before expanding summary, reset existing information
export let resetAndExpandSummaryInfo = function( data ) {
    if( data.selections && data.selections.length > 0 ) {
        data.selections = {};
    }
};

/**
 * This API creates context for package and navigates to package panel
 */
export let showPackagePanel = function( packageCommandContext ) {
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    var packageFamily = {
        familyStr: packageCommandContext.packageFamilyUID,
        singleSelect: packageCommandContext.singleSelect
    };

    //Take the backup of current selections before opening the package sub-panel
    var backupSelections = $.extend( true, [], context.selections );
    var packageContext = {
        currentPackage: packageCommandContext.packageValue,
        packageFamily: packageFamily,
        backupSelections: backupSelections,
        showSavePackageCommand: false
    };
    context.packageContext = packageContext;
    appCtxSvc.updateCtx( 'variantConfigContext', context );

    var packagePanelContext = {
        destPanelId: 'Pca0Package',
        title: packageCommandContext.packageValue.optValue.cellHeader1,
        recreatePanel: true
    };
    eventBus.publish( 'awPanel.navigate', packagePanelContext );
};

/**
 * This API cache the pre-panel id when we open the custom variant panel. This cached id will be used when we
 * click on configure button.
 *
 * @param {Object} data - The view model data
 */
export let cacheConfigurationViewId = function( data ) {
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    if( !context.configurationPanelId ) {
        context.configurationPanelId = data.previousView;
    }
};

/**
 * This method Control the configure Action based on save variant rule
 *
 */
export let handleConfigureAction = function() {
    var context = appCtxSvc.getCtx( 'variantConfigContext' );
    if( context.initialVariantRule && !context.variantRulePanelDirty ) {
        eventBus.publish( 'awCustomVariantPanel.handleConfigureAction', {
            conditionFlag: 'true'
        } );
    } else {
        eventBus.publish( 'awCustomVariantPanel.handleConfigureAction', {
            conditionFlag: 'false'
        } );
    }
};

export default exports = {
    populateScopes,
    getGroups,
    getSelectionForVariantContext,
    showUnableToSwitchToGuidedModeMessage,
    stayInManualMode,
    cleanupViolationMessage,
    showValidationErrorMessage,
    showViolationsOnValidation,
    getActiveVariantRules,
    getConfigurationMode,
    getCreatedVariantRule,
    buildSummary,
    populateSelections,
    resetAndExpandSummaryInfo,
    showPackagePanel,
    cacheConfigurationViewId,
    handleConfigureAction
};
