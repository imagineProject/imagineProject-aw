// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0WorkflowAttachmentTargetReferenceService
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import messageService from 'js/messagingService';
import _ from 'lodash';

var exports = {};

/**
 * Remove the input objects from attachment data provider and populate the workflow templates
 * based on valid templates and process name.
 * @param {Object} subPanelContext Context object where selected object need to be removed
 * @param {Array} selectedObjects Selected objects that need to be removed.
 * @param {String} commandContextKey Command context key where user clicked like target command or reference command
 *
 */
export let removeWorkflowProcessTargets = function( subPanelContext, selectedObjects, commandContextKey ) {
    var isReloadPanel = true;
    var preSelectedType = null;
    // Based on the contextKey get the existing first target type and check after removal what wull be the first
    // object as based on that we need to load the workflow templates again.
    if( subPanelContext && commandContextKey ) {
        const localContext = { ...subPanelContext.value };
        var existingTargetObjects = localContext[ commandContextKey ];
        if( existingTargetObjects && existingTargetObjects[ 0 ] && selectedObjects && selectedObjects[ 0 ] ) {
            preSelectedType = selectedObjects[ 0 ].type;
        }
        var validObjects = _.differenceBy( existingTargetObjects, selectedObjects, 'uid' );
        if( validObjects && validObjects[ 0 ] ) {
            var newFirstObjectType = validObjects[ 0 ].type;
            if( newFirstObjectType !== preSelectedType && commandContextKey === 'targetObjects' ) {
                isReloadPanel = true;
            }
        } else if( commandContextKey === 'targetObjects' && ( !validObjects || _.isEmpty( validObjects ) ) ) {
            // If user has removed all targets then only set this variable to true so that it can show empty
            // template list
            isReloadPanel = true;
        }

        localContext[ commandContextKey ] = validObjects;
        localContext.isReloadPanel = isReloadPanel;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
 * Populate the targets data that will store present object and selected object in specific section.
 *
 * @param {String} context key string that will be targetObjects or referencesObjects
 * @param {Array} modelObjects Present model objects in specific section
 * @param {Array} selectedObjects Selected objects present in each section.
 *
 * @returns {Object} Object that will contain context specific info
 */
export let populateTargetsData = ( context, modelObjects, selectedObjects ) => {
    let selObjs = selectedObjects;
    if( !selObjs ) {
        selObjs = [];
    }
    return {
        modelObjects : modelObjects,
        attachmentContextKey : context,
        selectedObjects: selObjs
    };
};

var _isObjectPresent = function( modelObject, objectArray ) {
    var modelObject1 = _.find( objectArray, function( object ) {
        return modelObject.uid === object.uid;
    } );
    if( !modelObject1 ) {
        return false;
    }
    return true;
};


/**
 * Populate all targets for sub process case.
 *
 * @param {Object} context Context object where selected object need to be removed
 * @param {Object} searchResults Search result object
 * @param {Object} targetObjects All target objects
 * @param {Object} dataProvider Data provider object
 * @param {Object} data Data view model object
 * @returns {Object} Obejct that will hold sub process target info.
 */
export let populateSubProcessTargetsData = function( context, searchResults, targetObjects, dataProvider, data ) {
    var localTargetObjects = _.clone( targetObjects );
    var subProcessTargets = [];

    // Get the existing loaded view model objects that are already present then add the new results
    if( dataProvider && dataProvider.vmCollectionObj && dataProvider.vmCollectionObj.vmCollection ) {
        subProcessTargets = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
    }
    // Check is sub process target list is undefined then intialize it with empty array
    if( !subProcessTargets ) {
        subProcessTargets = [];
    }

    // Check if input search results is not null and it has some objects then get those objects
    // and add to the list
    if( searchResults && searchResults.objects && searchResults.objects.length > 0 ) {
        _.forEach( searchResults.objects, function( searchResult ) {
            var modelObject = clientDataModel.getObject( searchResult.uid );
            if( modelObject && modelObject.type === 'Awp0XRTObjectSetRow' ) {
                var targetObj = _.get( modelObject, 'props.awp0Target' );
                if( targetObj && targetObj.dbValues && targetObj.dbValues[ 0 ] ) {
                    var underlyingObject = clientDataModel.getObject( targetObj.dbValues[ 0 ] );
                    if( underlyingObject ) {
                        // Check if what ever object server has returned, check if it has into
                        // the main target object list array then only add it. This code is needed
                        // as if there are multiple pages need to be loaded but user has only loaded
                        // first page and removed one object from that page itself then we don't need
                        // to show that object.
                        var modelObject1 = _.find( localTargetObjects, function( object ) {
                            return underlyingObject.uid === object.uid;
                        } );

                        // Add it only when object is present in main target list then only add it
                        // to sub process list.
                        if( modelObject1 ) {
                            subProcessTargets.push( underlyingObject );
                        }
                    }
                }
            }
        } );
    }

    // Check if data provider is not null and cursor has been reached to end then we need to
    // add all targets as it is as it might contains some new targets being added.
    if( dataProvider && dataProvider.cursorObject && dataProvider.cursorObject.endReached ) {
        subProcessTargets = [];
        _.forEach( localTargetObjects, function( targetObject ) {
            subProcessTargets.push( targetObject );
        } );
    }

    // Remove the duplicates if present in presetObjects list.
    subProcessTargets = _.uniqWith( subProcessTargets, function( objA, objB ) {
        return objA.uid === objB.uid;
    } );
    dataProvider.update( subProcessTargets, subProcessTargets.length );

    return {
        modelObjects : subProcessTargets,
        attachmentContextKey : context,
        selectedObjects: []
    };
};

/**
 * Check while adding the objects as targets if objects are check out then we need to show error message.
 *
 * @param {Array} selectionObjects Selected objects that need to be added as targets
 * @param {String} singleCheckedOutError Single check out error message string
 * @param {String} multipleCheckedOutError Multi check out error message string
 * @returns {String} Error message that need to be shown
 */
var _getCheckOutTargetErrorMsg = function( selectionObjects, singleCheckedOutError, multipleCheckedOutError ) {
    var checkedOutObjects = '';
    var numberOfCheckedOut = 0;
    var message = '';
    if( selectionObjects && !_.isEmpty( selectionObjects ) ) {
        _.forEach( selectionObjects, function( selectedObject ) {
            if ( selectedObject.props.checked_out_user && selectedObject.props.checked_out_user.dbValue !== null ) {
                //build a list of selected objects that are checked out
                if ( numberOfCheckedOut > 0 ) {
                    checkedOutObjects += '\n';
                }
                checkedOutObjects += '"' + selectedObject.props.object_name.uiValue + '"';
                numberOfCheckedOut++;
            }
        } );
    }

    // If number of check out targets is 1 then show single chec out error else if more objects are check out then
    // we need to show multi check out error message
    if ( numberOfCheckedOut === 1 ) {
        message = singleCheckedOutError;
        message = message.replace( '{0}', checkedOutObjects );
    } else if ( numberOfCheckedOut > 1 ) {
        message = multipleCheckedOutError;
        message += '\n' + checkedOutObjects;
    }
    return message;
};

/**
 * Add the input selected object into the data provider.
 *
 * @param {Array} selectedObjects Selected objects that need to be added
 * @param {Object} submitPanelState Context object where object will be added
 * @param {String} prePanelId Previous panel id to navigate to main panel
 * @param {String} singleCheckedOutError Single check out error string
 * @param {String} multipleCheckedOutError Multi check out error string
 */
export let addProcessAttachments = function( selectedObjects, submitPanelState, prePanelId, singleCheckedOutError, multipleCheckedOutError ) {
    if( selectedObjects && selectedObjects.length > 0 ) {
        var targetObjects = selectedObjects;

        //find which cell is currently selected, and set selected to false so that
        // on panel it won't show as selected
        _.forEach( targetObjects, function( target ) {
            if( target.selected === true ) {
                target.selected = false;
            }
        } );
        var isReloadPanel = true;
        var attachmentContextKey = null;
        // Get the target or reference from context and get the existing objects and if previously data provider
        // was empty then we need to reload the panel so that based on new target default workflow template can be shown.
        if( submitPanelState ) {
            const localContext = { ...submitPanelState.value };
            attachmentContextKey = localContext.attachmentContextKey;

            // In case of targetObjects we need to check if object is check out or not and in case of
            // check out we need to show error message
            if( attachmentContextKey === 'targetObjects' ) {
                let checkoutTargetErrorString = _getCheckOutTargetErrorMsg( selectedObjects, singleCheckedOutError, multipleCheckedOutError );

                // if error message is not empty then show the error and return from here
                if( checkoutTargetErrorString && !_.isEmpty( checkoutTargetErrorString ) && checkoutTargetErrorString.trim().length > 0 ) {
                    messageService.showError( checkoutTargetErrorString );
                    return;
                }
            }
            var existingTargetObjects = localContext[ attachmentContextKey ];
            if( !existingTargetObjects ) {
                existingTargetObjects = [];
            }
            Array.prototype.push.apply( existingTargetObjects, targetObjects );

            // Remove the duplicates if present in presetObjects list.
            existingTargetObjects = _.uniqWith( existingTargetObjects, function( objA, objB ) {
                return objA.uid === objB.uid;
            } );

            // Update the context info based on new objects being added.
            localContext[ attachmentContextKey ] = existingTargetObjects;
            localContext.isReloadPanel = isReloadPanel;
            localContext.activeView = prePanelId;
            submitPanelState.update && submitPanelState.update( localContext );
        }
    }
};

/**
 * Update the context key where user is perofrming the operation like target or references.
 *
 * @param {Object} subPanelContext Context where user is performing the operation like target or references
 * @param {String} addContextKey Command key as both need to compare so correct context info can be set
 *                 on sub panel context
 * @param {String} submittableObjectTypes Submittiable object types that can be added as target or references
 */
export let updateAttachmentContext = function( subPanelContext, addContextKey, submittableObjectTypes ) {
    if( subPanelContext ) {
        const localState = { ...subPanelContext.value };
        localState.attachmentContextKey = addContextKey;
        localState.submittableObjectTypes = submittableObjectTypes;
        subPanelContext.update && subPanelContext.update( localState );
    }
};

export default exports = {
    removeWorkflowProcessTargets,
    populateTargetsData,
    addProcessAttachments,
    updateAttachmentContext,
    populateSubProcessTargetsData
};
