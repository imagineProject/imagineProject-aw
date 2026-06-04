
// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */


/* eslint-disable class-methods-use-this */

/**
 * This module holds hosted viewer 3D data
 *
 * @module js/hostVisViewerData
 */
import _ from 'lodash';
import logger from 'js/logger';
import appCtxSvc from 'js/appCtxService';
import aceBackingObjectProviderSvc from 'js/aceBackingObjectProviderService';
import HostVisViewerSelectionHandler from 'js/hostVisViewerSelectionHandler';
import HostVisViewerVisibilityHandler from 'js/hostVisViewerVisibilityHandler';
import cdm from 'soa/kernel/clientDataModel';
import StructureViewerService from 'js/structureViewerService';
import aceObjectToCSIDGeneratorService from 'js/aceObjectToCSIDGeneratorService';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import hostVisQueryService from 'js/hostVisQueryService';
import viewerContextService from 'js/viewerContext.service';
import preferenceService from 'soa/preferenceService';
import AwPromiseService from 'js/awPromiseService';

export default class HostVisViewerData {
    /**
     * HostVisViewerData constructor
     */
    constructor() {
        this.hostVisViewerSelectionHandler = null;
        this.ROOT_ID = '';
        this.hostVisViewerSelectionListener = null;
        this.hostVisViewerVisibilityHandler = null;
        this.viewerType = 'hostVisViewerData';
        this.structureConfiguration = null;
        this.viewerContext = null;
        this.activePartitionSchemeUid = '';
        this.rootElementCsidChain = null;
        this.locationChanged = false;
    }

    /**
     * Initialize hosted viewer data.
     */
    initializeHostVisViewer() {
        VisOccmgmtCommunicationService.instance.subscribe( this );
        this.setupHostVisViewerSelectionHandler();
        this.setupHostVisViewerSelectionListener();
        this.setupHostVisViewerVisibilityHandler();
        this.setParametersAfterPCILoad();
        this.setupPackUnpackUpdateListner();
        VisOccmgmtCommunicationService.instance.deregisterAfterLocationChange();
    }

    /**
     * Validates if ST line is shared.
     * @param {Object} aceContext - The ACE context.
     * @returns {Promise<Boolean>} - A promise that resolves to a boolean indicating if the ST line is shared.
     */
    isSTLineInfoMatch( aceContext ) {
        if ( aceContext ) {
            return hostVisQueryService.getVisUsedSTLine().then( ( st_uid ) => {
                logger.debug( 'ST_UID', st_uid );
                let backingObject = null;

                /**Workset handling. awb0AlternateConfiguration is set when in Workset case, also AppSession of Workset */
                if ( ( StructureViewerService.instance.isViewerOpenedForWorkset( this.getOccMgmtContextKey() ) ||
                StructureViewerService.instance.isAppSessionOfFnd0Workset( this.getOccMgmtContextKey() ) ) &&
                    aceContext.productContextInfo &&
                    aceContext.productContextInfo.props &&
                    aceContext.productContextInfo.props.awb0AlternateConfiguration &&
                    aceContext.productContextInfo.props.awb0AlternateConfiguration.dbValues &&
                    aceContext.productContextInfo.props.awb0AlternateConfiguration.dbValues[0] !== ''
                ) {
                    let alternateConfiguration = aceContext.productContextInfo.props.awb0AlternateConfiguration.dbValues[0];
                    let worksetElement = cdm.getObject( _.invert( aceContext.elementToPCIMap )[alternateConfiguration] );
                    backingObject =  _.get( aceBackingObjectProviderSvc.getBackingObjectsSync( [ worksetElement ] ), 0 );
                } else {
                    backingObject = _.get( aceBackingObjectProviderSvc.getBackingObjectsSync( [ aceContext.rootElement ] ), 0 );
                }

                logger.debug( 'BACKINGOBJECT_UID', backingObject.uid );
                return backingObject.uid === st_uid;
            } ).catch( function( error ) {
                logger.error( 'Failed to determine the shared line info: ' + error );
                return false;
            } );
        }
        return AwPromiseService.instance.resolve( false );
    }

    /**
     * setup tcVis viewer selection listener
     */
    setupHostVisViewerSelectionListener() {
        this.hostVisViewerSelectionListener = function( occCSIDChains, bomLineSRUIDs ) {
            for( let i = 0; i < occCSIDChains.length; i++ ) {
                if( occCSIDChains[ i ].charAt( occCSIDChains[ i ].length - 1 ) === '/' ) {
                    occCSIDChains[ i ] = occCSIDChains[ i ].slice( 0, -1 );
                }
            }
            this.hostVisViewerSelectionHandler.viewerSelectionChangedHandler( occCSIDChains, bomLineSRUIDs );
        }.bind( this );
        hostVisQueryService.addSelectionEventListener( this.hostVisViewerSelectionListener );
    }
    /**
    * setup tcVis pack unpack update listener
    */
    setupPackUnpackUpdateListner() {
        this.packUnpackUpdateListner = function( packUnpackData ) {
            this.hostVisViewerSelectionHandler.updatePackUnpackHandler( packUnpackData );
        }.bind( this );
        hostVisQueryService.addPackUnpackUpdateEventListener( this.packUnpackUpdateListner );
    }

    setParametersAfterPCILoad() {
        this.structureConfiguration = this.getStructureConfiguration();
        let aceContext = appCtxSvc.getCtx( this.getOccMgmtContextKey() );
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( aceContext );
        this.setPartitionScheme();
    }

    /**
     * Handle Product Context Changed Event
     * @param {Object} eventData event data
     */
    handleProductContextChangedEvent( eventData ) {
        if( eventData && eventData.dataProviderActionType && ( eventData.dataProviderActionType === 'nextAction' || eventData.dataProviderActionType === 'focusAction' ) ) {
            return;
        }
        if( this.locationChanged ) {
            this.locationChanged = false;
            this.sendReloadToHost();
            return;
        }
        if( this.viewerContext === null ) {
            this.setParametersAfterPCILoad();
            return;
        }
        if( eventData.dataProviderActionType === 'activateWindow' || this.getOccMgmtContextKey() !== eventData.updatedView ) {
            return;
        }
        let checkIfResetWasPerformed = StructureViewerService.instance.checkIfResetWasPerformedOnPci( this.getOccMgmtContextKey() );
        if( checkIfResetWasPerformed ) {
            StructureViewerService.instance.removePciFromAceResetState( this.getOccMgmtContextKey() );
            this.sendReloadToHost();
            return;
        }
        const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
        const isBOMWindowSharedInVis = true; //currently hard coded since BOM Window shared is not available yet. Interop query pass from TcViz
        if( !isWindowNotReusedAceFlag && isBOMWindowSharedInVis ) {
            this.applyDeltaUpdate( eventData );
        } else {
            this.handleProductContextChangedFullReload( eventData );
        }
    }

    /**
     * Apply Delta update or full reload
     * @param {Object} eventData event data
     * @returns {Promise} Promise
     **/
    applyDeltaUpdateOrFullReload( eventData ) {
        let aceContext = appCtxSvc.getCtx( eventData.viewToReact );
        if( eventData.skipDeltaUpdate || !aceContext ) {
            this.sendReloadToHost();
        } else {
            return this.isTcVizApplyDeltaUpdate( aceContext ).then( ( applyDeltaUpdate ) => {
                if( !applyDeltaUpdate ) {
                    this.sendReloadToHost();
                    return;
                }
                let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
                hostVisQueryService.sendDeltaUpdateToVis( newProductCtx.uid );
                setTimeout( () => {
                    this.viewerContext = newProductCtx;
                    this.setupHostVisViewerSelectionHandler();
                }, 200 );
            } ).catch( ( error ) => {
                logger.error( 'Failed in isApplyDeltaUpdate  : ' + error );
                this.sendReloadToHost();
            } );
        }
    }

    /**
     * Apply Delta update
     * @param {Object} eventData event data
     */
    applyDeltaUpdate( eventData ) {
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );
        this.isTcVizApplyDeltaUpdate( aceContext ).then( ( applyDeltaUpdate ) => {
            if( !applyDeltaUpdate ) {
                this.handleProductContextChangedFullReload( eventData );
                return;
            }
            let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
            hostVisQueryService.sendDeltaUpdateToVis( newProductCtx.uid );
            setTimeout( () => {
                this.viewerContext = newProductCtx;
                this.setPartitionScheme( );
                this.setupHostVisViewerSelectionHandler();
            }, 200 );
        } ).catch( ( error ) => {
            logger.error( 'Failed in isApplyDeltaUpdate  : ' + error );
            this.handleProductContextChangedFullReload( eventData );
        } );
    }

    /**
     * Gets PartitionScheme.
     * @param {Object} occContext - occmgmt context
     * @returns {Object} Returns structure configuration object if aceActiveCtx is available
     */
    getPartitionScheme( occContext ) {
        let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
        if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
            return pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
        }
        return null;
    }

    /**
     * Handle Product Context Changed Event
     * @param {Object} eventData event data
     */
    handleProductContextChangedFullReload( eventData ) {
        let isReload3DView = false;
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );
        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        if( !( !_.isUndefined( eventData.transientRequestPref ) && !_.isUndefined( eventData.transientRequestPref.reloadDependentTabs ) &&
                eventData.transientRequestPref.reloadDependentTabs === 'false' ) ) {
            const isWindowNotReusedAceFlag = eventData.transientRequestPref && eventData.transientRequestPref.windowNotReused === 'true';
            if( newProductCtx && ( this.viewerContext.uid !== newProductCtx.uid || isWindowNotReusedAceFlag ) ) {
                isReload3DView = true;
            }
        }
        let isWorksetSelectionChanged = StructureViewerService.instance.isViewerOpenedForWorkset( this.getOccMgmtContextKey() ) && eventData.dataProviderActionType ===
            'productChangedOnSelectionChange';
        if( newProductCtx && newProductCtx.props.awb0Snapshot && _.isArray( newProductCtx.props.awb0Snapshot.dbValues ) && !_.isNull( newProductCtx.props.awb0Snapshot.dbValues[ 0 ] ) && !_.isUndefined( newProductCtx.props.awb0Snapshot.dbValues[ 0 ] ) && newProductCtx.props.awb0Snapshot.dbValues[ 0 ] !== '' && !isWorksetSelectionChanged ) {
            this.sendReloadToHostForSnapshot( newProductCtx );
        }else{
            if( eventData.transientRequestPref && eventData.transientRequestPref.recipeReset === 'true' ) {
                isReload3DView = true;
            }
            if( aceContext && aceContext.sublocationAttributes && aceContext.sublocationAttributes.awb0ActiveSublocation &&
                ( aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === '3D' || aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === 'Awb0ViewerFeature' || ( aceContext.currentState
                    .altPwa === '"Awv0StructureViewerPageContainer"' || aceContext.currentState.altPwa_2 === '"Awv0StructureViewerPageContainer"' ) ) ) {
                isReload3DView = true;
            }
            let splitViewMode = false;
            if( appCtxSvc.getCtx( 'splitView' ) ) {
                splitViewMode = appCtxSvc.getCtx( 'splitView' ).mode;
            }
            if( isWorksetSelectionChanged ) {
                isReload3DView = false;
                this.viewerContext = newProductCtx; //update cached PCI when selection change between subset and workset
            }
            if( this.shouldUpdateShowSuppressed() ) {
            // In the future, we want to notify3DViewerShowSuppressed, but due to
            // an issue with BOM that breaks reconfigure,
            // we will just ensured the viewer is reloaded when suppressed is toggled.
                isReload3DView = true;
            }

            if( isReload3DView || splitViewMode ) {
                this.sendReloadToHost();
            }else{
                this.setPartitionScheme( );
            }
        }
    }

    /**
     *
     * @returns {Object} structure configuration
     * Gets user configurations properties from the aceActiveContext related to the structure.
     * Currently only accounts for Show Suppressed, but can be easily modified to account for
     * Show Excluded by Variant and Show Excluded by Effectivity.
     */
    getStructureConfiguration() {
        let aceActiveCtx = appCtxSvc.getCtx( this.getOccMgmtContextKey() );
        if( aceActiveCtx ) {
            return { showSuppressedOcc: aceActiveCtx.showSuppressedOcc };
        }
        return null;
    }

    /**
     * @returns {Boolean} if the preference is changed or not
     * Checks to see if the user preference showSuppressedOcc has been changed.
     * Also updates the structureConfiguration value.
     */
    shouldUpdateShowSuppressed() {
        let retval = false;
        let newStructureConfiguration = this.getStructureConfiguration();

        if( this.structureConfiguration && newStructureConfiguration ) {
            retval = this.structureConfiguration.showSuppressedOcc !== newStructureConfiguration.showSuppressedOcc;
            this.structureConfiguration = newStructureConfiguration;
        }
        return retval;
    }

    /**
     * This method sends the partition scheme to host if it has changed.
     * If partition scheme is same as it was previously, it is not sent to the host.
     */
    setPartitionScheme() {
        let occContext = null;
        if( this.getOccMgmtContextKey() ) {
            occContext = appCtxSvc.getCtx( this.getOccMgmtContextKey() );
        }
        if( appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.key && this.getOccMgmtContextKey() && occContext ) {
            const isPartitionSchemeFeatureSupported = occContext?.supportedFeatures?.Fgf0OrganizationSchemeFeature;
            let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
            let rootElementCsidChain = aceObjectToCSIDGeneratorService.getCloneStableIdChain( occContext.rootElement ? occContext.rootElement : occContext.topElement );
            rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;
            this.structureConfiguration = this.getStructureConfiguration();
            this.viewerContext = StructureViewerService.instance.getPCIModelObject( occContext );
            if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
                let activePartitionSchemeUid = pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
                if( !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                    if( activePartitionSchemeUid !== this.activePartitionSchemeUid || this.rootElementCsidChain !== rootElementCsidChain ) {
                        this.rootElementCsidChain = rootElementCsidChain;
                        if( isPartitionSchemeFeatureSupported ) {
                            this.activePartitionSchemeUid = activePartitionSchemeUid;
                            this.setActivePartitionSchemeInHost( rootElementCsidChain, activePartitionSchemeUid );
                        }
                    }
                } else {
                    if( activePartitionSchemeUid !== this.activePartitionSchemeUid && this.activePartitionSchemeUid !== '' || this.rootElementCsidChain !== rootElementCsidChain ) {
                        this.rootElementCsidChain = rootElementCsidChain;
                        if( isPartitionSchemeFeatureSupported ) {
                            this.activePartitionSchemeUid = '';
                            this.setActivePartitionSchemeInHost( rootElementCsidChain, '' );
                        }
                    }
                }
            } else {
                if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && this.activePartitionSchemeUid !== '' || this.rootElementCsidChain !== rootElementCsidChain ) {
                    this.rootElementCsidChain = rootElementCsidChain;
                    if( isPartitionSchemeFeatureSupported ) {
                        this.activePartitionSchemeUid = '';
                        this.setActivePartitionSchemeInHost( rootElementCsidChain, '' );
                    }
                }
            }
        }
    }

    /**
     * This prepares the query values to send to host for a partition scheme change
     * @param {String} referenceLineCsid reference csid
     * @param {String} partitionSchemeCsid partition csid
     */
    setActivePartitionSchemeInHost( referenceLineCsid, partitionSchemeCsid ) {
        let refLineOcc = viewerContextService.createViewerOccurance( referenceLineCsid );
        let partitionSchemeOcc = viewerContextService.createViewerPartitionSchemeOccurance( partitionSchemeCsid );
        hostVisQueryService.sendPartitionSchemeToHost( refLineOcc, partitionSchemeOcc );
        setTimeout( () => {
            this.setupHostVisViewerSelectionHandler();
        }, 500 );
    }

    /**
     * Handle selection changed event
     * @param {Object} eventData selection data
     */
    handleSelectionChangedEvent( eventData ) {
        if( this.hostVisViewerSelectionHandler ) {
            this.hostVisViewerSelectionHandler.selectionChangeEventHandler( eventData );
        }
    }

    initializeHostVisViewerDataHandler() {
        this.locationChanged = true;
    }

    /**
     * Handle pack unpack event
     * @param {Object} eventData pack unpack data
     */
    handlePackUnpackEvent( eventData ) {
        this.hostVisViewerSelectionHandler.onPackUnpackOperation( eventData );
    }

    /**
     * Event handler for following events:
     * ace.elementsRemoved
     * replaceElement.elementReplacedSuccessfully
     * cba.alignmentUpdated
     * addElement.elementsAdded
     * @param {object} eventData event data
     */
    handleDeltaUpdateEvents( eventData ) {
        if( eventData && eventData.viewToReact && eventData.viewToReact === this.getOccMgmtContextKey() ) {
            this.applyDeltaUpdateOrFullReload( eventData );
        }
    }

    /**
     * handle cdm update event
     * @param {Object} eventData event data
     */
    handleCdmUpdatedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.modifiedObjects ) ) {
            for( let i = 0; i < eventData.modifiedObjects.length; i++ ) {
                let modifiedObj = eventData.modifiedObjects[ i ];
                if( modifiedObj.type === 'DirectModel' ) {
                    if( eventData.viewToReact ) {
                        this.applyDeltaUpdateOrFullReload( eventData );
                    } else {
                        this.sendReloadToHost();
                    }
                    break;
                }
            }
        }
    }

    /**
     * handle cdm related modified event
     * @param {Object} eventData event data
     */
    handleCdmRelatedModifiedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.childObjects ) ) {
            for( let i = 0; i < eventData.childObjects.length; i++ ) {
                let childObj = eventData.childObjects[ i ];
                if( childObj.type === 'DirectModel' ) {
                    if( eventData.viewToReact ) {
                        this.applyDeltaUpdateOrFullReload( eventData );
                    } else {
                        this.sendReloadToHost();
                    }
                    break;
                }
            }
        }
    }

    /**
     * handle change of use indexed model settings event
     */
    handleUseIndexedModelSettingsChangedEvent() {
        this.sendReloadToHost();
    }

    /**
     * Setup host vis viewer selection handler
     */
    setupHostVisViewerSelectionHandler() {
        if( this.hostVisViewerSelectionHandler === null ) {
            this.hostVisViewerSelectionHandler = new HostVisViewerSelectionHandler();
        } else {
            this.hostVisViewerSelectionHandler.initialize();
        }
        let aceContext = this.getAceActiveCtx();
        if( aceContext ) {
            let selections = aceContext.pwaSelection;
            if( !_.isNull( selections ) && !_.isUndefined( selections ) && !_.isEmpty( selections ) ) {
                let selectionType = this.hostVisViewerSelectionHandler.getSelectionType( selections );
                let partitionCsids = this.hostVisViewerSelectionHandler.getPartitionCSIDs( selections );
                if( selectionType === 'OCC_SELECTED' ) {
                    StructureViewerService.instance.ensureMandatoryPropertiesForCsidLoaded( selections ).then(
                        function() {
                            let newlySelectedCsids = [];
                            for( let i = 0; i < selections.length; i++ ) {
                                if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                                    let csid = aceObjectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] );
                                    newlySelectedCsids.push( csid );
                                }
                            }
                            this.hostVisViewerSelectionHandler.determineAndSelectPackedOccs( selections, newlySelectedCsids, partitionCsids );
                        }.bind( this )
                    ).catch( function( error ) {
                        logger.error( 'HostVisViewerData : Failed to load mandatory properties to compute CSID : ' + error );
                    } );
                }
            } else {
                let openedElement = appCtxSvc.getCtx( this.getOccMgmtContextKey() ).openedElement;
                let topElement = appCtxSvc.getCtx( this.getOccMgmtContextKey() ).topElement;
                if( openedElement && topElement && openedElement.uid !== topElement.uid ) {
                    let openedElementCsid = aceObjectToCSIDGeneratorService.getCloneStableIdChain( openedElement );
                    // Send selection set to hosted vis, which is represented by openedElementCsid.
                    hostVisQueryService.sendSelectionsToVis( openedElementCsid );
                } else {
                    // Send empty selection set to hosted vis, which is represented by empty array.
                    // This will be interpreted as an unselect all operation by TcVis.
                    let newlySelectedCsids = [];
                    hostVisQueryService.sendSelectionsToVis( newlySelectedCsids );
                }
            }
        }
    }

    /**
     * Setup 3D viewer visibility handler
     */
    setupHostVisViewerVisibilityHandler( isSnapshotApplied = false ) {
        if( this.hostVisViewerVisibilityHandler === null ) {
            this.hostVisViewerVisibilityHandler = new HostVisViewerVisibilityHandler();
            this.hostVisViewerVisibilityHandler.initialize();
        }else{
            this.hostVisViewerVisibilityHandler.reRegisterVisibilityEventsToAce();
        }
        let visibilityStateToBeApplied = VisOccmgmtCommunicationService.instance.getVisibilityStateFromExistingObserver();
        //tcVis does not need visibility restore on snapshot load as it already has visibility state from snapshot asset
        if( visibilityStateToBeApplied && !isSnapshotApplied ) {
            //need to create function like restoreVisibility
            this.hostVisViewerVisibilityHandler.restoreViewerVisibility( visibilityStateToBeApplied );
        }
    }

    /**
     * handle get occurence visibilty event
     * @param {Object} vmo view model object
     * @returns {Boolean} occurence visible or not
     */
    handleGetOccVisibilty( object, objectType  ) {
        return this.hostVisViewerVisibilityHandler.internalGetOccVisibility( object, objectType  );
    }

    /**
     * Send Reload to host
     */
    sendReloadToHost() {
        const aceContext = this.getAceActiveCtx();
        const isInside3D = aceContext?.currentState?.altPwa === 'Awv0StructureViewerPageContainer' || aceContext?.currentState?.altPwa_2 === 'Awv0StructureViewerPageContainer';
        hostVisQueryService.sendReloadToHost( !isInside3D );
        setTimeout( () => {
            this.setParametersAfterPCILoad();
            this.setupHostVisViewerSelectionHandler();
            this.setupHostVisViewerSelectionListener();
            this.setupHostVisViewerVisibilityHandler();
        }, 5000 );
    }

    /**
     * Send reload to host for Snapshot
     * @param {Object} productContextInfo product context info
     */
    sendReloadToHostForSnapshot( productContextInfo ) {
        if( this.hostVisViewerVisibilityHandler ) {
            this.hostVisViewerVisibilityHandler.clearVisibility();
        }
        hostVisQueryService.sendReloadToHostForSnapshot( productContextInfo );
        setTimeout( () => {
            this.setParametersAfterPCILoad();
            this.setupHostVisViewerSelectionHandler();
            this.setupHostVisViewerSelectionListener();
            this.setupHostVisViewerVisibilityHandler( true /* isSnapshotApplied */ );
        }, 5000 );
    }
    /**
     * handle toggle occurence visibilty event
     * @param {Object} eventData event Data from toggle occurence visibility
     */
    handleToggleOccVisibility( eventData ) {
        this.hostVisViewerVisibilityHandler.internalToggleOccVisibility( eventData );
    }

    /**
     * sets visibility data from other active viewer
     * @param {Object} visibilityData visibility data from other active viewer
     */
    handleVisibilityChanges( visibilityData ) {
        this.hostVisViewerVisibilityHandler.internalHandleVisibilityChanges( visibilityData );
    }

    /**
     * Clean up the current
     * @param {Boolean} isReloadViewer - boolean indicating if viewer is reloading while clean up.
     */
    ctrlCleanup() {
        if( this.hostVisViewerSelectionHandler ) {
            this.hostVisViewerSelectionHandler = null;
        }
        if( this.hostVisViewerSelectionListener ) {
            hostVisQueryService.removeSelectionEventListner( this.hostVisViewerSelectionListener );
            this.hostVisViewerSelectionListener = null;
        }
        if( this.hostVisViewerVisibilityHandler ) {
            this.hostVisViewerVisibilityHandler.cleanUp();
            this.hostVisViewerVisibilityHandler = null;
        }
        if( this.packUnpackUpdateListner ) {
            hostVisQueryService.removePackUnpackUpdateEventListener( this.packUnpackUpdateListner );
            this.packUnpackUpdateListner = null;
        }
        this.activePartitionSchemeUid = null;
    }

    /**
     * Get viewer ACE active context
     * @returns {Object} Returns ace active context
     */
    getAceActiveCtx() {
        return appCtxSvc.getCtx( this.getOccMgmtContextKey() );
    }

    /**
     *
     * @returns {String} occ mgmt context key
     */
    getOccMgmtContextKey() {
        return appCtxSvc.ctx.aceActiveContext ? appCtxSvc.ctx.aceActiveContext.key : 'occmgmtContext';
    }

    /**
     * Returns type of viewer
     * @returns {string} type of viewer
     */
    getViewerType() {
        return this.viewerType;
    }

    /**
     * Returns visibility state
     * @returns {Object} visibility state of viewer
     */
    getVisibilityState() {
        return this.hostVisViewerVisibilityHandler.getVisibilityState();
    }


    /**
     * Is apply delta update to 3D instead of full reload
     *
     * @param {Object} aceContext ACE Context
     *
     */
    isTcVizApplyDeltaUpdate( aceContext ) {
        //Delta update is not available if preference AWV0VisReuseTCServer is set 'false'
        return  preferenceService.getStringValue( 'AWV0VisReuseTCServer' ).then( function( isTcSharedWindowWithVis ) {
            let applyDelta = false;
            let newProductCtx =  StructureViewerService.instance.getPCIModelObject( aceContext );
            return this.isSTLineInfoMatch( aceContext ).then( ( isSharedLineInfoMatch )=>{
                if( isSharedLineInfoMatch && isTcSharedWindowWithVis !== null && isTcSharedWindowWithVis.length > 0 && isTcSharedWindowWithVis.toUpperCase() === 'TRUE' ) {
                    applyDelta = true;
                    if( aceContext ) {
                        if( aceContext.openedElement && aceContext.openedElement.props && aceContext.openedElement.props.awb0UnderlyingObject ) {
                            const openedObj = cdm.getObject( aceContext.openedElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
                            //Delta update is only available for Item revision(excluding Snapshots).
                            if( openedObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                                let snapshotId = newProductCtx.props.awb0Snapshot && newProductCtx.props.awb0Snapshot.dbValues[ 0 ];
                                if( snapshotId ) {
                                    applyDelta = false;
                                }
                            }
                        }
                        //Disable delta update by default for ebom for gulfstream and enable only if beta preference is set with enableDeltaUpdateEbom as value
                        // LCS-1243916 - Disable Delta update for EBOM - make it available as Beta feature ( Gulfstream)
                        if( !HostVisViewerData.isEbomDeltaUpdateEnabled() && StructureViewerService.instance.isPartElementBeingOpened( aceContext ) ) {
                            return applyDelta = false;
                        }
                    }
                }
                return AwPromiseService.instance.resolve( applyDelta );
            } );
        }.bind( this ) ).catch( function( error ) {
            logger.error( 'Failed to validate preference AWV0VisReuseTCServer or opened object type : ' + error );
            return AwPromiseService.instance.reject( error );
        } );
    }

    /**
     *  Is delta update for ebom enabled
     * @returns {Boolean} true if delta update for ebom is enabled
     */
    static isEbomDeltaUpdateEnabled() {
        let loadedPreferences = preferenceService.getLoadedPrefs();
        let betaPrefValue = loadedPreferences?.AWC_visExposedBetaFeatures;
        return betaPrefValue && _.isArray( betaPrefValue ) && _.includes( betaPrefValue, 'enableDeltaUpdateEbom' );
    }
}
