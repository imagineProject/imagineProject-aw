/**
 * A service that has util functions for Project Folder code.
 *
 * @module js/assignRemoveToProjectFolderService
 */


import AwPromiseService from 'js/awPromiseService';
import _localeSvc from 'js/localeService';
import soaService from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import messagingSvc from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import tcDefaultPasteHandler from 'js/tcDefaultPasteHandler';
import cdm from 'soa/kernel/clientDataModel';
import popupService from 'js/popupService';
import dms from 'soa/dataManagementService';

/**
 * Create button for use in confirmation messages
 *
 * @param {String} label label
 * @param {Function} callback callback
 * @return {Object} button
 */
export function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

/**
 * call soa
 *
 * @param {ARRAY}source - External Source
 * @param {ViewModelTreeNode}target - Project Folder Target
 * @param {Object}inputData - input to soa to assign project
 * @param {Boolean}pasteContext - pasteContext
 * */
function callAssignProjectSoa( source, target, inputData, pasteContext ) {
    let deferred = AwPromiseService.instance.defer();
    soaService.post( 'Core-2017-05-ProjectLevelSecurity', 'assignOrRemoveObjectsFromProjects', inputData ).then(
        function( response ) {
            let eventData = {
                sourceObjects: source,
                targetObject: target
            };
            refreshAfterAssignProject( pasteContext, eventData );
            deferred.resolve( response );
        },
        function( error ) {
            let errorMsg = error.message;
            if( errorMsg.includes( 'user_is_not_privileged' ) ) {
                errorMsg = errorMsg.split( ': ' )[ 1 ];
            }
            messagingSvc.showError( errorMsg );
        } );
    return deferred.promise;
}

/**
 * Assign Project to folder based on Folder only and Folder and content options if type if Folder
 *
 * @param {ARRAY}source - External Source
 * @param {ViewModelTreeNode}target - Project Folder Target
 * @param {Object}inputData - input to soa to assign project
 * @param {Boolean}pasteContext - pasteContext
 *  pasteContext is passed in case drag/drop
 *  pasteContext is passed in case upload content
 *  pasteContext is passed in case Add panel
 *  pasteContext is undefined in case copy/paste
 * @return promise
 */
export function assignProjectToFolderFn( source, target, inputData, pasteContext ) {
    let deferred = AwPromiseService.instance.defer();
    // check if source data included folder
    var ifFolderIncluded = source.filter( child => child.type === 'Folder' );
    if( ifFolderIncluded.length > 0 ) {
        // Confirmation should not be displayed when added from New Tab in Add panel
        // checking view for the tab
        // pasteContext.view is available only for add panel - New, Search, Pallete tab views
        if( pasteContext && pasteContext.view && pasteContext.view === 'NewTabPageSub' ) {
            callAssignProjectSoa( source, target, inputData, pasteContext ).then( function( actionResponseObj ) {
                deferred.resolve( {} );
            } );
            return deferred.promise;
        }
        // return confirmation popup with actions if selection is of the type Folder
        // Confirmation when added from Search, Pallete Tabs in Add panel
        // Confirmation when drag/drop, copy paste
        return _displayConfirmationMessage( source, target, ifFolderIncluded, inputData, pasteContext );
    }
    // For the type other than Folder, call assign action without any confirmation
    callAssignProjectSoa( source, target, inputData, pasteContext ).then( function( actionResponseObj ) {
        deferred.resolve( {} );
    } );
    return deferred.promise;
}

/**
 * Ensures object string property loaded
 *
 * @param {String[]} uidsToLoad - array of uids to load
 * @return {Promise} A promise is return which resolves after 'object_string' properties are loaded
 */
export let ensureObjectString = function( uidsToLoad ) {
    return dms.loadObjects( uidsToLoad ).then( function() {
        return dms.getProperties( uidsToLoad, [ 'object_string' ] );
    } );
};

/**
 * show confirmation messages with btns
 *
 * @param {ARRAY}source - External Source
 * @param {ViewModelTreeNode}target - Project Folder Target
 * @param {ARRAY}ifFolderIncluded - Array of source with Folder type
 * @param {Object}inputData - input to soa to assign project
 * @param {Boolean}pasteContext - pasteContext
 * @return promise
 */
export let _displayConfirmationMessage = function( source, target, ifFolderIncluded, inputData, pasteContext ) {
    // If a popup is already active just return existing promise
    var deferred = AwPromiseService.instance.defer();
    let localeTextBundle = _localeSvc.getLoadedText( 'SearchMessages' );
    var buttonArray = [];
    // hide context menu
    popupService.hide();
    //creating cancel button
    buttonArray.push( createButton( localeTextBundle.cancel, function( $noty ) {
        // after cancel, add btn on Add panel should be enable again
        // need to unregister ctx variable to get btn condition to enable
        appCtxSvc.unRegisterCtx( 'addItemEventProgressing' );
        $noty.close();
    } ) );
    //creating button to assign Project to Folder Only
    buttonArray.push( createButton( localeTextBundle.AssignRemoveProjectToFolderOnlybtn, function( $noty ) {
        $noty.close();
        callAssignProjectSoa( source, target, inputData, pasteContext ).then( function( actionResponseObj ) {
            deferred.resolve( {} );
        } );
        return deferred.promise;
    } ) );

    //creating button to assign Project to Folder and its Contents
    buttonArray.push( createButton( localeTextBundle.AssignRemoveProjectToFoldernContentbtn, function( $noty ) {
        // pass parameter depth == -1 in inputdata to assign project to folder and its content
        inputData.assignOrRemoveInput = _.forEach( inputData.assignOrRemoveInput, ( item ) => {
            if ( item.contextInfo.selectedTopLevelObject.type === 'Folder' ) {
                item.contextInfo.depth = -1;
            }
        } );
        $noty.close();
        callAssignProjectSoa( source, target, inputData, pasteContext ).then( function( actionResponseObj ) {
            deferred.resolve( {} );
        } );
        return deferred.promise;
    } ) );
    if( ifFolderIncluded.length === 1 &&  !_.isArray( target ) ) {
        // construct warning msg for single Folder to single Project
        var confirmationMessage = localeTextBundle.AssignSingleFolderToProjectConfirmation;
        var sourceObjectString = ifFolderIncluded[0].props && ifFolderIncluded[0].props.object_string && ifFolderIncluded[0].props.object_string.uiValues && ifFolderIncluded[0].props.object_string.uiValues[0] ? ifFolderIncluded[0].props.object_string.uiValues[0] : '';
        confirmationMessage = confirmationMessage.replace( '{0}', sourceObjectString );
        //this method is call to get the object_string property for the object
        //This is the case when we dragged and dropped the node and cdm.getObject is not getting object_string prop, need to get it through getProperties
        ensureObjectString( [ inputData.assignOrRemoveInput[0].projectsToAssign[0].uid ] )
            .then( function() {
                let project = cdm.getObject( inputData.assignOrRemoveInput[0].projectsToAssign[0].uid );
                var projectObjectString = project.props.object_string && project.props.object_string.uiValues && project.props.object_string.uiValues[0];
                var selProjectString = projectObjectString ? projectObjectString : '';
                confirmationMessage = confirmationMessage.replace( '{1}', selProjectString );
                messagingSvc.showWarning( confirmationMessage, buttonArray );
            } );
    }
    if( ifFolderIncluded.length > 1 &&  !_.isArray( target ) ) {
        // construct warning msg for multiple Folders to single Project
        var confirmationMessage = localeTextBundle.AssignMultipleFoldersToProjectConfirmation;
        confirmationMessage = confirmationMessage.replace( '{0}', ifFolderIncluded.length );
        //this method is call to get the object_string property for the object
        //This is the case when we dragged and dropped the node and cdm.getObject is not getting object_string prop, need to get it through getProperties
        ensureObjectString( [ inputData.assignOrRemoveInput[0].projectsToAssign[0].uid ] )
            .then( function() {
                let project = cdm.getObject( inputData.assignOrRemoveInput[0].projectsToAssign[0].uid );
                var projectObjectString = project.props.object_string && project.props.object_string.uiValues && project.props.object_string.uiValues[0];
                var selProjectString = projectObjectString ? projectObjectString : '';
                confirmationMessage = confirmationMessage.replace( '{1}', selProjectString );
                messagingSvc.showWarning( confirmationMessage, buttonArray );
            } );
    }
    if( ifFolderIncluded.length === 1 &&  _.isArray( target ) ) {
        // construct warning msg for single Folder to multiple Projects
        var confirmationMessage = localeTextBundle.AssignSingleFolderToProjectsConfirmation;
        confirmationMessage = confirmationMessage.replace( '{0}', ifFolderIncluded.length );
        confirmationMessage = confirmationMessage.replace( '{1}', target.length );
        messagingSvc.showWarning( confirmationMessage, buttonArray );
    }
    if( ifFolderIncluded.length > 1 &&  _.isArray( target ) ) {
        // construct warning msg for multiple Folders to multiple Projects
        var confirmationMessage = localeTextBundle.AssignMultipleFoldersToProjectsConfirmation;
        confirmationMessage = confirmationMessage.replace( '{0}', ifFolderIncluded.length );
        confirmationMessage = confirmationMessage.replace( '{1}', target.length );
        messagingSvc.showWarning( confirmationMessage, buttonArray );
    }
    return deferred.promise;
};

/**
 * refresh pwa and swa after assign project in case of copy/paste
 * show success notification msg for drag/drop action only
 * @param {Object}pasteContext - pasteContext
 * @param {Object}eventData - eventData to show success msg for drag/drop
 */
let refreshAfterAssignProject = function( pasteContext, eventData ) {
    // isDragDropIntent is undefined in case copy/paste
    // need to refresh pwa and swa in case of copy/paste
    let isDragDropIntent = pasteContext ? pasteContext.isDragDropIntent : undefined;
    if( pasteContext && pasteContext.targetObject.type !== 'Awp0ProjectFolder' ) {
        //If the action is performed in the hierachy of Project Data Folder and not directly under Project Folder
        //In that case assign the Project as well as create relation between the source and target
        tcDefaultPasteHandler.tcDefaultPasteHandler( pasteContext.targetObject, pasteContext.sourceObject, pasteContext.relationType );
        //else just assign the object to project
    }
    if( isDragDropIntent === undefined ) {
        let selected = appCtxSvc.getCtx( 'selected' );
        let evntdata = {
            relatedModified: [ selected ],
            createdObjects: eventData.sourceObjects
        };
        // after assignment, refresh summary of the pwa selection
        eventBus.publish( 'cdm.relatedModified', evntdata );
    }
    // isDragDropIntent is true for drag/drop
    // isDragDropIntent is false for upload panel
    else if( isDragDropIntent === true ) {
        // show success notification msg for drag/drop action only
        // call createSuccessMessageForDND
        eventBus.publish( 'dragDrop.success', eventData );
    }
};

/**
 * Remove Project from folder based on Folder only and Folder and content options if type if Folder
 *
 * @param {ARRAY}objectsToBeRemovedFromProject - Selected objects from Project Contents
 * @param {Object}inputData - input to soa to assign project
 * @param {Boolean}hideContextMenu - true if wants to hide context menu on cancel action
 * @return promise
 */
export function removeProjectFromFolderFn( objectsToBeRemovedFromProject, inputData, hideContextMenu ) {
    let deferred = AwPromiseService.instance.defer();
    // check if source data included folder
    var ifFolderIncluded = objectsToBeRemovedFromProject.filter( child => child.type === 'Folder' );
    if( ifFolderIncluded.length > 0 ) {
        // return confirmation popup with actions if selection is of the type Folder
        return _displayRemoveConfirmation( ifFolderIncluded, inputData, hideContextMenu );
    }
    soaService.postUnchecked( 'Core-2017-05-ProjectLevelSecurity', 'assignOrRemoveObjectsFromProjects', inputData )
        .then( function( response ) {
            deferred.resolve( response );
        } );

    return deferred.promise;
}

let _displayRemoveConfirmation = function( ifFolderIncluded, inputData, hideContextMenu ) {
    // If a popup is already active just return existing promise
    var deferred = AwPromiseService.instance.defer();
    let localeTextBundle = _localeSvc.getLoadedText( 'SearchMessages' );
    var buttonArray = [];
    // hide context menu
    if( hideContextMenu ) {
        popupService.hide();
    }
    //creating cancel button
    buttonArray.push( createButton( localeTextBundle.cancel, function( $noty ) {
        $noty.close();
    } ) );
    //creating button to remove Project from Folder Only
    buttonArray.push( createButton( localeTextBundle.AssignRemoveProjectToFolderOnlybtn, function( $noty ) {
        soaService.postUnchecked( 'Core-2017-05-ProjectLevelSecurity', 'assignOrRemoveObjectsFromProjects', inputData )
            .then( function( response ) {
                $noty.close();
                deferred.resolve( response );
            } );
    } ) );
    //creating button to remove Project from Folder and its Contents
    buttonArray.push( createButton( localeTextBundle.AssignRemoveProjectToFoldernContentbtn, function( $noty ) {
        // pass parameter depth == -1 in inputdata to assign project to folder and its content
        inputData.assignOrRemoveInput = _.forEach( inputData.assignOrRemoveInput, ( item ) => {
            if ( item.contextInfo.selectedTopLevelObject.type === 'Folder' ) {
                item.contextInfo.depth = -1;
            }
        } );
        soaService.postUnchecked( 'Core-2017-05-ProjectLevelSecurity', 'assignOrRemoveObjectsFromProjects', inputData )
            .then( function( response ) {
                $noty.close();
                deferred.resolve( response );
            } );
    } ) );
    var uniqueArray = [];
    var targetArray = [];

    _.forEach( inputData.assignOrRemoveInput, ( item ) => {
        uniqueArray.push( item.projectsForRemoval[0].uid );
    } );
    targetArray = _.uniq( uniqueArray );

    if( ifFolderIncluded.length === 1 &&  targetArray.length === 1 ) {
        // construct warning msg to remove single Folder from single Project
        var confirmationMessage = localeTextBundle.RemoveSingleFolderFromProjectConfirmation;
        var sourceObjectString = ifFolderIncluded[0].props && ifFolderIncluded[0].props.object_string && ifFolderIncluded[0].props.object_string.uiValues && ifFolderIncluded[0].props.object_string.uiValues[0] ? ifFolderIncluded[0].props.object_string.uiValues[0] : '';
        //this method is call to get the object_string property for the object
        //if cdm.getObject is not getting object_string prop, need to get it through getProperties
        ensureObjectString( [ targetArray[0] ] )
            .then( function() {
                let project = cdm.getObject( targetArray[0] );
                var projectObjectString = project.props.object_string && project.props.object_string.uiValues && project.props.object_string.uiValues[0];
                confirmationMessage = confirmationMessage.replace( '{0}', sourceObjectString );
                confirmationMessage = confirmationMessage.replace( '{1}', projectObjectString );
                messagingSvc.showWarning( confirmationMessage, buttonArray );
            } );
    } else if( ifFolderIncluded.length > 1 &&  targetArray.length === 1 ) {
        var confirmationMessage = localeTextBundle.RemoveMultipleFoldersFromProjectConfirmation;
        confirmationMessage = confirmationMessage.replace( '{0}', ifFolderIncluded.length );

        //this method is call to get the object_string property for the object
        //if cdm.getObject is not getting object_string prop, need to get it through getProperties
        ensureObjectString( [ targetArray[0] ] )
            .then( function() {
                let project = cdm.getObject( targetArray[0] );
                var projectObjectString = project.props.object_string && project.props.object_string.uiValues && project.props.object_string.uiValues[0];
                confirmationMessage = confirmationMessage.replace( '{1}', projectObjectString );
                messagingSvc.showWarning( confirmationMessage, buttonArray );
            } );
    } else if( ifFolderIncluded.length > 1 &&  targetArray.length > 1 ) {
        var confirmationMessage = localeTextBundle.RemoveMultipleFoldersFromProjectsConfirmation;
        confirmationMessage = confirmationMessage.replace( '{0}', ifFolderIncluded.length );
        confirmationMessage = confirmationMessage.replace( '{1}', targetArray.length );
        messagingSvc.showWarning( confirmationMessage, buttonArray );
    }
    return deferred.promise;
};
const projectFolderUtils = {
    assignProjectToFolderFn,
    removeProjectFromFolderFn,
    ensureObjectString,
    _displayConfirmationMessage
};

export default projectFolderUtils;
