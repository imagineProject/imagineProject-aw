// Copyright (c) 2022 Siemens

/**
 * Wrapper code to process revision rule context values
 *
 * @module js/revisionRuleAdminContextService
 */
import appCtxSvc from 'js/appCtxService';

var exports = {};

var _revisionRuleCtxPath = 'RevisionRuleAdmin.';

/**
 * Get Revision rule application context variable value
 * 
 * @param {String} ctxPath - Path to the context     *
 * @return {Object} Value (if any) at the indicated context path location.
 */
export let getRevRuleAdminCtx = function( ctxPath ) {
    if( !ctxPath.startsWith( _revisionRuleCtxPath ) ) {
        ctxPath = _revisionRuleCtxPath + ctxPath;
    }
    return appCtxSvc.getCtx( ctxPath );
};

/**
 * Get application context
 * 
 * @return {Object} Current application context.
 */
export let getCtx = function() {
    return appCtxSvc.ctx;
};

/**
 * Update Revision rule admin context
 * 
 * @param {String} ctxPath - Path to the context
 * @param {Object} value - The value of context variable
 *
 */
export let updateRevRuleAdminPartialCtx = function( ctxPath, value ) {
    if( !ctxPath.startsWith( _revisionRuleCtxPath ) ) {
        ctxPath = _revisionRuleCtxPath + ctxPath;
    }
    appCtxSvc.updatePartialCtx( ctxPath, value );
};

/**
 * Update part of a context
 *
 * @param {String} path - Path to the context
 * @param {Object} value - The value of context variable
 * 
 */
export let updatePartialCtx = function( ctxPath, value ) {
    appCtxSvc.updatePartialCtx( ctxPath, value );
};

export default exports = {
    getRevRuleAdminCtx,
    getCtx,
    updateRevRuleAdminPartialCtx,
    updatePartialCtx
};
