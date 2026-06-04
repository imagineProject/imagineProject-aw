// Copyright (c) 2024 Siemens

/**
 * This service manages the Personalization engine
 *
 * @module js/AwPersonalizationEngine
 */
import { isEmpty } from 'lodash';
import ccu from 'js/commandConfigUtils.service';
import { applyDynamicCommandsUpdate } from 'js/dynamicConfigurationManager';
import commandDragService from 'js/commandDragService';
import { getDynamicConfig, updatePersonalizedData } from 'js/AwPersonalizationStore';
import { getAdaptedObjects } from 'js/adapterService';
import vmoService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import { updatePinnedDataCache, getCommandId } from 'js/awPersonalizationUtils';

const createCommandID = ( anchor, vmo ) => {
    return anchor + '_' + vmo.uid;
};

const createCommandIdForApp = ( anchor, vmo ) => {
    return anchor +  '_' + vmo.id;
};

export const getVmoDisplayName = ( vmo )=>{
    return vmo.displayName || vmo.cellHeader1 || vmo.props?.object_string?.displayValues?.[0];
};

const createCommandDefinition = ( anchor, vmo, customAction ) => {
    let action;
    if( customAction ) {
        action = customAction;
    } else {
        action = {
            actionType: 'JSFunction',
            method: 'performNavigateActionAndClose',
            inputData: {
                uid: vmo.uid,
                popupApi: '{{commandContext.popupApi}}'
            },
            deps: 'js/launcherService'
        };
    }

    const commandDef = {
        commandId: createCommandID( anchor, vmo ),
        action: action,
        anchor: anchor,
        title: getVmoDisplayName( vmo )
    };
    if( vmo.thumbnailURL ) {
        commandDef.thumbnailURL = vmo.thumbnailURL;
        commandDef.iconId = vmo.typeIconURL || vmo.iconURL;
    } else {
        commandDef.iconId = vmo.typeIconURL || vmo.iconURL;
    }
    return constructCommandsViewModel( commandDef );
};

const createCommandDefinitionForApp = ( anchor, vmo ) => {
    const appAction = {
        actionType: 'JSFunction',
        method: 'performActionAndClose',
        inputData: {
            tileAction: vmo.action,
            context: {},
            runActionWithViewModel: '{{commandContext.runActionWithViewModel}}',
            popupApi: '{{commandContext.popupApi}}'
        },
        deps: 'js/launcherService'
    };
    const commandDef = {
        commandId: createCommandIdForApp( anchor, vmo ),
        iconId: vmo.icon,
        title: vmo.cellHeader1,
        action: appAction,
        anchor: anchor
    };
    return constructCommandsViewModel( commandDef );
};

const createCommandDefinitionFromCommand = ( anchor, command, replaceAnchor ) => {
    let commandId = getCommandId( command.id, replaceAnchor );
    const commandDef = {
        commandId: createCommandIdForApp( anchor, { id: commandId } ),
        iconId: command.icon,
        thumbnailURL: command.thumbnailURL,
        title: command.title,
        action: command.handler?.action,
        anchor: anchor
    };
    return constructCommandsViewModel( commandDef );
};

const constructCommandsViewModel = ( commandDef ) => {
    const { commandId, iconId, thumbnailURL, title, action, anchor } = commandDef;
    return {
        commands: {
            [commandId]: {
                iconId: iconId,
                title: title || commandId,
                thumbnailURL
            }
        },
        commandHandlers: {
            [commandId + 'CmdHandler']: {
                id: commandId,
                action: commandId + 'CmdAction',
                activeWhen: {
                    condition: 'conditions.true'
                },
                visibleWhen: {
                    condition: 'conditions.true'
                }
            }
        },
        commandPlacements: {
            [commandId + 'CmdPlacement']: {
                id: commandId,
                uiAnchor: anchor,
                priority: 999 // Personalization TODO: where to get this from?
            }
        },
        actions: {
            [commandId + 'CmdAction']: action
        }
    };
    // Personalization TODO: Add support for i18n
};

export const pinCommand = ( anchor, vmo, command ) => {
    let commandDef;
    if( command ) {
        commandDef = createCommandDefinitionFromCommand( anchor, command, 'aw_pinnedApps' );
    } else{
        commandDef = vmo ? createCommandDefinitionForApp( anchor, vmo ) : createCommandDefinition( anchor );
    }
    notifyAllCollaborators( 'ADD', anchor, commandDef );
};

export const pinDataCommand = async( anchor, vmo, command, action ) => {
    let commandDef;
    if( vmo ) {
        let adaptedObjects = await getAdaptedObjects( [ vmo ] );
        let adaptedVmo = vmoService.createViewModelObject( adaptedObjects[0].uid );
        commandDef = createCommandDefinition( anchor, adaptedVmo, action );
    } else if( command ) {
        commandDef = createCommandDefinitionFromCommand( anchor, command, 'aw_pinnedData' );
    }
    notifyAllCollaborators( 'ADD', anchor, commandDef );
};

export const pinDataCommands = async( anchor, vmos ) => {
    let commandDefs = [];
    let adaptedObjects = await getAdaptedObjects( vmos );
    for ( let idx in adaptedObjects ) {
        let commandDef;
        const obj = cdm.getObject( adaptedObjects[idx].uid ) || { props: {} };
        if( Object.keys( obj.props ).length > 0 ) {
            let adaptedVmo = vmoService.createViewModelObject( adaptedObjects[idx].uid );
            commandDef = createCommandDefinition( anchor, adaptedVmo );
        } else {
            commandDef = createCommandDefinition( anchor, vmos[idx] );
        }

        commandDefs.push( commandDef );
    }

    if( commandDefs.length > 0 ) {
        notifyAllCollaborators( 'ADD', anchor, commandDefs, true );
    }
};

const deleteCommandDefinition = ( anchor, commandId ) => {
    let commandDef;
    const personalizedCommandsViewModel = getDynamicConfig( 'commandsViewModel' ); // Personalization TODO: This should be done only when the anchor (available in caller) or the commandBar supports personalization
    if( !isEmpty( personalizedCommandsViewModel ) ) {
        if( personalizedCommandsViewModel.commands && personalizedCommandsViewModel.commands[commandId] ) { // unpinning newly pinned command
            commandDef = {
                commands: { [commandId]: personalizedCommandsViewModel.commands[commandId] },
                commandHandlers: { [commandId + 'CmdHandler']: personalizedCommandsViewModel.commandHandlers[commandId + 'CmdHandler'] },
                commandPlacements: { [commandId + 'CmdPlacement']: personalizedCommandsViewModel.commandPlacements[commandId + 'CmdPlacement'] },
                actions: { [commandId + 'CmdAction']: personalizedCommandsViewModel.actions[commandId + 'CmdAction'] }
            };
        }
    }
    return commandDef;
};

export const unpinCommand = async( anchor, vmo, cmdId ) => {
    let unpinCommandId = cmdId;
    if( !unpinCommandId ) {
        unpinCommandId = vmo ? createCommandIdForApp( anchor, vmo ) : createCommandID( anchor );
    }

    const commandsViewModel = await ccu.getCommandsViewModel( false, false );
    const existingPlacements = Object.entries( commandsViewModel.commandPlacements );
    const getExistingCommandPlacement = existingPlacements.reduce( ( acc, [ placementId, placementDef ] ) => {
        const newId = `${placementDef.id}:${placementDef.uiAnchor}`;
        acc[ newId ] = { ...placementDef, placementId };
        return acc;
    }, {} );
    const existingPlacementDef = getExistingCommandPlacement[ `${unpinCommandId}:${anchor}` ];

    if ( existingPlacementDef ) {
        const commandPlacements = {
            [existingPlacementDef.placementId]: {
                id: unpinCommandId,
                uiAnchor: ''
            }
        };
        notifyAllCollaborators( 'ADD', anchor, { commandPlacements } );
    } else {
        const commandDef = deleteCommandDefinition( anchor, unpinCommandId );
        if ( commandDef ) {
            notifyAllCollaborators( 'DELETE', anchor, commandDef );
        }
    }
};

export const unpinDataCommand = async( anchor, vmo, cmdId ) => {
    let unpinDataCommandId = cmdId;
    if( vmo ) {
        let adaptedObjects = await getAdaptedObjects( [ vmo ] );
        unpinDataCommandId = createCommandID( anchor, adaptedObjects[0] );
    }

    const commandDef = deleteCommandDefinition( anchor, unpinDataCommandId );
    if ( commandDef ) {
        notifyAllCollaborators( 'DELETE', anchor, commandDef );
    }
};

export const moveToFront = ( context ) => {
    let cmdList = context.commandDisplays || context.firstCommandDisplays;
    const anchor = context.anchor || context.firstAnchor;
    const targetCommandId = context.command.id;
    const reverse = false;
    let targetIndx;

    cmdList.filter( ( cmd, index ) => {
        if( cmd.id === targetCommandId ) {
            targetIndx = index;
        }
    } );

    const removedCommand = cmdList.splice( targetIndx, 1 )[0];
    cmdList.unshift( removedCommand );

    if( reverse ) {
        let idx = 10000;
        cmdList.forEach( cmd => {
            cmd.priority = idx;
            idx--;
        } );
    } else {
        let idx = 0;
        cmdList.forEach( cmd => {
            cmd.priority = idx;
            idx++;
        } );
    }

    reorderCommands( anchor, cmdList );
};

export const reorderCommands = async( anchor, cmds ) => {
    const commandsViewModel = await ccu.getCommandsViewModel( false, true );
    const existingPlacements = Object.entries( commandsViewModel.commandPlacements );
    const getExistingCommandPlacement = existingPlacements.reduce( ( acc, [ placementId, placementDef ] ) => {
        const newId = `${placementDef.id}:${placementDef.uiAnchor}`;
        acc[ newId ] = { ...placementDef, placementId };
        return acc;
    }, {} );

    const commandPlacements = cmds.reduce( ( acc, cmd ) => {
        const placementDef = getExistingCommandPlacement[ `${cmd.id}:${anchor}` ];
        const placementId = placementDef.placementId;
        placementDef.priority = cmd.priority;
        delete placementDef.placementId;
        acc[ placementId ] = placementDef;
        return acc;
    }, {} );
    notifyAllCollaborators( 'UPDATE', anchor, { commandPlacements } );
};

export const handleCommandDrop = async( props ) => {
    const { anchor, cmdList } = await commandDragService.handleDrop( props );
    if( anchor && cmdList ) {
        reorderCommands( anchor, cmdList );
    }
};

const _updatePinnedCacheCtx = () => {
    const personalizedDelta = getDynamicConfig( 'commandsViewModel' );
    updatePinnedDataCache( personalizedDelta );
};

const notifyAllCollaborators = async( operation, anchor, commandDefs, skipPersistent ) => {
    await updatePersonalizedData( 'commandsViewModel', operation, anchor, commandDefs, skipPersistent );
    _updatePinnedCacheCtx();
    applyDynamicCommandsUpdate( anchor );
};

export const updateCommandLabel = ( anchor, commandId, updatedTitle, oldTitle ) => {
    const commandDef = {
        commands: {
            [commandId]: {
                title: updatedTitle
            }
        }
    };
    if( oldTitle && oldTitle !== updatedTitle ) {
        commandDef.commands[commandId].description = updatedTitle + ' (' + oldTitle + ')';
        commandDef.commands[commandId].extendedTooltip = {
            view: 'DataCommandTooltip'
        };
    }else{
        commandDef.commands[commandId].description = null;
        commandDef.commands[commandId].extendedTooltip = null;
    }

    notifyAllCollaborators( 'ADD', anchor, commandDef );
};
