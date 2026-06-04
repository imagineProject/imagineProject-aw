// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Effectivity" cell command
 *
 * @module js/editEffectivityCommandHandler
 */
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

export let populateEditEffectivityProperties = function( vmo, sharedData, upTextForUnit ) {
    var editEffectivityCtx = appCtxSvc.getCtx( 'editEffectivityContext' );
    var editEffectivityContext = editEffectivityCtx ? editEffectivityCtx : {};

    let sharedDataValue = { ...sharedData.getValue() };

    sharedDataValue.selectedCell.uid = vmo.uid;
    sharedDataValue.selectedCell.type = vmo.type;
    var uid = vmo.uid;
    var effProps = editEffectivityContext && editEffectivityContext.responseObjects && editEffectivityContext.responseObjects[uid].props;

    if( effProps && effProps.effectivity_dates.dbValues[ 0 ] ) {
        //edit date effectivity
        sharedDataValue = updateDateEffectivityDataOnState( sharedDataValue, effProps, upTextForUnit );
    } else {
        //edit unit effectivity
        sharedDataValue = updateUnitEffectivityDataOnState( sharedDataValue, effProps );
    }

    sharedDataValue.isProtected.dbValue = effProps && effProps.effectivity_protection.dbValues[ 0 ] === '1';
    sharedData.update( { ...sharedDataValue } );
};


let updateDateEffectivityDataOnState = function( sharedDataValue, effProps, upTextForUnit ) {
    sharedDataValue.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    sharedDataValue.nameBox.dbValue = effProps.effectivity_id.dbValues[ 0 ] ? effProps.effectivity_id.dbValues[ 0 ] : '';
    sharedDataValue.isShared.dbValue = Boolean( effProps.effectivity_id.dbValues[ 0 ] );
    sharedDataValue.startDate.dbValue = new Date( effProps.effectivity_dates.dbValues[ 0 ] ).getTime();
    sharedDataValue.endDate.dbValue = effProps.effectivity_dates.dbValues[ 1 ]  ? new Date( effProps.effectivity_dates.dbValues[ 1 ] ).getTime() : '';
    sharedDataValue.endDateOptions.dbValue = effProps.effectivity_dates.dbValues[ 1 ] ? 'Date' : effProps.range_text.dbValues[ 0 ].indexOf( upTextForUnit ) > -1 ? 'UP' : 'SO';
    if(  sharedDataValue.endDateOptions.dbValue === 'UP' ) {
        occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'upTextValue' );
    } else if(  sharedDataValue.endDateOptions.dbValue === 'SO' ) {
        occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'soTextValue' );
    } else {
        occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'dateEffectivity' );
    }
    var itemOrRevProp = effProps && effProps.end_item_rev.dbValues[ 0 ] ? effProps.end_item_rev : effProps && effProps.end_item;
    if( itemOrRevProp && itemOrRevProp.dbValues[0] ) {
        sharedDataValue.endItemValForDate.uiValue = itemOrRevProp.uiValues[ 0 ];
        sharedDataValue.endItemValForDate.dbValue = itemOrRevProp.uiValues[ 0 ];
        var item = cdm.getObject( itemOrRevProp.dbValues[0] );
        sharedDataValue.endItemValForDate.endItem = {
            type : item.type || '',
            uid : item.uid || '',
            dbValue : itemOrRevProp.uiValues[ 0 ]
        };
    }

    return sharedDataValue;
};

let updateUnitEffectivityDataOnState = function( sharedDataValue, effProps ) {
    sharedDataValue.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
    sharedDataValue.nameBoxForUnit.dbValue = effProps && effProps.effectivity_id.dbValues[ 0 ] ? effProps.effectivity_id.dbValues[ 0 ] : '';
    sharedDataValue.isSharedForUnit.dbValue = Boolean( effProps && effProps.effectivity_id.dbValues[ 0 ] );
    sharedDataValue.unitRangeText.dbValue = effProps && effProps.range_text.dbValues[ 0 ];
    var itemOrRevProp = effProps && effProps.end_item_rev.dbValues[ 0 ] ? effProps.end_item_rev : effProps && effProps.end_item;
    if( itemOrRevProp && itemOrRevProp.dbValues[0] ) {
        sharedDataValue.endItemVal.uiValue = itemOrRevProp.uiValues[ 0 ];
        sharedDataValue.endItemVal.dbValue = itemOrRevProp.uiValues[ 0 ];
        var item = cdm.getObject( itemOrRevProp.dbValues[0] );
        sharedDataValue.endItemVal.endItem = {
            type : item.type || '',
            uid : item.uid || '',
            dbValue : itemOrRevProp.uiValues[ 0 ]
        };
    }

    return sharedDataValue;
};

/**
 * Execute the command.
 */
export let execute = function( vmo ) {
    eventBus.publish( 'navigateToEditPanel', vmo );
};
/**
 * "Edit Effectivity" cell command handler factory
 *
 * @member editEffectivityCommandHandler
 */
export default exports = {
    execute,
    populateEditEffectivityProperties
};
