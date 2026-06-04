import { postInit } from 'js/hosting/hostSupportService';
import sessionManager from 'js/sessionManager.service';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
const intializeHosting = () => {
    return new Promise( resolve => {
        const token = eventBus.subscribe( 'appCtx.register', ( event ) => {
            if( event.name === 'aw_hosting_enabled' && event.value === true ) {
                eventBus.unsubscribe( token );
                return resolve( 'initialized' );
            }
        } );
        postInit();
    } );
};
const handleAuthentication = () => {
    return new Promise( resolve => {
        const token = eventBus.subscribe( 'appCtx.register', ( event ) => {
            if( event.name === 'host_component_setup' && event.value === true ) {
                eventBus.unsubscribe( token );
                return resolve( 'initialized' );
            }
        } );
        sessionManager.validateSessionForComponent();
    } );
};

export const handleBootstrap = async() => {
    const urlAttrs = browserUtils.getWindowLocationAttributes();
    if( urlAttrs.ah && urlAttrs.ah.trim().toLowerCase() === 'true' ) {
        await intializeHosting();
        await handleAuthentication();
    }
};

export default {
    handleBootstrap
};
