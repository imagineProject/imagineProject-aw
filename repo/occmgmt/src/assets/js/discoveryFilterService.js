/* eslint-disable complexity */
/* eslint-disable max-lines */


// Copyright (c) 2022 Siemens

/**
 * @module js/discoveryFilterService
 */
import appCtxSvc from 'js/appCtxService';
import filterPanelService from 'js/filterPanelService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdm from 'soa/kernel/clientDataModel';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import searchFilterService from 'js/aw.searchFilter.service';
import filterPanelUtils from 'js/filterPanelUtils';
import filterPanelCommonUtils from 'js/filterPanelCommonUtils';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import createWorksetService from 'js/createWorksetService';
import searchCommonUtils from 'js/searchCommonUtils';
import proximityFilterService from 'js/proximityFilterService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import recipeHandler from 'js/recipeHandler';
import dateTimeService from 'js/dateTimeService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import localeService from 'js/localeService';

var exports = {};

var pciToFilterDataMap = [];
var pciToTransientRecipesMap = [];
var pciToCategoryLogicMap = [];
var pciToWildcardListMap = [];
var _TRUE = [ 'true' ];
var applicableCategoryTypes = [ 'Attribute', 'Partition' ];
var discoveryFilterEventSubscriptions = [];
var _resetInitiated = false;

// Event Listeners
var _onDiscoveryFilterPanelCloseListener = null;

// Product context key string
var _contextKey = null;

let gatherAllFilterValuesAcrossCategories = function( categories ) {
    let filterValues = [];
    _.forEach( categories, function( category ) {
        _.forEach( category.filterValues, function( filterValue ) {
            filterValues.push( filterValue );
        } );
    } );
    return filterValues;
};

let isFilterSelected = function( filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    if( appCtxSvc.ctx.state.params.filter ) {
        let isSelected = false;
        let appliedFilters = appCtxSvc.ctx.state.params.filter.split( '~' );
        for( let filterId = 0; filterId < appliedFilters.length; filterId++ ) {
            let categories = appliedFilters[ filterId ].split( '==' );
            if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
                isSelected = categories[ 1 ].split( filterSeparator ).includes( filterValue.internalName );
                break;
            }
        }
        return isSelected;
    }
};

let removeFromFilterValuesIfItDoesNotContain = function( filterValues, filterValue, whatToCheck, orphanDateEntries ) {
    let entry = filterValues.filter( function( x ) {
        return x.categoryName === whatToCheck;
    } );
    if( !entry || !entry[ 0 ] ) {
        filterValues.splice( filterValues.indexOf( filterValue ), 1 );
        orphanDateEntries.push( filterValue );
    }
};

let removeOrphanDateEntries = function( filterValues ) {
    let orphanDateEntries = [];
    let isDateFilter = filterValues.filter( function( filter ) {
        return filter.type === filterPanelUtils.DATE_FILTER ||
              filter.type === filterPanelUtils.DATE_DRILLDOWN_FILTER;
    } );
    if( isDateFilter ) {
        for( let i = 0; i < isDateFilter.length; i++ ) {
            let tmpCategoryName = isDateFilter[ i ].categoryName.substring( 0, isDateFilter[ i ].categoryName
                .indexOf( '_0Z0_' ) );
            if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month_day' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_week', orphanDateEntries );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_year', orphanDateEntries );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_week' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_year_month', orphanDateEntries );
            }
        }
    }
    return orphanDateEntries;
};

let getRecipesIfItContains = function( updatedRecipes, whatToCheck, orphanDateEntries ) {
    for( let recipe in updatedRecipes ) {
        for( let subCrit in updatedRecipes[ recipe ].subCriteria ) {
            let tmpCategoryName = updatedRecipes[ recipe ].subCriteria[subCrit].criteriaValues[ 0 ].substring( 0, updatedRecipes[ recipe ].subCriteria[subCrit].criteriaValues[ 0 ].indexOf( '_0Z0_' ) );
            if( tmpCategoryName ) {
                for( let i = 0; i < whatToCheck.length; i++ ) {
                    let orphanDate = tmpCategoryName + whatToCheck[ i ];
                    if( updatedRecipes[ recipe ].subCriteria[subCrit].criteriaValues[ 0 ].includes( orphanDate ) ) {
                        orphanDateEntries.push( updatedRecipes[ recipe ].subCriteria[subCrit] );
                        break;
                    }
                }
            }
        }
    }
};

let getOrphanDateRecipesOnDelete = function( deletedRecipe, updatedRecipes ) {
    let orphanDateEntries = [];
    let tmpCategoryName = deletedRecipe.criteriaValues[ 0 ].substring( 0, deletedRecipe.criteriaValues[ 0 ].indexOf( '_0Z0_' ) );
    if( tmpCategoryName ) {
        let orphanDatesForYear = [ '_0Z0_year_month', '_0Z0_week', '_0Z0_year_month_day' ];
        let orphanDatesForMonth = [ '_0Z0_week', '_0Z0_year_month_day' ];
        let orphanDatesForWeek = [ '_0Z0_year_month_day' ];
        // No orphans return empty array
        if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year_month_day' ) > 0 ) {
            return orphanDateEntries;
        }
        if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year_month' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForMonth, orphanDateEntries );
        } else if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForYear, orphanDateEntries );
        } else if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_week' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForWeek, orphanDateEntries );
        }
    }
    return orphanDateEntries;
};

let buildEffectiveFilterString = function( filterValues ) {
    removeOrphanDateEntries( filterValues );
    return getFilterString( filterValues );
};

let getFilterString = function( filterValues ) {
    let filterStringToReturn = '';
    let previousFilterValue;
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    _.forEach( filterValues, function( filterValue ) {
        if( previousFilterValue && previousFilterValue.categoryName === filterValue.categoryName ) {
            filterStringToReturn = filterStringToReturn + filterSeparator + filterValue.internalName;
        } else {
            if( filterStringToReturn === '' ) {
                filterStringToReturn = filterStringToReturn + 'StringFilter' + '^^' + filterValue.categoryName +
                      '==' + filterValue.internalName;
            } else {
                filterStringToReturn = insertFilterString( filterStringToReturn, filterValue );
            }
        }
        previousFilterValue = filterValue;
    } );
    return filterStringToReturn;
};

let insertFilterString = function( filterStringToReturn, filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    let appliedFilters = filterStringToReturn.split( '~' );
    let updatedFilterStringToReturn = '';
    let foundCategory = false;
    for( let filterId = 0; filterId < appliedFilters.length; filterId++ ) {
        let categories = appliedFilters[ filterId ].split( '==' );
        if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
            foundCategory = true;
            appliedFilters[ filterId ] = appliedFilters[ filterId ] + filterSeparator + filterValue.internalName;
            break;
        }
    }
    if( foundCategory ) {
        for( let indx = 0; indx < appliedFilters.length; indx++ ) {
            if( _.isEmpty( updatedFilterStringToReturn ) ) {
                updatedFilterStringToReturn += appliedFilters[ indx ];
            } else {
                updatedFilterStringToReturn = updatedFilterStringToReturn + '~' + appliedFilters[ indx ];
            }
        }
    } else {
        filterStringToReturn = filterStringToReturn + '~StringFilter' + '^^' + filterValue.categoryName + '==' + filterValue.internalName;
        updatedFilterStringToReturn = filterStringToReturn;
    }
    return updatedFilterStringToReturn;
};


let getEffectiveFilterStringFromRecipe = function( updatedRecipe, productContextInfoUID ) {
    let effectiveFilterValuesToConsider = getFilterMapFromRecipes( updatedRecipe, undefined, productContextInfoUID );
    return buildEffectiveFilterString( effectiveFilterValuesToConsider );
};

let getFilterMapFromRecipes = function( recipes, filterString, productContextInfoUID ) {
    let categoriesInfo = lookupCategoriesInfoInCache( productContextInfoUID );
    let effectiveFilterValuesToConsider = [];
    if( categoriesInfo?.length > 0  && categoriesInfo[0] ) {
        let filterValues = gatherAllFilterValuesAcrossCategories( categoriesInfo[0]  );


        _.forEach( recipes, function( recipe ) {
            if( recipe.criteriaOperatorType !== 'Clear' ) {
                _.forEach( recipe.subCriteria, function( subCriteria ) {
                    if( applicableCategoryTypes.includes( subCriteria.criteriaType ) ) {
                        let recipeFoundInMap = false;
                        let recipeCategory = subCriteria.criteriaValues[ 0 ];
                        let recipeFilterValue = subCriteria.criteriaValues[ 1 ];
                        _.forEach( filterValues, function( filterValue ) {
                            let filterCategory = filterValue.categoryName;
                            let value = filterValue.internalName;
                            if( recipeCategory === filterCategory && recipeFilterValue === value && isFilterSelected( filterValue ) ) {
                                recipeFoundInMap = true;
                                effectiveFilterValuesToConsider.push( filterValue );
                            }
                        } );
                        if( !recipeFoundInMap ) {
                            let filterValue = {};
                            filterValue.categoryName = subCriteria.criteriaValues[ 0 ];
                            filterValue.internalName = subCriteria.criteriaValues[ 1 ];
                            filterValue.name = subCriteria.criteriaValues[ 1 ];
                            filterValue.type = 'StringFilter';
                            filterValue.selected = true;
                            effectiveFilterValuesToConsider.push( filterValue );
                        }
                    }
                } );
            }
        } );
    }


    return effectiveFilterValuesToConsider;
};


let gatherSelectedFilterValues = function( filterValues ) {
    let selectedFilterValue = [];
    _.forEach( filterValues, function( filterValue ) {
        if( filterValue.selected ) {
            selectedFilterValue.push( filterValue );
        }
    } );
    return selectedFilterValue;
};

export let computeFilterStringForNewProductContextInfo = function( newProductContextInfoUID ) {
    let filterString = '';
    let categoriesInfo = lookupCategoriesInfoInCache( newProductContextInfoUID );
    if( categoriesInfo?.length > 0 && categoriesInfo[0] ) {
        let filterValues = gatherAllFilterValuesAcrossCategories( categoriesInfo[0] );
        let selectedFilterValues = gatherSelectedFilterValues( filterValues );
        filterString = buildEffectiveFilterString( selectedFilterValues );
    }
    return filterString;
};

let clearCache = function() {
    pciToFilterDataMap = [];
};

export let clearRecipeCache = function(  clearAll ) {
    //TODO: modify hostedDiscoveryFilterService usage?
    if( clearAll ) {
        pciToTransientRecipesMap = [];
        clearTransientRecipeInfo();
    } else {
        // Get the current PCI and only clear the cache for that
        // Get the active PCI from data from the view model, only take funtion argument PCI if data is not present.
        let activePCIUID = appCtxSvc.getCtx( _contextKey ).productContextInfo.uid;
        let recipeData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === activePCIUID;
        } );
        if( recipeData && recipeData.length > 0 ) {
            pciToTransientRecipesMap.splice( pciToTransientRecipesMap.indexOf( recipeData ), 1 );
        }
    }
};

export let clearCategoryLogicMap = function( productContextInfoUID ) {
    let recipeData = pciToCategoryLogicMap.filter( function( x ) {
        return x.pciUid === productContextInfoUID;
    } );
    if( recipeData && recipeData.length > 0 ) {
        pciToCategoryLogicMap.splice( pciToCategoryLogicMap.indexOf( recipeData ), 1 );
    }
};

let getUniqueIdentifierFromPCI = function( productContextInfoUID ) {
    if( productContextInfoUID ) {
        let indexP = productContextInfoUID.indexOf( '..P:' );
        let indexFsc = productContextInfoUID.indexOf( '..FSC:' );
        if( indexP > 0 ) {
            let pFrom = indexP + '..P:'.length;
            let pTo = productContextInfoUID.indexOf( ',' );
            return productContextInfoUID.substring( pFrom, pTo );
        }else if( indexFsc ) {
            let fscFrom = indexFsc + '..FSC:'.length;
            let fscTo = productContextInfoUID.indexOf( ',' );
            return productContextInfoUID.substring( fscFrom, fscTo );
        }
    }
    return '';
};

let clearFilterInfoFromURL = function() {
    let filterOnUrl = appCtxSvc.getCtx( _contextKey ).filter;
    if( filterOnUrl && filterOnUrl !== null ) {
        aceContextStateMgmtService.syncContextState( _contextKey, {
            filter: null
        } );
    }
};

let clearPersistentRecipeFromCache = function() {
    let activeCtx = appCtxSvc.getCtx( _contextKey );
    if( activeCtx.productContextInfo && activeCtx.productContextInfo.uid ) {
        recipeHandler.clearPersistentRecipe( _contextKey, activeCtx.productContextInfo.uid );
    }
};

let lookupCategoriesInfoInCache = function( productContextInfoUID ) {
    let filterData;
    let categories;
    let activeGroupIndex;
    let identifier = getUniqueIdentifierFromPCI( productContextInfoUID );
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === identifier;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        categories = filterData[ 0 ].categories;
        activeGroupIndex = filterData[ 0 ].activeGroupIndex;
    }
    return [ categories, activeGroupIndex ];
};

let updatePersistedRecipeInfoInCache = function( productContextInfoUID ) {
    let filterData;
    let recipe;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        let identifier = getUniqueIdentifierFromPCI( productContextInfoUID );
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === identifier;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        recipe = _.cloneDeep( filterData[ 0 ].recipe );
        if( recipe && recipe.length > 0 ) {
            updateDateRangeDisplayInRecipes( recipe );
            recipeHandler.setPersistentRecipe( _contextKey, productContextInfoUID, recipe );
        }
    }
};

let updateActiveGroupInfoInCache = function( productContextInfoUID, activeGroupIndex ) {
    let filterData;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        let identifier = getUniqueIdentifierFromPCI( productContextInfoUID );
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === identifier;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        filterData[ 0 ].activeGroupIndex = activeGroupIndex;
    }
};

let updateCategoriesInfoCacheForCurrentPCI = function( categories, rawCategories, rawCategoryValues, recipe, productContextInfoUID, activeGroupIndex ) {
    let pciVsFilterInfoEntry = {};
    let identifier = getUniqueIdentifierFromPCI( productContextInfoUID );
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        let filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === identifier;
        } );
        if( filterData && filterData[ 0 ] ) {
            if( !_.isUndefined( recipe ) ) {
                filterData[ 0 ].recipe = recipe;
            }
            filterData[ 0 ].categories = categories;
            filterData[ 0 ].rawCategories = rawCategories;
            filterData[ 0 ].rawCategoryValues = rawCategoryValues;
            if( !_.isUndefined( activeGroupIndex ) ) {
                filterData[ 0 ].activeGroupIndex = activeGroupIndex;
            }
        } else {
            pciVsFilterInfoEntry = {
                pciUid: identifier,
                recipe: recipe,
                categories: categories,
                rawCategories: rawCategories,
                rawCategoryValues: rawCategoryValues,
                activeGroupIndex: activeGroupIndex
            };
            pciToFilterDataMap.push( pciVsFilterInfoEntry );
        }
    } else {
        pciVsFilterInfoEntry = {
            pciUid: identifier,
            recipe: recipe,
            categories: categories,
            rawCategories: rawCategories,
            rawCategoryValues: rawCategoryValues,
            activeGroupIndex: activeGroupIndex
        };
        pciToFilterDataMap.push( pciVsFilterInfoEntry );
    }
};

let getRawCategoriesAndCategoryValues = function( pci ) {
    let filterData;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        let identifier = getUniqueIdentifierFromPCI( pci );
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === identifier;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        return {
            recipe: filterData[ 0 ].recipe,
            rawCategories: filterData[ 0 ].rawCategories,
            rawCategoryValues: filterData[ 0 ].rawCategoryValues,
            activeGroupIndex: filterData[0].activeGroupIndex
        };
    }
    return {};
};

let updateCategoryLogicMapInCache = function( newCategoryLogicMap ) {
    let occContext = appCtxSvc.getCtx( _contextKey );
    let pciUID = occContext.productContextInfo.uid;
    // Update the cache with appropriate entry for category logic
    let pciToCategoryLogicEntry;
    if( pciToCategoryLogicMap && pciToCategoryLogicMap.length > 0 ) {
        let categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );

        if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
            // Update existing entry for category logic cache
            categoryLogicEntry[ 0 ].categoryLogicMap = newCategoryLogicMap;
        } else {
            pciToCategoryLogicEntry = {
                pciUid: pciUID,
                categoryLogicMap: newCategoryLogicMap
            };
            // Add new entry for the active PCI to cache
            pciToCategoryLogicMap.push( pciToCategoryLogicEntry );
        }
    } else {
        pciToCategoryLogicEntry = {
            pciUid: pciUID,
            categoryLogicMap: newCategoryLogicMap
        };
        pciToCategoryLogicMap.push( pciToCategoryLogicEntry );
    }
};

let updateWildcardListMapInCache = function( newCategoryWildcardMap ) {
    let occContext = appCtxSvc.getCtx( _contextKey );
    let pciUID = occContext.productContextInfo.uid;
    // Update the cache with appropriate entry for category logic
    let pciToWildcardListEntry;
    if( pciToWildcardListMap && pciToWildcardListMap.length > 0 ) {
        let wildcardListEntry = pciToWildcardListMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );

        if( wildcardListEntry && wildcardListEntry.length > 0 && wildcardListEntry[ 0 ].wildcardListMap ) {
            // Update existing entry for category logic cache
            wildcardListEntry[ 0 ].wildcardListMap = newCategoryWildcardMap;
        } else {
            pciToWildcardListEntry = {
                pciUid: pciUID,
                wildcardListMap: newCategoryWildcardMap
            };
            // Add new entry for the active PCI to cache
            pciToWildcardListMap.push( pciToWildcardListEntry );
        }
    } else {
        pciToWildcardListEntry = {
            pciUid: pciUID,
            wildcardListMap: newCategoryWildcardMap
        };
        pciToWildcardListMap.push( pciToWildcardListEntry );
    }
};

let initializeWildcardListCache = function( categories, recipeGroup, categoryWildcardMap, activeGroupIndex ) {
    let newWildcardListMap = {};
    let recipe = recipeGroup && recipeGroup.length > 0 && recipeGroup[activeGroupIndex] !== undefined ? recipeGroup[activeGroupIndex].subCriteria : null;

    if( recipe && recipe.length > 0 ) {
        for( let index in categories ) {
            if( !categoryWildcardMap ) {
                let wildcardList = [];
                if( categories[ index ].categoryType !== 'Spatial' ) {
                    if( recipeGroup[activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
                        wildcardList = [ 'equals' ];
                    } else {
                        let recipeTermList = getRecipeForCategory( recipe, categories[ index ] );
                        for( let j in recipeTermList ) {
                            let operatorType = recipeTermList[ j ].criteriaOperatorType;
                            if( recipeTermList[ j ].criteriaValues[1].includes( '_$WCARD_' ) ) {
                                let wildcardOperator = recipeTermList[ j ].criteriaValues[1].split( '_$WCARD_' )[ 0 ];
                                // add appropriate wildcard list --> wildcardList
                                if( wildcardOperator === 'equals' || wildcardOperator === 'notequals' ) {
                                    if( operatorType === 'Exclude' ) {
                                        wildcardList = [ 'notequals', 'equals' ];
                                    } else {
                                        wildcardList = [ 'equals', 'notequals' ];
                                    }
                                } else if( wildcardOperator === 'contains' || wildcardOperator === 'notcontains' ) {
                                    if( operatorType === 'Exclude' ) {
                                        wildcardList = [ 'notcontains', 'contains' ];
                                    } else {
                                        wildcardList = [ 'contains', 'notcontains' ];
                                    }
                                } else if( wildcardOperator === 'rangeinclusive' ) {
                                    wildcardList = [ 'rangeinclusive', 'rangeexclusive' ];
                                } else if ( wildcardOperator === 'rangeexclusive' ) {
                                    wildcardList = [ 'rangeexclusive', 'rangeinclusive' ];
                                } else {
                                    wildcardList.push( wildcardOperator );
                                }
                            } else {
                                if( operatorType === 'Exclude' ) {
                                    wildcardList = [ 'notequals', 'equals' ];
                                } else {
                                    wildcardList = [ 'equals', 'notequals' ];
                                }
                            }
                            break;
                        }
                    }
                }
                newWildcardListMap[ categories[ index ].internalName ] = wildcardList;
                categories[ index ].wildcardOperatorList = wildcardList;
            }else {
                categories[ index ].wildcardOperatorList = categoryWildcardMap[ categories[ index ].internalName ];
            }
        }
    } else {
        for( let i in categories ) {
            if( !categoryWildcardMap ) {
                if( recipeGroup && recipeGroup[activeGroupIndex] && recipeGroup[activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
                    newWildcardListMap[ categories[ i ].internalName ] = [ 'equals' ];
                    categories[ i ].wildcardOperatorList = [ 'equals' ];
                } else {
                    newWildcardListMap[ categories[ i ].internalName ] = []; // default list
                    categories[ i ].wildcardOperatorList = [];
                }
            } else {
                categories[ i ].wildcardOperatorList = categoryWildcardMap[ categories[ i ].internalName ];
            }
        }
    }

    if( !categoryWildcardMap ) {
        updateWildcardListMapInCache( newWildcardListMap );
    }
    return categories;
};

let updatePartitonWildcardList = function( category, wildcardOperator ) {
    let newWildcardListMap = {};
    let wildcardList = [];
    if( wildcardOperator === 'equals' ) {
        wildcardList = [ 'equals', 'notequals' ];
    } else if( wildcardOperator === 'notequals' ) {
        wildcardList = [ 'notequals', 'equals' ];
    }
    newWildcardListMap[ category.internalName ] = wildcardList;
    category.wildcardOperatorList = wildcardList;
    updateWildcardListMapInCache( newWildcardListMap );
};

let initializeCategoryLogicCache = function( categories, recipeGroup, categoryLogicMap, activeGroupIndex ) {
    let newCategoryLogicMap = {};
    //9096 : fixed : first recipe term filter/exclude RMB in active group 1 or later runs into issue
    let recipe = recipeGroup && recipeGroup.length > 0 && recipeGroup[activeGroupIndex] !== undefined ? recipeGroup[activeGroupIndex].subCriteria : null;

    if( recipe && recipe.length > 0 ) {
        // Case:  There is recipe applied then we need to iterate over recipe terms
        // and look for NOT logic on in recipes for categories and update the category logic map
        for( let index in categories ) {
            if( !categoryLogicMap ) {
                let categoryLogic = true;
                if( categories[ index ].categoryType !== 'Spatial' ) {
                    let recipeTermList = getRecipeForCategory( recipe, categories[ index ] );
                    for( let j in recipeTermList ) {
                        if( recipeTermList[ j ].criteriaOperatorType === 'Exclude' ) {
                            categoryLogic = false; //  logic is false implying 'Exclude'
                            break;
                        }
                    }
                }
                newCategoryLogicMap[ categories[ index ].displayName ] = categoryLogic;
                categories[ index ].excludeCategory = !categoryLogic;
            } else {
                categories[ index ].excludeCategory = !categoryLogicMap[ categories[ index ].displayName ];
            }

            // Hide category logic when the category for 1st recipe term or for Date type category if first term is from that category
            // if( categories[ index ].internalName === recipe[ 0 ].criteriaValues[ 0 ] && categories[ index ].categoryType !== 'Spatial' ||
            //       categories[ index ].type === 'DateFilter' && recipe[ 0 ].criteriaValues[ 0 ].indexOf( categories[ index ].internalName ) > -1 ) {
            //     categories[ index ].isExcludeCategorySupported = false;
            // }
        }
    } else {
        // Case: No filter/recipe applied, we initialize logic to false (i.e. Filter)
        for( let i in categories ) {
            if( !categoryLogicMap ) {
                newCategoryLogicMap[ categories[ i ].displayName ] = true; // default logic is true implying 'Filter'
                categories[ i ].excludeCategory = false;
            } else {
                categories[ i ].excludeCategory = !categoryLogicMap[ categories[ i ].displayName ];
            }
            // Also hide the category logic toggle when no recipe
            //categories[ i ].isExcludeCategorySupported = true; //9096 not toggle
        }
    }

    if( !categoryLogicMap ) {
        updateCategoryLogicMapInCache( newCategoryLogicMap );
    }
    return categories;
};

export let toggleCategoryLogic = function( toggleCategory, excludeCategoryToggleValue, updateAtomicData, searchState, recipeState, sharedData, occContext, wildcardChanged, wildcardOperator ) {
    // Create transient recipe if there are no recipes in transient map
    cloneCurrentRecipesIfNeeded( occContext.productContextInfo.uid );
    updateCategoryLogicOnPanelLoad( occContext.productContextInfo.uid, searchState, recipeState, sharedData.activeGroupIndex );
    let isWildcardEnabled = appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter[0] === 'true';

    let categoryLogicMap = {};
    let pciUID = occContext.productContextInfo.uid;
    let categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
        return x.pciUid === pciUID;
    } );

    if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
        // Update existing entry for category logic cache
        categoryLogicMap = categoryLogicEntry[ 0 ].categoryLogicMap;
    }

    if( isWildcardEnabled ) {
        if( wildcardOperator === 'equals' ) {
            categoryLogicMap[ toggleCategory.displayName ] = true;
        } else if( wildcardOperator === 'notequals' ) {
            categoryLogicMap[ toggleCategory.displayName ] = false;
        }
    } else {
        // true implies category is toggled to NOT
        // false implies category is not toggled to NOT(i.e. AND/Filter)
        categoryLogicMap[ toggleCategory.displayName ] = !categoryLogicMap[ toggleCategory.displayName ];
    }
    categoryLogicEntry[ 0 ].categoryLogicMap = categoryLogicMap;

    if( toggleCategory.categoryType === 'Spatial' ) {
        // Update search state
        updateSearchStateExcludeCategory( searchState, toggleCategory, excludeCategoryToggleValue, updateAtomicData );
        // Do not update existing recipe term for Spatial category
        return;
    }

    if( toggleCategory.type === 'PartitionFilter' && isWildcardEnabled ) {
        // Update partition wildcard list
        updatePartitonWildcardList( toggleCategory, wildcardOperator );
    }

    // Update recipe operator and recipes cache
    let recipesData = pciToTransientRecipesMap.filter( function( x ) {
        return x.pciUid === pciUID;
    } );

    let recipeGroup = recipeState.recipeGroup;
    let displayRecipe = sharedData.activeGroupIndex < recipeGroup.length ?  recipeGroup[sharedData.activeGroupIndex] : [];
    if( recipesData && recipesData[ 0 ] ) {
        let transientRecipes = [];
        if( sharedData.activeGroupIndex < recipesData[ 0 ].transientRecipes.length ) {
            transientRecipes = recipesData[0].transientRecipes[sharedData.activeGroupIndex].subCriteria;
        }

        let recipeTermInTransientList = getRecipeForCategory( transientRecipes, toggleCategory );
        let displayRecipeTermList = getRecipeForCategory( displayRecipe.subCriteria, toggleCategory );

        if( recipeTermInTransientList && recipeTermInTransientList.length > 0 ) {
            if( wildcardChanged ) {
                // We need to flip the operator on the wildcard recipe e.g. (contains -> notcontains)
                _.forEach( recipeTermInTransientList, function( recipeTermInTransient ) {
                    // Update Transient list recipe term
                    let previousOperator = 'equals';
                    if( recipeTermInTransient.criteriaValues[1].includes( '$WCARD' ) ) {
                        // Equals recipe does not have $WCARD in criteriaValues
                        previousOperator = recipeTermInTransient.criteriaValues[1].split( '_' )[0];
                    }
                    updateOperatorForWildcardRecipe( recipeTermInTransient, previousOperator );
                } );
                _.forEach( displayRecipeTermList, function( displayRecipeTerm ) {
                    // Update recipe list used to display in view
                    let previousOperator = 'equals';
                    if( displayRecipeTerm.criteriaValues[1].includes( '$WCARD' ) ) {
                        // Equals recipe does not have $WCARD in criteriaValues
                        previousOperator = displayRecipeTerm.criteriaValues[1].split( '_' )[0];
                    }
                    updateOperatorForWildcardRecipe( displayRecipeTerm, previousOperator );
                } );
            } else {
                if( categoryLogicMap[ toggleCategory.displayName ] ) {
                    _.forEach( recipeTermInTransientList, function( recipeTermInTransient ) {
                        // Update Transient list recipe term
                        recipeTermInTransient.criteriaOperatorType = 'Filter';
                    } );

                    _.forEach( displayRecipeTermList, function( displayRecipeTerm ) {
                        // Update recipe list used to display in view
                        displayRecipeTerm.criteriaOperatorType = 'Filter';
                    } );
                } else {
                    _.forEach( recipeTermInTransientList, function( recipeTermInTransient ) {
                        // Update Transient list recipe term
                        recipeTermInTransient.criteriaOperatorType = 'Exclude';
                    } );

                    _.forEach( displayRecipeTermList, function( displayRecipeTerm ) {
                        // Update recipe list used to display in view
                        displayRecipeTerm.criteriaOperatorType = 'Exclude';
                    } );
                }
            }

            if( sharedData.autoApply ) {
                // Trigger SOA call to apply filter/recipe
                applyFilter( recipeGroup, occContext );
                return;
            }

            // Enable Filter button if recipe has changed
            let currentRecipes = _.cloneDeep( recipeHandler.getPersistentRecipe( _contextKey, pciUID ) );
            let shouldEnableApply = areRecipesChanged( currentRecipes, recipesData[ 0 ].transientRecipes );
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = shouldEnableApply;
            sharedData.update && sharedData.update( newSharedData );
            // Update recipe on context
            updateTransientRecipeInCache( _.cloneDeep( recipesData[ 0 ].transientRecipes ), pciUID );

            // Update recipe state
            let updateRecipeStateAtomicData = updateAtomicData.recipeState;
            updateRecipeStateAtomicData( { ...recipeState, recipeGroup: recipeGroup } );
        }
    }
    // Update search state
    updateSearchStateExcludeCategory( searchState, toggleCategory, categoryLogicMap[ toggleCategory.displayName ], updateAtomicData );
};

export const updateSearchStateExcludeCategory = ( searchState, toggleCategory, excludeCategoryToggleValue, updateAtomicData ) => {
    let newSearchState = { ...searchState };
    let updatedCategories = newSearchState.categories.map( ( cat ) => {
        if( cat.internalName === toggleCategory.internalName ) {
            let updatedCategory = { ...cat };
            updatedCategory.excludeCategory = !excludeCategoryToggleValue;
            return updatedCategory;
        }
        return cat;
    } );

    let updateSearchStateAtomicData = updateAtomicData.searchState;
    updateSearchStateAtomicData( { ...newSearchState, categories: updatedCategories } );
};

let updateOperatorForWildcardRecipe = function( recipeTerm, previousOperator ) {
    if( previousOperator === 'contains' || previousOperator === 'equals' ) {
        if( recipeTerm.criteriaOperatorType === 'Exclude' ) {
            recipeTerm.criteriaOperatorType = 'Filter';
        } else {
            recipeTerm.criteriaOperatorType = 'Exclude';
        }
    } else if( previousOperator === 'rangeinclusive' || previousOperator === 'rangeexclusive' ) {
        var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        let newOperator;
        if( previousOperator === 'rangeinclusive' ) {
            newOperator = 'rangeexclusive';
        } else {
            newOperator = 'rangeinclusive';
        }
        let filterValue = recipeTerm.criteriaValues[1].split( '_$WCARD_' )[1];
        recipeTerm.criteriaValues[1] = newOperator + '_$WCARD_' + filterValue;
        let wildcardFilterValue = {
            startValue:filterValue.split( filterSeparator )[0],
            endValue:filterValue.split( filterSeparator )[1]
        };
        let categoryInternalName = recipeTerm.criteriaDisplayValue.split( '_$CAT_' )[0];
        recipeTerm.criteriaDisplayValue = categoryInternalName + '_$CAT_' + getCriteriaDisplayValueForWildcard( newOperator, wildcardFilterValue );
    }
};

/**
    * Update recipe on context
    * @param {Object} transientRecipe recipe list to update
    * @param {Object} productContextInfoUID PCI UID
    */
let updateTransientRecipeInCache = function( transientRecipe, productContextInfoUID ) {
    let newRecipe = [];
    _.forEach( transientRecipe, function( recipeTerm ) {
        newRecipe.push( recipeTerm );
    } );

    let effectiveFilterString = getEffectiveFilterStringFromRecipe( newRecipe, productContextInfoUID );
    recipeHandler.setTransientRecipeInfo( _contextKey, effectiveFilterString, newRecipe );
};

/**
       * Find recipe for given category
       * @param {Object} recipe recipe
       * @param {Object} category selected category
       * @return {Object} Recipe list
   */
let getRecipeForCategory = function( recipe, category ) {
    let existingRecipeTermList = [];
    if ( recipe ) {
        _.forEach( recipe, function( recipeTerm ) {
            if( recipeTerm.criteriaValues[ 0 ] === category.internalName ) {
                existingRecipeTermList.push( recipeTerm );
            } else if( category.type === 'DateFilter' ) {
                _.forEach( category.filterValues, function( filterValue ) {
                    if( recipeTerm.criteriaValues[ 0 ] === filterValue.categoryName ) {
                        existingRecipeTermList.push( recipeTerm );
                    }
                } );
            }
        } );
    }
    return existingRecipeTermList;
};

/**
 * The Facet Values will be disabled if the recipe for the catgory is a wildcard recipe
 * @param {object} categoryToProcess
 * @param {object} activeGroupRecipe
 * @param {object} updateInProcessedCategory - update the facet edibiity state in processed category. This is true update is required in delay mode
 * @param {object} processedCategories - If send, the the array is updated with the updated category
 */
let syncFacetEnablementBasedOnRecipe = function( categoryToProcess, activeGroupRecipeList, updateInProcessedCategory, productContextInfoUID, processedCategories ) {
    //If the recipe for the category is a wildcard recipe then disable the selection of facet values.
    if ( categoryToProcess && categoryToProcess.categoryType === 'Attribute' && categoryToProcess.type !== 'DateFilter' ) {
        let recipeTermList = getRecipeForCategory( activeGroupRecipeList, categoryToProcess );
        let isWildCardRecipe = recipeTermList && recipeTermList[ 0 ] && recipeTermList[ 0 ].criteriaValues[ 1 ].indexOf( '_$WCARD_' ) !== -1;
        for( let index = 0; index < categoryToProcess.filterValues.length; index++ ) {
            if( isWildCardRecipe ) {
                categoryToProcess.filterValues[ index ].selected.isEnabled = false;
            } else {
                categoryToProcess.filterValues[ index ].selected.isEnabled = true;
            }
        }
        if ( updateInProcessedCategory && processedCategories && productContextInfoUID ) {
            let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
            let modifiedCategories = _.cloneDeep( processedCategories );
            if ( modifiedCategories.length > 0 && categoryToProcess.filterValues.length > 0 ) {
                for( let j = 0; j < modifiedCategories.length; j++ ) {
                    if( categoryToProcess.internalName === modifiedCategories[ j ].internalName ) {
                        for( let index = 0; index < modifiedCategories[ j ].filterValues.length; index++ ) {
                            modifiedCategories[ j ].filterValues[index].selected.isEnabled = categoryToProcess.filterValues[ index ].selected.isEnabled;
                        }
                        break;
                    }
                }
                updateCategoriesInfoCacheForCurrentPCI( modifiedCategories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, productContextInfoUID );
            }
            return modifiedCategories;
        }
    }
    return null;
};

let processCategoryMetaData = function( categoryToProcess, processCategories, isIndexed, filterMapValues, activeGroupRecipe, updateInProcessedCategory, pciUID, processedCategories ) {
    if( processCategories && applicableCategoryTypes.includes( categoryToProcess.categoryType ) && categoryToProcess.filterValues.length === 0 ) {
        // Show the expansion twisty on the filter category widget.
        categoryToProcess.showExpand = true;

        // This flag will set the filter category to be rendered as collapsed.
        categoryToProcess.expand = false;
    } else if( processCategories && filterPanelUtils.ifFilterSelectedForCategory( categoryToProcess ) ) {
        categoryToProcess.expand = true;
    }
    if ( categoryToProcess.expand === true ) {
        //If the recipe for the category is a wildcard recipe then disable the selection of facet values.
        syncFacetEnablementBasedOnRecipe( categoryToProcess, activeGroupRecipe, updateInProcessedCategory, pciUID, processedCategories );
    }
    if( processCategories ) {
        if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter[0] === 'true' ) {
            categoryToProcess.isExcludeCategorySupported = false; //9096 not toggle
        } else {
            categoryToProcess.isExcludeCategorySupported = true; //9096 not toggle
        }
    }
    if( processCategories && categoryToProcess.type === 'DateFilter' ) {
        //Set the required values on category so that performFacetSearch is not called for every action performed in filter panel once
        //date category is expanded. Without this value, the search code makes the performFacetSearch call instead of just expanding the
        //category to just display the range fields
        setDefaultDateRangeExpansionState( categoryToProcess );
        let showRange = true;
        let showRangeWhenNoFacetValue = true;
        categoryToProcess = filterPanelCommonUtils.processFilterCategories( showRange, categoryToProcess, filterMapValues, showRangeWhenNoFacetValue );
    }
    if( isIndexed ) {
        for( let index = 0; index < categoryToProcess.filterValues.length; index++ ) {
            categoryToProcess.filterValues[ index ].showColor = false;
        }
    }
};

let processCategoriesMetaDataForRendering = function( soaResponseFilterValues, processedCategories, processCategories, activeGroupRecipe, updateInProcessedCategory, pciUid ) {
    let isIndexed = isDiscoveryIndexed();

    for( let i = 0; i < processedCategories.length; i++ ) {
        // Special processing for the Filter Categories for which no filter values were returned.
        // In such cases we plan to keep the category collapsed. For performance reasons, the server
        // does not return filter values for Filter categories based on Occurrence Properties, as part
        // of getSubsetInfo SOA service call.

        processCategoryMetaData( processedCategories[ i ], processCategories, isIndexed, soaResponseFilterValues, activeGroupRecipe, updateInProcessedCategory, pciUid, processedCategories );
        updatePartitionCategory( processedCategories[ i ], soaResponseFilterValues[ processedCategories[ i ].internalName ], processCategories );
    }
};


/**
      TODO-updatePartitionCategory [skpnw0]: hasChildren attribute is missing in performFacetSearch SOA output structure.
      For now, considering time crunch we can use alternate attribute like startEndRange to populate child Icon.
      We agreed this is stop gap solution and we should have Story to change SOA output structure and delete this stop gap solution
      */
let updatePartitionCategory = ( category, soaPartitionFilterValues, processCategories ) => {
    if( category.categoryType === 'Partition' ) {
        let updatedFilterValues = [];
        _.forEach( soaPartitionFilterValues, function( soaFilterValue ) {
            category.filterValues.filter( function( filterValue ) {
                if( soaFilterValue.stringValue === filterValue.internalName ) {
                    if( soaFilterValue.stringValue === filterValue.internalName && soaFilterValue.startEndRange !== 'undefined' &&
                          soaFilterValue.startEndRange === 'true' || soaFilterValue.hasChildren !== 'undefined' && soaFilterValue.hasChildren ) {
                        filterValue.suffixIconId = 'indicatorChildren';
                        filterValue.showSuffixIcon = true;
                    }
                    updatedFilterValues.push( filterValue );
                }
            } );
        } );

        category.type = 'PartitionFilter';
        category.filterValues = updatedFilterValues;
        category.results = _.slice( category.filterValues, 0, category.numberOfFiltersShown );
        category.showFilterText = true;
        category.isServerSearch = true;
        let areMembersSelected = category.filterValues.filter( function( filterValue ) {
            return filterValue.selected.dbValue === true;
        } ).length > 0;
        category.expand = areMembersSelected ? category.expand : processCategories ? false : category.expand;
    }
};

/**
  * Clear transient recipe cache
  */
export let clearTransientRecipeInfo = function( ) {
    let [ effectiveFilterString, effectiveRecipe ] = recipeHandler.getTransientRecipeInfo( _contextKey );
    if( effectiveFilterString || effectiveRecipe ) {
        recipeHandler.setTransientRecipeInfo( _contextKey, undefined, undefined );
    }
};

/**
  * This method is to post process the occgmmtContext object and remove the updatedRecipe and appliedFilters
  * objects from there. These are temp variables created only to hold the changes for creating the SOA input.
  * @param {Object} occContext occContext object
  */
function _removeTempRecipeObjFromAppCtx( occContext ) {
    let occContextVal = occContext.getValue();
    if( occContextVal.updatedRecipe ) {
        let value = {
            updatedRecipe: undefined
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    }
    clearTransientRecipeInfo();
}

let updateFilterInfo = function( searchState, soaResponseCategories, soaResponseFilterMap, recipe, processCategories,
    productContextInfoUID, activeGroupIndex, processRecipe, recipeState, updateInProcessedCategory ) {
    if( soaResponseCategories === undefined || soaResponseCategories.length === 0 ) {
        return {};
    }
    // Clone SOA response
    let clonedFilterMap = _.cloneDeep( soaResponseFilterMap );

    let clonedFilterCategories = _.cloneDeep( soaResponseCategories );
    let clonedRecipe =  _.cloneDeep( recipe );
    const newSearchData = { ...searchState };
    newSearchData.searchFilterCategories = clonedFilterCategories;
    newSearchData.searchFilterMap = clonedFilterMap;
    newSearchData.bulkFiltersApplied = false;
    let processedCategories = filterPanelService.getCategories3( newSearchData, true ); // true for showing date/numeric range

    // processRecipe flag denotes if we want to process the recipe during getSbusetInfo SOA response processing
    // We do not want to process the recipe when getSubsetInfo SOA is triggered during group switch or new group creation use-case.
    // When this flag is false, we update the cache with latest processed categories and avoid picking the stale categories from the cache.
    if( !processRecipe ) {
        updateCategoriesInfoCacheForCurrentPCI( processedCategories, clonedFilterCategories, clonedFilterMap, undefined, productContextInfoUID, activeGroupIndex );
    }

    // Get existing filter categories from cache for this PCI
    let categoriesInfo = lookupCategoriesInfoInCache( productContextInfoUID );

    _.forEach( processedCategories, function( category, index ) {
        let responseCategory = _.find( soaResponseCategories, ( cat ) => {
            if( processedCategories[ index ].internalName === cat.internalName ) {
                return cat;
            }
        } );
        let cachedCategory = _.find( categoriesInfo[0], ( cat ) => {
            if( cat && processedCategories[ index ].internalName === cat.internalName ) {
                return cat;
            }
        } );
        if( responseCategory ) {
            //The isServerSearch and hasMoreFacetValues are retrivied during performfacetsearch
            //and updated in cache. Restore those values on processedCategories.
            //hasMoreFacetValues can be either false/true
            //isServerSearch can be undefined/true. Once set to true, it is not set back to undefined
            //until the next getSubsetInfo call
            let [ cachedIsServerSearch, cachedHasMoreFacetValues ] = [ undefined, undefined ];
            if ( cachedCategory && cachedCategory.isServerSearch ) {
                cachedIsServerSearch = cachedCategory.isServerSearch;
            }
            if( newSearchData.autoApplyFilters === false ) {
                // After clear all in delay mode, there is no performFacetSearch call to update hasMoreFacetValues.
                // That value is held in the searchState, so need to use that to update processedCategories.
                let delayCategory = _.find( newSearchData.categories, ( cat ) => {
                    if( processedCategories[ index ].internalName === cat.internalName ) {
                        return cat;
                    }
                } );
                if( delayCategory ) {
                    processedCategories[ index ].hasMoreFacetValues = delayCategory.hasMoreFacetValues;
                }
            } else {
                if( cachedCategory ) {
                    cachedHasMoreFacetValues = cachedCategory.hasMoreFacetValues;
                }
                processedCategories[ index ].hasMoreFacetValues = cachedHasMoreFacetValues ? cachedHasMoreFacetValues : !responseCategory.endReached;
            }

            processedCategories[ index ].isServerSearch = cachedIsServerSearch;
            processedCategories[ index ].startIndexForFacetSearch = responseCategory.endIndex;
            if( responseCategory.displayFilterText ) {
                processedCategories[ index ].showFilterText = responseCategory.displayFilterText;
            }
        }

        if( category.categoryType === 'Spatial' ) {
            processedCategories[ index ].type = 'SpatialFilter';
        }
        if( category.categoryType === 'Partition' ) {
            processedCategories[ index ].type = 'PartitionFilter';
        }
    } );

    let activeGroupRecipe;
    if( !processRecipe ) {
        //If create of new group OR selection of a group which triggers getSubsetInfo, then use the recipe on state to do the rendering of categories
        activeGroupRecipe = recipeState.recipeGroup && recipeState.recipeGroup.length > 0 &&
                            recipeState.recipeGroup[activeGroupIndex] !== undefined ? recipeState.recipeGroup[activeGroupIndex].subCriteria : null;
    } else {
        activeGroupRecipe = clonedRecipe && clonedRecipe.length > 0 && clonedRecipe[activeGroupIndex] !== undefined ? clonedRecipe[activeGroupIndex].subCriteria : null;
    }
    processCategoriesMetaDataForRendering( clonedFilterMap, processedCategories, processCategories, activeGroupRecipe, updateInProcessedCategory, productContextInfoUID );

    if( processCategories ) {
        // processRecipe flag denotes if we want to process the recipe during getSbusetInfo SOA response processing
        // We do not want to process the recipe when getSubsetInfo SOA is triggered during group switch or new group creation use-case.
        // getSubsetInfo returns empty recipe in these use-cases but as we want to calculate the category toggle state again, we are passing
        // the recipe on the recipe state so that the not toggle state is reflected correctly. Even tough we do not want to process the recipe, we want to
        // process the category toggle state.
        if( !processRecipe ) {
            initializeCategoryLogicCache( processedCategories, recipeState.recipeGroup, undefined, activeGroupIndex );
            initializeWildcardListCache( processedCategories, recipeState.recipeGroup, undefined, activeGroupIndex );
        } else {
            initializeCategoryLogicCache( processedCategories, clonedRecipe, undefined, activeGroupIndex );
            initializeWildcardListCache( processedCategories, clonedRecipe, undefined, activeGroupIndex );
        }
    }
    newSearchData.categories = processedCategories;

    const selectedFiltersMap = getSelectedFiltersMap( newSearchData.categories );
    newSearchData.filterString = searchFilterService.buildFilterString( selectedFiltersMap );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
    newSearchData.appliedFilterMap = selectedFiltersInfo.activeFilterMap;

    // TODO: This should be done in initialize method
    clearFilterInfoFromURL();

    // Update categories cache from SOA response
    if( !processRecipe ) {
        updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( newSearchData.categories ), clonedFilterCategories, clonedFilterMap, undefined, productContextInfoUID, activeGroupIndex );
    } else {
        updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( newSearchData.categories ), clonedFilterCategories, clonedFilterMap, clonedRecipe, productContextInfoUID, activeGroupIndex );
    }

    return newSearchData;
};

const removeSelectedField = ( filterValues ) => {
    let updateFilterValues = [];
    if( filterValues && filterValues.length > 0 ) {
        for( let index = 0; index < filterValues.length; index++ ) {
            let eachFilterValue = { ...filterValues[ index ].value };
            eachFilterValue.selected = eachFilterValue.selected && eachFilterValue.selected.dbValue ? eachFilterValue.selected.dbValue : false;
            updateFilterValues.push( eachFilterValue );
        }
    }
    return updateFilterValues;
};

const syncSelectionsInCategoryOnSearchState = ( searchStateFilterValues, processedFilterValues ) => {
    if( searchStateFilterValues && searchStateFilterValues.length > 0 ) {
        for( let i = 0; i < searchStateFilterValues.length; i++ ) {
            if( processedFilterValues && processedFilterValues.length > 0 ) {
                for( let index = 0; index < processedFilterValues.length; index++ ) {
                    let eachFilterValue = processedFilterValues[ index ];
                    if ( searchStateFilterValues[i].stringValue === eachFilterValue.internalName ) {
                        eachFilterValue.selected.dbValue = searchStateFilterValues[i].selected;
                        eachFilterValue.selected.value = searchStateFilterValues[i].selected;
                        break;
                    }
                }
            }
        }
    }
};

/**
 * Set the required values on category so that performFacetSearch is not called for every action performed in filter panel once
 * date category is expanded. Without this value, the search code makes the performFacetSearch call instead of just expanding the
 * category to just display the range fields
 * @param {*} dateCategory
 */
let setDefaultDateRangeExpansionState = function( dateCategory ) {
    dateCategory.hideNoResultFoundText = true;
    dateCategory.hasMoreFacetValues = false;
    dateCategory.isServerSearch = false;
    dateCategory.isPopulated = true;
};

/**
 * This function is to process the performFacetSearch SOA response.
 * It is called when More... is clicked and on search within the facet.
 *
 * @param {Object} response SOA response of performFacetSearch SOA
 * @param {Object} searchState search state for view
 * @param {Object} searchStateUpdater search state updater
 * @param {Object} categoryForFacetSearchInput search input  category info for SOA
 * @param {Object} category face
 * @param {Object} productContextInfoUID productContextInfo UID
 * @param {Object} sharedData data shared between filter panel and sub panels
 * @param {Object} recipeState recipe state for view

*/
export let updateCategoriesAfterFacetSearch = function( response, searchState, searchStateUpdater, categoryForFacetSearchInput, category, productContextInfoUID, sharedData, recipeState ) {
    let isWildCardRecipe = categoryForFacetSearchInput.facetSearchString && categoryForFacetSearchInput.facetSearchString.indexOf( '_$WCARD_' ) !== -1;
    if( categoryForFacetSearchInput && categoryForFacetSearchInput.facetSearchString && isWildCardRecipe ) {
        categoryForFacetSearchInput.facetSearchString = categoryForFacetSearchInput.facetSearchString.split( '_$WCARD_' )[ 1 ];
    }
    let updateSearchStateAtomicData = searchStateUpdater.searchState;
    category.filterValues = removeSelectedField( category.filterValues );
    let soaResponseFilterValues;
    let showRange = false;
    let showRangeWhenNoFacetValue = false;
    let searchFilterMapToUpdate = response.searchFilterMap ? response.searchFilterMap : searchState.searchFilterMap;
    if( !response.searchFilterMap ) {
        searchFilterMapToUpdate[category.internalName] = [];
    }
    soaResponseFilterValues = searchFilterMapToUpdate[ category.internalName ];
    //clone the response since we do not want to change the response.filtermap.
    let modifiedSearchFilterMap = AwFilterPanelUtils.setMapForFilterValueSearch( _.cloneDeep( searchFilterMapToUpdate ),
        searchState, category, categoryForFacetSearchInput.startIndex );
    category.filterValues = filterPanelService.getFiltersForCategory( category,
        searchState.searchFilterMap, undefined, searchState.colorToggle );
    if( category.type === 'DateFilter' ) {
        //set showrange to true if date filter
        //set showRangeWhenNoFacetValue true if you want to render category even if filter values are 0
        //this will work as long as we have facet values returned, as the type is decided on basis of the returned filtermap values
        //set hideNoResultFoundText to true so that "No Results Found" text is not shown
        showRange = true;
        showRangeWhenNoFacetValue = true;
    }
    if( category.type === 'NumericFilter' ) {
        //set showrange to false if numeric filter
        //set showRangeWhenNoFacetValue true if you want to render category even if filter values are 0
        //this will work as long as we have facet values returned, as the type is decided on basis of the returned filtermap values
        //set hideNoResultFoundText to true so that "No Results Found" text is not shown
        showRange = true;
        showRangeWhenNoFacetValue = true;
    }

    // From Tc2412, all the categories except spatial are collapsed when open.
    // When the category is expanded by user, the following values need to be set for the
    // pagination, search within facet etc to work.
    // hasMoreFacetValues = Value returned by the server indicating that there are more values to be fetched.
    // isServerSearch - Value is set to true once the server search is made and hasMoreFacetValues is returned as true
    // and that value is retained on the category through out even after all the values are fetched(hasMoreFacetValues returned false)
    // The Text Search widget within filter categories relies on these variables to make
    // to decide whether to make a performFacetSearch or not. Setting this to true
    // allows the widget to performFacetSearch if a textsearch box is present in the UI.
    category.hasMoreFacetValues = response.hasMoreFacetValues;
    if( !category.isServerSearch && category.hasMoreFacetValues ) {
        category.isServerSearch = true;
    }
    category.numberOfFiltersShown = category.filterValues.length;
    category.expand = true;
    let modifiedCategoriesExpandCollapseMap = AwFilterPanelUtils.setCategoryExpandCollapseStateInSearchState( searchState.categoriesExpandCollapseMap, category.internalName, category.expand );
    category.isPopulated = Boolean( category.filterValues  && ( _.isArray( category.filterValues ) && category.filterValues.length > 0 ||
          !_.isArray( category.filterValues ) ) );

    category.updateNumberOfFiltersShown = categoryForFacetSearchInput.startIndex > 0;
    if( category.type === 'DateFilter' ) {
        //Set the required values on category so that performFacetSearch is not called for every action performed in filter panel once
        //date category is expanded. Without this value, the search code makes the performFacetSearch call instead of just expanding the
        //category to just display the range fields
        setDefaultDateRangeExpansionState( category );
    }

    let categories = searchState.categories;
    let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
    let activeGroupRecipe = recipeState && recipeState.recipeGroup && recipeState.recipeGroup.length > 0 ? recipeState.recipeGroup[rawCategoriesInfo.activeGroupIndex].subCriteria : [];
    //processCategoryMetaData( category, false, isDiscoveryIndexed(), modifiedSearchFilterMap, activeGroupRecipe, true, productContextInfoUID, categories );
    processCategoryMetaData( category, false, isDiscoveryIndexed(), modifiedSearchFilterMap, activeGroupRecipe, false );
    updatePartitionCategory( category, soaResponseFilterValues, false );

    category = filterPanelCommonUtils.processFilterCategories( showRange, category, modifiedSearchFilterMap, showRangeWhenNoFacetValue );

    if( category.type === 'StringFilter' ) {
        category.facetSearchString = categoryForFacetSearchInput.facetSearchString;
        category.showFilterText =
              category.filterValues &&
              category.filterValues.length > category.defaultFilterValueDisplayCount * 2 ||
              categoryForFacetSearchInput.isServerSearch;
    }

    // Update categories in search state
    for( let index = 0; index < categories.length; index++ ) {
        if( category.internalName === categories[ index ].internalName ) {
            categories[ index ] = category;
            break;
        }
    }

    // Update the local cache with updated merged filter values
    let updatedFilterValues = [];
    if( Object.keys( searchState.searchFilterMap ).includes( category.internalName ) ) {
        //clone the search state at this point. this is used to update the rawcategories info.
        //we do not save the selected state of the facets in raw category info.
        updatedFilterValues = _.cloneDeep( searchState.searchFilterMap[ category.internalName ] );
    }

    //This is valid for both delay and autoapply since we have to sync the facet selection state.
    syncFiltersInCacheOnFacetSearch( searchState.searchFilterMap[ category.internalName ], category.internalName,
        categoryForFacetSearchInput.facetSearchString, productContextInfoUID, sharedData.activeGroupIndex );
    syncSelectionsInCategoryOnSearchState( searchState.searchFilterMap[ category.internalName ], category.filterValues );

    // sync the filter string to all selections of the filters
    let selectedFiltersMap = getSelectedFiltersMap( searchState.categories );
    searchState.filterString = searchFilterService.buildFilterString( selectedFiltersMap );

    // Update static filter map only if it is an expansion of category and not search
    if( !categoryForFacetSearchInput.facetSearchString || _.isEmpty( categoryForFacetSearchInput.facetSearchString ) ) {
        rawCategoriesInfo.rawCategoryValues[ category.internalName ] = updatedFilterValues;
        let rawCategories = rawCategoriesInfo.rawCategories;
        for( let rawCategory in rawCategories ) {
            if( rawCategories[ rawCategory ].internalName === category.internalName ) {
                rawCategories[ rawCategory ].hasMoreFacetValues = response.hasMoreFacetValues;
                rawCategories[ rawCategory ].endReached = !response.hasMoreFacetValues;
                rawCategories[ rawCategory ].startIndexForFacetSearch = response.endIndex;
                rawCategories[ rawCategory ].endIndex = response.endIndex;
                if( !searchState.autoApplyFilters ) {
                    rawCategories[ rawCategory ].displayFilterText =  category.showFilterText;
                    rawCategories[ rawCategory ].supportServerSearch = category.isServerSearch;
                }
                break;
            }
        }
        updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( categories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues,
            rawCategoriesInfo.recipe, productContextInfoUID, undefined );

        let wildcardLogicEntry;
        if( pciToWildcardListMap ) {
            wildcardLogicEntry = pciToWildcardListMap.filter( function( x ) {
                return x.pciUid === productContextInfoUID;
            } );
            if( wildcardLogicEntry && wildcardLogicEntry.length > 0 && wildcardLogicEntry[ 0 ].wildcardListMap ) {
                if( recipeState && recipeState.recipeGroup && recipeState.recipeGroup[sharedData.activeGroupIndex] ) {
                    if( recipeState.recipeGroup[sharedData.activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
                        wildcardLogicEntry[ 0 ].wildcardListMap[category.internalName] = [ 'equals' ];
                        initializeWildcardListCache( categories, recipeState.recipeGroup, wildcardLogicEntry[ 0 ].wildcardListMap, sharedData.activeGroupIndex );
                    } else {
                        initializeWildcardListCache( categories, recipeState.recipeGroup, undefined, sharedData.activeGroupIndex );
                    }
                } else {
                    wildcardLogicEntry[ 0 ].wildcardListMap[category.internalName] = [];
                    let recipeGroup = recipeState && recipeState.recipeGroup;
                    initializeWildcardListCache( categories, recipeGroup, wildcardLogicEntry[ 0 ].wildcardListMap, sharedData.activeGroupIndex );
                }
            }
        }
    }


    // Update search state
    updateSearchStateAtomicData( {
        ...searchState,
        isFacetSearch: true,
        categories: categories,
        categoriesExpandCollapseMap: modifiedCategoriesExpandCollapseMap,
        searchFilterMap: modifiedSearchFilterMap
    } );
};

export let updatePartitionSchemeFacet = function( searchState, searchStateUpdater, categoryForFacetSearchInput, category, productContextInfoUID ) {
    let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
    let rawFilterValues = rawCategoriesInfo.rawCategoryValues[ category.internalName ];
    let modifiedSearchFilterMap = searchState.searchFilterMap;
    let updateSearchStateAtomicData = searchStateUpdater.searchState;

    category.filterValues = filterPanelService.getFiltersForCategory( category,
        searchState.searchFilterMap, undefined, searchState.colorToggle );

    category.numberOfFiltersShown = category.filterValues.length;
    category.expand = true;
    let modifiedCategoriesExpandCollapseMap = AwFilterPanelUtils.setCategoryExpandCollapseStateInSearchState( searchState.categoriesExpandCollapseMap, category.internalName, category.expand );
    category.isPopulated = Boolean( category.filterValues && ( _.isArray( category.filterValues ) && category.filterValues.length > 0 ||
          !_.isArray( category.filterValues ) ) );
    category.updateNumberOfFiltersShown = categoryForFacetSearchInput.startIndex > 0;

    processCategoryMetaData( category, false, isDiscoveryIndexed(), modifiedSearchFilterMap, false );
    updatePartitionCategory( category, rawFilterValues, false );
    category.facetSearchString = categoryForFacetSearchInput.facetSearchString;
    category.showFilterText = category.filterValues && category.filterValues.length > category.defaultFilterValueDisplayCount * 2 || categoryForFacetSearchInput.isServerSearch;

    // Update categories in search state
    let categories = searchState.categories;
    for( let index = 0; index < categories.length; index++ ) {
        if( category.internalName === categories[ index ].internalName ) {
            categories[ index ] = category;
            break;
        }
    }

    // Update the local cache with updated merged filter values
    let rawCategories = rawCategoriesInfo.rawCategories;
    for( let rawCategory in rawCategories ) {
        if( rawCategories[ rawCategory ].internalName === category.internalName ) {
            rawCategories[ rawCategory ].hasMoreFacetValues = category.hasMoreFacetValues;
            rawCategories[ rawCategory ].endReached = !category.hasMoreFacetValues;
            rawCategories[ rawCategory ].startIndexForFacetSearch = category.endIndex;
            rawCategories[ rawCategory ].endIndex = category.endIndex;
        }
    }

    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( categories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues,
        rawCategoriesInfo.recipe, productContextInfoUID, undefined );

    // Update search state
    searchState.isFacetSearch = true;
    updateSearchStateAtomicData( { ...searchState, categories: categories, categoriesExpandCollapseMap: modifiedCategoriesExpandCollapseMap, searchFilterMap: modifiedSearchFilterMap } );
};

let revalidateIncludeExcludeCommandVisibility = function( recipe ) {
    let validSelectedObjects;
    if( recipe && recipe.length === 1 ) {
        // Re-evaluate validity of Include/Exclude commands
        // when first recipe term is added
        validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
        validateTermsToIncludeOrExclude( validSelectedObjects );
    } else if( recipe && recipe.length === 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', false, 'filter' );
        if ( validSelectedObjects === undefined ) {
            validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
        }
        if (  validSelectedObjects && validSelectedObjects.length >= 1 ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeAndExclude', true, 'filter' );
        }
    }
};

export let applyFilterInBulkMode = function( updateAtomicData, occContext, searchState ) {
    let transientRecipeInfo = recipeHandler.getTransientRecipeInfo( _contextKey );
    let updateSearchStateAtomicData = updateAtomicData.searchState;
    let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters( searchState );
    updateSearchStateAtomicData( newSearchState );
    exports.applyFilter( transientRecipeInfo[1], occContext );
};

let applyFilter = function( recipe, occContext ) {
    // In case of autosave workset, we need to make sure that we add a callback function
    // to occContext to allow for ACE framework to use our provide mechanism for partial
    // error processing, This is required due to possibility of concurrent updates in workset
    if( createWorksetService.isAutoSaveWorksetEnabled( occContext.openedObjectType ) ) {
        eventBus.publish( 'workset.overridePartialErrorProcessing' );
    }

    // NOTE: Due to pack/unpack feature in smart discovery products, when we first filter
    // an assembly, the server unpacks the filtered assembly by default. Due to this, the
    // newly generated PCI is different from previously present. The new PCI does not have
    // PA:1 in it. So we need to remove any entry for this now stale PCI from our map.
    clearRecipeCache( false );
    // END of above explanation.
    clearCategoryLogicMap( occContext.productContextInfo.uid );

    cleanUpEmptyRecipeGroupsFromRecipe( recipe, occContext.productContextInfo.uid );

    // Create OccContext object to be updated.
    let occContextValue = {
        transientRequestPref: {
            calculateFilters: true,
            retainTreeExpansionStates: true, // Retain expansion state on application of filter
            filterOrRecipeChange: true,
            jitterFreePropLoad: true,
            userGesture: 'SEARCH_FILTER_CHANGE'
        },
        updatedRecipe: recipe,
        clearExistingSelections: true,
        pwaReset: true
    };

    // Check if we are in in-context mode and then add in-context related info to OccContext
    if( occContext.currentState && occContext.currentState.incontext_uid && occContext.currentState.incontext_uid !== null ) {
        // We want to create a new window when we are in-context mode and applying filter
        occContextValue.transientRequestPref.startFreshNavigation = true;
    }

    // Update transient request pref and set reset flag on context
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    // Fire event to trigger server visibility re-evaluation on filter change
    eventBus.publish( 'cdm.updated', { updatedObjects: [ occContext.pwaSelection[0] ] } );
};


let cleanUpEmptyRecipeGroupsFromRecipe = function( recipe, productContextInfoUID ) {
    let checkForEmptyRecipeInTransientRecipes;
    if( recipe && recipe.length > 0 ) {
        // Remove empty recipe from recipe being applied
        let lastIndex = recipe.length - 1;
        if( recipe[lastIndex].criteriaOperatorType !== 'Clear' && ( _.isEmpty( recipe[lastIndex] ) ||  recipe[lastIndex].subCriteria && recipe[lastIndex].subCriteria.length === 0  ) ) {
            recipe.splice( lastIndex, 1 );
            checkForEmptyRecipeInTransientRecipes = true;
        }
        if( checkForEmptyRecipeInTransientRecipes && pciToTransientRecipesMap?.length > 0 ) {
            let recipesData = pciToTransientRecipesMap.filter( function( x ) {
                return x.pciUid === productContextInfoUID;
            } );

            // Remove empty recipe from cached transient recipes
            if( recipesData && recipesData[ 0 ]?.transientRecipes?.length > 0 && recipesData[ 0 ].transientRecipes[ lastIndex ]?.criteriaOperatorType !== 'Clear'
                    && ( _.isEmpty( recipesData[ 0 ].transientRecipes[lastIndex] ) || recipe[lastIndex] && recipe[lastIndex].subCriteria && recipe[lastIndex].subCriteria.length === 0   ) ) {
                recipesData[ 0 ].transientRecipes.splice( lastIndex, 1 );
            }
        }
    }
};

/**
   * Create an Recipe for a selected filter value
   * @param {Object} category - Filter category object of the selected filter value.
   * @param {Object} filter - Selected filter value.
   * @param {Object} recipes - The existing recipes.
   * @param {Object} productContextInfoUID - Product context info UID
   * @return {object} Criteria recipe
   */
let createRecipeForGivenCategory = function( category, filter, recipes, productContextInfoUID ) {
    let criteriaVal = [];
    let recipeOperator = 'Filter';
    let recipeExists;
    let startRangeDate;
    let endRangeDate;
    let range = '';

    if( filter.startDate && filter.startDate.dateApi && filter.startDate.dateApi.dateObject  || filter.endDate && filter.endDate.dateApi && filter.endDate.dateApi.dateObject ) {
        //LCS-986229 ref: global search: filterPanelUtils.getDateRangeString -> sets empty start date to * and empty end date to new Date( ENDING_OF_TIME )
        //ENDING_OF_TIME = '2100-12-31T23:59:59'; =>defined in filterPanelUtils
        //new Date( ENDING_OF_TIME )=>returns "2101-01-01T04:59:59.000Z"
        //later in flow before API call => filterPanelUtils.getDateRangeFilter (checks for * in start date and replaces with :dateTimeService.NULLDATE)


        let noStartDate = filterPanelUtils.isNullDate( filter.startDate.dateApi.dateObject );
        let noEndDate = filterPanelUtils.isNullDate( filter.endDate.dateApi.dateObject );
        startRangeDate = noStartDate ? dateTimeService.NULLDATE : dateTimeService.formatUTC( filter.startDate.dateApi.dateObject.setHours( 0, 0, 0, 0 ) );
        endRangeDate = noEndDate ? dateTimeService.NULLDATE  : dateTimeService.formatUTC( filter.endDate.dateApi.dateObject.setHours( 23, 59, 59, 0 ) );

        if( noStartDate ) {
            range = '_$RANGE_' + filter.endDate.dateApi.dateValue;
        }else if ( noEndDate ) {
            range = filter.startDate.dateApi.dateValue + '_$RANGE_';
        }else {
            range = filter.startDate.dateApi.dateValue + '_$RANGE_' + filter.endDate.dateApi.dateValue;
        }
    }

    // TODO : in AW5.2 Partitions are shown as Psuedo Hierachy by appending "- " in front
    // To Populate Recipe We need Only its display name, so replacing "- " pattern from start of filter name to ''
    // This needs to be cleaned up once Partitions are shown using aw-tree widget.
    let displayFilterValue = filter.name ? filter.name.replace( new RegExp( '^(\- )*', 'g' ), '' ) : range.replace( new RegExp( '^(\- )*', 'g' ), '' );

    let categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
        return x.pciUid === productContextInfoUID;
    } );
    if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap &&
          !categoryLogicEntry[ 0 ].categoryLogicMap[ category.displayName ] ) {
        recipeOperator = 'Exclude';
    }
    recipeExists = getRecipeForExistingCategory( recipes, filter );
    if( recipeExists ) {
        let recipe = _.cloneDeep( recipeExists );
        // Get the filter separator value from the preference AW_FacetValue_Separator
        let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        if( startRangeDate || endRangeDate ) {
            recipe.criteriaValues[1] = startRangeDate;
            recipe.criteriaValues[2] = endRangeDate;
            recipe.criteriaDisplayValue = category.displayName + '_$CAT_' + displayFilterValue;
        }else {
            if( !recipe.criteriaValues.includes( filter.internalName ) ) {
                recipe.criteriaValues.push( filter.internalName );
                recipe.criteriaDisplayValue += filterSeparator + displayFilterValue;
            }
        }
        return recipe;
    }
    if( startRangeDate || endRangeDate ) {
        criteriaVal.push( category.internalName );
        criteriaVal.push( startRangeDate );
        criteriaVal.push( endRangeDate );
    }else {
        criteriaVal.push( filter.categoryName );
        criteriaVal.push( filter.internalName );
    }
    return {
        criteriaDisplayValue: category.displayName + '_$CAT_' + displayFilterValue,
        criteriaOperatorType: recipeOperator,
        criteriaType: category.categoryType,
        criteriaValues: criteriaVal,
        subCriteria: []
    };
};

/**
   * Get the recipe for the category in the selected filter value
   * @param {Object} recipes - List of recipes.
   * @param {Object} filter - Selected filter value.
   * @param {Object} category - Filter category
   * @return {object} Criteria recipe
   */
let getRecipeForExistingCategory = function( recipes, filter ) {
    let recipeForCategory;
    _.forEach( recipes, function( recipe ) {
        if( filter && applicableCategoryTypes.includes( recipe.criteriaType ) && recipe.criteriaValues[ 0 ] === filter.categoryName ) {
            recipeForCategory = recipe;
        }
    } );
    return recipeForCategory;
};

let spatialRecipeExists = function( recipes, spatialType ) {
    let spatialExists = false;
    if( recipes.length === 1 && recipes[ 0 ].criteriaOperatorType === 'Clear' && recipes[ 0 ].subCriteria[0].criteriaType === spatialType ) {
        return false;
    }
    for( let index = 0; index < recipes.length; index++ ) {
        if( recipes[ index ].subCriteria[0].criteriaType === spatialType ) {
            spatialExists = true;
            break;
        }
    }
    return spatialExists;
};

let isSpatialRecipe = function( recipe ) {
    let isSpatial = false;
    if( recipe.criteriaType === 'Proximity' || recipe.criteriaType === 'BoxZone' || recipe.criteriaType === 'PlaneZone' ) {
        isSpatial = true;
    }
    return isSpatial;
};

/**
       * Update  recipe  with updated  values  for  same  category
       * @param {object} recipes - List of recipes.
       * @param {object} newRecipe - recipe to be updated if category exists.

       * @return {boolean} true if recipe  is  updated
       */
let replaceRecipeForExistingCategory = function( recipes, newRecipe ) {
    if( !newRecipe ) {
        return false;
    }
    let replaceRecipe = false;
    if( applicableCategoryTypes.includes( newRecipe.criteriaType ) ) {
        for( let index = 0; index < recipes.length; index++ ) {
            if( recipes[ index ].criteriaValues && recipes[index].criteriaValues[0 ] === newRecipe.criteriaValues[ 0 ] ) {
                if( newRecipe.criteriaOperatorType === 'Clear' ) {
                    recipes.splice( index, 1 );
                } else{
                    recipes[ index ] = newRecipe;
                }
                replaceRecipe = true;
                break;
            }
        }
    } else if( newRecipe.criteriaType === 'SelectedElement' ) {
        for( let j = 0; j < recipes.length; j++ ) {
            if( recipes[ j ].criteriaType === newRecipe.criteriaType &&
                  recipes[ j ].criteriaOperatorType === newRecipe.criteriaOperatorType ) {
                if ( newRecipe.criteriaOperatorType !== 'Exclude' ) {
                    // For selected term match last element in criteriavalues (true or false)
                    // to get the matching include term
                    let existingIncludeChildren = recipes[ j ].criteriaValues[recipes[ j ].criteriaValues.length - 1];
                    let newIncludeChildren = newRecipe.criteriaValues[newRecipe.criteriaValues.length - 1];
                    if ( existingIncludeChildren === newIncludeChildren ) {
                        updateSelectedElementRecipeTerm( recipes[ j ], newRecipe );
                        replaceRecipe = true;
                        break;
                    }
                } else {
                    updateSelectedElementRecipeTerm( recipes[ j ], newRecipe );
                    replaceRecipe = true;
                    break;
                }
            }
        }
    }
    return replaceRecipe;
};

/**
   * This function will update selected recipe term display values and criteria values
   * them as an array.
   *
   * @param {Object} matchedRecipe : Existing Selected Element recipe
   * @param {String} newRecipe : Selected Element to be added
   */
let updateSelectedElementRecipeTerm = function( matchedRecipe, newRecipe ) {
    // Get the filter separator value from the preference AW_FacetValue_Separator
    let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    // Add selected element if not already present in recipe
    // Concat the display value
    // Update the criteria values
    for( let j in newRecipe.criteriaValues ) {
        if( !matchedRecipe.criteriaValues.includes( newRecipe.criteriaValues[ j ] ) ) {
            let selectedElementsDisplay = selectedTerms( newRecipe.criteriaDisplayValue, filterSeparator );
            if ( newRecipe.criteriaOperatorType !== 'Exclude' ) {
                matchedRecipe.criteriaValues.splice( matchedRecipe.criteriaValues.length - 1, 0, newRecipe.criteriaValues[ j ] );
            } else{
                matchedRecipe.criteriaValues.push( newRecipe.criteriaValues[ j ] );
            }
            matchedRecipe.criteriaDisplayValue += filterSeparator + selectedElementsDisplay[ j ];
        }
    }
};

/**
   * This function will extract all selected terms in the input recipe criteria and return
   * them as an array.
   *
   * @param {String} recipeDisplayName : Recipe Criteria Display Name
   * @param {String} filterSeparator : Filter Separator between the selected terms
   * @return {String[]} : An array of all selected terms in the input recipe criteria.
   */
let selectedTerms = function( recipeDisplayName, filterSeparator ) {
    let recipeValuesString = recipeDisplayName.split( '_$CAT_' )[ 1 ];
    let allSelectedTerms = {};
    if( recipeValuesString ) {
        allSelectedTerms = recipeValuesString.split( filterSeparator );
    }
    return allSelectedTerms;
};

/*
   * Remove attribute criteria value for same category
   */
let removeCriteriaValueFromCategory = function( recipe, filter ) {
    if( applicableCategoryTypes.includes( recipe.criteriaType ) ) {
        // Get the filter separator value from the preference AW_FacetValue_Separator
        let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        recipe.criteriaValues.splice( recipe.criteriaValues.indexOf( filter.internalName ), 1 );

        // TODO : The Partitions are shown as "pseudo Hierarchy" by appending "- " in beginning of name
        // To Populate Recipe We need Only its display name, so replacing "- " pattern from start of filter name to ''
        // This needs to be cleaned up once it start showing using aw-tree widget.
        let displayFilterValue = filter.name.replace( new RegExp( '^(\- )*', 'g' ), '' );

        let caretInFrontDisplayValue = filterSeparator + displayFilterValue;
        let caretInBacktDisplayValue = displayFilterValue + filterSeparator;
        if( recipe.criteriaDisplayValue.includes( caretInFrontDisplayValue ) ) {
            recipe.criteriaDisplayValue = recipe.criteriaDisplayValue.replace( caretInFrontDisplayValue, '' );
        } else {
            recipe.criteriaDisplayValue = recipe.criteriaDisplayValue.replace( caretInBacktDisplayValue, '' );
        }
    }
};

/*
   * Find the given filter in the transient recipe list
   */
let findFilterInTransientRecipeList = function( recipes, filter ) {
    let recipeFound;
    for( let entry in recipes ) {
        if( applicableCategoryTypes.includes( recipes[ entry ].criteriaType ) && recipes[ entry ].criteriaValues[ 0 ] === filter.categoryName ) {
            for( let index = 1; index < recipes[ entry ].criteriaValues.length; index++ ) {
                if( recipes[ entry ].criteriaValues[ index ] === filter.internalName ) {
                    recipeFound = recipes[ entry ];
                    break;
                }
            }
        }
    }
    return recipeFound;
};

/*
   * Removes the filter if present from the filterValues and returns the orphan date entries in the filterValues.
   */
let getOrphanDateEntries = function( filterValues, filter ) {
    let dateFilters = [];
    if( filter === null || filter.internalName === undefined ) {
        dateFilters = filterValues;
    } else {
        for( let value in filterValues ) {
            if( filterValues[ value ].internalName !== filter.internalName ) {
                dateFilters.push( filterValues[ value ] );
            }
        }
    }
    return removeOrphanDateEntries( dateFilters );
};


/*
   * Add a spatial/selected element recipe
   */
let addRecipe = function( recipeState, sharedData, productContextInfoUID, cachedActiveGroupIndex ) {
    // Clone the current recipe if needed.
    cloneCurrentRecipesIfNeeded( productContextInfoUID );
    let addedRecipe = sharedData.recipeTermToAdd;
    let clonedRecipeGroup = _.cloneDeep( recipeState.recipeGroup );
    // add the new recipe to transient recipes map
    let groupCriteriaOperatorType;
    if ( !clonedRecipeGroup || clonedRecipeGroup.length === 0 ) {
        groupCriteriaOperatorType = 'Include';
    }
    addRecipeToCacheForCurrentPCI( clonedRecipeGroup, addedRecipe, productContextInfoUID, cachedActiveGroupIndex, sharedData.spatialRecipeIndexToUpdate, groupCriteriaOperatorType );
    // sync recipes in cache to update the view model
    return updateRecipesInCache( sharedData, productContextInfoUID );
};

let getActiveFiltersForSearchStateAfterDelete = function( searchState, category, deletedRecipe, filterValuesDeselected ) {
    let filtersForCategory = searchState.activeFilters && searchState.activeFilters[ deletedRecipe.criteriaValues[ 0 ] ] ?
        searchState.activeFilters[ deletedRecipe.criteriaValues[ 0 ] ] : [];
    let updatedFilters = [];
    for( let index = 0; index < filtersForCategory.length; index++ ) {
        if( !filterValuesDeselected.includes( filtersForCategory[ index ] ) ) {
            updatedFilters.push( filtersForCategory[ index ] );
        }
    }

    let modifiedActiveFilters;
    if( searchState.activeFilters ) {
        modifiedActiveFilters = searchState.activeFilters;

        if( updatedFilters.length > 0 ) {
            modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ] = updatedFilters;
        } else {
            delete modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ];
        }
        if( category && category.type === 'DateFilter' && modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ] && modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ].length > 0 ) {
            modifiedActiveFilters = searchFilterService.removeDependentDateFilters( modifiedActiveFilters );
        }
    }
    return modifiedActiveFilters;
};

/*
   * Update search state with new filter map based on given categories
   */
let updateSearchStateAfterFilterChange = function( searchState, searchStateUpdater, modifiedCategories, modifiedActiveFilters ) {
    const updateSearchStateAtomicData = searchStateUpdater.searchState;

    const selectedFiltersMap = getSelectedFiltersMap( modifiedCategories );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );

    const filterString = searchFilterService.buildFilterString( selectedFiltersMap );
    if( !modifiedActiveFilters ) {
        let activeFiltersInfo = searchCommonUtils.createActiveFiltersFromActiveFilterMap( selectedFiltersInfo.activeFilterMap );
        modifiedActiveFilters = activeFiltersInfo.activeFilters;
    }

    updateSearchStateAtomicData( {
        ...searchState,
        categories: modifiedCategories,
        filterString: filterString,
        activeFilters: modifiedActiveFilters,
        activeFilterMap: selectedFiltersInfo.activeFilters
    } );
};

/*
   * Update filter value selections for the category of deleted recipe
   */
let findAndUpdateCategoryWithFilterDeselection = function( modifiedCategories, deletedRecipe, updatedRecipe, deselectedFilters, activeGroupIndex ) {
    let category;
    let dateFilterDeleted;
    let indexToUpdate;
    for( let index = 0; index < modifiedCategories.length; index++ ) {
        // Check for Date filter, Spatial filter and Attribute filters to find the category to update
        if( modifiedCategories[ index ].internalName === deletedRecipe.criteriaValues[ 0 ] ||
              modifiedCategories[ index ].type === 'DateFilter' && deletedRecipe.criteriaValues[ 0 ].startsWith( modifiedCategories[ index ].internalName ) ||
              modifiedCategories[ index ].internalName === 'SpatialSearch' && isSpatialRecipe( deletedRecipe ) ) {
            category = modifiedCategories[ index ];
            indexToUpdate = index;
            for( let k = 0; k < category.filterValues.length; k++ ) {
                if( deselectedFilters.includes( category.filterValues[ k ].internalName ) ) {
                    category.filterValues[ k ].selected.dbValue = false;
                    category.filterValues[ k ].selected.value = false;
                    if( category.type === 'DateFilter' ) {
                        dateFilterDeleted = _.cloneDeep( category.filterValues[ k ] );
                    }
                    deselectedFilters.splice( deselectedFilters.indexOf( category.filterValues[ k ].internalName ), 1 );
                    if( deselectedFilters.length === 0 ) {
                        break;
                    }
                }
            }
            break;
        }
    }

    let multiValueTermDeletedOrUpdated = isMultiValueTermDeletedOrUpdated( deletedRecipe, updatedRecipe, activeGroupIndex );
    let isWildCardRecipe = deletedRecipe.criteriaValues[ 1 ].indexOf( '_$WCARD_' ) !== -1;
    if(  multiValueTermDeletedOrUpdated[ 0 ] || !multiValueTermDeletedOrUpdated[ 1 ] ) {
        //If the deleted recipe is a wildcard recipe then enable the facet values.
        for( let index = 0; index < modifiedCategories.length; index++ ) {
            if ( modifiedCategories[ index ].categoryType === 'Attribute' && modifiedCategories[ index ].type !== 'DateFilter' &&
                modifiedCategories[ index ].internalName === deletedRecipe.criteriaValues[ 0 ] ) {
                category = modifiedCategories[ index ];
                category.wildcardOperatorList = [];
                if( isWildCardRecipe ) {
                    for( let index = 0; index < category.filterValues.length; index++ ) {
                        category.filterValues[ index ].selected.isEnabled = true;
                    }
                }
                break;
            }
        }
    }
    return [ category, indexToUpdate, dateFilterDeleted ];
};

/*
   * Do search state and filter cache changes upon delete of recipe in bulk apply mode
   */
let modifySearchStateAndFilterCacheAfterRecipeDelete = function( searchState, searchStateUpdater, deletedRecipe,
    updatedRecipe, deselectedFilters, recipesToDisplay, productContextInfoUID, activeGroupIndex ) {
    let filterValuesDeselectedCopy = _.clone( deselectedFilters );
    let modifiedCategories = searchState.categories;
    // Find category in search state whose filter value selections/editability have to be updated and toggle/enable filter selection
    let [ category, indexToUpdate, dateFilterDeleted ] = findAndUpdateCategoryWithFilterDeselection( modifiedCategories, deletedRecipe, updatedRecipe, deselectedFilters, activeGroupIndex );

    // Update the discovery filter cache with changed selections of filters
    // Re-evaluate category toggle visibility
    //TODO: Add activeGroupIndex
    //modifiedCategories = getCategoriesWithUpdatedCategoryLogicAfterFilterChange( modifiedCategories, recipesToDisplay ); //9096 not toggle
    if( dateFilterDeleted ) {
        // Date filters are a special case as we have to remove orphan date filters
        modifiedCategories = syncDateFiltersInCacheOnFilterChange( modifiedCategories, searchState.colorToggle, category, dateFilterDeleted, productContextInfoUID );
    } else {
        // All other filters except date are updated in cache
        modifiedCategories[ indexToUpdate ] = category;
        let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
        updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( modifiedCategories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, productContextInfoUID );
    }
    // Update active filter array in search state and set updated filter map on search state
    // This will trigger the view update
    let modifiedActiveFilters = getActiveFiltersForSearchStateAfterDelete( searchState, category, deletedRecipe, filterValuesDeselectedCopy );
    updateSearchStateAfterFilterChange( searchState, searchStateUpdater, modifiedCategories, modifiedActiveFilters );
};

/*
   * Do search state, filter cache and recipe state changes upon delete of recipe in bulk apply mode
   */
let updateSearchStateAfterRecipeDelete = function( searchStateUpdater, searchState, deletedRecipe, updatedRecipes, recipesToDisplay, productContextInfoUID, activeGroupIndex ) {
    // Modify filter cache and search state with updated selections
    if( deletedRecipe && ( applicableCategoryTypes.includes( deletedRecipe.criteriaType ) || isSpatialRecipe( deletedRecipe ) ) ) {
        // Get removed filters from deleted recipe
        let filterValuesDeselected = updateDeselectedFiltersOnDelete( deletedRecipe, updatedRecipes, productContextInfoUID, activeGroupIndex );
        // Filter cache and search state update
        modifySearchStateAndFilterCacheAfterRecipeDelete( searchState, searchStateUpdater, deletedRecipe,
            updatedRecipes, filterValuesDeselected, recipesToDisplay, productContextInfoUID, activeGroupIndex );
    }
};

/**
   * Process the recipe update - delete of recipe, operator change on recipe, proximity value change
   * @param {Object} updatedRecipes - updated recipe list.
   * @param {Object} deletedRecipe - deleted recipe term.
   * @param {Object} modifiedGroupIndex - active group from which recipe is modified.
   * @param {Object} updateAtomicData - atomic data updater.
   * @param {Object} searchState - filter panel atomic data.
   * @param {Object} recipeState - recipe component atomic data.
   * @param {Object} sharedData - shared data with sub panels.
   * @param {Object} occContext - ace atomic data.
   */
export let processRecipeOnUpdate = function( updatedRecipes, deletedRecipe, modifiedGroupIndex, updateAtomicData, searchState, recipeState, sharedData, occContext ) {
    // Clone the current recipe if needed.
    cloneCurrentRecipesIfNeeded( occContext.productContextInfo.uid );

    // Update the transient recipes map
    // Remove orphan date recipes on delete
    let orphanDateRecipes = [];
    if( deletedRecipe ) {
        orphanDateRecipes = getOrphanDateRecipesOnDelete( deletedRecipe, updatedRecipes );
        for( let i = 0; i < orphanDateRecipes.length; i++ ) {
            updatedRecipes[0].subCriteria.splice( updatedRecipes[0].subCriteria.indexOf( orphanDateRecipes[ i ] ), 1 );
        }
        // The last recipe is being deleted after orphan date recipes are removed
        if( updatedRecipes[0].subCriteria.length === 0 ) {
            updatedRecipes[ 0 ].criteriaOperatorType = 'Clear';
        }
        if( deletedRecipe.criteriaType === 'Partition' ) {
            let isPartitionPresentInUpdatedRecipe = false;
            if( updatedRecipes[modifiedGroupIndex] && updatedRecipes[modifiedGroupIndex].criteriaOperatorType !== 'Clear' ) {
                _.forEach( updatedRecipes[modifiedGroupIndex].subCriteria, function( subCriteria ) {
                    if( subCriteria.criteriaType === 'Partition' && subCriteria.criteriaValues[0] ===  deletedRecipe.criteriaValues[0] ) {
                        isPartitionPresentInUpdatedRecipe = true;
                        return false;
                    }
                } );
            }
            updatePartitionRecipeInDelayMode( deletedRecipe, searchState, true, isPartitionPresentInUpdatedRecipe );
        }
    }

    replaceRecipesToCacheForCurrentPCI( updatedRecipes, occContext.productContextInfo.uid );

    // Sync recipes in cache to update the view model
    let [ recipesToDisplay, enableApply, enableClearButton ] = updateRecipesInCache( sharedData, occContext.productContextInfo.uid  );

    const newSharedData = { ...sharedData.getValue() };
    newSharedData.activeGroupIndex = 0;

    let isNumberOfGroupsChanged = recipeState.recipeGroup.length !== updatedRecipes.length;
    if( modifiedGroupIndex === sharedData.activeGroupIndex ) {
        // Recipe term has been deleted from active group. It may or may not be group delete
        if ( isNumberOfGroupsChanged ) {
            // Here we know, active group has been deleted
            // searchState update need to be done, for new group which will be active now.
            if ( modifiedGroupIndex === updatedRecipes.length && updatedRecipes[modifiedGroupIndex - 1] ) {
                // The deleted group is last group, hence active index will be change by -1.
                // searchState update will be done automatically, by observer on activeGroupIndex
                newSharedData.activeGroupIndex = modifiedGroupIndex - 1;
            } else {
                // The active group index not changed. But the group at active index will be replaced with new group.
                // Here we need searchState update
                newSharedData.activeGroupIndex = sharedData.activeGroupIndex;
                newSharedData.shouldUpdateActiveGroupOnState = true;
            }
        } else {
            newSharedData.activeGroupIndex = sharedData.activeGroupIndex;
            updateSearchStateAfterRecipeDelete( updateAtomicData, searchState, deletedRecipe, updatedRecipes, recipesToDisplay, occContext.productContextInfo.uid, modifiedGroupIndex );
        }
    } else if ( modifiedGroupIndex < sharedData.activeGroupIndex ) {
        // active group appears next to modified non-active group
        if ( isNumberOfGroupsChanged && sharedData.activeGroupIndex > 0 ) {
            // non-active group is deleted
            // Same active group will appear at activeIndex - 1
            newSharedData.activeGroupIndex = sharedData.activeGroupIndex - 1;
        } else {
            // Number of groups not changed. Active group index would remain same
            newSharedData.activeGroupIndex = sharedData.activeGroupIndex;
        }
    } else {
        // Case : modifiedGroupIndex > sharedData.activeGroupIndex
        // Only recipe state update required. SearchState, or view update is not required
        newSharedData.activeGroupIndex = sharedData.activeGroupIndex;
    }


    if( sharedData.autoApply ) {
        let updateSearchStateAtomicData = updateAtomicData.searchState;
        let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters( searchState );
        updateSearchStateAtomicData( newSearchState );
        // doNotTriggerSubsetInfoSoa is set as true because we do not wanto to trigger a getSubsetInfo SOA call due to activeGroupIndex
        // update on sharedData. We get the updated search filter map from getOcc SOA call as this is a filter apply use case.
        newSharedData.doNotTriggerSubsetInfoSoa = newSharedData.shouldUpdateActiveGroupOnState;
        newSharedData.enableClearButton = enableClearButton;
        sharedData.update && sharedData.update( newSharedData );
        // Trigger SOA call to apply filter/recipe
        applyFilter( updatedRecipes, occContext );
        return;
    }

    newSharedData.enableFilterApply = enableApply;
    newSharedData.enableClearButton = enableClearButton;

    recipeState.update && recipeState.update( { ...recipeState, recipeGroup: recipesToDisplay } );
    sharedData.update && sharedData.update( newSharedData );
};

/*
* Add a given criteria(attribute/spatial) to transient recipe cache.
*/
let addRecipeToCacheForCurrentPCI = function( currentRecipe, newRecipeToAdd, productContextInfoUID, activeGroupIndex, spatialRecipeIndexToUpdate, groupCriteriaOperatorType ) {
    let pciVsRecipeInfoEntry = {};

    let newTransientRecipe;
    let updatedRecipeToDisplay;
    if( !currentRecipe ) {
        newTransientRecipe = [];
    } else {
        newTransientRecipe = _.cloneDeep( currentRecipe );
    }

    let isRecipeReplaced = false;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        let recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );

        let transientRecipeGroupSubCriteria = [];
        if( recipesData && recipesData[ 0 ] ) {
            if( recipesData[ 0 ].transientRecipes.length === 1 && recipesData[ 0 ].transientRecipes[ 0 ].criteriaOperatorType === 'Clear' ) {
                recipesData[ 0 ].transientRecipes = [];
            } else {
                if( activeGroupIndex < recipesData[ 0 ].transientRecipes.length ) {
                    transientRecipeGroupSubCriteria = recipesData[ 0 ].transientRecipes[activeGroupIndex].subCriteria;
                }
            }
            if( newRecipeToAdd && !_.isEmpty( newRecipeToAdd ) ) {
                if( newRecipeToAdd.criteriaType === 'Proximity' ) {
                    if( spatialRecipeIndexToUpdate >= 0 && spatialRecipeIndexToUpdate < transientRecipeGroupSubCriteria.length ) {
                        transientRecipeGroupSubCriteria[ spatialRecipeIndexToUpdate ] = newRecipeToAdd;
                    } else {
                        transientRecipeGroupSubCriteria.push( newRecipeToAdd );
                    }
                } else {
                    // It replaces the new updated recipe in the transient list and returns true
                    isRecipeReplaced = replaceRecipeForExistingCategory( transientRecipeGroupSubCriteria, newRecipeToAdd );

                    // Add the new recipe to transient list
                    if( !isRecipeReplaced ) {
                        if( _.isEmpty( transientRecipeGroupSubCriteria[transientRecipeGroupSubCriteria.length - 1] ) ) {
                            transientRecipeGroupSubCriteria = [ newRecipeToAdd ];
                        } else {
                            transientRecipeGroupSubCriteria.push( newRecipeToAdd );
                        }
                    }
                }
            }

            if( activeGroupIndex < recipesData[0].transientRecipes.length ) {
                recipesData[ 0 ].transientRecipes[activeGroupIndex].subCriteria = transientRecipeGroupSubCriteria;
                if( newRecipeToAdd.criteriaOperatorType === 'Clear' && transientRecipeGroupSubCriteria.length === 0 ) {
                    recipesData[ 0 ].transientRecipes.splice( activeGroupIndex, 1 );
                }
            } else {
                let recipe = {
                    criteriaOperatorType : groupCriteriaOperatorType,
                    criteriaType: 'Group',
                    subCriteria: transientRecipeGroupSubCriteria
                };
                if( recipesData[0].transientRecipes.length > 0 && recipesData[0].transientRecipes[recipesData[0].transientRecipes.length - 1].criteriaOperatorType === 'Exclude' ) {
                    let notGroup = recipesData[0].transientRecipes.splice( recipesData[0].transientRecipes.length - 1, 1 );
                    recipesData[0].transientRecipes.push( recipe  );
                    recipesData[0].transientRecipes.push( notGroup[0]  );
                }else{
                    recipesData[0].transientRecipes.push( recipe  );
                }
            }

            updatedRecipeToDisplay = _.cloneDeep( recipesData[ 0 ].transientRecipes );
        } else {
            let newGroup = { criteriaOperatorType : groupCriteriaOperatorType, criteriaType: 'Group',  subCriteria: [ newRecipeToAdd ] };
            newTransientRecipe.push( newGroup );
            pciVsRecipeInfoEntry = {
                pciUid: productContextInfoUID,
                transientRecipes: newTransientRecipe
            };
            pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
            updatedRecipeToDisplay = _.cloneDeep( newTransientRecipe );
        }
    } else {
        let newGroup;
        if( _.isEmpty( newRecipeToAdd ) ) {
            // Initializing the subCriteria differently if empty group is created to maintain the consistency that
            // when a empty group is created, we keep the lenght of subCriteria as zero.
            // This is required because, on filter panel load, subCriteria length is used to decide enablement of create Group commands
            newGroup = { criteriaOperatorType : groupCriteriaOperatorType, criteriaType: 'Group',  subCriteria: [] };
        } else{
            newGroup = { criteriaOperatorType : groupCriteriaOperatorType, criteriaType: 'Group',  subCriteria: [ newRecipeToAdd ] };
        }
        if( newTransientRecipe.length > 0 && newTransientRecipe[newTransientRecipe.length - 1].criteriaOperatorType === 'Exclude' ) {
            let notGroup = newTransientRecipe.splice( newTransientRecipe.length - 1, 1 );
            newTransientRecipe.push( newGroup  );
            newTransientRecipe.push( notGroup[0]  );
        } else{
            newTransientRecipe.push( newGroup );
        }
        pciVsRecipeInfoEntry = {
            pciUid: productContextInfoUID,
            transientRecipes: newTransientRecipe
        };
        pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
        updatedRecipeToDisplay = _.cloneDeep( newTransientRecipe );
    }

    return updatedRecipeToDisplay;
};

/**
   * Replace the given recipes in the transient recipe map for the current pciuid
   * @param {Object} updatedRecipes updated list of recipes
   * @param {Object} productContextInfoUID PCI UID
   */
let replaceRecipesToCacheForCurrentPCI = function( updatedRecipes, productContextInfoUID ) {
    let recipesData;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
    }
    if( recipesData && recipesData[ 0 ] ) {
        recipesData[ 0 ].transientRecipes = _.cloneDeep( updatedRecipes );
    }
};

/*
   * Create an initial list of transient recipes from the existing persistent recipes.
   * The cloned list is created on the first edit before the apply.
   */
let cloneCurrentRecipesIfNeeded = function( productContextInfoUID ) {
    let clonedRecipes = _.cloneDeep( recipeHandler.getPersistentRecipe( _contextKey, productContextInfoUID ) );

    if( clonedRecipes.length > 0 ) {
        let transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );
        if( transientRecipes === undefined ) {
            // There is no entry in pciToRecipeMap for the current pciuid yet.
            // Create an entry and add the cloned recipes
            let newRecipes = [];
            _.forEach( clonedRecipes, function( currentRecipe ) {
                newRecipes.push( currentRecipe );
            } );
            let pciVsRecipeInfoEntry = {
                pciUid: productContextInfoUID,
                transientRecipes: newRecipes
            };
            pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
        } else if( transientRecipes.length === 0 ) {
            _.forEach( clonedRecipes, function( currentRecipe ) {
                transientRecipes.push( currentRecipe );
            } );
            replaceRecipesToCacheForCurrentPCI( transientRecipes, productContextInfoUID );
        }
    }
};

/*
   * Lookup and return the transient recipes for the given product context info uid
   */
let lookupRecipesInfoInCache = function( productContextInfoUID ) {
    let recipesData;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
        if( recipesData && recipesData[ 0 ] ) {
            return recipesData[ 0 ].transientRecipes;
        }
    }
};


/*
  * Update recipes in transient recipe cache
  */
let updateRecipesInCache = function( sharedData, productContextInfoUID ) {
    let enableApply = false;
    let enableClearButton = false;

    // Retrieve all the transient recipe list
    let transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );

    // Add all the selected transient recipes to the new recipe list.
    // Remove all the deselected transient recipes from the
    // new recipe(which includes current recipe) list.
    let recipesToDisplay = transientRecipes;
    if( transientRecipes ) {
        updatePersistedRecipeInfoInCache( productContextInfoUID ); //9096: why update persistent recipe here?
        // This is persisted recipe list
        let currentRecipes = recipeHandler.getPersistentRecipe( _contextKey, productContextInfoUID );
        if( currentRecipes.length > 0 ) {
            enableClearButton = true;
        }

        if( !sharedData.autoApply ) {
            let transientRecipesToDisplay = [];
            _.forEach( transientRecipes, function( transientRecipe ) {
                if( transientRecipe.criteriaOperatorType !== 'Clear' ) {
                    transientRecipesToDisplay.push( transientRecipe );
                }
            } );
            enableApply = areRecipesChanged( currentRecipes, transientRecipesToDisplay );
            recipesToDisplay = transientRecipesToDisplay;
            if( recipesToDisplay.length > 0 ) {
                enableClearButton = true;
            } else {
                enableClearButton = false;
            }
        }
        if( recipesToDisplay && recipesToDisplay.length === 1 && recipesToDisplay[ 0 ].criteriaOperatorType === 'Clear' ) {
            // Case where the transient recipe was cleared
            //and then the bulk apply mode was reset to auto apply
            recipesToDisplay = [];
            enableClearButton = false;
        }
        updateTransientRecipeInCache( _.cloneDeep( transientRecipes ), productContextInfoUID );
    } else {
        updatePersistedRecipeInfoInCache( productContextInfoUID );
        recipesToDisplay = recipeHandler.getPersistentRecipe( _contextKey, productContextInfoUID );
        if( recipesToDisplay.length > 0 ) {
            enableClearButton = true;
        }
    }
    revalidateIncludeExcludeCommandVisibility( recipesToDisplay );
    return [ recipesToDisplay, enableApply, enableClearButton ];
};

/*
   * Check if the list of current recipes are different from the list of transient recipes.
   */
let areRecipesChanged = function( currentRecipes, newRecipes ) {
    if( currentRecipes.length !== newRecipes.length ) {
        // recipe is added or deleted
        //TODO: may have to check if group is empty and should contain recipe
        return true;
    }
    if( currentRecipes.length === 0 && newRecipes.length === 0 ) {
        // No change
        return false;
    }
    for( let j = 0; j < newRecipes.length; j++ ) {
        if( currentRecipes[j].criteriaOperatorType !== newRecipes[j].criteriaOperatorType ) {
            // recipe is cleared
            return true;
        }
        let newSubCriteria = newRecipes[j].subCriteria;
        let currentSubCriteria = currentRecipes[j].subCriteria;
        if( newSubCriteria.length !== currentSubCriteria.length ) {
            //TODO: may have to check if group is empty and should contain recipe
            return true;
        }
        for( let i = 0; i < newSubCriteria.length; i++ ) {
            if( newSubCriteria[ i ].criteriaType !== currentSubCriteria[ i ].criteriaType ||
                newSubCriteria[ i ].criteriaOperatorType !== currentSubCriteria[ i ].criteriaOperatorType ||
                newSubCriteria[ i ].criteriaValues.length !== currentSubCriteria[ i ].criteriaValues.length ) {
                return true;
            }
            for( let k = 0; k < newSubCriteria[ i ].criteriaValues.length; k++ ) {
                if( newSubCriteria[ i ].criteriaValues[ k] !== currentSubCriteria[ i ].criteriaValues[ k ] ) {
                    return true;
                }
            }
        }
    }

    return false;
};

let syncDateFiltersInCacheOnFilterChange = function( processedCategories, colorToggle, category, filter, productContextInfoUID ) {
    let filterValues = _.cloneDeep( category.filterValues );
    let dateRemovedEntries = getOrphanDateEntries( filterValues, filter );

    let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
    let rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    let soaFilterValues = filter.categoryName ? rawFilterMapValues[ filter.categoryName ] : rawFilterMapValues[ category.internalName ];

    for( let i = 0; i < soaFilterValues.length; i++ ) {
        if( soaFilterValues[ i ].stringValue === filter.internalName ) {
            soaFilterValues[ i ].selected = filter.selected.value;
            if( !dateRemovedEntries || dateRemovedEntries.length === 0 ) {
                break;
            }
        } else if( dateRemovedEntries.includes( soaFilterValues[ i ].stringValue ) ) {
            soaFilterValues[ i ].selected = false;
        }
    }


    if( !filter.categoryName ) {
        rawFilterMapValues[ category.internalName ] = soaFilterValues;
    }else{
        rawFilterMapValues[ filter.categoryName ] = soaFilterValues;
    }
    category.filterValues = filterPanelService.getFiltersForCategory( category,
        rawFilterMapValues, undefined, colorToggle );

    let modifiedCategories = _.cloneDeep( processedCategories );
    for( let j = 0; j < modifiedCategories.length; j++ ) {
        if( category.internalName === modifiedCategories[ j ].internalName ) {
            modifiedCategories[ j ] = category;
            break;
        }
    }
    updateCategoriesInfoCacheForCurrentPCI( modifiedCategories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, productContextInfoUID );
    return modifiedCategories;
};


let isMultiValueTermDeletedOrUpdated = function( deletedRecipe, updatedRecipe, activeGroupIndex ) {
    let criteriaValuesInDelete = deletedRecipe.criteriaValues;
    let clearAllValues = false;
    let recipeFound = false;
    _.forEach( updatedRecipe[activeGroupIndex].subCriteria, function( subCriteria ) {
        if( subCriteria.criteriaValues[ 0 ] === criteriaValuesInDelete[ 0 ] ) {
            recipeFound = true;
            if( updatedRecipe[ activeGroupIndex ].criteriaOperatorType === 'Clear' ) {
                clearAllValues = true;
                return false;
            }
        }
    } );
    return [ clearAllValues, recipeFound ];
};

/*
   * Update the local pci to filter values cache and update the view model given deleted recipe
   */
let updateDeselectedFiltersOnDelete = function( deletedRecipe, updatedRecipe, productContextInfoUID, activeGroupIndex ) {
    let filterValuesDeselected = [];

    if( applicableCategoryTypes.includes( deletedRecipe.criteriaType ) ) {
        let multiValueTermDeletedOrUpdated = isMultiValueTermDeletedOrUpdated( deletedRecipe, updatedRecipe, activeGroupIndex );
        let criteriaValuesInDelete = deletedRecipe.criteriaValues;

        if( multiValueTermDeletedOrUpdated[ 0 ] || !multiValueTermDeletedOrUpdated[ 1 ] ) {
            // Entire recipe term is deleted
            if( deletedRecipe.criteriaType === 'Partition' ) {
                for( let j = 0; j < criteriaValuesInDelete.length; j++ ) {
                    filterValuesDeselected.push( criteriaValuesInDelete[ j ] );
                }
            } else{
                for( let j = 1; j < criteriaValuesInDelete.length; j++ ) {
                    syncFilterInfo( null, criteriaValuesInDelete[ 0 ], criteriaValuesInDelete[ j ], false, false, productContextInfoUID );
                    filterValuesDeselected.push( criteriaValuesInDelete[ j ] );
                }
            }
        } else {
            // Value in recipe term is deleted, sync filter value
            _.forEach( updatedRecipe[activeGroupIndex].subCriteria, function( subCriteria ) {
                if( subCriteria.criteriaValues[ 0 ] === criteriaValuesInDelete[ 0 ] ) {
                    for( let k = 1; k < criteriaValuesInDelete.length; k++ ) {
                        if( !subCriteria.criteriaValues.includes( criteriaValuesInDelete[ k ] ) ) {
                            syncFilterInfo( null, criteriaValuesInDelete[ 0 ], criteriaValuesInDelete[ k ], false, false, productContextInfoUID );
                            filterValuesDeselected.push( criteriaValuesInDelete[ k ] );
                            break;
                        }
                    }
                    return false;
                }
            } );
        }
    } else if( isSpatialRecipe( deletedRecipe ) && !spatialRecipeExists( updatedRecipe, deletedRecipe.criteriaType ) ) {
        syncFilterInfo( null, 'SpatialSearch', deletedRecipe.criteriaType, false, false, productContextInfoUID );
        filterValuesDeselected.push( deletedRecipe.criteriaType );
    }
    return filterValuesDeselected;
};

/*
   * Sync facet selections in updateFilterValues from performFacetSearch from transient recipe cache the in delay mode
   */
let syncFiltersInCacheOnFacetSearch = function( updatedFilterValues, updatedCatName, filterBy, productContextInfoUID, activeGroupIndex ) {
    // Retrieve all the transient recipe list
    let recipesToSyncWith = lookupRecipesInfoInCache( productContextInfoUID );
    if( recipesToSyncWith === undefined || recipesToSyncWith.length === 0 ) {
        recipesToSyncWith = recipeHandler.getPersistentRecipe(  _contextKey, productContextInfoUID );
        if( recipesToSyncWith === undefined || recipesToSyncWith.length === 0 ) {
            return;
        }
    }

    // Sync facet selections for updateFilterValues for transientRecipe is one and deleted //9096
    if( recipesToSyncWith.length === 1 && recipesToSyncWith[ 0 ].criteriaOperatorType === 'Clear' &&
         recipesToSyncWith[ 0 ].subCriteria[0].criteriaValues[ 0 ] === updatedCatName ) {
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( recipesToSyncWith[ 0 ].subCriteria[0].criteriaValues.includes( filterValue.stringValue ) &&
                  filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
        return;
    }

    // Find transient recipe matching the category name 9096
    let recipeFound;
    if( recipesToSyncWith[activeGroupIndex] !== undefined ) {
        for( let recipe in recipesToSyncWith[activeGroupIndex].subCriteria ) {
            if( recipesToSyncWith[activeGroupIndex].subCriteria[ recipe ].criteriaValues !== undefined
                && recipesToSyncWith[activeGroupIndex].subCriteria[ recipe ].criteriaValues[ 0 ] === updatedCatName ) {
                recipeFound = recipesToSyncWith[activeGroupIndex].subCriteria[ recipe ];
                break;
            }
        }
    }

    if( recipeFound ) {
        // Sync facet selections for updateFilterValues for transient recipe term
        // If any filterValues that are found in the recipe is not selected, then set the selected as true.
        // If any filterValues that are NOT found in the recipe is selected then set the selected as false.
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( recipeFound.criteriaValues.includes( filterValue.stringValue ) ) {
                if( !filterValue.selected ) {
                    filterValue.selected = true;
                }
            } else if( filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
        // If any recipe is not found in the filterValues then create a filter value entry to be in sync with recipe.
        // This is for the case when selected transient recipe value is not returned in the filterValues since it is not
        // in the current page returned. try this
        if( applicableCategoryTypes.includes( recipeFound.criteriaType ) ) {
            let updatedFilterStringValues = [];
            _.forEach( updatedFilterValues, function( filterValue ) {
                updatedFilterStringValues.push( filterValue.stringValue );
            } );

            for( let index = 1; index < recipeFound.criteriaValues.length; index++ ) {
                if( !updatedFilterStringValues.includes( recipeFound.criteriaValues[ index ] ) &&
                      ( filterBy !== undefined && ( filterBy.length > 0 && recipeFound.criteriaValues[ index ].indexOf( filterBy ) !== -1 || filterBy.length === 0 ) ) ) {
                    //Create a filter value entry
                    let missingFilter = {};
                    missingFilter.selected = true;
                    missingFilter.stringValue = recipeFound.criteriaValues[ index ];
                    missingFilter.stringDisplayValue = recipeFound.criteriaValues[ index ];
                    missingFilter.searchFilterType = 'StringFilter';
                    updatedFilterValues.push( missingFilter );
                }
            }
        }
    } else {
        // Set facet selections for updateFilterValues to false if persisted recipe term is deleted in transient mode
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
    }
};

let clearFilterInfo = function( searchState, recipeState, searchStateUpdater, productContextInfoUID, activeGroupIndex ) {
    let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
    let rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    //TODO: May not need to do this as the stores filter map will not have any values
    for( let rawFilterMapKey in rawFilterMapValues ) {
        let filterValues = rawFilterMapValues[ rawFilterMapKey ];
        for( let i = 0; i < filterValues.length; i++ ) {
            filterValues[ i ].selected = false;
        }
        rawFilterMapValues[ rawFilterMapKey ] = filterValues;
    }
    //9096 : send processCategory = true to process categories to keep them collapsed when no filter selected
    const newSearchState = updateFilterInfo( searchState, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, true,
        productContextInfoUID, activeGroupIndex, true, recipeState, true );
    // Clear category logic before updating search state
    let categories = newSearchState.categories;
    let discWildcardFilterEnabledPrefValue = appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter[0] === 'true';
    for( let j in categories ) {
        if( discWildcardFilterEnabledPrefValue ) {
            categories[j].isExcludeCategorySupported = false; //9096 not toggle
        } else {
            categories[j].isExcludeCategorySupported = true; //9096 not toggle
        }
    }
    //To retain the facet search string in delayed mode when reopening the filter panel after clearing recipe
    categories.forEach( newCat => {
        const matchingObj = searchState.categories.find( cat => newCat.internalName === cat.internalName );
        if ( matchingObj && matchingObj.facetSearchString ) {
            newCat.facetSearchString = matchingObj.facetSearchString;
        }
    } );
    newSearchState.categories = categories;
    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( newSearchState.categories ), newSearchState.searchFilterCategories,
        newSearchState.searchFilterMap, rawCategoriesInfo.recipe, productContextInfoUID );
    let updateSearchStateAtomicData = searchStateUpdater.searchState;
    updateSearchStateAtomicData( newSearchState );
};

/*
   * Update the local pci to filter values cache and update the view model
   */
let syncFilterInfo = function( processedCategories, categoryName, filterValue, selected, update, productContextInfoUID ) {
    let rawCategoriesInfo = getRawCategoriesAndCategoryValues( productContextInfoUID );
    let rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    let filterValues = rawFilterMapValues[ categoryName ];
    if( filterValues ) {
        for( let i = 0; i < filterValues.length; i++ ) {
            if( filterValues[ i ].stringValue === filterValue ) {
                filterValues[ i ].selected = selected;
                break;
            }
        }
        rawFilterMapValues[ categoryName ] = filterValues;
    }
    if( update ) {
        let clonedProcessedCategories = _.cloneDeep( processedCategories );
        updateCategoriesInfoCacheForCurrentPCI( clonedProcessedCategories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, productContextInfoUID );
    }
    return processedCategories;
};

/**
   * Check  if product is discovery indexed.
   *
   * @returns {boolean} : Returns true if discovery indexed
   */
export let isDiscoveryIndexed = function() {
    let isDiscovery = false;
    let context = appCtxSvc.getCtx( _contextKey );
    if( context && context.currentState && context.currentState.pci_uid && cdm.isValidObjectUid( context.currentState.pci_uid ) ) {
        let supportedFeatures =  occmgmtStateHandler.getSupportedFeaturesFromPCI( cdm.getObject( context.currentState.pci_uid ) );
        if( supportedFeatures && supportedFeatures.Awb0EnableSmartDiscoveryFeature ) {
            isDiscovery = true;
        }
    }
    return isDiscovery;
};

let setCalculateFilters = function( calculateFiltersValue ) {
    let value = {
        requestPref: {
            calculateFilters: calculateFiltersValue
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
};

let registerListeners = function() {
    if( !_onDiscoveryFilterPanelCloseListener ) {
        _onDiscoveryFilterPanelCloseListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
            if( eventData && eventData.name === 'activeNavigationCommand' && _onDiscoveryFilterPanelCloseListener ) {
                // Unregister all listeners when panel is closed.
                unregisterListeners();
            }
        }, 'discoveryFilterService' );
    }
};

let unregisterListeners = function() {
    if( _onDiscoveryFilterPanelCloseListener ) {
        eventBus.unsubscribe( _onDiscoveryFilterPanelCloseListener );
        _onDiscoveryFilterPanelCloseListener = null;
    }

    if( discoveryFilterEventSubscriptions ) {
        _.forEach( discoveryFilterEventSubscriptions, function( subDef ) {
            eventBus.unsubscribe( subDef );
        } );
        discoveryFilterEventSubscriptions = [];
    }
};

export let processInitialFilterSettingsPreferences = function( result, activeViewSharedData, sharedData ) {
    let autoApply; let prefValue;
    let includeWithChildren;
    if( result && result.response.length > 0 ) {
        for( let i = 0; i < result.response.length; i++ ) {
            if( result.response[ i ].definition.name === 'AWC_Discovery_Delayed_Filter_Apply' ) {
                prefValue = result.response[ i ].values.values[ 0 ];
                // hosted filter panel does not support autoApply
                if( prefValue.toUpperCase() === 'FALSE' && occmgmtSubsetUtils.isAdvancedFilterComponentHosted() ) {
                    autoApply = false;
                } else if( prefValue.toUpperCase() === 'TRUE' ) {
                    autoApply = false;
                } else {
                    autoApply = true;
                }
            } else if( result.response[ i ].definition.name === 'AWS_SelectElement_IncludeChildren' ) {
                prefValue = result.response[ i ].values.values[ 0 ];
                if( prefValue.toUpperCase() === 'TRUE' ) {
                    includeWithChildren = true;
                } else if( prefValue.toUpperCase() === 'FALSE' ) {
                    includeWithChildren = false;
                }
            }
        }
    }
    occmgmtSubsetUtils.updateFilterTogglesOnSharedData( activeViewSharedData, sharedData, '', autoApply, includeWithChildren );
};

/**
   * Evaluate if the selected elements are valid for adding to include/exclude recipe terms
   * @param {Object} validSelectedObjects list of valid selected objects
   *
   */
export let validateTermsToIncludeOrExclude = function( validSelectedObjects ) {
    if( validSelectedObjects && validSelectedObjects.length >= 1 && validSelectedObjects.length === appCtxSvc.ctx.mselected.length ) {
        occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeAndExclude', true, 'filter' );
        var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
        var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
        var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );
        if( transientRecipes && transientRecipes.length > 0 && transientRecipes[ 0 ].criteriaOperatorType !== 'Clear' ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', true, 'filter' );
        }  else if( transientRecipes && transientRecipes.length > 0 && transientRecipes[ 0 ].criteriaOperatorType === 'Clear' ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', false, 'filter' );
        } else if( occMgmtCtx.productContextInfo && occMgmtCtx.productContextInfo.props.awb0FilterCount &&
              occMgmtCtx.productContextInfo.props.awb0FilterCount.dbValues[ 0 ] > 0 ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', true, 'filter' );
        } else {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', false, 'filter' );
        }
    } else {
        occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOR', false, 'filter' );
        occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeAndExclude', false, 'filter' );
    }
};

/**
   * Clear all the cache in this service. This function is called on Reset
   *
   */
export let clearAllCacheOnReset = function() {
    clearCache();
    clearPersistentRecipeFromCache();
    clearTransientRecipeInfo();
    clearRecipeCache( true );
    pciToCategoryLogicMap = [];
    pciToWildcardListMap = [];
};

/**
   * Initialize
   * @param {Object} sharedData shared data with sub panel
   */
export let initialize = function( sharedData ) {
    if( discoveryFilterEventSubscriptions.length === 0 ) {
        discoveryFilterEventSubscriptions.push( eventBus.subscribe( 'ace.resetStructureStarted', function() {
            if(  isDiscoveryIndexed() || createWorksetService.isWorkset( appCtxSvc.ctx.mselected[ 0 ] )  ) {
                const newSharedData = { ...sharedData.getValue() };
                // setResetInitiated is called only when activeGroupIndex is not zero
                // This is required to avoid getSubsetInfo soa call when activeGroupIndex is set to 0 on reset of structure
                if( newSharedData.activeGroupIndex !== 0 ) {
                    setResetInitiated();
                    newSharedData.activeGroupIndex = 0;
                }
                newSharedData.enableFilterApply = false;
                newSharedData.enableClearButton = false;
                sharedData.update && sharedData.update( newSharedData );
            }
        } ) );

        eventBus.subscribe( 'ace.updateFilterPanel', function() {
            if( isDiscoveryIndexed() ) {
                let context = appCtxSvc.getCtx( _contextKey );
                if( context ) {
                    setCalculateFilters( true );
                }
            }
        } );
    }
    proximityFilterService.initialize();
    registerListeners();
};

export let clearRecipe = function( searchState, recipeState, searchStateUpdater, occContext, sharedData ) {
    let updatedRecipeOnClear = [];
    // Create dummy recipe first term with operator clear
    let recipe = recipeHandler.getPersistentRecipe( _contextKey, occContext.productContextInfo.uid );
    if( recipe && recipe.length > 0 ) {
        // If persisted recipe has non zero recipe term
        // Create recipe with one term and 'Clear' operator so that when user applies
        // the recipe, server understands it as clearing the recipe
        let recipeToClear = _.cloneDeep( recipe[ 0 ] );
        recipeToClear.criteriaOperatorType = 'Clear';
        updatedRecipeOnClear.push( recipeToClear );
    }

    let pciUID = occContext.productContextInfo.uid;
    let pciToRecipeInfo;
    // Clear transient map
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        let recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );
        if( recipesData && recipesData[ 0 ] ) {
            recipesData[ 0 ].transientRecipes = updatedRecipeOnClear;
        } else {
            pciToRecipeInfo = {
                pciUid: pciUID,
                transientRecipes: updatedRecipeOnClear
            };
            pciToTransientRecipesMap.push( pciToRecipeInfo );
        }
    } else {
        pciToRecipeInfo = {
            pciUid: pciUID,
            transientRecipes: updatedRecipeOnClear
        };
        pciToTransientRecipesMap.push( pciToRecipeInfo );
    }

    if( pciToCategoryLogicMap ) {
        let categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );

        if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
            // Update existing entry for category logic cache
            let categoryLogicMap = categoryLogicEntry[ 0 ].categoryLogicMap;
            let keys = Object.keys( categoryLogicMap );
            _.forEach( keys, function( key ) {
                categoryLogicMap[ key ] = true; // default logic is true implying 'Filter'
            } );
            categoryLogicEntry[ 0 ].categoryLogicMap = categoryLogicMap;
        }
    }

    const newSharedData = { ...sharedData.getValue() };
    // Apply filter if in auto-update mode
    if( searchState.autoApplyFilters ) {
        let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters( searchState );
        searchStateUpdater.searchState( newSearchState );
        newSharedData.enableClearButton = false;
        sharedData.update && sharedData.update( newSharedData );
        applyFilter( updatedRecipeOnClear, occContext );
    } else {
        updateTransientRecipeInCache( updatedRecipeOnClear, pciUID );
        // Update recipe state
        let updateRecipeStateAtomicData = searchStateUpdater.recipeState;
        updateRecipeStateAtomicData( { ...recipeState, recipeGroup: [] } );

        // Update search state
        clearFilterInfo( searchState, recipeState, searchStateUpdater, pciUID, sharedData.activeGroupIndex );

        revalidateIncludeExcludeCommandVisibility( [] );

        // Enable Filter button
        let currentRecipes = _.cloneDeep( recipeHandler.getPersistentRecipe( _contextKey, pciUID ) );
        let shouldEnableApply = areRecipesChanged( currentRecipes, updatedRecipeOnClear );
        newSharedData.enableFilterApply = shouldEnableApply;
        newSharedData.enableNewGroup = false;
        newSharedData.enableNotGroup = false;
        newSharedData.enableClearButton = false;
        newSharedData.activeGroupIndex = 0;
        sharedData.update && sharedData.update( newSharedData );
    }
};
/**
 * AW Server returns date ranges in criteriadisplayvalue in UTC format.
 * Date range in AW client is diplayed in dd-month-year format
 * @param {*} recipes
 */

let updateDateRangeDisplayInRecipes = function( recipes ) {
    if( recipes && recipes.length > 0 ) {
        for( let j = 0; j < recipes.length; j++ ) {
            for( let k = 0;  k < recipes[j].subCriteria.length; k++ ) {
                if( recipes[j].subCriteria[ k ].criteriaDisplayValue.lastIndexOf( '_$RANGE_' ) > 0 ) {
                    //This is date range. correct the display string
                    let recipeCategoryString = recipes[j].subCriteria[ k ].criteriaDisplayValue.split( '_$CAT_' )[ 0 ];
                    let recipeValuesString = recipes[j].subCriteria[ k ].criteriaDisplayValue.split( '_$CAT_' )[ 1 ];
                    let startDateRange = recipeValuesString.split( '_$RANGE_' )[ 0 ];
                    let endDateRange = recipeValuesString.split( '_$RANGE_' )[ 1 ];
                    if ( startDateRange ) {
                        startDateRange = dateTimeService.formatDate( startDateRange );
                    }
                    if ( endDateRange ) {
                        endDateRange = dateTimeService.formatDate( endDateRange );
                    }
                    let updatedDisplayStirng = recipeCategoryString + '_$CAT_' + startDateRange + '_$RANGE_' + endDateRange;
                    recipes[j].subCriteria[k].criteriaDisplayValue = updatedDisplayStirng;
                }
            }
        }
    }
};

/**
   * This method is to do post processing of recipes after getSubsetInfo3 SOA call is done.
   * This includes populating Subset panel's Viewmodel data
   * @param {Object} recipes list of recipes
   * @param {Object} sharedData panel shared data
   * @param {Object} occContext ace context object
   * @param {Object} resetGroupIndex boolean indicating to reset group index to 0 when true
   */
let processRecipeFromSubsetResponse = function( recipes, sharedData, occContext, resetGroupIndex ) {
    if( recipes ) {
        //9096 added check on length, as recipes exist but is empty array in delay mode when added recipe
        //9096 : if check on length is done here then on 'clearall' in delay mode on applying filter persistent recipe is not updated
        updateDateRangeDisplayInRecipes( recipes );
        recipeHandler.setPersistentRecipe( _contextKey, occContext.productContextInfo.uid, _.cloneDeep( recipes ) );
    }
    clearRecipeCache( false );
    let enableNotGroup = true;
    if( recipes.length > 0  && recipes[recipes.length - 1].criteriaOperatorType === 'Exclude' ) {
        enableNotGroup = false;
    }

    const newSharedData = { ...sharedData.getValue() };
    let updateSharedData = false;
    if( recipes.length > 0 ) {
        updateSharedData = true;
        newSharedData.enableClearButton = true;
    }
    if( _.isUndefined( newSharedData.enableFilterApply ) || newSharedData.enableFilterApply  ) {
        // modify shared data only if required
        updateSharedData = true;
        newSharedData.enableFilterApply = false;
    }
    if( _.isUndefined( newSharedData.enableNewGroup ) || !newSharedData.enableNewGroup ) {
        // modify shared data only if required
        updateSharedData = true;
        newSharedData.enableNewGroup = recipes.length > 0;
    }
    if( _.isUndefined( newSharedData.enableNotGroup ) || !newSharedData.enableNotGroup ) {
        // modify shared data only if required
        updateSharedData = true;
        newSharedData.enableNotGroup = enableNotGroup;
    }
    if( resetGroupIndex ) {
        updateSharedData = true;
        newSharedData.activeGroupIndex = 0;
    }
    if( updateSharedData ) {
        sharedData.update && sharedData.update( newSharedData );
    }
};

export let getSubsetInfoSoaInput = function( occContext ) {
    let productContextInfoUID = occContext.productContextInfo.uid;
    let subsetInputs = [ {
        productInfo: {
            type: 'Awb0ProductContextInfo',
            uid: productContextInfoUID
        },
        requestPref: {},
        searchFilterFieldSortType: '',
        searchSortCriteria: []
    } ];
    if( appCtxSvc.ctx[ _contextKey ].isShowConnection === true ) {
        subsetInputs[ 0 ].requestPref.includeConnections = _TRUE;
    }
    return subsetInputs;
};

export let initializeSearchStateFromSoaResponse = function( searchState, sharedData, occContext, searchFilterCategories, searchFilterMap, recipe,
    processCategories, resetGroupIndex, processRecipe, recipeState ) {
    let newSearchState = {};
    let activeGroupIndex = resetGroupIndex ? 0 : sharedData.activeGroupIndex;
    if( ( occContext.readOnlyFeatures ? !occContext.readOnlyFeatures.Awb0StructureFilterFeature : true ) &&
        searchFilterCategories && searchFilterCategories.length > 0 && searchFilterMap ) {
        newSearchState = updateFilterInfo( searchState, searchFilterCategories, searchFilterMap, recipe,
            processCategories, occContext.productContextInfo.uid, activeGroupIndex, processRecipe, recipeState, false );
    }
    if( processRecipe ) {
        processRecipeFromSubsetResponse( recipe, sharedData, occContext, resetGroupIndex );
    }

    if( sharedData.autoApply ) {
        newSearchState.autoApplyFilters = true;
    } else {
        newSearchState.autoApplyFilters = false;
    }
    newSearchState.searchInProgress = false;
    if( recipe && recipe.length > 0 && recipe[activeGroupIndex] && recipe[activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
        for( let j in newSearchState.categories ) {
            newSearchState.categories[ j ].isExcludeCategorySupported = false;
        }
    }
    return newSearchState;
};

export let processGetSubsetInfoSoaResponse = ( response, searchState, sharedData, occContext, processRecipe, recipeState ) => {
    if( !response || !response.filterOut || response.filterOut.length === 0 ) {
        return {};
    }
    if( response && response.filterOut && response.filterOut.length > 0 ) {
        let groupRecipe =  response.filterOut[ 0 ].recipe;

        let resetGroupIndex = false;
        return initializeSearchStateFromSoaResponse( searchState, sharedData, occContext, response.filterOut[ 0 ].searchFilterCategories,
            response.filterOut[ 0 ].searchFilterMap, groupRecipe,
            true, resetGroupIndex, processRecipe, recipeState );
    }
};

export let getRecipeStateFromSoa = ( response, searchState, recipeState, sharedData, occContext ) => {
    if( response && response.filterOut && response.filterOut.length > 0 ) {
        recipeState.recipeGroup =  response.filterOut[ 0 ].recipe;
    }
    if( sharedData && sharedData.recipeTermToAdd && sharedData.recipeTermToAdd.criteriaType === 'SelectedElement' ) {
        let response = updateSearchStateOnPanelLoad( searchState, recipeState, sharedData, occContext );
        if( response ) {
            return response.recipeState;
        }
    }

    return recipeState;
};


export let updateSearchStateAfterFilterAction = ( filter, category, updateAtomicData, searchState, recipeState, sharedData, occContext, wildcardOperator, wildcardChanged, isNumericCategory  ) => {
    if( searchState.categories && searchState.categories.length > 0 ) {
        // New filter map and filter string generation after filter selection
        const updateSearchStateAtomicData = updateAtomicData.searchState;
        const updateRecipeStateAtomicData = updateAtomicData.recipeState;
        let selectedFiltersMap = {};
        if( category.daterange && (  filter.startDate && filter.startDate.dateApi && filter.startDate.dateApi.dateValue !== ''
         || filter.endDate && filter.endDate.dateApi && filter.endDate.dateApi.dateValue !== '' ) ) {
            //LCS-986229 date range flow
            let searchFilterMap = {};
            let dateRangeString = filter.startDate.dateApi.dateValue + '_$RANGE_' + filter.endDate.dateApi.dateValue;
            searchFilterMap[ category.internalName ] = [ dateRangeString ];
            selectedFiltersMap = searchFilterMap;
        }else{ //original flow
            selectedFiltersMap = getSelectedFiltersMap( searchState.categories );
        }
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
        const newFilterString = searchFilterService.buildFilterString( selectedFiltersMap );
        let activeFiltersInfo = searchCommonUtils.createActiveFiltersFromActiveFilterMap( selectedFiltersInfo.activeFilterMap );
        let activeFilters = activeFiltersInfo.activeFilters;
        if( !wildcardChanged && searchState.filterString !== newFilterString && !( _.isEmpty( newFilterString ) && searchState.filterString === undefined )
            || wildcardOperator && _.isUndefined( wildcardChanged ) ) {
            let filterRecipe = generateRecipeFromSelectedFilters( filter, category, recipeState.recipeGroup, occContext.productContextInfo.uid,
                sharedData.activeGroupIndex, wildcardOperator, isNumericCategory );
            if( searchState.autoApplyFilters && !_.isEmpty( searchState.filterString ) && _.isEmpty( newFilterString )
            && recipeState.recipeGroup && recipeState.recipeGroup.length === 1 && recipeState.recipeGroup[0].subCriteria && recipeState.recipeGroup[0].subCriteria.length === 1 ) {
                // recipe is being cleared
                filterRecipe = generateRecipeWithClearOperator( searchState.filterString, searchState.categories );
            }
            if( searchState.autoApplyFilters ) {
                let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters( searchState );
                updateSearchStateAtomicData( newSearchState );
                applyFilter( filterRecipe, occContext );
                return;
            }
            // sync filters to update the cache and view model
            let modifiedCategories = searchState.categories;
            if( category.type === filterPanelUtils.DATE_FILTER ) {
                // Modify cache with update filter and category logic information
                modifiedCategories = syncDateFiltersInCacheOnFilterChange( modifiedCategories, searchState.colorToggle, category, filter, occContext.productContextInfo.uid );
                updateSearchStateAfterFilterChange( searchState, updateAtomicData, modifiedCategories, null );
            } else {
                if( filterRecipe.length > 0 && filterRecipe[sharedData.activeGroupIndex] ) {
                    //sync the facet values enablement based on recipe operator
                    modifiedCategories = syncFacetEnablementBasedOnRecipe( category, filterRecipe[sharedData.activeGroupIndex].subCriteria, true, occContext.productContextInfo.uid, modifiedCategories );
                }
                // Modify cache with update filter and category logic information
                //TODO: Reevaluate if we need to persist categories
                //modifiedCategories = syncFiltersInCacheOnFilterChange( modifiedCategories, category, filter, occContext.productContextInfo.uid );
                modifiedCategories = initializeWildcardListCache( modifiedCategories, filterRecipe, undefined, sharedData.activeGroupIndex );
                updateSearchStateAfterFilterChange( searchState, updateAtomicData, modifiedCategories, null );
            }

            // sync recipes in cache to update the view model
            let recipeUpdateObj = updateRecipesInCache( sharedData, occContext.productContextInfo.uid );
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = recipeUpdateObj[1];
            newSharedData.enableClearButton = recipeUpdateObj[2];
            if( filterRecipe.length === 0 || filterRecipe[filterRecipe.length - 1] &&
                filterRecipe[filterRecipe.length - 1].subCriteria && filterRecipe[filterRecipe.length - 1].subCriteria.length === 0 ) {
                newSharedData.enableNewGroup = false;
            }else {
                newSharedData.enableNewGroup = true;
            }
            if( filterRecipe.length === 0 || filterRecipe.length > 0 && filterRecipe[filterRecipe.length - 1].criteriaOperatorType === 'Exclude' ) {
                newSharedData.enableNotGroup = false;
            } else{
                newSharedData.enableNotGroup = true;
            }
            // Set active group to current group if possible, otherwise default to first group
            newSharedData.activeGroupIndex = 0;
            if( filterRecipe[sharedData.activeGroupIndex] ) {
                newSharedData.activeGroupIndex = sharedData.activeGroupIndex;
            }
            sharedData.update && sharedData.update( newSharedData );
            updateRecipeStateAtomicData( { ...recipeState, recipeGroup: filterRecipe } );
        } else if( wildcardChanged ) {
            // On wildcard change we may need to change recipe operator type
            toggleCategoryLogic( category, null, updateAtomicData, searchState, recipeState, sharedData, occContext, wildcardChanged, wildcardOperator );
        }
    }
};

let clearCategoriesFromSearchStateBeforeApplyingFilters = function( searchState ) {
    let newSearchState = {};
    newSearchState.searchInProgress = true;
    newSearchState.hideBulkModeActionCommand = true;
    if( searchState.categoriesWithMoreThanDefaultNumberOfFiltersShown ) {
        newSearchState.categoriesWithMoreThanDefaultNumberOfFiltersShown = searchState.categoriesWithMoreThanDefaultNumberOfFiltersShown;
    }
    return newSearchState;
};

let generateFilterMapForRecipeInActiveGroup = function( currentRecipe, staticFilterMap ) {
    if( !currentRecipe || currentRecipe.length === 0 ) {
        return staticFilterMap;
    }
    let clonedSearchFilterMap = _.cloneDeep( staticFilterMap );
    if ( clonedSearchFilterMap ) {
        _.forEach( currentRecipe, function( recipe ) {
            if( recipe.criteriaType === 'Proximity' || recipe.criteriaType === 'BoxZone' || recipe.criteriaType === 'PlaneZone' ) {
                let filterValues = clonedSearchFilterMap.SpatialSearch;
                for( let i = 0; i < filterValues.length; i++ ) {
                    if( filterValues[ i ].stringValue === recipe.criteriaType ) {
                        filterValues[ i ].selected = true;
                    }
                }
            } else if( applicableCategoryTypes.includes( recipe.criteriaType ) ) {
                let filterValues = clonedSearchFilterMap[recipe.criteriaValues[0]];
                let startingIndex = 1;
                if( recipe.criteriaType === 'Partition' ) {
                    filterValues = clonedSearchFilterMap.PartitionScheme;
                    startingIndex = 0;
                } else{
                    filterValues = clonedSearchFilterMap[recipe.criteriaValues[0]];
                }

                if ( filterValues ) {
                    for( let j = startingIndex; j < recipe.criteriaValues.length; j++ ) {
                        for( let k = 0; k < filterValues.length; k++ ) {
                            if( filterValues[ k ].stringValue === recipe.criteriaValues[j] ) {
                                filterValues[ k ].selected = true;
                            }
                        }
                    }
                }
            }
        } );
    }
    return clonedSearchFilterMap;
};


let generateRecipeWithClearOperator = function( filterString, categories ) {
    let recipeList = [];
    let values = filterString.split( '=' );

    let selectedCategory = null;
    // Find Selected Category
    for( let j = 0; j < categories.length; j++ ) {
        if( categories[ j ].internalName === values[ 0 ] || categories[ j ].type === 'DateFilter' && values[ 0 ].startsWith( categories[ j ].internalName ) ) {
            selectedCategory = categories[ j ];
            break;
        }
    }

    if( selectedCategory !== null ) {
        let recipe = {
            criteriaDisplayValue: '',
            criteriaOperatorType: 'Clear',
            criteriaType: 'Group',
            criteriaValues: [],
            subCriteria: []
        };
        recipeList.push( recipe );
    }

    return recipeList;
};

let getCriteriaValueForWildcard = function( wildcardOperator, wildcardFilterValue ) {
    let wildcardCriteriaVal = '';
    if ( wildcardOperator === 'equals' || wildcardOperator === 'notequals' ) {
        wildcardCriteriaVal = wildcardFilterValue;
    } else {
        wildcardCriteriaVal = wildcardOperator + '_$WCARD_' + wildcardFilterValue;
    }
    return wildcardCriteriaVal;
};

let getCriteriaDisplayValueForWildcard = function( wildcardOperator, wildcardFilterValue ) {
    let displayValue = '';
    let resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    if( wildcardOperator === 'equals' || wildcardOperator === 'notequals' ) {
        displayValue = wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'contains' ) {
        displayValue = '*' + wildcardFilterValue.internalName + '*';
    } else if( wildcardOperator === 'startswith' ) {
        displayValue = wildcardFilterValue.internalName + '*';
    } else if( wildcardOperator === 'endswith' ) {
        displayValue = '*' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'like' ) {
        displayValue = resource.likeOperator.valueOf() + ' ' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'gt' ) {
        displayValue = '>' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'gte' ) {
        displayValue = '>=' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'lt' ) {
        displayValue = '<' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'lte' ) {
        displayValue = '<=' + wildcardFilterValue.internalName;
    } else if( wildcardOperator === 'rangeinclusive' ) {
        displayValue = resource.rangeSeparator.format( '>=' + wildcardFilterValue.startValue, '<=' + wildcardFilterValue.endValue );
    } else if( wildcardOperator === 'rangeexclusive' ) {
        displayValue = resource.rangeSeparator.format( '>' + wildcardFilterValue.startValue, '<' + wildcardFilterValue.endValue );
    }
    return displayValue;
};

let createRecipeWithWildcard = function( selectedFilter, category, wildcardOperator, recipes, isNumericCategory ) {
    let criteriaVal = [];
    let recipeOperator = 'Filter';
    let recipeExists;
    let criteriaDisplayValue = '';

    let filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    if( wildcardOperator === 'notequals' ) {
        recipeOperator = 'Exclude';
        wildcardOperator = 'equals';
    } else if( wildcardOperator === 'notcontains' ) {
        recipeOperator = 'Exclude';
        wildcardOperator = 'contains';
    }

    recipeExists = getRecipeForExistingCategory( recipes, selectedFilter );
    // For numeric category types, the recipe is replaced with new value and not updated.
    // Currently, server does not support multivalued recipes for numeric type of values.
    if( recipeExists && !isNumericCategory ) {
        let recipe = _.cloneDeep( recipeExists );
        // Get the filter separator value from the preference AW_FacetValue_Separator
        if( !recipe.criteriaValues.includes( selectedFilter.internalName ) ) {
            if( selectedFilter.internalName !== '' ) {
                if( wildcardOperator === 'equals' ) {
                    recipe.criteriaValues.push( selectedFilter.internalName );
                } else {
                    recipe.criteriaValues[1] += filterSeparator + selectedFilter.internalName;
                }
            }
            criteriaDisplayValue = getCriteriaDisplayValueForWildcard( wildcardOperator, selectedFilter );
            recipe.criteriaDisplayValue += filterSeparator + criteriaDisplayValue;
            recipe.criteriaOperatorType = recipeOperator;
        }
        return recipe;
    }
    let wildcardCriteriaVal;
    if( wildcardOperator === 'rangeinclusive' || wildcardOperator === 'rangeexclusive' ) {
        wildcardCriteriaVal = wildcardOperator + '_$WCARD_' + selectedFilter.startValue + filterSeparator + selectedFilter.endValue;
    } else {
        wildcardCriteriaVal = getCriteriaValueForWildcard( wildcardOperator, selectedFilter.internalName );
    }
    criteriaVal.push( category.internalName );
    if( wildcardOperator === 'equals' ) {
        criteriaVal.push( selectedFilter.internalName );
    } else {
        criteriaVal.push( wildcardCriteriaVal );
    }
    criteriaDisplayValue = category.displayName +  '_$CAT_' + getCriteriaDisplayValueForWildcard( wildcardOperator, selectedFilter );
    return {
        criteriaDisplayValue: criteriaDisplayValue,
        criteriaOperatorType: recipeOperator,
        criteriaType: category.categoryType,
        criteriaValues: criteriaVal,
        subCriteria: []
    };
};

let generateRecipeFromSelectedFilters = function( selectedFilter, categoryOfSelectedFilter, currentRecipe, productContextInfoUID, activeGroupIndex, wildcardOperator, isNumericCategory ) {
    cloneCurrentRecipesIfNeeded( productContextInfoUID );
    let transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );

    let transientRecipeGroupSubCriteria;
    let foundInTransientRecipe;
    if( transientRecipes && activeGroupIndex < transientRecipes.length ) {
        transientRecipeGroupSubCriteria = transientRecipes[activeGroupIndex].subCriteria;
        foundInTransientRecipe = findFilterInTransientRecipeList( transientRecipeGroupSubCriteria, selectedFilter );
    }

    let clonedRecipe = _.cloneDeep( currentRecipe );
    if( wildcardOperator ) {
        let recipeToAdd;
        if( _.isEmpty( clonedRecipe )  || activeGroupIndex > clonedRecipe.length - 1 ) {
            recipeToAdd = createRecipeWithWildcard( selectedFilter, categoryOfSelectedFilter, wildcardOperator, [], isNumericCategory );
        } else {
            recipeToAdd = createRecipeWithWildcard( selectedFilter, categoryOfSelectedFilter, wildcardOperator, clonedRecipe[activeGroupIndex].subCriteria, isNumericCategory );
        }
        let groupCriteriaOperatorType;
        if ( !clonedRecipe || clonedRecipe.length === 0 ) {
            groupCriteriaOperatorType = 'Include';
        }
        clonedRecipe = addRecipeToCacheForCurrentPCI( clonedRecipe, recipeToAdd, productContextInfoUID, activeGroupIndex, undefined, groupCriteriaOperatorType );
    } else if(  selectedFilter.selected && selectedFilter.selected.value  ||
    ( selectedFilter.startDate && selectedFilter.startDate.dateApi && selectedFilter.startDate.dateApi.dateValue !== ''  ||
     selectedFilter.endDate && selectedFilter.endDate.dateApi && selectedFilter.endDate.dateApi.dateValue !== ''  ) ) {
        let recipeToAdd;
        // User is selecting the filter.
        // Create a new criteria and update the cache if it is already not in current recipe list
        if( _.isEmpty( clonedRecipe )  || activeGroupIndex > clonedRecipe.length - 1 ) {
            recipeToAdd = createRecipeForGivenCategory( categoryOfSelectedFilter, selectedFilter, [], productContextInfoUID );
        } else {
            recipeToAdd = createRecipeForGivenCategory( categoryOfSelectedFilter, selectedFilter, clonedRecipe[activeGroupIndex].subCriteria, productContextInfoUID );
        }
        let groupCriteriaOperatorType;
        if ( !clonedRecipe || clonedRecipe.length === 0 ) {
            groupCriteriaOperatorType = 'Include';
        }
        clonedRecipe = addRecipeToCacheForCurrentPCI( clonedRecipe, recipeToAdd, productContextInfoUID, activeGroupIndex, undefined, groupCriteriaOperatorType );
    } else {
        // User is deselecting the filter. Remove it from transient recipe list
        if( foundInTransientRecipe ) {
            if( transientRecipes.length === 1 && transientRecipeGroupSubCriteria.length === 1 && transientRecipeGroupSubCriteria[ 0 ].criteriaValues.length === 2 ) {
                // The last recipe is being deselected
                transientRecipes[ 0 ].criteriaOperatorType = 'Clear';
                // Update view model recipe
                clonedRecipe = [];
            } else {
                if( foundInTransientRecipe.criteriaValues.length > 2 ) {
                    // Attribute recipe with multiple values
                    removeCriteriaValueFromCategory( foundInTransientRecipe, selectedFilter );
                } else {
                    transientRecipeGroupSubCriteria.splice( transientRecipeGroupSubCriteria.indexOf( foundInTransientRecipe ), 1 );
                }
                if ( transientRecipes[ activeGroupIndex ].subCriteria.length === 0 ) {
                    transientRecipes.splice( activeGroupIndex, 1 );
                }
                clonedRecipe = _.cloneDeep( transientRecipes );
            }
            replaceRecipesToCacheForCurrentPCI( transientRecipes, productContextInfoUID );
        }
    }

    return clonedRecipe;
};


export let modifySearchStateWithUpdatedFilters = ( searchState, recipeState, sharedData, occContext, updateAtomicData ) => {
    if( occContext && occContext.searchFilterMap && ( searchState.searchInProgress || searchState.categories ) ) {
        let resetGroupIndex = false;
        if( sharedData.activeGroupIndex >= occContext.recipe.length ) {
            resetGroupIndex = true;
        }
        const newSearchState = initializeSearchStateFromSoaResponse( searchState, sharedData, occContext, occContext.searchFilterCategories, occContext.searchFilterMap,
            occContext.recipe, true, resetGroupIndex, true );
        revalidateIncludeExcludeCommandVisibility( occContext.recipe );
        const newRecipeState = { ...recipeState };
        newRecipeState.recipeGroup = _.cloneDeep( occContext.recipe );
        let updateSearchAtomicData = updateAtomicData.searchState;
        let updateRecipeAtomicData = updateAtomicData.recipeState;
        updateRecipeAtomicData( newRecipeState );
        updateSearchAtomicData( newSearchState );
    }
};

export let restoreCategoriesAfterFailedConcurrentSave = function( searchState, sharedData, occContext ) {
    _removeTempRecipeObjFromAppCtx( occContext );
    let pciUid = occContext.productContextInfo.uid;
    let soaCategoriesInfo = getRawCategoriesAndCategoryValues( pciUid );
    return initializeSearchStateFromSoaResponse( searchState, sharedData, occContext, soaCategoriesInfo.rawCategories,
        soaCategoriesInfo.rawCategoryValues, soaCategoriesInfo.recipe, true, undefined, true );
};

/**
   * To switch between discovery sub panel and structure filter panel
   * @param {Object} sharedData - shared data
   * @param {Object} occmgmtContext - current occContext object
   * @param {Object} updateAtomicData - atomic data updater
   * @param {Object} subPanelContext - subpanelContext
   */
export const updateSharedActiveViewBasedOnPCI = ( sharedData, occmgmtContext, updateAtomicData, subPanelContext ) => {
    let newSharedData;
    if( sharedData ) {
        newSharedData = sharedData.value ? { ...sharedData.getValue() } : { ...sharedData };
    } else {
        newSharedData = {};
    }

    if( subPanelContext !== undefined && subPanelContext.popupApi ) {
        newSharedData.popupApi = subPanelContext.popupApi;
        newSharedData.popupOptions = subPanelContext.popupOptions;
    }

    let currentActiveView = newSharedData.activeView;

    if( occmgmtContext && occmgmtContext.supportedFeatures && occmgmtContext.supportedFeatures.Awb0EnableSmartDiscoveryFeature ) {
        if( currentActiveView && !_resetInitiated &&  ( currentActiveView === 'ProximitySubPanel' || currentActiveView === 'BoxZoneSubPanel' ||
                    currentActiveView === 'PlaneZoneSubPanel' || currentActiveView === 'Awb0FilterPanelSettings' ||  currentActiveView === 'PartitionHierarchySubPanel' ) ) {
            return;
        }
        newSharedData.activeView = 'Awb0DiscoveryFilterCommandSubPanel';
    } else {
        newSharedData.activeView = 'Awb0StructureFilterCommandSubPanel';
    }
    if( _resetInitiated ) {
        _resetInitiated = false;
    }
    if( currentActiveView !== newSharedData.activeView ) {
        let activeViewSharedDataUpdater  = updateAtomicData.activeViewSharedData;
        activeViewSharedDataUpdater( newSharedData );
    }
};

let addSpatialRecipeInDelayMode = function( recipeToAdd, searchState ) {
    // Update selected flag for Spatial recipe and modify cached categories and values

    for( let index = 0; index < searchState.categories.length; index++ ) {
        let category = searchState.categories[ index ];
        if( category.categoryType === 'Spatial' ) {
            for( let i = 0; i < category.filterValues.length; i++ ) {
                if( category.filterValues[ i ].internalName === recipeToAdd.criteriaType ) {
                    category.filterValues[ i ].selected.dbValue = true;
                    break;
                }
            }
            break;
        }
    }
};

let updatePartitionRecipeInDelayMode = function( recipeToAdd, searchState, isDeleteOfRecipe, isPartitionPresentInUpdatedRecipe ) {
    for( let index = 0; index < searchState.categories.length; index++ ) {
        let category = searchState.categories[ index ];
        if( category.categoryType === 'Partition'  ) {
            for( let i = 0; i < category.filterValues.length; i++ ) {
                for( let j = 0; j < recipeToAdd.criteriaValues.length; j++ ) {
                    if( category.filterValues[ i ].internalName === recipeToAdd.criteriaValues[j] ) {
                        category.filterValues[ i ].selected.dbValue = false;
                        if ( recipeToAdd.criteriaOperatorType !== 'Clear' && !isDeleteOfRecipe || isDeleteOfRecipe && isPartitionPresentInUpdatedRecipe ) {
                            category.filterValues[ i ].selected.dbValue = true;
                        }
                    }
                }
            }
            break;
        }
    }
};

/**
 * Construct search state with cache categories such that expansion state is retained
 * on reopen of filter panel
 *
 * @param {Object} searchState filter panel search state
 * @param {Object} recipeState recipe section atomic data
 * @param {Object} activeGroupIndex active group
 * @param {Object} autoApply  true if auto apply mode false if delay mode
 * @param {Object} pciUid product context info object
 * @param {Object} categories cached categories
 * @param {Object} categoriesExpandCollapseMap expand collapse category map
 * @returns {Object} search state
 */
let createSearchStateFromCachedCategories = function( searchState, recipeState, activeGroupIndex, autoApply, pciUid, categories, categoriesExpandCollapseMap ) {
    let newSearchState = { ...searchState };
    var soaCategoriesInfo = getRawCategoriesAndCategoryValues( pciUid );
    let defaultGroupRecipe = [];
    if( activeGroupIndex < recipeState.recipeGroup.length ) {
        defaultGroupRecipe = recipeState.recipeGroup[activeGroupIndex].subCriteria;
    }
    const modifiedSearchFilterMap = generateFilterMapForRecipeInActiveGroup( defaultGroupRecipe, soaCategoriesInfo.rawCategoryValues );
    var processedSearchFilterCategories = _.cloneDeep( searchCommonUtils.processOutputSearchFilterCategories( newSearchState, soaCategoriesInfo.rawCategories ) );

    newSearchState.searchFilterCategories = processedSearchFilterCategories;
    newSearchState.searchFilterMap =  modifiedSearchFilterMap;
    newSearchState.objectsGroupedByProperty = { internalPropertyName: '' };
    newSearchState.bulkFiltersApplied = false;
    if( autoApply ) {
        newSearchState.autoApplyFilters = true;
    } else {
        newSearchState.autoApplyFilters = false;
    }
    newSearchState.searchInProgress = false;

    processCategoriesMetaDataForRendering( modifiedSearchFilterMap, categories, false, defaultGroupRecipe, false );
    newSearchState.categories = categories;
    newSearchState.categoriesExpandCollapseMap = categoriesExpandCollapseMap;
    const appliedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( modifiedSearchFilterMap );
    newSearchState.appliedFilterMap = appliedFiltersInfo.activeFilterMap;
    newSearchState.filterString = searchFilterService.buildFilterString( modifiedSearchFilterMap );
    if( newSearchState.categories && newSearchState.categories.length > 0 ) {
        newSearchState.noFilterCategories = false;
    }
    if( recipeState && recipeState.recipeGroup.length > 0 && recipeState.recipeGroup[activeGroupIndex] && recipeState.recipeGroup[activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
        for( let j in newSearchState.categories ) {
            newSearchState.categories[ j ].isExcludeCategorySupported = false;
        }
    }
    return newSearchState;
};

let createSearchStateFromSubsetInfoSoa = function( searchState, recipeState, sharedData, occContext ) {
    let deferred = AwPromiseService.instance.defer();
    let newRecipeState = { ...recipeState };

    let newsearchState = { ...searchState };
    let subsetInputs = getSubsetInfoSoaInput( occContext );
    subsetInputs[0].recipe = [ newRecipeState.recipeGroup[sharedData.activeGroupIndex] ];
    soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-12-OccurrenceManagement', 'getSubsetInfo3', { subsetInputs } ).then(
        function( response ) {
            let updatedSearchState = processGetSubsetInfoSoaResponse( response, newsearchState, sharedData, occContext, false, recipeState );
            if( sharedData.autoApply ) {
                updatedSearchState.autoApplyFilters = true;
            } else {
                updatedSearchState.autoApplyFilters = false;
            }
            updatedSearchState.searchInProgress = false;
            if( recipeState && recipeState.recipeGroup.length > 0 && recipeState.recipeGroup[sharedData.activeGroupIndex].criteriaOperatorType === 'Exclude' ) {
                for( let j in updatedSearchState.categories ) {
                    updatedSearchState.categories[ j ].isExcludeCategorySupported = false;
                }
            }
            deferred.resolve( updatedSearchState );
        } );
    return deferred.promise;
};

let resetSharedDataOnPanelLoad = function( sharedData, enableFilterApply, updatedActiveGroupIndex, enableNewGroup, enableNotGroup, enableClearButton ) {
    const newSharedData = { ...sharedData.getValue() };
    newSharedData.enableFilterApply = enableFilterApply;
    newSharedData.enableNewGroup = enableNewGroup;
    newSharedData.enableNotGroup = enableNotGroup;
    newSharedData.enableClearButton = enableClearButton;
    newSharedData.spatialRecipeIndexToUpdate = undefined;
    newSharedData.recipeTermToAdd = undefined;
    if( !_.isUndefined( newSharedData.activeGroupIndex ) && newSharedData.activeGroupIndex !== updatedActiveGroupIndex ) {
        newSharedData.activeGroupIndex = updatedActiveGroupIndex;
    }
    sharedData.update && sharedData.update( newSharedData );
};


let updateCategoryLogicOnPanelLoad = function( pciUid, cachedSearchState, newRecipeState, updatedActiveGroupIndex ) {
    let isCategoryLogicMapPopulated = false;
    let categoryLogicEntry;
    if( pciToCategoryLogicMap ) {
        categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUid;
        } );
        if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
            isCategoryLogicMapPopulated = true;
        }
    }
    // Create new category logic cache if it does not exist for given PCI
    let modifiedCategories;
    if( !isCategoryLogicMapPopulated ) {
        modifiedCategories = initializeCategoryLogicCache( cachedSearchState.categories, newRecipeState.recipeGroup, undefined, updatedActiveGroupIndex );
    } else {
        modifiedCategories = initializeCategoryLogicCache( cachedSearchState.categories, newRecipeState.recipeGroup, categoryLogicEntry[ 0 ].categoryLogicMap, updatedActiveGroupIndex );
    }
    return modifiedCategories;
};

/**
* This method is used to initialize the filter panel with cached data or an event is published to
* fetch the data for the panel
* 1. Check if categories are cached for given Product
* 1.a If yes, then retrieve the categories from the cache
* * 1.a.1 If any of current recipe term is being updated then use group index for that term as active group index
* * 1.a.2 If not, then use the cached group index for finding the active group filters and categories from the cached static categories
* * 1.a.3 Get the persisted recipe in cache
* * 1.a.4 Once active group index is retrieved, create filter panel search state with the active group categories and filters
* * 1.a.5 If current recipe is being updated then modify the recipe array, update the shared data to set filter button
* *     visibility and reset sub panel data. Update search state and recipe state based on auto apply mode
* * 1.a.6 If recipe is not being updated then update the category logic cache and shared data to set filter button visibility.
* *     Update search state and recipe state based on auto apply mode.
* 1.b If not, then publish event such that SOA call is made to fetch categories for given product
*
* @param {Object} searchState search data for AwFilterPanel component in panel
* @param {Object} recipeState recipe data for recipe section in panel
* @param {Object} sharedData filter panel data shared between sub panels
* @param {Object} occContext ACE atomic data
* @returns {Object} search state and recipe state for filter panel
*/
export let updateSearchStateOnPanelLoad = function( searchState, recipeState, sharedData, occContext ) {
    let [ categories, cachedActiveGroupIndex ] = lookupCategoriesInfoInCache( occContext.productContextInfo.uid );
    if( categories ) {
        const sharedDataValue = { ...sharedData.getValue() };
        let updatedActiveGroupIndex = cachedActiveGroupIndex;
        if( sharedData.spatialRecipeIndexToUpdate >= 0 || sharedData.subPanelNavigateBack ) {
            // Use active group index for the recipe group where edit is being done
            // And update cached index
            updatedActiveGroupIndex = sharedDataValue.activeGroupIndex;
            updateActiveGroupInfoInCache( occContext.productContextInfo.uid, updatedActiveGroupIndex );
        }

        // Get recipe from persistent or transient cache
        let newRecipeState = { ...recipeState };
        let [ recipesToDisplay, enableFilterApply, enableClearButton ] = updateRecipesInCache( sharedData, occContext.productContextInfo.uid );
        newRecipeState.recipeGroup =  recipesToDisplay;

        // Reset active group index to 0 if cached value for index is greater than or equal to recipe group length
        if( updatedActiveGroupIndex >= newRecipeState.recipeGroup.length ) {
            updatedActiveGroupIndex = 0;
            updateActiveGroupInfoInCache( occContext.productContextInfo.uid, updatedActiveGroupIndex );
        }

        let cachedSearchState = createSearchStateFromCachedCategories( searchState, newRecipeState, updatedActiveGroupIndex, sharedDataValue.autoApply,
            occContext.productContextInfo.uid, categories );

        if( sharedData && sharedData.recipeTermToAdd && sharedData.recipeTermToAdd.criteriaType ) {
            let [ filterRecipe, enableFilterApplyWithRecipeUpdate, enableClearButtonWithRecipeUpdate ] = addRecipe( newRecipeState, sharedData, occContext.productContextInfo.uid, updatedActiveGroupIndex );

            let enableNotGroup = true;
            if ( newRecipeState.recipeGroup.length > 0 && newRecipeState.recipeGroup[newRecipeState.recipeGroup.length - 1].criteriaOperatorType === 'Exclude' ) {
                enableNotGroup = false;
            }
            const newSharedData = { ...sharedData.getValue() };
            if( newSharedData.autoApply ) {
                // Reset shared data after recipe add
                resetSharedDataOnPanelLoad( sharedData, enableFilterApplyWithRecipeUpdate, updatedActiveGroupIndex, true, enableNotGroup, enableClearButtonWithRecipeUpdate );

                // Reset search state before filter apply
                let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters( searchState );
                applyFilter( filterRecipe, occContext );
                return  { searchState: newSearchState, recipeState: newRecipeState };
            }

            if( isSpatialRecipe( newSharedData.recipeTermToAdd ) ) {
                addSpatialRecipeInDelayMode( newSharedData.recipeTermToAdd, cachedSearchState );
            }else if( newSharedData.recipeTermToAdd.criteriaType === 'Partition' ) {
                updatePartitionRecipeInDelayMode( newSharedData.recipeTermToAdd, cachedSearchState );
            }
            // Reset active group index if cached value for index is greater than or equal to recipe group length
            if( updatedActiveGroupIndex !== 0 && ( updatedActiveGroupIndex > filterRecipe.length || !_.isEmpty( newRecipeState.recipeGroup ) &&
                _.isEmpty( newRecipeState.recipeGroup[updatedActiveGroupIndex].subCriteria ) ) ) {
                updatedActiveGroupIndex--;
                updateActiveGroupInfoInCache( occContext.productContextInfo.uid, updatedActiveGroupIndex );
                if( newRecipeState.recipeGroup[updatedActiveGroupIndex + 1].criteriaOperatorType === 'Exclude' ) {
                    enableNotGroup = true;
                }
            }
            resetSharedDataOnPanelLoad( sharedData, enableFilterApplyWithRecipeUpdate, updatedActiveGroupIndex, true, enableNotGroup, enableClearButton );
            newRecipeState.recipeGroup = filterRecipe;

            cachedSearchState.categories = updateCategoryLogicOnPanelLoad( occContext.productContextInfo.uid, cachedSearchState, newRecipeState, updatedActiveGroupIndex );
            if( newRecipeState.recipeGroup && newRecipeState.recipeGroup.length > 0 ) {
            // a group has been deleted e.g. deselection of partition filter from subpanel
                if( updatedActiveGroupIndex !== sharedData.activeGroupIndex ) {
                // we need to get the search state for the correct group after deletion, then we can sync selections
                    cachedSearchState = createSearchStateFromCachedCategories( searchState, newRecipeState, updatedActiveGroupIndex, sharedDataValue.autoApply,
                        occContext.productContextInfo.uid, categories );
                }
                _.forEach( newRecipeState.recipeGroup[updatedActiveGroupIndex].subCriteria, function( subCriteria ) {
                    if( subCriteria.criteriaType === 'Partition' ) {
                        updatePartitionRecipeInDelayMode( subCriteria, cachedSearchState );
                    } else {
                        for( let i in cachedSearchState.categories ) {
                            if( cachedSearchState.categories[i].internalName === subCriteria.criteriaValues[0] ) {
                                syncSelectionsInCategoryOnSearchState( cachedSearchState.searchFilterMap[ subCriteria.criteriaValues[0] ], cachedSearchState.categories[i].filterValues );
                            }
                        }
                    }
                } );
            }
        }else {
            let enableNotGroup = true;
            let enableNewGroup = true;
            if( newRecipeState.recipeGroup.length > 0 ) {
                //if last group is empty, create group commands should be disabled
                if( newRecipeState.recipeGroup[newRecipeState.recipeGroup.length - 1].subCriteria?.length === 0 ) {
                    enableNewGroup = false;
                    enableNotGroup = false;
                }
                //if last group is exclude group, create NOT group command should be disabled
                else if ( newRecipeState.recipeGroup[newRecipeState.recipeGroup.length - 1].criteriaOperatorType === 'Exclude' ) {
                    enableNotGroup = false;
                    //if last group is exclude group and the last second group (OR group) is empty, create OR group command should be disabled
                    if( newRecipeState.recipeGroup[newRecipeState.recipeGroup.length - 2].subCriteria?.length === 0 ) {
                        enableNewGroup = false;
                    }
                }
            }
            resetSharedDataOnPanelLoad( sharedData, enableFilterApply, updatedActiveGroupIndex, enableNewGroup, enableNotGroup, enableClearButton );
        }

        return { searchState: cachedSearchState, recipeState: newRecipeState };
    }

    //Vaishnavi: Moved the call to SOA from viewmodel to js so that actions happen synchronously. This is very much needed
    //for add include/exclude/filter terms when filter panel is never opened before. Without this call completed, the next action
    //in the batch process to determine the active group that the term needs to be added to will not be evaluated properly since
    //recipeState will not be built yet.
    let newRecipeState = { ...recipeState };
    let newsearchState = { ...searchState };
    let subsetInputs = getSubsetInfoSoaInput( occContext );
    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-12-OccurrenceManagement', 'getSubsetInfo3', { subsetInputs } ).then(
        function( response ) {
            let searchState = processGetSubsetInfoSoaResponse( response, newsearchState, sharedData, occContext, true );
            let recipeState = getRecipeStateFromSoa( response, newsearchState, newRecipeState, sharedData, occContext );
            return  { searchState: searchState, recipeState: recipeState };
        } );
};

/**
   * Destroy
   */
export let destroy = function() {
    clearCache();
    clearRecipeCache( true );
    pciToCategoryLogicMap = [];
    pciToWildcardListMap = [];
    _.forEach( discoveryFilterEventSubscriptions, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
    discoveryFilterEventSubscriptions = [];
    unregisterListeners();
};

export let setContextKey = function( key ) {
    _contextKey = key;
};

export let setResetInitiated = function( ) {
    _resetInitiated = true;
};

export let isIncludeGroupExists = function( recipeState, childrenIncluded ) {
    if( recipeState.recipeGroup?.length > 1 ) {
        for( let i = 1; i < recipeState.recipeGroup?.length; i++ ) {
            let criteriaValues = recipeState.recipeGroup[i].subCriteria[0]?.criteriaValues;
            let criteriaType = recipeState.recipeGroup[i].subCriteria[0]?.criteriaType;
            if( criteriaType && criteriaType === 'SelectedElement' &&
                criteriaValues && criteriaValues[criteriaValues.length - 1] &&
                criteriaValues[criteriaValues.length - 1].toUpperCase() === childrenIncluded.toUpperCase() ) {
                return i;
            }
        }
    }
    return -1;
};

export let addNewGroup = function( recipeState, searchState, sharedData, occContext, updateAtomicData, groupCriteriaOperatorType ) {
    let newRecipeState = { ...recipeState };
    if( newRecipeState.recipeGroup?.length > 0 ) {
        // Add empty recipe group to transient recipes
        // When user navigates to Partition panel after creating empty group,
        // the new recipe term can be added to the newly created group if transient recipes
        // have the empty group
        addRecipeToCacheForCurrentPCI(  _.cloneDeep( recipeState.recipeGroup ), {}, occContext.productContextInfo.uid, newRecipeState.recipeGroup.length + 1, undefined, groupCriteriaOperatorType );
    }
    let newGroup = { subCriteria: [], criteriaOperatorType: groupCriteriaOperatorType, criteriaType: 'Group' };
    let activeGroupIndex;
    let lastGroupCriteriaOperatorType;
    if( newRecipeState.recipeGroup.length > 0 ) {
        lastGroupCriteriaOperatorType = newRecipeState.recipeGroup[newRecipeState.recipeGroup.length - 1].criteriaOperatorType;
    }
    if( lastGroupCriteriaOperatorType === 'Exclude' ) {
        let notGroup = newRecipeState.recipeGroup.splice( newRecipeState.recipeGroup.length - 1, 1 );
        newRecipeState.recipeGroup.push( newGroup );
        newRecipeState.recipeGroup.push( notGroup[0] );
        activeGroupIndex = newRecipeState.recipeGroup.length - 2;
    } else {
        newRecipeState.recipeGroup.push( newGroup );
        activeGroupIndex = newRecipeState.recipeGroup.length - 1;
    }
    const newSharedData = { ...sharedData.getValue() };
    newSharedData.activeGroupIndex = activeGroupIndex;
    newSharedData.enableNewGroup = false;
    newSharedData.enableNotGroup = false;
    //add addingNewGroup variable only when there is change in activeGroupIndex
    if( sharedData.activeGroupIndex !== newSharedData.activeGroupIndex ) {
        newSharedData.addingNewGroup = true;
    }
    sharedData.update && sharedData.update( newSharedData );

    let updateRecipeAtomicData = updateAtomicData.recipeState;
    updateRecipeAtomicData( newRecipeState );

    let deferred = AwPromiseService.instance.defer();
    createSearchStateFromSubsetInfoSoa( searchState, recipeState, newSharedData, occContext ).then( function( updatedSearchState ) {
        updateAtomicData.searchState( updatedSearchState );
        deferred.resolve();
    } );

    return deferred.promise;
};

/**
 * This method updates searchState after activeGroupIndex change
 * @param {search state} searchState
 * @param {recipe state} recipeState
 * @param {shared data} sharedData
 * @param {occContext} occContext
 * @param {updateAtomicData} updateAtomicData
 * @returns a promise
 */
export let setActiveGroup = function(  searchState, recipeState, sharedData, occContext, updateAtomicData ) {
    // Create OccContext object to be updated.
    let occContextValue = {
        activeGroupIndex: sharedData.activeGroupIndex
    };
    // Update active group index on context
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );

    const newSharedData = { ...sharedData.getValue() };
    if( searchState.categories && !searchState.searchInProgress ) {
        if( !_resetInitiated && !sharedData.addingNewGroup && !sharedData.doNotTriggerSubsetInfoSoa ) {
            let deferred = AwPromiseService.instance.defer();
            createSearchStateFromSubsetInfoSoa( searchState, recipeState, sharedData, occContext ).then( function( updatedSearchState ) {
                updateAtomicData.searchState( updatedSearchState );
                newSharedData.shouldUpdateActiveGroupOnState = false;
                sharedData.update && sharedData.update( newSharedData );
                deferred.resolve();
            } );
            return deferred.promise;
        }
        let updateSharedData = false;
        if( sharedData.addingNewGroup ) {
            // avoid unnecessary shared data update
            updateSharedData = true;
            newSharedData.addingNewGroup = false;
        }
        if( sharedData.doNotTriggerSubsetInfoSoa ) {
            // avoid unnecessary shared data update
            updateSharedData = true;
            newSharedData.doNotTriggerSubsetInfoSoa = false;
        }
        if( updateSharedData ) {
            sharedData.update && sharedData.update( newSharedData );
        }
    }
    _resetInitiated = false;
};

export let setActiveGroupIndexToZero = function( sharedData, subPanelNavigateBack ) {
    let newSharedData = { ...sharedData.getValue() };
    newSharedData.activeGroupIndex = 0;
    if( subPanelNavigateBack ) {
        newSharedData.subPanelNavigateBack =  subPanelNavigateBack;
    }
    sharedData.update && sharedData.update( newSharedData );
};

export let setActiveIncludeGroup = function( sharedData, recipeState, searchState, occContext, updateAtomicData, groupCriteriaOperatorType, subPanelNavigateBack ) {
    var childrenIncluded = appCtxSvc.ctx.preferences.AWS_SelectElement_IncludeChildren;
    let includeGroupIndex = isIncludeGroupExists( recipeState, childrenIncluded[0] );
    if( includeGroupIndex !== -1 ) {
        let newSharedData = { ...sharedData.getValue() };
        newSharedData.activeGroupIndex = includeGroupIndex;
        if( subPanelNavigateBack ) {
            newSharedData.subPanelNavigateBack =  subPanelNavigateBack;
        }
        updateActiveGroupInfoInCache( occContext.productContextInfo.uid, includeGroupIndex );
        sharedData.update && sharedData.update( newSharedData );
    } else {
        let deferred = AwPromiseService.instance.defer();
        addNewGroup( recipeState, searchState, sharedData, occContext, updateAtomicData, groupCriteriaOperatorType ).then( function() {
            if( subPanelNavigateBack ) {
                let newSharedData = { ...sharedData.getValue() };
                newSharedData.subPanelNavigateBack =  subPanelNavigateBack;
                sharedData.update && sharedData.update( newSharedData );
            }
            deferred.resolve();
        } );
        return deferred.promise;
    }
};

export let isNotGroupActive = function( recipeObject, sharedData ) {
    if( recipeObject.recipeGroup.length > 0 ) {
        let isNotGroupActive = recipeObject.recipeGroup[sharedData.activeGroupIndex].criteriaOperatorType === 'Exclude';
        let currentFilterValue = {
            isNotGroupActive: isNotGroupActive
        };
        occmgmtUtils.updateValueOnCtxOrState( '', currentFilterValue, 'filter' );
    }
};

/**
 * This method returns a search filter map with filter value entries where selected = true
 * for recipes of criteriaOperatorType: "Filter" and criteriaType: "Attribute"
 * In case of NOT group active or empty group, empty search filter map is returned
 *
 * @param {searchFilterMap on data} searchFilterMap
 * @param {recipe state on data} recipeState
 * @param {The active group index} activeGroupIndex
 * @returns searchFilterMap for active group recipe
 *
 */
export let populateActiveGroupSearchFilterMap = function( searchFilterMap, recipeState, activeGroupIndex ) {
    let activeGroupRecipe = recipeState.recipeGroup[activeGroupIndex];
    let emptyGroup = activeGroupRecipe && activeGroupRecipe.subCriteria.length === 0;
    let notGroup = activeGroupRecipe && activeGroupRecipe.criteriaOperatorType === 'Exclude';
    if( emptyGroup || notGroup ) {
        return {};
    }
    let tempFilterMap  = {};
    let tempFilterValues = [];
    let found;

    _.forEach( activeGroupRecipe && activeGroupRecipe.subCriteria, function( subCriteria ) {
        if( subCriteria.criteriaOperatorType === 'Filter' && subCriteria.criteriaType === 'Attribute' ) {
            let filterValues = searchFilterMap[subCriteria.criteriaValues[0]];
            let isDateRangeFilter = false;
            if( filterValues && filterValues.length > 0 && filterValues[0].searchFilterType === 'DateFilter' ) {
                isDateRangeFilter = true;
            }
            for( let index = 1; index < subCriteria.criteriaValues.length; index++ ) {
                let noOfEntries = filterValues.length;
                let addEntryToFilterMap = false;
                found = false;
                while( noOfEntries > 0 ) {
                    if( isDateRangeFilter ) {
                        let recipeStartDateValue = subCriteria.criteriaValues[index].split( 'T' )[0];
                        let recipeEndDateValue = subCriteria.criteriaValues[index + 1].split( 'T' )[0];
                        let startDateFilterValue = filterValues[noOfEntries - 1].startDateValue.split( 'T' )[0];
                        let endDateFilterValue = filterValues[noOfEntries - 1].endDateValue.split( 'T' )[0];
                        if( recipeStartDateValue === startDateFilterValue && recipeEndDateValue === endDateFilterValue ) {
                            addEntryToFilterMap = true;
                        }
                    } else if( subCriteria.criteriaValues[index] === filterValues[noOfEntries - 1].stringValue ) {
                        addEntryToFilterMap = true;
                    }
                    if( addEntryToFilterMap ) {
                        filterValues[noOfEntries - 1].selected = true;
                        delete filterValues[noOfEntries - 1].hasChildren;
                        tempFilterValues.push( filterValues[noOfEntries - 1] );
                        found = true;
                        break;
                    }
                    noOfEntries--;
                }
                if( !found ) {
                    let missingEntry = {};
                    if( isDateRangeFilter ) {
                        missingEntry.searchFilterType = 'DateFilter';
                        missingEntry.endDateValue = subCriteria.criteriaValues[index + 1];
                        missingEntry.selected = true;
                        missingEntry.startDateValue = subCriteria.criteriaValues[index];
                    } else{
                        missingEntry.searchFilterType = 'StringFilter';
                        missingEntry.stringValue = subCriteria.criteriaValues[index];
                        missingEntry.selected = true;
                    }
                    tempFilterValues.push( missingEntry );
                }
                if( isDateRangeFilter ) {
                    break;
                }
            }
            tempFilterMap[ subCriteria.criteriaValues[0] ] = tempFilterValues;
            tempFilterValues = [];
        }
    } );
    return tempFilterMap;
};

export default exports = {
    validateTermsToIncludeOrExclude,
    isNotGroupActive,
    computeFilterStringForNewProductContextInfo,
    clearRecipeCache,
    clearCategoryLogicMap,
    clearTransientRecipeInfo,
    updateCategoriesAfterFacetSearch,
    applyFilter,
    processInitialFilterSettingsPreferences,
    isDiscoveryIndexed,
    clearRecipe,
    initialize,
    setContextKey,
    updateSearchStateAfterFilterAction,
    processGetSubsetInfoSoaResponse,
    modifySearchStateWithUpdatedFilters,
    getSubsetInfoSoaInput,
    destroy,
    clearAllCacheOnReset,
    updateSearchStateOnPanelLoad,
    updateSharedActiveViewBasedOnPCI,
    getRecipeStateFromSoa,
    processRecipeOnUpdate,
    applyFilterInBulkMode,
    updatePartitionSchemeFacet,
    toggleCategoryLogic,
    restoreCategoriesAfterFailedConcurrentSave,
    setResetInitiated,
    initializeSearchStateFromSoaResponse,
    addNewGroup,
    setActiveGroup,
    setActiveGroupIndexToZero,
    isIncludeGroupExists,
    setActiveIncludeGroup,
    populateActiveGroupSearchFilterMap
};
