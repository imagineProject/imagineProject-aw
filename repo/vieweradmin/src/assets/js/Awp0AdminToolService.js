// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0AdminToolService
 */
import appCtxSvc from 'js/appCtxService';

var exports = {};

/**
 * Update Health data
 *
 * @param {Object} data model
 * @returns {Object} updated health data
 */
export let updateHealthData = function( data ) {
    var viewerAdmin = appCtxSvc.getCtx( 'viewerAdmin' );
    data.nodeProp.displayName = viewerAdmin.selectedNodeDisplayType;
    data.nodeProp.dbValue = viewerAdmin.selectedNodeProperties;
    data.nodeProp.selectedNodeType = viewerAdmin.selectedNodeType;
    return data;
};

export default exports = {
    updateHealthData
};
