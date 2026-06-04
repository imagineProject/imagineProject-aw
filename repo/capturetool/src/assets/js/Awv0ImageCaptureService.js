// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0ImageCaptureService
 */
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import dmSvc from 'soa/dataManagementService';
import fmSvc from 'soa/fileManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import viewerCtxService from 'js/viewerContext.service';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';
import viewerCtxSvc from 'js/viewerContext.service';
import viewerMarkupSvc from 'js/viewerMarkupService';
import viewerContextService from 'js/viewerContext.service';
import localeService from 'js/localeService';

let exports = {};
let _imageCaptureToolAndInfoPanelCloseEventSubscription = null;
let _awp0MarkupEditMainEventSubscription = null;
const BUTTON_CLASS = 'btn btn-notify';
const AW_SUBLOCATION = 'ActiveWorkspace:SubLocation';
const OCC_SUBLOCATION = 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation';
const EWI_SUBLOCATION = 'com.siemens.splm.client.ewi:ewiSubLocation';
const SHOWOBJ_SUBLOCATION = 'showObject';
let _avoidUnsubscribe = false;
let _timeoutPromise = null;

/**
 * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
let WEB_XML_FMS_PROXY_CONTEXT = 'fms';

/**
 * Relative path to the FMS proxy download service.
 */
let CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/';

/**
 * On load of Image capture panel
 * @param {Object} imageCapturePanelData Image capture atomic data
 * @param {Object} subPanelContext subpanel context
 */
export let imageCapturePanelRevealed = function( imageCapturePanelData, subPanelContext ) {
    let viewerContextData = subPanelContext && subPanelContext.viewerContextData ? subPanelContext.viewerContextData : null;
    if( viewerContextData ) {
        const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
        imageCapturePanelDataValue.updateImageCaptureContextData = !imageCapturePanelDataValue.updateImageCaptureContextData;
        imageCapturePanelData.update( imageCapturePanelDataValue );
        eventBus.publish( 'Awp0MarkupMain.contentUnloaded', {} );
        let markupCtx = appCtxSvc.getCtx( 'markup' );
        if( !markupCtx ) {
            appCtxSvc.registerCtx( 'markup', {} );
            markupCtx = appCtxSvc.getCtx( 'markup' );
        }
        markupCtx.showPanel = false;
        appCtxSvc.updateCtx( 'markup', markupCtx );
        _subscribeForAwp0MarkupEditMainEvent();
        _subscribeForImageCapturePanelCloseEvent();
        viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, subPanelContext.subPanelContext.popupOptions.popupId );
        exports.populateCaptureList( imageCapturePanelData, viewerContextData );
        viewerContextData.updateViewerAtomicData( 'activeCaptureGalleryTab', 'InputImageCapture' );
    }
};

/**
 * populate existing capture list from context object
 * @param {Object} imageCapturePanelData Image capture atomic data
 * @param {Object} viewerContextData viewer context data
 */
export let populateCaptureList = function( imageCapturePanelData, viewerContextData ) {
    const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
    if( !imageCapturePanelDataValue.isImageCaptureContextPinned ) {
        let capturedList = [];
        let relationFilter = {
            relationTypeName: 'Fnd0ViewCapture'
        };
        let preferenceInfo = {
            info: [ relationFilter ]
        };
        const contextObject = getContextObject( viewerContextData, imageCapturePanelData );
        let inputData = {
            primaryObjects: [ contextObject ],
            pref: preferenceInfo
        };
        let policy = getPropertyPolicies();
        propertyPolicySvc.register( policy );
        soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData ).then(
            function( result ) {
                if( policy ) {
                    propertyPolicySvc.unregister( policy );
                }
                let captureObjects = result.ServiceData.modelObjects;
                const currentCaptureContext = { ...imageCapturePanelData.getValue() };
                if( captureObjects ) {
                    _.forEach( captureObjects, function( captureObject ) {
                        let captureDataType = captureObject.type;
                        if( captureDataType === 'SnapShotViewData' ) {
                            capturedList.push( captureObject );
                        }
                    } );
                    //Sort images in decending order based on created date
                    capturedList.sort( ( capturedObjA, capturedObjB ) => {
                        let createdDateA = new Date( capturedObjA.props.creation_date.dbValues[ '0' ] );
                        let createdDateB = new Date( capturedObjB.props.creation_date.dbValues[ '0' ] );
                        return createdDateB - createdDateA;
                    } );
                    currentCaptureContext.listOfImageCaptureObjects = capturedList;
                    currentCaptureContext.updateImageCaptureList = !currentCaptureContext.updateImageCaptureList;
                }
                currentCaptureContext.updateImageCaptureContextData = !currentCaptureContext.updateImageCaptureContextData;
                imageCapturePanelData.update( currentCaptureContext );
            },
            function() {
                logger.error( 'SOA error :: expandGRMRelations (Fnd0ViewCapture) failed.' );
            } );
    }
};

/**
 * set the pin state on the selection
 * @param {Object} commandContext command context
 */
export let pinImageCaptureContext = function( commandContext ) {
    let selectedObj = appCtxSvc.getCtx( 'selected' );
    const imageCapturePanelDataValue = { ...commandContext.itemOptions.imageCapturePanelData.getValue() };
    imageCapturePanelDataValue.isImageCaptureContextPinned = true;
    imageCapturePanelDataValue.pinnedReferenceObject = selectedObj.props.awb0UnderlyingObject;
    commandContext.itemOptions.imageCapturePanelData.update( imageCapturePanelDataValue );
};

/**
 * set the unpin state on the selection
 * @param {Object} imageCapturePanelData image capture panel data
 */
export let unPinImageCaptureContext = function( imageCapturePanelData ) {
    const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
    imageCapturePanelDataValue.isImageCaptureContextPinned = false;
    imageCapturePanelDataValue.pinnedReferenceObject = null;
    imageCapturePanelData.update( imageCapturePanelDataValue );
};

/**
 * Get all captures data
 *
 * @param {String} searchCriteria searchString for filter
 * @param {Object} imageCapturePanelData image capture atomic data
 * @returns {Object} The list of image capture objects
 */
export let getAllImageCapturesData = function( searchCriteria, imageCapturePanelData ) {
    const imageCapturePanelDataValue = imageCapturePanelData.getValue();
    let imageCapturesData = [];
    if( Array.isArray( imageCapturePanelDataValue.listOfImageCaptureObjects ) &&
        imageCapturePanelDataValue.listOfImageCaptureObjects.length > 0 ) {
        imageCapturesData = imageCapturePanelDataValue.listOfImageCaptureObjects;
        if( !_.isNull( searchCriteria.searchString ) &&
            !_.isUndefined( searchCriteria.searchString ) &&
            !_.isEmpty( searchCriteria.searchString ) ) {
            let filterString = searchCriteria.searchString;
            let filteredListOfImageCaptureObjs = [];
            for( let i = 0; i < imageCapturesData.length; i++ ) {
                let objectFiltered = false;
                let objectName = imageCapturesData[ i ].props.awp0CellProperties.dbValues[ 0 ].split( ':' );
                if( _.includes( objectName[ 1 ].toUpperCase(), filterString.toUpperCase() ) ) {
                    objectFiltered = true;
                }
                let objectDescription = imageCapturesData[ i ].props.awp0CellProperties.dbValues[ 1 ].split( ':' );
                if( _.includes( objectDescription[ 1 ].toUpperCase(), filterString.toUpperCase() ) ) {
                    objectFiltered = true;
                }
                let owningUser = imageCapturesData[ i ].props.awp0CellProperties.dbValues[ 2 ].split( ':' );
                if( _.includes( owningUser[ 1 ].toUpperCase(), filterString.toUpperCase() ) ) {
                    objectFiltered = true;
                }
                if( objectFiltered ) {
                    filteredListOfImageCaptureObjs.push( imageCapturesData[ i ] );
                }
            }
            return {
                imageCapturesData: filteredListOfImageCaptureObjs,
                imageCapturesDataLength: filteredListOfImageCaptureObjs.length
            };
        }
    }
    return {
        imageCapturesData: imageCapturesData,
        imageCapturesDataLength: imageCapturesData.length
    };
};

let _subscribeForAwp0MarkupEditMainEvent = function() {
    if( _awp0MarkupEditMainEventSubscription === null ) {
        _awp0MarkupEditMainEventSubscription = eventBus.subscribe( 'awsidenav.openClose', function(
            eventData ) {
            if( eventData.commandId === 'Awp0MarkupEditMain' ) {
                let markupCtx = appCtxSvc.getCtx( 'markup' );
                if( !markupCtx ) {
                    appCtxSvc.registerCtx( 'markup', {} );
                    markupCtx = appCtxSvc.getCtx( 'markup' );
                }
                markupCtx.showPanel = true;
                appCtxSvc.updateCtx( 'markup', markupCtx );
            }
        } );
    }
};
/**
 * Clear previous selection and populate capture list
 * @param {Object} imageCapturePanelData Image capture panel data
 * @param {Object} viewerContextData viewer context data
 */
export let clearPreviousSelectionAndPopulateCaptureList = function( imageCapturePanelData, viewerContextData ) {
    let aceActiveContextKey = appCtxSvc.getCtx( 'aceActiveContext' ).key;
    if( viewerContextData && aceActiveContextKey === viewerContextData.getOccmgmtContextKey() ) {
        deactivateCapturedObject( viewerContextData, imageCapturePanelData );
        viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
        viewerContextData.getImageCaptureManager().closeImageCaptureView();
        AwTimeoutService.instance( function() {
            exports.populateCaptureList( imageCapturePanelData, viewerContextData );
        }, 200 );
    }
};

/**
 * Clear previous selection
 * @param {Object} dataProvider image capture data provider
 * @param {Object} imageCapturePanelData local atomic data
 * @param {Object} viewerContextData viewer context data
 */
export let clearPreviousImageCaptureSelection = function( dataProvider, imageCapturePanelData, viewerContextData ) {
    let viewModelObject = dataProvider.selectedObjects;
    if( viewModelObject && viewModelObject.length > 0 && dataProvider.selectionModel ) {
        dataProvider.selectionModel.setSelection( [] );
        deactivateCapturedObject( viewerContextData, imageCapturePanelData );
        viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
        viewerContextData.getImageCaptureManager().closeImageCaptureView();
        updateImageCapturePanelData( imageCapturePanelData, 'lastActiveCaptureObj', null );
    }
};

let getViewerContextData = function() {
    let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
    let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
    let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
    return viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
};

/**
 * Update Image capture panel data
 */
let updateImageCapturePanelData = ( imageCapturePanelData, propertyPath, value ) => {
    const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
    imageCapturePanelDataValue[ propertyPath ] = value;
    imageCapturePanelData.update( imageCapturePanelDataValue );
};

/**
 * Subscribe for image capture panel close event
 * @param {String} viewId view id for active panel
 */
let _subscribeForImageCapturePanelCloseEvent = function() {
    if( _imageCaptureToolAndInfoPanelCloseEventSubscription === null ) {
        _imageCaptureToolAndInfoPanelCloseEventSubscription = eventBus.subscribe( 'appCtx.register', function(
            eventData ) {
            //All panels are not yet converted to dialogs. Once that is done, sidenavCommandId_dialog event should be used instead.
            if( eventData.name === 'activeToolsAndInfoCommand' ) {
                if( _.isUndefined( eventData.value ) || _.isNull( eventData.value ) ) {
                    _timeoutPromise = AwTimeoutService.instance( function() {
                        unSubscribeForImageCapturePanelCloseEvent();
                    }, 500 );
                } else {
                    if( eventData.value.commandId === 'Awp0Markup' || eventData.value.commandId === 'Awp0MarkupEditMain' ||
                        eventData.value.commandId === 'Awp0MarkupMain' || eventData.value.commandId === 'Awv0CaptureGallery' ) {
                        _avoidUnsubscribe = true;
                        if( _timeoutPromise ) {
                            AwTimeoutService.instance.cancel( _timeoutPromise );
                            _timeoutPromise = null;
                        }
                        if( eventData.value.commandId === 'Awp0MarkupEditMain' ) {
                            viewerMarkupSvc.updateMarkupContext();
                        }
                    } else {
                        unSubscribeForImageCapturePanelCloseEvent();
                    }
                }
            }
        }, 'Awv0ImageCapture' );
    }
};

/**
 * Unsubscribe for image capture panel close event
 */
let unSubscribeForImageCapturePanelCloseEvent = function() {
    try {
        if( _imageCaptureToolAndInfoPanelCloseEventSubscription !== null ) {
            eventBus.unsubscribe( _imageCaptureToolAndInfoPanelCloseEventSubscription );
            _imageCaptureToolAndInfoPanelCloseEventSubscription = null;
        }

        if( _awp0MarkupEditMainEventSubscription !== null ) {
            eventBus.unsubscribe( _awp0MarkupEditMainEventSubscription );
            _awp0MarkupEditMainEventSubscription = null;
        }
        let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
        let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
        let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
        let viewerContextData = viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
        if( viewerContextData ) {
            viewerContextData.getImageCaptureManager().closeImageCaptureView();
        }
        _cleanupMarkupCtx();
        viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
    } catch ( e ) {
        logger.warn( 'Failed to close gallery panel since the viewer is not alive' + e );
    }
};

/**
 * activate or deactivate the capture depending on selection/deselection
 * @param {Object} dataProvider image capture data provider
 * @param {Object} imageCapturePanelData local atomic data
 * @param {Object} viewerContextData viewer context data
 */
export let onSelectionChange = function( dataProvider, imageCapturePanelData, viewerContextData ) {
    let viewModelObject = dataProvider.selectedObjects;
    if( viewModelObject.length !== 0 ) {
        activateCapturedObject( viewModelObject[ 0 ], viewerContextData, imageCapturePanelData );
        _cleanupMarkupCtx();
        viewerCtxService.setMarkupCommandVisibility( true, viewModelObject[ 0 ], viewerContextData );
    } else {
        deactivateCapturedObject( viewerContextData, imageCapturePanelData );
        viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
        updateImageCapturePanelData( imageCapturePanelData, 'lastActiveCaptureObj', null );
    }
};

/**
 * Clean up markup context
 */
let _cleanupMarkupCtx = function() {
    let markupCtx = appCtxSvc.getCtx( 'markup' );
    if( !markupCtx ) {
        markupCtx = {};
        appCtxSvc.registerCtx( 'markup', markupCtx );
    }
    markupCtx.showPanel = false;
    markupCtx.showMarkups = false;
    markupCtx.supportedTools = null;
    appCtxSvc.updateCtx( 'markup', markupCtx );
};

/**
 * Cleanup image capture data on panel closure
 * @param {Object} imageCapturePanelData image capture panel data
 * @param {Object} viewerContextData viewer context data
 */
export let cleanupImageCapturePanel = function( imageCapturePanelData, viewerContextData ) {
    if( appCtxSvc.getCtx( 'activeToolsAndInfoCommand.commandId' ) !== 'Awv0CaptureGallery' ) {
        exports.unPinImageCaptureContext( imageCapturePanelData );
    }
    if( !_avoidUnsubscribe ) {
        unSubscribeForImageCapturePanelCloseEvent();
    }
    _avoidUnsubscribe = false;
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, null );
};

/**
 * Create image capture
 *
 * @param {String} captureName image capture name
 * @param {String} captureDesc image capture description
 * @param {Object} imageCapturePanelData image capture panel data
 * @param {Object} viewerContextData viewer context data
 */
export let createImageCapture = function( captureName, captureDesc, imageCapturePanelData, viewerContextData ) {
    const contextObject = getContextObject( viewerContextData, imageCapturePanelData );
    if( contextObject && contextObject.uid ) {
        viewerContextData.getImageCaptureManager().captureImage( contextObject.uid, captureName, captureDesc ).then( function( resultUid ) {
            exports.loadCreatedCapture( resultUid, imageCapturePanelData );
        } );
    }
};

/**
 * activate or deactivate the capture depending on selection/deselection
 * @param {Object} dataProvider list data provider
 * @param {Object} imageCapturePanelData image capture panel data
 */
export let setExistingSelection = function( dataProvider, imageCapturePanelData ) {
    let viewModelCollection = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let lastActiveCaptureObj = imageCapturePanelData.getValue().lastActiveCaptureObj;
    for( let i = 0; i < viewModelCollection.length; i++ ) {
        let imageCaptureObj = viewModelCollection[ i ];
        if( lastActiveCaptureObj && lastActiveCaptureObj.uid === imageCaptureObj.uid ) {
            dataProvider.selectionModel.setSelection( [ imageCaptureObj ] );
            break;
        }
    }
};
/**
 * Load the created captured object.
 * @param {Object} resultUid image cpature uid
 *  @param {Object} imageCapturePanelData image capture panel data
 */
export let loadCreatedCapture = function( resultUid, imageCapturePanelData ) {
    let policy = getPropertyPolicies();
    propertyPolicySvc.register( policy );
    dmSvc.loadObjects( [ resultUid ] ).then( function() {
        if( policy ) {
            propertyPolicySvc.unregister( policy );
        }
        let imageCaptureObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmSvc
            .getObject( resultUid ), 'EDIT' );
        const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
        imageCapturePanelDataValue.activeView = 'Awv0ImageCaptureListSub';
        imageCapturePanelDataValue.listOfImageCaptureObjects.unshift( imageCaptureObject );
        imageCapturePanelDataValue.updateImageCaptureList = !imageCapturePanelDataValue.updateImageCaptureList;
        imageCapturePanelDataValue.lastActiveCaptureObj = imageCaptureObject;
        imageCapturePanelData.update( imageCapturePanelDataValue );
    }, function() {
        logger.error( 'SOA error :: cannot load objects.' );
    } );
};

/**
 * Launch mark up panel
 * @param {Object} commandId command id
 * @param {Object} vmo view model object
 * @param {Object} imageCapturePanelData image capture panel data
 * @param {Object} dialogAction dialog action
 */
export let launchMarkup = function( commandId, vmo, imageCapturePanelData, dialogAction ) {
    vmo.selected = true;
    let viewerContextData = getViewerContextData();
    let promise = activateCapturedObject( vmo, viewerContextData, imageCapturePanelData );
    promise.then( function() {
        let onScreen2dMarkupCtx = viewerContextData.getValueOnViewerAtomicData( 'onScreen2dMarkupContext' );
        onScreen2dMarkupCtx.element = viewerContextData.getImageCaptureManager().getElementForMarkup();
        onScreen2dMarkupCtx.dialogAction = dialogAction;
        if( onScreen2dMarkupCtx.vmo && onScreen2dMarkupCtx.type && onScreen2dMarkupCtx.element && onScreen2dMarkupCtx.dialogAction ) {
            viewerContextService.activateViewerCommandDialog( commandId, onScreen2dMarkupCtx );
        }
    }, function() {
        logger.error( 'launchMarkup (activateCapturedObject) failed.' );
    } );
};

/**
 * Activate the current selected capture
 * @param {Object} viewModelObject view model object
 * @param {Object} viewerContext viewer context
 * @returns {Promise} on resolve sets image in 2D viewer
 * @param {Object} imageCapturePanelData image capture panel data
 */
let activateCapturedObject = function( viewModelObject, viewerContextData, imageCapturePanelData ) {
    updateImageCapturePanelData( imageCapturePanelData, 'lastActiveCaptureObj', viewModelObject );
    return ensureResolveImageUrlFromObject( viewModelObject ).then( function( resultUrl ) {
        viewerContextData.getImageCaptureManager().displayImageCapture( resultUrl,
            viewModelObject, true );
    }, function() {
        logger.error( 'Image URL for captured image could not be retrieved.' );
    } );
};

/**
 * deactivate the current selected capture.
 * @param {Object} viewerContextData viewer context data
 * @param {Object} imageCapturePanelData image capture panel data
 */
let deactivateCapturedObject = function( viewerContextData, imageCapturePanelData ) {
    let captureObjCameraToBeApplied = imageCapturePanelData.getValue().lastActiveCaptureObj;
    AwTimeoutService.instance( function() {
        try {
            viewerContextData.getImageCaptureManager().deactivateCapturedObject( captureObjCameraToBeApplied );
            captureObjCameraToBeApplied = null;
        } catch {
            logger.warn( 'Failed to close gallery panel since the viewer is not alive' );
        }
    } );
};

/**
 *  Ensure the file reference property is loaded before trying resolving the image url. This method is going to the
 * server, thus more costly, so only call this when needed info is not available on client.
 * @param {Object} targetObj targetObj
 * @returns {Promise} on resolve returns image url
 */
let ensureResolveImageUrlFromObject = function( targetObj ) {
    let objects = [];
    objects.push( targetObj );
    return dmSvc.getProperties( objects, [ 'ref_list' ] )
        .then( function() {
            return resolveImageUrlFromObject( targetObj );
        } ).then( function( resultUrl ) {
            return resultUrl;
        } ).catch( ( e ) => {
            logger.error( 'properties are not loaded. ' + e );
        } );
};

/**
 * Try resolving the image url from given capture object.
 * @param {Object} targetObj targetObj
 * @returns {Promise} on resolve returns image url
 */
let resolveImageUrlFromObject = function( targetObj ) {
    let returnPromise = AwPromiseService.instance.defer();
    let refList = null;
    if( targetObj !== null ) {
        refList = targetObj.props.ref_list;
    }
    if( refList === null ) {
        logger.error( 'Ref-list property in capture data set is null.' );
    } else {
        let fileList = refList.dbValues;
        let imageFiles = refList.uiValues;
        let imanFiles = cdmSvc.getObjects( fileList );

        if( fileList === null ) {
            logger.error( 'File reference in capture data set is empty.' );
        } else {
            let imanFile = pullHDImageFromRefList( imageFiles );
            let promiseIman = processImanObject( imanFiles[ imanFile ] );
            promiseIman.then( function( resultUrl ) {
                returnPromise.resolve( resultUrl );
            }, function() {
                logger.error( 'failed to process iman object' );
            } );
        }
    }
    return returnPromise.promise;
};

/**
 * Get image file reference from the files list for the image capture
 * @param {Object} refList list of file references
 * @returns {Number} index
 */
let pullHDImageFromRefList = function( refList ) {
    let index;
    for( let i = 0; i < refList.length; i++ ) {
        if( refList[ i ] !== null ) {
            let name = refList[ i ];
            if( name !== null && name.match( '.png$' ) ) {
                index = i;
                break;
            }
        }
    }
    return index;
};

/**
 *  Retrieve a uri for a Iman model object.
 * @param {Object} imanFile iman model object.
 * @returns {Promise} on resolve returns image url
 */
let processImanObject = function( imanFile ) {
    let returnPromise = AwPromiseService.instance.defer();
    if( imanFile !== null ) {
        let objects = [];
        objects[ 0 ] = imanFile;
        fmSvc.getFileReadTickets( objects ).then( function( result ) {
            let ticket = result.tickets[ 1 ];
            let fileName = fmsUtils.getFilenameFromTicket( ticket[ 0 ] );
            let uri = buildUrlFromFileTicket( ticket, fileName );
            returnPromise.resolve( uri );
        }, function() {
            logger.error( 'Returned file ticket is null.' );
        } );
    }
    return returnPromise.promise;
};

/**
 * Build url from a file ticket.
 *
 * @param {String} fileTicket - The file ticket
 * @param {String} openFileName - open file with this name.
 * @return {String} url
 */
let buildUrlFromFileTicket = function( fileTicket, openFileName ) {
    let fileName = '';
    if( openFileName && openFileName.length > 0 ) {
        fileName = encodeURIComponent( openFileName );
    } else {
        fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    }

    let downloadUri = CLIENT_FMS_DOWNLOAD_PATH + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    let baseUrl = browserUtils.getBaseURL();
    return baseUrl + downloadUri;
};

/**
 * update name and description of capture
 * @param {Object} imageCapturePanelData image capture data
 */
export let updateCaptureNameAndDescription = function( imageCapturePanelData ) {
    let selection = null;
    let selectedObjectName = null;
    const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
    if( imageCapturePanelDataValue.isImageCaptureContextPinned ) {
        selection = cdmSvc.getObject( imageCapturePanelDataValue.pinnedReferenceObject.dbValues[ 0 ] );
        selectedObjectName = selection.props.object_name.dbValues[ 0 ];
    } else {
        selection = getCurrentSelection( getViewerContextData() );
        selectedObjectName = selection[ 0 ].props.object_string.dbValues[ 0 ];
    }
    var localeTextBundle = localeService.getLoadedText( 'ImageCaptureToolMessages' );
    let captureString = localeTextBundle.defaultCatpureStringPrefix.replace( '{0}', selectedObjectName );
    imageCapturePanelDataValue.activeView = 'Awv0ImageCaptureCreateSub';
    imageCapturePanelDataValue.captureName = captureString;
    imageCapturePanelDataValue.captureDescription = captureString;
    imageCapturePanelData.update( imageCapturePanelDataValue );
};

/**
 * get current selection of
 * @param {Object} imageCapturePanelData image capture panel data
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} contains selection and total found
 */
export let getImageCaptureContext = function( imageCapturePanelData, viewerContextData ) {
    if( imageCapturePanelData.getValue().isImageCaptureContextPinned || !viewerContextData ) {
        return;
    }
    let selection = getCurrentSelection( viewerContextData );
    return {
        currentSelectionData: selection,
        totalFound: selection.length
    };
};

/**
 * Show delete confirmation
 * @param {Object} commandContext command context
 * @param {Object} imageCaptureToBeDeleted image capture to be deleted
 */
export let deleteSelectedImageCapture = function( commandContext, imageCaptureToBeDeleted ) {
    let msg = commandContext.itemOptions.i18n.captureDeleteConfirmation.replace( '{0}', imageCaptureToBeDeleted.captureText );
    let buttons = [ {
        addClass: BUTTON_CLASS,
        text: commandContext.itemOptions.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: BUTTON_CLASS,
        text: commandContext.itemOptions.i18n.delete,
        onClick: function( $noty ) {
            $noty.close();
            exports.deleteSelectedImageCaptureAction( commandContext, imageCaptureToBeDeleted );
        }
    } ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Delete Image capture using SOA
 * @param {Object} input SOA input
 * @param {Object} imageCaptureModelObject image capture object
 * @param {Object} imageCapturePanelData image capture panel data
 *
 */
let soaSvcDeleteRelation = function( input, imageCaptureModelObject, imageCapturePanelData ) {
    soaSvc.post( 'Core-2006-03-DataManagement', 'deleteRelations', input ).then( function() {
        exports.deleteImageCaptureObjectFromList( imageCaptureModelObject, imageCapturePanelData, getViewerContextData() );
        AwTimeoutService.instance( function() {
            if( getViewerContextData() ) {
                getViewerContextData().getImageCaptureManager().closeImageCaptureView();
            }
        } );
    }, function() {
        logger.error( 'SOA error :: failed to delete capture.' );
    } );
};

/**
 * Delete all capture images
 * @param {Object} imageCapturePanelData image capture panel data
 */
export let deleteAllCaptureImages = function( imageCapturePanelData, viewerContextData ) {
    let listOfImageCaptureModelObjects = imageCapturePanelData.getValue().listOfImageCaptureObjects;
    let relInputArray = [];
    _.forEach( listOfImageCaptureModelObjects, imageCaptureModelObject => {
        relInputArray.push( {
            relationType: 'Fnd0ViewCapture',
            primaryObject: getContextObject( viewerContextData, imageCapturePanelData ),
            secondaryObject: imageCaptureModelObject
        } );
    } );
    let input = {
        input: relInputArray
    };
    soaSvcDeleteRelation( input, listOfImageCaptureModelObjects, imageCapturePanelData, viewerContextData );
};

/**
 * Message before cancelling/deleting all images
 *
 * @param {Object} commandContext command context
 */
export let deleteAllImages = function( commandContext ) {
    let msg = commandContext.i18n.allImagesDeleteConfirmationText;
    let BUTTON_CLASSs = [ {
        addClass: BUTTON_CLASS,
        text: commandContext.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: BUTTON_CLASS,
        text: commandContext.i18n.delete,
        onClick: function( $noty ) {
            $noty.close();
            exports.deleteAllCaptureImages( commandContext.imageCapturePanelData, commandContext.viewerContextData );
        }
    } ];
    messagingService.showWarning( msg, BUTTON_CLASSs );
};

/**
 * Delete selected image capture
 * @param {Object} commandContext command context
 * @param {Object} imageCaptureToBeDeleted image capture to be deleted
 * @param {Object} ctx application context
 */
export let deleteSelectedImageCaptureAction = function( commandContext, imageCaptureToBeDeleted ) {
    let imageCaptureModelObject = imageCaptureToBeDeleted.selectedModelObject;
    let relInputArray = [];
    let rel = {
        relationType: 'Fnd0ViewCapture',
        primaryObject: getContextObject( commandContext.itemOptions.viewerContextData, commandContext.itemOptions.imageCapturePanelData ),
        secondaryObject: imageCaptureModelObject
    };
    relInputArray.push( rel );
    let input = {
        input: relInputArray
    };
    soaSvcDeleteRelation( input, [ imageCaptureModelObject ], commandContext.itemOptions.imageCapturePanelData, commandContext.itemOptions.viewerContextData );
};

/**
 * delete the capture from listOfImageCaptureObjects.
 * @param {Object} vmo view model data
 * @param {Object} imageCapturePanelData image capture panel data
 */
export let deleteImageCaptureObjectFromList = function( vmo, imageCapturePanelData, viewerContextData ) {
    soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', {
        objects: vmo
    } )
        .then(
            function() {
                const imageCapturePanelDataValue = { ...imageCapturePanelData.getValue() };
                if( vmo.length === imageCapturePanelDataValue.listOfImageCaptureObjects.length ) {
                    imageCapturePanelDataValue.listOfImageCaptureObjects = [];
                    imageCapturePanelDataValue.updateImageCaptureList = !imageCapturePanelDataValue.updateImageCaptureList;
                    imageCapturePanelData.update( imageCapturePanelDataValue );
                    viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
                    return;
                }
                let deletedUid = vmo[ 0 ].uid;
                for( let i = 0; i < imageCapturePanelDataValue.listOfImageCaptureObjects.length; i++ ) {
                    if( deletedUid === imageCapturePanelDataValue.listOfImageCaptureObjects[ i ].uid ) {
                        imageCapturePanelDataValue.listOfImageCaptureObjects.splice( i, 1 );
                        imageCapturePanelDataValue.updateImageCaptureList = !imageCapturePanelDataValue.updateImageCaptureList;
                        imageCapturePanelData.update( imageCapturePanelDataValue );
                        viewerCtxService.setMarkupCommandVisibility( false, null, viewerContextData );
                    }
                }
            },
            function() {
                logger.error( 'SOA error :: failed to delete capture.' );
            } );
};

/**
 * To download captured snap shot in high resolution format i.e. png
 *
 * @param {String} objUid current selected model object uid.
 */
export let downloadSnapShotFile = function( objUid ) {
    let contextObject = cdmSvc.getObject( objUid );
    if( contextObject && contextObject.props ) {
        let imanFiles = contextObject.props.ref_list;
        if( imanFiles && imanFiles.uiValues.length > 0 ) {
            let imanFileUid = null;
            let i;
            for( i = 0; i < imanFiles.uiValues.length; i++ ) {
                if( _.endsWith( imanFiles.uiValues[ i ], 'png' ) ) {
                    imanFileUid = imanFiles.dbValues[ i ];
                    break;
                }
            }
            let imanFileModelObject = cdmSvc.getObject( imanFileUid );
            let files = [ imanFileModelObject ];
            fmSvc.getFileReadTickets( files ).then(
                function( readFileTicketsResponse ) {
                    if( readFileTicketsResponse && readFileTicketsResponse.tickets &&
                        readFileTicketsResponse.tickets.length > 1 ) {
                        let ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
                        if( ticketsArray && ticketsArray.length > 0 ) {
                            let fileName = fmsUtils.getFilenameFromTicket( ticketsArray[ 0 ] );
                            //if 3D is active or previously loaded then set skip as true to avoid viewer unload
                            let skipBeforeUnload = appCtxSvc.getCtx( 'viewer.skipBeforeUnloadExecution' );
                            if( skipBeforeUnload === false ) {
                                appCtxSvc.updatePartialCtx( 'viewer.skipBeforeUnloadExecution', true );
                            }
                            fmsUtils.openFile( ticketsArray[ 0 ], fileName );
                        } else {
                            logger.error( 'No tickets were found in the response data for snap shot model object.' );
                        }
                    } else {
                        logger.error( 'File read tickets response data for snap shot model object is empty. ' );
                    }
                } );
        } else {
            logger.error( 'Image model object property \'ref_list\' is missing.' );
        }
    } else {
        logger.error( 'Model object associated with select captured image is missing.' );
    }
};

/**
 * Get properties policies
 * @returns {Object} policies
 */
let getPropertyPolicies = function() {
    return {
        types: [ {
            name: 'SnapShotViewData',
            properties: [ {
                name: 'object_name'
            },
            {
                name: 'object_desc'
            },
            {
                name: 'object_type'
            },
            {
                name: 'release_status_list'
            },
            {
                name: 'date_released'
            },
            {
                name: 'creation_date'
            },
            {
                name: 'owning_user',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0HasMarkupData'
            },
            {
                name: 'fnd0ContextObjects',
                properties: []
            },
            {
                name: 'ref_list',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'ref_names'
            }
            ],
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        } ]
    };
};

/**
 * Returns current selection object.
 * @param {Object} viewerContext viewer context
 * @return {Object} - Current selection.
 */
let getCurrentSelection = function( viewerContextData ) {
    let viewerSelectionModels = viewerContextData.getSelectionManager().getSelectedModelObjects();
    let selectionLength = 0;
    if( viewerSelectionModels ) {
        selectionLength = viewerSelectionModels.length;
    }
    let currentSelection = null;
    if( selectionLength > 0 ) {
        currentSelection = viewerSelectionModels[ selectionLength - 1 ];
    } else {
        currentSelection = viewerContextData.getCurrentViewerProductContext();
    }
    let selection = [];
    selection.push( currentSelection );
    return selection;
};

/**
 * Delete image capture capture
 * @param {Object} commandContext command context
 */
export let deleteImageCapture = function( commandContext ) {
    var userSession = cdmSvc.getUserSession();
    var objectUser = commandContext.vmo.props.owning_user.displayValues[ 0 ];
    var loggedInUser = userSession.props.user.uiValues[ 0 ];
    if( _.includes( objectUser, loggedInUser ) ) {
        let imageCaptureToBeDeleted = {};
        imageCaptureToBeDeleted.captureId = commandContext.vmo.uid;
        imageCaptureToBeDeleted.captureText = commandContext.vmo.cellHeader1.toString();
        imageCaptureToBeDeleted.selectedModelObject = commandContext.vmo;
        exports.deleteSelectedImageCapture( commandContext, imageCaptureToBeDeleted );
    } else {
        logger.error( 'You do not have permission to delete this Image Capture' );
    }
};

/**
 * Sets active view as image capture panel panel
 * @param {Object} imageCapturePanelData image capture panel data
 */
const setActiveListPanel = ( imageCapturePanelData ) => {
    updateImageCapturePanelData( imageCapturePanelData, 'activeView', 'Awv0ImageCaptureListSub' );
};

/**
 * Render create image capture text boxes
 * @param {Object} imageCapturePanelData image capture panel data
 * @param {Object} captureName capture name
 * @param {Object} captureDesc capture description
 * @returns {Object} contains textbox view model properties
 */
let renderTextBoxes = ( imageCapturePanelData, captureName, captureDesc ) => {
    let captureNameValue = { ...captureName };
    let captureDescValue = { ...captureDesc };
    let imageCapturePanelDataValue = imageCapturePanelData.getValue();
    captureNameValue.dbValue = imageCapturePanelDataValue.captureName;
    captureNameValue.dispValue = imageCapturePanelDataValue.captureName;
    captureNameValue.uiValue = imageCapturePanelDataValue.captureName;
    captureDescValue.dbValue = imageCapturePanelDataValue.captureDescription;
    captureDescValue.dispValue = imageCapturePanelDataValue.captureDescription;
    captureDescValue.uiValue = imageCapturePanelDataValue.captureDescription;
    return {
        captureName: { ...captureNameValue },
        captureDesc: { ...captureDescValue }
    };
};

/**
 * Set Active tab in capture gallery panel
 * @param {Object} selectedTab selected tab in viewModelData
 * @param {Object} tabsModel tabs model
 * @param {Boolean} setDefaultTab default tab flag, true if panel opened first time
 * @param {Object} viewerContextData viewer context data
 * @returns {Object} updated objects
 */
let setActiveTab = ( selectedTab, tabsModel, setDefaultTab, viewerContextData ) => {
    let defaultSelectedTab = 'InputSnapshot';
    let _selectedTab = _.clone( selectedTab );
    if( setDefaultTab && viewerContextData ) {
        defaultSelectedTab = viewerContextData.getValueOnViewerAtomicData( 'activeCaptureGalleryTab' );
        if( _selectedTab.tabKey !== defaultSelectedTab ) {
            _selectedTab = tabsModel.find( tab => tab.tabKey === defaultSelectedTab );
        }
        setDefaultTab = false;
    } else {
        defaultSelectedTab = selectedTab.tabKey;
    }
    return {
        defaultSelectedTab: defaultSelectedTab,
        selectedTab: _selectedTab,
        setDefaultTab: setDefaultTab
    };
};

/**
 * Shows Markups in Image capture as well as enables freeDraw tool
 * @param {Object} onScreen2dMarkupContext 2D markup context
 * @param {Object} viewerContextData viewer context data
 */
export let showMarkupsInImageCapture = ( onScreen2dMarkupContext, viewerContextData ) => {
    let markupContext = { ...onScreen2dMarkupContext };
    markupContext.element = viewerContextData.getImageCaptureManager().getElementForMarkup();
    if( markupContext.vmo && markupContext.type && markupContext.element ) {
        viewerMarkupSvc.showMarkups( markupContext );
    }
};

/**
 * Activates markup panel
 * @param {Object} onScreen2dMarkupContext 2D markup context
 * @param {Object} viewerContextData viewer context data
 * @param {String} dialogAction dialog action
 */
export let activateMarkupPanelInImageCapture = ( onScreen2dMarkupContext, viewerContextData, dialogAction ) => {
    let markupContext = { ...onScreen2dMarkupContext, viewerDialogAction: dialogAction, viewerDialogParent: '.aw-layout-workareaMain' };
    markupContext.element = viewerContextData.getImageCaptureManager().getElementForMarkup();
    if( markupContext.vmo && markupContext.type && markupContext.element ) {
        viewerMarkupSvc.activateMarkupPanel( markupContext );
        _avoidUnsubscribe = true;
    }
};

/**
 * Get context object
 * @param {Object} viewerContextData viewer context data
 * @param {Object} imageCapturePanelData image capture panel data
 * @returns {Object} context object
 */
const getContextObject = ( viewerContextData, imageCapturePanelData ) => {
    let contextObject = null;
    let pinnedReferenceObject = imageCapturePanelData.getValue().pinnedReferenceObject;
    if( pinnedReferenceObject ) {
        let contextObjectUid = pinnedReferenceObject.dbValues[ 0 ];
        contextObject = cdmSvc.getObject( contextObjectUid );
    } else {
        let locationContext = appCtxSvc.getCtx( 'locationContext' );
        let currentSubLoc = locationContext[ AW_SUBLOCATION ];
        let selected = appCtxSvc.getCtx( 'selected' );
        if( _.isEqual( currentSubLoc, OCC_SUBLOCATION ) ) {
            let occmgmtContext = appCtxSvc.getCtx( viewerContextData.getOccmgmtContextKey() );
            if( occmgmtContext && Array.isArray( occmgmtContext.pwaSelection ) && occmgmtContext.pwaSelection.length > 0 ) {
                let lastIndex = occmgmtContext.pwaSelection.length - 1;
                contextObject = occmgmtContext.pwaSelection[ lastIndex ];
            } else {
                contextObject = selected;
            }
            if( contextObject.props ) {
                let underlyingObject = contextObject.props.awb0UnderlyingObject;
                if( underlyingObject ) {
                    contextObject = cdmSvc.getObject( underlyingObject.dbValues[ 0 ] );
                }
            }
        } else if( _.isEqual( currentSubLoc, SHOWOBJ_SUBLOCATION ) || _.isEqual( currentSubLoc, 'teamcenter.search.search' ) ) {
            contextObject = selected;
        } else if( _.isEqual( currentSubLoc, EWI_SUBLOCATION ) ) {
            let workinstr0Vis = appCtxSvc.getCtx( 'workinstr0Vis' );
            contextObject = workinstr0Vis.selectedRevObj;
        } else if( viewerContextData ) {
            let selection = getCurrentSelection( viewerContextData )[ 0 ];
            contextObject = cdmSvc.getObject( selection.uid );
        }
    }
    return contextObject;
};

export default exports = {
    pinImageCaptureContext,
    unPinImageCaptureContext,
    getAllImageCapturesData,
    imageCapturePanelRevealed,
    clearPreviousSelectionAndPopulateCaptureList,
    clearPreviousImageCaptureSelection,
    onSelectionChange,
    cleanupImageCapturePanel,
    createImageCapture,
    setExistingSelection,
    loadCreatedCapture,
    launchMarkup,
    updateCaptureNameAndDescription,
    getImageCaptureContext,
    deleteSelectedImageCapture,
    deleteSelectedImageCaptureAction,
    deleteImageCaptureObjectFromList,
    populateCaptureList,
    downloadSnapShotFile,
    deleteAllImages,
    deleteAllCaptureImages,
    deleteImageCapture,
    setActiveListPanel,
    renderTextBoxes,
    setActiveTab,
    showMarkupsInImageCapture,
    activateMarkupPanelInImageCapture
};
