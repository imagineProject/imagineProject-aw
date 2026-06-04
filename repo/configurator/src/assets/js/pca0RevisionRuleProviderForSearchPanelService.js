// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0LoadSavedVariants View
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0RevisionRuleProviderForSearchPanelService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

/**
 * Updates the selection on the drop down list based on <fscContext.revRule>
 * @param {UwDataProvider} dataProvider - RevisionRule data provider
 * @return {Boolean} true/false if an item in the dropdown was selected while loading
 */
export let selectRevisionRule = function( dataProvider ) {
    let itemSelectedOnLoad = false;
    if( !_.isEmpty( dataProvider.viewModelCollection.loadedVMObjects ) ) {
        var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
        var currentRevRule = fscContext.revRule;
        itemSelectedOnLoad = pca0CommonUtils.selectRevisionRuleDbValueInDropdown( dataProvider, currentRevRule );
    }
    return itemSelectedOnLoad;
};

/**
 * Updates the selection on the context when user makes a selection in the widget
 * This method is called also when loading dropdown and current revision rule is programmatically selected
 * Fire event to update parent VM information on current revision Rule
 * @param {Object} eventData - Event Data Info Container
 */
export let updateRevisionRule = function( eventData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var currentRevRule = fscContext.revRule;
    if( currentRevRule !== eventData.selectedObjects[ 0 ].props.object_name.dbValues[ 0 ] ) {
        var updatedRevRule = eventData.selectedObjects[ 0 ].props.object_name.dbValues[ 0 ];
        appCtxSvc.updatePartialCtx( 'fscContext.revRule', updatedRevRule );

        // Update Revision Rule data on parent view
        // Fire special event for Revision Rule: this will (re)initialize internal VM data
        const appliedRevisionRule = {
            dbValues: [ eventData.selectedObjects[ 0 ].props.object_name.dbValues[ 0 ] ],
            uiValues: [ eventData.selectedObjects[ 0 ].props.object_string.dbValues[ 0 ] ]
        };
        let eventDataToBePassed = {
            appliedRevisionRule: appliedRevisionRule,
            contextKey: Pca0Constants.FSC_CONTEXT
        };
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', eventDataToBePassed );
    }
};

/**
 * Dispatch changes for parent's atomic data shared between Search tabs
 * @param {Object} viewModel - The viewModel
 * @return {Object} VM property for selected RevisionRule
 */
export let updateParentComponent = function( viewModel ) {
    // Initialize View Model Object for Current Revision Rule
    // Properties are initialized from Context
    let selectedRevRule = viewModel.eventData.appliedRevisionRule;
    let currentRevisionRule = uwPropertyService.createViewModelProperty( selectedRevRule.dbValues[ 0 ],
        selectedRevRule.uiValues[ 0 ], 'STRING', selectedRevRule.dbValues[ 0 ], selectedRevRule.uiValues );
    currentRevisionRule.isEditable = true;

    // update the atomic data on highest parent component, that will send down the update
    let newData = { ...viewModel.subPanelContext.value };
    newData.revisionRule = currentRevisionRule;
    viewModel.subPanelContext.update && viewModel.subPanelContext.update( newData );

    return { currentRevisionRule };
};

export default exports = {
    selectRevisionRule,
    updateRevisionRule,
    updateParentComponent
};
