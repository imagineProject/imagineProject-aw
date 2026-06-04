// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Group Effectivity" cell command
 *
 * @module js/editGroupEffectivityCommandHandler
 */
import aceNestedNavigationPanelService from 'js/aceNestedNavigationPanelService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

export let getDateRangeEditContext = async function( vmo, nestedNavigationState, i18n ) {
    var effectivityList = vmo.props.Fnd0EffectivityList;
    await dmSvc.getProperties( effectivityList.dbValues, [ 'range_text', 'end_item', 'effectivity_dates' ] );
    var effectivity = cdm.getObjects( [ effectivityList.dbValues[0] ] );

    let startDateTime =  new Date( effectivity[0].props.effectivity_dates.dbValues[ 0 ] ).getTime();
    let endDateTime =  effectivity[0].props.effectivity_dates.dbValues[ 1 ]  ? new Date(  effectivity[0].props.effectivity_dates.dbValues[ 1 ] ).getTime() : '';
    let endDateOptions = effectivity[0].props.effectivity_dates.dbValues[ 1 ] ? 'Date' : effectivity[0].props.range_text.dbValues[ 0 ].indexOf( i18n.upTextForUnit ) > -1 ? 'UP' : 'SO';
    let endDateOptionsUiValue;

    if( endDateOptions === 'UP' ) {
        endDateOptionsUiValue = i18n.upText;
    } else if( endDateOptions === 'SO' ) {
        endDateOptionsUiValue = i18n.soText;
    } else {
        endDateOptionsUiValue = i18n.dateEffectivity;
    }

    var itemOrRevProp =  effectivity[0].props &&  effectivity[0].props.end_item;

    var editDateRangeStateValue = {
        endItemValForDateRange:{
            dbValue: itemOrRevProp.dbValues[ 0 ],
            uiValue:itemOrRevProp.uiValues[ 0 ]
        },
        nameBox:vmo.cellHeader1,
        startDateTime:startDateTime,
        endDateTime:endDateTime,
        endDateOptions:{
            dbValue:endDateOptions,
            uiValue:endDateOptionsUiValue
        },
        effectivity : vmo.props.Fnd0EffectivityList.dbValues[ 0 ],
        groupRevision : vmo.uid,
        groupRevisionType: vmo.type
    };
    aceNestedNavigationPanelService.updateSubPanelContextOfView( nestedNavigationState, 'editDateRangeState', editDateRangeStateValue );
};

/**
 * Execute the command.
 */
export let execute = function( vmo, subPanelContext, title ) {
    aceNestedNavigationPanelService.navigateToView( subPanelContext.nestedNavigationState, {
        panelId: 'EditUnitGroupEffectivity',
        title: title,
        additionalSubPanelContext: { vmo: vmo, shouldClosePanelOnApply: subPanelContext.shouldClosePanelOnApply }
    } );

    subPanelContext.nestedNavigationState.update( { views: subPanelContext.nestedNavigationState.getValue().views, nameBoxForEdit: vmo.cellHeader1 } );
};

/**
 * "Edit Group Effectivity" cell command handler factory
 *
 * @member editGroupEffectivityCommandHandler
 */
export default exports = {
    execute,
    getDateRangeEditContext
};
