// Copyright (c) 2022 Siemens

/* eslint-disable class-methods-use-this */

/**
 * This class is a mediator between AW and various viewer
 *
 * @module js/visOccmgmtCommunicationService
 */
import AwBaseService from 'js/awBaseService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';

export const packUnpackEventType = {
    0: 'Pack',
    1: 'Unpack'
};

export const packUnpackAllEventType = {
    1: 'PackAll',
    0: 'UnpackAll'
};

export default class VisOccmgmtCommunicationService extends AwBaseService {
    /**
     * Constructor of VisOccmgmtCommunicationService
     */
    constructor() {
        super();
        this.observers = [];
        this.eventsToListen = [
            'ace.elementsRemoved',
            'replaceElement.elementReplacedSuccessfully',
            'primaryWorkArea.contentsReloaded',
            'occurrenceUpdatedByEffectivityEvent',
            'primaryWorkArea.selectionChangeEvent',
            'perform.packAllSimilarElements',
            'postProcessPackUnpackAction',
            'cba.alignmentUpdated',
            'cdm.updated',
            'cdm.relatedModified',
            'addElement.elementsAdded',
            'productContextChangedEvent',
            'useIndexedModelSettingsChangedEvent',
            'ace.contentUpdated',
            'partitionMemberUpdatedEvent'
        ];
        this.eventSubscriptions = {};
        this.subscribeToEvents();
        this.activeVisibilityObserver = null;
        this.aceVisibilitySubscription = [];
        this.cachedPWAContentsReloadedEventData = null;
        this.hostPackUnpackEventSkipSelectionProcessing = false;
    }

    /**
     * Subscribes to visOccmgmtCommunicationService
     * @param {Object} observer who wants to subscribe
     */
    subscribe( observer ) {
        if( !_.includes( this.observers, observer ) ) {
            this.observers.push( observer );
        }
    }

    /**
     * Unsubscribes to visOccmgmtCommunicationService
     * @param {Object} observer who wants to unsubscribe
     */
    unsubscribe( observer ) {
        this.observers = this.observers.filter(
            function( existingObs ) {
                if( existingObs !== observer ) {
                    return existingObs;
                }
            }
        );
        if( this.observers.length === 0 ) {
            this.activeVisibilityObserver = null;
        }
    }

    /**
     * Subscribes to list of events
     */
    subscribeToEvents() {
        let self = this;
        for( let i = 0; i < self.eventsToListen.length; i++ ) {
            let eventSub = eventBus.subscribe( self.eventsToListen[ i ], self.getEventHandler( self.eventsToListen[ i ] ), 'VisOccmgmtCommunicationService' );
            self.eventSubscriptions[ self.eventsToListen[ i ] ] = eventSub;
        }
    }

    /**
     * Gets event handler to be subscribe for event passed
     * @param {String} event type of event
     * @returns {Function} call back function
     */
    getEventHandler( event ) {
        if( event === 'ace.elementsRemoved' ) {
            return this.deltaUpdateEventHandlerSkipContext;
        } else if( event === 'replaceElement.elementReplacedSuccessfully' ) {
            return this.deltaUpdateEventHandlerSkipContext;
        } else if( event === 'primaryWorkArea.contentsReloaded' ) {
            return this.primaryWorkAreaContentsReloadedEventHandler;
        } else if( event === 'occurrenceUpdatedByEffectivityEvent' ) {
            return this.deltaUpdateEventHandler;
        } else if( event === 'primaryWorkArea.selectionChangeEvent' ) {
            return this.selectionChangedEventHandler;
        } else if( event === 'perform.packAllSimilarElements' ) {
            return this.packUnpackAllEventHandler;
        } else if( event === 'postProcessPackUnpackAction' ) {
            return this.packUnpackEventHandler;
        } else if( event === 'cba.alignmentUpdated' ) {
            return this.deltaUpdateEventHandler;
        } else if( event === 'cdm.updated' ) {
            return this.cdmUpdatedEventHandler;
        } else if( event === 'cdm.relatedModified' ) {
            return this.cdmRelatedModifiedEventHandler;
        } else if( event === 'addElement.elementsAdded' ) {
            return this.deltaUpdateEventHandlerSkipContext;
        } else if( event === 'productContextChangedEvent' ) {
            return this.productContextChangedEventHandler;
        } else if( event === 'editGrp.applyGroupEffectivity' ) {
            return this.deltaUpdateEventHandler;
        } else if( event === 'useIndexedModelSettingsChangedEvent' ) {
            return this.useIndexedModelSettingsChangedEventHandler;
        } else if( event === 'ace.contentUpdated' ) { //In Tc2412 published for revise bomline action
            return this.deltaUpdateEventHandlerSkipContext;
        } else if( event === 'partitionMemberUpdatedEvent' ) {
            return this.deltaUpdateEventHandler;
        }
    }

    /**
     * Handle Product Context Changed event
     * @param {Object} eventData event data
     */
    productContextChangedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleProductContextChangedEvent', VisOccmgmtCommunicationService.instance.processEventData( eventData ) );
    }

    /**
     * Event handler for following events
     * @param {object} eventData event data
     */
    deltaUpdateEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleDeltaUpdateEvents', VisOccmgmtCommunicationService.instance.processEventData( eventData ) );
    }

    /**
     * Event handler for following events:
     * ace.elementsRemoved
     * replaceElement.elementReplacedSuccessfully
     * ace.contentUpdated
     * addElement.elementsAdded
     * @param {object} eventData event data
     */
    deltaUpdateEventHandlerSkipContext( eventData ) {
        let eventDataProcessed = VisOccmgmtCommunicationService.instance.processEventData( eventData );
        eventDataProcessed.skipContextCheck = true;
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleDeltaUpdateEvents', eventDataProcessed );
    }

    /**
     *  handleCdmUpdatedEvent event handler
     * @param {object} eventData event data
     */
    cdmUpdatedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleCdmUpdatedEvent', VisOccmgmtCommunicationService.instance.processEventData( eventData ) );
    }

    /**
     *  handleCdmRelatedModifiedEvent event handler
     * @param {object} eventData event data
     */
    cdmRelatedModifiedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleCdmRelatedModifiedEvent', VisOccmgmtCommunicationService.instance.processEventData( eventData ) );
    }

    /**
     * Adds skipDeltaUpdate flag to eventData if MBM sublocation
     * @param {Object} eventData event data
     * @returns {object} event data
     */
    processEventData( eventData ) {
        if( !eventData ) {
            eventData = {};
        }
        eventData.skipDeltaUpdate = eventData.skipDeltaUpdate !== undefined && eventData.skipDeltaUpdate !== null ? eventData.skipDeltaUpdate : this.isMBMSublocation();
        return eventData;
    }

    /**
     *  handleUseIndexedModelSettingsChangedEvent event handler
     * @param {object} eventData event data
     */
    useIndexedModelSettingsChangedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleUseIndexedModelSettingsChangedEvent', eventData );
    }

    /**
     * handlePrimaryWorkAreaContentsReloadedEvent event handler
     * @param {Object} eventData event data
     */
    primaryWorkAreaContentsReloadedEventHandler( eventData ) {
        let occContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
        if( occContext !== null &&
            ( occContext.currentState.spageId !== null && occContext.currentState.spageId !== 'Awv0StructureViewerPageContainer' ||
                occContext.currentState.altPwa !== null && occContext.currentState.altPwa !== 'Awv0StructureViewerPageContainer' ||
                occContext.currentState.altPwa_2 !== null && occContext.currentState.altPwa_2 !== 'Awv0StructureViewerPageContainer' ) ) {
            VisOccmgmtCommunicationService.instance.cachedPWAContentsReloadedEventData = eventData;
        }
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handlePrimaryWorkAreaContentsReloadedEvent', VisOccmgmtCommunicationService.instance.processEventData( eventData ) );
    }

    /**
     * Data will be cached if a change happens while not on the 3D tab
     */

    getCachedPWAContentsReloadedEventData() {
        let retEventData = this.cachedPWAContentsReloadedEventData;
        this.cachedPWAContentsReloadedEventData = null;
        return retEventData;
    }

    /**
     * handleSelectionChangedEvent event handler
     * @param {Object} eventData event data
     */
    selectionChangedEventHandler( eventData ) {
        if( eventData && eventData.selectionModel ) {
            VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleSelectionChangedEvent', eventData );
        }
    }

    /**
     * Pack unpack event handler
     * @param {Object} eventData event data
     */
    packUnpackEventHandler( eventData ) {
        let eventType = packUnpackEventType[ eventData.packMode ];
        if( eventType ) {
            eventData.eventType = eventType;
            VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handlePackUnpackEvent', eventData );
        }
    }
    /**
     * Pack unpack all event handler
     * @param {Object} eventData event data
     */
    packUnpackAllEventHandler( eventData ) {
        let eventType = packUnpackAllEventType[ eventData.packAllMode ];
        if( eventType ) {
            eventData.eventType = eventType;
            VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handlePackUnpackEvent', eventData );
        }
    }

    /**
     * Gets occurence visibility for ACE tree from active visibility observer
     * @param {Object} object view model object
     * @param {Object} occmgmtActiveCtxKey active occmgmt key
     * @param {String} objectType object type, if csid object then 'CSID_CHAIN'
     * @returns {Boolean} true/false
     */
    getOccVisibilityHandler( object, occmgmtActiveCtxKey, objectType ) {
        _.forEach( VisOccmgmtCommunicationService.instance.observers, observer => {
            if( observer.occmgmtContextNameKey === occmgmtActiveCtxKey ) {
                VisOccmgmtCommunicationService.instance.activeVisibilityObserver = observer;
            }
        } );

        if( VisOccmgmtCommunicationService.instance.activeVisibilityObserver ) {
            return VisOccmgmtCommunicationService.instance.activeVisibilityObserver.handleGetOccVisibilty.call(
                VisOccmgmtCommunicationService.instance.activeVisibilityObserver, object, objectType );
        }
        return true;
    }

    /**
     * Toggles visibility of observers when visibility changed from ACE tree
     * @param {Object} object view model object
     * @param {String} occmgmtActiveCtxKey occmgmt context for which visibility is toggled
     * @param {String} objectType object type, if csid object then 'CSID_CHAIN'
     */
    toggleOccVisibilityHandler( object, occmgmtActiveCtxKey, objectType ) {
        let eventData = {
            object: object,
            contextKey: occmgmtActiveCtxKey
        };
        if( objectType ) {
            eventData.objectType = objectType;
        }

        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleToggleOccVisibility', eventData );
    }

    /**
     * Notifies visibility changes to observer
     * @param {Object} visibilityData visibility dat contains invisibleCsids, invisibleExceptionCsids, invisiblePartitionIds, isStateChange
     */
    notifyVisibilityChangesToObservers( visibilityData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleVisibilityChanges', visibilityData );
    }

    /**
     * Propagates Event changes to registered observers
     * @param {String} functionName name of function to be called from observer
     * @param {Object} eventData event data, passed to obeserver
     */
    propagateEventsToObservers( functionName, eventData ) {
        _.forEach( this.observers, observer => {
            // skip the souce observer which is firing the event
            if( typeof observer[ functionName ] === 'function' && ( !eventData || observer.viewerType !== eventData.viewerType ) ) {
                observer[ functionName ].call( observer, eventData );
            }
        } );
    }

    /**
     * Notifies selection changes to ACE tree
     * @param {Array} modelObjectsToSelect model objects to select
     * @param {String} viewToReact occmgmt context key passed to notify ACE to identity view to react
     */
    notifySelectionChangesToAce( modelObjectsToSelect, modelObjectsToHighlight, viewToReact ) {
        let aceSelectionUpdateEventData = {};
        aceSelectionUpdateEventData.objectsToSelect = modelObjectsToSelect;
        aceSelectionUpdateEventData.objectsToHighlight = modelObjectsToHighlight;
        aceSelectionUpdateEventData.viewToReact = viewToReact;
        eventBus.publish( 'aceElementsSelectionUpdatedEvent', aceSelectionUpdateEventData );
    }
    /**
     * Notifies pack unpack changes to ACE tree
     * @param {Array} modelObjectsToSelect model objects to select
     * @param {String} viewToReact occmgmt context key passed to notify ACE to identity view to react
     */

    notifyVisHostPackUnpackChanges( modelObjectsToSelect, objectsToHighlight, eventType, viewToReact ) {
        let acePackUnpackUpdateEventData = {
            objectsToSelect: modelObjectsToSelect,
            objectsToHighlight: objectsToHighlight,
            viewToReact: viewToReact
        };
        this.setHostPackUnpackEventSkipSelectionProcessing( true );
        switch ( eventType ) {
            case 'Pack':
                eventBus.publish( 'packEvent', acePackUnpackUpdateEventData );
                break;
            case 'Unpack':
                eventBus.publish( 'unPackEvent', acePackUnpackUpdateEventData );
                break;
            case 'PackAll':
                eventBus.publish( 'packAllEvent', acePackUnpackUpdateEventData );
                break;
            case 'UnpackAll':
                eventBus.publish( 'unPackAllEvent', acePackUnpackUpdateEventData );
                break;
            default:
                break;
        }
    }
    /**
     * Notifies visibility changes to ACE tree from registered viewer
     * @param {String} viewToReact occmgmt context key passed to notify ACE to identity view to react
     * @param {String} viewerType to set active visibility obseerver to whom ACE tree will ask for visibility state
     */
    notifyVisibilityChangesToAce( viewToReact, viewerType ) {
        let self = this;
        self.activeVisibilityObserver = this.observers.find( observer => { return observer.getViewerType() === viewerType; } );

        let aceVisibilityUpdateEventData = {};
        aceVisibilityUpdateEventData.viewToReact = viewToReact;
        //We need to fire this event to ensure the cell thumbnail titles are activated.
        eventBus.publish( 'occMgmt.visibilityStateChanged', aceVisibilityUpdateEventData );
    }

    /**
     * Registers functions to ACE tree visibility change if not registered for occmgmt context
     * @param {String} occmgmtContextNameKey occmgmt context key
     * @param {String} viewerType type of viewer registering
     */
    registerVisibilityEventsToAce( occmgmtContextNameKey, viewerType ) {
        let occmgmtContext = appCtxService.getCtx( occmgmtContextNameKey );
        occmgmtContext.cellVisibility = {};

        // object - This can be vmo or CSID
        // objectType - can be CSIDChain object or undefined on object is vmo
        occmgmtContext.cellVisibility.getOccVisibility = ( object, objectType ) => {
            return this.getOccVisibilityHandler( object, occmgmtContextNameKey, objectType );
        };

        // object - This can be vmo or CSID object {csids:[], visibility:boolean}
        // objectType - can be CSIDChain object or undefined on object is vmo
        occmgmtContext.cellVisibility.toggleOccVisibility = ( object, objectType ) => {
            this.toggleOccVisibilityHandler( object, occmgmtContextNameKey, objectType );
        };
        this.notifyVisibilityChangesToAce( occmgmtContextNameKey, viewerType );
        if( !this.aceVisibilitySubscription.includes( occmgmtContextNameKey ) ) {
            this.aceVisibilitySubscription.push( occmgmtContextNameKey );
            this.deregisterAfterLocationChange();
        }
    }

    deregisterAfterLocationChange() {
        let listenForsublocationChangeToDeregister = eventBus.subscribe( 'appCtx.update', function() {
            let locationContext = appCtxService.getCtx( 'locationContext' );
            if( locationContext && locationContext[ 'ActiveWorkspace:Location' ] !== 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.cba.CADBOMAlignment:CBASublocation' &&
                !VisOccmgmtCommunicationService.instance.isMBMSublocation() &&
                !VisOccmgmtCommunicationService.instance.isNGPLocation() &&
                !VisOccmgmtCommunicationService.instance.isEasyPlanLocation() ) {
                eventBus.unsubscribe( listenForsublocationChangeToDeregister );
                this.aceVisibilitySubscription.forEach( function( occmgmtContextNameKey ) {
                    appCtxService.updatePartialCtx( occmgmtContextNameKey + '.cellVisibility', {} );
                    this.notifyVisibilityChangesToAce( occmgmtContextNameKey );
                }.bind( this ) );
                this.aceVisibilitySubscription.length = 0;
                VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'cleanUpViewerHandler', null );
                this.registerAfterLocationChange();
            }
        }.bind( this ) );
    }

    registerAfterLocationChange() {
        let listenForsublocationChangeToRegister = eventBus.subscribe( 'appCtx.update', function() {
            let locationContext = appCtxService.getCtx( 'locationContext' );
            if( locationContext && locationContext[ 'ActiveWorkspace:Location' ] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' || VisOccmgmtCommunicationService.instance.isMBMSublocation() ||
                VisOccmgmtCommunicationService.instance.isNGPLocation() ||
                VisOccmgmtCommunicationService.instance.isEasyPlanLocation() ) {
                eventBus.unsubscribe( listenForsublocationChangeToRegister );
                VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'initializeHostVisViewerDataHandler', null );
            }
        } );
    }

    /**
     * Check active workspace location is mbm/GlobalMbom or not
     *  @returns  {boolean} for location context
     */
    isMBMSublocation() {
        const integratedEbomLocation = [ 'plantBomManager', 'splitGlobalMbom', 'splitPlantBom' ];
        let locationContext = appCtxService.getCtx( 'locationContext' );
        if( locationContext && locationContext[ 'ActiveWorkspace:Location' ] === 'easyplan' && ( locationContext[ 'ActiveWorkspace:SubLocation' ] === 'multiBOMManager:mbomContextSublocation' ||
                locationContext[ 'ActiveWorkspace:SubLocation' ] === 'multiBOMManager:ebomContextSublocation' ||
                integratedEbomLocation.includes( locationContext[ 'ActiveWorkspace:SubLocation' ] ) ) ) {
            return true;
        }
        return false;
    }

    /**
     * Checks if the current location is an EasyPlan location.
     * @returns {boolean} True if the current location is an EasyPlan location, false otherwise.
     */
    isEasyPlanLocation() {
        const subLocations = [ 'assemblyPlanning', 'backgroundParts', 'workInstructions', 'functionalPlan' ];
        let locationContext = appCtxService.getCtx( 'locationContext' );
        return locationContext && locationContext[ 'ActiveWorkspace:Location' ] === 'easyplan' &&
            subLocations.includes( locationContext[ 'ActiveWorkspace:SubLocation' ] );
    }

    /**
     * Checks if the current location is an NGP location.
     * @returns {boolean} True if the current location is an NGP location, false otherwise.
     */
    isNGPLocation() {
        const occContext = appCtxService.getCtx( 'occmgmtContext' );
        return occContext && occContext.viewerLocation === 'NGP';
    }

    /**
     * Deregisters visibility events to ACE and disable visibility thumbnails from ACE tree
     * @param {Object} occmgmtContextNameKey occmgmt context name key
     * @param {Object} subPanelContext Sub panel context
     */
    deregisterVisibilityEventsToAce( occmgmtContextNameKey, subPanelContext ) {
        //In flexible layouts, while switching from 2 Way layout to 3Way layout, components get destroyed.
        //In this interim stage, cleaning up of visibility state & its recalculation is taking place.
        //Is it a real destroy of view or if its interim stage, can be identified using viewTuple info.

        //viewTupleInfo as undefined covers non-IA case
        let viewTupleInfo = subPanelContext && subPanelContext.viewTuple && subPanelContext.viewTuple.getValue();
        if( ( !viewTupleInfo || viewTupleInfo.alternatePWA !== 'Awv0StructureViewerPageContainer' ) &&
            appCtxService.getCtx( occmgmtContextNameKey ) &&
            ( this.observers.length === 0 || appCtxService.getCtx( 'splitView.mode' ) ) ) {
            VisOccmgmtCommunicationService.instance.clearVisibilityListenerRegistrationFromAce( occmgmtContextNameKey );
        }
    }

    /**
     * Clear ACE tree visibility listeners
     * @param {Object} occmgmtContextNameKey occmgmt context name key
     */
    clearVisibilityListenerRegistrationFromAce( occmgmtContextNameKey ) {
        appCtxService.updatePartialCtx( occmgmtContextNameKey + '.cellVisibility', {} );
        this.notifyVisibilityChangesToAce( occmgmtContextNameKey );
        this.aceVisibilitySubscription = this.aceVisibilitySubscription.filter( key => key !== occmgmtContextNameKey );
    }

    /**
     * Gets visibility from first registered observer to pass on to other observer to be in sync
     * @returns {Object} visibility state contains invisibleCsids, invisibleExceptionCsids, invisiblePartitionIds
     */
    getVisibilityStateFromExistingObserver() {
        if( this.observers.length > 1 ) {
            return this.observers[ 0 ].getVisibilityState(); //return visibility of first registered observer
        }
        return null;
    }

    /**
     * Set flag to skip processing of slection while pack unpack
     * @param  {boolean} skipProcessing skip processing selection
     */
    setHostPackUnpackEventSkipSelectionProcessing( skipProcessing ) {
        this.hostPackUnpackEventSkipSelectionProcessing = skipProcessing;
    }

    /**
     * Get flag to skip processing of slection while pack unpack
     * @returns  {boolean} skip processing selection
     */
    getHostPackUnpackEventSkipSelectionProcessing() {
        return this.hostPackUnpackEventSkipSelectionProcessing;
    }
}
