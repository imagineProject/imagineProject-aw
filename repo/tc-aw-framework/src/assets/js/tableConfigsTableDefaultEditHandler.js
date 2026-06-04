// Copyright (c) 2024 Siemens

/**
 *  tableConfigsTableDefaultEditHandler
 *
 *  Implementation for tableConfigsTableDefaultEditHandler
 *  @module js/tableConfigsTableDefaultEditHandler
 *
 /**
 * Implementation for TableConfigsTableDefaultEditHandler
 */

import tableConfigsEditHandlerExtService from 'js/tableConfigsEditHandlerExtService';
import leavePlaceService from 'js/leavePlace.service';
import { EditHandler } from 'js/editHandlerFactory';
import AwPromiseService from 'js/awPromiseService';
import messagingSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import viewModelObjectService from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';

// default class TableConfigsTableDefaultEditHandler
export default class TableConfigsTableDefaultEditHandler extends EditHandler {
    constructor( dataSource, editSupportParams, configContext, wrapTextState, tableConfigState ) {
        super( dataSource, editSupportParams );
        this.configContext = configContext;
        this.wrapTextState = wrapTextState;
        this.tableConfigState = tableConfigState;
    }

    /**
     * Starts the edit process with the given options.
     *
     * @param {Object} editOptions - The options for editing.
     * @returns {Promise} A promise that resolves when the edit process is started.
     */
    startEdit( editOptions ) {
        this._leaveHandler = {
            okToLeave: ( targetNavDetails, newLocation, oldLocation )  => {
                // Skip leaveConfirmation if editSupportParamKeys are the only part of the url that is changing.
                if( this.editSupportParamKeys && newLocation && oldLocation && this.onlyEditSupportParamsChanging( newLocation, oldLocation ) ) {
                    return Promise.resolve( { clearLeaveHandler: false } );
                }
                return this.leaveConfirmation();
            }
        };
        leavePlaceService.registerLeaveHandler( this._leaveHandler );

        const isPropEditing = Boolean( editOptions );

        if( !editOptions ) {
            this._editing = true;
        }

        let viewModelObjectList = this.dataSource.getLoadedViewModelObjects();

        // Get list of UIDs
        let uidToVMMap = {};
        if( isPropEditing ) {
            _.forEach( editOptions.vmos, function( viewModelObject ) {
                if( !uidToVMMap[ viewModelObject.uid ] ) {
                    uidToVMMap[ viewModelObject.uid ] = [ viewModelObject ];
                }
            } );
        } else if( viewModelObjectList !== null ) {
            _.forEach( viewModelObjectList, function( viewModelObject ) {
                if( !uidToVMMap[ viewModelObject.uid ] ) {
                    uidToVMMap[ viewModelObject.uid ] = [ viewModelObject ];
                }
            } );
        }

        return tableConfigsEditHandlerExtService.loadColumnProperties( this.wrapTextState, this.configContext, this.tableConfigState ).then( ( response ) => {
            if( this._isDestroyed ) {
                return;
            }
            if ( response?.loadedColumns ) {
                let loadedObjects = this.dataSource.getLoadedViewModelObjects();
                _.forEach( response.loadedColumns, function( serverVMO ) {
                    if ( serverVMO.uid ) {
                        let exisitingVMOs = uidToVMMap[ serverVMO.uid ] ? uidToVMMap[ serverVMO.uid ] : loadedObjects;
                        viewModelObjectService.updateSourceObjectPropertiesByViewModelObject( serverVMO, exisitingVMOs );
                    }
                } );
            }

            if( isPropEditing ) {
                for( let j = 0; j < editOptions.vmos.length; j++ ) {
                    for( let i = 0; i < editOptions.propertyNames.length; i++ ) {
                        const prop = editOptions.vmos[ j ].props[ editOptions.propertyNames[ i ] ];
                        uwPropertyService.setEditable( prop, true );
                        uwPropertyService.setEditState( prop, true, true, true );
                    }
                }

                this.addSaveListener( editOptions );
            } else {
                this.notifySaveStateChanged( 'starting', true );
            }
            return response;
        }, ( error ) => {
            this._editing = false;
        } );
    }

    /**
     * Saves the edits made to the table configurations.
     *
     * @param {boolean} isPartialSaveDisabled - Flag indicating if partial save is disabled.
     * @param {boolean} isAutoSave - Flag indicating if the save is an auto-save.
     * @returns {Promise} A promise that resolves when the save operation is complete.
     */
    saveEdits( isPartialSaveDisabled, isAutoSave ) {
        _.forEach( this.preSaveActions, function( value ) {
            value();
        } );
        let hasValidationErrors = false;
        let editableViewModelProperties = this.dataSource.getAllEditableProperties();
        for( let prop of editableViewModelProperties ) {
            if( prop.error && prop.error.length > 0 ) {
                hasValidationErrors = true;
                break;
            }
        }

        if( hasValidationErrors ) {
            messagingSvc.showError( this._validationError );
            if( isPartialSaveDisabled ) {
                this.notifySaveStateChanged( 'canceling', false );
            }
            return AwPromiseService.instance.reject( this._validationError );
        }

        // Ensure editing flag is set temporarily to ensure correct saveHandler is retrieved
        if( isAutoSave ) {
            this._editing = true;
            appCtxSvc.updateCtx( 'editInProgress', this._editing );
        }

        let modifiedViewModelProperties = this.dataSource.getAllModifiedProperties();
        let modifiedPropsMap = this.dataSource.getModifiedPropertiesMap( modifiedViewModelProperties );

        return tableConfigsEditHandlerExtService.saveEdit( modifiedPropsMap, this.configContext ).then( ( response ) => {
            if( response ) {
                let error = null;

                if( response.partialErrors || response.PartialErrors ) {
                    error = soaSvc.createError( response );
                } else if( response.ServiceData?.partialErrors ) {
                    error = soaSvc.createError( response.ServiceData );
                }

                let savedUids = [];
                _.forEach( response.columns, currentColumn => savedUids.push( currentColumn.uid ) );

                if ( error ) {
                    let failureUids = [];
                    _.forEach( modifiedPropsMap, modifiedObj => {
                        let currentColumn = modifiedObj.viewModelObject;
                        if ( savedUids.includes( currentColumn.uid ) ) {
                            return;
                        }
                        failureUids.push( currentColumn.uid );
                    } );

                    // need to update the LSD for the partial saved VMOs
                    // EditHandler.updateLsdForPartialSavedVmos( response.viewModelObjectsJsonString, modifiedPropsMap );

                    if( isPartialSaveDisabled ) {
                        this.notifySaveStateChanged( 'canceling', false );
                    } else {
                        this.notifySaveStateChanged( 'partialSave', false, failureUids, modifiedPropsMap );
                    }

                    let errMessage = messagingSvc.getSOAErrorMessage( error );
                    messagingSvc.showError( errMessage );
                }

                if ( tableConfigsEditHandlerExtService.isTableLoadNecessary( modifiedPropsMap ) ) {
                    // Retrieve and load the updated columns
                    tableConfigsEditHandlerExtService.loadColumnProperties( this.wrapTextState, this.configContext, this.tableConfigState ).then( ( response ) => {
                        if( response?.loadedColumns ) {
                            let loadedObjects = this.dataSource.getLoadedViewModelObjects();
                            _.forEach( response.loadedColumns, function( serverVMO ) {
                                if ( savedUids.includes( serverVMO.uid ) ) {
                                    let exisitingVMOs = loadedObjects.filter( vmo => vmo.uid === serverVMO.uid );
                                    viewModelObjectService.updateSourceObjectPropertiesByViewModelObject( serverVMO, exisitingVMOs );
                                }
                            } );
                        }
                    } );
                }

                if ( error ) {
                    return AwPromiseService.instance.resolve();
                }
            }
            this.saveEditsPostActions( true );
            return AwPromiseService.instance.resolve();
        }, error => {
            if( error ) {
                if( isPartialSaveDisabled ) {
                    this.notifySaveStateChanged( 'canceling', false );
                }
                return AwPromiseService.instance.reject( error );
            }
            return AwPromiseService.instance.resolve();
        } );
    }
}
