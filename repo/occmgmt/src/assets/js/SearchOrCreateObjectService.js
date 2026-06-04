import AwLovEdit from 'viewmodel/AwLovEditViewModel';

/**
 * render function for SrarchOrCreateObjectVal
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awSearchOrCreateObjectRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    const fielddata = { ...prop.fielddata };
    fielddata.dataProvider = viewModel.dataProviders.getRefObjectsDataProvider;
    const passedProps = { ...prop,  fielddata };
    passedProps.hideFilter = false;
    passedProps.vmo.props[passedProps.name].hasLov = true;
    passedProps.dialogActionForACEContextMenu = props.vmo.dialogActionForACEContextMenu;
    return (
        <AwLovEdit {...passedProps} anchor='aw_editActionCell' ></AwLovEdit>
    );
};
