// Copyright (c) 2022 Siemens

/**
 * @module js/aceShowObjectCellDelegateService
 */
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import adapterService from 'js/adapterService';
import eventBus from 'js/eventBus';

var exports = {};

/*
 * This method performs open action for showObjectCellCommand for ACE
 */
export let openObject = function( openedObject, page, pageId ) {
    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};
    toParams.page = page;
    toParams.pageId = pageId;

    var options = {
        inherit: false
    };

    if( openedObject.type === 'Awp0XRTObjectSetRow' ) {
        if( openedObject.props.awp0Relationship.displayValues[ 0 ] === 'Awb0ContextProvider' ) {
            toParams.uid = openedObject.props.awp0Secondary.dbValue;
            var contextDataParams = {};
            contextDataParams.componentID = openedObject.props.awp0Primary.dbValue;
            appCtxService.registerCtx( 'contextData', contextDataParams );

            // occDataLoadedEvent is called after getOcc*() call, Listen to the event and unRegisterCtx 'contextData'
            var _onOccDataLoadedEvt = eventBus.subscribe( 'occDataLoadedEvent', function() {
                appCtxService.unRegisterCtx( 'contextData' );
                eventBus.unsubscribe( _onOccDataLoadedEvt );
            }, 'aceShowObjectCellDelegateService' );
        } else {
            throw 'ACE openObject cell command delegate should not be called from any other XRT section than where used context.';
        }
    } else {
        var underlyingObject = adapterService.getAdaptedObjectsSync( [ openedObject ] );
        toParams.uid = underlyingObject[ 0 ].uid;
    }

    AwStateService.instance.go( transitionTo, toParams, options );
};

export default exports = {
    openObject
};
