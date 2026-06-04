// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global define */

/* eslint-disable class-methods-use-this */

/**
 * This service is create selection handler for hosted vis
 *
 * @module js/hostVisViewerVisibilityHandler
 */
import appCtxService from 'js/appCtxService';
import aceObjectToCSIDGeneratorService from 'js/aceObjectToCSIDGeneratorService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import aceObjectsToPackedOccurrenceCSIDsService from 'js/aceObjectsToPackedOccurrenceCSIDsService';
import HostVisViewerVisibilityManager from 'js/hostVisViewerVisibilityManagerProvider';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import StructureViewerService from 'js/structureViewerService';
import AwIntervalService from 'js/awIntervalService';

const CSID_CHAIN = 'CSID_CHAIN';

/**
 * Class to hold the hosted viewer visibility data
 */
export default class hostVisViewerVisibilityHandler {
    /**
     * hostVisViewerVisibilityHandler constructor
     */
    constructor() {
        this._hostVisMgr = new HostVisViewerVisibilityManager();
        this._updateVisibilityFromViewerInProgress = false;
    }

    /**
     * Inittialize host vis manager
     */
    initialize() {
        this._hostVisMgr.initializeHostVisVisibilityManager();
        this.setupHostVisVisibilityChangedListener();
    }

    reRegisterVisibilityEventsToAce() {
        VisOccmgmtCommunicationService.instance.registerVisibilityEventsToAce( this.getOccMgMtContextKey(), 'hostVisViewerData' );
    }

    /**
     * Sets up visibility listener for visibility changes in tcVis
     */
    setupHostVisVisibilityChangedListener() {
        let self = this;
        let registerVisibilityEventsToAce = AwIntervalService.instance( () => {
            if( self._hostVisMgr.getAceActiveCtx() ) {
                VisOccmgmtCommunicationService.instance.registerVisibilityEventsToAce( self.getOccMgMtContextKey(), 'hostVisViewerData' );
                AwIntervalService.instance.cancel( registerVisibilityEventsToAce );
            }
        }, 1000 );
        let tcVisVisibilityChangedListener = function( visibilityData ) {
            this._updateVisibilityFromViewerInProgress = true;
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToObservers( visibilityData );
            let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
            let occmgmtContextKey = occmgmtActiveContext && occmgmtActiveContext.key ? occmgmtActiveContext.key : 'occmgmtContext';
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtContextKey, 'hostVisViewerData' );
        }.bind( this );
        this._hostVisMgr.addViewerVisibilityChangedListener( tcVisVisibilityChangedListener.bind( this ) );
    }

    /**
     * Get visibility of occurrence in viewer
     *
     * @param {ViewModelObject} vmo a view model object to get visibility
     * @return {Boolean} visibility of occurence
     */
    internalGetOccVisibility( object, objectType ) {
        if( object && object.modelType && _.includes( object.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
            const visibility = this._hostVisMgr.getPartitionVisibility( StructureViewerService.instance.computePartitionChain( object ) );
            return !( visibility === this._hostVisMgr.VISIBILITY.PARTIAL ||
                visibility === this._hostVisMgr.VISIBILITY.INVISIBLE );
        }
        return this.getOccVisibility( object, objectType );
    }

    /**
     * Clean viewer visibility listeners
     *
     * @param {Object} eventData visibility event data
     */
    internalToggleOccVisibility( eventData ) {
        let vmo = eventData.vmo || eventData.object;
        if( vmo && vmo.modelType && _.includes( vmo.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
            this._hostVisMgr.togglePartitionPartVisibility( StructureViewerService.instance.computePartitionChain( vmo ) );
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( this.getOccMgMtContextKey(), 'hostVisViewerData' );
        } else {
            this.toggleOccVisibility( vmo, eventData.objectType );
        }
    }

    /**
     * Toggles occurence visibility
     * @param {Object} vmo view model object
     * @param {string} objectType if object is a View Model Object then object type, if CSID Chain object then 'CSID_CHAIN'
     */
    toggleOccVisibility( vmo, objectType ) {
        if( objectType !== CSID_CHAIN ) {
            var csid = aceObjectToCSIDGeneratorService.getCloneStableIdChain( vmo );
            if( csid === '/' ) {
                csid = '';
            }
            var selectedObjects = [ vmo ];
            //Getting packed occurences from selected object if any and applying master visibility to all found packed occurences.
            this.getCloneStableIDsWithPackedOccurrences( selectedObjects ).then( function( response ) {
                if( response && response.csids && response.csids.length > 0 ) {
                    var masterVisibility = !this.getOccVisibility( vmo );
                    if( !response.csids.includes( csid ) ) {
                        response.csids.push( csid );
                    }
                    response.csids.forEach( function( item ) {
                        this._hostVisMgr.setPackedPartsVisibility( item, masterVisibility );
                    }.bind( this ) );
                } else {
                    this._hostVisMgr.toggleProductViewerVisibility( csid );
                }
                VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( this.getOccMgMtContextKey(), 'hostVisViewerData' );
            }.bind( this ) );
        } else if( vmo && Array.isArray( vmo.csids ) && vmo.csids.length > 0 ) {
            let csids = vmo.csids;
            const aceContext = this._hostVisMgr.getAceActiveCtx();
            const isInside3D = aceContext?.currentState?.altPwa === 'Awv0StructureViewerPageContainer' || aceContext?.currentState?.altPwa_2 === 'Awv0StructureViewerPageContainer';
            this._hostVisMgr.setPartsVisibility( csids, [], vmo.isVisible, false, null, !isInside3D );
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( this.getOccMgMtContextKey(), 'hostVisViewerData' );
        }
    }

    /**
     * Gets occurence visibility state
     * @param {Object} vmo view model object of occurence
     * @returns {Boolean} visible or not
     */
    getOccVisibility( object, objectType ) {
        var csid = objectType === CSID_CHAIN ? object : aceObjectToCSIDGeneratorService.getCloneStableIdChain( object );
        if( csid === '/' ) {
            csid = '';
        }
        var visibility = this._hostVisMgr.getProductViewerVisibility( csid );
        if( visibility === this._hostVisMgr.VISIBILITY.PARTIAL ||
            visibility === this._hostVisMgr.VISIBILITY.INVISIBLE ) {
            return false;
        }
        return true;
    }

    /**
     * Gets clone stable Ids with packed occurences
     * @param {Array} selectedObjects selected objects
     * @returns {Promise} promise resolved when function return CSIDs
     */
    getCloneStableIDsWithPackedOccurrences( selectedObjects ) {
        let occmgmtContext = this._hostVisMgr.getAceActiveCtx();
        let currentProductCtx = occmgmtContext.productContextInfo;
        let packedOccPromise = aceObjectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( currentProductCtx, selectedObjects );
        if( !_.isUndefined( packedOccPromise ) ) {
            return packedOccPromise;
        }
        return AwPromiseService.instance.resolve();
    }

    /**
     * handle visibility changes from other Apps
     * @param {Object} visibilityData visibility data from other apps
     */
    internalHandleVisibilityChanges( visibilityData ) {
        if( this._updateVisibilityFromViewerInProgress ) {
            this._updateVisibilityFromViewerInProgress = false;
            return;
        }
        let visibilityDataCache = {
            invisibleCsids: visibilityData.invisibleCsids,
            invisibleExceptionCsids: visibilityData.invisibleExceptionCsids,
            invisiblePartitionIds: visibilityData.invisiblePartitionIds,
            invisibleExceptionPartitionIds: visibilityData.invisibleExceptionPartitionIds
        };
        this._hostVisMgr.setPartsVisibility( visibilityData.occurrencesFromViewer, [], visibilityData.visibilityToSet, visibilityData.isStateChange, visibilityDataCache );
    }

    /**
     * Get active occmgmt ctx key
     * @returns {String} Occurence management context key
     */
    getOccMgMtContextKey() {
        let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
        return occmgmtActiveContext && occmgmtActiveContext.key ? occmgmtActiveContext.key : 'occmgmtContext';
    }

    /**
     * get visibility state
     * @returns {Object} visibility state
     */
    getVisibilityState() {
        return Object.create( {
            invisibleCsids: this._hostVisMgr.invisibleCsids ? Object.values( this._hostVisMgr.invisibleCsids ) : [],
            invisibleExceptionCsids: this._hostVisMgr.invisibleExceptionCsids ? Object.values( this._hostVisMgr.invisibleExceptionCsids ) : [],
            invisiblePartitionIds: this._hostVisMgr.invisiblePartitionIds ? Object.values( this._hostVisMgr.invisiblePartitionIds ) : [],
            invisibleExceptionPartitionIds: this._hostVisMgr.invisibleExceptionPartitionIds ? Object.values( this._hostVisMgr.invisibleExceptionPartitionIds ) : []
        } );
    }

    /**
     * Restore visibility state
     * @param {Object} visibilityStateToBeApplied visibility state from other viewer
     */
    restoreViewerVisibility( visibilityStateToBeApplied ) {
        this._hostVisMgr.restoreViewerVisibility( visibilityStateToBeApplied.invisibleCsids, visibilityStateToBeApplied.invisibleExceptionCsids,
            visibilityStateToBeApplied.invisiblePartitionIds, visibilityStateToBeApplied.invisibleExceptionPartitionIds
        );
    }

    /**
     * clean up
     */
    cleanUp() {
        VisOccmgmtCommunicationService.instance.deregisterVisibilityEventsToAce( this.getOccMgMtContextKey() );
    }

    /**
     * clear visibility cache
     */
    clearVisibility() {
        this._hostVisMgr.clearVisibility();
    }
}
