// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerAdminService
 */
import appCtxSvc from 'js/appCtxService';
import messagingService from 'js/messagingService';
import viewerAdminHealthService from 'js/viewerAdminHealth';
import viewerAdminGraph from 'js/viewerAdminGraph';
import modelPropertyService from 'js/modelPropertyService';
import selectionService from 'js/selection.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import browserUtils from 'js/browserUtils';

import '@swf/ClientViewer';

var exports = {};

/**
 * Selected node type
 */
var SELECTED_NODE_TYPE = 'selectedNodeType';

/**
 * Selected node Display type
 */
var SELECTED_NODE_DISPLAY_TYPE = 'selectedNodeDisplayType';

/**
 * Selected node properties
 */
var SELECTED_NODE_PROPERTIES = 'selectedNodeProperties';

/**
 * Viewer Admin namespace
 */
var VIEWER_ADMIN_NAMESPACE = 'viewerAdmin';

/**
 * The Vis proxy servlet context. This must be the same as the VisPoolProxy mapping in the web.xml
 */
var WEB_XML_VIS_PROXY_CONTEXT = 'VisProxyServlet' + '/';

/**
 * Viewer Health
 *
 */
var VIEWER_HEALTH = 'viewerHealth';

/**
 * Get connection url
 *
 * @returns {String} URL
 */
var getConnectionUrl = function() {
    return browserUtils.getBaseURL() + WEB_XML_VIS_PROXY_CONTEXT;
};

/**
 * vaGraphInitialized
 * @param {Object} data model
 */
export let vaGraphInitialized = function( data ) {
    logger.debug( 'viewerAdminService: viewer admin graph initialized' );
    updateViewerAdminCtx( 'isVAGraphInitialized', true );
    exports.showHealthInfo( data );
};

/**
 * Sets in progress status
 * @param  {Boolean} newStatus new status
 */
var setInProgressCompleteStatus = function( newStatus ) {
    var loadFinishedCtx = VIEWER_ADMIN_NAMESPACE + '.' + 'isLoadInProgress';
    appCtxSvc.updatePartialCtx( loadFinishedCtx, newStatus );
};

/**
 * Fetches health info from server
 * @param  {Object} data model
 */
export let fetchHealthInfo = function( data ) {
    var viewerAdmin = appCtxSvc.getCtx( VIEWER_ADMIN_NAMESPACE );

    if( _.isEmpty( viewerAdmin.allHealthObjects ) ) {
        setInProgressCompleteStatus( true );
        viewerAdmin.isUIPopulated = false;
        appCtxSvc.updateCtx( VIEWER_ADMIN_NAMESPACE, viewerAdmin );

        window.JSCom.Health.HealthUtils.getServerHealthInfo( getConnectionUrl() )
            .then( function( health ) {
                setInProgressCompleteStatus( false );
                logger.debug( 'ViewerAdminService: Viewer health data available.' );
                appCtxSvc.updatePartialCtx( VIEWER_ADMIN_NAMESPACE + '.' + VIEWER_HEALTH, health );
                eventBus.publish( 'viewerAdmin.healthInfoAvailable', health );
            }, function( error ) {
                setInProgressCompleteStatus( false );
                logger.error( 'viewerAdminService:' + error );
                messagingService.showWarning( data.i18n.noViewerHealth );
            } );
    }
};

/**
 * Resets Viewer admin panel
 * @param  {Object} data model
 */
export let resetVAPanel = function( data ) {
    var viewerAdmin = appCtxSvc.getCtx( VIEWER_ADMIN_NAMESPACE );
    viewerAdmin.allHealthObjects = [];
    viewerAdmin.isUIPopulated = false;
    viewerAdmin.isViewerHealthParsed = false;
    viewerAdmin.viewerHealth = undefined;
    appCtxSvc.updateCtx( VIEWER_ADMIN_NAMESPACE, viewerAdmin );
    eventBus.publish( 'viewerAdmin.clearGraph', {} );
    exports.fetchHealthInfo( data );
};

/**
 * Shows health info
 * @param  {Object} data model
 */
export let showHealthInfo = function( data ) {
    var viewerAdmin = appCtxSvc.getCtx( VIEWER_ADMIN_NAMESPACE );
    if( data && viewerAdmin && viewerAdmin.isVAGraphInitialized &&
        viewerAdmin.isViewerHealthParsed && !viewerAdmin.isUIPopulated ) {
        logger.debug( 'viewerAdminService: Trying to show health data' );
        setInProgressCompleteStatus( false ); // graph also initialize here
        viewerAdminHealthService.populateSummaryInfo( data );
        viewerAdminGraph.drawGraph( data );
        updateViewerAdminCtx( 'isUIPopulated', true );
    }
};

/**
 * Updates context with selection data
 * @param  {ViewerHealthObject} selectedHealthObject selected health object
 * @param  {Object} data model
 */
var _updateContextWithSelectionData = function( selectedHealthObject, data ) {
    var healthPropObj = selectedHealthObject.getProperties();
    var keys = _.keysIn( healthPropObj );
    var propObjects = [];

    _.forEach( keys, function( key ) {
        var propObject = {
            displayName: data.i18n[ key ],
            type: 'STRING',
            isRequired: 'false',
            isEditable: 'false',
            dispValue: healthPropObj[ key ],
            labelPosition: 'PROPERTY_LABEL_AT_TOP',
            dbValue: healthPropObj[ key ]
        };
        propObjects.push( modelPropertyService.createViewModelProperty( propObject ) );
    } );

    let adminCtx = appCtxSvc.getCtx( VIEWER_ADMIN_NAMESPACE );
    adminCtx[SELECTED_NODE_DISPLAY_TYPE] = selectedHealthObject.getDisplayType();
    adminCtx[SELECTED_NODE_PROPERTIES] = propObjects;
    adminCtx[SELECTED_NODE_TYPE] = selectedHealthObject.type;
    appCtxSvc.updateCtx( VIEWER_ADMIN_NAMESPACE, adminCtx );
};

/**
 * Updates the selection .
 * @param  {Object[]} selectedNodes nodes
 * @param  {Object} data model
 */
export let updateSelection = function( selectedNodes, data ) {
    logger.debug( 'viewerAdminService: selection updated' );
    if( selectedNodes.length > 0 ) {
        var lastSelected = _.last( selectedNodes );
        if( lastSelected.healthObject !== undefined ) {
            var selectedHealthObject = lastSelected.healthObject;
            _updateContextWithSelectionData( selectedHealthObject, data );
            selectionService.updateSelection( selectedHealthObject );
        }
        eventBus.publish( 'viewerAdmin.nodeSelectionChanged' );
    }
};

/**
 * Update Viewer Admin Context with given partial path and its value
 * @param {String} path path
 * @param {Object} value value
 */
var updateViewerAdminCtx = function( path, value ) {
    var partialPath = VIEWER_ADMIN_NAMESPACE + '.' + path;
    appCtxSvc.updatePartialCtx( partialPath, value );
};

export default exports = {
    vaGraphInitialized,
    fetchHealthInfo,
    resetVAPanel,
    showHealthInfo,
    updateSelection
};
