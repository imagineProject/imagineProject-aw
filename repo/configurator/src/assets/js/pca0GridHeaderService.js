// Copyright (c) 2025 Siemens

/**
 * @module js/pca0GridHeaderService
 */

import appCtxService from 'js/appCtxService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import { getBaseUrlPath } from 'app';
import pca0RendererService from 'js/pca0RendererService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

/**
 * Local Util Methods
 */

/**
 * Initializes tooltip details based on the provided legend type and tooltip visibility flag.
 * @param {string} legendType - The type of legend for which the tooltip is being initialized.
 * @param {boolean} showTooltipFlag - A flag indicating whether the tooltip should be shown.
 * @returns {Object} An object containing the tooltip details.
 */
let _initializeTooltipDetails = ( legendType, showTooltipFlag ) => {
    return {
        tooltipIconUrl: legendType === 'MultiSVRGridHeaderTooltip' ? '' : getBaseUrlPath() + '/image/indicatorInfo16.svg',
        extTooltipDetails: {
            legendType: legendType,
            legendItems: []
        },
        showTooltip: showTooltipFlag
    };
};


/**
 *   Export APIs section starts
 */
let exports = {};


/**
 * Populate fields to build/render Extended Tooltip for Grid column header cells
 * @param {AwTableColumnInfo} column The Column Object whose extendedTooltip must be initialized
 * @param {String} gridEditorMode mode of the grid editor(ex: "Cfg0AbsMatrixRule", "multiSvrGrid")
 * @return {Object} data container to initialize Extended Tooltip component for column
 */
export let buildGridHeaderTooltipDetails = ( column, gridEditorMode ) => {
    // No extended tooltip is supported for 'Variability Content', split columns and additional property columns from COTS file
    // requires below check because this is also being called independently for constraints
    if( column.isTreeNavigation  || _.isUndefined( column.props ) || column.isSplitColumn && gridEditorMode !== veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        return {};
    }

    let tooltipDetails;
    if( gridEditorMode === veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        tooltipDetails = _initializeTooltipDetails( 'MultiSVRGridHeaderTooltip', true );
    } else {
        let configContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        tooltipDetails = _initializeTooltipDetails( 'ConstraintsGridHeaderTooltip', !configContext.showPropsInfoInGrid );
    }

    let   { tooltipIconUrl, extTooltipDetails, showTooltip } = tooltipDetails;
    if( showTooltip && gridEditorMode !== veConstants.GRID_CONSTANTS.MULTI_SVR_GRID ) {
        if( !_.isUndefined( column.viewModelObject ) ) {
            Object.entries( column.viewModelObject ).forEach( ( [ propKey, propValue ] ) => {
                if( !propValue.isPropertyNotFromCots ) {
                    let propertyDisplayName = propValue.propDisplayName;

                    let vmProp = uwPropertyService.createViewModelProperty(
                        propKey, // propertyName
                        propertyDisplayName, // propertyDisplayName
                        'STRING', // dataType
                        propValue.propDisplayValue, // dbValue
                        [ propValue.propDisplayValue ] // displayValuesIn
                    );

                    vmProp.fielddata = {
                        propertyDisplayName: propertyDisplayName,
                        uiValue: propValue.propDisplayValue
                    };
                    extTooltipDetails.legendItems.push( vmProp );
                }
            } );
        }
    }

    const {
        expressionNonGridableTooltipDetails, // The formula details of non-gridable tooltip
        showExpressionNonGridableTooltip // boolean to indicate if the non gridable tooltip should be shown
    } = pca0RendererService.createExpressionNonGridableTooltipInfoIfApplicable( column );

    return { showTooltip, tooltipIconUrl, extTooltipDetails, expressionNonGridableTooltipDetails, showExpressionNonGridableTooltip };
};

/**
 * Util to clear the background color of input grid header cells
 * @param {Array} headerCells - list of header cells
 * @param {String} className - CSS class Name to remove from the node
 * @param {String} gridId - Grid id on which column header to be coloured
 */
export let cleanHeaderCells = ( headerCells, className, gridId ) => {
    headerCells.forEach( headerCell => {
        pca0RendererService.unColorifyHeaderCell(
            headerCell.propertyDisplayName, // titleName
            className,
            gridId
        );
    } );
};


export default exports = {
    buildGridHeaderTooltipDetails,
    cleanHeaderCells
};
