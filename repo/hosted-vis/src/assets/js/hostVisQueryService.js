// Copyright (c) 2022 Siemens

/**
 * Vis Service to assist in creating and sending {HostQueryMessage} objects.
 *
 * @module js/hostVisQueryService
 * @namespace hostVisQueryService
 */
import { loadDependentModule } from 'js/moduleLoader';
import AwPromiseService from 'js/awPromiseService';
import hostInteropSvc from 'js/hosting/hostInteropService';
import hostQueryFactorySvc from 'js/hosting/hostQueryFactoryService';
import hostQuerySvc_2015_10 from 'js/hosting/sol/services/hostQuery_2015_10';
import hostQuerySvc_2019_05 from 'js/hosting/sol/services/hostQuery_2019_05';
import declUtils from 'js/declUtils';
import dmSvc from 'soa/dataManagementService';
import HostVisViewerData from 'js/hostVisViewerData';
import hostQueryService from 'js/hosting/hostQueryService';

import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import logger from 'js/logger';
import hostServices from 'js/hosting/hostConst_Services';
import cfgSvc from 'js/configurationService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import Awv0VisualizationService from 'js/Awv0VisualizationService';
import StructureViewerService from 'js/structureViewerService';
import 'config/hosting';


/**
 * Register service.
 *
 * @member hostVisQueryService
 *
 * @returns {hostVisQueryService} Reference to service's API object.
 */

/**
 * Map of messageId to the {HostQueryHandler} registered to handle it when the 'host' responds from an async request.
 */
var _messageIdToResponseHandlerMap = {};

/**
 * Cache of hostQuery 'handlers'.
 */
var _map_query_to_handler = {};

var _input_message = '';

// Client data model service
var _cdm = cdm;

// AppCtx service
var _appCtxSvc = appCtxSvc;

//file type to send for reload
const fileTypeForReload = 'VVI';

var _occmgmtUtils = occmgmtUtils;

// Flag to indicate that client is handling the query to update Partition Scheme
var _isClientHandlingPartitionSchemeQuery = false;

// Event subscription
var _eventSubDefs = [];
var _aceCtx = null;

// hostVisViewerData Object
var _hostVisViewerData = null;

// Are we currently processing incoming TcVis selections
var _isHandlingTcVisSelections = false;
let selectedCSChainsToBeProcessed = [];
let _aceSelectionEvent = null;
let _isHandlingTcVisPackUnpack = false;
let _acePackUnpackEvent = null;
let _packUnpackEventName = null;

let _tcVisVisibilityChangedListener = [];
let _tcVisSelectionChangedListener = [];
let _tcVisPackUnpackUpdateListener = [];

/**
 * Query id for 'UpdateConfigContextAndScheme' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and asks the other side if it has a handler for a
 * given query id.
 * <P>
 * The input is a string with key 'QueryId' and value of the query id to check.
 * <P>
 * The return value is a boolean with a key of 'HasQueryHandler'
 */
var UPDATE_CONFIG_CONTEXT_AND_SCHEME = 'com.siemens.splm.client.vis.UpdateConfigContextAndScheme';

/**
 * Query id for 'SetActivePartitionScheme' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and asks the other side if it has a handler for a
 * given query id.
 * <P>
 * The input is a string with key 'QueryId' and value of the query id to check.
 * <P>
 * The return value is a boolean with a key of 'HasQueryHandler'
 */
var SET_ACTIVE_PARTITION_SCHEME = 'com.siemens.splm.client.vis.SetActivePartitionScheme';

/**
 * Query id for 'Reload Viewer' query.
 * <P>
 * This query goes from Client -> Host and informs the host that it needs to reload the 3D viewer
 * <P>
 * The input is a JSON string with keys
 *  'FileTicket' - the FMS file ticket for the file the host should download and open
 *  'FileType' - the file type of the file the ticket represents
 *  'Previous_TopLine' - the topline UID from the 3D view that is to be closed
 * <P>
 * There is no return value
 */
var RELOAD_QUERYID = 'com.siemens.splm.client.vis.ReloadViewer';

/**
 * Query id for 'Reconfigure Viewer' query.
 * <P>
 * This query goes from Client -> Host and informs the host that it needs to reconfigure the 3D viewer
 * <P>
 * The input is a JSON string with keys
 *  'tempAppSessionUID' - the UID of the tempAppSession
 *  'options' - options for the reconfigure
 * <P>
 * There is no return value
 */
var RECONFIGURE_QUERYID = 'com.siemens.splm.client.vis.FilterReconfigure';

var DELTA_UPDATE = 'com.siemens.splm.client.vis.DeltaUpdate';

var VIS_ST_LINE_INFO_QUERYID = 'com.siemens.splm.client.vis.GetBomWindowInfo';

/**
 * Query id for 'GetAppliedPartitionScheme' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and asks the other side if it has a handler for a
 * given query id.
 * <P>
 * The input is a string with key 'QueryId' and value of the query id to check.
 * <P>
 * The return value is a boolean with a key of 'HasQueryHandler'
 */
var GET_APPLIED_PARTITION_SCHEME = 'com.siemens.splm.client.vis.GetAppliedPartitionScheme';

/**
 * Query id for 'UpdateOccurrenceVisibilty' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and informs the other side of viewer
 * visibility changes.
 * <P>
 * The input is a JSON string with
 * <P>
 * There is no return value
 */
var UPDATE_OCC_VISIBILITY = 'com.siemens.splm.client.vis.UpdateOccurrenceVisibilty';

/**
 * Query id for 'UpdateSelections' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and informs the other side of viewer
 * visibility changes.
 * <P>
 * The input is a JSON string with
 * <P>
 * There is no return value
 */
var UPDATE_OCC_SELECTION = 'com.siemens.splm.client.vis.2021_08.UpdateSelections';

/**
 * Query id for 'UpdatePackUnpack' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and informs the other side of viewer
 * visibility changes.
 * <P>
 * The input is a JSON string with
 * <P>
 * There is no return value
 */
var UPDATE_PACK_UNPACK = 'com.siemens.splm.client.vis.PackUnpack.2023_01';

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// UpdateConfigContextAndSchemeHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var UpdateConfigContextAndSchemeHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

UpdateConfigContextAndSchemeHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.UpdateConfigContextAndSchemeHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 * @return {HostQueryMessage} The {HostQueryMessage} to send back to 'host' containing any details resulting
 * from handling the query.
 */
UpdateConfigContextAndSchemeHandler.prototype.handleQuery = function( inputMessage ) {
    var dataObjects = inputMessage.queryData;

    if( !_.isEmpty( dataObjects ) ) {
        var queryIdDataObject = dataObjects[ 0 ];
        var queryId = queryIdDataObject.getField( 'QueryId' );
        var ptn_scheme_uid = queryIdDataObject.getField( 'PTN_SCHEME_UID' );

        // cache input message
        _input_message = inputMessage;

        // Check if scheme is specified indicating a scheme change
        if( queryId && ptn_scheme_uid !== null ) {
            if( hostInteropSvc.isQueryHandled( queryId ) ) {
                // We need to take care following use-cases before making partition scheme
                // change:
                // Case 1: If we have multiple selections recorded in the AW client, and we are here,
                //         then we need to make sure that the last object selection in client is the
                //         same as the input DSE uid.
                // Case 2: In case we do not have any explicit selection recorded in the client
                //         context and we are here, then we might have a ghost input from host.
                var input_dse_uid = queryIdDataObject.getField( 'DSE_UID' );
                synchLocalSelectionOrderWithHostInput( input_dse_uid );

                _isClientHandlingPartitionSchemeQuery = true;
                // Initialize scheme change
                let inputOccContext = {
                    configContext:{
                        org_uid: ptn_scheme_uid
                    },
                    transientRequestPref: {
                        userGesture: 'PARTITION_SCHEME_CHANGE'
                    }
                };
                if( ptn_scheme_uid === '' ) {
                    ptn_scheme_uid = null;
                    inputOccContext.transientRequestPref.unsetPartitionScheme = 'true';
                }
                eventBus.publish( 'resetTreeDataProvider', { inputOccContext:inputOccContext } );

                var responseMessages = [];
                var asyncResponse = [];

                var asyncResponseData = hostQueryFactorySvc.createEditableData();
                asyncResponseData.setData( 'Status', 'Success' );
                asyncResponse.push( asyncResponseData );

                var reply = hostQueryFactorySvc.createResponseMessage( _input_message, asyncResponse );
                responseMessages.push( reply );
                fireAsyncQueryToVisHost( responseMessages );
            }
        }
    }
    return null;
};

/**
 * Worker method to build a dataObject to be included in an InteropQuery message that contains the
 * representation of the ACE selected occurrences.
 *
 * @memberof hostVisQueryService
 *
 * @param {Array} csuidChains - Array of string that represent the selected occurrences.
 * @param {Array} selectedPartitions - Array of string that represent the selected partitions
 *
 * @return {object} dataObject to include in an InteropQuery message for the selected occurrences.
 */
let buildDataObjectForSelections = function( csuidChains, selectedPartitions ) {
    let dataObject = hostQueryFactorySvc.createEditableData();
    let occList = [];

    if( csuidChains ) {
        for( var i = 0; i < csuidChains.length; i++ ) {
            let occSelection = {};
            occSelection.OccType = 1;
            occSelection.OccString = csuidChains[ i ];
            if( csuidChains[ i ].length > 0 ) {
                occSelection.OccString += '/';
            }
            occList.push( occSelection );
        }
    }

    if( selectedPartitions ) {
        for( i = 0; i < selectedPartitions.length; i++ ) {
            let occSelection = {};
            occSelection.OccType = 5;
            occSelection.OccString = selectedPartitions[ i ];
            if( selectedPartitions[ i ].length > 0 ) {
                occSelection.OccString += '/';
            }
            occList.push( occSelection );
        }
    }

    let selectionsObj = {};
    selectionsObj.OccList = occList;

    let jsonSelections = JSON.stringify( selectionsObj );
    dataObject.setData( '2021_10_SelectionChangedInput', jsonSelections );

    return dataObject;
};

/**
 * Worker method to build a dataObject to be included in an InteropQuery message that contains the
 * representation of the currently visible occurrences.
 *
 * @memberof hostVisQueryService
 *
 * @param {Array} occList list of occurences to update
 * @param {Boolean} visible occurence visible or not
 * @param {Boolean} isStateChange is state needs to updated
 * @param {Boolean} isNotifyChange is notification needed
 * @return {object} dataObject to include in an InteropQuery message for the selected occurrences.
 */
let buildDataObjectForVisibility = function( occList, visible, isStateChange, isNotifyChange ) {
    let dataObject = hostQueryFactorySvc.createEditableData();
    if( occList.length > 0 ) {
        let visibleObj = {};
        if( isStateChange ) {
            visibleObj.updateVisibleState = occList;
        } else if( visible === true ) {
            visibleObj.visibilityTurnedOn = occList;
        } else {
            visibleObj.visibilityTurnedOff = occList;
        }
        if( isNotifyChange !== undefined && isNotifyChange !== null ) {
            visibleObj.isNotifyChange = isNotifyChange;
        }
        let jsonVisibleObjs = JSON.stringify( visibleObj );
        dataObject.setData( 'VisibilityUpdateInput', jsonVisibleObjs );
    }

    return dataObject;
};

/**
 * Worker method to build a dataObject to be included in an InteropQuery message that contains the
 * representation for the given Pack/Unpack event.
 *
 * @memberof hostVisQueryService
 *
 * @param {String} eventType - Type of event. Either "Pack", "Unpack", "PackAll" or "UnpackAll"
 * @param {Array} affectedOccurrences - Array of objects that represent the affected occurrences (should be empty for "PackAll" and "UnpackAll")
 *                                      each object has 2 fields: OccType - integer indicating the type of the occurrence
 *                                                                OccString - string that contains the CS Chain
 *
 * @return {object} dataObject to include in an InteropQuery message for the PackUnpack event.
 */
export let buildDataObjectForPackUnpack = function( eventType, affectedOccurrences ) {
    let dataObject = hostQueryFactorySvc.createEditableData();
    let occList = affectedOccurrences;
    if( occList.length > 0 ) {
        let packUnpackObj = {};
        packUnpackObj.eventType = eventType;
        packUnpackObj.affectedOccurrences = affectedOccurrences;

        let jsonPackUnpackObj = JSON.stringify( packUnpackObj );
        dataObject.setData( 'PackUnpackUpdateInput_2023_01', jsonPackUnpackObj );
    }

    return dataObject;
};

/**
 *
 * @param {String} UID temp app session UID
 * @param {Integer} options hint on how to handle orphan objects - 0 Keep, 1 Discard
 */
var sendReconfigureToHost = function( UID, options ) {
    let messages = [];
    let dataObjects = [];
    let dataObject = hostQueryFactorySvc.createEditableData();

    dataObject.setData( 'tempAppSessionUID', UID );
    dataObject.setData( 'FilterOptions', options );

    dataObjects.push( dataObject );

    let message = hostQueryFactorySvc.createMessageWithID( RECONFIGURE_QUERYID, dataObjects );
    messages.push( message );
    fireAsyncQueryToVisHost( messages );
};

/**
 * Create the temp app session and send to TcVis
 */
export let reconfigureViewerToHost = function() {
    let options = 0;
    declUtils.loadDependentModule( 'js/aceBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                let occmgmtActiveCtxKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
                let occmgmtCtx = appCtxSvc.getCtx( occmgmtActiveCtxKey );
                return occMBOPSMod.getBackingObjects( [ occmgmtCtx.topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( 'Cad-2020-01-AppSessionManagement', 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0TempAppSession'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } ).then( createOutput => {
            let tempAppSes = createOutput.sessionOutputs[ 0 ].sessionObject;
            sendReconfigureToHost( tempAppSes.uid, options );
        } );
};

/**
 * This method prepares the file ticket to send to Vis after reload event and sends the query
 * @param {Boolean} isNotifyChange notifty visibility change or not
 */
export let sendReloadToHost = function( isNotifyChange ) {
    let messages = [];
    let dataObjects = [];
    let dataObject = hostQueryFactorySvc.createEditableData();

    Awv0VisualizationService.downloadVVIFileTicketForHostReload().then( function( fileTicket ) {
        dataObject.setData( 'FileTicket', fileTicket );
        dataObject.setData( 'FileType', fileTypeForReload );
        dataObject.setData( 'IsNotifyChange', isNotifyChange );
        dataObjects.push( dataObject );

        let message = hostQueryFactorySvc.createMessageWithID( RELOAD_QUERYID, dataObjects );
        messages.push( message );
        fireAsyncQueryToVisHost( messages );
    } ).catch( function( err ) {
        logger.error( err );
    } );
};


/**
 * This method prepares the file ticket to send to Vis after reload event and sends the query
 */
export let sendReloadToHostForSnapshot = function( snapshotData ) {
    let messages = [];
    let dataObjects = [];
    let dataObject = hostQueryFactorySvc.createEditableData();

    Awv0VisualizationService.downloadVVIFileTicketForProductSnapshotReload( snapshotData, true ).then( function( fileTicket ) {
        dataObject.setData( 'FileTicket', fileTicket );
        dataObject.setData( 'FileType', fileTypeForReload );

        dataObjects.push( dataObject );

        let message = hostQueryFactorySvc.createMessageWithID( RELOAD_QUERYID, dataObjects );
        messages.push( message );
        fireAsyncQueryToVisHost( messages );
    } ).catch( function( err ) {
        logger.error( err );
    } );
};

/**
 * This method will make sure that the input DSE from the Vis host and the active
 * selection on the AW client are in synch, even if there is a ghost selection
 * being made from the host.
 *
 * @param {String} inputDseUid: The uid for the DSE which was sent as an input
 *                              from the host, Vis in this case.
 */
var synchLocalSelectionOrderWithHostInput = function( inputDseUid ) {
    if( inputDseUid && appCtxSvc ) {
        var selectionList = _appCtxSvc.ctx.mselected;
        var selectionLength = selectionList.length;
        var lastSelectedObjUid = '';

        if( selectionLength > 0 ) {
            lastSelectedObjUid = selectionList[ selectionLength - 1 ].props.awb0UnderlyingObject.dbValues[ 0 ];
        }
        // If the last selection is the same as input DSE, then exit.
        // Otherwise find the correct object in the selection list
        // and set it as last selection.
        if( lastSelectedObjUid !== inputDseUid || selectionLength < 0 ) {
            // get the new selection order with the input DSE as the last selection.
            var newSelectionOrder = getNewSelectionOrderBasedOnHostInput( inputDseUid, selectionList, selectionLength );
            var eventData = { selected: newSelectionOrder };

            //publish selection changed event to let the PWA know that we have a new order.
            eventBus.publish( 'hosting.changeSelection', eventData );
        }
    }
};

/**
 * This method will try to get you a selection order which is in synch with selection order of the
 * host application, even if the host is making ghost selection.
 *
 * @param {String} inputDseUid : The uid for the DSE object send by the host application.
 * @param {Object[]} selectionList : The list of currently selected objects in the AW client.
 * @param {int} selectionLength : The total number of selection in the current client selection list
 *
 * @returns {Object[]} newSelectionOrder : An array of objects in synchronized order from the hosted
 *                                         clients selection list.
 */
var getNewSelectionOrderBasedOnHostInput = function( inputDseUid, selectionList, selectionLength ) {
    var objectToBeMoved = {};
    var newSelectionOrder = [];

    // Iterate over the selection list and find the object we are looking for.
    for( var i = 0; i < selectionLength; i++ ) {
        var currentObjectUid = selectionList[ i ].props.awb0UnderlyingObject.dbValues[ 0 ];

        // We are looking for the object with the same underlying Object uid as the input DSE uid.
        if( currentObjectUid === inputDseUid ) {
            objectToBeMoved = selectionList[ i ];
            continue;
        }
        newSelectionOrder.push( selectionList[ i ] );
    }

    if( Object.keys( objectToBeMoved ).length !== 0 ) {
        // Now add the object found earlier to the last location.
        newSelectionOrder.push( objectToBeMoved );
    } else {
        // We will try to get the selection from PCI silently for the input
        // DSE uid passed into AW client from Vis host by making a ghost selection.
        var ghostSelection = getSelectionFromPCISilently( inputDseUid );
        newSelectionOrder.push( ghostSelection );
    }
    return newSelectionOrder;
};

/**
 * This method will try to extract an object from the hosted clients runtime datamodel
 * based on the input UID from the host application. This method will traverse the
 * elementToPciMap from the hosted clients context and will try to locate the DSE
 * object with the same UID as the input uid sent by the host application in the map
 * and then return the found object for selection.
 *
 * @param {String} inputDseUid : The uid for the input DSE sent by the host application.
 *
 * @returns{Object} elementToBeSelected : The element to be selected.
 */
var getSelectionFromPCISilently = function( inputDseUid ) {
    // Get the element to PCI map from ctx.
    let currentContext = _appCtxSvc.getCtx( _appCtxSvc.ctx.aceActiveContext.key );
    var elementToPCIMap = currentContext.elementToPCIMap;

    // Iterate over the elementToPCIMap element and try to find the PCI for the
    // input DSE uid.
    for( var uid in elementToPCIMap ) {
        var element = _cdm.getObject( uid );
        if( element && element.props.awb0UnderlyingObject &&
            element.props.awb0UnderlyingObject.dbValues[ 0 ] === inputDseUid ) {
            // We have found the object in AW client's runtime model related to the input DSE from host,
            // now return this object as ghost selection.
            return element;
        }
    }
};

var configContextChanged = function( isSchemeChange ) {
    // Unsubscribe to event
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );

    var messages = [];
    var dataObjects = [];
    var dataObject = hostQueryFactorySvc.createEditableData();
    var wse_uid = '';
    var dse_uid = '';
    var ptn_scheme_uid = '';
    var ptn_scheme_name = '';

    let currentContext = _appCtxSvc.getCtx( _appCtxSvc.ctx.aceActiveContext.key );
    if( _appCtxSvc.ctx && _appCtxSvc.ctx.aceActiveContext && currentContext ) {
        wse_uid = currentContext.topElement.props.awb0UnderlyingObject.dbValues[ 0 ];
        if( currentContext.productContextInfo.props.awb0Product ) {
            if( currentContext.productContextInfo.props.awb0Product.dbValues[ 0 ] !== null &&
                currentContext.productContextInfo.props.awb0Product.dbValues[ 0 ] !== wse_uid ) {
                dse_uid = currentContext.productContextInfo.props.awb0Product.dbValues[ 0 ];
            }
        }

        if( currentContext.productContextInfo.props.fgf0PartitionScheme ) {
            if( currentContext.productContextInfo.props.fgf0PartitionScheme.dbValues[ 0 ] !== null ) {
                ptn_scheme_uid = currentContext.productContextInfo.props.fgf0PartitionScheme.dbValues[ 0 ];
                ptn_scheme_name = currentContext.productContextInfo.props.fgf0PartitionScheme.uiValues[ 0 ];
            }
        }
    }

    if( isSchemeChange ) {
        dataObject.setData( 'QUERY_TYPE', 'CHANGE_PARTITION_SCHEME' );
    } else {
        dataObject.setData( 'QUERY_TYPE', 'CHANGE_CONFIGURATION' );
    }
    dataObject.setData( 'WS_UID', wse_uid );
    dataObject.setData( 'DSE_UID', dse_uid );
    dataObject.setData( 'PTN_SCHEME_UID', ptn_scheme_uid );
    dataObject.setData( 'PTN_SCHEME_NAME', ptn_scheme_name );
    dataObjects.push( dataObject );

    var message = hostQueryFactorySvc.createMessageWithID( UPDATE_CONFIG_CONTEXT_AND_SCHEME, dataObjects );
    messages.push( message );
    fireAsyncQueryToVisHost( messages );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// GetAppliedPartitionSchemeHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

// Worker method to handle the GetAppliedPartitionSchemeHandler InteropQuery request.
// This function assumes that the elements encountered in the elementToPCIMap have been
// loaded into the cdm. It therefore expects the element.props.awb0UnderlyingObject to
// be populated in order to execute correctly. The function _processGetActivePartitionScheme()
// takes care of this pre-condition and calls this function when complete.
var _getPartitionSchemesForSubsets = function( inputMessage, aceActiveContext, subsetElementList ) {
    let asyncResponse = [];

    // For every Subset object we find in the elementToPCIMap attempt to find the applied partition
    // scheme. Return a response to the host for every Subset we find.
    for( var i = 0; i < subsetElementList.length; i++ ) {
        let element = subsetElementList[ i ];
        let pci = _cdm.getObject( _occmgmtUtils.getProductContextForProvidedObject( element ) );
        let asyncResponseData = hostQueryFactorySvc.createEditableData();

        asyncResponseData.setData( 'WSE_UID', aceActiveContext.topElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        asyncResponseData.setData( 'DSE_UID', element.props.awb0UnderlyingObject.dbValues[ 0 ] );

        // See if the object has an applied partition scheme
        if( pci && pci.props.fgf0PartitionScheme ) {
            asyncResponseData.setData( 'Status', 'Success' );
            if( pci.props.fgf0PartitionScheme.dbValues[ 0 ] === null ) {
                logger.info( 'Returning parition scheme "None" for Subset ' +
                    element.props.awb0UnderlyingObject.dbValues[ 0 ] );
                asyncResponseData.setData( 'PTN_SCHEME_UID', '' );
                asyncResponseData.setData( 'PTN_SCHEME_NAME', '' );
            } else {
                logger.info( 'Returning parition scheme "' + pci.props.fgf0PartitionScheme.uiValues[ 0 ] +
                    '"  for Subset ' + element.props.awb0UnderlyingObject.dbValues[ 0 ] );
                asyncResponseData.setData( 'PTN_SCHEME_UID', pci.props.fgf0PartitionScheme.dbValues[ 0 ] );
                asyncResponseData.setData( 'PTN_SCHEME_NAME', pci.props.fgf0PartitionScheme.uiValues[ 0 ] );
            }
        } else {
            logger.info( 'Was not able to find partition scheme for element ' + element + '. Return Failed status.' );
            asyncResponseData.setData( 'Status', 'Failed' );
        }

        asyncResponse.push( asyncResponseData );
    }

    // If we have any responses then return them to TcVis
    if( asyncResponse.length > 0 ) {
        let responseMessages = [];
        let reply = hostQueryFactorySvc.createResponseMessage( inputMessage, asyncResponse );
        responseMessages.push( reply );
        fireAsyncQueryToVisHost( responseMessages );
    }
};

// Worker method to handle the GetAppliedPartitionSchemeHandler InteropQuery request.
// This method preprocess the elements found in the elementToPCIMap and tests whether each object
// has its props.awb0UnderlyingObject set. If it does not then that uid is added to the list of
// object that will be force loaded using the loadObjects() SOA. This is necessary because it has
// been noticed that TcVis can call the associated InteropQuery and then there are multiple
// Subset object under a Workset, only the first Subset has its props populated. This appears to
// only be a problem the very first time TcVis calls this service.
var _processGetActivePartitionScheme = function( inputMessage, aceActiveContext ) {
    // Iterate over all subset elements and return partition scheme in query data
    if( isWorksetOpen() ) {
        // Array of Subset Element objects to be processed by _getActivePartitionScheme()
        let subsetElementList = [];
        // Fetch element to PCI map
        let elementToPCIMap = aceActiveContext.elementToPCIMap;
        for( var uid in elementToPCIMap ) {
            if( aceActiveContext.elementToPCIMap.hasOwnProperty( uid ) ) {
                let element = _cdm.getObject( uid );
                logger.info( 'element = ' + element );
                subsetElementList.push( element );
            }
        }
        _getPartitionSchemesForSubsets( inputMessage, aceActiveContext, subsetElementList );
    } else {
        logger.info( 'Workset is NOT open.' );
        let asyncResponse = [];
        let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( aceActiveContext );
        let activePartitionSchemeUid = '';
        let activePartitionSchemeName = '';
        if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
            activePartitionSchemeUid = pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
            activePartitionSchemeName = pciObj.props.fgf0PartitionScheme.uiValues[ 0 ];
        }
        let asyncResponseData = hostQueryFactorySvc.createEditableData();
        if( aceActiveContext.topElement && aceActiveContext.topElement.props && aceActiveContext.topElement.props.awb0UnderlyingObject
            && Array.isArray( aceActiveContext.topElement.props.awb0UnderlyingObject.dbValues ) && aceActiveContext.topElement.props.awb0UnderlyingObject.dbValues.length > 0  ) {
            asyncResponseData.setData( 'WSE_UID', aceActiveContext.topElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }else{
            asyncResponseData.setData( 'WSE_UID', '' );
        }

        if( aceActiveContext.rootElement && aceActiveContext.rootElement.props && aceActiveContext.rootElement.props.awb0UnderlyingObject
            && Array.isArray( aceActiveContext.rootElement.props.awb0UnderlyingObject.dbValues ) && aceActiveContext.rootElement.props.awb0UnderlyingObject.dbValues.length > 0  ) {
            asyncResponseData.setData( 'DSE_UID', aceActiveContext.rootElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }else{
            asyncResponseData.setData( 'DSE_UID', '' );
        }
        asyncResponseData.setData( 'Status', 'Success' );
        asyncResponseData.setData( 'PTN_SCHEME_UID', activePartitionSchemeUid );
        asyncResponseData.setData( 'PTN_SCHEME_NAME', activePartitionSchemeName );
        asyncResponse.push( asyncResponseData );
        // If we have any responses then return them to TcVis
        if( asyncResponse.length > 0 ) {
            let responseMessages = [];
            let reply = hostQueryFactorySvc.createResponseMessage( inputMessage, asyncResponse );
            responseMessages.push( reply );
            fireAsyncQueryToVisHost( responseMessages );
        }
    }
};

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var GetAppliedPartitionSchemeHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

GetAppliedPartitionSchemeHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.GetAppliedPartitionSchemeHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 */

GetAppliedPartitionSchemeHandler.prototype.handleQuery = function( inputMessage ) {
    if( !_.isEmpty( inputMessage.queryData ) ) {
        let queryId = inputMessage.queryData[ 0 ].getField( 'QueryId' );

        if( queryId && hostInteropSvc.isQueryHandled( queryId ) ) {
            logger.info( 'queryId = ' + queryId );

            // Try to obtain the aceActiveContext
            let aceActiveContext = _appCtxSvc.getCtx( 'aceActiveContext' );
            let currentCtx = null;
            let bSubscribeToEvent = true;
            if( aceActiveContext ) {
                currentCtx = _appCtxSvc.getCtx( aceActiveContext.key );

                if( !currentCtx ) {
                    logger.info( 'currentCtx is not present.' );
                } else if( !currentCtx.topElement ) {
                    logger.info( 'There is no topElement in currentCtx.' );
                } else {
                    if( currentCtx.topElement.props && currentCtx.topElement.props.awb0UnderlyingObject ) {
                        let wse_uid = currentCtx.topElement.props.awb0UnderlyingObject.dbValues[ 0 ];
                        let input_wse_uid = inputMessage.queryData[ 0 ].getField( 'WSE_UID' );
                        if( wse_uid === input_wse_uid ) {
                            logger.info( 'currentCtx is present and topElement exists. Calling _processGetActivePartitionScheme' );
                            bSubscribeToEvent = false;
                            _processGetActivePartitionScheme( inputMessage, currentCtx );
                        }
                    }
                }
            }

            if( bSubscribeToEvent ) {
                logger.info( 'subscribing to productContextChangedEvent event.' );
                _aceCtx = eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
                    logger.info( 'productContextChangedEvent has fired.' );
                    if( isWorksetOpen() && ( eventData.dataProviderActionType === 'initializeAction' ||
                            eventData.dataProviderActionType === 'productChangedOnSelectionChange' ) ) {
                        logger.info( 'Workset is open and dataProviderActionType is initializeAction.' );
                        currentCtx = _appCtxSvc.getCtx( eventData.updatedView );
                        if( currentCtx && currentCtx.topElement ) {
                            logger.info( 'currentCtx is defined. Calling _processGetActivePartitionScheme' );
                            eventBus.unsubscribe( _aceCtx );
                            //GetAppliedPartitionSchemeHandler.prototype.handleQuery(inputMessage);
                            _processGetActivePartitionScheme( inputMessage, currentCtx );
                        } else {
                            if( !currentCtx ) {
                                logger.info( 'currentCtx is still not present.' );
                            } else if( !currentCtx.topElement ) {
                                logger.info( 'topElement is still missing in currentCtx.' );
                            }
                        }
                    } else {
                        logger.info( 'isWorksetOpen() is ' + isWorksetOpen() + '   dataProviderActionType is ' + eventData.dataProviderActionType );
                    }
                } );
            }
        }
    }
};

var isWorksetOpen = function() {
    if( _appCtxSvc.ctx && _appCtxSvc.ctx.aceActiveContext && _appCtxSvc.ctx.aceActiveContext.key ) {
        let currentContext = _appCtxSvc.getCtx( _appCtxSvc.ctx.aceActiveContext.key );
        if( currentContext.topElement && currentContext.topElement.props.awb0UnderlyingObject ) {
            var underlyingObject = _cdm.getObject( currentContext.topElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
            if( underlyingObject.modelType.typeHierarchyArray.indexOf( 'Cpd0WorksetRevision' ) > -1 ||
            underlyingObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                return true;
            }
        }
    }
    return false;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// UpdateOccurrenceVisibiltyHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var UpdateOccurrenceVisibiltyHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

UpdateOccurrenceVisibiltyHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.UpdateOccurrenceVisibiltyHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 * @return {HostQueryMessage} The {HostQueryMessage} to send back to 'host' containing any details resulting
 * from handling the query.
 */

UpdateOccurrenceVisibiltyHandler.prototype.handleQuery = function( inputMessage ) {
    if( !_.isEmpty( inputMessage.queryData ) ) {
        let queryId = inputMessage.queryData[ 0 ].getField( 'QueryId' );

        if( queryId && hostInteropSvc.isQueryHandled( queryId ) ) {
            logger.info( 'queryId = ' + queryId );
            let strInput = inputMessage.queryData[ 0 ].getField( 'VisibilityUpdateInput' );
            try {
                let objVisibilityInput = JSON.parse( strInput );
                notifyVisHostVisibityChanges( objVisibilityInput );
                logger.info( 'objVisibilityInput = ' + objVisibilityInput );
            } catch {
                logger.error( 'objVisibilityInput is incorrect' );
            }
        }
    }
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// UpdateSelectionsHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var UpdateSelectionsHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

UpdateSelectionsHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.UpdateSelectionsHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 * @return {HostQueryMessage} The {HostQueryMessage} to send back to 'host' containing any details resulting
 * from handling the query.
 */

UpdateSelectionsHandler.prototype.handleQuery = function( inputMessage ) {
    if( !_isHandlingTcVisSelections && !_.isEmpty( inputMessage.queryData ) ) {
        // cache input message
        _input_message = inputMessage;

        let queryId = inputMessage.queryData[ 0 ].getField( 'QueryId' );

        if( queryId && hostInteropSvc.isQueryHandled( queryId ) ) {
            logger.info( 'queryId = ' + queryId );
            let strInput = inputMessage.queryData[ 0 ].getField( '2021_10_SelectionChangedInput' );
            let selectionChanges = JSON.parse( strInput );
            logger.info( '2020_07_SelectionChangedInput = ' + selectionChanges );
            let selectedCSChains = [];
            let bomlineSruids = [];
            for( let i = 0; i < selectionChanges.length; i++ ) {
                if( selectionChanges[ i ].OccType === 1 ) {
                    if( selectionChanges[ i ].OccString !== undefined ) {
                        selectedCSChains.push( selectionChanges[ i ].OccString );
                    }
                    if( selectionChanges[ i ].theSruid !== undefined ) {
                        bomlineSruids.push( selectionChanges[ i ].theSruid );
                    }
                } else if( selectionChanges[ i ].OccType === 5 ) {
                    if( selectionChanges[ i ].OccString !== undefined ) {
                        let strOccChain = selectionChanges[ i ].OccString;
                        if( selectionChanges[ i ].SubsetUID !== undefined ) {
                            let strSubsetUID = selectionChanges[ i ].SubsetUID;
                            strOccChain = strSubsetUID + '/' + strOccChain;
                        }
                        selectedCSChains.push( strOccChain );
                    }
                }
            }
            if( !_isHandlingTcVisSelections ) {
                notifyVisHostSelectionChanges( selectedCSChains, bomlineSruids );
            } else {
                selectedCSChainsToBeProcessed = selectedCSChains;
            }
        }

        var responseMessages = [];
        var asyncResponse = [];

        var asyncResponseData = hostQueryFactorySvc.createEditableData();
        asyncResponseData.setData( 'Status', 'Success' );
        asyncResponse.push( asyncResponseData );

        var reply = hostQueryFactorySvc.createResponseMessage( _input_message, asyncResponse );
        responseMessages.push( reply );
        fireAsyncQueryToVisHost( responseMessages );
    }
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// UpdatePackUnpackHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var UpdatePackUnpackHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

UpdatePackUnpackHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.UpdatePackUnpackHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 */
UpdatePackUnpackHandler.prototype.handleQuery = function( inputMessage ) {
    if( !_isHandlingTcVisPackUnpack && !_.isEmpty( inputMessage.queryData ) ) {
        let queryId = inputMessage.queryData[ 0 ].getField( 'QueryId' );

        if( queryId && hostInteropSvc.isQueryHandled( queryId ) ) {
            try {
                let strInput = inputMessage.queryData[ 0 ].getField( 'PackUnpackUpdateInput_2023_01' );
                let packUnpackChanges = JSON.parse( strInput );
                //packUnpackData object consisting event type and selected CSID array list
                let objPackUnpackInput = {
                    eventData: {
                        action: {
                            name: packUnpackChanges.eventType
                        },
                        csidChainList: packUnpackChanges.affectedOccurrences
                    }
                };
                //Call notifyVisHostPackUnpackChanges to make changes in ACE
                notifyVisHostPackUnpackChanges( objPackUnpackInput );
            } catch {
                logger.error( 'objPackUnpackInput is incorrect' );
            }
        }
    }
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Get_2020_07_CreateIssueHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} ...
 *
 * @constructor
 * @memberof hostVisQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var Get_2020_07_CreateIssueHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

Get_2020_07_CreateIssueHandler.prototype = hostQueryFactorySvc.extendHandler();

var processCreateIssueResult = function( _changeSvc, response, j, objCreateIssueInput ) {
    //alert('Entered processCreateIssueResult.');
    var asyncResponse = [];

    //alert('Back from call to openCreateIssuePanel with resolve of promise.\nresponse.status = ' + response.status);
    // Process the response from the openCreateIssuePanel call and return results to the host.
    var asyncResponseData = hostQueryFactorySvc.createEditableData();
    asyncResponseData.setData( 'ClientId', response.output[ 0 ].clientId );

    if( response.status === 'changeServiceNotPresent' ) {
        asyncResponseData.setData( 'Status', 'Failed - Change Service not installed' );
    } else if( response.status === 'createChangeCompletedSuccessfully' && response.output[ 0 ].objects[ 1 ] !== null ) {
        asyncResponseData.setData( 'Status', 'Success' );
        asyncResponseData.setData( 'Issue_UID', response.output[ 0 ].objects[ 1 ].uid );
    } else {
        // createChangeCompletedWithoutCreate case
        asyncResponseData.setData( 'Status', 'Failed' );
    }

    asyncResponse.push( asyncResponseData );

    var responseMessages = [];
    var reply = hostQueryFactorySvc.createResponseMessage( _input_message, asyncResponse );
    responseMessages.push( reply );
    //alert('about to call fireAsyncQueryToVisHost.');
    fireAsyncQueryToVisHost( responseMessages );
    ++j;

    if( _changeSvc !== undefined && j < objCreateIssueInput.length ) {
        var openIssueInEditMode = true;
        if( objCreateIssueInput.length > 1 && j !== objCreateIssueInput.length - 1 ) {
            openIssueInEditMode = false;
        }

        // Call ChangeManagement service to create the issue.
        //alert('About to call openCreateIssuePanel');
        _changeSvc.openCreateIssuePanel( objCreateIssueInput[ j ], openIssueInEditMode ).then(
            function( response ) {
                //alert('Promise fulfilled in processCreateIssueResult.');
                processCreateIssueResult( _changeSvc, response, j, objCreateIssueInput );
            }
        );
    }
};

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.Get_2020_07_CreateIssueHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 * @return {HostQueryMessage} The {HostQueryMessage} to send back to 'host' containing any details resulting
 * from handling the query.
 */
Get_2020_07_CreateIssueHandler.prototype.handleQuery = function( inputMessage ) {
    //alert("Entered Get_2020_07_CreateIssueHandler.");
    var dataObjects = inputMessage.queryData;

    if( !_.isEmpty( dataObjects ) ) {
        var queryIdDataObject = dataObjects[ 0 ];
        var queryId = queryIdDataObject.getField( 'QueryId' );

        // cache input message
        _input_message = inputMessage;

        // Iterate over all create issue requests and return Issue Report uid in query response data
        if( queryId ) {
            //var strMsg = "QueryId = " + queryId;
            //alert(strMsg);

            if( hostInteropSvc.isQueryHandled( queryId ) ) {
                //alert('QueryId is handled.');
                declUtils.loadDependentModule( 'js/Cm1ChangeCommandService' )
                    .then( function( _changeSvc ) {
                        if( _changeSvc !== undefined ) {
                            // Loop through all the create issue requests
                            for( var i = 0; i < dataObjects.length; i++ ) {
                                var queryIdDataObject2 = dataObjects[ i ];
                                var strCreateIssueInput = queryIdDataObject2.getField( '2020_07_CreateIssueInput' );
                                //alert('JSON string = ' + strCreateIssueInput);
                                var objCreateIssueInput = JSON.parse( strCreateIssueInput );
                                //alert('Number of entries in CreateIssueInput = ' + objCreateIssueInput.length);

                                var j = 0;

                                if( j < objCreateIssueInput.length ) {
                                    var openIssueInEditMode = true;
                                    if( objCreateIssueInput.length > 1 && j !== objCreateIssueInput.length - 1 ) {
                                        openIssueInEditMode = false;
                                    }

                                    // Call ChangeManagement service to create the issue.
                                    //alert('About to call openCreateIssuePanel');
                                    _changeSvc.openCreateIssuePanel( objCreateIssueInput[ j ], openIssueInEditMode ).then(
                                        function( response ) {
                                            //alert('First Promise fulfilled.');
                                            //response.output[0].clientId = objCreateIssueInput[j].ClientId;
                                            processCreateIssueResult( _changeSvc, response, j, objCreateIssueInput );
                                        }
                                    );
                                }
                            }
                        } else {
                            // No change service present. Most likely not installed. Return an error message
                            // to the host.
                            var queryIdDataObject2 = dataObjects[ 0 ];
                            var strCreateIssueInput = queryIdDataObject2.getField( '2020_07_CreateIssueInput' );
                            var objCreateIssueInput = JSON.parse( strCreateIssueInput );

                            var response = {};
                            response.status = 'changeServiceNotPresent';
                            var retData = {
                                clientId: objCreateIssueInput[ 0 ].ClientId
                            };
                            response.output = [];
                            response.output.push( retData );

                            processCreateIssueResult( _changeSvc, response, j, objCreateIssueInput );
                        }
                    } );
            }
        }
    }

    return null;
};

/**
 * Get the {HostQueryHandler} registed for the given ID.
 *
 * @param {String} queryId - ID of the {HostQueryHandler} to return.
 *
 * @returns  {HostQueryHandler} The handler registed for the given ID.
 */
async function getQueryHandler( queryId ) {
    var hostingConfig = cfgSvc.getCfgCached( 'hosting' );

    var handlerInfo = hostingConfig.queries[ queryId ];

    if( handlerInfo ) {
        if( _map_query_to_handler[ queryId ] ) {
            return _map_query_to_handler[ queryId ];
        }

        const handlerSvc = await loadDependentModule( handlerInfo.module );

        if( handlerSvc ) {
            var handler;

            if( handlerSvc[ handlerInfo.constructor ] ) {
                handler = handlerSvc[ handlerInfo.constructor ]();
            }

            if( handler ) {
                _map_query_to_handler[ queryId ] = handler;

                return handler;
            }

            logger.warn( 'hostVisQueryService' + ':' + 'Invalid handler constructor' + '\n' +
                JSON.stringify( handlerInfo, null, 2 ) );
        } else {
            logger.warn( 'hostVisQueryService' + ':' + 'Handler service not found' + '\n' +
                JSON.stringify( handlerInfo, null, 2 ) );
        }
    }

    return null;
}

/**
 * Send an async query to the host via the sendQueryToHostAsync method. This method does
 * process Response Messages from the host.
 *
 * @memberof hostVisQueryService
 *
 * @param {HostQueryMessage} query - The {HostQueryMessage} to send to the 'host'.
 *
 * @return {Promise} Resolved with {HostQueryMessage} The responses from the 'host'.
 */
function sendAsyncQueryToVisHost( query ) {
    return hostQueryService.sendQueryToHostAsync( query );
}

/**
 * Send an async query to the host via the fireHostEvent method. This method does
 * not process any Response Messages from the host.
 *
 * @memberof hostVisQueryService
 *
 * @param {HostQueryMessage} query -
 */
function fireAsyncQueryToVisHost( query ) {
    if( canQueryVisHost_2019_05() ) {
        hostQuerySvc_2019_05.createHostQueryProxy().fireHostEvent( query );
    } else if( canQueryVisHost() ) {
        hostQuerySvc_2015_10.createHostQueryProxy().fireHostEvent( query );
    }
}
/**
 * Is it possible to send queries to the 'host'.
 *
 * @memberof hostVisQueryService
 *
 * @return {Boolean} TRUE if the 'host' supports receiving {HostQueryMessage} calls.
 */
function canQueryVisHost() {
    return hostInteropSvc.isHostServiceAvailable(
        hostServices.HS_INTEROPQUERY_SVC,
        hostServices.VERSION_2015_10
    );
}

/**
 * Is it possible to send queries to the update 'host' service.
 *
 * @memberof hostVisQueryService
 *
 * @return {Boolean} TRUE if the 'host' supports receiving {HostQueryMessage} calls.
 */
function canQueryVisHost_2019_05() {
    return hostInteropSvc.isHostServiceAvailable(
        hostServices.HS_INTEROPQUERY_SVC,
        hostServices.VERSION_2019_05
    );
}

/**
 * Notify Selection changes from the VisHost
 *  @param {Array} selectedCSChains - List of CloneStable uid strings representing selected occurrences
 */
var notifyVisHostSelectionChanges = function( selectedCSChains, bomlineSruids ) {
    // Subscribe to the ACE Selection Update event.
    _aceSelectionEvent = eventBus.subscribe( 'aceElementsSelectionUpdatedEvent', function() {
        _isHandlingTcVisSelections = false;
        if( _aceSelectionEvent ) {
            eventBus.unsubscribe( _aceSelectionEvent );
            _aceSelectionEvent = null;
        }
    } );
    if( _tcVisSelectionChangedListener.length > 0 ) {
        _.forEach( _tcVisSelectionChangedListener, function( observer ) {
            observer.call( null, selectedCSChains, bomlineSruids );
        } );
    }
};

/**
 * Notify Visibility changes from the VisHost
 *  @param {Object} objVisibilityInput -  Visibility changes response containing visible occurrences from vis host
 */
let notifyVisHostVisibityChanges = function( objVisibilityInput ) {
    let callerFunctions = Object.keys( objVisibilityInput );

    // Sort caller functions to ensure visibilityTurnedOff is called first if present
    callerFunctions.sort( function( callFuncNameA, callFuncNameB ) {
        if( callFuncNameA === 'visibilityTurnedOff' ) {
            return -1;
        }
        if( callFuncNameB === 'visibilityTurnedOff' ) {
            return 1;
        }
        return 0;
    } );

    if( _tcVisVisibilityChangedListener.length > 0 ) {
        _.forEach( callerFunctions, function( callerFunction ) {
            let desiredCSIDChains = objVisibilityInput[ callerFunction ].filter( obj => obj.type === 1 || obj.type === 5 );
            _.forEach( _tcVisVisibilityChangedListener, function( observer ) {
                observer[ callerFunction ].call( null, desiredCSIDChains );
            } );
        } );
    }
};

/**
 * Notify PackUnpack changes from the VisHost
 * @param {Array} affectedOccurrences - Array of objects that represent the affected occurrences (should be empty for "PackAll" and "UnpackAll")
 *                                      each object has 2 fields: OccType - integer indicating the type of the occurrence
 *                                                                OccString - string that contains the CS Chain
 */
let notifyVisHostPackUnpackChanges = function( affectedOccurrences ) {
    //get the pack/unpack event name based on event type
    let eventName = affectedOccurrences.eventData.action.name;
    switch( eventName ) {
        case 'Pack':
            _packUnpackEventName = 'packEvent';
            break;
        case 'Unpack':
            _packUnpackEventName = 'unPackEvent';
            break;
        case 'PackAll':
            _packUnpackEventName = 'packAllEvent';
            break;
        case 'UnpackAll':
            _packUnpackEventName = 'unPackAllEvent';
            break;
        default:
            break;
    }
    // Subscribe/unsubscribe to the ACE pack/unpack Update event.
    _acePackUnpackEvent = eventBus.subscribe( _packUnpackEventName, function() {
        _isHandlingTcVisPackUnpack = false;
        if( _acePackUnpackEvent ) {
            eventBus.unsubscribe( _acePackUnpackEvent );
            _acePackUnpackEvent = null;
        }
    } );
    if( _tcVisPackUnpackUpdateListener.length > 0 ) {
        _.forEach( _tcVisPackUnpackUpdateListener, function( observer ) {
            observer.call( null, affectedOccurrences );
        } );
    }
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Return a new instance of this class.
 *
 * @memberof hostVisQueryService
 *
 * @return {UpdateConfigContextAndSchemeHandler} Handler for Query.
 */
export let createUpdateConfigContextAndScheme = function() {
    return new UpdateConfigContextAndSchemeHandler();
};

/**
 * Handler for query to fetch applied partition scheme
 *
 * @memberof hostVisQueryService
 *
 * @return {GetAppliedPartitionSchemeHandler} Handler for Query.
 */
export let getAppliedPartitionScheme = function() {
    return new GetAppliedPartitionSchemeHandler();
};

/**
 * Handler for query to create Issue Report (i.e. Visual Issue)
 *
 * @memberof hostVisQueryService
 *
 * @return {Get_2020_07_CreateIssueHandler} Handler for Query.
 */
export let createIssue_2020_07 = function() {
    return new Get_2020_07_CreateIssueHandler();
};

/**
 * Handler for query to update occurrence visibilty
 *
 * @memberof hostVisQueryService
 *
 * @return {UpdateOccurrenceVisibiltyHandler} Handler for Query.
 */
export let updateOccurrenceVisibilty = function() {
    return new UpdateOccurrenceVisibiltyHandler();
};

/**
 * Handler for query to update occurrence selection
 *
 * @memberof hostVisQueryService
 *
 * @return {UpdateSelectionsHandler} Handler for Query.
 */
export let updateSelections = function() {
    return new UpdateSelectionsHandler();
};

/**
 * Handler for query to update Pack/Unpack event
 *
 * @memberof hostVisQueryService
 *
 * @return {UpdatePackUnpackHandler} Handler for Query.
 */
export let updatePackUnpack = function() {
    return new UpdatePackUnpackHandler();
};

/**
 * Selection has changed in AW ACE page. Need to notify Vis host of the selection change.
 * @memberof hostVisQueryService
 * @param {Array} selectedCSChains - Array of string that represent the selected occurrences.
 * @param {Array} selectedPartitions - Array of string that represent the selected partitions
 *
 */
export let sendSelectionsToVis = function( selectedCSChains, selectedPartitions ) {
    if( selectedCSChains || selectedPartitions ) {
        let messages = [];
        let dataObjects = [];
        let dataObject = buildDataObjectForSelections( selectedCSChains, selectedPartitions );
        dataObjects.push( dataObject );
        let message = hostQueryFactorySvc.createMessageWithID( UPDATE_OCC_SELECTION, dataObjects );
        messages.push( message );
        fireAsyncQueryToVisHost( messages );
    }
};

/**
 * Need to notify Vis host for delta update.
 */
export let sendDeltaUpdateToVis = function( ) {
    let messages = [];
    let dataObjects = [];
    let message = hostQueryFactorySvc.createMessageWithID( DELTA_UPDATE, dataObjects );
    messages.push( message );
    fireAsyncQueryToVisHost( messages );
};

/**
 * Visibility has changed in AW ACE page. Need to notify Vis host of the visibility change.
 * @param {Array} occList list of occurences to update
 * @param {Boolean} visible occurence visible or not
 * @param {Boolean} isStateChange is state needs to updated
 * @param {Boolean} isNotifyChange is notification needed
 *
 */
export let sendVisibilityToVis = function( occList, visible, isStateChange, isNotifyChange ) {
    if( occList.length > 0 ) {
        let messages = [];
        let dataObjects = [];
        let dataObject = buildDataObjectForVisibility( occList, visible, isStateChange, isNotifyChange );
        dataObjects.push( dataObject );
        let message = hostQueryFactorySvc.createMessageWithID( UPDATE_OCC_VISIBILITY, dataObjects );
        messages.push( message );
        fireAsyncQueryToVisHost( messages );
        //askVisForInitialState( 2 );
    }
};

/**
 * Set active partition scheme
 * @param {Object} refLineOcc CSID Occ of referenece BOM line
 * @param {Object} partitionSchemeOcc Occ for the partition scheme
 */
export let sendPartitionSchemeToHost = function( refLineOcc, partitionSchemeOcc ) {
    let messages = [];
    let dataObjects = [];
    let dataObject = hostQueryFactorySvc.createEditableData();
    dataObject.setData( 'refLineOcc', JSON.stringify( refLineOcc ) );
    dataObject.setData( 'partitionSchemeOcc', JSON.stringify( partitionSchemeOcc ) );
    dataObjects.push( dataObject );
    let message = hostQueryFactorySvc.createMessageWithID( SET_ACTIVE_PARTITION_SCHEME, dataObjects );
    messages.push( message );
    fireAsyncQueryToVisHost( messages );
};

/**
 * Pack/Unpack state has changed in AW ACE page. Need to notify Vis host of the Pack/Unpack state change.
 * @memberof hostVisQueryService
 * @param {String} eventType - Type of event. Either "Pack", "Unpack", "PackAll" or "UnpackAll"
 * @param {Array} affectedOccurrences - Array of objects that represent the affected occurrences (should be empty for "PackAll" and "UnpackAll")
 *                                      each object has 2 fields: OccType - integer indicating the type of the occurrence
 *                                                                OccString - string that contains the CS Chain
 *
 */
export let sendPackUnpackToVis = function( eventType, affectedOccurrences ) {
    if( eventType && affectedOccurrences ) {
        let messages = [];
        let dataObjects = [];
        let dataObject = buildDataObjectForPackUnpack( eventType, affectedOccurrences );
        dataObjects.push( dataObject );
        let message = hostQueryFactorySvc.createMessageWithID( UPDATE_PACK_UNPACK, dataObjects );
        messages.push( message );
        fireAsyncQueryToVisHost( messages );
    }
};

/**
 * Handle an async query response.
 * @memberof hostVisQueryService
 * @param {HostQueryMessage} queryResponse - The query response to handle.
 */
export let handleQueryResponse = function( queryResponse ) {
    var msgId = queryResponse.getMessageId();
    var responseHandler = _.get( _messageIdToResponseHandlerMap, msgId, null );
    if( responseHandler ) {
        responseHandler.handleQueryResponse( queryResponse );
        // Remove the handler after the response is received
        delete _messageIdToResponseHandlerMap[ msgId ];
    } else {
        logger.warn( 'No host query handler found for query id: ' + queryResponse.getQueryId() + ' with message id: ' + msgId );
    }
};

// ---------------------------------------------------------------------------------

/**
 * Initializes hostVisQueryService service.
 *
 * @memberof hostVisQueryService
 */
export let initialize = function() {
    logger.warn( 'Entered hostVisQueryService initialize()' );
    getQueryHandler( UPDATE_OCC_SELECTION );
    getQueryHandler( UPDATE_OCC_VISIBILITY );
    getQueryHandler( GET_APPLIED_PARTITION_SCHEME );
    getQueryHandler( UPDATE_CONFIG_CONTEXT_AND_SCHEME );
    getQueryHandler( UPDATE_PACK_UNPACK );
    getQueryHandler( VIS_ST_LINE_INFO_QUERYID );
    // See if the host supports InteropQuery based Selection events. If so then create the necessary
    // support objects. If not, then the original BIO selection services should be used to communicate
    // selection events to the host.
    hostQueryService.canHostHandleQueryAsync( UPDATE_OCC_SELECTION ).then( ( hostHasHandler ) => {
        if( hostHasHandler ) {
            if( !_hostVisViewerData ) {
                _hostVisViewerData = new HostVisViewerData();
            }

            if( _hostVisViewerData ) {
                _hostVisViewerData.initializeHostVisViewer();
            }
        }
    } );
};

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostVisQueryService
 */
export let registerHostingModule = function() {
    // Subscribe to subset content add or new Subset add or new Item Rev add
    eventBus.subscribe( 'addElement.elementsAdded', function() {
        if( isWorksetOpen() ) {
            configContextChanged( false );
        }
    } );

    // Subscribe to element removed from Subset
    eventBus.subscribe( 'ace.elementsRemoved', function() {
        if( isWorksetOpen() ) {
            configContextChanged( false );
        }
    } );

    // Subscribe to recipe change
    eventBus.subscribe( 'occmgmt4gf.recipeUpdated', function() {
        if( isWorksetOpen() ) {
            _eventSubDefs.push( eventBus.subscribe( 'occDataLoadedEvent', function() {
                configContextChanged( false );
            } ) );
        }
    } );

    // Subscribe to subset remove/delete
    eventBus.subscribe( 'cdm.deleted', function() {
        if( isWorksetOpen() ) {
            configContextChanged( false );
        }
    } );

    // Subscribe to saveAs success
    eventBus.subscribe( 'Awp0ShowSaveAs.saveAsComplete', function() {
        if( isWorksetOpen() ) {
            configContextChanged( false );
        }
    } );

    // Subscribe to filterOrRecipeChangedIn4G
    eventBus.subscribe( 'filterOrRecipeChangedIn4G', function() {
        if( isWorksetOpen() ) {
            configContextChanged( false );
        }
    } );


    eventBus.subscribe( 'appCtx.update', function( context ) {
        if( context && context.name === 'aceActiveContext' ) {
            if( context.target === 'context.configContext' &&
                Object.keys( context.value.aceActiveContext.context.configContext ).length > 0 ) {
                if( context.value.aceActiveContext.context.configContext.org_uid !== undefined ) {
                    if( _isClientHandlingPartitionSchemeQuery ) {
                        // Don't trigger a query if the client itself is handling a Partition Scheme Change via query
                        _isClientHandlingPartitionSchemeQuery = false;
                    } else if( isWorksetOpen() ) {
                        // Subscribe to scheme change
                        _eventSubDefs.push( eventBus.subscribe( 'productContextChangedEvent', function() {
                            configContextChanged( true );
                        } ) );
                    }
                } else if( isWorksetOpen() ) {
                    // Subscribe to configuration change
                    _eventSubDefs.push( eventBus.subscribe( 'productContextChangedEvent', function() {
                        configContextChanged( false );
                    } ) );
                }
            } else if( context.target === 'context.requestPref' && context.value.aceActiveContext.context.requestPref.replayRecipe !== undefined ) {
                if( isWorksetOpen() ) {
                    _eventSubDefs.push( eventBus.subscribe( 'occDataLoadedEvent', function() {
                        configContextChanged( false );
                    } ) );
                }
            }
        }
    } );
};

/**
 * Adds visibility event listener for any visibility changes in tcVis
 * @param {Function} observerFunctionObj observer function
 */
export let addVisibilityListenr = function( observerFunctionObj ) {
    if( typeof observerFunctionObj === 'object' ) {
        _tcVisVisibilityChangedListener.push( observerFunctionObj );
    }
};

/**
 * Removes visibility event listener
 * @param {Function} observerFunction observer function
 */
export let removeVisibilityEventListener = function( observerFunction ) {
    if( typeof observerFunction === 'function' ) {
        var indexToBeRemoved = _tcVisVisibilityChangedListener.indexOf( observerFunction );
        if( indexToBeRemoved > -1 ) {
            _tcVisVisibilityChangedListener.splice( indexToBeRemoved, 1 );
        }
    }
};
/**
 * Adds selection event listener for any selection changes in tcVis
 * @param {Function} observerFunction observer function
 * @memberof hostVisQueryService
 */
export let addSelectionEventListener = function( observerFunction ) {
    if( typeof observerFunction === 'function' ) {
        _tcVisSelectionChangedListener.push( observerFunction );
    }
};

/**
 * Removes selection event listener
 * @param {Function} observerFunction observer function
 * @memberof hostVisQueryService
 */
export let removeSelectionEventListner = function( observerFunction ) {
    if( typeof observerFunction === 'function' ) {
        var indexToBeRemoved = _tcVisSelectionChangedListener.indexOf( observerFunction );
        if( indexToBeRemoved > -1 ) {
            _tcVisSelectionChangedListener.splice( indexToBeRemoved, 1 );
        }
    }
};

/**
 * Removes all selection event listeners
 * @memberof hostVisQueryService
 */
export let removeAllSelectionEventListeners = function() {
    _tcVisSelectionChangedListener = [];
};

/**
 * Pack event listener for pack action in tcVis
 * @param {Function} observerFunction observer function
 * @memberof hostVisQueryService
 */
export let addPackUnpackUpdateEventListener = function( observerFunction ) {
    if( typeof observerFunction === 'function' ) {
        _tcVisPackUnpackUpdateListener.push( observerFunction );
    }
};

/**
 * Unpack event listener
 * @param {Function} observerFunction observer function
 * @memberof hostVisQueryService
 */
export let removePackUnpackUpdateEventListener = function( observerFunction ) {
    if( typeof observerFunction === 'function' ) {
        var indexToBeRemoved = _tcVisPackUnpackUpdateListener.indexOf( observerFunction );
        if( indexToBeRemoved > -1 ) {
            _tcVisPackUnpackUpdateListener.splice( indexToBeRemoved, 1 );
        }
    }
};

var STLineInfoHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

STLineInfoHandler.prototype = hostQueryFactorySvc.extendHandler();

STLineInfoHandler.prototype.setPromise = function( stLineInfoPromise ) {
    this.stLineInfoPromise = stLineInfoPromise;
};

STLineInfoHandler.prototype.getPromise = function() {
    return this.stLineInfoPromise;
};

STLineInfoHandler.prototype.handleQuery = function( inputMessage ) {
    if ( inputMessage && inputMessage.queryData && inputMessage.queryData[0] && inputMessage.queryData[0].dataFields ) {
        let st_uid = decodeURIComponent( inputMessage.queryData[0].dataFields.st_uid );
        this.stLineInfoPromise.resolve( st_uid );
    } else {
        this.stLineInfoPromise.reject( 'Invalid input message' );
    }
};

export let getSTLineInfoHandler = function() {
    if( !_messageIdToResponseHandlerMap[VIS_ST_LINE_INFO_QUERYID] ) {
        let stHandler = new STLineInfoHandler();
        _messageIdToResponseHandlerMap[VIS_ST_LINE_INFO_QUERYID] = stHandler;
    }
    return _messageIdToResponseHandlerMap[VIS_ST_LINE_INFO_QUERYID];
};

export let getVisUsedSTLine = function( inputMessage ) {
    let deferred = AwPromiseService.instance.defer();

    _messageIdToResponseHandlerMap[VIS_ST_LINE_INFO_QUERYID].setPromise( deferred );

    let dataObject = hostQueryFactorySvc.createEditableData();
    dataObject.setData( 'QueryId', VIS_ST_LINE_INFO_QUERYID );

    let message = hostQueryFactorySvc.createMessageWithID( VIS_ST_LINE_INFO_QUERYID, [ dataObject ] );
    fireAsyncQueryToVisHost( [ message ] );

    return deferred.promise;
};


export default exports = {
    createUpdateConfigContextAndScheme,
    getAppliedPartitionScheme,
    createIssue_2020_07,
    updateOccurrenceVisibilty,
    updateSelections,
    sendSelectionsToVis,
    handleQueryResponse,
    initialize,
    registerHostingModule,
    sendVisibilityToVis,
    sendDeltaUpdateToVis,
    addVisibilityListenr,
    removeVisibilityEventListener,
    addSelectionEventListener,
    removeSelectionEventListner,
    reconfigureViewerToHost,
    sendReloadToHost,
    sendReloadToHostForSnapshot,
    sendPartitionSchemeToHost,
    updatePackUnpack,
    sendPackUnpackToVis,
    addPackUnpackUpdateEventListener,
    removePackUnpackUpdateEventListener,
    buildDataObjectForPackUnpack,
    removeAllSelectionEventListeners,
    getSTLineInfoHandler,
    getVisUsedSTLine
};
