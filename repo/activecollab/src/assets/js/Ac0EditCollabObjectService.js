// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0EditCollabObjectService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import createConvSvc from 'js/Ac0CreateCollabObjectService';
import AwPromiseService from 'js/awPromiseService';
import ac0CreateConvSvc from 'js/Ac0CreateCollabObjectService';
import convUtils from 'js/Ac0ConversationUtils';
import cmdPanelSvc from 'js/commandPanel.service';
import dissTileSvc from 'js/Ac0DiscussionTileService';
import convoSrv from 'js/Ac0ConversationService';
import _ from 'lodash';
import popupService from 'js/popupService';

var exports = {};
var editCommentCompleteEvtStr = 'ac0EditComm.editCommentComplete';

export let doEditConversationCell = function( subPanelContext, sharedData, commandContext ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.editConvCtx = subPanelContext; //this is the flag that determines if we are in edit mode for a discussion. Setting this to null will mean edit is either complete or discarded
    if( convCtx.activeCell ) {
        convCtx.activeCell.expandComments = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    //ac0ConvSvc.destroyActiveCellCkeEditor();
    createConvSvc.modifyCreateCtxFlagsForCollabObjs( true, false );
    if( convUtils.isDiscussionSublocation() ) {
        const { openAc0UniversalConvPanel } = commandContext;

        if( openAc0UniversalConvPanel ) {
            let options = {
                view: 'Ac0UniversalConversationPanel',
                parent: '.aw-layout-workarea',
                placement: 'right',
                width: 'SMALL',
                height: 'FULL',
                push: true,
                convCtx,
                isCloseVisible: false,
                subPanelContext: subPanelContext,
                commandid: 'Ac0ConvCellEditCommand',
                commandicon: 'cmdEdit'
            };
            openAc0UniversalConvPanel.show( options );
        } else {
            cmdPanelSvc.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo' );
        }
        // Close the popup once the Edit discussion panel is opened
        popupService.hide();
        return;
    }
    dissTileSvc.navigateToCreateCollabObjPanel( sharedData );
};

export let shareSnapshotInDiscussion = function( commandcontext, mode, entryPoint ) {
    var convCtx = convUtils.getAc0ConvCtx();
    //vmo passed in commandcontext differently for table view, image view in MyGallery
    if( commandcontext.selected ) {
        convCtx.currentSelectedSnapshot = commandcontext.selected[0];
    }else{
        convCtx.currentSelectedSnapshot = commandcontext.vmo;
    }
    convCtx.snapshotEntryPoint = entryPoint;
    if ( !convUtils.isMyGallerySublocation() ||  convUtils.isMyGallerySublocation() && mode === 'open' ) {
        convUtils.setSelectedObjectInConvContext();
    }
    if ( convUtils.isMyGallerySublocation() && mode === 'create' ) {
        convCtx.snapshotObjfnd0Roots = convCtx.currentSelectedSnapshot.props.fnd0Roots;
    }
    if( convCtx.activeCell ) {
        convCtx.activeCell.expandComments = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    //ac0ConvSvc.destroyActiveCellCkeEditor();
    createConvSvc.modifyCreateCtxFlagsForCollabObjs( true, false );
    convCtx.editConvCtx = null; //coming from create. Make this flag null.
    convCtx.snapMode = mode;
    var subPanelContext;
    var dialogAction;
    if ( commandcontext.subPanelContext && commandcontext.subPanelContext.subPanelContext ) {
        dialogAction  = commandcontext.subPanelContext.subPanelContext.dialogAction;
        subPanelContext = commandcontext.subPanelContext.subPanelContext;
    }else if( commandcontext.itemOptions && commandcontext.itemOptions.subPanelContext && commandcontext.itemOptions.subPanelContext.subPanelContext ) {
        dialogAction  = commandcontext.itemOptions.subPanelContext.subPanelContext.dialogAction;
        subPanelContext = commandcontext.itemOptions.subPanelContext.subPanelContext;
    }else if( commandcontext.dialogActionForContextMenu ) {
        dialogAction  = commandcontext.dialogActionForContextMenu;
        subPanelContext = convCtx;
    }
    //set value only when in fullScreen mode
    let isFullScreenMode;
    if( subPanelContext.fullScreenState  && subPanelContext.fullScreenState.value ) {
        isFullScreenMode = subPanelContext.fullScreenState.value;
    }

    if( dialogAction ) {
        let commandid = null;
        let commandicon = null;
        if( mode === 'create' ) {
            commandid = 'Ac0CreateDiscOnSnapshotCommand';
            if ( entryPoint === 'SnapshotProductGallery' ) {
                commandid = 'Ac0CreateDiscOnSnapshotPGCommand';
            }
            commandicon = 'cmdNewDiscussion';
        } else if( mode === 'open' ) {
            commandid = 'Ac0OpenDiscOnSnapshotCommand';
            if ( entryPoint === 'SnapshotProductGallery' ) {
                commandid = 'Ac0OpenDiscOnSnapshotPGCommand';
            }
            commandicon = 'cmdConversationPanel';
        }
        let options = {
            view: 'Ac0UniversalConversationPanel',
            parent: '.aw-layout-workarea',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            push: true,
            isCloseVisible: false,
            subPanelContext: subPanelContext,
            commandid: commandid,
            commandicon: commandicon
        };
        if( isFullScreenMode ) {
            options.push = false;
        }
        dialogAction.show( options );
    } else {
        cmdPanelSvc.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo', convCtx );
    }
};

export let doEditCommentCell = function( subPanelContext, sharedData, commentItemObj, ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var convCtx = convUtils.getAc0ConvCtx();
    if( convCtx.cmtEdit.activeCommentToEdit && convCtx.cmtEdit.activeCommentToEdit.beingEdited ) {
        convCtx.cmtEdit.activeCommentToEdit.beingEdited = false; //set existing activeComment beingEdited to false
    }
    if( convUtils.isDiscussionSublocation() && !commentItemObj )  {
        commentItemObj = ctx.newConvObj;
    }
    convCtx.cmtEdit.activeCommentToEdit = commentItemObj; //replace activeComment

    convCtx.cmtEdit.activeVMData = sharedData;
    convCtx.cmtEdit.activeConvObj = subPanelContext;
    convCtx.editConvCtx = null; //in case this var has been set when a discussion has been edited, reset it
    convCtx.cmtEdit.activeCommentToEdit.beingEdited = true;

    const newSharedData = { ...sharedData.value };
    newSharedData.beingEdited = true;
    sharedData.update && sharedData.update( newSharedData );

    if( commentItemObj.isRootComment && commentItemObj.discussionHasSnapshot ) {
        convCtx.cmtEdit.removedSnapshotObj = null; //cell in the process of being put into edit. No snapshot removed yet.
    } else {
        delete convCtx.cmtEdit.removedSnapshotObj;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    ac0CreateConvSvc.showRichTextEditor( sharedData, commentItemObj.commentCKEId, subPanelContext.ckeImgUploadEvent ).then( function( ckeInstance ) {
        var convContext = convUtils.getAc0ConvCtx();
        convContext.cmtEdit.activeCKEInstance = ckeInstance;
        ac0CreateConvSvc.setCkEditorData( commentItemObj.props.richText.displayValues[0], ckeInstance );
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convContext );
        //convContext.ckeInstance = ckeInstance;
        deferred.resolve( {} );
    } );
    return deferred.promise;
};

export let saveEditComment = function( commentObj, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    var convObj = convCtx.cmtEdit.activeConvObj;
    var richText = ac0CreateConvSvc.getRichText( convCtx.createCollabObjData.ckeInstance._instance );
    var plainText = ac0CreateConvSvc.getPlainText( convCtx.createCollabObjData.ckeInstance );
    var hasSnapshotBeenRemoved = convCtx.cmtEdit.removedSnapshotObj;
    return createConvSvc.postComment( convObj, richText, commentObj, null, hasSnapshotBeenRemoved ).then( function( response ) {
        var convContext = convUtils.getAc0ConvCtx();
        //Update the UI with the results returned from the server
        if( typeof response.data !== 'undefined'
            && typeof response.data.updateComment !== 'undefined'
            && typeof response.data.updateComment.createdOrUpdatedCollabObject !== 'undefined'
            && typeof response.data.updateComment.createdOrUpdatedCollabObject.collabRichText !== 'undefined' ) {
            richText = response.data.updateComment.createdOrUpdatedCollabObject.collabRichText;
        }
        convContext.cmtEdit.activeCommentToEdit.props.richText.displayValues[0] = richText;
        convContext.cmtEdit.activeCommentToEdit.beingEdited = false;
        convContext.cmtEdit.activeCKEInstance = null;
        convContext.cmtEdit.activeVMData = null;
        convContext.cmtEdit.activeConvObj = null;
        convCtx.cmtEdit.removedSnapshotObj = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
        createConvSvc.checkCKEInputTextValidityAndPublishEvent( convCtx.createCollabObjData.ckeInstance );
        dissTileSvc.navigateToDiscussionsPanel( sharedData );
        convoSrv.setupTileMoreLessSection( commentObj, richText, plainText );
        const newSharedData = { ...sharedData.value };
        newSharedData.beingEdited = false;
        sharedData.update && sharedData.update( newSharedData );
    }, function( error ) {
        eventBus.publish( editCommentCompleteEvtStr );
    } );
};

export let discardEditComment = function( commentObj, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.cmtEdit.activeCommentToEdit.beingEdited = false;
    convCtx.cmtEdit.activeCKEInstance = null;
    convCtx.cmtEdit.activeVMData = null;
    convCtx.cmtEdit.rootCmtObj = null;
    if( convCtx.cmtEdit.removedSnapshotObj ) {
        convCtx.cmtEdit.activeConvObj.props.inflatedRelatedObjList = convCtx.cmtEdit.removedSnapshotObj;
        commentObj.discussionHasSnapshot = true;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    createConvSvc.checkCKEInputTextValidityAndPublishEvent( convCtx.createCollabObjData.ckeInstance );
    //eventBus.publish( 'ac0EditComm.editCommentComplete' );
    const newSharedData = { ...sharedData.value };
    newSharedData.beingEdited = false;
    sharedData.update && sharedData.update( newSharedData );
};

/*
* @param {Object} vmData view model data
*/
export let editInDiscussionLoctionPanelReveal = function( vmData ) {
    vmData.activeView = 'Ac0CreateNewCollabObj';
};

export let removeSnapshotFromRootComment = function( commandcontext ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.cmtEdit.removedSnapshotObj = _.remove( commandcontext.commentDetails.props.inflatedRelatedObjList, function( relatedObj ) {
        commandcontext.commentDetails.discussionHasSnapshot = false;
        return relatedObj.type === 'Fnd0Snapshot';
    } );
    convCtx.validForSave = true;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    const newSharedData = { ...commandcontext.sharedData.value };
    commandcontext.sharedData.update && commandcontext.sharedData.update( newSharedData );
};

/**
 * Helper method with depricated way to copy text into the clipboard
 * @param {*} textToCopy The text to copy into the clipboard
 * @returns {bool} success value
 */
let depricatedCopyToClipboard = function( textToCopy ) {
    // Copy paste of tcClipboardService.copyContentToOSClipboard
    // however that method adds a '\n' after every character resulting
    // in a vertical line of single characters.
    var textArea = document.createElement( 'textarea' );

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em doesn't work as this gives a negative w/h on
    // some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';

    textArea.value = textToCopy;

    let refEle = document.activeElement;
    refEle.appendChild( textArea );

    textArea.focus();
    textArea.select();

    var verdict = document.execCommand( 'copy', false, null ); //execute copy command

    refEle.removeChild( textArea );

    return verdict;
};

/**
 * Copy the comment contents into the OS clipboard
 * @param {*} commentObj The comment object
 * @returns {bool} success
 */
export let copyCommentToOSClipboard = function( commentObj ) {
    // The previous way of copying content into the clipboard has been
    // depricated, however not all browsers support the new suggested way
    // of copying so we need to support both ways.

    // depending on where the user will be pasting into we need to have
    // either the rich txt or the plain txt
    var richTxtToCopy = commentObj.props.richText.displayValues[0];

    // Due to issues with image timeouts we need to exclude images from
    // the text to copy
    richTxtToCopy = richTxtToCopy.replace( /<img[^>]*>/g, '' );
    richTxtToCopy = richTxtToCopy.replace( /<img[^>]*\/>/g, '' );

    var textToCopy = commentObj.props.plainText.displayValues[0];
    var verdict = false;
    try{
        // This block of code will fail with a
        // DOMException : "Document is not focused"
        // if the browser dev tools are open and fall into
        // the function err block
        navigator.clipboard.write( [ new ClipboardItem( {
            'text/plain': new Blob( [ textToCopy ], { type: 'text/plain' } ),
            'text/html': new Blob( [ richTxtToCopy ], { type: 'text/html' } )
        } ) ] ).then( function() {
            verdict = true;
        }, function( err ) {
            verdict = depricatedCopyToClipboard( textToCopy );
        } );
    } catch ( e ) {
        verdict = depricatedCopyToClipboard( textToCopy );
    }

    return verdict;
};

/**
 * Ac0EditCollabObjectService factory
 */

export default exports = {
    doEditConversationCell,
    doEditCommentCell,
    saveEditComment,
    discardEditComment,
    editInDiscussionLoctionPanelReveal,
    shareSnapshotInDiscussion,
    removeSnapshotFromRootComment,
    copyCommentToOSClipboard
};
