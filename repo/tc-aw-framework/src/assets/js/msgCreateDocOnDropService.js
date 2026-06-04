// Copyright (c) 2024 Siemens

/**
 * This service is used to manage the creation of a Email and attached files when user drags and drops filed from the
 * desktop or Outlook to the AW.
 *
 * @module js/msgCreateDocOnDropService
 */
import app from 'app';
import AwPromiseService from 'js/awPromiseService';
import commandService from 'js/command.service';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import * as MsgReader from 'wl-msg-reader/lib/msg.reader';


/**
 * ############################################################<BR>
 * Define the public functions exposed by this module.<BR>
 * ############################################################<BR>
 */
var exports = {};

/**
 * Checks to see if the create new Document object preference is set to true. If true calls the function to create a
 * document. If false calls the default pasteFiles function.
 *
 * @param {Object} targetObject - The 'target' Object for the paste.
 * @param {Array} sourceObjects - Array of 'source' Objects to paste onto the 'target' Object.
 * @param {String} relationType - Relation type name
 * @param {Object} runActionWithViewModel - run action with viewModel
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available. The resolved data is the result object from the final call to
 *          'Core-2016-09-DataManagement/createAttachAndSubmitObjects'.
 */
export let createEmailAttachFiles = function (targetObject, sourceObjects, relationType, runActionWithViewModel) {
    var pasteFilesInput = [{
        targetObject,
        sourceObjects,
        relationType,
        runActionWithViewModel
    }];

    //return preferenceService.getStringValue('Dma1CreateDocOnDrop').then(function (prefSvcResult) {
    var deferred = AwPromiseService.instance.defer();
    var deferred2 = AwPromiseService.instance.defer();

    var backupCmdArg = appCtxService.getCtx('state.params.cmdArg');//ctx.state.params.cmdArg;

    var filename = pasteFilesInput[0].sourceObjects[0].name;
    filename = filename.replace(/\.[^/.]+$/, '');

    var emailPromise = exports.getEmailFile(deferred, pasteFilesInput[0].sourceObjects[0]);
    if (emailPromise) {
        emailPromise.then(function ([email, attachments]) {
           /*  var body = new File([email.body], email.subject + ' - Message.html', { lastModified: new Date().getTime(), type: '' });
            pasteFilesInput[0].sourceObjects.push(body); */

            // attachments
            if (attachments) {
                for (let i = 0; i < attachments.length; i++) {
                    // The [] is needed because the first param is "An Array of ArrayBuffer, ArrayBufferView, Blob, USVString objects"
                    var att = new File([attachments[i].content], attachments[i].fileName, { lastModified: new Date().getTime(), type: attachments[i].mimeType });
                    pasteFilesInput[0].sourceObjects.push(att);

                }
            }

            var headers = exports.parseHeaders(email);
            let autoPopulateProperties = exports.buildAutoProperties(headers, email);

            appCtxService.registerCtx('createDocument', { pasteFilesInput: pasteFilesInput });
            appCtxService.updatePartialCtx('state.params.cmdArg', ['Email']);

            const context = {
                fileName: filename,
                files: pasteFilesInput,
                targetObject: pasteFilesInput[0].targetObject,
                autoAssignProps: autoPopulateProperties
            };
            var promise = commandService.executeCommand('Awp0ShowCreateObject', null, null, context, runActionWithViewModel);

            if (promise) {
                promise.then(function () {
                    // Cleanup
                    appCtxService.updatePartialCtx('state.params.cmdArg', backupCmdArg);
                });
            }

        }); //emailPromise.then

    } //if( emailPromise )

    return deferred2.promise;
};

export let buildAutoProperties = function (headers, email) {
    let autoPopulateProperties = [];
    // in Chrome and Edge browsers, there is no need to set the object_name, it will be set by the Add panel using the dropped file name
    // but in Firefox, PV found that the name increase by 1 every time he drops it even without creating the object. It is a FireFox browser way of storing temp files
    // so to ensure the right file name is used, we always override the name with the email subject
   let subject = {
        propertyName: 'object_name',
        dbValue: email.subject
    };
    autoPopulateProperties.push(subject);
    // trim string by "\r\n" first part is the date string
    //var dateString = headers['Date']
    let date = {
        propertyName: 'REF(revision,EmailRevisionCreI).DocumentDateReceived',
        dbValue: headers['Date']
    };
    autoPopulateProperties.push(date);

    let from = {
        propertyName: 'REF(revision,EmailRevisionCreI).fnd0DocumentFrom',
        dbValue: exports.formatEmailAddress({ name: email.senderName, email: email.senderEmail })
    };
    autoPopulateProperties.push(from);

    let to = {
        propertyName: 'REF(revision,EmailRevisionCreI).DocumentTo',
        dbValue: headers['To']
    };
    autoPopulateProperties.push(to);

    let cc = {
        propertyName: 'REF(revision,EmailRevisionCreI).DocumentCC',
        dbValue: headers['CC']
    };
    autoPopulateProperties.push(cc);
    return autoPopulateProperties;
};

/**
 * Get the email file out of the sourceFile (File input) and use A 3rd party library to convert it to email message
 * @param {deferred} deferred the deferred object
 * @param {File} sourceFile the dropped file object
 * @returns {Promise} the promise with either resolved or reject object
 */
export let getEmailFile = function(deferred, sourceFile) {
    var reader = new FileReader();
    reader.readAsArrayBuffer(sourceFile);
    reader.onload = function (evt) {
        var array = new Uint8Array(evt.target.result);
        var reader = new MsgReader(array);
        var email = reader.getFileData();
        var attachments = [];
        if (email.attachments) {
            for (let i = 0; i < email.attachments.length; i++) {
                // When the attachment is an attached email, there is no file associated with it and there is innerMsgContent set to true. We skip this attachment
                // When the attachment is an embedded image/content, the pidContentId is set. Skip this attachment.
                if( !email.attachments[i].innerMsgContent && !email.attachments[i].pidContentId){
                    var file = reader.getAttachment(i);
                    attachments.push(file);
                }               
            }
        }
        deferred.resolve([email, attachments]);
    };
    reader.onerror = (error) => deferred.reject(error);
    return deferred.promise;
};

export let formatEmailAddress = function(data) {
    
    if( data.name && data.email ){
        return data.name + ' <' + data.email + '>';
    }
    else if( data.name && !data.email ){
        return data.name;
    }
    else if(!data.name && data.email ){
        return data.email;
    }
};

export let parseHeaders = function(email) {
    var parsedHeaders = {};
    var headers = email.headers;
    if (!headers) {
        return parsedHeadersForSentEmails(email);
    }
    var headerRegEx = /(.*)\: (.*)/g;
    var previousMatch;
    var match;
    var valueStartIndex;

    // eslint-disable-next-line no-cond-assign
    while (match = headerRegEx.exec(headers)) {
        if (previousMatch) {
            parsedHeaders[previousMatch[1]] = headers.substring(valueStartIndex, match.index);
        }
        valueStartIndex = match.index + match[1].length + 2; // the 2 is for ": "
        previousMatch = match;
    }
    // set the last match
    parsedHeaders[previousMatch[1]] = headers.substring(valueStartIndex);
    // fix the date value, removing the trailing Message-Id
    // e.g., the string contains message-ID:
    // Thu, 19 Dec 2024 14:42:11 +0000\r\nMessage-ID:\r\n<MN6PR07MB98501A9422BAC3435BE96FFDF7062@MN6PR07MB9850.namprd07.prod.outlook.com>\r\n
    // e.g., the string doesn't contrain message-ID:
    // Thu, 19 Dec 2024 16:00:30 +0100\r\n
    if (parsedHeaders['Date'] && parsedHeaders['Date'].indexOf('\r\n') !== -1){
        parsedHeaders['Date'] = parsedHeaders['Date'].substring(0, parsedHeaders['Date'].indexOf('\r\n'));
    }

    parsedHeaders['To'] = exports.formatNameAndEmails(parsedHeaders['To']);
    parsedHeaders['CC'] = exports.formatNameAndEmails(parsedHeaders['CC']);

    return parsedHeaders;
};

/**
 *  clean up the formatting for the To and CC field, to remove the original \r\n\t and \r\n, and add \r\n after each '>,'
 * so user name and the same user email will be on the same line
 * @param {*} original 
 * @returns 
 */
export let formatNameAndEmails = function(original){
    if( original && original.indexOf('\r\n\t') !== -1){
        original = original.replaceAll('\r\n\t', ' ');
    }
    if( original && original.indexOf('\r\n') !== -1){
        original = original.replaceAll('\r\n', '');
    }
    if( original && original.indexOf('>, ') !== -1){
        original = original.replaceAll('>, ', '>,\r\n');
    }
    return original;
};

export let parsedHeadersForSentEmails = function(email) {
    var parsedHeaders = {};
    parsedHeaders['To'] = '';
    parsedHeaders['CC'] = '';

    for (let i = 0; i < email.recipients.length; i++) {
        parsedHeaders['To'] = parsedHeaders['To'] + '"' + email.recipients[i].name + '" <' + email.recipients[i].email + '>\r\n';
    }
    return parsedHeaders;
};

export default exports = {
    createEmailAttachFiles,
    buildAutoProperties,
    getEmailFile,
    parseHeaders,
    parsedHeadersForSentEmails,
    formatEmailAddress,
    formatNameAndEmails
};
/**
 * Service to Create a Document with attached datasets.
 *
 * @memberof NgServices
 * @member msgCreateDocOnDropService
 */
app.factory('msgCreateDocOnDropService', () => exports);
