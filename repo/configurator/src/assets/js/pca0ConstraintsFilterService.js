// Copyright (c) 2024 Siemens

/**
 * Helper service for pca0ConstraintsFilterPanel
 *
 * @module js/pca0ConstraintsFilterService
 */

import appCtxSvc from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import modelPropertySvc from 'js/modelPropertyService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Helper API to generate and return the chip from the active filters
 * @param {String} activeFilterMap category internal name vs filter facets map
 * @param {String} filterCategoryInternalName filter category internal name
 * @param {String} filterCategoryDisplayName filter category display name
 * @param {String} i18nSelectedString Selected localized string
 * @returns {Object}  Chip object generated form the active filters for the input category
 */
const _generateChipFromActiveFilters = ( activeFilterMap, filterCategoryInternalName, filterCategoryDisplayName, i18nSelectedString ) => {
    const categoryActiveFilters = _.get( activeFilterMap, filterCategoryInternalName );
    if( !_.isUndefined( categoryActiveFilters ) && !_.isEmpty( categoryActiveFilters ) ) {
        let filterCategoryChildChips = [];
        categoryActiveFilters.forEach( ( filter ) => {
            let childFacetChip = {
                chipType: 'BUTTON',
                uiIconId: 'miscRemoveBreadcrumb',
                labelDisplayName: filter.stringDisplayValue,
                labelInternalName: filter.stringValue
            };
            filterCategoryChildChips.push( childFacetChip );
        } );
        if( _.size( filterCategoryChildChips ) === 1 ) {
            let filterCategoryChipName = filterCategoryDisplayName + ': ' + filterCategoryChildChips[ 0 ].labelDisplayName;
            return {
                chipType: 'BUTTON',
                uiIconId: 'miscRemoveBreadcrumb',
                labelDisplayName: filterCategoryChipName,
                labelInternalName: filterCategoryInternalName,
                children: []
            };
        } else if( _.size( filterCategoryChildChips ) > 1 ) {
            let filterCategoryChipName = filterCategoryDisplayName + ': ' + categoryActiveFilters.length + ' ' + i18nSelectedString;
            return {
                chipType: 'BUTTON',
                uiIconId: 'miscRemoveBreadcrumb',
                labelDisplayName: filterCategoryChipName,
                labelInternalName: filterCategoryInternalName,
                children: filterCategoryChildChips
            };
        }
    }
    // Return an empty object if no active filters for the category
    return {};
};

/**
 * Helper API to convert the category received in the SOA response to the category needed for the AwStringFilterCategory component
 * @param {String} category category object received from the performSearchViewModel SOA response
 * @returns {Object} category object
 */
const _convertSoaOutputCategoryToStringFilterCategory = ( category ) => {
    return {
        internalName: category.internalName,
        defaultFilterValueDisplayCount: category.defaultFilterValueDisplayCount,
        type: 'StringFilter',
        filterValues: [],
        hasMoreFacetValues: false,
        isServerSearch: false,
        showFilterText: false,
        filterLimitForCategory: 50
    };
};

/**
 * Helper API to generate the active filters map from the categories
 * @param {String} categories array of categories
 * @returns {Object} active filters map ( category internal name vs selected filter facets)
 */
const _getActiveFilterMap = ( categories ) => {
    let activeFilterMap = {
        [ pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME ]: [],
        [ pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ]: []
    };
    for( const [ , value ] of Object.entries( categories ) ) {
        if( value ) {
            let filters = [];
            if( value.filterValues && value.filterValues.length > 0 ) {
                value.filterValues.forEach( ( val ) => {
                    if( val.selected.dbValue ) {
                        let filter = {
                            searchFilterType: 'StringFilter',
                            stringValue: val.internalName,
                            stringDisplayValue: val.name
                        };
                        filters.push( filter );
                    }
                } );
                activeFilterMap[ value.internalName ] = filters;
            }
        }
    }
    return activeFilterMap;
};

/**
 * Return input view name as active component to be set for navigation
 * @param {String} categoryName view name
 * @param {String} categoryValues view name
 * @returns {Object} default features filter category object
 */
const _convertSoaOutputFilterFacetsToFilterValues = ( categoryName, categoryValues ) => {
    let filterValues = [];
    categoryValues.forEach( categoryValue => {
        let filterValue = {};
        filterValue.categoryName = categoryName;
        filterValue.internalName = categoryValue.stringValue;
        filterValue.name = categoryValue.stringDisplayValue;
        filterValue.count = categoryValue.count;
        filterValue.autoFocus = false;
        filterValue.selected = modelPropertySvc.createViewModelProperty( {
            displayName: filterValue.name,
            type: 'BOOLEAN',
            isRequired: 'false',
            isEditable: 'true',
            dbValue: categoryValue.selected,
            dispValue: filterValue.name,
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
        } );
        filterValue.showCount = filterValue.count;
        filterValues.push( filterValue );
    } );
    return filterValues;
};

/**
 * Whenever the feature selections are updated, list box selections data need to be updated to sync the selections
 * Helper API to convert selected feature data into the list box selections data
 * @param {Object} activeFilterFacets selected features facets data
 * @returns {Object} feature list box selections data
 */
const _getFeatureListSelectionsFromActiveFeatureFilterFacets = ( activeFilterFacets ) => {
    // Iterate over active feature filter facets and collect the uids into dbValue and display names into displayValues array respectively
    let dbValue  = _.map( activeFilterFacets, 'stringValue' );
    let displayValues  = _.map( activeFilterFacets, 'stringDisplayValue' );
    let uiValue = displayValues.join( ',' );
    return {
        dbValue : dbValue,
        displayValues: displayValues,
        uiValue : uiValue
    };
};

/**
 * Helper API to generate the chip for unreferencedType
 * @param {String} newSearchState category internal name vs filter facets map
 */
export const updateChipDataForUnreferencedConstraints = ( newSearchState ) => {
    let chip = {
        chipType: 'BUTTON',
        uiIconId: 'miscRemoveBreadcrumb',
        labelDisplayName: pca0CommonUtils.getLocalizedValue( 'unreferencedType', 'ConfiguratorExplorerMessages' ),
        labelInternalName: pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME,
        children: []
    };
    newSearchState.unreferencedConstraintsFilterChipData = newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] ? chip : {};
};

/**
 * Update shared searchState atomic data object with Constraint Type filter category and its facets
 * @param {Object} soaResponse response of the performSearchViewModel SOA
 * @param {Object} searchData searchState atomic data
 */
export let processOutput = ( soaResponse, searchData ) => {
    if( !_.isUndefined( soaResponse ) ) {
        const newSearchData = { ...searchData.getValue() };
        let constraintTypeFilters = _.get( soaResponse.searchFilterMap, pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME );
        if( !_.isUndefined( constraintTypeFilters ) && !_.isEmpty( constraintTypeFilters, soaResponse.searchFilterCategories ) ) {
            // Get Filter Values for the Constraint Type Category
            let constraintTypeFilterValues = _convertSoaOutputFilterFacetsToFilterValues( pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME, constraintTypeFilters );
            // Get the Constraint Type String Filter Category
            let constraintTypeFilterCategory = _convertSoaOutputCategoryToStringFilterCategory( soaResponse.searchFilterCategories[ 0 ] );
            // Show category search filter box when filter facets number is greater than default count
            if( constraintTypeFilterValues.length > constraintTypeFilterCategory.defaultFilterValueDisplayCount * 2 ) {
                constraintTypeFilterCategory.showFilterText = true;
            }
            // Update the constraint type category data in searchState atomic object
            constraintTypeFilterCategory.filterValues = constraintTypeFilterValues;
            newSearchData.constraintTypeFilterCategory = constraintTypeFilterCategory;
        }
        // Do not make the SOA call to get constraint type filter category data again, use the cached information in the searchState
        newSearchData.constraintTypeFilterCategory.isPopulated = true;
        // No active filters when panel is opened first time
        newSearchData.activeFiltersInfo = {
            featureSearchType: 'search_either_in_subject_or_condition',
            searchOperationType: pca0Constants.CFG_FILTER_OPERATION_TYPE.ANY,
            activeFilterMap: {
                [ pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME ]: [],
                [ pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ]: []
            },
            [ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ]: false
        };
        // No applied filters when we open panel for very first time
        newSearchData.appliedFiltersInfo = {
            featureSearchType: 'search_either_in_subject_or_condition',
            searchOperationType: pca0Constants.CFG_FILTER_OPERATION_TYPE.ANY,
            appliedFilterMap: {
                [ pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME ]: [],
                [ pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ]: []
            }
        };
        // Update the panel collapsed state, Type Panel should be expanded and features panel to be collapsed
        newSearchData.constraintTypeFilterCategory.panelCollapsedState = false;
        newSearchData.enableApplyFilter = false;
        newSearchData.filtersCount = {
            dbValues: [ 0 ]
        };
        searchData.update( newSearchData );
    }
};

/**
 * Cache the Constraint Type filter category and constraint type filter facets
 * This will avoid a SOA call if 'Filter Constraints' panel is reopened in Constraints view
 * @param {Object} response response of the performSearchViewModel SOA which holds filter categories and its facets data
 * @param {Object} eventData Contains required data like searchState atomic data and dialogOptions
 */
export let cacheFilterCategoriesAndOpenDialog = ( response, eventData ) => {
    const commandContext = { ...eventData.commandContext };
    // Update the searchState atomic data with filter category and facets
    exports.processOutput( response, commandContext.searchState );
    exports.openConstraintsFilterPanel( { commandContext: commandContext, commandId: 'Pca0ConstraintsFilterPanel' } );
};

/**
 * Get performSearchViewModel SOA input to get only constraint type filter categories and its facets
 * @returns {Object} Input for the performSearchViewModel SOA
 */
export let getFilterCategoryAndFacetsInput = () => {
    const configuratorCtx = _.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY );
    const perspective = _.get( configuratorCtx, 'configPerspective' );
    return {
        configPerspective: perspective.uid,
        fetchFilterCategoryAndFacets: 'true'
    };
};

/**
 * Get performSearchViewModel SOA input required to get only the feature facets for Features filter category
 * When we first expand the Features filter category panel, this input will be required to fetch feature facets
 * @returns {Object} Input for the performSearchViewModel SOA
 */
export let getPerformFacetSearchInput = () => {
    const configuratorCtx = _.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY );
    const perspective = _.get( configuratorCtx, 'configPerspective' );
    return {
        configPerspective: perspective.uid,
        categoryForFacetSearch: pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME
    };
};

/**
 * Checks if searchState.constraintTypeFilterCategory is empty and call SOA to fetch 'Constraint Type' filter category and its facets
 *        else use them to open dialog
 * Open 'Filter Constraint' panel
 * Build subPanelContext.searchState with relevant information to initialize sub-components
 * @param {Object} input - CommandContext info container for opening Dialog
 */
export let openConstraintsFilterPanel = ( input ) => {
    let { commandContext } = input;
    let searchState = commandContext.searchState.getValue();
    const { dialogAction } = commandContext;
    // Check the type category info is already populated or not, if not perform SOA call and cache the category data
    // Use the cached data for subsequent calls
    commandContext = {
        searchState : commandContext.searchState,
        dialogAction : commandContext.dialogAction
    };
    if( !searchState.constraintTypeFilterCategory.isPopulated ) {
        eventBus.publish( 'Pca0ConstraintsFilter.fetchConstraintFilterCategoriesAndFacets', { commandContext } );
    } else {
        let options = {
            view: input.commandId,
            placement: 'left',
            push: true,
            global: true,
            parent: '.aw-layout-workarea',
            width: 'MEDIUM',
            height: 'FULL',
            subPanelContext: { ...commandContext },
            isCloseVisible: false,
            commandid: 'Pca0FilterConstraints',
            commandicon: 'cmdFilterActive'
        };
        dialogAction.show( options );
    }
};

/**
 * Get the feature facets from the performSearchViewModel SOA response for features filter category
 * These facets info is cached into the searchState
 * These feature facet values are shown as check-box list of feature facets
 * @param { Object } response - performSearchViewModel SOA response
 * @param { Object } searchData - performSearchViewModel SOA response
 */
export let cacheFeaturesFilterCategoryDataAfterFacetSearch = ( response, searchData ) => {
    if( !_.isUndefined( response ) ) {
        let featureFacetValues = [];
        let featuresFilterCategory = {
            internalName: pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME,
            displayName: 'Features',
            defaultFilterValueDisplayCount: 5,
            type: 'StringFilter'
        };
        let featuresAwStringFilterCategory = _convertSoaOutputCategoryToStringFilterCategory( featuresFilterCategory );
        if( !_.isUndefined( response.searchFilterMap ) ) {
            let soaResponseFilterValues = response.searchFilterMap[ pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ];
            if( !_.isUndefined( soaResponseFilterValues ) && !_.isEmpty( soaResponseFilterValues ) ) {
                soaResponseFilterValues.forEach( filterValue => {
                    let featureFacetValue = {};
                    featureFacetValue.propDisplayValue = filterValue.stringDisplayValue;
                    featureFacetValue.propInternalValue = filterValue.stringValue;
                    featureFacetValues.push( featureFacetValue );
                } );
            }
        }
        let newSearchData = { ...searchData.getValue() };
        newSearchData.featuresFilterCategory = featuresAwStringFilterCategory;
        newSearchData.featuresFilterCategory.isPopulated = true;
        newSearchData.featuresFilterCategory.panelCollapsedState = true;
        const uniqueFeatureFacetValues = _.uniqBy( featureFacetValues, 'propDisplayValue' );
        newSearchData.featuresFilterCategory.featureFacetValues = uniqueFeatureFacetValues;
        searchData.update( newSearchData );
    }
};

/**
 * Update the collapsed state of the constraint type filter category
 * @param {String} searchState search state atomic data
 * @param {String} isCollapsed panel collapsed state (true/false)
 */
export let toggleConstraintTypeCategoryPanelState = ( searchState, isCollapsed ) => {
    let newSearchState = { ...searchState.getValue() };
    newSearchState.constraintTypeFilterCategory.panelCollapsedState = isCollapsed;
    searchState.update( newSearchState );
};

/** Remove the chips for constraint type filter category
 * Check the type of chip to be removed, if its parent chip then clear all selections for features facets
 * If chip to be removed is facet, then update the parent chip with the respective child count
 * @param { Object } chipToRemove selected filter facet
 * @param { Object } searchState search state atomic data
 */
export let removeConstraintTypesFilter = ( chipToRemove, searchState ) => {
    let newSearchState = { ...searchState.getValue() };
    if( chipToRemove.labelInternalName === pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME ) {
        newSearchState.constraintTypeFilterCategory.filterValues.forEach( filterValue => {
            filterValue.selected.dbValue = false;
        } );
    } else {
        newSearchState.constraintTypeFilterCategory.filterValues.forEach( filterValue => {
            if( filterValue.internalName === chipToRemove.labelInternalName ) {
                filterValue.selected.dbValue = false;
            }
        } );
    }
    const activeFilterMap = _getActiveFilterMap( [ newSearchState.constraintTypeFilterCategory, newSearchState.featuresFilterCategory ] );
    newSearchState.activeFiltersInfo.activeFilterMap = activeFilterMap;
    newSearchState.enableApplyFilter = !pca0ConfiguratorExplorerCommonUtils.areActiveAndAppliedFiltersSame( newSearchState.activeFiltersInfo, newSearchState.appliedFiltersInfo );
    const configuratorExplorerLocaleTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    const configuratorLocaleTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    newSearchState.typesFilterChipData = _generateChipFromActiveFilters( newSearchState.activeFiltersInfo.activeFilterMap, pca0Constants.FILTER_CONSTRAINTS.CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME,
        configuratorExplorerLocaleTextBundle.constraintType, configuratorLocaleTextBundle.selected );
    searchState.update( newSearchState );
};

/** Remove the chips for Unreferenced type filter category
 *
 * @param { Object } searchState search state atomic data
 */
export let removeUnreferencedConstraintsFilter = ( searchState ) => {
    let newSearchState = { ...searchState.getValue() };
    newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] = false;
    newSearchState.unreferencedConstraintsFilterChipData = {};
    newSearchState.enableApplyFilter = !pca0ConfiguratorExplorerCommonUtils.areActiveAndAppliedFiltersSame( newSearchState.activeFiltersInfo, newSearchState.appliedFiltersInfo );
    searchState.update( newSearchState );
};

/**
 * Scroll to bottom of aw-panel-body
 * When selections are updated for features filter category, the focus should be on recently added selections
 * This function gets the scroll element using class name and sets the scroll position to bottom
 */
export let scrollToBottom = () => {
    let awPanelBodyScrollElement = document.getElementsByClassName( 'aw-base-scrollPanel aw-panelBody flex-auto align-self-stretch sw-column' );
    if( awPanelBodyScrollElement.length > 0 ) {
        awPanelBodyScrollElement[ 0 ].scrollTo( 0, awPanelBodyScrollElement[ 0 ].scrollHeight );
    }
};

/**
 * Convert the active feature selections data into the list box selections
 * @param {String} searchState searchState atomic data
 * @returns {Object} Feature list selections
 */
export let getFeatureListSelections = ( searchState ) => {
    let newSearchState = { ...searchState.getValue() };
    let activeFeatureFilterFacets = newSearchState.activeFiltersInfo.activeFilterMap[pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME];
    let featureListSelections = _getFeatureListSelectionsFromActiveFeatureFilterFacets( activeFeatureFilterFacets );
    return {
        dbValue : featureListSelections.dbValue,
        displayValues : featureListSelections.displayValues,
        uiValue : featureListSelections.uiValue
    };
};

/**
 * Handles the click event for the unreferenced filter checkbox.
 * Updates the search state based on the checkbox value and displays a notification message if necessary.
 * This function is called when the unreferenced filter checkbox is clicked after the feature filters are already selected.
 * @param {Object} searchState - searchState info container
 * @param {Object} unreferencedFilterCheckBox - unreferencedFilterCheckBox to toggle the state
 */
export let handleUnreferencedFilterCheckboxClick = ( searchState, unreferencedFilterCheckBox ) => {
    let newSearchState = { ...searchState.getValue() };
    newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] = unreferencedFilterCheckBox.dbValue;

    if( newSearchState.activeFiltersInfo.activeFilterMap[ 'Cfg0AbsRule.features' ].length > 0 && newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] ) {
        // Code to execute if filtersCount is greater than 1
        let onContinueCallBack = () => {
            // Update the chip data for unreferenced constraints
            updateChipDataForUnreferencedConstraints( newSearchState );
            // Clear all the feature filters on UI
            pca0ConfiguratorExplorerCommonUtils.clearFeatureFilters( newSearchState );
            // Enable the apply filter button
            newSearchState.enableApplyFilter = true;
            searchState.update( newSearchState ); // Update the state
        };
        let onCancelCallback = () => {
            newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] = false;
            searchState.update( newSearchState );
        };
        let localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
        let notificationMessage = localeTextBundle.filtersResetConfirmation;
        // This function is called when the unreferenced filter checkbox is clicked after Feature and Families is selected.
        pca0CommonUtils.displayNotificationMessage( onContinueCallBack, onCancelCallback, 'Continue', 'Cancel', notificationMessage );
        searchState.update( newSearchState ); // Update the state
    } else {
        // Update the chip data for unreferenced constraints
        newSearchState.enableApplyFilter = !pca0ConfiguratorExplorerCommonUtils.areActiveAndAppliedFiltersSame( newSearchState.activeFiltersInfo, newSearchState.appliedFiltersInfo );
        updateChipDataForUnreferencedConstraints( newSearchState );
        searchState.update( newSearchState ); // Update the state
    }
};

export default exports = {
    processOutput,
    cacheFilterCategoriesAndOpenDialog,
    getFilterCategoryAndFacetsInput,
    getPerformFacetSearchInput,
    openConstraintsFilterPanel,
    cacheFeaturesFilterCategoryDataAfterFacetSearch,
    toggleConstraintTypeCategoryPanelState,
    removeConstraintTypesFilter,
    removeUnreferencedConstraintsFilter,
    scrollToBottom,
    getFeatureListSelections,
    handleUnreferencedFilterCheckboxClick,
    updateChipDataForUnreferencedConstraints
};
