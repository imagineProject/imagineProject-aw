// Copyright (c) 2022 Siemens

/* *
 * @module js/aceInlineAuthoringRenderingService
 */
import aceCellRenderingService from 'js/aceCellRenderingService';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/splmTablePublishedService';

const getRequiredText = function() {
    const resource = 'OccmgmtInlineAuthConstants';
    const inlineLocalTextBundle = localeService.getLoadedText( resource );

    let requiredText;
    if( inlineLocalTextBundle ) {
        requiredText = inlineLocalTextBundle.required;
    } else {
        var asyncFun = function( localTextBundle ) {
            requiredText = localTextBundle.required;
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }

    return requiredText;
};


/**
 *  inline row background renderer
 */
var _rowBackgroundRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        var reqCell = 'aw-occmgmtjs-inlineRowRequiredCell';

        if( rowElem ) {
            rowElem.classList.add( 'aw-occmgmtjs-inlineRow' );
        }

        //Add required indicator
        if( vmo.props[ column.field ].isRequired === true ) {
            cellContent.classList.add( reqCell );
        }
        //Remove required indicator
        if( vmo.props[ column.field ].dbValues[ 0 ] !== undefined && vmo.props[ column.field ].dbValues[ 0 ] !== '' && vmo.props[ column.field ].dbValues[ 0 ] !== null ||
            vmo.props[ column.field ].dbValue !== undefined && vmo.props[ column.field ].dbValue !== '' && vmo.props[ column.field ].dbValue !== null &&
            vmo.props[ column.field ].isRequired === true ) {
            cellContent.classList.remove( reqCell );
        }

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isInlineRow;
    },
    name: '_rowBackgroundRenderer'
};

/**
 *  inline row cell renderer
 */
var _inlineIconCellRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );

        cellContent.appendChild( tableSvc.createCellCommandElement( column, vmo, tableElem ) );
        cellContent.classList.add( 'aw-occmgmtjs-removeInlineRowCommand' );
        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isInlineRow && ( column.isTableCommand === true || column.isTreeNavigation === true );
    },
    name: '_inlineIconCellRenderer'
};

var _requiredCellRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        //This is a temporary solution
        if( vmo.props[ column.field ].isRequired === true ) {
            const requiredText = getRequiredText();
            if( cellContent.classList.contains( 'aw-occmgmtjs-inlineRowRequiredCell' ) ) {
                var style = htmlUtil.createElement( 'style' );
                style.innerHTML = `.aw-occmgmtjs-inlineRowRequiredCell::after { content: "${requiredText}"; }`;
                cellContent.appendChild( style );
            }
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isInlineRow;
    },
    name: '_requiredCellRenderer'
};

/**
 * Sets inline authoring renderers
 * @param {Object} colDefs - columns
 * @param {Object} contextKey - contextKey
 */
export const setInlineAuthoringRenderers = function( colDefs, contextKey ) {
    aceCellRenderingService.setOccmgmtCellTemplate( colDefs, [ _requiredCellRenderer, _rowBackgroundRenderer, _inlineIconCellRenderer ], contextKey );
    if( !appCtxSvc.ctx.customRendererForColumns ) {
        appCtxSvc.updatePartialCtx( 'customRendererForColumns', {} );
        appCtxSvc.updatePartialCtx( 'customRendererForColumns.aceInLineAuth', [ _requiredCellRenderer, _rowBackgroundRenderer, _inlineIconCellRenderer ] );
    }
};

const exports = {
    setInlineAuthoringRenderers
};

export default exports;
