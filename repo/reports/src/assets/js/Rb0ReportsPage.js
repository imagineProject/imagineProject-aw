// Copyright (c) 2022 Siemens

/**
 * @module js/Rb0ReportsPage
 */
import AwHttpService from 'js/awHttpService';
import $ from 'jquery';
import appCtxService from 'js/appCtxService';
import reportsCommSrvc from 'js/reportsCommonService';

var exports = {};
const activeWorkspace = 'Active Workspace';

/**
 * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
var WEB_XML_FMS_PROXY_CONTEXT = 'fms';

/**
 * Relative path to the FMS proxy download service.
 */
var CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/?ticket=';

var _file = null;
var _lastSelectedBOUid = null;

export let setReportsParameter = function( vmo, ticketURL ) {
    _lastSelectedBOUid = vmo.uid;
    _file = ticketURL;
};

var getFrameSize = function() {
    var body = $( 'body' );
    var pageHeight = body.height() * 0.68;
    var pageWidth = '100%';
    return {
        height: pageHeight,
        width: pageWidth
    };
};

var buildTicketURL = function() {
    //update ticket..
    return CLIENT_FMS_DOWNLOAD_PATH + _file;
};

/**
 * Put HTML ticket data into iframe.
*
* @param {Object} response - The response object from the HTTP request.
* @param {Object} data - The data object containing context and i18n information.
*/
self.processResponse = function( response, data ) {
    var iFrameData = null;
    if( response && response.data.length > 2 ) {
        iFrameData = response.data;
    } else {
        iFrameData = data.i18n.showNoDataFoundMessage;
    }

    var iframe = $( 'iframe.aw-reports-frameSize' );
    let spliView = appCtxService.getCtx( 'splitView' );
    let activeIndex = 0;
    if( spliView && data.subPanelContext.context?.tabSetId === spliView.viewKeys[ 1 ] && iframe.length > 1 ) {
        activeIndex = 1;
    }
    var iframedoc;
    if( iframe?.length && iframe[ activeIndex ] && iframe[ activeIndex ].contentDocument ) {
        iframedoc = iframe[ activeIndex ].contentDocument;
    } else if( iframe?.length && iframe[ activeIndex ] && iframe[ activeIndex ].contentWindow ) {
        iframedoc = iframe[ activeIndex ].contentWindow.document;
    }
    if( iframedoc ) {
        // Put the content in the iframe
        iframedoc.open();
        var iframedocContent = iFrameData;
        iframedoc.writeln( iframedocContent );
        iframedoc.close();
    }
};

/**
 *
 * @param {*} data -
 * @param {*} selected -
 * @returns {boolean} true
 */
const isItAwSourceReport = function( data ) {
    var itIsAWReport = false;
    let reportObjOnCtx = data.subPanelContext?.context?.pageContext?.sublocationState?.selectedReportDefinition;
    if( !reportObjOnCtx ) {
        reportObjOnCtx = appCtxService.getCtx( 'selectedReportDefinition' );
    }
    let sourceObjOnCtx = data.subPanelContext?.context?.pageContext?.sublocationState?.selectedSourceObject;
    if( !sourceObjOnCtx ) {
        sourceObjOnCtx = appCtxService.getCtx( 'selectedSourceObject' );
    }
    //Removing rd_class check for selected.type, to enable report generation on rd_class and its sub-types
    if( reportObjOnCtx && reportObjOnCtx.props.rd_source.dbValues[ 0 ] === activeWorkspace && reportObjOnCtx.props.rd_type.dbValues[ 0 ] === '1' ) {
        itIsAWReport = true;
        if( data ) {
            data.selectedReport = reportObjOnCtx;
        }
    } else if( sourceObjOnCtx && appCtxService.ctx.selected.type === 'ReportDefinition' && appCtxService.ctx.selected.props.rd_source.dbValues[ 0 ] === activeWorkspace && appCtxService.ctx.selected.props.rd_type.dbValues[ 0 ] === '1' ) {
        itIsAWReport = true;
        if( data ) {
            data.selectedReport = appCtxService.ctx.selected;
            data.selectedSourceObject = sourceObjOnCtx;
        }
    }
    return itIsAWReport;
};

export let validateReveal = function( data, selected ) {
    var ctxSelected = reportsCommSrvc.getUnderlyingObject( selected );
    var showDefaultMessage = false;
    var showAwReport = false;
    if( isItAwSourceReport( data ) && _lastSelectedBOUid && ctxSelected.uid === _lastSelectedBOUid ) {
        showAwReport = true;
        if( ctxSelected.type === 'ReportDefinition' ) {
            reportsCommSrvc.checkForDashboardConfigCommand( ctxSelected, data.selectedSourceObject );
        } else {
            reportsCommSrvc.checkForDashboardConfigCommand( data.selectedReport, ctxSelected );
        }
    } else if( _lastSelectedBOUid && ctxSelected.uid === _lastSelectedBOUid && _file?.length > 0 ) {
        data.urlFrameSize = getFrameSize();
        var promise = AwHttpService.instance.get( buildTicketURL() );
        promise.then( function( response ) {
            self.processResponse( response, data );
        } );
    } else if( selected.type === 'ReportDefinition' ) {
        if( selected.props.rd_type.dbValues[ 0 ] === '0' && selected.props.rd_source.dbValues[ 0 ] === activeWorkspace ) {
            showAwReport = true;
            reportsCommSrvc.checkForDashboardConfigCommand( selected, null );
            data.selectedReport = selected;
        } else {
            delete data.selectedReport;
            showDefaultMessage = true;
        }
    } else if( appCtxService.ctx.selected.props.rd_type?.dbValues[0] !== '1' ) {
        showDefaultMessage = true;
        data.selectedReport && delete data.selectedReport;
    }
    return { isAwReport: showAwReport, showMsg: showDefaultMessage, selected: data.selectedReport, selectedSourceObject: data.selectedSourceObject };
};

export let refreshPanelData = function( data, selected ) {
    const nwSublocationState = data.subPanelContext.context.pageContext.sublocationState.getValue();
    const ctxSelected = reportsCommSrvc.getUnderlyingObject( selected );

    // Ensure nwSublocationState is valid before proceeding
    if ( !nwSublocationState ) {
        return {
            showAwReport: false,
            showDefaultMessage: false
        };
    }

    if( _lastSelectedBOUid !== ctxSelected.uid && ( ctxSelected.type === 'ReportDefinition' && _lastSelectedBOUid !== nwSublocationState?.selectedSourceObject?.uid ) ) {
        return {
            showAwReport: false,
            showDefaultMessage: true
        };
    }

    if( isItAwSourceReport( data ) && _lastSelectedBOUid ) {
        nwSublocationState.updateAWSourceReport = !nwSublocationState.updateAWSourceReport;
        data.subPanelContext.context.pageContext.sublocationState.update( nwSublocationState );
        if( ctxSelected.type === 'ReportDefinition' ) {
            reportsCommSrvc.checkForDashboardConfigCommand( ctxSelected, data.selectedSourceObject );
        } else {
            reportsCommSrvc.checkForDashboardConfigCommand( data.selectedReport, _lastSelectedBOUid );
        }
        return {
            showDefaultMessage: false
        };
    }

    // Safe to access nwSublocationState after checking if it is not null
    nwSublocationState.updateTCSourceReport = !nwSublocationState.updateTCSourceReport;
    data.subPanelContext.context.pageContext.sublocationState.update( nwSublocationState );

    return {
        showAwReport: false,
        showDefaultMessage: false
    };
};

export let updateAWSourceReportAction = function( data ) {
    data.showAwReport = true;

    let reportObjOnCtx = data.subPanelContext?.context?.pageContext?.sublocationState?.selectedReportDefinition;
    let sourceObjOnCtx = null;

    // If no report object in context, fallback to the app context selected report definition
    if( !reportObjOnCtx ) {
        reportObjOnCtx = appCtxService.getCtx( 'selectedReportDefinition' );
    }

    // Ensure ctxObj is not null or undefined before accessing its properties
    const ctxObj = reportsCommSrvc.getUnderlyingObject( appCtxService.ctx.selected );

    // Check if ctxObj is not null before accessing its properties
    if( ctxObj && ctxObj?.uid !== _lastSelectedBOUid && ctxObj?.props?.rd_type?.dbValues[0] !== '1' && reportObjOnCtx ) {
        reportObjOnCtx = null;
    }

    // If ctxObj is valid, proceed with further checks
    if( ctxObj && ctxObj?.uid === _lastSelectedBOUid && ctxObj.type === 'ReportDefinition' ) {
        reportObjOnCtx = appCtxService.ctx.selected;
        sourceObjOnCtx = data.subPanelContext?.context?.pageContext?.sublocationState?.selectedSourceObject;

        if( !sourceObjOnCtx ) {
            sourceObjOnCtx = appCtxService.getCtx( 'selectedSourceObject' );
        }
    }

    return { showAwReport: data.showAwReport, selected: reportObjOnCtx, selectedSourceObject: sourceObjOnCtx };
};

export let updateTCSourceReportAction = function( data, selected ) {
    const nwSublocationState = data.subPanelContext.context.pageContext.sublocationState.getValue();
    const ctxSelected = reportsCommSrvc.getUnderlyingObject( selected );
    if( _lastSelectedBOUid && ( ctxSelected.uid === _lastSelectedBOUid || ctxSelected.type === 'ReportDefinition' && _lastSelectedBOUid === nwSublocationState?.selectedSourceObject?.uid ) && _file?.length > 0 ) {
        var promise = AwHttpService.instance.get( buildTicketURL() );
        promise.then( function( response ) {
            self.processResponse( response, data );
        } );
        return { showAwReport: false };
    }
    return { showAwReport: true };
};

export default exports = {
    setReportsParameter,
    validateReveal,
    refreshPanelData,
    updateAWSourceReportAction,
    updateTCSourceReportAction
};
