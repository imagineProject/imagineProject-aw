// Copyright (c) 2022 Siemens

/**
 * @module js/solutionVariantCellRenderingService
 */
import _ from 'lodash';
import localeService from 'js/localeService';
import tableSvc from 'js/splmTablePublishedService';

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};
let localeTextBundle = localeService.getLoadedText( 'SolutionVariantConstants' );

/**
 * Set color and font of Solution Variant Structure column in Solution Variant Preview
 */
let _solutionVariantStructureCellRenderer = {
    action: function( column, vmo, tableElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( 'aw-solutionvariantjs-svSource' );
        return cellContent;
    },
    condition: function( column, vmo ) {
        if (
            _.isEqual(
                column.displayName,
                localeTextBundle.solutionVariantStructure
            ) &&
            vmo.props &&
            vmo.props.smc1ConfigMatchedSVRevision &&
            vmo.props.smc1ConfigMatchedSVRevision.uiValues.length > 0 &&
            vmo.props.smc1ConfigMatchedSVRevision.uiValues[0] === localeTextBundle.pendingSolutionVariant
        ) {
            return true;
        }
        return false;
    },
    name: 'solutionVariantStructureCellRenderer'
};

/**
 * Set cell template for column definitions
 * @param {Object} columnInfos - Column definitions on which cell class function is to be registered
 */
export let setSolutionVariantCellTemplate = function( columnInfos ) {
    _.forEach( columnInfos, function( column ) {
        column.cellRenderers.push( _solutionVariantStructureCellRenderer );
    } );
};

/**
 * To Set the data for the global Variable
 * Gloabal variable data is used for jest Test
 */
export let solutionVariantCellRenderingService_Test = function(  ) {
    return  _solutionVariantStructureCellRenderer;
};

export default exports = {
    setSolutionVariantCellTemplate,
    solutionVariantCellRenderingService_Test
};
