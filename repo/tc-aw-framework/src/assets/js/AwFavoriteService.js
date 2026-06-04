import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwList from 'viewmodel/AwListViewModel';
import AwDefaultCell from 'viewmodel/AwDefaultCellViewModel';
import favoriteSvc from 'js/favoritesService';
import tcFilterService from 'js/tcFilterService';
import AwPromiseService from 'js/awPromiseService';
import AwAdaptiveList from 'viewmodel/AwAdaptiveListViewModel';

export const awFavoriteRenderFunction = ( { i18n, viewModel, subPanelContext } ) => {
    const { dataProviders, dndHandler } = viewModel;

    if( subPanelContext?.adaptive ) {
        const emptyAreaDetails = {
            emptyAreaIcon: subPanelContext.emptyAreaIcon,
            emptyAreaTitle: subPanelContext.emptyAreaTitle,
            emptyAreaHint: subPanelContext.emptyAreaHint
        };
        return <AwAdaptiveList dataprovider={dataProviders.getFavoriteProvider}
            emptyAreaDetails={emptyAreaDetails}
            parentState={subPanelContext.layoutCardAtomicData}
        ></AwAdaptiveList>;
    }

    return (
        <AwPanelSection caption={i18n.favoritesTitle} collapsed='false'>
            <AwList dataprovider={dataProviders.getFavoriteProvider} dndHandler={dndHandler}>
                <AwDefaultCell></AwDefaultCell>
            </AwList>
        </AwPanelSection>
    );
};

export const getFavorites = async( filterTypes, isIncludeSubTypes ) => {
    let newFavs = await favoriteSvc.getFavorites();
    let favResultLength = newFavs.length;
    let favResults = newFavs;
    let filterTypesList = [];
    if( filterTypes ) {
        filterTypesList = filterTypes.split( ',' );
    }
    let isIncludeSubTypesLocal = !( isIncludeSubTypes && isIncludeSubTypes === 'false' );
    // filter the favorite items by filter types
    if( filterTypesList.length > 0 ) {
        let filteredFavoriteObjects = await tcFilterService.getFilteredObjects( favResults, filterTypesList, isIncludeSubTypesLocal );
        favResultLength = filteredFavoriteObjects.length;
        favResults = filteredFavoriteObjects;
    }
    return { favResultLength, favResults };
};
