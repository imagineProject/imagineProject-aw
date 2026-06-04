// Copyright (c) 2023 Siemens

/**
 * This service is to convert viewer CSID objects to Elements
 *
 * @module js/viewerSelectedBomlineInfoProvider
 */

import AwPromiseService from 'js/awPromiseService';
import declUtils from 'js/declUtils';


var bomlinesFromSelectedObjectsProviderFn = undefined;


/**
 * Set function on current service that would return the intended product context for VIS.
 *
 * @param { Function } registerFuntion JS function that returns an object containing "productContextInfo"
 */
export let registerBomlineInfoToSavePosition = function( registerFuntion ) {
    if( registerFuntion && typeof registerFuntion === 'function' ) {
        bomlinesFromSelectedObjectsProviderFn = registerFuntion;
    }
};

/**
 * Reset current service function attribute to 'null'
 */
export let resetSelectedBomlineInfo = function() {
    if( bomlinesFromSelectedObjectsProviderFn ) {
        bomlinesFromSelectedObjectsProviderFn = undefined;
    }
};

/**
 * Gets product launch info
 *  @return {Promise} Resolves to ProductLaunchInfo.
 */
export let getBomlineObjectFromProviderFn = function( viewerContextData, selectedModelObjects, selectedCsids ) {
    var deferred = AwPromiseService.instance.defer();

    if( bomlinesFromSelectedObjectsProviderFn !== undefined ) {
        bomlinesFromSelectedObjectsProviderFn( viewerContextData, selectedModelObjects, selectedCsids ).then( function( bomLines ) {
            deferred.resolve( bomLines );
        } );
    } else {
        declUtils.loadDependentModule( 'js/aceBackingObjectProviderService' )
            .then( ( occMBOPSMod ) => {
                if( occMBOPSMod ) {
                    return occMBOPSMod.getBackingObjects( selectedModelObjects );
                }
            } ).then( function( bomlines ) {
                deferred.resolve( bomlines );
            } );
    }
    return deferred.promise;
};


export default {
    registerBomlineInfoToSavePosition,
    resetSelectedBomlineInfo,
    getBomlineObjectFromProviderFn
};

