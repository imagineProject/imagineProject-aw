// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareDiffService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import awStructureCompareUtils from 'js/awStructureCompareUtils';
import compareGetService from 'js/awStructureCompareGetService';
import awStructureCompareService from 'js/awStructureCompareService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};
var tempCompareContext = null;
var isCompareContextUpdateRequired = false;

var processDifferences = function( uidsToLoad, location, diffOutput, differenceResponse, deferred ) {
    var differenceResults = [];
    for( var index = 0; index < uidsToLoad.length; ++index ) {
        var uid;
        var uidKey = uidsToLoad[ index ];
        var indx = uidKey.indexOf( awStructureCompareUtils.getDelimiterKey() );
        if( indx > -1 ) {
            var uids = uidKey.split( awStructureCompareUtils.getDelimiterKey(), 2 );
            uid = uids[ 0 ]; //Get the first uid
        } else {
            uid = uidKey;
        }
        var mo = cdm.getObject( uid );
        differenceResults.push( mo );
    }
    if( location === 1 ) {
        diffOutput.sourceDifferences = differenceResults;
        diffOutput.cursorObject = differenceResponse.sourceCursor;
        diffOutput.srcTotalFound = differenceResults.length;
        diffOutput.isSourcePanelCollapsed = false;
    } else if( location === 2 ) {
        diffOutput.targetDifferences = differenceResults;
        diffOutput.cursorObject = differenceResponse.targetCursor;
        diffOutput.trgTotalFound = differenceResults.length;
    }
    deferred.resolve( diffOutput );
};

let _invokeCustomLoadObjectsForDiffpanel = function( uidsToLoad, deferred, location, differenceResponse,
    diffOutput ) {
    // Added limited properties for load objects
    // Also added awb0Parent which will be needed to be removed later
    var policyIOverride = {
        types: [ {
            name: 'Awb0Element',
            properties: [ {
                name: 'awp0ThumbnailImageTicket'
            }, {
                name: 'object_string'
            }, {
                name: 'awb0UnderlyingObject'
            }, {
                name: 'awb0Parent'
            }, {
                name: 'awp0CellProperties'
            } ]
        }, {
            name: 'Fgd0DesignElement',
            properties: [ {
                name: 'awb0UnderlyingObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        }, {
            name: 'Cpd0DesignElement',
            properties: [ {
                name: 'cpd0category'
            } ]
        } ]
    };
    // Filter out already loaded vmos from the loading
    let missingUids = [];
    _.forEach( uidsToLoad, function( uid ) {
        let indx = uid.indexOf( awStructureCompareUtils.getDelimiterKey() );
        if( indx > -1 ) {
            let uids = uid.split( awStructureCompareUtils.getDelimiterKey(), 2 );
            uid = uids[ 0 ]; //Get the first uid
        }
        let modelObject = cdm.getObject( uid );
        if( !modelObject || _.isEmpty( modelObject.props ) ) {
            missingUids.push( uid );
        }
    } );
    if( missingUids.length > 0 ) {
        soaSvc.postUnchecked( 'Core-2007-09-DataManagement', 'loadObjects', {
            uids: missingUids
        }, policyIOverride ).then( () => {
            processDifferences( uidsToLoad, location, diffOutput, differenceResponse, deferred );
        } );
    } else {
        processDifferences( uidsToLoad, location, diffOutput, differenceResponse, deferred );
    }
    return deferred.promise;
};

// Common code to post process differences panel results, invoked during first load of src/trg differences
// as well as next page difference
var _invokeAndProcessPagedDifferences = function( compareContext, compareInput, location, deferred, compareContextAtomicData ) {
    awStructureCompareService.invokeSoa( compareContext, compareInput ).then(
        function( response ) {
            if( response ) {
                let diffOutput = {};
                let pagedDifferences;
                compareContext.isInCompareMode = true;
                compareContext.depth = response.sourceDepth;
                if( location === 1 ) {
                    compareContext.sourceDifferences = response.pagedSourceDifferences;
                    pagedDifferences = response.pagedSourceDifferences;
                    compareContext.sourceCursor = response.sourceCursor;
                    diffOutput = {
                        sourceDifferences: [],
                        cursorObject: null,
                        totalFound: 0
                    };
                } else if( location === 2 ) {
                    compareContext.targetDifferences = response.pagedTargetDifferences;
                    pagedDifferences = response.pagedTargetDifferences;
                    compareContext.targetCursor = response.targetCursor;
                    diffOutput = {
                        targetDifferences: [],
                        cursorObject: null,
                        totalFound: 0
                    };
                }
                let processedSrcIds = awStructureCompareUtils.processVMODifferences( compareContext, null, response.pagedSourceDifferences, 1 );
                let processedTrgIds = awStructureCompareUtils.processVMODifferences( compareContext, null, response.pagedTargetDifferences, 2 );
                let finalEquivalenceList = processedSrcIds.equivalIds;
                finalEquivalenceList = finalEquivalenceList.concat( processedTrgIds.equivalIds );
                compareContext.equivalenceObj = finalEquivalenceList;

                let tobeLoadedUIDs = [];
                for( let index = 0; index < pagedDifferences.length; ++index ) {
                    tobeLoadedUIDs.push( pagedDifferences[ index ].uids );
                }
                awStructureCompareService.updateColorMapData( compareContext );
                appCtxSvc.updatePartialCtx( 'compareContext.sourceColorDiffs', compareContext.sourceColorDiffs );
                appCtxSvc.updatePartialCtx( 'compareContext.targetColorDiffs', compareContext.targetColorDiffs );
                compareContextAtomicData.update( compareContext );
                return _invokeCustomLoadObjectsForDiffpanel( tobeLoadedUIDs, deferred, location, response,
                    diffOutput );
            }
        } );
    return deferred.promise;
};

/* Exports section */

export let getFirstSourceDifferences = function( compareContext ) {
    tempCompareContext = { ...compareContext.getValue() };
    let deferred = AwPromiseService.instance.defer();
    let diffOutput = {};
    let srcDiffs = tempCompareContext.sourceDifferences;
    let srcCursor = tempCompareContext.sourceCursor;
    let prevCursor = tempCompareContext.prevSrcCursor;
    let prevData = tempCompareContext.prevSrcData;
    if( prevData !== undefined && prevData.length > 0 ) {
        srcDiffs = prevData;
        srcCursor = prevCursor;
    } else {
        // Update the cursor and data to app context for next page to work properly
        tempCompareContext.prevSrcCursor = srcCursor;
        tempCompareContext.prevSrcData = srcDiffs;
        isCompareContextUpdateRequired = true;
    }
    diffOutput = {
        sourceDifferences: [],
        cursorObject: null,
        srcTotalFound: 0
    };
    let tobeLoadedUIDs = [];
    if( srcDiffs ) {
        for( let index = 0; index < srcDiffs.length; ++index ) {
            tobeLoadedUIDs.push( srcDiffs[ index ].uids );
        }
    }
    let customResponse = {
        sourceDifferences: srcDiffs,
        sourceCursor: srcCursor
    };
    return _invokeCustomLoadObjectsForDiffpanel( tobeLoadedUIDs, deferred, 1, customResponse, diffOutput );
};

export let getNextSourceDifferences = function( compareContext, cursorObject ) {
    //The previous source result has to be greater than 0 to avoid the extra soa call in case of error.
    if( !_.isEmpty( compareContext.prevSrcData ) ) {
        let newCompareContext = _.cloneDeep( compareContext.getValue() );
        let deferred = AwPromiseService.instance.defer();
        let sourceCursor = cursorObject;
        let targetCursor = awStructureCompareUtils.getDefaultCursor();
        targetCursor.startIndex = -1;

        let compareInput = compareGetService.createSOAInputForPaginationAndVisibleUids(
            newCompareContext,
            newCompareContext.depth, false, false, false,
            sourceCursor, targetCursor, awStructureCompareService.getSelectedVMOs().source,
            awStructureCompareService.getSelectedVMOs().target, null );

        return _invokeAndProcessPagedDifferences( newCompareContext, compareInput, 1, deferred, compareContext );
    }
};

export let getFirstTargetDifferences = function( compareContext ) {
    let deferred = AwPromiseService.instance.defer();
    let diffOutput = {};
    if( tempCompareContext === null ) {
        tempCompareContext = { ...compareContext.getValue() };
    }
    let trgDiffs = tempCompareContext.targetDifferences;
    let trgCursor = tempCompareContext.targetCursor;
    let prevCursor = tempCompareContext.prevTrgCursor;
    let prevData = tempCompareContext.prevTrgData;
    if( prevData !== undefined && prevData.length > 0 ) {
        trgDiffs = prevData;
        trgCursor = prevCursor;
    } else {
        // Update the cursor and data to app context for next page to work properly
        tempCompareContext.prevTrgCursor = trgCursor;
        tempCompareContext.prevTrgData = trgDiffs;
        isCompareContextUpdateRequired = true;
    }
    diffOutput = {
        targetDifferences: [],
        cursorObject: null,
        trgTotalFound: 0
    };
    let tobeLoadedUIDs = [];
    if( trgDiffs ) {
        for( let index = 0; index < trgDiffs.length; ++index ) {
            tobeLoadedUIDs.push( trgDiffs[ index ].uids );
        }
    }
    let customResponse = {
        targetDifferences: trgDiffs,
        targetCursor: trgCursor
    };
    if( isCompareContextUpdateRequired ) {
        compareContext.update( tempCompareContext );
    }
    isCompareContextUpdateRequired = false;
    return _invokeCustomLoadObjectsForDiffpanel( tobeLoadedUIDs, deferred, 2, customResponse, diffOutput );
};

export let getNextTargetDifferences = function( compareContext, cursorObject ) {
    //The previous target result has to be greater than 0 to avoid the extra soa call in case of error.
    if( !_.isEmpty( compareContext.prevTrgData ) ) {
        let newCompareContext = _.cloneDeep( compareContext.getValue() );
        let deferred = AwPromiseService.instance.defer();
        let sourceCursor = awStructureCompareUtils.getDefaultCursor();
        sourceCursor.startIndex = -1;
        let targetCursor = cursorObject;

        let compareInput = compareGetService.createSOAInputForPaginationAndVisibleUids(
            newCompareContext,
            newCompareContext.depth, false, false, false,
            sourceCursor, targetCursor, awStructureCompareService.getSelectedVMOs().source,
            awStructureCompareService.getSelectedVMOs().target, null );

        return _invokeAndProcessPagedDifferences( newCompareContext, compareInput, 2, deferred, compareContext );
    }
};

export default exports = {
    getFirstSourceDifferences,
    getNextSourceDifferences,
    getFirstTargetDifferences,
    getNextTargetDifferences
};
