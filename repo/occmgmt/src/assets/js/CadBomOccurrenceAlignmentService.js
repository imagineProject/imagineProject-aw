// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomOccurrenceAlignmentService
 */

import aceTreeTableDataService from 'js/aceTreeTableDataService';
import adapterSvc from 'js/adapterService';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import LocationNavigationService from 'js/locationNavigation.service';
import cdmSvc from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import dataManagementService from 'soa/dataManagementService';
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaRelatedObjectService from 'js/cbaRelatedObjectService';
import cbaOpenInViewPanelService from 'js/cbaOpenInViewPanelService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cbaConstants from 'js/cbaConstants';
import occmgmtUtils from 'js/occmgmtUtils';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import soaService from 'soa/kernel/soaService';
import cbaFindAlignedService from 'js/cbaFindAlignedService';
import cbaRedLineService from 'js/cbaRedLineService';
import CbaOccVisibilityProvider from 'js/cbaOccVisibilityProvider';
import cbaPropertyLoaderService from 'js/cbaPropertyLoaderService';
import occmgmtVisibilitySvc from 'js/aceVisibilityService';
import cadBomOccAlignmentCheckUtil from 'js/CadBomOccAlignmentCheckUtil';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cbaConfigurationBaselineService from 'js/cbaConfigurationBaselineService';
import logger from 'js/logger';

const EVENT_ALIGN_OBJECT = 'cba.alignObject';
const EVENT_UNALIGN_OBJECT = 'cba.unalignObject';
const CTX_PATH_DATASETUID = 'cbaContext.alignmentCheckContext.dataSetUID';


let _eventSubDefs = [];

let _registerCBAPropertyLoaderService = function( eventData ) {
    try {
        logger.debug( 'CadBomOccurrenceAlignmentService._registerCBAPropertyLoaderService: Starting CBA property loader service registration', eventData );

        // Validate eventData and contextKey
        if( !eventData || !eventData.contextKey ) {
            logger.warn( 'CadBomOccurrenceAlignmentService._registerCBAPropertyLoaderService: Missing eventData or contextKey, proceeding with default behavior' );
        }

        // Initialize the property loader service
        cbaPropertyLoaderService.initializeService();

        // Load required properties
        const contextKey = eventData?.contextKey;
        cbaPropertyLoaderService.loadProperties( contextKey, [ 'awb0ExplodedLineCSIDs' ] );
        logger.debug( 'CadBomOccurrenceAlignmentService._registerCBAPropertyLoaderService: returned from cbaPropertyLoaderService.loadProperties' );

        // Create and register visibility provider
        let cbaOccVisibilityProvider = new CbaOccVisibilityProvider();
        occmgmtVisibilitySvc.registerOccVisibilityProvider( cbaOccVisibilityProvider );
        logger.debug( 'CadBomOccurrenceAlignmentService._registerCBAPropertyLoaderService: CBA visibility provider registered successfully' );
    } catch( error ) {
        logger.error( 'CadBomOccurrenceAlignmentService._registerCBAPropertyLoaderService: Failed to register CBA property loader service', error );
        // Don't throw - allow the application to continue even if registration fails
    }
};

/**
 * Handles page refresh events and registers the CBA visibility property handler when needed.
 * 
 * @private
 * @function _sublocationUpdate
 * @param {Object} eventData - The event data object containing information about the refresh event
 * @param {string} eventData.name - The name of the event (e.g., 'sublocationUpdate')
 * @returns {void}
 */
const _handleSublocationUpdate = function( eventData ) {
    if( eventData.name === 'sublocationUpdate' ) {
        logger.debug( 'CadBomOccurrenceAlignmentService._sublocationUpdate: Sublocation update detected, registering CBA visibility property handler' );
        cbaPropertyLoaderService?.registerCbaVisPropertyHandler( );
        cbaPropertyLoaderService?.registerCbaGetOccInputProvider();
    }
};

// Listeners for EBOM application specific processing on 3D tab ON and OFF.
logger.debug( 'CadBomOccurrenceAlignmentService: Subscribing to occDataLoadedEvent' );
_eventSubDefs.push( eventBus.subscribe( 'occDataLoadedEvent', _registerCBAPropertyLoaderService ) );
logger.debug( 'CadBomOccurrenceAlignmentService: Subscribing to appCtx.update event' );
_eventSubDefs.push( eventBus.subscribe( 'appCtx.update', _handleSublocationUpdate ) );
logger.debug( 'CadBomOccurrenceAlignmentService: Event subscriptions registered, total subscriptions:', _eventSubDefs.length );


/**
 * Initialize the services for CBA
 */
export const initializeServiceForCBA = function() {
    CadBomOccurrenceAlignmentUtil.registerSplitViewMode();

    CadBomOccAlignmentCheckService.initializeService();

    if( cbaConfigurationBaselineService.enableConfigBaselineForCBA() ) {
        cbaConfigurationBaselineService.initializeService();
    }

    //Fix Console error - LCS-1184097
    appCtxSvc.registerCtx( 'aceActiveContext', { key: '', context: '' } );
};

/**
 * Update header title and task title in context
 * @param {object} localTextBundle Localized text bundle
 */
let _updateTaskUIHeaderText = function( localTextBundle ) {
    appCtxSvc.updatePartialCtx( 'taskUI', {
        moduleTitle: localTextBundle.Awb0EntCBAModuleTitle,
        taskTitle: localTextBundle.Awb0EntCBAAlignTaskTitle
    } );
};

/**
 * Updates cba context
 *
 * @param {Object} cbaContext - cbaContext atomic data
 * @param {Object} value - value to update in context
 * @returns {Object} context with updated values
 */
let updateCbaContextData = function( cbaContext, value ) {
    let newCbaContext = { ...cbaContext };
    for( const key of Object.keys( value ) ) {
        newCbaContext[ key ] = value[ key ];
    }
    return { ...newCbaContext };
};

/**
 * Load CBA data before page launch
 *
 * @param {Object} cbaContext - cbaContext atomic data
 * @returns {Promise} Promise after data load is done
 */
export const loadCBAData = function( cbaContext, eventData ) {
    let defer = AwPromiseService.instance.defer();

    let resource = 'CadBomAlignmentConstants';
    let localTextBundle = localeService.getLoadedText( resource );
    if( localTextBundle ) {
        _updateTaskUIHeaderText( localTextBundle );
    } else {
        localeService.getTextPromise( resource ).then( function( localTextBundle ) {
            _updateTaskUIHeaderText( localTextBundle );
        } );
    }

    // CBA don't need to show the Right Wall.
    appCtxSvc.ctx.hideRightWall = true;
    let toParams;
    let dataSetUID = appCtxSvc.getCtx( CTX_PATH_DATASETUID );

    if( dataSetUID ) {
        let datasetObject = cdmSvc.getObject( dataSetUID );
        toParams = CadBomAlignmentUtil.getURLParametersFromDataset( datasetObject );
    } else {
        toParams = appCtxSvc.getCtx( 'state.params' );
    }
    let uidForLoadObject = [];
    if( eventData && eventData.urlParams ) {
        toParams = eventData.urlParams.urlParams;
    }
    let loadObject = [];
    if ( toParams.uid ) {
        uidForLoadObject.push( toParams.uid );
        loadObject.push( cdmSvc.getObject( toParams.uid ) );
    }

    if ( toParams.uid2 ) {
        uidForLoadObject.push( toParams.uid2 );
        loadObject.push( cdmSvc.getObject( toParams.uid2 ) );
    }

    let objectCount = uidForLoadObject.length;
    appCtxSvc.ctx.skipAutoBookmark = true;

    if( toParams.spci_uid ) {
        uidForLoadObject.push( toParams.spci_uid );
    }

    if( toParams.tpci_uid ) {
        uidForLoadObject.push( toParams.tpci_uid );
    }

    if( toParams.pci_uid2 ) {
        uidForLoadObject.push( toParams.pci_uid2 );
    }

    if( toParams.adaptObj_uid ) {
        uidForLoadObject.push( toParams.adaptObj_uid );
    }

    if( toParams.ecn_uid ) {
        uidForLoadObject.push( toParams.ecn_uid );
    }

    if( toParams.selectedIA_uid ) {
        uidForLoadObject.push( toParams.selectedIA_uid );
    }

    dataManagementService.loadObjects( uidForLoadObject ).then( function() {
        let result = {};
        result.data = [];
        let pci2;
        //LCS-809106-The bom window configurations are not retained for Run in background alignment checks
        let dataSetUID = appCtxSvc.getCtx( CTX_PATH_DATASETUID );
        if( !dataSetUID ) {
            pci2 = cdmSvc.getObject( toParams.pci_uid2 );
        }
        let valueToUpdate = {
            isCBAFirstLaunch: true,
            ImpactAnalysis: {
                isImpactAnalysisMode: false
            }
        };
        for( let i = 0; i < objectCount; i++ ) {
            let modelObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmSvc.getObject( uidForLoadObject[ i ] ), null );

            result.data.push( modelObject );
        }
        if( toParams.isIA_mode && toParams.isIA_mode === true ) {
            valueToUpdate = {
                isCBAFirstLaunch: true,
                ImpactAnalysis: {
                    sourceTopItem: cdmSvc.getObject( toParams.adaptObj_uid ),
                    alignedTargetProviderInECN: 'Pma1AlignedTargetProvider',
                    ECNForImpactAnalysis: cdmSvc.getObject( toParams.ecn_uid ),
                    selectedIANode: cdmSvc.getObject( toParams.selectedIA_uid ),
                    isImpactAnalysisMode: true
                }
            };

            // Update ImpactAnalysis to Global context directly
            occmgmtUtils.updateValueOnCtxOrState( 'ImpactAnalysis', valueToUpdate.ImpactAnalysis, 'cadbomalignment' );
        }

        if( toParams.isRL_mode && toParams.isRL_mode === 'true' ) {
            valueToUpdate.redLineMode  = {
                isChangeEnabled: true
            };
        }

        if( toParams.acStatus ) {
            valueToUpdate.acStatus = toParams.acStatus;
        }
        if( objectCount === 2 ) {
            valueToUpdate.srcStructure = result.data[ 0 ];
            valueToUpdate.trgStructure = result.data[ 1 ];
            valueToUpdate.pciData = pci2;
        } else if( toParams.uid ) {
            valueToUpdate.srcStructure = result.data[ 0 ];
            valueToUpdate.trgStructure = null;
        } else if( toParams.uid2 ) {
            valueToUpdate.trgStructure = result.data[ 0 ];
            valueToUpdate.srcStructure = null;
        }

        let newContext = updateCbaContextData( cbaContext, valueToUpdate );
        occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, cbaContext );
        //Update the source and target structure on ctx.cbaContext
        occmgmtUtils.updateValueOnCtxOrState( 'srcStructure', valueToUpdate.srcStructure, 'cbaContext' );
        occmgmtUtils.updateValueOnCtxOrState( 'trgStructure', valueToUpdate.trgStructure, 'cbaContext' );
        newContext.objectsToOpen = result.data;
        defer.resolve( newContext );
    } );
    return defer.promise;
};

/**
 * Update PCI
 * @param {Object} pciData - new pci data
 * @return {Object} ccKeyPciKey
 */
export let populateConfigContextByPci = ( pciData ) => {
    const launchCbaFromGuidedUpdate = appCtxSvc.getCtx( cbaConstants.CTX_PATH_LAUNCH_CBA_FROM_GUIDED_UPDATE );
    if( launchCbaFromGuidedUpdate === true ) {
        appCtxSvc.unRegisterCtx( cbaConstants.CTX_PATH_LAUNCH_CBA_FROM_GUIDED_UPDATE );
        return {};
    }

    let ccKeyPciKey = {
        de: '',
        r_uid: '',
        var_uids: '',
        iro_uid: '',
        eg_uids: '',
        ue: '',
        cl_uid: ''
    };
    if( pciData ) {
        let pciCProps = pciData.props;
        ccKeyPciKey.de = pciCProps.awb0EffDate?.dbValues[ 0 ];
        ccKeyPciKey.r_uid = pciCProps.awb0CurrentRevRule?.dbValues[ 0 ];
        ccKeyPciKey.var_uids = pciCProps.awb0VariantRules?.dbValues;
        ccKeyPciKey.iro_uid = pciCProps.awb0VariantRuleOwningRev?.dbValues[ 0 ];
        ccKeyPciKey.eg_uids = pciCProps.awb0EffectivityGroups.dbValues;
        ccKeyPciKey.ue = pciCProps.awb0EffUnitNo?.dbValues[ 0 ];
        ccKeyPciKey.cl_uid = pciCProps.awb0ClosureRule?.dbValues[ 0 ];
    }
    return { ccKeyPciKey };
};

/**
 * Get valid aligned or linked object for CBA
 * @param {Object} relatedObjectsMapping - Related model objects with respective first object
 * @return {Object} - If firstObject is Part then return it's Primary Design
 *                    if firstObject is Design/Product then return it's related object if that is the only aligned/linked object to the selected Design/Product
 */
let _getValidAlignedOrLinkedObjectForCBA = function( relatedObjectsMapping ) {
    let deferred = AwPromiseService.instance.defer();

    let firstObject = relatedObjectsMapping.firstObject;

    cbaObjectTypeService.getDesignsAndParts( [ firstObject ] ).then( function( resultData ) {
        let modelObjectsArray = relatedObjectsMapping.relatedModelObjects;
        let result;
        if( modelObjectsArray.length === 1 ) {
            if( resultData.designTypes.includes( firstObject ) || resultData.partTypes.includes( firstObject ) ) {
                result = cdmSvc.getObject( modelObjectsArray[ 0 ].props.fnd0UnderlyingObject.dbValues[ 0 ] );
            } else if( resultData.productTypes.includes( firstObject ) ) {
                result = cdmSvc.getObject( modelObjectsArray[ 0 ].uid );
            }
        } else {
            if( resultData.partTypes.includes( firstObject ) ) {
                _.forEach( modelObjectsArray, function( modelObject ) {
                    if( modelObject.props.fnd0IsPrimary.dbValues[ 0 ] === '1' ) {
                        result = cdmSvc.getObject( modelObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
                    }
                } );
            }
        }
        deferred.resolve( result );
    } );
    return deferred.promise;
};

/**
 * Get Part-CAD aligned/Linked object
 * Note: 1.   if firstObject is Part then return it's Primary Design
 *       2.a. if firstObject is Design then return it's aligned Part if that is the only aligned part to the selected Design
 *  *    2.b. if firstObject is Design and it doesn't have an aligned Part then return the Product EBOM linked to the selected Design
 *       3.   if firstObject is Product then return it's linked object if that is the only linked Object to the selected Product
 *
 * @param {Object} firstObject - First selected object
 * @return {Object} - Part-CAD aligned/Linked object
 */
export const getAlignedObject = function( firstObject, configBaselineUid ) {
    let deferred = AwPromiseService.instance.defer();
    let impactAnalysis = CBAImpactAnalysisService.isImpactAnalysisMode();
    let promise = cbaOpenInViewPanelService.getProviderAndSectionName( firstObject );
    promise.then( function( resultData ) {
        cbaRelatedObjectService.getRelatedModelObjects( firstObject, resultData.providerName, true, configBaselineUid ).then( function( relatedModelObjectsArray ) {
            appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS, relatedModelObjectsArray );

            if( !relatedModelObjectsArray || relatedModelObjectsArray.length === 0 ) {
                // When the firstObject is Design, the provider we received was the Aligned Parts Provider.
                // This provider hasnt returned any aligned Design Objects. This may imply that the Design has linked EBOM Product.
                // Therefore, we query again to fetch the Linked Products.
                if( resultData.providerName === cbaConstants.ALIGNED_PARTS_PROVIDER ) {
                    cbaRelatedObjectService.getRelatedModelObjects( firstObject, cbaConstants.LINKED_ITEM_PROVIDER, true, configBaselineUid ).then( function( relatedModelObjectsArray ) {
                        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS, relatedModelObjectsArray );

                        if( relatedModelObjectsArray && relatedModelObjectsArray.length === 1 ) {
                            deferred.resolve( relatedModelObjectsArray[ 0 ] );
                        } else {
                            deferred.resolve();
                        }
                    } );
                } else {
                    deferred.resolve();
                }
            } else {
                if(  impactAnalysis === true ) {
                    deferred.resolve( cdmSvc.getObject( relatedModelObjectsArray[ 0 ].uid ) );
                } else {
                    let relatedObjectsMapping = {
                        firstObject: firstObject,
                        relatedModelObjects: relatedModelObjectsArray
                    };

                    _getValidAlignedOrLinkedObjectForCBA( relatedObjectsMapping ).then( function( secondObject ) {
                        deferred.resolve( secondObject );
                    } );
                }
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Get aligned design occurrences' csidchain from input part occurrence
 * Update design product and csidChains in appContext
 * @param {ModelObject[]} selectedObjects - Model objects that are selected
 * @param {String} hostType - Host Type
 *
 */
export let getAlignedDesigns = function( selectedObjects, hostType ) {
    let deferred = AwPromiseService.instance.defer();

    appCtxSvc.unRegisterCtx( 'aw_aligned_designs_csid_chains' );
    appCtxSvc.unRegisterCtx( 'aw_aligned_designs_product' );

    if( selectedObjects && selectedObjects.length > 0 ) {
        aceBackingObjectProviderService.getBackingObjects( selectedObjects ).then( function( bomLines ) {
            var partitionLines = [];
            if( hostType === 'NX' ) {
                _.forEach( bomLines, function( bomLine, index ) {
                    if( bomLine.type === 'Ptn0PartitionLine' ) {
                        partitionLines[ index ] = bomLine;
                    }
                } );

                if( partitionLines.length > 0 ) {
                    bomLines = bomLines.filter( item => !partitionLines.includes( item ) );
                }
            }
            if( bomLines.length > 0 ) {
                let input = {
                    partLines: bomLines,
                    requestPref: {}
                };
                let soaInput = {
                    input: input
                };

                soaService.postUnchecked( 'Internal-Bom-2021-12-StructureManagement', 'getAlignedDesigns', soaInput ).then( function( response ) {
                    var designProduct = null;
                    var allignedCsidChainMap = new Map();
                    if( response.alignedOccCsidPaths && response.alignedOccCsidPaths.length > 0 ) {
                        let found = false;
                        if( hostType === 'NX' ) {
                            selectedObjects.forEach( function( selectedObject ) {
                                allignedCsidChainMap.set( selectedObject.uid, response.alignedOccCsidPaths );
                            } );
                        } else if( hostType === 'TcIC' ) {
                            //CATIA Integration can not handle duplicated entries for encoded objects
                            //Ensure that only one set of encoded object sent to host application.
                            //If a partition is selected send the all encoded objects for the first partition.
                            selectedObjects.forEach( function( selectedObject ) {
                                if( _.includes( selectedObject.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) && !found ) {
                                    allignedCsidChainMap.set( selectedObject.uid, response.alignedOccCsidPaths );
                                    found = true;
                                }
                            } );

                            //If we did not find partition in selected list send encoded object for last selected object.
                            if( !found ) {
                                allignedCsidChainMap.set( selectedObjects[ selectedObjects.length - 1 ].uid, response.alignedOccCsidPaths );
                            }
                        }
                        designProduct = response.designProduct;
                    }
                    appCtxSvc.updatePartialCtx( 'aw_aligned_designs_csid_chains', allignedCsidChainMap );
                    appCtxSvc.updatePartialCtx( 'aw_aligned_designs_product', designProduct );
                    deferred.resolve();
                } );
            } else {
                deferred.resolve();
            }
        } );
    } else {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Get aligned part occurrences' csidchain from input design occurrence csid chain
 *
 * @param {StringArray} csidChainsOfElementsToFocusOn - List of CSIDs of design occurrence
 *
 * @return {Object} response - Response object from 'getAlignedPartsCsidChain'
 */
export let getAlignedPartOccurrenceCsidChain = function( csidChainsOfElementsToFocusOn ) {
    let deferred = AwPromiseService.instance.defer();
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    let rootElement = context.rootElement;
    aceBackingObjectProviderService.getBackingObjects( [ rootElement ] ).then( function( bomLines ) {
        if( bomLines.length > 0 ) {
            let input = {
                inputPartLine: bomLines[ 0 ],
                occurrenceChains: csidChainsOfElementsToFocusOn,
                requestPref: {}
            };
            let soaInput = {
                input: input
            };
            soaService.postUnchecked( 'Internal-Bom-2021-12-StructureManagement', 'getAlignedPartsCsidChain', soaInput ).then( function( response ) {
                deferred.resolve( response );
            } );
        }
    } );

    return deferred.promise;
};

/**
 * Get source and target object from selected objects
 * Note: If selected objects are invalid to launch in CBA UI then throws proper error message
 *
 * @param {ObjectArray} selectedObjects - Selected objects to launch in CBA
 * @returns {Object} - After validation return promise with source and target object
 */
let _getSrcAndTrgObjectFromSelectedObjects = function( selectedObjects ) {
    let deferred = AwPromiseService.instance.defer();

    let promise = cbaObjectTypeService.getDesignsAndParts( selectedObjects );
    promise.then( function( resultData ) {
        let sourceObject;
        let targetObject;
        let invalidTypes = [];

        _.forEach( selectedObjects, function( selectedObject ) {
            if( !sourceObject && resultData.designTypes.includes( selectedObject ) ) {
                sourceObject = selectedObject;
            } else if( !targetObject && ( resultData.partTypes.includes( selectedObject ) || resultData.productTypes.includes( selectedObject ) ) ) {
                targetObject = selectedObject;
            } else {
                invalidTypes.push( selectedObject );
            }
        } );

        let resultPromise = CadBomAlignmentUtil.isInvalidObjectsForCBA( selectedObjects, invalidTypes );
        resultPromise.then( function( result ) {
            if( result.invalidTypes ) {
                CadBomOccurrenceAlignmentUtil.getErrorMessage( sourceObject, targetObject, result.invalidTypes, result.errorMessageKey ).then( function( errorText ) {
                    messagingService.showError( errorText );
                } );
            } else {
                let output = {
                    sourceObject: sourceObject,
                    targetObject: targetObject
                };
                deferred.resolve( output );
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Get configured params from context
 *
 * Note : While launching CBA from within ACE/saved working context, we want to use saved configuration
 * @param {object} selectedObject - Selected Object

 * @returns {object} - Parameters
 */
let _getConfiguredPCIUid = function( selectedObject ) {
    return appCtxSvc.getCtx( cbaConstants.CTX_PATH_ELEMENT_TO_PCI_MAP ) ? _getPCIForSelection( selectedObject ) : appCtxSvc.getCtx( cbaConstants.CTX_PATH_PRODUCT_CONTEXT_INFO_UID );
};

/**
 * Get parameters for Source and Target from selected objects
 * @param {ObjectArray} selectedObjects - Selected objects from UI
 * @return {Object} - Parameters
 */
let _getParamsFromSelectedObjects = function( commandContext, selectedObjects ) {
    let deferred = AwPromiseService.instance.defer();

    let promise = _getSrcAndTrgObjectFromSelectedObjects( selectedObjects );
    promise.then( function( output ) {
        let toParams = {};

        let sourceObject = output.sourceObject;
        let targetObject = output.targetObject;
        let openedElement = commandContext && commandContext.occContext ? commandContext.occContext.openedElement : null;
        let openedObject = null;
        if( openedElement && openedElement.props && openedElement.props.awb0UnderlyingObject !== undefined ) {
            openedObject = cdmSvc.getObject( openedElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        if( sourceObject ) {
            toParams.src_uid = sourceObject.uid;
            toParams.uid = sourceObject.uid;

            toParams.spci_uid = '';
            if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
                toParams.spci_uid = _getConfiguredPCIUid( sourceObject );
            }
            if( openedObject && openedObject.uid === sourceObject.uid ) {
                toParams.t_uid = sourceObject.uid;
                toParams.pci_uid = toParams.spci_uid;
            }
        }
        if( targetObject ) {
            toParams.trg_uid = targetObject.uid;
            toParams.uid2 = targetObject.uid;

            toParams.tpci_uid = '';
            if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
                toParams.tpci_uid = _getConfiguredPCIUid( targetObject );
            }
            if( openedObject && openedObject.uid === targetObject.uid ) {
                toParams.t_uid2 = targetObject.uid;
                toParams.pci_uid2 = toParams.tpci_uid;
            }
        }

        // Populate configuration baseline information on toParams object
        if( cbaConfigurationBaselineService.enableConfigBaselineForCBA() ) {
            cbaConfigurationBaselineService.populateConfigurationBaselineInfo( toParams, commandContext.occContext );
        }

        deferred.resolve( toParams );
    } );
    return deferred.promise;
};

/**
 * Get selected objects from split mode
 * @param {object} commandContext Command context object
 * @returns {Array} Array contains the selected objects from split mode
 */
let _getSelectedObjectsInSplitMode = function( commandContext ) {
    let selectedObjects = commandContext.occContext.pwaSelection;
    let inactiveSelectedModelObject = commandContext.inactiveContext.pwaSelection;

    if( inactiveSelectedModelObject.length ) {
        selectedObjects = selectedObjects.concat( inactiveSelectedModelObject );
    }
    return selectedObjects;
};

/**
 * Get multiple selected objects
 * @param {object} commandContext Command context object
 * @return {Object} - Multiple selected objects
 */
let _getMultipleSelectedObjects = function( commandContext ) {
    let selectedElements = [];
    if( commandContext.selectionData && commandContext.selectionData.selected ) {
        if( _.isEmpty( commandContext.selectionData.selected ) && commandContext.occContext && commandContext.occContext.pwaSelection ) {
            selectedElements = commandContext.occContext.pwaSelection;
        } else if( !_.isEmpty( commandContext.selectionData.selected ) && commandContext.selectionData.selected?.[0]?.modelType?.typeHierarchyArray?.includes( 'Cm1ChangeSummaryElement' ) ) {
            // Fix the Defect - LCS-1250204 - TC2512:ATDD Failure: Guided Update is not working from ECN Page
            // When launch Guided Update from Change Summary, we should not fetch the selected Elements from commandContext.selectionData.selected, which has Cm1ChangeSummaryElement type
            selectedElements = adapterSvc.getAdaptedObjectsSync( commandContext.selectionData.selected );
        } else {
            selectedElements = commandContext.selectionData.selected;
        }
    } else if( CadBomOccurrenceAlignmentUtil.isNonCBASplitLocation() ) {
        selectedElements = _getSelectedObjectsInSplitMode( commandContext );
    } else {
        selectedElements = appCtxSvc.getCtx( 'mselected' );
    }
    return selectedElements;
};

/**
 * Get first object from selected objects
 *
 * @param {object} mSelected - Multiple selected objects
 * @returns {object} First object from selected objects
 */
let _getFirstObject = function( mSelected ) {
    let firstObject = mSelected[ 0 ];
    if( firstObject.props ) {
        if( firstObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            firstObject = cdmSvc.getObject( firstObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
        } else if( firstObject.props.fnd0UnderlyingObject !== undefined ) { // We got Fnd0AlignedDesign/Fnd0AlignedPart as input
            firstObject = cdmSvc.getObject( firstObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
        }
    }
    return firstObject;
};

/**
 * Check Whether the object is selected from secondary work area In ACE
 *
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if object is selected from SWA otherwise false
 */
const _isObjectSelectedFromSWAInACE = function( commandContext ) {
    if( commandContext ) {
        const aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
        const viewModeContextCtx = appCtxSvc.getCtx( 'ViewModeContext' );

        // Check if in TreeSummaryView mode and selection data exists
        if ( viewModeContextCtx?.ViewModeContext === 'TreeSummaryView' && aceActiveContext ) {
        // Fix the Defect: LCS-1180147 - Tc2506_GUFocusMode: Failed to launch guided update panel using contextual menu command in CBA view in Top Bottom view.
            const selectedObjects = _.get( commandContext, 'selectionData.selected', [] );
            if( selectedObjects.length > 0 ) {
                const selectedItem = selectedObjects[0];
                // Check if the selected item is aligned
                return CadBomAlignmentUtil.isAlignedDesignOrPartSelected( selectedItem );
            }
        }
    }

    return false;
};

/**
 * Get second selected object in ACE
 * @param {object} mSelected - Multiple selected objects
 * @returns {object} second selected object in ACE
 */
let _getSecondSelectedObjectInACE = function( mSelected ) {
    let secondaryWorkAreaObject = appCtxSvc.ctx.selected;

    let secondObject;
    if( secondaryWorkAreaObject ) {
        secondObject = mSelected[ 0 ].uid === secondaryWorkAreaObject.uid ?
            CadBomAlignmentUtil.getPrimarySelection() : secondaryWorkAreaObject;

        // If we first select Primary Object and then select Secondary Object, will go inside this block
        if( secondObject.props && secondObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            secondObject = cdmSvc.getObject( secondObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
        // If we first select Secondary Object and then select Primary Object, will go inside this block.
        // But currently from UI, if we first select Secondary Object and then select Primary Object,
        // the selection of the Secondary Object is getting lost.
        if( secondObject.props && secondObject.props.fnd0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            secondObject = cdmSvc.getObject( secondObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
        }
        return secondObject;
    }
    AwPromiseService.instance.all( {
        uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
    } ).then( function( localizedText ) {
        let deferred = AwPromiseService.instance.defer();
        let errorText;
        errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
        messagingService.showError( errorText );
        deferred.resolve();
    } );
    return null;
};

/**
 * Array contains the xrtSummary Object types for which we need to call getAlignedObject with latest selected object
 */
let makeGetAlignedObjectCallForGivenType = [ 'ChangeNoticeRevision', 'Item' ];

/**
 * Check if Overview tab is selected in SWA
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if Overview tab is selected in SWA otherwise False
 */
let _isOverviewTabActiveInSWA = function( commandContext ) {
    return commandContext.pageContext && 'tc_xrt_Overview' === commandContext.pageContext.secondaryActiveTabId;
};

/**
 * Check if Overview tab is selected in PWA
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if Overview tab is selected in PWA otherwise False
 */
let _isOverviewTabActiveInPWA = function( commandContext ) {
    return commandContext.pageContext && 'tc_xrt_Overview' === commandContext.pageContext.primaryActiveTabId;
};

/**
 * Check if getAlignedObject call is needed when overview tab is active
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if getAlignedObject call is needed when overview tab is active otherwise false
 */
let _makeGetAlignedObjectCallInOverviewTab = function( commandContext ) {
    return  _isOverviewTabActiveInSWA( commandContext ) || _isOverviewTabActiveInPWA( commandContext );
};

/**
 * Check if given object is type of Design/Part/Product
 * @param {object} selectedObject - Selected object
 * @param {string} type - Selected object type
 * @returns {boolean} True if given object is type of Design/Part/Product otherwise false
 */
let _isValidObjectToLaunchInCBA = function( selectedObject, type ) {
    let objectType = type;
    if( !type ) {
        objectType = selectedObject.type;
    }
    let partRevisionPreferences = appCtxSvc.ctx.preferences.FND0_PARTREVISION_TYPES;
    let productRevisionPreferences = appCtxSvc.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES;
    let designRevisionPreferences = appCtxSvc.ctx.preferences.FND0_DESIGNREVISION_TYPES;

    //Check if type of selected object is belongs to revision preference from ctx
    return partRevisionPreferences && partRevisionPreferences.includes( objectType ) ||
        productRevisionPreferences && productRevisionPreferences.includes( objectType ) ||
        designRevisionPreferences && designRevisionPreferences.includes( objectType );
};

/**
 * Check if other than overview tab is active
 * @param {Object} commandContext - command context
 * @returns {boolean} True if other than overview tab is active otherwisw False
 */
let _isNonOverviewTabActive = function( commandContext ) {
    return !_isOverviewTabActiveInSWA( commandContext ) && !_isOverviewTabActiveInPWA( commandContext );
};

/**
 * Get second object from selected objects
 *
 * Note :
 *  We call getAlignedObject() method for following cases:
 *   1. If objects is opened in ACE-TreeSummaryView and no SWA object is selected
 *   2. If Object is opened in ACE-TreeView/out side ACE any mode without SWA
 *   3. If Overview tab is selected in SWA then check latest selection with XRT summary object
 *   4. If any tab is selected other than Overview tab then call getAlignedObject with PWA selection
 *   5. If overview tab selected in PWA
 *
 * @param {Object} commandContext - command context object
 * @param {object} mSelected - Multiple selected objects
 * @param {object} firstObject - First object
 * @returns {Promise} The promise after fetching second object
 */
let _getSecondObject = function( commandContext, mSelected, firstObject ) {
    let deferred = AwPromiseService.instance.defer();

    if( mSelected.length === 1 ) { // For 1 selection
        let xrtSummaryContextObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );

        if( _isObjectSelectedFromSWAInACE( commandContext ) && _isOverviewTabActiveInSWA( commandContext ) ) { // If objects are selected from SWA in Overview tab of ACE
            let secondObject = _getSecondSelectedObjectInACE( mSelected );
            if( secondObject ) {
                deferred.resolve( secondObject );
            }
        } else if( !CadBomAlignmentUtil.isAlignedDesignOrPartSelected( mSelected[ 0 ] ) && ( !xrtSummaryContextObject ||
                _makeGetAlignedObjectCallInOverviewTab( commandContext ) ||
                xrtSummaryContextObject.modelType.typeHierarchyArray.some( ( val ) => makeGetAlignedObjectCallForGivenType.indexOf( val ) !== -1 ) ||
                _isNonOverviewTabActive( commandContext ) ) ) {
            //  !xrtSummaryContextObject - If object is selected in ACE with tree mode
            // _makeGetAlignedObjectCallInOverviewTab - If Overview tab is active then check latest selection with XRT summary object
            // xrtSummaryContextObject.modelType.typeHierarchyArray.some( ( val ) => makeGetAlignedObjectCallForGivenType.indexOf( val ) !== -1 ) ) -
            //   If object is selected from change summary page OR If primary selected object is type of Item (Launch object in CBA from search)
            // _isNonOverviewTabActive() - If any tab is selected other than Overview tab then call getAlignedObject with pWA selection

            if( !_isOverviewTabActiveInSWA( commandContext ) ) {
                let primarySelectedObject = CadBomAlignmentUtil.getPrimarySelection();

                if( primarySelectedObject && _isValidObjectToLaunchInCBA( primarySelectedObject ) ) {
                    firstObject = primarySelectedObject;
                    if( firstObject.props && firstObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
                        firstObject = cdmSvc.getObject( firstObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    }
                }
            }

            let configBaselineUid = null;
            if( cbaConfigurationBaselineService.enableConfigBaselineForCBA() ) {
                configBaselineUid = cbaConfigurationBaselineService.getConfiguredBaselineUid( commandContext.occContext );
            }

            getAlignedObject( firstObject, configBaselineUid ).then( function( secondObject ) {
                deferred.resolve( secondObject );
            } );
        } else { //When Object is selected from SWA of outside ACE
            deferred.resolve( cdmSvc.getObject( xrtSummaryContextObject.uid ) );
        }
    } else {
        if( mSelected.length === 2 ) { // For 2 selections
            let secondObject = mSelected[ 1 ];
            if( secondObject.props && secondObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
                secondObject = cdmSvc.getObject( secondObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
            }
            deferred.resolve( secondObject );
        } else { // For more than 2 selections
            AwPromiseService.instance.all( {
                uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
            } ).then( function( localizedText ) {
                let deferred = AwPromiseService.instance.defer();
                let errorText;
                errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
                messagingService.showError( errorText );
                deferred.resolve();
            } );
        }
    }
    return deferred.promise;
};

/**
 * Get state params
 * @param {Object} commandContext - command context object
 * @param {Object} optionalData - optional data
 * @returns {Promise} The promise after fetching state parameters
 */
export let getStateParams = function( commandContext, optionalData ) {
    let deferred = AwPromiseService.instance.defer();

    let mSelected = _getMultipleSelectedObjects( commandContext );
    let selectedObjects = [];

    // Guided update scenario
    if( optionalData && optionalData.isIA_mode ) {
        //Guided update from ACE/CBA else changeSummary
        if( commandContext.occContext ) {
            // Fix the issue: LCS-961024 - Inconsistency around Guided panel close issue
            // If open object in ACE from Guided Update Page, when go back previous page, should retain Guided Update Panel content
            optionalData.selectedIA_uid = commandContext.occContext.pwaSelection[0].uid;
            mSelected = [ commandContext.occContext.topElement ];
            optionalData.adaptObj_uid = commandContext.occContext.topElement.props.awb0UnderlyingObject.dbValues[0];
        }else{
            optionalData.selectedIA_uid = mSelected[0].uid;
            optionalData.adaptObj_uid = mSelected[0].uid;
        }
    }


    let firstObject = _getFirstObject( mSelected );
    selectedObjects.push( firstObject );

    let promise = _getSecondObject( commandContext, mSelected, firstObject );
    promise.then( function( secondObject ) {
        if( secondObject ) {
            selectedObjects.push( secondObject );
        }
        _getParamsFromSelectedObjects( commandContext, selectedObjects ).then( function( toParams ) {
            deferred.resolve( toParams );
        } );
    } );
    return deferred.promise;
};


/**
 * Launch CBA Page
 * @param {object} commandContext Command context object
 * @param {object} optionalData State params to be updated on URL
 */
export let launchCBA = function( commandContext, optionalData ) {
    exports.getStateParams( commandContext, optionalData ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'cbaContext.resetTreeExpansionState', true );
        let toParams = result;
        if( optionalData ) {
            _.assign( toParams, optionalData );
        }

        // When launch Guided Update panel from CBA page, we don't need to update the gesture with 'dualContextEnter'
        // Fix issue - failed to expand the selected IA node in Guided Update page
        if( optionalData.isIA_mode !== true ) {
            toParams.gesture = 'dualContextEnter';
        }

        let transitionTo = 'CADBOMAlignment';
        LocationNavigationService.instance.go( transitionTo, toParams );
    } );
};

/**
 * @param {IModelObject} modelObject - The modelObject to access.
 *
 * @returns {String} UID of the immediate parent of the given modelObject based on 'awb0BreadcrumbAncestor' or
 *          'awb0Parent' (or NULL if no parent found).
 */
function _getParentUid( modelObject ) {
    if( modelObject && modelObject.props ) {
        let props = modelObject.props;
        let uid;

        if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
            uid = props.awb0Parent.dbValues[ 0 ];
        }

        if( cdmSvc.isValidObjectUid( uid ) ) {
            return uid;
        }
    }
    return null;
}

/**
 * @param {Object} selectedObject Object representing selection made by the user
 * @returns {string} Uid of the productContext corresponding to the selected object if it is available in the
 *         elementToPCIMap; null otherwise.
 */
let _getPCIForSelection = function( selectedObject ) {
    let _elementToPCIMap = appCtxSvc.getCtx( 'aceActiveContext.context.elementToPCIMap' );
    if( _elementToPCIMap ) {
        let parentObject = selectedObject;
        do {
            if( _elementToPCIMap[ parentObject.uid ] ) {
                return _elementToPCIMap[ parentObject.uid ];
            }
            let parentUid = _getParentUid( parentObject );
            parentObject = cdmSvc.getObject( parentUid );
        } while( parentObject );
    }
    return null;
};

/**
 * Create occurrence alignment input
 *
 * @returns {Array} The list of alignment input object
 */
export let getOccAlignmentInput = function() {
    let alignmentInput = [];

    if( appCtxSvc.ctx && appCtxSvc.ctx.CBASrcContext && appCtxSvc.ctx.CBATrgContext ) {
        let sourceSelectedObjects = appCtxSvc.ctx.CBASrcContext.pwaSelection;
        let targetSelectedObjects = appCtxSvc.ctx.CBATrgContext.pwaSelection;
        if( sourceSelectedObjects && targetSelectedObjects ) {
            for( let sourceIndex = 0; sourceIndex < sourceSelectedObjects.length; ++sourceIndex ) {
                let sourceObj = sourceSelectedObjects[ sourceIndex ];

                for( let targetIndex = 0; targetIndex < targetSelectedObjects.length; ++targetIndex ) {
                    let targetObj = targetSelectedObjects[ targetIndex ];

                    let partDesOccAlignmentData = {};

                    partDesOccAlignmentData.designOccurrence = sourceObj;
                    partDesOccAlignmentData.partOccurrence = targetObj;

                    alignmentInput.push( partDesOccAlignmentData );
                }
            }
        }
    }
    return alignmentInput;
};

/**
 * Get occurrence unalignment input data for selected objects from either source or target
 *
 * @param {object} srcSelectedObjects - Selected objects from source structure from CBA UI
 * @param {object} trgSelectedObjects - Selected objects from target structure from CBA UI
 * @returns {object} Occurrence unalignment input data
 */
let _getOccUnAlignmentInput = function( srcSelectedObjects, trgSelectedObjects ) {
    let unAlignmentInput = [];
    let selectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC ) ? srcSelectedObjects : trgSelectedObjects;

    for( let index = 0; index < selectedObjects.length; ++index ) {
        let selectedObject = selectedObjects[ index ];
        let partDesOccUnAlignmentData = {};
        if( !appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC ) ) {
            partDesOccUnAlignmentData.partOccurrence = selectedObject;
            partDesOccUnAlignmentData.designContext = srcSelectedObjects[ 0 ];
        } else if( !appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG ) ) {
            partDesOccUnAlignmentData.designOccurrence = selectedObject;
            partDesOccUnAlignmentData.partContext = trgSelectedObjects[ 0 ];
        }
        unAlignmentInput.push( partDesOccUnAlignmentData );
    }
    return unAlignmentInput;
};

/**
 * Create occurrence unalignment input
 *
 * @returns {Array} The list of un-alignment input object
 */
export let getOccUnAlignmentInput = function() {
    let unAlignmentInput = [];
    let sourceSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SRC_SELECTED_OBJECTS );
    let targetSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_TRG_SELECTED_OBJECTS );

    let isSingleSelectionInSrc = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC );
    let isSingleSelectionInTrg = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG );

    if( sourceSelectedObjects && targetSelectedObjects ) {
        if( isSingleSelectionInSrc && isSingleSelectionInTrg ) {
            for( let sourceIndex = 0; sourceIndex < sourceSelectedObjects.length; ++sourceIndex ) {
                let sourceObj = sourceSelectedObjects[ sourceIndex ];
                for( let targetIndex = 0; targetIndex < targetSelectedObjects.length; ++targetIndex ) {
                    let targetObj = targetSelectedObjects[ targetIndex ];
                    let partDesOccUnAlignmentData = {};

                    partDesOccUnAlignmentData.designOccurrence = sourceObj;
                    partDesOccUnAlignmentData.partOccurrence = targetObj;

                    unAlignmentInput.push( partDesOccUnAlignmentData );
                }
            }
        } else {
            unAlignmentInput = _getOccUnAlignmentInput( sourceSelectedObjects, targetSelectedObjects );
        }
    }

    return unAlignmentInput;
};

/**
 * Creates input for unalignment confirmation message
 * @returns {string} Returns name of the object if there is a single selection on source or target else returns the count of selected objects
 */
export let getUnAlignmentConfirmationInput = function() {
    let unAlignConfirmationInput = [];
    let srcSelections = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SRC_SELECTED_OBJECTS );
    let trgSelections = appCtxSvc.getCtx( cbaConstants.CTX_PATH_TRG_SELECTED_OBJECTS );

    let isSingleSelectionInSrc = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC );
    let isSingleSelectionInTrg = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG );

    if( srcSelections && trgSelections ) {
        let sourceSelectedLength = srcSelections.length;
        let targetSelectedLength = trgSelections.length;

        if( isSingleSelectionInSrc && isSingleSelectionInTrg ) {
            if( sourceSelectedLength === 1 && targetSelectedLength === 1 ) {
                unAlignConfirmationInput.push( _getObjectName( srcSelections ) );
                unAlignConfirmationInput.push( _getObjectName( trgSelections ) );
            } else if( sourceSelectedLength > targetSelectedLength ) {
                unAlignConfirmationInput.push( sourceSelectedLength );
                unAlignConfirmationInput.push( _getObjectName( trgSelections ) );
            } else {
                unAlignConfirmationInput.push( _getObjectName( srcSelections ) );
                unAlignConfirmationInput.push( targetSelectedLength );
            }
        } else if( isSingleSelectionInSrc ) {
            unAlignConfirmationInput.push( sourceSelectedLength > 1 ? sourceSelectedLength : _getObjectName( srcSelections ) );
        } else {
            unAlignConfirmationInput.push( targetSelectedLength > 1 ? targetSelectedLength : _getObjectName( trgSelections ) );
        }
    }
    return unAlignConfirmationInput;
};

/**
 * Returns name of the selected object
 *
 * @param {object} selectedObject Selected Object
 * @returns {string} the object name
 */
let _getObjectName = function( selectedObject ) {
    let objectName;
    if( selectedObject ) {
        objectName = selectedObject[ 0 ].props.object_string.dbValues[ 0 ];
    }
    return objectName;
};

export let clearCbaContext = function() {
    return {
        srcStructure: '',
        trgStructure: '',
        isCBAFirstLaunch: false,
        ImpactAnalysis: {},
        linkedBOM: ''

    };
};
export let refreshCba = function( data, cbaContext ) {
    loadCBAData( cbaContext, data.eventData );
};

/**
 * Set ImpactAnalysisMode to true for guided update command
 * @param {object} commandContext Command context object
 * @param {object} selectedEcnUid selectedEcnUid
 *
 */
export let setImpactAnalysisMode = function( commandContext, selectedEcnUid ) {
    let impactAnalysis = {
        sourceTopItem:  cdmSvc.getObject( commandContext?.occContext?.topElement?.props?.awb0UnderlyingObject?.dbValues[0] ),
        alignedTargetProviderInECN: 'Pma1AlignedTargetProvider',
        ECNForImpactAnalysis: cdmSvc.getObject( selectedEcnUid ),
        selectedIANode : commandContext?.occContext?.pwaSelection[0],
        isImpactAnalysisMode: true
    };
    let valueToUpdate = {
        isImpactAnalysisMode: true,
        ImpactAnalysis: impactAnalysis,
        isGuidedUpdateLaunchFromCba: true
    };
    occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, commandContext?.cbaContext );
};

/**
 * Unset the impact analysis mode
 * Note : This method invokes when the guided update panel gets destroyed or closed
 * @param {object} commandContext commandContext
 */
export const unSetImpactAnalysisMode = function( commandContext ) {
    //If user performs guided update and clicks on back or navigate to any location then system should check IA mode
    //If IA mode is true then only system should reset the mode and navigate back to CBA else do nothing
    if( appCtxSvc.ctx.state.processed?.isIA_mode ) {
        let valueToUpdate = {
            isImpactAnalysisMode : false
        };
        let cbaContext = commandContext.cbaContext;
        occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, cbaContext );
        appCtxSvc.updatePartialCtx( 'cadbomalignment.ImpactAnalysis.isImpactAnalysisMode', false );

        if( !cbaContext.redLineMode.isChangeEnabled ) {
            cbaRedLineService.updateRedLineState( cbaContext.redLineMode.isChangeEnabled, cbaContext );
        }

        appCtxSvc.updatePartialCtx( 'state.params.ecn_uid', null );

        let transitionTo = 'CADBOMAlignment';
        let options = {};
        options.reload = false;
        let toParams = appCtxSvc.getCtx( 'state.params' );
        toParams.isIA_mode = false;

        LocationNavigationService.instance.go( transitionTo, toParams, options );
        eventBus.publish( 'cba.refreshTree' );

        CBAImpactAnalysisService.clearRestoreSavedSessionMode( cbaConstants.CBA_SRC_CONTEXT );
        CBAImpactAnalysisService.clearRestoreSavedSessionMode( cbaConstants.CBA_TRG_CONTEXT );
    }
};

/**
 * Auto update the findaligned indicator of aligned occurence after align operation
 *
 * @param {object} eventData align success event cache data
 */
export let autoUpdateAlignedIndicator = function() {
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckForegroundMode() ) {
        return;
    }

    let alignmentInput = getOccAlignmentInput();
    let targetMappingObject = {};
    let sourceMappingObject = {};
    let trgmappingUidsObj = [];

    if( alignmentInput ) {
        let alignmentInputCount = alignmentInput.length;
        for( let i = 0; i < alignmentInputCount; i++ ) {
            trgmappingUidsObj.push( alignmentInput[ i ].designOccurrence.uid );
        }
        targetMappingObject[ alignmentInput[ 0 ].partOccurrence.uid ] = {
            status: 4,
            mappingUids: trgmappingUidsObj
        };

        for( let i = 0; i < alignmentInputCount; i++ ) {
            sourceMappingObject[ alignmentInput[ i ].designOccurrence.uid ] = {
                status: 4,
                mappingUids: [ alignmentInput[ i ].partOccurrence.uid ]
            };
        }
    }

    let findAlignedInfo = {};
    findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT  ] = sourceMappingObject;
    findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ] = targetMappingObject;

    findAlignedInfo.clickEvent = EVENT_ALIGN_OBJECT;

    // TODO: We will change this code when restructure/refator alignment check node
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode() ) {
        let alignmentCheckInfo = cbaFindAlignedService.getUpdateAlignmentCheckInfo( findAlignedInfo );
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, alignmentCheckInfo );
        cbaFindAlignedService.notifyVMOPropertiesUpdated( { alignmentCheckInfo:alignmentCheckInfo } );
    } else{
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedInfo );
        cbaFindAlignedService.notifyVMOPropertiesUpdated( { findAlignedInfo:findAlignedInfo } );
    }
};

/**
 * Auto update the findaligned indicator of unaligned occurence after unalign operation
 *
 * @param {object} eventData Event Data
 *
 */
export let autoUpdateUnalignedIndicator = function( eventData ) {
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckForegroundMode() || eventData?.isUnAlignFailed ) {
        return;
    }

    //Get the object that will update the indicator from the findaligned response
    let findAlignedResponse = appCtxSvc.getCtx( 'cbaContext.findAlignedResponse' );

    //Confirm whether src or trg is selected
    let isSingleSelectionInTrg = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG );
    let isSingleSelectionInSrc = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC );
    let isRowSelectionInSrcAndTrg = isSingleSelectionInTrg && isSingleSelectionInSrc;

    let oneOfResponse = {};
    let findAlignedInfo = {};
    let srcContextTemp = {};
    let trgContextTemp = {};

    let unalignmentInputs = getOccUnAlignmentInput();
    let unalignmentInputsCount = unalignmentInputs.length;

    for( let unalignmentInputsIndex = 0; unalignmentInputsIndex < unalignmentInputsCount; unalignmentInputsIndex++ ) {
        //Take one from the findaligned response for separate processing
        oneOfResponse = findAlignedResponse[ unalignmentInputsIndex ];
        let processingResp = {};

        //Different processing is performed depending on whether only src is selected or only trg is selected
        if( isSingleSelectionInTrg ) {
            processingResp = cbaFindAlignedService.processFindAlignedResponse( oneOfResponse, cbaConstants.CBA_TRG_CONTEXT );
        } else{
            processingResp = cbaFindAlignedService.processFindAlignedResponse( oneOfResponse, cbaConstants.CBA_SRC_CONTEXT );
        }

        let objectsToFindCount = processingResp.objectsToFind.length;
        // If you are here that means Unalignment operation is successful
        // and if objectsToFindCount is EMPTY means it is case of UnAlignment under broken(Unaligned) node
        // Now if both side selection then use selected uids to update indicators
        // If single side selection then ????? Can we use updated uids

        //If the response currently being processed is successfully unaligned, continue to process the indicator, otherwise the indicator will not be updated
        if( !isRowSelectionInSrcAndTrg ) {
            if( objectsToFindCount > 0 ) {
                //If only select target or only select source
                findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ] = cadBomOccAlignmentCheckUtil.mergeAlingmentCheckCacheObjects( srcContextTemp, processingResp.findAlignedInfo.CBASrcContext );
                findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ] = cadBomOccAlignmentCheckUtil.mergeAlingmentCheckCacheObjects( trgContextTemp, processingResp.findAlignedInfo.CBATrgContext );

                //Assign the corresponding Indicator value according to the type of missing
                if( isSingleSelectionInTrg ) {
                    //The value '1' indicates the missing from Design; Value '3' indicates the missing from Part.
                    findAlignedInfo.CBATrgContext[ processingResp.sourceObject.uid ].status = 1;
                    for( let objectsToFindIndex = 0; objectsToFindIndex < objectsToFindCount; objectsToFindIndex++ ) {
                        findAlignedInfo.CBASrcContext[ processingResp.objectsToFind[ objectsToFindIndex ] ].status = 3;
                    }
                } else {
                    findAlignedInfo.CBASrcContext[ processingResp.sourceObject.uid ].status = 3;
                    for( let objectsToFindIndex = 0; objectsToFindIndex < objectsToFindCount; objectsToFindIndex++ ) {
                        findAlignedInfo.CBATrgContext[ processingResp.objectsToFind[ objectsToFindIndex ] ].status = 1;
                    }
                }
            } else {
                // get Uids from unalign response here
                let updatedUids = eventData?.objects;
                _.forEach( updatedUids, function( updatedUid ) {
                    if( _.includes( updatedUid, 'SR::N::Awb0DesignElement' ) ) {
                        srcContextTemp[ updatedUid ] = {
                            status: 3,
                            mappingUids: []
                        };
                    } else if( _.includes( updatedUid, 'SR::N::Awb0PartElement' ) ) {
                        trgContextTemp[ updatedUid ] = {
                            status: 1,
                            mappingUids: []
                        };
                    }
                    findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ] = srcContextTemp;
                    findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ] = trgContextTemp;
                } );
            }
        } else {
            //If both target and source are selected
            let sourceSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SRC_SELECTED_OBJECTS );
            let targetSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_TRG_SELECTED_OBJECTS );
            srcContextTemp[ sourceSelectedObjects[ 0 ].uid ] = {
                status: 3,
                mappingUids: [ targetSelectedObjects[ 0 ].uid ]
            };
            trgContextTemp[ targetSelectedObjects[ 0 ].uid ] = {
                status: 1,
                mappingUids: [ sourceSelectedObjects[ 0 ].uid ]
            };

            findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ] = srcContextTemp;
            findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ] = trgContextTemp;
        }
    }

    // TODO: We will change this code when restructure/refator alignment check node
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode() ) {
        let alignmentCheckInfo = cbaFindAlignedService.getUpdateAlignmentCheckInfo( findAlignedInfo );
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, alignmentCheckInfo );
        cbaFindAlignedService.notifyVMOPropertiesUpdated( { alignmentCheckInfo: alignmentCheckInfo } );
    } else {
        findAlignedInfo.clickEvent = EVENT_UNALIGN_OBJECT;
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedInfo );
        cbaFindAlignedService.notifyVMOPropertiesUpdated( { findAlignedInfo: findAlignedInfo } );
    }
};

/**
 * CAD-BOM Occurrence Alignment service
 */
const exports = {
    initializeServiceForCBA,
    populateConfigContextByPci,
    loadCBAData,
    launchCBA,
    getStateParams,
    getOccAlignmentInput,
    getOccUnAlignmentInput,
    getUnAlignmentConfirmationInput,
    getAlignedObject,
    clearCbaContext,
    refreshCba,
    setImpactAnalysisMode,
    unSetImpactAnalysisMode,
    getAlignedDesigns,
    getAlignedPartOccurrenceCsidChain,
    autoUpdateAlignedIndicator,
    autoUpdateUnalignedIndicator
};
export default exports;
