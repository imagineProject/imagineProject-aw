/* eslint-disable no-console */
// Copyright (c) 2024 Siemens

/**
 * appPropertyCallProvider
 *
 * Responsible for providing a sequence of property calls for ACE application's using TreedataProvider
 * to be invoked during a tree load user action. Interacts with tree context
 * to choose best ordering/parameterisation of the calls.
 *
 * Called only by invoker.
 *
 * @module js/invoker/appPropertyCallProvider
 */

import _ from 'lodash';

export default class AppPropertyCallProvider {
    // Construct AppPropertyCallProvider
    constructor( commandContext, nextInChain, backGroundCall, getPropertiesCallBack ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.occContext = commandContext.occContext;
        this.backGroundCall = backGroundCall;
        this.getPropertiesCallBack = getPropertiesCallBack;
    }

    invokeNext( requestVMTNs ) {
        if( requestVMTNs.length === 0 ) {
            return { calls: 0, finished: true };
        }

        this.count++;
        let callId = 'props_' + this.count;
        console.log( callId + ': AppPropertyCallProvider_invokeNext' );

        let callType = 'foreground';
        if( this.count > 1 || this.backGroundCall === true ) {
            callType = 'background';
        }

        this.getPropertiesCallBack( requestVMTNs, callType ).then( function() {
            return { calls: 1, type: callType, nextAction: 'async', finished: false };
        } );
        return { calls: 1, type: callType, nextAction: 'async', finished: false };
    }
}
