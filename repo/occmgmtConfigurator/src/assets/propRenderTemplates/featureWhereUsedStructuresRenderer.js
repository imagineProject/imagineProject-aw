// Copyright (c) 2023 Siemens

/**
 *
 * @module propRenderTemplates/featureWhereUsedStructuresRenderer
 */
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

var exports = {};

export let loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName, subPanelContextForTooltip ) {
    var subPanelContextForTooltipWithProperty = {
        vmoHovered: vmo,
        propHovered: propName,
        subPanelContext: subPanelContextForTooltip
    };
    const subPanelContext = {
        subPanelContextForTooltipWithProperty
    };
    let extendedTooltipElement = includeComponent( viewToRender, subPanelContext );
    if( vmo.props[propName].dbValue.length > 0 ) {
        renderComponent( extendedTooltipElement, containerElement );
        return containerElement;
    }
};

/**
 * Generates DOM Element for awb0HasInContextOverrides
 * @param { Object } vmo - ViewModelObject for which element config is being rendered
 * @param { Object } containerElement - The container DOM Element inside which element config will be rendered
 */
export let propertyIconRenderer = function( vmo, containerElement, propName, tooltip, subPanelContextForTooltip ) {
    var _propertyToBeRendered = vmo.props && vmo.props[ propName ] && vmo.props[ propName ].dbValue;
    var viewToRender = 'AceBomLinePropertyOverridesRenderer';
    if( _propertyToBeRendered ) {
        loadViewAndAppendIcon( viewToRender, vmo, containerElement, propName, subPanelContextForTooltip );
    }
};

export default exports = {
    propertyIconRenderer,
    loadViewAndAppendIcon
};
