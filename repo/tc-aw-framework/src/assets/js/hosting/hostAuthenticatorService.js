// Copyright (c) 2022 Siemens

/**
 * Authenticator implementation for handling authentication interaction in a hosted environment.
 *
 * @module js/hosting/hostAuthenticatorService
 * @namespace hostAuthenticatorService
 */
import tcSessionData from 'js/TcSessionData';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import contextSvc from 'js/sessionContext.service';
import sessionMgrSvc from 'js/sessionManager.service';
import soaSvc from 'soa/kernel/soaService';
import sessionSvc from 'soa/sessionService';
import hostSupportSvc from 'js/hosting/hostSupportService';
import hostConfigSvc from 'js/hosting/hostConfigService';
import hostConfigValues from 'js/hosting/hostConst_ConfigValues';
import hostInteropSvc from 'js/hosting/hostInteropService';
import hostSessionSvc from 'js/hosting/inf/services/hostSession_2014_07';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import hostServices from 'js/hosting/hostConst_Services';
import hostConfigKeys from 'js/hosting/hostConst_ConfigKeys';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import localStrg from 'js/localStorage';

// service
import AwBaseService from 'js/awBaseService';
import AwPromiseService from 'js/awPromiseService';

class HostAuthenticatorService extends AwBaseService {
    constructor() {
        super();

        /**
         * url Attrs object
         */
        var urlAttrs = browserUtils.getWindowLocationAttributes();

        /**
         * {Boolean} TRUE if ... should be logged.
         */
        this._debug_logHandShakeActivity = urlAttrs.logHandShakeActivity !== undefined;

        /**
         * {Boolean} TRUE if ... do login soa call first.
         */
        this._awLoginFirst = urlAttrs.AwLogin ? urlAttrs.AwLogin.trim().toLowerCase() === 'true' : false;

        /**
         * this is a continuation used by the canIProcess logic.
         */
        this._canIProcessDeferral;

        /**
         * Object used to hold the result of the last successful call to 'getTCSessionInfo' API.
         */
        this._tcSessionInfoResponse = null;

        /**
         * A 'timeout' used to handle when the 'host' does not responde is a fix period of time.
         */
        this._hostingStartupTimeoutHdlr;

        /**
         * Register for this hosting specific event.  It gets triggered once all the Hosting service
         * registration and Handshake process completes. Can't really invoke any host interop services or checks
         * till that completes.
         */
        this._configuredDeferral = AwPromiseService.instance.defer();

        /**
         * This authenticator has NO client UI
         *
         * @memberof hostAuthenticatorService
         */
        this.isInteractive = false;

        if( hostConfigSvc.isSet() ) {
            if( this._debug_logHandShakeActivity ) {
                hostInteropSvc.log( 'hostAuthenticatorService: hosting.configured already set' );
            }
            this._configuredDeferral.resolve();
        } else {
            eventBus.subscribe( 'hosting.configured', () => {
                if( this._debug_logHandShakeActivity ) {
                    hostInteropSvc.log( 'hostAuthenticatorService: hosting.configured' );
                }

                this._configuredDeferral.resolve();
            } );
        }
    }

    /**
     * Stop pending timeout
     *
     * @param {String} reasonMsg - Debug msg for how we got here.
     */
    clearTimeoutFunc( reasonMsg ) {
        if( this._hostingStartupTimeoutHdlr ) {
            if( this._debug_logHandShakeActivity ) {
                hostSupportSvc.log( 'hostAuthenticatorService: Clearing startup timeout function - clearTimeout: ' + reasonMsg );
            }

            clearTimeout( this._hostingStartupTimeoutHdlr ); // kill the timeout function

            this._hostingStartupTimeoutHdlr = null;
        }
    }

    /**
     * handler for processing the GetTCSessionInfo response message.
     *
     * Not - this subroutine logic is duplicated in the ssoAuthenticator. If you make changes, ensure it
     * stays in sync.
     *
     * @param {String} soaOkResp - Response string from the service call.
     */
    static _sessionInfoSuccessHandling( soaOkResp ) {
        if( tcSessionData ) {
            tcSessionData.parseSessionInfo( soaOkResp );
        }

        // replaces the SessionUpdateEvent
        eventBus.publish( 'session.updated' );
    }

    /**
     * Get security token from either host configuration or call host to request it.
     *
     * @returns {Promise} Promise reolved when security token got from host
     */
    static getAuthToken( ) {
        if ( hostConfigSvc.getOption( hostConfigKeys.HOST_SESSION_SECURITY_TOKEN ) ) {
            return Promise.resolve( hostConfigSvc.getOption( hostConfigKeys.HOST_SESSION_SECURITY_TOKEN ) );
        }
        return soaSvc.postUnchecked( 'Internal-Core-2014-11-Session', 'getSecurityToken', { duration: 300 } ).then( ( responseData ) => {
            return responseData.out;
        } );
    }

    /**
     * Make a Login call first from AW with all the available information. To get the password we make the
     *  _getSecureToken call, and the password is valid for 5 minutes which is enough in this case.
     *
     * @param {String} discriminator - host session discriminator used during SOA login
     *
     * @returns {Promise} Promise resolved when the new login is sucessful.
     */
    static doAwLoginFirst( discriminator ) {
        soaSvc.setClientIdHeader( '' );

        return HostAuthenticatorService.getAuthToken()
            .then( ( responseData ) => {
                const secureToken = responseData;

                if ( !secureToken || !contextSvc ) {
                    throw  new Error( 'Security token or context service unavailable.' );
                }

                const role = contextSvc.getUserRole();
                const group = contextSvc.getUserGroup();
                const userName = contextSvc.getUserName();
                const userLocale = contextSvc.getUserLocale();

                return sessionSvc.signIn( userName, secureToken, group, role, userLocale, discriminator, true );
            } )
            .then( () => {
                localStrg.publish( sessionSvc.SESSION_DISCRIMINATOR_KEY, discriminator );
                if( hostInteropSvc.isRemoteHostingEnabled() || appCtxSvc.ctx.disableHostSOAAfterLogin ) {
                    hostSupportSvc.setSoaSupportEnabled( false );
                }
                return soaSvc.getTCSessionInfo( true );
            } )
            .then( ()=> {
                // Check if the discriminator is same as the one from existing session
                const sessionDiscr = localStrg.get( 'sessionDiscriminator' );
                HostAuthenticatorService.doHostSetting( discriminator, sessionDiscr );
            } )
            .catch( error  => {
                throw error;
            } );
    }

    /**
     * Get Secure Tokens Method When Hosted if we have to view the viewer Tab, we must make a Login call
     * from AW with all the available information. To get the password we make the _getSecureToken call, and
     * the password is valid for 5 minutes which is enough in this case.
     *
     * @param {String} discriminator - host session discriminator used during SOA login
     *
     * @returns {Promise} Promise resolved when the new login is sucessful.
     */
    static getSecureToken( discriminator ) {
        /*
        * LCS-408704
        * https://gitlab.industrysoftware.automation.siemens.com/ActiveWorkspace/BrowserInterOp/-/wikis/clientID-header-and-lingering-tcserver-processes
        * Set the clientID header to nothing such that hosted AW isn't counted in tcserver's ref count
        */
        soaSvc.setClientIdHeader( '' );


        //Direct use 'getTCSessionAnalyticsInfo' without set userSession object property policy, no userid
        //is returned from server, causing late gateway authentication validation on fms ticket failed.
        //use soaSvc.getTCSeessionInfo API to get user object back with minimum impact for hosting.

        return soaSvc.getTCSessionInfo( true ).then( () => {
            // Since there's already an established session, continue using it w/o logging.

            // Check if the discriminator is same as the one from existing session
            const sessionDiscr = localStrg.get( 'sessionDiscriminator' );

            if ( appCtxSvc.ctx.aw_host_type === hostConfigValues.HOST_TYPE_VIS ) {
                // Vis need getSecurityCall to display security warning message
                return soaSvc.postUnchecked( 'Internal-Core-2014-11-Session', 'getSecurityToken', { duration: 300 } ).then( () => {
                    HostAuthenticatorService.doHostSetting( discriminator, sessionDiscr );
                } );
            }

            HostAuthenticatorService.doHostSetting( discriminator, sessionDiscr );
        } ).catch( () => {
            // Store/publish session discriminator in local storage
            return HostAuthenticatorService.getAuthToken().then( ( responseData ) => {
                const secureToken = responseData;

                if( secureToken && contextSvc ) {
                    const role = contextSvc.getUserRole();
                    const group = contextSvc.getUserGroup();
                    const userName = contextSvc.getUserName();
                    const userLocale = contextSvc.getUserLocale();

                    localStrg.publish( sessionSvc.SESSION_DISCRIMINATOR_KEY, discriminator );

                    return sessionSvc.signIn( userName, secureToken, group, role, userLocale, discriminator, true ).then( () => {
                        return dms.getTCSessionInfo( true );
                    } ).then( () => {
                        if( hostInteropSvc.isRemoteHostingEnabled() || appCtxSvc.ctx.disableHostSOAAfterLogin ) {
                            hostSupportSvc.setSoaSupportEnabled( false );
                        }
                    } );
                }
            } );
        } );
    }

    /**
     * @returns {Boolean} TRUE if the User session is active.
     */
    static async getIsUserSessionActive() {
        var userName = localStrg.get( 'HostSessionUserName' ) || hostConfigSvc.getOption( hostConfigKeys.HOST_SESSION_USER_NAME );
        if ( userName ) {
            return Boolean( userName );
        }

        if( !hostSessionSvc.isHostSessionAccessible() ) {
            return false;
        }

        userName = await hostSessionSvc.getHostSessionUserInfo();
        if( userName && appCtxSvc.ctx.aw_hosting_config && appCtxSvc.ctx.aw_hosting_config.AllowCacheHostData ) {
            localStrg.publish( 'HostSessionUserName', userName );
        }
        return Boolean( userName );
    }

    /**
     * Called during login interaction, for ui scope population, not needed here.
     *
     * @memberof hostAuthenticatorService
     */
    // eslint-disable-next-line class-methods-use-this
    setScope() {
        // nothing to do here.
    }

    /**
     * Set some hosting configuration after AW logins
     *
     * @param {String} discriminator - Session Discriminator from host configuration
     * @param {String} sessionDiscr - Session Discriminator from local storage
     */
    static doHostSetting( discriminator, sessionDiscr ) {
        if( hostInteropSvc.isRemoteHostingEnabled() || appCtxSvc.ctx.disableHostSOAAfterLogin ) {
            // Need to call this before enableServerStateForDiffServer() call.
            if ( hostSupportSvc.isSoaEnabled() ) {
                hostSupportSvc.setSoaSupportEnabled( false );
            }

            if ( hostInteropSvc.isRemoteHostingEnabled() && discriminator !== sessionDiscr ) {
                //In remoteHosting, two discriminators are different, want enableServerStateHeaders = true
                hostSupportSvc.enableServerStateForDiffServer();
            }
        }
    }

    /**
     * can I process authentication.... for Hosting this is really complicated. Since all the interop
     * services and hosting handshake is still run in GWT, we have to wait for that to complete. Then this
     * native code can start to deal with authentication. So there is a promise set up here to "wait" for
     * the gwt code to complete before we deal with the authentication checks.
     *
     * @memberof hostAuthenticatorService
     *
     * @returns {Promise} Resolved with true/false result.
     */
    canIProcess() {
        this._canIProcessDeferral = AwPromiseService.instance.defer();

        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( hostInteropSvc.getCurrentTime( ) + 'hostAuthenticatorService: Waiting on hosting.configured event' );
        }

        /**
         * We have to wait for the Host Handshake and configuration setup complete.
         */
        this._configuredDeferral.promise.then( () => { // success
            this.clearTimeoutFunc( 'Configured' );

            HostAuthenticatorService.getIsUserSessionActive().then( ( isUserSessionActive ) => {
                if( this._debug_logHandShakeActivity ) {
                    hostInteropSvc.log( hostInteropSvc.getCurrentTime( ) + 'hostAuthenticatorService: isUserSessionActive:' + isUserSessionActive );
                }

                /**
                 * Check if we do not have a valid session yet.
                 * <P>
                 * If so: Wait for an event from the session manager once we are logged in.
                 */
                if( !isUserSessionActive ) {
                    /**
                     * The 'session.updated' event is fired by the SessionManager when the user is
                     * reusing an existing session. If this happens, we should report back to the host
                     * that client-side startup is complete.
                     */
                    const subDef = eventBus.subscribe( 'session.updated', () => {
                        if( this._debug_logHandShakeActivity ) {
                            hostInteropSvc.log( 'hostAuthenticatorService: session.updated' );
                        }

                        eventBus.unsubscribe( subDef );

                        /**
                         * Announce that we should finish 'startup' now that we are signed in.
                         */
                        const startSvc = hostInteropSvc.findClientService2( hostServices.HS_CS_STARTUP_NOTIFICATION_SVC,
                            hostServices.VERSION_2014_02 );

                        if( startSvc ) {
                            startSvc.handleHostEventCall( 'OK' );
                        }
                    } );
                }

                /**
                 * Go ahead and resolve the 'can I process' promise.
                 */
                this._canIProcessDeferral.resolve( isUserSessionActive );
            } );
        }, () => { //failure
            if( this._debug_logHandShakeActivity ) {
                hostSupportSvc.log( 'hostAuthenticatorService: Startup defer ERROR handler.  Only resolved so should never get here.' );
            }

            this.clearTimeoutFunc( 'Error: Unconfigured' );

            this._canIProcessDeferral.resolve( false );
        } );

        // we need to set some timeout for the hosting startup, otherwise the client would just hang.
        this._hostingStartupTimeoutHdlr = setTimeout( () => {
            if( this._debug_logHandShakeActivity ) {
                hostSupportSvc.log( 'hostAuthenticatorService: Timeout function fires in hosting Auth!!' );
            }

            // put up an alert here?  we've waited long enough for hosting handshake...
            this._hostingStartupTimeoutHdlr = null;

            this._canIProcessDeferral.resolve( false );
        }, 120 * 1000 ); // 120 seconds

        return this._canIProcessDeferral.promise;
    }

    /**
     * function to determine if there is already a valid web session or not.
     *
     * @memberof hostAuthenticatorService
     */
    async checkIfSessionAuthenticated() {
        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( hostInteropSvc.getCurrentTime() + 'hostAuthenticatorService: checkIfSessionAuthenticated\n' +
                JSON.stringify( _.get( appCtxSvc.ctx, 'tcSessionData.server' ) ) );
        }

        this._tcSessionInfoResponse = null;
        // Initialize Type Display Name Service, Previously it was initialized in TcSessionData through angular
        // injection but after service conversion and typeDisplayName service is a class we need to initialize here.
        TypeDisplayNameService.instance;

        // Flag indicates using host authenticator not AW authenticator.
        appCtxSvc.ctx.aw_hosting_host_auth = true;
        let soaOkResp;
        if ( appCtxSvc.ctx.aw_host_component && !this._awLoginFirst ) {
            hostSupportSvc.setSoaSupportEnabled( false );
            soaSvc.setClientIdHeader( '' );
            soaOkResp = await dms.getTCSessionInfo( true );
        } else {
            soaOkResp = await dms.getTCSessionInfo();
        }
        HostAuthenticatorService._sessionInfoSuccessHandling( soaOkResp );

        this._tcSessionInfoResponse = soaOkResp;

        /**
         * For Hosting, since the auth is handled externally, we actually expect this to succeed. rather
         * than drive web UI interaction.  So treat this as the result of successful authentication, and
         * let the session manager continue.
         */
        await sessionMgrSvc.authenticationSuccessful( appCtxSvc.ctx.plcomponent_site );
    }

    /**
     * authenticator specific function to carry out authentication.
     *
     * For Hosting, since the authentication is in the host process, we can skip this and just resolve the
     * promise.
     *
     * @memberof hostAuthenticatorService
     *
     * @returns {Promise} Promise resolved when user is authenticated.
     */
    async authenticate() {
        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( 'hostAuthenticatorService: authenticate' );
        }

        /**
         * Sort of like the SSO case, we shouldn't really get here, as the check path should find a valid
         * host session and never come to the checkAuth route.... hosting and we just talked to the host, so
         * proceed....
         */
    }

    /**
     * Called during the authentication process. It gets invoked after the authentication is
     * completed/ready. It is a spot to do any session level initialization.
     *
     * @memberof hostAuthenticatorService
     *
     * @returns {Promise} Promise resolved at the end of user authorization.
     */
    postAuthInitialization() {
        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization' );
        }

        /**
         * Setup to tell host setup is complete AFTER authentication is complete.
         */
        const startupNotificationSvc = hostInteropSvc.findClientService2(
            hostServices.HS_CS_STARTUP_NOTIFICATION_SVC,
            hostServices.VERSION_2014_02 );

        if( startupNotificationSvc ) {
            eventBus.subscribe( 'authentication.complete', ( eventData ) => {
                if( this._debug_logHandShakeActivity ) {
                    hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 7\n' +
                        JSON.stringify( eventData ) );
                }
                startupNotificationSvc.handleHostEventCall( eventData.status );
            } );
        }

        const deferred = AwPromiseService.instance.defer();

        /**
         * Check if NO response was received during 'checkIfSessionAuthenticated' OR if there is no 'window'
         * object because we are being run during karma/jasmine unit testing
         * <P>
         * If so: Call 'getTCSessionInfo' now to make sure this SOA API gets called.
         */
        if( !this._tcSessionInfoResponse || !window ) {
            if( this._debug_logHandShakeActivity ) {
                hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 1\n' +
                    JSON.stringify( _.get( appCtxSvc.ctx, 'tcSessionData.server' ) ) );
            }

            dms.getTCSessionInfo().then( ( soaOkResp ) => {
                if( this._debug_logHandShakeActivity ) {
                    hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 2' );
                }

                HostAuthenticatorService._sessionInfoSuccessHandling( soaOkResp );

                deferred.resolve();
            }, ( err ) => {
                if( this._debug_logHandShakeActivity ) {
                    hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 4 err=' + err );
                }

                deferred.reject( err );
            } );
        } else if ( !appCtxSvc.ctx.aw_host_component || this._awLoginFirst  || hostInteropSvc.isRemoteHostingEnabled() ) {
            if( this._debug_logHandShakeActivity ) {
                hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 5' );
            }

            if( !hostConfigSvc.isSet() ) {
                eventBus.subscribe( 'hosting.configured', () => {
                    let result;
                    /**
                     * Make the getSecureToken call and trigger a new login call from AW (but only if a valid
                     * 'discriminator' was provided by this 'host')
                     */
                    const discriminator = hostConfigSvc.getOption( hostConfigKeys.HOST_DISCRIMINATOR );

                    if( discriminator ) {
                        result = HostAuthenticatorService.getSecureToken( discriminator );
                    }

                    deferred.resolve( result );
                } );
            } else {
                let result;
                const discriminator = hostConfigSvc.getOption( hostConfigKeys.HOST_DISCRIMINATOR );

                if( discriminator ) {
                    if ( this._awLoginFirst ) {
                        result = HostAuthenticatorService.doAwLoginFirst( discriminator );
                    } else {
                        result = HostAuthenticatorService.getSecureToken( discriminator );
                    }
                }

                deferred.resolve( result );
            }
        } else {
            this._tcSessionInfoResponse = null;
            return deferred.resolve();
        }

        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( 'hostAuthenticatorService: postAuthInitialization: 6' );
        }

        this._tcSessionInfoResponse = null;

        return deferred.promise;
    }

    /**
     * authenticator function to perform the signout. In this SSO situation we do the same Tc soa call to
     * end the tc session, but then also need to terminate the sso managed session.
     *
     * @memberof hostAuthenticatorService
     *
     * @returns {Promise} Promise resolved once operation is complete.
     */
    async signOut() {
        if( this._debug_logHandShakeActivity ) {
            hostInteropSvc.log( 'hostAuthenticatorService: signOut' );
        }

        localStrg.removeItem( sessionSvc.SESSION_DISCRIMINATOR_KEY );

        localStrg.removeItem( hostConfigSvc.HOST_CONFIG_SETTINGS );

        localStrg.removeItem( hostSupportSvc.HOST_SESSION_USER_NAME );

        /**
         * Note: This is a no-op for the hosted situation. The host process owns any connection.
         */
    }
}

export default HostAuthenticatorService.instance;
