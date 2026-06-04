// Copyright (c) 2021 Siemens
/**
 * @module js/AmTreeNamedACLLOVComponentService
 */
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
/**
 * render function for AwLovEdit
 * @param {*} param0 context for render function interpolation
 * @returns {JSX.Element} react component
 */
var exports = {};

export const awAm0AMTreeNamedACLLOVComponentRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;
    let fielddata = { ...prop.fielddata };
    if( fielddata.propertyName === 'PropertyGroup' ) {
        fielddata.dataProvider = viewModel.dataProviders.propertyGroupProvider;
        fielddata.emptyLOVEntry = false;
    } else if( fielddata.propertyName === 'AccessorType' ) {
        fielddata.dataProvider = viewModel.dataProviders.accessorTypeProvider;
        fielddata.emptyLOVEntry = false;
    } else if( fielddata.propertyName === 'Accessor' ) {
        fielddata.dataProvider = viewModel.dataProviders.accessorProvider;
        fielddata.emptyLOVEntry = false;
    } else{
        fielddata.dataProvider = viewModel.dataProviders.grantPermissionProvider;
        if( prop.value === 'Allow' ) {
            var imagePath = 'assets/image/indicatorApprovedPass16.svg';
            fielddata.iconSource = imagePath;
            //populating display values to track the previous lov values
            fielddata.displayValues[0] = 'Allow';
        } else if( prop.value === 'Deny' ) {
            imagePath = 'assets/image/indicatorNo16.svg';
            fielddata.iconSource = imagePath;
            fielddata.displayValues[0] = 'Deny';
        } else {
            fielddata.displayValues[0] = '';
        }
    }
    fielddata.hasLov = true;

    const passedProps = { ...prop,  fielddata };
    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};
exports = {
    awAm0AMTreeNamedACLLOVComponentRenderFunction
};
export default exports;
