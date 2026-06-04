// Copyright (c) 2022 Siemens

/**
 * @module js/aceStaleRowMarkerService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

var getAllChildOccurrencesUids = function( childOccurrences, parentChildrenInfos ) {
    var childOccurrencesUid = [];

    // Get the uids
    if( childOccurrences && childOccurrences.length > 0 ) {
        childOccurrencesUid = childOccurrences.map( function( obj ) {
            if( !_.isEmpty( obj.occurrenceId ) ) {
                return obj.occurrenceId;
            }
            return obj.occurrence.uid;
        } );
    }

    // Get the uids from multiple parent and children
    if( parentChildrenInfos && parentChildrenInfos.length > 0 ) {
        parentChildrenInfos.forEach( function( parentChildrenInfo ) {
            childOccurrencesUid.push( parentChildrenInfo.parentInfo.occurrenceId );
            parentChildrenInfo.childrenInfo.forEach( function( childInfo ) {
                childOccurrencesUid.push( childInfo.occurrenceId );
            } );
        } );
    }

    // Remove duplicate
    childOccurrencesUid = childOccurrencesUid.filter( function( value, index, self ) {
        return self.indexOf( value ) === index;
    } );
    return childOccurrencesUid;
};

export let populateIndexSyncFailStatus = function( vmo ) {
    if( vmo && vmo.uid && vmo.uid.endsWith( 'AWBIB' ) && vmo.props ) {
        //Set the decoratorToggle to true for showing the stale lines
        if( !( appCtxSvc.ctx.splitView && appCtxSvc.ctx.splitView.mode ) ) {
            let decoratorToggleVal = appCtxSvc.getCtx( 'decoratorToggle' );
            if( decoratorToggleVal !== true ) {
                appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
            }
        }
        //Need to compare with the uids returned in the request preference
        var staleIds = appCtxSvc.ctx.aceActiveContext.context.staleIndexedLineUids;

        if( staleIds && staleIds.find( function( element ) {
            return element === vmo.uid;
        } ) ) {
            vmo.isStale = true;
            return true;
        }
    }
    return false;
};

export let getStaleUids = function( responsePref, childOccurrences, parentChildrenInfos ) {
    var staleUidsEncountered = [];

    if( appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.context &&
        appCtxSvc.ctx.aceActiveContext.context.staleIndexedLineUids ) {
        staleUidsEncountered = appCtxSvc.ctx.aceActiveContext.context.staleIndexedLineUids;
    }

    var childOccurrencesUid = getAllChildOccurrencesUids( childOccurrences, parentChildrenInfos );

    if( responsePref && responsePref.staleIndexedLineUids ) {
        if( staleUidsEncountered.length === 0 ) {
            staleUidsEncountered = responsePref.staleIndexedLineUids;
        } else {
            //Filter out the unique uids
            var isUniqueUid = function isUniqueUid( value, index, self ) {
                return self.indexOf( value ) === index;
            };
            staleUidsEncountered = staleUidsEncountered.concat( responsePref.staleIndexedLineUids ).filter(
                isUniqueUid );
        }

        //From response extract out good occurrences i.e. total in response - stale in response
        var nonStaleOccs = childOccurrencesUid.filter( function( childOccUid ) {
            return responsePref.staleIndexedLineUids.includes( childOccUid ) === false;
        } );

        //Update final list with removing good occurrences from stale uid cache.
        staleUidsEncountered = staleUidsEncountered.filter( function( uid ) {
            return nonStaleOccs.includes( uid ) === false;
        } );
    } else if( responsePref && !responsePref.isStaleStructure ) {
        //if structure goes in good state then clear our cache of stale occurrence uids.
        staleUidsEncountered = [];
    }

    return staleUidsEncountered;
};

export let updateCtxWithStaleUids = function( responsePref, childOccurrences, parentChildrenInfos, occContext ) {
    var staleUidsEncountered = getStaleUids( responsePref, childOccurrences, parentChildrenInfos );
    if ( !_.isEmpty( staleUidsEncountered ) ) {
        occmgmtUtils.updateValueOnCtxOrState( 'staleIndexedLineUids', staleUidsEncountered, occContext.viewKey );
    }
};

export default exports = {
    populateIndexSyncFailStatus,
    updateCtxWithStaleUids,
    getStaleUids
};
