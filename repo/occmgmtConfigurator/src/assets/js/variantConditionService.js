// Copyright (c) 2022 Siemens

/**
 * @module js/variantConditionService
 */
import eventBus from 'js/eventBus';
import psEditSaveHandler from 'js/psEditSaveHandler';
import appCtxSvc from 'js/appCtxService';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';

let exports = {};
let eventSubscription;

export let saveEditVCA2TableACE = function( data ) {
    // find out updated lines from variant condition tree
    let bomlinesToSplit = data.variabilityProps.dirtyElements;
    if( bomlinesToSplit.length === 0 ) {
        eventBus.publish( 'Pca0VariantConditionAuthoringGrid.SaveExpressionsInECNContext', {} );
        return;
    }

    let elementUidToBomlineUidMap = {};
    let srcElementUidToSplitElementUidMap = {};
    aceBackingObjectProviderService.getBackingObjects( appCtxSvc.ctx.mselected )
        .then( bomlines=>{
            // src element to bo map
            appCtxSvc.ctx.mselected.forEach( ( sel, ind ) =>{ elementUidToBomlineUidMap[sel.uid] = bomlines[ind].uid; } );
            // get elements from bomlines for split
            let inputs = bomlinesToSplit.map( line=>{
                let index = appCtxSvc.ctx.mselected.findIndex( bl=> bl.uid === line );
                return { obj : appCtxSvc.ctx.mselected[index] };
            } );

            //Perform SOA call to split based on date effectivity
            return psEditSaveHandler.callSplitSoa( inputs );
        } )
        .then( response=>{
            // calculate split lines
            let splitLines = [];
            if( response.effSplitOutputs ) {
                response.effSplitOutputs.forEach( ele=>{
                    if( ele.newSplitElement.uid !== 'AAAAAAAAAAAAAA' ) {
                        srcElementUidToSplitElementUidMap[ ele.sourceElement.uid ] = ele.newSplitElement.uid;
                        splitLines.push( ele.newSplitElement );
                    }
                } );
            }
            if( splitLines.length === 0 ) {
                eventBus.publish( 'Pca0VariantConditionAuthoringGrid.SaveExpressionsInECNContext', {} );
                return;
            }
            // get bomlines for splitlines to return map {srcBomline : splitBomline}
            aceBackingObjectProviderService.getBackingObjects( splitLines ).then( bomlines=>{
                splitLines.forEach( ( ele, ind ) =>{ elementUidToBomlineUidMap[ele.uid] = bomlines[ind].uid; } );
                let eventData = {};
                Object.keys( srcElementUidToSplitElementUidMap ).forEach( k=>{
                    eventData[k] = elementUidToBomlineUidMap[srcElementUidToSplitElementUidMap[k]];
                } );
                eventBus.publish( 'Pca0VariantConditionAuthoringGrid.SaveExpressionsInECNContext', eventData );

                eventSubscription ?  eventBus.unsubscribe( eventSubscription ) : '';
                eventSubscription = eventBus.subscribe( 'Pca0VariantConditionAuthoringGrid.postProcessSetVariantExpressionData', ()=>{
                    if( eventSubscription ) {
                        eventBus.unsubscribe( eventSubscription );
                        eventSubscription = null;
                        psEditSaveHandler.afterSplitEleUpdatedProcessSplitResponse( response );
                    }
                } );
            } );
        } );
};

/**
  * Variant condition service utility
  */

export default exports = {
    saveEditVCA2TableACE
};
