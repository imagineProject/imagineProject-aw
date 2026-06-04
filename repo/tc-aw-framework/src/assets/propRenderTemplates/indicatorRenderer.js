// Copyright (c) 2023 Siemens

import appCtxSvc from 'js/appCtxService';
import { getImageAliasFromId } from 'js/imageRegistry';
import sanitizer from 'js/sanitizer';
import splmTablePubSvc from 'js/splmTablePublishedService';
import { getBaseUrlPath } from 'app';

export const indicatorRenderer = function( vmo, containerElement, field ) {
    // If no props exist, then data is being loaded and we should return skeleton
    if( !vmo.props || Object.keys( vmo.props ).length === 0 ) {
        const skeleton = document.createElement( 'span' );
        skeleton.classList.add( splmTablePubSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
        containerElement.appendChild( skeleton );
        return;
    }

    let displayPref = appCtxSvc.getCtx( 'preferences.AWC_TableIndicatorDisplay' );
    displayPref = displayPref ? displayPref[ 0 ].toLowerCase() : 'imageandtext';
    if( vmo.indicators && vmo.indicators.length > 0 ) {
        // set a class on container element to help with styling
        containerElement.classList.add( 'aw-splm-tableIndicatorRenderer' );
        // remove default 4px padding on custom cell renderer elements
        delete containerElement.style.paddingLeft;
        const docFrag = document.createDocumentFragment();

        // Loop through indicators and create elements for cell
        for( let i = 0; i < vmo.indicators.length; i++ ) {
            let currIndicator = vmo.indicators[ i ];
            // Only do something for indicators that are related to this field
            if( !currIndicator.propName || currIndicator.propName !== field ) {
                continue;
            }

            const liElem = document.createElement( 'li' );
            liElem.classList.add( splmTablePubSvc.CLASS_TABLE_NON_EDIT_CELL_LIST_ITEM, 'aw-visual-indicatorTableItem' );

            // If the display preference is image, or both image and text, create the image element
            if( displayPref === 'image' || displayPref === 'imageandtext' || displayPref === 'textandimage' ) {
                let imagePath = `${getBaseUrlPath()}/${getImageAliasFromId( currIndicator.image )}`;
                const iconElem = document.createElement( 'img' );
                iconElem.src = imagePath;
                iconElem.title = currIndicator.tooltip;
                iconElem.alt = currIndicator.tooltip;
                iconElem.classList.add( 'aw-visual-indicator', 'aw-visual-indicatorTableIcon' );
                liElem.appendChild( iconElem );
            }

            // If the display preference is image and text, create text element
            if( displayPref === 'imageandtext' || displayPref === 'textandimage' ) {
                const textElem = document.createElement( 'span' );
                // be safe and sanitize
                textElem.innerHTML = sanitizer.htmlEscapeAllowEntities( currIndicator.indicatorDisplayName, true, true );
                textElem.title = currIndicator.tooltip;
                textElem.classList.add( 'aw-visual-indicatorTableText' );
                liElem.appendChild( textElem );
            }

            // If text only, then create special text element
            if( displayPref === 'text' ) {
                const liInnerText = document.createElement( 'span' );
                liInnerText.classList.add( splmTablePubSvc.CLASS_WIDGET_TABLE_CELL_TEXT );

                // sanitize inputs before highlighting as well
                const parsedValue = sanitizer.htmlEscapeAllowEntities( currIndicator.indicatorDisplayName, true, true );
                liInnerText.innerHTML = splmTablePubSvc.addHighlights( parsedValue );
                liElem.appendChild( liInnerText );
            }

            if( liElem.childNodes.length > 0 ) {
                docFrag.appendChild( liElem );
            }
        }

        const ulElem = document.createElement( 'ul' );
        ulElem.classList.add( splmTablePubSvc.CLASS_TABLE_NON_EDIT_CELL_LIST );
        // Text only
        if( displayPref === 'text' ) {
            ulElem.classList.add( 'aw-visual-indicatorTableTextOnly' );
        }
        ulElem.appendChild( docFrag );
        containerElement.appendChild( ulElem );
    }
};

export default {
    indicatorRenderer
};
