// Copyright (c) 2022 Siemens

/**
 * @module js/adobeHostingService
 */
import fileTicket from 'js/hosting/sol/services/hostFileTicket_2014_10';
import eventBus from 'js/eventBus';
import hostQueryFactoryService from 'js/hosting/hostQueryFactoryService';
import hostQuerySvc_2015_10 from 'js/hosting/sol/services/hostQuery_2015_10';

var exports = {};

/**
 * Register the hosting module
 */
export let registerHostingModule = function() {
    eventBus.subscribe( 'dataset.openFileFromTicket', function( eventData ) {
        if( !eventData.scope.ctx.aw_hosting_enabled || eventData.scope.ctx.aw_host_type !== 'ADOBE' ) {
            return;
        }

        var msg = {
            OperationType: 'BROWSER_DOWNLOAD',
            Filename: eventData.scope.data.downloadedFile.tickets[ 0 ][ 0 ].props.original_file_name.dbValues[ 0 ],
            Ticket: eventData.scope.data.downloadedFile.tickets[ 1 ][ 0 ]
        };

        var ticketProxy = fileTicket.createGetTicketResponseProxy();
        var ticketMsg = fileTicket.createGetTicketMsg( JSON.stringify( msg ) );
        ticketProxy.fireHostEvent( ticketMsg );
    }, 'adobeHostingService' );
};

const openInHost = function( ctx ) {
    const primarySelection = ctx.pselected?.uid ?? '';
    let modelObjs = ctx.mselected;
    const relationInfos = ctx.relationContext?.relationInfo ?? [];

    if( !( modelObjs instanceof Array ) ) {
        modelObjs = [ modelObjs ];
    }

    const dataObjects = [];
    for( const modelObj of modelObjs ) {
        const dataObject = hostQueryFactoryService.createEditableData();
        let relationType = '';
        dataObject.setData( 'primarySelectionUID', primarySelection );
        for( const relationInfo of relationInfos ) {
            if( relationInfo.primaryObject?.uid === primarySelection && relationInfo.secondaryObject?.uid === modelObj.uid ) {
                if( relationInfo.relationType ) {
                    relationType = relationInfo.relationType;
                }
                break;
            }
        }
        dataObject.setData( 'relation', relationType );
        dataObject.setData( 'ObjId', modelObj.uid ?? '' );
        dataObject.setData( 'ObjType', modelObj.type ?? '' );

        dataObjects.push( dataObject );
    }

    const message = hostQueryFactoryService.createMessageWithID( 'com.siemens.splm.client.adobe.OpenInHost', dataObjects );
    hostQuerySvc_2015_10.createHostQueryProxy().fireHostEvent( [ message ] );
};

export default exports = {
    registerHostingModule,
    openInHost
};
