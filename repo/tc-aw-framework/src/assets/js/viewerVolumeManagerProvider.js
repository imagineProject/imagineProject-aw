// Copyright (c) 2021 Siemens

/* global JSCom */

/**
 * This Volume service provider
 *
 * @module js/viewerVolumeManagerProvider
 */

import _ from 'lodash';
import assert from 'assert';
import AwPromiseService from 'js/awPromiseService';
import viewerSelMgrProvider from 'js/viewerSelectionManagerProvider';
import '@swf/ClientViewer';
import viewerContextService from 'js/viewerContext.service';

/**
  * Provides an instance of viewer Volume manager
  *

  * @param {Object} viewerView Viewer view
  * @param {Object} viewerContextData Viewer Context data
  *
  * @return {ViewerVolumeManager} Returns viewer Volume manager
  */
let getVolumeManager = function(  viewerView, viewerContextData ) {
    return new ViewerVolumeManager( viewerView, viewerContextData );
};

const GEOANALYSIS_VIEWER_VOLUME = 'geoAnalysisVolumeSearch'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_TARGETLIST = 'targetList'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH = 'targetListLength'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_USED_PCUID = 'usedProductContextUid'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS = 'targetListPkdCsids'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_TARGET_CSID_LIST = 'targetCsidList'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST = 'newTargetForList';//$NON-NLS-1$
const GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS = 'csidToMOPairs';//$NON-NLS-1$


/**
  * Class to hold the viewer Volume data
  *
  * @constructor viewerVolumeManager
  *
  * @param {Object} viewerView Viewer view
  * @param {Object} viewerContextData Viewer Context data
  */
class ViewerVolumeManager {
    /**
      * ViewerVolumeManager class constructor
      *
      * @constructor ViewerVolumeManager
      *
      * @param {Object} viewerView Viewer view
      * @param {Object} viewerContextData Viewer Context data
      */
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.targetList = [];
        this.targetListLength = '';
        this.volumeState = null;
        this.setupVolumeCubeManipulatorAtomicDataTopics();
    }

    setupVolumeCubeManipulatorAtomicDataTopics( ) {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.CLEANUP_3D_VIEWER, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_CREATE_SECTION_BEGIN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_CREATE_MARKUP_BEGIN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_AREA_SELECT, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIS_SECTION_PLANE_TRANSLATE_MODE, this );
    }

    initialize( volumeState ) {
        this.setupAtomicDataTopicsOnPanelReveal();
        this.volumeState = volumeState;
    }

    /**
     * setupAtomicDataTopics ViewerMeasurementManager
     * @param {Object} volumeState volume atomic data
     */
    setupAtomicDataTopicsOnPanelReveal( ) {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerSelMgrProvider.SELECTED_CSID_KEY, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerSelMgrProvider.SELECTED_MODEL_OBJECT_KEY, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     */
    update( topic, data ) {
        if( topic === viewerSelMgrProvider.SELECTED_CSID_KEY || topic === viewerSelMgrProvider.SELECTED_MODEL_OBJECT_KEY ) {
            let newVolumeState = { ...this.volumeState.getValue() };
            newVolumeState.updateTargetList = !newVolumeState.updateTargetList;
            this.volumeState.update( { ...newVolumeState } );
        } else if ( topic === viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED ) {
            if( data && data.commandId !== 'Awv0ViewerSettings' && this.viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_VOLUME_SELECT ) === true ) {
                this.cancelVolumeCubeManipulator();
            }
        } else if ( ( topic === viewerContextService.VIEWER_CREATE_SECTION_BEGIN ||
            topic === viewerContextService.VIEWER_CREATE_MARKUP_BEGIN ||
            topic === this.viewerContextData.CLEANUP_3D_VIEWER ||
            topic === this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS ||
            topic === viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE ||
            topic === viewerContextService.VIEWER_AREA_SELECT ||
            topic === viewerContextService.VIS_SECTION_PLANE_TRANSLATE_MODE ) &&
            this.viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_VOLUME_SELECT ) === true ) {
            this.cancelVolumeCubeManipulator();
        }
    }

    /**
     * clean up on panel close
     */
    cleanUpVolumePanel() {
        this.unregisterAtomicDataTopics();
        this.volumeState = null;
    }

    /**
     * deregister for atomic data topics
     */
    unregisterAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( viewerSelMgrProvider.SELECTED_CSID_KEY, this );
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( viewerSelMgrProvider.SELECTED_MODEL_OBJECT_KEY, this );
    }

    /**
     * Register and unregester Box Size Change Event Notification
     * @param {Boolean } isEventRegistered true/false
     */
    registerUnregisterForDragAndDropVolumeGadget( isEventRegistered ) {
        this.updateVolumeDragAndDropCorners = function( value ) {
            let newVolumeState = { ...this.volumeState.getValue() };
            let minVals = value.min;
            let maxVals = value.max;
            newVolumeState.X1 = minVals[ 0 ];
            newVolumeState.Y1 = minVals[ 1 ];
            newVolumeState.Z1 = minVals[ 2 ];
            newVolumeState.X2 = maxVals[ 0 ];
            newVolumeState.Y2 = maxVals[ 1 ];
            newVolumeState.Z2 = maxVals[ 2 ];
            newVolumeState.toggleCornerVal = !newVolumeState.toggleCornerVal;
            newVolumeState.dragAndDropVolumeGadgetEvent = true;
            this.volumeState.update( { ...newVolumeState } );
        }.bind( this );
        if( isEventRegistered ) {
            this.viewerView.volumeMgr.registerBBoxSizeChangeEventNotification( this.updateVolumeDragAndDropCorners );
        }else{
            this.viewerView.volumeMgr.unregisterBBoxSizeChangeEventNotification();
            this.updateVolumeDragAndDropCorners = null;
        }
    }

    /**
     * compare target selection with current selection
     * @param {Object} occmgmtContext occmgmt context
     * @param {Object} volumeState local volume atomic data
     */
    comparetargetsWithSelections( occmgmtContext, volumeState ) {
        let targetList = [];
        let selectionList = [];
        let i = 0;

        let geoAnalysisVolumeSearchAtomicData = { ...volumeState.getValue() };

        if( geoAnalysisVolumeSearchAtomicData !== undefined && geoAnalysisVolumeSearchAtomicData.targetList !== undefined ) {
            for( ; i < geoAnalysisVolumeSearchAtomicData.targetList.length; i++ ) {
                targetList.push( geoAnalysisVolumeSearchAtomicData.targetList[ i ].uid );
            }
        }
        let occmgmtContextData = { ...occmgmtContext.getValue() };
        //Check current seelction
        var selections = this.getCurrentViewerSelections( );
        if( !Array.isArray( selections ) ) {
            geoAnalysisVolumeSearchAtomicData[GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST] = false;
            volumeState.update( { ...geoAnalysisVolumeSearchAtomicData } );
            occmgmtContextData.volumePanelNeedsUpdate = false;
            occmgmtContext.update( { ...occmgmtContextData } );
            return;
        }

        if( selections && Array.isArray( selections ) ) {
            for( const element of selections ) {
                selectionList.push( element.uid );
            }
        }

        var diff = _.difference( selectionList, targetList );

        if( diff.length === 0 ) {
            geoAnalysisVolumeSearchAtomicData[GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST] = false;
            occmgmtContextData.volumePanelNeedsUpdate = false;
        } else {
            geoAnalysisVolumeSearchAtomicData[GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST] = true;
            occmgmtContextData.volumePanelNeedsUpdate = true;
        }
        volumeState.update( { ...geoAnalysisVolumeSearchAtomicData } );
        occmgmtContext.update( { ...occmgmtContextData } );
    }

    /**
     * get current selected model object
     *
     * @returns {object} current selection model object
     */
    getCurrentViewerSelections(  ) {
        let viewerSelectionCSIDS = this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_CSID_KEY );
        if( _.isUndefined( viewerSelectionCSIDS ) || viewerSelectionCSIDS.length === 0 ) {
            return;
        }
        return this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_MODEL_OBJECT_KEY );
    }

    /**
      * Get target Occurrence list's clone stable UID chain for Volume
      * @param {Object} volumeState local volume atomic data
      * @return {String[]} clone stable UID chain list
      */
    static getVolumeTargetOccList( volumeState ) {
        let volumeStateValue = volumeState.getValue();
        let targetListPkdCsids = volumeStateValue[GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS];
        let occClsIdList = volumeStateValue[GEOANALYSIS_VIEWER_VOLUME_TARGET_CSID_LIST];

        // add packed ids as well
        if( targetListPkdCsids !== undefined && !_.isEmpty( targetListPkdCsids ) ) {
            for( var i = 0; i < targetListPkdCsids.length; i++ ) {
                occClsIdList.push( targetListPkdCsids[ i ] );
            }
        }

        return occClsIdList;
    }

    /**
     * Execute volume search - show only
     * @param {Array} cVs corner values
     * @param {Boolean} volumeBoundary boolean for boundary/intersecting
     * @returns {Object} promise
     */
    executeVolumeSearch( cVs, volumeBoundary ) {
        let deferred = AwPromiseService.instance.defer();
        let minVals = [ cVs[ 0 ], cVs[ 1 ], cVs[ 2 ] ];
        let maxVals = [ cVs[ 3 ], cVs[ 4 ], cVs[ 5 ] ];
        let valSetPromises = [];
        valSetPromises.push( this.viewerView.volumeMgr.setMin( minVals ) );
        valSetPromises.push( this.viewerView.volumeMgr.setMax( maxVals ) );
        valSetPromises.push( this.viewerView.volumeMgr.setCompletelyContained( volumeBoundary ) );

        return AwPromiseService.instance.all( valSetPromises ).then( () => {
            return this.viewerView.volumeMgr.execute().then( function() {
                //fetch and update the atomic data
                return deferred.resolve();
            } );
        } );
    }

    /**
     * Execute volume selection
     * @param {Object} cVs corner values
     * @param {Boolean} volumeBoundary boolean for boundary/intersecting
     * @returns {Object} promise
     */
    executeVolumeSelection( cVs, volumeBoundary ) {
        let deferred = AwPromiseService.instance.defer();
        let minVals = [ cVs[ 0 ], cVs[ 1 ], cVs[ 2 ] ];
        let maxVals = [ cVs[ 3 ], cVs[ 4 ], cVs[ 5 ] ];
        let valSetPromises = [];
        valSetPromises.push( this.viewerView.volumeMgr.setMin( minVals ) );
        valSetPromises.push( this.viewerView.volumeMgr.setMax( maxVals ) );
        valSetPromises.push( this.viewerView.volumeMgr.setCompletelyContained( volumeBoundary ) );

        return AwPromiseService.instance.all( valSetPromises ).then( () => {
            return this.viewerView.volumeMgr.executeSelection().then( function() {
                //fetch and update the atomic data
                return deferred.resolve();
            } );
        } );
    }

    /*
      * Gets corner values based on target occurrences
      *
      * @param {Object} promise promise that resolves to corner values
      */
    getCornerValuesFromOccListInCtx( volumeState ) {
        let deferred = AwPromiseService.instance.defer();
        let occObjList = [];
        let occList = ViewerVolumeManager.getVolumeTargetOccList( volumeState );
        let newVolumeState = { ...volumeState.getValue() };
        if( !occList || occList.length === 0 ) {
            newVolumeState.X1 = undefined;
            newVolumeState.Y1 = undefined;
            newVolumeState.Z1 = undefined;
            newVolumeState.X2 = undefined;
            newVolumeState.Y2 = undefined;
            newVolumeState.Z2 = undefined;
            volumeState.update( { ...newVolumeState } );
            deferred.resolve( volumeState );
        }else{
            for( var idx = 0; idx < occList.length; idx++ ) {
                occObjList.push( this.viewerContextData.getViewerCtxSvc().createViewerOccurance( occList[ idx ] ) );
            }
        }


        this.viewerView.volumeMgr.updateVolumeFromOccurrenceList( occObjList ).then( function() {
            var valGetPromises = [];
            valGetPromises.push( this.viewerView.volumeMgr.getMin() );
            valGetPromises.push( this.viewerView.volumeMgr.getMax() );
            return AwPromiseService.instance.all( valGetPromises ).then( function( args ) {
                var minVals = args[ 0 ];
                var maxVals = args[ 1 ];
                newVolumeState.X1 = minVals[ 0 ];
                newVolumeState.Y1 = minVals[ 1 ];
                newVolumeState.Z1 = minVals[ 2 ];
                newVolumeState.X2 = maxVals[ 0 ];
                newVolumeState.Y2 = maxVals[ 1 ];
                newVolumeState.Z2 = maxVals[ 2 ];
                volumeState.update( { ...newVolumeState } );
                deferred.resolve( volumeState );
            } );
        }.bind( this ) );
        return deferred.promise;
    }

    /**
      * Sets new state of Volume box
      *
      * @param {Boolean} isOn On/Off
      */
    setVolumeFilterOnNative( isOn ) {
        this.viewerView.volumeMgr.setVisibility( isOn );
    }

    /**
      * Enable volume select mode
      *
      * @param {Boolean} enable enable or disable volume select cube manipulator
      */
    enableVolumeCubeManipulator( enable ) {
        this.viewerView.volumeMgr.enableVolumeCubeManipulator( enable );
        if( enable ) {
            this.viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( this.cancelVolumeCubeManipulator.bind( this ) );
        } else {
            this.viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( null );
        }
    }

    /**
      * Cancel volume select operation if called before completion
      */
    cancelVolumeCubeManipulator() {
        if( this.viewerView.volumeMgr && _.isFunction( this.viewerView.volumeMgr.cancelVolumeCubeManipulator ) ) {
            this.viewerView.volumeMgr.cancelVolumeCubeManipulator();
        } else {
            this.viewerView.volumeMgr.enableVolumeCubeManipulator( false );//need it till jscom is updated with cancel API
        }
        this.viewerContextData.getViewerKeyboardMgr().setEscapeKeyFunction( null );
        this.viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_VOLUME_SELECT, false );
        if( viewerContextService.isNxGestureSettingEnabled( this.viewerContextData ) ) {
            viewerContextService.setNavigationMode( this.viewerContextData, 'AREA_SELECT' );
        }
    }

    /**
      * Sets new state of Volume box
      *
      * @param {Object} cornerVals corner values in form of coordinates
      * @param {Object} volumeState volume state
      *
      */
    drawVolumeBox( cornerVals, volumeState ) {
        var minVals = [ cornerVals.X1, cornerVals.Y1, cornerVals.Z1 ];
        var maxVals = [ cornerVals.X2, cornerVals.Y2, cornerVals.Z2 ];
        var valSetPromises = [];
        valSetPromises.push( this.viewerView.volumeMgr.setMin( minVals ) );
        valSetPromises.push( this.viewerView.volumeMgr.setMax( maxVals ) );

        AwPromiseService.instance.all( valSetPromises ).then( ()=> {
            this.viewerView.volumeMgr.setVisibility( true ).then( ()=> {
                let newVolumeState = { ...volumeState.getValue() };
                newVolumeState.X1 = cornerVals.X1;
                newVolumeState.Y1 = cornerVals.Y1;
                newVolumeState.Z1 = cornerVals.Z1;
                newVolumeState.X2 = cornerVals.X2;
                newVolumeState.Y2 = cornerVals.Y2;
                newVolumeState.Z2 = cornerVals.Z2;
                volumeState.update( { ...newVolumeState } );
            } );
        } );
    }
}

export default {
    GEOANALYSIS_VIEWER_VOLUME,
    GEOANALYSIS_VIEWER_VOLUME_TARGETLIST,
    GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_LENGTH,
    GEOANALYSIS_VIEWER_VOLUME_USED_PCUID,
    GEOANALYSIS_VIEWER_VOLUME_TARGETLIST_PKD_CSIDS,
    GEOANALYSIS_VIEWER_VOLUME_TARGET_CSID_LIST,
    GEOANALYSIS_VIEWER_VOLUME_NEW_TARGET_FOR_LIST,
    GEOANALYSIS_VIEWER_VOLUME_CSID_TO_MO_PAIRS,
    getVolumeManager
};
