/* eslint-disable complexity */
// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This module holds structure viewer 3D data
 *
 * @module js/structureViewerData
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import imgViewerExport from 'js/ImgViewer';
import logger from 'js/logger';
import awPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import StructureViewerSelectionHandler from 'js/structureViewerSelectionHandlerProvider';
import strViewerVisibilityHandlerPvd from 'js/structureViewerVisibilityHandlerProvider';
import StructureViewerService from 'js/structureViewerService';
import structurePartitionService from 'js/structurePartitionService';
import AwWindowService from 'js/awWindowService';
import AwTimeoutService from 'js/awTimeoutService';
import visLaunchInfoProvider from 'js/openInVisualizationProductContextInfoProvider';
import productLaunchInfoProviderService from 'js/productLaunchInfoProviderService';
import viewerPreferenceService from 'js/viewerPreference.service';
import { TracelinkSelectionHandler, TracelinkSelection } from 'js/tracelinkSelectionHandler';
import viewerCtxSvc from 'js/viewerContext.service';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import viewerPerformanceService from 'js/viewerPerformance.service';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import aceObjectsToPackedOccurrenceCSIDsService from 'js/aceObjectsToPackedOccurrenceCSIDsService';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';
import aceObjectToCSIDGeneratorService from 'js/aceObjectToCSIDGeneratorService';
import viewerSelectedBomlineInfoProvider from 'js/viewerSelectedBomlineInfoProvider';
import viewerOrientationService from 'js/viewerOrientationService';
import viewerContextService from 'js/viewerContext.service';
import StructureViewerBookmarkProvider from 'js/structureViewerBookmarkProvider';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';


export default class StructureViewerData {
    /**
     * StructureViewerData constructor
     * @param {Object} viewerContainerElement - The DOM element to contain the viewer canvas
     * @param {Object} occmgmtContextNameKey occmgmt context name key
     */
    constructor( viewerContainerElement, occmgmtContextNameKey ) {
        if( _.isNull( viewerContainerElement ) || _.isUndefined( viewerContainerElement ) ) {
            logger.error( 'Viewer container element can not be null' );
            throw 'Viewer container element can not be null';
        }
        if( _.isNull( occmgmtContextNameKey ) || _.isUndefined( occmgmtContextNameKey ) || _.isEmpty( occmgmtContextNameKey ) ) {
            logger.error( 'Occmgmt context key name can not be null' );
            throw 'Occmgmt context key name can not be null';
        }
        this.viewerContainerElement = viewerContainerElement;
        this.occmgmtContextNameKey = occmgmtContextNameKey;
        this.viewerImageCaptureContainer = null;
        this.viewerCtxData = null;
        this.viewerContext = null;
        this.structureViewerSelectionHandler = null;
        this.structureViewerVisibilityHandler = null;
        this.colorGroupingProperty = null;
        this.colorCriteria = [];
        this.ROOT_ID = '';
        this.structureConfiguration = null;
        this.viewerType = '';
        this.activePartitionSchemeUid = null;
        this.rootElementCsidChain = null;
        this.bomlineProviderFn = null;
        this.bomlineFromModelObjectFn = null;
        this.psLoader = null;
        this.getBackingObjectFn = null;
        this.csidToModelObjFn = null;
        this.sruidToModelObjFn = null;
        this.modelObjToCsidFn = null;
        this.modelObjToPackedOccCsidsFn = null;
        this.structureViewerSelectionHandlerFn = null;
        this.structureViewerVisibilityHandlerFn = null;
        this.structurePartitionHandler = null;
        this.skipPartitionsProcessing = false;
        this.appliedProductSnapshotUid = null;
        this.performContextCheckForCommonEvents = false;

        //Events subscriptions
        this.resizeTimeoutPromise = null;
        this.awGroupObjCategoryChangeEventListener = null;
        this.colorTogglingEventListener = null;
        this.mvProxySelectionChangedEventListener = null;
        this.aceTreeGridSelectionEvent = null;
        this.restoreActionListener = null;
        this.multiSelectIn3DListener = null;
        this.viewerPanelsToClose = [ 'Awv0CaptureGallery', 'Awv0GeometricAnalysisProximity',
            'Awv0GeometricAnalysisVolume'
        ];
        this.avoidSelectionProcessing = false;
        this.postGetOccFilterExtPoint = null;
    }

    /**
     *
     * Initialize 3D viewer.
     * @param {Object} subPanelContext Sub panel context
     * @param {Object} viewerAtomicData viewer Atomic data
     * @param {boolean} force3DViewerReload boolean indicating if 3D should be reloaded forcefully
     * @param {boolean} reloadSession boolean indicating if 3D session should be reloaded forcefully
     * @param {Object} additionalData additional data passed while intitializing viewer
     * @returns {Object} Object containing structure viewer instance
     */
    initialize3DViewer( subPanelContext, viewerAtomicData, force3DViewerReload, reloadSession, additionalData ) {
        this.processExternalConfiguration( subPanelContext );
        this.viewerAtomicData = viewerAtomicData;
        this.setViewerLoadingStatus( true );
        if( !force3DViewerReload ) {
            this.setIndexedPreference( subPanelContext.occContext, true );
        }
        if( subPanelContext && subPanelContext.performContextCheckForCommonEvents ) {
            this.performContextCheckForCommonEvents = subPanelContext.performContextCheckForCommonEvents;
        }
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( subPanelContext.occContext );
        let _isAppSessionBeingOpened = StructureViewerService.instance.isAppSessionBeingOpened( this.viewerContext );
        let _isViewerRestored = false;
        if( this.avoidSelectionProcessing ) {
            this.avoidSelectionProcessing = false;
        }
        return TracelinkSelectionHandler.instance.arePrefsFilled().then( () => {
            if( force3DViewerReload ||
                !_isAppSessionBeingOpened &&
                !StructureViewerService.instance.isSameProductOpenedAsPrevious( this.viewerContext, this.occmgmtContextNameKey ) ) {
                return StructureViewerService.instance.cleanUpPreviousView( this.occmgmtContextNameKey ).then( () => {
                    return viewerPreferenceService.getSelectionLimit( this.viewerCtxData ).then( ( selectionLimit ) => {
                        StructureViewerService.instance.removePciFromAceResetState( this.occmgmtContextNameKey );
                        return StructureViewerService.instance.getViewerLoadInputParameter( this.viewerContext,
                            this.compute3DViewerWidth(), this.compute3DViewerHeight(), this.isShowAll( subPanelContext ), null, subPanelContext.occContext, reloadSession,
                            selectionLimit, this.bookmarkProviderInstance );
                    } );
                } ).then( ( viewerLoadInputParams ) => {
                    if( !this._disableRenderingWhileLoading() ) {
                        this.viewerContainerElement.append( viewerLoadInputParams.getViewerContainer() );
                    }
                    if( subPanelContext.viewerSecurityMarkerHandlerFnKey ) {
                        viewerLoadInputParams.setSecurityMarkingHandlerKey( subPanelContext.viewerSecurityMarkerHandlerFnKey );
                    }
                    this.setupExternalConfiguration( viewerLoadInputParams );
                    viewerLoadInputParams.setViewerAtomicData( viewerAtomicData );
                    viewerLoadInputParams.setDeltaUpdateSupported( StructureViewerData.defaultIsApplyDeltaUpdate( subPanelContext.occContext ) );
                    viewerLoadInputParams.initializeViewerContext();
                    this.viewerCtxData = viewerLoadInputParams.getViewerContext();
                    this.registerForConnectionProblems();
                    return StructureViewerService.instance.getViewerView( viewerLoadInputParams, this.occmgmtContextNameKey );
                } ).then( ( viewerData ) => {
                    if( StructureViewerService.instance.hasAlternatePCI( StructureViewerService.instance.getViewerPCIToBeLoaded( subPanelContext.occContext ) ) ) {
                        viewerData[ 0 ].setHasAlternatePCI( true );
                    } else {
                        viewerData[ 0 ].setHasAlternatePCI( false );
                    }
                    return viewerData;
                } );
            }
            return StructureViewerService.instance.restorePreviousView( this.occmgmtContextNameKey, viewerAtomicData ).then( ( viewerData ) => {
                this.viewerCtxData = viewerData[ 0 ];
                if( !_isAppSessionBeingOpened && !this._disableRenderingWhileLoading() ) {
                    this.viewerContainerElement.append( viewerData[ 1 ] );
                }
                this.registerForConnectionProblems();
                this.postSplitViewViewerSetup( subPanelContext );
                if( !_isAppSessionBeingOpened ) {
                    AwTimeoutService.instance( function() {
                        this.updateViewerAtomicData( 'showViewerEmmProgress', false );
                    }.bind( this ), 500 );
                }
                _isViewerRestored = true;
                if( viewerContextService.isServerless() ) {
                    this.viewerCtxData.getPsLoader().registerForBomEventListener();
                    this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.AUTO_SAVE_VIS_BOOKMARK, 'start' );
                }
                return viewerData;
            } );
        } ).then( ( viewerData ) => {
            let occContext = appCtxSvc.getCtx( this.occmgmtContextNameKey );
            if( occContext?.currentState?.spageId !== 'Awv0StructureViewerPageContainer' &&
                        occContext?.currentState?.altPwa !== 'Awv0StructureViewerPageContainer' &&
                           occContext?.currentState?.altPwa_2 !== 'Awv0StructureViewerPageContainer'  ) {
                return;
            }
            this.viewerCtxData = viewerData[ 0 ];
            let isViewerSettingChangedOutside = false;
            this.isServerless = viewerContextService.isServerless();
            if( _isAppSessionBeingOpened ) {
                //while loading appsession just after creation disabled all commands with showing emm progress wheel.
                this.resetViewerAtomicData( true );
            } else {
                this.setupViewerContainer( viewerData[ 1 ] );
                this.postViewerLoadProcessing( subPanelContext );
                this.registerEvents( subPanelContext, additionalData );
                isViewerSettingChangedOutside = this.isViewerChangedOutside3DViewer( _isViewerRestored );
            }
            return {
                svInstance: this,
                isViewerSettingChangedOutside: isViewerSettingChangedOutside
            };
        } ).catch( ( error ) => {
            logger.error( 'Failed to load viewer : ' + error );
            this.viewerContainerElement.innerHTML = '';
            //if viewer fails in open or post processing  disabled all commands with hiding emm progress wheel.
            this.resetViewerAtomicData( false );
            return {
                svInstance: this,
                isViewerSettingChangedOutside: false
            };
        } );
    }

    /**
     * Disables autobookmark save in restored Left viewer when user enters split view.
     *
     */
    postSplitViewViewerSetup() {
        let splitViewCtx = appCtxSvc.getCtx( 'splitView' );
        if( splitViewCtx && splitViewCtx.mode ) {
            //disable bookmark for split view via EMM
            if( this.viewerCtxData.getSessionMgr() ) {
                this.viewerCtxData.getSessionMgr().disableBookmark( true );
            }
            //sets up half memory threshold for split view due to two viewers
            this.viewerCtxData.setMemoryThreshold( this.viewerCtxData.getMemoryThreshold() / 2 );
            //set viewer orientation in left view
            viewerOrientationService.setViewerOrientation( viewerPreferenceService.getViewerOrientation(), this.viewerCtxData );
        }
    }

    // eslint-disable-next-line class-methods-use-this
    isShowAll( subPanelContext ) {
        let isShowAll = true;
        let isRootLogical = TracelinkSelectionHandler.instance.isRootSelectionTracelinkType();
        if( isRootLogical ) {
            isShowAll = false;
        } else if( subPanelContext.hasOwnProperty( 'showGraphics' ) ) {
            isShowAll = subPanelContext.showGraphics;
        }
        return isShowAll;
    }

    /**
     * setup external configuration
     * @param {Object} viewerLoadInputParams viewer load input parameters
     */
    setupExternalConfiguration( viewerLoadInputParams ) {
        try {
            if( viewerContextService.isServerless() ) {
                viewerLoadInputParams.setBomlineProviderFn( this.bomlineProviderFn );
                if( this.psLoader ) {
                    viewerLoadInputParams.setPsLoader( this.psLoader );
                }
            }
        } catch ( error ) {
            logger.error( 'Error while setting external structure viewer configuration' + error );
        }
    }

    /**
     * Setup viewer containter on reload
     * @param {Array} viewerData viewer data
     */
    setupViewerContainer( viewerData ) {
        if( this._disableRenderingWhileLoading() ) {
            this.viewerContainerElement.append( viewerData );
        }
        this.viewerCtxData.setViewerContainerElement( this.viewerContainerElement );
    }

    /**
     * Register for various events
     * @param {Object} subPanelContext sub panel context
     * @param {Object} additionalData additional data
     */
    registerEvents( subPanelContext, additionalData ) {
        VisOccmgmtCommunicationService.instance.subscribe( this );
        if( !subPanelContext.isOutsideACE ) {
            this.setup3DViewerVisibilityHandler();
            let occContext = subPanelContext.occContext.getValue();
            this.setup3DViewerSelectionHandler( [ ...occContext.pwaSelection ], additionalData );
        }
        this.registerForResizeEvents();
        this.registerViewerForParentResize();
        this.registerForOther3ViewerEvents( subPanelContext );
        this.registerAsViewerLaunchInfoProvider();
        this.registerBomlineInfoProviderFn();
        this.setupAtomicDataTopics();
        StructureViewerService.instance.deregisterSessionSaveEvent();
        StructureViewerService.instance.deregisterFilterReloadEvent();
    }

    /**
     * Post provessing after viewer loaded
     * @param {Object} subPanelContext sub panel context
     */
    postViewerLoadProcessing( subPanelContext ) {
        this.viewerCtxData.getSelectionManager().setSelectionEnabled( true );
        this.viewerCtxData.setCurrentProductContextInfo( this.viewerContext );
        this.viewerType = this.viewerCtxData.getViewerCtxNamespace();
        StructureViewerService.instance.setOccmgmtContextNameKeyOnViewerContext( this.viewerCtxData.getViewerCtxNamespace(), this.occmgmtContextNameKey );
        this.viewerCtxData.updateCurrentViewerProductContext( subPanelContext.occContext.topElement );
        this.structureConfiguration = this.getStructureConfiguration();
        this.setPartitionSchemeInViewerOnLoad( subPanelContext.occContext );
        let cachedPWAContentsReloadedEventData = VisOccmgmtCommunicationService.instance.getCachedPWAContentsReloadedEventData();
        if( cachedPWAContentsReloadedEventData !== null ) {
            this.handlePrimaryWorkAreaContentsReloadedEvent( cachedPWAContentsReloadedEventData );
        }
        this.setHostElement();
        const isMMVDataOpened = this.viewerCtxData.isMMVRendering();
        this.updateViewerAtomicData( viewerCtxSvc.VIEWER_IS_MMV_ENABLED_TOKEN, isMMVDataOpened );
        if( subPanelContext && subPanelContext.occContext && subPanelContext.occContext.currentState && subPanelContext.occContext.currentState.uid ) {
            StructureViewerService.instance.setHasDisclosureData( this.viewerCtxData.getViewerCtxNamespace(), subPanelContext.occContext.currentState.uid );
        }
        AwTimeoutService.instance( function() {
            this.set3DViewerSize();
        }.bind( this ) );
        if( this.launchSnapshotGalleyPanel ) {
            try {
                viewerCtxSvc.activateViewerCommandDialog( 'Awv0CaptureGallery', {
                    viewerContextData: this.viewerCtxData,
                    viewerAtomicData: this.viewerAtomicData,
                    ...subPanelContext
                }, false );
                this.launchSnapshotGalleyPanel = false;
            } catch {
                error => {
                    logger.error( 'Failed to open Gallery : ' + error );
                };
            }
        }
        this.setViewerLoadingStatus( false );
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.setViewerPerformanceMode( false );
        }
        if( this.viewerCtxData.getMotionManager() ) {
            this.viewerCtxData.getMotionManager().restoreExplodedViewSlider();
        }
        viewerCtxSvc.setNXMouseGesture( this.viewerCtxData );
        if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService
            .VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, this.viewerCtxData ) ) {
            this.viewerCtxData.highlightPartsOnMouseHoverChanged( true );
        }
    }

    /**
     * Returns if viewer setting is changed outside
     * @param {boolean} _isViewerRestored boolean indicating if viewer is restored
     * @returns {boolean} boolean indicating if viewer setting is changed outside
     */
    // eslint-disable-next-line class-methods-use-this
    isViewerChangedOutside3DViewer( _isViewerRestored ) {
        let isViewerSettingChangedOutside = appCtxSvc.getCtx( 'viewer.viewerSettingChanged' );
        if( isViewerSettingChangedOutside && _isViewerRestored ) {
            appCtxSvc.updatePartialCtx( 'viewer.viewerSettingChanged', false );
        } else {
            isViewerSettingChangedOutside = false;
        }
        return isViewerSettingChangedOutside;
    }

    /**
     * This function reads the structure viewer custom configuration passed to it from wrapper component.
     * @param {Object} subPanelContext sub panel context
     */
    processExternalConfiguration( subPanelContext ) {
        if( subPanelContext && subPanelContext.structureViewerConfig ) {
            if( _.isFunction( subPanelContext.structureViewerConfig.getSelectionHandler ) ) {
                this.structureViewerSelectionHandlerFn = subPanelContext.structureViewerConfig.getSelectionHandler;
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.getVisibilityHandler ) ) {
                this.structureViewerVisibilityHandlerFn = subPanelContext.structureViewerConfig.getVisibilityHandler;
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.bomlineProviderFn ) ) {
                this.bomlineProviderFn = subPanelContext.structureViewerConfig.bomlineProviderFn;
            } else {
                this.bomlineProviderFn = StructureViewerData.defaultGetBomLinesFromCsids.bind( this );
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.bomlineFromModelObjectFn ) ) {
                this.bomlineFromModelObjectFn = subPanelContext.structureViewerConfig.bomlineFromModelObjectFn;
            } else {
                this.bomlineFromModelObjectFn = StructureViewerData.getBomLineObjectsFromSelectedModelObjects.bind( this );
            }

            if( subPanelContext.structureViewerConfig.psLoader ) {
                this.psLoader = subPanelContext.structureViewerConfig.psLoader;
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.getBackingObjectFn ) ) {
                this.getBackingObjectFn = subPanelContext.structureViewerConfig.getBackingObjectFn;
            } else {
                this.getBackingObjectFn = StructureViewerData.defaultGetBackingObjects.bind( this );
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.csidToModelObjFn ) ) {
                this.csidToModelObjFn = subPanelContext.structureViewerConfig.csidToModelObjFn;
            } else {
                this.csidToModelObjFn = StructureViewerData.defaultCsidToModelObject.bind( this );
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.sruidToModelObjFn ) ) {
                this.sruidToModelObjFn = subPanelContext.structureViewerConfig.sruidToModelObjFn;
            } else {
                this.sruidToModelObjFn = StructureViewerData.defaultSruidToModelObject.bind( this );
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.modelObjToCsidFn ) ) {
                this.modelObjToCsidFn = subPanelContext.structureViewerConfig.modelObjToCsidFn;
            } else {
                this.modelObjToCsidFn = StructureViewerData.defaultModelObjectToCsid.bind( this );
            }

            if( _.isFunction( subPanelContext.structureViewerConfig.modelObjToPackedOccCsidsFn ) ) {
                this.modelObjToPackedOccCsidsFn = subPanelContext.structureViewerConfig.modelObjToPackedOccCsidsFn;
            } else {
                this.modelObjToPackedOccCsidsFn = StructureViewerData.defaultModelObjectToPackedOccCsids.bind( this );
            }

            if( subPanelContext.structureViewerConfig.skipPartitionsProcessing === true ) {
                this.skipPartitionsProcessing = true;
            }

            if( !_.isBoolean( subPanelContext.structureViewerConfig.isDeltaUpdateApplicable ) ) {
                this.isDeltaUpdateApplicable = subPanelContext.structureViewerConfig.isDeltaUpdateApplicable;
            }

            if( subPanelContext.structureViewerConfig.bookmarkProviderInstance ) {
                this.bookmarkProviderInstance = subPanelContext.structureViewerConfig.bookmarkProviderInstance;
            } else {
                this.bookmarkProviderInstance = new StructureViewerBookmarkProvider();
            }
        } else {
            this.bomlineProviderFn = StructureViewerData.defaultGetBomLinesFromCsids.bind( this );
            this.bomlineFromModelObjectFn = StructureViewerData.getBomLineObjectsFromSelectedModelObjects.bind( this );
            this.getBackingObjectFn = StructureViewerData.defaultGetBackingObjects.bind( this );
            this.csidToModelObjFn = StructureViewerData.defaultCsidToModelObject.bind( this );
            this.sruidToModelObjFn = StructureViewerData.defaultSruidToModelObject.bind( this );
            this.modelObjToCsidFn = StructureViewerData.defaultModelObjectToCsid.bind( this );
            this.modelObjToPackedOccCsidsFn = StructureViewerData.defaultModelObjectToPackedOccCsids.bind( this );
            this.bookmarkProviderInstance = new StructureViewerBookmarkProvider();
            this.registerPostGetOcc4StructureViewerExtension();
        }
    }


    registerPostGetOcc4StructureViewerExtension() {
        // Post getOccurrences filter handler registration
        let postGetOccFilterConditionFunc = function( soaInput ) {
            if( soaInput && soaInput.inputData && soaInput.inputData.requestPref &&
                ( soaInput.inputData.requestPref.filterOrRecipeChange && soaInput.inputData.requestPref.filterOrRecipeChange[ 0 ] === 'true' ) ||
                soaInput.inputData.requestPref.filterChange && soaInput.inputData.requestPref.filterChange[ 0 ] === 'true' ||
                soaInput.inputData.requestPref.cbaAvoidSummaryLineSelectionProcessing &&
                soaInput.inputData.requestPref.cbaAvoidSummaryLineSelectionProcessing[ 0 ] === 'true' ) {
                // NOTE : cbaAvoidSummaryLineSelectionProcessing is added to avoid selection processing when summary line is selected in PWA
                return true;
            }
            return false;
        };
        let postGetOccFilterFunc = function( response, finalOccContextValue ) {
            if( finalOccContextValue && finalOccContextValue.viewKey === this.occmgmtContextNameKey ) {
                this.avoidSelectionProcessing = true;
            }
        };
        this.postGetOccFilterExtPoint = {
            key: 'structureViewerPostGetOccFilterHandler_' + Math.random().toString( 36 ), //unique identifier
            condition: postGetOccFilterConditionFunc,
            addOccContextAtomicDataForUpdate: postGetOccFilterFunc.bind( this )
        };
        aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( this.postGetOccFilterExtPoint );
    }

    unregisterPostGetOcc4StructureViewerExtension() {
        if( this.postGetOccFilterExtPoint ) {
            aceTreeLoadResultBuilderService.unregisterOccContextAtomicDataProvider( this.postGetOccFilterExtPoint );
            this.postGetOccFilterExtPoint = null;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _disableRenderingWhileLoading() {
        let betaPrefValues = viewerPreferenceService.getViewerBetaPref();
        return betaPrefValues && _.isArray( betaPrefValues ) && _.includes( betaPrefValues, 'disableRenderingWhileLoading' );
    }

    registerBomlineInfoProviderFn() {
        if( this.bomlineFromModelObjectFn && _.isFunction( this.bomlineFromModelObjectFn ) ) {
            viewerSelectedBomlineInfoProvider.registerBomlineInfoToSavePosition( this.bomlineFromModelObjectFn );
        }
    }

    static getBomLineObjectsFromSelectedModelObjects( viewerContextData, selectedModelObjects, selectedCsids ) {
        var returnPromise = AwPromiseService.instance.defer();
        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( viewerContextData.getViewerCtxNamespace() );
        var productCtx = occmgmtContext.productContextInfo;
        var packedOccPromise = aceObjectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences(
            productCtx, selectedModelObjects );

        if( !_.isUndefined( packedOccPromise ) ) {
            packedOccPromise.then( function( response ) {
                if( response.csids && response.csids.length > 1 ) {
                    //process the objects to get elements
                    csidsToObjSvc.doPerformSearchForProvidedCSIDChains( selectedCsids, 'true', {}, 'false' )
                        .then( ( csidMosResp ) => {
                            let elements = [];
                            _.forEach( csidMosResp.elementsInfo, function( e ) {
                                elements.push( e.element );
                            } );
                            returnPromise.resolve( aceBackingObjectProviderService.getBackingObjects( elements ) );
                        } );
                } else {
                    //send backing objects on selected model objects as no packed nodes exist
                    returnPromise.resolve( aceBackingObjectProviderService.getBackingObjects( selectedModelObjects ) );
                }
            } );
        } else {
            //send backing objects on selected model objects as no packed nodes exist
            returnPromise.resolve( aceBackingObjectProviderService.getBackingObjects( selectedModelObjects ) );
        }
        return returnPromise.promise;
    }

    /**
     * Register for viewer atomic data topics
     */
    setupAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.PVW_CONTEXT_MENU, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( this.viewerCtxData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_CREATE_SECTION_BEGIN, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_CREATE_MARKUP_BEGIN, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_CREATE_MARKUP_END, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.SECTION_PANEL_CLOSED, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_VOLUME_SELECT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( this.viewerCtxData.DELTA_UPDATE_COMPLETED, this );
    }

    /**
     * deregister for atomic data topics
     */
    unregisterAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.PVW_CONTEXT_MENU, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( this.viewerCtxData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_CREATE_SECTION_BEGIN, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_CREATE_MARKUP_BEGIN, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_CREATE_MARKUP_END, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.SECTION_PANEL_CLOSED, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_VOLUME_SELECT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( this.viewerCtxData.DELTA_UPDATE_COMPLETED, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE ) {
            this.displayImageCapture( data.fileUrl );
        } else if( topic === viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY ) {
            this.deactivateImageCaptureDisplayInView();
            this.viewerImageCaptureContainer = null;
        } else if( topic === viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT ) {
            StructureViewerService.instance.handleProductLaunchEvent( this.viewerCtxData, data );
        } else if( topic === viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK ) {
            this.saveVisAutoBookmark();
        } else if( topic === viewerCtxSvc.PVW_CONTEXT_MENU ) {
            this.updateViewerAtomicData( 'pvwContextMenuObject', data );
        } else if( topic === this.viewerCtxData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS ) {
            if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, this
                .viewerCtxData ) &&
                data && data.isActivated && ( data.commandId === '3dOnScreenStartMarkup' || data.commandId === 'Awv0MoveParts' || data.commandId === 'Awv0GeometricAnalysisQuery' || data.commandId ===
                    'Awv0GeometricAnalysisMeasure' ) ) {
                this.viewerCtxData.highlightPartsOnMouseHoverChanged( false );
            } else if( ( !data || !data.isActivated ) && this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' &&
                viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, this.viewerCtxData ) ) {
                this.viewerCtxData.highlightPartsOnMouseHoverChanged( true );
            }
        } else if( topic === viewerCtxSvc.VIEWER_CREATE_SECTION_BEGIN || topic === viewerCtxSvc.VIEWER_CREATE_MARKUP_BEGIN ) {
            if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, this
                .viewerCtxData ) ) {
                this.viewerCtxData.highlightPartsOnMouseHoverChanged( false );
            }
        } else if( topic === viewerCtxSvc.VIEWER_CREATE_MARKUP_END || topic === viewerCtxSvc.SECTION_PANEL_CLOSED ) {
            if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER, this
                .viewerCtxData ) ) {
                this.viewerCtxData.highlightPartsOnMouseHoverChanged( true );
            }
        } else if( topic === viewerCtxSvc.VIEWER_VOLUME_SELECT ) {
            if( data === false ) {
                if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER,
                    this.viewerCtxData ) ) {
                    this.viewerCtxData.highlightPartsOnMouseHoverChanged( true );
                }
            } else {
                if( this.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && viewerPreferenceService.getPreferenceValue( viewerPreferenceService.VIEWER_HIGHLIGHT_ON_MOUSE_HOVER,
                    this.viewerCtxData ) ) {
                    this.viewerCtxData.highlightPartsOnMouseHoverChanged( false );
                }
            }
        } else if( topic === this.viewerCtxData.DELTA_UPDATE_COMPLETED && data && data.viewToReact === this.occmgmtContextNameKey ) {
            this.doPostDeltaUpdateActions( [ ...data.pwaSelection ], data.additionalData, data.viewToReact );
        }
    }

    /**
     * Initializes Indexed/Non-Indexed Mode
     */
    setIndexedPreference( occmgmtContext, isInitilization ) {
        let uIds = StructureViewerService.instance.getPCIModelObject( occmgmtContext );
        if( !StructureViewerService.instance.isSameProductOpenedAsPrevious( uIds, this.occmgmtContextNameKey ) ) {
            let pciModelObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occmgmtContext );
            if( StructureViewerService.instance.hasAlternatePCI( pciModelObj ) ) {
                viewerPreferenceService.setUseAlternatePCIPreference( 'INDEXED', this.occmgmtContextNameKey, isInitilization );
            } else {
                viewerPreferenceService.setUseAlternatePCIPreference( 'NO_INDEXED', this.occmgmtContextNameKey, isInitilization );
            }
        }
    }

    /**
     * Returns the value for highlighted part name to be shown on hovering on part
     * @returns {String} part name for hovered part
     */
    updatePrehighlightedPartName() {
        return this.getValueOnViewerAtomicData( 'highlightedPartName' );
    }

    /**
     * Set 3d viewer loading status
     * @param {Boolean} isLoading is viewer loading
     */
    setViewerLoadingStatus( isLoading ) {
        this.isLoading = isLoading;
        this.updateViewerAtomicData( 'loadingViewer', isLoading );
    }

    /**
     * Register for viewer visibility events
     */
    registerForConnectionProblems() {
        this.viewerCtxData.addViewerConnectionProblemListener( this.handle3DViewerConnectionProblem, this );
    }

    /**
     * Handler for 3D viewer connection issues
     * @param {Object} viewerCtxDataRef - reference to viewer context data
     */
    handle3DViewerConnectionProblem() {
        this.notify3DViewerReload();
    }

    /**
     * Notify reset parameters  for 3D viewer reload
     */
    notifyResetParametersFor3DReload() {
        eventBus.publish( 'sv.resetParametersFor3DReload', { viewerContext: this.viewerCtxData.getViewerCtxNamespace() } );
    }

    /**
     * Notify 3D viewer reload event
     */
    async notify3DViewerReload( additionalData ) {
        if( this.isServerless && this.viewerCtxData.getSessionMgr() && !this.viewerCtxData.getSessionMgr().isAutoBookmarkDisabled() ) {
            await this.saveVisAutoBookmark();
        }
        eventBus.publish( 'sv.reload3DViewer', { viewerContext: this.viewerCtxData.getViewerCtxNamespace(), occmgmtContextNameKey: this.occmgmtContextNameKey, additionalData: additionalData } );
    }

    /**
     * Notify 3D viewer that the Show Suppressed option has been toggled
     */
    notify3DViewerShowSuppressed() {
        eventBus.publish( 'sv.toggleShowSuppressed3DViewer', { viewerContext: this.viewerCtxData.getViewerCtxNamespace() } );
    }

    /**
     * Notify 3D viewer reload for PCI change event
     */
    async notify3DViewerReloadForPCIChange() {
        if( this.isServerless && this.viewerCtxData.getSessionMgr() && !this.viewerCtxData.getSessionMgr().isAutoBookmarkDisabled() ) {
            await this.saveVisAutoBookmark();
        }
        let occmgmtCtx = appCtxSvc.getCtx( this.occmgmtContextNameKey );
        let reloadSession = occmgmtCtx.openedElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) !== -1;
        eventBus.publish( 'sv.reload3DViewerForPCI', { viewerContext: this.viewerCtxData.getViewerCtxNamespace(), reloadSession: reloadSession, occmgmtContextNameKey: this.occmgmtContextNameKey } );
    }

    /**
     * Notify display image capture
     * @param {Boolean} isShow - boolean indicating if image capture should be shown
     */
    notifyDisplayImageCapture( isShow ) {
        this.updateViewerAtomicData( 'displayImageCapture', isShow );
    }

    /**
     *
     * Reload 3D viewer.
     * @param {Object} subPanelContext Sub panel context
     * @param {Object} viewerAtomicData atomic data
     * @param {Object} additionalData additional data
     * @returns {Promise} promise resolves on reloading viewer
     */
    reload3DViewer( subPanelContext, viewerAtomicData, additionalData ) {
        if( this.getValueOnViewerAtomicData( 'loadingViewer' ) ) {
            return awPromiseService.instance.resolve( 'Already loading!' );
        }
        let self = this;
        this.notifyResetParametersFor3DReload();
        let currentlyInvisibleCsids = this.viewerCtxData.getVisibilityManager().getInvisibleCsids()
            .slice();
        let currentlyInvisibleExpCsids = this.viewerCtxData.getVisibilityManager()
            .getInvisibleExceptionCsids().slice();
        if( additionalData && Array.isArray( additionalData.itemsRemoved ) && additionalData.itemsRemoved.length > 0 ) {
            additionalData.itemsRemoved.forEach( itemRemoved => {
                currentlyInvisibleExpCsids = currentlyInvisibleExpCsids.filter( csid => {
                    return csid !== itemRemoved;
                } );
                currentlyInvisibleCsids = currentlyInvisibleCsids.filter( csid => {
                    return csid !== itemRemoved;
                } );
            } );
        }
        this.ctrlCleanup( true, subPanelContext );
        viewerPreferenceService.setEnableDrawingPref( false, this.viewerCtxData );
        return this.initialize3DViewer( subPanelContext, viewerAtomicData, true, null, additionalData ).then( () => {
            let restoreVisibilityPromise;
            const isSameProductOpned = StructureViewerService.instance.isSameProductOpenedInSplitView();
            if( currentlyInvisibleCsids.length === 0 && currentlyInvisibleExpCsids.length === 0 || !isSameProductOpned ) {
                restoreVisibilityPromise = awPromiseService.instance.resolve();
            } else {
                restoreVisibilityPromise = this.restoreVisibility( currentlyInvisibleCsids, currentlyInvisibleExpCsids, additionalData );
            }
            return restoreVisibilityPromise.then( function() {
                viewerPreferenceService.setEnableDrawingPref( true, self.viewerCtxData );
                if( self.viewerCtxData.getDrawManager() ) {
                    self.viewerCtxData.getDrawManager().enableDrawing( true );
                }
                self.structureViewerVisibilityHandler.viewerVisibilityChangedListener();
            } );
        } ).catch( ( error ) => {
            logger.error( 'Failed to load viewer : ' + error );
            return awPromiseService.instance.reject( error );
        } );
    }

    /**
     * Restore visibility
     * @param {Array} currentlyInvisibleCsids currently invisible csids
     * @param {Array} currentlyInvisibleExpCsids currently visible csids without root
     * @param {Object} additionalData additional data passed while triggering reload
     * @returns {Promise} Promise which resolve after restoring or skipping restore visibility in viewer
     */
    restoreVisibility( currentlyInvisibleCsids, currentlyInvisibleExpCsids, additionalData ) {
        let deferred = AwPromiseService.instance.defer();
        if( !additionalData || additionalData && !additionalData.skipRestoreVisibility ) {
            this.viewerCtxData.getVisibilityManager().restoreViewerVisibility( currentlyInvisibleCsids, currentlyInvisibleExpCsids )
                .then( () => { deferred.resolve(); } )
                .catch( ( error ) => { deferred.reject( error ); } );
        } else {
            deferred.resolve();
        }
        return deferred.promise;
    }

    /**
     * Reload 3D viewer for PCI change.
     * @param {Object} subPanelContext Sub panel context
     * @param {Object} viewerAtomicData viewer atomic data
     * @param {Boolean} reloadSession is reloading session
     */
    reload3DViewerForPCIChange( subPanelContext, viewerAtomicData, reloadSession ) {
        if( this.isLoading ) {
            return;
        }
        this.notifyResetParametersFor3DReload();
        this.ctrlCleanup( true, subPanelContext );
        this.initialize3DViewer( subPanelContext, viewerAtomicData, true, reloadSession );
    }

    /**
     * Set 3d Viewer size
     */
    set3DViewerSize() {
        let self = this;
        if( this.resizeTimeoutPromise ) {
            AwTimeoutService.instance.cancel( this.resizeTimeoutPromise );
        }
        this.resizeTimeoutPromise = AwTimeoutService.instance( function() {
            self.resizeTimeoutPromise = null;
            self.viewerWidth = self.compute3DViewerWidth();
            self.viewerHeight = self.compute3DViewerHeight();
            self.viewerCtxData.setSize( self.viewerWidth, self.viewerHeight );
        }, 250 );
    }

    /**
     * Register for viewer resize events
     */
    registerViewerForParentResize() {
        let self = this;
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        const ContentResizeObserver = window.ResizeObserver;
        if( ContentResizeObserver && currElement ) {
            self.divResizeobserver = new ContentResizeObserver( () => {
                self.set3DViewerSize();
            } );
            self.divResizeobserver.observe( currElement );
        }
    }

    /**
     * Compute 3D viewer height
     */
    compute3DViewerHeight() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        if( currElement ) {
            return currElement.clientHeight;
        }
    }

    /**
     * Compute 3D viewer width
     */
    compute3DViewerWidth() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        if( currElement ) {
            return currElement.clientWidth;
        }
    }

    /**
     * Setup 3D viewer visibility handler
     */
    setup3DViewerVisibilityHandler() {
        if( this.structureViewerVisibilityHandler === null ) {
            if( _.isFunction( this.structureViewerVisibilityHandlerFn ) ) {
                this.structureViewerVisibilityHandler = this.structureViewerVisibilityHandlerFn(
                    this.viewerCtxData, this.csidToModelObjFn, this.sruidToModelObjFn, this.modelObjToCsidFn, this.modelObjToPackedOccCsidsFn, this.getBackingObjectFn, this
                        .structurePartitionHandler );
            } else {
                this.structureViewerVisibilityHandler = strViewerVisibilityHandlerPvd.getStructureViewerVisibilityHandler(
                    this.viewerCtxData, this.csidToModelObjFn, this.sruidToModelObjFn, this.modelObjToCsidFn, this.modelObjToPackedOccCsidsFn, this.getBackingObjectFn, this
                        .structurePartitionHandler );
            }
            this.structureViewerVisibilityHandler.registerForVisibilityEvents( this.occmgmtContextNameKey );
        }
        if( !appCtxSvc.getCtx( 'splitView.mode' ) ) {
            let visibilityStateToBeApplied = VisOccmgmtCommunicationService.instance.getVisibilityStateFromExistingObserver();
            if( visibilityStateToBeApplied ) {
                let visibilityMgr = this.viewerCtxData.getVisibilityManager();
                if( visibilityStateToBeApplied?.invisibleExceptionCsids?.length > 0 || visibilityStateToBeApplied?.invisibleCsids?.length > 0
                    || visibilityStateToBeApplied?.invisiblePartitionIds?.length > 0 || visibilityStateToBeApplied?.invisibleExceptionPartitionIds?.length > 0 ) {
                    visibilityMgr.restoreViewerVisibility( visibilityStateToBeApplied.invisibleCsids, visibilityStateToBeApplied.invisibleExceptionCsids,
                        visibilityStateToBeApplied.invisiblePartitionIds, visibilityStateToBeApplied.invisibleExceptionPartitionIds );
                }
            }
        }
    }

    /**
     * Handle selection data change
     * @param {Object} subPanelCtx selection list
     */
    handleSelectionChange( subPanelCtx ) {
        if( this && this.structureViewerSelectionHandler && !this.avoidSelectionProcessing ) {
            this.structureViewerSelectionHandler.handleSelectionChange( subPanelCtx );
        }
    }

    /**
     * Handle pack unpack event
     * @param {Object} eventData event data from pack unpack event
     */
    handlePackUnpackEvent( eventData ) {
        if( eventData && eventData.occContext ) {
            this.structureViewerSelectionHandler.onPackUnpackOperation( eventData );
        } else {
            AwTimeoutService.instance( () => {
                this.structureViewerSelectionHandler.onPackUnpackOperation( eventData );
            }, 2000 );
        }
    }

    /**
     * Apply Delta update
     * @param {Object} newProductCtxUid uid of new product context in case of product context changed; its optional parameter applicable when product context is changed
     * @returns {Promise} promise resolves on applying delta update
     */
    applyDeltaUpdate( newProductCtxUid ) {
        let dynamicUpdateMgr = this.viewerCtxData.getDynamicUpdateMgr();
        if( dynamicUpdateMgr ) {
            return dynamicUpdateMgr.doDynamicUpdate( newProductCtxUid ).then( () => {
                if( newProductCtxUid ) { //check to avpid duplicate call
                    this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.DELTA_UPDATE_COMPLETED );
                }
            } );
        }
        return null;
    }

    /**
     * handle primary work area content full reload
     */
    handlePrimaryWorkAreaContentsFullReloadedEvent() {
        let startReconfigureProcess = this.getValueOnViewerAtomicData( 'startReconfigureProcess' );
        startReconfigureProcess = _.isUndefined( startReconfigureProcess ) ? true : !startReconfigureProcess;
        this.updateViewerAtomicData( 'startReconfigureProcess', startReconfigureProcess );
    }

    /**
     * handle primary work area content reload event
     * @param {Object} eventData event data
     */
    handlePrimaryWorkAreaContentsReloadedEvent( eventData ) {
        let aceContext = appCtxSvc.getCtx( eventData.viewToReact );
        if( !StructureViewerService.instance.isPartElementBeingOpened( aceContext ) ) {
            return;
        }
        if( this.isLoading || eventData.skipDeltaUpdate ) {
            //Abort and reload
            this.notify3DViewerReload();
            return;
        }
        if( !StructureViewerData.defaultIsApplyDeltaUpdate( aceContext ) ) {
            this.notify3DViewerReload();
            return;
        }
        const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
        const isBOMWindowSharedInVis = this.viewerCtxData.getValueOnViewerAtomicData( 'isBOMWindowShared' ) === true;
        if( !isWindowNotReusedAceFlag && isBOMWindowSharedInVis ) {
            let aceContext = appCtxSvc.getCtx( eventData.viewToReact );
            //Delta update is not available if partition scheme change
            let activePartitionSchemeUid = StructureViewerData.getPartitionScheme( aceContext );
            if( !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                if( activePartitionSchemeUid !== this.activePartitionSchemeUid ) {
                    this.notify3DViewerReload();
                    return;
                }
            }
            if( this.isServerless ) {
                this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.APPLY_DELTA_UPDATE, {
                    csidChainArray: [ this.rootElementCsidChain ],
                    pwaSelection: [ ...aceContext.pwaSelection ],
                    viewToReact: eventData.viewToReact
                } );
            } else {
                let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
                this.applyDeltaUpdate( newProductCtx.uid ).then( () => {
                    this.setup3DViewerSelectionHandler( [ ...aceContext.pwaSelection ] );
                } ).catch( ( error ) => {
                    logger.error( 'Failed to apply delta update : ' + error );
                    this.notify3DViewerReload();
                } );
            }
        } else {
            this.notify3DViewerReload();
        }
    }

    /**
     * handle CDM update event
     * @param {Object} eventData event data
     */
    handleCdmUpdatedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.modifiedObjects ) ) {
            for( let i = 0; i < eventData.modifiedObjects.length; i++ ) {
                let modifiedObj = eventData.modifiedObjects[ i ];
                if( modifiedObj.type === 'DirectModel' ) {
                    if( eventData.viewToReact ) {
                        this.applyDeltaUpdateOrFullReload( eventData );
                    } else {
                        this.notify3DViewerReload();
                    }
                    break;
                }
            }
        }
    }

    /**
     * handle CDM related modified event
     * @param {Object} eventData event data
     */
    handleCdmRelatedModifiedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.childObjects ) ) {
            for( let i = 0; i < eventData.childObjects.length; i++ ) {
                let childObj = eventData.childObjects[ i ];
                if( childObj.type === 'DirectModel' ) {
                    if( eventData.viewToReact ) {
                        this.applyDeltaUpdateOrFullReload( eventData );
                    } else {
                        this.notify3DViewerReload();
                    }
                    break;
                }
            }
        }
    }

    /**
     * Event handler for following events:
     * ace.elementsRemoved
     * replaceElement.elementReplacedSuccessfully
     * cba.alignmentUpdated
     * addElement.elementsAdded
     * @param {object} eventData event data
     */
    handleDeltaUpdateEvents( eventData ) {
        let skipContextCheck = eventData.skipContextCheck;
        if( this.performContextCheckForCommonEvents ) {
            skipContextCheck = false;
        }

        if( eventData && ( skipContextCheck || eventData.viewToReact && eventData.viewToReact === this.occmgmtContextNameKey ) && !eventData.willPCIChangePostRemoveAction ) {
            if( eventData.operationName === 'removeElement' && this.structureViewerSelectionHandler ) {
                // deselect the element we're removing before reloading the viewer
                this.structureViewerSelectionHandler.selectInViewer( [], [], [] );
            }
            let removedCsids = null;
            if( Array.isArray( eventData.removedObjects ) && eventData.removedObjects.length > 0 ) {
                removedCsids = eventData.removedObjects.map( removedObject => this.modelObjToCsidFn( removedObject ) );
            }
            let additionalData = { itemsRemoved: removedCsids, removedObjects: eventData.removedObjects };
            this.applyDeltaUpdateOrFullReload( eventData, additionalData );
        } else if( eventData && eventData.willPCIChangePostRemoveAction ) {
            this.removeElementActionCalled = true;
        }
    }

    /**
     * Apply delta update or full reload based on preferences
     * @param {Object} eventData event data
     * @param {Object} additionalData additional data
     */
    applyDeltaUpdateOrFullReload( eventData, additionalData ) {
        let aceContext = appCtxSvc.getCtx( eventData.viewToReact );
        if( eventData.skipDeltaUpdate || !StructureViewerData.defaultIsApplyDeltaUpdate( aceContext ) ) {
            this.notify3DViewerReload( additionalData );
        } else {
            const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
            const isBOMWindowSharedInVis = this.viewerCtxData.getValueOnViewerAtomicData( 'isBOMWindowShared' ) === true;
            if( !isWindowNotReusedAceFlag && isBOMWindowSharedInVis ) {
                if( additionalData && Array.isArray( additionalData.itemsRemoved ) && additionalData.itemsRemoved.length > 0 ) {
                    let currentlyInvisibleCsids = this.viewerCtxData.getVisibilityManager().getInvisibleCsids()
                        .slice();
                    let currentlyInvisibleExpCsids = this.viewerCtxData.getVisibilityManager()
                        .getInvisibleExceptionCsids().slice();
                    additionalData.itemsRemoved.forEach( itemRemoved => {
                        additionalData.currentlyInvisibleExpCsids = currentlyInvisibleExpCsids.filter( csid => {
                            return csid !== itemRemoved;
                        } );
                        additionalData.currentlyInvisibleCsids = currentlyInvisibleCsids.filter( csid => {
                            return csid !== itemRemoved;
                        } );
                    } );
                }
                if( this.isServerless ) {
                    this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.APPLY_DELTA_UPDATE, {
                        csidChainArray: [ this.rootElementCsidChain ],
                        pwaSelection: [ ...aceContext.pwaSelection ],
                        viewToReact: eventData.viewToReact,
                        additionalData: additionalData
                    } );
                } else {
                    let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
                    this.applyDeltaUpdate( newProductCtx.uid ).then( () => {
                        this.doPostDeltaUpdateActions( [ ...aceContext.pwaSelection ], additionalData, eventData.viewToReact );
                    } ).catch( ( error ) => {
                        logger.error( 'Failed to apply delta update : ' + error );
                        this.notify3DViewerReload( additionalData );
                    } );
                }
            } else {
                this.notify3DViewerReload( additionalData );
            }
        }
    }

    /***
     * Do post delta update actions of setting selection handler and restore visibility if needed
     * @param {Array} pwaSelection - primary owrk area selection
     * @param {Object} additionalData - additional data
     * @param {String} viewKey - view key
     */
    doPostDeltaUpdateActions( pwaSelection, additionalData, viewKey ) {
        this.setup3DViewerSelectionHandler( [ ...pwaSelection ] );
        if( additionalData && additionalData.currentlyInvisibleCsids && additionalData.currentlyInvisibleExpCsids && viewKey === this.occmgmtContextNameKey ) {
            this.viewerCtxData.getVisibilityManager().updateVisibleStateCache( additionalData.currentlyInvisibleCsids, additionalData.currentlyInvisibleExpCsids );
        }
    }

    /**
     * handle change of use indexed model settings event
     * @param {Object} eventData object containing which view should be reloaded
     */
    handleUseIndexedModelSettingsChangedEvent( eventData ) {
        if( eventData && eventData.viewToReact && eventData.viewToReact === this.occmgmtContextNameKey ) {
            this.notify3DViewerReloadForPCIChange();
        }
    }

    /**
     * handle get occurence visibilty event
     * @param {Object} object view model object or CSID Chain object
     * @param {string} objectType if object is a View Model Object then object type, if CSID Chain object then 'CSID_CHAIN'
     * @returns {Boolean} returns occurence visibility
     */
    handleGetOccVisibilty( object, objectType ) {
        if( this.structureViewerVisibilityHandler ) {
            return this.structureViewerVisibilityHandler.internalGetOccVisibility( object, objectType );
        }
    }

    /**
     * Toggle occurence visibility from ACE tree
     * @param {Object} eventData event data passed from tree
     */
    handleToggleOccVisibility( eventData ) {
        if( !( eventData && eventData.contextKey === this.occmgmtContextNameKey ) ) {
            return;
        }
        this.structureViewerVisibilityHandler.internalToggleOccVisibility( eventData );
    }

    /**
     * Handle visibility changes from other viewer
     * @param {Object} visibilityData visibility data
     */
    handleVisibilityChanges( visibilityData ) {
        this.structureViewerVisibilityHandler.internalHandleVisibilityChanges( visibilityData );
    }

    /**
     * Setup 3D viewer selection handler
     * @param {Object} selections - Array of selected model objects
     * @param {Object} additionalData additional data
     */
    setup3DViewerSelectionHandler( selections, additionalData ) {
        if( this.structureViewerSelectionHandler === null ) {
            if( _.isFunction( this.structureViewerSelectionHandlerFn ) ) {
                this.structureViewerSelectionHandler = this.structureViewerSelectionHandlerFn(
                    this.viewerCtxData, this.csidToModelObjFn, this.sruidToModelObjFn, this.modelObjToCsidFn, this.modelObjToPackedOccCsidsFn, this.getBackingObjectFn, this
                        .structurePartitionHandler );
            } else if( TracelinkSelectionHandler.instance.isRootSelectionTracelinkType() ) {
                this.structureViewerSelectionHandler = new TracelinkSelection(
                    this.viewerCtxData, this.csidToModelObjFn, this.sruidToModelObjFn, this.modelObjToCsidFn, this.modelObjToPackedOccCsidsFn, this.getBackingObjectFn, this
                        .structurePartitionHandler );
            } else {
                this.structureViewerSelectionHandler = new StructureViewerSelectionHandler(
                    this.viewerCtxData, this.csidToModelObjFn, this.sruidToModelObjFn, this.modelObjToCsidFn, this.modelObjToPackedOccCsidsFn, this.getBackingObjectFn, this
                        .structurePartitionHandler );
            }
            this.structureViewerSelectionHandler.registerForSelectionEvents();
        }
        if( selections && additionalData && Array.isArray( selections ) && Array.isArray( additionalData.removedObjects ) &&
            selections.length > 0 && additionalData.removedObjects.length > 0 ) {
            selections = _.remove( selections, function( selectedObject ) {
                for( var i = 0; i < additionalData.removedObjects.length; i++ ) {
                    if( selectedObject.uid === additionalData.removedObjects[ i ].uid ) {
                        return false;
                    }
                }
                return true;
            } );
        }
        if( !_.isNull( selections ) && !_.isUndefined( selections ) && !_.isEmpty( selections ) ) {
            let selectionType = this.structureViewerSelectionHandler.getSelectionType( selections );
            let partitionCsids = StructureViewerSelectionHandler.getPartitionCSIDs( selections );
            if( selectionType === 'OCC_SELECTED' ) {
                StructureViewerService.instance.ensureMandatoryPropertiesForCsidLoaded( selections ).then( () => {
                    let newlySelectedCsids = [];
                    for( let i = 0; i < selections.length; i++ ) {
                        if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                            newlySelectedCsids.push( this.modelObjToCsidFn( selections[ i ] ) );
                        }
                    }
                    let betaPrefValues = viewerPreferenceService.getViewerBetaPref();
                    let partitionsMembersPromise = AwPromiseService.instance.resolve();
                    if( _.includes( betaPrefValues, 'enableServerless' ) ) {
                        partitionsMembersPromise = this.structureViewerSelectionHandler.getPartitionMembers( selections );
                    }
                    partitionsMembersPromise.then( partitionsMembersArray => {
                        let partitionMemberCSIDArray = [];
                        if( Array.isArray( partitionsMembersArray ) && partitionsMembersArray.length > 0 ) {
                            _.forEach( partitionsMembersArray, partitionMember => {
                                partitionMemberCSIDArray.push( this.modelObjToCsidFn( partitionMember ) );
                            } );
                        }
                        this.structureViewerSelectionHandler.determineAndSelectPackedOccs( selections, newlySelectedCsids, partitionCsids, partitionsMembersArray,
                            partitionMemberCSIDArray );
                        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
                    } );
                } ).catch( function( error ) {
                    logger.error( 'SsructureViewerData : Failed to load mandatory properties to compute CSID : ' + error );
                } );
            } else if( selectionType === 'ROOT_PRODUCT_SELECTED' && this.viewerCtxData ) {
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsid( [] );
            }
        } else {
            let openedElement = appCtxSvc.getCtx( this.occmgmtContextNameKey ).openedElement;
            let topElement = appCtxSvc.getCtx( this.occmgmtContextNameKey ).topElement;
            if( openedElement.uid !== topElement.uid ) {
                let openedElementCsid = this.modelObjToCsidFn( openedElement );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [ openedElement ] );
                this.viewerCtxData.getSelectionManager().setContext( [ openedElementCsid ] );
            } else {
                this.viewerCtxData.getSelectionManager().setContext( [ this.ROOT_ID ] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsid( [] );
            }
            StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
        }
    }

    /**
     * Setup viewer image capture container
     */
    setupViewerImageCaptureContainer() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        _.forEach( currElement.children, ( child ) => {
            if( child.id === 'imageCaptureContainer' ) {
                this.viewerImageCaptureContainer = child;
                return false;
            }
        } );
    }

    /**
     * Register for 3D viewer long press
     */
    registerForLongPressIn3D() {
        this.viewerCtxData.addViewerLongPressListener( this.handle3DViewerLongPress, this );
    }

    /**
     * Handler for 3D viewer connection issues
     */
    handle3DViewerLongPress() {
        this.enableMultiSelectionInACEAnd3D();
    }

    /**
     * Enable multi-selection mode in 3D and ACE
     */
    enableMultiSelectionInACEAnd3D() {
        eventBus.publish( 'primaryWorkarea.multiSelectAction', { multiSelect: true } );
        this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( true );
        this.viewerCtxData.styleSelection( 'PartColor' );
        let currentlySelectedModelObjs = this.viewerCtxData.getSelectionManager().getSelectedModelObjects();
        let aceMultiSelectionEventData = {};
        if( _.isNull( currentlySelectedModelObjs ) || _.isUndefined( currentlySelectedModelObjs ) || _.isEmpty( currentlySelectedModelObjs ) ) {
            currentlySelectedModelObjs = [];
        }
        aceMultiSelectionEventData.elementsToSelect = currentlySelectedModelObjs;
        aceMultiSelectionEventData.multiSelect = true;
        eventBus.publish( 'aceElementsSelectedEvent', aceMultiSelectionEventData );
    }

    /**
     * Display image capture upon trigger of image capture event.
     *
     * @param {String} fileUrl - Image capture url.
     */
    displayImageCapture( fileUrl ) {
        if( fileUrl ) {
            this.notifyDisplayImageCapture( true );
            if( !this.viewerImageCaptureContainer ) {
                this.setupViewerImageCaptureContainer();
            }
            this.viewerImageCaptureContainer.innerHTML = '';
            let displayImgCaptureDiv = document.createElement( 'div' );
            displayImgCaptureDiv.id = 'awDisplayImageCapture';
            this.viewerImageCaptureContainer.appendChild( displayImgCaptureDiv );
            const imgViewer = imgViewerExport.newInstance( this.viewerImageCaptureContainer );
            this.viewerImageCaptureContainer.imgViewer = imgViewer;
            this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.IMAGE_CAPTURE_CONTAINER, this.viewerImageCaptureContainer );
            imgViewer.setImage( fileUrl );
        } else {
            logger.error( 'Failed to display image capture due to missing image url.' );
        }
    }

    /**
     * Deactivates the display if image capture in viewer upon deactivate image capture event.
     */
    deactivateImageCaptureDisplayInView() {
        this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.IMAGE_CAPTURE_CONTAINER, null );
        this.notifyDisplayImageCapture( false );
    }

    /**
     * Set property based coloring criteria for Viewer
     *
     * @param {Object} eventData Event data containing property matched values grouping proerty attribute
     */
    setPropertyBasedColoringCriteria( eventData ) {
        this.colorCriteria = eventData.propGroupingValues;
        this.colorGroupingProperty = eventData.internalPropertyNameToGroupOn;
        let colorPref = appCtxSvc.getCtx( 'preferences' ).AWC_ColorFiltering[ 0 ];
        if( colorPref === 'true' && this.viewerCtxData.getCriteriaColoringManager() ) {
            this.viewerCtxData.getCriteriaColoringManager().enableCriteriaColoring( this.colorGroupingProperty, this.colorCriteria );
        }
    }

    /**
     * Change color criteria state
     *
     * @param {Object} eventData Event data containing coloring criteria state.
     */
    changeColoringCriteriaState( eventData ) {
        var colorCriteriaState = eventData.dataVal;
        if( this.viewerCtxData.getCriteriaColoringManager() ) {
            if( colorCriteriaState === 'true' && this.colorCriteria !== null && this.colorGroupingProperty !== null ) {
                this.viewerCtxData.getCriteriaColoringManager().enableCriteriaColoring( this.colorGroupingProperty, this.colorCriteria );
            } else {
                this.viewerCtxData.getCriteriaColoringManager().disableCriteriaColoring();
            }
        }
    }

    /**
     * Model view proxy
     *
     * @param {Object} eventData Event data for model view proxy
     */
    applyModelViewProxy( eventData ) {
        if( this.viewerCtxData.getModelViewManager() && eventData && Array.isArray( eventData.selectedObjects ) && eventData.selectedObjects.length > 0 ) {
            this.viewerCtxData.getModelViewManager().invokeModelViewProxy( eventData.selectedObjects[ 0 ].props.fnd0DisclosedModelView.dbValues[ 0 ] );
        }
    }

    /**
     * Register for viewer resize events
     */
    registerForResizeEvents() {
        let self = this;
        // Handle Window resize event
        AwWindowService.instance.onresize = function() {
            eventBus.publish( 'viewer.setSize', {} );
        };
    }

    /**
     * Handle Product Context Changed Event
     * @param {Object} eventData event data
     */
    handleProductContextChangedFullReload( eventData ) {
        let isReload3DView = false;
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );

        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        if( !( !_.isUndefined( eventData.transientRequestPref ) && !_.isUndefined( eventData.transientRequestPref.reloadDependentTabs ) &&
                eventData.transientRequestPref.reloadDependentTabs === 'false' ) ) {
            const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
            if( newProductCtx && ( this.viewerContext.uid !== newProductCtx.uid || isWindowNotReusedAceFlag ) ) {
                isReload3DView = true;
            }
        }
        //always update viewerContext with new product context if PCI change event occurs.
        this.viewerContext = newProductCtx;
        this.viewerCtxData.setCurrentProductContextInfo( this.viewerContext );
        let snapshotUid = null;
        if( newProductCtx && newProductCtx.props.awb0Snapshot && _.isArray( newProductCtx.props.awb0Snapshot.dbValues ) && !_.isNull( newProductCtx.props.awb0Snapshot.dbValues[ 0 ] ) && !_.isUndefined( newProductCtx.props.awb0Snapshot.dbValues[ 0 ] ) && newProductCtx.props.awb0Snapshot.dbValues[ 0 ] !== '' ) {
            snapshotUid = newProductCtx.props.awb0Snapshot.dbValues[ 0 ];
            this._applyProductSnapshot( isReload3DView, snapshotUid, newProductCtx );
        } else {
            if( eventData.transientRequestPref && eventData.transientRequestPref.recipeReset === 'true' ) {
                isReload3DView = true;
            }
            if( aceContext && aceContext.sublocationAttributes && aceContext.sublocationAttributes.awb0ActiveSublocation &&
                ( aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === '3D' || aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === 'Awb0ViewerFeature' || ( aceContext.currentState
                    .altPwa === '"Awv0StructureViewerPageContainer"' || aceContext.currentState.altPwa_2 === '"Awv0StructureViewerPageContainer"' ) ) ) {
                isReload3DView = true;
            }
            let splitViewMode = false;
            if( appCtxSvc.getCtx( 'splitView' ) ) {
                splitViewMode = appCtxSvc.getCtx( 'splitView' ).mode;
            }
            if( this.shouldUpdateShowSuppressed() ) {
                // In the future, we want to notify3DViewerShowSuppressed, but due to
                // an issue with BOM that breaks reconfigure,
                // we will just ensured the viewer is reloaded when suppressed is toggled.
                isReload3DView = true;
            }

            if( isReload3DView || splitViewMode ) {
                if( this.viewerCtxData.getSnapshotManager() && aceContext.openedElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) !== -1 ) {
                    this.viewerCtxData.getSnapshotManager().getAllSnapshots().then( allVisSessionSnapshots => {
                        if( allVisSessionSnapshots && allVisSessionSnapshots.length > 0 ) {
                            msgSvc.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).appSessionConfigChangeWarningForVisSession );
                        }
                        this._disableBookmarkAndNotify3DViewerReload( eventData );
                    } ).catch( errorMsg => {
                        this._disableBookmarkAndNotify3DViewerReload( eventData );
                        logger.error( 'failed to get all vis session snapshots  :  ' + errorMsg );
                    } );
                } else {
                    this._disableBookmarkAndNotify3DViewerReload( eventData );
                }
            }else{
                this.setPartitionScheme( aceContext );
            }
        }
    }

    /**
     * Disables bookmark save if applicable
     * @param {Object} eventData eventData
     */
    _disableBookmarkAndNotify3DViewerReload( eventData ) {
        if( this.viewerCtxData.getSessionMgr() && eventData.transientRequestPref && eventData.transientRequestPref.restoreProduct === true ) {
            this.viewerCtxData.getSessionMgr().disableBookmark( true ).then( () => {
                this.notify3DViewerReloadForPCIChange();
            } ).catch( errorMsg => {
                this.notify3DViewerReloadForPCIChange();
                logger.error( 'failed to disable autobookmark  :  ' + errorMsg );
            } );
        } else {
            this.notify3DViewerReloadForPCIChange();
        }
    }

    handleProductSnapshotSelectionChange( eventData ) {
        if( !eventData || !eventData.snapshotUid || !eventData.productContextInfo ) {
            return;
        }
        const newAppliedSnapshotUid = eventData.snapshotUid;
        const newProductCtx = eventData.productContextInfo;
        if( this.viewerContext.props.awb0Product.uiValues[ 0 ] === newProductCtx.props.awb0Product.uiValues[ 0 ] ) {
            this.applyDeltaUpdate( newProductCtx.uid ).then( () => {
                this.viewerContext = newProductCtx; //update product context info for delta update usecases
                this._applyProductSnapshot( false, newAppliedSnapshotUid, newProductCtx, false ); //send reload as false as delta update is already applied and Do reconfigure as false
                return;
            } ).catch( ( error ) => {
                logger.error( 'Failed to apply delta update : ' + error );
                eventBus.publish( 'sv.reload3DViewerForPCI', {
                    viewerContext: this.viewerCtxData.getViewerCtxNamespace(),
                    reloadSession: false,
                    occmgmtContextNameKey: this
                        .occmgmtContextNameKey
                } );
                return;
            } );
        } else {
            eventBus.publish( 'sv.reload3DViewerForPCI', { viewerContext: this.viewerCtxData.getViewerCtxNamespace(), reloadSession: false, occmgmtContextNameKey: this.occmgmtContextNameKey } );
            return;
        }
    }

    /**
     * Handle Product Context Changed Event. Based on some configuration it call for delta update or forward to classical full reload way
     * @param {Object} eventData event data
     */
    handleProductContextChangedEvent( eventData ) {
        if( eventData && eventData.dataProviderActionType && ( eventData.dataProviderActionType === 'nextAction' || eventData.dataProviderActionType === 'focusAction' ) ) {
            return;
        }
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );
        if( this.viewerCtxData.isConnectionClosed() || eventData.dataProviderActionType === 'activateWindow' || this.occmgmtContextNameKey !== eventData.updatedView ) {
            return;
        }
        //reset flag on product context change event which will cover delta, lazy load scenario and full reload scenario
        if( this.avoidSelectionProcessing ) {
            this.avoidSelectionProcessing = false;
        }
        let isWorksetSelectionChanged = ( StructureViewerService.instance.isViewerOpenedForWorkset( this.occmgmtContextNameKey ) ||
        StructureViewerService.instance.isAppSessionOfFnd0Workset( this.occmgmtContextNameKey ) ) && eventData.dataProviderActionType === 'productChangedOnSelectionChange' && !this
            .removeElementActionCalled;
        if( this.removeElementActionCalled ) {
            this.removeElementActionCalled = false;
        }
        if( isWorksetSelectionChanged ) {
            return;
        }
        let checkIfResetWasPerformed = StructureViewerService.instance.checkIfResetWasPerformedOnPci( this.occmgmtContextNameKey );
        if( this.isLoading || checkIfResetWasPerformed || eventData.skipDeltaUpdate ) {
            let additionalData = {};
            if( checkIfResetWasPerformed ) {
                StructureViewerService.instance.removePciFromAceResetState( this.occmgmtContextNameKey );
                additionalData.skipRestoreVisibility = true;
            }
            //Abort and reload
            this.notify3DViewerReload( additionalData );
            return;
        }

        //update cached PCI when PCI is changed
        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        this.viewerCtxData.setCurrentProductContextInfo( newProductCtx );
        if( appCtxSvc.getCtx( 'splitView.viewKeys' ) ) {
            let sourceContextKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 0 ];
            let targetContextKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 1 ];
            if( eventData.updatedView === sourceContextKey ) {
                StructureViewerService.instance.setLastProductContextInfoObj( newProductCtx ); //updates last product context info object
            } else if( eventData.updatedView === targetContextKey ) {
                StructureViewerService.instance.setLastProductContextInfoObj2( newProductCtx ); //updates last product context info object for occmgmtContext2
            }
        } else if( eventData.updatedView === 'occmgmtContext' ) {
            StructureViewerService.instance.setLastProductContextInfoObj( newProductCtx ); //updates last product context info object
        }

        let newAppliedSnapshotUid = null;
        if( newProductCtx && newProductCtx.props && newProductCtx.props.awb0Snapshot &&
            newProductCtx.props.awb0Snapshot.dbValues && newProductCtx.props.awb0Snapshot.dbValues[ 0 ] !== '' ) {
            newAppliedSnapshotUid = newProductCtx.props.awb0Snapshot.dbValues[ 0 ];
        }
        if( !StructureViewerData.defaultIsApplyDeltaUpdate( aceContext ) ) { //if delta is not applicable then execute full reload logic
            this.handleProductContextChangedFullReload( eventData );
            return;
        }
        const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
        const isBOMWindowSharedInVis = this.viewerCtxData.getValueOnViewerAtomicData( 'isBOMWindowShared' ) === true;
        if( !isWindowNotReusedAceFlag && isBOMWindowSharedInVis ) {
            //if there is no snapshot applied before and new snapshot is applied
            //if new snapshot is applied and it is different from previous snapshot
            const isApplySnapshot = newAppliedSnapshotUid && !_.isString( this.appliedProductSnapshotUid ) || newAppliedSnapshotUid && newAppliedSnapshotUid !== this.appliedProductSnapshotUid;
            if( this.isServerless ) {
                let additionalInfo = {};
                if( isApplySnapshot ) {
                    additionalInfo = {
                        isApplySnapshot: true,
                        productContextInfo: newProductCtx
                    };
                }
                this.setPartitionSchemeInViewerOnLoad( aceContext );
                this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.APPLY_DELTA_UPDATE, {
                    csidChainArray: [ this.rootElementCsidChain ],
                    pwaSelection: aceContext.pwaSelection,
                    viewToReact: eventData.viewToReact,
                    additionalData: additionalInfo
                } );
            } else {
                return this.applyDeltaUpdate( newProductCtx.uid ).then( () => {
                    this.viewerContext = newProductCtx; //update product context info for delta update usecases
                    this.setPartitionScheme( aceContext );
                    this.setup3DViewerSelectionHandler( [ ...aceContext.pwaSelection ] );
                    if( isApplySnapshot ) {
                        this._applyProductSnapshot( false, newAppliedSnapshotUid, newProductCtx, false ); //send reload as false as delta update is already applied and Do reconfigure as false
                        return;
                    }
                    this.appliedProductSnapshotUid = null; //if configuration changed after snapshot applied then reset applied snapshot uid
                } ).catch( ( error ) => {
                    logger.error( 'Failed to apply delta update : ' + error );
                    this.handleProductContextChangedFullReload( eventData );
                } );
            }
        } else {
            this.handleProductContextChangedFullReload( eventData );
        }
    }

    /**
     * Register for ace related events
     * @param {Object} subPanelContext sub panel context
     */
    registerForOther3ViewerEvents( subPanelContext ) {
        if( this.awGroupObjCategoryChangeEventListener === null ) {
            this.awGroupObjCategoryChangeEventListener = eventBus.subscribe( 'ace.groupObjectCategoryChanged', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.setPropertyBasedColoringCriteria( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.colorTogglingEventListener === null ) {
            this.colorTogglingEventListener = eventBus.subscribe( 'aw.ColorFilteringToggleEvent', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.changeColoringCriteriaState( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.multiSelectIn3DListener === null ) {
            this.multiSelectIn3DListener = eventBus.subscribe( 'primaryWorkarea.multiSelectAction', function( eventData ) {
                if( eventData &&
                    eventData.scope &&
                    eventData.scope.commandContext &&
                    eventData.scope.commandContext.occContext &&
                    eventData.scope.commandContext.occContext.viewKey === this.occmgmtContextNameKey ) {
                    this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( eventData.multiSelect );
                    this.viewerCtxData.styleSelection( 'PartColor' );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.mvProxySelectionChangedEventListener === null ) {
            this.mvProxySelectionChangedEventListener = eventBus.subscribe( 'mvProxyDataProvider.selectionChangeEvent', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.applyModelViewProxy( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.aceTreeGridSelectionEvent === null ) {
            this.aceTreeGridSelectionEvent = eventBus.subscribe( subPanelContext.gridId + '.gridSelection', () => {
                this.updateViewerAtomicData( 'aceTreeGridSelection', true );
            }, 'structureViewerData' );
        }
    }

    /**
     * Update view to display only search items to display
     */
    showOnlyInViewer( occContext ) {
        var showOnlyInViewer = occContext.searchCriteriaForViewer ? occContext.searchCriteriaForViewer.showOnlyInViewer : false;
        if( showOnlyInViewer && occContext.searchCriteriaForViewer.activeContext === this.occmgmtContextNameKey ) {
            var searchCriteria = occContext.searchCriteriaForViewer.searchCriteria;
            let searchCriteriaJSON = JSON.stringify( searchCriteria );
            if( searchCriteriaJSON !== undefined && this.viewerCtxData.getSearchMgr() ) {
                this.viewerCtxData.getSearchMgr().performSearch( 'Awb0FullTextSearchProvider', searchCriteriaJSON, -1,
                    this.viewerCtxData.ViewerSearchActions.SET_VIEW_ONLY ).then( () => {
                    logger.debug( 'Structureviewer: Viewer Search operation completed' );
                } ).catch( ( error ) => {
                    logger.error( 'Structureviewer: Viewer Search operation failed:' + error );
                } );
            }
            occmgmtUtils.updateValueOnCtxOrState( 'searchCriteriaForViewer', { showOnlyInViewer: false }, occContext );
        }
    }

    /**
     * Registers Product Context launch api
     */
    registerAsViewerLaunchInfoProvider() {
        productLaunchInfoProviderService.setViewerContextData( this.viewerCtxData );
        visLaunchInfoProvider.registerProductContextToLaunchVis( productLaunchInfoProviderService.getProductToLaunchableOccMap );
    }

    /**
     * Set host element for CSR rendering of 3d Markups
     */
    setHostElement() {
        let self = this;
        if( self.viewerCtxData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && self.viewerCtxData.getViewerView().viewMarkupMgr ) {
            self.viewerCtxData.getViewerView().viewMarkupMgr.setHostElement( self.viewerContainerElement );
        }
    }

    /**
     * Set partition scheme in viewer after loading document
     * @param {Object} occContext - occmgmt context
     */
    setPartitionSchemeInViewerOnLoad( occContext ) {
        if( this.skipPartitionsProcessing ) {
            return;
        }

        let rootElement = occContext.rootElement ? occContext.rootElement : occContext.topElement;
        rootElement = rootElement ? rootElement : occContext.openedElement;
        let rootElementCsidChain = this.modelObjToCsidFn( rootElement );
        this.rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;

        let betaPrefValues = viewerPreferenceService.getViewerBetaPref();
        if( _.includes( betaPrefValues, 'enableServerless' ) ) {
            let rootElementBackingObject = this.getBackingObjectFn( [ rootElement ] );
            if( _.isNull( this.structurePartitionHandler ) ) {
                this.structurePartitionHandler = structurePartitionService.getPartitionsDataForTopLine( rootElementBackingObject[ 0 ] );
            }
            this.structurePartitionHandler.getPartitionsHierarchy().then( () => {
                if( occContext && occContext.pwaSelection && occContext.pwaSelection.length > 0 ) {
                    this.setup3DViewerSelectionHandler( [ ...occContext.pwaSelection ] );
                }
            } );
        }
        if( occContext && occContext.elementToPCIMap && Object.keys( occContext.elementToPCIMap ).length > 0 && this.viewerCtxData.getPartitionMgr() ) {
            let showWorksetUnsupportedWarning = false;
            if( StructureViewerService.instance.isViewerOpenedForWorkset( occContext.key ) && !viewerPreferenceService.getPreferenceValue( viewerPreferenceService.ALL_ON, this.viewerCtxData ) ) {
                showWorksetUnsupportedWarning = true;
            }
            let listOfModelObjUids = Object.keys( occContext.elementToPCIMap );
            let listOfModelObjects = listOfModelObjUids.map( ( uid ) => cdm.getObject( uid ) );
            let listOfPCIObjUids = Object.values( occContext.elementToPCIMap );
            let listOfPCIObjects = listOfPCIObjUids.map( ( uid ) => cdm.getObject( uid ) );
            for( let i = 0; i < listOfModelObjUids.length; i++ ) {
                let rootElementCsidChain = this.modelObjToCsidFn( listOfModelObjects[ i ] );
                if( listOfPCIObjects[ i ] && listOfPCIObjects[ i ].props && listOfPCIObjects[ i ].props.fgf0PartitionScheme && Array.isArray( listOfPCIObjects[ i ].props.fgf0PartitionScheme
                    .dbValues ) &&
                    listOfPCIObjects[ i ].props.fgf0PartitionScheme.dbValues.length > 0 ) {
                    let activePartitionSchemeUid = listOfPCIObjects[ i ].props.fgf0PartitionScheme.dbValues[ 0 ];
                    if( rootElementCsidChain !== '' && !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                        rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;
                        if( showWorksetUnsupportedWarning ) {
                            msgSvc.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).WorksetPartitionAllOnUnsupportedWarning );
                        }
                        if( rootElementCsidChain === this.rootElementCsidChain ) {
                            this.activePartitionSchemeUid = activePartitionSchemeUid;//set current active partition scheme uid for current root element
                        }
                        this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, activePartitionSchemeUid );
                    }
                }
            }
        } else {
            this.setPartitionScheme( occContext );
        }
    }
    /**
     * Gets PartitionScheme.
     * @param {Object} occContext - occmgmt context
     * @returns {Object} Returns structure configuration object if aceActiveCtx is available
     */
    static getPartitionScheme( occContext ) {
        let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
        if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
            return pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
        }
        return null;
    }
    /**
     * Set partition scheme
     * @param {Object} occContext - occmgmt context
     */
    setPartitionScheme( occContext ) {
        if( this.skipPartitionsProcessing || !this.viewerCtxData.getPartitionMgr() || !occContext ) {
            return;
        }
        let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
        let rootElement = occContext.rootElement ? occContext.rootElement : occContext.topElement;
        rootElement = rootElement ? rootElement : occContext.openedElement;
        let rootElementCsidChain = this.modelObjToCsidFn( rootElement );
        rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;
        const isPartitionSchemeFeatureSupported = occContext?.supportedFeatures?.Fgf0OrganizationSchemeFeature;
        if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
            let activePartitionSchemeUid = pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
            if( !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                if( activePartitionSchemeUid !== this.activePartitionSchemeUid || this.rootElementCsidChain !== rootElementCsidChain ) {
                    this.rootElementCsidChain = rootElementCsidChain;
                    if( isPartitionSchemeFeatureSupported ) {
                        this.activePartitionSchemeUid = activePartitionSchemeUid;
                        this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, activePartitionSchemeUid );
                    }
                }
            } else {
                if( activePartitionSchemeUid !== this.activePartitionSchemeUid && this.activePartitionSchemeUid !== '' || this.rootElementCsidChain !== rootElementCsidChain ) {
                    this.rootElementCsidChain = rootElementCsidChain;
                    if( isPartitionSchemeFeatureSupported ) {
                        this.activePartitionSchemeUid = '';
                        this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, '' );
                    }
                }
            }
        } else {
            if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && this.activePartitionSchemeUid !== '' || this.rootElementCsidChain !== rootElementCsidChain ) {
                this.rootElementCsidChain = rootElementCsidChain;
                if( isPartitionSchemeFeatureSupported ) {
                    this.activePartitionSchemeUid = '';
                    this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, '' );
                }
            }
        }
    }

    /**
     * Clean up the current
     * @param {Boolean} isReloadViewer - boolean indicating if viewer is reloading while clean up.
     * @param {Object} subPanelContext Sub panel context
     */
    ctrlCleanup( isReloadViewer, subPanelContext ) {
        VisOccmgmtCommunicationService.instance.unsubscribe( this );
        this.activePartitionSchemeUid = null;
        if( this.structureViewerSelectionHandler ) {
            this.structureViewerSelectionHandler.cleanUp();
            this.structureViewerSelectionHandler = null;
        }
        if( this.structureViewerVisibilityHandler ) {
            this.structureViewerVisibilityHandler.cleanUp( this.occmgmtContextNameKey, subPanelContext );
            this.structureViewerVisibilityHandler = null;
        }else{
            VisOccmgmtCommunicationService.instance.clearVisibilityListenerRegistrationFromAce( this.occmgmtContextNameKey );
        }
        if( this.viewerCtxData ) {
            this.viewerCtxData.removeViewerConnectionProblemListener( this.handle3DViewerConnectionProblem );
            this.viewerCtxData.deregisterOnMouseMoveEvent();
            if( isReloadViewer ) {
                const atomicData = this.viewerCtxData.getViewerAtomicData();
                if( atomicData ) {
                    let updatedViewerAtomicDataValue = { ...atomicData.getValue() };
                    updatedViewerAtomicDataValue.isViewerRevealed = false;
                    updatedViewerAtomicDataValue.viewerViewMode = 'NOVIEWER';
                    updatedViewerAtomicDataValue.loadingViewer = true;
                    updatedViewerAtomicDataValue.subCommandToolbarState = {};
                    updatedViewerAtomicDataValue.viewerMeasurement = {};
                    updatedViewerAtomicDataValue.geoAnalysisVolumeSearch = {};
                    updatedViewerAtomicDataValue.geoAnalysisProximitySearchCtxData = {};
                    updatedViewerAtomicDataValue.hasPMIData = false;
                    updatedViewerAtomicDataValue.allowSectionCreation = false;
                    updatedViewerAtomicDataValue.enableSectionCommandPanel = false;
                    updatedViewerAtomicDataValue.showViewerEmmProgress = true;
                    updatedViewerAtomicDataValue.showViewerProgress = false;
                    updatedViewerAtomicDataValue.displayImageCapture = false;
                    updatedViewerAtomicDataValue.activeCaptureGalleryTab = 'InputSnapshot';
                    updatedViewerAtomicDataValue.onScreen3dMarkupContext = {
                        display3dMarkupToolbar: false
                    };
                    updatedViewerAtomicDataValue.viewerLoadbarVisible = false;
                    updatedViewerAtomicDataValue.viewerLoadbarPercentage = '0';
                    updatedViewerAtomicDataValue.viewerLoadbarMessage = '';
                    updatedViewerAtomicDataValue.viewerStopButtonVisible = false;
                    updatedViewerAtomicDataValue.onScreen2dMarkupContext = {};
                    updatedViewerAtomicDataValue.viewerCtxNamespace = StructureViewerService.instance.getViewerCtxNamespaceUsingOccmgmtKey( this.occmgmtContextNameKey );
                    updatedViewerAtomicDataValue.occmgmtContextKey = this.occmgmtContextNameKey;
                    updatedViewerAtomicDataValue.isSubCommandsToolbarVisible = false;
                    updatedViewerAtomicDataValue.isVisualReportLegendVisible = false;
                    updatedViewerAtomicDataValue.viewerSubCommandsList = [];
                    atomicData.update( updatedViewerAtomicDataValue );
                }
            }
            viewerCtxSvc.unregisterViewerContext( this.viewerCtxData );
        }

        if( this.awGroupObjCategoryChangeEventListener ) {
            eventBus.unsubscribe( this.awGroupObjCategoryChangeEventListener );
            this.awGroupObjCategoryChangeEventListener = null;
        }

        if( this.colorTogglingEventListener ) {
            eventBus.unsubscribe( this.colorTogglingEventListener );
            this.colorTogglingEventListener = null;
        }

        if( this.multiSelectIn3DListener ) {
            eventBus.unsubscribe( this.multiSelectIn3DListener );
            this.multiSelectIn3DListener = null;
        }

        if( this.mvProxySelectionChangedEventListener ) {
            eventBus.unsubscribe( this.mvProxySelectionChangedEventListener );
            this.mvProxySelectionChangedEventListener = null;
        }

        if( this.restoreActionListener ) {
            eventBus.unsubscribe( this.restoreActionListener );
            this.restoreActionListener = null;
        }

        if( this.aceTreeGridSelectionEvent ) {
            eventBus.unsubscribe( this.aceTreeGridSelectionEvent );
            this.aceTreeGridSelectionEvent = null;
        }

        visLaunchInfoProvider.resetProductContextInfo();
        viewerSelectedBomlineInfoProvider.resetSelectedBomlineInfo();
        productLaunchInfoProviderService.clearViewerCtxData();

        if( isReloadViewer ) {
            this.viewerContainerElement.innerHTML = '';
        }
        let viewId = this.viewerCtxData.getValueOnViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED );
        if( viewId && !_.isEmpty( viewId ) ) {
            this.viewerCtxData.closeActiveDialog();
        } else {
            //always close if any panel open during clean up
            //firing the complete event should be removed once all sidenavs are converted to dialogs
            var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
            if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                if( this.viewerPanelsToClose.includes( activeToolAndInfoCmd.commandId ) ) {
                    let eventData = {
                        source: 'toolAndInfoPanel'
                    };
                    eventBus.publish( 'complete', eventData );
                }
            }
        }
        if( this.divResizeobserver ) {
            this.divResizeobserver.disconnect();
        }
        this.unregisterAtomicDataTopics();
        this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.CLEANUP_3D_VIEWER );
        if( this.isServerless ) {
            this.viewerCtxData.getPsLoader().deregisterForBomEventListener();
            this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.AUTO_SAVE_VIS_BOOKMARK, 'stop' );
        }
        this.unregisterPostGetOcc4StructureViewerExtension();
    }

    /**
     * Trigger dynamic update of viewer.
     * This will cause the viewer to re-query Tc for the current product
     * structure and then add and/or remove parts from the model as needed.
     * @param {Object} tempAppSessionResponse createOrUpdateSavedSession SOA response
     * @param {Object} subPanelContext subpanel context
     */
    reconfigureViewer( tempAppSessionResponse, subPanelContext ) {
        if( this.isLoading ) {
            return; //avoid reconfigure if already reloading viewer
        }
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( subPanelContext.occContext );
        let options = 0; // hint on how to handle orphan objects - 0 Keep, 1 Discard
        if( this.viewerCtxData ) {
            let dynamicUpdateMgr = this.viewerCtxData.getDynamicUpdateMgr();
            this.setup3DViewerSelectionHandler( [ ...subPanelContext.occContext.pwaSelection ] );
            if( tempAppSessionResponse ) {
                let tempAppSession = tempAppSessionResponse.sessionOutputs[ 0 ].sessionObject;
                if( tempAppSession ) {
                    if( !_.isUndefined( dynamicUpdateMgr ) && !_.isNull( dynamicUpdateMgr ) ) {
                        dynamicUpdateMgr.reconfigure( tempAppSession.uid, options ).catch( () => {
                            // Reload viewer
                            this.notify3DViewerReloadForPCIChange();
                        } );
                    } else {
                        this.notify3DViewerReloadForPCIChange();
                    }
                }
            } else {
                dynamicUpdateMgr.reconfigure( this.viewerContext.uid, options ).catch( () => {
                    // Reload viewer
                    this.notify3DViewerReloadForPCIChange();
                } );
            }
        }
    }

    /**
     * Gets user configurations properties from the aceActiveContext related to the structure.
     * Currently only accounts for Show Suppressed, but can be easily modified to account for
     * Show Excluded by Variant and Show Excluded by Effectivity.
     *
     * @returns {Object} Returns structure configuration object if aceActiveCtx is available
     */
    getStructureConfiguration() {
        let aceActiveCtx = appCtxSvc.getCtx( this.occmgmtContextNameKey );
        if( aceActiveCtx ) {
            return { showSuppressedOcc: aceActiveCtx.showSuppressedOcc };
        }
        return null;
    }

    /**
     * Checks to see if the user preference showSuppressedOcc has been changed.
     * Also updates the structureConfiguration value.
     */
    shouldUpdateShowSuppressed() {
        let retval = false;
        let newStructureConfiguration = this.getStructureConfiguration();

        if( this.structureConfiguration && newStructureConfiguration ) {
            retval = this.structureConfiguration.showSuppressedOcc !== newStructureConfiguration.showSuppressedOcc;
            this.structureConfiguration = newStructureConfiguration;
        }
        return retval;
    }

    /**
     * Gets the current option in the ACE tree for showing suppressed occurrences,
     * then sends that value to the Vis viewer.
     */
    setShowSuppressed() {
        var visibilityMgr = this.viewerCtxData.getVisibilityManager();

        if( visibilityMgr ) {
            let showSuppressed = this.structureConfiguration.showSuppressedOcc;
            visibilityMgr.setShowSuppressed( showSuppressed );
        }
    }

    /**
     * Creates temporary div for viewer
     * @returns {Object} temporary div element
     */
    createTempDivForViewer() {
        const div = document.createElement( 'div' );
        div.id = 'tempViewer';
        div.style.width = this.viewerWidth + 'px';
        div.style.height = this.viewerHeight + 'px';
        div.style.visibility = 'hidden';
        div.appendChild( this.viewerContainerElement );
        document.body.appendChild( div );
        return div;
    }

    /**
     * Save the auto bookmark for product
     * @param {Boolean} cacheFlatBuffer cache flat buffer or not
     * @param {Boolean} createTempDiv create temp div or not
     * @returns {Promise} Promise object
     */
    async saveVisAutoBookmark( cacheFlatBuffer, createTempDiv ) {
        if( this.viewerCtxData.getSessionMgr() ) {
            let tempDiv = null;
            try {
                if( this.isServerless && !this.viewerCtxData.getSessionMgr().isAutoBookmarkDisabled() ) {
                    if( createTempDiv ) {
                        tempDiv = this.createTempDivForViewer();
                    }
                    await this.viewerCtxData.getSessionMgr().saveAutoBookmark( this.viewerContext, cacheFlatBuffer );
                } else {
                    await this.viewerCtxData.getSessionMgr().saveAutoBookmark();
                }
            } catch ( error ) {
                logger.error( 'Error saving auto bookmark:', error );
            } finally {
                if( tempDiv ) {
                    document.body.removeChild( tempDiv );
                }
            }
        }
    }

    /**
     * update viewer atomic data
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue vlaue to be set on that path
     */
    updateViewerAtomicData( propertyPath, propertyValue ) {
        const newViewerAtomicData = _.cloneDeep( this.viewerAtomicData.getValue() );
        _.set( newViewerAtomicData, propertyPath, propertyValue );
        this.viewerAtomicData.update( newViewerAtomicData );
    }

    /*
     * Returns type of viewer
     */
    getViewerType() {
        return 'struct' + this.occmgmtContextNameKey;
    }

    /**
     * Returns visibility state
     * @returns {Object} Visibility data state
     */
    getVisibilityState() {
        if( this.structureViewerVisibilityHandler ) {
            return this.structureViewerVisibilityHandler.getVisibilityState();
        }
    }
    /**
     * get viewer atomic data value
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @returns {Object} value on requested property path
     */
    getValueOnViewerAtomicData( propertyPath ) {
        return _.get( this.viewerAtomicData.getValue(), propertyPath );
    }

    /**
     * Apply Product snapshot
     *
     * @param {Boolean} isReload3DView reload flag
     * @param {String} snapshotUid applied product snapshot uid
     * @param {Object} productContext updated product context
     * @param {Boolean} doReconfigure reconfigure flag
     */
    _applyProductSnapshot( isReload3DView, snapshotUid, productContext, doReconfigure ) {
        if( isReload3DView ) {
            let snapshotObj = cdm.getObject( snapshotUid );
            if( snapshotObj && isReload3DView ) {
                eventBus.publish( 'SnapshotGalley.showReloadInfo', {
                    snapshotName: snapshotObj.props.object_name.dbValues[ 0 ]
                } );
            }
            this.launchSnapshotGalleyPanel = true;
            this.notify3DViewerReloadForPCIChange();
        } else {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.setViewerPerformanceMode( true );
                viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.ApplyProductSnapshot );
            }
            if( this.viewerCtxData.getDynamicUpdateMgr() ) {
                if( _.isNull( doReconfigure ) || _.isUndefined( doReconfigure ) ) {
                    doReconfigure = !this.viewerCtxData.isMMVRendering();
                }
                this.viewerCtxData.getDynamicUpdateMgr().applyTCSnapshot( snapshotUid, productContext.uid, doReconfigure ).then( ( applyResponse ) => {
                    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                        viewerPerformanceService.stopViewerPerformanceDataCapture( 'Snapshot applied : ' );
                        viewerPerformanceService.setViewerPerformanceMode( false );
                    }
                    //applyTCSnapshot returns Array -- [bCancel, bApplySnapshot, bIsMergable]. If "IsMergable" is false then reload is needed
                    if( Array.isArray( applyResponse ) && applyResponse.length > 2 &&
                        !_.isUndefined( applyResponse[ 2 ] ) && !_.isNull( applyResponse[ 2 ] ) && !applyResponse[ 2 ] && doReconfigure ) {
                        this.launchSnapshotGalleyPanel = true;
                        this.notify3DViewerReloadForPCIChange();
                    } else {
                        StructureViewerService.instance.updateSectionCommandState( this.viewerCtxData );
                        this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.PRODUCT_SNAPSHOT_APPLIED );
                        this.appliedProductSnapshotUid = snapshotUid;
                    }
                } );
            }
        }
    }

    /**
     * clean up 3D viewer
     * @param {Object} subPanelContext Sub panel context
     */
    cleanup3DViewer( subPanelContext ) {
        StructureViewerService.instance.registerCleanup3DViewEventListener( this.occmgmtContextNameKey );
        StructureViewerService.instance.registerFilterReloadEvent();
        this.ctrlCleanup( false, subPanelContext );
    }

    /**
     * Reset Viewer atomic data which disabled viewer commands
     * @param {Boolean} showEmmProgress show emm progress
     */
    resetViewerAtomicData( showEmmProgress ) {
        let atomicData;
        if( this.viewerCtxData ) {
            atomicData = this.viewerCtxData.getViewerAtomicData();
        } else {
            atomicData = this.viewerAtomicData;
        }
        let updatedViewerAtomicDataValue = { ...atomicData.getValue() };
        updatedViewerAtomicDataValue.isViewerRevealed = false;
        updatedViewerAtomicDataValue.viewerViewMode = 'NOVIEWER';
        updatedViewerAtomicDataValue.showViewerProgress = false;
        if( showEmmProgress ) {
            updatedViewerAtomicDataValue.showViewerEmmProgress = true;
        } else {
            updatedViewerAtomicDataValue.showViewerEmmProgress = false;
        }
        updatedViewerAtomicDataValue.loadingViewer = false;
        atomicData.update( updatedViewerAtomicDataValue );
        this.isLoading = false;
    }

    /**
     * Apply Autobookmark
     * @param {Object} occmgmtContext object management context
     * @returns {Promise} Promise resolves when autobookmark is applied successfully
     *
     */
    applyAutoBookmark( occmgmtContext ) {
        if( this.viewerCtxData && this.viewerCtxData.getSessionMgr() && !this.viewerCtxData.isConnectionClosed() &&
            occmgmtContext && occmgmtContext.transientRequestPref && occmgmtContext.transientRequestPref.restoreProduct === true ) {
            return this.viewerCtxData.getSessionMgr().applyAutoBookmark().then( () => {
                viewerPreferenceService.loadViewerPreferencesFromVisSession( this.viewerCtxData );
            } ).catch( () => {
                logger.error( 'failed to apply bookmark' );
            } );
        }
    }

    /**
     * Reset cached product snapshot uid
     */
    resetCachedSnapshotData() {
        this.appliedProductSnapshotUid = null;
    }

    /**
     * Get CSID chain from provided model object.
     *
     * @param {Object} modelObject model object
     * @returns {String} csid chain
     */
    static defaultModelObjectToCsid( modelObject ) {
        if( modelObject ) {
            return aceObjectToCSIDGeneratorService.getCloneStableIdChain( modelObject );
        }
        return null;
    }

    /**
     * Get model objects from given CSIDs
     *
     * @param {Array} csids Array of input csids
     * @returns {Promise} A promise that resolves with model objects
     */
    static defaultCsidToModelObject( csids ) {
        if( Array.isArray( csids ) && csids.length > 0 ) {
            return csidsToObjSvc.doPerformSearchForProvidedCSIDChains( csids, 'true' );
        }
        return null;
    }

    /**
     * Get model objects from given SRUids
     *
     * @param {Array} sruids Array of input sruids
     * @returns {Promise} A promise that resolves with model objects
     */
    static defaultSruidToModelObject( sruids ) {
        if( Array.isArray( sruids ) && sruids.length > 0 ) {
            return csidsToObjSvc.doPerformSearchForProvidedSRUIDs( sruids, 'true' );
        }
        return null;
    }

    /**
     * Get unpacked CSID chains from provided model object.
     *
     * @param {Object} productCtxInfo product context info
     * @param {Array} arrayOfModelObjects Array of input model objects
     * @returns {Promise} A promise that is resolved with bomlines array
     */
    static defaultModelObjectToPackedOccCsids( productCtxInfo, arrayOfModelObjects ) {
        if( Array.isArray( arrayOfModelObjects ) && arrayOfModelObjects.length > 0 ) {
            return aceObjectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productCtxInfo, arrayOfModelObjects );
        }
        return AwPromiseService.instance.resolve( {
            csids: []
        } );
    }

    /**
     * Get backing objects for given bomlines
     *
     * @param {Array} arrayOfModelObjects Array of input model objects
     * @returns {Array} Array of resolved backing objects
     */
    static defaultGetBackingObjects( arrayOfModelObjects ) {
        if( Array.isArray( arrayOfModelObjects ) && arrayOfModelObjects.length > 0 ) {
            return aceBackingObjectProviderService.getBackingObjectsSync( arrayOfModelObjects );
        }
        return null;
    }

    /**
     * Get bomlines for csids
     *
     * @param {Array} csids Array of csids
     * @returns {Promise} A promise that is resolved with bomlines array
     */
    static defaultGetBomLinesFromCsids( csids ) {
        if( !Array.isArray( csids ) || _.isEmpty( csids ) ) {
            logger.error( 'The csids array received to retrieve BOMLines is invalid.' );
            return AwPromiseService.instance.reject( 'The csids array received to retrieve BOMLines is invalid.' );
        }
        const returnPromise = AwPromiseService.instance.defer();
        const retrievedBomLines = [];
        const occmgmtContext = appCtxSvc.getCtx( 'aceActiveContext.context' );
        if( !occmgmtContext ) {
            logger.error( 'occmgmtContext is null or undefined.' );
            return AwPromiseService.instance.reject( 'Invalid context: occmgmtContext is null or undefined.' );
        }
        let topElementModelObj = null;//for expanding app session and configuration baselines we need product underneath to expand. so use root element instead of topElement
        if ( occmgmtContext?.openedElement?.modelType?.typeHierarchyArray?.includes( 'Fnd0AppSession' ) ||
        occmgmtContext?.openedElement?.modelType?.typeHierarchyArray?.includes( 'Fnd0AbsConfigBaseline' ) ) {
            topElementModelObj = occmgmtContext.rootElement;
        } else {
            topElementModelObj = viewerContextService.getTopElementObject( occmgmtContext );
        }
        const seedElement = aceBackingObjectProviderService.getBackingObjectsSync( [ topElementModelObj ] )[ 0 ];
        if( csids.length === 1 && csids[ 0 ] === '' ) {
            retrievedBomLines.push( seedElement );
            returnPromise.resolve( retrievedBomLines );
            return returnPromise.promise;
        }
        let nonRootCSIDs = [];
        for( let i = 0; i < csids.length; i++ ) {
            if( csids[ i ] === '' ) {
                retrievedBomLines.push( seedElement );
            } else {
                nonRootCSIDs.push( csids[ i ] );
            }
        }
        csids = nonRootCSIDs;
        csidsToObjSvc.doPerformSearchForProvidedCSIDChains( csids, 'true' ).then( response => {
            if( response && response.elementsInfo && !_.isEmpty( response.elementsInfo ) ) {
                for( let i = 0; i < response.elementsInfo.length; i++ ) {
                    if( response.elementsInfo[ i ].element.type === 'unknownType' ) {
                        continue;
                    }
                    let nonRootSeedElement = aceBackingObjectProviderService.getBackingObjectsSync( [ response.elementsInfo[ i ].element ] )[ 0 ];
                    retrievedBomLines.push( nonRootSeedElement );
                }
            }
            returnPromise.resolve( retrievedBomLines );
        } ).catch( error => {
            returnPromise.reject( retrievedBomLines );
            logger.error( 'Could not retrieve bomlines for provided csids.' + error );
        } );
        return returnPromise.promise;
    }

    /**
     * Is apply delta update to 3D instead of full reload
     *
     * @param {Object} aceContext ACE Context
     * @returns {Boolean} true if apply delta update is applicable
     */

    static defaultIsApplyDeltaUpdate( aceContext ) {
        if( !_.isUndefined( this.isDeltaUpdateApplicable ) && !_.isNull( this.isDeltaUpdateApplicable ) ) {
            return this.isDeltaUpdateApplicable; //only applicable in case of external configuration
        }

        //Disable delta update by default for ebom for gulpstream and enable only if beta preference is set with enableDeltaUpdateEbom as value
        // LCS-1243916 - Disable Delta update for EBOM - make it available as Beta feature ( Gulfstream)
        if( !StructureViewerData.isEbomDeltaUpdateEnabled() && StructureViewerService.instance.isPartElementBeingOpened( aceContext ) ) {
            return false;
        }

        //Delta update is not available if preference VIS_USE_BOM_DELTA_STRUCTURE_UPDATE is set 'false'
        const isDeltaUpdateEnabled = viewerPreferenceService.getUseBomDeltaStructureUpdate();
        return Boolean( _.isString( isDeltaUpdateEnabled ) && isDeltaUpdateEnabled.toUpperCase() === 'TRUE' );
    }

    /**
     *  Is delta update for ebom enabled
     * @returns {Boolean} true if delta update for ebom is enabled
     */
    static isEbomDeltaUpdateEnabled() {
        let betaPrefValues = viewerPreferenceService.getViewerBetaPref();
        return betaPrefValues && _.isArray( betaPrefValues ) && _.includes( betaPrefValues, 'enableDeltaUpdateEbom' );
    }

    /**
     *  Is product snapshot being opened
     * @param {Object} aceContext ace context
     * @returns {Boolean} true if product snapshot is being opened
     */
    static isProductSnapshotOpened( aceContext ) {
        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        if( aceContext && aceContext.openedElement && aceContext.openedElement.props && aceContext.openedElement.props.awb0UnderlyingObject ) {
            const openedObj = cdm.getObject( aceContext.openedElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
            if( openedObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                let snapshotId = newProductCtx.props.awb0Snapshot && newProductCtx.props.awb0Snapshot.dbValues[ 0 ];
                if( snapshotId ) {
                    return true;
                }
            }
        }
        return false;
    }
}
