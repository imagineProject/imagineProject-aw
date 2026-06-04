// Copyright (c) 2022 Siemens

/**
 * Defines {@link helpAboutService} which provides services for the help about command
 *
 * @module js/helpAboutService
 */
import appCtxService from 'js/appCtxService';
import cfgSvc from 'js/configurationService';
import localeSvc from 'js/localeService';
import uwPropertySvc from 'js/uwPropertyService';
import _soaSvc from 'soa/kernel/soaService';
import navigationSvc from 'js/navigationService';

/** object to export */
let exports = {};
const getConcatBuildTime = ( x ) => {
    var y = x.getFullYear().toString();
    var m = ( x.getMonth() + 1 ).toString();
    var d = x.getDate().toString();
    var h = x.getHours().toString();
    var min = x.getMinutes().toString();
    d.length === 1  && ( d = '0' + d );
    m.length === 1  && ( m = '0' + m );
    h.length === 1  && ( h = '0' + h );
    min.length === 1  && ( min = '0' + min );
    return y + m + d + h + min;
};

export let getAboutProperties = async function( ) {
    let build;
    let buildId;
    let clientBuildTime;
    let clientFramework;
    let clientViewer;
    let sessionLog;
    let copyrightText = '';
    let buildTime;

    let versionConstants = await cfgSvc.getCfg( 'versionConstants' );
    let solutionDef = await cfgSvc.getCfg( 'solutionDef' );
    if( versionConstants ) {
        buildTime = getConcatBuildTime( new Date( versionConstants.buildTimeRaw ) );
    }

    build = uwPropertySvc.createViewModelProperty( 'build', solutionDef.solutionName, 'STRING', solutionDef.solutionVersion, [ solutionDef.solutionVersion ] );

    buildId = uwPropertySvc.createViewModelProperty( 'buildId', localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.buildId' ), 'STRING', appCtxService.ctx.tcSessionData.TCServerVersion, [ appCtxService.ctx.tcSessionData.TCServerVersion ] );

    clientBuildTime = uwPropertySvc.createViewModelProperty( 'clientBuildTime', localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.clientBuildTime' ), 'STRING', buildTime, [ buildTime ] );

    if( versionConstants && versionConstants.afx ) {
        let clientFrameworkVersion = versionConstants.afx.version;
        if ( clientFrameworkVersion.includes( '-' ) ) {
            clientFramework = uwPropertySvc.createViewModelProperty( 'clientFramework', localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.clientFramework' ), 'STRING', clientFrameworkVersion, [ clientFrameworkVersion ] );
            if( versionConstants?.dependencies ) {
                let clientViewerVersion = versionConstants.dependencies[ '@swf/ClientViewer' ];
                clientViewer = uwPropertySvc.createViewModelProperty( 'clientViewer', localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.clientViewer' ), 'STRING', clientViewerVersion, [ clientViewerVersion ] );
            }
        }
    }
    if( appCtxService.ctx.tcSessionData.logFile ) {
        sessionLog = uwPropertySvc.createViewModelProperty( 'sessionLog', localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.sessionLog' ), 'STRING', appCtxService.ctx.tcSessionData.logFile, [ appCtxService.ctx.tcSessionData.logFile ] );
    }
    if( solutionDef && solutionDef.copyrightText ) {
        copyrightText = solutionDef.copyrightText;
    }

    return {
        build: build,
        buildId: buildId,
        clientBuildTime: clientBuildTime,
        clientFramework: clientFramework,
        clientViewer: clientViewer,
        sessionLog: sessionLog,
        copyrightText: copyrightText
    };
};

export const getMoreDetails = ( ) => {
    return { lessDetails: false };
};

export const getLessDetails = (  ) => {
    return { lessDetails: true };
};

export const navigateToHelpLink = async() => {
    let action = { actionType: 'Navigate' };
    let helpDocLinkPref = appCtxService.ctx.preferences.TC_Help_Documentation_Link;
    let helpLink;
    const helpDocumentationHome = '.tc_doc_home';
    try {
        let url;
        if ( helpDocLinkPref ) {
            url = helpDocLinkPref[0];
        } else {
            const result = await _soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
                preferenceNames: [ 'TC_Help_Documentation_Link' ],
                includePreferenceDescriptions: true
            }, {} );
            url = result.response[0].values.values[0];
        }

        if ( url.endsWith( helpDocumentationHome ) ) {
            helpLink = url;
        }else{
            helpLink = url + helpDocumentationHome;
        }

        var paramsToWrite = {};
        action.navigateTo = helpLink;
        action.navigationParams = paramsToWrite;
        action.navigateIn = 'newTab';
        navigationSvc.navigate( action, paramsToWrite );
    } catch ( error ) {
        try {
            const localizedMsg = await localeSvc.getLoadedTextFromKey( 'Awp0ShowHelpAboutMessages.helpLinkRetrievalError' );
            const errMsg = localizedMsg || 'Failed to retrieve the Help Documentation link. The preference might not be set correctly';
            console.error( 'Error fetching help link:', errMsg );
        } catch ( localeError ) {
            console.error( 'Error loading localized message:', localeError );
        }
    }
};

export default exports = {
    getMoreDetails,
    getLessDetails,
    getAboutProperties,
    navigateToHelpLink
};
