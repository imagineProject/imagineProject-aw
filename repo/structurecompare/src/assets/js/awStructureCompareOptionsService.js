// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareOptionsService
 */
import localeSvc from 'js/localeService';
import _ from 'lodash';

var exports = {};

function _getDisplayValueFromInternalValue( propInternalVal ) {
    let localeTextBundle = localeSvc.getLoadedText( 'StructureCompareConstants' );
    let propDisplayVal = '';
    if( propInternalVal === 1 ) {
        propDisplayVal = localeTextBundle.SingleLevelCompare;
    } else if( propInternalVal === -4 ) {
        propDisplayVal = localeTextBundle.ComponentLevelCompare;
    } else if( propInternalVal === -1 ) {
        propDisplayVal = localeTextBundle.MultiLevelCompare;
    } else if( propInternalVal === -3 ) {
        propDisplayVal = localeTextBundle.LinkedAssemblyLevelCompare;
    }  else if( propInternalVal === -5 ) {
        propDisplayVal = localeTextBundle.MultiLevelBelowSelectionCompare;
    }
    return propDisplayVal;
}

/** Export APIs */
export let setInitialCompareOption = function( compareOption, depth ) {
    let optionDisplayVal;
    if( depth ) {
        optionDisplayVal = _getDisplayValueFromInternalValue( depth );
    }
    let compareOptionCopy = { ...compareOption };
    compareOptionCopy.uiValue = optionDisplayVal;
    compareOptionCopy.dbValue = depth;
    return compareOptionCopy;
};

function _getCompareListFromResponse( options ) {
    let compareOptionList = [];
    for( let ix = 0; ix < options.length; ix++ ) {
        let internalVal = parseInt( options[ ix ] );
        let option = {
            propInternalValue: internalVal,
            propDisplayValue: _getDisplayValueFromInternalValue( internalVal )
        };
        compareOptionList.push( option );
    }
    //Sort them alphabetically
    if( compareOptionList.length > 1 ) {
        compareOptionList.sort( function compare( option1, option2 ) {
            if( option1.propDisplayValue < option2.propDisplayValue ) {
                return -1;
            } else if( option1.propDisplayValue > option2.propDisplayValue ) {
                return 1;
            }
            return 0;
        } );
    }

    return compareOptionList;
}

export let toggleMultipleMatchOptionBasedOnPartitionScheme = ( isPartitionSchemeApplied, compareContext ) => {
    const newCompareContext = {  ...compareContext.value  };
    let displayOptionsList = { ...newCompareContext.displayOptions };
    // If Partition Scheme is applied and 'MULTIPLE_MATCH' is present in the display options, then we remove it
    // Else, if parition scheme is not applied and the display options doesn't contain 'MULTIPLE_MATCH', then we add it to display options.
    // NOTE: This function will only get triggerd after successful configuration change.
    let isValueChanged = false;
    if ( isPartitionSchemeApplied && displayOptionsList !== undefined && displayOptionsList.MatchType !== undefined && displayOptionsList.MatchType.MULTIPLE_MATCH !== undefined ) {
        displayOptionsList.MatchType = _.omit( newCompareContext.displayOptions.MatchType, [ 'MULTIPLE_MATCH' ] );
        newCompareContext.displayOptions = displayOptionsList;
        isValueChanged = true;
    } else if ( !isPartitionSchemeApplied && displayOptionsList !== undefined && displayOptionsList.MatchType !== undefined && displayOptionsList.MatchType.MULTIPLE_MATCH === undefined ) {
        displayOptionsList.MatchType.MULTIPLE_MATCH = true;
        newCompareContext.displayOptions = displayOptionsList;
        isValueChanged = true;
    }
    if( isValueChanged ) {
        compareContext.update( newCompareContext );
    }
};

export let getCompareOptionsList = ( soaResponse, data, compareContext ) => {
    if( soaResponse ) {
        let compareOptionsList = [];
        //for invalid combinations of objects the soa response might
        if( soaResponse.compareOptions !== undefined ) {
            let options = soaResponse.compareOptions.filteringRule;
            compareOptionsList = _getCompareListFromResponse( options );

            // If Linked Assembly Level (dbValue=-3) is in the list, then license check was positive
            if( compareOptionsList.find( option => option.propInternalValue === -3 ) ) {
                data.dispatch( { path: 'data.isLicensePresent', value: true } );
            }
        }
        const newCompareContext = _.cloneDeep( compareContext.value );
        newCompareContext.compareOptions = compareOptionsList;
        // Update the value of depth on compareContext if the current value is not available in compareOptionsList
        if( compareOptionsList.length > 0 ) {
            let found = false;
            for( let i = 0; i < compareOptionsList.length; i++ ) {
                if( compareContext.depth === compareOptionsList[i].propInternalValue ) {
                    found = true;
                    break;
                }
            }
            if( !found ) {
                newCompareContext.depth = compareOptionsList[0].propInternalValue;
            }
        }
        compareContext.update( newCompareContext );
        return compareOptionsList;
    }
    return null;
};

export let updateEquivalenceTypes = function( property, compareContext ) {
    let newCompareContext = _.cloneDeep( compareContext.value );
    if( property.dbValue ) {
        if( newCompareContext.displayOptions && newCompareContext.displayOptions.Equivalence ) {
            newCompareContext.displayOptions.Equivalence[ property.propertyName ] = true;
            compareContext.update( newCompareContext );
        } else {
            newCompareContext.displayOptions = {};
            newCompareContext.displayOptions.Equivalence = {};
            newCompareContext.displayOptions.Equivalence[ property.propertyName ] = true;
            compareContext.update( newCompareContext );
        }
    } else {
        if( newCompareContext.displayOptions && newCompareContext.displayOptions.Equivalence ) {
            newCompareContext.displayOptions.Equivalence = _.omit( newCompareContext.displayOptions.Equivalence, [ property.propertyName ] );
            compareContext.update( newCompareContext );
        }
    }
};

export let updateMatchTypes = function( property, compareContext ) {
    let newCompareContext = { ...compareContext.value };
    if( property.dbValue ) {
        if( newCompareContext.displayOptions && newCompareContext.displayOptions.MatchType ) {
            newCompareContext.displayOptions.MatchType[ property.propertyName ] = true;
            compareContext.update( newCompareContext );
        } else {
            newCompareContext.displayOptions = {};
            newCompareContext.displayOptions.MatchType = {};
            newCompareContext.displayOptions.MatchType[ property.propertyName ] = true;
            compareContext.update( newCompareContext );
        }
    } else {
        if( newCompareContext.displayOptions && newCompareContext.displayOptions.MatchType ) {
            newCompareContext.displayOptions.MatchType = _.omit( newCompareContext.displayOptions.MatchType, [ property.propertyName ] );
            compareContext.update( newCompareContext );
        }
    }
};

export let updatedbValue = function( input ) {
    return Boolean( input );
};

export let resetBackgroundOption = ( backgroundOption ) => {
    const backgroundOptionCopy = { ...backgroundOption };
    backgroundOptionCopy.dbValue = false;
    return backgroundOptionCopy;
};

export default exports = {
    setInitialCompareOption,
    updateEquivalenceTypes,
    updateMatchTypes,
    updatedbValue,
    toggleMultipleMatchOptionBasedOnPartitionScheme,
    getCompareOptionsList,
    resetBackgroundOption
};
