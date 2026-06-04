// Copyright (c) 2023 Siemens

/**
 * Service defines functionality related to structure viewer.
 * @module js/cbaPropertyLoaderService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import logger from 'js/logger';
import cbaQuantityManagedService from 'js/cbaQuantityManagedService';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import aceGetService from 'js/aceGetService';

/** Map to store view and its property policy */
let _viewToVizPropPolicyId = new Map();
let subDefViewerUpdateEventListener = null;
let subLocationChangeEventListener = null;
/** CBA getOcc input handler */
let cbaGetOccInputProvider  = null;


/**
 * Initialize cbaPropertyLoaderService service
 */
export let initializeService = function( ) {
    logger.debug( 'cbaPropertyLoaderService.initializeService: Initializing cbaPropertyLoaderService' );

    if( !subDefViewerUpdateEventListener ) {
        logger.debug( 'cbaPropertyLoaderService.initializeService: Subscribing to awViewerContext.update event' );
        subDefViewerUpdateEventListener = eventBus.subscribe( 'awViewerContext.update', _loadProperties );
        logger.debug( 'cbaPropertyLoaderService.initializeService: Successfully subscribed to awViewerContext.update' );
    } else {
        logger.debug( 'cbaPropertyLoaderService.initializeService: awViewerContext.update event listener already exists, skipping subscription' );
    }

    if( !subLocationChangeEventListener ) {
        logger.debug( 'cbaPropertyLoaderService.initializeService: Subscribing to locationChangeSuccess event' );
        subLocationChangeEventListener = eventBus.subscribe( 'locationChangeSuccess', _processingPost3DDeactivated );
        logger.debug( 'cbaPropertyLoaderService.initializeService: Successfully subscribed to locationChangeSuccess' );
    } else {
        logger.debug( 'cbaPropertyLoaderService.initializeService: locationChangeSuccess event listener already exists, skipping subscription' );
    }

    logger.debug( 'cbaPropertyLoaderService.initializeService: Service initialization completed' );
};

/**
 * Load properties
 *
 * @param {object} eventData event data
 */
let _loadProperties = function( eventData ) {
    if( eventData && eventData.property === 'occmgmtContextName' ) {
        logger.debug( 'cbaPropertyLoaderService._loadProperties: Property is occmgmtContextName, loading properties for view:', eventData.value );
        _loadPropertiesForView( eventData.value, [ 'awb0ExplodedLineCSIDs' ] );
    } else {
        logger.debug( 'cbaPropertyLoaderService._loadProperties: Event data does not match conditions. Property:', eventData?.property );
    }
};

/**
 * Loads the specified properties for a given view if the view and properties are valid.
 *
 * @param {Object} viewToReact - The view object to which the properties will be loaded.
 * @param {Array} propertiesToLoad - An array of properties to be loaded into the view.
 */
export let loadProperties = function( viewToReact, propertiesToLoad ) {
    logger.debug( 'cbaPropertyLoaderService.loadProperties: Called with viewToReact:', viewToReact, 'propertiesToLoad:', propertiesToLoad );

    if( viewToReact && !_.isEmpty( propertiesToLoad ) ) {
        logger.debug( 'cbaPropertyLoaderService.loadProperties: Conditions met, delegating to _loadPropertiesForView' );
        _loadPropertiesForView( viewToReact, propertiesToLoad );
    } else {
        logger.debug( 'cbaPropertyLoaderService.loadProperties: Conditions not met. viewToReact:', viewToReact, 'propertiesToLoad empty:', _.isEmpty( propertiesToLoad ) );
    }
};

/**
 * Process module specific handling post 3D deactivated
 *
 * @param {object} eventData event data
 */
let _processingPost3DDeactivated = function( eventData ) {
    logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: Location change event received, eventData:', eventData );

    if( eventData ) {
        let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
        logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: Context key:', contextKey );

        let oldUrl3DTabActive = eventData.oldUrl.indexOf( 'altPwa=Awv0StructureViewerPageContainer' ) >= 0 ||
        eventData.oldUrl.indexOf( 'altPwa2=Awv0StructureViewerPageContainer' ) >= 0;

        let newUrl3DTabActive = eventData.newUrl.indexOf( 'altPwa=Awv0StructureViewerPageContainer' ) >= 0 ||
        eventData.newUrl.indexOf( 'altPwa2=Awv0StructureViewerPageContainer' ) >= 0;

        logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: oldUrl3DTabActive:', oldUrl3DTabActive, 'newUrl3DTabActive:', newUrl3DTabActive );

        // If navigating away from 3D tab, un-register the property policy. In hosted mode, we always keep it registered.
        if( oldUrl3DTabActive && !newUrl3DTabActive && !exports.isHostedModeVisEnabled() ) {
            logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: Navigating away from 3D tab, unregistering property policy for context:', contextKey );
            _unRegisterPropPolicy( contextKey );
        } else if( newUrl3DTabActive && !oldUrl3DTabActive ) {
            // If navigating back to 3D tab, re-initialize the service.
            logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: Navigating to 3D tab, re-initializing service' );
            exports.initializeService();
        } else {
            logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: No 3D tab navigation detected, no action taken' );
        }
    } else {
        logger.debug( 'cbaPropertyLoaderService._processingPost3DDeactivated: No eventData provided' );
    }
};

/**
 * Configuration array for CBA (CAD BOM Alignment) visualization properties.
 * Defines properties to be loaded with specific modifiers for UI behavior.
 * 
 * @type {Array<Object>}
 * @property {string} name - The property name to be loaded (e.g., 'awb0ExplodedLineCSIDs')
 * @property {Array<Object>} modifiers - Array of modifier objects that control property loading behavior
 * @property {string} modifiers[].name - The modifier name (e.g., 'excludeUiValues')
 * @property {string} modifiers[].Value - The modifier value (e.g., 'true')
 * @private
 */
const _cbaVisProps = [
    {
        name: 'awb0ExplodedLineCSIDs',
        modifiers: [ {
            name: 'excludeUiValues',
            Value: 'true'
        } ]
    }
];

/**
 * Property handler configuration for CBA visualization properties.
 * Handles the display and management of visualization properties in the tree table
 * when the 3D tab is active.
 * 
 * @typedef {Object} CbaVisPropertyHandler
 * @property {string} key - The identifier key for this property handler ('cbaVisProperty')
 * @property {Function} callbackFunction - Callback function that updates the overridden property policy
 *   for 'Awb0PartElement' with CBA visualization properties
 * @property {Function} condition - Condition function that determines if this handler should be active
 *   based on the occurrence context. Returns true when either altPwa or altPwa2 is set to
 *   'Awv0StructureViewerPageContainer'
 * 
 * @param {Object} overriddenPropertyPolicy - The property policy to be updated (used in callback)
 * @param {Object} occContext - The occurrence context containing current state information (used in condition)
 * @param {Object} occContext.currentState - The current state object
 * @param {string} [occContext.currentState.altPwa] - The primary alternative PWA identifier
 * @param {string} [occContext.currentState.altPwa2] - The secondary alternative PWA identifier
 */
const _cbaVisPropertyHandler = {
    key: 'cbaVisProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Called with overriddenPropertyPolicy' );

        let isAddPolicy = true;
        if ( overriddenPropertyPolicy?.types ) {
            let typeIndex = overriddenPropertyPolicy.types.findIndex( type => type.name === 'Awb0PartElement' );
            logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Awb0PartElement type index:', typeIndex );

            if ( typeIndex !== -1 && overriddenPropertyPolicy.types[ typeIndex ].properties ) {
                let propertyIndex = overriddenPropertyPolicy.types[ typeIndex ].properties.findIndex( property => property.name === 'awb0ExplodedLineCSIDs' );
                logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: awb0ExplodedLineCSIDs property index:', propertyIndex );

                if ( propertyIndex > -1 ) {
                    isAddPolicy = false;
                    logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Property already exists, skipping policy addition' );
                }
            }
        }

        if ( isAddPolicy ) {
            logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Adding policy for Awb0PartElement with CBA vis props' );
            aceTreeTableDataService.updateOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0PartElement', _cbaVisProps );
            logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Policy updated successfully' );
        } else {
            logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.callbackFunction: Policy addition skipped' );
        }
    },
    condition: ( occContext ) => {
        const isEnabled = exports.isVisualizationEnabled( occContext.viewKey, occContext );
        logger.debug( 'cbaPropertyLoaderService._cbaVisPropertyHandler.condition: Visualization enabled:', isEnabled );
        return isEnabled;
    }
};


/**
 * Registers the CBA visualization property handler with the ace tree table data service.
 * This function loads the aceTreeTableDataService module as a dependency and registers
 * an overridden property policy handler for CBA visualization properties.
 * 
 * @function registerCbaVisPropertyHandler
 * @returns {void}
 */
export const registerCbaVisPropertyHandler = () => {
    logger.debug( 'cbaPropertyLoaderService.registerCbaVisPropertyHandler: Registering CBA visualization property handler' );
    aceTreeTableDataService.registerOverriddenPropertyPolicyHandler( _cbaVisPropertyHandler );
    logger.debug( 'cbaPropertyLoaderService.registerCbaVisPropertyHandler: Handler registration completed successfully' );
};

/**
 * Checks if the application is running in hosted mode with Vis (Visualization) host type.
 * 
 * @returns {boolean} True if hosting is enabled and host type is 'Vis', false otherwise
 */
export const isHostedModeVisEnabled = function() {
    const hostingEnabled = appCtxSvc.getCtx( 'aw_hosting_state' ) && appCtxSvc.getCtx( 'aw_host_type' ) === 'Vis';
    logger.debug( 'cbaPropertyLoaderService.isHostedModeVisEnabled: Hosting enabled:', hostingEnabled );
    return hostingEnabled;
};

/**
 * Checks if visualization is enabled through hosting or 3D tab activation.
 * Returns true if either Vis hosting is enabled or the 3D structure viewer tab is active.
 *
 * @param {string} viewToReact - The view key to check for 3D tab activation
 * @param {Object} occContext - The occurrence context object (optional)
 * @returns {boolean} True if hosting is enabled or 3D tab is active, false otherwise
 */
export const isVisualizationEnabled = function( viewToReact, occContext ) {
    const hostingEnabled = exports.isHostedModeVisEnabled();
    logger.debug( 'cbaPropertyLoaderService.isVisualizationEnabled: Checking visualization enabled state for viewToReact:', viewToReact, 'hostingEnabled:', hostingEnabled );

    // Early return if hosting is enabled
    if( hostingEnabled ) {
        logger.debug( 'cbaPropertyLoaderService.isVisualizationEnabled: Hosting enabled, returning true' );
        return true;
    }

    // Check 3D tab state
    const viewContextObject = occContext || appCtxSvc.getCtx( viewToReact );
    const currentState = viewContextObject?.currentState;
    const is3DTabActive = currentState?.altPwa === 'Awv0StructureViewerPageContainer' ||
                          currentState?.altPwa2 === 'Awv0StructureViewerPageContainer';

    logger.debug( 'cbaPropertyLoaderService.isVisualizationEnabled: 3D tab active:', is3DTabActive );
    return is3DTabActive;
};

/**
 * load given properties for all quatity managed objects in given view
 *
 * @param { string } viewToReact viewKey for which properties to load
 * @param { Array } propertiesToLoad List of properties to load
 */
let _loadPropertiesForView = function( viewToReact, propertiesToLoad ) {
    logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Called with viewToReact:', viewToReact, 'propertiesToLoad:', propertiesToLoad );
    if( viewToReact && !_.isEmpty( propertiesToLoad ) ) {
        if ( !exports.isVisualizationEnabled( viewToReact ) ) {
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Visualization not enabled, skipping property loading' );
            return;
        }
        logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Visualization enabled, proceeding with property loading' );

        // Get all loaded tree nodes in respective view and find summary lines and their children where we need their corresponding exploded lines CSIDs.
        const nodesToFetchExplodedLineCSIDs = [];
        const viewContextObject = appCtxSvc.getCtx( viewToReact );
        const vmc = viewContextObject?.vmc;
        if( !vmc ) {
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: VMC not available, returning early' );
            return;
        }

        let loadedVMOs;
        try {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        } catch ( err ) {
            logger.warn( 'cbaPropertyLoaderService._loadPropertiesForView: Failed to get loaded VMOs', err );
            return;
        }

        logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Processing', loadedVMOs.length, 'loaded view model objects' );

        for ( let index = 0; index < loadedVMOs.length; index++ ) {
            const element = loadedVMOs[index];
            const isLoadExploded = cbaQuantityManagedService.isQuantityManagedLine( element );
            if( isLoadExploded ) {
                nodesToFetchExplodedLineCSIDs.push( { type : element.type, uid : element.uid } );
            }
        }

        logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Found', nodesToFetchExplodedLineCSIDs.length, 'quantity managed nodes to fetch CSIDs' );

        if( nodesToFetchExplodedLineCSIDs.length > 0 ) {
            // PropertyLoad awb0ExplodedLineCSIDs on all summary lines and their children.
            const input = {
                objects: nodesToFetchExplodedLineCSIDs,
                attributes: propertiesToLoad
            };
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Calling getProperties SOA for', nodesToFetchExplodedLineCSIDs.length, 'objects' );
            try {
                soaService.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then( () => {
                    logger.debug( 'Success' );
                } ).catch( err => {
                    logger.error( 'Failed', err );
                } );
                logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: getProperties SOA call successful' );
            } catch ( err ) {
                logger.error( `Failure while loading property awb0ExplodedLineCSIDs ${ err }` );
            }
        } else {
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: No quantity managed nodes found, skipping getProperties call' );
        }

        // Register 'awb0ExplodedLineCSIDs' property in policy only when 3D tab is ON to keep getting exploded lines CSIDs on summary line in Tree.
        if( !_viewToVizPropPolicyId.has( viewToReact ) ) {
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Property policy not registered for view, registering now' );
            let policyIOverrideGetOcc = {
                types: [ {
                    name: 'Awb0PartElement',
                    properties: [ {
                        name: 'awb0ExplodedLineCSIDs'
                    } ]
                } ]
            };
            let policyId = propPolicySvc.register( policyIOverrideGetOcc );
            _viewToVizPropPolicyId.set( viewToReact, policyId );
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Property policy registered with id:', policyId );
        } else {
            logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Property policy already registered for view' );
        }

        logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Function completed successfully' );
    } else {
        logger.debug( 'cbaPropertyLoaderService._loadPropertiesForView: Validation failed. viewToReact:', viewToReact, 'propertiesToLoad empty:', _.isEmpty( propertiesToLoad ) );
    }
};

// Unregister EBOM Viz Client specific property policy post 3D tab closure.
/**
 *
 * @param {string} viewToReact view key for which to un-register policy
 */
let _unRegisterPropPolicy = function( viewToReact ) {
    logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: Called with viewToReact:', viewToReact );

    if( !viewToReact ) {
        logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: No view specified, unregistering all policies. Total policies:', _viewToVizPropPolicyId.size );
        // iterate through all registered policies and unregister them
        for( let [ key, policyId ] of _viewToVizPropPolicyId ) {
            logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: Unregistering policy for view:', key, 'policyId:', policyId );
            propPolicySvc.unregister( policyId );
            _viewToVizPropPolicyId.delete( key );
        }
    } else if( _viewToVizPropPolicyId.get( viewToReact ) ) {
        let policyId = _viewToVizPropPolicyId.get( viewToReact );
        logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: Unregistering policy for view:', viewToReact, 'policyId:', policyId );
        propPolicySvc.unregister( policyId );
        _viewToVizPropPolicyId.delete( viewToReact );
        logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: Policy unregistered successfully. Remaining policies:', _viewToVizPropPolicyId.size );
    } else {
        logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: No policy found for view:', viewToReact );
    }

    logger.debug( 'cbaPropertyLoaderService._unRegisterPropPolicy: Function completed' );
};

/**
 * Register getOccInput handler
 */
export const registerCbaGetOccInputProvider = function() {
    logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Called' );

    if( !cbaGetOccInputProvider ) {
        logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Creating new provider' );

        const conditionFunction = function( _loadInput, occContext, soaInput ) {
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: Evaluating condition' );

            if( !exports.isVisualizationEnabled( occContext.viewKey, occContext ) ) {
                logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: Visualization not enabled, returning false' );
                return false;
            }
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: Visualization is enabled, continuing validation' );

            if( !occContext || !occContext.pwaSelection || occContext.pwaSelection.length === 0 ) {
                logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: occContext or pwaSelection is invalid, returning false' );
                return false;
            }

            // NOTE : After configuration chnage , only last selection is retained in ace tree
            // so we are checking only last selection
            const selection = occContext.pwaSelection[occContext.pwaSelection.length - 1];
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: Checking last selection,  ID:', selection.props?.awb0ArchetypeId?.uiValues[ 0 ], 'uid:', selection?.uid );

            const isQuantityManaged = cbaQuantityManagedService.isQuantityManagedLine( selection );
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.conditionFunction: Is quantity managed:', isQuantityManaged );

            return isQuantityManaged;
        };

        const inputParamFunc = function( _loadInput, _occContext, _currentContext, soaInput ) {
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.inputParamFunc: Setting request preference' );
            soaInput.inputData.requestPref.cbaAvoidSummaryLineSelectionProcessing = [ 'true' ];
            logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider.inputParamFunc: Request preference set successfully' );
        };

        cbaGetOccInputProvider = {
            key : 'cbaVisGetOccInputProvider', //unique identifier
            condition: conditionFunction,
            populateGetOccInput: inputParamFunc
        };
        logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Provider object created with key: cbaVisGetOccInputProvider' );
    } else {
        logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Provider already exists, skipping creation' );
    }

    logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Registering provider with aceGetService' );
    aceGetService.registerGetOccInputProvider( cbaGetOccInputProvider );
    logger.debug( 'cbaPropertyLoaderService.registerCbaGetOccInputProvider: Provider registered successfully' );
};


const exports = {
    initializeService,
    loadProperties,
    registerCbaVisPropertyHandler,
    registerCbaGetOccInputProvider,
    isVisualizationEnabled,
    isHostedModeVisEnabled
};

export default exports;
