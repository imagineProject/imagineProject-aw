// Copyright (c) 2024 Siemens

/**
 * aceEditHandlerExtService
 *
 *  Registration and extension service for ACE applications to use custom EditHandler
 *  @module js/aceEditHandlerExtService
 *
 */
import editHandlerService from 'js/editHandlerService';
import _ from 'lodash';

var exports = {};

var appHandlerFunctions = [];

/**
 * set active EditHandler
 */
export let setEditHandler = function( editHandler, editContext ) {
    editHandlerService.setEditHandler( editHandler, editContext );
    editHandlerService.setActiveEditHandlerContext( editContext );
};

/**
 * register the AppEditHandlerFunctions
 * This function will register application Edit Handlers with ACE
 */
export let registerAppEditHandlerFunctions = function( appHandlerFunc ) {
    appHandlerFunctions.push( appHandlerFunc );
};

/**
 * execute the AppEditHandlers
 * This function will execute the application Edit Handlers
 */
export let executeAppEditHandlers = function() {
    for( let i = 0; i < appHandlerFunctions.length; i++ ) {
        appHandlerFunctions[ i ]( arguments );
    }
};

/**
 * clear the AppEditHandlers
 */
export let clearAppEditHandlers = function() {
    appHandlerFunctions = [];
};

export default exports = {
    setEditHandler,
    registerAppEditHandlerFunctions,
    executeAppEditHandlers,
    clearAppEditHandlers
};
