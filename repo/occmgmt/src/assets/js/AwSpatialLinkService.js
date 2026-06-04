// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/

/**
 * This is a service file for spatial link
 *
 * @module js/AwSpatialLinkService
 */
import eventBus from 'js/eventBus';
import { noop } from 'js/declUtils';
import { isAdvancedFilterComponentHosted } from 'js/occmgmtSubsetUtils';
var exports = {};


export const awSpatialLinkRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { filter, category } = prop;
    let classLinkBorder = 'sw-aria-border';
    let disabledSpatialClass = 'sw-aria-border aw-subset-spatialLinkDisable';

    const handleKeyUp = ( event ) =>{
        if( event && event.which === 13 ) {
            openSpatialCategoryPanel();
        }
    };

    const openSpatialCategoryPanel = ( ) => {
        var panelName = filter.internalName + 'SubPanel';
        var categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
        //Open the sub panel to set the recipe input
        var eventData = {
            nextActiveView: panelName,
            recipeOperator: categoryLogic
        };
        eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
    };
    // Proximity,BoundingBox and BoxZone are all selection based filter types which is not possible in hosted Advanced Filter Component
    // hence disable them
    if( isAdvancedFilterComponentHosted() && ( filter.internalName === 'Proximity' || filter.internalName === 'BoundingBox' || filter.internalName === 'BoxZone' ) ) {
        return (
            <a tabIndex={0} className={disabledSpatialClass} href={noop} onClick={openSpatialCategoryPanel} onKeyUp={handleKeyUp}>{filter.name}</a>
        );
    }
    return (
        <a tabIndex={0} className={classLinkBorder} href={noop} onClick={openSpatialCategoryPanel} onKeyUp={handleKeyUp}>{filter.name}</a>

    );
};

export default exports = {
    awSpatialLinkRenderFunction
};
