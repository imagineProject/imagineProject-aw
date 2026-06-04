/* eslint-disable complexity */

// Copyright (c) 2023 Siemens

/**
 * This module contain methods to author variant conditions in
 * Formula suggester.
 *
 * It gives ability to edit display formula.
 * Internal formula will be created programmatically on client itself until server is ready for the display to internal formula conversion.
 *
 * @module js/pca0FormulaSuggesterService
 */

import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

const TYPE_FAMILY = 'Family';
const TYPE_FEATURE = 'Feature';
const TYPE_OPERATOR = 'Operator';
const tokenConstants = {
    comparisonOperator: 'comparisonOperator',
    logicalOperator: 'logicalOperator',
    roundBracket: 'roundBracket',
    familyNameSpace: 'familyNameSpace',
    localizedComparisonOperator: 'localizedComparisonOperator',
    localizedLogicalOperator: 'localizedLogicalOperator',
    familyName: 'familyName',
    featureName: 'featureName'
};
const INTERNAL_FORMULA_VISIBLE_CLASS = 'aw-cfg-suggesterInternalFormulaVisible';

let suggesterPreferences;

/**
 * Show warning message if multiple families/features are found with same name/ID to set preference, to remove ambiguity.
 * @param {String} ambiguousDataType - Type of data which is ambiguous Family/Feature
 */
const _showAmbiguousDataWarningMessage = ambiguousDataType => {
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
    const warningMessage = ambiguousDataType === TYPE_FAMILY ? localeTextBundle.ambiguousFamilyDataWarningMessage : localeTextBundle.ambiguousFeatureDataWarningMessage;
    messagingService.showWarning( warningMessage );
    throw new Error( "Ambiguous data found" );
};

/**
 * Takes a string and returns a new string where all special characters that have meaning in regular expressions are escaped with a backslash.
 * @param {String} string input string
 * @returns {String} String
 */
const _escapeRegExp = string => {
    return string.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
};

/**
 * Test given string, whether it is open parenthesis "(" or a close parenthesis ")".
 * E.g.
 * 1. inputStr='(' returns true .
 * 2. inputStr='\'(abc)\'' returns false .
 * @param {String} inputStr - Any string.
 * @returns {Boolean} true if input string is bracket else false.
 */
const _isBracket = inputStr => /^(\(|\))$/.test( inputStr );

/**
 * Test given string whether it is operator.
 * E.g.
 * 1. inputStr='AND' returns true .
 * 2. inputStr='\'(AND)\'' returns false .
 * @param {String} inputStr - Any string.
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Boolean} true if input string is operator else false.
 */
const _isOperator = ( inputStr, displayStrings ) => {
    const staticOperators = [ '=', '!=', '!', '>', '>=', '<', '<=', '&', '|' ];
    const localizedOperators = [
        displayStrings.k_variant_op_is_equal,
        displayStrings.k_variant_op_not_equal,
        displayStrings.k_variant_op_gt,
        displayStrings.k_variant_op_lt,
        displayStrings.k_variant_op_gt_eq,
        displayStrings.k_variant_op_lt_eq,
        displayStrings.k_variant_op_not,
        displayStrings.k_variant_op_and,
        displayStrings.k_variant_op_or
    ];

    // Check if inputStr is in the list of staticOperators or localizedOperators
    return staticOperators.includes( inputStr ) || localizedOperators.includes( inputStr );
};

/**
 * Test given string whether it is comparison operator.
 * E.g.
 * 1. inputStr='=' returns true .
 * 2. inputStr='\'(abc=def)\'' returns false .
 * @param {String} inputStr - Any string.
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Boolean} true if input string is comparison operator else false.
 */
const _isComparisonOperator = ( inputStr, displayStrings ) => {
    const staticOperators = [ '=', '!=', '!', '>', '>=', '<', '<=' ];
    const localizedOperators = [ displayStrings.k_variant_op_is_equal,
        displayStrings.k_variant_op_not_equal,
        displayStrings.k_variant_op_gt,
        displayStrings.k_variant_op_lt,
        displayStrings.k_variant_op_gt_eq,
        displayStrings.k_variant_op_lt_eq
    ];

    // Check if inputStr is in the list of staticOperators or localizedOperators
    return staticOperators.includes( inputStr ) || localizedOperators.includes( inputStr );
};

/**
 * Test given string whether it starts and ends with square bracket i.e. familyNamespace.
 * E.g.
 * 1. inputStr='[familyNamespace]' returns true .
 * 2. inputStr='familyNamespace' returns false .
 * @param {String} inputStr - Any string.
 * @returns {Boolean} true if input string is comparison operator else false.
 */
const _isFamilyNamespace = inputStr => /^\[[^[\]]*\]$/.test( inputStr );

/**
 * Tests given string whether it contains special characters (internal values of operators used in variant formula, parenthesis or space) but not enclosed in single quotes.
 * Encloses it in single quote for specially configured display strings or if it contains special characters.
 * E.g.
 * 1. inputString='anyString' returns 'anyString'.
 * 2. inputString='anyANDString' returns '\'anyANDString\'' if AND is specially configured display strings.
 * 3. inputString='\'anyANDString\'' returns '\'anyANDString\''.
 * 4. inputString='any&Str(Abc<' returns '\'any&Str(Abc<\''.
 * @param {String} inputString - Any string
 * @param {RegExp} displayValuesRegExp - Regular expression created with all specially configured display strings
 * @returns {String} String enclosed in single quotes if it contains special characters or matches display values
 */
const _addEscapePatternIfSpecialCharsAndDisplayStrings = ( inputString, displayValuesRegExp ) => {
    if( !/^'[^']*'$/.test( inputString ) && ( /(=|!|>|<|&|\||\[|\]|\(|\))/.test( inputString ) || displayValuesRegExp.test( inputString ) || /\s/.test( inputString ) ) ) {
        return '\'' + inputString + '\'';
    }
    return inputString;
};

/**
 * Split given string with logical operators ('AND','&','OR','|') as separators, while treating strings enclosed in single quotes (e.g.'\'a_AND_b\'') or in square brackets(e.g.'[abc&def]') as one string.
 * @param {String} inputString - Any string.
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Array} Array of splitted strings.
 */
const _splitStringAtLogicalOperators = ( inputString, displayStrings ) => {
    const splittedStrings = [];
    let currentString = '';
    let withinSingleQuotes = false;
    let withinSquareBrackets = false;

    for( let i = 0; i < inputString.length; i++ ) {
        const inputChar = inputString[ i ];

        if( ( inputChar === '(' || inputChar === ')' ) && !withinSingleQuotes && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            splittedStrings.push( currentString );
            splittedStrings.push( inputChar );
            currentString = '';
            continue;
        }

        if( inputChar === '\'' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            withinSingleQuotes = !withinSingleQuotes;
        }

        if( inputChar === '[' && !withinSingleQuotes && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            splittedStrings.push( currentString );
            currentString = inputChar;
            withinSquareBrackets = true;
            continue;
        } else if( inputChar === ']' && withinSquareBrackets && !withinSingleQuotes && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            withinSquareBrackets = false;
            currentString += inputChar;
            splittedStrings.push( currentString );
            currentString = '';
            continue;
        }

        if( !withinSingleQuotes && !withinSquareBrackets && ( inputString.substr( i, displayStrings.k_variant_op_and.length ) === displayStrings.k_variant_op_and || inputString.substr( i, displayStrings
            .k_variant_op_or.length ) === displayStrings.k_variant_op_or || inputChar === '&' || inputChar === '|' ) ) {
            if( inputString.substr( i, displayStrings.k_variant_op_and.length ) === displayStrings.k_variant_op_and ) {
                splittedStrings.push( currentString );
                splittedStrings.push( displayStrings.k_variant_op_and );
                i += displayStrings.k_variant_op_and.length - 1;
                currentString = '';
            } else if( inputString.substr( i, displayStrings.k_variant_op_or.length ) === displayStrings.k_variant_op_or ) {
                splittedStrings.push( currentString );
                splittedStrings.push( displayStrings.k_variant_op_or );
                i += displayStrings.k_variant_op_or.length - 1;
                currentString = '';
            } else if( ( inputChar === '&' || inputChar === '|' ) && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
                splittedStrings.push( currentString );
                splittedStrings.push( inputChar );
                currentString = '';
            } else {
                currentString += inputChar;
            }
        } else {
            currentString += inputChar;
        }
    }

    if( currentString !== '' ) {
        splittedStrings.push( currentString );
    }

    return splittedStrings;
};

/**
 * Split given string with comparison operators ('=','!=','>','<','>=','<=','NOT') as separators,
 * While treating strings enclosed in single quotes (e.g.'\'a>b\'') or in square brackets(e.g.'[abc>def]') as one string.
 * @param {String} inputString - Any string.
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Array} Array of splitted strings.
 */
const _splitStringAtComparisonOperators = ( inputString, displayStrings ) => {
    const splittedStrings = [];
    let currentString = '';
    let withinSingleQuotes = false;
    let withinSquareBrackets = false;

    for( let i = 0; i < inputString.length; i++ ) {
        const inputChar = inputString[ i ];

        if( inputChar === '\'' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            withinSingleQuotes = !withinSingleQuotes;
        }

        if( inputChar === '[' && !withinSingleQuotes && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            withinSquareBrackets = true;
        } else if( inputChar === ']' && withinSquareBrackets && !withinSingleQuotes && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
            withinSquareBrackets = false;
        }

        if( !withinSingleQuotes && !withinSquareBrackets ) {
            if( inputChar === '=' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
                splittedStrings.push( currentString );
                splittedStrings.push( '=' );
                currentString = '';
            } else if( inputChar === '!' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
                if( inputString[ i + 1 ] === '=' ) {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '!=' );
                    i += 1;
                } else {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '!' );
                }
                currentString = '';
            } else if( inputChar === '>' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
                if( inputString[ i + 1 ] === '=' ) {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '>=' );
                    i += 1;
                } else {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '>' );
                }
                currentString = '';
            } else if( inputChar === '<' && ( i === 0 || inputString[ i - 1 ] !== '\\' ) ) {
                if( inputString[ i + 1 ] === '=' ) {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '<=' );
                    i += 1;
                } else {
                    splittedStrings.push( currentString );
                    splittedStrings.push( '<' );
                }
                currentString = '';
            } else if( inputString.substr( i, displayStrings.k_variant_op_not.length ) === displayStrings.k_variant_op_not ) {
                splittedStrings.push( currentString );
                splittedStrings.push( displayStrings.k_variant_op_not );
                i += displayStrings.k_variant_op_not.length - 1;
                currentString = '';
            } else {
                currentString += inputChar;
            }
        } else {
            currentString += inputChar;
        }
    }

    if( currentString !== '' ) {
        splittedStrings.push( currentString );
    }

    return splittedStrings;
};

/**
 * Split editor string first at logical operators and then each string at logical operators.
 * @param {String} editorString - Editor string
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @param {Boolean} updateSuggestions - true if editor string needs to split for updating suggestions
 * @param {Boolean} updateInternalFormula - true if editor string needs to split for updating variant formula with familyNamespaces
 * @returns {Array} Array of strings splitted into families, features, operators, familyNamespaces and brackets
 */
const _splitEditorString = (editorString, displayStrings, updateSuggestions, updateInternalFormula) => {
    let splittedStringsArrayLength = updateSuggestions ? 6 : editorString.length;
    let splittedStringsArr = [];

    if (editorString !== '') {
        // First split editor string at logical operators
        let logicalOperatorsSplittedStrings = _splitStringAtLogicalOperators(editorString, displayStrings);

        for (let logicalStrIdx = logicalOperatorsSplittedStrings.length - 1; logicalStrIdx >= 0 && splittedStringsArr.length < splittedStringsArrayLength; logicalStrIdx--) {
            let logicalString = logicalOperatorsSplittedStrings[logicalStrIdx];
            if (logicalString === '') {
                splittedStringsArr.unshift('');
            } else {
                let comparisonOperatorsSplittedStrings = _splitStringAtComparisonOperators(logicalString, displayStrings);
                for (let comparisonIndex = comparisonOperatorsSplittedStrings.length - 1; comparisonIndex >= 0 && splittedStringsArr.length < splittedStringsArrayLength; comparisonIndex--) {
                    let comparisonString = comparisonOperatorsSplittedStrings[comparisonIndex];
                    if (_isBracket(comparisonString)) {
                        // Add brackets as well in splitted strings array if splitting string to update internal formula
                        // We can ignore brackets while updating suggestions
                        if (updateInternalFormula) {
                            splittedStringsArr.unshift(comparisonString);
                        }
                    } else {
                        splittedStringsArr.unshift(comparisonString);
                    }
                }
            }
        }
    }

    return splittedStringsArr;
};

/**
 * Collect all family VMO only.
 * This method is only used for getVariability3 SOA response with '"requestType": [ "{\"requestType\":[\"Group\",\"Model\",\"Unassigned\"],\"viewType\":5}" ]' input.
 * Enclose displayName and cfg0ObjectId of family if it contains specially configured display values.
 * @param {Object} viewModelObjectMap - VMO map from getVariability3 SOA response
 * @param {RegExp} displayValuesRegExp - Regular expression created with all specially configured display strings
 * @returns {Array} Array of family vmo with processed displayName and cfg0ObjectId
 */
const _getFamilyNodes = ( viewModelObjectMap, displayValuesRegExp ) => {
    let familyNodes = [];
    for( const vmo in viewModelObjectMap ) {
        if( _.get( viewModelObjectMap[ vmo ], 'props.variantType[0]' ) === TYPE_FAMILY ) {
            familyNodes.push( viewModelObjectMap[ vmo ] );
        }
    }
    if( familyNodes.length > 0 ) {
        familyNodes.forEach( familyObj => {
            //Family name and id check for whitespace characters or special chars ( e.g. |,&,!,=,>,<,\s,'AND','OR','NOT') and add escape pattern for these
            familyObj.props.cfg0ObjectId[ 0 ] = _addEscapePatternIfSpecialCharsAndDisplayStrings( familyObj.props.cfg0ObjectId[ 0 ], displayValuesRegExp );
            familyObj.displayName = _addEscapePatternIfSpecialCharsAndDisplayStrings( familyObj.displayName, displayValuesRegExp );
            familyObj.type = TYPE_FAMILY;
        } );
    }
    return familyNodes;
};

/**
 * Collect all feature VMO for family uid as parent only.
 * Enclose displayName and cfg0ObjectId of feature if it contains specially configured display values.
 * @param {Array} featureUidArr - Array of feature uid's
 * @param {Object} viewModelObjectMap - VMO map from getVariability3 SOA response
 * @param {String} parentUid - Family UID
 * @param {RegExp} displayValuesRegExp - Regular expression created with all specially configured display strings
 * @param {String} familyNamespace - Family name space
 * @param {String} unitOfMeasure - Unit of measure
 * @returns {Array} Array of feature vmo with processed displayName and cfg0ObjectId
 */
const _getFeatureNodes = ( featureUidArr, viewModelObjectMap, parentUid, displayValuesRegExp, familyNamespace, unitOfMeasure ) => {
    let featureNodes = [];
    featureUidArr.forEach( element => {
        let featureObj = _.filter( viewModelObjectMap, { sourceUid: element } )[ 0 ];
        if( featureObj ) {
            //Feature name and id check for whitespace characters or special chars ( e.g. |,&,!,=,>,<,\s,'AND','OR','NOT') and add escape pattern for these
            featureObj.props.cfg0ObjectId[ 0 ] = _addEscapePatternIfSpecialCharsAndDisplayStrings( featureObj.props.cfg0ObjectId[ 0 ], displayValuesRegExp );
            featureObj.displayName = _addEscapePatternIfSpecialCharsAndDisplayStrings( featureObj.displayName, displayValuesRegExp );
            featureObj.type = TYPE_FEATURE;
            featureObj.parentUid = parentUid;

            // Add namespace in feature vmo props to show family namespace in feature suggestions which can be written without family in display formula
            if( familyNamespace ) {
                featureObj.props.cfg0FamilyNamespace = [ familyNamespace ];
            }
            // If familyValueDataType is Integer or Floating Point then add unit of measure in feature vmo props to show it in feature suggestions
            if( unitOfMeasure ) {
                featureObj.props.cfg0UOM = [ unitOfMeasure ];
            }

            featureNodes.push( featureObj );
        }
    } );
    return featureNodes;
};

/**
 * Get family match from cachedVariability data based on family displayName
 * @param {Array} familyNodes -Array of family vmo objects containing display names
 * @param {String} familyName - Family display name
 * @param {Boolean} isFormulaWithName - True if formula contains names else false
 * @param {String} familyUid - Family uid
 * @param {String} familyNamespace - Family namespace
 * @returns {Object} Family object if match found else false(boolean)
 */
const _getFamilyMatch = ( familyNodes, familyName, isFormulaWithName, familyUid, familyNamespace ) => {
    if( familyNodes.length > 0 ) {
        if( familyUid ) {
            return familyNodes.find( ( { sourceUid } ) => sourceUid === familyUid );
        }else if( familyNamespace ) {
            return isFormulaWithName ? familyNodes.find( ( { displayName, props } ) => displayName === familyName && props.cfg0FamilyNamespace[0] === familyNamespace )
                                     : familyNodes.find( ( { props} ) => props.cfg0ObjectId[ 0 ] === familyName && props.cfg0FamilyNamespace[0] === familyNamespace );
        }
        let familyMatch = isFormulaWithName ? familyNodes.filter( ( { displayName } ) => displayName === familyName ) : familyNodes.filter( ( { props } ) => props.cfg0ObjectId[ 0 ] === familyName );
        if( familyMatch.length > 0 ) {
            if( familyMatch.length >1 && suggesterPreferences.TC_show_family_namespace_prefix === 'false') {
                // Show warning message if multiple families are found with same name/ID and 'TC_show_family_namespace_prefix' preference is not set, to remove ambiguity.
                _showAmbiguousDataWarningMessage( TYPE_FAMILY );
            }else{
                return familyMatch[ 0 ];
            }
        }
        return;
    }
    return false;
};

/**
 * Get feature match from cachedVariability data based on feature displayName
 * @param {Array} featureNodes -Array of feature vmo objects containing display names
 * @param {String} featureString - Feature display name or Id
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @param {Boolean} isFormulaWithName - True if formula contains display names else false
 * @param {Array} featureUid - Array of Feature uid
 * @param {String} familyNamespace - Family namespace
 * @returns {Object} Feature object if match found else false(boolean) or boolean true if feature name is one of the specially configured feature names ('Any','None','true','false')
 */
const _getFeatureMatch = (featureNodes, featureString, displayStrings, isFormulaWithName, featureUid, familyNamespace) => {
    if (featureNodes.length > 0) {
        if (featureString === displayStrings.k_variant_optional_family_any_value || featureString === displayStrings.k_variant_optional_family_none_value ||
            featureString === displayStrings.k_true || featureString === displayStrings.k_false) {
            return true;
        } else if (featureUid && featureUid.length > 0) {
            if (featureString || featureString === '') {
                if (isFormulaWithName) {
                    return featureNodes.find(({ sourceUid, displayName, props }) => featureUid.includes(sourceUid) && displayName === featureString || ( props.cfg0UOM && `${displayName}${props.cfg0UOM[0]}` === featureString ));
                }
                return featureNodes.find(({ sourceUid, props }) => featureUid.includes(sourceUid) && props.cfg0ObjectId[0] === featureString || ( props.cfg0UOM && `${props.cfg0ObjectId[0]}${props.cfg0UOM[0]}` === featureString ));
            }
            return featureNodes.find(({ sourceUid }) => featureUid.includes(sourceUid));
        }else{
            let featureMatch = [];
            if (familyNamespace) {
                featureMatch = isFormulaWithName? featureNodes.filter(({ displayName, props }) => props.cfg0FamilyNamespace && props.cfg0FamilyNamespace[0] === familyNamespace && ( displayName === featureString || ( props.cfg0UOM && `${displayName}${props.cfg0UOM[0]}` === featureString )))
                               :featureNodes.filter(({ props }) => props.cfg0FamilyNamespace && props.cfg0FamilyNamespace[0] === familyNamespace && ( props.cfg0ObjectId[0] === featureString || ( props.cfg0UOM && `${props.cfg0ObjectId[0]}${props.cfg0UOM[0]}` === featureString )));
            }else{
                featureMatch = isFormulaWithName? featureNodes.filter(({ displayName, props }) => displayName === featureString || ( props.cfg0UOM && `${displayName}${props.cfg0UOM[0]}` === featureString ))
                               : featureNodes.filter(({ props }) => props.cfg0ObjectId[0] === featureString || ( props.cfg0UOM && `${props.cfg0ObjectId[0]}${props.cfg0UOM[0]}` === featureString ));
            }
            if( featureMatch.length > 0 ) {
                if( featureMatch.length >1 && suggesterPreferences.TC_show_option_family_prefix === 'false') {
                    // Show warning message if multiple features are found with same name/ID and 'TC_show_option_family_prefix' preference is not set, to remove ambiguity.
                    _showAmbiguousDataWarningMessage( TYPE_FEATURE );
                }else{
                    return featureMatch[ 0 ];
                }
            }
            return;
        }
    }
    return false;
};

/**
 * Suggest comparison operator based on cfg0ValueDataType of family
 * @param {Object} familyMatch - Selected family vmo object based on family name in editor
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Array} Array of comparison operators
 */
const _getComparisonOperatorSuggestions = ( familyMatch, displayStrings ) => {
    //Show operator suggestions based on familyValueDataType of selected family
    let familyValueDataType = familyMatch.props.cfg0ValueDataType[ 0 ];

    if( familyValueDataType === 'String' ) {
        return [ { displayName: displayStrings.k_variant_op_is_equal, type: TYPE_OPERATOR }, { displayName: displayStrings.k_variant_op_not_equal, type: TYPE_OPERATOR } ]; // String family
    } else if( familyValueDataType === 'Boolean' ) { return [ { displayName: displayStrings.k_variant_op_is_equal, type: TYPE_OPERATOR } ]; } // Boolean family
    //Integer or floatingPoint
    //Show all operators
    return [ { displayName: displayStrings.k_variant_op_is_equal, type: TYPE_OPERATOR },
        { displayName: displayStrings.k_variant_op_not_equal, type: TYPE_OPERATOR },
        { displayName: displayStrings.k_variant_op_gt, type: TYPE_OPERATOR },
        { displayName: displayStrings.k_variant_op_lt, type: TYPE_OPERATOR },
        { displayName: displayStrings.k_variant_op_gt_eq, type: TYPE_OPERATOR },
        { displayName: displayStrings.k_variant_op_lt_eq, type: TYPE_OPERATOR }
    ];
};

/**
 * Suggest features based on family and operator selected.
 * @param {Object}variabilityData - Cached variability data
 * @param {Object} familySelected -Selected family vmo object based on family name in editor
 * @param {String} operatorUsed - Operator selected after family
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @returns {Array} Array of feature objects
 */
const _getFeatureSuggestions = ( variabilityData, familySelected, operatorUsed, displayStrings ) => {
    if( familySelected && familySelected.props && familySelected.childrenUids ) {
        // If boolean family selected then show true/false as features
        if( familySelected.props.cfg0ValueDataType[ 0 ] === 'Boolean' ) {
            return [ { displayName: displayStrings.k_true, type: TYPE_FEATURE }, { displayName: displayStrings.k_false, type: TYPE_FEATURE } ];
        }

        let featureSuggestions = [];
        familySelected.childrenUids.forEach( childrenUid => {
            featureSuggestions.push( _getFeatureMatch( variabilityData.featureNodes, undefined, displayStrings, undefined, [childrenUid] ) );
        } );

        // Suggest Any,None as features for optional families only
        if( operatorUsed === displayStrings.k_variant_op_is_equal && _.get( familySelected, 'props.cfg0IsDiscretionary[0]' ) === 'true' ) {
            featureSuggestions.unshift( { displayName: displayStrings.k_variant_optional_family_none_value, type: TYPE_FEATURE } );
            featureSuggestions.unshift( { displayName: displayStrings.k_variant_optional_family_any_value, type: TYPE_FEATURE } );
        }

        return featureSuggestions;
    }
    return [];
};

/**
 * Get suggestions to update suggestions in suggest widget as editor content changes.
 * @param {String} editorString - Editor string
 * @param {Object} variabilityData - Object of cached variability data
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @param {Object} preference - Object containing TC preference values for TC_show_option_family_prefix and TC_show_family_namespace_prefix
 * @param {Boolean} isFormulaWithName - True if formula contains names else false
 * @returns {Array} Array of suggestions
 */
const _getSuggestions = ( editorString, variabilityData, displayStrings, preference, isFormulaWithName ) => {
    try{
        //Split editor string into family, features and operators
        const splittedStringsArr = _splitEditorString( editorString, displayStrings, true ).map( str => str.trim() ).filter( element => { return element; } );
        let currentString = {};
        currentString.value = splittedStringsArr.length > 0 ? splittedStringsArr[ splittedStringsArr.length - 1 ] : '';
        currentString.isOperator = _isOperator( currentString.value, displayStrings );
        currentString.isComparisonOperator = _isComparisonOperator( currentString.value, displayStrings );
        let familyNamespace = splittedStringsArr.length > 1 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 2 ] ) ?
                            splittedStringsArr[ splittedStringsArr.length - 2 ].slice(1, -1) : undefined;
        currentString.familyObj = _getFamilyMatch( variabilityData.familyNodes, currentString.value, isFormulaWithName, undefined,familyNamespace );
        currentString.featureObj = _getFeatureMatch( variabilityData.featureNodes, currentString.value, displayStrings, isFormulaWithName );

        let previousString = {};
        previousString.value = splittedStringsArr.length > 1 ? splittedStringsArr[ splittedStringsArr.length - 2 ] : '';
        previousString.isOperator = _isOperator( previousString.value, displayStrings );
        previousString.isComparisonOperator = _isComparisonOperator( previousString.value, displayStrings );
        familyNamespace = splittedStringsArr.length > 1 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 3 ] ) ?
                        splittedStringsArr[ splittedStringsArr.length - 3 ].slice(1, -1) : undefined;
        previousString.familyObj = _getFamilyMatch( variabilityData.familyNodes, previousString.value, isFormulaWithName, undefined, familyNamespace );
        previousString.featureObj = _getFeatureMatch( variabilityData.featureNodes, previousString, displayStrings, isFormulaWithName );

        //If 'TC_show_option_family_prefix' is set to 'true' then user must write formula with families i.e familyName = featureName
        if( preference.TC_show_option_family_prefix === 'true' ) {
            // If family string is complete suggest comparison operators
            if( ( currentString.familyObj || previousString.familyObj ) && !currentString.isOperator ) {
                if( currentString.familyObj ) {
                    return _getComparisonOperatorSuggestions( currentString.familyObj, displayStrings );
                }
                //Incomplete Comparison operator in editor case
                return _getComparisonOperatorSuggestions( previousString.familyObj, displayStrings );
            }

            // If feature string completed suggest logical operators(or logical operator is incomplete).
            if( ( currentString.featureObj || previousString.featureObj ) && !currentString.isOperator ) {
                return [ { displayName: displayStrings.k_variant_op_and, type: TYPE_OPERATOR }, { displayName: displayStrings.k_variant_op_or, type: TYPE_OPERATOR } ];
            } else if( splittedStringsArr.length > 1 ) {
                //If authoring condition for free form family then suggestion appears as soon as we enter space after any string as feature as we don't have features to show.
                //Need to have clear thought on free form family feature suggestions
                familyNamespace = splittedStringsArr.length > 3 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 4 ] ) ?
                                splittedStringsArr[ splittedStringsArr.length - 3 ].slice(1, -1) : undefined;
                let freeFormFamObj = _getFamilyMatch( variabilityData.familyNodes, splittedStringsArr[ splittedStringsArr.length - 3 ], isFormulaWithName, undefined, familyNamespace );
                let isFreeFormFamily = Boolean( splittedStringsArr.length > 2 && freeFormFamObj && freeFormFamObj.props.isFreeForm[ 0 ] === 'true' );
                if( isFreeFormFamily ) {
                    return [ { displayName: displayStrings.k_variant_op_and, type: TYPE_OPERATOR }, { displayName: displayStrings.k_variant_op_or, type: TYPE_OPERATOR } ];
                }
            }

            // If comparison operator is used suggest features of the family selected before operator only
            if( ( currentString.isComparisonOperator || previousString.isComparisonOperator ) && !currentString.featureObj ) {
                if( currentString.isComparisonOperator ) {
                    return _getFeatureSuggestions( variabilityData, previousString.familyObj, currentString.value, displayStrings );
                }
                //Incomplete feature name case
                familyNamespace = splittedStringsArr.length > 3 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 4 ] ) ?
                                splittedStringsArr[ splittedStringsArr.length - 3 ].slice(1, -1) : undefined;
                let familyObjSelectedBeforeOperator = _getFamilyMatch( variabilityData.familyNodes, splittedStringsArr[ splittedStringsArr.length - 3 ], isFormulaWithName, undefined, familyNamespace );
                return _getFeatureSuggestions( variabilityData, familyObjSelectedBeforeOperator, previousString.value, displayStrings );
            }

            // All families as suggestions
            return variabilityData.familyNodes;
        }

        //'TC_show_option_family_prefix' is set to 'false'

        // If family string is complete suggest comparison operators
        if( ( currentString.familyObj || previousString.familyObj ) && !currentString.isOperator ) {
            if( currentString.familyObj && !currentString.featureObj ) {
                return _getComparisonOperatorSuggestions( currentString.familyObj, displayStrings );
            } else if( previousString.familyObj && !previousString.featureObj ) {
                //Incomplete Comparison operator in editor case
                return _getComparisonOperatorSuggestions( previousString.familyObj, displayStrings );
            }
        }

        // If feature string completed suggest logical operators(or logical operator is incomplete).
        if( ( currentString.featureObj || previousString.featureObj ) && !currentString.isOperator ) {
            return [ { displayName: displayStrings.k_variant_op_and, type: TYPE_OPERATOR }, { displayName: displayStrings.k_variant_op_or, type: TYPE_OPERATOR } ];
        } else if( splittedStringsArr.length > 1 ) {
            familyNamespace = splittedStringsArr.length > 3 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 4 ] ) ?
                            splittedStringsArr[ splittedStringsArr.length - 3 ].slice(1, -1) : undefined;
            let freeFormFamObj = _getFamilyMatch( variabilityData.familyNodes, splittedStringsArr[ splittedStringsArr.length - 3 ], isFormulaWithName, undefined, familyNamespace );
            let isFreeFormFamily = Boolean( splittedStringsArr.length > 2 && freeFormFamObj && freeFormFamObj.props.isFreeForm[ 0 ] === 'true' );
            if( isFreeFormFamily ) {
                return [ { displayName: displayStrings.k_variant_op_and, type: TYPE_OPERATOR }, { displayName: displayStrings.k_variant_op_or, type: TYPE_OPERATOR } ];
            }
        }

        // Family name must be written in display formula irrespective of 'TC_show_option_family_prefix' preference if family is freeForm or it's cfg0ValueDataType is Integer/Date/Floating Point.
        let requiredFamilySuggestions = [];
        let requiredFamilySuggestionsUid = [];
        variabilityData.familyNodes.forEach( ( family ) => {
            let familyValueDataType = family.props.cfg0ValueDataType[ 0 ];
            if( family.props.isFreeForm[ 0 ] === 'true' || familyValueDataType === 'Integer' || familyValueDataType === 'Date' || familyValueDataType === 'Floating Point' ) {
                requiredFamilySuggestions.push( family );
                requiredFamilySuggestionsUid.push( family.sourceUid );
            }
        } );

        // Feature suggestions
        if( ( currentString.isComparisonOperator || previousString.isComparisonOperator || currentString.value === displayStrings.k_variant_op_not || currentString.value === '!' || previousString.value ===
                displayStrings.k_variant_op_not || previousString.value === '!' ) && !currentString.featureObj ) {
            //If 'TC_show_option_family_prefix' is set to 'false', formula can be written without family as 'NOTstringFeature1'
            if( currentString.value === displayStrings.k_variant_op_not || currentString.value === '!' || previousString.value === displayStrings.k_variant_op_not || previousString.value === '!' ) {
                let suggestions = [];

                // Suggest features which can be written without family in display formula
                let featureNodes = JSON.parse( JSON.stringify( variabilityData.featureNodes ) );
                featureNodes.forEach( ( feature ) => {
                    let isFamilyRequired = requiredFamilySuggestionsUid.includes( feature.parentUid );
                    if( !isFamilyRequired ) {
                        suggestions.push( feature );
                    }
                } );

                return suggestions;
            }
            // If comparison operator is used suggest features of the family selected before operator only
            // Formula written as family = feature
            if( currentString.isComparisonOperator ) {
                return _getFeatureSuggestions( variabilityData, previousString.familyObj, currentString.value, displayStrings );
            }
            //Incomplete feature name case
            familyNamespace = splittedStringsArr.length > 3 && _isFamilyNamespace( splittedStringsArr[ splittedStringsArr.length - 4 ] ) ?
                            splittedStringsArr[ splittedStringsArr.length - 3 ].slice(1, -1) : undefined;
            let familyObjSelectedBeforeOperator = _getFamilyMatch( variabilityData.familyNodes, splittedStringsArr[ splittedStringsArr.length - 3 ], isFormulaWithName, undefined , familyNamespace );
            return _getFeatureSuggestions( variabilityData, familyObjSelectedBeforeOperator, previousString.value, displayStrings );
        }

        // Empty editor or Logical operator is written, suggest required families and features which can be written without family in display formula
        let suggestions = requiredFamilySuggestions;

        variabilityData.featureNodes.forEach( ( feature ) => {
            let isFamilySuggested = requiredFamilySuggestionsUid.includes( feature.parentUid );
            if( !isFamilySuggested ) {
                suggestions.push( feature );
            }
        } );

        // Suggest Not operator as first suggestion to write as NOTstringFeature2 AND boolFeature2
        suggestions.unshift( { displayName: displayStrings.k_variant_op_not, type: TYPE_OPERATOR } );

        return suggestions;
    }catch( error ) {
        if( error.message === "Ambiguous data found" ) {
            // As we have already shown error as warning for data ambiguity we can ignore error and return empty suggestions.
            return [];
        }
    }
};

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Cache display strings i.e. localized strings for display formula
 * @param { Object } monacoObject - Represents the instance of the editor.
 * @returns {Object} Object of cached display strings
 */
export const cacheDisplayStrings = async( monacoObject ) => {
    let displayStrings = {};
    let displayStringsObj = JSON.parse( sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS ) );
    if( !displayStringsObj ) {
        await pca0CommonUtils.getLocalizedOperatorStrings();
        displayStringsObj = JSON.parse( sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS ) );
    }
    displayStrings = displayStringsObj;
    const globalConfig = monacoObject.getValue();
    let model = globalConfig.editor.getModels()[ 0 ];

    //Cache display strings on monaco editor model
    model.displayStrings = displayStrings;

    return { displayStrings, isDisplayStringCached: true };
};

/**
 * Cache Cfg0PrimaryBusinessRelevantAttribute value on monaco editor model to populate suggestions based on it for display formula with ID/displayName.
 * @param { Object } monacoObject - Represents the instance of the editor.
 * @return {Boolean} True if formula contain display names else false
 */
export const cachePrimaryBusinessRelevantAttribute = async( monacoObject ) => {
    let Cfg0PrimaryBusinessRelevantAttribute = sessionStorage.getItem( 'Cfg0PrimaryBusinessRelevantAttribute' );
    if( !Cfg0PrimaryBusinessRelevantAttribute ) {
        const soaInput = {
            keys: [
                'Cfg0PrimaryBusinessRelevantAttribute'
            ]
        };
        const response = await soaSvc.postUnchecked( 'BusinessModeler-2011-06-Constants', 'getGlobalConstantValues2', soaInput );
        Cfg0PrimaryBusinessRelevantAttribute = response.constantValues[ 0 ].value[ 0 ];
        sessionStorage.setItem( 'Cfg0PrimaryBusinessRelevantAttribute', Cfg0PrimaryBusinessRelevantAttribute );
    }

    let isFormulaWithName = Cfg0PrimaryBusinessRelevantAttribute === 'Cfg0AbsConfiguratorWSO.object_name';

    // Cache on editor model
    const globalConfig = monacoObject.getValue();
    let model = globalConfig.editor.getModels()[ 0 ];
    model.Cfg0PrimaryBusinessRelevantAttribute = Cfg0PrimaryBusinessRelevantAttribute;
    model.isFormulaWithName = isFormulaWithName;

    return isFormulaWithName;
};

/**
 * Cache preference values on monaco editor model to populate suggestions based on it for display formula.
 * @param {Array} awcPreferences - AWC startup preferences object.
 * @param { Object } monacoObject - Represents the instance of the editor.
 */
export const cachePreferences = ( awcPreferences, monacoObject ) => {
    let preference = {};

    if( awcPreferences.TC_show_family_namespace_prefix && awcPreferences.TC_show_option_family_prefix ) {
        preference.TC_show_family_namespace_prefix = awcPreferences.TC_show_family_namespace_prefix[ 0 ];
        preference.TC_show_option_family_prefix = awcPreferences.TC_show_option_family_prefix[ 0 ];

        //Cache preference values on monaco editor model
        const globalConfig = monacoObject.getValue();
        let model = globalConfig.editor.getModels()[ 0 ];
        model.preference = preference;
        suggesterPreferences = preference;
    }
};

/**
 * Cache variability data as familyNodes and featureNodes and each family node having children uid's and each feature node having parent uid

 * @param { Object } monacoObject - Represents the instance of the editor.
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @param {String} configPerspectiveUid - Perspective uid from parent view
 * @param {String} configContextUid - Configurator context uid from parent view
 * @returns {Array} Object of cached variability data as familyNodes and featureNodes
 */
export const cacheVariabilityData = async( monacoObject, displayStrings, configPerspectiveUid, configContextUid ) => {
    let variabilityData = {};

    const soaInput = {
        // To get all variability data i.e. all families and features in one soa call for formula suggester component
        // Use viewType 5 defined in sever for this component
        // And send group, model, and unassigned as request type
        requestType: [
            '{"requestType":["Group","Model","Unassigned"],"viewType":5}'
        ],
        parentUids: [],
        level: -1,
        sortCriteria: [],
        columnFilters: [],
        requestInfo: ''
    };

    if( configPerspectiveUid ) {
        soaInput.configPerspective = { uid: configPerspectiveUid, type: 'Cfg0ConfiguratorPerspective' };
    } else {
        soaInput.confContext = { uid: configContextUid, type: 'Cfg0ProductItem' };
    }
    const response = await soaSvc.postUnchecked( 'Internal-ProductConfiguratorAw-2024-06-ConfiguratorManagement', 'getVariability3', soaInput );

    const displayValues = Object.values( displayStrings );
    const displayValuesRegExp = new RegExp( `(${displayValues.map( op => _escapeRegExp( op ) ).join( '|' )})` );

    //collect all family vmo objects
    let familyNodes = _getFamilyNodes( response.viewModelObjectMap, displayValuesRegExp );
    let featureNodes = [];
    //cache features
    if( !_.isEmpty( familyNodes ) && response.viewModelObjectMap ) {
        let showOptionFamilyPreferenceOff = appCtxService.getCtx( 'preferences' ).TC_show_option_family_prefix[ 0 ] === 'false';
        familyNodes.forEach( ( element ) => {
            // get feature uid's of each family
            let featureUIDs = response.variabilityTreeData.find( ( { nodeUid } ) => nodeUid === element.sourceUid ).childrenUids;
            let featureVMObjects = [];
            if( !_.isEmpty( featureUIDs ) ) {
                // If TC_show_option_family_prefix is false add namespace in feature vmo props to show family namespace in feature suggestions
                let familyNamespace;
                let familyValueDataType = element.props.cfg0ValueDataType[ 0 ];
                if( showOptionFamilyPreferenceOff ) {
                    familyNamespace = element.props.cfg0FamilyNamespace[ 0 ];
                }

                // If unit of measure is not empty add it in feature vmo props to show in feature suggestions
                let unitOfMeasure;
                if( element.props.cfg0UOM[ 0 ] !== '' ) {
                    unitOfMeasure = element.props.cfg0UOM[ 0 ];
                }

                //collect all feature vmo objects
                featureVMObjects = _getFeatureNodes( featureUIDs, response.viewModelObjectMap, element.sourceUid, displayValuesRegExp, familyNamespace, unitOfMeasure );
                element.childrenUids = featureUIDs;
                featureNodes = featureNodes.concat( featureVMObjects );
            } else {
                element.childrenUids = [];
            }
        } );
    }
    variabilityData.familyNodes = familyNodes;
    variabilityData.featureNodes = featureNodes;
    //Cache variability data on monaco editor model.
    if( monacoObject ) {
        const globalConfig = monacoObject.getValue();
        if( globalConfig ) {
            let model = globalConfig.editor.getModels()[ 0 ];
            if( model ) {
                model.variabilityData = variabilityData;
            }
        }
    }
    return { variabilityData, isVariabilityCached: true, configPerspectiveUid: response.configPerspective.uid };
};

/**
 * Initialize editor properties such as Display name, variant formula(editor string).
 *
 * To update any of the monaco config values pass config object and update it's value
 * Here are some important config values and their use
 * "readOnly": false - editor in editing mode, making it 'true' will make editor non editable.
 * "lineNumbers": "off" - Making it 'on' will enable line number section of editor visible.
 * "wordWrap": "on"- Enables word wrap in editor area making it 'off' will disable word wrap.
 * "minimap": { "enabled": false }- making "enabled"= true will enables minimap in editor area.
 * "fontFamily": "monospace" - To change editor text font update this property with new font type.
 * "height": "100" - Update height of editor area using this property
 * "TextEditorCursorBlinkingStyle": "Blink" - Change this property to 'solid' to have solid cursor.
 *
 * Set custom language and theme of aw-source-editor for the variant formula suggester
 * @param {Object} formulaRef - Atomic object containing display as display formula and internal as internal formula strings
 * @param { Object } monacoObject - Represents the instance of the editor global API.
 * @param { Object } monacoEditorInstance - Represents the instance of the editor.
 * @param {Object} editorObjectRef Editor properties atomic object e.g. header,editContext,isFormulaDirty, useIntellisense
 * @returns {Object} Updated editor properties.
 */
export const initializeEditorProps = ( formulaRef, monacoObject, monacoEditorInstance, editorObjectRef ) => {
    let initialDisplayFormula = formulaRef.value && formulaRef.value.display ? formulaRef.value.display.slice() : '';
    let initialInternalFormula = formulaRef.value && formulaRef.value.internal ? formulaRef.value.internal : '';

    let editorString = '';
    if( editorObjectRef.value.editContext === 'readOnly' || _.isUndefined( editorObjectRef.value.useIntellisense ) || editorObjectRef.value.useIntellisense ) {
        editorString = initialDisplayFormula;
    } else {
        editorString = initialInternalFormula;
    }

    // Register a new language for the variant formula
    const language = 'tcFormulaLanguage';
    const globalConfig = monacoObject.getValue();
    globalConfig.languages.register( { id: language } );

    //Enables bracket match highlighting and auto closing
    globalConfig.languages.setLanguageConfiguration( language, {
        brackets: [
            [ '[', ']' ],
            [ '(', ')' ]
        ],
        autoClosingPairs: [
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '\'', close: '\'' }
        ]
    } );

    let ctrlSpaceKeyPressed = false;
    // To know if user is trying to produce suggestions without typing any character
    monacoEditorInstance.onKeyDown( function( e ) {
        // Check if Ctrl key and Space key are pressed simultaneously
        if( e.ctrlKey && e.keyCode === monacoObject.KeyCode.Space ) {
            ctrlSpaceKeyPressed = true;
        }
    } );

    let localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );

    // completionProviderHandle is used to trigger suggestions
    const completionProviderHandle = globalConfig.languages.registerCompletionItemProvider( language, {
        // These characters should trigger our provideCompletionItems function
        triggerCharacters: [ '', ' ', '&', '|', '=', '>', '<' ],
        provideCompletionItems: ( model, position ) => {
            var word = model.getWordUntilPosition( position );
            let monacoSuggestions = [];
            let customSuggestions;
            let variabilityData = model.variabilityData;
            let displayStrings = model.displayStrings;
            let preference = model.preference;
            let isFormulaWithName = model.isFormulaWithName;

            let cursorRange = {
                startLineNumber: 1, // start line number (in this case, line 1)
                startColumn: 1, // start column (in this case, column 1)
                endLineNumber: position.lineNumber, // end line number
                endColumn: position.column // end column
            };

            let textUntilPosition = model.getValueInRange( cursorRange );

            let suggestionsRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            let wordStartsWithNotOperator = word.word.startsWith( displayStrings.k_variant_op_not );

            // If user is trying to produce suggestions without typing any character i.e. ctrl+space is pressed
            // Suggestion start and end column is current positions
            if( ctrlSpaceKeyPressed && word.word.trim().length !== 0 && !wordStartsWithNotOperator ) {
                suggestionsRange.startColumn = position.column;
                suggestionsRange.endColumn = position.column;
                ctrlSpaceKeyPressed = false;
            }

            if( variabilityData && variabilityData.featureNodes && variabilityData.familyNodes && displayStrings && preference ) {
                customSuggestions = _getSuggestions( textUntilPosition, variabilityData, displayStrings, preference, isFormulaWithName );
            }

            //push the suggestions to the suggestion widget
            if( customSuggestions ) {
                customSuggestions.forEach( ( suggestion, index ) => {
                    // completionItemKind numbers commented in _cfgCommon.scss file to override monaco suggestion icons with aw icon for family, feature etc.
                    let completionItemKind;
                    let label;
                    let insertText;
                    let documentation;
                    if( suggestion.type === TYPE_FEATURE ) {
                        let featureSourceType = _.get( suggestion, 'sourceType' );
                        switch ( featureSourceType ) {
                            case 'Cfg0ProductLine':
                                completionItemKind = 1;
                                break;
                            case 'Cfg0ProductModel':
                                completionItemKind = 2;
                                break;
                            case 'Cfg0SummaryModel':
                                completionItemKind = 3;
                                break;
                            default:
                                // This if block will handle completion kind item for Any/None pushed as features for different families
                                if( suggestion.displayName === displayStrings.k_variant_optional_family_any_value || suggestion.displayName === displayStrings
                                    .k_variant_optional_family_none_value ) {
                                    let featureSourceType = _.get( customSuggestions[ 2 ], 'sourceType' );
                                    if( featureSourceType === 'Cfg0ProductLine' ) {
                                        completionItemKind = 1;
                                    } else if( featureSourceType === 'Cfg0ProductModel' ) {
                                        completionItemKind = 2;
                                    } else if( featureSourceType === 'Cfg0SummaryModel' ) {
                                        completionItemKind = 3;
                                    } else {
                                        completionItemKind = 0;
                                    }
                                } else {
                                    completionItemKind = 0;
                                }
                                break;
                        }
                    } else if( suggestion.type === TYPE_FAMILY ) {
                        let familySourceType = _.get( suggestion, 'sourceType' );
                        switch ( familySourceType ) {
                            case 'Cfg0ProductLineFamily':
                                completionItemKind = 5;
                                break;
                            case 'Cfg0ProductModelFamily':
                                completionItemKind = 6;
                                break;
                            case 'Cfg0SummaryModelFamily':
                                completionItemKind = 7;
                                break;
                            default:
                                completionItemKind = 4;
                                break;
                        }
                    } else if( suggestion.type === TYPE_OPERATOR ) {
                        completionItemKind = 11;
                    }

                    if( typeof suggestion === 'string' ) {
                        label = suggestion;
                        insertText = suggestion;
                        documentation = suggestion;
                    } else {
                        let notOperator = displayStrings.k_variant_op_not;
                        // ID vs Name in formula is taken care here while populating suggestions
                        // Formula  will be based on ID if we are editing internal formula or TC global constant 'Cfg0PrimaryBusinessRelevantAttribute' value is Cfg0AbsConfiguratorWSO.cfg0ObjectId
                        if( preference.TC_show_family_namespace_prefix === 'true' && _.get( suggestion, 'props.cfg0FamilyNamespace' ) ) {
                            if( isFormulaWithName ) {
                                label = wordStartsWithNotOperator ? notOperator + `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.displayName}` :
                                    `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.displayName}`;
                                insertText = wordStartsWithNotOperator ? notOperator + `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.displayName}` :
                                    `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.displayName}`;
                                documentation = suggestion.props && suggestion.props.cfg0ObjectId ?
                                    `${localeTextBundle.displayName} : ${suggestion.displayName}, ${localeTextBundle.id} : ${suggestion.props.cfg0ObjectId[0]}, ${localeTextBundle.familyNamespace} : [${suggestion.props.cfg0FamilyNamespace[0]}]` :
                                    `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.displayName}`;
                            } else {
                                if( suggestion.props && suggestion.props.cfg0ObjectId && suggestion.props.cfg0ObjectId.length > 0 ) {
                                    label = wordStartsWithNotOperator ? notOperator + `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.props.cfg0ObjectId[0]}` :
                                        `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.props.cfg0ObjectId[0]}`;
                                    insertText = wordStartsWithNotOperator ? notOperator + `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.props.cfg0ObjectId[0]}` :
                                        `[${suggestion.props.cfg0FamilyNamespace[0]}]${suggestion.props.cfg0ObjectId[0]}`;
                                    documentation =
                                        `${localeTextBundle.displayName} : ${suggestion.displayName}, ${localeTextBundle.id} : ${suggestion.props.cfg0ObjectId[0]}, ${localeTextBundle.familyNamespace} : [${suggestion.props.cfg0FamilyNamespace[0]}]`;
                                } else {
                                    label = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                    insertText = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                    documentation = suggestion.displayName;
                                }
                            }
                        } else {
                            if( isFormulaWithName ) {
                                label = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                insertText = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                documentation = suggestion.props && suggestion.props.cfg0ObjectId ?
                                    `${localeTextBundle.displayName} : ${suggestion.displayName}, ${localeTextBundle.id} : ${suggestion.props.cfg0ObjectId[0]}` : suggestion
                                        .displayName;
                            } else {
                                if( suggestion.props && suggestion.props.cfg0ObjectId && suggestion.props.cfg0ObjectId.length > 0 ) {
                                    label = wordStartsWithNotOperator ? notOperator + suggestion.props.cfg0ObjectId[ 0 ] : suggestion.props.cfg0ObjectId[ 0 ];
                                    insertText = wordStartsWithNotOperator ? notOperator + suggestion.props.cfg0ObjectId[ 0 ] : suggestion.props.cfg0ObjectId[ 0 ];
                                    documentation = `${localeTextBundle.displayName} : ${suggestion.displayName}, ${localeTextBundle.id} : ${suggestion.props.cfg0ObjectId[0]}`;
                                } else {
                                    label = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                    insertText = wordStartsWithNotOperator ? notOperator + suggestion.displayName : suggestion.displayName;
                                    documentation = suggestion.displayName;
                                }
                            }
                        }

                        // If feature suggestion and have unit of measure then show it with the feature
                        if( suggestion.type === TYPE_FEATURE && suggestion.props && suggestion.props.cfg0UOM && suggestion.props.cfg0UOM ) {
                            label += suggestion.props.cfg0UOM[ 0 ];
                            insertText += suggestion.props.cfg0UOM[ 0 ];
                        }
                    }
                    monacoSuggestions.push( {
                        label: label,
                        kind: completionItemKind,
                        documentation: documentation,
                        insertText: insertText,
                        sortText: index.toString(),
                        range: suggestionsRange
                    } );
                } );
            }
            return {
                incomplete: false,
                suggestions: JSON.parse( JSON.stringify( monacoSuggestions ) )
            };
        }
    } );

    const tokenStyles = [
        { background: 'ffffff' },
        { token: tokenConstants.comparisonOperator, foreground: '#55A0B9', fontStyle: 'bold' },
        { token: tokenConstants.logicalOperator, foreground: '#005F87', fontStyle: 'bold' },
        { token: tokenConstants.roundBracket, foreground: '#fc28eb' },
        { token: tokenConstants.familyNameSpace, foreground: '#738007' },
        { token: tokenConstants.localizedComparisonOperator, foreground: '#55A0B9', fontStyle: 'bold' },
        { token: tokenConstants.localizedLogicalOperator, foreground: '#005F87', fontStyle: 'bold' },
        { token: tokenConstants.familyName, foreground: '#0A9B00' },
        { token: tokenConstants.featureName, foreground: '#EB780A' }
    ];
    // Register theme for the editor instance
    globalConfig.editor.defineTheme( 'tcFormulaTheme', {
        base: 'vs',
        inherit: true,
        rules: tokenStyles,
        colors: {
            'editor.foreground': '#000000',
            'editor.background': '#ffffff',
            'editorCursor.foreground': '#8B0000',
            'editor.lineHighlightBackground': '#ffffff',
            'editorLineNumber.foreground': '#008800',
            'editor.selectionForeground': '#bfbebd',
            'editorSuggestWidget.background': '#edeceb',
            'editorSuggestWidget.selectedBackground': '#bfbcba',
            errorForeground: '#464646',
            'editorHoverWidget.background': '#fbeeed',
            'editorHoverWidget.border': '#efbbb9'
        }
    } );
    globalConfig.editor.setTheme( 'tcFormulaTheme' );
    // Set empty token provider to remove it from cache.
    globalConfig.languages.setMonarchTokensProvider( language, { tokenizer: { root: [] } } );
    return { editorString: editorString, internalFormula: initialInternalFormula, completionProviderHandle, initialDisplayFormula, initialInternalFormula };
};

/**
 * Set tokenizer for TC formula language will enable coloring and using different font styles for different tokens like family name, feature name, operator etc.
 * @param { Object } monacoObject - Represents the instance of the editor.
 * @param { String } language - Custom language registered.
 * @param {Boolean} isIntellisenseOn - Flag whether intellisense is on or not
 * @returns {Boolean} true once tokenizer for the language is set
*/

export const setTokenizerForTcFormulaLanguage = ( monacoObject, language, isIntellisenseOn ) => {
    const globalConfig = monacoObject.getValue();
    let model = globalConfig.editor.getModels()[ 0 ];

    let variabilityData = model.variabilityData;
    let displayStrings = model.displayStrings;
    if( model.variabilityData && model.displayStrings && ( isIntellisenseOn || isIntellisenseOn === undefined ) ) {
        const localizedLogicalOperator = [ displayStrings.k_variant_op_and, displayStrings.k_variant_op_or ];
        const localizedLogicalOperatorToken = new RegExp( `\\b(${localizedLogicalOperator.map( op => _escapeRegExp( op ) ).join( '|' )})\\b` );

        const localizedComparisonOperator = [ displayStrings.k_variant_op_is_equal,
            displayStrings.k_variant_op_not_equal,
            displayStrings.k_variant_op_gt,
            displayStrings.k_variant_op_lt,
            displayStrings.k_variant_op_gt_eq,
            displayStrings.k_variant_op_lt_eq
        ];
        const localizedComparisonOperatorToken = new RegExp( `\\b(${localizedComparisonOperator.map( op => _escapeRegExp( op ) ).join( '|' )})\\b` );

        const localizedNotOperatorToken = new RegExp( `\\b(${_escapeRegExp( displayStrings.k_variant_op_not )})` );

        const familyNameAndIdPattern = variabilityData.familyNodes.map( family => {
            const escapedName = _escapeRegExp( family.displayName );
            const escapedId = _escapeRegExp( family.props.cfg0ObjectId[ 0 ] );
            return `${escapedName}|${escapedId}`;
        } ).join( '|' );

        if( familyNameAndIdPattern !== '' ) {
            const familyNameToken = new RegExp( `\\b(${familyNameAndIdPattern})\\b` );

            const featureNameAndIdPattern = variabilityData.featureNodes.map( feature => {
                const escapedName = _escapeRegExp( feature.displayName );
                const escapedId = _escapeRegExp( feature.props.cfg0ObjectId[ 0 ] );
                return `${escapedName}|${escapedId}`;
            } ).join( '|' );

            const localizedFeatures = [
                displayStrings.k_false,
                displayStrings.k_true,
                displayStrings.k_variant_optional_family_any_value,
                displayStrings.k_variant_optional_family_none_value
            ];
            const featureNameAndIdPatternWithLocalizedFeatures = `${featureNameAndIdPattern}|${localizedFeatures.map( op => _escapeRegExp( op ) ).join( '|' )}`;
            const featureNameToken = new RegExp( `\\b(?:!|NOT)?(${featureNameAndIdPatternWithLocalizedFeatures})\\b` );

            // Register a tokens provider for the language to enable coloring
            globalConfig.languages.setMonarchTokensProvider( language, {
                ignoreCase: false,
                tokenizer: {
                    root: [
                        [ /\[[a-zA-Z 0-9\s!@#$%^&*()_+=,.<>?/;:'"|`{}\\~]+\]/, 'familyNameSpace' ],
                        [ /[=<>!]/, 'comparisonOperator' ],
                        [ /\(|\)/, 'roundBracket' ],
                        [ /[&|]/, 'logicalOperator' ],
                        [ localizedLogicalOperatorToken, 'localizedLogicalOperator' ],
                        [ localizedComparisonOperatorToken, 'localizedComparisonOperator' ],
                        [ localizedNotOperatorToken, 'localizedComparisonOperator' ],
                        [ familyNameToken, 'familyName' ],
                        [ featureNameToken, 'featureName' ]
                    ]
                }
            } );
            return true;
        }
    }
    // Set empty token provider
    globalConfig.languages.setMonarchTokensProvider( language, { tokenizer: { root: [] } } );
    return false;
};

/**
 * Updates internal formula programmatically using display formula in the editor.
 * @param {String} editorString - Editor string
 * @param {Boolean} isIntellisenseOn - Flag whether intellisense is on or not
 * @param {Object} variabilityData - Cached variability data
 * @param {Object} displayStrings - Object containing localized values of k_variant_options on server for display formula.
 * @param {Boolean} isFormulaWithName - True if formula contains names else false
 * @returns {String} Internal formula.
 */
export const updateInternalFormula = ( editorString, isIntellisenseOn, variabilityData, displayStrings, isFormulaWithName ) => {
    try{
        let displayFormula = editorString.length === 0 ? '' : editorString.slice();
        let internalFormula = '';
        let internalToDisplayFormulaMap = [];

        if( isIntellisenseOn === undefined || isIntellisenseOn ) {
            // Split display formula in pieces to construct internal formula.
            let splittedStringsArr = _splitEditorString( displayFormula, displayStrings, false, true );
            //remove empty strings from array
            splittedStringsArr = splittedStringsArr.filter( element => { return element; } );

            for( let strIndex = 0; strIndex < splittedStringsArr.length; ) {
                //Remove leading and trailing spaces from string to use in internal formula
                const currentString = splittedStringsArr[ strIndex ].trim();
                const nextString = strIndex < splittedStringsArr.length - 1 ? splittedStringsArr[ strIndex + 1 ].trim() : '';
                const secondNextString = strIndex < splittedStringsArr.length - 2 ? splittedStringsArr[ strIndex + 2 ].trim() : '';
                const previousString = strIndex > 0 ? splittedStringsArr[ strIndex - 1 ].trim() : '';

                const previousNameSpaceStr = _isFamilyNamespace( previousString )?previousString.slice( 1, -1):undefined;

                // If current string is bracket, just add as it is
                const isBracket = _isBracket( currentString );
                if( isBracket ) {
                    let internalFormulaString = currentString + ' ';
                    internalFormula += internalFormulaString;
                    internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                    strIndex += 1;
                } else {
                    // If current string is familyNamespace, add it as it is.
                    const isFamilyNamespace = _isFamilyNamespace( currentString );
                    if( isFamilyNamespace ) {
                        let internalFormulaString = currentString;
                        internalFormula += internalFormulaString;
                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                        strIndex += 1;
                    } else {
                        const isOperator = _isOperator( currentString, displayStrings );
                        if( isOperator ) {
                            //If current string is NOT(!) operator check whether next string is feature, if yes then create formula (family != feature) else add operator as it is.
                            if( currentString === '!' || currentString === displayStrings.k_variant_op_not ) {
                                // Display formula: NOT( Feature1 OR Feature2)/NOT(Fam=Feature1 OR Fam=Feature2)
                                // Internal formula: !( [namespace]fam = Feature1 | [namespace]Fam = Feature2)
                                // So just replace operator rest of the formula will be created in next iteration
                                if( _isBracket( nextString ) || _getFamilyMatch( variabilityData.familyNodes, nextString, isFormulaWithName ) ) {
                                    let internalFormulaString = '!';
                                    internalFormula += internalFormulaString;
                                    internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                    strIndex += 1;
                                    continue;
                                }

                                //Display formula might have any of the forms as 1. [namespace]NOTFeatureName or 2. NOT[namespace]BooleanFamilyName
                                const feature = _getFeatureMatch( variabilityData.featureNodes, nextString, displayStrings, isFormulaWithName, undefined, previousNameSpaceStr );
                                const nextNameSpaceStr = _isFamilyNamespace( nextString ) ? nextString.slice( 1, -1) : undefined;
                                if( feature ) {
                                    // 1. [namespace]NOTFeatureName
                                    const familyOfFeatureMatched = _getFamilyMatch( variabilityData.familyNodes, undefined, isFormulaWithName, feature.parentUid );
                                    if( familyOfFeatureMatched ) {
                                        let familyNameSpace = previousNameSpaceStr ? '' : `[${familyOfFeatureMatched.props.cfg0FamilyNamespace[0]}]`;
                                        let internalFormulaString =
                                            `${familyNameSpace}${familyOfFeatureMatched.props.cfg0ObjectId[0]} != ${feature.props.cfg0ObjectId[0]} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] } );
                                        strIndex += 2;
                                    } else {
                                        let internalFormulaString = currentString + ' ';
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    }
                                } else if( nextNameSpaceStr ) {
                                    //2. NOT[namespace]BooleanFamilyName
                                    const feature = _getFeatureMatch( variabilityData.featureNodes, secondNextString, displayStrings, isFormulaWithName, undefined, nextNameSpaceStr );
                                    if( feature ) {
                                        const familyOfFeatureMatched = _getFamilyMatch( variabilityData.familyNodes, undefined, isFormulaWithName, feature.parentUid );
                                        if( familyOfFeatureMatched ) {
                                            let familyNameSpace = previousNameSpaceStr ? '' : `[${familyOfFeatureMatched.props.cfg0FamilyNamespace[0]}]`;
                                            let internalFormulaString =
                                                `${familyNameSpace}${familyOfFeatureMatched.props.cfg0ObjectId[0]} != ${feature.props.cfg0ObjectId[0]} `;
                                            internalFormula += internalFormulaString;
                                            internalToDisplayFormulaMap.push( {
                                                key: internalFormulaString,
                                                value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] +
                                                    splittedStringsArr[ strIndex + 2 ]
                                            } );
                                            strIndex += 3;
                                        } else {
                                            let internalFormulaString = currentString + ' ';
                                            internalFormula += internalFormulaString;
                                            internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                            strIndex += 1;
                                        }
                                    } else {
                                        let internalFormulaString = currentString + ' ';
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    }
                                } else {
                                    let internalFormulaString = '!' + ' ';
                                    internalFormula += internalFormulaString;
                                    internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                    strIndex += 1;
                                }
                            } else if( currentString === displayStrings.k_variant_op_and || currentString === displayStrings.k_variant_op_or ) {
                                //If current string is display value of logical operator then replace with internal value

                                let internalFormulaString = currentString === displayStrings.k_variant_op_and ? '& ' : '| ';
                                internalFormula += internalFormulaString;
                                internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                strIndex += 1;
                            } else {
                                //Other operators replace with its counterpart used in internal formula
                                switch ( currentString ) {
                                    case displayStrings.k_variant_op_is_equal:
                                        internalFormula += '=' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '=' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    case displayStrings.k_variant_op_not_equal:
                                        internalFormula += '!=' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '!=' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    case displayStrings.k_variant_op_gt:
                                        internalFormula += '>' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '>' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    case displayStrings.k_variant_op_lt:
                                        internalFormula += '<' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '<' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    case displayStrings.k_variant_op_gt_eq:
                                        internalFormula += '>=' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '>=' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    case displayStrings.k_variant_op_lt_eq:
                                        internalFormula += '<=' + ' ';
                                        internalToDisplayFormulaMap.push( { key: '<=' + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                    default:
                                        internalFormula += currentString + ' ';
                                        internalToDisplayFormulaMap.push( { key: currentString + ' ', value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                        break;
                                }
                            }
                        } else {
                            const family = _getFamilyMatch( variabilityData.familyNodes, currentString, isFormulaWithName, undefined, previousNameSpaceStr );
                            //If current string is family check for operator used and feature after comparison operator and create formula accordingly
                            if( family ) {
                                const familyNameSpace = previousNameSpaceStr ? '' : `[${family.props.cfg0FamilyNamespace[0]}]`;
                                const isNextStringComparisonOperator = _isComparisonOperator( nextString, displayStrings );
                                if( isNextStringComparisonOperator && nextString !== displayStrings.k_variant_op_not ) {
                                    const featureOfFamilyMatched = _getFeatureMatch( variabilityData.featureNodes, secondNextString, displayStrings, isFormulaWithName, family.childrenUids );
                                    if( featureOfFamilyMatched ) {
                                        if( secondNextString === displayStrings.k_true || secondNextString === displayStrings.k_false ) {
                                            //Boolean Family with true/false as feature
                                            const featureObject = _getFeatureMatch( variabilityData.featureNodes, undefined, displayStrings, undefined, family.childrenUids );
                                            const operatorToUse = secondNextString === displayStrings.k_true ? '=' : '!=';
                                            let internalFormulaString =
                                                `${familyNameSpace}${family.props.cfg0ObjectId[0]} ${operatorToUse} ${featureObject.props.cfg0ObjectId[0]} `;
                                            internalFormula += internalFormulaString;
                                            internalToDisplayFormulaMap.push( {
                                                key: internalFormulaString,
                                                value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] +
                                                    splittedStringsArr[ strIndex + 2 ]
                                            } );
                                            strIndex += 3;
                                        } else if( secondNextString === displayStrings.k_variant_optional_family_any_value ||
                                            secondNextString === displayStrings.k_variant_optional_family_none_value ) {
                                            //Optional family with Any/None value
                                            const featureExpression = secondNextString === displayStrings.k_variant_optional_family_any_value ? '!= \'\'' : '= \'\'';
                                            let internalFormulaString =
                                                `${familyNameSpace}${family.props.cfg0ObjectId[0]} ${featureExpression} `;
                                            internalFormula += internalFormulaString;
                                            internalToDisplayFormulaMap.push( {
                                                key: internalFormulaString,
                                                value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] +
                                                    splittedStringsArr[ strIndex + 2 ]
                                            } );
                                            strIndex += 3;
                                        } else {
                                            //Remaining cases
                                            let internalFormulaString =
                                                `${familyNameSpace}${family.props.cfg0ObjectId[0]} ${nextString} ${featureOfFamilyMatched.props.cfg0ObjectId[0]} `;
                                            internalFormula += internalFormulaString;
                                            internalToDisplayFormulaMap.push( {
                                                key: internalFormulaString,
                                                value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] +
                                                    splittedStringsArr[ strIndex + 2 ]
                                            } );
                                            strIndex += 3;
                                        }
                                    } else if( family.props.isFreeForm[ 0 ] === 'true' ) {
                                        // Remove unit of measure from the feature of free form family
                                        let internalFormulaString =
                                            `${familyNameSpace}${family.props.cfg0ObjectId[0]} ${nextString} ${secondNextString.replace( family.props.cfg0UOM[0], '' )} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( {
                                            key: internalFormulaString,
                                            value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] +
                                                splittedStringsArr[ strIndex + 2 ]
                                        } );
                                        strIndex += 3;
                                    } else {
                                        let internalFormulaString =
                                            `${familyNameSpace}${family.props.cfg0ObjectId[0]} ${nextString} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] + splittedStringsArr[ strIndex + 1 ] } );
                                        strIndex += 2;
                                    }
                                } else {
                                    //Boolean family and it's feature with same display name case
                                    if( _.get( family, 'props.cfg0ValueDataType[0]' ) === 'Boolean' ) {
                                        const featureObject = _getFeatureMatch( variabilityData.featureNodes, undefined, displayStrings, undefined, family.childrenUids );
                                        let internalFormulaString =
                                            `${familyNameSpace}${family.props.cfg0ObjectId[0]} = ${featureObject.props.cfg0ObjectId[0]} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    } else {
                                        let internalFormulaString =
                                            `${familyNameSpace}${family.props.cfg0ObjectId[0]} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    }
                                }
                            } else {
                                const feature = _getFeatureMatch( variabilityData.featureNodes, currentString, displayStrings, isFormulaWithName, undefined, previousNameSpaceStr );
                                // If after logical operator instead of family directly feature is selected, create formula accordingly strIndex.e. of form '[nameSpace]family = feature'.
                                if( feature && !_isComparisonOperator( previousString, displayStrings ) ) {
                                    const familyOfFeatureMatched = _getFamilyMatch( variabilityData.familyNodes, undefined, isFormulaWithName, feature.parentUid );
                                    if( familyOfFeatureMatched ) {
                                        let familyNameSpace = previousNameSpaceStr ? '' : `[${familyOfFeatureMatched.props.cfg0FamilyNamespace[0]}]`;
                                        let internalFormulaString =
                                            `${familyNameSpace}${familyOfFeatureMatched.props.cfg0ObjectId[0]} = ${feature.props.cfg0ObjectId[0]} `;
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    } else {
                                        let internalFormulaString = currentString + ' ';
                                        internalFormula += internalFormulaString;
                                        internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                        strIndex += 1;
                                    }
                                } else {
                                    let internalFormulaString = currentString + ' ';
                                    internalFormula += internalFormulaString;
                                    internalToDisplayFormulaMap.push( { key: internalFormulaString, value: splittedStringsArr[ strIndex ] } );
                                    strIndex += 1;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            internalFormula += editorString;
            internalToDisplayFormulaMap.push( { key: editorString, value: editorString } );
        }
        return { internalFormula: internalFormula, internalToDisplayFormulaMap: internalToDisplayFormulaMap, internalFormulaUpdated: true };
    }catch( error ) {
        if( error.message === "Ambiguous data found" ) {
            // As we have already shown error as warning for data ambiguity we can ignore error return flag for formula update.
            return { internalFormula: editorString, internalToDisplayFormulaMap:[{ key: editorString, value: editorString }], internalFormulaUpdated: false };
        }
    }
};

/**
 * Update editor content i.e dbValue of the editorContent object,if parent view changes formula atomic object.
 * @param {Object} formulaRef - Atomic object containing display as display formula and internal as internal formula strings
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext,isFormulaDirty, useIntellisense
 * @returns {Object} Updated editor content.
 */
export const updateEditorContent = ( formulaRef, editorObject ) => {
    let initialDisplayFormula = formulaRef.value && formulaRef.value.display ? formulaRef.value.display.slice() : '';
    let initialInternalFormula = formulaRef.value && formulaRef.value.internal ? formulaRef.value.internal : '';

    let editorString;
    // If formula strings are empty then set editor content as empty string, as monaco editor needs some content to show editor.
    if( editorObject.value.editContext === 'readOnly' || editorObject.value.useIntellisense === undefined || editorObject.value.useIntellisense ) {
        editorString = initialDisplayFormula !== '' ? initialDisplayFormula : ' ';
    } else {
        editorString = initialInternalFormula !== '' ? initialInternalFormula : ' ';
    }
    return { editorString, internalFormula: initialInternalFormula, initialDisplayFormula, initialInternalFormula };
};

/**
 * Updates formula atomic object from the parent.
 * @param {String} internalFormula -Fully qualified internal formula.
 * @param {String} editorString - Editor string
 * @param {Object} formulaRef -Atomic object from parent containing display and internal formulas.
 */
export const updateFormulaObject = ( internalFormula, editorString, formulaRef ) => {
    let formulaObj = { ...formulaRef.getValue() };
    formulaObj.display = editorString.trim();
    formulaObj.internal = internalFormula.trim();
    formulaRef.update( formulaObj );
};

/**
 * Updates atomic object to start clear formula action.
 * @param {Object} editorObjectRef Atomic object sent from parent view
 */
export const updateEditorObjectToClearFormula = ( editorObjectRef ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    editorObject.clearFormulaInProgress = true;
    editorObjectRef.update( editorObject );
};

/**
 * Clears text content of the editor and updates editor object to complete the clear formula action.
 * @param {Object} editorObjectRef Atomic object sent from parent view
 * @returns {String} Empty string to set as editor content
 */
export const clearFormulaInSuggester = ( editorObjectRef ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    editorObject.clearFormulaInProgress = false;
    editorObjectRef.update( editorObject );
    return ' ';
};

/**
 * Updates atomic object to start clear formula action.
 * @param {Object} editorObjectRef Atomic object sent from parent view
 */
export const changeIntellisenseSettingInSuggester = ( editorObjectRef ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    editorObject.useIntellisense = !editorObject.useIntellisense;
    editorObjectRef.update( editorObject );
    appCtxService.updatePartialCtx( 'preferences.' + pca0Constants.PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE, [ editorObject.useIntellisense.toString() ] );
};

/**
 * Updates monaco editors config to stop intellisense.
 * @param { Object } data - ViewModel data
 * @param {Object} editorObjectRef Atomic object sent from parent view
 */
export const updateIntellisenseSetting = ( data, editorObjectRef ) => {
    let editorConfig = _.defaultsDeep( {}, data.config );
    editorConfig.options.quickSuggestions = editorObjectRef.value.useIntellisense;
    editorConfig.options.suggestOnTriggerCharacters = editorObjectRef.value.useIntellisense;
    data.dispatch( { path: 'data.config', value: editorConfig } );
};

/**
 * Set error model markers of editor to show formula syntax error in editor
 * @param {Object} editorObjectRef Atomic object sent from parent view
 * @param { Object } monacoObject - Represents the instance of the editor.
 * @param { Object } internalToDisplayFormulaMap - Internal formula expressions mapped with it's display formula expressions.
 * @param {Object} syntaxCheckErrors Errors from syntax check i.e. convertVariantExpressions soa.
 * @param {Object} saveActionErrors Errors from save soa called  by parent view.
 * @returns {Array } errorMarkers - Array of error markers set on monaco editor model
 */
export const showFormulaSyntaxErrorInEditor = ( editorObjectRef, monacoObject, internalToDisplayFormulaMap, syntaxCheckErrors ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    let errorObj;
    if( editorObject.syntaxValidationInProgress ) {
        editorObject.syntaxValidationInProgress = false;
        editorObjectRef.update( editorObject );
        if( syntaxCheckErrors && syntaxCheckErrors.length > 0 && syntaxCheckErrors[ 0 ].errorValues.length > 0 ) {
            errorObj = syntaxCheckErrors[ 0 ].errorValues[ 0 ];
        }
    } else {
        if( editorObject.errors && editorObject.errors.length > 0 && editorObject.errors[ 0 ].errorValues.length > 0 ) {
            errorObj = editorObject.errors[ 0 ].errorValues[ 0 ];
        }
    }
    const editorInstance = monacoObject.getValue();
    const model = editorInstance.editor.getModels()[ 0 ];
    let errorMarkers = [];

    if( errorObj && errorObj.message ) {
        const errorMessage = errorObj.message;

        const errorPositionMatch = errorMessage.match( /(\d+)(?=(?:(?!").)*$)/g );
        const errorPosition = errorPositionMatch ? parseInt( errorPositionMatch[ errorPositionMatch.length - 1 ], 10 ) : null;

        let charPositionInternalFormula = 0;
        let displayFormulaWithoutError = '';
        if( errorPosition ) {
            // Error position given in serviceData
            for( const element of internalToDisplayFormulaMap ) {
                charPositionInternalFormula += element.key.length;
                if( charPositionInternalFormula === errorPosition || charPositionInternalFormula > errorPosition ||
                    internalToDisplayFormulaMap.indexOf( element ) === internalToDisplayFormulaMap.length - 1 ) {
                    let errorStartIndex;
                    let errorEndIndex;
                    if( charPositionInternalFormula === errorPosition || charPositionInternalFormula > errorPosition ) {
                        // Error in current formula string
                        errorStartIndex = displayFormulaWithoutError.length;
                        errorEndIndex = displayFormulaWithoutError.length + element.value.length;
                    } else {
                        // Error at the end of formula
                        errorStartIndex = displayFormulaWithoutError.length + element.value.length + 1;
                        errorEndIndex = displayFormulaWithoutError.length + element.value.length + 2;
                    }
                    // Convert character position to line and column
                    let errorStartPositionInEditor = model.getPositionAt( errorStartIndex );
                    let errorEndPositionInEditor = model.getPositionAt( errorEndIndex );
                    errorMarkers.push( {
                        startLineNumber: errorStartPositionInEditor.lineNumber,
                        startColumn: errorStartPositionInEditor.column,
                        endLineNumber: errorEndPositionInEditor.lineNumber,
                        endColumn: errorEndPositionInEditor.column,
                        message: errorMessage,
                        severity: editorInstance.MarkerSeverity.Error
                    } );
                    break;
                }
                displayFormulaWithoutError += element.value;
            }
        } else {
            // Error position not given in serviceData
            // Invalid or not configured feature
            if( errorObj.code === 77100 ) {
                const invalidFeatureMatch = errorMessage.split( '"' );
                const invalidFeature = invalidFeatureMatch[ 1 ];
                for( const element of internalToDisplayFormulaMap ) {
                    charPositionInternalFormula += element.key.length;
                    if( invalidFeature === element.key.trim() ) {
                        let errorStartIndex = displayFormulaWithoutError.length;
                        let errorEndIndex = displayFormulaWithoutError.length + element.value.length;

                        // Convert character position to line and column
                        let errorStartPositionInEditor = model.getPositionAt( errorStartIndex );
                        let errorEndPositionInEditor = model.getPositionAt( errorEndIndex );
                        errorMarkers.push( {
                            startLineNumber: errorStartPositionInEditor.lineNumber,
                            startColumn: errorStartPositionInEditor.column,
                            endLineNumber: errorEndPositionInEditor.lineNumber,
                            endColumn: errorEndPositionInEditor.column,
                            message: errorMessage,
                            severity: editorInstance.MarkerSeverity.Error
                        } );
                        break;
                    }
                    displayFormulaWithoutError += element.value;
                }
            }
            // TO DO : Need to have thought on other errors which can't be mapped e.g. Setting a value range for the family "Engine" has failed, because its setting "String" does not support value ranges.
        }
    }

    editorInstance.editor.setModelMarkers( model, 'displayFormulaErrorMarkers', errorMarkers );
    return errorMarkers;
};

/**
 *  Clears all error markers in editor
 * @param { Object } monacoObject - Represents the instance of the editor.
 * @returns {Array } errorMarkers - Empty array of error markers set on monaco editor model
 */
export const removeErrorMarkers = ( monacoObject ) => {
    let errorMarkers = [];
    const editorInstance = monacoObject.getValue();
    // To clear the error markers in the editor set empty error markers on editor model content of the editor:
    let model = editorInstance.editor.getModels()[ 0 ];
    editorInstance.editor.setModelMarkers( model, 'displayFormulaErrorMarkers', errorMarkers );

    return errorMarkers;
};

/**
 * Updates atomic object if formula in editor is made dirty.
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext,isFormulaDirty, useIntellisense
 * @param {String} editorString - Current editor string.
 * @param {String} initialDisplayFormula -Initial display formula.
 * @param {String} initialInternalFormula -Initial display formula.
 */
export const setIsFormulaDirty = ( editorObject, editorString, initialDisplayFormula, initialInternalFormula ) => {
    let clonedEditorObject = { ...editorObject.getValue() };
    let initialEditorString = clonedEditorObject && ( clonedEditorObject.useIntellisense || clonedEditorObject.useIntellisense === undefined ) ? initialDisplayFormula : initialInternalFormula;
    // As monaco editor can not be initialized with empty value it should have at least single space
    initialEditorString = initialEditorString && initialEditorString === '' ? ' ' : initialEditorString;
    if( editorString !== undefined && initialEditorString !== undefined ) {
        clonedEditorObject.isDirtyFormula = editorString !== initialEditorString;
        editorObject.update( clonedEditorObject );
    }
};

/**
 * Changes monaco editors view mode and editor content based on parent's edit cotext
 * @param {Object} data - ViewModel data
 * @param {Object} editorObjectRef Editor properties atomic object e.g. header,editContext,isFormulaDirty, useIntellisense
 * @returns {Object} Object containing editor string, internal
 */
export const handleEditorViewModeAndContent = ( data, editorObjectRef ) => {
    let editContext = editorObjectRef.value.editContext;
    let editorConfig = _.defaultsDeep( {}, data.config );
    editorConfig.options.readOnly = editContext === 'readOnly';
    data.dispatch( { path: 'data.config', value: editorConfig } );
    if( editContext === 'readOnly' && data.suggesterEditContext === 'editing' ) {
        // This case is to handle cancel edits action, restore original formulas
        let initialEditorContent = data.initialDisplayFormula;
        // As monaco editor can not be initialized with empty value it should have at least single space
        initialEditorContent = initialEditorContent && initialEditorContent === '' ? ' ' : initialEditorContent;
        return { editorString: initialEditorContent, internalFormula: data.initialInternalFormula, suggesterEditContext: editContext };
    }
    if( editContext === 'editing' && data.suggesterEditContext === 'readOnly' ) {
        // This case is to handle start edits action, Editing formula will be display formula only if intellisense is on
        let editingFormula = _.get( editorObjectRef, 'value.useIntellisense' ) === false ? data.initialInternalFormula : data.initialDisplayFormula;
        // As monaco editor can not be initialized with empty value it should have at least single space
        editingFormula = editingFormula && editingFormula === '' ? ' ' : editingFormula;
        return { editorString: editingFormula, internalFormula: data.initialInternalFormula, suggesterEditContext: editContext };
    }
    return { editorString: data.editorContent.dbValue, internalFormula: data.internalFormula, suggesterEditContext: editContext };
};

/**
 * Updates atomic object to start check formula syntax action .
 * @param {Object} editorObjectRef Atomic object
 */
export const validateFormulaSyntax = ( editorObjectRef ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    editorObject.syntaxValidationInProgress = true;
    editorObjectRef.update( editorObject );
};

/**
 * Returns perspective model object, If parent view has sent it, it will be used else perspective generated while getting variability data will be used.
 * @param {String} perspectiveUidFromParent perspective uid from parent view
 * @param {String} generatedPerspectiveUid perspective uid from getVariability3 soa response
 * @returns {Object} configPerspective model object
 */
export const getPerspectiveForFormulaSyntaxCheck = ( perspectiveUidFromParent, generatedPerspectiveUid ) => {
    return {
        uid: perspectiveUidFromParent && perspectiveUidFromParent.length > 0 ? perspectiveUidFromParent : generatedPerspectiveUid,
        type: 'Cfg0ConfiguratorPerspective'
    };
};

/**
 * Remove completionProviderHandle from editor instance
 * @param { Object } completionProviderHandle - Represents the instance of the completionProviderHandle registered with tcFormulaLanguage for the monaco editor instance.
 */
export const disposeCompletionProviderHandle = ( completionProviderHandle ) => {
    //It will ensure every time we open formula suggester i.e. monaco editor, only fresh completion provider items are available
    completionProviderHandle.dispose();
};

/**
 * Validate if editor has content.
 * If condition changes, update atomic editor object
 * NOTE: we set a flag into editorObject instead of enforcing update on formula.display
 * This is because any update on formula resets the cursor position in the monaco editor.
 * @param {Object} editorObjectRef editorObject Atomic data
 * @param {String} editorString content string of editor object
 */
export const handleEditorContentFlag = ( editorObjectRef, editorString ) => {
    let editorObject = { ...editorObjectRef.getValue() };
    let newFlagValue = !_.isEmpty( editorString.trim() );
    if( editorObject.editorHasContent !== newFlagValue ) {
        editorObject.editorHasContent = newFlagValue;
        editorObjectRef.update( editorObject );
    }
};

/**
 * Updates editor layout based on internal formula visibility flag.
 * If internal formula is visible add aw-cfg-suggesterInternalFormulaVisible class to editor area and internal formula section else remove it.
 * Internal formula visible:
 *  1. Editor area will resize to 60% of container height
 *  2. Splitter will be visible between editor area and internal formula section
 * Internal formula not visible:
 *  1. Editor area will resize to 100% of container height
 * @param {Boolean} isInternalFormulaVisible Internal formula visibility flag
 */
export const updateEditorLayout = ( isInternalFormulaVisible ) => {
    let formulaSuggesterEditorArea = document.getElementById( 'formulaSuggesterEditorArea' );
    let formulaSuggesterInternalFormulaContainer = document.getElementById( 'formulaSuggesterInternalFormulaContainer' );
    if (formulaSuggesterEditorArea) {
        if (isInternalFormulaVisible) {
            formulaSuggesterEditorArea.classList.add(INTERNAL_FORMULA_VISIBLE_CLASS);
            formulaSuggesterInternalFormulaContainer.classList.add(INTERNAL_FORMULA_VISIBLE_CLASS);
        } else {
            formulaSuggesterEditorArea.classList.remove(INTERNAL_FORMULA_VISIBLE_CLASS);
            formulaSuggesterInternalFormulaContainer.classList.remove(INTERNAL_FORMULA_VISIBLE_CLASS);
        }
    }
};

export default exports = {
    cacheDisplayStrings,
    cachePrimaryBusinessRelevantAttribute,
    cachePreferences,
    cacheVariabilityData,
    initializeEditorProps,
    setTokenizerForTcFormulaLanguage,
    updateInternalFormula,
    updateEditorContent,
    updateFormulaObject,
    updateEditorObjectToClearFormula,
    clearFormulaInSuggester,
    showFormulaSyntaxErrorInEditor,
    changeIntellisenseSettingInSuggester,
    updateIntellisenseSetting,
    removeErrorMarkers,
    setIsFormulaDirty,
    handleEditorViewModeAndContent,
    validateFormulaSyntax,
    getPerspectiveForFormulaSyntaxCheck,
    disposeCompletionProviderHandle,
    handleEditorContentFlag,
    updateEditorLayout
};
