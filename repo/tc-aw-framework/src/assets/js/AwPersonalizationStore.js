// Copyright (c) 2024 Siemens

/**
 * This service manages the Personalization updates
 *
 * @module js/AwPersonalizationStore
 */

import { merge } from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import { registerDynImportEntry, loadDependentModules } from 'js/moduleLoader';

import { applyDynamicCommandsUpdate } from 'js/dynamicConfigurationManager';
import appCtxService from 'js/appCtxService';
registerDynImportEntry( 'js/awPersonalizationUtils', () => import( 'js/awPersonalizationUtils' ) );
registerDynImportEntry( 'js/updateCommandLabelService', () => import( 'js/updateCommandLabelService' ) );

let _awPersonalizationUtils;
let personalizedDelta = {
    layoutsViewModel: {},
    commandsViewModel: {}
};

const _updatePinnedCacheCtx = () => {
    const personalizedDelta = getDynamicConfig( 'commandsViewModel' );
    _awPersonalizationUtils && _awPersonalizationUtils.updatePinnedDataCache( personalizedDelta );
};

/**
 * Loads the personalization data
 *
 * @param {Array} types - Types of the personalization data to be loaded
 */
const _loadPersonalization = async( types ) => {
    if ( _awPersonalizationUtils && _awPersonalizationUtils.isPersonalizationEnabled() ) {
        try {
            const personalizationData = await _awPersonalizationUtils.getOrResetPersonalizationData( types );
            personalizedDelta.commandsViewModel = merge( personalizedDelta.commandsViewModel, personalizationData );
            const addCommandsToWorkspace = await _awPersonalizationUtils.updateCommandsForInclusiveWorkspace( personalizedDelta.commandsViewModel );
            await updatePersonalizedData( 'workspace', 'ADD', null, addCommandsToWorkspace, true );

            _updatePinnedCacheCtx();
            Object.keys( appCtxService.ctx?.personalization_pinnedCommands ).forEach( anchor => {
                applyDynamicCommandsUpdate( anchor );
            } );
        } catch ( err ) {
            logger.error( `getPersonalization reported errors ${err}` );
        }
    }
};

const _initializeCommandLabelUpdate = async() => {
    if ( _awPersonalizationUtils && _awPersonalizationUtils.isPersonalizationEnabled() ) {
        let updateCommandLabelService = await loadDependentModules( [ 'js/updateCommandLabelService' ] );
        Object.values( updateCommandLabelService )[0].manageUpdates();
    }
};

/**
 * Initializes the personalization data
 *
 * @param {Array} types - Types of the personalization data
 */
export const init = async( types ) => {
    if ( !_awPersonalizationUtils ) {
        let depModules = await loadDependentModules( [ 'js/awPersonalizationUtils' ] );
        _awPersonalizationUtils = Object.values( depModules )[0];
    }
    eventBus.subscribe( 'session.updated', async function() {
        _loadPersonalization( types );
        _initializeCommandLabelUpdate();
    } );
};

export const getDynamicConfig = ( type ) => {
    return personalizedDelta[type];
};

const deleteMatchingData = ( originalData, dataToDelete ) => {
    let updatedData = { ...originalData };
    for ( const key in dataToDelete ) {
        if ( updatedData.hasOwnProperty( key ) ) {
            for ( const innerKey in dataToDelete[key] ) {
                if ( updatedData[key][innerKey] ) {
                    delete updatedData[key][innerKey];
                } else {
                    const obj = {};
                    obj[key] = dataToDelete[key];
                    updatedData = merge( updatedData, obj );
                }
            }
        } else {
            const obj = {};
            obj[key] = dataToDelete[key];
            updatedData = merge( updatedData, obj );
        }
    }

    return updatedData;
};

export const updateClientCachePersonalizationData = ( type, operation, dataToUpdate ) => {
    let newPersonalizedData = Array.isArray( dataToUpdate ) ? dataToUpdate : [ dataToUpdate ];
    for ( let idx in newPersonalizedData ) { // Will be improved with SOA consumption
        if ( operation === 'ADD' ) {
            if ( personalizedDelta[type] ) {
                merge( personalizedDelta[type], newPersonalizedData[idx] );
            } else {
                personalizedDelta[type] = newPersonalizedData[idx];
            }
        } else if ( operation === 'UPDATE' ) {
            personalizedDelta[type] = merge( personalizedDelta[type], newPersonalizedData[idx] );
        } else if ( operation === 'DELETE' ) {
            personalizedDelta[type] = deleteMatchingData( personalizedDelta[type], newPersonalizedData[idx] );
        }
    }
};

export const updatePersonalizedData = async( type, operation, anchor, dataToUpdate, skipPersistent ) => {
    if ( skipPersistent ) {
        // update client cache
        updateClientCachePersonalizationData( type, operation, dataToUpdate );
        return;
    }

    let newPersonalizedData = Array.isArray( dataToUpdate ) ? dataToUpdate : [ dataToUpdate ];

    let personalizationDataToSave = [];
    let personalizationDataToDelete = [];

    newPersonalizedData.map( async( p_data ) => {
        if ( operation === 'ADD' || operation === 'UPDATE' ) {
            personalizationDataToSave = _awPersonalizationUtils.preparePersonalizationInput( p_data, type, anchor );
        } else if ( operation === 'DELETE' ) {
            personalizationDataToDelete = _awPersonalizationUtils.preparePersonalizationInput( p_data, type, anchor );
        }
    } );

    try {
        const saveResponse = await _awPersonalizationUtils.saveOrDeletePersonalizationData( personalizationDataToSave, personalizationDataToDelete );
        if ( saveResponse?.partialErrors ) {
            throw new Error( saveResponse.partialErrors );
        }

        // update client cache
        updateClientCachePersonalizationData( type, operation, dataToUpdate );
    } catch ( err ) {
        logger.error( 'Personalization not saved successfully' );
    }
};
