// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This is the parameters for DDS contribution
 *
 * @module js/awp0DdsDashboard.pwaKey
 */
import localSvc from 'js/localeService';

'use strict';

var contribution = {
    Title: 'Global Search Index',
    uid: 'jdhiwnmid101',
    type: 'Global Search Index',
    cellHeader1: 'Global Search Index',
    cellHeader2: '',
    hasThumbnail: false,
    typeIconURL: 'assets/image/typeServiceCatalog48.svg',
    visibleWhen: function( data ) {
        return data.ctx.sublocation.nameToken === 'com_siemens_splm_indexerAdminLocation:showIndexerAdmin';
    }
};

/**
 *
 * @param {*} key
 * @param {*} deferred
 */
export default async function( key, deferred ) {
    if( key === 'awp0DdsDashboardPWAKey' ) {
        var cellHeader1 = await localSvc.getLocalizedText( 'DataDiscoveryServicesMessages', 'TitlePWA' );
        contribution.cellHeader1 = cellHeader1;
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
