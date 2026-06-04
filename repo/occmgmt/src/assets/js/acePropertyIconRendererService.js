// Copyright (c) 2022 Siemens

/**
 * @module js/acePropertyIconRendererService
 */
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

var exports = {};

export let loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName, tooltip, subPanelContextForTooltip ) {
    var subPanelContextForTooltipWithProperty = {
        vmoHovered: vmo,
        propHovered: propName,
        subPanelContext: subPanelContextForTooltip
    };
    const subPanelContext = {
        subPanelContextForTooltipWithProperty
    };
    let extendedTooltipElement = includeComponent( viewToRender, subPanelContext );
    if( containerElement ) {
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
    var viewToRender = propName + 'Renderer';
    if( _propertyToBeRendered ) {
        loadViewAndAppendIcon( viewToRender, vmo, containerElement, propName, tooltip, subPanelContextForTooltip );
    }
};

export let overriddenPropRenderer = function( vmo, containerElem, propName ) {
    var _contextList = null;
    var _propList = null;
    if( vmo.props && vmo.props.awb0OverrideContexts && vmo.props.awb0OverriddenProperties ) {
        _contextList = vmo.props.awb0OverrideContexts.dbValues;
        _propList = vmo.props.awb0OverriddenProperties.dbValues;
        for( var idx = 0; idx < _contextList.length; idx++ ) {
            var _prop = _propList[ idx ];
            if( _prop === propName ) {
                var overrideContext = _prop + 'Context';
                if( !vmo.overrideContexts ) {
                    vmo.overrideContexts = {};
                }
                vmo.overrideContexts[ overrideContext ] = _contextList[ idx ];
                containerElem.title = '';
                loadViewAndAppendIcon( 'awb0OverridenPropertyRenderer', vmo, containerElem, propName );
                break;
            }
        }
    }
};

export default exports = {
    loadViewAndAppendIcon,
    propertyIconRenderer,
    overriddenPropRenderer
};
