/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * ReconfigureWindowCallProvider
 * 
 * Responsible for providing a sequence of getOccurrences4 calls to be invoked
 * during a user action that has triggered a ReconfigureWindow (pack all, change
 * revrule, etc). Receives changes either as full or delta response.
 * 
 * Called only by invoker.
 *
 * @module js/invoker/reconfigureWindowCallProvider
 */

import soaSvc from 'soa/kernel/soaService';
import occmgmtGetSvc from 'js/aceGetService';
import occurrencesLoader from 'js/invoker/occurrencesLoader';
import invoker from 'js/invoker/invoker';

export default class ReconfigureWindowCallProvider {
    constructor( occContext, expansionCriteria, nextInChain ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.gotFirstProps = false;
        this.threshold = expansionCriteria.loadTreeHierarchyThreshold;
        this.soaInput = occmgmtGetSvc.getReconfigureWindowSoaInput( occContext, expansionCriteria );
        this.vmc = occContext.vmc;
    }

    invokeNext() {
        const runawayLimit = 100;
        if ( this.finished || this.count >= runawayLimit ) {
            if ( this.nextInChain !== null ) {
                return this.nextInChain.invokeNext();
            }
            return { calls: 0, finished: true };
        }

        if ( this.count === 2 && !this.gotFirstProps ) {
            // make one call to get props for first page. Hacky, refactor.
            this.gotFirstProps = true;
            return this.nextInChain.invokeNext();
        }

        // Increment call count
        this.count++;

        // Fine tune page size for each request. First two requests are tiny to get
        // allow render of first page as soon as possible
        let pageSize = this.threshold;
        this.soaInput.inputData.expansionCriteria.loadTreeHierarchyThreshold = pageSize;
        this.soaInput.inputData.requestPref.startFreshNavigation = [ this.count === 1  ? 'true' : 'false' ];

        let callId = 'reconfig_' + this.count;
        console.log( callId + ': getOccs_invokeNext(' + pageSize + ')' );

        let soaService = soaSvc;
        let serviceName = 'foreground';

        soaService
            .post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', this.soaInput )
            .then( function( response ) {
                console.log( response );
                invoker.callFinished( callId );
                this.finished = response.cursor.endReached;
                if ( this.finished ) {
                    console.log( callId + ': received finished from server (endReached)' );
                }
                // Make tree nodes, have them added to ViewModelCollection
                let repaint = true;
                occurrencesLoader.applyResponseToTree( response, this.vmc, repaint );
            }.bind( this ) );

        // todo: remove when we pass time limit through SOA
        var timeEstimate = pageSize / 1.9 + 225;
        return { calls: 1, type: serviceName, nextAction: 'async', time: timeEstimate, finished: false };
    }
}

