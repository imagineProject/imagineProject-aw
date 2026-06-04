import AwLink from 'viewmodel/AwLinkViewModel';
import AwProgressIndicator from 'viewmodel/AwProgressIndicatorViewModel';

export const backGroundRender = ( props ) => {
    const isLoading = props.viewModel.data.isLoading;
    const classname = isLoading ? 'ssoloader' : 'ssoloader none';
    return (
        <div className='ssocontainer'>
            <div>
                <div className={classname}>
                    <AwProgressIndicator name='ssoloader'></AwProgressIndicator>
                </div>
                <div className='text-container'>
                    <h3>{isLoading ? props.i18n.loginProgress : props.i18n.windowClosed}</h3>
                    <br/>
                    {
                        isLoading ?
                            <a href='/#/sso.host.popup' rel='opener' target='_blank'>{props.i18n.openLoginWindow}</a> :
                            <>
                                <br/>
                                <AwLink {...props.fields.openPopupLink} action={props.actions.backgroundOnMount}></AwLink>
                            </>
                    }
                </div>
            </div>
        </div>
    );
};

const openPopup = () => {
    const mtop = window.outerHeight * 10 / 100;
    const mheight = window.outerHeight * 80 / 100;
    const mwidth = window.outerWidth * 60 / 100;
    const mleft = window.outerWidth * 20 / 100;

    // window.open is not widely supported in safari
    return window.open( `${location.origin}${location.pathname}#/sso.host.popup`, 'popup', 'popup,left=' + mleft + ',top=' + mtop + ',width=' + mwidth + ',height=' + mheight );
};

export const backgroundOnMount = ( dispatch ) => {
    const popup = openPopup();

    // popup blocked or Opened into new BCG(Browser Context Group)
    if ( !popup || popup.closed ) {
        return {
            isLoading: false
        };
    }

    const onBeforeUnload = () => {
        // before this page is closed or refreshed
        if ( popup ) {
            // close the popup
            popup.close();
        }
    };

    const onMessage = ( event ) => {
        // message from popup if popup can use window.opener to message that login is successful
        if ( event.origin === window.location.origin && event.data === 'closepopup' ) {
            if ( popup ) {
                popup.close();
            }
            // reload the page, reload can happen from sessionManagerService
            location.reload();
        }
    };

    window.addEventListener( 'beforeunload', onBeforeUnload );
    window.addEventListener( 'message', onMessage );

    const checkPopup = setInterval( () => {
        // user closed the popup
        if ( !popup || popup.closed ) {
            if ( dispatch ) {
                dispatch( { path: 'data.isLoading', value: false } );
            }
            window.removeEventListener( 'beforeunload', onBeforeUnload );
            window.removeEventListener( 'message', onMessage );
            clearInterval( checkPopup );
        }
    }, 1000 );

    return {
        isLoading: true
    };
};

export const popupRender = ( props ) => {
    return <h3>{props.i18n.loginSuccess}</h3>;
};

export const popupOnMount = () => {
    if ( window.opener && window.opener !== window ) {
        window.opener.postMessage( 'closepopup', window.location.origin );
    }
    window.close();
};

export default {
    backGroundRender,
    backgroundOnMount,
    popupRender,
    popupOnMount
};
