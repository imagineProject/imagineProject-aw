
// Copyright (c) 2021 Siemens

/**
 * This service is create viewer context data
 *
 * @module js/viewerContextDataProvider
 */
import viewerSelectionManagerProvider from 'js/viewerSelectionManagerProvider';
import AwPromiseService from 'js/awPromiseService';
import ViewerVisibilityManagerProvider from 'js/viewerVisibilityManagerProvider';
import viewerMeasurementManagerProvider from 'js/viewerMeasurementManagerProvider';
import viewerMotionManagerProvider from 'js/viewerMotionManagerProvider';
import viewer3DMarkupManagerProvider from 'js/viewer3dMarkupManagerProvider';
import viewerVisualReportLegendProvider from 'js/viewerVisualReportLegendManagerProvider';
import viewerPmiManagerProvider from 'js/viewerPmiManagerProvider';
import viewerRefSetManagerProvider from 'js/viewerRefSetManagerProvider';
import viewerProximityManagerProvider from 'js/viewerProximityManagerProvider';
import viewerVolumeManagerProvider from 'js/viewerVolumeManagerProvider';
import viewerImageCaptureManagerProvider from 'js/viewerImageCaptureManagerProvider';
import viewerSectionManagerProvider from 'js/viewerSectionManagerProvider';
import viewerCriteriaColoringManagerProvider from 'js/viewerCriteriaColoringManagerProvider';
import viewerDrawTrislingManagerProvider from 'js/viewerDrawTrislingManagerProvider';
import viewerVqSceneManagerProvider from 'js/viewerVqSceneManagerProvider';
import viewerSnapshotManagerProvider from 'js/viewerSnapshotManagerProvider';
import viewerPerformanceManagerProvider from 'js/viewerPerformanceManagerProvider';
import viewerThreeDViewManagerProvider from 'js/viewerThreeDViewManagerProvider';
import viewerSessionManagerProvider from 'js/viewerSessionManagerProvider';
import viewerContextMenuManagerProvider from 'js/viewerContextMenuManagerProvider';
import viewerPartitionManagerProvider from 'js/viewerPartitionManagerProvider';
import viewerLeafStructureManagerProvider from 'js/viewerLeafStructureManagerProvider';
import viewerAssetsManagerProvider from 'js/viewerAssetsManagerProvider';
import ViewerProgressIndicator from 'js/viewerProgressIndicator';
import ViewerAtomicDataSubject from 'js/viewerAtomicDataSubject';
import viewerPreferenceService from 'js/viewerPreference.service';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import appCtxService from 'js/appCtxService';
import AwTimeoutService from 'js/awTimeoutService';
import viewerSessionStorageService from 'js/viewerSessionStorageService';
import _ from 'lodash';
import _logger from 'js/logger';
import eventBus from 'js/eventBus';
import '@swf/ClientViewer';
import dialogService from 'js/dialogService';
import viewerKeyboardManagerProvider from 'js/viewerKeyboardManagerProvider';
import { ViewerCadPageDeltaUpdateManager } from 'js/viewerCadPageDeltaUpdateManager';
import viewerContextService from 'js/viewerContext.service';
// import 'manipulator';

var crashCounterMap = {};

/**
 * Provides an instance of viewer interaction service
 *
 * @param {String} viewerCtxNamespace Viewer context namespace to be registered
 * @param {String} viewerType Type of viewer
 * @param {Object} viewerView Viewer view reference
 * @param {boolean} is2D is 2D viewer loaded
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Object} psLoader product structure loader
 * @return {ViewerContextData} Returns viewer context data object
 */
export let getViewerContextData = function( viewerCtxNamespace, viewerType, viewerView, is2D, viewerAtomicData, psLoader, bookmarkProviderInstance ) {
    return new ViewerContextData( viewerCtxNamespace, viewerType, viewerView, is2D, viewerAtomicData, psLoader, bookmarkProviderInstance );
};

/**
 * Class to hold the viewer context data
 *
 * @constructor ViewerContextData
 *
 * @param {String} viewerCtxNamespace Viewer context namespace to be registered
 * @param {String} viewerType Type of viewer
 * @param {Object} viewerView Viewer view reference
 * @param {boolean} is2D is 2D viewer loaded
 * @param {Object} viewerAtomicData viewer atomic data
 * @param {Object} psLoader product structure loader
 */
var ViewerContextData = function( viewerCtxNamespace, viewerType, viewerView, is2D, viewerAtomicData, psLoader, bookmarkProviderInstance ) {
    var self = this;

    var m_is2D = _.isNull( is2D ) || _.isUndefined( is2D ) ? false : is2D;

    var m_viewerCtxNamespace = viewerCtxNamespace;
    var m_viewerAtomicData = viewerAtomicData;
    var m_viewerType = viewerType;
    var m_viewerView = viewerView;
    let m_psloader = psLoader;
    const m_bookmarkProviderInstance = bookmarkProviderInstance;
    var m_viewerConnectionCloseListeners = [];
    var m_viewerConnectionProblemListeners = [];
    var m_viewerLongPressListeners = [];
    var m_viewerSelectionManager = null;
    var m_viewerVisibilityManager = null;
    var m_viewerMeasurementManager = null;
    var m_viewerMotionManager = null;
    var m_viewerProgressIndicator = null;
    var m_viewer3DMarkupManager = null;
    var m_viewerVisualReportLegendManager = null;
    var m_viewerCtxService = null;
    var m_pmiMgr = null;
    var m_refSetMgr = null;
    var m_modelViewMgr = null;
    var m_proximityMgr = null;
    var m_volumeMgr = null;
    var m_snapshotMgr = null;
    var m_imgCapturemgr = null;
    var m_sectionMgr = null;
    var m_criteriaColoringMgr = null;
    var m_drawMgr = null;
    var m_vqSceneMgr = null;
    var m_performanceMgr = null;
    var m_threeDViewMgr = null;
    var m_sessionMgr = null;
    var m_partitionMgr = null;
    var m_contextMenuMgr = null;
    var m_viewerAssetsMgr = null;
    var m_viewerLeafStructureMgr = null;
    var m_isClosed = false;
    var m_viewerAtomicDataSubject = null;
    var m_featureEdgesBadTopoErrorDisplayed = false;
    let _memoryThresholdWarningShown = false;
    let m_viewerKeybrdMgr = null;
    let m_highlightedPartForHover = null;
    let m_viewerContainerElement = null;
    let m_viewerCadPageDeltaUpdateManager = null;

    // list of notification topics
    self.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS = 'subCommandsToolbarActiveStatusChanged';
    self.CLEANUP_3D_VIEWER = 'cleanup3DViewer';
    self.PRODUCT_SNAPSHOT_APPLIED = 'productSnapShotApplied';
    self.IMAGE_CAPTURE_CONTAINER = 'imageCaptureContainer';
    self.DELTA_UPDATE_COMPLETED = 'deltaUpdateCompleted';
    self.APPLY_DELTA_UPDATE = 'applyDeltaUpdate';
    self.AUTO_SAVE_VIS_BOOKMARK = 'autoSaveVisbookmark';
    self.SUBNODE_VISIBILITY_CHANGED = 'subnodeVisibilityChanged';
    self.ViewerSearchActions = {
        SET_VISIBLE: window.JSCom.Consts.SearchAction.SET_VISIBLE,
        SET_VIEW_ONLY: window.JSCom.Consts.SearchAction.SET_VIEW_ONLY,
        SET_INVISIBLE: window.JSCom.Consts.SearchAction.SET_INVISIBLE
    };

    self.OccOptions = {
        VISIBILITY: window.JSCom.Consts.OccOptions.VISIBILITY,
        SELECTION: window.JSCom.Consts.OccOptions.SELECTION,
        REFSET: window.JSCom.Consts.OccOptions.REFSET
    };


    /** Error Handler */
    var errorHandler = {
        error: function( err ) {
            if( err.name === 'TcVisLicenseLevelInsuffcientError' ) {
                _logger.error( 'Error: ' + err.message );
            } else if( err.name === 'TcVisClientSelectionLimitError' ) {
                let errorMessage = self.getThreeDViewerMsg( 'AreaSelectLimitExceededText' );
                let numberOfParts = _.toString( err.message );
                let splitOnFirstParentheses = numberOfParts.split( '[' );
                let splitOnSecondParentheses = splitOnFirstParentheses[ 1 ].split( ']' );
                errorMessage = _.replace( errorMessage, '{0}', splitOnSecondParentheses[ 0 ] );
                viewerPreferenceService.getSelectionLimit().then( ( selectionLimit ) => {
                    errorMessage = _.replace( errorMessage, '{1}', _.toString( selectionLimit ) );
                    messagingService.showInfo( errorMessage );
                } );
            } else if( err.name === 'BadTopomeshMeasurementError' || err.name === 'BadTopomeshSectionError' || err.name === 'BadTopomeshError' ) {
                let errorMessage = self.getThreeDViewerMsg( 'SectionMeasurementBadTopomeshErrorMessage' );
                messagingService.showError( errorMessage );
            } else if( err.name === 'BadTopomeshDisplayError' && !m_featureEdgesBadTopoErrorDisplayed ) {
                let errorMessage = self.getThreeDViewerMsg( 'FeatureEdgesBadTopomeshErrorMessage' );
                messagingService.showError( errorMessage );
                m_featureEdgesBadTopoErrorDisplayed = true;
            }
        }
    };

    /**
     * Return if this is a 2D view or not
     * @returns {Boolean} true if 2D view
     */
    self.getIs2D = function() {
        return m_is2D;
    };
    /**
     * Add viewer connection close listener
     *
     * @param {Object} observerFunction function to be registered
     * @param {Object} functionContext context in which function should run
     */
    self.addViewerConnectionCloseListener = function( observerFunction, functionContext ) {
        if( typeof observerFunction === 'function' ) {
            m_viewerConnectionCloseListeners.push( { observerFunction: observerFunction, functionContext: functionContext } );
        }
    };

    /**
     * remove viewer connection close listener
     *
     * @param {Object} observerFunction function to be removed
     */
    self.removeViewerConnectionCloseListener = function( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            var indexToBeRemoved = m_viewerConnectionCloseListeners.map( function( item ) { return item.observerFunction; } ).indexOf( observerFunction );
            if( indexToBeRemoved > -1 ) {
                m_viewerConnectionCloseListeners.splice( indexToBeRemoved, 1 );
            }
        }
    };

    /**
     * remove viewer connection close listener
     *
     * @param {Object} observerFunction function to be removed
     */
    var notifyViewerConnectionClose = function() {
        if( m_viewerConnectionCloseListeners.length > 0 ) {
            _.forEach( m_viewerConnectionCloseListeners, function( observerEntry ) {
                observerEntry.observerFunction.call( observerEntry.functionContext, self );
            } );
        }
    };

    /**
     * Add viewer connection problem listener
     *
     * @param {Object} observerFunction function to be registered
     * @param {Object} functionContext context in which function should run
     */
    self.addViewerConnectionProblemListener = function( observerFunction, functionContext ) {
        if( typeof observerFunction === 'function' ) {
            m_viewerConnectionProblemListeners.push( { observerFunction: observerFunction, functionContext: functionContext } );
        }
    };

    /**
     * Remove viewer connection problem listener
     *
     * @param {Object} observerFunction function to be removed
     */
    self.removeViewerConnectionProblemListener = function( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            var indexToBeRemoved = m_viewerConnectionProblemListeners.map( function( item ) { return item.observerFunction; } ).indexOf( observerFunction );
            if( indexToBeRemoved > -1 ) {
                m_viewerConnectionProblemListeners.splice( indexToBeRemoved, 1 );
            }
        }
    };

    /**
     * Notify viewer connection problem listener
     *
     * @param {Object} observerFunction function to be removed
     */
    var notifyViewerConnectionProblem = function() {
        self.closeActiveDialog();
        AwTimeoutService.instance( function() {
            if( m_viewerConnectionProblemListeners.length > 0 ) {
                _.forEach( m_viewerConnectionProblemListeners, function( observerEntry ) {
                    observerEntry.observerFunction.call( observerEntry.functionContext, self );
                } );
            }
        } );
    };

    /**
     * Listener for memory consumption warning to user
     */
    self.viewerMemoryWarning = function() {
        let renderSupportInfo = viewerSessionStorageService.getViewerDataFromSessionStorage( 'renderSupportInfo' );
        if( !_memoryThresholdWarningShown ) {
            if( renderSupportInfo.isSSRSupported ) {
                messagingService.showWarning( self.getThreeDViewerMsg( 'sessionMemoryExceededWarning' ), [ {
                    addClass: 'btn btn-notify',
                    text: self.getThreeDViewerMsg( 'continue' ),
                    onClick: ( $noty ) => {
                        $noty.close();
                    }
                }, {
                    addClass: 'btn btn-notify',
                    text: self.getThreeDViewerMsg( 'switchToSSR' ),
                    onClick: ( $noty ) => {
                        $noty.close();
                        self.updateViewerAtomicData( 'renderLocation', 'SSR' );
                        m_viewerAtomicDataSubject.notify( self.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, { isActivated: false } );
                    }
                } ] );
            } else {
                messagingService.showWarning( self.getThreeDViewerMsg( 'sessionMemoryExceededWarningWithNoSSR' ) );
            }
            _memoryThresholdWarningShown = true;
        }
    };

    /**
     * Add viewer long press listener
     *
     * @param {Object} observerFunction function to be registered
     * @param {Object} functionContext context in which function should run
     */
    self.addViewerLongPressListener = function( observerFunction, functionContext ) {
        if( typeof observerFunction === 'function' ) {
            m_viewerLongPressListeners.push( { observerFunction: observerFunction, functionContext: functionContext } );
        }
    };

    /**
     * Remove viewer long press listener
     * @param {Object} observerFunction function to be removed
     */
    self.removeViewerLongPressListener = function( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            var indexToBeRemoved = m_viewerLongPressListeners.map( function( item ) { return item.observerFunction; } ).indexOf( observerFunction );
            if( indexToBeRemoved > -1 ) {
                m_viewerLongPressListeners.splice( indexToBeRemoved, 1 );
            }
        }
    };

    /**
     * Notify viewer long press
     *
     * @param {Object} observerFunction function to be removed
     */
    var notifyViewerLongPress = function() {
        if( m_viewerLongPressListeners.length > 0 ) {
            _.forEach( m_viewerLongPressListeners, function( observerEntry ) {
                observerEntry.observerFunction.call( observerEntry.functionContext, self );
            } );
        }
    };

    /**
     * Get viewer context namespace
     */
    self.getViewerCtxNamespace = function() {
        return m_viewerCtxNamespace;
    };

    /**
     * specifies the type of viewer.
     * @returns {String} viewer type string
     */
    self.getViewerType = function() {
        return m_viewerType;
    };

    /**
     * Context data for viewer. It will be a view object for js viewer.
     */
    var getContextData = function() {
        return m_viewerView;
    };

    /**
     * @deprecated This api should not be used, use managers instead of calling viewer view apis' directly
     */
    self.getViewerView = function() {
        return m_viewerView;
    };

    /**
     * get PS loader
     * @returns {Object} returns ps loader instance
     */
    self.getPsLoader = function() {
        return m_psloader;
    };

    /**
     * Set the zoom direction reversed
     *
     * @param {boolean} isReversed boolean specifying if zoom direction should be reversed.
     */
    self.setZoomReversed = function( isReversed ) {
        if( getContextData().navigationMgr ) {
            getContextData().navigationMgr.setZoomReversed( isReversed );
        }
    };

    /**
     * Set the viewer view size
     *
     * @param {Number} width width to be set
     * @param {Number} height height to be set
     */
    self.setSize = function( width, height ) {
        if( getContextData() && _.isNumber( width ) && _.isNumber( height ) && width > 0 && height > 0 ) {
            getContextData().setSize( width, height );
        }
    };

    /**
     * Get the viewer view size
     */
    self.getSize = function() {
        return getContextData().getSize();
    };

    /**
     * Set the page
     */
    self.setCurrentPage = function( page ) {
        return getContextData().setCurrentPage( page );
    };

    /**
     * returns the viewer container element
     * @returns {Object} viewerContainer element
     */
    self.getViewerContainerElement = function() {
        return m_viewerContainerElement;
    };

    /**
     * sets the viewer container element
     * @param {Object} viewerContainerElement viewer container element
     */
    self.setViewerContainerElement = function( viewerContainerElement ) {
        m_viewerContainerElement = viewerContainerElement;
    };

    /**
     * Fit the 2D view
     */
    self.fit2DView = function() {
        return getContextData().fit2DView();
    };

    /**
     * Clockwise Rotate the 2D view 90 degree
     */
    self.rotate2DCW90 = function() {
        return getContextData().rotate2DCW90();
    };

    /**
     * Counter Clockwise Rotate the 2D view 90 degree
     */
    self.rotate2DCCW90 = function( page ) {
        return getContextData().rotate2DCCW90();
    };

    /**
     * Set the mouse move functionality.  If try, mouse move pans.
     * If false, mouse move zooms.
     */
    self.setMouseMovePan = function( bPan ) {
        return getContextData().setMouseMovePan( bPan );
    };

    /**
     * Set the viewport based on the center of the markup and the zoom factor
     * in effect when the markup was created.
     */
    self.set2DViewport = function( originalScale, cntrX, cntrY ) {
        return getContextData().set2DViewport( originalScale, cntrX, cntrY );
    };

    /**
     * Get the navigation manager
     */
    self.getNavigationManager = function() {
        return getContextData().navigationMgr;
    };

    /**
     * Get the navigation manager
     */
    self.getThreeDViewManager = function() {
        return m_threeDViewMgr;
    };

    /**
     * Get the selection manager
     */
    self.getSelectionManager = function() {
        return m_viewerSelectionManager;
    };

    /**
     * Get the measurement manager
     */
    self.getMeasurementManager = function() {
        return m_viewerMeasurementManager;
    };

    /**
     * Get the motion manager
     */
    self.getMotionManager = function() {
        return m_viewerMotionManager;
    };

    /**
     * Get the measurement manager
     */
    self.getViewerProgressIndicator = function() {
        return m_viewerProgressIndicator;
    };

    /**
     * Get the 3D Markup manager
     */
    self.get3DMarkupManager = function() {
        return m_viewer3DMarkupManager;
    };

    /**
     * Get the 3D Visual Report Legend manager
     */
    self.getVisualReportLegendManager = function() {
        return m_viewerVisualReportLegendManager;
    };

    /**
     * Get the selection manager
     */
    self.getVisibilityManager = function() {
        return m_viewerVisibilityManager;
    };

    /**
     * Get the PMI manager
     */
    self.getPmiManager = function() {
        return m_pmiMgr;
    };

    /**
     * Get the reference set manager
     */
    self.getRefSetManager = function() {
        return m_refSetMgr;
    };

    /**
     * Get the Model View PMI manager
     */
    self.getModelViewManager = function() {
        return m_modelViewMgr;
    };

    /**
     * Get the Proximity manager
     */
    self.getProximityManager = function() {
        return m_proximityMgr;
    };

    /**
     * Get the Volume manager
     */
    self.getVolumeManager = function() {
        return m_volumeMgr;
    };

    /**
     * Get the snapshot manager
     */
    self.getSnapshotManager = function() {
        return m_snapshotMgr;
    };

    /**
     * Get the Session manager
     */
    self.getSessionMgr = function() {
        return m_sessionMgr;
    };

    /**
     * Get the Partition manager
     */
    self.getPartitionMgr = function() {
        return m_partitionMgr;
    };

    /**
     * Get the section manager
     * @returns {Object} Section manager instance
     */
    self.getSectionManager = function() {
        return m_sectionMgr;
    };

    /**
     * Get the draw manager
     * @returns {Object} Draw manager instance
     */
    self.getDrawManager = function() {
        return m_drawMgr;
    };

    self.getSearchMgr = function() {
        return m_viewerView.searchMgr;
    };

    self.getDynamicUpdateMgr = function() {
        return m_viewerView.dynamicUpdateMgr;
    };
    /**
     * Get the context menu manager
     * @returns {Object} context menu manager instance
     */
    self.getContextMenuMgr = function() {
        return m_contextMenuMgr;
    };
    /**
     * Get the Viewer Assets manager
     * @returns {Object} context assets manager instance
     */
    self.getViewerAssetsMgr = function() {
        return m_viewerAssetsMgr;
    };


    /**
     * Get the keyboard manager
     * @returns {Object} context menu manager instance
     */
    self.getViewerKeyboardMgr = function() {
        return m_viewerKeybrdMgr;
    };

    /**
     * Get the leaf structure manager
     * @returns {Object} Leaf structure manager instance
     */
    self.getViewerLeafStructureMgr = function() {
        return m_viewerLeafStructureMgr;
    };


    self.getViewerAtomicDataSubject = function() {
        return m_viewerAtomicDataSubject;
    };

    /**
     * Set viewer context service
     *
     * @param {Object} viewerCtxSvc ctx service
     */
    self.setViewerCtxSvc = function( viewerCtxSvc ) {
        m_viewerCtxService = viewerCtxSvc;
    };

    /**
     * Update the selection display mode
     *
     * @function styleSelection
     *
     * @param {Boolean} isUseTransparency - true if UseTransparency option should be turned on
     */
    self.styleSelection = function( isUseTransparency ) {
        m_viewerCtxService.styleSelection( self, isUseTransparency );
    };

    /**
     * Set alternate pci availability
     *
     * @function setAlternatePCI
     *
     * @param {Boolean} hasAlternatePCI - true if PCI being loaded has alternate indexed PCI
     */
    self.setHasAlternatePCI = function( hasAlternatePCI ) {
        m_viewerCtxService.updateViewerApplicationContext( m_viewerCtxNamespace,
            m_viewerCtxService.VIEWER_HAS_ALTERNATE_PCI_TOKEN, hasAlternatePCI );
    };

    /**
     * Get alternate pci availability
     *
     * @function getAlternatePCI
     *
     * @returns {Boolean} true if PCI being loaded has alternate indexed PCI
     */
    self.getHasAlternatePCI = function() {
        return m_viewerCtxService.getViewerApplicationContext( m_viewerCtxNamespace,
            m_viewerCtxService.VIEWER_HAS_ALTERNATE_PCI_TOKEN );
    };

    /**
     * Update current viewer product context
     *
     * @param {Object} modelObject Model object
     */
    self.updateCurrentViewerProductContext = function( modelObject ) {
        this.updateViewerAtomicData( m_viewerCtxService.VIEWER_CURRENT_PRODUCT_CONTEXT_TOKEN, modelObject );
    };

    /**
     * Update selected on command visibility
     *
     * @param {Boolean} isVisible true if command should be visible
     */
    self.updateSelectedOnCommandVisibility = function( isVisible ) {
        this.updateViewerAtomicData( m_viewerCtxService.VIEWER_SELECTED_ON_VISIBILITY_TOKEN, isVisible );
    };

    /**
     * Update selected off command visibility
     *
     * @param {Boolean} isVisible true if command should be visible
     */
    self.updateSelectedOffCommandVisibility = function( isVisible ) {
        this.updateViewerAtomicData( m_viewerCtxService.VIEWER_SELECTED_OFF_VISIBILITY_TOKEN, isVisible );
    };

    /**
     * Update context on command visibility
     *
     * @param {Boolean} isVisible true if command should be visible
     */
    self.updateContextOnCommandVisibility = function( isVisible ) {
        this.updateViewerAtomicData( m_viewerCtxService.VIEWER_CONTEXT_ON_VISIBILITY_TOKEN, isVisible );
    };

    /**
     * Get viewer current product context
     */
    self.getCurrentViewerProductContext = function() {
        return self.getValueOnViewerAtomicData( m_viewerCtxService.VIEWER_CURRENT_PRODUCT_CONTEXT_TOKEN );
    };

    /**
     * Get viewer context service
     *
     * @returns {Object} Viewer ctx service
     */
    self.getViewerCtxSvc = function() {
        return m_viewerCtxService;
    };

    /**
     * Get viewer message for key
     * @param {String} key local text key
     * @returns {String} localized text
     */
    self.getThreeDViewerMsg = function( key ) {
        var localTextBundle = localeService.getLoadedText( 'Awv0threeDViewerMessages' );
        return localTextBundle[ key ];
    };

    /**
     * Viewer connection problem listener
     *
     * @param {JSCom.EMM.BadConnectionStateError} badConnectionStateError error message
     */
    self.viewerConnectionProblemListener = function( badConnectionStateError ) {
        var currentNameSpace = self.getViewerCtxNamespace();
        if( badConnectionStateError.name === 'SessionTerminatedError' ) {
            if( !crashCounterMap.hasOwnProperty( currentNameSpace ) ) {
                crashCounterMap[ currentNameSpace ] = 0;
            }
            crashCounterMap[ currentNameSpace ] = crashCounterMap[ currentNameSpace ] + 1;
            if( crashCounterMap[ currentNameSpace ] < 4 ) {
                messagingService.showInfo( self.getThreeDViewerMsg( 'internalError' ) );
                notifyViewerConnectionProblem();
            } else {
                crashCounterMap[ currentNameSpace ] = 0;
                messagingService.showError( self.getThreeDViewerMsg( 'repeatedFailure' ) );
            }
        } else {
            messagingService.showInfo( self.getThreeDViewerMsg( 'attemptVisServerReconnect' ) );
            notifyViewerConnectionProblem();
        }
    };

    /**
     * Viewer Long Press listener
     */
    self.viewerLongPressListener = function() {
        notifyViewerLongPress();
    };

    /**
     * Get the Image Capture manager
     * @returns {Object} Returns ImageCapture manager
     */
    self.getImageCaptureManager = function() {
        return m_imgCapturemgr;
    };

    /**
     * Get if final draw is done in view
     * @return {Promise} Promise that is resolved when final draw is done in viewer
     */
    self.getFinalDrawCompleted = function() {
        return getContextData().waitForFinalDraw();
    };

    /**
     * Get the criteria coloring manager
     * @returns {Object} Returns CrtiteriaColoring manager
     */
    self.getCriteriaColoringManager = function() {
        return m_criteriaColoringMgr;
    };

    /**
     * Get the Trisling draw manager
     * @returns {Object} Returns DrawTrisling manager
     */
    self.getDrawTrislingManager = function() {
        return m_drawMgr;
    };

    /**
     * Get the VQScene manager
     * @returns {Object} Returns VqScene manager
     */
    self.getVqSceneManager = function() {
        return m_vqSceneMgr;
    };

    /**
     * Get the Performance Manager
     * @returns {Object} Returns performance manager
     */
    self.getPerformanceManager = function() {
        return m_performanceMgr;
    };

    /**
     * Get viewer cad delta update manager
     * @returns {Object} Returns cad delta update manager
     */
    self.getViewerCadPageDeltaUpdateManager = function() {
        return m_viewerCadPageDeltaUpdateManager;
    };

    /**
     * Set the update view callback function
     * @param {Function} callback call back function for view update
     */
    self.setViewUpdateCallback = function( callback ) {
        getContextData().setViewUpdateCallback( callback );
    };

    /**
     * boolean indicating is view is MMV enabled
     * @returns {Boolean} boolean indicating is view is MMV enabled
     */
    self.isMMVRendering = function() {
        return getContextData().isMMVRendering();
    };

    /**
     * boolean indicating if Server side render possible in view
     * @returns {Boolean} boolean indicating if Server side render possible in view
     */
    self.isServerSideRenderPossible = function() {
        return getContextData().isServerSideRenderPossible();
    };

    /**
     * update viewer atomic data
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue vlaue to be set on that path
     */
    self.updateViewerAtomicData = function( propertyPath, propertyValue ) {
        if( m_viewerAtomicData ) {
            const newViewerAtomicData = { ...m_viewerAtomicData.getValue() };
            _.set( newViewerAtomicData, propertyPath, propertyValue );
            m_viewerAtomicData.update( newViewerAtomicData );
            m_viewerAtomicDataSubject.notify( propertyPath, propertyValue );
        }
    };

    /**
     * get viewer atomic data value
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @returns {Object} value on requested property path
     */
    self.getValueOnViewerAtomicData = function( propertyPath ) {
        if( m_viewerAtomicData ) {
            return _.get( m_viewerAtomicData.getValue(), propertyPath );
        }

        return null;
    };

    /**
     * Sets atomic data on viewerContextData
     * @param {Object} viewerAtomicData viewer atomic data
     */
    self.setViewerAtomicData = function( viewerAtomicData ) {
        m_viewerAtomicData = viewerAtomicData;
    };

    /**
     * Gets atomic data on viewerContextData
     * @returns {Object} viewer atomic data
     */
    self.getViewerAtomicData = function() {
        return m_viewerAtomicData;
    };

    /**
     * Gets occurence management context key
     */
    self.getOccmgmtContextKey = function() {
        return self.getValueOnViewerAtomicData( 'occmgmtContextKey' );
    };

    /**
     * Activate sub command toolbar
     *
     * @param {String} commandId command id
     * @returns {boolean} true if sub command bar was activated
     */
    self.toggleSubCommandsToolbar = function( commandId ) {
        let isViewerSubCommandToolbarActive = self.getValueOnViewerAtomicData( m_viewerCtxService.VIEWER_IS_SUB_COMMANDS_TOOLBAR_ENABLED );
        let viewerSubCommandCommand = self.getValueOnViewerAtomicData( m_viewerCtxService.VIEWER_SUB_COMMANDS_LIST );
        let isActivated = false;
        if( isViewerSubCommandToolbarActive && viewerSubCommandCommand && viewerSubCommandCommand[ commandId ] ) {
            viewerSubCommandCommand[ commandId ] = false;
        } else {
            if( !viewerSubCommandCommand ) {
                viewerSubCommandCommand = {};
            }
            viewerSubCommandCommand[ commandId ] = true;
            isActivated = true;
        }
        self.updateViewerAtomicData( m_viewerCtxService.VIEWER_SUB_COMMANDS_LIST, viewerSubCommandCommand );
        self.updateViewerAtomicData( m_viewerCtxService.VIEWER_IS_SUB_COMMANDS_TOOLBAR_ENABLED, isActivated );
        m_viewerAtomicDataSubject.notify( self.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, { isActivated: isActivated, commandId: commandId } );
        return isActivated;
    };

    /**
     * Close sub command toolbar
     */
    self.closeSubCommandsToolbar = function() {
        if( this.getValueOnViewerAtomicData( m_viewerCtxService.VIEWER_IS_SUB_COMMANDS_TOOLBAR_ENABLED ) ) {
            self.updateViewerAtomicData( m_viewerCtxService.VIEWER_IS_SUB_COMMANDS_TOOLBAR_ENABLED, false );
            m_viewerAtomicDataSubject.notify( self.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, { isActivated: false } );
        }
    };

    self.closeActiveDialog = function() {
        let dialogToolAndInfo = appCtxService.getCtx( 'activeToolsAndInfoCommand_dialog' );
        if( dialogToolAndInfo && dialogToolAndInfo.commandId ) {
            let viewId = self.getValueOnViewerAtomicData( m_viewerCtxService.VIEWER_ACTIVE_DIALOG_ENABLED );
            if( viewId && !_.isEmpty( viewId ) ) {
                dialogService.closeDialog( 'INFO_PANEL_CONTEXT', viewId );
                self.updateViewerAtomicData( m_viewerCtxService.VIEWER_ACTIVE_DIALOG_ENABLED, null );
            }
        } else {
            //firing the complete event should be removed once all sidenavs are converted to dialogs
            let activeToolAndInfoCmd = appCtxService.getCtx( 'activeToolsAndInfoCommand' );
            if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                let eventData = {
                    source: 'toolAndInfoPanel'
                };
                eventBus.publish( 'complete', eventData );
            }
        }
    };

    /**
     * Sets Memory threshold
     * @param {Number} memoryThreshold memory threshold limit
     */
    self.setMemoryThreshold = function( memoryThreshold ) {
        let view = getContextData();
        if( view.setMemoryThreshold ) {
            view.setMemoryThreshold( memoryThreshold );
        }
    };

    /**
     * Get memory threashold
     */
    self.getMemoryThreshold = () => {
        let memoryThresholdLimit = 4298;
        if( window.memoryThreshold ) {
            //workaround to set threshold through developer console
            memoryThresholdLimit = window.memoryThreshold;
        } else if( window.performance && window.performance.memory && window.performance.memory.jsHeapSizeLimit ) {
            //supported in chromium based browser chrome and edge
            memoryThresholdLimit = window.performance.memory.jsHeapSizeLimit / 1000000;
        }
        //80% of threshold should be used
        memoryThresholdLimit = 0.8 * memoryThresholdLimit;
        return memoryThresholdLimit;
    };

    /**
     * Gets AFX PVW initialization values
     */
    self.getAfxPVWInitializationValues = function() {
        let view = getContextData();
        if( view.getAfxPVWInitializationValues ) {
            return view.getAfxPVWInitializationValues();
        }
    };

    /**
     * Initialize the Viewer Context Data
     * @param {Object} viewerCtxSvc viewer context service instance
     */
    self.initialize = function( viewerCtxSvc ) {
        if( viewerCtxSvc ) {
            self.setViewerCtxSvc( viewerCtxSvc );
        }
        let activeManagers = [];
        let  isServerless = viewerCtxSvc.isServerless();
        if( isServerless ) {
            m_viewerView.setServerlessMode( true );
        }
        if( m_viewerType === 'JsViewer' ) {
            m_viewerAtomicDataSubject = new ViewerAtomicDataSubject();

            if( m_viewerView.listenerMgr !== null ) {
                m_viewerProgressIndicator = new ViewerProgressIndicator( m_viewerView, self );
            }

            m_viewerAssetsMgr = viewerAssetsManagerProvider.getViewerAssetsManager( self );

            if( m_viewerView.measurementMgr !== null ) {
                m_viewerMeasurementManager = viewerMeasurementManagerProvider.getViewerMeasurementManager( m_viewerView, self );
                activeManagers.push( 'measurementMgr' );
            }
            if( m_viewerView.motionMgr !== null ) {
                m_viewerMotionManager = viewerMotionManagerProvider.getViewerMotionManager( m_viewerView, self );
                activeManagers.push( 'motionMgr' );
            }

            if( m_viewerView.viewMarkupMgr !== null ) {
                m_viewer3DMarkupManager = viewer3DMarkupManagerProvider.getViewer3DMarkupManager(
                    m_viewerView, self );
                activeManagers.push( 'viewMarkupMgr' );
            }

            if( m_viewerView.coloringMgr !== null ) {
                m_viewerVisualReportLegendManager = viewerVisualReportLegendProvider.getViewerVisualReportLegendManager(
                    m_viewerView, self );
                activeManagers.push( 'visualReportLegendMgr' );
            }

            if( m_viewerView.pmiMgr !== null ) {
                m_pmiMgr = viewerPmiManagerProvider.getPmiManager( m_viewerView, self );
                activeManagers.push( 'pmiMgr' );
            }

            if( m_viewerView.refSetMgr !== null ) {
                m_refSetMgr = viewerRefSetManagerProvider.getRefSetManager( m_viewerView, self );
                activeManagers.push( 'refSetMgr' );
            }

            if( m_viewerView.modelViewMgr !== null  ) {
                m_modelViewMgr = viewerPmiManagerProvider.getModelViewManager( m_viewerView, self );
                activeManagers.push( 'modelViewMgr' );
            }

            if( m_viewerView.proximityMgr !== null  ) {
                m_proximityMgr = viewerProximityManagerProvider.getProximityManager( m_viewerView, self );
                activeManagers.push( 'proximityMgr' );
            }

            if( m_viewerView.volumeMgr !== null  ) {
                m_volumeMgr = viewerVolumeManagerProvider.getVolumeManager( m_viewerView, self );
                activeManagers.push( 'volumeMgr' );
            }

            if( m_viewerView.contextMenuMgr !== null  ) {
                m_contextMenuMgr = viewerContextMenuManagerProvider.getContextMenuManager( m_viewerView, self );
                activeManagers.push( 'contextMenuMgr' );
            }

            if( m_viewerView.imageCaptureMgr !== null  ) {
                m_imgCapturemgr = viewerImageCaptureManagerProvider.getImgCaptureManager( m_viewerView, self );
                activeManagers.push( 'imageCaptureMgr' );
            }

            if( m_viewerView.sectionMgr !== null ) {
                m_sectionMgr = viewerSectionManagerProvider.getViewerSectionManager(
                    m_viewerView, self );
                activeManagers.push( 'sectionMgr' );
            }

            if( m_viewerView.criteriaColoringMgr !== null  ) {
                m_criteriaColoringMgr = viewerCriteriaColoringManagerProvider.getCriteriaColoringManager( viewerCtxNamespace,
                    m_viewerView, self );
                activeManagers.push( 'criteriaColoringMgr' );
            }

            if( m_viewerView.drawMgr !== null ) {
                m_drawMgr = viewerDrawTrislingManagerProvider.getViewerDrawManager( viewerCtxNamespace, m_viewerView, self );
                activeManagers.push( 'drawMgr' );
            }

            if( m_viewerView.vqSceneMgr !== null  ) {
                m_vqSceneMgr = viewerVqSceneManagerProvider.getVqSceneMgr( viewerCtxNamespace, m_viewerView, self );
                activeManagers.push( 'vqSceneMgr' );
            }

            if( m_viewerView.snapshotMgr !== null ) {
                m_snapshotMgr = viewerSnapshotManagerProvider.getSnapshotManager( m_viewerView, self );
                activeManagers.push( 'snapshotMgr' );
            }

            if( m_viewerView.performanceMgr !== null  ) {
                m_performanceMgr = viewerPerformanceManagerProvider.getPerformanceManager( viewerCtxNamespace, m_viewerView, self );
                activeManagers.push( 'performanceMgr' );
            }

            if( m_viewerView.threeDViewMgr !== null  ) {
                m_threeDViewMgr = viewerThreeDViewManagerProvider.getThreeDViewManager( viewerCtxNamespace, m_viewerView, self );
                activeManagers.push( 'threeDViewMgr' );
            }

            if( m_viewerView.sessionMgr !== null  ) {
                m_sessionMgr = new viewerSessionManagerProvider( m_viewerView, self, m_bookmarkProviderInstance );
                activeManagers.push( 'sessionMgr' );
            }

            if( m_viewerView.partitionMgr !== null  ) {
                m_partitionMgr = viewerPartitionManagerProvider.getPartitionManager( viewerCtxNamespace, m_viewerView, self );
                activeManagers.push( 'partitionMgr' );
            }

            if( m_viewerView.productStructureMgr !== null  ) {
                m_viewerLeafStructureMgr = viewerLeafStructureManagerProvider.getLeafStructureManager( m_viewerView, self );
                activeManagers.push( 'productStructureMgr' );
            }

            m_viewerSelectionManager = viewerSelectionManagerProvider.getViewerSelectionManager( m_viewerView, self );

            m_viewerKeybrdMgr = viewerKeyboardManagerProvider.getViewerKeyboardManager( self );


            m_viewerVisibilityManager = new ViewerVisibilityManagerProvider( m_viewerView, self );

            if( isServerless ) {
                m_viewerCadPageDeltaUpdateManager = new ViewerCadPageDeltaUpdateManager( self );
            }
            if( m_viewerView.listenerMgr !== null ) {
                m_viewerView.listenerMgr.addConnectionProblemListener( self.viewerConnectionProblemListener );
                m_viewerView.listenerMgr.addLongPressListener( self.viewerLongPressListener );
                if( m_viewerView.listenerMgr.addMemoryUsageListener ) {
                    m_viewerView.listenerMgr.addMemoryUsageListener( self.viewerMemoryWarning );
                }
                activeManagers.push( 'listenerMgr' );
            }

            self.updateViewerAtomicData( 'activeManagers', activeManagers );
            setUpErrorHandler( true, errorHandler );
        }
    };

    /**
     * Setup/Remove error handler (Internal)
     * @param  {Boolean} enable true if to attach error handler
     * @param  {Object} customErrorHandler error handler object
     */
    function setUpErrorHandler( enable, customErrorHandler ) {
        window.JSCom.EMM.ViewerErrorHandler.useHandlerCustom( enable, customErrorHandler );
    }

    /**
     * @returns {Boolean} returns if connection is closed
     */
    self.isConnectionClosed = function() {
        return m_isClosed;
    };

    /**
     * registers for on mouse move event and sets the tooltip span location
     */
    self.registerOnMouseMoveEvent = () => {
        this.tooltipParentDomElement = self.getViewerContainerElement().parentElement;
        this.tooltipParentDomElement.onmousemove = ( e ) => {
            this.mousePositionX = e.clientX;
            this.mousePositionY = e.clientY;
        };
    };

    self.updateTooltipPosition = () => {
        this.tooltipSpan = self.getViewerContainerElement().nextElementSibling;
        this.tooltipSpan.style.top = this.mousePositionY + 20 + 'px';
        this.tooltipSpan.style.left = this.mousePositionX + 20 + 'px';
    };

    /**
    * deregisters the on mouse move event
    */
    self.deregisterOnMouseMoveEvent = () => {
        if( this.tooltipParentDomElement ) {
            this.tooltipParentDomElement.onmousemove = null;
        }
        this.m_hoverTooltipTimeoutPromise = null;
    };

    /**
     * Callback function for highlight
     * @param {Object} obj highlighted object
     */
    let callbackForHighlight = ( obj ) => {
        let highlightId = null;
        if( obj && !_.isNull( obj.occurence ) ) {
            highlightId = obj.occurence.theStr;
        }
        if( m_highlightedPartForHover !== highlightId ) {
            if ( this.m_hoverTooltipTimeoutPromise ) {
                AwTimeoutService.instance.cancel( this.m_hoverTooltipTimeoutPromise );
                this.m_hoverTooltipTimeoutPromise = null;
            }
            m_highlightedPartForHover = highlightId;
            if ( obj.name !== '' ) {
                self.updateViewerAtomicData( 'highlightedPartName', obj.name );
                this.updateTooltipPosition();
                this.m_hoverTooltipTimeoutPromise = AwTimeoutService.instance( function() {
                    self.updateViewerAtomicData( 'highlightedPartName', null );
                }, 5000 );
            } else {
                self.updateViewerAtomicData( 'highlightedPartName', null );
            }
        }
    };

    /**
     * pre highlight hover registration
     * @param {Boolean} isRegister register or deregister the mouse event for hover
     * @param {Object} viewerContextData viewer context data
     */
    self.highlightPartsOnMouseHoverChanged = ( isRegister ) => {
        if( isRegister ) {
            self.registerOnMouseMoveEvent();
        } else {
            self.deregisterOnMouseMoveEvent();
        }
        self.getNavigationManager().enableHoverTooltip( isRegister, callbackForHighlight );
    };

    /**
     * update pre highlight delay and mouse hover delay to show tooltip
     * @param {float} prehighlightDelay pre highlight hover delay
     */
    self.hoverHighlightDelayChanged = ( prehighlightDelay ) => {
        self.getNavigationManager().setHoverDelay( {
            prehighlightDelay: prehighlightDelay * 1000,
            mouseOverDelay: prehighlightDelay * 1000
        } );
    };

    /**
     * Stores the flat buffer of the session
     * @param {ArrayBuffer} flatBuffer flat buffer of the session
     */
    self.setFlatBuffer = ( flatBuffer ) => {
        self.sessionFlatBuffer = flatBuffer;
    };

    /**
     * Gets the flat buffer of the session
     * @returns {ArrayBuffer} returns the flat buffer of the session
     */
    self.getFlatBuffer = () => {
        return self.sessionFlatBuffer;
    };

    /**
     * Set the current product context info
     * @param {Object} productContextInfo product context info
     */
    self.setCurrentProductContextInfo = ( productContextInfo ) => {
        self.productContextInfo = productContextInfo;
    };

    /**
     * Get the current product context info
     * @returns {Object} returns the current product context info
     */
    self.getCurrentProductContextInfo = () => {
        return self.productContextInfo;
    };

    /**
     * Close the viewer view
     * @returns {Promise} returns promise that resolved when view is closed
     */
    self.close = function() {
        if( m_isClosed ) {
            return AwPromiseService.instance.resolve();
        }
        m_viewerView.listenerMgr.removeConnectionProblemListener( self.viewerConnectionProblemListener );
        m_viewerView.listenerMgr.removeLongPressListener( self.viewerLongPressListener );
        if( m_viewerView.listenerMgr.removeMemoryUsageListener ) {
            m_viewerView.listenerMgr.removeMemoryUsageListener( self.viewerMemoryWarning );
        }
        setUpErrorHandler( false, errorHandler );
        notifyViewerConnectionClose();
        m_isClosed = true;
        return getContextData().shutdown();
    };
};

export default {
    getViewerContextData
};
