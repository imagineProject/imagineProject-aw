// Copyright (c) 2022 Siemens

/**
 * @module js/aceCellRenderingService
 */
import appCtxSvc from 'js/appCtxService';
import acePropertyIconRendererService from 'js/acePropertyIconRendererService';
import occmgmtVisibilitySvc from 'js/aceVisibilityService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import aceGenerateTransformPropertyMatrix from 'js/aceGenerateTransformPropertyMatrix';
import acePartialSelectionService from 'js/acePartialSelectionService';
import localeSvc from 'js/localeService';
import tableSvc from 'js/splmTablePublishedService';
import secondaryComponent from 'js/aceSecondaryComponentService';
import showMarkupSvc from 'js/showMarkupService';

var exports = {};
let localTextBundle = null;

/**
 * Wrapper function that internally routes the application on cell class processing
 * @param {Object} grid - Grid on which the cell class is to be updated
 * @param {Object} row - Table row that is holding the VMO
 * @param {Object} col - Column on which the cell class is to be applied
 * @param {Number} rowRenderIndex - Row rendering index
 * @param {Number} colRenderIndex - Column rendering index
 * @return {String} CSS name to apply on the cell
 */
export let gridCell = function( grid, row, col, rowRenderIndex, colRenderIndex ) {
    if( appCtxSvc.ctx.aceActiveContext.context.cellClass &&
        appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass ) {
        return appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass( grid, row, col, rowRenderIndex,
            colRenderIndex );
    }
};

/**
 * Add cell class for column definitions.
 * @param {Object} columnDefs - Column definitions on which cell class function is to be registered
 */
export let addCellClass = function( columnDefs ) {
    if( appCtxSvc.ctx.aceActiveContext.context.cellClass &&
        appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass ) {
        for( var index = 0; index < columnDefs.length; index++ ) {
            var column = columnDefs[ index ];
            column.cellClass = exports.gridCell;
        }
    }
};

/**
 * Adds/removes imageTooltip class to element.
 *
 * @param {DOMElement} element DOM element for classes
 * @param {Boolean} visibilityControls for adding/removing class
 */
var toggleVisibilityControls = function( vmo, element, visibilityControls ) {
    if( visibilityControls ) {
        let resource = 'OccurrenceManagementMessages';
        localTextBundle = localTextBundle ? localTextBundle : localeSvc.getLoadedText( resource );

        element.classList.add( 'aw-occmgmt-cellImageTooltip' );
        element.title = localTextBundle.showHideTitle;
        element.setAttribute( 'role', 'button' );
        element.setAttribute( 'aria-pressed', vmo.visible );
        element.setAttribute( 'aria-label', vmo.displayName );
    } else {
        element.classList.remove( 'aw-occmgmt-cellImageTooltip' );
        element.title = '';
    }
};

/**
 * Adds/removes partialVisibility class to element.
 *
 * @param {DOMElement} element DOM element for classes
 * @param {Boolean} isVisible for adding/removing class
 */
var togglePartialVisibility = function( element, isVisible ) {
    if( !isVisible ) {
        element.classList.add( 'aw-widgets-partialVisibility' );
    } else {
        element.classList.remove( 'aw-widgets-partialVisibility' );
    }
};


/**
 * Table Command Cell Renderer for PL Table
 */
var _treeCmdCellRender = function() {
    var eventSubs = [];

    return {
        action: function( column, vmo, tableElem ) {
            var viewKey = column.contextKey; //aceContextStateMgmtService.getContextKeyFromParentScope( $( tableElem ).scope() );

            var cellContent = tableSvc.createTreeCellCommandElement( column, vmo, tableElem );

            // add event for cell image visibility
            var gridCellImageElement = cellContent.getElementsByClassName( tableSvc.CLASS_GRID_CELL_IMAGE )[ 0 ];

            secondaryComponent.addIconTogridCellImageElement( vmo, gridCellImageElement );
            if( gridCellImageElement && viewKey ) {
                var performCellToggle = function( event ) {
                    if( appCtxSvc.ctx[ viewKey ].visibilityControls ) {
                        event.stopPropagation();
                        occmgmtVisibilitySvc.toggleOccVisibility( cdm.getObject( vmo.uid ), viewKey );
                        gridCellImageElement.setAttribute( 'aria-pressed', vmo.visible );
                    }
                };

                gridCellImageElement.addEventListener( 'click', performCellToggle );

                toggleVisibilityControls( vmo, gridCellImageElement, appCtxSvc.ctx[ viewKey ].visibilityControls );
                togglePartialVisibility( gridCellImageElement, vmo.visible );
            }

            return cellContent;
        },
        condition: function( column ) {
            return column.isTreeNavigation === true;
        },
        name: 'treeCommandCellRenderer',
        destroy: function() {
            _.forEach( eventSubs, function( eventBusSub ) {
                if( eventBusSub !== null ) {
                    eventBus.unsubscribe( eventBusSub );
                }
            } );
        }
    };
};

var _staleElementRenderer = {
    action: function( column, vmo, tableElem ) {
        return tableSvc.createElement( column, vmo, tableElem );
    },
    condition: function( column, vmo ) {
        return vmo.isStale;
    },
    name: 'staleElementRenderer'
};

var _greyedOutElementRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );


        cellContent.classList.add( 'aw-widgets-partialVisibility' );

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isGreyedOutElement || vmo.isPendingCut;
    },
    name: '_greyedOutElementRenderer'
};

var _overrideIconRenderer = {
    action: function( column, vmo, tableElem ) {
        var columnsToExcludeForCssProcessing = [ 'awb0VariantFormula' ];
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        if( columnsToExcludeForCssProcessing.indexOf( column.propertyName ) === -1 ) {
            cellContent.classList.add( 'aw-occmgmtjs-overrideIcon' );
        }
        cellContent.classList.add( 'aw-occmgmt-iconMinWidth' );
        acePropertyIconRendererService.overriddenPropRenderer( vmo, cellContent, column.propertyName );
        return cellContent;
    },
    condition: function( column, vmo ) {
        if( vmo.props && vmo.props.awb0OverriddenProperties && vmo.props.awb0OverriddenProperties.dbValues.length > 0 &&
            vmo.props.awb0OverriddenProperties.dbValues.indexOf( column.propertyName ) !== -1 ) {
            return true;
        }
        return false;
    },
    name: '_overrideIconRenderer'
};

var _transformRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        aceGenerateTransformPropertyMatrix.generateAwb0TransformRendererFn( vmo, cellContent, column.propertyName );
        return cellContent;
    },
    condition: function( column, vmo ) {
        if( vmo && vmo.props && !vmo.isAdded && !vmo.isDeleted && column &&
          ( vmo.props.awb0Transform && column.propertyName === 'awb0Transform' ||
            vmo.props.awb0RelativeTransform && column.propertyName === 'awb0RelativeTransform' ) &&
            appCtxSvc.ctx.sublocation.clientScopeURI === 'Awb0OccurrenceManagement' ) {
            return true;
        }
        return false;
    },
    name: '_transformRenderer'
};

/**
 * function to add property highlight renderer for compare use cases.
 * @param {Object} dataProvider - Dataprovider object containing columnConfig on which the renderer is to be added
 * @returns {Object} - Object containing columnConfig with renderer added
 */
export let resetpropHighLightForCompare = function( dataProvider ) {
    let columns = [];
    let output = {};
    let columnConfig = dataProvider.columnConfig;
    var propColumns = columnConfig.columns;
    var cellRenderersToReset = [ 'prophighlightRenderer' ];
    for( var index = 0; index < propColumns.length; index++ ) {
        var column = propColumns[ index ];
        _.forEach( cellRenderersToReset, function( renderer ) {
            _.remove( column.cellRenderers, function( cellRenderer ) {
                if( cellRenderer.name ) {
                    return cellRenderer.name === renderer;
                }
            } );
        } );
        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            column.cellRenderers.splice( 0, 0, appCtxSvc.ctx.cellClass.pltablePropRender );
        }
        columns.push( column );
    }
    columnConfig.columns = columns;
    output.columnConfig = columnConfig;
    return output;
};

/**
 * Set cell template for column definitions
 * @param {Object} columnDefs - Column definitions on which cell class function is to be registered
 * @param {Object} cellRenderers -custom renderers
 */
export let setOccmgmtCellTemplate = function( columnDefs, cellRenderers, contextKey ) {
    for( var index = 0; index < columnDefs.length; index++ ) {
        var column = columnDefs[ index ];
        column.cellRenderers = [];
        column.contextKey = contextKey;
        if( appCtxSvc.ctx.customRendererForColumns ) {
            var renderers = Object.keys( appCtxSvc.ctx.customRendererForColumns ).reduce( function( result, key ) {
                return result.concat( appCtxSvc.ctx.customRendererForColumns[ key ] );
            }, [] );
            _.forEach( renderers, function( renderer ) {
                column.cellRenderers.push( renderer );
            } );
        }
        column.cellRenderers.push( showMarkupSvc.rowMarkupRenderer );
        column.cellRenderers.push( _staleElementRenderer );
        column.cellRenderers.push( _greyedOutElementRenderer );
        column.cellRenderers.push( acePartialSelectionService.partialSelectionRenderer );

        if( cellRenderers ) {
            _.forEach( cellRenderers, function( cellRenderer ) {
                if( column.cellRenderers.indexOf( cellRenderer ) === -1 ) { column.cellRenderers.push( cellRenderer ); }
            } );
        }

        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            column.cellRenderers.push( appCtxSvc.ctx.cellClass.pltablePropRender );
        }

        if( column.isTreeNavigation ) {
            column.cellRenderers.push( _treeCmdCellRender() );
        }
        column.cellRenderers.push( _overrideIconRenderer );
        column.cellRenderers.push( _transformRenderer );
    }
};

/**
 * Table/Tree cell rendering service utility
 * @param {Object} appCtxSvc - appCtxService to use.
 * @returns {Object} - Object.
 */

export default exports = {
    gridCell,
    addCellClass,
    setOccmgmtCellTemplate,
    resetpropHighLightForCompare
};
