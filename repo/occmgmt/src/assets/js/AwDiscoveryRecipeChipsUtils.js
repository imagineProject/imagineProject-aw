
// Copyright (c) 2021 Siemens

/**
 * @module js/AwDiscoveryRecipeChipsUtils
 */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
var applicableCategoryTypes = [ 'Attribute', 'Partition' ];
import filterRecipeValidationService from 'js/filterRecipeValidationService';
import eventBus from 'js/eventBus';


/**
 * Build master list of chips to display in filter panel
 * @param {*} groupRecipe array of recipe terms
 * @param {*} nSelectedText n selected text
 * @returns {Object} array of chips to display
 */
export let buildRecipeGroupChips = function( groupRecipe ) {
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    let _nSelectedText = localTextBundle.nSelectedLabel;
    let groupChipMap = {};
    if( groupRecipe ) {
        for( var index = 0; index < groupRecipe.length; index++ ) {
            let subCriteriaChips = [];
            for( var subIndex = 0; subIndex < groupRecipe[index].subCriteria.length; subIndex++ ) {
                if( !_.isEmpty( groupRecipe[index].subCriteria[subIndex] ) ) {
                    var parentChip = getGroupParentChip( index, groupRecipe[index].subCriteria[subIndex], _nSelectedText, subIndex, groupRecipe );
                    subCriteriaChips.push( parentChip );
                }
            }
            groupChipMap[index] = subCriteriaChips;
        }
    }
    return groupChipMap;
};


/**
 * Creates the chip that will be added to the master chip list
 * @function createChip
 * @param {Object} chipModel structure with information to create chip
 * @param {*} groupRecipe array of recipe terms
 *
 * chip model needs the following attributes for creating a chip
 *  {Boolean} parent If chip is a parent chip
 *  {Object} numberOfChips if parent chip how many children chips exist
 *  {Object} categoryName name of category
 *  {Object} filterDisplayName display name of filter
 *  {Object} internalCategoryName internal category name
 *  {Object} internalFilterName internal filter name
 *  {Object} filterType type of filter
 *  {Object} childrenChips if parent this is children chips to display in group
 *  {Object} recipeTerm recipe term criteria operator
 *  {Object} recipeTermIndex recipe term index
 *  {Object} tooltip recipe chip tooltip
 *  {Object} groupIndex recipe group index
 * @returns {Object} recipeChip
 */
function createChip( chipModel, groupRecipe ) {
    let displayLabel;
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    let internalFilterName = chipModel.internalFilterName;
    // Add recipe logic
    if ( chipModel.numberOfChips > 1 && chipModel.parent ) {
        displayLabel = chipModel.categoryDisplayName + ': ' + chipModel.numberOfChips + ' ' + localTextBundle.nSelectedLabel;
        internalFilterName = 'parentChip';
    } else {
        if( chipModel.categoryDisplayName !== '' ) {
            displayLabel = chipModel.categoryDisplayName + ': ' + chipModel.filterDisplayName;
        }else{
            displayLabel = chipModel.filterDisplayName;
        }
    }

    if( chipModel.parent && chipModel.recipeTerm.criteriaOperatorType === 'Exclude'  ) {
        displayLabel = localTextBundle.subsetRecipeOperatorNot + ' ' + displayLabel;
    }

    var removeRecipeIcon = 'miscRemoveBreadcrumb';
    // Below code will remove the 'X' button on the last remaining recipe term in the first group when one of the following cases is true
    // Case 1: There are 2 groups and the 2nd group is type 'Exclude'
    // Case 2: Advanced filtering is OFF and we have an additional OR (Select element) group
    // Case 3: Similar to Case 1 - but we have a 2nd OR group that is empty i.e. 1st group with 1 term, 'Exclude' group, 2nd group that is empty
    if( chipModel.groupIndex === 0 && groupRecipe[0].subCriteria.length === 1 && chipModel.childrenChips ) {
        if( groupRecipe.length === 2 && groupRecipe[1].criteriaOperatorType === 'Exclude' || groupRecipe.length > 1 &&
            appCtxSvc.ctx.preferences.AW_Discovery_Advanced_Filter && appCtxSvc.ctx.preferences.AW_Discovery_Advanced_Filter[0] === 'false' ||
                groupRecipe.length === 3 && groupRecipe[2].criteriaOperatorType === 'Exclude' && groupRecipe[1].subCriteria.length === 0 ) {
            removeRecipeIcon = '';
        }
    }

    var indicatorIcon = '';
    if( chipModel.recipeTerm.criteriaType === 'SelectedElement' &&
        chipModel.recipeTerm.criteriaOperatorType === 'Filter'  &&
        chipModel.recipeTerm.criteriaValues[chipModel.recipeTerm.criteriaValues.length - 1] === 'False' ) {
        indicatorIcon = 'indicatorDetection';
    }

    let tooltipValue = '';
    if( chipModel.parent ) {
        tooltipValue = chipModel.tooltip;
    }

    let recipeChip = {
        iconId: indicatorIcon,
        uiIconId: removeRecipeIcon,
        chipType: 'BUTTON',
        selected: false,
        labelDisplayName: displayLabel,
        labelInternalCategoryName: chipModel.internalCategoryName,
        labelInternalFilterName: internalFilterName,
        chipFilterType: chipModel.filterType,
        recipeTerm: chipModel.recipeTerm,
        recipeTermIndex: chipModel.recipeTermIndex,
        groupIndex: chipModel.groupIndex,
        tooltip: tooltipValue,
        className: 'aw-search-breadcrumb-chip'
    };

    if ( chipModel.childrenChips && chipModel.childrenChips.length > 1 ) {
        recipeChip.children = chipModel.childrenChips;
    }

    return recipeChip;
}


/**
 * Remove selected chip from current list of displayed or overflow chips
 * @param {*} recipeObject recipeObject
 * @param {*} chipToRemove selected chip to remove
 */
export let removeSelectedChip = function( recipeObject, chipToRemove, sharedData ) {
    var groupIndex = chipToRemove.groupIndex;
    var subCriteriaIndex; var selectedValue;
    if ( chipToRemove.subCriteriaIndex !== undefined ) {
        subCriteriaIndex = chipToRemove.subCriteriaIndex;
        selectedValue = chipToRemove.labelDisplayName;
    }
    // Get the recipe criteria present in the relevant group, get the updated criteria, then replace it
    var existingRecipeGroups = _.cloneDeep( recipeObject.recipeGroup );
    var existingRecipeCriteria = existingRecipeGroups[groupIndex].subCriteria;
    var updatedRecipeCriteria = filterRecipeValidationService.updateRecipeCriteriaList( existingRecipeCriteria, chipToRemove.recipeTerm, chipToRemove.recipeTermIndex, selectedValue, subCriteriaIndex );
    existingRecipeGroups[groupIndex].subCriteria = updatedRecipeCriteria.updatedRecipes;

    // If this is the last recipe being removed from the group, clear the group
    if( existingRecipeGroups[groupIndex].subCriteria.length === 1 && existingRecipeGroups[groupIndex].subCriteria[0].criteriaOperatorType === 'Clear' ) {
        if ( existingRecipeGroups.length === 1 ) {
            existingRecipeGroups[0].criteriaOperatorType = 'Clear';
        } else {
            if( existingRecipeGroups[groupIndex].criteriaOperatorType === 'Exclude' ) {
                const newSharedData = { ...sharedData.getValue() };
                newSharedData.enableNotGroup = true;
                sharedData.update && sharedData.update( newSharedData );
            }
            existingRecipeGroups.splice( groupIndex, 1 );
        }
    }

    var updatedRecipe = {
        updatedRecipes: existingRecipeGroups,
        deletedRecipe: updatedRecipeCriteria.deletedRecipe,
        groupIndex: groupIndex
    };
    eventBus.publish( 'occmgmt.recipeUpdated', {
        updatedRecipe
    } );
};

/**
 * This method will extract all the attributes from the recipe display name and return
 * them as an array.
 *
 * @param {String} recipeDisplayName : Display Name for the recipe.
 * @return {String[]} : returns an array of Strings that contain the multiple attributes
 *         in the recipe.
 */
let getAllAttrFromRecipeTerm = function( recipeDisplayName ) {
    return recipeDisplayName.split( '_$PROP_' );
};

/**
 * This method format Multi-Attribute recipe term to display on UI
 * Input string : "Logical Designator_$CAT_AAAA0*_$PROP_Name_$CAT_DE* "
 * formatted as  : "Logical Designator: AAAA0, Name: DE*
 *
 * @param {String} recipeDisplayName : Display Name for the recipe.
 * @return {String} : returns Strings for multiple attributes recipe term.
 */
let getMultiAttributeRecipeTerm = function( recipeDisplayName ) {
    var recipeDisplayString = recipeDisplayName.replace( /_\$PROP_/g, ', ' );
    recipeDisplayString = recipeDisplayString.replace( /_\$CAT_/g, ': ' );

    return recipeDisplayString;
};

/**
 * This method will extract the value for the input recipe criteria. For e.g., a
 * partition name is a value for a physical partition type.
 *
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @return {String} : The recipe value for the input recipe criteria.
 */
let getRecipeValue = function( recipeDisplayName ) {
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    var value = recipeDisplayName.split( '_$CAT_' );
    if( !_.isEmpty( value[1] ) && value[1].indexOf( '_$RANGE_' ) >= 0 ) {
        let recipeValue = '';
        let rangeValues = value[ 1 ].split(  filterSeparator );
        const localTextBundle = localeService.getLoadedText( 'CalendarManagementMessages' );
        for( let i = 0; i < rangeValues.length; ++i ) {
            if( i > 0 ) {
                recipeValue += filterSeparator;
            }
            let  range = rangeValues[i].split( '_$RANGE_' );
            if( _.isEmpty( range[0] ) && !_.isEmpty( range[1] ) ) {
                recipeValue += localTextBundle.to + ' ' + range[1];
            }else if( !_.isEmpty( range[0] ) && _.isEmpty( range[1] ) ) {
                recipeValue += localTextBundle.from + ' ' + range[0];
            }else{
                recipeValue +=  rangeValues[i].replaceAll( '_$RANGE_', ' - ' );
            }
        }
        return recipeValue;
    }
    return value[1];
};

/**
 * This function will extract all selected terms in the input recipe criteria and return
 * them as an array.
 *
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @return {String[]} : An array of all selected terms in the input recipe criteria.
 */
let selectedTerms = function( recipeDisplayName ) {
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    let recipeValuesString = getRecipeValue( recipeDisplayName );
    let allSelectedTerms = {};
    if( recipeValuesString ) {
        allSelectedTerms = recipeValuesString.split( filterSeparator );
    }
    return allSelectedTerms;
};

/**
 * This function will return the proximity recipe label as Within <distance><UOM> of <n> Selected
 * eg
 * input stream Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 * output       Within 0.001 m of 2 Selected
 * @param {String}  recipeDisplayName : Recipe Criteria Display Name
 * @return {String}  proximity n selected label
 */
let getProximityNSelectedLabel = function( recipeDisplayName ) {
    let temp = recipeDisplayName;
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    let selections = [];
    selections = temp.split( filterSeparator );
    let splitRecipeDisplay = temp.split( ' ' );
    let distanceString = splitRecipeDisplay[1].concat( ' ' ).concat( splitRecipeDisplay[2] );
    let resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    return resource.proximityDisplayValue.format( distanceString, selections.length );
};

/**
* Function to get the tooltip for the recipe term
*
* @param {String} recipeItem  Recipe term to display
* @return {String} Tooltip for the recipe term
*/
export let getTooltip = function( recipeItem ) {
    var strTooltip =  getRecipeLabel( recipeItem, recipeItem.criteriaDisplayValue, true );
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    if( selectedTerms( recipeItem.criteriaDisplayValue ).length <= 1 ) {
        // Single select term
        if( strTooltip !== '' ) {
            strTooltip += ': ';
        }
        var recipeValue = getRecipeValue( recipeItem.criteriaDisplayValue );
        strTooltip += recipeValue;
    } else if( selectedTerms( recipeItem.criteriaDisplayValue ).length > 1 ) {
        // N selected
        if( strTooltip !== '' ) {
            strTooltip += ': ';
        }
        var formattedTooltipValue = getRecipeValue( recipeItem.criteriaDisplayValue ).replaceAll( filterSeparator, ',\n' );
        strTooltip += formattedTooltipValue;
    } else if( recipeItem.criteriaType === 'BoxZone' || recipeItem.criteriaType === 'PlaneZone' ) {
        strTooltip = recipeItem.criteriaDisplayValue.replace( /\"/g, '"' );
    }
    return strTooltip;
};


/**
 * This method will extract the Label for the input recipe criteria. For e.g., a
 * partition Scheme Name is a Label for a selected physical partition type.
 * For Proximity if isProximityTitle is true:
 *   input stream :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *   output       :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK
 *                 POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *
 * For Proximity if isProximityTitle is false:
 *      input stream :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *      output       :Within 0.001 m of 2 Selected
 *
 * @param {String} recipeItem : Recipe term to display
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @param {Boolean} isProximityTitle Optional :Is used to implement the title/extended tooltip for proximity
 * @return {String} : The recipe Label for the input recipe criteria.
 */
let getRecipeLabel = function( recipeItem, recipeDisplayName, isProximityTitle ) {
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    if ( recipeItem.criteriaType === 'Proximity' ) {
        if ( recipeDisplayName.indexOf( filterSeparator ) > 0 ) {
            if( isProximityTitle ) {
                let pos = recipeDisplayName.indexOf( ' ' );
                for( let i = 1; i < 4; i++ ) {
                    pos = recipeDisplayName.indexOf( ' ', pos + 1 );
                }

                let selectionString = recipeDisplayName.substring( pos + 1 );
                let splitRecipeDisplay = recipeDisplayName.split( ' ' );
                let tooltip = localTextBundle.proximityTitle + ': ' + localTextBundle.proximityDisplayString.format( splitRecipeDisplay[1], splitRecipeDisplay[2], selectionString );
                return tooltip.replaceAll( filterSeparator, ',\n' );
            }

            recipeDisplayName = getProximityNSelectedLabel( recipeDisplayName );
        }
        return localTextBundle.proximityTitle + ': ' + recipeDisplayName;
    }
    if ( recipeItem.criteriaType === 'SelectedElement' ) {
        var elementDisplayString = recipeDisplayName.split( '_$CAT_' )[0];
        if ( elementDisplayString.length === 0 ) {
            return localTextBundle.selectedElementDisplayString;
        }
    }


    return recipeDisplayName.split( '_$CAT_' )[0];
};

/**
 * Returns a parent chip to build chips for addition to the display chips array
 * @function getGroupParentChip
 * @param {Integer} groupIndex index of group
 * @param {Object} recipeTerm recipe term
 * @param {String} nSelectedText n selected text
 * @param {Boolean} recipeTermIndex recipe term index
 * @param {*} groupRecipe array of recipe terms
 * @returns {Object} parentChip
 */
function getGroupParentChip( groupIndex, recipeTerm, nSelectedText, recipeTermIndex, groupRecipe ) {
    let childrenChips = [];
    let chipModel = {};

    //Create initial chip. If multiple of same category exist create child chip
    chipModel.numberOfChips = recipeTerm.criteriaDisplayValue.split( '_$PROP_' ).length;
    chipModel.internalCategoryName = recipeTerm.criteriaValues[0];
    chipModel.filterType = recipeTerm.criteriaType;
    chipModel.recipeTermIndex = recipeTermIndex;
    chipModel.recipeTerm = recipeTerm;
    chipModel.groupIndex = groupIndex;

    let nSelectedTerms = selectedTerms( recipeTerm.criteriaDisplayValue );
    let recipeTermDisplayName = '';
    let categoryName = '';

    if( recipeTerm.criteriaType === 'Group' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    } else if( recipeTerm.criteriaType === 'Proximity' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue, false );
    } else if ( chipModel.numberOfChips > 1 && applicableCategoryTypes.includes( recipeTerm.criteriaType )  ) {
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
        recipeTermDisplayName = getMultiAttributeRecipeTerm( recipeTerm.criteriaDisplayValue );
        let allAttrFromRecipeTerm = getAllAttrFromRecipeTerm( recipeTerm.criteriaDisplayValue );
        let allAttrLabels = {};
        let allAttrValues = {};

        for( let j = 0; j < allAttrFromRecipeTerm.length; ++j ) {
            allAttrLabels[allAttrFromRecipeTerm[j]] = getRecipeLabel( recipeTerm, allAttrFromRecipeTerm[j] );
            allAttrValues[allAttrFromRecipeTerm[j]] = getRecipeValue(  allAttrFromRecipeTerm[j] );
            chipModel.parent = false;
            chipModel.categoryDisplayName = allAttrLabels[allAttrFromRecipeTerm[j]];
            chipModel.filterDisplayName = allAttrValues[allAttrFromRecipeTerm[j]];
            chipModel.internalFilterName = recipeTerm.criteriaValues[j + 1];

            let chipChild = createChip( chipModel, groupRecipe );
            chipChild.groupIndex = groupIndex;
            childrenChips.push( chipChild );
        }
    }else if( nSelectedTerms.length > 1 ) {
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
        recipeTermDisplayName = nSelectedTerms.length +  ' '  + nSelectedText;
        for( let subCriteriaIndex = 0; subCriteriaIndex < nSelectedTerms.length; ++subCriteriaIndex ) {
            chipModel.parent = false;
            chipModel.categoryDisplayName = '';
            chipModel.filterDisplayName = nSelectedTerms[subCriteriaIndex];
            chipModel.internalFilterName = recipeTerm.criteriaValues[subCriteriaIndex + 1];

            let chipChild = createChip( chipModel, groupRecipe );
            chipChild.subCriteriaIndex = subCriteriaIndex;
            chipChild.groupIndex = groupIndex;
            childrenChips.push( chipChild );
        }
    }
    chipModel.parent = true;
    if( recipeTerm.criteriaType !== 'Group' && recipeTerm.criteriaType !== 'Proximity' && nSelectedTerms.length === 1 ) {
        recipeTermDisplayName = getRecipeValue( recipeTerm.criteriaDisplayValue );
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    }
    if( recipeTermDisplayName === '' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    }

    chipModel.internalFilterName = recipeTerm.criteriaValues[1];
    chipModel.filterDisplayName = recipeTermDisplayName;
    chipModel.categoryDisplayName = categoryName;
    chipModel.childrenChips = childrenChips;
    chipModel.tooltip = getTooltip( recipeTerm );
    let parentChip = createChip( chipModel, groupRecipe );
    parentChip.groupIndex = groupIndex;
    return parentChip;
}


export default {
    buildRecipeGroupChips,
    removeSelectedChip
};
