// Copyright (c) 2022 Siemens

/**
 * @module js/aceFilterService
 */
import appCtxSvc from 'js/appCtxService';
import filterPanelUtils from 'js/filterPanelUtils';
import soa_preferenceService from 'soa/preferenceService';
import _ from 'lodash';

var exports = {};

var filterColorValues = [];
/**
 * This method will return the first category among the given categories which is multi-valued and doesn't have
 * any value selected. If it doesn't find such a category then it defaults to the last category.
 */
export let getApplicableCategory = function( categories ) {
    var categoryToSelect;
    _.forEach( categories, function( category ) {
        categoryToSelect = category;
        if( category.filterValues.length > 1 && !doesThisCategoryHaveAnySelectedFilterValue( category ) ) {
            return false;
        }
    } );
    return categoryToSelect;
};

var doesThisCategoryHaveAnySelectedFilterValue = function( category ) {
    var selectedFilterFound = false;
    _.forEach( category.filterValues, function( filterValue ) {
        if( filterValue.selected && selectedFilterFound === false ) {
            selectedFilterFound = true;
        }
    } );
    return selectedFilterFound;
};

export let selectGivenCategory = function( category, appCtxPathForCategoriesToUpdate, rawCategoriesInfo ) {
    if( !category && appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory &&
        appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory.currentCategory ) {
        category = appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory.currentCategory;
    }
    if( category ) {
        var internalNameOfSelectedCategory = category.internalName.split( '.' )[ 1 ];
        category.expand = true;
        return updateCategories( internalNameOfSelectedCategory, appCtxPathForCategoriesToUpdate, rawCategoriesInfo );
    }
};

var updateCategories = function( internalNameOfSelectedCategory, appCtxPathForCategoriesToUpdate,
    rawCategoriesInfo ) {
    var currentCategories = appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory ? [ appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory.currentCategory ] : [];
    retainExpansionStateOfCategories( appCtxSvc.ctx.aceActiveContext.context.categoriesToRender,
        currentCategories );
    return currentCategories;
    //appCtxSvc.updatePartialCtx( appCtxPathForCategoriesToUpdate, processedCategories );
};

export let suppressDateRangeFilterForDateFilters = function( categories ) {
    _.forEach( categories, function( category ) {
        if( category.type === 'DateFilter' ) {
            category.showDateRangeFilter = false;
        }
    } );
};

var retainExpansionStateOfCategories = function( currentCategoryInfo, newCategoryInfo ) {
    _.forEach( newCategoryInfo, function( newCategory ) {
        _.forEach( currentCategoryInfo, function( currentCategory ) {
            if( newCategory.internalName === currentCategory.internalName ) {
                newCategory.expand = currentCategory.expand;
                newCategory.showExpand = currentCategory.showExpand;
                newCategory.visibleFilterCount = currentCategory.visibleFilterCount;
            }
        } );
    } );
    return newCategoryInfo;
};

export let selectApplicableCategory = function( categories, searchFilterCategories, sourceSearchFilterMap ) {
    if( categories && searchFilterCategories && sourceSearchFilterMap ) {
        var category = exports.getApplicableCategory( categories );
        exports.selectGivenCategory( category, 'aceActiveContext.context.categoriesToRender', {
            rawCategories: searchFilterCategories,
            rawCategoryValues: sourceSearchFilterMap
        } );
    }
};

export let extractFilterCategoriesAndFilterMap = function( filterString ) {
    var filterCategoryValues = filterString.split( '~' );
    var categoriesInfo = [];
    var filterMap = {};
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    for( var x in filterCategoryValues ) {
        var filterCategoryValueString = filterCategoryValues[ x ];
        if( filterCategoryValueString.length > 0 ) {
            var filterValues = filterCategoryValueString.split( '==' );
            var filterValueAndType = filterValues[ 0 ].split( '^^' );
            var keyStr = filterValueAndType[ 1 ];
            var categoryInfo = {
                categoryType: filterValueAndType[ 0 ],
                defaultFilterValueDisplayCount: 0,
                displayName: '',
                editable: false,
                internalName: keyStr,
                isHierarchical: false,
                isMultiSelect: false,
                quickSearchable: false
            };
            var filterVals = filterValues[ 1 ].split( filterSeparator );
            var tempVals = [];
            for( var y in filterVals ) {
                tempVals.push( {
                    count: 0,
                    endDateValue: '0001-01-01T00:00:00',
                    endNumericValue: 0,
                    hasChildren: false,
                    searchFilterType: filterValueAndType[ 0 ],
                    selected: true,
                    startDateValue: '0001-01-01T00:00:00',
                    startEndRange: '',
                    stringDisplayValue: 'dummy',
                    stringValue: filterVals[ y ]
                } );
            }
            filterMap[ keyStr ] = tempVals;
            categoriesInfo.push( categoryInfo );
        }
    }
    return {
        filterCategories: categoriesInfo,
        filterMap: filterMap
    };
};

export default exports = {
    getApplicableCategory,
    selectGivenCategory,
    suppressDateRangeFilterForDateFilters,
    selectApplicableCategory,
    extractFilterCategoriesAndFilterMap
};
