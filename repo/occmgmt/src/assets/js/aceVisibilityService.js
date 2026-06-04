// Copyright (c) 2022 Siemens

/**
 * Defines {@link NgServices.subLocationService} which provides access to the SubLocationService from native code
 *
 * @module js/aceVisibilityService
 */
import appCtxService from 'js/appCtxService';
import GenericOccVisibilityProvider from 'js/viewer/genericOccVisibilityProvider';
import _ from 'lodash';

let exports = {};

/**
 *  This is sample how to create custom occVisibility Provider
 
   class CustomOccVisibilityProvider extends GenericOccVisibilityProvider {
    key = 'customOccVisibilityProvider';
    condition( modelObject, contextKey ) {
    }
    toggleOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz, toggleOccVisibilityFunctionRegisteredByViz ){
    }
    getOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz ) {
    }

    Register it at the starting point of your app 
    let customOccVisibilityProvider = new CustomOccVisibilityProvider();
    aceVisibilityService.registerOccVisibilityProvider(customOccVisibilityProvider);
*/

let _occVisibilityProviders = {};

/**
 * Function to check whether registered provider is valid occurrence visibility provider or not.
 * 
 * @param {object} provider provider to check
 * @returns {boolean} true if the given provider is a valid provider else return false
 */
let _isValidOccVisibilityProvider = function( provider ) {
    return GenericOccVisibilityProvider.prototype.isPrototypeOf( provider ) &&
    typeof provider.condition === 'function' && typeof provider.toggleOccVisibility === 'function' && typeof provider.getOccVisibility === 'function';
};

/**
 * Call visibility providers and return result
 * 
 * @param {string} viewKey context key 
 * @param {string} providerFunctionName provider Function Name i.e. either 'toggleOccVisibility' or 'getOccVisibility'
 * @param {object} modelObject modelObject
 * @param {object} cellVisibility cellVisibility object from context where viz registered function
 * @returns {object} object
 */
let _callVisibilityProviders = function( viewKey, providerFunctionName, modelObject, cellVisibility ) {
    let isHandledByVisibilityProvider = undefined;
    let toggleOccVisibilityFunction = cellVisibility.toggleOccVisibility;
    let getOccVisibilityFunction = cellVisibility.getOccVisibility;

    for ( const key in _occVisibilityProviders ) {
        const provider = _occVisibilityProviders[key];
        if( provider.condition( modelObject, viewKey ) ) {
            let result = provider[ providerFunctionName ].call( provider, modelObject, getOccVisibilityFunction, toggleOccVisibilityFunction );
            if( result === true ||  result === false ) {
                isHandledByVisibilityProvider = result;
                break;
            }
        }
    }

    if(  isHandledByVisibilityProvider ||  providerFunctionName === 'getOccVisibility' && isHandledByVisibilityProvider === false ) {
        return isHandledByVisibilityProvider;
    }
};


export let toggleOccVisibility = function( modelObject, contextKey ) {
    let viewKey = contextKey ? contextKey : appCtxService.ctx.aceActiveContext.key;
    if( appCtxService.ctx[ viewKey ].cellVisibility &&
        appCtxService.ctx[ viewKey ].cellVisibility.toggleOccVisibility ) {
        let result = _callVisibilityProviders( viewKey, 'toggleOccVisibility', modelObject, appCtxService.ctx[ viewKey ].cellVisibility );
        // If not handled by any provider then call default function.
        if( !result ) {
            appCtxService.ctx[ viewKey ].cellVisibility.toggleOccVisibility( modelObject );
        }
    }
};

export let getOccVisibility = function( modelObject, contextKey ) {
    let viewKey = contextKey ? contextKey : appCtxService.ctx.aceActiveContext.key;

    if( !modelObject || _.isEmpty( modelObject.props ) || modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 && !( modelObject.props.awb0Parent && modelObject.props.awb0CopyStableId ) ) {
        return true;
    }
    if( appCtxService.ctx[ viewKey ].cellVisibility &&
        appCtxService.ctx[ viewKey ].cellVisibility.getOccVisibility ) {
        if( !appCtxService.ctx[ viewKey ].visibilityControls ) {
            appCtxService.updatePartialCtx( viewKey + '.visibilityControls', true );
        }

        let result =  _callVisibilityProviders( viewKey, 'getOccVisibility', modelObject, appCtxService.ctx[ viewKey ].cellVisibility );
        // If not handled by any provider then call default function.
        // For get visibility, true and false are valid values returned by application provider
        if( result === null || result === undefined ) {
            return appCtxService.ctx[ viewKey ].cellVisibility.getOccVisibility( modelObject );
        }
        return result;
    }

    if( appCtxService.ctx[ viewKey ].visibilityControls ) {
        appCtxService.updatePartialCtx( viewKey + '.visibilityControls', false );
    }
    return true; // default value if there is no visibility handler
};

/**
 * Register occurrence visibility provider with unique key
 * 
 * @param {object} visibilityProvider occurrence visibility provider to register
 * @returns {object} registered visibilityProvider 
 */
export let registerOccVisibilityProvider = function( visibilityProvider ) {
    if( _isValidOccVisibilityProvider( visibilityProvider ) ) {
        _occVisibilityProviders[ visibilityProvider.key ] = visibilityProvider;
        return _occVisibilityProviders[ visibilityProvider.key ];
    }
    return null;
};

/**
 *  Unregistered occurrence visibility provider
 * 
 * @param {object} visibilityProvider occurrence visibility provider to unregister
 * @returns {object} unregistered visibilityProvider 
 */
export let unregisterOccVisibilityProvider = function( visibilityProvider ) {
    if( visibilityProvider ) {
        return delete _occVisibilityProviders[ visibilityProvider.key ];
    }
    return false;
};

export default exports = {
    toggleOccVisibility,
    getOccVisibility,
    registerOccVisibilityProvider,
    unregisterOccVisibilityProvider
};
