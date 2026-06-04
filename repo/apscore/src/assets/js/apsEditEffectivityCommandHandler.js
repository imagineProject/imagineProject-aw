// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Effectivity" cell command
 *
 * @module js/apsEditEffectivityCommandHandler
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messageService from 'js/messagingService';

var exports = {};


/**
 * Execute the command.
 *
 * @param {Object} vmo - vmo
 * @param {Object} $scope - scope
 */
export let execute = function( vmo, title ) {
    if( appCtxService.ctx !== null ) {
        if( appCtxService.ctx.effIntents === undefined ) {
            appCtxService.ctx.effIntents = {};
        }
        appCtxService.ctx.effIntents.isAddEffectivity = false;
        let dateIn = new Date( vmo.effObject.dateIn );
        let dateOut = new Date( vmo.effObject.dateOut );
        let defaultDate = new Date( '0001-01-01T00:00:00+00:00' );

        if( ( dateIn.getTime() !== defaultDate.getTime() || dateOut.getTime() !== defaultDate.getTime() )  && ( vmo.effObject.unitIn !== -1 || vmo.effObject.unitOut !== -1 ) ) {
            // Current effectivity panel does not allow authoring/editing of combined [ AND relation ] Unit & Date effectivity.
            // Hence if user tries to edit already authored such effectivity then we need to show warning.
            const localeTextBundle = localeService.getLoadedText( 'ApsEffectivityMessages' );
            let msg = localeTextBundle.ApsEditEffectivityNotSupported.replace( '{0}', appCtxService.ctx?.mselected[0]?.displayName );
            msg = msg.replace( '{1}', appCtxService.ctx?.mselected[0]?.props?.object_type?.uiValue );
            messageService.showInfo( msg );
        } else {
            eventBus.publish( 'navigateToEditPanel', vmo );
        }
    }
};

export default exports = {
    execute
};
