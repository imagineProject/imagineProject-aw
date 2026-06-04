// Copyright (c) 2024 Siemens

/**
 *  pca0DefaultEditHandler
 *
 * Implementation for ConfiguratorDefaultEditHandler
 * This will be the default edit handler for Configurator module
 *  @module js/pca0DefaultEditHandler
 *
 */

import AwPromiseService from 'js/awPromiseService';
import { EditHandler } from 'js/editHandlerFactory';
import notySvc from 'js/NotyModule';
import _ from 'lodash';

// default class Default Edit Handler in Configurator module
export default class ConfiguratorDefaultEditHandler extends EditHandler {
    constructor(
        contextKey,
        editContext,
        dataSource,
        editSupportParams,
        isDirtyFn,
        saveEditsFn,
        cancelEditsFn,
        startEditFn,
        declViewModel,
        unsavedEditsMessage,
        gridEditorMode ) {
        super( dataSource, editSupportParams );
        this.contextKey = contextKey;
        this.editContext = editContext;
        this.isDirtyFn = isDirtyFn;
        this.saveEditsFn = saveEditsFn;
        this.cancelEditsFn = cancelEditsFn;
        this.startEditFn = startEditFn;
        this.declViewModel = declViewModel;
        this.unsavedEditsMessage = unsavedEditsMessage;
        this.gridEditorMode = gridEditorMode;
    }

    getEditHandlerContext() {
        return this.contextKey;
    }

    isDirty() {
        return Promise.resolve( this.isDirtyFn( this.declViewModel ) );
    }

    saveEdits() {
        return Promise.resolve( this.saveEditsFn( this.declViewModel.atomicDataRef, this.gridEditorMode ) );
    }

    cancelEdits() {
        this.cancelEditsFn( this.declViewModel );
    }

    startEdit( editOptions ) {
        return this.startEditFn( this.declViewModel, editOptions );
    }

    // Override: displayNotyMessage
    // ER LCS-1097196 filed to Framework team to have displayNotyMessage:
    // 1- accept parameter with custom message args
    // 2- not overriding logic for prompt message
    // This way, we wouldn't need to duplicate the logic for displaying the popup
    displayNotyMessage() {
        // If a popup is already active just return existing promise
        if( !_.isNil( this._deferredPopup ) ) {
            return this._deferredPopup.promise;
        }

        // Create new Promise
        this._deferredPopup = AwPromiseService.instance.defer();

        // Create buttons for 'Unsaved Edits' prompt
        let buttonArray = [];
        buttonArray.push( this.createButton( this._discardTxt /* "Discard" */, ( $noty ) => {
            $noty.close();
            this.cancelEdits( );
            this._deferredPopup.resolve();
            this._deferredPopup = null;
        } ) );
        buttonArray.push( this.createButton( this._saveTxt /* "Save" */, ( $noty ) => {
            $noty.close();
            this.saveEdits( true ).then( () => {
                this._deferredPopup.resolve();
                this._deferredPopup = null;
            }, () => {
                this._deferredPopup.resolve();
                this._deferredPopup = null;
            } );
        } ) );
        notySvc.showWarning( this.unsavedEditsMessage, buttonArray );

        return this._deferredPopup.promise;
    }
}
