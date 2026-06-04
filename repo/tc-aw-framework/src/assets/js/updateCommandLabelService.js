import { updateCommandLabel, getVmoDisplayName } from 'js/AwPersonalizationEngine';
import vmoService from 'js/viewModelObjectService';
import dataManagementService from 'soa/dataManagementService';
import appCtxService from 'js/appCtxService';
import { getDynamicConfig } from 'js/AwPersonalizationStore';
import eventBus from 'js/eventBus';

export const cancelUpdateLabel = ( popupApi ) => {
    popupApi.hide();
};

export const performCommandLabelUpdate = async( anchor, commandId, uid, updatedTitle, popupApi ) => {
    if ( updatedTitle.length > 0 ) {
        let vmo = vmoService.createViewModelObject( uid );
        if ( !vmo || Object.keys( vmo.props ).length === 0 ) {
            await dataManagementService.loadObjects( [ uid ] );
            vmo = vmoService.createViewModelObject( uid );
        }
        let oldTitle = getVmoDisplayName( vmo );
        updateCommandLabel( anchor, commandId, updatedTitle, oldTitle );
        popupApi.hide();
    }
};

const handleDataUpdate = async( eventData ) => {
    for ( const modifiedObject of eventData?.modifiedObjects ?? [] ) {
        const modifiedUid = modifiedObject.uid;
        if ( appCtxService.ctx?.personalization_pinnedCommands?.aw_globalNavigationbar?.includes( modifiedUid ) ) {
            const commandsViewModel = getDynamicConfig( 'commandsViewModel' );
            for ( const [ commandId, command ] of Object.entries( commandsViewModel?.commands || {} ) ) {
                if ( commandId.includes( modifiedUid ) ) {
                    let vmo = vmoService.createViewModelObject( modifiedUid );
                    let updatedTitle = getVmoDisplayName( vmo );
                    if ( updatedTitle !== command.title ) {
                        if ( !command.description ) {
                            updateCommandLabel( 'aw_globalNavigationbar', commandId, updatedTitle );
                        } else {
                            // Update title in command description.
                            updateCommandLabel( 'aw_globalNavigationbar', commandId, command.title, updatedTitle );
                        }
                    } else if ( updatedTitle === command.title && command.description ) {
                        updateCommandLabel( 'aw_globalNavigationbar', commandId, command.title, updatedTitle );
                    }
                }
            }
        }
    }
};

export const manageUpdates = () => {
    eventBus.subscribe( 'cdm.modified', async function( eventData ) {
        handleDataUpdate( eventData );
    } );
};
