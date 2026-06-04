import AwLovEdit from 'viewmodel/AwLovEditViewModel';

/**
 * render function for TypeDropDownView
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awTypeDropDownRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    const fielddata = { ...prop.fielddata };
    fielddata.dataProvider = viewModel.dataProviders.getAllowedTypesLOV;
    const passedProps = { ...prop,  fielddata };
    return (
        <AwLovEdit {...passedProps}></AwLovEdit>
    );
};
