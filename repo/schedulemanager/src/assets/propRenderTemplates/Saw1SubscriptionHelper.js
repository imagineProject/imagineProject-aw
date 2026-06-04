// Copyright (c) 2022 Siemens

/**
 * Helper class for Subscription followers with target as Schedule or Schedule Task
 *
 * @module propRenderTemplates/Saw1SubscriptionHelper
 */

import localeService from 'js/localeService';

var exports = {};

/**
 * Render display value in Followers table "Name" column.
 *
 * @param {object} vmo - ViewModelObject for which display value is being rendered.
 * @param {object} containerElem - Container DOM Element inside which display value will be rendered.
 */
export let renderFollowers = function (vmo, containerElem) {

    // Default value
    let followersDispValue = vmo.props.object_string.uiValues[0];

    // If VMO is of type Schedule, display "All members" in Followers table
    if (vmo.type === 'Schedule') {
        var localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
        followersDispValue = localTextBundle['allMembers'];
    } // Else if VMO is of type User, display userid value in Followers table
    else if (vmo.type === 'User') {
        followersDispValue = vmo.props.userid.uiValues[0];
    }

    let childElement = document.createElement( 'div' );
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += followersDispValue;
    containerElem.appendChild( childElement );
};

export let sortSubscriptions = function( response ) {
    var subscriptions = response.subscriptions;
    if ( subscriptions && subscriptions.length > 1 && subscriptions[0].type === 'ImanSubscription' && subscriptions[0].props && subscriptions[0].props.expiration_date ) {
        subscriptions.sort( ( firstEl, secondEl ) => {
            let firstElValue = firstEl.props.expiration_date.dbValues[0] === null;
            let secondElValue = secondEl.props.expiration_date.dbValues[0] === null;
            if ( firstElValue === secondElValue ) {
               return 0;
            }
            return firstElValue ? -1 : 1;
        } );
    }
    return subscriptions;
};


export default exports = {
    renderFollowers,
    sortSubscriptions
};
