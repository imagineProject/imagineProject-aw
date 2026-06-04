// Copyright (c) 2022 Siemens

/**
 * @module js/filterSettingsService
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertySvc from 'js/uwPropertyService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

export let processGetPreferenceResponse = function( data, sharedData ) {
    if ( data.result && data.result.response.length > 0 ) {
        var initialToggleValue;
        var delayVmProp = uwPropertySvc.createViewModelProperty( '', data.i18n.delayFiltering, 'BOOLEAN', '',
            '' );
        uwPropertySvc.setPropertyLabelDisplay(  delayVmProp, 'PROPERTY_LABEL_AT_SIDE' );

        var initialIncludeToggleValue;
        var includeVmProp = uwPropertySvc.createViewModelProperty( '', data.i18n.includeWithChildrenFiltering, 'BOOLEAN', '',
            '' );
        uwPropertySvc.setPropertyLabelDisplay(  includeVmProp, 'PROPERTY_LABEL_AT_SIDE' );

        var delayPrefValue = data.result.response[0].values.values[0];
        if(  delayPrefValue.toUpperCase() === 'TRUE' ) {
            uwPropertySvc.setValue( delayVmProp,  false );
            initialToggleValue = false;
        } else {
            uwPropertySvc.setValue( delayVmProp, true );
            initialToggleValue = true;
        }

        var includePrefValue = data.result.response[1].values.values[0];
        if(  includePrefValue.toUpperCase() === 'TRUE' ) {
            uwPropertySvc.setValue( includeVmProp,  true );
            initialIncludeToggleValue = true;
        } else {
            uwPropertySvc.setValue( includeVmProp, false );
            initialIncludeToggleValue = false;
        }

        if( sharedData.enableFilterApply ) {
            uwPropertySvc.setIsEditable( delayVmProp, false );
            uwPropertySvc.setIsEnabled( delayVmProp, false );
        }else {
            uwPropertySvc.setIsEditable( delayVmProp, true );
            uwPropertySvc.setIsEnabled( delayVmProp, true );
        }

        uwPropertySvc.setIsEditable( includeVmProp, true );
        uwPropertySvc.setIsEnabled( includeVmProp, true );

        data.dispatch( { path: 'data.initialToggleValue', value: initialToggleValue } );
        data.dispatch( { path: 'data.initialIncludeToggleValue', value: initialIncludeToggleValue } );

        return { delayFiltering: delayVmProp, includeWithChildren: includeVmProp };
    }
};

export let retrieveGetPreferenceResponse = function( result ) {
    return result;
};

export let updateSelectElementIncludePreferenceOnContext = function( value ) {
    occmgmtUtils.updateValueOnCtxOrState( 'AWS_SelectElement_IncludeChildren', [ value ], 'preferences' );
};

export let updateDelayFilteringToggle = function(  toggle ) {
    //User preference is for delayed apply whereas the Settings panel for filter panel has option Auto-update
    // so we need to negate the value
    var delayedApplyUpdatedValue;
    if( toggle ) {
        delayedApplyUpdatedValue = 'false';
    }else{
        delayedApplyUpdatedValue = 'true';
    }
    return delayedApplyUpdatedValue;
};

export let updateIncludeWithChildrenToggle = function(  toggle ) {
    var includeWithChildrenUpdatedValue;
    if( toggle ) {
        includeWithChildrenUpdatedValue = 'true';
    }else{
        includeWithChildrenUpdatedValue = 'false';
    }
    return includeWithChildrenUpdatedValue;
};

export let updateSharedData = function(  activeViewSharedData, sharedData, nextActiveView, delayedApplyUpdatedValue, includeWithChildrenUpdatedValue ) {
    //User preference is for delayed apply whereas the Settings panel for filter panel has option Auto-update
    // so we need to negate the value
    var autoApply;
    if( delayedApplyUpdatedValue === 'false' ) {
        autoApply = true;
    }else  if( delayedApplyUpdatedValue === 'true' ) {
        autoApply = false;
    }
    occmgmtSubsetUtils.updateFilterTogglesOnSharedData( activeViewSharedData, sharedData, nextActiveView, autoApply, includeWithChildrenUpdatedValue );
};

export default exports = {
    processGetPreferenceResponse,
    updateDelayFilteringToggle,
    updateIncludeWithChildrenToggle,
    updateSharedData,
    retrieveGetPreferenceResponse,
    updateSelectElementIncludePreferenceOnContext
};
