/**
 * This is a service file for Partition link
 *
 * @module js/AwPartitionLinkService
 */

import eventBus from 'js/eventBus';
import { noop } from 'js/declUtils';
import AwIcon from 'viewmodel/AwIconViewModel';
import { VisibleWhen } from 'js/hocCollection';

var exports = {};

const AwIconVisibleWhen = VisibleWhen( AwIcon );

export const awPartitionLinkRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { filter, category } = prop;
    let classLinkBorder = 'sw-aria-border';

    let tabIndexForScheme = 0;
    for( let inx = 0; inx < category.filterValues.length;  ++inx ) {
        if(  filter.name === category.filterValues[inx].name ) {
            tabIndexForScheme = inx + 1;
        }
    }

    const handleKeyUp = ( event ) =>{
        if( event && event.which === 13 ) {
            let index = event.currentTarget.attributes[0].value;
            openPartitionWidePanel( index );
        }
    };

    const openPartitionWidePanel = ( schemeIndexInCategory ) => {
        let panelName = 'PartitionHierarchySubPanel';
        let categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
        if( schemeIndexInCategory ) {
            //The array index starts from zero.
            let selectedScheme = category.filterValues[schemeIndexInCategory - 1];

            //Open the sub panel to set the recipe input
            var eventData = {
                nextActiveView: panelName,
                recipeOperator: categoryLogic,
                selectedObj: selectedScheme
            };
            eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
        }
    };
    return (
        <span>
            <span className='aw-partitionPanel-schemeTitle'>{filter.name}</span>
            <a tabIndex={tabIndexForScheme} className={classLinkBorder} href={noop} onKeyUp={handleKeyUp} >
                <AwIconVisibleWhen visibleWhen={filter} className='aw-partitionPanel-nevigateIcon' iconId='miscCollapse'></AwIconVisibleWhen>
            </a>
        </span>
    );
};


export default exports = {
    awPartitionLinkRenderFunction
};

