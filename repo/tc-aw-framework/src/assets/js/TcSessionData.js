// Copyright (c) 2023 Siemens
/* eslint-disable @swf/swf/no-analytics-service-usage */

/**
 * native implementation for TcSessionData. This tracks some Teamcenter specific version information and user session
 * related apis.
 *
 * @module js/TcSessionData
 */
import awSvrVer from 'js/TcAWServerVersion';
import appCtxSvc from 'js/appCtxService';
import cfgSvc from 'js/configurationService';
import sessionCtxSvc from 'js/sessionContext.service';
import themeSvc from 'js/theme.service';
import _ from 'lodash';
import localStrg from 'js/localStorage';
import analyticsSvc from 'js/analyticsService';
import browserUtils from 'js/browserUtils';
import hostConfigKeys from 'js/hosting/hostConst_ConfigKeys';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import localeSvc from 'js/localeService';

let _displayCurrentCountry = false;
let _hasProjects = false;
let _tcServerVersion;
let _siteId;

const WEB_XML_SOA_PROXY_CONTEXT = 'tc/';
let _postLoginStages = [];
let exports = {};

/**
 * Given a complete path and file name, return just the file name
 * @param {*} longFilename complete absolute path
 * @return {String} Complete path and name of the log file.
 */
function getFilename( longFilename ) {
    let logFilename = longFilename;
    let lastSlash = logFilename.lastIndexOf( '\\' );
    if ( lastSlash !== -1 ) {
        logFilename = logFilename.substring( lastSlash + 1 );
    }
    return logFilename;
}

/**
 * Build the analytics data logging from the given SOA response.
 *
 * @param {*} appCtxSvc application CTX service from hasProjects
 *
 * @param {String} soaResponse - soa payload from GetTCSessionInfo with the version information and other
 *            parameters.
 */
function _logSessionData( appCtxSvc, soaResponse ) {
    if ( soaResponse.analyticsData ) {
        let solution;

        // Some of the data are required to be set before the SAN is initialized.
        let preInitData = {};
        preInitData.tags = {};
        preInitData.sanProductKey = '';
        preInitData.sanProductKey = soaResponse.analyticsData.analyticsExtraInfo?.sanProductKey;
        preInitData.isOptionalDataEnabled = soaResponse.analyticsData.isDataCollectionEnabled;
        preInitData.isNecessaryDataEnabled = soaResponse.analyticsData.analyticsExtraInfo?.isNecessaryDataEnabled === 'true';

        preInitData.tcServerVersion = soaResponse.analyticsData.analyticsExtraInfo?.tcserverVersion;

        if ( soaResponse.analyticsData.analyticsExtraInfo?.OnCloud && soaResponse.analyticsData.analyticsExtraInfo.OnCloud !== 'false' ) {
            preInitData.tags.accessPoint = soaResponse.analyticsData.analyticsExtraInfo.OnCloud.toLowerCase();
            localStorage.setItem( 'OnCloud', preInitData.tags.accessPoint );
        }

        if ( soaResponse.analyticsData.analyticsExtraInfo?.TcX_Tier_Name && soaResponse.analyticsData.analyticsExtraInfo.TcX_Tier_Name !== '' ) {
            preInitData.tags.productSKU = soaResponse.analyticsData.analyticsExtraInfo.TcX_Tier_Name.toLowerCase();
            localStorage.setItem( 'TcX_Tier_Name', preInitData.tags.productSKU );
        }

        // Deployment Environment - TC_SAN_Env_Type values are like PRD, UAT, DEV, etc.
        let envType = soaResponse.analyticsData.analyticsExtraInfo?.TC_SAN_Env_Type?.toLowerCase();
        if ( envType ) {
            if ( envType.startsWith( 'prd' ) || envType.startsWith( 'prod' ) ) {
                preInitData.tags.deploymentEnvironment = 'prd';
            } else if ( envType.startsWith( 'uat' ) ) {
                preInitData.tags.deploymentEnvironment = 'uat';
            } else if ( envType.startsWith( 'dev' ) ) {
                preInitData.tags.deploymentEnvironment = 'dev';
            } else {
                preInitData.tags.deploymentEnvironment = envType;
            }
        }

        preInitData.tags.edition = [];
        let licenseTypes = soaResponse.analyticsData.analyticsExtraInfo?.['License Type']?.trim();
        if( licenseTypes ) {
            let licenseTypeArray = licenseTypes.split( ' ' );
            for( let i in licenseTypeArray ) {
                preInitData.tags.edition.push( licenseTypeArray[i] );
            }
        }

        // Retrieve SAM Auth ID and email if set
        if ( soaResponse.analyticsData.analyticsExtraInfo?.SAM_ID && soaResponse.analyticsData.analyticsExtraInfo.SAM_ID !== '' ) {
            preInitData.user_id = soaResponse.analyticsData.analyticsExtraInfo.SAM_ID;
            // Store the SAM_ID in local storage to be used for CLP surveys
            localStorage.setItem( 'SAM_ID', soaResponse.analyticsData.analyticsExtraInfo.SAM_ID );
        } else {
            preInitData.user_id = soaResponse.userSession?.props?.user_id?.dbValues[0];
        }

        let userRole = soaResponse.userSession?.props?.role?.uiValues[0];
        if ( userRole ) {
            preInitData.tags.role = userRole;
        }

        if ( soaResponse.analyticsData.analyticsExtraInfo?.External_ID ) {
            preInitData.user_email = soaResponse.analyticsData.analyticsExtraInfo.External_ID;
        }

        // If TcX Essentials, the ECA ID will be passed in through the tenantId. If not set, use Vendor ID
        if ( soaResponse.analyticsData.analyticsExtraInfo?.tenantId ) {
            preInitData.vendor_id = soaResponse.analyticsData.analyticsExtraInfo.tenantId;
        } else if ( soaResponse.analyticsData.analyticsExtraInfo?.ecaId ) {
            //in TcX Premium ECA ID will be passed in through the ecaID. It will be the value set into the
            //preference ECA_ID. In case both ecaId and vendor is available. ECA ID will have more priority and sent to Analytics.
            preInitData.vendor_id = soaResponse.analyticsData.analyticsExtraInfo.ecaId;
            localStorage.setItem( 'ecaId', soaResponse.analyticsData.analyticsExtraInfo.ecaId );
        } else {
            preInitData.vendor_id = soaResponse.analyticsData.analyticsExtraInfo?.Vendor;
        }
        preInitData.user_license_level = soaResponse.analyticsData.analyticsExtraInfo?.UserLicenseLevel;
        preInitData.tags.user = preInitData.user_license_level;
        if ( soaResponse.analyticsData.analyticsExtraInfo?.ApplicationContext ) {
            preInitData.applicationContext = soaResponse.analyticsData.analyticsExtraInfo.ApplicationContext;
            preInitData.tags.package = preInitData.applicationContext;
        }

        if ( soaResponse.analyticsData.analyticsExtraInfo?.ApplicationEdition ) {
            preInitData.applicationEdition = soaResponse.analyticsData.analyticsExtraInfo.ApplicationEdition;
            preInitData.tags.edition.push( preInitData.applicationEdition );
        }

        preInitData.tags.clientProduct = getHostTypeTag( appCtxSvc, soaResponse );

        analyticsSvc.setPreInitData( preInitData );
        analyticsSvc.enable( soaResponse.analyticsData.useInternalServer, soaResponse.analyticsData.analyticsExtraInfo?.TC_SAN_Product_Repo ).then( function() {
            return cfgSvc.getCfg( 'solutionDef' );
        } ).then( function( solutionDef ) {
            solution = solutionDef;
            return cfgSvc.getCfg( 'versionConstants' );
        } ).then( function( versionConstants ) {
            let licenseUsageInfo = [];
            let dataModelInfo = [];
            let key;
            let deploymentType = soaResponse.analyticsData.analyticsExtraInfo?.DeploymentType;
            let isManagedSvs = soaResponse.analyticsData.analyticsExtraInfo?.isManagedSvs;

            for ( key in soaResponse.analyticsData.analyticsExtraInfo ) {
                if ( key.startsWith( 'licenseUsageInfo' ) ) {
                    let feature = key.substr( 'licenseUsageInfo'.length + 1 );
                    let data = soaResponse.analyticsData.analyticsExtraInfo[key].split( ' | ' );
                    let license_usage = data[0];
                    let date_range = data[1];
                    let user_count = data[2];
                    let purchased_lic = data[3];
                    let site = soaResponse.analyticsData.analyticsExtraInfo?.Site;
                    licenseUsageInfo.push( {
                        feature,
                        date_range,
                        license_usage,
                        site,
                        user_count,
                        purchased_lic
                    } );
                    delete soaResponse.analyticsData.analyticsExtraInfo[key];
                } else if ( key === 'DeploymentType' || key === 'isManagedSvs' || key === 'tenantId' ||
                        key === 'sanProductKey' || key === 'External_ID' || key === 'SAM_ID' || key === 'ecaId' ) {
                    delete soaResponse.analyticsData.analyticsExtraInfo[key];
                } else if ( key === 'InstalledTemplates' ) {
                    // Template names are sent in the format "template1-date1 | template2-date2 | template3-date3"
                    let templates = soaResponse.analyticsData.analyticsExtraInfo[key].split( ' | ' );
                    let siteId = soaResponse.analyticsData.analyticsExtraInfo?.Site;
                    templates.forEach( function( template ) {
                        let templateInfo = template.split( '-' );
                        let internalTemplateName = templateInfo[0];
                        let deployDate = templateInfo[1];
                        if ( internalTemplateName && deployDate ) {
                            dataModelInfo.push( { siteId, deployDate, internalTemplateName } );
                        }
                    } );
                    delete soaResponse.analyticsData.analyticsExtraInfo[key];
                }
            }

            let idleReporting = eventBus.subscribe( 'idle', function() {
                licenseUsageInfo.forEach( function( item ) {
                    analyticsSvc.logAnalyticsEvent( solution.analyticsKeyIdentifier + ' licenseUsageInfo', item );
                } );
                dataModelInfo.forEach( function( item ) {
                    analyticsSvc.logAnalyticsEvent( solution.analyticsKeyIdentifier + ' dataModel', item );
                } );
                eventBus.unsubscribe( idleReporting );
            } );

            // Add the analytics properties from the SOA Response to property object
            // and Teamcenter Server version, Active workspace server version, theme
            let property = _.assign( {}, soaResponse.analyticsData.analyticsExtraInfo );

            property.clientVersion = versionConstants.version;
            property.serverVersion = awSvrVer.baseLine;
            property.clientLocale = soaResponse.userSession?.props?.fnd0locale?.dbValues[0];
            let currentTheme = themeSvc.getTheme();
            currentTheme = analyticsSvc.publishableValue( currentTheme, 'Theme' );

            property['Theme In Use'] = currentTheme;
            property['AW Client Width'] = parseInt( window.innerWidth );
            property['AW Client Height'] = parseInt( window.innerHeight );
            property['Browser Zoom Level'] = Math.round( window.devicePixelRatio * 100 );


            let hostApp = 'Standalone';
            if ( appCtxSvc.ctx.aw_host_type ) {
                hostApp = appCtxSvc.ctx.aw_host_type;
            }
            property['Host Application'] = hostApp;

            if ( appCtxSvc.ctx.aw_hosting_config ) {
                let hostVersion = appCtxSvc.ctx.aw_hosting_config[hostConfigKeys.HOST_VERSION_INFO];
                if ( hostVersion ) {
                    property['Host Version'] = hostVersion;
                }
            }

            // Make sure that we are not reporting Vendor Id
            if ( property.Vendor ) {
                delete property.Vendor;
            }

            if ( userRole ) {
                analyticsSvc.logProductInfo( 'Role', userRole );
                property.Role = userRole;
            }
            analyticsSvc.logProductInfo( 'Participating', 'Opt-In' );
            analyticsSvc.logProductInfo( 'DeploymentType', deploymentType );
            analyticsSvc.logProductInfo( 'isManagedService', isManagedSvs );
            analyticsSvc.logEvent( solution.analyticsKeyIdentifier, property );
        } );
    }
}

/**
 * set isCommandBuilderAdmin into ctx.
 *
 * @param {*} appCtxSvc application CTX service
 *
 * @param {String} soaResponse - soa payload from GetTCSessionInfo with the version information and other
 *            parameters.
 */
function _setCommandBuilderAdmin( appCtxSvc, soaResponse ) {
    let dbaPrivilege = false;
    let groupUID = _.get( soaResponse, 'userSession.props.group.dbValues[0]' );
    if ( groupUID && groupUID !== '' ) {
        let privilege = _.get( soaResponse, 'ServiceData.modelObjects.' + groupUID + '.props.privilege.dbValues[0]' );
        if ( privilege === '1' ) {
            dbaPrivilege = true;
        }
    }
    appCtxSvc.registerCtx( 'isCommandBuilderAdmin', dbaPrivilege );
}

/**
 * configures the host type as an Analytics PN name to be used as a SAN tag.
 *
 * @param {*} appCtxSvc application CTX service
 *
 * @param {String} soaResponse - soa payload from GetTCSessionInfo with the version information and other
 *            parameters.
 *
 * @return {String} hostType - host type to be used as an Analytics PN name.
 */
function getHostTypeTag( appCtxSvc, soaResponse ) {
    let sanProductRepo = soaResponse.analyticsData.analyticsExtraInfo?.TC_SAN_Product_Repo ? soaResponse.analyticsData.analyticsExtraInfo.TC_SAN_Product_Repo : 'TcAW';
    let hostType = sanProductRepo;
    if( appCtxSvc.ctx.aw_host_type ) {
        hostType = appCtxSvc.ctx.aw_host_type;
    }
    return hostType;
}

/**
 * given the SOA response for GetTCSessionInfo3, pull out the version strings and other information.
 *
 * @param {String} soaResponse - soa payload from GetTCSessionInfo with the version information and other
 *            parameters.
 */
export let parseSessionInfo = function( soaResponse ) {
    // expecting the literal from string to be exact case match
    if ( soaResponse.extraInfoOut?.hasProjects ) {
        _hasProjects = soaResponse.extraInfoOut.hasProjects === 'true';
    } else {
        _hasProjects = false;
    }

    if ( soaResponse.extraInfoOut?.displayCurrentCountryPage ) {
        _displayCurrentCountry = soaResponse.extraInfoOut?.displayCurrentCountryPage === 'true';
    } else {
        _displayCurrentCountry = false;
    }

    appCtxSvc.registerCtx( 'hasProjects', _hasProjects );
    _postLoginStages = soaResponse.extraInfoOut?.AWC_PostLoginStages;

    if ( _postLoginStages && _postLoginStages.length > 0 ) {
        exports.setpostLoginStageList( _postLoginStages );
    }

    let awVer = soaResponse.extraInfoOut?.AWServerVersion;
    awSvrVer.parseVersionInfo( awVer );

    // Bypass analytics initialization only if "disable all" flag exists and is true
    if ( !( appCtxSvc.ctx?.preferences?.TC_Analytics_Disable_All?.[0].toLowerCase() === 'true' ) ) {
        if ( appCtxSvc.ctx?.preferences?.TC_Analytics_PEP_Message_Acknowledged?.[0].toLowerCase() === 'false' ) {
            let localTextBundle = localeSvc.getLoadedText( 'AnalyticsMessages' );
            //place to show the PEP pop-up..
            const popupParams = {
                caption: localTextBundle.pepCaption,
                view: 'PEPPopupDialog',
                preset: 'modal',
                height: '500',
                maxheight: '750',
                width: '450',
                hasArrow: false,
                placement: 'right',
                draggable: false,
                hasCloseButton: false,
                forceCloseOthers: false,
                subPanelContext: soaResponse
            };
            popupService.show( popupParams );
        } else {
            _logSessionData( appCtxSvc, soaResponse );
        }
    }

    _setCommandBuilderAdmin( appCtxSvc, soaResponse );
    setTableConfiguratorAccess( appCtxSvc, soaResponse );

    if ( soaResponse.analyticsData?.analyticsExtraInfo ) {
        _siteId = soaResponse.extraInfoOut?.SiteID;
    }

    _tcServerVersion = soaResponse.extraInfoOut?.TCServerVersion;
    const useInternalServer = soaResponse.analyticsData.useInternalServer;

    let tcSessionData = {};
    tcSessionData.serverVersion = exports.toString();
    tcSessionData.protocol = exports.getProtocol();
    tcSessionData.server = browserUtils.getBaseURL() + WEB_XML_SOA_PROXY_CONTEXT;
    tcSessionData.TCServerVersion = _tcServerVersion;
    tcSessionData.useInternalServer = useInternalServer;

    if ( soaResponse.extraInfoOut?.LogFile ) {
        tcSessionData.logFile = getFilename( soaResponse.extraInfoOut.LogFile );
    }

    let userAgentInfo = {};
    userAgentInfo.userApplication = sessionCtxSvc.getClientID();
    userAgentInfo.userAppVersion = sessionCtxSvc.getClientVersion();

    appCtxSvc.registerCtx( 'tcSessionData', tcSessionData );
    appCtxSvc.registerCtx( 'userAgentInfo', userAgentInfo );
};

/**
 * prop getter for the hasProjects boolean value
 *
 * @return {Boolean} value for whether or not there is any projects data.
 */
export let hasProjects = function() {
    return _hasProjects;
};

/**
 * prop getter for the displayCurrentCountry boolean value
 *
 * @return {Boolean} display country/geography
 */
export let displayCurrentCountry = function() {
    return _displayCurrentCountry;
};

export let getpostLoginStages = function() {
    return _postLoginStages;
};

export let setpostLoginStageList = function( postLoginStage ) {
    let splitArray = postLoginStage.split( ',' );
    let postLoginStageKey = 'postLoginStagesKey';
    let postLoginStages = localStrg.get( postLoginStageKey );

    if ( !postLoginStages ) {
        postLoginStages = [];
        for ( let i = 0; i < splitArray.length; i++ ) {
            let stage = {};
            stage.name = splitArray[i];
            stage.status = false;
            stage.priority = i;
            postLoginStages.push( stage );
        }
        localStrg.publish( postLoginStageKey, JSON.stringify( postLoginStages ) );
    }
};

/**
 * generate a version display string
 *
 * @return {String} formatted version string
 */
export let toString = function() {
    return 'Server Build: ' + awSvrVer.toString() + '\nServer Version: ' + _tcServerVersion + '\nSite: ' + ( _siteId ? _siteId.toString() : '' );
};

/**
 * prop getter for the getProtocol string value
 *
 * @return {String} value for protocol.
 */
export let getProtocol = function() {
    let baseUrl = browserUtils.getBaseURL();
    if ( baseUrl !== null && baseUrl !== '' ) {
        return baseUrl.substring( 0, baseUrl.indexOf( '://', 0 ) );
    }
    return null;
};

export let initializeDataPrivacyTab = function( ctx, dpeDecision, pepDecision, dpeText2, dpNoticeDesc, pepText2 ) {
    let nwdpeDecision = { ...dpeDecision };
    let nwpepDecision = { ...pepDecision };

    let nwdpeText2 = { ...dpeText2 };
    let nwdpNoticeDesc = { ...dpNoticeDesc };
    let nwpepText2 = { ...pepText2 };

    //prepare the PEP text vals
    let localTextBundle = localeSvc.getLoadedText( 'AnalyticsMessages' );
    nwdpeText2.dbValue = localTextBundle.dpeText2.replace( '{0}', '' );
    nwdpNoticeDesc.dbValue = localTextBundle.dpNoticeDesc.replace( '{0}', '' );
    nwpepText2.dbValue = localTextBundle.pepText2.replace( '{0}', '' );
    if ( ctx.Analytics_DPE ) {
        //User 1st login and change in the session and pref is updated
        nwdpeDecision.dbValue = ctx.Analytics_DPE;
    } else if ( ctx.preferences.TC_DigitalProductExperience ) {
        //set prop value
        nwdpeDecision.dbValue = ctx.preferences.TC_DigitalProductExperience[0];
    }

    if ( ctx.Analytics_PEP ) {
        //User 1st login and change in the session and pref is updated
        nwpepDecision.dbValue = ctx.Analytics_PEP;
    } else if ( ctx.preferences.TC_ProductExcellenceProgram ) {
        //set prop value
        nwpepDecision.dbValue = ctx.preferences.TC_ProductExcellenceProgram[0];
    }
    return { dpeDecision: nwdpeDecision, pepDecision: nwpepDecision, dpeText2: nwdpeText2, dpNoticeDesc: nwdpNoticeDesc, pepText2: nwpepText2 };
};

export let initializePEPPopup = function( pepText2 ) {
    let nwpepText2 = { ...pepText2 };
    let localTextBundle = localeSvc.getLoadedText( 'AnalyticsMessages' );
    nwpepText2.dbValue = localTextBundle.pepText2.replace( '{0}', '' );
    return { pepText2: nwpepText2 };
};

export const setDeclineAndLogSessionData = function( soaResponse ) {
    appCtxSvc.updatePartialCtx( 'Analytics_PEP', 'false' );
    _logSessionData( appCtxSvc, soaResponse );
};

export const setAgreeAndLogSessionData = function( soaResponse ) {
    if ( soaResponse ) {
        appCtxSvc.updatePartialCtx( 'Analytics_PEP', 'true' );
        soaResponse.isDataCollectionEnabled = true;
        _logSessionData( appCtxSvc, soaResponse );
    }
};

/**
 * set allowTableConfiguratorAccess into ctx.
 * @param {*} appCtxSvc appCtxService
 * @param {Object} soaResponse - soa response from GetTCSessionInfo
 */
export const setTableConfiguratorAccess = function( appCtxSvc, soaResponse ) {
    // Table_configurator_admin_delegates - This is the preference with list of Groups, Roles, RoleInGroups which allows additional group, role users access to Table Configurator.
    // Example format below for preference values:
    // Group:Power Users
    // Role:Data Admin
    // RoleInGroup:Engineering|Local Admin

    const allowTableConfiguratorAccess = soaResponse.extraInfoOut?.allowTableConfiguratorAccess;
    appCtxSvc.registerCtx( 'allowTableConfiguratorAccess', allowTableConfiguratorAccess );
};


export default exports = {
    parseSessionInfo,
    hasProjects,
    displayCurrentCountry,
    getpostLoginStages,
    setpostLoginStageList,
    toString,
    getProtocol,
    initializeDataPrivacyTab,
    initializePEPPopup,
    setDeclineAndLogSessionData,
    setAgreeAndLogSessionData,
    setTableConfiguratorAccess
};
