// Copyright (c) 2021 Siemens
import AwFilterCategoryContents from 'viewmodel/AwFilterCategoryContentsViewModel';
import AwLink from 'viewmodel/AwLinkViewModel';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';
import AwFilterWildcard from 'viewmodel/AwFilterWildcardViewModel';
import AwLabel from 'viewmodel/AwLabelViewModel';
import AwNumericRange from 'viewmodel/AwNumericRangeViewModel';
import AwNumeric from 'viewmodel/AwNumericViewModel';
import AwFlexRow from 'viewmodel/AwFlexRowViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwFlexColumn from 'viewmodel/AwFlexColumnViewModel';
import _ from 'lodash';
import { EnableWhen } from 'js/hocCollection';

const AwButtonEnableWhen = EnableWhen( AwButton );

export const awFilterCategoryNumericFilterRenderFunction = ( props ) => {
    let { viewModel, actions, fields, ...prop } = props;
    let {
        category,
        facetAction,
        numericRangeAction,
        numericRangeFacetAction,
        selectFilterAction,
        shiftSelectFilterAction,
        noResultsFoundLabel,
        moreLinkProp,
        lessLinkProp,
        isBulkMode,
        isFilterByCategorySearchStringValid,
        enableWildcardFiltering,
        enableWildcardFilteringIcon,
        addWildcardCallBack,
        numericFacetCallBack,
        numericWildcardOperators
    } = prop;
    let { data, dispatch } = viewModel;
    let { numberOfFiltersToShow, showRangeForWildcardFiltering, numericValue } = data;
    let classForFilterCategoryLink = 'aw-search-filterNameLabelMore aw-base-normal';
    let spaceBetweenEachFilter = 'aw-search-filterInBetweenSpace';
    const filterValsLength = category.filterValues ? category.filterValues.length : 0;
    let noResultsFound = filterValsLength === 0;
    let filterContentInfo = AwFilterPanelUtils.restrictFilterValuesToNumberOfFiltersToShow( category, category.filterValues, numberOfFiltersToShow.dbValue );
    let validNumericValue = numericValue && numericValue.value;

    const performFacetSearchForCurrentCategory = () => {
        let categoryForFacetSearchInput = {};
        categoryForFacetSearchInput.name = category.internalName;
        categoryForFacetSearchInput.startIndex = numberOfFiltersToShow.dbValue;
        categoryForFacetSearchInput.hasMoreFacetValues = category.hasMoreFacetValues;
        facetAction( categoryForFacetSearchInput, category );
        category.updateNumberOfFiltersShown = false;
    };

    const selectFilterCallBackAction = ( filter ) => {
        selectFilterAction( filter, category );
    };

    const shiftSelectFilterCallBackAction = ( filter ) => {
        shiftSelectFilterAction( filter, category );
    };

    const getFilterCategoryContents = ( eachFilter, index ) => {
        return (
            <div className={spaceBetweenEachFilter} key={index}
                title={filterContentInfo[ index ] && filterContentInfo[ index ].name ? filterContentInfo[ index ].name : ''}>
                <AwFilterCategoryContents filter={eachFilter} selectFilterCallBackAction={selectFilterCallBackAction} shiftSelectFilterCallBackAction={shiftSelectFilterCallBackAction}
                    excludeCategory={category.excludeCategory} index={index} isBulkMode={isBulkMode} isFilterByCategorySearchStringValid={isFilterByCategorySearchStringValid}>
                </AwFilterCategoryContents>
            </div>
        );
    };

    const renderCategoryMoreLink = () => {
        if( filterValsLength > numberOfFiltersToShow.dbValue ) {
            return (
                <AwLink className={classForFilterCategoryLink} {...moreLinkProp} action={actions.updateNumberOfFiltersToShowForMoreLink}>
                </AwLink>
            );
        } else if( filterValsLength === numberOfFiltersToShow.dbValue && category.hasMoreFacetValues ) {
            return (
                <AwLink className={classForFilterCategoryLink} {...moreLinkProp} action={performFacetSearchForCurrentCategory}>
                </AwLink>
            );
        }
    };

    const renderCategoryLessLink = () => {
        if( numberOfFiltersToShow.dbValue > category.defaultFilterValueDisplayCount ) {
            return (
                <AwLink className={classForFilterCategoryLink} {...lessLinkProp} action={actions.updateNumberOfFiltersToShowForLessLink}>
                </AwLink>
            );
        }
    };

    const getDefaultStartValue = () => {
        if( category.numericrange && category.numericrange.filter && category.numericrange.filter.startNumericValue !== 0 ) {
            return category.numericrange.filter.startNumericValue;
        }
        return '';
    };

    const getDefaultEndValue = () => {
        if( category.numericrange && category.numericrange.filter && category.numericrange.filter.endNumericValue !== 0 ) {
            return category.numericrange.filter.endNumericValue;
        }
        return '';
    };

    const numericRangeCallBackAction = ( startValue, endValue ) => {
        numericRangeAction( category, startValue, endValue, data.currentWildcardOperator );
    };

    const numericRangeFacetCallBackAction = ( startValue, endValue ) => {
        let newCategory = { ...category };
        newCategory.isServerSearch = true;
        numericRangeFacetAction( newCategory, startValue, endValue, data.currentWildcardOperator );
    };

    const performFacetSearch = ( facetSearchString ) => {
        let categoryForFacetSearchInput = {};
        categoryForFacetSearchInput.name = category.internalName;
        categoryForFacetSearchInput.facetSearchString = facetSearchString;
        categoryForFacetSearchInput.startIndex = 0;
        category.isServerSearch = true;
        categoryForFacetSearchInput.isServerSearch = category.isServerSearch;
        categoryForFacetSearchInput.hasMoreFacetValues = category.hasMoreFacetValues;
        categoryForFacetSearchInput.currentWildcardOperator = data.currentWildcardOperator;
        numericFacetCallBack( categoryForFacetSearchInput, category );
        category.updateNumberOfFiltersShown = false;
    };

    const delayedPerformFacetSearch = _.debounce( ( event ) => {
        let value = AwFilterPanelUtils.validateNumericValue( event.target.value );
        event.target.value = value;
        let updateNumericValue = _.cloneDeep( numericValue );
        updateNumericValue.value = value;
        dispatch( { path: 'data.numericValue', value: updateNumericValue } );
        performFacetSearch( value );
    } );

    const currentWildcardSelection = ( newSelection ) => {
        let showRange = true;
        category.showNumericRangeFilter = false;
        if( newSelection !== 'rangeinclusive' && newSelection !== 'rangeexclusive'  ) {
            showRange = false;
        }
        let wildcardSelectionChanged = false;
        if( !_.isEmpty( data.currentWildcardOperator ) && data.currentWildcardOperator !== newSelection ) {
            wildcardSelectionChanged = true;
        }
        dispatch( { path: 'data', value: { showRangeForWildcardFiltering: showRange, currentWildcardOperator: newSelection } } );
        if( wildcardSelectionChanged ) {
            // when wildcard selection changes, we may need to change the operator type
            addWildcardCallBack( category, data.currentWildcardOperator, fields.numericValue.value, wildcardSelectionChanged, true );
            if( isBulkMode ) {
                performFacetSearch( numericValue.value );
            }
        }
    };

    const updateWildcardOnMountAction = ( newSelection ) => {
        let showRange = true;
        category.showNumericRangeFilter = false;
        if( newSelection !== 'rangeinclusive' && newSelection !== 'rangeexclusive'  ) {
            showRange = false;
        }
        dispatch( { path: 'data', value: { showRangeForWildcardFiltering: showRange, currentWildcardOperator: newSelection } } );
    };

    const addWildcardCallBackFunction = () => {
        addWildcardCallBack( category, data.currentWildcardOperator, numericValue.value, undefined, true );
    };

    const getWildcardComponent = () => {
        // The component takes in the list of wildcard operators and the default value of wildcard
        let wildcardOperatorList;
        if( enableWildcardFiltering && (  category.wildcardOperatorList && category.wildcardOperatorList.length > 0  || numericWildcardOperators ) ) {
            category.showNumericRangeFilter = false;
            if( category.wildcardOperatorList.length > 0 ) {
                wildcardOperatorList = category.wildcardOperatorList;
            } else {
                wildcardOperatorList = numericWildcardOperators;
            }
            return (
                <AwFilterWildcard wildcardOperators={wildcardOperatorList} currentWildcardSelection={currentWildcardSelection}
                    categoryInternalName={category.internalName} updateWildcardOnMountCallBack={updateWildcardOnMountAction}></AwFilterWildcard>
            );
        }
    };

    return (
        <div>
            {
                //This component renders the wildcard link with list of operators
                getWildcardComponent()
            }
            {
                enableWildcardFiltering && !showRangeForWildcardFiltering &&
                <AwFlexRow>
                    <AwFlexColumn className='aw-search-filterCategoryTextBox'>
                        <AwNumeric {...Object.assign( {}, fields.numericValue, { autocomplete:'off' } )} onChange={( e ) => delayedPerformFacetSearch( e )}></AwNumeric>
                    </AwFlexColumn>
                    {
                        enableWildcardFilteringIcon &&
                        <AwFlexColumn className='aw-search-addWildcardButton'>
                            <AwButtonEnableWhen iconId={isBulkMode ? 'cmdAdd' : 'cmdApply16'} action={addWildcardCallBackFunction} enableWhen={validNumericValue}></AwButtonEnableWhen>
                        </AwFlexColumn>
                    }
                </AwFlexRow>
            }
            {
                ( category.showNumericRangeFilter || enableWildcardFiltering && showRangeForWildcardFiltering ) &&
                <AwNumericRange
                    iconClass='aw-search-rangeSearchIcon'
                    separatorClass='aw-search-rangeSeparator'
                    iconId={isBulkMode ? 'cmdAdd' : 'cmdSearch'}
                    numericRangeAction={numericRangeCallBackAction}
                    numericRangeFacetAction={numericRangeFacetCallBackAction}
                    defaultStartValue={getDefaultStartValue()}
                    defaultEndValue={getDefaultEndValue()}
                    enableWildcardFiltering={enableWildcardFiltering}>
                </AwNumericRange>
            }
            {
                noResultsFound &&
                <div className={spaceBetweenEachFilter}>
                    <AwLabel {...noResultsFoundLabel}></AwLabel>
                </div>
            }
            {
                filterContentInfo.map( ( eachFilter, index ) => getFilterCategoryContents( eachFilter, index ) )
            }
            {
                !noResultsFound && renderCategoryLessLink()
            }
            {
                !noResultsFound && renderCategoryMoreLink()
            }
        </div>
    );
};
