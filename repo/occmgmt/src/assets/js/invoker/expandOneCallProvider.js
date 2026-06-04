/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * ExpandOneCallProvider
 * 
 * Responsible for providing a sequence of getOccurrences4 calls to be invoked
 * during a single parent expansion user action. Interacts with tree context to choose
 * best ordering/parameterisation of the calls.
 * 
 * Called only by invoker.
 *
 * @module js/invoker/expandOneCallProvider
 */

//import backgroundSoaSvc from 'js/invoker/backgroundSoaService';
import soaSvc from 'soa/kernel/soaService';
import occmgmtGetSvc from 'js/aceGetService';
import occurrencesLoader from 'js/invoker/occurrencesLoader';
import invoker from 'js/invoker/invoker';

export default class ExpandOneCallProvider {
    constructor( vmo, occContext, expansionCriteria, nextInChain ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.gotFirstProps = false;
        this.threshold = expansionCriteria.loadTreeHierarchyThreshold;
        this.soaInput = occmgmtGetSvc.getExpandOneSoaInput( vmo, occContext, expansionCriteria );
        this.vmc = occContext.vmc;
    }

    invokeNext() {
        if ( this.finished ) {
            if ( this.nextInChain !== null ) {
                return this.nextInChain.invokeNext();
            }
            return { calls: 0, finished: true };
        }

        if ( this.count === 1 && !this.gotFirstProps ) {
            // make one call to get props for first page. Hacky, refactor.
            this.gotFirstProps = true;
            return this.nextInChain.invokeNext();
        }

        // Increment call count
        this.count++;

        let pageSize = this.threshold;

        let callId = 'occs_' + this.count;
        console.log( callId + ': getOccs_invokeNext(' + pageSize + ')' );

        let soaService = soaSvc;
        let serviceName = 'foreground';
        /*if ( this.count > 0 ) {
            soaService = backgroundSoaSvc;
            serviceName = 'background';
        }*/

        soaService
            .postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', this.soaInput )
            .then( function( response ) {
                console.log( response );
                invoker.callFinished( callId );
                this.finished = response.cursor.endReached;
                if ( this.finished ) {
                    console.log( callId + ': received finished from server' );
                }
                // Make tree nodes, have them added to ViewModelCollection
                let repaint = true;
                occurrencesLoader.applyResponseToTree( response, this.vmc, repaint );
            }.bind( this ) );

        // todo: remove when we pass time limit through SOA
        var timeEstimate = pageSize / 5 + 100;
        return { calls: 1, type: serviceName, nextCall: 'sync', time: timeEstimate, finished: false };
    }
}

