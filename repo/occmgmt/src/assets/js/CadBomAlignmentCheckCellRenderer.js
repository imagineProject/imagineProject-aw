// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomAlignmentCheckCellRenderer
 */
import eventBus from 'js/eventBus';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/splmTablePublishedService';

/**
 * Creates the Icon container element for tree command cell.
 *
 * @param {Object} contextObject The context object
 * @param {String} iconURL path of Icon
 * @param {DOMElement} parentElement containerElement
 * @param {String} propName internal name of column
 * @param {String} tooltipViewName name of view file
 * @param {String} tooltipOptions This attribute is used to configure placement and flipBehavior for extended Tooltip
 * @param {String} callbackApi Callback api to call when click on indicator
 *
 * @returns {DOMElement} icon element that suport dynamic toltip
 */
export const getIconCellElement = function( contextObject, iconURL, parentElement, propName, tooltipViewName, tooltipOptions, callbackApi, status ) {
    if( iconURL !== null ) {
        let props = {
            iconName: contextObject.iconName,
            tooltipViewName: tooltipViewName,
            propName: propName,
            tooltipOptions: tooltipOptions || { placement: 'top' },
            contextObject: contextObject,
            iconURL: iconURL,
            status: status
        };
        let iconComponent = includeComponent( 'CbaCellIcon', props );

        let api = function() {
            if( callbackApi ) {
                parentElement.classList.add( 'aw-cba-clickableCellIcon' );
                setTimeout( function() {
                    parentElement.onclick = function( event ) {
                        event.preventDefault();
                        event.stopPropagation();
                        callbackApi( event );
                    };
                }, 100 );
            }
        };

        if( parentElement ) {
            renderComponent( iconComponent, parentElement, api );
        }
    }
    return null;
};

/**
 * Creates the title and command container element for tree command cell.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {Object} column the column associated with the cell
 *
 * @returns {DOMElement} title/command container element
 */
export let createTitleElement = function( vmo, column ) {
    let displayName = '';
    if( vmo.props[ column ] && vmo.props[ column ].displayValues.length > 0 ) {
        displayName = vmo.props[ column ].displayValues.reduce( ( appendedName, value ) => {
            return appendedName = appendedName + ', ' + value;
        } );
    }
    var gridCellText = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT, 'aw-mbm-cellText' );
    gridCellText.innerText = displayName;
    gridCellText.title = displayName;
    return gridCellText;
};

/**
 * Add's Handler to container element for tree command cell.
 *
 * @param {DOMElement} element element on which evnet listener will be added
 * @param {DOMElement} vmo the vmo for the eventdata
 * @param {String} sourceContext context name
 * @param {String} eventName Name of event to publish
 * @param {String} intent Intent of click either crossProbe or findAligned
 */
export let addClickHandlerToElement = function( element, vmo, sourceContext, eventName, intent ) {
    if( element ) {
        element.addEventListener( 'click', function( event ) {
            if( vmo.selected ) {
                event.stopImmediatePropagation();
            }
            let eventData = {
                vmo: vmo,
                contextName: sourceContext,
                event: event
            };
            if( intent ) {
                eventData.intent = intent;
            }
            eventBus.publish( eventName, eventData );
        } );
    }
};

const exports = {
    getIconCellElement,
    createTitleElement,
    addClickHandlerToElement
};

export default exports;
