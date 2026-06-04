// Copyright (c) 2022 Siemens

/**
 * @module js/aceInlineAuthEditService
 */

import AwPromiseService from 'js/awPromiseService';
import _appCtxSvc from 'js/appCtxService';
import _leavePlaceService from 'js/leavePlace.service';
import _localeSvc from 'js/localeService';
import _notyService from 'js/NotyModule';

import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';

let _singleLeaveConfirmation = null;
let _saveTxt = null;
let _discardTxt = null;
let _callBackObj = null;

export const _notifySaveStateChanged = function( stateName ) {
    if( self.dataSource ) {
        switch ( stateName ) {
            case 'starting':
                break;
            case 'saved':
                self.dataSource.saveEditiableStates();
                break;
            case 'canceling':
                self.dataSource.resetEditiableStates();
                break;
            case 'reset':
                break;
            default:
                logger.error( 'Unexpected stateName value: ' + stateName );
        }

        self._editing = stateName === 'starting';
        // Add to the appCtx about the editing state

        _appCtxSvc.updateCtx( 'editInProgress', self._editing );

        const context = {
            state: stateName
        };
        context.dataSource = self.dataSource.getSourceObject();
        eventBus.publish( 'editHandlerStateChange', context );
    }
};

/*Start editing*/
export const startEdit = function( callBackObj ) {
    _callBackObj = callBackObj;
    exports.loadConfirmationMessage();
    exports._notifySaveStateChanged( 'starting', true );
    //Register with leave place service
    _leavePlaceService.registerLeaveHandler( {
        okToLeave: function() {
            return exports.leaveConfirmation();
        }
    } );
};

/**
  * Can we start editing?
  *
  * @return {Boolean} true if we can start editing
  */
export const canStartEdit = function() {
    return true;
};

/**
  * Is an edit in progress?
  *
  * @return {Boolean} true if we're editing
  */
export const editInProgress = function() {
    return self._editing;
};

/**
  * Get data source
  * @return {Object} data source
  */
export const getDataSource = function() {
    return self.dataSource;
};

/**
 * Set data source
 * @param {Object} newDataSource data source
 */
export const setDataSource = function( newDataSource ) {
    self.dataSource = newDataSource;
};

/**
  * @param {boolean} noPendingModifications  pending Notifications
  */
export const cancelEdits = function( noPendingModifications ) {
    exports._notifySaveStateChanged( 'canceling', self.dataSource, !noPendingModifications );
    exports.cleanup();
};

/**
 * Save Edits
 * @return {Object} promise
 */
export const saveEdits = function() {
    const promise = _callBackObj.saveEdits();
    exports.cleanup();
    return promise;
};

/* Check if row is Dirty */
export const isDirty = function() {
    // Return isDirty flag as per GRID editable state
    return exports.editInProgress();
};


const createButton = function( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
};

// message Showing as Popup
export const displayNotificationMessage = function() {
    // If a popup is already active just return existing promise
    if( !self._deferredPopup ) {
        self._deferredPopup = AwPromiseService.instance.defer();

        const message = _singleLeaveConfirmation;
        const buttonArray = [];
        buttonArray.push( createButton( _saveTxt, function( $noty ) {
            $noty.close();
            exports.saveEdits().then( function() {
                self._deferredPopup.resolve();
                self._deferredPopup = null;
            }, function() {
                self._deferredPopup.resolve();
                self._deferredPopup = null;
            } );
        } ) );
        buttonArray.push( createButton( _discardTxt, function( $noty ) {
            $noty.close();
            exports.cancelEdits();
            _callBackObj.cancelEdits();
            self._deferredPopup.resolve();
            self._deferredPopup = null;
        } ) );
        _notyService.showWarning( message, buttonArray );
        return self._deferredPopup.promise;
    }
    return self._deferredPopup.promise;
};

/**
  *   this is edit service leaveConfirmation in which call comes for ace edit service
  *   if viewMode Has been Changed to any of the summary view to Non summary view then directly show the PopUp
  *
  *   @param {Object} callback callBack Function
  *   @returns {leaveConfirmation}  promise Object
  */
export const leaveConfirmation = function( callback ) {
    if( exports.isDirty() ) {
        return exports.displayNotificationMessage().then( function() {
            if( callback && _.isFunction( callback ) ) {
                callback();
            }
        } );
    }
    return AwPromiseService.instance.resolve();
};

/**
  *load the message from message bundle
  */
export const loadConfirmationMessage = function() {
    if( _localeSvc ) {
        _localeSvc.getTextPromise( 'OccmgmtInlineAuthMessages' ).then(
            function( textBundle ) {
                _singleLeaveConfirmation = textBundle.resetConfirmation;
            } );

        _localeSvc.getTextPromise( 'OccurrenceManagementConstants' ).then(
            function( textBundle ) {
                _saveTxt = textBundle.saveButtonText;
                _discardTxt = textBundle.discard;
            } );
    }
};

// clean up handlers.
export const cleanup = function() {
    _leavePlaceService.registerLeaveHandler( null );
};

const exports = {
    _notifySaveStateChanged,
    startEdit,
    canStartEdit,
    editInProgress,
    getDataSource,
    setDataSource,
    cancelEdits,
    saveEdits,
    isDirty,
    displayNotificationMessage,
    leaveConfirmation,
    loadConfirmationMessage,
    cleanup
};

export default exports;
