// Copyright (c) 2022 Siemens

/**
 * @module js/configurationBaselinesClauseService
 */

import _ from 'lodash';
import addRevRuleClausePropertyService from  'js/addRevRuleClausePropertyService';
import localeSvc from 'js/localeService';
import revRuleClauseDisplayTextService from 'js/revRuleClauseDisplayTextService';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revisionRuleAdminPanelService from 'js/revisionRuleAdminPanelService';
import AwFilterService from 'js/awFilterService';
import dateTimeService from 'js/dateTimeService';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};
var _config_baseline = 'configBaseline';
var config_baseline_object = 'baselineObject';
var ADDCLAUSE_PREFIX = 'addClause_';
var _anyConfigBaselineType = 'Any';
var _localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );

export let setConfigBaselineTypeToAny = function() {
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaselineData;
    if( ctx.RevisionRuleAdmin ) {
        configBaselineData = {
            configBaselineuid: 'Any',
            configBaselineDisplay: _localeTextBundle.any
        };
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_configBaseline', configBaselineData );
};

export let setConfigBaselineStateToAny = function() {
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaselineData;
    if( ctx.RevisionRuleAdmin ) {
        configBaselineData = {
            configBaselineStateuid: '',
            configBaselineStateDisplay: _localeTextBundle.any
        };
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_configBaselineState', configBaselineData );
};

export let setConfigBaselineLMDToday = function( data, dateField, occContext ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaselineData;
    var configBaselineDate = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaselineDate', data );
    var config_baseline_date = _.cloneDeep( data.config_baseline_date );
    var subPanelContext = data.subPanelContext;
    let isSelectedFromAddPanel;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }
    configBaselineData = {
        configBaselineDateuid: '',
        configBaselineDateDisplay: ''
    };
    config_baseline_date.dbValue = '';
    config_baseline_date.uiValue = '';
    config_baseline_date.dateApi.timeValue = '';
    config_baseline_date.dateApi.dateValue = '';
    config_baseline_date.valueUpdated = true;

    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaselineDate, configBaselineData );
    data.dispatch( { path: 'data.config_baseline_date', value:config_baseline_date } );

    if ( data.subPanelContext.nestedNavigationState.currentlySelectedClause.dbValue === 15 ) {
        var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data.subPanelContext );
        if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 15 ) {
            var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, false );
            var dateString = data.config_baseline_date.uiValue;
            if ( dateField.error ) {
                clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date = '';
                if( clauseToBeUpdated.displayText !== displayText ) {
                    addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
                }
            }
            var lastModifyDateUiValue = getDateOrDateTimeUiValue( clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date, occContext );
            var dateStringUiValue = getDateOrDateTimeUiValue( data.config_baseline_date.uiValue, occContext );
            if ( lastModifyDateUiValue !== dateStringUiValue && !dateField.error ) {
                clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date = dateString;
                if( clauseToBeUpdated.displayText !== displayText ) {
                    addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
                }
            }
        }
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'todayForLMD', data.todayForLMD.dbValue );
    if ( !isSelectedFromAddPanel ) {
        updateConfigBaselineClauseText( data );
    }
};

export let setTodayForLMDCheckBoxTrue = function( data ) {
    data.dispatch( { path: 'data.todayForLMD.dbValue', value:true } );
};

function getDateOrDateTimeUiValue( dateUiValue, occContext ) {
    var timeEnabled = occContext.productContextInfo && occContext.productContextInfo.props.awb0EffDate && occContext.productContextInfo.props.awb0EffDate.propertyDescriptor.constantsMap.timeEnabled;
    var isTimeEnabled = timeEnabled && timeEnabled === '1';
    var today = new Date( dateUiValue );
    var dateInTime = today.getTime();
    var dateTimeFormat = isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();
    var DateUIValue = dateTimeService.formatNonStandardDate( dateInTime, dateTimeFormat );
    var currentEffectiveDate = uwPropertyService.createViewModelProperty( DateUIValue,
        DateUIValue, 'STRING', DateUIValue, '' );
    currentEffectiveDate.uiValue = AwFilterService.instance( 'date' )( DateUIValue, dateTimeFormat );
    return currentEffectiveDate.uiValue;
}
/**
   * Initialize the Configuration Baseline clause property when any clause is selected from the list of clauses
   *
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   * @returns {String} Returns config baseline value
   *
   */
export let configBaselineClausePropertyValueInitialized = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var config_baseline = _.cloneDeep( data.config_baseline );
    var config_baseline_state = _.cloneDeep( data.config_baseline_state );
    var config_baseline_date = _.cloneDeep( data.config_baseline_date );
    var todayForLMD = _.cloneDeep( data.todayForLMD );

    if( ctx.RevisionRuleAdmin.configBaseline && ctx.RevisionRuleAdmin.configBaseline.configBaselineDisplay === _anyConfigBaselineType ) {
        config_baseline.uiValue = _localeTextBundle.any;
        config_baseline.dbValue = _anyConfigBaselineType;
    } else if( ctx.RevisionRuleAdmin.configBaseline ) {
        config_baseline.uiValue = ctx.RevisionRuleAdmin.configBaseline.configBaselineDisplay;
        config_baseline.dbValue = ctx.RevisionRuleAdmin.configBaseline.configBaselineuid;
    } else {
        config_baseline.uiValue = '';
        config_baseline.dbValue = '';
    }

    if( ctx.RevisionRuleAdmin.configBaselineState ) {
        config_baseline_state.uiValue = ctx.RevisionRuleAdmin.configBaselineState.configBaselineStateDisplay;
        config_baseline_state.dbValue = ctx.RevisionRuleAdmin.configBaselineState.configBaselineStateuid;
    } else {
        config_baseline_state.uiValue = '';
        config_baseline_state.dbValue = '';
    }

    if( ctx.RevisionRuleAdmin.todayForLMD === true ) {
        todayForLMD.dbValue = 'true';
        todayForLMD.uiValue = 'true';
    } else {
        todayForLMD.dbValue = 'false';
        todayForLMD.uiValue = 'false';
    }

    if( ctx.RevisionRuleAdmin.configBaselineDate ) {
        config_baseline_date.uiValue = ctx.RevisionRuleAdmin.configBaselineDate.configBaselineDateDisplay;
        config_baseline_date.dbValue = ctx.RevisionRuleAdmin.configBaselineDate.configBaselineDateuid;
    } else {
        config_baseline_date.uiValue = '';
        config_baseline_date.dbValue = '';
    }

    return { config_baseline, config_baseline_state, config_baseline_date, todayForLMD };
};

/**
   * Initialize the Configuration Baseline clause property when any clause is selected from the list of clauses
   *
   * @param {Object} response - SOA response
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   * @returns {Object} Returns config baseline list
   *
   */
export let processConfigBaselines = function( response, data ) {
    let configBaselineList = [];
    let result = undefined;
    var property;
    let moreValuesExist;
    if ( response.lovValues ) {
        result = response.lovValues;
        var resource = 'RevisionRuleAdminConstants';
        var localeTextBundle = localeSvc.getLoadedText( resource );
        var anyConfigBaselineType = localeTextBundle.any;
        property = {
            propDisplayValue: anyConfigBaselineType,
            propInternalValue: 'Any',
            object: { uid: 'Any' }

        };
        configBaselineList.push( property );
        if ( data.dataProviders.configBaselineDataProvider ) {
            moreValuesExist = data.dataProviders.configBaselineDataProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
        }
    }

    if ( result ) {
        for ( var ii = 0; ii < result.length; ii++ ) {
            property = {
                propDisplayValue: result[ii].propDisplayValues.lov_values[ 0 ],
                propInternalValue: result[ii].propInternalValues.lov_values[ 0 ],
                object: {
                    result: result[ii],
                    uid: result[ii].propInternalValues.lov_values[ 0 ]
                }
            };
            configBaselineList.push( property );
        }
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaselineList', configBaselineList );
    return { configBaselineList, moreValuesExist };
};

/**
   * Validate the input to the configuration baseline widget value
   *
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   * @returns {Object} Returns Object
   *
   */
export let validateConfigBaselineWidgetValue = function( data, selected ) {
    let validConfigBaseline = true;
    if( !selected ) {
        return { valid: validConfigBaseline, message: '' };
    }
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaseline = addRevRuleClausePropertyService.getClausePropertiesType( _config_baseline, data );
    let config_baseline = _.cloneDeep( data.config_baseline );

    let newSelection;
    if( selected.length > 0 ) {
        newSelection = selected[0];
    }

    //Configuration Baseline will be valid if either the widget inputText is equal to the Configuration Baseline value in ctx
    // or widget inputText is present in the dataprovider
    var indexOfConfigBaseline = -1;
    if( data.dataProviders.configBaselineDataProvider.viewModelCollection.loadedVMObjects.length > 0 && newSelection?.propInternalValue !== _anyConfigBaselineType ) {
        indexOfConfigBaseline = data.dataProviders.configBaselineDataProvider.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.object.uid;
            } ).indexOf( newSelection?.propInternalValue );
    }

    let isConfigBaselineTypeChangingToAny = false;
    if ( indexOfConfigBaseline < 0 ) {
        if(  newSelection?.propInternalValue === _anyConfigBaselineType ) {
            validConfigBaseline = false;
            if( config_baseline.dbValue !== _anyConfigBaselineType ) {
                isConfigBaselineTypeChangingToAny = true;
            }
            config_baseline.dbValue = data.i18n.any;
            config_baseline.uiValue = data.i18n.any;
        }else if( ctx.RevisionRuleAdmin[configBaseline] &&
            newSelection?.propDisplayValue !== ctx.RevisionRuleAdmin[configBaseline].configBaselineDisplay ) {
            validConfigBaseline = false;
            config_baseline.dbValue = ctx.RevisionRuleAdmin[configBaseline].configBaselineuid;
            config_baseline.uiValue = ctx.RevisionRuleAdmin[configBaseline].configBaselineDisplay;
        }
        data.dispatch( { path: 'data.config_baseline', value: config_baseline } );
    }

    if ( newSelection?.propInternalValue === _anyConfigBaselineType && isConfigBaselineTypeChangingToAny ) {
        changeConfigBaselineTypeToAny( data );
    }
    return { valid: validConfigBaseline, message: '' };
};

let changeConfigBaselineTypeToAny = ( data ) =>{
    var subPanelContext = data.subPanelContext;
    let isSelectedFromAddPanel;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }

    var configBaselineType = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaseline', data );
    var configBaselineData = {
        configBaselineuid: _anyConfigBaselineType,
        configBaselineDisplay: _anyConfigBaselineType
    };
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaselineType, configBaselineData );

    if ( !isSelectedFromAddPanel ) {
        updateConfigBaselineClauseText( data );
    }
};

/**
   * Update Configuration Baseline clause text
   *
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   * @returns {String} Returns updated clause
   *
   */
export let updateConfigBaselineClauseText = function( data ) {
    var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data.subPanelContext );
    if( clauseToBeUpdated && clauseToBeUpdated.entryType === 15 ) {
        return exports.getUpdatedConfigBaselineClause( data, clauseToBeUpdated, false );
    }
};

/**
   * Get updated Configuration Baseline clause
   *
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   * @param {Object} clauseToBeUpdated - modified/added clause
   * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
   * @returns {String} Returns updated clause
   *
   */
export let getUpdatedConfigBaselineClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaseline = _config_baseline;
    var configBaselineState = 'configBaselineState';
    var configBaselineDate = 'configBaselineDate';
    var todayForLMD = 'todayForLMD';

    if( clauseToBeUpdated.entryType === 15 ) {
        if( isForAddClause ) {
            configBaseline = ADDCLAUSE_PREFIX + _config_baseline;
            configBaselineState = ADDCLAUSE_PREFIX + configBaselineState;
            configBaselineDate = ADDCLAUSE_PREFIX + configBaselineDate;
        }

        clauseToBeUpdated.revRuleEntryKeyToValue = {};
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
        if ( ctx.RevisionRuleAdmin[configBaseline].configBaselineuid === _anyConfigBaselineType ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.baseline_type = _anyConfigBaselineType;
        } else if( ctx.RevisionRuleAdmin[ configBaseline ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.baseline_type = ctx.RevisionRuleAdmin[configBaseline].configBaselineuid;
        }

        if( ctx.RevisionRuleAdmin[ configBaselineState ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.baseline_state = ctx.RevisionRuleAdmin[configBaselineState].configBaselineStateuid;
        }

        if( ctx.RevisionRuleAdmin[ configBaselineDate ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date = ctx.RevisionRuleAdmin[configBaselineDate].configBaselineDateDisplay;
        }

        if( ctx.RevisionRuleAdmin[ todayForLMD ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.today = ctx.RevisionRuleAdmin[ todayForLMD ].toString();
        }

        if( !isForAddClause ) {
            return addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
        addRevRuleClausePropertyService.createClausePropertyForAddClause( clauseToBeUpdated, displayText );
    }
};

/**
   * Set selected Configuration Baseline clause
   *
   * @param {DeclViewModel} data - ConfigurationBaselineClauseViewModel
   *
   */
export let configBaselineListSelectionChanged = function( data ) {
    if ( data.eventData && data.eventData.lovValue && data.config_baseline.dbValue === data.eventData.lovValue.propInternalValue ) {
        var subPanelContext = data.subPanelContext;
        if( subPanelContext ) {
            var isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }

        var configBaseline = addRevRuleClausePropertyService.getClausePropertiesType( _config_baseline, data );
        var configBaselineData = {
            configBaselineuid: data.config_baseline.dbValue,
            configBaselineDisplay: data.config_baseline.uiValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaseline, configBaselineData );

        if( !isSelectedFromAddPanel ) {
            updateConfigBaselineClauseText( data );
        }
    }
};

export let setConfigBaselineState = function( data ) {
    if ( data.eventData && data.eventData.lovValue && data.config_baseline_state.dbValue === data.eventData.lovValue.propInternalValue ) {
        var subPanelContext = data.subPanelContext;
        if( subPanelContext ) {
            var isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }
        var config_baseline_state = _.cloneDeep( data.config_baseline_state );
        if( data.config_baseline_state.dbValue !== '' && data.config_baseline_state.dbValue !== 'Open' && data.config_baseline_state.dbValue !== 'Closed' ) {
            config_baseline_state.dbValue = '';
            config_baseline_state.uiValue = data.i18n.any;
            data.dispatch( { path: 'data.config_baseline_state', value:config_baseline_state } );
        }
        var configBaselineState = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaselineState', data );
        var configBaselineData = {
            configBaselineStateuid: config_baseline_state.dbValue,
            configBaselineStateDisplay: config_baseline_state.uiValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaselineState, configBaselineData );

        if( !isSelectedFromAddPanel ) {
            updateConfigBaselineClauseText( data );
        }
    }
};

export let setConfigBaselineLMD = function( data, dateField ) {
    var lastModifyDate = getDateOrDateTimeUiValue( data.config_baseline_date.dbValue, data.subPanelContext.occContext );
    if( data.subPanelContext.activeView === 'RevisionRuleAdminPanel' && data.subPanelContext.nestedNavigationState.selectedClauseIndex === data.subPanelContext.dataProviders.getRevisionRuleInfoProvider.getSelectedIndexes()[0] || data.subPanelContext.activeView === 'AddClauses' ) {
        if( data.config_baseline_date.valueUpdated && ( data.eventData && data.config_baseline_date.dbValue === data.eventData.newValue ) ) {
            var ctx = revisionRuleAdminCtx.getCtx();
            data.config_baseline_date.uiValue = lastModifyDate;
            var configBaselineDate = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaselineDate', data );
            var configBaseline = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaseline', data );
            var configBaselineState = addRevRuleClausePropertyService.getClausePropertiesType( 'configBaselineState', data );
            if( data.config_baseline.dbValue === ctx.RevisionRuleAdmin[configBaseline].configBaselineuid && (  ctx.RevisionRuleAdmin[configBaselineState] === undefined &&
                data.config_baseline_state.dbValue !== ctx.RevisionRuleAdmin[configBaselineState]  || ctx.RevisionRuleAdmin[configBaselineState] !== undefined &&
                    data.config_baseline_state.dbValue === ctx.RevisionRuleAdmin[configBaselineState].configBaselineStateuid ) ) {
                var configBaselineData = {
                    configBaselineDateuid: data.config_baseline_date.dbValue,
                    configBaselineDateDisplay: data.config_baseline_date.uiValue
                };
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaselineDate, configBaselineData );
            }

            if ( data.subPanelContext.nestedNavigationState.currentlySelectedClause.dbValue === 15 ) {
                var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data.subPanelContext );
                if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 15 ) {
                    var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, false );
                    var dateString = data.config_baseline_date.uiValue;
                    if ( dateField.error ) {
                        clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date = '';
                        if( clauseToBeUpdated.displayText !== displayText ) {
                            addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
                        }
                    }
                    var dateStringUiValueForLMD = getDateOrDateTimeUiValue( data.config_baseline_date.dbValue, data.subPanelContext.occContext );
                    var lastModifyDateUiValueForLMD = getDateOrDateTimeUiValue( clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date, data.subPanelContext.occContext );
                    if ( lastModifyDateUiValueForLMD !== dateStringUiValueForLMD && !dateField.error ) {
                        clauseToBeUpdated.revRuleEntryKeyToValue.baseline_last_modify_date = dateString;
                        if( clauseToBeUpdated.displayText !== displayText ) {
                            addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
                        }
                    }
                }
            }
        }
    }
};

export let getUpdatedConfigBaselineObjectClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var baselineObject_type = config_baseline_object;

    // var configBaselineState = 'configBaselineState';

    if( clauseToBeUpdated.entryType === 16 ) {
        if( isForAddClause ) {
            baselineObject_type = ADDCLAUSE_PREFIX + config_baseline_object;
        }
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
        if( ctx.RevisionRuleAdmin[ baselineObject_type ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue = {
                baseline_object: ctx.RevisionRuleAdmin[baselineObject_type].uid
            };
        } else if( clauseToBeUpdated.revRuleEntryKeyToValue ) {
            clauseToBeUpdated.revRuleEntryKeyToValue = undefined;
        }
        if( !isForAddClause ) {
            return addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
        addRevRuleClausePropertyService.createClausePropertyForAddClause( clauseToBeUpdated, displayText );
    }
};
export let updateConfigBaselineObjectClauseText = function( data ) {
    var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data );
    if( clauseToBeUpdated && clauseToBeUpdated.entryType === 16 ) {
        var nestedNavigationState = exports.getUpdatedConfigBaselineObjectClause( data, clauseToBeUpdated, false );
        data.subPanelContext.nestedNavigationState.update( nestedNavigationState );
        var modifiedRevisionRule = revisionRuleAdminPanelService.tagRevisionRuleAsModified( data.revRuleName, data.isClauseModified, nestedNavigationState );
        return { revRuleName:modifiedRevisionRule.revRuleName, isClauseModified:modifiedRevisionRule.isClauseModified };
    }
};

export default exports = {
    setConfigBaselineTypeToAny,
    setConfigBaselineStateToAny,
    setConfigBaselineLMDToday,
    setTodayForLMDCheckBoxTrue,
    configBaselineClausePropertyValueInitialized,
    processConfigBaselines,
    validateConfigBaselineWidgetValue,
    updateConfigBaselineClauseText,
    getUpdatedConfigBaselineClause,
    configBaselineListSelectionChanged,
    setConfigBaselineState,
    setConfigBaselineLMD,
    getUpdatedConfigBaselineObjectClause,
    updateConfigBaselineObjectClauseText
};
