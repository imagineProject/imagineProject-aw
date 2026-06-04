// Copyright 2024 Siemens Product Lifecycle Management Software Inc.
/* global */
/**
 * @module js/AwSavedQueryCriteriaTableLovService
 */
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
/**
 * render function for AwLovEdit
 * @param {*} param0 context for render function interpolation
 * @returns {JSX.Element} react component
 */

// The below types represent referenced, unreferenced, external referenced, and relation properties
const typesForIsNullIsNotNullMathOperatorList = [ 9, 10, 11, 14 ];

var exports = {};
export const awOperatorLOVComponentRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;


    let fielddata = { ...prop.fielddata };

    if( fielddata.propertyName === 'Operator' ) {
        if( typesForIsNullIsNotNullMathOperatorList.includes( props.vmo.propertyType ) ) {
            fielddata.dataProvider = viewModel.dataProviders.mathOperatorIsNullIsNotNullProvider;
        }
        else {
            fielddata.dataProvider = viewModel.dataProviders.mathOperatorProvider;
        }
    }
    else if( fielddata.propertyName === 'LogicalOperator' ) {
        fielddata.dataProvider = viewModel.dataProviders.logicalOperatorProvider;
    }
    fielddata.emptyLOVEntry = false;
    fielddata.hasLov = true;

    const passedProps = { ...prop,  fielddata };
    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};
exports = {
    awOperatorLOVComponentRenderFunction
};
export default exports;

