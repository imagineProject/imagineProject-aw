// Copyright 2021 Siemens Product Lifecycle Management Software Inc


import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwDiscoveryRecipeChips from 'viewmodel/AwDiscoveryRecipeChipsViewModel';
import AwFilterPanel from 'viewmodel/AwFilterPanelViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwLabel from 'viewmodel/AwLabelViewModel';
import AwScrollpanel from 'viewmodel/AwScrollpanelViewModel';
import AwFlexRow from 'viewmodel/AwFlexRowViewModel';
import AwSplitter from 'viewmodel/AwSplitterViewModel';
import AwEmptyWorkarea from 'viewmodel/AwEmptyWorkareaViewModel';
import { EnableWhen, ExistWhen } from 'js/hocCollection';
import discoveryFilterService from 'js/discoveryFilterService';
import appCtxSvc from 'js/appCtxService';
import awSearchCoreService from 'js/awSearchCoreService';

const AwButtonEnableWhenExistWhen = EnableWhen( ExistWhen( AwButton ) );
const defaultStringWildcardOperatorList = [ 'contains', 'notcontains', 'equals', 'notequals', 'startswith', 'endswith', 'like' ];
const defaultNumericWildcardOperatorList = [ 'gte', 'gt', 'lte', 'lt', 'equals', 'notequals', 'rangeinclusive', 'rangeexclusive' ];
const defaultPartitionWildcardOperatorList = [ 'equals', 'notequals' ];

/**
 * render function for Awb0DiscoveryFilterCommandSubPanel
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awDiscoveryFilterPanelRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { viewModel: { dispatch }, actions, fields, i18n  } = props;

    if( subPanelContext && subPanelContext.fields ) {
        fields = { ...fields, ...subPanelContext.fields };
    }
    let hasRecipe = fields?.recipeState?.recipeGroup?.length > 0;

    let enableWildcardFiltering = false;
    let enableWildcardFilteringIcon = false;
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter && appCtxSvc.ctx.preferences.AW_Discovery_Wildcard_Filter[0] === 'true' ) {
        enableWildcardFiltering = true;
        enableWildcardFilteringIcon = true;
    }

    let displayNoFacetsMessage = false;
    if ( fields && fields.searchState && !fields.searchState.searchInProgress && fields.searchState.noFilterCategories ) {
        displayNoFacetsMessage = true;
    }

    let isReadOnly = false;
    if( props.subPanelContext.occContext && props.subPanelContext.occContext.readOnlyFeatures
        && props.subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature ) {
        isReadOnly = true;
    }

    let filtersDisabledMessage = i18n.filtersDisabledMessage;

    let minSize = 45;
    // controls how far up the panel the splitter can go
    if( fields && fields.recipeState && fields.recipeState.recipeGroup.length > 0 ) {
        minSize += ( fields.recipeState.recipeGroup[0].subCriteria.length - 1 ) * 25;
    }
    var discAdvFilterEnabledPrefValue = appCtxSvc.ctx.preferences.AW_Discovery_Advanced_Filter[0];
    const selectFilterAction = ( filter, category ) => {
        dispatch( { path: 'data.appliedFilter', value: { appliedFilterValue: filter, appliedFilterCategory: category } } );
        if( discAdvFilterEnabledPrefValue === 'false' ) {
            discoveryFilterService.setActiveGroupIndexToZero( props.subPanelContext.sharedData );
        }
        actions.updateSearchStateAfterFilterAction();
    };

    const facetSearchAction = ( categoryForFacetSearchInput, category ) => {
        if( enableWildcardFiltering && categoryForFacetSearchInput.currentWildcardOperator && categoryForFacetSearchInput.facetSearchString !== '' ) {
            categoryForFacetSearchInput.facetSearchString = categoryForFacetSearchInput.currentWildcardOperator + '_$WCARD_' + categoryForFacetSearchInput.facetSearchString;
        }
        dispatch( { path: 'data.facetCategoryInput', value: { categorySearchInput: categoryForFacetSearchInput, facetCategory: category }  } );
        if( category.categoryType === 'Partition' && ( categoryForFacetSearchInput.facetSearchString === undefined || !category.expand ) ) {
            actions.updatePartitionSchemeFacet();
        } else{
            awSearchCoreService.doActionInHalfSeconds( actions.performFacetSearch );
        }
    };

    const numericRangeFacetAction = ( categoryForFacetSearchInput, category, wildcardOperator ) => {
        var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        let startValue = categoryForFacetSearchInput.startValue !== 0 ? categoryForFacetSearchInput.startValue.toString() : '*';
        let endValue = categoryForFacetSearchInput.endValue !== 0 ? categoryForFacetSearchInput.endValue.toString() : '*';
        if( enableWildcardFiltering && wildcardOperator && categoryForFacetSearchInput.facetSearchString !== '' ) {
            categoryForFacetSearchInput.facetSearchString = startValue === '*' && endValue === '*' ? '' : wildcardOperator + '_$WCARD_' + startValue + filterSeparator + endValue;
        }
        dispatch( { path: 'data.facetCategoryInput', value: { categorySearchInput: categoryForFacetSearchInput, facetCategory: category, isRangeSearch: 'true' }  } );
        awSearchCoreService.doActionInHalfSeconds( actions.performFacetSearch );
    };

    const numericFacetSearchAction = ( categoryForFacetSearchInput, category ) => {
        if( categoryForFacetSearchInput.facetSearchString === '' ) {
            categoryForFacetSearchInput.facetSearchString = '*';
        }
        let facetStringValue = categoryForFacetSearchInput.facetSearchString && categoryForFacetSearchInput.facetSearchString !== 0 ? categoryForFacetSearchInput.facetSearchString.toString() : '*';
        let facetSearchStringInput = facetStringValue === '*' ? '' : categoryForFacetSearchInput.currentWildcardOperator + '_$WCARD_' + categoryForFacetSearchInput.facetSearchString;
        let categoryForFacetSearchInputData = {
            facetSearchString: facetSearchStringInput,
            name: categoryForFacetSearchInput.name
        };
        dispatch( { path: 'data.facetCategoryInput', value: { categorySearchInput: categoryForFacetSearchInputData, facetCategory: category, isRangeSearch: 'true' }  } );
        awSearchCoreService.doActionInHalfSeconds( actions.performFacetSearch );
    };

    const excludeCategoryAction = ( category, excludeCategoryToggleValue ) => {
        dispatch( { path: 'data.toggleCategoryInput', value: { excludeCategoryToggleValue: excludeCategoryToggleValue, excludeCategory: category } } );
        actions.toggleCategoryLogic();
    };

    const dataRangeAction = (  categoryForRangeSearch ) => {
        var range = {
            startDate: categoryForRangeSearch.startValue,
            endDate: categoryForRangeSearch.endValue
        };
        dispatch( { path: 'data.appliedFilter', value: { appliedFilterValue: range, appliedFilterCategory: categoryForRangeSearch.category } } );
        if( discAdvFilterEnabledPrefValue === 'false' ) {
            discoveryFilterService.setActiveGroupIndexToZero( props.subPanelContext.sharedData );
        }
        actions.updateSearchStateAfterFilterAction();
    };

    const addWildcardCallBackAction = ( category, wildcardOperator, wildcardFilterValue, wildcardChanged, isNumericCategory ) => {
        let filterValue = {
            categoryName: category.internalName,
            internalName: wildcardFilterValue
        };
        dispatch( { path: 'data.appliedFilter', value: { wildcardOperator: wildcardOperator, appliedFilterValue: filterValue,
            appliedFilterCategory: category, wildcardChanged: wildcardChanged, isNumericCategory: isNumericCategory } } );
        if( discAdvFilterEnabledPrefValue === 'false' ) {
            discoveryFilterService.setActiveGroupIndexToZero( props.subPanelContext.sharedData );
        }
        actions.updateSearchStateAfterFilterAction();
    };

    const numericRangeCallBackAction = ( categoryForRangeSearch, wildcardOperator ) => {
        var range = {
            startValue: categoryForRangeSearch.startValue,
            endValue: categoryForRangeSearch.endValue
        };
        dispatch( { path: 'data.appliedFilter', value: { wildcardOperator: wildcardOperator, appliedFilterValue: range, appliedFilterCategory: categoryForRangeSearch.category } } );
        if( discAdvFilterEnabledPrefValue === 'false' ) {
            discoveryFilterService.setActiveGroupIndexToZero( props.subPanelContext.sharedData );
        }
        actions.updateSearchStateAfterFilterAction();
    };

    return (
        < >
            <AwPanelBody scrollable='false'>

                { hasRecipe &&
                <AwFlexRow className='sw-flex-row max-height' offsetBottom='1f'>
                    <AwScrollpanel>
                        <AwDiscoveryRecipeChips sharedData={props.subPanelContext.sharedData} enableChips={!isReadOnly}
                            recipeObject={fields.recipeState}>
                        </AwDiscoveryRecipeChips>
                    </AwScrollpanel>
                </AwFlexRow>

                }

                { hasRecipe &&
                    <AwSplitter direction='HORIZONTAL' minSize1={minSize} minSize2='0'></AwSplitter>
                }

                <AwFlexRow offset='1f'>
                    { isReadOnly &&
                    <div className='sw-row aw-filter-italicText'>
                        <div className='sw-column'>
                            <AwLabel displayName='Label'
                                dbValue=''
                                type='STRING'
                                labelPosition='NO_PROPERTY_LABEL'
                                fielddata={{ uiValue: filtersDisabledMessage, labelPlacement: 'none' }}>
                            </AwLabel>
                        </div>
                    </div>
                    }

                    { displayNoFacetsMessage &&
                        <AwEmptyWorkarea className='aw-base-scrollPanel'
                            image='graEmptySearch'
                            title={i18n.noResultsFound}
                            hint={i18n.noFacetsFoundMessage}>
                        </AwEmptyWorkarea>
                    }

                    { !( displayNoFacetsMessage || isReadOnly ) &&
                    <AwFilterPanel subPanelContext={{ searchState:fields.searchState }} selectFilterCallBack={selectFilterAction} stringFacetCallBack={facetSearchAction}
                        excludeCategoryCallBack={excludeCategoryAction} dateRangeFacetCallBack={dataRangeAction} stringWildcardOperators={defaultStringWildcardOperatorList}
                        numericWildcardOperators={defaultNumericWildcardOperatorList} partitionWildcardOperators={defaultPartitionWildcardOperatorList} enableWildcardFiltering={enableWildcardFiltering}
                        enableWildcardFilteringIcon={enableWildcardFilteringIcon} addWildcardCallBack={addWildcardCallBackAction} numericFacetCallBack={numericFacetSearchAction}
                        numericRangeCallBack={numericRangeCallBackAction} numericRangeFacetCallBack={numericRangeFacetAction}>
                    </AwFilterPanel>
                    }
                </AwFlexRow>
            </AwPanelBody>
            { !subPanelContext.sharedData.autoApply && !subPanelContext.sharedData.hideFilterApply && fields && fields.searchState &&
                 fields.searchState.categories && fields.searchState.categories.length > 0 &&
            <AwPanelFooter>
                <br>
                </br>
                <AwButtonEnableWhenExistWhen size='auto' action={actions.applyFilter} enableWhen={subPanelContext.sharedData.enableFilterApply} existWhen={!subPanelContext.sharedData.IsEmbeddedComponent}>
                    <AwI18n>
                        {i18n.filterButtonTitle}
                    </AwI18n>
                </AwButtonEnableWhenExistWhen>
                <AwButtonEnableWhenExistWhen size='auto' action={actions.applyFilterForHostedPanel} enableWhen={subPanelContext.sharedData.enableFilterApply} existWhen={subPanelContext.sharedData.IsEmbeddedComponent}>
                    <AwI18n>
                        {i18n.filterButtonTitle}
                    </AwI18n>
                </AwButtonEnableWhenExistWhen>
            </AwPanelFooter>
            }
        </>
    );
};
