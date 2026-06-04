// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/* eslint-disable class-methods-use-this */

/**
 * Retrieve product structure information
 *
 * @module js/cadPageExpandRequest
 */

import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import logger from 'js/logger';
import pvwPSConverterService from 'js/pvwPSConverterService';
import pvwSinglePartConverterService from 'js/pvwSinglePartConverterService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import preferenceService from 'soa/preferenceService';
import pvwPSFromOccListConverterService from 'js/pvwPSFromOccListConverterService';
import cadPageRequestsUtils from 'js/cadPageRequestsUtils';
import fileManagementService from 'soa/fileManagementService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import viewerBomEventListenerService from 'js/viewerBomEventListenerService';

/**
 * Root csid
 */
const ROOT_CSID = '';

export class CadPageExpandRequest {
    /**
     * CadPageExpandRequest constructor
     *
     * @param {Function} bomlineProviderFn top bom line to be loaded
     * @param {Object} partViewerMO optional parameter that provides model object for part viewer
     * @param {Object} additionalSettings optional parameter to pass additional settings
     */
    constructor( bomlineProviderFn, partViewerMO, additionalSettings ) {
        if( !_.isFunction( bomlineProviderFn ) ) {
            throw Error( 'Fatal error : Invalid Bomline provider function.' );
        }
        this.bomlineProviderFn = bomlineProviderFn;
        this.partViewerMO = partViewerMO;
        this.enableChildrenThenDepthFirst = false;
        if( additionalSettings && !_.isNull( additionalSettings.enableChildrenThenDepthFirst ) && !_.isUndefined( additionalSettings.enableChildrenThenDepthFirst ) ) {
            this.enableChildrenThenDepthFirst = additionalSettings.enableChildrenThenDepthFirst;
        }
        this.topBOMLine = null;
        this.uidToCsidChainMap = new Map();
        this.psLoaderListeners = [];
        this.isWebWorkerEnabled = false;
        this.pageSize = 2000;
        this.deltaUpdateSupported = true;
    }

    /**
     * Add product structure load listener.
     *
     * @param {Object} psLoaderListener PS loader structure load listener
     */
    addProductStructureListener( psLoaderListener ) {
        if( !_.includes( this.psLoaderListeners, psLoaderListener ) ) {
            this.psLoaderListeners.push( psLoaderListener );
        }
    }

    /**
     * Remove product structure load listener.
     *
     * @param {Object} psLoaderListener PS loader structure load listener to be removed
     */
    removeProductStructureListener( psLoaderListener ) {
        const index = this.psLoaderListeners.indexOf( psLoaderListener );
        if( index > -1 ) {
            this.psLoaderListeners.splice( index, 1 );
        }
    }

    notifyProductStructureResultLoadedOnWorker( workerPort ) {
        _.forEach( this.psLoaderListeners, listener => {
            if( listener && typeof listener.onProductStructureResultLoadedOnWorker === 'function' ) {
                listener.onProductStructureResultLoadedOnWorker.call( listener, workerPort );
            } else {
                throw new Error( 'Expected onProductStructureResultLoadedOnWorker function not found on product structure builder' );
            }
        } );
    }

    notifyProductStructureResultLoaded( productStructureResult, isOneLevelExpand ) {
        _.forEach( this.psLoaderListeners, listener => {
            if( listener && typeof listener.onProductStructureResultLoaded === 'function' ) {
                listener.onProductStructureResultLoaded.call( listener, productStructureResult, isOneLevelExpand );
            } else {
                throw new Error( 'Expected onProductStructureResultLoaded function not found on product structure builder' );
            }
        } );
    }

    startPSConverterWorker( inputPS, isFinalResponse, numLinesLoaded, numLinesRemaining, isOneLevelExpand ) {
        let psResultWorker = null;
        if( window.SharedWorker && this.isWebWorkerEnabled ) {
            //Instance of the shared worker
            psResultWorker = pvwPSConverterService.getPVWProductStructureWorker();
        }
        if( psResultWorker ) {
            //const workerStartTime = window.performance.now();
            psResultWorker.port.postMessage( [ 'INIT', inputPS, this.uidToCsidChainMap, browserUtils.getBaseURL(), this.topBOMLine.uid, isFinalResponse, numLinesLoaded, numLinesRemaining ] );
            this.notifyProductStructureResultLoadedOnWorker( psResultWorker.port );
        } else {
            if( !window.SharedWorker ) {
                logger.info( 'Your browser doesn\'t support web workers. Calling converter on main thread.' );
            }
            let cadPageExpandResultInstance = pvwPSConverterService.processProductStructure(
                inputPS, this.uidToCsidChainMap, browserUtils.getBaseURL(), this.topBOMLine.uid, isFinalResponse, numLinesLoaded, numLinesRemaining );
            this.notifyProductStructureResultLoaded( cadPageExpandResultInstance, isOneLevelExpand );
        }
    }

    /**
     * Start loading single part
     *
     * @param {Object} singlePartMO input model object
     * @param {Object} imanFileUid ImanFile uid
     * @param {Object} jtFileTkt file url
     * @param {Boolean} isOneLevelExpand is one level expand
     */
    startSinglePartLoading( singlePartMO, imanFileUid, jtFileTkt, isOneLevelExpand ) {
        let singlePartResultInstance = pvwSinglePartConverterService.getCadPageExpandResultForSinglePartInstance( singlePartMO, imanFileUid, jtFileTkt, browserUtils.getBaseURL() );
        this.notifyProductStructureResultLoaded( singlePartResultInstance, isOneLevelExpand );
    }

    /**
     * Define the property policy for loading vis data
     *
     * @returns {Object} property policy object
     */
    static getVisPropertyPolicy() {
        return {
            useRefCount: false,
            types: [ {
                name: 'BOMLine',
                properties: [ {
                    name: 'bl_bomview_uid'
                },
                {
                    name: 'bl_occurrence_uid'
                },
                {
                    name: 'bl_clone_stable_occurrence_id'
                },
                {
                    name: 'bl_absocc_uid_in_topline_context'
                },
                {
                    name: 'bl_abs_occ_id'
                },
                {
                    name: 'bl_line_name'
                },
                {
                    name: 'bl_has_children'
                },
                {
                    name: 'bl_parent',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'bl_jt_override_children'
                },
                {
                    name: 'bl_is_occ_suppressed'
                },
                {
                    name: 'bl_revision'
                },
                {
                    name: 'fnd0RelativeTransform'
                },
                {
                    name: 'fnd0RelativeTransformOverride'
                },
                {
                    name: 'bl_bounding_boxes',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'bl_plmxml_def_occ_xform',
                    modifiers: [ {
                        name: 'excludeUiValues',
                        Value: 'true'
                    } ]
                }
                ]
            },
            {
                name: 'BOMWindow',
                properties: [ {
                    name: 'top_line',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'revision_rule'
                }
                ]
            },
            {
                name: 'ImanFile',
                properties: [ {
                    name: 'original_file_name'
                } ]
            }
            ]
        };
    }

    ensureSeedBOMLines( csids ) {
        if( !this.topBOMLine ) {
            return this.bomlineProviderFn( [ ROOT_CSID ] ).then( responseBomlineArray => {
                if( Array.isArray( responseBomlineArray ) && responseBomlineArray.length > 0 ) {
                    this.topBOMLine = responseBomlineArray[ 0 ];
                    this.registerForBomEventListener();
                    this.uidToCsidChainMap.set( this.topBOMLine.uid, ROOT_CSID );
                } else {
                    logger.error( 'Error while retrieving top bomline. Invalid response received.' );
                }
                return this.getSeedBOMLine( csids );
            } ).catch( error => {
                logger.error( 'Error while retrieving top bomline : ' + error );
            } );
        }
        if( !Array.isArray( csids ) || _.isEmpty( csids ) ) {
            logger.error( 'The csids array received to retrieve BOMLines is invalid.' );
            return AwPromiseService.instance.reject( 'The csids received to retrieve BOMLines is invalid.' );
        }
        return this.getSeedBOMLine( csids );
    }

    deregisterForBomEventListener() {
        if( this.deltaUpdateSupported && this.bomWindow ) {
            viewerBomEventListenerService.deregisterForBomEventListener( this.bomWindow );
        }
    }

    registerForBomEventListener() {
        if( this.topBOMLine && this.deltaUpdateSupported ) {
            viewerBomEventListenerService.getBomWindow( this.topBOMLine ).then( bomWindow => {
                this.bomWindow = bomWindow;
                viewerBomEventListenerService.registerForBomEventListener( this.bomWindow );
            } );
        }
    }

    getSeedBOMLine( csids ) {
        const returnPromise = AwPromiseService.instance.defer();
        this.getBomlinesForCsids( csids ).then( responseBomlineMap => {
            if( responseBomlineMap && responseBomlineMap.size > 0 ) {
                returnPromise.resolve( Array.from( responseBomlineMap.values() ) );
            } else {
                logger.error( 'Error while retrieving bomlines for given CSIDs. Invalid response received.' );
                returnPromise.resolve( [] );
            }
        } ).catch( error => {
            logger.error( 'Error while retrieving bomlines for given CSIDs : ' + error );
            returnPromise.reject( error );
        } );
        return returnPromise.promise;
    }

    /**
     * Get pruned product structure
     * @param {Array} csids - The csids for which product structure needs to be fetched
     */
    getPrunedProductStructure( csids, forceReloadData ) {
        const mapOfCsids = new Map();
        for( let i = 0; i < csids.length; i++ ) {
            mapOfCsids.set( i.toString(), csids[ i ] );
        }
        this.callExpandPSFromOccurrenceList2( mapOfCsids, forceReloadData ).then( response => {
            this.processPSFromOccList2Response( response );
        } ).catch( error => {
            logger.error( 'Error in getPrunedProductStructure : ' + error );
        } );
    }

    /**
     * Get pruned product structure
     * @param {Array} csids - The csids for which product structure needs to be fetched
     * @returns {Promise} A promise that resolves with Map
     */
    getBomlinesForCsids( csids ) {
        const mapOfCsids = new Map();
        for( let i = 0; i < csids.length; i++ ) {
            mapOfCsids.set( i.toString(), csids[ i ] );
        }
        return this.callExpandPSFromOccurrenceList2( mapOfCsids ).then( response => {
            let returnMap = new Map();
            if( response && Array.isArray( response.output ) ) {
                for( const responseEntry of response.output ) {
                    const entryKey = responseEntry.clientId;
                    if( Array.isArray( responseEntry.occurrenceList ) && responseEntry.occurrenceList.length > 0 ) {
                        if( entryKey !== 'CPLMExpandPSFromOccListResult' ) {
                            const csid = mapOfCsids.get( entryKey );
                            returnMap.set( csid, responseEntry.occurrenceList[ 0 ].parent.bomLine );
                        } else {
                            for( const childUnderOccurrence of responseEntry.occurrenceList ) {
                                if( Array.isArray( childUnderOccurrence.occurrenceList ) && childUnderOccurrence.occurrenceList.length > 0 ) {
                                    for( const loadedOcc of childUnderOccurrence.occurrenceList ) {
                                        const csidOfLoadedOcc = mapOfCsids.get( loadedOcc.clientId );
                                        if( childUnderOccurrence.parent && childUnderOccurrence.parent.bomLine ) {
                                            returnMap.set( csidOfLoadedOcc, childUnderOccurrence.parent.bomLine );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return returnMap;
        } ).catch( error => {
            logger.error( 'Error in getPrunedProductStructure : ' + error );
        } );
    }

    /**
     * call expandPSFromOccurrenceList2
     * @param {Map} csidMap - The csids for which product structure needs to be fetched. it should be a map of unique key vs csid chain.
     *                      The returned response has the key of map as client id to identify BOMLine
     * @returns {Promise} A response of expandPSFromOccurrenceList2 SOA call
     */
    callExpandPSFromOccurrenceList2( csidMap, forceReloadData ) {
        try {
            const processedCsids = new Map();
            for( const [ key, csid ] of csidMap ) {
                processedCsids.set( key, csid.endsWith( '/' ) ? csid.slice( 0, -1 ) : csid );
            }

            if( forceReloadData !== undefined && forceReloadData === true ) {
                // Remove all items except the root
                for( const [ key, value ] of this.uidToCsidChainMap ) {
                    if( value !== '' ) {
                        this.uidToCsidChainMap.delete( key );
                    }
                }
            }

            const csidMissingEntry = new Map();
            let infoInputArray = [];
            let missingCsidInputMap = new Map();
            let csidArr = Array.from( this.uidToCsidChainMap.values() );
            let sruidArr = Array.from( this.uidToCsidChainMap.keys() );

            for( const [ key, csidValue ] of processedCsids ) {
                let foundIndex = csidArr.indexOf( csidValue );
                if( foundIndex !== -1 ) {
                    let sruidKey = sruidArr[ foundIndex ];
                    infoInputArray.push( {
                        occurListClientId: key,
                        occurrenceChainsByParent: [ {
                            parentBomLine: {
                                uid: sruidKey,
                                type: 'BOMLine'
                            }
                        } ]
                    } );
                } else {
                    csidMissingEntry.set( key, csidValue );
                }
            }

            let addEntryToProcessedCsidMap = ( key, foundCsid, remainingCsidPath ) => {
                let foundIndex = csidArr.indexOf( foundCsid );
                let sruidKey = null;
                if( foundIndex !== -1 ) {
                    sruidKey = sruidArr[ foundIndex ];
                } else {
                    logger.error( 'Did not find SRUID in map for provided CSID.' );
                }

                if( missingCsidInputMap.has( sruidKey ) ) {
                    let existingVal = missingCsidInputMap.get( sruidKey );
                    if( Array.isArray( existingVal ) ) {
                        existingVal.push( { key: key, remainingPath: remainingCsidPath } );
                    }
                    missingCsidInputMap.set( sruidKey, existingVal );
                } else {
                    missingCsidInputMap.set( sruidKey, [ { key: key, remainingPath: remainingCsidPath } ] );
                }
            };

            for( const [ key, csidValue ] of csidMissingEntry ) {
                let lastCsidInChain = csidValue.lastIndexOf( '/' );
                let csidFirstPart = '';
                let csidLastPart = '';
                let keepProcessing = true;

                if( lastCsidInChain === -1 ) {
                    addEntryToProcessedCsidMap( key, '', csidValue );
                }

                while( lastCsidInChain !== -1 && keepProcessing ) {
                    csidFirstPart = csidValue.slice( 0, lastCsidInChain );
                    csidLastPart = csidValue.slice( lastCsidInChain + 1 );
                    if( csidArr.includes( csidFirstPart ) ) {
                        keepProcessing = false;
                        addEntryToProcessedCsidMap( key, csidFirstPart, csidLastPart );
                    } else {
                        lastCsidInChain = csidFirstPart.lastIndexOf( '/' );
                        if( lastCsidInChain === -1 ) {
                            addEntryToProcessedCsidMap( key, '', csidValue );
                        }
                    }
                }
            }

            Array.from( missingCsidInputMap.entries() ).forEach( ( [ sruid, remainingCSIDArray ] ) => {
                let occoccurrenceList = [];
                for( let i = 0; i < remainingCSIDArray.length; i++ ) {
                    occoccurrenceList.push( {
                        ngidClientId: remainingCSIDArray[ i ].key,
                        attributeNames: [ 'bl_clone_stable_occurrence_id' ],
                        occurrenceChainStr: [ remainingCSIDArray[ i ].remainingPath ]
                    } );
                }
                infoInputArray.push( {
                    occurListClientId: 'CPLMExpandPSFromOccListResult',
                    occurrenceChainsByParent: [ {
                        parentBomLine: {
                            uid: sruid,
                            type: 'BOMLine'
                        },
                        occurrenceList: occoccurrenceList

                    } ]
                } );
            } );

            const policyId = propPolicySvc.register( CadPageExpandRequest.getVisPropertyPolicy() );
            const soaInput = {
                info: infoInputArray,
                pref: {
                    prefKeyValue: {
                        wantDatasets: 'true',
                        wantPathToContextParentLine: 'true',
                        wantSiblings: 'false'
                    },
                    info: [ {
                        relationName: 'IMAN_Rendering',
                        namedRefHandler: 'PreferredJT',
                        relatedObjAndNamedRefs: [ {
                            relationTypeName: 'DirectModel',
                            namedReferenceNames: [ 'JTPART' ]
                        }

                        ]
                    } ]
                },
                additionalInfo: {
                    strToStringVectorMap: {
                        includeHiddenLinesByPacking: [ 'true' ],
                        includeExplodedLines: [ 'true' ]
                    }
                }
            };
            return soaSvc.post( 'Internal-Visualization-2020-12-StructureManagement', 'expandPSFromOccurrenceList2', soaInput ).then( response => {
                if( policyId ) {
                    propPolicySvc.unregister( policyId );
                }
                return response;
            } );
        } catch ( error ) {
            logger.error( 'Error while calling expandPSFromOccurrenceList2 : ' + error );
            return AwPromiseService.instance.reject( error );
        }
    }

    /**
     * Process response from expandPSFromOccurrenceList2 SOA
     * @param {Object} response response object from expandPSFromOccurrenceList2 SOA
     */
    processPSFromOccList2Response( response ) {
        let cadPageExpandResultInstance = pvwPSFromOccListConverterService.processProductStructureFromOccList(
            response, this.uidToCsidChainMap, browserUtils.getBaseURL(), this.topBOMLine.uid, true, 0, 0 );
        this.notifyProductStructureResultLoaded( cadPageExpandResultInstance );
    }

    /**
     * Expand product structure for visualization
     * *******We need to pass a context to be expanded. In ALL OFF case we may not want expand complete root.*******
     * @param {Array} csids - The csids to be expanded
     * @param {Boolean} expandOneLevel - Expand one level
     */
    getProductStructure( csids, expandOneLevel ) {
        try {
            if( this.partViewerMO ) {
                this.loadSinglePart().then( response => {
                    this.startSinglePartLoading( this.partViewerMO, response.imanFileUid, response.jtFileTkt, expandOneLevel );
                } ).catch( error => {
                    logger.error( 'Failed to load single part  : ' + error );
                } );
                return;
            }
            let betaPrefValue = preferenceService.getLoadedPrefs().AWC_visExposedBetaFeatures;
            if( betaPrefValue && Array.isArray( betaPrefValue ) && _.includes( betaPrefValue, 'enableWebWorker' ) ) {
                this.isWebWorkerEnabled = true;
            }
            _.forEach( betaPrefValue, value => {
                if( _.startsWith( value, 'psLoaderPageSize' ) ) {
                    let splitArr = _.split( value, '_' );
                    if( Array.isArray( splitArr ) && splitArr.length > 1 ) {
                        this.pageSize = parseInt( splitArr[ 1 ] );
                    }
                    return false;
                }
            } );
        } catch ( error ) {
            logger.error( 'Failed to read beta pref value  : ' + error );
        }
        const policyId = propPolicySvc.register( CadPageExpandRequest.getVisPropertyPolicy() );
        if( !Array.isArray( csids ) ) {
            csids = [ csids ];
        }
        this.ensureSeedBOMLines( csids ).then( seedElements => {
            let exSettings = {};
            exSettings.maxLevel = [ expandOneLevel ? '1' : '0' ];
            if( this.enableChildrenThenDepthFirst ) {
                exSettings.childrenThenDepthFirst = [ 'true' ];
            }
            const soaInput = {
                bomLines: seedElements,
                expandSettings: exSettings,
                pageSize: this.pageSize,
                expandOptions: {
                    dataSetInfoToLoad: [ {
                        relationName: 'IMAN_Rendering',
                        namedRefHandler: 3,
                        relatedObjAndNamedRefs: [ {
                            objectTypeName: 'DirectModel',
                            namedReferenceNames: [ 'JTPART' ]
                        } ]
                    } ],
                    additionalInfo: {
                        strMap: {
                            includeHiddenLinesByPacking: [ 'true' ],
                            includeExplodedLines: [ 'true' ]
                        }
                    }
                }
            };
            // Call SOA to start expansion of structure
            const startExpandSOAStartTime = window.performance.now();
            soaSvc.post( 'StructureManagement-2021-12-StructureSearch', 'startExpandBOMLines2', soaInput ).then( response => {
                const startExpandSOAEndTime = window.performance.now();
                //UnRegister Policy
                if( policyId ) {
                    propPolicySvc.unregister( policyId );
                }
                logger.info( 'Got first response in  : ' + ( startExpandSOAEndTime - startExpandSOAStartTime ) / 1000 + ' s' );
                if( response && Array.isArray( response.extraObjs ) && response.extraObjs.length === 0 && csids.length === 1 && csids[0] === ROOT_CSID ) {
                    logger.info( 'This is a single part case' );
                    let mselected = appCtxService.getCtx( 'mselected' );
                    if( Array.isArray( mselected ) && mselected.length > 0 ) {
                        let underlyingObjProp = mselected[ 0 ].props.awb0UnderlyingObject;
                        if( underlyingObjProp !== undefined && underlyingObjProp?.dbValues?.length ) {
                            this.partViewerMO = cdm.getObject( underlyingObjProp.dbValues[ 0 ] );
                        }
                    }
                    this.loadSinglePart().then( response => {
                        this.startSinglePartLoading( this.partViewerMO, response.imanFileUid, response.jtFileTkt, expandOneLevel );
                    } ).catch( error => {
                        logger.error( 'Failed to load single part  : ' + error );
                    } );
                    return;
                }
                this.processPSResponse( response, expandOneLevel );
            } );
        } ).catch( error => {
            logger.error( 'Error while calling startExpandBOMLines : ' + error );
        } );
    }

    /**
     * Expand product structure further for visualization
     *
     * @param {Object} currCursor current cursor object for fetching next set of results
     * @param {Boolean} isOneLevelExpand is one level expand
     * @returns {Promise} A promise that is resolved after expand structure is completed
     */
    nextProductStructure( currCursor, isOneLevelExpand ) {
        const policyId = propPolicySvc.register( CadPageExpandRequest.getVisPropertyPolicy() );
        const soaInput = {
            expandCursor: currCursor,
            pageSize: this.pageSize,
            expandOptions: {
                dataSetInfoToLoad: [ {
                    relationName: 'IMAN_Rendering',
                    namedRefHandler: 3,
                    relatedObjAndNamedRefs: [ {
                        objectTypeName: 'DirectModel',
                        namedReferenceNames: [ 'JTPART' ]
                    } ]
                } ],
                additionalInfo: {
                    strMap: {
                        includeHiddenLinesByPacking: [ 'true' ],
                        includeExplodedLines: [ 'true' ]
                    }
                }
            }
        };

        // Call SOA to get next set of expansion of structure
        const nextExpandSOAStartTime = window.performance.now();
        return soaSvc.post( 'StructureManagement-2021-12-StructureSearch', 'nextExpandBOMLines2', soaInput ).then( response => {
            const nextExpandSOAEndTime = window.performance.now();
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            logger.info( 'Got next response in  : ' + ( nextExpandSOAEndTime - nextExpandSOAStartTime ) / 1000 + ' s' );
            this.processPSResponse( response, isOneLevelExpand );
        } ).catch( error => {
            logger.error( 'Error while calling nextExpandBOMLines : ' + error );
        } );
    }

    /**
     * Process last response
     * @param {Object} response response object
     * @param {Boolean} isOneLevelExpand is one level expand
     *
     */
    processPSResponse( response, isOneLevelExpand ) {
        logger.info( 'Processing next response' );
        _.forEach( response.extraObjs, ( foundObject ) => {
            if( foundObject ) {
                if( foundObject.parentInfo && foundObject.parentInfo.bomLine ) {
                    this.addEntryToUidToCsidChainMap( foundObject.parentInfo.bomLine, response.ServiceData.modelObjects );
                }
                if( Array.isArray( foundObject.childrenInfo ) && foundObject.childrenInfo.length > 0 ) {
                    _.forEach( foundObject.childrenInfo, ( foundChildObject ) => {
                        this.addEntryToUidToCsidChainMap( foundChildObject.bomLine, response.ServiceData.modelObjects );
                    } );
                }
            }
        } );
        const isFinalResponse = response && response.expandCursor && response.expandCursor.type === 'unknownType';
        const numLinesLoaded = response && response.objectsDone ? response.objectsDone : 0;
        const numLinesRemaining = response && response.estimatedObjectsLeft ? response.estimatedObjectsLeft : 0;
        this.startPSConverterWorker( response, isFinalResponse, numLinesLoaded, numLinesRemaining, isOneLevelExpand );
        if( !isFinalResponse ) {
            this.nextProductStructure( response.expandCursor, isOneLevelExpand );
        } else {
            logger.info( 'PS loading completed' );
        }
    }

    /**
     * Process and add entry to uidToCsidChainMap
     * @param {Object} foundModelObject response object
     * @param {Object} responseModelObjects All returned model objects in response
     */
    addEntryToUidToCsidChainMap( foundModelObject, responseModelObjects ) {
        if( !this.uidToCsidChainMap.has( foundModelObject.uid ) ) {
            try {
                const csid_path = cadPageRequestsUtils.computeCsidPath( foundModelObject, responseModelObjects, this.topBomline, this.uidToCsidChainMap );
                if( csid_path && csid_path.length > 0 ) {
                    this.uidToCsidChainMap.set( foundModelObject.uid, csid_path );
                }
            } catch {
                error => {
                    logger.error( 'Could not compute csid for UID : ' + foundModelObject.uid );
                    logger.error( 'Error : ' + error );
                };
            }
        }
    }

    /**
     * notify product structure delta process is starting
     * @param {Object} deltaUpdateData delta update data
     */
    notifyProductStructurePreDelta() {
        _.forEach( this.psLoaderListeners, listener => {
            if( listener && typeof listener.onProductStructurePreDelta === 'function' ) {
                listener.onProductStructurePreDelta.call( listener );
            }
        } );
    }

    /**
     * notify product structure delta result loaded
     * @param {Object} deltaUpdateData delta update data
     * @returns {Promise} A promise that resolves when detla update finishes
     */
    notifyProductStructureDeltaResultLoaded( deltaUpdateData ) {
        const deltaPromiseArray = [];
        _.forEach( this.psLoaderListeners, listener => {
            if( listener && typeof listener.onProductStructureDeltaResultsLoaded === 'function' ) {
                deltaPromiseArray.push( listener.onProductStructureDeltaResultsLoaded( deltaUpdateData ) );
            } else {
                throw new Error( 'Expected onProductStructureDeltaResultLoaded function not found on product structure builder' );
            }
        } );
        return AwPromiseService.instance.all( deltaPromiseArray );
    }

    /**
     * Calls the Smart Discovery SOA used by MMV
     * @param {Object} policy property policy
     * @param {Array}  seqNumArray array of sequence numbers that relate to Smart Discovery Item paths
     * @returns {Promise} A promise that is resolved after the SOA call is completed
     */
    callConfigureItemPaths( policy, seqNumArray ) {
        const returnPromise = AwPromiseService.instance.defer();
        try {
            let body = {
                input: {
                    topBomline: this.topBOMLine,
                    itemPathIds: seqNumArray,
                    extraData: { getAdditionalOutOfSyncLines: 'true' }
                }
            };

            soaSvc.post( 'Internal-StructureManagement-2024-12-SmartDiscovery', 'configureItemPaths2', body, policy ).then( response => {
                returnPromise.resolve( response );
            } );
        } catch ( error ) {
            logger.error( 'SOA call to configureItemPaths failed  : ' + error );
            returnPromise.reject( error );
        }
        return returnPromise.promise;
    }

    /**
     * Verifies that topBOMLine is valid and then calls the Smart Discovery SOA used by MMV
     * @param {Object} policy property policy
     * @param {Array}  seqNumArray array of sequence numbers that relate to Smart Discovery Item paths
     * @returns {Promise} A promise that is resolved after the SOA call is completed
     */
    configureItemPaths( policy, seqNumArray ) {
        const returnPromise = AwPromiseService.instance.defer();
        try {
            if( this.topBOMLine !== null && this.topBOMLine !== undefined ) {
                this.callConfigureItemPaths( policy, seqNumArray ).then( function( response ) {
                    returnPromise.resolve( response );
                } );
            } else {
                let self = this;
                this.ensureSeedBOMLines( [ ROOT_CSID ] ).then( function( ) {
                    self.callConfigureItemPaths( policy, seqNumArray ).then( function( response ) {
                        returnPromise.resolve( response );
                    } );
                } );
            }
        } catch ( error ) {
            logger.error( 'SOA call to configureItemPaths failed  : ' + error );
            returnPromise.reject( error );
        }
        return returnPromise.promise;
    }

    /**
     * Calls the Smart Discovery SOA used by MMV
     * @param {Object} csuids - Find the item paths for the input csuids
     * @returns {Promise} A promise that is resolved after the SOA call is completed
     */
    getItemPathIds( csuids ) {
        const returnPromise = AwPromiseService.instance.defer();
        try {
            this.ensureSeedBOMLines( [ ROOT_CSID ] ).then( seedElements => {
                let bodyForSmartDiscovery = {
                    input: {
                        bomlines: [],
                        cloneStableIdChains: {
                            topBomline: this.topBOMLine,
                            cloneStableIdChains: csuids
                        }
                    }
                };

                soaSvc.post( 'Internal-StructureManagement-2024-06-SmartDiscovery', 'getItemPathIds', bodyForSmartDiscovery ).then( response => {
                    returnPromise.resolve( response );
                } );
            } );
        } catch ( error ) {
            logger.error( 'Failed to get item path for csuids: ' + error );
            returnPromise.reject( error );
        }
        return returnPromise.promise;
    }

    /**
     * Calls the Smart Discovery MMV SOA to get the flat buffer file
     * @returns {Promise} A promise that is resolved after the SOA call is completed
     */
    getSpatialReadTicket() {
        const returnPromise = AwPromiseService.instance.defer();
        try {
            this.ensureSeedBOMLines( [ ROOT_CSID ] ).then( seedElements => {
                let body = {
                    topBomline: this.topBOMLine
                };

                soaSvc.post( 'Internal-Mmv-2024-12-SmartDiscoverySpatialManagement', 'getSpatialReadTicket', body ).then( response => {
                    if( response.origFilename === '' && response.fMSRTicket === '' ) {
                        returnPromise.resolve();
                    } else if( response.fMSRTicket === '' ) {
                        if( response.origFilename === 'visview_base' || response.origFilename === 'visview_std' ) {
                            localeSvc.getTextPromise( 'Awv0threeDViewerMessages' ).then(
                                function( localTextBundle ) {
                                    msgSvc.showWarning( localTextBundle.mmvLicense );
                                    returnPromise.resolve();
                                } );
                        } else if( response.origFilename === 'visview_pro' || response.origFilename === 'visview_mockup' ) {
                            // Unable to check the pro or mockup license
                            localeSvc.getTextPromise( 'Awv0threeDViewerMessages' ).then(
                                function( localTextBundle ) {
                                    msgSvc.showWarning( localTextBundle.mmvLicenseVisCheckout );
                                    returnPromise.resolve();
                                } );
                        } else if( response.origFilename === 'vis_simp_rendering' ) {
                            // Unable to check the pro or mockup license
                            localeSvc.getTextPromise( 'Awv0threeDViewerMessages' ).then(
                                function( localTextBundle ) {
                                    msgSvc.showWarning( localTextBundle.mmvLicenseCheckout );
                                    returnPromise.resolve();
                                } );
                        } else {
                            // This shouldn't happen.  Adding for completeness
                            logger.error( 'Unknown MMV license error.' );
                            localeSvc.getTextPromise( 'Awv0threeDViewerMessages' ).then(
                                function( localTextBundle ) {
                                    msgSvc.showWarning( localTextBundle.mmvLicense );
                                    returnPromise.resolve();
                                } );
                        }
                    } else {
                        let downloadUri = 'fms/fmsdownload/' + response.origFilename + '?ticket=' + encodeURIComponent( response.fMSRTicket );

                        const xhr = new XMLHttpRequest();

                        xhr.onload = function() {
                            if( xhr.readyState === 4 && xhr.status === 200 ) {
                                try {
                                    returnPromise.resolve( xhr.response );
                                } catch ( e ) {
                                    returnPromise.reject( 'Failed: FMS download returned error ' + xhr.responseText );
                                }
                            } else {
                                returnPromise.reject( 'Failed: FMS download returned error status. Ready state = ' + xhr.readyState + '. Status = ' + xhr.status );
                            }
                        };

                        xhr.onerror = function() {
                            returnPromise.reject( 'Failed to get file' );
                        };

                        xhr.open( 'get', downloadUri, true );
                        xhr.responseType = 'arraybuffer';
                        xhr.send( null );
                    }
                } ).catch( error => {
                    logger.error( 'Unexpected error occured while trying to the get SD MMV flat buffer: ' + error );
                    returnPromise.resolve();
                } );
            } );
        } catch ( error ) {
            logger.error( 'Failed get SD MMV flat buffer: ' + error );
            returnPromise.reject( error );
        }
        return returnPromise.promise;
    }

    /**
     * Get uid to csid chain map
     * @returns {Map} uid to csid chain map
     */
    getUidToCsidChainMap() {
        return Object.freeze( this.uidToCsidChainMap );
    }

    /**
     * Update uid to csid chain map
     * @param {Map} newUidToCsidMap new uid to csid chain map
     */
    updateUidToCsidChainMap( newUidToCsidMap ) {
        newUidToCsidMap.forEach( ( value, key ) => {
            this.uidToCsidChainMap.set( key, value );
        } );
    }

    /**
     * Load single part
     */
    loadSinglePart() {
        if( this.partViewerMO && this.partViewerMO.modelType &&
            Array.isArray( this.partViewerMO.modelType.typeHierarchyArray ) &&
            this.partViewerMO.modelType.typeHierarchyArray.indexOf( 'DirectModel' ) > -1 ) {
            const refListModelObjects = cdm.getObjects( this.partViewerMO.props.ref_list.dbValues );
            return this.getTicketsForImanFiles( refListModelObjects ).then( ticketsResponse => {
                logger.debug( 'Got ticket : ' + ticketsResponse );
                if( ticketsResponse && Array.isArray( ticketsResponse.tickets ) && Array.isArray( ticketsResponse.tickets[ 1 ] ) ) {
                    const imanFileUid = ticketsResponse.tickets[ 0 ][ 0 ].uid;
                    const jtFileTkt = ticketsResponse.tickets[ 1 ][ 0 ];
                    return {
                        imanFileUid: imanFileUid,
                        jtFileTkt: jtFileTkt
                    };
                }
            } );
        }
        return this.getDatasetReferredByRenderingRelation().then( ( response ) => {
            if( Array.isArray( response.output ) && response.output[ 0 ] &&
                Array.isArray( response.output[ 0 ].relationshipData ) && response.output[ 0 ].relationshipData[ 0 ] &&
                Array.isArray( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) && response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ] &&
                response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject &&
                response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.props &&
                response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.props.ref_list &&
                Array.isArray( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.props.ref_list.dbValues ) &&
                response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.props.ref_list.dbValues[ 0 ]
            ) {
                const refListModelObjects = cdm.getObjects( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.props.ref_list.dbValues );
                return this.getTicketsForImanFiles( refListModelObjects ).then( ticketsResponse => {
                    logger.debug( 'Got ticket : ' + ticketsResponse );
                    if( ticketsResponse && Array.isArray( ticketsResponse.tickets ) && Array.isArray( ticketsResponse.tickets[ 1 ] ) ) {
                        const imanFileUid = ticketsResponse.tickets[ 0 ][ 0 ].uid;
                        const jtFileTkt = ticketsResponse.tickets[ 1 ][ 0 ];
                        return {
                            imanFileUid: imanFileUid,
                            jtFileTkt: jtFileTkt
                        };
                    }
                } );
            }
        } ).catch( ( error ) => {
            logger.error( 'failed to load relation : ' + error );
            throw 'Could not load single part';
        } );
    }

    /**
     * Load dataset referred by rendering relation
     */
    getDatasetReferredByRenderingRelation() {
        let inputData = {
            primaryObjects: [ this.partViewerMO ],
            pref: {
                expItemRev: false,
                returnRelations: false,
                info: [ {
                    relationTypeName: 'IMAN_Rendering',
                    otherSideObjectTypes: ''
                } ]
            }
        };

        return soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData );
    }

    /**
     * get tickets for ImanFiles
     * @param {Array} imanFileArr array of ImanFiles
     */
    getTicketsForImanFiles( imanFileArr ) {
        return fileManagementService.getFileReadTickets( imanFileArr );
    }

    /**
     * Sets delta update supported property
     * @param {Boolean} deltaUpdateSupported delta update supported
     */
    setDeltaUpdateSupported( deltaUpdateSupported ) {
        this.deltaUpdateSupported = deltaUpdateSupported;
    }

    /**
     * Gets delta update supported property
     */
    getDeltaUpdateSupported() {
        return this.deltaUpdateSupported;
    }
}
