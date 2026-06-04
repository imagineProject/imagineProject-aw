// Copyright (c) 2023 Siemens

/* global CKEDITOR */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0CreateCollabObjectService
 */
import { getBaseUrlPath } from 'app';
import ac0CkeditorService from 'js/Ac0CkeditorService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import messageSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import Ac0CkeditorConfigProvider from 'js/Ac0CkeditorConfigProvider';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import $ from 'jquery';
import vmoSvc from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import ac0ConvSvc from 'js/Ac0ConversationService';
import listBoxService from 'js/listBoxService';
import ehFactory from 'js/editHandlerFactory';
import dataSourceService from 'js/dataSourceService';
import ehSvc from 'js/editHandlerService';
import graphQLSvc from 'js/graphQLService';
import soaSvc from 'soa/kernel/soaService';
import declUtils from 'js/declUtils';
import dateTimeSvc from 'js/dateTimeService';
import msgSvc from 'js/messagingService';
import convUtils from 'js/Ac0ConversationUtils';
import AwHttpService from 'js/awHttpService';
import constSvc from 'js/awConstantsService';
import ac0DissTileSvc from 'js/Ac0DiscussionTileService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import sanitizer from 'js/sanitizer';
import AwStateService from 'js/awStateService';
import dialogService from 'js/dialogService';
import dmSvc from 'soa/dataManagementService';
import adapterService from 'js/adapterService';

var exports = {};
var _isTextValid = false;
//var eventInsertImageInCKEditor = null;
var insertImageCKEEvents = [];
var defaultStatusInternalNameDispNameMap = new Map();
var defaultPriorityInternalNameDispNameMap = new Map();

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

var _getFileURL = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Populate the object from the provided soa return
 * @param {*} soaMap map defined for soa
 * @returns {Object} jsObject
 */
var constructSrcObjUsrJSObj = function( soaMap ) {
    var jsObjFromSoaMap = {};
    if( !soaMap || soaMap[ 0 ].length <= 0 || soaMap[ 1 ].length <= 0 || soaMap[ 0 ].length !== soaMap[ 1 ].length ) {
        return jsObjFromSoaMap;
    }
    for( var ii = 0; ii < soaMap[ 0 ].length; ii++ ) {
        jsObjFromSoaMap[ soaMap[ 0 ][ ii ].uid ] = soaMap[ 1 ][ ii ];
    }
    return jsObjFromSoaMap;
};

export let showRichTextEditor = function( data, ckEditorDomId, insertImgEvtStr, ckeText, discItemCkEditorIdRef ) {
    var deferred = AwPromiseService.instance.defer();
    var deferredSoa = AwPromiseService.instance.defer();
    var deferredFms = AwPromiseService.instance.defer();
    var config = new Ac0CkeditorConfigProvider();

    ac0CkeditorService.create( ckEditorDomId, config, insertImgEvtStr, discItemCkEditorIdRef ).then( cke => {
        //ckeditor = cke;
        cke._instance.eventBus = eventBus;
        cke._instance.getBaseURL = browserUtils.getBaseURL();
        cke._instance.getBaseUrlPath = getBaseUrlPath();

        $( '.ck-body-wrapper' ).addClass( 'aw-layout-popup' );

        checkCKEInputTextValidityAndPublishEvent( cke, ckEditorDomId );

        cke.on( 'change', function() {
            checkCKEInputTextValidityAndPublishEvent( cke, ckEditorDomId );
        } );
        cke.on( 'notificationShow', function( evt ) {
            notyService.showInfo( evt.data.notification.message );
            evt.cancel();
        } );
        // Insert Image Event

        data.ckeInstance = cke._instance;

        var eventInsertImageInCKEditor = eventBus.subscribe( insertImgEvtStr,
            function( eventData ) {
                var fileName = 'fakepath\\' + eventData.file.name;

                data.form = eventData.form;

                var datasetInfo = {
                    clientId: eventData.clientid,
                    namedReferenceName: 'Image',
                    fileName: fileName,
                    name: eventData.clientid,
                    type: 'Image'
                };

                data.datasetInfo = datasetInfo;
                var fileMgmtInput = {};
                fileMgmtInput.transientFileInfos = [ {
                    fileName: datasetInfo.fileName,
                    isBinary: true,
                    deleteFlag: false
                } ];

                //eventBus.publish( 'ac0CreateDiss.InsertObjInCKEditor' );
                soaSvc.postUnchecked( 'Core-2007-01-FileManagement', 'getTransientFileTicketsForUpload', fileMgmtInput ).then(
                    function( responseData ) {
                        var fmsTicket = responseData.transientFileTicketInfos[ 0 ].ticket;
                        data.fmsTicket = fmsTicket;
                        updateFormData( {
                            key: 'fmsTicket',
                            value: fmsTicket
                        }, data );
                        var fmsinputData = {
                            request: {
                                method: 'POST',
                                url: constSvc.getConstant( 'fmsUrl' ),
                                headers: {
                                    'Content-type': undefined
                                },
                                data: data.formData
                            }
                        };
                        AwHttpService.instance( fmsinputData.request ).then( function( response ) {
                            insertImage( data );
                        }, function( err ) {
                            deferredFms.reject( err );
                        } );
                        deferredSoa.resolve( responseData );
                    },
                    function( reason ) {
                        deferredSoa.reject( reason );
                    } );
            } );
        insertImageCKEEvents.push( eventInsertImageInCKEditor );
        var ac0ConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
        if( ac0ConvCtx.createCollabObjData ) {
            ac0ConvCtx.createCollabObjData.ckeInstance = cke;
        }
        appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
        if( data.previousView && data.previousView === 'ProductSnapshotEditSub' ) {
            ckeText = ac0ConvCtx.ckEditorRename;
            const sharedDataValue = { ...data.value };
            delete sharedDataValue.previousView;
            delete ac0ConvCtx.ckEditorRename;
            data.update && data.update( sharedDataValue );
        }
        setCkEditorData( ckeText, cke );
        const newCkeInstance = _.clone( data.ckeInstance );
        newCkeInstance.cke = cke;
        deferred.resolve( newCkeInstance );
    } );
    return deferred.promise;
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertImage = function( data ) {
    var ckeInstance = data.ckeInstance;
    if( data.fmsTicket ) {
        var imageURL = _getFileURL( data.fmsTicket );
        const content = '<img src="' + imageURL + '"/>';
        if( ckeInstance.data ) {
            const viewFragment = ckeInstance.data.processor.toView( content );
            const modelFragment = ckeInstance.data.toModel( viewFragment );
            ckeInstance.model.insertContent( modelFragment );
        } else {
            var imgHtml = CKEDITOR.dom.element.createFromHtml( content );
            ckeInstance.insertElement( imgHtml );
        }
    }
};

/**
 * update data for fileData
 *
 * @param {Object} fileData - key string value the location of the file
 * @param {Object} data - the view model data object
 */
export let updateFormData = function( fileData, data ) {
    if( fileData && fileData.value ) {
        var form = data.form;
        data.formData = new FormData( $( form )[ 0 ] );
        data.formData.append( fileData.key, fileData.value );
    }
};

/**
 * Returns rich text
 * @param {Object} ckeInstance ckeInstance
 * @return {String} richtext richText
 */
export let getRichText = function( ckeInstance ) {
    var _richTextCK = ckeInstance.getData();
    var sanitizedRichTxt = sanitizer.sanitizeHtmlValue( _richTextCK );
    var _richText = sanitizedRichTxt;
    if( _richText.includes( '<img' ) ) {
        if( !_richText.includes( 'style=\"width:100%\"' ) ) {
            if( browserUtils.isIE ) {
                _richText = _richText.replace( /<(\s*)img(.*?)\s*\/>/g, '<$1img$2 class=\"w-12\"/>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\/\s*>/g, '<$1img$2></img>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\s*>/g, '<$1img$2></img>' );
            } else {
                _richText = _richText.replace( /<(\s*)img(.*?)\s*>/g, '<$1img$2 class=\"w-12\"/>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\/\s*>/g, '<$1img$2></img>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\s*>/g, '<$1img$2></img>' );
            }
        }
    }

    if( _richText.includes( '<br>' ) ) {
        _richText = _richText.replace( /<br>/g, '<br/>' );
    }

    return _richText;
};

/**
 * Returns plain text
 * @param {Object} ckeInstance ckeInstance
 * @return {Object} text string
 */
export let getPlainText = function( ckeInstance ) {
    return ckeInstance.getText();
};

export let setIsTextValid = function( valid ) {
    _isTextValid = valid;
    eventBus.publish( 'isInputTextValidEvent', null );
};

/**
 * Sets variable with whether text was entered. Called by action and value is used by condition to set visibility of
 * post button.
 * @param {String} data vmdata
 * @param {Boolean} isInputTextValidVal is input text valid
 */
export let isInputTextValid = function( data, isInputTextValidVal, ckEditorType, sharedData, discussionItem, ckEditorRef ) {
    var convCtx = convUtils.getAc0ConvCtx();
    if( ckEditorType === 'replyEditor' ||  convCtx.cmtEdit && convCtx.cmtEdit.activeCommentToEdit &&
        convCtx.cmtEdit.activeCommentToEdit.beingEdited === false ) {
        if( discussionItem && discussionItem.ckEditorIdRef === ckEditorRef ) {
            if( convCtx.cmtReply.activeReplyBox && convCtx.cmtReply.activeReplyBox.replying ) {
                convCtx.cmtReply.activeReplyBox.replying = false; //set existing activeComment beingEdited to false
            }
            convCtx.cmtReply.activeReplyBox = discussionItem;
            convCtx.cmtReply.activeReplyBox.replying = true;
            convCtx.ckEditorRef = 'replyEditor';
            if( sharedData ) {
                const newSharedData = { ...sharedData.value };
                sharedData.update && sharedData.update( newSharedData );
            }
        }
    } else if( ckEditorType === 'saveDiscardEditor' ) {
        convCtx.ckEditorRef = 'saveDiscardEditor';
        if( sharedData ) {
            const newSharedData = { ...sharedData.value };
            sharedData.update && sharedData.update( newSharedData );
        }
    } else{
        convCtx.ckEditorRef = '';
    }
    if( convUtils.isDiscussionSublocation() ) {
        convCtx.isInputTextValid = isInputTextValidVal;
        return convCtx.isInputTextValid;
    }
    var newIsInputTextValid = _.clone( data.isInputTextValid );
    newIsInputTextValid = isInputTextValidVal;
    return newIsInputTextValid;
};

export let checkCKEInputTextValidityAndPublishEvent = function( cke, ckEditorRef ) {
    var theData = cke.getData().replace( /&nbsp;/g, '' );
    theData = theData.replace( /<p>( )*<\/p>/g, '' );
    if( theData.trim() !== '' ) {
        _isTextValid = true;
    } else {
        _isTextValid = false;
    }
    var ckeditorType = '';
    if( ckEditorRef && ckEditorRef.includes( 'cmtReply' ) ) {
        ckeditorType = 'replyEditor';
        eventBus.publish( 'isInputTextValidEvent.CommentReply', { isTextValid: _isTextValid, ckeditorTypeEvent: ckeditorType, ckEditorRef } );
    } else if( ckEditorRef && ckEditorRef.includes( 'collabCmtEdit' ) ) {
        ckeditorType = 'saveDiscardEditor';
        eventBus.publish( 'isInputTextValidEvent.SaveDiscard', { isTextValid: _isTextValid, ckeditorTypeEvent: ckeditorType } );
    } else{
        eventBus.publish( 'isInputTextValidEvent', { isTextValid: _isTextValid, ckeditorTypeEvent: ckeditorType, theData } );
    }
};
/**
 * Populate the data structure used to display which participant/source obj
 * combination do not have read access.
 */
export let warnParticipantSourceNoReadAccess = function() {
    var convCtx = convUtils.getAc0ConvCtx();

    var participantSourceMap = constructSrcObjUsrJSObj( convCtx.userObjectMap );
    var participantNames = [];
    var sourceObjNames = [];

    _.forEach( Object.keys( participantSourceMap ), function( participantUid ) {
        var part = cdm.getObject( participantUid ).props.object_string.dbValues[ 0 ].split( '(' )[ 0 ].trim();
        var sourceObjName = '';
        for( var ii = 0; ii < participantSourceMap[ participantUid ].length; ii++ ) {
            sourceObjName += cdm.getObject( participantSourceMap[ participantUid ][ ii ].uid ).props.object_string.dbValues[ 0 ];
            sourceObjName += ', ';
        }
        sourceObjName = sourceObjName.slice( 0, -2 );
        sourceObjNames.push( sourceObjName );
        participantNames.push( part );
    } );

    convCtx.warnMsgText = '';
    for( var jj = 0; jj < participantNames.length; jj++ ) {
        convCtx.warnMsgText += messageSvc.applyMessageParamsWithoutContext( convCtx.i18nindividualReadAccessWarnDesc, [ participantNames[ jj ], sourceObjNames[ jj ] ] );
        convCtx.warnMsgText += '\n';
    }
    convCtx.warnMsgText.trim();
    if( participantNames.length > 0 && sourceObjNames.length > 0 ) {
        convCtx.showWarnMsg = true;
    } else {
        convCtx.showWarnMsg = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    return { showUserWarnMessageVal: convCtx.showWarnMsg };
};

// var addLoggedInUserToUserChips = ( userChipsObj, newUserChipsObj, loggedInUserChips, editConvCtx ) => {
//     var chipExisted = _.find( userChipsObj.userChips, function( chip ) {
//         if ( typeof loggedInUserChips === 'undefined' || typeof loggedInUserChips[0].theObject !== 'undefined' ) {
//             return chip.theObject.uid === loggedInUserChips[0].theObject.uid;
//         }
//         return undefined;
//     } );
//     if ( !chipExisted && !editConvCtx ) {
//         if ( !userChipsObj.userChips ) {
//             newUserChipsObj.userChips = [];
//         }
//         newUserChipsObj.userChips.push( loggedInUserChips[0] );
//     }
// };

export let changeConvType = function( convType, userChipsObj, loggedInUserChips, sharedData ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvType = _.clone( convType );
    const newUserChipsObj = _.clone( userChipsObj );

    //<Daniel Stoy 11/28/2023> Adresses PR#10894124
    //When using components, user is not registered as a viewmodel object but instead a model object
    //Since we expect a viewmodel object here, we need to construct view model objects from our logged in users if it's needed
    var loggedInUserChipsVM = _.map( loggedInUserChips, ( obj ) => {
        if( cdm.isModelObject( obj ) ) {
            return viewModelObjectSvc.createViewModelObject( obj );
        }

        return obj;
    } );

    if( convType && convType.dbValue === '' ) {
        newConvType.dbValue = 'message';
        const newSharedData = { ...sharedData.value };
        newSharedData.isPrivate = true;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChipsVM );
        if( !editConvCtx ) {
            _.forEach( newSharedData.addedUserObjects, ( userChipObj ) => {
                if( userChipObj.theObject.uid === appCtxSvc.getCtx( 'user' ).uid ) {
                    userChipObj.enableWhen = { condition: 'conditions.falsyCondition' };
                }
            } );
        }
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
        // addLoggedInUserToUserChips( userChipsObj, newUserChipsObj, loggedInUserChips, editConvCtx );
    } else if( convType && convType.dbValue === 'message' ) {
        newConvType.dbValue = '';
        const newSharedData = { ...sharedData.value };
        newSharedData.isPrivate = false;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChipsVM );
        _.forEach( newSharedData.addedUserObjects, ( userChipObj ) => {
            if( userChipObj.theObject.uid === appCtxSvc.getCtx( 'user' ).uid ) {
                userChipObj.enableWhen = { condition: 'conditions.truthyCondition' };
            }
        } );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
    }
    if( editConvCtx ) {
        editConvCtx.props.isConvPrivate.dbValue = newConvType.dbValue === 'message';
    }
    return {
        convType: newConvType,
        userChipsObj: newUserChipsObj
    };
};

export let changeConvActionable = function( convActionable, priority, status, userChipsObj, loggedInUserChips, sharedData ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvActionable = _.clone( convActionable );
    const newPriority = _.clone( priority );
    const newStatus = _.clone( status );
    const newUserChipsObj = _.clone( userChipsObj );

    if( convActionable && convActionable.dbValue === '' ) {
        newConvActionable.dbValue = 'actionable';
        setPriorityAndStatusValues( newPriority, newStatus, 'Low', 'Open', null, true );
        const newSharedData = { ...sharedData.value };
        newSharedData.isTracked = true;
        newSharedData.trackedPriority = newPriority.dbValue;
        newSharedData.trackedStatus = newStatus.dbValue;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChips );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
    } else if( convActionable && convActionable.dbValue === 'actionable' ) {
        newConvActionable.dbValue = '';
        newStatus.dbValue = '';
        newPriority.dbValue = '';
        const newSharedData = { ...sharedData.value };
        newSharedData.isTracked = false;
        newSharedData.trackedPriority = '';
        newSharedData.trackedStatus = '';
        sharedData.update && sharedData.update( newSharedData );
    }
    if( editConvCtx ) {
        editConvCtx.props.convStatus = newStatus;
        editConvCtx.props.convPriority = newPriority;
    }
    return {
        convActionable: newConvActionable,
        userChipsObj: newUserChipsObj,
        priority: newPriority,
        status: newStatus
    };
};

export let setPriorityAndStatusValues = ( newPriority, newStatus, priorityVal, statusVal, sharedData, isActionableChk, editConvCtx ) => {
    if( isActionableChk ) {
        newPriority.dbValue = priorityVal;
        var priority = defaultPriorityInternalNameDispNameMap.get( priorityVal );
        var status = defaultStatusInternalNameDispNameMap.get( statusVal );
        if( priority && status ) {
            newPriority.dbValue = priorityVal;
            newPriority.dbValues = [ priorityVal ];
            newPriority.uiValue = priority;
            newPriority.uiValues = [ priority ];
            newStatus.dbValue = statusVal;
            newStatus.dbValues = [ statusVal ];
            newStatus.uiValue =  status;
            newStatus.uiValues = [ status ];
        } else{
            newPriority.dbValue =  priorityVal;
            newPriority.dbValues =  [ priorityVal ];
            newPriority.uiValue =  priorityVal;
            newPriority.uiValues = [ priorityVal ];
            newStatus.dbValue = statusVal;
            newStatus.dbValue = [ statusVal ];
            newStatus.uiValue = statusVal;
            newStatus.uiValues = [ statusVal ];
        }
        if( sharedData && sharedData.value.isTracked ) {
            const newSharedData = { ...sharedData.value };
            newSharedData.trackedPriority = newPriority;
            newSharedData.trackedStatus = newStatus;
            sharedData.update && sharedData.update( newSharedData );

            if( editConvCtx && editConvCtx.props.convPriority.dbValue && editConvCtx.props.convStatus.dbValue ) {
                if ( newSharedData.trackedPriority.dbValue !== editConvCtx.props.convPriority.dbValue ) {
                    editConvCtx.props.convPriority = newSharedData.trackedPriority;
                }
                if( newSharedData.trackedStatus.dbValue !== editConvCtx.props.convStatus.dbValue ) {
                    editConvCtx.props.convStatus = newSharedData.trackedStatus;
                }
            }
        }
    }
};

let ensureSrcObjChipsPopulatedInEmbededUsecase = function( data, sharedData ) {
    var srcObjChips = data.srcObjChips;
    if( typeof srcObjChips !== 'undefined' && srcObjChips.length > 0 && srcObjChips[0].labelInternalName === '' ) {
        if( sharedData.selectedObj ) {
            srcObjChips[0].labelDisplayName = sharedData.selectedObj.uiValue;
            srcObjChips[0].labelInternalName = sharedData.selectedObj.uiValue;
            srcObjChips[0].theObject = sharedData.selectedObj;
        } else if( typeof data.ctx.selected !== 'undefined' && data.ctx.selected !== null ) {
            if( typeof data.ctx.selected.cellHeader1 !== 'undefined' && data.ctx.selected.cellHeader1 !== null  ) {
                srcObjChips[0].labelDisplayName = data.ctx.selected.cellHeader1;
                srcObjChips[0].labelInternalName = data.ctx.selected.cellHeader1;
                srcObjChips[0].theObject = data.ctx.selected;
            } else {
                srcObjChips[0].labelDisplayName = data.ctx.selected.props.object_string.uiValues[0];
                srcObjChips[0].labelInternalName = data.ctx.selected.props.object_string.uiValues[0];
                srcObjChips[0].theObject = data.ctx.selected;
            }
        } else {
            // Lets find this from the url????
            const stateParams = AwStateService.instance.params;
            const objectUid = stateParams.uid;
            var selObj = cdm.getObject( objectUid );
            if( selObj ) {
                srcObjChips[0].labelDisplayName = selObj.cellHeader1;
                srcObjChips[0].labelInternalName = selObj.cellHeader1;
                srcObjChips[0].theObject = selObj;
            }
        }
    }
};

//*****************************************************************************
//Helper methods to reduce complexity of initCreateCollabObjectPanel
//*****************************************************************************
let initCreateCollabObjectPanelHelperSetSharedDataSelectedObj = function( data, newSharedData, subPanelContext ) {
    // Check if the selected object has a object string and if valid set to the newSharedData.selected object
    // if there is no object string this is not a valid option
    if( subPanelContext?.selectionData?.selected && subPanelContext?.selectionData?.selected[0] ) {
        // Update selectedObj if the current object's UID does not match the subPanelContext's selected UID
        const hasObjectString = data.ctx.selected?.props?.object_string?.dbValues?.length > 0;
        const hasDifferentUID = newSharedData?.selectedObj?.uid !== subPanelContext?.selectionData?.selected[0]?.uid;
        if ( !hasObjectString && hasDifferentUID && newSharedData !== null ) {
            newSharedData.selectedObj = subPanelContext.selectionData.selected[0];
        }
    }
};

let initCreateCollabObjectPanelHelperClearSrcObjChips = function( data ) {
    // Initially, data.srcObjChips contains the selected object as srcChips, so clearing srcObjChips when editConvCtx is true
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    if ( editConvCtx ) {
        data.srcObjChips.length = 0;
    }
};

let initCreateCollabObjectPanelHelperIsTrackedPrivateUserChipProcessing = function( data,
    sharedData,
    newSharedData,
    newConvActionable,
    newConvActionableChk,
    newPriority,
    newStatus,
    newUserChipsObj,
    newConvType,
    newConvTypeCheck
) {
    if( sharedData.value.isTracked ) {
        newConvActionable.dbValue = 'actionable';
        newConvActionableChk.dbValue = true;
        var sharedDataPriorityDbValue = sharedData.value.trackedPriority.dbValue ? sharedData.value.trackedPriority.dbValue : sharedData.value.trackedPriority;
        var sharedDataStatusDbValue = sharedData.value.trackedStatus.dbValue ? sharedData.value.trackedStatus.dbValue : sharedData.value.trackedStatus;
        setPriorityAndStatusValues( newPriority, newStatus, sharedDataPriorityDbValue, sharedDataStatusDbValue, sharedData, newConvActionableChk.dbValue );
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
    }
    if( sharedData.value.isPrivate ) {
        newConvType.dbValue = 'message';
        newConvTypeCheck.dbValue = true;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
    }

    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    if( !editConvCtx ) {
        const userCtx = appCtxSvc.getCtx( 'user' );
        if( typeof sharedData.value.isPrivate === 'undefined' ) {
            const preferences = appCtxSvc.getCtx( 'preferences' );
            // Check if Ac0DefaultIsPrivateValue is true
            if ( preferences.Ac0DefaultIsPrivateValue?.[0]?.toUpperCase() === 'TRUE' ) {
            // Create view model object for the logged-in user if it's a model object
                const loggedInUserChipsVM = cdm.isModelObject( userCtx ) ? [ viewModelObjectSvc.createViewModelObject( userCtx ) ] : [ userCtx ];
                newConvType.dbValue = 'message';
                newConvTypeCheck.dbValue = true;
                newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChipsVM );
                const userUid = userCtx.uid;
                _.forEach( newSharedData.addedUserObjects, ( userChipObj ) => {
                    if ( userChipObj.theObject.uid === userUid ) {
                        userChipObj.enableWhen = { condition: 'conditions.falsyCondition' };
                    }
                } );
                // Update newUserChipsObj
                newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
            }
            initCreateCollabObjectPanelSub( data, newSharedData );
            // Add source object owner as default participant if Ac0AddOwnerAsDefaultParticipant is set to 'true'
            let sharedDataWithDefaultParticipant = addOwnerAsDefaultParticipant( preferences, sharedData );
            newSharedData.addedUserObjects = _.uniqBy( [ ...sharedData.addedUserObjects, ...sharedDataWithDefaultParticipant.addedUserObjects ], 'labelDisplayName' );
            newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        }
    }
};
//*****************************************************************************
//End methods to reduce complexity of initCreateCollabObjectPanel
//*****************************************************************************

export let initCreateCollabObjectPanel = function( data, sharedData, subPanelContext ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvTypeCheck = _.clone( data.convTypeChk );
    const newConvType = _.clone( data.convType );
    const newConvActionableChk = _.clone( data.convActionableChk );
    const newConvActionable = _.clone( data.convActionable );
    const newPriority = _.clone( data.priority );
    const newStatus = _.clone( data.status );
    const newUserChipsObj = _.clone( data.userChipsObj );
    const newSharedData = { ...sharedData.value };

    var srcObjList = [];
    var participantList = {};

    if( sharedData && sharedData.selectedObj && sharedData.selectedObj.uid && sharedData.removedSourceObjects &&  sharedData.removedSourceObjects.includes( sharedData.selectedObj.uid ) ) {
        _.remove( data.srcObjChips, ( srcObj ) => {
            return srcObj.theObject.uid === sharedData.selectedObj.uid;
        } );
    }

    initCreateCollabObjectPanelHelperSetSharedDataSelectedObj( data, newSharedData, subPanelContext );
    initCreateCollabObjectPanelHelperClearSrcObjChips( data );

    //populating vm data with sharedData objects. This use case comes into play only on coming back from Add source obj or user panel.
    //sharedData.addedUserObjects or sharedData.addedSourceObjects should be populated as chips here only on coming back from these panels.
    //For all other usecases ( initial edit and initial create ) these will be empty.
    if( !convUtils.isDiscussionSublocation() ) {
        ensureSrcObjChipsPopulatedInEmbededUsecase( data, sharedData );
    }
    addSourceObjectsToChipList( data.srcObjChips, sharedData.addedSourceObjects, editConvCtx );
    newUserChipsObj.userChips = [ ...sharedData.addedUserObjects ];
    initCreateCollabObjectPanelHelperIsTrackedPrivateUserChipProcessing( data,
        sharedData,
        newSharedData,
        newConvActionable,
        newConvActionableChk,
        newPriority,
        newStatus,
        newUserChipsObj,
        newConvType,
        newConvTypeCheck
    );
    if( editConvCtx ) {
        srcObjList = editConvCtx.props.sourceObjList.dbValues.map( function( srcObj ) {
            return {
                uid: srcObj.uid,
                props: {
                    object_string: {
                        dbValue: srcObj.object_string
                    }
                }
            };
        } );
        participantList = {
            selectedUsers: editConvCtx.props.participantObjList.dbValues.map( function( user ) {
                return {
                    uid: user.uid,
                    props: {
                        user_name: {
                            uiValue: user.object_string.split( '(' )[ 0 ].trim()
                        }
                    },
                    modelType: {
                        typeHierarchyArray: [ 'User' ]
                    }
                };
            } )
        };
    }
    if( editConvCtx ) {
        addSourceObjectsToChipList( data.srcObjChips, srcObjList, editConvCtx );
        var userObjsToAdd = [];
        if( _.isEmpty( sharedData.addedUserObjects ) ) {
            userObjsToAdd = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, participantList.selectedUsers );
        } else {
            userObjsToAdd = sharedData.addedUserObjects;
        }
        newSharedData.addedUserObjects = [ ...userObjsToAdd ];
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        // addUserObjectsToChipList( newUserChipsObj.userChips, participantList.selectedUsers );
        if( editConvCtx.props.isConvPrivate.dbValue === true ) {
            newConvType.dbValue = 'message';
            newConvTypeCheck.dbValue = true;
            newSharedData.isPrivate = true;
            //sharedData.update && sharedData.update( newSharedData );
            //addLoggedInUserToUserChips( data.userChipsObj, newUserChipsObj, data.loggedInUserChips, editConvCtx );
            newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
            newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        }
        if( editConvCtx.props.convStatus.dbValue !== '' && editConvCtx.props.convPriority.dbValue !== '' && convUtils.isAc0EnableTrackedDiscussions() ) {
            newConvActionable.dbValue = 'actionable';
            newConvActionableChk.dbValue = true;
            var priorityToSet = editConvCtx.props.convPriority.dbValue ? editConvCtx.props.convPriority.dbValue : sharedData.value.trackedPriority;
            var statusToSet = editConvCtx.props.convStatus.dbValue ? editConvCtx.props.convStatus.dbValue : sharedData.value.trackedStatus;
            sharedData.value.isTracked = true;
            setPriorityAndStatusValues( newPriority, newStatus, priorityToSet, statusToSet, sharedData, newConvActionableChk.dbValue );
            newSharedData.isTracked = true;
            newSharedData.trackedPriority = newPriority.dbValue;
            newSharedData.trackedStatus = newStatus.dbValue;
            //sharedData.update && sharedData.update( newSharedData );
            // addLoggedInUserToUserChips( data.userChipsObj, newUserChipsObj, data.loggedInUserChips, editConvCtx );
            newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
            newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        }
        appCtxSvc.updateCtx( 'Ac0ConvCtx.createOrEditRichText', editConvCtx.props.richText.displayValues[ 0 ] );
        var ac0EditHandler = ehFactory.createEditHandler( dataSourceService.createNewDataSource( {
            declViewModel: data
        } ) );
        //ac0EditSvc.addEditHandler( ac0EditHandler );
        ehSvc.setEditHandler( ac0EditHandler, 'AC0_CONVERSATION' );
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...srcObjList ];
        // newSharedData.addedUserObjects = [ ...sharedData.value.addedUserObjects, ...participantList.selectedUsers ];
    }
    sharedData.update && sharedData.update( newSharedData );
    return {
        convTypeChk: newConvTypeCheck,
        convType: newConvType,
        convActionableChk: newConvActionableChk,
        convActionable: newConvActionable,
        priority: newPriority,
        status: newStatus,
        userChipsObj: newUserChipsObj
    };
};

var initCreateCollabObjectPanelSub = function( data, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.collabDataProviders = data.dataProviders;
    convCtx.showWarnMsg = false;
    convCtx.warnMsgText = '';
    convCtx.createOrEditRichText = '';
    convCtx.i18nparticipantReadAccessWarningMsg = data.i18n.participantReadAccessWarningMsg;
    convCtx.i18nindividualReadAccessWarnDesc = data.i18n.individualReadAccessWarnDesc;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    // TODO - should this be deleted this was commented out previously.
    // var selObj = appCtxSvc.getCtx( 'Ac0ConvCtx.selected' );
    //data.selectedObj = selObj;
    if( data.userChips ) {
        delete data.userChips;
    }

    //TODO : revisit and revert code once Product Gallery and My Gallery panels are converted to AWDialogs
    //modify the selected obj fnd0roots
    if ( convCtx.currentSelectedSnapshot || data.subPanelContext && data.subPanelContext.selectionData && data.subPanelContext.selectionData.selected && data.subPanelContext.selectionData.selected[0] && data.subPanelContext.selectionData.selected[0].type === 'Fnd0Snapshot' ) {
        // if( convCtx.snapshotEntryPoint || convUtils.isMyGallerySublocation() ) {
        _.remove( data.srcObjChips, ( chip ) => {
            return chip.theObject.type === 'Fnd0Snapshot';
        } );
        // When initializing the panel from a snapshot we do not
        // need the selected object from the assembly to be added
        // unless the user specificaly adds it
        // The chips added by 'default' in this usecase do not have
        // the delete ('x') icon so they can be removed
        _.remove( data.srcObjChips, ( chip ) => {
            return typeof chip.uiIconId === 'undefined';
        } );
        // }

        if( !convCtx.currentSelectedSnapshot ) {
            convCtx.currentSelectedSnapshot = data.subPanelContext.selectionData.selected[0];
            sharedData.currentSelectedSnapshot = data.subPanelContext.selectionData.selected[0];
            sharedData.currentlySelectedObject = data.subPanelContext.selectionData.selected[0].type;
        }

        if( convCtx.currentSelectedSnapshot ) {
            var srcObj = convCtx.currentSelectedSnapshot.props.fnd0Roots;
            // TODO - confirm this can be removed
            // What is this check inteded to look for?
            //if( typeof srcObj !== 'undefined' && convCtx.snapshotObjfnd0Roots ) {
            if( typeof srcObj !== 'undefined' ) {
                var chipObj = cdm.getObject( srcObj.dbValues[0] );
                var underlyingObj;
                let chipObjVMO = viewModelObjectSvc.createViewModelObject( chipObj );
                //Special hadling for Image, List and Table views for Snapshot Objects
                if( !chipObjVMO.cellHeader1 ) {
                    var underlyingUid = srcObj.dbValues[0];
                    dmSvc.getProperties( [ underlyingUid ], [ 'object_string' ] ).then( function( response ) {
                        underlyingObj = cdm.getObject( underlyingUid );
                        chipObjVMO = viewModelObjectSvc.createViewModelObject( underlyingObj );
                        var srcObject = {
                            // TODO - clean this up or should it be uncommented?
                            // The 'root' source object should not be removable
                            // uiIconId: 'miscRemoveBreadcrumb',
                            chipType: 'BUTTON',
                            labelDisplayName: chipObjVMO.cellHeader1,
                            labelInternalName: chipObjVMO.props.object_string.dbValue,
                            theObject: chipObjVMO
                        };
                        var chipExisted = _.find( data.srcObjChips, function( chip ) {
                            return chip.theObject.uid === srcObject.theObject.uid;
                        } );
                        if( !chipExisted ) {
                            data.srcObjChips.splice( 0, 0, srcObject );
                        }
                        eventBus.publish( 'Ac0CreateCollabObj.doRerenderSrcChips' );
                    } );
                } else{
                    var srcObject = {
                    // TODO - clean this up or should it be uncommented?
                    // The 'root' source object should not be removable
                    // uiIconId: 'miscRemoveBreadcrumb',
                        chipType: 'BUTTON',
                        labelDisplayName: chipObjVMO.cellHeader1,
                        labelInternalName: chipObjVMO.props.object_string.dbValue,
                        theObject: chipObjVMO
                    };
                    var chipExisted = _.find( data.srcObjChips, function( chip ) {
                        return chip.theObject.uid === srcObject.theObject.uid;
                    } );
                    if( !chipExisted ) {
                        data.srcObjChips.splice( 0, 0, srcObject );
                    }
                }
            }
        }
    }
};

/**
 * Method that switches flags in the context.
 * @param {*} conv Conversation
 * @param {*} comment Comment
 */
export let modifyCreateCtxFlagsForCollabObjs = function( conv, comment ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.createNewComment = comment;
    convCtx.createNewConversation = conv;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
};

/**
 * Method that preps service input before posting a comment
 * @param {*} convObj conversation object
 * @param {*} richText rich text string
 * @returns {*} Promise
 */
export let postComment = function( convObj, richText, commentObj, data, removedRelatedObjList ) {
    var deferred = AwPromiseService.instance.defer();
    var graphQLInput = {};

    var contextConvObj = {};
    var convObjForSoa = {};

    if( convObj ) {
        contextConvObj = convObj;
    } else {
        contextConvObj.rootCommentObj = appCtxSvc.getCtx( 'Ac0ConvCtx' ).createCommentRootCommentObj;
        contextConvObj.uid = appCtxSvc.getCtx( 'Ac0ConvCtx' ).createCommentConvId;
    }

    convObjForSoa = cdm.getObject( contextConvObj.uid );
    if( !convObjForSoa ) {
        var svmo = {
            props: {}
        };
        svmo.uid = contextConvObj.uid;
        svmo.type = 'Ac0Conversation';
        convObjForSoa = vmoSvc.constructViewModelObject( svmo );
    }

    var newRichTextString = richText ? richText : getRichText( convObj.ckeInstance );
    // First thing we need to do is parse the richText to determine if there
    // were any pre-existing img tags and replace the now stripped 'id'
    // attribute.
    if( typeof commentObj !== 'undefined' && typeof commentObj.props !== 'undefined' && typeof commentObj.props.richText !== 'undefined' ) {
        let parser = new DOMParser();
        var tmpRichText = typeof commentObj.props.richText.dbValue !== 'undefined' ? commentObj.props.richText.dbValue : commentObj.props.richText.displayValues[0];
        var originalRichTextDoc = parser.parseFromString( tmpRichText, 'text/html' );
        if( typeof originalRichTextDoc !== 'undefined' && typeof originalRichTextDoc.images !== 'undefined' && originalRichTextDoc.images.length > 0 ) {
            var newRichTextDoc = parser.parseFromString( newRichTextString, 'text/html' );
            if( typeof newRichTextDoc !== 'undefined' && typeof newRichTextDoc.images !== 'undefined' && newRichTextDoc.images.length > 0 ) {
                for( var i = 0; i < originalRichTextDoc.images.length; i++ ) {
                    for( var j = 0; j < newRichTextDoc.images.length; j++ ) {
                        if( originalRichTextDoc.images[i].src === newRichTextDoc.images[j].src ) {
                            newRichTextDoc.images[j].id = originalRichTextDoc.images[i].id;
                            break;
                        }
                    }
                }
                var tmpRichTextString = new XMLSerializer().serializeToString( newRichTextDoc );
                newRichTextString = tmpRichTextString.substring( tmpRichTextString.indexOf( '<body>' ) + 6, tmpRichTextString.lastIndexOf( '</body>' ) );
            }
        }
    }

    graphQLInput.richText = newRichTextString;
    graphQLInput.rootComment  = {
        uid: contextConvObj.rootCommentObj.uid
    };

    graphQLInput.conversation = {
        uid: convObjForSoa.uid,
        type: convObjForSoa.type
    };

    var relatedObjCopy  = [];
    if( contextConvObj.props && contextConvObj.props.collabRelatedObjectInfo ) {
        relatedObjCopy = [ ...contextConvObj.props.collabRelatedObjectInfo.dbValue ];
    }

    // We need to add the discussion Options
    const payloadOptions = {};
    graphQLInput.options = getDiscussionOptions( payloadOptions );

    var graphQLQuery;
    if( typeof commentObj !== 'undefined' && commentObj !== null && typeof commentObj.uid !== 'undefined' ) {
        graphQLInput.comment = {
            type: 'Ac0Comment',
            uid: commentObj.isRootComment ? contextConvObj.rootCommentObj.uid : commentObj.uid //if root comment is being edited, then pass rootCommentObj uid. Else pass regular comment uid
        };

        if( removedRelatedObjList ) {
            // this is replacing the options defined above
            // need to review if this needs to be added or replaced.
            graphQLInput.options = getRemovedRelatedObjectList( relatedObjCopy, removedRelatedObjList );
        }

        //edit comment
        graphQLQuery = {
            endPoint: 'tcgql/graphql',
            request: {
                query: 'mutation updateComment($updateCommentInput: UpdateCommentInput!) { updateComment(updateCommentInput: $updateCommentInput) { createdOrUpdatedCollabObject { uid type collabRichText collabDateModified collabPlainText} } }',
                variables: {
                    updateCommentInput: graphQLInput
                }
            }
        };
        //Comment updated, publish event to refresh Discussion sublocation, to reset PWA data
        if( convUtils.isDiscussionSublocation() ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    } else {
        //create comment
        graphQLQuery = {
            endPoint: 'tcgql/graphql',
            request: {
                query: 'mutation createComment($createCommentInput: CreateCommentInput!) { createComment(createCommentInput: $createCommentInput) { createdOrUpdatedCollabObject { uid type collabRichText collabDateModified collabPlainText} } }',
                variables: {
                    createCommentInput: graphQLInput
                }
            }
        };
    }

    graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
        if ( !declUtils.isNil( response ) ) {
            //TODO: error handling will be corrected in followup CP. GQL schema for error is being worked upon.
            let err = null;
            if ( response.errors ) {
                err = soaSvc.createError( response.errors[0] );
            }
            if ( err && typeof  data !== 'undefined' ) {
                var msg = '';
                msg = msg.concat( data.i18n.commentCreationErrorMsg );
                msgSvc.showError( msg );
                deferred.reject( err );
            } else {
                deferred.resolve( response );
            }
        }
    }, ( err ) => {
        if( err.response && err.response.status !== 200 ) {
            msgSvc.showError( `${data.i18n.graphqlErrorMsg}` );
        }
        deferred.reject( err );
    } );
    return deferred.promise;
};

/**
 * Method that preps service input before posting a conversation
 * @param {*} data input data
 * @returns {*} Promise
 */
export let postConversation = function( data, sharedData ) {
    var deferred = AwPromiseService.instance.defer();
    var ckeInstance = appCtxSvc.getCtx( 'Ac0ConvCtx.createCollabObjData.ckeInstance' );
    var graphQLInput = {};

    var snapshotObj = appCtxSvc.getCtx( 'viewer.discussionCtx' ) ? appCtxSvc.getCtx( 'viewer.discussionCtx' ).newProductSnapshot : {};
    if ( sharedData && sharedData.currentSelectedSnapshot ) {
        snapshotObj = sharedData.currentSelectedSnapshot;
    }
    const payloadOptions = {};
    payloadOptions.snapshotObjUid = snapshotObj ? snapshotObj.uid : null;

    graphQLInput.sourceObjects = [];
    graphQLInput.sourceObjects = ac0ConvSvc.getSourceObjects( data );
    graphQLInput.listOfParticipants = ac0ConvSvc.getUserObjects( data );
    graphQLInput.defaultCommentText = getRichText( ckeInstance );
    graphQLInput.options = getDiscussionOptions( payloadOptions ); //{"snapshot", "snaphotUID"}
    graphQLInput.conversation = data.editConvUid ? {
        type: 'Ac0Conversation',
        uid: data.editConvUid
    } : {
        type: 'Ac0Conversation',
        uid: 'AAAAAAAAAAAAAA'
    };
    graphQLInput.convPrivate = data.convType.dbValue === 'message';
    graphQLInput.convActionable = data.convActionable.dbValue === 'actionable';
    if ( convUtils.isAc0EnableTrackedDiscussions() ) {
        graphQLInput.status = data.convActionable.dbValue === 'actionable' ? data.status.dbValue : null;
        graphQLInput.priority = data.convActionable.dbValue === 'actionable' ? data.priority.dbValue : null;
        graphQLInput.closingUserId = data.convActionable.dbValue === 'actionable' ? data.statusChangedByUserId : null;
        graphQLInput.dateClosed = data.convActionable.dbValue === 'actionable' ? dateTimeSvc.formatUTC( new Date() ) : null;
    }

    var graphQLQuery;
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    if( editConvCtx ) { //edit conversation
        graphQLQuery = {
            endPoint: 'tcgql/graphql',
            request: {
                query: 'mutation updateConversation($updateConversationInput: AddOrUpdateConversationInput!) { updateConversation(updateConversationInput: $updateConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    updateConversationInput: graphQLInput
                }
            }
        };
    } else { //create conversation
        graphQLQuery = {
            endPoint: 'tcgql/graphql',
            request: {
                query: 'mutation addConversation($addConversationInput: AddOrUpdateConversationInput!) { addConversation(addConversationInput: $addConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    addConversationInput: graphQLInput
                }
            }
        };
    }

    graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
        if( !declUtils.isNil( response ) ) {
            //TODO: error handling will be corrected in followup CP. GQL schema for error is being worked upon.
            modifyCreateCtxFlagsForCollabObjs( false, false );
            let err = null;
            if( response.errors ) {
                err = soaSvc.createError( response.errors[ 0 ] );
            }
            if( err ) {
                var msg = '';
                msg = msg.concat( data.i18n.convCreationErrorMsg );
                msgSvc.showError( msg );
                if( !convUtils.isDiscussionSublocation() ) {
                    ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                }
                deferred.reject( err );
            } else {
                deferred.resolve( response );
            }
        }
    }, ( err ) => {
        if( err.response && err.response.status !== 200 ) {
            msgSvc.showError( `${data.i18n.graphqlErrorMsg}` );
        }
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let destroyCkEditorInstance = function( data ) {
    if( data.ckeInstance ) {
        unSubscribeFromCkeEvents();
        data.ckeInstance.destroy();
    }
    data.ckeInstance = null;
};

export let unSubscribeFromCkeEvents = function() {
    if( insertImageCKEEvents && insertImageCKEEvents.length > 0 ) {
        _.forEach( insertImageCKEEvents, function( insertImageEvt ) {
            eventBus.unsubscribe( insertImageEvt );
        } );
        insertImageCKEEvents = [];
    }
};

export let setCkEditorData = function( data, ckeInstance, alternateText ) {
    var text = data ? data : '';
    text = sanitizer.unEscapeHtml( text );
    if( !text && alternateText ) {
        text = alternateText;
    }
    if( ckeInstance && ckeInstance.cke && ckeInstance.cke._instance ) {
        ckeInstance.cke._instance.setData( text );
    }
    if( ckeInstance._instance ) {
        ckeInstance._instance.setData( text );
    }
};

let formatTextForReply = function( data ) {
    // This is to format the text when using the 'Include in Reply' cmd
    //First lets quote the text
    var quotedText = data;
    if( data.includes( '<p>' ) && data.endsWith( '</p>' ) ) {
        quotedText = data.replace( '<p>', '<p>' + '"' );
        quotedText = quotedText.substring( 0, quotedText.lastIndexOf( '</p>' ) ) + '"</p>';
    }

    // The non breaking space character is escaped and we need to un escape it
    quotedText = quotedText.replaceAll( '&amp;nbsp;', '&nbsp;' );

    // Due to issues with image timeouts we need to exclude images from
    // the text to copy
    quotedText = quotedText.replace( /<img[^>]*>/g, '' );
    quotedText = quotedText.replace( /<img[^>]*\/>/g, '' );
    return quotedText;
};

export let insertCkEditorData = function( data, ckeInstance ) {
    var richTextCK = ckeInstance.cke._instance.getData();
    var text = data ?  formatTextForReply( data ) : '';
    if( ckeInstance && ckeInstance.cke && ckeInstance.cke._instance ) {
        ckeInstance.cke._instance.setData( richTextCK + text );
    }
    if( ckeInstance._instance ) {
        ckeInstance._instance.setData( text );
    }
};

export let evalNavPathPriorToCKEDecision = function( data ) {
    if( data.eventData && data.eventData.destPanelId === 'Ac0UnivConvPanelSub' ) {
        destroyCkEditorInstance( data );
    }
    if( data.eventData && data.eventData.destPanelId === 'Ac0CreateNewCollabObj' ) {
        eventBus.publish( 'Ac0CreateCollabObj.evalNavCompleteCreateCKE' );
    }
};

/**
 * Process Status LOV Values.
 *
 * @param {Object} response The soa response
 */
export let processStatusLOV = function( response, data, metaData ) {
    var internalValues = [];
    var values = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        internalValues[ i ] = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        values[ i ] = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
    }

    var listOfValues = listBoxService.createListModelObjectsFromStrings( values );
    for( var j = 0; j < internalValues.length; j++ ) {
        if( metaData ) {
            listOfValues[ j ].propInternalValue = internalValues[ j ] + '___' + metaData.uid;
        } else{
            listOfValues[ j ].propInternalValue = internalValues[ j ];
        }
        listOfValues[ j ].propDisplayValue = values[ j ];
        defaultStatusInternalNameDispNameMap.set( internalValues[ j ], values[ j ] );
    }
    return listOfValues;
};

/**
 * Process Priority LOV Values.
 *
 * @param {Object} response The soa response
 */
export let processPriorityLOV = function( response, data ) {
    var internalValues = [];
    var values = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        internalValues[ i ] = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        values[ i ] = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
    }

    var listOfValues = listBoxService.createListModelObjectsFromStrings( values );
    for( var j = 0; j < internalValues.length; j++ ) {
        listOfValues[ j ].propInternalValue = internalValues[ j ];
        listOfValues[ j ].propDisplayValue = values[ j ];
        defaultPriorityInternalNameDispNameMap.set( internalValues[ j ], values[ j ] );
    }
    return listOfValues;
};

export let selectionChangeCreatePanel = function( data, sharedData, popupId ) {
    //TODO: wire in edithandler leaveConfirmation code here when ready
    var convCtx = convUtils.getAc0ConvCtx();
    if( !convCtx.editConvCtx ) {
        if( convUtils.isMyGallerySublocation() ) {
            let activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
            if( popupId ) {
                dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
            } else if ( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                eventBus.publish( 'awsidenav.openClose', {
                    id: 'aw_toolsAndInfo',
                    commandId: activeToolAndInfoCmd.commandId
                } );
            }
        }
        ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
        return;
    }
    if( convCtx.editConvCtx ) {
        convCtx.editConvCtx = null;
        let activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: data.i18n.saveEditsGroupPWATitle,
            onClick: function( $noty ) {
                $noty.close();
                exports.postConversation( data ).then( function() {
                    ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                    if( popupId ) {
                        dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
                    }
                    if( !popupId && activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                        eventBus.publish( 'awsidenav.openClose', {
                            id: 'aw_toolsAndInfo',
                            commandId: activeToolAndInfoCmd.commandId
                        } );
                    }
                } );
            }
        },
        {
            //Call soa if clicked on proceed
            addClass: 'btn btn-notify',
            text: data.i18n.discard,
            onClick: function( $noty ) {
                $noty.close();
                ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                if( popupId ) {
                    dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
                }
                if( !popupId && activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                    eventBus.publish( 'awsidenav.openClose', {
                        id: 'aw_toolsAndInfo',
                        commandId: activeToolAndInfoCmd.commandId
                    } );
                }
            }
        }
        ];
        messageSvc.showWarning( data.i18n.possibleUnsavedEdits, buttons );
    }
};

export let updateSharedDataWithSourceObjects = async function( sharedData, sourceObjects ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...sourceObjects ];
    let userVmos = [];
    const preferences = appCtxSvc.getCtx( 'preferences' );
    // This block is necessary when adding the source object from addPanelState.
    // It ensures that the owner of the selected/opened object in the primary work area is also added to the participant list.
    if( newSharedData.addedSourceObjects.length > 0 && preferences.Ac0AddOwnerAsDefaultParticipant?.[0]?.toUpperCase() === 'TRUE' ) {
        userVmos = await getUserObjectsFromSrcObjs( newSharedData.addedSourceObjects );
        if ( sharedData.value.addedUserObjects.length === 0 && sharedData.selectedObj?.props?.owning_user?.dbValues[0] ) {
            const selectedObjOwner = cdm.getObject( sharedData.selectedObj.props.owning_user.dbValues[0] );
            if ( selectedObjOwner ) {
                let selectedObjOwnerVmo = [ viewModelObjectSvc.createViewModelObject( selectedObjOwner ) ];
                userVmos = [ ...userVmos, ...selectedObjOwnerVmo ];
            }
        }
    }
    let combinedUserObjects = [ ...sharedData.value.addedUserObjects, ...userVmos ];
    newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, combinedUserObjects );
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let updateSharedDataWithUserObjects = function( sharedData, userObjects ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.addedUserObjects = [ ...sharedData.value.addedUserObjects, ...userObjects ];
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};


/**
 * Adds source objects to a chip list while ensuring no duplicates and removing invalid chips.
 *
 * @param {Array<Object>} srcObjChips - The list of existing chips to which new source objects will be added.
 * @param {Array<Object>} addedSourceObjects - The list of source objects to be added to the chip list.
 * @param {boolean} editConvCtx - A flag indicating whether the context is in edit mode.
 */
export let addSourceObjectsToChipList = function( srcObjChips, addedSourceObjects, editConvCtx ) {
    if( addedSourceObjects ) {
        for( var i = 0; i < addedSourceObjects.length; i++ ) {
            var srcObject = {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: addedSourceObjects[ i ].props.object_string.dbValue,
                labelInternalName: addedSourceObjects[ i ].props.object_string.dbValue,
                theObject: addedSourceObjects[ i ]
            };

            var chipExisted = _.find( srcObjChips, function( chip ) {
                //For Awb0DesignElement - theObject.uid is different and it needs special check to add only one chip.
                var awb0UndrlyngObjChipUid = null;
                if( chip.theObject && chip.theObject.props && chip.theObject.props.awb0UnderlyingObject ) {
                    awb0UndrlyngObjChipUid = chip.theObject.props.awb0UnderlyingObject.dbValues[0];
                }
                var addedSourceObjectsUid = addedSourceObjects[ i ].uid;
                if ( awb0UndrlyngObjChipUid !== null ) {
                    return awb0UndrlyngObjChipUid === addedSourceObjectsUid;
                }

                //For Runtime Objects, get the uid correctly
                if( chip.theObject && chip.theObject.modelType && chip.theObject.modelType.parentTypeName && chip.theObject.modelType.parentTypeName === 'RuntimeBusinessObject' ) {
                    var underlyingObj = adapterService.getAdaptedObjectsSync( [ chip.theObject ] );
                    if ( underlyingObj && underlyingObj[0].uid ) {
                        return underlyingObj[0].uid === addedSourceObjectsUid;
                    }
                }

                if( chip.theObject && chip.theObject.uid ) {
                    return chip.theObject.uid === addedSourceObjectsUid;
                }
            } );

            if( !chipExisted ) {
                srcObjChips.push( srcObject );
            }
        }

        _.remove( srcObjChips, ( chip ) => {
            if ( !chip ) {
                // If chip is null or undefined, remove it
                return true;
            }
            const isEmptyLabel = _.isEmpty( chip.labelDisplayName ) || _.isEmpty( chip.labelInternalName );
            const chipLen = chip?.theObject?.props?.object_string?.dbValues?.length || 0;
            if ( editConvCtx ) {
                return isEmptyLabel;
            }
            return isEmptyLabel || chipLen <= 0;
        } );
    }
};

/**
 * Adds user objects to a chip list if they do not already exist in the list.
 *
 * @param {Array<Object>} userObjChips - The list of existing user object chips.
 * @param {Array<Object>} addedUserObjects - The list of user objects to be added to the chip list.
 * @returns {void}
 */
export let addUserObjectsToChipList = function( userObjChips, addedUserObjects ) {
    if( addedUserObjects ) {
        for( var i = 0; i < addedUserObjects.length; i++ ) {
            var srcObject = {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: addedUserObjects[ i ].props.user_name.uiValue,
                labelInternalName: addedUserObjects[ i ].props.user_name.uiValue,
                theObject: addedUserObjects[ i ]
            };

            var chipExisted = _.find( userObjChips, function( chip ) {
                return chip.theObject.uid === addedUserObjects[ i ].uid;
            } );

            if( !chipExisted ) {
                userObjChips.push( srcObject );
            }
        }
    }
};

export var getDiscussionOptions = function( data ) {
    var options = [ { key : 'Ac0AWBaseURL', value : [ browserUtils.getBaseURL() ] } ];
    if( typeof data.snapshotObjUid !== 'undefined' && data.snapshotObjUid !== null ) {
        options = [ { key : 'Fnd0Snapshot', value : [ data.snapshotObjUid ] }, { key : 'Ac0AWBaseURL', value : [ browserUtils.getBaseURL() ] } ];
    }
    return options;
};

var getRemovedRelatedObjectList = function( relatedObjList, removedRelatedObjects ) {
    var removedRelatedObjUIDList = removedRelatedObjects.map( ( removedObj ) => { return removedObj.uid; } );
    var relatedObjAfterRemove = relatedObjList.reduce( ( acc, relatedObj ) => {
        if( acc.hasOwnProperty( relatedObj.type ) ) {
            if( !removedRelatedObjUIDList.includes( relatedObj.uid ) ) {
                if( acc[relatedObj.type].length === 0 ) {
                    acc[relatedObj.type] = [];
                }
                acc[relatedObj.type].push( relatedObj.uid );
            }
        }else {
            acc[relatedObj.type] = '';
            if( !removedRelatedObjUIDList.includes( relatedObj.uid ) ) {
                acc[relatedObj.type] = [ relatedObj.uid ];
            }
        }
        return acc;
    }, {} );
    return Object.keys( relatedObjAfterRemove ).map( ( relObjAfterRemoveKey ) => {
        return { key: relObjAfterRemoveKey, value: relatedObjAfterRemove[relObjAfterRemoveKey] };
    } );
};

/**
 * Retrieves the owning user objects associated with the given source objects.
 *
 * @param {Array<Object>} sourceObjects - An array of source objects, each containing a unique identifier (UID).
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of view model objects representing the owning users of the source objects.
 */
export let getUserObjectsFromSrcObjs = async function( sourceObjects ) {
    const owningUserObjs = [];
    const sourceObjUids = sourceObjects.map( obj => obj.uid );
    if ( sourceObjUids.length > 0 ) {
        // Retrieve owning_user property for the source objects
        await dmSvc.getProperties( sourceObjUids, [ 'object_string', 'owning_user' ] );
        for ( const uid of sourceObjUids ) {
            const updatedSrcObj = cdm.getObject( uid );
            if ( updatedSrcObj && updatedSrcObj.props?.owning_user?.dbValues?.[0] ) {
                const owningUser = cdm.getObject( updatedSrcObj.props.owning_user.dbValues[0] );
                if ( owningUser ) {
                    owningUserObjs.push( viewModelObjectSvc.createViewModelObject( owningUser ) );
                }
            }
        }
    }
    return owningUserObjs;
};

/**
 * Adds the owner of the selected object as a default participant if the specified preference is set to 'TRUE'.
 *
 * @param {Object} preferences - User preferences that include a setting to add the owner as a default participant.
 * @param {Object} sharedData - Shared data containing the selected object and other required properties for methods.
 * @returns {Object} Returns the updated sharedData with the owner added as a participant if applicable.
 */
export let addOwnerAsDefaultParticipant = function( preferences, sharedData ) {
    let newSharedData;
    if( sharedData !== null && typeof sharedData !== 'undefined' ) {
        newSharedData = { ...sharedData.value };
        // Check if the preference to add the owner as a default participant is set to 'TRUE'
        if ( preferences.Ac0AddOwnerAsDefaultParticipant?.[0]?.toUpperCase() === 'TRUE' ) {
            const owningUser = cdm.getObject( sharedData?.selectedObj?.props?.owning_user?.dbValues?.[0] || sharedData?.selectedObj?.props?.awb0ArchetypeRevOwningUser?.dbValues?.[0] );
            if ( owningUser ) {
                // Convert the owning user object to a unique user chip list
                newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList(
                    sharedData,
                    [ viewModelObjectSvc.createViewModelObject( owningUser ) ]
                );
                sharedData.update( newSharedData );
            }
        }
    }
    return newSharedData;
};

/**
 * Ac0CreateCollabObjectService factory
 */

export default exports = {
    setIsTextValid,
    showRichTextEditor,
    updateFormData,
    insertImage,
    getRichText,
    getPlainText,
    isInputTextValid,
    warnParticipantSourceNoReadAccess,
    changeConvType,
    changeConvActionable,
    initCreateCollabObjectPanel,
    modifyCreateCtxFlagsForCollabObjs,
    postComment,
    postConversation,
    destroyCkEditorInstance,
    setCkEditorData,
    processStatusLOV,
    processPriorityLOV,
    selectionChangeCreatePanel,
    evalNavPathPriorToCKEDecision,
    unSubscribeFromCkeEvents,
    checkCKEInputTextValidityAndPublishEvent,
    updateSharedDataWithSourceObjects,
    addSourceObjectsToChipList,
    updateSharedDataWithUserObjects,
    setPriorityAndStatusValues,
    insertCkEditorData,
    getDiscussionOptions,
    getUserObjectsFromSrcObjs,
    addOwnerAsDefaultParticipant
};
