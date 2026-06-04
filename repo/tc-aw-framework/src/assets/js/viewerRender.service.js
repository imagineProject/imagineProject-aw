// Copyright (c) 2022 Siemens

/**
 * Defines {@link NgServices.viewerRenderService} which provides utility functions to render viewer
 *
 * @module js/viewerRender.service
 */
import { getBaseUrlPath } from 'app';
import frameAdapterService from 'js/frameAdapter.service';
import viewerContextService from 'js/viewerContext.service';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import viewerPreferenceService from 'js/viewerPreference.service';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import preferenceService from 'soa/preferenceService';
import viewerSecurityMarkingService from 'js/viewerSecurityMarkingService';
import viewerReconcileService from 'js/viewerReconcileService';
import viewer3DConnectionManager from 'js/viewer3DConnectionManager';
import _ from 'lodash';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';
import '@swf/ClientViewer';
import viewerIndexedDbService from 'js/viewerIndexedDbService';
import viewerOcclusionCullingService from 'js/viewerOcclusionCullingService';
import viewerSessionStorageService from 'js/viewerSessionStorageService';
import dataManagementService from 'soa/dataManagementService';
import { CadPageExpandRequest } from 'js/cadPageExpandRequest';
import ViewerLicenseService from 'js/viewerLicenseService';
// import 'manipulator';

/**
 * A default viewer context namespace
 */
var DEFAULT_VIEWER_CONTEXT = 'awDefaultViewer';

/**
 * Host config token
 */
var AW_HOST_CONFIG_TOKEN = 'aw_hosting_config';

/**
 * Is viewer supported token
 */
var IS_VIEWER_SUPPORTED_TOKEN = 'IS_VIEWER_SUPPORTED';

/**
 * 2D Viewer render option
 */
var VIEWER_2D_RENDER_OPTION = preferenceService.getLoadedPrefs().AWV02DViewerRenderOption;

/**
 * Returns the default viewer context name space
 *
 * @returns {String} default viewer context name space
 */
export let getDefaultViewerNamespace = function() {
    return DEFAULT_VIEWER_CONTEXT;
};

/**
 * This utility function helps to create the viewer parameters that needs to be passed to a
 * function to load the viewer
 *
 * @param {Object} viewerContainer A div element that holds the viewer
 * @param {Number} width Width of the viewer
 * @param {Number} height Height of the viewer
 * @returns {Object} View parameter object that is required while loading viewer
 */
export let createViewerLoadParams = function( viewerContainer, width, height ) {
    var location = browserUtils.getWindowLocation();
    var cursorUrlRelativePath = location.pathname + getBaseUrlPath() + '/cursor';
    return new window.JSCom.Render.View.Params( viewerContainer, parseInt( width ),
        parseInt( height ), cursorUrlRelativePath );
};

/**
 * Update viewer context with viewer visibility
 *
 * @param {ViewerContextData} viewerCtxData viewer context data.
 * @param {Boolean} isVisible true if viewer tab is visible
 */
export let updateViewerContextWithVisibility = function( viewerCtxData, isVisible ) {
    viewerContextService.updateRegisteredViewerContext( viewerCtxData.getViewerCtxNamespace(),
        viewerCtxData );
    updateViewerVisibility( viewerCtxData, isVisible );
};

/**
 * Update viewer visibility context
 *
 * @param {Object} viewerCtxData Viewer context data
 * @param {Boolean} isVisible true if viewer tab is visible
 */
export let updateViewerVisibility = function( viewerCtxData, isVisible ) {
    if( isVisible ) {
        if( viewerCtxData.getIs2D() ) {
            viewerCtxData.updateViewerAtomicData( viewerContextService.VIEWER_VIEW_MODE_TOKEN, viewerContextService.ViewerViewModes.VIEWER2D );
        } else {
            viewerCtxData.updateViewerAtomicData( viewerContextService.VIEWER_VIEW_MODE_TOKEN, viewerContextService.ViewerViewModes.VIEWER3D );
        }
    } else {
        viewerCtxData.updateViewerAtomicData( viewerContextService.VIEWER_VIEW_MODE_TOKEN, viewerContextService.ViewerViewModes.NOVIEWER );
    }
    viewerCtxData.updateViewerAtomicData( viewerContextService.VIEWER_VISIBILITY_TOKEN, isVisible );
};

/**
 * Update IsBomWindow Shared in context
 *
 * @param {Object} viewerCtxData Viewer context data
 * @param {Boolean} isBOMWindowShared true if BOM window is shared
 */
export let updateIsBomWindowShared = function( viewerCtxData, isBOMWindowShared ) {
    viewerCtxData.updateViewerAtomicData( viewerContextService.VIEWER_IS_BOM_WINDOW_SHARED, isBOMWindowShared );
};

/**
 * Get viewer message for key
 * @param {String} key message key
 * @returns {Promise} Promise that resolve with localized text
 */
var _getViewerMessage = function( key ) {
    var returnPromise = AwPromiseService.instance.defer();
    localeSvc.getTextPromise( 'Awv0threeDViewerMessages' ).then(
        function( localTextBundle ) {
            returnPromise.resolve( localTextBundle[ key ] );
        },
        function( error ) {
            returnPromise.reject( error );
        } );
    return returnPromise.promise;
};

/**
 * Sets license level in the context.
 *
 * @param  {Object} viewerView viewer view
 */
var _setLicenseLevelInCtx = function( viewerView ) {
    var viewerLicenseCtxPath = viewerContextService.VIEWER_NAMESPACE_TOKEN + '.' + viewerContextService.VIEWER_LICENSE_LEVEL_TOKEN;
    viewerView.getVisLicenseLevels( window.JSCom.Consts.LICENSE_LEVELS.ALL ).then( function( licLevels ) {
        appCtxService.updatePartialCtx( viewerLicenseCtxPath, licLevels.iCO_VisUserLicense );
    }, function( reason ) {
        logger.error( 'viewerRender: Failed to fetch viewer license level:' + reason );
        appCtxService.updatePartialCtx( viewerLicenseCtxPath, viewerContextService.ViewerLicenseLevels.BASE );
    } );
};

/**
 * Get top line UID
 *
 * @param  {Object} topLineMO top line model object
 * @returns {Promise} promise that provides item rev uid on resolve
 */
var _getTopLineUid = function( topLineMO ) {
    const deferredPromise = AwPromiseService.instance.defer();
    if( topLineMO && topLineMO.props ) {
        if( !topLineMO.props.awb0UnderlyingObject ) {
            dataManagementService.getProperties( [ topLineMO.uid ], [ 'awb0UnderlyingObject' ] )
                .then( () => {
                    if( topLineMO.props.awb0UnderlyingObject ) {
                        deferredPromise.resolve( topLineMO.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    } else {
                        deferredPromise.resolve( undefined );
                    }
                }, () => {
                    deferredPromise.resolve( undefined );
                } ).catch( () => {
                    deferredPromise.resolve( undefined );
                } );
        } else {
            deferredPromise.resolve( topLineMO.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
    } else {
        deferredPromise.resolve( undefined );
    }
    return deferredPromise.promise;
};

/**
 * Evaluates if hosting is supported
 *
 * @returns {Boolean} true if supported
 */
var _evaluateAvailabilityInHosting = function() {
    var hostConfig = appCtxService.getCtx( AW_HOST_CONFIG_TOKEN );
    var isSupported = true;

    if( !_.isUndefined( hostConfig ) ) {
        isSupported = hostConfig[ IS_VIEWER_SUPPORTED_TOKEN ];

        if( !_.isUndefined( isSupported ) && !isSupported ) {
            _getViewerMessage( 'viewerEnvironmentNotSupported' ).then( function( localizedErrorMsg ) {
                msgSvc.showError( localizedErrorMsg );
            } );
        }
    }

    return isSupported === true;
};

/**
 * Get viewer loading input parameters
 *
 * @returns {ViewerLoadInputParameters} Object that should have all input parameters to load the viewer
 */
export let getViewerLoadInputParameters = function() {
    return new ViewerLoadInputParameters();
};

/**
 * Load viewer by model object
 *
 * @param {ViewerLoadInputParameters} viewerLoadInputParameters Model object for which viewer needs to be loaded
 * @returns {Object} Promise once resolved will provide a Viewer View object that controls
 *          viewer
 */
export let loadByModelObjectInputParam = function( viewerLoadInputParameters ) {
    var returnPromise = AwPromiseService.instance.defer();
    var viewerCtxName = viewerLoadInputParameters.getViewerCtxNamespace();
    var vType = viewerLoadInputParameters.getViewerType();

    if( _.isUndefined( viewerCtxName ) || _.isNull( viewerCtxName ) ||
        _.isEmpty( viewerCtxName ) ) {
        viewerCtxName = DEFAULT_VIEWER_CONTEXT;
    }

    if( _.isUndefined( vType ) || _.isNull( vType ) || _.isEmpty( vType ) ) {
        vType = viewerContextService.ViewerType.JsViewer;
    }

    viewerContextService.createViewerApplicationContext( viewerCtxName );
    viewerContextService.updateViewerApplicationContext( viewerCtxName,
        viewerContextService.VIEWER_VIEW_MODE_TOKEN,
        viewerContextService.ViewerViewModes.NOVIEWER );
    viewerContextService.updateViewerApplicationContext( viewerCtxName,
        viewerContextService.VIEWER_VISIBILITY_TOKEN, false );

    if( !_evaluateAvailabilityInHosting() ) {
        returnPromise.reject();
        return returnPromise.promise;
    }
    let viewerPreferencePromise = viewerPreferenceService.getViewerPreferences( viewerLoadInputParameters.isShowAll(), viewerLoadInputParameters.isApplyBookmarkApplicable(),
        viewerLoadInputParameters.isDisableBookMarkApplicable(), viewerLoadInputParameters.isShowSuppressed(), viewerLoadInputParameters.getSelectionLimit(),
        viewerLoadInputParameters.getViewerContext() );
    let occCullingPolicyPromise = viewerOcclusionCullingService.getOccCulling( viewerLoadInputParameters.getTopElementOrSelectedModelObj() );
    let topLineUidPromise = _getTopLineUid( viewerLoadInputParameters.getTopElementOrSelectedModelObj() );
    viewerPreferencePromise.then( function( preferenceResult ) {
        let fmsTicketPromise;
        let vfInfoPromise = AwPromiseService.instance.resolve();
        if( viewerContextService.isServerless() && !viewerLoadInputParameters.get2DRenderer() ) {
            fmsTicketPromise = AwPromiseService.instance.resolve();
            const productContextInfo = viewerLoadInputParameters.getTargetObject();
            let viewerContextData = viewerLoadInputParameters.getViewerContext();
            let topElement = viewerLoadInputParameters.getTopElementOrSelectedModelObj();
            let isAppSessionBeingOpened = topElement && topElement.modelType && topElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1;
            if( viewerLoadInputParameters.isOpeningProductSnapshot() && viewerContextData && viewerContextData.getSnapshotManager() ) {
                vfInfoPromise = viewerContextData.getSnapshotManager().getVisSnapshotInfo( productContextInfo );
            } else if( viewerLoadInputParameters.isApplyBookmarkApplicable() && !isAppSessionBeingOpened && viewerContextData && viewerLoadInputParameters.getBookmarkProviderInstance() ) {
                vfInfoPromise = viewerLoadInputParameters.getBookmarkProviderInstance().getVFInfoForProduct( productContextInfo );
            } else if( isAppSessionBeingOpened && viewerContextData && viewerContextData.getSessionMgr() ) {
                vfInfoPromise = viewerContextData.getSessionMgr().getVFInfoForAppSession( productContextInfo, topElement );
            }
        } else {
            fmsTicketPromise = frameAdapterService.createLaunchFile( viewerLoadInputParameters.getTargetObject(), viewerLoadInputParameters.getAdditionalInfo(), viewerLoadInputParameters
                .getPVOpenConfig() );
        }

        const promiseArray = [ fmsTicketPromise, occCullingPolicyPromise, topLineUidPromise, vfInfoPromise ];
        if( viewerContextService.isServerless() ) {
            promiseArray.push( ViewerLicenseService.instance.checkoutVisLicense() );
        }

        AwPromiseService.instance.all( promiseArray ).then( function( result ) {
            var renderer = null;
            let VIEWER_RENDER_OPTION = 'CSR';
            let viewerContextData = viewerLoadInputParameters.getViewerContext();
            if( !viewerContextService.isServerless() ) {
                if( viewerContextData ) {
                    VIEWER_RENDER_OPTION = viewerContextData.getValueOnViewerAtomicData( 'renderLocation' );
                }
                if( VIEWER_RENDER_OPTION === 'CSR' ) {
                    renderer = window.JSCom.Consts.ImplType.PLMVISWEB;
                } else if( VIEWER_RENDER_OPTION === 'SSR' ) {
                    renderer = window.JSCom.Consts.ImplType.PICTURE;
                }
            } else {
                VIEWER_RENDER_OPTION = 'CSR';
                renderer = window.JSCom.Consts.ImplType.PLMVISWEB_SERVERLESS;
                viewerContextData.updateViewerAtomicData( 'renderLocation', 'CSR' );
            }
            appCtxService.updatePartialCtx( 'viewer.viewerMode', VIEWER_RENDER_OPTION );

            // Override renderer if this is a 2D document
            if( viewerLoadInputParameters.get2DRenderer() ) {
                if( !VIEWER_2D_RENDER_OPTION || VIEWER_2D_RENDER_OPTION.length === 0 ) {
                    // Fix for PR 11398265 defect LCS-1309016
                    // If it fails for any reason to get the 2D render option above, try to 
                    // get it again from the loaded preferences.
                    VIEWER_2D_RENDER_OPTION = preferenceService.getLoadedPrefs().AWV02DViewerRenderOption;
                }
                if( Array.isArray( VIEWER_2D_RENDER_OPTION ) && VIEWER_2D_RENDER_OPTION[ 0 ] === 'CSR' ) {
                    renderer = window.JSCom.Consts.ImplType.VECTOR2D;
                } else {
                    renderer = window.JSCom.Consts.ImplType.PICTURE2D;
                }
            }
            if( !viewerLoadInputParameters.hasInitialized() ) {
                viewerLoadInputParameters.initializeViewerContext();
            }
            let moniker = null;
            if( viewerContextService.isServerless() && !viewerLoadInputParameters.get2DRenderer() ) {
                moniker = new window.JSCom.Render.MonikerFMSTicket(
                    frameAdapterService.getConnectionUrl(), '', viewerLoadInputParameters.getProductUids(), renderer );
                moniker.PSLoader = viewerLoadInputParameters.getPsLoader();
            } else {
                moniker = new window.JSCom.Render.MonikerFMSTicket(
                    frameAdapterService.getConnectionUrl(), result[ 0 ], viewerLoadInputParameters.getProductUids(), renderer );
            }
            moniker.itemRevUID = result[ 2 ];
            if( result[ 3 ] ) {
                moniker.vfInfo = result[ 3 ];
            }
            var viewerView = viewerLoadInputParameters.getViewerView();
            if( viewerLoadInputParameters.getSecurityMarkingHandlerKey() ) {
                viewerSecurityMarkingService.setupSecurityMarkingWithHandlerFnKey( viewerView, viewerLoadInputParameters.getSecurityMarkingHandlerKey() );
            } else {
                viewerSecurityMarkingService.setupSecurityMarking( viewerView, viewerLoadInputParameters.getSecurityMarkingHandler() );
            }
            viewerReconcileService.setupReconcile( viewerView, viewerLoadInputParameters.getReconcileHandler() );

            var loadingOptions = {};
            if( viewerContextService.isServerless() ) {
                preferenceResult.visLicenseLevel = ViewerLicenseService.instance.getAssignedVisLicense();
            }
            loadingOptions.preferences = preferenceResult;
            if( loadingOptions.preferences.performance && loadingOptions.preferences.performance.bboxSS ) {
                loadingOptions.preferences.performance.bboxSS.policy = result[ 1 ];
            }
            if( loadingOptions.preferences ) {
                loadingOptions.preferences.isHostingEnabled = viewerLoadInputParameters.isHostingEnabled();
            }
            var open3DViewPromise = viewerView.openMoniker( moniker,
                loadingOptions );
            //Make sure both promises are resolved before proceeding
            open3DViewPromise.then( function() {
                _setLicenseLevelInCtx( viewerView );
                viewer3DConnectionManager.registerBrowserUnloadListener();
                updateViewerVisibility( viewerLoadInputParameters.getViewerContext(), true );
                updateIsBomWindowShared( viewerLoadInputParameters.getViewerContext(), viewerView.isBOMWindowShared() );
                if( !viewerLoadInputParameters.get2DRenderer() && viewerLoadInputParameters.getViewerContext().getThreeDViewManager() ) {
                    viewerLoadInputParameters.getViewerContext().getThreeDViewManager().getModelUnit().then( function( modelUnit ) {
                        viewerPreferenceService.setModelUnit( modelUnit, viewerLoadInputParameters.getViewerContext() );
                    }, function( reason ) {
                        logger.error( 'viewerRender: Failed to get model unit:' + reason );
                    } );
                    viewerPreferenceService.loadViewerPreferencesFromVisSession( viewerLoadInputParameters.getViewerContext() );
                }
                viewerContextService.turnOffGlobalCutlinesForSection( viewerView );
                //store or update render option on successful open
                let modelObject = viewerLoadInputParameters.getTopElementOrSelectedModelObj();
                let modelUid = null;
                if( modelObject && modelObject.props && modelObject.props.awb0Archetype && modelObject.props.awb0Archetype.dbValues[ 0 ] !== '' ) {
                    modelUid = modelObject.props.awb0Archetype.dbValues[ 0 ];
                } else if( modelObject && modelObject.uid ) {
                    modelUid = modelObject.uid;
                }
                viewerIndexedDbService.updateModelRenderLocationIntoDb( modelUid, VIEWER_RENDER_OPTION );
                if( viewerContextService.isServerless() && viewerLoadInputParameters.getViewerContext().isMMVRendering() ) {
                    //for serverless MMV only part color selection style is supported. By passing second parameter as null, preference service just update atomic data and UI
                    viewerPreferenceService.setSelectionDisplayPreference( 'PartColor', null, viewerLoadInputParameters.getViewerContext() );
                }
                returnPromise.resolve( viewerLoadInputParameters.getViewerContext() );
            }, function( errorMsg ) {
                returnPromise.reject( errorMsg );
                if( errorMsg.message ) {
                    if( errorMsg.message === 'All Pool Managers are full' ) {
                        _getViewerMessage( 'poolManagerFull' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( errorMsg.message === 'No Pool Managers were found' ) {
                        _getViewerMessage( 'poolManagerDown' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( errorMsg.message === 'ErrorName:' || _.includes( errorMsg.message, 'Failed to connect to server' ) ) {
                        _getViewerMessage( 'viewerNotConfigured' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( _.includes( errorMsg.message,
                        'MMV is not supported for Client Side rendering' ) ) {
                        let renderSupportInfo = viewerSessionStorageService.getViewerDataFromSessionStorage( 'renderSupportInfo' );
                        if( renderSupportInfo.isSSRSupported === true ) {
                            _getViewerMessage( 'mmvDataNotViewableAutoSwitchToSSR' ).then( function( localizedErrorMsg ) {
                                msgSvc.showInfo( localizedErrorMsg );
                                viewerLoadInputParameters.getViewerContext().updateViewerAtomicData( viewerContextService.VIEWER_RENDER_IN_SSR, true );
                            } );
                        } else {
                            _getViewerMessage( 'mmvDataNotViewableWithNoSSR' ).then( function( localizedErrorMsg ) {
                                msgSvc.showInfo( localizedErrorMsg );
                            } );
                        }
                    } else if( _.includes( errorMsg.message,
                        'Not enough storage is available to complete this operation' ) ) {
                        _getViewerMessage( 'notEnoughBrowserStorage' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( _.includes( errorMsg.message, 'Problem processing HTTP request' ) ) {
                        _getViewerMessage( 'problemInHttpReq' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( _.includes( errorMsg.message, 'Could not initialize the rendering component due to web browser limitations' ) ) {
                        _getViewerMessage( 'browserLimitation' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    } else if( _.includes( errorMsg.message,
                        'The connection from the servlet to the Vis process failed.  Perhaps the Vis process timed out or the Vis processes crashed or the Vis process closed.'
                    ) ) {
                        logger.error( errorMsg.message );
                    } else if( _.includes( errorMsg.message, 'Server Side rendering without a server graphics card is not supported' ) ) {
                        logger.error( errorMsg.message );
                        _getViewerMessage( 'ssrNotSupported' ).then( function( localizedErrorMsg ) {
                            msgSvc.showInfo( localizedErrorMsg );
                        } );
                    } else {
                        _getViewerMessage( 'vviLaunchFailed' ).then( function( localizedErrorMsg ) {
                            msgSvc.showError( localizedErrorMsg );
                        } );
                    }
                } else {
                    _getViewerMessage( 'vviLaunchFailed' ).then( function( localizedErrorMsg ) {
                        msgSvc.showError( localizedErrorMsg );
                    } );
                }
            } );
        },
        function( errorMsg ) {
            msgSvc.showError( errorMsg );
            returnPromise.reject( errorMsg );
        } ).catch( error => {
            msgSvc.showError( error );
            returnPromise.reject( error );
        } );
    },
    function( errorMsg ) {
        msgSvc.showError( errorMsg );
        returnPromise.reject( errorMsg );
    } ).catch( error => {
        msgSvc.showError( error );
        returnPromise.reject( error );
    } );
    return returnPromise.promise;
};

/**
 * Set the target object
 *
 * @constructor ViewerLoadInputParameters
 */
var ViewerLoadInputParameters = function() {
    var self = this;
    var _targetObject = null;
    var _productUIDs = null;
    var _additionalInfo = null;
    var _viewerContainer = null;
    var _height = null;
    var _width = null;
    var _viewerCtxNamespace = null;
    var _viewerType = null;
    var _isShowAll = null;
    var _hasInitialized = false;
    var _viewerContext = null;
    var _securityMarkingHandler = null;
    var _securityMarkingHandlerKey = null;
    var _viewerView = null;
    var _is2DRenderer = false; // flag - is Document a 2D file
    var _reconcileHandler = null;
    var _isApplyBookmarkApplicable = true;
    var _pvOpenConfig = null;
    var _disableBookMark = false;
    var _showSuppressed = false;
    var _viewerAtomicData = null;
    let _visSelectionLimit = null;
    let _modelObject = null;
    let _isHostingEnabled = false;
    let _bomlineProviderFn = null;
    let _psLoader = null;
    let _isPartViewer = false;
    let _deltaUpdateSupported = true;
    let _enableChildrenThenDepthFirst = null;
    let _bookmarkProviderInstance = null;
    let _isOpeningProductSnapshot = false;

    /**
     * Set the target object
     *
     * @param {Object} targetObject target object
     */
    self.setTargetObject = function( targetObject ) {
        _targetObject = targetObject;
    };

    /**
     * Get the target Object
     *
     * @returns {Object} target object
     */
    self.getTargetObject = function() {
        return _targetObject;
    };

    /**
     * Set the ps loader instance
     *
     * @param {Object} psloader loader object
     */
    self.setPsLoader = function( psloader ) {
        _psLoader = psloader;
    };

    /**
     * Get the ps loader instance
     * @return {Object} psloader loader object instance
     */
    self.getPsLoader = function() {
        return _psLoader;
    };

    /**
     *
     * @returns {Object} selection limit
     */
    self.getSelectionLimit = function() {
        return _visSelectionLimit === null ? 0 : _visSelectionLimit;
    };

    /**
     *
     * @param {Object} visSelectionLimit selection limit
     */
    self.setSelectionLimit = function( visSelectionLimit ) {
        _visSelectionLimit = visSelectionLimit;
    };

    /**
     * Set the product UID's
     *
     * @param {Object} productUIDs product UID's
     */
    self.setProductUids = function( productUIDs ) {
        _productUIDs = productUIDs;
    };

    /**
     * Set bomline provider function
     *
     * @param {Object} bomlineProviderFn bom line provider function
     */
    self.setBomlineProviderFn = function( bomlineProviderFn ) {
        _bomlineProviderFn = bomlineProviderFn;
    };

    /**
     * Get bomline provider function
     *
     * @returns {Function} bomline provider function
     */
    self.getBomlineProviderFn = function() {
        return _bomlineProviderFn;
    };

    /**
     * Get the product UID's
     *
     * @returns {Object} product UID's
     */
    self.getProductUids = function() {
        return _productUIDs;
    };

    /**
     * Set the additional info
     *
     * @param {Object} additionalInfo Additional info
     */
    self.setAdditionalInfo = function( additionalInfo ) {
        _additionalInfo = additionalInfo;
    };

    /**
     * Get the additional info
     *
     * @returns {Object} Additional info
     */
    self.getAdditionalInfo = function() {
        return _additionalInfo;
    };

    /**
     * Set the viewer container
     *
     * @param {Object} viewerContainer Viewer container
     */
    self.setViewerContainer = function( viewerContainer ) {
        _viewerContainer = viewerContainer;
    };

    /**
     * Get the viewer container
     *
     * @returns {Object} Viewer container
     */
    self.getViewerContainer = function() {
        return _viewerContainer;
    };

    /**
     * Set the viewer height
     *
     * @param {Object} height Viewer container
     */
    self.setHeight = function( height ) {
        _height = height;
    };

    /**
     * Get the viewer height
     *
     * @returns {Object} Viewer height
     */
    self.getHeight = function() {
        return _height;
    };

    /**
     * Set the viewer width
     *
     * @param {Object} width Viewer width
     */
    self.setWidth = function( width ) {
        _width = width;
    };

    /**
     * Get the viewer width
     *
     * @returns {Object} Viewer width
     */
    self.getWidth = function() {
        return _width;
    };

    /**
     * Set the viewer context namespace
     *
     * @param {Object} viewerCtxNamespace Viewer Context Namespace
     */
    self.setViewerCtxNamespace = function( viewerCtxNamespace ) {
        _viewerCtxNamespace = viewerCtxNamespace;
    };

    /**
     * Get the viewer context namespace
     *
     * @returns {Object} Viewer Context Namespace
     */
    self.getViewerCtxNamespace = function() {
        return _viewerCtxNamespace;
    };

    /**
     * Set the viewer type
     *
     * @param {Object} viewerType Viewer type
     */
    self.setViewerType = function( viewerType ) {
        _viewerType = viewerType;
    };

    /**
     * Get the viewer type
     *
     * @returns {Object} Viewer type
     */
    self.getViewerType = function() {
        return _viewerType;
    };

    /**
     * Set is show all
     *
     * @param {Boolean} isShowAll Is show all
     */
    self.setShowAll = function( isShowAll ) {
        _isShowAll = isShowAll;
    };

    /**
     * Get is show all
     *
     * @returns {Boolean} Is show all
     */
    self.isShowAll = function() {
        return _isShowAll;
    };

    /**
     * Get has initialized
     *
     * @returns {Boolean} true if parameter has initialized
     */
    self.hasInitialized = function() {
        return _hasInitialized;
    };

    /**
     * Get viewer view
     *
     * @returns {Object} viewer view
     */
    self.getViewerView = function() {
        return _viewerView;
    };

    /**
     * Get viewer context
     *
     * @returns {Object} viewer context
     */
    self.getViewerContext = function() {
        return _viewerContext;
    };

    /**
     * Set pv open config
     *
     * @param {Object} pvOpenConfig target object
     */
    self.setPVOpenConfig = function( pvOpenConfig ) {
        _pvOpenConfig = pvOpenConfig;
    };

    /**
     * Get pv open config
     *
     * @returns {Object} pv open config object
     */
    self.getPVOpenConfig = function() {
        return _pvOpenConfig;
    };

    /**
     * Set security marking handler key
     *
     * @param {Function} key security marking handler
     */
    self.setSecurityMarkingHandlerKey = function( key ) {
        _securityMarkingHandlerKey = key;
    };

    /**
     * Get security marking handler
     *
     * @returns {Function} security marking handler
     */
    self.getSecurityMarkingHandlerKey = function() {
        return _securityMarkingHandlerKey;
    };

    /**
     * Set security marking handler
     *
     * @param {Function} securityMarkingHandler security marking handler
     */
    self.setSecurityMarkingHandler = function( securityMarkingHandler ) {
        _securityMarkingHandler = securityMarkingHandler;
    };

    /**
     * Get security marking handler
     *
     * @returns {Function} security marking handler
     */
    self.getSecurityMarkingHandler = function() {
        return _securityMarkingHandler;
    };

    /**
     * Set reconcile handler
     *
     * @param {Function} reconcileHandler reconcile handler
     * @return {function} _reconcileHandler function
     */
    self.setReconcileHandler = function( reconcileHandler ) {
        return _reconcileHandler = reconcileHandler;
    };

    /**
     * Get reconcile handler
     *
     * @returns {Function} reconcile handler
     */
    self.getReconcileHandler = function() {
        return _reconcileHandler;
    };

    /**
     * Set if this is a 2D renderer
     * @param {Object} is2DRenderer 2D Renderer
     */
    self.set2DRenderer = function( is2DRenderer ) {
        _is2DRenderer = is2DRenderer;
    };

    /**
     * Set if apply bookmark is applicable for session/product
     *
     * @param {Boolean} applybookmark is applicable or not for session/product
     */
    self.setApplyBookmarkApplicable = function( applybookmark ) {
        _isApplyBookmarkApplicable = applybookmark;
    };

    /**
     * Get if applybookmark is applicable for session/product
     * @return {Boolean} Gets flag isApplyBookmarkApplicable
     */
    self.isApplyBookmarkApplicable = function() {
        return _isApplyBookmarkApplicable;
    };

    /**
     * Disables bookmark for sesssion/product
     *
     * @param {Boolean} disableBookMark is applicable or not for session/product
     */
    self.setDisableBookMarkApplicable = function( disableBookMark ) {
        _disableBookMark = disableBookMark;
    };

    /**
     * Get if disableBookMark is applicable for session/product
     * @return {Boolean} disable bookmark flag
     */
    self.isDisableBookMarkApplicable = function() {
        return _disableBookMark;
    };

    /**
     * Renders Suppressed elements in the viewer.
     *
     * @param {Boolean} showSuppressed should render suppressed elements
     */
    self.setShowSuppressed = function( showSuppressed ) {
        _showSuppressed = showSuppressed;
    };

    /**
     * Get if the viewer should show suppressed elements
     * @returns {Boolean} returns showSuppressed flag
     */
    self.isShowSuppressed = function() {
        return _showSuppressed;
    };

    /**
     * Get if this is a 2D renderer
     *
     * @returns {Object} 2D Renderer
     */
    self.get2DRenderer = function() {
        return _is2DRenderer;
    };

    /**
     * Set viewer Atomic data
     *
     * @param {Object} viewerAtomicData viewer atomic data
     */
    self.setViewerAtomicData = function( viewerAtomicData ) {
        _viewerAtomicData = viewerAtomicData;
    };

    /**
     * Gets topElement or selected Model object
     * @returns {Object} model object
     */
    self.getTopElementOrSelectedModelObj = function() {
        return _modelObject;
    };

    /**
     * Sets topElement or selected Model Object
     * @param {Object} modelObject model object
     */
    self.setTopElementOrSelectedModelObj = function( modelObject ) {
        _modelObject = modelObject;
    };

    /**
     * Boolean indicating if hosting is enabled.
     *
     * @param {Boolean} hostingEnabled is hosting enabled
     */
    self.setHostingEnabled = function( hostingEnabled ) {
        _isHostingEnabled = hostingEnabled;
    };

    /**
     * Get if viewer is in hosted mode
     * @returns {Boolean} returns isHostingEnabled flag
     */
    self.isHostingEnabled = function() {
        return _isHostingEnabled;
    };

    /**
     * Get the viewer atomic data
     *
     * @returns {Object} viewer atomic data
     */
    self.getViewerAtomicData = function() {
        return _viewerAtomicData;
    };

    /**
     * Set is part viewer
     *
     * @param {Object} isPartViewer boolean indication if it's part viewer
     */
    self.setIsPartViewer = function( isPartViewer ) {
        _isPartViewer = isPartViewer;
    };

    /**
     * Get is part viewer
     *
     * @returns {Boolean} true for part viewer
     */
    self.isPartViewer = function() {
        return _isPartViewer;
    };

    /**
     * Sets if Delta update supported or not
     *
     * @param {Boolean} deltaUpdateSupported is delta update supported or not
     */
    self.setDeltaUpdateSupported = function( deltaUpdateSupported ) {
        _deltaUpdateSupported = deltaUpdateSupported;
    };

    /**
     * Get if delta update delta update supported or not
     * @return {Boolean} delta update supported flag
     */
    self.isDeltaUpdateSupported = function() {
        return _deltaUpdateSupported;
    };

    /**
     * Set children then depth first parameter flag
     *
     * @param {Boolean} enableChildrenThenDepthFirst enable children then depth first
     */
    self.setChildrenThenDepthFirstParameter = function( enableChildrenThenDepthFirst ) {
        _enableChildrenThenDepthFirst = enableChildrenThenDepthFirst;
    };

    /**
     * Get if children then depth first parameter
     * @return {Boolean} children then depth first parameter flag
     */
    self.getChildrenThenDepthFirstParameter = function() {
        return _enableChildrenThenDepthFirst;
    };

    /**
     * Sets bookmark instance
     * @param {Object} bookmarkProviderInstance auto bookmark provider instance
     */
    self.setBookmarkProviderInstance = function( bookmarkProviderInstance ) {
        _bookmarkProviderInstance = bookmarkProviderInstance;
    };

    /**
     *  Get bookmark instance
     * @returns {Object} auto bookmark provider instance
     */
    self.getBookmarkProviderInstance = function() {
        return _bookmarkProviderInstance;
    };

    /**
     * Set is opening product snapshot
     * @param {Boolean} isOpeningProductSnapshot is opening product snapshot
     * */
    self.setIsOpeningProductSnapshot = function( isOpeningProductSnapshot ) {
        _isOpeningProductSnapshot = isOpeningProductSnapshot;
    };

    /**
     * Get is opening product snapshot
     * @returns {Boolean} isOpeningProductSnapshot flag
     * */
    self.isOpeningProductSnapshot = function() {
        return _isOpeningProductSnapshot;
    };

    /**
     * This utility function helps to create the viewer parameters that needs to be passed to a
     * function to load the viewer
     *
     * @returns {Object} View parameter object that is required while loading viewer
     */
    var _createViewerLoadParams = function() {
        var location = browserUtils.getWindowLocation();
        var cursorUrlRelativePath = location.pathname + getBaseUrlPath() + '/cursor';
        return new window.JSCom.Render.View.Params( _viewerContainer, parseInt( _width ),
            parseInt( _height ), cursorUrlRelativePath );
    };

    /**
     * Creates the viewer view
     *
     * @returns {Object} Viewer view
     */
    var _createViewerView = function() {
        return new window.JSCom.Render.View( _createViewerLoadParams() );
    };

    /**
     * This utility function helps to create the viewer parameters that needs to be passed to a
     * function to load the viewer
     */
    self.initializeViewerContext = function() {
        _hasInitialized = true;
        _viewerView = _createViewerView();
        var viewerCtxName = self.getViewerCtxNamespace();
        var vType = self.getViewerType();
        if( _.isUndefined( viewerCtxName ) || _.isNull( viewerCtxName ) ||
            _.isEmpty( viewerCtxName ) ) {
            viewerCtxName = DEFAULT_VIEWER_CONTEXT;
        }

        if( _.isUndefined( vType ) || _.isNull( vType ) || _.isEmpty( vType ) ) {
            vType = viewerContextService.ViewerType.JsViewer;
        }

        if( viewerContextService.isServerless() && !self.get2DRenderer() && ( _.isUndefined( _psLoader ) || _.isNull( _psLoader ) || _.isEmpty( _psLoader ) ) ) {
            let additionalSettings = null;
            if( !_.isNull( _enableChildrenThenDepthFirst ) ) {
                additionalSettings = {};
                additionalSettings.enableChildrenThenDepthFirst = _enableChildrenThenDepthFirst;
            }
            _psLoader = new CadPageExpandRequest( _bomlineProviderFn, _isPartViewer ? _targetObject : null, additionalSettings );
            _psLoader.setDeltaUpdateSupported( _deltaUpdateSupported );
        }
        _viewerContext = viewerContextService.registerViewerContext( viewerCtxName, vType, _viewerView, self.get2DRenderer(), _viewerAtomicData, _psLoader, self.getBookmarkProviderInstance() );
    };
};

export default {
    getDefaultViewerNamespace,
    createViewerLoadParams,
    updateViewerContextWithVisibility,
    updateViewerVisibility,
    updateIsBomWindowShared,
    getViewerLoadInputParameters,
    loadByModelObjectInputParam
};
