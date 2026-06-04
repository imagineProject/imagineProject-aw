// Copyright (c) 2023 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

/* eslint-disable new-cap */

/**
 * This is a service file for Partition category
 *
 * @module js/AwFilterCategoryPartitionFilterService
 */
import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';
import { VisibleWhen } from 'js/hocCollection';
import AwPartitionLink from 'viewmodel/AwPartitionLinkViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import _ from 'lodash';
import localeService from 'js/localeService';
import AwFilterWildcard from 'viewmodel/AwFilterWildcardViewModel';

var exports = {};

const AwPartitionLinkHOC = ExtendedTooltip( AwPartitionLink );
const AwIconVisibleWhen = VisibleWhen( AwIcon );
const _categoryInternalName = 'PartitionScheme';

export const awFilterCategoryPartitionFilterRenderFunction = ( props ) => {
    let { viewModel, ...prop } = props;
    let { category,
        enableWildcardFiltering,
        partitionWildcardOperators,
        addWildcardCallBack
    } = prop;
    let { data, dispatch } = viewModel;
    let spaceBetweenEachFilter = 'aw-partition-filterInBetweenSpace aw-link';
    let filterValues = category.filterValues;


    //The internal name for partition Scheme category is in English.
    //But on wide panel we have to show the name in local language the header section.
    let partitionI18nResource = 'OccmgmtPartitionMessages';
    let partitionI18nResourceBundle = localeService.getLoadedText( partitionI18nResource );
    let schemeNameInLocale = partitionI18nResourceBundle.PartitionScheme;

    /*
      * Wrapper method for returning the react element comprises from AwFilterCategoryContents
      * @param {Object} eachFilter filter value
      * @returns React element
      */
    const getFilterCategoryContents = ( filter ) => {
        const openPartitionCategoryPanel = ( event ) => {
            let panelName = 'PartitionHierarchySubPanel';
            let categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
            let selectedSchemeName = event.currentTarget.innerText;
            let selectedScheme = {};

            for( let i = 0; i < category.filterValues.length;  ++i ) {
                if(  selectedSchemeName === category.filterValues[i].name ) {
                    selectedScheme = category.filterValues[i];
                    selectedScheme.categoryName = schemeNameInLocale;
                }
            }
            //Open the sub panel to set the recipe input
            let eventData = {
                nextActiveView: panelName,
                recipeOperator: categoryLogic,
                selectedObj: selectedScheme

            };
            eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
        };

        if( filter.categoryName === _categoryInternalName ) {
            return (
                <div className={spaceBetweenEachFilter} key={_.uniqueId()} onClick={openPartitionCategoryPanel}>
                    <AwIconVisibleWhen visibleWhen={( filter.selected && filter.selected.value )} className='aw-scheme-selectIcon' iconId='indicatorApprovedPass'></AwIconVisibleWhen>
                    <AwPartitionLinkHOC filter={filter} category={category}
                        extendedTooltip='PartitionToolTip'
                        extTooltipData={filter}
                        extendedTooltipContext={filter}
                        extendedTooltipOptions={{ placement: 'right' }}>
                    </AwPartitionLinkHOC>
                </div>
            );
        }
    };

    const updateWildcardOnMountAction = ( newSelection ) => {
        dispatch( { path: 'data.currentWildcardOperator', value:  newSelection } );
    };

    const currentWildcardSelection = ( newSelection ) => {
        let wildcardSelectionChanged = false;
        if( !_.isEmpty( data.currentWildcardOperator ) && data.currentWildcardOperator !== newSelection ) {
            wildcardSelectionChanged = true;
        }
        dispatch( { path: 'data.currentWildcardOperator', value:  newSelection } );
        if( wildcardSelectionChanged ) {
            addWildcardCallBack( category, data.currentWildcardOperator, '', wildcardSelectionChanged );
        }
    };

    const getWildcardComponent = () => {
        // The component takes in the list of wildcard operators and the default value of wildcard
        let wildcardOperatorList;
        if( enableWildcardFiltering && (  category.wildcardOperatorList && category.wildcardOperatorList.length > 0  || partitionWildcardOperators ) ) {
            if( category.wildcardOperatorList.length > 0 ) {
                wildcardOperatorList = category.wildcardOperatorList;
            } else {
                wildcardOperatorList = partitionWildcardOperators;
            }
            return (
                <AwFilterWildcard wildcardOperators={wildcardOperatorList} currentWildcardSelection={currentWildcardSelection}
                    categoryInternalName={category.internalName} updateWildcardOnMountCallBack={updateWildcardOnMountAction}></AwFilterWildcard>
            );
        }
    };

    /*
      * Following method builds list of react element from given list of filter values
      * @param {Object} filterValues List of filter values
      * @returns React element
      */
    const getRow = ( filterValues ) =>{
        let filterRows = [];
        if( filterValues && filterValues.length > 0 ) {
            filterRows = filterValues.map( ( filter ) => getFilterCategoryContents( filter ) );
        }
        return filterRows;
    };

    return (
        <div>
            {
                //This component renders the wildcard link with list of operators
                getWildcardComponent()
            }
            {
                getRow( filterValues )
            }
        </div>
    );
};

export default exports = {
    awFilterCategoryPartitionFilterRenderFunction
};

