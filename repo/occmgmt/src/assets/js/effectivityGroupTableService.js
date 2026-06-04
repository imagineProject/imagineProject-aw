// Copyright (c) 2022 Siemens

/**
 * @module js/effectivityGroupTableService
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import unitEffConfigration from 'js/endItemUnitEffectivityConfigurationService';

var exports = {};

// This method is used in unit and date range EGO
export let getEffectivityGroupRevision = function( response ) {
    if(  response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }
    var newObject = response.output[ 0 ].objects[ 0 ];
    var effItem = cdm.getObject( newObject.uid );
    return cdm.getObject( effItem.props.revision_list.dbValues[ 0 ] );
};

// Used in both dateRange and Unit EGO
export let applyConfiguration = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

// Used only in dateRange
let getFormattedDate_timezoned = function( date ) {
    date = typeof date === 'number' || typeof date === 'string' ? new Date( date ) : date;
    var MM = date.getMonth() + 1;
    MM = MM < 10 ? '0' + MM : MM;
    var dd = date.getDate();
    dd = dd < 10 ? '0' + dd : dd;
    var hh = date.getHours();
    hh = hh < 10 ? '0' + hh : hh;
    var mm = date.getMinutes();
    mm = mm < 10 ? '0' + mm : mm;
    var ss = date.getSeconds();
    ss = ss < 10 ? '0' + ss : ss;
    return date.getFullYear() + '-' + MM + '-' + dd + 'T' + hh + ':' + mm + ':' + ss + date.toString().slice( 28, 33 );
};

// Used only in dateRange
export let getDateRange = function( data ) {
    let result = [];
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' || data.endDateOptions.dbValue === 'SO' ) {
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ) ];
        } else{
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ), getFormattedDate_timezoned( data.endDateTime.dbValue ) ];
        }
    }
    return result;
};

// Used only in dateRange
export let getOpenEndedStatus = function( data ) {
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' ) {
            return 1;
        } else if( data.endDateOptions.dbValue === 'SO' ) {
            return 2;
        }
        return 0;
    }
};

// Used only in dateRange
export let applyDateEffectivityGroups = function( data, selectedGroupEffectivities ) {
    selectedGroupEffectivities = selectedGroupEffectivities.length ? selectedGroupEffectivities : [ selectedGroupEffectivities ];
    let groupEffectivityUidArray = unitEffConfigration.getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

// Used only in dateRange
export let getEffComponent = ( data )=>{
    var obj = cdm.getObject( data.effectivity );
    return {
        uid: data.effectivity,
        type: obj.type
    };
};

export let updateFieldValuesFromState = function( nestedNavigationState, i18n ) {
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };

    return{
        endItemValueDbValue :  nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.endItemValForDateRange.dbValue : '',
        endItemValueUiValue : nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.endItemValForDateRange.uiValue : '',
        nameBox:nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.nameBox : '',
        startDateTime: nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.startDateTime : '',
        endDateTime:nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.endDateTime : '',
        endDateOptionsDbValue:nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.endDateOptions.dbValue : 'Date',
        endDateOptionsUiValue:nestedNavigationStateValue.dateRangeState ? nestedNavigationStateValue.dateRangeState.endDateOptions.uiValue : i18n.dateEffectivity
    };
};

export let updateEndItemForDateRange = function( eventData, endItemValForDateRange ) {
    var selectedObject = null;
    if( eventData.eventDataValue && eventData.eventDataValue.scope.addPanelState.sourceObjects.length !== 0 ) {
        selectedObject = eventData.eventDataValue.scope.addPanelState.sourceObjects[0];
    }

    let endItemValue = _.cloneDeep( endItemValForDateRange );

    if( selectedObject ) {
        let selectedEndItemDisplayName = selectedObject.cellHeader2 + '-' + selectedObject.cellHeader1;
        endItemValue.dbValue =  selectedObject.props.items_tag && selectedObject.props.items_tag.dbValues[0] || selectedObject.uid;
        endItemValue.uiValue =  selectedEndItemDisplayName;
    }
    return{
        endItemValuedbValue : endItemValue.dbValue,
        endItemValueuiValue : endItemValue.uiValue
    };
};

export let removeEndItemValue = function(  ) {
    return{
        endItemValueDbValue :  '',
        endItemValueUiValue : ''
    };
};

// this method based on the eventData/cm0GlobalChangeContext value
// returns that ECN Header Warning should be shown or not
// true - ECN Header Warning will be shown
// false - ECN Header Warning will not be shown
export let getShowEcnHeaderWarningVal = ( eventData ) => {
    // case : event "aw.updateOccContextValueAfterActiveEcnChanged" is triggered from ACE/SPLIT/CBA view
    if( eventData ) {
        return eventData.selectedEcn === '';
    }
    // case : when change context is done from Changes View and Active ECN will be stamped in userSession
    let selectedECN = appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext.value;
    // case : when no Active Change is selected then the value will be null
    if( !selectedECN ) {
        return true;
    }
    return selectedECN === '';
};


export default exports = {
    getEffectivityGroupRevision,
    applyConfiguration,
    getDateRange,
    getOpenEndedStatus,
    applyDateEffectivityGroups,
    getEffComponent,
    updateFieldValuesFromState,
    updateEndItemForDateRange,
    removeEndItemValue,
    getShowEcnHeaderWarningVal
};
