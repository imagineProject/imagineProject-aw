// Copyright (c) 2022 Siemens

/**
 * This implements the task related info panel functionalities.
 *
 * @module js/Awp0TaskRelatedInfoPanel
 */
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Update the selected tab if on URL.
 * @param {Object} data Data view model object
 *
 * @returns {String} Tab id that will be activated now
 */
export let updateTabOnURL = function( data ) {
    var tabId = 'Awp0TaskPropertiesTab';
    // Check if selected tab id is not null then get that tabId and update the URL
    if( data && data.selectedTab && data.selectedTab.id ) {
        tabId = data.selectedTab.id;
    }
    //exports.setSelectedTab( data, tabId );
    Awp0WorkflowDesignerUtils.updateURL( { ttab_name: tabId } );
    return tabId;
};

/**
 * Put the seleted to true on tab based on input tab id that is selected
 * by default. This is mainly needed in refresh case.
 *
 * @param {Object} data Data view model object
 * @param {String} tabToSelected Selected tab id
 */
export let setSelectedTab = function( data, tabToSelected ) {
    if( tabToSelected ) {
        _.forEach( data.tabsModel, function( tabObject ) {
            if( tabToSelected === tabObject.id && tabObject.selectedTab === true ) {
                tabObject.selectedTab = true;
                // This is needed in refresh case so that it will not put first tab as selected by default
                // and put the correct selected tab.
                data.selectedTab = tabObject;
                eventBus.publish( 'awTab.setSelected', data.selectedTab );
            } else {
                tabObject.selectedTab = false;
            }
        } );
    }
};

export default exports = {
    updateTabOnURL,
    setSelectedTab
};
