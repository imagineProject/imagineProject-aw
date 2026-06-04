// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import cdm from 'soa/kernel/clientDataModel';

export default class KanbanViewCallbacks {
    constructor( kanbanProps ) {
        this.kanbanProps = kanbanProps;
        this.draggedObjectPrevIndexMap = {};
        this.onListItemClick = this.onListItemClick.bind( this );
        this.onListAfterDrop = this.onListAfterDrop.bind( this );
        this.onListAfterSelect = this.onListAfterSelect.bind( this );
        this.onListBeforeDrop = this.onListBeforeDrop.bind( this );
    }

    onListItemClick( itemId, ev, node, list ) {
        let self = this; //This is added to fix error "class-methods-use-this"
        let selectionData = this.kanbanProps.selectionData;
        var existingSelectionData = list._selected;
        if( ev.type === 'click' && ev.ctrlKey === true && existingSelectionData.length > 0 ) {
            var object = cdm.getObject( itemId );
            var updatedSelectionData = [];
            for ( var i = 0; i < existingSelectionData.length; i++ ) {
                var modelObject = cdm.getObject( existingSelectionData[ i ] );
                if ( modelObject.uid !== object.uid ) {
                    updatedSelectionData.push( modelObject );
                }
            }
            // Check selection data is updated or not
            if( existingSelectionData.length !== updatedSelectionData.length ) {
            // updating the selectionData, when unselecting the kanban card object
                selectionData.update( { ...selectionData.getValue(), selected: updatedSelectionData } );
            }
        }
    }

    onListAfterDrop( dragContext, e, list ) {
        //Child to implement this function
        let self = this; //This is added to fix error "class-methods-use-this"
    }

    onListAfterSelect( id, state, list ) {
        var selectedObjectUids = state._selected;
        var selectedObjects = [];
        for( var i = 0; i < selectedObjectUids.length; i++ ) {
            var object = cdm.getObject( selectedObjectUids[ i ] );
            if( object ) {
                selectedObjects.push( object );
            }
        }
        let selectionData = this.kanbanProps.selectionData;
        const newSelectionData = { ...selectionData.value };
        newSelectionData.selected = selectedObjects;
        selectionData.update( newSelectionData );
    }

    onListBeforeDrop( dragContext, e, list ) {
        // if we move an item from one list to another
        if( dragContext.from !== dragContext.to ) {
            //Clear the contents of map to remove earlier drag-n-drop references
            this.draggedObjectPrevIndexMap = {};
            var draggedObjects = dragContext.source;
            draggedObjects.forEach( ( object ) => {
                var index = dragContext.from.data.order.indexOf( object );
                this.draggedObjectPrevIndexMap[ object ] = index;
            } );
        }
    }
}
