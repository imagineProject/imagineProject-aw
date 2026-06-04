// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareUtils
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

export let getChildCount = function( topElement ) {
    return parseInt( topElement.props.awb0NumberOfChildren.dbValues[ 0 ], 10 );
};

export let getDefaultCursor = function() {
    return {
        startReached: true,
        endReached: false,
        startIndex: 0,
        endIndex: 0,
        pageSize: 40,
        isForward: true
    };
};

export let processVMODifferences = function( compareContext, originalDifferences, pagedDifferences, gridLocation ) {
    let diffIds = {};
    let equivalenceIds = [];
    let mappingUids = {};
    let equivalentList = {};

    if( gridLocation === 1 ) {
        equivalentList = compareContext.srcEquivalentList;
    } else if( gridLocation === 2 ) {
        equivalentList = compareContext.trgEquivalentList;
    }
    if( !equivalentList ) {
        equivalentList = {};
    }

    if( originalDifferences ) {
        for( let key in originalDifferences ) {
            if( originalDifferences[ key ] === 2 || originalDifferences[ key ] === 4 || originalDifferences[ key ] === 5 ) {
                let ids = key.split( exports.getDelimiterKey() );
                diffIds[ ids[ 0 ] ] = originalDifferences[ key ];
                if( ids.length > 1 ) {
                    let tempEquivalenceIds = [];
                    for( let index2 = 1; index2 < ids.length; index2++ ) {
                        let vmo = {
                            uid: ids[ index2 ]
                        };
                        tempEquivalenceIds.push( ids[ index2 ] );
                        equivalenceIds.push( vmo );
                    }
                    mappingUids[ ids[ 0 ] ] = tempEquivalenceIds;
                    equivalentList[ ids[ 0 ] ] = tempEquivalenceIds;
                }
            } else {
                diffIds[ key ] = originalDifferences[ key ];
            }
        }
    }
    if( pagedDifferences ) {
        for( let index = 0; index < pagedDifferences.length; index++ ) {
            if( pagedDifferences[ index ].diff === 2 || pagedDifferences[ index ].diff === 4 || pagedDifferences[ index ].diff === 5 ) {
                let uids = pagedDifferences[ index ].uids;
                if( uids ) {
                    let ids = uids.split( exports.getDelimiterKey() );
                    diffIds[ ids[ 0 ] ] = pagedDifferences[ index ].diff;
                    if( ids.length > 1 ) {
                        let tempEquivalenceIds = [];
                        for( let index2 = 1; index2 < ids.length; index2++ ) {
                            let vmo = {
                                uid: ids[ index2 ]
                            };
                            tempEquivalenceIds.push( ids[ index2 ] );
                            equivalenceIds.push( vmo );
                        }
                        mappingUids[ ids[ 0 ] ] = tempEquivalenceIds;
                        equivalentList[ ids[ 0 ] ] = tempEquivalenceIds;
                    }
                }
            } else {
                diffIds[ pagedDifferences[ index ].uids ] = pagedDifferences[ index ].diff;
            }
        }
    }
    if( gridLocation === 1 ) {
        compareContext.srcEquivalentList = equivalentList;
    } else if( gridLocation === 2 ) {
        compareContext.trgEquivalentList = equivalentList;
    }
    return {
        colorSwabIds: diffIds,
        equivalIds: equivalenceIds,
        mappingData: mappingUids
    };
};

export let getDelimiterKey = function() {
    return '##';
};

export let getContextKeys = function() {
    let _contextKeys = {
        leftCtxKey: null,
        rightCtxKey: null
    };
    let _multipleContext = appCtxSvc.getCtx( 'splitView' );
    if( _multipleContext ) {
        _contextKeys.leftCtxKey = _multipleContext.viewKeys[ 0 ];
        _contextKeys.rightCtxKey = _multipleContext.viewKeys[ 1 ];
    }
    return _contextKeys;
};

function _swapMappingIds( mappingIds ) {
    let newMap = {};

    for( let i in mappingIds ) {
        for( let j = 0; j < mappingIds[i].length; j++ ) {
            newMap[ mappingIds[i][j] ] = newMap[ mappingIds[i][j] ] || [];
            newMap[ mappingIds[i][j] ].push( i );
        }
    }

    return newMap;
}

function _removeOldPropData( mappingData, propDiffData ) {
    for( let key in propDiffData ) {
        let vmo = key.substring( 0, key.lastIndexOf( '$' ) );
        let property = key.substring( key.lastIndexOf( '$' ) );
        if( mappingData[vmo] && mappingData[vmo].length > 0 ) {
            for( let it in mappingData[vmo] ) {
                let valToDelete = mappingData[vmo][it] + property;
                if( propDiffData[valToDelete] !== undefined && propDiffData[valToDelete] !== null ) {
                    delete propDiffData[valToDelete];
                }
            }
            delete propDiffData[key];
        }
    }
    return propDiffData;
}

export let updatePropertyDiffMap = ( compareContext, loadedVMOs ) => {
    let sourceVMDiffs = compareContext.sourceDiffs;
    let targetVMDiffs = compareContext.targetDiffs;
    let propDiffData = appCtxSvc.getCtx( 'compareContext.propertyDiffs' );
    propDiffData = propDiffData ? propDiffData : {};
    let vmoToProcess = loadedVMOs ? loadedVMOs : Object.keys( sourceVMDiffs );
    let mappingData = compareContext.mappingIds;
    let reverseMappingData = _swapMappingIds( mappingData );
    if( mappingData[vmoToProcess[0]] && mappingData[vmoToProcess[0]].length > 0 ) {
        propDiffData = _removeOldPropData( mappingData, propDiffData );
    } else if( reverseMappingData[vmoToProcess[0]] && reverseMappingData[vmoToProcess[0]].length > 0 ) {
        propDiffData = _removeOldPropData( reverseMappingData, propDiffData );
    }
    let contextKeys = getContextKeys();
    let leftVmc = appCtxSvc.getCtx( contextKeys.leftCtxKey ).vmc;
    let rightVmc = appCtxSvc.getCtx( contextKeys.rightCtxKey ).vmc;
    let isVMOPropProcessed = true;
    for( let srcIndex = 0; srcIndex < vmoToProcess.length; srcIndex++ ) {
        let srcKey = vmoToProcess[srcIndex];
        if( sourceVMDiffs[ srcKey ] === 2 || sourceVMDiffs[ srcKey ] === 5 ) {
            if ( mappingData[ srcKey ] ) {
                let equivalentSrcObject = leftVmc.getViewModelObject( leftVmc.findViewModelObjectById( srcKey ) );
                let trgKeys = mappingData[ srcKey ];
                for( let index = 0; index < trgKeys.length; index++ ) {
                    let equivalentTrgObject = rightVmc.getViewModelObject( rightVmc.findViewModelObjectById( trgKeys[ index ] ) );
                    if( equivalentSrcObject &&  !_.isEmpty( equivalentSrcObject.props ) && equivalentTrgObject && !_.isEmpty( equivalentTrgObject.props ) ) {
                        for( let propertyData in equivalentSrcObject.props ) {
                            let targetProperty = equivalentTrgObject.props[ propertyData ];
                            if( targetProperty && targetProperty.dbValues[ 0 ] !== equivalentSrcObject.props[ propertyData ].dbValues[ 0 ] ) {
                                propDiffData[ srcKey + '$' + propertyData ] = 2;
                                propDiffData[ trgKeys[ index ] + '$' + propertyData ] = 2;
                            }
                        }
                    } else {
                        isVMOPropProcessed = false;
                    }
                }
            }
        }

        if( targetVMDiffs[ srcKey ] === 2 || targetVMDiffs[ srcKey ] === 5 ) {
            if ( reverseMappingData[ srcKey ] ) {
                let equivalentTrgObject = rightVmc.getViewModelObject( rightVmc.findViewModelObjectById( srcKey ) );
                let trgKeys = reverseMappingData[ srcKey ];
                for( let index = 0; index < trgKeys.length; index++ ) {
                    let equivalentSrcObject = leftVmc.getViewModelObject( leftVmc.findViewModelObjectById( trgKeys[ index ] ) );
                    if( equivalentTrgObject &&  !_.isEmpty( equivalentTrgObject.props ) && equivalentSrcObject && !_.isEmpty( equivalentSrcObject.props ) ) {
                        for( let propertyData in equivalentTrgObject.props ) {
                            let sourceProperty = equivalentSrcObject.props[ propertyData ];
                            if( sourceProperty && sourceProperty.dbValues[ 0 ] !== equivalentTrgObject.props[ propertyData ].dbValues[ 0 ] ) {
                                propDiffData[ srcKey + '$' + propertyData ] = 2;
                                propDiffData[ trgKeys[ index ] + '$' + propertyData ] = 2;
                            }
                        }
                    } else {
                        isVMOPropProcessed = false;
                    }
                }
            }
        }
    }
    appCtxSvc.updatePartialCtx( 'compareContext.propertyDiffs', propDiffData );
    eventBus.publish( 'occTreeTable.plTable.clientRefresh' );
    eventBus.publish( 'occTreeTable2.plTable.clientRefresh' );
    return isVMOPropProcessed;
};

let _isPartitionSchemeApplied = function() {
    let ctx = appCtxSvc.getCtx();
    return ctx?.occmgmtContext?.productContextInfo?.props && ctx.occmgmtContext.productContextInfo.props.fgf0PartitionScheme &&
        ( ctx.occmgmtContext.productContextInfo.props.fgf0PartitionScheme.isNulls === undefined && ctx.occmgmtContext.productContextInfo.props.fgf0PartitionScheme.dbValues.length > 0
        || ctx.occmgmtContext2.productContextInfo.props.fgf0PartitionScheme.isNulls === undefined && ctx.occmgmtContext2.productContextInfo.props.fgf0PartitionScheme.dbValues.length > 0 );
};

export let setDefaultDisplayOptions = function( compareContext ) {
    let matchTypes = {};
    matchTypes.MISSING_SOURCE = true;
    matchTypes.MISSING_TARGET = true;
    matchTypes.PARTIAL_MATCH = true;
    if( !_isPartitionSchemeApplied() ) {
        matchTypes.MULTIPLE_MATCH = true;
    }

    let equivalenceTypes = {};
    equivalenceTypes.AC_DYNAMIC_IDIC = true;

    let displayOptions = {};
    displayOptions.MatchType = matchTypes;
    displayOptions.Equivalence = equivalenceTypes;

    compareContext.displayOptions = displayOptions;
};

export default exports = {
    getChildCount,
    getDefaultCursor,
    processVMODifferences,
    getDelimiterKey,
    getContextKeys,
    updatePropertyDiffMap,
    setDefaultDisplayOptions
};
