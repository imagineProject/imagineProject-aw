// Copyright (c) 2022 Siemens
/**
 * @module js/aceDefaultPasteHandler
 */

// Import required services and libraries
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import aceAddElementService from 'js/aceAddElementService';
import occmgmtUtils from 'js/occmgmtUtils';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import pasteService from 'js/pasteService';
import tcDefaultPasteHandler from 'js/tcDefaultPasteHandler';
import adapterSvc from 'js/adapterService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import aceStructureEditService from 'js/aceStructureEditService';

/**
 * Set the variability for Add sibling Panel
 * @param {Object} targetObject - The parent object to which the element is added.
 * @param {Array} sourceObjects - Array of source objects to be added or moved.
 * @param {string} addObjectIntent - Intent for adding object (e.g., 'MoveIntent', 'paste', 'DragAndDropIntent').
 */
var updateCtxForAddUsingElementDrop = function( targetObject, sourceObjects, addObjectIntent ) {
    var addElementInput = {};

    addElementInput.parentElement = targetObject;
    if( addObjectIntent ) {
        if( addObjectIntent === 'MoveIntent' ) {
            addElementInput.addObjectIntent = 'MoveIntent';
        } else if( addObjectIntent === 'paste' ) {
            addElementInput.addObjectIntent = '';
        }
    } else {
        addElementInput.addObjectIntent = 'DragAndDropIntent';
        // Check if user is doing drag and drop then we need to get the parent Uids from input source
        // objects and we are storing the parent UID in context where these lines that are being moved
        // need to be removed so that in case if parent needs to be refesh for these lines it can happen.
        if( sourceObjects && !_.isEmpty( sourceObjects ) ) {
            var moveParentElementUids = [];
            _.forEach( sourceObjects, function( sourceObj ) {
                var parentUid = occmgmtUtils.getParentUid( sourceObj );
                if( parentUid ) {
                    moveParentElementUids.push( parentUid );
                }
            } );
            // Get the unique parent element uids that will be moved and set it to context
            moveParentElementUids = _.uniq( moveParentElementUids );
            addElementInput.moveParentElementUids = moveParentElementUids;
        }
    }

    /*
     * Here we are activating target view before proceeding for DnD operation.
     * 1. This will activate correct view in case of different configuration.
     * 2. This might activate wrong view When both view have target object avaialbe in there VMC.
     *    2.1 There is no harm with this as post processing will happen in jitter free way for both views.
     */
    var viewKeys = appCtxService.ctx.splitView ? appCtxService.ctx.splitView.viewKeys : [];
    for( var i = 0; i < viewKeys.length; i++ ) {
        var vmoID = appCtxService.ctx[ viewKeys[ i ] ].vmc.findViewModelObjectById( targetObject.uid );
        if( vmoID !== -1 ) {
            aceContextStateMgmtService.updateActiveContext( viewKeys[ i ] );
            break;
        }
    }

    var context;
    appCtxService.updatePartialCtx( 'aceActiveContext', appCtxService.ctx.aceActiveContext ? appCtxService.ctx.aceActiveContext :
        context = {} );
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );

    aceAddElementService.processAddElementInput();
};

/**
 * Prepares the parent-child list input for adding objects.
 * @param {Array} sourceObjects - Array of source objects to be added.
 * @param {Object} targetObject - The parent object to which the element is added.
 * @param {string} addObjectIntent - Intent for adding object.
 * @returns {Array} List of parent-child data for add operation.
 */
var _prepareAddObjectParentChildList = function( sourceObjects, targetObject, addObjectIntent ) {
    let addObjectParentChildrenList = [];
    let addObjectParentChildrenData = {};
    addObjectParentChildrenData.parentElement = targetObject;
    addObjectParentChildrenData.siblingElement = appCtxService.ctx.aceActiveContext.context.addElement.siblingElement;
    addObjectParentChildrenData.productContext = appCtxService.ctx.aceActiveContext.context.productContextInfo;
    var occContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
    if( addObjectIntent === 'DragAndDropIntent' ) {
        // In a multi-product scenario like a SWC/Workset, when drag and drop happens then, we need to make sure that we send PCI for target, rather then active PCI
        // This is because it is possible that the whole source product is moved into target. When this happens then the PCI for source is invalid and should not be used.
        let targetPCI = occmgmtUtils.getProductContextForProvidedObject( targetObject, occContext );
        if( targetPCI ) {
            addObjectParentChildrenData.productContext = cdmService.getObject( targetPCI );
        }
    }
    //Set the expansion state of parent element
    let isExpanded = aceAddElementService.getExpandedValue( occContext,  targetObject );
    if( isExpanded === 'true' ) {
        addObjectParentChildrenData.structExpanded = true;
    }else{
        addObjectParentChildrenData.structExpanded = false;
    }

    //Create the input for each parent
    let objectsToAddList = [];
    let objectsToAdd = aceAddElementService.getElementsToAdd( '', sourceObjects );
    for( let obj = 0; obj < objectsToAdd.length; obj++ ) {
        let objectToAddInfo = {};
        objectToAddInfo.createInput = { boName:' ', propertyNameValues:{}, compoundCreateInput:{} };
        objectToAddInfo.objectToAdd = objectsToAdd[obj];
        objectsToAddList.push( objectToAddInfo );
    }
    addObjectParentChildrenData.objectsToAddList = objectsToAddList;

    addObjectParentChildrenList.push( addObjectParentChildrenData );
    return addObjectParentChildrenList;
};

/**
 * Creates the input object for the addObject SOA call.
 * @param {Array} sourceObjects - Array of source objects to be added.
 * @param {Object} targetObject - The parent object to which the element is added.
 * @returns {Object} SOA input object for add operation.
 */
var createAddObjectInput = function( sourceObjects, targetObject ) {
    var soaInput = {};
    soaInput.input = {};
    var addObjectIntentvalue = appCtxService.ctx.aceActiveContext.context.addElement.addObjectIntent;
    soaInput.input.addObjectIntent = addObjectIntentvalue;
    soaInput.input.addObjectParentChildrenList = _prepareAddObjectParentChildList( sourceObjects, targetObject, addObjectIntentvalue );
    soaInput.input.sortCriteria = {
        propertyName: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[ 0 ].fieldName : undefined,
        sortingOrder: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[ 0 ].sortDirection : undefined
    };
    soaInput.input.fetchPagedOccurrences = true;
    soaInput.input.requestPrefMap = aceAddElementService.getRequestPrefValue( appCtxService.ctx.aceActiveContext.context, targetObject );
    soaInput.input.numberOfElements = 1;

    return soaInput;
};

/**
 * Update secondary work area for given parent
 * @param {Object} elementInfo Information about the parent element
 */
let _updateSecondaryWorkAreaForGivenParent = function( elementInfo ) {
    if ( !_.isUndefined( elementInfo ) && ( elementInfo.parentElement.props.awb0NumberOfChildren.dbValues[0] === '1' || elementInfo.newElements.length > 1 ) ) {
        var eventData = {};
        eventData.refreshLocationFlag = true;
        eventData.relations = '';
        eventData.relatedModified = [];
        eventData.relatedModified[0] = elementInfo.parentElement;
        eventBus.publish( 'cdm.relatedModified', eventData );
    }
};

/**
 * Shows a message to the user after elements are added, handling success, warning, and error cases.
 * @param {Object} addElementResponse - Response from add element operation.
 * @param {number} totalObjectsAdded - Total number of objects added.
 * @param {Object} targetObject - The parent object to which the element is added.
 * @param {number} sourceObjectsCount - Number of source objects attempted to add.
 */
const showElementAddMessage = ( addElementResponse, totalObjectsAdded, targetObject, sourceObjectsCount ) => {
    const selectedObjectString = _.get( addElementResponse, 'selectedNewElementInfos[0].newElements[0].props.object_string.dbValues[0]' );
    const parentObjectString = _.get( targetObject, 'props.object_string.dbValues[0]' );
    const SELECTED_OBJECT_STRING = '{{selectedObjectString}}';
    const PARENT_OBJECT_STRING = '{{parentObjectString}}';
    const TOTAL_OBJECTS_ADDED = '{{totalObjectsAdded}}';
    const SOURCE_OBJECTS = '{{sourceObjectsCount}}';
    var errorCodes = messagingService.getSOAErrorMessage( addElementResponse );
    const ERROR_CODES = '{{errorCodes}}';

    const msgContext = { totalObjectsAdded, selectedObjectString, parentObjectString };
    const warningMsgContext = { ...msgContext, errorCodes };
    const errorMsgContext = { totalObjectsAdded, sourceObjectsCount, parentObjectString, errorCodes };

    if ( !addElementResponse.partialErrors ) {
        if ( totalObjectsAdded === 1 ) {
            showMessage( 'elementAddSuccessful', msgContext, [ SELECTED_OBJECT_STRING, PARENT_OBJECT_STRING ], 'info' );
        } else if ( totalObjectsAdded > 1 ) {
            showMessage( 'multipleElementAddSuccessful', msgContext, [ TOTAL_OBJECTS_ADDED, PARENT_OBJECT_STRING ], 'info' );
        }
    } else if ( !addElementResponse.hasErrorPresentInPartialErrors ) {
        if ( totalObjectsAdded === 1 ) {
            showMessage( 'elementAddSuccessfulWithWarning', warningMsgContext, [ SELECTED_OBJECT_STRING, PARENT_OBJECT_STRING, ERROR_CODES ], 'warning' );
        } else if ( totalObjectsAdded > 1 ) {
            showMessage( 'multipleElementAddSuccessfulWithWarning', warningMsgContext, [ TOTAL_OBJECTS_ADDED, PARENT_OBJECT_STRING, ERROR_CODES ], 'warning' );
        }
    } else {
        // Optionally handle error case here if needed
        if( totalObjectsAdded < 1 ) {
            messagingService.showError( errorCodes );
        } else {
            showMessage( 'partiallyMultipleElementAddToSingleSelection', errorMsgContext, [ TOTAL_OBJECTS_ADDED, SOURCE_OBJECTS, PARENT_OBJECT_STRING, ERROR_CODES ], 'error' );
        }
    }
};

/**
 * Utility to show localized messages of different types (info, warning, error).
 * @param {string} key - Message key.
 * @param {Object} context - Message context.
 * @param {Array} params - Message parameters.
 * @param {string} [type='info'] - Message type ('info', 'warning', 'error').
 */
const showMessage = ( key, context, params, type = 'info' ) => {
    const meta = {
        path: 'OccurrenceManagementMessages',
        key,
        params,
        context
    };
    localeService.getLocalizedText( meta.path, meta.key ).then( localizedMessage => {
        const message = messagingService.applyMessageParams( localizedMessage, meta.params, meta.context );
        if ( type === 'info' ) {
            messagingService.showInfo( message );
        } else if ( type === 'warning' ) {
            messagingService.showWarning( message );
        } else if ( type === 'error' ) {
            messagingService.showError( message );
        }
    } );
};

/**
 * Main function to add elements to the target object.
 * Handles SOA call and post-processing.
 * @param {Array} sourceObjects - Array of source objects to be added.
 * @param {Object} targetObject - The parent object to which the element is added.
 * @param {string} addObjectIntent - Intent for adding object.
 * @returns {Promise} Promise resolving to SOA response.
 */
export let addElement = function( sourceObjects, targetObject, addObjectIntent ) {
    var soaInput = createAddObjectInput( sourceObjects, targetObject );
    let deferred = AwPromiseService.instance.defer();
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2025-06-OccurrenceManagement', 'addObject5', soaInput )
        .then( function( response ) {
            let addElementResponse = aceAddElementService.getAddElementResponse( response, [ targetObject ] );
            let totalObjectsAdded = aceAddElementService.getTotalNumberOfChildrenAdded( response, [ targetObject ] );
            if ( totalObjectsAdded > 0 ) {
                // If usecase is CopyPaste or CutPaste then required to publish cdm.relatedModified event from here
                // If usecase is DragAndDrop then no need to publish cdm.relatedModified event from here
                // because SWF already publishes cdm.relatedModified event in loadConfiguration function from pasteService.js file.
                if (  addObjectIntent === 'paste' || addObjectIntent === 'MoveIntent'  ) {
                    _updateSecondaryWorkAreaForGivenParent( response.newElementInfos[ 0 ] );
                }
                _postProcessAddObject( addElementResponse );
            }
            showElementAddMessage( addElementResponse, totalObjectsAdded, targetObject, sourceObjects.length );
            deferred.resolve( response );
        }, function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

/**
 * Post-processing after adding an object, including event publishing and selection logic.
 * @param {Object} addElementResponse - Response from add element operation.
 */
var _postProcessAddObject = function( addElementResponse ) {
    var eventData = {
        objectsToSelect: addElementResponse.newlyAddedChildElements,
        addElementResponse: addElementResponse,
        addElementInput: appCtxService.ctx.aceActiveContext.context.addElement,
        viewToReact: appCtxService.ctx.aceActiveContext.key
    };
    eventBus.publish( 'addElement.elementsAdded', eventData );
    if( appCtxService.ctx.aceActiveContext.context.addElementInput.addObjectIntent === 'DragAndDropIntent' ) {
        eventBus.publish( 'ace.elementsMoved', {
            deletedObjectUids: addElementResponse.deleted,
            clearDeletedObjectsFromPWASelection:true
        } );
    }
};

/**
 * Adds elements to a bookmark (SWC scenario).
 * @param {Array} sourceObjects - Array of source objects to be added.
 * @param {Object} targetObject - The target object for bookmark.
 * @param {Object} context - Context for the operation.
 * @returns {Promise} Promise resolving to SOA response.
 */
var addElementToBookmark = function( sourceObjects, targetObject, context ) {
    var inputData = {};
    inputData.targetObjectToAdd = targetObject;
    var soaInput = aceAddElementService.getAddToBookMarkInput( inputData, '', sourceObjects );
    let deferred = AwPromiseService.instance.defer();

    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2016-03-OccurrenceManagement', 'addToBookmark2', { input: soaInput } ).then( function( response ) {
        inputData.addToBookMarkResponse = response;
        if( response.ServiceData.partialErrors && inputData.addToBookMarkResponse.addedProductsInfo.length >= 1 ||
            !response.ServiceData.partialErrors && inputData.addToBookMarkResponse.addedProductsInfo.length >= 1 ) {
            _postProcessAddToBookmark( inputData, context );
        }

        let msgContext = {
            totalObjectsAdded: response.addedProductsInfo.length,
            selectedObjectString: _.get( response, 'addedProductsInfo[0].rootElement.props.object_string.dbValues[0]' ),
            parentObjectString: _.get( inputData, 'targetObjectToAdd.props.object_string.dbValues[0]' )
        };
        if( response.addedProductsInfo.length === 1 ) {
            singleElementAddSuccessful( msgContext, [ '{{selectedObjectString}}', '{{parentObjectString}}' ] );
        } else if( response.addedProductsInfo.length > 1 ) {
            multipleElementAddSuccessful( msgContext, [ '{{totalObjectsAdded}}', '{{parentObjectString}}' ] );
        }
        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * Shows info message for single element add success.
 * @param {Object} msgContext - Message context.
 * @param {Array} params - Message parameters.
 */
let singleElementAddSuccessful = function( msgContext, params ) {
    let meta = {
        path: 'OccurrenceManagementMessages',
        key: 'elementAddSuccessful',
        params: params,
        context: msgContext
    };
    showInfo( meta );
};

/**
 * Shows info message for multiple element add success.
 * @param {Object} msgContext - Message context.
 * @param {Array} params - Message parameters.
 */
let multipleElementAddSuccessful = function( msgContext, params ) {
    let meta = {
        path: 'OccurrenceManagementMessages',
        key: 'multipleElementAddSuccessful',
        params: params,
        context: msgContext
    };
    showInfo( meta );
};

/**
 * Utility to show info messages using localization.
 * @param {Object} meta - Metadata for message localization.
 */
let showInfo = function( meta ) {
    localeService.getLocalizedText( meta.path, meta.key ).then( function( localizedMessage ) {
        let message = messagingService.applyMessageParams( localizedMessage, meta.params, meta.context );
        messagingService.showInfo( message );
    } );
};

/**
 * Post-processing after adding to bookmark, including selection in tree.
 * @param {Object} inputData - Data from add to bookmark operation.
 * @param {Object} context - Context for the operation.
 */
var _postProcessAddToBookmark = function( inputData, context ) {
    var newlyAddedProduct = aceAddElementService.getNewlyAddedSwcProductInfo( inputData );
    var objectsToSelect = aceAddElementService.getNewlyAddedSwcChildElements( inputData );
    aceStructureEditService.loadAndSelectProvidedObjectInTree( context.occContext, objectsToSelect, newlyAddedProduct.productCtxInfo, undefined, undefined, true/*updateVmosNContextOnPwaReset*/ );
};

/**
 * Default paste handler for ACE, handles context and delegates to addElement.
 * @param {Object} targetObject - The target object for paste.
 * @param {Array} sourceObjects - Array of source objects to be pasted.
 * @param {Object} context - Context for the operation.
 * @returns {Promise} Promise resolving to SOA response.
 */
export let aceDefaultPasteHandler = function( targetObject, sourceObjects, context ) {
    var addObjectIntent = undefined;
    if( !context.isDragDropIntent ) {
        addObjectIntent = appCtxService.ctx.aceActiveContext.context.addObjectIntent;
    }
    if( appCtxService.ctx[ appCtxService.ctx.aceActiveContext.key ].isMarkupEnabled && !addObjectIntent ) {
        return;
    }
    if( context.isCommandSubPanel ) {
        // If paste target is command sub panel then do nothing
        return;
    }
    updateCtxForAddUsingElementDrop( targetObject, sourceObjects, addObjectIntent );
    return addElement( sourceObjects, targetObject, addObjectIntent );
};

/**
 * Paste handler for SWC scenario, delegates to addElementToBookmark.
 * @param {Object} targetObject - The target object for paste.
 * @param {Array} sourceObjects - Array of source objects to be pasted.
 * @param {Object} context - Context for the operation.
 * @returns {Promise} Promise resolving to SOA response.
 */
export let aceDefaultPasteHandlerForSWC = function( targetObject, sourceObjects, context ) {
    var addObjectIntent = appCtxService.ctx.aceActiveContext.context.addObjectIntent;
    updateCtxForAddUsingElementDrop( targetObject, sourceObjects, addObjectIntent );
    return addElementToBookmark( sourceObjects, targetObject, context );
};

/**
 * Handles paste operation from clipboard, sets intent and delegates to pasteService.
 * @param {Object} commandContext - Context for the paste command.
 */
export let acePasteObjectsFromClipboard = function( commandContext ) {
    if( appCtxService.ctx.cutIntent && appCtxService.ctx.cutIntent === true ) {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'MoveIntent';
    } else {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'paste';
    }
    pasteService.execute( appCtxService.ctx.selected, appCtxService.ctx.awClipBoardProvider, '', commandContext );
};

/**
 * Handles paste operation for attachments, adapts objects and calls SOA attachObjects.
 * @param {Object} targetObject - The target object for attachment.
 * @param {Array} sourceObjects - Array of source objects to be attached.
 * @param {string} relationType - Type of relation for attachment.
 * @returns {Promise} Promise resolving to SOA response.
 */
export let attachmentOverridePasteHandler = function( targetObject, sourceObjects, relationType ) {
    let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
    let _primaryContextUid = currentContext.currentState.incontext_uid;
    if( !_primaryContextUid ) {
        return tcDefaultPasteHandler.tcDefaultPasteHandler( targetObject, sourceObjects, relationType );
    }
    //use adapter service to find backing object in case targetobject is RBO
    var objectsToBeAdapted = [];
    objectsToBeAdapted.push( sourceObjects );
    return adapterSvc.getAdaptedObjects( objectsToBeAdapted ).then( function( adaptedObjs ) {
        if( adaptedObjs && adaptedObjs.length > 0 ) {
            var sourceObjs = adaptedObjs[ 0 ];
            var _targetObjUid = currentContext.pwaSelection[ 0 ].uid;
            var attachObjectInput = null;
            _.forEach( sourceObjs, function( sourceObj ) {
                if( sourceObj !== null ) {
                    attachObjectInput = [ {
                        clientId: '',
                        relationType: relationType,
                        primary: {
                            type: 'Awb0Element',
                            uid: _targetObjUid
                        },
                        primaryContext: {
                            type: 'Awb0Element',
                            uid: _primaryContextUid
                        },
                        secondary: {
                            type: sourceObj.type,
                            uid: sourceObj.uid
                        }
                    } ];
                }
            } );
            return soaSvc.post( 'Internal-ActiveWorkspaceBom-2015-03-OccurrenceManagement', 'attachObjects', {
                input: attachObjectInput
            } ).then(
                function( response ) {
                    return response;
                } );
        }
        return AwPromiseService.instance.reject( 'Invalid response received' );
    } );
};


/**
 * Export all main paste handler functions and services.
 */
export default {
    addElement,
    aceDefaultPasteHandler,
    aceDefaultPasteHandlerForSWC,
    acePasteObjectsFromClipboard,
    attachmentOverridePasteHandler
};
