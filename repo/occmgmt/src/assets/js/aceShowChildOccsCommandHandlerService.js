// Copyright (c) 2022 Siemens

/**
 * This is the command handler for show child occurrences command which is contributed to cell list.
 *
 * @module js/aceShowChildOccsCommandHandlerService
 */
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import cdmSvc from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

export let getContextKeyFromParentScope = function( parentScope ) {
    return aceContextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

export let showChildOccurences = function( vmo, contextKey ) {
    eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
        objectsToSelect: [ cdmSvc.getObject( vmo.uid ) ],
        viewToReact: contextKey,
        nodeToExpandAfterFocus: vmo.uid
    } );

    popupService.hide();
};

export default exports = {
    getContextKeyFromParentScope,
    showChildOccurences
};
