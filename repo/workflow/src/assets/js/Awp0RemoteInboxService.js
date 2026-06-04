// Copyright (c) 2022 Siemens

/**
 * This implements the add or remove remote inbox for user profile page stylesheet.
 *
 * @module js/Awp0RemoteInboxService
 */
import viewModelObjectService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import navigationSvc from 'js/navigationService';
import _prefSvc from 'soa/preferenceService';
import _dms from 'soa/dataManagementService';
import messagingSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import _ from 'lodash';

var exports = {};
var OPEN_REMOTE_INBOX_PREFERENCE = 'AWC_REMOTE_SITE_URL';

/**
  * Get the input object property and return the internal or display value.
  *
  * @param {Object} modelObject Model object whose propeties need to be loaded
  * @param {String} propName Property name that need to be checked
  * @param {boolean} isDispValue Display value need to be get or internal value
  *
  * @returns {Array} Property internal value or display value
  */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};


/**
  * Get the site UID array from input objects.
  *
  * @param {Array} modelObjects Object array for site Uid array need to be populated
  * @returns {Array} Site UID array
  */
var _getSiteIdList = function( modelObjects ) {
    var siteUids = [];
    _.forEach( modelObjects, function( siteObject ) {
        // Check if object is objectsetrow then we need to get the secondary object and then the owning_site property
        // Else if object is of type POM_imc then it's site object itself so use it directly
        if( siteObject.type === 'Awp0XRTObjectSetRow' && cdm.isValidObjectUid( siteObject.props.awp0Secondary.dbValue ) ) {
            var secObj = viewModelObjectService.createViewModelObject( cdm.getObject( siteObject.props.awp0Secondary.dbValue ) );
            var propValue = _getPropValue( secObj, 'owning_site' );
            if( propValue && !_.isEmpty( propValue ) ) {
                siteUids.push( propValue );
            }
        } else if( siteObject.modelType && siteObject.modelType.typeHierarchyArray.indexOf( 'POM_imc' ) > -1 ) {
            siteUids.push( siteObject.uid );
        } else if( siteObject.modelType && siteObject.modelType.typeHierarchyArray.indexOf( 'TaskInbox' ) > -1 ) {
            var owningSiteProp = _getPropValue( siteObject, 'owning_site' );
            if( owningSiteProp && !_.isEmpty( owningSiteProp ) ) {
                siteUids.push( owningSiteProp );
            }
        }
    } );
    return siteUids;
};

/**
  * Return all available sites present in system that can be subscribed
  * @param {Object} response object that contains all sites
  * @param {Array} subscribeSites Array that contains already subscribe sites
  * @returns {Array} Avaialble site array that can be subscibed.
  */
export let getAvailableMultisiteSites = function( response, subscribeSites ) {
    var availableSites = [];
    if( !_.isUndefined( response.modelObjects ) ) {
        var modelObjects = response.modelObjects;
        // Get the Uids for all sites that are already subscibed.
        var subscribeSiteUids = _getSiteIdList( subscribeSites );

        // Iterate for all sites and check if it's not already subscribed then only add it
        // to the avaialble site list
        _.forEach( modelObjects, function( modelObj ) {
            if( modelObj && modelObj.uid && ( !subscribeSiteUids || subscribeSiteUids.indexOf( modelObj.uid ) < 0 ) ) {
                var vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObj );
                availableSites.push( vmo );
            }
        } );
    }
    return availableSites;
};

/**
  * Using regual expression update the special characters and return the correct string.
  *
  * @param {String} string Filter string that need to be updated
  * @param {Char} char with string will be updated
  *
  * @returns {String} Replace string
  */
var _replaceRegExpChars = function( string, char ) {
    var charExp = new RegExp( char, 'g' );
    return string.replace( charExp, char );
};

/**
  * This generates a regular expression that can be used for
  * @param {String} filterString string that we will be generating the regex for
  * @returns {RegExp} the formatted regular expression
  */
var _generateRegenx = function( filterString ) {
    // add '\' before any characters special to reg expressions
    var chars = [ '\\\\', '\\(', '\\)', '\\+', '\\[', '\\]', '\\$', '\\^', '\\|', '\\?', '\\.', '\\{', '\\}', '\\!', '\\=', '\\<' ];
    for( var n = 0; n < chars.length; n++ ) {
        filterString = _replaceRegExpChars( filterString, chars[ n ] );
    }
    return filterString;
};

/**
  * Returns avaialble filter sites based on user input value.
  * @param {Array} siteObjects Site object array that all sites are available
  * @param {String} filterString Filter string user entered
  * @param {Object} userObject User object for remote inbox subscription need to be done
  * @param {boolean} isPanelPinned True/False based on panel is pinned or not.
  * @returns {Array} Filter sites based on user input string
  */
export let showAvailableSites = function( siteObjects, filterString, userObject, isPanelPinned ) {
    var filterSites = siteObjects;

    var subscribeSiteUids = [];
    // Check if panel is pinned then in that case get the remote_inboxes property from user object
    // This is mainly needed as if panel is pinned then already subscribe site proeprty value is not
    // correct so we need to get the property value from user object and add it to valid sites so that
    // already added sites should nto be visible as avaialble sites.
    if( isPanelPinned && userObject ) {
        var modelObject = cdm.getObject( userObject.uid );
        if( modelObject && modelObject.props && modelObject.props.remote_inboxes ) {
            subscribeSiteUids = modelObject.props.remote_inboxes.dbValues;
        }
    }

    // Check if subscribe site is not null and not empty then filter the sites with
    // subscribe sites so that it can show only sites that are not subscribed.
    if( subscribeSiteUids && !_.isEmpty( subscribeSiteUids ) ) {
        var allSites = filterSites;
        filterSites = _.filter( allSites, function( o ) {
            return subscribeSiteUids.indexOf( o.uid ) < 0;
        } );
    }

    // Check if user input filter string is not null and not '*' then we need to filter
    // all available sites based in user input string.
    if( filterString && filterString.trim() !== '' && filterString.trim() !== '*' ) {
        var regExpString = _generateRegenx( filterString );
        var finalRexString = '*' + regExpString + '*';
        var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
        var localSites = _.clone( filterSites );
        filterSites = localSites.filter( function( vmoObject ) {
            // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
            // and before the match beign we should reset it to default value 0.
            regExp.lastIndex = 0;
            // Filering based on two properties name and site id
            var propValue = _getPropValue( vmoObject, 'name' );
            var siteIdValue = _getPropValue( vmoObject, 'site_id' );
            if( regExp.test( propValue ) || regExp.test( siteIdValue ) ) {
                return true;
            }
        } );
    }
    return filterSites;
};

/**
  * Get the set properties input array based on input options.
  * @param {Object} userObject User object for remote inbox subscription need to be done
  * @param {Array} selectedObjects Selected sites that need to be added or removed
  * @param {Array} allSubscribeSites All subscribed sites that need to be updated
  * @param {String} isAppendCase True or undefined. Undefiend will be consided as remove and any value will be
  *                considered as append case.
  * @returns {Array} Set properties input array
  */
export let getSubscribeInboxPropertyInput = function( userObject, selectedObjects, allSubscribeSites, isAppendCase ) {
    // Get site uid list for site need to be added or removed and current subscribed sites/
    var selectedSites = _getSiteIdList( selectedObjects );
    var subscribeSites = _getSiteIdList( allSubscribeSites );
    var validSites = [];
    if( subscribeSites ) {
        Array.prototype.push.apply( validSites, subscribeSites );
    }

    // Check if panel is pinned then in that case get the remote_inboxes property from user object
    // This is mainly needed as if panel is pinned then already subscribe site proeprty value is not
    // correct so we need to get the property value from user object and add it to valid sites.
    if( userObject ) {
        var modelObject = cdm.getObject( userObject.uid );
        if( modelObject && modelObject.props && modelObject.props.remote_inboxes ) {
            var remoteInboxes = modelObject.props.remote_inboxes.dbValues;
            if( remoteInboxes && !_.isEmpty( remoteInboxes ) ) {
                Array.prototype.push.apply( validSites, remoteInboxes );
            }
        }
    }

    // Iterate for all sites and based on add or remove case updates the valid site array
    if( selectedSites && selectedSites.length > 0 ) {
        _.forEach( selectedSites, function( siteObjectUid ) {
            if( isAppendCase ) {
                if( validSites.indexOf( siteObjectUid ) < 0 && siteObjectUid ) {
                    validSites.push( siteObjectUid );
                }
            } else {
                validSites = _.difference( validSites, selectedSites );
            }
        } );
    }
    // Remove the duplicate site UID's from valid site array.
    validSites = _.uniq( validSites );

    var input = [];
    var dataVal = {
        object:{
            uid: userObject.uid,
            type: userObject.type
        },
        vecNameVal: [ {
            name: 'remote_inboxes',
            values: validSites
        } ]
    };
    input.push( dataVal );
    return input;
};

/**
  * Open the site object and navigate to my tasks location for that site configured in remote URL preference.
  *
  * @param {Object} siteObject Site object that need to be opened
  * @returns {Promise} Promise object
  */
var _openRemoteSiteObject = function( siteObject ) {
    // Get the name proeprty from site and then get the preference value to get the correct
    // active workspace URL that need to open.
    var siteName = null;
    return _dms.getProperties(  [ siteObject.uid ], [ 'name' ] ).then( function() {
        var modelObject = cdm.getObject( siteObject.uid );
        siteName = _getPropValue( modelObject, 'name' );
        var siteDispName = _getPropValue( modelObject, 'name', true );
        if( !siteDispName && siteName ) {
            siteDispName = siteName;
        }
        return _prefSvc.getStringValues( [ OPEN_REMOTE_INBOX_PREFERENCE ] ).then( function( prefValues ) {
            var isSiteURLFound = false;
            // Iterate for all preference values and check if value begins with site name
            // user is trying to open and if yes then open that site else show the error.
            for( var idx = 0; idx < prefValues.length; idx++ ) {
                if( _.startsWith( prefValues[ idx ], siteName ) ) {
                    var splitNames = prefValues[ idx ].split( '::' );
                    if( splitNames && splitNames.length > 1 && splitNames[1] ) {
                        isSiteURLFound = true;
                        var action = { actionType: 'Navigate' };
                        action.navigateTo = splitNames[1] + '/#/myTasks';
                        action.navigationParams = {};
                        action.navigateIn = 'newTab';
                        navigationSvc.navigate( action, {} );
                        break;
                    }
                }
            }
            // Check if site URL is not found and site name is present then we need to show
            // the error to user stating that site specific URL is missing from preference.
            if( !isSiteURLFound && siteDispName ) {
                var localTextBundle = localeSvc.getLoadedText( 'InboxMessages' );
                var missingURLErrorMsg = localTextBundle.launchRemoteInboxSiteURLError;
                missingURLErrorMsg = missingURLErrorMsg.replace( '{0}', siteDispName );
                messagingSvc.showError( missingURLErrorMsg );
            }
        } );
    } );
};

/**
  * Open the remote inbox object when user is opening the task inbox from
  * remote inbox subscription table.
  * @param {Object} taskInbox Task inbox object that need to be opened
  * @returns {Promise} Promise object
  */
export let openRemoteInboxObject = function( taskInbox ) {
    // Check if task inbox is null or not object set row then we don't need to process further
    // as there is nothing to open.
    if( !taskInbox || !taskInbox.type ) {
        return;
    }
    var siteObject = null;
    var taskInboxObject = taskInbox;
    // Get the site object from secondary object from row and then get the name property from site
    // as this is needed to open the URL.
    if( taskInbox.modelType && taskInbox.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) > -1  && cdm.isValidObjectUid( taskInbox.props.awp0Secondary.dbValue ) ) {
        taskInboxObject = viewModelObjectService.createViewModelObject( cdm.getObject( taskInbox.props.awp0Secondary.dbValue ) );
    }
    // Check if task inbox object is not null then get the owning site from
    // task inbox object and then use that site object.
    if( taskInboxObject ) {
        var propValue = _getPropValue( taskInboxObject, 'owning_site' );
        if( propValue && !_.isEmpty( propValue ) ) {
            siteObject = cdm.getObject( propValue );
        }
    }
    // Check if site object is not null then no need to process further.
    if( !siteObject || !siteObject.uid ) {
        return;
    }
    return _openRemoteSiteObject( siteObject );
};


export default exports = {
    getAvailableMultisiteSites,
    showAvailableSites,
    getSubscribeInboxPropertyInput,
    openRemoteInboxObject
};
