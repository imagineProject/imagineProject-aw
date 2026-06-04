// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0GeometricAnalysisProximitySearchService
 */
import appCtxSvc from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import viewerPreferenceService from 'js/viewerPreference.service';
import viewerPerformanceService from 'js/viewerPerformance.service';
import viewerProximityManager from 'js/viewerProximityManagerProvider';
import viewerCtxSvc from 'js/viewerContext.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import viewerUnitConversionService from 'js/viewerUnitConversionService';
import tcVmoService from 'js/tcViewModelObjectService';

var exports = {};

var _fullScreenEventSubscription = null;
var _csidToMOPairs = [];

/**
 * this method is called on unmount lifecycle hook
 * @param {Object} geoAnalysisProximitySearch local atomic data
 * @param {Object} occmgmtContext occmgmt context
 */
export let notifyProximityPanelClosed = function( geoAnalysisProximitySearch, occmgmtContext  ) {
    if( _fullScreenEventSubscription !== null ) {
        eventBus.unsubscribe( _fullScreenEventSubscription );
        _fullScreenEventSubscription = null;
    }
    let fetchProximityState = geoAnalysisProximitySearch.getValue();
    let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
    let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
    let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
    let viewerContextData = viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
    let occmgmtContextData = { ...occmgmtContext.getValue() };
    delete occmgmtContextData.volumePanelNeedsUpdate;
    occmgmtContext.update( { ...occmgmtContextData } );
    //persist data
    viewerContextData.updateViewerAtomicData( viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY + '.' + viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST, fetchProximityState[
        viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST ] );
    viewerContextData.updateViewerAtomicData( viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY + '.' + viewerProximityManager
        .GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_PKDCSIDS, fetchProximityState[ viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_PKDCSIDS ] );
    viewerContextData.updateViewerAtomicData( viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY + '.' + viewerProximityManager
        .GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_UPDATE_TARGET_LIST, fetchProximityState[ viewerProximityManager
        .GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_UPDATE_TARGET_LIST ] );
    viewerContextData.updateViewerAtomicData( viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY + '.' + viewerProximityManager
        .GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_USED_PCI_UID, fetchProximityState[ viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_USED_PCI_UID ] );
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, null );
    viewerContextData.getProximityManager().cleanUpProximityPanel();
};
/**
 * this method is created for update atomic data
 * @param {Object} geoAnalysisProximitySearch local atomic data
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 */
var _registerOrUpdateAtomicData = function( geoAnalysisProximitySearch, viewerContextData, occmgmtContext ) {
    let newProximityPropState = { ...geoAnalysisProximitySearch.getValue() };

    let currentProductContext = viewerContextData.getCurrentViewerProductContext();
    let currentProductContextUid = currentProductContext ? currentProductContext.uid : undefined;
    if( currentProductContextUid === undefined ||
        newProximityPropState.usedProductContextUid !== currentProductContextUid ) {
        newProximityPropState.usedProductContextUid = currentProductContextUid;
        geoAnalysisProximitySearch.update( { ...newProximityPropState } );

        exports.removeAllProximityTargets( geoAnalysisProximitySearch, occmgmtContext );
    }
};
/**
 * this method is to get CSID list for model objects
 * @param {array} moList list of model objects
 * @returns {array} csIdList array of CSID list
 */
var _getCsidListForModelObjects = function( moList ) {
    var csIdList = [];
    if( !moList || !Array.isArray( moList ) ) {
        return [];
    }
    for( var i = 0; i < moList.length; i++ ) {
        var idx = _.findIndex( _csidToMOPairs, function( selObj ) { return selObj.modelObj.uid === moList[ i ].uid; } );

        if( idx !== -1 ) {
            var csId = _csidToMOPairs[ idx ].csId;
            csIdList.push( csId );
        } else {
            logger.error( 'Awv0GeometricAnalysisProximitySearchService: Did not find clone staible id for model object' );
        }
    }

    return csIdList;
};
/**
 * this method to update atomic data and ctx
 * @param {array} targets the list of target value
 * @param {object} geoAnalysisProximitySearch proximity atomic data
 * @param {Object} occmgmtContext occmgmt context
 */
var _updateCtxWithTargets = function( targets, geoAnalysisProximitySearch, occmgmtContext ) {
    let newProximityPropState = { ...geoAnalysisProximitySearch.getValue() };
    newProximityPropState[ viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST ] = [ ...targets ];

    newProximityPropState.targetCsidList = _getCsidListForModelObjects( targets );
    let currentProductCtx = occmgmtContext.productContextInfo;
    if( currentProductCtx && currentProductCtx.props.awb0PackSimilarElements &&
        currentProductCtx.props.awb0PackSimilarElements.dbValues[ 0 ] && targets && !_.isEmpty( targets ) ) {
        _getCloneStableIDsWithPackedOccurrences( currentProductCtx, targets ).then( function( response ) {
            newProximityPropState.targetListPkdCsids = response.csids;
            newProximityPropState.updateTargetList = !newProximityPropState.updateTargetList;
            geoAnalysisProximitySearch.update( { ...newProximityPropState } );
        }, function( failure ) {
            logger.error( failure );
        } );
    } else {
        newProximityPropState.targetListPkdCsids = undefined;
        newProximityPropState.updateTargetList = !newProximityPropState.updateTargetList;
        geoAnalysisProximitySearch.update( { ...newProximityPropState } );
    }
};

/**
 * Get all targets
 * @returns {object} target list and its length
 * @param {Object} geoAnalysisProximitySearch local atomic data
 * @param {Object} viewerContextData viewer context data
 */
export let getAllTargets = function( geoAnalysisProximitySearch, viewerContextData ) {
    viewerContextData.getProximityManager().comparetargetsWithSelections( geoAnalysisProximitySearch );

    let proximityCtx = geoAnalysisProximitySearch.getValue();
    return {
        allTargets: proximityCtx.targetList,
        totalFound: proximityCtx.targetList ? proximityCtx.targetList.length : 0
    };
};

/**
 * this method is called on Mount when proximity panel is revealed
 * @param {Object} targetRange target range
 * @param {Object} localeTextBundle this contains i18n data
 * @param {Object} geoAnalysisProximitySearch local atomic data
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 * @param {String} viewId id of open dialog
 * @returns {Object} proximityUnitText object
 */
export let proximityPanelRevealed = function( targetRange, localeTextBundle, geoAnalysisProximitySearch, viewerContextData, occmgmtContext, viewId ) {
    if( _fullScreenEventSubscription === null ) {
        _fullScreenEventSubscription = eventBus.subscribe( 'commandBarResized', function() {
            exports.notifyProximityPanelClosed( geoAnalysisProximitySearch, occmgmtContext );
        }, 'Awv0GeometricAnalysisProximitySearchService' );
    }

    let newProximityPropState = { ...geoAnalysisProximitySearch.getValue() };

    let proximityCtx = viewerContextData.getValueOnViewerAtomicData( viewerProximityManager.GEOANALYSIS_VIEWER_PROXIMITY );
    //Show data on panel reveal
    if( proximityCtx && proximityCtx.targetListPkdCsids ) {
        newProximityPropState.targetListPkdCsids = proximityCtx.targetListPkdCsids;
        newProximityPropState.updateTargetList = proximityCtx.updateTargetList;
        newProximityPropState.usedProductContextUid = proximityCtx.usedProductContextUid;
        let targets = proximityCtx.targetList;
        newProximityPropState.targetList = targets;
        newProximityPropState.targetCsidList = _getCsidListForModelObjects( targets );
        geoAnalysisProximitySearch.update( { ...newProximityPropState } );
    }
    let uiValueString = '';
    _registerOrUpdateAtomicData( geoAnalysisProximitySearch, viewerContextData, occmgmtContext );
    var displayUnit = viewerPreferenceService.getDisplayUnit( viewerContextData );
    for( var key in viewerUnitConversionService.unitMap ) {
        if( viewerUnitConversionService.unitMap[ key ] === displayUnit ) {
            uiValueString = localeTextBundle[ key ];
        }
    }
    let proximityLabel = localeTextBundle.proximityLabelText;
    targetRange.propertyDisplayName = proximityLabel.replace( '{0}', '(' + uiValueString + ')' );
    viewerContextData.getProximityManager().initialize( { ...geoAnalysisProximitySearch } );
    viewerContextData.updateViewerAtomicData( viewerCtxSvc.VIEWER_ACTIVE_DIALOG_ENABLED, viewId );
    return {
        targetRange: targetRange
    };
};

/**
 * Add selections to target list
 * @param {Object} geoAnalysisProximitySearch this contains geoAnalysisProximitySearch value
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occmgmt context
 */
export let addSelectionsToTargetList = function( geoAnalysisProximitySearch, viewerContextData, occmgmtContext ) {
    let proximityCtx = geoAnalysisProximitySearch.getValue();
    let selections = viewerContextData.getProximityManager().getCurrentViewerSelections();
    if( Array.isArray( selections ) && selections.length > 0 ) {
        const propsToBeLoaded = [ 'Name', 'ID', 'Revision', 'Thumbnail' ];
        tcVmoService.getViewModelProperties( selections, propsToBeLoaded );
        var currentTargetList = proximityCtx.targetList;
        if( currentTargetList === undefined ) {
            currentTargetList = [];
        }
        var newSelections = _.difference( selections, currentTargetList );
        for( var i = 0; i < newSelections.length; i++ ) {
            var sel = newSelections[ i ];
            currentTargetList.push( sel );
            var csIds = viewerContextData.getProximityManager().getCurrentViewerSelectionCsIds();
            var csIdIdx = _.findIndex( selections, function( viewerSel ) { return viewerSel.uid === sel.uid; } );
            _csidToMOPairs.push( { csId: csIds[ csIdIdx ], modelObj: sel } );
        }

        _updateCtxWithTargets( currentTargetList, geoAnalysisProximitySearch, occmgmtContext );
    }
};

/**
 * Remove all proximity targets
 * @param {object} geoAnalysisProximitySearch proximity atomic data
 * @param {Object} occmgmtContext occmgmt context
 */
export let removeAllProximityTargets = function( geoAnalysisProximitySearch, occmgmtContext ) {
    _updateCtxWithTargets( [], geoAnalysisProximitySearch, occmgmtContext );
    _csidToMOPairs = [];
};

/**
 * remove specific target
 * @param {object} target this contains target value
 * @param {object} geoAnalysisProximitySearch this contains value of fields i.e proximity atomic data from itemOptions
 * @param {Object} occmgmtContext occmgmt context
 */
export let removeProximityTarget = function( target, geoAnalysisProximitySearch, occmgmtContext ) {
    let proximityCtx = geoAnalysisProximitySearch.getValue();
    let currentTargetList = proximityCtx.targetList;
    _.remove( currentTargetList, {
        uid: target.uid
    } );

    _.remove( _csidToMOPairs, function( obj ) { return obj.modelObj.uid === target.uid; } );
    _updateCtxWithTargets( currentTargetList, geoAnalysisProximitySearch, occmgmtContext );
};

/**
 * this method is to execute proximity search
 * @param {Double} input targetRange dbValue
 * @param {Object} geoAnalysisProximitySearch proximity atomic data
 * @param {Object} viewerContextData viewer context data
 */
export let executeProximitySearch = function( input, geoAnalysisProximitySearch, viewerContextData ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.Proximity );
    }


    viewerContextData.getProximityManager().executeProximitySearchInDistance( input, geoAnalysisProximitySearch )

        .then( function() {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.stopViewerPerformanceDataCapture( 'Proximity Search Completed : ' );
                viewerPerformanceService.setViewerPerformanceMode( false );
            } else {
                logger.info( 'Proximity Search Completed' );
            }
        }, function( failure ) {
            logger.error( failure );
        } );
};

/**
 * this method is to get CSID for selected object using SOA call
 * @param {object} productContextInfo PCI
 * @param {object} selectedObjects modelobject
 * @returns {Object} Returns the response of getPackedOccurrenceCSIDs
 */

var _getCloneStableIDsWithPackedOccurrences = function( productContextInfo, selectedObjects ) {
    var fetchPackedOccurrences = false;
    var packingInUse = productContextInfo.props.awb0PackSimilarElements.dbValues[ 0 ];
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

export default exports = {
    getAllTargets,
    proximityPanelRevealed,
    addSelectionsToTargetList,
    removeAllProximityTargets,
    removeProximityTarget,
    executeProximitySearch,
    notifyProximityPanelClosed
};
