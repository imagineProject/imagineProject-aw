// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0GeometricAnalysisVolumeSearchService
 */
import soaService from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import AwTimeoutService from 'js/awTimeoutService';
import viewerVolumeProvider from 'js/viewerVolumeManagerProvider';
import viewerSelMgrProvider from 'js/viewerSelectionManagerProvider';
import viewerPerformanceService from 'js/viewerPerformance.service';
import viewerPreferenceService from 'js/viewerPreference.service';
import viewerUnitConversionService from 'js/viewerUnitConversionService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewerCtxSvc from 'js/viewerContext.service';

var exports = {};
let _fullScreenEventSubscription = null;
let _dragDropVolumeGadgetEvent = null;

/**
 * this method is used to unregister for the event
 */
let _unRegisterForEvents = function() {
    if( _fullScreenEventSubscription !== null ) {
        eventBus.unsubscribe( _fullScreenEventSubscription );
        _fullScreenEventSubscription = null;
    }
};

let _updatePersistentVolumeDataInViewerCtx = function( volumeState, viewerContextData ) {
    let fetchVolumeState = volumeState.getValue();


    viewerContextData.getVolumeManager().setVolumeFilterOnNative( false, viewerContextData );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'X1', fetchVolumeState.X1 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'Y1', fetchVolumeState.Y1 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'Z1', fetchVolumeState.Z1 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'X2', fetchVolumeState.X2 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'Y2', fetchVolumeState.Y2 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + 'Z2', fetchVolumeState.Z2 );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST, fetchVolumeState[ viewerVolumeProvider
        .GEOANALYSIS_VIEWER_VOLUME_TARGETLIST ] );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS, fetchVolumeState[ viewerVolumeProvider
        .GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS ] );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH, fetchVolumeState[
        viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH ] );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_USED_PCUID, fetchVolumeState[ viewerVolumeProvider
        .GEOANALYSIS_VIEWER_VOLUME_USED_PCUID ] );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS, fetchVolumeState[
        viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS ] );
    viewerContextData.updateViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME + '.' + viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST, fetchVolumeState[
        viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST ] );
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, null );
};

/**
 * this method is called on unmount lifecycle hook
 * @param {object} occmgmtContext occmgmt context
 * @param {object} volumeState atomic data for volume
 * @param {Object} viewerContextData viewer context data
 */
export let notifyVolumePanelClosed = function( occmgmtContext, volumeState, viewerContextData ) {
    try {
        _updatePersistentVolumeDataInViewerCtx( volumeState, viewerContextData );
        _unRegisterForEvents();
        let occmgmtContextData = { ...occmgmtContext.getValue() };
        delete occmgmtContextData.volumePanelNeedsUpdate;
        occmgmtContext.update( { ...occmgmtContextData } );
        viewerContextData.getVolumeManager().cleanUpVolumePanel();
        viewerContextData.getVolumeManager().registerUnregisterForDragAndDropVolumeGadget( false );
        _dragDropVolumeGadgetEvent = null;
    } catch {
        logger.warn( 'Failed to close volume panel since the viewer is not alive' );
    }
};

/**
 * this method is created for update atomic data
 * @param {object} volumeState volumeProps atomic data
 * @param {Object} viewerContextData viewer context data
 * @param {object} occmgmtContext occmgmt context
 */
let _registerOrUpdateAtomicData = function( volumeState, viewerContextData, occmgmtContext ) {
    let newVolumeState = { ...volumeState.getValue() };

    let currentProductContext = viewerContextData.getCurrentViewerProductContext();
    let currentProductContextUid = currentProductContext ? currentProductContext.uid : undefined;
    if( currentProductContextUid === undefined ||
        newVolumeState.usedProductContextUid !== currentProductContext.uid ) {
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_USED_PCUID ] = currentProductContext.uid;
        volumeState.update( { ...newVolumeState } );
        exports.removeAllVolumeTargets( volumeState, occmgmtContext );
    } else {
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_USED_PCUID ] = currentProductContextUid;
        volumeState.update( { ...newVolumeState } );
    }
};

/**
 * this method is to get CSID list for model objects
 * @param {array} moList list of model objects
 * @param {object} csidToMOPairs csid and model object pairs
 * @returns {array} csIdList array of CSID list
 */
let _getCsidListForModelObjects = function( moList, csidToMOPairs ) {
    let csIdList = [];

    for( let i = 0; i < moList.length; i++ ) {
        let idx = _.findIndex( csidToMOPairs, function( selObj ) { return selObj.modelObj.uid === moList[ i ].uid; } );

        if( idx !== -1 ) {
            let csId = csidToMOPairs[ idx ].csId;
            csIdList.push( csId );
        } else {
            logger.error( 'Awv0GeometricAnalysisVolumeSearchService: Did not find clone staible id for model object' );
        }
    }

    return csIdList;
};

/**
 * this method to update atomic data and ctx
 * @param {array} targets the list of target value
 * @param {object} volumeState volumeProps atomic data
 * @param {object} csidToMOPairs CSID to Model object Map
 * @param {object} occmgmtContext occmgmt context object
 */
let _updateCtxWithTargets = function( targets, volumeState, csidToMOPairs, occmgmtContext ) {
    let newVolumeState = { ...volumeState.getValue() };

    if( targets && !_.isEmpty( targets ) ) {
        const propsToBeLoaded = [ 'Name', 'ID', 'Revision', 'Thumbnail' ];
        tcVmoService.getViewModelProperties( targets, propsToBeLoaded );
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGET_CSID_LIST ] = _getCsidListForModelObjects( targets, csidToMOPairs );
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST ] = [ ...targets ];
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH ] = targets.length;
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS ] = csidToMOPairs;
    } else {
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGET_CSID_LIST ] = [];
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST ] = [];
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH ] = 0;
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS ] = undefined;
        newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS ] = [];
        volumeState.update( newVolumeState );
        return;
    }
    let currentProductCtx = occmgmtContext.productContextInfo;
    if( currentProductCtx && currentProductCtx.props.awb0PackSimilarElements &&
        currentProductCtx.props.awb0PackSimilarElements.dbValues[ 0 ] && targets && !_.isEmpty( targets ) ) {
        _getCloneStableIDsWithPackedOccurrences( currentProductCtx, targets ).then( function( response ) {
            newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS ] = response.csids;
            volumeState.update( { ...newVolumeState } );
        }, function( failure ) {
            logger.error( failure );
        } );
    }
};

/**
 * this method to update Volume Corners value

 * @param {object} volumeState this contains volumeProps atomic data
 * @param {object} viewerContextData viewer context data
 */
export let updateVolumeCornersOccList = function( volumeState, viewerContextData ) {
    viewerContextData.getVolumeManager().getCornerValuesFromOccListInCtx( volumeState ).then( function( volumeState ) {
        let newVolumePropState = { ...volumeState.getValue() };
        newVolumePropState.toggleCornerVal = !newVolumePropState.toggleCornerVal;
        volumeState.update( { ...newVolumePropState } );
    }, function( failure ) {
        logger.error( failure );
    } );
};

/**
 * this method is to get CSID for current selection
 * @param {object} viewerContextData sub panel context
 * @returns {*} viewerSelectionCSIDS
 */
let _getCurrentViewerSelectionCsIds = function( viewerContextData ) {
    let viewerSelectionCSIDS = viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_CSID_KEY );
    if( _.isUndefined( viewerSelectionCSIDS ) || viewerSelectionCSIDS.length === 0 ) {
        return [ '' ]; //root
    }
    return viewerSelectionCSIDS;
};

/**
 * this method is to get CSID for selected object using SOA call
 * @param {object} productContextInfo PCI
 * @param {object} selectedObjects modelobject
 * @returns {Object} Returns the response of getPackedOccurrenceCSIDs
 */
let _getCloneStableIDsWithPackedOccurrences = function( productContextInfo, selectedObjects ) {
    let fetchPackedOccurrences = false;
    let packingInUse = productContextInfo.props.awb0PackSimilarElements.dbValues[ 0 ];
    if( packingInUse ) {
        fetchPackedOccurrences = true;
    }

    if( !fetchPackedOccurrences || selectedObjects.length === 0 ) {
        return;
    }

    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2017-12-OccurrenceManagement',
        'getPackedOccurrenceCSIDs', {
            occurrences: selectedObjects,
            productContextInfo: productContextInfo
        } );
};

/**
 * Get all targets
 * @param {object} viewerData this contains value of panelContext from ctx
 * return {object} target list and its length
 */

export let getAllTargets = function( volumeState ) {
    let geoAnalysisVolumeSearchAtomicData = volumeState.getValue();
    return {
        allTargets: geoAnalysisVolumeSearchAtomicData.targetList,
        totalFound: geoAnalysisVolumeSearchAtomicData.targetListLength
    };
};

/**
 * this method is called on Mount when volume panel is revealed

 * @param {Object} volumeState this conatains VolumeProps state
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 * @param {Object} volumeUnitTextMinimum minimum value object
 * @param {Object} volumeUnitTextMaximum maximum value object
 * @param {Object} localeTextBundle local bundle
 * @param {String} viewId view id for active dialog
 * @returns {Object} value of minimum and maximum units for volume
 */
export let volumePanelRevealed = function( volumeState, viewerContextData, occmgmtContext, volumeUnitTextMinimum, volumeUnitTextMaximum, localeTextBundle, viewId ) {
    if( _fullScreenEventSubscription === null ) {
        _fullScreenEventSubscription = eventBus.subscribe( 'commandBarResized', function() {
            notifyVolumePanelClosed( occmgmtContext, volumeState, viewerContextData );
            _unRegisterForEvents();
        }, 'Awv0GeometricAnalysisvolumeSearchService' );
    }

    let newVolumePropState = { ...volumeState.getValue() };
    let uiValueString = '';

    var displayUnit = viewerPreferenceService.getDisplayUnit( viewerContextData );
    for( var key in viewerUnitConversionService.unitMap ) {
        if( viewerUnitConversionService.unitMap[ key ] === displayUnit ) {
            uiValueString = localeTextBundle[ key ];
        }
    }
    volumeUnitTextMinimum.uiValue = localeTextBundle.corner1Text + ' (' + uiValueString + ')';
    volumeUnitTextMaximum.uiValue = localeTextBundle.corner2Text + ' (' + uiValueString + ')';

    let volumeCtx = viewerContextData.getValueOnViewerAtomicData( viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME );
    if( volumeCtx && volumeCtx.targetListPkdCsids ) {
        newVolumePropState.targetListPkdCsids = volumeCtx.targetListPkdCsids;
        newVolumePropState.targetList = volumeCtx.targetList;
        newVolumePropState.targetListLength = volumeCtx.targetListLength;
        newVolumePropState.usedProductContextUid = volumeCtx.usedProductContextUid;
        newVolumePropState.newTargetForList = volumeCtx.newTargetForList;
        let targets = volumeCtx.targetList;
        let csidToMOPairs = volumeCtx.csidToMOPairs ? volumeCtx.csidToMOPairs : [];
        newVolumePropState.targetCsidList = _getCsidListForModelObjects( targets, csidToMOPairs );
        newVolumePropState.X1 = volumeCtx.X1;
        newVolumePropState.Y1 = volumeCtx.Y1;
        newVolumePropState.Z1 = volumeCtx.Z1;
        newVolumePropState.X2 = volumeCtx.X2;
        newVolumePropState.Y2 = volumeCtx.Y2;
        newVolumePropState.Z2 = volumeCtx.Z2;
        volumeState.update( { ...newVolumePropState } );
    } else {
        _registerOrUpdateAtomicData( volumeState, viewerContextData, occmgmtContext );
    }
    viewerContextData.getVolumeManager().initialize( volumeState );
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, viewId );
    return {
        volumeUnitTextMinimum: volumeUnitTextMinimum,
        volumeUnitTextMaximum: volumeUnitTextMaximum
    };
};

/**
 * Add selections to target list
 * @param {Object} volumeState local atomic data for volume
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 */
export let addSelectionsToTargetList = function( volumeState, viewerContextData, occmgmtContext ) {
    let newVolumeState = volumeState.getValue();

    let selections = viewerContextData.getVolumeManager().getCurrentViewerSelections();

    if( Array.isArray( selections ) && selections.length !== undefined ) {
        let currentTargetList = newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST ];
        if( currentTargetList === undefined ) {
            currentTargetList = [];
        }
        let csidToMOPairs = newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS ];
        if( csidToMOPairs === undefined ) {
            csidToMOPairs = [];
        }
        let newSelections = _.difference( selections, currentTargetList );

        for( let i = 0; i < newSelections.length; i++ ) {
            let sel = newSelections[ i ];
            currentTargetList.push( sel );
            let csIds = _getCurrentViewerSelectionCsIds( viewerContextData );
            let csIdIdx = _.findIndex( selections, function( viewerSel ) { return viewerSel.uid === sel.uid; } );
            csidToMOPairs.push( { csId: csIds[ csIdIdx ], modelObj: sel } );
        }

        if( _dragDropVolumeGadgetEvent === null || _.isUndefined( _dragDropVolumeGadgetEvent ) ) {
            _dragDropVolumeGadgetEvent = viewerContextData.getVolumeManager().registerUnregisterForDragAndDropVolumeGadget( true );
        }

        _updateCtxWithTargets( currentTargetList, volumeState, csidToMOPairs, occmgmtContext );
    }
};

/**
 * Remove all Volume targets
 * @param {Object} volumeState local atomic data for volume
 * @param {Object} occmgmtContext occmgmt context
 */
export let removeAllVolumeTargets = function( volumeState, occmgmtContext ) {
    _updateCtxWithTargets( [], volumeState, [], occmgmtContext );
};

/**
 * this method is to set volume filter on Native
 * @param {boolean} isOn set volume filter true/false
 * @param {object} subPanelContext this contains value of panelContext from ctx
 */

export let setVolumeFilterOnNative = function( isOn, viewerContextData ) {
    viewerContextData.getVolumeManager().setVolumeFilterOnNative( isOn );
};

/**
 * remove specific target
 * @param {object} target this contains target value
 * @param {Object} volumeState local atomic data for volume
 * @param {Object} occmgmtContext occmgmt context
 */
export let removeVolumeTarget = function( target, volumeState, occmgmtContext ) {
    let newVolumeState = { ...volumeState.getValue() };
    let currentTargetList = newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_TARGETLIST ];
    let csidToMOPairs = newVolumeState[ viewerVolumeProvider.GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS ];

    _.remove( currentTargetList, {
        uid: target.uid
    } );
    _.remove( csidToMOPairs, function( obj ) { return obj.modelObj.uid === target.uid; } );
    _updateCtxWithTargets( currentTargetList, volumeState, csidToMOPairs, occmgmtContext );
};

/**
 * this method is to update volume corners in dbValue
 * @param {object} declViewModel view model object
 * @param {object} volumeState local atomic data for volume
 * @returns {object} targetRangeVolume for X1,X2,Y1,Y2,Z1, Z2
 */
export let updateVolumeCorners = function( declViewModel, volumeState ) {
    //Mutation
    let cornerValues = volumeState.getValue();
    const targetRangeVolumeX1 = _.clone( declViewModel.targetRangeVolumeX1 );
    const targetRangeVolumeY1 = _.clone( declViewModel.targetRangeVolumeY1 );
    const targetRangeVolumeZ1 = _.clone( declViewModel.targetRangeVolumeZ1 );
    const targetRangeVolumeX2 = _.clone( declViewModel.targetRangeVolumeX2 );
    const targetRangeVolumeY2 = _.clone( declViewModel.targetRangeVolumeY2 );
    const targetRangeVolumeZ2 = _.clone( declViewModel.targetRangeVolumeZ2 );
    targetRangeVolumeX1.dbValue = typeof cornerValues.X1 === 'undefined' || isNaN( cornerValues.X1 ) ? '' :
        parseFloat( cornerValues.X1.toFixed( 6 ) );

    targetRangeVolumeY1.dbValue = typeof cornerValues.Y1 === 'undefined' || isNaN( cornerValues.Y1 ) ? '' :
        parseFloat( cornerValues.Y1.toFixed( 6 ) );

    targetRangeVolumeZ1.dbValue = typeof cornerValues.Z1 === 'undefined' || isNaN( cornerValues.Z1 ) ? '' :
        parseFloat( cornerValues.Z1.toFixed( 6 ) );

    targetRangeVolumeX2.dbValue = typeof cornerValues.X2 === 'undefined' || isNaN( cornerValues.X2 ) ? '' :
        parseFloat( cornerValues.X2.toFixed( 6 ) );

    targetRangeVolumeY2.dbValue = typeof cornerValues.Y2 === 'undefined' || isNaN( cornerValues.Y2 ) ? '' :
        parseFloat( cornerValues.Y2.toFixed( 6 ) );

    targetRangeVolumeZ2.dbValue = typeof cornerValues.Z2 === 'undefined' || isNaN( cornerValues.Z2 ) ? '' :
        parseFloat( cornerValues.Z2.toFixed( 6 ) );

    return {
        targetRangeVolumeX1: targetRangeVolumeX1,
        targetRangeVolumeY1: targetRangeVolumeY1,
        targetRangeVolumeZ1: targetRangeVolumeZ1,
        targetRangeVolumeX2: targetRangeVolumeX2,
        targetRangeVolumeY2: targetRangeVolumeY2,
        targetRangeVolumeZ2: targetRangeVolumeZ2
    };
};

/**
 * this method is to execute volume search
 * @param {object} cornerValuesContainer this conatains all corner Values
 * @param {Object} viewerContextData viewer context data
 * @param {Boolean} volumeBoundary volume boundary boolean - contains/intersecting
 * @param {Boolean} volumeAction volume action boolean - show/select
 */
export let executeVolumeSearch = function( cornerValuesContainer, viewerContextData, volumeBoundary, volumeAction ) {
    if( volumeAction ) {
        _executeVolumeSelection( viewerContextData, cornerValuesContainer, volumeBoundary );
    } else {
        _executeVolumeVisibility( viewerContextData, cornerValuesContainer, volumeBoundary );
    }
};

/**
 * execute volume search
 * @param {Object} viewerContextData viewer context data
 * @param {Object} cornerValuesContainer corner values
 * @param {Boolean} volumeBoundary volume boundary boolean - contains/intersecting
 */
let _executeVolumeVisibility = function( viewerContextData, cornerValuesContainer, volumeBoundary ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.Volume );
    }

    viewerContextData.getVolumeManager().executeVolumeSearch( cornerValuesContainer, volumeBoundary ).then( function() {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Volume Search Completed : ' );
            viewerPerformanceService.setViewerPerformanceMode( false );
        } else {
            logger.info( 'Volume Search Completed' );
        }
    }, function( failure ) {
        logger.error( failure );
    } );
};

/**
 * execute volume selection
 * @param {Object} viewerContextData viewer context data
 * @param {Object} cornerValuesContainer corner values
 * @param {Boolean} volumeBoundary volume boundary boolean - contains/intersecting
 */
let _executeVolumeSelection = function( viewerContextData, cornerValuesContainer, volumeBoundary ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.Volume );
    }
    viewerContextData.getVolumeManager().executeVolumeSelection( cornerValuesContainer, volumeBoundary ).then( function() {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Volume Selection Completed : ' );
            viewerPerformanceService.setViewerPerformanceMode( false );
        } else {
            logger.info( 'Volume Selection Completed' );
        }
    }, function( failure ) {
        logger.error( failure );
    } );
};

/**
 * this method is to update/validate target volume when user enter data from UI
 * @param {Object} data view model data
 * @param {Object} volumeState local atomic data for volume
 * @param {Object} viewerContextData viewer context data
 */
export const updateTargetVolume = function( data, volumeState, viewerContextData ) {
    let newVolumeState = { ...volumeState.getValue() };
    if( newVolumeState.dragAndDropVolumeGadgetEvent ) {
        newVolumeState.dragAndDropVolumeGadgetEvent = false;
        volumeState.update( { ...newVolumeState } );
        return;
    }
    if( !( data.targetRangeVolumeX1.dbValue === '' || data.targetRangeVolumeX2.dbValue === '' || data.targetRangeVolumeY1.dbValue === '' || data.targetRangeVolumeY2.dbValue === '' || data
        .targetRangeVolumeZ1.dbValue === '' || data.targetRangeVolumeZ2.dbValue === '' ) && data.targetRangeVolumeX1.dbValue <= data.targetRangeVolumeX2.dbValue && data.targetRangeVolumeY1
        .dbValue <= data.targetRangeVolumeY2.dbValue && data.targetRangeVolumeZ1.dbValue <= data.targetRangeVolumeZ2.dbValue ) {
        let cornerValues = { ...volumeState.getValue() };
        cornerValues.X1 = data.targetRangeVolumeX1.dbValue;
        cornerValues.Y1 = data.targetRangeVolumeY1.dbValue;
        cornerValues.Z1 = data.targetRangeVolumeZ1.dbValue;
        cornerValues.X2 = data.targetRangeVolumeX2.dbValue;
        cornerValues.Y2 = data.targetRangeVolumeY2.dbValue;
        cornerValues.Z2 = data.targetRangeVolumeZ2.dbValue;
        volumeState.update( { ...cornerValues } );
        viewerContextData.getVolumeManager().drawVolumeBox( cornerValues, volumeState );
        if( _dragDropVolumeGadgetEvent === null || _.isUndefined( _dragDropVolumeGadgetEvent ) ) {
            _dragDropVolumeGadgetEvent = viewerContextData.getVolumeManager().registerUnregisterForDragAndDropVolumeGadget( true );
        }
    } else {
        AwTimeoutService.instance( function() {
            exports.setVolumeFilterOnNative( false, viewerContextData );
        }, 500 );
    }
};

/**
 *
 * initialize Volume Target
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 * @param {Object} volumeState local atomic data for volume
 */
export const initializeVolumeTarget = function( viewerContextData, occmgmtContext, volumeState ) {
    if( !_.isUndefined( viewerContextData ) ) {
        viewerContextData.getVolumeManager().comparetargetsWithSelections( occmgmtContext, volumeState );
    }
};

/**
 *
 * @param {object} fields data object
 * @param {string} fieldName string value
 */
export let updateField = function( fields, fieldName ) {
    let fieldToUpdate = fields[ fieldName ];
    fieldToUpdate.update( fieldToUpdate.value );
};

export default exports = {
    getAllTargets,
    volumePanelRevealed,
    updateVolumeCornersOccList,
    addSelectionsToTargetList,
    removeAllVolumeTargets,
    setVolumeFilterOnNative,
    removeVolumeTarget,
    updateVolumeCorners,
    executeVolumeSearch,
    updateTargetVolume,
    initializeVolumeTarget,
    notifyVolumePanelClosed,
    updateField
};
