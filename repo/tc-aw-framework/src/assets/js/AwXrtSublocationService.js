import selectionService from 'js/selection.service';
import { DerivedStateResult } from 'js/derivedContextService';
import appCtxService from 'js/appCtxService';


export const handleSelectionChange = ( localSelectionData, baseSelection ) => {
    if( localSelectionData ) {
        let selectionInfo = {};
        const localSelections = localSelectionData.selected ? localSelectionData.selected : [];
        if( localSelections.length > 0 ) {
            selectionInfo = { ...localSelectionData.getValue() };
            selectionInfo.pselected = baseSelection;
            if( selectionInfo.pselected !== localSelectionData.getValue().pselected ) {
                localSelectionData.update( selectionInfo );
            }

            selectionService.updateSelection( localSelections, baseSelection, localSelectionData.relationInfo );
        } else {
            selectionInfo = {};
            selectionInfo.selected = [ baseSelection ];
            selectionInfo.pselected = baseSelection;
            selectionInfo.source = 'base';
            if( selectionInfo.pselected !== localSelectionData.getValue().pselected ) {
                localSelectionData.update( selectionInfo );
            }

            selectionService.updateSelection( baseSelection );
        }
    }
};

export const isRelationsSublocationApplicable = ( vmDef, props ) => {
    return new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [ props.subPanelContext ],
        compute: () => {
            if( appCtxService.ctx?.state?.urlAttributes?.enforceRelationsTree ) {
                return true;
            }
            const pageNameTokens = props.subPanelContext?.showObjectContext?.subLocationTabs.filter( ( tab )=>{
                return tab.view;
            } );
            //This is temporary check to show relations sublocation for structures. In long term this tab should be removed from XRT.
            let isContentSublocation = pageNameTokens.filter( tab => tab.view === 'occurrenceManagement' ).length === 1;
            let isAllXrtTabs = pageNameTokens.length === 0;
            return appCtxService.ctx.state.urlAttributes.relationsTree && ( isContentSublocation || isAllXrtTabs );
        }
    } );
};
