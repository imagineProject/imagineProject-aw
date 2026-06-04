// Copyright (c) 2022 Siemens

/**
 * @module js/endItemUnitEffectivityConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import dateEffConfigration from 'js/dateEffectivityConfigurationService';

var exports = {};

var DEFAULT_UNIT = -1;
var NULL_ID = 'AAAAAAAAAAAAAA';

var populateProductContextInfo = function( occContext ) {
    return occContext.productContextInfo;
};

var getEffectivityGroupsFromProductContextInfo = function( data, occContext ) {
    if( occContext.productContextInfo ) {
        return convertEffectivityGroupIntoVMProperty( occContext.productContextInfo, data );
    }
};

export var getUnitEffectivityGroupsFromProductContextInfo = function( occContext ) {
    let egos =  populateDataFromEGUids( occContext );
    return egos && egos.dbValues.length > 0 ? egos.dbValues.filter( e=>{
        let effString = cdm.getObject( e ).props.awp0CellProperties.dbValues[1];
        return !dateEffConfigration.isDateEffectivity( effString );
    } ) : [];
};

var convertEffectivityGroupIntoVMProperty = function( productContextInfoModelObject, data ) {
    let unitEgos = getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    var effectivityGroupVMProperty;
    if( unitEgos && unitEgos.length > 0 ) {
        if( unitEgos.length > 1 ) {
            effectivityGroupVMProperty = uwPropertyService.createViewModelProperty( data.multipleGroups, data.multipleGroups, 'STRING', '', '' );
            effectivityGroupVMProperty.uiValue = data.multipleGroups.uiValue;
        } else {
            var groupName = '';
            effectivityGroupVMProperty = uwPropertyService.createViewModelProperty(
                unitEgos[ 0 ],
                '', 'STRING',
                unitEgos[ 0 ], '' );
            var groupItemRev = cdm.getObject( unitEgos[ 0 ] );
            groupName = groupItemRev.props.object_name.uiValues[ 0 ];

            effectivityGroupVMProperty.uiValue = groupName;
        }
        return effectivityGroupVMProperty;
    }
};

var getEffectiveUnitFromProductContextInfo = function( occContext ) {
    var productContextInfoModelObject = occContext.productContextInfo;
    if( productContextInfoModelObject && productContextInfoModelObject.props.awb0EffUnitNo ) {
        var effectiveUnitVMProperty = uwPropertyService.createViewModelProperty(
            productContextInfoModelObject.props.awb0EffUnitNo.dbValues[ 0 ],
            productContextInfoModelObject.props.awb0EffUnitNo.uiValues[ 0 ], 'STRING',
            productContextInfoModelObject.props.awb0EffUnitNo.dbValues[ 0 ], '' );
        effectiveUnitVMProperty.uiValue = productContextInfoModelObject.props.awb0EffUnitNo.uiValues[ 0 ];
        return effectiveUnitVMProperty;
    }
};

var convertRevisionRuleEffectiveUnitIntoVMProperty = function( revisionRuleModelObject ) {
    if( revisionRuleModelObject.props.rule_unit ) {
        var effectiveUnitVMProperty = uwPropertyService.createViewModelProperty(
            revisionRuleModelObject.props.rule_unit.dbValues[ 0 ],
            revisionRuleModelObject.props.rule_unit.uiValues[ 0 ], 'STRING',
            revisionRuleModelObject.props.rule_unit.dbValues[ 0 ], '' );
        effectiveUnitVMProperty.uiValue = revisionRuleModelObject.props.rule_unit.uiValues[ 0 ];
        return effectiveUnitVMProperty;
    }
};

var getEffectiveUnitFromRevisionRule = function( currentRevisionRule ) {
    if( currentRevisionRule && currentRevisionRule.dbValues ) {
        var currentRevisionRuleModelObject = cdm.getObject( currentRevisionRule.dbValues );
        if( currentRevisionRuleModelObject ) {
            return convertRevisionRuleEffectiveUnitIntoVMProperty( currentRevisionRuleModelObject );
        }
    }
};

var getDefaultEffectiveUnit = function( data ) {
    return _.clone( data.effectivityUnitSectionAllUnitsValue, true );
};

var populateEffectiveUnit = function( data, occContext ) {
    if( data ) {
        var currentEffectiveUnit = getEffectiveUnitFromProductContextInfo( occContext );
        if( !currentEffectiveUnit || !currentEffectiveUnit.uiValue ) {
            var currentRevisionRule = occContext.productContextInfo.props.awb0CurrentRevRule;
            currentEffectiveUnit = getEffectiveUnitFromRevisionRule( currentRevisionRule );
            if( !currentEffectiveUnit || !currentEffectiveUnit.uiValue ) {
                currentEffectiveUnit = getEffectivityGroupsFromProductContextInfo( data, occContext );
                if( !currentEffectiveUnit || !currentEffectiveUnit.uiValue ) {
                    currentEffectiveUnit = getDefaultEffectiveUnit( data );
                }
            }
        }
        //Temp WA to explicitly set isEditable to true as the createVMP API returns this as false in BA
        currentEffectiveUnit.isEditable = true;
        currentEffectiveUnit.uiValue = currentEffectiveUnit.uiValue === '-1' ? data.effectivityUnitSectionAllUnitsValue.uiValue : currentEffectiveUnit.uiValue;
        return currentEffectiveUnit;
    }
};

export var getEndItemFromProductContextInfo = function( occContext ) {
    if( occContext.productContextInfo ) {
        var endItem = occContext.productContextInfo.props.awb0EffEndItem;
        if( ( !endItem || endItem.dbValues[ 0 ] === '' || endItem.dbValues[ 0 ] === null || endItem.isNulls && endItem.isNulls[ 0 ] !== true ) && occContext.productContextInfo.props.awb0Product ) {
            var topProduct = cdm.getObject( occContext.productContextInfo.props.awb0Product.dbValues[ 0 ] );
            endItem = cdm.getObject( topProduct.props.items_tag.dbValues[ 0 ] );
        } else if( endItem ) {
            endItem = cdm.getObject( occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ] );
        }
        return endItem;
    }
};

export let getCurrentEffectiveUnitsAndEndItem = function( occContext, configUnitEndItem ) {
    var endItem = configUnitEndItem.unitEndItemToRender;
    if( !endItem ) {
        endItem = exports.getEndItemFromProductContextInfo( occContext );
    }
    var endItemUID = endItem.uid;
    if( !endItemUID && endItem.dbValues ) {
        endItemUID = endItem.dbValues[ 0 ];
    }

    var effectiveUnit = -1;

    if( occContext && occContext.productContextInfo && occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ] ) {
        effectiveUnit = parseInt( occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ] );
    }

    return {
        effectiveUnit: effectiveUnit,
        endItem: {
            uid: endItemUID
        }
    };
};

var handleEndItemChangeIfThePanelIsGettingReInitialized = function( occContext, configUnitEndItem, endItemToRender ) {
    var currentlyRenderedEndItem = configUnitEndItem.unitEndItemToRender;
    if( currentlyRenderedEndItem &&
            ( currentlyRenderedEndItem.uid === endItemToRender.uid || currentlyRenderedEndItem.dbValues &&
                currentlyRenderedEndItem.dbValues[ 0 ] === endItemToRender.uid ) ) {
        occmgmtUtils.updateValueOnCtxOrState( 'endItemSelected', '', occContext );
        return;
    }
    var currentEffectiveUnitsAndEndItem = exports.getCurrentEffectiveUnitsAndEndItem( occContext, configUnitEndItem );
    var eventData = {
        effectiveUnit: currentEffectiveUnitsAndEndItem.effectiveUnit,
        endItem: endItemToRender
    };
    eventBus.publish( 'awConfigPanel.endItemUnitEffectivityChanged', eventData );
    occmgmtUtils.updateValueOnCtxOrState( 'endItemSelected', '', occContext );
};

export let updateUnitEffectivityText = function( eventData, data ) {
    var unitText = eventData.effectiveUnit === DEFAULT_UNIT ? data.effectivityUnitSectionAllUnitsValue.uiValue : eventData.effectiveUnit;
    var currentEffectiveUnit = uwPropertyService.createViewModelProperty(
        unitText,
        unitText, 'STRING',
        unitText, '' );
    currentEffectiveUnit.uiValue = unitText;
    return { currentEffectiveUnit };
};

var updatePanelWithEndItemToRender = function( endItemToRender, configUnitEndItem ) {
    if( endItemToRender ) {
        dmSvc.getProperties( [ endItemToRender.uid ], [ 'object_string' ] );
        occmgmtUtils.updateValueOnCtxOrState( 'unitEndItemToRender', endItemToRender, configUnitEndItem );
    }
};

var populateEndItems = function( occContext, configUnitEndItem ) {
    var endItemToRender = occContext.endItemSelected;
    if( endItemToRender ) {
        handleEndItemChangeIfThePanelIsGettingReInitialized( occContext, configUnitEndItem, endItemToRender );
        updatePanelWithEndItemToRender( endItemToRender, configUnitEndItem );
    } else {
        var endItemToRenderFromPCI = exports.getEndItemFromProductContextInfo( occContext );
        updatePanelWithEndItemToRender( endItemToRenderFromPCI, configUnitEndItem );
    }
};

export let getInitialUnitEffectivityConfigurationData = function( data, occContext ) {
    if( data ) {
        var productContextInfo = populateProductContextInfo( occContext );
        if( productContextInfo ) {
            const currentEffectiveUnit = populateEffectiveUnit( data, occContext );
            return { currentEffectiveUnit };
        }
    }
};

export let applyUnitEffectivity = function( data, occContext, configUnitEndItem ) {
    if( data.newUnitEffectivity.dbValue ) {
        var eventData = {};
        eventData.effectiveUnit = parseInt( data.newUnitEffectivity.dbValue );
        eventData.endItem = exports.getCurrentEffectiveUnitsAndEndItem( occContext, configUnitEndItem ).endItem;
        exports.setUnitEffectivity( eventData, occContext );
    }
};

export let selectUnitEffectivity = function( data, occContext ) {
    if( data.dataProviders.getPreferredUnitEffectivities.viewModelCollection.loadedVMObjects.length > 0 ) {
        // unselect them first
        for( var i = 0; i < data.dataProviders.getPreferredUnitEffectivities.viewModelCollection.loadedVMObjects.length; ++i ) {
            data.dataProviders.getPreferredUnitEffectivities.changeObjectsSelection( i, i, false );
        }
        //Find index of Unit eff and select it
        var indexOfCurrentUnitEff = data.dataProviders.getPreferredUnitEffectivities.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.unit;
            } ).indexOf( populateEffectiveUnit( data, occContext ).propertyDisplayName );
        if( indexOfCurrentUnitEff >= 0 ) {
            data.dataProviders.getPreferredUnitEffectivities.changeObjectsSelection( indexOfCurrentUnitEff,
                indexOfCurrentUnitEff, true );
        }
    }
};

export let updateUnitEffectivity = function( eventData, data, occContext, configUnitEndItem ) {
    if( eventData.selectedObjects.length > 0 ) {
        // Handle Unit Eff selected

        if( populateEffectiveUnit( data, occContext ).propertyDisplayName !== eventData.selectedObjects[ 0 ].unit ) {
            var setUnitEffeventData = {};
            setUnitEffeventData.effectiveUnit = parseInt( eventData.selectedObjects[ 0 ].unit );
            if( !setUnitEffeventData.effectiveUnit ) {
                // Handle Group Effectivity
                if( data.effectivityGroups.uiValue === eventData.selectedObjects[ 0 ].unit ) {
                    setUnitEffeventData.isGroupEffectivity = true;
                    setUnitEffeventData.effectiveUnit = -2;
                } else {
                    setUnitEffeventData.isGroupEffectivity = false;
                    setUnitEffeventData.effectiveUnit = -1;
                }
            }
            if( setUnitEffeventData.effectiveUnit !== -1 ) {
                setUnitEffeventData.endItem = exports.getCurrentEffectiveUnitsAndEndItem( occContext, configUnitEndItem ).endItem;
            }
            exports.setUnitEffectivity( setUnitEffeventData, occContext );
        }
    } else { // Handle Current Unit eff selected
        popupService.hide();
    }
};

export let setUnitEffectivity = function( eventData, occContext ) {
    if( eventData.isGroupEffectivity && eventData.effectiveUnit === -2 ) {
        // Handle "Groups" - publish event to launch panel
        eventBus.publish( 'awConfigPanel.groupEffectivityClicked', eventData );
    } else {
        if( parseInt( occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ] ) !== eventData.effectiveUnit ) {
            eventData.egos = dateEffConfigration.getDateEffectivityGroups( occContext );
            eventBus.publish( 'awConfigPanel.unitEffectivityChanged', eventData );
        }
    }
};

export let getInitialEndItemConfigurationData = function( data, occContext, configUnitEndItem ) {
    if( data ) {
        var productContextInfo = populateProductContextInfo( occContext );
        if( productContextInfo ) {
            populateEndItems( occContext, configUnitEndItem );
        }
    }
};

export let getEndItems = function( configUnitEndItem ) {
    var endItemToRender = configUnitEndItem.unitEndItemToRender;
    if( endItemToRender ) {
        var endItems = [];
        endItems.push( endItemToRender );
        return endItems;
    }
};

export let updateConfigEndItems = function( newItemSelected, occContext ) {
    if( newItemSelected ) {
        var item = newItemSelected.props && newItemSelected.props.items_tag ? cdm.getObject( newItemSelected.props.items_tag.dbValues[ 0 ] ) : newItemSelected;
        occmgmtUtils.updateValueOnCtxOrState( 'endItemSelected', item, occContext );
    }
};

export let processUnitEffectivity = function( response, data, occContext ) {
    var effectivityUnits = [];
    if( ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors )
         && !response.preferredEffectivityInfo ) {
        return effectivityUnits;
    }

    if( response.preferredEffectivityInfo ) {
        effectivityUnits = populateEffectivityUnits( response.preferredEffectivityInfo.effectivityUnits );
    }
    addDefaultUnitsToPreferredUnitEffectivities( effectivityUnits, data );
    if( occContext.supportedFeatures.Awb0GroupEffectivityFeature ) {
        addGroupUnitsToPreferredUnitEffectivities( effectivityUnits, data );
    }
    return effectivityUnits;
};

var populateEffectivityUnits = function( allUnitEffectivities ) {
    var unitEffectivities = [];
    if( allUnitEffectivities ) {
        var uniqueUnitEffectivities = allUnitEffectivities.filter( function( elem, index, self ) {
            return index === self.indexOf( elem );
        } );
        if( uniqueUnitEffectivities ) {
            for( var i = 0; i < uniqueUnitEffectivities.length; i++ ) {
                var unitEff = {};
                if( uniqueUnitEffectivities[ i ] !== DEFAULT_UNIT ) {
                    unitEff.unit = uniqueUnitEffectivities[ i ].toString();
                    unitEffectivities.push( unitEff );
                }
            }
        }
    }
    return unitEffectivities;
};

export let populateEndItemsOrSVROwningItems = function( allItems ) {
    var uniqueItems = [];
    if( allItems ) {
        for( var i = 0; i < allItems.length; i++ ) {
            var found = false;
            for( var j = 0; j < uniqueItems.length; j++ ) {
                if( allItems[ i ].uid === uniqueItems[ j ].uid ) {
                    found = true;
                    break;
                }
            }
            if( !found && allItems[ i ].uid !== NULL_ID ) {
                uniqueItems.push( allItems[ i ] );
            }
        }
    }
    return uniqueItems;
};

export let addOpenObjectAsPreferredIfApplicable = function( endItemsOrSVROwningItems, addOpenObjAsPreferredEndItem, occContext ) {
    if( addOpenObjAsPreferredEndItem ) {
        if( occContext && occContext.productContextInfo ) {
            endItemsOrSVROwningItems.push( occContext.productContextInfo.props.awb0Product );
        }
    }
    return endItemsOrSVROwningItems;
};

export let processSoaResponseForBOTypes = function( response ) {
    var typeNames = [];
    if( response.output ) {
        for( var ii = 0; ii < response.output.length; ii++ ) {
            var displayableBOTypeNames = response.output[ ii ].displayableBOTypeNames;
            for( var jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                var SearchFilter = {
                    searchFilterType: 'StringFilter',
                    stringValue: ''
                };
                SearchFilter.stringValue = displayableBOTypeNames[ jj ].boName;
                typeNames.push( SearchFilter );
            }
        }
    }
    return typeNames;
};

export let fetchSubBOTypesAndDoSearch = function( data ) {
    if( !data.subBusinessObjects || data.subBusinessObjects.length === 0 ) {
        eventBus.publish( 'searchEndItems.fetchSubBOTypes' );
    } else {
        eventBus.publish( 'searchEndItems.doSearch' );
    }
};

var addDefaultUnitsToPreferredUnitEffectivities = function( unitEffectivities, data ) {
    var allUnits = {
        unit: data.effectivityUnitSectionAllUnitsValue.uiValue,
        cellHeader1: data.effectivityUnitSectionAllUnitsValue.uiValue
    };
    unitEffectivities.splice( 0, 0, allUnits );
};

var addGroupUnitsToPreferredUnitEffectivities = function( unitEffectivities, data ) {
    // Add group to unit
    var allGroups = {
        unit: data.effectivityGroups.uiValue,
        cellHeader1: data.effectivityGroups.uiValue
    };
    unitEffectivities.push( allGroups );
};

export let applyEffectivityGroups = function( occContext, selectedGroupEffectivities ) {
    var groupEffectivityUidArray = [];
    var egos = populateDataFromEGUids( occContext );
    if( egos ) {
        groupEffectivityUidArray = _.clone( egos.dbValues );
    }
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

export let getAllAppliedGroupEffectivities = function( occContext ) {
    populateProductContextInfo( occContext );
    var effGroupsDBValues = getUnitEffectivityGroupsFromProductContextInfo( occContext );
    const groupEffectivitiesLength = effGroupsDBValues.length;
    var displayValuesArr = [];
    dmSvc.getProperties( effGroupsDBValues, [ 'Fnd0EffectivityList' ] );
    for( var rowNdx = 0; rowNdx < effGroupsDBValues.length; rowNdx++ ) {
        var newVMO = viewModelObjectService.createViewModelObject( effGroupsDBValues[ rowNdx ] );
        displayValuesArr.push( newVMO );
    }
    return { groupEffectivitiesApplied: displayValuesArr, groupEffectivitiesLength: groupEffectivitiesLength };
};

let populateDataFromEGUids = function( occContext ) {
    let egos;
    // Certain time we observed that occContext is avaiable but productContextInfo is empty/undefined,
    // so at the time of rendering header this will cause console error. To overcome this error added safety check
    if( occContext.productContextInfo && !_.isUndefined( occContext.productContextInfo.props ) ) {
        egos = occContext.productContextInfo.props.awb0EffectivityGroups;
    } else{
        if( occContext && occContext.configContext && occContext.configContext.eg_uids ) {
            egos = { dbValues: occContext.configContext.eg_uids };
        }
    }
    return egos;
};

export let removeEffectivityGroups = function( selectedGroupEffectivities, occContext ) {
    var dbValues = [];
    var egos = populateDataFromEGUids( occContext );
    if ( egos && egos.dbValues ) {
        dbValues = [ ...egos.dbValues ];
    }
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        var index = dbValues.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index > -1 ) {
            dbValues.splice( index, 1 );
        }
    }
    return dbValues;
};

export let applyEffectivityChange = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

export let applyEndItemChange = function( subPanelContext, occContext ) {
    if ( occContext.productContextInfo && occContext.productContextInfo.props.awb0EffectivityGroups.dbValues.length > 0 &&
        occContext.productContextInfo.props.awb0EffEndItem.dbValues[0] !== subPanelContext.configUnitEndItem.unitEndItemToRender.uid ) {
        var value = {
            configContext : {
                eg_uids: null
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext, true );
    }
};

export default exports = {
    getCurrentEffectiveUnitsAndEndItem,
    getInitialUnitEffectivityConfigurationData,
    getInitialEndItemConfigurationData,
    getEndItems,
    updateConfigEndItems,
    processUnitEffectivity,
    populateEndItemsOrSVROwningItems,
    addOpenObjectAsPreferredIfApplicable,
    processSoaResponseForBOTypes,
    fetchSubBOTypesAndDoSearch,
    applyEffectivityGroups,
    getAllAppliedGroupEffectivities,
    removeEffectivityGroups,
    selectUnitEffectivity,
    applyUnitEffectivity,
    updateUnitEffectivity,
    updateUnitEffectivityText,
    setUnitEffectivity,
    applyEffectivityChange,
    getUnitEffectivityGroupsFromProductContextInfo,
    getEndItemFromProductContextInfo,
    applyEndItemChange
};
