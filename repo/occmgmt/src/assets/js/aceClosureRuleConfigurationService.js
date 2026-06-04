// Copyright (c) 2022 Siemens

/**
 * @module js/aceClosureRuleConfigurationService
 */
import uwPropertyService from 'js/uwPropertyService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};
var _NULL_ID = 'AAAAAAAAAAAAAA';
export let processClosureRules = function( response, defaultClosureRule ) {
    var searchResults = [];
    if( ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors )
        && !response.searchResults ) {
        return searchResults;
    }
    var noneOption = tcViewModelObjectService.createViewModelObjectById( _NULL_ID );
    noneOption.props = {
        object_string: {
            dbValue: defaultClosureRule.uiValue
        }
    };
    noneOption.cellHeader1 = defaultClosureRule.uiValue;
    noneOption.marker = 0;

    if( response.searchResults ) {
        searchResults = response.searchResults;
    }
    searchResults.splice( 0, 0, noneOption );
    response.totalFound++;
    return searchResults;
};

var convertClosureRuleIntoVMProperty = function( currentClosureRuleObject ) {
    var closureRuleVMProperty = uwPropertyService.createViewModelProperty( currentClosureRuleObject.dbValues[ 0 ],
        currentClosureRuleObject.dbValues[ 0 ], 'STRING', currentClosureRuleObject.uiValues[ 0 ], '' );
    closureRuleVMProperty.uiValue = currentClosureRuleObject.uiValues[ 0 ];
    return closureRuleVMProperty;
};

/**
 * Get Closure Rule Configuration Data
 */
export let getInitialClosureRuleConfigurationData = function( defaultClosureRule, subPanelContext ) {
    if( subPanelContext ) {
        if( subPanelContext.occContext ) {
            var productContextInfo = subPanelContext.occContext.productContextInfo;
            if( productContextInfo ) {
                var currentClosureRuleObject = productContextInfo.props.awb0ClosureRule;
                if( _.isNull( currentClosureRuleObject.dbValues[ 0 ] ) || _.isUndefined( currentClosureRuleObject.dbValues[ 0 ] ) ||
            _.isEmpty( currentClosureRuleObject.dbValues[ 0 ] ) ) {
                    currentClosureRuleObject.uiValues[ 0 ] = defaultClosureRule.uiValue;
                }

                var currentClosureRule = convertClosureRuleIntoVMProperty( currentClosureRuleObject );
                currentClosureRule.isEditable = true;
                return { currentClosureRule };
            }
        }
    }
};

var setClosureRule = function( eventData ) {
    eventBus.publish( 'awClosureRule.ValueChanged', eventData );
};

export let selectClosureRule = function( data, subPanelContext ) {
    if( data.dataProviders.getClosureRules.viewModelCollection.loadedVMObjects.length > 0 ) {
        if( subPanelContext.currentClosureRule.dbValue === data.defaultClosureRule.uiValue ) { //Select "No Rule" from List
            var indexOfCurrentClosureRule = data.dataProviders.getClosureRules.viewModelCollection.loadedVMObjects
                .map( function( x ) {
                    return x.props.object_string.dbValue;
                } ).indexOf( subPanelContext.currentClosureRule.dbValue );

            data.dataProviders.getClosureRules.changeObjectsSelection( indexOfCurrentClosureRule,
                indexOfCurrentClosureRule, true );
        } else {
            //Find index of ClosureRule and select it
            var indexOfCurrentClosureRule = data.dataProviders.getClosureRules.viewModelCollection.loadedVMObjects
                .map( function( x ) {
                    return x.uid;
                } ).indexOf( subPanelContext.currentClosureRule.dbValue );
            if( indexOfCurrentClosureRule >= 0 ) {
                data.dataProviders.getClosureRules.changeObjectsSelection( indexOfCurrentClosureRule,
                    indexOfCurrentClosureRule, true );
            }
        }
    }
};

export let updateClosureRule = function( eventData, data, subPanelContext ) {
    if( subPanelContext.currentClosureRule.dbValue && eventData.selectedObjects.length > 0 ) {
        if( subPanelContext.currentClosureRule.dbValue !== eventData.selectedObjects[ 0 ].uid &&
            subPanelContext.currentClosureRule.dbValue !== eventData.selectedObjects[ 0 ].props.object_string.dbValue ) {
            eventData.closureRule = eventData.selectedObjects[ 0 ].uid;
            setClosureRule( {
                selectedObject: eventData.selectedObjects[ 0 ],
                viewKey: subPanelContext.contextKey,
                closureRule: eventData.closureRule
            } );
        }
    } else if( eventData.selectedObjects.length === 0 && _.isEmpty( data.closureRuleFilterbox.dbValue ) ) {
        // Handle Current view type selected
        popupService.hide();
    }
};

export let updateCurrentClosureRules = function( data, eventData ) {
    if( data && data.currentClosureRule ) {
        if( eventData.selectedObject.props.object_string.dbValue === data.defaultClosureRule.uiValue ) { //check for "No Rule" value
            var uivalue =  eventData.selectedObject.props.object_string.dbValue;
            var closureRuleVMProperty = uwPropertyService.createViewModelProperty( null,
                null, 'STRING', uivalue, '' );
            closureRuleVMProperty.uiValue = eventData.selectedObject.props.object_string.dbValue;
            return closureRuleVMProperty;
        }

        return eventData.selectedObject.props.object_string;
    }
};

export let applyClosureRule = function( eventData, subPanelContext ) {
    var value = {
        configContext : {
            cl_uid: eventData.closureRule,
            r_uid: subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ],
            var_uids: subPanelContext.occContext.productContextInfo.props.awb0VariantRules.dbValues,
            iro_uid: subPanelContext.occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ],
            de: subPanelContext.occContext.productContextInfo.props.awb0EffDate.dbValues[ 0 ],
            ue: subPanelContext.occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ],
            ei_uid: subPanelContext.occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ],
            startDate: subPanelContext.occContext.productContextInfo.props.awb0StartEffDates.dbValues[ 0 ],
            endDate: subPanelContext.occContext.productContextInfo.props.awb0EndEffDates.dbValues[ 0 ],
            fromUnit: subPanelContext.occContext.productContextInfo.props.awb0StartEffUnits.dbValues[ 0 ],
            toUnit: subPanelContext.occContext.productContextInfo.props.awb0EndEffUnits.dbValues[ 0 ],
            eg_uids: subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues,
            startFreshNavigation: true
        },
        transientRequestPref: {
            userGesture: 'CLOSURE_RULE_CHANGE',
            jitterFreePropLoad: true
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
    popupService.hide();
};


/**
 * Closure Rule Configuration service utility
 */

export default exports = {
    processClosureRules,
    getInitialClosureRuleConfigurationData,
    selectClosureRule,
    updateClosureRule,
    updateCurrentClosureRules,
    applyClosureRule
};
