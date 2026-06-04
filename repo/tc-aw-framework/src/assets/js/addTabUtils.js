
// Copyright (c) 2022 Siemens

/**
 * @module js/addTabUtils
 */
import localeService from 'js/localeService';
import cfgSvc from 'js/configurationService';
import { getTabsState } from 'js/AwSelectionSummaryService';

let exports = {};

/**
 * Fetches the localized version of the tab's name and modifies the configuration point information with the result.
 *
 * @param {JSON} tab the configuration point information to extract the key for the localized name from.
 */
const loadTabTitle = tab => {
    if( typeof tab.name !== 'string' ) {
        localeService.getLocalizedText( tab.name.source, tab.name.key ).then( function( result ) {
            tab.name = result;
        } );
    }
};

/**
 * Fetches configuration point information and sets the title of the tab to localized string.
 *
 * @return {JSON} the set up and configured tab's data.
 */
export const getTabConfiguration = async function() {
    return await cfgSvc.getCfg( 'addPanelTabs' ).then( tabsConfig => {
        for( let name in tabsConfig ) {
            loadTabTitle( tabsConfig[ name ] );
        }
        return tabsConfig;
    } );
};

/**
 * Validates visible when condition of optional tabs and makes the tab data available to components.
 *
 * @return {[JSON]} the optional tabs to add to the add panel.
 */
export const initialize = ( ) => {
    return getTabConfiguration().then( tabsConfig => {
        let tabStateChecker = {
            tabs: Object.values( tabsConfig )
        };
        const { ctxParameters, additionalParameters } = getTabsState( tabStateChecker );
        return { optionalTabs: tabsConfig,
            ctxParameters: ctxParameters,
            additionalParameters: additionalParameters
        };
    } );
};

export default exports = {
    initialize,
    getTabConfiguration
};
