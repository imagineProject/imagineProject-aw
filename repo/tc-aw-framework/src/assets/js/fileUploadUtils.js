// Copyright (c) 2022 Siemens

/**
 * @module js/fileUploadUtils
 */
import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import autoAssignSvc from 'js/autoAssignService';
import awConfiguredRevSvc from 'js/awConfiguredRevService';
import AwHttpService from 'js/awHttpService';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import imageOrientationUtils from 'js/imageOrientationUtils';
import messagingSvc from 'js/messagingService';
import pasteSvc from 'js/pasteService';
import soaSvc from 'soa/kernel/soaService';
import logger from 'js/logger';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import fileStreamingUtils from 'js/fileStreamingUtils';
import dialogService from 'js/dialogService';
import msgSvc from 'js/messagingService';

let exports = {};
let _addPanelCloseEventLsnr;
let _fileUploadCompleted = false;
let _isPanelOpen = true;
const addOprFailedEvent = 'addObject.addOprfailed';
const commitFailedEvent = 'dataset.commitFailed';

/**
 * getCreateDatasetsBody - returns the body for createDatasets given the viewModel data obj
 * @param {Object} data the viewModel data object
 * @return {Object} the body contents
 */
const getCreateDatasetsBody = function( datasetNameProp, datasetTypeProp, datasetDescProp, referenceProp, fileName ) {
    let datasetTypePropIn = datasetTypeProp.getValue ? datasetTypeProp.getValue() : datasetTypeProp.dbValue;
    let datasetNamePropIn = datasetNameProp.getValue ? datasetNameProp.getValue() : datasetNameProp.dbValue;
    let referencePropIn = referenceProp.getValue ? referenceProp.getValue() : referenceProp.dbValue;
    let datasetDescPropIn = datasetDescProp.getValue ? datasetDescProp.getValue() : datasetDescProp.dbValue;

    //when input value into reference LOV directly, datasetTypeProp.dbValue.props will be undefined.
    let dtObjRefVals = _.get( datasetTypePropIn, 'props.object_string.dbValues' );
    let dtObjRefVal = '';
    if( dtObjRefVals && _.isArray( dtObjRefVals ) ) {
        dtObjRefVal = dtObjRefVals[ 0 ];
    } else {
        dtObjRefVal = datasetTypePropIn;
    }
    return {
        input: [ {
            clientId: datasetNamePropIn,
            container: {
                uid: cdm.NULL_UID,
                type: 'unknownType'
            },
            datasetFileInfos: [ {
                fileName: fileName,
                namedReferenceName: referencePropIn ? referencePropIn.referenceName : '',
                isText: addObjectUtils.getFileFormat( referenceProp )
            } ],
            relationType: '',
            description: datasetDescPropIn,
            name: datasetNamePropIn,
            type: dtObjRefVal
        } ]
    };
};

/**
 * getChunkedUploadBody - returns the body for getDatasetTicketsForChunkedUpload given the viewModel data obj
 *
 * @param {Object} commitInfos -
 * @returns {Object} -
 */
const getChunkedUploadBody = function( commitInfos ) {
    return {
        inputs: [ {
            dataset: commitInfos.dataset,
            createNewVersion: false,
            datasetFileInfos: [ {
                clientId: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.clientId,
                fileName: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.fileName,
                namedReferencedName: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.namedReferenceName,
                isText: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.isText,
                allowReplace: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.allowReplace
            } ]
        } ]
    };
};

/**
 * getCommitDatasetFilesBody - returns the body for commitDatasetFiles given the viewModel data obj
 * @param {Object} data the viewModel data object
 * @return {Object} the body contents
 */
const getCommitDatasetFilesBody = function( commitInfos, fmsTicket ) {
    return {
        commitInput: [ {
            dataset: commitInfos.dataset,
            createNewVersion: false,
            datasetFileTicketInfos: [ {
                datasetFileInfo: {
                    clientId: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.clientId,
                    fileName: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.fileName,
                    namedReferencedName: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.namedReferenceName,
                    isText: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.isText,
                    allowReplace: commitInfos.datasetFileTicketInfos[ 0 ].datasetFileInfo.allowReplace
                },
                ticket: fmsTicket
            } ]
        } ]
    };
};

/**
 * getRelatedModifiedObj - returns the related modified event data as an obj
 * @param {Object} data the viewModel data object
 * @return {Object} related modified event data
 */
const getRelatedModifiedObj = function( createdObject, targetObject, panelPinned ) {
    return {
        refreshLocationFlag: Boolean( appCtxSvc.getCtx( 'addObject.refreshFlag' ) && !panelPinned ),
        isPinnedFlag: panelPinned,
        relations: '',
        relatedModified: [ targetObject ],
        createdObjects: [ createdObject ]
    };
};

/**
 * deleteDataset - call the deleteObjects soa given the viewModel
 * @param {Object} data the viewModel data object
 */
const deleteDataset = async createdObject => await soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: [ createdObject ] } );

/**
 * onBeforeUnload
 * @param {Object} event window event data
 * @return {String} message
 */
const onBeforeUnload = function( event ) {
    let message = '';
    if( typeof event === 'undefined' ) {
        event = window.event;
    }
    if( event ) {
        event.returnValue = message;
    }
    return message;
};

/**
 * cancelAddProgress - tell the ctx we are no longer doing an add & unsubscribe event listeners
 */
const cancelAddProgress = function() {
    appCtxSvc.unRegisterCtx( 'addItemEventProgressing' );
    window.removeEventListener( 'beforeunload', onBeforeUnload );
    if( _addPanelCloseEventLsnr ) {
        eventBus.unsubscribe( _addPanelCloseEventLsnr );
    }
    _fileUploadCompleted = true;
    _addPanelCloseEventLsnr = null;
};

/**
 * createDatasets - calls the create createDatasets soa and assigns the res values to data
 * @param {Object} data the viewModel data object
 */
const createDatasets = async function( datasetName, datasetType, datasetDesc, reference, fileName ) {
    try {
        const { datasetOutput, ServiceData } = await soaSvc.postUnchecked( 'Core-2010-04-DataManagement', 'createDatasets', getCreateDatasetsBody( datasetName, datasetType, datasetDesc, reference,
            fileName ) );
        const errMessage = messagingSvc.getSOAErrorMessage( ServiceData );
        if( errMessage.length === 0 && datasetOutput.length > 0 ) {
            let fmsTicket = datasetOutput[ 0 ].commitInfo[ 0 ].datasetFileTicketInfos[ 0 ].ticket;
            let commitInfos = datasetOutput[ 0 ].commitInfo[ 0 ];
            let relatedModified = datasetOutput[ 0 ].dataset;
            let createdObject = datasetOutput[ 0 ].dataset;

            return {
                fmsTicket,
                commitInfos,
                relatedModified,
                createdObject
            };
        }
        eventBus.publish( addOprFailedEvent );
        messagingSvc.showError( errMessage );
        throw new Error( 'fileUploadUtils - createDatasets' );
    } catch ( error ) {
        eventBus.publish( addOprFailedEvent );
        cancelAddProgress();
        throw error;
    }
};

const errorCodesToDisplayToUser = [ -1, 400, 500 ];
const errorCodesWithCustomMessages = {
    416: 'fileSizeException',
    401: 'userNotAuthorized'
};
const fscVirusScanCodes = [ '-9051', '-9052' ];

/**
 * Show the upload error to user
 *
 * @param {Object} error error
 * @param {String} uploadErrorI18n Error message i18n
 * @param {String} fileName File name
 */
export const displayError = async( error, uploadErrorI18n, fileName ) => {
    let { data: errorData, status } = error;
    if( !errorData && error.response && error.response.data ) {
        errorData = error.response.data;
    }
    if( !status && error.response && error.response.status ) {
        status = error.response.status;
    }
    if( errorData?.errorCode && fscVirusScanCodes.includes( errorData.errorCode ) ) {
        const baseMsg = await localeService.getLocalizedText( 'addObjectMessages', 'fileUploadVirusScanError' );
        const msg = baseMsg.replace( '{0}', fileName );
        messagingSvc.showError( msg );
    } else if( errorCodesToDisplayToUser.includes( status ) && errorData && errorData.statusMessage ) {
        const msg = uploadErrorI18n.replace( '{0}', errorData.statusMessage );
        messagingSvc.showError( msg );
    } else if( errorCodesWithCustomMessages[ status ] ) {
        const msg = await localeService.getLocalizedText( 'addObjectMessages', errorCodesWithCustomMessages[ status ] );
        messagingSvc.showError( msg.format( fileName ) );
    } else {
        const msg = await localeService.getLocalizedText( 'BaseMessages', 'SERVER_ERROR' );
        messagingSvc.showError( msg );
    }
};

/**
 * upload - uploads a file to fms with data.formData
 *
 * @param {Object} formData - fms formData
 * @param {Object} createdObject - newly created object
 * @param {Object} data the viewModel data object
 * @param {Object} datasetState - the dataset state atomic data
 */
const upload = async function( formData, createdObject, data, datasetState ) {
    try {
        await fileStreamingUtils.uploadFile( formData, {}, datasetState );
    } catch ( error ) {
        logger.error( error );
        eventBus.publish( commitFailedEvent );
        eventBus.publish( addOprFailedEvent );
        await displayError( error, data.i18n.fileUploadError, data.fileName );
        cancelAddProgress();
        await deleteDataset( createdObject );
        throw new Error( 'fileUploadUtils - upload' );
    }
};

/**
 * commitDatasetFiles - calls the commitDatasetFiles soa
 * @param {Object} data the viewModel data object
 */
const commitDatasetFiles = async function( commitsInfo, fmsTicket, data ) {
    try {
        await soaSvc.post( 'Core-2006-03-FileManagement', 'commitDatasetFiles', getCommitDatasetFilesBody( commitsInfo, fmsTicket ) );
    } catch ( error ) {
        eventBus.publish( commitFailedEvent );
        eventBus.publish( addOprFailedEvent );
        cancelAddProgress();
        await deleteDataset( data );
        const errMessage = messagingSvc.getSOAErrorMessage( error );
        messagingSvc.showError( errMessage.split( '\n' )[0] );
        throw error;
    }
};

/**
 * addObjectToTarget - pastes the obj to the correct target
 * @param {Object} data the viewModel data object
 */
const addObjectToTarget = async function( targetObject, objToRelateBasedOnConfiguredRevRule, creationRelation, subPanelContext ) {
    try {
        const relationType = creationRelation.dbValue;
        await pasteSvc.execute( targetObject, objToRelateBasedOnConfiguredRevRule, relationType, subPanelContext );
    } catch ( error ) {
        eventBus.publish( 'pasteItem.commitFailed' );
        cancelAddProgress();
        //will try to delete the dataset when get a special partial error
        deleteDatasetForSpecialError( objToRelateBasedOnConfiguredRevRule, error );
        throw new Error( 'fileUploadUtils - addObjectToTarget' );
    }
};

/**
 * uploadFilePreinitialized - tell hosting to upload a file
 * @param {Object} data the viewModel data object
 * @param {Object} targetObject target object
 */
const uploadFilePreinitialized = async function( data, targetObject ) {
    try {
        const { fmsTicket, fileName } = data;
        const { uid } = targetObject;
        await addObjectUtils.uploadFilePreinit( uid, fmsTicket, fileName );
    } catch ( error ) {
        eventBus.publish( commitFailedEvent );
        await deleteDataset( data );
        throw new Error( 'fileUploadUtils - uploadFilePreinitialized' );
    }
};

/**
 * showAddedMessage - show the created/submitted message
 * @param {Object} data the viewModel data object
 */
const showAddedMessage = async function( createdObject, targetObject, data ) {
    let msg = '';
    let createdObjTitle = createdObject.props.object_string.dbValues[ 0 ];

    if( createdObject && data.revision__awp0ProcessTemplates && data.revision__awp0ProcessTemplates.dbValue ) {
        if( _isPanelOpen ) {
            msg = msg.concat( data.i18n.submitSuccessful.replace( '{0}', createdObjTitle ) );
            messagingSvc.showInfo( msg );
        } else {
            msg = msg.concat( data.i18n.submitSuccessfulWithTargetLocation.replace( '{0}', createdObjTitle ) );
            msg = msg.replace( '{1}', targetObject.props.object_name.dbValues[ 0 ] );
            messagingSvc.showInfo( msg );
        }
    } else if( createdObject ) {
        if( _isPanelOpen ) {
            msg = msg.concat( data.i18n.pasteSuccessful.replace( '{0}', createdObjTitle ) );
            messagingSvc.showInfo( msg );
        } else {
            msg = msg.concat( data.i18n.pasteSuccessfulWithTargetLocation.replace( '{0}', createdObjTitle ) );
            msg = msg.replace( '{1}', targetObject.props.object_name.dbValues[ 0 ] );
            messagingSvc.showInfo( msg );
        }
    }
};

/**
 * wrapUpFileUpload - Runs the logic for everything after commitDatasetFiles soa
 * @param {Object} data the viewModel data object
 */
const wrapUpFileUpload = async function( createdObject, targetObject, objCreateInfo, unpinnedToForm, data, creationRelation, subPanelContext ) {
    eventBus.publish( 'gwt.CreateOrAddObjectCompleteEvent', { createdObjs: [ createdObject ] } );

    if( objCreateInfo && objCreateInfo.createType ) {
        addObjectUtils.updateRecentUsedTypes( objCreateInfo.createType );
    }

    if( targetObject !== undefined ) {
        let objToRelateBasedOnConfiguredRevRule = awConfiguredRevSvc.evaluateObjsBasedOnConfiguredRevRule( [ createdObject ] );
        if( !creationRelation ) {
            creationRelation = {};
        }
        await addObjectToTarget( targetObject, objToRelateBasedOnConfiguredRevRule, creationRelation, subPanelContext );

        eventBus.publish( 'cdm.relatedModified', getRelatedModifiedObj( createdObject, targetObject, subPanelContext?.panelPinned ) );

        if( subPanelContext && !subPanelContext.panelPinned && _isPanelOpen ) {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
            if( subPanelContext?.popupOptions?.popupId ) {
                dialogService.closeDialog( '', subPanelContext.popupOptions.popupId );
            }
        }

        if( subPanelContext?.panelPinned ) {
            await autoAssignSvc.autoAssignAllProperties( data, 'CREATE', null, subPanelContext?.editHandler );
        }
        _fileUploadCompleted = true;

        showAddedMessage( createdObject, targetObject, data );
    }

    cancelAddProgress();
};

export let setFileParameters = function( fileName, validFile, fileNameNoExt, fileExt, formData ) {
    return {
        fileName,
        validFile,
        fileNameNoExt,
        fileExt,
        formData
    };
};

export let updateFormData = function( formData, key, value ) {
    if( formData ) {
        formData.append( key, value );
    }
};

/**
 * validateFileSignatures - check the begining bytes of the file given against the known file type signatures
 * @param {Object} formDataObj file object to be used for upload
 * @param {text} errorMessage message to user if the image is inValid
 * @param {Object} validateSignatures signatures to validate the file against
 * @returns {Boolean} - valid or invalid file
 */
const validateFileSignatures = ( formDataObj, errorMessage, validateSignatures ) => {
    const file = formDataObj.get( 'fmsFile' );
    return new Promise( ( resolve, reject ) => {
        let reader = new FileReader();
        reader.onload = function( e ) {
            const array = new Uint8Array( e.target.result ).subarray( 0, 2 );
            let isValidImage = false;

            for( const signature of Object.values( validateSignatures ) ) {
                if( array.every( ( byte, index ) => byte === signature[ index ] ) ) {
                    isValidImage = true;
                    break;
                }
            }

            if( !isValidImage ) {
                msgSvc.showError( `${errorMessage}` );
                resolve( false );
            }
            resolve( isValidImage );
        };

        reader.onerror = ( error ) => {
            if( error.response ) {
                msgSvc.showError( `${errorMessage}` );
            }
            resolve( false );
        };

        reader.readAsArrayBuffer( file.slice( 0, 4 ) );
    } );
};

/**
 * validateImageFile - Defines the image signatures for the validation process during the validateFileSignatures() method
 * @param {Object} formDataObj file object to be used for upload
 * @param {text} errorMessage message to user if the image is inValid
 */
export let validateImageFile = async function( formDataObj, errorMessage ) {
    const validateImageSignatures = {
        jpeg: [ 0xFF, 0xD8 ],
        jpg: [ 0xFF, 0xD8 ],
        png: [ 0x89, 0x50 ],
        gif: [ 0x47, 0x49 ]
    };
    const validImage = await validateFileSignatures( formDataObj, errorMessage, validateImageSignatures );
    return {
        validImage
    };
};

/**
 * uploadFile - Do the upload file routine. This is originally an action flow in newTabPageSubViewModel, but
 * has now been ported to JS because js is async and action flow isn't. Each line of code in this function
 * relates to an action from the original viewModel. This is NOT a best practice. You should use the viewModel
 * design this originally was implemented with. This was a customer escalation.
 * @param {Object} data the viewModel data object
 */
export let uploadFile = async function( data, targetObject, datasetName, datasetType, datasetDesc, reference, fileName, formData, creationRelation, subPanelContext ) {
    _addPanelCloseEventLsnr = eventBus.subscribe( 'appCtx.register', eventData => {
        if( eventData.name === 'activeToolsAndInfoCommand' ) {
            _isPanelOpen = false;

            if( !_fileUploadCompleted ) {
                messagingSvc.showInfo( data.i18n.fileUploadInProgress );
            }

            eventBus.unsubscribe( _addPanelCloseEventLsnr );
            _addPanelCloseEventLsnr = null;
        }
    } );

    window.addEventListener( 'beforeunload', onBeforeUnload );

    _isPanelOpen = true;
    _fileUploadCompleted = false;
    const datasetState = subPanelContext?.datasetState;

    try {
        const chunked = determineChunkedUpload( formData );
        let fmsTicket;
        let createDatasetResponse = await createDatasets( datasetName, datasetType, datasetDesc, reference, fileName );
        if( chunked ) {
            const chunkedUploadTicketResponse = await soaSvc.postUnchecked( 'Internal-Core-2021-06-FileManagement', 'getDatasetTicketsForChunkedUpload', getChunkedUploadBody( createDatasetResponse.commitInfos ) );
            fmsTicket = chunkedUploadTicketResponse.commitInfo[ 0 ].datasetFileTicketInfos[ 0 ].ticket;
            formData.set( 'fmsTicket', fmsTicket );
        } else {
            fmsTicket = createDatasetResponse.fmsTicket;
            formData.set( 'fmsTicket', fmsTicket );
        }
        if( !appCtxSvc.getCtx( 'HostedFileNameContext.filename' ) ) {
            eventBus.publish( 'fmsTicket.update' );
            eventBus.publish( 'fmsFile.correctFormFileOrientation' );

            await imageOrientationUtils.correctFormFileOrientation( formData, 'fmsFile' );
            eventBus.publish( 'dataset.datasetCreated' );

            await upload( formData, createDatasetResponse.createdObject, data, datasetState );
            eventBus.publish( 'dataset.fileUploaded' );

            await commitDatasetFiles( createDatasetResponse.commitInfos, fmsTicket, data );
            eventBus.publish( 'addObject.objectcreated' );

            await wrapUpFileUpload( createDatasetResponse.createdObject, targetObject, null, {}, data, creationRelation, subPanelContext );
        } else if( appCtxSvc.getCtx( 'HostedFileNameContext.filename' ) ) {
            eventBus.publish( 'dataset.datasetCreatedPreinitialized' );
            data.fmsTicket = data.fmsTicket ? data.fmsTicket : createDatasetResponse.fmsTicket;
            data.createdObject = data.createdObject ? data.createdObject : createDatasetResponse.createdObject;

            await uploadFilePreinitialized( data, targetObject );
            eventBus.publish( 'dataset.fileUploaded' );

            await commitDatasetFiles( createDatasetResponse.commitInfos, createDatasetResponse.fmsTicket, data );
            eventBus.publish( 'addObject.objectcreated' );

            if( data.fmsTicket ) {
                eventBus.publish( 'addObject.datasetCommitted.hosting', {
                    createdObject: data.createdObject,
                    filename: data.fileName,
                    ticket: data.fmsTicket
                } );
            }

            await wrapUpFileUpload( createDatasetResponse.createdObject, targetObject, null, {}, data, creationRelation, subPanelContext );
        }

        return { isObjectCreateInProgress: false };
    } catch ( error ) {
        return { isObjectCreateInProgress: false };
    }
};

const deleteDatasetForSpecialError = function( sourceObject, error ) {
    const RELATION_FAILED_ERROR_CODES = [
        89009, 89020,
        48021, 51003 //user does not have write access, item not modifiable
    ];
    if( sourceObject && sourceObject.length > 0 ) {
        let isDataset = false;
        let datasetObj = null;
        for( let modelObj of sourceObject ) {
            if( modelObj.modelType && modelObj.modelType.parentTypeName === 'Dataset' ) {
                isDataset = true;
                datasetObj = modelObj;
            }
        }
        let isDatasetAttachRelationFailed = false;
        if( isDataset && error && error.cause && error.cause.partialErrors ) {
            for( let partialError of error.cause.partialErrors ) {
                if( partialError.errorValues ) {
                    for( let errorValue of partialError.errorValues ) {
                        if( RELATION_FAILED_ERROR_CODES.includes( errorValue.code ) ) {
                            isDatasetAttachRelationFailed = true;
                            break;
                        }
                    }
                }
            }
        }
        //try to delete dataset when attach relation failed
        if( isDatasetAttachRelationFailed && datasetObj ) {
            deleteDataset( datasetObj );
        }
    }
};

/**
 * Determine if upload should be chunked
 *
 * @param {Object} formData - formdata object containing fmsFile
 * @returns {Boolean} - chunked?
 */
const determineChunkedUpload = function( formData ) {
    const file = formData.get( 'fmsFile' );
    return file.size > fileStreamingUtils.CHUNK_UPLOAD_THRESHOLD;
};

const getDatasetTicketsForChunkedUpload = async function( commitInfos ) {
    return  await soaSvc.postUnchecked( 'Internal-Core-2021-06-FileManagement', 'getDatasetTicketsForChunkedUpload',
        getChunkedUploadBody( commitInfos ) );
};

const correctFormFileOrientation = async function( formData ) {
    await imageOrientationUtils.correctFormFileOrientation( formData, 'fmsFile' );
};

export let uploadMultipleFiles = async function( data, targetObject, datasetPropertiesList, datasetInfo,
    relationListForMultipleFiles, subPanelContext ) {
    _addPanelCloseEventLsnr = eventBus.subscribe( 'appCtx.register', eventData => {
        if( eventData.name === 'activeToolsAndInfoCommand' ) {
            _isPanelOpen = false;
            if( !_fileUploadCompleted ) {
                messagingSvc.showInfo( data.i18n.fileUploadInProgress );
            }
            eventBus.unsubscribe( _addPanelCloseEventLsnr );
            _addPanelCloseEventLsnr = null;
        }
    } );

    window.addEventListener( 'beforeunload', onBeforeUnload );
    _isPanelOpen = true;
    _fileUploadCompleted = false;
    const datasetState = subPanelContext?.datasetState;

    try {
        let datasetOutputArray = await createMultipleDatasets( datasetPropertiesList, datasetInfo );
        let createdObjectsList = [];
        let chunkedUploadTicketResponseArr = [];
        let correctFormFileOrientationResponseArr = [];
        let uploadResponseArr = [];
        let formDataArray = [];
        let chunkedArr = [];
        for( let i = 0; i < datasetOutputArray.length; i++ ) {
            let formData = new FormData();
            formData.append( 'fmsFile', datasetInfo.formData.get( i ) );
            const chunked = determineChunkedUpload( formData );
            chunkedArr.push( chunked );
            let fmsTicket;
            if( chunked ) {
                chunkedUploadTicketResponseArr.push( getDatasetTicketsForChunkedUpload( datasetOutputArray[ i ].commitInfos ) );
            } else {
                fmsTicket = datasetOutputArray[ i ].fmsTicket;
                formData.set( 'fmsTicket', fmsTicket );
            }
            formDataArray.push( formData );
        }

        let chunkedUploadTicketResponseList = await Promise.all( chunkedUploadTicketResponseArr );
        _.forEach( chunkedUploadTicketResponseList, function( chunkedUploadTicketResponse, index ) {
            let fmsTicket = chunkedUploadTicketResponse.commitInfo[ 0 ].datasetFileTicketInfos[ 0 ].ticket;
            let formDataIndex = index;
            while ( formDataArray[formDataIndex].get( 'fmsTicket' ) ) {
                formDataIndex++;
                if ( formDataIndex >= formDataArray.length ) {
                    return;
                }
            }
            let formData = formDataArray[ formDataIndex ];
            formData.set( 'fmsTicket', fmsTicket );
            formDataArray[ formDataIndex ] = formData;
            if( chunkedArr[ formDataIndex ] ) {
                datasetOutputArray[ formDataIndex ].fmsTicket = fmsTicket;
            }
        } );

        for( let i = 0; i < datasetOutputArray.length; i++ ) {
            let formData = formDataArray[ i ];
            eventBus.publish( 'fmsTicket.update' );
            eventBus.publish( 'fmsFile.correctFormFileOrientation' );
            correctFormFileOrientationResponseArr.push( correctFormFileOrientation( formData ) );
            eventBus.publish( 'dataset.datasetCreated' );
            uploadResponseArr.push( upload( formData, datasetOutputArray[ i ].createdObject, data, datasetState, true ) );
            eventBus.publish( 'dataset.fileUploaded' );
            createdObjectsList.push( datasetOutputArray[ i ].createdObject );
        }

        await Promise.all( correctFormFileOrientationResponseArr );
        await Promise.all( uploadResponseArr );

        await commitMultipleDatasetFiles( datasetOutputArray, data );
        eventBus.publish( 'addObject.objectcreated' );

        await wrapUpMultipleFilesUpload( datasetOutputArray, createdObjectsList, targetObject,
            relationListForMultipleFiles, subPanelContext, data );

        if( subPanelContext && !subPanelContext.panelPinned ) {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
            if( subPanelContext?.popupOptions?.popupId ) {
                dialogService.closeDialog( '', subPanelContext.popupOptions.popupId );
            }
        }

        if( subPanelContext?.panelPinned ) {
            await autoAssignSvc.autoAssignAllProperties( data, 'CREATE', null, subPanelContext?.editHandler );
        }
        _fileUploadCompleted = true;

        cancelAddProgress();
    } catch ( error ) {
        return { isObjectCreateInProgress: false };
    }
};

const createMultipleDatasets = async function( datasetPropertiesList, datasetInfo ) {
    try {
        let createDatasetRequestBody = { input: [] };
        for( let i = 0; i < datasetPropertiesList.length; i++ ) {
            const reqBody = getCreateDatasetsBody( datasetPropertiesList[i].datasetName, datasetPropertiesList[i].datasetType, datasetPropertiesList[i].datasetDesc,
                datasetPropertiesList[i].newReference, datasetInfo.fileName[i] );
            createDatasetRequestBody.input.push( reqBody.input[0] );
        }
        const { datasetOutput, ServiceData } = await soaSvc.postUnchecked( 'Core-2010-04-DataManagement', 'createDatasets',
            createDatasetRequestBody );

        let datasetOutputArray = [];
        if( datasetOutput.length > 0 ) {
            for( let i = 0; i < datasetOutput.length; i++ ) {
                datasetOutputArray.push( {
                    fmsTicket: datasetOutput[ i ].commitInfo[ 0 ].datasetFileTicketInfos[ 0 ].ticket,
                    commitInfos: datasetOutput[ i ].commitInfo[ 0 ],
                    relatedModified: datasetOutput[ i ].dataset,
                    createdObject: datasetOutput[ i ].dataset
                } );
            }
            return datasetOutputArray;
        }
        eventBus.publish( addOprFailedEvent );
        const errMessage = messagingSvc.getSOAErrorMessage( ServiceData );
        messagingSvc.showError( errMessage );
        throw new Error( 'fileUploadUtils - createDatasets' );
    } catch ( error ) {
        eventBus.publish( addOprFailedEvent );
        cancelAddProgress();
        throw error;
    }
};

const commitMultipleDatasetFiles = async function( datasetOutputArray, data ) {
    try {
        let commitDatasetFilesRequestBody = { commitInput: [] };
        for( let i = 0; i < datasetOutputArray.length; i++ ) {
            const commitDatasetFileRequest = getCommitDatasetFilesBody( datasetOutputArray[ i ].commitInfos, datasetOutputArray[ i ].fmsTicket );
            commitDatasetFilesRequestBody.commitInput.push( commitDatasetFileRequest.commitInput[0] );
        }
        await soaSvc.post( 'Core-2006-03-FileManagement', 'commitDatasetFiles', commitDatasetFilesRequestBody );
    } catch ( error ) {
        eventBus.publish( commitFailedEvent );
        eventBus.publish( addOprFailedEvent );
        cancelAddProgress();
        await deleteDataset( data );
        throw error;
    }
};

const executePasteSvc = async function( targetObject, sourceObjList, relationType, subPanelContext ) {
    await pasteSvc.execute( targetObject, sourceObjList, relationType, subPanelContext );
};

const wrapUpMultipleFilesUpload = async function( datasetOutputArray, createdObjectsList, targetObject, relationListForMultipleFiles, subPanelContext, data ) {
    eventBus.publish( 'gwt.CreateOrAddObjectCompleteEvent', { createdObjs: createdObjectsList } );

    let relationTypeMap = new Map();
    let groupByRelationTypeList = [];
    let objToRelateBasedOnConfiguredRevRuleArray = [];
    let executePasteSvcResponseArr = [];
    if( targetObject !== undefined ) {
        for( let i = 0; i < datasetOutputArray.length; i++ ) {
            let objToRelateBasedOnConfiguredRevRule = awConfiguredRevSvc.evaluateObjsBasedOnConfiguredRevRule( [ datasetOutputArray[i].createdObject ] );
            objToRelateBasedOnConfiguredRevRuleArray.push( objToRelateBasedOnConfiguredRevRule );
            if( !relationTypeMap.has( relationListForMultipleFiles[i].creationRelation.dbValue ) ) {
                relationTypeMap.set( relationListForMultipleFiles[i].creationRelation.dbValue, objToRelateBasedOnConfiguredRevRule );
            } else {
                let sourceObjList = relationTypeMap.get( relationListForMultipleFiles[i].creationRelation.dbValue );
                sourceObjList.push( objToRelateBasedOnConfiguredRevRule[0] );
                relationTypeMap.set( relationListForMultipleFiles[i].creationRelation.dbValue, sourceObjList );
            }
        }

        try {
            relationTypeMap.forEach( async( sourceObjList, relationType ) => {
                groupByRelationTypeList.push( {
                    relationType: relationType,
                    sourceObjList: sourceObjList
                } );
            } );
            for( let i = 0; i < groupByRelationTypeList.length; i++ ) {
                executePasteSvcResponseArr.push( executePasteSvc( targetObject, groupByRelationTypeList[i].sourceObjList, groupByRelationTypeList[i].relationType, subPanelContext ) );
            }
            await Promise.all( executePasteSvcResponseArr );
            eventBus.publish( 'cdm.relatedModified', {
                refreshLocationFlag: Boolean( appCtxSvc.getCtx( 'addObject.refreshFlag' ) && !subPanelContext?.panelPinned ),
                isPinnedFlag: subPanelContext?.panelPinned,
                relations: '',
                relatedModified: [ targetObject ],
                createdObjects: createdObjectsList
            } );
        } catch ( error ) {
            eventBus.publish( 'pasteItem.commitFailed' );
            cancelAddProgress();
            //will try to delete the dataset when get a special partial error
            _.forEach( objToRelateBasedOnConfiguredRevRuleArray, function( objToRelateBasedOnConfiguredRevRule ) {
                deleteDatasetForSpecialError( objToRelateBasedOnConfiguredRevRule, error );
            } );
            throw new Error( 'fileUploadUtils - addObjectToTarget' );
        }

        for( let i = 0; i < datasetOutputArray.length; i++ ) {
            showAddedMessage( datasetOutputArray[ i ].createdObject, targetObject, data );
        }
    }
};

export const closePopup = ( popupApi ) => {
    popupApi.hide();
};

export default exports = {
    uploadFile,
    setFileParameters,
    displayError,
    updateFormData,
    determineChunkedUpload,
    uploadMultipleFiles,
    validateImageFile,
    closePopup
};
