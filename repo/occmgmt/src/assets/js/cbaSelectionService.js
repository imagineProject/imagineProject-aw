// Copyright (c) 2024 Siemens

/**
 * Service defines functionality related to selection in CBA View
 * @module js/cbaSelectionService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';

let pwaSelectionChangeListener;
let mapSingleSelectionToMultiple = {};

/**
 * Update selection in tree in CBA UI
 * @param { Array } elementsToSelect List of elements to select
 *  @param { object } occContext occContext of source or target to update with selection.
 */
export const updateSelectionOnContext = function( elementsToSelect, occContext ) {
    if( elementsToSelect && occContext ) {
        // Case 1 : elementsToSelect.length === 0 ==> NO Selection Case
        // Case 2 : elementsToSelect.length === 1 ==> Single Selection Case
        // Case 2 : elementsToSelect.length > 1 ==> Multiple Selection Case
        let selectionsToModify = {
            overwriteSelections:true
        };
        let selectionsToModifyMultiple;

        if( elementsToSelect.length < 2 ) {
            selectionsToModify.elementsToSelect = elementsToSelect;
        }else {
            let singleElementToSelect;
            if ( occContext.treeDataProvider.selectionModel.hasOwnProperty( 'isAlreadySelected' ) &&
                typeof occContext.treeDataProvider.selectionModel.isAlreadySelected === 'function' ) {
                for ( const element of elementsToSelect ) {
                    if ( occContext.treeDataProvider.selectionModel.isAlreadySelected( element ) ) {
                        // If the element is already selected, we skip it
                        continue;
                    }
                    singleElementToSelect = element;
                    break;
                }
            }
            
            singleElementToSelect = singleElementToSelect || elementsToSelect[0];
            selectionsToModify.elementsToSelect = [ singleElementToSelect ];

            selectionsToModifyMultiple = {
                overwriteSelections:false,
                elementsToSelect : elementsToSelect,
                viewToReact: occContext.viewKey
            };
        }

        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );

        if( selectionsToModifyMultiple  ) {
            mapSingleSelectionToMultiple[selectionsToModify.elementsToSelect[0].uid] = selectionsToModifyMultiple;
            pwaSelectionChangeListener = eventBus.subscribe( 'primaryWorkArea.selectionChangeEvent', ( eventData ) => {
                if( eventData.selectedObjects.length === 1 ) {
                    let cachedSelectionsToModifyMultiple = mapSingleSelectionToMultiple[eventData.selectedObjects[0].uid];
                    if( cachedSelectionsToModifyMultiple ) {
                        eventBus.publish( 'cba.selectMultipleElements', cachedSelectionsToModifyMultiple );
                        delete mapSingleSelectionToMultiple[eventData.selectedObjects[0].uid];

                        if( Object.keys( mapSingleSelectionToMultiple ).length === 0 ) {
                            eventBus.unsubscribe( pwaSelectionChangeListener );
                        }
                    }
                }
            } );
        }
    }
};

/**
 * Update selection in tree in CBA UI
 *
 * @param { Array } elementsToSelect List of elements to select
 * @param { object } subPanelContext subPanelContext of source or target to update with selection.
 * @param { string } contextName context name of source or target to update with selection.
 */
export const updateSelections = function( elementsToSelect, subPanelContext, contextName ) {
    if( subPanelContext ) {
        let occContext = contextName === 'CBASrcContext' ? subPanelContext.occContext : subPanelContext.occContext2;
        exports.updateSelectionOnContext( elementsToSelect, occContext );
    }
};

const exports = {
    updateSelectionOnContext,
    updateSelections
};

export default exports;
