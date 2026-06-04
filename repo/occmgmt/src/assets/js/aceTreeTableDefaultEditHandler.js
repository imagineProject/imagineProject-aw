// Copyright (c) 2024 Siemens

/**
 *  aceTreeTableDefaultEditHandler
 *
 *  Implementation for AceTreeTableDefaultEditHandler
 *  @module js/aceTreeTableDefaultEditHandler
 *
 /**
 * Implementation for AceTreeTableDefaultEditHandler
 * This will be the default edit handler for ACE
 * If occMgmtTree is used in any other view corresponding handler for that view will be invoked
 * For example
 *    if viewContext = ACE -> AceTreeTableDefaultEditHandler
 *    if viewContext = BC -> BuildConditionEditHandler
 *    and so on...
 */

import aceEditHandlerExtService from 'js/aceEditHandlerExtService';
import { EditHandler } from 'js/editHandlerFactory';

// default class AceTreeTableDefaultEditHandler
export default class AceTreeTableDefaultEditHandler extends EditHandler {
    constructor( editContext, dataSource, editSupportParams, occContext ) {
        super( dataSource, editSupportParams );
        this.editContext = editContext;
        this.occContext = occContext;
    }

    startEdit( editOptions ) {
        let occContextValue = { ...this.occContext.getValue() };
        let viewContext = occContextValue.currentState.view;
        if( viewContext === 'ACE' ) {
            super.startEdit( editOptions );
        }

        let handler = aceEditHandlerExtService.getEditHandlerFromViewContext( viewContext );
        // set and call startEdit on handler specific to viewContext
        if( handler ) {
            aceEditHandlerExtService.setEditHandler( handler, this.editContext );
            handler.startEdit( editOptions );
        }
    }

    saveEdits() {
        super.saveEdits();
    }
}
