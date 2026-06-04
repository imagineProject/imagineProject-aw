// Copyright (c) 2025 Siemens
import localeService from 'js/localeService';

/**
 * buildUnreadableTooltip
 * @function buildUnreadableTooltip
 * @param {Object}count - unreadable count
 * @return {Promise} Promise containing the localized text
 */
export let buildUnreadableTooltip = async function( count ) {
    if( count ) {
        return localeService.getLocalizedTextFromKey( 'tcuijsTooltipMessages.unreadableCountTooltip' ).then( ( localizedText ) => {
            return localizedText.format( count );
        } );
    }
    return Promise.resolve( {} );
};

export default {
    buildUnreadableTooltip
};
