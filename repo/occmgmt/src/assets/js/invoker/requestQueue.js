/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * Facilitates tree load and configuration requests in background when server is idle.
 *
 * @module js/invoker/requestQueue
 */

import invoker from 'js/invoker/invoker';
import eventBus from 'js/eventBus';
import _ from 'lodash';

// Global array of requests. Request[0] is current.
var activeRequests = [];

let _eventSubDefs = [];
let _eventList = [ 'toggleInContextOverrideOnSelectedParentAssembly',
    'occurrenceUpdatedByEffectivityEvent',
    'insertElement.insertObjectToSelectedElement',
    'insertLevel.elementsInserted',
    'performPostRemoveLevelAction',
    'ace.replaceRowsInTree',
    'ace.elementsRemoved',
    'replaceElement.elementReplacedSuccessfully',
    'replaceElement.replaceSelectedElement',
    'preRemoveLevelAction'

];

/**
 * Cancel all requests, both active and queued
 */
function cancelAllRequests() {
    if ( activeRequests.length > 0 ) {
        console.log( 'cancelling ' + activeRequests.length + ' active requests' );
        activeRequests = [];
        invoker.stop();
    }
}

/**
 * Add a new request to the head of the queue, and execute it ASAP
 * @param {Request} request request to add
 */
function stackRequest( request ) {
    console.log( 'adding request ' + request.id + ' at start of queue'  );
    activeRequests.unshift( request );
}

/**
 * Add a new request to the tail of the queue and execute it in turn
 * @param {Request} request request to be added
 */
function queueRequest( request ) {
    console.log( 'adding request ' + request.id + ' at end of queue'  );
    activeRequests.push( request );
}

/**
 * Remove a request (finished, active, or pending) from the queue
 * @param {Request} request to be removed
 */
function removeRequest( request ) {
    console.log( 'removing request ' + request.id + ' from queue'  );
    activeRequests = activeRequests.filter( function( r ) {
        return r !== request;
    } );
}

class Request {
    constructor( requestId, chain ) {
        this.id = requestId;
        this.firstInChain = chain;
    }

    invokeNext() {
        if ( this.firstInChain === null ) {
            console.trace( 'Request ' + this.id + ' has no chain of responsibility!' );
            return undefined;
        }
        console.log( 'Request: ' + this.id + ' invoking next' );
        return this.firstInChain.invokeNext();
    }

    setFinished() {
        this.firstInChain = null;
        removeRequest( this );
    }
}

/**
 * Add a request to the queue and run it immediately or later
 * @param {String} requestId for logging
 * @param {*} chain chain of responsibility
 * @param {*} mode { replace / stack / queue }
 */
export let queue = function( requestId, chain, mode ) {
    console.log( 'Queuing request: ' + requestId );
    let request = new Request( requestId, chain );
    if ( mode.replace ) {
        cancelAllRequests();
        stackRequest( request );
    } else if ( mode.stack ) {
        stackRequest( request );
    } else if ( mode.queue ) {
        queueRequest( request );
    }

    invoker.startLoop();
};

/**
 * @returns {bool} true if any requests are active
 */
export let active = function() {
    return activeRequests.length > 0;
};

/**
 * @returns {Request} current request, or undefined if none
 */
export let current = function() {
    return activeRequests[0];
};

/**
 * Cancels all requests (active and queued)
 */
export let cancelAll = function() {
    cancelAllRequests();
};

export let initialize = function() {
    _.forEach( _eventList, function( event ) {
        _eventSubDefs.push( eventBus.subscribe( event, function() {
            if( active() ) {
                cancelAll();
            }
        } ) );
    } );
};

export let destroy = function() {
    _.forEach( _eventSubDefs, function( event ) {
        eventBus.unsubscribe( event );
    } );
};

const exports = {
    active,
    queue,
    cancelAll,
    current,
    initialize,
    destroy
};
export default exports;
