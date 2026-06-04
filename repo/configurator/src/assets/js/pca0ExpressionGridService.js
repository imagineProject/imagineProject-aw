// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ExpressionGridService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Get PCA Grid SubExpression populated from node ID to selection map
 * @param {Object} businessObjectToSelectionMap businessobject to selection map
 * @param {Object} splitExpressions list of split expressions for a business object
 * @param {Boolean} skipEmpty true if empty subExpressions must be left out (Constraints Grid Editor scenario for split sections)
 * @returns {Object} PCA Grid subexpression
 */
function getSubExpressions( businessObjectToSelectionMap, splitExpressions, skipEmpty ) {
    let pcaSubExpressions = [];
    _.forEach( splitExpressions, splitExpression => {
        let nodeIDToSelections = businessObjectToSelectionMap[ splitExpression ];
        let pcaGridExpressionGroups = {};
        let nodeIDs = Object.keys( nodeIDToSelections );
        _.forEach( nodeIDs, nodeID => {
            let node = nodeIDToSelections[ nodeID ];
            let mapKey = node.family;
            if( mapKey === '' /*Family is configured-out*/ ) {
                mapKey = node.familyNamespace + ':' + node.familyId;
            }
            let selectionList = pcaGridExpressionGroups[ mapKey ];
            if( !selectionList ) {
                selectionList = [];
            }
            selectionList.push( node );
            pcaGridExpressionGroups[ mapKey ] = selectionList;
        } );
        if( !_.isEmpty( pcaGridExpressionGroups ) || !skipEmpty ) {
            let pcaSubExpression = {
                expressionGroups: pcaGridExpressionGroups
            };
            pcaSubExpressions.push( pcaSubExpression );
        }
    } );
    return pcaSubExpressions;
}

/**
 * @param {Object} businessObjectToSelectionMap businessobject to selection map
 */
let getBusinessObjectToSplitExpressionMap = function( businessObjectToSelectionMap ) {
    let boToSplitExpressionMap = {};
    let boKeys = Object.keys( businessObjectToSelectionMap );
    _.forEach( boKeys, boKey => {
        let originalKey = pca0CommonUtils.getOriginalColumnKeyFromSplitColumnKey( boKey );
        let splitExpressions = boToSplitExpressionMap[ originalKey ];
        if( !splitExpressions ) {
            splitExpressions = [];
            boToSplitExpressionMap[ originalKey ] = splitExpressions;
        }
        splitExpressions.push( boKey );
    } );
    return boToSplitExpressionMap;
};

/**
 * Get PCA Grid from current selection map - suitable for SOA input
 * @param {Object} businessObjectToSelectionMap - selection map
 * @returns {Object} PCA Grid
 */
export let getPCAGridFromSelectionMap = function( businessObjectToSelectionMap ) {
    let pcaGrid = {};
    let boToSplitExpressionMap = getBusinessObjectToSplitExpressionMap( businessObjectToSelectionMap );
    let boKeys = Object.keys( boToSplitExpressionMap );
    _.forEach( boKeys, boKey => {
        let splitExpressions = boToSplitExpressionMap[ boKey ];
        let pcaSubExpressions = getSubExpressions( businessObjectToSelectionMap, splitExpressions );
        let pcaExpression = {
            formula: '',
            exprID: '',
            expressionType: pca0Constants.EXPRESSION_TYPES.VARIANT_CONDITION,
            configExpressionSet: [ {
                configExpressionSections: [ {
                    formula: '',
                    expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
                    subExpressions: pcaSubExpressions
                } ]
            } ]
        };

        let pcaExpressionList = [];
        pcaExpressionList.push( pcaExpression );

        pcaGrid[ boKey ] = pcaExpressionList;
    } );
    return pcaGrid;
};

/**
 * Get PCA Grid with multiple Section Expressions populated from node ID to selection map
 * using Subject/Condition selection maps.
 * Subject section is split into Subject and ExpressionScript sections based on Constraint Rule type
 * PCAGrid will contain 3 sections with 3 expression types: Subject/Condition/ExpressionScript.
 * @param {Object} selectionMap (subjectSelectionMap for Subject and multipleVariantGridSelectionMap for variants) 
 * @param {Object} conditionSelectionMap Condition selectionMap (will be passed only in case of Constraints Grid Editor)
 * @param {String} gridEditorMode Mode of the grid. ( e.g. 'multiSvrGrid', 'Cfg0AbsMatrixRule' )
 * @returns {Object} PCA Grid
 */
export let getPCAGridWithMultiGridFromSelectionMap = ( selectionMap, conditionSelectionMap, gridEditorMode ) => {
    let pcaGrid = {};
    let boToSplitExpressionMap = getBusinessObjectToSplitExpressionMap( selectionMap );
    let boKeys = Object.keys( boToSplitExpressionMap );
    let isConstraintsGrid = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_CONSTRAINT_RULE || gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;

    boKeys.forEach( boKey => {
        let splitExpressions = boToSplitExpressionMap[ boKey ];
        let subExpressions = getSubExpressions( selectionMap, splitExpressions, true );

        let pcaExpression = {
            formula: '',
            exprID: '',
            expressionType: -1,
            configExpressionSet: [ {
                configExpressionSections: [ {
                    // Constraints Subject Expression/Variant Expression
                    formula: '',
                    expressionType: isConstraintsGrid ? pca0Constants.EXPRESSION_TYPES.SUBJECT_EXPRESSION : pca0Constants.EXPRESSION_TYPES.VARIANT_EXPRESSION,
                    subExpressions: subExpressions
                } ]
            } ]
        };

        // Constraints Condition Expression
        if ( conditionSelectionMap ) {
            let conditionSubExpressions = getSubExpressions( conditionSelectionMap, splitExpressions, true );
            let conditionExpression = {
                formula: '',
                expressionType: pca0Constants.EXPRESSION_TYPES.CONDITION_EXPRESSION,
                subExpressions: conditionSubExpressions
            };

            // Use _.get to retrieve the array, push the new item, and then use _.set to update it
            let configExpressionSections = _.get( pcaExpression, 'configExpressionSet[0].configExpressionSections', [] );
            configExpressionSections.push( conditionExpression );
            _.set( pcaExpression, 'configExpressionSet[0].configExpressionSections', configExpressionSections );
        }

        let pcaExpressionList = [];
        pcaExpressionList.push( pcaExpression );

        pcaGrid[ boKey ] = pcaExpressionList;
    } );

    return pcaGrid;
};

/**
 * Returns PCA Grid from variant formula - suitable for SOA input
 * @param {String} formula - variant formula to save
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @returns {Object} PCA Grid
 */
export let getPCAGridFromFormula = function( formula, contextKey ) {
    var selectedObject = { ...appCtxSvc.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
    let pcaGrid = {};

    let pcaSubExpressions = [];
    let pcaExpression = {
        formula: formula,
        exprID: '',
        expressionType: pca0Constants.EXPRESSION_TYPES.VARIANT_CONDITION,
        configExpressionSet: [ {
            configExpressionSections: [ {
                formula: '',
                expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
                subExpressions: pcaSubExpressions
            } ]
        } ]
    };

    let pcaExpressionList = [];
    pcaExpressionList.push( pcaExpression );

    pcaGrid[ selectedObject.uid ] = pcaExpressionList;

    return pcaGrid;
};

/**
 * Get PCA Grid from current selection map for given Business Object (column)
 * Suitable for Validation SOA input
 * @param {String} businessObjectId - id for column being validated
 * @param {Object} businessObjectToSelectionMap - selection map
 * @returns {Object} PCA Grid
 */
export let getColumnValidationPCAGrid = function( businessObjectId, businessObjectToSelectionMap ) {
    let pcaGrid = {};
    let pcaSubExpressions = getSubExpressions( businessObjectToSelectionMap, [ businessObjectId ] );
    let pcaExpression = {
        formula: '',
        exprID: '',
        expressionType: pca0Constants.EXPRESSION_TYPES.VARIANT_CONDITION,
        configExpressionSet: [ {
            configExpressionSections: [ {
                formula: '',
                expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
                subExpressions: pcaSubExpressions
            } ]
        } ]
    };
    let pcaExpressionList = [];
    pcaExpressionList.push( pcaExpression );
    pcaGrid[ businessObjectId ] = pcaExpressionList;
    return pcaGrid;
};

/**
 * Get PCA Grid from current selection map for given Business Object (column)
 * Suitable for Validation SOA input
 * Send individual expressions instead of bulk subExpressions in case of split columns
 * @param {Object} businessObjectToSelectionMap - selection map
 * @returns {Object} PCA Grid
 */
export let getValidationPCAGrid = function( businessObjectToSelectionMap ) {
    let pcaGrid = {};
    let boIDs = Object.keys( businessObjectToSelectionMap );
    _.forEach( boIDs, boID => {
        let pcaSubExpressions = getSubExpressions( businessObjectToSelectionMap, [ boID ] );
        let pcaExpression = {
            formula: '',
            exprID: '',
            expressionType: pca0Constants.EXPRESSION_TYPES.VARIANT_CONDITION,
            configExpressionSet: [ {
                configExpressionSections: [ {
                    formula: '',
                    expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
                    subExpressions: pcaSubExpressions
                } ]
            } ]
        };

        let pcaExpressionList = [];
        pcaExpressionList.push( pcaExpression );

        pcaGrid[ boID ] = pcaExpressionList;
    } );

    return pcaGrid;
};

/**
 * This API will set formula as empty on selected expression from client
 * @param {String} contextKey - context Key
 */
export let clearSelectedExpressionFormula = function( contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    if( context && context.selectedExpressions && !_.isEmpty( context.selectedExpressions ) ) {
        //get  selected expressions
        let [ selectedExprValue ] = Object.values( context.selectedExpressions );
        let selectedExpr = selectedExprValue;
        if( !_.isEmpty( selectedExpr[ 0 ] ) && selectedExpr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ] ) {
            let selectedexpressionType = selectedExpr[ 0 ].expressionType;
            let configExpressionSectionsType = selectedExpr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ].expressionType;
            let subExpr = selectedExpr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ].subExpressions;
            let configExpressionSectionsObj = {
                expressionType: configExpressionSectionsType,
                formula: '',
                subExpressions: subExpr
            };
            let selectedExprArr = [ {
                formula: '',
                exprID: '',
                expressionType: selectedexpressionType,
                configExpressionSet: [ {
                    configExpressionSections: [ configExpressionSectionsObj ]
                } ]
            } ];
            selectedExpr = selectedExprArr;
        }

        for( const key in context.selectedExpressions ) {
            if( context.selectedExpressions.hasOwnProperty( key ) ) {
                context.selectedExpressions[ key ] = selectedExpr;
                break;
            }
        }
        appCtxSvc.updateCtx( contextKey, context );
    }
};

/**
 * TThis API get config expression map from selected expressions
 * @param {Object} selectedExpr - grid selected expressions
 * @returns {Object} Expression map
 */
export let getConfigExpressionMap = function( selectedExpr ) {
    let selectedExprArr;
    let configExprMap = {};
    if( selectedExpr ) {
        for( const key in selectedExpr ) {
            if( selectedExpr.hasOwnProperty( key ) ) {
                selectedExprArr = selectedExpr[ key ];
                break;
            }
        }
    } else {
        return configExprMap;
    }
    if( selectedExprArr && !_.isEmpty( selectedExprArr[ 0 ] ) && selectedExprArr[ 0 ].configExpressionSet[ 0 ] && selectedExprArr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ] ) {
        configExprMap = selectedExprArr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ].subExpressions[ 0 ].expressionGroups;
    } else {
        //set empty config Expr Map
        let emptyConfigExprSectionObj = {
            expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
            formula: '',
            subExpressions: [ { expressionGroups: {} } ]
        };
        let selectedExprArr2 = [ {
            formula: '',
            exprID: '',
            expressionType: pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
            configExpressionSet: [ {
                configExpressionSections: [ emptyConfigExprSectionObj ]
            } ]
        } ];
        selectedExprArr = selectedExprArr2;
        for( const key in selectedExpr ) {
            if( selectedExpr.hasOwnProperty( key ) ) {
                selectedExpr[ key ] = selectedExprArr;
                break;
            }
        }
    }
    return configExprMap;
};

/**
 * Remove None/Zero (selectionState: 0) selections from the selection map
 * @param {Object} businessObjectToSelectionMap - selection Map
 */
export let removeZeroSelections = function( businessObjectToSelectionMap ) {
    let selectionMap = businessObjectToSelectionMap;
    let boKeys = Object.keys( selectionMap );
    _.forEach( boKeys, boKey => {
        let selections = selectionMap[ boKey ];
        let selectionKeys = Object.keys( selections );
        _.forEach( selectionKeys, selectionKey => {
            let selection = selections[ selectionKey ];
            if( selection.selectionState === 0 ) {
                delete selections[ selectionKey ];
            }
        } );
    } );
};

/**
 * Remove Copied selections from split action
 * @param {Array} columnProperties list of Column Properties
 * @param {Object} subjectSelectionMap 'Subject' selectionMap
 * @param {Object} conditionSelectionMap 'Condition' selectionMap
 */
export let removeCopiedSplitSelections = function( columnProperties, subjectSelectionMap, conditionSelectionMap ) {
    let selectionKeys = Object.keys( subjectSelectionMap ); // subject/condition doesn't matter: both contain all keys
    _.forEach( selectionKeys, selectionKey => {
        let columnProps = _.find( columnProperties, {
            propertyUid: selectionKey
        } );
        if( columnProps.isSplitColumn ) {
            // Subject
            if( !columnProps.isSplitSubject ) {
                subjectSelectionMap[ selectionKey ] = {};
            }

            // Condition
            if( columnProps.isSplitSubject ) {
                conditionSelectionMap[ selectionKey ] = {};
            }
        }
    } );
};

/*
 * Validate if Selection grid is empty
 * Note: empty Variant expression can come:
 * - either as empty selectedExpressions for that element OR
 * - as empty configExpressionSections arrary []

 * @param {Object} selectedExpressions grid expression map
 * @returns {Boolean} true/false if selection grid is empty
 */
export let expressionMapContainsNoUserSelection = function( selectedExpressions ) {
    if( _.isUndefined( selectedExpressions ) ) {
        return true;
    }
    var gridWithoutUserSelection = true;
    let elemKeys = Object.keys( selectedExpressions );
    _.forEach( elemKeys, elemKey => {
        let businessObjects = selectedExpressions[ elemKey ];

        if( businessObjects.length !== 0 &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet ) &&
            !_.isUndefined( businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections ) &&
            businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections.length !== 0 ) {
            _.forEach( businessObjects[ 0 ].configExpressionSet[ 0 ].configExpressionSections, exprSection => {
                if( !_.isUndefined( exprSection.subExpressions ) && Object.keys( exprSection.subExpressions ).length !== 0 ) {
                    _.forEach( exprSection.subExpressions, subExpression => {
                        if( !_.isUndefined( subExpression.expressionGroups ) && Object.keys( subExpression.expressionGroups ).length !== 0 ) {
                            let configExpressionKey = Object.keys( subExpression.expressionGroups );
                            _.forEach( configExpressionKey, newElemKey => {
                                let configExpressionValue = subExpression.expressionGroups[ newElemKey ];
                                for( var i = 0; i < configExpressionValue.length; i++ ) {
                                    if( configExpressionValue[ i ].selectionState === 1 || configExpressionValue[ i ].selectionState === 2 ) {
                                        gridWithoutUserSelection = false;
                                        break;
                                    }
                                }
                            } );
                        }
                    } );
                }
            } );
        }
    } );
    return gridWithoutUserSelection;
};

/**
 * Evaluate if input expression map contains split expressions.
 * @param {Object} selectedExpressions the cached SOA response containing expressions information
 * @return {Boolean} True if expression map contains split expressions
 */
export let selectedExpressionsContainSplitExpressions = function( selectedExpressions ) {
    var containsSplitExpressions = false;
    let boKeys = Object.keys( selectedExpressions );
    _.forEach( boKeys, boKey => {
        let businessObjects = selectedExpressions[ boKey ];
        let businessObject = businessObjects[ 0 ];
        let subExpressions = _.get( businessObject, 'configExpressionSet[0].configExpressionSections[0].subExpressions' );

        if( subExpressions && subExpressions.length > 1 ) {
            containsSplitExpressions = true;
            return false;
        }
    } );
    return containsSplitExpressions;
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
 * @param {String} formula - selected expression json object
 * @param {String} contextKey - Name of context.
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertGridFromFormulaToJsonString = function( formula, contextKey ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( getPCAGridFromFormula( formula, contextKey ) );
};

export default exports = {
    getBusinessObjectToSplitExpressionMap,
    getSubExpressions,
    getPCAGridFromSelectionMap,
    getPCAGridWithMultiGridFromSelectionMap,
    getColumnValidationPCAGrid,
    getValidationPCAGrid,
    clearSelectedExpressionFormula,
    getConfigExpressionMap,
    getPCAGridFromFormula,
    removeZeroSelections,
    removeCopiedSplitSelections,
    expressionMapContainsNoUserSelection,
    selectedExpressionsContainSplitExpressions,
    convertGridFromFormulaToJsonString
};
