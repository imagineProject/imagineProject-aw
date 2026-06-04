// Copyright (c) 2024 Siemens

/**
 * Helper service for pca0FilterCategoryContent
 * Wrapper for the AwFilterCategoryStringFilter component
 *
 * @module js/pca0FilterCategoryContentService
 */

import AwFilterCategoryStringFilter from 'viewmodel/AwFilterCategoryStringFilterViewModel';
import localeService from 'js/localeService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
/**
 * Rendering method, gets triggered every time the props change
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FilterCategoryContentRenderFunction = ( props ) => {
    const {
        fields,
        category,
        subPanelContext
    } = props;

    // Call back action triggered when filter facet check-box selection changes
    // This call back method updates the active filters and filter chips information
    // @param filter - selected filter
    // @param category - category for which filter is selected
    const selectFilterCallBackAction = ( filter, category ) => {
        let newSearchState = { ...subPanelContext.searchState.getValue() };

        if( newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] &&
             filter.categoryName === pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ) {
            let onContinueCallBack = () => {
                newSearchState.activeFiltersInfo[ pca0Constants.FILTER_CONSTRAINTS.UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME ] = false;
                newSearchState.unreferencedConstraintsFilterChipData = {}; // empty out the unreferenced constraints chip data
                subPanelContext.searchState.update( newSearchState ); // Update the state
                pca0ConfiguratorExplorerCommonUtils.updateSearchStateAfterFilterAction( filter, category, subPanelContext.searchState );
            };
            let onCancelCallback = () => {
                // Clear all the feature filters on UI
                pca0ConfiguratorExplorerCommonUtils.clearFeatureFilters( newSearchState );
                subPanelContext.searchState.update( newSearchState ); // Update the state
            };
            let localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
            let notificationMessage = localeTextBundle.filtersResetConfirmation;
            // This function is called when the feature filters below selections label are selected after the unreferenced filter checkbox is clicked.
            pca0CommonUtils.displayNotificationMessage( onContinueCallBack, onCancelCallback, 'Continue', 'Cancel', notificationMessage );
        } else {
            pca0ConfiguratorExplorerCommonUtils.updateSearchStateAfterFilterAction( filter, category, subPanelContext.searchState );
        }
    };

    // Facet search text box is shown when the facets for filter category are greater than the default count category
    // This call back action is executed when we enter the facet search string in text boc
    // @param filter - selected filter
    // @param category - category for which filter is selected
    const facetCallBackAction = ( filter, category ) => {
        // Do nothing
    };

    return (
        <AwFilterCategoryStringFilter
            category={category}
            selectFilterAction={selectFilterCallBackAction}
            facetAction={facetCallBackAction}
            noResultsFoundLabel={fields.noResultsFoundLabel}
            moreLinkProp={fields.moreLinkProp}
            lessLinkProp={fields.lessLinkProp}
            advanceSearchLinkProp={fields.advanceSearchLinkProp}
        >
        </AwFilterCategoryStringFilter>
    );
};
