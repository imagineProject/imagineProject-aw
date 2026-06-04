// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0hostInboxUtils
 */
import appCtxSvc from 'js/appCtxService';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';

/**
 * Define public API
 */
var exports = {};

/**
 * This method and feedback service retuns feedback associated to BIO Service
 *
 * Host object feedback message service
 *
 * @param {Object} data - data message
 */
export let sendEventToHost = function( data ) {
    if( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        var uid;
        var feedbackMessage;
        var objectRef;
        var feedbackProxy;

        var curHostedComponentId = appCtxSvc.getCtx( 'aw_hosting_state.currentHostedComponentId' );
        if( curHostedComponentId === 'com.siemens.splm.client.inbox.internal.goinbox'  ) {
            if( data.createdChangeObject !== null ) {
                uid = data.createdChangeObject.uid;
                feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
                objectRef = objectRefSvc.createBasicRefByModelObject( data.createdChangeObject );
                feedbackMessage.setFeedbackTarget( uid );
                feedbackMessage.setFeedbackTarget( objectRef );
                feedbackMessage.setFeedbackString( 'ECN GoInbox Successfully Opened' );
                feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
                feedbackProxy.fireHostEvent( feedbackMessage );
            }
        } else if( curHostedComponentId === 'com.siemens.splm.client.inbox.internal.reassign' ) {
            if( data.createdChangeObject !== null ) {
                feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
                objectRef = objectRefSvc.createBasicRefByModelObject( data.createdChangeObject );
                feedbackMessage.setFeedbackTarget( objectRef );
                feedbackMessage.setFeedbackString( 'ECN Ressign Task Successfully created' );
                feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
                feedbackProxy.fireHostEvent( feedbackMessage );
            }
        }
    }
};


/**
 * This factory creates a service and returns exports
 *
 * @member Awp0hostInboxUtils
 */

export default exports = {
    sendEventToHost
};
