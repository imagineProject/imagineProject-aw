// Copyright (c) 2022 Siemens

/**
 * @module js/classicVariantService
 */
import appCtxService from 'js/appCtxService';
import addObjectUtils from 'js/addObjectUtils';
import viewModelObjectService from 'js/viewModelObjectService';
import modelPropertyService from 'js/modelPropertyService';
import adapterSvc from 'js/adapterService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

export let processGetClassicVariantsResponse = function( response, occContext ) {
    var isConfigure = appCtxService.getCtx( 'classicCfgContext.isConfigure' );
    if( isConfigure ) {
        appCtxService.updatePartialCtx( 'classicCfgContext.isConfigure', false );
    }

    if( !response ) {
        return response;
    }
    if( response.ServiceData && response.ServiceData.partialErrors ) {
        return null;
    }
    var variantContent = response.variantContent;
    var configContext = {
        optionList: [],
        isSavePanelDirty: appCtxService.getCtx( 'classicCfgContext.isSavePanelDirty' )
    };
    configContext.svr = variantContent.variantRule.uid;
    _.each( variantContent.variantOptionValueEntry, function( variantData ) {
        let label = variantData.optionName;
        if(variantData.optionDesc !== "")
        {
            label += "-" + variantData.optionDesc;
        }
        var tmpOption = {
            displayName: label,
            type: 'STRING',
            parentUid: variantData.optionUID,
            owningItemUID: variantData.owningItemUID,
            labelPosition: 'PROPERTY_LABEL_AT_TOP',
            hasLov: true
        };
        var property = modelPropertyService.createViewModelProperty( tmpOption );
        configContext.optionList.push( property );
        var optionValuesList = [];
        var emptyValue = {
            propDisplayValue: '',
            propInternalValue: '',
            uid: variantData.optionUID,
            owningItemUID: variantData.owningItemUID,
            howset: 0,
            type: 'STRING',
            sel: false
        };
        optionValuesList.push( emptyValue );
        _.each( variantData.variantOptionValue, function( optionValues ) {
            var tmpOptionValue = {
                propDisplayValue: optionValues.optionValue,
                propInternalValue: optionValues.optionValue,
                uid: variantData.optionUID,
                owningItemUID: variantData.owningItemUID,
                howset: optionValues.howset,
                type: 'STRING',
                sel: false
            };
            if( optionValues.howset > 1 ) {
                property.dbValue = optionValues.optionValue;
                tmpOptionValue.sel = true;
            }
            optionValuesList.push( tmpOptionValue );
        } );
        property.listValues = optionValuesList;
    } );
    appCtxService.updatePartialCtx( 'classicCfgContext', configContext );
    eventBus.publish( 'awConfigPanel.update' );
    if( configContext && !configContext.hasRootModifyAccess ) {
        var topProduct = occContext.topElement;
        var objectsToBeAdapted = [];
        objectsToBeAdapted.push( topProduct );
        return adapterSvc.getAdaptedObjects( objectsToBeAdapted ).then( function( adaptedObjs ) {
            if( adaptedObjs && adaptedObjs.length > 0 ) {
                var flag = adaptedObjs[ 0 ].props.is_modifiable;
                appCtxService.updatePartialCtx( 'classicCfgContext.hasRootModifyAccess', flag.dbValues[ 0 ] );
            }
        } );
    }

    return configContext;
};

export let fetchSVRUid = function( initialVariantRule, classicCfgContext ) {
    // If user has created a new variant rule, the newSVR will be true and we need to
    // return the new variant rule UID value for configure
    if( classicCfgContext.newSVR && classicCfgContext.newSVR === true ) {
        return initialVariantRule.uid;
    }
    // If user invoked configure on an already applied SVR, this value will be part of svr of classiCfgContext
    return classicCfgContext.svr;
};

export let fetchSaveFlag = function( classicCfgContext ) {
    if( classicCfgContext.newSVR && classicCfgContext.newSVR === true ) {
        return true;
    }
    return false;
};

export let fetchSelectedOptions = function( configContext ) {
    var variantOptionValueEntry = [];
    var allOptionsClean = true;

    //If any of the options have been modified by the user, include only the modified options
    //If all the options are unchanged, include everything except for the derived options(howset = 2)
    _.each( configContext.optionList, function( optionData ) {
        if( optionData.valueUpdated ) {
            allOptionsClean = false;
            return false;
        }
    } );
    _.each( configContext.optionList, function( optionData ) {
        if( allOptionsClean || optionData.valueUpdated ) {
            var variantOption = {};
            variantOption.optionName = optionData.propertyName;
            variantOption.optionDesc = '';
            var includeOption = true;
            variantOption.variantOptionValue = [];
            _.each( optionData.listValues, function( optionValues ) {
                var valueData = {};
                if( optionData.dbValue === optionValues.propDisplayValue || (optionData.dbValue === null && optionValues.propDisplayValue === "")) {
                    valueData.optionValue = optionValues.propDisplayValue;
                    variantOption.optionUID = optionValues.uid;
                    variantOption.owningItemUID = optionValues.owningItemUID;
                    if( optionData.dbValue === '' || optionData.dbValue === null ) {
                        valueData.howset = -1;
                    } else if ( optionData.valueUpdated ) {
                        valueData.howset = 4;
                    } else if( optionValues.howset === 2 ) {
                        includeOption = false;
                    } else {
                        valueData.howset = optionValues.howset;
                    }
                    variantOption.variantOptionValue.push( valueData );
                }
            } );
            if( includeOption ) {
                variantOptionValueEntry.push( variantOption );
            }
        }
    } );
    return variantOptionValueEntry;
};

export let processSetClassicVariantsResponse = function( response ) {
    if( response.ServiceData && response.ServiceData.partialErrors ) {
        return null;
    }

    var variantConfigContext = appCtxService.getCtx( 'variantConfigContext' );
    variantConfigContext.customVariantRule = {
        uid: response.variantContent.variantRule.uid
    };
    appCtxService.updatePartialCtx( 'variantConfigContext', variantConfigContext );

    // trigger the event for refresh
    eventBus.publish( 'variantConfiguratorPanel.configureWithCustomVariantRule' );
    return response;
};

export let selectiveConfigureAction = function( classicCfgContext ) {
    appCtxService.updatePartialCtx( 'classicCfgContext.isConfigure', true );
    if( classicCfgContext.newSVR && classicCfgContext.newSVR === true ) {
        eventBus.publish( 'variantConfiguratorPanel.configureWithCustomVariantRule' );
    } else {
        eventBus.publish( 'ClassicVariants.invokeCVUpdateAndConfigureAction' );
    }
};

export let processSaveClassicVariantResponse = function( response ) {
    if( response.ServiceData && response.ServiceData.partialErrors ) {
        return null;
    }

    var vmo = viewModelObjectService.createViewModelObject( response.variantContent.variantRule.uid );
    var varContext = appCtxService.getCtx( 'variantConfigContext' );
    varContext.initialVariantRule = vmo;
    varContext.customVariantRule = {
        uid: response.variantContent.variantRule.uid
    };
    appCtxService.updatePartialCtx( 'variantConfigContext', varContext );
    var classicContext = appCtxService.getCtx( 'classicCfgContext' );
    classicContext.svr = vmo.uid;
    appCtxService.updatePartialCtx( 'classicCfgContext', classicContext );
};


export let clearDataProviderCache = function() {
    eventBus.publish( 'awConfigPanel.newVariantRuleCreated' );
    // When user creates a new SVR, data provider cache is cleared so set the newSVR flag to true
    // This will be used for configure
    appCtxService.updatePartialCtx( 'classicCfgContext.newSVR', true );
};

export let updateVisibilityOfSaveCommand = function( inputData ) {
    var classicCfgContext = appCtxService.getCtx( 'classicCfgContext' );

    //Process updated LOV and add it to ctx
    _.each( classicCfgContext.optionList, function( optionData ) {
        if( optionData.propertyDisplayName === inputData.propertyDisplayName ) {
            optionData.dbValue = inputData.dbValue;
            optionData.valueUpdated = inputData.valueUpdated;
        }
    } );
    appCtxService.updatePartialCtx( 'classicCfgContext.optionList', classicCfgContext.optionList );

    // If the flag is already set to dirty, then no need to process
    if( !classicCfgContext.isSavePanelDirty ) {
        var isDirty = false;
        if( inputData.valueUpdated ) {
            isDirty = inputData.valueUpdated;
        }
        appCtxService.updatePartialCtx( 'classicCfgContext.isSavePanelDirty', isDirty );
    }
};

export let fetchVariantRuleName = function( data, editHandler ) {
    let objCreateInfo = addObjectUtils.getObjCreateInfo( { dbValue: 'VariantRule' } );
    let vRuleName = '';
    _.each( objCreateInfo.props, function( props ) {
        if (props.propertyName === 'object_name'){
            vRuleName = props.dbValue;
        }
    } );
    return vRuleName;
};

export default exports = {
    processGetClassicVariantsResponse,
    fetchSVRUid,
    fetchSaveFlag,
    fetchSelectedOptions,
    processSetClassicVariantsResponse,
    selectiveConfigureAction,
    processSaveClassicVariantResponse,
    clearDataProviderCache,
    updateVisibilityOfSaveCommand,
    fetchVariantRuleName
};
