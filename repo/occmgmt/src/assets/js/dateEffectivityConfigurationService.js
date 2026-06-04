// Copyright (c) 2022 Siemens

/**
 * @module js/dateEffectivityConfigurationService
 */
import AwFilterService from 'js/awFilterService';
import uwPropertyService from 'js/uwPropertyService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import uwDirectiveDateTimeSvc from 'js/uwDirectiveDateTimeService';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import unitEffConfigration from 'js/endItemUnitEffectivityConfigurationService';
import viewModelObjectService from 'js/viewModelObjectService';
import dmSvc from 'soa/dataManagementService';
import localeService from 'js/localeService';

var exports = {};
var _defaultDate = null;

var DEFAULT_DATE = '0001-01-01T00:00:00+00:00';

var populateSupportedFeaturesInfo = function( occContext ) {
    return occContext.supportedFeatures.Awb0DateEffectivityConfigFeature;
};

var populateReadOnlyFeaturesInfo = function( occContext ) {
    return occContext.readOnlyFeatures.Awb0DateEffectivityConfigFeature;
};

var convertEffectiveDateIntoVMProperty = function( productContextInfoModelObject, dateTimeInfo ) {
    var effectiveDateVMProperty = uwPropertyService.createViewModelProperty(
        productContextInfoModelObject.props.awb0EffDate.dbValues[ 0 ],
        productContextInfoModelObject.props.awb0EffDate.uiValues[ 0 ], 'STRING',
        productContextInfoModelObject.props.awb0EffDate.dbValues[ 0 ], '' );
    effectiveDateVMProperty.uiValue = AwFilterService.instance( 'date' )( productContextInfoModelObject.props.awb0EffDate.uiValues[ 0 ], dateTimeInfo.dateTimeFormat );
    return effectiveDateVMProperty;
};

var getEffectiveDateFromProductContextInfo = function( dateTimeInfo, productContextInfo ) {
    return convertEffectiveDateIntoVMProperty( productContextInfo, dateTimeInfo );
};

var getRevRuleFromProductContextInfo = function( productContextInfo ) {
    return productContextInfo.props.awb0CurrentRevRule;
};

var convertRevisionRuleEffectiveDateIntoVMProperty = function( revisionRuleModelObject, dateTimeInfo ) {
    if( revisionRuleModelObject.props.rule_date ) {
        var effectiveDateVMProperty = uwPropertyService.createViewModelProperty(
            revisionRuleModelObject.props.rule_date.dbValues[ 0 ],
            revisionRuleModelObject.props.rule_date.uiValues[ 0 ], 'STRING',
            revisionRuleModelObject.props.rule_date.dbValues[ 0 ], '' );
        effectiveDateVMProperty.uiValue = AwFilterService.instance( 'date' )( revisionRuleModelObject.props.rule_date.uiValues[ 0 ], dateTimeInfo.dateTimeFormat );
        return effectiveDateVMProperty;
    }
};

var getEffectiveDateFromRevisionRule = function( currentRevisionRule, dateTimeInfo ) {
    if( currentRevisionRule ) {
        var currentRevisionRuleModelObject = cdm.getObject( currentRevisionRule.dbValues );
        if( currentRevisionRuleModelObject ) {
            return convertRevisionRuleEffectiveDateIntoVMProperty( currentRevisionRuleModelObject, dateTimeInfo );
        }
    }
};

var getDefaultEffectiveDate = function( data ) {
    if( data ) {
        return _.clone( data.occurrenceManagementTodayTitle, true );
    }
};

// used Regular Expressions to differentiate date EGO and unit EGO
// [0-9] will look for numbers 0-9 and can be repetitive
// + indicates occurrences of [0-9] should be 1 or more
// (...)? indicates it is not mandatory but if it exist
// then it should have UP or SO or [0-9]
// * indicates occurrences should be 0 or more
export var isDateEffectivity = function( inputString ) {
    let effString = inputString.split( '\\:' )[1];
    if( effString.length === 0 ) {
        //Empty Effectivity will not be considered as a date effectivity
        return false;
    }
    let occurrenceEffectivityResource = 'OccurrenceEffectivityConstants';
    let occurrenceEffectivityBundle = localeService.getLoadedText( occurrenceEffectivityResource );
    let upText = occurrenceEffectivityBundle.upTextForUnit;
    let soText = occurrenceEffectivityBundle.soTextForUnit;
    let unitRegex = new RegExp( '([0-9]' + '+(-(' + ( upText + '|' + soText ) + '|[0-9]+))' + '?)' );
    let concreteReg = '\\\\:(' + unitRegex + ', )*' + unitRegex + ' \\(';
    concreteReg = concreteReg.replace( /\//g, '' );
    let output = inputString.match( concreteReg );
    return output ? output.length === 0 : true;
};

export var getDateEffectivityGroups = function( occContext ) {
    let productContextInfoModelObject = occContext.productContextInfo;
    if( productContextInfoModelObject ) {
        let egos = productContextInfoModelObject.props.awb0EffectivityGroups;
        return egos && egos.dbValues.length > 0 ? egos.dbValues.filter( e=>{
            let effString = cdm.getObject( e ).props.awp0CellProperties.dbValues[1];
            return isDateEffectivity( effString );
        } ) : [];
    }
};

var getDateEffectivityGroupsFromProductContextInfo = function( data ) {
    if( data.subPanelContext.occContext.productContextInfo ) {
        let dateEgos = getDateEffectivityGroups( data.subPanelContext.occContext );

        if( dateEgos && dateEgos.length > 0 ) {
            var effectivityGroupVMProperty;
            if( dateEgos.length > 1 ) {
                effectivityGroupVMProperty = uwPropertyService.createViewModelProperty( data.multipleGroups, data.multipleGroups, 'STRING', '', '' );
                effectivityGroupVMProperty.uiValue = data.multipleGroups.uiValue;
            } else {
                var groupName = '';
                effectivityGroupVMProperty = uwPropertyService.createViewModelProperty(
                    dateEgos[ 0 ],
                    '', 'STRING',
                    dateEgos[ 0 ], '' );

                var groupItemRev = cdm.getObject( dateEgos[ 0 ] );
                groupName = groupItemRev.props.object_name.uiValues[ 0 ];

                effectivityGroupVMProperty.uiValue = groupName;
            }
            return effectivityGroupVMProperty;
        }
    }
};

var populateEffectiveDate = function( data, dateTimeInfo, occContext ) {
    var currentEffectiveDate = getDateEffectivityGroupsFromProductContextInfo( data );
    if( !currentEffectiveDate || !currentEffectiveDate.uiValue ) {
        var productContextInfo = occContext.productContextInfo;
        currentEffectiveDate = getEffectiveDateFromProductContextInfo( dateTimeInfo, productContextInfo );
        if( !currentEffectiveDate || !currentEffectiveDate.uiValue ) {
            var currentRevisionRule = getRevRuleFromProductContextInfo( productContextInfo );
            currentEffectiveDate = getEffectiveDateFromRevisionRule( currentRevisionRule, dateTimeInfo );
            if( !currentEffectiveDate || !currentEffectiveDate.uiValue ) {
                currentEffectiveDate = getDefaultEffectiveDate( data );
            }
        }
    }
    if( currentEffectiveDate ) {
        currentEffectiveDate.isEditable = true;
    }
    return currentEffectiveDate;
};

var clearDataProvider = function( data ) {
    if( data && data.dataProviders && data.dataProviders.getPreferredDateEffectivities ) {
        data.dataProviders.getPreferredDateEffectivities.viewModelCollection.clear();
        data.dataProviders.getPreferredDateEffectivities.selectedObjects = [];
    }
};

var populateProductContextInfo = function( contextInfo ) {
    return contextInfo.productContextInfo;
};

var populateEffectivityDateTimeVisibilityAndFormat = function( data, occContext ) {
    var timeEnabled = occContext && occContext.productContextInfo.props.awb0EffDate.propertyDescriptor.constantsMap.timeEnabled;
    var isTimeEnabled = timeEnabled && timeEnabled === '1';
    var dateTimeFormat = data.isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();
    return { isTimeEnabled: isTimeEnabled, dateTimeFormat: dateTimeFormat };
};

/**
  * Initialize the Date Effectivity Configuration Section
  */
export let getInitialDateEffectivityConfigurationData = function( data, occContext ) {
    if( occContext ) {
        uwDirectiveDateTimeSvc.assureDateTimeLocale();
        clearDataProvider( data );
        if( data.occurrenceManagementTodayTitle ) {
            _defaultDate = data.occurrenceManagementTodayTitle.uiValue;
        }
        var productContextInfo = populateProductContextInfo( occContext );
        if( productContextInfo ) {
            var isEffectiveDateFeatureSupported = populateSupportedFeaturesInfo( occContext );
            var isEffectiveDateFeatureReadOnly = occContext.readOnlyFeatures ? populateReadOnlyFeaturesInfo( occContext ) : false;
            var dateTimeInfo = populateEffectivityDateTimeVisibilityAndFormat( data, occContext );
            const currentEffectiveDate = populateEffectiveDate( data, dateTimeInfo, occContext );
            return { currentEffectiveDate: currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled,
                dateTimeFormat: dateTimeInfo.dateTimeFormat, isEffectiveDateFeatureSupported: isEffectiveDateFeatureSupported, isEffectiveDateFeatureReadOnly: isEffectiveDateFeatureReadOnly };
        }
    } else {
        var dateTimeInfo = populateEffectivityDateTimeVisibilityFormatFromRevisionRule( data );
        var currentEffectiveDate = data.currentEffectiveDate;
        return { currentEffectiveDate: currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled, dateTimeFormat: dateTimeInfo.dateTimeFormat };
    }
};

/**
  * populate the effectivity DateTime visibility format from the RevisionRule
  */
let populateEffectivityDateTimeVisibilityFormatFromRevisionRule = function( data ) {
    var objModelType = cmm.getType( 'RevisionRule' );
    if( objModelType !== null ) {
        var propDescriptor = objModelType.propertyDescriptorsMap.rule_date;
        if( !_.isUndefined( propDescriptor ) ) {
            var propConstantMap = propDescriptor.constantsMap;
            var timeEnabled = propConstantMap.timeEnabled;
            if( timeEnabled !== null ) {
                var isTimeEnabled = timeEnabled && timeEnabled === '1';
                var dateTimeFormat = data.isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();
                return { isTimeEnabled: isTimeEnabled, dateTimeFormat: dateTimeFormat };
            }
        }
    }
};

var addDefaultDateToPreferredDateEffectivities = function( dateEffectivities, data ) {
    var today = {
        date: _defaultDate,
        dateTimeFormat: data.dateTimeFormat,
        cellHeader1: _defaultDate
    };
    dateEffectivities.splice( 0, 0, today );
};

// If the popup only shows date: act on every date change(when old != new).
// If the popup shows both time and date(data.isTimeEnabled === true), act when time value is changed from the list or date is changed and same time is selected.
export let handleDateOrTimeChange = function( data ) {
    if( ( !data.isTimeEnabled || data.eventData.oldValue ) && data.eventData.newValue && data.eventData.newValue !== data.eventData.oldValue ) {
        if( !data.isTimeEnabled || data.isTimeEnabled &&  Math.abs( data.eventData.newValue - data.eventData.oldValue ) < 24 * 60 * 60 * 1000 ||
          data.isTimeEnabled && data.dateTimeDetails.dateApi.isNotLov && data.eventData.newValue !== data.eventData.oldValue ) {
            exports.changeConfiguration( data );
        }
    }
};

var addGroupToPreferredDateEffectivities = function( effectivityDates, data ) {
    // Add group to unit
    var allGroups = {
        date: data.dateRange.uiValue,
        cellHeader1: data.dateRange.uiValue
    };
    effectivityDates.push( allGroups );
};

export let processDateEffectivity = function( response, data ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }

    var effectivityDates = [];
    if( response.preferredEffectivityInfo ) {
        effectivityDates = populateEffectivityDates( response.preferredEffectivityInfo.effectivityDates, data );
    }
    addDefaultDateToPreferredDateEffectivities( effectivityDates, data );
    if( data.subPanelContext.occContext && data.subPanelContext.occContext.supportedFeatures && data.subPanelContext.occContext.supportedFeatures.Awb0GroupEffectivityFeature ) {
        addGroupToPreferredDateEffectivities( effectivityDates, data );
    }
    return effectivityDates;
};

var populateEffectivityDates = function( allDateEffectivities, data ) {
    var effectivityDates = [];
    if( allDateEffectivities ) {
        var uniqueDateEffectivities = allDateEffectivities.filter( function( elem, index, allDates ) {
            return index === allDates.indexOf( elem );
        } );
        if( uniqueDateEffectivities ) {
            for( var i = 0; i < uniqueDateEffectivities.length; i++ ) {
                var dateEff = {};
                if( uniqueDateEffectivities[ i ] !== DEFAULT_DATE ) {
                    dateEff.date = uniqueDateEffectivities[ i ];
                    dateEff.dateTimeFormat = data.dateTimeFormat;
                    effectivityDates.push( dateEff );
                }
            }
        }
    }
    return effectivityDates;
};
export let initializeDateEffectivityInfo = function( data, occContext ) {
    var dateTimeDetails = uwPropertyService.createViewModelProperty( '', '', 'DATE', data.subPanelContext.currentEffectiveDate.dbValue );
    var dateTimeInfo = populateEffectivityDateTimeVisibilityAndFormat( data, occContext );
    var currentEffectiveDate = AwFilterService.instance( 'date' )( data.subPanelContext.currentEffectiveDate, dateTimeInfo.dateTimeFormat );
    return { dateTimeDetails, currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled, dateTimeFormat: dateTimeInfo.dateTimeFormat };
};

var setDateEffectivity = function( eventData, data, isGroupEffectivityValue ) {
    if ( isGroupEffectivityValue === '' && data.isGroupEffectivity ) {
        isGroupEffectivityValue = data.isGroupEffectivity;
    }
    eventData.egos = data.subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues;
    var currentEffectiveDate = _.clone( data.currentEffectiveDate );
    if( eventData.effectivityDate === data.occurrenceManagementTodayTitle.propertyDisplayName ) {
        currentEffectiveDate.propertyDisplayName = data.occurrenceManagementTodayTitle.propertyDisplayName;
        currentEffectiveDate.dbValue = null;
        eventData.effectivityDate = new Date( '0001-01-01T00:00:00' ).getTime();
        eventData.egos = unitEffConfigration.getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    } else if( isGroupEffectivityValue ) {
        // Handle "Groups" - publish event to launch panel
        eventBus.publish( 'awConfigPanel.dateGroupEffectivityClicked', eventData );
        return;
    } else {
        currentEffectiveDate.dbValue = eventData.effectivityDate;
        currentEffectiveDate.uiValue = AwFilterService.instance( 'date' )( eventData.effectivityDate, data.dateTimeFormat );
        eventData.effectivityDate = new Date( eventData.effectivityDate ).getTime();
        eventData.egos = unitEffConfigration.getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    }
    eventBus.publish( 'awConfigPanel.effectivityDateChanged', {
        effectivityDate: eventData.effectivityDate,
        currentEffectiveDate: currentEffectiveDate,
        viewKey: data.subPanelContext.contextKey,
        egos: eventData.egos
    } );
};

var getDateIndex = function( data ) {
    var dateEffIndex;
    if( data.currentEffectiveDate.dbValue ) {
        dateEffIndex = data.dataProviders.getPreferredDateEffectivities.viewModelCollection.loadedVMObjects.map(
            function( x ) {
                return x.date;
            } ).indexOf( data.currentEffectiveDate.dbValue );
    } else {
        dateEffIndex = data.dataProviders.getPreferredDateEffectivities.viewModelCollection.loadedVMObjects.map(
            function( x ) {
                return x.date;
            } ).indexOf( data.currentEffectiveDate.propertyDisplayName );
    }
    return dateEffIndex;
};

export let updateCurrentDateEffectivity = function( data, eventData ) {
    let currentEffectiveDate;
    var dateTimeFormat = data.isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();

    if( eventData.currentEffectiveDate.propertyDisplayName === data.occurrenceManagementTodayTitle.propertyDisplayName && eventData.currentEffectiveDate.dbValue === null ) {
        currentEffectiveDate = uwPropertyService.createViewModelProperty( data.occurrenceManagementTodayTitle.propertyDisplayName,
            data.occurrenceManagementTodayTitle.propertyDisplayName, 'STRING', data.occurrenceManagementTodayTitle.propertyDisplayName, '' );
        currentEffectiveDate.uiValue = AwFilterService.instance( 'date' )( currentEffectiveDate.uiValue, dateTimeFormat );
    } else {
        var DateUIValue = dateTimeService.formatNonStandardDate( eventData.effectivityDate, dateTimeFormat );
        currentEffectiveDate = uwPropertyService.createViewModelProperty( DateUIValue,
            DateUIValue, 'STRING', DateUIValue, '' );
        currentEffectiveDate.uiValue = AwFilterService.instance( 'date' )( DateUIValue, dateTimeFormat );
    }
    currentEffectiveDate.isEditable = true;
    return { currentEffectiveDate };
};

export let changeConfiguration = function( data ) {
    var isValidDateTimeValue = data.dateTimeDetails.dbValue > 0 && !data.dateTimeDetails.error;
    if( isValidDateTimeValue ) {
        var selectedDateTime = Math.floor( new Date( data.dateTimeDetails.dbValue ).getTime() / 1000 ) * 1000;
        var currentDateTime = data.currentEffectiveDate.dbValue ? new Date( data.currentEffectiveDate.dbValue ).getTime() : '';
        var isSameTimeSelected = currentDateTime && selectedDateTime === currentDateTime;
        if ( data.isTimeEnabled ) {
            var timeReg = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
            if ( !data.dateTimeDetails.dateApi.timeValue.match( timeReg ) ) {
                return;
            }
        }
        if( isSameTimeSelected ) {
            return;
        }
        var eventData = {
            effectivityDate: new Date( selectedDateTime )
        };
        let isGroupEffectivityValue = '';
        setDateEffectivity( eventData, data, isGroupEffectivityValue );
    }
};

export let updateDateEffWhenSelectedFromList = function( eventData, data ) {
    let isGroupEffectivityValue;
    if( eventData.selectedObjects.length ) {
        if( data.currentEffectiveDate.dbValue ) {
            if( data.currentEffectiveDate.dbValue !== eventData.selectedObjects[ 0 ].date ) {
                isGroupEffectivityValue = data.dateRange.uiValue === eventData.selectedObjects[ 0 ].date;
                eventData.effectivityDate = isGroupEffectivityValue ? -2 : eventData.selectedObjects[ 0 ].date;
                setDateEffectivity( eventData, data, isGroupEffectivityValue );
            }
        } else {
            if( data.currentEffectiveDate.propertyDisplayName !== eventData.selectedObjects[ 0 ].date ) {
                isGroupEffectivityValue = data.dateRange.uiValue === eventData.selectedObjects[ 0 ].date;
                eventData.effectivityDate = isGroupEffectivityValue ? -2 : eventData.selectedObjects[ 0 ].date;
                setDateEffectivity( eventData, data, isGroupEffectivityValue );
            }
        }
    } else { // Handle Current Date Eff selected
        popupService.hide();
    }
    return {
        isGroupEffectivity : isGroupEffectivityValue
    };
};

export let selectDateEffInList = function( data ) {
    if( data.dataProviders.getPreferredDateEffectivities.viewModelCollection.loadedVMObjects.length > 0 ) {
        //Find date eff index and select it
        var dateEffIndex = getDateIndex( data );
        if( dateEffIndex >= 0 ) {
            data.dataProviders.getPreferredDateEffectivities.changeObjectsSelection( dateEffIndex, dateEffIndex,
                true );
        }
    }
};

export let applyEffectivityDateChange = function( data, occContext ) {
    if( occContext.productContextInfo ) {
        var endItem = occContext.productContextInfo.props.awb0EffEndItem;
        if( ( !endItem || endItem.dbValues[ 0 ] === '' || endItem.dbValues[ 0 ] === null || endItem.isNulls && endItem.isNulls[ 0 ] !== true ) && occContext.productContextInfo.props.awb0Product ) {
            var topProduct = cdm.getObject( occContext.productContextInfo.props.awb0Product.dbValues[ 0 ] );
            endItem = cdm.getObject( topProduct.props.items_tag.dbValues[ 0 ] );
        }
        var value = {
            configContext : {
                r_uid: occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ],
                var_uids: occContext.productContextInfo.props.awb0VariantRules.dbValues,
                iro_uid: occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ],
                de: data.eventData.effectivityDate,
                ue: occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ],
                ei_uid: endItem.uid ? endItem.uid : occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ],
                startFreshNavigation: true,
                eg_uids: data.eventData.egos
            },
            transientRequestPref: {
                userGesture: 'REVISION_RULE_CHANGE',
                jitterFreePropLoad: true
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    }
    popupService.hide();
};

export let initAddDateRangePanel = function( data ) {
    populateProductContextInfo( data );
    populateEffectivityDateTimeVisibilityAndFormat( data );
    var displayValuesArr = [];
    let effGroupsDBValues = getDateEffectivityGroups( data.subPanelContext.occContext );
    let groupEffectivitiesApplied;
    let configuredByuiValue;
    if( effGroupsDBValues.length ) {
        dmSvc.getProperties( effGroupsDBValues, [ 'Fnd0EffectivityList' ] );
        for( var rowNdx = 0; rowNdx < effGroupsDBValues.length; rowNdx++ ) {
            var newVMO = viewModelObjectService.createViewModelObject( effGroupsDBValues[ rowNdx ] );
            displayValuesArr.push( newVMO );
        }
        groupEffectivitiesApplied = displayValuesArr;
    } else {
        groupEffectivitiesApplied = displayValuesArr;
    }
    if( data.configuredBy ) {
        configuredByuiValue = effGroupsDBValues.length ? String( newVMO ? newVMO.cellHeader2 : '' ) : ' ';
    }
    return{
        groupEffectivitiesApplied: groupEffectivitiesApplied,
        configuredByuiValue: configuredByuiValue
    };
};

/**
 * Date Effectivity Configuration service utility
 */
export default exports = {
    getInitialDateEffectivityConfigurationData,
    processDateEffectivity,
    updateCurrentDateEffectivity,
    changeConfiguration,
    updateDateEffWhenSelectedFromList,
    selectDateEffInList,
    initializeDateEffectivityInfo,
    handleDateOrTimeChange,
    applyEffectivityDateChange,
    getDateEffectivityGroups,
    initAddDateRangePanel,
    isDateEffectivity
};
