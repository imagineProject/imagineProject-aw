// Copyright (c) 2021 Siemens

/**
 * @module js/quickAccessPanelService
 */

import dialogService from 'js/dialogService';
let exports = {};

export const initQuickAccessPanel = ( originalParams ) => {
    return { originalParams : originalParams };
};

export const parseEventDataAndClosePanel = ( eventId, eventData, popupId, panelPinned ) => {
    let newUid = eventData.newUrl.split( '&uid=' )[1];
    let oldUid = eventData.oldUrl.split( '&uid=' )[1];

    if( eventId === 'locationChangeSuccess' &&  ( newUid !== oldUid || eventData.newUrl.split( '?' )[0] !== eventData.oldUrl.split( '?' )[0] || !panelPinned ) ) {
        dialogService.closeDialog( '', popupId );
    }
};

exports = {
    initQuickAccessPanel,
    parseEventDataAndClosePanel
};
export default exports;
