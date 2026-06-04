// Copyright (c) 2022 Siemens

/**
 * This service is create viewer context data
 *
 * @module js/structureViewerVisibilityHandlerProvider
 */
import _ from 'lodash';
import assert from 'assert';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import StructureViewerService from 'js/structureViewerService';
import { TracelinkSelectionHandler } from 'js/tracelinkSelectionHandler';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import viewerPreferenceService from 'js/viewerPreference.service';

const VIEWER_TYPE_PREF = 'struct';
const CSID_CHAIN = 'CSID_CHAIN';

/**
 * Provides an instance of structure viewer selection handler
 *
 * @param {Object} viewerContextData viewer context data
 * @param {Function} csidToModelObjFn csid to model object function
 * @param {Function} sruidToModelObjFn sruid to model object function
 * @param {Function} modelObjToCsidFn model object to csid function
 * @param {Function} modelObjToPackedOccCsidsFn model object to packed node csids function
 * @param {Function} getBackingObjectFn backing object provider function
 * @param {Object} viewPartitionDataHanlder partition data handler
 *
 * @return {StructureViewerVisibilityHandler} Returns viewer selection manager
 */
export let getStructureViewerVisibilityHandler = function( viewerContextData, csidToModelObjFn, sruidToModelObjFn, modelObjToCsidFn, modelObjToPackedOccCsidsFn, getBackingObjectFn,
    viewPartitionDataHanlder ) {
    let visibilityHandler = null;
    if( TracelinkSelectionHandler.instance.isRootSelectionTracelinkType() ) {
        visibilityHandler = TracelinkSelectionHandler.instance.createVisibilityHandler( new StructureViewerVisibilityHandler(
            viewerContextData, csidToModelObjFn, sruidToModelObjFn, modelObjToCsidFn, modelObjToPackedOccCsidsFn ),
        viewerContextData );
    } else {
        visibilityHandler = new StructureViewerVisibilityHandler(
            viewerContextData, csidToModelObjFn, sruidToModelObjFn, modelObjToCsidFn, modelObjToPackedOccCsidsFn, getBackingObjectFn, viewPartitionDataHanlder );
    }
    return visibilityHandler;
};

/**
 * Class to hold the structure viewer visibility data
 */
export class StructureViewerVisibilityHandler {
    /**
     * Constructor for StructureViewerVisibilityHandler
     *
     * @param {Object} viewerContextData viewer context data
     * @param {Function} csidToModelObjFn csid to model object function
     * @param {Function} sruidToModelObjFn sruid to model object function
     * @param {Function} modelObjToCsidFn model object to csid function
     * @param {Function} modelObjToPackedOccCsidsFn model object to packed node csids function
     * @param {Function} getBackingObjectFn backing object provider function
     * @param {Object} viewPartitionDataHanlder partition data handler
     */
    constructor( viewerContextData, csidToModelObjFn, sruidToModelObjFn, modelObjToCsidFn, modelObjToPackedOccCsidsFn, getBackingObjectFn, viewPartitionDataHanlder ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerCtxData = viewerContextData;
        this.csidToModelObjFn = csidToModelObjFn;
        this.sruidToModelObjFn = sruidToModelObjFn;
        this.modelObjToCsidFn = modelObjToCsidFn;
        this.modelObjToPackedOccCsidsFn = modelObjToPackedOccCsidsFn;
        this.isViewerVisibilityListenerAttached = false;
        this.updateVisibilityFromViewerInProgress = false;
        this.getBackingObjectFn = getBackingObjectFn;
        this.viewPartitionDataHanlder = viewPartitionDataHanlder;
    }

    /**
     * Register the viewer listener
     * @param {String} occmgmtContextNameKey occmgmt context key
     */
    registerForVisibilityEvents( occmgmtContextNameKey ) {
        if( !this.isViewerVisibilityListenerAttached ) {
            VisOccmgmtCommunicationService.instance.registerVisibilityEventsToAce( occmgmtContextNameKey, VIEWER_TYPE_PREF + occmgmtContextNameKey );
            this.viewerCtxData.getVisibilityManager().addViewerVisibilityChangedListener( this.viewerVisibilityChangedListener.bind( this ) );
            this.isViewerVisibilityListenerAttached = true;
        }
    }

    /**
     * Get visibility of occurrence in viewer
     *
     * @param {Object} object view model object or CSID Chain object
     * @param {string} objectType if object is a View Model Object then object type, if CSID Chain object then 'CSID_CHAIN'
     * @returns {Boolean} boolean indicating of part is visible or not
     */
    internalGetOccVisibility( object, objectType ) {
        if( object && object.modelType && _.includes( object.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
            const visibility = this.viewerCtxData.getVisibilityManager().getPartitionVisibility( StructureViewerService.instance.computePartitionChain( object ) );
            return !( visibility === this.viewerCtxData.getVisibilityManager().VISIBILITY.PARTIAL ||
                visibility === this.viewerCtxData.getVisibilityManager().VISIBILITY.INVISIBLE );
        }
        return this.getOccVisibility( object, objectType );
    }

    /**
     * Clean viewer visibility listeners
     *
     * @param {object} eventData event data
     */
    internalToggleOccVisibility( eventData ) {
        if( eventData.object && eventData.object.modelType && _.includes( eventData.object.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
            let betaPrefValues = viewerPreferenceService.getViewerBetaPref();
            if( _.includes( betaPrefValues, 'enableServerless' ) ) {
                const visibilityToSet = !this.internalGetOccVisibility( eventData.object );
                this.viewerCtxData.getVisibilityManager().togglePartitionPartVisibility( StructureViewerService.instance.computePartitionChain( eventData.object ) );
                this.viewPartitionDataHanlder.getAllPartitionsMembersUnderGivenPartitionLines( this.getBackingObjectFn( [ eventData.object ] ) ).then( partitionsMemberList => {
                    this.togglePrtnMemberArrayVisibility( partitionsMemberList, visibilityToSet );
                } );
            } else {
                this.viewerCtxData.getVisibilityManager().togglePartitionPartVisibility( StructureViewerService.instance.computePartitionChain( eventData.object ) );
                let occmgmtActiveCtxKey = this.viewerCtxData.getOccmgmtContextKey();
                VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtActiveCtxKey, VIEWER_TYPE_PREF + occmgmtActiveCtxKey );
            }
        } else {
            this.toggleOccVisibility( eventData.object, eventData.objectType );
        }
    }

    /**
     * Viewer visibility changed listener
     * @param {Boolean} visibilityData visibility to set
     */
    viewerVisibilityChangedListener( visibilityData ) {
        this.updateVisibilityFromViewerInProgress = true;
        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
        const occmgmtActiveCtxKey = this.viewerCtxData.getOccmgmtContextKey();
        if( !appCtxService.getCtx( 'splitView.mode' ) && visibilityData ) {
            visibilityData.viewerType = VIEWER_TYPE_PREF + occmgmtActiveCtxKey;
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToObservers( visibilityData );
        }
        VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtActiveCtxKey, VIEWER_TYPE_PREF + occmgmtActiveCtxKey );
    }

    /**
     * handle visibility changes from other Apps
     * @param {Object} visibilityData visibility data from other apps
     */
    internalHandleVisibilityChanges( visibilityData ) {
        if( this.updateVisibilityFromViewerInProgress || !visibilityData ) {
            this.updateVisibilityFromViewerInProgress = false;
            return;
        }
        let visibilityDataCache = {
            invisibleCsids: visibilityData.invisibleCsids,
            invisibleExceptionCsids: visibilityData.invisibleExceptionCsids,
            invisiblePartitionIds: visibilityData.invisiblePartitionIds,
            invisibleExceptionPartitionIds: visibilityData.invisibleExceptionPartitionIds
        };
        if( visibilityData.isStateChange ) {
            this.viewerCtxData.getVisibilityManager().setVisibleState( visibilityData.occurrencesFromViewer, [], false, visibilityDataCache );
        } else {
            this.viewerCtxData.getVisibilityManager().setPartsVisibility( visibilityData.occurrencesFromViewer, [], visibilityData.visibilityToSet, false, visibilityDataCache );
        }
    }

    /**
     * Gets visibility data from viewer
     * @returns {Object} visibilityData data
     */
    getVisibilityState() {
        const visibilityManager = this.viewerCtxData.getVisibilityManager();
        return Object.create( {
            invisibleCsids: visibilityManager.invisibleCsids ? Object.values( visibilityManager.invisibleCsids ) : [],
            invisibleExceptionCsids: visibilityManager.invisibleExceptionCsids ? Object.values( visibilityManager.invisibleExceptionCsids ) : [],
            invisiblePartitionIds: visibilityManager.invisiblePartitionIds ? Object.values( visibilityManager.invisiblePartitionIds ) : [],
            invisibleExceptionPartitionIds: visibilityManager.invisibleExceptionPartitionIds ? Object.values( visibilityManager.invisibleExceptionPartitionIds ) : []
        } );
    }

    /**
     * Toggle visibility of given vmo or CSID Chain
     * @param {Object} object view model object or CSID Chain object
     * @param {string} objectType if object is a View Model Object then object type, if CSID Chain object then 'CSID_CHAIN'
     */
    toggleOccVisibility( object, objectType ) { // VMO/ { [CSID] : true} , string - objectTYpe/CSIDCHain
        if( objectType !== CSID_CHAIN ) {
            let csid = this.modelObjToCsidFn( object );
            if( csid === '/' ) {
                csid = '';
            }
            const selectedObjects = [ object ];
            //Getting packed occurences from selected object if any and applying master visibility to all found packed occurences.
            this.getCloneStableIDsWithPackedOccurrences( selectedObjects ).then( response => {
                if( response && response.csids && response.csids.length > 0 ) {
                    var masterVisibility = !this.getOccVisibility( object );
                    response.csids.forEach( item => {
                        this.viewerCtxData.getVisibilityManager().setPackedPartsVisibility( item, masterVisibility );
                    } );
                } else {
                    this.viewerCtxData.getVisibilityManager().toggleProductViewerVisibility( csid );
                }
                StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
                let occmgmtActiveCtxKey = this.viewerCtxData.getOccmgmtContextKey();
                VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtActiveCtxKey, VIEWER_TYPE_PREF + occmgmtActiveCtxKey );
            } );
        } else if( object.csids && object.csids.length > 0 ) {
            let csids = object.csids;
            this.viewerCtxData.getVisibilityManager().setPartsVisibility( csids, [], object.isVisible, true );
            StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
            let occmgmtActiveCtxKey = this.viewerCtxData.getOccmgmtContextKey();
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtActiveCtxKey, VIEWER_TYPE_PREF + occmgmtActiveCtxKey );
        }
    }

    /**
     * Toggle visibility of given array of vmo
     * @param {Object} memberMOs view model object or CSID Chain object
     * @param {Object} visibilityToSet visibility to set
     */
    togglePrtnMemberArrayVisibility( memberMOs, visibilityToSet ) {
        let csidsArray = [];
        for( let i = 0; i < memberMOs.length; i++ ) {
            let csid = this.modelObjToCsidFn( memberMOs[ i ] );
            if( csid === '/' ) {
                csid = '';
            }
            csidsArray.push( csid );
        }
        const selectedObjects = [ ...memberMOs ];
        //Getting packed occurences from selected object if any and applying master visibility to all found packed occurences.
        this.getCloneStableIDsWithPackedOccurrences( selectedObjects ).then( response => {
            if( response && response.csids && response.csids.length > 0 ) {
                response.csids.forEach( item => {
                    this.viewerCtxData.getVisibilityManager().setPackedPartsVisibility( item, visibilityToSet );
                } );
            } else {
                this.viewerCtxData.getVisibilityManager().setPartsVisibility( csidsArray, null, visibilityToSet, true, null );
            }
            StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
            let occmgmtActiveCtxKey = this.viewerCtxData.getOccmgmtContextKey();
            VisOccmgmtCommunicationService.instance.notifyVisibilityChangesToAce( occmgmtActiveCtxKey, VIEWER_TYPE_PREF + occmgmtActiveCtxKey );
        } );
    }

    getOccVisibility( object, objectType ) {
        let csid = objectType === CSID_CHAIN ? object : this.modelObjToCsidFn( object );
        if( csid === '/' ) {
            csid = '';
        }
        const visibility = this.viewerCtxData.getVisibilityManager().getProductViewerVisibility( csid );
        return !( visibility === this.viewerCtxData.getVisibilityManager().VISIBILITY.PARTIAL ||
            visibility === this.viewerCtxData.getVisibilityManager().VISIBILITY.INVISIBLE );
    }

    getCloneStableIDsWithPackedOccurrences( selectedObjects ) {
        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext(
            this.viewerCtxData.getViewerCtxNamespace() );
        let currentProductCtx = occmgmtContext.productContextInfo;
        let packedOccPromise = this.modelObjToPackedOccCsidsFn( currentProductCtx, selectedObjects );
        if( !_.isUndefined( packedOccPromise ) ) {
            return packedOccPromise;
        }
        return AwPromiseService.instance.resolve();
    }

    /**
     * Clean viewer visibility listeners
     * @param {Object} occmgmtContextNameKey occmgmt context name key
     * @param {Object} subPanelContext Sub panel context
     */
    cleanUp( occmgmtContextNameKey, subPanelContext ) {
        if( this.isViewerVisibilityListenerAttached ) {
            this.isViewerVisibilityListenerAttached = false;
            VisOccmgmtCommunicationService.instance.deregisterVisibilityEventsToAce( occmgmtContextNameKey, subPanelContext );
        }

        if( this.viewerCtxData && this.viewerCtxData.getVisibilityManager() ) {
            this.viewerCtxData.getVisibilityManager().removeViewerVisibilityChangedListener(
                this.viewerVisibilityChangedListener );
        }
    }
}

export default {
    getStructureViewerVisibilityHandler,
    StructureViewerVisibilityHandler
};
