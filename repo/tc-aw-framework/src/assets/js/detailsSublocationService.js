// Copyright (c) 2024 Siemens

/**
 * @module js/detailsSublocationService
 */
import AwStateService from 'js/awStateService';


export const swaTabChange = ( secondaryActiveTabId ) => {
    if ( secondaryActiveTabId && AwStateService.instance.params.pageId !== secondaryActiveTabId ) {
        AwStateService.instance.go( '.', { pageId: secondaryActiveTabId, page: undefined } );
    }
};

export const initializeSecondaryActiveTabId = ( sublocationState, subPanelContext ) => {
    let pageId = AwStateService.instance.params.pageId;
    let isOpenedObjectChanged = AwStateService.instance.params.uid !== subPanelContext?.openedObject?.uid;
    if ( !isOpenedObjectChanged && pageId && pageId !== sublocationState.getValue().secondaryActiveTabId ) {
        let newSublocationState = { ...sublocationState.getValue() };
        newSublocationState.secondaryActiveTabId = pageId;
        sublocationState.update( newSublocationState );
    }
};

export const getDetaislSubLcnContext = ( secondaryActiveTabId, subPanelContext ) => {
    return {
        ...subPanelContext,
        pageContext: { ...subPanelContext.pageContext, primaryActiveTabId: secondaryActiveTabId }
    };
};
