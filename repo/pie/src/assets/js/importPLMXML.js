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
 * @module js/importPLMXML
 */
import _ from 'lodash';
import _appCtxSvc from 'js/appCtxService';
import _localeSvc from 'js/localeService';
import appCtxService from 'js/appCtxService';
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import msgSvc from 'js/messagingService';

'use strict';
var exports = {};

export let getSOAInputForPLMXMLImport = function( data ) {
    return {
        zipFileTicket: data.fmsTicket,
        transferMode: { uid: data.transferModeListBox.dbValue.uid, type: 'unknownType' },
        sessionOptions: data.sessionOptionsForImport
    };
};

/**
 * collectSessionOption
 */
function collectSessionOption( ctx ) {
    var sessionOptionNamesValues = [];

    var pdiIOR = { optionName: 'pdiIOR', optionValue: '' };
    sessionOptionNamesValues.push( pdiIOR );

    var soaIOR = { optionName: 'soaIOR', optionValue: '' };
    sessionOptionNamesValues.push( soaIOR );

    var selectedFolderUId = '';
    if ( ctx.mselected && ctx.mselected.length > 0 && ctx.mselected[0].modelType && ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        selectedFolderUId = ctx.mselected[0].uid;
    } else if ( ctx.locationContext && ctx.locationContext.modelObject && ctx.locationContext.modelObject.modelType && ctx.locationContext.modelObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        selectedFolderUId = ctx.locationContext.modelObject.uid;
    }

    if ( selectedFolderUId.length > 0 ) {
        var folderUID = { optionName: 'folderuid', optionValue: selectedFolderUId };
        sessionOptionNamesValues.push( folderUID );
    }

    return sessionOptionNamesValues;
}

export let clearTransferModes = function( ) {
    return{
        emptyString: '',
        emptyArray: []
    };
};

export let getUploadFileMicroServiceURL = function() {
    return browserUtils.getBaseURL() + 'sd/xccshare/uploadFileToFMS';
};

/**
 *
 * @param {Object} fileSelData - VMO
 * @returns {Object} - Import REST API Body
 */
export let getCreateRequestJSONForImport = function( fileSelData ) {
    var selectedFile = fileSelData.selectedFile;
    var projectId = selectedFile.projectId;
    var projectName = selectedFile.projectName;

    var urn = selectedFile.urn;
    var fileName = selectedFile.Title; //user selected file from Xcc


    var userSession = appCtxService.getCtx( 'userSession' );
    var userId = userSession.props.user_id.dbValue;
    var groupId = userSession.props.group_name.dbValue;

    /* beautify preserve:start */

    return '{' +
        '"zeusFileInfo": {' +
        '"project": "' + projectId + '",' +
        '"projectName": "' + projectName + '",' +
        '"name": "' + fileName + '",' +
        '"urn": "' + urn + '",' +
        '"length": -1' +
        '},' +
        '"fileName": "' + fileName + '",' +
        '"userId":"' + userId + '",' +
        '"groupId": "' + groupId + '"' +
        '}';
    /* beautify preserve:end */
};

export let xcUploadFileToFMS = function( addReqInp ) {
    var $http = AwHttpService.instance;
    var deferred = AwPromiseService.instance.defer();

    var postPromise = $http.post( getUploadFileMicroServiceURL(), addReqInp, {
        headers: {
            'Content-Type': 'application/json'
        }
    } );

    if( postPromise ) {
        postPromise.then( function( response ) {
            handleSuccessResponse( response );
            var respData = response.data;
            var ticket = respData.ticket;
            appCtxService.registerCtx( 'importFmsTicket', ticket );
            deferred.resolve( {
                fmsTicket: ticket
            } );
        }, function( err ) {
            handleFailedResponse( err );
            deferred.reject( 'Internal error occurred during operation. Contact your administrator' );
        } );
    }
    return deferred.promise;
};

/**
 * handle the failed error message thrown by micro services
 * @param {Object} err -VMO
 */
export let handleFailedResponse = function( err ) {
    var errResponse = err.response;

    if ( errResponse && errResponse.data ) {
        if ( errResponse.data.message ) {
            msgSvc.showError( errResponse.data.message );
        } else if ( errResponse.data.partialErrors && errResponse.data.partialErrors.length > 0
            && errResponse.data.partialErrors[0].errorValues && errResponse.data.partialErrors[0].errorValues.length > 0 ) {
            msgSvc.showError( errResponse.data.partialErrors[0].errorValues[0].message );
        } else if ( errResponse.data instanceof String ) {
            msgSvc.showError( errResponse.data );
        } else {
            msgSvc.showError( 'Internal error occurred during operation. Contact your administrator' );
        }
    } else {
        msgSvc.showError( 'Internal error occurred during operation. Contact your administrator' );
    }
};

/**
 * handle the sucess/failed message thrown by micro services
 * @param {Object} response -VMO
 */
export let handleSuccessResponse = function( response ) {
    var respData = response.data;
    if ( respData.message && respData.message.isError ) {
        var msg = respData.message.reason;
        if ( respData.message.isError === 'true' ) {
            msgSvc.showError( msg );
        } else {
            msgSvc.showInfo( msg );
        }
    }
};

export let showInvalidFileErrorMsg = function( fileExt ) {
    var resource = 'pieMessages';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    let failureMsg = '';

    if( fileExt !== 'zip' ) {
        failureMsg = localTextBundle.invalidFile;
        msgSvc.showError( failureMsg );
    }
};

/**
 * Handles error from SOA
 *
 * @param {object} data the view model data object
 */
export let processPLMXMLImportPartialErrors = function( serviceData, fileName ) {
    var resource = 'pieMessages';
    var errMessage = '';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    if ( serviceData.partialErrors ) {
        var messages = '';

        errMessage = localTextBundle.plmxmlImportFailedMessage.replace( '{0}', fileName );

        for ( var index in serviceData.partialErrors ) {
            var partialError = serviceData.partialErrors[index];

            for ( var count in partialError.errorValues ) {
                var errorValue = partialError.errorValues[count];
                if ( errorValue.message.length > 0 ) {
                    messages += '<br>' + errorValue.message;
                }
            }
        }
        errMessage += messages;
        msgSvc.showError( errMessage );
    } else{
        messages = localTextBundle.plxmlImportStartedMessage.replace( '{0}', fileName );
        msgSvc.showInfo( messages );
    }
    eventBus.publish( 'importPLMXML.closeDialog' );
};

/**
 * Perform FMS file upload
 *
 * @param {object} formData the FMS file upload data which contains fms ticket.
 * @param {string} fileName the file name.
 */
export let uploadPLMXMLFile = function (formData, fileName) {
    var deferred = AwPromiseService.instance.defer();

    const $http = AwHttpService.instance;
    let fmsURL = fmsUtils.getFMSFullUploadUrl();
    var postPromise = $http.post(fmsURL, formData, {
        headers: {
            'Content-Type': undefined
        }
    });

    if (postPromise) {
        postPromise.then(function (response) {
            deferred.resolve(response);
        }, function (err) {
            var resource = 'pieMessages';
            var localTextBundle = _localeSvc.getLoadedText(resource);
            var errMessage = localTextBundle.plmxmlImportFailedMessage.replace('{0}', fileName);
            if (err.response && err.response.data) {
                errMessage = errMessage.replace('{1}', err.response.data);
            }
            else if (err.message) {
                errMessage = errMessage.replace('{1}', err.message);
            }
            msgSvc.showError(errMessage);
            eventBus.publish( 'importPLMXML.closeDialog' );
            deferred.reject();
        });
    }
    return deferred.promise;
};

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which
 * service should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'importPLMXML';
export default exports = {
    getSOAInputForPLMXMLImport,
    collectSessionOption,
    clearTransferModes,
    handleFailedResponse,
    handleSuccessResponse,
    getCreateRequestJSONForImport,
    xcUploadFileToFMS,
    showInvalidFileErrorMsg,
    processPLMXMLImportPartialErrors,
    uploadPLMXMLFile
};
