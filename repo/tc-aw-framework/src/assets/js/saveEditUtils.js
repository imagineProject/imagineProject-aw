import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import preferenceService from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';

let exports = {};

export const determineMultiUserEditWarning = ( error, inputVMOs, i18n ) => {
    let errorMessage;
    if( error.length === 1 ) {
        let conflictObj;
        if( inputVMOs.length === 1 ) {
            conflictObj = inputVMOs[0].props.object_name.dbValue;
        } else{
            conflictObj = error[0].errorValues[0].message;
            conflictObj = conflictObj.split( '"' );
            conflictObj = conflictObj[1];
        }
        errorMessage = i18n.multiUserEditWarning;
        errorMessage = errorMessage.replace( '{0}', conflictObj );
    } else{
        errorMessage = i18n.multiUserEditWarningMultiple;
        errorMessage = errorMessage.replace( '{0}', error.length );
        errorMessage = errorMessage.replace( '{1}', inputVMOs.length );
    }
    return { errorMessage: errorMessage };
};

export const updatePreferenceFlag = ( prefValue ) => {
    prefValue = !prefValue;
    return prefValue;
};

export const updateAutoMergePreference = ( ) => {
    preferenceService.setStringValue( 'AWC_AutoMergeConcurrentEdits', [ 'true' ] ).then( () =>
        appCtxSvc.updatePartialCtx( 'preferences.AWC_AutoMergeConcurrentEdits', [ 'true' ] ) );
};

export const saveEdits = async( inputs, editHandler ) => {
    let deferred = AwPromiseService.instance.defer();

    let isAutoMerge = appCtxSvc.getCtx( 'preferences.AWC_AutoMergeConcurrentEdits[0]' );
    if( isAutoMerge === 'true' ) {
        inputs.map( input => {
            input.isOverride = true;
        } );
    }
    await dms.saveViewModelEditAndSubmitWorkflow( inputs ).then( response => {
        if( response ) {
            let error = null;

            if( response.partialErrors || response.PartialErrors ) {
                error = soaSvc.createError( response );
            } else if( response.ServiceData && response.ServiceData.partialErrors ) {
                error = soaSvc.createError( response.ServiceData );
            }

            if( error ) {
                let failureUids = [];
                let partialErrors = error.cause.partialErrors;
                let showSaveConflicts = false;
                _.forEach( partialErrors, partialError => failureUids.push( partialError.clientId ) );
                for( let partialError in partialErrors ) {
                    if( partialErrors[partialError]?.errorValues[0]?.code === 141023 ) {
                        showSaveConflicts = true;
                        break;
                    }
                }

                if( showSaveConflicts ) {
                    inputs.map( input => {
                        input.isOverride = true;
                    } );
                    let subPanelContext = {
                        inputs: inputs,
                        error: error.cause.partialErrors,
                        overideSaved: false
                    };
                    let whenClosed = function( popupRef ) {
                        if ( popupRef.options.subPanelContext.overideSaved ) {
                            return deferred.resolve( response );
                        }
                        return deferred.resolve();
                    };
                    let options = {
                        view: 'SaveConflictsConfirmation',
                        caption: 'Conflicting Values',
                        parent: '.aw-layout-workarea',
                        width: 600,
                        draggable: true,
                        clickOutsideToClose: false,
                        hasCloseButton: true,
                        subPanelContext: subPanelContext,
                        hooks: {
                            whenClosed: whenClosed
                        }
                    };
                    popupService.show( options );
                } else{
                    return deferred.reject( error );
                }
            }
            if( editHandler ) {
                editHandler.dataSource.saveEditiableStates();
                editHandler.removeSaveListener();
                editHandler._editing = false;
                if( editHandler.editStateChangeDispatcher ) {
                    editHandler.editStateChangeDispatcher( {
                        type: 'SET_EDIT_STATE_CHANGED',
                        value: editHandler._editing
                    } );
                }

                appCtxSvc.updateCtx( 'editInProgress', editHandler._editing );

                let context = {
                    state: 'saved'
                };

                context.dataSource = editHandler.dataSource.getSourceObject();
                eventBus.publish( 'editHandlerStateChange', context );
            }
            if( !error ) {
                return deferred.resolve( response );
            }
        } else{
            return deferred.resolve();
        }
    } );
    return deferred.promise;
};

export const saveSelectedFlag = function( popupOptions ) {
    popupOptions.userOptions.subPanelContext.overideSaved = true;
};

exports = {
    determineMultiUserEditWarning,
    updatePreferenceFlag,
    updateAutoMergePreference,
    saveEdits,
    saveSelectedFlag
};
export default exports;
