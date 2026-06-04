// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareColorService
 */
import appCtxSvc from 'js/appCtxService';
import tableSvc from 'js/splmTablePublishedService';

var exports = {};
var cssName = '';
var flag = false;

var _checkIfEligibleForPropertyHighlighting = function( diff ) {
    return diff === 2 || diff === 5;
};

var _checkHighlightProcessing = function( row, col ) {
    var columnPropertyName = col.field;
    var lookupKey = row.uid + '$' + columnPropertyName;
    var propertyDiffs = appCtxSvc.getCtx( 'compareContext.propertyDiffs' );
    if( propertyDiffs ) {
        var value = propertyDiffs[ lookupKey ];
        if( _checkIfEligibleForPropertyHighlighting( value ) ) {
            cssName = 'aw-structurecompare-propertydiff';
            flag = true;
        } else {
            cssName = '';
            flag = false;
        }
    }
    return {
        status: flag,
        name: cssName
    };
};

export let gridCellClass = function( grid, row, col ) {
    var columnPropertyName = col.colDef.propertyName;
    var lookupKey = row.entity.uid + '$' + columnPropertyName;
    var propertyDiffs = appCtxSvc.getCtx( 'compareContext.propertyDiffs' );
    if( propertyDiffs ) {
        var value = propertyDiffs[ lookupKey ];
        if( _checkIfEligibleForPropertyHighlighting( value ) ) {
            return 'aw-structurecompare-propertydiff';
        }
    }
    return null;
};

export let pltableCellClass = function( row, col ) {
    var output = _checkHighlightProcessing( row, col );
    return output.name;
};

export let pltableCellClassCond = function( row, col ) {
    var output = _checkHighlightProcessing( row, col );
    return output.status;
};

export let prophighlightRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );

        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            var cssName = exports.pltableCellClass( vmo, column );
            if( cssName.length > 0 ) {
                cellContent.classList.add( cssName );
            }
        }

        return cellContent;
    },
    condition: function( column, vmo, tableElem ) {
        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            return exports.pltableCellClassCond( vmo, column );
        }
        return false;
    },
    name: 'prophighlightRenderer'
};

export default exports = {
    gridCellClass,
    pltableCellClass,
    pltableCellClassCond,
    prophighlightRenderer
};
