import AwLovEdit from 'viewmodel/AwLovEditViewModel';

export const awSavedQueryCriteriaTableLocalizationLovComponentRenderFn = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.dataProvider = viewModel.dataProviders.existingLocalizationsDataProvider;
    fielddata.emptyLOVEntry = true;
    fielddata.isSelectOnly = false;
    fielddata.hasLov = true;

    const passedProps = { ...prop,  fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};
