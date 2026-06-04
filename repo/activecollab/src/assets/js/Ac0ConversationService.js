
// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0ConversationService
 */
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import uwPropSvc from 'js/uwPropertyService';
import vmoSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import createConvSvc from 'js/Ac0CreateCollabObjectService';
import dms from 'soa/dataManagementService';
import awIconSvc from 'js/awIconService';
import convUtils from 'js/Ac0ConversationUtils';
import policySvc from 'soa/kernel/propertyPolicyService';
import ac0NotySvc from 'js/Ac0NotificationService';
import ac0EditSvc from 'js/Ac0EditCollabObjectService';
import graphQLSvc from 'js/graphQLService';
import soaSvc from 'soa/kernel/soaService';
import declUtils from 'js/declUtils';
import dateTimeSvc from 'js/dateTimeService';
import msgSvc from 'js/messagingService';
import browserUtils from 'js/browserUtils';
import AwStateService from 'js/awStateService';
import dialogService from 'js/dialogService';
import adapterService from 'js/adapterService';

var exports = {};

var parentData = {};

var selectedConv = {};

export let feedLocationReveal = function( activeView ) {
    var newActiveViewVal = _.clone( activeView );
    newActiveViewVal = 'Ac0FeedSummary';
    return newActiveViewVal;
};

// ****************************************************************************
// Begin block of internally called functions
// Generally a function should be declared in a file before it is used.
// ****************************************************************************


/**
 * method to prepare comment cell. This method dresses up the 'root comment' cell as well as other comments.
 * For root comment, all params are passed. For individual comments, index and vmData are optional.
 * @param {*} vmObject ViewModelObject
 * @param {*} plainText plain text comment
 * @param {*} richText rich text comment
 * @param {*} index optional - index of root comment in conversation search result. Necessary for unique id in view.
 * @param {*} vmData optional - ViewModelData where Conversation resides. Needed for i18n strings
 */
var prepareCommentCellViewModelObject = function( vmObject, plainText, richText, index, vmData ) {
    //prep chip data section

    vmObject.isSourceObjVisible = false;
    vmObject.isParticipantObjVisible = false;

    setupTileSourceObjInfo( vmObject, index, vmData );

    return setupTileParticipantInfo( vmObject, index, vmData ).then( () => {
        //prep plainText/richText comment setion
        vmObject.props.curtailedComment = plainText;

        setupTileMoreLessSection( vmObject, richText, plainText );

        vmObject.hasThumbnail = false;
        if( vmObject.thumbnailUrl ) {
            vmObject.hasThumbnail = true;
        }

        if( vmObject.props.userName && vmObject.props.userName.displayValues[0] ) {
            vmObject.props.userName.displayValues[0] = vmObject.props.userName.displayValues[0].split( '(' )[0].trim();
        }

        var twentyFourHours = 24 * 60 * 60 * 1000;

        if( vmObject.props.modifiedDateTime && vmObject.props.modifiedDateTime.dbValues !== null ) {
            let timeInMs = Date.now();
            let conversationModifiedDateTime = new Date( vmObject.props.modifiedDateTime.dbValues ).getTime();
            if ( timeInMs - conversationModifiedDateTime  > twentyFourHours ) {
                vmObject.props.modifiedDateTime.displayValues[0] = vmObject.props.modifiedDateTime.displayValues[0].split( ' ' )[0];
            } else{
                vmObject.props.modifiedDateTime.displayValues[0] = new Date( vmObject.props.modifiedDateTime.dbValues ).toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit' } );
            }
        }
        //add ckeditor id ref to vmObject
        vmObject.ckEditorIdRef = 'ckeditor_cmtReply_' + index;

        //Update latest comment dateTime
        vmObject.hasReplies = false;
        vmObject.haslatestCommentThumbnail = false;
        if( vmObject.props.numReplies ) {
            if( vmObject.props.numReplies.dbValue > 0 && vmObject.props.latestCommentmodifiedDateTime ) {
                if( vmObject.latestCommentthumbnailUrl ) {
                    vmObject.haslatestCommentThumbnail = true;
                }
                vmObject.hasReplies = true;
                var plainTextLC = vmObject.props.latestCommentplainText ? vmObject.props.latestCommentplainText.displayValues[0] : '';
                var richTextLC = vmObject.props.latestCommentrichText ? vmObject.props.latestCommentrichText.displayValues[0] : '';
                if( typeof vmObject.props.latestCommentrichText !== 'undefined' ) {
                    vmObject.props.latestCommentrichText.displayValues[0] = richTextLC;
                }
                setupTileMoreLessSectionLC( vmObject, richTextLC, plainTextLC );
                if( vmObject.props.latestCommentmodifiedDateTime && vmObject.props.latestCommentmodifiedDateTime.dbValues !== null ) {
                    let timeInMs = Date.now();
                    let conversationModifiedDateTime = new Date( vmObject.props.latestCommentmodifiedDateTime.dbValues ).getTime();
                    if ( timeInMs - conversationModifiedDateTime  > twentyFourHours ) {
                        vmObject.props.latestCommentmodifiedDateTime.displayValues[0] = vmObject.props.latestCommentmodifiedDateTime.displayValues[0].split( ' ' )[0];
                    } else{
                        vmObject.props.latestCommentmodifiedDateTime.displayValues[0] = new Date( vmObject.props.latestCommentmodifiedDateTime.dbValues ).toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit' } );
                    }
                }
            }
        }
    } );
};

export let setupTileMoreLessSectionLC = function( vmObject, richText, plainText ) {
    vmObject.showMoreLC = false;
    vmObject.showMoreLinkLC = false;
    vmObject.showLessLinkLC = false;

    //prep more/less link section
    if( richText && richText.length > 0 ) {
        vmObject.props.latestCommentrichTextObject = convUtils.processRichText( richText );
        vmObject.showMoreLC = vmObject.props.latestCommentrichTextObject.showMore;
    }else {
        vmObject.props.latestCommentplainTextObject = convUtils.processPlainText( plainText );
        vmObject.showMoreLC = vmObject.props.latestCommentplainTextObject.showMore;
    }
    vmObject.showMoreLinkLC = vmObject.showMoreLC;
};

export let getInflatedSourceObjectList = function( srcObjUids, vmObject ) {
    //load objects in sourceObjectList and retrieve thumbnail for objects
    var deferred = AwPromiseService.instance.defer();
    if( srcObjUids.length > 0 ) {
        vmObject.props.srcObjUids = srcObjUids;
        vmObject.props.inflatedSrcObjList = [];
        return dms.loadObjects( srcObjUids ).then( function() {
            var totalNoOfpart = srcObjUids.length;
            for( var nn = 0; nn < totalNoOfpart; nn++ ) {
                var usrObj = cdm.getObject( srcObjUids[nn] );
                let vmo = vmoSvc.createViewModelObject( usrObj );
                vmObject.props.inflatedSrcObjList.push( vmo );
            }
            eventBus.publish( 'ac0ActionableFeedSummary.selectionChangeComplete' );
            eventBus.publish( 'ac0FeedSummary.selectionChangeComplete' );
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

var setupTileSourceObjInfo = function( vmObject, index, vmData ) {
    //for conversations-
    //display source obj chips only if
    //query returns sourceObjList and it is not an empty array and
    //if sourceObjList length is more than 1, then display
    //if sourceObjList length equals 1 and sourceObj returned isn't the selected context object, then display

    if( vmObject.props.sourceObjList && vmObject.props.sourceObjList.dbValues && vmObject.props.sourceObjList.dbValues.length > 0 ) {
        //setup isSourceObjVisible - > 1 || == 1 and not selected
        //setup chipData - > 1 || == 1 and not selected
        //setup chipData link - > 1 || == 1 and not selected
        //setup more srcObj link - > 1
        //setup more srcObj chips - > 1
        //setup more srcObj chips link
        vmObject.isSourceObjVisible = true;
        vmObject.srcObjIdRef = 'collabSrcObjs_' + index;
        vmObject.chipData.labelDisplayName = vmObject.props.sourceObjList.dbValues[0].object_string;
        vmObject.chipData.labelInternalName = vmObject.props.sourceObjList.dbValues[0].object_string;
        vmObject.chipData.objUid = vmObject.props.sourceObjList.dbValues[0].uid;
        vmObject.chipData.extendedTooltip = {
            extendedTooltipContent: vmObject.props.sourceObjList.dbValues[0].object_string
        };
        var srcObjUids = [];
        for( var ii = 0; ii < vmObject.props.sourceObjList.dbValues.length; ii++ ) {
            srcObjUids.push( vmObject.props.sourceObjList.dbValues[ii].uid );
        }
        getInflatedSourceObjectList( srcObjUids, vmObject );

        if( vmObject.props.sourceObjList.dbValues.length > 1 ) {
            var moreSourceObjPopupLinkString = '+ ' + ( vmObject.props.sourceObjList.dbValues.length - 1 ).toString() + ' ' + vmData.i18n.more;
            vmObject.moreSourceObjPopupLink = uwPropSvc.createViewModelProperty( 'moreSourceObj', moreSourceObjPopupLinkString, 'STRING', 'more' );
        }
        if( vmObject.props.sourceObjList.dbValues.length === 1 && vmObject.props.sourceObjList.dbValues[0].uid === convUtils.getObjectUID( appCtxSvc.getCtx( 'selected' ) ) ) {
            vmObject.isSourceObjVisible = false;
        }
    }
};

export let initMoreSourceObjPopup = ( sourceObjs, sourceObjChips ) => {
    var moreSrcObjList = sourceObjs.dbValues.slice( 1 );
    const newSourceObjChips = _.clone( sourceObjChips );
    for ( var ii = 0; ii < moreSrcObjList.length; ii++ ) {
        var moreSrcObjChip = {
            chipType: 'BUTTON',
            labelDisplayName: moreSrcObjList[ii].object_string,
            labelInternalName: moreSrcObjList[ii].object_string,
            objUid: moreSrcObjList[ii].uid,
            extendedTooltip: {
                extendedTooltipContent: moreSrcObjList[ii].object_string
            }
        };
        newSourceObjChips.srcObjChipList.push( moreSrcObjChip );
    }
    return newSourceObjChips;
};

export let initMoreParticipantPopup = ( participantUids, passedParticipants ) => {
    const newPassedParticipants = _.clone( passedParticipants );
    for( var mm = 3; mm < participantUids.length; mm++ ) {
        var moreUsrObj = cdm.getObject( participantUids[mm] );
        moreUsrObj.props.thumbnailUrl = awIconSvc.getThumbnailFileUrl( moreUsrObj );
        moreUsrObj.props.participantNameTooltip = {
            extendedTooltipContent: moreUsrObj.props.object_string.dbValues[0].split( '(' )[0].trim()
        };
        moreUsrObj.props.displayValue = {
            propertyDisplayName: moreUsrObj.props.object_string.dbValues[0].split( '(' )[0].trim(),
            type: 'STRING'
        };
        newPassedParticipants.participantIconList.push( moreUsrObj );
    }
    return newPassedParticipants;
};

var getInflatedParicipantObjectList = function( participantUids, vmObject ) {
    var deferred = AwPromiseService.instance.defer();
    if( participantUids.length > 0 ) {
        vmObject.props.participantUids = participantUids;
        vmObject.props.inflatedParticipantObjVMOList = [];
        return dms.loadObjects( participantUids ).then( function() {
            var totalNoOfpart = participantUids.length;
            for( var nn = 0; nn < totalNoOfpart; nn++ ) {
                var usrObj = cdm.getObject( participantUids[nn] );
                // Due to timing issues there may be times where
                // the usr object may have already been added
                // Double check this is not the case
                let addUsrObj = true;
                for( let ipolIdx = 0; ipolIdx < vmObject.props.inflatedParticipantObjVMOList.length; ipolIdx++ ) {
                    if( vmObject.props.inflatedParticipantObjVMOList[ipolIdx].uid === usrObj.uid ) {
                        addUsrObj = false;
                        break;
                    }
                }
                if( addUsrObj ) {
                    let vmo = vmoSvc.createViewModelObject( usrObj );
                    vmObject.props.inflatedParticipantObjVMOList.push( vmo );
                }
            }
            eventBus.publish( 'ac0ActionableFeedSummary.selectionChangeComplete' );
            eventBus.publish( 'ac0FeedSummary.selectionChangeComplete' );
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

var setupTileParticipantInfo = function( vmObject, index, vmData ) {
    var deferred = AwPromiseService.instance.defer();
    if( vmObject.props.participantObjList && vmObject.props.participantObjList.dbValues && vmObject.props.participantObjList.dbValues.length > 0 && vmObject.props.participantObjList.dbValues[0] ) {
        var participantUids = [];
        vmObject.participantIdRef = 'collabParticipants_' + index;
        for( var ii = 0; ii < vmObject.props.participantObjList.dbValues.length; ii++ ) {
            participantUids.push( vmObject.props.participantObjList.dbValues[ii].uid );
        }
        return getInflatedParicipantObjectList( participantUids, vmObject ).then( () => {
            if( participantUids.length > 0 ) {
                vmObject.props.participantUids = participantUids;
                vmObject.props.inflatedParticipantObjList = [];
                return dms.loadObjects( participantUids ).then( function() {
                    var totalNoOfVisibleParticipants = participantUids.length > 3 ? 3 : participantUids.length;
                    for( var nn = 0; nn < totalNoOfVisibleParticipants; nn++ ) { //total no. of participants to be visible initially
                        var usrObj = cdm.getObject( participantUids[nn] );
                        //Create Participant VMOs
                        usrObj.props.thumbnailUrl = awIconSvc.getThumbnailFileUrl( usrObj );
                        usrObj.props.hasThumbnail = true;
                        if( usrObj.props.object_string && usrObj.props.object_string.dbValues ) {
                            usrObj.props.participantNameTooltip = {
                                extendedTooltipContent: usrObj.props.object_string.dbValues[0].split( '(' )[0].trim()
                            };
                        }
                        // Due to timing issues there may be times where
                        // the usr object may have already been added
                        // Double check this is not the case
                        let addUsrObj = true;
                        for( var ipolIdx = 0; ipolIdx < vmObject.props.inflatedParticipantObjList.length; ipolIdx++ ) {
                            if( vmObject.props.inflatedParticipantObjList[ipolIdx].uid === usrObj.uid ) {
                                addUsrObj = false;
                                break;
                            }
                        }
                        if( addUsrObj ) {
                            vmObject.props.inflatedParticipantObjList.push( usrObj );
                        }
                    }
                    vmObject.isParticipantObjVisible = true;
                    if( vmObject.props.participantUids.length > 3 ) {
                        var moreParticipantPopupLinkString = '+ ' + ( vmObject.props.participantUids.length - 3 ).toString() + ' ' + vmData.i18n.more;
                        vmObject.moreParticipantPopupLink = uwPropSvc.createViewModelProperty( 'moreParticipant', moreParticipantPopupLinkString, 'STRING', 'more' );
                    }
                } );
            }
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

export let setupTileMoreLessSection = function( vmObject, richText, plainText ) {
    vmObject.showMore = false;
    vmObject.showMoreLink = false;
    vmObject.showLessLink = false;

    //prep more/less link section
    if( richText && richText.length > 0 ) {
        vmObject.props.richTextObject = convUtils.processRichText( richText );
        vmObject.showMore = vmObject.props.richTextObject.showMore;
    }else {
        vmObject.props.plainTextObject = convUtils.processPlainText( plainText );
        vmObject.showMore = vmObject.props.plainTextObject.showMore;
    }

    vmObject.showMoreLink = vmObject.showMore;
    vmObject.expandComments = false;
};

var setupMoreCmtCellCmdInfo = function( vmObject, index, performOwningUserVisibilityCheck ) {
    var indx = index ? index : 'AA';
    vmObject.showMoreCmtCellCmds = true;
    if( performOwningUserVisibilityCheck ) {
        vmObject.showMoreCmtCellCmds = vmObject.props.uid.dbValue === appCtxSvc.getCtx( 'user' ).uid;
    }
    vmObject.moreCmtCellCmdsIdRef = 'collabCmtCmd' + Math.floor( 10000000 * Math.random() ) + '_' + indx;
    vmObject.commentCKEId = 'collabCmtEdit' + Math.floor( 10000000 * Math.random() ) + '_' + indx;
    vmObject.ckeImgUploadEvent = 'ac0EditComm.insertImageInCKEditor_' + vmObject.commentCKEId;
    vmObject.beingEdited = false;
};

var setupCmtEditLink = function( vmObject, vmData, index ) {
    vmObject.doSaveEditComment = function( dpItem ) {
        ac0EditSvc.saveEditComment( dpItem );
    };
    vmObject.doDiscardEditComment = function( dpItem ) {
        ac0EditSvc.discardEditComment( dpItem );
    };
};

/**
 * Method that creates a VMO from the root comment properties
 * @param {*} convProps conversation properties
 * @returns {Object} ViewModelObject
 */
var createRootCommentVMO = function( convProps ) {
    var serverVMO = {
        props: {}
    };
    serverVMO.uid = convProps.rootCommentUID ? convProps.rootCommentUID.displayValues[0] : '';
    serverVMO.props[convProps.richText ? convProps.richText.propertyName : 'collabRichText'] = convProps.richText ? convProps.richText.displayValues[0] : '';
    serverVMO.props[convProps.plainText ? convProps.plainText.propertyName : 'collabPlainText'] = convProps.plainText ? convProps.plainText.displayValues[0] : '';
    return vmoSvc.constructViewModelObject( serverVMO );
};

/**
 * Return the source objects
 * @param {Object} data Data
 * @returns {Object} array of sourceObjects
 */
export let getSourceObjects = function( data ) {
    var sourceObjs = [];
    var sourceTags = data.srcObjChips ? data.srcObjChips : [];
    if( sourceTags ) {
        for ( var i = 0; i < sourceTags.length; i++ ) {
            if( sourceTags[i].theObject ) {
                var tmpObj = null;
                if( sourceTags[i].theObject.props ) {
                    var underlyingObj = adapterService.getAdaptedObjectsSync( [ sourceTags[i].theObject ] );
                    if( typeof underlyingObj !== 'undefined' ) {
                        tmpObj = {
                            uid: underlyingObj[0].uid,
                            type: underlyingObj[0].type
                        };
                    } else {
                        tmpObj = {
                            uid: sourceTags[i].theObject.uid,
                            type: sourceTags[i].theObject.type
                        };
                    }
                } else {
                    tmpObj = {
                        uid: sourceTags[i].theObject.uid,
                        type: sourceTags[i].theObject.objType
                    };
                }
                sourceObjs.push( tmpObj );
            }
        }
    }
    return sourceObjs;
};

/**
 * Return the source objects
 * @param {Object} data Data
 * @returns {Array} users
 */
export let getUserObjects = function( data ) {
    var userObjs = [];
    if( data.userChipsObj ) {
        var userTags = data.userChipsObj.userChips ? data.userChipsObj.userChips : parentData.userChips;
        if( userTags ) {
            for ( var i = 0; i < userTags.length; i++ ) {
                if( userTags[i].theObject ) {
                    var obj = {
                        uid: userTags[i].theObject.uid,
                        type: userTags[i].theObject.type
                    };
                    userObjs.push( obj );
                }
            }
        }
    }

    return userObjs;
};

/**
 * This method removes a chip from a chip array. Taken from chipShowCaseService.js
 * @param {*} chipArray array of chips from the chip dataprovider
 * @param {*} chipToRemove chip that needs to be removed
 */
export let removeSrcChipObj = function( chipArray, chipToRemove, sharedData ) {
    if( chipToRemove ) {
        _.pullAllBy( chipArray, [ { labelDisplayName: chipToRemove.labelDisplayName } ], 'labelDisplayName' );
        const newSharedData = { ...sharedData.value };
        _.remove( newSharedData.addedSourceObjects, ( srcObj ) => {
            return srcObj.uid === chipToRemove.theObject.uid;
        } );

        // Lets keep track of the objects we have removed in the sharedData
        // This is primarily used to prevent the discussion panels selectedObj
        // from being re-added after moving to a subpanel if removed.
        // Note: This should be a 'Set' as this would make sure duplicates are
        // not added by mistake but our implementation apparently does not
        // support Sets correctly so we need to use Arrays
        if( !newSharedData.removedSourceObjects ) {
            newSharedData.removedSourceObjects = [];
        }
        _.remove( newSharedData.removedSourceObjects, ( srcObj ) => {
            return srcObj.uid === chipToRemove.theObject.uid;
        } );
        newSharedData.removedSourceObjects.push( chipToRemove.theObject.uid );

        let convCtx = convUtils.getAc0ConvCtx();
        if( convCtx.editConvCtx ) {
            _.remove( convCtx.editConvCtx.props.sourceObjList.dbValues, ( srcObj ) => {
                return srcObj.uid === chipToRemove.theObject.uid;
            } );
            appCtxSvc.updateCtx( 'Ac0ConvCtx.editConvCtx', convCtx.editConvCtx );
        }

        if ( convCtx.snapshotObjfnd0Roots && convCtx.currentSelectedSnapshot ) {
            if( chipToRemove.labelDisplayName === convCtx.currentSelectedSnapshot.props.fnd0Roots.displayValues[0] ) {
                convCtx.snapshotObjfnd0Roots = null;
            }
        }
        sharedData.update && sharedData.update( newSharedData );
        eventBus.publish( 'Ac0.validateParticipantSourceReadAccess' );
    }
};

/**
 * This method removes a chip from a chip array. Taken from chipShowCaseService.js
 * @param {*} userChipsObj array of chips from the chip dataprovider
 * @param {*} chipToRemove chip that needs to be removed
 * @param {*} convType type of conversation
 * @param {*} showWarnOnRemovingUserMsg type of conversation
 */
export let removeUserChipObj = function( userChipsObj, chipToRemove, convType, showWarnOnRemovingUserMsg, sharedData ) {
    const newShowWarnOnRemovingUserMsg = showWarnOnRemovingUserMsg ? _.clone( showWarnOnRemovingUserMsg ) : {};
    const newUserChipsObj = userChipsObj.userChips ? _.clone( userChipsObj ) : {};
    _.pullAllBy( newUserChipsObj.userChips, [ { labelDisplayName: chipToRemove.labelDisplayName } ], 'labelDisplayName' );
    const newSharedData = { ...sharedData.value };
    _.remove( newSharedData.addedUserObjects, ( usrObj ) => {
        return usrObj.theObject.uid === chipToRemove.theObject.uid;
    } );
    if( convType && convType.dbValue === 'message' && typeof chipToRemove.theObject.modelType !== 'undefined' && chipToRemove.theObject.modelType.typeHierarchyArray.indexOf( 'User' ) > -1 ) {
        var user = appCtxSvc.getCtx( 'user' );
        var chipExisted = _.find( newUserChipsObj.userChips, function( chip ) {
            return chip.theObject.uid === user.uid;
        } );
        if( !chipExisted ) {
            newShowWarnOnRemovingUserMsg.dbValue = true;
        }
    }

    sharedData.update && sharedData.update( newSharedData );
    eventBus.publish( 'Ac0.validateParticipantSourceReadAccess' );
    return {
        showWarnOnRemovingUserMsg: newShowWarnOnRemovingUserMsg,
        userChipsObj: newUserChipsObj
    };
};

let helperOverriddenObjProductGallery = function( selectionData, splPurposeViewObj, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    var currentSelection;
    //Product Gallery usecase, when we open discussion from snapshot.
    if( convCtx.currentSelectedSnapshot ) {
        currentSelection = convCtx.currentSelectedSnapshot;
    }

    if( !currentSelection && sharedData.overridedSelectedObj ) {
        return sharedData.overridedSelectedObj;
    }
    return currentSelection;
};

let helperDetermineIfSelectionObjIsOverridden = function( selectionData, splPurposeViewObj, sharedData ) {
    var currentSelection;
    var convCtx = convUtils.getAc0ConvCtx();
    if( convCtx?.snapshotEntryPoint === 'SnapshotProductGallery' ) {
        return helperOverriddenObjProductGallery( selectionData, splPurposeViewObj, sharedData );
    }
    if( typeof selectionData === 'undefined' && typeof splPurposeViewObj !== 'undefined' ) {
        currentSelection = vmoSvc.constructViewModelObjectFromModelObject( splPurposeViewObj );
    }

    // First check if we need to reset the panel selection override
    // This is when an override of the panels selected object has been set but
    // a different object has been set in the PWA
    if( selectionData ) {
        let isSelectedDataPresent = Boolean( selectionData.value && selectionData.value.selected && selectionData.value.selected[0] );

        if(  sharedData.currentPanelObjSelection && isSelectedDataPresent && selectionData.value.selected[0].uid !== sharedData.currentPanelObjSelection.uid ) {
            let sharedDataValue = { ...sharedData.getValue() };
            delete sharedDataValue.currentPanelObjSelection;
            sharedData.update( sharedDataValue );
        }
        if( sharedData.currentPanelHostedObjSelection && isSelectedDataPresent && selectionData.value.selected[0].uid !== sharedData.currentPanelHostedObjSelection.uid  ) {
            let sharedDataValue = { ...sharedData.getValue() };
            delete sharedDataValue.currentPanelHostedObjSelection;
            sharedData.update( sharedDataValue );
        }

        if( isSelectedDataPresent ) {
            currentSelection = selectionData.value.selected[0];
        }
    }
    let useOverrideObj = Boolean( currentSelection && sharedData.currentPanelObjSelection && currentSelection.uid === sharedData.currentPanelObjSelection.uid && sharedData.selectedObj );
    let useOverrideObjHosted = Boolean( currentSelection && sharedData.currentPanelHostedObjSelection && currentSelection.uid === sharedData.currentPanelHostedObjSelection.uid && sharedData.selectedObj );

    if( useOverrideObj ) {
        return sharedData.overridedSelectedObj;
    }
    if( useOverrideObjHosted ) {
        return sharedData.overridedSelectedObj;
    }

    if( !useOverrideObj && !useOverrideObjHosted ) {
        delete sharedData.overridedSelectedObj;
    }

    return currentSelection;
};

/**
 * Method that handles selection change updates
 * @param {*} isHostedComponent is this a hosted model component
 * @param {*} selModelObj selected model object
 * @param {*} sharedData data shared between viewmodels
 */
export let loadVMOFodHostedComponent = function( isHostedComponent, selModelObj, sharedData ) {
    var deferred = AwPromiseService.instance.defer();
    if( isHostedComponent && selModelObj ) {
        let selModelObjVMO = vmoSvc.constructViewModelObjectFromModelObject( selModelObj );
        if( typeof sharedData.selectedObj === 'undefined' ) {
            var newSharedData = { ...sharedData.value };
            newSharedData.selectedObj = selModelObj;
            sharedData.update( newSharedData );
        }
        appCtxSvc.registerCtx( 'selected', selModelObjVMO );
        deferred.resolve( selModelObjVMO );
    }
};

let setPropertiesForVMO = function( newSelectedObjData ) {
    if( newSelectedObjData.cellHeader1 ) {
        newSelectedObjData.dbValue = newSelectedObjData.cellHeader1;
        newSelectedObjData.uiValue = newSelectedObjData.cellHeader1;
        newSelectedObjData.dispValue = newSelectedObjData.cellHeader1;
        newSelectedObjData.dbValues = [ newSelectedObjData.cellHeader1 ];
        newSelectedObjData.uiValues = [ newSelectedObjData.cellHeader1 ];
        return;
    }
    dmSvc.getProperties( [ newSelectedObjData.uid ], [ 'object_name' ] ).then( function( response ) {
        var underlyingObj = cdm.getObject( newSelectedObjData.uid );
        var dbStringValue;
        if( underlyingObj.props.object_name && underlyingObj.props.object_name.dbValues ) {
            dbStringValue = underlyingObj.props.object_name.dbValues[0];
        } else if ( underlyingObj.props.object_string.dbValues ) {
            dbStringValue = underlyingObj.props.object_string.dbValues[0];
        }
        newSelectedObjData.dbValue = dbStringValue;
        newSelectedObjData.uiValue = dbStringValue;
        newSelectedObjData.dispValue = dbStringValue;
        newSelectedObjData.dbValues = [ dbStringValue ];
        newSelectedObjData.uiValues = [ dbStringValue ];
        var tempObjForIconURL = vmoSvc.constructViewModelObjectFromModelObject( newSelectedObjData );
        if( !newSelectedObjData.typeIconURL && tempObjForIconURL.typeIconURL ) {
            newSelectedObjData.typeIconURL = tempObjForIconURL.typeIconURL;
        }
    } );
};

let helperOnObjTabSelChangeUpdateShareData = function( newSelectedObjData, sharedData ) {
    let sharedDataValue = { ...sharedData.getValue() };
    if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
        sharedDataValue.currentSelectedSnapshot = null;
    }
    sharedDataValue.selectedObj = newSelectedObjData;
    sharedData.update( sharedDataValue );
};

let helperOnObjTabSelChangeHandleSnapshot = function( selectionDataObj, selectionData, convCtx, selObjVm, deferred ) {
    var ctxObjUid = selectionDataObj.uid;
    let objects = [];
    var modeldObj = cdm.getObject( ctxObjUid );
    objects.push( modeldObj );

    const input = {
        objects: objects,
        attributes: [ 'fnd0OwningIdentifier' ]
    };

    soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then( function( response ) {
        let selectedObj = _.filter( response.modelObjects, { type: 'Fnd0Snapshot' } );
        var dbStringValue = selectedObj[0].props.fnd0OwningIdentifier.dbValues[0];
        var uiStringValue = selectedObj[0].props.fnd0OwningIdentifier.uiValues[0];
        selectedObj[0].props.fnd0OwningIdentifier.dbValue = dbStringValue;
        selectedObj[0].props.fnd0OwningIdentifier.uiValue = uiStringValue;
        appCtxSvc.registerCtx( 'selected', selectedObj[0] );
        deferred.resolve( selectedObj[0] );
    } );

    if( selectionData && !selectionData.selected && convCtx.currentSelectedSnapshot && convCtx.snapshotEntryPoint === 'SnapshotProductGallery' ) {
        selObjVm = convCtx.currentSelectedSnapshot;
    }
};

let helperOnObjTabSelChangeHandleSplitViewVMO = function( splitViewVMO, splPurposeViewObj, selObjVm ) {
    splitViewVMO = vmoSvc.constructViewModelObjectFromModelObject( splPurposeViewObj );
    if( splitViewVMO ) {
        selObjVm = splitViewVMO;
    }
};

/**
 * Method that handles selection change updates
 * @param {ViewModelProperty} selObjVm The selected object from the Data
 * @param {Object} selectionData The selected object from the objTabData
 * @param {Object} sharedData Panels shared data
 * @param {ViewModelObject} splPurposeViewObj The ctx selected data
 * @returns {*} deferred promise
 */
export let onObjectTabSelectionChange = function( selObjVm, selectionData, sharedData, splPurposeViewObj ) {
    var deferred = AwPromiseService.instance.defer();
    var convCtx = convUtils.getAc0ConvCtx();
    var ctx = appCtxSvc.getCtx();
    let splitViewVMO;

    // First check if the selectionData 'selected' object is set.
    // If it is ensure the selected object has the 'fnd0OwningIdentifier' property loaded.
    let selectionDataObj = helperDetermineIfSelectionObjIsOverridden( selectionData, splPurposeViewObj, sharedData );

    //When user unselects an obj delete/cleanup panel
    if( typeof selectionDataObj === 'undefined' ) {
        delete sharedData.selectedObj;
        delete sharedData.overridedSelectedObj;

        return deferred.promise;
    }

    if( selectionDataObj && selectionDataObj.type && selectionDataObj.type === 'Fnd0Snapshot' ) {
        helperOnObjTabSelChangeHandleSnapshot( selectionDataObj, selectionData, convCtx, selObjVm, deferred );
    } else if( splPurposeViewObj && ctx.splitView && ctx.splitView.mode ) {
        helperOnObjTabSelChangeHandleSplitViewVMO( splitViewVMO, splPurposeViewObj, selObjVm );
    }

    if( selectionData && selectionData.selected && selectionData.selected[0] && !splitViewVMO ) {
        selObjVm = selectionData.selected[0];
    }else if( selectionData && selectionData.value && selectionData.value.selected && selectionData.value.selected[0] && !splitViewVMO ) {
        selObjVm = selectionData.value.selected[0];
    }

    //Update the context first
    // TODO: this is not actually setting the selected obj to null should this be removed or should it actually be setting to null?
    convUtils.setSelectedObjectInConvContext( null );

    var newSelectedObjData = _.clone( selObjVm );

    // Did the user use the 'select
    if( sharedData.overridedSelectedObj ) {
        newSelectedObjData = _.clone( sharedData.overridedSelectedObj );
    }

    if( selectionDataObj && selectionDataObj.props &&
        selectionDataObj.props.awb0UnderlyingObject && selectionDataObj.props.awb0UnderlyingObject.dbValues[0] !== null ) {
        // The currently selected object has an underlying object.
        // in this usecase the underlying object is the prefered objet to use for discusssions
        // var underlyingUid = selectionDataObj.props.awb0UnderlyingObject.dbValues[0];
        newSelectedObjData.uid = selectionDataObj.props.awb0UnderlyingObject.dbValues[0];
        setPropertiesForVMO( newSelectedObjData );
        convCtx.selected = newSelectedObjData;
        deferred.resolve( newSelectedObjData );
    } else {
        //Then update the passed in vm data
        if( !newSelectedObjData.cellHeader1 || !newSelectedObjData.typeIconURL ) {
            newSelectedObjData = vmoSvc.constructViewModelObjectFromModelObject( newSelectedObjData );
        }
        setPropertiesForVMO( newSelectedObjData );

        convCtx.selected = newSelectedObjData;

        const newSelectedObjData2 = _.clone( newSelectedObjData );
        deferred.resolve( newSelectedObjData, newSelectedObjData2 );
    }

    if( sharedData ) {
        helperOnObjTabSelChangeUpdateShareData( newSelectedObjData, sharedData );
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    return deferred.promise;
};

/**
 * Determine if the user has permission to use the delete command
 */
export let deleteCommandValidForCurrentGroupRole = function() {
    var convCtx =  convUtils.getAc0ConvCtx();
    if( typeof convCtx.deleteCommandValidForCurrentGroupRole !== 'undefined' ) {
        return convCtx.deleteCommandValidForCurrentGroupRole;
    }

    var ctxDeletePrefVerdict = false;
    var prefValueArray = appCtxSvc.getCtx( 'preferences' ).Ac0DeleteDiscussionGroupRole;
    for( var i = 0; i < prefValueArray.length; i++ ) {
        var delDiscGroupRole = prefValueArray[i];
        var groupVal = delDiscGroupRole.split( '/' )[0];
        var roleVal = delDiscGroupRole.split( '/' )[1];
        if( appCtxSvc.getCtx( 'userSession' ).props.group_name.dbValue === groupVal && appCtxSvc.getCtx( 'userSession' ).props.role_name.dbValue === roleVal ) {
            ctxDeletePrefVerdict = true;
            break;
        }
    }

    convCtx.deleteCommandValidForCurrentGroupRole = ctxDeletePrefVerdict;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

    return ctxDeletePrefVerdict;
};

/**
 * Method that modifies conversations before display.
 * @param {*} vmData view model data that contains conversation search results
 */
export let modifyConversations = function( vmData, discussionsLoadedState ) {
    var deferred = AwPromiseService.instance.defer();
    const discussionSearchResults = _.clone( vmData.searchResults );
    const discussionsLoadedStateNew = _.clone( discussionsLoadedState );
    var ctxDeletePrefVerdict = deleteCommandValidForCurrentGroupRole();
    var commentPromiseArray = [];
    if( discussionSearchResults && discussionSearchResults.length === 0 ) {
        deferred.resolve( {} );
        return deferred.promise;
    }
    if ( discussionSearchResults ) {
        for ( var ii = 0; ii < discussionSearchResults.length; ii++ ) {
            discussionSearchResults[ii].chipData = {
                chipType: 'BUTTON',
                labelDisplayName: '',
                labelInternalName: '',
                objUid: ''
            };

            var plainText = discussionSearchResults[ii].props.plainText ? discussionSearchResults[ii].props.plainText.displayValues[0] : '';
            var richText = discussionSearchResults[ii].props.richText ? discussionSearchResults[ii].props.richText.displayValues[0] : '';
            if( typeof vmData.searchResults[ii].props.richText !== 'undefined' ) {
                vmData.searchResults[ii].props.richText.displayValues[0] = richText;
            }
            commentPromiseArray.push( prepareCommentCellViewModelObject( discussionSearchResults[ii], plainText, richText, ii, vmData ) );
        }
    }
    Promise.all( commentPromiseArray ).then( ( values ) => {
        for( var ii = 0; ii < values.length; ii++ ) {
            discussionSearchResults[ii].isRootComment = true;

            var replyLinkString = '';
            var replyNums = discussionSearchResults[ii].props.numReplies ? discussionSearchResults[ii].props.numReplies.dbValue : '0';
            if( replyNums === 1 ) {
                replyLinkString = replyNums + ' ' + vmData.i18n.reply;
            }else {
                replyLinkString = replyNums + ' ' + vmData.i18n.replies;
            }

            discussionSearchResults[ii].followConvLink = uwPropSvc.createViewModelProperty( 'followConv', vmData.i18n.follow, 'STRING', 'follow' );
            discussionSearchResults[ii].doFollowConv = function( dpItem ) {
                //teardown when comments are collapsed - make cursorStartIndx undefined
                if( dpItem.showFollowConv ) { //if show follow is true, then we need to follow
                    ac0NotySvc.collabSubscribeToConversation( dpItem ).then( function( responseData ) {
                        dpItem.showFollowConv = !dpItem.showFollowConv;
                    } );
                }else {
                    ac0NotySvc.collabUnSubscribeToConversation( dpItem ).then( function( responseData ) {
                        dpItem.showFollowConv = !dpItem.showFollowConv;
                    } );
                }
            };
            discussionSearchResults[ ii ].isConvActionable = Boolean( vmData.searchResults[ ii ].props.convStatus && discussionSearchResults[ ii ].props.convStatus.dbValue !== '' );
            discussionSearchResults[ ii ].convStatusModifiable = discussionSearchResults[ ii ].isConvActionable && checkIfLoggedInUserIsParticipant( discussionSearchResults[ ii ] );
            discussionSearchResults[ii].unfollowConvLink = uwPropSvc.createViewModelProperty( 'unfollowConv', vmData.i18n.unfollow, 'STRING', 'unfollow' );
            discussionSearchResults[ii].showFollowConv = !vmData.searchResults[ii].props.isConvNotificationSubscribed.dbValue;
            discussionSearchResults[ii].showDeleteLink = ctxDeletePrefVerdict;
            //discussionSearchResults[ii].showDeleteLink = true;
            if ( discussionSearchResults[ ii ].props.collabRelatedObjectInfo ) {
                var hasUid = Boolean( vmData.searchResults[ ii ].props.collabRelatedObjectInfo.dbValue[0] !== null );
                discussionSearchResults[ ii ].discussionHasSnapshot = Boolean( vmData.searchResults[ ii ].props.collabRelatedObjectInfo.dbValue.length > 0 && hasUid );
                discussionSearchResults[ ii ].convViewSnapshotPerm = vmData.searchResults[ ii ].discussionHasSnapshot && checkIfLoggedInUserIsParticipant( vmData.searchResults[ ii ] );
            }
            discussionSearchResults[ii].deleteConvLink = uwPropSvc.createViewModelProperty( 'deleteConv', vmData.i18n.delete, 'STRING', 'delete' );
            discussionSearchResults[ii].doDeleteConv = function( dpItem ) {
                eventBus.publish( 'Ac0.initiateDeleteConversationEvent', dpItem );
            };
            //more commands command
            discussionSearchResults[ii].showMoreCellCmds = true;
            discussionSearchResults[ii].moreCellCmdsIdRef = 'collabMoreCellCmds_' + ii;
            // discussionSearchResults[ii].doShowMoreCmds = function( dpItem ) {
            var ac0ConvCtx = convUtils.getAc0ConvCtx();
            if( typeof ac0ConvCtx.convDP === 'undefined' || ac0ConvCtx.convDP && typeof ac0ConvCtx.convDP.viewModelCollection === 'undefined' || ac0ConvCtx.convDP && ac0ConvCtx.convDP.viewModelCollection === null ) {
                ac0ConvCtx.convDP = vmData.dataProviders.conversationDataProvider;
                appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
            }
            // };
            setupMoreCmtCellCmdInfo( discussionSearchResults[ii], ii, true );
            setupCmtEditLink( discussionSearchResults[ii], vmData, ii );
            discussionSearchResults[ii].moreDesc = {
                extendedTooltipContent: vmData.i18n.more
            };
            discussionSearchResults[ii].followConvDesc = {
                extendedTooltipContent: vmData.i18n.followConvDesc
            };
            discussionSearchResults[ii].unFollowConvDesc = {
                extendedTooltipContent: vmData.i18n.unFollowConvDesc
            };
            discussionSearchResults[ii].rootCommentObj = createRootCommentVMO( discussionSearchResults[ii].props );
            discussionSearchResults[ii].showConvCellCmds = false;
            discussionSearchResults[ii].latestCommentDetails = {};
            discussionSearchResults[ii].latestCommentDetails.hasThumbnail = discussionSearchResults[ii].haslatestCommentThumbnail;
            discussionSearchResults[ii].latestCommentDetails.thumbnailUrl = discussionSearchResults[ii].latestCommentthumbnailUrl;
            discussionSearchResults[ii].latestCommentDetails.props = {};
            discussionSearchResults[ii].latestCommentDetails.props.userName = discussionSearchResults[ii].props.latestCommentuserName;
            if( discussionSearchResults[ii].latestCommentDetails.props.userName ) {
                discussionSearchResults[ii].latestCommentDetails.props.userName.displayValues[0] = discussionSearchResults[ii].props.latestCommentuserName.displayValues[0].split( '(' )[0].trim();
            }
            discussionSearchResults[ii].latestCommentDetails.props.userId = discussionSearchResults[ii].props.latestCommentuserId;
            discussionSearchResults[ii].latestCommentDetails.props.modifiedDateTime = discussionSearchResults[ii].props.latestCommentmodifiedDateTime;
            discussionSearchResults[ii].latestCommentDetails.props.plainText = discussionSearchResults[ii].props.latestCommentplainText;
            discussionSearchResults[ii].latestCommentDetails.props.richText = discussionSearchResults[ii].props.latestCommentrichText;
            discussionSearchResults[ii].latestCommentDetails.props.richTextObject = discussionSearchResults[ii].props.latestCommentrichTextObject;
            discussionSearchResults[ii].latestCommentDetails.props.rootCommentUID = discussionSearchResults[ii].props.latestCommentrootCommentUID;
            discussionSearchResults[ii].latestCommentDetails.showMore = discussionSearchResults[ii].showMoreLC;
            discussionSearchResults[ii].latestCommentDetails.showMoreLink = discussionSearchResults[ii].showMoreLinkLC;
            discussionSearchResults[ii].latestCommentDetails.showLessLink = discussionSearchResults[ii].showLessLinkLC;
            discussionSearchResults[ii].latestCommentDetails.props.latestCommentautoMsgType = discussionSearchResults[ii].props.latestCommentautoMsgType;
            delete discussionSearchResults[ii].props.latestCommentautoMsgType;
        }

        if( discussionsLoadedStateNew ) {
            discussionsLoadedStateNew.isDataLoaded = true;
        }
        deferred.resolve( {
            searchResults: discussionSearchResults,
            discussionsLoadedState: discussionsLoadedStateNew
        } );
    } );
    return deferred.promise;
};

/**
 * Method that checks if logged in user is participant in given conversation
 * @param {*} convObj conversation vmo
 * @param {*} currentCommentCtx current comment context used to control reply box visibility
 */
export let checkIfLoggedInUserIsParticipant = function( convObj ) {
    var loggedInUserIsParticipant = false;
    var currentUserUid = appCtxSvc.getCtx( 'user' ).uid;
    var participantsArray = convObj.props.participantObjList.dbValue;

    if( participantsArray && participantsArray.length > 0 ) {
        for( var i = 0; i < participantsArray.length; i++ ) {
            var participant = participantsArray[ i ];
            if( participant && participant.uid === currentUserUid ) {
                loggedInUserIsParticipant = true;
                break;
            }
        }
    }
    return loggedInUserIsParticipant;
};

/**
 * Method that modifies comments within a conversation tile before display.
 * @param {*} vmData view model data
 * @param {*} currentCommentCtx current comment context used to control reply box visibility
 */
export let modifyComments = function( vmData ) {
    if( typeof vmData !== 'undefined' && typeof vmData.searchResults !== 'undefined' ) {
        for( var ii = 0; ii < vmData.searchResults.length; ii++ ) {
            var plainText = vmData.searchResults[ii].props.plainText ? vmData.searchResults[ii].props.plainText.displayValues[0] : null;
            var richText = vmData.searchResults[ii].props.richText ? vmData.searchResults[ii].props.richText.displayValues[0] : null;
            if( typeof vmData.searchResults[ii].props.richText !== 'undefined' ) {
                vmData.searchResults[ii].props.richText.displayValues[0] = richText;
            }
            prepareCommentCellViewModelObject( vmData.searchResults[ii], plainText, richText, null, vmData );
            setupMoreCmtCellCmdInfo( vmData.searchResults[ii], ii, true );
            setupCmtEditLink( vmData.searchResults[ii], vmData, ii );
        }
        vmData.commentsDataProviderNotCalled = false;
    }
};

/**
 * Method that invokes post comment action once reply button is clicked. Does some post processing to update dp on the fly
 * @param {*} convObj conversation object
 * @param {*} vmData view model data
 * @returns {*} Promise
 */

export let replyBoxAction = function( discussionItem, cke, discussionData, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    // if( typeof convObj.ckeInstance === 'undefined' ) {
    //     convObj.ckeInstance = vmData.ckeInstance;
    // }
    var ckeText = createConvSvc.getRichText( cke._instance );
    var respRichText;
    //if reply button is clicked without any text, return
    if( _.isNull( ckeText ) ) {
        deferred.resolve( {} );
        return deferred.promise;
    }
    var policyDef = {
        types: [  {
            name: 'Ac0Comment',
            properties: [ {
                name: 'awp0CellProperties'
            }, {
                name: 'ac0CreateDate'
            }, {
                name: 'ac0DateModified'
            }, {
                name: 'ac0RichText'
            } ]
        } ]
    };
    var policyId = policySvc.register( policyDef );
    createConvSvc.postComment( discussionItem, ckeText ).then( function( responseData ) {
    //createConvSvc.postComment( discussionItem, ckeText, undefined, vmData ).then( function( responseData ) {
        if( policyId ) {
            policySvc.unregister( policyId );
        }
        const newCommentsReplyObj = { ...discussionData.getValue() };
        var vms = newCommentsReplyObj.loadedCommentsObject.loadedComments;
        var svmo = {
            props: {
                richText: '',
                plainText: '',
                modifiedDateTime: ''
            }
        };
        svmo.uid = 'temp888OBJ144';
        svmo.type = 'Ac0Comment';
        var newCommentObj = vmoSvc.constructViewModelObject( svmo );
        newCommentObj.props.plainText = {};
        newCommentObj.props.plainText.displayValues = [];
        newCommentObj.props.richText = {};
        newCommentObj.props.richText.displayValues = [];
        newCommentObj.props.modifiedDateTime = {};
        newCommentObj.props.modifiedDateTime.displayValues = [];
        newCommentObj.props.modifiedDateTime.dbValues = '';
        newCommentObj.props.plainText.displayValues.push( createConvSvc.getPlainText( cke ) );
        //Handle the response when creating
        if( responseData && !_.isEmpty( responseData.data.createComment ) && !_.isEmpty( responseData.data.createComment.createdOrUpdatedCollabObject ) &&
        responseData.data.createComment.createdOrUpdatedCollabObject.collabPlainText &&
        responseData.data.createComment.createdOrUpdatedCollabObject.collabPlainText.length > 0 ) {
            newCommentObj.props.modifiedDateTime.displayValues.push( responseData.data.createComment.createdOrUpdatedCollabObject.collabDateModified );
            newCommentObj.props.modifiedDateTime.dbValues = responseData.data.createComment.createdOrUpdatedCollabObject.collabDateModified;
            respRichText = responseData.data.createComment.createdOrUpdatedCollabObject.collabRichText;
            newCommentObj.props.richText.displayValues.push( responseData.data.createComment.createdOrUpdatedCollabObject.collabRichText );
            newCommentObj.uid = responseData.data.createComment.createdOrUpdatedCollabObject.uid;
            newCommentObj.type = responseData.data.createComment.createdOrUpdatedCollabObject.type;
        }

        //Handle the response when updating
        if( responseData && !_.isEmpty( responseData.data.updateComment ) && !_.isEmpty( responseData.data.updateComment.createdOrUpdatedCollabObject ) &&
        responseData.data.updateComment.createdOrUpdatedCollabObject.collabPlainText &&
        responseData.data.updateComment.createdOrUpdatedCollabObject.collabPlainText.length > 0 ) {
            newCommentObj.props.modifiedDateTime.displayValues.push( responseData.data.updateComment.createdOrUpdatedCollabObject.collabDateModified );
            newCommentObj.props.modifiedDateTime.dbValues = responseData.data.updateComment.createdOrUpdatedCollabObject.collabDateModified;
            respRichText = responseData.data.updateComment.createdOrUpdatedCollabObject.collabRichText;
            newCommentObj.props.richText.displayValues.push( responseData.data.updateComment.createdOrUpdatedCollabObject.collabRichText );
            newCommentObj.uid = responseData.data.updateComment.createdOrUpdatedCollabObject.uid;
            newCommentObj.type = responseData.data.updateComment.createdOrUpdatedCollabObject.type;
        }
        var tempVMData = {
            i18n: {
                more: 'More',
                less: 'Less'
            }
        };
        prepareCommentCellViewModelObject( newCommentObj, null, respRichText, null, tempVMData );
        setupMoreCmtCellCmdInfo( newCommentObj, null, false );
        setupCmtEditLink( newCommentObj );

        var currentUserObj = appCtxSvc.getCtx( 'user' );
        newCommentObj.props.userName = {
            displayValues: [ '' ]
        };
        newCommentObj.hasThumbnail = false;
        newCommentObj.thumbnailUrl = '';

        if( currentUserObj.props && currentUserObj.props.user_name ) {
            newCommentObj.props.userName.displayValues[0] = currentUserObj.props.user_name.dbValue;
        }

        if( currentUserObj.thumbnailURL ) {
            newCommentObj.hasThumbnail = true;
            newCommentObj.thumbnailUrl = currentUserObj.thumbnailURL;
        }
        vms.push( newCommentObj );
        //newCommentsReplyObj.loadedCommentsObject.loadedComments.push( vms );
        discussionData.update( newCommentsReplyObj );
        // const newReplyStrObj = { ...replyStrObj.value };
        // newReplyStrObj.repliesString = vms.length === 1 ? vms.length + ' ' + i18n.reply : vms.length + ' ' + i18n.replies;
        // replyStrObj.update && replyStrObj.update( newReplyStrObj );
        discussionItem.props.numReplies.dbValue++;
        createConvSvc.setCkEditorData( '', cke );
        if( searchState ) {
            convUtils.updateLatestCommentInPWA( searchState, discussionData );
        }
        deferred.resolve( responseData );
        //Reset PWA on reply in discussion location to refresh PWA and to move discussion to top of list
        if( convUtils.isDiscussionSublocation() ) {
            eventBus.publish( 'replyBoxAction.resetPWAEvent', { restPWA:'replyBoxAction.resetPWAEvent' } );
        }
    } );
    return deferred.promise;
};

export let loadMoreAction = function( vmData, convObj ) {
    if( !vmData.loadMoreComments ) {
        vmData.loadMoreComments = true;
    }
    vmData.hideMoreRepliesButton = true;

    //paging necessary
    var nextStartIndex = convObj.cursorStartIndx - vmData.dataProviders.commentsDataProvider.action.inputData.request.variables.searchInput.maxToLoad;
    //last page scenario - set endIndex to startIndex and startIndex to 0
    if( nextStartIndex <= 0 ) {
        convObj.cursorEndIndx = convObj.cursorStartIndx;
        convObj.cursorStartIndx = 0;
        return;
    }
    convObj.cursorStartIndx = nextStartIndex;
    convObj.cursorEndIndx = convObj.props.numReplies.dbValue;
};

var setUniversalConvPanelData = function( convCtx, newUniversalData, newSharedData, data ) {
    convCtx.cmtEdit = {};
    convCtx.cmtReply = {};
    convCtx.isIE = false;
    convCtx.createCollabObjData = {};
    //check to see if browser is IE
    if( browserUtils.isIE ) {
        convCtx.isIE = true;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

    if( typeof data !== 'undefined' && typeof data.universalData !== 'undefined' ) {
        newUniversalData = _.clone( data.universalData );
    }

    if( typeof data !== 'undefined' && typeof data.newSharedData !== 'undefined' ) {
        newSharedData = _.clone( data.sharedData );
    }

    if ( data && data.subPanelContext && data.subPanelContext.selectedTab ) {
        convCtx.selectedTab = data.subPanelContext.selectedTab;
    }
    newSharedData.addedSourceObjects = [];
    newSharedData.addedUserObjects = [];
    newSharedData.removedSourceObjects = [];
    newSharedData.ckeText = '';
    newSharedData.trackedStatus = '';
    newSharedData.activeView = 'Ac0CreateNewCollabObj';
};

export let initUniversalConvPanel = function( data, panelContext ) {
    var convCtx = convUtils.getAc0ConvCtx();
    var newUniversalData = {};
    var newSharedData = {};
    setUniversalConvPanelData( convCtx, newUniversalData, newSharedData, data );

    if( panelContext && panelContext.currentSelectedSnapshot ) {
        newSharedData.currentSelectedSnapshot = panelContext.currentSelectedSnapshot;
    }else if ( convCtx.currentSelectedSnapshot && ( convCtx.snapshotEntryPoint === 'SnapshotProductGallery' || convUtils.isMyGallerySublocation() ) && convCtx.snapMode === 'create' ) {
        newSharedData.currentSelectedSnapshot = convCtx.currentSelectedSnapshot;
    }
    //set the selected obj (for Awb0Element it will be the underlying object) in Ac0ConvCtx
    if( !convUtils.isDiscussionSublocation() && !newSharedData.currentSelectedSnapshot || !convUtils.isDiscussionSublocation() && newSharedData.currentSelectedSnapshot && convCtx.snapMode && convCtx.snapMode === 'open' ) {
        convUtils.setSelectedObjectInConvContext( data );
        // refresh the contents of convCtx
        convCtx = convUtils.getAc0ConvCtx();
        if( newSharedData.currentSelectedSnapshot ) {
            newUniversalData.selectedObj = newSharedData.currentSelectedSnapshot;
            newSharedData.selectedObj = newSharedData.currentSelectedSnapshot;
        } else{
            var tmpSelectedObj = appCtxSvc.getCtx( 'Ac0ConvCtx.selected' );
            if( tmpSelectedObj && tmpSelectedObj.props && tmpSelectedObj.props.awb0UnderlyingObject ) {
                tmpSelectedObj = appCtxSvc.getCtx( 'Ac0ConvCtx.selected' ).props.awb0UnderlyingObject;
            }
            newUniversalData.selectedObj = tmpSelectedObj;
            newSharedData.selectedObj = tmpSelectedObj;
            if( tmpSelectedObj && tmpSelectedObj.cellHeader1 ) {
                newUniversalData.selectedObj.uiValue = newUniversalData.selectedObj.cellHeader1;
                newSharedData.selectedObj.uiValue = newUniversalData.selectedObj.cellHeader1;
            }
        }
        newSharedData.activeView = 'Ac0UnivConvPanelSub';
    }

    //TODO: why do we have this?? Revisit after AWDialog conversion for Gallery
    // if ( convUtils.isMyGallerySublocation() && convCtx.snapMode && convCtx.snapMode === 'create' && data.subPanelContext.selectionData ) {
    //     data.subPanelContext.selectionData.selected[0].cellHeader1 = null;
    // }

    // We need to handle the use case where the 'panel' was opened in the
    // 'hosted' location used by NX.  In this case there is not a 'selected'
    // object in the universalData as there is no selected object in the UI
    // The selected object is in the URL
    if( typeof newUniversalData.selectedObj === 'undefined' || newUniversalData.selectedObj === null ) {
        const stateParams = AwStateService.instance.params;
        // lets get the VMobject
        var deferred = AwPromiseService.instance.defer();
        if( typeof stateParams !== 'undefined' && typeof stateParams.uid !== 'undefined' ) {
            const objectUIDArray = [];
            objectUIDArray.push( stateParams.uid );
            return dms.loadObjects( objectUIDArray ).then( function() {
                var relatedObj = cdm.getObject( stateParams.uid );
                newUniversalData.selectedObj = vmoSvc.createViewModelObject( relatedObj );
                var selectedArrayTmp = [ newUniversalData.selectedObj ];
                var selectedValueTmp = { value: selectionDataTmp };
                var selectionDataTmp = {
                    selected: selectedArrayTmp,
                    value: selectedValueTmp
                };
                var subPanelContextTmp = {
                    selectionData: selectionDataTmp
                };
                data.subPanelContext = subPanelContextTmp;
                convUtils.setSelectedObjectInConvContext( data );
                appCtxSvc.updateCtx( 'selected', newUniversalData.selectedObj );
                return {
                    universalData: newUniversalData,
                    sharedData: newSharedData
                };
            } );
        }
        deferred.resolve( {} );
    }

    return {
        universalData: newUniversalData,
        sharedData: newSharedData
    };
};

//TODO - this method should be tied to the unMount lifecyclehook. Currently it is being called on navigateBack which is detrimental. Hence not being called now.
export let destroyUniversalConvPanel = function() {
    appCtxSvc.unRegisterCtx( 'Ac0ConvCtx' );
};


/**
 * Add given sub panel
 * @param {String} destPanelId Panel ID
 * @param {String} titleLabel Title
 * @param {Object} data vmData
 */
export let addSubPanelPage = function( destPanelId, titleLabel, data ) {
    var ac0ConvCtx = convUtils.getAc0ConvCtx();
    ac0ConvCtx.createOrEditRichText = createConvSvc.getRichText( data.ckeInstance );
    ac0ConvCtx.invokingPanel = data.activeView;
    createConvSvc.destroyCkEditorInstance( data );
    appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
    var context = {
        destPanelId: destPanelId,
        supportGoBack: true,
        title: titleLabel,
        recreatePanel: true,
        isolateMode: true
    };
    eventBus.publish( 'awPanel.navigate', context );
};

/**
 * set data to the parentData
 * @param {Object} data Data
 */
export let setParentData = function( data ) {
    // store create converation panel data to a variable.
    parentData = data;
};

export let getRandObjId = function() {
    var randObjId = '';
    randObjId += Math.floor( 10000 * Math.random() );
    return randObjId;
};

export let getParentData = function() {
    return parentData;
};


export let teardownUniversalConvPanel = function() {
    //empty out selected conversation
    selectedConv = {};
    createConvSvc.unSubscribeFromCkeEvents();
    var convCtx = convUtils.getAc0ConvCtx();
    if( convCtx.editConvCtx ) {
        var elementId = convCtx.editConvCtx.ckEditorIdRef;
        var domEditableElement = document.querySelector( '#' + elementId );
        if( domEditableElement ) {
            domEditableElement.ckeditorInstance.disableReadOnlyMode( '#' + elementId );
        }
        delete convCtx.editConvCtx;
    }
    if( convCtx.currentSelectedSnapshot ) {
        unregisterSnapshotDiscussionContextdata( 'teardownCleanup' );
    }
    if ( convCtx.selectedTab ) {
        delete convCtx.selectedTab;
    }
    if( typeof  convCtx.selected !== 'undefined' && convCtx.selected ) {
        delete convCtx.selected;
    }
};

export let conversationSelectionChange = function( event, vmData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    if( event.selectedObjects.length === 1 ) {
        if( !_.isEmpty( selectedConv ) ) {
            selectedConv.showConvCellCmds = false;
        }
        selectedConv = event.selectedObjects[0];
        selectedConv.showConvCellCmds = true;

        convCtx.currentSelectedConversation = selectedConv;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

        eventBus.publish( 'Ac0Conversation.checkConvSubscriptionEvent' );
    }
    if( event.selectedObjects.length === 0 && !_.isEmpty( selectedConv ) ) {
        selectedConv.showConvCellCmds = false;
        convCtx.currentSelectedConversation = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    }
};

export let setObjectDisplayData = function( data ) {
    convUtils.setObjectDisplayData( data );
};
export let destroyActiveCellCkeEditor = function() {
    var ac0ConvCtx = convUtils.getAc0ConvCtx();
    //not unsub from cke imgupload events here as the replyBox cke instance is still alive
    if( ac0ConvCtx.activeCell && ac0ConvCtx.activeCell.ckeInstance ) {
        ac0ConvCtx.activeCell.ckeInstance.cke._instance.destroy();
        ac0ConvCtx.activeCell.ckeInstance = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
    }
};

/**
 * Method that updates the Conversation cell in feedList secondary workarea
 * This is to handle context for chip and other link rendering in secondary workarea
 * @param {*} eventData event
 * @param {*} vmData view model data
 * @param {*} context
 */
var updateCoversationCell = function( vmData, eventData ) {
    var vms = null;
    if( typeof vmData !== 'undefined' && typeof vmData.data !== 'undefined' && typeof vmData.data.eventMap !== 'undefined' ) {
        var selectionChangeEventObj = vmData.data.eventMap[ 'primaryWorkArea.selectionChangeEvent' ];
        if( typeof selectionChangeEventObj !== 'undefined' &&  selectionChangeEventObj !== null ) {
            var selection = selectionChangeEventObj.selectedObjects[ 0 ];
            if( typeof selection !== 'undefined' && selection !== null ) {
                vms = selection;
            }
        }
    }

    let appCtx = appCtxSvc.getCtx();
    if( vms === null ) {
        vms = appCtx.selected;
    }

    var newConvObj = _.cloneDeep( vms );
    newConvObj.srcObjIdRef = 'ac0_' + vms.srcObjIdRef;
    appCtxSvc.updateCtx( 'newConvObj', newConvObj );
    if( eventData && eventData.restPWA ) {
        eventBus.publish( 'primaryWorkarea.reset' );
    }
};


/**
 * Method that handles selection change updates, publishes selection chenge event
 * @param {*} eventData event
 * @param {*} vmData view model data
 * @param {*} context
 */
export let feedPrimaryWorkspaceSelection = function( vmData, eventData, ctx ) {
    if ( ctx.selected !== null ) {
        updateCoversationCell( vmData, eventData );
    }
};

/**
 * Method that invokes updateConversation graphql mutator to update conversation status.
 * @param {*} data view model data
 * @returns {*} Promise
 */
export let updateConvStatusAction = function( data, props ) {
    var convItemTobeUpdatedArr = data.eventData.property.propInternalValue.split( '___' );
    if( convItemTobeUpdatedArr[1] && convItemTobeUpdatedArr[1] === props.metaData.details.uid ) {
        var deferred = AwPromiseService.instance.defer();
        var convTileObj;
        if ( convUtils.isDiscussionSublocation() ) {
            convTileObj = appCtxSvc.getCtx( 'selected' );
        } else if( props && props.metaData.details ) {
            convTileObj = props.metaData.details;
        }

        var graphQLInput = {};

        // prepare source objects
        var sourceObjs = [];
        var sourceTags = convTileObj.props.inflatedSrcObjList;
        if( sourceTags ) {
            for( let i = 0; i < sourceTags.length; i++ ) {
                if( sourceTags[ i ] ) {
                    var srcObj = {
                        uid: sourceTags[ i ].uid,
                        type: sourceTags[ i ].type
                    };
                    sourceObjs.push( srcObj );
                }
            }
        }
        graphQLInput.sourceObjects = sourceObjs;

        // prepare participants
        var userObjs = [];
        var userTags = convTileObj.props.inflatedParticipantObjVMOList;
        if( userTags ) {
            for( let i = 0; i < userTags.length; i++ ) {
                if( userTags[ i ] ) {
                    var usrObj = {
                        uid: userTags[ i ].uid,
                        type: userTags[ i ].type
                    };
                    userObjs.push( usrObj );
                }
            }
        }
        graphQLInput.listOfParticipants = userObjs;

        graphQLInput.defaultCommentText = convTileObj.props.richText.dbValues;
        graphQLInput.conversation = {
            type: 'Ac0Conversation',
            uid: convTileObj.props.collabUid.dbValues
        };
        graphQLInput.convPrivate = convTileObj.props.isConvPrivate.dbValues;
        if( convUtils.isAc0EnableTrackedDiscussions ) {
            graphQLInput.convActionable = convTileObj.isConvActionable;
            graphQLInput.status = convTileObj.isConvActionable ? convItemTobeUpdatedArr[0] : null;
            graphQLInput.priority = convTileObj.isConvActionable ? convTileObj.props.convPriority.dbValues : null;
            graphQLInput.closingUserId = convTileObj.isConvActionable ? appCtxSvc.getCtx( 'user' ).uid : null;
            graphQLInput.dateClosed = convTileObj.isConvActionable ? dateTimeSvc.formatUTC( new Date() ) : null;
        }
        let payloadOptions = {};
        graphQLInput.options = createConvSvc.getDiscussionOptions( payloadOptions );

        var graphQLQuery = {
            endPoint: 'tcgql/graphql',
            request: {
                query: 'mutation updateConversation($updateConversationInput: AddOrUpdateConversationInput!) { updateConversation(updateConversationInput: $updateConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    updateConversationInput: graphQLInput
                }
            }
        };

        graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
            if( !declUtils.isNil( response ) ) {
                let err = null;
                if( response.errors ) {
                    err = soaSvc.createError( response.errors[ 0 ] );
                }
                if( err ) {
                    var msg = '';
                    msg = msg.concat( data.i18n.convUpdateErrorMsg );
                    msgSvc.showError( msg );
                    deferred.reject( err );
                } else {
                    convTileObj.props.collabStatus.value = convItemTobeUpdatedArr[0];
                    convTileObj.props.collabStatus.dbValue = convItemTobeUpdatedArr[0];
                    convTileObj.props.collabStatus.dbValues = [ convItemTobeUpdatedArr[0] ];
                    convTileObj.props.collabStatus.uiValue = data.eventData.property.propDisplayValue;
                    convTileObj.props.collabStatus.uiValues = [ data.eventData.property.propDisplayValue ];
                    convTileObj.props.collabStatus.displayValues = [ data.eventData.property.propDisplayValue ];

                    convTileObj.props.convStatus.value = convItemTobeUpdatedArr[0];
                    convTileObj.props.convStatus.dbValue = convItemTobeUpdatedArr[0];
                    convTileObj.props.convStatus.dbValues = [ convItemTobeUpdatedArr[0] ];
                    convTileObj.props.convStatus.uiValue = convItemTobeUpdatedArr[0];
                    convTileObj.props.convStatus.uiValues = [ convItemTobeUpdatedArr[0] ];
                    convTileObj.props.convStatus.displayValues = [ data.eventData.property.propDisplayValue ];

                    convTileObj.props.convStatus.uiValue = data.eventData.property.propDisplayValue;
                    convTileObj.props.convStatus.uiValues = [ data.eventData.property.propDisplayValue ];
                    if( props.sharedDataObj.sharedData ) {
                        let sharedDataValue = { ...props.sharedDataObj.sharedData.getValue() };
                        if( sharedDataValue && sharedDataValue.trackedStatus ) {
                            sharedDataValue.trackedStatus = convItemTobeUpdatedArr[0];
                            convTileObj.props.numReplies.dbValue++;
                            props.sharedDataObj.sharedData.update( sharedDataValue );
                        }
                    }
                    deferred.resolve( response );
                }
            }
            if( convUtils.isDiscussionSublocation() ) {
                eventBus.publish( 'primaryWorkarea.reset' );
            }
        }, ( err ) => {
            if( err.response && err.response.status !== 200 ) {
                msgSvc.showError( `${data.i18n.graphqlErrorMsg}` );
            }
            deferred.reject( err );
        } );

        return deferred.promise;
    }
};

export let unregisterSnapshotDiscussionContextdata = function( selectionChamgeCleanup ) {
    var convoCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
    if( convoCtx.selectedTab === 'feedList' || selectionChamgeCleanup || typeof convoCtx.selectedTab === 'undefined' && convoCtx.snapshotEntryPoint && convoCtx.snapshotEntryPoint !== 'SnapshotProductGallery' ) {
        convoCtx.selected = [];
        delete convoCtx.currentSelectedSnapshot;
        delete convoCtx.snapshotEntryPoint;
        delete convoCtx.snapMode;
        delete convoCtx.snapshotObjfnd0Roots;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convoCtx );
    }
};

// Small helper function to ensure the ctx.newConvObj is populated correctly
let ensureCtxNewConvObjIsPopulated = function( tmpCurDiscussionObj, vmObj, vmo ) {
    if( typeof tmpCurDiscussionObj !== 'undefined' && tmpCurDiscussionObj !== null && tmpCurDiscussionObj.uid === vmObj.uid ) {
        if( typeof tmpCurDiscussionObj.props.inflatedRelatedObjList === 'undefined' ) {
            tmpCurDiscussionObj.props.inflatedRelatedObjList = [];
        }
        if( !tmpCurDiscussionObj.props.inflatedRelatedObjList.some( tmpObj => tmpObj.uid === vmo.uid ) ) {
            // This object is not in the list add it
            tmpCurDiscussionObj.props.inflatedRelatedObjList.push( vmo );
        } else {
            // This object is in the list replace it with the provided one
            var foundIndex = tmpCurDiscussionObj.props.inflatedRelatedObjList.findIndex( tmpObj => tmpObj.uid === vmo.uid );
            tmpCurDiscussionObj.props.inflatedRelatedObjList[foundIndex] = vmo;
        }
    }
};

// Function to get the correct data for inflating RelatedObjectInfos
export let getInflatedRelatedObjectList = function( vmData ) {
    var promiseArray = [];
    if( typeof vmData !== 'undefined' && typeof vmData.searchResults !== 'undefined' ) {
        for( var j = 0; j < vmData.searchResults.length; j++ ) {
            var vmObject = vmData.searchResults[j];
            if( vmObject.discussionHasSnapshot ) {
                var collabRelatedObjectInfoUids = [];
                vmObject.props.inflatedRelatedObjList = [];
                for( var ii = 0; ii < vmObject.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
                    if( vmObject.props.collabRelatedObjectInfo.dbValues[ii] ) {
                        collabRelatedObjectInfoUids.push( vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid );

                        // Resolving timing issue where the ui dataprovider is expecting info before it is populated.
                        // put something in the inflatedRelatedObjList this will be overwritten in when processing the promise
                        vmObject.props.inflatedRelatedObjList.push( {
                            uid:vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid,
                            type: vmObject.props.collabRelatedObjectInfo.dbValues[ii].type
                        } );
                    }
                }
                if( collabRelatedObjectInfoUids.length > 0 ) {
                    vmObject.props.collabRelatedObjectInfoUids = collabRelatedObjectInfoUids;
                    promiseArray.push( dms.loadObjects( collabRelatedObjectInfoUids ) );
                }
            }
        }

        return Promise.all( promiseArray ).then( function() {
            var tmpCurDiscObj = appCtxSvc.getCtx( 'newConvObj' );
            for( var index = 0; index < vmData.searchResults.length; index++ ) {
                var vmObj = vmData.searchResults[index];
                if( vmObj.discussionHasSnapshot ) {
                    vmObj.props.inflatedRelatedObjList = [];
                    var relatedObjUids = [];
                    for( var ii = 0; ii < vmObj.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
                        if( vmObject.props.collabRelatedObjectInfo.dbValues[ii] ) {
                            relatedObjUids.push( vmObj.props.collabRelatedObjectInfo.dbValues[ii].uid );
                        }
                    }
                    var totalNoOfobj = relatedObjUids.length;
                    for( var nn = 0; nn < totalNoOfobj; nn++ ) { //total no. of participants to be visible initially
                        var relatedObj = cdm.getObject( relatedObjUids[nn] );
                        let vmo = vmoSvc.constructViewModelObjectFromModelObject( relatedObj );
                        //TODO: temp code of disable inline edit of snapshot , need to revisit( check handleTextEditClick())
                        vmo.props.fnd0OwningIdentifier = vmo.modelType.propertyDescriptorsMap.fnd0OwningIdentifier;
                        vmObj.props.inflatedRelatedObjList.push( vmo );
                        vmObj.props.collabRelatedObjectInfo.dbValue[nn] = vmo;
                        vmObj.props.collabRelatedObjectInfo.dbValues[nn] = vmo;

                        // There is an issue where the 'newConvObj' object
                        // (which is a clone of this object) does not have its
                        // inflatedRelatedObjList value populated correctly at all times
                        // ensure that it is populated here
                        ensureCtxNewConvObjIsPopulated( tmpCurDiscObj, vmObj, vmo );
                    }
                }
            }
        } );
    }
};

export let closePanelOnSelectionChange = function( popupId, selectionData ) {
    if( convUtils.isMyGallerySublocation() && !selectionData && popupId ) {
        dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
    }else{
        unregisterSnapshotDiscussionContextdata( 'selectionChamgeCleanup' );
    }
};

/*
* Helper function to include comment text in reply
* @param {Object} commentObj comment object
* @param {Object} ckeInstance the active ckeditor instance
* @param {Object} commandContext the context of the command/event calling this method
* @param {Object} discussionId the discussion to validate against
*/
export let doIncludeInReplyFunc = function( commentObj, ckeInstance, commandContext, discussionObj ) {
    if( commandContext.discussionItem.rootCommentObj.uid === discussionObj.discussionItem.rootCommentObj.uid ) {
        // would like to use the following to better format the 'quoted' text but this only
        // displays correctly in the CK editor we would have to add this tag to our css files
        // to have it display correctly outside of the editor
        // var quotedText = '<blockquote>' + commentObj.props.richText.displayValues[0] + '</blockquote>';
        createConvSvc.insertCkEditorData( commentObj.props.richText.displayValues[0], ckeInstance );
    }
};

/*
* Function to display error message if graphql is not up (handle 200 and non 200 status error)
* @param {Object} response
* @param {Object} data
*/
export let displayGraphqlErrorMsg =  async function( response, data ) {
    // Ensure data and response are not null or undefined
    if ( data && response ) {
    // Safely extract errorCodeData
        const errorCodeData = data?.eventData?.scope?.errorCode?.response ?? null;
        // Check if errorCodeData exists and has a non-200 status
        if ( errorCodeData?.status && errorCodeData.status !== 200 ) {
            await msgSvc.showError( `${data.i18n.graphqlErrorMsg}` );
        }
        // Check if response contains errors
        if ( response?.errors ) {
            await msgSvc.showError( `${data.i18n.fetchConvInternalErrMsg}` );
        }
    }
};

/**
 * Ac0ConversationService factory
 */

export default exports = {
    feedLocationReveal,
    removeSrcChipObj,
    removeUserChipObj,
    onObjectTabSelectionChange,
    modifyConversations,
    replyBoxAction,
    modifyComments,
    loadMoreAction,
    initUniversalConvPanel,
    destroyUniversalConvPanel,
    addSubPanelPage,
    setParentData,
    getSourceObjects,
    getRandObjId,
    getParentData,
    getUserObjects,
    teardownUniversalConvPanel,
    conversationSelectionChange,
    setObjectDisplayData,
    destroyActiveCellCkeEditor,
    feedPrimaryWorkspaceSelection,
    updateConvStatusAction,
    deleteCommandValidForCurrentGroupRole,
    getInflatedSourceObjectList,
    unregisterSnapshotDiscussionContextdata,
    initMoreSourceObjPopup,
    initMoreParticipantPopup,
    getInflatedRelatedObjectList,
    setupTileMoreLessSection,
    setupTileMoreLessSectionLC,
    closePanelOnSelectionChange,
    loadVMOFodHostedComponent,
    doIncludeInReplyFunc,
    displayGraphqlErrorMsg
};
