/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * ExpandBelowCallProvider
 *
 * Responsible for providing a sequence of getOccurrences4 calls to be invoked
 * during an ExpandBelow user action. Interacts with tree context to choose
 * best ordering/parameterisation of the calls.
 *
 * Called only by invoker.
 *
 * @module js/invoker/expandBelowCallProvider
 */

import appCtxSvc from 'js/appCtxService';
import backgroundSoaSvc from 'js/invoker/backgroundSoaService';
import soaSvc from 'soa/kernel/soaService';
import occmgmtGetSvc from 'js/aceGetService';
import occurrencesLoader from 'js/invoker/occurrencesLoader';
import invoker from 'js/invoker/invoker';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import requestQueue from 'js/invoker/requestQueue';

export default class ExpandBelowCallProvider {
    // Construct an ExpandBelowCallProvider
    constructor( vmo, occContext, expansionCriteria, nextInChain ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.gotFirstProps = false;
        this.threshold = expansionCriteria.loadTreeHierarchyThreshold;
        this.soaInput = occmgmtGetSvc.getExpandBelowSoaInput( vmo, occContext, expansionCriteria );
        this.vmc = occContext.vmc;
        this.occContext = occContext;
    }

    getPageSize() {
        var pageSize = 500; // default page size
        if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize ) &&
            appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize.length > 0 ) {
            pageSize = parseInt( appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize[0] );
        }
        return pageSize;
    }

    invokeNext() {
        let loadedVMObjects = this.vmc.getLoadedViewModelObjects();
        if ( loadedVMObjects.length === 0 ) {
            this.nextInChain = null;
            return { calls: 0, finished: true };
        }

        const runawayLimit = 100;
        if ( this.finished || this.count >= runawayLimit ) {
            if ( this.nextInChain !== null ) {
                return this.nextInChain.invokeNext();
            }
            return { calls: 0, finished: true };
        }

        if ( this.count === 1 && !this.gotFirstProps ) {
            // make one call to get props for first page. Hacky, refactor.
            this.gotFirstProps = true;
            var result = this.nextInChain.invokeNext( );
            return { calls: result.calls, finished: false };
        }

        // Increment call count
        this.count++;

        if( this.count === 1 ) {
            this.soaInput.inputData.requestPref.resetCursor = [ 'true' ];
            this.soaInput.inputData.requestPref.reuseCursor = [ 'false' ];
            eventBus.publish( 'occMgmt.interaction' );
        } else {
            this.soaInput.inputData.requestPref.resetCursor = [ 'false' ];
            this.soaInput.inputData.requestPref.reuseCursor = [ 'true' ];
        }

        // Fine tune page size for each request. First two requests are tiny to get
        // allow render of first page as soon as possible
        let pageSize = this.getPageSize();
        // let timeEstimate = this.count < 3 ? pageSize / 1.9 + 225 : this.threshold;
        let timeEstimate = this.threshold;
        this.soaInput.inputData.expansionCriteria.loadTreeHierarchyThreshold = pageSize;
        // this.soaInput.inputData.requestPref.startFreshNavigation = [ this.count === 1  ? 'true' : 'false' ];

        let callId = 'occs_' + this.count;
        console.log( callId + ': getOccs_invokeNext(' + pageSize + ')' );

        let soaService = soaSvc;
        let serviceName = 'foreground';
        if ( this.count > 1 ) {
            soaService = backgroundSoaSvc;
            serviceName = 'background';
        }

        soaService
            .post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', this.soaInput )
            .then( function( response ) {
                //console.log( response );
                this.finished = response.cursor.endReached;
                if( this.finished ) {
                    console.log( callId + ': received finished from server (endReached)' );
                }
                // Make tree nodes, have them added to ViewModelCollection
                let repaint = this.count > 1;
                requestQueue.active() ? occurrencesLoader.applyResponseToTree( response, this.vmc, repaint ) : undefined;
                invoker.callFinished( callId );
            }.bind( this ) );

        // todo: remove when we pass time limit through SOA
        return { calls: 1, type: serviceName, nextAction: 'async', time: timeEstimate, finished: false };
    }
}

