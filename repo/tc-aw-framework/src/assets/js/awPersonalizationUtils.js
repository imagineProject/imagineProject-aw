// Copyright (c) 2025 Siemens

/**
 * This service manages the Personalization updates
 *
 * @module js/awPersonalizationUtils
 */

import { get, merge } from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';
import workspaceSvc from 'js/workspaceService';
import cfgSvc from 'js/configurationService';
import localeSvc from 'js/localeService';

const INTERNAL_UICONFIG = 'Internal-AWS2-2025-06-UiConfig';
const personalizationScope = {
    user: 'User'
};

/**
 * Checks if the personalization is enabled
 *
 * @returns {Boolean} - `true` if personalization is enabled
 */
export const isPersonalizationEnabled = () => {
    const urlParms = browserUtils.getUrlAttributes();
    return Boolean( urlParms.personalization === 'true' );
};

/**
 * Extracts the command ID from a given command ID and anchor name
 *
 * @param {String} commandId - Command ID
 * @param {String} anchor - Anchor name
 * @returns {String} - Extracted command ID
 */
export const getCommandId = ( commandId, anchor ) =>{
    return commandId.includes( anchor + '_' ) ? commandId.split( anchor + '_' )[1] : commandId;
};

/**
 * Generates the personalization data ID for a given command ID and anchor name
 *
 * @param {String} commandId - Command ID
 * @param {String} anchor - Anchor name
 * @returns {String} - Personalization data ID
 */
export const getPersonalizationDataId = ( commandId, anchor ) => {
    return `${commandId}:${anchor}`;
};

/**
 * Updates the pinned data cache with the given personalized delta
 *
 * @param {Object} personalizedDelta - Personalized delta data
 */
export const updatePinnedDataCache = ( personalizedDelta ) => {
    let anchorToPinnedCmdMap = {};
    for ( let placementId in personalizedDelta?.commandPlacements ) {
        let placement = personalizedDelta?.commandPlacements[placementId];
        if ( placement?.id && placement.uiAnchor ) {
            if ( anchorToPinnedCmdMap[placement.uiAnchor] ) {
                anchorToPinnedCmdMap[placement.uiAnchor].push( getCommandId( placement.id, placement.uiAnchor ) );
            } else {
                anchorToPinnedCmdMap[placement.uiAnchor] = [ getCommandId( placement.id, placement.uiAnchor ) ];
            }
        }
    }
    appCtxService.updatePartialCtx( 'personalization_pinnedCommands', anchorToPinnedCmdMap );
};

/**
 * Prepares the personalization input data
 *
 * @param {Object} p_data - Personalization data
 * @param {String} type - Type of the personalization data
 * @param {String} anchor - Anchor name
 * @returns {Array} - Personalization input data
 */
export const preparePersonalizationInput = ( p_data, type, anchor ) => {
    const personalizationInput = [];
    for( const commandId in p_data.commands ) {
        personalizationInput.push( {
            id: getPersonalizationDataId( commandId, anchor ),
            type: type,
            JSONData: JSON.stringify( p_data ),
            scope: personalizationScope.user
        } );
    }

    if( !p_data.commands ) {
        for( const placementId in p_data.commandPlacements ) {
            const commandId = p_data.commandPlacements[placementId].id;
            const JSONData = {
                commandPlacements: {
                    [placementId]: p_data.commandPlacements[placementId]
                }
            };
            personalizationInput.push( {
                id: getPersonalizationDataId( commandId, anchor ),
                type: type,
                JSONData: JSON.stringify( JSONData ),
                scope: personalizationScope.user
            } );
        }
    }

    return personalizationInput;
};

/**
 * Get available context configuration for the given workspace
 *
 * @param {String} currWorkspaceId - active workspace ID
 * @return {Array} page list
 */
const _getCurrentWorkspaceConfig = async( currWorkspaceId ) => {
    if( !currWorkspaceId ) {
        return {};
    }

    const workspaces = await cfgSvc.getCfg( 'workspace' );
    let currWorkspace = {};
    if( workspaces ) {
        currWorkspace = get( workspaces, currWorkspaceId );
    }
    return currWorkspace;
};

/**
 * Get valid commands based on the workspace
 *
 * @param {Object} mergedPersonalizedData - Merged personalized data
 * @returns {Array} - List of valid commands
 */
const _getInValidPersonalizationsBasedOnWorkspace = async( mergedPersonalizedData ) => {
    const currWorkspaceId = appCtxService.getCtx( 'workspace' )?.workspaceId;
    const currWorkspaceConfig = await _getCurrentWorkspaceConfig( currWorkspaceId );
    if( !currWorkspaceId || currWorkspaceConfig?.workspaceType === 'Inclusive' ) {
        return [];
    }

    // Process the personalized data to get the valid commands based on the workspace that is exclusive
    const pagesValidForWorkspace = currWorkspaceConfig && currWorkspaceConfig.availablePages ? currWorkspaceConfig.availablePages : [];
    const commandsForWorkspace = await workspaceSvc.getWorkspaceCommands( currWorkspaceId );
    const excludedCommandsForWorkspace = commandsForWorkspace?.excludedCommands || [];
    const includedCommandsForWorkspace = commandsForWorkspace?.includedCommands || [];

    const commands = mergedPersonalizedData?.commands;
    const actions = mergedPersonalizedData?.actions;
    const inValidCommands = [];
    if( commands ) {
        Object.keys( mergedPersonalizedData.commands ).forEach( ( commandId ) => {
            Object.keys( mergedPersonalizedData.commandHandlers ).forEach( ( key ) => {
                const handler = mergedPersonalizedData.commandHandlers[key];
                if( handler.id === commandId ) {
                    const actionId = handler.action;
                    const action = actions[actionId];
                    if( action.inputData && action.inputData.tileAction ) {
                        const tileAction = action.inputData.tileAction;
                        if( tileAction && tileAction.url ) {
                            let navigationPage;
                            if( tileAction.url.includes( '/' ) ) {
                                navigationPage = tileAction.url.split( '/' )[1].replaceAll( /\./g, '_' );
                            } else {
                                navigationPage = tileAction.url.replaceAll( /\./g, '_' );
                            }

                            if( navigationPage && !pagesValidForWorkspace.includes( navigationPage ) ) {
                                inValidCommands.push( commandId );
                            }
                        } else if( tileAction.commandId && excludedCommandsForWorkspace.includes( tileAction.commandId ) && !includedCommandsForWorkspace.includes( commandId ) ) {
                            inValidCommands.push( commandId );
                        }
                    }
                }
            } );
        } );
    }

    return inValidCommands;
};

/**
 * Extracts the personalized data from the response
 *
 * @param {Object} response - Response from server
 * @param {String} type - Type of the personalization data to be extracted
 * @returns {Object} - Merged personalized data
 */
const _extractPersonalizedData = async( response, type ) => {
    let mergedPersonalizedData = {};
    if( response && response.personalizationDataOutputs ) {
        for( const indx in response.personalizationDataOutputs ) {
            const personalizationData = response?.personalizationDataOutputs[ indx ]?.personalizationData;
            for( const p_indx in personalizationData ) {
                const data = personalizationData[p_indx];
                if( data.type === type && data.JSONData ) {
                    const parsedData = JSON.parse( data.JSONData );
                    mergedPersonalizedData = merge( mergedPersonalizedData, parsedData );
                }
            }
        }
    }

    const inValidCommands = await _getInValidPersonalizationsBasedOnWorkspace( mergedPersonalizedData );
    if( inValidCommands && inValidCommands.length > 0 ) {
        Object.keys( mergedPersonalizedData.commandPlacements ).forEach( ( placementId ) => {
            const placement = mergedPersonalizedData.commandPlacements[placementId];
            if( placement.id && inValidCommands.includes( placement.id ) ) {
                placement.uiAnchor = '';
            }
        } );
    }

    return mergedPersonalizedData;
};

/**
 * Get or reset personalization data
 *
 * @param {Array} types - List of configuration types to be pulled from server
 * @param {Boolean} reset - `true` if the data is to be reset on server
 * @returns {Object} - Merged personalized data
 */
export const getOrResetPersonalizationData = async( types, reset = false ) => {
    if( isPersonalizationEnabled() ) {
        const getPersonalizationInput = {
            inputs: [  {
                types: types ? types : [],
                reset: reset,
                scope: 'User'
            } ]
        };

        try {
            const personalizationResponse = await soaSvc.post( INTERNAL_UICONFIG, 'getOrResetPersonalizationData', getPersonalizationInput );
            if( personalizationResponse?.ServiceData?.partialErrors ) {
                throw new Error( personalizationResponse.ServiceData.partialErrors );
            }

            const type = 'commandsViewModel';
            return await _extractPersonalizedData( personalizationResponse, type );
        } catch( err ) {
            logger.error( `getPersonalization reported errors ${err}` );
            return null;
        }
    }

    return null;
};

/**
 * Saves or deletes the personalization data on the server
 *
 * @param {Object} personalizationDataToSave - Data to be saved
 * @param {Object} personalizationDataToDelete - Data to be deleted
 */
export const saveOrDeletePersonalizationData = async( personalizationDataToSave, personalizationDataToDelete ) => {
    const savePersonalizationInput = {};
    savePersonalizationInput.personalizationDataToSave = personalizationDataToSave;
    savePersonalizationInput.personalizationDataToDelete = personalizationDataToDelete;

    try {
        const saveResponse = await soaSvc.post( INTERNAL_UICONFIG, 'saveOrDeletePersonalizationData', savePersonalizationInput );
        if ( saveResponse?.partialErrors ) {
            throw new Error( saveResponse.partialErrors );
        }
    } catch ( err ) {
        logger.error( 'Personalization not saved successfully' );
    }
};


export const updateCommandsForInclusiveWorkspace = async( personalizationData ) => {
    if( !personalizationData || !personalizationData.commands ) {
        return {};
    }

    const response = {};
    const currWorkspaceId = appCtxService.getCtx( 'workspace' )?.workspaceId;
    const currWorkspaceConfig = await _getCurrentWorkspaceConfig( currWorkspaceId );
    if( !currWorkspaceConfig ) {
        return response;
    }
    // Get the commands for the current workspace
    const currWorkspaceName = currWorkspaceConfig?.workspaceName;
    const localizedWorkspaceName = localeSvc.getLoadedTextFromKey( `${currWorkspaceName?.source.split( '/' ).pop()}.${currWorkspaceName?.key}` );

    if( currWorkspaceConfig?.workspaceType === 'Exclusive' && currWorkspaceConfig?.includedCommands ) {
        response[ localizedWorkspaceName ] = currWorkspaceConfig;
        response[ localizedWorkspaceName ].includedCommands = currWorkspaceConfig.includedCommands.concat( Object.keys( personalizationData.commands ) );
        // Register workspace after dynamically updating the included commands
        appCtxService.registerCtx( 'workspace', response[ localizedWorkspaceName ] );
    }


    return response;
};
