/* eslint-disable no-bitwise */
// Copyright (c) 2022 Siemens

/**
 * @module js/occurrenceManagementStateHandler
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var _onProductContextChangeEventListener = null;
var supportedFeatures = {};
var readOnlyFeatures = {};
var isOpenedUnderAContext = false;
var swcContainerNames = [];

var exports = {};

/**
 * Start of Declare Constants here
 */
// BOMWindow View toggle flags bitmask value
const VISIBILITY_FLAG_showFilteredOutVariants = 1 << 0;        // Bit 0 (int value = 1)
const VISIBILITY_FLAG_showSuppressedOccs = 1 << 2;             // Bit 2 (int value = 4)
const VISIBILITY_FLAG_showUnconfigdOccs = 1 << 3;              // Bit 3 (int value = 8)
const VISIBILITY_FLAG_showFilteredOutLines = 1 << 5;           // Bit 5 (int value = 32)
const VISIBILITY_FLAG_hideLessFinishParts = 1 << 7;            // Bit 7 (int value = 128)
const VISIBILITY_FLAG_showSecondaryComponents = 1 << 8;        // Bit 8 (int value = 256)
const VISIBILITY_FLAG_showSubstituteComponents = 1 << 9;       // Bit 9 (int value = 512)
const VISIBILITY_FLAG_restrictChildrenWithinChange = 1 << 11;  // Bit 11 (int value = 2048)

// BOMWindow state flags bitmask value
const STATE_FLAG_PACK_MODE = 1 << 0;        // Bit 0 (int value = 1)
const STATE_FLAG_MARKUP_MODE = 1 << 1;      // Bit 1 (int value = 2)
const STATE_FLAG_CHANGE_MODE = 1 << 3;      // Bit 3 (int value = 8)
const STATE_FLAG_QTY_SUMMARY_MODE = 1 << 4; // Bit 4 (int value = 16)
/*************************** End of file constants *************************/

/**
 * This utility function will return the current state of "Show Excluded by Variant" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowExcludedByVariantState = function( viewToggles ) {
    let showExcludedByVariant = false;
    if( viewToggles & VISIBILITY_FLAG_showFilteredOutVariants ) {
        showExcludedByVariant = true;
    }
    return showExcludedByVariant;
};

/**
 * This utility function will return the current state of "Show Filtered Out" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowFilteredOutLinesState = function( viewToggles ) {
    let showFilteredOutLines = false;
    if( viewToggles & VISIBILITY_FLAG_showFilteredOutLines ) {
        showFilteredOutLines = true;
    }
    return showFilteredOutLines;
};

/**
 * This utility function will return the current state of "Show Suppressed" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowSuppressedState = function( viewToggles ) {
    let showSuppressed = false;
    if( viewToggles & VISIBILITY_FLAG_showSuppressedOccs ) {
        showSuppressed = true;
    }
    return showSuppressed;
};

/**
 * This utility function will return the current state of "Show Excluded by Effectivity" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowExcludedByEffectivityState = function( viewToggles ) {
    let showExcludedByEffectivity = false;
    if( viewToggles & VISIBILITY_FLAG_showUnconfigdOccs ) {
        showExcludedByEffectivity = true;
    }
    return showExcludedByEffectivity;
};

/**
 * This utility function will return the current state of "Show Less Finished Part" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowLessFinishedPartState = function( viewToggles ) {
    // NOTE: This is a negative flag from Server's perspective. Therefore, the default state is always true.
    // A positive bit mask value for this flag means hide/negate state.
    let showLessFinishedPart = true;
    if( viewToggles & VISIBILITY_FLAG_hideLessFinishParts ) {
        showLessFinishedPart = false;
    }
    return showLessFinishedPart;
};

/**
 * This utility function will return the current state of "Show Secondary Components" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowSecondaryCompState = function( viewToggles ) {
    let showSecondaryComp = false;
    if( viewToggles & VISIBILITY_FLAG_showSecondaryComponents ) {
        showSecondaryComp = true;
    }
    return showSecondaryComp;
};

/**
 * This utility function will return the current state of "Show Substitute Component" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowSubstituteCompState = function( viewToggles ) {
    let showSubstituteComp = false;
    if( viewToggles & VISIBILITY_FLAG_showSubstituteComponents ) {
        showSubstituteComp = true;
    }
    return showSubstituteComp;
};

/**
 * This utility function will return the current state of "Restrict Children Within Change" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getRestrictChildrenWithinChangeState = function( viewToggles ) {
    let restrictChildrenWithinChange = false;
    if( viewToggles & VISIBILITY_FLAG_restrictChildrenWithinChange ) {
        restrictChildrenWithinChange = true;
    }
    return restrictChildrenWithinChange;
};

/**
 * This utility function will return the current state of "Show markup" Window state.
 * @param {integer} windowToggles : Bit masked value of window toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowMarkupState = function( windowToggles ) {
    let showMarkup = false;
    if( windowToggles & STATE_FLAG_MARKUP_MODE ) {
        showMarkup = true;
    }
    return showMarkup;
};

/**
 * This utility function will return the current state of "Show Change" Window state.
 * @param {integer} windowToggles : Bit masked value of window toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowChangeState = function( windowToggles ) {
    let showChange = false;
    if( windowToggles & STATE_FLAG_CHANGE_MODE ) {
        showChange = true;
    }
    return showChange;
};

/**
 * This utility function will return the current state of Packed/Unpacked Window state.
 * @param {integer} windowToggles : Bit masked value of window toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getPackedState = function( windowToggles ) {
    let packedState = false;
    if( windowToggles & STATE_FLAG_PACK_MODE ) {
        packedState = true;
    }
    return packedState;
};

/**
 * This utility function will return the current state of "Show Exploded Lines" Window state.
 * @param {integer} windowToggles : Bit masked value of window toggle states.
 * @returns {boolean} : True/False for enable/disable
 */
export let getShowExplodedLines = function( windowToggles ) {
    let showExplodedLines = false;
    if( windowToggles & STATE_FLAG_QTY_SUMMARY_MODE ) {
        showExplodedLines = true;
    }
    return showExplodedLines;
};

/**
 * Update 'contextObject' in the appCtxService (if necessary).
 *
 * @param {IModelObject} contextKeyObject - ContextKeyObject
 */
var registerOrUpdateInformationOnContext = function( contextKeyObject, contextKey, activeContext ) {
    let pciObj = contextKeyObject.productContextInfo;
    if( pciObj && activeContext ) {
        var changed = false;

        if( !activeContext.productContextInfo || activeContext.productContextInfo.uid !== pciObj.uid ) {
            activeContext.productContextInfo = pciObj;
            changed = true;
        }

        if( !_.isEqual( activeContext.supportedFeatures, supportedFeatures ) ) {
            activeContext.supportedFeatures = supportedFeatures;
            changed = true;
        }

        if( !_.isEqual( activeContext.readOnlyFeatures, readOnlyFeatures ) ) {
            activeContext.readOnlyFeatures = readOnlyFeatures;
            changed = true;
        }

        if( activeContext.isOpenedUnderAContext !== isOpenedUnderAContext ) {
            activeContext.isOpenedUnderAContext = isOpenedUnderAContext;
            changed = true;
        }

        if( activeContext.workingContextObj !== occmgmtUtils.getSavedWorkingContext( pciObj ) ) {
            activeContext.workingContextObj = occmgmtUtils.getSavedWorkingContext( pciObj );
            changed = true;
        }

        if( changed ) {
            appCtxSvc.updatePartialCtx( contextKey, activeContext );
        }
    }
};

/**
 */
export let getSupportedFeaturesFromPCI = function( productContextInfo ) {
    var supportedFeaturesFromPCI = {};
    var supportedFeaturesObjects = null;
    if( productContextInfo && productContextInfo.props ) {
        supportedFeaturesObjects = productContextInfo.props.awb0SupportedFeatures;
    }

    if( supportedFeaturesObjects && supportedFeaturesObjects.dbValues ) {
        for( var objIndex = 0; objIndex < supportedFeaturesObjects.dbValues.length; objIndex++ ) {
            var featureObject = cdm.getObject( supportedFeaturesObjects.dbValues[ objIndex ] );

            if( featureObject.type === 'Awb0FeatureList' ) {
                var availableFeatures = featureObject.props.awb0AvailableFeatures;
                if( availableFeatures && availableFeatures.dbValues ) {
                    for( var feature = 0; feature < availableFeatures.dbValues.length; feature++ ) {
                        supportedFeaturesFromPCI[ availableFeatures.dbValues[ feature ] ] = true;
                    }
                }
            } else {
                if( featureObject.type ) {
                    supportedFeaturesFromPCI[ featureObject.modelType.name ] = true;
                }
            }
        }
    }
    return supportedFeaturesFromPCI;
};

/**
 */
var populateSupportedFeaturesFromPCI = function( contextKeyObject ) {
    supportedFeatures = exports.getSupportedFeaturesFromPCI( contextKeyObject.productContextInfo );
};

/**
 */
var populateSWCContainerNames = function( productContextInfo ) {
    swcContainerNames = [];

    if( productContextInfo && productContextInfo.props ) {
        var supportedFeaturesObjects = productContextInfo.props.awb0SupportedFeatures;
        if( supportedFeaturesObjects ) {
            for( var supportedFeatureObject = 0; supportedFeatureObject < supportedFeaturesObjects.dbValues.length; supportedFeatureObject++ ) {
                var featureObject = cdm.getObject( supportedFeaturesObjects.dbValues[ supportedFeatureObject ] );
                if( featureObject.type === 'Awb0SaveWorkingContextFeature' ) {
                    var containerNames = featureObject.props.awb0ContainerNames;
                    for( var cnIndex = 0; cnIndex < containerNames.dbValues.length; cnIndex++ ) {
                        swcContainerNames.push( containerNames.dbValues[ cnIndex ] );
                    }
                }
            }
        }
    }
};

/**
 */
export let getReadOnlyFeaturesFromPCI = function( productContextInfo ) {
    var readOnlyFeaturesList = {};

    if( productContextInfo && productContextInfo.props ) {
        var supportedFeaturesObjects = productContextInfo.props.awb0SupportedFeatures;

        if( supportedFeaturesObjects ) {
            for( var supportedFeatureObject = 0; supportedFeatureObject < supportedFeaturesObjects.dbValues.length; supportedFeatureObject++ ) {
                var featureObject = cdm.getObject( supportedFeaturesObjects.dbValues[ supportedFeatureObject ] );

                if( featureObject.type === 'Awb0FeatureList' ) {
                    var nonModifiableFeatures = featureObject.props.awb0NonModifiableFeatures;

                    if( nonModifiableFeatures ) {
                        for( var feature = 0; feature < nonModifiableFeatures.dbValues.length; feature++ ) {
                            readOnlyFeaturesList[ nonModifiableFeatures.dbValues[ feature ] ] = true;
                        }
                    }
                }
            }
        }
    }

    return readOnlyFeaturesList;
};

/**
 */
var populateReadOnlyFeaturesFromPCI = function( productContextInfo ) {
    readOnlyFeatures = exports.getReadOnlyFeaturesFromPCI( productContextInfo );
};

/**
 */
var populateContextInformationFromPCI = function( productContextInfo ) {
    isOpenedUnderAContext = false;

    if( productContextInfo && productContextInfo.props && productContextInfo.props.awb0ContextObject ) {
        isOpenedUnderAContext = !productContextInfo.props.awb0ContextObject.isNulls;
    }
};

var populateSupportedFeaturesInWorkingContext = function( contextKeyObject, contextKey ) {
    var supportedFeaturesInWC = null;
    if( contextKeyObject.isOpenedUnderAContext &&
        contextKeyObject.elementToPCIMap ) {
        supportedFeaturesInWC = {};
        for( var key in contextKeyObject.elementToPCIMap ) {
            if( contextKeyObject.elementToPCIMap.hasOwnProperty( key ) ) {
                var pciModelObject = cdm
                    .getObject( contextKeyObject.elementToPCIMap[ key ] );
                var supportedFeaturesFromPCI = exports.getSupportedFeaturesFromPCI( pciModelObject );
                _.assign( supportedFeaturesInWC, supportedFeaturesFromPCI );
            }
        }
    }

    if( supportedFeaturesInWC &&
        !_.isEqual( contextKeyObject.supportedFeaturesInWC, supportedFeaturesInWC ) ) {
        appCtxSvc.updatePartialCtx( contextKey + '.supportedFeaturesInWC', supportedFeaturesInWC );
    }
};

var populateContextKey = function( data ) {
    if( data && data.contextKey ) {
        return data.contextKey;
    }
    return appCtxSvc.ctx.aceActiveContext.key;
};

/**
 */
var startListeningToProductContextChangeEvent = function() {
    _onProductContextChangeEventListener = eventBus.subscribe( 'occDataLoadedEvent', function( eventData ) {
        var contextKey = populateContextKey( eventData );
        var contextKeyObject = appCtxSvc.getCtx( contextKey );

        if ( !contextKeyObject || contextKeyObject === undefined ) {
            return;
        }

        var transientRequestPref = {};
        populateSupportedFeaturesFromPCI( contextKeyObject );
        populateSWCContainerNames( contextKeyObject.productContextInfo );
        populateReadOnlyFeaturesFromPCI( contextKeyObject.productContextInfo );
        populateContextInformationFromPCI( contextKeyObject.productContextInfo );
        registerOrUpdateInformationOnContext( contextKeyObject, contextKey, contextKeyObject );
        populateSupportedFeaturesInWorkingContext( contextKeyObject, contextKey );

        if( contextKeyObject.requestPref ) {
            if ( contextKeyObject.requestPref.reloadDependentTabs ) {
                transientRequestPref.reloadDependentTabs = contextKeyObject.requestPref.reloadDependentTabs;
            }

            if( contextKeyObject.requestPref.recipeReset ) {
                transientRequestPref.recipeReset = contextKeyObject.requestPref.recipeReset;
            }

            if( contextKeyObject.requestPref.windowNotReused ) {
                transientRequestPref.windowNotReused = contextKeyObject.requestPref.windowNotReused;
            }

            if( contextKeyObject.requestPref.restoreProduct ) {
                transientRequestPref.restoreProduct = contextKeyObject.requestPref.restoreProduct;
            }
        }

        var occLoadedEventData = eventData;
        setTimeout( function() {
            var eventData = {};
            if( occLoadedEventData && occLoadedEventData.dataProviderActionType ) {
                eventData = {
                    updatedView: contextKey,
                    dataProviderActionType: occLoadedEventData.dataProviderActionType,
                    transientRequestPref: transientRequestPref
                };
            } else {
                eventData = {
                    updatedView: contextKey,
                    dataProviderActionType: null,
                    transientRequestPref: transientRequestPref
                };
            }

            eventBus.publish( 'productContextChangedEvent', eventData );
        }, 0 );
    }, 'OccurrenceManagementStateHandler' );
};

/**
 */
var stopListeningToEventListners = function() {
    eventBus.unsubscribe( _onProductContextChangeEventListener );
};

/**
 * Initialize OccMgmtStateHandler
 */
export let initializeOccMgmtStateHandler = function() {
    startListeningToProductContextChangeEvent();
};

/**
 * Get Supported Features
 */
export let getSupportedFeatures = function() {
    return supportedFeatures;
};

/**
 * Get Read-Only Features
 */
export let getReadOnlyFeatures = function() {
    return readOnlyFeatures;
};

/**
 * Get Saved Working Context Container Names
 */
export let getSWCContainerNames = function() {
    return swcContainerNames;
};

/**
 * Get the Product Context Info instance
 */
export let getProductContextInfo = function() {
    var context = appCtxSvc.getCtx( 'aceActiveContext.context' );
    if( context ) {
        return context.productContextInfo;
    }
};

/**
 * Return true if feature is supported, otherwise false
 */
export let isFeatureSupported = function( featureToCheck ) {
    if( supportedFeatures[ featureToCheck ] ) {
        return true;
    }
    return false;
};


/**
 * Destroy OccMgmtStateHandler
 */
export let destroyOccMgmtStateHandler = function() {
    stopListeningToEventListners();
    supportedFeatures = {};
    readOnlyFeatures = [];
};

/**
 * Occurrence Management State Handler
 */

export default exports = {
    getShowExcludedByVariantState,
    getShowFilteredOutLinesState,
    getShowSuppressedState,
    getShowExcludedByEffectivityState,
    getShowLessFinishedPartState,
    getShowMarkupState,
    getShowChangeState,
    getPackedState,
    getShowExplodedLines,
    getShowSecondaryCompState,
    getShowSubstituteCompState,
    getSupportedFeaturesFromPCI,
    getReadOnlyFeaturesFromPCI,
    initializeOccMgmtStateHandler,
    getSupportedFeatures,
    getReadOnlyFeatures,
    getSWCContainerNames,
    getProductContextInfo,
    isFeatureSupported,
    destroyOccMgmtStateHandler,
    getRestrictChildrenWithinChangeState
};
