// Copyright (c) 2022 Siemens

/**
 * @module js/pca0ConstraintsHeaderService
 */

import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0Constants from 'js/Pca0Constants';
import pca0RendererService from 'js/pca0RendererService';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Extract Constraint Type properties when Column Object is being created.
 * Return Property Information container for the Column header: constraintType
 * @param {AwTableColumnInfo} column The Column Object whose header must be initialized
 * @returns {Object} column header properties container
 */
export let getConstraintType = ( column ) => {
    let constraintType = {};
    if( column.isTreeNavigation  || column.isSplitColumn || _.isUndefined( column.props ) ) {
        return {};
    }

    // Constraint type structure (to set correct color style)
    if( !_.isUndefined( column.props[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] ) ) {
        constraintType = { ...column.props[ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODES.TYPE_NODE_UID ] };

        // For Matrix Rule, do not display constraint Type as lon as a dedicated tab is for Matrix Rule authoring
        if( constraintType.parentAbstractClass === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE ) {
            constraintType.propDisplayValue = '';
        }
    }
    return constraintType;
};

/**
 * Util to highlight the background color of constraints grid header cell
 * @param {Object} vmVariabilityProps - atomic data <variabilityProps>
 */
export let colorifyConstraintsHeaderCells = ( vmVariabilityProps ) => {
    let variabilityProps = { ...vmVariabilityProps.getValue() };
    variabilityProps.newConstraints.forEach( newConstraint => {
        pca0RendererService.colorifyHeaderCell(
            newConstraint.propertyDisplayName, // titleName
            pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // color className
            veConstants.GRID_CONSTANTS.PCA_GRID // grid id
        );
    } );
};


export default exports = {
    getConstraintType,
    colorifyConstraintsHeaderCells
};
