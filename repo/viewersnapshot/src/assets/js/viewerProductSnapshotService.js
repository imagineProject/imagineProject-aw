// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerProductSnapshotService
 */
import appCtxSvc from 'js/appCtxService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import _cdmSvc from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import vmoSvc from 'js/viewModelObjectService';
import viewerCtxSvc from 'js/viewerContext.service';
import declUtils from 'js/declUtils';
import viewerPerformanceService from 'js/viewerPerformance.service';
import searchFilterSvc from 'js/aw.searchFilter.service';
import viewerSessionFileUtils from 'js/viewerSessionFileUtils';
import localeService from 'js/localeService';
import AwStateService from 'js/awStateService';
import tcClipboardService from 'js/tcClipboardService';
import awPromiseService from 'js/awPromiseService';

var exports = {};

let snapshotPanelDataCtx = null;
const APP_SESSION_MANAGEMENT_SOA = 'Cad-2020-01-AppSessionManagement';
const CORE_DATA_MANAGEMENT_SOA = 'Core-2006-03-DataManagement';

/**
 * Snapshot panel revealed
 * @param {Object} panelContext panel context
 * @param {Object} snapshotPanelData snapshot atomic data
 * @returns {Object} vmo for product snapshot gallery
 */
export let productSnapshotPanelRevealed = function( panelContext, snapshotPanelData ) {
    let currentVMO = {};
    if( panelContext.subPanelContext.context.occContext ) {
        currentVMO = vmoSvc.constructViewModelObjectFromModelObject( panelContext.subPanelContext.context.occContext.topElement, 'Search' );
    }
    snapshotPanelDataCtx = snapshotPanelData;
    let viewerContextData = panelContext && panelContext.viewerContextData ? panelContext.viewerContextData : null;
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( 'activeCaptureGalleryTab', 'InputSnapshot' );
        viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, panelContext.subPanelContext.popupOptions.popupId );
    }
    return {
        vmoForProductSnapshotGallery: currentVMO
    };
};

/**
 * Get file URL from ticket.
 * @param {String} ticket - File ticket.
 * @returns {String} fileURL file ticket
 */
export let getFileURLFromTicket = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + encodeURIComponent( ticket );
    }
    return null;
};

/**
 * Creates Product Snapshots in Teamcenter
 *
 * @param  {Object} commandContext command context
 *
 * @returns {Object} snapshot
 */
export let createProductSnapshot = function( commandContext ) {
    const viewerContextData = commandContext.viewerContextData;
    viewerContextData.getViewerAtomicDataSubject().notify( viewerCtxSvc.VIEWER_CAPTURE_SNAPSHOT_BEGIN );
    if ( viewerCtxSvc.isServerless() ) {
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextData.AUTO_SAVE_VIS_BOOKMARK, 'start' );
        let productSnapShotFileNames = generateUniqueFilenames();
        return _createProductSnapshot( commandContext.context.occContext )
            .then( result => {
                const sessionOutputs = result.sessionOutputs;
                if( sessionOutputs && sessionOutputs.length === 0 ) {
                    logger.error( 'ViewerSnapshotService: Create Product Snapshot failed: ' + 'No sessionOutputs found' );
                    return awPromiseService.instance.reject( 'No sessionOutputs found' );
                }
                const snapshotObject = result.sessionOutputs[ 0 ].sessionObject;
                const recipeObject = sessionOutputs[0].recipeOfOpenedProductOutputs[0].recipeObject;
                const headerInfo = commandContext.viewerContextData.getSnapshotManager().getHeaderInfo( snapshotObject, recipeObject );
                return _createVisSessionDataSetForProdSnapshot( snapshotObject )
                    .then( visDataSet => {
                        return _createWriteTicketInfo( productSnapShotFileNames.sessionFileName, productSnapShotFileNames.thumbnailFileName, productSnapShotFileNames.hdImageFileName )
                            .then( fileTickets => {
                                return _uploadAndCommitDataFiles( fileTickets,  viewerContextData, visDataSet, productSnapShotFileNames, headerInfo )
                                    .then( () => snapshotObject );
                            } );
                    } );
            } )
            .catch( error => {
                logger.error( 'ViewerSnapshotService: Create Product Snapshot failed in Serverless: ' + error );
                return awPromiseService.instance.reject( error );
            } );
    }
    /**Currnetly, using getVisLicenseLevels API to check if visServer is Alive. Need to update this in future
     * if we get API to check if the visServer is connected or not.
     */
    let viewerView = commandContext.viewerContextData.getViewerView();
    let snapshotObject = null;
    return viewerView.getVisLicenseLevels( window.JSCom.Consts.LICENSE_LEVELS.ALL ).then( () => {
        return _createProductSnapshot( commandContext.context.occContext );
    } ).then( result => {
        snapshotObject = result.sessionOutputs[ 0 ].sessionObject;
        if( commandContext.viewerContextData.getSessionMgr() ) {
            return commandContext.viewerContextData.getSessionMgr().updateProductSnapshot( snapshotObject.uid );
        }
        return null;
    } ).then( () => {
        return snapshotObject;
    } ).catch( ( error ) => {
        logger.error( 'ViewerSnapshotService: Create Product Snapshot failed: ' + error );
        return awPromiseService.instance.reject( error );
    } );
};

/**
 * Generates unique filenames for session, thumbnail, and HD image files based on the current timestamp and a random number.
 *
 * @returns {Object} An object containing the generated filenames.
 */
function generateUniqueFilenames() {
    const timestamp = new Date().toISOString().replace( /[^0-9]/g, '' );
    const randomNum = Math.floor( Math.random() * 10000 );

    let sessionFileName = `upload_${timestamp}${randomNum}.vf`;
    let thumbnailFileName = `thumbnailImage_${timestamp}${randomNum}.png`;
    let hdImageFileName = `imageCapture_${timestamp}${randomNum}.jpg`;

    return {
        sessionFileName,
        thumbnailFileName,
        hdImageFileName
    };
}


/**
 * Uploads files related to a snapshot object to a server and commits the dataset files.
 *
 * @param {Array} fileTickets - An array of file ticket objects for uploading files.
 * @param {Object} viewerContextData - The viewer context data.
 * @param {Object} visDataSet - The dataset to which the files belong.
 * @param {Object} productSnapShotFileNames - An object containing the file names for the snapshot files.
 * @param {Object} headerInfo - The header info for the snapshot.
 * @returns {Promise<void>} A promise that resolves when the files are uploaded and committed.
 */
let _uploadAndCommitDataFiles = function( fileTickets, viewerContextData, visDataSet, productSnapShotFileNames, headerInfo ) {
    if ( viewerContextData.getSessionMgr() ) {
        let snapshotSessionFile = viewerContextData.getSnapshotManager().getFlatBufferForSnapshot( headerInfo );
        let hdImage = viewerContextData.getSnapshotManager().captureImageBytes( null, null, false );
        let snapshotFileInfo = [];
        return awPromiseService.instance.all( [ snapshotSessionFile, hdImage ] )
            .then( result => {
                snapshotFileInfo = result;
                return viewerContextData.getSnapshotManager().captureImageBytes( null, null, true );
            } ).then( thumbnailInfo => {
                snapshotFileInfo.splice( 1, 0, thumbnailInfo );
                let uploadPromises = snapshotFileInfo.map( ( file, index ) => {
                    let fileDataInfo = !_.isArrayBuffer( file ) ? new Uint8Array( file ).buffer : file;
                    return viewerSessionFileUtils.uploadFileToVolume( fileDataInfo, fileTickets[index].ticket );
                } );
                return Promise.all( uploadPromises );
            } ).then( () => {
                const getFileInfo = ( index ) => {
                    switch ( index ) {
                        case 0:
                            return {
                                fileName: productSnapShotFileNames.sessionFileName,
                                namedReferencedName: 'Session'
                            };
                        case 1:
                            return {
                                fileName: productSnapShotFileNames.thumbnailFileName,
                                namedReferencedName: 'Fnd0ThumbnailImage'
                            };
                        case 2:
                            return {
                                fileName: productSnapShotFileNames.hdImageFileName,
                                namedReferencedName: 'Fnd0HDImage'
                            };
                        default:
                            throw new Error( 'Invalid index' );
                    }
                };

                const commitInput = [ {
                    createNewVersion: true,
                    dataset: visDataSet,
                    datasetFileTicketInfos: fileTickets.map( ( ticket, index ) => {
                        let { fileName, namedReferencedName } = getFileInfo( index );
                        return {
                            ticket: ticket.ticket,
                            datasetFileInfo: {
                                clientId: index.toString(),
                                fileName: fileName,
                                namedReferencedName: namedReferencedName,
                                isText: false,
                                allowReplace: true
                            }
                        };
                    } )
                } ];

                return soaSvc.postUnchecked( 'Core-2006-03-FileManagement', 'commitDatasetFiles', { commitInput } );
            } ).catch( error => {
                logger.error( 'ViewerSnapshotService: Upload files failed: ' + error );
                return awPromiseService.instance.reject( error );
            } );
    }
    return Promise.resolve();
};

/**
 * Creates write ticket information for a session file, thumbnail image, and HD image.
 *
 * @param {string} sessionFileName - The name of the session file.
 * @param {string} thumbnailImage - The name of the thumbnail image file.
 * @param {string} hdImage - The name of the HD image file.
 * @returns {Promise} A promise that resolves when the write tickets are successfully created.
 * @throws Will log an error message if there is an error while creating inputData.
 */
let _createWriteTicketInfo = ( sessionFileName, thumbnailImage, hdImage ) => {
    let fileInfos = [
        { clientFileId: '0', fileName: sessionFileName, refName: 'Session', isText: false },
        { clientFileId: '1', fileName: thumbnailImage, refName: 'Fnd0ThumbnailImage', isText: false },
        { clientFileId: '2', fileName: hdImage, refName: 'Fnd0HDImage', isText: false }
    ];

    let writeTicketInfo = [ {
        clientId: '0',
        datasetTypeName: 'Vis_Session',
        version: 1,
        fileInfos: fileInfos
    } ];

    return soaSvc.post( 'Internal-Core-2008-06-FileManagement', 'getWriteTickets', { inputs: writeTicketInfo } )
        .then( ticketInfo => {
            return ticketInfo.tickets[0];
        } )
        .catch( error => {
            logger.error( 'createWriteTicketInfo: error while fetching ticket info: ' + error );
            return null;
        } );
};
/**
 * Creates snapshots and fires notifictaion
 *
 * @param  {Object} data view model
 * @param  {Object} commandContext command context
 * @returns {Promise} return promise which on resolve returns snapshot object
 */
export let createProductSnapshotAndNotify = function( data, commandContext ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.CaptureProductSnapshot );
    }
    return createProductSnapshot( commandContext ).then( function( snapshotModel ) {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Product snapshot created : ' );
            viewerPerformanceService.setViewerPerformanceMode( false );
        }
        if( _.isNull( snapshotModel ) || _.isUndefined( snapshotModel ) ) {
            logger.error( 'ViewerSnapshotService: Create Product Snapshot failed:' );
            throw 'Create Product Snapshot failed';
        } else {
            let msg = data.i18n.captureProductSnapshotSuccess.replace( '{0}', snapshotModel.props.object_string.dbValues[ 0 ] );
            messagingService.showInfo( msg );
            _updateSnapshotList( commandContext.snapshotPanelData );
            return snapshotModel;
        }
    } ).catch( ( error ) => {
        const msg = data.i18n.productSnapshotCreationFailure;
        messagingService.showError( msg );
        return awPromiseService.instance.reject( error );
    } );
};

/**
 * Creates snapshots and fires notifictaion On Discussion Panel
 * @param  {Object} data view model
 * @param  {Object} commandContext command context
 */
export let createProductSnapshotOnDiscussion = function( data, commandContext ) {
    let commandContextDiscussion = { ...commandContext, viewerContextData: _getViewerContextData( data.ctx ), context:{ occContext:data.ctx.occmgmtContext } };
    exports.createProductSnapshotAndNotify( data, commandContextDiscussion ).then( function( snapshotModel ) {
        _updateThumbnailOnSnapshot( snapshotModel, commandContext.sharedData );
    } );
};

/**
 * Clear snapshot discussion data
 * @param {Object} sharedData shared atomic data of active collab panels
 */
export let clearSnapshotDiscussionData = function( sharedData ) {
    let sharedDataValue = { ...sharedData.getValue() };
    if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
        sharedDataValue.currentSelectedSnapshot = null;
        sharedDataValue.updateSnapshotOnDiscussion = !sharedDataValue.updateSnapshotOnDiscussion;
        sharedData.update( sharedDataValue );
    }
};

/**
 * Loads product snapshot data for snapshot section discussion panel
 * @param {Object} sharedData shared atomic data of active collab panels
 * @returns {Object} object containing list of snapshots and number of snapshots
 */
export let loadProductSnapshotDataForCard = function( sharedData ) {
    var selection = [];
    let sharedDataValue = sharedData.getValue();
    if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
        selection.push( sharedDataValue.currentSelectedSnapshot );
    }
    return {
        snapshotOnDiscussion: selection,
        snapshotTotalFound: selection.length
    };
};

/**
 * Updates selected product snapshot by capturing current viewer state on discussion Panel
 * @param  {Object} commandContext selected snapshot
 * @param  {Object} data view model
 */
export let updateProductSnapshotOnDiscussion = function( commandContext, data ) {
    _updateProductSnapshot( commandContext.vmo, _getViewerContextData( data.ctx ), data.ctx.occmgmtContext )
        .then( () => {
            _updateThumbnailOnSnapshot( commandContext.vmo, commandContext.sharedData );
        } ).catch( ( error ) => {
            messagingService.showInfo( data.i18n.failedToUpdate );
            logger.error( 'ViewerProductSnapshotService: Product Snapshot update failed: ' + error );
        } );
};

/**
 * Updates thumbnail on snapshot on discussion panel
 * @param {Object} vmo viewmodel object
 * @param {Object} sharedData shared atomic data of active collab panels
 */
let _updateThumbnailOnSnapshot = ( vmo, sharedData ) => {
    soaSvc.post( CORE_DATA_MANAGEMENT_SOA, 'getProperties', {
        objects: [ {
            uid: vmo.uid,
            type: 'Fnd0Snapshot'
        } ],
        attributes: [ 'awp0ThumbnailImageTicket' ]
    } ).then( function() {
        var snapImgVar = {};
        snapImgVar.fmsTicket = vmo.props.awp0ThumbnailImageTicket.dbValues[ 0 ];
        var imageURL = getFileURLFromTicket( snapImgVar.fmsTicket );
        let currentVMO = vmoSvc.constructViewModelObjectFromModelObject( vmo, 'Search' );
        let sharedDataValue = { ...sharedData.getValue() };
        sharedDataValue.currentSelectedSnapshot = currentVMO;
        sharedDataValue.currentSelectedSnapshot.thumbnailURL = imageURL;
        sharedDataValue.updateSnapshotOnDiscussion = !sharedDataValue.updateSnapshotOnDiscussion;
        sharedData.update( sharedDataValue );
    } );
};

/**
 * Delete the object from Teamcenter Database
 * @param {*} vmo selected view model
 * @param {*} data view model
 */
export let deleteProductSnapshotAndNotify = function( vmo, data ) {
    soaSvc.post( CORE_DATA_MANAGEMENT_SOA, 'deleteObjects', { objects: [ vmo ] } ).then( function() {
        let snapshotGallery = appCtxSvc.getCtx( 'mySnapshotGallery' );
        if( !_.isUndefined( snapshotGallery ) ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
        messagingService.showInfo( data.i18n.productSnapshotDeletedSuccussfully );
    } ).catch( ( error ) => {
        var msg = data.i18n.productSnapshotDeleteFailed.replace( '{0}', error );
        messagingService.showError( msg );
        logger.error( 'viewerProductSnapshotService: Product Snapshot delete failed: ' + error );
    } );
};

/**
 * Deletes snapshot
 *
 * @param  {Object} vmo selected snapshot
 * @param  {Object} data view model
 */
export let deleteProductSnapshot = function( vmo, data ) {
    var msg = data.i18n.productSnapshotDeleteConfirmationText.replace( '{0}', vmo.cellHeader1 );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancelText,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.deleteText,
        onClick: function( $noty ) {
            $noty.close();
            deleteProductSnapshotAndNotify( vmo, data );
        }
    } ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Starts snapshot edit operation
 *
 * @param  {Object} commandContext command context
 * @param {Object} snapshotPanelData atomic data
 */
export let startEditProductSnapshot = function( commandContext, snapshotPanelData ) {
    let updatedsnapshotPanelData = { ...snapshotPanelData.getValue() };
    updatedsnapshotPanelData.activeView = 'ProductSnapshotEditSub';
    updatedsnapshotPanelData.snapshotBeingEdit = commandContext.vmo;
    snapshotPanelData.update( updatedsnapshotPanelData );
};

/**
 * Render textbox for edit snapshot panel
 * @param {String} snapshotNameValue snapshot name
 * @param {Object} snapshotNameProp view model property used to render textbox
 * @returns {Object} modified viewmodel prop
 */
export let renderEditPanelTextBox = function( snapshotNameValue, snapshotNameProp ) {
    if( snapshotNameValue && _.isString( snapshotNameValue ) ) {
        let updatedSnapshotNameProp = { ...snapshotNameProp };
        updatedSnapshotNameProp.dbValue = snapshotNameValue;
        updatedSnapshotNameProp.dispValue = snapshotNameValue;
        updatedSnapshotNameProp.uiValue = snapshotNameValue;
        return updatedSnapshotNameProp;
    }
    return snapshotNameProp;
};

/**
 * Updates snapshot Name
 *
 * @param  {String} newName new name for snapshot
 * @param  {Object} data view model
 * @param {Object} snapshotPanelData snapshot panel data
 * @param {Object} subPanelContext sub panel context
 */
export let renameProductSnapshotAndNotify = function( newName, data, snapshotPanelData, subPanelContext ) {
    var inputData = [ {
        object: snapshotPanelData.snapshotBeingEdit,
        vecNameVal: [ {
            name: 'object_name',
            values: [
                newName
            ]
        } ]
    } ];
    /* update the name in Teamcenter*/
    soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', { info: inputData } ).then( function() {
        messagingService.showInfo( data.i18n.updatedProductSnapshotSuccessfully );
        let updatedsnapshotPanelData = { ...snapshotPanelData.getValue() };
        if( subPanelContext.viewId === 'Awv0CaptureGallery' ) {
            updatedsnapshotPanelData.activeView = 'ProductSnapshotListSub';
        } else if( subPanelContext.viewId === 'Ac0UniversalConversationPanel' ) {
            updatedsnapshotPanelData.activeView = 'Ac0CreateNewCollabObj';
            updatedsnapshotPanelData.previousView = 'ProductSnapshotEditSub';
            if( snapshotPanelData.currentSelectedSnapshot ) {
                snapshotPanelData.currentSelectedSnapshot.cellHeader1 = newName;
            }
        }
        updatedsnapshotPanelData.snapshotBeingEdit = {};
        updatedsnapshotPanelData.renderTextbox = !updatedsnapshotPanelData.renderTextbox;
        snapshotPanelData.update( updatedsnapshotPanelData );
    } ).catch( ( error ) => {
        messagingService.showInfo( data.i18n.failedToUpdate );
        logger.error( 'ViewerSnapshotService: Product Snapshot rename failed: ' + error );
    } );
};

/**
 * Clear previous selection
 *  @param {Object} dataProvider snapshot DataProvider
 *  @param {Object} viewerContextData viewer context data
 */
export let clearPreviousProductSnapshotSelection = function( dataProvider, viewerContextData ) {
    var viewModelObject = dataProvider.selectedObjects;
    if( viewModelObject && viewModelObject.length > 0 && dataProvider.selectionModel ) {
        dataProvider.selectionModel.setSelection( [] );
    }
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, null );
};

/**
 * Set snapshot view
 *
 * @param {Object} commandContext snapshot atomic data
 * @param {String} snapshotView View to set for snapshot panel
 */
export let setProductSnapshotView = function( commandContext, snapshotView ) {
    const updatedSnapshotPanelData = { ...commandContext.snapshotPanelData.getValue() };
    updatedSnapshotPanelData.updateSnapshotList = !updatedSnapshotPanelData.updateSnapshotList;
    updatedSnapshotPanelData.snapshotView = snapshotView;
    commandContext.snapshotPanelData.update( updatedSnapshotPanelData );
};

/**
 * Get the default page size used for max to load/return.
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    var defaultPageSize = 50;

    if( defaultPageSizePreference ) {
        if( _.isArray( defaultPageSizePreference ) ) {
            defaultPageSize = exports.getDefaultPageSize( defaultPageSizePreference[ 0 ] );
        } else if( _.isString( defaultPageSizePreference ) ) {
            defaultPageSize = parseInt( defaultPageSizePreference );
        } else if( _.isNumber( defaultPageSizePreference ) && defaultPageSizePreference > 0 ) {
            defaultPageSize = defaultPageSizePreference;
        }
    }

    return defaultPageSize;
};

/**
 * Updates selected product snapshot by capturing current viewer state
 * @param {Object} i18n localized string object
 * @param {Object} commandContext command context
 * @param {Object} vmo selected snapshot
 * @returns {Promise} promise which gets resolved after updating snapshot
 */
export let updateProductSnapshotAndNotify = function( i18n, commandContext, vmo ) {
    let viewerContextData = commandContext.viewerContextData;
    let occmgmtContext = commandContext.context.occContext;
    if( _.isUndefined( viewerContextData )  || _.isUndefined( occmgmtContext ) ) {
        return;
    }
    // eslint-disable-next-line consistent-return
    return _updateProductSnapshot( vmo, viewerContextData, occmgmtContext )
        .then( () => {
            _updateSnapshotList( commandContext.snapshotPanelData );
        } ).catch( ( error ) => {
            messagingService.showInfo( i18n.failedToUpdate );
            logger.error( 'ViewerProductSnapshotService: Product Snapshot update failed: ' + error );
        } );
};

/**
 * Updates selected product snapshot by capturing current viewer state
 * @param  {Object} vmo selected snapshot
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} resolves on successful update of snapshot
 */
let _updateProductSnapshot = ( vmo, viewerContextData, occmgmtContext ) => {
    if( viewerCtxSvc.isServerless() ) {
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextData.AUTO_SAVE_VIS_BOOKMARK, 'start' );
        return _updateProductSnapshot2( vmo, viewerContextData, occmgmtContext );
    }
    return _updateProductSnapshot1( vmo, viewerContextData, occmgmtContext );
};

/**
 * Updates selected product snapshot by capturing current viewer state
 * @param  {Object} vmo selected snapshot
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} resolves on successful update of snapshot
 */
let _updateProductSnapshot1 = ( vmo, viewerContextData, occmgmtContext ) => {
    let viewerView = viewerContextData.getViewerView();
    return viewerView.getVisLicenseLevels( window.JSCom.Consts.LICENSE_LEVELS.ALL )
        .then( () => {
            return _updateStructureInProductSnapshot( vmo, occmgmtContext );
        } ).then( () => {
            if( viewerContextData.getSessionMgr() ) {
                return viewerContextData.getSessionMgr().updateProductSnapshot( vmo.uid );
            }
            return null;
        } );
};

/**
 * Update Product snapshot in Serverless mode
 * @param {Object} snapshotObject snapshot Object
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} resolves on successful update of snapshot
 */
let _updateProductSnapshot2 = ( snapshotObject, viewerContextData, occmgmtContext ) => {
    let fileTickets = null;
    let visDataSet = null;
    let headerInfo = {};
    let productSnapShotFileNames = {};
    return _updateStructureInProductSnapshot2( snapshotObject, occmgmtContext )
        .then( result =>{
            visDataSet = result.visSessionObject;
            productSnapShotFileNames = {
                sessionFileName : visDataSet.props.ref_list.uiValues[0],
                thumbnailFileName : visDataSet.props.ref_list.uiValues[1],
                hdImageFileName : visDataSet.props.ref_list.uiValues[2]
            };
            headerInfo = viewerContextData.getSnapshotManager().getHeaderInfo( snapshotObject, result.recipeObject );
            if( visDataSet ) {
                return getDatasetWriteTickets( productSnapShotFileNames.sessionFileName, productSnapShotFileNames.thumbnailFileName, productSnapShotFileNames.hdImageFileName, visDataSet );
            }
        } ).then( ( fileTicketsInfo ) => {
            fileTickets = fileTicketsInfo;
            return _uploadAndCommitDataFiles( fileTickets, viewerContextData, visDataSet, productSnapShotFileNames, headerInfo );
        } ).catch( ( error ) => {
            logger.error( 'ViewerSnapshotService: Update Product Snapshot failed: ' + error );
            return awPromiseService.instance.reject( error );
        } );
};

/**
 * Get Data set write tickets
 * @param {Object} sessionFileName session name
 * @param {Object} thumbnailImage thumbnail image name
 * @param {Object} hdImage hd image name
 * @param {Object} visDataSet vis data set
 * @returns {Promise} resolves on getting write tickets
 */
function getDatasetWriteTickets( sessionFileName, thumbnailImage, hdImage, visDataSet ) {
    let soaInput = {
        inputs: [ {
            createNewVersion: true,
            dataset: visDataSet,
            datasetFileInfos: [ {
                clientId: '0',
                fileName: sessionFileName,
                namedReferencedName: 'Session',
                isText: false,
                allowReplace:true
            },
            {
                clientId: '1',
                fileName: thumbnailImage,
                namedReferencedName: 'Fnd0ThumbnailImage',
                isText: false,
                allowReplace:true
            },
            {
                clientId: '2',
                fileName: hdImage,
                namedReferencedName: 'Fnd0HDImage',
                isText: false,
                allowReplace:true
            }
            ]
        } ]
    };
    return soaSvc.post( 'Core-2006-03-FileManagement', 'getDatasetWriteTickets', soaInput )
        .then( function( writeobject ) {
            logger.debug( 'getDatasetWriteTickets: writeobject: ' + JSON.stringify( writeobject ) );
            if( writeobject && writeobject.partialErrors ) {
                writeobject.partialErrors.forEach( ( error ) => {
                    logger.error( 'Failed to get dataset write tickets ' + error );
                    return null;
                } );
                return null;
            }
            return writeobject.commitInfo[0].datasetFileTicketInfos;
        } ).catch( ( error ) => {
            logger.error( 'createWriteTicketInfo: error while fetching ticket info: ' + error );
            return null;
        } );
}

/**
 * create snapshot object from SOA
 *
 * @param  {Object} occmgmtCtx occurence management context
 * @returns {Object} snapshot object
 */
let _createProductSnapshot = function( occmgmtCtx ) {
    return declUtils.loadDependentModule( 'js/aceBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ occmgmtCtx.topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0Snapshot'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } ).catch( ( error ) => {
            logger.error( 'ViewerSnapshotService: Create Product Snapshot failed' + error );
        } );
};

/**
 * Update structure in snapshot object from SOA
 * @param {Object} snapshotObject snapshot vmo
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} promise which resolve on update of structure in snapshot
 */
let _updateStructureInProductSnapshot = function( snapshotObject, occmgmtContext ) {
    let snapshotObjModelObject = _cdmSvc.getObject( snapshotObject.uid );
    let structureCtxStableID = null;
    return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'openSavedSession', {
        sessionsToOpen: [ snapshotObjModelObject ],
        filter: {
            productStructureFilter: {
                productStructure: 'RecipeObjectsOnly'
            }
        }
    } ).then( ( result ) => {
        if( result && result.partialErrors ) {
            result.partialErrors.forEach( ( error ) => {
                logger.error( 'OpenSavedSession failed: ' + error );
                return awPromiseService.instance.reject( error );
            } );
            return awPromiseService.instance.reject();
        }
        logger.debug( 'openSavedSession result: ' + JSON.stringify( result ) );
        structureCtxStableID = result.sessionOutputs[ 0 ].sessionProductStructures[ 0 ].stableId;
        return _getTopLinesArray( occmgmtContext );
    } ).then( ( topLinesArray ) => {
        logger.debug( 'topLinesArray: ' + JSON.stringify( topLinesArray ) );
        return _updateStructureConfigInProductSnapshot( structureCtxStableID, snapshotObjModelObject, topLinesArray );
    } );
};

/**
 * Update structure in snapshot object from SOA
 * @param {Object} snapshotObject snapshot vmo
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} promise which resolve on update of structure in snapshot
 */
let _updateStructureInProductSnapshot2 = function( snapshotObject, occmgmtContext ) {
    let structureCtxStableID = null;
    let visSessionObject = null;
    let recipeObject = null;
    let snapshotObjModelObject = _cdmSvc.getObject( snapshotObject.uid );
    return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'openSavedSession', {
        sessionsToOpen: [ snapshotObjModelObject ],
        filter: {
            productStructureFilter: {
                productStructure: 'RecipeObjectsOnly'
            },
            relAndTypesFilter: [ {
                namedRefHandler: 'UseNamedRefsList',
                relatedObjAndNamedRefs: [ {
                    objectTypeName: 'Dataset',
                    namedReferenceNames: [ 'Session' ]
                } ],
                relationName: 'Fnd0ISessionCADData'
            } ]
        }
    } ).then( ( result ) => {
        if( result && result.partialErrors ) {
            result.partialErrors.forEach( ( error ) => {
                logger.error( 'OpenSavedSession failed: ' + error );
                return awPromiseService.instance.reject( error );
            } );
            return awPromiseService.instance.reject();
        }
        if( result && result.sessionOutputs && result.sessionOutputs.length > 0 ) {
            if( result.sessionOutputs[0].relatedObjectInfos && result.sessionOutputs[0].relatedObjectInfos.length > 0 && result.sessionOutputs[0].relatedObjectInfos[0].relatedObject ) {
                visSessionObject = result.sessionOutputs[0].relatedObjectInfos[0].relatedObject;
            }
            if( result.sessionOutputs[0].sessionProductStructures && result.sessionOutputs[0].sessionProductStructures.length > 0 && result.sessionOutputs[0].sessionProductStructures[0].stableId ) {
                structureCtxStableID = result.sessionOutputs[ 0 ].sessionProductStructures[ 0 ].stableId;
            }
        }
        if( !visSessionObject || !structureCtxStableID ) {
            logger.error( 'No visSessionObject and structureCtxStableID found in openSavedSession result' );
            return awPromiseService.instance.reject( 'No visSessionObject and structureCtxStableID found in openSavedSession result' );
        }
        recipeObject = result.sessionOutputs[0].sessionProductStructures[0].recipeObject;
        return _getTopLinesArray( occmgmtContext );
    } ).then( ( topLinesArray ) => {
        return _updateStructureConfigInProductSnapshot( structureCtxStableID, snapshotObjModelObject, topLinesArray );
    } ).then( ()=>{
        return {
            recipeObject: recipeObject,
            visSessionObject: visSessionObject
        };
    } ).catch( ( error ) => {
        logger.error( 'Error in _updateStructureInProductSnapshot2: ' + error );
        return awPromiseService.instance.reject( error );
    } );
};

/**
 * Get top lines array
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} promise which resolve on getting top lines array
 * @private
 */
let _getTopLinesArray = function( occmgmtContext ) {
    if( !occmgmtContext.topElement ) {
        return awPromiseService.instance.reject( 'No top element found in occmgmtContext' );
    }
    return declUtils.loadDependentModule( 'js/aceBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ occmgmtContext.topElement ] );
            }
        } );
};

/**
 * Update structure config in snapshot object from SOA
 * @param {Object} structureCtxStableID structure context stable id
 * @param {Object} snapshotObjModelObject snapshot model object
 * @param {Object} topLinesArray top lines array
 * @returns {Promise} promise which resolve on update of structure config in snapshot
 * @private
 */
let _updateStructureConfigInProductSnapshot = function( structureCtxStableID, snapshotObjModelObject, topLinesArray ) {
    return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'createOrUpdateSavedSession', {
        sessionsToCreateOrUpdate: [ {
            sessionToCreateOrUpdate: {
                objectToUpdate: snapshotObjModelObject
            },
            productAndConfigsToCreate: [ {
                structureRecipe: {
                    structureContextIdentifier: {
                        product: {
                            uid: topLinesArray[ 0 ].uid
                        }
                    }
                },
                structureRecipeProps: {
                    fnd0CopyStableId: {
                        stringValues: [ structureCtxStableID ]
                    }
                }
            } ],
            detachObjectOrProductsFromSession: [ structureCtxStableID ]
        } ]
    } ).then( ( response )=>{
        if( response && response.partialErrors ) {
            response.partialErrors.forEach( ( error ) => {
                logger.error( 'createOrUpdateSavedSession failed: ' + error );
                return awPromiseService.instance.reject( error );
            } );
            return awPromiseService.instance.reject();
        }
    } ).catch( ( error )=>{
        logger.error( 'Error in _updateStructureConfigInProductSnapshot: ' + error );
        return awPromiseService.instance.reject( error );
    } );
};

/**
 * create snapshot object from SOA
 * @param {Object} snapshotObject snapshot
 * @returns {Object} vis session data object
 */
let _createVisSessionDataSetForProdSnapshot = ( snapshotObject )=> {
    let snapshotObjModelObject = _cdmSvc.getObject( snapshotObject.uid );
    return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'openSavedSession', {
        sessionsToOpen: [ snapshotObjModelObject ],
        filter: { productStructureFilter: { productStructure: 'RecipeObjectsOnly' } }
    } ).then( openSavedSessionResult => {
        let structureCtxStableID = openSavedSessionResult.sessionOutputs[0].sessionProductStructures[0].stableId;
        return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'createOrUpdateSavedSession', {
            sessionsToCreateOrUpdate: [ {
                sessionToCreateOrUpdate: { objectToUpdate: snapshotObjModelObject },
                attachObjectsToSession: [ {
                    baseObjectToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Vis_Session',
                                propertyNameValues: { object_name: { stringValues: snapshotObjModelObject.props.object_name.dbValues } }
                            }
                        }
                    },
                    relationName: 'Fnd0ISessionCADData'
                } ],
                productAndConfigsToUpdate: [ { stableId: structureCtxStableID } ]
            } ]
        } );
    } ).then( createOutput => {
        return createOutput.sessionOutputs[0].baseObjectAttachOutputs[0].baseObject;
    } ).catch( error => {
        logger.error( 'Error in _createVisSessionDataSetForProdSnapshot: ' + error );
        throw error;
    } );
};

/**
 * Rename snapshot on enter click on textbox
 * @param {Object} item vmo
 * @param {Object} snapshotDataProvider snapshot card data provider
 * @param {Object} data  view model data
 * @returns {Object} object containing snapshotEditInline and modifyProductSnapshotObject view model data
 */
export let inlineRenameProductSnapshot = function( item, snapshotDataProvider, data ) {
    let snapshotEditInline = { ...data.snapshotEditInline };
    let modifyProductSnapshotObject = { ...data.modifyProductSnapshotObject };
    snapshotEditInline.isEditable = false;
    snapshotEditInline.isEnabled = false;
    snapshotEditInline.autofocus = false;
    modifyProductSnapshotObject = '';
    //check if the object is selected
    let selectedProdSnapObj = _.isArray( snapshotDataProvider.selectedObj ) ? snapshotDataProvider.selectedObj[ 0 ] : snapshotDataProvider.selectedObj;
    if( !selectedProdSnapObj ) {
        snapshotDataProvider.selectionModel.setSelection( item );
        selectedProdSnapObj = item;
    }
    if( selectedProdSnapObj && snapshotEditInline.dbValue !== selectedProdSnapObj.cellHeader1 ) {
        _renameProductSnapshotSOA( selectedProdSnapObj, snapshotEditInline.dbValue, data );
    }
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: modifyProductSnapshotObject
    };
};

/**
 * Handle name click on snapshot card
 * @param {Object} item vmo
 * @param {Object} data view model data
 * @returns {Object} object containing snapshotEditInline and modifyProductSnapshotObject view model data
 */
export let handleTextEditClick = function( item, data ) {
    let snapshotEditInline = { ...data.snapshotEditInline };
    let modifyProductSnapshotObject = { ...data.modifyProductSnapshotObject };
    if( item.props.fnd0OwningIdentifier && item.props.fnd0OwningIdentifier.dbValue !== null || item.props.owning_user && item.props.owning_user.propertyDisplayName !== 'Owner' ) {
        return;
    }
    if( data.modifyProductSnapshotObject && data.modifyProductSnapshotObject.uid === item.uid ) {
        return; // to return for second unnecessary event
    }
    modifyProductSnapshotObject = item;
    snapshotEditInline.isEditable = true;
    snapshotEditInline.isEnabled = true;
    snapshotEditInline.autofocus = true;
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: modifyProductSnapshotObject
    };
};

/**
 * modify product snapshot
 *
 * @param  {Object} data view model
 */
export let modifyProductSnapshot = function( data ) {
    if( data.modifyProductSnapshotObject ) {
        inlineRenameProductSnapshot( data.modifyProductSnapshotObject, data );
    }
};

/**
 * Trigger update action of for snapshot list
 * @param {Object} snapshotPanelData snapshot atomic data
 */
let _updateSnapshotList = function( snapshotPanelData ) {
    if( !snapshotPanelData && snapshotPanelDataCtx ) {
        snapshotPanelData = snapshotPanelDataCtx;
    }
    if( snapshotPanelData ) {
        const updatedSnapshotPanelData = { ...snapshotPanelData.getValue() };
        updatedSnapshotPanelData.updateSnapshotList = !updatedSnapshotPanelData.updateSnapshotList;
        snapshotPanelData.update( updatedSnapshotPanelData );
    }
};

/**
 * Sets active view as snapshot panel
 * @param {Object} snapshotPanelData snapshot panel data
 * @returns {Object} updated snapshot panel data
 */
const setActiveListPanel = ( snapshotPanelData ) => {
    snapshotPanelData.activeView = 'ProductSnapshotListSub';
    return { ...snapshotPanelData };
};

/**
 * Rerender snapshot textbox
 * @param {Object} item snapshot vmo
 * @param {Object} snapshotEditInline snapshot textbox view model property
 * @returns {Object} which contains modified snapshot modified textbox property
 */
let renderTextBox = ( item, snapshotEditInline ) => {
    snapshotEditInline.dbValue = item.cellHeader1;
    snapshotEditInline.dispValue = item.cellHeader1;
    snapshotEditInline.uiValue = item.cellHeader1;
    return { ...snapshotEditInline };
};

/**
 * Rename and disable inline edit on selection of other snapshot
 * @param {Object} selectedSnapshot selected snapshot
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let disableInlineEdit = ( selectedSnapshot, item, data ) => {
    if( data.modifyProductSnapshotObject && selectedSnapshot && data.modifyProductSnapshotObject.uid !== selectedSnapshot.uid ) {
        return _renameAndDisableInlineEdit( item, data );
    }
};

/**
 * handle snapshot thumnail click in card view
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let handleThumbnailClick = ( item, data ) => {
    if( data.modifyProductSnapshotObject && data.modifyProductSnapshotObject.uid === item.uid ) {
        return _renameAndDisableInlineEdit( item, data );
    }
};

/**
 * Rename and disable inline edit of snapshot
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let _renameAndDisableInlineEdit = ( item, data ) => {
    let snapshotEditInline = { ...data.snapshotEditInline };
    if( snapshotEditInline.dbValue !== data.modifyProductSnapshotObject.cellHeader1 ) {
        _renameProductSnapshotSOA( item, snapshotEditInline.dbValue, data );
    }
    snapshotEditInline.isEditable = false;
    snapshotEditInline.isEnabled = false;
    snapshotEditInline.autofocus = false;
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: ''
    };
};

/**
 * Rename snapshot object using SOA
 * @param {Object} item snapshot vmo
 * @param {String} newName new name for snapshot
 * @param {Object} data view model data
 */
let _renameProductSnapshotSOA = ( item, newName, data ) => {
    let inputData = [ {
        object: item,
        vecNameVal: [ {
            name: 'object_name',
            values: [
                newName
            ]
        } ]
    } ];

    /* update the name in Teamcenter*/
    soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', { info: inputData } ).then( function() {
        messagingService.showInfo( data.i18n.updatedProductSnapshotSuccessfully );
    } ).catch( ( error ) => {
        messagingService.showInfo( data.i18n.failedToUpdate );
        logger.error( 'ViewerSnapshotService: Product Snapshot rename failed: ' + error );
    } );
};

/**
 * Select product snapshot in product gallery
 * @param {Object} item snapshot vmo
 * @param {Object} dataProvider card view data provider
 */
let selectProductSnapshot = ( item, dataProvider ) => {
    dataProvider.selectionModel.setSelection( item );
};

/**
 * Sets viewer context for product snapshot in discussion
 * @param {Object} data view model data
 * @param {Object} snapshotDiscData snapshot discussion data
 */
let setViewerContext = ( data, snapshotDiscData ) => {
    let discCtx = { ...snapshotDiscData.getValue() };
    let viewerCtxData = _getViewerContextData( data.ctx );
    if( viewerCtxData ) {
        discCtx.isViewerRevealed = viewerCtxData.getValueOnViewerAtomicData( 'isViewerRevealed' );
        discCtx.viewerViewMode = viewerCtxData.getValueOnViewerAtomicData( 'viewerViewMode' );
        snapshotDiscData.update( discCtx );
    }
};

/**
 * Gets viewer context data when it is not available on command
 * @param {Object} ctx application context
 * @returns {Object} viewer context object
 */
let _getViewerContextData = ( ctx ) => {
    let occmgmtContextKey = ctx && ctx.aceActiveContext && ctx.aceActiveContext.key ? ctx.aceActiveContext.key : 'occmgmtContext';
    let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
    return viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
};

/**
 * buildTitle
 * @function buildTitle
 * @param {Object}searchObject - search state object
 * @return {Promise} Promise containing the localized text
 */
export let buildTitle = function( searchObject ) {
    if( searchObject ) {
        let totalFound;
        let label = '';
        //Get search Criteria, Total Found and Crumbs
        if( searchObject.totalFound >= 0 ) {
            totalFound = searchObject.totalFound;
        }
        if( searchObject.label ) {
            label = searchObject.label;
        }
        return searchFilterSvc.loadBreadcrumbTitle( label, null, totalFound ).then( ( localizedText ) => {
            return localizedText;
        } );
    }
    return Promise.resolve( {} );
};

/**
 * Generate search string in different locale for my snapshot, shared by me and Shared with me snapshots
 *
 * @param {Object} provider search provider
 */
export let getSnapshotSearchString = function( provider ) {
    const _provider = _.clone( provider );
    var localTextBundle = localeService.getLoadedText( 'ViewerSnapshotMessages' );
    let searchMap = _provider.context.search;
    if ( searchMap.accessPrivilege === 'owner' ) {
        searchMap.criteria.searchString = localTextBundle.owning_user + ':$ME ' + localTextBundle.type + ':Fnd0Snapshot';
    } else if ( searchMap.accessPrivilege === 'sharedByMe' ) {
        searchMap.criteria.searchString = localTextBundle.type + ':"Fnd0Snapshot" AND ' + localTextBundle.owning_user + ':$ME AND "' + localTextBundle.owning_identifier + '":Conversation';
    } else if ( searchMap.accessPrivilege === 'sharedWithMe' ) {
        searchMap.criteria.searchString = localTextBundle.type + ':"Fnd0Snapshot" AND NOT ' + localTextBundle.owning_user + ':$ME AND "' + localTextBundle.owning_identifier + '":Conversation';
    }
    _provider.context.search = searchMap;
    return {
        provider: _provider
    };
};

/**
 * Get Root product objects from snapshots
 *
 * @param {Array} snapshotobjs List of Snapshots
 */
export let shareUrlCommandContext = function( snapshotobjs ) {
    let allProductsUrl = [];
    for ( let j = 0; j < snapshotobjs.length; ++j ) {
        let objParams = {};
        let objToCopy = snapshotobjs[j];
        if ( objToCopy.props && objToCopy.props.fnd0Roots ) {
            let productObj = _cdmSvc.getObject( objToCopy.props.fnd0Roots.dbValues[0] );
            objParams.snap_uid = objToCopy.uid;
            objParams.uid = productObj.uid;
        } else {
            objParams.uid = objToCopy.uid;
        }
        var stateSvc = AwStateService.instance;
        let productUrl = browserUtils.getBaseURL() + stateSvc.href( 'com_siemens_splm_clientfx_tcui_xrt_showObject', objParams, {
            inherit: false
        } );
        allProductsUrl.push( productUrl );
    }
    return tcClipboardService.copyContentToOSClipboard( allProductsUrl );
};

/**
 * Gets search String with wild card appended at end to user entered text
 * @param {String} filterBoxText search string input from user
 * @returns {String} Search string with wild card appended at the end of the string
 */
export let getSearchStringWithWildCard = ( filterBoxText )=>{
    return filterBoxText + '*';
};
/**
 * Gets awb0Product property for product context info provided(ItemRevision uid or WorksetRevision uid)
 * In case of workset always return worksetRevision uid evenif subset is selected
 * @param {Object} productContextInfo product context info
 * @returns {String} ItemRevision uid or WorksetRevision uid
 */
export let getProductRevisionInfo = ( productContextInfo )=>{
    if( productContextInfo && productContextInfo.props.awb0AlternateConfiguration ) {
        let alternatePCIUid = productContextInfo.props.awb0AlternateConfiguration.dbValues[ 0 ];
        if( !_.isNull( alternatePCIUid ) && !_.isUndefined( alternatePCIUid ) && !_.isEmpty( alternatePCIUid ) ) {
            let alternatePCI =  _cdmSvc.getObject( alternatePCIUid );
            if( alternatePCI &&  alternatePCI.props && alternatePCI.props.awb0Product && !_.isEmpty( alternatePCI.props.awb0Product.dbValues[0] ) ) {
                return alternatePCI.props.awb0Product.dbValues[0];
            }
        }
    }
    return productContextInfo.props.awb0Product.dbValues[0];
};

export default exports = {
    productSnapshotPanelRevealed,
    createProductSnapshotAndNotify,
    createProductSnapshot,
    deleteProductSnapshot,
    deleteProductSnapshotAndNotify,
    startEditProductSnapshot,
    renameProductSnapshotAndNotify,
    clearPreviousProductSnapshotSelection,
    setProductSnapshotView,
    getFileURLFromTicket,
    getDefaultPageSize,
    updateProductSnapshotAndNotify,
    inlineRenameProductSnapshot,
    modifyProductSnapshot,
    updateProductSnapshotOnDiscussion,
    clearSnapshotDiscussionData,
    loadProductSnapshotDataForCard,
    createProductSnapshotOnDiscussion,
    setActiveListPanel,
    renderTextBox,
    handleTextEditClick,
    disableInlineEdit,
    handleThumbnailClick,
    selectProductSnapshot,
    setViewerContext,
    buildTitle,
    getSnapshotSearchString,
    shareUrlCommandContext,
    getProductRevisionInfo,
    getSearchStringWithWildCard,
    renderEditPanelTextBox
};
