// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1RevertMergeUtils
 */
import appCtxService from 'js/appCtxService';
import dmSvc from 'soa/dataManagementService';
import localeSvc from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';

var exports = {};
let _contentUnloadedListener = null;

export let getInputForRevert = function(  ) {
    let inputs = [];
    let selectedVmo =  appCtxService.ctx.selected;

    // If selection is from ACE
    if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            let input = {
                selectedBOMLine: appCtxService.ctx.mselected[ selCount ],
                selectedObject:  'AAAAAAAAAAAAAA',
                propertiesToRevert: [],
                secondarySelections : [],
                revertChildren : false
            };
            inputs.push( input );
        }
    } else {   // If selection is from secondary work area like object-set table
        var parentSelectionUid = {};
        var parentSelection  = appCtxService.ctx.pselected;
        if( parentSelection.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            // Get Underlying Object
            parentSelection = viewModelObjectService.createViewModelObject( parentSelection.props.awb0UnderlyingObject.dbValues[0] );
            parentSelectionUid = parentSelection;
        } else {
            parentSelectionUid = parentSelection;
        }

        let secSelections = [];
        let relationName = '';
        if( appCtxService.ctx.relationContext && appCtxService.ctx.relationContext.relationInfo && appCtxService.ctx.relationContext.relationInfo.length > 0 ) {
            relationName = appCtxService.ctx.relationContext.relationInfo[0].relationType;
            for( var selCount = 0; selCount < appCtxService.ctx.relationContext.relationInfo.length; selCount++ ) {
                if( parentSelectionUid.uid === appCtxService.ctx.relationContext.relationInfo[ selCount ].secondaryObject.uid ) { //handle S2P
                    secSelections.push( appCtxService.ctx.relationContext.relationInfo[ selCount ].primaryObject );
                } else{
                    secSelections.push( appCtxService.ctx.relationContext.relationInfo[ selCount ].secondaryObject );
                }
            }
        }

        var input  = {
            selectedBOMLine: 'AAAAAAAAAAAAAA',
            selectedObject:  parentSelectionUid,
            propertiesToRevert: [ relationName ],
            secondarySelections : secSelections,
            revertChildren : false
        };

        inputs.push( input );
    }

    return inputs;
};

/** * This function creates a warning parameter for revert operation based on the selected objects.
 * It constructs a warning message that will be displayed to the user when they attempt to revert changes.
 * @param {boolean} forAttachment - Flag indicating if the revert is for an attachment. The default value is false.
 *
 * @returns {Object} An object containing the warning text and selection information.
 */
export let createWarningParameterForRevert = function( forAttachment = false ) {
    let selectedObjects = [];
    let selectedVmo =  appCtxService.ctx.selected;
    if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            selectedObjects.push( appCtxService.ctx.mselected[ selCount ] );
        }
    } else {
        selectedObjects.push( appCtxService.ctx.pselected );
    }

    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    var hasAdd = false;
    var hasRemove = false;
    var hasUpdate = false;
    var hasRevise = false;
    let warningText = '';

    if( forAttachment ) {
        warningText = localTextBundle.Cm1RevertAttachmentChangesMessage.replace( '{0}', selectedObjects[ 0 ].props.object_string.uiValues[ 0 ] );
    }
    else if( selectedObjects && selectedObjects.length > 0 ) {
        for( var s = 0; s < selectedObjects.length; s++ ) {
            if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                //In cases where we change the revision rule e.g. Any No working, we do not get the name of the object in the awb0UnderlyingObject.
                //In that case we'll rely on objet_string property
                var awb0UnderlyingObjectProp = selectedObjects[ s ].props.awb0UnderlyingObject;
                let objectDisplayName = awb0UnderlyingObjectProp.dbValues[0] !== null ? awb0UnderlyingObjectProp.uiValues[ 0 ] : selectedObjects[ s ].props.object_string.uiValues[ 0 ];
                warningText = localTextBundle.Cm1RevertChangesMessage.replace( '{0}', objectDisplayName );
                let isReplaced = false;
                let isRevise = false;
                let updatedPropNames = selectedObjects[ s ].props.awb0MarkupPropertyNames.dbValues;
                if( updatedPropNames && updatedPropNames.length > 0 ) {
                    for( var p = 0; p < updatedPropNames.length; p++ ) {
                        if( updatedPropNames[ p ] === 'awb0ArchetypeId' ) {
                            isReplaced = true;
                            break;
                        }
                    }
                    if( !isReplaced ) {
                        for( var p = 0; p < updatedPropNames.length; p++ ) {
                            if( updatedPropNames[ p ] === 'awb0ArchetypeRevId' ) {
                                isRevise = true;
                                break;
                            }
                        }
                    }
                }
                let markupType = selectedObjects[ s ].props.awb0MarkupType.dbValues[ 0 ];
                if( markupType === '128' ) { // Added line
                    hasAdd = true;
                }
                if( markupType === '144' ) { // Added with absolute occ property change line
                    hasAdd = true;
                }
                if( markupType === '2' ) { // Removed line
                    hasRemove = true;
                }
                if( markupType === '16' ) { // Property Change
                    hasUpdate = true;
                }
                if( isRevise ) {
                    hasRevise = true;
                }
            }
        }
    }

    return {
        revertErrorText : warningText,
        hasAddRevertOperation : hasAdd,
        hasRemoveRevertOperation : hasRemove,
        hasUpdateRevertOperation : hasUpdate,
        hasAttachmentRevertOperation : forAttachment,
        hasReviseOperation : hasRevise
    };
};

/**
 * This function is to get input for merge operation
 *
 * @param {Array} mergeCandidates - The list of merge candidates
 * @returns {Object} input required for merge soa
 */
export let getInputForMerge = function( mergeCandidates ) {
    let selectedSourceLines = [];
    let props = [];

    let mergeAction = '';
    if( mergeCandidates !== undefined ) {
        //This is required when Merge All button is clicked
        if( mergeCandidates.length > 0 ) {
            mergeCandidates.forEach( ( mergeCandidate ) => {
                if( mergeCandidate.isAlreadyMerged === false ) {
                    selectedSourceLines.push( mergeCandidate.objectToBeMerged );
                    props.push( mergeCandidate.mergeAction.internalName );
                }
            } );
        } else {
            //This is required when only Merge button is clicked
            //Get the selected source lines
            let sourceLineUid = mergeCandidates.mergeCandidateItem.objectToBeMerged;
            mergeAction = mergeCandidates.mergeCandidateItem.mergeAction.internalName;
            selectedSourceLines.push( sourceLineUid );
            let sourceLine = appCtxService.ctx.state.params.srcPartUsgRevUID;
            if( !_.isUndefined( sourceLine )  && sourceLine !== null ) {
                const prop = mergeAction === 'remove' ? `${mergeAction}|${sourceLine}` : mergeAction;
                props.push( prop );
            } else {
                props.push( mergeAction );
            }
        }
    } else {
        //This is required when Merge is command is clicked from split view
        //Get the selected source lines
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            let sourceLineUid = appCtxService.ctx.mselected[ selCount ];
            selectedSourceLines.push( sourceLineUid );
        }
    }

    let targetLine = cdm.getObject( appCtxService.ctx.state.params.targetPartUsgRevUID );
    targetLine = targetLine ? targetLine : appCtxService.ctx.occmgmtContext2.modelObject;

    //Populate input for SOA
    return {
        sourceLines: selectedSourceLines,
        targetLine: targetLine,
        propertiesToMerge: props,
        mergeChildren : false
    };
};

/**
 * Load Merge data before page launch
 *
 * @returns {Promise} Promise after data load is done
 */
export let loadMergeData = function( params ) {
    let defer = AwPromiseService.instance.defer();

    appCtxService.ctx.taskUI = {};

    localeSvc.getLocalizedText( 'ChangeMessages', 'Cm1MergeViewTitle' ).then( function( result ) {
        appCtxService.ctx.taskUI.moduleTitle = result;
    } );

    localeSvc.getLocalizedText( 'ChangeMessages', 'Cm1MergeViewTitle' ).then( function( result ) {
        appCtxService.ctx.taskUI.taskTitle = result;
    } );

    appCtxService.updatePartialCtx( 'splitView.mode', true );
    appCtxService.updatePartialCtx( 'splitView.viewKeys', [ 'occmgmtContext', 'occmgmtContext2' ] );

    appCtxService.ctx.skipAutoBookmark = true;
    appCtxService.ctx.hideRightWall = true;
    _registerListeners();
};

/**
 * Unregister listeners
 */
let _unRegisterListeners = function() {
    if( _contentUnloadedListener ) {
        eventBus.unsubscribe( _contentUnloadedListener );
        _contentUnloadedListener = null;
    }
};


/**
 * Register listeners
 */
let _registerListeners = function() {
    // Register Page Unload listener
    if( !_contentUnloadedListener ) {
        _contentUnloadedListener = eventBus.subscribe( 'Cm1MergeChanges.contentUnloaded', _cleanupMergeChangesariableFromCtx, 'Cm1RevertMergeUtils' );
    }
};

/**
 * This function is used to load 'part usage revision' objects for Usage BOM merge and 'item revision' for Assembly BOM merge.
 */
export let loadObjects = async function() {
    const ecnUid = appCtxService.getCtx( 'state.params.ecn_uid' );
    const sourceUid = appCtxService.ctx.state.params.srcPartUsgRevUID ? appCtxService.ctx.state.params.srcPartUsgRevUID : appCtxService.ctx.state.params.uid;
    const targetUid = appCtxService.ctx.state.params.targetPartUsgRevUID ? appCtxService.ctx.state.params.targetPartUsgRevUID : appCtxService.ctx.state.params.uid2;

    if ( !_.isUndefined( sourceUid ) && !_.isUndefined( targetUid ) ) {
        await dmSvc.loadObjects( [ ecnUid, sourceUid, targetUid ] );
    }

    const sourceObject = sourceUid && cdm.getObject( sourceUid );

    return {
        sourceObjectName: sourceObject?.props?.object_string?.uiValues[0]
    };
};

/**
 * Constructs the input object for creating an incorporate relation.
 * The function prepares the necessary secondary data and properties to establish the relation between
 * the primary object (Change Notice) and the secondary object (revision).
 *
 * @returns {Array} - Returns an array containing the input object for creating the incorporate relation.
 *                    Each object includes the relation type, primary object, and associated secondary data.
 */

export let getSoaToCreateIncorporateRelation = function() {
    let secDataObj = {
        clientId: '',
        secondary: cdm.getObject( appCtxService.getCtx( 'state.params.uid' ) ),
        userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' },
        properties:
        [
            {
                name: 'cm0MergeStatus',
                values: [ 'Complete' ]
            }
        ]
    };

    return [ {
        relationType: 'Cm0Incorporates',
        primaryObject: cdm.getObject( appCtxService.getCtx( 'state.params.ecn_uid' ) ),
        secondaryData: [ secDataObj ]
    } ];
};

/**
 * Register properties and call merge candidates soa
 */
export let callGetMergeCandidatesSoa = function( data ) {
    var policy = {
        types: [ {
            name: 'BOMLine',
            properties: [
                {
                    name: 'bl_revision'
                },
                {
                    name: 'bl_rev_item_id'
                },
                {
                    name: 'bl_rev_item_revision_id'
                }
            ]
        } ]
    };

    //Register Policy
    var policyId = propPolicySvc.register( policy );
    var sourceUid = appCtxService.ctx.state.params.srcPartUsgRevUID ? appCtxService.ctx.state.params.srcPartUsgRevUID : appCtxService.ctx.state.params.uid;
    var targetUid = appCtxService.ctx.state.params.targetPartUsgRevUID ? appCtxService.ctx.state.params.targetPartUsgRevUID : appCtxService.ctx.state.params.uid2;
    //Soa input
    var soaInput = {
        sourceObject: {
            uid:sourceUid,
            type: cdm.getObject( sourceUid ).type
        },
        targetObject: {
            uid:targetUid,
            type: cdm.getObject( targetUid ).type
        }
    };
    // Call SOA to get merge candidates
    return soaSvc.post( 'Internal-CmAws-2022-12-Changes', 'getMergeCandidates', soaInput ).then(
        function( response ) {
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            var mergeCandidates = response.mergeCandidates;
            return updateMergeCandidateProvider( mergeCandidates, data );
        } );
};

/**
 * Update merge candidate provider when split view is launched
 *
 * @param {Array} mergeCandidates - The list of merge candidates
 * @param {Object} data - The data object containing data providers
 * @returns {Object} An object containing the showMergeAllButton flag
 */
export let updateMergeCandidateProvider = function( mergeCandidates, data ) {
    let showMergeAllButton = false;
    if( mergeCandidates.length > 0 && data.dataProviders && data.dataProviders.mergeCandidatesDataProvider ) {
        var candidates = [];
        for( var count = 0; count < mergeCandidates.length; count++ ) {
            var mergeCandidate = mergeCandidates[count];
            var mergeObject = mergeCandidate.objectToBeMerged;
            if ( mergeObject && mergeObject.props ) {
                var id = mergeObject.props?.bl_rev_item_id?.uiValues[0] ??  mergeObject?.props?.item_id?.uiValues[0];
                var revisionId = mergeObject.props?.bl_rev_item_revision_id?.uiValues[0] ?? mergeObject?.props?.item_revision_id?.uiValues[0];

                var objectToBeMergedVmo = viewModelObjectService.createViewModelObject( mergeCandidate.objectToBeMerged.uid );
                objectToBeMergedVmo.cellHeader2 = id;
                objectToBeMergedVmo.cellProperties = {
                    Revision : {
                        key : 'Revision',
                        value : revisionId
                    }
                };

                const isMergeConflict = Boolean( mergeCandidate.mergeRelatedData.isMergeConflict && mergeCandidate.mergeRelatedData.isMergeConflict[0] === 'true' );

                var canditate = {
                    isAlreadyMerged : mergeCandidate.isAlreadyMerged,
                    isMergeConflict : isMergeConflict,
                    objectToBeMerged : objectToBeMergedVmo,
                    mergeAction : {
                        internalName : mergeCandidate.mergeRelatedData.mergeAction[0],
                        displayName : mergeCandidate.mergeRelatedData.mergeAction[1]
                    }
                };
                //Enable MergeAll button if "isAlreadyMerged" property is enabled for any mergeCandidate.
                showMergeAllButton = !showMergeAllButton ? !canditate.isAlreadyMerged : showMergeAllButton;
                candidates.push( canditate );
            }
        }
        data.dataProviders.mergeCandidatesDataProvider.update( candidates,
            candidates.length );
    }
    return {
        showMergeAllButton: showMergeAllButton
    };
};

/**
 * This function retrieves the primary target objects required as input for further operations.
 * Specifically, it fetches the target Change Notice object using the provided ECN UID
 *
 * @returns {Array} An array containing the target Change Notice object.
 */

export let getTargetPrimaryObjectsInput = function() {
    let targetChangeNotice = cdm.getObject( appCtxService.getCtx( 'state.params.ecn_uid' ) );

    return [ targetChangeNotice ];
};

/**
 * Processes the response to determine whether the "Skip Remaining" button should be enabled.
 * The function examines incorporate relations in the response to check the merge status
 * for the current source revision.
 *
 * @param {Object} response - The response object containing relationship data.
 * @property {Array} response.output - The output array from the response.
 * @property {Array} response.output[0].relationshipData - An array of relationship data objects.
 * @property {Array} response.output[0].relationshipData[0].relationshipObjects - An array of relationship objects.
 *
 * @returns {boolean} - Returns `true` if the "Skip Remaining" button should be enabled,
 *                      or `false` if it should be disabled (e.g., if the merge status is 'Complete').
 */

export let processResponseForIncorporateRelation = function( response ) {
    let enableSkipRemainingButton = true;
    const sourceRevision = cdm.getObject( appCtxService.getCtx( 'state.params.uid' ) );

    const incorporateRelations = response?.output?.[0]?.relationshipData?.[0]?.relationshipObjects;

    if ( incorporateRelations && incorporateRelations.length > 0 ) {
        const sourceIncorporateRelation = incorporateRelations.filter( ( relationObj ) => {
            return relationObj.otherSideObject.uid === sourceRevision.uid;
        } );

        const mergeStatus = sourceIncorporateRelation?.[0]?.relation?.props?.cm0MergeStatus?.dbValues?.[0];
        if( mergeStatus === 'Complete' ) {
            enableSkipRemainingButton = false;
        }
    }

    return enableSkipRemainingButton;
};

/**
 * Clean up ACE context
 */
let _cleanupMergeChangesariableFromCtx = function() {
    appCtxService.unRegisterCtx( 'modelObjectsToOpen' );
    let mergeViewKeys = appCtxService.getCtx( 'splitView.viewKeys' );
    _.forEach( mergeViewKeys, function( mergeViewKey ) {
        appCtxService.unRegisterCtx( mergeViewKey );
    } );
    appCtxService.unRegisterCtx( 'splitView' );
    appCtxService.unRegisterCtx( 'taskUI' );
    appCtxService.unRegisterCtx( 'mergeChangesCtx' );
    appCtxService.unRegisterCtx( 'aceActiveContext' );
    appCtxService.updateCtx( 'hideRightWall', undefined );
    _unRegisterListeners();
};

/**
 * Unregister Ctx after merge location closed/Unmount
 */
let destroyCtxForMergeLocation = function() {
    appCtxService.unRegisterCtx( 'taskbarfullscreen' );
};

/**
 * This function allows redlining in merge page location without affecting view redlines cmd from ace
 *
 * @param {boolean} isShowChange - redline mode
 * @returns {boolean} isRegister - update isShowChange based on initialize/destroy of merge view
 */
let registerShowChangeRedlines = function( isShowChange, isRegister ) {
    if ( isRegister ) {
        isShowChange.dbValue = appCtxService.getCtx( 'showChange' );
        appCtxService.updateCtx( 'showChange', true );
    } else if ( !isRegister && isShowChange !== undefined ) {
        appCtxService.updateCtx( 'showChange', isShowChange.dbValue );
    }
};

/**
 * This function is select top nodes on loading of merge page.
 *
 * @param {Object} occContext - occmgmtContext
 * @param {Object} occContext2 - occmgmtContext2
 */
let removeDefaultSelectionsInMergePage = function( occContext, occContext2 ) {
    if ( occContext !== undefined && occContext.topElement !== undefined ) {
        let currSelection = occContext.treeDataProvider.selectionModel.getSelection();
        occContext.treeDataProvider.selectionModel.removeFromSelection( currSelection );
        occContext.treeDataProvider.selectionModel.addToSelection( occContext.topElement );
    }
    if ( occContext2 !== undefined && occContext2.topElement !== undefined ) {
        let currSelection2 = occContext2.treeDataProvider.selectionModel.getSelection();
        occContext2.treeDataProvider.selectionModel.removeFromSelection( currSelection2 );
        occContext2.treeDataProvider.selectionModel.addToSelection( occContext2.topElement );
    }
};

/**
 * This function retrieves the revert response information based on the provided response.
 * @param {Object} response - The response object containing partial errors and other data.
 * @returns {Object} An object containing the revert response information.
 */
export const getRevertResponseInfo = function( response ) {
    return {
        modelObjectsEmpty: _.isEmpty( response?.modelObjects )
    };
};

/**
 * Revert redline utility functions
 * @param {appCtxService} appCtxService - Service to use
 * @param {localeSvc} occmgmtUtils - Service to use
 */

export default exports = {
    loadObjects,
    createWarningParameterForRevert,
    getInputForRevert,
    getInputForMerge,
    loadMergeData,
    callGetMergeCandidatesSoa,
    updateMergeCandidateProvider,
    destroyCtxForMergeLocation,
    getSoaToCreateIncorporateRelation,
    getTargetPrimaryObjectsInput,
    processResponseForIncorporateRelation,
    registerShowChangeRedlines,
    removeDefaultSelectionsInMergePage,
    getRevertResponseInfo
};
