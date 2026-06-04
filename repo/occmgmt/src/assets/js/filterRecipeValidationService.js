// Copyright (c) 2022 Siemens

/**
 * Service for managing filter and subset recipes.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 *
 * @module js/filterRecipeValidationService
 */
import _ from 'lodash';
import localeSvc from 'js/localeService';
import appCtxSvc from 'js/appCtxService';

/**
 * References to services.
 */

var exports = {};

/**
 * Return the Parent recipe term if it is in a group
 * @param {Object} recipe - recipe object
 * @param {Object} recipeItem -  recipe item to find
 * @param {Object} indexes - list of indexes
 * @return {Object} parent group recipe
 */
var findParentGroup = function( recipe, recipeItem, indexes ) {
    var parentGroup;
    if( indexes ) {
        parentGroup = recipe[ indexes[ 0 ] ];
        indexes.shift();
        if( indexes.length !== 0 ) {
            parentGroup = findParentGroup( parentGroup.subCriteria, recipeItem, indexes );
        }
    }
    return parentGroup;
};

/**
 * Clear the operator on each of the recipe term in the hierarchy if the recipe item is the only term in group
 * hierarchy.
 * @param {Object} recipe - recipe object
 * @param {Object} indexes - list of indexes
 */
var clearGroupHierarchy = function( recipe, indexes ) {
    if( indexes ) {
        var parentGroup = recipe[ indexes[ 0 ] ];
        parentGroup.criteriaOperatorType = 'Clear';
        indexes.shift();
        if( indexes.length !== 0 ) {
            parentGroup = clearGroupHierarchy( parentGroup.subCriteria, indexes );
        }
    }
};

/**
 * Find if in the group hierarchy that the recipe is being deleted, it is the only term
 * @param {Object} recipe recipe object
 * @param {Object} indexes list of indexes
 * @param {boolean} onlyTerm true if only term in group
 * @return {boolean} returns true if only term in group
 */
var findIfOnlyTermInGroupHierarchy = function( recipe, indexes, onlyTerm ) {
    if( indexes ) {
        var parentGroup = recipe[ indexes[ 0 ] ];
        indexes.shift();
        if( parentGroup.subCriteria.length !== 1 ) {
            onlyTerm = false;
        }
        if( indexes.length !== 0 && onlyTerm ) {
            onlyTerm = findIfOnlyTermInGroupHierarchy( parentGroup.subCriteria, indexes, onlyTerm );
        }
    }
    return onlyTerm;
};

/**
 * This method will modify selected recipe term's operator and update existing recipe object.
 *
 * @param {object} existingRecipe : existingRecipe to be updated
 * @param {object} recipeItem : recipeItem to be deleted
 * @param {object} pathToItem : The index for the recipe term to be deleted
 * @param {String} selectedValue : selectedValue in case of deletion from selected recipe term
 * @param {String} subCriteriaIndex : index of the selectedValue within the multi valued recipe term
 * @return {object} updated recipe
 */

export let updateRecipeCriteriaList = function( existingRecipe, recipeItem, pathToItem, selectedValue, subCriteriaIndex ) {
    var recipe =  existingRecipe;
    var deletedRecipe = _.cloneDeep( recipeItem );
    var recipeTermToModify2;
    var inGroup = false;
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    if( typeof pathToItem !== 'string' ) {
        pathToItem = JSON.stringify( pathToItem );
    }

    var indexes = pathToItem.split( '.' );
    if( indexes.length > 1 ) {
        inGroup = true;
    }
    var recipeIndex = indexes.pop();
    var copyOfIndexes;
    var parentGroup;
    if( inGroup ) {
        // find the parent group
        // make a copy since we do not want the original input to be changed
        copyOfIndexes = indexes.slice();
        parentGroup = findParentGroup( recipe, recipeItem, copyOfIndexes );
        if( parentGroup ) {
            recipeTermToModify2 = parentGroup.subCriteria[ recipeIndex ];
        }
    } else {
        recipeTermToModify2 = recipe[ recipeIndex ];
    }
    if( recipeTermToModify2 ) {
        if( selectedValue ) {
            // modify criteriaValues array
            // A value in the Recipe Term is deleted
            var selectedCriteriaValues = recipeTermToModify2.criteriaDisplayValue.split( '_$CAT_' )[ 1 ];
            var recipeIndexToBeRemoved;
            // If selectedValue is within the multi valued recipe term delete at the specified index
            if ( subCriteriaIndex !== undefined ) {
                var displayNameCategory = recipeTermToModify2.criteriaDisplayValue.split( '_$CAT_' )[ 0 ];
                recipeIndexToBeRemoved = subCriteriaIndex;
                if ( recipeTermToModify2.criteriaType === 'SelectedElement' ) {
                    recipeTermToModify2.criteriaValues.splice( recipeIndexToBeRemoved, 1 );
                } else {
                    if( recipeTermToModify2.criteriaValues[1].includes( '_$WCARD_' ) ) {
                        let wildcardOperator = recipeTermToModify2.criteriaValues[1].split( '_$WCARD_' )[ 0 ];
                        let criteriaValues = recipeTermToModify2.criteriaValues[1].split( '_$WCARD_' )[ 1 ];
                        let criteriaValueList = criteriaValues.split( filterSeparator );
                        criteriaValueList.splice( recipeIndexToBeRemoved, 1 );
                        let updatedCriteriaValues = criteriaValueList[0];
                        for( let i = 1; i < criteriaValueList.length; i++ ) {
                            updatedCriteriaValues += filterSeparator + criteriaValueList[i];
                        }
                        recipeTermToModify2.criteriaValues[1] = wildcardOperator + '_$WCARD_' + updatedCriteriaValues;
                    } else {
                        recipeTermToModify2.criteriaValues.splice( recipeIndexToBeRemoved + 1, 1 );
                    }
                }
                // modify criteriaDisplayValue
                var criteriaDisplayValues = selectedCriteriaValues.split( filterSeparator );
                criteriaDisplayValues.splice( recipeIndexToBeRemoved,  1 );
                var displayValue = '';
                for( var i = 0; i < criteriaDisplayValues.length; i++ ) {
                    displayValue = displayValue.concat( criteriaDisplayValues[ i ] );
                    if ( i !== criteriaDisplayValues.length - 1 ) {
                        displayValue = displayValue.concat( filterSeparator );
                    }
                }
                recipeTermToModify2.criteriaDisplayValue = displayNameCategory + '_$CAT_' + displayValue;
            } else {
                recipeIndexToBeRemoved = selectedCriteriaValues ? selectedCriteriaValues.split( filterSeparator ).indexOf( selectedValue ) : -1;
                if( recipeIndexToBeRemoved !== -1 ) {
                    recipeTermToModify2.criteriaValues.splice( recipeIndexToBeRemoved + 1, 1 );

                    // modify criteriaDisplayValue
                    if( recipeTermToModify2.criteriaDisplayValue.includes( filterSeparator + selectedValue ) ) {
                        recipeTermToModify2.criteriaDisplayValue = recipeTermToModify2.criteriaDisplayValue.replace( filterSeparator +
                            selectedValue, '' );
                    } else if( recipeTermToModify2.criteriaDisplayValue.includes( selectedValue + filterSeparator ) ) {
                        recipeTermToModify2.criteriaDisplayValue = recipeTermToModify2.criteriaDisplayValue.replace(
                            selectedValue + filterSeparator, '' );
                    }
                }
            }
        } else {
            if( inGroup ) {
                var onlyTerm = true;
                copyOfIndexes = indexes.slice();
                onlyTerm = findIfOnlyTermInGroupHierarchy( recipe, copyOfIndexes, onlyTerm );
                if( onlyTerm ) {
                    copyOfIndexes = indexes.slice();
                    clearGroupHierarchy( recipe, copyOfIndexes );
                    recipeTermToModify2.criteriaOperatorType = 'Clear';
                } else {
                    parentGroup.subCriteria.splice( recipeIndex, 1 );
                }
            } else {
                // The Recipe Term is deleted
                if( recipe.length === 1 ) {
                    recipe[ 0 ].criteriaOperatorType = 'Clear';
                } else {
                    recipe.splice( recipeIndex, 1 );
                }
            }
        }
    }
    return {
        updatedRecipes: recipe,
        deletedRecipe: deletedRecipe
    };
};

/**
 * This function will extract the recipe term from the "appCtx.occmgmgtContext.recipe" object based on the index
 * provided to this function.
 *
 * @param {object} existingRecipe existingRecipe to be updated
 * @param {int} index the index for the recipe term.
 * @return {object} recipe term
 */
export let getRecipeTermFromIdx = function( existingRecipe, index ) {
    if( typeof index !== 'string' ) {
        index = JSON.stringify( index );
    }
    var recipeTerm;
    if( existingRecipe ) {
        //determine from the index, whether we need to traverse the recipe term inside a group.
        var indices = index.split( '.' );
        recipeTerm = existingRecipe[ indices[ 0 ] ];

        //iterate from the group index onwards.
        for( var i = 1; i < indices.length; i++ ) {
            if( recipeTerm.criteriaType === 'Group' ) {
                //we need to traverse to the group term indicated by the index.
                recipeTerm = recipeTerm.subCriteria[ indices[ i ] ];
            }
        }
    }
    return recipeTerm;
};

/**
 * This method will modify selected recipe term's operator and update existing recipe object.
 *
 * @param {object} existingRecipe existingRecipe to be updated
 * @param {object} index The index for the proximity recipe term this method will update.
 * @param {String} newOperatorType The new OperatorType to be updated the recipe with
 * @return {object} returns updated recipe list
 */

export let updateRecipeTermOperator = function( existingRecipe, index, newOperatorType ) {
    var selectedRecipeTerm = this.getRecipeTermFromIdx( existingRecipe, index );
    selectedRecipeTerm.criteriaOperatorType = newOperatorType;
    return existingRecipe;
};

/**
 * This method will set the new proximity value for the selected recipe term in the
 * recipe object.
 *
 * @param {object} existingRecipe existingRecipe to be updated
 * @param {object} index The index for the proximity recipe term this method will update.
 * @param {String} newProxValue The new proximity value to be updated the recipe with
 * @return {object} returns updated recipe list
 */
export let setProximityValueToRecipe = function( existingRecipe, index, newProxValue ) {
    var proxRecipeTerm = this.getRecipeTermFromIdx( existingRecipe, index );
    var values = proxRecipeTerm.criteriaValues;
    values[ values.length - 1 ] = newProxValue;
    return existingRecipe;
};

/**
 * This method will set the new proximity display string for the selected recipe term
 *
 * @param {object} existingRecipe existingRecipe to be updated
 * @param {object} index The index for the proximity recipe term this method will update.
 * @param {String} newProxValue The new proximity value to be updated the recipe with
 * @return {object} returns updated recipe list
 */
export let setProximityDisplayStringToRecipe = function( existingRecipe, index, newProxValue ) {
    var proxRecipeTerm = this.getRecipeTermFromIdx( existingRecipe, index );
    var displayString = proxRecipeTerm.criteriaDisplayValue;
    var oldProxValue = displayString.split( ' ' )[ 1 ];
    displayString = displayString.replace( oldProxValue, newProxValue );
    proxRecipeTerm.criteriaDisplayValue = displayString;
    return existingRecipe;
};

export default exports = {
    updateRecipeCriteriaList,
    getRecipeTermFromIdx,
    updateRecipeTermOperator,
    setProximityValueToRecipe,
    setProximityDisplayStringToRecipe
};
