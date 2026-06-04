import AwList from 'viewmodel/AwListViewModel';
import AwDefaultCell from 'viewmodel/AwDefaultCellViewModel';
import AwScrollpanel from 'viewmodel/AwScrollpanelViewModel';
import AwFlexRow from 'viewmodel/AwFlexRowViewModel';

/**
  * This method is used to render the schedule navigation chevron popup list
  * @param {Object} props - props
  * @returns {HTMLElement} popup list.
  */
export const scheduleBreadCrumbListRenderFn = ( props ) => {
    let { viewModel, chevronPopup }  = props;
    let totalFound = viewModel.dataProviders.scheduleNavBreadcrumbChevronDataProvider.viewModelCollection.loadedVMObjects.length;
    let height = totalFound < 50 ? 'fill' : '50f';

    return (
        <AwFlexRow height={height}>
            <AwScrollpanel>
                <AwList dataprovider={viewModel.dataProviders.scheduleNavBreadcrumbChevronDataProvider} commandContext={{ chevronPopup: chevronPopup }} hasFloatingCellCommands={false}>
                    <AwDefaultCell vmo='item' ></AwDefaultCell>
                </AwList>
            </AwScrollpanel>
        </AwFlexRow>
    );
};
