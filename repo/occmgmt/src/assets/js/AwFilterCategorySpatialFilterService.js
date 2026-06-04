// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/
/* eslint-disable new-cap */

/**
 * This is a service file for spatial category
 *
 * @module js/AwFilterCategorySpatialFilterService
 */
import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';
import { VisibleWhen } from 'js/hocCollection';
import AwSpatialLink from 'viewmodel/AwSpatialLinkViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import _ from 'lodash';
import { noop } from 'js/declUtils';

var exports = {};

const AwSpatialLinkHOC = ExtendedTooltip( AwSpatialLink );
const AwIconVisibleWhen = VisibleWhen( AwIcon );

export const awFilterCategorySpatialFilterRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { category } = prop;
    let spaceBetweenEachFilter = 'aw-subset-spatialFilterInBetweenSpace aw-link aw-base-normal';
    let classLinkBorder = 'sw-aria-border';

    let filterValues = category.filterValues;

    /*
     * Wrapper method for returning the react element comprises from AwFilterCategoryContents
     * @param {Object} eachFilter filter value
     * @param {Integer} index index value
     * @returns React element
     */
    const getFilterCategoryContents = ( filter ) => {
        const handleKeyUp = ( event ) =>{
            if( event && event.which === 13 ) {
                openSpatialCategoryPanel();
            }
        };

        const openSpatialCategoryPanel = () => {
            var panelName = filter.internalName + 'SubPanel';
            var categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
            //Open the sub panel to set the recipe input
            var eventData = {
                nextActiveView: panelName,
                recipeOperator: categoryLogic
            };
            eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
        };

        var tooltip;
        if( filter.internalName === 'Proximity' ) {
            tooltip = 'ProximityTooltip';
        }else{
            tooltip = 'BoxZoneTooltip';
        }
        if( filter.internalName === 'Proximity' || filter.internalName === 'BoxZone' ) {
            return (
                <div className={spaceBetweenEachFilter} key={_.uniqueId()}>
                    <AwIconVisibleWhen visibleWhen={filter.selected && filter.selected.value} className='aw-proximity-selectIcon' iconId='indicatorApprovedPass'></AwIconVisibleWhen>
                    <AwSpatialLinkHOC filter={filter} category={category}
                        extendedTooltip={tooltip}
                        extendedTooltipOptions={{ placement: 'right' }}>
                    </AwSpatialLinkHOC>
                </div>
            );
        }

        // TODO: remove when Plane spatial filter has an extended tooltip
        return (
            <div key={_.uniqueId()} className={spaceBetweenEachFilter}
                title={filter && filter.name ? filter.name : ''}>
                <AwIconVisibleWhen visibleWhen={filter.selected && filter.selected.value} className='aw-proximity-selectIcon' iconId='indicatorApprovedPass'></AwIconVisibleWhen>
                <a tabIndex={0} className={classLinkBorder} href={noop} onClick={openSpatialCategoryPanel} onKeyUp={handleKeyUp} title={filter.name} >{filter.name}</a>
            </div>
        );
    };

    /*
     * Following method builds list of react element from given list of filter values
     * @param {Object} filterValues List of filter values
     * @returns React element
     */
    const getRow = ( filterValues ) =>{
        var filterRows = [];
        if( filterValues && filterValues.length > 0 ) {
            filterRows = filterValues.map( ( filter ) => getFilterCategoryContents( filter ) );
        }
        return filterRows;
    };

    return (
        <div>
            {
                getRow( filterValues )
            }
        </div>
    );
};

export default exports = {
    awFilterCategorySpatialFilterRenderFunction
};
