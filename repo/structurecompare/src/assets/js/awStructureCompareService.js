// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareService
 */
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import messagingSvc from 'js/messagingService';
import dataManagementSvc from 'soa/dataManagementService';
import localeSvc from 'js/localeService';
import soaSvc from 'soa/kernel/soaService';
import dateTimeSvc from 'js/dateTimeService';
import colorDecoratorService from 'js/colorDecoratorService';
import structureCompareSvc from 'js/structureCompareService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import awStructureCompareUtils from 'js/awStructureCompareUtils';
import awStructureCompareOptionsService from 'js/awStructureCompareOptionsService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';

var exports = {};

var _sourceVMOs = [];
var _targetVMOs = [];

let getParentUidForCompare = function( modelObject ) {
    if( modelObject && modelObject.props ) {
        var props = modelObject.props;
        var uid;

        if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
            uid = props.awb0Parent.dbValues[ 0 ];
        }

        if( cdm.isValidObjectUid( uid ) ) {
            return uid;
        }
    }
    return null;
};

let getToplevelParent = function( modelObject ) {
    var oldParent = modelObject;
    var newParent = modelObject;
    while( newParent !== null ) {
        oldParent = newParent;
        newParent = cdm.getObject( getParentUidForCompare( newParent ) );
    }
    return oldParent;
};

var processErrorsAndWarnings = function( compareContext, response ) {
    let message = '';
    let level = 0;
    let error = response.ServiceData;
    if( error && error.partialErrors ) {
        _.forEach( error.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code === 126252 ) {
                        let localeTextBundle = localeSvc.getLoadedText( 'StructureCompareMessages' );
                        let tempMessage = localeTextBundle.messageForBackgroundCompareResult;
                        let date = new Date( response.timestampOfStoredResults );
                        tempMessage = tempMessage.replace( '{0}', dateTimeSvc.formatSessionDateTime( date ) );
                        if( message && message.length > 0 ) {
                            message += '\n' + tempMessage;
                        } else {
                            message += tempMessage;
                        }
                    } else if( errVal.code === 48021 ) {
                        return;
                    } else if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                        if( errVal.code === 174013 || errVal.code === 174014 || errVal.code === 174015 ) {
                            return response;
                        }
                    }
                    level = errVal.level;
                } );
            }
        } );
        if( level <= 1 ) {
            messagingSvc.showInfo( message );
            return response;
        }
        messagingSvc.showError( message );
        compareContext.isCompareRequestInProgress = false;
        return null;
    }
};

var resetContextData = function( compareContext, isExecutedFromPanel ) {
    compareContext.isInCompareMode = false;
    compareContext.sourceDiffs = [];
    compareContext.targetDiffs = [];
    compareContext.sourceDifferences = [];
    compareContext.targetDifferences = [];
    compareContext.sourceColorDiffs = {};
    compareContext.targetColorDiffs = {};
    let currentContext = appCtxSvc.getCtx( 'compareContext' );
    if( currentContext ) {
        if( isExecutedFromPanel ) {
            let value = {
                sourceDiffs: [],
                targetDiffs: [],
                sourceDifferences: [],
                targetDifferences: [],
                sourceColorDiffs: {},
                targetColorDiffs: {},
                propertyDiffs: {}
            };
            occmgmtUtils.updateValueOnCtxOrState( '', value, 'compareContext' );
        } else {
            appCtxSvc.unRegisterCtx( 'compareContext' );
        }
    }
};

let resetHighlights = function( propertyDiffs ) {
    if( propertyDiffs !== null ) {
        eventBus.publish( 'occTreeTable.plTable.clientRefresh' );
        eventBus.publish( 'occTreeTable2.plTable.clientRefresh' );
    }
};

function _updatePropertyDiffMap( compareContext, startFreshCompare ) {
    let equivalenceList = compareContext.equivalenceObj;
    if( equivalenceList && equivalenceList.length > 0 ) {
        equivalenceList = _.uniqBy( equivalenceList, 'uid' );
        let propertyLoadContext = {
            clientScopeURI: appCtxSvc.getCtx( 'sublocation.clientScopeURI' ),
            columnsToExclude: appCtxSvc.ctx.aceActiveContext.context.columnsToExclude
        };
        tcViewModelObjectService.getTableViewModelProperties( equivalenceList, propertyLoadContext ).then(
            awStructureCompareUtils.updatePropertyDiffMap( compareContext )
        );
    } else {
        if( equivalenceList.length === 0 && startFreshCompare ) {
            // We got a scenario where there are no equivalent objects, hence no property highlight
            compareContext.propertyDiffs = null;
            eventBus.publish( 'occTreeTable.plTable.clientRefresh' );
            eventBus.publish( 'occTreeTable2.plTable.clientRefresh' );
        }
    }
}

var getEquivalentObject = function( inputUID, inputMap ) {
    var equivalentObjects = [];
    if( inputUID && inputMap ) {
        var equivalentIDs = inputMap[ inputUID ];
        if( equivalentIDs && equivalentIDs.length > 0 ) {
            for( var index = 0; index < equivalentIDs.length; index++ ) {
                equivalentObjects.push( cdm.getObject( equivalentIDs[ index ] ) );
            }
        }
    }
    return equivalentObjects;
};

// This method will load the equivalent object by making server call
var loadAndFetchEquivalentObject = function( inputUID, inputMap ) {
    var deferred = AwPromiseService.instance.defer();
    var equivalentObjects = [];
    if( inputUID && inputMap ) {
        var equivalentIDs = inputMap[ inputUID ];
        if( equivalentIDs && equivalentIDs.length > 0 ) {
            var missingUids = [];
            _.forEach( equivalentIDs, function( uid ) {
                var modelObject = cdm.getObject( uid );
                if( !modelObject || _.isEmpty( modelObject.props ) ) {
                    missingUids.push( uid );
                } else {
                    equivalentObjects.push( modelObject );
                }
            } );

            if( missingUids.length > 0 ) {
                return dataManagementSvc.loadObjects( missingUids ).then( function() {
                    _.forEach( missingUids, function( uid ) {
                        var oUidObject = cdm.getObject( uid );
                        equivalentObjects.push( oUidObject );
                    } );
                    deferred.resolve( equivalentObjects );
                    return deferred.promise;
                } );
            }
        }
    }
    deferred.resolve( equivalentObjects );
    return deferred.promise;
};

/** Export APIs */

export let initializeCompareList = function( compareContext ) {
    if( !compareContext.compareList ) {
        let compareList = {
            sourceSelection: '',
            targetSelection: '',
            isDataAvailable: false, // might not need
            isInCompareMode: false,
            isInMultiLevelCompare: false, // might not need
            isCompareRequestInProgress: false,
            isConfigChanged: false,
            isFirstLaunch: true // might not need
        };
        compareContext.compareList = compareList;
    }
};

export let resetCompareContext = function( compareContext ) {
    compareContext.isCompareRequestInProgress = true;
    compareContext.isInCompareMode = false;
    compareContext.isInMultiLevelCompare = false;
    compareContext.prevSrcCursor = {};
    compareContext.prevSrcData = [];
    compareContext.prevTrgCursor = {};
    compareContext.prevTrgData = [];
    compareContext.srcEquivalentList = {};
    compareContext.trgEquivalentList = {};
};

export let showComparePanel = function() {
    awStructureCompareOptionsService.setInitialCompareOption();
    // dialog options to be used to invoke the custom dialog component in splitview
    let options = {
        view: 'Awb0Compare',
        placement: 'right',
        parent: '.aw-layout-workarea',
        width: 'STANDARD',
        height: 'FULL',
        isCloseVisible: false,
        push: true
    };
    eventBus.publish( 'ace.launchPanelInCustomDialog', { options } );
};

export let setDecoratorStyles = function( vmos ) {
    //Set the decorator toggle to show the color swabs
    if( appCtxSvc.getCtx( 'decoratorToggle' ) !== true ) {
        appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    }

    for( let key in vmos ) {
        vmos[ key ].cellDecoratorStyle = '';
        vmos[ key ].gridDecoratorStyle = '';
    }
    colorDecoratorService.setDecoratorStyles( vmos );
};

let getEquivalenceList = ( compareContext, response ) => {
    let processedSrcIds = awStructureCompareUtils.processVMODifferences( compareContext, response.sourceDifferences, response.pagedSourceDifferences, 1 );
    let sourceDiffs = processedSrcIds.colorSwabIds;

    let processedTrgIds = awStructureCompareUtils.processVMODifferences( compareContext, response.targetDifferences, response.pagedTargetDifferences, 2 );
    let finalEquivalenceList = processedSrcIds.equivalIds;
    finalEquivalenceList = finalEquivalenceList.concat( processedTrgIds.equivalIds );
    compareContext.mappingIds = processedSrcIds.mappingData;
    let tagretDiffs = processedTrgIds.colorSwabIds;
    let depth = response.sourceDepth;
    if( depth === 0 || depth === -1 ) {
        compareContext.isInMultiLevelCompare = true;
    } else {
        compareContext.isInMultiLevelCompare = false;
    }
    if( sourceDiffs !== null || tagretDiffs !== null ) {
        compareContext.sourceDiffs = sourceDiffs;
        compareContext.targetDiffs = tagretDiffs;
        compareContext.depth = depth;
        let timeStamp = undefined;
        if( depth !== -2 ) {
            let date = new Date( response.timestampOfStoredResults );
            timeStamp = dateTimeSvc.formatSessionDateTime( date );
            compareContext.timestampOfStoredResults = timeStamp;
        }

        //Label
        let localeTextBundle = localeSvc.getLoadedText( 'StructureCompareConstants' );
        let panelCaption = localeTextBundle.resultsTitle;
        if( timeStamp ) {
            panelCaption = panelCaption + ' (' + localeTextBundle.Time + ': ' + timeStamp + ')';
        }
        compareContext.resultsPanelTitle = panelCaption;
    }
    return finalEquivalenceList;
};

let setDisplayOptions = ( compareContext, responseCompareOptions ) => {
    //Match Types
    let matchTypes = {};
    if( responseCompareOptions.MatchType ) {
        responseCompareOptions.MatchType.forEach( function( entry ) {
            matchTypes[ entry ] = true;
        } );
    }

    //Equivalence
    let equivalenceTypes = {};
    if( responseCompareOptions.Equivalence ) {
        responseCompareOptions.Equivalence.forEach( function( entry ) {
            equivalenceTypes[ entry ] = true;
        } );
    }
    let compareOptions = compareContext.compareOptions;
    if( compareOptions && !compareOptions.find( option => option.propInternalValue === -3 ) && !equivalenceTypes.AC_DYNAMIC_IDIC ) {
        // Adding AC_DYNAMIC_IDIC so that Dynamic Equivalence checkbox is 'checked' after a compare operation is performed
        // This value can be removed by unchecking the checkbox
        equivalenceTypes.AC_DYNAMIC_IDIC = true;
    }

    let displayOptions = {};
    displayOptions.MatchType = matchTypes;
    displayOptions.Equivalence = equivalenceTypes;
    compareContext.displayOptions = displayOptions;
};

let updateCompareDifferencesData = ( compareContext, compareInput, refresh, response ) => {
    let isResetRequired = false;
    if( refresh && response.pagedSourceDifferences !== undefined && response.pagedSourceDifferences.length === 0 ) {
        compareContext.sourceDifferences = response.pagedSourceDifferences;
        compareContext.sourceCursor = response.sourceCursor;
        isResetRequired = true;
    }
    // An edge case that failed is, when there are no results when we launch
    // auto compare which results in empty differences. In such a case,
    // refresh is false but differences for source are zero. This check will
    // update the cursor and will allow the target section to be displayed
    if( !refresh && response.pagedSourceDifferences !== undefined && response.pagedSourceDifferences.length === 0 ) {
        compareContext.sourceCursor = response.sourceCursor;
    }
    if( refresh && response.pagedTargetDifferences !== undefined && response.pagedTargetDifferences.length === 0 ) {
        compareContext.targetDifferences = response.pagedTargetDifferences;
        compareContext.targetCursor = response.targetCursor;
        isResetRequired = true;
    }
    if( !refresh && response.pagedTargetDifferences !== undefined && response.pagedTargetDifferences.length === 0 ) {
        compareContext.targetCursor = response.targetCursor;
    }
    // When client wants only visible uids differences and not paginated results,
    // startIndex on cursor is sent as -1. In such a case, we should not update the
    // paginated results as sever does not return them and will always be empty
    let isSourcePaginationResultValid = compareInput.inputData.sourceCursor.startIndex !== -1;
    let isTargetPaginationResultValid = compareInput.inputData.targetCursor.startIndex !== -1;
    if( isSourcePaginationResultValid && response.pagedSourceDifferences !== undefined &&
        response.pagedSourceDifferences.length > 0 ) {
        compareContext.sourceDifferences = response.pagedSourceDifferences;
        compareContext.sourceCursor = response.sourceCursor;
        if( refresh ) {
            isResetRequired = true;
        }
    }
    if( isTargetPaginationResultValid && response.pagedTargetDifferences !== undefined &&
        response.pagedTargetDifferences.length > 0 ) {
        compareContext.targetDifferences = response.pagedTargetDifferences;
        compareContext.targetCursor = response.targetCursor;
        if( refresh ) {
            isResetRequired = true;
        }
    }
    if( isResetRequired ) {
        eventBus.publish( 'getSourceDiffResults.reset' );
        eventBus.publish( 'getTargetDiffResults.reset' );
    }
};

export async function replaceHiddenElementsWithVisibleElements( selectedObjects, selectedObjectPci ) {
    //If to be selected object is hidden line then select pack master.
    let elementsToSelect = [];
    let inputElements = [];
    _.forEach( selectedObjects, function( toBeSelected ) {
        if( toBeSelected !== null ) {
            inputElements.push( toBeSelected );
        }
    } );
    if( !_.isEmpty( inputElements ) ) {
        // For every selection on find panel, get bomline SRUID
        let bomlineSRUIDsResponse = await aceBackingObjectProviderService.getBackingObjects( inputElements );
        var bomlineSRUIDs = [];
        _.forEach( bomlineSRUIDsResponse, function( bomLine, index ) {
            bomlineSRUIDs[ index ] = bomLine.uid;
        } );

        let response = await csidsToObjSvc.doPerformSearchForProvidedSRUIDs( bomlineSRUIDs, 'true', [], selectedObjectPci );
        if( !_.isEmpty( response.elementsInfo ) ) {
            _.forEach( response.elementsInfo, function( elementsInfo, index ) {
                if( elementsInfo.visibleElement && cdm.isValidObjectUid( elementsInfo.visibleElement.uid ) ) {
                    elementsToSelect.push( elementsInfo.visibleElement );
                } else if( elementsInfo.element && cdm.isValidObjectUid( elementsInfo.element.uid ) ) {
                    elementsToSelect.push( elementsInfo.element );
                }
            } );
        } else {
            elementsToSelect = elementsToSelect.concat( inputElements );
        }
        return _.uniq( elementsToSelect );
    }

    return [];
}

export let performCompare = function( compareContext, compareInput, refresh, autoOpenDiffPanel, compareContextAtomicData, deferred ) {
    return exports.invokeSoa( compareContext, compareInput ).then(
        function( response ) {
            // If compare was invoked with background option, then do't process the results
            if( response ) {
                if( response.totalNoOfSourceDifferences !== undefined && response.totalNoOfSourceDifferences === 0 ) {
                    compareContext.sourceDifferences = [];
                }
                if( response.totalNoOfTargetDifferences !== undefined && response.totalNoOfTargetDifferences === 0 ) {
                    compareContext.targetDifferences = [];
                }
                compareContext.isCompareRequestInProgress = false;
                if( compareInput.inputData.compareInBackground ) {
                    compareContextAtomicData.update( compareContext );
                    return;
                }
                compareContext.isInCompareMode = true;
                compareContext.equivalenceObj = getEquivalenceList( compareContext, response );
                structureCompareSvc.subscribeForTreeNodesLoaded();
                structureCompareSvc.subscribeToPackUnpackSuccessful();
                //Display Options
                if( response.compareOptions ) {
                    setDisplayOptions( compareContext, response.compareOptions );
                }

                if( compareContext.sourceDiffs !== null || compareContext.tagretDiffs !== null ) {
                    updateCompareDifferencesData( compareContext, compareInput, refresh, response );
                    exports.updateColorMapData( compareContext, compareInput.inputData.startFreshCompare );
                    appCtxSvc.updatePartialCtx( 'compareContext.sourceColorDiffs', compareContext.sourceColorDiffs );
                    appCtxSvc.updatePartialCtx( 'compareContext.targetColorDiffs', compareContext.targetColorDiffs );
                    let contextKeys = awStructureCompareUtils.getContextKeys();
                    exports.setDecoratorStyles( appCtxSvc.getCtx( contextKeys.leftCtxKey ).vmc.getLoadedViewModelObjects() );
                    exports.setDecoratorStyles( appCtxSvc.getCtx( contextKeys.rightCtxKey ).vmc.getLoadedViewModelObjects() );

                    /** Following is being used for now in parallel to '_diffPanelOpened'.
                     * It will merged properly when we remove compare location. */
                    if( structureCompareSvc.getAutoOpenComparePanelValue() ) {
                        exports.showComparePanel();
                    }
                }
                if( compareContextAtomicData ) {
                    compareContextAtomicData.update( compareContext );
                } else {
                    return deferred.resolve( compareContext );
                }
            }
        } );
};

export let invokeSoa = function( compareContext, compareInput ) {
    return soaSvc
        .postUnchecked( 'Internal-ActiveWorkspaceBom-2024-12-Compare', 'compareContent3', compareInput ).then(
            function( response ) {
                if( response.ServiceData && response.ServiceData.partialErrors ) {
                    return processErrorsAndWarnings( compareContext, response );
                } else if( compareInput.inputData.generateReport && compareInput.inputData.compareInBackground === false ) {
                    // This block will execute in the case of sync compare when generateReport is checked.
                    let infoMessage = localeSvc.getLoadedText( 'StructureCompareMessages' ).compareReportLocation;
                    let targetSelectionObj = cdm.getObject( compareInput.inputData.target.element.uid );
                    let topParent = getToplevelParent( targetSelectionObj );
                    infoMessage = infoMessage.replace( '{0}', topParent.props.awb0Archetype.uiValues[0] );
                    messagingSvc.showInfo( infoMessage );
                }
                return response;
            } );
};

export let getSelectedVMOs = function() {
    return {
        source: _sourceVMOs,
        target: _targetVMOs
    };
};

let _parseDelimitedUid = function( delimitedUid ) {
    let indx = delimitedUid.indexOf( awStructureCompareUtils.getDelimiterKey() );
    let uid = delimitedUid;
    if( indx > -1 ) {
        let uids = delimitedUid.split( awStructureCompareUtils.getDelimiterKey(), 2 );
        uid = uids[ 0 ]; //Get the first uid
    }
    return uid;
};

export let updateColorMapData = function( compareContext, startFreshCompare ) {
    let sourceVMDiffs = compareContext.sourceDiffs;
    let targetVMDiffs = compareContext.targetDiffs;
    let sourcePageDiffs = compareContext.sourceDifferences;
    let targetPageDiffs = compareContext.targetDifferences;
    let sourceColorDiffs = {};
    let targetColorDiffs = {};
    for( let key in sourceVMDiffs ) {
        sourceColorDiffs[ _parseDelimitedUid( key ) ] = sourceVMDiffs[ key ];
    }
    for( let key in targetVMDiffs ) {
        targetColorDiffs[ _parseDelimitedUid( key ) ] = targetVMDiffs[ key ];
    }
    if( sourcePageDiffs !== undefined ) {
        for( let diffElement in sourcePageDiffs ) {
            sourceColorDiffs[ _parseDelimitedUid( sourcePageDiffs[ diffElement ].uids ) ] = sourcePageDiffs[ diffElement ].diff;
        }
    }
    if( targetPageDiffs !== undefined ) {
        for( let diffElement in targetPageDiffs ) {
            targetColorDiffs[ _parseDelimitedUid( targetPageDiffs[ diffElement ].uids ) ] = targetPageDiffs[ diffElement ].diff;
        }
    }
    compareContext.sourceColorDiffs = sourceColorDiffs;
    compareContext.targetColorDiffs = targetColorDiffs;
    _updatePropertyDiffMap( compareContext, startFreshCompare );
};

export let resetData = function() {
    appCtxSvc.updatePartialCtx( 'decoratorToggle', null );
    appCtxSvc.unRegisterCtx( 'compareList' );
    appCtxSvc.unRegisterCtx( 'compareContext' );
    appCtxSvc.unRegisterCtx( 'cellClass' );
};

export let resetCompareColorData = function( compareContext, isExecutedFromPanel ) {
    if( compareContext &&
        !compareContext.isInMultiLevelCompare ) {
        let contextKeys = awStructureCompareUtils.getContextKeys();
        resetContextData( compareContext, isExecutedFromPanel );
        exports.setDecoratorStyles( appCtxSvc.getCtx( contextKeys.leftCtxKey ).vmc.getLoadedViewModelObjects() );
        exports.setDecoratorStyles( appCtxSvc.getCtx( contextKeys.rightCtxKey ).vmc.getLoadedViewModelObjects() );
        resetHighlights( compareContext.propertyDiffs );
    }
};

export let showBackgroundMessage = function( compareList ) {
    let resource = 'StructureCompareMessages';
    let localeTextBundle = localeSvc.getLoadedText( resource );
    let infoMessage = localeTextBundle.messageForBackgroundCompare;

    let sourceSelectionObj = cdm.getObject( compareList.sourceSelection );
    let targetSelectionObj = cdm.getObject( compareList.targetSelection );
    infoMessage = infoMessage.replace( '{0}', sourceSelectionObj.props.object_string.uiValues );
    infoMessage = infoMessage.replace( '{1}', targetSelectionObj.props.object_string.uiValues );

    messagingSvc.showInfo( infoMessage );
};

export let navigateDifferences = function( compareSrc, compareTrg, compareContext, gridLocation, selection ) {
    let selectionsToModify = {
        elementsToSelect: [],
        overwriteSelections: true
    };
    if( selection !== undefined && selection.length > 0 ) {
        var focus_uid = selection[ 0 ].uid;
        if( gridLocation === 1 ) {
            let sourceDiff = compareContext.srcEquivalentList;
            loadAndFetchEquivalentObject( focus_uid, sourceDiff ).then( async function( equivalentObjects ) {
                equivalentObjects = await replaceHiddenElementsWithVisibleElements( equivalentObjects, compareTrg.productContextInfo );
                if( equivalentObjects.length > 0 ) {
                    selectionsToModify.elementsToSelect = equivalentObjects;
                    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareTrg );

                    let equivalentSiblings = [];
                    let targetDiff = compareContext.trgEquivalentList;
                    for( let i = 0; i < equivalentObjects.length; i++ ) {
                        equivalentSiblings = getEquivalentObject( equivalentObjects[ i ].uid, targetDiff );
                        if( equivalentSiblings && equivalentSiblings.length > 0 ) {
                            break;
                        }
                    }

                    const selectionSyncNeeded = structureCompareSvc.isSelectionNeeded( selection, equivalentSiblings );

                    if( selectionSyncNeeded ) {
                        AwTimeoutService.instance( async function() {
                            equivalentSiblings = await replaceHiddenElementsWithVisibleElements( equivalentSiblings, compareSrc.productContextInfo );

                            if( equivalentSiblings.length > 0 ) {
                                selectionsToModify.elementsToSelect = equivalentSiblings;
                                occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareSrc );
                            }
                        }, 0, false );
                    }

                    structureCompareSvc.setCrossSelectionFlag();
                    structureCompareSvc.resetCrossSelectionFlag();
                }
            } );
        } else if( gridLocation === 2 ) {
            let targetDiff = compareContext.trgEquivalentList;
            loadAndFetchEquivalentObject( focus_uid, targetDiff ).then( async function( equivalentObjects ) {
                equivalentObjects = await replaceHiddenElementsWithVisibleElements( equivalentObjects, compareSrc.productContextInfo );
                if( equivalentObjects.length > 0 ) {
                    selectionsToModify.elementsToSelect = equivalentObjects;
                    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareSrc );

                    let equivalentSiblings = [];
                    let sourceDiff = compareContext.srcEquivalentList;
                    for( let i = 0; i < equivalentObjects.length; i++ ) {
                        equivalentSiblings = getEquivalentObject( equivalentObjects[ i ].uid, sourceDiff );
                        if( equivalentSiblings && equivalentSiblings.length > 0 ) {
                            break;
                        }
                    }

                    const selectionSyncNeeded = structureCompareSvc.isSelectionNeeded( selection, equivalentSiblings );
                    if ( selectionSyncNeeded ) {
                        AwTimeoutService.instance( async function() {
                            equivalentSiblings = await replaceHiddenElementsWithVisibleElements( equivalentSiblings, compareTrg.productContextInfo );
                            if( equivalentSiblings.length > 0 ) {
                                selectionsToModify.elementsToSelect = equivalentSiblings;
                                occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareTrg );
                            }
                        }, 0, false );
                    }

                    structureCompareSvc.setCrossSelectionFlag();
                    structureCompareSvc.resetCrossSelectionFlag();
                }
            } );
        }
    } else {
        let _sourceDiffs = compareContext.sourceDiffs;
        let _targetDiffs = compareContext.targetDiffs;
        let _srcColorCode = 0;
        let _trgColorCode = 0;
        let isCrossSelectionFlagNeedReset = false;
        if( gridLocation === 1 && _targetDiffs ) {
            let _trgSelection = [ compareTrg.pwaSelection[ 0 ].uid ];
            _trgColorCode = _targetDiffs[ _trgSelection[ 0 ] ];
            if( _trgColorCode !== 2 ) {
                occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareSrc );
                isCrossSelectionFlagNeedReset = true;
            }
        }
        if( gridLocation === 2 && _sourceDiffs ) {
            let _srcSelection = [ compareSrc.pwaSelection[ 0 ].uid ];
            _srcColorCode = _sourceDiffs[ _srcSelection[ 0 ] ];
            if( _srcColorCode !== 2 ) {
                occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareTrg );
                isCrossSelectionFlagNeedReset = true;
            }
        }
        if( _srcColorCode === 2 || _trgColorCode === 2 || _srcColorCode === 4 || _trgColorCode === 4 ) {
            occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareSrc );
            occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, compareTrg );
            isCrossSelectionFlagNeedReset = true;
        }
        if( isCrossSelectionFlagNeedReset ) {
            structureCompareSvc.setCrossSelectionFlag();
            structureCompareSvc.resetCrossSelectionFlag();
        }
    }
};

export let focusDiffResults = function( gridLocation, dataProvider ) {
    if( gridLocation === 1 && dataProvider.cursorObject === null ) {
        dataProvider.cursorObject = appCtxSvc.getCtx( 'compareContext.sourceCursor' );
    } else if( gridLocation === 2 && dataProvider.cursorObject === null ) {
        dataProvider.cursorObject = appCtxSvc.getCtx( 'compareContext.targetCursor' );
    }
};

export let toggleEquivalentRow = function( vmc, equivalentList, selectedUID ) {
    // Get the equivalence object
    let equivalentObjects = getEquivalentObject( selectedUID, equivalentList );

    //Expand the equivalence node in other tree (only for partial match)
    if( vmc && equivalentObjects && equivalentObjects.length > 0 ) {
        var objNdx = vmc.findViewModelObjectById( equivalentObjects[ 0 ].uid );
        if( objNdx > -1 ) {
            var vmNode = vmc.getViewModelObject( objNdx );
            vmNode.isSystemExpanded = true;
            eventBus.publish( vmc.name + '.expandTreeNode', {
                parentNode: vmNode
            } );
        }
    }
};


/**
 * Structure Compare service utility
 */

export default exports = {
    initializeCompareList,
    resetCompareContext,
    showComparePanel,
    setDecoratorStyles,
    performCompare,
    invokeSoa,
    getSelectedVMOs,
    updateColorMapData,
    resetData,
    resetCompareColorData,
    showBackgroundMessage,
    navigateDifferences,
    focusDiffResults,
    toggleEquivalentRow,
    replaceHiddenElementsWithVisibleElements
};
