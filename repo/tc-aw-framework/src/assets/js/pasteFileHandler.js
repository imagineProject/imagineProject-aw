// Copyright (c) 2023 Siemens

/**
 * This handler is used to manage tc specific paste requirements
 *
 * @module js/pasteFileHandler
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import messagingSvc from 'js/messagingService';
import adapterSvc from 'js/adapterService';
import tcDefaultPasteHandler from 'js/tcDefaultPasteHandler';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
import localeService from 'js/localeService';
import replaceFileService from 'js/Awp0ReplaceDatasetService';
import fileStreamingUtils from 'js/fileStreamingUtils';
import fileUploadUtils from 'js/fileUploadUtils';

const ERROR_CODE_CONSTRAINED_RELATION = 89015;
let  _localeTextBundle = {};

/**
 * Cached reference to 'soa_kernel_clientDataModel'.
 */

/**
 * Cached reference to 'soa_kernel_soaService'.
 */

/**
 * Cached reference to messaging service
 */

/**
 * Cached reference to adapter service
 */

/**
 * Cached reference to '$q' service.
 */

/**
 * Cached URL to FMS service
 */
let _fmsUploadUrl = '';

/**
 * The default paste service.
 *
 */

export let loadConfiguration = async function() {
    _localeTextBundle.dropFailureDefaultRelation = await localeService.getLocalizedTextFromKey( 'dragAndDropMessages.dropFailureDefaultRelation' );
};

/**
 * Get file extension from a file path.
 *
 * @param {String} fileName - file path
 *
 * @returns {String} Extension from the given file name.
 */
function _getFileExtension( fileName ) {
    const extensionIndex = fileName.lastIndexOf( '.' );

    if( extensionIndex >= 0 ) {
        return fileName.substring( extensionIndex + 1 );
    }

    return ''; //$NON-NLS-1$
}

/**
 * Take the array of fileNames and create 'datasets' and related them to the 'target' IModelObject and then upload
 * the JS Files and then commit the files to the new 'datasets'.
 *
 * @param {IModelObject} targetObject - The IModelObject the files are to be pasted onto.
 *
 * @param {Object} getDatasetTypesResponse - Response object from the previous SOA operation (or NULL if the given
 *            'datasetInfos' parameter should be used).
 *
 * @param {Object} datasetInfos - The 'datasetInfos' property from the 'sourceTypes' object in the 'pasteConfig'
 *            JSON.
 *
 * @param {FileArray} sourceFiles - Array of 'source' JS Files being dragged.
 *
 * @param {StringArray} fileNames - Array of file paths to files on this local client machine to create Datasets
 *            for.
 *
 * @param {String} relationType - The 'relationType' to use when attaching the new 'datasets' to the 'target'
 *            IModelObject.
 *
 * @param {Object} fileInfos - An object populated with constious bits of information about the files, types & related
 *            information.
 *
  * @param {Object} objectSetSources - array of objectSet relation sources
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
function _createDatasetsAndRelate( targetObject, getDatasetTypesResponse, datasetInfos, sourceFiles, fileNames,
    relationType, fileInfos, objectSetSources ) {
    //use adapter service to find backing object in case targetobject is RBO
    const targetObjs = [];
    targetObjs.push( targetObject );
    return adapterSvc.getAdaptedObjects( targetObjs ).then(
        function( adaptedObjs ) {
            if( adaptedObjs && adaptedObjs.length > 0 ) {
                let requestIndex = 0;
                const request = [];
                const targetObj = adaptedObjs[ 0 ];
                let datasetTypes = [];

                _.forEach( fileNames, function( fileName ) {
                    /**
                     * Extract the file 'extension', file 'name' and dataSet 'name' from the file's name.
                     * <P>
                     * Note: The following code needs to match the same steps in
                     * 'CreateObjectPresenterW.onDatasetFileSelected'
                     */
                    let extension = null;
                    const extensionIndex = fileName.lastIndexOf( '.' );
                    if( extensionIndex >= 0 ) {
                        extension = fileName.substring( extensionIndex + 1 );
                    } else {
                        extension = ''; //$NON-NLS-1$
                    }

                    let datasetName = null;
                    let seperatorIndex = fileName.lastIndexOf( '\\' );
                    if( seperatorIndex === -1 ) {
                        seperatorIndex = fileName.lastIndexOf( '/' );
                    }

                    let datasetFileName = fileName.substring( seperatorIndex + 1 );
                    if( extensionIndex > seperatorIndex ) {
                        datasetName = fileName.substring( seperatorIndex + 1, extensionIndex );
                    } else {
                        datasetName = fileName.substring( seperatorIndex + 1 );
                    }

                    let useItemIdAsDefaultDatasetName = appCtxService.getCtx( 'preferences.AWC_UseItemIdAsDefaultDatasetName' );

                    // Use item ID as dataset name if preference is enabled
                    if( useItemIdAsDefaultDatasetName?.length === 1 && useItemIdAsDefaultDatasetName[0] === 'true' && targetObj ) {
                        const typeHierarchy = targetObj.modelType.typeHierarchyArray;
                        const itemId = _.get( targetObj, 'props.item_id.dbValues[0]' );
                        if( typeHierarchy.indexOf( 'Item' ) > -1 && itemId ) {
                            datasetName = itemId;
                        } else if( typeHierarchy.indexOf( 'ItemRevision' ) > -1 && itemId ) {
                            const revisionId = _.get( targetObj, 'props.item_revision_id.dbValues[0]' );
                            if( revisionId ) {
                                datasetName = `${itemId}/${revisionId}`;
                            }
                        }
                    }

                    /**
                     * Determine 'Dataset' type, format and 'reference' from the 'datasetInfos' from 'pasteConfig'
                     * (if possible). If not in the 'pasteConfig' then use the information from the previous server
                     * call.
                     */
                    let namedReferenceName = '';
                    let datasetType = '';
                    let isText = false;
                    let found = false;
                    if( datasetInfos ) {
                        for( let i = 0; i < datasetInfos.length; i++ ) {
                            const datesetInfo = datasetInfos[ i ];
                            const exts = datesetInfo.extensions;
                            if( _.includes( exts, extension ) ) {
                                datasetType = datesetInfo.datasetType;
                                isText = datasetInfos.fileFormat === 'TEXT';
                                namedReferenceName = datesetInfo.referenceName;
                                found = true;
                            }
                        }
                    }

                    if( !found && getDatasetTypesResponse ) {
                        /**
                         * Loop through the possible FileTypes & relations valid for the Dataset.
                         */
                        const extentionTypeInfo = getDatasetTypesResponse.output;
                        for( let ii = 0; ii < extentionTypeInfo.length && !datasetType; ii++ ) {
                            const currExtTypeInfo = extentionTypeInfo[ ii ];

                            if( currExtTypeInfo.fileExtension === extension ) {
                                /**
                                 * Loop through the relation information until you find the 1st one that
                                 */
                                for( let jj = 0; jj < currExtTypeInfo.datasetTypesWithDefaultRelInfo.length &&
                                    !datasetType; jj++ ) {
                                    /**
                                     * We assume in the following that the 1st one with the matching file extension
                                     * is good.
                                     * <P>
                                     * This algorithm may need to be extended in the future to handle a 'best fit'
                                     * approach instead.
                                     */
                                    const dataSetTypeInfo = currExtTypeInfo.datasetTypesWithDefaultRelInfo[ jj ];
                                    const refInfo = dataSetTypeInfo.refInfos[ 0 ];
                                    namedReferenceName = refInfo.referenceName;
                                    isText = refInfo.fileFormat === 'TEXT';

                                    const dsType = cdm.getObject( dataSetTypeInfo.datasetType.uid );
                                    if( dsType ) {
                                        datasetType = dsType.props.object_string.dbValues[ 0 ];
                                    }
                                }
                            }
                        }
                    }

                    if( datasetType ) {
                        datasetTypes.push( datasetType );
                        fileInfos.push( {
                            jsFile: sourceFiles[ requestIndex ],
                            datasetType: datasetType,
                            datasetName: datasetName,
                            datasetFileName: datasetFileName,
                            namedReferenceName: namedReferenceName,
                            isText: isText
                        } );

                        request.push( {
                            clientId: requestIndex.toString(),
                            createData: {
                                boName: datasetType,
                                propertyNameValues: {
                                    object_name: [ datasetName ]
                                }
                            },
                            targetObject: targetObj,
                            pasteProp: relationType
                        } );

                        requestIndex++;
                    }
                } );

                const objectSetSourcesLen = objectSetSources.length;
                if( objectSetSourcesLen === 1 ) {
                    return soaSvc.postUnchecked( 'Internal-Core-2012-10-DataManagement', 'createRelateAndSubmitObjects', {
                        inputs: request
                    } );
                }

                return _getDefaultRelation( targetObj, datasetTypes ).then( function( getDefaultRelationResponse ) {
                    let datasetToDefaultRelationMap = new Map();
                    for( const output of getDefaultRelationResponse.output ) {
                        if( output.defaultRelation ) {
                            datasetToDefaultRelationMap.set( output.secondaryType, output.defaultRelation.name );
                        }
                    }

                    for( const input of request ) {
                        if( datasetToDefaultRelationMap.has( input.createData.boName ) && !targetObj.isFileDroppedOnPseudoFolder ) {
                            const updatePasteProp = objectSetSources.includes( datasetToDefaultRelationMap.get( input.createData.boName ) );
                            if( objectSetSourcesLen === 0 || objectSetSourcesLen > 1 && updatePasteProp ) {
                                input.pasteProp = datasetToDefaultRelationMap.get( input.createData.boName );
                            } else if( objectSetSourcesLen > 1 && !updatePasteProp ) {
                                return Promise.reject( { message: _localeTextBundle.dropFailureDefaultRelation } );
                            }
                        }
                    }


                    return soaSvc.postUnchecked( 'Internal-Core-2012-10-DataManagement', 'createRelateAndSubmitObjects', {
                        inputs: request
                    } );
                } );
            }
        } );
}

/**
 *
 * @param {Object} targetObj -  The IModelObject the files are to be pasted onto.
 * @param {*} datasetTypes - Dataset types of the files
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
function _getDefaultRelation( targetObj, datasetTypes ) {
    let request = [];
    for( const datasetType of datasetTypes ) {
        request.push( {
            primaryType: targetObj.modelType.name,
            secondaryType: datasetType
        } );
    }
    return soaSvc.postUnchecked( 'Internal-AWS2-2016-12-DataManagement', 'getDefaultRelation', {
        input: request
    } );
}

/**
 * Invoke the 'getDatasetTypesWithDefaultRelation' SOA operation to determine which 'Dataset' type and 'relation'
 * type to create when dropping onto the given 'taregt' IModelObject.
 *
 * @param {Object} targetObject - The IModelObject the files are to be pasted onto.
 *
 * @param {StringArray} fileNames - Array of file paths to files on this local client machine to create Datasets
 *            for.
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
function _getDatasetTypes( targetObject, fileNames ) {
    // Call to get Dataset types
    const request = {
        parent: targetObject,
        fileExtensions: []
    };

    /**
     * Determine an array of unique file extensions.
     */
    _.forEach( fileNames, function( fileName ) {
        const fileExt = _getFileExtension( fileName );

        if( fileExt && request.fileExtensions.indexOf( fileExt ) === -1 ) {
            request.fileExtensions.push( fileExt );
        }
    } );

    return soaSvc.post( 'Internal-AWS2-2015-10-DataManagement', 'getDatasetTypesWithDefaultRelation', request );
}

/**
 * @param {Object} createDatasetsAndRelateResponse - Result from SOA 'createRelateAndSubmitObjects'.
 *
 * @param {ObjectArray} fileInfos - Array objects who's properties relate a 'dataset' and a file to be committed to
 *            it.
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
function _getWriteTickets( createDatasetsAndRelateResponse, fileInfos ) {
    let chunkedRequests = [];
    let requests = [];

    for( let i = 0; i < fileInfos.length; i++ ) {
        const fileInfo = fileInfos[ i ];

        fileInfo.dataset = createDatasetsAndRelateResponse.output[ i ].objects[ 0 ];
        const request = {};
        const clientId = i.toString();

        if( fileInfo.jsFile.size > fileStreamingUtils.CHUNK_UPLOAD_THRESHOLD ) {
            // chunked
            request.dataset = fileInfo.dataset;
            request.createNewVersion = false;
            request.datasetFileInfos = [ {
                clientId: clientId,
                namedReferencedName: fileInfo.namedReferenceName,
                isText: fileInfo.isText,
                fileName: fileInfo.datasetFileName,
                allowReplace: false
            } ];
            chunkedRequests.push( request );
        } else {
            // non chunked
            request.clientId = clientId;
            request.datasetTypeName = fileInfo.datasetType;
            request.version = 1;
            request.fileInfos = [ {
                clientFileId: clientId,
                refName: fileInfo.namedReferenceName,
                isText: fileInfo.isText,
                fileName: fileInfo.datasetFileName
            } ];
            requests.push( request );
        }
    }

    let promises = [];

    if( chunkedRequests.length > 0 ) {
        promises.push( soaSvc.post( 'Internal-Core-2021-06-FileManagement', 'getDatasetTicketsForChunkedUpload', {
            inputs: chunkedRequests
        } ) );
    }

    if( requests.length > 0 ) {
        promises.push( soaSvc.post( 'Internal-Core-2008-06-FileManagement', 'getWriteTickets', {
            inputs: requests
        } ) );
    }

    return Promise.all( promises );
}

/**
 * Parse the response output for valid file infos.
 *
 * @param {Array} responseOutput - response output
 * @param {Array} fileInfos - input file infos
 * @returns {Array} valid file infos
 */
function _parseValidFiles( responseOutput, fileInfos ) {
    const returnFileInfos = [];
    let currentOutputFound = false;

    for( let i = 0; i < responseOutput.length; i++ ) {
        currentOutputFound = false;
        const objects = responseOutput[ i ].objects;
        for( let j = 0; j < objects.length && !currentOutputFound; j++ ) {
            if( objects[ j ]?.props?.object_name?.dbValues ) {
                const currentObjectType = objects[ j ].type;
                const currentObjectName = objects[ j ].props.object_name.dbValues[ 0 ];

                if( currentObjectType && currentObjectName ) {
                    for( let k = 0; k < fileInfos.length; k++ ) {
                        if( fileInfos[ k ].datasetType === currentObjectType &&
                            fileInfos[ k ].datasetName === currentObjectName ) {
                            returnFileInfos.push( fileInfos[ k ] );
                            currentOutputFound = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    return returnFileInfos;
}

/**
 * Retrieve the error values of the soa response.
 *
 * @param {Array} partialErrors - partial errors from server response
 * @returns {Array} error values
 */
function _getErrorValues( partialErrors ) {
    const returnErrors = [];

    if( partialErrors?.length ) {
        for( let i = 0; i < partialErrors.length; i++ ) {
            const errorValues = partialErrors[ i ].errorValues;

            if( errorValues?.length ) {
                for( let j = 0; j < errorValues.length; j++ ) {
                    if( errorValues[ j ] ) {
                        returnErrors.push( errorValues[ j ] );
                    }
                }
            }
        }
    }

    return returnErrors;
}

const _extractObjectSetSource = ( props ) => {
    const objectSetSources = props?.objectSetData?.source;
    const relationSources = [];
    if( objectSetSources ) {
        const objectSetSourcesArr = objectSetSources.split( ',' );
        _.forEach( objectSetSourcesArr, function( source ) {
            let sources = source.split( '.' );
            if( sources.length > 0 && !relationSources.includes( sources[0] ) ) {
                relationSources.push( sources[0] );
            }
        } );
    }

    return relationSources;
};

// eslint-disable-next-line valid-jsdoc
/**
 * This class allows multiple file uploads to complete
 */
const CommitManager = function() {
    const self = this;

    /**
     * Array of objects containing the 'fileInfo' and 'ticketInfo' for all currently pending commit's of a JS File
     * to a 'dataset'.
     */
    let _pendingCommits = [];

    /**
     * TRUE if a 'commit' SOA operation is currently taking place.
     * <P>
     * Note: This is needed since posting multiple 'commit' operations just 'stacks them up' in the queue.
     */
    let _commitInProgress = false;

    /**
     * The number of currently pending file uploads.
     */
    self.pendingUploadCount = 0;

    /**
     * The total number of file uploaded being managed by this CommitManager.
     */
    self.totalUploadCount = 0;

    /**
     * The 'deferred promise' object used to announce the life cycle of this CommitManager.
     */
    self.deferred = AwPromiseService.instance.defer();

    /**
     * Array of 'dataset' IModelObjects created during the processing of this CommitManager.
     */
    self.sourceObjects = [];

    /**
     * Array of FMS servlet messages generated during the processing of this CommitManager for any files who's
     * upload was unsuccessful.
     */
    self.failureMessages = [];

    /**
     * Array of 'dataset' IModelObjects that had their associated file upload fail and should be deleted before we
     * are done.
     */
    self.pendingDatasetRemovals = [];

    /**
     * This function cleans up any pending 'dataset' deletes and resolves the primary deferred promise with a result
     * data object and finishes this file paste operation.
     */
    self.resolveFinalState = function() {
        /**
         * Check if we have some 'datasets' to delete
         */
        if( self.pendingDatasetRemovals.length > 0 ) {
            /**
             * Remove the children 'datasets' from the 'parent 'target(s)'.
             */
            soaSvc.post( 'Core-2014-10-DataManagement', 'removeChildren', {
                inputData: self.pendingDatasetRemovals
            } ).then( function( response ) {
                /**
                 * Now that the 'datasets' are removed and detached from the 'target', announce to the rest of AW
                 * that it's related data has changed.
                 */
                const updatedObjects = [ self.pendingDatasetRemovals[ 0 ].parentObj ];

                eventBus.publish( 'cdm.relatedModified', {
                    relatedModified: updatedObjects
                } );

                self.resolvePrimaryPromise();

                return response;
            } );
        } else {
            self.resolvePrimaryPromise();
        }
    };

    /**
     * Resolve the primary deferred promise with a data object containing the results of the file paste operation.
     */
    self.resolvePrimaryPromise = function() {
        self.todoCommits.cancel();

        const result = {
            totalCount: self.totalUploadCount,
            sourceObjects: self.sourceObjects,
            failureMessages: self.failureMessages
        };

        self.deferred.resolve( result );
    };

    /**
     * This function is call one or more times during a file upload. When the upload is complete and successful,
     * this function will queue up a 'commit' of that file to its 'dataset' and 'ping' the LoDash 'debounce' used to
     * batchup the 'commit' operations to the SOA server.
     *
     * @param {Event} evt - Event from XMLHttpRequest called or more time during a file upload.
     */
    self.onreadystatechange = function( response, finalCommitManager ) {
        eventBus.publish( 'progress.end', {
            endPoint: _fmsUploadUrl
        } );

        /**
             * Decrement the number of files from the original set we are down to.
             */
        self.pendingUploadCount--;

        /**
             * Check if the upload was successful.
             */
        const fileInfoDone = finalCommitManager.fileInfo;

        /**
             * Check if the upload was replacing existing file.
             */
        const fileInfoReplaced = Boolean( finalCommitManager.commitManager.totalUploadCount );

        if( response.status === 200 ) {
            /**
                 * Build the 'commit' request for the uploaded File to the 'dataset'.
                 */
            const commitRequest = {
                dataset: fileInfoDone.dataset,
                createNewVersion: fileInfoReplaced,
                datasetFileTicketInfos: [ {
                    datasetFileInfo: {
                        fileName: fileInfoDone.datasetFileName,
                        namedReferencedName: fileInfoDone.namedReferenceName,
                        isText: fileInfoDone.isText,
                        allowReplace: fileInfoDone.allowReplace
                    },
                    ticket: finalCommitManager.ticketInfo.ticket
                } ]
            };

            _pendingCommits.push( commitRequest );

            /**
                 * Remember this 'dataset' as one of the successful ones.
                 */
            self.sourceObjects.push( fileInfoDone.dataset );

            /**
                 * 'ping' the LoDash 'debounce' assistant to reset the timer.
                 */
            finalCommitManager.commitManager.todoCommits();
        } else {
            /**
                 * Build a failure message and add it to the collection of such messages.
                 */
            const failureMessage = '(' + finalCommitManager.status + ') ' + finalCommitManager.statusText + ' : ' +
                    finalCommitManager.fileInfo.datasetFileName;

            self.failureMessages.push( failureMessage );

            /**
                 * Queue up the 'dataset' to be removed. Append to the array of an existing entry if from the same
                 * 'target' IModelObject.
                 */
            let foundPending = false;

            _.forEach( self.pendingDatasetRemovals, function( pendingDelete ) {
                if( pendingDelete.parentObj === finalCommitManager.targetObject ) {
                    foundPending = pendingDelete;
                }
            } );

            if( foundPending ) {
                foundPending.childrenObj.push( fileInfoDone.dataset );
            } else {
                const removeInput = {
                    parentObj: finalCommitManager.targetObject,
                    childrenObj: [ fileInfoDone.dataset ]
                };

                self.pendingDatasetRemovals.push( removeInput );
            }

            /**
                 * Check if we have no upload or commits pending by this CommitManager.
                 * <P>
                 * If so: Resolve the 'deferred' for this CommitManager to inform any listener that we are all done.
                 */
            if( self.pendingUploadCount === 0 && _pendingCommits.length === 0 ) {
                self.resolveFinalState();
            }
        }
    };

    /**
     * Calls the SOA 'commitDatasetFiles' API passing it however many 'dataset' files are currently pending. The
     * array of pending will be reset.
     */
    self.processPendingCommits = function() {
        if( _pendingCommits.length ) {
            if( _commitInProgress ) {
                return;
            }

            const commitInput = {
                commitInput: _pendingCommits
            };

            _pendingCommits = [];

            _commitInProgress = true;

            soaSvc.post( 'Core-2006-03-FileManagement', 'commitDatasetFiles', commitInput ).then(
                function( response ) {
                    _commitInProgress = false;
                    self.processPendingCommits();
                    return response;
                } );
        } else {
            /**
             * We have no commits pending so check if we have uploaded the last file in the set being managed by
             * this CommitManager.
             * <P>
             * If so: Resolve the 'deferred' for this CommitManager to inform any listener that we are all done.
             */
            if( self.pendingUploadCount <= 0 ) {
                self.resolveFinalState();
            }
        }
    };

    /**
     * Create a 'debounce' function to help balance the server load during upload.
     */
    self.todoCommits = _.debounce( self.processPendingCommits, 1000, {
        leading: false,
        trailing: true,
        maxWait: 10000
    } );

    return self;
};

/**
 * Find the existing datasets for given file names
 * @param {Object} queryForFileExistenceResponse Soa response for queryForFileExistence
 * @param {Object} targetObject Target Object
 * @param {StringArray} fileNames File Names to search
 * @param {Map} fileNameToSourceFileMap File Name to Source File Map
 * @returns {ObjectArray} fileNamesToCreate File Names which needs to be created
 */
function _duplicateFilesExist( queryForFileExistenceResponse, targetObject, fileNames, fileNameToSourceFileMap, sourceFiles, objectSetState ) {
    const deferred = AwPromiseService.instance.defer();

    if ( queryForFileExistenceResponse.size ) {
        const datasetsForFile = queryForFileExistenceResponse.get( targetObject.uid );
        const fileNamesToReplace = [];
        let fileNamesToCreate = [];
        const fileNameToDataset = new Map();
        for ( let i = 0; i < datasetsForFile.length; i++ ) {
            const dataset = datasetsForFile[i].dataset;
            const fileName = datasetsForFile[i].fileName;
            fileNameToDataset[fileName] = dataset;
            fileNamesToReplace.push( fileName );
        }
        if ( fileNamesToReplace.length > 0 ) {
            fileNamesToCreate = _.difference( fileNames, fileNamesToReplace );
            const localTextBundle = localeService.getLoadedText( 'ZeroCompileCommandMessages' );
            const replaceLabel = localTextBundle.replaceFileMsg.replace( '{0}', fileNamesToReplace );
            const buttonNotification = 'btn btn-notify';
            const buttons = [ {
                addClass: buttonNotification,
                text: localTextBundle.cancel,
                onClick: function( dialog ) {
                    dialog.close();
                    deferred.resolve( fileNamesToCreate );
                }
            },
            {
                addClass: buttonNotification,
                text: localTextBundle.create,
                onClick: function( dialog ) {
                    dialog.close();
                    _.forEach( fileNamesToReplace, function( fileName ) {
                        fileNamesToCreate.push( fileName );
                    } );
                    deferred.resolve( fileNamesToCreate );
                }
            },
            {
                addClass: buttonNotification,
                text: localTextBundle.replace,
                onClick: function( dialog ) {
                    dialog.close();
                    deferred.resolve( fileNamesToCreate );
                    const promiseReplace = replaceFileService.replaceDataset( targetObject, fileNameToDataset );
                    if ( promiseReplace ) {
                        promiseReplace.then( function( commitInfo ) {
                            _fmsUploadFilesForDataset( fileNameToSourceFileMap, fileNameToDataset, targetObject, commitInfo, sourceFiles, objectSetState );
                        } );
                    }
                }
            } ];
            messagingSvc.showWarning( replaceLabel, buttons );
        } else {
            //return all files to create
            fileNamesToCreate = fileNames;
            deferred.resolve( fileNamesToCreate );
        }
    } else {
        //return all files to create
        let fileNamesToCreate = fileNames;
        deferred.resolve( fileNamesToCreate );
    }
    return deferred.promise;
}

/**
 * Call fms upload for the given dataset with the new files
 * @param {Map} fileNameToSourceFileMap File Name to Source File Map
 * @param {Map} fileNameToDataset File Name to dataset map
 * @param {Object} targetObject Target Object
 * @param {Object} commitInfo Commit Info
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
function _fmsUploadFilesForDataset( fileNameToSourceFileMap, fileNameToDataset, targetObject, commitInfo, sourceFiles, objectSetState ) {
    const datasets = [];
    const commitManager = new CommitManager();
    for ( let value of Object.values( fileNameToDataset ) ) {
        datasets.push( value );
    }
    commitManager.pendingUploadCount += datasets.length;
    commitManager.totalUploadCount += commitManager.pendingUploadCount;

    const hasChunkedFile = sourceFiles.some( ( file ) => file.size > fileStreamingUtils.CHUNK_UPLOAD_THRESHOLD );

    hasChunkedFile && updateFileUploadPopupState( objectSetState, sourceFiles );

    for ( let i = 0; i < commitInfo.length; i++ ) {
        const fileInfo = {};
        const clientId = 'CreateDocument';

        const datasetFileInfo = commitInfo[i].datasetFileTicketInfos[0].datasetFileInfo;
        fileInfo.datasetFileName = datasetFileInfo.fileName;
        fileInfo.datasetType = commitInfo[i].dataset.type;
        fileInfo.isText = datasetFileInfo.isText;
        fileInfo.namedReferenceName = datasetFileInfo.namedReferencedName;
        fileInfo.dataset = commitInfo[i].dataset;
        fileInfo.jsFile = fileNameToSourceFileMap[datasetFileInfo.fileName];
        fileInfo.allowReplace = datasetFileInfo.allowReplace;

        const ticket = commitInfo[i].datasetFileTicketInfos['0'].ticket;

        const ticketInfo = {
            clientID: clientId,
            ticket: ticket
        };
        _sendHttpRequest( commitManager, targetObject, fileInfo, ticketInfo, objectSetState );
    }
    return commitManager.deferred.promise;
}

/**
  * Gets the XSRF-TOKEN from the document cookie
  *
  * @returns {string} the XSRF token
  */
function _getXSRFToken() {
    let token = '';
    if ( document !== null && document !== undefined && document.cookie.search( 'XSRF-TOKEN' ) > -1 ) {
        const splitAtr = document.cookie.split( 'XSRF-TOKEN=' );
        if ( splitAtr.length === 2 ) {
            // returns the first element
            token = splitAtr[1].split( ';' )[0];
        }
    }
    return token;
}

/**
 * Prepare Input For SOA for checking existing file
 * @param {ObjectArray} pasteFilesInput Paste Files Input
 * @returns {inputForSOA} Input For SOA
 */
function _prepareInputForFileExistenceSOA( pasteFilesInput ) {
    const inputForSOA = [];
    for ( let i = 0; i < pasteFilesInput.length; i++ ) {
        const curr = pasteFilesInput[i];
        const targetObject = curr.targetObject;
        const sourceFiles = curr.sourceObjects;

        const fileNames = [];
        for ( let j = 0; j < sourceFiles.length; j++ ) {
            fileNames.push( sourceFiles[j].name );
        }
        /*const inputObject = {
            uid: targetObject.uid,
            type: targetObject.type
        };*/
        const input = {
            clientID: targetObject.uid,
            fileNames: fileNames,
            parentObject: targetObject
        };
        inputForSOA.push( input );
    }

    return {
        input: inputForSOA
    };
}

/**
 * Send FMS post http request
 * @param {*} commitManager The class which allows multiple file uploads to complete
 * @param {*} targetObject Target Object
 * @param {*} fileInfo File Information
 * @param {*} ticketInfo Ticket Information
 */
async function _sendHttpRequest( commitManager, targetObject, fileInfo, ticketInfo, objectSetState ) {
    /**
     * Create an 'XMLHttpRequest' and setup a callback for when the upload is 'DONE" and we commit
     * the file to the 'dataset'.
    */

    const formData = new FormData();

    formData.append( 'fmsFile', fileInfo.jsFile, fileInfo.jsFile.name );
    formData.append( 'fmsTicket', ticketInfo.ticket );

    eventBus.publish( 'progress.start', {
        endPoint: _fmsUploadUrl
    } );

    const finalCommitManager = {
        commitManager,
        targetObject,
        fileInfo,
        ticketInfo
    };
    try {
        const uploadResponse = await fileStreamingUtils.uploadFile( formData, {}, objectSetState );
        commitManager.onreadystatechange( uploadResponse, finalCommitManager );
    } catch( e ) {
        commitManager.onreadystatechange( e, finalCommitManager );
        const fileUploadErrorI18n = await localeService.getLocalizedText( 'awAddDirectiveMessages', 'fileUploadError' );
        await fileUploadUtils.displayError( e, fileUploadErrorI18n, fileInfo.jsFile.name );
        throw new Error();
    }
}

// ############################################################
// Define the public functions exposed by this module.
// ############################################################

let exports = {};

/**
 * Checks to see if there is an alternate paste service defined in _pasteConfig and if so calls it accordingly
 *
 * @param {ObjectArray} pasteFilesInput - An array of objects that maps a unique 'relationType' to the array of
 *            'sourceObjects' (JS Files) that should be pasted onto the 'targetObject' with that 'relationType'.
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available. The resolved data is the result object from the final call to
 *          'Core-2006-03-DataManagement/createRelations'.
 */
export let pasteFilesWithHandler = function( pasteFilesInput, objectSetState ) {
    const targetTypeConfig = tcDefaultPasteHandler.bestTargetFit( pasteFilesInput[ 0 ].targetObject );

    if( targetTypeConfig ) {
        const sourceTypes = targetTypeConfig.sourceTypes;
        if( sourceTypes?.osFileHandles ) {
            const deferred = AwPromiseService.instance.defer();
            _.forEach( pasteFilesInput, function( input ) {
                const { sourceObjects } = input;
                _.forEach( sourceObjects, function( srcObj ) {
                    srcObj.modelType = {
                        typeHierarchyArray: [ 'osFileHandles' ]
                    };
                } );
            } );
            deferred.resolve( { pasteFilesInput, isOsFiles: true } );
            return deferred.promise;
        }
    }
    return exports.pasteFiles( pasteFilesInput, objectSetState );
};

/**
 * Creates new 'source' 'Dataset' type objects, uploads the given JS Files to FMS and attaches them to the 'sources'
 * and then pastes the 'sources' onto the given 'target' IModelObject.
 *
 * @param {ObjectArray} pasteFilesInput - An array of objects that maps a unique 'relationType' to the array of
 *            'sourceObjects' (JS Files) that should be pasted onto the 'targetObject' with that 'relationType'.
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available. The resolved data is the result object from the final call to
 *          'Core-2006-03-DataManagement/createRelations'.
 */
export const pasteFiles = function( pasteFilesInput, objectSetState ) {
    /**
     * Create the object used to manage all info for the duration of this set of files.
     */
    const commitManager = new CommitManager();

    /**
     * 1. Check to see if there is an existing dataset that has a matching file for each input file.
     */
    const queryForFileExistenceResponse = new Map();
    const inputForSoa = _prepareInputForFileExistenceSOA( pasteFilesInput );
    let namespace = 'Internal-Core-2021-12-DataManagement';

    soaSvc.postUnchecked( namespace, 'queryForFileExistence', inputForSoa ).then( function( response ) {
        const datasetsForFileOutput = response.output;
        _.forEach( datasetsForFileOutput, function( dp ) {
            queryForFileExistenceResponse.set( dp.clientID, dp.datasetsForFile );
        } );

        _.forEach( pasteFilesInput, function( curr ) {
            const targetObject = curr.targetObject;
            const relationType = curr.relationType;
            const sourceFiles = curr.sourceObjects;
            const objectSetSources = _extractObjectSetSource( curr.props );

            const filenames = [];
            const fileNameToSourceFileMap = new Map();

            for( let j = 0; j < sourceFiles.length; j++ ) {
                filenames.push( sourceFiles[ j ].name );
                fileNameToSourceFileMap[sourceFiles[j].name] = sourceFiles[j];
            }

            const targetTypeConfig = tcDefaultPasteHandler.bestTargetFit( targetObject );

            let datasetInfos = null;

            if( targetTypeConfig?.sourceTypes?.Dataset ) {
                datasetInfos = targetTypeConfig.sourceTypes.Dataset.datasetInfos;
            }

            /**
             * 2. If the file exists, give the user a choice to replace the file in the existing dataset.
             */
            const promiseReplace = _duplicateFilesExist( queryForFileExistenceResponse, targetObject, filenames, fileNameToSourceFileMap, sourceFiles, objectSetState );
            if ( promiseReplace ) {
                promiseReplace.then( function( fileNamesToCreate ) {
                    if ( fileNamesToCreate.length > 0 ) {
                        // These are the list of new files/datasets to create. Files the user has chosen to replace
                        //  will go to replaceFileService.replaceDataset().
                        const fileInfos = [];

                        /**
                         * 3. Get the types of datasets to create.
                         */
                        return _getDatasetTypes( targetObject, fileNamesToCreate ).then( function( getDatasetTypesResponse ) {
                            const sourceFilesToCreate = [];
                            _.forEach( fileNamesToCreate, function( fileName ) {
                                sourceFilesToCreate.push( fileNameToSourceFileMap[fileName] );
                            } );

                            /**
                             * 4. Create the datasets and the relation to the target.
                             */
                            return _createDatasetsAndRelate( targetObject, getDatasetTypesResponse, datasetInfos, sourceFilesToCreate,
                                fileNamesToCreate, relationType, fileInfos, objectSetSources );
                        } ).then( function( createDatasetsAndRelateResponse ) {
                            let errors = [];
                            let validFileInfos = fileInfos;

                            if( createDatasetsAndRelateResponse.ServiceData ) {
                                errors = _getErrorValues( createDatasetsAndRelateResponse.ServiceData.partialErrors );
                            }

                            if( errors.length > 0 ) {
                                // Check for constrained relationship error when pasting, if the only error
                                if( errors.length === 1 && errors[ 0 ].code === ERROR_CODE_CONSTRAINED_RELATION ) {
                                    messagingSvc.showError( errors[ 0 ].message );

                                    validFileInfos = _parseValidFiles( createDatasetsAndRelateResponse.output, fileInfos );
                                } else {
                                    resetFileUploadPopupState( objectSetState );
                                    throw soaSvc.createError( createDatasetsAndRelateResponse.ServiceData );
                                }
                            }

                            /**
                             * 5. Now that the 'datasets' are created and related to the 'target', announce to the rest of AW that it's
                             * related data has changed.
                             */
                            const updatedObjects = [ targetObject ];

                            eventBus.publish( 'cdm.relatedModified', {
                                relatedModified: updatedObjects
                            } );

                            /**
                             * 6. Get the FMS tickets we need to commit the files we are about to upload.
                             */
                            return _getWriteTickets( createDatasetsAndRelateResponse, validFileInfos );
                        }, function( error ) {
                            if( error.message ) {
                                messagingSvc.showError( error.message );
                            } else if( error ) {
                                messagingSvc.showError( JSON.stringify( error ) );
                            }

                            resetFileUploadPopupState( objectSetState );
                        } ).then( function( getWriteTicketsResponse ) {
                            const httpCalls = [];
                            if ( getWriteTicketsResponse && getWriteTicketsResponse.length > 0 ) {
                                const hasChunkedFile = getWriteTicketsResponse.some( ( soaResponse ) => soaResponse.commitInfo );
                                hasChunkedFile && updateFileUploadPopupState( objectSetState, sourceFiles );
                                /**
                                 * Set the total # of file we are going to handle
                                 * <P>
                                 * Create the LoDash 'debounce' we will use to control how often we use the 'commit' SOA operation.
                                 * <P>
                                 * Note: 'maxWait' is only relevant if 'lots' of files are uploading quickly yet we still want to
                                 * 'commit' regularly (i.e. after 'maxWait' time).
                                 */
                                for( const soaResponse of getWriteTicketsResponse ) {
                                    if( soaResponse.commitInfo ) {
                                        // chunked
                                        commitManager.pendingUploadCount += Object.keys( soaResponse.commitInfo ).length;
                                        commitManager.totalUploadCount += commitManager.pendingUploadCount;
                                        for( const commitInfo of soaResponse.commitInfo ) {
                                            for( const ticketInfo of commitInfo.datasetFileTicketInfos ) {
                                                // Save the 'source' 'dataset' this File is associated with.
                                                const fileInfo = fileInfos[ ticketInfo.datasetFileInfo.clientId ];
                                                // 7. Upload each input file.
                                                httpCalls.push( _sendHttpRequest( commitManager, targetObject, fileInfo, ticketInfo, objectSetState ) );
                                            }
                                        }
                                    } else if( soaResponse.tickets ) {
                                        // non chunked
                                        commitManager.pendingUploadCount += Object.keys( soaResponse.tickets ).length;
                                        commitManager.totalUploadCount += commitManager.pendingUploadCount;
                                        if( soaResponse.tickets ) {
                                            Object.keys( soaResponse.tickets ).forEach( ( key ) => {
                                                for( const ticketInfo of soaResponse.tickets[ key ] ) {
                                                    //Save the 'source' 'dataset' this File is associated with.
                                                    const fileInfo = fileInfos[ ticketInfo.clientFileId ];
                                                    // 7. Upload each input file.
                                                    httpCalls.push( _sendHttpRequest( commitManager, targetObject, fileInfo, ticketInfo, objectSetState ) );
                                                }
                                            } );
                                        }
                                    }
                                }
                            } else {
                                commitManager.deferred.reject();
                            }
                            return Promise.all( httpCalls ).then( () => {
                                resetFileUploadPopupState( objectSetState );
                            } )
                                .catch( error => {
                                    const removeInput = {
                                        parentObj: targetObject,
                                        childrenObj: [ fileInfos[ 0 ].dataset ]
                                    };
                                    soaSvc.post( 'Core-2014-10-DataManagement', 'removeChildren', {
                                        inputData: [ removeInput ]
                                    } ).then( function() {
                                        soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: [ fileInfos[ 0 ].dataset ] } );
                                    } );

                                    if( error.message ) {
                                        messagingSvc.showError( error.message );
                                    }

                                    resetFileUploadPopupState( objectSetState );

                                    /**
                                     * Now that the 'datasets' are removed and detached from the 'target', announce to the rest of AW that
                                     * it's related data has changed.
                                     */
                                    eventBus.publish( 'cdm.relatedModified', {
                                        relatedModified: [ targetObject ]
                                    } );

                                    commitManager.deferred.reject( error );
                                } );
                        }, function( error ) {
                            // The write ticket could not be received. Most likely the FSC service or cache FSC service is down. We
                            // need to remove the relation and delete the dataset. Ideally this should all be done as part of single
                            // SOA. It needs to be redesigned to reduce chattiness
                            const removeInput = {
                                parentObj: targetObject,
                                childrenObj: [ fileInfos[ 0 ].dataset ]
                            };
                            soaSvc.post( 'Core-2014-10-DataManagement', 'removeChildren', {
                                inputData: [ removeInput ]
                            } ).then( function() {
                                soaSvc.post( 'Core-2006-03-DataManagement', 'deleteObjects', { objects: [ fileInfos[ 0 ].dataset ] } );
                            } );

                            if( error.message ) {
                                messagingSvc.showError( error.message );
                            }

                            resetFileUploadPopupState( objectSetState );

                            /**
                             * Now that the 'datasets' are removed and detached from the 'target', announce to the rest of AW that
                             * it's related data has changed.
                             */
                            eventBus.publish( 'cdm.relatedModified', {
                                relatedModified: [ targetObject ]
                            } );

                            commitManager.deferred.reject( error );
                        } );
                    }
                } );
            }
        } );
    } );

    /**
     * Return the primary deferred promise
     */
    return commitManager.deferred.promise;
};


const resetFileUploadPopupState = ( objectSetState ) => {
    if( objectSetState ) {
        let newObjectSetState = { ...objectSetState.getValue() };
        newObjectSetState.showUploadPopup = false;
        delete newObjectSetState.files;
        objectSetState.update( newObjectSetState );
    }
};

const updateFileUploadPopupState = ( objectSetState, filesToUpload ) => {
    if( objectSetState ) {
        let newObjectSetState = { ...objectSetState.getValue() };
        newObjectSetState.showUploadPopup = true;
        if( !newObjectSetState.files ) {
            newObjectSetState.files =  [ ...filesToUpload.map( ( file ) =>  { return { fileName: file.name, size: file.size }; } ) ];
        }
        objectSetState.update( newObjectSetState );
    }
};

_fmsUploadUrl = browserUtils.getBaseURL() + 'fms/fmsupload/';

export default exports = {
    loadConfiguration,
    pasteFilesWithHandler,
    pasteFiles
};

loadConfiguration();
