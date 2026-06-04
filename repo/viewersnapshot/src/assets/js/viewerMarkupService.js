// Copyright (c) 2022 Siemens

/**
 *
 * @module js/viewerMarkupService
 */
import markupService from 'js/Awp0MarkupService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

/**
 * Shows Markups in Image capture as well as enables freeDraw tool
 * @param {Object} markupContext 2D markup context
 */
export let showMarkups = function( markupContext ) {
    markupService.showMarkups( markupContext );
};

/**
 * Activates markup panel
 * @param {Object} markupContext 2D markup context
 */
export let activateMarkupPanel = function( markupContext ) {
    markupService.activateMarkupPanel( markupContext );
};

export let updateMarkupContext = function() {
    let markupCtx = appCtxSvc.getCtx( 'markup' );
    if( !markupCtx ) {
        appCtxSvc.registerCtx( 'markup', {} );
        markupCtx = appCtxSvc.getCtx( 'markup' );
    }
    markupCtx.showPanel = true;
    appCtxSvc.updateCtx( 'markup', markupCtx );
};

export default exports = {
    showMarkups,
    activateMarkupPanel,
    updateMarkupContext
};
