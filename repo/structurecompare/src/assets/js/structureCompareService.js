// Copyright (c) 2022 Siemens

/**
 * @module js/structureCompareService
 */
import AwStateService from 'js/awStateService';
import awStructureCompareSvc from 'js/awStructureCompareService';
import compareGetSvc from 'js/awStructureCompareGetService';
import awStructureCompareUtils from 'js/awStructureCompareUtils';
import awStructureCompareColorService from 'js/awStructureCompareColorService';
import LocationNavigationService from 'js/locationNavigation.service';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};
let _crossSelectionSyncFlag = false;
let srcKeysStorage = [];
let getLoadedSourceVMOs = null;
let getLoadedSourceVMOsAfterPackUnpack = null;
let autoOpenComparePanel = false;
let sourceVMOMap = {};
let targetVMOMap = {};

const PARTITION_ELEMENT = 'Fgf0PartitionElement';
function getActiveViewLocation() {
    let srcLocation = 1;
    if( appCtxSvc.getCtx( 'aceActiveContext.key' ) === 'occmgmtContext2' ) {
        srcLocation = 2;
    }
    return srcLocation;
}

export let setAutoOpenComparePanelValue = ( value ) => {
    autoOpenComparePanel = value;
};

export let getAutoOpenComparePanelValue = () => {
    return autoOpenComparePanel;
};

let checkIfCompareSkipIsRequired = ( vmos, vmoMap ) => {
    for( let inx in vmos ) {
        if( vmoMap[vmos[inx].uid] !== 1 ) {
            return false;
        }
    }
    return true;
};

export let clearVMOCacheMap = () => {
    sourceVMOMap = {};
    targetVMOMap = {};
};

export let performAutoCompare = ( compareContext, occContext, occContext2 ) => {
    if( occContext.vmc && occContext2.vmc ) {
        let newCompareContext = { ...compareContext.value };
        exports.initializeCompareData( newCompareContext );
        let _sourceVMOs = occContext.vmc.getLoadedViewModelObjects();
        let _targetVMOs = occContext2.vmc.getLoadedViewModelObjects();

        if( appCtxSvc.getCtx( 'compareContext.isMultiStructureFirstLaunch' ) ) {
            autoOpenComparePanel = true;
            if( newCompareContext.compareList ) {
                newCompareContext.compareList.sourceSelection = occContext.topElement.uid;
                newCompareContext.compareList.targetSelection = occContext2.topElement.uid;
            }
            //Make sure that both the source and target VMOs are loaded before making server call.
            if( _sourceVMOs.length > 0 && ( _sourceVMOs[0].props !== undefined && Object.keys( _sourceVMOs[0].props ).length > 0 )
                && _targetVMOs.length > 0 && ( _targetVMOs[0].props !== undefined && Object.keys( _targetVMOs[0].props ).length > 0 ) ) {
                for( let inx in _sourceVMOs ) {
                    sourceVMOMap[_sourceVMOs[inx].uid] = 1;
                }
                for( let inx in _targetVMOs ) {
                    targetVMOMap[_targetVMOs[inx].uid] = 1;
                }
                appCtxSvc.updatePartialCtx( 'compareContext.isMultiStructureFirstLaunch', false );
                return exports.executeCompare( newCompareContext, _sourceVMOs, _targetVMOs, compareContext );
            }
        } else if( compareContext.isInMultiLevelCompare === true ) {
            let skipCompare = checkIfCompareSkipIsRequired( _sourceVMOs, sourceVMOMap ) && checkIfCompareSkipIsRequired( _targetVMOs, targetVMOMap );
            if( !skipCompare ) {
                // update sourceVMOMap and targetVMOMap with new values
                for( let inx in _sourceVMOs ) {
                    sourceVMOMap[_sourceVMOs[inx].uid] = 1;
                }
                for( let inx in _targetVMOs ) {
                    targetVMOMap[_targetVMOs[inx].uid] = 1;
                }
                let compareInput = compareGetSvc.createSOAInputForVisibleUids( compareContext, compareContext.depth, false, false, false, _sourceVMOs, _targetVMOs );
                let deferred = AwPromiseService.instance.defer();
                awStructureCompareSvc.performCompare( newCompareContext, compareInput, false, false, compareContext, deferred ).then( () => {
                    syncSelection( occContext, occContext2, compareContext, getActiveViewLocation() );
                } );
            }
        } else if( srcKeysStorage.length > 0 ) {
            // Update color map on global context
            let isColorMapUpdated = awStructureCompareUtils.updatePropertyDiffMap( compareContext, srcKeysStorage );
            // Clear the keys if the processing is done
            if( isColorMapUpdated ) {
                srcKeysStorage = [];
            }
        }
    }
};

/**
 *
 * This function will store the loaded VMOs to update the property diff
 */
export let getLoadedSrcVMOsUid = ( eventData ) => {
    srcKeysStorage = [];
    if( eventData.treeLoadResult && eventData.treeLoadResult.childNodes ) {
        for( let srcKeyUid in eventData.treeLoadResult.childNodes ) {
            srcKeysStorage.push( eventData.treeLoadResult.childNodes[ srcKeyUid ].uid );
        }
    }

    if( eventData.parentChildrenInfos ) {
        for( let srcKeyUid1 in eventData.parentChildrenInfos ) {
            for( let srcKeyUid2 in eventData.parentChildrenInfos[ srcKeyUid1 ].childrenInfo ) {
                srcKeysStorage.push( eventData.parentChildrenInfos[ srcKeyUid1 ].childrenInfo[ srcKeyUid2 ].occurrenceId );
            }
        }
    }

    if( eventData.packMode === 0 ) {
        let viewDataToReset = appCtxSvc.getCtx( eventData.viewToReset );
        let newCurrentState = { ...viewDataToReset.currentState };
        if( !_.isEmpty( eventData.elementsToBeSelected ) && newCurrentState.c_uid !== eventData.elementsToBeSelected[ 0 ].occurrenceId ) {
            newCurrentState.c_uid = eventData.elementsToBeSelected[ 0 ].occurrenceId;
            occmgmtUtils.updateValueOnCtxOrState( 'currentState', newCurrentState, eventData.viewToReset );
        }
    }
};

/**
 * This helper function will do pre-requisite initialization and registrations for Compare.
 */
export let initializeCompareData = function( compareContext ) {
    appCtxSvc.updatePartialCtx( 'cellClass', {
        gridCellClass: awStructureCompareColorService.gridCellClass,
        pltablePropRender: awStructureCompareColorService.prophighlightRenderer
    } );
    awStructureCompareSvc.initializeCompareList( compareContext );
};

/**
 * Initializes compare context while launching Compare panel.
 *
 */
export let setUpCompareContext = function( compareContext ) {
    let newCompareContext = { ...compareContext.value };
    exports.initializeCompareData( newCompareContext );
    let leftStructureKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 0 ];
    let rightStructureKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 1 ];
    let leftStructureContext = appCtxSvc.getCtx( leftStructureKey );
    let rightStructureContext = appCtxSvc.getCtx( rightStructureKey );
    if( newCompareContext.compareList ) {
        newCompareContext.compareList.sourceSelection = leftStructureContext.topElement.uid;
        newCompareContext.compareList.targetSelection = rightStructureContext.topElement.uid;
        let selectedObj = cdm.getObject( leftStructureContext.pwaSelection[ 0 ].uid );
        if( !selectedObj ) {
            selectedObj = leftStructureContext.topElement;
        }
        newCompareContext.compareList.cmpSelection1 = selectedObj;
        selectedObj = cdm.getObject( rightStructureContext.pwaSelection[ 0 ].uid );
        if( !selectedObj ) {
            selectedObj = rightStructureContext.topElement;
        }
        newCompareContext.compareList.cmpSelection2 = selectedObj;
    }
    if( !compareContext.displayOptions ) {
        awStructureCompareUtils.setDefaultDisplayOptions( newCompareContext );
    }
    compareContext.update( newCompareContext );
    eventBus.publish( 'refreshCellRenderersForCompare' );
};

export let executeFromComparePanel = function( compareContext, usrSelectedDepth, backgroundOption, generateReport ) {
    if( backgroundOption ) {
        awStructureCompareSvc.showBackgroundMessage( compareContext.compareList );
    }
    clearVMOCacheMap();
    let contextKeys = awStructureCompareUtils.getContextKeys();

    let sourceVMOs = appCtxSvc.getCtx( contextKeys.leftCtxKey ).vmc.getLoadedViewModelObjects();
    let targetVMOs = appCtxSvc.getCtx( contextKeys.rightCtxKey ).vmc.getLoadedViewModelObjects();
    let defaultCursor = awStructureCompareUtils.getDefaultCursor();
    let compareInput = compareGetSvc.createSOAInputForPaginationAndVisibleUids( compareContext, usrSelectedDepth, true,
        backgroundOption, generateReport, defaultCursor, defaultCursor, sourceVMOs, targetVMOs, null );
    let newCompareContext = { ...compareContext.value };
    awStructureCompareSvc.resetCompareContext( newCompareContext );
    awStructureCompareSvc.resetCompareColorData( newCompareContext, true );
    updateCompareContextInput( compareContext.compareList, compareInput );
    awStructureCompareSvc.performCompare( newCompareContext, compareInput, true, false, compareContext );
};

export let resetCompareContext = ( compareContext ) => {
    if( compareContext.isInCompareMode ) {
        const newCompareContext = { ...compareContext };
        newCompareContext.isInMultiLevelCompare = false;
        unSubscribeForTreeNodesLoaded();
        unSubscribeToPackUnpackSuccessful();
        awStructureCompareSvc.resetCompareColorData( newCompareContext );
        if( newCompareContext.resetOnProductChange ) {
            newCompareContext.resetOnProductChange = false;
        }
        return newCompareContext;
    }
};

export let resetProductListener = ( savedSessionMode, compareContext ) => {
    if( savedSessionMode === 'reset' ) {
        // Close compare panel
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
        return resetCompareContext( compareContext );
    }
};

let updateCompareContextInput = ( compareContextList, compareInput ) => {
    if( compareInput ) {
        compareContextList.cmpSelection1 = compareInput.inputData.source.element;
        compareContextList.cmpSelection2 = compareInput.inputData.target.element;
    }
};

export let launchContentCompare = function() {
    let toParams = {};
    let _mselected = appCtxSvc.getCtx( 'mselected' );
    let selectedObj = _mselected[ 0 ];
    if( selectedObj.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }

    let sourceSelectedUid = selectedObj.uid;

    selectedObj = _mselected[ 1 ];
    if( selectedObj.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }

    let toUpdate = {
        compareContext: {
            autoOpenComparePanel: true,
            isMultiStructureFirstLaunch: true
        },
        resetTreeExpansionState: true,
        requestPref: {
            dataFilterMode: 'compare'
        },
        compareList: {
            sourceSelection: sourceSelectedUid,
            targetSelection: selectedObj.uid
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', toUpdate, '' );

    var compareList = appCtxSvc.getCtx( 'compareList' );
    toParams.uid = compareList.sourceSelection;
    toParams.uid2 = compareList.targetSelection;
    toParams.pci_uid = '';
    toParams.pci_uid2 = '';
    if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
        if( _.isUndefined( _mselected[ 0 ].props.awb0UnderlyingObject ) && _.isUndefined( _mselected[ 1 ].props.awb0UnderlyingObject ) ) {
            toParams.pci_uid = undefined;
            toParams.pci_uid2 = undefined;
        } else if( appCtxSvc.getCtx( 'aceActiveContext.context.elementToPCIMap' ) ) {
            /**
             * While launching Compare from within saved working context, we want to use saved
             * configuration.
             */
            toParams.pci_uid = occmgmtUtils.getProductContextForProvidedObject( _mselected[ 0 ] );
            toParams.pci_uid2 = occmgmtUtils.getProductContextForProvidedObject( _mselected[ 1 ] );
        } else {
            /**
             * While launching Compare from within ACE, we would have same configuration for both source and
             * target structure.
             */
            var _contentPCIUid = appCtxSvc.getCtx( 'aceActiveContext.context.productContextInfo.uid' );
            toParams.pci_uid = _contentPCIUid;
            toParams.pci_uid2 = _contentPCIUid;
        }
    }
    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    LocationNavigationService.instance.go( transitionTo, toParams, {} );
};

export let executeCompare = function( newCompareContext, _sourceVMOs, _targetVMOs, compareContext ) {
    let contextKeys = awStructureCompareUtils.getContextKeys();
    let topSrcElement = appCtxSvc.getCtx( contextKeys.leftCtxKey + '.topElement' );
    let topTrgElement = appCtxSvc.getCtx( contextKeys.rightCtxKey + '.topElement' );
    if( topSrcElement.uid !== topTrgElement.uid && awStructureCompareUtils.getChildCount( _sourceVMOs[0] ) > 0 && awStructureCompareUtils.getChildCount( _targetVMOs[0] ) > 0  ) {
        // Perform compare only on the first open of both the
        // structures. Subsequently, there should be an explicit call
        // to refresh the results
        let datasetUID = appCtxSvc.getCtx( 'compareContext.datasetUid' );
        let compareInput = compareGetSvc.createSOAInputForPaginationAndVisibleUids( newCompareContext, -2, false, false, false,
            awStructureCompareUtils.getDefaultCursor(), awStructureCompareUtils.getDefaultCursor(), _sourceVMOs, _targetVMOs, datasetUID );
        let deferred = AwPromiseService.instance.defer();
        awStructureCompareSvc.performCompare( newCompareContext, compareInput, false, false, compareContext, deferred );
        if( datasetUID ) {
            appCtxSvc.updatePartialCtx( 'compareContext.datasetUid', null );
        }
        return deferred.promise;
    }
};

export let openCompareNotification = function( notificationObject ) {
    dataManagementSvc.getProperties( [ notificationObject.object.uid ], [ 'fnd0MessageBody' ] ).then(
        function() {
            let dataSetUid = notificationObject.object.uid;
            let notificationObjWithNewProps = cdm.getObject( dataSetUid );
            let str = notificationObjWithNewProps.props.fnd0MessageBody.dbValues[ '0' ];
            let srcUidToken = '?uid=';
            let srcPcidToken = '&pci_uid=';
            let tgtUidToken = '&uid2=';
            let tgtPcidToken = '&pci_uid2=';
            let srcUid = str.indexOf( srcUidToken ) !== -1 ? str.substring( str.indexOf( srcUidToken ) + srcUidToken.length, str
                .indexOf( srcPcidToken ) ) : notificationObject.object.uid;
            let srcPcuid = str.indexOf( srcPcidToken ) !== -1 ? str.substring( str.indexOf( srcPcidToken ) + srcPcidToken.length, str
                .indexOf( tgtUidToken ) ) : null;
            let trgUid = str.indexOf( tgtUidToken ) !== -1 ? str.substring( str.indexOf( tgtUidToken ) + tgtUidToken.length, str
                .indexOf( tgtPcidToken ) ) : null;
            let trgPcuid = str.indexOf( tgtPcidToken ) !== -1 ? str.substring( str.indexOf( tgtPcidToken ) + tgtPcidToken.length ) : null;

            dataManagementSvc.loadObjects( [ srcUid, srcPcuid, trgUid, trgPcuid ] ).then( function() {
                let _urlParams = AwStateService.instance.params;
                _.forEach( _urlParams, function( value, name ) {
                    AwStateService.instance.params[ name ] = null;
                } );
                let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
                let toParams = AwStateService.instance.params;
                toParams.uid = srcUid;

                if( trgUid ) {
                    transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
                    toParams.pci_uid = srcPcuid;
                    toParams.uid2 = trgUid;
                    toParams.pci_uid2 = trgPcuid;

                    if( appCtxSvc.getCtx( 'splitView' ) ) {
                        appCtxSvc.updatePartialCtx( 'refreshViewOnNotificationClick', true );
                        eventBus.publish( 'occTreeTable.plTable.reload' );
                        eventBus.publish( 'occTreeTable2.plTable.reload' );
                    }
                    let compareContext = appCtxSvc.getCtx( 'compareContext' );
                    let toUpdate = {
                        compareContext: {
                            datasetUid: dataSetUid,
                            autoOpenComparePanel: true,
                            isMultiStructureFirstLaunch: true
                        }
                    };
                    autoOpenComparePanel = true;
                    if( compareContext !== undefined && compareContext !== null ) {
                        occmgmtUtils.updateValueOnCtxOrState( '', toUpdate.compareContext, 'compareContext', true );
                    } else {
                        occmgmtUtils.updateValueOnCtxOrState( '', toUpdate, '' );
                    }
                }
                let options = {};
                options.reload = true;
                LocationNavigationService.instance.go( transitionTo, toParams, options );
            } );
        } );
};

export let toggleSourcePanelCollapseState = ( panelName, isCollapsed ) => {
    if( panelName === 'source' ) {
        return isCollapsed;
    }
    return true;
};

export let toggleTargetPanelCollapseState = ( panelName ) => {
    if( panelName === 'target' ) {
        return false;
    }
    return true;
};

export let collapseSourceAndTargetPanels = () => {
    return { isSourcePanelCollapsed: true, isTargetPanelCollapsed: true };
};

export let syncExpansion = ( vmc, equivalentList, node ) => {
    if( node.isSystemExpanded ) {
        node.isSystemExpanded = false;
    } else if( node.isExpanded ) {
        awStructureCompareSvc.toggleEquivalentRow( vmc, equivalentList, node.uid );
    }
    //To redecorate child node(as per updated server response of compareContent3) on expansion
    if( node.isExpanded && node.children ) {
        awStructureCompareSvc.setDecoratorStyles( node.children );
    }
    let verdict = false;
    for( let key in node.children ) {
        if( node.children[ key ].cellDecoratorStyle === '' ||
            node.children[ key ].gridDecoratorStyle === '' ) {
            verdict = true;
            break;
        }
    }
    if( verdict ) {
        eventBus.publish( 'occMgmt.performAutoCompareForExpandedNodes' );
    }
};

export let setResetOnProductChangeFlag = ( compareContext ) => {
    const newCompareContext = { ...compareContext };
    newCompareContext.resetOnProductChange = true;
    return newCompareContext;
};

/**
 * Determines if a selection update is needed based on the provided selected objects and conditions.
 *
 * @param {Array} selectedObjs1 - Array of PWA selected objects.
 * @param {Array} selectedObjs2 -Array of Compare panel selected objects.
 * @param {boolean} [isAtomicDataUpdateCase=false] - Flag indicating if the update is for atomic data.
 * @returns {boolean} - Returns true if a selection update is needed, otherwise false.
 *
 * In the case of partition selection in PWA, the selection is synced to the panel, removing the current selection
 * from the panel because partition objects are not part of the compare result. However, the selection should not
 * be updated in the atomic data.
 *
 * If both selectedObjs1 and selectedObjs2 are provided and have the same length, the function returns true only if
 * the content of selectedObjs1 and selectedObjs2 do not match.
 *
 * If no selection is made so far, the function returns true.
 */
export let isSelectionNeeded = function( selectedObjs1, selectedObjs2, isAtomicDataUpdateCase = false ) {
    if( isAtomicDataUpdateCase && selectedObjs1 && selectedObjs1.length === 1 &&
        selectedObjs1[ 0 ]?.modelType?.typeHierarchyArray.indexOf( PARTITION_ELEMENT ) > -1 && selectedObjs2?.length === 0 ) {
        return false;
    }
    if( selectedObjs1 && selectedObjs2 && selectedObjs1.length > 0 && selectedObjs2.length > 0
        && selectedObjs1.length === selectedObjs2.length ) {
        const uidsArray = selectedObjs2.map( obj => obj.uid );
        return selectedObjs1.some( obj => !uidsArray.includes( obj.uid ) );
    }
    //No selection is made so far
    return true;
};

let updatePanelSelection = function( selectedObjects, panelSelected, selectionModel ) {
    if( isSelectionNeeded( selectedObjects, panelSelected ) && selectionModel ) {
        selectionModel.setSelection( selectedObjects );
    }
};

export let resetCrossSelectionFlag = _.debounce( function() {
    _crossSelectionSyncFlag = false;
}, 500 );

export let setCrossSelectionFlag = () => {
    _crossSelectionSyncFlag = true;
};

export let propagateSelectionToPanel = ( occContext, inactiveContext, data, isInCompareMode ) => {
    if( isInCompareMode ) {
        let compareSrc;
        let compareTrg;
        let selectedObjects;
        if( occContext.viewKey === 'occmgmtContext' ) {
            compareSrc = occContext;
            compareTrg = inactiveContext;
            if( data.dataProviders.getSourceDiffResults ) {
                selectedObjects = compareSrc.pwaSelection[ 0 ].uid !== compareSrc.topElement.uid ? compareSrc.pwaSelection : [];
                updatePanelSelection( selectedObjects, data.selectionData.selected, data.dataProviders.getSourceDiffResults.selectionModel );
            }
        } else {
            compareSrc = inactiveContext;
            compareTrg = occContext;
            if( data.dataProviders.getTargetDiffResults ) {
                selectedObjects = compareTrg.pwaSelection[ 0 ].uid !== compareTrg.topElement.uid ? compareTrg.pwaSelection : [];
                updatePanelSelection( selectedObjects, data.selectionData2.selected, data.dataProviders.getTargetDiffResults.selectionModel );
            }
        }
    }
};

export let propagateSelectionToGrid = async function( occContext, dp ) {
    if( _crossSelectionSyncFlag ) {
        return;
    }
    let selection = dp.selectedObjects;
    selection = selection === undefined ? [] : selection;

    selection = await awStructureCompareSvc.replaceHiddenElementsWithVisibleElements( selection );

    const selectionsToModify = {
        elementsToSelect: selection,
        overwriteSelections: true
    };

    if( isSelectionNeeded( occContext.pwaSelection, selection, true ) ) {
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
    }
};

export let syncSelection = ( occContext, occContext2, compareContext, grid ) => {
    if( _crossSelectionSyncFlag || !compareContext.isInCompareMode || autoOpenComparePanel ) {
        return;
    }

    let selectedObjects = [];
    if( grid === 1 ) {
        selectedObjects = occContext.pwaSelection;
        selectedObjects = selectedObjects[ 0 ].uid !== occContext.topElement.uid ? selectedObjects : [];
    } else if( grid === 2 ) {
        selectedObjects = occContext2.pwaSelection;
        selectedObjects = selectedObjects[ 0 ].uid !== occContext2.topElement.uid ? selectedObjects : [];
    }

    awStructureCompareSvc.navigateDifferences( occContext, occContext2, compareContext, grid, selectedObjects, false );
};

export let resetGridSelectionModel = ( occContext, occContext2, compareContext ) => {
    let mode = compareContext.isInCompareMode ? 'single' : 'multiple';
    updateSelectionMode( occContext, mode, compareContext.autoOpenComparePanel );
    updateSelectionMode( occContext2, mode, compareContext.autoOpenComparePanel );
};

let updateSelectionMode = function( occContext, mode, autoOpenComparePanel ) {
    if( occContext.treeDataProvider && occContext.treeDataProvider.selectionModel ) {
        occContext.treeDataProvider.selectionModel.setMode( mode );
        let selectedObjs = occContext.pwaSelection;
        if( autoOpenComparePanel ) {
            if( selectedObjs.length > 1 || selectedObjs.length === 1 && selectedObjs[ 0 ].uid !== occContext.topElement.uid ) {
                occContext.treeDataProvider.selectionModel.setSelection( [] );
            }
        } else if( selectedObjs.length > 1 ) {
            //Multiselection case where we need to manually set selection to last element.
            occContext.treeDataProvider.selectionModel.setSelection( [ selectedObjs[ selectedObjs.length - 1 ] ] );
        }
    }
};

export let setCompareResultSectionTitles = ( data, compareContext ) => {
    let sourceSelectionObj = cdm.getObject( compareContext.compareList.sourceSelection );
    let targetSelectionObj = cdm.getObject( compareContext.compareList.targetSelection );
    let sourceTitle = sourceSelectionObj.props.object_string.uiValues[ 0 ];
    let targetTitle = targetSelectionObj.props.object_string.uiValues[ 0 ];

    // The dbValue of compareOption is 1 it means that the current level option is opted for comparison.
    // The dbValue of compareOption is -5 it means that the all level below selection option is opted for comparison.
    // As as result we want show the selected object as a title in the compare panel.

    if( !autoOpenComparePanel && ( data.compareOption.dbValue === 1 || data.compareOption.dbValue === -5 ) ) {
        sourceTitle = compareContext.compareList.cmpSelection1.props.object_string.uiValues[ 0 ];
        targetTitle = compareContext.compareList.cmpSelection2.props.object_string.uiValues[ 0 ];
    }

    autoOpenComparePanel = false;

    return {
        sourceTitle: sourceTitle,
        targetTitle: targetTitle
    };
};

/**
 * Need to clear the compare result in case of scheme overlay mode.
 *
 */
export let clearCompareContextForPartitionCompare = function( compareContext, data ) {
    if( data.conditions.isPartitionSchemeApplied ) {
        let newCompareContext = {};
        compareContext.update( newCompareContext );
        awStructureCompareSvc.resetCompareColorData( compareContext );
    }
};

/**
 * This method will subscribe the treeNodesLoaded event while entering the compare mode
 */
export let subscribeForTreeNodesLoaded = function() {
    if( !getLoadedSourceVMOs ) {
        getLoadedSourceVMOs = eventBus.subscribe( 'occDataProvider.treeNodesLoaded', getLoadedSrcVMOsUid );
    }
};

/**
 * This method will unsubscribe the treeNodesLoaded event while exiting the compare mode
 */
export let unSubscribeForTreeNodesLoaded = function() {
    if( getLoadedSourceVMOs ) {
        eventBus.unsubscribe( getLoadedSourceVMOs );
        getLoadedSourceVMOs = null;
    }
};

/**
 * This method will subscribe the packUnpackSuccessful event while entering the compare mode
 */
export let subscribeToPackUnpackSuccessful = function() {
    if( !getLoadedSourceVMOsAfterPackUnpack ) {
        getLoadedSourceVMOsAfterPackUnpack = eventBus.subscribe( 'tree.packUnpackSuccessful', getLoadedSrcVMOsUid );
    }
};

/**
 * This method will unsubscribe the packUnpackSuccessful event while exiting the compare mode
 */
export let unSubscribeToPackUnpackSuccessful = function() {
    if( getLoadedSourceVMOsAfterPackUnpack ) {
        eventBus.unsubscribe( getLoadedSourceVMOsAfterPackUnpack );
        getLoadedSourceVMOsAfterPackUnpack = null;
    }
};

export default exports = {
    setAutoOpenComparePanelValue,
    getAutoOpenComparePanelValue,
    clearVMOCacheMap,
    initializeCompareData,
    setUpCompareContext,
    executeFromComparePanel,
    resetCompareContext,
    launchContentCompare,
    executeCompare,
    openCompareNotification,
    toggleSourcePanelCollapseState,
    toggleTargetPanelCollapseState,
    collapseSourceAndTargetPanels,
    performAutoCompare,
    getLoadedSrcVMOsUid,
    syncExpansion,
    setResetOnProductChangeFlag,
    propagateSelectionToPanel,
    propagateSelectionToGrid,
    syncSelection,
    resetGridSelectionModel,
    setCompareResultSectionTitles,
    clearCompareContextForPartitionCompare,
    resetProductListener,
    subscribeForTreeNodesLoaded,
    unSubscribeForTreeNodesLoaded,
    subscribeToPackUnpackSuccessful,
    unSubscribeToPackUnpackSuccessful,
    resetCrossSelectionFlag,
    setCrossSelectionFlag,
    isSelectionNeeded
};
