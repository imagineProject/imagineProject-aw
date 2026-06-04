// Copyright (c) 2022 Siemens

/**
 * Service to define functions related to open panel in CBA
 * @module js/cbaOpenInViewPanelService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cbaRelatedObjectService from 'js/cbaRelatedObjectService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import localeService from 'js/localeService';
import cbaConstants from 'js/cbaConstants';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import messagingService from 'js/messagingService';
import adapterSvc from 'js/adapterService';

let exports = {};

/**
 * Returns provider name as per type of modelObject.
 * @param {Object} modelObject - selected object from CBA Page
 * @return {String} - Provider name
 */
export let getProviderAndSectionName = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();

    //If CBA is launched from ECN, directly fetch the provider details from ECN context.
    //This provider internally differentiates between design and part types and returns the appropriate related object.
    //We can therefore avoid the input type check.
    if( CBAImpactAnalysisService.isImpactAnalysisMode() ) {
        return CBAImpactAnalysisService.getProviderName();
    }

    let promise = _getProviderAndSectionNameForCba( modelObject );
    promise.then( function( result ) {
        deferred.resolve( result );
    });

    return deferred.promise;
};

/**
 * Returns provider and section name as per type of modelObject.
 * @param {Object} modelObject - selected object from CBA Page
 * @return {String} - Provider and Section name
 */
let _getProviderAndSectionNameForCba = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();

    let providerName;
    let sectionName;

    let selectedObjects = [ modelObject ];
    let promise = cbaObjectTypeService.getDesignsAndParts( selectedObjects );
    promise.then( function( resultData ) {
        if( resultData.designTypes.includes( modelObject ) ) {
            providerName = cbaConstants.ALIGNED_PARTS_PROVIDER;
            sectionName = cbaConstants.LINKED_ENGINEERING_BOM;
        } else if( resultData.partTypes.includes( modelObject ) ) {
            providerName = cbaConstants.ALIGNED_DESIGNS_PROVIDER;
            sectionName = cbaConstants.LINKED_DESIGN_BOM;
        } else if( resultData.productTypes.includes( modelObject ) ) {
            providerName = cbaConstants.LINKED_ITEM_PROVIDER;
            sectionName = cbaConstants.LINKED_DESIGN_BOM;
        }
        let output = {
            providerName: providerName,
            sectionName: sectionName
        };

        deferred.resolve( output );
    } );
    return deferred.promise;
};

/**
 * Check if data is available to load in panel :
 * Case 1. If aligned objects are not found then check the linked items for given modelObject
 * Case 2. If there are no linked items for given modelObject then return false
 *
 * @param {*} provider - Provider
 * @param {*} providerName - ProviderName
 * @returns {boolean} - true if data is available to load in panel
 */
let _getObjectForLinkedBom = function( provider, providerName ) {
    let deferred = AwPromiseService.instance.defer();
    let isDataAvailableToLoad = false;
    let newProviderName = providerName;
    cbaRelatedObjectService.getRelatedModelObjects( provider.openedObject, providerName, false ).then( function( modelObjectsArray ) {
        if( provider.cbaContext ) {
            let newCbaContext = { ...provider.cbaContext.value };
            newCbaContext.linkedBOM.relatedModelObjects = modelObjectsArray;
            provider.cbaContext.update( newCbaContext );
        }
        let modelObjectsCount = modelObjectsArray.length;
        if( modelObjectsCount > 0 ) {
            isDataAvailableToLoad = true;
            deferred.resolve( isDataAvailableToLoad );
        } else {
            if( newProviderName === cbaConstants.LINKED_ITEM_PROVIDER ) {
                deferred.resolve( isDataAvailableToLoad );
            } else {
                newProviderName = cbaConstants.LINKED_ITEM_PROVIDER;
                _getObjectForLinkedBom( provider, newProviderName ).then( function( isDataAvailableToLoad ) {
                    deferred.resolve( isDataAvailableToLoad );
                } );
            }
        }
    } );
    return deferred.promise;
};

/**
 * Update information which required for linked BOM tab in context
 * @param {Object} provider - provider
 * @returns {object} - Returns promise
 */
export let initializeServiceForLinkedBom = function( provider ) {
    let getRelatedModelObjectCall;
    let deferred = AwPromiseService.instance.defer();

    //  isDesignOrPartRequired( modelObject ).then( function( result ) {
    //  if ( result ||  !result && cbaObjectTypeService.isObjectOfGivenType( modelObject, cbaConstants.PRODUCT_EBOM )  ) {
    if( cbaObjectTypeService.isObjectOfGivenType( provider.openedObject, cbaConstants.PRODUCT_EBOM ) ) {
        getRelatedModelObjectCall = true;
    }

    if( getRelatedModelObjectCall ) {
        let promise = getProviderAndSectionName( provider.openedObject );
        promise.then( function( resultData ) {
            _getObjectForLinkedBom( provider, resultData.providerName ).then( function( isDataAvailableToLoad ) {
                if( isDataAvailableToLoad ) {
                    let newCbaContext = { ...provider.cbaContext.value };
                    newCbaContext.linkedBOM.dataProviderName = resultData.providerName;
                    // when launch OpenInView Panel in Guided Update, section name is undefined by default
                    // should fetch section name from _getProviderAndSectionNameForCba()
                    if( !resultData.sectionName && CBAImpactAnalysisService.isImpactAnalysisMode() ) {
                        _getProviderAndSectionNameForCba( provider.openedObject ).then( function( resultSectionData ) {
                            _getLocalizedTextForLinkedBom( resultSectionData.sectionName, newCbaContext, provider );
                        });
                    }else {
                        _getLocalizedTextForLinkedBom( resultData.sectionName, newCbaContext, provider );
                    }
                }
                deferred.resolve();
            } );
        } );
    }
    // } );

    return deferred.promise;
};

/**
 * Get localized text for linked bom
 * @param {String} sectionName - sectionName in OpenInView panel
 * @param {Object} newCbaContext - newCbaContext
 * @param {Object} provider - provider
 */
let _getLocalizedTextForLinkedBom = function( sectionName, newCbaContext, provider ) {
    localeService.getLocalizedText( 'CadBomAlignmentConstants', sectionName ).then( function( result ) {
        newCbaContext.linkedBOM.sectionName = result;
        provider.cbaContext.update( newCbaContext );
    } );
};

/**
 * Validate if selected object is valid to open in CBA view or oot.
 *
 * @param {string} source - Source or Target context in which open in view panel opened
 * @param {object} selectedObject - object selected in open in view to open
 *
 * @returns {Boolean} True if object is valid to open in CBA page
 */
export let isValidObjectToOpen = function( source, selectedObject ) {
    let deferred = AwPromiseService.instance.defer();
    let selectedObjects = [ selectedObject ];
    let promise = cbaObjectTypeService.getDesignsAndParts( selectedObjects );

    promise.then( function( resultData ) {
        let sourceObject;
        let targetObject;
        let invalidTypes = [];

        if( source === cbaConstants.CBA_SRC_CONTEXT && !resultData.designTypes.includes( selectedObject ) ) {
            targetObject = appCtxSvc.getCtx( 'CBATrgContext.modelObject' );
            invalidTypes.push( selectedObject );
        } else if( source === cbaConstants.CBA_TRG_CONTEXT && !resultData.partTypes.includes( selectedObject ) && !resultData.productTypes.includes( selectedObject ) ) {
            sourceObject = appCtxSvc.getCtx( 'CBASrcContext.modelObject' );
            invalidTypes.push( selectedObject );
        }

        let resultPromise = CadBomAlignmentUtil.isInvalidObjectsForCBA( selectedObjects, invalidTypes );
        resultPromise.then( function( result ) {
            if( result.invalidTypes ) {
                CadBomOccurrenceAlignmentUtil.getErrorMessage( sourceObject, targetObject, result.invalidTypes, result.errorMessageKey ).then( function( errorText ) {
                    messagingService.showError( errorText );
                } );
            } else {
                deferred.resolve();
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Returns panel context according to gridId
 * @param {String} gridId - ID of grid i.e. cbaSourceTree or cbaTargetTree
 * @returns {Object} panelContext - Panel context object which required to open structure in CBA
 */
export let getOpenPanelConextFromGrid = function( gridId ) {
    let contextKey = gridId === 'cbaSourceTree' ? cbaConstants.CBA_TRG_CONTEXT : cbaConstants.CBA_SRC_CONTEXT;
    let urlParams = CadBomOccurrenceAlignmentUtil.getURLParameters( contextKey );

    return {
        urlParamsMap: urlParams,
        contextKey: contextKey
    };
};

/**
 * Clean up Linked BOM
 */
export let cleanUpLinkedBOM = function() {
    appCtxSvc.updatePartialCtx( 'cbaContext.linkedBOM', undefined );
};

/**
 * Check whether primaryModelObject has isPartRequired/isDesignRequired property
 * Case 1. if primaryModelObject is Product then return false
 * Case 2. if primaryModelObject is Design/Part then check whether primaryModelObject has isPartRequired/isDesignRequired property
 *
 * @param {*} primaryModelObject - Object from primary work area
 * @returns {boolean} - true if primaryModelObject has isPartRequired/isDesignRequired property
 */
export let isDesignOrPartRequired = function( primaryModelObject ) {
    let result;
    let defer = AwPromiseService.instance.defer();
    let promise = cbaObjectTypeService.isObjectOfGivenType( primaryModelObject, cbaConstants.PRODUCT_EBOM );
    promise.then( function( isProductObject ) {
        if( isProductObject ) {
            result = false;
            defer.resolve( result );
        } else {
            let modelObject = appCtxSvc.getCtx( 'CBASrcContext.currentState.uid' ) === primaryModelObject.uid ?
                appCtxSvc.getCtx( 'CBASrcContext.modelObject' ) : appCtxSvc.getCtx( 'CBATrgContext.modelObject' );

            if( modelObject.props && modelObject.props.pma1IsPartRequired ) {
                result = modelObject.props.pma1IsPartRequired.dbValues[ 0 ] === '1';
            } else if( modelObject.props && modelObject.props.pma1IsDesignRequired ) {
                result = modelObject.props.pma1IsDesignRequired.dbValues[ 0 ] === '1';
            }
            defer.resolve( result );
        }
    } );

    return defer.promise;
};

/**
 * Populate filter types on cbaContext for openInViewPanel
 * @param {Object} panelContextKey - Panel context key
 */
export let populateFilterTypesForOpenInViewPanel = function( panelContextKey ) {
    //When Platform is TC124, Part/Design types preferences won't be available, so set default filterType
    appCtxSvc.ctx.cbaContext.filterTypes = cbaConstants.ITEM_REVISION;

    if( panelContextKey === cbaConstants.CBA_TRG_CONTEXT ) {
        //Override Part Revision and Product Revision types as filter types if Type preferences exists
        if( appCtxSvc.ctx.preferences.FND0_PARTREVISION_TYPES ) {
            appCtxSvc.ctx.cbaContext.filterTypes = appCtxSvc.ctx.preferences.FND0_PARTREVISION_TYPES.toString();

            if( appCtxSvc.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES ) {
                //Append ProductBOM Types if exists
                appCtxSvc.ctx.cbaContext.filterTypes = appCtxSvc.ctx.cbaContext.filterTypes + ',' + appCtxSvc.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES.toString();
            }
        }
    } else if( panelContextKey === cbaConstants.CBA_SRC_CONTEXT && appCtxSvc.ctx.preferences.FND0_DESIGNREVISION_TYPES ) {
        //Override Design Revision types as filter types if Design Revision Types preference exists
        appCtxSvc.ctx.cbaContext.filterTypes = appCtxSvc.ctx.preferences.FND0_DESIGNREVISION_TYPES.toString();
    }
};

/**
 * Update the add panel state with new selection
 *
 * @param {Object} addPanelState the view model data object
 * @returns {Object} selectedObject selected object in tab
 */
export let updateSelectionInPanelState = function( addPanelState, selectedObject ) {
    if( selectedObject ) {
        let newAddPanelState = { ...addPanelState.value };
        newAddPanelState.sourceObjects = selectedObject;
        addPanelState.update( newAddPanelState );
    }
};

/**
 * Update the tab selection attribute
 *
 * @param {Object} addPanelState the view model data object
 * @returns {Object} updated addPanelState
 */
export let updateTabSelection = function( addPanelState ) {
    const newAddPanelState = { ...addPanelState.value };
    newAddPanelState.sourceObjects = null;
    newAddPanelState.creationType = null;
    return {
        addPanelState: newAddPanelState
    };
};

/**
 * Update selected object in panel context according to selected section
 * @param {object} selectedObject - selected object
 */
export let updateSelectionInContext = function( selectedObject ) {
    let adaptedObject = adapterSvc.getAdaptedObjectsSync( selectedObject );
    appCtxSvc.updatePartialCtx( 'panelContext.selectedObject', adaptedObject );
};

/**
 * This function gets the selected objects and resets the other providers in palette
 * @param {Object} ctx - Context
 * @param {Object} provider - Provider
 */
 export let handlePaletteSelection = function( ctx, provider ) {
    if( ctx && provider ) {
        let providers = [ ctx.getClipboardProvider, ctx.getRecentObjsProvider, ctx.getFavoriteProvider ];
        for( let index = 0; index <providers.length; index++ ) {
            let indexProvider = providers[ index ];
            if( indexProvider && indexProvider !== provider ) {
                indexProvider.selectNone();
                indexProvider.selectedObjects = [];
            }
        }
    }
};

/**
 * cbaOpenInViewPanelService
 */
export default exports = {
    getProviderAndSectionName,
    initializeServiceForLinkedBom,
    isValidObjectToOpen,
    getOpenPanelConextFromGrid,
    cleanUpLinkedBOM,
    isDesignOrPartRequired,
    populateFilterTypesForOpenInViewPanel,
    updateSelectionInPanelState,
    updateTabSelection,
    updateSelectionInContext,
    handlePaletteSelection
};
