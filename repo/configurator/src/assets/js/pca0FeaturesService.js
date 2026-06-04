/* eslint-disable complexity */

// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0FeaturesView
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0FeaturesService
 */
import appCtxSvc from 'js/appCtxService';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dateTimeService from 'js/dateTimeService';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/pca0ExpressionGridService';
import iconSvc from 'js/iconService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import Pca0FamilyProvider from 'viewmodel/Pca0FamilyProviderViewModel';
import viewModelObjectService from 'js/viewModelObjectService';

import { getField } from 'js/utils';
import $ from 'jquery';
import _ from 'lodash';

var exports = {};

var VCV_ACTIONS = {
    VALIDATE: 'validate',
    EXPAND: 'expand',
    SWITCHINGTOMANUAL: 'switchingToManual',
    SCOPE_CHANGE: 'scopeChange'
};

/**
 * This helper sets removes the indicators from feature vmo.
 * @param {Object} value - feature data
 * @param {Object} selectionType - type of selection  i.e. all or system
 * @returns {Object} - Returns the updated values
 */
let _removeIndicators = ( value, selectionType ) => {
    // Remove only the indicators on the feature by honoring the selectType parameter that is sent as input to this function
    // If the selection type is system, then remove all indicators except violations
    // If selection type is all, then remove all indicators
    let newOptValue = { ...value.optValue };
    // If the selection type is system, then remove all indicators except violations
    if( selectionType === 'system' ) {
        // Keep only violations and release indicators
        newOptValue.indicators = newOptValue.indicators.filter(
            indicator =>
                indicator.type === 'violation' ||
                indicator.image === 'indicatorReleased'
        );
    } else if( selectionType === 'all' ) { // If selection type is all, then remove all indicators
        // Retain only the 'release flag' indicator by filtering out all other indicators
        newOptValue.indicators = newOptValue.indicators.filter(
            indicator => indicator.image === 'indicatorReleased'
        );
    }
    return newOptValue;
};

/**
 * This helper sets isVariantRuleDirty flag on fscState atomic data is rule is loaded
 * @param {Object} fscState - fscState atomic data
 */
const _setIsVariantRuleDirtyFlag = ( fscState ) => {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let variantRulePanelDirty = false;
    if( context.initialVariantRule ) {
        variantRulePanelDirty = true;
    } else if( !context.settingsChanged ) {
        variantRulePanelDirty = false;
    }
    //set the dirty state on fscState atomic data
    if( fscState ) {
        let newState = { ...fscState.getValue() };
        // set the new state on the parent who is observing it and will be able to react
        newState.variantRuleDirty = variantRulePanelDirty;
        fscState.update( newState );
    }
};

/**
 * This helper iterates thorugh the selectedExpressions node map and creates objects that have a value coming form server
 * but don't exist on the scope's families (the real use case is that they have been deleted by the user)
 * @param {Object} freeFormExpressionNodesWithValue - The map of nodes with values that need potentially to be recreated
 * @param {Object} tempScope - The temps scope to search
 */
let _reCreateFreeFormFeature = function( freeFormExpressionNodesWithValue, tempScope ) {
    if( freeFormExpressionNodesWithValue ) {
        _.values( freeFormExpressionNodesWithValue ).forEach( node => {
            let familyObj = _.find( tempScope.families, { familyStr: node.family } );
            if( familyObj ) {
                let valueObj = _.find( familyObj.values, { optValueStr: node.family + ':' + node.valueText } );
                if( !valueObj ) {
                    let valueVMO = exports.createFreeFormFeature( familyObj );
                    valueVMO.selectionState = node.selectionState;
                    valueVMO.dbValue = node.valueText;
                    if( !familyObj.values ) {
                        familyObj.values = [];
                    }
                    familyObj.values.push( valueVMO );
                }
            }
        } );
    }
};

/**
 * This helper returns the string of full path needed to use for the mapNodeAndSelectionState in order to
 * correctly identify all the situations: selected features including affectedNodes(the config modules) free forms features
 * or same feature in multiple families
 * @param {Object} obj -the object for the family or feature
 * @returns {Array of Strings} - ValueNodeUidFullPaths in the form of configModuleUid:familyUid:featureUid or familyUid:featureUid if no config Modules or simply familyUid if family election only
 */

let _getNodeUidFullPaths = ( obj ) => {
    let valueNodeUids = [];
    let valueNodeUid = '';
    if( obj.nodeUid ) {
        if( obj.family !== obj.nodeUid ) {
            valueNodeUid = obj.family + ':' + obj.nodeUid;
        } else {
            //for none/any which are selections on family use the family only
            valueNodeUid = obj.family;
        }
    }
    // free form family selection, does not have a nodeUId
    else {
        if( obj.valueText ) {
            valueNodeUid = obj.family + ':' + obj.valueText;
        } else {
            valueNodeUid = obj.family;
        }
    }

    //if the node is present in more than one config module path, add each one to the paths
    if( obj.affectedNodes && obj.affectedNodes.length > 0 ) {
        obj.affectedNodes.forEach( ( afNode ) => {
            valueNodeUids.push( afNode.nodeUid + ':' + valueNodeUid );
        } );
    } else {
        //if there is no nodeUid as in
        valueNodeUids.push( valueNodeUid );
    }

    return valueNodeUids;
};

/**
 * This helper creates maps from selected expressions to be used in the update process
 *
 * @param {Object} selectedExpressions - The selectedExpressions from the response received by SOA service
 * @returns {Object} - object containing the mapNodeAndValueText, mapNodeAndSelectionState and the freeFormExpressionNodesWithValue
 */
let _getSelectedExpressionValuesMaps = function( selectedExpressions ) {
    let selectedExpression = _.values( selectedExpressions )[ 0 ];
    let configExprSet = selectedExpression[ 0 ].configExpressionSet;
    let configExprSection = configExprSet[ 0 ].configExpressionSections;
    let subExpression = configExprSection.length ? configExprSection[ 0 ].subExpressions[ 0 ] : null;
    if( subExpression === null ) {
        return {};
    }
    let expressionGroups = subExpression.expressionGroups;
    let mapNodeAndValueText = {};
    let mapNodeAndSelectionState = {};
    let freeFormExpressionNodesWithValue = {};
    _.keys( expressionGroups ).forEach( node => {
        let nodeMap = expressionGroups[ node ];
        // create a map of UID and selection state and one for textValues (for free forms).
        nodeMap.forEach( ( obj ) => {
            // feature level selection state
            if( !obj.nodeUid && obj.valueText ) {
                //free form family selection, does not have a nodeUId

                //following expand,the value text and its selection state can change, make sure it's updated

                //comment it back in to test UI against what came from server
                //console.info( 'Fsc: SelectedExpression with valueText [Family Select Value]: ' + obj.family + ' ' + obj.familyId + ' ' + obj.selectionState + ' ' + obj.valueText );
                let valueNodeUid = obj.family + ':' + obj.valueText;
                let emptyValueNodeUid = obj.family + ':';
                mapNodeAndValueText[ valueNodeUid ] = obj.valueText;

                //the response from server for ff comes without a node id; keeping both use cases in the map,
                //so it can be found and mapped correctly to the value in all use cases
                mapNodeAndValueText[ emptyValueNodeUid ] = obj.valueText;
                mapNodeAndSelectionState[ emptyValueNodeUid ] = obj.selectionState;
                freeFormExpressionNodesWithValue[ valueNodeUid ] = obj;
            }
            //for every use case add now the selectionState based on the paths
            let valueNodeUidFullPaths = _getNodeUidFullPaths( obj );
            valueNodeUidFullPaths.forEach( ( valueNodeUid ) => {
                mapNodeAndSelectionState[ valueNodeUid ] = obj.selectionState;
            } );
        } );
    } );

    return {
        mapNodeAndSelectionState: mapNodeAndSelectionState,
        mapNodeAndValueText: mapNodeAndValueText,
        freeFormExpressionNodesWithValue: freeFormExpressionNodesWithValue
    };
};

/**
 * Creates family command context for the given family
 * @param {Object} family Famly object data
 * @param {String} perspectiveUid Perspective uid
 * @param {boolean} isGuidedMode true if guided mode is enabled
 * @returns {Object} Returns the family command context.
 */
const _createFamilyCommandContext = ( family, perspectiveUid, isGuidedMode ) => {
    let familyCmdContext = {
        family: { ...family },
        famIndex: family.famIndex,
        showEnumeratedRange: !isGuidedMode,
        configPerspectiveUid: perspectiveUid,
        guidedMode: isGuidedMode,
        isFreeForm: family.isFreeForm
    };
    delete familyCmdContext.family.values;
    delete familyCmdContext.family.familyCmdContext;

    return familyCmdContext;
};

/**
 * This helper function compares selections for loaded variant rule and the selections after expand
 * @param {String} action - expand or validate
 * @param {Object} fscContext - application specific context to get selection for loaded variant rule before expand.
 * @param {Object} mapOfSelectedExpression - selections after expand for loaded variant rule
 * @returns {Boolean} - Returns true if variant rule is dirty after expand
 */
const _checkIfLoadedVariantRuleIsDirtyAfterExpand = ( action, fscContext, mapOfSelectedExpression ) => {
    let result = false;
    if( action === VCV_ACTIONS.EXPAND && fscContext.initialVariantRule && fscContext.selectedExpressions )  {
        const mapOfSelectedExpressionBeforeExpand = _getSelectedExpressionValuesMaps( fscContext.selectedExpressions );
        if( !_.isEqual( mapOfSelectedExpressionBeforeExpand.mapNodeAndSelectionState, mapOfSelectedExpression.mapNodeAndSelectionState ) ) {
            result = true;
        }
    }

    return result;
};

/**
 * Helps to prepare the meta data for the feature fetched for the preference Cfg0AbsConfiguratorWSO.cellProperties
 * @param {Array} vmoMetaProps - Array of cell properties/meta properties.
 * @returns {Array} - Returns meta data
 */
const _getUserPreferredMetaData = ( vmoMetaProps ) => {
    const matches = [];

    if ( vmoMetaProps ) {
        // Regex: Match everything after '\\:' and capture it as we have meta props as 'key\\:value'
        const regex = /[^\\]+\\:(.+)/;

        let propsFound = 0;
        for ( const prop of vmoMetaProps ) {
            const match = prop.match( regex );

            if ( match ) {
                const value = match[1];
                if ( matches.length > 0 ) {
                    matches.push( ', ' );
                }
                matches.push( value );
                propsFound++;
                if ( propsFound >= pca0Constants.MAX_META_DATA_PROPS_VCV_LIST_VIEW ) {
                    break;
                }
            }
        }
    }

    return matches;
};

/**
 * Removes all violation indicators from all group-level scopes and the currently selected group.
 *
 * @param {Object} scopes - The object containing scope information, including the selected group.
 * @returns {Object} - An updated scope object with violations removed from all groups and features within the current group.
 */
let _removeViolations = ( scopes ) => {
    if ( !scopes || !scopes.scopesList || scopes.scopesList.length === 0 ) {
        return;
    }

    let newScopes = { ...scopes };

    // Remove violations from the currently selected group
    let group = newScopes.selectedGroup;
    if( group && group.families ) {
        for( let j = 0; j < group.families.length; j++ ) {
            let family = group.families[ j ];
            if( family.values ) {
                for( let k = 0; k < family.values.length; k++ ) {
                    let value = family.values[ k ];
                    delete value.violationsInfo;
                    value.hasViolation = false;

                    if( value.optValue ) {
                        _.remove( value.optValue.indicators, { type: 'violation' } );
                    }
                }
            }
        }

        let foundScope = _.find( newScopes.scopesList, { uid: group.uid } );
        if( foundScope && foundScope.indicators ) {
            _.remove( foundScope.indicators, { type: 'violation' } );
            _.remove( foundScope.vmo.indicators, { type: 'violation' } );
        }

        newScopes.scopesList[ newScopes.selectedScopeIndex ] = group;
    }

    // Remove violations from all scopes
    newScopes.scopesList.forEach( function( scope ) {
        if( scope.vmo ) {
            _.remove( scope.indicators, { type: 'violation' } );
            _.remove( scope.vmo.indicators, { type: 'violation' } );
        }
    } );

    return { newScopes: newScopes, selectedGroup: group };
};


/**
 * Returns updated scope from free-form changes
 * @param {Object} scopes - the atomic data for scopes
 * @returns {Object} - Returns the option group objects which will be rendered on features panel
 */
export let getScope = function( scopes ) {
    const context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let group;
    let scopeIndex = -1;
    for( let i = 0; i < scopes.scopesList.length; i++ ) {
        if( scopes.scopesList[i].uid === context.currentScope ) {
            group = scopes.scopesList[i];
            scopeIndex = i;
            break;
        }
    }
    return { group, scopeIndex };
};
/**
 * This API processes the cached server response and constructs the client data model
 * This is used:
 * - when loading first scope (entering VCV for the first time or after loading SVR)
 * - when navigating to a family for completeness check (variability data is cached)
 * @param {Object} data - The view data
 * @param {Object} soaResponse - The soaResponse
 * @param {Object} fscState - The fscState
 * @param {Object} scopesInfo - The scopesInfo
 * @returns {Object} - Returns the option group objects which will be rendered on features panel
 */
export let getCachedScopeData = function( data, soaResponse, fscState, scopesInfo ) {
    let scopeDetails = data.scopeStruct;

    // set the new selection on the parent/ features is observing it and will be able to react
    if( !_.isEmpty( soaResponse ) ) {
        //if the eventData is undefined (via the loadCachedScope) return the former scopeStruct
        // Load first scope
        scopeDetails = exports.getScopeData( soaResponse, data, fscState, scopesInfo, true );
    }

    return {
        scopeStruct: scopeDetails
    };
};

/**
 * This API updates the selection state of features of families in the scope object
 * @param {Object} selectedExpressions - One of the field of response received by SOA service
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopes scopes
 * @param {String} rootNodeName - optional only used if config modules
 * @param {String} action - action name (expand/validate)
 * @returns {Object} - Returns scope
 * TODO: This API is called for Expand and validate. We need to refactor this API to make it more specific to the use case
 * As this code internally removing the system selections, and re-adding the selections based on the soa response.
 */
export const updateSelectionStateAndSetIndicatorsOnExistingScopeData = ( selectedExpressions, fscState, scopes, rootNodeName, action ) => {
    //First clear the system selection state
    // As updateSelectionStateAndSetIndicatorsOnExistingScopeData is called for expand and validate, we don't want to make the variant rule dirty
    //get current module selection
    const context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let maps = !_.isEmpty( selectedExpressions ) && !_.isNil( selectedExpressions ) ? _getSelectedExpressionValuesMaps( selectedExpressions ) : {};
    // In case of empty Validate, selectedExpressions is empty
    if( _.isEmpty( selectedExpressions ) || _.isEmpty( maps ) ) {
        return;
    }
    const makeVariantRuleDirty = _checkIfLoadedVariantRuleIsDirtyAfterExpand( action, context, maps );
    let updatedGroup = exports.clearSystemSelectionsInManualMode( fscState, scopes, true, makeVariantRuleDirty );
    // Initially create a map of NodeUID and updated/latest selection state
    let tempScope = { ...updatedGroup.group };

    let mapNodeAndSelectionState = maps.mapNodeAndSelectionState;
    let mapNodeAndValueText = maps.mapNodeAndValueText;
    const configModuleHierarchy = context.configurationModuleHierarchy;
    const depth = _.get( context, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues.0' );
    const perspectiveUid = _.get( context, 'appliedSettings.configSettings.props.pca0ConfigPerspective.dbValues.0' );
    const isHierarchy = depth && depth !== '1';
    let cfgModulesRootNodeName = rootNodeName && isHierarchy ? rootNodeName : '';
    let currentConfigurationModule = configModuleHierarchy && configModuleHierarchy.split( ':' ).length > 0 ? configModuleHierarchy.split( ':' )[0] : cfgModulesRootNodeName;
    // Update the selection state of scope with latest selection state
    tempScope.families.forEach( ( family, outerIndex ) => {
        //attach an alternateUid as a path to each component: family or value in order to streamline the mapping for all use cases
        family.alternateUid = currentConfigurationModule ? currentConfigurationModule + ':' + tempScope.families[ outerIndex ].familyStr : tempScope.families[ outerIndex ].familyStr;
        // Update family level selection state if present
        // both cases possible for pip depending on affected nodes from the server:
        // a map with full path or just the family uid, for non pip the alternateUid is the uid
        if( mapNodeAndSelectionState[ family.alternateUid ] !== undefined ) {
            tempScope.families[ outerIndex ].selectionState = mapNodeAndSelectionState[ tempScope.families[ outerIndex ].alternateUid ];
        } else if( mapNodeAndSelectionState[ family.familyStr ] !== undefined ) {
            tempScope.families[ outerIndex ].selectionState = mapNodeAndSelectionState[ tempScope.families[ outerIndex ].familyStr ];
        }
        tempScope.families[ outerIndex ].familyCmdContext = { ..._createFamilyCommandContext( family, perspectiveUid, context.guidedMode ) };
        delete tempScope.families[ outerIndex ].familyCmdContext.family.values;
        if( family.values ) {
            // Update feature level selection State
            family.values.forEach( ( value, innerIndex ) => {
                let uid = value.optValue.uid;
                // see LCS-1091670 - When switching to Manual mode and selecting features, clicking Expand or Validate removes default/system selections.
                // This happens because the command updates expressions from moduleUid:groupUID:featureUid to groupUID:featureUid. This validation check prevents this issue.
                if( isHierarchy && ( _.get( tempScope, `families[${outerIndex}].values[${innerIndex}].selectionState` ) === 1 || value.hasViolation ) ) {
                    value.alternateUid = family.alternateUid.split( ':' )[ 1 ] + ':' + uid;
                } else {
                    value.alternateUid = family.alternateUid + ':' + uid;
                }
                let isFreeFormEmptyValue = value.isFreeFormFeature && value.optValueStr.split( ':' )[ 1 ] === '';
                //this is the expand path
                if( value.isFreeFormFeature ) {
                    uid = value.optValueStr;
                    //the use case where a previous empty value now has content
                    if( isFreeFormEmptyValue && mapNodeAndValueText[ value.optValueStr.split( ':' )[ 0 ] + ':' ] !== undefined ) {
                        uid = value.optValueStr.split( ':' )[ 0 ] + ':';
                        value.alternateUid = uid + mapNodeAndValueText[ uid ];
                    }
                    // Update the value text
                    tempScope.families[ outerIndex ].values[ innerIndex ].dbValue = mapNodeAndValueText[ uid ];
                    // Update the value state
                    tempScope.families[ outerIndex ].values[ innerIndex ].selectionState = mapNodeAndSelectionState[ uid ];
                }
                // Check if the UID is present in the map. If present, replace the old selection state by latest.
                let length = value.optValueStr.split( ':' ).length;
                let famAndValueUid = length > 1 ? value.optValueStr : family.familyStr + ':' + value.optValueStr;
                let pathUid = currentConfigurationModule + ':' + family.familyStr + ':' + value.optValueStr;
                let pathUids = pathUid.split( ':' );
                if( mapNodeAndSelectionState[value.alternateUid] !== undefined  &&
                    pathUids.length >= 3 && pathUids[0] === currentConfigurationModule && pathUids[1] === tempScope.families[ outerIndex ].familyStr  ||
                    famAndValueUid === tempScope.families[ outerIndex ].familyStr ) {
                    //only add the selection if the feature with this node id also belongs to the same family; there can be
                    //situations in which the same feature is comming differently in the response and once it is system selected once not
                    //see LCS-762119. Now if this is correct from the logical perspective, it's debatable but our job is to accurately represent the server's answers
                    // Update the selection state for the scope node UID.
                    tempScope.families[ outerIndex ].values[ innerIndex ].selectionState = mapNodeAndSelectionState[ value.alternateUid ];
                }

                if( tempScope.families[ outerIndex ].values[ innerIndex ].selectionState !== undefined ) {
                    setIndicators(
                        tempScope.families[ outerIndex ].values[ innerIndex ], true /* update only the selection state and not violation indicator*/ );
                }
            } );
        }
    } );

    //there can be a case in which the user deleted the free form value but after expand it has a default value and selection state.
    //through the logic above it won't be found, so we'll go thorugh the free form only maps and if not existing, we'll recreate them
    if( maps.freeFormExpressionNodesWithValue ) {
        _reCreateFreeFormFeature( maps.freeFormExpressionNodesWithValue, tempScope );
    }

    return tempScope;
};

/**
 * This API is called for Expand/Manual mode
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} data - The view data
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopes - The scopes atomic data
 * @returns {Object} - scope data
 */
export let getScopeDataForExpand = function( response, data, fscState, scopes ) {
    // As user has expanded the expression, keep this information in the fscContext
    // This will be used while creating/saving the variant rule.
    return exports.getScopeData( response, data.eventData.action, fscState, scopes );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * This API is called for Validate mode
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopes - The scopes atomic data
 * @returns {Object} - scope data
 */
export let getScopeDataForValidate = function( response, fscState, scopes ) {
    return exports.getScopeData( response, VCV_ACTIONS.VALIDATE, fscState, scopes );
};

/**
 * This API processes the cached server response and constructs Scope information
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} metaData - The meta data can be string or object as per requirement
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopesInfo - scopes details
 * @param {Boolean} isCachedData - flag for cached data to skip updating the groups
 * @returns {Object} - scope data
 */
export let getScopeData = ( response, metaData, fscState, scopesInfo, isCachedData ) => {
    if( !fscState || !fscState.value ) {
        return { scopesList: [], selectedGroup: {}, selectedScopeIndex: -1 };
    }

    const isSplit = _.get( response, 'responseInfo.isSplit.0' );
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    // When switching between group tabs, preserve existing violation information from fscContext
    // if the response doesn't contain violation data (labels and criteriaStatus are undefined)
    if( _.isUndefined( response.labels ) && _.isUndefined( _.get( response, 'responseInfo.criteriaStatus' ) ) && !context.switchingToGuidedMode ) {
        response.labels = context.violations || ( _.isUndefined( scopesInfo.labels ) ? context.violations : scopesInfo.labels );
        response.responseInfo = context.responseInfo;
    }else {
        context.violations = response.labels;
        context.responseInfo = response.responseInfo;

        if ( isSplit ) {
            // We dont want to throw the split message on every SOA call and server dont set isSplit for next SOA call
            // Split message should be thrown only once when user come into FSC with VR having split
            _.set( context, 'responseInfo.isSplit', undefined );
        }
    }

    delete context.reassessSelections;
    let newScopes = { ...scopesInfo };
    const scopeMeta = exports.getScope( newScopes );
    let _scope = scopeMeta.group;
    let scopeIndex = scopeMeta.scopeIndex;
    let scopesList = newScopes.scopesList;

    let newState = { ...fscState.value };
    // Following actions allow empty variability tree data and VMO
    let VCV_SPECIFIC_TOOLBAR_ACTIONS = [ VCV_ACTIONS.EXPAND, VCV_ACTIONS.VALIDATE ];
    let action;
    if( typeof metaData === 'string' ) {
        action = VCV_SPECIFIC_TOOLBAR_ACTIONS.includes( metaData ) ? metaData : null;
    }

    let configInvalid = false;
    /*
    We will enter this if condition in 3 cases
     1. Validate use case and configuration is invalid ( Variability Tree absent )
     2. Expand use case and configuration is invalid ( Variability Tree absent )
     3. Make changes in settings ( change effectivity /rule date /revision rule ) in such a way
     that the configuration becomes invalid. ( Variability Tree present )
     // Hence, we can say that variability tree may be present or absent if config is invalid
    */
    if( !_.isUndefined( response.responseInfo ) && !_.isEmpty( response.responseInfo.isValid ) &&
        response.responseInfo.isValid[ 0 ] === 'false' ) {
        _removeViolations( newScopes );
        // Leave UI untouched
        configuratorUtils.handleInvalidConfiguration( pca0Constants.FSC_CONTEXT );
        // This API will take care of populating violation icon on feature level and group level
        // if the configuration is INVALID.
        exports.showViolationsOnValidation( response.labels, response.responseInfo, response.payloadStrings, newScopes );
        configInvalid = true;
    } else if ( _.get( response, 'responseInfo.isValid.0' ) === 'true' && typeof action === 'string' && ( action === VCV_ACTIONS.EXPAND || action === VCV_ACTIONS.VALIDATE ) ) {
        delete newScopes.labels;
        _removeViolations( newScopes );
    }

    // Update UI
    if( _.isEmpty( response.variabilityTreeData ) ) {
        // The actions will be Validate or Expand only.
        if( typeof action === 'string' )  {
            // This API will take care of updating the selection state on the feature and family VMO
            // and also populate system/ default indicators on feature as per the latest
            // selected expressions we get by virtue of expand and validate action.
            // NOTE - This API is not meant to deal with ANYTHING related to violation indicators.
            // Neither will it clean the violation indicators, not will it populate it.
            let rootNodeName = _.get( response, 'configPerspective.props.cfg0ProductItems.dbValues.0' );
            _scope = exports.updateSelectionStateAndSetIndicatorsOnExistingScopeData(
                configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions ), fscState, newScopes, rootNodeName, action );
        } else {
            _scope = null;
            if( !configInvalid ) {
                exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().noVariabilityReasons, 'INFO' );

                // Update scopes based on SOA response
                // LCS-926319: if 'Unassigned' is the only group for the Configurator Context:
                // Scopes atomic data must be updated (i.e. cleaned)
                scopesList = configuratorUtils.populateScopes( response );

                // Reset current scope
                // (as done in pca0ScopesService when initially loading no variability)
                delete context.currentScope;
                eventBus.publish( 'Pca0Features.clearScopeData' );
            }
        }
    } else {
        //it will populate the one expanded, current node
        //update the scopes atomic data with the response you just got
        scopesList = configuratorUtils.populateScopes( response, newScopes.labels );
        _scope = null;
    }
    //select products/first group when switching to guided mode from unassigned group if config valid
    if( !configInvalid && scopesList && scopesList.length > 0 && context.currentScope === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID && context.guidedMode ) {
        scopeIndex = 0;
        exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().switchingToGuidedFromUnassigned, 'INFO' );
    }
    if( action && _scope ) {
        let index = scopesList.findIndex( scope => scope.uid === context.currentScope );
        if( index > -1 ) {
            scopesList[ index ].families = _scope.families;
            scopeIndex = index;
        }
    } else {
        for ( let scopeIdx = 0; scopeIdx < scopesList.length; scopeIdx++ ) {
            if ( scopesList[scopeIdx].uid === context.currentScope ) {
                _scope = scopesList[scopeIdx];
                scopeIndex = scopeIdx;
                break;
            }
        }
    }

    // if _scope is still null and scopes length is > 0 , then assign current scope and _scope to the first group received from populateScopes.
    if( scopesList && scopesList.length > 0 && _.isEmpty( _scope ) ) {
        _scope = scopesList[ 0 ];
        scopeIndex = 0;
    }

    context.payloadStrings = response.payloadStrings;

    // We should not enter into this if condition
    // if we are switching to guided mode and configuration is invalid.
    // This is case where there may be mixed selections in single select family and
    // we try to move to guided mode.
    // NOTE: Server doesn't return selectedExpressions in this case.
    // Maybe, server( platform ) code needs to be refactored in near future.
    if( !( context.switchingToGuidedMode && configInvalid && _.isEmpty( response.selectedExpressions ) ) ) {
        context.selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions );
        if( response.selectedExpressions === undefined ) {
            context.selectedExpressions = {};
        }
    }

    // Update info on context when configurations contains selections
    context.containsSelections = !exprGridSvc.expressionMapContainsNoUserSelection( context.selectedExpressions );

    if( context.guidedMode === undefined ) {
        context.guidedMode = true;
    }

    // Update the completeness status in summary
    if( _.get( response, 'responseInfo.criteriaStatus' ) ) {
        // Update criteria status on context to enable/disable completeness navigation commands
        context.criteriaStatus = response.responseInfo.criteriaStatus[ 0 ];
        if( !newState.isSwitchingFromGridToListView && response.responseInfo.isValid[ 0 ] === 'true' ) {
            // set violation label to default i.e. no violation as responseInfo says the validate/expand is valid
            eventBus.publish( 'Pca0FullScreenSummary.updateCompletenessStatusAndViolations', {
                CompletenessStatus: response.responseInfo,
                summaryViolationsInfo: undefined,
                violationLabels: undefined,
                validationErrorMessage: ''
            } );
        }
    }

    // Review summary selections in case of unconfigured data if no SVR is being currently loaded right now.
    // In case of loading of SVR, summaryOfSelections is defined and already contains isUnconfigured flags.
    if( response.variabilityTreeData.length !== 0 ) {
        if( !_.isUndefined( response.responseInfo ) && !_.isEmpty( response.responseInfo.hasUnconfiguredData ) &&
            response.responseInfo.hasUnconfiguredData[ 0 ] === 'true' && _.isUndefined( response.responseInfo.summaryOfSelections ) ) {
            context.hasUnconfiguredData = true;
        } else if( context.hasUnconfiguredData ) {
            // This happens when configuration has no longer unconfigured data: update summary tile icons
            context.hasUnconfiguredData = false;
        }
    }

    // Invalid configuration: show warning message and show violations on the success path if the response has invalid
    // Switch the mode to manual if response is invalid and the suggested mode to open panel is guided.
    if( context.guidedMode === true && _.get( response, 'responseInfo.isValid.0' ) === 'false' ) {
        eventBus.publish( 'Pca0Features.stayInManualMode' );

        if( context.switchingToGuidedMode === undefined || context.switchingToGuidedMode === false ) {
            exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().switched_to_manual_mode, 'INFO' );
        }
    }

    // Clear formula
    exprGridSvc.clearSelectedExpressionFormula( pca0Constants.FSC_CONTEXT );

    // Update Context information: reset switchingToGuided status
    delete context.switchingToGuidedMode;
    if( _scope ) {
        context.currentScopeName = _scope.cellHeader1;
        context.currentScope = _scope.uid;
        _scope.variabilityChange = new Date().getTime();
    }
    // Update Context information
    if( action === VCV_ACTIONS.EXPAND ) {
        context.expressionExpandedState = true;
    }
    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );

    //in theory we only would need to update the groups when we do expand or validate (driven by the updateScopeView flag)
    //but there are situations where the aw-list elements are updated internally therefore it's necessary to always update
    //i.e for a newly created group: after a change of selection after a validation, this group loses indicators
    const newScopesInfo = {
        scopesList,
        selectedScopeIndex: scopeIndex,
        labels:  response.labels || newScopes.labels
    };
    if( !isCachedData ) {
        exports.updateGroupListInScopeView( newScopesInfo );
    }

    // open the matrix view if the selected variant has split expressions and it is opened in VCV from BOM
    const configuratorCtx = appCtxSvc.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    const isVCVOpenedFromConfigurator = configuratorCtx?.variantRuleData?.isVCVOpenedFromConfigurator;
    if( isSplit && !isVCVOpenedFromConfigurator ) {
        newState.treeDisplayMode = true;
        fscState.update( newState );
    }

    return { scopesList: scopesList, selectedGroup: _scope, selectedScopeIndex: scopeIndex, labels: newScopesInfo.labels, isSplit };
};


/**
 * Remove the system or user selections from the current group
 * @param {Object} context - TODO REMOVE
 * @param {Array} scopes - scopes/groups list
 * @param {String} selectionType - type of selection
 * @return {Object} temporary scope
 */
export let removeSelectionsFromCurrentGroup = ( context, scopes, selectionType ) => {
    //If the group is the currently expanded group then iterate through its value selections and remove the system selections
    // This method is called also when entering FSC with a loaded SVR.
    // _scope might not have been rendered yet
    let tempScope = scopes.selectedGroup;
    const perspectiveUid = _.get( context, 'appliedSettings.configSettings.props.pca0ConfigPerspective.dbValues.0' );
    if( !_.isUndefined( tempScope ) && !_.isEmpty( tempScope.families ) ) {
        //Iterate over the families of currently expanded group
        for( let family of tempScope.families ) {
            //removes the system selection indicator at family level
            if( ( selectionType === 'system' || selectionType === 'all' ) && configuratorUtils.getSystemSelectionStates().includes( family.selectionState ) ) {
                family.selectionState = 0;
            }
            //removes the user selections at family level
            if( ( selectionType === 'user' || selectionType === 'all' ) && !configuratorUtils.getSystemSelectionStates().includes( family.selectionState ) ) {
                family.selectionState = 0;
            }
            family.familyCmdContext = { ..._createFamilyCommandContext( family, perspectiveUid, context.guidedMode ) };
            if( family.values ) {
                //Iterate over the values of currently expanded group
                for( let value of family.values ) {
                    //If the value is not available in user selection map then reset its selection state to 0
                    if( ( selectionType === 'system' || selectionType === 'all' ) && configuratorUtils.getSystemSelectionStates().includes( value.selectionState ) ) {
                        value.selectionState = 0;
                    }
                    if( ( selectionType === 'user' || selectionType === 'all' ) && !configuratorUtils.getSystemSelectionStates().includes( value.selectionState ) ) {
                        value.selectionState = 0;
                    }
                    if( value.selectionState === 0 && value.optValue ) {
                        const newOptValue = _removeIndicators( value, selectionType );
                        value.optValue = newOptValue;
                    }
                }
            }
        }
    }
    return tempScope;
};

/**
 * Post processing when user switches from guided to manual mode
 */
function manualModeSwitched() {
    //Close the package panel first
    eventBus.publish( 'Pca0Configurator.closeDialog' );
    var eventData = {
        action: VCV_ACTIONS.SWITCHINGTOMANUAL
    };
    eventBus.publish( 'Pca0Features.Pca0Expand', eventData );
}

/**
 * This method handles the toggle btw guided and manual mode
 * @param {object} fscState - fscState atomic data
 * @param {Boolean} stayInManualMode - optional flag when invoked via events
 */
export let updateVariantMode = function( fscState, stayInManualMode ) {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( fscState && fscState.value ) {
        let newState = { ...fscState.getValue() };
        if( newState.isManualConfiguration === true ) {
            //this means we are in manual configuration mode and we are switching to guided mode.
            context.switchingToGuidedMode = true;
            context.guidedMode = true;
            newState.isManualConfiguration = false;

            // Delete cached data on required Families
            delete context.incompleteFamiliesInfo;
            delete context.isNextRequiredClicked;
        } else {
            //this means we are in guided mode and we are switching to manual configuration mode.
            context.guidedMode = false;
            context.switchingToGuidedMode = false;
            newState.isManualConfiguration = true;
        }
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
        if( !_.isEqual( newState, fscState.getValue() ) ) {
            fscState.update( newState );
        }

        if( newState.isManualConfiguration === true ) {
            //We do not want to reload the data when user switches from guided to manual mode
            if( !stayInManualMode ) {
                manualModeSwitched();
            }
        } else {
            eventBus.publish( 'Pca0Features.toggleManualGuidedMode' );
            // Remove violation indicator at group level and all features in current group
            // and remove system selection from all features in current group when we toggle to guided mode
            // to avoid duplicate indicators. This is to make sure that the Scope view is a clean slate
            // while moving from manual to guided mode. Populating right violation indicators ( if any )
            // and populating right system/default selection on features ( if any ) will be taken
            // care by getScopeData API.
            // NOTE - we are just removing the visual INDICATORS and not resetting the
            // selection state on feature to 0 as we need it to be the part of
            // selectedExpressions in VCV3 SOA.
            eventBus.publish( 'Pca0Features.clearAllViolationsAndSystemSelectionIndicators' );
        }
    }
};

/**
 * Displays the violation message if validation is invoked in manual mode.
 *
 * @param {ObjectArray} violationLabels - The violationLabels returned by SOA service which will be rendered on features
 * @param {Object} responseInfo - Additional information about response returned by SOA service
 * @param {String} payloadStrings -Map of <string,String[]> returned by SOA service
 * @param {Object} scopeInfo - details of scopes
 *
 */
export let showViolationsOnValidation = function( violationLabels, responseInfo, payloadStrings, scopeInfo ) {
    let currentGroup;
    let _scope = scopeInfo.selectedGroup;

    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let configurationModulePath = _.get( context, 'configurationModuleHierarchy', '' );
    let currentSelectedModule = configurationModulePath ? configurationModulePath.split( ':' )[0] : '';
    currentGroup = context.currentScope;
    //Update the completeness status in summary
    if( responseInfo && responseInfo.criteriaStatus !== undefined ) {
        if( _.isUndefined( currentGroup ) ) {
            eventBus.publish( 'Pca0FullScreenSummary.updateCompletenessStatusAndViolations', {
                CompletenessStatus: responseInfo,
                summaryViolationsInfo: undefined,
                violationLabels: undefined,
                validationErrorMessage: ''
            } );
        } else {
            let summaryViolationsInfo = configuratorUtils.parseResponseAndExtractViolations( violationLabels, _scope, scopeInfo, currentSelectedModule );
            let validationErrorMessage = '';
            if( responseInfo !== undefined && responseInfo.validationErrorMessage !== undefined ) {
                validationErrorMessage = responseInfo.validationErrorMessage[ 0 ];
            }
            context.payloadStrings = payloadStrings;
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
            eventBus.publish( 'awCustomVariantPanel.updateViolationIcon', {} );
            eventBus.publish( 'Pca0FullScreenSummary.updateCompletenessStatusAndViolations', {
                CompletenessStatus: responseInfo,
                summaryViolationsInfo: summaryViolationsInfo,
                violationLabels: violationLabels,
                validationErrorMessage: validationErrorMessage
            } );
        }
    }
};

/**
 * This function removes the system selection/default selection indicator on the features of current group.
 * NOTE - This just removes the indicator and doesn't reset the selection state to 0 itself
 * @param {Object} scopes atomic data
 * @returns {Object} group -the current group
 */
export let removeSystemSelectionIndicatorFromCurrentGroup = ( scopes ) => {
    let group = scopes.selectedGroup;
    //Iterate over the families of currently expanded group
    for( let familyIndex = 0; familyIndex < group.families.length; familyIndex++ ) {
        var family = group.families[ familyIndex ];
        if( family.values ) {
            //Iterate over the values of currently expanded group
            for( let valueIndex = 0; valueIndex < family.values.length; valueIndex++ ) {
                var value = family.values[ valueIndex ];
                // Update "violation" indicator only
                // Do not change/remove existing "selectionState" and "unconfigured" indicators
                if( value.optValue ) {
                    _.remove( value.optValue.indicators, {
                        type: 'selectionState'
                    } );
                }
            }
        }
    }

    return group;
};

/**
 * Show notification message with message type.
 * @param {String} message notification message
 * @param {String} messageType type of message
 * @returns {String} message required for user
 */
export let showNotificationMessage = function( message, messageType ) {
    return configuratorUtils.showNotificationMessage( message, messageType );
};

/** Helps to get configurator context with respect to module
 * @param {String} contextName - Name of context that we need to fetch from global ctx
 * @param {Object} configCtx - Configurator context provided by consumer apps
 * @returns {Object} VariantContext required to call VCV3 SOA
 */
export let getSelectionForVariantContext = ( contextName, configCtx ) => {
    return commonUtils.getSelectionForVariantContext( contextName, configCtx );
};

/**
 * Get configuration mode
 * @returns {Object} - Returns configuration mode
 */
export let getConfigurationMode = function() {
    return commonUtils.getConfigurationMode( pca0Constants.FSC_CONTEXT );
};

/**
 * Determines configuration mode
 * @param {Object} fscState fscState atomic data
 * @returns { String } In full screen configuration for platform >=12.4 default variant mode set to - Manual
 */
export let getConfigurationModeForLoadScopeData = function( fscState ) {
    var fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( getActiveVariantRules() !== null ) {
        fscContext.guidedMode = false;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
        //set the dirty state on fscState atomic data
        if( fscState && fscState.update ) {
            let newState = { ...fscState.value };
            // set the new state on the parent who is observing it and will be able to react
            newState.isManualConfiguration = true;
            fscState.update( newState );
        }
    }

    // If platform verson is 12.4 or later and a variant rule is applied then open that variant rule diretly in manual mode
    return getConfigurationMode();
};

/**
 * This API returns initialVariantRule only when selections are undefined
 * @param {Object} variantRuleData variant Rule Data
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function( variantRuleData ) {
    return configuratorUtils.getFscActiveVariantRules( variantRuleData );
};

/**
 * Return Profile Settings information
 */
export let getProfileSettings = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * Show ValidationErrorMessage
 * @param {String} data event data
 * @param {String} cntx context
 */
export let showValidationErrorMessage = function( data, cntx ) {
    return configuratorUtils.showValidationErrorMessage( data, cntx );
};
/**
 * stayInManualMode
 */
export let stayInManualMode = function() {
    eventBus.publish( 'Pca0Features.updateVariantMode', { stayInManualMode: true } );
};

/**
 * Displays the error message when switching to guided mode from manual is not allowed.
 *
 * @param {data} data
 *
 */
export let showUnableToSwitchToGuidedModeMessage = function( data ) {
    return configuratorUtils.showUnableToSwitchToGuidedModeMessage( data );
};

/**
 * This function removes the violations from the current group.
 * @param {Object} scopes atomic data
 * @returns {Object} group -the current group
 */
export let removeViolationsFromCurrentGroup = ( scopes ) => {
    if ( !scopes.scopesList || scopes.scopesList.length === 0 ) {
        return;
    }

    let group = scopes.selectedGroup;
    // Remove stored violation labels from scopes when the SVR is changed
    delete scopes.labels;
    //Iterate over the families of currently expanded group
    for( let familyIndex = 0; familyIndex < group.families.length; familyIndex++ ) {
        let family = group.families[ familyIndex ];
        if( family.values ) {
            //Iterate over the values of currently expanded group
            for( let featureIndex = 0; featureIndex < family.values.length; featureIndex++ ) {
                let value = family.values[ featureIndex ];
                //If the value has the violations then remove it
                delete value.violationsInfo;
                value.hasViolation = false;

                // Update "violation" indicator only
                // Do not change/remove existing "selectionState" and "unconfigured" indicators
                if( value.optValue ) {
                    _.remove( value.optValue.indicators, {
                        type: 'violation'
                    } );
                }
            }
        }
    }

    // removing current group violation icon
    let newScopes = scopes;
    let scopesList = newScopes.scopesList;
    let foundScope = _.find( scopesList, { uid: group.uid } );
    if( foundScope && foundScope.indicators ) {
        _.remove( foundScope.indicators, {
            type: 'violation'
        } );
        _.remove( foundScope.vmo.indicators, {
            type: 'violation'
        } );
    }
    group.variabilityChange = new Date().getTime();
    scopes.scopesList[ scopes.selectedScopeIndex ] = group;
    return { newScopes: scopes, selectedGroup: group };
};

/**
 * Function invoked when validation is requested.
 * @param {Object} commandContext - context for validation command
 * NOT IN USE NEED TO REMOVE
 */
export let validateConfiguration = function( commandContext ) {
    exports.removeViolationsFromCurrentGroup( commandContext.scopes );
    if( commandContext.fscState && commandContext.fscState.update ) {
        let newState = { ...commandContext.fscState.value };
        // set the new state on the parent who is observing it and will be able to react
        newState.isValidationInProgress = true;
        commandContext.fscState.update( newState );
    }
};

/**
 * Function invoked when when we click on expand command.
 * @param {Object} commandContext - context for validation command
 * NOT IN USE NEED TO REMOVE
 */
export let expandSystemSelections = function( commandContext ) {
    exports.removeViolationsFromCurrentGroup( commandContext.scopes );
    var eventData = {
        action: VCV_ACTIONS.EXPAND
    };
    //call the server to expand
    eventBus.publish( 'Pca0Features.Pca0Expand', eventData );
};

/**
 * This API creates context for package and navigates to package command panel
 * @param {Object} packageCommandContext - Context for package command
 */
export let showPackagePanel = function( packageCommandContext ) {
    const { packageDialogAction } = packageCommandContext;
    //Unregister the package context before opening the package panel
    appCtxSvc.unRegisterCtx( 'fscContext.packageContext' );

    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    //Take the backup of current selections before opening the package sub-panel
    var selectedExpressions = $.extend( true, {}, context.selectedExpressions );
    var payloadStrings = $.extend( true, [], context.payloadStrings );
    var configPerspective = { uid: packageCommandContext.configPerspectiveUid, type: 'Cfg0ConfiguratorPerspective' };
    var packageContext = {
        currentPackage: packageCommandContext.packageValue,
        packageFamily: packageCommandContext.packageFamily,
        selectedExpressions: selectedExpressions,
        payloadStrings: payloadStrings,
        configPerspective: configPerspective,
        guidedMode: true,
        showSavePackageCommand: false
    };
    context.packageContext = packageContext;
    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );

    let options = {
        view: 'Pca0FSCPackage',
        placement: 'right',
        width: 'SMALL',
        height: 'FULL',
        parent: '.aw-layout-workarea',
        isCloseVisible: false,
        subPanelContext: packageCommandContext
    };

    //Open the package dialog
    packageDialogAction.show( options );
};

/**
 * Clear the middle Panel: do not show any features
 * @returns {Object} Updated families and selectedGroup
 */
export let clearScopeData = function() {
    return {
        families: [],
        selectedGroup: {}
    };
};

/**
 * Adds InlineFreeFormFeature for free-form changes
 * @param {Object} commandContext - The commandContext received
 * @param {Object} scopeInfo - The View model data to represent features component
 * @returns {Object} Updated scopeInfo
 */
export let addInlineFreeFormFeature = function( commandContext, scopeInfo ) {
    let newScopeInfo = { ...scopeInfo };
    let newScope = newScopeInfo.selectedGroup;
    let scopeIndex = newScopeInfo.selectedScopeIndex;
    if( newScope ) {
        let familyObj = _.find( newScope.families, { familyStr: commandContext.family.familyStr } );
        let feature = exports.createFreeFormFeature( familyObj );
        feature.featureIndex = familyObj.values.length === 0 ? 0 : familyObj.values.length;
        feature.familyIndex = commandContext.famIndex;
        feature.isFeature = true;
        // In case of free form feature, alternateID is featureIndex:uniqueId as optValueStr is always 'familyStr:'
        feature.alternateID = feature.familyIndex + ':' + feature.featureIndex + ':' + commonUtils.prepareUniqueId( familyObj.alternateID, feature.optValueStr );
        familyObj.values.push( feature );
    }

    newScopeInfo.scopesList[ scopeIndex ] = newScope;
    newScopeInfo.selectedGroup = newScope;
    newScopeInfo.selectedScopeIndex = scopeIndex;
    newScopeInfo.selectedGroup.variabilityChange = new Date().getTime();
    return newScopeInfo;
};

/**
 * Removes the Inline Free Form Feature
 * @param {Object} commandContext - The commandContext received
 * @param {Object} scopeInfo - The View model data to represent features component
 * @returns {Object} Updated scopeInfo
 */
export let removeInlineFreeFormFeature = ( commandContext, scopeInfo ) => {
    let newScopeInfo = { ...scopeInfo };
    let newScope = newScopeInfo.selectedGroup;
    let scopeIndex = newScopeInfo.selectedScopeIndex;
    let familyObj = {};
    if( newScope ) {
        familyObj = { ...newScope.families[ commandContext.famIndex ] };
        const featureIndex = commandContext.value.featureIndex;
        let values = [ ...familyObj.values ];
        delete familyObj.values;
        if( featureIndex > -1 ) {
            values.splice( featureIndex, 1 );
            for( let i = featureIndex; i < values.length; i++ ) {
                values[ i ].featureIndex = i;
                values[ i ].alternateID = commandContext.famIndex + ':' + i + ':' + commonUtils.prepareUniqueId( familyObj.alternateID, values[ i ].optValueStr );
            }
        }
        familyObj.values = [ ...values ];
        let selectionDataObj = {
            variantcontext: pca0Constants.FSC_CONTEXT,
            valueaction: 'selectFeature',
            value: commandContext.value,
            family: familyObj,
            group: commandContext.group,
            state: 0,
            perspectiveUid: commandContext.configPerspectiveUid
        };

        let eventData = {
            selectionData: selectionDataObj,
            isFamilySelection: false
        };
        // This is redundant no need to fire event only remove the feature form selectionSummary
        eventBus.publish( 'Pca0FscSelectionService.setSelection', eventData );
    }
    newScope.families[ commandContext.famIndex ] = { ...familyObj };
    newScopeInfo.scopesList[ scopeIndex ] = { ...newScope };
    newScopeInfo.selectedGroup = { ...newScope };
    newScopeInfo.selectedScopeIndex = scopeIndex;
    newScopeInfo.selectedGroup.variabilityChange = new Date().getTime();
    return newScopeInfo;
};

/**
 * resets the view data then fires an event to reload the data.
 * @returns {Object} Updated group
 */
export let resetGroup = function() {
    return {};
};

/**
 * Function invoked when when we confirmed to clear all system selections from across the all groups in fsc manual mode
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopes atomic data
 * @param {Boolean} retainResponseInfo - flag that deletes the responseInfo for the clearSystemSelections user triggered action (default) or retains it if the
 * clearing is due to the update after expand
 * @param {Boolean} makeVariantRuleDirty - optional flag to make variant rule dirty.
 * @returns {Object} updated group
 */
export let clearSystemSelectionsInManualMode = function( fscState, scopes, retainResponseInfo, makeVariantRuleDirty = true ) {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    configuratorUtils.clearSystemSelectionsFromSelectionsMap( fscState, makeVariantRuleDirty );
    let _scope = { ...exports.removeSelectionsFromCurrentGroup( context, scopes, 'system' ) };

    //delete cached data on response info if we are clearing system selections; keep the violations for now because they still need a general discussion and would need atdd changes
    // do not delete freshly aquired ones if the function is called as part of the expand flow
    if( !retainResponseInfo ) {
        delete context.responseInfo;
    }
    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );

    if( makeVariantRuleDirty ) {
        _setIsVariantRuleDirtyFlag( fscState );
    }
    return { group: _scope };
};

/**
 * Function invoked when when we click on clear all selections command.
 */
export let clearAllSelectionsInFsc = function() {
    eventBus.publish( 'Pca0Features.clearAllSelectionsInFsc', {} );
};

/**
 * Function invoked when when we confirmed to clear all selections including user selections, system selections and reported violations
 * from across the all groups in guided or manual mode.
 * @param {Object} fscState atomic data
 * @param {Object} scopes atomic data
 * @returns {Object} scopeStruct
 * */
export let clearAllSelections = function( fscState, scopes ) {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    //clear all selection related stuff from context
    configuratorUtils.clearAllSelectionsFromContext();

    exports.removeSelectionsFromCurrentGroup( context, scopes, 'all' );
    const { newScopes, selectedGroup } = exports.removeViolationsFromCurrentGroup( scopes );
    let newScopesData = exports.removeViolationsFromAllGroupLevel( scopes );

    if( context.guidedMode ) {
        //Fire an event to load the current goup in guided mode only
        eventBus.publish( 'Pca0Features.loadScopeData', {} );
    }

    _setIsVariantRuleDirtyFlag( fscState );

    return {
        scopesList: newScopesData.scopesList,
        selectedGroup: selectedGroup,
        selectedScopeIndex: scopes.selectedScopeIndex
    };
};

/**
 * Function invoked when when we click on clear all system selections  command in fsc manual mode.
 */
export let clearSystemSelectionsInFsc = function() {
    eventBus.publish( 'Pca0Features.clearSystemSelectionsInFsc', {} );
};

export let updateGroupListInScopeView = function( scopeInfo ) {
    const scopeInfoList = [];
    scopeInfo.scopesList.forEach( ( scopeData ) => {
        const newScopeData = { ...scopeData };
        newScopeData.families = [];
        scopeInfoList.push( newScopeData );
    } );

    let eventData = {
        scopeInfoList,
        labels: scopeInfo.labels
    };
    eventBus.publish( 'Pca0Scopes.updateGroups', eventData );
};

export let createFreeFormFeature = function( family, displayName = '', tmpValue = undefined ) {
    var augmentToExistingFeature = false;
    if( tmpValue ) {
        augmentToExistingFeature = true;
    } else {
        tmpValue = {};
    }
    if( !augmentToExistingFeature ) {
        tmpValue.isFiltered = true;
        tmpValue.selectionState = 0;
        var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
        if( context.guidedMode ) {
            tmpValue.allowedSelectionStates = [ 1, 0 ];
        } else {
            tmpValue.allowedSelectionStates = [ 1, 2, 0 ];
        }
    }
    var type = 'String';
    var familyType = family.familyType;
    tmpValue.optValueStr = family.familyStr + ':' + displayName;
    let vmo = {
        indicators: []
    };
    if( familyType === 'Date' ) {
        type = 'DATE';
        tmpValue.dateApi = {
            isDateEnabled: true,
            dateObject: {}
        };
        let dateExpr = displayName.split( ' ' );
        if( dateExpr[ 1 ] ) {
            let fromOp = '';
            let toOp = '';
            let toDate = '';
            let fromDate = '';
            fromOp = dateExpr[ 0 ];
            fromDate = dateExpr[ 1 ];
            if( dateExpr[ 3 ] ) {
                toOp = dateExpr[ 3 ];
                toDate = dateExpr[ 4 ];
            }
            let formatedFromDate = commonUtils.getFormattedDateFromUTC( fromDate );
            let exprValue = fromOp + ' ' + formatedFromDate;
            if( dateExpr[ 3 ] && dateExpr[ 4 ] && toOp !== '' && toDate !== '' ) {
                let formatedToDate = commonUtils.getFormattedDateFromUTC( toDate );
                exprValue += ' & ' + toOp + ' ' + formatedToDate;
            }
            let typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION );
            //in case this is empty, add the default icon
            if( !typeIconURL ) {
                typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
            }
            vmo = {
                uid: '_freeFormFeature_',
                cellHeader1: exprValue,
                typeIconURL: typeIconURL,
                indicators: [],
                isDateRangeExpr: true
            };
            tmpValue.dateApi.dateValue = exprValue;
            tmpValue.uiValue = exprValue;
            tmpValue.isDateRangeExpr = true;
        } else {
            displayName = commonUtils.getFormattedDateFromUTC( displayName );
            tmpValue.dateApi.dateValue = displayName;
            tmpValue.dateApi.dateObject = dateTimeService.getJSDate( displayName );
            tmpValue.uiValue = displayName;
            vmo.cellHeader1 = displayName;
        }
    } else {
        tmpValue.validationCriteria = [];
        vmo.cellHeader1 = displayName;
    }
    tmpValue.type = type;
    tmpValue.dbValue = !tmpValue.isDateRangeExpr && familyType === 'Date' ? commonUtils.getFormattedDateString( new Date( displayName ) ) : displayName;
    tmpValue.dispValue = displayName;
    tmpValue.isRequired = false;
    tmpValue.isEditable = true;
    tmpValue.isEnabled = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isFreeFormFeature = true;
    tmpValue.optValue = vmo; // This is used for indicator labels like systemSelection etc

    return tmpValue;
};

/**
 * This API returns the Type of family for given VMO
 * @param {Object} familyVmo - family VMO
 * @param {String} familyVmo - type of family
 */
let getFamilyType = function( familyVmo ) {
    let familyType = 'String';
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Boolean' ) {
        familyType = 'Boolean';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Floating Point' ) {
        familyType = 'Floating Point';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Date' ) {
        familyType = 'Date';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Integer' ) {
        familyType = 'Integer';
    }
    return familyType;
};

/**
 * Create a client side VMO for Unconfigured option values
 *
 * @param {Object} tmpValue - The temporary value object containing option value details.
 * @param {String} familyUID - The unique identifier for the family.
 * @param {Boolean} isAccessDenied - Flag indicating if access is denied.
 */
let createUnconfiguredClientSideVMO = ( tmpValue, familyUID, isAccessDenied ) => {
    tmpValue.optValueStr = familyUID + ':' + tmpValue.valueDisplayName;
    tmpValue.isUnconfigured = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isUnconfiguredIndicatorTooltip = configuratorUtils.getFscLocaleTextBundle().isUnconfigured;

    var iconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_UNCONFIGURE_OBJ;
    var imageIconUrl = iconSvc.getTypeIconURL( iconName );
    var cellHeader = tmpValue.valueDisplayName;
    if ( isAccessDenied ) {
        // If user does not have a read access to the selected feature, it is evaluated as unconfigured but we still show its valueText.
        // With this additional property, isAccessDenied, we will change Cell header as *** to hide valueText.
        // We do not want to show the valueText in this case as it is a security risk.
        // But we want to keep underlying object as is to keep selectedExpression intact as we support clearing of these selections.
        // If Server itself sends masked value for valueText, we will not able to keep selectedExpression intact, hence we are using additional property.
        cellHeader = pca0Constants.DEFAULT_MASK_VALUE_WHEN_ACCESS_IS_DENIED;
    }
    tmpValue.optValue = {
        modelType: {
            // needed to set icon by controller aw-image-cell.controller from aw-option-value-cell
            constantsMap: {
                IconFileName: iconName
            }
        },
        objectID: tmpValue.valueDisplayName,
        uid: '_unconfiguredFeature_',
        name: tmpValue.valueDisplayName,
        cellHeader1: cellHeader,
        cellHeader2: cellHeader,
        meta: [ cellHeader ],
        typeIconURL: imageIconUrl,
        indicators: [],
        getId: function() {
            return this.uid;
        }
    };
};

/**
 *Helper to set the indicators on the value
 *
 * @param {Object} tmpValue -Value object
 * @param {Boolean} updateOnlySelectionStateIndicators - Flag to update only selection state indicators, default is false.
 */
export let setIndicators = ( tmpValue, updateOnlySelectionStateIndicators = false ) => {
    let indicators = [];
    let img;
    let unconfiguredIndicator = {};
    if( tmpValue.isUnconfigured && tmpValue.isThumbnailDisplay ) {
        img = 'indicatorConfiguredOut';
        unconfiguredIndicator = {
            tooltip: tmpValue.isUnconfiguredIndicatorTooltip,
            type: 'unconfigured',
            image: img
        };
        indicators.push( unconfiguredIndicator );
    }

    //this change was introduced in PLM739285 - questionable as it's in the main path
    // if( [ 0, 1, 2 ].includes( state ) ) {
    //     if( tmpValue.systemSelectionIndicatorTooltip ) {
    //         delete tmpValue.systemSelectionIndicatorTooltip;
    //     }
    //     if( tmpValue.defaultSelectionIndicatorTooltip ) {
    //         delete tmpValue.defaultSelectionIndicatorTooltip;
    //     }

    //     if( tmpValue.optValue ) {
    //         tmpValue.optValue.indicators = [];
    //     }
    // }

    if( !updateOnlySelectionStateIndicators && tmpValue.violationsInfo ) {
        var violationSeverity = tmpValue.violationsInfo.violationSeverity;
        if( violationSeverity === 'error' ) {
            img = 'indicatorError';
        } else if( violationSeverity === 'warning' ) {
            img = 'indicatorWarning';
        } else if( violationSeverity === 'info' ) {
            img = 'indicatorInfo';
        }
        if( !tmpValue.optValue ) {
            tmpValue.optValue = {
                uid: '_freeFormFeature_',
                cellHeader1: tmpValue.value.dbValue,
                typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE ),
                indicators: []
            };
        }
        indicators.push( {
            type: 'violation',
            tooltip: tmpValue.violationsInfo.violationMessage,
            image: img
        } );
    }
    //make sure not to take duplicates in if you merge from the tmpValue
    if( tmpValue.optValue ) {
        let images = tmpValue.optValue.indicators ? new Set( tmpValue.optValue.indicators.map( i => i.image ) ) : [];
        let merged = tmpValue.optValue.indicators ? [ ...tmpValue.optValue.indicators, ...indicators.filter( i => !images.has( i.image ) ) ] : [];
        tmpValue.optValue.indicators = tmpValue.optValue.indicators ? merged : indicators;
    }
};

/**
 *This API creates the Feature node structure
 * @param {ObjectArray} valueNode - variability data
 * @param {Object} vmos - view model objects
 * @param {boolean} isFreeForm for freeForm family
 * @param {Object} family - family object
 * @param {Object} labels - labels
 * @param {Object} wsObjects - wsObjects
 * @param {Object} familyVmo - familyVmo
 * @param {string} featureIndex - feature index in the family
 * @param {Object} currentSelectedModule - selected module in module heierarchy grid
 * @returns {Object} Feature node
 */
function createFeatureNode( valueNode, vmos, isFreeForm, family, labels, wsObjects, familyVmo, featureIndex, currentSelectedModule ) {
    let tmpValue = {};
    let valueVmo = vmos[ valueNode.nodeUid ];
    tmpValue.valueDisplayName = valueVmo.displayName;
    tmpValue.isFiltered = true;
    // Note: isProductModelFamily was part of featureObject.props when FullScreenConfigurationService was used in AW server
    tmpValue.isProductModelFamily = family.isProductModelFamily;
    let state = undefined;
    let unconfigured = false;
    if( valueNode.props ) {
        state = Number( valueNode.props.selectionState[ 0 ] );
        tmpValue.selectionState = state;
        if( valueNode.props.allowedSelectionStates ) {
            tmpValue.allowedSelectionStates = valueNode.props.allowedSelectionStates.map( Number );
        }
    }
    if( valueNode.props && valueNode.props.isPackage ) {
        tmpValue.isPackage = valueNode.props.isPackage[ 0 ] === 'true'; //todo
    }
    if( valueVmo.props && valueVmo.props.isThumbnailDisplay ) {
        tmpValue.isThumbnailDisplay = valueVmo.props.isThumbnailDisplay[ 0 ] === 'true';
    }
    tmpValue.meta = _getUserPreferredMetaData( _.get( valueVmo, 'props.meta' ) );
    valueNode.isFeature = true;
    const violationsInfo = configuratorUtils.buildViolationString( valueNode, labels, family.familyStr, undefined, currentSelectedModule );
    if( !_.isEmpty( violationsInfo ) ) {
        tmpValue.hasViolation = true;
        const featureViolations = {
            [ pca0Constants.ERROR_SEVERITIES.ERROR ]: [],
            [ pca0Constants.ERROR_SEVERITIES.WARNING ]: [],
            [ pca0Constants.ERROR_SEVERITIES.INFO ]: []
        };
        // feature level violation population
        configuratorUtils.populateViolationMap( featureViolations, violationsInfo );
        configuratorUtils.populateViolationIndicatorsOnVmo( tmpValue, featureViolations, false /* false for feature level population */ );
    } else {
        tmpValue.hasViolation = false;
    }
    let wsObject = undefined;
    if( wsObjects ) {
        wsObject = wsObjects[ valueNode.nodeUid ];
    }
    if( wsObject !== undefined ) {
        tmpValue.optValue = viewModelObjectService.createViewModelObject( wsObject );
        //if not yet set default to thumbnails
        if( _.isUndefined( tmpValue.isThumbnailDisplay ) ) {
            tmpValue.isThumbnailDisplay = true;
        }
        // Meta info is not available on value vmo while creating value node in default cell display mode
        // Create meta info for value using cell properties from wsObject to show in compressed data mode as we will be not calling soa to get it again.
        if( tmpValue.meta && tmpValue.meta.length === 0 ) {
            tmpValue.meta = _getUserPreferredMetaData( _.get( wsObject, 'props.awp0CellProperties.uiValues' ) );
        }
    } else {
        tmpValue.optValue = {
            cellHeader1: !_.isEmpty( tmpValue.meta ) ? tmpValue.meta[0] : tmpValue.valueDisplayName,
            uid: valueNode.nodeUid,
            indicators: []
        };
    }

    tmpValue.optValueStr = valueNode.nodeUid;

    if( valueNode.props && valueNode.props.isEnumeratedRangeExpressionSelection &&
        valueNode.props.isEnumeratedRangeExpressionSelection[ 0 ] ) {
        tmpValue.isEnumeratedRangeExpr = true;
    }
    if( isFreeForm ) {
        tmpValue = exports.createFreeFormFeature( family, valueVmo.displayName, tmpValue );
        tmpValue.alternateID = family.famIndex + ':' + featureIndex + ':' + commonUtils.prepareUniqueId( family.alternateID, tmpValue.optValueStr );
    } else if( tmpValue.isEnumeratedRangeExpr ) {
        const ids = familyVmo.props.cfg0ChildrenIDs;
        const displayValues = familyVmo.props.cfg0ChildrenDisplayNames;
        tmpValue = createEnumerateRangeExpFeature( family, valueVmo.displayName, tmpValue.selectionState, ids, displayValues );
    } else if( valueNode.props && valueNode.props.isUnconfigured && valueNode.props.isUnconfigured[ 0 ] === 'true' ) {
        // If user does not have a read access to the selected feature, then show it as ***
        const isAccessDenied = _.get( valueNode, 'props.isAccessDenied.0' ) === 'true';
        // Create a client-side VMO
        createUnconfiguredClientSideVMO( tmpValue, family.familyStr, isAccessDenied );
        unconfigured = true;
    }

    if( family.familyType === 'Date' && !isFreeForm &&
        !tmpValue.isEnumeratedRangeExpr && !unconfigured ) {
        // Enumerated family only with default values of dates with object_String
        const dateToFormat = tmpValue.valueDisplayName;
        tmpValue.valueDisplayName = enumFeature.getDisplayNamesForEnumeratedFeature( dateToFormat, familyVmo.props.cfg0ChildrenIDs, familyVmo.props.cfg0ChildrenDisplayNames );
        tmpValue.optValue.cellHeader1 = tmpValue.valueDisplayName;
    }
    tmpValue.featureIndex = featureIndex;
    tmpValue.familyIndex = family.famIndex;
    tmpValue.isFeature = true;
    if( !isFreeForm ) {
        tmpValue.alternateID = commonUtils.prepareUniqueId( family.alternateID, valueNode.nodeUid );
    }
    //set the right indicators
    setIndicators( tmpValue );

    return tmpValue;
}

/**
 * Returns option values for a family
 *
 * @param {ObjectArray} optionValues value uids
 * @param {ObjectArray} treeData - variability data
 * @param {Object} vmos - view model objects
 * @param {boolean} isFreeForm for freeForm family
 * @param {Object} family - family object
 * @param {Object} labels - labels
 * @param {Object} wsObjects - wsObjects
 * @param {Object} familyVmo - familyVmo
 * @param {Object} currentSelectedModule - selected module in module heierarchy grid
 * @returns {ObjectArray} The array of features for option family
 */
function getFeaturesForFamily( optionValues, treeData, vmos, isFreeForm, family, labels, wsObjects, familyVmo, currentSelectedModule ) {
    let tmpValues = [];
    if ( optionValues ) {
        optionValues.forEach( ( id, featureIndex ) => {
            if ( treeData ) {
                const key = isFreeForm || id.includes( ':' ) ? id : family.familyStr + ':' + id;
                let valueNode = treeData[ key ];
                //check for parent property
                if( valueNode ) {
                    tmpValues.push( createFeatureNode( valueNode, vmos, isFreeForm, family, labels, wsObjects, familyVmo, featureIndex, currentSelectedModule ) );
                }
            }
        } );
    }
    return tmpValues;
}

/**
 *This API creates the Family node structure
 *
 * @param {ObjectArray} treeData - variability data
 * @param {Object} vmos - view model objects
 * @param {string} id - id
 * @param {Object} wsObjects - wsObjects
 * @param {Object} labels - labels
 * @param {number} familyIndex index of family
 * @param {Object} configPerspective - config perspective
 * @param {Boolean} guidedMode - guided mode flag
 * @param {String} grpNodeUid - group node uid
 * @param {Object} currentSelectedModule - selected module in module heierarchy grid
 * @returns {Object} Family node
 *
 */
let _createFamilyNode = ( treeData, vmos, id, wsObjects, labels, familyIndex, configPerspective, guidedMode, grpNodeUid, currentSelectedModule ) => {
    let tmpFamily = {};
    let familyNode = treeData[ id ];
    let familyVmo = vmos[ familyNode.nodeUid ];
    // ALL THE PROPERTY SHOULD BE CREATED WITH createVMO API define in common util
    let familyID = familyNode.nodeUid;
    tmpFamily.famIndex = familyIndex;
    tmpFamily.alternateID = commonUtils.prepareUniqueId( grpNodeUid, familyID );
    tmpFamily.familyDisplayName = familyVmo.displayName;
    tmpFamily.familyStr = familyID;
    tmpFamily.meta = _getUserPreferredMetaData( _.get( familyVmo, 'props.meta' ) );

    // Meta info is not available on familyVmo while creating family node in default cell display mode
    // Create meta info using cell properties from wsObject as we need to show it in both( default cell display and compressed data ) modes.
    if( tmpFamily.meta && tmpFamily.meta.length === 0 ) {
        let familyWsoObject = wsObjects ? wsObjects[familyNode.nodeUid] : undefined;
        if( familyWsoObject ) {
            tmpFamily.meta = _getUserPreferredMetaData( _.get( familyWsoObject, 'props.awp0CellProperties.uiValues' ) );
        }
    }

    if( familyNode.props && familyNode.props.selectionState ) {
        tmpFamily.selectionState = Number( familyNode.props.selectionState[ 0 ] );
    }
    tmpFamily.familyType = getFamilyType( familyVmo );
    if( familyNode.props && familyNode.props.isComplete ) {
        tmpFamily.complete = familyNode.props.isComplete[ 0 ] === 'true';
    }
    if( familyNode.props && familyNode.props.isUnconfigured ) {
        tmpFamily.isUnconfigured = familyNode.props.isUnconfigured[ 0 ] === 'true';
    }
    tmpFamily.isFiltered = true;
    if( familyNode.props && familyNode.props.allowedSelectionStates ) {
        tmpFamily.allowedSelectionStates = Number( familyNode.props.allowedSelectionStates.map( Number ) );
    }
    if( familyNode.props && familyNode.props.selectionState ) {
        tmpFamily.selectionState = Number( familyNode.props.selectionState[ 0 ] );
    }
    if( familyVmo.props && familyVmo.props.isProductModelFamily ) {
        tmpFamily.isProductModelFamily = familyVmo.props.isProductModelFamily[ 0 ] === 'true';
    }
    if( familyVmo.props && familyVmo.props.isThumbnailDisplay ) {
        tmpFamily.isThumbnailDisplay = familyVmo.props.isThumbnailDisplay[ 0 ] === 'true';
    }
    let isFreeForm = false;
    if( familyVmo.props && familyVmo.props.isFreeForm ) {
        isFreeForm = familyVmo.props.isFreeForm[ 0 ] === 'true';
    }
    tmpFamily.isFreeForm = isFreeForm;
    let features = familyNode.childrenUids;
    if( features && features.length > 0 ) {
        tmpFamily.values = getFeaturesForFamily( features, treeData, vmos, isFreeForm, tmpFamily, labels, wsObjects, familyVmo, currentSelectedModule );
    } else if( isFreeForm ) {
        tmpFamily.values = [ exports.createFreeFormFeature( tmpFamily, undefined ) ];
        tmpFamily.values[0].featureIndex = 0;
        tmpFamily.values[0].familyIndex = familyIndex;
        tmpFamily.values[0].isFeature = true;
        tmpFamily.values[0].alternateID = familyIndex + ':' + 0 + ':' + commonUtils.prepareUniqueId( tmpFamily.alternateID, tmpFamily.values[0].optValueStr );
    }

    if( familyVmo.props ) {
        //Show range information
        let rangeInfo = familyVmo.props.rangeInfo;
        if( rangeInfo && rangeInfo.length > 0 ) {
            tmpFamily.allowedRange = rangeInfo[ 0 ];
        }
        if( familyVmo.props.isSingleSelect ) {
            tmpFamily.singleSelect = familyVmo.props.isSingleSelect[ 0 ] === 'true';
            tmpFamily.singleSelectMsg = configuratorUtils.getFscLocaleTextBundle().aw_single_select_message;
        }
        if( familyVmo.props.cfg0IsDiscretionary ) {
            tmpFamily.cfg0IsDiscretionary = familyVmo.props.cfg0IsDiscretionary[ 0 ] === 'true';
        }
        if( !_.isUndefined( familyVmo.props.cfg0FamilyNamespace ) ) {
            tmpFamily.cfg0FamilyNamespace = familyVmo.props.cfg0FamilyNamespace[ 0 ];
        }
        if( familyVmo.props.cfg0ChildrenDisplayNames && familyVmo.props.cfg0ChildrenIDs ) {
            tmpFamily.childrenDispValues = familyVmo.props.cfg0ChildrenDisplayNames;
            tmpFamily.cfg0ChildrenIDs = familyVmo.props.cfg0ChildrenIDs;
        }
    }
    tmpFamily.incompleteIndicatorLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().incompleteIndicatorLabel;
    //// required object for the UI, no need to update in component update one time only here
    tmpFamily.familyCmdContext = { ..._createFamilyCommandContext( tmpFamily, configPerspective.uid, guidedMode ) };
    return tmpFamily;
};

/**
 * Returns option families for a group *
 *
 * @param {ObjectArray} families - option families uids
 * @param {ObjectArray} treeData - variability data .
 * @param {Object} vmos - view model objects
 * @param {Object} wsObjects - wsObjects
 * @param {Array} labels - labels violation messages
 * @param {Object} configPerspective - config perspective
 * @param {Boolean} guidedMode - guided mode flag
 * @param {String} grpNodeUid - group node uid
 * @param {Object} currentSelectedModule - selected module in module heierarchy grid
 * @returns {ObjectArray} The array of option families for option group
 */
const _getFamiliesForGroup = ( families, treeData, vmos, wsObjects, labels, configPerspective, guidedMode, grpNodeUid, currentSelectedModule ) => {
    let tempFamilies = [];
    families.forEach( ( id, index ) => {
        tempFamilies.push( _createFamilyNode( treeData, vmos, id, wsObjects, labels, index, configPerspective, guidedMode, grpNodeUid, currentSelectedModule ) );
    } );

    return tempFamilies;
};

/**
 *  Create group nodes from treeData
 *
 * @param {ObjectArray} treeData - variability data .
 * @param {Object} vmos - view model objects
 * @param {Object} id - id
 * @param {Object} wsObjects - wsObjects
 * @param {Object} labels - violation details.
 * @param {Object} configPerspective - config perspective
 * @param {Boolean} guidedMode - guided mode flag
 * @param {ObjectArray} currentScopeLabels - violation information to update the scope list
 * @param {Object} currentSelectedModule - selected module in module heierarchy grid
 * @returns {Object} Group node
 */
export let createGroupsNode = ( treeData, vmos, id, wsObjects, labels, configPerspective, guidedMode, currentScopeLabels, currentSelectedModule ) => {
    let tmpScope = {};
    let groupNode = treeData[ id ];
    let groupVmo = vmos[ groupNode.nodeUid ];
    let groupIconName = '';
    /// FOLOWING CODE SHOULD BE USED WITH createVmo api defined in utils service
    tmpScope.optGroup = groupNode.nodeUid;
    tmpScope.groupDisplayName = groupVmo.displayName;
    tmpScope.sourceUid = groupVmo.uid;
    tmpScope.tabKey = groupVmo.uid;
    tmpScope.objectID = tmpScope.optGroup;
    tmpScope.uid = tmpScope.optGroup;
    tmpScope.name = groupVmo.displayName;
    tmpScope.cellHeader1 = groupVmo.displayName;
    tmpScope.cellHeader2 = groupVmo.groupDescription;
    tmpScope.groupDescription = groupVmo.groupDescription;
    tmpScope.indicators = [];
    let wsObject = undefined;
    if( wsObjects ) {
        wsObject = wsObjects[ id ];
    }
    if( wsObject && wsObject !== undefined ) {
        tmpScope.vmo = viewModelObjectService.createViewModelObject( wsObject );
        tmpScope.isThumbnailDisplay = true;
    } else {
        tmpScope.vmo = groupNode.vmo ? groupNode.vmo : {};
    }
    if( groupVmo.uid === pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID ) {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_MODEL_FAMILY_GRP_REVISION;
    } else if( groupVmo.uid === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    } else {
        groupIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    }
    let imageIconUrl = iconSvc.getTypeIconURL( groupIconName );
    if( !imageIconUrl ) {
        //in case this is empty, add the default icon as type missing
        imageIconUrl = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_MISSING );
    }
    tmpScope.typeIconURL = imageIconUrl;
    if( groupNode.childrenUids && groupNode.childrenUids.length > 0 ) {
        // Case: Open panel- show OR
        // Case: There are valid values for a group OR
        // Case: There are no valid values in the expanded group
        tmpScope.expand = true;
    } else {
        tmpScope.expand = false;
    }

    let totalFeatureCount = 0;

    if( groupNode.childrenUids && groupNode.childrenUids.length > 0 ) {
        tmpScope.families = _getFamiliesForGroup( groupNode.childrenUids, treeData, vmos, wsObjects, labels ? labels : currentScopeLabels, configPerspective, guidedMode, groupNode.nodeUid,
            currentSelectedModule );
        for( var inx = 0; inx < tmpScope.families.length; inx++ ) {
            if( tmpScope.families[ inx ].values ) {
                totalFeatureCount += tmpScope.families[ inx ].values.length;
            }
        }
        tmpScope.variabilityCount = totalFeatureCount + groupNode.childrenUids.length;
    }

    if( tmpScope.expand ) {
        tmpScope.showFilter = configuratorUtils.determineIfShowFilterBox( totalFeatureCount );
    }
    tmpScope.vmo.objectID = tmpScope.optGroup;
    tmpScope.vmo.uid = tmpScope.optGroup;
    tmpScope.vmo.name = tmpScope.groupDisplayName;
    tmpScope.vmo.cellHeader1 = groupVmo.displayName;
    tmpScope.vmo.cellHeader2 = groupVmo.groupDescription;
    tmpScope.vmo.typeIconURL = imageIconUrl;
    tmpScope.vmo.sourceUid = groupVmo.uid;
    //tmpScope.vmo.indicators = [];
    tmpScope.vmo.getId = function() { return this.uid; };
    let violationsInfo = configuratorUtils.buildViolationString( tmpScope, labels, undefined, undefined, currentSelectedModule );
    if ( !violationsInfo.length ) {
        violationsInfo = configuratorUtils.buildViolationString( tmpScope, currentScopeLabels, undefined, undefined, currentSelectedModule );
    }
    const grpViolation = {
        [pca0Constants.ERROR_SEVERITIES.ERROR]: [],
        [pca0Constants.ERROR_SEVERITIES.WARNING]: [],
        [pca0Constants.ERROR_SEVERITIES.INFO]: []
    };
    // Feature level violation population
    configuratorUtils.populateViolationMap( grpViolation, violationsInfo );
    configuratorUtils.populateViolationIndicatorsOnVmo( tmpScope, grpViolation, true );

    return tmpScope;
};

var matchValuesToFilterText = function( family, patt ) {
    // If family is not filtered then check values.
    // If any of the value is filtered then family is filtered
    var valueMatch = false;
    for( var v_inx = 0; family.values && v_inx < family.values.length; v_inx++ ) {
        var value = family.values[ v_inx ];
        var isMatch = false;
        if( value.optValue && value.optValue.cellHeader1 ) {
            // Tiles are displayed for these values
            isMatch = matchValuesInTiles( value, patt );
        } else {
            // Values are displayed as string
            isMatch = patt.test( value.valueDisplayName );
        }
        value.isFiltered = isMatch;
        if( value.isFiltered && valueMatch === false ) {
            valueMatch = true;
        }
    }

    family.isFiltered = valueMatch;
};

var matchValuesInTiles = function( value, patt ) {
    // When Values are displayed as tiles match the pattern with cellheaders and cell properties
    var isMatch = patt.test( value.optValue.cellHeader1 );
    if( !isMatch && value.optValue.cellHeader2 ) {
        isMatch = patt.test( value.optValue.cellHeader2 );
    }

    if( !isMatch && value.optValue.cellProperties ) {
        for( var index = 0; index < value.optValue.cellProperties.length; index++ ) {
            isMatch = patt.test( value.optValue.cellProperties[ index ].value );
            if( isMatch ) {
                break;
            }
        }
    }
    return isMatch;
};

/**
 * This function filters the features and families based on the value of filter text
 * @param {Object} data - data with filter text and scope
 * @returns {Object} updated group
 */
export let filterFeatures = function( data ) {
    var inputFilterText = data.filterText.dbValue;
    var tempGroup = { ...data.scopeStruct.selectedGroup };
    //clear the isFiltered flag on both fams and values underneath
    if( tempGroup.families ) {
        tempGroup.families.forEach( ( f ) => {
            f.isFiltered = true;
            if( f.values ) {
                f.values.forEach( ( v ) => { v.isFiltered = true; } );
            }
        } );

        if( inputFilterText ) {
            let filterText = inputFilterText;
            // Usage of Kleene Star is different from what we normally intend in file/directory patterns
            // The character * in a regular expression means "match the preceding character zero or many times"
            // e.g. 'ba*' matches b, ba, baa, baaa, baaaa, ...
            // By default, filterData.filterText is the string searched in the family/value displayName
            // Wildcard * used in this search should be preceded by . (dot)
            // to get same value as when searching for file names/paths
            filterText = filterText.replace( '*', '.*' );
            //ctx.filterData.filterText = filterText;
            var patt = new RegExp( filterText, 'i' );

            var arrayLength = data.scopeStruct.selectedGroup.families.length;
            tempGroup = { ...data.scopeStruct.selectedGroup };
            for( var inx = 0; inx < arrayLength; inx++ ) {
                var family = tempGroup.families[ inx ];

                // Check for boolean
                if( family.familyDisplayName ) {
                    family.isFiltered = patt.test( family.familyDisplayName );
                } else {
                    family.isFiltered = false;
                }

                // If family is filtered then all values are filtered
                if( family.isFiltered ) {
                    for( var i = 0; i < family.values.length; i++ ) {
                        family.values[ i ].isFiltered = true;
                    }
                } else {
                    matchValuesToFilterText( family, patt );
                }
            }
        }
    }
    return tempGroup;
};

/**
 * Adds a free-form option value to the configuration context and updates the selection state.
 *
 * @param {Object} eventData - The event data containing the new value text.
 * @param {Object} scopeStruct - The scope structure containing the selected group and families.
 *
 **/
export let addFreeFormOptionValue = ( eventData, scopeStruct ) => {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let familyStr = commandContext.family.familyStr;
    let prevValueUid = familyStr + ':' + commandContext.value.dbValue;

    // If user loads SVR which has date and try to update date value.
    if( commandContext.value.type === 'DATE' && !prevValueUid.endsWith( 'T00:00:00Z' ) && commandContext.value.valueDisplayName ) {
        prevValueUid = familyStr + ':' + commandContext.value.valueDisplayName;
    }

    let finalValue = eventData.valueText;
    // Replace old option value selection with new
    if( commandContext.value.dbValue !== eventData.valueText && !_.isEmpty( fscContext.selectedExpressions ) ) {
        let optionValueSelections = [];
        let configExprMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );
        if( configExprMap && familyStr in configExprMap &&
            configExprMap[ familyStr ] !== undefined ) {
            optionValueSelections = configExprMap[ familyStr ];
        }
        let indexToRemove = null;
        for( let i = 0; i < optionValueSelections.length; i++ ) {
            let tmpUid = optionValueSelections[ i ].family + ':' + optionValueSelections[ i ].valueText;
            if( tmpUid === prevValueUid ) {
                indexToRemove = i;
                break;
            }
        }
        if( indexToRemove !== null && indexToRemove > -1 ) {
            optionValueSelections.splice( indexToRemove, 1 );
        }
        if( configExprMap && configExprMap[ familyStr ] ) {
            configExprMap[ familyStr ] = optionValueSelections;
        }
    }

    commandContext.value.selectionState = 1;
    let displayValue = finalValue;
    let vmo = {
        uid: '_freeFormFeature_',
        cellHeader1: displayValue,
        typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION ),
        indicators: [],
        isDateRangeExpr: false
    };
    //in case this is empty, add the default icon
    if( !vmo.typeIconURL ) {
        vmo.typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    }

    let dateExpr = finalValue.split( ' ' );
    //To display formated date
    if( commandContext.value.isFreeFormFeature && commandContext.value.type === 'DATE' && !commandContext.value.error && dateExpr[ 1 ] ) {
        let fromOp = '';
        let toOp = '';
        let toDate = '';
        let fromDate = '';
        if( dateExpr[ 1 ] ) {
            fromOp = dateExpr[ 0 ];
            fromDate = dateExpr[ 1 ];
        }
        if( dateExpr[ 3 ] ) {
            toOp = dateExpr[ 3 ];
            toDate = dateExpr[ 4 ];
        }
        let formatedFromDate = commonUtils.getFormattedDateFromUTC( fromDate );
        let formatedToDate = commonUtils.getFormattedDateFromUTC( toDate );
        let exprValue = fromOp + ' ' + formatedFromDate;

        // date value for TC DB should in UTC format
        finalValue = fromOp + ' ' + commonUtils.getFormattedDateString( new Date( fromDate ) );
        if( dateExpr[ 3 ] && dateExpr[ 4 ] ) {
            exprValue += ' & ' + toOp + ' ' + formatedToDate;
            finalValue += ' & ' + toOp + ' ' + commonUtils.getFormattedDateString( new Date( toDate ) );
        }

        displayValue = exprValue;
        const dateApi = {
            isDateEnabled: true,
            dateObject: {},
            dateValue: exprValue
        };
        commandContext.value.dateApi = dateApi;
        vmo.isDateRangeExpr = true;
        commandContext.value.isDateRangeExpr = true;
    }
    vmo.cellHeader1 = displayValue;
    commandContext.value.optValueStr = familyStr + ':' + finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.optValue = vmo;
    commandContext.value.uiValue = displayValue;
    commandContext.value.uiOriginalValue = displayValue;
    commandContext.value.dispValue = displayValue;
    const familyIndex = commandContext.value.familyIndex;
    const featureIndex = commandContext.value.featureIndex;
    const featureAlternateID = familyIndex + ':' + featureIndex + ':' + commonUtils.prepareUniqueId( commandContext.family.alternateID, commandContext.value.optValueStr );
    commandContext.value.alternateID = featureAlternateID;
    commandContext.family.values[ featureIndex ] = commandContext.value;
    commandContext.configPerspectiveUid = _.get( scopeStruct, `selectedGroup.families[${familyIndex}].familyCmdContext.configPerspectiveUid` );
    setSelectionInSummary( commandContext, 1 );
};

/**
 * Give the request info according to the action
 * @param {Object} data - The view data
 * @param {Boolean} isSelectionSummaryOpen - Flag indicating if selection summary is open.
 * @returns {Object} requestInfo
 */
export let getRequestInfoForExpandSystemSelection = function( data, isSelectionSummaryOpen ) {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    //LCS-921006 - Consume updated SOA for getting expansion included after the first 'Next' on a root node
    //interim solution: there is no guided mode expansion implemented and until
    //we consolidate the SOA to return expansions in certain guided mode usecases, we do use an additional expand soa
    //call in guided mode

    let requestInfo = {
        requestType: [ VCV_ACTIONS.EXPAND ],
        configurationControlMode: [ 'manual' ], //[ commonUtils.getConfigurationMode( pca0Constants.FSC_CONTEXT ) ],
        profileSettings: [ configuratorUtils.getProfileSettingsForFsc() ],
        moduleHierarchy: [ fscContext.configurationModuleHierarchy ? fscContext.configurationModuleHierarchy : '' ],
        isCompactMode: [ fscContext.vcvLayoutSettings.showCompressedData === true ? 'true' : 'false' ],
        statsCollectorScopeName: [ pca0CommonUtils.getStatsCollectorName( 'expandSystemSelection' ) ]
    };

    if( isSelectionSummaryOpen ) {
        requestInfo.selectionSummary = [ 'allSelections' ];
    }

    Object.assign( requestInfo, data.eventData.action === 'switchingToManual' ? { switchingToManualMode: [ 'true' ] } : null );
    return requestInfo;
};

export let getRequestInfoForToggleManualGuidedMode = function() {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let requestInfo = {
        requestType: [ 'getConfig' ],
        configurationControlMode: [ commonUtils.getConfigurationMode( pca0Constants.FSC_CONTEXT ) ],
        switchingToGuidedMode: [ fscContext.switchingToGuidedMode ? 'true' : '' ],
        profileSettings: [ configuratorUtils.getProfileSettingsForFsc() ],
        moduleHierarchy: [ fscContext.configurationModuleHierarchy ? fscContext.configurationModuleHierarchy : '' ],
        isCompactMode: [ fscContext.vcvLayoutSettings.showCompressedData === true ? 'true' : 'false' ],
        statsCollectorScopeName: [ pca0CommonUtils.getStatsCollectorName( '_' ) ]
    };
    Object.assign( requestInfo, fscContext.reassessSelections ? { reassessSelections: [ 'true' ] } : null );
    delete fscContext.reassessSelections;

    appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    return requestInfo;
};

/**
 * Helps to create Feature for enumerated family
 * @param {Object} family To get information about family to create respective feature
 * @param {String} displayName Name to display on Feature
 * @param {number} selectionState Set selection state
 * @param {string[]} ids names identified by server
 * @param {string[]} displayValues UI values to show on AW with respective to server
 * @returns {Object} tmpValue To updates data in AW
 */
let createEnumerateRangeExpFeature = function( family, displayName = '', selectionState = 1, ids, displayValues ) {
    let tmpValue = {};
    let type = 'String';
    let familyType = family.familyType;
    const internalDisplayName = displayName;
    /**
     * We have introduced cfg0ChildrenIDs and cfg0displayValues array at server
     * cfg0displayValues contains display required by end user with respective to cfg0ChildrenIDs
     * e.g. for integer datatype
     * cfg0ChildrenIDs = [1, 2, 3]  // These are acutual values know by server
     * cfg0displayValues = [ 'one', 'two', 'three' ] // values expected by user at AW display
     * so following function help us to get respective display values for there ids.
     */
    displayName = enumFeature.getDisplayNamesForEnumeratedFeature( displayName, ids, displayValues );
    let vmo = {
        uid: '_freeFormFeature_',
        cellHeader1: displayName,
        typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION ),
        indicators: [],
        isDateRangeExpr: false
    };
    //in case this is empty, add the default icon
    if( !vmo.typeIconURL ) {
        vmo.typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    }
    if( familyType === 'Date' ) {
        tmpValue.uiValue = displayName;
        vmo.isDateRangeExpr = true;
    }
    tmpValue.optValueStr = family.familyStr + ':' + internalDisplayName;
    tmpValue.allowedSelectionStates = [ 1, 2, 0 ];
    tmpValue.isFiltered = true;
    tmpValue.selectionState = selectionState;
    tmpValue.type = family.familyType;
    tmpValue.dbValue = displayName;
    tmpValue.dispValue = displayName;
    tmpValue.isRequired = false;
    tmpValue.isEditable = true;
    tmpValue.isEnabled = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isFreeFormFeature = false;
    tmpValue.isEnumeratedRangeExpr = true;
    tmpValue.optValue = vmo;

    return tmpValue;
};

/**
 * Helps to remove already selected feature from Expression Map
 * @param {String} familyUid To get feature belongs specific family
 * @param {String} prevFeatureUid To compare and remove from selected range feature
 * @param {String} previousValue To compare with current display
 * @param {String} currentValue To compare with previous value
 * @param {String} selectedExpression To get expression from expression map
 * @param {Object} commandContext panel context
 */
let removePreviousValueForSelectedRange = function( familyUid, prevFeatureUid, previousValue, currentValue, selectedExpression, commandContext ) {
    //Replace old option value selection with new
    if( previousValue && previousValue !== currentValue && !_.isEmpty( selectedExpression ) ) {
        let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
        let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
        /**
         * We have introduced cfg0ChildrenIDs and cfg0displayValues array at server
         * cfg0displayValues contains display required by end user with respective to cfg0ChildrenIDs
         * e.g. for integer datatype
         * cfg0ChildrenIDs = [1, 2, 3]  // These are acutual values know by server
         * cfg0displayValues = [ 'one', 'two', 'three' ] // values expected by user at AW display
         * so following function help us to get ids values for selected display name as we store expression using ids in config expression map.
         */
        prevFeatureUid = enumFeature.getServerNamesForEnumeratedFeature( prevFeatureUid, ids, displayValues, commandContext.family.familyType );
        let availableRangeFeatures = [];
        let configExprMap = exprGridSvc.getConfigExpressionMap( selectedExpression );
        if( configExprMap && familyUid in configExprMap &&
            configExprMap[ familyUid ] !== undefined ) {
            availableRangeFeatures = configExprMap[ familyUid ];
        }
        let indexToRemove = null;
        for( let i = 0; i < availableRangeFeatures.length; i++ ) {
            let tmpUid = availableRangeFeatures[ i ].family + ':' + availableRangeFeatures[ i ].valueText;
            if( tmpUid === prevFeatureUid ) {
                indexToRemove = i;
                //previousSelectionRemoved = true;
                break;
            }
        }
        if( indexToRemove !== null && indexToRemove > -1 ) {
            availableRangeFeatures.splice( indexToRemove, 1 );
        }
        configExprMap[ familyUid ] = availableRangeFeatures;
    }
};

/**
 * Helps to show selection in Summary page/view
 * @param {Object} commandContext To get information about selected feature
 * @param {number} select To set selection in summay page by default its 1
 */
let setSelectionInSummary = function( commandContext, select = 1 ) {
    let selectionDataObj = {
        variantcontext: pca0Constants.FSC_CONTEXT,
        valueaction: 'selectFeature',
        value: commandContext.value,
        family: commandContext.family,
        group: commandContext.group,
        state: select,
        perspectiveUid: commandContext.configPerspectiveUid,
        path: { famIndex: commandContext.famIndex, index: commandContext.index }
    };
    let selectionObj = {
        selectionData: selectionDataObj,
        isFamilySelection: false
    };

    eventBus.publish( 'Pca0FscSelectionService.setSelection', selectionObj );
};

/**
 * To remove selction from summary and family object.
 * @param {Object} commandContext panel context
 * @param {Object} scopeInfo - The View model data to represent features component
 * @returns {Object} Updated scopeInfo
 * */
export let removeRangeExpForEnumeratedFeature = ( commandContext, scopeInfo ) => {
    let newScopeInfo = { ...scopeInfo };
    let newScope = newScopeInfo.selectedGroup;
    let scopeIndex = newScopeInfo.selectedScopeIndex;
    let familyObj = newScope.families[ commandContext.famIndex ];

    const featureIndex = commandContext.value.featureIndex;
    if( featureIndex > -1 ) {
        for( let i = featureIndex + 1; i < familyObj.values.length; i++ ) {
            familyObj.values[ i ].featureIndex -= 1;
        }
        familyObj.values.splice( featureIndex, 1 );
    }

    commandContext.family = familyObj;
    setSelectionInSummary( commandContext, 0 );

    newScopeInfo.scopesList[ scopeIndex ] = newScope;
    newScopeInfo.selectedGroup = newScope;
    newScopeInfo.selectedScopeIndex = scopeIndex;
    newScopeInfo.selectedGroup.variabilityChange = new Date().getTime();
    return newScopeInfo;
};

/**
 * updates range feature to enumerated family and Create thumbnail vmo
 * @param {String} oldValueText: Old value of feature updated
 * @param {String} valueText : Updated feature text
 * @param {Object} scopeInfo VM data to represent features
 * @returns {Object} Updated scopeInfo
 */
export let updateRangeExpressionForEnumeratedFamily = function( oldValueText, valueText, scopeInfo ) {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let finalValue = valueText;
    let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
    let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
    commandContext.value.optValueStr = commandContext.family.familyStr + ':' + finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.dispValue = finalValue;
    commandContext.value.uiValue = finalValue;
    let featureData = createEnumerateRangeExpFeature( commandContext.family, finalValue, 1, ids, displayValues );
    commandContext.value.optValue = featureData.optValue;
    //maria: I am not sure that this is the right behavior: basically a deselected feature will also auto select just because we update the value
    commandContext.value.isThumbnailDisplay = true;
    commandContext.group.groupDisplayName = scopeInfo.selectedGroup.groupDisplayName;
    commandContext.group.groupUID = scopeInfo.selectedGroup.groupUID;
    let familyStr = commandContext.family.familyStr;
    let prevFeatureUid = familyStr + ':' + oldValueText;
    removePreviousValueForSelectedRange( familyStr, prevFeatureUid, oldValueText, finalValue, fscContext.selectedExpressions, commandContext );

    setSelectionInSummary( commandContext );
    let newScopeInfo = { ...scopeInfo };
    let newScope = newScopeInfo.selectedGroup;
    let familyObj = _.find( newScope.families, { familyStr: commandContext.family.familyStr } );
    let featureIndex = _.findIndex( familyObj.values, function( val ) {
        return val.optValueStr === commandContext.family.familyStr + ':' + oldValueText;
    } );
    // In case of Date feature we need to check for display value as optValueStr will be in UTC format
    if( featureIndex === -1 ) {
        featureIndex = _.findIndex( familyObj.values, function( val ) {
            return val.optValue.cellHeader1 === oldValueText;
        } );
    }
    familyObj.values[ featureIndex ] = commandContext.value;
    // as shallow copy it should update data
    newScopeInfo.selectedGroup.variabilityChange = new Date().getTime();
    return newScopeInfo;
};

/**
 * Add range feature to enumerated family and Create thumbnail vmo
 * @param {string} valueText : Feature text
 * @param {Object} scopeStruct - selected group info
 * @returns {Object} updated scopeStruct
 */
export let addRangeExpressionForEnumeratedFamily = function( valueText, scopeStruct ) {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
    let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
    let finalValue = valueText;
    let featureData = createEnumerateRangeExpFeature( commandContext.family, finalValue, 1, ids, displayValues );
    let newScopes = { ...scopeStruct };
    let scope = newScopes.selectedGroup;
    let familyObj = _.find( scope.families, { familyStr: commandContext.family.familyStr } );
    let familyIndex = _.findIndex( scope.families, { familyStr: commandContext.family.familyStr } );
    featureData.featureIndex = familyObj.values.length;
    featureData.familyIndex = commandContext.famIndex;
    featureData.isFeature = true;
    featureData.alternateID = commonUtils.prepareUniqueId( familyObj.alternateID, featureData.optValueStr );

    commandContext.value.optValueStr = commandContext.family.familyStr + ':' + finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.dispValue = finalValue;
    commandContext.value.selectionState = 1;
    commandContext.value.optValue = featureData.optValue;
    commandContext.value.isThumbnailDisplay = true;
    commandContext.value.isEnumeratedRangeExpr = featureData.isEnumeratedRangeExpr;
    commandContext.group.groupDisplayName = scopeStruct.selectedGroup.groupDisplayName;
    commandContext.group.groupUID = scopeStruct.selectedGroup.groupUID;
    familyObj.values.push( featureData );
    commandContext.family = familyObj;
    setSelectionInSummary( commandContext );
    newScopes.scopesList[ newScopes.selectedScopeIndex ] = scope;
    newScopes.selectedGroup.families[ familyIndex ] = familyObj;
    newScopes.selectedGroup.variabilityChange = new Date().getTime();
    return newScopes;
};

/**
 * Returns the switchingToGuidedMode flag
 * @returns {string} - flag
 */
export let getSwitchingToGuidedMode = function() {
    var context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( context && context.switchingToGuidedMode ) {
        return 'true';
    }
    return 'false';
};

/**
 * Listener to condition value change for families collection
 * Focus on active family
 * Scroll to active family (e.f. family owning last selected feature)
 *
 * If Guided Navigation is active
 * Collapse other families in group and keep expanded navigation target family only.
 * Update Navigation information on context
 * @param {Object} group The scope
 * @returns {Object} - The Scope, focusedFamilyId and systemExpandedFamilies.
 */
export let focusToFamily = ( group ) => {
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let scope = { ...group };
    let systemExpandedFamilies = [];
    // Event listener to condition value change to the whole collection of families
    // Need to move along if we are in the right scope and families are loaded for the scope
    if( !_.isUndefined( fscContext.navigateTo ) && fscContext.navigateTo.groupUid === scope.uid ) {
        // Collapse all other families
        let alternateID = '';
        if ( scope.families ) {
            scope.families.forEach( family => {
                family.isCollapsed = family.familyStr !== fscContext.navigateTo.familyUid;
                family.isHighlighted = family.familyStr === fscContext.navigateTo.familyUid;
                alternateID = family.isHighlighted && alternateID === '' ? family.alternateID : alternateID;
                // push only highlighted families to the expanded families list
                family.isHighlighted && systemExpandedFamilies.push( family.alternateID );
            // Un-comment this code when multi-select families scenario is addressed.
            // // If multi-select family, its required features will display an *
            // if( family.isHighlighted && !family.singleSelect ) {
            //     let cachedTreeNodes = fscContext.incompleteFamiliesInfo.incompleteFamiliesTreeData;
            //     _.forEach( family.values, feature => {
            //         let featureNode = _.find( cachedTreeNodes, { nodeUid: feature.optValueStr } );
            //         feature.isRequiredForCompletenessCheck = !_.isUndefined( featureNode );
            //     } );
            // }
            } );
        }
        // Save current navigation point (it will be used for further navigation)
        fscContext.activeFamilyUID = fscContext.navigateTo.familyUid;
        fscContext.activeSelectedData = alternateID; //fscContext.navigateTo.familyUid;
        // Update Context information
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }
    scope.variabilityChange = new Date().getTime();
    return {
        group: scope,
        focusedFamilyId: fscContext.activeFamilyUID,
        systemExpandedFamilies: systemExpandedFamilies
    };
};

/**
 * Rendering method, gets triggered every time the props change
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FeaturesRenderFunction = ( props ) => {
    let { fields, viewModel, elementRefList } = props;
    let { data } = viewModel;
    const context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );

    if( _.get( data, 'scopeStruct.selectedGroup.families.length' ) > 0 ) {
        const families =  [ ..._.get( data, 'scopeStruct.selectedGroup.families' ) ];
        return (
            <>
                {   // Filter box
                    <AwTextBox  {...getField( 'data.filterText', fields )} className='aw-cfg-feature-filterBox' ></AwTextBox>
                }
                <div className='aw-base-scrollPanel sw-column' ref={elementRefList.get( 'pca0Features' )}>
                    {
                        <Pca0FamilyProvider
                            families={families}
                            groupName={data.scopeStruct.selectedGroup.cellHeader1}
                            variabilityChange={data.scopeStruct.selectedGroup.variabilityChange}
                            variabilityCount={data.scopeStruct.selectedGroup.variabilityCount}
                            familyUid={context.activeSelectedData}
                            filterString={data.filterText.dbValue}
                            parentRef={elementRefList.get( 'pca0Features' )}
                            viewSettings={context.vcvLayoutSettings ? context.vcvLayoutSettings : {}}
                            systemExpandedFamilies={data.systemExpandedFamilies}>
                        </Pca0FamilyProvider>
                    }
                </div>
            </>
        );
    }
    return <></>;
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
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Removes all violation indicators from all group-level scopes in the provided object.
 * @param {Object} scopes - The object containing the group-level scopes.
 * @returns{Object} newScopeInfo - Updated scope with violations removed at all groups and also violations
 * on features from current group
 */
export let removeViolationsFromAllGroupLevel = function( scopes ) {
    // Remove stored violation labels from scopes when the SVR is changed
    delete scopes.labels;
    let newScopeInfo = { ...scopes };
    if( newScopeInfo ) {
        /*
        Iterates through each scope in the scopes list and removes any violation indicators.
        */
        newScopeInfo.scopesList.forEach( function( scope ) {
            if( scope.vmo ) {
                _.remove( scope.indicators, {
                    type: 'violation'
                } );
                _.remove( scope.vmo.indicators, {
                    type: 'violation'
                } );
            }
        } );
    }

    return newScopeInfo;
};

/**
 * Removes all violation indicators from all group-level scopes and current group features and
 * system selection from features in current group in the provided object.
 * @param {Object} scopes - The object containing the group-level scopes.
 * @returns{Object} newScopeInfo - Updated scope
 */
export let clearAllViolationsAndSystemSelectionIndicators = ( scopes ) => {
    // remove violations from all the groups
    let newScopes = exports.removeViolationsFromAllGroupLevel( scopes );

    // remove violations from all features in current group
    exports.removeViolationsFromCurrentGroup( newScopes );

    // remove the system selection indicator from all the features in current group
    // NOTE - This just removes the indicator and doesn't reset the selection state itself
    exports.removeSystemSelectionIndicatorFromCurrentGroup( newScopes );

    return newScopes;
};

/**
 * Evaluate expand and validate functionality of FSC
 * @param {Object} scopeStruct - VM DATA
 * @param {Object} fscState - as in atomic data
 * @param {String} operationType - type of operation send by event
 *
 */
export let handleExpandValidateFunctionalities = ( scopeStruct, fscState, operationType ) => {
    if( operationType === 'expand' ) {
        eventBus.publish( 'Pca0Features.Pca0Expand', {
            action: VCV_ACTIONS.EXPAND
        } );
    } else if( operationType === 'validate' ) {
        const fscValue = fscState.getValue();
        // This update is not required need to remove this variable
        fscValue.isValidationInProgress = true;
        eventBus.publish( 'Pca0Features.validate' );
        fscState.update( fscValue );
    }
};

/**
 * Returns scopeStruct
 * @param {Object} scopeStruct - scope structure
 * @param {Object} eventData - event data for change in feature
 * @returns {Object} scopestruct
 */
export const updateChangedVariability = ( scopeStruct, eventData ) => {
    // This function should be get called when there is selection changed in manual mode
    // This is work around to update variability in scopeStruct
    // This function should be get called only once in whole process
    let newScopeInfo = {};
    const selectionData = eventData.selectionData;
    newScopeInfo.scopesList = [ ...scopeStruct.scopesList ];
    newScopeInfo.selectedGroup = scopeStruct.selectedGroup;
    newScopeInfo.labels = scopeStruct.labels;
    newScopeInfo.selectedScopeIndex = scopeStruct.selectedScopeIndex;
    if( !_.isUndefined( _.get( selectionData, 'path.index' ) ) ) {
        const featureIndex = selectionData.path.index;
        const familyIndex = selectionData.path.famIndex;
        const featureValue = newScopeInfo.selectedGroup.families[ familyIndex ].values[ featureIndex ];
        const isGuidedMode = newScopeInfo.selectedGroup.families[ familyIndex ].familyCmdContext.guidedMode;
        delete newScopeInfo.selectedGroup.families[ familyIndex ].familyCmdContext;
        newScopeInfo.selectedGroup.families[ familyIndex ].selectionState = selectionData.family.selectionState;
        newScopeInfo.selectedGroup.families[ familyIndex ].familyCmdContext = { ..._createFamilyCommandContext( selectionData.family, selectionData.perspectiveUid, isGuidedMode ) };
        // When removing enumerated value, list of 'values' comes as undefined at featureIndex
        if( !_.isUndefined( newScopeInfo.selectedGroup.families[ familyIndex ].values[ featureIndex ] ) ) {
            newScopeInfo.selectedGroup.families[ familyIndex ].values[ featureIndex ].selectionState = selectionData.state;
            newScopeInfo.selectedGroup.families[ familyIndex ].values[ featureIndex ].optValue = { ..._removeIndicators( featureValue, 'all' ) };
        }
        newScopeInfo.selectedGroup.families[ familyIndex ].complete = selectionData.family.complete;
    }

    // This will be having values only in case of SF and that too, it is shared
    // across Dynamic Families. Hence, no performance impact.
    let featureSelectionsToBeRemovedFromVMO = eventData.featureSelectionsToBeRemovedFromVMO;
    if( !_.isEmpty( featureSelectionsToBeRemovedFromVMO ) ) {
        // Iterate over selectedGroup families
        for( let family of newScopeInfo.selectedGroup.families ) {
            let familyUid = family.familyStr;
            if( familyUid in featureSelectionsToBeRemovedFromVMO ) {
                // Iterate over family values
                for( let value of family.values ) {
                    // Check if the value is in the featureSelectionsToBeRemovedFromVMO
                    if( featureSelectionsToBeRemovedFromVMO[ familyUid ] === value.optValueStr ) {
                        // Remove the selection state from the value
                        value.selectionState = 0;
                        // Also remove the indicator from the value
                        value.optValue.indicators = [];
                        // Remove the value from the featureSelectionsToBeRemovedFromVMO
                        delete featureSelectionsToBeRemovedFromVMO[ familyUid ];
                        // Only 1 feature will be having the entry for a family. hence break the loop
                        break;
                    }
                }
            }
        }
    }
    newScopeInfo.scopesList[ scopeStruct.selectedScopeIndex ] = newScopeInfo.selectedGroup;
    return newScopeInfo;
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForVCV = ( ) => {
    return commonUtils.getPropertyPolicy( 'variantConfigurationView' );
};

/**
 * Reset text filter
 * @param {Object} _ reserved for response coming from server
 * @param {Object} textComponent textComponent
 * @returns {Object} textComponent
 */
export const resetFilterText = ( _, textComponent ) => {
    textComponent.dbValue = '';
    textComponent.value = '';
    textComponent.uiValue = '';
    return textComponent;
};

export default exports = {
    getScope,
    getCachedScopeData,
    getScopeData,
    addInlineFreeFormFeature,
    removeInlineFreeFormFeature,
    updateVariantMode,
    getActiveVariantRules,
    showViolationsOnValidation,
    showNotificationMessage,
    getSelectionForVariantContext,
    getConfigurationMode,
    getConfigurationModeForLoadScopeData,
    getProfileSettings,
    showValidationErrorMessage,
    stayInManualMode,
    showUnableToSwitchToGuidedModeMessage,
    validateConfiguration,
    expandSystemSelections,
    showPackagePanel,
    clearScopeData,
    resetGroup,
    clearSystemSelectionsInManualMode,
    clearSystemSelectionsInFsc,
    clearAllSelectionsInFsc,
    clearAllSelections,
    updateGroupListInScopeView,
    createGroupsNode,
    createFreeFormFeature,
    filterFeatures,
    addFreeFormOptionValue,
    getRequestInfoForToggleManualGuidedMode,
    addRangeExpressionForEnumeratedFamily,
    updateRangeExpressionForEnumeratedFamily,
    removeRangeExpForEnumeratedFeature,
    getSwitchingToGuidedMode,
    focusToFamily,
    updateSelectionStateAndSetIndicatorsOnExistingScopeData,
    removeViolationsFromCurrentGroup,
    getRequestInfoForExpandSystemSelection,
    setIndicators,
    getScopeDataForExpand,
    getConfigPerspective,
    getScopeDataForValidate,
    removeSelectionsFromCurrentGroup,
    pca0FeaturesRenderFunction,
    convertSelectedExpressionJsonObjectToString,
    removeViolationsFromAllGroupLevel,
    handleExpandValidateFunctionalities,
    updateChangedVariability,
    removeSystemSelectionIndicatorFromCurrentGroup,
    clearAllViolationsAndSystemSelectionIndicators,
    getPropertyPolicyForVCV,
    resetFilterText
};
