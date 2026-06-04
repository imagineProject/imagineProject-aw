// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/configuratorUtils
 */

import appCtxSvc from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/pca0ExpressionGridService';
import featureService from 'js/pca0FeaturesService';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0Constants from 'js/Pca0Constants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
let exports = {};

/**
 * Show notification message with message type.
 * @param {String} message input message text
 * @param {String} messageType input message type
 */
export let showNotificationMessage = function( message, messageType ) {
    if( message !== '' && message !== undefined ) {
        if( messageType === 'INFO' ) {
            messagingService.showInfo( message );
        } else if( messageType === 'ERROR' ) {
            messagingService.showError( message );
        } else if( messageType === 'WARNING' ) {
            messagingService.showWarning( message );
        }
    }
};

/**
 * Get the instance of the Locale Resource for FullScreenConfiguration
 * (FullScreenConfigurationMessages json file)
 * @return {Object} The instance of locale resource if found, null otherwise.
 */
export let getFscLocaleTextBundle = function() {
    var localeTextBundle = localeService.getLoadedText( 'FullScreenConfigurationMessages' );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
};

/**
 * Get the instance of the Locale Resource for Configurator
 * (ConfiguratorMessages json file)
 * @return {Object} : The instance of locale resource if found, null otherwise.
 */
export let getCustomConfigurationLocaleTextBundle = function() {
    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
};

/**
 *
 * Get Active Variant Rule for Full Screen Configuration
 * This API returns initialVariantRule only when selections are undefined
 * @returns {String} the currently active variant rule
 */
export let getFscActiveVariantRules = function() {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( context.selectedExpressions === undefined && context.initialVariantRule !== undefined && !_.isEmpty( context.initialVariantRule ) ) {
        return [ context.initialVariantRule ];
    }

    // In case of hosted mode, we get the SVR uid as input from the subpanel context
    // SVR uid received from subpanel context is updated to the fsc context in currentAppliedVRs while
    // initializing the fsc view.
    // This function is called every time for vcv soa, so if we everytime return the SVR uid from here, it will always
    // act as loading of svr. Thus maintained a flag isSVRLoadedFromHostedMode which is set to true while initializing
    // the fsc view. Once svr is loaded from hosted mode, we remove the flag
    if ( _.get( context, 'isSVRLoadedFromHostedMode' ) && _.get( context, 'currentAppliedVRs[0]' ) ) {
        return [ {
            uid: context.currentAppliedVRs[ 0 ],
            type:'VariantRule'
        } ];
    }
    return null;
};

/**
 * Validate if given input context is Full Screen Configuration context
 * @param {String} ctx input context
 * @returns {String} Boolean String
 */
export let getIsFscContext = function( ctx ) {
    if( ctx !== undefined && ctx === pca0Constants.FSC_CONTEXT ) {
        return 'true';
    }
    return 'false';
};


/**
 * Helper to get the profile settings object needed for request input
 * @param {Object}appliedSettings  passed in profile settings
 * @returns {String} Profile Settings information - JSON string
 */
export let getProfileSettingsAsRequestInput = function( appliedSettings ) {
    // ProfileDisplayName is the localized string for Custom and OOTB Overlay/Order: skip it
    return _.pick( appliedSettings.validationProfile, [
        'pca0ProfileName',
        'pca0ValidationSeverity',
        'pca0ExpansionSeverity',
        'pca0AllowMultipleSelections',
        'pca0ApplyConstraints',
        'pca0EnableExplicitContentConfiguration',
        'pca0AllowValidationRulesToExpand'
    ] );
};

/**
 * Get Applied profile Settings for Full Screen Configuration
 * @param {String} ctx input context key
 * @returns {String} Profile Settings information - JSON string
 */
export let getProfileSettingsForFsc = function( ctx ) {
    if( ctx !== undefined && ctx !== pca0Constants.FSC_CONTEXT ) {
        return '';
    }
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( !fscContext.appliedSettings || !fscContext.appliedSettings.validationProfile ) {
        return '';
    }

    // ProfileDisplayName is the localized string for Custom and OOTB Overlay/Order: skip it
    var profileSettings = exports.getProfileSettingsAsRequestInput( fscContext.appliedSettings );

    return JSON.stringify( profileSettings );
};

/**
 * Perform localization on input profile
 * I.E. add new property 'pca0ProfileName' to validationProfile.
 * New peoperty is localized if profileName is OOTB Overlay/Order or Custom
 * @param {Object} validationProfile validation profile (solver profile)
 */
export let localizeValidationProfileNames = function( validationProfile ) {
    if( validationProfile.pca0ProfileName === 'pca0Order' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Order;
    } else if( validationProfile.pca0ProfileName === 'pca0OrderWithApplyConstraints' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0OrderWithApplyConstraints;
    } else if( validationProfile.pca0ProfileName === 'pca0Overlay' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Overlay;
    } else if( validationProfile.pca0ProfileName === 'pca0Custom' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Custom;
    } else {
        validationProfile.profileDisplayName = validationProfile.pca0ProfileName;
    }
};

/**
 * This method Control the Visibility of edit buttom in PWA table
 * @param {Object} fscState - fscState atomic data
 */
export let handlePWAEditCommandVisibility = function( fscState ) {
    const variantRuleDirty = fscState.getAtomicData().variantRuleDirty;
    if ( !_.isUndefined( variantRuleDirty ) ) {
        pca0CommonUtils.setVisibilityOfEditCommandInPWA( !variantRuleDirty );
    }
};

/**
 * This method Control the Visibility of save btn on configuration panel
 * @param {Object} eventData context name
 * @param {Object} fscState atomic data
 *
 */
export let handleSaveSVRCommandVisibility = function( eventData, fscState ) {
    //set the dirty state on fscState atomic data - this replaces the former fscontext.variantRulePanelDirty
    if( eventData.selectedCtx === pca0Constants.FSC_CONTEXT && fscState !== undefined && fscState.getAtomicData() !== undefined ) {
        let newFscState = { ...fscState.getAtomicData() };
        let isDirty = newFscState.variantRuleDirty;
        newFscState.variantRuleDirty = eventData.variantRulePanelDirty;
        if( isDirty !== eventData.variantRulePanelDirty ) {
            fscState.setAtomicData( newFscState );
        }
    }
};

/**
 * Initialize variant rule and reset the  dirty state of Variant Rule Panel.
 * @param {Object} eventData data
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData atomic data
 */
export const resetDirtyFlag = ( eventData, fscState, variantRuleData ) => {
    const varContext = appCtxSvc.getCtx( eventData.variantContext );
    varContext.initialVariantRule = eventData.variantRuleVMO;

    if( variantRuleData !== undefined && variantRuleData.getAtomicData() !== undefined ) {
        const newVariantRuleData = { ...variantRuleData.getAtomicData() };
        newVariantRuleData.variantRulesToLoad = [ eventData.variantRuleVMO ];
        variantRuleData.setAtomicData( newVariantRuleData );
    }
    if( fscState !== undefined && fscState.getAtomicData() !== undefined ) {
        const newFscState = { ...fscState.getAtomicData() };
        newFscState.variantRuleDirty = false;
        newFscState.savedVariant = true;
        fscState.setAtomicData( newFscState );
    }
    pca0CommonUtils.setVisibilityOfEditCommandInPWA( true );
};

/**
 * Update the creation state.
 * @param {Object} ruleData atomic data
 * @param {Boolean} isConstraintsData flag to identify if the ruleData is constraints data
 */
export const updateCreationState = ( ruleData, isConstraintsData ) => {
    if( ruleData !== undefined && ruleData.getAtomicData() !== undefined ) {
        const newruleData = { ...ruleData.getAtomicData() };
        if( isConstraintsData ) {
            newruleData.newConstraintCreationState = newruleData.newConstraintCreationState === 'creating' ? 'idle' : 'creating';
        } else {
            newruleData.newVariantCreationState = newruleData.newVariantCreationState === 'creating' ? 'idle' : 'creating';
        }
        ruleData.setAtomicData( newruleData );
    }
};

/**
 * Get Selected Expression from FSC context
 * @returns {ObjectConstructor} the selectedExpressions
 */
export let getSelectedExpressions = function() {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    return context.selectedExpressions;
};

/**
 * Handle Invalid Configuration for possible scenarios:
 * 1. Switching to Guided Mode from Manual Mode with imprecise configuration
 * 2. Selecting an option value when there are invalid rules defined
 * @param {String} cntx context Key
 */
export let handleInvalidConfiguration = function( cntx ) {
    var context = appCtxSvc.getCtx( cntx );
    if( context.switchingToGuidedMode ) {
        eventBus.publish( 'awCustomVariantPanel.showValidationErrorMessage', {
            switchingToGuidedMode: 'true'
        } );
    } else {
        let configExprMap = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );
        if( configExprMap && !_.isEmpty( configExprMap ) && context.family && context.value ) {
            // Remove the last selection from user selection list and retain existing option groups
            var optionValueSelections = configExprMap[ context.family.familyStr ];
            if( optionValueSelections !== undefined ) {
                var indexToRemove = null;
                for( var j = 0; j < optionValueSelections.length; j++ ) {
                    if( optionValueSelections[ j ].nodeID === context.value.optValueStr ) {
                        indexToRemove = j;
                        break;
                    }
                }
                if( indexToRemove !== null && indexToRemove > -1 ) {
                    optionValueSelections.splice( indexToRemove, 1 );
                }
            }
        }

        // Fire event to show error message
        if( context.family !== undefined && context.value !== undefined ) {
            context.validationErrorFamily = context.family.familyDisplayName;
            context.validationErrorValue = context.value.valueDisplayName;
            appCtxSvc.updateCtx( cntx, context );
            eventBus.publish( 'awCustomVariantPanel.showValidationErrorMessage', {
                switchingToGuidedMode: 'false'
            } );
        }
    }
};

/**
 * Build the violation string.
 *
 * @param {String} valueNode - variability data for feature node or group node
 * @param {ObjectArray} labels - Labels to be shown on feature objects like violations etc.
 * @param {String} familyUidIp - familyUidIp - family Uid Input has defaultValue undefined
 *                             - If building violation string for feature, it is must to pass this arg,
 *                               this is essential for marking violations on standalone feature
 * @param {String} gridID - gridID
 * @param {Object} currentSelectedModule - The currently selected module in module hierarchy grid
 * @returns {Object} Violation Info container for the given feature/value
 */
// eslint-disable-next-line complexity
export let buildViolationString = ( valueNode, labels, familyUidIp = undefined, gridID, currentSelectedModule ) => {
    const violationInfos = [];
    const violationInfo = {};
    let violationMessage = '';
    let violationIds = [];
    let nodeMap;
    // isNil will check for null and undefined.
    if( !_.isUndefined( labels ) && !_.isNil( labels ) ) {
        nodeMap = labels.violationMap[ 0 ].nodeMap;
    }
    // We enter if condition for each feature level violationId population.
    // i.e. this function is called for each feature of the group in which
    // we are currently present. And in that case, we enter this if block.

    // isNil will check for null and undefined.
    //coming from VCV the node has all kind of props, like isFeature, groupDisplayName etc, but coming into this common function from calls made in
    //multivariants tab, the nodes have minimal props, so in order to go into this check we need filter featres as either having
    //the isFeature prop or not having the groupDisplayName prop ( as groups are dealt with later in the below code block)
    if( !_.isNil( valueNode ) && ( valueNode.isFeature || !valueNode.hasOwnProperty( 'groupDisplayName' )  ) && !_.isUndefined( nodeMap ) ) {
        // Populate violationIds for the feature level and callee will populate for respective feature's group
        for( const key in nodeMap ) {
            let keyParts = key.split( ':' );

            // When currentSelectedModule is empty or undefined, groupUid is the 1st part
            // When currentSelectedModule is not empty, groupUid is the 2nd part
            let groupUid = currentSelectedModule === '' || currentSelectedModule === undefined ? keyParts[0] : keyParts[1];
            let familyUid = familyUidIp;
            let featureUid = valueNode.optValueStr === undefined ? valueNode.nodeUid : valueNode.optValueStr;

            // Construct tmpUid based on whether currentSelectedModule is empty or not
            let tmpUid;
            if( currentSelectedModule === '' || currentSelectedModule === undefined ) {
                tmpUid = groupUid + ':' + familyUid + ':' + featureUid;
            } else {
                tmpUid = currentSelectedModule + ':' + groupUid + ':' + familyUid + ':' + featureUid;
            }

            // for unconfigured features, we need the uid to be put together in a different way - for now change this only for grid path
            // but in the future we may need to change this for all cases
            if( !featureUid && gridID &&  _.get( valueNode, 'props.isUnconfigured.0' ) === 'true' ) {
                if( currentSelectedModule === '' || currentSelectedModule === undefined ) {
                    tmpUid = groupUid + ':' + familyUid + ':' + familyUid + ':' + valueNode.valueText;
                } else {
                    tmpUid = currentSelectedModule + ':' + groupUid + ':' + familyUid + ':' + familyUid + ':' + valueNode.valueText;
                }
            }
            var violationObj = nodeMap[ tmpUid ];
            if( !_.isUndefined( violationObj ) ) {
                violationIds = violationObj[ 0 ].props.violationIDs;
                // show only 1 violation at feature level.
                // Hence, break it here
                break;
            }
        }
        // We enter else condition for group level violationIds population
        // only once.
        // i.e. this function is called only once for population of violation Ids
        // of the group in which we are currently NOT present, but for which violations
        // may exist
    } else if( !_.isUndefined( nodeMap ) ) {
        for( const key in nodeMap ) {
            // With the new server changes, the violationMap keys now include the moduleUid to avoid incorrect assignment of violations.
            // - For non-top context modules: the key format is moduleUid:groupUid:familyUid:featureUid.
            // - For top context modules: the key format is groupUid:familyUid:featureUid (moduleUid is omitted since it's empty).
            //
            // This change ensures that violations are correctly assigned to the intended group within the correct module,
            // and prevents issues such as assigning violations to the wrong group when the same group (e.g., FSC_Products_Group or FSC_Unassigned_Group)
            // appears across different modules.

            let isMatchingKey = false;

            if ( currentSelectedModule === '' || _.isUndefined( currentSelectedModule )  ) {
                // For top context: key should start with valueNode.uid followed by ':'
                if ( key.startsWith( valueNode.uid + ':' ) ) {
                    isMatchingKey = true;
                }
            } else {
                // For non-top context: key should start with currentSelectedModule + ':' + valueNode.uid + ':'
                if ( key.startsWith( currentSelectedModule + ':' + valueNode.uid + ':' ) ) {
                    isMatchingKey = true;
                }
            }

            if( isMatchingKey ) {
                violationObj = nodeMap[key];
                if ( !_.isUndefined( violationObj ) ) {
                    // Push all violationId in violationIds array
                    violationIds.push( ...violationObj[0].props.violationIDs );
                }
            }
        }
        // Only unique violation Ids should be present
        violationIds = [ ...new Set( violationIds ) ];
    }

    if( violationIds.length > 0 ) {
        for ( let violationIdIdx = 0; violationIdIdx < violationIds.length; violationIdIdx++ ) {
            let violationId = violationIds[violationIdIdx];

            // Add null/undefined checks for labels and its nested properties
            if ( labels && _.get( labels, [ 'violations', 0, 'nodeMap', violationId ] ) ) {
                let violationObj = labels.violations[0].nodeMap[violationId];
                violationMessage = violationObj[0].displayName;
                violationInfo.violationSeverity = violationObj[0].props.serverity[0];
                violationInfo.violationMessage = violationMessage;
                violationInfo.violationId = violationId;

                if ( violationObj[0].props.moduleHierarchyPath ) {
                    let newViolationMessage = exports.buildViolationMessageWithModuleHierarchyPath( violationObj[0].props.moduleHierarchyPath, violationMessage );
                    violationInfo.violationMessage = newViolationMessage;
                }
                violationInfos.push( { ...violationInfo } );
            }
        }
    }
    // This is an array which will contain object containing
    // 1. violation severity
    // 2. violation message
    // 3. violation Id
    return violationInfos;
};

/**
 * Builds the violation message when a ModuleHierarchyPath present
 *
 * @param {String} moduleHierarchyPath - module Hierarchy Path
 * @param {String} violationMessage violation message
 * @returns {String} extended violation message
 */
export let buildViolationMessageWithModuleHierarchyPath = ( moduleHierarchyPath, violationMessage ) => {
    let violationMessageText = exports.getFscLocaleTextBundle().violationMessageWithModuleHierarchyPath;
    const moduleHierarchyJsonPath = JSON.parse( moduleHierarchyPath );
    //as we put together the path it's important to keep in mind to add delimitators that allow for the text to be able to wrap otherwise
    //the text will default to the ellipsis if it cannot fit
    let moduleHierarchyDisplayPath = _.toArray( Object.values( moduleHierarchyJsonPath )[ 0 ].displayInfo ).reverse().join( ' > ' );
    violationMessageText = violationMessageText.replace( '{0}', moduleHierarchyDisplayPath );
    violationMessageText = violationMessageText.replace( '{1}', violationMessage );

    return violationMessageText; //[ moduleHierarchyDisplayPath, violationMessage ].join( ' - ' );
};

/**
 * Sets unique indicators per violation on a vmo
 * @param {Object} violation - An object containing an array of violations for each severity level.
 * @param {Object} vmoObj - The vmo object to which the violations should be added.
 * @param {Array} indicators - indicators array
 */
const _setUniqueIndicators = ( violation, vmoObj, indicators ) => {
    vmoObj.indicators = [ ..._.uniqBy( indicators, 'image' ) ];
    let vmoIndicators = vmoObj.vmo.indicators ? [ ...vmoObj.vmo.indicators, violation ] : [ violation ];
    let uniqArrayOfIndicators = [ ..._.uniqBy( vmoIndicators, 'image' ) ];
    vmoObj.vmo.indicators = uniqArrayOfIndicators;
};

/**
 * Populates violations on a group/feature based on the severity level.
 * @param {Object} violations - An object containing an array of violations for each severity level.
 * @param {Object} vmoObj - The vmo object to which the violations should be added.
 * @param {string} severity - The severity level of the violations to be added.
 * @param {boolean} populateAtGroupLevel - true if violation is to be populated on group. false for feature level violation population
 * @returns {void}
 */
const _populateViolationsPerSeverity = ( violations, vmoObj, severity, populateAtGroupLevel ) => {
    //check if we are in no configuration module scenario or on root in a configuration module hierarchy, deliberate explicit check for both these use cases
    let violationIndex = 1;
    let violationId = '';
    let violationMessage = '';
    // This tells what should be the indicator icon for the violation to be shown
    // at group/feature level.
    const violationSeverityIndicatorImgMap = {
        [ pca0Constants.ERROR_SEVERITIES.ERROR ]: 'indicatorError',
        [ pca0Constants.ERROR_SEVERITIES.WARNING ]: 'indicatorWarning',
        [ pca0Constants.ERROR_SEVERITIES.INFO ]: 'indicatorInfo'
    };

    for( const violation of violations[ severity ] ) {
        // violation Id will be in the form violation001#violation002
        // if the features have violations of violation001 and violation002.
        // Similarly, violation Id will be in the form violation001#violation002
        // if the multiple features in same group have violations of violation001 and violation002.
        violationId += _.isEmpty( violationId ) ? violation.violationId : `#${ violation.violationId }`;
        // Concatenate multiple violation messages on a feature/group into single violation message string.
        violationMessage += _.isEmpty( violationMessage ) ? `${violationIndex++}. ${ violation.violationMessage}` : `\n${violationIndex++}. ${ violation.violationMessage }`;
    }
    let violation = undefined;
    // feature level violation population on feature VMO

    if( !populateAtGroupLevel ) {
        //do not add an error for a child module, violations if exist will be added if there is no configuration module scenario or on
        //root only in a configuration module hierarchy scenario
        violation = {
            violationId: violationId,
            violationMessage: violationMessage,
            violationSeverity: severity
        };
        vmoObj.violationsInfo = violation;

        // Add a violation indicator to the existing 'optValue.indicators' array on vmoObj.
        // When switching from compressed to normal mode, 'optValue.indicators' may be undefined,
        // and violation info is already present in the feature VMO.
        // So when switching back from compressed mode, if we push the violation indicator again,
        // it may result in showing two violation indicators in the UI.

        const indicators = _.get( vmoObj, 'optValue.indicators', [] );

        indicators.push( {
            type: 'violation',
            tooltip: violationMessage,
            image: violationSeverityIndicatorImgMap[severity]
        } );
    } else {
        // group level violation population on group VMO
        violation = {
            type: 'violation',
            tooltip: violationMessage,
            image: violationSeverityIndicatorImgMap[ severity ],
            violationId: violationId
        };
        //do not add an error for a child module, violations if exist will be added if there is no configuration module scenario or on
        //root only in a configuration module hierarchy scenario
        if( vmoObj.vmo ) {
            /* We are adding extra check when populating violation indicators on group.
              When there are multiple violations in a group, the ViolationId will be in the form of
              violation001#violation002. So when we are populating the indicators in the case of validate,expand,
              on scope change and while apply settings, we are checking if the indicators of similar violationIds
              are present already or not. if indicator of violationId is already present, we are not adding
              one more indicator of same violationId to avoid duplicate. If not present, add the violation indicator. */
            const groupIndicators = vmoObj.indicators;
            let newIndicators = [ ...groupIndicators ];
            if( groupIndicators && groupIndicators.length > 0 ) {
                const newViolationsArray = violation.violationId.split( '#' );
                //add everything to a var then make sure things are unique inside before putting it back on the vmo
                vmoObj.indicators.forEach( ( { violationId } ) => {
                    const existingViolationsArray = violationId?.split( '#' );
                    // If violationId is same, don't add this indicator again as it is already present
                    if( violationId === violation.violationId ) {
                        newIndicators = [ ...vmoObj.indicators ];
                        // If violationId is not same, it may in shuffled form.
                        // For ex. violationId001#violationId002 and violationId002#violationId001
                        // should be considered same even if they are in shuffled form. Below checks it
                    } else if( existingViolationsArray && existingViolationsArray.length === newViolationsArray.length ) {
                        let isViolationAdditionNotRequired = newViolationsArray.every( ( item ) => existingViolationsArray.includes( item ) );
                        newIndicators = isViolationAdditionNotRequired ? [ ...vmoObj.indicators ] : [ ...vmoObj.indicators, violation ];
                    } else {
                        newIndicators = [ ...vmoObj.indicators, violation ];
                    }
                } );
            } else {
                newIndicators = [ violation ];
            }
            _setUniqueIndicators( violation, vmoObj, newIndicators );
        } else {
            vmoObj.vmo = exports.createVMO( vmoObj );
            let vmoIndicators = vmoObj.vmo.indicators ? [ ...vmoObj.vmo.indicators, violation ] : [ violation ];
            _setUniqueIndicators( violation, vmoObj, vmoIndicators );
        }
    }
};

/**
 * Populates violation indicators on a group/feature VMO based on the severity level.
 * @param {Object} vmoObj - The group/feature object to which the violation indicators should be added.
 * @param {Object} violations - An object containing an array of violations for each severity level.
 * @param {Boolean} populateAtGroupLevel - true if violation is to be populated on group. false for feature level violation population
 * @returns {void}
 */
export const populateViolationIndicatorsOnVmo = ( vmoObj, violations, populateAtGroupLevel ) => {
    // Show violation icons for each type of severities and its associated violation messages.
    if( !_.isEmpty( violations[ pca0Constants.ERROR_SEVERITIES.INFO ] ) ) {
        _populateViolationsPerSeverity( violations, vmoObj, pca0Constants.ERROR_SEVERITIES.INFO, populateAtGroupLevel );
    }
    if( !_.isEmpty( violations[ pca0Constants.ERROR_SEVERITIES.WARNING ] ) ) {
        _populateViolationsPerSeverity( violations, vmoObj, pca0Constants.ERROR_SEVERITIES.WARNING, populateAtGroupLevel );
    }
    if( !_.isEmpty( violations[ pca0Constants.ERROR_SEVERITIES.ERROR ] ) ) {
        _populateViolationsPerSeverity( violations, vmoObj, pca0Constants.ERROR_SEVERITIES.ERROR, populateAtGroupLevel );
    }
};

/**
 * Populates the violation map with the given violations information.
 * @param {Object} violationMap - The violation map to populate.
 * @param {Array} violationsInfo - The array of violations information.
 */
export let populateViolationMap = ( violationMap, violationsInfo ) => {
    if( !_.isEmpty( violationsInfo ) ) {
        for( let ind = 0; ind < violationsInfo.length; ind++ ) {
            // check if violationMap array already has violation ID to avoid duplication
            // if not, push the violation Id to violationMap array.
            if( !violationMap[ violationsInfo[ ind ].violationSeverity ]
                .some( violationInfo => violationInfo.violationId === violationsInfo[ ind ].violationId ) ) {
                violationMap[ violationsInfo[ ind ].violationSeverity ].push( violationsInfo[ ind ] );
            }
        }
    }
};

/**
 * Get Summary of violations for a group.
 * @param {Object} labels - Labels to be shown on feature objects like violations etc.
 * @param {String} group - Currently active option group in variant panel
 * @param {Object} currentSelectedModule - The currently selected module in module hierarchy grid
 * @returns {Object} Violation Info container for the given group
 */
export let parseResponseAndExtractViolationsForGroup = ( labels, group, currentSelectedModule ) => {
    if( group && !( group.vmo && group.vmo.indicators || group.indicators ) ) {
        group.indicators = [];
    }

    /* General flow is as follows:
        1. violationInfo will be populated using buildViolationString API
        2. Using violationInfo, featureViolations/groupViolations Map will be populated using populateViolationMap API
        3. Using featureViolations/groupViolations Map, violation indicators will be populated on
           group/feature VMO using populateViolationIndicatorsOnVmo API
    */
    if( _.get( labels, 'violationMap[0].nodeMap' ) ) {
        // Get the violation ids from the labels map and extract the keys.
        const violationIds = Object.keys( labels.violationMap[ 0 ].nodeMap );
        const summaryViolationsInfo = [];
        let violationsInfo;
        // This map will contain the violations ( violationId, violationMessage, violationSeverity ) object
        // for the particular type of severity. i.e. error key will contain all error type of severities
        const groupViolations = {
            [ pca0Constants.ERROR_SEVERITIES.ERROR ]: [],
            [ pca0Constants.ERROR_SEVERITIES.WARNING ]: [],
            [ pca0Constants.ERROR_SEVERITIES.INFO ]: []
        };

        // We enter this if condition if we want to populate violations at feature level
        // and we use the same violations to show at the group level
        // Only the duplicate violations will not be shown
        // Ex. Feature1 and Feature2 for a Family will show same violation messages, but group should
        // show only single violation message
        if( !_.isNil( group ) && !_.isNil( violationIds ) && violationIds.length > 0 && group.families ) {
            for( let inx = 0; inx < group.families.length; inx++ ) {
                let violationIds2 = violationIds.map( id => {
                    //free form date comes in the form: GroupUid:CkW5GycSpgwwkB:CkW5GycSpgwwkB:2022-04-19T00:00:00Z"
                    //so you have to just ignore the first part in general

                    if ( currentSelectedModule && !_.isEmpty( currentSelectedModule.trim() ) ) {
                        // If module is present → slice after the 2nd colon
                        const secondColonIndex = id.indexOf( ':', id.indexOf( ':' ) + 1 );
                        return id.slice( secondColonIndex + 1 );
                    }
                    // If no module → slice after the 1st colon
                    const firstColonIndex = id.indexOf( ':' );
                    return id.slice( firstColonIndex + 1 );
                } );

                let family = _.get( group, 'families.' + inx );
                if( !family.values ) {
                    family.values = [];
                }
                if( family.values.length > 0 ) {
                    for( var valueIdx = 0; valueIdx < group.families[ inx ].values.length; valueIdx++ ) {
                        var valueObj = group.families[ inx ].values[ valueIdx ];
                        // Process this value if its ID exist in the violationIds.
                        // As to uniquely identify violation feature, I am holding familyUid:featureUid
                        // This will take care of marking proper violations if we have standalone feature in multiple families
                        if( violationIds2.includes( group.families[ inx ].familyStr + ':' + valueObj.optValueStr ) ) {
                            violationsInfo = exports.buildViolationString( valueObj, labels, group.families[ inx ].familyStr, undefined, currentSelectedModule );
                            if( !_.isEmpty( violationsInfo ) ) {
                                // Update the violations directly onto the value object which is present in the UI model.
                                valueObj.hasViolation = true;

                                // populate feature violation map
                                const featureViolations = {
                                    [ pca0Constants.ERROR_SEVERITIES.ERROR ]: [],
                                    [ pca0Constants.ERROR_SEVERITIES.WARNING ]: [],
                                    [ pca0Constants.ERROR_SEVERITIES.INFO ]: []
                                };
                                // feature level violation population
                                exports.populateViolationMap( featureViolations, violationsInfo );

                                // Once featureViolations map has all the required violations to be shown
                                // at feature level, populate it on feature VMO
                                exports.populateViolationIndicatorsOnVmo( valueObj, featureViolations, false /* false for feature level population */ );
                                // Below computation is for group level violations population.

                                // group level violation population
                                /*
                                    ex. G1
                                         Fam1
                                          Feat1 - violation001
                                          Feat2 - violation001
                                         Fam2
                                          Feat3 - violation002
                                          Feat4 - violation002
                                    If violation takes place for Feat1 and Feat2 and if they have
                                    same violationIds, we do not want to repeat those violation messages
                                    at group level. We only want to show violation1 and violation2 once each
                                */

                                // populate group violations map.
                                // We will be populating these violations
                                // on group VMO outside this block, unlike feature VMO violation population.
                                exports.populateViolationMap( groupViolations, violationsInfo );
                            }
                        }
                    }
                }
            }
            // We enter else when we are in some group and
            // want to show violation message at some other group level.
        } else {
            violationsInfo = exports.buildViolationString( group, labels, undefined, undefined, currentSelectedModule );

            // group level violation population
            // We will be populating these violations
            // on group VMO outside this block.
            exports.populateViolationMap( groupViolations, violationsInfo );
        }

        // As we have all the violations for particular type of severities
        // we are all set now to show it on the GROUPS !
        exports.populateViolationIndicatorsOnVmo( group, groupViolations, true /* true for group level population */ );

        _.forEach( labels.violations[ 0 ].nodeMap, function( violation ) {
            summaryViolationsInfo.push( violation[ 0 ] );
        } );
        return summaryViolationsInfo;
    }
};

/**
 * Get Summary of violations.
 * @param {Object} labels - Labels to be shown on feature objects like violations etc.
 * @param {String} group - Currently active option group in variant panel
 * @param {Object} scopes - The atomic data for scopes
 * @param {Object} currentSelectedModule - The currently selected module in module hierarchy grid
 * @returns {Object} Violation Info container for the given group
 */
export let parseResponseAndExtractViolations = function( labels, group, scopes, currentSelectedModule ) {
    let summaryViolationsInfo = '';
    let newScopes = { ...scopes };
    let tmpGroups = newScopes.scopesList;
    if( tmpGroups && tmpGroups.length > 0 ) {
        tmpGroups.forEach( function( gr ) {
            summaryViolationsInfo = exports.parseResponseAndExtractViolationsForGroup( labels, gr, currentSelectedModule );
            if ( group && group.uid === gr.uid ) {
                group = gr;
            }
        } );
    } else {
        summaryViolationsInfo = exports.parseResponseAndExtractViolationsForGroup( labels, group, currentSelectedModule );
        tmpGroups = [ group ];
    }
    return summaryViolationsInfo;
};

/**
 * Display the error message when switching to guided mode from manual is not allowed.
 * @param {Object} data the view model data object
 * */
export let showUnableToSwitchToGuidedModeMessage = function( data ) {
    messagingService.reportNotyMessage( data, data._internal.messages, 'validationErrorOnSwitchingToGuidedMode' );
};

/**
 * Display validation error message and clean up validation error labels from family/value
 * @param {Object} data the view model data object
 * @param {String} cntx context Key
 */
export let showValidationErrorMessage = function( data, cntx ) {
    messagingService.reportNotyMessage( data, data._internal.messages, 'validationErrorOnSelection' );

    // Remove error family and value from context
    var context = appCtxSvc.getCtx( cntx );
    delete context.validationErrorFamily;
    delete context.validationErrorValue;
};

/**
 * Get System Selection States
 * @returns {Array} list of System selection states
 */
export let getSystemSelectionStates = function() {
    return [ 5, 6, 9, 10 ];
};

/**
 * Initialize local Cache and Effectivity data structure
 * It is used to collaborate on settings changes across multiple subpanels/directives
 * @function initializeCache
 * @param {String} ctxName - Context name
 */
export let initializeCache = function( ctxName ) {
    var context = appCtxSvc.getCtx( ctxName );
    context.settingsCache = {
        effectivityInfo: {
            currentStartEffDates: { dbValues: [ '' ] },
            currentEndEffDates: { dbValues: [ '' ] },
            currentStartEffUnits: { dbValues: [ '-1' ] },
            currentEndEffUnits: { dbValues: [ '-1' ] }
        },
        filterCriteriaModified: false,
        profileSettingsDirty: false
    };

    if( ctxName === pca0Constants.FSC_CONTEXT ) {
        context.settingsCache.profileSettings = {};
    }
    appCtxSvc.updatePartialCtx( ctxName + '.settingsCache', context.settingsCache );
};

/**
 * Initialize Cfg0PosBiasedVariantAvail( whether the Configurator Context is positive biased ) on context
 * @param {Object} cfg0ProductItemData - Configurator Product Item
 * @param {String} contextKey - Context Key
 */
export let initializeCfg0PosBiasedVariantAvailForContext = function( cfg0ProductItemData, contextKey ) {
    const isContextPositiveBiased = _.get( cfg0ProductItemData, 'props.cfg0PosBiasedVariantAvail.dbValues[0]' ) === '1';
    const configContext = appCtxSvc.getCtx( contextKey );
    if( configContext ) {
        appCtxSvc.updatePartialCtx( contextKey + '.isContextPositiveBiased', isContextPositiveBiased );
    }
};

/**
 * Initializes the openedObjectType property in input Configurator Context,
 * using the type from the given cfg0ProductItemData object.
 * @param {object} cfg0ProductItemData - An object containing data for a product item.
 * @param {string} contextKey - The key of the context to update.
 */
export let initializeOpenedObjectTypeForContext = ( cfg0ProductItemData, contextKey ) => {
    const configContext = appCtxSvc.getCtx( contextKey );
    // update the openedObjectType property with the type from the product item data. i.e. Cfg0ProductItem or Cfg0Dictionary
    if( configContext ) {
        appCtxSvc.updatePartialCtx( contextKey + '.openedObjectType', cfg0ProductItemData.type );
    }
};

/**
 * Initialize Config Perspective and Filter Criteria on input Configurator Context
 * @param {Object} configPerspective - Configurator Perspective
 * @param {String} contextKey - Context Key
 */
export let initializeFilterCriteriaForContext = function( configPerspective, contextKey ) {
    var configContext = appCtxSvc.getCtx( contextKey );
    if( configContext ) {
        // Perspective Obj is needed when setting properties on data model service
        configContext.configPerspective = configPerspective;

        // Note: this is redundant (all data is in perspective already)
        // Keeping it for now to be aligned with Settings panel in VCV
        configContext.appliedSettings = {
            configSettings: {
                props: {
                    pca0RevisionRule: configPerspective.props.cfg0RevisionRule,
                    pca0RuleDate: configPerspective.props.cfg0RuleSetCompileDate,
                    pca0Effectivity: configPerspective.props.cfg0RuleSetEffectivity
                }
            }
        };

        // Clear cache
        exports.initializeCache( contextKey );

        // Initialize effectivity
        pca0FilterCriteriaSettingsService.initializeEffectivity( contextKey );

        appCtxSvc.updateCtx( contextKey, configContext );

        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' );
    }
};

/**
 * Initialize 'useAllVariabilityInGridEditor' flag on input Configurator Context
 * @param {String} contextKey - context Key
 * @param {Boolean} isSnOMatrixGridEditor - true when authoring Matrix Rules
 */
export let initializeUseOfAllVariabilityForContext = ( contextKey, isSnOMatrixGridEditor ) => {
    let configContext = appCtxSvc.getCtx( contextKey );
    let useAllVariabilityInGridEditor = false;
    let prefName = isSnOMatrixGridEditor ? veConstants.PCA_MATRIX_GRID_SETTINGS_PREFERENCE : veConstants.PCA_CONSTRAINT_GRID_SETTINGS_PREFERENCE;
    let gridEditorSettingsMap = appCtxSvc.getCtx( 'preferences' )[ prefName ];
    if( _.isUndefined( gridEditorSettingsMap ) ) {
        gridEditorSettingsMap = [];
    }
    for( let index = 0; index < gridEditorSettingsMap.length; index++ ) {
        let preferenceEntry = gridEditorSettingsMap[ index ].split( ':' );
        if( preferenceEntry[ 0 ] === 'useAllVariabilityInGridEditor' ) {
            useAllVariabilityInGridEditor = preferenceEntry[ 1 ].toLowerCase() === 'true';
        }
    }
    configContext.getUseAllVariabilityInGridEditor = useAllVariabilityInGridEditor;
    appCtxSvc.updateCtx( contextKey, configContext );
};

/**
 * Get the map of nodeUID to Node Object from the SOA response
 * @param {Object} response - SOA response
 * @returns {Object} Map containing nodeUID as key and Node as value
 */
let getTreeDataMap = function( response ) {
    let variabilityTreeDataMap = {};
    let variantTreeData = response.variabilityTreeData;
    let treeDataLength = variantTreeData.length;
    for( let ix = 0; ix < treeDataLength; ix++ ) {
        let treeNode = variantTreeData[ ix ];
        if( _.get( treeNode, 'props.isLeaf.0' ) === 'true' && treeNode.props.parent ) {
            // Due to common use of standalone feature we need to identify each features family.
            variabilityTreeDataMap[ treeNode.props.parent + ':' + treeNode.nodeUid ] = treeNode;
        } else {
            variabilityTreeDataMap[ treeNode.nodeUid ] = treeNode;
        }
    }
    return variabilityTreeDataMap;
};

/**
 * Create group node structure to display in FSC view
 * @param {Object} response - vcv2 response
 * @param {ObjectArray} currentScopeLabels - violation information to update the scope list
 * @returns {ObjectArray} group nodes
 */
export let populateScopes = ( response, currentScopeLabels ) => {
    let treeNodes = [];
    let variantTreeData = response.variabilityTreeData;
    let variabilityTreeDataMap = getTreeDataMap( response );
    let vmos = response.viewModelObjectMap;
    let labels = response.labels;
    const configPerspective = response.configPerspective;
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let configurationModulePath = _.get( fscContext, 'configurationModuleHierarchy', '' );
    let currentSelectedModule = configurationModulePath ? configurationModulePath.split( ':' )[0] : '';

    const guidedMode = _.get( response, 'responseInfo.isValid.0' ) === 'false' ? false : fscContext.guidedMode;
    if( !_.isEmpty( variantTreeData ) ) {
        let parentNode = variabilityTreeDataMap[ '' ];
        let wsObjects = undefined;
        if( response.ServiceData && response.ServiceData.modelObjects ) {
            wsObjects = response.ServiceData.modelObjects;
        }
        if( parentNode && parentNode.childrenUids ) {
            parentNode.childrenUids.forEach( id => {
                treeNodes.push( featureService.createGroupsNode(
                    variabilityTreeDataMap, vmos, id, wsObjects, labels, configPerspective, guidedMode, currentScopeLabels, currentSelectedModule
                ) );
            } );
        }
    }
    return treeNodes;
};

/**
 * Return the rule date translation mode
 * @returns {String} rule date translation mode i.e. latest, Default, null, date
 */
export let getRuleDateTranslationMode = function() {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let appliedSettings = fscContext.appliedSettings;
    let ruleDateTranslationMode;
    if( appliedSettings && appliedSettings.ruleDateTranslationMode ) {
        ruleDateTranslationMode = appliedSettings.ruleDateTranslationMode;
    }
    return ruleDateTranslationMode;
};

/**
 * Initialize RevisionRule VM Property for FullScreenConfiguration
 * @return {Object} currentRevisionRule VM property
 */
export let initCurrentRevisionRuleFromSettingsForFSC = function() {
    let contextKey = pca0Constants.FSC_CONTEXT;
    var fscContext = appCtxSvc.getCtx( contextKey );
    var revisionRule = fscContext.appliedSettings.configSettings.props.pca0RevisionRule;
    var currentRevisionRule = uwPropertyService.createViewModelProperty( revisionRule.dbValues[ 0 ], revisionRule.uiValues[ 0 ], 'STRING', revisionRule.dbValues[ 0 ], revisionRule.uiValues );
    currentRevisionRule.isEditable = true;
    return currentRevisionRule;
};

/**
 * Convert the selected expression json string array to single selected Expression object
 * for ex. [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * will be converted to
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * @param {Object} selectedExpressionsJsonArray - selected expression json string array
 * @returns {Object} single selected expression
 */
export let convertSelectedExpressionJsonStringToObject = function( selectedExpressionsJsonArray ) {
    if( _.isEmpty( selectedExpressionsJsonArray ) ) {
        return {};
    }
    let selectedExpressions = {};
    _.forEach( selectedExpressionsJsonArray, ( selectedExpressionsJson ) => {
        let selectedExpression = JSON.parse( selectedExpressionsJson );
        let objectUid = _.keys( selectedExpression )[ 0 ];

        if( _.isEmpty( selectedExpression[ objectUid ] ) ) {
            selectedExpression[ objectUid ].push( {} );
        }
        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'formula' ) ) {
            selectedExpression[ objectUid ][ 0 ].formula = '';
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'expressionType' ) ) {
            selectedExpression[ objectUid ][ 0 ].expressionType = -1;
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'exprID' ) ) {
            selectedExpression[ objectUid ][ 0 ].exprID = '';
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'configExpressionSet' ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet = [];
        }
        if( _.isEmpty( selectedExpression[ objectUid ][ 0 ].configExpressionSet ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet.push( { configExpressionSections: [] } );
        }
        if( _.isEmpty( selectedExpression[ objectUid ][ 0 ].configExpressionSet[ 0 ] ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet[ 0 ].configExpressionSections = [];
        }

        _.assign( selectedExpressions, selectedExpression );
    } );

    return selectedExpressions;
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export const convertSelectedExpressionJsonObjectToString = ( selectedExpressions ) => {
    let selectedExpressionJsonArray = [];
    if( _.isEmpty( selectedExpressions ) || _.isNull( selectedExpressions ) ) {
        if ( !_.isUndefined( appCtxSvc.getCtx( pca0Constants.VCA_CONTEXT ) ) && !_.isNil( appCtxSvc.getCtx( pca0Constants.VCA_CONTEXT ) ) ) {
            return selectedExpressionJsonArray;
        }
        if ( _.isUndefined( appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT ) ) || _.isNil( appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT ) ) ) {
            // If the context is not FSC, return an empty array.
            return selectedExpressionJsonArray;
        }
        selectedExpressionJsonArray.push( JSON.stringify(
            {
                ApplicationConfigExpression: [ {
                    expressionType: 18,
                    formula: '',
                    configExpressionSet: [
                        {
                            configExpressionSections: [
                                {
                                    expressionType: 18,
                                    subExpressions: [
                                        {
                                            expressionGroups: []
                                        }
                                    ]
                                }
                            ]
                        }
                    ] }
                ]
            }
        ) );
    } else {
        _.forOwn( selectedExpressions, ( selectedExpression, objectUid ) => {
            selectedExpressionJsonArray.push( JSON.stringify( {
                [ objectUid ]: selectedExpression
            } ) );
        } );
    }

    return selectedExpressionJsonArray;
};

/**
 * get PCA Grid in JSON format
 * @param {Object} variabilityProps atomic data <variabilityProps>
 * @returns {String} converted JSOn string
 */
export const getJsonStringActiveSelectedExpressions = ( variabilityProps ) => {
    exprGridSvc.removeZeroSelections( variabilityProps.businessObjectToSelectionMap );
    return convertSelectedExpressionJsonObjectToString( exprGridSvc.getPCAGridFromSelectionMap( variabilityProps.businessObjectToSelectionMap ) );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getFscConfigPerspective = function( variantRuleData ) {
    var variantRuleDataValue;
    if( variantRuleData.getAtomicData ) {
        variantRuleDataValue = variantRuleData.getAtomicData();
    } else {
        variantRuleDataValue = variantRuleData.value;
    }

    if( variantRuleDataValue.useDefaultConfigPerspective ) {
        var fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
        //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
        if( fscContext && !fscContext.appliedSettings ) {
            fscContext.appliedSettings = fscContext.defaultAppliedSettings;
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        }
        return variantRuleDataValue.defaultConfigPerspective;
    }
    return variantRuleDataValue.configPerspective;
};

/**
 * This API create a scope VMO object
 *
 * @param {Object} scope - The scope object
 * @returns {Object} - Returns VMO of scope object
 */
export let createVMO = function( scope ) {
    if( scope.vmo !== undefined && ( scope.sourceUid !== pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID || scope.sourceUid !== pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) ) {
        return scope.vmo;
    }
    //todo this makes a fiorst and unassigned vmo different than the rest who return above!!!! streamline it, use vmo api
    var groupIconName;
    if( scope.sourceUid === pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID ) {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_MODEL_FAMILY_GRP_REVISION;
    } else if( scope.sourceUid === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    } else {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    }
    var imageIconUrl = iconSvc.getTypeIconURL( groupIconName );
    if( !imageIconUrl ) {
        //in case this is empty, add the default icon as type missing
        imageIconUrl = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_MISSING );
    }
    return {
        objectID: scope.optGroup,
        uid: scope.optGroup,
        sourceUid: scope.optGroup,
        name: scope.groupDisplayName,
        cellHeader1: scope.groupDisplayName,
        cellHeader2: scope.groupDescription,
        typeIconURL: imageIconUrl,
        vmo: {
            indicators: [],
            objectID: scope.optGroup,
            uid: scope.optGroup,
            sourceUid: scope.optGroup,
            name: scope.groupDisplayName,
            cellHeader1: scope.groupDisplayName,
            cellHeader2: scope.groupDescription,
            typeIconURL: imageIconUrl
        },
        indicators: [],
        getId: function() {
            return this.uid;
        }
    };
};

/**
 * This method uses the current window resolution and compact/comfort mode of AW
 * and the full/not full screen mode to determine if we show or not filter boxes
 * It is approximate and meant to provide a replacement for the 15 features/scopes previously hardcoded as a threshold
 * @param {Integer} nrOfTiles - nr of list box items
 * @param {Boolean} isFullScreen - optional, adjustment for fullscreen
 * @returns {Boolean} true if yes, false if not
 * */
export let determineIfShowFilterBox = function( nrOfTiles, isFullScreen ) {
    const isCompactMode = appCtxSvc.getCtx( 'layout' ) !== 'comfy';
    const adjustedScreenHeight = 0.7 * window.innerHeight / window.devicePixelRatio;
    let needToShowFilterBox = false;
    let doubleIt = isCompactMode ? 1 : 2;
    let aproxTileHeight = 24 * doubleIt;
    let maxNrTilesFitting = Math.round( adjustedScreenHeight / aproxTileHeight ); //aprox, no need to be exact, there is a scrollbar
    let addForFullScreen = isFullScreen ? 2 * doubleIt : 2;
    if( nrOfTiles >= maxNrTilesFitting + addForFullScreen ) {
        needToShowFilterBox = true;
    }
    return needToShowFilterBox;
};

/**
 * Helps to clear system selection in selectedExpression of context
 * @param {Object} fscState - atomic data
 */
export function clearSystemSelectionsFromSelectionsMap( fscState, makeVariantRuleDirty = true  ) {
    let systemSelectionsFound = false;
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let localSelections = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );

    let selections = _.extend( true, [], localSelections );
    if( selections ) {
        // Iterate over the selections map
        for( let [ key, values ] of Object.entries( selections ) ) {
            let valueIndex = 0;

            while( valueIndex < values.length ) {
                if( exports.getSystemSelectionStates().includes( values[ valueIndex ].selectionState ) ) {
                    systemSelectionsFound = true;
                    let localvalues = localSelections[ key ];

                    localvalues.splice( valueIndex, 1 );
                    //If family contained only one selection then remove the family from the map
                    if( localvalues.length === 0 ) {
                        delete localSelections[ key ];
                    }
                } else {
                    valueIndex++;
                }
            }
        }
        // If system selections were found, mark configuration as dirty accordingly
        if( systemSelectionsFound ) {
            // Fire event of dirty configuration in case SVR is loaded
            // In case of:
            // 1- No Variant Rule loaded AND
            // 2- No changes in Settings (filterCriteria + profile) AND
            // 3- there are no selections left (in case user in manual mode de-selected all user selections)
            // THEN send "Configuration clean" event
            // Send "isDirty" event in all other cases

            let variantRulePanelDirty = true;

            if( !context.initialVariantRule && !context.settingsChanged && _.isEmpty( localSelections ) ) {
                variantRulePanelDirty = false;
            }
            //set the dirty state on fscState atomic data
            //since it may come either from fsc directly or via command, take care of both cases
            if( fscState  ) {
                let newState = fscState.value ? { ...fscState.getValue() } : { ...fscState.getAtomicData() };
                //only make the variant rule dirty if caller function doesn't block it. The use case is validate should not
                //make the variant rule dirty when it is called from validate function
                if(  newState.variantRuleDirty !== variantRulePanelDirty && makeVariantRuleDirty ) {
                    // set the new state on the parent who is observing it and will be able to react
                    newState.variantRuleDirty = variantRulePanelDirty;
                    fscState.update ? fscState.update( newState ) : fscState.setAtomicData( newState );
                }
            }
        }
    }
    for( const key in context.selectedExpressions ) {
        _.set( context,
            'selectedExpressions.' + key + '.0.configExpressionSet.0.configExpressionSections.0.subExpressions.0.expressionGroups',
            localSelections );
        break;
    }
    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
}

/**
 * This function empties the data provider and resets the selection
 * @param {Object} dataProvider - The dataProvider
 */
export let resetDataProvider = function( dataProvider ) {
    if ( !_.isEmpty( dataProvider.viewModelCollection.loadedVMObjects ) ) {
        dataProvider.resetDataProvider();
        dataProvider.viewModelCollection.clear();
        dataProvider.selectionModel.selectNone();
    }
};


/**
 * Function used by the summary dialog table to retrieve config expressions after a manual expand in guided mode
 * @param {Object} response - response
 * @return {Object} guidedModeVCVData containing the selected expressions
 */
export let getConfigExpressionsForExpandInGuidedMode = ( response ) => {
    let guidedModeVCVData = {};
    if( !_.isUndefined( response.selectedExpressions ) ) {
        guidedModeVCVData = exports.convertSelectedExpressionJsonStringToObject( response.selectedExpressions );
    }
    return guidedModeVCVData;
};


/**
 * gets the Configuration Module display name from the context defaulting into taking the rootNode name from the configurationModuleHierarchy if exists
 * otherwise it will return ''
 * @returns {Object} name and uid of the config module
 */
export let getConfigurationModuleFromContext = () => {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let rootName = _.get( context, 'currentConfigPerspective.props.cfg0ProductItems.uiValues.0' );
    if ( !rootName ) {
        rootName = '';
    }
    let configurationModulePath = _.get( context, 'configurationModuleHierarchy' );
    let ret = {
        name: rootName,
        uid: undefined
    };
    if( configurationModulePath && configurationModulePath.split( ':' ).length > 0 ) {
        ret.uid = configurationModulePath.split( ':' )[0];
        let vmo = viewModelObjectService.createViewModelObject( ret.uid );
        ret.name = vmo ? vmo.cellHeader1 : rootName;
    }
    return ret;
};

/**
 * Reset the flag of fscContext expressionExpandedState to false.
 * i.e. user has loaded some other SVR, unloaded the SVR, made any selection of Feature/ Family,
 * made any profile change in settings panel, clear selections, etc. then the expressionExpandedState
 * will be reset to false as the VR is dirty now
 */
export const resetExpressionExpandedState = () => {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( context && context.expressionExpandedState === true ) {
        appCtxSvc.updatePartialCtx( pca0Constants.FSC_CONTEXT + '.expressionExpandedState', false );
    }
};

/**
 * Returns created variant rule from SOA response
 *
 * @param {Object} response the response from the variant configuration view SOA
 *
 * @returns {Object} Created variant rule.
 */
export let getCreatedVariantRule = function( response ) {
    return pca0CommonUtils.getCreatedVariantRule( response );
};

/**
 * We get to know if the expression was expanded by user and no dirtyness after expand has been performed.
 * i.e. user has not loaded some other SVR, not unloaded the SVR, has not made any selection of Feature/ Family,
 * has not made any profile change in settings panel, has not clear selections, etc. after hitting the expand action, then
 * this function will return false, else true.
 * @returns {String} - 'true' if user has expanded the expression else 'false'
 */
export const getExpressionExpandedState = () => {
    return pca0CommonUtils.getExpressionExpandedState();
};

/**
 * Get current Configuration mode
 * @param {String} ctx name of current context
 * @returns {String} current variant mode Guided/Manual
 */
export const getConfigurationMode = ( ctx ) => {
    return pca0CommonUtils.getConfigurationMode( ctx );
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @param {String} soaName - The name of the SOA
 * @returns {Object} The property policy
 */
export const getPropertyPolicy = ( soaName ) => {
    return pca0CommonUtils.getPropertyPolicy( soaName );
};

/** Helps to get configurator context with respect to module
 * @param {String} contextName - Name of context that we need to fetch from global ctx
 * @param {Object} configCtx - Configurator context provided by consumer apps
 * @returns {Object} VariantContext required to call VCV3 SOA
 */
export let getSelectionForVariantContext = ( contextName, configCtx ) => {
    return pca0CommonUtils.getSelectionForVariantContext( contextName, configCtx );
};

/**
 * clears all selections related entries from context. It is used in the fscContent component to clear our internal data whether there are or not scopes and features
 * When they exist, they will then clear the UI from selections in a following and separate function intiated by the feature component
 * */
export let clearAllSelectionsFromContext = () => {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    delete context.violations;
    delete context.responseInfo;
    delete context.payloadStrings;
    context.selectedExpressions = {};
    delete context.allSelectionsExt;
    // Delete cached data on required Families
    delete context.incompleteFamiliesInfo;
    delete context.isNextRequiredClicked;

    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
};

/**
 * Generates the input object required to create a VariantRule in a hosted configurator context.
 *
 * @param {Object} eventData - The event data containing information for the VariantRule.
 * @returns {Array} An array containing the input object for creating a VariantRule.
 */
export let getCreateVariantRuleInputHostedConfigurator = ( eventData ) => {
    const preferences = appCtxSvc.getCtx( 'preferences' );
    let createVariantRuleType = _.get( preferences, 'Cfg0CreateVariantRuleType' );

    let propertyNameValues = {
        object_desc: [ eventData.description ? eventData.description : '' ],
        object_name: [ eventData.name ]
    };

    // Check if criteria should be added
    if ( createVariantRuleType && createVariantRuleType[0] === 'Cfg0VariantCriteria' && eventData.cfg0CriteriaId ) {
        propertyNameValues.cfg0CriteriaId = [ eventData.cfg0CriteriaId ];
    }

    return [ {
        clientId: 'CreateObject',
        createData: {
            boName: createVariantRuleType[0],
            propertyNameValues: propertyNameValues,
            compoundCreateInput: {}
        }
    } ];
};

export default exports = {
    showNotificationMessage,
    getFscLocaleTextBundle,
    getCustomConfigurationLocaleTextBundle,
    getFscActiveVariantRules,
    getIsFscContext,
    getProfileSettingsAsRequestInput,
    getProfileSettingsForFsc,
    localizeValidationProfileNames,
    handlePWAEditCommandVisibility,
    handleSaveSVRCommandVisibility,
    resetDirtyFlag,
    updateCreationState,
    getSelectedExpressions,
    handleInvalidConfiguration,
    buildViolationString,
    buildViolationMessageWithModuleHierarchyPath,
    populateViolationIndicatorsOnVmo,
    populateViolationMap,
    parseResponseAndExtractViolationsForGroup,
    parseResponseAndExtractViolations,
    showUnableToSwitchToGuidedModeMessage,
    showValidationErrorMessage,
    getSystemSelectionStates,
    initializeCache,
    initializeCfg0PosBiasedVariantAvailForContext,
    initializeOpenedObjectTypeForContext,
    initializeFilterCriteriaForContext,
    initializeUseOfAllVariabilityForContext,
    populateScopes,
    getRuleDateTranslationMode,
    initCurrentRevisionRuleFromSettingsForFSC,
    convertSelectedExpressionJsonStringToObject,
    convertSelectedExpressionJsonObjectToString,
    getJsonStringActiveSelectedExpressions,
    getFscConfigPerspective,
    createVMO,
    determineIfShowFilterBox,
    clearSystemSelectionsFromSelectionsMap,
    resetDataProvider,
    getConfigExpressionsForExpandInGuidedMode,
    getConfigurationModuleFromContext,
    resetExpressionExpandedState,
    getCreatedVariantRule,
    getExpressionExpandedState,
    getConfigurationMode,
    getPropertyPolicy,
    getSelectionForVariantContext,
    clearAllSelectionsFromContext,
    getCreateVariantRuleInputHostedConfigurator
};
