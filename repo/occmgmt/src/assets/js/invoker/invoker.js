// Copyright (c) 2022 Siemens

/**
 * Facilitates tree loading in background when server is idle.
 *
 * @module js/invoker/invoker
 */
/* eslint-disable no-console */
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import requestQueue from 'js/invoker/requestQueue';

class Invoker {
    constructor() {
        this.start = undefined;
        this.calls = [];
        this.eventSubscription = undefined;
        this.initialize();
    }

    initialize() {
        this.eventSubscription = eventBus.subscribe( 'progress.end', this.onProgressEnd.bind( this ) );
    }
    // Call directly to discard the invoker, and stop current action
    destroy() {
        this.firstInChain = null;
        this.calls = [];
    }

    invokeNext() {
        var request = requestQueue.current();
        if ( !request ) {
            return undefined;
        }
        console.log( 'invoker: invoking next for: ' + request.id );
        var result = request.invokeNext();
        if ( result.calls > 0 ) {
            this.calls.push( { request: request, startTime: Date.now(), foreground: result.type === 'foreground',
                estimatedDuration: result.time, nextCall: result.nextCall } );
            console.log( 'invoker: triggered ' + result.calls + ' calls, predicted ' + result.time + 'ms' );
        }
        if ( result.finished ) {
            console.log( 'invoker: received "no more work" from the chain. Shutting down request: ' + request.id );
            // Clear the added column names once all background calls are complete.
            if( request && request.firstInChain && request.firstInChain.uwDataProvider && request.firstInChain.uwDataProvider.aceAddedColumnNames ) {
                request.firstInChain.uwDataProvider.aceAddedColumnNames = [];
            }
            request.setFinished();
        }
        return result;
    }

    unrelatedCallActive() {
        let numForeground = 0;
        for ( let call of this.calls ) {
            if ( call.foreground ) {
                ++numForeground;
            }
        }
        return soaSvc.getPendingRequestsCount() - numForeground > 0;
    }

    callFinished( callId ) {
        let now = Date.now();
        let duration = 0;
        if( this.calls.length > 0 ) {
            duration = now - this.calls[0].startTime;
            this.calls.shift();
        }
        console.log( 'invoker: ' + callId + ' finished in ' + duration + 'ms (' + this.calls.length + ' calls now active)' );
        if ( this.calls.length > 0 ) {
            this.calls[0].startTime = now;
        }
        // Trigger a potential next if it's the right time
        console.log( 'invoker: received "our call finished" callback' );
        this.callbackLoopTrigger();
        return duration;
    }

    invokeNextIf() {
        const timerResolution = 15;
        const latency = 50; // todo: discover this
        const estimateReliabilityFactor = 0.9;
        let nextLoopIn = undefined;
        if ( this.calls.length >= 2 ) {
            // do nothing. We'll get a call when the first of our calls is finished
        } else if ( this.unrelatedCallActive() ) {
            // do nothing. We'll get a call via events when the unrelated call is finished
        } else {
            // SOA is not too busy for us to do something
            if ( this.calls.length === 0 ) {
                // If we have no calls active, then it's the right time
                let result = this.invokeNext();
                if ( !result || result.finished ) {
                    return undefined;
                }
            }
            if ( this.calls.length === 1 && this.calls[0].nextCall === 'async' ) {
                // If we (previously, or now) have one call active, are we close to its expected end time?
                let expectedEnd = this.calls[0].startTime + this.calls[0].estimatedDuration * estimateReliabilityFactor;
                let executeIn = expectedEnd - latency - Date.now();
                if ( executeIn < timerResolution ) {
                    this.invokeNext();
                    // now, we have two calls active so don't need to schedule another
                } else {
                    nextLoopIn = executeIn;
                }
            }
        }
        return nextLoopIn;
    }

    callbackLoopTrigger() {
        console.log( 'invoker: triggering next on call finished callback' );
        let nextLoop = this.invokeNextIf();
        if ( nextLoop !== undefined ) {
            setTimeout( this.timerLoopTrigger.bind( this ), nextLoop );
        }
    }

    timerLoopTrigger() {
        console.log( 'invoker: triggering next on timer' );
        let nextLoop = this.invokeNextIf();
        if ( nextLoop !== undefined ) {
            setTimeout( this.timerLoopTrigger.bind( this ), nextLoop );
        }
    }

    directUserCallLoopTrigger() {
        console.log( 'invoker: triggering next on end of direct user call' );
        let nextLoop = this.invokeNextIf();
        if ( nextLoop !== undefined ) {
            setTimeout( this.timerLoopTrigger.bind( this ), nextLoop );
        }
    }

    startLoop() {
        console.log( 'invoker: triggering next on startup/new request queue' );
        let nextLoop = this.invokeNextIf();
        if ( nextLoop !== undefined ) {
            setTimeout( this.timerLoopTrigger.bind( this ), nextLoop );
        }
    }

    onProgressEnd() {
        // An unrelated call or foreground call invoked by us has finished.
        // We cannot distinguish between these two call types (I think).
        // The event is published prior to the call promise being resolved,
        // and this call seems to appear prior that too
        // Anyhow, give our loop a shot at executing now, unless our earliest
        // active call returned a 'nextCall' type of 'sync'.
        // Background calls do not trigger events so will not come here.
        if ( this.calls.length === 0 || this.calls[0].nextCall !== 'sync' ) {
            this.directUserCallLoopTrigger();
        }
    }
}

var anInvoker = undefined;

/**
 * Start the invoker event loop
 */
export const startLoop = function() {
    if ( !anInvoker ) {
        anInvoker = new Invoker();
    }
    anInvoker.startLoop();
};

/**
 * Indicate to the global invoker that the call (invoked by it) has now finished
 * @param {String} callId callId used in the original call invokation
 * @return {int} time in ms measured for this function
 */
export const callFinished = function( callId ) {
    return anInvoker.callFinished( callId );
};

/**
 * Stop all calls
 */
export const stop = function(  ) {
    return anInvoker.destroy(  );
};

const exports = {
    callFinished,
    startLoop,
    stop
};
export default exports;
