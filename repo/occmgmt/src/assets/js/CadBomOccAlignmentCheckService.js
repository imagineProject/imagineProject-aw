// Copyright (c) 2022 Siemens

/**
 * Service for Alignment Check feature related APIs.
 * @module js/CadBomOccAlignmentCheckService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import dataManagementService from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import locationNavigationService from 'js/locationNavigation.service';
import soaService from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaOpenInViewPanelService from 'js/cbaOpenInViewPanelService';
import cbaConstants from 'js/cbaConstants';
import cbaFindAlignedService from 'js/cbaFindAlignedService';
import occmgmtUtils from 'js/occmgmtUtils';
import CadBomOccAlignmentCheckUtil from 'js/CadBomOccAlignmentCheckUtil';
import cadBomOccurrenceAlignmentService from 'js/CadBomOccurrenceAlignmentService';
import AwPromiseService from 'js/awPromiseService';
import occmgmtGetSvc from 'js/aceGetService';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';

let exports = {};

// Constants
export const CBA_SRC_CONTEXT = 'CBASrcContext';
export const CBA_TRG_CONTEXT = 'CBATrgContext';

const DISPLAY_OPTIONS_ALIGNED = 'ALIGNED';
const DISPLAY_OPTIONS_NOTALIGNED = 'NOTALIGNED';

const MATCH_TYPE_MISSING_SOURCE = 'MISSING_SOURCE';
const MATCH_TYPE_MISSING_TARGET = 'MISSING_TARGET';
const MATCH_TYPE_FULL_MATCH = 'FULL_MATCH';
const MATCH_TYPE_MULTIPLE_FULL_MATCH = 'MULTIPLE_FULL_MATCH';

const CURRENT_LEVEL = 1;
const REUSE_SAVED_RESULTS = -2;

const ACC_ALIGNMENT_CHECK_CRITERIA = 'ACC_ALIGNMENT_CHECK_CRITERIA';

const DIFFERENCES_VALID_VALUES = [ 1, 2, 3, 4, 5, 6, 7, 101, 102, 103, 273, 284, 357, 359, 360, 377, 397, 485, 488, 614, 869, 913, 2000, 2869, 2896, 2909, 2980, 2985, 3000, 3009, 3024, 3037, 4000 ];
const CTX_PATH_DATASETUID = 'cbaContext.alignmentCheckContext.dataSetUID';

// Variables
let _eventSubDefs = [];
let _sourceVMOs = [];
let _targetVMOs = [];

/**
  * Execute Alignmwent Check on node expansion
  */
const executeAlignmentCheckOnNodeExpansion = ( expandedTreeNode, contextKey ) => {
    // When a node is expanded, check if all chidren are alignment checked, if not then only make server call.
    if( CadBomOccAlignmentCheckUtil.isAlignmentCheckDoneForAllChildren( expandedTreeNode, contextKey ) ) {
        return;
    }

    let srcCompareInfo = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_SRC_CONTEXT );
    let trgCompareInfo = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_TRG_CONTEXT );
    if( srcCompareInfo && trgCompareInfo ) {
        let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
        let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );
        let dataSetUID = appCtxSvc.getCtx( CTX_PATH_DATASETUID );

        let depth = dataSetUID ? REUSE_SAVED_RESULTS : CURRENT_LEVEL;
        let startFreshCompare = !dataSetUID;

        let alignmentCheckInfo = _getAlignmentCheckInfoObject( depth, depth, sourceVMOs, targetVMOs,
            startFreshCompare, false, dataSetUID, null, srcCompareInfo.element, trgCompareInfo.element );

        let srcTop = _.find( sourceVMOs, CadBomOccAlignmentCheckUtil.getTopNode );
        let trgTop = _.find( targetVMOs, CadBomOccAlignmentCheckUtil.getTopNode );

        alignmentCheckInfo.srcTopElement = srcTop;
        alignmentCheckInfo.trgTopElement = trgTop;

        alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT, [ 1, 3 ]  );
        alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT, [ 1, 3 ]  );

        // If visibleUids has the entry of top node only then it means that all expanded nodes are having an alignment status
        // Here we don't need to call execute alignment check for top node
        //   as expanded nodes are already evaluated in previous compareContent2 call
        if( alignmentCheckInfo.sourceInfo.visibleUids.length === 1 && alignmentCheckInfo.sourceInfo.visibleUids[0] === srcTop.uid &&
            alignmentCheckInfo.targetInfo.visibleUids.length === 1 && alignmentCheckInfo.targetInfo.visibleUids[0] === trgTop.uid ) {
            return;
        }
        _executeAlignmentCheck( alignmentCheckInfo );
    }
};

/**
  *Function to call when ACE visibility change event is fired
  *
  * @param {Object} data - Source or Target tree data
  */
const _visibilityChangeListener = function( data ) {
    if( _.has( data, [ 'scope' ] ) && data.scope.subPanelContext ) {
        // Check if RedLineMode is changed or not
        let isRedlineModeChanged = appCtxSvc.getCtx( 'cbaContext.redLineMode.isModeChanged' );

        if( isRedlineModeChanged  ) {
            if( !data.isTreePropertiesLoaded ) {
                // If redLineMode is changed and properties are not loaded, do not process further as it will go
                //in other code flow
                return;
            } else if( _targetVMOs && _sourceVMOs ) {
                // If redLineMode is changed then we need to make fresh compareContent SOA call
                // with new loaded uids , so clear all VMOs from variables.
                _targetVMOs = null;
                _sourceVMOs = null;
            }
        }

        if( data.scope.subPanelContext.provider.dataProviderName === 'trgOccDataProvider' ) {
            _targetVMOs = data.scope.data.dataProviders.trgOccDataProvider.viewModelCollection.loadedVMObjects;
        } else {
            _sourceVMOs = data.scope.data.dataProviders.srcOccDataProvider.viewModelCollection.loadedVMObjects;
        }
        let provider = data.scope.subPanelContext.provider;
        let isCBAFirstLaunch = provider.cbaContext.isCBAFirstLaunch;
        let newCbaContext = { ...data.scope.subPanelContext.provider.cbaContext.value };

        let isAlignmentStatusModeON = CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();
        let isAlignmentCheckInBackgroundMOde = CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode();

        if( isCBAFirstLaunch ) {
            if( _sourceVMOs && _sourceVMOs.length > 0 && _targetVMOs && _targetVMOs.length > 0 ) {
                newCbaContext.isCBAFirstLaunch = false;
                provider.cbaContext.update( newCbaContext );
                let dataSetUID = appCtxSvc.getCtx( 'state.params.datasetUid' );
                if( dataSetUID ) {
                    let alignmentCheckInfo = _getAlignmentCheckInfoObject( REUSE_SAVED_RESULTS, REUSE_SAVED_RESULTS, _sourceVMOs, _targetVMOs,
                        false, false, dataSetUID );
                    alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT );
                    alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT );
                    _executeAlignmentCheck( alignmentCheckInfo  );
                }
            } else if( provider.openedObject && !( data.scope.subPanelContext && provider.cbaContext.srcStructure && provider.cbaContext.trgStructure ) ) {
                let promise = cbaOpenInViewPanelService.initializeServiceForLinkedBom( provider );
                promise.then( function() {
                    let panelContext = cbaOpenInViewPanelService.getOpenPanelConextFromGrid( provider.gridId );
                    cbaOpenInViewPanelService.populateFilterTypesForOpenInViewPanel( panelContext.contextKey );
                    panelContext.cbaContext = provider.cbaContext;
                    if ( panelContext.cbaContext ) {
                        eventBus.publish( 'cba.executeCommandOpenPanel', panelContext );
                        newCbaContext.isCBAFirstLaunch = false;
                        provider.cbaContext.update( newCbaContext );
                    }
                } );
            }
        } else if( isAlignmentStatusModeON ) {
            // Expand Node case & Add (Update/Merge cache approach)
            // If All level alignment check done then for expand node operation start fresh navigation should be false.
            if( newCbaContext.lastAction === 'REVISE' || newCbaContext.lastAction === 'INSERT_ELEMENT' ) {
                // After REVISE this listener will get called 2 times, first before property loading and then after property loading
                // Before property loading we need to ignore but should not go in below blocks.
                if( data.isTreePropertiesLoaded ) {
                    newCbaContext.lastAction = '';
                    provider.cbaContext.update( newCbaContext );

                    // Clear All cache before making SOA call
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, {} );
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
                    let datasetUid = appCtxSvc.getCtx( cbaConstants.CTX_PATH_STATE_PARAMS_DATASETUID );
                    if( datasetUid ) {
                        CadBomOccAlignmentCheckUtil.clearDatasetUid();
                    }

                    let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
                    let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

                    let alignmentCheckInfo = _getAlignmentCheckInfoObject( CURRENT_LEVEL, CURRENT_LEVEL, sourceVMOs, targetVMOs,
                        true, false, null );

                    alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT );
                    alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT );

                    _executeAlignmentCheck( alignmentCheckInfo  );
                }
            } else if( !isRedlineModeChanged && !newCbaContext.isConfigurationChanged && (
                data.isAlignmentChanged || _isExpansionCase( data.scope.subPanelContext ) ||
                data.isTreePropertiesLoaded && newCbaContext.lastAction !== 'ADD_CHILD' && newCbaContext.lastAction !== 'RESET' ||
                newCbaContext.lastAction === 'ADD_CHILD' && !isAlignmentCheckInBackgroundMOde  ) ) {
                delete data.isAlignmentChanged;
                newCbaContext.lastAction = '';
                provider.cbaContext.update( newCbaContext );
                exports.executeAlignmentCheckOnNodeExpansion();
            } else if( isRedlineModeChanged || data.isTreePropertiesLoaded && newCbaContext.isConfigurationChanged ||
                    appCtxSvc.getCtx( 'cbaContext.isAutomatedUpdate' ) || newCbaContext.lastAction === 'RESET' && data.isTreePropertiesLoaded ) {
                // Note : For Configuration change , Alignment check should get called for complete structure (clear and update approach)
                // Clearing the cache
                if( !_.isEmpty( _targetVMOs ) && !_.isEmpty( _sourceVMOs ) ) {
                    appCtxSvc.updatePartialCtx( 'cbaContext.redLineMode.isModeChanged', false );
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, {} );
                    appCtxSvc.updatePartialCtx( 'cbaContext.isAutomatedUpdate', null );
                    let datasetUid = appCtxSvc.getCtx( cbaConstants.CTX_PATH_STATE_PARAMS_DATASETUID );
                    if( datasetUid ) {
                        CadBomOccAlignmentCheckUtil.clearDatasetUid();
                    }

                    // Reset configuration changes as false
                    newCbaContext.isConfigurationChanged = false;
                    provider.cbaContext.update( newCbaContext );
                    newCbaContext.lastAction = '';

                    // Load new
                    let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
                    let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

                    let alignmentCheckInfo = _getAlignmentCheckInfoObject( CURRENT_LEVEL, CURRENT_LEVEL, sourceVMOs, targetVMOs,
                        true, false, null );
                    alignmentCheckInfo.isAddAllVisibleUids = true;
                    alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT );
                    alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT );

                    _executeAlignmentCheck( alignmentCheckInfo  );
                    eventBus.publish( 'cba.refreshTree' );
                }
            }
        }else if( newCbaContext.isConfigurationChanged ) {
            // Alignment Check Mode OFF and configuration changed then clear Find Aligned Indicators if any visible.
            newCbaContext.isConfigurationChanged = false;
            provider.cbaContext.update( newCbaContext );

            let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );

            if( findAlignedInfo && !_.isEmpty( findAlignedInfo ) ) {
                appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
                eventBus.publish( 'cba.refreshTree' );
            }
        } else if( !_isExpansionCase( data.scope.subPanelContext ) ) {
            // If CBA Already launched and No Alignment Check Mode

            eventBus.publish( 'cba.refreshTree' );
        }
    }
};

const _populateFindAlignedCacheInCtx = function( selectedSourceLines, sourceView, selectedTargetLines, targetView ) {
    let deferred = AwPromiseService.instance.defer();

    let promises = [];
    // Find Aligned Mapping
    for( const selectedSrcLine of selectedSourceLines ) {
        let selectedSrcObject = cdmSvc.getObject( selectedSrcLine );

        // Retrieve the underlying object of the selected source object
        let underlyingObj = cdmSvc.getObject( selectedSrcObject.props.awb0UnderlyingObject.dbValues[0] );

        let promise = null;

        // Check if the underlying object is of type 'EDAComPart Revision'
        if( CadBomOccAlignmentCheckUtil.isMultiDomainExistsInGivenObjects( underlyingObj.uid, [ underlyingObj ] ) ) {
            // If true, resolve the promise with the underlying object
            promise = new Promise( ( resolve )=>{
                resolve( underlyingObj );
            } );
        } else {
            // Otherwise, get the aligned object of the underlying object
            promise = cadBomOccurrenceAlignmentService.getAlignedObject( underlyingObj );
        }

        promises.push( promise );
    }

    let targetLineUndelyingToLine = {};
    for( const selectedTrgObject of selectedTargetLines ) {
        let underlyingObj = cdmSvc.getObject( selectedTrgObject.props.awb0UnderlyingObject.dbValues[0] );
        let underlyingUid = underlyingObj.uid;
        let targetUid = selectedTrgObject.uid;
        if ( !targetLineUndelyingToLine[ underlyingUid ] ) {
            targetLineUndelyingToLine[ underlyingUid ] = [];
        }
        targetLineUndelyingToLine[ underlyingUid ].push( targetUid );
    }

    // Populated Find Aligned MAP

    return Promise.all( promises ).then( ( values ) => {
        let resultMap = {};

        for ( let index = 0; index < selectedSourceLines.length; index++ ) {
            const selectedSrcLine = selectedSourceLines[ index ];
            const uid = values[ index ].uid;

            // Fix LCS-1079749 Alignment Indicator issue when we drag drop flexible design nodes on Part
            // Ensure the index is within bounds of the target UID array
            const targetUids = targetLineUndelyingToLine[ uid ];
            if ( targetUids && targetUids.length !== 1 && index < targetUids.length ) {
                resultMap[ selectedSrcLine ] = [ targetUids[ index ] ];
            } else {
                resultMap[ selectedSrcLine ] = targetLineUndelyingToLine[ uid ];
            }
        }

        let findAlignedInfo = {};
        findAlignedInfo[sourceView] = {};
        findAlignedInfo[targetView] = {};

        for ( const srcUid in resultMap ) {
            let trgUid = resultMap[srcUid];
            findAlignedInfo[sourceView][srcUid] = {
                mappingUids:[ trgUid ],
                status:-1
            };

            findAlignedInfo[targetView][trgUid] = {
                mappingUids:[ srcUid ],
                status:-1
            };
        }

        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedInfo );
        eventBus.publish( 'cba.refreshTree' );
        deferred.resolve( resultMap );
    } );
};

const _populateAlignmentCheckCacheInCtx = function( selectedSourceLines, sourceView, selectedTargetLines, targetView ) {
    let deferred = AwPromiseService.instance.defer();

    let promises = [];
    // Find Aligned Mapping
    for( const selectedSrcLine of selectedSourceLines ) {
        let selectedSrcObject = cdmSvc.getObject( selectedSrcLine );

        let underlyingObj = cdmSvc.getObject( selectedSrcObject.props.awb0UnderlyingObject.dbValues[0] );


        let promise = cadBomOccurrenceAlignmentService.getAlignedObject( underlyingObj );
        promises.push( promise );
    }

    let targetLineUndelyingToLine = {};
    for( const selectedTrgObject of selectedTargetLines ) {
        let underlyingObj = cdmSvc.getObject( selectedTrgObject.props.awb0UnderlyingObject.dbValues[0] );
        targetLineUndelyingToLine[underlyingObj.uid] = selectedTrgObject.uid;
    }

    // Populated Find Aligned MAP

    return Promise.all( promises ).then( ( values ) => {
        let resultMap = {};

        for( let index = 0; index < selectedSourceLines.length; index++ ) {
            const selectedSrcLine = selectedSourceLines[ index ];
            resultMap[ selectedSrcLine ] = targetLineUndelyingToLine[values[ index ].uid];
        }

        let findAlignedInfo = {};
        findAlignedInfo[sourceView] = {};
        findAlignedInfo[targetView] = {};

        for ( const srcUid in resultMap ) {
            let trgUid = resultMap[srcUid];
            findAlignedInfo[sourceView][srcUid] = {
                mappingUids:[ trgUid ],
                status:4
            };

            findAlignedInfo[targetView][trgUid] = {
                mappingUids:[ srcUid ],
                status:4
            };
        }

        let alignmentCheckInfo = cbaFindAlignedService.getUpdateAlignmentCheckInfo( findAlignedInfo );

        let alignmentCheckInfoCache = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );

        alignmentCheckInfoCache[ cbaConstants.CBA_SRC_CONTEXT ] =
        CadBomOccAlignmentCheckUtil.mergeAlingmentCheckCacheObjects( alignmentCheckInfoCache[cbaConstants.CBA_SRC_CONTEXT], alignmentCheckInfo.CBASrcContext );

        alignmentCheckInfoCache[ cbaConstants.CBA_TRG_CONTEXT ] =
        CadBomOccAlignmentCheckUtil.mergeAlingmentCheckCacheObjects( alignmentCheckInfoCache[cbaConstants.CBA_TRG_CONTEXT], alignmentCheckInfo.CBATrgContext );


        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, alignmentCheckInfoCache );
        eventBus.publish( 'cba.refreshTree' );
        deferred.resolve( resultMap );
    } );
};

/**
  * Function to call when ACE Add Element event is fired
  *
  * @param { object } eventData Event Data
  */
const _addElementListener = async function( eventData ) {
    // when alignment check status toggle is ON and if user add element
    //then system should update the indicator for newly added node
    let isAlignmentStatusModeON =  CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();
    if( !isAlignmentStatusModeON ) {
        clearAlignmentCheckStatus();
        eventBus.publish( 'cba.changeEBOMToDefaultMode' );

        // Alignment Check OFF and Drag Drop case
        if( eventData?.addElementInput && eventData.addElementInput.addObjectIntent === 'Pma1Automation' ) {
            let selectedLinesInfo = _populateSelectedLinesInfoInAddElementListener( eventData );

            await _populateFindAlignedCacheInCtx( selectedLinesInfo.selectedSourceLines, selectedLinesInfo.sourceView,
                selectedLinesInfo.selectedTargetLines, selectedLinesInfo.targetView );
        }
    }else {
        let value = eventData?.scope?.subPanelContext?.cbaContext?.value;
        // After INSERT LEVEL also add elements gets called
        if( value && value.lastAction !== 'INSERT_ELEMENT' ) {
            let newCbaContext = { ...eventData.scope.subPanelContext.cbaContext.value };
            // TODO Read all actions from a constants
            newCbaContext.lastAction = 'ADD_CHILD';
            eventData.scope.subPanelContext.cbaContext.update( newCbaContext );
        } else if( eventData?.addElementInput && eventData.addElementInput.addObjectIntent === 'Pma1Automation' ) {
            let selectedLinesInfo = _populateSelectedLinesInfoInAddElementListener( eventData );

            await _populateAlignmentCheckCacheInCtx( selectedLinesInfo.selectedSourceLines, selectedLinesInfo.sourceView,
                selectedLinesInfo.selectedTargetLines, selectedLinesInfo.targetView );
        }
    }
};

/**
  * Function to call when ACE Insert Element event is fired
  *
  * @param { object } eventData Event Data
  */
const _insertElementListener = async function( eventData ) {
    // when alignment check status toggle is ON and if user add element
    //then system should update the indicator for newly added node
    let isAlignmentStatusModeON =  CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();
    if( !isAlignmentStatusModeON ) {
        exports.clearAlignmentCheckStatus();
    }else {
        let value = eventData?.scope?.subPanelContext?.cbaContext?.value;
        if( value ) {
            let newCbaContext = { ...eventData.scope.subPanelContext.cbaContext.value };
            // TODO Read all actions from a constants
            newCbaContext.lastAction = 'INSERT_ELEMENT';
            eventData.scope.subPanelContext.cbaContext.update( newCbaContext );
            // After insert line , we change background mode to foreground mode
            CadBomOccAlignmentCheckUtil.clearBackgroundAlignmentCheckData();
        }
    }
};

/**
  * Function to call when ACE Insert Element event is fired
  *
  * @param { object } eventData Event Data
  */
const _resetStructureListener = async function( eventData ) {
    // when alignment check status toggle is ON and if user add element
    //then system should update the indicator for newly added node
    let isAlignmentStatusModeON =  CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();
    if( !isAlignmentStatusModeON ) {
        exports.clearAlignmentCheckStatus();
    }else {
        let value = eventData?.scope?.props?.commandContext?.cbaContext?.value;
        if( value ) {
            let newCbaContext = { ...eventData.scope.props.commandContext.cbaContext.value };
            // TODO Read all actions from a constants
            newCbaContext.lastAction = 'RESET';
            eventData.scope.props.commandContext.cbaContext.update( newCbaContext );
        }
    }

    // Should Close the Guided Update Panel after Reset View
    if( CBAImpactAnalysisService.isImpactAnalysisMode() ) {
        cadBomOccurrenceAlignmentService.unSetImpactAnalysisMode( eventData?.scope?.props?.commandContext );
    }
};

/**
  * Get created object which represents Alignment Check Info object
  *
  * @param {number} srcDepth - Source depth
  * @param {number} trgDepth - Target depth
  * @param {Array} srcVMOs - Source VMOs
  * @param {Array} trgVMOs - Source VMOs
  * @param {boolean} starFreshCheck - true if need fresh alignment check else false
  * @param {boolean} runInBackground - true if need alignment check to be done in background else false
  * @param {Object} dataSetUID - dataSet Uid
  * @param {Object} panelData - Alignment Check Setting panel object
  * @param {Object} srcCtx - Source context object
  * @param {Object} trgCtx - Target context object
  *
  * @returns {object} Alignment Check info object
  */
const _getAlignmentCheckInfoObject = function( srcDepth, trgDepth, srcVMOs, trgVMOs, starFreshCheck, runInBackground, dataSetUID, panelData, srcCtx, trgCtx ) {
    return {
        sourceInfo: {
            depth: srcDepth,
            VMOs: srcVMOs,
            contextElement: srcCtx
        },
        targetInfo: {
            depth: trgDepth,
            VMOs: trgVMOs,
            contextElement: trgCtx
        },
        startFreshAlignmentCheck: starFreshCheck,
        runInBackground: runInBackground,
        panelData: panelData,
        dataSetUID: dataSetUID
    };
};

/**
  * Execute alignment check
  *
  * @param {Object} alignmentCheckInfo - Alignment Check Info object which contains source and target info.
  */
const _executeAlignmentCheck = function( alignmentCheckInfo ) {
    let alignmentCheckInput = _createAlignmentCheckInput( alignmentCheckInfo );
    _performAlignmentCheck( alignmentCheckInput, alignmentCheckInfo.isAddAllVisibleUids );
};

/**
  * Get view model objects from context
  *
  * @param {String} contextKey - Source or Target Context key
  * @returns {object} List of view model objects
  */
const _getLoadedVMOjects = function( contextKey ) {
    let loadedVMObjects = [];
    const vmc = appCtxSvc.getCtx( `${contextKey}.vmc` );
    if( vmc ) {
        loadedVMObjects.push( ..._.cloneDeep( vmc.getLoadedViewModelObjects() ) );
    }
    return loadedVMObjects;
};

/**
  * get element from context
  *
  * @param {String} context - CBA Source or Target context
  * @returns {object} - Element Object
  */
const _getElementFromContext = function( context ) {
    let element;
    let uid = appCtxSvc.getCtx( context + '.currentState.t_uid' );

    if( cdmSvc.isValidObjectUid( uid ) ) {
        element = cdmSvc.getObject( uid );

        if( !element ) {
            console.log( 'No element found for uid:' + uid + ', get element from context from previous alignment check.' );
            let alignmentCheckInfo = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( context );
            element = alignmentCheckInfo ? alignmentCheckInfo.element : null;
        }
    }
    return element;
};

/**
  * get Product Context from context
  *
  * @param {String} contextKey - CBA Source or Target context
  * @returns {object} - Product Context Object
  */
const _getProductContextFromContext = function( contextKey ) {
    return appCtxSvc.getCtx( contextKey + '.productContextInfo' );
};

/**
  * Get compare info object
  *
  * @param {String} contextKey Context name for source or target
  * @param {object} alignmentCheckInfo alignment check info object
  * @returns {object} Compare info object
  */
const _getCompareInfo = function( contextKey, alignmentCheckInfo ) {
    let sourceInfo = alignmentCheckInfo.sourceInfo;
    let targetInfo = alignmentCheckInfo.targetInfo;

    let visibleUids = contextKey === CBA_SRC_CONTEXT ? sourceInfo.visibleUids : targetInfo.visibleUids;
    let depth = contextKey === CBA_SRC_CONTEXT ? sourceInfo.depth : targetInfo.depth;
    let contextElement = contextKey === CBA_SRC_CONTEXT ? sourceInfo.contextElement : targetInfo.contextElement;

    let element = contextElement ? contextElement : _getElementFromContext( contextKey );

    let productContext = _getProductContextFromContext( contextKey );

    return {
        element: element,
        productContextInfo: productContext,
        visibleUids: visibleUids,
        depth: depth
    };
};

/**
  * Get list of applicable match types based on selected display options
  *
  * @param {Object} displayOptions - Display Option object with Display option key and its ViewModelObject
  * @returns {Array} Array of applicable match types
  */
const _getMatchTypes = function( displayOptions ) {
    let matchTypes = [];
    for( let key in displayOptions ) {
        let vmo = displayOptions[ key ];
        if( vmo && vmo.dbValue ) {
            //TODO [Vikrant] - Restructure code
            if( DISPLAY_OPTIONS_ALIGNED === key ) {
                matchTypes.push( MATCH_TYPE_MULTIPLE_FULL_MATCH );
                matchTypes.push( MATCH_TYPE_FULL_MATCH );
            } else if( DISPLAY_OPTIONS_NOTALIGNED === key ) {
                matchTypes.push( MATCH_TYPE_MISSING_SOURCE );
                matchTypes.push( MATCH_TYPE_MISSING_TARGET );
            }
        }
    }
    return matchTypes;
};

/**
  * Get default alignment check configuration. If panelData is provided then default alignment
  * check configuration for Alignment Check Setting panel will returns, else default alignment
  * check configuration for Launch will be return.
  *
  * @param {Object} panelData - Alignment Check Setting panel view model
  * @returns {Object} Default alignment check configuration
  */
const _getDefaultAlignmentCheckConfiguration = function( panelData ) {
    return {
        displayLevel: CURRENT_LEVEL,
        backgroundOption: false,
        compareOptions: {
            Equivalence: [ ACC_ALIGNMENT_CHECK_CRITERIA ],
            CBA: [ 'true' ],
            MatchType: [ MATCH_TYPE_MULTIPLE_FULL_MATCH, MATCH_TYPE_FULL_MATCH, MATCH_TYPE_MISSING_SOURCE, MATCH_TYPE_MISSING_TARGET ]
        }
    };
};

/**
  * Get compare options for alignment check input
  *
  * @param {Object} alignmentCheckInfo The alignment check info object
  * @returns {Object} Compare Options object
  */
const _getCompareOptions = function( alignmentCheckInfo ) {
    let panelData = alignmentCheckInfo.panelData;
    let matchTypes;
    let defaultAlignmentCheckConfig = _getDefaultAlignmentCheckConfiguration( panelData );
    let compareOptions = defaultAlignmentCheckConfig.compareOptions;

    if( !alignmentCheckInfo.cbaPageLaunch &&
         appCtxSvc.ctx.cbaContext && appCtxSvc.ctx.cbaContext.alignmentCheckContext &&
         appCtxSvc.ctx.cbaContext.alignmentCheckContext.alignmentCheckSettingInfo ) {
        let displayOptions = appCtxSvc.ctx.cbaContext.alignmentCheckContext.alignmentCheckSettingInfo.displayOptions;
        matchTypes = _getMatchTypes( displayOptions );
    } else {
        matchTypes = defaultAlignmentCheckConfig.compareOptions.MatchType;
    }

    compareOptions.MatchType = matchTypes;
    return compareOptions;
};

/**
  * API to create alignment check input
  *
  * @param {Object} alignmentCheckInfo - Alignment Check Info object which contains source and target info.
  * @returns {Object} Alignment check input object
  */
const _createAlignmentCheckInput = function( alignmentCheckInfo ) {
    let sourceCompareInfo = _getCompareInfo( CBA_SRC_CONTEXT, alignmentCheckInfo );
    let targetCompareInfo = _getCompareInfo( CBA_TRG_CONTEXT, alignmentCheckInfo );

    let sourceCursor = _getCBADefaultCursor();
    let targetCursor = _getCBADefaultCursor();

    let soaCompareOptionsList = _getCompareOptions( alignmentCheckInfo );

    let notificationMessage = {};
    if( alignmentCheckInfo.dataSetUID ) {
        notificationMessage = {
            uid: alignmentCheckInfo.dataSetUID
        };
    }

    return {
        inputData: {
            source: sourceCompareInfo,
            target: targetCompareInfo,
            startFreshCompare: alignmentCheckInfo.startFreshAlignmentCheck,
            sourceCursor: sourceCursor,
            targetCursor: targetCursor,
            compareInBackground: alignmentCheckInfo.runInBackground,
            compareOptions: soaCompareOptionsList,
            notificationMessage: notificationMessage
        }
    };
};

/**
  * Process errors from response
  *
  * @param {Object} response - Server response
  * @returns {Object} null if response has error else response
  */
const processErrorsAndWarnings = function( response ) {
    let message = '';
    let level = 0;
    let error = response.ServiceData;
    if( error?.partialErrors ) {
        _.forEach( error.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                    level = errVal.level;
                } );
            }
        } );
        if( level <= 1 ) {
            messagingService.showInfo( message );
            return response;
        }
        exports.clearAlignmentCheckStatus();
        messagingService.showError( message );
        return null;
    }
};

/**
  *API to invoke compare content SOA
  *
  * @param {Object} compareInput - Compare input object
  * @returns {Object} The response object
  */
const _invokeSoa = function( compareInput ) {
    return soaService
        .postUnchecked( 'Internal-ActiveWorkspaceBom-2018-12-Compare', 'compareContent2', compareInput ).then(
            function( response ) {
                if( response?.ServiceData?.partialErrors ) {
                    return processErrorsAndWarnings( response );
                }
                return response;
            } );
};

const _getUnAlignedObjectUIDs = function( sourceDifference, targetDifference ) {
    let unalignedUids = [];
    let differences = { ...sourceDifference, ...targetDifference };
    for( const uid in differences ) {
        const differenceObj = differences[ uid ];
        if( differenceObj && ( differenceObj.status === 1 || differenceObj.status === 3 || differenceObj.status === 2000 || differenceObj.status === 3037 ) ) {
            unalignedUids.push( uid );
        }
    }
    return unalignedUids;
};

/**
  * Update collapsed objects differences
  * @param {object} fromDifference difference from which mapping uid to process
  * @param {object} toDifference difference to which maaping uids to add
  * @returns {object} Updated toDifference object
  */
const _updateCollapsedObjectsDiff = function( fromDifference, toDifference ) {
    for ( let key in fromDifference ) {
        let diffObj = fromDifference[ key ];

        if ( diffObj?.mappingUids?.length > 0 ) {
            for ( let index = 0; index < diffObj.mappingUids.length; index++ ) {
                const mappingUid = diffObj.mappingUids[ index ];
                if ( !toDifference[ mappingUid ] ) {
                    let newDiffObj = _createDifferenceObject( mappingUid + '##' + key, diffObj.status );
                    toDifference[ mappingUid ] = newDiffObj.diff;
                }
            }
        }
    }
    return toDifference;
};

/**
  * Perform Alignment Check
  *
  * @param {Object} alignmentCheckInput - Alignment check input
  * @param {boolean} isOverwriteResponse - true to merge response else false
  * @returns {Object} The response object
  */
const _performAlignmentCheck = function( alignmentCheckInput, isOverwriteResponse ) {
    return _invokeSoa( alignmentCheckInput ).then(
        function( response ) {
            if( response ) {
                // If alignment check status toggle is ON and user performs the Alignment check in background mode
                // then system should not process the response of compareContent2 so that indicator will not be cleared
                if( alignmentCheckInput.inputData.compareInBackground ) {
                    _showBackgroundMessage();
                    return;
                }
                let sourceDifference = _processDifferences( response.sourceDifferences, response.pagedSourceDifferences );
                let targetDifference = _processDifferences( response.targetDifferences, response.pagedTargetDifferences );
                targetDifference = _updateCollapsedObjectsDiff( sourceDifference, targetDifference );
                sourceDifference = _updateCollapsedObjectsDiff( targetDifference, sourceDifference );

                // Save Different in context
                let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
                if( isOverwriteResponse ) {
                    alignmentCheckInfo = null;
                }
                if( !alignmentCheckInfo ) {
                    alignmentCheckInfo = {};

                    alignmentCheckInfo[ CBA_SRC_CONTEXT ] = alignmentCheckInput.inputData.source;
                    alignmentCheckInfo[ CBA_TRG_CONTEXT ] = alignmentCheckInput.inputData.target;

                    alignmentCheckInfo[ CBA_SRC_CONTEXT ].differences = sourceDifference;
                    alignmentCheckInfo[ CBA_TRG_CONTEXT ].differences = targetDifference;
                } else {
                    if( !alignmentCheckInfo[ CBA_SRC_CONTEXT ] ) {
                        alignmentCheckInfo[ CBA_SRC_CONTEXT ] = alignmentCheckInput.inputData.source;
                    }
                    alignmentCheckInfo[ CBA_SRC_CONTEXT ].differences = _.merge( alignmentCheckInfo[ CBA_SRC_CONTEXT ].differences, sourceDifference );

                    if( !alignmentCheckInfo[ CBA_TRG_CONTEXT ] ) {
                        alignmentCheckInfo[ CBA_TRG_CONTEXT ] = alignmentCheckInput.inputData.target;
                    }
                    alignmentCheckInfo[ CBA_TRG_CONTEXT ].differences = _.merge( alignmentCheckInfo[ CBA_TRG_CONTEXT ].differences, targetDifference );
                }

                alignmentCheckInfo.startFreshCompare = alignmentCheckInput.inputData.startFreshCompare;
                alignmentCheckInfo.unalignedUIDs = _getUnAlignedObjectUIDs( alignmentCheckInfo[ CBA_SRC_CONTEXT ].differences, alignmentCheckInfo[ CBA_TRG_CONTEXT ].differences );

                appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, alignmentCheckInfo );
                appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.flags.alignmentCheckClicked', false );

                let updatedResultObject = {
                    sourceIdsToUpdate: Object.keys( sourceDifference ),
                    targetIdsToUpdate: Object.keys( targetDifference )
                };
                eventBus.publish( 'cba.alignmentCheckComplete', updatedResultObject );
            }
        } );
};

/**
  *Update compare status
  @param {String} contextKey - Context name for source or target
  @param {Array} uids array of uids
  @param {Object} supportedStatuses supportedStatuses
  */
export const updateAlignmentCheckStatus = function( contextKey, uids, supportedStatuses ) {
    let updateAlignmentCheckStatus = {};
    if( uids ) {
        let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
        let contextAlignmentCheckInfo = alignmentCheckInfo[ contextKey ];
        if( contextAlignmentCheckInfo ) {
            // Fix for defect defect LCS-968448
            // Add top node uid to refresh always
            if( contextAlignmentCheckInfo.element?.uid && !uids.includes( contextAlignmentCheckInfo.element?.uid ) ) {
                uids.push( contextAlignmentCheckInfo.element.uid );
            }
            _.forEach( uids, function( uid ) {
                let diff = contextAlignmentCheckInfo.differences ? contextAlignmentCheckInfo.differences[ uid ] : null;
                _.forEach( supportedStatuses, function( supportedStatus ) {
                    if( !diff || _.indexOf( supportedStatus.statuses, diff.status ) > -1 ) {
                        if( !updateAlignmentCheckStatus[ uid ] ) {
                            updateAlignmentCheckStatus[ uid ] = [ supportedStatus.columnName ];
                        } else if( !updateAlignmentCheckStatus[ uid ][ supportedStatus.columnName ] ) {
                            updateAlignmentCheckStatus[ uid ].push( supportedStatus.columnName );
                        }
                    }
                } );
            } );
        }
    }
    eventBus.publish( 'viewModelObject.propsUpdated', updateAlignmentCheckStatus );
};

/**
  *Get default cursor for CBA
  *
  * @returns {Object} The default cursor object
  */
const _getCBADefaultCursor = function() {
    return {
        startReached: true,
        endReached: false,
        startIndex: 0,
        endIndex: 0,
        pageSize: 0,
        isForward: true
    };
};

/**
  * Unregister Events
  */
const _unRegisterEvents = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        if( subDef ) {
            eventBus.unsubscribe( subDef );
        }
    } );
    _eventSubDefs.length = 0;
};

/**
  * Check if passed value if valid value for difference
  *
  * @param {number} value - Value to check
  * @returns {boolean} - true if valid value else return false
  */
const _isValidValueOfDifference = function( value ) {
    return DIFFERENCES_VALID_VALUES.includes( value );
};

/**
  * Create difference object
  *
  * @param {String} key - Uid from response
  * @param {Integer} value - number representing the difference
  * @returns {Object} The difference object
  */
const _createDifferenceObject = function( key, value ) {
    let diff = {};
    let uid;
    diff.status = value;
    if( _isValidValueOfDifference( value ) ) {
        let uids = key.split( '##' );
        uid = uids.splice( 0, 1 );
        diff.mappingUids = uids;
    } else {
        uid = key;
    }
    return {
        uid: uid,
        diff: diff
    };
};

/**
  * Process the differences of given parameter
  * @param {Object} originalDifferences differences
  * @param {Object} pagedDifferences page differences
  *
  * @return {Object} differences
  */
const _processDifferences = function( originalDifferences, pagedDifferences ) {
    let diffs = {};
    if( originalDifferences ) {
        for( let key in originalDifferences ) {
            let obj = _createDifferenceObject( key, originalDifferences[ key ] );
            diffs[ obj.uid ] = obj.diff;
        }
    }

    if( pagedDifferences ) {
        _.forEach( pagedDifferences, function( pagedDifference ) {
            let obj = _createDifferenceObject( pagedDifference.uids, pagedDifference.diff );
            diffs[ obj.uid ] = obj.diff;
        } );
    }
    return diffs;
};

/**
  * Get Depth and background option for Alignment Check
  *
  * @returns {Object} The depth and background option object
  */
const _getDepthAndBackgroundOption = function( ) {
    let dataObject = {};

    let defaultAlignmentCheckConfig = _getDefaultAlignmentCheckConfiguration();

    dataObject.depth = defaultAlignmentCheckConfig.displayLevel;
    dataObject.backgroundOption = defaultAlignmentCheckConfig.backgroundOption;

    if( dataObject.depth === CURRENT_LEVEL ) {
        dataObject.backgroundOption = false;
    }
    return dataObject;
};

/**
 * Method to track if Revise action performed
 * @param { Object } eventData Event Data
 */
const _handleRevise = function( eventData ) {
    if( eventData?.scope ) {
        // LCS-1173514 - Fix client Coverity issues
        let subPanelContext = eventData.scope.subPanelContext;
        if( subPanelContext ) {
            //If Revise started, make a note at ctx
            let selectedObjUid = _.get( subPanelContext, 'reviseSaveAsInfo.SelectedObjects[0].uid' );
            let rootObjectDbValues = _.get( subPanelContext, 'occContext.rootElement.props.awb0UnderlyingObject.dbValues', [] );
            let rootObjectUid = rootObjectDbValues.length > 0 ? rootObjectDbValues[0] : [];

            // TODO: Will refactor the code to check if we need to process the remaining code when selectedObjUid is undefined or rootObjectUid is []
            let isTopNodeRevised = selectedObjUid === rootObjectUid;

            let revisedObjectInfo = {
                revisedObjectUid : eventData.newObjectUid,
                isTopNodeRevised : isTopNodeRevised
            };
            appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_REVISED_OBJECT_INFO, revisedObjectInfo );
            if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode() && eventData.scope.data?.openNewRevision?.dbValue === true ) {
                let value = subPanelContext.cbaContext?.value;
                if( value ) {
                    let newCbaContext = { ...value };
                    // TODO Read all actions from a constants
                    newCbaContext.lastAction = 'REVISE';
                    eventData.scope.subPanelContext.cbaContext.update( newCbaContext );
                }
            } else{
                clearAlignmentCheckStatus();
            }
        }
    }
};

/**
 * Method to handle event fired after vmc modified
 * @param { Object } eventData Event Data
 */
const _handleVMCModified = function( eventData ) {
    if ( eventData?.modifiedObjects?.length > 0 ) {
        let modifiedObject = eventData.modifiedObjects[0];
        if( modifiedObject ) {
            let revisedObjectInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_REVISED_OBJECT_INFO );
            if( revisedObjectInfo && !revisedObjectInfo.isTopNodeRevised && revisedObjectInfo.revisedObjectUid === modifiedObject.uid ) {
                if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode() ) {
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_REVISED_OBJECT_INFO, undefined );
                    let datasetUid = appCtxSvc.getCtx( cbaConstants.CTX_PATH_STATE_PARAMS_DATASETUID );
                    if( datasetUid ) {
                        CadBomOccAlignmentCheckUtil.clearDatasetUid();
                    }
                    exports.executeAlignmentCheck();
                }
                let eventDataParams = {
                    refreshLocationFlag: true,
                    relations: '',
                    relatedModified:[ modifiedObject ]
                };
                eventBus.publish( 'cdm.relatedModified', eventDataParams );
            }
        }
    }
};

const _subscribeEvents = function() {
    _eventSubDefs.push( eventBus.subscribe( 'entCBA.visibilityStateChanged', _visibilityChangeListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', _addElementListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'cba.clearAlignmentCheckIndicators', _clearAlignmentCheckStatus ) );
    _eventSubDefs.push( eventBus.subscribe( 'ace.elementsRemoved', _updateRemovedLines ) );
    _eventSubDefs.push( eventBus.subscribe( 'Awp0ShowSaveAs.saveAsComplete', _handleRevise ) );
    _eventSubDefs.push( eventBus.subscribe( 'pma1.reusedOccurrenceAdded', _addElementListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'vmc.modified.srcOccDataProvider', _handleVMCModified ) );
    _eventSubDefs.push( eventBus.subscribe( 'insertLevel.elementsInserted', _insertElementListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'ace.ResetContentEvent', _resetStructureListener ) );
};

/**
  *Initialize Service
  *
  */
export const initializeService = function() {
    _unRegisterEvents();
    _subscribeEvents();
};

/**
  * Un-register service when CBA page is closed
  *
  */
export const unRegisterService = function() {
    _sourceVMOs = [];
    _targetVMOs = [];
    _unRegisterEvents();
};

/**
  * Get status of given uid of context
  * @param {String} contextKey view key that represent the view
  * @param {object} vmo view model object
  * @return {number} status
  */
export const getStatus = function( contextKey, vmo ) {
    let status;

    let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
    if( alignmentCheckInfo ) {
        let contextAlignmentCheckInfo = alignmentCheckInfo[ contextKey ];
        if( contextAlignmentCheckInfo?.differences ) {
            let diff = contextAlignmentCheckInfo.differences[ vmo.uid ];
            status = diff ? diff.status : null;
        }
    }
    if( !status ) {
        status = cbaFindAlignedService.getIndicatorStatus( contextKey, vmo );
    }
    return status;
};

/**
 * Get top viem model object from taskbar context
 *
 * @param {object} taskBarContext Taskbar context object
 * @param {string} viewKey context key
 * @returns {object} Top view model object
 */
const _getTopViewModelObjectFromTaskbarContext = function( taskBarContext, viewKey ) {
    return _getTopViewModelObjectFromOccContext( taskBarContext[ viewKey ] );
};

/**
 * Get top viem model object from occContext
 *
 * @param {object} occContext occContext
 * @returns  {object} Top view model object
 */
const _getTopViewModelObjectFromOccContext = function( occContext ) {
    let topElementElement = occContext.topElement;
    let vmc = occContext.vmc;
    return vmc.getViewModelObject( vmc.findViewModelObjectById( topElementElement.uid ) );
};

/**
  * Execute alignment check from panel
  *
  * @param {Boolean} isRunInBackground - Whether alignment check is run in background mode
  * @param {Boolean} isScroll - Whether scroll action made
  * @param {Object} taskBarInfo - Taskbar info object
  */
export const executeAlignmentCheck = function( isRunInBackground, isScroll, taskBarInfo ) {
    let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
    let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

    let srcCtxElement;
    let trgCtxElement;

    let isAddAllVisibleUids = true;
    if( isScroll ) {
        let srcCompareInfo = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_SRC_CONTEXT );
        let trgCompareInfo = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_TRG_CONTEXT );
        if( srcCompareInfo && trgCompareInfo ) {
            srcCtxElement = srcCompareInfo.element;
            trgCtxElement = trgCompareInfo.element;
        }
        isAddAllVisibleUids = false;
    }


    const depthBackgroundInfo = _getDepthAndBackgroundOption();
    let backgroundOption = isRunInBackground === undefined ? depthBackgroundInfo.backgroundOption : isRunInBackground;
    let starFreshCheck = true;
    const dataSetUID = !isRunInBackground ? appCtxSvc.getCtx( 'state.params.datasetUid' ) : null;
    if( dataSetUID ) {
        // If runInBackground is false and we got dataSetUid from context that means excuteAlignmentCheck is called from background report
        // now compareContent2 will be called with dataSetUid, runInBackground as false, startFreshCompare as false, depth as -1
        depthBackgroundInfo.depth = REUSE_SAVED_RESULTS;
        starFreshCheck = false;
    }

    let alignmentCheckInfo = _getAlignmentCheckInfoObject( depthBackgroundInfo.depth, depthBackgroundInfo.depth, sourceVMOs, targetVMOs,
        starFreshCheck, backgroundOption, dataSetUID, null, srcCtxElement, trgCtxElement );
    alignmentCheckInfo.isAddAllVisibleUids = isAddAllVisibleUids;
    if ( taskBarInfo ) {
        alignmentCheckInfo.srcTopElement =  _getTopViewModelObjectFromTaskbarContext( taskBarInfo, CBA_SRC_CONTEXT );
        alignmentCheckInfo.trgTopElement =  _getTopViewModelObjectFromTaskbarContext( taskBarInfo, CBA_TRG_CONTEXT );
    }


    // If only parent node is in visible list and it is collapsed then we need to push its chidren also.
    // When user perform expand below on top collapsed node then expandBelow event is not fired as nodes are cached
    CadBomOccAlignmentCheckUtil.populateCachedChildrenToAlignmentCheckInfo( alignmentCheckInfo.sourceInfo, alignmentCheckInfo.srcTopElement );
    CadBomOccAlignmentCheckUtil.populateCachedChildrenToAlignmentCheckInfo( alignmentCheckInfo.targetInfo, alignmentCheckInfo.trgTopElement );

    alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT );
    alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT );
    _executeAlignmentCheck( alignmentCheckInfo );
};

/**
  * Publish Background processing message
  */
const _showBackgroundMessage = function() {
    let resource = 'CadBomAlignmentMessages';
    let localeTextBundle = localeService.getLoadedText( resource );
    let infoMessage = localeTextBundle.BackgroundAlignmentCheckNotification;

    messagingService.showInfo( infoMessage );
};
/**
  * Open notification after background processing
  *
  * @param {Object} notificationObject - Notification Object data
  */
export const openCBANotification = function( notificationObject ) {
    if( notificationObject && notificationObject.object ) {
        let dataSetUID = notificationObject.object.uid;
        dataManagementService.getProperties( [ dataSetUID ], [ 'fnd0MessageBody' ] ).then(
            function( response ) {
                let dataSetObject = response && response.modelObjects ? response.modelObjects[ dataSetUID ] : null;
                if( dataSetObject ) {
                    appCtxSvc.updatePartialCtx( CTX_PATH_DATASETUID, dataSetUID );

                    // If we are already in CBA page and we are trying to navigate to CBA page again from alert notification..
                    // Then we need to gaurd CBA context variables being cleaned up from context.
                    // The execution flow is as follows:
                    // 1. The navigation request routes to CBA page and hence loadCBAData API gets invokes
                    // 2. This API populates CBA context variables as per the new navigation request for new src and trg uids.
                    // 3. Then the framework unloads old CBA page becuase the new navigation request will inject new CBA page
                    // 4. At this point, becuase of old CBA page unloads; the CBA context variables set for new request in step 2 are cleared
                    // 5. so just set an indication for the execution flow that we are trying to navigate to same page and hence doNotClearCBAContextVars
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS, true );
                    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo', {} );
                    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.flags.alignmentCheckON', true );

                    let toParams = CadBomAlignmentUtil.getURLParametersFromDataset( dataSetObject );
                    toParams.datasetUid = dataSetUID;
                    if( !appCtxSvc.getCtx( 'ctx.cbaContext.ImpactAnalysis' ) ) {
                        toParams.acStatus = true;
                        toParams.adaptObj_uid = null;
                        toParams.ecn_uid = null;
                        toParams.isIA_mode = false;
                    }
                    let transitionTo = 'CADBOMAlignment';
                    let options = {};
                    options.reload = true;
                    locationNavigationService.instance.go( transitionTo, toParams, options );
                }
            }
        );
    }
};

/**
 * Clear find Alignment Indicators
 *
 * @param {List} updatedUids uids of the object participated in align/unalign operation
 */
const _clearFindAlignedStatus = function( updatedUids ) {
    let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );
    if( findAlignedInfo && updatedUids ) {
        let srcContextObj = findAlignedInfo[ CBA_SRC_CONTEXT ];
        let trgContextObj = findAlignedInfo[ CBA_TRG_CONTEXT ];

        let srcDiff = {};
        let trgDiff = {};

        for( const updatedUid of updatedUids ) {
            if( srcContextObj && srcContextObj.hasOwnProperty( updatedUid ) ) {
                srcDiff[updatedUid] = srcContextObj[updatedUid];
            } else if( trgContextObj && trgContextObj.hasOwnProperty( updatedUid ) ) {
                trgDiff[updatedUid] = trgContextObj[updatedUid];
            }
        }

        srcContextObj = srcDiff;
        trgContextObj = trgDiff;

        findAlignedInfo[ CBA_SRC_CONTEXT ] = srcContextObj;
        findAlignedInfo[ CBA_TRG_CONTEXT ] = trgContextObj;

        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedInfo );
    } else{
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
    }
};


/**
 * Clear Alignment Indicators
 *
 * @param {List} updatedUids uids of the object participated in align/unalign operation
 */
const _clearAlignmentCheckStatus = function( updatedUids ) {
    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.flags.alignmentCheckClicked', false );
    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.flags.alignmentCheckON', false );
    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo', {} );
    let datasetUid = appCtxSvc.getCtx( cbaConstants.CTX_PATH_STATE_PARAMS_DATASETUID );
    if( datasetUid ) {
        CadBomOccAlignmentCheckUtil.clearDatasetUid();
    }
    _clearFindAlignedStatus( updatedUids );
    CadBomAlignmentUtil.updateURLParams( { acStatus: false, datasetUid: null } );
    eventBus.publish( 'cba.refreshTree' );
};

/**
  * Clear Alignment Indicators
  * @param {String} dataProviderActionType - dataProviderActionType for event data of productContextChangedEvent
  * @param {List} updatedUids Uids of objects participated in align or unalign operation
  */
export const clearAlignmentCheckStatus = function( dataProviderActionType, updatedUids ) {
    if( _.isUndefined( dataProviderActionType ) || dataProviderActionType === 'initializeAction' ) {
        _clearAlignmentCheckStatus( updatedUids );
    }
};

/**
  * Re-Execute alignment check after alignment or unalignment
  *
  * @param {Object} updatedIds - List of updated uids
  * @param {boolean} isStructureUpdated true if structure is updated with Created or Deleted lines else false
  */
export const reExecuteAlignmentCheck = function( updatedIds, isStructureUpdated ) {
    let srcContextObj = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_SRC_CONTEXT );
    let trgContextObj = CadBomOccAlignmentCheckUtil.getExecutedAlignmentCheckInfo( CBA_TRG_CONTEXT );

    // If NO alignment check is perfomed then no need to re-execute alignment check
    if( !srcContextObj || !trgContextObj ) {
        return;
    }

    // Check if updated element is same as alignment check context
    let isExecuteAlignmentCheck = _isTopAlignment( updatedIds );
    if( !isStructureUpdated && !isExecuteAlignmentCheck && ( updatedIds.includes( srcContextObj.element.uid ) || updatedIds.includes( trgContextObj.element.uid ) ) ) {
        // exports.clearAlignmentCheckStatus( undefined, updatedIds );
        // return;
    }

    // If Alignment Check is in Bagkground mode then dont execute Alignment Check in Aling and UnAlign operation
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode() ) {
        return;
    }

    if( !isExecuteAlignmentCheck ) {
        for( let index = 0; index < updatedIds.length; index++ ) {
            const element = updatedIds[ index ];

            // Check if alignment check is done for updated element.
            if( srcContextObj.differences.hasOwnProperty( element ) || trgContextObj.differences.hasOwnProperty( element ) ) {
                isExecuteAlignmentCheck = true;
                break;
            }
        }
    }

    //System should execute alignment check on updated structure
    if( isStructureUpdated ) {
        isExecuteAlignmentCheck = true;
    }

    if( isExecuteAlignmentCheck ) {
        let sourceDepth = srcContextObj.depth;
        let targetDepth = trgContextObj.depth;

        let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
        let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

        let alignmentCheckInfo = _getAlignmentCheckInfoObject( sourceDepth, targetDepth, sourceVMOs, targetVMOs,
            true, false, null, null, srcContextObj.element, trgContextObj.element );
        alignmentCheckInfo.isAddAllVisibleUids = true;

        alignmentCheckInfo.sourceInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_SRC_CONTEXT );
        alignmentCheckInfo.targetInfo.visibleUids = CadBomOccAlignmentCheckUtil.filterVisibleUidsHavingAlignmentStatus( alignmentCheckInfo, CBA_TRG_CONTEXT );

        _executeAlignmentCheck( alignmentCheckInfo );
    } else {
        exports.clearAlignmentCheckStatus( undefined, updatedIds );
    }
};

/**
  * check weather given uids are of top node alignment
  *
  * @param {Object} uids - List of uids
  *
  * @returns {Boolean} true if given uid are for top alignment
  */
export const _isTopAlignment = function( uids ) {
    let trgTop = appCtxSvc.getCtx( cbaConstants.CBA_TRG_CONTEXT );
    let srcTop = appCtxSvc.getCtx( cbaConstants.CBA_SRC_CONTEXT );
    let copiedUids = [ ...uids ];
    if( trgTop && trgTop.topElement && srcTop && srcTop.topElement &&
         ( copiedUids.includes( trgTop.topElement.uid ) || copiedUids.includes( srcTop.topElement.uid ) ) ) {
        copiedUids = copiedUids.filter( x => x !== trgTop.topElement.uid && x !== srcTop.topElement.uid );
        return _.isEmpty( copiedUids );
    }
    return false;
};

/**
  * Check if node is being expanded or not
  * @param {object} subPanelContext SubPanelContext either for Source or Target
  * @returns {boolean} - True if node is being expanded, false otherwise
  */
const _isExpansionCase = function( subPanelContext ) {
    let lastDpAction = subPanelContext.searchState.lastDpAction;
    return lastDpAction === 'loadAndSelect' || lastDpAction === 'nextAction' || lastDpAction === 'focusAction';
};

/**
  * Get property value for specified path from given object
  *
  * @param {string} contextName - Source or target context name from which get affected UID.
  * If no context passed then it will return from all availabel contexts.
  * @param {Array} secondarySelections - Secondary uids for which affected uid to fetch
  * @param {boolean} isTopAlignment - true if top node alignment else false
  * @returns {Array} - List of affacted uids
  */
export const getAffectedObjectUIDPostPartCADAlignmentUpdate = function( contextName, secondarySelections, isTopAlignment ) {
    let affectedUIDs = [];
    let primarySelection = appCtxSvc.getCtx( contextName + '.pwaSelection[0].uid' );

    if( isTopAlignment ) // secondarySelections will be empty
    {
        let viewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
        let diffArray = _.difference( viewKeys, [ contextName ] );
        let inActiveContextKey = diffArray[ 0 ];
        let secondarySelection = appCtxSvc.getCtx( inActiveContextKey + '.pwaSelection[0].uid' );
        affectedUIDs.push( secondarySelection );
    } else {
        _.forEach( secondarySelections, function( secondarySelection ) {
            let fnd0UnderlyingObjectUid = CadBomAlignmentUtil.getPropertyValueFromObject( secondarySelection, 'props.fnd0UnderlyingObject.dbValue' );
            affectedUIDs.push( fnd0UnderlyingObjectUid );
        } );
        affectedUIDs = CadBomOccurrenceAlignmentUtil.getLoadedVMO( affectedUIDs );
    }
    affectedUIDs.push( primarySelection );
    return affectedUIDs.reverse();
};

/**
  *  Check if alignment check is performed on node being expand or any of it's parent node.
  * @param {object} expandedParentNode Node being expand
  * @param {string} contextName Source or Target context from which node is expanding
  * @param {object} differences Alignemtn Check data for given context
  * @param {string} partDesignRequiredProp pma1IsDesignRequired or pma1IsPartRequired property based on context.
  * @returns {boolean} true if expanding node or its parent if alignment check is performed .
  */
const _isAlignmentCheckPerformed = function( expandedParentNode, contextName, differences, partDesignRequiredProp ) {
    let isResult = false;
    if( differences ) {
        const nodeProps = expandedParentNode.props;
        if( nodeProps && nodeProps[ partDesignRequiredProp ].dbValue ) {
            if( !differences.hasOwnProperty( expandedParentNode.uid ) ) {
                const parentNodeProp = _.get( expandedParentNode, 'props.awb0Parent' );
                const activeContext = appCtxSvc.ctx[ contextName ];
                const vmc = activeContext.vmc;
                const parentTreeNode = vmc.getViewModelObject( vmc.findViewModelObjectById( parentNodeProp.dbValues[ 0 ] ) );
                if( parentTreeNode ) {
                    isResult = _isAlignmentCheckPerformed( parentTreeNode, contextName, differences, partDesignRequiredProp );
                }
            } else {
                isResult = true;
            }
        }
    }
    return isResult;
};

/**
 * Refresh table when perform remove operation in CBA view
 * @param {eventData} eventData - event Data
 */
const _updateRemovedLines = function( eventData ) {
    if( eventData && eventData.operationName === 'removeElement' ||  eventData && eventData.operationName === 'removeLevel' ) {
        // Fix the issue: In alignment view, removed lines cannot display (with a red strikthrough) unless reset the view
        let isChangeEnabled = appCtxSvc.getCtx( 'cadbomalignment.redLineMode.isChangeEnabled' );
        let removedObjects = eventData.removedObjects;

        if( removedObjects?.length > 0 ) {
            let parentUid = occmgmtUtils.getParentUid( eventData.removedObjects[0] );
            if( isChangeEnabled ) {
                _reloadParent( parentUid, eventData );
            } else if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode() ) {
                // After remove line , we change background mode to foreground mode
                CadBomOccAlignmentCheckUtil.clearBackgroundAlignmentCheckData();
                exports.executeAlignmentCheck( false );
            }else{
                // If removed line has find aligned indicator then clear find aligned cache
                let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );
                if( findAlignedInfo && !_.isEmpty( findAlignedInfo ) && findAlignedInfo[eventData.viewToReact]
            && !_.isEmpty( findAlignedInfo[eventData.viewToReact] ) ) {
                    let diff = findAlignedInfo[eventData.viewToReact];
                    let isFound = _.find( removedObjects, function( removedObject ) {
                        return diff.hasOwnProperty( removedObject.uid );
                    } );

                    if( isFound ) {
                        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
                        eventBus.publish( 'cba.refreshTree' );
                    }
                }
            }
        }
    }
};

/**
  * Related the children based on input element uid.
  *
  * @param {String} parentUid - Parent element Uid that need to be reloaded
  * @param {String} eventData - event Data
  */
const _reloadParent = function( parentUid, eventData ) {
    if( !parentUid ) {
        return;
    }
    let contextKey = eventData.viewToReact;
    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.removedLines', contextKey );
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
        objectsToSelect: [ cdmSvc.getObject( parentUid ) ],
        viewToReact: contextKey,
        nodeToExpandAfterFocus: parentUid,
        getOccSoaInput: soaInput
    } );
};

/**
 * Execute Alignment Check when user clicks expansion commands
 * @param {object} data data
 * @param {object} subPanelContext sub panel context
 */
export const executeAlignmentCheckWithNodeExpansionCmd = function( data ) {
    if( data?.treeNodeState?.isExpanded && data?.subPanelContext?.cbaContext?.lastAction !== 'RESET' ) {
        exports.executeAlignmentCheckOnNodeExpansion( data.treeNodeState, data.subPanelContext.contextKey );
    }
};

/**
  * Populate the selected lines information in function _addElementListener().
  *
  * @param {eventData} eventData - event Data
  * @returns {Object} An object containing selectedTargetLines, targetView, sourceView, and selectedSourceLines.
  */
const _populateSelectedLinesInfoInAddElementListener = function( eventData ) {
    let selectedTargetLines = eventData.objectsToSelect;
    let targetView = eventData.viewToReact;
    let sourceView = cbaConstants.CBA_SRC_CONTEXT === targetView ? cbaConstants.CBA_TRG_CONTEXT : cbaConstants.CBA_SRC_CONTEXT;
    let selectedSourceLines = [];
    let updatedUids = eventData.addElementResponse.ServiceData ? eventData.addElementResponse.ServiceData.updated : eventData.addElementResponse.updated;
    let isReusedOccurrenceCondition = eventData.isReusingOccurrence;
    let targetViewIsCBASource = targetView === cbaConstants.CBA_SRC_CONTEXT;
    let targetViewIsCBATarget = targetView === cbaConstants.CBA_TRG_CONTEXT;
    let modelObjects = eventData.addElementResponse.ServiceData ? eventData.addElementResponse.ServiceData.modelObjects : eventData.addElementResponse.modelObjects;

    for( const updatedUid of updatedUids ) {
        if( sourceView === cbaConstants.CBA_SRC_CONTEXT && _.includes( updatedUid, 'SR::N::Awb0DesignElement' ) ||
            sourceView === cbaConstants.CBA_TRG_CONTEXT && _.includes( updatedUid, 'SR::N::Awb0PartElement' ) ||
            CadBomOccAlignmentCheckUtil.isMultiDomainExistsInGivenObjects( updatedUid, modelObjects ) ) {
            selectedSourceLines.push( updatedUid );
        }
        // If usecase is DragAndDrop and reuse the occurrence
        if ( isReusedOccurrenceCondition ) {
            if( targetViewIsCBASource && _.includes( updatedUid, 'SR::N::Awb0DesignElement' ) ||
            targetViewIsCBATarget && _.includes( updatedUid, 'SR::N::Awb0PartElement' ) ) {
                let modelObjectOfUpdatedUid = cdmSvc.getObject( updatedUid );
                selectedTargetLines.push( modelObjectOfUpdatedUid );
            }
        }
    }

    return {
        selectedTargetLines,
        targetView,
        sourceView,
        selectedSourceLines
    };
};

/**
 * Handle handleLoadAndSelect event after remove operation
 * @param {object} srcOccContext Source context object
 * @param {object} trgOccContext Target context object
 */
export const handleLoadAndSelect = function( srcOccContext, trgOccContext ) {
    let contextKey = appCtxSvc.getCtx( 'cbaContext.alignmentCheckContext.removedLines' );

    if( srcOccContext && contextKey === srcOccContext.viewKey && srcOccContext.lastDpAction === 'loadAndSelect'
    || trgOccContext && contextKey === trgOccContext.viewKey && trgOccContext.lastDpAction === 'loadAndSelect'  ) {
        appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.removedLines', undefined );
        CadBomOccAlignmentCheckUtil.clearBackgroundAlignmentCheckData();
        exports.executeAlignmentCheck( false );
        CadBomOccAlignmentCheckUtil.clearDatasetUid();
    }
};

/**
 * Get tree node expansion state
 * @param {object} treeNode Tree Node
 * @returns {object} object which has tree node and its state as boolean
 */
export const getTreeNodeState = function( treeNode ) {
    const isAlignmentStatusModeON = CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();
    if( isAlignmentStatusModeON ) {
        return treeNode;
    }
    return {};
};

/**
  * CAD-BOM Occurrence Alignment Check service
  */
export default exports = {
    CBA_SRC_CONTEXT,
    CBA_TRG_CONTEXT,
    executeAlignmentCheckOnNodeExpansion,
    updateAlignmentCheckStatus,
    initializeService,
    unRegisterService,
    getStatus,
    executeAlignmentCheck,
    openCBANotification,
    clearAlignmentCheckStatus,
    reExecuteAlignmentCheck,
    getAffectedObjectUIDPostPartCADAlignmentUpdate,
    executeAlignmentCheckWithNodeExpansionCmd,
    handleLoadAndSelect,
    getTreeNodeState
};

