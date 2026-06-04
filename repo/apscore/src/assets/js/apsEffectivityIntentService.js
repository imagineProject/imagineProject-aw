// Copyright (c) 2022 Siemens
/**
 * Service for handling effectivity intent with available families and their values.
 *
 * @module js/apsEffectivityIntentService
 */
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

/** formula for effectivity intent */
var _formula = null;
var _existingFormulaToEdit = null;
var _existingIntentCtx;
var _availableEffResp = null;
var exports = {};

/**
  * This function will initialize the active ACE context with the Intent Item Id and namespace.
  * This value will be used by the view model of the effectivity intent sub view to query the
  * available effectivity intents.
  */

export let initIntentContext = function( occContext ) {
    // Populate effectivity intent related context info if we are in ACE.
    if ( !occContext ) {
        return;
    }
    // Populate the current intent formula, if any. Clear otherwise.
    let readOnly = isReadOnly( occContext.productContextInfo );
    let effIntentCtx = {};
    effIntentCtx.effIntentCtxId = occContext.productContextInfo.props.fgf0EffContextId.dbValues[0];
    effIntentCtx.effIntentCtxNamespace = occContext.productContextInfo.props.fgf0EffContextNamespace.dbValues[0];
    effIntentCtx.isReadOnly = readOnly;
    return effIntentCtx;
};

// This function will try to find out whether the active effectivity feature is read only or not.
var isReadOnly = function( productContextInfo ) {
    var supportedFeaturesObjects = productContextInfo.props.awb0SupportedFeatures;
    if ( supportedFeaturesObjects ) {
        for ( var supportedFeatureObject = 0; supportedFeatureObject < supportedFeaturesObjects.dbValues.length; supportedFeatureObject++ ) {
            var featureObject = cdm.getObject( supportedFeaturesObjects.dbValues[supportedFeatureObject] );

            if ( featureObject.type === 'Awb0FeatureList' ) {
                var nonModifiableFeatures = featureObject.props.awb0NonModifiableFeatures;

                for ( var feature = 0; feature < nonModifiableFeatures.dbValues.length; feature++ ) {
                    if ( nonModifiableFeatures.dbValues[feature] === 'Awb0UnitRangeEffectivityFeature' ||
                         nonModifiableFeatures.dbValues[feature] === 'Awb0DateRangeEffectivityFeature' ||
                         nonModifiableFeatures.dbValues[feature] === 'Fgf0AllEffectivityConfigFeature' ||
                         nonModifiableFeatures.dbValues[feature] === 'Fgf0EffectivityIntentFeature' ) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

/**
  * Retrieves intent families and their values recursively from configExpressions.
  *
  * @param {Object} effIntents - effectivity intents object
  *
  * @param {Object} configExpression - config expressions
  *
  */
function loadIntentFamiliesInternal( effIntents, currentValueMap, configExpression ) {
    if ( configExpression.value !== null ) {
        var family = configExpression.value.family;
        if ( family.type === 'ConfigurationFamily' ) {
            var namespace = family.props.namespace.dbValues[0];
            var famName = family.props.name.dbValues[0];

            if ( namespace !== 'Teamcenter::' ) {
                var value = configExpression.value.name;

                if ( !effIntents.familiesValuesMap[famName] ) {
                    effIntents.familiesValuesMap[famName] = {};
                    effIntents.familiesValuesMap[famName].response = [];

                    var famProperty = exports.createIntentProperty( famName, true );
                    var famKey = {};
                    famKey.famProp = famProperty;

                    // populate current value from getEffectivitySubsetTable SOA
                    var curValProperty;
                    var anyValProperty = exports.createIntentProperty( exports.getAnyValueDisplayName(), true );
                    anyValProperty.familyName = famName;

                    if ( currentValueMap !== {} && currentValueMap.hasOwnProperty( famName ) ) {
                        curValProperty = exports.createIntentProperty( currentValueMap[famName], true );
                    } else {
                        curValProperty = anyValProperty;
                    }

                    famKey.currentValue = curValProperty;
                    effIntents.families.push( famKey );

                    // Add any to values list
                    effIntents.familiesValuesMap[famName].response.push( anyValProperty );
                }

                var exist = false;
                for ( var inx = 0; inx < effIntents.familiesValuesMap[famName].response.length; inx++ ) {
                    if ( effIntents.familiesValuesMap[famName].response[inx].uiValue === value ) {
                        exist = true;
                        break;
                    }
                }
                if ( !exist ) {
                    var valProp = exports.createIntentProperty( value, true );
                    valProp.familyName = famName;
                    effIntents.familiesValuesMap[famName].response.push( valProp );
                }
            }
        }
    }

    for ( var i = 0; i < configExpression.subExpressions.length; i++ ) {
        loadIntentFamiliesInternal( effIntents, currentValueMap, configExpression.subExpressions[i] );
    }
}
/**
  * Get display name of Any text from i10n.
  *
  * @return {Object} - the localized text for Any
  *
  */
export let getAnyValueDisplayName = function() {
    //todo needs to be checked if should be public.
    var localTextBundle = localeService.getLoadedText( 'ApsEffectivityMessages' );
    return localTextBundle.ApsAny;
};

/**
  * Creates a view model property for given property value.
  *
  * @return {Object} - the view model property created.
  *
  */
export let createIntentProperty = function( propVal, setPropVal ) {
    var vwProp = uwPropertyService.createViewModelProperty( 'apsEffectivityIntent', propVal, 'STRING', '', '' );
    if ( setPropVal ) {
        vwProp.dbValue = propVal;
        vwProp.uiValue = propVal;
        vwProp.propertyDisplayName = propVal;
    }
    vwProp.propDisplayValue = propVal;

    return vwProp;
};

/**
  * Retrieves effectivity intent families and their values and populate map data for intent authoring.
  *
  * @param {Object} data - data object
  *
  */

export let loadIntentFamilies = function( response ) {
    _availableEffResp = response;
    var effIntents = {};
    effIntents.familiesValuesMap = {};
    effIntents.families = [];
    var currentValueMap = {};
    if ( exports.getExistingFormula() !== null ) {
        var formulaStrs = exports.getExistingFormula().split( ' & ' ).join( ' | ' ).split( ' | ' );
        formulaStrs.forEach( function( curFormula ) {
            var expressionStr = curFormula.substr( curFormula.indexOf( ']' ) + 1, curFormula.length );
            var famVal = expressionStr.split( ' = ' );
            currentValueMap[famVal[0]] = famVal[1];
        } );
    }
    loadIntentFamiliesInternal( effIntents, currentValueMap, response.configExpressions[0] );
    appCtxSvc.updateCtx( 'effIntents', effIntents );
    return effIntents;
};

/**
  * Retrieves effectivity intent existing formula string returned from getEffectivitySubsetTables SOA.
  * @returns {String} existing intent formula
  */
export let getExistingFormula = function() {
    // return existing formula
    return _existingFormulaToEdit;
};

/**
  * Clears the existing formula returned from getEffectivitySubsetTables SOA.
  *
  */
export let clearExistingFormula = function() {
    // clear existing formula
    _existingFormulaToEdit = null;
};

/**
  * This method returns effectivity intent formula based on data provided from intent UI.
  *
  * @return {object} - string formula
  */
export let getEffIntentFormula = function() {
    return _formula;
};

/**
  * This method returns effectivity intent formula based on data provided from intent UI.
  *
  * @return {object} - string formula
  */
export let setIntentFormulaToEdit = function( formulaStr ) {
    _existingFormulaToEdit = formulaStr;
    _formula = formulaStr;
};

/**
  * This method returns effectivity intent item.
  *
  * @return {object} - intent item object
  */
export let getIntentItem = function( occContext ) {
    return occContext.productContextInfo.props.fgf0EffContextId.dbValues[0];
};

/**
  * This method builds effectivity intent formula based on data provided from intent UI.
  *
  * @param {Object} data - data object
  *
  * @return {object} - string formula
  */
export let setEffIntentFormula = function( effIntents, occContext ) {
    var formula = '';
    var andToken = ' & ';
    var intentItemName = exports.getIntentItem( occContext );

    for ( var idx = 0; idx < effIntents.families.length; idx++ ) {
        var famName = effIntents.families[idx].famProp.propertyDisplayName;
        var valueName = effIntents.families[idx].currentValue.propertyDisplayName;
        if ( valueName !== exports.getAnyValueDisplayName() ) {
            formula = formula + '[' + intentItemName + ']' + famName + '=' + valueName + andToken;
        }
    }

    // trim last token
    _formula = formula.substr( 0, formula.length - 3 );
    return formula.substr( 0, formula.length - 3 );
};

/**
  * This method returns an array of Intent values for the given family.
  *
  * @param {Object} family - family object
  *
  * @return {object} - Intent Values
  */
export let getIntentValuesForFamily = function( family, effIntents ) {
    return effIntents.familiesValuesMap[family.famProp.propertyDisplayName].response;
};


/**
  * This method updates the effectivity context with the new current value of the family.
  *
  * @param {Object} family - family object
  *
  * @param {object} newIntentValue - New Intent Value selected in the UI
  */

export let getIntentFormula = function( family, newIntentValue, currentEffIntents, occContext ) {
    var famName = family.famProp.propertyDisplayName;
    let newEffIntents = { ...currentEffIntents };

    // check famName is same as family from newIntentValue
    if ( famName !== newIntentValue.familyName ) {
        return;
    }

    for ( var idx = 0; idx < currentEffIntents.families.length; idx++ ) {
        if ( currentEffIntents.families[idx].famProp.propertyDisplayName === famName ) {
            newEffIntents.families[idx].currentValue = newIntentValue;
            break;
        }
    }
    // update formula
    return exports.setEffIntentFormula( newEffIntents, occContext );
};

/*Get ViewModelProperty for each string in a given array of strings */

export let createVMPropertyObjectsFromEffIntentStrings = function( stringsArr ) {
    return stringsArr.map( ( str ) => {
        let vwProp = uwPropertyService.createViewModelProperty( str, str, 'STRING', '', '' );
        vwProp.dbValue = str;
        vwProp.uiValue = str;
        vwProp.propertyDisplayName = str;
        vwProp.propDisplayValue = str;
        vwProp.propertyLabelDisplay = 'NO_PROPERTY_LABEL';
        return vwProp;
    } );
};

export default exports = {
    initIntentContext,
    getAnyValueDisplayName,
    createIntentProperty,
    loadIntentFamilies,
    getExistingFormula,
    clearExistingFormula,
    getEffIntentFormula,
    setIntentFormulaToEdit,
    getIntentItem,
    setEffIntentFormula,
    getIntentValuesForFamily,
    getIntentFormula,
    createVMPropertyObjectsFromEffIntentStrings
};

